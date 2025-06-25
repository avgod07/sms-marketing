-- Create business_credits table
CREATE TABLE IF NOT EXISTS business_credits (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE(business_id)
);

-- Create credit_transactions table
CREATE TABLE IF NOT EXISTS credit_transactions (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'purchase', 'sms_sent', 'refund', 'adjustment'
  amount INTEGER NOT NULL, -- positive for credits added, negative for credits spent
  description TEXT,
  metadata JSONB, -- for storing additional data like stripe session id, campaign id, etc.
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS credit_transactions_business_id_idx ON credit_transactions(business_id);
CREATE INDEX IF NOT EXISTS credit_transactions_type_idx ON credit_transactions(type);
CREATE INDEX IF NOT EXISTS credit_transactions_created_at_idx ON credit_transactions(created_at); 