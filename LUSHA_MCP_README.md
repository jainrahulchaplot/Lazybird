# Lusha MCP Server

A Model Context Protocol (MCP) server that integrates with Lusha's sales intelligence API to provide contact finding, company enrichment, and lead generation capabilities.

## 🚀 Features

- **Contact Finding**: Find contact information by email, name, or company
- **Company Enrichment**: Get detailed company information and insights
- **Employee Discovery**: Find employees and contacts at specific companies
- **Advanced Search**: Search contacts by title, industry, location, and more
- **MCP Integration**: Seamlessly integrates with AI models and tools

## 🛠️ Installation

1. **Clone or download** the server files
2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   ```bash
   export LUSHA_API_KEY="your_lusha_api_key_here"
   ```
   
   Or create a `.env` file:
   ```bash
   LUSHA_API_KEY=your_lusha_api_key_here
   ```

## 🔑 Getting Your Lusha API Key

1. Sign up at [Lusha.com](https://www.lusha.com/)
2. Go to your account settings
3. Navigate to API section
4. Generate a new API key
5. Copy the key and set it as `LUSHA_API_KEY`

## 🚀 Usage

### Start the Server

```bash
npm start
# or
node lusha-mcp-server.js
```

### Available Tools

#### 1. Find Contact by Email
```json
{
  "name": "find_contact_by_email",
  "input": {
    "email": "john.doe@company.com"
  }
}
```

#### 2. Find Contact by Name and Company
```json
{
  "name": "find_contact_by_name_company",
  "input": {
    "firstName": "John",
    "lastName": "Doe",
    "company": "Tech Corp"
  }
}
```

#### 3. Enrich Company Information
```json
{
  "name": "enrich_company",
  "input": {
    "company": "Tech Corp"
  }
}
```

#### 4. Find Company Employees
```json
{
  "name": "find_company_employees",
  "input": {
    "company": "Tech Corp",
    "limit": 20
  }
}
```

#### 5. Search Contacts by Criteria
```json
{
  "name": "search_contacts",
  "input": {
    "query": "Product Manager",
    "company": "Tech Corp",
    "location": "San Francisco",
    "industry": "Technology",
    "limit": 15
  }
}
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `LUSHA_API_KEY` | Your Lusha API key | Yes |

### MCP Configuration

Add this to your MCP client configuration (e.g., `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "lusha": {
      "command": "node",
      "args": ["/path/to/lusha-mcp-server.js"],
      "env": {
        "LUSHA_API_KEY": "828cd5f9-fb06-43c1-8221-ef95b0a56bcd"
      }
    }
  }
}
```

## 📊 API Endpoints

The server integrates with these Lusha API endpoints:

- `GET /contact/find` - Find contact information
- `GET /company/enrich` - Enrich company data
- `GET /company/employees` - Find company employees
- `GET /contact/search` - Search contacts by criteria

## 🎯 Use Cases

### Lead Generation
- Find decision makers at target companies
- Enrich lead data with company insights
- Discover new prospects in specific industries

### Sales Intelligence
- Research companies before outreach
- Find contact information for prospects
- Understand company structure and hierarchy

### Market Research
- Analyze company landscapes
- Identify key players in industries
- Track company growth and changes

## ⚠️ Rate Limits

Lusha API has rate limits based on your plan:
- **Free**: Limited requests per month
- **Paid Plans**: Higher limits and priority access

Check your plan details at [Lusha.com](https://www.lusha.com/pricing/)

## 🐛 Troubleshooting

### Common Issues

1. **API Key Not Set**
   ```
   ⚠️  LUSHA_API_KEY environment variable not set
   ```
   Solution: Set the environment variable with your API key

2. **Rate Limit Exceeded**
   ```
   ❌ Rate limit exceeded
   ```
   Solution: Wait or upgrade your Lusha plan

3. **Invalid API Key**
   ```
   ❌ Unauthorized
   ```
   Solution: Check your API key is correct

### Debug Mode

Enable debug logging by setting:
```bash
export DEBUG=mcp:*
```

## 📝 License

MIT License - see LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📞 Support

- **Lusha API Docs**: [docs.lusha.com](https://docs.lusha.com/)
- **MCP Documentation**: [modelcontextprotocol.io](https://modelcontextprotocol.io/)
- **Issues**: Create an issue in this repository

---

**Built with ❤️ using the MCP Framework**

## **🚀 How to Get Emails for Your Contacts Using Lusha**

### **1. Start Your Lusha MCP Server**

First, make sure your Lusha MCP server is running:

```bash
cd /Users/rahul/Downloads/LazyBird
node lusha-mcp-server-simple.js
```

### **2. Update Your MCP Configuration**

Add the Lusha MCP server to your `.cursor/mcp.json` file:

```json
{
  "mcpServers": {
    "lusha": {
      "command": "node",
      "args": ["/Users/rahul/Downloads/LazyBird/lusha-mcp-server-simple.js"],
      "env": {
        "LUSHA_API_KEY": "828cd5f9-fb06-43c1-8221-ef95b0a56bcd"
      }
    }
  }
}
```

### **3. Use Lusha Tools in Your AI Assistant**

Now you can use these Lusha tools to find emails for your contacts:

#### **🔍 Find Contact by Email (Reverse Lookup)**
```json
{
  "name": "find_contact_by_email",
  "input": {
    "email": "john.doe@company.com"
  }
}
```

#### **👤 Find Contact by Name and Company**
```json
{
  "name": "find_contact_by_name_company",
  "input": {
    "firstName": "John",
    "lastName": "Doe", 
    "company": "Tech Corp"
  }
}
```

#### **🏢 Find Company Employees (Discover New Contacts)**
```json
{
  "name": "find_company_employees",
  "input": {
    "company": "Tech Corp",
    "limit": 20
  }
}
```

#### **🔍 Search Contacts by Criteria**
```json
{
  "name": "search_contacts",
  "input": {
    "query": "Product Manager",
    "company": "Tech Corp",
    "location": "San Francisco",
    "industry": "Technology",
    "limit": 15
  }
}
```

### **4. Practical Workflow for Your Lead Management**

#### **Scenario 1: You have a company name but need contacts**
1. Use `enrich_company` to get company details
2. Use `find_company_employees` to discover decision makers
3. Use `find_contact_by_name_company` to get specific contact details

#### **Scenario 2: You have a contact name but need email**
1. Use `find_contact_by_name_company` with the person's name and company
2. Lusha will return email, phone, LinkedIn, and other contact info

#### **Scenario 3: You want to find similar contacts**
1. Use `search_contacts` with criteria like "VP Engineering" + "Fintech"
2. Discover new prospects in your target industry

### **5. Integration with Your Lead Detail Page**

You could enhance your Lead Detail Page to use Lusha:

```typescript
// In your LeadDetailPage.tsx
const findContactWithLusha = async (firstName: string, lastName: string, company: string) => {
  // This would call your Lusha MCP server
  const response = await fetch('/api/lusha/find-contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ firstName, lastName, company })
  });
  
  const contactData = await response.json();
  
  if (contactData.success) {
    // Update your contact with Lusha data
    setSelectedContact({
      ...selectedContact,
      email: contactData.data.email,
      phone: contactData.data.phone,
      linkedin_url: contactData.data.linkedin
    });
  }
};
```

### **6. Example: Finding Email for "John Doe at Tech Corp"**

1. **AI Assistant calls Lusha:**
   ```
   "Find contact information for John Doe at Tech Corp"
   ```

2. **Lusha MCP Server responds with:**
   ```json
   {
     "success": true,
     "data": {
       "firstName": "John",
       "lastName": "Doe",
       "email": "john.doe@techcorp.com",
       "phone": "+1-555-0123",
       "linkedin": "linkedin.com/in/johndoe",
       "title": "Senior Product Manager",
       "company": "Tech Corp"
     }
   }
   ```

3. **Your app updates the contact with real email data**

### **7. Benefits for Your Lead Management**

- **✅ Find real emails** instead of guessing
- **✅ Discover new contacts** at target companies
- **✅ Enrich existing contacts** with missing information
- **✅ Validate contact information** before outreach
- **✅ Find decision makers** at companies you're targeting

### **8. Rate Limits & Best Practices**

- **Free Lusha Plan**: Limited requests per month
- **Paid Plans**: Higher limits and priority access
- **Best Practice**: Cache results to avoid duplicate API calls
- **Use Case**: Perfect for lead research and contact discovery

### **9. Next Steps**

1. **Test the server**: Run `node lusha-mcp-server-simple.js`
2. **Add to MCP config**: Update your `.cursor/mcp.json`
3. **Test with AI**: Ask your AI assistant to find contacts using Lusha
4. **Integrate with app**: Build API endpoints to use Lusha data

**Now you can find real emails for your contacts using Lusha's powerful sales intelligence API!** 🎯✨

Would you like me to help you integrate this with your existing Lead Detail Page or create specific API endpoints for the Lusha integration?
