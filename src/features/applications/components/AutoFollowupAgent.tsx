import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Send, Plus, AlertCircle } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { apiUrls } from '../../../lib/config';

interface FollowupSchedule {
  id: string;
  threadId: string;
  scheduledAt: string;
  status: 'scheduled' | 'sent' | 'cancelled';
  followupDays?: number;
  followupHours?: number;
}

interface AutoFollowupAgentProps {
  threadId: string;
  leadId?: string;
}

export const AutoFollowupAgent: React.FC<AutoFollowupAgentProps> = ({ threadId, leadId }) => {
  const [schedules, setSchedules] = useState<FollowupSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [isTriggering, setIsTriggering] = useState(false);
  const [showTimingConfig, setShowTimingConfig] = useState(false);
  const [followupDays, setFollowupDays] = useState(3);
  const [followupHours, setFollowupHours] = useState(0);

  useEffect(() => {
    fetchSchedules();
  }, [threadId]);

  const fetchSchedules = async () => {
    try {
      const response = await fetch(apiUrls.ai(`/auto-followup/${threadId}`));
      const data = await response.json();
      if (data.success) {
        setSchedules(data.schedules);
      }
    } catch (error) {
      console.error('Failed to fetch schedules:', error);
    }
  };

  const scheduleFollowup = async () => {
    setIsScheduling(true);
    try {
      const response = await fetch(apiUrls.ai('/auto-followup'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          threadId, 
          leadId, 
          action: 'schedule',
          followupDays,
          followupHours
        })
      });
      
      const data = await response.json();
      if (data.success) {
        setSchedules(prev => [...prev, data.followup]);
        setShowTimingConfig(false);
      }
    } catch (error) {
      console.error('Failed to schedule followup:', error);
    } finally {
      setIsScheduling(false);
    }
  };

  const triggerFollowup = async () => {
    setIsTriggering(true);
    try {
      const response = await fetch(apiUrls.ai('/auto-followup'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId, leadId, action: 'trigger' })
      });
      
      const data = await response.json();
      if (data.success) {
        // Show success message
        alert('Auto-followup sent successfully!');
        // Refresh schedules to show the new follow-up
        fetchSchedules();
      }
    } catch (error) {
      console.error('Failed to trigger followup:', error);
      alert('Failed to send auto-followup');
    } finally {
      setIsTriggering(false);
    }
  };

  const formatScheduledTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 0) return 'Due now';
    if (diffDays === 1) return 'Tomorrow';
    return `In ${diffDays} days`;
  };

  const getNextScheduled = () => {
    const upcoming = schedules.filter(s => s.status === 'scheduled');
    return upcoming.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())[0];
  };

  const nextScheduled = getNextScheduled();

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-600" />
          Auto Follow-up Agent
        </h3>
        <Button
          onClick={() => setShowTimingConfig(!showTimingConfig)}
          disabled={isScheduling}
          size="sm"
          variant="outline"
          className="flex items-center gap-2"
        >
          {isScheduling ? (
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          Schedule Follow-up
        </Button>
      </div>

      {/* Timing Configuration */}
      {showTimingConfig && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Follow-up Timing</h4>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Days</label>
              <input
                type="number"
                min="0"
                max="365"
                value={followupDays}
                onChange={(e) => setFollowupDays(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Hours</label>
              <input
                type="number"
                min="0"
                max="23"
                value={followupHours}
                onChange={(e) => setFollowupHours(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={scheduleFollowup}
              disabled={isScheduling}
              size="sm"
              className="flex items-center gap-2"
            >
              {isScheduling ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Schedule Follow-up
            </Button>
            <Button
              onClick={() => setShowTimingConfig(false)}
              size="sm"
              variant="outline"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Next Scheduled Follow-up */}
      {nextScheduled && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">
                Next Follow-up: {formatScheduledTime(nextScheduled.scheduledAt)}
              </span>
            </div>
            <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
              {new Date(nextScheduled.scheduledAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex gap-2">
        <Button
          onClick={triggerFollowup}
          disabled={isTriggering}
          size="sm"
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
        >
          {isTriggering ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          Follow-up Now
        </Button>
        
        {schedules.length === 0 && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <AlertCircle className="w-4 h-4" />
            No follow-ups scheduled
          </div>
        )}
      </div>

      {/* All Schedules */}
      {schedules.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">All Schedules</h4>
          <div className="space-y-2">
            {schedules.map((schedule) => (
              <div
                key={schedule.id}
                className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded"
              >
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-500" />
                  <span>{formatScheduledTime(schedule.scheduledAt)}</span>
                </div>
                <span className={`px-2 py-1 rounded text-xs ${
                  schedule.status === 'scheduled' 
                    ? 'bg-blue-100 text-blue-800' 
                    : schedule.status === 'sent'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {schedule.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
