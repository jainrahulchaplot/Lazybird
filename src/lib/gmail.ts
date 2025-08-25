// Gmail API utility for browser environment
export const gmailUtils = {
  // Test Gmail connection using backend proxy
  async testConnection() {
    try {
      const response = await fetch('http://localhost:3001/api/gmail/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const result = await response.json();
      return result;
    } catch (error: any) {
      console.error('Gmail connection test failed:', error);
      return {
        success: false,
        error: error.message || 'Gmail connection failed'
      };
    }
  },

  // Send email using backend proxy
  async sendEmail(leadId: string, contactEmail: string, coverLetter: string, resumePath?: string) {
    try {
      const response = await fetch('http://localhost:3001/api/gmail/send-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          contactEmail,
          coverLetter,
          resumePath
        })
      });

      const result = await response.json();
      return result;
    } catch (error: any) {
      console.error('Failed to send email:', error);
      return {
        success: false,
        error: error.message || 'Failed to send email'
      };
    }
  },

  // Initiate OAuth2 authorization flow
  async initiateAuth() {
    try {
      // Redirect to the auth endpoint
      window.location.href = '/api/gmail/auth';
    } catch (error) {
      console.error('Failed to initiate auth:', error);
      throw error;
    }
  }
};
