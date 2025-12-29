const LinkedInBot = require('./linkedinBot');
const JobSearchBot = require('./jobSearchBot');
const JobApplicationBot = require('./jobApplicationBot');
require('dotenv').config();

async function debugIframe() {
  const bot = new LinkedInBot();

  try {
    await bot.init();
    await bot.login();

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

    const job = jobs[0];
    console.log(`\n🎯 Testing iframe detection on: ${job.title}\n`);

    await bot.page.goto(job.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Click Easy Apply
    const appBot = new JobApplicationBot(bot);
    const clicked = await appBot.clickEasyApplyButton();

    if (!clicked) {
      console.log('❌ Easy Apply button not clicked');
      return;
    }

    console.log('✅ Easy Apply button clicked, waiting for iframe...');
    await new Promise(resolve => setTimeout(resolve, 7000));

    // Check for iframes
    const frames = bot.page.frames();
    console.log(`\n📊 Total frames on page: ${frames.length}\n`);

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      console.log(`--- Frame ${i} ---`);
      console.log(`URL: ${frame.url()}`);
      console.log(`Name: ${frame.name()}`);

      try {
        const title = await frame.title();
        console.log(`Title: ${title}`);

        // Try to find contact info or Apply text
        const hasApplyForm = await frame.evaluate(() => {
          const bodyText = document.body ? document.body.innerText : '';
          return {
            hasContactInfo: bodyText.includes('Contact info'),
            hasApplyTo: bodyText.includes('Apply to'),
            hasEmailAddress: bodyText.includes('Email address'),
            hasPhoneNumber: bodyText.includes('phone'),
            bodyTextSample: bodyText.substring(0, 500)
          };
        });

        console.log('Apply form check:', JSON.stringify(hasApplyForm, null, 2));

        if (hasApplyForm.hasContactInfo || hasApplyForm.hasApplyTo) {
          console.log('\n✅ FOUND THE APPLY FORM IN THIS IFRAME!\n');

          // Get form structure
          const formStructure = await frame.evaluate(() => {
            return {
              buttons: Array.from(document.querySelectorAll('button')).map(b => ({
                text: b.innerText,
                type: b.type,
                className: b.className,
                id: b.id
              })),
              inputs: Array.from(document.querySelectorAll('input')).map(i => ({
                type: i.type,
                name: i.name,
                placeholder: i.placeholder,
                id: i.id
              }))
            };
          });

          console.log('Form structure:', JSON.stringify(formStructure, null, 2));
        }

      } catch (e) {
        console.log(`Error accessing frame ${i}:`, e.message);
      }

      console.log('');
    }

    await bot.page.screenshot({
      path: 'screenshots/debug-iframe.png'
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await bot.close();
  }
}

debugIframe();
