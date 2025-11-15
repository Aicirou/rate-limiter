/**
 * Usage Examples
 * 
 * This file demonstrates how the decoupled architecture works.
 * Note: These are examples showing the structure - implementations are not yet complete.
 */

import { RateLimiter } from '../rate-limiter';
import { MemoryStorage } from '../storage/memory.storage';
import { RedisStorage, IRedisClient } from '../storage/redis.storage';
import { FixedWindowStrategy } from '../strategies/fixed-window.strategy';
import { TokenBucketStrategy } from '../strategies/token-bucket.strategy';
import { RateLimitConfig } from '../interfaces/strategy.interface';

/**
 * Example 1: Local Development Setup
 * 
 * Uses in-memory storage with Fixed Window strategy
 * Perfect for local Node.js development
 */
export function createLocalRateLimiter(): RateLimiter {
  const storage = new MemoryStorage();
  const strategy = new FixedWindowStrategy();
  return new RateLimiter(storage, strategy);
}

/**
 * Example 2: Distributed System Setup
 * 
 * Uses Redis storage with Token Bucket strategy
 * Perfect for distributed systems with multiple instances
 */
export function createDistributedRateLimiter(redisClient: IRedisClient): RateLimiter {
  // Note: In a real scenario, you would pass a Redis client here
  // Example: const redis = createClient(); createDistributedRateLimiter(redis);
  const storage = new RedisStorage(redisClient);
  const strategy = new TokenBucketStrategy();
  return new RateLimiter(storage, strategy);
}

/**
 * Example 3: Mixed Configuration
 * 
 * Demonstrates flexibility - any storage can work with any strategy
 */
export function createMixedRateLimiter(): RateLimiter {
  // Memory storage with Token Bucket (for testing)
  const storage = new MemoryStorage();
  const strategy = new TokenBucketStrategy();
  return new RateLimiter(storage, strategy);
}

export function createAnotherMixedRateLimiter(redisClient: IRedisClient): RateLimiter {
  // Redis storage with Fixed Window (for production)
  const storage = new RedisStorage(redisClient);
  const strategy = new FixedWindowStrategy();
  return new RateLimiter(storage, strategy);
}

/**
 * Example Usage - Working Implementation
 * 
 * Demonstrates the rate limiter in action with various scenarios
 */
export async function exampleUsage() {
  console.log('=== Rate Limiter Example ===\n');

  // Create a rate limiter with in-memory storage and fixed window strategy
  const rateLimiter = createLocalRateLimiter();
  
  const config: RateLimitConfig = {
    limit: 5, // Allow 5 requests
    windowSeconds: 10 // Per 10 seconds
  };

  const userId = 'user-123';

  console.log('1. Making requests within limit:');
  for (let i = 1; i <= 3; i++) {
    const result = await rateLimiter.check(userId, config);
    console.log(`   Request ${i}: ${result.allowed ? '✓ Allowed' : '✗ Denied'} - ${result.remaining} remaining`);
  }

  console.log('\n2. Peeking at current status (without consuming):');
  const peekResult = await rateLimiter.peek(userId, config);
  console.log(`   Status: ${peekResult.remaining} requests remaining, limit: ${peekResult.limit}`);

  console.log('\n3. Exceeding the limit:');
  for (let i = 4; i <= 7; i++) {
    const result = await rateLimiter.check(userId, config);
    if (result.allowed) {
      console.log(`   Request ${i}: ✓ Allowed - ${result.remaining} remaining`);
    } else {
      console.log(`   Request ${i}: ✗ Denied - Rate limit exceeded. Retry after ${result.retryAfter} seconds`);
    }
  }

  console.log('\n4. Resetting the rate limit:');
  await rateLimiter.reset(userId, config);
  console.log('   Rate limit reset!');

  console.log('\n5. Making requests after reset:');
  const resultAfterReset = await rateLimiter.check(userId, config);
  console.log(`   Request after reset: ${resultAfterReset.allowed ? '✓ Allowed' : '✗ Denied'} - ${resultAfterReset.remaining} remaining`);

  console.log('\n=== Token Bucket Strategy Example ===\n');

  // Create a rate limiter with token bucket strategy
  const tokenBucketLimiter = createMixedRateLimiter();
  const tokenBucketConfig: RateLimitConfig = {
    limit: 10, // 10 tokens
    windowSeconds: 5 // Refill over 5 seconds (2 tokens per second)
  };

  console.log('1. Token Bucket - Making rapid requests:');
  for (let i = 1; i <= 12; i++) {
    const result = await tokenBucketLimiter.check('user-456', tokenBucketConfig);
    if (result.allowed) {
      console.log(`   Request ${i}: ✓ Allowed - ${result.remaining} tokens remaining`);
    } else {
      console.log(`   Request ${i}: ✗ Denied - No tokens available. Retry after ${result.retryAfter} seconds`);
      // Wait a bit to let tokens refill
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log('\n2. Token Bucket - Waiting for refill:');
  console.log('   Waiting 2 seconds for tokens to refill...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const refillResult = await tokenBucketLimiter.check('user-456', tokenBucketConfig);
  console.log(`   After refill: ${refillResult.allowed ? '✓ Allowed' : '✗ Denied'} - ${refillResult.remaining} tokens remaining`);

  console.log('\n=== Example Complete ===');
}

// Run the example if this file is executed directly
if (require.main === module) {
  exampleUsage().then(() => process.exit(0)).catch(console.error);
}
