import { Lead } from '../types/applications';
import { apiUrls } from '../config';

export const leadsApi = {
  // Get all leads
  async getLeads(): Promise<Lead[]> {
    const response = await fetch(apiUrls.leads());
    if (!response.ok) {
      throw new Error(`Failed to fetch leads: ${response.statusText}`);
    }
    
    const data = await response.json();
    // Transform the actual API response to match our Lead interface
    if (data.success && data.data) {
      return data.data.map((lead: any) => ({
        id: lead.id,
        name: `${lead.role} at ${lead.company}`,
        email: lead.company // Using company as email for now, since actual emails aren't in the response
      }));
    }
    return [];
  }
};
