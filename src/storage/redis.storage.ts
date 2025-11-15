import { IStorage } from '../interfaces/storage.interface';

/**
 * Redis Client Interface
 * 
 * Defines the minimum interface required for Redis operations.
 * Compatible with the official 'redis' client (v4+).
 */
export interface IRedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { EX?: number }): Promise<string | null>;
  incrBy(key: string, amount: number): Promise<number>;
  del(key: string | string[]): Promise<number>;
  exists(key: string | string[]): Promise<number>;
  expire(key: string, seconds: number): Promise<boolean>;
}

/**
 * Redis Storage Implementation
 * 
 * Redis-based storage for distributed systems.
 * Works with any Redis client that implements the IRedisClient interface.
 */
export class RedisStorage implements IStorage {
  constructor(private readonly client: IRedisClient) {
    if (!client) {
      throw new Error('Redis client is required');
    }
  }

  async get(key: string): Promise<string | null> {
    return await this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds !== undefined && ttlSeconds > 0) {
      await this.client.set(key, value, { EX: ttlSeconds });
    } else {
      await this.client.set(key, value);
    }
  }

  async increment(key: string, amount: number = 1): Promise<number> {
    return await this.client.incrBy(key, amount);
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    await this.client.expire(key, ttlSeconds);
  }
}
