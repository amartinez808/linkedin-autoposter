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
    console.log('🚀 Starting LinkedIn Auto-Poster (Daily Strategy)\n');

    // Create necessary directories
    await fs.mkdir(path.join(__dirname, 'screenshots'), { recursive: true });
    await fs.mkdir(path.join(__dirname, 'posts'), { recursive: true });

    // Load history first
    await this.loadPostHistory();

    // Load existing queue
    await this.loadPostQueue();

    console.log('📅 Strategy: One post per day (Check on startup & hourly)');
    console.log('🛑 Press Ctrl+C to stop\n');

    // 1. Check immediately on startup
    await this.ensureDailyPost();

    // 2. Check every hour (in case computer is left on)
    const hourlyJob = cron.schedule('0 * * * *', async () => {
      console.log('⏰ Hourly check triggered.');
      await this.ensureDailyPost();
    });

    this.jobs.push(hourlyJob);

    console.log('✅ Hourly checker is running!');

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
