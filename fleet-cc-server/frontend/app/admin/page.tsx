'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../contexts/AuthContext'
import { getApiUrl } from '../utils/api'
import AdminNotificationSettings from '../components/AdminNotificationSettings'
import WiringManager from '../components/WiringManager'
import TriggerManager from '../components/TriggerManager'
import ActionManager from '../components/ActionManager'
import TagManager from '../components/TagManager'
import styles from './page.module.scss'

export default function AdminPage() {
	const [activeSection, setActiveSection] = useState<
		'triggers' | 'actions' | 'messages' | 'wiring' | 'tags'
	>('triggers')
	const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)
	const [loading, setLoading] = useState(true)
	const { user, session, loading: authLoading } = useAuth()
	const router = useRouter()

	useEffect(() => {
		if (!authLoading) {
			checkAuth()
		}
	}, [authLoading, session])

	const checkAuth = async () => {
		// Check if user is authenticated
		if (!user || !session) {
			setIsAuthorized(false)
			setLoading(false)
			return
		}

		try {
			// Verify admin access using the dedicated verify endpoint
			const apiUrl = getApiUrl()
			const controller = new AbortController()
			const timeoutId = setTimeout(() => controller.abort(), 5000)

			const response = await fetch(`${apiUrl}/api/admin/verify`, {
				headers: {
					Authorization: `Bearer ${session.access_token}`,
				},
				signal: controller.signal,
			})

			clearTimeout(timeoutId)

			// 200 = admin, 403 = not admin, 401 = not authenticated
			setIsAuthorized(response.status === 200)
		} catch (error: any) {
			// Generic error - don't reveal details
			console.error('Auth check error:', error)
			setIsAuthorized(false)
		} finally {
			setLoading(false)
		}
	}

	if (loading) {
		return (
			<div className={styles.container}>
				<div className={styles.loading}>Checking authorization...</div>
			</div>
		)
	}

	if (!isAuthorized) {
		return (
			<div className={styles.container}>
				<div className={styles.errorContainer}>
					<h2>Access Denied</h2>
					<p>User not authenticated or insufficient permissions.</p>
					<div className={styles.buttonGroup}>
						<button
							onClick={() => router.push('/')}
							className={styles.backButton}>
							Return to Dashboard
						</button>
						{!user && (
							<button
								onClick={() => router.push('/login')}
								className={styles.loginButton}>
								Log In
							</button>
						)}
					</div>
				</div>
			</div>
		)
	}

	return (
		<div className={styles.container}>
			<div className={styles.header}>
				<h1>Admin Dashboard</h1>
				<p className={styles.subtitle}>
					Manage system settings and configurations
				</p>
			</div>

			<div className={styles.layout}>
				<nav className={styles.sidebar}>
					<div className={styles.navGroup}>
						<div className={styles.groupHeader}>
							Message Configuration
						</div>
						<ul>
							<li>
								<button
									className={
										activeSection === 'triggers'
											? styles.active
											: ''
									}
									onClick={() =>
										setActiveSection('triggers')
									}>
									<span className={styles.icon}>⚡</span>
									Triggers
								</button>
							</li>
							<li>
								<button
									className={
										activeSection === 'actions'
											? styles.active
											: ''
									}
									onClick={() => setActiveSection('actions')}>
									<span className={styles.icon}>🎯</span>
									Actions
								</button>
							</li>
							<li>
								<button
									className={
										activeSection === 'messages'
											? styles.active
											: ''
									}
									onClick={() =>
										setActiveSection('messages')
									}>
									<span className={styles.icon}>💬</span>
									Messages
								</button>
							</li>
							<li>
								<button
									className={
										activeSection === 'wiring'
											? styles.active
											: ''
									}
									onClick={() => setActiveSection('wiring')}>
									<span className={styles.icon}>🔌</span>
									Wiring
								</button>
							</li>
						</ul>
					</div>
					<div className={styles.navGroup}>
						<div className={styles.groupHeader}>Tag Management</div>
						<ul>
							<li>
								<button
									className={
										activeSection === 'tags'
											? styles.active
											: ''
									}
									onClick={() => setActiveSection('tags')}>
									<span className={styles.icon}>🏷️</span>
									Tags
								</button>
							</li>
						</ul>
					</div>
				</nav>

				<div className={styles.content}>
					{activeSection === 'triggers' && <TriggerManager />}
					{activeSection === 'actions' && <ActionManager />}
					{activeSection === 'messages' && (
						<AdminNotificationSettings />
					)}
					{activeSection === 'wiring' && <WiringManager />}
					{activeSection === 'tags' && <TagManager />}
				</div>
			</div>
		</div>
	)
}
