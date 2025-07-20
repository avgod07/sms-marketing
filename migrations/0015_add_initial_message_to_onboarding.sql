-- Add initial_message field to onboarding_progress table
-- This allows the initial message to be saved during onboarding progress
ALTER TABLE onboarding_progress 
ADD COLUMN IF NOT EXISTS initial_message TEXT;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_initial_message 
ON onboarding_progress(initial_message) WHERE initial_message IS NOT NULL; 