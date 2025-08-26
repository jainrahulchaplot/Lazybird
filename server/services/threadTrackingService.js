import { createClient } from '@supabase/supabase-js';

class ThreadTrackingService {
  constructor(supabase) {
    this.supabase = supabase;
    this.cache = new Map(); // In-memory cache for quick lookups
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes cache timeout
  }

  // Cache management
  _getCacheKey(userId, threadId) {
    return `${userId}:${threadId}`;
  }

  _setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  _getCache(key) {
    const cached = this.cache.get(key);
    if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  _clearCache(key) {
    this.cache.delete(key);
  }

  // Core CRUD operations
  async createThread(userId, threadData) {
    try {
      const { data, error } = await this.supabase
        .from('thread_tracking')
        .insert({
          user_id: userId,
          thread_id: threadData.threadId,
          lead_id: threadData.leadId,
          tracked: threadData.tracked ?? true,
          hidden: threadData.hidden ?? false,
          system_generated: threadData.systemGenerated ?? false,
          email_type: threadData.emailType || 'manual',
          status: threadData.status || 'active',
          subject: threadData.subject,
          participants: threadData.participants || [],
          message_count: threadData.messageCount || 1,
          ai_generated: threadData.aiGenerated ?? false,
          followup_scheduled: threadData.followupScheduled ?? false,
          followup_scheduled_at: threadData.followupScheduledAt,
          followup_count: threadData.followupCount || 0
        })
        .select()
        .single();

      if (error) throw error;

      // Update cache
      const cacheKey = this._getCacheKey(userId, threadData.threadId);
      this._setCache(cacheKey, data);

      console.log(`✅ Thread created: ${threadData.threadId} for user ${userId}`);
      return { success: true, data };

    } catch (error) {
      console.error(`❌ Failed to create thread ${threadData.threadId}:`, error);
      return { success: false, error: error.message };
    }
  }

  async getThread(userId, threadId) {
    try {
      // Check cache first
      const cacheKey = this._getCacheKey(userId, threadId);
      const cached = this._getCache(cacheKey);
      if (cached) {
        console.log(`📋 Cache hit for thread: ${threadId}`);
        return { success: true, data: cached, fromCache: true };
      }

      // Fetch from database
      const { data, error } = await this.supabase
        .from('thread_tracking')
        .select(`
          *,
          leads (
            id,
            company,
            role,
            location,
            contact_email
          )
        `)
        .eq('user_id', userId)
        .eq('thread_id', threadId)
        .single();

      if (error) throw error;

      // Update cache
      this._setCache(cacheKey, data);

      console.log(`✅ Thread fetched: ${threadId} for user ${userId}`);
      return { success: true, data, fromCache: false };

    } catch (error) {
      console.error(`❌ Failed to fetch thread ${threadId}:`, error);
      return { success: false, error: error.message };
    }
  }

  async updateThread(userId, threadId, updates) {
    try {
      const { data, error } = await this.supabase
        .from('thread_tracking')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('thread_id', threadId)
        .select()
        .single();

      if (error) throw error;

      // Update cache
      const cacheKey = this._getCacheKey(userId, threadId);
      this._setCache(cacheKey, data);

      console.log(`✅ Thread updated: ${threadId} for user ${userId}`);
      return { success: true, data };

    } catch (error) {
      console.error(`❌ Failed to update thread ${threadId}:`, error);
      return { success: false, error: error.message };
    }
  }

  async deleteThread(userId, threadId) {
    try {
      const { error } = await this.supabase
        .from('thread_tracking')
        .delete()
        .eq('user_id', userId)
        .eq('thread_id', threadId);

      if (error) throw error;

      // Clear cache
      const cacheKey = this._getCacheKey(userId, threadId);
      this._clearCache(cacheKey);

      console.log(`✅ Thread deleted: ${threadId} for user ${userId}`);
      return { success: true };

    } catch (error) {
      console.error(`❌ Failed to delete thread ${threadId}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Bulk operations
  async getThreadsByUser(userId, filters = {}) {
    try {
      let query = this.supabase
        .from('thread_tracking')
        .select(`
          *,
          leads (
            id,
            company,
            role,
            location,
            contact_email
          )
        `)
        .eq('user_id', userId);

      // Apply filters
      if (filters.hidden !== undefined) {
        query = query.eq('hidden', filters.hidden);
      }
      if (filters.systemGenerated !== undefined) {
        query = query.eq('system_generated', filters.systemGenerated);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.emailType) {
        query = query.eq('email_type', filters.emailType);
      }

      // Apply sorting
      const sortBy = filters.sortBy || 'last_activity';
      const sortOrder = filters.sortOrder || 'desc';
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      // Apply pagination
      if (filters.limit) {
        query = query.limit(filters.limit);
      }
      if (filters.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
      }

      const { data, error } = await query;

      if (error) throw error;

      console.log(`✅ Fetched ${data.length} threads for user ${userId}`);
      return { success: true, data };

    } catch (error) {
      console.error(`❌ Failed to fetch threads for user ${userId}:`, error);
      return { success: false, error: error.message };
    }
  }

  async getSystemGeneratedThreads(userId) {
    return this.getThreadsByUser(userId, { 
      systemGenerated: true, 
      hidden: false,
      sortBy: 'created_at',
      sortOrder: 'desc'
    });
  }

  async getHiddenThreads(userId) {
    return this.getThreadsByUser(userId, { 
      hidden: true,
      sortBy: 'hidden_at',
      sortOrder: 'desc'
    });
  }

  async getFollowupSchedule(userId) {
    try {
      const { data, error } = await this.supabase
        .from('followup_schedule')
        .select('*')
        .eq('user_id', userId)
        .gte('followup_scheduled_at', new Date().toISOString())
        .order('followup_scheduled_at', { ascending: true });

      if (error) throw error;

      console.log(`✅ Fetched ${data.length} scheduled followups for user ${userId}`);
      return { success: true, data };

    } catch (error) {
      console.error(`❌ Failed to fetch followup schedule for user ${userId}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Thread management operations
  async hideThread(userId, threadId) {
    return this.updateThread(userId, threadId, {
      hidden: true,
      hidden_at: new Date().toISOString(),
      status: 'archived'
    });
  }

  async unhideThread(userId, threadId) {
    return this.updateThread(userId, threadId, {
      hidden: false,
      hidden_at: null,
      status: 'active'
    });
  }

  async markAsSystemGenerated(userId, threadId, emailType = 'application') {
    return this.updateThread(userId, threadId, {
      system_generated: true,
      email_type: emailType,
      ai_generated: true
    });
  }

  async scheduleFollowup(userId, threadId, scheduledAt, emailType = 'auto_followup') {
    return this.updateThread(userId, threadId, {
      followup_scheduled: true,
      followup_scheduled_at: scheduledAt,
      email_type: emailType
    });
  }

  async cancelFollowup(userId, threadId) {
    return this.updateThread(userId, threadId, {
      followup_scheduled: false,
      followup_scheduled_at: null
    });
  }

  async incrementFollowupCount(userId, threadId) {
    try {
      const { data, error } = await this.supabase
        .rpc('increment_followup_count', {
          p_user_id: userId,
          p_thread_id: threadId
        });

      if (error) throw error;

      // Clear cache to force refresh
      const cacheKey = this._getCacheKey(userId, threadId);
      this._clearCache(cacheKey);

      console.log(`✅ Followup count incremented for thread: ${threadId}`);
      return { success: true, data };

    } catch (error) {
      console.error(`❌ Failed to increment followup count for thread ${threadId}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Analytics and reporting
  async getThreadAnalytics(userId, timeRange = '30d') {
    try {
      const startDate = new Date();
      if (timeRange === '7d') startDate.setDate(startDate.getDate() - 7);
      else if (timeRange === '30d') startDate.setDate(startDate.getDate() - 30);
      else if (timeRange === '90d') startDate.setDate(startDate.getDate() - 90);

      const { data, error } = await this.supabase
        .from('thread_tracking')
        .select(`
          email_type,
          status,
          system_generated,
          followup_scheduled,
          created_at,
          last_activity
        `)
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString());

      if (error) throw error;

      // Calculate analytics
      const analytics = {
        totalThreads: data.length,
        byEmailType: {},
        byStatus: {},
        systemGenerated: data.filter(t => t.system_generated).length,
        followupScheduled: data.filter(t => t.followup_scheduled).length,
        recentActivity: data.filter(t => 
          new Date(t.last_activity) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        ).length
      };

      // Group by email type
      data.forEach(thread => {
        analytics.byEmailType[thread.email_type] = (analytics.byEmailType[thread.email_type] || 0) + 1;
        analytics.byStatus[thread.status] = (analytics.byStatus[thread.status] || 0) + 1;
      });

      console.log(`✅ Analytics generated for user ${userId}: ${timeRange}`);
      return { success: true, data: analytics };

    } catch (error) {
      console.error(`❌ Failed to generate analytics for user ${userId}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Cache management
  async clearUserCache(userId) {
    const keysToDelete = [];
    for (const [key] of this.cache) {
      if (key.startsWith(`${userId}:`)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this._clearCache(key));
    console.log(`🗑️ Cleared cache for user: ${userId} (${keysToDelete.length} entries)`);
  }

  async clearAllCache() {
    this.cache.clear();
    console.log('🗑️ Cleared all cache');
  }

  // Health check
  async healthCheck() {
    try {
      const { count, error } = await this.supabase
        .from('thread_tracking')
        .select('*', { count: 'exact', head: true });

      if (error) throw error;

      return {
        success: true,
        database: 'connected',
        cacheSize: this.cache.size,
        totalThreads: count
      };

    } catch (error) {
      return {
        success: false,
        database: 'disconnected',
        error: error.message
      };
    }
  }
}

export default ThreadTrackingService;
