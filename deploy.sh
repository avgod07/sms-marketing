#!/bin/bash

# AWS EC2 Deployment Script
set -e

export AWS_PAGER=""
export AWS_DEFAULT_OUTPUT="json"

echo "🚀 Starting AWS EC2 deployment..."

# Configuration
TIMESTAMP=$(date +%s)
REGION="us-east-1"
EC2_INSTANCE_TYPE="t3.medium"
EC2_KEY_NAME="sms-app-key-$TIMESTAMP"
EC2_SECURITY_GROUP="sms-app-sg-$TIMESTAMP"
RDS_INSTANCE_IDENTIFIER="sms-app-db-$TIMESTAMP"
RDS_INSTANCE_CLASS="db.t3.micro"
S3_BUCKET_NAME="sms-app-images-$TIMESTAMP"
SECRET_NAME="sms-app-db-password-$TIMESTAMP"
DOMAIN_NAME="your-domain.com"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() { echo -e "${GREEN}[INFO]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check requirements
for cmd in aws docker; do
  if ! command -v $cmd &> /dev/null; then
    print_error "$cmd is not installed."
    exit 1
  fi
done

print_status "Building Docker image..."
docker build -t sms-app:latest .

print_status "Creating S3 bucket..."
aws s3 mb "s3://$S3_BUCKET_NAME" --region $REGION || print_warning "Bucket may already exist"
aws s3api put-bucket-cors --bucket "$S3_BUCKET_NAME" --region $REGION --cors-configuration '{
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
aws ec2 create-key-pair --region $REGION --key-name "$EC2_KEY_NAME" --query 'KeyMaterial' --output text > "$EC2_KEY_NAME.pem"
chmod 400 "$EC2_KEY_NAME.pem"

print_status "Getting default VPC and subnets..."
VPC_ID=$(aws ec2 describe-vpcs --region $REGION --filters "Name=is-default,Values=true" --query 'Vpcs[0].VpcId' --output text)
SUBNETS=$(aws ec2 describe-subnets --region $REGION --filters "Name=vpc-id,Values=$VPC_ID" --query 'Subnets[*].SubnetId' --output text)
SUBNET_ARRAY=($SUBNETS)
SUBNET1=${SUBNET_ARRAY[0]}
SUBNET2=${SUBNET_ARRAY[1]}

print_status "Creating security group..."
SECURITY_GROUP_ID=$(aws ec2 create-security-group \
  --region $REGION \
  --group-name "$EC2_SECURITY_GROUP" \
  --description "Security group for SMS app" \
  --vpc-id "$VPC_ID" \
  --query 'GroupId' --output text)

print_status "Adding ingress rules..."
for port in 22 80 5000; do
  aws ec2 authorize-security-group-ingress \
    --region $REGION \
    --group-id "$SECURITY_GROUP_ID" \
    --protocol tcp --port "$port" --cidr 0.0.0.0/0 \
    || print_warning "Port $port may already be allowed"
  sleep 2
done

print_status "Generating secure RDS password..."
DB_PASSWORD=$(LC_ALL=C tr -dc 'A-Za-z0-9!#$%^&*()-_=+[]{}|:;<>?.' < /dev/urandom | head -c 32 | tr -d '/@" ')

print_status "Storing RDS password in Secrets Manager..."
aws secretsmanager create-secret \
  --region $REGION \
  --name "$SECRET_NAME" \
  --description "RDS password for sms-app" \
  --secret-string "$DB_PASSWORD" \
  || print_warning "Secret may already exist or insufficient IAM permissions"

print_status "Creating RDS instance..."
aws rds create-db-instance \
  --region $REGION \
  --db-instance-identifier "$RDS_INSTANCE_IDENTIFIER" \
  --db-instance-class "$RDS_INSTANCE_CLASS" \
  --engine postgres \
  --master-username smsadmin \
  --master-user-password "$DB_PASSWORD" \
  --allocated-storage 20 \
  --storage-type gp3 \
  --backup-retention-period 7 \
  --no-multi-az \
  --db-name smsapp \
  --vpc-security-group-ids "$SECURITY_GROUP_ID" \
  --auto-minor-version-upgrade

print_status "Waiting for RDS instance to become available..."
aws rds wait db-instance-available \
  --region $REGION \
  --db-instance-identifier "$RDS_INSTANCE_IDENTIFIER"

RDS_ENDPOINT=$(aws rds describe-db-instances \
  --region $REGION \
  --db-instance-identifier "$RDS_INSTANCE_IDENTIFIER" \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text)

print_status "RDS endpoint: $RDS_ENDPOINT"

print_status "Launching EC2 instance..."
INSTANCE_ID=$(aws ec2 run-instances \
  --region $REGION \
  --image-id ami-0c02fb55956c7d316 \
  --count 1 \
  --instance-type "$EC2_INSTANCE_TYPE" \
  --key-name "$EC2_KEY_NAME" \
  --security-group-ids "$SECURITY_GROUP_ID" \
  --subnet-id "$SUBNET1" \
  --user-data file://user-data.sh \
  --query 'Instances[0].InstanceId' \
  --output text)

aws ec2 wait instance-running --region $REGION --instance-ids "$INSTANCE_ID"

PUBLIC_IP=$(aws ec2 describe-instances \
  --region $REGION \
  --instance-ids "$INSTANCE_ID" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text)

print_status "EC2 running at $PUBLIC_IP"

print_status "Creating ALB..."
ALB_ARN=$(aws elbv2 create-load-balancer \
  --region $REGION \
  --name "sms-app-alb-$TIMESTAMP" \
  --subnets "$SUBNET1" "$SUBNET2" \
  --security-groups "$SECURITY_GROUP_ID" \
  --query 'LoadBalancers[0].LoadBalancerArn' \
  --output text)

print_status "Creating Target Group..."
TG_ARN=$(aws elbv2 create-target-group \
  --region $REGION \
  --name "sms-app-tg-$TIMESTAMP" \
  --protocol HTTP --port 80 --vpc-id "$VPC_ID" \
  --target-type instance \
  --query 'TargetGroups[0].TargetGroupArn' \
  --output text)

print_status "Registering instance to target group..."
aws elbv2 register-targets \
  --region $REGION \
  --target-group-arn "$TG_ARN" \
  --targets Id="$INSTANCE_ID"

print_status "Creating Listener..."
aws elbv2 create-listener \
  --region $REGION \
  --load-balancer-arn "$ALB_ARN" \
  --protocol HTTP \
  --port 80 \
  --default-actions Type=forward,TargetGroupArn="$TG_ARN"

print_status "✅ Deployment complete!"

echo ""
echo "🔑 SSH: ssh -i $EC2_KEY_NAME.pem ubuntu@$PUBLIC_IP"
echo "🌍 Load Balancer URL: http://$PUBLIC_IP:5000"
echo "📦 S3 Bucket: $S3_BUCKET_NAME"
echo "🧠 RDS Endpoint: $RDS_ENDPOINT"
echo "🔐 SecretsManager: $SECRET_NAME"
echo "💸 Estimated Cost: ~$74/month"

