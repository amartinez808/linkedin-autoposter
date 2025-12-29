#!/usr/bin/env node

const Scheduler = require('./scheduler');
require('dotenv').config();

// Validate environment variables
function validateEnv() {
  const required = ['LINKEDIN_EMAIL', 'LINKEDIN_PASSWORD', 'OPENAI_API_KEY'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    console.error('\n💡 Copy .env.example to .env and fill in your credentials');
    process.exit(1);
  }
}

async function main() {
  console.clear();
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║                                                           ║');
  console.log('║        LinkedIn Auto-Poster for RAD AI                    ║');
  console.log('║        Rational Automation Design                         ║');
  console.log('║                                                           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('\n');

  // Validate environment
  validateEnv();

  // Start scheduler
  const scheduler = new Scheduler();
  await scheduler.start();

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n\n🛑 Shutting down gracefully...');
    scheduler.stop();
    process.exit(0);
  });
}

main().catch(error => {
  console.error('❌ Fatal error:', error.message);
  process.exit(1);
});
