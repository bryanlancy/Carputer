'use client'

import { useState, useEffect } from 'react'
import { getApiUrl } from '../utils/api'
import NotificationTypeManager from './NotificationTypeManager'
import NotificationRuleManager from './NotificationRuleManager'
import styles from './AdminNotificationSettings.module.scss'

export default function AdminNotificationSettings() {
  const [activeTab, setActiveTab] = useState<'types' | 'rules'>('types')

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Notification Management</h2>
        <p className={styles.description}>
          Configure notification types and rules for the system. Notification types define what kinds of notifications can be sent,
          while rules determine when and to whom notifications are delivered.
        </p>
      </div>

      <div className={styles.tabs}>
        <button
          className={activeTab === 'types' ? styles.active : ''}
          onClick={() => setActiveTab('types')}
        >
          <span className={styles.tabIcon}>📋</span>
          Notification Types
        </button>
        <button
          className={activeTab === 'rules' ? styles.active : ''}
          onClick={() => setActiveTab('rules')}
        >
          <span className={styles.tabIcon}>⚙️</span>
          Notification Rules
        </button>
      </div>

      <div className={styles.tabContent}>
        {activeTab === 'types' ? (
          <NotificationTypeManager />
        ) : (
          <NotificationRuleManager />
        )}
      </div>
    </div>
  )
}
