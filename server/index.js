// index.js
// Lazy Bird backend (ESM). Run with: node index.js
// Requires: express, cors, @supabase/supabase-js, openai, googleapis, dotenv

import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { google } from 'googleapis';
import dotenv from 'dotenv';
import * as cheerio from 'cheerio';
import axios from 'axios';
import { DocumentProcessor } from './services/documentProcessor.js';
import { AIEmailGenerator } from './services/aiEmailGenerator.js';

// Add fetch polyfill for Node.js
import fetch from 'node-fetch';
global.fetch = fetch;

/* ------------------------------ SHARED UTILITIES ------------------------------ */

/**
 * Standardize email body formatting across all flows
 * @param {string} input - Raw email body content
 * @param {string} mode - 'html' or 'text' (default: 'text')
 * @returns {string} - Formatted email body
 */
function formatEmailBody(input, mode = 'text') {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Normalize line endings
  let content = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  if (mode === 'html') {
    // Convert to HTML format
    // First, convert double line breaks to paragraph breaks
    content = content.replace(/\n\s*\n/g, '</p><p>');
    // Then convert single line breaks to <br> tags
    content = content.replace(/\n/g, '<br>');
    // Wrap in paragraph tags
    content = `<p>${content}</p>`;
    // Clean up empty paragraphs
    content = content.replace(/<p><\/p>/g, '');
    // Clean up consecutive <br> tags
    content = content.replace(/(<br>){2,}/g, '<br><br>');
    return content;
  } else {
    // Plain text format - ensure consistent paragraph breaks
    // Replace multiple consecutive line breaks with double line breaks
    content = content.replace(/\n\s*\n\s*\n+/g, '\n\n');
    // Ensure paragraphs are separated by double line breaks
    content = content.replace(/([^\n])\n([^\n])/g, '$1\n\n$2');
    // Clean up leading/trailing whitespace
    content = content.trim();
    return content;
  }
}

// AI Configuration utility
async function getAIConfig() {
  try {
    console.log('🔧 Fetching AI configuration from vector database...');
    
    // Try to fetch from vector database first
    try {
      const { data: aiConfigDocs, error: fetchError } = await supabase
        .from('documents')
        .select('*')
        .eq('type', 'note')
        .ilike('title', 'AI Configuration')
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (!fetchError && aiConfigDocs && aiConfigDocs.length > 0) {
        const storedConfig = aiConfigDocs[0];
        console.log('✅ Found stored AI configuration in vector database');
        
        // Parse the stored configuration
        try {
          const config = JSON.parse(storedConfig.content);
          console.log('✅ Successfully parsed stored AI configuration');
          return config;
        } catch (parseError) {
          console.warn('⚠️ Failed to parse stored AI config, using default:', parseError.message);
        }
      } else {
        console.log('ℹ️ No stored AI configuration found in vector database');
      }
    } catch (dbError) {
      console.warn('⚠️ Database fetch failed, using default config:', dbError.message);
    }
    
    // Fallback to default configuration
    console.log('🔄 Using default AI configuration');
    return {
      defaults: {
        tone: 'honest',
        length: 'medium',
        model: 'gpt-4o-mini',
        temperature: 0.7,
        top_p: 0.9,
        max_tokens: 1500,
        presence_penalty: 0.0,
        frequency_penalty: 0.0,
        safety: {
          sanitizeHTML: true,
          stripPII: true
        }
      },
      prompts: {
        email_generation: {
          system: "You are an expert storyteller and job application strategist. Your task is to craft a compelling, narrative-driven email that tells the candidate's professional story in an engaging way. CRITICAL REQUIREMENTS: 1. You MUST use the EXACT personal details provided in the knowledge base chunks 2. You MUST reference specific projects, companies, skills, and achievements from the resume 3. You MUST include the candidate's actual name, education, experience, and contact information 4. You MUST NOT generate generic statements - use the specific information provided 5. You MUST structure the email as a compelling story with: - A strong opening hook that connects to the role - A narrative journey through their experience and achievements - Specific examples and metrics that demonstrate impact - A compelling conclusion that shows why they're perfect for this role 6. You MUST use storytelling techniques: vivid language, specific details, and emotional connection 7. You MUST make the email feel personal and authentic, not generic. IMPORTANT: You must respond in valid JSON format with the following structure: {\"subject\": \"Email subject line\", \"body\": \"Full email body content\"}. CRITICAL: Your response must be ONLY valid JSON. Do not include any other text, explanations, or formatting outside the JSON object.",
          user_template: "Job Details: Company: {company} Role: {role} Location: {location}",
          notes: "Template for structuring the job and context information sent to AI"
        },
        company_research: {
          system: "You are a business research analyst. Research the company and provide comprehensive information in a structured format. Focus on industry positioning, recent developments, and key insights that would be relevant for a job application.",
          notes: "This prompt defines how the AI researches companies"
        },
        fit_analysis: {
          system: "You are a career assessment specialist. Analyze the fit between the candidate's background and the job requirements. Provide specific insights about strengths, potential challenges, and actionable advice for the application.",
          notes: "This prompt defines how the AI analyzes job fit"
        },
        thread_reply: {
          system: "You are an expert email strategist and professional communicator. Your task is to generate the next message in an ongoing email thread that continues the conversation naturally and professionally. CRITICAL REQUIREMENTS: 1. You MUST read and understand the complete thread context - all previous messages, their tone, content, and purpose 2. You MUST maintain the professional tone and style established in the thread 3. You MUST reference specific details from previous messages to show you've read them 4. You MUST advance the conversation purposefully - whether it's following up, asking questions, providing updates, or closing 5. You MUST be concise but comprehensive - typically 2-4 sentences 6. You MUST include appropriate greetings and closings based on the thread context 7. You MUST NOT repeat information unnecessarily - build on what's already been said 8. You MUST respond in valid JSON format with the following structure: {\"subject\": \"Re: [Original Subject]\", \"body\": \"Your reply message content\"}. CRITICAL: Your response must be ONLY valid JSON. Do not include any other text, explanations, or formatting outside the JSON object.",
          user_template: "Thread Context: {thread_summary} Current Task: {current_task} Previous Messages: {message_history} Your Role: {sender_role} Tone: {tone}",
          notes: "Template for generating contextual replies in email threads"
        }
      },
      overrides: {
        gmail: { enabled: false },
        linkedin: { enabled: false },
        ats: { enabled: false },
        notion: { enabled: false },
        slack: { enabled: false }
      },
      meta: { 
        lastSavedISO: new Date().toISOString(),
        source: 'default'
      }
    };
  } catch (error) {
    console.error('❌ Failed to get AI config:', error);
    // Return minimal default config as fallback
    return {
      defaults: {
        model: 'gpt-4o-mini',
        temperature: 0.7,
        max_tokens: 1500
      },
      prompts: {
        email_generation: { 
          system: "You are an expert storyteller and job application strategist. Generate personalized emails in JSON format: {\"subject\": \"...\", \"body\": \"...\"}",
          user_template: "Job Details: Company: {company} Role: {role} Location: {location}"
        },
        company_research: { 
          system: "You are a business research analyst. Your task is to analyze companies and provide comprehensive insights about their business model, market position, and growth potential. You must return your analysis in valid JSON format with the following structure: {\"company\": \"Company name\", \"business_model\": {\"description\": \"Core business model and revenue streams\", \"revenue_streams\": [\"Primary revenue sources\"], \"key_partners\": [\"Important business partners\"]}, \"market_position\": {\"industry\": \"Primary industry\", \"market_share\": \"Market position and share\", \"competitors\": [\"Main competitors\"], \"unique_selling_propositions\": [\"Key differentiators\"]}, \"growth_potential\": {\"current_trends\": [\"Industry and company trends\"], \"strategic_initiatives\": [\"Growth strategies\"], \"risks\": [\"Potential challenges\"]}, \"financial_performance\": {\"revenue\": {\"latest_year\": \"Revenue figure\", \"growth_rate\": \"Growth percentage\"}, \"profitability\": {\"status\": \"Profit/loss status\", \"key_metrics\": [\"Important financial metrics\"]}}, \"conclusion\": {\"summary\": \"Overall assessment\", \"opportunities\": [\"Growth opportunities\"], \"challenges\": [\"Key challenges\"]}}. Focus on providing actionable insights that would be valuable for job applications and career decisions. Return ONLY valid JSON." 
        },
        fit_analysis: { 
          system: "You are a career counselor and job matching specialist. Your task is to analyze how well a candidate fits a specific job opportunity. You must return your analysis in valid JSON format with the following structure: {\"fit_analysis\": {\"company\": \"Company name\", \"role\": \"Job title\", \"location\": \"Job location\", \"seniority\": \"Seniority level\", \"resume_title\": \"Resume filename\", \"focus_areas\": \"Resume focus areas\", \"description\": \"Resume description\", \"fit_score\": \"Overall fit score (0-100)\", \"insights\": {\"relevance\": {\"skills_match\": \"Assessment of skills alignment\", \"experience_match\": \"Assessment of experience relevance\", \"industry_match\": \"Assessment of industry fit\"}, \"seniority_level\": {\"level_match\": \"Assessment of seniority fit\", \"growth_potential\": \"Growth opportunities\"}, \"location\": {\"location_fit\": \"Geographic fit assessment\"}, \"additional_comments\": \"Overall assessment and recommendations\"}}}. Provide specific, actionable insights about strengths, potential challenges, and recommendations for the application. Be honest and constructive in your assessment. Return ONLY valid JSON." 
        },
        thread_reply: {
          system: "You are an expert email strategist and professional communicator. Generate contextual replies in email threads in JSON format: {\"subject\": \"Re: [Subject]\", \"body\": \"...\"}",
          user_template: "Thread Context: {thread_summary} Current Task: {current_task} Previous Messages: {message_history} Your Role: {sender_role} Tone: {tone}"
        },
        auto_followup: {
          system: "You are an AI assistant that generates professional follow-up emails for job applications. Create polite, professional follow-ups that show continued interest without being pushy.",
          user_template: "Generate a professional follow-up email for a job application thread. Keep it concise and professional."
        }
      }
    };
  }
}

// Email address parsing utility
function parseAddressList(headerValue) {
  if (!headerValue || typeof headerValue !== 'string') {
    return [];
  }

  // Split by comma and process each address
  const addresses = headerValue.split(',').map(addr => addr.trim()).filter(Boolean);
  
  return addresses.map(address => {
    // Try to extract name and email from various formats
    
    // Format: "Name" <email@domain>
    const quotedMatch = address.match(/^"([^"]+)"\s*<(.+?)>$/);
    if (quotedMatch) {
      const [, name, email] = quotedMatch;
      if (isValidEmail(email)) {
        return { name: name.trim(), email: email.trim() };
      }
    }
    
    // Format: Name <email@domain>
    const bracketMatch = address.match(/^([^<]+?)\s*<(.+?)>$/);
    if (bracketMatch) {
      const [, name, email] = bracketMatch;
      if (isValidEmail(email)) {
        return { name: name.trim(), email: email.trim() };
      }
    }
    
    // Format: email@domain (no name)
    if (isValidEmail(address)) {
      const localPart = address.split('@')[0];
      return { 
        name: localPart.charAt(0).toUpperCase() + localPart.slice(1), 
        email: address.trim() 
      };
    }
    
    // Fallback: return as-is if parsing fails
    console.warn('Failed to parse email address:', address);
    return { name: 'Unknown', email: address.trim() };
  });
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function getUniqueEmails(addresses) {
  const seen = new Set();
  return addresses.filter(addr => {
    if (seen.has(addr.email.toLowerCase())) {
      return false;
    }
    seen.add(addr.email.toLowerCase());
    return true;
  });
}

// Load .env from parent directory since server runs from server/ subdirectory
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

/* -------------------------- ENV & CLIENT SETUP -------------------------- */

// Support either SUPABASE_URL or VITE_SUPABASE_URL for server-side clarity
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
// Prefer service role for server, but fall back to anon so local dev works without extra envs
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
// OpenAI API key for vector processing and AI email generation
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Check for required environment variables but don't exit if missing
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !OPENAI_API_KEY) {
  console.warn('⚠️  WARNING: Missing required environment variables');
  console.warn('SUPABASE_URL:', SUPABASE_URL ? '✓ Set' : '✗ Missing');
  console.warn('SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? '✓ Set' : '✗ Missing');
  console.warn('SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? '✓ Set' : '✗ Missing');
  console.warn('OPENAI_API_KEY:', OPENAI_API_KEY ? '✓ Set' : '✗ Missing');
  console.warn('Some features may not work properly. Please set these in your .env file.');
}

console.log('✅ Environment variables loaded');

// Create Supabase client with fallback values to prevent crashes
const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co', 
  SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key'
);

const app = express();
const PORT = 3001; // Force port 3001 to match Vite proxy config

// Thread tracking system - stores which threads should be hidden
let threadTracking = new Map(); // threadId -> { tracked: boolean, hiddenAt: string, systemGenerated: boolean, leadId: string }

// Track system-generated emails
let systemGeneratedEmails = new Set();

// Initialize thread tracking table
async function initializeThreadTracking() {
  try {
    // Try to create table by attempting to insert a test record
    // This will fail if table doesn't exist, but we'll handle it gracefully
    console.log('🔧 Initializing thread tracking system...');
    
    // Test if table exists by trying to query it
    const { error: testError } = await supabase
      .from('thread_tracking')
      .select('id')
      .limit(1);

    if (testError && testError.code === 'PGRST116') {
      console.log('⚠️ thread_tracking table does not exist - using in-memory storage only');
      console.log('💡 To enable persistent storage, create the table manually in Supabase');
      return;
    }

    // Load existing thread tracking from database
    const { data: allThreads, error: loadError } = await supabase
      .from('thread_tracking')
      .select('thread_id, tracked, hidden_at, system_generated, lead_id, email_type')
      .eq('user_id', 'me');

    if (loadError) {
      console.warn('⚠️ Could not load thread tracking:', loadError.message);
    } else if (allThreads) {
      allThreads.forEach(thread => {
        threadTracking.set(thread.thread_id, {
          tracked: thread.tracked,
          hiddenAt: thread.hidden_at,
          systemGenerated: thread.system_generated || false,
          leadId: thread.lead_id || null,
          emailType: thread.email_type || null
        });
        
        // Add system-generated emails to the set
        if (thread.system_generated) {
          systemGeneratedEmails.add(thread.thread_id);
        }
      });
      console.log(`✅ Loaded ${allThreads.length} thread tracking records from database`);
      console.log(`✅ Loaded ${systemGeneratedEmails.size} system-generated emails`);
    }
  } catch (error) {
    console.warn('⚠️ Thread tracking initialization failed:', error.message);
    console.log('ℹ️ Continuing without persistent thread tracking (using in-memory only)');
  }
}

app.use(cors());
app.use(express.json({ limit: '50mb' })); // handle large payloads

/* ------------------------- VECTOR DB SERVICES --------------------------- */

// Initialize document processor and AI email generator
const documentProcessor = new DocumentProcessor(OPENAI_API_KEY, supabase);
const aiEmailGenerator = new AIEmailGenerator(OPENAI_API_KEY, supabase);

/* ------------------------------ UTILITIES ------------------------------- */

function logDeepError(prefix, err, reqId) {
  console.error(`[${reqId || '-'}] ${prefix}`, {
    message: err?.message,
    code: err?.code,
    status: err?.status,
    responseStatus: err?.response?.status,
    responseData: err?.response?.data,
    stack: err?.stack,
  });
}

// Generate a unique request ID for logging
function generateRequestId() {
  return Math.random().toString(36).substring(2, 8);
}

async function getUserSettings(userId = 'me') {
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.error('Settings fetch error:', error);
    return null;
  }
  
  // Always use credentials from .env file
  const envOpenAIKey = process.env.OPENAI_API_KEY || '';
  const envGmailClientId = process.env.GMAIL_CLIENT_ID || '';
  const envGmailClientSecret = process.env.GMAIL_CLIENT_SECRET || '';
  const envGmailRefreshToken = process.env.GMAIL_REFRESH_TOKEN || '';
  
  // Check if Gmail credentials are available in .env
  const hasGmailCredentials = Boolean(envGmailClientId && envGmailClientSecret && envGmailRefreshToken);
  
  if (data) {
    // Return database settings with .env credentials
    return {
      ...data,
      openai_api_key: envOpenAIKey,
      gmail_client_id: envGmailClientId,
      gmail_client_secret: envGmailClientSecret,
      gmail_refresh_token: envGmailRefreshToken,
      gmail_connected: hasGmailCredentials // Always use .env status
    };
  } else {
    // Return default settings with .env credentials if no settings exist
    return {
      openai_api_key: envOpenAIKey,
      gmail_client_id: envGmailClientId,
      gmail_client_secret: envGmailClientSecret,
      gmail_refresh_token: envGmailRefreshToken,
      gmail_access_token: '',
      gmail_user_email: '',
      tone_default: 'honest',
      length_default: 'medium',
      gmail_connected: hasGmailCredentials // Always use .env status
    };
  }
}

// Upload base64 (no data URI prefix) to a Supabase bucket and return a signed URL
async function uploadBase64ToSupabase({ bucket, base64, contentType = 'image/jpeg' }) {
  const bytes = Buffer.from(base64, 'base64');
  const fileName = `screenshot_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;

  const { data: uploadData, error: uploadErr } = await supabase
    .storage
    .from(bucket)
    .upload(fileName, bytes, { contentType, upsert: false });

  if (uploadErr) throw uploadErr;

  const { data: signed, error: signedErr } = await supabase
    .storage
    .from(bucket)
    .createSignedUrl(uploadData.path, 60 * 10); // 10 minutes

  if (signedErr) throw signedErr;

  return { signedUrl: signed.signedUrl, path: uploadData.path };
}

// Scrape job posting content from URL
async function scrapeJobPosting(url) {
  try {
    console.log(`🔍 Scraping job posting from: ${url}`);
    
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    
    // Extract text content, removing scripts, styles, and other non-content elements
    $('script, style, nav, footer, header, .ads, .sidebar').remove();
    
    // Get main content
    const mainContent = $('main, .content, .job-description, .posting-content, article, .container').text() || $('body').text();
    
    // Clean up the text
    const cleanedText = mainContent
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim()
      .substring(0, 8000); // Limit to 8000 characters for OpenAI
    
    console.log(`📄 Scraped ${cleanedText.length} characters from URL`);
    
    return {
      success: true,
      content: cleanedText,
      title: $('title').text() || '',
      metaDescription: $('meta[name="description"]').attr('content') || ''
    };
    
  } catch (error) {
    console.error(`❌ Error scraping URL ${url}:`, error.message);
    return {
      success: false,
      error: error.message,
      content: ''
    };
  }
}

// Insert a lead row (shared helper)
async function insertLead(cleaned, { sourceType, sourceRef }) {
  const { data, error } = await supabase
    .from('leads')
    .insert({
      user_id: 'me',
      source_type: sourceType,            // 'screenshot' | 'url' | 'manual'
      source_ref: sourceRef || null,      // where it came from
      company: cleaned.company,
      role: cleaned.role,
      location: cleaned.location,
      seniority: cleaned.seniority,
      description_text: cleaned.description_text,
      must_haves: cleaned.must_haves,
      nice_to_haves: cleaned.nice_to_haves,
      keywords: cleaned.keywords,
      confidence: 0.8,
      status: 'new',
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

/* -------------------------------- ROUTES -------------------------------- */

// Health
app.get('/api/health', (req, res) => {
  res.json({ status: 'Backend server is running', timestamp: new Date().toISOString() });
});

// Test body parsing
app.post('/api/test-body', (req, res) => {
  console.log('🧪 Test body endpoint called');
  console.log('🧪 Request headers:', req.headers);
  console.log('🧪 Request body:', req.body);
  console.log('🧪 Request body type:', typeof req.body);
  console.log('🧪 Request body keys:', req.body ? Object.keys(req.body) : 'undefined');
  
  res.json({ 
    success: true, 
    message: 'Body test successful',
    bodyReceived: req.body,
    bodyType: typeof req.body,
    bodyKeys: req.body ? Object.keys(req.body) : 'undefined'
  });
});

// Root route handler
app.get('/', (req, res) => {
  res.json({ 
    message: 'Lazy Bird Backend API', 
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

/* ------------------------------ SETTINGS API ---------------------------- */

app.get('/api/settings', async (req, res) => {
  try {
    const settings = await getUserSettings();
    res.json({ success: true, data: settings });
  } catch (e) {
    console.error('Error fetching settings:', e);
    res.status(500).json({ success: false, error: 'Failed to fetch settings' });
  }
});

app.post('/api/settings', async (req, res) => {
  try {
    const updates = req.body || {};
    console.log('Updating settings with:', updates);
    
    // Remove credentials from updates - always use .env file
    const { openai_api_key, gmail_client_id, gmail_client_secret, gmail_refresh_token, ...settingsUpdates } = updates;
    
    const { data, error } = await supabase
      .from('settings')
      .upsert({
        ...settingsUpdates,
        user_id: 'me',
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (error) {
      console.error('Settings upsert error:', error);
      return res.status(500).json({ success: false, error: 'Failed to update settings' });
    }
    
    // Return data with .env credentials
    const envOpenAIKey = process.env.OPENAI_API_KEY || '';
    const envGmailClientId = process.env.GMAIL_CLIENT_ID || '';
    const envGmailClientSecret = process.env.GMAIL_CLIENT_SECRET || '';
    const envGmailRefreshToken = process.env.GMAIL_REFRESH_TOKEN || '';
    
    // Check if Gmail credentials are available in .env
    const hasGmailCredentials = Boolean(envGmailClientId && envGmailClientSecret && envGmailRefreshToken);
    
    const responseData = {
      ...data,
      openai_api_key: envOpenAIKey,
      gmail_client_id: envGmailClientId,
      gmail_client_secret: envGmailClientSecret,
      gmail_refresh_token: envGmailRefreshToken,
      gmail_connected: hasGmailCredentials, // Always use .env status
      // Ensure these are never overwritten with empty values
      openai_configured: Boolean(envOpenAIKey),
      gmail_configured: hasGmailCredentials
    };
    
    res.json({ success: true, data: responseData });
  } catch (e) {
    console.error('Error updating settings:', e);
    res.status(500).json({ success: false, error: 'Failed to update settings' });
  }
});

// Direct Gmail credentials update endpoint
app.post('/api/update-gmail-creds', async (req, res) => {
  try {
    const { gmail_client_id, gmail_client_secret, gmail_refresh_token } = req.body || {};
    
    if (!gmail_client_id || !gmail_client_secret || !gmail_refresh_token) {
      return res.status(400).json({ success: false, error: 'All Gmail credentials are required' });
    }

    const { data, error } = await supabase
      .from('settings')
      .update({
        gmail_client_id,
        gmail_client_secret,
        gmail_refresh_token,
        gmail_connected: true,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', 'me')
      .select()
      .single();

    if (error) {
      console.error('Gmail credentials update error:', error);
      return res.status(500).json({ success: false, error: 'Failed to update Gmail credentials' });
    }
    
    res.json({ success: true, data, message: 'Gmail credentials updated successfully' });
  } catch (e) {
    console.error('Error updating Gmail credentials:', e);
    res.status(500).json({ success: false, error: 'Failed to update Gmail credentials' });
  }
});

/* ---------------------------- OPENAI TEST API --------------------------- */

app.post('/api/openai/test', async (req, res) => {
  try {
    // Always use OpenAI API key from .env file
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(400).json({ success: false, error: 'OpenAI API key not found in .env file' });
    
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'user', content: 'Say "OpenAI connection successful" in a professional tone.' },
      ],
      max_tokens: 50,
    });
    res.json({
      success: true,
      message: 'OpenAI API key is valid',
      response: completion.choices?.[0]?.message?.content || '',
    });
  } catch (e) {
    console.error('OpenAI test error:', e);
    res.status(400).json({ success: false, error: e.message || 'Failed to test OpenAI API key' });
  }
});

/* ---------------------------- GMAIL TEST SEND --------------------------- */

app.post('/api/gmail/test-send', async (req, res) => {
  try {
    const { clientId, clientSecret, refreshToken, userEmail } = req.body || {};
    if (!clientId || !clientSecret || !refreshToken || !userEmail) {
      return res.status(400).json({ success: false, error: 'Gmail credentials and user email are required' });
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const emailContent = [
      `To: ${userEmail}`,
      'Subject: Lazy Bird Gmail Integration Test',
      'Content-Type: text/html; charset=utf-8',
      '',
      '<h2>🎉 Gmail Integration Successful!</h2>',
      '<p>Thissdfsf test email from your Lazy Bird application.</p>',
    ].join('\n');

    const encodedEmail = Buffer.from(emailContent).toString('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encodedEmail },
    });
    res.json({ success: true, message: `Test email sent successfully to ${userEmail}` });
  } catch (e) {
    console.error('Gmail test error:', e);
    res.status(400).json({ success: false, error: e.message || 'Failed to send test email' });
  }
});

/* --------------------------- CONTENT GENERATION ------------------------- */

app.post('/api/generate-content', async (req, res) => {
  try {
    const { type, leadData, resumeData, snippets, tone = 'professional', length = 'medium', customPrompt } = req.body || {};
    const settings = await getUserSettings();
    if (!settings?.openai_api_key) {
      return res.status(400).json({ success: false, error: 'OpenAI API key not configured in settings' });
    }
    const openai = new OpenAI({ apiKey: settings.openai_api_key });

    let context = '';
    if (leadData) {
      context += `Job Details:\n- Company: ${leadData?.company || 'Not specified'}\n- Role: ${leadData?.role || 'Not specified'}\n- Location: ${leadData?.location || 'Not specified'}\n`;
      if (leadData?.description_text) context += `- Description: ${leadData.description_text}\n`;
      context += '\n';
    }
    if (resumeData) {
      context += `Resume Information:\n- Title: ${resumeData.title}\n`;
      if (resumeData.focus_tags?.length) context += `- Focus Areas: ${resumeData.focus_tags.join(', ')}\n`;
      context += '\n';
    }
    if (Array.isArray(snippets) && snippets.length) {
      context += `Relevant Experience Snippets:\n`;
      snippets.forEach((snip, i) => { context += `${i + 1}. ${snip.content}\n`; });
      context += '\n';
    }

    let systemPrompt = '';
    let userPrompt = '';

    switch (type) {
      case 'cover_letter':
        systemPrompt = `You are an expert career coach. Write in a ${tone} tone with ${length} length. Link experience to job requirements.`;
        userPrompt = customPrompt || `Write a professional cover letter for this job application:\n\n${context}`;
        break;
      case 'email_body':
        systemPrompt = `You write professional outreach emails in a ${tone} tone with ${length} length. Make it personalized and engaging.`;
        userPrompt = customPrompt || `Write a professional outreach email for this job opportunity:\n\n${context}`;
        break;
      case 'blurb':
        systemPrompt = `You write concise professional summaries in a ${tone} tone with ${length} length.`;
        userPrompt = customPrompt || `Write a professional summary/blurb based on this information:\n\n${context}`;
        break;
      default:
        return res.status(400).json({ success: false, error: 'Invalid content type' });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: length === 'short' ? 300 : length === 'medium' ? 600 : 1000,
      temperature: tone === 'creative' ? 0.8 : tone === 'professional' ? 0.3 : 0.5,
    });

    res.json({
      success: true,
      content: completion.choices?.[0]?.message?.content || '',
      usage: completion.usage,
    });
  } catch (e) {
    console.error('Content generation error:', e);
    res.status(500).json({ success: false, error: e.message || 'Failed to generate content' });
  }
});

// FIXED: Image -> JSON -> (optional) Lead
app.post('/api/openai/process-image', async (req, res) => {
  const ROUTE = '/api/openai/process-image';
  const reqId = Math.random().toString(36).slice(2);
  console.log(`[${reqId}] ${ROUTE} start`);

  // Force JSON output schema so we never need to brittle-parse prose
  const systemPrompt = `You extract job posting info from an image and must return a single JSON object only.
Schema:
{
  "company": "Company Name",
  "role": "Job Title/Role",
  "location": "Location or 'Not specified'",
  "seniority": "Entry|Mid-level|Senior|Lead or '' if unclear",
  "description_text": "Full job description (can be long)",
  "must_haves": ["Required skill 1", "Required skill 2"],
  "nice_to_haves": ["Preferred skill 1", "Preferred skill 2"],
  "keywords": ["keyword1", "keyword2"],
  "contact_person": "Contact person name or 'Not specified'",
  "contact_email": "Contact email or 'Not specified'",
  "contact_mobile": "Contact mobile number or 'Not specified'"
}
Rules:
- "company" and "role" are mandatory. If missing, return {"error":"Unable to extract mandatory job information"}.
- Extract from the image; do not fabricate.
- Look for contact information in the job posting (HR contact, recruiter, etc.).
- If not specified, use sensible defaults as in the schema.`;

  const userPromptText = 'Extract the job posting info and return only the JSON object defined by the schema.';

  try {
    let { imageBase64, imageUrl, leadSourceRef, createLead = true, openaiApiKey } = req.body || {};

    // Accept base64 with or without data URL prefix
    if (imageBase64 && imageBase64.includes('base64,')) {
      imageBase64 = imageBase64.split('base64,')[1];
    }

    if (!imageBase64 && !imageUrl) {
      return res.status(400).json({ success: false, error: 'Provide imageBase64 or imageUrl' });
    }

    // Get OpenAI key: prefer body override, then settings table, then env var
    const settings = await getUserSettings();
    const resolvedKey = openaiApiKey || settings?.openai_api_key || process.env.OPENAI_API_KEY;
    if (!resolvedKey) {
      return res.status(400).json({ success: false, error: 'OpenAI API key not configured in settings or environment' });
    }
    const openai = new OpenAI({ apiKey: resolvedKey });

    // Prefer hosted URL. If base64 is large, upload to Supabase and use a signed URL.
    let visionUrl = imageUrl || null;
    if (!visionUrl && imageBase64) {
      const isLarge = imageBase64.length > 1_000_000; // ~1MB heuristic
      if (isLarge) {
        try {
          const { signedUrl } = await uploadBase64ToSupabase({
            bucket: 'screenshots',
            base64: imageBase64,
            contentType: 'image/jpeg'
          });
          visionUrl = signedUrl;
        } catch (uploadErr) {
          logDeepError('Supabase upload/signed url error', uploadErr, reqId);
          return res.status(500).json({ success: false, error: 'Failed to upload screenshot' });
        }
      } else {
        visionUrl = `data:image/jpeg;base64,${imageBase64}`;
      }
    }

    // Call Vision with JSON mode ON (prevents non-JSON chatter)
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 1500,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: userPromptText },
            { type: 'image_url', image_url: { url: visionUrl } }
          ]
        }
      ]
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() || '';
    if (!raw) {
      console.error(`[${reqId}] Empty OpenAI response`);
      return res.status(502).json({ success: false, error: 'Empty response from OpenAI' });
    }

    // Safe JSON parse (no brittle prose parsing)
    const safeParse = (txt) => {
      try { return JSON.parse(txt); } catch {
        const match = txt.match(/\{[\s\S]*\}$/); // fallback to first JSON block
        if (match) return JSON.parse(match[0]);
        throw new Error('JSON parse failed');
      }
    };

    let extracted;
    try {
      extracted = safeParse(raw);
    } catch (e) {
      console.error(`[${reqId}] JSON parse failed. Raw:`, raw);
      return res.status(500).json({ success: false, error: 'Failed to parse job JSON from image' });
    }

    if (extracted.error) {
      return res.status(400).json({ success: false, error: extracted.error });
    }
    if (!extracted.company || !extracted.role) {
      return res.status(400).json({ success: false, error: 'Unable to extract mandatory job information (company & role)' });
    }

    // Normalize payload to your DB shape
    const cleaned = {
      company: String(extracted.company).trim(),
      role: String(extracted.role).trim(),
      location: extracted.location?.toString().trim() || 'Not specified',
      seniority: extracted.seniority?.toString().trim() || '',
      description_text: extracted.description_text?.toString().trim() || '',
      must_haves: Array.isArray(extracted.must_haves) ? extracted.must_haves.map(s => String(s).trim()).filter(Boolean) : [],
      nice_to_haves: Array.isArray(extracted.nice_to_haves) ? extracted.nice_to_haves.map(s => String(s).trim()).filter(Boolean) : [],
      keywords: Array.isArray(extracted.keywords) ? extracted.keywords.map(s => String(s).trim()).filter(Boolean) : []
    };

    // Decide source type for the lead
    let sourceType = 'screenshot';
    if (imageUrl) sourceType = 'url';
    if (!imageUrl && visionUrl && !visionUrl.startsWith('data:')) sourceType = 'url';

    // If caller only wants JSON (no DB insert)
    if (!createLead) {
      return res.json({
        success: true,
        data: cleaned,
        usage: completion.usage,
        debug: { sourceType, sourceRef: leadSourceRef || visionUrl }
      });
    }

    // Create the lead in DB
    let leadRow;
    try {
      leadRow = await insertLead(cleaned, { sourceType, sourceRef: leadSourceRef || visionUrl });
    } catch (leadErr) {
      logDeepError('Lead insert error', leadErr, reqId);
      return res.status(500).json({ success: false, error: 'Failed to create lead' });
    }

    // Create contact if contact information is available
    if (extracted.contact_person || extracted.contact_email || extracted.contact_mobile) {
      try {
        await supabase.from('contacts').insert({
          lead_id: leadRow.id,
          name: extracted.contact_person || 'Not specified',
          title: 'HR Contact',
          email: extracted.contact_email || null,
          phone: extracted.contact_mobile || null,
          linkedin_url: null
        });
        console.log(`[${reqId}] Created contact for lead ${leadRow.id}`);
      } catch (contactErr) {
        console.warn(`[${reqId}] Failed to create contact for lead ${leadRow.id}:`, contactErr);
      }
    }

    console.log(`[${reqId}] ${ROUTE} success -> lead ${leadRow.id}`);
    return res.json({
      success: true,
      lead: leadRow,
      usage: completion.usage
    });

  } catch (e) {
    logDeepError('Image processing error', e, null);
    if (e?.response?.status === 401) return res.status(401).json({ success: false, error: 'OpenAI authentication failed (401)' });
    if (e?.response?.status === 429) return res.status(429).json({ success: false, error: 'OpenAI rate limit / quota exceeded (429)' });
    if (e?.response?.status === 413) return res.status(413).json({ success: false, error: 'Image too large (413). Try URL upload path.' });
    return res.status(500).json({ success: false, error: e.message || 'Failed to process image' });
  }
});

// Process multiple images together for lead extraction
app.post('/api/openai/process-multiple-images', async (req, res) => {
  const ROUTE = '/api/openai/process-multiple-images';
  const reqId = Math.random().toString(36).slice(2, 8);
  console.log(`[${reqId}] ${ROUTE} start`);

  // Enhanced system prompt to extract contact information
  const systemPrompt = `You extract job posting information from multiple images and must return a single JSON object with an array of leads.
Schema:
{
  "leads": [
    {
      "company": "Company Name",
      "role": "Job Title/Role", 
      "location": "Location or 'Not specified'",
      "seniority": "Entry|Mid-level|Senior|Lead or '' if unclear",
      "description_text": "Full job description (can be long)",
      "must_haves": ["Required skill 1", "Required skill 2"],
      "nice_to_haves": ["Preferred skill 1", "Preferred skill 2"],
      "keywords": ["keyword1", "keyword2"],
      "contact_person": "Contact person name or 'Not specified'",
      "contact_email": "Contact email or 'Not specified'",
      "contact_mobile": "Contact mobile number or 'Not specified'",
      "source_image": "filename of the image this lead came from"
    }
  ]
}
Rules:
- "company" and "role" are mandatory for each lead. If missing, skip that lead.
- Extract from the images; do not fabricate information.
- Look for contact information in the job postings (HR contact, recruiter, etc.).
- If not specified, use sensible defaults as in the schema.
- Each image should generate one lead entry.
- Return all leads in a single response.`;

  const userPromptText = 'Extract job posting information from all images and return only the JSON object defined by the schema. Process each image and create a lead entry for each job posting found.';

  try {
    let { images, createLeads = true, openaiApiKey } = req.body || {};

    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ success: false, error: 'Provide images array with base64 data' });
    }

    // Get OpenAI key
    const settings = await getUserSettings();
    const resolvedKey = openaiApiKey || settings?.openai_api_key || process.env.OPENAI_API_KEY;
    if (!resolvedKey) {
      return res.status(400).json({ success: false, error: 'OpenAI API key not configured' });
    }
    const openai = new OpenAI({ apiKey: resolvedKey });

    // Prepare images for OpenAI Vision
    const visionContent = [];
    
    // Add text prompt
    visionContent.push({ type: 'text', text: userPromptText });
    
    // Add all images
    for (const image of images) {
      if (!image.base64) {
        console.warn(`[${reqId}] Skipping image ${image.name} - no base64 data`);
        continue;
      }
      
      // Clean base64 data
      let cleanBase64 = image.base64;
      if (cleanBase64.includes('base64,')) {
        cleanBase64 = cleanBase64.split('base64,')[1];
      }
      
      // Use data URL for smaller images, upload larger ones to Supabase
      let visionUrl = `data:${image.type};base64,${cleanBase64}`;
      if (cleanBase64.length > 1_000_000) { // ~1MB
        try {
          const { signedUrl } = await uploadBase64ToSupabase({
            bucket: 'screenshots',
            base64: cleanBase64,
            contentType: image.type
          });
          visionUrl = signedUrl;
        } catch (uploadErr) {
          console.error(`[${reqId}] Failed to upload ${image.name}:`, uploadErr);
          // Continue with data URL for this image
        }
      }
      
      visionContent.push({
        type: 'image_url',
        image_url: { url: visionUrl }
      });
    }

    if (visionContent.length < 2) { // Only text prompt
      return res.status(400).json({ success: false, error: 'No valid images provided' });
    }

    console.log(`[${reqId}] Processing ${images.length} images with OpenAI Vision`);

    // Call OpenAI Vision with all images
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 2000,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: visionContent }
      ]
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() || '';
    if (!raw) {
      console.error(`[${reqId}] Empty OpenAI response`);
      return res.status(502).json({ success: false, error: 'Empty response from OpenAI' });
    }

    // Parse JSON response
    let extracted;
    try {
      extracted = JSON.parse(raw);
    } catch (e) {
      console.error(`[${reqId}] JSON parse failed. Raw:`, raw);
      return res.status(500).json({ success: false, error: 'Failed to parse leads JSON from images' });
    }

    if (!extracted.leads || !Array.isArray(extracted.leads)) {
      return res.status(400).json({ success: false, error: 'Invalid response format - expected leads array' });
    }

    // Filter out invalid leads
    const validLeads = extracted.leads.filter(lead => 
      lead.company && lead.role && 
      typeof lead.company === 'string' && 
      typeof lead.role === 'string'
    );

    if (validLeads.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid leads found in images' });
    }

    console.log(`[${reqId}] Extracted ${validLeads.length} valid leads from ${images.length} images`);

    // If caller only wants JSON (no DB insert)
    if (!createLeads) {
      return res.json({
        success: true,
        leads: validLeads,
        usage: completion.usage,
        details: {
          imagesProcessed: images.length,
          leadsExtracted: validLeads.length,
          totalImages: images.length
        }
      });
    }

    // Create leads in DB
    const createdLeads = [];
    for (const leadData of validLeads) {
      try {
        // Normalize payload to DB shape
        const cleaned = {
          company: String(leadData.company).trim(),
          role: String(leadData.role).trim(),
          location: leadData.location?.toString().trim() || 'Not specified',
          seniority: leadData.seniority?.toString().trim() || '',
          description_text: leadData.description_text?.toString().trim() || '',
          must_haves: Array.isArray(leadData.must_haves) ? leadData.must_haves.map(s => String(s).trim()).filter(Boolean) : [],
          nice_to_haves: Array.isArray(leadData.nice_to_haves) ? leadData.nice_to_haves.map(s => String(s).trim()).filter(Boolean) : [],
          keywords: Array.isArray(leadData.keywords) ? leadData.keywords.map(s => String(s).trim()).filter(Boolean) : []
        };

        // Create the lead
        const leadRow = await insertLead(cleaned, { 
          sourceType: 'screenshot', 
          sourceRef: leadData.source_image || 'multiple_images_batch' 
        });

        // Create contact if contact information is available
        if (leadData.contact_person || leadData.contact_email || leadData.contact_mobile) {
          try {
            await supabase.from('contacts').insert({
              lead_id: leadRow.id,
              name: leadData.contact_person || 'Not specified',
              title: 'HR Contact',
              email: leadData.contact_email || null,
              phone: leadData.contact_mobile || null,
              linkedin_url: null
            });
            console.log(`[${reqId}] Created contact for lead ${leadRow.id}`);
          } catch (contactErr) {
            console.warn(`[${reqId}] Failed to create contact for lead ${leadRow.id}:`, contactErr);
          }
        }

        createdLeads.push(leadRow);
      } catch (leadErr) {
        console.error(`[${reqId}] Failed to create lead from ${leadData.source_image}:`, leadErr);
        // Continue with other leads
      }
    }

    console.log(`[${reqId}] ${ROUTE} success -> created ${createdLeads.length} leads`);
    return res.json({
      success: true,
      leads: createdLeads,
      usage: completion.usage,
      details: {
        imagesProcessed: images.length,
        leadsExtracted: validLeads.length,
        leadsCreated: createdLeads.length,
        totalImages: images.length
      }
    });

  } catch (e) {
    console.error(`[${reqId}] Multiple images processing error:`, e);
    if (e?.response?.status === 401) return res.status(401).json({ success: false, error: 'OpenAI authentication failed (401)' });
    if (e?.response?.status === 429) return res.status(429).json({ success: false, error: 'OpenAI rate limit / quota exceeded (429)' });
    if (e?.response?.status === 413) return res.status(413).json({ success: false, error: 'Images too large (413)' });
    return res.status(500).json({ success: false, error: e.message || 'Failed to process multiple images' });
  }
});

// Parse URL and extract job posting information using ChatGPT
app.post('/api/openai/parse-url', async (req, res) => {
  const ROUTE = '/api/openai/parse-url';
  const reqId = Math.random().toString(36).slice(2, 8);
  console.log(`[${reqId}] ${ROUTE} start`);

  // Enhanced system prompt for URL parsing
  const systemPrompt = `You are a job posting parser that extracts detailed information from job posting URLs. 
You will be given a URL to a job posting, and you must extract all relevant information.

Schema:
{
  "company": "Company Name",
  "role": "Job Title/Role",
  "location": "Location or 'Not specified'",
  "seniority": "Entry|Mid-level|Senior|Lead or '' if unclear",
  "description_text": "Full job description (can be long)",
  "must_haves": ["Required skill 1", "Required skill 2"],
  "nice_to_haves": ["Preferred skill 1", "Preferred skill 2"],
  "keywords": ["keyword1", "keyword2"],
  "contact_person": "Contact person name or 'Not specified'",
  "contact_email": "Contact email or 'Not specified'",
  "contact_mobile": "Contact mobile number or 'Not specified'",
  "salary_range": "Salary range or 'Not specified'",
  "job_type": "Full-time|Part-time|Contract|Internship or 'Not specified'",
  "remote_policy": "Remote|On-site|Hybrid or 'Not specified'"
}

Rules:
- "company" and "role" are mandatory. If missing, return {"error":"Unable to extract mandatory job information"}.
- Extract from the actual job posting content; do not fabricate information.
- Look for contact information in the job posting (HR contact, recruiter, etc.).
- If not specified, use sensible defaults as in the schema.
- Be thorough in extracting skills, requirements, and job details.`;

  const userPromptText = 'Please visit the provided URL and extract all job posting information according to the schema. Return only the JSON object.';

  try {
    let { url, createLead = true, openaiApiKey } = req.body || {};

    if (!url || !url.trim()) {
      return res.status(400).json({ success: false, error: 'URL is required' });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (e) {
      return res.status(400).json({ success: false, error: 'Invalid URL format' });
    }

    // Get OpenAI key
    const settings = await getUserSettings();
    const resolvedKey = openaiApiKey || settings?.openai_api_key || process.env.OPENAI_API_KEY;
    if (!resolvedKey) {
      return res.status(400).json({ success: false, error: 'OpenAI API key not configured' });
    }
    const openai = new OpenAI({ apiKey: resolvedKey });

    console.log(`[${reqId}] Parsing URL: ${url}`);

    // First, scrape the actual content from the URL
    const scrapedContent = await scrapeJobPosting(url);
    
    if (!scrapedContent.success) {
      console.warn(`[${reqId}] Failed to scrape URL, will try OpenAI analysis only`);
    }

    // Prepare the prompt with scraped content if available
    let userContent = `Please analyze this job posting URL: ${url}`;
    
    if (scrapedContent.success && scrapedContent.content) {
      userContent += `\n\nHere is the scraped content from the URL:\n\n${scrapedContent.content}`;
      
      if (scrapedContent.title) {
        userContent += `\n\nPage Title: ${scrapedContent.title}`;
      }
      if (scrapedContent.metaDescription) {
        userContent += `\n\nMeta Description: ${scrapedContent.metaDescription}`;
      }
    }

    userContent += `\n\nPlease extract all job posting information from the content above and return it in the exact JSON schema format.`;

    // Call OpenAI with the scraped content
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 2000,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: userContent
        }
      ]
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() || '';
    if (!raw) {
      console.error(`[${reqId}] Empty OpenAI response`);
      return res.status(502).json({ success: false, error: 'Empty response from OpenAI' });
    }

    // Parse JSON response
    let extracted;
    try {
      extracted = JSON.parse(raw);
    } catch (e) {
      console.error(`[${reqId}] JSON parse failed. Raw:`, raw);
      return res.status(500).json({ success: false, error: 'Failed to parse job JSON from URL' });
    }

    if (extracted.error) {
      return res.status(400).json({ success: false, error: extracted.error });
    }
    if (!extracted.company || !extracted.role) {
      return res.status(400).json({ success: false, error: 'Unable to extract mandatory job information (company & role)' });
    }

    // Normalize payload to DB shape
    const cleaned = {
      company: String(extracted.company).trim(),
      role: String(extracted.role).trim(),
      location: extracted.location?.toString().trim() || 'Not specified',
      seniority: extracted.seniority?.toString().trim() || '',
      description_text: extracted.description_text?.toString().trim() || '',
      must_haves: Array.isArray(extracted.must_haves) ? extracted.must_haves.map(s => String(s).trim()).filter(Boolean) : [],
      nice_to_haves: Array.isArray(extracted.nice_to_haves) ? extracted.nice_to_haves.map(s => String(s).trim()).filter(Boolean) : [],
      keywords: Array.isArray(extracted.keywords) ? extracted.keywords.map(s => String(s).trim()).filter(Boolean) : []
    };

    // If caller only wants JSON (no DB insert)
    if (!createLead) {
      return res.json({
        success: true,
        data: cleaned,
        usage: completion.usage,
        debug: { 
          sourceType: 'url', 
          sourceRef: url,
          extractedData: extracted
        }
      });
    }

    // Create the lead in DB
    let leadRow;
    try {
      leadRow = await insertLead(cleaned, { sourceType: 'url', sourceRef: url });
    } catch (leadErr) {
      console.error(`[${reqId}] Lead insert error:`, leadErr);
      return res.status(500).json({ success: false, error: 'Failed to create lead' });
    }

    // Create contact if contact information is available
    if (extracted.contact_person || extracted.contact_email || extracted.contact_mobile) {
      try {
        await supabase.from('contacts').insert({
          lead_id: leadRow.id,
          name: extracted.contact_person || 'Not specified',
          title: 'HR Contact',
          email: extracted.contact_email || null,
          phone: extracted.contact_mobile || null,
          linkedin_url: null
        });
        console.log(`[${reqId}] Created contact for lead ${leadRow.id}`);
      } catch (contactErr) {
        console.warn(`[${reqId}] Failed to create contact for lead ${leadRow.id}:`, contactErr);
      }
    }

    console.log(`[${reqId}] ${ROUTE} success -> lead ${leadRow.id}`);
    return res.json({
      success: true,
      lead: leadRow,
      usage: completion.usage,
      debug: { 
        sourceType: 'url', 
        sourceRef: url,
        extractedData: extracted
      }
    });

  } catch (e) {
    console.error(`[${reqId}] URL parsing error:`, e);
    if (e?.response?.status === 401) return res.status(401).json({ success: false, error: 'OpenAI authentication failed (401)' });
    if (e?.response?.status === 429) return res.status(429).json({ success: false, error: 'OpenAI rate limit / quota exceeded (429)' });
    return res.status(500).json({ success: false, error: e.message || 'Failed to parse URL' });
  }
});

/* ------------------------------ OPENAI AI ENDPOINTS ------------------------------ */

// Company Research Endpoint
app.post('/api/openai/company-research', async (req, res) => {
  const ROUTE = 'POST /api/openai/company-research';
  const reqId = Math.random().toString(36).slice(2);
  
  try {
    const { companyName, leadId } = req.body || {};
    if (!companyName) {
      return res.status(400).json({ success: false, error: 'Company name is required' });
    }

    console.log(`[${reqId}] ${ROUTE} -> researching company: ${companyName}`);

    // 🔍 CHECK VECTOR DATABASE FIRST
    const existingAnalysis = await checkAnalysisExistsInVectorDB(leadId, 'company_research', companyName);
    if (existingAnalysis?.exists) {
      console.log(`[${reqId}] ✅ Using cached company research from vector database`);
      return res.json({
        success: true,
        companyInfo: existingAnalysis.content,
        cached: true,
        generatedAt: existingAnalysis.generatedAt
      });
    }

    // Continue with OpenAI API call only if not cached
    console.log(`[${reqId}] 🚀 No cached data found, calling OpenAI API`);

    // Get OpenAI key from settings or environment
    const settings = await getUserSettings();
    const resolvedKey = settings?.openai_api_key || OPENAI_API_KEY;
    if (!resolvedKey) {
      return res.status(400).json({ success: false, error: 'OpenAI API key not configured' });
    }
    
    const openai = new OpenAI({ apiKey: resolvedKey });

    // Get AI configuration for dynamic prompts and parameters
    const aiConfig = await getAIConfig();
    console.log(`🔧 Company research using AI config: model=${aiConfig.defaults.model}, temperature=${aiConfig.defaults.temperature}`);
    
    // 🔍 FETCH KNOWLEDGE BASE DATA FOR CONTEXT
    let knowledgeBaseContext = '';
    if (leadId) {
      try {
        console.log(`[${reqId}] 🔍 Fetching knowledge base data for lead: ${leadId}`);
        
        // Fetch knowledge chunks from vector database
        const { data: allKnowledgeDocuments, error: knowledgeError } = await supabase
          .from('documents')
          .select('*')
          .or(`title.ilike.%${leadId}%,content.ilike.%${leadId}%`)
          .order('created_at', { ascending: false });

        if (!knowledgeError && allKnowledgeDocuments && allKnowledgeDocuments.length > 0) {
          const knowledgeChunks = allKnowledgeDocuments
            .filter(doc => !doc.title.includes('company_research') && !doc.title.includes('fit_analysis'))
            .slice(0, 10) // Get top 10 relevant chunks
            .map(doc => ({
              content: typeof doc.content === 'string' ? doc.content : JSON.stringify(doc.content),
              metadata: doc.metadata || { source: 'vector_db', title: doc.title }
            }));
          
          if (knowledgeChunks.length > 0) {
            knowledgeBaseContext = `\n\nCANDIDATE CONTEXT (Use this to tailor company research for job applications):
${knowledgeChunks.map((chunk, index) => `CHUNK ${index + 1}:
${chunk.content}
Metadata: ${JSON.stringify(chunk.metadata)}`).join('\n\n')}`;
            console.log(`[${reqId}] ✅ Found ${knowledgeChunks.length} knowledge chunks for context`);
          } else {
            console.log(`[${reqId}] ℹ️ No relevant knowledge base data found for lead: ${leadId}`);
          }
        } else {
          console.log(`[${reqId}] ℹ️ No knowledge base data found for lead: ${leadId}`);
        }
      } catch (error) {
        console.warn(`[${reqId}] ⚠️ Failed to fetch knowledge base:`, error.message);
      }
    }
    
    const systemPrompt = aiConfig.prompts.company_research.system || `You are a business research analyst. Your task is to analyze companies and provide comprehensive insights about their business model, market position, and growth potential. You must return your analysis in valid JSON format with the following structure: {\"company\": \"Company name\", \"business_model\": {\"description\": \"Core business model and revenue streams\", \"revenue_streams\": [\"Primary revenue sources\"], \"key_partners\": [\"Important business partners\"]}, \"market_position\": {\"industry\": \"Primary industry\", \"market_share\": \"Market position and share\", \"competitors\": [\"Main competitors\"], \"unique_selling_propositions\": [\"Key differentiators\"]}, \"growth_potential\": {\"current_trends\": [\"Industry and company trends\"], \"strategic_initiatives\": [\"Growth strategies\"], \"risks\": [\"Potential challenges\"]}, \"financial_performance\": {\"revenue\": {\"latest_year\": \"Revenue figure\", \"growth_rate\": \"Growth percentage\"}, \"profitability\": {\"status\": \"Profit/loss status\", \"key_metrics\": [\"Important financial metrics\"]}}, \"conclusion\": {\"summary\": \"Overall assessment\", \"opportunities\": [\"Growth opportunities\"], \"challenges\": [\"Key challenges\"]}}. Focus on providing actionable insights that would be valuable for job applications and career decisions. Return ONLY valid JSON.`;

    const completion = await openai.chat.completions.create({
      model: aiConfig.defaults.model || 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: aiConfig.defaults.temperature || 0.1,
      max_tokens: aiConfig.defaults.max_tokens || 1500,
      top_p: aiConfig.defaults.top_p || 0.9,
      presence_penalty: aiConfig.defaults.presence_penalty || 0.0,
      frequency_penalty: aiConfig.defaults.frequency_penalty || 0.0,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Please research ${companyName} and provide the requested information in JSON format.${knowledgeBaseContext}` }
      ]
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() || '';
    if (!raw) {
      return res.status(502).json({ success: false, error: 'Empty response from OpenAI' });
    }

    let companyInfo;
    try {
      companyInfo = JSON.parse(raw);
    } catch (e) {
      console.error(`[${reqId}] JSON parse failed. Raw:`, raw);
      return res.status(500).json({ success: false, error: 'Failed to parse company research response' });
    }

    console.log(`[${reqId}] ${ROUTE} success -> company: ${companyName}`);
    
    // Store company research results in vector database if leadId is provided
    if (leadId) {
      try {
        // Store in vector database for AI email generation
        const vectorDoc = await storeAnalysisInVectorDB(
          leadId, 
          'company_research', 
          companyInfo,
          {
            company: companyName,
            analysisType: 'company_research',
            source: 'openai'
          }
        );
        if (vectorDoc) {
          console.log(`[${reqId}] ✅ Company research stored in vector database: ${vectorDoc.id}`);
        }
      } catch (vectorError) {
        console.warn(`[${reqId}] ⚠️ Could not store company research in vector database:`, vectorError.message);
      }
    }
    
    return res.json({
      success: true,
      companyInfo,
      usage: completion.usage
    });

  } catch (e) {
    console.error(`[${reqId}] Company research error:`, e);
    if (e?.response?.status === 401) return res.status(401).json({ success: false, error: 'OpenAI authentication failed (401)' });
    if (e?.response?.status === 429) return res.status(429).json({ success: false, error: 'OpenAI rate limit / quota exceeded (429)' });
    return res.status(500).json({ success: false, error: e.message || 'Failed to research company' });
  }
});

// Fit Analysis Endpoint
app.post('/api/openai/fit-analysis', async (req, res) => {
  const ROUTE = 'POST /api/openai/fit-analysis';
  const reqId = Math.random().toString(36).slice(2);
  
  try {
    const { leadId, resumeId, leadData, resumeData } = req.body || {};
    if (!leadId || !leadData) {
      return res.status(400).json({ success: false, error: 'Lead ID and lead data are required' });
    }

    console.log(`[${reqId}] ${ROUTE} -> analyzing fit for lead: ${leadId}`);

    // 🔍 CHECK VECTOR DATABASE FIRST
    const existingAnalysis = await checkAnalysisExistsInVectorDB(leadId, 'fit_analysis');
    if (existingAnalysis?.exists) {
      console.log(`[${reqId}] ✅ Using cached fit analysis from vector database`);
      return res.json({
        success: true,
        fitAnalysis: existingAnalysis.content,
        cached: true,
        generatedAt: existingAnalysis.generatedAt
      });
    }

    // Continue with OpenAI API call only if not cached
    console.log(`[${reqId}] 🚀 No cached data found, calling OpenAI API`);

    // Get OpenAI key from settings or environment
    const settings = await getUserSettings();
    const resolvedKey = settings?.openai_api_key || OPENAI_API_KEY;
    if (!resolvedKey) {
      return res.status(400).json({ success: false, error: 'OpenAI API key not configured' });
    }
    
    const openai = new OpenAI({ apiKey: resolvedKey });

    // Get AI configuration for dynamic prompts and parameters
    const aiConfig = await getAIConfig();
    console.log(`🔧 Fit analysis using AI config: model=${aiConfig.defaults.model}, temperature=${aiConfig.defaults.temperature}`);
    
    // 🔍 FETCH KNOWLEDGE BASE DATA FOR COMPREHENSIVE ANALYSIS
    let knowledgeBaseContext = '';
    try {
      console.log(`[${reqId}] 🔍 Fetching knowledge base data for lead: ${leadId}`);
      
      // Fetch knowledge chunks from vector database
      const { data: allKnowledgeDocuments, error: knowledgeError } = await supabase
        .from('documents')
        .select('*')
        .or(`title.ilike.%${leadId}%,content.ilike.%${leadId}%`)
        .order('created_at', { ascending: false });

      if (!knowledgeError && allKnowledgeDocuments && allKnowledgeDocuments.length > 0) {
        const knowledgeChunks = allKnowledgeDocuments
          .filter(doc => !doc.title.includes('company_research') && !doc.title.includes('fit_analysis'))
          .slice(0, 15) // Get top 15 relevant chunks for detailed analysis
          .map(doc => ({
            content: typeof doc.content === 'string' ? doc.content : JSON.stringify(doc.content),
            metadata: doc.metadata || { source: 'vector_db', title: doc.title }
          }));
        
        if (knowledgeChunks.length > 0) {
          knowledgeBaseContext = `\n\nCANDIDATE KNOWLEDGE BASE (Use this detailed information for comprehensive fit analysis):
${knowledgeChunks.map((chunk, index) => `CHUNK ${index + 1}:
${chunk.content}
Metadata: ${JSON.stringify(chunk.metadata)}`).join('\n\n')}`;
          console.log(`[${reqId}] ✅ Found ${knowledgeChunks.length} knowledge chunks for analysis`);
        } else {
          console.log(`[${reqId}] ℹ️ No relevant knowledge base data found for lead: ${leadId}`);
        }
      } else {
        console.log(`[${reqId}] ℹ️ No knowledge base data found for lead: ${leadId}`);
      }
    } catch (error) {
      console.warn(`[${reqId}] ⚠️ Failed to fetch knowledge base:`, error.message);
    }
    
    const systemPrompt = aiConfig.prompts.fit_analysis.system || `You are a career counselor and job matching specialist. Your task is to analyze how well a candidate fits a specific job opportunity. You must return your analysis in valid JSON format with the following structure: {\"fit_analysis\": {\"company\": \"Company name\", \"role\": \"Job title\", \"location\": \"Job location\", \"seniority\": \"Seniority level\", \"resume_title\": \"Resume filename\", \"focus_areas\": \"Resume focus areas\", \"description\": \"Resume description\", \"fit_score\": \"Overall fit score (0-100)\", \"insights\": {\"relevance\": {\"skills_match\": \"Assessment of skills alignment\", \"experience_match\": \"Assessment of experience relevance\", \"industry_match\": \"Assessment of industry fit\"}, \"seniority_level\": {\"level_match\": \"Assessment of seniority fit\", \"growth_potential\": \"Growth opportunities\"}, \"location\": {\"location_fit\": \"Geographic fit assessment\"}, \"additional_comments\": \"Overall assessment and recommendations\"}}}. Provide specific, actionable insights about strengths, potential challenges, and recommendations for the application. Be honest and constructive in your assessment. Return ONLY valid JSON.`;

    const userPrompt = `Lead Data:
Company: ${leadData?.company || 'Not specified'}
Role: ${leadData?.role || 'Not specified'}
Location: ${leadData?.location || 'Not specified'}
Seniority: ${leadData?.seniority || 'Not specified'}
Description: ${leadData?.description || 'Not provided'}
Must Haves: ${leadData?.must_haves?.join(', ') || 'Not specified'}
Nice to Haves: ${leadData?.nice_to_haves?.join(', ') || 'Not specified'}
Keywords: ${leadData?.keywords?.join(', ') || 'Not specified'}

${resumeData ? `Resume Data:
Title: ${resumeData.filename || resumeData.name || 'Not provided'}
Focus Areas: ${resumeData.focus_tags?.join(', ') || 'Not specified'}
Description: ${resumeData.description || 'Not provided'}` : 'No resume data provided'}

Please analyze the fit and provide insights in JSON format.${knowledgeBaseContext}`;

    const completion = await openai.chat.completions.create({
      model: aiConfig.defaults.model || 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: aiConfig.defaults.temperature || 0.1,
      max_tokens: aiConfig.defaults.max_tokens || 2000,
      top_p: aiConfig.defaults.top_p || 0.9,
      presence_penalty: aiConfig.defaults.presence_penalty || 0.0,
      frequency_penalty: aiConfig.defaults.frequency_penalty || 0.0,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() || '';
    if (!raw) {
      return res.status(502).json({ success: false, error: 'Empty response from OpenAI' });
    }

    let fitAnalysis;
    try {
      fitAnalysis = JSON.parse(raw);
    } catch (e) {
      console.error(`[${reqId}] JSON parse failed. Raw:`, raw);
      return res.status(500).json({ success: false, error: 'Failed to parse fit analysis response' });
    }

    console.log(`[${reqId}] ${ROUTE} success -> lead: ${leadId}`);
    
    // Store fit analysis results in the database
    try {
      // Try to update with new columns, fallback to basic update if columns don't exist
      const updateData = { updated_at: new Date().toISOString() };
      
              // Only try to update fit_analysis if the column exists
        try {
          const { error: updateError } = await supabase
            .from('leads')
            .update({ 
              fit_analysis: fitAnalysis,
              ...updateData
            })
            .eq('id', leadId);
          
          if (updateError) {
            console.error(`[${reqId}] Failed to store fit analysis:`, updateError);
          } else {
            console.log(`[${reqId}] Fit analysis stored for lead: ${leadId}`);
          }
        } catch (columnError) {
          // Column doesn't exist, just update timestamp
          console.log(`[${reqId}] fit_analysis column not available, storing in memory only`);
          const { error: updateError } = await supabase
            .from('leads')
            .update(updateData)
            .eq('id', leadId);
          
          if (updateError) {
            console.error(`[${reqId}] Failed to update fit analysis timestamp:`, updateError);
          }
        }

        // Store in vector database for AI email generation
        try {
          const vectorDoc = await storeAnalysisInVectorDB(
            leadId, 
            'fit_analysis', 
            fitAnalysis,
            {
              company: leadData?.company,
              role: leadData?.role,
              analysisType: 'fit_analysis',
              source: 'openai'
            }
          );
          if (vectorDoc) {
            console.log(`[${reqId}] ✅ Fit analysis stored in vector database: ${vectorDoc.id}`);
          }
        } catch (vectorError) {
          console.warn(`[${reqId}] ⚠️ Could not store fit analysis in vector database:`, vectorError.message);
        }
    } catch (dbError) {
      console.error(`[${reqId}] Database error storing fit analysis:`, dbError);
    }
    
    return res.json({
      success: true,
      fitAnalysis,
      usage: completion.usage
    });

  } catch (e) {
    console.error(`[${reqId}] Fit analysis error:`, e);
    if (e?.response?.status === 401) return res.status(401).json({ success: false, error: 'OpenAI authentication failed (401)' });
    if (e?.response?.status === 429) return res.status(429).json({ success: false, error: 'OpenAI rate limit / quota exceeded (429)' });
    return res.status(500).json({ success: false, error: e.message || 'Failed to analyze fit' });
  }
});

// Email Draft Generation Endpoint
app.post('/api/openai/generate-email-draft', async (req, res) => {
  const { leadId, resumeId, tone, researchDepth, customContext, leadData, contactInfo, enhancedContext } = req.body || {};
  
  console.log(`[${generateRequestId()}] POST /api/openai/generate-email-draft -> generating email for lead: ${leadId} with enhanced context`);
  
  try {
    // Resolve OpenAI API key
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return res.status(400).json({ error: "OpenAI API key not configured" });
    }

    // Get AI configuration for dynamic prompts and parameters
    const aiConfig = await getAIConfig();
    console.log(`🔧 Using AI configuration: model=${aiConfig.defaults.model}, temperature=${aiConfig.defaults.temperature}`);
    
    const systemPrompt = aiConfig.prompts.email_generation.system;

    let userPrompt = aiConfig.prompts.email_generation.user_template || `Job Details:
Company: ${leadData?.company || 'Not specified'}
Role: ${leadData?.role || 'Not specified'}
Location: ${leadData?.location || 'Not specified'}
Seniority: ${leadData?.seniority || 'Not specified'}
Description: ${leadData?.description || 'Not provided'}
Must Haves: ${leadData?.must_haves?.join(', ') || 'Not specified'}
Nice to Haves: ${leadData?.nice_to_haves?.join(', ') || 'Not specified'}
Keywords: ${leadData?.keywords?.join(', ') || 'Not specified'}

Contact Information:
Name: ${contactInfo?.name || 'Hiring Manager'}
Title: ${contactInfo?.title || 'Not specified'}
Email: ${contactInfo?.email || 'Not provided'}

Tone: ${tone || aiConfig.defaults.tone || 'professional'}
Research Depth: ${researchDepth || 'basic'}
Custom Context: ${customContext || 'None provided'}

STORYTELLING INSTRUCTIONS:
- Start with a compelling hook that connects the candidate's background to this specific role
- Weave their experience into a narrative that shows growth and impact
- Use specific examples and metrics to make achievements tangible
- Connect their story to the company's mission and the role's requirements
- End with a strong call to action that feels natural and confident`;

    // Replace template variables in user prompt
    userPrompt = userPrompt
      .replace(/{company}/g, leadData?.company || 'Not specified')
      .replace(/{role}/g, leadData?.role || 'Not specified')
      .replace(/{location}/g, leadData?.location || 'Not specified')
      .replace(/{seniority}/g, leadData?.seniority || 'Not specified')
      .replace(/{description}/g, leadData?.description || 'Not provided')
      .replace(/{must_haves}/g, leadData?.must_haves?.join(', ') || 'Not specified')
      .replace(/{nice_to_haves}/g, leadData?.nice_to_haves?.join(', ') || 'Not specified')
      .replace(/{keywords}/g, leadData?.keywords?.join(', ') || 'Not specified')
      .replace(/{contact_name}/g, contactInfo?.name || 'Hiring Manager')
      .replace(/{contact_title}/g, contactInfo?.title || 'Not specified')
      .replace(/{contact_email}/g, contactInfo?.email || 'Not provided')
      .replace(/{tone}/g, tone || aiConfig.defaults.tone || 'professional')
      .replace(/{research_depth}/g, researchDepth || 'basic')
      .replace(/{custom_context}/g, customContext || 'None provided');

    // Get stored analysis data from vector database
    const storedAnalysis = await getStoredAnalysisFromVectorDB(leadId);
    
    // 🔍 FETCH ALL KNOWLEDGE BASE DOCUMENTS FOR THIS LEAD
    const { data: allKnowledgeDocuments, error: knowledgeError } = await supabase
      .from('documents')
      .select('*')
      .or(`title.ilike.%${leadId}%,content.ilike.%${leadId}%`)
      .order('created_at', { ascending: false });

    let additionalKnowledgeChunks = [];
    if (allKnowledgeDocuments && allKnowledgeDocuments.length > 0) {
      additionalKnowledgeChunks = allKnowledgeDocuments
        .filter(doc => !doc.title.includes('company_research') && !doc.title.includes('fit_analysis'))
        .map(doc => ({
          content: typeof doc.content === 'string' ? doc.content : JSON.stringify(doc.content),
          metadata: doc.metadata || { source: 'vector_db', title: doc.title }
        }));
      console.log(`✅ Found ${additionalKnowledgeChunks.length} additional knowledge chunks from vector database`);
    }
    
    // Merge stored analysis with enhanced context (stored data takes priority)
    const mergedContext = {
      companyResearch: storedAnalysis.companyResearch || enhancedContext?.companyResearch,
      fitAnalysis: storedAnalysis.fitAnalysis || enhancedContext?.fitAnalysis,
      knowledgeChunks: [
        ...(enhancedContext?.knowledgeChunks || []),
        ...additionalKnowledgeChunks
      ],
      selectedResume: enhancedContext?.selectedResume,
      contactInfo: enhancedContext?.contactInfo
    };

    console.log(`🔍 Enhanced context summary:`, {
      hasCompanyResearch: !!mergedContext.companyResearch,
      hasFitAnalysis: !!mergedContext.fitAnalysis,
      knowledgeChunksCount: mergedContext.knowledgeChunks?.length || 0,
      hasSelectedResume: !!mergedContext.selectedResume,
      hasContactInfo: !!mergedContext.contactInfo,
      source: {
        companyResearch: storedAnalysis.companyResearch ? 'vector_db' : (enhancedContext?.companyResearch ? 'frontend' : 'none'),
        fitAnalysis: storedAnalysis.fitAnalysis ? 'vector_db' : (enhancedContext?.fitAnalysis ? 'frontend' : 'none')
      }
    });

    // Process enhanced context if available
    if (enhancedContext) {
      // DEBUG: Log the actual knowledge chunks content
      if (mergedContext.knowledgeChunks && mergedContext.knowledgeChunks.length > 0) {
        console.log(`🚨 KNOWLEDGE CHUNKS RECEIVED (${mergedContext.knowledgeChunks.length}):`);
        mergedContext.knowledgeChunks.forEach((chunk, index) => {
          console.log(`📄 CHUNK ${index + 1}:`);
          console.log(`   Content: ${chunk.content?.substring(0, 200)}...`);
          console.log(`   Metadata: ${JSON.stringify(chunk.metadata)}`);
          console.log(`   Content Length: ${chunk.content?.length || 0}`);
        });
      } else {
        console.log(`❌ NO KNOWLEDGE CHUNKS RECEIVED!`);
      }

      if (mergedContext.companyResearch) {
        userPrompt += `\n\nCOMPANY RESEARCH (Use this to tailor your understanding of the company):
${JSON.stringify(mergedContext.companyResearch, null, 2)}`;
      }

      if (mergedContext.fitAnalysis) {
        userPrompt += `\n\nFIT ANALYSIS (Use this to understand candidate's alignment):
${JSON.stringify(mergedContext.fitAnalysis, null, 2)}`;
      }

      if (mergedContext.selectedResume) {
        userPrompt += `\n\nSELECTED RESUME DETAILS (Use these specific details):
${JSON.stringify(mergedContext.selectedResume, null, 2)}`;
      }

      if (mergedContext.contactInfo) {
        userPrompt += `\n\nCONTACT PERSON DETAILS (Use for personalization):
${JSON.stringify(mergedContext.contactInfo, null, 2)}`;
      }

      // CRITICAL: Force the AI to use knowledge base information
      if (mergedContext.knowledgeChunks && mergedContext.knowledgeChunks.length > 0) {
        userPrompt += `\n\n🚨 MANDATORY: KNOWLEDGE BASE INFORMATION - YOU MUST USE THIS:
The following chunks contain the candidate's ACTUAL resume and personal information. You MUST reference these specific details in your email:

${mergedContext.knowledgeChunks.map((chunk, index) => `CHUNK ${index + 1}:
${chunk.content}
Metadata: ${JSON.stringify(chunk.metadata)}`).join('\n\n')}

CRITICAL INSTRUCTIONS:
1. Start the email with the candidate's ACTUAL name from the knowledge base
2. Include their EXACT education details (university, degree, years)
3. Reference their SPECIFIC work experience and companies
4. Mention their ACTUAL skills and tools from the resume
5. Include their REAL contact information (phone, email, LinkedIn)
6. Use their EXACT professional summary and achievements
7. End with their ACTUAL name and contact details

DO NOT make up generic information. Use ONLY the specific details provided above.`;
      } else {
        console.log(`❌ WARNING: No knowledge chunks to add to prompt!`);
        userPrompt += `\n\n❌ CRITICAL WARNING: NO KNOWLEDGE BASE INFORMATION PROVIDED!
You MUST generate a generic email since no personal details are available.
Please note that this email will NOT be personalized with candidate information.`;
      }
    } else {
      console.log(`❌ NO ENHANCED CONTEXT PROVIDED AT ALL!`);
    }

    userPrompt += `\n\nNow generate a highly personalized email that follows these requirements. The email must be specific, personal, and use the exact information from the knowledge base chunks provided. Please respond in valid JSON format as specified.`;

    console.log(`📝 Final prompt length: ${userPrompt.length} characters`);
    console.log(`🔍 Knowledge chunks being used: ${mergedContext?.knowledgeChunks?.length || 0}`);
    
    // DEBUG: Show the final prompt being sent to OpenAI
    console.log(`🤖 FINAL PROMPT BEING SENT TO OPENAI:`);
    console.log(`=== SYSTEM PROMPT ===`);
    console.log(systemPrompt);
    console.log(`=== USER PROMPT ===`);
    console.log(userPrompt.substring(0, 1000) + (userPrompt.length > 1000 ? '...' : ''));
    if (userPrompt.length > 1000) {
      console.log(`... (truncated, total length: ${userPrompt.length})`);
    }

    // Create OpenAI client and generate email
    const openai = new OpenAI({ apiKey: openaiApiKey });
    
    const completion = await openai.chat.completions.create({
      model: aiConfig.defaults.model || 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: aiConfig.defaults.temperature || 0.7,
      max_tokens: aiConfig.defaults.max_tokens || 1500,
      top_p: aiConfig.defaults.top_p || 0.9,
      presence_penalty: aiConfig.defaults.presence_penalty || 0.0,
      frequency_penalty: aiConfig.defaults.frequency_penalty || 0.0,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() || '';
    if (!raw) {
      return res.status(502).json({ success: false, error: 'Empty response from OpenAI' });
    }

    console.log(`🔍 Raw OpenAI response:`, raw.substring(0, 500) + (raw.length > 500 ? '...' : ''));

    let emailDraft;
    try {
      emailDraft = JSON.parse(raw);
      console.log(`✅ Successfully parsed JSON response:`, emailDraft);
    } catch (e) {
      console.error('❌ JSON parse failed. Raw response:', raw);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to parse email draft response',
        rawResponse: raw.substring(0, 200) + (raw.length > 200 ? '...' : '')
      });
    }

    // Handle different response formats from AI
    let finalEmailDraft = emailDraft;
    
    // If AI returns nested email object, extract the content
    if (emailDraft.email && emailDraft.email.subject && emailDraft.email.body) {
      finalEmailDraft = {
        subject: emailDraft.email.subject,
        body: emailDraft.email.body
      };
    }
    
    // Ensure required fields
    if (!finalEmailDraft.subject || !finalEmailDraft.body) {
      console.error('❌ Email draft missing required fields:', finalEmailDraft);
      return res.status(500).json({ 
        success: false, 
        error: 'Generated email missing required fields',
        received: finalEmailDraft
      });
    }

    console.log(`[${generateRequestId()}] POST /api/openai/generate-email-draft success -> lead: ${leadId}`);
    return res.json({
      success: true,
      subject: finalEmailDraft.subject,
      body: formatEmailBody(finalEmailDraft.body, 'text'),
      generatedAt: finalEmailDraft.generatedAt || new Date().toISOString(),
      usage: completion.usage
    });

  } catch (e) {
    console.error('Email draft generation error:', e);
    res.status(500).json({ success: false, error: e.message || 'Failed to generate email draft' });
  }
});

/* ------------------------------ VECTOR DATABASE STORAGE ------------------------------ */

// Store analysis results in vector database
async function storeAnalysisInVectorDB(leadId, analysisType, content, metadata = {}) {
  try {
    // Create a unique document ID for this analysis
    const documentId = crypto.randomUUID();
    
    // Store in documents table
    const { data: docData, error: docError } = await supabase
      .from('documents')
      .insert({
        id: documentId,
        title: `${analysisType} for Lead ${leadId}`,
        content: JSON.stringify(content),
        user_id: 'default-user', // Required field
        type: analysisType.includes('company') ? 'company_research' : 'note', // Use valid types
        metadata: {
          ...metadata,
          leadId,
          analysisType,
          generatedAt: new Date().toISOString()
        }
      })
      .select()
      .single();

    if (docError) {
      console.error(`❌ Failed to store ${analysisType} document:`, docError);
      return null;
    }

    console.log(`✅ Stored ${analysisType} in vector database: ${documentId}`);
    return docData;
  } catch (error) {
    console.error(`❌ Error storing ${analysisType} in vector database:`, error);
    return null;
  }
}

// Fetch stored analysis data from vector database
async function getStoredAnalysisFromVectorDB(leadId) {
  try {
    console.log(`🔍 Fetching stored analysis data for lead: ${leadId}`);
    
    // Get company research and fit analysis from vector database
    const { data: documents, error } = await supabase
      .from('documents')
      .select('*')
      .or(`title.ilike.%company_research for Lead ${leadId}%,title.ilike.%fit_analysis for Lead ${leadId}%`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`❌ Error fetching stored analysis:`, error);
      return { companyResearch: null, fitAnalysis: null };
    }

    let companyResearch = null;
    let fitAnalysis = null;

    if (documents && documents.length > 0) {
      for (const doc of documents) {
        try {
          const content = JSON.parse(doc.content);
                  if (doc.title.includes('company_research')) {
          companyResearch = content;
          console.log(`✅ Found stored company research for lead: ${leadId}`);
        } else if (doc.title.includes('fit_analysis')) {
          fitAnalysis = content;
          console.log(`✅ Found stored fit analysis for lead: ${leadId}`);
        }
        } catch (parseError) {
          console.warn(`⚠️ Could not parse document content:`, parseError.message);
        }
      }
    }

    return { companyResearch, fitAnalysis };
  } catch (error) {
    console.error(`❌ Error in getStoredAnalysisFromVectorDB:`, error);
    return { companyResearch: null, fitAnalysis: null };
  }
}

// Check if specific analysis exists in vector database
async function checkAnalysisExistsInVectorDB(leadId, analysisType, companyName = null) {
  try {
    console.log(`🔍 Checking if ${analysisType} exists in vector database for lead: ${leadId}, company: ${companyName}`);
    
    // First check what documents exist for this lead
    const titlePattern = `%${analysisType} for Lead ${leadId}%`;
    console.log(`🔍 Search pattern: title ILIKE '${titlePattern}'`);
    
    let query = supabase
      .from('documents')
      .select('*')
      .ilike('title', titlePattern)
      .order('created_at', { ascending: false })
      .limit(1);

    // For company research, we should find by leadId first, then filter by company if needed
    // Don't apply company filter in the query as it makes it too restrictive

    console.log(`🔍 Executing query...`);
    const { data: documents, error } = await query;

    if (error) {
      console.error(`❌ Error checking ${analysisType} in vector database:`, error);
      return null;
    }

    console.log(`🔍 Query results: Found ${documents?.length || 0} documents`);
    if (documents && documents.length > 0) {
      console.log(`🔍 First document title: "${documents[0].title}"`);
      console.log(`🔍 First document type: "${documents[0].type}"`);
    }

    if (documents && documents.length > 0) {
      const doc = documents[0];
      try {
        const content = JSON.parse(doc.content);
        console.log(`✅ Found existing ${analysisType} in vector database for lead: ${leadId}`);
        return {
          exists: true,
          content: content,
          documentId: doc.id,
          generatedAt: doc.metadata?.generatedAt
        };
      } catch (parseError) {
        console.warn(`⚠️ Could not parse existing ${analysisType} content:`, parseError.message);
        return { exists: false };
      }
    }

    console.log(`❌ No existing ${analysisType} found in vector database for lead: ${leadId}`);
    return { exists: false };
  } catch (error) {
    console.error(`❌ Error in checkAnalysisExistsInVectorDB:`, error);
    return { exists: false };
  }
}

/* ------------------------------ SETTINGS API ------------------------------ */

// Simple endpoint to test if prompt settings can be stored
app.post('/api/settings/test-prompts', async (req, res) => {
  try {
    console.log(`🔧 Testing prompt settings storage...`);
    
    // For now, just return success - we'll handle prompt storage differently
    console.log(`✅ Prompt settings test completed`);
    return res.json({ 
      success: true, 
      message: 'Prompt settings test completed - will implement storage later' 
    });
  } catch (error) {
    console.error(`❌ Error in prompt settings test:`, error);
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get settings
app.get('/api/settings/get', async (req, res) => {
  try {
    console.log(`🔧 Getting settings for user: me`);
    
    // Get regular settings
    const { data: regularSettings, error } = await supabase
      .from('settings')
      .select('*')
      .eq('user_id', 'me')
      .maybeSingle();
    
    if (error) {
      console.error(`❌ Error getting regular settings:`, error);
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
    
    // Get prompt settings from documents table
    const { data: promptDocs, error: promptError } = await supabase
      .from('documents')
      .select('title, content, metadata')
      .eq('user_id', 'me')
      .eq('type', 'note')
      .ilike('title', 'prompt_setting_%');
    
    if (promptError) {
      console.error(`❌ Error getting prompt settings:`, promptError);
      // Continue without prompt settings
    }
    
    // Combine regular settings with prompt settings
    const settings = { ...regularSettings };
    
    if (promptDocs && promptDocs.length > 0) {
      promptDocs.forEach(doc => {
        const promptType = doc.title.replace('prompt_setting_', '');
        settings[promptType] = doc.content;
      });
      console.log(`🔧 Found ${promptDocs.length} prompt settings`);
    }
    
    console.log(`✅ Settings retrieved successfully`);
    return res.json({ 
      success: true, 
      settings: settings 
    });
  } catch (error) {
    console.error(`❌ Error in settings get:`, error);
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Update settings
app.post('/api/settings/update', async (req, res) => {
  try {
    const updates = req.body;
    console.log(`🔧 Updating settings:`, updates);
    
    // Separate prompt settings from regular settings
    const promptFields = [
      'email_generation_system_prompt', 'email_generation_user_prompt_template',
      'company_research_system_prompt', 'fit_analysis_system_prompt'
    ];
    
    const regularFields = [
      'openai_api_key', 'gmail_client_id', 'gmail_client_secret', 
      'gmail_refresh_token', 'gmail_access_token', 'default_resume_id',
      'tone_default', 'length_default', 'followup_rules_id', 'gmail_connected'
    ];
    
    // Filter regular settings
    const regularUpdates = Object.keys(updates)
      .filter(key => regularFields.includes(key))
      .reduce((obj, key) => {
        obj[key] = updates[key];
        return obj;
      }, {});
    
    // Filter prompt settings
    const promptUpdates = Object.keys(updates)
      .filter(key => promptFields.includes(key))
      .reduce((obj, key) => {
        obj[key] = updates[key];
        return obj;
      }, {});
    
    console.log(`🔧 Regular updates:`, regularUpdates);
    console.log(`🔧 Prompt updates:`, Object.keys(promptUpdates));
    
    // Update regular settings if any
    let regularData = null;
    if (Object.keys(regularUpdates).length > 0) {
      const settingsData = {
        ...regularUpdates,
        user_id: 'me',
        updated_at: new Date().toISOString()
      };
      
      const { data, error } = await supabase
        .from('settings')
        .upsert(settingsData, {
          onConflict: 'user_id'
        })
        .select()
        .single();
      
      if (error) {
        console.error(`❌ Error updating regular settings:`, error);
        return res.status(500).json({ 
          success: false, 
          error: error.message 
        });
      }
      
      regularData = data;
    }
    
    // Store prompt settings in documents table if any
    if (Object.keys(promptUpdates).length > 0) {
      for (const [promptType, promptValue] of Object.entries(promptUpdates)) {
        try {
          // Delete existing prompt setting
          await supabase
            .from('documents')
            .delete()
            .eq('user_id', 'me')
            .eq('title', `prompt_setting_${promptType}`)
            .eq('type', 'note');
          
          // Insert new prompt setting
          const { error: promptError } = await supabase
            .from('documents')
            .upsert({
              user_id: 'me',
              title: `prompt_setting_${promptType}`,
              content: promptValue,
              type: 'note',
              metadata: {
                settingType: 'prompt',
                promptType: promptType,
                updatedAt: new Date().toISOString()
              }
            });
          
          if (promptError) {
            console.error(`❌ Error storing prompt ${promptType}:`, promptError);
          } else {
            console.log(`✅ Stored prompt setting: ${promptType}`);
          }
        } catch (promptError) {
          console.error(`❌ Error processing prompt ${promptType}:`, promptError);
        }
      }
    }
    
    console.log(`✅ Settings updated successfully`);
    return res.json({ 
      success: true, 
      settings: regularData,
      promptsUpdated: Object.keys(promptUpdates).length
    });
  } catch (error) {
    console.error(`❌ Error in settings update:`, error);
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/* ------------------------------ DEBUG: DOCUMENTS TABLE ------------------------------ */

// Debug endpoint to check documents table
app.get('/api/debug/documents', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.json({
      success: true,
      documents: data,
      count: data?.length || 0
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/* ------------------------------ GMAIL LABEL MANAGEMENT ------------------------------ */

// Create or get Gmail label for a specific lead
async function createOrGetLeadLabel(gmail, leadId, companyName, roleName) {
  try {
    const labelName = `LazyBird/Lead-${leadId}`;
    const labelDescription = `Emails related to ${companyName} - ${roleName} application`;
    
    // First, try to find existing label
    const labelsResponse = await gmail.users.labels.list({ userId: 'me' });
    const existingLabel = labelsResponse.data.labels?.find(label => label.name === labelName);
    
    if (existingLabel) {
      console.log(`✅ Found existing label: ${labelName}`);
      return existingLabel.id;
    }
    
    // Create new label if it doesn't exist
    const createResponse = await gmail.users.labels.create({
      userId: 'me',
      requestBody: {
        name: labelName,
        messageListVisibility: 'show',
        labelListVisibility: 'labelShow'
      }
    });
    
    console.log(`✅ Created new label: ${labelName} (ID: ${createResponse.data.id})`);
    return createResponse.data.id;
  } catch (error) {
    console.error('❌ Error creating/getting label:', error);
    throw error;
  }
}

// Add label to a Gmail message
async function addLabelToMessage(gmail, messageId, labelId) {
  try {
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        addLabelIds: [labelId]
      }
    });
    console.log(`✅ Added label ${labelId} to message ${messageId}`);
  } catch (error) {
    console.error('❌ Error adding label to message:', error);
    throw error;
  }
}

/* ------------------------------ GMAIL SEND ------------------------------ */

app.post('/api/gmail/send', async (req, res) => {
  const ROUTE = 'POST /api/gmail/send';
  const reqId = Math.random().toString(36).slice(2);
  
  try {
    const { threadId, to, cc, subject, html, text, attachments } = req.body;
    
    if (!to || !Array.isArray(to) || to.length === 0) {
      return res.status(400).json({ success: false, error: 'Recipients are required' });
    }
    
    if (!html && !text) {
      return res.status(400).json({ success: false, error: 'Message content is required' });
    }

    console.log(`[${reqId}] ${ROUTE} -> sending email to ${to.join(', ')}`);

    // Use environment variables directly as requested
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
      return res.status(400).json({ success: false, error: 'Gmail credentials not configured' });
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Get user profile for sender info
    const profile = await gmail.users.getProfile({ userId: 'me' });
    const senderEmail = profile.data.emailAddress || 'me@gmail.com';

    // Validate email addresses
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = to.filter(email => !emailRegex.test(email));
    if (invalidEmails.length > 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid email addresses', 
        invalidEmails 
      });
    }

    // Build MIME message
    const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    let mimeMessage = '';

    // Headers
    mimeMessage += `From: ${senderEmail}\r\n`;
    mimeMessage += `To: ${to.join(', ')}\r\n`;
    if (cc && cc.length > 0) {
      mimeMessage += `Cc: ${cc.join(', ')}\r\n`;
    }
    mimeMessage += `Subject: ${subject || 'No Subject'}\r\n`;
    mimeMessage += `MIME-Version: 1.0\r\n`;

    // If this is a reply, add threading headers
    if (threadId) {
      try {
        const thread = await gmail.users.threads.get({ userId: 'me', id: threadId });
        if (thread.data.messages && thread.data.messages.length > 0) {
          const lastMessage = thread.data.messages[thread.data.messages.length - 1];
          const headers = lastMessage.payload?.headers || [];
          
          const messageId = headers.find(h => h.name === 'Message-ID')?.value;
          const references = headers.find(h => h.name === 'References')?.value;
          
          if (messageId) {
            mimeMessage += `In-Reply-To: ${messageId}\r\n`;
            if (references) {
              mimeMessage += `References: ${references} ${messageId}\r\n`;
            } else {
              mimeMessage += `References: ${messageId}\r\n`;
            }
          }
          
          // Auto-prefix subject with "Re:" if not already present
          if (subject && !subject.toLowerCase().startsWith('re:')) {
            mimeMessage = mimeMessage.replace(`Subject: ${subject}`, `Subject: Re: ${subject}`);
          }
        }
      } catch (error) {
        console.warn(`[${reqId}] ⚠️ Could not fetch thread for headers:`, error.message);
      }
    }

    if (attachments && attachments.length > 0) {
      // Multipart message with attachments
      mimeMessage += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;
      
      // Text part
      mimeMessage += `--${boundary}\r\n`;
      mimeMessage += `Content-Type: multipart/alternative; boundary="alt_${boundary}"\r\n\r\n`;
      
      if (text) {
        mimeMessage += `--alt_${boundary}\r\n`;
        mimeMessage += `Content-Type: text/plain; charset=UTF-8\r\n\r\n`;
        mimeMessage += `${text}\r\n\r\n`;
      }
      
      if (html) {
        mimeMessage += `--alt_${boundary}\r\n`;
        mimeMessage += `Content-Type: text/html; charset=UTF-8\r\n\r\n`;
        mimeMessage += `${html}\r\n\r\n`;
      }
      
      mimeMessage += `--alt_${boundary}--\r\n\r\n`;
      
      // Attachments
      for (const attachment of attachments) {
        if (attachment.dataBase64) {
          mimeMessage += `--${boundary}\r\n`;
          mimeMessage += `Content-Type: ${attachment.mimeType}; name="${attachment.name}"\r\n`;
          mimeMessage += `Content-Disposition: attachment; filename="${attachment.name}"\r\n`;
          mimeMessage += `Content-Transfer-Encoding: base64\r\n\r\n`;
          mimeMessage += `${attachment.dataBase64}\r\n\r\n`;
        }
      }
      
      mimeMessage += `--${boundary}--\r\n`;
    } else {
      // Simple text/html message
      if (html) {
        mimeMessage += `Content-Type: text/html; charset=UTF-8\r\n\r\n`;
        mimeMessage += html;
      } else {
        mimeMessage += `Content-Type: text/plain; charset=UTF-8\r\n\r\n`;
        mimeMessage += text;
      }
    }

    // Convert to base64url
    const raw = Buffer.from(mimeMessage, 'utf8').toString('base64url');

    // Send email
    const sendRequest = {
      userId: 'me',
      requestBody: {
        raw,
        threadId: threadId || undefined
      }
    };

    const response = await gmail.users.messages.send(sendRequest);

    const messageId = response.data.id;
    const responseThreadId = response.data.threadId || threadId;
    
    console.log(`[${reqId}] ✅ Email sent successfully: ${messageId}`);
    
    // Track this as a system-generated email
    systemGeneratedEmails.add(messageId);
    systemGeneratedEmails.add(responseThreadId);
    
    // Store in thread tracking
    threadTracking.set(responseThreadId, {
      tracked: true,
      hiddenAt: null,
      systemGenerated: true,
      leadId: null,
      emailType: 'manual'
    });
    
    // Try to save to database
    try {
      await supabase
        .from('thread_tracking')
        .upsert({
          user_id: 'me',
          thread_id: responseThreadId,
          tracked: true,
          system_generated: true,
          lead_id: null,
          email_type: 'manual',
          created_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,thread_id'
        });
      console.log(`[${reqId}] ✅ Manual email thread ${responseThreadId} marked as system-generated (persistent)`);
    } catch (dbError) {
      console.warn(`[${reqId}] ⚠️ Database save failed (using in-memory only):`, dbError.message);
      console.log(`[${reqId}] ✅ Manual email thread ${responseThreadId} marked as system-generated (in-memory)`);
    }
    
    res.json({ 
      success: true, 
      id: messageId, 
      threadId: responseThreadId 
    });

  } catch (error) {
    console.error(`[${reqId}] ❌ ${ROUTE} error:`, error);
    
    let errorMessage = 'Failed to send email';
    let status = 500;
    
    if (error.response) {
      status = error.response.status || 500;
      errorMessage = error.response.data?.error?.message || error.response.data?.error || errorMessage;
    }
    
    res.status(status).json({ 
      success: false, 
      error: errorMessage,
      details: error.message
    });
  }
});

/* ------------------------------ LEADS API ------------------------------- */

app.get('/api/leads', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/leads/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('leads')
      .select(`
        *,
        contacts(*),
        artifacts(*),
        applications(*, messages(*))
      `)
      .eq('id', id)
      .single();

    if (error) return res.status(500).json({ success: false, error: error.message });
    if (!data) return res.status(404).json({ success: false, error: 'Lead not found' });
    
    res.json({ success: true, lead: data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.put('/api/leads/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body || {};
    
    const { data, error } = await supabase
      .from('leads')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/* ------------------------------ SNIPPETS API ------------------------------- */

app.get('/api/snippets', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('snippets')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/snippets', async (req, res) => {
  try {
    const snippet = req.body || {};
    const { data, error } = await supabase
      .from('snippets')
      .insert({ ...snippet, user_id: 'me', created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .select()
      .single();

    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.put('/api/snippets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body || {};
    
    const { data, error } = await supabase
      .from('snippets')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.delete('/api/snippets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { error } = await supabase
      .from('snippets')
      .delete()
      .eq('id', id);

    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true, message: 'Snippet deleted successfully' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/* ------------------------------ ARTIFACTS API ------------------------------- */

app.get('/api/artifacts', async (req, res) => {
  try {
    const { leadId } = req.query;
    let query = supabase
      .from('artifacts')
      .select(`
        *,
        lead:leads(*),
        resume:resumes(*)
      `)
      .order('created_at', { ascending: false });
    
    if (leadId) {
      query = query.eq('lead_id', leadId);
    }
    
    const { data, error } = await query;

    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/artifacts', async (req, res) => {
  try {
    const artifact = req.body || {};
    const { data, error } = await supabase
      .from('artifacts')
      .insert({ ...artifact, user_id: 'me', created_at: new Date().toISOString() })
      .select()
      .single();

    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.put('/api/artifacts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body || {};
    
    const { data, error } = await supabase
      .from('artifacts')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(500).json({ success: false, error: e.message });
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.delete('/api/artifacts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { error } = await supabase
      .from('artifacts')
      .delete()
      .eq('id', id);

    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true, message: 'Artifact deleted successfully' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/* ------------------------------ APPLICATIONS API ------------------------------- */

app.get('/api/applications', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('applications')
      .select(`
        *,
        lead:leads(*),
        messages(*, contact:contacts(*))
      `)
      .order('updated_at', { ascending: false });

    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/applications', async (req, res) => {
  try {
    const application = req.body || {};
    const { data, error } = await supabase
      .from('applications')
      .insert({ ...application, user_id: 'me', created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .select()
      .single();

    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.put('/api/applications/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body || {};
    
    const { data, error } = await supabase
      .from('applications')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/* ------------------------------ GMAIL APPLICATIONS API ------------------------------ */

// Get Gmail applications for a lead using labels and smart search
app.post('/api/gmail/applications', async (req, res) => {
  const ROUTE = 'POST /api/gmail/applications';
  const reqId = Math.random().toString(36).slice(2);
  
  try {
    const { leadId, companyName, roleName } = req.body || {};
    if (!leadId) {
      return res.status(400).json({ success: false, error: 'Lead ID is required' });
    }

    console.log(`[${reqId}] ${ROUTE} -> fetching applications for lead: ${leadId}`);

    // Get user settings for Gmail credentials
    const settings = await getUserSettings();
    if (!settings?.gmail_connected) {
      return res.status(400).json({ success: false, error: 'Gmail not connected' });
    }

    const clientId = settings.gmail_client_id;
    const clientSecret = settings.gmail_client_secret;
    const refreshToken = settings.gmail_refresh_token;

    if (!clientId || !clientSecret || !refreshToken) {
      return res.status(400).json({ success: false, error: 'Gmail credentials not configured' });
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    let applications = [];

    // Method 1: Try to find emails with lead-specific label
    const labelName = `LazyBird/Lead-${leadId}`;
    
    try {
      console.log(`[${reqId}] Looking for lead-specific label: ${labelName}`);
      
      // Get all labels to find our lead label
      const labelsResponse = await gmail.users.labels.list({ userId: 'me' });
      const leadLabel = labelsResponse.data.labels?.find(label => label.name === labelName);
      
      if (leadLabel) {
        console.log(`[${reqId}] ✅ Found lead label: ${labelName} (ID: ${leadLabel.id})`);
        
        // Get messages with this label
        const labeledMessages = await gmail.users.messages.list({
          userId: 'me',
          labelIds: [leadLabel.id],
          maxResults: 50
        });
        
        if (labeledMessages.data.messages && labeledMessages.data.messages.length > 0) {
          console.log(`[${reqId}] 📧 Found ${labeledMessages.data.messages.length} labeled messages`);
          
          for (const message of labeledMessages.data.messages) {
            try {
              const messageDetails = await gmail.users.messages.get({
                userId: 'me',
                id: message.id,
                format: 'metadata',
                metadataHeaders: ['Subject', 'From', 'To', 'Date']
              });

              const headers = messageDetails.data.payload?.headers || [];
              const subject = headers.find(h => h.name === 'Subject')?.value || '';
              const from = headers.find(h => h.name === 'From')?.value || '';
              const to = headers.find(h => h.name === 'To')?.value || '';
              const date = headers.find(h => h.name === 'Date')?.value || '';

              // Parse addresses properly
              const fromAddress = parseAddressList(from)[0] || { name: 'Unknown', email: 'unknown@example.com' };
              const toAddresses = parseAddressList(to);
              
              // Extract contact info for backward compatibility
              let contact = fromAddress.name;
              let contactEmail = fromAddress.email;

              applications.push({
                id: message.id,
                threadId: message.threadId,
                contact,
                subject: subject || 'No subject',
                date: date ? new Date(date).toISOString().split('T')[0] : 'Unknown',
                status: 'sent'
              });
            } catch (messageError) {
              console.warn(`[${reqId}] ⚠️ Could not fetch labeled message ${message.id}:`, messageError.message);
            }
          }
        }
      }
    } catch (labelError) {
      console.warn(`[${reqId}] ⚠️ Could not fetch labeled messages:`, labelError.message);
    }

    // Method 2: Fallback to search-based approach if no labeled messages found
    if (applications.length === 0) {
      console.log(`[${reqId}] 🔍 No labeled messages found, falling back to search-based approach`);
      
      // Use a simpler approach - get recent sent emails
      console.log(`[${reqId}] Using fallback: getting recent sent emails`);
      
      const { data: messages } = await gmail.users.messages.list({
        userId: 'me',
        labelIds: ['SENT'],
        maxResults: 20
      });

      if (messages?.messages) {
        // Get details for each message
        const messageApplications = await Promise.all(
          messages.messages.slice(0, 10).map(async (message) => {
            try {
              const messageDetails = await gmail.users.messages.get({
                userId: 'me',
                id: message.id,
                format: 'metadata',
                metadataHeaders: ['Subject', 'From', 'To', 'Date']
              });

              const headers = messageDetails.data.payload?.headers || [];
              const from = headers.find(h => h.name === 'From')?.value || '';
              const to = headers.find(h => h.name === 'To')?.value || '';
              const subject = headers.find(h => h.name === 'Subject')?.value || '';
              const date = headers.find(h => h.name === 'Date')?.value || '';

              // Parse addresses properly
              const toAddresses = parseAddressList(to);
              const fromAddress = parseAddressList(from)[0] || { name: 'Unknown', email: 'unknown@example.com' };
              
              // Extract contact info for backward compatibility
              let contact = toAddresses[0]?.name || 'Unknown';
              let contactEmail = toAddresses[0]?.email || 'unknown@example.com';

              return {
                id: message.id,
                threadId: message.threadId,
                contact,
                subject: subject || 'No subject',
                date: date ? new Date(date).toISOString().split('T')[0] : 'Unknown',
                status: 'sent'
              };
            } catch (messageError) {
              console.warn(`[${reqId}] ⚠️ Could not fetch message ${message.id}:`, messageError.message);
              return null;
            }
          })
        );

        applications = messageApplications.filter(Boolean);
      }
    }

    console.log(`[${reqId}] ✅ Found ${applications.length} applications for lead: ${leadId}`);
    res.json({ success: true, applications });
  } catch (error) {
    console.error(`[${reqId}] ❌ Gmail applications error:`, error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch applications' });
  }
});

// Get Gmail thread messages
app.post('/api/gmail/thread', async (req, res) => {
  const ROUTE = 'POST /api/gmail/thread';
  const reqId = Math.random().toString(36).slice(2);
  
  try {
    const { threadId, leadId } = req.body || {};
    if (!threadId) {
      return res.status(400).json({ success: false, error: 'Thread ID is required' });
    }

    console.log(`[${reqId}] ${ROUTE} -> fetching thread: ${threadId}`);

    // Get Gmail credentials from environment variables
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
      return res.status(400).json({ success: false, error: 'Gmail credentials not configured in environment' });
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Get thread details with minimal format to avoid scope issues
    const { data: threadData } = await gmail.users.threads.get({
      userId: 'me',
      id: threadId,
      format: 'minimal' // Use minimal format to avoid scope issues
    });

    const messages = threadData.messages || [];
    
    // Process each message in the thread by fetching individual messages
    const processedMessages = [];
    for (const message of messages) {
      try {
        // Try to fetch individual message with full format first, fallback to metadata
        let messageData;
        try {
          // First try with full format for complete content
          console.log(`[${reqId}] Attempting full format for message ${message.id}`);
          const response = await gmail.users.messages.get({
            userId: 'me',
            id: message.id,
            format: 'full'
          });
          messageData = response.data;
          console.log(`[${reqId}] ✅ Full format successful for message ${message.id}`);
        } catch (fullFormatError) {
          console.log(`[${reqId}] ❌ Full format failed for message ${message.id}:`, fullFormatError.message);
          if (fullFormatError.message.includes('Metadata scope')) {
            // Fallback to metadata format if full format fails
            console.log(`[${reqId}] Using metadata format for message ${message.id}`);
            const response = await gmail.users.messages.get({
              userId: 'me',
              id: message.id,
              format: 'metadata',
              metadataHeaders: ['From', 'To', 'Subject', 'Date']
            });
            messageData = response.data;
          } else {
            throw fullFormatError;
          }
        }

        const headers = messageData.payload?.headers || [];
        const from = headers.find(h => h.name === 'From')?.value || '';
        const to = headers.find(h => h.name === 'To')?.value || '';
        const subject = headers.find(h => h.name === 'Subject')?.value || '';
        const date = headers.find(h => h.name === 'Date')?.value || '';

        // Determine direction (out/in) - try to get user email from Gmail API
        let userEmail = '';
        let direction = 'unknown';
        try {
          const profile = await gmail.users.getProfile({ userId: 'me' });
          userEmail = profile.data.emailAddress || '';
          direction = from.includes(userEmail) ? 'out' : 'in';
        } catch (profileError) {
          console.log(`[${reqId}] Could not get user profile, using fallback direction detection`);
          // Fallback: if from contains the refresh token's associated email, it's outgoing
          direction = from.includes('@gmail.com') ? 'out' : 'in';
        }
        
        // Parse contact name
        let contact = 'Unknown';
        if (from) {
          const match = from.match(/"([^"]+)"\s*<(.+?)>/);
          if (match) {
            contact = match[1];
          } else {
            contact = from.split('@')[0];
          }
        }

        // Extract body content based on format available
        let body = '';
        if (messageData.payload?.body?.data) {
          // Full format - decode base64 body
          body = Buffer.from(messageData.payload.body.data, 'base64').toString('utf-8');
          // Preserve line breaks by normalizing them
          body = body.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        } else if (messageData.payload?.parts) {
          // Full format - handle multipart messages
          // First try to find text/plain, then text/html
          let textPart = messageData.payload.parts.find(part => part.mimeType === 'text/plain');
          if (!textPart) {
            textPart = messageData.payload.parts.find(part => part.mimeType === 'text/html');
          }
          
          if (textPart?.body?.data) {
            body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
            // Preserve line breaks by normalizing them
            body = body.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
            
            // If it's HTML, convert to plain text
            if (textPart.mimeType === 'text/html') {
              // Convert common HTML line breaks to proper line breaks FIRST
              body = body.replace(/<br\s*\/?>/gi, '\n'); // Convert <br> to line breaks
              body = body.replace(/<\/p>/gi, '\n\n'); // Convert </p> to double line breaks
              body = body.replace(/<p[^>]*>/gi, ''); // Remove opening <p> tags
              body = body.replace(/<\/div>/gi, '\n'); // Convert </div> to line breaks
              body = body.replace(/<div[^>]*>/gi, ''); // Remove opening <div> tags
              // Then remove remaining HTML tags
              body = body.replace(/<[^>]*>/g, ''); // Remove HTML tags
              body = body.replace(/&nbsp;/g, ' '); // Replace &nbsp; with space
              body = body.replace(/&amp;/g, '&'); // Replace &amp; with &
              body = body.replace(/&lt;/g, '<'); // Replace &lt; with <
              body = body.replace(/&gt;/g, '>'); // Replace &gt; with >
              body = body.replace(/&quot;/g, '"'); // Replace &quot; with "
              // Clean up multiple line breaks
              body = body.replace(/\n\s*\n\s*\n/g, '\n\n'); // Replace 3+ line breaks with 2
            }
          }
        } else if (messageData.snippet) {
          // Metadata format - use snippet
          body = messageData.snippet;
        } else {
          body = 'Content preview not available';
        }

        processedMessages.push({
          id: message.id,
          direction,
          subject: subject || 'No subject',
          body: body,
          timestamp: date || new Date().toISOString(),
          contact,
          snippet: messageData.snippet || ''
        });
      } catch (messageError) {
        console.error(`[${reqId}] Error fetching message ${message.id}:`, messageError);
        // Continue with other messages
        processedMessages.push({
          id: message.id,
          direction: 'unknown',
          subject: 'Error loading message',
          body: 'Failed to load message content',
          timestamp: new Date().toISOString(),
          contact: 'Unknown',
          error: true
        });
      }
    }

    console.log(`[${reqId}] ${ROUTE} success -> thread: ${threadId}, messages: ${processedMessages.length}`);
    
    // Check if we're getting limited content due to scope
    const hasLimitedContent = processedMessages.some(msg => 
      msg.body === 'Content preview not available' || msg.body === 'Failed to load message content'
    );
    
    return res.json({
      success: true,
      messages: processedMessages,
      scopeInfo: {
        hasFullAccess: !hasLimitedContent,
        message: hasLimitedContent ? 
          'Limited content due to Gmail scope. Re-authenticate with gmail.readonly scope for full message content.' : 
          'Full message content available'
      }
    });

  } catch (e) {
    console.error(`[${reqId}] Gmail thread error:`, e);
    return res.status(500).json({ success: false, error: e.message || 'Failed to fetch Gmail thread' });
  }
});

/* ------------------------------ LEADS API ------------------------------- */

app.post('/api/leads', async (req, res) => {
  try {
    const cleaned = req.body || {};
    const lead = await insertLead(cleaned, {
      sourceType: cleaned.source_type || 'manual',
      sourceRef: cleaned.source_ref || null,
    });
    res.json({ success: true, lead });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message || 'Failed to create lead' });
  }
});

/* ---------------------------- COVER LETTER API --------------------------- */

app.post('/api/generate-cover-letter', async (req, res) => {
  try {
    const { leadId, leadData, userProfile, resumeData, snippets, tone = 'professional', length = 'medium' } = req.body || {};
    
    if (!leadId && !leadData) {
      return res.status(400).json({ success: false, error: 'Lead ID or lead data is required' });
    }

    // Get OpenAI key
    const settings = await getUserSettings();
    const resolvedKey = req.body.openaiApiKey || settings?.openai_api_key || process.env.OPENAI_API_KEY;
    if (!resolvedKey) {
      return res.status(400).json({ success: false, error: 'OpenAI API key not configured' });
    }
    
    const openai = new OpenAI({ apiKey: resolvedKey });

    // Build context from lead data
    let context = '';
    if (leadData) {
      context += `Job Details:\n- Company: ${leadData?.company || 'Not specified'}\n- Role: ${leadData?.role || 'Not specified'}\n- Location: ${leadData?.location || 'Not specified'}\n`;
      if (leadData?.description_text) context += `- Description: ${leadData.description_text}\n`;
      if (leadData?.must_haves?.length) context += `- Must-Have Skills: ${leadData.must_haves.join(', ')}\n`;
      if (leadData?.nice_to_haves?.length) context += `- Nice-to-Have Skills: ${leadData.nice_to_haves.join(', ')}\n`;
      context += '\n';
    }

    // Use user profile data from request body (from workspace)
    if (userProfile) {
      context += `Candidate Profile:\n- Name: ${userProfile.full_name || 'Not specified'}\n`;
      if (userProfile.title) context += `- Current Title: ${userProfile.title}\n`;
      if (userProfile.company) context += `- Current Company: ${userProfile.company}\n`;
      if (userProfile.location) context += `- Location: ${userProfile.location}\n`;
      if (userProfile.bio) context += `- Bio: ${userProfile.bio}\n`;
      context += '\n';
    } else {
      // Fallback: try to get user profile from database
      try {
        const { data: profileData } = await supabase
          .from('users')
          .select('*')
          .eq('id', 'me')
          .single();
        if (profileData) {
          context += `Candidate Profile:\n- Name: ${profileData.full_name || 'Not specified'}\n`;
          if (profileData.title) context += `- Current Title: ${profileData.title}\n`;
          if (profileData.company) context += `- Current Company: ${profileData.company}\n`;
          if (profileData.location) context += `- Location: ${profileData.location}\n`;
          if (profileData.bio) context += `- Bio: ${profileData.bio}\n`;
          context += '\n';
        }
      } catch (profileError) {
        console.warn('Could not fetch user profile:', profileError);
      }
    }

    if (resumeData) {
      context += `Resume Information:\n- Title: ${resumeData.title}\n`;
      if (resumeData.focus_tags?.length) context += `- Focus Areas: ${resumeData.focus_tags.join(', ')}\n`;
      context += '\n';
    }

    if (Array.isArray(snippets) && snippets.length) {
      context += `Relevant Experience Snippets:\n`;
      snippets.forEach((snip, i) => { context += `${i + 1}. ${snip.content}\n`; });
      context += '\n';
    }

    const systemPrompt = `You are an expert job application writer. Write a professional cover letter in a ${tone} tone with ${length} length. 

IMPORTANT INSTRUCTIONS:
1. Use the candidate's profile information (name, current role, company, experience) to personalize the letter
2. Connect the candidate's background and skills to the specific job requirements
3. Reference specific skills from the job posting (must-haves and nice-to-haves)
4. Make the letter engaging and show genuine interest in the company and role
5. Use the candidate's actual name and current professional context
6. Format the letter professionally with proper paragraphs and structure

The cover letter should feel like it was written specifically for this candidate and this job.`;

    const userPrompt = `Write a professional cover letter for this job application:\n\n${context}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: length === 'short' ? 300 : length === 'medium' ? 600 : 1000,
      temperature: tone === 'creative' ? 0.8 : tone === 'professional' ? 0.3 : 0.5,
    });

    const coverLetter = completion.choices?.[0]?.message?.content || '';

    // Save to artifacts table if leadId provided
    if (leadId) {
      try {
        await supabase.from('artifacts').insert({
          lead_id: leadId,
          type: 'cover_letter',
          body_text: coverLetter,
          tone,
          length_hint: length,
        });
      } catch (saveError) {
        console.error('Failed to save cover letter:', saveError);
      }
    }

    res.json({
      success: true,
      coverLetter,
      usage: completion.usage,
    });
  } catch (e) {
    console.error('Cover letter generation error:', e);
    res.status(500).json({ success: false, error: e.message || 'Failed to generate cover letter' });
  }
});

/* ---------------------------- RESUME UPLOAD API --------------------------- */
// Old endpoint removed - using new endpoint below

/* ---------------------------- GMAIL APPLICATION SEND --------------------------- */

// OAuth2 Authorization Flow
app.get('/api/gmail/auth', (req, res) => {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const redirectUri = 'http://localhost:3001/api/gmail/callback';
      const scope = 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly';
  
  if (!clientId) {
    return res.status(400).json({ success: false, error: 'Gmail Client ID not configured' });
  }
  
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(scope)}` +
    `&response_type=code` +
    `&access_type=offline` +
    `&prompt=consent`;
  
  console.log('🔐 Redirecting to Google OAuth2:', authUrl);
  res.redirect(authUrl);
});

app.get('/api/gmail/callback', async (req, res) => {
  const { code, error } = req.query;
  
  if (error) {
    console.error('❌ OAuth2 error:', error);
    return res.status(400).send(`
      <html>
        <head><title>OAuth2 Error</title></head>
        <body>
          <h1>Authorization Failed</h1>
          <p>Error: ${error}</p>
          <p><a href="/">Return to application</a></p>
        </body>
      </html>
    `);
  }
  
  if (!code) {
    return res.status(400).send(`
      <html>
        <head><title>OAuth2 Error</title></head>
        <body>
          <h1>Authorization Failed</h1>
          <p>No authorization code received.</p>
          <p><a href="/">Return to application</a></p>
        </body>
      </html>
    `);
  }
  
  try {
    console.log('🔄 Exchanging authorization code for tokens...');
    
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    const redirectUri = 'http://localhost:3001/api/gmail/callback';
    
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    
    const { tokens } = await oauth2Client.getToken(code);
    
    if (!tokens.refresh_token) {
      throw new Error('No refresh token received. Make sure to include "prompt=consent" in the authorization URL.');
    }
    
    console.log('✅ Tokens received successfully!');
    console.log('Refresh Token:', tokens.refresh_token.substring(0, 20) + '...');
    
    // Update environment variable (for this session)
    process.env.GMAIL_REFRESH_TOKEN = tokens.refresh_token;
    
    // Get user's Gmail profile to store email
    const oauth2ClientForProfile = new google.auth.OAuth2(clientId, clientSecret);
    oauth2ClientForProfile.setCredentials({ refresh_token: tokens.refresh_token });
    const gmailForProfile = google.gmail({ version: 'v1', auth: oauth2ClientForProfile });
    
    let userEmail = '';
    try {
      const profile = await gmailForProfile.users.getProfile({ userId: 'me' });
      userEmail = profile.data.emailAddress;
      console.log('📧 Connected Gmail account:', userEmail);
    } catch (profileError) {
      console.warn('⚠️ Could not fetch Gmail profile, but tokens are valid');
      console.warn('⚠️ Profile error details:', profileError.message);
      
      // Try alternative method: check if we can get email from tokens
      if (tokens.email) {
        userEmail = tokens.email;
        console.log('📧 Using email from tokens:', userEmail);
      }
    }
    
    // Update settings in database
    const { error: updateError } = await supabase
      .from('settings')
      .upsert({
        user_id: 'me',
        gmail_refresh_token: tokens.refresh_token,
        gmail_connected: true,
        gmail_user_email: userEmail,
        updated_at: new Date().toISOString()
      });
    
    if (updateError) {
      console.error('❌ Failed to update settings:', updateError);
    } else {
      console.log('✅ Settings updated successfully in database');
    }
    
    // Redirect to frontend with success message
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5174';
    res.redirect(`${frontendUrl}/?gmail_auth=success&message=Gmail%20authorization%20successful`);
    
  } catch (error) {
    console.error('❌ Token exchange error:', error);
    // Redirect to frontend with error message
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5174';
    res.redirect(`${frontendUrl}/?gmail_auth=error&message=${encodeURIComponent(error.message)}`);
  }
});

// Fresh Gmail Implementation
app.post('/api/gmail/send-application', async (req, res) => {
  try {
    const { leadId, contactEmail, coverLetter, resumePath, subject } = req.body || {};
    
    console.log('📧 Gmail Send Application Request:', { leadId, contactEmail, subject, hasCoverLetter: !!coverLetter });
    
    if (!leadId || !contactEmail || !coverLetter) {
      return res.status(400).json({ success: false, error: 'Lead ID, contact email, and cover letter are required' });
    }

    // Get credentials from environment
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
      return res.status(400).json({ success: false, error: 'Gmail credentials not configured' });
    }

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Get lead details
    const { data: leadData } = await supabase
      .from('leads')
      .select('company, role')
      .eq('id', leadId)
      .single();

    const emailSubject = subject || `Application for ${leadData?.role || 'Position'} at ${leadData?.company || 'Company'}`;
    
    console.log('📧 Email Details:', { emailSubject, contactEmail });

    // Create email content with proper HTML formatting
    const htmlCoverLetter = coverLetter.replace(/\n/g, '<br>');
    
    const emailContent = [
      `To: ${contactEmail}`,
      `Subject: ${emailSubject}`,
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
      '',
      `<html><body>${htmlCoverLetter}</body></html>`,
    ].join('\n');

    let encodedEmail;
    
    if (resumePath) {
      console.log('📎 Resume attachment found:', resumePath);
      
      // Extract file path from Supabase URL
      let filePath = resumePath;
      if (resumePath.includes('/storage/v1/object/public/resumes/')) {
        // Extract just the filename from the full URL
        filePath = resumePath.split('/resumes/')[1];
      } else if (resumePath.includes('/storage/v1/object/public/')) {
        filePath = resumePath.split('/storage/v1/object/public/')[1];
      }
      
      console.log('📎 Extracted file path:', filePath);
      
      // Download resume from Supabase storage
      console.log('📎 Downloading resume from path:', filePath);
      const { data: resumeData, error: resumeError } = await supabase.storage
        .from('resumes')
        .download(filePath);
      
      console.log('📎 Download result:', { 
        hasData: !!resumeData, 
        dataType: typeof resumeData, 
        isBuffer: Buffer.isBuffer(resumeData),
        dataLength: resumeData?.length,
        error: resumeError 
      });
      
      if (resumeError) {
        console.warn('⚠️ Could not download resume for attachment:', resumeError);
        // Continue without attachment
        encodedEmail = Buffer.from(emailContent).toString('base64')
          .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      } else if (!resumeData) {
        console.warn('⚠️ No resume data received from download');
        // Continue without attachment
        encodedEmail = Buffer.from(emailContent).toString('base64')
          .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      } else {
        // Create multipart email with attachment
        const boundary = 'boundary_' + Math.random().toString(36).substring(2);
        
        const htmlCoverLetter = coverLetter.replace(/\n/g, '<br>');
        
        // Ensure resumeData is a Buffer
        let resumeBuffer = resumeData;
        if (!Buffer.isBuffer(resumeData)) {
          console.log('📎 Converting resume data to Buffer. Type:', typeof resumeData, 'Constructor:', resumeData?.constructor?.name);
          
          try {
            if (resumeData instanceof ArrayBuffer) {
              resumeBuffer = Buffer.from(resumeData);
            } else if (resumeData && typeof resumeData === 'object' && typeof resumeData.arrayBuffer === 'function') {
              // Handle Blob or Blob-like objects
              console.log('📎 Converting Blob-like object to Buffer...');
              const arrayBuffer = await resumeData.arrayBuffer();
              resumeBuffer = Buffer.from(arrayBuffer);
            } else if (typeof resumeData === 'string') {
              resumeBuffer = Buffer.from(resumeData, 'utf8');
            } else if (resumeData && typeof resumeData === 'object' && resumeData.data) {
              // If it's an object with data property
              resumeBuffer = Buffer.from(resumeData.data);
            } else {
              console.warn('⚠️ Unknown resume data type:', typeof resumeData, resumeData?.constructor?.name);
              // Last resort - try to convert to string and then to buffer
              resumeBuffer = Buffer.from(String(resumeData));
            }
          } catch (error) {
            console.error('❌ Failed to convert resume data to Buffer:', error);
            throw new Error(`Invalid resume data format: ${error.message}`);
          }
        }
        
        console.log('📎 Final resume buffer:', { 
          isBuffer: Buffer.isBuffer(resumeBuffer),
          length: resumeBuffer.length,
          firstBytes: resumeBuffer.slice(0, 20).toString('hex')
        });
        
        const multipartContent = [
          `To: ${contactEmail}`,
          `Subject: ${emailSubject}`,
          'MIME-Version: 1.0',
          `Content-Type: multipart/mixed; boundary="${boundary}"`,
          '',
          `--${boundary}`,
          'Content-Type: text/html; charset=utf-8',
          'Content-Transfer-Encoding: 7bit',
          '',
          `<html><body>${htmlCoverLetter}</body></html>`,
          '',
          `--${boundary}`,
          'Content-Type: application/pdf',
          'Content-Transfer-Encoding: base64',
          `Content-Disposition: attachment; filename="resume.pdf"`,
          '',
          resumeBuffer.toString('base64'),
          '',
          `--${boundary}--`
        ].join('\r\n');
        
        encodedEmail = Buffer.from(multipartContent).toString('base64')
          .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        
        console.log('📎 Resume attached successfully');
        console.log('📎 PDF data size:', resumeBuffer.length, 'bytes');
        console.log('📎 PDF base64 length:', resumeBuffer.toString('base64').length);
      }
    } else {
      // No resume attachment
      encodedEmail = Buffer.from(emailContent).toString('base64')
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    console.log('📤 Sending email via Gmail API...');
    
    // Send email
    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encodedEmail },
    });
    
    console.log('✅ Email sent successfully:', { messageId: result.data.id });
    
    // Track this as a system-generated email
    const messageId = result.data.id;
    const threadId = result.data.threadId || messageId; // Use threadId if available, fallback to messageId
    
    // Track by both messageId and threadId for compatibility
    systemGeneratedEmails.add(messageId);
    systemGeneratedEmails.add(threadId);
    
    // Store in thread tracking with system-generated flag
    threadTracking.set(threadId, {
      tracked: true,
      hiddenAt: null,
      systemGenerated: true,
      leadId: leadId,
      emailType: 'application'
    });
    
    // Also track by messageId for backward compatibility
    threadTracking.set(messageId, {
      tracked: true,
      hiddenAt: null,
      systemGenerated: true,
      leadId: leadId,
      emailType: 'application'
    });
    
            // Try to save to database
        try {
          await supabase
            .from('thread_tracking')
            .upsert({
              user_id: 'me',
              thread_id: threadId,
              tracked: true,
              system_generated: true,
              lead_id: leadId,
              email_type: 'application',
              created_at: new Date().toISOString()
            }, {
              onConflict: 'user_id,thread_id'
            });
          console.log(`✅ Thread ${threadId} marked as system-generated (persistent)`);
        } catch (dbError) {
          console.warn(`⚠️ Database save failed (using in-memory only):`, dbError.message);
          console.log(`✅ Thread ${threadId} marked as system-generated (in-memory)`);
        }
    
    // Update application status
    let applicationId = null;
    const { data: existingApp } = await supabase
      .from('applications')
      .select('id')
      .eq('lead_id', leadId)
      .single();

    if (!existingApp) {
      const { data: newApp } = await supabase
        .from('applications')
        .insert({
          lead_id: leadId,
          stage: 'applied',
          last_action_at: new Date().toISOString(),
        })
        .select()
        .single();
      applicationId = newApp?.id;
    } else {
      applicationId = existingApp.id;
    }

    // Store message record
    if (applicationId) {
      await supabase.from('messages').insert({
        application_id: applicationId,
        channel: 'email',
        direction: 'out',
        gmail_msg_id: result.data.id,
        subject: emailSubject,
        body_text: coverLetter,
        sent_at: new Date().toISOString(),
        read: true,
      });
    }

    res.json({ 
      success: true, 
      message: 'Application sent successfully', 
      messageId: result.data.id 
    });
  } catch (error) {
    console.error('❌ Gmail send error:', error);
    
    if (error.code === 401) {
      res.status(401).json({ success: false, error: 'Gmail authentication failed. Please check your OAuth2 credentials.' });
    } else if (error.code === 403) {
      res.status(403).json({ success: false, error: 'Gmail API access denied. Please check permissions.' });
    } else {
      res.status(500).json({ success: false, error: error.message || 'Failed to send application' });
    }
  }
});

// Test Gmail connection
app.post('/api/gmail/test-connection', async (req, res) => {
  try {
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

    console.log('🔍 Gmail Test Connection:');
    console.log('Client ID:', clientId ? '✅ Present' : '❌ Missing');
    console.log('Client Secret:', clientSecret ? '✅ Present' : '❌ Missing');
    console.log('Refresh Token:', refreshToken ? '✅ Present' : '❌ Missing');

    if (!clientId || !clientSecret || !refreshToken) {
      return res.status(400).json({ 
        success: false, 
        error: 'Gmail credentials not configured',
        missing: {
          clientId: !clientId,
          clientSecret: !clientSecret,
          refreshToken: !refreshToken
        }
      });
    }

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    console.log('🔐 Testing Gmail API connection...');
    
    // Test connection
    const profile = await gmail.users.getProfile({ userId: 'me' });
    
    console.log('✅ Gmail connection successful!');
    console.log('📧 Email:', profile.data.emailAddress);
    
    // Update settings to mark Gmail as connected
    try {
      const { error: updateError } = await supabase
        .from('settings')
        .upsert({
          user_id: 'me',
          gmail_connected: true,
          gmail_user_email: profile.data.emailAddress,
          updated_at: new Date().toISOString()
        });
      
      if (updateError) {
        console.warn('⚠️ Could not update settings:', updateError);
      } else {
        console.log('✅ Settings updated: Gmail marked as connected');
      }
    } catch (updateError) {
      console.warn('⚠️ Settings update failed:', updateError);
    }
    
    res.json({ 
      success: true, 
      message: 'Gmail connection successful',
      email: profile.data.emailAddress,
      messagesTotal: profile.data.messagesTotal
    });
  } catch (error) {
    console.error('❌ Gmail test connection error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to test Gmail connection' });
  }
});

/* ------------------------------ TEST ENDPOINTS -------------------------- */

// Get all resumes
app.get('/api/resumes', async (req, res) => {
  try {
    console.log('📚 Fetching resumes...');
    
    const { data: resumes, error } = await supabase
      .from('resumes')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ Error fetching resumes:', error);
      return res.status(500).json({ 
        success: false, 
        error: `Failed to fetch resumes: ${error.message}` 
      });
    }
    
    console.log('✅ Resumes fetched successfully:', resumes?.length || 0);
    
    res.json({ 
      success: true, 
      resumes: resumes || []
    });
    
  } catch (error) {
    console.error('❌ Resumes fetch error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch resumes',
      details: error.message 
    });
  }
});

// Resume upload endpoint
app.post('/api/upload-resume', async (req, res) => {
  try {
    console.log('📁 Resume upload request received');
    console.log('📁 Request body keys:', Object.keys(req.body));
    console.log('📁 Request body:', JSON.stringify(req.body, null, 2));
    
    const { fileName, fileSize, base64Data, contentType } = req.body;
    
    console.log('📁 Extracted values:', { 
      fileName: fileName ? `"${fileName}" (${typeof fileName})` : 'undefined', 
      fileSize: fileSize ? `${fileSize} (${typeof fileSize})` : 'undefined', 
      base64Data: base64Data ? `${base64Data.substring(0, 50)}... (${typeof base64Data}, length: ${base64Data?.length})` : 'undefined', 
      contentType: contentType ? `"${contentType}" (${typeof contentType})` : 'undefined' 
    });
    
    if (!fileName || !base64Data) {
      console.log('❌ Validation failed: fileName =', !!fileName, 'base64Data =', !!base64Data);
      return res.status(400).json({ 
        success: false, 
        error: 'File name and base64 data are required' 
      });
    }
    
    console.log('📁 Resume upload request validated:', { fileName, fileSize, contentType });
    
    // Convert base64 to buffer
    const bytes = Buffer.from(base64Data, 'base64');
    const storageFileName = `${Date.now()}_${fileName}`;
    
    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('resumes')
      .upload(storageFileName, bytes, { 
        contentType: contentType || 'application/pdf',
        upsert: false 
      });
    
    if (uploadError) {
      console.error('❌ Storage upload error:', uploadError);
      return res.status(500).json({ 
        success: false, 
        error: `Storage upload failed: ${uploadError.message}` 
      });
    }
    
    console.log('✅ File uploaded to storage:', uploadData);
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from('resumes')
      .getPublicUrl(storageFileName);
    
    const publicUrl = urlData.publicUrl;
    console.log('🔗 Generated public URL:', publicUrl);
    
    // Create resume entry in database
    const newResume = {
      title: fileName.replace('.pdf', ''),
      focus_tags: ['General'],
      file_url: publicUrl,
      size: fileSize,
      user_id: 'me',
      json_struct: {
        fileName: fileName,
        size: fileSize,
        uploadedAt: new Date().toISOString()
      }
    };
    
    console.log('💾 Creating resume entry:', newResume);
    
    const { data: resumeData, error: dbError } = await supabase
      .from('resumes')
      .insert(newResume)
      .select()
      .single();
    
    if (dbError) {
      console.error('❌ Database error:', dbError);
      return res.status(500).json({ 
        success: false, 
        error: `Database error: ${dbError.message}` 
      });
    }
    
    console.log('✅ Resume created successfully:', resumeData);
    
    res.json({ 
      success: true, 
      message: 'Resume uploaded successfully',
      resume: resumeData
    });
    
  } catch (error) {
    console.error('❌ Resume upload error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Upload failed',
      details: error.message 
    });
  }
});

// Delete resume endpoint
app.delete('/api/resumes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Resume ID is required' 
      });
    }
    
    console.log('🗑️ Deleting resume:', id);
    
    const { error } = await supabase
      .from('resumes')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('❌ Delete error:', error);
      return res.status(500).json({ 
        success: false, 
        error: `Failed to delete resume: ${error.message}` 
      });
    }
    
    console.log('✅ Resume deleted successfully');
    
    res.json({ 
      success: true, 
      message: 'Resume deleted successfully'
    });
    
  } catch (error) {
    console.error('❌ Resume delete error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Delete failed',
      details: error.message 
    });
  }
});

// Test Supabase connection
app.get('/api/test-supabase', async (req, res) => {
  try {
    console.log('🧪 Testing Supabase connection...');
    console.log('🔑 SUPABASE_URL:', process.env.SUPABASE_URL ? '✓ Set' : '✗ Missing');
    console.log('🔑 SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓ Set' : '✗ Missing');
    
    // Test basic connection
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    if (bucketError) {
      console.error('❌ Storage bucket test failed:', bucketError);
      return res.status(500).json({ 
        success: false, 
        error: 'Storage test failed',
        details: bucketError.message 
      });
    }
    
    console.log('✅ Storage buckets test successful');
    console.log('📦 Available buckets:', buckets.map(b => b.name));
    
    // Test resumes table access
    const { data: resumes, error: tableError } = await supabase
      .from('resumes')
      .select('count')
      .limit(1);
    
    if (tableError) {
      console.error('❌ Resumes table test failed:', tableError);
      return res.status(500).json({ 
        success: false, 
        error: 'Table test failed',
        details: tableError.message 
      });
    }
    
    console.log('✅ Resumes table test successful');
    
    res.json({ 
      success: true, 
      message: 'Supabase connection test successful',
      buckets: buckets.map(b => b.name),
      resumesTable: 'accessible'
    });
    
  } catch (error) {
    console.error('❌ Supabase test error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Test failed',
      details: error.message 
    });
  }
});

/* ------------------------ VECTOR DATABASE ENDPOINTS -------------------- */

// Upload and process document into vector database
app.post('/api/documents/upload', async (req, res) => {
  try {
    const { title, type, content, file_url, metadata = {} } = req.body;
    const userId = 'me'; // TODO: Get from auth when implemented

    console.log('📄 Vector document upload request:', { title, type });

    if (!title || !type) {
      return res.status(400).json({
        success: false,
        error: 'Title and type are required'
      });
    }

    if (!content && !file_url) {
      return res.status(400).json({
        success: false,
        error: 'Either content or file_url must be provided'
      });
    }

    // Process document
    const result = await documentProcessor.processDocument({
      user_id: userId,
      title,
      type,
      content,
      file_url,
      metadata
    });

    res.json({
      success: true,
      message: 'Document processed and stored in vector database',
      document: result.document,
      chunks: result.chunks
    });

  } catch (error) {
    console.error('❌ Vector document upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process document',
      details: error.message
    });
  }
});

// Generate AI email using vector search
app.post('/api/ai/generate-email', async (req, res) => {
  try {
    const {
      query,
      targetCompany,
      targetRole,
      focusAreas = [],
      emailType = 'application'
    } = req.body;
    
    const userId = 'me'; // TODO: Get from auth when implemented

    console.log('🤖 AI email generation request:', { targetCompany, targetRole, focusAreas });

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query is required'
      });
    }

    // Generate personalized email
    const email = await aiEmailGenerator.generatePersonalizedEmail({
      query,
      userId,
      targetCompany,
      targetRole,
      focusAreas,
      emailType
    });

    res.json({
      success: true,
      email: {
        subject: email.subject,
        body: email.body,
        aiSources: email.aiSources
      },
      sources: email.sources,
      metadata: email.metadata
    });

  } catch (error) {
    console.error('❌ AI email generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate email',
      details: error.message
    });
  }
});

// Search documents using vector similarity
app.post('/api/documents/search', async (req, res) => {
  try {
    const { query, documentType, threshold = 0.7, limit = 10 } = req.body;
    const userId = 'me'; // TODO: Get from auth when implemented

    console.log('🔍 Document search request:', { query, documentType });

    if (!query && threshold > 0.1) {
      return res.status(400).json({
        success: false,
        error: 'Query is required for similarity search. Use threshold <= 0.1 to get all chunks.'
      });
    }

    const results = await documentProcessor.searchSimilarChunks(query, {
      userId,
      documentType,
      threshold,
      limit
    });

    res.json({
      success: true,
      results,
      total: results.length,
      query,
      filters: { documentType, threshold, limit }
    });

  } catch (error) {
    console.error('❌ Document search error:', error);
    res.status(500).json({
      success: false,
      error: 'Search failed',
      details: error.message
    });
  }
});

// Get all documents for a user
app.get('/api/documents', async (req, res) => {
  try {
    const userId = 'me'; // TODO: Get from auth when implemented
    const { type } = req.query;

    console.log('📚 Getting documents for user:', userId, 'type:', type);

    let query = supabase
      .from('documents')
      .select(`
        *,
        document_chunks!inner(count)
      `)
      .eq('user_id', userId);

    if (type) {
      query = query.eq('type', type);
    }

    const { data: documents, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching documents:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch documents',
        details: error.message
      });
    }

    res.json({
      success: true,
      documents: documents || [],
      total: documents?.length || 0
    });

  } catch (error) {
    console.error('❌ Documents fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch documents',
      details: error.message
    });
  }
});

// Delete a document and its chunks
app.delete('/api/documents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = 'me'; // TODO: Get from auth when implemented

    console.log('🗑️ Deleting document:', id);

    // Check if document belongs to user
    const { data: document, error: checkError } = await supabase
      .from('documents')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (checkError || !document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found or access denied'
      });
    }

    // Delete document (chunks will be deleted by CASCADE)
    const { error: deleteError } = await supabase
      .from('documents')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('❌ Delete error:', deleteError);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete document',
        details: deleteError.message
      });
    }

    res.json({
      success: true,
      message: 'Document deleted successfully'
    });

  } catch (error) {
    console.error('❌ Document delete error:', error);
    res.status(500).json({
      success: false,
      error: 'Delete failed',
      details: error.message
    });
  }
});

// Lusha contact enrichment endpoint
app.post("/api/lusha/enrich-contact", async (req, res) => {
  try {
    const { firstName, lastName, company } = req.body;
    
    if (!firstName || !lastName || !company) {
      return res.status(400).json({ 
        success: false, 
        error: "firstName, lastName, and company are required" 
      });
    }

    // Use hardcoded Lusha API key for now
    const LUSHA_API_KEY = '828cd5f9-fb06-43c1-8221-ef95b0a56bcd';

    console.log(` Enriching contact: ${firstName} ${lastName} at ${company}`);

    // Call Lusha API with proper query parameters
    const url = `https://api.lusha.com/contact/find?firstName=${encodeURIComponent(firstName)}&lastName=${encodeURIComponent(lastName)}&company=${encodeURIComponent(company)}`;
    
    // Use the correct Lusha contact search API
    const lushaPayload = {
      pages: {
        page: 0,
        size: 10
      },
      filters: {
        contacts: {
          include: {
            existing_data_points: [
              "phone",
              "work_email",
              "mobile_phone",
              "linkedin_url"
            ]
          }
        },
        companies: {
          include: {
            names: [company]
          }
        }
      }
    };

    // Add name filters if provided
    if (firstName && lastName) {
      lushaPayload.filters.contacts.include.first_name = [firstName];
      lushaPayload.filters.contacts.include.last_name = [lastName];
    }

    console.log(`🔍 Calling Lusha contact search API for: ${firstName} ${lastName} at ${company}`);
    console.log(`📤 Lusha payload:`, JSON.stringify(lushaPayload, null, 2));

    const lushaResponse = await fetch('https://api.lusha.com/prospecting/contact/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api_key': LUSHA_API_KEY
      },
      body: JSON.stringify(lushaPayload)
    });

    if (!lushaResponse.ok) {
      const errorText = await lushaResponse.text();
      console.error(`Lusha API error: ${lushaResponse.status} - ${errorText}`);
      
      // If Lusha API fails, fall back to mock data for development
      console.log(`🔄 Falling back to mock data due to Lusha API error`);
      const mockData = {
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${company.toLowerCase().replace(/\s+/g, '')}.com`,
        phone: `+1-555-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
        title: "Senior Manager",
        linkedin_url: `https://linkedin.com/in/${firstName.toLowerCase()}-${lastName.toLowerCase()}-${Math.floor(Math.random() * 1000)}`
      };
      
      return res.json({
        success: true,
        data: mockData,
        note: "Mock data (Lusha API unavailable)"
      });
    }

    const lushaData = await lushaResponse.json();
    console.log(`✅ Lusha response:`, JSON.stringify(lushaData, null, 2));
    
    // Extract contact information from Lusha response
    let contactData = {
      email: null,
      phone: null,
      title: null,
      linkedin_url: null
    };

    // Initialize variables at the top level
    let contacts = [];
    let bestScore = 0;

    console.log(`🔍 Processing Lusha response...`);
    console.log(`📊 Response has data: ${!!lushaData.data}`);
    console.log(`📊 Data length: ${lushaData.data?.length || 0}`);
    console.log(`📊 Total results: ${lushaData.totalResults || 'N/A'}`);

    if (lushaData.data && lushaData.data.length > 0) {
      // Find the best matching contact based on name similarity and data availability
      contacts = lushaData.data.filter(contact => 
        contact.name && contact.name !== "Restricted" && 
        (contact.hasWorkEmail || contact.hasPhones || contact.hasSocialLink)
      );
      
      console.log(`🔍 Filtered contacts: ${contacts.length} valid contacts found`);
      
      if (contacts.length > 0) {
        // Smart contact matching: find the best match based on name similarity
        let bestContact = null;
        
        if (firstName && lastName) {
          // If we have specific names, find the best match
          const searchName = `${firstName} ${lastName}`.toLowerCase();
          
          contacts.forEach(contact => {
            const contactName = contact.name.toLowerCase();
            let score = 0;
            
            // Exact name match gets highest score
            if (contactName === searchName) {
              score = 100;
            } else {
              // Partial name matching
              const firstNameMatch = contactName.includes(firstName.toLowerCase()) || firstName.toLowerCase().includes(contactName.split(' ')[0]);
              const lastNameMatch = contactName.includes(lastName.toLowerCase()) || lastName.toLowerCase().includes(contactName.split(' ').slice(-1)[0]);
              
              if (firstNameMatch && lastNameMatch) score = 80;
              else if (firstNameMatch || lastNameMatch) score = 60;
              else if (contactName.includes(firstName.toLowerCase()) || contactName.includes(lastName.toLowerCase())) score = 40;
              
              // Bonus points for having more data
              if (contact.hasWorkEmail) score += 10;
              if (contact.hasPhones) score += 10;
              if (contact.hasSocialLink) score += 10;
              if (contact.jobTitle) score += 5;
            }
            
            if (score > bestScore) {
              bestScore = score;
              bestContact = contact;
            }
          });
          
          console.log(`🎯 Best contact match: ${bestContact?.name} (score: ${bestScore})`);
        } else {
          // If no specific names, pick the contact with most data
          bestContact = contacts.reduce((best, current) => {
            const currentScore = (current.hasWorkEmail ? 1 : 0) + (current.hasPhones ? 1 : 0) + (current.hasSocialLink ? 1 : 0);
            const bestScore = (best.hasWorkEmail ? 1 : 0) + (best.hasPhones ? 1 : 0) + (best.hasSocialLink ? 1 : 0);
            return currentScore > bestScore ? current : best;
          });
          console.log(`🎯 Selected contact with most data: ${bestContact.name}`);
        }
        
        if (bestContact) {
          console.log(`✅ Selected contact: ${bestContact.name} - ${bestContact.jobTitle} at ${bestContact.companyName}`);
          console.log(`📊 Data availability: Email: ${bestContact.hasWorkEmail}, Phone: ${bestContact.hasPhones}, LinkedIn: ${bestContact.hasSocialLink}`);
          
          // Extract data based on what's available
          contactData = {
            name: bestContact.name,
            title: bestContact.jobTitle || null,
            company: bestContact.companyName,
            // Note: Lusha API doesn't return actual email/phone in this response
            // It only indicates if they have the data (hasWorkEmail, hasPhones, etc.)
            email: bestContact.hasWorkEmail ? `${bestContact.name.toLowerCase().replace(/\s+/g, '.')}@${bestContact.fqdn || bestContact.companyName.toLowerCase().replace(/\s+/g, '')}.com` : null,
            phone: bestContact.hasPhones ? `+1-555-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}` : null,
            linkedin_url: bestContact.hasSocialLink ? `https://linkedin.com/in/${bestContact.name.toLowerCase().replace(/\s+/g, '-')}-${Math.floor(Math.random() * 1000)}` : null
          };
          
          console.log(`✅ Generated contact data:`, contactData);
          
          // If we have multiple contacts and want to return them all
          if (contacts.length > 1) {
            const allContacts = contacts.slice(0, 5).map(contact => ({
              name: contact.name,
              title: contact.jobTitle || null,
              company: contact.companyName,
              hasEmail: contact.hasWorkEmail,
              hasPhone: contact.hasPhones,
              hasLinkedIn: contact.hasSocialLink
            }));
            
            console.log(`📋 Found ${contacts.length} total contacts, showing top 5:`, allContacts);
          }
        } else {
          console.log(`❌ No suitable contact found after smart matching`);
        }
      } else {
        console.log(`❌ No valid contacts found after filtering`);
      }
    } else {
      console.log(`❌ No data in Lusha response`);
    }

    // If no data found, return appropriate message
    if (!contactData.email && !contactData.phone) {
      return res.json({
        success: false,
        message: "No contact information found for this person/company combination",
        data: null
      });
    }

    // Return all contacts for the modal to display
    const allContacts = contacts.slice(0, 10).map(contact => ({
      name: contact.name,
      title: contact.jobTitle || 'Not specified',
      company: contact.companyName,
      email: contact.hasWorkEmail ? `${contact.name.toLowerCase().replace(/\s+/g, '.')}@${contact.fqdn || contact.companyName.toLowerCase().replace(/\s+/g, '')}.com` : undefined,
      phone: contact.hasPhones ? `+1-555-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}` : undefined,
      linkedin_url: contact.hasSocialLink ? `https://linkedin.com/in/${contact.name.toLowerCase().replace(/\s+/g, '-')}-${Math.floor(Math.random() * 1000)}` : undefined,
      hasEmail: contact.hasWorkEmail,
      hasPhone: contact.hasPhones,
      hasLinkedIn: contact.hasSocialLink,
      score: contact.name.toLowerCase() === `${firstName} ${lastName}`.toLowerCase() ? 100 : 
             contact.name.toLowerCase().includes(firstName.toLowerCase()) && contact.name.toLowerCase().includes(lastName.toLowerCase()) ? 80 : 60
    }));

    res.json({
      success: true,
      data: allContacts,
      metadata: {
        totalContactsFound: lushaData.data?.length || 0,
        validContacts: contacts?.length || 0,
        matchScore: bestScore || 0,
        note: "Contact data generated based on Lusha's data availability indicators. Actual email/phone data requires additional Lusha API calls."
      }
    });
  } catch (error) {
    console.error("Lusha enrichment error:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message || "Failed to enrich contact" 
    });
  }
});

/* ------------------------------ NEW GMAIL ENDPOINTS ------------------------------ */

// Mark thread as untracked (hidden)
app.post('/api/gmail/thread/hide', async (req, res) => {
  const ROUTE = 'POST /api/gmail/thread/hide';
  const reqId = Math.random().toString(36).slice(2);
  
  try {
    const { threadId } = req.body;
    
    if (!threadId) {
      return res.status(400).json({ success: false, error: 'Thread ID is required' });
    }

    // Get existing tracking info to preserve system-generated flag
    const existingTracking = threadTracking.get(threadId);
    const isSystemGenerated = systemGeneratedEmails.has(threadId) || 
                             (existingTracking && existingTracking.systemGenerated === true);
    
    // Mark thread as hidden in database (if table exists)
    try {
      const { error: dbError } = await supabase
        .from('thread_tracking')
        .upsert({
          user_id: 'me',
          thread_id: threadId,
          tracked: false,
          system_generated: isSystemGenerated,
          lead_id: existingTracking?.leadId || null,
          email_type: existingTracking?.emailType || null,
          hidden_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,thread_id'
        });

      if (dbError) {
        console.warn(`[${reqId}] ⚠️ Database save failed (using in-memory only):`, dbError.message);
      } else {
        console.log(`[${reqId}] ✅ Thread saved to database`);
      }
    } catch (dbError) {
      console.warn(`[${reqId}] ⚠️ Database operation failed (using in-memory only):`, dbError.message);
    }

    // Update in-memory cache (preserve system-generated info)
    threadTracking.set(threadId, { 
      tracked: false, 
      hiddenAt: new Date().toISOString(),
      systemGenerated: isSystemGenerated,
      leadId: existingTracking?.leadId || null,
      emailType: existingTracking?.emailType || null
    });
    
    console.log(`[${reqId}] ✅ Thread ${threadId} marked as hidden (persistent)`);
    res.json({ success: true, message: 'Thread hidden successfully' });

  } catch (error) {
    console.error(`[${reqId}] ❌ ${ROUTE} error:`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to hide thread' 
    });
  }
});

// Get hidden threads (for debugging)
app.get('/api/gmail/threads/hidden', async (req, res) => {
  const ROUTE = 'GET /api/gmail/threads/hidden';
  const reqId = Math.random().toString(36).slice(2);
  
  try {
    // Try to get hidden threads from database
    let hiddenThreads = [];
    let useInMemory = false;
    
    try {
      const { data: dbHiddenThreads, error: dbError } = await supabase
        .from('thread_tracking')
        .select('thread_id, tracked, hidden_at, created_at')
        .eq('user_id', 'me')
        .eq('tracked', false)
        .order('hidden_at', { ascending: false });

      if (dbError) {
        console.warn(`[${reqId}] ⚠️ Database query failed, using in-memory:`, dbError.message);
        useInMemory = true;
      } else {
        hiddenThreads = dbHiddenThreads || [];
      }
    } catch (dbError) {
      console.warn(`[${reqId}] ⚠️ Database operation failed, using in-memory:`, dbError.message);
      useInMemory = true;
    }

    // Fallback to in-memory if database failed
    if (useInMemory) {
      hiddenThreads = Array.from(threadTracking.entries())
        .filter(([_, info]) => info.tracked === false)
        .map(([threadId, info]) => ({
          thread_id: threadId,
          tracked: info.tracked,
          hidden_at: info.hiddenAt,
          created_at: info.hiddenAt
        }));
    }

    const formattedThreads = hiddenThreads.map(thread => ({
      threadId: thread.thread_id,
      tracked: thread.tracked,
      hiddenAt: thread.hidden_at,
      createdAt: thread.created_at
    }));
    
    console.log(`[${reqId}] ✅ Found ${formattedThreads.length} hidden threads (${useInMemory ? 'in-memory' : 'database'})`);
    res.json({ success: true, hiddenThreads: formattedThreads });

  } catch (error) {
    console.error(`[${reqId}] ❌ ${ROUTE} error:`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to get hidden threads' 
    });
  }
});

// Get all sent Gmail threads (for Applications page)
app.get('/api/gmail/sent', async (req, res) => {
  const ROUTE = 'GET /api/gmail/sent';
  const reqId = Math.random().toString(36).slice(2);
  
  try {
    const { leadIds, max = 50 } = req.query;
    const leadIdsArray = leadIds ? leadIds.split(',') : [];
    const maxResults = parseInt(max) || 50;
    
    console.log(`[${reqId}] ${ROUTE} -> fetching sent threads, max: ${maxResults}, leadIds: ${leadIdsArray.join(',') || 'all'}`);

    // Use environment variables directly as requested
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
      return res.status(400).json({ success: false, error: 'Gmail credentials not configured' });
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Get sent messages
    const sentMessages = await gmail.users.messages.list({
      userId: 'me',
      labelIds: ['SENT'],
      maxResults: Math.min(maxResults, 100) // Gmail API limit
    });

    if (!sentMessages.data.messages) {
      return res.json({ success: true, threads: [] });
    }

    const threads = [];
    const processedThreadIds = new Set();

    for (const message of sentMessages.data.messages) {
      if (processedThreadIds.has(message.threadId)) continue;
      
      try {
        const threadDetails = await gmail.users.threads.get({
          userId: 'me',
          id: message.threadId,
          format: 'metadata',
          metadataHeaders: ['Subject', 'From', 'To', 'Date']
        });

        const messages = threadDetails.data.messages || [];
        const lastMessage = messages[messages.length - 1];
        const headers = lastMessage.payload?.headers || [];
        
        const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
        const from = headers.find(h => h.name === 'From')?.value || '';
        const to = headers.find(h => h.name === 'To')?.value || '';
        const cc = headers.find(h => h.name === 'Cc')?.value || '';
        const date = headers.find(h => h.name === 'Date')?.value || '';

        // Parse addresses properly
        const toAddresses = parseAddressList(to);
        const ccAddresses = parseAddressList(cc);
        const fromAddress = parseAddressList(from)[0] || { name: 'Unknown', email: 'unknown@example.com' };
        
        // Combine all recipients for display
        const allRecipients = getUniqueEmails([...toAddresses, ...ccAddresses]);
        
        // For now, we'll use a simple approach to identify lead associations
        // TODO: Implement proper lead-thread association logic
        const leadIds = [];

        // Check if thread is hidden
        const trackingInfo = threadTracking.get(message.threadId);
        if (trackingInfo && trackingInfo.tracked === false) {
          console.log(`[${reqId}] 🚫 Skipping hidden thread: ${message.threadId}`);
          processedThreadIds.add(message.threadId);
          continue; // Skip this thread
        }

        // Show all sent emails by default, but mark system-generated ones
        const isSystemGenerated = systemGeneratedEmails.has(message.threadId) || 
                                 (trackingInfo && trackingInfo.systemGenerated === true);
        
        // Log for debugging but don't skip
        if (isSystemGenerated) {
          console.log(`[${reqId}] ✅ System-generated thread: ${message.threadId}`);
        } else {
          console.log(`[${reqId}] 📧 Regular sent thread: ${message.threadId}`);
        }

        const threadSummary = {
          id: message.threadId,
          subject,
          recipients: allRecipients,
          snippet: lastMessage.snippet || 'No preview available',
          updatedAt: date ? new Date(date).toISOString() : new Date().toISOString(),
          leadIds,
          tracked: true // All visible threads are tracked
        };

        threads.push(threadSummary);
        processedThreadIds.add(message.threadId);

        if (threads.length >= maxResults) break;
      } catch (error) {
        console.warn(`[${reqId}] ⚠️ Could not fetch thread ${message.threadId}:`, error.message);
      }
    }

    // Sort by most recent
    threads.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    console.log(`[${reqId}] ✅ Found ${threads.length} sent threads`);
    res.json({ success: true, threads });

  } catch (error) {
    console.error(`[${reqId}] ❌ ${ROUTE} error:`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to fetch sent threads' 
    });
  }
});

// Get full thread with attachments
app.post('/api/gmail/thread/full', async (req, res) => {
  const ROUTE = 'POST /api/gmail/thread/full';
  const reqId = Math.random().toString(36).slice(2);
  
  try {
    const { threadId } = req.body;
    
    if (!threadId) {
      return res.status(400).json({ success: false, error: 'Thread ID is required' });
    }

    console.log(`[${reqId}] ${ROUTE} -> fetching full thread with attachments: ${threadId}`);

    // Use environment variables directly
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
      return res.status(400).json({ success: false, error: 'Gmail credentials not configured' });
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Get thread with full content
    let thread;
    try {
      thread = await gmail.users.threads.get({
        userId: 'me',
        id: threadId,
        format: 'full'
      });
      console.log(`[${reqId}] ✅ Successfully fetched thread with format: 'full'`);
    } catch (formatError) {
      console.warn(`[${reqId}] ⚠️ Full format failed, trying metadata:`, formatError.message);
      // Fallback to metadata format if full fails
      thread = await gmail.users.threads.get({
        userId: 'me',
        id: threadId,
        format: 'metadata',
        metadataHeaders: ['Subject', 'From', 'To', 'Cc', 'Date']
      });
      console.log(`[${reqId}] ✅ Fallback to metadata format successful`);
    }

    if (!thread.data.messages || thread.data.messages.length === 0) {
      return res.status(404).json({ success: false, error: 'Thread not found' });
    }

    const messages = thread.data.messages;
    const processedMessages = [];
    
    console.log(`[${reqId}] 📧 Processing ${messages.length} messages in thread`);

    for (const message of messages) {
      console.log(`[${reqId}] 📧 Processing message ${message.id}, payload type: ${message.payload?.mimeType || 'unknown'}`);
      
      const headers = message.payload?.headers || [];
      const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
      const from = headers.find(h => h.name === 'From')?.value || '';
      const to = headers.find(h => h.name === 'To')?.value || '';
      const cc = headers.find(h => h.name === 'Cc')?.value || '';
      const date = headers.find(h => h.name === 'Date')?.value || '';
      
      console.log(`[${reqId}] 📧 Message headers - Subject: "${subject}", From: "${from}", To: "${to}", Date: "${date}"`);

      // Parse addresses
      const fromAddress = parseAddressList(from)[0] || { name: 'Unknown', email: 'unknown@example.com' };
      const toAddresses = parseAddressList(to);
      const ccAddresses = parseAddressList(cc);

      // Extract body content
      let html = '';
      let text = '';
      
      if (message.payload?.body?.data) {
        const content = Buffer.from(message.payload.body.data, 'base64').toString('utf8');
                  if (message.payload.mimeType === 'text/html') {
            html = content;
            // Convert HTML to text with proper line breaks FIRST
            text = content.replace(/<br\s*\/?>/gi, '\n'); // Convert <br> to line breaks
            text = text.replace(/<\/p>/gi, '\n\n'); // Convert </p> to double line breaks
            text = text.replace(/<p[^>]*>/gi, ''); // Remove opening <p> tags
            text = text.replace(/<\/div>/gi, '\n'); // Convert </div> to line breaks
            text = text.replace(/<div[^>]*>/gi, ''); // Remove opening <div> tags
            // Then remove remaining HTML tags
            text = text.replace(/<[^>]*>/g, ''); // Remove HTML tags
            text = text.replace(/&nbsp;/g, ' '); // Replace &nbsp; with space
            text = text.replace(/&amp;/g, '&'); // Replace &amp; with &
            text = text.replace(/&lt;/g, '<'); // Replace &lt; with <
            text = text.replace(/&gt;/g, '>'); // Replace &gt; with >
            text = text.replace(/&quot;/g, '"'); // Replace &quot; with "
            // Clean up multiple line breaks
            text = text.replace(/\n\s*\n\s*\n/g, '\n\n'); // Replace 3+ line breaks with 2
          } else {
          text = content;
        }
        console.log(`[${reqId}] 📧 Direct body content - Type: ${message.payload.mimeType}, Length: ${content.length}`);
      } else if (message.payload?.parts) {
        console.log(`[${reqId}] 📧 Processing ${message.payload.parts.length} MIME parts`);
        for (const part of message.payload.parts) {
          if (part.body?.data) {
            const content = Buffer.from(part.body.data, 'base64').toString('utf8');
            if (part.mimeType === 'text/html') {
              html = content;
              // Convert HTML to text with proper line breaks if no text/plain content
              if (!text) {
                // Convert HTML to text with proper line breaks FIRST
                text = content.replace(/<br\s*\/?>/gi, '\n'); // Convert <br> to line breaks
                text = text.replace(/<\/p>/gi, '\n\n'); // Convert </p> to double line breaks
                text = text.replace(/<p[^>]*>/gi, ''); // Remove opening <p> tags
                text = text.replace(/<\/div>/gi, '\n'); // Convert </div> to line breaks
                text = text.replace(/<div[^>]*>/gi, ''); // Remove opening <div> tags
                // Then remove remaining HTML tags
                text = text.replace(/<[^>]*>/g, ''); // Remove HTML tags
                text = text.replace(/&nbsp;/g, ' '); // Replace &nbsp; with space
                text = text.replace(/&amp;/g, '&'); // Replace &amp; with &
                text = text.replace(/&lt;/g, '<'); // Replace &lt; with <
                text = text.replace(/&gt;/g, '>'); // Replace &gt; with >
                text = text.replace(/&quot;/g, '"'); // Replace &quot; with "
                // Clean up multiple line breaks
                text = text.replace(/\n\s*\n\s*\n/g, '\n\n'); // Replace 3+ line breaks with 2
              }
            } else if (part.mimeType === 'text/plain') {
              text = content;
            }
            console.log(`[${reqId}] 📧 Part content - Type: ${part.mimeType}, Length: ${content.length}`);
          }
        }
      }
      
      console.log(`[${reqId}] 📧 Extracted content - HTML: ${html.length} chars, Text: ${text.length} chars`);

      // Extract attachments
      const attachments = [];
      if (message.payload?.parts) {
        for (const part of message.payload.parts) {
          if (part.filename && part.body?.attachmentId) {
            try {
              const attachment = await gmail.users.messages.attachments.get({
                userId: 'me',
                messageId: message.id,
                id: part.body.attachmentId
              });

              if (attachment.data.data) {
                attachments.push({
                  id: part.body.attachmentId,
                  filename: part.filename,
                  mimeType: part.mimeType,
                  size: attachment.data.size || 0,
                  dataBase64: attachment.data.data,
                  contentId: part.headers?.find(h => h.name === 'Content-ID')?.value,
                  isInline: part.headers?.find(h => h.name === 'Content-Disposition')?.value?.includes('inline')
                });
              }
            } catch (error) {
              console.warn(`[${reqId}] ⚠️ Could not fetch attachment ${part.body.attachmentId}:`, error.message);
            }
          }
        }
      }

      processedMessages.push({
        id: message.id,
        from: fromAddress,
        to: toAddresses,
        cc: ccAddresses,
        date: date ? new Date(date).toISOString() : new Date().toISOString(),
        html,
        text,
        attachments,
        subject
      });
    }

    // Build thread object
    const lastMessage = processedMessages[processedMessages.length - 1];
    const allRecipients = getUniqueEmails([
      ...processedMessages.flatMap(m => [...m.to, ...(m.cc || [])])
    ]);

    const threadData = {
      id: threadId,
      subject: lastMessage?.subject || 'No Subject',
      recipients: allRecipients,
      messages: processedMessages,
      leadIds: [],
      updatedAt: lastMessage?.date || new Date().toISOString()
    };

    console.log(`[${reqId}] ✅ Fetched full thread: ${threadId}, messages: ${processedMessages.length}, attachments: ${processedMessages.reduce((sum, m) => sum + m.attachments.length, 0)}`);
    res.json({ success: true, thread: threadData });

  } catch (error) {
    console.error(`[${reqId}] ❌ ${ROUTE} error:`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to fetch full thread' 
    });
  }
});

// Get delta updates for sent threads (incremental refresh)
app.get('/api/gmail/sent/delta', async (req, res) => {
  const ROUTE = 'GET /api/gmail/sent/delta';
  const reqId = Math.random().toString(36).slice(2);
  
  try {
    const { sinceISO, leadIds, max = 100 } = req.query;
    
    if (!sinceISO) {
      return res.status(400).json({ success: false, error: 'sinceISO parameter is required' });
    }
    
    const sinceDate = new Date(sinceISO);
    const leadIdsArray = leadIds ? leadIds.split(',') : [];
    const maxResults = parseInt(max) || 100;
    
    console.log(`[${reqId}] ${ROUTE} -> fetching delta since ${sinceISO}, max: ${maxResults}`);

    // Use environment variables directly
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
      return res.status(400).json({ success: false, error: 'Gmail credentials not configured' });
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Get recent sent messages to check for updates
    const sentMessages = await gmail.users.messages.list({
      userId: 'me',
      labelIds: ['SENT'],
      maxResults: Math.min(maxResults, 100)
    });

    if (!sentMessages.data.messages) {
      return res.json({ success: true, added: [], updated: [], removed: [] });
    }

    const added = [];
    const updated = [];
    const processedThreadIds = new Set();

    for (const message of sentMessages.data.messages) {
      if (processedThreadIds.has(message.threadId)) continue;
      
      try {
        const threadDetails = await gmail.users.threads.get({
          userId: 'me',
          id: message.threadId,
          format: 'metadata',
          metadataHeaders: ['Subject', 'From', 'To', 'Date']
        });

        const messages = threadDetails.data.messages || [];
        const lastMessage = messages[messages.length - 1];
        const headers = lastMessage.payload?.headers || [];
        
        const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
        const from = headers.find(h => h.name === 'From')?.value || '';
        const to = headers.find(h => h.name === 'To')?.value || '';
        const cc = headers.find(h => h.name === 'Cc')?.value || '';
        const date = headers.find(h => h.name === 'Date')?.value || '';

        // Parse addresses properly
        const toAddresses = parseAddressList(to);
        const ccAddresses = parseAddressList(cc);
        const allRecipients = getUniqueEmails([...toAddresses, ...ccAddresses]);
        const leadIds = [];

        const threadSummary = {
          id: message.threadId,
          subject,
          recipients,
          snippet: lastMessage.snippet || 'No preview available',
          updatedAt: date ? new Date(date).toISOString() : new Date().toISOString(),
          leadIds
        };

        const threadDate = new Date(threadSummary.updatedAt);
        
        if (threadDate > sinceDate) {
          // This thread is newer than the last refresh
          if (threadDate.getTime() - sinceDate.getTime() < 24 * 60 * 60 * 1000) {
            // Within 24 hours, consider it an update
            updated.push(threadSummary);
          } else {
            // Older than 24 hours, consider it new
            added.push(threadSummary);
          }
        }
        
        processedThreadIds.add(message.threadId);
      } catch (error) {
        console.warn(`[${reqId}] ⚠️ Could not fetch thread ${message.threadId}:`, error.message);
      }
    }

    console.log(`[${reqId}] ✅ Delta: ${added.length} added, ${updated.length} updated`);
    res.json({ 
      success: true, 
      added, 
      updated, 
      removed: [] // Gmail doesn't provide deleted thread info easily
    });

  } catch (error) {
    console.error(`[${reqId}] ❌ ${ROUTE} error:`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to fetch delta' 
    });
  }
});

// NEW: Get complete threads including incoming replies (for full refresh)
app.get('/api/gmail/threads/complete', async (req, res) => {
  const ROUTE = 'GET /api/gmail/threads/complete';
  const reqId = Math.random().toString(36).slice(2);
  
  try {
    const { leadIds, max = 50 } = req.query;
    const leadIdsArray = leadIds ? leadIds.split(',') : [];
    const maxResults = parseInt(max) || 50;
    
    console.log(`[${reqId}] ${ROUTE} -> fetching complete threads, max: ${maxResults}`);

    // Use environment variables directly
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
      return res.status(400).json({ success: false, error: 'Gmail credentials not configured' });
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Get ALL threads (not just sent) to include incoming replies
    const allThreads = await gmail.users.threads.list({
      userId: 'me',
      maxResults: Math.min(maxResults, 100)
    });

    if (!allThreads.data.threads) {
      return res.json({ success: true, threads: [] });
    }

    const threads = [];
    const processedThreadIds = new Set();

    for (const thread of allThreads.data.threads) {
      if (processedThreadIds.has(thread.id)) continue;
      
      try {
        const threadDetails = await gmail.users.threads.get({
          userId: 'me',
          id: thread.id,
          format: 'metadata',
          metadataHeaders: ['Subject', 'From', 'To', 'Date', 'Cc']
        });

        const messages = threadDetails.data.messages || [];
        const lastMessage = messages[messages.length - 1];
        const headers = lastMessage.payload?.headers || [];
        
        const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
        const from = headers.find(h => h.name === 'From')?.value || '';
        const to = headers.find(h => h.name === 'To')?.value || '';
        const cc = headers.find(h => h.name === 'Cc')?.value || '';
        const date = headers.find(h => h.name === 'Date')?.value || '';

        // Parse addresses properly
        const toAddresses = parseAddressList(to);
        const ccAddresses = parseAddressList(cc);
        const fromAddress = parseAddressList(from)[0] || { name: 'Unknown', email: 'unknown@example.com' };
        
        // Combine all participants for display
        const allParticipants = getUniqueEmails([...toAddresses, ...ccAddresses, fromAddress]);
        
        // Check if this thread contains any sent messages (to identify as application thread)
        const hasSentMessage = messages.some(msg => {
          const msgHeaders = msg.payload?.headers || [];
          const msgFrom = msgHeaders.find(h => h.name === 'From')?.value || '';
          return msgFrom.toLowerCase().includes('jainrahulchaplot');
        });

        // Only include threads that have sent messages (application threads)
        if (hasSentMessage) {
          const threadSummary = {
            id: thread.id,
            subject,
            recipients: allParticipants,
            snippet: lastMessage.snippet || 'No preview available',
            updatedAt: date ? new Date(date).toISOString() : new Date().toISOString(),
            leadIds: [],
            messageCount: messages.length,
            hasIncomingReplies: messages.length > 1 // More than just the sent message
          };

          threads.push(threadSummary);
          processedThreadIds.add(thread.id);

          if (threads.length >= maxResults) break;
        }
      } catch (error) {
        console.warn(`[${reqId}] ⚠️ Could not fetch thread ${thread.id}:`, error.message);
      }
    }

    // Sort by most recent
    threads.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    console.log(`[${reqId}] ✅ Found ${threads.length} complete threads`);
    res.json({ success: true, threads });
    
  } catch (error) {
    console.error(`[${reqId}] ❌ ${ROUTE} error:`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to fetch complete threads' 
    });
  }
});

// AI draft reply endpoint
app.post('/api/ai/draft-reply', async (req, res) => {
  const ROUTE = 'POST /api/ai/draft-reply';
  const reqId = Math.random().toString(36).slice(2);
  
  try {
    const { threadId, maxMessages = 5, style = 'followup' } = req.body;
    
    if (!threadId) {
      return res.status(400).json({ success: false, error: 'Thread ID is required' });
    }

    console.log(`[${reqId}] ${ROUTE} -> generating AI draft for thread: ${threadId}, style: ${style}, maxMessages: ${maxMessages}`);

    // Use environment variables directly
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
      return res.status(400).json({ success: false, error: 'Gmail credentials not configured' });
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Get thread content for context
    const thread = await gmail.users.threads.get({
      userId: 'me',
      id: threadId,
      format: 'full' // Need full content for AI context
    });

    if (!thread.data.messages || thread.data.messages.length === 0) {
      return res.status(404).json({ success: false, error: 'Thread not found' });
    }

    const messages = thread.data.messages;
    const lastMessages = messages.slice(-Math.min(maxMessages, messages.length));
    
    // Build conversation context for AI
    const conversationContext = lastMessages.map(msg => {
      const headers = msg.payload?.headers || [];
      const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
      const date = headers.find(h => h.name === 'Date')?.value || '';
      const subject = headers.find(h => h.name === 'Subject')?.value || '';
      
      // Extract text content
      let textContent = '';
      if (msg.payload?.body?.data) {
        textContent = Buffer.from(msg.payload.body.data, 'base64').toString('utf8');
        // Preserve line breaks
        textContent = textContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      } else if (msg.payload?.parts) {
        // First try to find text/plain, then text/html
        let textPart = msg.payload.parts.find(part => part.mimeType === 'text/plain');
        if (!textPart) {
          textPart = msg.payload.parts.find(part => part.mimeType === 'text/html');
        }
        
        if (textPart?.body?.data) {
          textContent = Buffer.from(textPart.body.data, 'base64').toString('utf8');
          // Preserve line breaks
          textContent = textContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
          
          // If it's HTML, convert to plain text
          if (textPart.mimeType === 'text/html') {
            textContent = textContent.replace(/<[^>]*>/g, ''); // Remove HTML tags
            textContent = textContent.replace(/&nbsp;/g, ' '); // Replace &nbsp; with space
            textContent = textContent.replace(/&amp;/g, '&'); // Replace &amp; with &
            textContent = textContent.replace(/&lt;/g, '<'); // Replace &lt; with <
            textContent = textContent.replace(/&gt;/g, '>'); // Replace &gt; with >
            textContent = textContent.replace(/&quot;/g, '"'); // Replace &quot; with "
            // Convert common HTML line breaks to proper line breaks
            textContent = textContent.replace(/<br\s*\/?>/gi, '\n'); // Convert <br> to line breaks
            textContent = textContent.replace(/<\/p>/gi, '\n\n'); // Convert </p> to double line breaks
            textContent = textContent.replace(/<p[^>]*>/gi, ''); // Remove opening <p> tags
            textContent = textContent.replace(/<\/div>/gi, '\n'); // Convert </div> to line breaks
            textContent = textContent.replace(/<div[^>]*>/gi, ''); // Remove opening <div> tags
            // Clean up multiple line breaks
            textContent = textContent.replace(/\n\s*\n\s*\n/g, '\n\n'); // Replace 3+ line breaks with 2
          }
        }
      }
      
      // Fallback to snippet if no body content
      if (!textContent && msg.snippet) {
        textContent = msg.snippet;
      }
      
      // Sanitize and truncate (but preserve line breaks)
      textContent = textContent.substring(0, 1200);
      
      return {
        from,
        date: date ? new Date(date).toLocaleString() : 'Unknown time',
        subject,
        content: textContent
      };
    });

    // Get AI configuration for dynamic prompts and parameters
    const aiConfig = await getAIConfig();
    console.log(`🔧 AI draft reply using AI config: model=${aiConfig.defaults.model}, temperature=${aiConfig.defaults.temperature}`);
    
    // Build AI prompt using configuration
    const systemPrompt = aiConfig.prompts.thread_reply?.system || aiConfig.prompts.email_generation?.system || `You are an assistant drafting a concise, courteous email reply. Use the conversation below and keep it specific. Avoid repeating prior text. Prefer action-oriented next steps.`;
    
    // Build context for the AI
    const threadSummary = `Thread about: ${conversationContext[0]?.subject || 'No Subject'}. ${conversationContext.length} messages exchanged.`;
    const currentTask = `Generate a ${style} style reply that advances the conversation`;
    const messageHistory = conversationContext.map((msg, i) => 
      `Message ${i + 1} (${msg.from} - ${msg.date}): ${msg.content}`
    ).join('\n\n');
    const senderRole = 'applicant';
    
    // Use the thread_reply user template if available
    let userPrompt;
    if (aiConfig.prompts.thread_reply?.user_template) {
      userPrompt = aiConfig.prompts.thread_reply.user_template
        .replace('{thread_summary}', threadSummary)
        .replace('{current_task}', currentTask)
        .replace('{message_history}', messageHistory)
        .replace('{sender_role}', senderRole)
        .replace('{tone}', style);
    } else {
      // Fallback to the old format
      userPrompt = `Please draft a ${style} style reply based on this conversation context:\n\n${conversationContext.map((msg, i) => 
        `${i + 1}. From: ${msg.from}\n   Time: ${msg.date}\n   Subject: ${msg.subject}\n   Content: ${msg.content}\n`
      ).join('\n')}\n\nGenerate a professional reply that:`;
      
      let styleInstructions = '';
      if (style === 'short') {
        styleInstructions = '- Keep it under 80 words\n- Be direct and action-oriented\n- Ask for next steps';
      } else if (style === 'thankyou') {
        styleInstructions = '- Express gratitude\n- Keep it under 100 words\n- Professional and courteous';
      } else { // followup
        styleInstructions = '- Reference specific points from the conversation\n- Keep it under 150 words\n- Ask for next steps or meeting';
      }
      
      userPrompt += `\n${styleInstructions}\n\nReply:`;
    }

    // Use OpenAI API for actual AI generation
    try {
      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (!openaiApiKey) {
        throw new Error('OpenAI API key not configured');
      }
      
      const openai = new OpenAI({ apiKey: openaiApiKey });
      
      const completion = await openai.chat.completions.create({
        model: aiConfig.defaults.model || 'gpt-4o-mini',
        temperature: aiConfig.defaults.temperature || 0.7,
        max_tokens: aiConfig.defaults.max_tokens || 300,
        top_p: aiConfig.defaults.top_p || 0.9,
        presence_penalty: aiConfig.defaults.presence_penalty || 0.0,
        frequency_penalty: aiConfig.defaults.frequency_penalty || 0.0,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      });
      
      const draft = completion.choices?.[0]?.message?.content?.trim() || '';
      if (!draft) {
        throw new Error('Empty response from OpenAI');
      }
      
      // For thread_reply prompts, return the plain text directly
      // For email_generation prompts, try to parse JSON if present
      let finalDraft = draft;
      
      // Check if this is a thread_reply prompt (which should return plain text)
      if (systemPrompt.includes('thread_reply') || systemPrompt.includes('PLAIN TEXT format')) {
        // Thread reply should be plain text - clean up formatting
        let cleanedDraft = draft
          .replace(/^Subject:\s*.*$/gm, '') // Remove any subject lines
          .replace(/^\s*[\r\n]+/gm, '') // Remove leading empty lines
          .replace(/[\r\n]+\s*$/gm, '') // Remove trailing empty lines
          .replace(/\n\s*\n\s*\n/g, '\n\n') // Replace multiple empty lines with double line breaks
          .trim(); // Trim whitespace
        
        console.log(`[${reqId}] ✅ Generated thread reply (clean plain text): ${cleanedDraft.substring(0, 100)}...`);
        // Convert newlines to HTML breaks
        const htmlDraft = cleanedDraft.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');
        return res.json({ success: true, draft: htmlDraft });
      } else {
        // Email generation might return JSON - try to parse it
        try {
          const parsedDraft = JSON.parse(draft);
          if (parsedDraft.subject && parsedDraft.body) {
            finalDraft = parsedDraft.body; // Extract just the body for the draft
          }
        } catch (e) {
          // If JSON parsing fails, use the raw text
          console.log(`[${reqId}] ⚠️ JSON parsing failed, using raw text:`, e.message);
        }
      }
      
              console.log(`[${reqId}] ✅ Generated AI draft using OpenAI: ${finalDraft.substring(0, 100)}...`);
        // Convert newlines to HTML breaks
        const htmlDraft = finalDraft.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');
        return res.json({ success: true, draft: htmlDraft });
      
    } catch (openaiError) {
      console.warn(`[${reqId}] ⚠️ OpenAI generation failed, falling back to template:`, openaiError.message);
      
      // Fallback to template-based generation
      let draft = '';
      
      if (style === 'short') {
        draft = `Thanks for your response. I'm excited about this opportunity and would love to discuss it further. When would be a good time to connect?`;
      } else if (style === 'thankyou') {
        draft = `Thank you for considering my application. I appreciate the opportunity and look forward to hearing from you.`;
      } else { // followup
        draft = `Thank you for your response. I'm very interested in this role and would love to discuss how my experience aligns with your needs. When would be convenient for us to have a conversation?`;
      }

      // Add personalization based on conversation context
      const lastMessage = conversationContext[conversationContext.length - 1];
      if (lastMessage && lastMessage.subject.toLowerCase().includes('product manager')) {
        draft += `\n\nI have extensive experience in product management and would be happy to discuss specific examples of my work.`;
      }
      
              console.log(`[${reqId}] ✅ Generated fallback draft for thread: ${threadId} using ${conversationContext.length} messages`);
        // Convert newlines to HTML breaks
        const htmlDraft = draft.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');
        return res.json({ success: true, draft: htmlDraft });
    }

    console.log(`[${reqId}] ✅ Generated AI draft for thread: ${threadId} using ${conversationContext.length} messages`);
    res.json({ success: true, draft });

  } catch (error) {
    console.error(`[${reqId}] ❌ ${ROUTE} error:`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to generate AI draft' 
    });
  }
});

// Auto-followup agent endpoint
app.post('/api/ai/auto-followup', async (req, res) => {
  const ROUTE = 'POST /api/ai/auto-followup';
  const reqId = Math.random().toString(36).slice(2);
  
  try {
    const { threadId, leadId, action = 'schedule' } = req.body;
    
    if (!threadId) {
      return res.status(400).json({ success: false, error: 'Thread ID is required' });
    }

    console.log(`[${reqId}] ${ROUTE} -> ${action} auto-followup for thread: ${threadId}`);

    // Get AI configuration for follow-up generation
    let aiConfig;
    try {
      aiConfig = await getAIConfig();
      console.log(`[${reqId}] ✅ AI configuration loaded successfully`);
    } catch (configError) {
      console.error(`[${reqId}] ❌ Failed to load AI configuration:`, configError.message);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to load AI configuration: ' + configError.message 
      });
    }
    
    if (action === 'schedule') {
      // Get timing configuration from request
      const { followupDays = 3, followupHours = 0 } = req.body;
      
      // Calculate scheduled time
      const scheduledTime = new Date(Date.now() + 
        (followupDays * 24 * 60 * 60 * 1000) + 
        (followupHours * 60 * 60 * 1000)
      );
      
      // Schedule a new auto-followup
      const followupSchedule = {
        id: `followup_${Date.now()}`,
        threadId,
        leadId,
        scheduledAt: scheduledTime.toISOString(),
        status: 'scheduled',
        createdAt: new Date().toISOString(),
        followupDays,
        followupHours
      };
      
      // Store in database (for now, just return success)
      console.log(`[${reqId}] ✅ Scheduled auto-followup for thread: ${threadId} at ${followupSchedule.scheduledAt} (${followupDays}d ${followupHours}h)`);
      
      return res.json({ 
        success: true, 
        followup: followupSchedule,
        message: 'Auto-followup scheduled successfully'
      });
      
    } else if (action === 'trigger') {
      // Trigger immediate follow-up generation and sending
      try {
        // Initialize OpenAI client
        const settings = await getUserSettings();
        const resolvedKey = settings?.openai_api_key || process.env.OPENAI_API_KEY;
        if (!resolvedKey) {
          return res.status(400).json({ success: false, error: 'OpenAI API key not configured' });
        }
        const openai = new OpenAI({ apiKey: resolvedKey });
        
        // Initialize Gmail client
        const gmailSettings = await getUserSettings();
        if (!gmailSettings?.gmail_refresh_token) {
          return res.status(400).json({ success: false, error: 'Gmail not connected. Please connect Gmail first.' });
        }
        
        const { OAuth2Client } = await import('google-auth-library');
        const oauth2Client = new OAuth2Client(
          gmailSettings.gmail_client_id,
          gmailSettings.gmail_client_secret
        );
        oauth2Client.setCredentials({
          refresh_token: gmailSettings.gmail_refresh_token
        });
        
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
        
        console.log(`[${reqId}] 🔧 Generating AI follow-up with config:`, {
          model: aiConfig.defaults?.model,
          temperature: aiConfig.defaults?.temperature,
          systemPrompt: aiConfig.prompts?.thread_reply?.system?.substring(0, 100) + '...'
        });
        
        // Fetch thread data to provide context to the AI
        const threadResponse = await gmail.users.threads.get({
          userId: 'me',
          id: threadId,
          format: 'metadata',
          metadataHeaders: ['Subject', 'From', 'To', 'Date']
        });
        
        const thread = threadResponse.data;
        if (!thread.messages || thread.messages.length === 0) {
          throw new Error('No messages found in thread');
        }
        
        // Extract thread context from metadata
        const messages = thread.messages;
        const firstMessage = messages[0];
        const lastMessage = messages[messages.length - 1];
        
        // Get subject and basic context
        const subject = firstMessage.payload?.headers?.find(h => h.name === 'Subject')?.value || 'No Subject';
        // Clean subject by removing "Re:" prefixes
        const cleanSubject = subject.replace(/^Re:\s*/i, '').trim();
        const companyMatch = cleanSubject.match(/at\s+([^(]+)/i);
        const company = companyMatch ? companyMatch[1].trim() : 'the company';
        const roleMatch = cleanSubject.match(/for\s+([^a]+?)\s+at/i);
        const role = roleMatch ? roleMatch[1].trim() : 'the position';
        
        // Build thread summary
        const threadSummary = `This is a job application thread for ${role} at ${company}. The thread has ${messages.length} messages.`;
        
        // Get recent message content for context (using snippets from metadata)
        const recentMessages = messages.slice(-3).map(msg => {
          const from = msg.payload?.headers?.find(h => h.name === 'From')?.value || 'Unknown';
          const content = msg.snippet || 'No content available';
          return `${from}: ${content}`;
        }).join('\n');
        
        // Generate AI follow-up message using "Generate Next Message" prompt with real context
        const systemPrompt = aiConfig.prompts?.thread_reply?.system || 
          'You are an expert email strategist and professional communicator. Your task is to generate the next message in an ongoing email thread that continues the conversation naturally and professionally.';
        
        const userPrompt = `Thread Context: ${threadSummary}
Current Task: Generate a professional follow-up message for a job application
Previous Messages: ${recentMessages}
Your Role: Job applicant
Tone: professional
Company: ${company}
Position: ${role}

Generate a professional, concise follow-up email that shows continued interest and asks for updates on the application status. 

IMPORTANT: 
1. Return ONLY the email body content as plain text. Do not include subject line or any other formatting.
2. Do NOT return JSON format - return only the plain text message body.
3. Use proper paragraph breaks with double line breaks (\\n\\n) between paragraphs.
4. Focus on the message content only.
5. Keep the tone professional and concise.`;
        
        const completion = await openai.chat.completions.create({
          model: aiConfig.defaults?.model || 'gpt-4o-mini',
          temperature: aiConfig.defaults?.temperature || 0.7,
          max_tokens: aiConfig.defaults?.max_tokens || 300,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ]
        });
        
        console.log(`[${reqId}] ✅ OpenAI completion received:`, completion.choices?.[0]?.message?.content?.substring(0, 100) + '...');
        
        let followupMessage = completion.choices?.[0]?.message?.content?.trim() || '';
        
        if (!followupMessage) {
          throw new Error('Empty response from OpenAI');
        }
        
        // Handle case where OpenAI returns JSON despite our instructions
        if (followupMessage.startsWith('{') && followupMessage.includes('"body"')) {
          try {
            const parsed = JSON.parse(followupMessage);
            followupMessage = parsed.body || followupMessage;
          } catch (e) {
            // If parsing fails, use the original message
            console.warn(`[${reqId}] ⚠️ Failed to parse JSON response, using as-is:`, e.message);
          }
        }
        
        // Send the follow-up email using Gmail API
        try {
          // Use the thread data we already fetched above
          const lastMessage = messages[messages.length - 1];
          const messageResponse = await gmail.users.messages.get({
            userId: 'me',
            id: lastMessage.id,
            format: 'metadata',
            metadataHeaders: ['From', 'To', 'Subject']
          });
          
          const headers = messageResponse.data.payload.headers;
          const fromHeader = headers.find(h => h.name === 'From');
          const toHeader = headers.find(h => h.name === 'To');
          const subjectHeader = headers.find(h => h.name === 'Subject');
          
          if (!fromHeader || !toHeader) {
            throw new Error('Could not determine email addresses');
          }
          
          // Extract email addresses
          const fromEmail = fromHeader.value.match(/<(.+?)>/)?.[1] || fromHeader.value;
          const toEmail = toHeader.value.match(/<(.+?)>/)?.[1] || toHeader.value;
          
          // Determine who to send to (if we sent the last email, reply to the other person)
          const recipientEmail = fromEmail.includes('jainrahulchaplot@gmail.com') ? toEmail : fromEmail;
          
          // Create the email message with clean subject
          const cleanSubjectHeader = subjectHeader?.value?.replace(/^Re:\s*/i, '') || 'Follow-up';
          const emailContent = `From: ${fromEmail}\r\nTo: ${recipientEmail}\r\nSubject: Re: ${cleanSubjectHeader}\r\n\r\n${followupMessage}`;
          const encodedMessage = Buffer.from(emailContent).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
          
          // Send the email
          const sendResponse = await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
              raw: encodedMessage,
              threadId: threadId
            }
          });
          
          const messageId = sendResponse.data.id;
          console.log(`[${reqId}] ✅ Auto-followup email sent successfully: ${messageId}`);
          
          // Track this as a system-generated followup email
          systemGeneratedEmails.add(messageId);
          systemGeneratedEmails.add(threadId);
          
          // Store in thread tracking
          threadTracking.set(threadId, {
            tracked: true,
            hiddenAt: null,
            systemGenerated: true,
            leadId: null, // Will be updated when we have lead context
            emailType: 'followup'
          });
          
          // Try to save to database
          try {
            await supabase
              .from('thread_tracking')
              .upsert({
                user_id: 'me',
                thread_id: threadId,
                tracked: true,
                system_generated: true,
                lead_id: null,
                email_type: 'followup',
                created_at: new Date().toISOString()
              }, {
                onConflict: 'user_id,thread_id'
              });
            console.log(`[${reqId}] ✅ Followup thread ${threadId} marked as system-generated (persistent)`);
          } catch (dbError) {
            console.warn(`[${reqId}] ⚠️ Database save failed (using in-memory only):`, dbError.message);
            console.log(`[${reqId}] ✅ Followup thread ${threadId} marked as system-generated (in-memory)`);
          }
          
          return res.json({ 
            success: true, 
            message: 'Auto-followup generated and sent successfully',
            followup: formatEmailBody(followupMessage, 'text'),
            emailId: messageId
          });
          
        } catch (emailError) {
          console.error(`[${reqId}] ❌ Failed to send auto-followup email:`, emailError.message);
          return res.status(500).json({ 
            success: false, 
            error: 'Failed to send email: ' + emailError.message,
            followup: followupMessage // Return the generated message even if sending failed
          });
        }
        
      } catch (openaiError) {
        console.warn(`[${reqId}] ⚠️ OpenAI generation failed:`, openaiError.message);
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to generate auto-followup message' 
        });
      }
    }
    
  } catch (error) {
    console.error(`[${reqId}] ❌ ${ROUTE} error:`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to process auto-followup request' 
    });
  }
});

// Get auto-followup schedules for a thread
app.get('/api/ai/auto-followup/:threadId', async (req, res) => {
  const ROUTE = 'GET /api/ai/auto-followup/:threadId';
  const reqId = Math.random().toString(36).slice(2);
  
  try {
    const { threadId } = req.params;
    
    console.log(`[${reqId}] ${ROUTE} -> fetching auto-followup schedules for thread: ${threadId}`);
    
    // TODO: Fetch from database
    // For now, return mock data
    const mockSchedules = [
      {
        id: 'followup_1',
        threadId,
        scheduledAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'scheduled'
      }
    ];
    
    console.log(`[${reqId}] ✅ Found ${mockSchedules.length} auto-followup schedules`);
    res.json({ success: true, schedules: mockSchedules });
    
  } catch (error) {
    console.error(`[${reqId}] ❌ ${ROUTE} error:`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to fetch auto-followup schedules' 
    });
  }
});

// Get all leads endpoint
app.get('/api/leads', async (req, res) => {
  const ROUTE = 'GET /api/leads';
  const reqId = Math.random().toString(36).slice(2);
  
  try {
    console.log(`[${reqId}] ${ROUTE} -> fetching all leads`);

    // TODO: Replace with actual leads from your database
    // For now, return mock data structure
    const leads = [
      { id: 'lead-1', name: 'John Smith', email: 'john.smith@tide.com' },
      { id: 'lead-2', name: 'Sarah Johnson', email: 'sarah.j@uber.com' },
      { id: 'lead-3', name: 'Mike Chen', email: 'mike.chen@google.com' }
    ];

    console.log(`[${reqId}] ✅ Found ${leads.length} leads`);
    res.json({ success: true, leads });

  } catch (error) {
    console.error(`[${reqId}] ❌ ${ROUTE} error:`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to fetch leads' 
    });
  }
});

/* ------------------------------ AI CONFIGURATION ENDPOINTS -------------------------- */

// Get AI configuration
app.get('/api/ai-config', async (req, res) => {
  const ROUTE = 'GET /api/ai-config';
  const reqId = Math.random().toString(36).slice(2);
  
  try {
    console.log(`[${reqId}] ${ROUTE} -> fetching AI configuration`);
    
    // Try to fetch from vector database first
    try {
      const { data: aiConfigDocs, error: fetchError } = await supabase
        .from('documents')
        .select('*')
        .eq('type', 'note')
        .ilike('title', 'AI Configuration')
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (!fetchError && aiConfigDocs && aiConfigDocs.length > 0) {
        const storedConfig = aiConfigDocs[0];
        console.log(`[${reqId}] ✅ Found stored AI configuration in vector database`);
        
        // Parse the stored configuration
        let config;
        try {
          config = JSON.parse(storedConfig.content);
          config.meta = { 
            lastSavedISO: storedConfig.created_at,
            source: 'vector_database'
          };
        } catch (parseError) {
          console.warn(`[${reqId}] ⚠️ Failed to parse stored config, using default`);
          config = null;
        }
        
        if (config) {
          // Merge with default config to ensure all required fields exist
          const defaultConfig = {
            defaults: {
              tone: 'honest',
              length: 'medium',
              model: 'gpt-4o-mini',
              temperature: 0.7,
              top_p: 0.9,
              max_tokens: 1500,
              presence_penalty: 0.0,
              frequency_penalty: 0.0,
              safety: {
                sanitizeHTML: true,
                stripPII: true
              }
            },
            prompts: {
              email_generation: {
                system: "You are an expert job application strategist. Your task is to generate a HIGHLY PERSONALIZED email that uses SPECIFIC details from the candidate's resume and knowledge base. CRITICAL REQUIREMENTS: 1. You MUST use the EXACT personal details provided in the knowledge base chunks 2. You MUST reference specific projects, companies, skills, and achievements from the resume",
                user_template: "Job Details: Company: {company} Role: {role} Location: {location}",
                notes: "Template for structuring the job and context information sent to AI"
              },
              company_research: {
                system: "You are a business research analyst. Research the company and provide comprehensive information in a structured format. Focus on industry positioning, recent developments, and key insights that would be relevant for a job application.",
                notes: "This prompt defines how the AI researches companies"
              },
              fit_analysis: {
                system: "You are a career assessment specialist. Analyze the fit between the candidate's background and the job requirements. Provide specific insights about strengths, potential challenges, and actionable advice for the application.",
                notes: "This prompt defines how the AI analyzes job fit"
              },
              thread_reply: {
                system: "You are an expert email strategist and professional communicator. Your task is to generate the next message in an ongoing email thread that continues the conversation naturally and professionally. CRITICAL REQUIREMENTS: 1. You MUST read and understand the complete thread context - all previous messages, their tone, content, and purpose 2. You MUST maintain the professional tone and style established in the thread 3. You MUST reference specific details from previous messages to show you've read them 4. You MUST advance the conversation purposefully - whether it's following up, asking questions, providing updates, or closing 5. You MUST be concise but comprehensive - typically 2-4 sentences 6. You MUST include appropriate greetings and closings based on the thread context 7. You MUST NOT repeat information unnecessarily - build on what's already been said 8. You MUST respond in PLAIN TEXT format - no JSON, no subject lines, no extra formatting 9. You MUST format the message cleanly with proper spacing: one blank line between paragraphs, no extra line breaks 10. You MUST start directly with the greeting (Dear Hiring Team, etc.) and end with the signature",
                user_template: "Thread Context: {thread_summary} Current Task: {current_task} Previous Messages: {message_history} Your Role: {sender_role} Tone: {tone}",
                notes: "Template for generating contextual replies in email threads (returns clean plain text without subject lines)"
              },

            },
            overrides: {
              gmail: { enabled: false },
              linkedin: { enabled: false },
              ats: { enabled: false },
              notion: { enabled: false },
              slack: { enabled: false }
            },
            meta: { 
              lastSavedISO: new Date().toISOString(),
              source: 'default'
            }
          };

          // Deep merge stored config with defaults
          const mergedConfig = {
            defaults: { ...defaultConfig.defaults, ...config.defaults },
            prompts: { ...defaultConfig.prompts, ...config.prompts },
            overrides: { ...defaultConfig.overrides, ...config.overrides },
            meta: { ...defaultConfig.meta, ...config.meta }
          };

          return res.json({ success: true, config: mergedConfig });
        }
      }
    } catch (dbError) {
      console.warn(`[${reqId}] ⚠️ Database fetch failed, using default config:`, dbError.message);
    }
    
    // Fallback to default configuration
    const config = {
      defaults: {
        tone: 'honest',
        length: 'medium',
        model: 'gpt-4o-mini',
        temperature: 0.7,
        top_p: 0.9,
        max_tokens: 1500,
        presence_penalty: 0.0,
        frequency_penalty: 0.0,
        safety: {
          sanitizeHTML: true,
          stripPII: true
        }
      },
      prompts: {
        email_generation: {
          system: "You are an expert job application strategist. Your task is to generate a HIGHLY PERSONALIZED email that uses SPECIFIC details from the candidate's resume and knowledge base. CRITICAL REQUIREMENTS: 1. You MUST use the EXACT personal details provided in the knowledge base chunks 2. You MUST reference specific projects, companies, skills, and achievements from the resume",
          user_template: "Job Details: Company: {company} Role: {role} Location: {location}",
          notes: "Template for structuring the job and context information sent to AI"
        },
        company_research: {
          system: "You are a business research analyst. Research the company and provide comprehensive information in a structured format. Focus on industry positioning, recent developments, and key insights that would be relevant for a job application.",
          notes: "This prompt defines how the AI researches companies"
        },
        fit_analysis: {
          system: "You are a career assessment specialist. Analyze the fit between the candidate's background and the job requirements. Provide specific insights about strengths, potential challenges, and actionable advice for the application.",
          notes: "This prompt defines how the AI analyzes job fit"
        },
        thread_reply: {
          system: "You are an expert email strategist and professional communicator. Your task is to generate the next message in an ongoing email thread that continues the conversation naturally and professionally. CRITICAL REQUIREMENTS: 1. You MUST read and understand the complete thread context - all previous messages, their tone, content, and purpose 2. You MUST maintain the professional tone and style established in the thread 3. You MUST reference specific details from previous messages to show you've read them 4. You MUST advance the conversation purposefully - whether it's following up, asking questions, providing updates, or closing 5. You MUST be concise but comprehensive - typically 2-4 sentences 6. You MUST include appropriate greetings and closings based on the thread context 7. You MUST NOT repeat information unnecessarily - build on what's already been said 8. You MUST respond in valid JSON format with the following structure: {\"subject\": \"Re: [Original Subject]\", \"body\": \"Your reply message content\"}. CRITICAL: Your response must be ONLY valid JSON. Do not include any other text, explanations, or formatting outside the JSON object.",
          user_template: "Thread Context: {thread_summary} Current Task: {current_task} Previous Messages: {message_history} Your Role: {sender_role} Tone: {tone}",
          notes: "Template for generating contextual replies in email threads"
        }
      },
      overrides: {
        gmail: { enabled: false },
        linkedin: { enabled: false },
        ats: { enabled: false },
        notion: { enabled: false },
        slack: { enabled: false }
      },
      meta: { 
        lastSavedISO: new Date().toISOString(),
        source: 'default'
      }
    };

    console.log(`[${reqId}] ✅ AI configuration fetched successfully (using default)`);
    res.json({ success: true, config });
    
  } catch (error) {
    console.error(`[${reqId}] ❌ ${ROUTE} error:`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to fetch AI configuration' 
    });
  }
});

// Update AI configuration
app.put('/api/ai-config', async (req, res) => {
  const ROUTE = 'PUT /api/ai-config';
  const reqId = Math.random().toString(36).slice(2);
  
  try {
    console.log(`[${reqId}] ${ROUTE} -> updating AI configuration`);
    
    const config = req.body;
    
    // Validate required fields
    if (!config.defaults || !config.prompts) {
      return res.status(400).json({
        success: false,
        error: 'Missing required configuration sections'
      });
    }
    
    // Validate prompts have system messages
    for (const [key, prompt] of Object.entries(config.prompts)) {
      if (!prompt.system || prompt.system.trim() === '') {
        return res.status(400).json({
          success: false,
          error: `System prompt is required for ${key}`
        });
      }
    }
    
    // Save to vector database
    try {
      const configContent = JSON.stringify(config, null, 2);
      
      // Store in vector database - first delete existing, then insert new
      await supabase
        .from('documents')
        .delete()
        .eq('title', 'AI Configuration')
        .eq('user_id', 'default-user');
      
      const { data: vectorDoc, error: vectorError } = await supabase
        .from('documents')
        .insert({
          title: 'AI Configuration',
          content: configContent,
          type: 'note', // Use valid type from documents table
          user_id: 'default-user', // Use same pattern as working function
          metadata: {
            key: 'main_config',
            version: Date.now(),
            user_id: 'default-user'
          }
        })
        .select()
        .single();
      
      if (vectorError) {
        console.error(`[${reqId}] ❌ Failed to save AI config to vector database:`, vectorError);
        return res.status(500).json({
          success: false,
          error: 'Failed to save configuration to database'
        });
      }
      
      const updatedConfig = {
        ...config,
        meta: { 
          lastSavedISO: new Date().toISOString(),
          source: 'vector_database',
          documentId: vectorDoc.id
        }
      };

      console.log(`[${reqId}] ✅ AI configuration saved successfully to vector database: ${vectorDoc.id}`);
      res.json({ success: true, config: updatedConfig });
      
    } catch (dbError) {
      console.error(`[${reqId}] ❌ Database save error:`, dbError);
      res.status(500).json({
        success: false,
        error: 'Failed to save configuration to database'
      });
    }
    
  } catch (error) {
    console.error(`[${reqId}] ❌ ${ROUTE} error:`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to update AI configuration' 
    });
  }
});

// Test AI configuration
app.post('/api/ai-config/test', async (req, res) => {
  const ROUTE = 'POST /api/ai-config/test';
  const reqId = Math.random().toString(36).slice(2);
  
  try {
    console.log(`[${reqId}] ${ROUTE} -> testing AI configuration`);
    
    const { promptType, integration, variables, dryRun } = req.body;
    
    if (!promptType) {
      return res.status(400).json({
        success: false,
        error: 'Prompt type is required'
      });
    }
    
    if (dryRun) {
      // Return mock result for dry run
      const mockResult = {
        ok: true,
        output: `[DRY RUN] This is a test output for ${promptType} prompt type`,
        tokens: { prompt: 100, completion: 150, total: 250 },
        latencyMs: 0
      };
      
      console.log(`[${reqId}] ✅ Dry run completed successfully`);
      return res.json({ success: true, ...mockResult });
    }
    
    // Implement actual AI test with OpenAI
    try {
      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (!openaiApiKey) {
        return res.status(400).json({
          success: false,
          error: 'OpenAI API key not configured'
        });
      }
      
      const openai = new OpenAI({ apiKey: openaiApiKey });
      
      // Get AI configuration
      const aiConfig = await getAIConfig();
      
      // Build test prompt based on prompt type
      let systemPrompt, userPrompt;
      
      switch (promptType) {
        case 'email_generation':
          systemPrompt = aiConfig.prompts.email_generation.system;
          userPrompt = `Test email generation with variables: ${JSON.stringify(variables || {})}`;
          break;
        case 'company_research':
          systemPrompt = aiConfig.prompts.company_research.system;
          userPrompt = `Test company research for: ${variables?.company || 'Test Company'}`;
          break;
        case 'fit_analysis':
          systemPrompt = aiConfig.prompts.fit_analysis.system;
          userPrompt = `Test fit analysis with variables: ${JSON.stringify(variables || {})}`;
          break;
        default:
          systemPrompt = 'You are a helpful AI assistant.';
          userPrompt = `Test prompt with variables: ${JSON.stringify(variables || {})}`;
      }
      
      const startTime = Date.now();
      
      const completion = await openai.chat.completions.create({
        model: aiConfig.defaults.model || 'gpt-4o-mini',
        temperature: aiConfig.defaults.temperature || 0.7,
        max_tokens: aiConfig.defaults.max_tokens || 500,
        top_p: aiConfig.defaults.top_p || 0.9,
        presence_penalty: aiConfig.defaults.presence_penalty || 0.0,
        frequency_penalty: aiConfig.defaults.frequency_penalty || 0.0,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      });
      
      const endTime = Date.now();
      const latencyMs = endTime - startTime;
      
      const output = completion.choices?.[0]?.message?.content?.trim() || '';
      const tokens = completion.usage || { prompt: 0, completion: 0, total: 0 };
      
      const testResult = {
        ok: true,
        output,
        tokens,
        latencyMs,
        config: {
          model: aiConfig.defaults.model,
          temperature: aiConfig.defaults.temperature,
          max_tokens: aiConfig.defaults.max_tokens
        }
      };
      
      console.log(`[${reqId}] ✅ AI test completed successfully with ${tokens.total} tokens`);
      return res.json({ success: true, ...testResult });
      
    } catch (openaiError) {
      console.error(`[${reqId}] ❌ AI test failed:`, openaiError);
      return res.status(500).json({
        success: false,
        error: `AI test failed: ${openaiError.message}`,
        details: openaiError.response?.data || openaiError.message
      });
    }

    console.log(`[${reqId}] ✅ AI test completed successfully`);
    res.json({ success: true, ...testResult });
    
  } catch (error) {
    console.error(`[${reqId}] ❌ ${ROUTE} error:`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to test AI configuration' 
    });
  }
});

// Get AI configuration versions
app.get('/api/ai-config/versions', async (req, res) => {
  const ROUTE = 'GET /api/ai-config/versions';
  const reqId = Math.random().toString(36).slice(2);
  
  try {
    console.log(`[${reqId}] ${ROUTE} -> fetching AI configuration versions`);
    
    // TODO: Replace with actual database fetch
    // For now, return empty versions list
    const versions = [];

    console.log(`[${reqId}] ✅ Found ${versions.length} versions`);
    res.json({ success: true, versions });
    
  } catch (error) {
    console.error(`[${reqId}] ❌ ${ROUTE} error:`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to fetch AI configuration versions' 
    });
  }
});

// Create AI configuration version
app.post('/api/ai-config/versions', async (req, res) => {
  const ROUTE = 'POST /api/ai-config/versions';
  const reqId = Math.random().toString(36).slice(2);
  
  try {
    console.log(`[${reqId}] ${ROUTE} -> creating AI configuration version`);
    
    const { name, notes } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Version name is required'
      });
    }
    
    // TODO: Replace with actual database save
    // For now, return mock version
    const version = {
      id: `v${Date.now()}`,
      name,
      notes: notes || '',
      createdBy: 'admin',
      createdAt: new Date().toISOString()
    };

    console.log(`[${reqId}] ✅ Version created successfully: ${version.id}`);
    res.json({ success: true, version });
    
  } catch (error) {
    console.error(`[${reqId}] ❌ ${ROUTE} error:`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to create AI configuration version' 
    });
  }
});

// Rollback to AI configuration version
app.post('/api/ai-config/versions/rollback', async (req, res) => {
  const ROUTE = 'POST /api/ai-config/versions/rollback';
  const reqId = Math.random().toString(36).slice(2);
  
  try {
    console.log(`[${reqId}] ${ROUTE} -> rolling back to AI configuration version`);
    
    const { versionId } = req.body;
    
    if (!versionId) {
      return res.status(400).json({
        success: false,
        error: 'Version ID is required'
      });
    }
    
    // TODO: Replace with actual database rollback
    // For now, return success
    console.log(`[${reqId}] ✅ Rollback to version ${versionId} completed successfully`);
    res.json({ success: true, message: `Rolled back to version ${versionId}` });
    
  } catch (error) {
    console.error(`[${reqId}] ❌ ${ROUTE} error:`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to rollback AI configuration' 
    });
  }
});

/* ------------------------------ ERROR HANDLERS -------------------------- */

app.use((error, req, res, next) => {
  console.error('❌ Unhandled server error:', {
    message: error?.message,
    stack: error?.stack,
    path: req?.path,
    method: req?.method,
  });

  if (!res.headersSent) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error?.message || 'An unexpected error occurred',
      debug: {
        timestamp: new Date().toISOString(),
        path: req?.path,
        method: req?.method,
      },
    });
  }
});

// Gmail OAuth callback endpoint
app.get('/auth/google/callback', (req, res) => {
  const { code } = req.query;
  
  if (!code) {
    return res.status(400).send(`
      <html>
        <body>
          <h1>Error: No authorization code received</h1>
          <p>Please try again.</p>
          <script>
            window.opener.postMessage({ type: 'oauth_callback', error: 'No authorization code' }, '*');
            window.close();
          </script>
        </body>
      </html>
    `);
  }
  
  // Send the code back to the opener window
  res.send(`
    <html>
      <body>
        <h1>Authorization successful!</h1>
        <p>You can close this window now.</p>
        <script>
          window.opener.postMessage({ type: 'oauth_callback', code: '${code}' }, '*');
          window.close();
        </script>
      </body>
    </html>
  `);
});

app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
    debug: {
      timestamp: new Date().toISOString(),
      availableRoutes: [
        'GET  /api/health',
        'GET  /api/settings',
        'POST /api/settings',
  'POST /api/update-gmail-creds',
        'POST /api/openai/test',
        'POST /api/openai/process-image',
        'POST /api/openai/process-multiple-images',
        'POST /api/openai/parse-url',
        'POST /api/openai/company-research',
        'POST /api/openai/fit-analysis',
        'POST /api/openai/generate-email-draft',
        'POST /api/gmail/test-send',
        'POST /api/gmail/send',
        'POST /api/gmail/send-application',
        'POST /api/gmail/test-connection',
        'POST /api/gmail/applications',
        'POST /api/gmail/thread',
        'POST /api/generate-content',
        'POST /api/generate-cover-letter',
        'POST /api/upload-resume',
        'POST /api/lusha/enrich-contact',
        'GET  /api/leads',
        'GET  /api/leads/:id',
        'PUT  /api/leads/:id',
        'POST /api/leads',
        'GET  /api/ai-config',
        'PUT  /api/ai-config',
        'POST /api/ai-config/test',
        'GET  /api/ai-config/versions',
        'POST /api/ai-config/versions',
        'POST /api/ai-config/versions/rollback',
        'GET  /auth/google/callback',
      ],
    },
  });
});

/* --------------------------------- START -------------------------------- */

app.listen(PORT, async () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/api/health`);
  
  // Initialize thread tracking
  await initializeThreadTracking();
});

/* --------------------------- DELETE ENDPOINTS ------------------------- */

// Delete a lead and all related data
app.delete('/api/leads/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🗑️ DELETE /api/leads/${id} -> deleting lead and all related data`);
    
    // Delete in order due to foreign key constraints
    // 1. Delete messages (via applications)
    const { data: applications } = await supabase
      .from('applications')
      .select('id')
      .eq('lead_id', id);
    
    if (applications && applications.length > 0) {
      const applicationIds = applications.map(app => app.id);
      
      // Delete messages
      const { error: messagesError } = await supabase
        .from('messages')
        .delete()
        .in('application_id', applicationIds);
      
      if (messagesError) {
        console.error('❌ Error deleting messages:', messagesError);
      }
      
      // Delete application_contacts
      const { error: appContactsError } = await supabase
        .from('application_contacts')
        .delete()
        .in('application_id', applicationIds);
      
      if (appContactsError) {
        console.error('❌ Error deleting application_contacts:', appContactsError);
      }
      
      // Delete applications
      const { error: applicationsError } = await supabase
        .from('applications')
        .delete()
        .eq('lead_id', id);
      
      if (applicationsError) {
        console.error('❌ Error deleting applications:', applicationsError);
      }
    }
    
    // 2. Delete contacts
    const { error: contactsError } = await supabase
      .from('contacts')
      .delete()
      .eq('lead_id', id);
    
    if (contactsError) {
      console.error('❌ Error deleting contacts:', contactsError);
    }
    
    // 3. Delete artifacts
    const { error: artifactsError } = await supabase
      .from('artifacts')
      .delete()
      .eq('lead_id', id);
    
    if (artifactsError) {
      console.error('❌ Error deleting artifacts:', artifactsError);
    }
    
    // 4. Delete files
    const { error: filesError } = await supabase
      .from('files')
      .delete()
      .eq('linked_lead_id', id);
    
    if (filesError) {
      console.error('❌ Error deleting files:', filesError);
    }
    
    // 5. Finally delete the lead
    const { error: leadError } = await supabase
      .from('leads')
      .delete()
      .eq('id', id);
    
    if (leadError) {
      console.error('❌ Error deleting lead:', leadError);
      return res.status(500).json({ success: false, error: leadError.message });
    }
    
    console.log(`✅ Lead ${id} and all related data deleted successfully`);
    res.json({ success: true, message: 'Lead and all related data deleted successfully' });
    
  } catch (error) {
    console.error('💥 Error deleting lead:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to delete lead' });
  }
});

// Delete a specific application and its messages
app.delete('/api/applications/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🗑️ DELETE /api/applications/${id} -> deleting application and messages`);
    
    // Delete messages first
    const { error: messagesError } = await supabase
      .from('messages')
      .delete()
      .eq('application_id', id);
    
    if (messagesError) {
      console.error('❌ Error deleting messages:', messagesError);
    }
    
    // Delete application_contacts
    const { error: appContactsError } = await supabase
      .from('application_contacts')
      .delete()
      .eq('application_id', id);
    
    if (appContactsError) {
      console.error('❌ Error deleting application_contacts:', appContactsError);
    }
    
    // Delete the application
    const { error: applicationError } = await supabase
      .from('applications')
      .delete()
      .eq('id', id);
    
    if (applicationError) {
      console.error('❌ Error deleting application:', applicationError);
      return res.status(500).json({ success: false, error: applicationError.message });
    }
    
    console.log(`✅ Application ${id} and messages deleted successfully`);
    res.json({ success: true, message: 'Application and messages deleted successfully' });
    
  } catch (error) {
    console.error('💥 Error deleting application:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to delete application' });
  }
});

// Delete a specific message thread
app.delete('/api/messages/:applicationId', async (req, res) => {
  try {
    const { applicationId } = req.params;
    console.log(`🗑️ DELETE /api/messages/${applicationId} -> deleting all messages for application`);
    
    const { error: messagesError } = await supabase
      .from('messages')
      .delete()
      .eq('application_id', applicationId);
    
    if (messagesError) {
      console.error('❌ Error deleting messages:', messagesError);
      return res.status(500).json({ success: false, error: messagesError.message });
    }
    
    console.log(`✅ All messages for application ${applicationId} deleted successfully`);
    res.json({ success: true, message: 'Message thread deleted successfully' });
    
  } catch (error) {
    console.error('💥 Error deleting messages:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to delete messages' });
  }
});
