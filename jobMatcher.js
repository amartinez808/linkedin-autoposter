const OpenAI = require('openai');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

class JobMatcher {
  /**
   * Analyze a job posting and determine if it's a good match
   * @param {Object} job - Job object with title, company, description, etc.
   * @param {number} minMatchScore - Minimum score to consider (0-100, default 60)
   * @returns {Object} - { isMatch: boolean, score: number, reasoning: string }
   */
  async analyzeJobMatch(job, minMatchScore = 60) {
    console.log(`\n🤖 Analyzing job match: "${job.title}" at ${job.company}`);

    try {
      const prompt = `You are an expert career advisor helping someone find the right Software Engineer job. Analyze this job posting and determine if it's a good match.

**Job Details:**
Title: ${job.title}
Company: ${job.company}
Location: ${job.location}
Description: ${job.description || 'Not provided'}

**Candidate Profile:**
- Experience Level: ${process.env.EXPERIENCE_LEVEL || 'mid-senior'}
- Keywords Looking For: ${process.env.JOB_KEYWORDS || 'Software Engineer'}
- Preferred Location: ${process.env.JOB_LOCATION || 'Remote'}

**Evaluation Criteria:**
1. **Role Alignment** (0-30 points): Does the job title/role match what they're looking for?
2. **Skills Match** (0-25 points): Do the required skills align with a ${process.env.EXPERIENCE_LEVEL} developer?
3. **Location Fit** (0-15 points): Does location match preference?
4. **Company Quality** (0-15 points): Is this a reputable company worth applying to?
5. **Red Flags** (0-15 points): Any warning signs? (unrealistic expectations, poor job description, MLM/scam vibes, etc.)

**Response Format (JSON only):**
{
  "matchScore": <0-100>,
  "isGoodMatch": <true/false based on ${minMatchScore}+ score>,
  "reasoning": "<2-3 sentence explanation>",
  "breakdown": {
    "roleAlignment": <0-30>,
    "skillsMatch": <0-25>,
    "locationFit": <0-15>,
    "companyQuality": <0-15>,
    "redFlags": <0-15 (subtract points for red flags)>
  },
  "recommendation": "<apply/skip/maybe>"
}`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert career advisor analyzing job postings. Return valid JSON only with your analysis.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 800
      });

      const response = completion.choices[0].message.content.trim();

      // Parse JSON from response
      let jsonStr = response;
      if (response.includes('```json')) {
        jsonStr = response.split('```json')[1].split('```')[0].trim();
      } else if (response.includes('```')) {
        jsonStr = response.split('```')[1].split('```')[0].trim();
      }

      const analysis = JSON.parse(jsonStr);

      console.log(`   Match Score: ${analysis.matchScore}/100`);
      console.log(`   Recommendation: ${analysis.recommendation.toUpperCase()}`);
      console.log(`   Reasoning: ${analysis.reasoning}\n`);

      return {
        isMatch: analysis.matchScore >= minMatchScore,
        score: analysis.matchScore,
        reasoning: analysis.reasoning,
        recommendation: analysis.recommendation,
        breakdown: analysis.breakdown
      };

    } catch (error) {
      console.error('   Error analyzing job:', error.message);
      // Default to applying if AI analysis fails (to avoid missing opportunities)
      return {
        isMatch: true,
        score: 50,
        reasoning: 'AI analysis failed - defaulting to apply',
        recommendation: 'maybe',
        breakdown: null
      };
    }
  }

  /**
   * Filter a list of jobs by match score
   * @param {Array} jobs - Array of job objects
   * @param {number} minMatchScore - Minimum score to keep (0-100)
   * @returns {Array} - Filtered jobs with match analysis attached
   */
  async filterJobs(jobs, minMatchScore = 60) {
    console.log(`\n🎯 AI Filtering ${jobs.length} jobs (min score: ${minMatchScore})...\n`);

    const analyzedJobs = [];

    for (const job of jobs) {
      const analysis = await this.analyzeJobMatch(job, minMatchScore);

      // Attach analysis to job object
      job.matchAnalysis = analysis;

      if (analysis.isMatch) {
        analyzedJobs.push(job);
      } else {
        console.log(`   ❌ Filtered out: "${job.title}" (score: ${analysis.score})\n`);
      }

      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 1000));
    }

    console.log(`\n✅ ${analyzedJobs.length}/${jobs.length} jobs passed AI filtering\n`);

    // Sort by match score (highest first)
    return analyzedJobs.sort((a, b) =>
      (b.matchAnalysis?.score || 0) - (a.matchAnalysis?.score || 0)
    );
  }
}

module.exports = JobMatcher;
