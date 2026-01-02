#!/usr/bin/env node

const LinkedInBot = require('./linkedinBot');
const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');
require('dotenv').config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise(resolve => {
    rl.question(prompt, resolve);
  });
}

async function loginAndGetVerificationCode() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   LinkedIn Login Helper                ║');
  console.log('║   Get Fresh Verification Code          ║');
  console.log('╚════════════════════════════════════════╝\n');

  console.log('This script will:');
  console.log('1. Open LinkedIn login page');
  console.log('2. Wait for you to log in manually');
  console.log('3. Capture the verification code');
  console.log('4. Update your .env file automatically\n');

  const proceed = await question('Ready to log in? (yes/no): ');
  if (proceed.toLowerCase() !== 'yes') {
    console.log('Cancelled.');
    rl.close();
    process.exit(0);
  }

  const bot = new LinkedInBot();

  try {
    console.log('\n🚀 Starting browser...');
    await bot.init();

    console.log('📱 Navigating to LinkedIn login...');
    await bot.page.goto('https://www.linkedin.com/login', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    console.log('\n👤 Please log in with your LinkedIn credentials...');
    console.log('⏳ Waiting for login to complete...\n');

    // Wait for email field
    await bot.page.waitForSelector('input[name="session_key"], input#session_key', {
      timeout: 60000
    });

    // Wait for redirect to feed or verification page
    let verificationCode = null;
    const startTime = Date.now();
    const timeout = 5 * 60 * 1000; // 5 minutes

    while (!verificationCode && Date.now() - startTime < timeout) {
      const currentUrl = bot.page.url();

      // Check if verification code input appears
      const codeInput = await bot.page.$('input[data-test-id="challenge_code_input"], input[aria-label*="verification"], input[aria-label*="code"]');

      if (codeInput) {
        console.log('\n✅ Verification screen detected!');
        console.log('📧 Check your email or phone for the verification code.\n');

        verificationCode = await question('Enter the 6-digit verification code: ');

        if (verificationCode && verificationCode.length === 6) {
          console.log(`\n✅ Code entered: ${verificationCode}`);

          // Update .env file
          const envPath = path.join(__dirname, '.env');
          let envContent = await fs.readFile(envPath, 'utf-8');

          // Replace or add the verification code
          if (envContent.includes('VERIFICATION_CODE=')) {
            envContent = envContent.replace(
              /VERIFICATION_CODE=.*/,
              `VERIFICATION_CODE=${verificationCode}`
            );
          } else {
            envContent += `\nVERIFICATION_CODE=${verificationCode}`;
          }

          await fs.writeFile(envPath, envContent);
          console.log('✅ .env file updated with new verification code!');
          break;
        } else {
          console.log('❌ Invalid code format. Please enter 6 digits.');
          verificationCode = null;
        }
      }

      await new Promise(r => setTimeout(r, 1000));
    }

    if (!verificationCode) {
      console.log('\n⏱️  Timeout waiting for verification code. Please try again.');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await bot.close();
    rl.close();
  }
}

loginAndGetVerificationCode();
