'use client'

import { useState } from 'react'
import NotificationTypeManager from './NotificationTypeManager'
import MessageManager from './MessageManager'
import styles from './AdminNotificationSettings.module.scss'

export default function AdminNotificationSettings() {
	return (
		<div className={styles.container}>
			<div className={styles.header}>
				<h2>Message Management</h2>
				<p className={styles.description}>
					Configure notifications and messages for the system.
					Notifications define what kinds of notifications can be
					sent. Messages (like emails) can be used in wiring actions
					and support variable templating.
				</p>
			</div>

			<div className={styles.content}>
				<div className={styles.section}>
					<h3>Notifications</h3>
					<NotificationTypeManager />
				</div>

				<div className={styles.section}>
					<h3>Messages</h3>
					<MessageManager />
				</div>
			</div>
		</div>
	)
}
