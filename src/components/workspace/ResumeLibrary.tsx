import React, { useState, useEffect } from 'react';
import { apiUrls } from '../../lib/config';
import { Card, CardHeader, CardBody } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { FileText, Upload, Star, Download, Trash2, Plus } from 'lucide-react';
import { Resume } from '../../types';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export const ResumeLibrary: React.FC = () => {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadResumes();
    checkStorageBucket();
  }, []);

  const checkStorageBucket = async () => {
    // Storage bucket check removed - backend handles this
    console.log('✅ Storage bucket check skipped - backend handles storage operations');
  };

  const loadResumes = async () => {
    try {
      console.log('📚 Loading resumes via backend API...');
      const response = await fetch(apiUrls.resumes());
      const result = await response.json();
      
      if (!result.success) {
        console.error('❌ Error loading resumes:', result.error);
        toast.error('Failed to load resumes');
        return;
      }
      
      console.log('📚 Loaded resumes:', result.resumes);
      setResumes((result.resumes as Resume[]) || []);
    } catch (err) {
      console.error('❌ Resume load error:', err);
      toast.error('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file');
      return;
    }

    setUploading(true);
    try {
      console.log('📁 Starting file upload via backend API:', file.name, file.size);
      console.log('📁 File type:', file.type);
      console.log('📁 File size:', file.size);
      
      // Convert file to base64 for backend
      console.log('📁 Converting file to base64...');
      const arrayBuffer = await file.arrayBuffer();
      console.log('📁 ArrayBuffer size:', arrayBuffer.byteLength);
      
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      console.log('📁 Base64 length:', base64.length);
      console.log('📁 Base64 preview:', base64.substring(0, 100) + '...');
      
      const requestBody = {
        fileName: file.name,
        fileSize: file.size,
        base64Data: base64,
        contentType: 'application/pdf'
      };
      
      console.log('📁 Request body to send:', {
        fileName: requestBody.fileName,
        fileSize: requestBody.fileSize,
        base64DataLength: requestBody.base64Data.length,
        contentType: requestBody.contentType
      });
      
      // Call backend API to handle upload
      console.log('📁 Sending request to backend...');
      const response = await fetch(apiUrls.upload(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      console.log('📁 Response status:', response.status);
      console.log('📁 Response headers:', Object.fromEntries(response.headers.entries()));
      
      const result = await response.json();
      console.log('📁 Response body:', result);
      
      if (!result.success) {
        console.error('❌ Backend upload error:', result.error);
        toast.error(`Failed to upload file: ${result.error}`);
        return;
      }

      console.log('✅ Resume uploaded successfully via backend:', result);
      
      // Add the new resume to the list
      const newResume = {
        id: result.resume.id,
        user_id: result.resume.user_id || 'me',
        title: result.resume.title,
        focus_tags: result.resume.focus_tags || ['General'],
        file_url: result.resume.file_url,
        size: result.resume.size,
        created_at: result.resume.created_at,
        json_struct: result.resume.json_struct
      };
      
      setResumes(prev => [newResume, ...prev]);
      toast.success('Resume uploaded successfully');
      
      // Reset file input
      event.target.value = '';
    } catch (err) {
      console.error('❌ Upload error:', err);
      toast.error('An error occurred during upload');
    } finally {
      setUploading(false);
    }
  };

  const deleteResume = async (id: string) => {
    if (!confirm('Are you sure you want to delete this resume?')) return;

    try {
      const response = await fetch(apiUrls.resumes(`/${id}`), {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (!result.success) {
        console.error('❌ Delete error:', result.error);
        toast.error('Failed to delete resume');
        return;
      }

      setResumes(prev => prev.filter(resume => resume.id !== id));
      toast.success('Resume deleted');
    } catch (err) {
      console.error('❌ Delete error:', err);
      toast.error('An error occurred');
    }
  };

  const fixBlobUrl = async (resume: Resume) => {
    // This function is no longer needed since backend handles all uploads
    toast.error('Re-upload functionality has been updated. Please use the upload button instead.');
  };

  if (loading) return <LoadingSpinner size="lg" text="Loading resumes..." />;

  return (
    <div className="space-y-6">
      {/* Storage Setup Instructions - Removed since backend handles storage */}
      
      <Card>
        <CardHeader
          title="Resume Library"
          subtitle={`Manage your resumes (${resumes.length})`}
          action={
            <div className="relative">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={uploading}
                />
                <Button
                  icon={Upload}
                  size="sm"
                  loading={uploading}
                  disabled={uploading}
                  variant="primary"
                >
                  Upload Resume
                </Button>
              </div>
          }
        />
        <CardBody>
          {resumes.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No resumes uploaded</h3>
              <p className="text-gray-600 mb-6">Upload your first resume to get started with content generation</p>
              <div className="relative inline-block">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={uploading}
                />
                <Button
                  icon={Plus}
                  loading={uploading}
                  disabled={uploading}
                  variant="primary"
                >
                  Upload Your First Resume
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {resumes.map((resume) => (
                <Card key={resume.id} hover className="relative">
                  <div className="absolute top-4 right-4">
                    <Star className="h-5 w-5 text-gray-300 hover:text-yellow-500 cursor-pointer transition-colors" />
                  </div>
                  
                  <div className="flex items-start space-x-4">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <FileText className="h-6 w-6 text-blue-600" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">
                        {resume.title}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {format(new Date(resume.created_at), 'MMM d, yyyy')}
                      </p>
                      
                      <div className="flex flex-wrap gap-1 mt-2">
                        {resume.focus_tags?.map((tag, index) => (
                          <Badge key={index} size="sm" variant="info">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      
                      {/* Storage Status */}
                      <div className="mt-2">
                        {resume.file_url ? (
                          resume.file_url.startsWith('blob:') ? (
                            <Badge size="sm" variant="warning">
                              ⚠️ Blob URL (Invalid)
                            </Badge>
                          ) : resume.file_url.includes('supabase.co') ? (
                            <Badge size="sm" variant="success">
                              ✅ Supabase Storage
                            </Badge>
                          ) : (
                            <Badge size="sm" variant="warning">
                              ⚠️ Unknown Format
                            </Badge>
                          )
                        ) : (
                          <Badge size="sm" variant="error">
                            ❌ No File URL
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-2 mt-4">
                        {resume.file_url && !resume.file_url.startsWith('blob:') ? (
                          <Button
                            size="sm"
                            variant="outline"
                            icon={Download}
                            onClick={() => window.open(resume.file_url, '_blank')}
                          >
                            Download
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            icon={Upload}
                            onClick={() => fixBlobUrl(resume)}
                          >
                            Re-upload
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={Trash2}
                          onClick={() => deleteResume(resume.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
};