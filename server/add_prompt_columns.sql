-- Add missing prompt columns to settings table
ALTER TABLE settings 
ADD COLUMN IF NOT EXISTS email_generation_system_prompt TEXT,
ADD COLUMN IF NOT EXISTS email_generation_user_prompt_template TEXT,
ADD COLUMN IF NOT EXISTS company_research_system_prompt TEXT,
ADD COLUMN IF NOT EXISTS fit_analysis_system_prompt TEXT;

-- Add default values for the new columns
UPDATE settings 
SET 
  email_generation_system_prompt = 'You are an elite job-application strategist and copy-crafter. Your job is to produce a HIGH-IMPACT, NON-GENERIC cold email cover letter that lands a memorable first impression in under 250–300 words (unless a custom limit is given).',
  email_generation_user_prompt_template = 'Job Details:\nCompany: {company}\nRole: {role}\nLocation: {location}\nSeniority: {seniority}\nDescription: {description}\nMust Haves: {must_haves}\nNice to Haves: {nice_to_haves}\nKeywords: {keywords}\n\nHiring Contact:\nName: {contact_name}\nTitle: {contact_title}\nEmail: {contact_email}\n\nOutput Controls:\nTone: {tone}\nRisk_Appetite: {risk_appetite}\nOpener_Style: {opener_style}\nWord_Limit: {word_limit}\nCTA_Style: {cta_style}\n\nCustom Context (optional, company research snippets):\n{custom_context}\n\n🚨 MANDATORY: KNOWLEDGE BASE (the candidate''s ACTUAL resume & details). Use ONLY these facts:\n{knowledge_chunks}',
  company_research_system_prompt = 'You are a business research analyst. Research the company and provide comprehensive information in a structured format. Focus on industry positioning, recent developments, and key insights that would be relevant for a job application.',
  fit_analysis_system_prompt = 'You are a career assessment specialist. Analyze the fit between the candidate''s background and the job requirements. Provide specific insights about strengths, potential challenges, and actionable advice for the application.'
WHERE user_id = 'me';
