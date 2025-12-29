#!/usr/bin/env node

// Manual test script to post immediately
const LinkedInBot = require('./linkedinBot');
const { generateLinkedInPost } = require('./contentGenerator');
require('dotenv').config();

async function testPost() {
  console.log('🧪 Testing LinkedIn Auto-Poster\n');

  const bot = new LinkedInBot();

  try {
    // Generate content
    console.log('📝 Generating post content...');
    const post = await generateLinkedInPost();

    console.log('\n📄 Generated post:');
    console.log('─'.repeat(60));
    console.log(post.content);
    console.log('─'.repeat(60));
    console.log(`\nTopic: ${post.topic}\n`);

    // Ask for confirmation
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise(resolve => {
      readline.question('Do you want to post this? (yes/no): ', resolve);
    });
    readline.close();

    if (answer.toLowerCase() !== 'yes') {
      console.log('❌ Post cancelled');
      return;
    }

    // Initialize and login
    console.log('\n🚀 Initializing browser...');
    await bot.init();

    console.log('🔐 Logging in...');
    await bot.login();

    // Post
    console.log('📤 Publishing post...');
    await bot.createPost(post.content);

    console.log('\n✅ Success! Post published to LinkedIn');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await bot.close();
  }
}

testPost();
