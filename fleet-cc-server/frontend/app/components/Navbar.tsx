'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '../contexts/AuthContext'
import { getApiUrl } from '../utils/api'
import styles from './Navbar.module.scss'

export default function Navbar() {
  const [isAdmin, setIsAdmin] = useState(false)
  const { user, session, signOut } = useAuth()
  const pathname = usePathname()

  useEffect(() => {
    if (session) {
      checkAdminStatus()
    }
  }, [session])

  const checkAdminStatus = async () => {
    if (!session) {
      setIsAdmin(false)
      return
    }

    try {
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/admin/notifications/types`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      setIsAdmin(response.ok || response.status === 200)
    } catch (error) {
      setIsAdmin(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
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
              <span className={styles.userEmail}>{user.email}</span>
              <button onClick={handleSignOut} className={styles.signOutButton}>
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}

