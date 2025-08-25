import axios from 'axios';

export default {
  name: 'search_contacts',
  description: 'Search for contacts using various criteria like title, industry, location',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query (e.g., "Product Manager", "CEO", "Engineering")'
      },
      company: {
        type: 'string',
        description: 'Company name (optional)'
      },
      location: {
        type: 'string',
        description: 'Location (optional)'
      },
      industry: {
        type: 'string',
        description: 'Industry (optional)'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results (default: 10)'
      }
    },
    required: ['query']
  },
  handler: async ({ query, company, location, industry, limit = 10 }) => {
    try {
      const lushaApiKey = process.env.LUSHA_API_KEY;
      if (!lushaApiKey) {
        throw new Error('LUSHA_API_KEY environment variable not set');
      }

      const params = { query, limit };
      if (company) params.company = company;
      if (location) params.location = location;
      if (industry) params.industry = industry;

      const response = await axios.get('https://api.lusha.com/contact/search', {
        headers: {
          'Authorization': `Bearer ${lushaApiKey}`,
          'Content-Type': 'application/json'
        },
        params
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
