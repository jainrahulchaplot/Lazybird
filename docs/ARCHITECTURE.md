# 🏗️ **Enhanced Thread Tracking Architecture**

## **Overview**

This document outlines the architecture for the enhanced thread tracking system that replaces the previous in-memory fallback approach with a robust, database-first solution.

## **🏛️ Architecture Layers**

### **1. Database Layer (Supabase)**
- **Primary Storage**: PostgreSQL with enhanced schema
- **Performance**: Optimized indexes and views
- **Scalability**: Built-in connection pooling and caching

### **2. Service Layer (Node.js)**
- **ThreadTrackingService**: Core business logic
- **RedisService**: Advanced caching layer
- **Fallback Support**: In-memory fallback for resilience

### **3. API Layer (Express.js)**
- **REST Endpoints**: CRUD operations for threads
- **Middleware**: Authentication, validation, error handling
- **Integration**: Gmail API, OpenAI API

### **4. Frontend Layer (React)**
- **State Management**: Zustand with thread tracking
- **API Integration**: Service-based API calls
- **Real-time Updates**: WebSocket support (future)

## **🗄️ Database Schema**

### **Core Table: `thread_tracking`**
```sql
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
    participants TEXT[],
    message_count INTEGER DEFAULT 1,
    last_activity TIMESTAMPTZ DEFAULT NOW(),
    
    -- AI and automation fields
    ai_generated BOOLEAN DEFAULT false,
    followup_scheduled BOOLEAN DEFAULT false,
    followup_scheduled_at TIMESTAMPTZ,
    followup_count INTEGER DEFAULT 0,
    
    -- Performance and analytics
    open_rate DECIMAL(5,2),
    reply_rate DECIMAL(5,2),
    response_time_hours INTEGER,
    
    -- Audit fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    hidden_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT unique_user_thread UNIQUE(user_id, thread_id)
);
```

### **Performance Indexes**
- **Primary Lookups**: `user_id`, `thread_id`
- **Filtering**: `status`, `hidden`, `system_generated`
- **Sorting**: `last_activity`, `created_at`
- **Composite**: `user_id + status`, `user_id + hidden`

### **Database Views**
- **`active_threads`**: Currently active threads with lead info
- **`system_generated_threads`**: AI-generated email threads
- **`followup_schedule`**: Scheduled followup emails

## **⚙️ Service Architecture**

### **ThreadTrackingService**
```javascript
class ThreadTrackingService {
  // Core CRUD operations
  async createThread(userId, threadData)
  async getThread(userId, threadId)
  async updateThread(userId, threadId, updates)
  async deleteThread(userId, threadId)
  
  // Bulk operations
  async getThreadsByUser(userId, filters)
  async getSystemGeneratedThreads(userId)
  async getHiddenThreads(userId)
  
  // Thread management
  async hideThread(userId, threadId)
  async unhideThread(userId, threadId)
  async markAsSystemGenerated(userId, threadId, emailType)
  
  // Followup management
  async scheduleFollowup(userId, threadId, scheduledAt)
  async cancelFollowup(userId, threadId)
  async incrementFollowupCount(userId, threadId)
  
  // Analytics
  async getThreadAnalytics(userId, timeRange)
  
  // Cache management
  async clearUserCache(userId)
  async clearAllCache()
}
```

### **RedisService (Optional)**
```javascript
class RedisService {
  // Cache operations
  async get(key)
  async set(key, value, ttl)
  async del(key)
  async clearPattern(pattern)
  
  // Health monitoring
  async healthCheck()
}
```

## **🔄 Data Flow**

### **1. Thread Creation**
```
Gmail API → Thread Detection → ThreadTrackingService.createThread() → Database + Cache
```

### **2. Thread Retrieval**
```
Request → Cache Check → Database Query → Cache Update → Response
```

### **3. Thread Updates**
```
Update Request → Database Update → Cache Invalidation → Cache Update → Response
```

### **4. Thread Hiding**
```
Hide Request → ThreadTrackingService.hideThread() → Database Update → Cache Update → Response
```

## **📊 Performance Characteristics**

### **Latency Targets**
- **Cache Hit**: < 5ms
- **Database Query**: < 50ms
- **API Response**: < 100ms

### **Throughput Targets**
- **Read Operations**: 1000+ requests/second
- **Write Operations**: 100+ requests/second
- **Concurrent Users**: 100+ simultaneous users

### **Scalability**
- **Horizontal**: Database read replicas
- **Vertical**: Connection pooling, query optimization
- **Caching**: Multi-layer caching strategy

## **🛡️ Resilience & Fallback**

### **Primary Path**
1. **Redis Cache** (if available)
2. **Database Query**
3. **Cache Update**

### **Fallback Path**
1. **In-memory Cache** (Map-based)
2. **Graceful Degradation**
3. **Error Logging**

### **Error Handling**
- **Database Failures**: Fallback to in-memory
- **Cache Failures**: Direct database access
- **Service Failures**: Graceful degradation

## **🔧 Configuration**

### **Environment Variables**
```bash
# Database
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_key

# Redis (Optional)
REDIS_URL=redis://localhost:6379

# Thread Tracking
THREAD_CACHE_TTL=300
THREAD_BATCH_SIZE=100
```

### **Service Configuration**
```javascript
const config = {
  cache: {
    ttl: 300, // 5 minutes
    maxSize: 1000,
    cleanupInterval: 60000 // 1 minute
  },
  database: {
    connectionPool: 10,
    queryTimeout: 30000,
    retryAttempts: 3
  }
};
```

## **📈 Monitoring & Observability**

### **Metrics to Track**
- **Cache Hit Rate**: Target > 80%
- **Database Query Time**: Target < 50ms
- **API Response Time**: Target < 100ms
- **Error Rate**: Target < 1%

### **Logging Strategy**
- **Structured Logging**: JSON format with correlation IDs
- **Log Levels**: ERROR, WARN, INFO, DEBUG
- **Performance Logging**: Query times, cache performance

### **Health Checks**
- **Database Connectivity**: Connection pool status
- **Cache Health**: Redis connectivity and performance
- **Service Health**: Thread tracking service status

## **🚀 Deployment Strategy**

### **Phase 1: Database Migration**
1. Run enhanced schema migration
2. Test with existing data
3. Verify performance improvements

### **Phase 2: Service Integration**
1. Deploy ThreadTrackingService
2. Update API endpoints
3. Test fallback mechanisms

### **Phase 3: Caching Layer**
1. Deploy Redis service
2. Implement cache warming
3. Monitor cache performance

### **Phase 4: Optimization**
1. Performance tuning
2. Load testing
3. Production monitoring

## **🔮 Future Enhancements**

### **Short Term (1-2 months)**
- **Real-time Updates**: WebSocket integration
- **Advanced Analytics**: Thread performance metrics
- **Automated Cleanup**: Orphaned thread management

### **Medium Term (3-6 months)**
- **Machine Learning**: Thread classification
- **Predictive Analytics**: Response time prediction
- **Advanced Caching**: Intelligent cache invalidation

### **Long Term (6+ months)**
- **Microservices**: Service decomposition
- **Event Sourcing**: Thread event history
- **Global Distribution**: Multi-region deployment

## **📚 Best Practices**

### **Database Operations**
- Use parameterized queries
- Implement connection pooling
- Add proper error handling
- Use transactions for complex operations

### **Caching Strategy**
- Cache frequently accessed data
- Implement cache invalidation
- Use appropriate TTL values
- Monitor cache performance

### **Error Handling**
- Log all errors with context
- Implement retry mechanisms
- Provide graceful fallbacks
- Monitor error rates

### **Performance Optimization**
- Use database indexes effectively
- Implement query optimization
- Monitor slow queries
- Use connection pooling

## **🔄 Migration Guide**

### **From In-Memory to Database**
1. **Backup**: Export current thread data
2. **Migration**: Run enhanced schema migration
3. **Data Import**: Import existing thread data
4. **Service Update**: Deploy new service layer
5. **Testing**: Verify functionality and performance
6. **Cleanup**: Remove old in-memory code

### **Rollback Plan**
1. **Service Rollback**: Revert to previous service version
2. **Database Rollback**: Restore previous schema
3. **Data Recovery**: Restore from backup
4. **Verification**: Confirm system functionality

---

*This architecture provides a robust, scalable foundation for thread tracking with proper fallback mechanisms and performance optimization.*
