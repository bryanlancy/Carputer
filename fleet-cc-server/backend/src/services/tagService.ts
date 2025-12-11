import { PrismaClient } from '@prisma/client'

/**
 * Tag Service
 *
 * Manages tags and tag associations across multiple entity types.
 * Supports tag inheritance and polymorphic associations.
 */
export class TagService {
	constructor(private prisma: PrismaClient) {}

	/**
	 * Get all available tags
	 */
	async getAllTags(
		options: {
			category?: string
			search?: string
		} = {}
	): Promise<any[]> {
		const where: any = {}

		if (options.category) {
			where.category = options.category
		}

		if (options.search) {
			where.OR = [
				{ name: { contains: options.search, mode: 'insensitive' } },
				{
					description: {
						contains: options.search,
						mode: 'insensitive',
					},
				},
			]
		}

		return this.prisma.tag.findMany({
			where,
			orderBy: {
				name: 'asc',
			},
			include: {
				_count: {
					select: {
						tag_associations: true,
					},
				},
			},
		})
	}

	/**
	 * Get tag by ID
	 */
	async getTagById(id: number): Promise<any> {
		return this.prisma.tag.findUnique({
			where: { id },
			include: {
				_count: {
					select: {
						tag_associations: true,
					},
				},
			},
		})
	}

	/**
	 * Get tag by name
	 */
	async getTagByName(name: string): Promise<any> {
		return this.prisma.tag.findUnique({
			where: { name },
		})
	}

	/**
	 * Create a new tag
	 */
	async createTag(data: {
		name: string
		description?: string | null
		color?: string | null
		category?: string | null
	}): Promise<any> {
		if (!data.name || data.name.trim().length === 0) {
			throw new Error('Tag name is required')
		}

		// Check if tag already exists
		const existing = await this.prisma.tag.findUnique({
			where: { name: data.name.trim() },
		})

		if (existing) {
			throw new Error(`Tag with name "${data.name}" already exists`)
		}

		return this.prisma.tag.create({
			data: {
				name: data.name.trim(),
				description: data.description?.trim() || null,
				color: data.color || null,
				category: data.category?.trim() || null,
			},
		})
	}

	/**
	 * Update a tag
	 */
	async updateTag(
		id: number,
		data: {
			name?: string
			description?: string | null
			color?: string | null
			category?: string | null
		}
	): Promise<any> {
		const tag = await this.prisma.tag.findUnique({
			where: { id },
		})

		if (!tag) {
			throw new Error(`Tag with ID ${id} not found`)
		}

		const updateData: any = {}

		if (data.name !== undefined) {
			if (!data.name || data.name.trim().length === 0) {
				throw new Error('Tag name cannot be empty')
			}
			// Check if new name conflicts with existing tag
			const existing = await this.prisma.tag.findUnique({
				where: { name: data.name.trim() },
			})
			if (existing && existing.id !== id) {
				throw new Error(`Tag with name "${data.name}" already exists`)
			}
			updateData.name = data.name.trim()
		}

		if (data.description !== undefined) {
			updateData.description = data.description?.trim() || null
		}

		if (data.color !== undefined) {
			updateData.color = data.color || null
		}

		if (data.category !== undefined) {
			updateData.category = data.category?.trim() || null
		}

		return this.prisma.tag.update({
			where: { id },
			data: updateData,
		})
	}

	/**
	 * Delete a tag
	 */
	async deleteTag(id: number): Promise<void> {
		const tag = await this.prisma.tag.findUnique({
			where: { id },
			include: {
				_count: {
					select: {
						tag_associations: true,
					},
				},
			},
		})

		if (!tag) {
			throw new Error(`Tag with ID ${id} not found`)
		}

		// Check if tag has associations
		if (tag._count.tag_associations > 0) {
			throw new Error(
				`Cannot delete tag "${tag.name}" because it has ${tag._count.tag_associations} associations. Remove associations first.`
			)
		}

		await this.prisma.tag.delete({
			where: { id },
		})
	}

	/**
	 * Associate a tag with an entity
	 */
	async associateTag(
		entityType: string,
		entityId: number,
		tagId: number,
		inherited: boolean = false
	): Promise<any> {
		// Verify tag exists
		const tag = await this.prisma.tag.findUnique({
			where: { id: tagId },
		})

		if (!tag) {
			throw new Error(`Tag with ID ${tagId} not found`)
		}

		// Check if association already exists
		const existing = await this.prisma.tagAssociation.findUnique({
			where: {
				unique_tag_association: {
					tag_id: tagId,
					entity_type: entityType,
					entity_id: entityId,
				},
			},
		})

		if (existing) {
			// Update if it exists
			return this.prisma.tagAssociation.update({
				where: {
					unique_tag_association: {
						tag_id: tagId,
						entity_type: entityType,
						entity_id: entityId,
					},
				},
				data: {
					inherited,
				},
			})
		}

		// Create new association
		return this.prisma.tagAssociation.create({
			data: {
				tag_id: tagId,
				entity_type: entityType,
				entity_id: entityId,
				inherited,
			},
			include: {
				tag: true,
			},
		})
	}

	/**
	 * Remove a tag association
	 */
	async removeTagAssociation(
		entityType: string,
		entityId: number,
		tagId: number
	): Promise<void> {
		await this.prisma.tagAssociation.deleteMany({
			where: {
				tag_id: tagId,
				entity_type: entityType,
				entity_id: entityId,
			},
		})
	}

	/**
	 * Get all tags for an entity
	 */
	async getEntityTags(entityType: string, entityId: number): Promise<any[]> {
		const associations = await this.prisma.tagAssociation.findMany({
			where: {
				entity_type: entityType,
				entity_id: entityId,
			},
			include: {
				tag: true,
			},
			orderBy: {
				tag: {
					name: 'asc',
				},
			},
		})

		return associations.map(assoc => ({
			...assoc.tag,
			inherited: assoc.inherited,
			association_id: assoc.id,
		}))
	}

	/**
	 * Inherit tags from a parent entity to a child entity
	 * For example, inherit tags from Notification to UserNotification
	 */
	async inheritTags(
		parentEntityType: string,
		parentEntityId: number,
		childEntityType: string,
		childEntityId: number
	): Promise<any[]> {
		// Get all tags from parent (non-inherited only, to avoid double inheritance)
		const parentTags = await this.prisma.tagAssociation.findMany({
			where: {
				entity_type: parentEntityType,
				entity_id: parentEntityId,
				inherited: false, // Only inherit direct tags, not already inherited ones
			},
			include: {
				tag: true,
			},
		})

		// Associate each tag with the child entity as inherited
		const inheritedTags = []
		for (const parentTag of parentTags) {
			try {
				const association = await this.associateTag(
					childEntityType,
					childEntityId,
					parentTag.tag_id,
					true // Mark as inherited
				)
				inheritedTags.push(association.tag)
			} catch (error: any) {
				// If association already exists, that's fine
				if (!error.message?.includes('already exists')) {
					console.error(
						`Failed to inherit tag ${parentTag.tag.name} to ${childEntityType}:${childEntityId}`,
						error
					)
				}
			}
		}

		return inheritedTags
	}

	/**
	 * Get or create a tag by name
	 */
	async getOrCreateTag(name: string): Promise<any> {
		let tag = await this.getTagByName(name)

		if (!tag) {
			tag = await this.createTag({ name })
		}

		return tag
	}

	/**
	 * Get tag associations for an entity (for admin/debugging)
	 */
	async getTagAssociations(
		entityType: string,
		entityId: number
	): Promise<any[]> {
		return this.prisma.tagAssociation.findMany({
			where: {
				entity_type: entityType,
				entity_id: entityId,
			},
			include: {
				tag: true,
			},
			orderBy: {
				created_at: 'desc',
			},
		})
	}

	/**
	 * Get all entities using a specific tag
	 */
	async getTagUsage(tagId: number): Promise<any> {
		const tag = await this.prisma.tag.findUnique({
			where: { id: tagId },
			include: {
				tag_associations: {
					include: {
						tag: true,
					},
					orderBy: {
						created_at: 'desc',
					},
				},
			},
		})

		if (!tag) {
			throw new Error(`Tag with ID ${tagId} not found`)
		}

		// Group by entity type
		const usageByType: Record<string, number> = {}
		tag.tag_associations.forEach(assoc => {
			usageByType[assoc.entity_type] =
				(usageByType[assoc.entity_type] || 0) + 1
		})

		return {
			tag,
			totalAssociations: tag.tag_associations.length,
			usageByType,
		}
	}
}
