import { DocumentProcessor } from './documentProcessor.js';

class AIEmailGenerator {
  constructor(openaiApiKey, supabaseClient) {
    this.openaiApiKey = openaiApiKey;
    this.supabase = supabaseClient;
    this.documentProcessor = new DocumentProcessor(openaiApiKey, supabaseClient);
  }

  /**
   * Generate a personalized email using vector search and AI
   */
  async generatePersonalizedEmail(request) {
    try {
      const {
        query,
        userId,
        targetCompany,
        targetRole,
        focusAreas = [],
        emailType = 'application' // 'application', 'cold_outreach', 'follow_up'
      } = request;

      console.log('🤖 Generating personalized email for:', { targetCompany, targetRole });

      // 1. Build search query from user request
      const searchQuery = this.buildSearchQuery(query, targetCompany, targetRole, focusAreas);
      console.log('🔍 Search query:', searchQuery);

      // 2. Search for relevant context from user's documents
      const relevantChunks = await this.searchRelevantContext(searchQuery, userId, focusAreas);
      
      // 3. Structure the context for AI
      const structuredContext = this.structureContext(relevantChunks);
      
      // 4. Generate email using AI with context
      const email = await this.generateEmailWithAI({
        query,
        context: structuredContext,
        targetCompany,
        targetRole,
        focusAreas,
        emailType
      });

      // 5. Add source citations
      const emailWithSources = {
        ...email,
        sources: this.extractSources(relevantChunks),
        metadata: {
          chunksUsed: relevantChunks.length,
          searchQuery,
          generatedAt: new Date().toISOString()
        }
      };

      console.log('✅ Generated personalized email with', relevantChunks.length, 'context chunks');
      return emailWithSources;

    } catch (error) {
      console.error('❌ Email generation error:', error);
      throw error;
    }
  }

  /**
   * Build optimized search query
   */
  buildSearchQuery(userQuery, company, role, focusAreas) {
    const queryParts = [userQuery];
    
    if (company) queryParts.push(company);
    if (role) queryParts.push(role);
    if (focusAreas.length > 0) queryParts.push(...focusAreas);
    
    // Add relevant keywords for better matching
    queryParts.push('experience', 'skills', 'achievements', 'projects');
    
    return queryParts.join(' ');
  }

  /**
   * Search for relevant context across different document types
   */
  async searchRelevantContext(searchQuery, userId, focusAreas) {
    const allChunks = [];

    try {
      // Search in different document types with different strategies
      
      // 1. Resume - prioritize skills and experience
      const resumeChunks = await this.documentProcessor.searchSimilarChunks(
        `${searchQuery} skills experience achievements`, 
        {
          userId,
          documentType: 'resume',
          threshold: 0.6,
          limit: 8
        }
      );
      allChunks.push(...resumeChunks);

      // 2. Personal info - for personality and preferences
      const personalChunks = await this.documentProcessor.searchSimilarChunks(
        `${searchQuery} preferences goals strengths values`, 
        {
          userId,
          documentType: 'personal_info',
          threshold: 0.6,
          limit: 4
        }
      );
      allChunks.push(...personalChunks);

      // 3. Company research - if we have info about target company
      const companyChunks = await this.documentProcessor.searchSimilarChunks(
        searchQuery, 
        {
          userId,
          documentType: 'company_research',
          threshold: 0.7,
          limit: 3
        }
      );
      allChunks.push(...companyChunks);

      // 4. Previous job descriptions - for role understanding
      const jobDescChunks = await this.documentProcessor.searchSimilarChunks(
        `${searchQuery} requirements responsibilities`, 
        {
          userId,
          documentType: 'job_description',
          threshold: 0.6,
          limit: 3
        }
      );
      allChunks.push(...jobDescChunks);

      // 5. Notes - for additional insights
      const noteChunks = await this.documentProcessor.searchSimilarChunks(
        searchQuery, 
        {
          userId,
          documentType: 'note',
          threshold: 0.6,
          limit: 2
        }
      );
      allChunks.push(...noteChunks);

      // Sort by relevance and remove duplicates
      const uniqueChunks = this.deduplicateChunks(allChunks);
      const sortedChunks = uniqueChunks.sort((a, b) => b.similarity - a.similarity);

      console.log(`📋 Found ${sortedChunks.length} relevant chunks from ${allChunks.length} total`);
      return sortedChunks.slice(0, 15); // Limit total chunks for context window

    } catch (error) {
      console.error('❌ Context search error:', error);
      return [];
    }
  }

  /**
   * Remove duplicate chunks based on content similarity
   */
  deduplicateChunks(chunks) {
    const unique = [];
    const seen = new Set();

    for (const chunk of chunks) {
      // Create a simple hash of the content for deduplication
      const contentHash = chunk.content.substring(0, 100).toLowerCase().replace(/\s+/g, '');
      
      if (!seen.has(contentHash)) {
        seen.add(contentHash);
        unique.push(chunk);
      }
    }

    return unique;
  }

  /**
   * Structure context for AI prompt
   */
  structureContext(chunks) {
    const context = {
      resume: {
        skills: [],
        experience: [],
        achievements: [],
        education: [],
        projects: []
      },
      personal: {
        background: [],
        preferences: [],
        goals: [],
        strengths: [],
        values: []
      },
      company: {
        overview: [],
        culture: [],
        products: [],
        tech_stack: [],
        news: []
      },
      other: []
    };

    for (const chunk of chunks) {
      const { chunk_type, content, document_type } = chunk;
      
      if (document_type === 'resume') {
        if (context.resume[chunk_type]) {
          context.resume[chunk_type].push(content);
        } else {
          context.resume.experience.push(content); // default to experience
        }
      } else if (document_type === 'personal_info') {
        if (context.personal[chunk_type]) {
          context.personal[chunk_type].push(content);
        } else {
          context.personal.background.push(content);
        }
      } else if (document_type === 'company_research') {
        if (context.company[chunk_type]) {
          context.company[chunk_type].push(content);
        } else {
          context.company.overview.push(content);
        }
      } else {
        context.other.push(content);
      }
    }

    return context;
  }

  /**
   * Generate email using OpenAI with structured context
   */
  async generateEmailWithAI({ query, context, targetCompany, targetRole, focusAreas, emailType }) {
    try {
      const prompt = this.buildEmailPrompt({
        query,
        context,
        targetCompany,
        targetRole,
        focusAreas,
        emailType
      });

      console.log('🤖 Sending request to OpenAI...');

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: this.getSystemPrompt()
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const data = await response.json();
      const aiResponse = data.choices[0].message.content;

      // Parse the AI response into structured format
      return this.parseEmailResponse(aiResponse, targetRole);

    } catch (error) {
      console.error('❌ AI generation error:', error);
      throw error;
    }
  }

  /**
   * Build detailed prompt for AI
   */
  buildEmailPrompt({ query, context, targetCompany, targetRole, focusAreas, emailType }) {
    let prompt = `Generate a ${emailType} email based on the following request and context:\n\n`;
    
    prompt += `REQUEST: ${query}\n\n`;
    prompt += `TARGET: ${targetRole} at ${targetCompany}\n`;
    if (focusAreas.length > 0) {
      prompt += `FOCUS AREAS: ${focusAreas.join(', ')}\n`;
    }
    prompt += '\n';

    // Add resume context
    if (context.resume.skills.length > 0) {
      prompt += `MY SKILLS:\n${context.resume.skills.join('\n')}\n\n`;
    }
    if (context.resume.experience.length > 0) {
      prompt += `MY EXPERIENCE:\n${context.resume.experience.join('\n')}\n\n`;
    }
    if (context.resume.achievements.length > 0) {
      prompt += `MY ACHIEVEMENTS:\n${context.resume.achievements.join('\n')}\n\n`;
    }

    // Add personal context
    if (context.personal.goals.length > 0) {
      prompt += `MY GOALS:\n${context.personal.goals.join('\n')}\n\n`;
    }
    if (context.personal.strengths.length > 0) {
      prompt += `MY STRENGTHS:\n${context.personal.strengths.join('\n')}\n\n`;
    }

    // Add company context
    if (context.company.overview.length > 0) {
      prompt += `ABOUT ${targetCompany}:\n${context.company.overview.join('\n')}\n\n`;
    }
    if (context.company.culture.length > 0) {
      prompt += `${targetCompany} CULTURE:\n${context.company.culture.join('\n')}\n\n`;
    }

    // Add other relevant context
    if (context.other.length > 0) {
      prompt += `ADDITIONAL CONTEXT:\n${context.other.join('\n')}\n\n`;
    }

    prompt += `Generate a personalized, professional email that demonstrates strong alignment with the role and company. Include specific examples from the context above.`;

    return prompt;
  }

  /**
   * System prompt for AI email generation
   */
  getSystemPrompt() {
    return `You are an expert email writer specializing in job applications and professional outreach. Your task is to generate personalized, compelling emails that demonstrate strong alignment between the candidate and the opportunity.

GUIDELINES:
1. Keep emails concise (150-250 words)
2. Be professional yet warm and authentic
3. Lead with value and specific examples
4. Demonstrate clear understanding of the role/company
5. Include a clear call to action
6. Use the provided context to personalize content
7. Avoid generic templates or overused phrases
8. Focus on outcomes and measurable impact

OUTPUT FORMAT:
Subject: [Compelling subject line]

[Email body]

SOURCES USED: [Brief note about which context was most helpful]

Remember: The goal is to stand out while being genuine and relevant.`;
  }

  /**
   * Parse AI response into structured format
   */
  parseEmailResponse(aiResponse, targetRole = 'this position') {
    const lines = aiResponse.split('\n').filter(line => line.trim());
    
    let subject = '';
    let body = '';
    let aiSources = '';
    
    let currentSection = 'body';
    
    for (const line of lines) {
      if (line.startsWith('Subject:')) {
        subject = line.replace('Subject:', '').trim();
        currentSection = 'body';
      } else if (line.startsWith('SOURCES USED:')) {
        aiSources = line.replace('SOURCES USED:', '').trim();
        currentSection = 'sources';
      } else if (currentSection === 'body' && line.trim()) {
        body += line + '\n';
      }
    }

    return {
      subject: subject || 'Application for ' + targetRole,
      body: body.trim(),
      aiSources: aiSources
    };
  }

  /**
   * Extract source information for citations
   */
  extractSources(chunks) {
    const sources = chunks.map(chunk => ({
      document: chunk.document_title,
      type: chunk.document_type,
      section: chunk.chunk_type,
      similarity: Math.round(chunk.similarity * 100),
      preview: chunk.content.substring(0, 100) + '...'
    }));

    // Group by document
    const groupedSources = {};
    for (const source of sources) {
      if (!groupedSources[source.document]) {
        groupedSources[source.document] = [];
      }
      groupedSources[source.document].push(source);
    }

    return {
      total: sources.length,
      byDocument: groupedSources,
      topSources: sources.slice(0, 5)
    };
  }
}

export { AIEmailGenerator };
