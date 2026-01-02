# Troubleshooting Guide

## What Happened - Why "it didn't work today"

Your LinkedIn automation suite stopped working because:

1. **The scheduler process died** - Node.js process wasn't running
2. **LinkedIn verification code expired** - The code in `.env` (811396) is no longer valid

LinkedIn verification codes are **time-limited (expire after ~30 minutes)** of inactivity. Once expired, the bot can't log in.

## How to Fix It Now

### Step 1: Get a Fresh Verification Code

```bash
node login-helper.js
```

This script will:
- Open your browser to LinkedIn
- Wait for you to manually log in
- Show the verification code prompt
- Automatically update your `.env` file with the new code

**This is a one-time setup.** The code will stay valid as long as you keep the scheduler running continuously.

### Step 2: Start the Scheduler

```bash
node manage-scheduler.js start
```

### Step 3: Verify It's Running

```bash
node manage-scheduler.js status
```

## Managing Your Scheduler

### Start the scheduler
```bash
node manage-scheduler.js start
```

### Stop the scheduler
```bash
node manage-scheduler.js stop
```

### Restart the scheduler
```bash
node manage-scheduler.js restart
```

### Check status and recent logs
```bash
node manage-scheduler.js status
```

### View more logs (default 50 lines)
```bash
node manage-scheduler.js logs
node manage-scheduler.js logs 100   # Last 100 lines
```

## What the Scheduler Does

Once running, the scheduler automatically:

- **Posts** (1x daily): Checks every hour to post (9 AM - 5 PM window)
- **Auto-Reply** (every 30 min): Checks for unread DMs and replies using your voice style
- **Job Applications** (2x daily): Searches and applies to jobs at 9:30 AM and 2 PM on weekdays
  - Only applies to jobs matching 60+ score (AI filtered)
  - Max 10 applications per day
  - Skips already-applied jobs

## Common Issues

### "LinkedIn verification required" Error

**Cause:** Verification code in `.env` is expired

**Fix:**
```bash
node login-helper.js
# Follow the prompts to get a fresh code
node manage-scheduler.js restart
```

### Scheduler not running after reboot

The scheduler runs in the background but isn't persisted across reboots. After your Mac restarts, you need to:

```bash
node manage-scheduler.js start
```

You can set this up to auto-start:

**Option 1: Add to .zshrc (runs on every terminal)**
```bash
echo "cd /Users/antoniomartinez/linkedInAuto && node manage-scheduler.js start 2>/dev/null &" >> ~/.zshrc
```

**Option 2: Create a LaunchAgent (runs automatically at login)**
See `setup-startup.sh` for automated setup.

### "Could not find message input" Error

This means:
- The conversation is archived
- You can't reply to this person
- Or the conversation is a broadcast

**Solution:** Appears automatically - bot skips these conversations

### Jobs aren't being applied to

Check:
1. Is `AUTO_SUBMIT_APPLICATIONS=true` in `.env`? (default is `false`)
2. Is the job score ≥ 60? (Adjust `MIN_MATCH_SCORE` to lower it)
3. Have you already applied to that job? (Tracked in `applications/history.json`)

### Posts aren't being published

Check:
1. Is the current time between 9 AM and 5 PM? (Edit `POSTING_START_HOUR` and `POSTING_END_HOUR`)
2. Do you have posts in the queue? (Check `posts/queue.json`)
3. Are there any error logs? Run: `node manage-scheduler.js logs`

## File Locations

- **Posts queue:** `posts/queue.json`
- **Post history:** `posts/history.json`
- **Application history:** `applications/history.json`
- **Pending replies:** `replies/pending-replies.json`
- **Voice profile:** `replies/voice-profile.json`
- **Scheduler logs:** `scheduler.log`
- **Screenshots:** `screenshots/` (debugging)

## Current Configuration

Your `.env` is set up for:
- Email: `Antonio@itsradai.com`
- Auto-apply jobs: `true` (applies automatically)
- AI filtering: `true` (only applies to matching jobs)
- Min job match score: `60/100`
- Max applications per day: `10`
- Auto-reply: enabled (checks every 30 minutes)
- Website: `www.itsradai.com` (mentioned in job reply emails)

## Next Steps

1. Run `node login-helper.js` to get fresh verification code
2. Run `node manage-scheduler.js start` to start scheduler
3. Run `node manage-scheduler.js status` to verify it's running
4. Check logs periodically: `node manage-scheduler.js logs`

Your automation is now ready to go! 🚀
