# Lazy Bird - AI-Powered Job Search Copilot

An intelligent application that helps streamline your job search process with AI-powered content generation, Gmail integration, and automated follow-up management.

## 🚀 Features

- **AI-Powered Content Generation**: Generate personalized cover letters, emails, and follow-ups
- **Gmail Integration**: Seamless email management and thread tracking
- **Lead Management**: Capture and enrich job opportunities from various sources
- **Auto Follow-up Agent**: Automated follow-up scheduling and execution
- **Contact Enrichment**: Lusha integration for contact information
- **Resume Management**: Upload and manage multiple resume versions

## 🔐 Security & Environment Setup

### Required Environment Variables

Copy `.env.example` to `.env` and fill in your actual values:

```bash
cp .env.example .env
```

**Required Variables:**
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `OPENAI_API_KEY` - OpenAI API key for AI content generation
- `GMAIL_CLIENT_ID` - Google OAuth2 client ID
- `GMAIL_CLIENT_SECRET` - Google OAuth2 client secret
- `GMAIL_REFRESH_TOKEN` - Gmail OAuth2 refresh token
- `LUSHA_API_KEY` - Lusha API key for contact enrichment

### Security Notes

⚠️ **IMPORTANT**: Never commit your `.env` file or any files containing real API keys to version control.

The following files are automatically ignored by git:
- `.env` files
- OAuth test files
- Debug and setup scripts
- Sensitive configuration files

## 🛠️ Installation & Setup

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account
- OpenAI API key
- Google Cloud Console project with Gmail API enabled
- Lusha API key (optional)

### Backend Setup

```bash
cd server
npm install
npm start
```

### Frontend Setup

```bash
npm install
npm run dev
```

### Database Setup

```bash
# Run database migrations
node run_migration.js

# Setup vector database
node setup_vector_db.js
```

## 📱 Usage

1. **Configure Settings**: Add your API keys in the Settings page
2. **Upload Resume**: Add your resume in the Workspace
3. **Create Leads**: Capture job opportunities from screenshots, URLs, or manual entry
4. **Generate Content**: Use AI to create personalized cover letters and emails
5. **Send Applications**: Send applications directly through Gmail integration
6. **Track Follow-ups**: Manage automated follow-up scheduling

## 🔧 Development

### Project Structure

```
src/
├── components/          # Reusable UI components
├── features/           # Feature-specific components
├── lib/               # Utilities and API clients
├── pages/             # Page components
├── stores/            # State management
└── types/             # TypeScript type definitions

server/
├── index.js           # Main server file
├── services/          # Business logic services
└── setup_database.js  # Database initialization
```

### Adding New Features

1. Create feature components in `src/features/`
2. Add API endpoints in `server/index.js`
3. Update types in `src/types/`
4. Add tests and documentation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Ensure all tests pass
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For issues and questions:
1. Check the documentation
2. Search existing issues
3. Create a new issue with detailed information

---

**Remember**: Keep your API keys secure and never expose them in your code or version control!
