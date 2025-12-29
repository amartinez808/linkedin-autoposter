const LinkedInBot = require('./linkedinBot');
const JobSearchBot = require('./jobSearchBot');
const JobApplicationBot = require('./jobApplicationBot');
require('dotenv').config();

async function debugModal() {
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
    console.log(`\n🎯 Testing modal on: ${job.title} at ${job.company}\n`);

    await bot.page.goto(job.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Click Easy Apply
    const appBot = new JobApplicationBot(bot);
    const clicked = await appBot.clickEasyApplyButton();

    if (!clicked) {
      console.log('❌ Easy Apply button not clicked');
      return;
    }

    console.log('✅ Easy Apply button clicked!');

    // Wait for modal to appear
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Debug - what modal elements are present?
    const modalInfo = await bot.page.evaluate(() => {
      const results = {
        possibleModals: []
      };

      // Look for any modal-like elements
      const selectors = [
        '[role="dialog"]',
        '.modal',
        '[class*="modal"]',
        '[class*="Modal"]',
        '.artdeco-modal',
        '.jobs-easy-apply-modal',
        'div[aria-labelledby]',
        'div[data-test-modal]'
      ];

      selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          results.possibleModals.push({
            selector: selector,
            count: elements.length,
            sample: {
              className: elements[0].className,
              id: elements[0].id,
              role: elements[0].getAttribute('role'),
              ariaLabel: elements[0].getAttribute('aria-label'),
              ariaLabelledBy: elements[0].getAttribute('aria-labelledby'),
              outerHTML: elements[0].outerHTML.substring(0, 500)
            }
          });
        }
      });

      return results;
    });

    console.log('\n' + '='.repeat(60));
    console.log('DEBUG: Modal Analysis');
    console.log('='.repeat(60));
    console.log(JSON.stringify(modalInfo, null, 2));
    console.log('='.repeat(60) + '\n');

    await bot.page.screenshot({
      path: 'screenshots/debug-modal.png'
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await bot.close();
  }
}

debugModal();
