import { createClient } from 'redis';
import { RedisStorage } from '../storage/redis.storage';
import { RateLimiter } from '../rate-limiter';
import { FixedWindowStrategy } from '../strategies/fixed-window.strategy';
import { TokenBucketStrategy } from '../strategies/token-bucket.strategy';

async function main() {
  // Create Redis client
  const redisClient = createClient({
    socket: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    },
  });

  // Handle connection errors
  redisClient.on('error', (err) => console.error('Redis Client Error', err));

  // Connect to Redis
  await redisClient.connect();
  console.log('✅ Connected to Redis');

  // Create Redis storage
  const redisStorage = new RedisStorage(redisClient);

  // Example 1: Fixed Window Strategy with Redis
  console.log('\n--- Example 1: Fixed Window Strategy ---');
  const fixedWindowStrategy = new FixedWindowStrategy();
  const fixedWindowLimiter = new RateLimiter(redisStorage, fixedWindowStrategy);

  const userId = 'user-123';
  const fixedWindowConfig = {
    limit: 5,
    windowSeconds: 60,
  };

  for (let i = 1; i <= 7; i++) {
    const result = await fixedWindowLimiter.check(userId, fixedWindowConfig);
    console.log(`Request ${i}:`, {
      allowed: result.allowed,
      remaining: result.remaining,
      retryAfter: result.retryAfter,
    });
  }

  // Example 2: Token Bucket Strategy with Redis
  console.log('\n--- Example 2: Token Bucket Strategy ---');
  const tokenBucketStrategy = new TokenBucketStrategy();
  const tokenBucketLimiter = new RateLimiter(redisStorage, tokenBucketStrategy);

  const apiKey = 'api-key-456';
  const tokenBucketConfig = {
    limit: 10,
    windowSeconds: 30, // tokens per second
  };

  for (let i = 1; i <= 5; i++) {
    const result = await tokenBucketLimiter.check(apiKey, tokenBucketConfig);
    console.log(`API Call ${i}:`, {
      allowed: result.allowed,
      remaining: result.remaining,
      retryAfter: result.retryAfter,
    });
    // Wait 500ms between calls
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Clean up
  console.log('\n🧹 Cleaning up...');
  await redisClient.quit();
  console.log('✅ Disconnected from Redis');
}

main().catch(console.error);
