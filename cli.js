#!/usr/bin/env node

const { generatePostBatch } = require('./contentGenerator');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

const commands = {
  async generate(count = 5) {
    console.log(`📝 Generating ${count} posts...\n`);

    const posts = await generatePostBatch(parseInt(count));

    console.log(`✅ Generated ${posts.length} posts:\n`);

    posts.forEach((post, i) => {
      console.log(`\n[Post ${i + 1}] Topic: ${post.topic}`);
      console.log('─'.repeat(60));
      console.log(post.content);
      console.log('─'.repeat(60));
    });

    // Save to queue
    const queuePath = path.join(__dirname, 'posts', 'queue.json');
    await fs.mkdir(path.join(__dirname, 'posts'), { recursive: true });

    let queue = [];
    try {
      const existing = await fs.readFile(queuePath, 'utf-8');
      queue = JSON.parse(existing);
    } catch (e) {
      // No existing queue
    }

    queue.push(...posts);
    await fs.writeFile(queuePath, JSON.stringify(queue, null, 2));

    console.log(`\n💾 Saved to queue. Total posts in queue: ${queue.length}`);
  },

  async queue() {
    const queuePath = path.join(__dirname, 'posts', 'queue.json');

    try {
      const data = await fs.readFile(queuePath, 'utf-8');
      const queue = JSON.parse(data);

      console.log(`📋 Posts in Queue: ${queue.length}\n`);

      queue.forEach((post, i) => {
        console.log(`[${i + 1}] ${post.topic}`);
        console.log(`    Generated: ${new Date(post.generatedAt).toLocaleString()}`);
        console.log(`    Preview: ${post.content.substring(0, 80)}...`);
        console.log('');
      });
    } catch (error) {
      console.log('📋 Queue is empty');
    }
  },

  async history() {
    const historyPath = path.join(__dirname, 'posts', 'history.json');

    try {
      const data = await fs.readFile(historyPath, 'utf-8');
      const history = JSON.parse(data);

      console.log(`📊 Post History: ${history.length} total\n`);

      const successful = history.filter(p => p.success).length;
      const failed = history.filter(p => !p.success).length;

      console.log(`✅ Successful: ${successful}`);
      console.log(`❌ Failed: ${failed}\n`);

      console.log('Recent posts:\n');

      history.slice(-10).reverse().forEach((post, i) => {
        const icon = post.success ? '✅' : '❌';
        console.log(`${icon} ${new Date(post.timestamp).toLocaleString()}`);
        console.log(`   ${post.content}`);
        if (!post.success) {
          console.log(`   Error: ${post.error}`);
        }
        console.log('');
      });
    } catch (error) {
      console.log('📊 No history yet');
    }
  },

  async clear() {
    const queuePath = path.join(__dirname, 'posts', 'queue.json');
    await fs.writeFile(queuePath, '[]');
    console.log('🗑️  Queue cleared');
  },

  help() {
    console.log(`
LinkedIn Auto-Poster CLI

Commands:
  generate [count]  - Generate new posts (default: 5)
  queue             - View posts in queue
  history           - View posting history
  clear             - Clear the queue
  help              - Show this help message

Examples:
  node cli.js generate 10
  node cli.js queue
  node cli.js history
    `);
  }
};

// Parse command
const [,, command, ...args] = process.argv;

if (!command || !commands[command]) {
  commands.help();
} else {
  commands[command](...args).catch(error => {
    console.error('❌ Error:', error.message);
    process.exit(1);
  });
}
