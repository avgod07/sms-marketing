-- Add subscription fields to businesses table
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'trial',
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(64),
ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(64);

-- Create subscription_plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  price_id VARCHAR(64) NOT NULL,
  price_monthly INTEGER NOT NULL,
  price_yearly INTEGER NOT NULL,
  features TEXT[],
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create subscription_events table
CREATE TABLE IF NOT EXISTS subscription_events (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  stripe_event_id VARCHAR(64),
  metadata TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_subscription_events_business_id ON subscription_events(business_id);
CREATE INDEX IF NOT EXISTS idx_subscription_events_event_type ON subscription_events(event_type);
CREATE INDEX IF NOT EXISTS idx_businesses_plan ON businesses(plan);
CREATE INDEX IF NOT EXISTS idx_businesses_stripe_customer_id ON businesses(stripe_customer_id);

-- Insert default subscription plans
INSERT INTO subscription_plans (name, display_name, price_id, price_monthly, price_yearly, features) VALUES
('starter', 'Starter Plan', 'price_starter_monthly', 2000, 18000, ARRAY['Unlimited SMS campaigns', 'Basic analytics', 'Email support']);

-- Set trial end date for existing businesses (14 days from now)
UPDATE businesses 
SET trial_ends_at = NOW() + INTERVAL '14 days'
WHERE plan = 'trial' AND trial_ends_at IS NULL; 