import axios from 'axios';

export default {
  name: 'find_contact_by_name_company',
  description: 'Find contact information using a person\'s name and company',
  inputSchema: {
    type: 'object',
    properties: {
      firstName: {
        type: 'string',
        description: 'First name of the person'
      },
      lastName: {
        type: 'string',
        description: 'Last name of the person'
      },
      company: {
        type: 'string',
        description: 'Company name'
      }
    },
    required: ['firstName', 'lastName', 'company']
  },
  handler: async ({ firstName, lastName, company }) => {
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
        params: { 
          firstName,
          lastName,
          company
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
