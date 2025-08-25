import React, { useState, useEffect } from 'react';
import { useGlobalStore } from '../stores/globalStore';
import { db } from '../lib/supabase';
import { gmailUtils } from '../lib/gmail';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, TextArea } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { 
  Key, 
  Mail, 
  Save, 
  TestTube, 
  CheckCircle, 
  AlertCircle,
  Settings as SettingsIcon,
  Palette,
  Clock,
  MessageSquare
} from 'lucide-react';
import toast from 'react-hot-toast';
import e from 'cors';

interface SettingsFormData {
  openai_api_key: string;
  gmail_client_id: string;
  gmail_client_secret: string;
  gmail_refresh_token: string;
  gmail_access_token: string;
  gmail_user_email?: string;
  tone_default: string;
  length_default: string;
  gmail_connected: boolean;
  // AI Prompt Configuration
  // Prompts are now managed in AI Configurations page
}

export const SettingsPage: React.FC = () => {
  const { settings, setSettings, user } = useGlobalStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState({ openai: false, gmail: false });
  
  const [formData, setFormData] = useState<SettingsFormData>({
    openai_api_key: '',
    gmail_client_id: '',
    gmail_client_secret: '',
    gmail_refresh_token: '',
    gmail_access_token: '',
    gmail_user_email: '',
    tone_default: 'honest',
    length_default: 'medium',
    gmail_connected: false,
    // AI Prompt Configuration with defaults
    // Prompts are now managed in AI Configurations page
  });

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (settings) {
      setFormData({
        openai_api_key: settings.openai_api_key || '',
        gmail_client_id: settings.gmail_client_id || '',
        gmail_client_secret: settings.gmail_client_secret || '',
        gmail_refresh_token: settings.gmail_refresh_token || '',
        gmail_access_token: settings.gmail_access_token || '',
        gmail_user_email: settings.gmail_user_email || '',
        tone_default: settings.tone_default || 'honest',
        length_default: settings.length_default || 'medium',
        gmail_connected: settings.gmail_connected || false,
        // AI Prompt Configuration
        // Prompts are now managed in AI Configurations page
      });
    }
  }, [settings]);

  const loadSettings = async () => {
    try {
      const { data, error } = await db.getSettings();
      
      if (error) {
        console.error('Failed to load settings:', error);
        toast.error('Failed to load settings');
        return;
      }
      
      if (data && Object.keys(data).length > 0) {
        setSettings(data as any);
      } else {
        toast.error('No settings found');
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (section: 'openai' | 'gmail' | 'defaults' | 'prompts') => {
    setSaving(true);
    try {
      let updates: any = {};
      
      switch (section) {
        case 'openai':
          // OpenAI API key comes from .env file, don't save it
          updates = {};
          break;
        case 'gmail':
          // Gmail credentials come from .env file, don't save them
          updates = {
            gmail_access_token: formData.gmail_access_token
            // gmail_connected is determined by .env file
          };
          break;
        case 'defaults':
          updates = {
            tone_default: formData.tone_default,
            length_default: formData.length_default
          };
          break;
        case 'prompts':
          // Prompts are now managed in AI Configurations page
          break;
      }

      const { data, error } = await db.updateSettings(updates as any);
      
      if (error) {
        console.error('Settings save error:', error);
        toast.error(`Failed to save settings: ${error}`);
        return;
      }
      
      if (data) {
        setSettings(data as any);
        toast.success(`${section.charAt(0).toUpperCase() + section.slice(1)} settings saved successfully`);
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const testOpenAI = async () => {
    if (!formData.openai_api_key) {
      toast.error('OpenAI API key not found in .env file');
      return;
    }

    setTesting(prev => ({ ...prev, openai: true }));
    
    try {
      // Test OpenAI API key using backend endpoint (uses .env key)
      const response = await fetch('http://localhost:3001/api/openai/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (result.success) {
        toast.success('OpenAI API key is valid!');
      } else {
        toast.error(result.error || 'Invalid OpenAI API key');
      }
    } catch (error) {
      console.error('OpenAI test failed:', error);
      toast.error('Failed to test OpenAI API key');
    } finally {
      setTesting(prev => ({ ...prev, openai: false }));
    }
  };

  const testGmail = async () => {
    if (
      !formData.gmail_client_id ||
      !formData.gmail_client_secret ||
      !formData.gmail_refresh_token
    ) {
      toast.error('Please fill in all Gmail credentials first');
      return;
    }
  
    setTesting(prev => ({ ...prev, gmail: true }));
  
    try {
      const result = await gmailUtils.testConnection();
  
      if (!result) {
        toast.error('No response from server. Please ensure the backend is running.');
        return;
      }
  
      if (result.success) {
        toast.success(`Gmail connection successful! Connected to ${result.email}`);
      } else {
        const errorMsg = result.error || 'Gmail connection failed';
  
        if (
          errorMsg.toLowerCase().includes('unauthorized') ||
          errorMsg === 'unauthorized_client'
        ) {
          toast.error(errorMsg);
        } else {
          toast.error(errorMsg);
        }
      }
    } catch (error: any) {
      console.error('Gmail test failed:', error);
      toast.error(error?.message || 'Failed to test Gmail integration');
    } finally {
      setTesting(prev => ({ ...prev, gmail: false }));
    }
  };

  const resetToDefaults = () => {
    // Prompts are now managed in AI Configurations page
  };

  // Prompts are now managed in AI Configurations page
const getDefaultPrompts = () => ({});
  
  if (loading) {
    return <LoadingSpinner size="lg" text="Loading settings..." />;
  }

  return (
    <div className="space-y-8">
      {/* OpenAI Configuration */}
      <Card>
        <CardHeader
          title="OpenAI Configuration"
          subtitle="Configure your OpenAI API key for AI-powered content generation"
          action={
            <div className="flex items-center space-x-2">
              {formData.openai_api_key && (
                <Badge variant="success" size="sm">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Configured
                </Badge>
              )}
            </div>
          }
        />
        <CardBody>
          <div className="space-y-4">
            <Input
              label="OpenAI API Key (from .env file)"
              type="password"
              value={formData.openai_api_key}
              onChange={(e) => setFormData(prev => ({ ...prev, openai_api_key: e.target.value }))}
              placeholder="sk-proj-..."
              icon={Key}
              hint="Your OpenAI API key is loaded from the .env file and cannot be edited here"
              disabled={true}
            />
            
            <div className="flex space-x-3">
              <Button
                onClick={() => handleSave('openai')}
                loading={saving}
                icon={Save}
                size="sm"
                disabled={true}
              >
                Key from .env (Read-only)
              </Button>
              <Button
                onClick={testOpenAI}
                loading={testing.openai}
                icon={TestTube}
                variant="outline"
                size="sm"
              >
                Test Connection
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Gmail Configuration */}
      <Card>
        <CardHeader
          title="Gmail Integration"
          subtitle="Configure Gmail credentials for sending emails and managing conversations"
          action={
            <div className="flex items-center space-x-2">
              {formData.gmail_client_id && formData.gmail_client_secret && formData.gmail_refresh_token ? (
                <Badge variant="success" size="sm">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Connected (via .env)
                </Badge>
              ) : (
                <Badge variant="warning" size="sm">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Missing .env Credentials
                </Badge>
              )}
            </div>
          }
        />
        <CardBody>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Client ID (from .env file)"
                value={formData.gmail_client_id}
                onChange={(e) => setFormData(prev => ({ ...prev, gmail_client_id: e.target.value }))}
                placeholder="your-gmail-client-id.apps.googleusercontent.com"
                icon={Mail}
                disabled={true}
              />
              <Input
                label="Client Secret (from .env file)"
                type="password"
                value={formData.gmail_client_secret}
                onChange={(e) => setFormData(prev => ({ ...prev, gmail_client_secret: e.target.value }))}
                placeholder="your-gmail-client-secret"
                icon={Key}
                disabled={true}
              />
            </div>
            
            <TextArea
              label="Refresh Token (from .env file)"
              value={formData.gmail_refresh_token}
              onChange={(e) => setFormData(prev => ({ ...prev, gmail_refresh_token: e.target.value }))}
              placeholder="1//04..."
              rows={3}
              hint="Long-lived token for accessing Gmail API (loaded from .env file)"
              disabled={true}
            />
            

            
            <TextArea
              label="Access Token (Optional)"
              value={formData.gmail_access_token}
              onChange={(e) => setFormData(prev => ({ ...prev, gmail_access_token: e.target.value }))}
              placeholder="ya29..."
              rows={3}
              hint="Short-lived token (will be refreshed automatically)"
            />
            
            <div className="flex space-x-3">
              <Button
                onClick={() => handleSave('gmail')}
                loading={saving}
                icon={Save}
                size="sm"
                disabled={true}
              >
                Credentials from .env (Read-only)
              </Button>
              <Button
                onClick={testGmail}
                loading={testing.gmail}
                icon={TestTube}
                variant="outline"
                size="sm"
              >
                Test Gmail Connection
              </Button>
              <Button
                onClick={async () => {
                  try {
                    await gmailUtils.initiateAuth();
                    toast.success('Redirecting to Google authorization page...');
                  } catch (error) {
                    toast.error('Failed to initiate authorization');
                  }
                }}
                icon={Key}
                variant="outline"
                size="sm"
              >
                Connect Gmail Account
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* AI Settings Moved */}
      <Card>
        <CardHeader
          title="AI Settings Moved"
          subtitle="AI configuration has been moved to a dedicated page for better organization"
          action={<MessageSquare className="h-5 w-4 text-gray-400" />}
        />
        <CardBody>
          <div className="text-center py-8">
            <MessageSquare className="h-16 w-16 text-blue-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              AI Settings Moved to AI Configurations
            </h3>
            <p className="text-gray-600 mb-4">
              All AI-related settings including prompts, model parameters, and integration overrides 
              have been moved to the new AI Configurations page for better organization and control.
            </p>
            <Button
              onClick={() => window.location.href = '/ai-config'}
              icon={MessageSquare}
              size="lg"
              className="bg-blue-600 hover:bg-blue-700"
            >
              Go to AI Configurations
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* System Status */}
      <Card>
        <CardHeader
          title="System Status"
          subtitle="Current integration status and health checks"
          action={<Clock className="h-5 w-5 text-gray-400" />}
        />
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
              <div className={`p-2 rounded-full ${formData.openai_api_key ? 'bg-green-100' : 'bg-red-100'}`}>
                <Key className={`h-4 w-4 ${formData.openai_api_key ? 'text-green-600' : 'text-red-600'}`} />
              </div>
              <div>
                <div className="font-medium text-gray-900">OpenAI</div>
                <div className={`text-sm ${formData.openai_api_key ? 'text-green-600' : 'text-red-600'}`}>
                  {formData.openai_api_key ? 'Connected' : 'Not configured'}
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
              <div className={`p-2 rounded-full ${formData.gmail_connected ? 'bg-green-100' : 'bg-red-100'}`}>
                <Mail className={`h-4 w-4 ${formData.gmail_connected ? 'text-green-600' : 'text-red-600'}`} />
              </div>
              <div>
                <div className="font-medium text-gray-900">Gmail</div>
                <div className={`text-sm ${formData.gmail_connected ? 'text-green-600' : 'text-red-600'}`}>
                  {formData.gmail_connected ? (
                    <div>
                      <div>Connected</div>
                      {formData.gmail_user_email && (
                        <div className="text-xs text-gray-500 mt-1">
                          {formData.gmail_user_email}
                        </div>
                      )}
                    </div>
                  ) : (
                    'Not configured'
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
              <div className="p-2 rounded-full bg-blue-100">
                <SettingsIcon className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <div className="font-medium text-gray-900">Database</div>
                <div className="text-sm text-green-600">Connected</div>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};