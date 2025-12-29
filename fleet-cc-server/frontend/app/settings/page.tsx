'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../contexts/AuthContext'
import { getApiUrl } from '../utils/api'
import AdminNotificationSettings from '../components/notifications/AdminNotificationSettings'
import NotificationSettings from '../components/notifications/NotificationSettings'
import WiringManager from '../components/wiring/WiringManager'
import TriggerManager from '../components/admin/TriggerManager'
import ActionManager from '../components/admin/ActionManager'
import TagManager from '../components/admin/TagManager'
import ApiKeyManager from '../components/admin/ApiKeyManager'
import styles from './page.module.scss'

export default function SettingsPage() {
	const [activeSection, setActiveSection] = useState<
		| 'notifications'
		| 'triggers'
		| 'actions'
		| 'messages'
		| 'wiring'
		| 'tags'
		| 'api-keys'
	>('notifications')
	const [isAdmin, setIsAdmin] = useState<boolean>(false)
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
			setIsAdmin(false)
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
			setIsAdmin(response.status === 200)
		} catch (error: any) {
			// Generic error - don't reveal details
			console.error('Auth check error:', error)
			setIsAdmin(false)
		} finally {
			setLoading(false)
		}
	}

	// Redirect to user settings if not admin and trying to access admin sections
	useEffect(() => {
		if (!loading && !isAdmin) {
			if (
				activeSection === 'triggers' ||
				activeSection === 'actions' ||
				activeSection === 'messages' ||
				activeSection === 'wiring' ||
				activeSection === 'tags' ||
				activeSection === 'api-keys'
			) {
				setActiveSection('notifications')
			}
		}
	}, [loading, isAdmin, activeSection])

	// Re-check admin status periodically to catch role changes
	useEffect(() => {
		if (!isAdmin || !user || !session) return

		const interval = setInterval(() => {
			checkAuth()
		}, 60000) // Check every minute

		return () => clearInterval(interval)
	}, [isAdmin, user, session])

	if (loading) {
		return (
			<div className={styles.container}>
				<div className={styles.loading}>Loading...</div>
			</div>
		)
	}

	if (!user || !session) {
		return (
			<div className={styles.container}>
				<div className={styles.errorContainer}>
					<h2>Access Denied</h2>
					<p>Please log in to access settings.</p>
					<div className={styles.buttonGroup}>
						<button
							onClick={() => router.push('/login')}
							className={styles.loginButton}>
							Log In
						</button>
					</div>
				</div>
			</div>
		)
	}

	return (
		<div className={styles.container}>
			<div className={styles.layout}>
				<nav className={styles.sidebar}>
					<div className={styles.header}>
						<h1>Settings</h1>
						<p className={styles.subtitle}>
							Manage user and system settings
						</p>
					</div>
					<div className={styles.navGroup}>
						<div className={styles.groupHeader}>
							User Settings
						</div>
						<ul>
							<li>
								<button
									className={
										activeSection === 'notifications'
											? styles.active
											: ''
									}
									onClick={() =>
										setActiveSection('notifications')
									}>
									<span className={styles.icon}>🔔</span>
									Notifications
								</button>
							</li>
						</ul>
					</div>
					{isAdmin && (
						<>
							<div className={styles.navGroup}>
								<div className={styles.groupHeader}>
									Admin Settings
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
											onClick={() =>
												setActiveSection('actions')
											}>
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
											onClick={() =>
												setActiveSection('wiring')
											}>
											<span className={styles.icon}>🔌</span>
											Wiring
										</button>
									</li>
									<li>
										<button
											className={
												activeSection === 'api-keys'
													? styles.active
													: ''
											}
											onClick={() =>
												setActiveSection('api-keys')
											}>
											<span className={styles.icon}>🔑</span>
											API Keys
										</button>
									</li>
								</ul>
							</div>
							<div className={styles.navGroup}>
								<div className={styles.groupHeader}>
									Tag Management
								</div>
								<ul>
									<li>
										<button
											className={
												activeSection === 'tags'
													? styles.active
													: ''
											}
											onClick={() =>
												setActiveSection('tags')
											}>
											<span className={styles.icon}>🏷️</span>
											Tags
										</button>
									</li>
								</ul>
							</div>
						</>
					)}
				</nav>

				<div className={styles.content}>
					{activeSection === 'notifications' && (
						<NotificationSettings />
					)}
					{isAdmin && activeSection === 'triggers' && (
						<TriggerManager onUnauthorized={() => checkAuth()} />
					)}
					{isAdmin && activeSection === 'actions' && (
						<ActionManager onUnauthorized={() => checkAuth()} />
					)}
					{isAdmin && activeSection === 'messages' && (
						<AdminNotificationSettings onUnauthorized={() => checkAuth()} />
					)}
					{isAdmin && activeSection === 'wiring' && (
						<WiringManager onUnauthorized={() => checkAuth()} />
					)}
					{isAdmin && activeSection === 'tags' && (
						<TagManager onUnauthorized={() => checkAuth()} />
					)}
					{isAdmin && activeSection === 'api-keys' && (
						<ApiKeyManager onUnauthorized={() => checkAuth()} />
					)}
					{!isAdmin &&
						(activeSection === 'triggers' ||
							activeSection === 'actions' ||
							activeSection === 'messages' ||
							activeSection === 'wiring' ||
							activeSection === 'tags' ||
							activeSection === 'api-keys') && (
							<div className={styles.errorContainer}>
								<h2>Access Denied</h2>
								<p>
									You do not have permission to access admin
									settings.
								</p>
							</div>
						)}
				</div>
			</div>
		</div>
	)
}
