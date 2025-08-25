import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useGlobalStore } from './stores/globalStore';
import { db } from './lib/supabase';

// Layout components
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';

// Page components
import { ProfileEditor } from './components/workspace/ProfileEditor';
import { ResumeLibrary } from './components/workspace/ResumeLibrary';
import { SnippetBoard } from './components/workspace/SnippetBoard';
import { LeadsPage } from './pages/LeadsPage';
import { LeadDetailPage } from './pages/LeadDetailPage';
import { SettingsPage } from './pages/SettingsPage';
import { AIConfigurations } from './pages/AIConfigurations';
import KnowledgeBasePage from './pages/KnowledgeBasePage';
import { ApplicationsMail } from './features/applications/ApplicationsMail';
import { LoadingSpinner } from './components/ui/LoadingSpinner';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes
    },
  },
});

function AppContent() {
  const { user, setUser, setSettings, setSidebarOpen } = useGlobalStore();
  const [currentPath, setCurrentPath] = useState('/applications');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initializeApp();
  }, []);

  // Handle hash-based routing
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash) {
        const path = hash.substring(1); // Remove the # symbol
        setCurrentPath(path);
      }
    };

    // Set initial path from hash
    const hash = window.location.hash;
    if (hash) {
      const path = hash.substring(1);
      setCurrentPath(path);
    }

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Handle OAuth2 redirect parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const gmailAuth = urlParams.get('gmail_auth');
    const message = urlParams.get('message');
    
    if (gmailAuth === 'success') {
      // Show success message
      import('react-hot-toast').then(({ toast }) => {
        toast.success(message || 'Gmail authorization successful!');
      });
      
      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Refresh settings to get updated Gmail status
      const refreshSettings = async () => {
        console.log('🔄 Refreshing settings after OAuth2 success...');
        const { data: settingsData, error: settingsError } = await db.getSettings();
        if (settingsError) {
          console.error('❌ Failed to refresh settings:', settingsError);
        } else if (settingsData) {
          console.log('✅ Settings refreshed:', settingsData);
          setSettings(settingsData as any);
        } else {
          console.warn('⚠️ No settings data received after refresh');
        }
      };
      refreshSettings();
      
    } else if (gmailAuth === 'error') {
      // Show error message
      import('react-hot-toast').then(({ toast }) => {
        toast.error(message || 'Gmail authorization failed');
      });
      
      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [setSettings]);

  const initializeApp = async () => {
    try {
      // Initialize user and OpenAI settings
      const { userData, settingsData, userError, settingsError } = await db.initializeUserWithOpenAI();
      
      if (userError) {
        console.error('User initialization error:', userError);
      } else {
        setUser(userData as any);
      }
      
      if (settingsError) {
        console.error('Settings initialization error:', settingsError);
      } else {
        setSettings(settingsData as any);
      }

      // Load user data
      if (!userData) {
        const { data: fallbackUserData } = await db.getUser();
        setUser(fallbackUserData as any);
      }

      // Load settings
      if (!settingsData) {
        const { data: fallbackSettingsData } = await db.getSettings();
        if (fallbackSettingsData) {
          setSettings(fallbackSettingsData as any);
        } else {
          // Create default settings if none exist (without hardcoded credentials)
          const { data: newSettings } = await db.updateSettings({
            openai_api_key: '',
            gmail_client_id: '',
            gmail_client_secret: '',
            gmail_refresh_token: '',
            gmail_user_email: '',
            tone_default: 'honest',
            length_default: 'medium',
            gmail_connected: false
          } as any);
          setSettings(newSettings as any);
        }
      }
    } catch (error) {
      console.error('Failed to initialize app:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNavigate = (path: string) => {
    setCurrentPath(path);
    // Update hash for bookmarking and direct links
    window.location.hash = path;
    // Close sidebar on mobile after navigation
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  const getPageTitle = () => {
    switch (true) {
      case currentPath.startsWith('/workspace'):
        return 'Workspace';
      case currentPath.startsWith('/leads'):
        return 'Leads';
      case currentPath.startsWith('/studio'):
        return 'Content Studio';
      case currentPath.startsWith('/applications'):
        return 'Applications';
      case currentPath.startsWith('/settings'):
        return 'Settings';
      default:
        return 'Dashboard';
    }
  };

  const getPageSubtitle = () => {
    switch (true) {
      case currentPath.startsWith('/workspace'):
        return 'Manage your profile, resumes, and content snippets';
      case currentPath.startsWith('/leads'):
        return 'Capture and enrich job opportunities';
      case currentPath.startsWith('/studio'):
        return 'Generate AI-powered content for applications';
      case currentPath.startsWith('/applications'):
        return 'Track applications and manage follow-ups';
      case currentPath.startsWith('/settings'):
        return 'Configure API keys and preferences';
      default:
        return '';
    }
  };

  const renderCurrentPage = () => {
    // Check for lead detail route
    if (currentPath.startsWith('/leads/')) {
      const leadId = currentPath.split('/')[2];
      return <LeadDetailPage leadId={leadId} onBack={() => handleNavigate('/leads')} />;
    }

    if (currentPath === '/workspace') {
      return (
        <div className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <ProfileEditor />
            </div>
            <div className="lg:col-span-2">
              <ResumeLibrary />
            </div>
          </div>
          <SnippetBoard />
        </div>
      );
    }

    switch (currentPath) {
      case '/leads':
        return (
          <LeadsPage onNavigate={handleNavigate} />
        );
      case '/knowledge':
        return (
          <KnowledgeBasePage />
        );
      case '/studio':
        return (
          <div className="text-center py-20">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Content Studio</h2>
            <p className="text-gray-600 mb-8">Coming soon - AI-powered content generation for cover letters and emails</p>
          </div>
        );
      case '/applications':
        return <ApplicationsMail />;
      case '/settings':
        return (
          <SettingsPage />
        );
      case '/ai-config':
        return (
          <AIConfigurations />
        );
      default:
        return (
          <div className="text-center py-20">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Welcome to Lazy Bird</h2>
            <p className="text-gray-600 mb-8">Your AI-powered job search copilot</p>
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" text="Initializing Lazy Bird..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar currentPath={currentPath} onNavigate={handleNavigate} />
      
      <div className="flex-1 flex flex-col min-w-0">
        <Header title={getPageTitle()} subtitle={getPageSubtitle()} />
        
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-7xl mx-auto">
            {renderCurrentPage()}
          </div>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#fff',
            color: '#374151',
            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
            border: '1px solid #e5e7eb',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
    </QueryClientProvider>
  );
}

export default App;