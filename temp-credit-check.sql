-- Direct SQL to check credit issues
-- Run this to see exactly what happened to your credits

-- 1. Check current credit balance
SELECT id, name, plan, 
       (SELECT balance FROM business_credits WHERE business_id = businesses.id) as current_credits
FROM businesses 
ORDER BY created_at DESC 
LIMIT 3;

-- 2. Check all credit transactions (most recent first)
SELECT ct.created_at, ct.type, ct.amount, ct.description, ct.metadata,
       b.name as business_name
FROM credit_transactions ct
JOIN businesses b ON ct.business_id = b.id
ORDER BY ct.created_at DESC
LIMIT 20;

-- 3. Check for any campaigns that might have consumed credits
SELECT id, name, status, processing_status, sent_count, created_at,
       (SELECT name FROM businesses WHERE id = campaigns.business_id) as business_name
FROM campaigns
ORDER BY created_at DESC
LIMIT 10;

-- 4. Check for committed messages (new system)
SELECT business_id, message_type, status, credit_cost, created_at, processed_at
FROM committed_messages
ORDER BY created_at DESC
LIMIT 20; 