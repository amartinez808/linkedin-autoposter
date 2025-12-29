#!/usr/bin/env node

// Post immediately without waiting for schedule
const LinkedInBot = require('./linkedinBot');
const { getImageForPost } = require('./imageGenerator');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

async function postNow() {
  console.log('🚀 Posting to LinkedIn NOW!\n');

  const bot = new LinkedInBot();

  try {
    // Load queue
    const queuePath = path.join(__dirname, 'posts', 'queue.json');
    const data = await fs.readFile(queuePath, 'utf-8');
    const queue = JSON.parse(data);

    if (queue.length === 0) {
      console.log('❌ No posts in queue!');
      return;
    }

    // Get first post
    const post = queue.shift();

    console.log('📄 Posting:');
    console.log('─'.repeat(60));
    console.log(post.content);
    console.log('─'.repeat(60));
    console.log(`\nTopic: ${post.topic}\n`);

    // Save updated queue
    await fs.writeFile(queuePath, JSON.stringify(queue, null, 2));
    console.log(`📊 Remaining in queue: ${queue.length}\n`);

    // Generate image for post
    console.log('🎨 Generating image for post...\n');
    const imageResult = await getImageForPost(post.topic, post.content);
    const imagePath = imageResult ? imageResult.path : null;

    if (imageResult) {
      console.log(`✅ Image ready: ${imageResult.fileName} (source: ${imageResult.source})\n`);
    } else {
      console.log('⚠️  No image generated, posting text-only\n');
    }

    // Initialize and login
    console.log('🔐 Initializing browser and logging in...');
    await bot.init();
    await bot.login();

    // Post
    console.log('📤 Publishing to LinkedIn...\n');
    await bot.createPost(post.content, imagePath);

    console.log('\n✅ SUCCESS! Post is live on LinkedIn!');
    console.log(`📊 Posts remaining in queue: ${queue.length}`);

    // Log to history
    const historyPath = path.join(__dirname, 'posts', 'history.json');
    let history = [];
    try {
      const historyData = await fs.readFile(historyPath, 'utf-8');
      history = JSON.parse(historyData);
    } catch (e) {
      // No history yet
    }

    history.push({
      timestamp: new Date().toISOString(),
      content: post.content.substring(0, 100) + '...',
      topic: post.topic,
      success: true,
      error: null
    });

    await fs.writeFile(historyPath, JSON.stringify(history, null, 2));

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await bot.close();
  }
}

postNow();
