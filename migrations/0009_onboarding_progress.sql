CREATE TABLE onboarding_progress (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) NOT NULL UNIQUE,
  step INTEGER NOT NULL DEFAULT 1,
  
  -- Step 1: Basic Business Info (from business info form)
  business_name TEXT,
  website_url TEXT,
  address1 TEXT,
  address2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone_number TEXT,
  
  -- Step 2: Monthly Volume (for A2P)
  monthly_volume TEXT,
  
  -- Step 3: Use Cases (for A2P)
  use_cases TEXT[],
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add index for faster lookups
CREATE INDEX idx_onboarding_progress_business_id ON onboarding_progress(business_id); 