import Redis from 'ioredis';

/**
 * Check if Redis is available
 */
export async function checkRedisAvailability(redisUrl: string, maxRetries: number = 5, retryDelay: number = 2000): Promise<boolean> {
  let redis: Redis | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      redis = new Redis(redisUrl, {
        maxRetriesPerRequest: null,
        retryStrategy: () => null, // Don't retry on connection failure
        lazyConnect: true,
        connectTimeout: 2000,
      });

      // Try to connect
      await redis.connect();

      // Test with a simple command
      await redis.ping();

      // Success! Close the test connection
      await redis.quit();
      return true;
    } catch (error: any) {
      if (redis) {
        try {
          await redis.quit();
        } catch (e) {
          // Ignore quit errors
        }
      }

      if (attempt < maxRetries) {
        console.log(`Redis not available (attempt ${attempt}/${maxRetries}), retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      } else {
        console.warn(`Redis not available after ${maxRetries} attempts: ${error.message}`);
        return false;
      }
    }
  }

  return false;
}

/**
 * Create a Redis connection with proper BullMQ configuration
 */
export function createRedisConnection(redisUrl: string): Redis {
  return new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    retryStrategy: (times) => {
      // Retry with exponential backoff, but give up after 5 attempts
      if (times > 5) {
        console.warn('Redis connection failed after 5 attempts.');
        return null; // Stop retrying
      }
      return Math.min(times * 200, 2000);
    },
    lazyConnect: true, // Don't connect immediately
  });
}

