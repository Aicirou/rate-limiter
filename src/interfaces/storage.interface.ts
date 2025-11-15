/**
 * Storage Interface
 * 
 * Abstracts storage operations to allow different implementations
 * (in-memory, Redis, etc.) without coupling to specific storage backends.
 */
export interface IStorage {
  /**
   * Get a value from storage
   * @param key - The storage key
   * @returns Promise resolving to the value or null if not found
   */
  get(key: string): Promise<string | null>;

  /**
   * Set a value in storage with optional expiration
   * @param key - The storage key
   * @param value - The value to store
   * @param ttlSeconds - Optional time-to-live in seconds
   * @returns Promise resolving when the operation completes
   */
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;

  /**
   * Increment a numeric value in storage
   * @param key - The storage key
   * @param amount - Amount to increment by (default: 1)
   * @returns Promise resolving to the new value after increment
   */
  increment(key: string, amount?: number): Promise<number>;

  /**
   * Delete a key from storage
   * @param key - The storage key to delete
   * @returns Promise resolving when the operation completes
   */
  delete(key: string): Promise<void>;

  /**
   * Check if a key exists in storage
   * @param key - The storage key to check
   * @returns Promise resolving to true if key exists, false otherwise
   */
  exists(key: string): Promise<boolean>;

  /**
   * Set expiration on an existing key
   * @param key - The storage key
   * @param ttlSeconds - Time-to-live in seconds
   * @returns Promise resolving when the operation completes
   */
  expire(key: string, ttlSeconds: number): Promise<void>;
}

