#!/bin/bash

# Migration Script: Transition to Single Twilio Account Architecture
# This script helps migrate from per-business Twilio credentials to a single, centralized account

set -e

echo "🚀 Starting migration to single Twilio account architecture..."

# Check if we're in the right environment
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL environment variable is not set"
    exit 1
fi

if [ -z "$TWILIO_ACCOUNT_SID" ] || [ -z "$TWILIO_AUTH_TOKEN" ]; then
    echo "❌ TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set"
    exit 1
fi

echo "✅ Environment variables configured"

# Step 1: Run the database migration
echo "📊 Running database migration..."
npm run db:migrate

# Step 2: Update existing records to use centralized account SID
echo "🔄 Updating existing Twilio credentials..."
psql $DATABASE_URL << EOF
-- Update all existing records to use the centralized account SID
UPDATE twilio_credentials 
SET account_sid = '$TWILIO_ACCOUNT_SID'
WHERE account_sid != '$TWILIO_ACCOUNT_SID';

-- Verify the update
SELECT COUNT(*) as updated_records FROM twilio_credentials WHERE account_sid = '$TWILIO_ACCOUNT_SID';
EOF

# Step 3: Verify the migration
echo "🔍 Verifying migration..."
psql $DATABASE_URL << EOF
-- Check that no auth tokens remain in the database
SELECT COUNT(*) as remaining_auth_tokens 
FROM information_schema.columns 
WHERE table_name = 'twilio_credentials' 
AND column_name = 'auth_token_encrypted';

-- Check that all businesses use the centralized account
SELECT COUNT(*) as businesses_using_centralized_account
FROM twilio_credentials 
WHERE account_sid = '$TWILIO_ACCOUNT_SID';
EOF

echo "✅ Migration completed successfully!"
echo ""
echo "📋 Summary of changes:"
echo "  • Removed authTokenEncrypted column from database"
echo "  • All businesses now use centralized Twilio account"
echo "  • Credentials managed via environment variables only"
echo "  • Webhook routing based on phone number mapping"
echo ""
echo "🔒 Security improvements:"
echo "  • Zero token storage in database"
echo "  • Reduced attack surface"
echo "  • Centralized credential management"
echo ""
echo "⚠️  Next steps:"
echo "  1. Restart your application server"
echo "  2. Test SMS functionality"
echo "  3. Verify webhook routing works correctly"
echo "  4. Update any client-side code that expected auth tokens" 