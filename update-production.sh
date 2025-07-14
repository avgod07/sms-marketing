#!/bin/bash

# Quick Production Update Script
set -e

echo "🚀 Starting production update..."

# Build production package
echo "📦 Creating production package..."
tar --exclude='node_modules' \
    --exclude='*.test.ts' \
    --exclude='*.test.tsx' \
    --exclude='*.test.js' \
    --exclude='server/integration' \
    --exclude='.git' \
    --exclude='dist' \
    --exclude='logs' \
    --exclude='*.log' \
    --exclude='.DS_Store' \
    --exclude='awscliv2.zip' \
    --exclude='attached_assets' \
    --exclude='.devcontainer' \
    --exclude='docs' \
    --exclude='README.md' \
    --exclude='LICENSE' \
    --exclude='AGENTS.md' \
    --exclude='.replit' \
    --exclude='DEPLOYMENT_GUIDE.md' \
    --exclude='deploy.sh' \
    --exclude='teardown.sh' \
    --exclude='user-data.sh' \
    --exclude='test-trial-ending.js' \
    --exclude='generated-icon.png' \
    -czf sms-app-production.tar.gz .

# Copy to server
echo "📤 Uploading to server..."
scp -i sms-app-production-key.pem sms-app-production.tar.gz ec2-user@44.192.121.2:/tmp/

# Clean up local package
rm sms-app-production.tar.gz

# Update on server
echo "🔄 Updating on server..."
ssh -i sms-app-production-key.pem ec2-user@44.192.121.2 << 'ENDSSH'
cd /opt/sms-app
sudo docker-compose -f docker-compose.prod.yml down
tar -xzf /tmp/sms-app-production.tar.gz
rm /tmp/sms-app-production.tar.gz
sudo docker-compose -f docker-compose.prod.yml up -d --build
echo "✅ Containers started successfully!"
sudo docker ps
ENDSSH

echo "✅ Production update complete!"
echo "🌐 Check: http://44.192.121.2/api/health" 