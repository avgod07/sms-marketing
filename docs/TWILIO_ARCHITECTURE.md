# Twilio Architecture: Single Account Implementation

## Overview

This document describes the transition from per-business Twilio credentials to a single, centrally managed Twilio account architecture. This change significantly improves security, simplifies operations, and aligns with SaaS industry standards.

## Architecture Changes

### Before: Multi-Account Architecture

- Each business stored their own Twilio credentials in the database
- Auth tokens were encrypted and stored in `twilio_credentials.authTokenEncrypted`
- Complex credential management and rotation
- Higher security risk due to token storage in database

### After: Single Account Architecture

- Single Twilio account managed via environment variables
- No auth tokens stored in database
- Simplified credential management
- Enhanced security posture

## Security Benefits

### ✅ Zero Token Storage

- No sensitive credentials stored in database
- Reduced attack surface
- Easier compliance and auditing

### ✅ Centralized Control

- Single point of credential management
- Simplified rotation and updates
- Better monitoring and logging

### ✅ Reduced Complexity

- No encryption/decryption overhead
- Simplified webhook routing
- Cleaner codebase

## Implementation Details

### Database Schema

```sql
-- Removed column
ALTER TABLE twilio_credentials DROP COLUMN auth_token_encrypted;

-- Retained columns for reference
- account_sid (now always points to centralized account)
- messaging_service_sid (business-specific)
- business_id (for phone number mapping)
```

### Environment Variables

```bash
# Required for all environments
TWILIO_ACCOUNT_SID=ACyour_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890
```

### Webhook Routing

Business identification is now done via phone number mapping:

```typescript
// Find business by phone number instead of account SID
const businessId = await findBusinessIdByPhoneNumber(phoneNumber);
```

### API Changes

#### Before

```typescript
// Businesses provided their own credentials
POST /api/twilio/connect
{
  "accountSid": "AC...",
  "authToken": "token...",
  "phoneNumber": "+1234567890"
}
```

#### After

```typescript
// Businesses only provide phone numbers
POST /api/twilio/connect
{
  "phoneNumber": "+1234567890"
}
```

## Migration Process

### 1. Database Migration

```bash
# Run the migration to remove auth token column
npm run db:migrate
```

### 2. Update Environment Variables

```bash
# Set centralized Twilio credentials
export TWILIO_ACCOUNT_SID=ACyour_account_sid
export TWILIO_AUTH_TOKEN=your_auth_token
export TWILIO_PHONE_NUMBER=+1234567890
```

### 3. Restart Application

```bash
# Restart to pick up new environment variables
npm run start
```

### 4. Verify Migration

```bash
# Run verification script
./scripts/migrate-to-single-twilio-account.sh
```

## Testing Checklist

### ✅ SMS Functionality

- [ ] Send SMS messages work correctly
- [ ] Bulk SMS campaigns function properly
- [ ] Phone number validation works

### ✅ Webhook Processing

- [ ] Inbound messages route to correct businesses
- [ ] Status callbacks update message status
- [ ] Signature validation works with environment tokens

### ✅ Phone Number Management

- [ ] Purchase new phone numbers
- [ ] Assign numbers to businesses
- [ ] Set default numbers

### ✅ A2P Registration

- [ ] Business profile creation
- [ ] Campaign registration
- [ ] Brand registration

## Troubleshooting

### Common Issues

#### 1. "Twilio not configured on server"

**Cause**: Environment variables not set
**Solution**: Ensure `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` are configured

#### 2. "Unknown phone number" in webhooks

**Cause**: Phone number not mapped to business
**Solution**: Verify phone number is assigned to business in `business_phone_numbers` table

#### 3. "Invalid Twilio signature"

**Cause**: Environment token doesn't match webhook signature
**Solution**: Ensure `TWILIO_AUTH_TOKEN` matches the token used by Twilio

### Debug Commands

```bash
# Check environment variables
echo $TWILIO_ACCOUNT_SID
echo $TWILIO_AUTH_TOKEN

# Verify database state
psql $DATABASE_URL -c "SELECT COUNT(*) FROM twilio_credentials;"

# Check phone number mappings
psql $DATABASE_URL -c "SELECT business_id, phone_number FROM business_phone_numbers;"
```

## Future Considerations

### Enterprise Tier

For enterprise customers who require dedicated Twilio accounts, consider:

- Hybrid approach with environment-based fallback
- Per-business account configuration option
- Gradual migration strategy

### Monitoring

- Implement centralized Twilio usage monitoring
- Set up alerts for account limits and errors
- Track per-business usage for billing

### Compliance

- Document the security improvements for compliance audits
- Update security documentation
- Consider SOC 2 compliance benefits

## Rollback Plan

If issues arise, the system can be rolled back by:

1. Restoring the `authTokenEncrypted` column
2. Reverting to per-business credential storage
3. Updating code to use stored credentials again

However, this is not recommended due to the security benefits of the new architecture.
