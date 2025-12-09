import { Queue, Worker } from 'bullmq'
import { PrismaClient } from '@prisma/client'
import { NotificationTriggerService } from '../services/notificationTriggers'
import { NotificationRuleService } from '../services/notificationRules'
import { NotificationService } from '../services/notification'
import {
	checkRedisAvailability,
	createRedisConnection,
	getRedisUrl,
} from '../utils/redis'

/**
 * Scheduled Notifications Job Processor
 * Processes scheduled date/time notification triggers
 */

let worker: Worker | null = null
let triggerService: NotificationTriggerService | null = null

/**
 * Initialize the scheduled notifications worker
 * Waits for Redis to be available before starting
 */
export async function initializeScheduledNotificationsWorker(
	prisma: PrismaClient
): Promise<void> {
	if (worker) {
		console.log('Scheduled notifications worker already initialized')
		return
	}

	const redisUrl = getRedisUrl()

	// Check if Redis is available before initializing
	console.log(
		'Checking Redis availability for scheduled notifications worker...'
	)
	const isAvailable = await checkRedisAvailability(redisUrl, 5, 2000)

	if (!isAvailable) {
		console.warn(
			'Redis is not available. Scheduled notifications worker will be disabled.'
		)
		console.warn(
			'To enable scheduled notifications, ensure Redis is running and accessible.'
		)
		return
	}

	try {
		console.log(
			'Redis is available, initializing scheduled notifications worker...'
		)
		const redis = createRedisConnection(redisUrl)

		const notificationService = new NotificationService(prisma)
		const ruleService = new NotificationRuleService(
			prisma,
			notificationService
		)
		triggerService = new NotificationTriggerService(prisma, ruleService)

		worker = new Worker(
			'scheduled-notifications',
			async job => {
				console.log(`Processing scheduled notification job: ${job.id}`)
				const { triggerId } = job.data

				if (!triggerService) {
					throw new Error('Trigger service not initialized')
				}

				try {
					await triggerService.executeTrigger(triggerId)
					console.log(`Successfully executed trigger ${triggerId}`)
				} catch (error: any) {
					console.error(
						`Failed to execute trigger ${triggerId}:`,
						error
					)
					throw error
				}
			},
			{
				connection: redis,
				concurrency: 5, // Process up to 5 jobs concurrently
			}
		)

		worker.on('completed', job => {
			console.log(`Scheduled notification job ${job.id} completed`)
		})

		worker.on('failed', (job, err) => {
			console.error(`Scheduled notification job ${job?.id} failed:`, err)
		})

		worker.on('error', err => {
			console.error('Scheduled notifications worker error:', err)
		})

		console.log('Scheduled notifications worker initialized')
	} catch (error: any) {
		console.warn(
			'Failed to initialize scheduled notifications worker:',
			error.message
		)
		console.warn(
			'Scheduled notifications will be disabled. To enable it, ensure Redis is running.'
		)
		// Continue without the worker - the app should still function
	}
}

/**
 * Shutdown the worker gracefully
 */
export async function shutdownScheduledNotificationsWorker(): Promise<void> {
	if (worker) {
		await worker.close()
		worker = null
		triggerService = null
		console.log('Scheduled notifications worker shut down')
	}
}

/**
 * Schedule a notification for a specific date/time
 */
export async function scheduleNotification(
	ruleId: number,
	scheduledAt: Date,
	triggerConfig: any
): Promise<any> {
	if (!triggerService) {
		throw new Error(
			'Trigger service not initialized. Call initializeScheduledNotificationsWorker first.'
		)
	}

	return triggerService.createScheduledTrigger(
		ruleId,
		scheduledAt,
		triggerConfig
	)
}
