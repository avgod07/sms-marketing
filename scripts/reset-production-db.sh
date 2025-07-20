#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚨 PRODUCTION DATABASE RESET SCRIPT 🚨${NC}"
echo -e "${RED}WARNING: This will PERMANENTLY DELETE ALL DATA in your production database!${NC}"
echo ""

# Safety check 1: Confirm this is intentional
echo -e "${YELLOW}Are you absolutely sure you want to reset the PRODUCTION database?${NC}"
echo "This action cannot be undone and will delete:"
echo "  • All business data"
echo "  • All user accounts"
echo "  • All messages and campaigns"
echo "  • All contacts and analytics"
echo ""
read -p "Type 'RESET_PRODUCTION_DATABASE' to continue: " confirmation

if [ "$confirmation" != "RESET_PRODUCTION_DATABASE" ]; then
    echo -e "${RED}❌ Operation cancelled. Confirmation text did not match.${NC}"
    exit 1
fi

# Safety check 2: Verify we're on the EC2 instance (not dev container)
if [ -f "/.dockerenv" ]; then
    echo -e "${RED}❌ ERROR: This script detected a Docker environment!${NC}"
    echo "This script should only be run on the EC2 production server."
    echo "If you're in a dev container, use './scripts/reset-db.sh' instead."
    exit 1
fi

# Safety check 3: Verify .env.production exists
if [ ! -f ".env.production" ]; then
    echo -e "${RED}❌ ERROR: .env.production file not found!${NC}"
    echo "Please ensure you're in the correct directory and .env.production exists."
    exit 1
fi

echo -e "${GREEN}✅ Found .env.production${NC}"

# Safety check 4: Load and validate environment variables
echo "Loading production environment variables..."
set -a
source .env.production
set +a

if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ ERROR: DATABASE_URL not found in .env.production${NC}"
    exit 1
fi

if [ -z "$NODE_ENV" ] || [ "$NODE_ENV" != "production" ]; then
    echo -e "${RED}❌ ERROR: NODE_ENV is not set to 'production' in .env.production${NC}"
    echo "Current NODE_ENV: ${NODE_ENV:-'(not set)'}"
    exit 1
fi

# Safety check 5: Verify DATABASE_URL points to RDS (not localhost)
if [[ "$DATABASE_URL" == *"localhost"* ]] || [[ "$DATABASE_URL" == *"127.0.0.1"* ]]; then
    echo -e "${RED}❌ ERROR: DATABASE_URL appears to point to localhost!${NC}"
    echo "DATABASE_URL: $DATABASE_URL"
    echo "This script is for production RDS only."
    exit 1
fi

# Extract and display database connection info (without credentials)
db_host=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
db_name=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')

echo -e "${GREEN}✅ Production environment loaded${NC}"
echo "  Database Host: $db_host"
echo "  Database Name: $db_name"
echo ""

# Safety check 6: Verify RDS connectivity
echo "Testing RDS connection..."
if ! npx tsx -e "
import pg from 'pg';
const client = new pg.Client({connectionString: process.env.DATABASE_URL});
client.connect()
  .then(() => {
    console.log('✅ RDS connection successful');
    return client.end();
  })
  .catch(err => {
    console.error('❌ RDS connection failed:', err.message);
    process.exit(1);
  });
" 2>/dev/null; then
    echo -e "${RED}❌ ERROR: Cannot connect to RDS database${NC}"
    echo "Please check your DATABASE_URL and network connectivity."
    echo "Debug: Trying alternative connection test..."
    
    # Alternative test using the same method as reset-db.js
    if node scripts/reset-db.js --test-only 2>/dev/null; then
        echo -e "${GREEN}✅ RDS connection successful (alternative method)${NC}"
    else
        echo -e "${RED}❌ RDS connection still failing. Please check:${NC}"
        echo "  - RDS security groups allow EC2 access"
        echo "  - DATABASE_URL is correct in .env.production"
        echo "  - RDS instance is running"
        exit 1
    fi
fi

# Safety check 7: Verify this is the correct database by checking for expected tables
echo "Verifying this is the correct SMS application database..."
if ! npx tsx -e "
import pg from 'pg';
const client = new pg.Client({connectionString: process.env.DATABASE_URL});
client.connect()
  .then(() => client.query(\"SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('businesses', 'contacts', 'campaigns')\"))
  .then(result => {
    if (result.rows.length >= 1) {
      console.log('✅ Confirmed: SMS application database structure detected');
      console.log('Found tables:', result.rows.map(r => r.tablename).join(', '));
    } else {
      console.log('⚠️  Note: Expected SMS application tables not found (database may be empty)');
      console.log('This is normal for a fresh database.');
    }
    return client.end();
  })
  .catch(err => {
    console.error('❌ Database verification failed:', err.message);
    process.exit(1);
  });
" 2>/dev/null; then
    echo -e "${YELLOW}⚠️  Database verification inconclusive, but connection works${NC}"
    echo "Proceeding with reset..."
fi

# Final confirmation
echo ""
echo -e "${YELLOW}⚠️  FINAL CONFIRMATION ⚠️${NC}"
echo "You are about to reset the database at: $db_host"
echo "This will permanently delete all production data."
echo ""
read -p "Type 'YES' to proceed with the reset: " final_confirm

if [ "$final_confirm" != "YES" ]; then
    echo -e "${RED}❌ Operation cancelled.${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}🔄 Starting production database reset...${NC}"

# Step 1: Drop all tables
echo "Step 1/4: Dropping all tables..."
if ! node scripts/reset-db.js; then
    echo -e "${RED}❌ ERROR: Failed to drop tables${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Tables dropped successfully${NC}"

# Step 2: Recreate schema
echo "Step 2/4: Recreating database schema..."
if ! npx drizzle-kit push --config=drizzle.config.ts; then
    echo -e "${RED}❌ ERROR: Failed to recreate schema${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Schema recreated successfully${NC}"

# Step 3: Optional seeding
echo "Step 3/4: Database seeding (optional)"
read -p "Do you want to seed the database with sample data? (y/N): " seed_choice

if [[ "$seed_choice" =~ ^[Yy]$ ]]; then
    echo "Seeding database..."
    if ! npm run db:seed; then
        echo -e "${YELLOW}⚠️  WARNING: Seeding failed, but reset was successful${NC}"
    else
        echo -e "${GREEN}✅ Database seeded successfully${NC}"
    fi
else
    echo "Skipping database seeding"
fi

# Step 4: Verification
echo "Step 4/4: Verifying reset..."
if npx tsx -e "
import pg from 'pg';
const client = new pg.Client({connectionString: process.env.DATABASE_URL});
client.connect()
  .then(() => client.query('SELECT COUNT(*) FROM businesses'))
  .then(result => {
    console.log('✅ Reset verification successful');
    console.log('Business count:', result.rows[0].count);
    return client.end();
  })
  .catch(err => {
    console.error('❌ Verification failed:', err.message);
    process.exit(1);
  });
" 2>/dev/null; then
    echo -e "${GREEN}✅ Database reset completed successfully!${NC}"
else
    echo -e "${RED}❌ ERROR: Reset verification failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 PRODUCTION DATABASE RESET COMPLETE 🎉${NC}"
echo -e "${BLUE}Database is now clean and ready for use.${NC}"
echo ""
echo "Next steps:"
echo "  1. Restart your application if it's running"
echo "  2. Verify the application starts correctly"
echo "  3. Test basic functionality" 