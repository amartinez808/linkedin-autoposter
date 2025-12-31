#!/usr/bin/env node
const LinkedInBot = require('./linkedinBot');
const AutoReplyBot = require('./autoReplyBot');
require('dotenv').config();

const COMMANDS = {
  'learn': 'Scrape your past messages and learn your voice',
  'reply': 'Process unread messages and auto-reply',
  'both': 'Learn voice first, then auto-reply'
};

async function main() {
  const command = process.argv[2] || 'both';

  if (command === 'help' || command === '-h' || command === '--help') {
    console.log('\nLinkedIn Auto-Reply Bot\n');
    console.log('Usage: node runAutoReply.js [command]\n');
    console.log('Commands:');
    Object.entries(COMMANDS).forEach(([cmd, desc]) => {
      console.log(`  ${cmd.padEnd(10)} ${desc}`);
    });
    console.log('\nExamples:');
    console.log('  node runAutoReply.js learn    # Learn your voice from past DMs');
    console.log('  node runAutoReply.js reply    # Auto-reply to unread messages');
    console.log('  node runAutoReply.js both     # Learn + reply (default)');
    console.log('\nEnvironment variables:');
    console.log('  REQUIRE_APPROVAL=true   # Save replies for review instead of sending');
    console.log('  HEADLESS=true           # Run browser in headless mode');
    return;
  }

  console.log('\n🤖 LinkedIn Auto-Reply Bot');
  console.log('===========================\n');

  const linkedInBot = new LinkedInBot();
  let autoReplyBot = null;

  try {
    // Initialize and login
    await linkedInBot.init();
    await linkedInBot.login();

    // Create auto-reply bot
    autoReplyBot = new AutoReplyBot(linkedInBot);
    await autoReplyBot.initVoice();

    if (command === 'learn' || command === 'both') {
      // Learn voice from past messages
      const maxConversations = parseInt(process.env.VOICE_SCRAPE_LIMIT) || 15;
      await autoReplyBot.learnVoice(maxConversations);
    }

    if (command === 'reply' || command === 'both') {
      // Process unread messages
      const results = await autoReplyBot.processUnreadMessages({
        requireApproval: process.env.REQUIRE_APPROVAL === 'true',
        maxReplies: parseInt(process.env.MAX_REPLIES) || 10,
        skipSalesPitches: process.env.SKIP_SALES !== 'false'
      });

      console.log('\nResults:', results);
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await linkedInBot.close();
  }
}

main();
