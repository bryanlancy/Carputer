'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../contexts/AuthContext'
import { getApiUrl } from '../utils/api'
import AdminNotificationSettings from '../components/AdminNotificationSettings'
import styles from './page.module.scss'

export default function AdminPage() {
  const [activeSection, setActiveSection] = useState<'notifications'>('notifications')
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
      // Verify token and check admin role by trying to access an admin endpoint
      const apiUrl = getApiUrl()
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000)

        const response = await fetch(`${apiUrl}/api/admin/notifications/types`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (response.status === 401 || response.status === 403) {
          setIsAuthorized(false)
          setLoading(false)
          return
        }

        if (response.ok) {
          setIsAuthorized(true)
        } else {
          setIsAuthorized(false)
        }
      } catch (fetchError: any) {
        // Generic error - don't reveal details
        setIsAuthorized(false)
      }
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
            <button onClick={() => router.push('/')} className={styles.backButton}>
              Return to Dashboard
            </button>
            {!user && (
              <button onClick={() => router.push('/login')} className={styles.loginButton}>
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
        <p className={styles.subtitle}>Manage system settings and configurations</p>
      </div>

      <div className={styles.layout}>
        <nav className={styles.sidebar}>
          <ul>
            <li>
              <button
                className={activeSection === 'notifications' ? styles.active : ''}
                onClick={() => setActiveSection('notifications')}
              >
                <span className={styles.icon}>🔔</span>
                Notifications
              </button>
            </li>
            {/* Add more admin sections here in the future */}
          </ul>
        </nav>

        <div className={styles.content}>
          {activeSection === 'notifications' && <AdminNotificationSettings />}
        </div>
      </div>
    </div>
  )
}
