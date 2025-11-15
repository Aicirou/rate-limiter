import { IStorage } from './storage.interface';

/**
 * Rate Limiting Strategy Interface
 * 
 * Abstracts the rate limiting algorithm logic, allowing different
 * strategies (Fixed Window, Token Bucket, etc.) to be implemented
 * independently of storage mechanisms.
 */

export interface RateLimitResult {
  /**
   * Whether the request is allowed
   */
  allowed: boolean;

  /**
   * Current count/tokens remaining
   */
  remaining: number;

  /**
   * Total limit for this window/bucket
   */
  limit: number;

  /**
   * Time when the limit resets (Unix timestamp in seconds)
   */
  resetTime: number;

  /**
   * Time until reset (in seconds)
   */
  retryAfter?: number;
}

export interface RateLimitConfig {
  /**
   * Maximum number of requests allowed
   */
  limit: number;

  /**
   * Time window in seconds (for window-based strategies)
   * or refill interval (for token bucket strategies)
   */
  windowSeconds: number;

  /**
   * Optional: Custom identifier for this rate limit rule
   */
  identifier?: string;
}

/**
 * Strategy Interface
 * 
 * Defines the contract for rate limiting algorithms.
 * Each strategy implements its own logic for determining
 * whether a request should be allowed.
 */
export interface IRateLimitStrategy {
  /**
   * Check if a request should be allowed based on the strategy's algorithm
   * @param identifier - Unique identifier for the rate limit (e.g., user ID, IP address)
   * @param config - Rate limit configuration
   * @param storage - Storage interface for persistence
   * @returns Promise resolving to the rate limit result
   */
  checkLimit(
    identifier: string,
    config: RateLimitConfig,
    storage: IStorage
  ): Promise<RateLimitResult>;

  /**
   * Get the storage key prefix for this strategy
   * Different strategies may use different key structures
   */
  getKeyPrefix(): string;
}

