# Lazy Bird - AI-Powered Job Search Copilot

An intelligent application that helps streamline your job search process with AI-powered content generation, Gmail integration, and automated follow-up management. Built with React, Node.js, and modern AI technologies.

## 🚀 Features

### Core Functionality
- **AI-Powered Content Generation**: Generate personalized cover letters, emails, and follow-ups using OpenAI GPT-4
- **Gmail Integration**: Seamless email management with OAuth2 authentication and thread tracking
- **Lead Management**: Capture and enrich job opportunities from screenshots, URLs, or manual entry
- **Auto Follow-up Agent**: Intelligent follow-up scheduling and execution with customizable timing
- **Contact Enrichment**: Lusha integration for contact information and lead enrichment
- **Resume Management**: Upload and manage multiple resume versions with AI-powered analysis

### Advanced Features
- **Thread Tracking System**: Persistent tracking of email threads across sessions
- **Mobile-Optimized**: Enhanced mobile experience with timeout handling and error recovery
- **Email Formatting Parity**: Consistent formatting across all email generation flows
- **Knowledge Base Integration**: AI uses your resume and company research for personalized content
- **Real-time Updates**: Live email synchronization and delta updates
- **Error Recovery**: Robust error handling with mobile-specific optimizations

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

The backend server runs on port 3001 with the following features:
- Mobile-optimized timeout handling (30s for mobile, 15s for desktop)
- Enhanced error logging and debugging
- Thread tracking persistence
- Email formatting utilities

### Frontend Setup

```bash
npm install
npm run dev
```

The frontend includes:
- Mobile-responsive design
- Enhanced error handling and user feedback
- Debug logging for mobile devices
- Optimized data fetching with timeout management

### Database Setup

```bash
# Create thread tracking table
psql -h your-supabase-host -U postgres -d postgres -f supabase/migrations/20250825_thread_tracking_enhanced.sql

# Or run the migration script
node supabase/migrations/run_migration.js
```

### Vercel Deployment

The application is configured for Vercel deployment with:
- Function timeout optimization (30 seconds)
- CORS headers for mobile compatibility
- API route optimization

## 📱 Mobile Optimizations

### Recent Improvements
- **Enhanced Error Handling**: Mobile-specific error messages and recovery
- **Timeout Management**: Extended timeouts for mobile network conditions
- **Debug Logging**: Comprehensive logging for mobile troubleshooting
- **Request Queue Management**: Better handling of concurrent mobile requests
- **Error Recovery**: Automatic retry mechanisms and fallback strategies

### Mobile-Specific Features
- Device detection and adaptive behavior
- Optimized API response times
- Enhanced user feedback for slow connections
- Progressive loading and error states

## 🔧 Development

### Project Structure

```
src/
├── components/          # Reusable UI components
├── features/           # Feature-specific components
│   ├── applications/   # Email applications and thread management
│   ├── leads/         # Lead capture and management
│   └── settings/      # Configuration and API setup
├── lib/               # Utilities and API clients
│   ├── hooks/         # Custom React hooks
│   ├── supabase.ts    # Database client
│   └── types/         # TypeScript definitions
├── pages/             # Page components
├── stores/            # Zustand state management
└── utils/             # Utility functions including email formatting

server/
├── index.js           # Main server with mobile optimizations
├── services/          # Business logic services
│   ├── documentProcessor.js    # Resume and document processing
│   └── aiEmailGenerator.js     # AI-powered email generation
└── migrations/        # Database schema updates
```

### Key Components

#### Email Generation System
- **Company Research API**: AI-powered company analysis using knowledge base
- **Fitment Analysis**: Role-specific candidate evaluation
- **Email Draft Generation**: Personalized email creation with formatting parity
- **Auto Follow-up**: Intelligent follow-up scheduling and execution

#### Thread Management
- **Persistent Tracking**: Database-backed thread tracking across sessions
- **System-Generated Detection**: Automatic identification of AI-generated emails
- **Hidden Thread Support**: Ability to hide irrelevant email threads
- **Full Thread Retrieval**: Complete message history with attachments

#### Mobile Optimizations
- **Timeout Handling**: Adaptive timeouts based on device type
- **Error Recovery**: Comprehensive error handling and user feedback
- **Debug Logging**: Detailed logging for troubleshooting
- **Performance Monitoring**: Request timing and success rate tracking

### Adding New Features

1. Create feature components in `src/features/`
2. Add API endpoints in `server/index.js` with mobile timeout handling
3. Update types in `src/types/`
4. Add mobile-specific error handling and logging
5. Test on both desktop and mobile devices
6. Add tests and documentation

## 🚀 Recent Updates

### v2.0.0 - Mobile Optimization Release
- Enhanced mobile error handling and timeout management
- Improved API response times and reliability
- Comprehensive debug logging for troubleshooting
- Better user experience on mobile devices

### v1.5.0 - Thread Tracking Enhancement
- Persistent thread tracking across sessions
- System-generated email detection
- Hidden thread management
- Enhanced email formatting consistency

### v1.0.0 - Core Features
- AI-powered email generation
- Gmail integration with OAuth2
- Lead management system
- Auto follow-up scheduling

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with mobile considerations
4. Ensure all tests pass on both desktop and mobile
5. Submit a pull request with detailed testing notes

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support & Troubleshooting

### Common Issues

#### Mobile Loading Problems
- Check Vercel environment variables are set correctly
- Verify API timeouts are sufficient for mobile networks
- Check browser console for detailed error messages
- Ensure CORS is properly configured

#### Email Generation Issues
- Verify OpenAI API key is valid and has sufficient credits
- Check knowledge base configuration
- Ensure resume uploads are successful
- Verify Gmail OAuth credentials

#### Database Connection Issues
- Confirm Supabase credentials are correct
- Check network connectivity to Supabase
- Verify database schema is up to date
- Check for rate limiting or quota issues

### Getting Help

1. Check the documentation and troubleshooting guide
2. Search existing issues for similar problems
3. Create a new issue with:
   - Device type and browser information
   - Detailed error messages
   - Steps to reproduce the issue
   - Console logs and network tab information

## 🔮 Roadmap

### Upcoming Features
- **Advanced Analytics**: Job application success tracking and insights
- **Multi-Platform Support**: Integration with LinkedIn, Indeed, and other platforms
- **AI Training**: Custom AI model training on your application history
- **Team Collaboration**: Multi-user support for recruitment teams
- **Advanced Scheduling**: AI-powered optimal follow-up timing

### Performance Improvements
- **Caching Layer**: Redis integration for faster data access
- **CDN Integration**: Global content delivery optimization
- **Database Optimization**: Query performance improvements
- **Mobile App**: Native iOS and Android applications

---

**Remember**: Keep your API keys secure and never expose them in your code or version control!

For the latest updates and detailed technical information, check the project documentation and release notes.
