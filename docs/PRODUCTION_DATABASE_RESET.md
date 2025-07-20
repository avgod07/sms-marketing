# Production Database Reset Guide

## ⚠️ CRITICAL WARNING

This script will **PERMANENTLY DELETE ALL DATA** in your production RDS database. Use with extreme caution.

## Script: `scripts/reset-production-db.sh`

### Purpose

Safely reset your production RDS database with multiple safety checks and confirmations.

### Safety Features

1. **Double Confirmation**: Requires typing specific confirmation phrases
2. **Environment Validation**: Verifies `.env.production` and `NODE_ENV=production`
3. **Connection Testing**: Tests RDS connectivity before proceeding
4. **Database Verification**: Confirms you're connected to the correct SMS app database
5. **Docker Detection**: Prevents accidental runs in dev containers
6. **RDS Validation**: Ensures DATABASE_URL points to RDS (not localhost)

### Prerequisites

- Must be run on EC2 production server (not in dev container)
- `.env.production` file must exist with correct DATABASE_URL
- `NODE_ENV=production` must be set in `.env.production`
- RDS database must be accessible from EC2 instance

### Usage

```bash
# Navigate to your app directory
cd /opt/sms-app

# Run the production reset script
./scripts/reset-production-db.sh
```

### What the Script Does

1. **Safety Checks**: Multiple validations to prevent accidents
2. **Environment Loading**: Sources `.env.production` for database connection
3. **Connection Testing**: Verifies RDS connectivity
4. **Database Reset**:
   - Drops all existing tables
   - Recreates schema using Drizzle
   - Optionally seeds with sample data
   - Verifies the reset was successful

### Expected Prompts

1. **Initial Confirmation**: Type `RESET_PRODUCTION_DATABASE`
2. **Final Confirmation**: Type `YES`
3. **Seeding Choice**: Choose `y` or `N` for sample data

### Sample Output

```
🚨 PRODUCTION DATABASE RESET SCRIPT 🚨
WARNING: This will PERMANENTLY DELETE ALL DATA in your production database!

Are you absolutely sure you want to reset the PRODUCTION database?
This action cannot be undone and will delete:
  • All business data
  • All user accounts
  • All messages and campaigns
  • All contacts and analytics

Type 'RESET_PRODUCTION_DATABASE' to continue: RESET_PRODUCTION_DATABASE
✅ Found .env.production
Loading production environment variables...
✅ Production environment loaded
  Database Host: your-rds-endpoint.amazonaws.com
  Database Name: smsapp
Testing RDS connection...
✅ RDS connection successful
Verifying this is the correct SMS application database...
✅ Confirmed: SMS application database structure detected

⚠️  FINAL CONFIRMATION ⚠️
You are about to reset the database at: your-rds-endpoint.amazonaws.com
This will permanently delete all production data.

Type 'YES' to proceed with the reset: YES

🔄 Starting production database reset...
Step 1/4: Dropping all tables...
✅ Tables dropped successfully
Step 2/4: Recreating database schema...
✅ Schema recreated successfully
Step 3/4: Database seeding (optional)
Do you want to seed the database with sample data? (y/N): N
Skipping database seeding
Step 4/4: Verifying reset...
✅ Reset verification successful
Business count: 0
✅ Database reset completed successfully!

🎉 PRODUCTION DATABASE RESET COMPLETE 🎉
Database is now clean and ready for use.

Next steps:
  1. Restart your application if it's running
  2. Verify the application starts correctly
  3. Test basic functionality
```

### Troubleshooting

**Error: ".env.production file not found"**

- Ensure you're in the correct directory (`/opt/sms-app`)
- Verify `.env.production` exists and has correct permissions

**Error: "Cannot connect to RDS database"**

- Check your DATABASE_URL in `.env.production`
- Verify RDS security groups allow EC2 access
- Confirm RDS instance is running

**Error: "NODE_ENV is not set to 'production'"**

- Update `.env.production` to include `NODE_ENV=production`

**Error: "This script detected a Docker environment"**

- This script must run on EC2, not in dev containers
- SSH into your EC2 instance first

### Recovery

If something goes wrong during the reset:

1. The script stops on any error
2. Your RDS instance itself is not damaged
3. You can re-run the script or manually restore from backups
4. Contact your DBA if you need to restore from RDS snapshots

### Best Practices

1. **Create RDS snapshot** before running (recommended)
2. **Stop your application** during reset to prevent connection errors
3. **Run during maintenance window** to minimize user impact
4. **Test the reset** on a staging environment first
5. **Have rollback plan** ready in case issues arise
