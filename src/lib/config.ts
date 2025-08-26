// Environment-based configuration
export const config = {
  // API Base URL - automatically detects environment
  apiBase: (() => {
    // Check if we're in production (Vercel)
    if (typeof window !== 'undefined') {
      // Client-side: use current origin
      const origin = window.location.origin;
      if (origin.includes('vercel.app') || origin.includes('localhost')) {
        return origin; // Use current origin for API calls
      }
    }
    
    // Fallback to environment variable or default
    return process.env.VITE_API_BASE_URL || 'http://localhost:3001';
  })(),
  
  // Environment detection
  isProduction: typeof window !== 'undefined' && 
    (window.location.hostname.includes('vercel.app') || 
     window.location.hostname.includes('netlify.app') ||
     window.location.hostname.includes('herokuapp.com')),
  
  isDevelopment: typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || 
     window.location.hostname === '127.0.0.1'),
  
  // API endpoints - corrected to match backend routes
  endpoints: {
    gmail: '/api/gmail',
    openai: '/api/openai',
    documents: '/api/documents',
    leads: '/api/leads',
    settings: '/api/settings',
    resumes: '/api/resumes',
    applications: '/api/applications',
    ai: '/api/ai',
    aiConfig: '/api/ai-config', // Corrected: backend uses ai-config with hyphen
    upload: '/api/upload-resume',
    artifacts: '/api/artifacts',
    snippets: '/api/snippets',
    messages: '/api/messages',
    lusha: '/api/lusha'
  }
};

// Helper function to build full API URLs
export const buildApiUrl = (endpoint: string, path: string = '') => {
  const base = config.apiBase;
  const fullPath = `${endpoint}${path}`;
  
  // Remove trailing slash from base if present
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
  
  return `${cleanBase}${fullPath}`;
};

// Export individual endpoint builders
export const apiUrls = {
  gmail: (path: string = '') => buildApiUrl(config.endpoints.gmail, path),
  openai: (path: string = '') => buildApiUrl(config.endpoints.openai, path),
  documents: (path: string = '') => buildApiUrl(config.endpoints.documents, path),
  leads: (path: string = '') => buildApiUrl(config.endpoints.leads, path),
  settings: (path: string = '') => buildApiUrl(config.endpoints.settings, path),
  resumes: (path: string = '') => buildApiUrl(config.endpoints.resumes, path),
  applications: (path: string = '') => buildApiUrl(config.endpoints.applications, path),
  ai: (path: string = '') => buildApiUrl(config.endpoints.ai, path),
  aiConfig: (path: string = '') => buildApiUrl(config.endpoints.aiConfig, path), // Corrected endpoint
  upload: (path: string = '') => buildApiUrl(config.endpoints.upload, path),
  artifacts: (path: string = '') => buildApiUrl(config.endpoints.artifacts, path),
  snippets: (path: string = '') => buildApiUrl(config.endpoints.snippets, path),
  messages: (path: string = '') => buildApiUrl(config.endpoints.messages, path),
  lusha: (path: string = '') => buildApiUrl(config.endpoints.lusha, path)
};

export default config;
