# 🚀 Quick Start Guide

## Step 1: Get Your OpenAI API Key

1. Go to https://platform.openai.com/api-keys
2. Click "Create new secret key"
3. Copy the key (starts with `sk-`)

## Step 2: Configure

```bash
cd /Users/antoniomartinez/linkedin-autoposter

# Create your .env file
cp .env.example .env

# Edit it (use nano, vim, or any text editor)
nano .env
```

**Fill in these 3 required fields:**
```env
LINKEDIN_EMAIL=your-email@example.com
LINKEDIN_PASSWORD=your-password
OPENAI_API_KEY=sk-your-key-here
```

Save and exit (Ctrl+X, then Y, then Enter)

## Step 3: Test It

```bash
npm run test
```

This will:
1. Generate a post
2. Show it to you
3. Ask if you want to post it
4. Post to LinkedIn if you say "yes"

**IMPORTANT:** A browser will open. DO NOT close it! Let it run.

## Step 4: Start Auto-Posting

Once the test works:

```bash
npm start
```

**That's it!** The system will now:
- Post 2x daily (9 AM & 3 PM on weekdays)
- Generate fresh content automatically
- Run in the background

### To Stop:
Press `Ctrl+C`

---

## Common Commands

```bash
npm start           # Start auto-posting
npm run test        # Test with one post (manual approval)
npm run generate    # Pre-generate 5 posts
npm run queue       # See what's queued
npm run history     # See what's been posted
```

---

## ⚠️ Important Notes

1. **Keep the terminal open** - Closing it stops the scheduler
2. **Don't close the browser** - It needs to stay open
3. **First time may be slow** - Puppeteer downloads Chromium (~200MB)
4. **Watch for login issues** - LinkedIn may ask for verification

## Run in Background (Advanced)

To keep it running even after closing terminal:

```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start index.js --name linkedin-autoposter

# View logs
pm2 logs linkedin-autoposter

# Stop
pm2 stop linkedin-autoposter
```

---

**Need help?** Check the full README.md for troubleshooting.
