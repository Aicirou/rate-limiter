import { IRateLimitStrategy, RateLimitResult, RateLimitConfig } from '../interfaces/strategy.interface';
import { IStorage } from '../interfaces/storage.interface';

/**
 * Token Bucket Data Structure
 */
interface TokenBucketData {
  tokens: number;
  lastRefill: number; // Unix timestamp in seconds
}

/**
 * Token Bucket Strategy
 * 
 * Implements token bucket rate limiting algorithm.
 * 
 * Algorithm:
 * - Maintains a bucket with tokens (up to the limit)
 * - Tokens are refilled at a constant rate (limit tokens per windowSeconds)
 * - Each request consumes one token
 * - If tokens are available, allow the request; otherwise, reject
 * - More smooth rate limiting compared to fixed window
 */
export class TokenBucketStrategy implements IRateLimitStrategy {
  getKeyPrefix(): string {
    return 'tb'; // Token Bucket prefix
  }

  /**
   * Generate storage key for the token bucket
   */
  private getBucketKey(identifier: string, config: RateLimitConfig): string {
    const configId = config.identifier || 'default';
    return `${this.getKeyPrefix()}:${identifier}:${configId}`;
  }

  /**
   * Calculate how many tokens should be added based on time elapsed
   */
  private calculateTokensToAdd(
    lastRefill: number,
    currentTime: number,
    refillRate: number,
    maxTokens: number
  ): number {
    const timeElapsed = currentTime - lastRefill;
    const tokensToAdd = Math.floor(timeElapsed * refillRate);
    return Math.min(tokensToAdd, maxTokens);
  }

  /**
   * Refill the bucket and return current token count
   */
  private async refillBucket(
    key: string,
    config: RateLimitConfig,
    storage: IStorage
  ): Promise<TokenBucketData> {
    const now = Math.floor(Date.now() / 1000);
    const refillRate = config.limit / config.windowSeconds; // tokens per second
    
    const existing = await storage.get(key);
    
    if (!existing) {
      // Initialize bucket with full tokens
      const bucketData: TokenBucketData = {
        tokens: config.limit,
        lastRefill: now
      };
      await storage.set(key, JSON.stringify(bucketData), config.windowSeconds * 2);
      return bucketData;
    }

    const bucket: TokenBucketData = JSON.parse(existing);
    const tokensToAdd = this.calculateTokensToAdd(
      bucket.lastRefill,
      now,
      refillRate,
      config.limit
    );

    // Refill tokens (capped at limit)
    bucket.tokens = Math.min(config.limit, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;

    // Update storage
    await storage.set(key, JSON.stringify(bucket), config.windowSeconds * 2);
    
    return bucket;
  }

  /**
   * Calculate reset time (when bucket will be full again)
   */
  private calculateResetTime(
    tokens: number,
    limit: number,
    refillRate: number
  ): number {
    if (tokens >= limit) {
      return Math.floor(Date.now() / 1000) + 1;
    }
    const tokensNeeded = limit - tokens;
    const secondsUntilFull = Math.ceil(tokensNeeded / refillRate);
    return Math.floor(Date.now() / 1000) + secondsUntilFull;
  }

  async checkLimit(
    identifier: string,
    config: RateLimitConfig,
    storage: IStorage
  ): Promise<RateLimitResult> {
    const key = this.getBucketKey(identifier, config);
    const refillRate = config.limit / config.windowSeconds;

    // Refill the bucket
    const bucket = await this.refillBucket(key, config, storage);

    // Check if we have tokens
    const hasTokens = bucket.tokens >= 1;
    const allowed = hasTokens;

    if (allowed) {
      // Consume one token
      bucket.tokens -= 1;
      await storage.set(key, JSON.stringify(bucket), config.windowSeconds * 2);
    }

    const resetTime = this.calculateResetTime(bucket.tokens, config.limit, refillRate);
    const now = Math.floor(Date.now() / 1000);
    const retryAfter = resetTime - now;

    return {
      allowed,
      remaining: Math.max(0, Math.floor(bucket.tokens)),
      limit: config.limit,
      resetTime,
      retryAfter: allowed ? (retryAfter > 0 ? retryAfter : undefined) : retryAfter
    };
  }
}

