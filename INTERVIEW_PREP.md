# Rate Limiting: System Design Q&A for SDE2 Interview Preparation

This document provides comprehensive coverage of rate limiting concepts, algorithms, trade-offs, and system design considerations to help you prepare for Senior Software Engineer (SDE2) interviews.

---

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Rate Limiting Algorithms](#rate-limiting-algorithms)
3. [Algorithm Comparison & Trade-offs](#algorithm-comparison--trade-offs)
4. [Storage Backend Considerations](#storage-backend-considerations)
5. [Distributed Rate Limiting](#distributed-rate-limiting)
6. [System Design Questions](#system-design-questions)
7. [Real-World Scenarios](#real-world-scenarios)
8. [Best Practices & Anti-Patterns](#best-practices--anti-patterns)
9. [Performance & Scalability](#performance--scalability)
10. [Common Interview Questions](#common-interview-questions)

---

## Core Concepts

### Q: What is rate limiting and why is it important?

**Answer:**

Rate limiting is a technique used to control the rate at which users or services can access a resource or API. It's essential for:

1. **Preventing Abuse**: Protects against DoS attacks and malicious users
2. **Ensuring Fair Usage**: Prevents single users from monopolizing resources
3. **Cost Control**: Limits usage of expensive operations (API calls, database queries)
4. **Service Stability**: Prevents system overload and maintains SLA
5. **Business Model Enforcement**: Enables tiered pricing (free vs premium tiers)

### Q: What are the key metrics in rate limiting?

**Answer:**

1. **Limit**: Maximum number of requests allowed in a time window
2. **Window**: Time period for the limit (e.g., 100 requests per minute)
3. **Remaining**: Number of requests still available in current window
4. **Reset Time**: When the limit counter resets
5. **Retry-After**: How long to wait before retrying (when rate limited)

### Q: Where should rate limiting be implemented?

**Answer:**

Rate limiting can be implemented at multiple layers:

1. **API Gateway Level** (Most Common)
   - Centralized control
   - Before traffic reaches backend
   - Examples: AWS API Gateway, Kong, Nginx

2. **Application Level**
   - Fine-grained control
   - Business logic specific
   - Can use different limits for different endpoints

3. **CDN/Edge Level**
   - Closest to users
   - Reduces backend load
   - Examples: Cloudflare, Fastly

4. **Load Balancer Level**
   - Distributes load fairly
   - Protection layer
   - Examples: HAProxy, AWS ELB

**Trade-off**: Higher up the stack = better protection but less flexibility. Lower in stack = more context but harder to scale.

---

## Rate Limiting Algorithms

### 1. Fixed Window Counter

**How it works:**
- Divide time into fixed windows (e.g., 0-60s, 60-120s, 120-180s)
- Each window has a counter
- Increment counter for each request
- Reset counter when window expires

**Implementation:**
```
Key: user:timestamp_window
Value: count
TTL: window_size

if count < limit:
  increment(key)
  allow request
else:
  reject request
```

**Pros:**
- Simple to implement
- Memory efficient (one counter per window)
- Easy to understand and debug
- Low latency (single operation)

**Cons:**
- **Burst problem at window boundaries**: Can allow 2x limit (e.g., 100 requests at 59s, 100 more at 60s = 200 in 2 seconds)
- Not smooth distribution
- Unfair to users who hit window edges

**Best for:**
- Simple use cases
- When burst at boundaries is acceptable
- Resource-constrained environments

### 2. Sliding Window Log

**How it works:**
- Store timestamp of each request in a sorted set
- For each new request, remove old entries outside the window
- Count remaining entries
- Allow if count < limit

**Implementation:**
```
Key: user:requests
Value: sorted set of timestamps

Remove entries older than (now - window)
if count < limit:
  add current timestamp
  allow request
else:
  reject request
```

**Pros:**
- Very accurate
- No boundary burst problem
- Fair distribution of requests

**Cons:**
- Memory intensive (stores every request timestamp)
- Higher latency (O(n) operations)
- Expensive cleanup operations
- Not suitable for high-volume APIs

**Best for:**
- When precision is critical
- Low to medium traffic
- When you need audit trails

### 3. Sliding Window Counter (Hybrid)

**How it works:**
- Combines Fixed Window + Sliding Window
- Uses two adjacent windows
- Weighted calculation based on time position in current window

**Implementation:**
```
current_window_count = count in current window
previous_window_count = count in previous window
elapsed_time_in_current = now - current_window_start
weight = 1 - (elapsed_time_in_current / window_size)

approximate_count = (previous_window_count * weight) + current_window_count

if approximate_count < limit:
  allow request
else:
  reject request
```

**Pros:**
- Better than fixed window (reduces boundary problem)
- More memory efficient than sliding log
- Good approximation of true sliding window
- Balanced trade-off

**Cons:**
- Slightly more complex
- Still an approximation (not 100% accurate)
- Requires storing two windows

**Best for:**
- Production systems with high traffic
- When you need accuracy + efficiency
- Most common choice for APIs

### 4. Token Bucket

**How it works:**
- Bucket holds tokens (up to max capacity)
- Tokens refill at constant rate
- Each request consumes token(s)
- Allow if tokens available, reject otherwise

**Implementation:**
```
Bucket state:
  - tokens: current count
  - last_refill: timestamp

On each request:
1. Calculate elapsed time since last_refill
2. Add tokens = elapsed_time * refill_rate (capped at capacity)
3. Update last_refill
4. If tokens >= 1:
     consume token
     allow request
   else:
     reject request
```

**Pros:**
- Handles bursts gracefully (can accumulate tokens)
- Smooth rate limiting
- Flexible (can adjust token consumption per request)
- Good for variable-cost operations

**Cons:**
- More complex to implement
- Harder to reason about exact limits
- Can allow bursts up to bucket size
- Requires atomic operations

**Best for:**
- APIs with bursty traffic patterns
- When you want to allow occasional bursts
- Variable-cost operations (1 token for read, 5 for write)

### 5. Leaky Bucket

**How it works:**
- Requests enter queue (bucket)
- Requests processed at fixed rate (leak)
- If bucket full, reject new requests

**Implementation:**
```
Queue: FIFO of requests
Process rate: fixed (e.g., 100/minute)

On each request:
  if queue.size < capacity:
    queue.add(request)
    process at fixed rate
  else:
    reject request
```

**Pros:**
- Very smooth output rate
- Good for protecting downstream services
- Prevents sudden spikes
- Predictable resource usage

**Cons:**
- Adds latency (queuing delay)
- Can reject requests even with capacity
- More complex to implement
- Requires background processing

**Best for:**
- Protecting downstream services
- When smooth rate is critical
- Background job processing
- Message queue systems

---

## Algorithm Comparison & Trade-offs

### Quick Comparison Table

| Algorithm | Memory | Accuracy | Burst Handling | Complexity | Best Use Case |
|-----------|--------|----------|----------------|------------|---------------|
| Fixed Window | Low | Poor | Bad (2x at edges) | Simple | Simple apps, low traffic |
| Sliding Log | High | Excellent | Good | Medium | Audit trails, low traffic |
| Sliding Counter | Medium | Good | Better | Medium | Most APIs (balanced) |
| Token Bucket | Low | Good | Excellent | Medium | Bursty traffic, flexible costs |
| Leaky Bucket | Medium | Excellent | None (smooth) | High | Queue processing, protection |

### When to Choose Which Algorithm?

**Choose Fixed Window when:**
- Building MVP or prototype
- Traffic is low
- Burst at boundaries acceptable
- Resources are constrained

**Choose Sliding Window Log when:**
- Accuracy is paramount
- Need audit trail
- Traffic is low-to-medium
- Memory is not a concern

**Choose Sliding Window Counter when:**
- Building production API
- Need balance of accuracy and efficiency
- High traffic expected
- Standard use case

**Choose Token Bucket when:**
- Traffic is bursty
- Want to allow occasional bursts
- Different operations have different costs
- User experience matters (allow saved tokens)

**Choose Leaky Bucket when:**
- Protecting downstream service
- Need predictable output rate
- Can handle queuing delay
- Processing background jobs

### Trade-off Dimensions

1. **Memory vs Accuracy**
   - More memory = more accuracy (sliding log)
   - Less memory = approximations (fixed window)

2. **Fairness vs Simplicity**
   - Fair = complex (sliding log)
   - Simple = potential unfairness (fixed window)

3. **Burst Tolerance vs Consistency**
   - Allow bursts = better UX (token bucket)
   - Smooth rate = better protection (leaky bucket)

4. **Latency vs Features**
   - Low latency = simple algorithm (fixed window)
   - More features = more operations (sliding log)

---

## Storage Backend Considerations

### In-Memory Storage

**Implementation:**
```javascript
class MemoryStorage {
  private store: Map<string, any> = new Map();
  
  async get(key: string): Promise<string | null> {
    return this.store.get(key) || null;
  }
  
  async set(key: string, value: string, ttl?: number): Promise<void> {
    this.store.set(key, value);
    if (ttl) {
      setTimeout(() => this.store.delete(key), ttl * 1000);
    }
  }
}
```

**Pros:**
- Extremely fast (no network latency)
- No external dependencies
- Easy to set up and test
- No serialization overhead

**Cons:**
- Not distributed (each server has own state)
- Lost on restart
- Limited by memory
- No persistence

**Best for:**
- Single-instance applications
- Development/testing
- Non-critical rate limiting
- Embedded systems

### Redis Storage

**Implementation:**
```javascript
class RedisStorage {
  async increment(key: string): Promise<number> {
    return await redis.incr(key);
  }
  
  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await redis.setex(key, ttl, value);
    } else {
      await redis.set(key, value);
    }
  }
}
```

**Pros:**
- Distributed (shared state across servers)
- Fast (in-memory with persistence)
- Atomic operations (INCR, DECR)
- Built-in TTL support
- Horizontal scaling (Redis Cluster)

**Cons:**
- Network latency
- Additional infrastructure
- Single point of failure (without replication)
- Cost (managed Redis)

**Best for:**
- Production distributed systems
- Microservices architecture
- High availability requirements
- Multiple application servers

### Database Storage (SQL/NoSQL)

**Pros:**
- Persistent
- Existing infrastructure
- Rich querying
- Transactions support

**Cons:**
- Slow compared to Redis/Memory
- Not optimized for rate limiting
- Expensive operations
- Requires careful indexing

**Best for:**
- When you need long-term data
- Audit and compliance requirements
- Low traffic applications

### Comparison Matrix

| Feature | Memory | Redis | Database |
|---------|--------|-------|----------|
| Speed | Fastest | Fast | Slow |
| Distribution | No | Yes | Yes |
| Persistence | No | Optional | Yes |
| Atomic Ops | Manual | Built-in | Transactions |
| Scalability | Vertical only | Horizontal | Horizontal |
| Setup | None | Medium | Existing |
| Cost | Free | Medium-High | Varies |

### Hybrid Approaches

**Two-Tier Caching:**
```
L1 (Memory) -> L2 (Redis) -> L3 (Database)
```

- Check memory first (fast path)
- Fall back to Redis (distributed)
- Persist to database (audit)

**Write-through:**
- Update both memory and Redis
- Eventual consistency acceptable

**Best for:**
- High-traffic systems
- Need both speed and distribution
- Gradual failover requirements

---

## Distributed Rate Limiting

### Challenges in Distributed Systems

1. **Race Conditions**
   - Multiple servers checking limit simultaneously
   - Can exceed limit before updates propagate

2. **Consistency vs Availability Trade-off**
   - Strict consistency = slower
   - Eventual consistency = can exceed limits temporarily

3. **Network Partitions**
   - Servers can't reach central storage
   - How to handle failures?

4. **Clock Skew**
   - Different server clocks
   - Affects window calculations

### Solution Patterns

#### 1. Centralized Counter (Redis)

**Architecture:**
```
[Server 1] ──┐
[Server 2] ──┼──> [Redis] (Single source of truth)
[Server 3] ──┘
```

**Pros:**
- Accurate
- Consistent
- Simple to implement

**Cons:**
- Single point of failure
- Network dependency
- Latency overhead

**Mitigation:**
- Redis Sentinel (HA)
- Redis Cluster (sharding)
- Read replicas

#### 2. Local Rate Limiting with Sync

**Architecture:**
```
[Server 1 + Local Cache] ──┐
[Server 2 + Local Cache] ──┼──> [Redis] (Periodic sync)
[Server 3 + Local Cache] ──┘
```

**Algorithm:**
```
1. Check local cache first (fast)
2. If approaching limit, check Redis
3. Periodically sync with Redis
4. Each server gets quota (total_limit / num_servers)
```

**Pros:**
- Fast (local cache)
- Resilient to Redis failures
- Lower Redis load

**Cons:**
- Can exceed limits (race window)
- Complex to implement
- Needs coordination

#### 3. Consistent Hashing

**Architecture:**
```
User Hash -> Specific Server/Redis Shard
```

**Algorithm:**
```
server_id = hash(user_id) % num_servers
route to server_id for rate limit check
```

**Pros:**
- Distributed load
- No single point of failure
- Scales horizontally

**Cons:**
- Resharding complexity
- Uneven distribution possible
- Sticky sessions needed

#### 4. Rate Limiting as a Service

**Architecture:**
```
[App Servers] -> [Rate Limit Service] -> [Redis Cluster]
                        |
                   [Config Store]
```

**Pros:**
- Centralized management
- Specialized optimization
- Easy to update limits
- Independent scaling

**Cons:**
- Additional service to maintain
- Network hop overhead
- Potential bottleneck

**Examples:**
- Lyft's Ratelimit (open source)
- AWS API Gateway
- Google Cloud Armor

### Handling Failures

**1. Fail Open vs Fail Closed**

**Fail Open** (Allow requests when rate limiter fails):
```javascript
try {
  const allowed = await rateLimiter.check(userId);
  if (!allowed) return reject();
} catch (error) {
  // Rate limiter failed - ALLOW request
  logger.error('Rate limiter failed', error);
  return allow();
}
```

**Fail Closed** (Reject requests when rate limiter fails):
```javascript
try {
  const allowed = await rateLimiter.check(userId);
  return allowed ? allow() : reject();
} catch (error) {
  // Rate limiter failed - REJECT request
  return reject();
}
```

**Trade-off:**
- Fail Open: Better availability, risk of abuse
- Fail Closed: Better security, worse availability

**Best Practice:** Context-dependent
- Fail Open for non-critical APIs
- Fail Closed for expensive/dangerous operations

**2. Circuit Breaker Pattern**

```javascript
class RateLimiterWithCircuitBreaker {
  private failureCount = 0;
  private lastFailure = 0;
  private isOpen = false;
  
  async check(userId: string): Promise<boolean> {
    if (this.isOpen && Date.now() - this.lastFailure < 60000) {
      // Circuit open - fail fast
      return true; // fail open
    }
    
    try {
      const result = await this.rateLimiter.check(userId);
      this.failureCount = 0; // reset on success
      this.isOpen = false;
      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailure = Date.now();
      
      if (this.failureCount > 3) {
        this.isOpen = true; // open circuit
      }
      
      return true; // fail open
    }
  }
}
```

**3. Degraded Mode**

```javascript
async checkWithDegradation(userId: string): Promise<boolean> {
  try {
    // Try distributed rate limiting
    return await redis.checkRateLimit(userId);
  } catch (error) {
    // Fall back to local rate limiting (more lenient)
    return await localRateLimiter.check(userId, {
      limit: config.limit * 2 // 2x more lenient
    });
  }
}
```

---

## System Design Questions

### Q: Design a rate limiter for a high-traffic API (like Twitter)

**Requirements Clarification:**
1. What's the scale? (e.g., 1M requests/second)
2. Rate limit granularity? (per user, per IP, per API key)
3. Multiple rate limits? (different limits for different endpoints)
4. Distributed system? (multiple servers)
5. Failure handling? (fail open or closed)

**High-Level Design:**

```
┌─────────────────────────────────────────────────────────────┐
│                         Load Balancer                        │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ API Server 1 │    │ API Server 2 │    │ API Server 3 │
└──────────────┘    └──────────────┘    └──────────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
                            ▼
                ┌───────────────────────┐
                │   Redis Cluster       │
                │  (Shared Rate Limit   │
                │      State)           │
                └───────────────────────┘
```

**Detailed Design:**

1. **Algorithm Choice:** Token Bucket or Sliding Window Counter
   - Token Bucket for better burst handling
   - Sliding Window Counter for accuracy

2. **Storage:** Redis Cluster
   - Sharded by user ID
   - Replication for HA
   - Consistent hashing

3. **Data Structure:**
```javascript
Key: "rl:{user_id}:{endpoint}:{window_start}"
Value: JSON {
  count: number,
  resetTime: timestamp
}
TTL: window_size * 2
```

4. **Rate Limit Check Flow:**
```
1. Extract user ID from request
2. Construct rate limit key
3. Check Redis:
   a. INCR key
   b. GET TTL
   c. If first request: SET TTL
4. If count > limit:
   return 429 (Too Many Requests)
   headers: {
     X-RateLimit-Limit: limit,
     X-RateLimit-Remaining: 0,
     X-RateLimit-Reset: resetTime,
     Retry-After: seconds
   }
5. Else: allow request
```

5. **Optimizations:**
   - Local cache for hot users (reduce Redis load)
   - Pipeline Redis commands (reduce RTT)
   - Lua scripts for atomic operations
   - Connection pooling

6. **Monitoring:**
   - Rate limit hit rate
   - False positives
   - Redis latency
   - Error rates

**Capacity Estimation:**

For 1M requests/second with 1M users:
```
Storage per user per endpoint: ~100 bytes
Total storage: 1M users * 10 endpoints * 100 bytes = 1GB

Redis ops: 1M reads/sec + 1M writes/sec = 2M ops/sec
With Redis Cluster (10 shards): 200K ops/sec per shard
Well within Redis capacity (100K+ ops/sec per instance)
```

### Q: How would you implement rate limiting for WebSocket connections?

**Challenge:** WebSockets are long-lived connections, not per-request.

**Solution Approaches:**

1. **Connection-Level Rate Limiting:**
   - Limit number of concurrent connections per user
   - Use Redis INCR/DECR on connect/disconnect

2. **Message-Level Rate Limiting:**
   - Rate limit messages within WebSocket
   - Apply token bucket to incoming messages

3. **Hybrid Approach:**
```javascript
class WebSocketRateLimiter {
  // Limit connections
  async onConnect(userId: string): Promise<boolean> {
    const connections = await redis.incr(`ws:connections:${userId}`);
    if (connections > MAX_CONNECTIONS) {
      await redis.decr(`ws:connections:${userId}`);
      return false;
    }
    return true;
  }
  
  // Limit messages
  async onMessage(userId: string): Promise<boolean> {
    return await tokenBucket.consume(userId);
  }
  
  async onDisconnect(userId: string): Promise<void> {
    await redis.decr(`ws:connections:${userId}`);
  }
}
```

**Best Practice:**
- Combine connection + message rate limits
- Different limits for different message types
- Graceful degradation (slow down, don't disconnect)

### Q: How do you handle rate limiting in a multi-region deployment?

**Challenges:**
1. Cross-region latency
2. Data consistency
3. Regional failures
4. Compliance (data locality)

**Solution: Regional Rate Limiting with Global Soft Limits**

```
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│  US-East Region     │  │  EU-West Region     │  │  Asia Region        │
│  - API Servers      │  │  - API Servers      │  │  - API Servers      │
│  - Redis Cluster    │  │  - Redis Cluster    │  │  - Redis Cluster    │
└─────────────────────┘  └─────────────────────┘  └─────────────────────┘
         │                        │                        │
         └────────────────────────┼────────────────────────┘
                                  │
                      ┌───────────────────────┐
                      │  Global Config Store  │
                      │   (DynamoDB Global    │
                      │    Tables)            │
                      └───────────────────────┘
```

**Strategy:**

1. **Regional Quotas:**
   - Divide total limit across regions
   - Each region independent
   - Example: 100 req/min total = 40 US + 30 EU + 30 Asia

2. **Soft Limits:**
   - Allow regions to exceed quota if others underutilized
   - Periodic sync (every 1-5 seconds)

3. **Implementation:**
```javascript
class MultiRegionRateLimiter {
  async check(userId: string, region: string): Promise<boolean> {
    // Check local regional limit
    const regionalLimit = this.getRegionalQuota(region);
    const localAllowed = await this.checkRegional(userId, region, regionalLimit);
    
    if (!localAllowed) {
      // Check global limit (slower, but more accurate)
      const globalAllowed = await this.checkGlobal(userId);
      return globalAllowed;
    }
    
    return true;
  }
  
  async checkRegional(userId: string, region: string, limit: number): Promise<boolean> {
    const key = `rl:${region}:${userId}`;
    const count = await localRedis.incr(key);
    return count <= limit;
  }
  
  async checkGlobal(userId: string): Promise<boolean> {
    // Check aggregate across all regions
    const regions = ['us', 'eu', 'asia'];
    const counts = await Promise.all(
      regions.map(r => redis.get(`rl:${r}:${userId}`))
    );
    const total = counts.reduce((sum, c) => sum + parseInt(c || '0'), 0);
    return total <= GLOBAL_LIMIT;
  }
}
```

**Trade-offs:**
- Regional independence: Better availability
- Global accuracy: Better fairness
- Balance: Regional soft limits with global hard limits

---

## Real-World Scenarios

### Scenario 1: E-commerce Flash Sale

**Problem:**
- Massive traffic spike
- Limited inventory (1000 items)
- Millions of concurrent users
- Need to prevent overselling

**Rate Limiting Strategy:**

1. **Multi-Layer Rate Limiting:**
```
Layer 1: CDN/Edge (per IP)
  - 10 requests/second per IP
  - Blocks bots and scrapers

Layer 2: API Gateway (per user)
  - 100 requests/minute per authenticated user
  - Prevents aggressive clients

Layer 3: Checkout Service (per user)
  - 1 checkout every 5 seconds
  - Prevents race conditions
```

2. **Adaptive Rate Limiting:**
```javascript
class AdaptiveRateLimiter {
  async getLimit(userId: string, context: Context): Promise<number> {
    const baseLimit = 100;
    
    // Reduce limit during peak times
    const peakHours = context.isPeakHour();
    const peakMultiplier = peakHours ? 0.5 : 1.0;
    
    // Increase limit for premium users
    const userTier = await this.getUserTier(userId);
    const tierMultiplier = userTier === 'premium' ? 2.0 : 1.0;
    
    // Reduce limit based on system load
    const systemLoad = await this.getSystemLoad();
    const loadMultiplier = systemLoad > 80 ? 0.7 : 1.0;
    
    return Math.floor(baseLimit * peakMultiplier * tierMultiplier * loadMultiplier);
  }
}
```

3. **Queue System:**
- Rate limiting at entry
- Virtual waiting room
- Gradual admission

### Scenario 2: API with Multiple Tiers (Free/Pro/Enterprise)

**Implementation:**

```javascript
interface TierConfig {
  requestsPerHour: number;
  requestsPerDay: number;
  burstSize: number;
  endpoints: {
    [endpoint: string]: {
      requestsPerMinute: number;
      cost: number; // token cost
    }
  };
}

const tierConfigs: Record<string, TierConfig> = {
  free: {
    requestsPerHour: 1000,
    requestsPerDay: 10000,
    burstSize: 10,
    endpoints: {
      '/search': { requestsPerMinute: 10, cost: 1 },
      '/premium-search': { requestsPerMinute: 0, cost: 1 } // Not allowed
    }
  },
  pro: {
    requestsPerHour: 10000,
    requestsPerDay: 200000,
    burstSize: 50,
    endpoints: {
      '/search': { requestsPerMinute: 100, cost: 1 },
      '/premium-search': { requestsPerMinute: 20, cost: 5 }
    }
  },
  enterprise: {
    requestsPerHour: -1, // unlimited
    requestsPerDay: -1,
    burstSize: 1000,
    endpoints: {
      '/search': { requestsPerMinute: -1, cost: 1 },
      '/premium-search': { requestsPerMinute: -1, cost: 1 }
    }
  }
};

class TieredRateLimiter {
  async check(userId: string, endpoint: string): Promise<RateLimitResult> {
    const tier = await this.getUserTier(userId);
    const config = tierConfigs[tier];
    
    // Check multiple limits
    const checks = await Promise.all([
      this.checkLimit(userId, 'hour', config.requestsPerHour),
      this.checkLimit(userId, 'day', config.requestsPerDay),
      this.checkEndpointLimit(userId, endpoint, config.endpoints[endpoint])
    ]);
    
    const allowed = checks.every(c => c.allowed);
    
    if (!allowed) {
      // Find most restrictive limit
      const blocking = checks.find(c => !c.allowed);
      return blocking!;
    }
    
    return { allowed: true, remaining: Math.min(...checks.map(c => c.remaining)) };
  }
}
```

### Scenario 3: Preventing Credential Stuffing Attacks

**Problem:**
- Attackers try millions of username/password combinations
- Normal rate limiting too lenient
- Need to detect and block automated attacks

**Solution: Adaptive Rate Limiting with Anomaly Detection**

```javascript
class SecurityRateLimiter {
  async checkLogin(ip: string, username: string): Promise<LoginRateLimit> {
    const checks = [
      // Per IP: 10 login attempts per minute
      this.checkIPRate(ip, { limit: 10, window: 60 }),
      
      // Per username: 5 failed attempts per hour
      this.checkUsernameFailures(username, { limit: 5, window: 3600 }),
      
      // Per IP-Username combination: 3 attempts per hour
      this.checkIPUsernameCombo(ip, username, { limit: 3, window: 3600 }),
      
      // Distributed attack: Check if IP is trying many usernames
      this.checkIPUsernameVariety(ip, { threshold: 50, window: 300 })
    ];
    
    const results = await Promise.all(checks);
    const blocked = results.find(r => !r.allowed);
    
    if (blocked) {
      // Increase blocking duration on repeated violations
      const violations = await this.getViolationCount(ip);
      const blockDuration = Math.min(3600 * Math.pow(2, violations), 86400); // Max 24h
      await this.blockIP(ip, blockDuration);
      return { allowed: false, reason: blocked.reason };
    }
    
    return { allowed: true };
  }
  
  async onLoginFailure(ip: string, username: string): Promise<void> {
    await this.recordFailure(ip, username);
    
    // Check for patterns
    const failureRate = await this.getRecentFailureRate(ip);
    if (failureRate > 0.8) { // 80% failure rate
      await this.flagSuspiciousIP(ip);
    }
  }
}
```

**Key Techniques:**
1. Multiple overlapping limits
2. Exponential backoff on violations
3. Pattern detection (many usernames from one IP)
4. Distinguish failed vs successful attempts

---

## Best Practices & Anti-Patterns

### Best Practices

#### 1. Return Clear Headers

Always include rate limit information in response headers:

```javascript
// Response headers
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 42
X-RateLimit-Reset: 1640000000
Retry-After: 30
```

**Benefits:**
- Clients can adapt behavior
- Better debugging
- Transparent to users

#### 2. Use Different Limits for Different Operations

```javascript
const limits = {
  // Read operations
  'GET /users': { limit: 1000, window: 60 },
  'GET /posts': { limit: 1000, window: 60 },
  
  // Write operations (more expensive)
  'POST /users': { limit: 10, window: 60 },
  'PUT /users/:id': { limit: 50, window: 60 },
  'DELETE /users/:id': { limit: 5, window: 60 },
  
  // Expensive operations
  'POST /reports': { limit: 1, window: 3600 },
  'GET /export': { limit: 5, window: 86400 }
};
```

#### 3. Graceful Degradation

```javascript
async function handleRequest(req: Request): Promise<Response> {
  try {
    const allowed = await rateLimiter.check(req.userId);
    
    if (!allowed) {
      // Instead of hard reject, offer degraded service
      return await handleDegradedMode(req);
    }
    
    return await handleNormalMode(req);
  } catch (error) {
    // Rate limiter failed - log and allow (fail open for non-critical)
    logger.error('Rate limiter error', error);
    return await handleNormalMode(req);
  }
}

async function handleDegradedMode(req: Request): Promise<Response> {
  // Return cached data, reduce quality, or limit features
  return {
    data: await getCachedData(req),
    warning: 'Rate limit exceeded. Showing cached data.'
  };
}
```

#### 4. Monitor and Alert

```javascript
class MonitoredRateLimiter {
  async check(userId: string): Promise<RateLimitResult> {
    const start = Date.now();
    
    try {
      const result = await this.rateLimiter.check(userId);
      
      // Metrics
      metrics.recordLatency('rate_limiter.check', Date.now() - start);
      metrics.increment('rate_limiter.checks');
      
      if (!result.allowed) {
        metrics.increment('rate_limiter.blocked');
        metrics.increment(`rate_limiter.blocked.${userId}`);
      }
      
      // Alert on high block rate
      const blockRate = await this.getBlockRate();
      if (blockRate > 0.5) { // 50% of requests blocked
        alerts.send('High rate limit block rate', { rate: blockRate });
      }
      
      return result;
    } catch (error) {
      metrics.increment('rate_limiter.errors');
      throw error;
    }
  }
}
```

**Key Metrics:**
- Rate limiter latency (p50, p95, p99)
- Block rate (overall and per user)
- Error rate
- False positives (legitimate users blocked)
- Storage health (Redis latency, memory usage)

#### 5. Configuration Management

```javascript
// Centralized configuration
class RateLimitConfigManager {
  async getConfig(userId: string, endpoint: string): Promise<RateLimitConfig> {
    // Load from dynamic config store (not hardcoded)
    const config = await this.configStore.get(`limits:${endpoint}`);
    
    // Support overrides
    const userOverride = await this.configStore.get(`limits:user:${userId}`);
    
    return {
      ...config,
      ...userOverride
    };
  }
  
  async updateLimit(endpoint: string, newLimit: number): Promise<void> {
    // Update without redeployment
    await this.configStore.set(`limits:${endpoint}`, { limit: newLimit });
    
    // Notify all servers
    await this.pubsub.publish('config-update', { endpoint, limit: newLimit });
  }
}
```

**Benefits:**
- Update limits without redeployment
- A/B testing different limits
- Quick response to attacks

### Anti-Patterns to Avoid

#### ❌ 1. Hardcoded Limits

```javascript
// BAD
if (count > 100) {
  return reject();
}

// GOOD
const config = await getConfig(endpoint);
if (count > config.limit) {
  return reject();
}
```

#### ❌ 2. Ignoring Time Zones and Clocks

```javascript
// BAD - Using local time without considering clock skew
const windowStart = Math.floor(Date.now() / 1000);
const key = `limit:${userId}:${windowStart}`;
// Problem: Different servers may have different times
// leading to inconsistent window calculations

// GOOD - Use centralized time source and handle clock drift
class TimeAwareRateLimiter {
  private clockSkewThreshold = 5; // seconds
  
  async getWindowStart(windowSeconds: number): Promise<number> {
    // Option 1: Get time from Redis (single source of truth)
    const redisTime = await redis.time(); // Returns [seconds, microseconds]
    const serverTime = Math.floor(Date.now() / 1000);
    
    // Detect and log clock drift
    const drift = Math.abs(redisTime[0] - serverTime);
    if (drift > this.clockSkewThreshold) {
      logger.warn(`Clock drift detected: ${drift}s`);
    }
    
    // Use Redis time as authoritative source
    return Math.floor(redisTime[0] / windowSeconds) * windowSeconds;
  }
  
  // Option 2: Always use UTC and sync with NTP
  getUTCWindowStart(windowSeconds: number): number {
    // Date.now() returns UTC milliseconds
    const utcSeconds = Math.floor(Date.now() / 1000);
    return Math.floor(utcSeconds / windowSeconds) * windowSeconds;
    // Ensure NTP is configured on all servers
  }
}
```

#### ❌ 3. Not Handling Distributed Systems

```javascript
// BAD (works only for single server)
let count = localCache.get(userId) || 0;
count++;
if (count > limit) reject();

// GOOD (distributed-aware)
const count = await redis.incr(`limit:${userId}`);
if (count > limit) reject();
```

#### ❌ 4. No Cleanup of Old Data

```javascript
// BAD (memory leak)
await redis.set(key, value); // No TTL

// GOOD
await redis.setex(key, ttl, value); // Auto-cleanup
```

#### ❌ 5. Single Global Limit

```javascript
// BAD (treats all users equally)
const GLOBAL_LIMIT = 1000;

// GOOD (differentiated limits)
const limit = getUserTierLimit(userId);
```

#### ❌ 6. Blocking Legitimate Users During Attacks

```javascript
// BAD (collateral damage)
if (systemLoad > 80) {
  return reject(); // Blocks everyone
}

// GOOD (targeted blocking)
if (systemLoad > 80) {
  const suspiciousScore = await getSuspiciousScore(userId);
  if (suspiciousScore > threshold) {
    return reject();
  }
}
```

---

## Performance & Scalability

### Performance Optimization Techniques

#### 1. Lua Scripts for Atomic Operations

Instead of multiple Redis calls:
```javascript
// BAD: 3 round trips
const count = await redis.get(key);
const newCount = parseInt(count || '0') + 1;
await redis.set(key, newCount);
await redis.expire(key, ttl);
```

Use Lua script:
```javascript
// GOOD: 1 round trip
const luaScript = `
  local count = redis.call('INCR', KEYS[1])
  if count == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
  end
  return count
`;

const count = await redis.eval(luaScript, 1, key, ttl);
```

**Performance gain:** 3x faster (1 vs 3 network round trips)

#### 2. Connection Pooling

```javascript
// BAD: New connection per request
const redis = new Redis({ host: 'redis-host' });
await redis.incr(key);
await redis.quit();

// GOOD: Connection pool
const pool = new RedisPool({
  host: 'redis-host',
  min: 10,
  max: 100
});

const redis = await pool.acquire();
await redis.incr(key);
pool.release(redis);
```

#### 3. Pipeline Batch Operations

```javascript
// BAD: Sequential requests
await redis.incr('user:1');
await redis.incr('user:2');
await redis.incr('user:3');
// 3 round trips

// GOOD: Pipelined
const pipeline = redis.pipeline();
pipeline.incr('user:1');
pipeline.incr('user:2');
pipeline.incr('user:3');
await pipeline.exec();
// 1 round trip
```

**Performance gain:** 10-100x faster for batch operations

#### 4. Local Cache with Redis Fallback

```javascript
class CachedRateLimiter {
  private localCache = new LRU({ max: 10000 });
  
  async check(userId: string): Promise<boolean> {
    // Check local cache first (microseconds)
    const cached = this.localCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.remaining > 0;
    }
    
    // Fall back to Redis (milliseconds)
    const result = await redis.checkLimit(userId);
    
    // Cache for 1 second
    this.localCache.set(userId, {
      remaining: result.remaining,
      expiresAt: Date.now() + 1000
    });
    
    return result.allowed;
  }
}
```

**Trade-off:** Slightly less accurate but 100x faster for hot keys

#### 5. Probabilistic Data Structures

For very high-scale approximate counting:

```javascript
// Use HyperLogLog for unique user counting
await redis.pfadd('unique-users:today', userId);
const uniqueUsers = await redis.pfcount('unique-users:today');

// Use Bloom Filter for membership testing
const bloomFilter = new BloomFilter(1000000, 0.01);
if (!bloomFilter.contains(userId)) {
  bloomFilter.add(userId);
  // First request from this user
}
```

### Scalability Considerations

#### Horizontal Scaling Strategy

```
┌──────────────────────────────────────────────────────────┐
│                    Load Balancer                          │
│            (with sticky sessions if needed)              │
└──────────────────────────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Rate Limit  │  │  Rate Limit  │  │  Rate Limit  │
│   Service 1  │  │   Service 2  │  │   Service 3  │
└──────────────┘  └──────────────┘  └──────────────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
    ┌──────────────────┐      ┌──────────────────┐
    │  Redis Cluster   │      │  Config Store    │
    │  (Sharded)       │      │  (DynamoDB)      │
    └──────────────────┘      └──────────────────┘
```

**Scaling Dimensions:**

1. **More Rate Limit Service Instances**
   - Stateless design
   - Easy horizontal scaling
   - Load balancer distributes traffic

2. **Redis Cluster Sharding**
   - Shard by user ID
   - Each shard handles subset of users
   - Consistent hashing for distribution

3. **Read Replicas**
   - Master for writes (INCR)
   - Replicas for reads (GET)
   - Eventual consistency acceptable

**Capacity Planning:**

For 100K requests/second:
```
Assumptions:
- Average rate limit check: 2ms Redis latency
- Each server can handle: 1000 concurrent requests
- Peak traffic: 2x average = 200K req/sec

Calculation:
Servers needed = (200K req/sec * 0.002 sec) / 1000 = 400 / 1000 = 0.4
Add overhead (50%): 0.4 * 1.5 = 0.6 servers

Minimum: 3 servers (for HA)
Recommended: 5-10 servers (for headroom)

Redis instances:
Ops per second = 200K * 2 (read + write) = 400K ops/sec
Redis capacity = ~100K ops/sec per instance
Shards needed = 400K / 100K = 4 shards
With replication (3x): 12 Redis instances
```

---

## Common Interview Questions

### Q1: Explain the difference between Fixed Window and Sliding Window rate limiting.

**Answer:**

**Fixed Window:**
- Time divided into discrete windows
- Counter resets at window boundary
- Simple but has burst problem at edges
- Example: Can get 200 requests in 2 seconds (100 at 59s, 100 at 60s)

**Sliding Window:**
- Continuous time window that moves with each request
- No hard resets
- More accurate but more expensive
- Example: Truly enforces 100 requests per 60 seconds

**Visual Example:**
```
Fixed Window (100 req/min):
|---- Window 1 ----|---- Window 2 ----|
0s    60s          60s   120s
[99 req at 59s] + [100 req at 60s] = 199 req in 1 second ❌

Sliding Window:
At 60s: Count requests from [0s-60s] = 99 ✓
At 61s: Count requests from [1s-61s] = 100 ✓
```

### Q2: How would you implement rate limiting without a database?

**Answer:**

Use in-memory storage with proper cleanup:

```javascript
class InMemoryRateLimiter {
  private requests: Map<string, Array<number>> = new Map();
  
  check(userId: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Get user's request history
    let userRequests = this.requests.get(userId) || [];
    
    // Remove old requests outside window
    userRequests = userRequests.filter(timestamp => timestamp > windowStart);
    
    // Check limit
    if (userRequests.length >= limit) {
      return false; // Rate limited
    }
    
    // Add current request
    userRequests.push(now);
    this.requests.set(userId, userRequests);
    
    return true; // Allowed
  }
  
  // Periodic cleanup to prevent memory leaks
  cleanup(): void {
    const now = Date.now();
    for (const [userId, timestamps] of this.requests.entries()) {
      const valid = timestamps.filter(t => t > now - 3600000); // Keep 1 hour
      if (valid.length === 0) {
        this.requests.delete(userId);
      } else {
        this.requests.set(userId, valid);
      }
    }
  }
}

// Run cleanup every 5 minutes
setInterval(() => limiter.cleanup(), 5 * 60 * 1000);
```

**Limitations:**
- Not distributed (each server has own state)
- Lost on restart
- Memory constraints

### Q3: What happens if Redis goes down? How do you handle it?

**Answer:**

**Strategies:**

1. **Fail Open (Allow requests):**
```javascript
try {
  const allowed = await redis.checkLimit(userId);
  return allowed;
} catch (error) {
  logger.error('Redis down, failing open');
  return true; // Allow request
}
```

Pros: Better availability
Cons: Risk of abuse

2. **Fail Closed (Reject requests):**
```javascript
try {
  const allowed = await redis.checkLimit(userId);
  return allowed;
} catch (error) {
  logger.error('Redis down, failing closed');
  return false; // Reject request
}
```

Pros: Better security
Cons: Poor availability

3. **Fallback to Local Rate Limiting:**
```javascript
try {
  return await redis.checkLimit(userId);
} catch (error) {
  logger.warn('Redis down, using local limiter');
  return await localLimiter.check(userId, {
    limit: config.limit * 2 // More lenient
  });
}
```

Pros: Balance of availability and security
Cons: Can exceed global limits

4. **Redis HA (Best Solution):**
- Redis Sentinel (automatic failover)
- Redis Cluster (distributed)
- Replicas for read resilience

```javascript
const redis = new Redis({
  sentinels: [
    { host: 'sentinel1', port: 26379 },
    { host: 'sentinel2', port: 26379 },
    { host: 'sentinel3', port: 26379 }
  ],
  name: 'mymaster'
});
```

**Recommendation:** 
- Use Redis HA (Sentinel/Cluster)
- Implement circuit breaker
- Fail open for non-critical, fail closed for critical endpoints

### Q4: How do you prevent race conditions in distributed rate limiting?

**Answer:**

**The Problem:**
```
Server 1: Read count = 99  ┐
Server 2: Read count = 99  ├─ Race condition!
Server 1: Write count = 100┤
Server 2: Write count = 100┘ Both think they're request #100
Result: 101 requests allowed (exceeded limit of 100)
```

**Solutions:**

1. **Atomic Operations (Best for Redis):**
```javascript
// Use INCR (atomic in Redis)
const count = await redis.incr(key);
if (count > limit) {
  // Exceeded, but already incremented
  // Option: DECR to undo, or accept slight overflow
}
```

2. **Distributed Locks:**
```javascript
const lock = await redlock.lock(`lock:${userId}`, 1000);
try {
  const count = await redis.get(key);
  if (count < limit) {
    await redis.incr(key);
    return true;
  }
  return false;
} finally {
  await lock.unlock();
}
```

3. **Optimistic Locking (for databases):**
```javascript
const result = await db.query(`
  UPDATE rate_limits 
  SET count = count + 1 
  WHERE user_id = ? AND count < ? AND version = ?
`, [userId, limit, currentVersion]);

if (result.affectedRows === 0) {
  // Either exceeded or version mismatch (race condition)
  return false;
}
```

4. **Lua Scripts (Redis):**
```lua
local current = redis.call('GET', KEYS[1])
if current == false or tonumber(current) < tonumber(ARGV[1]) then
  redis.call('INCR', KEYS[1])
  return 1
else
  return 0
end
```

**Best Practice:** Use Redis atomic operations (INCR/DECR)

### Q5: How would you implement different rate limits for different user tiers?

**Answer:**

```javascript
interface TierConfig {
  name: string;
  limits: {
    perMinute: number;
    perHour: number;
    perDay: number;
  };
}

const tiers: Record<string, TierConfig> = {
  free: {
    name: 'Free',
    limits: { perMinute: 10, perHour: 100, perDay: 1000 }
  },
  pro: {
    name: 'Pro',
    limits: { perMinute: 100, perHour: 5000, perDay: 50000 }
  },
  enterprise: {
    name: 'Enterprise',
    limits: { perMinute: -1, perHour: -1, perDay: -1 } // Unlimited
  }
};

class TieredRateLimiter {
  async check(userId: string): Promise<RateLimitResult> {
    // Get user tier
    const tier = await this.getUserTier(userId);
    const config = tiers[tier];
    
    // Skip check for unlimited
    if (config.limits.perMinute === -1) {
      return { allowed: true, tier: config.name };
    }
    
    // Check all time windows
    const checks = await Promise.all([
      this.checkWindow(userId, 'minute', config.limits.perMinute),
      this.checkWindow(userId, 'hour', config.limits.perHour),
      this.checkWindow(userId, 'day', config.limits.perDay)
    ]);
    
    // All must pass
    const blocked = checks.find(c => !c.allowed);
    if (blocked) {
      return {
        allowed: false,
        tier: config.name,
        limitType: blocked.window,
        retryAfter: blocked.retryAfter
      };
    }
    
    return {
      allowed: true,
      tier: config.name,
      remaining: Math.min(...checks.map(c => c.remaining))
    };
  }
  
  private async checkWindow(
    userId: string,
    window: string,
    limit: number
  ): Promise<WindowCheckResult> {
    const key = `limit:${userId}:${window}`;
    const ttl = window === 'minute' ? 60 : window === 'hour' ? 3600 : 86400;
    
    const count = await redis.incr(key);
    await redis.expire(key, ttl);
    
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      window,
      retryAfter: ttl
    };
  }
}
```

**Key Points:**
- Check multiple time windows
- Different limits per tier
- Support unlimited tier
- Return which limit was exceeded

### Q6: Explain how you would test a rate limiter.

**Answer:**

**Test Categories:**

1. **Unit Tests:**
```javascript
describe('FixedWindowStrategy', () => {
  it('should allow requests within limit', async () => {
    const storage = new MemoryStorage();
    const strategy = new FixedWindowStrategy();
    
    // First request
    const result1 = await strategy.checkLimit('user1', { limit: 3, windowSeconds: 60 }, storage);
    expect(result1.allowed).toBe(true);
    expect(result1.remaining).toBe(2);
    
    // Second request
    const result2 = await strategy.checkLimit('user1', { limit: 3, windowSeconds: 60 }, storage);
    expect(result2.allowed).toBe(true);
    expect(result2.remaining).toBe(1);
    
    // Third request
    const result3 = await strategy.checkLimit('user1', { limit: 3, windowSeconds: 60 }, storage);
    expect(result3.allowed).toBe(true);
    expect(result3.remaining).toBe(0);
    
    // Fourth request (should be blocked)
    const result4 = await strategy.checkLimit('user1', { limit: 3, windowSeconds: 60 }, storage);
    expect(result4.allowed).toBe(false);
  });
  
  it('should reset after window expires', async () => {
    // Test with time manipulation
  });
  
  it('should handle concurrent requests correctly', async () => {
    // Test race conditions
  });
});
```

2. **Integration Tests:**
```javascript
describe('RateLimiter with Redis', () => {
  let redis: Redis;
  
  beforeAll(async () => {
    redis = await createRedisClient();
  });
  
  afterEach(async () => {
    await redis.flushdb(); // Clean up
  });
  
  it('should work across multiple instances', async () => {
    const storage1 = new RedisStorage(redis);
    const storage2 = new RedisStorage(redis);
    
    const limiter1 = new RateLimiter(storage1, new FixedWindowStrategy());
    const limiter2 = new RateLimiter(storage2, new FixedWindowStrategy());
    
    // Request from instance 1
    await limiter1.check('user1', { limit: 2, windowSeconds: 60 });
    
    // Request from instance 2
    await limiter2.check('user1', { limit: 2, windowSeconds: 60 });
    
    // Third request should be blocked
    const result = await limiter1.check('user1', { limit: 2, windowSeconds: 60 });
    expect(result.allowed).toBe(false);
  });
});
```

3. **Load Tests:**
```javascript
// Using k6 or similar
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  stages: [
    { duration: '1m', target: 100 }, // Ramp up
    { duration: '5m', target: 100 }, // Sustained load
    { duration: '1m', target: 0 },   // Ramp down
  ],
};

export default function () {
  const res = http.get('http://api.example.com/endpoint');
  
  check(res, {
    'status is 200 or 429': (r) => r.status === 200 || r.status === 429,
    'rate limit headers present': (r) => 
      r.headers['X-RateLimit-Limit'] !== undefined,
  });
}
```

4. **Chaos Tests:**
```javascript
// Test Redis failures
it('should handle Redis failures gracefully', async () => {
  const redis = new Redis();
  const storage = new RedisStorage(redis);
  const limiter = new RateLimiter(storage, new FixedWindowStrategy());
  
  // Disconnect Redis
  await redis.disconnect();
  
  // Should fail gracefully (fail open or closed based on config)
  const result = await limiter.check('user1', { limit: 10, windowSeconds: 60 });
  
  // Verify expected failure behavior
  expect(result).toBeDefined();
});
```

**Key Test Scenarios:**
- Basic allow/block
- Window expiration
- Concurrent requests
- Distributed consistency
- Failure handling
- Performance under load
- Edge cases (clock skew, network partitions)

---

## Conclusion

Rate limiting is a critical component of modern distributed systems. Key takeaways for SDE2 interviews:

**Core Principles:**
1. Understand trade-offs between algorithms
2. Consider distributed system challenges
3. Plan for failures and edge cases
4. Monitor and iterate based on real-world behavior

**Common Patterns:**
- Token Bucket for bursty traffic
- Sliding Window Counter for production APIs
- Multi-layer rate limiting (CDN + Gateway + Application)
- Tiered limits for business models

**System Design Approach:**
1. Clarify requirements (scale, accuracy, distribution)
2. Choose appropriate algorithm and storage
3. Handle edge cases (failures, race conditions)
4. Design for monitoring and operational visibility
5. Plan for evolution (changing limits, new tiers)

**Remember:**
- There's no one-size-fits-all solution
- Context matters (scale, accuracy requirements, resources)
- Start simple, iterate based on needs
- Always measure and monitor

Good luck with your SDE2 interview! 🚀
