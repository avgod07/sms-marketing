#!/bin/bash

# AWS Infrastructure Teardown Script
set -e

# Optional: Uncomment for debugging
# set -x

# Prevent AWS CLI from hanging due to paging
export AWS_PAGER=""
export AWS_DEFAULT_OUTPUT="json"

echo "🗑️  Starting AWS infrastructure teardown..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Function to check if resource exists
resource_exists() {
    local resource_type=$1
    local resource_id=$2
    
    case $resource_type in
        "instance")
            aws ec2 describe-instances --instance-ids $resource_id --query 'Reservations[0].Instances[0].State.Name' --output text 2>/dev/null | grep -q "running\|stopped\|pending"
            ;;
        "rds")
            aws rds describe-db-instances --db-instance-identifier $resource_id --query 'DBInstances[0].DBInstanceStatus' --output text 2>/dev/null | grep -q "available\|creating\|deleting"
            ;;
        "alb")
            aws elbv2 describe-load-balancers --load-balancer-arns $resource_id --query 'LoadBalancers[0].State.Code' --output text 2>/dev/null | grep -q "active\|provisioning"
            ;;
        "target-group")
            aws elbv2 describe-target-groups --target-group-arns $resource_id --query 'TargetGroups[0].TargetGroupArn' --output text 2>/dev/null | grep -q "arn:"
            ;;
        "security-group")
            aws ec2 describe-security-groups --group-ids $resource_id --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null | grep -q "sg-"
            ;;
        "s3")
            aws s3api head-bucket --bucket $resource_id 2>/dev/null
            ;;
        "key-pair")
            aws ec2 describe-key-pairs --key-names $resource_id --query 'KeyPairs[0].KeyName' --output text 2>/dev/null | grep -q $resource_id
            ;;
        "secret")
            aws secretsmanager describe-secret --secret-id $resource_id --query 'Secret.Name' --output text 2>/dev/null | grep -q $resource_id
            ;;
    esac
}

# Function to safely delete resource
safe_delete() {
    local resource_type=$1
    local resource_id=$2
    local resource_name=$3
    
    if resource_exists $resource_type $resource_id; then
        print_status "Deleting $resource_name ($resource_id)..."
        case $resource_type in
            "instance")
                aws ec2 terminate-instances --instance-ids $resource_id --region us-east-1
                print_status "Waiting for instance to terminate..."
                aws ec2 wait instance-terminated --instance-ids $resource_id --region us-east-1
                ;;
            "rds")
                aws rds delete-db-instance \
                    --db-instance-identifier $resource_id \
                    --skip-final-snapshot \
                    --delete-automated-backups \
                    --region us-east-1
                print_status "Waiting for RDS instance to be deleted..."
                aws rds wait db-instance-deleted --db-instance-identifier $resource_id --region us-east-1
                ;;
            "alb")
                aws elbv2 delete-load-balancer --load-balancer-arn $resource_id --region us-east-1
                ;;
            "target-group")
                aws elbv2 delete-target-group --target-group-arn $resource_id --region us-east-1
                ;;
            "security-group")
                aws ec2 delete-security-group --group-id $resource_id --region us-east-1
                ;;
            "s3")
                aws s3 rb s3://$resource_id --force --region us-east-1
                ;;
            "key-pair")
                aws ec2 delete-key-pair --key-name $resource_id --region us-east-1
                ;;
            "secret")
                aws secretsmanager delete-secret --secret-id $resource_id --force-delete-without-recovery --region us-east-1
                ;;
        esac
        print_status "✅ $resource_name deleted successfully"
    else
        print_warning "⚠️  $resource_name ($resource_id) not found or already deleted"
    fi
}

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    print_error "AWS credentials not configured or invalid. Please run 'aws configure' first."
    exit 1
fi

print_info "🔍 Scanning for AWS resources to delete..."

# Try to find resources by common patterns
print_status "Looking for EC2 instances..."
INSTANCE_IDS=$(aws ec2 describe-instances \
    --filters "Name=tag:Name,Values=sms-app*" "Name=instance-state-name,Values=running,stopped,pending" \
    --query 'Reservations[].Instances[].InstanceId' \
    --output text \
    --region us-east-1 2>/dev/null || echo "")

if [ -n "$INSTANCE_IDS" ]; then
    print_status "Found EC2 instances: $INSTANCE_IDS"
else
    print_warning "No EC2 instances found with 'sms-app' tag"
fi

print_status "Looking for RDS instances..."
RDS_INSTANCES=$(aws rds describe-db-instances \
    --query 'DBInstances[?contains(DBInstanceIdentifier, `sms-app`)].DBInstanceIdentifier' \
    --output text \
    --region us-east-1 2>/dev/null || echo "")

if [ -n "$RDS_INSTANCES" ]; then
    print_status "Found RDS instances: $RDS_INSTANCES"
else
    print_warning "No RDS instances found with 'sms-app' in name"
fi

print_status "Looking for Application Load Balancers..."
ALB_ARNS=$(aws elbv2 describe-load-balancers \
    --query 'LoadBalancers[?contains(LoadBalancerName, `sms-app`)].LoadBalancerArn' \
    --output text \
    --region us-east-1 2>/dev/null || echo "")

if [ -n "$ALB_ARNS" ]; then
    print_status "Found ALBs: $ALB_ARNS"
else
    print_warning "No ALBs found with 'sms-app' in name"
fi

print_status "Looking for Target Groups..."
TARGET_GROUP_ARNS=$(aws elbv2 describe-target-groups \
    --query 'TargetGroups[?contains(TargetGroupName, `sms-app`)].TargetGroupArn' \
    --output text \
    --region us-east-1 2>/dev/null || echo "")

if [ -n "$TARGET_GROUP_ARNS" ]; then
    print_status "Found Target Groups: $TARGET_GROUP_ARNS"
else
    print_warning "No Target Groups found with 'sms-app' in name"
fi

print_status "Looking for Security Groups..."
SECURITY_GROUP_IDS=$(aws ec2 describe-security-groups \
    --filters "Name=group-name,Values=sms-app*" \
    --query 'SecurityGroups[].GroupId' \
    --output text \
    --region us-east-1 2>/dev/null || echo "")

if [ -n "$SECURITY_GROUP_IDS" ]; then
    print_status "Found Security Groups: $SECURITY_GROUP_IDS"
else
    print_warning "No Security Groups found with 'sms-app' in name"
fi

print_status "Looking for S3 buckets..."
S3_BUCKETS=$(aws s3api list-buckets \
    --query 'Buckets[?contains(Name, `sms-app`)].Name' \
    --output text \
    --region us-east-1 2>/dev/null || echo "")

if [ -n "$S3_BUCKETS" ]; then
    print_status "Found S3 buckets: $S3_BUCKETS"
else
    print_warning "No S3 buckets found with 'sms-app' in name"
fi

print_status "Looking for Key Pairs..."
KEY_PAIRS=$(aws ec2 describe-key-pairs \
    --query 'KeyPairs[?contains(KeyName, `sms-app`)].KeyName' \
    --output text \
    --region us-east-1 2>/dev/null || echo "")

if [ -n "$KEY_PAIRS" ]; then
    print_status "Found Key Pairs: $KEY_PAIRS"
else
    print_warning "No Key Pairs found with 'sms-app' in name"
fi

print_status "Looking for Secrets Manager entries..."
SECRETS=$(aws secretsmanager list-secrets \
    --query 'SecretList[?contains(Name, `sms-app`)].Name' \
    --output text \
    --region us-east-1 2>/dev/null || echo "")

if [ -n "$SECRETS" ]; then
    print_status "Found Secrets: $SECRETS"
else
    print_warning "No Secrets found with 'sms-app' in name"
fi

# Summary of what will be deleted
echo ""
print_warning "🗑️  The following resources will be deleted:"
if [ -n "$INSTANCE_IDS" ]; then echo "   • EC2 Instances: $INSTANCE_IDS"; fi
if [ -n "$RDS_INSTANCES" ]; then echo "   • RDS Instances: $RDS_INSTANCES"; fi
if [ -n "$ALB_ARNS" ]; then echo "   • Application Load Balancers: $ALB_ARNS"; fi
if [ -n "$TARGET_GROUP_ARNS" ]; then echo "   • Target Groups: $TARGET_GROUP_ARNS"; fi
if [ -n "$SECURITY_GROUP_IDS" ]; then echo "   • Security Groups: $SECURITY_GROUP_IDS"; fi
if [ -n "$S3_BUCKETS" ]; then echo "   • S3 Buckets: $S3_BUCKETS"; fi
if [ -n "$KEY_PAIRS" ]; then echo "   • Key Pairs: $KEY_PAIRS"; fi
if [ -n "$SECRETS" ]; then echo "   • Secrets: $SECRETS"; fi

if [ -z "$INSTANCE_IDS$RDS_INSTANCES$ALB_ARNS$TARGET_GROUP_ARNS$SECURITY_GROUP_IDS$S3_BUCKETS$KEY_PAIRS$SECRETS" ]; then
    print_warning "No resources found to delete. Infrastructure may already be cleaned up."
    exit 0
fi

echo ""
print_warning "⚠️  This action is irreversible and will permanently delete all listed resources."
read -p "Are you sure you want to continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_info "Teardown cancelled."
    exit 0
fi

echo ""
print_status "🚀 Starting resource deletion..."

# Delete resources in dependency order

# 1. Delete EC2 instances first
for instance_id in $INSTANCE_IDS; do
    safe_delete "instance" "$instance_id" "EC2 Instance"
done

# 2. Delete RDS instances
for rds_id in $RDS_INSTANCES; do
    safe_delete "rds" "$rds_id" "RDS Instance"
done

# 3. Delete Application Load Balancers
for alb_arn in $ALB_ARNS; do
    safe_delete "alb" "$alb_arn" "Application Load Balancer"
done

# 4. Delete Target Groups
for tg_arn in $TARGET_GROUP_ARNS; do
    safe_delete "target-group" "$tg_arn" "Target Group"
done

# 5. Delete Security Groups
for sg_id in $SECURITY_GROUP_IDS; do
    safe_delete "security-group" "$sg_id" "Security Group"
done

# 6. Delete S3 buckets
for bucket in $S3_BUCKETS; do
    safe_delete "s3" "$bucket" "S3 Bucket"
done

# 7. Delete Key Pairs
for key_name in $KEY_PAIRS; do
    safe_delete "key-pair" "$key_name" "Key Pair"
done

# 8. Delete Secrets Manager entries
for secret in $SECRETS; do
    safe_delete "secret" "$secret" "Secret"
done

# Clean up local files
print_status "Cleaning up local files..."
if [ -f "sms-app-key.pem" ]; then
    rm -f sms-app-key.pem
    print_status "✅ Removed local key file"
fi

echo ""
print_status "🎉 Teardown completed successfully!"
print_info "All AWS resources have been deleted."
print_info "You can now run deploy.sh again for a fresh deployment." 