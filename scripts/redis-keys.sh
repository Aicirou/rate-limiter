#!/bin/bash

# Redis Keys Watcher
# Continuously displays all keys in Redis

echo "🔍 Redis Keys Watcher"
echo "Refreshing every 2 seconds..."
echo "Press Ctrl+C to stop"
echo ""

watch_redis() {
    while true; do
        clear
        echo "=== Redis Keys at $(date) ==="
        echo ""
        
        if docker ps | grep -q "rate-limiter-redis"; then
            # Get all keys
            echo "📋 All Keys:"
            docker exec rate-limiter-redis redis-cli KEYS "*"
            echo ""
            
            # Get key details
            echo "📊 Key Details:"
            for key in $(docker exec rate-limiter-redis redis-cli KEYS "*"); do
                type=$(docker exec rate-limiter-redis redis-cli TYPE "$key")
                ttl=$(docker exec rate-limiter-redis redis-cli TTL "$key")
                value=$(docker exec rate-limiter-redis redis-cli GET "$key" 2>/dev/null || echo "N/A")
                echo "  $key"
                echo "    Type: $type | TTL: $ttl | Value: $value"
            done
        else
            echo "❌ Redis container not running"
            echo "Start with: docker-compose up redis -d"
        fi
        
        echo ""
        echo "=== Refreshing in 2 seconds... ==="
        sleep 2
    done
}

# Check if watch command exists, otherwise use loop
if command -v watch &> /dev/null; then
    watch -n 2 'docker exec rate-limiter-redis redis-cli KEYS "*" && echo "" && docker exec rate-limiter-redis redis-cli --scan | while read key; do echo "$key: $(docker exec rate-limiter-redis redis-cli GET "$key" 2>/dev/null || echo "N/A")"; done'
else
    watch_redis
fi
