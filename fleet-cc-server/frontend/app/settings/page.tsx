'use client'

import { useState } from 'react'
import NotificationSettings from '../components/NotificationSettings'
import styles from './page.module.scss'

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<'notifications'>('notifications')

  return (
    <div className={styles.container}>
      <h1>Settings</h1>

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
            {/* Add more settings sections here in the future */}
          </ul>
        </nav>

        <div className={styles.content}>
          {activeSection === 'notifications' && <NotificationSettings />}
        </div>
      </div>
    </div>
  )
}

