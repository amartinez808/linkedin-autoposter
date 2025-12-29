const LinkedInBot = require('./linkedinBot');
require('dotenv').config();

async function debugSelectors() {
  const bot = new LinkedInBot();

  try {
    await bot.init();
    await bot.login();

    // Navigate to jobs search
    await bot.page.goto('https://www.linkedin.com/jobs/search/?keywords=Software+Engineer&location=Remote&f_AL=true&f_E=3', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Debug - log what elements we can find
    const debug = await bot.page.evaluate(() => {
      const results = {
        possibleJobCards: []
      };

      // Try to find job-related elements
      const selectors = [
        'li',
        'div[data-job-id]',
        '[class*="job"]',
        '.jobs-search-results__list-item',
        'li.jobs-search-results__list-item',
        'div.job-card-container',
        'article',
        '[role="listitem"]'
      ];

      selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        results.possibleJobCards.push({
          selector: selector,
          count: elements.length,
          sample: elements.length > 0 ? {
            classes: elements[0].className,
            tagName: elements[0].tagName,
            attributes: Array.from(elements[0].attributes).map(attr => `${attr.name}="${attr.value}"`).slice(0, 5)
          } : null
        });
      });

      return results;
    });

    console.log('\n' + '='.repeat(60));
    console.log('DEBUG: Element Analysis');
    console.log('='.repeat(60));
    console.log(JSON.stringify(debug, null, 2));
    console.log('='.repeat(60) + '\n');

    await bot.page.screenshot({
      path: 'screenshots/debug-page.png'
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await bot.close();
  }
}

debugSelectors();
