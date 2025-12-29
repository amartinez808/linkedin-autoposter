const LinkedInBot = require('./linkedinBot');
const JobSearchBot = require('./jobSearchBot');
const JobApplicationBot = require('./jobApplicationBot');
const ApplicationTracker = require('./applicationTracker');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('🤖 LinkedIn Auto-Apply - Manual Test');
  console.log('='.repeat(60) + '\n');

  const bot = new LinkedInBot();
  const tracker = new ApplicationTracker();

  try {
    // Load application history
    await tracker.load();

    // Initialize browser and login
    console.log('🔐 Initializing browser and logging in...\n');
    await bot.init();
    await bot.login();

    // Create job search bot
    const jobSearchBot = new JobSearchBot(bot);

    // Search for jobs
    const jobs = await jobSearchBot.searchJobs({
      keywords: process.env.JOB_KEYWORDS || 'Software Engineer',
      location: process.env.JOB_LOCATION || 'Remote',
      experienceLevel: process.env.EXPERIENCE_LEVEL || 'mid-senior',
      easyApplyOnly: true,
      maxResults: 10 // Start with 10 jobs for testing
    });

    if (jobs.length === 0) {
      console.log('❌ No jobs found matching criteria\n');
      return;
    }

    // Load resume text for AI filtering
    let resumeText = '';
    try {
      resumeText = await fs.readFile('/Users/antoniomartinez/Documents/Resume2026.txt', 'utf-8');
    } catch (e) {
      console.log('⚠️  Could not load resume text for AI filtering\n');
    }

    // Filter jobs with AI (optional - comment out to skip)
    console.log('\n🧠 Would you like to use AI filtering? (recommended)');
    console.log('This will analyze each job description to find the best matches.\n');

    // For now, let's skip AI filtering in manual mode to speed things up
    // Uncomment below to enable AI filtering:
    // const filteredJobs = await jobSearchBot.filterJobsWithAI(jobs, resumeText, 60);

    // Use all jobs for now
    const filteredJobs = jobs;

    // Save jobs for reference
    await jobSearchBot.saveJobs(filteredJobs, 'current-search.json');

    console.log(`\n📋 Found ${filteredJobs.length} jobs to apply to\n`);

    // Create application bot
    const appBot = new JobApplicationBot(bot);

    // Application data
    const applicationData = {
      resumePath: '/Users/antoniomartinez/Downloads/ResumeAM2026.pdf',
      resumeText: resumeText,
      phone: process.env.PHONE || '(401) 654-7289',
      email: process.env.EMAIL || 'tmartinez88@icloud.com',
      city: process.env.CITY || 'Providence',
      linkedinUrl: process.env.LINKEDIN_URL || 'linkedin.com/in/antoniomartinez47/',
      github: process.env.GITHUB || 'https://github.com/amartinez808',
      website: process.env.WEBSITE || '',
      needsSponsorship: false,
      isCitizen: true
    };

    // Apply to jobs
    let applied = 0;
    let skipped = 0;

    for (const job of filteredJobs) {
      console.log('\n' + '-'.repeat(60));
      console.log(`Job ${applied + skipped + 1}/${filteredJobs.length}`);
      console.log('-'.repeat(60));

      // Check if already applied
      if (tracker.hasApplied(job.id)) {
        console.log(`⏭️  Already applied to this job, skipping...\n`);
        skipped++;
        continue;
      }

      // Apply to the job
      const result = await appBot.applyToJob(job, applicationData);

      // Track the application
      await tracker.addApplication(job, result);

      if (result.success) {
        applied++;
        console.log(`✅ Successfully applied! (${applied} total)\n`);
      } else {
        skipped++;
        console.log(`❌ Application failed: ${result.reason}\n`);
      }

      // Stop after 3 successful applications in test mode
      if (applied >= 3) {
        console.log('🛑 Stopping after 3 applications (test mode)\n');
        break;
      }

      // Human-like delay between applications (2-5 minutes)
      if (applied + skipped < filteredJobs.length) {
        const delayMinutes = Math.random() * 3 + 2;
        console.log(`⏳ Waiting ${delayMinutes.toFixed(1)} minutes before next application...\n`);
        await new Promise(resolve => setTimeout(resolve, delayMinutes * 60 * 1000));
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('🏁 Application Session Complete!');
    console.log('='.repeat(60));
    console.log(`✅ Applied: ${applied}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`📊 Total in tracker: ${tracker.applications.length}\n`);

    // Print stats
    tracker.printStats();

    // Export to CSV
    await tracker.exportToCSV();

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await bot.close();
  }
}

main();
