ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_complete boolean DEFAULT false NOT NULL;
