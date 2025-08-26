import React, { useState, useEffect, useCallback } from 'react';
import { 
  Save, 
  RotateCcw, 
  Play, 
  Sparkles, 
  Settings, 
  MessageSquare, 
  Building, 
  Target,
  TestTube,
  History,
  Download,
  Upload,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';
import { apiUrls } from '../lib/config';

// Types for AI Configuration
interface AIDefaults {
  tone: string;
  length: string;
  model: string;
  temperature: number;
  top_p: number;
  max_tokens?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  safety: {
    sanitizeHTML: boolean;
    stripPII: boolean;
  };
}

interface AIPrompt {
  system: string;
  user_template?: string;
  notes?: string;
}

interface AIPrompts {
  email_generation: AIPrompt;
  company_research: AIPrompt;
  fit_analysis: AIPrompt;
  thread_reply: AIPrompt;
  [key: string]: AIPrompt;
}

interface IntegrationOverride {
  enabled: boolean;
  model?: string;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  prompts?: Record<string, AIPrompt>;
}

interface AIConfig {
  defaults: AIDefaults;
  prompts: AIPrompts;
  overrides: Record<string, IntegrationOverride>;
  meta: { lastSavedISO: string };
}

const defaultConfig: AIConfig = {
  defaults: {
    tone: 'honest',
    length: 'medium',
    model: 'gpt-4o',
    temperature: 0.7,
    top_p: 0.9,
    max_tokens: 1000,
    presence_penalty: 0.0,
    frequency_penalty: 0.0,
    safety: {
      sanitizeHTML: true,
      stripPII: true
    }
  },
  "prompts": {
    "email_generation": {
      "system": "You are an expert storyteller and job-application strategist. Your mission: craft a witty, high-personalization, narrative-driven email that lands a memorable first impression in the first two lines.\n\nINPUTS YOU WILL RECEIVE:\n• Knowledge Base (KB): the candidate’s resume and additional facts—this is the ONLY source for personal details.\n• Custom Context: may include { company_research, fit_analysis } summaries. Treat these as factual context about the target company and role-fit. Do not invent beyond what is provided.\n\nCRITICAL REQUIREMENTS:\n1) Use the EXACT personal details from the KB—name, education, roles, companies, projects, tools, metrics, contact info. No inventions.\n2) Reference specific projects, companies, skills, tools, and achievements with numbers or scope where the KB provides them.\n3) Personalization minimums: (a) 3+ concrete resume facts, (b) 1 role-relevant hook from company_research, (c) 1 explicit bridge from fit_analysis (how the candidate maps to a must-have).\n4) No generic statements. Every claim must be traceable to the KB or Custom Context.\n5) Narrative structure:\n   • Hook (pattern-interrupt in 1–2 lines): sharp question, bold stat, or day-1 plan teaser tied to {role}\n   • Story arc: problem → action → measurable outcome using resume metrics\n   • Tie-in: connect outcomes to the company’s current priorities (from company_research)\n   • Fit-bridge: explicitly map candidate strengths to 1–2 must-haves (from fit_analysis)\n   • Close: confident, specific CTA (e.g., 15-min chat, 1-pager teardown, 100-day sketch)\n6) Wit & voice guardrails: tasteful, smart, one-liner wit allowed; no sarcasm at the reader, no buzzword soup, no flattery. Short sentences. Active voice.\n7) Respect any stated Tone. Stay human. Zero clichés.\n8) If a required personal field is missing from KB, respond exactly: \"Required candidate detail missing from knowledge base; cannot proceed.\"\n\nTAILORING RULES:\n• Use only provided research; do not speculate. If Custom Context is empty, write a strong KB-anchored story without external claims.\n• Keep body ~200–250 words unless Word_Limit is explicitly given.\n• Avoid bullets unless Must Haves explicitly ask for them.\n• Subject line: role-aligned, specific, 9–12 words, no clickbait, may include a concrete metric or outcome.\n\nOUTPUT FORMAT (MANDATORY):\nReturn ONLY valid JSON:\n{\n  \"subject\": \"Email subject line\",\n  \"body\": \"Full email body as plain text\"\n}\n\nCRITICAL: Output must be ONLY the JSON object—no explanations or extra text.",
      "user_template": "Job Details:\nCompany: {company}\nRole: {role}\nLocation: {location}\nSeniority: {seniority}\nDescription: {description}\nMust Haves: {must_haves}\nNice to Haves: {nice_to_haves}\nKeywords: {keywords}\n\nContact Information:\nName: {contact_name}\nTitle: {contact_title}\nEmail: {contact_email}\n\nTone: {tone}\nResearch Depth: {research_depth}\nCustom Context: {custom_context}\n\nSTORYTELLING INSTRUCTIONS:\n- Open with a bold, witty hook tied to the role (stat/question/day-1 plan)\n- Weave a clear narrative arc showing growth and measurable impact\n- Use specific examples and metrics to make achievements tangible\n- Tie the candidate’s proof points directly to the company’s current priorities (from company_research) and the role’s must-haves (from fit_analysis)\n- End with a confident CTA proposing a concrete next step",
      "notes": "JSON-enforcing, story-first email with witty yet tasteful pattern interrupt; consumes KB + optional {company_research, fit_analysis} from Custom Context"
    },
    "company_research": {
      "system": "You are a business research analyst. Produce crisp, hook-ready intel that fuels a witty, role-aligned opener and concrete tie-ins—using only materials provided or explicitly permitted.\n\nDeliver a scannable output with these sections:\n1) TL;DR (3 bullets): what they build, why customers pick them, why now\n2) Product & ICP: core product(s), target users/buyers; any pricing hints if present\n3) Momentum: 3–5 recent items (launches, funding, partnerships, regulatory shifts, notable hires) with dates if given\n4) Competitive Lens: 2–3 nearest competitors + 1 defensible differentiator\n5) Role Signals: language in JDs or careers page that maps to must-haves; any KPIs implied\n6) Risks/Unknowns: 2–3 areas to probe on a first call\n7) Hook Ideas (3): edgy but professional opening lines using ONLY provided facts\n\nRules: Be precise, avoid hype, no speculation. Prefer concrete nouns over adjectives. If info is missing, say so.",
      "notes": "Surfaces punchy, role-relevant insights and opener candidates to inject into the email"
    },
    "fit_analysis": {
      "system": "You are a career assessment specialist. Translate candidate–role fit into practical, drop-in lines for a witty, high-conversion email.\n\nOutput:\n• Strength Match (3–5): direct quotes of resume-backed wins mapped to the job’s must-haves (include metrics/tools)\n• Gap Map (2–3): likely gaps based on the job description\n• Bridge Tactics (per gap): a concise framing the candidate can use (1–2 sentences) to neutralize each gap\n• Proof Inserts (3): micro-cases in the form problem → action → metric, lifted from the resume\n• CTA Options (3): distinct closes (15-min chat, 1-pager teardown, 100-day sketch)\n• One-Liners (2): tasteful, witty positioning lines the candidate can use without sounding salesy\n\nRules: Only use resume/KB and job text. No inventions. Keep each bullet compact, specific, and ready to paste.",
      "notes": "Generates fit talking points and witty, paste-ready lines that plug into the email narrative"
    },
    "thread_reply": {
      "system": "You are an expert email strategist. Write the next message in an ongoing thread, moving it forward with brevity and a light human touch.\n\nCRITICAL REQUIREMENTS:\n1) Read and reflect the full thread context (tone, content, purpose)\n2) Maintain the established professional style, with optional light wit if appropriate\n3) Reference at least one specific prior detail\n4) Advance the purpose (decision, scheduling, clarification, close) in 2–4 sentences\n5) Clean formatting: greeting, one blank line between paragraphs, clear close & signature\n6) No repetition—add net new value (answer a question, propose exact times, attach next steps)\n7) PLAIN TEXT only—no JSON, no subject lines\n8) Start with the greeting; end with the signature\n9) If an action was requested, explicitly confirm delivery or propose exact timing",
      "user_template": "Thread Context: {thread_summary} Current Task: {current_task} Previous Messages: {message_history} Your Role: {sender_role} Tone: {tone}",
      "notes": "Keeps momentum in threads; permits subtle wit while staying precise and professional"
    }
  },
  overrides: {
    gmail: { enabled: false },
    linkedin: { enabled: false },
    ats: { enabled: false },
    notion: { enabled: false },
    slack: { enabled: false }
  },
  meta: { lastSavedISO: new Date().toISOString() }
};

export const AIConfigurations: React.FC = () => {
  const [config, setConfig] = useState<AIConfig>(defaultConfig);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('defaults');
  const [testResult, setTestResult] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);



  // Check if user has admin access (feature flag)
  const hasAdminAccess = true; // TODO: Implement proper RBAC

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const response = await fetch(apiUrls.aiConfig());
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      if (data.success && data.config) {
        setConfig(data.config);
        setIsDirty(false);
        console.log('✅ AI config loaded successfully');
      } else {
        console.log('ℹ️ Using default AI config');
        setConfig(defaultConfig);
      }
    } catch (error) {
      console.error('Failed to load AI config:', error);
      console.log('ℹ️ Using default AI config due to error');
      setConfig(defaultConfig);
    }
  };

  const saveConfig = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(apiUrls.aiConfig(), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      if (data.success && data.config) {
        setConfig(data.config);
        setIsDirty(false);
        toast.success('AI configuration saved successfully');
        console.log('✅ AI config saved successfully');
      } else {
        throw new Error(data.error || 'Invalid response format');
      }
    } catch (error: any) {
      console.error('Failed to save AI config:', error);
      toast.error(`Failed to save AI configuration: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const resetConfig = () => {
    setConfig(defaultConfig);
    setIsDirty(false);
    toast.success('Configuration reset to defaults');
  };

  const runTest = async () => {
    setIsTesting(true);
    try {
      const response = await fetch(apiUrls.aiConfig('/test'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptType: 'email_generation',
          variables: { company: 'Test Corp', role: 'Developer', location: 'Remote' }
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      if (data.success) {
        setTestResult(data);
        toast.success('Test completed successfully');
        console.log('✅ AI test completed successfully');
      } else {
        throw new Error(data.error || 'Test failed');
      }
    } catch (error) {
      console.error('Test failed:', error);
      toast.error('Test failed');
    } finally {
      setIsTesting(false);
    }
  };

  const handleConfigChange = (path: string, value: any) => {
    const newConfig = { ...config };
    const keys = path.split('.');
    let current: any = newConfig;
    
    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]];
    }
    
    current[keys[keys.length - 1]] = value;
    setConfig(newConfig);
    setIsDirty(true);
  };

  if (!hasAdminAccess) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You don't have permission to access AI Configurations.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-blue-600" />
              AI Configurations
            </h1>
            <p className="text-gray-600 mt-1">
              Central control for prompts, parameters, and integration overrides
            </p>
          </div>
          
          {/* Sticky Action Bar */}
          <div className="flex items-center gap-3">
            {isDirty && (
              <Badge variant="warning" className="bg-yellow-100 text-yellow-800">
                Unsaved changes
              </Badge>
            )}
            <Button
              variant="outline"
              onClick={resetConfig}
              disabled={isSaving}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Button
              onClick={saveConfig}
              disabled={!isDirty || isSaving}
              loading={isSaving}
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
        
        {/* Last Saved Info */}
        <div className="mt-3 text-sm text-gray-500">
          Last saved: {config.meta?.lastSavedISO ? new Date(config.meta.lastSavedISO).toLocaleString() : 'Never'}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {/* Tab Navigation */}
        <div className="bg-white border-b border-gray-200 px-6">
          <div className="flex space-x-8">
            {[
              { id: 'defaults', label: 'Defaults', icon: Settings },
              { id: 'prompts', label: 'Prompts', icon: MessageSquare },
              { id: 'overrides', label: 'Overrides', icon: Building },
              { id: 'testing', label: 'Testing', icon: TestTube },
              { id: 'versioning', label: 'Versioning', icon: History }
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium transition-colors ${
                    isActive
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'defaults' && (
            <div className="space-y-6">
              {/* Default Content Settings */}
              <Card>
                <CardHeader
                  title="Default Content Settings"
                  subtitle="Set default preferences for AI-generated content"
                />
                <CardBody>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          <Settings className="h-4 w-4 inline mr-2" />
                          Default Tone
                        </label>
                        <select
                          value={config.defaults.tone}
                          onChange={(e) => handleConfigChange('defaults.tone', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="honest">Honest</option>
                          <option value="professional">Professional</option>
                          <option value="friendly">Friendly</option>
                          <option value="confident">Confident</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          <MessageSquare className="h-4 w-4 inline mr-2" />
                          Default Length
                        </label>
                        <select
                          value={config.defaults.length}
                          onChange={(e) => handleConfigChange('defaults.length', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="short">Short (1-2 paragraphs)</option>
                          <option value="medium">Medium (3-4 paragraphs)</option>
                          <option value="long">Long (5+ paragraphs)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>

              {/* Global Model & Parameters */}
              <Card>
                <CardHeader
                  title="Global Model & Parameters"
                  subtitle="Configure the default AI model and generation parameters"
                />
                <CardBody>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Model
                        </label>
                        <select
                          value={config.defaults.model}
                          onChange={(e) => handleConfigChange('defaults.model', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="gpt-4o">GPT-4o</option>
                          <option value="gpt-4o-mini">GPT-4o Mini</option>
                          <option value="gpt-5-thinking">GPT-5 Thinking</option>
                          <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Temperature
                        </label>
                        <Input
                          type="number"
                          min="0"
                          max="2"
                          step="0.1"
                          value={config.defaults.temperature}
                          onChange={(e) => handleConfigChange('defaults.temperature', parseFloat(e.target.value))}
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Top P
                        </label>
                        <Input
                          type="number"
                          min="0"
                          max="1"
                          step="0.1"
                          value={config.defaults.top_p}
                          onChange={(e) => handleConfigChange('defaults.top_p', parseFloat(e.target.value))}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Max Tokens
                        </label>
                        <Input
                          type="number"
                          min="1"
                          max="4000"
                          value={config.defaults.max_tokens}
                          onChange={(e) => handleConfigChange('defaults.max_tokens', parseInt(e.target.value))}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Presence Penalty
                        </label>
                        <Input
                          type="number"
                          min="-2"
                          max="2"
                          step="0.1"
                          value={config.defaults.presence_penalty}
                          onChange={(e) => handleConfigChange('defaults.presence_penalty', parseFloat(e.target.value))}
                        />
                      </div>
                    </div>

                    {/* Safety Toggles */}
                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-gray-700">
                        Safety Settings
                      </label>
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-sm text-gray-600">Sanitize HTML outputs</label>
                          <p className="text-xs text-gray-500">Clean and validate HTML content</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={config.defaults.safety.sanitizeHTML}
                          onChange={(e) => handleConfigChange('defaults.safety.sanitizeHTML', e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-sm text-gray-600">Strip PII</label>
                          <p className="text-xs text-gray-500">Remove personally identifiable information</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={config.defaults.safety.stripPII}
                          onChange={(e) => handleConfigChange('defaults.safety.stripPII', e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </div>
          )}

          {activeTab === 'prompts' && (
            <div className="space-y-6">
              {/* Email Generation */}
              <Card>
                <CardHeader
                  title="Email Generation"
                  subtitle="Configure prompts for AI-powered email generation"
                />
                <CardBody>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        System Prompt
                      </label>
                      <textarea
                        value={config.prompts.email_generation.system}
                        onChange={(e) => handleConfigChange('prompts.email_generation.system', e.target.value)}
                        placeholder="Define the AI's role and behavior for email generation"
                        rows={4}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        User Prompt Template
                      </label>
                      <textarea
                        value={config.prompts.email_generation.user_template}
                        onChange={(e) => handleConfigChange('prompts.email_generation.user_template', e.target.value)}
                        placeholder="Template for structuring the job and context information sent to AI"
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </CardBody>
              </Card>

              {/* Company Research */}
              <Card>
                <CardHeader
                  title="Company Research"
                  subtitle="Configure prompts for company research and analysis"
                />
                <CardBody>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      System Prompt
                    </label>
                    <textarea
                      value={config.prompts.company_research.system}
                      onChange={(e) => handleConfigChange('prompts.company_research.system', e.target.value)}
                      placeholder="This prompt defines how the AI researches companies"
                      rows={4}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </CardBody>
              </Card>

              {/* Fit Analysis */}
              <Card>
                <CardHeader
                  title="Fit Analysis"
                  subtitle="Configure prompts for job fit analysis"
                />
                <CardBody>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      System Prompt
                    </label>
                    <textarea
                      value={config.prompts.fit_analysis.system}
                      onChange={(e) => handleConfigChange('prompts.fit_analysis.system', e.target.value)}
                      placeholder="This prompt defines how the AI analyzes job fit"
                      rows={4}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </CardBody>
              </Card>

                      {/* Thread Reply */}
        <Card>
          <CardHeader
            title="Thread Reply Generation"
            subtitle="Configure prompts for AI-powered thread reply generation"
          />
          <CardBody>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  System Prompt
                </label>
                <textarea
                  value={config.prompts.thread_reply?.system || ''}
                  onChange={(e) => handleConfigChange('prompts.thread_reply.system', e.target.value)}
                  placeholder="Define the AI's role and behavior for thread reply generation"
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  User Prompt Template
                </label>
                <textarea
                  value={config.prompts.thread_reply?.user_template || ''}
                  onChange={(e) => handleConfigChange('prompts.thread_reply.user_template', e.target.value)}
                  placeholder="Template for structuring thread context and task information sent to AI"
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </CardBody>
        </Card>



              {/* Add New Prompt Type */}
              <Card>
                <CardBody>
                  <div className="text-center py-6">
                    <Button variant="outline" fullWidth>
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Add Prompt Type
                    </Button>
                  </div>
                </CardBody>
              </Card>
            </div>
          )}

          {activeTab === 'overrides' && (
            <div className="space-y-6">
              <Card>
                <CardHeader
                  title="Integration Overrides"
                  subtitle="Override AI settings for specific integrations"
                />
                <CardBody>
                  <div className="space-y-4">
                    {Object.entries(config.overrides).map(([key, override]) => (
                      <div key={key} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-medium text-gray-900 capitalize">{key}</h4>
                          <input
                            type="checkbox"
                            checked={override.enabled}
                            onChange={(e) => handleConfigChange(`overrides.${key}.enabled`, e.target.checked)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                        </div>
                        
                        {override.enabled && (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Override Model
                                </label>
                                <select
                                  value={override.model || config.defaults.model}
                                  onChange={(e) => handleConfigChange(`overrides.${key}.model`, e.target.value)}
                                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                  <option value="gpt-4o">GPT-4o</option>
                                  <option value="gpt-4o-mini">GPT-4o Mini</option>
                                  <option value="gpt-5-thinking">GPT-5 Thinking</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Override Temperature
                                </label>
                                <Input
                                  type="number"
                                  min="0"
                                  max="2"
                                  step="0.1"
                                  value={override.temperature || config.defaults.temperature}
                                  onChange={(e) => handleConfigChange(`overrides.${key}.temperature`, parseFloat(e.target.value))}
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
            </div>
          )}

          {activeTab === 'testing' && (
            <div className="space-y-6">
              <Card>
                <CardHeader
                  title="Testing Sandbox"
                  subtitle="Test your AI configuration with sample inputs"
                />
                <CardBody>
                  <div className="space-y-6">
                    {/* Test Configuration */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Prompt Type
                        </label>
                        <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                          <option value="email_generation">Email Generation</option>
                          <option value="company_research">Company Research</option>
                          <option value="fit_analysis">Fit Analysis</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Integration (Optional)
                        </label>
                        <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                          <option value="gmail">Gmail</option>
                          <option value="linkedin">LinkedIn</option>
                          <option value="ats">ATS</option>
                        </select>
                      </div>
                    </div>

                    {/* Test Variables */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Test Variables (JSON)
                      </label>
                      <textarea
                        placeholder='{"company": "Test Corp", "role": "Developer", "location": "Remote"}'
                        rows={4}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    {/* Test Actions */}
                    <div className="flex gap-3">
                      <Button
                        onClick={runTest}
                        disabled={isTesting}
                        loading={isTesting}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        {isTesting ? 'Running...' : 'Run Test'}
                      </Button>
                      <Button variant="outline">
                        Dry Run (No External Calls)
                      </Button>
                    </div>

                    {/* Test Results */}
                    {testResult && (
                      <div className="space-y-4">
                        <h4 className="font-medium">Test Results</h4>
                        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span className="text-sm font-medium">Output:</span>
                          </div>
                          <div className="bg-white rounded border p-3 text-sm">
                            {testResult.output}
                          </div>
                          
                          {testResult.tokens && (
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div>
                                <span className="font-medium">Prompt:</span> {testResult.tokens.prompt}
                              </div>
                              <div>
                                <span className="font-medium">Completion:</span> {testResult.tokens.completion}
                              </div>
                              <div>
                                <span className="font-medium">Total:</span> {testResult.tokens.total}
                              </div>
                            </div>
                          )}
                          
                          {testResult.latencyMs && (
                            <div className="text-sm">
                              <span className="font-medium">Latency:</span> {testResult.latencyMs}ms
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </CardBody>
              </Card>
            </div>
          )}

          {activeTab === 'versioning' && (
            <div className="space-y-6">
              <Card>
                <CardHeader
                  title="Versioning & Import/Export"
                  subtitle="Manage configuration versions and import/export settings"
                />
                <CardBody>
                  <div className="space-y-6">
                    {/* Version Actions */}
                    <div className="flex gap-3">
                      <Button variant="outline">
                        <History className="h-4 w-4 mr-2" />
                        Create Version
                      </Button>
                      <Button variant="outline">
                        <Download className="h-4 w-4 mr-2" />
                        Export JSON
                      </Button>
                      <Button variant="outline">
                        <Upload className="h-4 w-4 mr-2" />
                        Import JSON
                      </Button>
                    </div>

                    {/* Version List */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Saved Versions
                      </label>
                      <div className="mt-2 space-y-2">
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <div className="font-medium">Current Version</div>
                            <div className="text-sm text-gray-500">Last saved: {config.meta?.lastSavedISO ? new Date(config.meta.lastSavedISO).toLocaleString() : 'Never'}</div>
                          </div>
                          <Badge variant="default">Current</Badge>
                        </div>
                        <div className="text-center text-gray-500 py-8">
                          No previous versions found
                        </div>
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
