-- Add source column to contacts table
ALTER TABLE contacts ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';

-- Create index for source column
CREATE INDEX contacts_source_idx ON contacts USING btree (source);

-- Create keyword_campaigns table
CREATE TABLE keyword_campaigns (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id),
  keyword VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Create unique index for business_id + keyword combination
CREATE UNIQUE INDEX keyword_campaigns_business_id_keyword_idx ON keyword_campaigns (business_id, keyword);

-- Create performance index for keyword lookups
CREATE INDEX keyword_campaigns_business_id_keyword_lookup_idx ON keyword_campaigns (business_id, keyword);

-- Create index for active status filtering
CREATE INDEX keyword_campaigns_is_active_idx ON keyword_campaigns (is_active);

-- Create keyword_responses table
CREATE TABLE keyword_responses (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id),
  keyword_campaign_id INTEGER NOT NULL REFERENCES keyword_campaigns(id) ON DELETE CASCADE,
  contact_id INTEGER NOT NULL REFERENCES contacts(id),
  phone_number VARCHAR(20) NOT NULL,
  message_sent TEXT NOT NULL,
  responded_at TIMESTAMP NOT NULL DEFAULT now(),
  message_sid VARCHAR(64),
  status TEXT NOT NULL DEFAULT 'sent'
);

-- CRITICAL: Create unique index to ensure one response per contact per keyword EVER
CREATE UNIQUE INDEX keyword_responses_contact_id_keyword_campaign_id_idx ON keyword_responses (contact_id, keyword_campaign_id);

-- Create performance indexes for keyword_responses
CREATE INDEX keyword_responses_business_id_idx ON keyword_responses (business_id);
CREATE INDEX keyword_responses_keyword_campaign_id_idx ON keyword_responses (keyword_campaign_id);
CREATE INDEX keyword_responses_contact_id_idx ON keyword_responses (contact_id);
CREATE INDEX keyword_responses_phone_number_idx ON keyword_responses (phone_number);
CREATE INDEX keyword_responses_status_idx ON keyword_responses (status);

-- Add comment to explain the one-response-per-contact rule
COMMENT ON INDEX keyword_responses_contact_id_keyword_campaign_id_idx IS 'Ensures each contact can only respond to a specific keyword once ever'; 