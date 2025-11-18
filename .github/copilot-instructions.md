# GitHub Copilot Instructions for Rate Limiter Library

## Project Overview

This is a flexible, decoupled rate limiting library for Node.js that demonstrates clean architecture principles through interface-based design. The library supports multiple rate limiting strategies (Fixed Window, Token Bucket) and storage backends (In-Memory, Redis).

## Core Architecture Principles

### Interface-Based Decoupling

This project strictly follows interface-based design:

1. **Storage Layer** (`IStorage` interface)
   - Abstracts data persistence mechanisms
   - Current implementations: `MemoryStorage`, `RedisStorage`
   - Future extensions: Memcached, DynamoDB, etc.

2. **Strategy Layer** (`IRateLimitStrategy` interface)
   - Abstracts rate limiting algorithms
   - Current implementations: `FixedWindowStrategy`, `TokenBucketStrategy`
   - Future extensions: Sliding Window, Leaky Bucket, etc.

3. **Rate Limiter Layer** (`IRateLimiter` interface)
   - Orchestrates storage and strategy through dependency injection
   - No hard dependencies on concrete implementations

### SOLID Principles

**Strictly adhere to these principles:**

- **Single Responsibility**: Each class/interface has one clear purpose
- **Open/Closed**: Open for extension (new implementations), closed for modification
- **Liskov Substitution**: All implementations must be fully interchangeable
- **Interface Segregation**: Interfaces are focused and minimal
- **Dependency Inversion**: Depend on abstractions (interfaces), not concretions

## Code Style and Conventions

### TypeScript Standards

- Use TypeScript strict mode (as configured in `tsconfig.json`)
- All public APIs must have explicit type annotations
- Prefer interfaces over type aliases for contracts
- Use `async/await` for asynchronous operations
- Return promises from all async operations

### Naming Conventions

- **Interfaces**: Prefix with `I` (e.g., `IStorage`, `IRateLimitStrategy`)
- **Classes**: PascalCase descriptive names (e.g., `MemoryStorage`, `FixedWindowStrategy`)
- **Methods**: camelCase descriptive verbs (e.g., `checkLimit`, `getKeyPrefix`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `DEFAULT_TTL_SECONDS`)
- **Files**: kebab-case matching class names (e.g., `memory.storage.ts`, `fixed-window.strategy.ts`)

### File Organization

```
src/
├── interfaces/          # All interface definitions
│   ├── storage.interface.ts
│   ├── strategy.interface.ts
│   └── rate-limiter.interface.ts
├── storage/            # Storage implementations
│   ├── memory.storage.ts
│   └── redis.storage.ts
├── strategies/         # Strategy implementations
│   ├── fixed-window.strategy.ts
│   └── token-bucket.strategy.ts
├── utils/             # Utility functions
├── examples/          # Usage examples
├── rate-limiter.ts    # Main orchestrator class
└── index.ts           # Public API exports
```

## Development Guidelines

### Adding New Storage Backends

When implementing a new storage backend:

1. Create a new file in `src/storage/` (e.g., `dynamodb.storage.ts`)
2. Implement the `IStorage` interface completely
3. Ensure all methods are async and return promises
4. Add appropriate error handling
5. Document any storage-specific configuration
6. Export from `src/index.ts` if it's part of the public API
7. Create an example in `src/examples/` demonstrating usage

**Critical**: The storage implementation must work with ALL existing strategies without modification.

### Adding New Rate Limiting Strategies

When implementing a new strategy:

1. Create a new file in `src/strategies/` (e.g., `sliding-window.strategy.ts`)
2. Implement the `IRateLimitStrategy` interface completely
3. Use only the `IStorage` interface methods (never depend on specific storage implementations)
4. Ensure the strategy is stateless (all state in storage)
5. Return proper `RateLimitResult` with `allowed`, `remaining`, and `retryAfter` fields
6. Use appropriate key prefixes via `getKeyPrefix()`
7. Export from `src/index.ts` if it's part of the public API
8. Create an example demonstrating the strategy with different storage backends

**Critical**: The strategy must work with ALL storage implementations without modification.

### Maintaining Decoupling

**Never:**
- Import concrete classes in interface definitions
- Add storage-specific logic to strategies
- Add strategy-specific logic to storage implementations
- Create circular dependencies between layers
- Bypass interfaces by accessing implementation details

**Always:**
- Program against interfaces, not implementations
- Accept interfaces as constructor/method parameters
- Return interface types from factory methods
- Test implementations independently with mocks

### Error Handling

- Use descriptive error messages
- Throw appropriate errors for invalid inputs
- Catch and handle storage errors gracefully
- Document error conditions in comments
- Never swallow errors silently

### Documentation

- Add JSDoc comments to all public APIs
- Document interface contracts clearly
- Include usage examples in comments where helpful
- Update README.md for user-facing changes
- Update ARCHITECTURE.md for design changes

## Dependencies

### Runtime Dependencies

- `redis` (^4.6.0): Official Redis client for Node.js

### Development Dependencies

- `typescript` (^5.0.0): TypeScript compiler
- `ts-node` (^10.9.0): TypeScript execution for Node.js
- `@types/node` (^20.0.0): Node.js type definitions

**When adding dependencies:**
- Prefer well-maintained, popular packages
- Avoid dependencies with security vulnerabilities
- Keep the dependency tree minimal
- Document why each dependency is needed

## Testing Guidelines

Currently, this project does not have formal tests. When tests are added:

- Test implementations against their interfaces
- Use mocks for testing strategies (mock `IStorage`)
- Use mocks for testing storage (mock strategy behavior)
- Test the `RateLimiter` class with mocked dependencies
- Include integration tests with real Redis for `RedisStorage`
- Test edge cases (rate limit boundaries, expired keys, etc.)

## Docker and Redis

The project includes Docker support for local development:

- Redis runs in a container accessible at `redis:6379` (in Docker) or `localhost:6379` (locally)
- Use environment variables for configuration (`REDIS_HOST`, `REDIS_PORT`)
- The `RedisStorage` class expects a redis client instance (v4+ API)

## Examples and Usage

The `src/examples/` directory contains working examples:

- `usage-example.ts`: In-memory storage demonstration
- `redis-example.ts`: Redis storage demonstration
- `dual-storage-example.ts`: Side-by-side comparison

When modifying the API, update all examples to reflect changes.

## Build and Development

### Building
```bash
npm run build          # Compile TypeScript to JavaScript
```

### Running Examples
```bash
npm run example        # Run memory storage example
npm run example:redis  # Run Redis storage example (requires Redis)
npm run example:dual   # Run dual storage comparison
```

### Docker Commands
```bash
docker-compose up      # Start Redis and run application
docker-compose down    # Stop services
```

## Code Review Checklist

Before submitting changes, verify:

- [ ] All interfaces are properly implemented
- [ ] No concrete class dependencies between layers
- [ ] TypeScript compiles without errors (`npm run build`)
- [ ] Code follows naming conventions
- [ ] Documentation is updated
- [ ] Examples still work
- [ ] No security vulnerabilities introduced
- [ ] SOLID principles are maintained
- [ ] Changes maintain backward compatibility (or document breaking changes)

## Common Patterns

### Creating a Rate Limiter Instance

```typescript
import { RateLimiter, MemoryStorage, FixedWindowStrategy } from './src';

const storage = new MemoryStorage();
const strategy = new FixedWindowStrategy();
const rateLimiter = new RateLimiter(storage, strategy);
```

### Checking Rate Limits

```typescript
const result = await rateLimiter.check('user-123', {
  limit: 100,
  windowSeconds: 60
});

if (result.allowed) {
  // Process request
} else {
  // Rate limit exceeded
  console.log(`Retry after ${result.retryAfter} seconds`);
}
```

### Switching Implementations

```typescript
// Easy to swap storage
const memoryLimiter = new RateLimiter(new MemoryStorage(), strategy);
const redisLimiter = new RateLimiter(new RedisStorage(redisClient), strategy);

// Easy to swap strategy
const fixedWindow = new RateLimiter(storage, new FixedWindowStrategy());
const tokenBucket = new RateLimiter(storage, new TokenBucketStrategy());
```

## Philosophy

This library prioritizes **flexibility, maintainability, and extensibility** over performance optimization. The architecture demonstrates clean code principles and serves as a reference implementation for decoupled design patterns in TypeScript.

When making changes, always ask:
1. Does this maintain interface-based decoupling?
2. Can I extend without modifying existing code?
3. Will this work with all current implementations?
4. Does this violate any SOLID principles?

If the answer to any question is concerning, reconsider the approach.
