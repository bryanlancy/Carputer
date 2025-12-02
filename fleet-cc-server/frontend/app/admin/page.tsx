'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getApiUrl } from '../utils/api'
import AdminNotificationSettings from '../components/AdminNotificationSettings'
import styles from './page.module.scss'

export default function AdminPage() {
  const [activeSection, setActiveSection] = useState<'notifications'>('notifications')
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('auth_token')

      if (!token) {
        setIsAuthorized(false)
        setLoading(false)
        router.push('/')
        return
      }

      // Verify token and check admin role by trying to access an admin endpoint
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/admin/notifications/types`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.status === 401 || response.status === 403) {
        setIsAuthorized(false)
        setLoading(false)
        router.push('/')
        return
      }

      if (response.ok) {
        setIsAuthorized(true)
      } else {
        setIsAuthorized(false)
        router.push('/')
      }
    } catch (error) {
      console.error('Auth check error:', error)
      setIsAuthorized(false)
      router.push('/')
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
        <div className={styles.error}>Unauthorized. Redirecting...</div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <h1>Admin Panel</h1>

      <div className={styles.layout}>
        <nav className={styles.sidebar}>
          <ul>
            <li>
              <button
                className={activeSection === 'notifications' ? styles.active : ''}
                onClick={() => setActiveSection('notifications')}
              >
                Notifications
              </button>
            </li>
            {/* Add more admin sections here in the future */}
          </ul>
        </nav>

        <div className={styles.content}>
          {activeSection === 'notifications' && isAuthorized && <AdminNotificationSettings />}
        </div>
      </div>
    </div>
  )
}

