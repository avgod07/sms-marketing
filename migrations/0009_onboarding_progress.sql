CREATE TABLE IF NOT EXISTS onboarding_progress (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) UNIQUE,
  step INTEGER NOT NULL DEFAULT 1,
  business_info JSONB,
  monthly_volume TEXT,
  use_cases TEXT[],
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
