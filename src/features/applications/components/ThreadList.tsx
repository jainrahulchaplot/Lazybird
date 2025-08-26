import React from 'react';
import { Mail, Clock, Users, MessageSquare, Trash2 } from 'lucide-react';
import { ThreadSummary } from '../../../lib/types/applications';
import { formatRelativeTime, getInitials } from '../../../lib/ui/format';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { formatEmailAddress } from '../../../lib/utils/parseAddress';
import { Paperclip } from 'lucide-react';
import { Button } from '../../../components/ui/Button';

interface ThreadListProps {
  threads: ThreadSummary[];
  selectedThreadId?: string;
  onThreadSelect: (threadId: string) => void;
  onDeleteThread?: (threadId: string) => void;
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
}

export const ThreadList: React.FC<ThreadListProps> = ({
  threads,
  selectedThreadId,
  onThreadSelect,
  onDeleteThread,
  loading,
  hasMore,
  onLoadMore
}) => {
  if (loading && threads.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <Mail className="w-12 h-12 mb-4 opacity-50" />
        <p className="text-lg font-medium">No applications found</p>
        <p className="text-sm">Start by sending your first application email</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Thread list */}
      <div className="flex-1 overflow-y-auto">
        {threads.map((thread) => (
          <div
            key={thread.id}
            className={`p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
              selectedThreadId === thread.id 
                ? 'bg-blue-50 border-l-4 border-l-blue-500' 
                : ''
            }`}
          >
            <div 
              className="cursor-pointer"
              onClick={() => onThreadSelect(thread.id)}
            >
            <div className="space-y-2">
              {/* Subject */}
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 line-clamp-2">
                    {thread.subject}
                  </h3>
                  {/* Show indicator for threads with incoming replies */}
                  {thread.hasIncomingReplies && (
                    <div className="flex items-center gap-1 mt-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-xs text-green-600 font-medium">New reply</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center text-xs text-gray-500 ml-2">
                  <Clock className="w-3 h-3 mr-1" />
                  {formatRelativeTime(thread.updatedAt)}
                </div>
              </div>

              {/* Snippet */}
              <p className="text-sm text-gray-600 line-clamp-2">
                {thread.snippet}
              </p>

              {/* Recipients, Message Count, and Attachments */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-3 h-3 text-gray-400" />
                  <div className="flex items-center gap-1">
                    {thread.recipients.slice(0, 2).map((recipient, index) => (
                      <span
                        key={index}
                        className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded"
                        title={formatEmailAddress(recipient)}
                      >
                        {recipient.name}
                      </span>
                    ))}
                    {thread.recipients.length > 2 && (
                      <span className="text-xs text-gray-500">
                        +{thread.recipients.length - 2}
                      </span>
                    )}
                  </div>
                  
                  {/* Message count indicator */}
                  {thread.messageCount && thread.messageCount > 1 && (
                    <div className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                      <MessageSquare className="w-3 h-3" />
                      <span>{thread.messageCount}</span>
                    </div>
                  )}
                </div>
                
                {/* Attachment indicator */}
                {thread.attachments && thread.attachments.length > 0 && (
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Paperclip className="w-3 h-3" />
                    <span>{thread.attachments.length}</span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Delete button */}
            {onDeleteThread && (
              <div className="flex justify-end mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Trash2}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteThread(thread.id);
                  }}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  Delete
                </Button>
              </div>
            )}
            </div>
          </div>
        ))}
      </div>

      {/* Load more button */}
      {hasMore && (
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={onLoadMore}
            disabled={loading}
            className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <LoadingSpinner size="sm" />
                <span className="ml-2">Loading...</span>
              </div>
            ) : (
              'Load more'
            )}
          </button>
        </div>
      )}
    </div>
  );
};
