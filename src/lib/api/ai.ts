import { DraftReplyRequest, DraftReplyResponse } from '../types/applications';

const API_BASE = 'http://localhost:3001/api';

export const aiApi = {
  // Generate AI-drafted reply based on thread context
  async draftReply(request: DraftReplyRequest): Promise<DraftReplyResponse> {
    const response = await fetch(`${API_BASE}/ai/draft-reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to generate draft reply: ${response.statusText}`);
    }
    
    const data = await response.json();
    if (data.success && data.draft) {
      return data;
    }
    throw new Error('Failed to generate draft reply');
  }
};
