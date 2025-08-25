import React, { useState, useEffect } from 'react';
import { db } from '../lib/supabase';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, TextArea } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { 
  Plus, 
  Search, 
  Filter,
  Upload,
  Link as LinkIcon,
  Edit3,
  Trash2,
  Save,
  X,
  Building2,
  MapPin,
  Calendar,
  Target,
  Eye,
  FileImage,
  Globe,
  Sparkles,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { Lead } from '../types';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { OpenAIDebugViewer } from '../components/OpenAIDebugViewer';

// Utility: file -> base64 (strip data URL prefix)
const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes('base64,') ? result.split('base64,')[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

// Utility: safe fetch that always reads text first, then JSON.parse
async function fetchJson(url: string, init: RequestInit) {
  const res = await fetch(url, init);
  const text = await res.text(); // get raw body (helps debug when server sends HTML/errors)
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (e) {
    console.error('Server returned non-JSON', { status: res.status, text });
    throw new Error(`Server returned non-JSON (status ${res.status}): ${text.substring(0, 200)}...`);
  }
  if (!res.ok) {
    const msg = data?.error || data?.message || res.statusText;
    throw new Error(msg);
  }
  return data;
}

interface LeadFormData {
  company: string;
  role: string;
  location: string;
  seniority: string;
  description_text: string;
  source_type: 'manual' | 'screenshot' | 'url';
  source_ref: string;
  must_haves: string[];
  nice_to_haves: string[];
  keywords: string[];
}

const statusColors = {
  new: 'default',
  enriched: 'info',
  ready_for_outreach: 'success',
  archived: 'warning'
} as const;

const statusLabels = {
  new: 'New',
  enriched: 'Enriched',
  ready_for_outreach: 'Ready for Outreach',
  archived: 'Archived'
};

interface LeadsPageProps {
  onNavigate?: (path: string) => void;
}

export const LeadsPage: React.FC<LeadsPageProps> = ({ onNavigate }) => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [enriching, setEnriching] = useState<string | null>(null);
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [processingUrl, setProcessingUrl] = useState(false);
  
  const [formData, setFormData] = useState<LeadFormData>({
    company: '',
    role: '',
    location: '',
    seniority: '',
    description_text: '',
    source_type: 'manual',
    source_ref: '',
    must_haves: [],
    nice_to_haves: [],
    keywords: []
  });
  
  const [newRequirement, setNewRequirement] = useState('');
  const [newNiceToHave, setNewNiceToHave] = useState('');
  const [newKeyword, setNewKeyword] = useState('');
  const [urlInput, setUrlInput] = useState('');
  
  // Debug viewer state
  const [showDebugViewer, setShowDebugViewer] = useState(false);
  const [lastDebugData, setLastDebugData] = useState<any>(null);

  const handleViewLead = (leadId: string) => {
    const lead = leads.find(l => l.id === leadId);
    if (lead) {
      // Navigate to lead detail page
      if (onNavigate) {
        onNavigate(`/leads/${leadId}`);
      } else {
        // Fallback to hash navigation
        window.location.hash = `#/leads/${leadId}`;
      }
    }
  };

  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = async () => {
    try {
      const { data, error } = await db.getLeads();
      
      if (error) {
        toast.error('Failed to load leads');
        return;
      }
      
      setLeads((data as Lead[]) || []);
    } catch (err) {
      toast.error('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      company: '',
      role: '',
      location: '',
      seniority: '',
      description_text: '',
      source_type: 'manual',
      source_ref: '',
      must_haves: [],
      nice_to_haves: [],
      keywords: []
    });
    setNewRequirement('');
    setNewNiceToHave('');
    setNewKeyword('');
    setUrlInput('');
    setEditingId(null);
    setShowCreateForm(false);
  };

  const handleSave = async () => {
    if (!formData.company.trim() || !formData.role.trim()) {
      toast.error('Company and role are required');
      return;
    }

    setSaving(true);
    try {
      const leadData = {
        ...formData,
        confidence: 0.8, // Default confidence for manual entries
        status: 'new' as const
      };

      if (editingId) {
        const { data, error } = await db.updateLead(editingId, leadData);
        if (error) {
          toast.error('Failed to update lead');
          return;
        }
        if (data) {
          setLeads(prev => prev.map(l => l.id === editingId ? data as Lead : l));
          toast.success('Lead updated');
        }
      } else {
        const { data, error } = await db.createLead(leadData);
        if (error) {
          toast.error('Failed to create lead');
          return;
        }
        if (data) {
          setLeads(prev => [data as Lead, ...prev]);
          toast.success('Lead created');
        }
      }
      resetForm();
    } catch (err) {
      toast.error('An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (lead: Lead) => {
    setFormData({
      company: lead.company || '',
      role: lead.role || '',
      location: lead.location || '',
      seniority: lead.seniority || '',
      description_text: lead.description_text || '',
      source_type: lead.source_type,
      source_ref: lead.source_ref || '',
      must_haves: lead.must_haves || [],
      nice_to_haves: lead.nice_to_haves || [],
      keywords: lead.keywords || []
    });
    setEditingId(lead.id);
    setShowCreateForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this lead?')) return;

    try {
      const { error } = await db.updateLead(id, { status: 'archived' });
      if (error) {
        toast.error('Failed to archive lead');
        return;
      }
      setLeads(prev => prev.map(l => l.id === id ? { ...l, status: 'archived' } : l));
      toast.success('Lead archived');
    } catch (err) {
      toast.error('An error occurred');
    }
  };

  const handleMultipleScreenshotUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    // Validate all files are images
    const invalidFiles = files.filter(file => !file.type.startsWith('image/'));
    if (invalidFiles.length > 0) {
      toast.error(`${invalidFiles.length} file(s) are not images. Please upload only image files.`);
      return;
    }

    setUploadingScreenshot(true);
    setUploadedImages(files);
    setUploadProgress('Converting images to base64...');
    
    try {
      // Convert all images to base64
      const imagePromises = files.map(async (file) => {
        const base64 = await fileToBase64(file);
        return {
          name: file.name,
          type: file.type,
          size: file.size,
          base64
        };
      });
      
      setUploadProgress('Processing images with AI...');
      const imagesWithBase64 = await Promise.all(imagePromises);
      
      // Process all images together
      const result = await fetchJson('/api/openai/process-multiple-images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          images: imagesWithBase64,
          createLeads: true
        })
      });
      
      if (!result.success) {
        toast.error(`Failed to process images: ${result.error || 'Unknown error'}`);
        return;
      }
      
      // Add all created leads to the list
      if (result.leads && result.leads.length > 0) {
        setLeads(prev => [...(result.leads as Lead[]), ...prev]);
        toast.success(`Successfully created ${result.leads.length} leads from ${files.length} images!`);
      } else {
        toast.success('Images processed successfully!');
      }
      
      // Store debug data
      setLastDebugData({
        imagesProcessed: files.length,
        leadsCreated: result.leads?.length || 0,
        success: result.success,
        error: result.error,
        details: result.details
      });
      
      // Reset file input
      event.target.value = '';
      setUploadedImages([]);
      setUploadProgress('');
    } catch (err) {
      console.error('Multiple upload error:', err);
      toast.error(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      
      // Store error debug data
      setLastDebugData({
        imagesProcessed: files.length,
        leadsCreated: 0,
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        details: null
      });
    } finally {
      setUploadingScreenshot(false);
      setUploadProgress('');
    }
  };

  const handleScreenshotUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    setUploadingScreenshot(true);
    try {
      // Convert image to base64
      const imageBase64 = await fileToBase64(file);
      
      // Send to backend for OpenAI processing
      const result = await fetchJson('/api/openai/process-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageBase64,
          createLead: true,
          leadSourceRef: file.name
        })
      });
      
      // Store debug data for viewer
      setLastDebugData({
        imageBase64,
        systemPrompt: result.debug?.systemPrompt || 'System prompt used for OpenAI',
        userPromptText: result.debug?.userPromptText || 'User prompt sent to OpenAI',
        rawResponse: result.debug?.rawResponse || result.rawResponse || 'OpenAI response',
        parsedData: result.debug?.extractedInfo || result.extractedInfo || null,
        success: result.success,
        error: result.error
      });
      
      if (!result.success) {
        toast.error(`Failed to process image: ${result.error || 'Unknown error'}`);
        return;
      }
      
      // Lead was created by the backend, add it to the list
      if (result.lead) {
        setLeads(prev => [result.lead as Lead, ...prev]);
        toast.success('Lead created successfully from screenshot!');
      } else {
        toast.success('Image processed successfully!');
      }
      
      // Reset file input
      event.target.value = '';
    } catch (err) {
      console.error('Upload error:', err);
      toast.error(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      
      // Store error debug data
      setLastDebugData({
        imageBase64: '',
        systemPrompt: 'Error occurred before sending to OpenAI',
        userPromptText: 'Error occurred before sending to OpenAI', 
        rawResponse: err instanceof Error ? err.message : 'Unknown error',
        parsedData: null,
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error'
      });
    } finally {
      setUploadingScreenshot(false);
    }
  };

  const handleUrlSubmit = async () => {
    if (!urlInput.trim()) {
      toast.error('Please enter a URL');
      return;
    }

    if (!urlInput.startsWith('http')) {
      toast.error('Please enter a valid URL starting with http:// or https://');
      return;
    }

    setProcessingUrl(true);
    try {
      // Send URL to backend for OpenAI processing
      const result = await fetchJson('/api/openai/parse-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: urlInput.trim(),
          createLead: true
        })
      });
      
      if (!result.success) {
        toast.error(`Failed to parse URL: ${result.error || 'Unknown error'}`);
        return;
      }
      
      // Lead was created by the backend, add it to the list
      if (result.lead) {
        setLeads(prev => [result.lead as Lead, ...prev]);
        toast.success('Lead created successfully from URL!');
      } else {
        toast.success('URL processed successfully!');
      }
      
      // Store debug data for viewer
      setLastDebugData({
        url: urlInput,
        systemPrompt: 'URL parsing with OpenAI web browsing',
        userPromptText: 'Extract job posting information from URL',
        rawResponse: result.debug?.extractedData || 'No debug data available',
        parsedData: result.debug?.extractedData || null,
        success: result.success,
        error: result.error
      });
      
      setUrlInput('');
    } catch (err) {
      console.error('URL parsing error:', err);
      toast.error(`URL parsing failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      
      // Store error debug data
      setLastDebugData({
        url: urlInput,
        systemPrompt: 'Error occurred during URL parsing',
        userPromptText: 'Error occurred during URL parsing',
        rawResponse: err instanceof Error ? err.message : 'Unknown error',
        parsedData: null,
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error'
      });
    } finally {
      setProcessingUrl(false);
    }
  };

  const enrichLead = async (leadId: string) => {
    setEnriching(leadId);
    try {
      // Simulate AI enrichment process
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const lead = leads.find(l => l.id === leadId);
      if (!lead) return;

      // Mock enriched data
      const enrichedData = {
        must_haves: [...(lead.must_haves || []), 'Team collaboration', 'Problem-solving skills'],
        nice_to_haves: [...(lead.nice_to_haves || []), 'Industry experience', 'Certification'],
        keywords: [...(lead.keywords || []), 'innovation', 'growth', 'scalability'],
        confidence: Math.min((lead.confidence || 0) + 0.1, 1.0),
        status: 'enriched' as const
      };

      const { data, error } = await db.updateLead(leadId, enrichedData);
      if (error) {
        toast.error('Failed to enrich lead');
        return;
      }

      if (data) {
        setLeads(prev => prev.map(l => l.id === leadId ? data as Lead : l));
        toast.success('Lead enriched successfully!');
      }
    } catch (err) {
      toast.error('Failed to enrich lead');
    } finally {
      setEnriching(null);
    }
  };

  const addArrayItem = (field: 'must_haves' | 'nice_to_haves' | 'keywords', value: string, setter: (value: string) => void) => {
    if (value.trim() && !formData[field].includes(value.trim())) {
      setFormData(prev => ({
        ...prev,
        [field]: [...prev[field], value.trim()]
      }));
      setter('');
    }
  };

  const removeArrayItem = (field: 'must_haves' | 'nice_to_haves' | 'keywords', index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }));
  };

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = 
      lead.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.role?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.description_text?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) return <LoadingSpinner size="lg" text="Loading leads..." />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Job Leads"
          subtitle={`Manage your job opportunities (${leads.length})`}
          action={
            <div className="flex items-center space-x-2">
              <Button
                onClick={() => setShowCreateForm(true)}
                icon={Plus}
                size="sm"
              >
                Add Lead
              </Button>
            </div>
          }
        />
        <CardBody>
          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="p-4 border-dashed border-2 border-gray-300 hover:border-blue-400 transition-colors">
              <div className="text-center">
                <div className="relative inline-block">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleMultipleScreenshotUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={uploadingScreenshot}
                  />
                  <div className="p-3 bg-blue-100 rounded-lg inline-block mb-3">
                    <FileImage className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
                <h3 className="font-medium text-gray-900 mb-1">Upload Screenshots</h3>
                <p className="text-sm text-gray-600 mb-3">
                  {uploadingScreenshot ? 'Processing...' : 'Upload multiple job posting screenshots'}
                </p>
                
                {/* Show uploaded images */}
                {uploadedImages.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs text-gray-500 mb-2">Selected: {uploadedImages.length} image(s)</p>
                    <div className="flex flex-wrap gap-1">
                      {uploadedImages.map((file, index) => (
                        <span key={index} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                          {file.name.substring(0, 15)}...
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {lastDebugData && (
                  <Button
                    onClick={() => setShowDebugViewer(true)}
                    variant="outline"
                    size="sm"
                    className="mb-2"
                  >
                    View Debug Info
                  </Button>
                )}
                {uploadingScreenshot && (
                  <div className="space-y-2">
                    <LoadingSpinner size="sm" />
                    {uploadProgress && (
                      <p className="text-xs text-blue-600">{uploadProgress}</p>
                    )}
                  </div>
                )}
              </div>
            </Card>

            <Card className="p-4 border-dashed border-2 border-gray-300">
              <div className="text-center">
                <div className="p-3 bg-green-100 rounded-lg inline-block mb-3">
                  <Globe className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="font-medium text-gray-900 mb-1">Parse URL</h3>
                <div className="space-y-2">
                  <Input
                    placeholder="https://company.com/jobs/123"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                  />
                  <Button
                    onClick={handleUrlSubmit}
                    loading={processingUrl}
                    size="sm"
                    fullWidth
                    variant="outline"
                  >
                    Parse URL
                  </Button>
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
              <div className="text-center">
                <div className="p-3 bg-purple-100 rounded-lg inline-block mb-3">
                  <Sparkles className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="font-medium text-gray-900 mb-1">AI Enrichment</h3>
                <p className="text-sm text-gray-600">
                  Automatically enhance leads with AI analysis
                </p>
              </div>
            </Card>
          </div>

          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <Input
                placeholder="Search leads by company, role, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                icon={Search}
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* Create/Edit Form */}
          {showCreateForm && (
            <Card className="mb-6 border-blue-200 bg-blue-50">
              <CardHeader
                title={editingId ? 'Edit Lead' : 'Create New Lead'}
                action={
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={X}
                    onClick={resetForm}
                  >
                    Cancel
                  </Button>
                }
              />
              <CardBody>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="Company *"
                      value={formData.company}
                      onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                      placeholder="e.g., Google, Microsoft"
                      icon={Building2}
                    />
                    <Input
                      label="Role *"
                      value={formData.role}
                      onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                      placeholder="e.g., Senior Product Manager"
                      icon={Target}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="Location"
                      value={formData.location}
                      onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                      placeholder="e.g., Bangalore, Remote"
                      icon={MapPin}
                    />
                    <Input
                      label="Seniority"
                      value={formData.seniority}
                      onChange={(e) => setFormData(prev => ({ ...prev, seniority: e.target.value }))}
                      placeholder="e.g., Senior, Mid-level"
                    />
                  </div>

                  <TextArea
                    label="Job Description"
                    value={formData.description_text}
                    onChange={(e) => setFormData(prev => ({ ...prev, description_text: e.target.value }))}
                    placeholder="Paste the full job description here..."
                    rows={8}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Must Haves */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Must Haves
                      </label>
                      <div className="space-y-2 mb-2">
                        {formData.must_haves.map((item, index) => (
                          <div key={index} className="flex items-center gap-2 p-2 bg-red-50 rounded border">
                            <span className="flex-1 text-sm">{item}</span>
                            <button
                              onClick={() => removeArrayItem('must_haves', index)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Add requirement"
                          value={newRequirement}
                          onChange={(e) => setNewRequirement(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && addArrayItem('must_haves', newRequirement, setNewRequirement)}
                        />
                        <Button 
                          onClick={() => addArrayItem('must_haves', newRequirement, setNewRequirement)} 
                          variant="outline" 
                          size="sm"
                        >
                          Add
                        </Button>
                      </div>
                    </div>

                    {/* Nice to Haves */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nice to Haves
                      </label>
                      <div className="space-y-2 mb-2">
                        {formData.nice_to_haves.map((item, index) => (
                          <div key={index} className="flex items-center gap-2 p-2 bg-yellow-50 rounded border">
                            <span className="flex-1 text-sm">{item}</span>
                            <button
                              onClick={() => removeArrayItem('nice_to_haves', index)}
                              className="text-yellow-600 hover:text-yellow-700"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Add nice-to-have"
                          value={newNiceToHave}
                          onChange={(e) => setNewNiceToHave(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && addArrayItem('nice_to_haves', newNiceToHave, setNewNiceToHave)}
                        />
                        <Button 
                          onClick={() => addArrayItem('nice_to_haves', newNiceToHave, setNewNiceToHave)} 
                          variant="outline" 
                          size="sm"
                        >
                          Add
                        </Button>
                      </div>
                    </div>

                    {/* Keywords */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Keywords
                      </label>
                      <div className="space-y-2 mb-2">
                        {formData.keywords.map((item, index) => (
                          <div key={index} className="flex items-center gap-2 p-2 bg-blue-50 rounded border">
                            <span className="flex-1 text-sm">{item}</span>
                            <button
                              onClick={() => removeArrayItem('keywords', index)}
                              className="text-blue-600 hover:text-blue-700"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Add keyword"
                          value={newKeyword}
                          onChange={(e) => setNewKeyword(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && addArrayItem('keywords', newKeyword, setNewKeyword)}
                        />
                        <Button 
                          onClick={() => addArrayItem('keywords', newKeyword, setNewKeyword)} 
                          variant="outline" 
                          size="sm"
                        >
                          Add
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button
                      onClick={handleSave}
                      loading={saving}
                      icon={Save}
                    >
                      {editingId ? 'Update' : 'Create'} Lead
                    </Button>
                    <Button
                      onClick={resetForm}
                      variant="outline"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          )}

          {/* Leads Grid */}
          {filteredLeads.length === 0 ? (
            <div className="text-center py-12">
              <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchQuery || statusFilter !== 'all' ? 'No matching leads' : 'No leads yet'}
              </h3>
              <p className="text-gray-600 mb-6">
                {searchQuery || statusFilter !== 'all' 
                  ? 'Try adjusting your search or filters'
                  : 'Start by adding your first job lead'
                }
              </p>
              {!searchQuery && statusFilter === 'all' && (
                <Button
                  onClick={() => setShowCreateForm(true)}
                  icon={Plus}
                >
                  Add Your First Lead
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredLeads.map((lead) => (
                <Card key={lead.id} className="relative cursor-pointer group hover:shadow-md hover:-translate-y-0.5 transition-all duration-200" onClick={() => handleViewLead(lead.id)}>
                  <div className="absolute top-4 right-4 flex items-center space-x-2">
                    <Badge 
                      variant={statusColors[lead.status]} 
                      size="sm"
                    >
                      {statusLabels[lead.status]}
                    </Badge>
                    {lead.confidence && (
                      <Badge variant="info" size="sm">
                        {Math.round(lead.confidence * 100)}%
                      </Badge>
                    )}
                  </div>

                  <div className="pr-20 mb-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <Building2 className="h-4 w-4 text-gray-500" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewLead(lead.id);
                        }}
                        className="font-semibold text-gray-900 hover:text-blue-600 hover:underline cursor-pointer text-left bg-transparent border-none p-0"
                      >
                        {lead.company}
                      </button>
                    </div>
                    <div className="flex items-center space-x-2 mb-2">
                      <Target className="h-4 w-4 text-gray-500" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewLead(lead.id);
                        }}
                        className="text-gray-700 hover:text-blue-600 hover:underline cursor-pointer text-left bg-transparent border-none p-0"
                      >
                        {lead.role}
                      </button>
                    </div>
                    {lead.location && (
                      <div className="flex items-center space-x-2 mb-2">
                        <MapPin className="h-4 w-4 text-gray-500" />
                        <p className="text-sm text-gray-600">{lead.location}</p>
                      </div>
                    )}
                  </div>

                  {lead.description_text && (
                    <p className="text-sm text-gray-600 mb-4 overflow-hidden" style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical'
                    }}>
                      {lead.description_text}
                    </p>
                  )}

                  {/* Requirements Preview */}
                  {(lead.must_haves && lead.must_haves.length > 0) && (
                    <div className="mb-4">
                      <p className="text-xs font-medium text-gray-700 mb-2">Key Requirements:</p>
                      <div className="flex flex-wrap gap-1">
                        {lead.must_haves.slice(0, 3).map((req, index) => (
                          <Badge key={index} size="sm" variant="error">
                            {req}
                          </Badge>
                        ))}
                        {lead.must_haves.length > 3 && (
                          <Badge size="sm" variant="default">
                            +{lead.must_haves.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                    <div className="flex items-center space-x-2">
                      {lead.source_type === 'screenshot' && <FileImage className="h-4 w-4" />}
                      {lead.source_type === 'url' && <LinkIcon className="h-4 w-4" />}
                      {lead.source_type === 'manual' && <Edit3 className="h-4 w-4" />}
                      <span className="capitalize">{lead.source_type}</span>
                    </div>
                    <span>{format(new Date(lead.created_at), 'MMM d')}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={Eye}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewLead(lead.id);
                        }}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={Edit3}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(lead);
                        }}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={Trash2}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(lead.id);
                        }}
                      />
                    </div>
                    
                    {lead.status === 'new' && (
                      <Button
                        size="sm"
                        variant="outline"
                        icon={Sparkles}
                        loading={enriching === lead.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          enrichLead(lead.id);
                        }}
                      >
                        Enrich
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
      
      {/* Debug Viewer Modal */}
      <OpenAIDebugViewer
        isOpen={showDebugViewer}
        onClose={() => setShowDebugViewer(false)}
        debugData={lastDebugData}
      />
    </div>
  );
};