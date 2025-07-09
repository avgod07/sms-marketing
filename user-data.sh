#!/bin/bash

# EC2 User Data Script - Runs on instance startup
set -e

# Update system
apt-get update
apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
usermod -aG docker ubuntu

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Install AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
./aws/install

# Create app directory
mkdir -p /opt/sms-app
cd /opt/sms-app

# Create environment file template (will be updated later)
cat > .env.production << 'EOF'
# Database
DATABASE_URL=postgres://smsadmin:CHANGE_ME@CHANGE_ME:5432/smsapp

# Authentication (Clerk)
CLERK_PUBLISHABLE_KEY=CHANGE_ME
CLERK_SECRET_KEY=CHANGE_ME
VITE_CLERK_PUBLISHABLE_KEY=CHANGE_ME

# Payment Processing (Stripe)
STRIPE_SECRET_KEY=CHANGE_ME
STRIPE_WEBHOOK_SECRET=CHANGE_ME

# SMS Service (Twilio)
TWILIO_ACCOUNT_SID=CHANGE_ME
TWILIO_AUTH_TOKEN=CHANGE_ME
TWILIO_PHONE_NUMBER=CHANGE_ME

# AWS S3 for Image Storage
AWS_ACCESS_KEY_ID=CHANGE_ME
AWS_SECRET_ACCESS_KEY=CHANGE_ME
AWS_S3_REGION=us-east-1
AWS_S3_BUCKET_NAME=CHANGE_ME
AWS_S3_PUBLIC_URL_BASE=CHANGE_ME

# Security
ENCRYPTION_KEY=CHANGE_ME

# Application
NODE_ENV=production
PORT=5000
LOG_LEVEL=info
EOF

# Create systemd service for the app
cat > /etc/systemd/system/sms-app.service << 'EOF'
[Unit]
Description=SMS Marketing App
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/sms-app
ExecStart=/usr/local/bin/docker-compose -f docker-compose.prod.yml up -d
ExecStop=/usr/local/bin/docker-compose -f docker-compose.prod.yml down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

# Enable the service (but don't start yet - needs env vars)
systemctl enable sms-app.service

# Install nginx for reverse proxy
apt-get install -y nginx

# Configure nginx
cat > /etc/nginx/sites-available/sms-app << 'EOF'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /api/health {
        access_log off;
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
    }
}
EOF

# Enable the site
ln -sf /etc/nginx/sites-available/sms-app /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Start nginx
systemctl enable nginx
systemctl start nginx

# Create log rotation
cat > /etc/logrotate.d/sms-app << 'EOF'
/opt/sms-app/logs/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 644 ubuntu ubuntu
}
EOF

# Create a simple health check script
cat > /opt/sms-app/health-check.sh << 'EOF'
#!/bin/bash
curl -f http://localhost:5000/api/health > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "healthy"
    exit 0
else
    echo "unhealthy"
    exit 1
fi
EOF

chmod +x /opt/sms-app/health-check.sh

echo "User data script completed successfully!"
echo "IMPORTANT: Update .env.production with your actual environment variables before starting the app!" 