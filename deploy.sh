#!/bin/bash

# AWS EC2 Deployment Script
set -e

echo "🚀 Starting AWS EC2 deployment..."

# Configuration
EC2_INSTANCE_TYPE="t3.medium"
EC2_KEY_NAME="sms-app-key"
EC2_SECURITY_GROUP="sms-app-sg"
RDS_INSTANCE_CLASS="db.t3.micro"
S3_BUCKET_NAME="sms-app-images-$(date +%s)"
DOMAIN_NAME="your-domain.com"  # Change this to your domain

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install it first."
    exit 1
fi

print_status "Building Docker image..."
docker build -t sms-app:latest .

print_status "Creating S3 bucket for images..."
aws s3 mb s3://$S3_BUCKET_NAME --region us-east-1
aws s3api put-bucket-cors --bucket $S3_BUCKET_NAME --cors-configuration '{
    "CORSRules": [
        {
            "AllowedHeaders": ["*"],
            "AllowedMethods": ["GET", "PUT", "POST"],
            "AllowedOrigins": ["*"],
            "ExposeHeaders": []
        }
    ]
}'

print_status "Creating EC2 key pair..."
aws ec2 create-key-pair --key-name $EC2_KEY_NAME --query 'KeyMaterial' --output text > $EC2_KEY_NAME.pem
chmod 400 $EC2_KEY_NAME.pem

print_status "Getting default VPC and subnets..."
VPC_ID=$(aws ec2 describe-vpcs --filters "Name=is-default,Values=true" --query 'Vpcs[0].VpcId' --output text)
SUBNET_IDS=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" --query 'Subnets[0:2].SubnetId' --output text)
SUBNET1=$(echo $SUBNET_IDS | cut -d' ' -f1)
SUBNET2=$(echo $SUBNET_IDS | cut -d' ' -f2)

print_status "Creating security group..."
SECURITY_GROUP_ID=$(aws ec2 create-security-group --group-name $EC2_SECURITY_GROUP --description "Security group for SMS app" --vpc-id $VPC_ID --query 'GroupId' --output text)

# Add rules to security group
aws ec2 authorize-security-group-ingress --group-id $SECURITY_GROUP_ID --protocol tcp --port 22 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $SECURITY_GROUP_ID --protocol tcp --port 80 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $SECURITY_GROUP_ID --protocol tcp --port 443 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $SECURITY_GROUP_ID --protocol tcp --port 5000 --cidr 0.0.0.0/0

print_status "Creating RDS instance..."
DB_PASSWORD=$(openssl rand -base64 32)
aws rds create-db-instance \
    --db-instance-identifier sms-app-db \
    --db-instance-class $RDS_INSTANCE_CLASS \
    --engine postgres \
    --master-username smsadmin \
    --master-user-password "$DB_PASSWORD" \
    --allocated-storage 20 \
    --storage-type gp3 \
    --vpc-security-group-ids $SECURITY_GROUP_ID \
    --backup-retention-period 7 \
    --multi-az false \
    --auto-minor-version-upgrade

print_status "Waiting for RDS to be available..."
aws rds wait db-instance-available --db-instance-identifier sms-app-db

# Get RDS endpoint
RDS_ENDPOINT=$(aws rds describe-db-instances --db-instance-identifier sms-app-db --query 'DBInstances[0].Endpoint.Address' --output text)

print_status "Creating EC2 instance..."
INSTANCE_ID=$(aws ec2 run-instances \
    --image-id ami-0c02fb55956c7d316 \
    --count 1 \
    --instance-type $EC2_INSTANCE_TYPE \
    --key-name $EC2_KEY_NAME \
    --vpc-security-group-ids $SECURITY_GROUP_ID \
    --subnet-id $SUBNET1 \
    --user-data file://user-data.sh \
    --query 'Instances[0].InstanceId' \
    --output text)

print_status "Waiting for EC2 instance to be running..."
aws ec2 wait instance-running --instance-ids $INSTANCE_ID

# Get public IP
PUBLIC_IP=$(aws ec2 describe-instances --instance-ids $INSTANCE_ID --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)

print_status "EC2 instance created with IP: $PUBLIC_IP"

print_status "Creating Application Load Balancer..."
ALB_ARN=$(aws elbv2 create-load-balancer \
    --name sms-app-alb \
    --subnets $SUBNET1 $SUBNET2 \
    --security-groups $SECURITY_GROUP_ID \
    --query 'LoadBalancers[0].LoadBalancerArn' \
    --output text)

print_status "Creating target group..."
TARGET_GROUP_ARN=$(aws elbv2 create-target-group \
    --name sms-app-tg \
    --protocol HTTP \
    --port 80 \
    --vpc-id $VPC_ID \
    --target-type instance \
    --query 'TargetGroups[0].TargetGroupArn' \
    --output text)

print_status "Registering EC2 instance with target group..."
aws elbv2 register-targets \
    --target-group-arn $TARGET_GROUP_ARN \
    --targets Id=$INSTANCE_ID

print_status "Creating listener..."
aws elbv2 create-listener \
    --load-balancer-arn $ALB_ARN \
    --protocol HTTP \
    --port 80 \
    --default-actions Type=forward,TargetGroupArn=$TARGET_GROUP_ARN

print_status "Deployment completed!"
echo ""
echo "📋 Next steps:"
echo "1. SSH into your instance: ssh -i $EC2_KEY_NAME.pem ubuntu@$PUBLIC_IP"
echo "2. Update your environment variables in .env.production"
echo "3. Set up your domain DNS to point to the ALB"
echo "4. Configure SSL certificate in AWS Certificate Manager"
echo ""
echo "🔗 Your app will be available at: http://$PUBLIC_IP:5000"
echo "💰 Estimated monthly cost: ~$74"
echo ""
echo "📊 Important Information:"
echo "RDS Endpoint: $RDS_ENDPOINT"
echo "Database Password: $DB_PASSWORD"
echo "S3 Bucket: $S3_BUCKET_NAME" 