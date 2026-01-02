const cron = require('node-cron');
const LinkedInBot = require('./linkedinBot');
const AutoReplyBot = require('./autoReplyBot');
const JobSearchBot = require('./jobSearchBot');
const JobApplicationBot = require('./jobApplicationBot');
const JobMatcher = require('./jobMatcher');
const { generateLinkedInPost } = require('./contentGenerator');
const { getImageForPost } = require('./imageGenerator');
const fs = require('fs').promises;
const path = require('path');

class Scheduler {
  constructor() {
    this.jobs = [];
    this.postQueue = [];
    this.postHistory = [];
    this.applicationHistory = [];
  }


  async loadPostQueue() {
    try {
      const queuePath = path.join(__dirname, 'posts', 'queue.json');
      const data = await fs.readFile(queuePath, 'utf-8');
      this.postQueue = JSON.parse(data);
      console.log(`📋 Loaded ${this.postQueue.length} posts from queue`);
    } catch (error) {
      console.log('ℹ️  No existing queue found, will generate new posts');
      this.postQueue = [];
    }
  }

  async loadPostHistory() {
    try {
      const historyPath = path.join(__dirname, 'posts', 'history.json');
      const data = await fs.readFile(historyPath, 'utf-8');
      this.postHistory = JSON.parse(data);
      console.log(`📜 Loaded ${this.postHistory.length} entries from history`);
    } catch (error) {
      console.log('ℹ️  No existing history found, starting fresh');
      this.postHistory = [];
    }
  }

  async savePostQueue() {
    const queuePath = path.join(__dirname, 'posts', 'queue.json');
    await fs.mkdir(path.join(__dirname, 'posts'), { recursive: true });
    await fs.writeFile(queuePath, JSON.stringify(this.postQueue, null, 2));
  }

  async logPost(post, success, error = null) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      content: post.content.substring(0, 100) + '...',
      topic: post.topic,
      success: success,
      error: error
    };

    this.postHistory.push(logEntry);

    // Save to file
    const logPath = path.join(__dirname, 'posts', 'history.json');
    await fs.mkdir(path.join(__dirname, 'posts'), { recursive: true });
    await fs.writeFile(logPath, JSON.stringify(this.postHistory, null, 2));
  }

  async executePost() {
    console.log('\n' + '='.repeat(60));
    console.log('🤖 LinkedIn Auto-Poster - Starting posting job');
    console.log('⏰ Time:', new Date().toLocaleString());
    console.log('='.repeat(60) + '\n');

    const bot = new LinkedInBot();

    try {
      // Ensure we have posts in queue
      if (this.postQueue.length === 0) {
        console.log('📝 Queue empty, generating new post...');
        const newPost = await generateLinkedInPost();
        this.postQueue.push(newPost);
      }

      // Get next post from queue
      const post = this.postQueue.shift();
      await this.savePostQueue();

      console.log('📄 Post to publish:');
      console.log('─'.repeat(60));
      console.log(post.content);
      console.log('─'.repeat(60));
      console.log(`\nTopic: ${post.topic}\n`);

      // Generate image for post
      console.log('🎨 Generating image for post...\n');
      const imageResult = await getImageForPost(post.topic, post.content);
      const imagePath = imageResult ? imageResult.path : null;

      if (imageResult) {
        console.log(`✅ Image ready: ${imageResult.fileName} (source: ${imageResult.source})\n`);
      } else {
        console.log('⚠️  No image generated, posting text-only\n');
      }

      // Initialize browser and login
      await bot.init();
      await bot.login();

      // Random delay before posting (1-3 minutes to seem more human)
      const prePostDelay = Math.random() * 120000 + 60000;
      console.log(`⏳ Waiting ${Math.round(prePostDelay / 1000)}s before posting (human-like behavior)...`);
      await new Promise(resolve => setTimeout(resolve, prePostDelay));

      // Create the post
      await bot.createPost(post.content, imagePath);

      // Log success
      await this.logPost(post, true);

      console.log('\n✅ Post published successfully!');
      console.log('📊 Remaining posts in queue:', this.postQueue.length);

    } catch (error) {
      console.error('\n❌ Error during posting:', error.message);

      // Log failure
      if (this.postQueue.length > 0 || post) {
        await this.logPost(post || { content: 'Unknown', topic: 'Unknown' }, false, error.message);
      }

      // Put post back in queue if it failed
      if (post) {
        this.postQueue.unshift(post);
        await this.savePostQueue();
        console.log('↩️  Post returned to queue for retry');
      }
    } finally {
      await bot.close();
      console.log('\n' + '='.repeat(60));
      console.log('🏁 Posting job completed');
      console.log('='.repeat(60) + '\n');
    }
  }

  async checkAndReplyToMessages() {
    console.log('\n💬 Checking for unread LinkedIn messages...');

    const linkedInBot = new LinkedInBot();
    const autoReplyBot = new AutoReplyBot(linkedInBot);

    try {
      await linkedInBot.init();

      try {
        await linkedInBot.login();
      } catch (loginError) {
        if (loginError.message.includes('Verification required')) {
          console.error('⚠️  LinkedIn verification required.');
          console.error('   You need to log in manually and update VERIFICATION_CODE in .env');
          console.error('   Codes expire after ~30 minutes. Skipping this check.\n');
          return;
        }
        throw loginError;
      }

      // Initialize voice learning
      await autoReplyBot.initVoice();

      // Process unread messages with auto-send
      const results = await autoReplyBot.processUnreadMessages({
        requireApproval: process.env.REQUIRE_APPROVAL === 'true',
        maxReplies: 10,
        skipSalesPitches: true
      });

      console.log(`\n✅ Auto-reply complete: ${results.replied} sent, ${results.skipped} skipped\n`);

    } catch (error) {
      console.error('❌ Error during auto-reply:', error.message);
    } finally {
      await linkedInBot.close();
    }
  }

  async loadApplicationHistory() {
    try {
      const historyPath = path.join(__dirname, 'applications', 'history.json');
      const data = await fs.readFile(historyPath, 'utf-8');
      this.applicationHistory = JSON.parse(data);
      console.log(`📜 Loaded ${this.applicationHistory.length} job application(s) from history`);
    } catch (error) {
      console.log('ℹ️  No existing application history found, starting fresh');
      this.applicationHistory = [];
    }
  }

  async saveApplicationHistory() {
    const historyPath = path.join(__dirname, 'applications', 'history.json');
    await fs.mkdir(path.join(__dirname, 'applications'), { recursive: true });
    await fs.writeFile(historyPath, JSON.stringify(this.applicationHistory, null, 2));
  }

  async logApplication(job, success, reason = null) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      jobId: job.id || job.url,
      title: job.title,
      company: job.company,
      location: job.location,
      url: job.url,
      success: success,
      reason: reason
    };

    this.applicationHistory.push(logEntry);
    await this.saveApplicationHistory();
  }

  async applyToJobs() {
    console.log('\n💼 Starting job application process...');

    // Check daily limit
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const applicationsToday = this.applicationHistory.filter(a => {
      const appDate = new Date(a.timestamp);
      return appDate >= startOfDay;
    }).length;

    const maxPerDay = parseInt(process.env.MAX_APPLICATIONS_PER_DAY || '10');

    console.log(`   Applications today: ${applicationsToday}/${maxPerDay}`);

    if (applicationsToday >= maxPerDay) {
      console.log('⚠️  Daily application limit reached. Skipping.\n');
      return { searched: 0, applied: 0, skipped: 0 };
    }

    const linkedInBot = new LinkedInBot();
    const jobSearchBot = new JobSearchBot(linkedInBot);
    const jobAppBot = new JobApplicationBot(linkedInBot);

    try {
      await linkedInBot.init();

      try {
        await linkedInBot.login();
      } catch (loginError) {
        if (loginError.message.includes('Verification required')) {
          console.error('⚠️  LinkedIn verification required.');
          console.error('   You need to log in manually and update VERIFICATION_CODE in .env');
          console.error('   Skipping job applications this cycle.\n');
          return { searched: 0, applied: 0, skipped: 0 };
        }
        throw loginError;
      }

      // Search for jobs
      const jobs = await jobSearchBot.searchJobs({
        keywords: process.env.JOB_KEYWORDS || 'Software Engineer',
        location: process.env.JOB_LOCATION || 'Remote',
        experienceLevel: process.env.EXPERIENCE_LEVEL || 'mid-senior',
        easyApplyOnly: true,
        maxResults: parseInt(process.env.MAX_JOBS_PER_SEARCH || '25')
      });

      console.log(`\n🔍 Found ${jobs.length} jobs to review\n`);

      // AI filtering if enabled
      let filteredJobs = jobs;
      if (process.env.USE_AI_FILTERING === 'true') {
        const jobMatcher = new JobMatcher();
        const minScore = parseInt(process.env.MIN_MATCH_SCORE || '60');
        filteredJobs = await jobMatcher.filterJobs(jobs, minScore);
      } else {
        console.log('ℹ️  AI filtering disabled (set USE_AI_FILTERING=true to enable)\n');
      }

      let applied = 0;
      let skipped = 0;
      const remainingSlots = maxPerDay - applicationsToday;

      for (const job of filteredJobs.slice(0, remainingSlots)) {
        // Check if we've already applied to this job
        const alreadyApplied = this.applicationHistory.some(a =>
          a.jobId === job.id || a.url === job.url
        );

        if (alreadyApplied) {
          console.log(`⏭️  Skipping "${job.title}" at ${job.company} (already applied)\n`);
          skipped++;
          continue;
        }

        // Apply to job
        const applicationData = {
          phone: process.env.PHONE,
          email: process.env.EMAIL,
          city: process.env.CITY,
          linkedinUrl: process.env.LINKEDIN_URL,
          github: process.env.GITHUB,
          website: process.env.WEBSITE
        };

        const autoSubmit = process.env.AUTO_SUBMIT_APPLICATIONS === 'true';

        if (!autoSubmit) {
          console.log(`📋 Would apply to: "${job.title}" at ${job.company}`);
          console.log(`   Set AUTO_SUBMIT_APPLICATIONS=true to enable auto-apply\n`);
          await this.logApplication(job, false, 'Auto-submit disabled');
          skipped++;
          continue;
        }

        const result = await jobAppBot.applyToJob(job, applicationData);

        await this.logApplication(job, result.success, result.reason);

        if (result.success) {
          applied++;
        } else {
          skipped++;
        }

        // Human-like delay between applications
        await new Promise(r => setTimeout(r, Math.random() * 30000 + 20000)); // 20-50 seconds
      }

      console.log('\n========================================');
      console.log(`✅ Job application session complete!`);
      console.log(`   Searched: ${jobs.length} jobs`);
      console.log(`   Applied: ${applied}`);
      console.log(`   Skipped: ${skipped}`);
      console.log(`   Total today: ${applicationsToday + applied}/${maxPerDay}`);
      console.log('========================================\n');

      return { searched: jobs.length, applied, skipped };

    } catch (error) {
      console.error('❌ Error during job applications:', error.message);
      return { searched: 0, applied: 0, skipped: 0 };
    } finally {
      await linkedInBot.close();
    }
  }

  async ensureDailyPost() {
    console.log('🔍 Checking daily post status...');
    const now = new Date();

    // Get today's start of day
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    // Count successful posts today
    const postsToday = this.postHistory.filter(p => {
      const postDate = new Date(p.timestamp);
      return p.success && postDate >= startOfDay;
    }).length;

    console.log(`   Posts sent today: ${postsToday}`);

    if (postsToday === 0) {
      // Check if we're within posting hours
      const currentHour = now.getHours();
      const startHour = parseInt(process.env.POSTING_START_HOUR || '9');
      const endHour = parseInt(process.env.POSTING_END_HOUR || '17');

      if (currentHour >= startHour && currentHour < endHour) {
        console.log('🚀 No posts sent today. Executing daily post now...');
        await this.executePost();
      } else {
        console.log(`⏰ Outside posting window (${startHour}:00-${endHour}:00). Current time: ${currentHour}:${now.getMinutes().toString().padStart(2, '0')}`);
        console.log('   Will retry on next hourly check.');
      }
    } else {
      console.log('✅ Daily post already sent. Skipping.');
    }
    console.log('');
  }

  async start() {
    console.log('🚀 Starting LinkedIn Automation Suite\n');

    // Create necessary directories
    await fs.mkdir(path.join(__dirname, 'screenshots'), { recursive: true });
    await fs.mkdir(path.join(__dirname, 'posts'), { recursive: true });
    await fs.mkdir(path.join(__dirname, 'replies'), { recursive: true });
    await fs.mkdir(path.join(__dirname, 'applications'), { recursive: true });

    // Load history
    await this.loadPostHistory();
    await this.loadApplicationHistory();

    // Load existing queue
    await this.loadPostQueue();

    console.log('📅 Posts: One per day (Check hourly)');
    console.log('💬 Auto-Reply: Check every 30 minutes');
    console.log('💼 Job Applications: Daily at 9 AM & 2 PM (if enabled)');
    console.log('🛑 Press Ctrl+C to stop\n');

    // 1. Check immediately on startup
    await this.ensureDailyPost();

    // Check for messages immediately on startup
    await this.checkAndReplyToMessages();

    // 2. Check every hour for posts (in case computer is left on)
    const hourlyJob = cron.schedule('0 * * * *', async () => {
      console.log('⏰ Hourly post check triggered.');
      await this.ensureDailyPost();
    });

    // 3. Check for messages every 30 minutes
    const messageJob = cron.schedule('*/30 * * * *', async () => {
      console.log('⏰ Message check triggered (every 30 min).');
      await this.checkAndReplyToMessages();
    });

    // 4. Apply to jobs twice daily (9 AM and 2 PM on weekdays)
    const morningJobsSchedule = process.env.APPLY_MORNING_SCHEDULE || '30 9 * * 1-5';
    const afternoonJobsSchedule = process.env.APPLY_AFTERNOON_SCHEDULE || '0 14 * * 1-5';

    const morningJobsJob = cron.schedule(morningJobsSchedule, async () => {
      console.log('⏰ Morning job application check triggered.');
      await this.applyToJobs();
    });

    const afternoonJobsJob = cron.schedule(afternoonJobsSchedule, async () => {
      console.log('⏰ Afternoon job application check triggered.');
      await this.applyToJobs();
    });

    this.jobs.push(hourlyJob);
    this.jobs.push(messageJob);
    this.jobs.push(morningJobsJob);
    this.jobs.push(afternoonJobsJob);

    console.log('✅ Hourly post checker is running!');
    console.log('✅ Message checker is running (every 30 min)!');
    console.log('✅ Job application checker is running (9:30 AM & 2 PM weekdays)!');

    // Pre-generate some posts for the queue
    if (this.postQueue.length < 5) {
      console.log('🔄 Pre-generating posts for queue...');
      const { generatePostBatch } = require('./contentGenerator');
      const newPosts = await generatePostBatch(5);
      this.postQueue.push(...newPosts);
      await this.savePostQueue();
      console.log(`✅ Added ${newPosts.length} posts to queue\n`);
    }

    console.log('📊 Current status:');
    console.log(`   Posts in queue: ${this.postQueue.length}`);
    console.log(`   Posts published: ${this.postHistory.filter(p => p.success).length}`);
    console.log(`   Failed posts: ${this.postHistory.filter(p => !p.success).length}`);
    console.log(`   Job applications: ${this.applicationHistory.filter(a => a.success).length} successful`);
    console.log(`   Failed applications: ${this.applicationHistory.filter(a => !a.success).length}\n`);
  }

  stop() {
    this.jobs.forEach(job => job.stop());
    console.log('🛑 Scheduler stopped');
  }
}

module.exports = Scheduler;
