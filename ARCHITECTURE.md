# Architecture: Decoupling Strategy and Storage

## Overview

This rate limiter library demonstrates clean architecture through **interface-based decoupling**. The design separates concerns into three independent layers:

1. **Storage Layer** - Handles data persistence
2. **Strategy Layer** - Implements rate limiting algorithms
3. **Rate Limiter Layer** - Orchestrates storage and strategy

## Decoupling Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    RateLimiter (Orchestrator)                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Uses: IStorage (interface)                           │  │
│  │  Uses: IRateLimitStrategy (interface)                 │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┴───────────────────┐
        │                                       │
        ▼                                       ▼
┌───────────────────┐                ┌───────────────────┐
│   IStorage        │                │ IRateLimitStrategy│
│   (Interface)     │                │   (Interface)     │
└───────────────────┘                └───────────────────┘
        │                                       │
        │                                       │
   ┌────┴────┐                            ┌────┴────┐
   │         │                            │         │
   ▼         ▼                            ▼         ▼
┌──────┐  ┌──────┐                   ┌──────┐  ┌──────┐
│Memory│  │Redis │                   │Fixed │  │Token │
│Storage│ │Storage│                   │Window│  │Bucket│
└──────┘  └──────┘                   └──────┘  └──────┘
```

## Key Design Principles

### 1. Dependency Inversion Principle

**High-level modules (RateLimiter) depend on abstractions (interfaces), not concrete implementations.**

- `RateLimiter` depends on `IStorage` interface, not `MemoryStorage` or `RedisStorage`
- `RateLimiter` depends on `IRateLimitStrategy` interface, not `FixedWindowStrategy` or `TokenBucketStrategy`

### 2. Interface Segregation

**Each interface has a single, focused responsibility.**

- `IStorage`: Only storage operations (get, set, increment, etc.)
- `IRateLimitStrategy`: Only rate limiting algorithm logic
- `IRateLimiter`: Only rate limiting operations (check, reset, peek)

### 3. Open/Closed Principle

**Open for extension, closed for modification.**

- To add a new storage backend: Implement `IStorage` (e.g., `DynamoDBStorage`)
- To add a new strategy: Implement `IRateLimitStrategy` (e.g., `SlidingWindowStrategy`)
- No need to modify existing code

## How Decoupling Works

### Storage Decoupling

```typescript
// Both implement the same interface
class MemoryStorage implements IStorage { ... }
class RedisStorage implements IStorage { ... }

// RateLimiter doesn't care which one is used
const limiter1 = new RateLimiter(new MemoryStorage(), strategy);
const limiter2 = new RateLimiter(new RedisStorage(), strategy);
```

### Strategy Decoupling

```typescript
// Both implement the same interface
class FixedWindowStrategy implements IRateLimitStrategy { ... }
class TokenBucketStrategy implements IRateLimitStrategy { ... }

// RateLimiter doesn't care which one is used
const limiter1 = new RateLimiter(storage, new FixedWindowStrategy());
const limiter2 = new RateLimiter(storage, new TokenBucketStrategy());
```

### Complete Independence

```typescript
// Any combination works!
const combinations = [
  new RateLimiter(new MemoryStorage(), new FixedWindowStrategy()),
  new RateLimiter(new MemoryStorage(), new TokenBucketStrategy()),
  new RateLimiter(new RedisStorage(), new FixedWindowStrategy()),
  new RateLimiter(new RedisStorage(), new TokenBucketStrategy()),
];
```

## Benefits

1. **Testability**: Easy to mock storage and strategy for unit tests
2. **Flexibility**: Mix and match storage and strategy as needed
3. **Maintainability**: Changes to one component don't affect others
4. **Extensibility**: Add new implementations without modifying existing code
5. **Reusability**: Storage and strategy can be used independently

## Interface Contracts

### IStorage Contract

```typescript
interface IStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  increment(key: string, amount?: number): Promise<number>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  expire(key: string, ttlSeconds: number): Promise<void>;
}
```

**Why this works:**
- All storage backends need these operations
- Strategies only need these operations
- No storage-specific details leak into strategies

### IRateLimitStrategy Contract

```typescript
interface IRateLimitStrategy {
  checkLimit(
    identifier: string,
    config: RateLimitConfig,
    storage: IStorage
  ): Promise<RateLimitResult>;
  getKeyPrefix(): string;
}
```

**Why this works:**
- All strategies need to check limits
- Strategies receive storage as a dependency (not hard-coded)
- Storage implementation is completely hidden from strategies

## Example: Adding a New Storage Backend

To add Memcached support:

1. Create `MemcachedStorage` class
2. Implement `IStorage` interface
3. Done! Works with all existing strategies

```typescript
class MemcachedStorage implements IStorage {
  // Implement IStorage methods
}

// Immediately works with all strategies
const limiter = new RateLimiter(
  new MemcachedStorage(),
  new FixedWindowStrategy()
);
```

## Example: Adding a New Strategy

To add Sliding Window support:

1. Create `SlidingWindowStrategy` class
2. Implement `IRateLimitStrategy` interface
3. Done! Works with all existing storage backends

```typescript
class SlidingWindowStrategy implements IRateLimitStrategy {
  // Implement IRateLimitStrategy methods
}

// Immediately works with all storage backends
const limiter = new RateLimiter(
  new RedisStorage(),
  new SlidingWindowStrategy()
);
```

