'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { getApiUrl, authenticatedFetch } from '../../utils/api'
import styles from './DefaultDeviceSettings.module.scss'

interface DefaultDevice {
	id: number
	device_id: string
	hostname: string | null
	vin: string | null
	hardware_rev: string | null
	build_id: string | null
	current_version: string | null
	current_build_id: string | null
	current_ip: string | null
	uptime: number | string | null
	services_status: Record<string, boolean> | null
	status: string
	last_seen: string | null
}

interface DefaultDeviceSettingsProps {
	onUnauthorized?: () => void
}

export default function DefaultDeviceSettings({
	onUnauthorized,
}: DefaultDeviceSettingsProps = {}) {
	const { session } = useAuth()
	const [device, setDevice] = useState<DefaultDevice | null>(null)
	const [loading, setLoading] = useState(true)
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [success, setSuccess] = useState<string | null>(null)
	const [formData, setFormData] = useState({
		device_id: '',
		hostname: '',
		vin: '',
		hardware_rev: '',
		build_id: '',
		current_version: '',
		current_build_id: '',
		current_ip: '',
		uptime: '',
		services_status: '{}',
		status: 'online',
		last_seen: '',
	})
	const [originalFormData, setOriginalFormData] = useState(formData)

	useEffect(() => {
		loadDevice()
	}, [])

	const loadDevice = async () => {
		try {
			setLoading(true)
			setError(null)
			const apiUrl = getApiUrl()
			const response = await authenticatedFetch(
				`${apiUrl}/api/admin/defaults/device`,
				{
					headers: {
						Authorization: `Bearer ${session?.access_token}`,
					},
				}
			)

			if (response.ok) {
				const data = await response.json()
				setDevice(data)
				// Populate form with device data
				const newFormData = {
					device_id: data.device_id || '',
					hostname: data.hostname || '',
					vin: data.vin || '',
					hardware_rev: data.hardware_rev || '',
					build_id: data.build_id || '',
					current_version: data.current_version || '',
					current_build_id: data.current_build_id || '',
					current_ip: data.current_ip || '',
					uptime: data.uptime ? String(data.uptime) : '',
					services_status: data.services_status
						? JSON.stringify(data.services_status, null, 2)
						: '{}',
					status: data.status || 'online',
					last_seen: data.last_seen
						? new Date(data.last_seen).toISOString().slice(0, 16)
						: '',
				}
				setFormData(newFormData)
				setOriginalFormData(newFormData)
			} else if (response.status === 403) {
				setError('You do not have permission to access default device settings')
				onUnauthorized?.()
			} else if (response.status === 401) {
				setError('Authentication required')
				onUnauthorized?.()
			} else if (response.status === 404) {
				setError(
					'Default device not found. Please run the database seeder to create it.'
				)
			} else {
				const errorData = await response.json().catch(() => ({}))
				setError(errorData.error || 'Failed to load default device')
			}
		} catch (err: any) {
			console.error('Failed to load default device:', err)
			setError('Failed to load default device')
		} finally {
			setLoading(false)
		}
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setError(null)
		setSuccess(null)
		setSaving(true)

		try {
			// Parse services_status JSON
			let servicesStatus: Record<string, boolean> | null = null
			try {
				const parsed = JSON.parse(formData.services_status)
				servicesStatus = parsed
			} catch (err) {
				throw new Error('Invalid JSON in services_status field')
			}

			// Parse uptime as number or null
			const uptime =
				formData.uptime.trim() === '' ? null : Number(formData.uptime)

			if (formData.uptime.trim() !== '' && isNaN(uptime!)) {
				throw new Error('Uptime must be a valid number')
			}

			// Parse last_seen as ISO string or null
			const lastSeen =
				formData.last_seen.trim() === ''
					? null
					: new Date(formData.last_seen).toISOString()

			const apiUrl = getApiUrl()
			const requestBody: any = {
				device_id: formData.device_id.trim() || undefined,
				hostname: formData.hostname.trim() || null,
				vin: formData.vin.trim() || null,
				hardware_rev: formData.hardware_rev.trim() || null,
				build_id: formData.build_id.trim() || null,
				current_version: formData.current_version.trim() || null,
				current_build_id: formData.current_build_id.trim() || null,
				current_ip: formData.current_ip.trim() || null,
				uptime: uptime,
				services_status: servicesStatus,
				status: formData.status,
				last_seen: lastSeen,
			}

			const response = await authenticatedFetch(
				`${apiUrl}/api/admin/defaults/device`,
				{
					method: 'PUT',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${session?.access_token}`,
					},
					body: JSON.stringify(requestBody),
				}
			)

			if (response.ok) {
				const updatedDevice = await response.json()
				setDevice(updatedDevice)
				// Update original form data to reflect saved state
				const newFormData = {
					device_id: updatedDevice.device_id || '',
					hostname: updatedDevice.hostname || '',
					vin: updatedDevice.vin || '',
					hardware_rev: updatedDevice.hardware_rev || '',
					build_id: updatedDevice.build_id || '',
					current_version: updatedDevice.current_version || '',
					current_build_id: updatedDevice.current_build_id || '',
					current_ip: updatedDevice.current_ip || '',
					uptime: updatedDevice.uptime ? String(updatedDevice.uptime) : '',
					services_status: updatedDevice.services_status
						? JSON.stringify(updatedDevice.services_status, null, 2)
						: '{}',
					status: updatedDevice.status || 'online',
					last_seen: updatedDevice.last_seen
						? new Date(updatedDevice.last_seen).toISOString().slice(0, 16)
						: '',
				}
				setFormData(newFormData)
				setOriginalFormData(newFormData)
				setSuccess('Default device updated successfully')
				// Clear success message after 3 seconds
				setTimeout(() => setSuccess(null), 3000)
			} else if (response.status === 403) {
				setError('You do not have permission to update default device')
				onUnauthorized?.()
			} else if (response.status === 401) {
				setError('Authentication required')
				onUnauthorized?.()
			} else {
				const errorData = await response.json().catch(() => ({}))
				setError(
					errorData.error ||
						errorData.message ||
						'Failed to update default device'
				)
			}
		} catch (err: any) {
			console.error('Failed to update default device:', err)
			setError(err.message || 'Failed to update default device')
		} finally {
			setSaving(false)
		}
	}

	if (loading) {
		return <div className={styles.loading}>Loading default device...</div>
	}

	// Helper function to check if a field has changed
	const hasFieldChanged = (fieldName: keyof typeof formData): boolean => {
		const current = formData[fieldName]
		const original = originalFormData[fieldName]

		// Normalize JSON strings for comparison
		if (fieldName === 'services_status') {
			try {
				const currentParsed = JSON.parse(current || '{}')
				const originalParsed = JSON.parse(original || '{}')
				return JSON.stringify(currentParsed) !== JSON.stringify(originalParsed)
			} catch {
				return current !== original
			}
		}

		return current !== original
	}

	// Check if there are any pending changes
	const hasPendingChanges = (): boolean => {
		return Object.keys(formData).some(key =>
			hasFieldChanged(key as keyof typeof formData)
		)
	}

	if (error && !device) {
		return (
			<div className={styles.container}>
				<div className={styles.error}>
					{error}
					<button
						onClick={() => setError(null)}
						className={styles.dismissError}>
						×
					</button>
				</div>
			</div>
		)
	}

	return (
		<div className={styles.container}>
			<div className={styles.header}>
				<h2>Default Device Settings</h2>
				<p className={styles.description}>
					Edit the default device data used for message template previews.
					This device is excluded from device lists and counts.
				</p>
			</div>

			{error && (
				<div className={styles.error}>
					{error}
					<button
						onClick={() => setError(null)}
						className={styles.dismissError}>
						×
					</button>
				</div>
			)}

			{success && (
				<div className={styles.success}>
					{success}
					<button
						onClick={() => setSuccess(null)}
						className={styles.dismissSuccess}>
						×
					</button>
				</div>
			)}

			<form onSubmit={handleSubmit} className={styles.form}>
				<div className={styles.section}>
					<h3>Device Information</h3>
					<div className={styles.twoColumn}>
						<div className={styles.formGroup}>
							<label>
								Device ID *
								<input
									type='text'
									value={formData.device_id}
									onChange={e =>
										setFormData({ ...formData, device_id: e.target.value })
									}
									required
									placeholder='e.g., default-device'
									className={
										hasFieldChanged('device_id') ? styles.changed : ''
									}
								/>
							</label>
						</div>

						<div className={styles.formGroup}>
							<label>
								Hostname
								<input
									type='text'
									value={formData.hostname}
									onChange={e =>
										setFormData({ ...formData, hostname: e.target.value })
									}
									placeholder='e.g., default-carputer'
									className={
										hasFieldChanged('hostname') ? styles.changed : ''
									}
								/>
							</label>
						</div>

						<div className={styles.formGroup}>
							<label>
								VIN
								<input
									type='text'
									value={formData.vin}
									onChange={e =>
										setFormData({ ...formData, vin: e.target.value })
									}
									placeholder='e.g., 1DEFAULT0000000000'
									className={hasFieldChanged('vin') ? styles.changed : ''}
								/>
							</label>
						</div>

						<div className={styles.formGroup}>
							<label>
								Hardware Revision
								<input
									type='text'
									value={formData.hardware_rev}
									onChange={e =>
										setFormData({
											...formData,
											hardware_rev: e.target.value,
										})
									}
									placeholder='e.g., rev1.0'
									className={
										hasFieldChanged('hardware_rev') ? styles.changed : ''
									}
								/>
							</label>
						</div>
					</div>
				</div>

				<div className={styles.section}>
					<h3>Version Information</h3>
					<div className={styles.twoColumn}>
						<div className={styles.formGroup}>
							<label>
								Build ID
								<input
									type='text'
									value={formData.build_id}
									onChange={e =>
										setFormData({ ...formData, build_id: e.target.value })
									}
									placeholder='e.g., v1.0.0'
									className={
										hasFieldChanged('build_id') ? styles.changed : ''
									}
								/>
							</label>
						</div>

						<div className={styles.formGroup}>
							<label>
								Current Version
								<input
									type='text'
									value={formData.current_version}
									onChange={e =>
										setFormData({
											...formData,
											current_version: e.target.value,
										})
									}
									placeholder='e.g., 1.0.0'
									className={
										hasFieldChanged('current_version') ? styles.changed : ''
									}
								/>
							</label>
						</div>

						<div className={styles.formGroup}>
							<label>
								Current Build ID
								<input
									type='text'
									value={formData.current_build_id}
									onChange={e =>
										setFormData({
											...formData,
											current_build_id: e.target.value,
										})
									}
									placeholder='e.g., v1.0.0'
									className={
										hasFieldChanged('current_build_id')
											? styles.changed
											: ''
									}
								/>
							</label>
						</div>
					</div>
				</div>

				<div className={styles.section}>
					<h3>Network & Status</h3>
					<div className={styles.twoColumn}>
						<div className={styles.formGroup}>
							<label>
								Current IP Address
								<input
									type='text'
									value={formData.current_ip}
									onChange={e =>
										setFormData({ ...formData, current_ip: e.target.value })
									}
									placeholder='e.g., 192.168.1.100'
									className={
										hasFieldChanged('current_ip') ? styles.changed : ''
									}
								/>
							</label>
						</div>

						<div className={styles.formGroup}>
							<label>
								Status *
								<select
									value={formData.status}
									onChange={e =>
										setFormData({ ...formData, status: e.target.value })
									}
									required
									className={
										hasFieldChanged('status') ? styles.changed : ''
									}>
									<option value='online'>Online</option>
									<option value='offline'>Offline</option>
									<option value='stale'>Stale</option>
									<option value='maintenance'>Maintenance</option>
								</select>
							</label>
						</div>

						<div className={styles.formGroup}>
							<label>
								Uptime (seconds)
								<input
									type='number'
									value={formData.uptime}
									onChange={e =>
										setFormData({ ...formData, uptime: e.target.value })
									}
									placeholder='e.g., 86400'
									min='0'
									className={
										hasFieldChanged('uptime') ? styles.changed : ''
									}
								/>
							</label>
						</div>

						<div className={styles.formGroup}>
							<label>
								Last Seen
								<input
									type='datetime-local'
									value={formData.last_seen}
									onChange={e =>
										setFormData({ ...formData, last_seen: e.target.value })
									}
									className={
										hasFieldChanged('last_seen') ? styles.changed : ''
									}
								/>
							</label>
						</div>
					</div>
				</div>

				<div className={styles.section}>
					<h3>Services Status</h3>
					<div className={styles.formGroup}>
						<label>
							Services Status (JSON)
							<textarea
								value={formData.services_status}
								onChange={e =>
									setFormData({
										...formData,
										services_status: e.target.value,
									})
								}
								placeholder='{"carputer_hub": true, "carputer_ui": true, "network": true}'
								rows={4}
								className={`${styles.jsonInput} ${
									hasFieldChanged('services_status') ? styles.changed : ''
								}`}
							/>
							<small>
								JSON object mapping service names to boolean status values
							</small>
						</label>
					</div>
				</div>

				<div className={styles.formActions}>
					<button
						type='submit'
						disabled={saving || !hasPendingChanges()}
						className={styles.saveButton}>
						{saving ? 'Saving...' : 'Save Changes'}
					</button>
					<button
						type='button'
						onClick={() => {
							setFormData(originalFormData)
							setError(null)
							setSuccess(null)
						}}
						disabled={!hasPendingChanges()}
						className={styles.resetButton}>
						Reset
					</button>
				</div>
			</form>
		</div>
	)
}

