# 🚀 SMS MARKETING APP - COMPLETE DEPLOYMENT GUIDE

## **STEP-BY-STEP GUIDE TO GO LIVE FOR 15 BUSINESSES**

---

## **PHASE 1: AWS ACCOUNT SETUP (30 minutes)**

### **Step 1: Create AWS Account**

1. Go to [aws.amazon.com](https://aws.amazon.com)
2. Click "Create an AWS Account"
3. Fill in your details and credit card
4. **IMPORTANT**: Set up billing alerts for $100 threshold

### **Step 2: Create IAM User**

1. Go to AWS Console → IAM → Users → Create User
2. Name: `sms-app-deploy`
3. Attach these policies:
   - `AmazonEC2FullAccess`
   - `AmazonRDSFullAccess`
   - `AmazonS3FullAccess`
   - `AmazonELBFullAccess`
   - `AmazonRoute53FullAccess`
4. Create access keys and download them

### **Step 3: Install AWS CLI**

```bash
# On Mac
brew install awscli

# On Windows
# Download from AWS website

# On Linux
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
```

### **Step 4: Configure AWS CLI**

```bash
aws configure
# Enter your access key ID
# Enter your secret access key
# Region: us-east-1
# Output format: json
```

---

## **PHASE 2: GET PRODUCTION API KEYS (1 hour)**

### **Step 1: Clerk Production Keys**

1. Go to [clerk.com](https://clerk.com) dashboard
2. Create new application or use existing
3. Go to API Keys section
4. Copy these keys:
   - **Publishable Key** (starts with `pk_live_`)
   - **Secret Key** (starts with `sk_live_`)

### **Step 2: Stripe Production Keys**

1. Go to [stripe.com](https://stripe.com) dashboard
2. Switch to "Live" mode (not test)
3. Go to Developers → API Keys
4. Copy these keys:
   - **Secret Key** (starts with `sk_live_`)
   - **Publishable Key** (starts with `pk_live_`)
5. Go to Webhooks → Add endpoint
   - URL: `https://your-domain.com/api/webhooks/stripe`
   - Events: `payment_intent.succeeded`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
6. Copy the **Webhook Secret** (starts with `whsec_`)

### **Step 3: Twilio Production Keys**

1. Go to [twilio.com](https://twilio.com) console
2. Copy these from your account:
   - **Account SID** (starts with `AC`)
   - **Auth Token** (from Account Info page)
   - **Phone Number** (your Twilio number)

### **Step 4: Generate Encryption Key**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the 64-character output.

---

## **PHASE 3: CREATE PRODUCTION ENVIRONMENT FILE (15 minutes)**

### **Step 1: Create .env.production**

```bash
# Create the file
cp env.production.example .env.production
```

### **Step 2: Fill in .env.production**

Replace all values in `.env.production`:

```bash
# Database (will be filled after AWS deployment)
DATABASE_URL=postgres://smsadmin:CHANGE_ME@CHANGE_ME:5432/smsapp

# Authentication (Clerk)
CLERK_PUBLISHABLE_KEY=pk_live_your_actual_key_here
CLERK_SECRET_KEY=sk_live_your_actual_key_here
VITE_CLERK_PUBLISHABLE_KEY=pk_live_your_actual_key_here

# Payment Processing (Stripe)
STRIPE_SECRET_KEY=sk_live_your_actual_stripe_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_actual_webhook_secret_here

# SMS Service (Twilio)
TWILIO_ACCOUNT_SID=ACyour_actual_account_sid_here
TWILIO_AUTH_TOKEN=your_actual_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890

# AWS S3 for Image Storage (will be filled after AWS deployment)
AWS_ACCESS_KEY_ID=CHANGE_ME
AWS_SECRET_ACCESS_KEY=CHANGE_ME
AWS_S3_REGION=us-east-1
AWS_S3_BUCKET_NAME=CHANGE_ME
AWS_S3_PUBLIC_URL_BASE=CHANGE_ME

# Security
ENCRYPTION_KEY=your_64_character_encryption_key_here

# Application
NODE_ENV=production
PORT=5000
LOG_LEVEL=info
```

---

## **PHASE 4: TEST LOCAL BUILD (15 minutes)**

### **Step 1: Test Docker Build**

```bash
docker build -t sms-app:latest .
```

### **Step 2: Test Local Production Build**

```bash
docker run -p 5000:5000 --env-file .env.production sms-app:latest
```

### **Step 3: Verify Health Endpoint**

```bash
curl http://localhost:5000/api/health
# Should return: {"status":"ok"}
```

---

## **PHASE 5: DEPLOY TO AWS (2-3 hours)**

### **Step 1: Run Deployment Script**

```bash
# Make script executable
chmod +x deploy.sh

# Run the deployment
./deploy.sh
```

### **Step 2: Note Critical Information**

The script will output important information. **WRITE THESE DOWN:**

```
📊 Important Information:
RDS Endpoint: your-rds-endpoint.region.rds.amazonaws.com
Database Password: your_generated_password
S3 Bucket: your-sms-app-images-1234567890
EC2 IP: 12.34.56.78
```

### **Step 3: Update Environment Variables**

```bash
# SSH into your EC2 instance
ssh -i sms-app-key.pem ubuntu@YOUR_EC2_IP

# Edit the environment file
cd /opt/sms-app
nano .env.production
```

Replace the values with your actual production data:

```bash
# Database (from deployment output)
DATABASE_URL=postgres://smsadmin:your_generated_password@your-rds-endpoint.region.rds.amazonaws.com:5432/smsapp

# AWS S3 (from deployment output)
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_S3_BUCKET_NAME=your-sms-app-images-1234567890
AWS_S3_PUBLIC_URL_BASE=https://your-sms-app-images-1234567890.s3.amazonaws.com
```

### **Step 4: Deploy Application Code**

```bash
# From your local machine, copy code to server
scp -i sms-app-key.pem -r . ubuntu@YOUR_EC2_IP:/opt/sms-app/

# On the server, start the application
cd /opt/sms-app
docker-compose -f docker-compose.prod.yml up -d
```

### **Step 5: Verify Deployment**

```bash
# Check if app is running
docker-compose -f docker-compose.prod.yml ps

# Check logs
docker-compose -f docker-compose.prod.yml logs -f

# Test health endpoint
curl http://localhost:5000/api/health
curl http://YOUR_EC2_IP/api/health
```

---

## **PHASE 6: DOMAIN & SSL SETUP (1-2 hours)**

### **Step 1: Buy Domain (if needed)**

1. Go to Namecheap, GoDaddy, or AWS Route 53
2. Buy a domain (e.g., `yoursmsapp.com`)

### **Step 2: Create Hosted Zone**

1. Go to AWS Console → Route 53 → Hosted Zones
2. Click "Create Hosted Zone"
3. Enter your domain name
4. Note the 4 nameservers

### **Step 3: Update Domain Nameservers**

1. Go to your domain registrar
2. Update nameservers to the 4 from Route 53
3. Wait 15-60 minutes for propagation

### **Step 4: Create SSL Certificate**

1. Go to AWS Console → Certificate Manager
2. Click "Request Certificate"
3. Enter your domain: `yoursmsapp.com`
4. Add wildcard: `*.yoursmsapp.com`
5. Choose DNS validation
6. Click "Request"

### **Step 5: Validate Certificate**

1. In Certificate Manager, click on your certificate
2. Click "Create records in Route 53"
3. This will automatically create the validation records

### **Step 6: Create DNS Records**

1. Go to Route 53 → Hosted Zones → your domain
2. Create A record:
   - Name: `@` (or leave blank)
   - Type: `A`
   - Alias: Yes
   - Route traffic to: Application Load Balancer
   - Select your ALB

### **Step 7: Update ALB for HTTPS**

1. Go to EC2 → Load Balancers
2. Select your ALB
3. Go to Listeners tab
4. Edit the HTTP:80 listener
5. Change to HTTPS:443
6. Select your SSL certificate
7. Save

---

## **PHASE 7: FINAL TESTING (1 hour)**

### **Step 1: Test All Features**

```bash
# Test HTTPS access
curl https://your-domain.com/api/health

# Test in browser
https://your-domain.com
```

### **Step 2: Test User Registration**

1. Go to your live site
2. Try to register a new user
3. Verify email confirmation works

### **Step 3: Test SMS Functionality**

1. Complete onboarding process
2. Connect Twilio account
3. Create a test campaign
4. Send test SMS

### **Step 4: Test Payment Processing**

1. Try to upgrade to paid plan
2. Test credit purchase
3. Verify Stripe webhooks work

### **Step 5: Test Image Upload**

1. Create campaign with image
2. Verify image uploads to S3
3. Check image displays correctly

---

## **PHASE 8: MONITORING SETUP (30 minutes)**

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
# Check application logs
ssh -i sms-app-key.pem ubuntu@YOUR_EC2_IP
cd /opt/sms-app
docker-compose -f docker-compose.prod.yml logs -f
```

---

## **PHASE 9: PRESENTATION PREP (30 minutes)**

### **Step 1: Create Demo Data**

1. Create test business accounts
2. Set up sample campaigns
3. Prepare demo phone numbers
4. Create presentation slides

### **Step 2: Backup Plan**

1. Take screenshots of key features
2. Record demo videos
3. Prepare offline presentation materials
4. Have technical support contacts ready

### **Step 3: Final Checklist**

- [ ] Application is live at `https://your-domain.com`
- [ ] All features working (registration, SMS, payments, images)
- [ ] SSL certificate active
- [ ] Monitoring alerts configured
- [ ] Demo environment ready
- [ ] Backup materials prepared

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
curl -v https://your-domain.com/api/health

# Check nginx
systemctl status nginx
nginx -t
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

- ✅ **Zero downtime** during presentation
- ✅ **All features working** flawlessly
- ✅ **Fast response times** (<2 seconds)
- ✅ **Professional appearance** with HTTPS
- ✅ **Mobile-responsive** design
- ✅ **Scalable architecture** for growth

---

**You're ready to present to 15 businesses! Your SMS marketing platform is production-ready, professionally designed, and competitively priced at $20/month. Go get 'em! 🚀**
