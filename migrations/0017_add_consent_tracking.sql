-- Migration: Add Consent Tracking Fields
-- Description: Adds consent tracking for TCPA compliance

-- Add consent tracking fields to contacts table
ALTER TABLE contacts 
ADD COLUMN consent_date TIMESTAMP DEFAULT NOW() NOT NULL,
ADD COLUMN consent_method VARCHAR(20) DEFAULT 'admin_added' NOT NULL;

-- Create index for consent queries
CREATE INDEX idx_contacts_consent_date ON contacts(consent_date);
CREATE INDEX idx_contacts_consent_method ON contacts(consent_method);

-- Update existing contacts to have proper consent tracking
-- All existing contacts will be marked as admin_added with current timestamp
UPDATE contacts 
SET consent_date = created_at, 
    consent_method = 'admin_added' 
WHERE consent_date IS NULL; 