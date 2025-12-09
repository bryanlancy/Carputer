import { PrismaClient } from '@prisma/client'
import { NotificationRuleService } from './notificationRules'
import { Queue, Worker } from 'bullmq'
import { createRedisConnection, getRedisUrl } from '../utils/redis'
import type Redis from 'ioredis'

/**
 * Notification Trigger Service
 * Manages scheduled and event-based notification triggers
 */
export class NotificationTriggerService {
	private redis: Redis | null
	private scheduledQueue: Queue | null
	private worker: Worker | null = null

	constructor(
		private prisma: PrismaClient,
		private ruleService: NotificationRuleService
	) {
		// Initialize Redis connection
		// BullMQ requires maxRetriesPerRequest to be null for blocking operations
		const redisUrl = getRedisUrl()
		try {
			this.redis = createRedisConnection(redisUrl)

			// Initialize BullMQ queue for scheduled notifications
			this.scheduledQueue = new Queue('scheduled-notifications', {
				connection: this.redis,
			})

			// Start worker to process scheduled notifications
			this.startWorker()
		} catch (error: any) {
			console.warn(
				'Failed to initialize Redis for notification triggers:',
				error.message
			)
			console.warn(
				'Notification scheduling will be disabled. To enable it, ensure Redis is running.'
			)
			// Create a dummy Redis instance to prevent crashes
			this.redis = null as any
			this.scheduledQueue = null as any
		}
	}

	/**
	 * Start worker to process scheduled notifications
	 */
	private startWorker(): void {
		if (!this.redis) {
			console.warn('Redis not available, skipping worker initialization')
			return
		}

		this.worker = new Worker(
			'scheduled-notifications',
			async job => {
				const { triggerId } = job.data
				await this.executeTrigger(triggerId)
			},
			{
				connection: this.redis,
			}
		)

		this.worker.on('completed', job => {
			console.log(`Scheduled notification job ${job.id} completed`)
		})

		this.worker.on('failed', (job, err) => {
			console.error(`Scheduled notification job ${job?.id} failed:`, err)
		})
	}

	/**
	 * Create a scheduled trigger
	 */
	async createScheduledTrigger(
		ruleId: number,
		scheduledAt: Date,
		triggerConfig: any
	): Promise<any> {
		const trigger = await this.prisma.notificationTrigger.create({
			data: {
				rule_id: ruleId,
				trigger_type: 'date_time',
				trigger_config: triggerConfig,
				scheduled_at: scheduledAt,
				status: 'pending',
			},
		})

		// Schedule job in BullMQ
		if (this.scheduledQueue) {
			const delay = scheduledAt.getTime() - Date.now()
			if (delay > 0) {
				await this.scheduledQueue.add(
					`trigger-${trigger.id}`,
					{ triggerId: trigger.id },
					{
						delay,
					}
				)
			} else {
				// Execute immediately if scheduled time has passed
				await this.executeTrigger(trigger.id)
			}
		} else {
			// If Redis is not available, execute immediately
			console.warn(
				'Redis not available, executing trigger immediately instead of scheduling'
			)
			await this.executeTrigger(trigger.id)
		}

		return trigger
	}

	/**
	 * Create a backend event trigger
	 */
	async createBackendEventTrigger(
		ruleId: number,
		triggerConfig: any
	): Promise<any> {
		return this.prisma.notificationTrigger.create({
			data: {
				rule_id: ruleId,
				trigger_type: 'backend_event',
				trigger_config: triggerConfig,
				status: 'pending',
			},
		})
	}

	/**
	 * Create a user-driven trigger
	 */
	async createUserDrivenTrigger(
		ruleId: number,
		triggerConfig: any,
		options: {
			deviceId?: number
			title?: string
			message?: string
			metadata?: any
		} = {}
	): Promise<any> {
		const trigger = await this.prisma.notificationTrigger.create({
			data: {
				rule_id: ruleId,
				trigger_type: 'user_driven',
				trigger_config: triggerConfig,
				status: 'pending',
			},
		})

		// Execute immediately for user-driven triggers
		await this.executeTrigger(trigger.id, options)

		return trigger
	}

	/**
	 * Execute a trigger
	 */
	async executeTrigger(
		triggerId: number,
		options: {
			deviceId?: number
			title?: string
			message?: string
			metadata?: any
			deviceLogId?: number
		} = {}
	): Promise<any> {
		const trigger = await this.prisma.notificationTrigger.findUnique({
			where: { id: triggerId },
			include: {
				rule: true,
			},
		})

		if (!trigger) {
			throw new Error(`Trigger ${triggerId} not found`)
		}

		if (trigger.status !== 'pending') {
			throw new Error(`Trigger ${triggerId} is not in pending status`)
		}

		try {
			// Update status to executing
			await this.prisma.notificationTrigger.update({
				where: { id: triggerId },
				data: {
					status: 'executed',
				},
			})

			// Execute the rule
			const notification = await this.ruleService.executeRule(
				trigger.rule_id!,
				{
					deviceId: options.deviceId,
					title: options.title,
					message: options.message,
					metadata: options.metadata,
					deviceLogId: options.deviceLogId,
				}
			)

			// Mark trigger as executed
			await this.prisma.notificationTrigger.update({
				where: { id: triggerId },
				data: {
					status: 'executed',
					executed_at: new Date(),
				},
			})

			return notification
		} catch (error: any) {
			// Mark trigger as failed
			await this.prisma.notificationTrigger.update({
				where: { id: triggerId },
				data: {
					status: 'failed',
					error_message: error.message || 'Unknown error',
				},
			})

			throw error
		}
	}

	/**
	 * Handle backend event
	 * Evaluates rules and creates triggers for matching rules
	 */
	async handleBackendEvent(
		eventType: string,
		eventData: any,
		options: {
			deviceId?: number
			metadata?: any
		} = {}
	): Promise<any[]> {
		const matchingRules = await this.ruleService.evaluateRulesForEvent(
			eventType,
			eventData
		)

		const notifications: any[] = []

		for (const rule of matchingRules) {
			// Create backend event trigger
			const trigger = await this.createBackendEventTrigger(rule.id, {
				event_type: eventType,
				event_data: eventData,
			})

			// Execute trigger immediately
			try {
				const notification = await this.executeTrigger(trigger.id, {
					deviceId: options.deviceId,
					metadata: {
						...options.metadata,
						event_type: eventType,
						event_data: eventData,
					},
				})
				notifications.push(notification)
			} catch (error) {
				console.error(`Failed to execute trigger ${trigger.id}:`, error)
			}
		}

		return notifications
	}

	/**
	 * Get pending triggers
	 */
	async getPendingTriggers(
		options: {
			trigger_type?: string
			limit?: number
			offset?: number
		} = {}
	): Promise<any[]> {
		const where: any = {
			status: 'pending',
		}

		if (options.trigger_type) {
			where.trigger_type = options.trigger_type
		}

		return this.prisma.notificationTrigger.findMany({
			where,
			include: {
				rule: true,
			},
			orderBy: {
				scheduled_at: 'asc',
			},
			take: options.limit || 100,
			skip: options.offset || 0,
		})
	}

	/**
	 * Cancel a trigger
	 */
	async cancelTrigger(triggerId: number): Promise<void> {
		await this.prisma.notificationTrigger.update({
			where: { id: triggerId },
			data: {
				status: 'cancelled',
			},
		})

		// Remove from queue if scheduled
		// Note: BullMQ doesn't have a direct way to remove by data, so we'll mark as cancelled
	}

	/**
	 * Cleanup old executed triggers
	 */
	async cleanupOldTriggers(daysToKeep: number = 30): Promise<number> {
		const cutoffDate = new Date()
		cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

		const result = await this.prisma.notificationTrigger.deleteMany({
			where: {
				status: {
					in: ['executed', 'failed', 'cancelled'],
				},
				executed_at: {
					lt: cutoffDate,
				},
			},
		})

		return result.count
	}
}
