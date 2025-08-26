import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshCw, Filter } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '../../components/ui/Button';
import { LeadMultiSelect } from './components/LeadMultiSelect';
import { ThreadList } from './components/ThreadList';
import { ThreadView } from './components/ThreadView';
import { AutoFollowupAgent } from './components/AutoFollowupAgent';
import { Composer } from './components/Composer';
import { Lead, Thread, ThreadSummary, Attachment, Message } from '../../lib/types/applications';
import { leadsApi } from '../../lib/api/leads';
import { gmailApi } from '../../lib/api/gmail';
import { aiApi } from '../../lib/api/ai';
import { mailCache } from '../../lib/cache/mailCache';

// No more mock data - using real APIs

export const ApplicationsMail: React.FC = () => {
  console.log('ApplicationsMail component rendering');
  
  // State
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  
  // Debug: Log state changes
  useEffect(() => {
    console.log('selectedThread state changed:', selectedThread);
  }, [selectedThread]);
  const [loading, setLoading] = useState(false);
  const [threadLoading, setThreadLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<string>('');
  const [cacheInitialized, setCacheInitialized] = useState(false);

  // Add mobile-specific error handling and debug logging
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  // Add debug logging function
  const addDebugLog = (message: string) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    setDebugInfo(prev => [...prev.slice(-9), logMessage]); // Keep last 10 logs
    console.log(`📱 Mobile Debug: ${message}`);
  };

  // Enhanced fetch function with mobile-specific handling
  const fetchWithMobileHandling = async (url: string, options: RequestInit = {}) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout for mobile

    try {
      addDebugLog(`🔄 Starting fetch to: ${url}`);
      setIsLoading(true);
      setError(null);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      addDebugLog(`✅ Response received: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();
      addDebugLog(`✅ Data parsed successfully: ${JSON.stringify(data).substring(0, 100)}...`);
      return data;

    } catch (error: unknown) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        const errorMsg = 'Request timed out. Mobile networks can be slow.';
        addDebugLog(`❌ ${errorMsg}`);
        setError(errorMsg);
      } else {
        const errorMsg = `Failed to load data: ${error instanceof Error ? error.message : 'Unknown error'}`;
        addDebugLog(`❌ ${errorMsg}`);
        setError(errorMsg);
      }
      
      console.error('📱 Mobile fetch error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Enhanced sent threads fetching
  const fetchSentThreads = async () => {
    try {
      addDebugLog('📧 Fetching sent threads...');
      const data = await fetchWithMobileHandling('/api/gmail/sent');
      
      if (data.success && data.threads) {
        addDebugLog(`✅ Found ${data.threads.length} sent threads`);
        setThreads(data.threads); // Use the correct setter
      } else {
        throw new Error('Invalid response format from sent threads API');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addDebugLog(`❌ Failed to fetch sent threads: ${errorMessage}`);
      setError(`Failed to load sent emails: ${errorMessage}`);
    }
  };

  // Enhanced thread fetching
  const fetchThread = async (threadId: string) => {
    try {
      addDebugLog(`📧 Fetching thread: ${threadId}`);
      const data = await fetchWithMobileHandling('/api/gmail/thread/full', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId })
      });
      
      if (data.success && data.thread) {
        addDebugLog(`✅ Thread loaded: ${data.thread.messages?.length || 0} messages`);
        setSelectedThread(data.thread);
      } else {
        throw new Error('Invalid response format from thread API');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addDebugLog(`❌ Failed to fetch thread: ${errorMessage}`);
      setError(`Failed to load thread: ${errorMessage}`);
    }
  };

  // Delete thread handler
  const handleDeleteThread = async (threadId: string) => {
    if (!confirm('Are you sure you want to delete this thread? This will permanently remove the thread and all its messages.')) {
      return;
    }

    try {
      // Call backend to hide thread
      const response = await fetch('http://localhost:3001/api/gmail/thread/hide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId })
      });

      if (!response.ok) {
        throw new Error('Failed to hide thread on backend');
      }

      // Also mark as untracked in local cache
      await mailCache.markThreadAsUntracked(threadId);
      
      // Remove from local state immediately for better UX
      setThreads(prev => prev.filter(thread => thread.id !== threadId));
      
      // Clear selected thread if it was the deleted one
      if (selectedThread?.id === threadId) {
        setSelectedThread(null);
      }
      
      console.log(`Thread ${threadId} hidden on backend and marked as untracked`);
    } catch (error) {
      console.error('Failed to delete thread:', error);
    }
  };

  // Initialize cache and load data on mount
  useEffect(() => {
    const initializeCache = async () => {
      try {
        // Load cached summaries immediately for instant UI (only tracked ones)
        const cachedSummaries = await mailCache.getTrackedSummaries();
        if (cachedSummaries.length > 0) {
          setThreads(cachedSummaries);
          setCacheInitialized(true);
          
          // Get last refresh time
          const meta = await mailCache.getMeta();
          if (meta.lastRefreshISO) {
            setLastRefreshTime(meta.lastRefreshISO);
          }
        }
        
        // Load leads
        const fetchedLeads = await leadsApi.getLeads();
        setLeads(fetchedLeads);
        
        // If no cache, fetch initial threads
        if (cachedSummaries.length === 0) {
          const fetchedThreads = await gmailApi.getSentThreads([]);
          
          // Mark all new threads as tracked by default
          const trackedThreads = fetchedThreads.map(thread => ({
            ...thread,
            tracked: true
          }));
          
          setThreads(trackedThreads);
          await mailCache.setSummaries(trackedThreads);
          setCacheInitialized(true);
        }
        
        // Auto-refresh on page load
        if (cachedSummaries.length > 0) {
          await handleRefresh();
        }
      } catch (error) {
        console.error('Failed to initialize cache:', error);
        toast.error('Failed to load data');
      }
    };
    
    initializeCache();
  }, []);

  // Filter threads based on selected leads (no API calls, just client-side filtering)
  const filteredThreads = useMemo(() => {
    if (selectedLeadIds.length === 0) {
      return threads;
    }
    
    return threads.filter(thread => {
      // Check if any of the thread's recipients match the selected leads
      return thread.recipients.some(recipient => 
        selectedLeadIds.some(leadId => {
          const lead = leads.find(l => l.id === leadId);
          return lead && recipient.email === lead.email;
        })
      );
    });
  }, [threads, selectedLeadIds, leads]);

  // Load thread details when selected
  const handleThreadSelect = useCallback(async (threadId: string) => {
    console.log('handleThreadSelect called with threadId:', threadId);
    setThreadLoading(true);
    setSelectedThread(null); // Clear previous selection immediately
    
    try {
      // Check cache first
      let thread = await mailCache.getThread(threadId);
      console.log('Thread from cache:', thread);
      
      // Force fresh API call for debugging
      console.log('🔄 Force fetching thread from API for debugging...');
      thread = await gmailApi.getThread(threadId);
      console.log('Thread from API:', thread);
      
      if (thread) {
        // Validate thread structure
        if (!thread.id || !thread.messages || !Array.isArray(thread.messages)) {
          console.error('Invalid thread structure:', thread);
          setSelectedThread(null);
          return;
        }
        // Cache the thread
        await mailCache.setThread(thread);
      }
      
      if (thread) {
        console.log('Setting selected thread:', {
          id: thread.id,
          subject: thread.subject,
          messagesCount: thread.messages?.length || 0,
          messages: thread.messages,
          recipients: thread.recipients
        });
        console.log('Thread messages count:', thread.messages?.length || 0);
        setSelectedThread(thread);
      } else {
        console.log('No thread found, setting to null');
        setSelectedThread(null);
      }
    } catch (error) {
      console.error('Failed to load thread:', error);
      // Show error state
      setSelectedThread(null);
    } finally {
      setThreadLoading(false);
    }
  }, []);

  // Handle sending email
  const handleSendEmail = useCallback(async (content: string, attachments: Attachment[]) => {
    if (!selectedThread) return;

    try {
      await gmailApi.sendEmail({
        threadId: selectedThread.id,
        to: selectedThread.recipients,
        subject: selectedThread.subject,
        html: content,
        attachments: attachments.map(att => ({
          name: att.filename,
          mimeType: att.mimeType,
          dataBase64: '' // TODO: Convert file to base64 when implementing file uploads
        }))
      });

      // Refresh thread list to show the new message
      const currentThreads = await gmailApi.getSentThreads(selectedLeadIds);
      setThreads(currentThreads);
      
      // Refresh current thread
      const updatedThread = await gmailApi.getThread(selectedThread.id);
      setSelectedThread(updatedThread);
      
    } catch (error) {
      console.error('Failed to send email:', error);
      throw error;
    }
  }, [selectedThread, selectedLeadIds]);

  // Handle AI generation
  const handleGenerateAI = useCallback(async (): Promise<string> => {
    if (!selectedThread) throw new Error('No thread selected');

    try {
      const response = await aiApi.draftReply({
        threadId: selectedThread.id,
        style: 'followup',
        maxMessages: 5
      });
      return response.draft;
    } catch (error) {
      console.error('Failed to generate AI draft:', error);
      throw error;
    }
  }, [selectedThread]);

  // Handle manual refresh - now fetches COMPLETE threads including incoming replies
  const handleRefresh = useCallback(async () => {
    if (!cacheInitialized) return;
    
    setLoading(true);
    try {
      console.log('🔄 Starting complete refresh to get all threads including incoming replies...');
      
      // Always fetch complete threads for full refresh (not just delta)
      const completeThreads = await gmailApi.getSentThreads(selectedLeadIds);
      console.log('✅ Complete threads fetched:', completeThreads.length);
      
      // Get existing cache to preserve tracking status
      const existingCache = await mailCache.getSummaries();
      const existingTrackingMap = new Map();
      existingCache.forEach(thread => {
        existingTrackingMap.set(thread.id, thread.tracked);
      });
      
      // Merge new threads with existing tracking status
      const mergedThreads = completeThreads.map(thread => ({
        ...thread,
        tracked: existingTrackingMap.has(thread.id) ? existingTrackingMap.get(thread.id) : true
      }));
      
      // Update state and cache with merged data (only tracked ones)
      const trackedThreads = mergedThreads.filter(thread => thread.tracked !== false);
      setThreads(trackedThreads);
      await mailCache.setSummaries(mergedThreads);
      await mailCache.updateMeta({ lastRefreshISO: new Date().toISOString() });
      setLastRefreshTime(new Date().toISOString());
      
      // Queue background prefetch for all threads to get full details
      const allThreadIds = completeThreads.map(t => t.id);
      if (allThreadIds.length > 0) {
        console.log('🔄 Queueing prefetch for', allThreadIds.length, 'threads');
        mailCache.queuePrefetch(allThreadIds);
      }
      
      // If there's a selected thread, refresh it to get updated message count
      if (selectedThread) {
        console.log('🔄 Refreshing selected thread:', selectedThread.id);
        try {
          const updatedThread = await gmailApi.getThread(selectedThread.id);
          setSelectedThread(updatedThread);
          await mailCache.setThread(updatedThread);
          console.log('✅ Selected thread refreshed with', updatedThread.messages?.length, 'messages');
        } catch (error) {
          console.warn('⚠️ Could not refresh selected thread:', error);
        }
      }
      
      console.log('✅ Complete refresh finished successfully');
      
    } catch (error) {
      console.error('❌ Refresh failed:', error);
      toast.error('Failed to refresh emails. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [cacheInitialized, selectedLeadIds, mailCache, gmailApi]);

  // Format last refresh time
  const formatLastRefresh = useCallback((isoString: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }, []);

  // Handle load more (for pagination)
  const handleLoadMore = useCallback(() => {
    // TODO: Implement pagination when backend supports it
    console.log('Load more clicked');
  }, []);

  // Handle reply all
  const handleReplyAll = useCallback(() => {
    // Focus the composer
    // This will be handled by the composer component
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Debug Info Panel - Only show on mobile or when errors occur */}
      {(error || debugInfo.length > 0) && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                Mobile Debug Information
              </h3>
              {error && (
                <div className="mt-2 text-sm text-yellow-700">
                  <strong>Error:</strong> {error}
                </div>
              )}
              {debugInfo.length > 0 && (
                <div className="mt-2">
                  <details className="text-sm text-yellow-700">
                    <summary className="cursor-pointer font-medium">View Debug Logs</summary>
                    <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                      {debugInfo.map((log, index) => (
                        <div key={index} className="font-mono text-xs bg-yellow-100 p-1 rounded">
                          {log}
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Loading Indicator */}
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <div className="text-lg font-medium">Loading...</div>
            </div>
            <div className="mt-2 text-sm text-gray-600">Please wait, mobile networks can be slow</div>
          </div>
        </div>
      )}

      {/* Existing content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Left Sidebar - Thread List */}
        <div className="w-96 border-r border-gray-200 bg-white flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <Button
                  onClick={handleRefresh}
                  disabled={loading || !cacheInitialized}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  {loading ? 'Refreshing...' : 'Refresh All'}
                </Button>
                {lastRefreshTime && (
                  <span className="text-xs text-gray-500">
                    synced {formatLastRefresh(lastRefreshTime)}
                  </span>
                )}
                {/* Show thread count */}
                <span className="text-xs text-gray-500">
                  {threads.length} thread{threads.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/* Lead filter */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Filter className="w-4 h-4" />
                <span>Filter by leads</span>
              </div>
              <LeadMultiSelect
                leads={leads}
                selectedLeadIds={selectedLeadIds}
                onSelectionChange={setSelectedLeadIds}
                placeholder="All leads"
              />
            </div>
          </div>

          {/* Thread list */}
          <div className="flex-1">
            <ThreadList
              threads={filteredThreads}
              selectedThreadId={selectedThread?.id}
              onThreadSelect={handleThreadSelect}
              onDeleteThread={handleDeleteThread}
              loading={loading}
              hasMore={hasMore}
              onLoadMore={handleLoadMore}
            />
          </div>
        </div>

        {/* Right Panel - Thread View + Composer */}
        <div className="flex-1 bg-white flex flex-col">
          {/* Debug info removed for production */}
          {selectedThread ? (
            <>
              {/* Thread view */}
              <div className="flex-1 overflow-hidden">
                <ThreadView
                  threadId={selectedThread.id}
                  subject={selectedThread.subject}
                  messages={selectedThread.messages}
                  recipients={selectedThread.recipients}
                  onReplyAll={handleReplyAll}
                  onDelete={() => handleDeleteThread(selectedThread.id)}
                />
              </div>

              {/* Auto Follow-up Agent */}
              <AutoFollowupAgent
                threadId={selectedThread.id}
                leadId={selectedThread.leadIds?.[0] || ''}
              />

              {/* Composer */}
              <Composer
                threadId={selectedThread.id}
                recipients={selectedThread.recipients.map(r => r.email)}
                subject={selectedThread.subject}
                onSend={handleSendEmail}
                onGenerateAI={handleGenerateAI}
                disabled={threadLoading}
              />
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">
              <div className="text-center">
                <div className="text-6xl mb-4">📧</div>
                <p className="text-lg">Select a thread to view details</p>
                <p className="text-sm text-gray-400 mt-2">selectedThread: {JSON.stringify(selectedThread)}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
