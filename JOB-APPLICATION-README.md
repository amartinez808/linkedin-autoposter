# LinkedIn Auto-Apply System

Automatically search for jobs on LinkedIn and apply to Easy Apply positions with AI-powered job matching.

## Features

- **Smart Job Search** - Searches LinkedIn for jobs matching your criteria (keywords, location, experience level)
- **Easy Apply Only** - Filters for jobs with LinkedIn Easy Apply
- **AI Job Matching** - Uses GPT-4o to analyze job descriptions and match against your resume (60+ score threshold)
- **Auto-Fill Applications** - Automatically fills contact info, work authorization, and standard questions
- **AI-Powered Answers** - Generates thoughtful answers to open-ended questions using GPT-4o
- **Application Tracking** - Tracks all applications in `jobs/applications.json` (prevents duplicates)
- **CSV Export** - Exports application history to CSV for reporting
- **Human-Like Behavior** - Random delays between actions to avoid bot detection
- **Screenshot Logging** - Takes screenshots at key steps for debugging

## Configuration

Edit `.env` file with your job search preferences:

```env
# Job Search Settings
JOB_KEYWORDS=Software Engineer           # Job titles to search for
JOB_LOCATION=Remote                      # Location or "Remote"
EXPERIENCE_LEVEL=mid-senior              # entry, associate, mid-senior, director, executive
MAX_JOBS_PER_SEARCH=25                   # Max jobs to find per search
MAX_APPLICATIONS_PER_DAY=10              # Daily application limit (prevents spam)
MIN_MATCH_SCORE=60                       # Minimum AI match score (0-100)
USE_AI_FILTERING=true                    # Enable AI job matching
AUTO_SUBMIT_APPLICATIONS=false           # Set to true to auto-submit (or false for manual review)

# Contact Info
PHONE=(401) 654-7289
EMAIL=tmartinez88@icloud.com
CITY=Providence
LINKEDIN_URL=linkedin.com/in/antoniomartinez47/
GITHUB=https://github.com/amartinez808
```

## Usage

### Manual Test (Recommended First)

Test the system manually before automating:

```bash
node applyNow.js
```

This will:
1. Search for 10 jobs matching your criteria
2. Apply to up to 3 jobs (test mode)
3. Save all applications to `jobs/applications.json`
4. Take screenshots at key steps
5. Print statistics

**Important**: `AUTO_SUBMIT_APPLICATIONS=false` by default, so applications will be filled out but NOT submitted. Review screenshots in `screenshots/` folder to verify everything looks good, then set to `true` to enable auto-submit.

### Automated Daily Applications

Run the scheduler to apply to jobs automatically every weekday at 9 AM:

```bash
node autoApply.js
```

Schedule (configurable in `.env`):
- Morning: 9 AM weekdays (Mon-Fri)
- Afternoon: 2 PM weekdays (optional - set `RUN_TWICE_DAILY=true`)

## How It Works

### 1. Job Search
- Navigates to LinkedIn Jobs
- Searches with your keywords, location, experience level
- Filters for Easy Apply only
- Scrolls to load 25+ job listings
- Extracts job details (title, company, location, URL)

### 2. AI Job Matching (Optional)
- For each job, navigates to the job page
- Extracts full job description
- Sends job description + your resume to GPT-4o
- GPT-4o scores the match (0-100) and provides reasoning
- Only applies to jobs scoring 60+ (configurable)

### 3. Easy Apply Process
- Clicks Easy Apply button
- Handles multi-step form:
  - **Step 1**: Uploads resume (if requested)
  - **Step 2+**: Fills contact info (phone, email, city)
  - **Questions**: Auto-fills standard fields (work authorization, years of experience)
  - **Open-ended**: Uses GPT-4o to generate thoughtful 2-3 sentence answers
  - **Review**: Takes screenshot for verification
  - **Submit**: Clicks submit (if `AUTO_SUBMIT_APPLICATIONS=true`)

### 4. Application Tracking
- Saves every application to `jobs/applications.json`
- Prevents duplicate applications
- Tracks success/failure with reasons
- Exports to CSV for analysis

## Files Structure

```
linkedin-autoposter/
├── applyNow.js              # Manual test script
├── autoApply.js             # Automated scheduler
├── jobSearchBot.js          # Job search logic
├── jobApplicationBot.js     # Easy Apply automation
├── applicationTracker.js    # Application history tracking
├── linkedinBot.js           # Core LinkedIn browser automation
├── jobs/
│   ├── applications.json    # Application history
│   ├── applications.csv     # CSV export
│   └── current-search.json  # Latest job search results
└── screenshots/             # Screenshots for debugging
```

## Application Data

The system auto-fills these fields from `.env`:
- Phone number
- Email
- City
- LinkedIn URL
- GitHub URL
- Website (optional)
- Work authorization: Yes (assumes US citizen, no sponsorship needed)
- Citizenship: Yes (US citizen)
- Commute/Relocation: Yes
- Years of experience: 8 (from your resume)

For open-ended questions like "Why do you want to work here?" or "Describe your experience with X", the system uses GPT-4o to generate context-aware answers based on the job description and your resume.

## Safety Features

1. **Daily Limits** - Max 10 applications/day (prevents spam)
2. **Human-Like Delays** - Random 3-7 minute delays between applications
3. **Duplicate Prevention** - Tracks all applications, never applies twice
4. **Screenshot Logging** - Screenshots saved for every application
5. **Manual Review Mode** - Set `AUTO_SUBMIT_APPLICATIONS=false` to review before submitting

## Troubleshooting

### "Could not find Easy Apply button"
- Job doesn't have Easy Apply (external application)
- Will be skipped automatically

### "Could not find file input" when uploading resume
- LinkedIn's file upload element changed
- Resume won't be uploaded, but application will continue
- Consider converting `.docx` to `.pdf` (LinkedIn prefers PDF)

### Application filled incorrectly
- Check screenshots in `screenshots/` folder
- Adjust field detection logic in `jobApplicationBot.js`
- Some company-specific fields may need manual handling

### Rate limiting / "Too many requests"
- Increase delays between applications
- Reduce `MAX_APPLICATIONS_PER_DAY`
- LinkedIn may temporarily restrict activity if too aggressive

## Best Practices

1. **Start with manual mode** - Run `node applyNow.js` first to verify everything works
2. **Review screenshots** - Check `screenshots/` folder after first run
3. **Use AI filtering** - Saves time by only applying to relevant jobs
4. **Keep limits reasonable** - 10 applications/day is sustainable
5. **Monitor application quality** - Check `jobs/applications.csv` weekly
6. **Update resume** - Keep `/Users/antoniomartinez/Documents/Resume2026.docx` current
7. **Customize answers** - Edit GPT-4o prompts in `jobApplicationBot.js` for better personalization

## Statistics

View application statistics:

```javascript
const ApplicationTracker = require('./applicationTracker');
const tracker = new ApplicationTracker();
await tracker.load();
tracker.printStats();
```

Outputs:
- Total applications
- Success rate
- Average match score
- Top companies applied to
- Recent applications

## Next Steps

To start auto-applying to jobs over the next 3 weeks:

1. **Test manually first**:
   ```bash
   node applyNow.js
   ```

2. **Review results** - Check screenshots and `applications.json`

3. **Enable auto-submit** - Set `AUTO_SUBMIT_APPLICATIONS=true` in `.env`

4. **Run scheduler**:
   ```bash
   node autoApply.js
   ```

5. **Monitor daily** - Check `jobs/applications.csv` and screenshots

Expected results: **10 applications/day x 21 weekdays = 210 applications in 3 weeks**

Good luck with the job search! 🚀
