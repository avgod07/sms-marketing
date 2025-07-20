-- Migration for Free Trial Subscription System
-- This adds tracking for trial usage and plan constraints

-- Add trial tracking fields to businesses table
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS trial_used BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS trial_voided_at TIMESTAMP;

-- Add plan constraints to ensure valid plan values
ALTER TABLE businesses 
DROP CONSTRAINT IF EXISTS businesses_plan_check;

ALTER TABLE businesses 
ADD CONSTRAINT businesses_plan_check 
CHECK (plan IN ('free_trial', 'starter', 'cancelled'));

-- Create index for trial_used for faster queries
CREATE INDEX IF NOT EXISTS idx_businesses_trial_used ON businesses(trial_used);
CREATE INDEX IF NOT EXISTS idx_businesses_trial_voided_at ON businesses(trial_voided_at);

-- Update existing businesses to use new plan names and trial tracking
-- Businesses currently on 'trial' plan with no subscription become 'free_trial'
UPDATE businesses 
SET 
  plan = 'free_trial',
  trial_used = FALSE
WHERE plan = 'trial' AND stripe_subscription_id IS NULL;

-- Businesses that have ever had a subscription get marked as trial_used
UPDATE businesses 
SET 
  trial_used = TRUE,
  trial_voided_at = COALESCE(created_at, NOW()) -- Use creation date or current time
WHERE stripe_subscription_id IS NOT NULL OR plan != 'trial';

-- Businesses currently on 'trial' but with subscription history become 'cancelled'
UPDATE businesses 
SET 
  plan = 'cancelled'
WHERE plan = 'trial' AND stripe_subscription_id IS NOT NULL; 