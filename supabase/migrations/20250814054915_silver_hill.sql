/*
  # Initial Schema for Lazy Bird

  1. New Tables
    - `users` - User profile information
    - `resumes` - Resume storage and metadata
    - `snippets` - Reusable content snippets
    - `leads` - Job opportunities
    - `contacts` - Contact information for leads
    - `artifacts` - Generated content (cover letters, emails, etc.)
    - `applications` - Application tracking
    - `application_contacts` - Many-to-many relationship between applications and contacts
    - `messages` - Email messages and threads
    - `files` - File storage metadata
    - `settings` - User settings and API keys
    - `prompt_presets` - AI prompt templates
    - `followup_rules` - Follow-up scheduling rules
    - `followup_templates` - Follow-up message templates

  2. Security
    - RLS disabled for Phase 1 (single user app)
    - All tables use hardcoded user_id = 'me'

  3. Indexes
    - Full-text search on leads.description_text and snippets.content
    - GIN indexes on array fields for efficient searching
    - BTREE indexes on frequently queried fields
*/

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY DEFAULT 'me',
  name text,
  email text,
  headline text,
  locations text[],
  notice_period text,
  salary_history jsonb,
  salary_expectation_min integer,
  salary_expectation_max integer,
  currency text DEFAULT 'INR',
  sectors text[],
  tags text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Resumes table
CREATE TABLE IF NOT EXISTS resumes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text DEFAULT 'me' NOT NULL,
  title text NOT NULL,
  focus_tags text[],
  file_url text,
  json_struct jsonb,
  created_at timestamptz DEFAULT now(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Snippets table
CREATE TABLE IF NOT EXISTS snippets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text DEFAULT 'me' NOT NULL,
  category text CHECK (category IN ('achievement', 'incident', 'story', 'metric', 'case-study')),
  content text NOT NULL,
  tags text[],
  evidence_links text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Leads table
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text DEFAULT 'me' NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('screenshot', 'url', 'manual')),
  source_ref text,
  company text,
  role text,
  location text,
  seniority text,
  description_text text,
  must_haves text[],
  nice_to_haves text[],
  keywords text[],
  confidence real DEFAULT 0.0,
  status text DEFAULT 'new' CHECK (status IN ('new', 'enriched', 'ready_for_outreach', 'archived')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Contacts table
CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text DEFAULT 'me' NOT NULL,
  lead_id uuid,
  name text,
  title text,
  email text,
  phone text,
  linkedin_url text,
  photo_url text,
  source text DEFAULT 'manual' CHECK (source IN ('parsed', 'manual')),
  confidence real DEFAULT 1.0,
  created_at timestamptz DEFAULT now(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

-- Prompt presets table
CREATE TABLE IF NOT EXISTS prompt_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text DEFAULT 'me' NOT NULL,
  name text NOT NULL,
  artifact_type text CHECK (artifact_type IN ('cover_letter', 'email_body', 'blurb', 'follow_up')),
  prompt_template text NOT NULL,
  variables text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Artifacts table
CREATE TABLE IF NOT EXISTS artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('cover_letter', 'email_body', 'blurb')),
  input_profile_id text,
  resume_id uuid,
  snippets_used uuid[],
  prompt_preset_id uuid,
  body_text text,
  body_html text,
  tone text,
  length_hint text,
  created_at timestamptz DEFAULT now(),
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  FOREIGN KEY (input_profile_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (resume_id) REFERENCES resumes(id) ON DELETE SET NULL,
  FOREIGN KEY (prompt_preset_id) REFERENCES prompt_presets(id) ON DELETE SET NULL
);

-- Applications table
CREATE TABLE IF NOT EXISTS applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  stage text DEFAULT 'identified' CHECK (stage IN ('identified', 'applied', 'warm_intro', 'interviewing', 'offer', 'closed')),
  last_action_at timestamptz DEFAULT now(),
  next_followup_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

-- Application contacts junction table
CREATE TABLE IF NOT EXISTS application_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL,
  contact_id uuid NOT NULL,
  role text,
  priority smallint DEFAULT 1,
  UNIQUE(application_id, contact_id),
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL,
  contact_id uuid,
  channel text DEFAULT 'email' CHECK (channel = 'email'),
  direction text NOT NULL CHECK (direction IN ('out', 'in')),
  gmail_msg_id text,
  gmail_thread_id text,
  subject text,
  snippet text,
  body_text text,
  sent_at timestamptz,
  received_at timestamptz,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL
);

-- Files table
CREATE TABLE IF NOT EXISTS files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text DEFAULT 'me' NOT NULL,
  kind text NOT NULL CHECK (kind IN ('screenshot', 'resume', 'attachment')),
  file_url text NOT NULL,
  mime_type text,
  size bigint,
  linked_lead_id uuid,
  created_at timestamptz DEFAULT now(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (linked_lead_id) REFERENCES leads(id) ON DELETE SET NULL
);

-- Followup rules table
CREATE TABLE IF NOT EXISTS followup_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text DEFAULT 'me' NOT NULL,
  schedule jsonb,
  pause_on_reply boolean DEFAULT true,
  workdays_only boolean DEFAULT true,
  timezone text DEFAULT 'Asia/Kolkata',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Followup templates table
CREATE TABLE IF NOT EXISTS followup_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text DEFAULT 'me' NOT NULL,
  name text NOT NULL,
  prompt_template text NOT NULL,
  variables text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text DEFAULT 'me' NOT NULL UNIQUE,
  openai_api_key text,
  gmail_client_id text,
  gmail_client_secret text,
  gmail_refresh_token text,
  gmail_access_token text,
  default_resume_id uuid,
  tone_default text DEFAULT 'honest',
  length_default text DEFAULT 'medium',
  followup_rules_id uuid,
  gmail_connected boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (default_resume_id) REFERENCES resumes(id) ON DELETE SET NULL,
  FOREIGN KEY (followup_rules_id) REFERENCES followup_rules(id) ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_snippets_content ON snippets USING gin (to_tsvector('english', content));
CREATE INDEX IF NOT EXISTS idx_snippets_tags ON snippets USING gin (tags);
CREATE INDEX IF NOT EXISTS idx_leads_description_text ON leads USING gin (to_tsvector('english', description_text));
CREATE INDEX IF NOT EXISTS idx_leads_keywords ON leads USING gin (keywords);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads USING btree (status);
CREATE INDEX IF NOT EXISTS idx_contacts_lead_id ON contacts USING btree (lead_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_lead_id ON artifacts USING btree (lead_id);
CREATE INDEX IF NOT EXISTS idx_applications_stage ON applications USING btree (stage);
CREATE INDEX IF NOT EXISTS idx_applications_next_followup ON applications USING btree (next_followup_at);
CREATE INDEX IF NOT EXISTS idx_messages_application_id ON messages USING btree (application_id);
CREATE INDEX IF NOT EXISTS idx_messages_gmail_thread_id ON messages USING btree (gmail_thread_id);

-- Insert default user
INSERT INTO users (id, name, email, headline, currency) 
VALUES ('me', 'User', 'user@example.com', 'Job Seeker', 'INR')
ON CONFLICT (id) DO NOTHING;

-- Insert seed prompt presets
INSERT INTO prompt_presets (name, artifact_type, prompt_template, variables) VALUES
(
  'Cover Letter - Honest & Standout (PM)',
  'cover_letter',
  'Write a 220–260 word cover letter. Tone: honest, standout, no clichés.
Map 3–4 JD must-haves to my quantified achievements.
Candidate: {{profile}}
Resume JSON: {{resume_json}}
Job: {{jd_text}}
Company: {{company}} | Role: {{role}}
If gaps exist, address them briefly.
Close with availability and a soft CTA.',
  ARRAY['profile', 'resume_json', 'jd_text', 'company', 'role']
),
(
  'Recruiter Email - Short & Human',
  'email_body',
  'Write a 90–130 word email to a recruiter/hiring manager.
Make it human, specific to {{company}} and {{role}}. Include one crisp metric.
Ask for a quick 5-min fit check or next steps.
Provide 5 subject lines under 60 characters.
Inputs: {{profile}}, {{resume_json}}, {{jd_text}}
Tone: {{tone}} | Length: {{length}}',
  ARRAY['company', 'role', 'profile', 'resume_json', 'jd_text', 'tone', 'length']
),
(
  'Follow-up - Gentle Bump',
  'follow_up',
  'Write a 60–90 word polite follow-up referencing our last thread.
Offer availability Tue–Thu 4–6pm IST and an optional 1-pager.
Keep it helpful, not pushy. Inputs: {{company}}, {{role}}, {{last_email_summary}}',
  ARRAY['company', 'role', 'last_email_summary']
)
ON CONFLICT DO NOTHING;