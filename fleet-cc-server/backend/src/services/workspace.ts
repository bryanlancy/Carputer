import { PrismaClient } from '@prisma/client'

/**
 * Workspace Service
 *
 * Manages workspaces for organizing wiring configurations.
 * Workspaces allow users to group related wiring setups (e.g., "Notifications", "Automations").
 */

export class WorkspaceService {
	constructor(private prisma: PrismaClient) {}

	/**
	 * Get all workspaces
	 */
	async getAllWorkspaces(): Promise<any[]> {
		return this.prisma.workspace.findMany({
			orderBy: { created_at: 'desc' },
		})
	}

	/**
	 * Get workspace by ID
	 */
	async getWorkspaceById(workspaceId: number): Promise<any | null> {
		return this.prisma.workspace.findUnique({
			where: { id: workspaceId },
			include: {
				wiring_configuration: true,
			},
		})
	}

	/**
	 * Create a new workspace
	 */
	async createWorkspace(data: {
		name: string
		description?: string
	}): Promise<any> {
		// Validate name is not empty
		if (!data.name || data.name.trim().length === 0) {
			throw new Error('Workspace name is required')
		}

		return this.prisma.workspace.create({
			data: {
				name: data.name.trim(),
				description: data.description?.trim() || null,
			},
		})
	}

	/**
	 * Update workspace
	 */
	async updateWorkspace(
		workspaceId: number,
		data: {
			name?: string
			description?: string
		}
	): Promise<any> {
		// Validate workspace exists
		const existing = await this.prisma.workspace.findUnique({
			where: { id: workspaceId },
		})

		if (!existing) {
			throw new Error(`Workspace ${workspaceId} not found`)
		}

		return this.prisma.workspace.update({
			where: { id: workspaceId },
			data: {
				...(data.name !== undefined && { name: data.name.trim() }),
				...(data.description !== undefined && {
					description: data.description?.trim() || null,
				}),
			},
		})
	}

	/**
	 * Delete workspace
	 * This will also delete the associated wiring configuration due to CASCADE
	 */
	async deleteWorkspace(workspaceId: number): Promise<void> {
		// Validate workspace exists
		const existing = await this.prisma.workspace.findUnique({
			where: { id: workspaceId },
		})

		if (!existing) {
			throw new Error(`Workspace ${workspaceId} not found`)
		}

		await this.prisma.workspace.delete({
			where: { id: workspaceId },
		})
	}
}
