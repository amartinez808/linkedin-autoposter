const LinkedInBot = require('./linkedinBot');
const JobSearchBot = require('./jobSearchBot');
const JobApplicationBot = require('./jobApplicationBot');
require('dotenv').config();

async function testEasyApplyClick() {
  const bot = new LinkedInBot();

  try {
    await bot.init();
    await bot.login();

    // Search for jobs
    const jobSearchBot = new JobSearchBot(bot);
    const jobs = await jobSearchBot.searchJobs({
      keywords: 'Software Engineer',
      location: 'Remote',
      experienceLevel: 'mid-senior',
      easyApplyOnly: true,
      maxResults: 3
    });

    if (jobs.length === 0) {
      console.log('No jobs found');
      return;
    }

    console.log(`\n✅ Found ${jobs.length} jobs\n`);

    // Test Easy Apply button click on first job
    const job = jobs[0];
    console.log(`🎯 Testing Easy Apply button on: ${job.title} at ${job.company}\n`);

    // Navigate to job page
    await bot.page.goto(job.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Take screenshot
    await bot.page.screenshot({
      path: 'screenshots/before-click.png'
    });

    // Try to click Easy Apply
    const appBot = new JobApplicationBot(bot);
    const clicked = await appBot.clickEasyApplyButton();

    if (clicked) {
      console.log('\n✅ SUCCESS! Easy Apply button was clicked!');
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Take screenshot after click
      await bot.page.screenshot({
        path: 'screenshots/after-click.png'
      });

      console.log('📸 Screenshots saved: before-click.png and after-click.png\n');
    } else {
      console.log('\n❌ FAILED! Easy Apply button was not clicked\n');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await bot.close();
  }
}

testEasyApplyClick();
