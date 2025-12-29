const fs = require('fs').promises;
const path = require('path');
const OpenAI = require('openai');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Human-like delay function
function randomDelay(min = 2000, max = 5000) {
  return new Promise(resolve =>
    setTimeout(resolve, Math.random() * (max - min) + min)
  );
}

class JobApplicationBot {
  constructor(linkedInBot) {
    this.bot = linkedInBot;
    this.page = linkedInBot.page;
    this.applications = [];
  }

  /**
   * Apply to a job using Easy Apply
   * @param {Object} job - Job object with url, title, company, etc.
   * @param {Object} applicationData - Application data (resume path, contact info, etc.)
   */
  async applyToJob(job, applicationData = {}) {
    console.log('\n📝 Applying to job...');
    console.log(`   Title: ${job.title}`);
    console.log(`   Company: ${job.company}`);
    console.log(`   Location: ${job.location}\n`);

    try {
      // Navigate to job page
      try {
        await this.page.goto(job.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      } catch (navError) {
        console.log('⚠️  Navigation timeout, checking if page loaded...');
      }

      await randomDelay(3000, 5000);

      // Take screenshot of job page
      await this.page.screenshot({
        path: path.join(__dirname, 'screenshots', `job-${job.id}-${Date.now()}.png`)
      });

      // Click Easy Apply button
      const easyApplyClicked = await this.clickEasyApplyButton();

      if (!easyApplyClicked) {
        console.log('❌ Could not find Easy Apply button - skipping this job\n');
        return {
          success: false,
          reason: 'No Easy Apply button found'
        };
      }

      console.log('⏳ Waiting for modal to appear...');
      await randomDelay(5000, 7000); // Increased wait time for modal to load

      // Take screenshot to debug modal state
      await this.page.screenshot({
        path: path.join(__dirname, 'screenshots', `modal-check-${job.id}-${Date.now()}.png`)
      });

      // Handle multi-step Easy Apply modal
      const result = await this.handleEasyApplyModal(job, applicationData);

      if (result.success) {
        console.log('✅ Application submitted successfully!\n');
      } else {
        console.log(`❌ Application failed: ${result.reason}\n`);
      }

      return result;

    } catch (error) {
      console.error('❌ Error applying to job:', error.message);
      await this.page.screenshot({
        path: path.join(__dirname, 'screenshots', `apply-error-${job.id}-${Date.now()}.png`)
      });

      return {
        success: false,
        reason: error.message
      };
    }
  }

  /**
   * Click the Easy Apply button
   */
  async clickEasyApplyButton() {
    const selectors = [
      // LinkedIn uses <a> tags styled as buttons, not actual <button> elements
      'a[data-view-name="job-apply-button"]',
      'a[aria-label*="Easy Apply"]',
      'a[href*="/apply/?openSDUIApplyFlow"]',
      'button.jobs-apply-button',
      'button[aria-label*="Easy Apply"]',
      '.jobs-apply-button--top-card button',
      '.jobs-apply-button--top-card a'
    ];

    for (const selector of selectors) {
      try {
        await this.page.waitForSelector(selector, { timeout: 5000 });
        await this.page.click(selector);
        console.log('✅ Clicked Easy Apply button\n');
        return true;
      } catch (e) {
        continue;
      }
    }

    return false;
  }

  /**
   * Handle the Easy Apply modal (multi-step form)
   */
  async handleEasyApplyModal(job, applicationData) {
    console.log('📋 Handling Easy Apply form...\n');

    const maxSteps = 10;
    let currentStep = 0;

    try {
      // LinkedIn's modal opens reliably but is hidden from JavaScript detection
      // So we just wait a fixed time for it to load, which is simpler and works
      console.log(`   ⏳ Waiting 10 seconds for Easy Apply form to load...`);
      await randomDelay(10000, 12000);
      console.log(`   ✅ Modal should be loaded, proceeding...\n`);

      while (currentStep < maxSteps) {
        currentStep++;
        console.log(`   Step ${currentStep}...`);

        await randomDelay(1000, 2000);

        // Check if we're on the final review page
        const isReviewPage = await this.isReviewPage();

        if (isReviewPage) {
          console.log('   ✅ Reached review page\n');

          // Take screenshot before submitting
          await this.page.screenshot({
            path: path.join(__dirname, 'screenshots', `review-${job.id}-${Date.now()}.png`)
          });

          // Check if we should submit or just save for review
          if (process.env.AUTO_SUBMIT_APPLICATIONS === 'true') {
            return await this.submitApplication();
          } else {
            console.log('⚠️  AUTO_SUBMIT_APPLICATIONS=false - not submitting (review manually)\n');
            return {
              success: false,
              reason: 'Saved for manual review (auto-submit disabled)',
              reviewReady: true
            };
          }
        }

        // Upload resume if needed
        const resumeUploaded = await this.uploadResumeIfNeeded(applicationData.resumePath);

        // Fill form fields on this page
        await this.fillCurrentPage(job, applicationData);

        // Click Next button
        const nextClicked = await this.clickNextButton();

        if (!nextClicked) {
          console.log('⚠️  Could not find Next button - checking for Submit...\n');

          // Maybe we're already at the review page
          const submitClicked = await this.submitApplication();

          if (submitClicked.success) {
            return submitClicked;
          }

          return {
            success: false,
            reason: 'Could not proceed - no Next or Submit button found'
          };
        }

        await randomDelay(2000, 3000);
      }

      return {
        success: false,
        reason: 'Exceeded maximum steps without completing application'
      };

    } catch (error) {
      console.error('❌ Error in Easy Apply modal:', error.message);

      return {
        success: false,
        reason: error.message
      };
    }
  }

  /**
   * Check if we're on the review page (final step)
   */
  async isReviewPage() {
    try {
      const reviewText = await this.page.evaluate(() => {
        const modal = document.querySelector('.jobs-easy-apply-modal');
        return modal ? modal.innerText : '';
      });

      return reviewText.includes('Review your application') ||
             reviewText.includes('Review') && reviewText.includes('Submit');
    } catch (e) {
      return false;
    }
  }

  /**
   * Upload resume if file input is found
   */
  async uploadResumeIfNeeded(resumePath) {
    if (!resumePath) {
      return false;
    }

    try {
      const fileInput = await this.page.$('input[type="file"]');

      if (fileInput) {
        console.log('   📎 Uploading resume...');

        // Check if resume needs to be converted to PDF
        if (resumePath.endsWith('.docx')) {
          console.log('   ⚠️  Warning: LinkedIn prefers PDF resumes. Consider converting your .docx to PDF.');
        }

        await fileInput.uploadFile(resumePath);
        await randomDelay(2000, 4000);

        console.log('   ✅ Resume uploaded\n');
        return true;
      }

      return false;
    } catch (error) {
      console.log('   ⚠️  Could not upload resume:', error.message);
      return false;
    }
  }

  /**
   * Fill form fields on the current page
   */
  async fillCurrentPage(job, applicationData) {
    try {
      // Get all input fields on the page
      const inputs = await this.page.$$('input[type="text"], input[type="tel"], input[type="email"], textarea');

      for (const input of inputs) {
        const label = await this.getInputLabel(input);
        const currentValue = await input.evaluate(el => el.value);

        // Skip if already filled
        if (currentValue && currentValue.trim() !== '') {
          continue;
        }

        const value = await this.getInputValue(label, applicationData, job);

        if (value) {
          await input.click();
          await randomDelay(300, 600);
          await input.type(value, { delay: Math.random() * 50 + 30 });
          console.log(`   ✏️  Filled: ${label} = ${value}`);
        }
      }

      // Handle radio buttons and checkboxes
      await this.handleRadioButtons(applicationData);

      // Handle dropdowns/select elements
      await this.handleDropdowns(applicationData);

    } catch (error) {
      console.log('   ⚠️  Error filling page:', error.message);
    }
  }

  /**
   * Get label for an input field
   */
  async getInputLabel(input) {
    try {
      const label = await this.page.evaluate(el => {
        const labelElement = el.closest('label') ||
                            document.querySelector(`label[for="${el.id}"]`) ||
                            el.previousElementSibling;
        return labelElement ? labelElement.innerText.trim() : el.placeholder || el.name || '';
      }, input);

      return label;
    } catch (e) {
      return '';
    }
  }

  /**
   * Get the appropriate value for an input based on its label
   */
  async getInputValue(label, applicationData, job) {
    const lowerLabel = label.toLowerCase();

    // Phone number
    if (lowerLabel.includes('phone') || lowerLabel.includes('mobile')) {
      return applicationData.phone || process.env.PHONE || '';
    }

    // Email
    if (lowerLabel.includes('email')) {
      return applicationData.email || process.env.EMAIL || process.env.LINKEDIN_EMAIL || '';
    }

    // City
    if (lowerLabel.includes('city') && !lowerLabel.includes('citizenship')) {
      return applicationData.city || process.env.CITY || 'Providence';
    }

    // LinkedIn URL
    if (lowerLabel.includes('linkedin')) {
      return applicationData.linkedinUrl || process.env.LINKEDIN_URL || '';
    }

    // Website/Portfolio
    if (lowerLabel.includes('website') || lowerLabel.includes('portfolio')) {
      return applicationData.website || process.env.WEBSITE || '';
    }

    // GitHub
    if (lowerLabel.includes('github')) {
      return applicationData.github || process.env.GITHUB || 'https://github.com/amartinez808';
    }

    // Years of experience
    if (lowerLabel.includes('years') && lowerLabel.includes('experience')) {
      return '8';
    }

    // Use GPT-4o for other questions
    if (label.includes('?') || lowerLabel.includes('why') || lowerLabel.includes('describe')) {
      return await this.generateAnswerWithAI(label, job, applicationData);
    }

    return '';
  }

  /**
   * Handle radio buttons (Yes/No, citizenship, work authorization, etc.)
   */
  async handleRadioButtons(applicationData) {
    try {
      const radioGroups = await this.page.$$('fieldset');

      for (const group of radioGroups) {
        const legend = await group.evaluate(el => {
          const legendElement = el.querySelector('legend');
          return legendElement ? legendElement.innerText.trim() : '';
        });

        const lowerLegend = legend.toLowerCase();

        // Work authorization / visa questions
        if (lowerLegend.includes('work authorization') ||
            lowerLegend.includes('visa') ||
            lowerLegend.includes('sponsorship')) {

          const needSponsorship = applicationData.needsSponsorship === true;
          await this.selectRadioButton(group, needSponsorship ? 'yes' : 'no');
          console.log(`   ✅ Selected: ${legend} = ${needSponsorship ? 'Yes' : 'No'}`);
        }

        // Citizenship
        if (lowerLegend.includes('citizen')) {
          const isCitizen = applicationData.isCitizen !== false;
          await this.selectRadioButton(group, isCitizen ? 'yes' : 'no');
          console.log(`   ✅ Selected: ${legend} = ${isCitizen ? 'Yes' : 'No'}`);
        }

        // Commute / relocation
        if (lowerLegend.includes('commute') || lowerLegend.includes('relocate')) {
          await this.selectRadioButton(group, 'yes');
          console.log(`   ✅ Selected: ${legend} = Yes`);
        }
      }
    } catch (error) {
      console.log('   ⚠️  Error handling radio buttons:', error.message);
    }
  }

  /**
   * Select a radio button by value
   */
  async selectRadioButton(group, value) {
    try {
      await group.evaluate((el, val) => {
        const inputs = el.querySelectorAll('input[type="radio"]');
        for (const input of inputs) {
          const label = input.nextElementSibling || input.closest('label');
          if (label && label.innerText.toLowerCase().includes(val)) {
            input.click();
            return;
          }
        }
      }, value);
    } catch (e) {
      // Skip if can't select
    }
  }

  /**
   * Handle dropdown/select elements
   */
  async handleDropdowns(applicationData) {
    try {
      const selects = await this.page.$$('select');

      for (const select of selects) {
        const label = await this.getInputLabel(select);
        const lowerLabel = label.toLowerCase();

        // Country
        if (lowerLabel.includes('country')) {
          await select.select('United States');
          console.log(`   ✅ Selected: ${label} = United States`);
        }

        // State
        if (lowerLabel.includes('state')) {
          await select.select('Rhode Island');
          console.log(`   ✅ Selected: ${label} = Rhode Island`);
        }
      }
    } catch (error) {
      console.log('   ⚠️  Error handling dropdowns:', error.message);
    }
  }

  /**
   * Generate answer to open-ended questions using GPT-4o
   */
  async generateAnswerWithAI(question, job, applicationData) {
    try {
      console.log(`   🤖 Generating AI answer for: "${question}"`);

      const resumeText = applicationData.resumeText || '';

      const prompt = `You are helping a candidate apply to a job. Answer this application question briefly and professionally.

Job: ${job.title} at ${job.company}
Question: ${question}

Candidate Resume Summary:
${resumeText.substring(0, 1000)}

Provide a concise, honest answer (2-3 sentences max). Be professional but authentic.`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are helping a candidate answer job application questions. Be brief, professional, and authentic.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 150
      });

      const answer = completion.choices[0].message.content.trim();
      console.log(`   ✅ AI Answer: ${answer.substring(0, 100)}...\n`);

      return answer;

    } catch (error) {
      console.log('   ⚠️  Could not generate AI answer:', error.message);
      return '';
    }
  }

  /**
   * Click the Next button to proceed to next step
   */
  async clickNextButton() {
    // LinkedIn uses Shadow DOM/Web Components that hide buttons from JavaScript
    // Try multiple approaches to click the Next button

    try {
      console.log('   🔍 Attempting to click Next button...');

      // Method 1: Try Puppeteer's piercing selectors (works with Shadow DOM)
      try {
        // Wait a bit for any animations
        await randomDelay(1000, 1500);

        // Try to find and click button containing "Next" text using Puppeteer's XPath
        const [nextButton] = await this.page.$x("//button[contains(., 'Next')]");
        if (nextButton) {
          await nextButton.click();
          console.log('   ✅ Clicked Next button (XPath method)\n');
          await randomDelay(1000, 2000);
          return true;
        }
      } catch (e) {
        console.log(`   ⚠️  XPath method failed: ${e.message}`);
      }

      // Method 2: Keyboard navigation - Tab and Enter
      console.log('   🔍 Trying keyboard navigation...');
      for (let i = 0; i < 12; i++) {
        await this.page.keyboard.press('Tab');
        await randomDelay(250, 400);

        const focused = await this.page.evaluate(() => {
          const el = document.activeElement;
          return {
            tagName: el?.tagName,
            text: el?.innerText?.trim() || '',
            ariaLabel: el?.getAttribute('aria-label') || '',
            className: el?.className || ''
          };
        });

        console.log(`   Tab ${i + 1}: ${focused.tagName} - "${focused.text}" (aria: ${focused.ariaLabel})`);

        const isNextButton = focused.text?.toLowerCase().includes('next') ||
                            focused.text?.toLowerCase().includes('continue') ||
                            focused.ariaLabel?.toLowerCase().includes('next');

        if (isNextButton && focused.tagName === 'BUTTON') {
          console.log(`   ✅ Found Next button, pressing Enter...`);
          await this.page.keyboard.press('Enter');
          await randomDelay(500, 1000);
          console.log('   ✅ Clicked Next button\n');
          return true;
        }
      }

      console.log('   ⚠️  Could not find Next button');
      return false;

    } catch (e) {
      console.log(`   ⚠️  Error clicking Next button: ${e.message}`);
      return false;
    }
  }

  /**
   * Submit the application
   */
  async submitApplication() {
    try {
      const submitSelectors = [
        'button[aria-label="Submit application"]',
        'button[aria-label*="Submit"]',
        'button:has-text("Submit application")',
        '.jobs-easy-apply-modal footer button[type="submit"]'
      ];

      for (const selector of submitSelectors) {
        try {
          const button = await this.page.$(selector);
          if (button) {
            const text = await button.evaluate(el => el.innerText.trim());
            if (text.toLowerCase().includes('submit')) {

              console.log('   🚀 Clicking Submit button...\n');
              await button.click();
              await randomDelay(3000, 5000);

              // Check for confirmation
              const confirmed = await this.checkSubmissionConfirmation();

              if (confirmed) {
                console.log('   ✅ Application submitted successfully!\n');
                return { success: true };
              }

              return { success: false, reason: 'Submit clicked but no confirmation' };
            }
          }
        } catch (e) {
          continue;
        }
      }

      return { success: false, reason: 'Could not find Submit button' };

    } catch (error) {
      return { success: false, reason: error.message };
    }
  }

  /**
   * Check if application was submitted successfully
   */
  async checkSubmissionConfirmation() {
    try {
      await this.page.waitForSelector('.jobs-easy-apply-modal', { hidden: true, timeout: 5000 });
      return true;
    } catch (e) {
      // Check for confirmation message
      const confirmationText = await this.page.evaluate(() => {
        return document.body.innerText;
      });

      return confirmationText.includes('Application sent') ||
             confirmationText.includes('successfully') ||
             confirmationText.includes('Your application was submitted');
    }
  }
}

module.exports = JobApplicationBot;
