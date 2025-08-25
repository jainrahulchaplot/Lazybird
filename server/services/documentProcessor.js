import pdfjsLib from 'pdfjs-dist/build/pdf.js';
import { ChatOpenAI } from '@langchain/openai';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { v4 as uuidv4 } from 'uuid';

class DocumentProcessor {
  constructor(openaiApiKey, supabaseClient) {
    this.openai = new ChatOpenAI({
      openAIApiKey: openaiApiKey,
      modelName: 'gpt-3.5-turbo'
    });
    this.supabase = supabaseClient;
    this.splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 500,
      chunkOverlap: 50,
      separators: ['\n\n', '\n', '. ', ' ', '']
    });
  }

  /**
   * Process a document and store it in the vector database
   */
  async processDocument(documentData) {
    try {
      console.log('📄 Processing document:', documentData.title);
      
      // 1. Extract text content
      let textContent = '';
      if (documentData.type === 'resume' && documentData.file_url && documentData.file_url.endsWith('.pdf')) {
        // For resume PDFs, extract text from file
        textContent = await this.extractPDFText(documentData.file_url);
        // Combine with any additional notes
        if (documentData.content && documentData.content.trim()) {
          textContent += '\n\nAdditional Notes:\n' + documentData.content;
        }
      } else if (documentData.content && documentData.content.trim()) {
        // For other types or when content is provided directly
        textContent = documentData.content;
      } else {
        throw new Error('No content provided for document');
      }

      // 2. Create document record
      const { data: document, error: docError } = await this.supabase
        .from('documents')
        .insert({
          user_id: documentData.user_id,
          title: documentData.title,
          type: documentData.type,
          file_url: documentData.file_url,
          content: textContent,
          metadata: documentData.metadata || {}
        })
        .select()
        .single();

      if (docError) throw docError;

      console.log('✅ Document created:', document.id);

      // 3. Chunk the content
      const chunks = await this.chunkContent(textContent, documentData.type);
      console.log(`📋 Created ${chunks.length} chunks`);

      // 4. Generate embeddings and store chunks
      const chunkRecords = await this.processChunks(chunks, document.id);
      
      console.log(`✅ Processed ${chunkRecords.length} chunks with embeddings`);
      
      return {
        document,
        chunks: chunkRecords.length
      };

    } catch (error) {
      console.error('❌ Document processing error:', error);
      throw error;
    }
  }

  /**
   * Extract text from PDF
   */
  async extractPDFText(fileUrl) {
    try {
      console.log('📖 Extracting PDF text from:', fileUrl);
      
      // Download PDF from Supabase storage
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to download PDF: ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      
      // Load PDF document
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      console.log(`📄 PDF loaded with ${pdf.numPages} pages`);
      
      let fullText = '';
      
      // Extract text from each page
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + '\n';
      }
      
      console.log(`📄 Extracted ${fullText.length} characters from PDF`);
      
      return fullText;
    } catch (error) {
      console.error('❌ PDF extraction error:', error);
      throw error;
    }
  }

  /**
   * Chunk content based on document type
   */
  async chunkContent(content, documentType) {
    try {
      if (documentType === 'resume') {
        return this.chunkResume(content);
      } else if (documentType === 'personal_info') {
        return this.chunkPersonalInfo(content);
      } else if (documentType === 'company_research') {
        return this.chunkCompanyResearch(content);
      } else {
        // Default chunking for other types
        const chunks = await this.splitter.splitText(content);
        return chunks.map((chunk, index) => ({
          content: chunk,
          chunk_index: index,
          chunk_type: 'general'
        }));
      }
    } catch (error) {
      console.error('❌ Chunking error:', error);
      throw error;
    }
  }

  /**
   * Smart chunking for resume content
   */
  async chunkResume(content) {
    const chunks = [];
    let chunkIndex = 0;

    console.log('🔍 Starting resume chunking for content length:', content.length);
    
    // Try to identify sections in the resume
    const sections = this.identifyResumeSections(content);
    console.log('📋 Identified sections:', Object.keys(sections).filter(key => sections[key] && sections[key].trim()));
    
    for (const [sectionType, sectionContent] of Object.entries(sections)) {
      if (sectionContent && sectionContent.trim()) {
        console.log(`📝 Processing section ${sectionType} with ${sectionContent.length} characters`);
        
        // Further split large sections
        const subChunks = this.splitLargeText(sectionContent, 400);
        console.log(`✂️ Split section ${sectionType} into ${subChunks.length} sub-chunks`);
        
        subChunks.forEach(chunk => {
          if (chunk && chunk.trim() && chunk.length > 10) { // Only add meaningful chunks
            chunks.push({
              content: chunk,
              chunk_index: chunkIndex++,
              chunk_type: sectionType,
              metadata: { section: sectionType }
            });
          }
        });
      }
    }

    console.log(`📊 Total chunks created: ${chunks.length}`);
    
    // Fallback: if no chunks were created, use simple text splitting
    if (chunks.length === 0) {
      console.log('⚠️ No chunks created with section-based method, using fallback text splitting');
      const fallbackChunks = await this.splitter.splitText(content);
      return fallbackChunks.map((chunk, index) => ({
        content: chunk,
        chunk_index: index,
        chunk_type: 'general',
        metadata: { section: 'general', method: 'fallback' }
      }));
    }
    
    return chunks;
  }

  /**
   * Identify resume sections using keywords
   */
  identifyResumeSections(content) {
    const sections = {
      personal_details: '',
      summary: '',
      skills: '',
      experience: '',
      education: '',
      achievements: '',
      projects: ''
    };

    const lines = content.split('\n').map(line => line.trim()).filter(line => line);
    console.log('📄 Processing', lines.length, 'lines for section identification');
    
    let currentSection = 'personal_details';
    let sectionContent = [];

    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      
      // Detect section headers
      if (lowerLine.includes('summary') || lowerLine.includes('objective') || lowerLine.includes('professional summary')) {
        if (sectionContent.length > 0) {
          sections[currentSection] = sectionContent.join(' ');
          console.log(`📋 Section ${currentSection}: ${sectionContent.length} lines, ${sections[currentSection].length} chars`);
          sectionContent = [];
        }
        currentSection = 'summary';
      } else if (lowerLine.includes('skill') || lowerLine.includes('technical') || lowerLine.includes('myskillset')) {
        if (sectionContent.length > 0) {
          sections[currentSection] = sectionContent.join(' ');
          console.log(`📋 Section ${currentSection}: ${sectionContent.length} lines, ${sectionContent.length} chars`);
          sectionContent = [];
        }
        currentSection = 'skills';
      } else if (lowerLine.includes('experience') || lowerLine.includes('work') || lowerLine.includes('employment') || lowerLine.includes('professional experience')) {
        if (sectionContent.length > 0) {
          sections[currentSection] = sectionContent.join(' ');
          console.log(`📋 Section ${currentSection}: ${sectionContent.length} lines, ${sections[currentSection].length} chars`);
          sectionContent = [];
        }
        currentSection = 'experience';
      } else if (lowerLine.includes('education') || lowerLine.includes('qualification') || lowerLine.includes('graduation')) {
        if (sectionContent.length > 0) {
          sections[currentSection] = sectionContent.join(' ');
          console.log(`📋 Section ${currentSection}: ${sectionContent.length} lines, ${sections[currentSection].length} chars`);
          sectionContent = [];
        }
        currentSection = 'education';
      } else if (lowerLine.includes('achievement') || lowerLine.includes('award') || lowerLine.includes('honor')) {
        if (sectionContent.length > 0) {
          sections[currentSection] = sectionContent.join(' ');
          console.log(`📋 Section ${currentSection}: ${sectionContent.length} lines, ${sections[currentSection].length} chars`);
          sectionContent = [];
        }
        currentSection = 'achievements';
      } else if (lowerLine.includes('project') || lowerLine.includes('portfolio')) {
        if (sectionContent.length > 0) {
          sections[currentSection] = sectionContent.join(' ');
          console.log(`📋 Section ${currentSection}: ${sectionContent.length} lines, ${sections[currentSection].length} chars`);
          sectionContent = [];
        }
        currentSection = 'projects';
      } else {
        sectionContent.push(line);
      }
    }

    // Add the last section
    if (sectionContent.length > 0) {
      sections[currentSection] = sectionContent.join(' ');
      console.log(`📋 Final section ${currentSection}: ${sectionContent.length} lines, ${sections[currentSection].length} chars`);
    }

    // Log final sections
    console.log('📊 Final sections summary:');
    for (const [sectionType, sectionContent] of Object.entries(sections)) {
      if (sectionContent && sectionContent.trim()) {
        console.log(`  - ${sectionType}: ${sectionContent.length} chars`);
      }
    }

    return sections;
  }

  /**
   * Chunk personal information
   */
  chunkPersonalInfo(content) {
    const chunks = [];
    let chunkIndex = 0;

    // Split personal info into logical chunks
    const sections = {
      background: '',
      preferences: '',
      goals: '',
      strengths: '',
      values: ''
    };

    // Simple keyword-based categorization
    const lines = content.split('\n').filter(line => line.trim());
    let currentSection = 'background';

    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      
      if (lowerLine.includes('prefer') || lowerLine.includes('like') || lowerLine.includes('enjoy')) {
        currentSection = 'preferences';
      } else if (lowerLine.includes('goal') || lowerLine.includes('aspir') || lowerLine.includes('aim')) {
        currentSection = 'goals';
      } else if (lowerLine.includes('strength') || lowerLine.includes('good at') || lowerLine.includes('expert')) {
        currentSection = 'strengths';
      } else if (lowerLine.includes('value') || lowerLine.includes('important') || lowerLine.includes('principle')) {
        currentSection = 'values';
      }

      sections[currentSection] += line + ' ';
    }

    // Create chunks from sections
    for (const [sectionType, sectionContent] of Object.entries(sections)) {
      if (sectionContent.trim()) {
        chunks.push({
          content: sectionContent.trim(),
          chunk_index: chunkIndex++,
          chunk_type: sectionType,
          metadata: { section: sectionType }
        });
      }
    }

    return chunks;
  }

  /**
   * Chunk company research content
   */
  chunkCompanyResearch(content) {
    const chunks = [];
    let chunkIndex = 0;

    const sections = {
      company_overview: '',
      culture: '',
      products: '',
      tech_stack: '',
      recent_news: '',
      leadership: ''
    };

    // Simple keyword-based categorization for company research
    const paragraphs = content.split('\n\n').filter(p => p.trim());

    for (const paragraph of paragraphs) {
      const lowerPara = paragraph.toLowerCase();
      let sectionType = 'company_overview'; // default

      if (lowerPara.includes('culture') || lowerPara.includes('value') || lowerPara.includes('mission')) {
        sectionType = 'culture';
      } else if (lowerPara.includes('product') || lowerPara.includes('service') || lowerPara.includes('offering')) {
        sectionType = 'products';
      } else if (lowerPara.includes('tech') || lowerPara.includes('stack') || lowerPara.includes('technology')) {
        sectionType = 'tech_stack';
      } else if (lowerPara.includes('news') || lowerPara.includes('recent') || lowerPara.includes('launch')) {
        sectionType = 'recent_news';
      } else if (lowerPara.includes('ceo') || lowerPara.includes('founder') || lowerPara.includes('leadership')) {
        sectionType = 'leadership';
      }

      chunks.push({
        content: paragraph,
        chunk_index: chunkIndex++,
        chunk_type: sectionType,
        metadata: { section: sectionType }
      });
    }

    return chunks;
  }

  /**
   * Split large text into smaller chunks
   */
  splitLargeText(text, maxLength) {
    if (text.length <= maxLength) {
      return [text];
    }

    const chunks = [];
    let start = 0;

    while (start < text.length) {
      let end = start + maxLength;
      
      // Try to break at sentence boundary
      if (end < text.length) {
        const lastPeriod = text.lastIndexOf('.', end);
        const lastNewline = text.lastIndexOf('\n', end);
        const breakPoint = Math.max(lastPeriod, lastNewline);
        
        if (breakPoint > start + maxLength * 0.5) {
          end = breakPoint + 1;
        }
      }

      chunks.push(text.substring(start, end).trim());
      start = end;
    }

    return chunks.filter(chunk => chunk.length > 0);
  }

  /**
   * Process chunks and generate embeddings
   */
  async processChunks(chunks, documentId) {
    const chunkRecords = [];

    for (const chunk of chunks) {
      try {
        // Generate embedding
        console.log(`🧠 Generating embedding for chunk ${chunk.chunk_index}...`);
        const embedding = await this.generateEmbedding(chunk.content);

        // Store chunk with embedding
        const { data: chunkRecord, error } = await this.supabase
          .from('document_chunks')
          .insert({
            document_id: documentId,
            content: chunk.content,
            chunk_index: chunk.chunk_index,
            chunk_type: chunk.chunk_type,
            embedding,
            metadata: chunk.metadata || {}
          })
          .select()
          .single();

        if (error) {
          console.error('❌ Error storing chunk:', error);
          continue;
        }

        chunkRecords.push(chunkRecord);
        console.log(`✅ Stored chunk ${chunk.chunk_index} with embedding`);

      } catch (error) {
        console.error(`❌ Error processing chunk ${chunk.chunk_index}:`, error);
        continue;
      }
    }

    return chunkRecords;
  }

  /**
   * Generate embedding using OpenAI
   */
  async generateEmbedding(text) {
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          input: text,
          model: 'text-embedding-ada-002'
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data[0].embedding;

    } catch (error) {
      console.error('❌ Embedding generation error:', error);
      throw error;
    }
  }

  /**
   * Search for relevant chunks using semantic similarity
   */
  async searchSimilarChunks(query, options = {}) {
    try {
      const {
        userId = null,
        documentType = null,
        threshold = 0.7,
        limit = 10
      } = options;

      // If no query provided and threshold is very low, get all chunks
      if (!query && threshold <= 0.1) {
        console.log('🔍 Getting all chunks (no query provided)');
        return await this.getAllChunks(userId, documentType, limit);
      }

      console.log('🔍 Searching for chunks similar to:', query);

      // Generate embedding for the query
      const queryEmbedding = await this.generateEmbedding(query);

      // Set user context for RLS
      if (userId) {
        await this.supabase.rpc('set_config', {
          setting_name: 'app.current_user_id',
          setting_value: userId
        });
      }

      // Search using the similarity function
      const { data: results, error } = await this.supabase
        .rpc('search_document_chunks', {
          query_embedding: queryEmbedding,
          match_threshold: threshold,
          match_count: limit,
          filter_user_id: userId,
          filter_document_type: documentType
        });

      if (error) {
        console.error('❌ Search error:', error);
        throw error;
      }

      console.log(`✅ Found ${results.length} similar chunks`);
      return results;

    } catch (error) {
      console.error('❌ Similarity search error:', error);
      throw error;
    }
  }

  /**
   * Get all chunks for a user (when no query is provided)
   */
  async getAllChunks(userId, documentType = null, limit = 100) {
    try {
      // Set user context for RLS
      if (userId) {
        await this.supabase.rpc('set_config', {
          setting_name: 'app.current_user_id',
          setting_value: userId
        });
      }

      let query = this.supabase
        .from('document_chunks')
        .select(`
          *,
          documents!inner(
            id,
            title,
            type,
            user_id
          )
        `)
        .eq('documents.user_id', userId);

      if (documentType) {
        query = query.eq('documents.type', documentType);
      }

      const { data: results, error } = await query
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('❌ Error getting all chunks:', error);
        throw error;
      }

      // Transform the results to match the search format
      const transformedResults = results.map(chunk => ({
        id: chunk.id,
        document_id: chunk.document_id,
        content: chunk.content,
        chunk_type: chunk.chunk_type,
        similarity: 1.0, // All chunks have full similarity when no query
        document_title: chunk.documents.title,
        document_type: chunk.documents.type,
        metadata: chunk.metadata
      }));

      console.log(`✅ Found ${transformedResults.length} total chunks`);
      return transformedResults;

    } catch (error) {
      console.error('❌ Error getting all chunks:', error);
      throw error;
    }
  }
}

export { DocumentProcessor };
