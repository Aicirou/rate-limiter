import { IRateLimitStrategy, RateLimitResult, RateLimitConfig } from '../interfaces/strategy.interface';
import { IStorage } from '../interfaces/storage.interface';

/**
 * Fixed Window Strategy
 * 
 * Implements fixed window rate limiting algorithm.
 * 
 * Algorithm:
 * - Divides time into fixed windows (e.g., 0-60s, 60-120s)
 * - Each window has its own counter
 * - When a request comes in, increment the counter for the current window
 * - If counter exceeds limit, reject the request
 * - Counter resets when the window expires
 */
export class FixedWindowStrategy implements IRateLimitStrategy {
  getKeyPrefix(): string {
    return 'fw'; // Fixed Window prefix
  }

  /**
   * Generate a storage key for the current window
   */
  private getWindowKey(identifier: string, config: RateLimitConfig): string {
    const windowStart = Math.floor(Date.now() / 1000 / config.windowSeconds) * config.windowSeconds;
    return `${this.getKeyPrefix()}:${identifier}:${windowStart}`;
  }

  /**
   * Calculate the reset time (end of current window)
   */
  private getResetTime(config: RateLimitConfig): number {
    const windowStart = Math.floor(Date.now() / 1000 / config.windowSeconds) * config.windowSeconds;
    return windowStart + config.windowSeconds;
  }

  async checkLimit(
    identifier: string,
    config: RateLimitConfig,
    storage: IStorage
  ): Promise<RateLimitResult> {
    const key = this.getWindowKey(identifier, config);
    const resetTime = this.getResetTime(config);
    const now = Math.floor(Date.now() / 1000);
    const retryAfter = resetTime - now;

    // Check if key exists
    const exists = await storage.exists(key);
    
    if (!exists) {
      // First request in this window - initialize counter to 1
      await storage.set(key, '1', config.windowSeconds);
      return {
        allowed: true,
        remaining: config.limit - 1,
        limit: config.limit,
        resetTime,
        retryAfter: retryAfter > 0 ? retryAfter : undefined
      };
    }

    // Increment the counter
    const count = await storage.increment(key);
    
    // Check if limit is exceeded
    const allowed = count <= config.limit;
    const remaining = Math.max(0, config.limit - count);

    return {
      allowed,
      remaining,
      limit: config.limit,
      resetTime,
      retryAfter: allowed ? (retryAfter > 0 ? retryAfter : undefined) : retryAfter
    };
  }
}

