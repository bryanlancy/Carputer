'use client'

import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import styles from './VersionDistributionPieChart.module.scss'

interface VersionData {
	current_build_id: string
	count: string
}

interface VersionDistributionPieChartProps {
	versions: VersionData[]
}

interface PieDatum extends d3.PieArcDatum<number> {
	data: {
		buildId: string
		count: number
	}
}

export default function VersionDistributionPieChart({
	versions,
}: VersionDistributionPieChartProps) {
	const svgRef = useRef<SVGSVGElement>(null)
	const containerRef = useRef<HTMLDivElement>(null)
	const [selectedVersion, setSelectedVersion] = useState<string | null>(null)
	const [tooltip, setTooltip] = useState<{
		x: number
		y: number
		text: string
	} | null>(null)

	useEffect(() => {
		if (!svgRef.current || !versions || versions.length === 0) {
			return
		}

		const svg = d3.select(svgRef.current)
		svg.selectAll('*').remove()

		const width = 400
		const height = 400
		const radius = Math.min(width, height) / 2 - 40

		// Set SVG dimensions
		svg.attr('width', width).attr('height', height)

		// Create main group and translate to center
		const g = svg
			.append('g')
			.attr('transform', `translate(${width / 2}, ${height / 2})`)

		// Prepare data
		const data = versions.map(v => ({
			buildId: v.current_build_id || 'Unknown',
			count: parseInt(v.count, 10) || 0,
		}))

		const total = data.reduce((sum, d) => sum + d.count, 0)

		// Color scale
		const colorScale = d3
			.scaleOrdinal<string>()
			.domain(data.map(d => d.buildId))
			.range(d3.schemeCategory10)

		// Pie generator
		const pie = d3
			.pie<{ buildId: string; count: number }>()
			.value(d => d.count)
			.sort(null)

		// Arc generator
		const arc = d3
			.arc<PieDatum>()
			.innerRadius(0)
			.outerRadius(radius)

		const arcHover = d3
			.arc<PieDatum>()
			.innerRadius(0)
			.outerRadius(radius + 10)

		// Generate arcs
		const arcs = g
			.selectAll('.arc')
			.data(pie(data))
			.enter()
			.append('g')
			.attr('class', 'arc')
			.attr('aria-label', d => `${d.data.buildId}: ${d.data.count} devices`)

		// Draw pie slices
		const paths = arcs
			.append('path')
			.attr('d', d =>
				selectedVersion === d.data.buildId ? arcHover(d) : arc(d)
			)
			.attr('fill', d => colorScale(d.data.buildId))
			.attr('stroke', '#fff')
			.attr('stroke-width', 2)
			.style('cursor', 'pointer')
			.style('transition', 'all 0.3s ease')
			.attr(
				'opacity',
				d =>
					selectedVersion === null || selectedVersion === d.data.buildId
						? 1
						: 0.3
			)

		// Hover interactions
		paths
			.on('mouseenter', function (event, d) {
				d3.select(this).attr('d', arcHover).attr('opacity', 1)

				if (containerRef.current) {
					const containerRect = containerRef.current.getBoundingClientRect()
					const [x, y] = d3.pointer(event, containerRef.current)
					const percentage = ((d.data.count / total) * 100).toFixed(1)
					setTooltip({
						x,
						y,
						text: `${d.data.buildId}\n${d.data.count} devices (${percentage}%)`,
					})
				}
			})
			.on('mouseleave', function (event, d) {
				const currentArc = selectedVersion === d.data.buildId ? arcHover : arc
				d3.select(this).attr('d', currentArc)
				setTooltip(null)
			})
			.on('click', function (event, d) {
				const newSelected =
					selectedVersion === d.data.buildId ? null : d.data.buildId
				setSelectedVersion(newSelected)
			})

		// Add labels on slices (if slice is large enough)
		const labels = arcs
			.filter(d => {
				const angle = d.endAngle - d.startAngle
				return angle > 0.2 && d.data.count > 0
			})
			.append('text')
			.attr('transform', d => {
				const [x, y] = arc.centroid(d)
				return `translate(${x}, ${y})`
			})
			.attr('text-anchor', 'middle')
			.attr('font-size', '12px')
			.attr('font-weight', '600')
			.attr('fill', '#fff')
			.attr('pointer-events', 'none')
			.text(d => {
				const percentage = ((d.data.count / total) * 100).toFixed(0)
				return `${percentage}%`
			})

		// Cleanup function
		return () => {
			svg.selectAll('*').remove()
		}
	}, [versions, selectedVersion])

	if (!versions || versions.length === 0) {
		return (
			<div className={styles.container}>
				<p className={styles.noData}>No version data available</p>
			</div>
		)
	}

	const totalDevices = versions.reduce(
		(sum, v) => sum + (parseInt(v.count, 10) || 0),
		0
	)

	// Color scale for legend (same as in chart)
	const colorScale = d3
		.scaleOrdinal<string>()
		.domain(versions.map(v => v.current_build_id || 'Unknown'))
		.range(d3.schemeCategory10)

	return (
		<div ref={containerRef} className={styles.container}>
			<div className={styles.chartContainer}>
				<svg ref={svgRef} className={styles.chart}></svg>
				{tooltip && (
					<div
						className={styles.tooltip}
						style={{
							left: `${tooltip.x + 10}px`,
							top: `${tooltip.y - 10}px`,
						}}>
						{tooltip.text.split('\n').map((line, i) => (
							<div key={i}>{line}</div>
						))}
					</div>
				)}
			</div>
			<div className={styles.legend}>
				<h3 className={styles.legendTitle}>Versions</h3>
				<ul className={styles.legendList}>
					{versions.map(version => {
						const buildId = version.current_build_id || 'Unknown'
						const count = parseInt(version.count, 10) || 0
						const percentage = totalDevices > 0
							? ((count / totalDevices) * 100).toFixed(1)
							: '0.0'
						const isSelected = selectedVersion === buildId

						return (
							<li
								key={buildId}
								className={`${styles.legendItem} ${
									isSelected ? styles.legendItemSelected : ''
								}`}
								onClick={() =>
									setSelectedVersion(
										isSelected ? null : buildId
									)
								}
								style={{
									opacity: selectedVersion === null || isSelected ? 1 : 0.3,
									cursor: 'pointer',
								}}>
								<span
									className={styles.legendColor}
									style={{
										backgroundColor: colorScale(buildId),
									}}></span>
								<span className={styles.legendLabel}>{buildId}</span>
								<span className={styles.legendCount}>
									{count} ({percentage}%)
								</span>
							</li>
						)
					})}
				</ul>
			</div>
		</div>
	)
}
