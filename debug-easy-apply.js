const LinkedInBot = require('./linkedinBot');
const JobSearchBot = require('./jobSearchBot');
require('dotenv').config();

async function debugEasyApply() {
  const bot = new LinkedInBot();

  try {
    await bot.init();
    await bot.login();

    // Create job search bot
    const jobSearchBot = new JobSearchBot(bot);

    // Search for a few jobs
    const jobs = await jobSearchBot.searchJobs({
      keywords: 'Software Engineer',
      location: 'Remote',
      experienceLevel: 'mid-senior',
      easyApplyOnly: true,
      maxResults: 5
    });

    if (jobs.length === 0) {
      console.log('No jobs found');
      return;
    }

    // Take the first job
    const job = jobs[0];
    console.log(`\n🔍 Debugging job: ${job.title} at ${job.company}\n`);

    // Navigate to job page
    await bot.page.goto(job.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Extract button information
    const buttonInfo = await bot.page.evaluate(() => {
      const results = {
        possibleButtons: []
      };

      // Try to find all button-like elements
      const selectors = [
        'button',
        '[role="button"]',
        'a.jobs-apply-button',
        'button.jobs-apply-button',
        '.jobs-apply-button',
        'button[aria-label*="Easy Apply"]',
        'button[aria-label*="easy apply" i]',
        '.jobs-s-apply button',
        '.jobs-apply-button--top-card button',
        'button:has-text("Easy Apply")'
      ];

      // Look for any element containing "Easy Apply" text
      const allButtons = document.querySelectorAll('button');
      allButtons.forEach((btn, index) => {
        const text = btn.innerText || btn.textContent || '';
        const ariaLabel = btn.getAttribute('aria-label') || '';

        if (text.toLowerCase().includes('easy apply') || text.toLowerCase().includes('apply') || ariaLabel.toLowerCase().includes('apply')) {
          results.possibleButtons.push({
            index: index,
            text: text.trim(),
            ariaLabel: ariaLabel,
            className: btn.className,
            id: btn.id,
            tagName: btn.tagName,
            outerHTML: btn.outerHTML.substring(0, 500),
            isVisible: btn.offsetParent !== null
          });
        }
      });

      // Also check for links that might be styled as buttons
      const allLinks = document.querySelectorAll('a');
      allLinks.forEach((link, index) => {
        const text = link.innerText || link.textContent || '';

        if (text.toLowerCase().includes('easy apply')) {
          results.possibleButtons.push({
            index: index,
            text: text.trim(),
            className: link.className,
            id: link.id,
            tagName: link.tagName,
            href: link.href,
            outerHTML: link.outerHTML.substring(0, 500),
            isVisible: link.offsetParent !== null
          });
        }
      });

      return results;
    });

    console.log('\n' + '='.repeat(60));
    console.log('DEBUG: Easy Apply Button Analysis');
    console.log('='.repeat(60));
    console.log(JSON.stringify(buttonInfo, null, 2));
    console.log('='.repeat(60) + '\n');

    await bot.page.screenshot({
      path: 'screenshots/debug-easy-apply.png'
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await bot.close();
  }
}

debugEasyApply();
