#!/bin/bash

# Verification Script for Production Deployment
set -e

echo "🔍 Verifying production deployment..."

# Check if server is responding
echo "📡 Checking server health..."
if curl -s http://44.192.121.2:5000/api/health > /dev/null; then
    echo "✅ Server is responding"
else
    echo "❌ Server is not responding"
    exit 1
fi

# Check which Clerk key is being used in the build
echo "🔑 Checking Clerk key in deployment..."
ssh -i sms-app-production-key.pem ec2-user@44.192.121.2 << 'ENDSSH'
cd /opt/sms-app

echo "=== Environment Files Check ==="
echo "📄 .env.production exists: $([ -f .env.production ] && echo "✅ Yes" || echo "❌ No")"
echo "📄 .env.production VITE_CLERK_PUBLISHABLE_KEY:"
if [ -f .env.production ]; then
    grep VITE_CLERK_PUBLISHABLE_KEY .env.production | cut -d'=' -f2 | head -1
else
    echo "❌ File not found"
fi

echo ""
echo "=== Docker Compose Configuration ==="
echo "🐳 Docker Compose build args:"
sudo docker-compose -f docker-compose.prod.yml config 2>/dev/null | grep -A2 -B2 "VITE_CLERK_PUBLISHABLE_KEY" || echo "❌ Could not parse docker-compose config"

echo ""
echo "=== Built Assets Check ==="
echo "🔍 Checking built assets for Clerk keys..."

# Check for test keys (should not be present)
if find . -name "*.js" -path "*/dist/*" -exec grep -l "pk_test_" {} \; 2>/dev/null | head -1 > /dev/null; then
    echo "❌ FOUND TEST KEY in built files!"
    find . -name "*.js" -path "*/dist/*" -exec grep -o "pk_test_[^\"']*" {} \; 2>/dev/null | head -1 || echo "Could not extract test key"
else
    echo "✅ No test keys found in built files"
fi

# Check for live keys (should be present)
if find . -name "*.js" -path "*/dist/*" -exec grep -l "pk_live_" {} \; 2>/dev/null | head -1 > /dev/null; then
    echo "✅ FOUND LIVE KEY in built files!"
    find . -name "*.js" -path "*/dist/*" -exec grep -o "pk_live_[^\"']*" {} \; 2>/dev/null | head -1 || echo "Could not extract live key"
else
    echo "❌ No live keys found in built files"
fi

echo ""
echo "=== Container Status ==="
echo "📊 Container status:"
sudo docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

ENDSSH

echo ""
echo "🎯 Verification complete!"
echo ""
echo "✅ SUCCESS indicators:"
echo "  - Server responding"
echo "  - No test keys in built files"
echo "  - Live key found in built files"
echo "  - Container running"
echo ""
echo "❌ If you see any failures above, redeploy with: ./update-production.sh" 