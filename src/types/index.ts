export interface User {
  id: string;
  name?: string;
  email?: string;
  headline?: string;
  locations?: string[];
  notice_period?: string;
  salary_history?: any;
  salary_expectation_min?: number;
  salary_expectation_max?: number;
  currency?: string;
  sectors?: string[];
  tags?: string[];
  created_at: string;
  updated_at: string;
}

export interface Resume {
  id: string;
  user_id: string;
  title: string;
  focus_tags?: string[];
  file_url?: string;
  size?: number;
  json_struct?: any;
  created_at: string;
}

export interface Snippet {
  id: string;
  user_id: string;
  category: 'achievement' | 'incident' | 'story' | 'metric' | 'case-study';
  content: string;
  tags?: string[];
  evidence_links?: string[];
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  user_id: string;
  source_type: 'screenshot' | 'url' | 'manual';
  source_ref?: string;
  company?: string;
  role?: string;
  location?: string;
  seniority?: string;
  description_text?: string;
  description?: string;
  must_haves?: string[];
  nice_to_haves?: string[];
  keywords?: string[];
  confidence: number;
  status: 'new' | 'enriched' | 'ready_for_outreach' | 'archived';
  // Stored analysis data
  fit_analysis?: any;
  company_research?: any;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  user_id: string;
  lead_id?: string;
  name?: string;
  title?: string;
  email?: string;
  phone?: string;
  linkedin_url?: string;
  photo_url?: string;
  source: 'parsed' | 'manual';
  confidence: number;
  created_at: string;
}

export interface Application {
  id: string;
  lead_id: string;
  stage: 'identified' | 'applied' | 'warm_intro' | 'interviewing' | 'offer' | 'closed';
  last_action_at: string;
  next_followup_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  lead?: Lead;
  contacts?: Contact[];
  messages?: Message[];
}

export interface Message {
  id: string;
  application_id: string;
  contact_id?: string;
  channel: 'email';
  direction: 'out' | 'in';
  gmail_msg_id?: string;
  gmail_thread_id?: string;
  subject?: string;
  snippet?: string;
  body_text?: string;
  sent_at?: string;
  received_at?: string;
  read: boolean;
  created_at: string;
  contact?: Contact;
}

export interface Artifact {
  id: string;
  lead_id: string;
  type: 'cover_letter' | 'email_body' | 'blurb';
  input_profile_id?: string;
  resume_id?: string;
  snippets_used?: string[];
  prompt_preset_id?: string;
  body_text?: string;
  body_html?: string;
  tone?: string;
  length_hint?: string;
  created_at: string;
  lead?: Lead;
  resume?: Resume;
}

export interface PromptPreset {
  id: string;
  user_id: string;
  name: string;
  artifact_type: 'cover_letter' | 'email_body' | 'blurb' | 'follow_up';
  prompt_template: string;
  variables?: string[];
  created_at: string;
  updated_at: string;
}

export interface Settings {
  id: string;
  user_id: string;
  openai_api_key?: string;
  gmail_client_id?: string;
  gmail_client_secret?: string;
  gmail_refresh_token?: string;
  gmail_access_token?: string;
  gmail_user_email?: string;
  default_resume_id?: string;
  tone_default: string;
  length_default: string;
  followup_rules_id?: string;
  gmail_connected: boolean;
  // Configuration status flags
  openai_configured?: boolean;
  gmail_configured?: boolean;
  // AI Prompt Configuration
  email_generation_system_prompt?: string;
  email_generation_user_prompt_template?: string;
  company_research_system_prompt?: string;
  fit_analysis_system_prompt?: string;
  created_at: string;
  updated_at: string;
}

export interface FollowupRule {
  id: string;
  user_id: string;
  schedule: any;
  pause_on_reply: boolean;
  workdays_only: boolean;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface FollowupTemplate {
  id: string;
  user_id: string;
  name: string;
  prompt_template: string;
  variables?: string[];
  created_at: string;
  updated_at: string;
}

export interface FileUpload {
  id: string;
  user_id: string;
  kind: 'screenshot' | 'resume' | 'attachment';
  file_url: string;
  mime_type?: string;
  size?: number;
  linked_lead_id?: string;
  created_at: string;
}

// Form types
export interface CreateLeadForm {
  company: string;
  role: string;
  location?: string;
  description_text?: string;
  source_type: 'manual';
}

export interface CreateContactForm {
  name: string;
  title?: string;
  email?: string;
  phone?: string;
  linkedin_url?: string;
  lead_id?: string;
}

export interface GenerateContentForm {
  artifact_type: 'cover_letter' | 'email_body' | 'blurb';
  lead_id: string;
  resume_id?: string;
  snippets_used?: string[];
  prompt_preset_id?: string;
  custom_prompt?: string;
  tone: string;
  length_hint: string;
}

export interface ComposeEmailForm {
  to: string[];
  subject: string;
  body: string;
  attachments?: string[];
  application_id?: string;
}

// API Response types
export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// UI State types
export interface GlobalState {
  user: User | null;
  settings: Settings | null;
  selectedLead: Lead | null;
  selectedApplication: Application | null;
  sidebarOpen: boolean;
  loading: boolean;
}

export interface ContentStudioState {
  selectedTone: string;
  selectedLength: string;
  selectedSnippets: string[];
  selectedResume?: string;
  currentArtifact?: Artifact;
  previewOpen: boolean;
}