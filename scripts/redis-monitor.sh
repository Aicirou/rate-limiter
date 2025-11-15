#!/bin/bash

# Redis Monitor Script
# Monitors Redis operations in real-time

echo "🔴 Redis Monitor - Watching all operations..."
echo "Press Ctrl+C to stop"
echo ""

# Connect to Redis and monitor all commands
if command -v redis-cli &> /dev/null; then
    # Check if Redis is running in Docker
    if docker ps | grep -q "rate-limiter-redis"; then
        echo "Connecting to Docker Redis container..."
        docker exec -it rate-limiter-redis redis-cli MONITOR
    else
        # Connect to local Redis
        redis-cli -h ${REDIS_HOST:-localhost} -p ${REDIS_PORT:-6379} MONITOR
    fi
else
    echo "❌ redis-cli not found. Please install Redis CLI or run:"
    echo "   docker exec -it rate-limiter-redis redis-cli MONITOR"
fi
