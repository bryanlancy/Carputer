'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { formatDistanceToNow } from 'date-fns'
import styles from './page.module.scss'
import { getApiUrl } from '../utils/api'
import { useWebSocket, WebSocketMessage } from '../hooks/useWebSocket'

interface Device {
	id: number
	device_id: string
	hostname: string | null
	status: string
	last_seen: string | null
	current_version: string | null
	current_build_id: string | null
}

interface Image {
	id: number
	image_build_hash: string
	image_signature: string | null
	build_id: string | null
	git_sha: string | null
	build_timestamp: string | null
	verified: boolean
	verified_at: string | null
	verified_by: string | null
	is_active: boolean
	is_latest: boolean
	changelog: string | null
	notes: string | null
	created_at: string
	updated_at: string
	device_count: number
	online_device_count: number
	devices?: Device[]
}

type SortField = 'build_id' | 'verified' | 'device_count' | 'created_at'
type SortDirection = 'asc' | 'desc'

export default function ImagesPage() {
	const [images, setImages] = useState<Image[]>([])
	const [loading, setLoading] = useState(true)
	const [sortField, setSortField] = useState<SortField>('created_at')
	const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
	const [expandedImage, setExpandedImage] = useState<string | null>(null)
	const [verifying, setVerifying] = useState<string | null>(null)

	// Handle WebSocket messages
	const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
		if (message.type === 'image_update' && message.image) {
			const image = message.image as Image

			// Update image in state
			setImages(prevImages => {
				const imageIndex = prevImages.findIndex(
					img => img.image_build_hash === image.image_build_hash
				)
				if (imageIndex >= 0) {
					// Update existing image
					const updated = [...prevImages]
					updated[imageIndex] = image
					return updated
				} else {
					// Add new image
					return [...prevImages, image]
				}
			})
		}
	}, [])

	// Subscribe to WebSocket updates
	const { connected } = useWebSocket(handleWebSocketMessage, ['images'])

	// Initial fetch and periodic refresh only if WebSocket is not connected
	useEffect(() => {
		const fetchImages = async () => {
			try {
				const apiUrl = getApiUrl()
				const response = await fetch(
					`${apiUrl}/api/images?includeUnverified=true&activeOnly=false`
				)
				if (response.ok) {
					const data = await response.json()
					setImages(data.images || [])
				}
			} catch (error) {
				console.error('Failed to fetch images:', error)
			} finally {
				setLoading(false)
			}
		}

		fetchImages()

		// Only refresh periodically if WebSocket is not connected
		if (!connected) {
			const interval = setInterval(fetchImages, 30000)
			return () => clearInterval(interval)
		}
	}, [connected])

	const fetchImageDetails = async (buildHash: string) => {
		try {
			const apiUrl =
				process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
			const response = await fetch(
				`${apiUrl}/api/images/${encodeURIComponent(buildHash)}`
			)
			if (response.ok) {
				const data = await response.json()
				// Update the image in the list with device details
				setImages(prev =>
					prev.map(img =>
						img.image_build_hash === buildHash
							? { ...img, devices: data.devices }
							: img
					)
				)
			}
		} catch (error) {
			console.error('Failed to fetch image details:', error)
		}
	}

	const handleExpand = (buildHash: string) => {
		if (expandedImage === buildHash) {
			setExpandedImage(null)
		} else {
			setExpandedImage(buildHash)
			const image = images.find(img => img.image_build_hash === buildHash)
			if (image && !image.devices) {
				fetchImageDetails(buildHash)
			}
		}
	}

	const handleVerify = async (buildHash: string) => {
		if (
			!confirm(
				'Mark this image as verified? Devices using this image will be automatically authorized.'
			)
		) {
			return
		}

		setVerifying(buildHash)
		try {
			const apiUrl =
				process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
			const response = await fetch(
				`${apiUrl}/api/images/${encodeURIComponent(buildHash)}/verify`,
				{
					method: 'PATCH',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						verifiedBy: 'admin',
					}),
				}
			)

			if (response.ok) {
				// Refresh images list
				const imagesResponse = await fetch(
					`${apiUrl}/api/images?includeUnverified=true&activeOnly=false`
				)
				if (imagesResponse.ok) {
					const data = await imagesResponse.json()
					setImages(data.images || [])
				}
			}
		} catch (error) {
			console.error('Failed to verify image:', error)
		} finally {
			setVerifying(null)
		}
	}

	// Sort images
	const sortedImages = useMemo(() => {
		const sorted = [...images]

		sorted.sort((a, b) => {
			let aValue: any
			let bValue: any

			switch (sortField) {
				case 'build_id':
					aValue = (a.build_id || '').toLowerCase()
					bValue = (b.build_id || '').toLowerCase()
					break
				case 'verified':
					aValue = a.verified ? 1 : 0
					bValue = b.verified ? 1 : 0
					break
				case 'device_count':
					aValue = a.device_count || 0
					bValue = b.device_count || 0
					break
				case 'created_at':
					aValue = new Date(a.created_at).getTime()
					bValue = new Date(b.created_at).getTime()
					break
				default:
					return 0
			}

			if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
			if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
			return 0
		})

		return sorted
	}, [images, sortField, sortDirection])

	const handleSort = (field: SortField) => {
		if (sortField === field) {
			setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
		} else {
			setSortField(field)
			setSortDirection('desc')
		}
	}

	const truncateHash = (hash: string, length: number = 16): string => {
		if (hash.length <= length) return hash
		return `${hash.substring(0, length)}...`
	}

	if (loading) {
		return (
			<div className={styles.container}>
				<div className={styles.loading}>Loading images...</div>
			</div>
		)
	}

	const unverifiedImages = images.filter(img => !img.verified)
	const verifiedImages = images.filter(img => img.verified)

	return (
		<div className={styles.container}>
			<header className={styles.header}>
				<h1>Carputer Images</h1>
				<p>
					Manage and monitor carputer image builds{' '}
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
				{images.length === 0 ? (
					<div className={styles.emptyState}>
						<p>No images registered yet.</p>
						<p>
							Images will appear here when devices register with
							them.
						</p>
					</div>
				) : (
					<>
						{unverifiedImages.length > 0 && (
							<div className={styles.alertSection}>
								<div className={styles.alert}>
									<strong>
										⚠️ {unverifiedImages.length} unverified
										image
										{unverifiedImages.length !== 1
											? 's'
											: ''}{' '}
										need
										{unverifiedImages.length === 1
											? 's'
											: ''}{' '}
										review
									</strong>
									<p>
										These images were discovered from device
										registrations and need to be verified.
									</p>
								</div>
							</div>
						)}

						<div className={styles.stats}>
							<div className={styles.statCard}>
								<div className={styles.statValue}>
									{images.length}
								</div>
								<div className={styles.statLabel}>
									Total Images
								</div>
							</div>
							<div className={styles.statCard}>
								<div className={styles.statValue}>
									{verifiedImages.length}
								</div>
								<div className={styles.statLabel}>Verified</div>
							</div>
							<div className={styles.statCard}>
								<div className={styles.statValue}>
									{unverifiedImages.length}
								</div>
								<div className={styles.statLabel}>
									Unverified
								</div>
							</div>
							<div className={styles.statCard}>
								<div className={styles.statValue}>
									{images.reduce(
										(sum, img) =>
											sum + (img.device_count || 0),
										0
									)}
								</div>
								<div className={styles.statLabel}>
									Total Devices
								</div>
							</div>
						</div>

						<div className={styles.tableContainer}>
							<table className={styles.imagesTable}>
								<thead>
									<tr>
										<th
											onClick={() =>
												handleSort('build_id')
											}
											className={styles.sortable}>
											Build ID
											{sortField === 'build_id' && (
												<span
													className={
														styles.sortIndicator
													}>
													{sortDirection === 'asc'
														? '↑'
														: '↓'}
												</span>
											)}
										</th>
										<th>Image Hash</th>
										<th
											onClick={() =>
												handleSort('verified')
											}
											className={styles.sortable}>
											Status
											{sortField === 'verified' && (
												<span
													className={
														styles.sortIndicator
													}>
													{sortDirection === 'asc'
														? '↑'
														: '↓'}
												</span>
											)}
										</th>
										<th
											onClick={() =>
												handleSort('device_count')
											}
											className={styles.sortable}>
											Devices
											{sortField === 'device_count' && (
												<span
													className={
														styles.sortIndicator
													}>
													{sortDirection === 'asc'
														? '↑'
														: '↓'}
												</span>
											)}
										</th>
										<th>Git SHA</th>
										<th
											onClick={() =>
												handleSort('created_at')
											}
											className={styles.sortable}>
											Created
											{sortField === 'created_at' && (
												<span
													className={
														styles.sortIndicator
													}>
													{sortDirection === 'asc'
														? '↑'
														: '↓'}
												</span>
											)}
										</th>
										<th>Actions</th>
									</tr>
								</thead>
								<tbody>
									{sortedImages.map(image => (
										<>
											<tr
												key={image.id}
												className={`${
													styles.imageRow
												} ${
													!image.verified
														? styles.unknownRow
														: ''
												}`}
												onClick={() =>
													handleExpand(
														image.image_build_hash
													)
												}>
												<td className={styles.buildId}>
													{image.build_id || (
														<span
															className={
																styles.noData
															}>
															—
														</span>
													)}
												</td>
												<td
													className={styles.hash}
													title={
														image.image_build_hash
													}>
													<code>
														{truncateHash(
															image.image_build_hash
														)}
													</code>
												</td>
												<td>
													{image.verified ? (
														<span
															className={`${styles.statusBadge} ${styles.statusVerified}`}>
															✓ Verified
														</span>
													) : (
														<span
															className={`${styles.statusBadge} ${styles.statusUnverified}`}>
															Unverified
														</span>
													)}
													{!image.is_active && (
														<span
															className={`${styles.statusBadge} ${styles.statusInactive}`}>
															Inactive
														</span>
													)}
													{image.is_latest && (
														<span
															className={`${styles.statusBadge} ${styles.statusLatest}`}>
															Latest
														</span>
													)}
												</td>
												<td
													className={
														styles.deviceCount
													}>
													<strong>
														{image.device_count ||
															0}
													</strong>
													{image.online_device_count >
														0 && (
														<span
															className={
																styles.onlineCount
															}>
															{' '}
															(
															{
																image.online_device_count
															}{' '}
															online)
														</span>
													)}
												</td>
												<td className={styles.gitSha}>
													{image.git_sha ? (
														<code
															title={
																image.git_sha
															}>
															{truncateHash(
																image.git_sha,
																8
															)}
														</code>
													) : (
														<span
															className={
																styles.noData
															}>
															—
														</span>
													)}
												</td>
												<td
													className={
														styles.createdAt
													}>
													{formatDistanceToNow(
														new Date(
															image.created_at
														),
														{ addSuffix: true }
													)}
												</td>
												<td
													className={styles.actions}
													onClick={e =>
														e.stopPropagation()
													}>
													{!image.verified && (
														<button
															className={
																styles.verifyButton
															}
															onClick={() =>
																handleVerify(
																	image.image_build_hash
																)
															}
															disabled={
																verifying ===
																image.image_build_hash
															}>
															{verifying ===
															image.image_build_hash
																? 'Verifying...'
																: 'Verify'}
														</button>
													)}
													{image.device_count > 0 && (
														<button
															className={
																styles.expandButton
															}
															onClick={() =>
																handleExpand(
																	image.image_build_hash
																)
															}>
															{expandedImage ===
															image.image_build_hash
																? '▼'
																: '▶'}
														</button>
													)}
												</td>
											</tr>
											{expandedImage ===
												image.image_build_hash &&
												image.devices &&
												image.devices.length > 0 && (
													<tr>
														<td
															colSpan={7}
															className={
																styles.deviceList
															}>
															<div
																className={
																	styles.deviceListHeader
																}>
																<strong>
																	Devices
																	using this
																	image (
																	{
																		image
																			.devices
																			.length
																	}
																	):
																</strong>
															</div>
															<div
																className={
																	styles.deviceListGrid
																}>
																{image.devices.map(
																	device => (
																		<div
																			key={
																				device.id
																			}
																			className={
																				styles.deviceItem
																			}>
																			<span
																				className={
																					styles.deviceName
																				}>
																				{device.hostname ||
																					device.device_id}
																			</span>
																			<span
																				className={`${
																					styles.deviceStatus
																				} ${
																					styles[
																						`status${
																							device.status
																								.charAt(
																									0
																								)
																								.toUpperCase() +
																							device.status.slice(
																								1
																							)
																						}`
																					]
																				}`}>
																				{
																					device.status
																				}
																			</span>
																			{device.last_seen && (
																				<span
																					className={
																						styles.deviceLastSeen
																					}>
																					{formatDistanceToNow(
																						new Date(
																							device.last_seen
																						),
																						{
																							addSuffix:
																								true,
																						}
																					)}
																				</span>
																			)}
																		</div>
																	)
																)}
															</div>
														</td>
													</tr>
												)}
										</>
									))}
								</tbody>
							</table>
						</div>
					</>
				)}
			</main>
		</div>
	)
}
