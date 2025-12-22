'use client'

import { useState } from 'react'
import NotificationTypeManager from './NotificationTypeManager'
import MessageManager from '../admin/MessageManager'
import styles from './AdminNotificationSettings.module.scss'

export default function AdminNotificationSettings() {
	return (
		<div className={styles.container}>
			<div className={styles.header}>
				<h2>Message Management</h2>
			</div>

			<div className={styles.content}>
				<div className={styles.section}>
					<h3>Notifications</h3>
					<p className={styles.sectionDescription}>
						Notifications define what kinds of notifications can be
						sent.
					</p>
					<NotificationTypeManager />
				</div>

				<div className={styles.section}>
					<h3>Messages</h3>
					<p className={styles.sectionDescription}>
						Messages (like emails) can be used in wiring actions
						and support variable templating.
					</p>
					<MessageManager />
				</div>
			</div>
		</div>
	)
}
