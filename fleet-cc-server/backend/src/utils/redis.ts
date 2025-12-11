import Redis from 'ioredis'

/**
 * Get Redis URL based on environment
 */
export function getRedisUrl(): string {
	// Check if REDIS_URL is explicitly set
	if (process.env.REDIS_URL) {
		return process.env.REDIS_URL
	}

	// In Docker, use the service name
	if (process.env.DOCKER_ENV === 'true') {
		return 'redis://redis:6379'
	}

	// Local development
	return 'redis://localhost:6379'
}

/**
 * Check if Redis is available
 */
export async function checkRedisAvailability(
	redisUrl: string,
	maxRetries: number = 5,
	retryDelay: number = 2000
): Promise<boolean> {
	let redis: Redis | null = null

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			redis = new Redis(redisUrl, {
				maxRetriesPerRequest: null,
				retryStrategy: () => null, // Don't retry on connection failure
				lazyConnect: true,
				connectTimeout: 2000,
				reconnectOnError: () => false,
			})

			// Try to connect
			await redis.connect()

			// Test with a simple command
			await redis.ping()

			// Success! Close the test connection
			await redis.quit()
			return true
		} catch (error: any) {
			if (redis) {
				try {
					await redis.quit()
				} catch (e) {
					// Ignore quit errors
				}
			}

			if (attempt < maxRetries) {
				// Only log on first attempt to reduce noise
				if (attempt === 1) {
					console.log(
						`Redis not available (attempt ${attempt}/${maxRetries}), retrying in ${retryDelay}ms...`
					)
				}
				await new Promise(resolve => setTimeout(resolve, retryDelay))
			} else {
				console.warn(
					`Redis not available after ${maxRetries} attempts: ${error.message}`
				)
				return false
			}
		}
	}

	return false
}

/**
 * Create a Redis connection with proper BullMQ configuration
 */
export function createRedisConnection(redisUrl: string): Redis {
	const redis = new Redis(redisUrl, {
		maxRetriesPerRequest: null,
		retryStrategy: () => null, // Disable automatic retries
		lazyConnect: true, // Don't connect immediately
		reconnectOnError: () => false,
	})

	// Suppress unhandled error events to reduce log noise
	// Only log non-connection errors
	redis.on('error', error => {
		// Suppress ECONNREFUSED errors as they're expected when Redis is unavailable
		if (
			error.message &&
			!error.message.includes('ECONNREFUSED') &&
			!error.message.includes('Connection is closed')
		) {
			console.error('Redis error:', error.message)
		}
	})

	return redis
}
