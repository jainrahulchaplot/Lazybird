import React, { useState } from 'react';
import { Upload, FileText, User, Building, FileSearch, StickyNote } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface DocumentUploadProps {
  onUploadSuccess?: (document: any) => void;
}

const DOCUMENT_TYPES = [
  { 
    value: 'resume', 
    label: 'Resume/CV', 
    icon: FileText, 
    description: 'Professional resume or CV (PDF upload + text extraction)',
    supportsFile: true,
    requiresContent: false
  },
  { 
    value: 'personal_info', 
    label: 'Personal Information', 
    icon: User, 
    description: 'Your background, preferences, goals, strengths (text entry)',
    supportsFile: false,
    requiresContent: true
  },
  { 
    value: 'company_research', 
    label: 'Company Research', 
    icon: Building, 
    description: 'Company insights, culture, tech stack (text entry)',
    supportsFile: false,
    requiresContent: true
  },
  { 
    value: 'job_description', 
    label: 'Job Description', 
    icon: FileSearch, 
    description: 'Job requirements, responsibilities (text entry)',
    supportsFile: false,
    requiresContent: true
  },
  { 
    value: 'note', 
    label: 'Notes & Insights', 
    icon: StickyNote, 
    description: 'General notes, interview experiences, networking insights (text entry)',
    supportsFile: false,
    requiresContent: true
  }
];

const DocumentUpload: React.FC<DocumentUploadProps> = ({ onUploadSuccess }) => {
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    type: '',
    content: '',
    file: null as File | null,
    metadata: {
      tags: '',
      company: '',
      role: ''
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData(prev => ({ ...prev, file }));
      
      // Auto-set title from filename if not already set
      if (!formData.title) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
        setFormData(prev => ({ ...prev, title: nameWithoutExt }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.type) {
      toast.error('Please provide title and document type');
      return;
    }

    const selectedType = DOCUMENT_TYPES.find(type => type.value === formData.type);
    
    if (selectedType?.requiresContent && !formData.content?.trim()) {
      toast.error(`Please provide content for ${selectedType.label}`);
      return;
    }

    if (selectedType?.supportsFile && !formData.file && !formData.content?.trim()) {
      toast.error(`Please either upload a file or provide content for ${selectedType.label}`);
      return;
    }

    setUploading(true);

    try {
      let payload: any = {
        title: formData.title,
        type: formData.type,
        content: formData.content,
        metadata: {
          tags: formData.metadata.tags.split(',').map(t => t.trim()).filter(Boolean),
          company: formData.metadata.company,
          role: formData.metadata.role,
          uploadedAt: new Date().toISOString()
        }
      };

      // Handle file upload only for resume type
      if (formData.type === 'resume' && formData.file) {
        // First upload file to get URL (reuse existing resume upload if PDF)
        if (formData.file.type === 'application/pdf') {
          const arrayBuffer = await formData.file.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
          
          const fileResponse = await fetch('http://localhost:3001/api/upload-resume', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName: formData.file.name,
              fileSize: formData.file.size,
              base64Data: base64,
              contentType: formData.file.type
            })
          });

          const fileResult = await fileResponse.json();
          if (!fileResult.success) {
            throw new Error(fileResult.error);
          }

          payload.file_url = fileResult.resume.file_url;
        } else {
          // For non-PDF files, convert to text content
          const text = await formData.file.text();
          payload.content = text;
        }
      }

      // Process document in vector database
      const response = await fetch('http://localhost:3001/api/documents/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error);
      }

      toast.success(`Document processed! Created ${result.chunks} knowledge chunks`);
      
      // Reset form
      setFormData({
        title: '',
        type: '',
        content: '',
        file: null,
        metadata: { tags: '', company: '', role: '' }
      });

      if (onUploadSuccess) {
        onUploadSuccess(result.document);
      }

    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(`Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const selectedType = DOCUMENT_TYPES.find(type => type.value === formData.type);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center gap-3 mb-6">
        <Upload className="w-6 h-6 text-indigo-600" />
        <h2 className="text-xl font-semibold text-gray-900">Add to Knowledge Base</h2>
      </div>
      
      {/* Flow Guide */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="font-medium text-blue-900 mb-2">📋 How it works:</h3>
        <div className="text-sm text-blue-800 space-y-1">
          <div>• <strong>Resume/CV:</strong> Upload PDF + optional notes → AI extracts and chunks text</div>
          <div>• <strong>Other Types:</strong> Enter detailed text → AI creates knowledge chunks</div>
          <div>• <strong>All content</strong> is stored in vector database for AI email generation</div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Document Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Document Type
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {DOCUMENT_TYPES.map((type) => {
              const Icon = type.icon;
              return (
                <label
                  key={type.value}
                  className={`relative flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    formData.type === type.value
                      ? 'border-indigo-600 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="type"
                    value={type.value}
                    checked={formData.type === type.value}
                    onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                    className="sr-only"
                  />
                  <Icon className={`w-5 h-5 mr-3 ${
                    formData.type === type.value ? 'text-indigo-600' : 'text-gray-400'
                  }`} />
                  <div>
                    <div className="font-medium text-gray-900">{type.label}</div>
                    <div className="text-sm text-gray-500">{type.description}</div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Document Title
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="e.g., My Software Engineer Resume 2024"
            required
          />
        </div>

        {/* File Upload - Only for Resume type */}
        {formData.type === 'resume' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload Resume File (PDF Recommended)
            </label>
            <input
              type="file"
              onChange={handleFileChange}
              accept=".pdf,.txt,.doc,.docx"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            />
            <p className="text-sm text-gray-500 mt-1">
              PDF files will be automatically processed for text extraction. Other formats will be treated as text.
            </p>
          </div>
        )}

        {/* Content */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {formData.type === 'resume' && formData.file 
              ? 'Additional Notes (Optional - will extract main content from file)' 
              : 'Content'
            }
          </label>
          <textarea
            value={formData.content}
            onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
            rows={6}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            placeholder={
              formData.type === 'resume' 
                ? 'Add any additional notes or context about your resume...'
                : selectedType 
                  ? `Enter your ${selectedType.label.toLowerCase()} here...`
                  : 'Enter content here...'
            }
          />
          {formData.type !== 'resume' && (
            <p className="text-sm text-gray-500 mt-1">
              Be specific and detailed. This information will be used by AI to generate personalized emails.
            </p>
          )}
        </div>

        {/* Metadata */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={formData.metadata.tags}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                metadata: { ...prev.metadata, tags: e.target.value }
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="AI, Product Management, React"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Company (if relevant)
            </label>
            <input
              type="text"
              value={formData.metadata.company}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                metadata: { ...prev.metadata, company: e.target.value }
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Google, Microsoft, etc."
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Role (if relevant)
            </label>
            <input
              type="text"
              value={formData.metadata.role}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                metadata: { ...prev.metadata, role: e.target.value }
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Product Manager, Engineer, etc."
            />
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={uploading}
            className={`px-6 py-3 rounded-lg font-medium ${
              uploading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700'
            } text-white transition-colors`}
          >
            {uploading ? 'Processing...' : 'Add to Knowledge Base'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default DocumentUpload;
