const cron = require('node-cron');
const LinkedInBot = require('./linkedinBot');
const JobSearchBot = require('./jobSearchBot');
const JobApplicationBot = require('./jobApplicationBot');
const ApplicationTracker = require('./applicationTracker');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

class AutoApplyScheduler {
  constructor() {
    this.tracker = new ApplicationTracker();
    this.jobs = [];
  }

  async executeApplicationSession() {
    console.log('\n' + '='.repeat(60));
    console.log('🤖 LinkedIn Auto-Apply - Starting application session');
    console.log('⏰ Time:', new Date().toLocaleString());
    console.log('='.repeat(60) + '\n');

    const bot = new LinkedInBot();

    try {
      // Load application history
      await this.tracker.load();

      // Initialize browser and login
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
        maxResults: parseInt(process.env.MAX_JOBS_PER_SEARCH || '25')
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

      // Filter jobs with AI
      const minScore = parseInt(process.env.MIN_MATCH_SCORE || '60');
      let filteredJobs = jobs;

      if (process.env.USE_AI_FILTERING === 'true' && resumeText) {
        filteredJobs = await jobSearchBot.filterJobsWithAI(jobs, resumeText, minScore);
      }

      // Save jobs for reference
      await jobSearchBot.saveJobs(filteredJobs, `jobs-${Date.now()}.json`);

      console.log(`\n📋 ${filteredJobs.length} jobs passed filtering\n`);

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
      const maxApplicationsPerDay = parseInt(process.env.MAX_APPLICATIONS_PER_DAY || '10');
      let applied = 0;
      let skipped = 0;

      for (const job of filteredJobs) {
        // Check daily limit
        if (applied >= maxApplicationsPerDay) {
          console.log(`\n🛑 Reached daily limit of ${maxApplicationsPerDay} applications\n`);
          break;
        }

        console.log('\n' + '-'.repeat(60));
        console.log(`Job ${applied + skipped + 1}/${filteredJobs.length}`);
        console.log('-'.repeat(60));

        // Check if already applied
        if (this.tracker.hasApplied(job.id)) {
          console.log(`⏭️  Already applied to this job, skipping...\n`);
          skipped++;
          continue;
        }

        // Apply to the job
        const result = await appBot.applyToJob(job, applicationData);

        // Track the application
        await this.tracker.addApplication(job, result);

        if (result.success) {
          applied++;
          console.log(`✅ Successfully applied! (${applied}/${maxApplicationsPerDay})\n`);
        } else {
          skipped++;
          console.log(`❌ Application failed: ${result.reason}\n`);
        }

        // Human-like delay between applications (3-7 minutes)
        if (applied + skipped < filteredJobs.length && applied < maxApplicationsPerDay) {
          const delayMinutes = Math.random() * 4 + 3;
          console.log(`⏳ Waiting ${delayMinutes.toFixed(1)} minutes before next application...\n`);
          await new Promise(resolve => setTimeout(resolve, delayMinutes * 60 * 1000));
        }
      }

      console.log('\n' + '='.repeat(60));
      console.log('🏁 Application Session Complete!');
      console.log('='.repeat(60));
      console.log(`✅ Applied: ${applied}`);
      console.log(`⏭️  Skipped: ${skipped}`);
      console.log(`📊 Total applications tracked: ${this.tracker.applications.length}\n`);

      // Print stats
      this.tracker.printStats();

      // Export to CSV
      await this.tracker.exportToCSV();

    } catch (error) {
      console.error('\n❌ Error during application session:', error.message);
      console.error(error.stack);
    } finally {
      await bot.close();
      console.log('\n' + '='.repeat(60));
      console.log('🏁 Application session finished');
      console.log('='.repeat(60) + '\n');
    }
  }

  async start() {
    console.log('🚀 Starting LinkedIn Auto-Apply Scheduler\n');

    // Create necessary directories
    await fs.mkdir(path.join(__dirname, 'screenshots'), { recursive: true });
    await fs.mkdir(path.join(__dirname, 'jobs'), { recursive: true });

    // Load existing tracker
    await this.tracker.load();

    // Set up cron jobs
    const morningSchedule = process.env.APPLY_MORNING_SCHEDULE || '0 9 * * 1-5';
    const afternoonSchedule = process.env.APPLY_AFTERNOON_SCHEDULE || '0 14 * * 1-5';

    console.log('📅 Application schedule:');
    console.log(`   Morning: ${morningSchedule}`);
    console.log(`   Afternoon: ${afternoonSchedule}\n`);

    // Morning application session
    const morningJob = cron.schedule(morningSchedule, async () => {
      await this.executeApplicationSession();
    });

    // Afternoon application session (optional)
    let afternoonJob = null;
    if (process.env.RUN_TWICE_DAILY === 'true') {
      afternoonJob = cron.schedule(afternoonSchedule, async () => {
        await this.executeApplicationSession();
      });
    }

    console.log('✅ Scheduler is running!');
    console.log('💡 Tip: Applications will be submitted automatically at scheduled times');
    console.log('🛑 Press Ctrl+C to stop\n');

    // Print current stats
    this.tracker.printStats();
  }

  stop() {
    console.log('🛑 Scheduler stopped');
  }
}

// Run the scheduler
const scheduler = new AutoApplyScheduler();
scheduler.start();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down...');
  scheduler.stop();
  process.exit(0);
});
