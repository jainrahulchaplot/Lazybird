import { ThreadSummary, Thread, EmailAddress } from '../types/applications';

// Cache metadata
interface CacheMeta {
  lastRefreshISO?: string;
  lastHistoryId?: string;
  version: string;
}

// Cache structure
interface MailCache {
  threadIndex: Map<string, { id: string; updatedAtISO: string }>;
  summaries: Map<string, ThreadSummary>;
  threads: Map<string, Thread>;
  meta: CacheMeta;
}

class MailCacheManager {
  private dbName = 'LazyBirdMailCache';
  private version = 1;
  private cache: MailCache;
  private useIndexedDB = true;

  constructor() {
    this.cache = {
      threadIndex: new Map(),
      summaries: new Map(),
      threads: new Map(),
      meta: { version: '1.0' }
    };
    this.init();
  }

  private async init() {
    try {
      if ('indexedDB' in window) {
        await this.initIndexedDB();
      } else {
        this.useIndexedDB = false;
        await this.loadFromLocalStorage();
      }
    } catch (error) {
      console.warn('IndexedDB failed, falling back to localStorage:', error);
      this.useIndexedDB = false;
      await this.loadFromLocalStorage();
    }
  }

  private async initIndexedDB() {
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        this.loadFromIndexedDB(db);
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('mailCache')) {
          const store = db.createObjectStore('mailCache', { keyPath: 'key' });
        }
      };
    });
  }

  private async loadFromIndexedDB(db: IDBDatabase) {
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(['mailCache'], 'readonly');
      const store = transaction.objectStore('mailCache');
      const request = store.getAll();
      
      request.onsuccess = () => {
        const data = request.result;
        this.deserializeCache(data);
        resolve();
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  private async loadFromLocalStorage() {
    try {
      const cached = localStorage.getItem('lazybird_mail_cache');
      if (cached) {
        this.deserializeCache(JSON.parse(cached));
      }
    } catch (error) {
      console.warn('Failed to load from localStorage:', error);
    }
  }

  private deserializeCache(data: any[]) {
    if (!data || !Array.isArray(data)) return;
    
    data.forEach(item => {
      if (item.key === 'threadIndex' && item.value) {
        this.cache.threadIndex = new Map(Object.entries(item.value));
      } else if (item.key === 'summaries' && item.value) {
        this.cache.summaries = new Map(Object.entries(item.value));
      } else if (item.key === 'threads' && item.value) {
        this.cache.threads = new Map(Object.entries(item.value));
      } else if (item.key === 'meta' && item.value) {
        this.cache.meta = item.value;
      }
    });
  }

  private async persistCache() {
    if (this.useIndexedDB) {
      await this.persistToIndexedDB();
    } else {
      await this.persistToLocalStorage();
    }
  }

  private async persistToIndexedDB() {
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['mailCache'], 'readwrite');
        const store = transaction.objectStore('mailCache');
        
        const data = [
          { key: 'threadIndex', value: Object.fromEntries(this.cache.threadIndex) },
          { key: 'summaries', value: Object.fromEntries(this.cache.summaries) },
          { key: 'threads', value: Object.fromEntries(this.cache.threads) },
          { key: 'meta', value: this.cache.meta }
        ];
        
        const promises = data.map(item => {
          return new Promise<void>((resolve, reject) => {
            const putRequest = store.put(item);
            putRequest.onsuccess = () => resolve();
            putRequest.onerror = () => reject(putRequest.error);
          });
        });
        
        Promise.all(promises).then(() => resolve()).catch(reject);
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  private async persistToLocalStorage() {
    try {
      const data = [
        { key: 'threadIndex', value: Object.fromEntries(this.cache.threadIndex) },
        { key: 'summaries', value: Object.fromEntries(this.cache.summaries) },
        { key: 'threads', value: Object.fromEntries(this.cache.threads) },
        { key: 'meta', value: this.cache.meta }
      ];
      localStorage.setItem('lazybird_mail_cache', JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to persist to localStorage:', error);
    }
  }

  // Public methods
  async getSummaries(): Promise<ThreadSummary[]> {
    await this.init;
    return Array.from(this.cache.summaries.values());
  }

  async getThread(threadId: string): Promise<Thread | null> {
    await this.init;
    return this.cache.threads.get(threadId) || null;
  }

  async getThreadIndex(): Promise<Map<string, { id: string; updatedAtISO: string }>> {
    await this.init;
    return this.cache.threadIndex;
  }

  async getMeta(): Promise<CacheMeta> {
    await this.init;
    return this.cache.meta;
  }

  async setSummaries(summaries: ThreadSummary[]) {
    // Update summaries and thread index
    summaries.forEach(summary => {
      this.cache.summaries.set(summary.id, summary);
      this.cache.threadIndex.set(summary.id, {
        id: summary.id,
        updatedAtISO: summary.updatedAt
      });
    });
    
    // Evict old summaries (keep most recent 300)
    if (this.cache.summaries.size > 300) {
      const sorted = Array.from(this.cache.summaries.values())
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      
      const toKeep = sorted.slice(0, 300);
      this.cache.summaries.clear();
      this.cache.threadIndex.clear();
      
      toKeep.forEach(summary => {
        this.cache.summaries.set(summary.id, summary);
        this.cache.threadIndex.set(summary.id, {
          id: summary.id,
          updatedAtISO: summary.updatedAt
        });
      });
    }
    
    await this.persistCache();
  }

  async setThread(thread: Thread) {
    this.cache.threads.set(thread.id, thread);
    await this.persistCache();
  }

  async updateMeta(meta: Partial<CacheMeta>) {
    this.cache.meta = { ...this.cache.meta, ...meta };
    await this.persistCache();
  }

  async clearCache() {
    this.cache.summaries.clear();
    this.cache.threads.clear();
    this.cache.threadIndex.clear();
    this.cache.meta = { version: '1.0' };
    await this.persistCache();
  }

  // Utility methods
  async getCachedThreadIds(): Promise<string[]> {
    await this.init;
    return Array.from(this.cache.threadIndex.keys());
  }

  async isThreadCached(threadId: string): Promise<boolean> {
    await this.init;
    return this.cache.threads.has(threadId);
  }

  async getThreadLastUpdated(threadId: string): Promise<string | null> {
    await this.init;
    const index = this.cache.threadIndex.get(threadId);
    return index?.updatedAtISO || null;
  }

  // Background prefetch methods
  private prefetchQueue: Set<string> = new Set();
  private isPrefetching = false;

  async queuePrefetch(threadIds: string[]) {
    threadIds.forEach(id => this.prefetchQueue.add(id));
    
    if (!this.isPrefetching) {
      this.startPrefetch();
    }
  }

  private async startPrefetch() {
    if (this.isPrefetching || this.prefetchQueue.size === 0) return;
    
    this.isPrefetching = true;
    
    try {
      // Process queue with concurrency limit of 3
      const batchSize = 3;
      const queue = Array.from(this.prefetchQueue);
      
      for (let i = 0; i < queue.length; i += batchSize) {
        const batch = queue.slice(i, i + batchSize);
        const promises = batch.map(threadId => this.prefetchThread(threadId));
        
        await Promise.allSettled(promises);
        
        // Small delay between batches
        if (i + batchSize < queue.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } finally {
      this.isPrefetching = false;
      this.prefetchQueue.clear();
    }
  }

  private async prefetchThread(threadId: string) {
    try {
      // This will be called by the API layer
      // For now, just remove from queue
      this.prefetchQueue.delete(threadId);
    } catch (error) {
      console.warn(`Failed to prefetch thread ${threadId}:`, error);
    }
  }

  // Check if thread has attachments
  async hasAttachments(threadId: string): Promise<boolean> {
    await this.init;
    const thread = this.cache.threads.get(threadId);
    if (!thread) return false;
    
    return thread.messages.some(message => 
      message.attachments && message.attachments.length > 0
    );
  }
}

// Export singleton instance
export const mailCache = new MailCacheManager();
