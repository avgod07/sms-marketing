# 🚀 SMS MARKETING APP - COMPLETE DEPLOYMENT GUIDE

## **STEP-BY-STEP GUIDE TO DEPLOY YOUR SMS MARKETING APPLICATION**

This guide will walk you through deploying your SMS marketing application to AWS with exact commands and instructions. Follow each step carefully.

---

## **PHASE 1: PREPARATION (30 minutes)**

### **Step 1: Verify Your Local Environment**

Open your terminal and run these commands to ensure everything is ready:

```bash
# Check if you're in the correct directory
pwd
# Should show: /workspace

# Check if all files exist
ls -la
# Should show: package.json, Dockerfile, deploy.sh, etc.

# Check Node.js version
node --version
# Should be 20.x or higher

# Check if dependencies are installed
ls node_modules
# Should show many folders
```

### **Step 2: Install Required Tools**

If you don't have these tools installed, install them now:

```bash
# Install AWS CLI (if not already installed) [FOR ARM64 (aarch64) LINUX]
curl "https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# If updating an existing install, use:
# sudo ./aws/install --bin-dir /usr/local/bin --install-dir /usr/local/aws-cli --update

# Verify AWS CLI installation
aws --version
# Should show aws-cli/2.x.x ... Linux/aarch64 ...

# Install Docker (if not already installed)
sudo apt-get update
sudo apt-get install docker.io docker-compose
sudo systemctl start docker
sudo systemctl enable docker

# Verify Docker installation
docker --version
docker-compose --version
```

> **Note:** These instructions are for ARM64 (aarch64) Linux systems. If you are on a different architecture, download the appropriate AWS CLI installer from the [official AWS CLI documentation](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html).

---

## **PHASE 2: AWS ACCOUNT SETUP (45 minutes)**

### **Step 1: Create AWS Account**

1. **Open your web browser** and go to [aws.amazon.com](https://aws.amazon.com)
2. **Click "Create an AWS Account"** in the top right corner
3. **Fill in your email address** and choose a password
4. **Enter your personal information** (name, phone number, address)
5. **Add a credit card** for billing (AWS will charge ~$1 and refund it)
6. **Complete identity verification** (AWS will call your phone number)
7. **Choose a support plan** - select "Free" for now
8. **Wait for account activation** (usually 5-10 minutes)

### **Step 2: Set Up Billing Alerts**

1. **Log into AWS Console** with your new account
2. **Go to Billing Dashboard** (search "billing" in the search bar)
3. **Click "Billing preferences"** in the left sidebar
4. **Scroll down to "Billing Alerts"** and click "Manage billing alerts"
5. **Click "Create alert"**
6. **Set threshold to $100** and add your email
7. **Click "Create alert"**

### **Step 3: Create IAM User for Deployment**

1. **In AWS Console**, search for "IAM" and click on it
2. **Click "Users"** in the left sidebar
3. **Click "Create user"**
4. **Enter username**: `sms-app-deploy`
5. **Check "Access key - Programmatic access"**
6. **Click "Next: Permissions"**
7. **Click "Attach existing policies directly"**
8. **Search and select these policies**:
   - `AmazonEC2FullAccess`
   - `AmazonRDSFullAccess`
   - `AmazonS3FullAccess`
   - `ElasticLoadBalancingFullAccess`
   - `AmazonRoute53FullAccess`
   - `AmazonCertificateManagerFullAccess`
9. **Click "Next: Tags"** (skip tags)
10. **Click "Next: Review"**
11. **Click "Create user"**
12. **IMPORTANT**: Copy the Access Key ID and Secret Access Key - you'll need these!

### **Step 4: Configure AWS CLI**Im here

In your terminal, run:

```bash
aws configure
```

When prompted, enter:

- **AWS Access Key ID**: (paste the key you just copied)
- **AWS Secret Access Key**: (paste the secret you just copied)
- **Default region name**: `us-east-1`
- **Default output format**: `json`

Test the configuration:

```bash
aws sts get-caller-identity
```

You should see your account information.

---

## **PHASE 3: GET PRODUCTION API KEYS (1 hour)**

### **Step 1: Clerk Authentication Keys**

1. **Go to [clerk.com](https://clerk.com)** and sign in
2. **Click "Add application"** or select your existing app
3. **Go to "API Keys"** in the left sidebar
4. **Copy these keys**:
   - **Publishable Key** (starts with `pk_live_`)
   - **Secret Key** (starts with `sk_live_`)
5. **Write them down** - you'll need them later

### **Step 2: Stripe Payment Keys**

1. **Go to [stripe.com](https://stripe.com)** and sign in
2. **Switch to "Live" mode** (toggle in the top right)
3. **Go to "Developers" → "API Keys"**
4. **Copy these keys**:
   - **Secret Key** (starts with `sk_live_`)
   - **Publishable Key** (starts with `pk_live_`)
5. **Go to "Webhooks"** → **"Add endpoint"**

6. **Create ONE webhook endpoint in Stripe:**

   - **Endpoint URL:** `https://your-domain.com/api/webhooks/stripe`
   - **Select these events:**
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`

7. **Click "Add endpoint"**
8. **Copy the Webhook Secret** (starts with `whsec_`) for your environment variables.

### **Step 3: Twilio SMS Keys**

1. **Go to [twilio.com](https://twilio.com)** and sign in
2. **Go to Console Dashboard**
3. **Copy these from your account**:
   - **Account SID** (starts with `AC`)
   - **Auth Token** (from Account Info page)
   - **Phone Number** (your Twilio number)
4. **Write them down**

### **Step 4: Generate Encryption Key**

In your terminal, run:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the 64-character output - this is your encryption key.

---

## **PHASE 4: CREATE PRODUCTION ENVIRONMENT FILE (15 minutes)**

### **Step 1: Copy Environment Template**

```bash
# Make sure you're in the project directory
cd /workspace

# Copy the example file
cp env.production.example .env.production
```

### **Step 2: Edit Environment File**

```bash
# Open the file for editing
nano .env.production
```

### **Step 3: Fill in All Values**

Replace the entire content with this (replace the placeholder values with your actual keys):

```bash
# Database (we'll update this after AWS deployment)
DATABASE_URL=postgres://smsadmin:CHANGE_ME@CHANGE_ME:5432/smsapp

# Authentication (Clerk) - REPLACE WITH YOUR ACTUAL KEYS
CLERK_PUBLISHABLE_KEY=pk_live_your_actual_clerk_key_here
CLERK_SECRET_KEY=sk_live_your_actual_clerk_secret_here
VITE_CLERK_PUBLISHABLE_KEY=pk_live_your_actual_clerk_key_here

# Payment Processing (Stripe) - REPLACE WITH YOUR ACTUAL KEYS
STRIPE_SECRET_KEY=sk_live_your_actual_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_actual_stripe_webhook_secret_here

# SMS Service (Twilio) - REPLACE WITH YOUR ACTUAL KEYS
TWILIO_ACCOUNT_SID=ACyour_actual_twilio_account_sid_here
TWILIO_AUTH_TOKEN=your_actual_twilio_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890

# AWS S3 for Image Storage (we'll update this after AWS deployment)
AWS_ACCESS_KEY_ID=CHANGE_ME
AWS_SECRET_ACCESS_KEY=CHANGE_ME
AWS_S3_REGION=us-east-1
AWS_S3_BUCKET_NAME=CHANGE_ME
AWS_S3_PUBLIC_URL_BASE=CHANGE_ME

# Security - REPLACE WITH YOUR ACTUAL ENCRYPTION KEY
ENCRYPTION_KEY=your_64_character_encryption_key_here

# Application
NODE_ENV=production
PORT=5000
LOG_LEVEL=info
```

**Save the file**: Press `Ctrl+X`, then `Y`, then `Enter`

---

## **PHASE 5: TEST LOCAL BUILD (15 minutes)**

### **Step 1: Test Docker Build**

```bash
# Build the Docker image
docker build -t sms-app:latest .

# Wait for build to complete (this may take 5-10 minutes)
```

### **Step 2: Test Local Production Build**

```bash
# Run the container locally
docker run -p 5002:5000 --env-file .env.production sms-app:latest

# Wait for the application to start (you'll see logs)
```

### **Step 3: Verify Health Endpoint**

Open a new terminal window and run:

```bash
# Test the health endpoint
curl http://localhost:5000/api/health

# You should see: {"status":"ok","database":"healthy","timestamp":"..."}
```

If this works, stop the container:

```bash
# Go back to the terminal running the container
# Press Ctrl+C to stop it
```

---

## **PHASE 6: DEPLOY TO AWS (2-3 hours)**

### **Step 1: Make Deployment Script Executable**

```bash
# Make the script executable
chmod +x deploy.sh

# Verify it's executable
ls -la deploy.sh
# Should show: -rwxr-xr-x
```

### **Step 2: Run Deployment Script**

```bash
# Run the deployment script
./deploy.sh
```

**This script will:**

- Create an EC2 instance
- Create an RDS database
- Create an S3 bucket
- Create a load balancer
- Set up security groups
- Generate SSH key pair

**The script will take 15-30 minutes to complete.**

**IMPORTANT**: The script will output the information in this exact format at the end:

```
📋 Next steps:
1. SSH into your instance: ssh -i sms-app-key.pem ubuntu@YOUR_EC2_IP
2. Update your environment variables in .env.production
3. Set up your domain DNS to point to the ALB
4. Configure SSL certificate in AWS Certificate Manager

🔗 Your app will be available at: http://YOUR_EC2_IP:5000
💰 Estimated monthly cost: ~$74

📊 Important Information:
RDS Endpoint: your-rds-endpoint.region.rds.amazonaws.com
Database Password: your_generated_password
S3 Bucket: your-sms-app-images-1234567890
```

### **Step 3: Note Critical Information**

When the script finishes, it will output important information. **WRITE THESE DOWN EXACTLY:**

```
📊 Important Information:
RDS Endpoint: your-rds-endpoint.region.rds.amazonaws.com
Database Password: your_generated_password
S3 Bucket: your-sms-app-images-1234567890
EC2 IP: 12.34.56.78
```

**IMPORTANT**: The script will also create a file called `sms-app-key.pem` - this is your SSH key to access the server!

### **Step 4: Update Environment Variables with Real Values**

```bash
# Edit the environment file
nano .env.production
```

Replace the placeholder values with your actual production data:

```bash
# Database (from deployment output)
DATABASE_URL=postgres://smsadmin:your_generated_password@your-rds-endpoint.region.rds.amazonaws.com:5432/smsapp

# AWS S3 (from deployment output)
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_S3_BUCKET_NAME=your-sms-app-images-1234567890
AWS_S3_PUBLIC_URL_BASE=https://your-sms-app-images-1234567890.s3.amazonaws.com
```

**Save the file**: Press `Ctrl+X`, then `Y`, then `Enter`

**CRITICAL NOTE**: Make sure your `ENCRYPTION_KEY` is exactly 64 characters long (32 bytes in hex). The command `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` generates exactly 64 characters.

### **Step 5: Deploy Application Code to Server**

```bash
# Copy your code to the EC2 server
scp -i sms-app-production-key.pem -r . ec2-user@44.192.121.2:/opt/sms-app/

ssh -i sms-app-production-key.pem ec2-user@44.192.121.2
sudo mkdir -p /opt/sms-app
sudo chown ec2-user:ec2-user /opt/sms-app
exit



# Replace YOUR_EC2_IP with the actual IP from the deployment output
# Note: The server already has a basic .env.production file, so this will overwrite it
```

### **Step 6: Start the Application on Server**

```bash
# SSH into your EC2 instance
ssh -i sms-app-production-key.pem ec2-user@44.192.121.2

chmod 400 sms-app-production-key.pem


# Navigate to the application directory
cd /opt/sms-app

# Start the application
docker-compose -f docker-compose.prod.yml up -d

# Check if it's running
docker-compose -f docker-compose.prod.yml ps

# Check logs
docker-compose -f docker-compose.prod.yml logs -f

# Test the health endpoint
curl http://localhost:5000/api/health
```

### **Step 7: Test the Deployment**

In a new terminal window:

```bash
# Test health endpoint via nginx (port 80)
curl http://YOUR_EC2_IP/api/health

# Test direct application port
curl http://YOUR_EC2_IP:5000/api/health

# Both should return: {"status":"ok","database":"healthy","timestamp":"..."}
```

---

## **PHASE 7: DOMAIN & SSL SETUP (1-2 hours)**

### **Step 1: Buy Domain (if needed)**

1. **Go to a domain registrar** (Namecheap, GoDaddy, or AWS Route 53)
2. **Search for your desired domain** (e.g., `yoursmsapp.com`)
3. **Purchase the domain** (usually $10-15/year)
4. **Note the domain name** - you'll need it

### **Step 2: Create Hosted Zone in Route 53**

1. **Go to AWS Console** → **Route 53** → **Hosted Zones**
2. **Click "Create Hosted Zone"**
3. **Enter your domain name** (e.g., `yoursmsapp.com`)
4. **Click "Create"**
5. **Note the 4 nameservers** - you'll need these

### **Step 3: Update Domain Nameservers**

1. **Go to your domain registrar** (where you bought the domain)
2. **Find "Nameservers" or "DNS Settings"**
3. **Change from default to custom nameservers**
4. **Enter the 4 nameservers** from Route 53
5. **Save the changes**
6. **Wait 15-60 minutes** for propagation

### **Step 4: Create SSL Certificate**

1. **Go to AWS Console** → **Certificate Manager**
2. **Click "Request Certificate"**
3. **Enter your domain**: `yoursmsapp.com`
4. **Add wildcard**: `*.yoursmsapp.com`
5. **Choose "DNS validation"**
6. **Click "Request"**

### **Step 5: Validate Certificate**

1. **In Certificate Manager**, click on your certificate
2. **Click "Create records in Route 53"**
3. **This will automatically create the validation records**
4. **Wait 5-30 minutes** for validation to complete

### **Step 6: Create DNS Records**

1. **Go to Route 53** → **Hosted Zones** → **your domain**
2. **Click "Create Record"**
3. **Enter**:
   - **Record name**: `@` (or leave blank)
   - **Record type**: `A`
   - **Alias**: Yes
   - **Route traffic to**: Application Load Balancer
   - **Region**: US East (N. Virginia)
   - **Load balancer**: Select your ALB
4. **Click "Create records"**

### **Step 7: Update Load Balancer for HTTPS**

1. **Go to EC2** → **Load Balancers**
2. **Select your ALB**
3. **Go to "Listeners" tab**
4. **Click "Add listener"**
5. **Enter**:
   - **Protocol**: HTTPS
   - **Port**: 443
   - **Default action**: Forward to your target group
   - **SSL Certificate**: Select your certificate
6. **Click "Add listener"**
7. **Delete the old HTTP:80 listener** (optional, but recommended)

---

## **PHASE 8: FINAL TESTING (1 hour)**

### **Step 1: Test HTTPS Access**

```bash
# Test HTTPS access
curl https://your-domain.com/api/health

# Should return: {"status":"ok","database":"healthy","timestamp":"..."}

# If HTTPS doesn't work yet, test HTTP first:
curl http://your-domain.com/api/health
```

### **Step 2: Test in Browser**

1. **Open your web browser**
2. **Go to**: `https://your-domain.com`
3. **Verify the site loads** with a green lock (HTTPS)
4. **Check that it looks professional**

### **Step 3: Test User Registration**

1. **Click "Sign Up"** on your live site
2. **Fill out the registration form**
3. **Verify email confirmation works**
4. **Test login functionality**

### **Step 4: Test SMS Functionality**

1. **Complete the onboarding process**
2. **Connect your Twilio account**
3. **Create a test campaign**
4. **Send a test SMS to your phone**

### **Step 5: Test Payment Processing**

1. **Try to upgrade to a paid plan**
2. **Test credit purchase**
3. **Verify Stripe webhooks work**
4. **Check that payments are processed**

### **Step 6: Test Image Upload**

1. **Create a campaign with an image**
2. **Verify image uploads to S3**
3. **Check that images display correctly**

---

## **PHASE 9: MONITORING SETUP (30 minutes)**

### **Step 1: Set Up CloudWatch Alarms**

```bash
# High CPU alarm
aws cloudwatch put-metric-alarm \
    --alarm-name "SMS-App-High-CPU" \
    --alarm-description "High CPU usage" \
    --metric-name CPUUtilization \
    --namespace AWS/EC2 \
    --statistic Average \
    --period 300 \
    --threshold 80 \
    --comparison-operator GreaterThanThreshold \
    --evaluation-periods 2

# High memory alarm
aws cloudwatch put-metric-alarm \
    --alarm-name "SMS-App-High-Memory" \
    --alarm-description "High memory usage" \
    --metric-name MemoryUtilization \
    --namespace AWS/EC2 \
    --statistic Average \
    --period 300 \
    --threshold 80 \
    --comparison-operator GreaterThanThreshold \
    --evaluation-periods 2
```

### **Step 2: Set Up Log Monitoring**

```bash
# SSH into your server
ssh -i sms-app-key.pem ubuntu@YOUR_EC2_IP

# Check application logs
cd /opt/sms-app
docker-compose -f docker-compose.prod.yml logs -f

# Check nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Check system logs
sudo journalctl -u sms-app.service -f
```

---

## **PHASE 10: FINAL CHECKLIST**

Before going live, verify everything works:

- [ ] **Application is live** at `https://your-domain.com`
- [ ] **HTTPS is working** (green lock in browser)
- [ ] **User registration works**
- [ ] **Login functionality works**
- [ ] **SMS sending works**
- [ ] **Payment processing works**
- [ ] **Image uploads work**
- [ ] **All features are functional**
- [ ] **Monitoring is set up**
- [ ] **Backup plan is ready**

---

## **🚨 TROUBLESHOOTING COMMANDS**

### **Application Issues:**

```bash
# Check if app is running
docker-compose -f docker-compose.prod.yml ps

# Restart app
docker-compose -f docker-compose.prod.yml restart

# Check logs
docker-compose -f docker-compose.prod.yml logs -f

# Check system status
systemctl status sms-app.service

# Check if nginx is running
systemctl status nginx

# Restart nginx if needed
sudo systemctl restart nginx
```

### **Database Issues:**

```bash
# Test database connection
psql $DATABASE_URL -c "SELECT 1;"

# Check RDS status
aws rds describe-db-instances --db-instance-identifier sms-app-db
```

### **Network Issues:**

```bash
# Test connectivity
curl -v http://localhost:5000/api/health
curl -v http://YOUR_EC2_IP/api/health
curl -v http://YOUR_EC2_IP:5000/api/health
curl -v https://your-domain.com/api/health

# Check nginx
systemctl status nginx
nginx -t

# Check security groups
aws ec2 describe-security-groups --group-names sms-app-sg
```

---

## **💰 COST BREAKDOWN**

- **EC2 t3.medium**: $30.40/month
- **RDS db.t3.micro**: $13.68/month
- **ALB**: $18.25/month
- **S3 + Data Transfer**: ~$10/month
- **Route 53**: $0.50/month
- **Total**: ~$73/month

---

## **🎯 SUCCESS METRICS**

- ✅ **Zero downtime** during operation
- ✅ **All features working** flawlessly
- ✅ **Fast response times** (<2 seconds)
- ✅ **Professional appearance** with HTTPS
- ✅ **Mobile-responsive** design
- ✅ **Scalable architecture** for growth

---

**🎉 CONGRATULATIONS! Your SMS marketing platform is now live and ready for business!**

Your application is now:

- **Securely deployed** on AWS
- **SSL protected** with HTTPS
- **Fully functional** with all features
- **Production ready** for real customers
- **Professionally presented** with a custom domain

You can now start marketing your SMS platform to businesses and begin generating revenue!
