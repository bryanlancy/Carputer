'use client'

import { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import styles from './page.module.scss'
import { getApiUrl } from '../utils/api'

// Import Swagger UI CSS
import 'swagger-ui-react/swagger-ui.css'

// Dynamically import SwaggerUI with no SSR
const SwaggerUI = dynamic(() => import('swagger-ui-react'), {
	ssr: false,
	loading: () => (
		<div style={{ padding: '2rem', textAlign: 'center' }}>
			Loading API documentation...
		</div>
	),
})

// Wrapper component to suppress React strict mode warnings from swagger-ui-react
const SwaggerUIWrapper = ({ spec }: { spec: any }) => {
	useEffect(() => {
		// Suppress the UNSAFE_componentWillReceiveProps warning from swagger-ui-react
		const originalError = console.error
		const originalWarn = console.warn

		console.error = (...args: any[]) => {
			// Filter out the specific warning about UNSAFE_componentWillReceiveProps from swagger-ui-react
			const message = args[0]?.toString() || ''
			if (
				message.includes('UNSAFE_componentWillReceiveProps') ||
				message.includes('ModelCollapse') ||
				message.includes('unsafe-component-lifecycles')
			) {
				return
			}
			originalError.apply(console, args)
		}

		console.warn = (...args: any[]) => {
			// Filter out the specific warning about UNSAFE_componentWillReceiveProps from swagger-ui-react
			const message = args[0]?.toString() || ''
			if (
				message.includes('UNSAFE_componentWillReceiveProps') ||
				message.includes('ModelCollapse') ||
				message.includes('unsafe-component-lifecycles')
			) {
				return
			}
			originalWarn.apply(console, args)
		}

		return () => {
			console.error = originalError
			console.warn = originalWarn
		}
	}, [])

	return (
		<SwaggerUI
			spec={spec}
			deepLinking={true}
			displayRequestDuration={true}
		/>
	)
}

export default function DocsPage() {
	const [activeTab, setActiveTab] = useState<'api' | 'guide'>('api')
	const [mounted, setMounted] = useState(false)
	const [swaggerSpec, setSwaggerSpec] = useState<any>(null)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [apiUrl, setApiUrl] = useState<string>('')

	// Ensure component only renders on client and determine API URL
	useEffect(() => {
		setMounted(true)
		setApiUrl(getApiUrl())
	}, [])

	// Fetch Swagger JSON from parent component (avoids CORS issues)
	useEffect(() => {
		if (
			mounted &&
			activeTab === 'api' &&
			apiUrl &&
			!swaggerSpec &&
			!loading &&
			!error
		) {
			setLoading(true)
			setError(null)
			const swaggerUrl = `${apiUrl}/api-docs/swagger.json`
			const healthUrl = `${apiUrl}/health`

			// First, try to check if backend is reachable via health endpoint
			fetch(healthUrl, { method: 'GET' })
				.then(healthRes => {
					if (!healthRes.ok) {
						throw new Error(
							`Backend health check failed: ${healthRes.status} ${healthRes.statusText}`
						)
					}
					// Backend is reachable, now fetch Swagger spec
					// Include Origin header so backend can determine correct server URL
					return fetch(swaggerUrl, {
						headers: {
							Origin:
								typeof window !== 'undefined'
									? window.location.origin
									: '',
						},
					})
				})
				.then(res => {
					if (!res.ok) {
						throw new Error(
							`Failed to fetch Swagger spec: ${res.status} ${res.statusText}`
						)
					}
					return res.json()
				})
				.then(spec => {
					setSwaggerSpec(spec)
					setLoading(false)
				})
				.catch(err => {
					console.error('Failed to fetch Swagger spec:', err)
					// Provide more helpful error message
					const errorMessage =
						err.message || 'Failed to load API documentation'
					let detailedError = errorMessage

					if (
						err.message?.includes('Failed to fetch') ||
						err.message?.includes('NetworkError')
					) {
						detailedError = `Network error: Could not reach ${apiUrl}. Possible causes: Backend server not running, backend only listening on localhost (should listen on 0.0.0.0), firewall blocking port 3001, or network connectivity issue. Try accessing ${apiUrl}/health directly in your browser.`
					} else if (err.message?.includes('health check')) {
						detailedError = `Backend is reachable but health check failed. ${err.message}`
					}

					setError(detailedError)
					setLoading(false)
				})
		}
	}, [mounted, activeTab, apiUrl, swaggerSpec, loading, error])

	// Function to download OpenAPI spec for Postman import
	const handleDownloadPostmanSpec = async () => {
		if (!apiUrl) {
			alert('API URL not available')
			return
		}

		try {
			const swaggerUrl = `${apiUrl}/api-docs/swagger.json`
			const response = await fetch(swaggerUrl, {
				headers: {
					Origin:
						typeof window !== 'undefined'
							? window.location.origin
							: '',
				},
			})

			if (!response.ok) {
				throw new Error(
					`Failed to fetch API spec: ${response.status} ${response.statusText}`
				)
			}

			const spec = await response.json()
			const specString = JSON.stringify(spec, null, 2)
			const blob = new Blob([specString], { type: 'application/json' })
			const url = URL.createObjectURL(blob)

			// Create a temporary download link
			const link = document.createElement('a')
			link.href = url
			link.download = 'fleet-cc-api-openapi-spec.json'
			document.body.appendChild(link)
			link.click()

			// Cleanup
			document.body.removeChild(link)
			URL.revokeObjectURL(url)
		} catch (err) {
			console.error('Failed to download API spec:', err)
			alert(
				`Failed to download API specification: ${
					err instanceof Error ? err.message : 'Unknown error'
				}`
			)
		}
	}

	return (
		<div className={styles.container}>
			<header className={styles.header}>
				<h1>Documentation</h1>
				<p>API documentation and guides for Fleet Command & Control</p>
			</header>

			<div className={styles.tabs}>
				<button
					className={`${styles.tab} ${
						activeTab === 'api' ? styles.active : ''
					}`}
					onClick={() => setActiveTab('api')}>
					API Documentation
				</button>
				<button
					className={`${styles.tab} ${
						activeTab === 'guide' ? styles.active : ''
					}`}
					onClick={() => setActiveTab('guide')}>
					User Guide
				</button>
				{activeTab === 'api' && (
					<button
						className={styles.postmanButton}
						onClick={handleDownloadPostmanSpec}
						title='Download OpenAPI specification for Postman import'>
						📥 Import to Postman
					</button>
				)}
			</div>

			<div className={styles.content}>
				{activeTab === 'api' && mounted && (
					<div className={styles.apiDocs}>
						{loading && (
							<div
								style={{
									padding: '2rem',
									textAlign: 'center',
								}}>
								<p>Loading API documentation...</p>
							</div>
						)}
						{error && (
							<div
								style={{
									padding: '2rem',
									textAlign: 'left',
									color: 'var(--error-color, #ff4444)',
									maxWidth: '800px',
									margin: '0 auto',
								}}>
								<p
									style={{
										fontWeight: 'bold',
										marginBottom: '1rem',
										fontSize: '1.1rem',
									}}>
									Error loading API documentation
								</p>
								<div
									style={{
										background:
											'var(--bg-tertiary, rgba(255, 68, 68, 0.1))',
										padding: '1rem',
										borderRadius: '8px',
										marginBottom: '1rem',
										border: '1px solid var(--border-color, rgba(255, 68, 68, 0.3))',
									}}>
									<p
										style={{
											margin: 0,
											whiteSpace: 'pre-wrap',
										}}>
										{error}
									</p>
								</div>
								{apiUrl && (
									<p
										style={{
											fontSize: '0.9rem',
											marginTop: '0.5rem',
											color: 'var(--text-secondary)',
										}}>
										Trying to connect to:{' '}
										<code
											style={{
												background:
													'var(--bg-tertiary)',
												padding: '0.2rem 0.4rem',
												borderRadius: '4px',
											}}>
											{apiUrl}
										</code>
									</p>
								)}
								<div
									style={{
										fontSize: '0.85rem',
										marginTop: '1.5rem',
										padding: '1rem',
										background: 'var(--bg-secondary)',
										borderRadius: '8px',
										border: '1px solid var(--border-color)',
									}}>
									<p
										style={{
											fontWeight: '600',
											marginBottom: '0.5rem',
											color: 'var(--text-primary)',
										}}>
										Troubleshooting:
									</p>
									<ul
										style={{
											margin: 0,
											paddingLeft: '1.5rem',
											color: 'var(--text-secondary)',
										}}>
										<li>
											Make sure the backend server is
											running
										</li>
										<li>
											Verify the backend is listening on{' '}
											<code>0.0.0.0:3001</code> (not just
											localhost)
										</li>
										<li>
											Check firewall settings for port
											3001
										</li>
										<li>
											Test connectivity by visiting{' '}
											<a
												href={`${apiUrl}/health`}
												target='_blank'
												rel='noopener noreferrer'
												style={{
													color: 'var(--primary-color)',
												}}>
												{apiUrl}/health
											</a>{' '}
											in your browser
										</li>
									</ul>
								</div>
							</div>
						)}
						{swaggerSpec && !loading && !error && (
							<div key='swagger-ui-wrapper'>
								<SwaggerUIWrapper spec={swaggerSpec} />
							</div>
						)}
					</div>
				)}

				{activeTab === 'guide' && (
					<div className={styles.guide}>
						<section className={styles.section}>
							<h2>Getting Started</h2>
							<p>
								Fleet Command & Control is a centralized
								management system for your Carputer fleet. This
								guide will help you get started with managing
								devices, images, and commands.
							</p>
						</section>

						<section className={styles.section}>
							<h2>Device Management</h2>
							<h3>Automatic Registration</h3>
							<p>
								Devices automatically register themselves when
								they first connect to the server. They use their
								MAC address and image build hash for
								identification. Devices running verified images
								are automatically authorized.
							</p>
							<h3>Manual Registration</h3>
							<p>
								For legacy support, devices can be manually
								registered using a registration token. However,
								automatic registration is recommended for new
								deployments.
							</p>
						</section>

						<section className={styles.section}>
							<h2>Image Verification</h2>
							<p>
								Images must be verified before devices can
								automatically register. You can add verified
								images through the Images page or via the API.
								Once an image is verified, any device running
								that image will be automatically authorized.
							</p>
						</section>

						<section className={styles.section}>
							<h2>Commands</h2>
							<p>
								Commands can be sent to devices through the API.
								Devices will pick up pending commands during
								their heartbeat. Supported commands include:
							</p>
							<ul>
								<li>
									<strong>reboot</strong> - Reboot the device
								</li>
								<li>
									<strong>start_service</strong> - Start a
									service
								</li>
								<li>
									<strong>stop_service</strong> - Stop a
									service
								</li>
								<li>
									<strong>trigger_rsync</strong> - Trigger
									rsync operation
								</li>
								<li>
									<strong>collect_logs</strong> - Collect
									device logs
								</li>
								<li>
									<strong>update</strong> - Update the device
								</li>
							</ul>
						</section>

						<section className={styles.section}>
							<h2>API Endpoints</h2>
							<p>
								For detailed API documentation, see the{' '}
								<strong>API Documentation</strong> tab above.
								All endpoints are RESTful and return JSON
								responses.
							</p>
						</section>
					</div>
				)}
			</div>
		</div>
	)
}
