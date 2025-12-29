const cron = require('node-cron');
const LinkedInBot = require('./linkedinBot');
const { generateLinkedInPost } = require('./contentGenerator');
const { getImageForPost } = require('./imageGenerator');
const fs = require('fs').promises;
const path = require('path');

class Scheduler {
  constructor() {
    this.jobs = [];
    this.postQueue = [];
    this.postHistory = [];
  }

  // Add randomization to cron schedule (±30 minutes)
  randomizeCronTime(cronExpression) {
    // Parse cron: minute hour * * day
    const parts = cronExpression.split(' ');
    const baseMinute = parseInt(parts[0]);
    const baseHour = parseInt(parts[1]);

    // Add random offset: -30 to +30 minutes
    const offset = Math.floor(Math.random() * 61) - 30;
    let totalMinutes = baseHour * 60 + baseMinute + offset;

    // Handle day rollover
    if (totalMinutes < 0) totalMinutes += 24 * 60;
    if (totalMinutes >= 24 * 60) totalMinutes -= 24 * 60;

    const newHour = Math.floor(totalMinutes / 60);
    const newMinute = totalMinutes % 60;

    parts[0] = newMinute.toString();
    parts[1] = newHour.toString();

    return parts.join(' ');
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

  async start() {
    console.log('🚀 Starting LinkedIn Auto-Poster Scheduler\n');

    // Create necessary directories
    await fs.mkdir(path.join(__dirname, 'screenshots'), { recursive: true });
    await fs.mkdir(path.join(__dirname, 'posts'), { recursive: true });

    // Load existing queue
    await this.loadPostQueue();

    // Set up cron jobs
    const morningSchedule = process.env.MORNING_SCHEDULE || '0 9 * * 1-5';
    const afternoonSchedule = process.env.AFTERNOON_SCHEDULE || '0 15 * * 1-5';

    console.log('📅 Scheduling posts:');
    console.log(`   Morning: ${morningSchedule} (±30 min randomization)`);
    console.log(`   Afternoon: ${afternoonSchedule} (±30 min randomization)\n`);

    // Morning post
    const morningJob = cron.schedule(morningSchedule, async () => {
      await this.executePost();
    });

    // Afternoon post
    const afternoonJob = cron.schedule(afternoonSchedule, async () => {
      await this.executePost();
    });

    this.jobs.push(morningJob, afternoonJob);

    console.log('✅ Scheduler is running!');
    console.log('💡 Tip: Posts will publish at scheduled times with ±30 min randomization');
    console.log('🛑 Press Ctrl+C to stop\n');

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
    console.log(`   Failed attempts: ${this.postHistory.filter(p => !p.success).length}\n`);
  }

  stop() {
    this.jobs.forEach(job => job.stop());
    console.log('🛑 Scheduler stopped');
  }
}

module.exports = Scheduler;
