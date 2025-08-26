import { useState, useCallback } from 'react';

// Mobile-specific error handling for Gmail data
export const useGmailData = () => {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  // Add debug logging
  const addDebugLog = useCallback((message: string) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    setDebugLogs(prev => [...prev.slice(-9), logMessage]);
    console.log(`📱 Gmail Hook Debug: ${message}`);
  }, []);

  // Enhanced fetch with mobile timeout handling
  const fetchWithTimeout = useCallback(async (url: string, options: RequestInit = {}) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 second timeout for mobile

    try {
      addDebugLog(`🔄 Fetching: ${url}`);
      setIsLoading(true);
      setError(null);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      addDebugLog(`✅ Response: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      addDebugLog(`✅ Data received: ${JSON.stringify(data).substring(0, 100)}...`);
      return data;

    } catch (error: unknown) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        const errorMsg = 'Request timed out. Mobile networks can be slow.';
        addDebugLog(`❌ ${errorMsg}`);
        setError(errorMsg);
      } else {
        const errorMsg = `Fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        addDebugLog(`❌ ${errorMsg}`);
        setError(errorMsg);
      }
      
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [addDebugLog]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Clear debug logs
  const clearDebugLogs = useCallback(() => {
    setDebugLogs([]);
  }, []);

  return {
    error,
    isLoading,
    debugLogs,
    addDebugLog,
    fetchWithTimeout,
    clearError,
    clearDebugLogs
  };
};



