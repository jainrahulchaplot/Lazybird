# Thread Tracking System

## Overview
The thread tracking system allows users to hide/delete threads from their view. Hidden threads are filtered out at the backend API level, ensuring they don't reappear after refresh.

## How It Works

### Backend (Server)
- **In-memory storage**: `threadTracking` Map stores hidden thread IDs
- **Hide endpoint**: `POST /api/gmail/thread/hide` marks threads as hidden
- **Filtering**: `/api/gmail/sent` endpoint filters out hidden threads
- **Debug endpoint**: `GET /api/gmail/threads/hidden` shows hidden threads

### Frontend (Client)
- **Delete action**: Calls backend hide endpoint + marks as untracked in local cache
- **Refresh**: Fetches from backend (which already filters hidden threads)
- **Persistent**: Hidden threads stay hidden across refreshes

## Current Status

✅ **Hybrid System**: Thread tracking works with both in-memory and database storage
- **In-memory**: Works immediately without database setup
- **Database**: Persistent storage when table is created (see `create_thread_tracking_table.md`)
- **Fallback**: System gracefully handles missing database table

## Limitations

⚠️ **In-Memory Only**: If database table is not created, tracking is lost on server restart
- Hidden threads will reappear after server restart
- Solution: Create the database table for persistent storage

## Future Improvements

1. **Database Storage**: Store tracking status in Supabase
2. **User Preferences**: Allow users to customize tracking behavior
3. **Bulk Operations**: Hide multiple threads at once
4. **Restore Function**: Allow users to unhide threads

## API Endpoints

```bash
# Hide a thread
POST /api/gmail/thread/hide
Body: {"threadId": "thread_id_here"}

# Get hidden threads (debug)
GET /api/gmail/threads/hidden

# Get sent threads (automatically filters hidden)
GET /api/gmail/sent
```

## Testing

1. Hide a thread: `curl -X POST http://localhost:3001/api/gmail/thread/hide -H "Content-Type: application/json" -d '{"threadId":"thread_id"}'`
2. Check hidden threads: `curl http://localhost:3001/api/gmail/threads/hidden`
3. Verify filtering: `curl http://localhost:3001/api/gmail/sent | jq '.threads | length'`
