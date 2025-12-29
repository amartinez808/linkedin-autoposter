const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Human-like delay function
function randomDelay(min = 2000, max = 5000) {
  return new Promise(resolve =>
    setTimeout(resolve, Math.random() * (max - min) + min)
  );
}

// Simulate human typing
async function humanType(page, selector, text) {
  await page.click(selector);
  await randomDelay(500, 1000);

  for (const char of text) {
    await page.keyboard.type(char);
    await randomDelay(50, 150); // Random delay between keystrokes
  }
}

class LinkedInBot {
  constructor() {
    this.browser = null;
    this.page = null;
    this.isLoggedIn = false;
  }

  async init() {
    console.log('🚀 Initializing LinkedIn Bot...');

    const userDataDir = path.join(__dirname, 'user-data');

    this.browser = await puppeteer.launch({
      headless: process.env.HEADLESS === 'true',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ],
      userDataDir: userDataDir,
      defaultViewport: {
        width: 1920,
        height: 1080
      }
    });

    this.page = await this.browser.newPage();

    // Set longer default timeout for all operations
    this.page.setDefaultNavigationTimeout(90000); // 90 seconds
    this.page.setDefaultTimeout(90000);

    // Additional stealth measures
    await this.page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
    });

    console.log('✅ Browser initialized');
  }

  async login() {
    if (this.isLoggedIn) {
      console.log('ℹ️  Already logged in');
      return;
    }

    console.log('🔐 Logging into LinkedIn...');

    try {
      await this.page.goto('https://www.linkedin.com/login', {
        waitUntil: 'networkidle2'
      });

      await randomDelay(2000, 4000);

      // Check if already logged in
      const currentUrl = this.page.url();
      if (currentUrl.includes('/feed')) {
        console.log('✅ Already logged in (session detected)');
        this.isLoggedIn = true;
        return;
      }

      // Type email
      await humanType(this.page, '#username', process.env.LINKEDIN_EMAIL);
      await randomDelay(1000, 2000);

      // Type password
      await humanType(this.page, '#password', process.env.LINKEDIN_PASSWORD);
      await randomDelay(1000, 2000);

      // Click login button
      await this.page.click('button[type="submit"]');

      console.log('⏳ Waiting for login to complete...');
      await randomDelay(5000, 8000);

      // Instead of waiting for navigation, wait for feed elements to appear
      try {
        await this.page.waitForSelector('[data-control-name="share_with_network"], button[aria-label*="Start a post"]', { timeout: 60000 });
        console.log('✅ Feed loaded successfully!');
      } catch (e) {
        console.log('⚠️  Feed not detected, checking URL...');
      }

      const finalUrl = this.page.url();

      // Check if verification is needed
      if (finalUrl.includes('/checkpoint/challenge')) {
        console.log('📱 Verification required! Entering code...');

        // Check if verification code is set in environment
        if (process.env.VERIFICATION_CODE) {
          await randomDelay(2000, 3000);

          // Find and fill the verification code input
          const inputSelector = 'input[type="text"]';
          await this.page.waitForSelector(inputSelector, { timeout: 10000 });
          await humanType(this.page, inputSelector, process.env.VERIFICATION_CODE);

          await randomDelay(1000, 2000);

          // Click submit button
          await this.page.click('button[type="submit"]');

          console.log('✅ Verification code submitted!');
          await randomDelay(5000, 8000);

          // Wait for feed elements after verification instead of navigation
          try {
            await this.page.waitForSelector('[data-control-name="share_with_network"], button[aria-label*="Start a post"]', { timeout: 60000 });
            console.log('✅ Feed loaded after verification!');
          } catch (e) {
            console.log('⚠️  Feed not detected after verification, checking URL...');
          }

          const verifiedUrl = this.page.url();
          if (verifiedUrl.includes('/feed') || verifiedUrl.includes('/mynetwork')) {
            console.log('✅ Successfully logged in after verification!');
            this.isLoggedIn = true;
            await this.page.screenshot({
              path: path.join(__dirname, 'screenshots', `login-success-${Date.now()}.png`)
            });
          } else {
            throw new Error('Login failed after verification - URL: ' + verifiedUrl);
          }
        } else {
          throw new Error('Verification required but no VERIFICATION_CODE set in .env');
        }
      } else if (finalUrl.includes('/feed') || finalUrl.includes('/mynetwork')) {
        console.log('✅ Successfully logged in!');
        this.isLoggedIn = true;

        // Take screenshot for confirmation
        await this.page.screenshot({
          path: path.join(__dirname, 'screenshots', `login-success-${Date.now()}.png`)
        });
      } else {
        throw new Error('Login may have failed - unexpected URL: ' + finalUrl);
      }

    } catch (error) {
      console.error('⚠️  Login error:', error.message);

      // Try to take screenshot (may fail if page closed)
      try {
        await this.page.screenshot({
          path: path.join(__dirname, 'screenshots', `login-error-${Date.now()}.png`)
        });
      } catch (screenshotError) {
        console.log('⚠️  Could not take screenshot');
      }

      // Check if we're actually logged in despite the error
      try {
        const currentUrl = this.page.url();
        if (currentUrl.includes('/feed') || currentUrl.includes('/mynetwork')) {
          console.log('✅ Despite error, we are logged in! Continuing...');
          this.isLoggedIn = true;
          return;
        }
      } catch (urlError) {
        console.log('⚠️  Cannot check URL - page may be closed');
      }

      throw error;
    }
  }

  async createPost(content, imagePath = null) {
    console.log('📝 Creating LinkedIn post...');
    if (imagePath) {
      console.log(`🖼️  Including image: ${imagePath}`);
    }

    try {
      // Navigate to feed if not already there
      if (!this.page.url().includes('/feed')) {
        await this.page.goto('https://www.linkedin.com/feed/', {
          waitUntil: 'networkidle2'
        });
        await randomDelay(3000, 5000);
      }

      // Click "Start a post" button
      const startPostSelectors = [
        'button[aria-label="Start a post"]',
        'button[aria-label*="Start a post"]',
        '.share-box-feed-entry__trigger',
        'button.share-box-feed-entry__trigger',
        '[data-control-name="share_with_network"]',
        '.share-box__button',
        '[class*="share-box"]',
        'div[role="button"]:has-text("Start a post")'
      ];

      let clicked = false;
      for (const selector of startPostSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 5000 });
          await this.page.click(selector);
          clicked = true;
          console.log('✅ Clicked start post button');
          break;
        } catch (e) {
          continue;
        }
      }

      if (!clicked) {
        throw new Error('Could not find "Start a post" button');
      }

      await randomDelay(2000, 4000);

      // If image is provided, upload it first
      if (imagePath) {
        console.log('📸 Uploading image...');

        try {
          // Look for the photo/media upload button
          const photoButtonSelectors = [
            'button[aria-label="Add a photo"]',
            'button[aria-label*="photo"]',
            'button[aria-label*="Photo"]',
            'button[aria-label*="media"]',
            '[data-test-share-box-media-icon]',
            'button.share-box-footer__media-icon',
            'button[data-control-name="share.photos"]'
          ];

          let photoButtonClicked = false;
          for (const selector of photoButtonSelectors) {
            try {
              await this.page.waitForSelector(selector, { timeout: 3000 });
              await this.page.click(selector);
              photoButtonClicked = true;
              console.log('✅ Clicked photo upload button');
              break;
            } catch (e) {
              continue;
            }
          }

          if (!photoButtonClicked) {
            console.log('⚠️  Could not find photo button, posting without image');
          } else {
            await randomDelay(1000, 2000);

            // Find and upload the file - try multiple selectors
            const fileInputSelectors = [
              'input[type="file"][accept*="image"]',
              'input[type="file"]',
              'input[accept*="image"]'
            ];

            let fileInput = null;
            for (const selector of fileInputSelectors) {
              try {
                await this.page.waitForSelector(selector, { timeout: 3000 });
                fileInput = await this.page.$(selector);
                if (fileInput) {
                  console.log(`✅ Found file input with selector: ${selector}`);
                  break;
                }
              } catch (e) {
                continue;
              }
            }

            if (fileInput) {
              await fileInput.uploadFile(imagePath);
              console.log('✅ Image file uploaded');

              // Wait for image to process
              await randomDelay(3000, 5000);
            } else {
              console.log('⚠️  Could not find file input, posting without image');
            }
          }
        } catch (error) {
          console.error('⚠️  Error uploading image:', error.message);
          console.log('Continuing with text-only post...');
        }
      }

      // Wait for the post editor to appear
      const editorSelectors = [
        '.ql-editor[data-placeholder="What do you want to talk about?"]',
        '.ql-editor',
        '[contenteditable="true"]'
      ];

      let editor = null;
      for (const selector of editorSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 5000 });
          editor = selector;
          break;
        } catch (e) {
          continue;
        }
      }

      if (!editor) {
        throw new Error('Could not find post editor');
      }

      // Click the editor and type content
      await this.page.click(editor);
      await randomDelay(1000, 2000);

      // Type the content with human-like delays
      console.log('⌨️  Typing post content...');
      for (const char of content) {
        await this.page.keyboard.type(char);
        const delay = char === '\n' ? 200 : Math.random() * 100 + 50;
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      await randomDelay(2000, 4000);

      // Take screenshot before posting
      await this.page.screenshot({
        path: path.join(__dirname, 'screenshots', `pre-post-${Date.now()}.png`)
      });

      // Find and click the Post button
      const postButtonSelectors = [
        'button[data-control-name="share.post"]',
        'button.share-actions__primary-action',
        'button[aria-label*="Post"]'
      ];

      let posted = false;
      for (const selector of postButtonSelectors) {
        try {
          const button = await this.page.$(selector);
          if (button) {
            const isDisabled = await this.page.evaluate(el => el.disabled, button);
            if (!isDisabled) {
              await button.click();
              posted = true;
              console.log('✅ Clicked Post button');
              break;
            }
          }
        } catch (e) {
          continue;
        }
      }

      if (!posted) {
        throw new Error('Could not find or click Post button');
      }

      await randomDelay(3000, 5000);

      // Take screenshot after posting
      await this.page.screenshot({
        path: path.join(__dirname, 'screenshots', `post-success-${Date.now()}.png`)
      });

      console.log('✅ Post published successfully!');
      return true;

    } catch (error) {
      console.error('❌ Failed to create post:', error.message);
      await this.page.screenshot({
        path: path.join(__dirname, 'screenshots', `post-error-${Date.now()}.png`)
      });
      throw error;
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log('🔒 Browser closed');
    }
  }
}

module.exports = LinkedInBot;
