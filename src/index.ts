/**
 * Rate Limiter Library
 * 
 * Main entry point for the rate limiter library.
 * Exports all interfaces and implementations.
 */

// Interfaces
export { IStorage } from './interfaces/storage.interface';
export { IRateLimitStrategy, RateLimitResult, RateLimitConfig } from './interfaces/strategy.interface';
export { IRateLimiter } from './interfaces/rate-limiter.interface';

// Storage Implementations
export { MemoryStorage } from './storage/memory.storage';
export { RedisStorage, IRedisClient } from './storage/redis.storage';

// Strategy Implementations
export { FixedWindowStrategy } from './strategies/fixed-window.strategy';
export { TokenBucketStrategy } from './strategies/token-bucket.strategy';

// Main Rate Limiter
export { RateLimiter } from './rate-limiter';

