-- Create keywords table for keyword-based SMS opt-ins
CREATE TABLE IF NOT EXISTS keywords (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  welcome_message TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  opt_in_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create keyword_opt_ins table to track opt-ins
CREATE TABLE IF NOT EXISTS keyword_opt_ins (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  keyword_id INTEGER NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
  contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  phone_number VARCHAR(20) NOT NULL,
  opted_in_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_keywords_business_id ON keywords(business_id);
CREATE INDEX IF NOT EXISTS idx_keywords_keyword ON keywords(keyword);
CREATE INDEX IF NOT EXISTS idx_keywords_is_active ON keywords(is_active);
CREATE INDEX IF NOT EXISTS idx_keyword_opt_ins_business_id ON keyword_opt_ins(business_id);
CREATE INDEX IF NOT EXISTS idx_keyword_opt_ins_keyword_id ON keyword_opt_ins(keyword_id);
CREATE INDEX IF NOT EXISTS idx_keyword_opt_ins_contact_id ON keyword_opt_ins(contact_id);
CREATE INDEX IF NOT EXISTS idx_keyword_opt_ins_phone_number ON keyword_opt_ins(phone_number);

-- Create unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS idx_keywords_business_keyword_unique 
  ON keywords(business_id, keyword);
CREATE UNIQUE INDEX IF NOT EXISTS idx_keyword_opt_ins_unique 
  ON keyword_opt_ins(business_id, contact_id, keyword_id); 