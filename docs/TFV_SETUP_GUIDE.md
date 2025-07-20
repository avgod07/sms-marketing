# Twilio Toll-Free Verification (TFV) Setup & Audit Guide

This guide will walk you through setting up and auditing your complete Twilio toll-free verification pipeline to ensure it works perfectly from environment setup to sending your first campaign.

## 🎯 Overview

The TFV audit system provides comprehensive testing of:

- **Trust Hub Customer Profile** setup and verification
- **Toll-free number purchase** and automatic TFV submission
- **TFV status monitoring** and webhook handling
- **Message flow testing** once TFV is approved
- **Compliance verification** including opt-in/opt-out flows

## 📋 Prerequisites

### 1. Environment Variables

Copy the production environment example and fill in your values:

```bash
cp env.production.example .env
```

**Required Variables:**

```bash
# Core Twilio Configuration
TWILIO_ACCOUNT_SID=ACyour_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_BUSINESS_PROFILE_SID=BUyour_business_profile_sid_here

# Database
DATABASE_URL=postgres://user:password@host:port/database

# Authentication
CLERK_SECRET_KEY=sk_your_clerk_secret_here

# Application
NODE_ENV=development
BASE_URL=http://localhost:3000
```

**Optional but Recommended:**

```bash
# For webhook testing
TWILIO_WEBHOOK_URL=https://yourdomain.com/api/twilio/webhook

# For image/media testing
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_S3_BUCKET_NAME=your-bucket-name
```

### 2. Trust Hub Customer Profile

Before running TFV audits, you need an approved Trust Hub Customer Profile:

1. **Create Customer Profile** in [Twilio Console](https://console.twilio.com/us1/develop/trust-hub/customer-profiles)
2. **Submit for verification** with your business information
3. **Wait for approval** (typically 1-3 business days)
4. **Copy the Profile SID** to `TWILIO_BUSINESS_PROFILE_SID`

### 3. Database Setup

Ensure your database is running and up-to-date:

```bash
npm run db:push
```

## 🚀 Running TFV Audits

### Quick Health Check

Start with a quick health check to verify basic setup:

```bash
npm run audit:tfv:quick
```

This checks:

- Environment variables are set
- Database connectivity
- Trust Hub Customer Profile status
- Basic Twilio API access

### Comprehensive Audit

Run a full audit of the TFV pipeline:

```bash
# Basic comprehensive audit
npm run audit:tfv

# With test phone number for messaging
npm run audit:tfv -- --test-phone +15551234567 --include-messaging

# With sample business data
npm run audit:tfv -- --sample-data --test-phone +15551234567
```

### Production Readiness Check

Before going live, run the production readiness assessment:

```bash
npm run audit:tfv:production -- --business-id 1
```

## 📊 Understanding Audit Results

### Success Indicators ✅

- **Environment**: All required variables set
- **Trust Hub**: Customer Profile approved
- **Phone Purchase**: Numbers available for purchase
- **TFV Monitoring**: Status tracking functional
- **Message Flow**: SMS/MMS sending works
- **Compliance**: Opt-in/opt-out handling proper

### Common Issues & Solutions ❌

| Issue                          | Solution                                                |
| ------------------------------ | ------------------------------------------------------- |
| Missing environment variables  | Check `.env` file against requirements                  |
| Customer Profile not approved  | Wait for Trust Hub approval or contact support          |
| Database connection failed     | Verify `DATABASE_URL` and database is running           |
| No toll-free numbers available | Check Twilio account limits or try different area codes |
| TFV submission failed          | Ensure business data is complete and accurate           |
| Message sending failed         | Verify phone number format and TFV approval             |

## 🔍 Detailed Audit Commands

### Environment-Specific Testing

```bash
# Test with specific business
npm run audit:tfv -- --business-id 123

# Skip compliance checks
npm run audit:tfv -- --skip-compliance

# Generate detailed report
npm run audit:tfv -- --business-id 1 --test-phone +15551234567

# Test mode without actual purchases
npm run audit:tfv -- --sample-data --no-report
```

### Debugging Options

```bash
# View help and all options
tsx scripts/run-tfv-audit.ts --help

# Enable verbose logging
DEBUG=* npm run audit:tfv

# Test specific components
npm run audit:tfv -- --business-id 1 --include-messaging --skip-compliance
```

## 📈 Production Deployment Checklist

Before deploying to production:

- [ ] **Environment Setup**: All required variables configured
- [ ] **Trust Hub**: Customer Profile approved and SID set
- [ ] **Database**: Schema up-to-date with `npm run db:push`
- [ ] **Webhooks**: `TWILIO_WEBHOOK_URL` configured for status updates
- [ ] **Business Data**: Real business information in forms
- [ ] **Phone Numbers**: Toll-free numbers purchased and TFV submitted
- [ ] **Message Testing**: SMS/MMS sending verified
- [ ] **Compliance**: Opt-in/opt-out flows tested
- [ ] **Monitoring**: TFV status checking functional
- [ ] **Credits**: Sufficient balance for message sending

## 🛠️ Troubleshooting

### Environment Issues

```bash
# Check environment variables
node -e "console.log(process.env.TWILIO_ACCOUNT_SID ? 'Twilio SID set' : 'Missing TWILIO_ACCOUNT_SID')"

# Test database connection
npm run db:studio
```

### Twilio API Issues

```bash
# Test Twilio connectivity
curl -X GET "https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}.json" \
  -u "${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}"
```

### Trust Hub Issues

1. Check Customer Profile status in [Twilio Console](https://console.twilio.com/us1/develop/trust-hub/customer-profiles)
2. Verify business information is complete and accurate
3. Contact Twilio support if profile is rejected

### TFV Submission Issues

1. Ensure Customer Profile is `twilio-approved`
2. Verify business data completeness
3. Check toll-free number is purchased
4. Review TFV submission requirements in Twilio docs

## 📞 Support

If you encounter issues:

1. **Check the generated audit report** for specific recommendations
2. **Review Twilio Console** for Customer Profile and TFV status
3. **Check application logs** for detailed error messages
4. **Run health check** with `npm run audit:tfv:quick`

## 🎉 Success Criteria

Your TFV pipeline is ready for production when:

- ✅ **Environment audit passes** (all variables set)
- ✅ **Trust Hub approved** (Customer Profile ready)
- ✅ **TFV submissions working** (automatic on number purchase)
- ✅ **Message sending functional** (SMS/MMS working)
- ✅ **Compliance verified** (opt-in/opt-out handling)
- ✅ **Monitoring active** (status updates working)
- ✅ **Production readiness score > 95%**

## 🚀 Next Steps

After audit passes:

1. **Deploy to production** environment
2. **Purchase your first toll-free number**
3. **Submit TFV for approval** (2-5 business days)
4. **Monitor TFV status** via audit tools
5. **Send your first campaign** once approved!

---

**Ready to audit your TFV pipeline?** Run `npm run audit:tfv:production` to get started! 🎯
