import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function setupDatabase() {
  console.log('🚀 Setting up database tables...');

  try {
    // 1. Create settings table
    console.log('📋 Creating settings table...');
    const { error: settingsError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS settings (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id TEXT NOT NULL UNIQUE,
          openai_api_key TEXT,
          gmail_client_id TEXT,
          gmail_client_secret TEXT,
          gmail_refresh_token TEXT,
          gmail_access_token TEXT,
          gmail_user_email TEXT,
          gmail_connected BOOLEAN DEFAULT false,
          tone_default TEXT DEFAULT 'professional',
          length_default TEXT DEFAULT 'medium',
          default_resume_id UUID,
          followup_rules_id UUID,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });

    if (settingsError) {
      console.log('ℹ️  Settings table might already exist or using different method');
    }

    // 2. Create leads table
    console.log('📋 Creating leads table...');
    const { error: leadsError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS leads (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id TEXT NOT NULL,
          company TEXT NOT NULL,
          role TEXT NOT NULL,
          location TEXT,
          seniority TEXT,
          description_text TEXT,
          must_haves TEXT[],
          nice_to_haves TEXT[],
          keywords TEXT[],
          source_type TEXT DEFAULT 'manual',
          source_ref TEXT,
          status TEXT DEFAULT 'identified',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });

    if (leadsError) {
      console.log('ℹ️  Leads table might already exist or using different method');
    }

    // 3. Create contacts table
    console.log('📋 Creating contacts table...');
    const { error: contactsError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS contacts (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
          user_id TEXT NOT NULL,
          name TEXT NOT NULL,
          title TEXT,
          email TEXT,
          phone TEXT,
          linkedin_url TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });

    if (contactsError) {
      console.log('ℹ️  Contacts table might already exist or using different method');
    }

    // 4. Create applications table
    console.log('📋 Creating applications table...');
    const { error: applicationsError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS applications (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
          user_id TEXT NOT NULL,
          stage TEXT DEFAULT 'identified',
          status TEXT DEFAULT 'active',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });

    if (applicationsError) {
      console.log('ℹ️  Applications table might already exist or using different method');
    }

    // 5. Create documents table (for AI config and other content)
    console.log('📋 Creating documents table...');
    const { error: documentsError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS documents (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id TEXT NOT NULL,
          title TEXT NOT NULL,
          content TEXT,
          type TEXT DEFAULT 'note',
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });

    if (documentsError) {
      console.log('ℹ️  Documents table might already exist or using different method');
    }

    // 6. Create resumes table
    console.log('📋 Creating resumes table...');
    const { error: resumesError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS resumes (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id TEXT NOT NULL,
          title TEXT NOT NULL,
          filename TEXT,
          file_url TEXT,
          storage_path TEXT,
          size INTEGER,
          content_type TEXT,
          description TEXT,
          focus_tags TEXT[],
          json_struct JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });

    if (resumesError) {
      console.log('ℹ️  Resumes table might already exist or using different method');
    }

    // 7. Insert default AI configuration
    console.log('🤖 Inserting default AI configuration...');
    const defaultAIConfig = {
      defaults: {
        tone: 'professional',
        length: 'medium',
        model: 'gpt-4o-mini',
        temperature: 0.7,
        max_tokens: 500,
        top_p: 0.9,
        presence_penalty: 0.0,
        frequency_penalty: 0.0
      },
      prompts: {
        email_generation: {
          system: 'You are an expert email strategist and professional communicator. Your task is to generate compelling, personalized emails for job applications that showcase the candidate\'s value and align with the job requirements.',
          user_template: 'Generate a professional email for a job application with the following details:\nCompany: {company}\nRole: {role}\nLocation: {location}\nMust-have skills: {must_haves}\nNice-to-have skills: {nice_to_haves}\nTone: {tone}\nLength: {length}'
        },
        company_research: {
          system: 'You are a business research analyst. Your task is to analyze companies and provide insights about their business model, market position, and growth potential.',
          user_template: 'Research and analyze the company: {company}\nFocus on: business model, market position, growth potential, and key insights for job applicants.'
        },
        fit_analysis: {
          system: 'You are a career counselor and job matching specialist. Your task is to analyze how well a candidate fits a specific job opportunity.',
          user_template: 'Analyze the fit between the candidate and job opportunity:\nCompany: {company}\nRole: {role}\nRequired skills: {must_haves}\nPreferred skills: {nice_to_haves}\nCandidate background: {candidate_background}'
        },
        thread_reply: {
          system: 'You are an expert email strategist and professional communicator. Your task is to generate the next message in an ongoing email thread that continues the conversation naturally and professionally.',
          user_template: 'Thread Context: {thread_summary}\nCurrent Task: {current_task}\nPrevious Messages: {message_history}\nYour Role: {sender_role}\nTone: {tone}'
        },

      }
    };

    const { error: aiConfigError } = await supabase
      .from('documents')
      .upsert({
        title: 'AI Configuration',
        content: JSON.stringify(defaultAIConfig),
        type: 'note',
        user_id: 'default-user',
        metadata: {
          configType: 'ai_configuration',
          version: '1.0',
          updatedAt: new Date().toISOString()
        }
      }, {
        onConflict: 'title,user_id'
      });

    if (aiConfigError) {
      console.log('ℹ️  AI config might already exist:', aiConfigError.message);
    }

    // 8. Insert default settings
    console.log('⚙️  Inserting default settings...');
    const { error: defaultSettingsError } = await supabase
      .from('settings')
      .upsert({
        user_id: 'me',
        tone_default: 'professional',
        length_default: 'medium',
        gmail_connected: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (defaultSettingsError) {
      console.log('ℹ️  Default settings might already exist:', defaultSettingsError.message);
    }

    console.log('✅ Database setup completed successfully!');
    console.log('📊 Tables created/verified:');
    console.log('   - settings');
    console.log('   - leads');
    console.log('   - contacts');
    console.log('   - applications');
    console.log('   - documents');
    console.log('   - resumes');
    console.log('🤖 Default AI configuration inserted');
    console.log('⚙️  Default settings inserted');

  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  }
}

setupDatabase();
