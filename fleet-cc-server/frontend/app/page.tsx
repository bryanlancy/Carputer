'use client'

import { useEffect, useState, useCallback } from 'react'
import styles from './page.module.scss'
import { getApiUrl, authenticatedFetch } from './utils/api'
import { useWebSocket, WebSocketMessage } from './hooks/useWebSocket'
import VersionDistributionPieChart from './components/admin/VersionDistributionPieChart'

interface FleetMetrics {
	devices: {
		byStatus: Record<string, number>
		online: number
	}
	versions: Array<{ current_build_id: string; count: string }>
	commands: {
		last24h: Record<string, number>
	}
}

export default function Home() {
	const [metrics, setMetrics] = useState<FleetMetrics | null>(null)
	const [loading, setLoading] = useState(true)

	// Handle WebSocket messages
	const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
		if (message.type === 'metrics_update' && message.metrics) {
			setMetrics(message.metrics as FleetMetrics)
		} else if (message.type === 'device_update') {
			// When device updates, refresh metrics
			const fetchMetrics = async () => {
				try {
					const apiUrl = getApiUrl()
					const response = await authenticatedFetch(
						`${apiUrl}/api/metrics/overview`
					)
					if (response.ok) {
						const data = await response.json()
						setMetrics(data)
					}
				} catch (error) {
					console.error('Failed to fetch metrics:', error)
				}
			}
			fetchMetrics()
		}
	}, [])

	// Subscribe to WebSocket updates
	const { connected } = useWebSocket(handleWebSocketMessage, [
		'metrics',
		'devices',
	])

	// Initial fetch and periodic refresh only if WebSocket is not connected
	useEffect(() => {
		const fetchMetrics = async () => {
			try {
				const apiUrl = getApiUrl()
				const response = await authenticatedFetch(
					`${apiUrl}/api/metrics/overview`
				)
				if (response.ok) {
					const data = await response.json()
					setMetrics(data)
				}
			} catch (error) {
				console.error('Failed to fetch metrics:', error)
			} finally {
				setLoading(false)
			}
		}

		fetchMetrics()

		// Only refresh periodically if WebSocket is not connected
		if (!connected) {
			const interval = setInterval(fetchMetrics, 30000)
			return () => clearInterval(interval)
		}
	}, [connected])

	if (loading) {
		return (
			<div className={styles.container}>
				<div className={styles.loading}>Loading...</div>
			</div>
		)
	}

	return (
		<div className={styles.container}>
			<header className={styles.header}>
				<h1>Fleet Command & Control</h1>
				<p>
					Carputer Fleet Management Dashboard{' '}
					{connected && (
						<span
							style={{
								color: '#10b981',
								fontSize: '0.9rem',
								fontWeight: 600,
								marginLeft: '0.5rem',
							}}>
							(Live)
						</span>
					)}
				</p>
			</header>

			<main className={styles.main}>
				<section className={styles.metrics}>
					<div className={styles.metricCard}>
						<h2>Devices Online</h2>
						<div className={styles.metricValue}>
							{metrics?.devices.online || 0}
						</div>
						<a href='/devices' className={styles.viewAllLink}>
							View All Devices →
						</a>
					</div>

					<div className={styles.metricCard}>
						<h2>Total Devices</h2>
						<div className={styles.metricValue}>
							{metrics?.devices.byStatus
								? Object.values(
										metrics.devices.byStatus
								  ).reduce((a, b) => a + b, 0)
								: 0}
						</div>
					</div>

					<div className={styles.metricCard}>
						<h2>Commands (24h)</h2>
						<div className={styles.metricValue}>
							{metrics?.commands.last24h
								? Object.values(
										metrics.commands.last24h
								  ).reduce((a, b) => a + b, 0)
								: 0}
						</div>
					</div>
				</section>

				<section className={styles.content}>
					<div className={styles.card}>
						<h2>Device Status</h2>
						<div className={styles.statusGrid}>
							{metrics?.devices.byStatus &&
								Object.entries(metrics.devices.byStatus).map(
									([status, count]) => (
										<div
											key={status}
											className={styles.statusItem}>
											<span
												className={styles.statusLabel}>
												{status}
											</span>
											<span
												className={styles.statusCount}>
												{count}
											</span>
										</div>
									)
								)}
						</div>
					</div>

					<div className={styles.card}>
						<h2>Version Distribution</h2>
						<VersionDistributionPieChart
							versions={metrics?.versions || []}
						/>
					</div>
				</section>
			</main>
		</div>
	)
}
