import { IStorage } from '../interfaces/storage.interface';

interface StorageEntry {
  value: string;
  expiresAt?: number; // Unix timestamp in milliseconds
}

/**
 * Memory Storage Implementation
 * 
 * In-memory storage for local Node.js environments.
 * Uses a Map to store key-value pairs with optional TTL support.
 */
export class MemoryStorage implements IStorage {
  private storage: Map<string, StorageEntry> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Clean up expired entries
   */
  private cleanupExpired(key: string): void {
    const entry = this.storage.get(key);
    if (entry && entry.expiresAt && Date.now() > entry.expiresAt) {
      this.storage.delete(key);
      const timer = this.timers.get(key);
      if (timer) {
        clearTimeout(timer);
        this.timers.delete(key);
      }
    }
  }

  async get(key: string): Promise<string | null> {
    this.cleanupExpired(key);
    const entry = this.storage.get(key);
    return entry ? entry.value : null;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const entry: StorageEntry = { value };
    
    if (ttlSeconds !== undefined && ttlSeconds > 0) {
      entry.expiresAt = Date.now() + ttlSeconds * 1000;
      
      // Clear existing timer if any
      const existingTimer = this.timers.get(key);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }
      
      // Set new timer
      const timer = setTimeout(() => {
        this.storage.delete(key);
        this.timers.delete(key);
      }, ttlSeconds * 1000);
      
      this.timers.set(key, timer);
    }
    
    this.storage.set(key, entry);
  }

  async increment(key: string, amount: number = 1): Promise<number> {
    this.cleanupExpired(key);
    
    const current = await this.get(key);
    const currentValue = current ? parseInt(current, 10) : 0;
    
    if (isNaN(currentValue)) {
      throw new Error(`Cannot increment non-numeric value for key: ${key}`);
    }
    
    const newValue = currentValue + amount;
    const entry = this.storage.get(key);
    
    // Preserve TTL if it exists
    if (entry && entry.expiresAt) {
      await this.set(key, newValue.toString(), (entry.expiresAt - Date.now()) / 1000);
    } else {
      await this.set(key, newValue.toString());
    }
    
    return newValue;
  }

  async delete(key: string): Promise<void> {
    this.storage.delete(key);
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
  }

  async exists(key: string): Promise<boolean> {
    this.cleanupExpired(key);
    return this.storage.has(key);
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    const entry = this.storage.get(key);
    if (!entry) {
      throw new Error(`Key not found: ${key}`);
    }
    
    // Clear existing timer
    const existingTimer = this.timers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    // Set new expiration
    entry.expiresAt = Date.now() + ttlSeconds * 1000;
    this.storage.set(key, entry);
    
    // Set new timer
    const timer = setTimeout(() => {
      this.storage.delete(key);
      this.timers.delete(key);
    }, ttlSeconds * 1000);
    
    this.timers.set(key, timer);
  }
}

