import { randomUUID } from 'crypto'
import { createHash } from 'crypto'
import { prisma } from '../db/prisma'
// Note: These types will be available after running `npx prisma generate`
// Using Prisma namespace types which are always available
type ApiKey = any // Will be Prisma.ApiKeyGetPayload<{}> after prisma generate
type ApiKeyPermission = any // Will be Prisma.ApiKeyPermissionGetPayload<{}> after prisma generate

/**
 * Generate a new API key (UUID format)
 */
export function generateApiKey(): string {
	return randomUUID()
}

/**
 * Hash an API key for secure storage
 */
export function hashApiKey(key: string): string {
	return createHash('sha256').update(key).digest('hex')
}

/**
 * Get the prefix of an API key (first 8 characters) for display
 */
export function getKeyPrefix(key: string): string {
	return key.substring(0, 8)
}

/**
 * Verify an API key and return the API key record
 */
export async function verifyApiKey(key: string): Promise<ApiKey | null> {
	const keyHash = hashApiKey(key)

	const apiKey = await (prisma as any).apiKey.findUnique({
		where: { key_hash: keyHash },
		include: {
			permissions: true,
		},
	})

	if (!apiKey) {
		return null
	}

	// Check if key is revoked
	if (apiKey.revoked_at) {
		return null
	}

	// Update last_used_at timestamp
	await (prisma as any).apiKey.update({
		where: { id: apiKey.id },
		data: { last_used_at: new Date() },
	})

	return apiKey
}

/**
 * Get all permissions for an API key
 */
export async function getApiKeyPermissions(
	apiKeyId: number
): Promise<ApiKeyPermission[]> {
	return await (prisma as any).apiKeyPermission.findMany({
		where: { api_key_id: apiKeyId },
	})
}

/**
 * Create a new API key with permissions
 */
export async function createApiKey(
	userId: string,
	description: string | null,
	permissions: Array<{
		resource_type: string
		allowed_endpoints?: string[] | null
		allowed_fields?: Record<string, string[]> | null
	}>
): Promise<{ apiKey: ApiKey; plainKey: string }> {
	const plainKey = generateApiKey()
	const keyHash = hashApiKey(plainKey)
	const keyPrefix = getKeyPrefix(plainKey)

	const apiKey = await (prisma as any).apiKey.create({
		data: {
			key_hash: keyHash,
			key_prefix: keyPrefix,
			user_id: userId,
			description,
			permissions: {
				create: permissions.map(perm => ({
					resource_type: perm.resource_type,
					allowed_endpoints: perm.allowed_endpoints || null,
					allowed_fields: perm.allowed_fields || null,
				})),
			},
		},
		include: {
			permissions: true,
		},
	})

	return { apiKey, plainKey }
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(apiKeyId: number): Promise<void> {
	await (prisma as any).apiKey.update({
		where: { id: apiKeyId },
		data: { revoked_at: new Date() },
	})
}

/**
 * Delete an API key (only if it was never used)
 * Allows deletion of revoked keys as long as they haven't been used
 */
export async function deleteApiKey(apiKeyId: number): Promise<void> {
	// Check if key exists and was never used
	const apiKey = await (prisma as any).apiKey.findUnique({
		where: { id: apiKeyId },
	})

	if (!apiKey) {
		throw new Error('API key not found')
	}

	if (apiKey.last_used_at) {
		throw new Error('Cannot delete API key that has been used')
	}

	// Delete the API key (cascade will delete permissions)
	// Note: Admin check is handled by the route middleware
	await (prisma as any).apiKey.delete({
		where: { id: apiKeyId },
	})
}

/**
 * Update API key description and permissions
 */
export async function updateApiKey(
	apiKeyId: number,
	description: string | null,
	permissions: Array<{
		resource_type: string
		allowed_endpoints?: string[] | null
		allowed_fields?: Record<string, string[]> | null
	}>
): Promise<ApiKey> {
	// Delete existing permissions
	await (prisma as any).apiKeyPermission.deleteMany({
		where: { api_key_id: apiKeyId },
	})

	// Update API key and create new permissions
	const apiKey = await (prisma as any).apiKey.update({
		where: { id: apiKeyId },
		data: {
			description,
			permissions: {
				create: permissions.map(perm => ({
					resource_type: perm.resource_type,
					allowed_endpoints: perm.allowed_endpoints || null,
					allowed_fields: perm.allowed_fields || null,
				})),
			},
		},
		include: {
			permissions: true,
		},
	})

	return apiKey
}
