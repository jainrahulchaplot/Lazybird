import React, { useState, useEffect } from 'react';
import { Brain, Database, FileText, Search, Trash2, Calendar, Tag, Eye } from 'lucide-react';
import { toast } from 'react-hot-toast';
import DocumentUpload from '../components/knowledge/DocumentUpload';
import { apiUrls } from '../lib/config';

interface Document {
  id: string;
  title: string;
  type: string;
  content: string;
  file_url?: string;
  metadata: any;
  created_at: string;
  document_chunks?: { count: number }[];
}

interface Chunk {
  id: string;
  content: string;
  chunk_type: string;
  similarity: number;
  document_title: string;
  document_type: string;
  metadata: any;
}

const KnowledgeBasePage: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'upload' | 'documents'>('upload');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Chunk[]>([]);
  const [searching, setSearching] = useState(false);
  const [showChunks, setShowChunks] = useState<{ [key: string]: boolean }>({});
  const [documentChunks, setDocumentChunks] = useState<{ [key: string]: Chunk[] }>({});

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const response = await fetch(apiUrls.documents());
      const result = await response.json();
      
      if (result.success) {
        setDocuments(result.documents);
      } else {
        toast.error('Failed to load documents');
      }
    } catch (error) {
      console.error('Error loading documents:', error);
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const loadDocumentChunks = async (documentId: string) => {
    if (documentChunks[documentId]) return; // Already loaded
    
    try {
      const response = await fetch(apiUrls.documents('/search'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: '', // Empty query to get all chunks
          threshold: 0.0, // Very low threshold to get all chunks
          limit: 100
        })
      });

      const result = await response.json();
      
      if (result.success) {
        // Filter chunks for this specific document
        const docChunks = result.results.filter((chunk: Chunk) => 
          chunk.document_title === documents.find(d => d.id === documentId)?.title
        );
        setDocumentChunks(prev => ({
          ...prev,
          [documentId]: docChunks
        }));
      }
    } catch (error) {
      console.error('Error loading chunks:', error);
    }
  };

  const toggleChunks = (documentId: string) => {
    if (!showChunks[documentId]) {
      loadDocumentChunks(documentId);
    }
    setShowChunks(prev => ({
      ...prev,
      [documentId]: !prev[documentId]
    }));
  };

  const deleteDocument = async (id: string) => {
    if (!confirm('Are you sure you want to delete this document? This will also remove all associated knowledge chunks.')) {
      return;
    }

    try {
      const response = await fetch(apiUrls.documents(`/${id}`), {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (result.success) {
        setDocuments(prev => prev.filter(doc => doc.id !== id));
        toast.success('Document deleted successfully');
      } else {
        toast.error('Failed to delete document');
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Failed to delete document');
    }
  };

  const searchDocuments = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const response = await fetch(apiUrls.documents('/search'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          threshold: 0.6,
          limit: 20
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setSearchResults(result.results);
      } else {
        toast.error('Search failed');
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Search failed');
    } finally {
      setSearching(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'resume': return '📄';
      case 'personal_info': return '👤';
      case 'company_research': return '🏢';
      case 'job_description': return '💼';
      case 'note': return '📝';
      default: return '📄';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'resume': return 'bg-blue-100 text-blue-800';
      case 'personal_info': return 'bg-green-100 text-green-800';
      case 'company_research': return 'bg-purple-100 text-purple-800';
      case 'job_description': return 'bg-orange-100 text-orange-800';
      case 'note': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Brain className="w-8 h-8 text-indigo-600" />
            <h1 className="text-3xl font-bold text-gray-900">Knowledge Base</h1>
            <Database className="w-6 h-6 text-gray-500" />
          </div>
          <p className="text-gray-600">
            Store your resumes, personal information, and company research in a smart vector database. 
            Use AI to generate personalized emails based on your stored knowledge.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <FileText className="w-8 h-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Documents</p>
                <p className="text-2xl font-semibold text-gray-900">{documents.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <Database className="w-8 h-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Knowledge Chunks</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {documents.reduce((total, doc) => total + (doc.document_chunks?.[0]?.count || 0), 0)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <Tag className="w-8 h-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Document Types</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {new Set(documents.map(doc => doc.type)).size}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <Brain className="w-8 h-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">AI Ready</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {documents.length > 0 ? 'Yes' : 'No'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex">
              <button
                onClick={() => setActiveTab('upload')}
                className={`py-3 px-6 border-b-2 font-medium text-sm ${
                  activeTab === 'upload'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Upload Documents
              </button>
              <button
                onClick={() => setActiveTab('documents')}
                className={`py-3 px-6 border-b-2 font-medium text-sm ${
                  activeTab === 'documents'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                My Documents ({documents.length})
              </button>
            </nav>
          </div>

          <div className="p-6">
            {/* Upload Tab */}
            {activeTab === 'upload' && (
              <DocumentUpload onUploadSuccess={loadDocuments} />
            )}

            {/* Documents Tab */}
            {activeTab === 'documents' && (
              <div className="space-y-6">
                {/* Search */}
                <div className="flex gap-4">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && searchDocuments()}
                      placeholder="Search your knowledge base..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <button
                    onClick={searchDocuments}
                    disabled={searching}
                    className={`px-6 py-2 rounded-lg font-medium ${
                      searching
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-indigo-700'
                    } text-white transition-colors`}
                  >
                    <Search className="w-4 h-4" />
                  </button>
                </div>

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold mb-4">Search Results ({searchResults.length})</h3>
                    <div className="space-y-3">
                      {searchResults.map((result, index) => (
                        <div key={index} className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(result.document_type)}`}>
                                  {getTypeIcon(result.document_type)} {result.document_type.replace('_', ' ')}
                                </span>
                                <span className="text-sm font-medium text-gray-900">{result.document_title}</span>
                                <span className="text-sm text-gray-500">({Math.round(result.similarity * 100)}% match)</span>
                              </div>
                              <p className="text-sm text-gray-700">{result.content}</p>
                              {result.chunk_type && (
                                <span className="inline-block mt-2 px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                                  {result.chunk_type}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Documents List */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">All Documents</h3>
                  {loading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                      <p className="text-gray-500 mt-2">Loading documents...</p>
                    </div>
                  ) : documents.length === 0 ? (
                    <div className="text-center py-8">
                      <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">No documents uploaded yet. Start by uploading your first document!</p>
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {documents.map((doc) => (
                        <div key={doc.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(doc.type)}`}>
                                  {getTypeIcon(doc.type)} {doc.type.replace('_', ' ')}
                                </span>
                                <h4 className="font-medium text-gray-900">{doc.title}</h4>
                              </div>
                              
                              <div className="text-sm text-gray-600 mb-2">
                                {doc.content ? (
                                  <p>{doc.content.substring(0, 200)}...</p>
                                ) : (
                                  <p>File-based document</p>
                                )}
                              </div>

                              <div className="flex items-center gap-4 text-xs text-gray-500">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {new Date(doc.created_at).toLocaleDateString()}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Database className="w-3 h-3" />
                                  {doc.document_chunks?.[0]?.count || 0} chunks
                                </span>
                                {doc.metadata?.tags && doc.metadata.tags.length > 0 && (
                                  <span className="flex items-center gap-1">
                                    <Tag className="w-3 h-3" />
                                    {doc.metadata.tags.join(', ')}
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => toggleChunks(doc.id)}
                                className="p-2 text-gray-400 hover:text-indigo-600 transition-colors"
                                title="View chunks"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => deleteDocument(doc.id)}
                                className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                                title="Delete document"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Chunks Display */}
                          {showChunks[doc.id] && documentChunks[doc.id] && (
                            <div className="mt-4 pt-4 border-t border-gray-200">
                              <h5 className="text-sm font-medium text-gray-700 mb-3">
                                Knowledge Chunks ({documentChunks[doc.id].length})
                              </h5>
                              <div className="space-y-3">
                                {documentChunks[doc.id].map((chunk, index) => (
                                  <div key={chunk.id} className="bg-gray-50 rounded-lg p-3">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                        {chunk.chunk_type || 'general'}
                                      </span>
                                      {chunk.similarity > 0 && (
                                        <span className="text-xs text-gray-500">
                                          {Math.round(chunk.similarity * 100)}% relevance
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-sm text-gray-700">{chunk.content}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeBasePage;
