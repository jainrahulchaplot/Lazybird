# Creating Thread Tracking Table in Supabase

To enable persistent storage for hidden threads, create the following table in your Supabase database:

## SQL to run in Supabase SQL Editor:

```sql
-- Thread tracking table for persistent storage of hidden threads
CREATE TABLE IF NOT EXISTS thread_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL DEFAULT 'me',
  thread_id TEXT NOT NULL,
  tracked BOOLEAN NOT NULL DEFAULT true,
  hidden_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, thread_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_thread_tracking_user_id ON thread_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_thread_tracking_thread_id ON thread_tracking(thread_id);
CREATE INDEX IF NOT EXISTS idx_thread_tracking_tracked ON thread_tracking(tracked);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_thread_tracking_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER trigger_thread_tracking_updated_at
  BEFORE UPDATE ON thread_tracking
  FOR EACH ROW
  EXECUTE FUNCTION update_thread_tracking_updated_at();
```

## Steps:

1. Go to your Supabase dashboard
2. Navigate to SQL Editor
3. Paste the SQL above and run it
4. The table will be created and the system will automatically use it

## Benefits:

- ✅ **Persistent storage**: Hidden threads stay hidden after server restart
- ✅ **Automatic fallback**: System works with in-memory storage if table doesn't exist
- ✅ **Performance**: Indexed for fast queries
- ✅ **Data integrity**: Unique constraints prevent duplicates

## Current Status:

- 🔄 **Working**: Thread tracking system is functional with in-memory storage
- 🎯 **Next**: Create the table above for persistent storage
- ✅ **Fallback**: System gracefully handles missing table
