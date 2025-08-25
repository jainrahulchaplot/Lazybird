import axios from 'axios';

export default {
  name: 'find_contact_by_email',
  description: 'Find contact information and company details using an email address',
  inputSchema: {
    type: 'object',
    properties: {
      email: {
        type: 'string',
        description: 'Email address to search for'
      }
    },
    required: ['email']
  },
  handler: async ({ email }) => {
    try {
      const lushaApiKey = process.env.LUSHA_API_KEY;
      if (!lushaApiKey) {
        throw new Error('LUSHA_API_KEY environment variable not set');
      }

      const response = await axios.get('https://api.lusha.com/contact/find', {
        headers: {
          'Authorization': `Bearer ${lushaApiKey}`,
          'Content-Type': 'application/json'
        },
        params: { email }
      });

      return {
        success: true,
        data: response.data,
        source: 'Lusha API'
      };
    } catch (error) {
      console.error('Lusha API error:', error.message);
      return {
        success: false,
        error: error.message,
        source: 'Lusha API'
      };
    }
  }
};
