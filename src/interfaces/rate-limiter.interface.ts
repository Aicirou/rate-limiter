import { IRateLimitStrategy, RateLimitResult, RateLimitConfig } from './strategy.interface';

/**
 * Rate Limiter Interface
 * 
 * Main interface for the rate limiter library.
 * Provides a clean API for rate limiting operations.
 */
export interface IRateLimiter {
  /**
   * Check if a request should be allowed
   * @param identifier - Unique identifier for the rate limit (e.g., user ID, IP address)
   * @param config - Rate limit configuration
   * @returns Promise resolving to the rate limit result
   */
  check(identifier: string, config: RateLimitConfig): Promise<RateLimitResult>;

  /**
   * Reset the rate limit for a given identifier
   * @param identifier - Unique identifier for the rate limit
   * @param config - Rate limit configuration (to determine which keys to reset)
   * @returns Promise resolving when reset is complete
   */
  reset(identifier: string, config: RateLimitConfig): Promise<void>;

  /**
   * Get current rate limit status without consuming a request
   * @param identifier - Unique identifier for the rate limit
   * @param config - Rate limit configuration
   * @returns Promise resolving to the current rate limit status
   */
  peek(identifier: string, config: RateLimitConfig): Promise<RateLimitResult>;
}

