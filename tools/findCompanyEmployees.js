import axios from 'axios';

export default {
  name: 'find_company_employees',
  description: 'Find employees and contacts at a specific company',
  inputSchema: {
    type: 'object',
    properties: {
      company: {
        type: 'string',
        description: 'Company name or domain'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of employees to return (default: 10)'
      }
    },
    required: ['company']
  },
  handler: async ({ company, limit = 10 }) => {
    try {
      const lushaApiKey = process.env.LUSHA_API_KEY;
      if (!lushaApiKey) {
        throw new Error('LUSHA_API_KEY environment variable not set');
      }

      const response = await axios.get('https://api.lusha.com/company/employees', {
        headers: {
          'Authorization': `Bearer ${lushaApiKey}`,
          'Content-Type': 'application/json'
        },
        params: { 
          company,
          limit
        }
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
