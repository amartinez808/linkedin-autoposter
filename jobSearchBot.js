const puppeteer = require('puppeteer');
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

class JobSearchBot {
  constructor(linkedInBot) {
    this.bot = linkedInBot;
    this.page = linkedInBot.page;
    this.foundJobs = [];
  }

  /**
   * Search for jobs on LinkedIn
   * @param {Object} criteria - Search criteria
   * @param {string} criteria.keywords - Job title/keywords (e.g., "Software Engineer")
   * @param {string} criteria.location - Location (e.g., "Remote", "Providence, RI")
   * @param {string} criteria.experienceLevel - Experience level filter (entry, associate, mid-senior, director, executive)
   * @param {boolean} criteria.easyApplyOnly - Filter for Easy Apply jobs only
   * @param {number} criteria.maxResults - Maximum number of jobs to find (default: 25)
   */
  async searchJobs(criteria = {}) {
    const {
      keywords = 'Software Engineer',
      location = 'Remote',
      experienceLevel = 'mid-senior',
      easyApplyOnly = true,
      maxResults = 25
    } = criteria;

    console.log('\n🔍 Searching for jobs on LinkedIn...');
    console.log(`   Keywords: ${keywords}`);
    console.log(`   Location: ${location}`);
    console.log(`   Experience: ${experienceLevel}`);
    console.log(`   Easy Apply Only: ${easyApplyOnly}`);
    console.log(`   Max Results: ${maxResults}\n`);

    try {
      // Build search URL
      const searchParams = new URLSearchParams({
        keywords: keywords,
        location: location,
        f_AL: easyApplyOnly ? 'true' : '', // Easy Apply filter
        f_E: this.getExperienceLevelCode(experienceLevel),
        sortBy: 'DD' // Sort by date posted (most recent)
      });

      const searchUrl = `https://www.linkedin.com/jobs/search/?${searchParams.toString()}`;

      console.log(`📍 Navigating to: ${searchUrl}\n`);

      // Navigate and wait for jobs list to load (instead of waiting for full page)
      try {
        await this.page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      } catch (navError) {
        console.log('⚠️  Navigation timeout, checking if page loaded anyway...');
      }

      await randomDelay(3000, 5000);

      // Wait for jobs list to appear
      try {
        await this.page.waitForSelector('.jobs-search-results-list, .jobs-search__results-list', { timeout: 30000 });
        console.log('✅ Jobs list loaded\n');
      } catch (e) {
        console.log('⚠️  Could not find jobs list, trying to extract anyway...\n');

        // Take screenshot for debugging
        await this.page.screenshot({
          path: path.join(__dirname, 'screenshots', `jobs-page-${Date.now()}.png`)
        });
      }

      // Scroll to load jobs
      await this.scrollJobsList();

      // Extract job listings
      const jobs = await this.extractJobListings(maxResults);

      console.log(`\n✅ Found ${jobs.length} jobs matching criteria\n`);
      this.foundJobs = jobs;

      return jobs;

    } catch (error) {
      console.error('❌ Error searching for jobs:', error.message);
      await this.page.screenshot({
        path: path.join(__dirname, 'screenshots', `job-search-error-${Date.now()}.png`)
      });
      throw error;
    }
  }

  /**
   * Scroll the jobs list to load more results
   */
  async scrollJobsList() {
    console.log('📜 Scrolling to load job listings...');

    const jobsListSelector = '.jobs-search-results-list';

    try {
      await this.page.waitForSelector(jobsListSelector, { timeout: 10000 });

      // Scroll 3-5 times to load more jobs
      const scrollCount = Math.floor(Math.random() * 3) + 3;

      for (let i = 0; i < scrollCount; i++) {
        await this.page.evaluate((selector) => {
          const element = document.querySelector(selector);
          if (element) {
            element.scrollTop = element.scrollHeight;
          }
        }, jobsListSelector);

        await randomDelay(1000, 2000);
      }

      console.log('✅ Finished scrolling\n');
    } catch (error) {
      console.log('⚠️  Could not scroll jobs list:', error.message);
    }
  }

  /**
   * Extract job listings from the search results page
   */
  async extractJobListings(maxResults) {
    console.log('📋 Extracting job listings...\n');

    try {
      const jobs = await this.page.evaluate((max) => {
        // Use the selectors we know work from debug
        let jobCards = document.querySelectorAll('div[data-job-id]');

        if (jobCards.length === 0) {
          jobCards = document.querySelectorAll('div.job-card-container');
        }

        const extracted = [];

        for (let i = 0; i < Math.min(jobCards.length, max); i++) {
          const card = jobCards[i];

          try {
            // Extract job ID first
            const jobId = card.getAttribute('data-job-id');

            // Find title and company
            const titleLink = card.querySelector('a[href*="/jobs/view/"], a.job-card-list__title');
            const title = titleLink ? titleLink.innerText.trim() : '';
            const jobUrl = titleLink ? titleLink.getAttribute('href') : '';

            // Company name is usually in a span or div with specific class
            const companyElement = card.querySelector('[class*="company-name"], h4');
            const company = companyElement ? companyElement.innerText.trim() : '';

            // Location
            const locationElement = card.querySelector('[class*="metadata"] li, [class*="location"]');
            const location = locationElement ? locationElement.innerText.trim() : '';

            // Easy Apply badge
            const easyApplyText = card.innerText || '';
            const isEasyApply = easyApplyText.includes('Easy Apply');

            if (title && jobId) {
              extracted.push({
                id: jobId,
                title: title,
                company: company || 'Unknown',
                location: location || 'Not specified',
                url: jobUrl && jobUrl.startsWith('http') ? jobUrl : `https://www.linkedin.com${jobUrl || '/jobs/view/' + jobId}`,
                isEasyApply: isEasyApply,
                foundAt: new Date().toISOString()
              });
            }
          } catch (e) {
            // Skip this job card if extraction fails
            continue;
          }
        }

        return extracted;
      }, maxResults);

      console.log(`   Extracted ${jobs.length} jobs\n`);
      return jobs;

    } catch (error) {
      console.error('❌ Error in page.evaluate:', error.message);
      return [];
    }
  }

  /**
   * Analyze job description with GPT-4o to determine if it's a good match
   */
  async analyzeJobMatch(job, resumeText) {
    console.log(`🤖 Analyzing job match: ${job.title} at ${job.company}`);

    try {
      // Navigate to job details page
      try {
        await this.page.goto(job.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      } catch (navError) {
        console.log('⚠️  Navigation timeout, checking if page loaded...');
      }

      await randomDelay(2000, 4000);

      // Wait for job description to load
      try {
        await this.page.waitForSelector('.jobs-description__content, .jobs-description', { timeout: 15000 });
      } catch (e) {
        console.log('⚠️  Job description not found, trying to extract anyway...');
      }

      // Extract job description
      const jobDescription = await this.page.evaluate(() => {
        const descElement = document.querySelector('.jobs-description__content, .jobs-description, .description__text');
        return descElement ? descElement.innerText : '';
      });

      if (!jobDescription) {
        console.log('⚠️  Could not extract job description, skipping analysis\n');
        return { match: true, reason: 'Could not analyze - assuming match', score: 50 };
      }

      // Use GPT-4o to analyze match
      const prompt = `You are a job matching assistant. Analyze if this job is a good match for the candidate.

Job Title: ${job.title}
Company: ${job.company}
Location: ${job.location}

Job Description:
${jobDescription.substring(0, 3000)}

Candidate Resume:
${resumeText}

Based on the job description and candidate's resume, determine:
1. Is this a good match? (yes/no)
2. Match score (0-100)
3. Brief reason (1-2 sentences)

Respond in JSON format:
{
  "match": true/false,
  "score": 0-100,
  "reason": "brief explanation"
}`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a job matching assistant. Analyze job descriptions and determine if they match the candidate\'s qualifications. Respond only with valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 300
      });

      const analysis = JSON.parse(completion.choices[0].message.content.trim());

      console.log(`   Match: ${analysis.match ? '✅ YES' : '❌ NO'}`);
      console.log(`   Score: ${analysis.score}/100`);
      console.log(`   Reason: ${analysis.reason}\n`);

      return analysis;

    } catch (error) {
      console.error('⚠️  Error analyzing job:', error.message);
      return { match: true, reason: 'Analysis failed - assuming match', score: 50 };
    }
  }

  /**
   * Filter jobs using GPT-4o analysis
   */
  async filterJobsWithAI(jobs, resumeText, minScore = 60) {
    console.log(`\n🧠 Filtering ${jobs.length} jobs with AI analysis (min score: ${minScore})...\n`);

    const filteredJobs = [];

    for (const job of jobs) {
      const analysis = await this.analyzeJobMatch(job, resumeText);

      if (analysis.match && analysis.score >= minScore) {
        filteredJobs.push({
          ...job,
          matchScore: analysis.score,
          matchReason: analysis.reason
        });
      }

      // Small delay between analyses to avoid rate limits
      await randomDelay(2000, 4000);
    }

    console.log(`\n✅ ${filteredJobs.length} jobs passed AI filtering\n`);
    return filteredJobs;
  }

  /**
   * Get experience level code for LinkedIn URL
   */
  getExperienceLevelCode(level) {
    const codes = {
      'entry': '1',
      'associate': '2',
      'mid-senior': '3',
      'director': '4',
      'executive': '5'
    };
    return codes[level] || '3';
  }

  /**
   * Save jobs to file
   */
  async saveJobs(jobs, filename = 'found-jobs.json') {
    const jobsDir = path.join(__dirname, 'jobs');
    await fs.mkdir(jobsDir, { recursive: true });

    const filepath = path.join(jobsDir, filename);
    await fs.writeFile(filepath, JSON.stringify(jobs, null, 2));

    console.log(`💾 Saved ${jobs.length} jobs to ${filename}`);
  }

  /**
   * Load jobs from file
   */
  async loadJobs(filename = 'found-jobs.json') {
    try {
      const filepath = path.join(__dirname, 'jobs', filename);
      const data = await fs.readFile(filepath, 'utf-8');
      const jobs = JSON.parse(data);
      console.log(`📂 Loaded ${jobs.length} jobs from ${filename}`);
      return jobs;
    } catch (error) {
      console.log('ℹ️  No existing jobs file found');
      return [];
    }
  }
}

module.exports = JobSearchBot;
