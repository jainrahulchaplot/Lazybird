-- Add gmail_user_email column to settings table
-- This migration adds the missing column that stores the connected Gmail account email

ALTER TABLE settings 
ADD COLUMN IF NOT EXISTS gmail_user_email TEXT;

-- Update existing records to have an empty string for gmail_user_email if NULL
UPDATE settings 
SET gmail_user_email = '' 
WHERE gmail_user_email IS NULL;

-- Add comment to the column
COMMENT ON COLUMN settings.gmail_user_email IS 'Email address of the connected Gmail account';
