-- Enhanced Thread Tracking System
-- This replaces the basic thread_tracking table with a production-ready schema

-- Drop existing table if it exists
DROP TABLE IF EXISTS thread_tracking CASCADE;

-- Create enhanced thread tracking table
CREATE TABLE thread_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL DEFAULT 'me',
    thread_id TEXT NOT NULL,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    
    -- Core tracking fields
    tracked BOOLEAN NOT NULL DEFAULT true,
    hidden BOOLEAN NOT NULL DEFAULT false,
    system_generated BOOLEAN NOT NULL DEFAULT false,
    
    -- Email classification
    email_type TEXT CHECK (email_type IN ('application', 'followup', 'manual', 'auto_followup')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted', 'spam')),
    
    -- Thread metadata
    subject TEXT,
    participants TEXT[], -- Array of email addresses
    message_count INTEGER DEFAULT 1,
    last_activity TIMESTAMPTZ DEFAULT NOW(),
    
    -- AI and automation fields
    ai_generated BOOLEAN DEFAULT false,
    followup_scheduled BOOLEAN DEFAULT false,
    followup_scheduled_at TIMESTAMPTZ,
    followup_count INTEGER DEFAULT 0,
    
    -- Performance and analytics
    open_rate DECIMAL(5,2), -- Percentage of emails opened
    reply_rate DECIMAL(5,2), -- Percentage of emails that got replies
    response_time_hours INTEGER, -- Time to first response in hours
    
    -- Audit fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    hidden_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT unique_user_thread UNIQUE(user_id, thread_id),
    CONSTRAINT valid_followup_schedule CHECK (
        (followup_scheduled = false) OR 
        (followup_scheduled = true AND followup_scheduled_at IS NOT NULL)
    )
);

-- Create indexes for performance
CREATE INDEX idx_thread_tracking_user_id ON thread_tracking(user_id);
CREATE INDEX idx_thread_tracking_thread_id ON thread_tracking(thread_id);
CREATE INDEX idx_thread_tracking_lead_id ON thread_tracking(lead_id);
CREATE INDEX idx_thread_tracking_status ON thread_tracking(status);
CREATE INDEX idx_thread_tracking_hidden ON thread_tracking(hidden);
CREATE INDEX idx_thread_tracking_system_generated ON thread_tracking(system_generated);
CREATE INDEX idx_thread_tracking_followup_scheduled ON thread_tracking(followup_scheduled);
CREATE INDEX idx_thread_tracking_last_activity ON thread_tracking(last_activity);
CREATE INDEX idx_thread_tracking_created_at ON thread_tracking(created_at);

-- Create composite indexes for common queries
CREATE INDEX idx_thread_tracking_user_status ON thread_tracking(user_id, status);
CREATE INDEX idx_thread_tracking_user_hidden ON thread_tracking(user_id, hidden);
CREATE INDEX idx_thread_tracking_user_system ON thread_tracking(user_id, system_generated);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_thread_tracking_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER trigger_thread_tracking_updated_at
    BEFORE UPDATE ON thread_tracking
    FOR EACH ROW
    EXECUTE FUNCTION update_thread_tracking_updated_at();

-- Create function to calculate response time
CREATE OR REPLACE FUNCTION calculate_response_time_hours()
RETURNS TRIGGER AS $$
BEGIN
    -- This will be updated when we implement response tracking
    -- For now, just ensure the field is properly set
    IF NEW.response_time_hours IS NULL THEN
        NEW.response_time_hours = 0;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for response time calculation
CREATE TRIGGER trigger_thread_tracking_response_time
    BEFORE INSERT OR UPDATE ON thread_tracking
    FOR EACH ROW
    EXECUTE FUNCTION calculate_response_time_hours();

-- Create view for active threads
CREATE VIEW active_threads AS
SELECT 
    tt.*,
    l.company,
    l.role,
    l.location
FROM thread_tracking tt
LEFT JOIN leads l ON tt.lead_id = l.id
WHERE tt.status = 'active' AND tt.hidden = false
ORDER BY tt.last_activity DESC;

-- Create view for system-generated threads
CREATE VIEW system_generated_threads AS
SELECT 
    tt.*,
    l.company,
    l.role
FROM thread_tracking tt
LEFT JOIN leads l ON tt.lead_id = l.id
WHERE tt.system_generated = true
ORDER BY tt.created_at DESC;

-- Create view for followup scheduling
CREATE VIEW followup_schedule AS
SELECT 
    tt.*,
    l.company,
    l.role,
    l.contact_email
FROM thread_tracking tt
LEFT JOIN leads l ON tt.lead_id = l.id
WHERE tt.followup_scheduled = true 
    AND tt.followup_scheduled_at > NOW()
    AND tt.status = 'active'
ORDER BY tt.followup_scheduled_at ASC;

-- Insert sample data for testing
INSERT INTO thread_tracking (
    user_id, 
    thread_id, 
    lead_id, 
    tracked, 
    hidden, 
    system_generated, 
    email_type, 
    status,
    subject,
    participants,
    message_count,
    ai_generated,
    followup_scheduled,
    followup_scheduled_at,
    followup_count
) VALUES 
(
    'me',
    '198e216fa7c5ff91',
    'bfdc839e-77ba-47c3-b01c-57ffa64de242',
    true,
    false,
    true,
    'application',
    'active',
    'Application for Senior Product Manager at LHH',
    ARRAY['jainrahulchaplot@gmail.com', 'p3h3we1@gmail.com'],
    5,
    true,
    true,
    NOW() + INTERVAL '3 days',
    1
),
(
    'me',
    '198e245969d222b2',
    'bfdc839e-77ba-47c3-b01c-57ffa64de242',
    true,
    false,
    true,
    'followup',
    'active',
    'Re: Application for Senior Product Manager at LHH',
    ARRAY['jainrahulchaplot@gmail.com', 'p3h3we1@gmail.com'],
    3,
    true,
    false,
    NULL,
    0
);

-- Grant permissions (adjust based on your Supabase setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON thread_tracking TO authenticated;
-- GRANT SELECT ON active_threads TO authenticated;
-- GRANT SELECT ON system_generated_threads TO authenticated;
-- GRANT SELECT ON followup_schedule TO authenticated;

-- Create RLS policies if needed
-- ALTER TABLE thread_tracking ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Users can view their own threads" ON thread_tracking
--     FOR SELECT USING (auth.uid()::text = user_id OR user_id = 'me');
-- CREATE POLICY "Users can insert their own threads" ON thread_tracking
--     FOR INSERT WITH CHECK (auth.uid()::text = user_id OR user_id = 'me');
-- CREATE POLICY "Users can update their own threads" ON thread_tracking
--     FOR UPDATE USING (auth.uid()::text = user_id OR user_id = 'me');

COMMENT ON TABLE thread_tracking IS 'Enhanced thread tracking system with comprehensive email thread management';
COMMENT ON COLUMN thread_tracking.thread_id IS 'Gmail thread ID for tracking';
COMMENT ON COLUMN thread_tracking.lead_id IS 'Associated lead from leads table';
COMMENT ON COLUMN thread_tracking.email_type IS 'Classification of email type';
COMMENT ON COLUMN thread_tracking.status IS 'Current status of the thread';
COMMENT ON COLUMN thread_tracking.participants IS 'Array of email addresses in the thread';
COMMENT ON COLUMN thread_tracking.followup_scheduled IS 'Whether a followup is scheduled';
COMMENT ON COLUMN thread_tracking.followup_scheduled_at IS 'When the followup should be sent';
COMMENT ON COLUMN thread_tracking.response_time_hours IS 'Time to first response in hours';
