# Quick Start Guide

## The Problem
Your automation wasn't running because:
1. ❌ The scheduler process wasn't running
2. ❌ LinkedIn verification code expired (codes only last ~30 minutes)

## The Solution (3 steps)

### Step 1: Get a Fresh Verification Code
```bash
npm run login
```
- Opens your browser
- You log in manually to LinkedIn
- Captures the verification code
- Automatically updates `.env`

### Step 2: Start the Scheduler
```bash
npm run scheduler-start
```

### Step 3: Verify It's Running
```bash
npm run scheduler-status
```

**That's it!** Your automation is now running. ✅

---

## What It Does (Automatically)

- 📱 **Every 30 minutes**: Checks for unread DMs and replies in your voice
- 📄 **Every hour**: Checks if you've posted today (posts at 9 AM - 5 PM)
- 💼 **9:30 AM & 2 PM (weekdays)**: Searches and applies to jobs

## Managing the Scheduler

```bash
npm run scheduler-start      # Start background scheduler
npm run scheduler-stop       # Stop scheduler
npm run scheduler-restart    # Restart scheduler
npm run scheduler-status     # Check if running + show logs
npm run scheduler-logs       # Show detailed logs
npm run scheduler-logs -- 100  # Show last 100 lines
```

## Optional: Auto-start on Computer Restart

If you want the scheduler to start automatically when your Mac boots:

```bash
./setup-startup.sh
```

This creates a system service that auto-starts the scheduler.

## Other Commands

```bash
npm run generate      # Generate a new LinkedIn post
npm run queue         # View posts in queue
npm run history       # View post history
npm run clear         # Clear all data
```

## Troubleshooting

If something breaks, check the logs:
```bash
npm run scheduler-logs
```

For detailed help, see: `TROUBLESHOOTING.md`

## Current Settings

Your bot is configured to:
- ✅ Auto-reply to all unread DMs in your voice
- ✅ Auto-apply to jobs (if `AUTO_SUBMIT_APPLICATIONS=true`)
- ✅ Only apply to high-quality jobs (60+ match score)
- ✅ Max 10 job applications per day
- ✅ Mention `www.itsradai.com` when relevant

Want to adjust settings? Edit `.env` and restart:
```bash
npm run scheduler-restart
```

---

Ready? Run this:
```bash
npm run login
npm run scheduler-start
npm run scheduler-status
```

Your automation is ready to rock! 🚀
