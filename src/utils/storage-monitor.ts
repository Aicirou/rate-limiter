import { IStorage } from '../interfaces/storage.interface';

/**
 * Storage Monitor Utility
 * 
 * Provides real-time monitoring of storage operations
 */
export class StorageMonitor implements IStorage {
  constructor(
    private readonly storage: IStorage,
    private readonly label: string = 'Storage'
  ) {}

  private log(operation: string, key: string, value?: any) {
    const timestamp = new Date().toISOString();
    console.log(`[${this.label}] ${timestamp} | ${operation} | key: "${key}"${value !== undefined ? ` | value: ${JSON.stringify(value)}` : ''}`);
  }

  async get(key: string): Promise<string | null> {
    const result = await this.storage.get(key);
    this.log('GET', key, result);
    return result;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    await this.storage.set(key, value, ttlSeconds);
    this.log('SET', key, { value, ttl: ttlSeconds });
  }

  async increment(key: string, amount?: number): Promise<number> {
    const result = await this.storage.increment(key, amount);
    this.log('INCREMENT', key, { amount, newValue: result });
    return result;
  }

  async delete(key: string): Promise<void> {
    await this.storage.delete(key);
    this.log('DELETE', key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.storage.exists(key);
    this.log('EXISTS', key, result);
    return result;
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    await this.storage.expire(key, ttlSeconds);
    this.log('EXPIRE', key, { ttl: ttlSeconds });
  }
}
