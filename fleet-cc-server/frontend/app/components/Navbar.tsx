'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '../contexts/AuthContext'
import NotificationFeed, { useNotificationCount } from './NotificationFeed'
import styles from './Navbar.module.scss'

export default function Navbar() {
  const [showNotificationFeed, setShowNotificationFeed] = useState(false)
  const { user, isAdmin, signOut } = useAuth()
  const pathname = usePathname()
  const unviewedCount = useNotificationCount()

  const handleSignOut = async () => {
    try {
      // Clear local storage immediately for better UX
      localStorage.removeItem('auth_token')
      localStorage.removeItem('supabase.auth.token')
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-') || key.includes('supabase')) {
          localStorage.removeItem(key)
        }
      })

      // Call signOut (it will handle the rest)
      await signOut()
    } catch (error) {
      console.error('Sign out error:', error)
      // Force redirect even if signOut fails
      window.location.href = '/login'
    }
  }

  return (
    <nav className={styles.nav}>
      <div className={styles.navContainer}>
        <Link href='/' className={styles.navBrand}>
          Fleet CC
        </Link>
        <div className={styles.navLinks}>
          <Link href='/' className={pathname === '/' ? styles.active : styles.navLink}>
            Dashboard
          </Link>
          <Link href='/devices' className={pathname === '/devices' ? styles.active : styles.navLink}>
            Devices
          </Link>
          <Link href='/images' className={pathname === '/images' ? styles.active : styles.navLink}>
            Images
          </Link>
          <Link href='/docs' className={pathname === '/docs' ? styles.active : styles.navLink}>
            Docs
          </Link>
          <Link href='/settings' className={pathname === '/settings' ? styles.active : styles.navLink}>
            Settings
          </Link>
          {isAdmin && (
            <Link href='/admin' className={pathname === '/admin' ? styles.active : styles.navLink}>
              Admin
            </Link>
          )}
          {user && (
            <div className={styles.userSection}>
              <button
                onClick={() => setShowNotificationFeed(!showNotificationFeed)}
                className={styles.notificationButton}
                aria-label="Notifications"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {unviewedCount > 0 && (
                  <span className={styles.notificationBadge}>{unviewedCount > 99 ? '99+' : unviewedCount}</span>
                )}
              </button>
              <span className={styles.userEmail}>{user.email}</span>
              <button onClick={handleSignOut} className={styles.signOutButton}>
                Sign Out
              </button>
            </div>
          )}
          {user && (
            <div className={styles.notificationFeedWrapper}>
              <NotificationFeed
                isOpen={showNotificationFeed}
                onClose={() => setShowNotificationFeed(false)}
              />
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}

