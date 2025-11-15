import { IRateLimiter } from './interfaces/rate-limiter.interface';
import { IRateLimitStrategy, RateLimitConfig, RateLimitResult } from './interfaces/strategy.interface';
import { IStorage } from './interfaces/storage.interface';

/**
 * Rate Limiter Class
 * 
 * Main rate limiter implementation that decouples:
 * - Storage (Memory vs Redis) via IStorage interface
 * - Strategy (Fixed Window vs Token Bucket) via IRateLimitStrategy interface
 * 
 * This demonstrates dependency injection and interface-based design.
 */
export class RateLimiter implements IRateLimiter {
  constructor(
    private readonly storage: IStorage,
    private readonly strategy: IRateLimitStrategy
  ) {
    // Constructor injection ensures loose coupling
    // Any storage implementing IStorage can be used
    // Any strategy implementing IRateLimitStrategy can be used
  }

  async check(identifier: string, config: RateLimitConfig): Promise<RateLimitResult> {
    // Delegates to the strategy, which uses the storage
    return await this.strategy.checkLimit(identifier, config, this.storage);
  }

  async reset(identifier: string, config: RateLimitConfig): Promise<void> {
    // Generate the key pattern based on strategy
    const prefix = this.strategy.getKeyPrefix();
    const configId = config.identifier || 'default';
    
    // For FixedWindow: we need to delete current window key
    // For TokenBucket: we delete the bucket key
    // Since we don't know the exact key structure, we'll use a pattern
    // In a real implementation, you might want to store all keys or use a pattern
    
    // For now, we'll construct the most likely key patterns
    const now = Math.floor(Date.now() / 1000);
    
    // Try to delete current window key (for FixedWindow)
    const windowStart = Math.floor(now / config.windowSeconds) * config.windowSeconds;
    const fixedWindowKey = `${prefix}:${identifier}:${windowStart}`;
    await this.storage.delete(fixedWindowKey);
    
    // Try to delete token bucket key (for TokenBucket)
    const tokenBucketKey = `${prefix}:${identifier}:${configId}`;
    await this.storage.delete(tokenBucketKey);
    
    // Note: In a production system, you might want to track all keys
    // or use a more sophisticated key management system
  }

  async peek(identifier: string, config: RateLimitConfig): Promise<RateLimitResult> {
    // Peek without consuming - this is strategy-dependent
    // For FixedWindow: check current count without incrementing
    // For TokenBucket: check current tokens without consuming
    
    const prefix = this.strategy.getKeyPrefix();
    const now = Math.floor(Date.now() / 1000);
    
    // Try FixedWindow approach
    const windowStart = Math.floor(now / config.windowSeconds) * config.windowSeconds;
    const fixedWindowKey = `${prefix}:${identifier}:${windowStart}`;
    const fixedWindowValue = await this.storage.get(fixedWindowKey);
    
    if (fixedWindowValue !== null) {
      const count = parseInt(fixedWindowValue, 10);
      const resetTime = windowStart + config.windowSeconds;
      const retryAfter = resetTime - now;
      
      return {
        allowed: count < config.limit,
        remaining: Math.max(0, config.limit - count),
        limit: config.limit,
        resetTime,
        retryAfter: retryAfter > 0 ? retryAfter : undefined
      };
    }
    
    // Try TokenBucket approach
    const configId = config.identifier || 'default';
    const tokenBucketKey = `${prefix}:${identifier}:${configId}`;
    const tokenBucketValue = await this.storage.get(tokenBucketKey);
    
    if (tokenBucketValue !== null) {
      const bucket = JSON.parse(tokenBucketValue);
      const refillRate = config.limit / config.windowSeconds;
      
      // Refill without consuming
      const tokensToAdd = Math.min(
        config.limit,
        Math.floor((now - bucket.lastRefill) * refillRate)
      );
      const currentTokens = Math.min(config.limit, bucket.tokens + tokensToAdd);
      
      const tokensNeeded = config.limit - currentTokens;
      const secondsUntilFull = tokensNeeded > 0 ? Math.ceil(tokensNeeded / refillRate) : 0;
      const resetTime = now + secondsUntilFull;
      const retryAfter = resetTime - now;
      
      return {
        allowed: currentTokens >= 1,
        remaining: Math.max(0, Math.floor(currentTokens)),
        limit: config.limit,
        resetTime,
        retryAfter: retryAfter > 0 ? retryAfter : undefined
      };
    }
    
    // No existing data - bucket/window is empty
    const resetTime = now + config.windowSeconds;
    return {
      allowed: true,
      remaining: config.limit,
      limit: config.limit,
      resetTime,
      retryAfter: config.windowSeconds
    };
  }
}

