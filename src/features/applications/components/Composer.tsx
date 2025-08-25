import React, { useState, useRef, useCallback } from 'react';
import { Send, Paperclip, ImageIcon, Sparkles, X, Loader2 } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Attachment } from '../../../lib/types/applications';
import { getFileIcon, formatFileSize } from '../../../lib/ui/format';

interface ComposerProps {
  threadId?: string;
  recipients: string[];
  subject: string;
  onSend: (content: string, attachments: Attachment[]) => Promise<void>;
  onGenerateAI: () => Promise<string>;
  disabled?: boolean;
}

export const Composer: React.FC<ComposerProps> = ({
  threadId,
  recipients,
  subject,
  onSend,
  onGenerateAI,
  disabled = false
}) => {
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = async () => {
    if (!content.trim() && attachments.length === 0) return;
    
    setIsSending(true);
    try {
      await onSend(content, attachments);
      setContent('');
      setAttachments([]);
    } catch (error) {
      console.error('Failed to send:', error);
      // TODO: Show error toast
    } finally {
      setIsSending(false);
    }
  };

  const handleGenerateAI = async () => {
    if (!threadId) return;
    
    setIsGeneratingAI(true);
    try {
      const draft = await onGenerateAI();
      setContent(draft);
      textareaRef.current?.focus();
    } catch (error) {
      console.error('Failed to generate AI draft:', error);
      // TODO: Show error toast
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleFileSelect = (files: FileList) => {
    Array.from(files).forEach(file => {
      // Check file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        alert(`File ${file.name} is too large. Maximum size is 10MB.`);
        return;
      }

      const attachment: Attachment = {
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size
      };

      setAttachments(prev => [...prev, attachment]);
    });
  };

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    
    if (e.dataTransfer.files) {
      handleFileSelect(e.dataTransfer.files);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  }, []);

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const openFileSelector = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="border-t border-gray-200 bg-white p-4">
      {/* File input (hidden) */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.doc,.docx,.txt"
        onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
        className="hidden"
      />

      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div className="mb-3 space-y-2">
          {attachments.map((attachment, index) => (
            <div
              key={index}
              className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border"
            >
              <span className="text-lg">{getFileIcon(attachment.mimeType)}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{attachment.filename}</div>
                <div className="text-xs text-gray-500">
                  {attachment.mimeType}
                  {attachment.size && ` • ${formatFileSize(attachment.size)}`}
                </div>
              </div>
              <button
                onClick={() => removeAttachment(index)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Composer area */}
      <div
        className={`border-2 border-dashed rounded-lg p-4 transition-colors ${
          dragActive 
            ? 'border-blue-400 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDrop={handleFileDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Type your message..."
          rows={3}
          className="w-full resize-none border-0 outline-none bg-transparent text-gray-900 placeholder-gray-500"
          disabled={disabled}
        />

        {/* Toolbar */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-200">
          <div className="flex items-center gap-2">
            {/* File upload button */}
            <button
              onClick={openFileSelector}
              disabled={disabled}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              title="Attach files"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* Image upload button */}
            <button
              onClick={openFileSelector}
              disabled={disabled}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              title="Attach images"
            >
              <ImageIcon className="w-4 h-4" />
            </button>

            {/* Drag & drop hint */}
            <span className="text-xs text-gray-400">
              Drag & drop files here
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* AI Generate button */}
            {threadId && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateAI}
                disabled={disabled || isGeneratingAI}
                className="flex items-center gap-2"
              >
                {isGeneratingAI ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                Generate Next Message
              </Button>
            )}

            {/* Send button */}
            <Button
              onClick={handleSend}
              disabled={disabled || isSending || (!content.trim() && attachments.length === 0)}
              className="flex items-center gap-2"
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
