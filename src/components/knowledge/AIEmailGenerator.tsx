import React, { useState } from 'react';
import { Bot, Sparkles, Send, Copy, Check, FileText, Brain } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { apiUrls } from '../../lib/config';

interface AIEmailGeneratorProps {
  leadData?: {
    company?: string;
    role?: string;
    contact_email?: string;
  };
  onEmailGenerated?: (email: any) => void;
}

const AIEmailGenerator: React.FC<AIEmailGeneratorProps> = ({ leadData, onEmailGenerated }) => {
  const [generating, setGenerating] = useState(false);
  const [query, setQuery] = useState('');
  const [focusAreas, setFocusAreas] = useState('');
  const [emailType, setEmailType] = useState('application');
  const [generatedEmail, setGeneratedEmail] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!query.trim()) {
      toast.error('Please enter your request');
      return;
    }

    setGenerating(true);
    
    try {
      const focusAreasArray = focusAreas
        .split(',')
        .map(area => area.trim())
        .filter(Boolean);

      const payload = {
        query: query.trim(),
        targetCompany: leadData?.company || '',
        targetRole: leadData?.role || '',
        focusAreas: focusAreasArray,
        emailType
      };

      console.log('🤖 Generating AI email with payload:', payload);

      const response = await fetch(apiUrls.ai('/generate-email'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error);
      }

      setGeneratedEmail(result);
      toast.success('AI email generated successfully!');

      if (onEmailGenerated) {
        onEmailGenerated(result);
      }

    } catch (error: any) {
      console.error('AI generation error:', error);
      toast.error(`Generation failed: ${error.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleQuickQuery = (template: string) => {
    setQuery(template);
  };

  const quickQueries = [
    `Generate a cold email for the ${leadData?.role || 'Software Engineer'} role at ${leadData?.company || 'TechCorp'} using my resume and any stored company information. Highlight AI-first experience and measurable impact.`,
    `Create a follow-up email for my application to ${leadData?.company || 'the company'} showing enthusiasm and additional relevant skills.`,
    `Write a personalized cover letter for ${leadData?.role || 'this position'} emphasizing my leadership experience and technical achievements.`,
    `Generate a networking email to connect with someone at ${leadData?.company || 'the target company'} about opportunities in ${leadData?.role || 'this field'}.`
  ];

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center gap-3 mb-6">
        <Bot className="w-6 h-6 text-purple-600" />
        <h2 className="text-xl font-semibold text-gray-900">AI Email Generator</h2>
        <Sparkles className="w-5 h-5 text-purple-500" />
      </div>

      <div className="space-y-6">
        {/* Email Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email Type
          </label>
          <select
            value={emailType}
            onChange={(e) => setEmailType(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
          >
            <option value="application">Job Application</option>
            <option value="cold_outreach">Cold Outreach</option>
            <option value="follow_up">Follow-up</option>
          </select>
        </div>

        {/* Quick Query Templates */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Quick Templates
          </label>
          <div className="grid gap-2">
            {quickQueries.map((template, index) => (
              <button
                key={index}
                onClick={() => handleQuickQuery(template)}
                className="text-left p-3 text-sm bg-gray-50 hover:bg-gray-100 rounded-md border transition-colors"
              >
                {template}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Query */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Your Request
          </label>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
            placeholder="Describe what kind of email you want to generate. Be specific about the role, company, and what you want to highlight..."
          />
        </div>

        {/* Focus Areas */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Focus Areas (comma-separated)
          </label>
          <input
            type="text"
            value={focusAreas}
            onChange={(e) => setFocusAreas(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
            placeholder="AI expertise, leadership, product management, measurable impact, team building"
          />
          <p className="text-sm text-gray-500 mt-1">
            Areas you want to emphasize in the email based on your stored documents
          </p>
        </div>

        {/* Target Info */}
        {leadData && (
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-2">Target Information</h3>
            <div className="text-sm text-blue-800 space-y-1">
              {leadData.company && <div><strong>Company:</strong> {leadData.company}</div>}
              {leadData.role && <div><strong>Role:</strong> {leadData.role}</div>}
              {leadData.contact_email && <div><strong>Contact:</strong> {leadData.contact_email}</div>}
            </div>
          </div>
        )}

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={generating || !query.trim()}
          className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium ${
            generating || !query.trim()
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-purple-600 hover:bg-purple-700'
          } text-white transition-colors`}
        >
          {generating ? (
            <>
              <Brain className="w-5 h-5 animate-pulse" />
              AI is thinking...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Generate Personalized Email
            </>
          )}
        </button>

        {/* Generated Email */}
        {generatedEmail && (
          <div className="mt-8 space-y-6">
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-green-600" />
                Generated Email
              </h3>

              {/* Subject */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subject Line
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={generatedEmail.email.subject}
                    readOnly
                    className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-md"
                  />
                  <button
                    onClick={() => handleCopy(generatedEmail.email.subject)}
                    className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    {copied ? <Check className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Body
                </label>
                <div className="relative">
                  <textarea
                    value={generatedEmail.email.body}
                    readOnly
                    rows={12}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md"
                  />
                  <button
                    onClick={() => handleCopy(generatedEmail.email.body)}
                    className="absolute top-2 right-2 p-2 text-gray-500 hover:text-gray-700 transition-colors bg-white rounded shadow"
                  >
                    {copied ? <Check className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Full Email Copy */}
              <div className="mb-6">
                <button
                  onClick={() => handleCopy(`Subject: ${generatedEmail.email.subject}\n\n${generatedEmail.email.body}`)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors"
                >
                  <Copy className="w-4 h-4" />
                  Copy Complete Email
                </button>
              </div>

              {/* Sources Used */}
              {generatedEmail.sources && generatedEmail.sources.topSources?.length > 0 && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-3">Sources Used ({generatedEmail.sources.total} total chunks)</h4>
                  <div className="space-y-2">
                    {generatedEmail.sources.topSources.map((source: any, index: number) => (
                      <div key={index} className="text-sm">
                        <div className="font-medium text-gray-800">
                          {source.document} ({source.type})
                        </div>
                        <div className="text-gray-600">
                          {source.section} • {source.similarity}% relevant
                        </div>
                        <div className="text-gray-500 text-xs mt-1">
                          {source.preview}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {generatedEmail.email.aiSources && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="text-sm text-gray-600">
                        <strong>AI Sources Note:</strong> {generatedEmail.email.aiSources}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Metadata */}
              {generatedEmail.metadata && (
                <div className="text-xs text-gray-500 mt-4 p-3 bg-gray-50 rounded">
                  <div>Generated: {new Date(generatedEmail.metadata.generatedAt).toLocaleString()}</div>
                  <div>Chunks used: {generatedEmail.metadata.chunksUsed}</div>
                  <div>Search query: {generatedEmail.metadata.searchQuery}</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIEmailGenerator;
