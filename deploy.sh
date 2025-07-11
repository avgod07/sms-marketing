#!/bin/bash

# ✅ SMS App Deployment Script - AWS

set -e
export AWS_PAGER=""
export AWS_DEFAULT_OUTPUT="json"

echo "🚀 Starting AWS deployment..."

# Config
REGION="us-east-1"
TIMESTAMP=$(date +%s)
EC2_INSTANCE_TYPE="t3.medium"
EC2_KEY_NAME="sms-app-key-$TIMESTAMP"
EC2_SECURITY_GROUP="sms-app-sg-$TIMESTAMP"
RDS_INSTANCE_IDENTIFIER="sms-app-db-$TIMESTAMP"
RDS_INSTANCE_CLASS="db.t3.micro"
S3_BUCKET_NAME="sms-app-images-$TIMESTAMP"
SECRET_NAME="sms-app-db-password-$TIMESTAMP"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_status() { echo -e "${GREEN}[INFO]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Precheck
for cmd in aws docker; do
  if ! command -v $cmd &> /dev/null; then
    print_error "$cmd not installed."
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
      "AllowedOrigins": ["*"]
    }
  ]
}'

print_status "Creating EC2 key pair..."
aws ec2 create-key-pair --region $REGION --key-name "$EC2_KEY_NAME" --query 'KeyMaterial' --output text > "$EC2_KEY_NAME.pem"
chmod 400 "$EC2_KEY_NAME.pem"

print_status "Fetching default VPC and subnets..."
VPC_ID=$(aws ec2 describe-vpcs --region $REGION --filters "Name=is-default,Values=true" --query 'Vpcs[0].VpcId' --output text)

# Check if VPC exists and has internet gateway
if [ "$VPC_ID" = "None" ] || [ -z "$VPC_ID" ]; then
    print_warning "No default VPC found. Creating a new VPC with internet gateway..."
    
    # Create VPC with CIDR block
    VPC_ID=$(aws ec2 create-vpc --region $REGION --cidr-block 10.0.0.0/16 --query 'Vpc.VpcId' --output text)
    aws ec2 create-tags --region $REGION --resources $VPC_ID --tags Key=Name,Value=Default-VPC
    
    # Create Internet Gateway
    IGW_ID=$(aws ec2 create-internet-gateway --region $REGION --query 'InternetGateway.InternetGatewayId' --output text)
    aws ec2 create-tags --region $REGION --resources $IGW_ID --tags Key=Name,Value=Default-IGW
    
    # Attach Internet Gateway to VPC
    aws ec2 attach-internet-gateway --region $REGION --vpc-id $VPC_ID --internet-gateway-id $IGW_ID
    
    # Create subnets
    SUBNET1=$(aws ec2 create-subnet --region $REGION --vpc-id $VPC_ID --cidr-block 10.0.1.0/24 --availability-zone ${REGION}a --query 'Subnet.SubnetId' --output text)
    SUBNET2=$(aws ec2 create-subnet --region $REGION --vpc-id $VPC_ID --cidr-block 10.0.2.0/24 --availability-zone ${REGION}b --query 'Subnet.SubnetId' --output text)
    
    # Create route table
    ROUTE_TABLE_ID=$(aws ec2 create-route-table --region $REGION --vpc-id $VPC_ID --query 'RouteTable.RouteTableId' --output text)
    
    # Add route to internet gateway
    aws ec2 create-route --region $REGION --route-table-id $ROUTE_TABLE_ID --destination-cidr-block 0.0.0.0/0 --gateway-id $IGW_ID
    
    # Associate route table with subnets
    aws ec2 associate-route-table --region $REGION --subnet-id $SUBNET1 --route-table-id $ROUTE_TABLE_ID
    aws ec2 associate-route-table --region $REGION --subnet-id $SUBNET2 --route-table-id $ROUTE_TABLE_ID
    
    # Enable auto-assign public IP for subnets
    aws ec2 modify-subnet-attribute --region $REGION --subnet-id $SUBNET1 --map-public-ip-on-launch
    aws ec2 modify-subnet-attribute --region $REGION --subnet-id $SUBNET2 --map-public-ip-on-launch
    
    print_status "Created new VPC with Internet Gateway: $VPC_ID"
else
    print_status "Found existing default VPC: $VPC_ID"
    
    # Check if internet gateway is attached
    IGW_ATTACHED=$(aws ec2 describe-internet-gateways --region $REGION --filters "Name=attachment.vpc-id,Values=$VPC_ID" --query 'InternetGateways[0].InternetGatewayId' --output text)
    
    if [ "$IGW_ATTACHED" = "None" ] || [ -z "$IGW_ATTACHED" ]; then
        print_warning "No Internet Gateway attached to VPC. Creating and attaching one..."
        
        # Create Internet Gateway
        IGW_ID=$(aws ec2 create-internet-gateway --region $REGION --query 'InternetGateway.InternetGatewayId' --output text)
        aws ec2 create-tags --region $REGION --resources $IGW_ID --tags Key=Name,Value=Default-IGW
        
        # Attach Internet Gateway to VPC
        aws ec2 attach-internet-gateway --region $REGION --vpc-id $VPC_ID --internet-gateway-id $IGW_ID
        
        # Get default route table
        ROUTE_TABLE_ID=$(aws ec2 describe-route-tables --region $REGION --filters "Name=vpc-id,Values=$VPC_ID" "Name=association.main,Values=true" --query 'RouteTables[0].RouteTableId' --output text)
        
        # Add route to internet gateway
        aws ec2 create-route --region $REGION --route-table-id $ROUTE_TABLE_ID --destination-cidr-block 0.0.0.0/0 --gateway-id $IGW_ID
        
        print_status "Attached Internet Gateway to VPC"
    else
        print_status "Internet Gateway already attached: $IGW_ATTACHED"
    fi
    
    # Get subnets
    SUBNETS=$(aws ec2 describe-subnets --region $REGION --filters "Name=vpc-id,Values=$VPC_ID" --query 'Subnets[*].SubnetId' --output text)
    SUBNET_ARRAY=($SUBNETS)
    SUBNET1=${SUBNET_ARRAY[0]}
    SUBNET2=${SUBNET_ARRAY[1]}
fi

print_status "Creating security group..."
SECURITY_GROUP_ID=$(aws ec2 create-security-group \
  --region $REGION \
  --group-name "$EC2_SECURITY_GROUP" \
  --description "SMS App Security Group" \
  --vpc-id "$VPC_ID" \
  --query 'GroupId' --output text)

print_status "Adding ingress rules..."
for port in 22 80 5000; do
  aws ec2 authorize-security-group-ingress \
    --region $REGION \
    --group-id "$SECURITY_GROUP_ID" \
    --protocol tcp --port "$port" --cidr 0.0.0.0/0 \
    || print_warning "Port $port may already be allowed"
done

print_status "Generating RDS password..."
DB_PASSWORD=$(LC_ALL=C tr -dc 'A-Za-z0-9!#$%^&*()-_=+[]{}|:;<>?.' < /dev/urandom | head -c 32 | tr -d '/@" ')

print_status "Storing password in Secrets Manager..."
aws secretsmanager create-secret \
  --region $REGION \
  --name "$SECRET_NAME" \
  --description "RDS password for sms-app" \
  --secret-string "$DB_PASSWORD" \
  || print_warning "Secret may already exist or insufficient permissions"

print_status "Creating RDS subnet group..."
RDS_SUBNET_GROUP_NAME="sms-app-subnet-group-$TIMESTAMP"

# Create RDS subnet group
aws rds create-db-subnet-group \
  --region $REGION \
  --db-subnet-group-name "$RDS_SUBNET_GROUP_NAME" \
  --db-subnet-group-description "Subnet group for SMS app RDS" \
  --subnet-ids "$SUBNET1" "$SUBNET2" \
  || print_warning "Subnet group may already exist"

print_status "Creating RDS instance..."
aws rds create-db-instance \
  --region $REGION \
  --db-instance-identifier "$RDS_INSTANCE_IDENTIFIER" \
  --db-instance-class "$RDS_INSTANCE_CLASS" \
  --engine postgres \
  --master-username myuser \
  --master-user-password "$DB_PASSWORD" \
  --allocated-storage 20 \
  --vpc-security-group-ids "$SECURITY_GROUP_ID" \
  --db-subnet-group-name "$RDS_SUBNET_GROUP_NAME" \
  --no-multi-az

print_status "Waiting for RDS to become available..."
aws rds wait db-instance-available \
  --region $REGION \
  --db-instance-identifier "$RDS_INSTANCE_IDENTIFIER"

RDS_ENDPOINT=$(aws rds describe-db-instances \
  --region $REGION \
  --db-instance-identifier "$RDS_INSTANCE_IDENTIFIER" \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text)

print_status "RDS is ready at: $RDS_ENDPOINT"

print_status "Launching EC2 instance..."
# Try to launch in a supported AZ - use us-east-1a which typically supports all instance types
SUBNET_A=$(aws ec2 describe-subnets --region $REGION --filters "Name=vpc-id,Values=$VPC_ID" "Name=availability-zone,Values=us-east-1a" --query 'Subnets[0].SubnetId' --output text)

if [ "$SUBNET_A" = "None" ] || [ -z "$SUBNET_A" ]; then
    print_warning "us-east-1a not available, trying us-east-1b..."
    SUBNET_A=$(aws ec2 describe-subnets --region $REGION --filters "Name=vpc-id,Values=$VPC_ID" "Name=availability-zone,Values=us-east-1b" --query 'Subnets[0].SubnetId' --output text)
fi

if [ "$SUBNET_A" = "None" ] || [ -z "$SUBNET_A" ]; then
    print_warning "us-east-1b not available, trying us-east-1c..."
    SUBNET_A=$(aws ec2 describe-subnets --region $REGION --filters "Name=vpc-id,Values=$VPC_ID" "Name=availability-zone,Values=us-east-1c" --query 'Subnets[0].SubnetId' --output text)
fi

print_status "Using subnet: $SUBNET_A"

INSTANCE_ID=$(aws ec2 run-instances \
  --region $REGION \
  --image-id ami-0c02fb55956c7d316 \
  --count 1 \
  --instance-type "$EC2_INSTANCE_TYPE" \
  --key-name "$EC2_KEY_NAME" \
  --security-group-ids "$SECURITY_GROUP_ID" \
  --subnet-id "$SUBNET_A" \
  --user-data file://user-data.sh \
  --query 'Instances[0].InstanceId' \
  --output text)

aws ec2 wait instance-running \
  --region $REGION \
  --instance-ids "$INSTANCE_ID"

PUBLIC_IP=$(aws ec2 describe-instances \
  --region $REGION \
  --instance-ids "$INSTANCE_ID" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text)

print_status "EC2 instance running at: $PUBLIC_IP"

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
  --protocol HTTP --port 80 \
  --vpc-id "$VPC_ID" \
  --target-type instance \
  --query 'TargetGroups[0].TargetGroupArn' \
  --output text)

print_status "Registering EC2 instance with Target Group..."
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

# Final Output
echo ""
print_status "✅ Deployment complete!"
echo ""
echo "🔑 SSH into your server: ssh -i $EC2_KEY_NAME.pem ubuntu@$PUBLIC_IP"
echo "🌐 Public IP: http://$PUBLIC_IP:5000"
echo "📦 S3 Bucket: $S3_BUCKET_NAME"
echo "🧠 RDS Endpoint: $RDS_ENDPOINT"
echo "🔐 DB Password stored in: $SECRET_NAME"
