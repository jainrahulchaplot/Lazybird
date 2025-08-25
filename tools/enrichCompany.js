import axios from 'axios';

export default {
  name: 'enrich_company',
  description: 'Get detailed company information and insights',
  inputSchema: {
    type: 'object',
    properties: {
      company: {
        type: 'string',
        description: 'Company name or domain'
      }
    },
    required: ['company']
  },
  handler: async ({ company }) => {
    try {
      const lushaApiKey = process.env.LUSHA_API_KEY;
      if (!lushaApiKey) {
        throw new Error('LUSHA_API_KEY environment variable not set');
      }

      const response = await axios.get('https://api.lusha.com/company/enrich', {
        headers: {
          'Authorization': `Bearer ${lushaApiKey}`,
          'Content-Type': 'application/json'
        },
        params: { company }
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
