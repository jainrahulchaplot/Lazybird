import { Thread, ThreadSummary, SendEmailRequest } from '../types/applications';

const API_BASE = 'http://localhost:3001/api';

export const gmailApi = {
  // Get sent threads, optionally filtered by lead IDs
  async getSentThreads(leadIds?: string[]): Promise<ThreadSummary[]> {
    const params = leadIds && leadIds.length > 0 
      ? `?leadIds=${leadIds.join(',')}` 
      : '';
    
    const response = await fetch(`${API_BASE}/gmail/sent${params}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch sent threads: ${response.statusText}`);
    }
    
    const data = await response.json();
    if (data.success && data.threads) {
      return data.threads;
    }
    return [];
  },

  // Get delta updates for sent threads (incremental refresh)
  async getSentDelta(sinceISO: string, leadIds?: string[]): Promise<{ added: ThreadSummary[], updated: ThreadSummary[], removed: string[] }> {
    const params = new URLSearchParams();
    params.append('sinceISO', sinceISO);
    if (leadIds && leadIds.length > 0) {
      params.append('leadIds', leadIds.join(','));
    }
    
    const response = await fetch(`${API_BASE}/gmail/sent/delta?${params}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch delta: ${response.statusText}`);
    }
    
    const data = await response.json();
    if (data.success) {
      return {
        added: data.added || [],
        updated: data.updated || [],
        removed: data.removed || []
      };
    }
    return { added: [], updated: [], removed: [] };
  },

  // NEW: Get complete threads including incoming replies (for full refresh)
  async getCompleteThreads(leadIds?: string[]): Promise<ThreadSummary[]> {
    const params = leadIds && leadIds.length > 0 
      ? `?leadIds=${leadIds.join(',')}` 
      : '';
    
    const response = await fetch(`${API_BASE}/gmail/threads/complete${params}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch complete threads: ${response.statusText}`);
    }
    
    const data = await response.json();
    if (data.success && data.threads) {
      return data.threads;
    }
    return [];
  },

  // Get full thread details with attachments
  async getThread(threadId: string): Promise<Thread> {
    const response = await fetch(`${API_BASE}/gmail/thread/full`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadId })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch thread: ${response.statusText}`);
    }
    
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch thread');
    }
    
    return data.thread;
  },

  // Send email (new or reply)
  async sendEmail(request: SendEmailRequest): Promise<{ success: boolean; messageId?: string }> {
    // Convert EmailAddress objects to strings for the API
    const apiRequest = {
      ...request,
      to: request.to.map(addr => addr.email),
      cc: request.cc?.map(addr => addr.email) || []
    };
    
    const response = await fetch(`${API_BASE}/gmail/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apiRequest)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to send email: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  }
};
