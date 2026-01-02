# LinkedIn Auto-Poster for RAD AI

🤖 Automated LinkedIn posting system with AI-generated content, human-like behavior, and smart scheduling.

**Company:** RAD AI (Rational Automation Design)
**Purpose:** Drive client engagement through consistent, high-quality LinkedIn presence

---

## ⚠️ IMPORTANT DISCLAIMER

**This tool automates LinkedIn posting using browser automation (Puppeteer), which violates LinkedIn's Terms of Service.**

### Risks:
- ❌ Account suspension or permanent ban
- ❌ Shadowban (posts stop showing up)
- ❌ IP address blocking
- ❌ Professional reputation damage if detected

### Use at your own risk. We recommend:
1. Use a secondary/test account first
2. Start with manual approval mode
3. Monitor closely for the first week
4. Have a backup plan if account is banned

---

## ✨ Features

### 🧠 AI-Powered Content Generation
- GPT-4 generates authentic, engaging posts
- 15+ topic categories relevant to automation/AI
- 7 different writing styles for variety
- Customized for RAD AI's brand voice
- Smart hashtag inclusion

### 💬 Auto-Reply to LinkedIn DMs (NEW!)
- **Voice Learning**: Analyzes your past messages to match your writing style
- **Smart Reply Generation**: Creates personalized responses in YOUR voice
- **Sales Pitch Detection**: Automatically skips spam messages
- **Approval Mode**: Review replies before sending (optional)
- **Scheduled Checks**: Automatically checks for new messages every 30 minutes
- **Natural Language**: No em dashes, minimal emojis, your exact phrasing
- **Website Promotion**: Naturally mentions itsradai.com when relevant

### 🎭 Anti-Detection Measures
- Random delays between actions (2-8 seconds)
- Human-like typing simulation
- Randomized posting times (±30 minutes)
- Mouse movements and scrolling
- Real browser (non-headless mode available)
- Session persistence between runs

### 📅 Smart Scheduling
- Posts 1x daily (checks hourly)
- Auto-reply checks every 30 minutes
- Automatic time randomization
- Pre-generates content queue
- Auto-retry on failures

### 📊 Management Tools
- CLI for queue management
- Post history tracking
- Success/failure logging
- Screenshot capture
- Manual approval mode

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd /Users/antoniomartinez/linkedInAuto
npm install
```

### 2. Configure Environment

```bash
# Copy example config
cp .env.example .env

# Edit .env with your credentials
nano .env
```

**Required settings in `.env`:**
```env
LINKEDIN_EMAIL=your-email@example.com
LINKEDIN_PASSWORD=your-linkedin-password
OPENAI_API_KEY=sk-your-openai-api-key

# Optional: Customize schedule (cron format)
MORNING_SCHEDULE=0 9 * * 1-5
AFTERNOON_SCHEDULE=0 15 * * 1-5

# Safety
HEADLESS=false
REQUIRE_APPROVAL=false
```

### 3. Test First

```bash
# Test with manual approval
npm run test
```

This will:
1. Generate a post
2. Show you the content
3. Ask for confirmation
4. Post to LinkedIn if you approve

### 4. Start Auto-Posting

```bash
npm start
```

The scheduler will now run in the background and post 2x daily.

---

## 📋 CLI Commands

### Generate Posts
```bash
npm run generate      # Generate 5 posts
node cli.js generate 10   # Generate 10 posts
```

### View Queue
```bash
npm run queue
```

### View History
```bash
npm run history
```

### Clear Queue
```bash
npm run clear
```

---

## 🛠 How It Works

### 1. Content Generation (`contentGenerator.js`)
- Randomly selects topic + writing style
- Calls OpenAI GPT-4 to generate post
- Adds relevant hashtags
- Saves to queue

### 2. Browser Automation (`linkedinBot.js`)
- Launches Puppeteer browser
- Logs into LinkedIn with your credentials
- Navigates to feed
- Types post with human-like delays
- Clicks "Post" button
- Takes screenshots for verification

### 3. Scheduling (`scheduler.js`)
- Runs on cron schedule (default 9 AM & 3 PM)
- Adds ±30 min randomization
- Pulls from queue
- Executes post
- Logs result

### 4. Safety Features
- Session persistence (stays logged in)
- Screenshot capture (pre/post)
- Error logging
- Auto-retry failed posts
- Manual approval mode

---

## 🎯 Customization

### Change Posting Schedule

Edit `.env`:
```env
# Post at 10 AM and 5 PM
MORNING_SCHEDULE=0 10 * * 1-5
AFTERNOON_SCHEDULE=0 17 * * 1-5

# Post every day (including weekends)
MORNING_SCHEDULE=0 9 * * *
AFTERNOON_SCHEDULE=0 15 * * *

# Post 3x daily
MORNING_SCHEDULE=0 9 * * 1-5
AFTERNOON_SCHEDULE=0 14 * * 1-5
EVENING_SCHEDULE=0 18 * * 1-5
```

### Add Custom Topics

Edit `contentGenerator.js`:
```javascript
const POST_TOPICS = [
  'AI automation benefits for businesses',
  'Your custom topic here',
  // Add more topics...
];
```

### Adjust Content Style

Modify the prompt in `contentGenerator.js`:
```javascript
const prompt = `You are writing a LinkedIn post for RAD AI...
Guidelines:
- Keep it between 150-300 words
- Use your custom guidelines here
...`;
```

---

## 📊 File Structure

```
linkedInAuto/
├── index.js              # Main entry point
├── scheduler.js          # Cron job manager
├── linkedinBot.js        # Puppeteer automation
├── contentGenerator.js   # AI content creation
├── cli.js                # Management CLI
├── testPost.js           # Manual test script
├── .env                  # Your config (create from .env.example)
├── package.json
├── posts/
│   ├── queue.json       # Upcoming posts
│   └── history.json     # Posted content log
├── screenshots/         # Verification screenshots
└── user-data/           # Browser session data
```

---

## 🔒 Security Best Practices

### 1. Protect Your Credentials
```bash
# Never commit .env to git
echo ".env" >> .gitignore

# Set proper permissions
chmod 600 .env
```

### 2. Use App-Specific Password
- Enable 2FA on LinkedIn
- Create app-specific password if available
- Don't use your main password

### 3. Monitor Activity
```bash
# Check history regularly
npm run history

# Review screenshots
open screenshots/
```

### 4. Start Slow
- Week 1: Post once per day
- Week 2: Increase to 2x daily
- Monitor for any warnings from LinkedIn

---

## 🐛 Troubleshooting

### Login Fails
- Check credentials in `.env`
- LinkedIn may have captcha - run with `HEADLESS=false` to solve manually
- 2FA may block automation - disable or use app password

### Posts Not Publishing
- Check `screenshots/` folder for error images
- Review `posts/history.json` for error messages
- Ensure LinkedIn UI hasn't changed (selectors may need updating)

### Browser Crashes
- Increase system memory
- Close other applications
- Run with `HEADLESS=true` to save resources

### OpenAI Errors
- Verify API key is correct
- Check API quota/billing
- Review rate limits

---

## 📈 Tips for Success

### Content Strategy
1. **Variety is key** - The AI generates diverse topics, but monitor for repetition
2. **Engage with responses** - Auto-posting isn't enough; reply to comments manually
3. **Quality over quantity** - Review generated posts periodically
4. **Stay authentic** - The AI mimics thought leadership, but add personal touches

### Avoid Detection
1. **Don't post at exactly the same time** - The ±30 min randomization helps
2. **Vary your schedule occasionally** - Manual posts on weekends look more human
3. **Engage with other content** - Don't just post; like and comment manually
4. **Monitor engagement** - Sudden drops may indicate shadowban

### Best Practices
1. **Pre-generate queue** - Always keep 5+ posts ready
2. **Review weekly** - Check history and adjust topics
3. **Test new content** - Use `npm run test` for manual approval
4. **Keep screenshots** - They're your proof of what was posted

---

## 🚨 Emergency Stop

If LinkedIn sends a warning or you notice issues:

```bash
# Stop the scheduler immediately
Ctrl+C

# Clear the queue
npm run clear

# Review what was posted
npm run history

# Delete browser data to reset session
rm -rf user-data/
```

---

## 📞 Support

**Issues?** Check the screenshots and logs:
- `screenshots/` - Visual confirmation of each action
- `posts/history.json` - Full posting history
- Terminal output - Real-time status

**LinkedIn Changed UI?**
The selectors in `linkedinBot.js` may need updating. Common selectors to check:
- "Start a post" button
- Post editor
- "Post" publish button

---

## 📝 License

MIT License - Use at your own risk

---

## 🎯 Roadmap

Future enhancements (not yet implemented):
- [ ] Image generation and posting
- [ ] Video content support
- [ ] Comment automation
- [ ] Analytics dashboard
- [ ] Multi-account support
- [ ] Proxy rotation
- [ ] Advanced NLP for better content

---

**Built with ☕️ by RAD AI**

*Remember: Automation is powerful, but authentic engagement drives real relationships. Use this tool to maintain visibility, but always engage genuinely with your network.*
