import React from 'react';
import { Message, Attachment, EmailAddress } from '../../../lib/types/applications';
import { formatAbsoluteTime, sanitizeHtml, getFileIcon, formatFileSize, getInitials } from '../../../lib/ui/format';
import { formatEmailAddress } from '../../../lib/utils/parseAddress';
import { formatEmailBody } from '../../../utils/emailFormatting';

interface ThreadViewProps {
  threadId?: string;
  subject?: string;
  messages: Message[];
  recipients: EmailAddress[];
  onReplyAll: () => void;
  onDelete?: () => void;
}

export const ThreadView: React.FC<ThreadViewProps> = ({
  threadId,
  subject,
  messages,
  recipients,
  onReplyAll,
  onDelete
}) => {
  // Debug logging
  console.log('ThreadView rendering with props:', { 
    threadId, 
    subject, 
    messages: messages ? `${messages.length} messages` : 'null/undefined', 
    recipients: recipients ? `${recipients.length} recipients` : 'null/undefined'
  });
  
  // Additional detailed logging for messages
  if (messages && Array.isArray(messages)) {
    console.log('📧 Messages details:', messages.map((msg, i) => ({
      index: i,
      id: msg.id,
      from: msg.from?.email,
      subject: msg.subject,
      date: msg.date,
      hasHtml: !!msg.html,
      hasText: !!msg.text,
      attachments: msg.attachments?.length || 0
    })));
  }
  
  try {
    if (!threadId) {
      return (
        <div className="h-full flex items-center justify-center text-gray-500">
          <div className="text-center">
            <div className="text-6xl mb-4">📧</div>
            <p className="text-lg">Select a thread to view details</p>
          </div>
        </div>
      );
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return (
        <div className="h-full flex items-center justify-center text-gray-500">
          <div className="text-center">
            <div className="text-6xl mb-4">📭</div>
            <p className="text-lg">No messages in this thread</p>
            <p className="text-sm text-gray-400 mt-2">
              Debug: threadId={threadId}, messages={Array.isArray(messages) ? messages.length : typeof messages}
            </p>
          </div>
        </div>
      );
    }
  } catch (error) {
    console.error('Error in ThreadView:', error);
    return (
      <div className="h-full flex items-center justify-center text-red-500">
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <p className="text-lg">Error rendering thread</p>
          <p className="text-sm mt-2">{error.message}</p>
        </div>
      </div>
    );
  }

  const renderAttachments = (attachments: Attachment[]) => {
    if (!attachments || attachments.length === 0) return null;

    return (
      <div className="mt-3 space-y-2">
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
            {attachment.dataBase64 && (
              <button
                onClick={() => {
                  // Create blob and download
                  const byteCharacters = atob(attachment.dataBase64);
                  const byteNumbers = new Array(byteCharacters.length);
                  for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                  }
                  const byteArray = new Uint8Array(byteNumbers);
                  const blob = new Blob([byteArray], { type: attachment.mimeType });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = attachment.filename;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Download
              </button>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderMessage = (message: Message, index: number) => {
    const isLastMessage = index === messages.length - 1;
    const isOutgoing = message.from.email.toLowerCase().includes('jainrahulchaplot');

    return (
      <div
        key={message.id}
        className={`flex gap-3 ${isOutgoing ? 'flex-row-reverse' : ''}`}
      >
        {/* Avatar */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
          isOutgoing ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
        }`}>
          {getInitials(message.from.name)}
        </div>

        {/* Message content */}
        <div className={`flex-1 max-w-[80%] ${isOutgoing ? 'text-right' : ''}`}>
          {/* Message header */}
          <div className={`mb-2 text-xs ${isOutgoing ? 'text-right' : 'text-left'}`}>
            <div className="font-medium">
              From: {formatEmailAddress(message.from)}
            </div>
            <div className="text-gray-500">
              To: {message.to.map(addr => formatEmailAddress(addr)).join(', ')}
              {message.cc && message.cc.length > 0 && (
                <span> • Cc: {message.cc.map(addr => formatEmailAddress(addr)).join(', ')}</span>
              )}
            </div>
            <div className="text-gray-400">
              {formatAbsoluteTime(message.date)}
            </div>
          </div>
          
          <div className={`inline-block p-3 rounded-2xl ${
            isOutgoing 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-100 text-gray-900'
          }`}>
            {/* Message body */}
            {message.html ? (
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ 
                  __html: sanitizeHtml(message.html) 
                }}
              />
            ) : (
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {(() => {
                  let content = message.body || message.text;
                  // Handle JSON objects (for auto-followup messages)
                  if (typeof content === 'string' && content.startsWith('{') && content.includes('"body"')) {
                    try {
                      const parsed = JSON.parse(content);
                      content = parsed.body || content;
                    } catch (e) {
                      // If parsing fails, use the original content
                    }
                  }
                  // Apply consistent formatting
                  return formatEmailBody(content, 'text');
                })()}
              </div>
            )}

            {/* Attachments */}
            {renderAttachments(message.attachments || [])}
          </div>

          {/* Message metadata */}
          <div className={`mt-2 text-xs text-gray-500 ${isOutgoing ? 'text-right' : ''}`}>
            <span className="font-medium">{formatEmailAddress(message.from)}</span>
            <span className="mx-2">•</span>
            <span title={formatAbsoluteTime(message.date)}>
              {formatAbsoluteTime(message.date)}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Debug info */}
      <div className="p-2 bg-blue-100 text-xs text-gray-700 border-b">
        ThreadView Debug: threadId={threadId}, messages={messages?.length || 0}, recipients={recipients?.length || 0}
      </div>
      {/* Super visible debug element */}
      <div className="p-4 bg-red-500 text-white text-center font-bold text-lg">
        🚨 THREADVIEW IS RENDERING! 🚨
      </div>
      {/* Thread header */}
      <div className="p-6 border-b border-gray-200 bg-white">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              {(() => {
                // Get the original subject from the first message (not the "Re:" subject)
                if (messages && messages.length > 0) {
                  const firstMessage = messages[0];
                  // If first message has a subject that's not "Re: No Subject", use it
                  if (firstMessage.subject && !firstMessage.subject.includes('Re: No Subject')) {
                    return firstMessage.subject;
                  }
                  // Otherwise, try to extract from the original subject if it exists
                  if (firstMessage.subject && firstMessage.subject.startsWith('Re:')) {
                    // Remove "Re:" and any extra spaces, but keep the actual subject
                    const cleanSubject = firstMessage.subject.replace(/^Re:\s*/, '').trim();
                    return cleanSubject || 'No Subject';
                  }
                }
                return subject || 'No Subject';
              })()}
            </h1>
            
            {/* Recipients */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">To:</span>
              <div className="flex flex-wrap gap-1">
                {recipients.map((recipient, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                    title={formatEmailAddress(recipient)}
                  >
                    {recipient.name || recipient.email}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={onReplyAll}
              className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
            >
              Reply All
            </button>
            {onDelete && (
              <button
                onClick={onDelete}
                className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
              >
                Delete Thread
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((message, index) => renderMessage(message, index))}
      </div>
    </div>
  );
};
