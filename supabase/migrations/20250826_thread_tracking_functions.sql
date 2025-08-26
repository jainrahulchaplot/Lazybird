-- Database functions for enhanced thread tracking operations

-- Function to increment followup count
CREATE OR REPLACE FUNCTION increment_followup_count(
  p_user_id TEXT,
  p_thread_id TEXT
)
RETURNS TABLE(
  id UUID,
  thread_id TEXT,
  followup_count INTEGER,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  UPDATE thread_tracking
  SET 
    followup_count = followup_count + 1,
    updated_at = NOW()
  WHERE user_id = p_user_id AND thread_id = p_thread_id
  RETURNING id, thread_id, followup_count, updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to bulk update thread status
CREATE OR REPLACE FUNCTION bulk_update_thread_status(
  p_user_id TEXT,
  p_thread_ids TEXT[],
  p_status TEXT,
  p_hidden BOOLEAN DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  affected_rows INTEGER;
BEGIN
  UPDATE thread_tracking
  SET 
    status = p_status,
    updated_at = NOW()
  WHERE user_id = p_user_id 
    AND thread_id = ANY(p_thread_ids);
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  
  -- Update hidden status if provided
  IF p_hidden IS NOT NULL THEN
    UPDATE thread_tracking
    SET 
      hidden = p_hidden,
      hidden_at = CASE WHEN p_hidden THEN NOW() ELSE NULL END,
      updated_at = NOW()
    WHERE user_id = p_user_id 
      AND thread_id = ANY(p_thread_ids);
  END IF;
  
  RETURN affected_rows;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to archive old threads
CREATE OR REPLACE FUNCTION archive_old_threads(
  p_user_id TEXT,
  p_days_old INTEGER DEFAULT 90
)
RETURNS INTEGER AS $$
DECLARE
  affected_rows INTEGER;
BEGIN
  UPDATE thread_tracking
  SET 
    status = 'archived',
    archived_at = NOW(),
    updated_at = NOW()
  WHERE user_id = p_user_id 
    AND status = 'active'
    AND last_activity < NOW() - INTERVAL '1 day' * p_days_old;
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get thread statistics
CREATE OR REPLACE FUNCTION get_thread_statistics(
  p_user_id TEXT,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(
  total_threads BIGINT,
  active_threads BIGINT,
  hidden_threads BIGINT,
  system_generated BIGINT,
  followup_scheduled BIGINT,
  avg_response_time NUMERIC,
  total_followups BIGINT
) AS $$
BEGIN
  -- Set default date range if not provided
  IF p_start_date IS NULL THEN
    p_start_date := NOW() - INTERVAL '30 days';
  END IF;
  IF p_end_date IS NULL THEN
    p_end_date := NOW();
  END IF;
  
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_threads,
    COUNT(*) FILTER (WHERE status = 'active' AND hidden = false)::BIGINT as active_threads,
    COUNT(*) FILTER (WHERE hidden = true)::BIGINT as hidden_threads,
    COUNT(*) FILTER (WHERE system_generated = true)::BIGINT as system_generated,
    COUNT(*) FILTER (WHERE followup_scheduled = true)::BIGINT as followup_scheduled,
    AVG(response_time_hours)::NUMERIC as avg_response_time,
    SUM(followup_count)::BIGINT as total_followups
  FROM thread_tracking
  WHERE user_id = p_user_id
    AND created_at BETWEEN p_start_date AND p_end_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up orphaned threads
CREATE OR REPLACE FUNCTION cleanup_orphaned_threads(
  p_user_id TEXT
)
RETURNS INTEGER AS $$
DECLARE
  affected_rows INTEGER;
BEGIN
  -- Mark threads as deleted if they don't have a valid lead_id
  UPDATE thread_tracking
  SET 
    status = 'deleted',
    updated_at = NOW()
  WHERE user_id = p_user_id 
    AND lead_id IS NULL
    AND system_generated = false;
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to sync thread data from Gmail
CREATE OR REPLACE FUNCTION sync_thread_from_gmail(
  p_user_id TEXT,
  p_thread_id TEXT,
  p_thread_data JSONB
)
RETURNS TABLE(
  id UUID,
  thread_id TEXT,
  updated_at TIMESTAMPTZ,
  action TEXT
) AS $$
DECLARE
  existing_thread RECORD;
  action_taken TEXT;
BEGIN
  -- Check if thread exists
  SELECT * INTO existing_thread
  FROM thread_tracking
  WHERE user_id = p_user_id AND thread_id = p_thread_id;
  
  IF existing_thread IS NULL THEN
    -- Insert new thread
    INSERT INTO thread_tracking (
      user_id,
      thread_id,
      subject,
      participants,
      message_count,
      last_activity,
      updated_at
    ) VALUES (
      p_user_id,
      p_thread_id,
      p_thread_data->>'subject',
      ARRAY(SELECT jsonb_array_elements_text(p_thread_data->'participants')),
      (p_thread_data->>'messageCount')::INTEGER,
      NOW(),
      NOW()
    )
    RETURNING id, thread_id, updated_at INTO existing_thread;
    
    action_taken := 'inserted';
  ELSE
    -- Update existing thread
    UPDATE thread_tracking
    SET 
      subject = COALESCE(p_thread_data->>'subject', subject),
      participants = ARRAY(SELECT jsonb_array_elements_text(p_thread_data->'participants')),
      message_count = COALESCE((p_thread_data->>'messageCount')::INTEGER, message_count),
      last_activity = NOW(),
      updated_at = NOW()
    WHERE user_id = p_user_id AND thread_id = p_thread_id
    RETURNING id, thread_id, updated_at INTO existing_thread;
    
    action_taken := 'updated';
  END IF;
  
  RETURN QUERY
  SELECT 
    existing_thread.id,
    existing_thread.thread_id,
    existing_thread.updated_at,
    action_taken::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get threads for dashboard
CREATE OR REPLACE FUNCTION get_dashboard_threads(
  p_user_id TEXT,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE(
  id UUID,
  thread_id TEXT,
  subject TEXT,
  company TEXT,
  role TEXT,
  email_type TEXT,
  status TEXT,
  last_activity TIMESTAMPTZ,
  followup_scheduled BOOLEAN,
  followup_scheduled_at TIMESTAMPTZ,
  message_count INTEGER,
  followup_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tt.id,
    tt.thread_id,
    tt.subject,
    l.company,
    l.role,
    tt.email_type,
    tt.status,
    tt.last_activity,
    tt.followup_scheduled,
    tt.followup_scheduled_at,
    tt.message_count,
    tt.followup_count
  FROM thread_tracking tt
  LEFT JOIN leads l ON tt.lead_id = l.id
  WHERE tt.user_id = p_user_id
    AND tt.hidden = false
    AND tt.status = 'active'
  ORDER BY tt.last_activity DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION increment_followup_count(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_update_thread_status(TEXT, TEXT[], TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION archive_old_threads(TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_thread_statistics(TEXT, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_orphaned_threads(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION sync_thread_from_gmail(TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_threads(TEXT, INTEGER) TO authenticated;

-- Add comments for documentation
COMMENT ON FUNCTION increment_followup_count(TEXT, TEXT) IS 'Increments the followup count for a specific thread';
COMMENT ON FUNCTION bulk_update_thread_status(TEXT, TEXT[], TEXT, BOOLEAN) IS 'Bulk updates status and hidden state for multiple threads';
COMMENT ON FUNCTION archive_old_threads(TEXT, INTEGER) IS 'Archives threads older than specified days';
COMMENT ON FUNCTION get_thread_statistics(TEXT, TIMESTAMPTZ, TIMESTAMPTZ) IS 'Returns comprehensive statistics for threads in a date range';
COMMENT ON FUNCTION cleanup_orphaned_threads(TEXT) IS 'Marks orphaned threads as deleted';
COMMENT ON FUNCTION sync_thread_from_gmail(TEXT, TEXT, JSONB) IS 'Syncs thread data from Gmail API';
COMMENT ON FUNCTION get_dashboard_threads(TEXT, INTEGER) IS 'Returns threads for dashboard display with lead information';
