const LinkedInBot = require('./linkedinBot');
const JobSearchBot = require('./jobSearchBot');
const JobApplicationBot = require('./jobApplicationBot');
require('dotenv').config();

async function debugButtons() {
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
    console.log(`\n🎯 Testing button detection on: ${job.title}\n`);

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

    // Wait for modal (using simplified approach)
    console.log('⏳ Waiting 10 seconds for modal to load...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    console.log('✅ Modal should be loaded\n');

    // Method 1: Try to find ALL buttons on the page
    console.log('='.repeat(80));
    console.log('METHOD 1: Query all buttons');
    console.log('='.repeat(80));

    const allButtons = await bot.page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.map((btn, i) => ({
        index: i,
        text: btn.innerText?.trim() || '',
        ariaLabel: btn.getAttribute('aria-label'),
        className: btn.className,
        id: btn.id,
        type: btn.type,
        visible: btn.offsetWidth > 0 && btn.offsetHeight > 0
      }));
    });

    console.log(`\nFound ${allButtons.length} buttons total`);
    console.log('\nVisible buttons with text:');
    const visibleWithText = allButtons.filter(b => b.visible && b.text);
    visibleWithText.forEach(b => {
      console.log(`  [${b.index}] "${b.text}" (aria-label: ${b.ariaLabel || 'none'})`);
    });

    // Method 2: Try keyboard navigation
    console.log('\n' + '='.repeat(80));
    console.log('METHOD 2: Try keyboard navigation');
    console.log('='.repeat(80));

    console.log('\nPressing Tab 10 times to focus through modal...');
    for (let i = 0; i < 10; i++) {
      await bot.page.keyboard.press('Tab');
      await new Promise(resolve => setTimeout(resolve, 200));

      // Check what's focused
      const focused = await bot.page.evaluate(() => {
        const el = document.activeElement;
        return {
          tagName: el?.tagName,
          text: el?.innerText?.trim() || '',
          ariaLabel: el?.getAttribute('aria-label'),
          className: el?.className
        };
      });

      console.log(`  Tab ${i + 1}: ${focused.tagName} - "${focused.text}" (${focused.ariaLabel || 'no aria-label'})`);

      // If we find Next button, stop
      if (focused.text?.toLowerCase().includes('next') ||
          focused.ariaLabel?.toLowerCase().includes('next')) {
        console.log(`\n✅ Found Next button after ${i + 1} tabs!`);
        break;
      }
    }

    // Method 3: Try clicking by coordinates
    console.log('\n' + '='.repeat(80));
    console.log('METHOD 3: Button bounding boxes');
    console.log('='.repeat(80));

    const buttonBoxes = await bot.page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons
        .filter(b => b.offsetWidth > 0 && b.offsetHeight > 0)
        .map(btn => {
          const rect = btn.getBoundingClientRect();
          return {
            text: btn.innerText?.trim() || '',
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            centerX: rect.x + rect.width / 2,
            centerY: rect.y + rect.height / 2
          };
        });
    });

    console.log('\nButton positions (visible only):');
    buttonBoxes.forEach(b => {
      console.log(`  "${b.text}" at (${Math.round(b.centerX)}, ${Math.round(b.centerY)})`);
    });

    await bot.page.screenshot({
      path: 'screenshots/debug-buttons.png'
    });

    console.log('\n📸 Screenshot saved to screenshots/debug-buttons.png');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await bot.close();
  }
}

debugButtons();
