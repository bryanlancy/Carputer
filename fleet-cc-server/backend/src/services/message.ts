import { PrismaClient } from '@prisma/client'

/**
 * Message Service
 *
 * Manages message templates (emails, SMS, etc.) with variable templating.
 * Messages can be used in wiring actions like Send Email.
 */

export class MessageService {
	constructor(private prisma: PrismaClient) {}

	/**
	 * Get all messages
	 */
	async getAllMessages(
		options: {
			enabled?: boolean
			message_type?: string
		} = {}
	): Promise<any[]> {
		const where: any = {}
		if (options.enabled !== undefined) {
			where.enabled = options.enabled
		}
		if (options.message_type) {
			where.message_type = options.message_type
		}

		return this.prisma.message.findMany({
			where,
			orderBy: { message_name: 'asc' },
		})
	}

	/**
	 * Get message by code
	 */
	async getMessageByCode(messageCode: string): Promise<any | null> {
		return this.prisma.message.findUnique({
			where: { message_code: messageCode },
		})
	}

	/**
	 * Get message by ID
	 */
	async getMessageById(messageId: number): Promise<any | null> {
		return this.prisma.message.findUnique({
			where: { id: messageId },
		})
	}

	/**
	 * Create a new message
	 */
	async createMessage(data: {
		message_code: string
		message_name: string
		description?: string
		message_type: string
		subject_template?: string
		body_template: string
		variable_schema?: any
		enabled?: boolean
	}): Promise<any> {
		// Validate message_code is unique
		const existing = await this.prisma.message.findUnique({
			where: { message_code: data.message_code },
		})

		if (existing) {
			throw new Error(
				`Message with code ${data.message_code} already exists`
			)
		}

		return this.prisma.message.create({
			data: {
				message_code: data.message_code,
				message_name: data.message_name,
				description: data.description || null,
				message_type: data.message_type,
				subject_template: data.subject_template || null,
				body_template: data.body_template,
				variable_schema: data.variable_schema || null,
				enabled: data.enabled !== undefined ? data.enabled : true,
			},
		})
	}

	/**
	 * Update message
	 */
	async updateMessage(
		messageId: number,
		data: {
			message_name?: string
			description?: string
			message_type?: string
			subject_template?: string
			body_template?: string
			variable_schema?: any
			enabled?: boolean
		}
	): Promise<any> {
		return this.prisma.message.update({
			where: { id: messageId },
			data: {
				...(data.message_name && { message_name: data.message_name }),
				...(data.description !== undefined && {
					description: data.description,
				}),
				...(data.message_type && { message_type: data.message_type }),
				...(data.subject_template !== undefined && {
					subject_template: data.subject_template,
				}),
				...(data.body_template && {
					body_template: data.body_template,
				}),
				...(data.variable_schema !== undefined && {
					variable_schema: data.variable_schema,
				}),
				...(data.enabled !== undefined && { enabled: data.enabled }),
			},
		})
	}

	/**
	 * Delete message
	 */
	async deleteMessage(messageId: number): Promise<void> {
		await this.prisma.message.delete({
			where: { id: messageId },
		})
	}
}
