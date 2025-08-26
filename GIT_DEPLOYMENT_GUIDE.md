# Git Deployment Guide for LazyBird

## 🚀 **Deployment Process**

### **1. Environment Variables Setup**

When deploying to production, you'll need to set up environment variables. **Never commit sensitive data to Git!**

#### **Required Environment Variables:**

```bash
# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-api-key-here

# Gmail OAuth2 Configuration
GMAIL_CLIENT_ID=your-gmail-client-id.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=your-gmail-client-secret
GMAIL_REFRESH_TOKEN=your-gmail-refresh-token

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

#### **Environment File Structure:**

```bash
# .env (local development - DO NOT COMMIT)
.env

# .env.example (safe to commit - template)
.env.example

# Production environment variables (set on hosting platform)
# Vercel, Railway, Heroku, etc.
```

### **2. Git Workflow**

#### **Initial Setup:**
```bash
# Clone the repository
git clone <your-repo-url>
cd LazyBird

# Create environment file from template
cp .env.example .env

# Edit .env with your actual values
nano .env

# Install dependencies
npm install

# Start development server
npm run dev
```

#### **Making Changes:**
```bash
# Create a new branch
git checkout -b feature/your-feature-name

# Make your changes
# ... edit files ...

# Test your changes
npm run dev

# Commit your changes
git add .
git commit -m "feat: add your feature description"

# Push to remote
git push origin feature/your-feature-name

# Create pull request
# ... via GitHub/GitLab interface ...
```

#### **Deployment:**
```bash
# Merge to main branch
git checkout main
git merge feature/your-feature-name

# Push to production
git push origin main

# Your hosting platform will automatically deploy
```

### **3. Environment Variable Management**

#### **Local Development:**
- Use `.env` file for local development
- Add `.env` to `.gitignore` to prevent committing secrets
- Use `.env.example` as a template

#### **Production Deployment:**
- Set environment variables on your hosting platform
- **Never commit `.env` files to Git**
- Use platform-specific environment variable management

#### **Platform-Specific Setup:**

**Vercel:**
```bash
# Set environment variables in Vercel dashboard
# Or use Vercel CLI
vercel env add OPENAI_API_KEY
vercel env add GMAIL_CLIENT_ID
vercel env add GMAIL_CLIENT_SECRET
vercel env add GMAIL_REFRESH_TOKEN
vercel env add SUPABASE_URL
vercel env add SUPABASE_SERVICE_ROLE_KEY
```

**Railway:**
```bash
# Set environment variables in Railway dashboard
# Or use Railway CLI
railway variables set OPENAI_API_KEY=your-key
railway variables set GMAIL_CLIENT_ID=your-id
# ... etc
```

**Heroku:**
```bash
# Set environment variables
heroku config:set OPENAI_API_KEY=your-key
heroku config:set GMAIL_CLIENT_ID=your-id
# ... etc
```

### **4. Database Migrations**

#### **Local Database Setup:**
```bash
# Run migrations locally
npm run migrate

# Or manually in Supabase dashboard
# Copy SQL from supabase/migrations/ files
```

#### **Production Database:**
- Run migrations in Supabase dashboard
- Or use Supabase CLI:
```bash
supabase db push
```

### **5. Security Best Practices**

#### **Never Commit:**
- `.env` files
- API keys
- OAuth tokens
- Database credentials
- Private keys

#### **Safe to Commit:**
- `.env.example` (template with placeholder values)
- Configuration files (without secrets)
- Code files
- Documentation

#### **Environment Variable Validation:**
```bash
# Add to your deployment script
if [ -z "$OPENAI_API_KEY" ]; then
  echo "❌ OPENAI_API_KEY is not set"
  exit 1
fi

if [ -z "$GMAIL_CLIENT_ID" ]; then
  echo "❌ GMAIL_CLIENT_ID is not set"
  exit 1
fi

# ... etc
```

### **6. Troubleshooting**

#### **Common Issues:**

**Settings Not Syncing:**
- Check if environment variables are set correctly
- Verify database migrations are applied
- Check server logs for errors

**Gmail Authentication Issues:**
- Ensure OAuth2 credentials are correct
- Check if refresh token is valid
- Verify Gmail API is enabled

**OpenAI API Issues:**
- Verify API key is valid
- Check API quota/limits
- Ensure correct model access

#### **Debug Commands:**
```bash
# Check environment variables
echo $OPENAI_API_KEY
echo $GMAIL_CLIENT_ID

# Test API endpoints
curl http://localhost:3001/api/settings
curl http://localhost:3001/api/health

# Check database connection
curl http://localhost:3001/api/leads
```

### **7. Monitoring & Maintenance**

#### **Health Checks:**
- Monitor `/api/health` endpoint
- Set up uptime monitoring
- Check error logs regularly

#### **Backup Strategy:**
- Regular database backups
- Environment variable backups (secure)
- Code repository backups

#### **Updates:**
- Keep dependencies updated
- Monitor security advisories
- Test updates in staging environment

---

## 📋 **Quick Deployment Checklist**

- [ ] Environment variables set on hosting platform
- [ ] Database migrations applied
- [ ] API keys and tokens configured
- [ ] Gmail OAuth2 setup complete
- [ ] Supabase project configured
- [ ] Domain and SSL configured
- [ ] Health checks passing
- [ ] Error monitoring set up
- [ ] Backup strategy implemented

---

## 🔧 **Support**

If you encounter issues:
1. Check the troubleshooting section
2. Review server logs
3. Verify environment variables
4. Test API endpoints
5. Check database connectivity

For additional help, refer to the main documentation or create an issue in the repository.
