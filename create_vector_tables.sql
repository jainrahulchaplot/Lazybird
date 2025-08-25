-- Enable the vector extension in Supabase
CREATE EXTENSION IF NOT EXISTS vector;

-- Create documents table for storing document metadata
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('resume', 'personal_info', 'company_research', 'job_description', 'note')),
  file_url TEXT,
  content TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create document_chunks table for storing text chunks with embeddings
CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  chunk_type TEXT, -- 'skills', 'experience', 'achievements', 'company_info', 'personal_details', etc.
  embedding VECTOR(1536), -- OpenAI ada-002 embedding dimension
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for vector similarity search
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx 
ON document_chunks USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- Create index for fast document lookup
CREATE INDEX IF NOT EXISTS document_chunks_document_id_idx ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS documents_user_id_idx ON documents(user_id);
CREATE INDEX IF NOT EXISTS documents_type_idx ON documents(type);

-- Create function for similarity search
CREATE OR REPLACE FUNCTION search_document_chunks(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10,
  filter_user_id TEXT DEFAULT NULL,
  filter_document_type TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  content TEXT,
  chunk_type TEXT,
  similarity FLOAT,
  document_title TEXT,
  document_type TEXT,
  metadata JSONB
)
LANGUAGE SQL STABLE
AS $$
  SELECT 
    dc.id,
    dc.document_id,
    dc.content,
    dc.chunk_type,
    1 - (dc.embedding <=> query_embedding) AS similarity,
    d.title AS document_title,
    d.type AS document_type,
    dc.metadata
  FROM document_chunks dc
  JOIN documents d ON dc.document_id = d.id
  WHERE 
    (filter_user_id IS NULL OR d.user_id = filter_user_id)
    AND (filter_document_type IS NULL OR d.type = filter_document_type)
    AND (1 - (dc.embedding <=> query_embedding)) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Row Level Security (RLS) policies
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

-- Policy for documents - users can only access their own documents
CREATE POLICY "Users can access their own documents" ON documents
  FOR ALL USING (user_id = current_setting('app.current_user_id', true));

-- Policy for document_chunks - users can only access chunks from their own documents
CREATE POLICY "Users can access their own document chunks" ON document_chunks
  FOR ALL USING (
    document_id IN (
      SELECT id FROM documents WHERE user_id = current_setting('app.current_user_id', true)
    )
  );
