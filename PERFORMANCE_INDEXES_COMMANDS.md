# Performance Indexes for Fair Rate Limiting

**📋 When to use:** Around 200-500 businesses when you notice slower queue processing

## 🎯 Signs You Need These Indexes

Run this command to check your current performance:

```bash
# SSH into your EC2 instance
ssh -i your-key-file.pem ec2-user@YOUR_EC2_IP

# Check database query performance
docker-compose -f docker-compose.prod.yml logs | grep "Queue processor cycle completed"
```

**If you see processing times > 2-3 seconds, it's time to add indexes.**

---

## 🚀 Option 1: Quick Database Access (Recommended)

### Step 1: SSH into your EC2 instance

```bash
# Replace with your actual key file and IP from deployment
ssh -i sms-app-production-key.pem ec2-user@YOUR_EC2_IP
cd /opt/sms-app
```

### Step 2: Access PostgreSQL via Docker

```bash
# Get into the database container
docker-compose -f docker-compose.prod.yml exec -it app bash

# Connect to PostgreSQL (using your DATABASE_URL from .env.production)
psql $DATABASE_URL

# You should now see: postgres=#
```

### Step 3: Create the Performance Indexes

```sql
-- CRITICAL INDEX: Queue processing (1-minute frequency)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_message_queue_ready_to_send
ON message_queue(scheduled_for, status)
WHERE status = 'pending';

-- IMPORTANT INDEX: Scheduled campaigns (30-second frequency)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_scheduled_ready
ON campaigns(scheduled_send_time, status, scheduling_type)
WHERE status = 'scheduled' AND scheduling_type = 'scheduled';

-- HELPFUL INDEX: Business-specific operations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_message_queue_business_status
ON message_queue(business_id, status, scheduled_for)
WHERE status IN ('pending', 'processing');

-- OPTIONAL INDEX: Queue statistics monitoring
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_message_queue_status_created
ON message_queue(status, created_at);

-- OPTIONAL INDEX: Campaign tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_message_queue_metadata_campaign
ON message_queue USING gin(metadata)
WHERE metadata IS NOT NULL;

-- Update database statistics for optimal query planning
ANALYZE message_queue;
ANALYZE campaigns;

-- Exit PostgreSQL
\q
```

### Step 4: Verify Indexes Were Created

```sql
-- Check that indexes exist
SELECT indexname, tablename
FROM pg_indexes
WHERE indexname LIKE 'idx_message_queue%' OR indexname LIKE 'idx_campaigns%';

-- Should show 5 indexes if all were created successfully
```

---

## 🛠️ Option 2: Direct RDS Access (Advanced)

If you prefer to connect directly to RDS instead of through Docker:

### Step 1: Get your RDS endpoint

```bash
# From your EC2 instance
cat .env.production | grep DATABASE_URL
# Example: postgres://myuser:password@your-rds-endpoint.us-east-1.rds.amazonaws.com:5432/smsapp
```

### Step 2: Install PostgreSQL client (if not already installed)

```bash
sudo apt-get update
sudo apt-get install -y postgresql-client
```

### Step 3: Connect directly to RDS

```bash
# Replace with your actual RDS connection details from DATABASE_URL
psql -h your-rds-endpoint.us-east-1.rds.amazonaws.com -U myuser -d smsapp -p 5432

# Enter password when prompted
```

### Step 4: Run the same SQL commands from Option 1

---

## 📊 Performance Monitoring Commands

### Check Index Usage

```sql
-- See which indexes are being used
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE indexname LIKE 'idx_message_queue%' OR indexname LIKE 'idx_campaigns%'
ORDER BY idx_scan DESC;
```

### Monitor Query Performance

```sql
-- Check slow queries (run this before and after adding indexes)
SELECT query, mean_time, calls
FROM pg_stat_statements
WHERE query LIKE '%message_queue%' OR query LIKE '%campaigns%'
ORDER BY mean_time DESC
LIMIT 10;
```

### Check Database Performance

```bash
# From your EC2 instance - monitor app logs for performance improvements
docker-compose -f docker-compose.prod.yml logs -f | grep "Queue processor cycle completed"

# You should see processing times drop from 1000-3000ms to 50-200ms
```

---

## 🎯 Expected Performance Improvements

**Before Indexes:**

- Queue processing: 1-3 seconds per cycle
- Database CPU: High during processing
- 500+ businesses: Likely timeouts

**After Indexes:**

- Queue processing: 50-200ms per cycle
- Database CPU: Normal/low
- 1000+ businesses: Smooth operation

---

## 🚨 Troubleshooting

### If indexes fail to create:

```sql
-- Check for existing indexes with similar names
SELECT indexname FROM pg_indexes WHERE indexname LIKE 'idx_%';

-- Check for table locks (other processes using tables)
SELECT pid, usename, query, state
FROM pg_stat_activity
WHERE query LIKE '%message_queue%' AND state = 'active';
```

### If you get permission errors:

```bash
# Make sure you're using the correct database user from your .env.production
cat .env.production | grep DATABASE_URL

# The user in DATABASE_URL should have CREATE privileges
```

### Verify your app is using the indexes:

```bash
# Check app metrics endpoint (if monitoring is enabled)
curl http://localhost:5000/api/metrics/fair-processor/health

# Check background job performance in logs
docker-compose -f docker-compose.prod.yml logs | grep "processing.*completed" | tail -10
```

---

## 📝 Notes

- **CONCURRENTLY** means indexes are built without locking your tables (app keeps running)
- **IF NOT EXISTS** means it's safe to run these commands multiple times
- These indexes will use ~10-50MB of additional disk space (negligible)
- Index creation takes 30 seconds to 5 minutes depending on data size
- **No application restart required** - improvements are immediate

---

## 🎯 When You'll Need This

| Businesses | Status      | Action                                  |
| ---------- | ----------- | --------------------------------------- |
| 0-100      | ✅ Fine     | No action needed                        |
| 100-200    | ⚠️ Monitor  | Watch queue processing times            |
| 200-500    | 🟡 Consider | Add indexes when processing > 2 seconds |
| 500+       | 🚨 Critical | Definitely need indexes                 |

**Bottom line:** Run these commands when queue processing consistently takes more than 2-3 seconds per cycle.
