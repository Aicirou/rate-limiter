import { createClient } from 'redis';
import { RedisStorage } from '../storage/redis.storage';
import { MemoryStorage } from '../storage/memory.storage';
import { RateLimiter } from '../rate-limiter';
import { FixedWindowStrategy } from '../strategies/fixed-window.strategy';
import { StorageMonitor } from '../utils/storage-monitor';

async function main() {
  console.log('🚀 Starting Dual Storage Comparison\n');
  console.log('=' .repeat(80));

  // Setup Redis
  const redisClient = createClient({
    socket: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    },
  });

  redisClient.on('error', (err: Error) => console.error('Redis Client Error', err));
  await redisClient.connect();
  console.log('✅ Connected to Redis\n');

  // Create storage with monitoring
  const redisStorage = new StorageMonitor(
    new RedisStorage(redisClient),
    '🔴 REDIS   '
  );

  const memoryStorage = new StorageMonitor(
    new MemoryStorage(),
    '💾 MEMORY  '
  );

  // Create rate limiters
  const strategy = new FixedWindowStrategy();
  const redisLimiter = new RateLimiter(redisStorage, strategy);
  const memoryLimiter = new RateLimiter(memoryStorage, strategy);

  const config = {
    limit: 5,
    windowSeconds: 60,
  };

  console.log('📊 Running parallel rate limit checks...\n');
  console.log('=' .repeat(80));

  // Run parallel requests
  for (let i = 1; i <= 7; i++) {
    console.log(`\n--- Request ${i} ---`);
    
    const [redisResult, memoryResult] = await Promise.all([
      redisLimiter.check('user-123', config),
      memoryLimiter.check('user-123', config),
    ]);

    console.log(`\nResults:`);
    console.log(`  Redis  - Allowed: ${redisResult.allowed}, Remaining: ${redisResult.remaining}`);
    console.log(`  Memory - Allowed: ${memoryResult.allowed}, Remaining: ${memoryResult.remaining}`);
    
    // Small delay for readability
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n🧹 Cleaning up...');
  await redisClient.quit();
  console.log('✅ Done');
}

main().catch(console.error);
