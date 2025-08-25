import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables. Please check your .env file.');
  console.error('Required variables: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY');
}

// Use placeholder values if environment variables are missing to prevent URL constructor errors
const fallbackUrl = supabaseUrl || 'https://placeholder.supabase.co';
const fallbackKey = supabaseAnonKey || 'placeholder-key';

export const supabase = createClient(fallbackUrl, fallbackKey);

// Helper function to handle API responses
export const handleSupabaseResponse = <T>(response: any): { data: T | null; error: string | null } => {
  if (response.error) {
    console.error('Supabase error:', response.error);
    return { data: null, error: response.error.message };
  }
  return { data: response.data, error: null };
};

// Database service functions
export const db = {
  supabase, // Expose the supabase client for storage operations
  // Users
  async getUser(id: string = 'me') {
    const response = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();
    return handleSupabaseResponse(response);
  },

  async initializeUserWithOpenAI() {
    try {
      // First ensure user exists
      const { data: userData, error: userError } = await supabase
        .from('users')
        .upsert({ 
          id: 'me',
          name: 'User',
          email: 'user@example.com',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'id'
        })
        .select()
        .single();

      // Then configure OpenAI settings using backend API
      const settingsResponse = await fetch('http://localhost:3001/api/settings/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: 'me',
          openai_api_key: '',
          tone_default: 'honest',
          length_default: 'medium',
          gmail_user_email: '',
          gmail_connected: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }),
      });
      
      let settingsData = null;
      let settingsError = null;
      
      if (settingsResponse.ok) {
        const data = await settingsResponse.json();
        settingsData = data.settings;
      } else {
        settingsError = `HTTP error! status: ${settingsResponse.status}`;
      }

      return { userData, settingsData, userError, settingsError };
    } catch (error) {
      console.error('Error initializing user with OpenAI:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { userData: null, settingsData: null, userError: errorMessage, settingsError: errorMessage };
    }
  },

  async updateUser(id: string = 'me', updates: any) {
    const response = await supabase
      .from('users')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    return handleSupabaseResponse(response);
  },

  // Resumes
  async getResumes() {
    try {
      const response = await fetch('http://localhost:3001/api/resumes');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      if (data.success) {
        return { data: data.resumes, error: null };
      } else {
        return { data: null, error: data.error || 'Failed to fetch resumes' };
      }
    } catch (error) {
      console.error('Failed to fetch resumes:', error);
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async createResume(resume: any) {
    // Get the current user ID from auth
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || 'me';
    
    const response = await supabase
      .from('resumes')
      .insert({ ...resume, user_id: userId })
      .select()
      .single();
    return handleSupabaseResponse(response);
  },

  async deleteResume(id: string) {
    // Get the current user ID from auth
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || 'me';
    
    const response = await supabase
      .from('resumes')
      .delete()
      .eq('id', id)
      .eq('user_id', userId); // Ensure user can only delete their own resumes
    return handleSupabaseResponse(response);
  },

  // Snippets
  async getSnippets() {
    try {
      const response = await fetch('http://localhost:3001/api/snippets', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      if (result.success && result.data) {
        return { data: result.data, error: null };
      } else {
        return { data: null, error: result.error || 'Failed to fetch snippets' };
      }
    } catch (error) {
      console.error('Failed to fetch snippets:', error);
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async createSnippet(snippet: any) {
    const response = await supabase
      .from('snippets')
      .insert({ ...snippet, user_id: 'me' })
      .select()
      .single();
    return handleSupabaseResponse(response);
  },

  async updateSnippet(id: string, updates: any) {
    const response = await supabase
      .from('snippets')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    return handleSupabaseResponse(response);
  },

  async deleteSnippet(id: string) {
    const response = await supabase
      .from('snippets')
      .delete()
      .eq('id', id);
    return handleSupabaseResponse(response);
  },

  // Leads
  async getLeads() {
    try {
      const response = await fetch('http://localhost:3001/api/leads', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      if (result.success && result.data) {
        return { data: result.data, error: null };
      } else {
        return { data: null, error: result.error || 'Failed to fetch leads' };
      }
    } catch (error) {
      console.error('Failed to fetch leads:', error);
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async createLead(lead: any) {
    const response = await supabase
      .from('leads')
      .insert({ ...lead, user_id: 'me' })
      .select()
      .single();
    return handleSupabaseResponse(response);
  },

  async updateLead(id: string, updates: any) {
    const response = await supabase
      .from('leads')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    return handleSupabaseResponse(response);
  },

  async getLead(id: string) {
    try {
      const response = await fetch(`http://localhost:3001/api/leads/${id}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      if (data.success) {
        return { data: data.lead, error: null };
      } else {
        return { data: null, error: data.error || 'Failed to fetch lead' };
      }
    } catch (error) {
      console.error('Failed to fetch lead:', error);
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  // Delete functions
  async deleteLead(id: string) {
    try {
      const response = await fetch(`http://localhost:3001/api/leads/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      if (data.success) {
        return { data: data.message, error: null };
      } else {
        return { data: null, error: data.error || 'Failed to delete lead' };
      }
    } catch (error: unknown) {
      console.error('Failed to delete lead:', error);
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  // Contacts
  async createContact(contact: any) {
    const response = await supabase
      .from('contacts')
      .insert({ ...contact, user_id: 'me' })
      .select()
      .single();
    return handleSupabaseResponse(response);
  },

  async updateContact(id: string, updates: any) {
    const response = await supabase
      .from('contacts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    return handleSupabaseResponse(response);
  },

  async deleteContact(id: string) {
    const response = await supabase
      .from('contacts')
      .delete()
      .eq('id', id);
    return handleSupabaseResponse(response);
  },

  // Applications
  async getApplications() {
    try {
      const response = await fetch('http://localhost:3001/api/applications', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      if (result.success && result.data) {
        return { data: result.data, error: null };
      } else {
        return { data: null, error: result.error || 'Failed to fetch applications' };
      }
    } catch (error) {
      console.error('Failed to fetch applications:', error);
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async createApplication(application: any) {
    const response = await supabase
      .from('applications')
      .insert(application)
      .select()
      .single();
    return handleSupabaseResponse(response);
  },

  async updateApplication(id: string, updates: any) {
    const response = await supabase
      .from('applications')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    return handleSupabaseResponse(response);
  },

  // Delete functions
  async deleteApplication(id: string) {
    try {
      const response = await fetch(`http://localhost:3001/api/applications/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      if (data.success) {
        return { data: data.message, error: null };
      } else {
        return { data: null, error: data.error || 'Failed to delete application' };
      }
    } catch (error: unknown) {
      console.error('Failed to delete application:', error);
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  // Messages
  async createMessage(message: any) {
    const response = await supabase
      .from('messages')
      .insert(message)
      .select()
      .single();
    return handleSupabaseResponse(response);
  },

  // Delete functions
  async deleteMessageThread(applicationId: string) {
    try {
      const response = await fetch(`http://localhost:3001/api/messages/${applicationId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      if (data.success) {
        return { data: data.message, error: null };
      } else {
        return { data: null, error: data.error || 'Failed to delete message thread' };
      }
    } catch (error: unknown) {
      console.error('Failed to delete message thread:', error);
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  // Artifacts
  async createArtifact(artifact: any) {
    const response = await supabase
      .from('artifacts')
      .insert(artifact)
      .select()
      .single();
    return handleSupabaseResponse(response);
  },

  async getArtifacts(leadId?: string) {
    try {
      const url = leadId 
        ? `http://localhost:3001/api/artifacts?leadId=${leadId}`
        : 'http://localhost:3001/api/artifacts';
        
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      if (result.success && result.data) {
        return { data: result.data, error: null };
      } else {
        return { data: null, error: result.error || 'Failed to fetch artifacts' };
      }
    } catch (error) {
      console.error('Failed to fetch artifacts:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { data: null, error: errorMessage };
    }
  },

  // Prompt Presets
  async getPromptPresets(artifactType?: string) {
    let query = supabase
      .from('prompt_presets')
      .select('*')
      .eq('user_id', 'me')
      .order('created_at', { ascending: false });
    
    if (artifactType) {
      query = query.eq('artifact_type', artifactType);
    }
    
    const response = await query;
    return handleSupabaseResponse(response);
  },

  async createPromptPreset(preset: any) {
    const response = await supabase
      .from('prompt_presets')
      .insert({ ...preset, user_id: 'me' })
      .select()
      .single();
    return handleSupabaseResponse(response);
  },

  async updatePromptPreset(id: string, updates: any) {
    const response = await supabase
      .from('prompt_presets')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    return handleSupabaseResponse(response);
  },

  // Settings
  async getSettings() {
    try {
      console.log('🔄 Fetching settings from backend...');
      const response = await fetch('http://localhost:3001/api/settings', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('🔄 Backend response:', result);
      
      if (result.success && result.data) {
        console.log('🔄 Returning settings data:', result.data);
        return { data: result.data, error: null };
      } else {
        console.log('🔄 Invalid response format:', result);
        return { data: null, error: 'Invalid response format' };
      }
    } catch (error) {
      console.error('🔄 Error in getSettings:', error);
      return { data: null, error: error.message };
    }
  },

  async updateSettings(updates: any) {
    try {
      const response = await fetch('http://localhost:3001/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      if (result.success && result.data) {
        return { data: result.data, error: null };
      } else {
        return { data: null, error: 'Invalid response format' };
      }
    } catch (error) {
      return { data: null, error: error.message };
    }
  },

  // Followup Rules
  async getFollowupRules() {
    const response = await supabase
      .from('followup_rules')
      .select('*')
      .eq('user_id', 'me')
      .order('created_at', { ascending: false });
    return handleSupabaseResponse(response);
  },

  async createFollowupRule(rule: any) {
    const response = await supabase
      .from('followup_rules')
      .insert({ ...rule, user_id: 'me' })
      .select()
      .single();
    return handleSupabaseResponse(response);
  },

  // Followup Templates
  async getFollowupTemplates() {
    const response = await supabase
      .from('followup_templates')
      .select('*')
      .eq('user_id', 'me')
      .order('created_at', { ascending: false });
    return handleSupabaseResponse(response);
  },


};