# Rate Limiter Library

A flexible, decoupled rate limiting library for Node.js with support for multiple strategies and storage backends.

## Architecture

This library demonstrates clean architecture principles through interface-based design:

### Decoupling Strategy

1. **Storage Abstraction** (`IStorage` interface)
   - Decouples storage mechanism from rate limiting logic
   - Supports in-memory storage for local development
   - Supports Redis for distributed systems
   - Easy to add new storage backends (e.g., Memcached, DynamoDB)

2. **Strategy Abstraction** (`IRateLimitStrategy` interface)
   - Decouples rate limiting algorithms from storage
   - Supports Fixed Window algorithm
   - Supports Token Bucket algorithm
   - Easy to add new strategies (e.g., Sliding Window, Leaky Bucket)

3. **Dependency Injection**
   - `RateLimiter` class accepts storage and strategy via constructor
   - No hard dependencies on concrete implementations
   - Enables easy testing with mocks

## Usage Example (Future Implementation)

```typescript
import { RateLimiter, MemoryStorage, FixedWindowStrategy } from './src';

// Local development with in-memory storage
const memoryStorage = new MemoryStorage();
const fixedWindowStrategy = new FixedWindowStrategy();
const rateLimiter = new RateLimiter(memoryStorage, fixedWindowStrategy);

// Distributed system with Redis
const redisStorage = new RedisStorage(redisClient);
const tokenBucketStrategy = new TokenBucketStrategy();
const distributedRateLimiter = new RateLimiter(redisStorage, tokenBucketStrategy);

// Use the rate limiter
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

## Project Structure

```
src/
├── interfaces/
│   ├── storage.interface.ts      # Storage abstraction
│   ├── strategy.interface.ts     # Strategy abstraction
│   └── rate-limiter.interface.ts # Main rate limiter interface
├── storage/
│   ├── memory.storage.ts         # In-memory implementation
│   └── redis.storage.ts          # Redis implementation
├── strategies/
│   ├── fixed-window.strategy.ts  # Fixed window algorithm
│   └── token-bucket.strategy.ts  # Token bucket algorithm
├── rate-limiter.ts               # Main rate limiter class
└── index.ts                      # Public API exports
```

## Design Principles

1. **Interface Segregation**: Each interface has a single, focused responsibility
2. **Dependency Inversion**: High-level modules depend on abstractions, not concretions
3. **Open/Closed Principle**: Open for extension (new strategies/storage), closed for modification
4. **Loose Coupling**: Storage and strategy are completely independent

## Docker Setup

### Prerequisites
- Docker and Docker Compose installed

### Quick Start

1. **Install dependencies:**
```bash
npm install
```

2. **Start Redis and run the application:**
```bash
docker-compose up
```

This will:
- Start a Redis container on port 6379
- Build and run the rate limiter application
- Execute the example script

3. **Run Redis example locally (after starting Redis):**
```bash
npm run example:redis
```

4. **Stop the services:**
```bash
docker-compose down
```

### Docker Services

- **redis**: Redis 7 Alpine container with persistent storage
  - Port: 6379
  - Volume: `redis-data` for data persistence
  - Health check enabled

- **app**: Node.js application container
  - Port: 3000 (reserved for future API)
  - Hot-reload enabled via volume mounting
  - Waits for Redis to be healthy before starting

### Environment Variables

The application supports the following environment variables:

- `REDIS_HOST`: Redis host (default: `localhost`, Docker: `redis`)
- `REDIS_PORT`: Redis port (default: `6379`)
- `NODE_ENV`: Node environment (default: `development`)

### Development Workflow

**Local development without Docker:**
```bash
# Start Redis locally or use Docker for Redis only
docker run -d -p 6379:6379 redis:7-alpine

# Install dependencies
npm install

# Run examples
npm run example        # In-memory storage example
npm run example:redis  # Redis storage example
npm run example:dual   # Compare Redis vs Memory storage side-by-side
```

### Real-time Storage Monitoring

**Option 1: Use the dual storage example (Recommended)**
```bash
# Run in your main terminal - shows both Redis and Memory operations
npm run example:dual
```

**Option 2: Monitor Redis in separate terminals**

Terminal 1 - Run your application:
```bash
npm run example:redis
```

Terminal 2 - Watch Redis operations in real-time:
```bash
npm run redis:monitor
# OR manually:
docker exec -it rate-limiter-redis redis-cli MONITOR
```

Terminal 3 - Watch Redis keys and values:
```bash
npm run redis:keys
# OR manually:
docker exec -it rate-limiter-redis redis-cli KEYS "*"
```

**Option 3: Use Redis CLI directly**
```bash
# Connect to Redis CLI
docker exec -it rate-limiter-redis redis-cli

# Inside Redis CLI:
KEYS *              # List all keys
GET key_name        # Get a specific key
MONITOR             # Watch all operations
SCAN 0              # Iterate through keys
```

**Full Docker development:**
```bash
# Start all services
docker-compose up

# View logs
docker-compose logs -f app

# Rebuild after code changes
docker-compose up --build

# Run commands in the app container
docker-compose exec app npm run build
```

### Redis Client Compatibility

The `RedisStorage` class is compatible with the official `redis` client (v4+). The client must implement:
- `get(key: string): Promise<string | null>`
- `set(key: string, value: string, options?: { EX?: number }): Promise<string | null>`
- `incrBy(key: string, amount: number): Promise<number>`
- `del(key: string): Promise<number>`
- `exists(key: string): Promise<number>`
- `expire(key: string, seconds: number): Promise<number>`
