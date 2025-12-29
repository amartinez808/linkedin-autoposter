const LinkedInBot = require('./linkedinBot');
const JobSearchBot = require('./jobSearchBot');
const JobApplicationBot = require('./jobApplicationBot');
const fs = require('fs');
require('dotenv').config();

async function debugModalHTML() {
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
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Get the ENTIRE body HTML to see what's actually there
    const htmlSnapshot = await bot.page.evaluate(() => {
      // Look for any visible overlays or dialogs
      const allDivs = Array.from(document.querySelectorAll('div'));

      // Find divs that might be modals (high z-index, positioned, etc)
      const suspiciousElements = allDivs.filter(div => {
        const style = window.getComputedStyle(div);
        const zIndex = parseInt(style.zIndex);
        const position = style.position;
        const display = style.display;

        return (zIndex > 100 || position === 'fixed' || position === 'absolute') &&
               display !== 'none' &&
               div.offsetWidth > 0 &&
               div.offsetHeight > 0;
      });

      return {
        count: suspiciousElements.length,
        samples: suspiciousElements.slice(0, 5).map(el => ({
          tagName: el.tagName,
          id: el.id,
          className: el.className,
          role: el.getAttribute('role'),
          ariaLabel: el.getAttribute('aria-label'),
          ariaModal: el.getAttribute('aria-modal'),
          dataTestModal: el.getAttribute('data-test-modal-id'),
          innerHTML: el.innerHTML.substring(0, 1000),
          outerHTML: el.outerHTML.substring(0, 1000),
          zIndex: window.getComputedStyle(el).zIndex,
          position: window.getComputedStyle(el).position
        }))
      };
    });

    console.log('\n' + '='.repeat(80));
    console.log('MODAL HTML DEBUG');
    console.log('='.repeat(80));
    console.log(`Found ${htmlSnapshot.count} suspicious elements (high z-index or positioned)`);
    console.log('\nFirst 5 samples:');
    console.log(JSON.stringify(htmlSnapshot.samples, null, 2));
    console.log('='.repeat(80) + '\n');

    // Save to file for easier inspection
    fs.writeFileSync('debug-modal-html.json', JSON.stringify(htmlSnapshot, null, 2));
    console.log('💾 Saved full HTML snapshot to debug-modal-html.json');

    await bot.page.screenshot({
      path: 'screenshots/debug-modal-html.png'
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await bot.close();
  }
}

debugModalHTML();
