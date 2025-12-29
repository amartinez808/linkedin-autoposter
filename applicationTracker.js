const fs = require('fs').promises;
const path = require('path');

class ApplicationTracker {
  constructor() {
    this.applications = [];
    this.trackerPath = path.join(__dirname, 'jobs', 'applications.json');
  }

  /**
   * Load application history from file
   */
  async load() {
    try {
      const data = await fs.readFile(this.trackerPath, 'utf-8');
      this.applications = JSON.parse(data);
      console.log(`📂 Loaded ${this.applications.length} applications from tracker`);
    } catch (error) {
      console.log('ℹ️  No existing application tracker found, starting fresh');
      this.applications = [];
    }
  }

  /**
   * Save application history to file
   */
  async save() {
    const jobsDir = path.join(__dirname, 'jobs');
    await fs.mkdir(jobsDir, { recursive: true });
    await fs.writeFile(this.trackerPath, JSON.stringify(this.applications, null, 2));
  }

  /**
   * Check if already applied to this job
   */
  hasApplied(jobId) {
    return this.applications.some(app => app.jobId === jobId);
  }

  /**
   * Add a new application to the tracker
   */
  async addApplication(job, result) {
    const application = {
      jobId: job.id,
      jobTitle: job.title,
      company: job.company,
      location: job.location,
      jobUrl: job.url,
      appliedAt: new Date().toISOString(),
      success: result.success,
      reason: result.reason || '',
      matchScore: job.matchScore || null,
      matchReason: job.matchReason || ''
    };

    this.applications.push(application);
    await this.save();

    console.log(`✅ Tracked application: ${job.title} at ${job.company}`);
  }

  /**
   * Get statistics about applications
   */
  getStats() {
    const total = this.applications.length;
    const successful = this.applications.filter(app => app.success).length;
    const failed = total - successful;

    const byCompany = {};
    this.applications.forEach(app => {
      byCompany[app.company] = (byCompany[app.company] || 0) + 1;
    });

    const avgScore = this.applications
      .filter(app => app.matchScore !== null)
      .reduce((sum, app) => sum + app.matchScore, 0) /
      this.applications.filter(app => app.matchScore !== null).length || 0;

    return {
      total,
      successful,
      failed,
      averageMatchScore: Math.round(avgScore),
      byCompany,
      recentApplications: this.applications.slice(-10).reverse()
    };
  }

  /**
   * Print application statistics
   */
  printStats() {
    const stats = this.getStats();

    console.log('\n' + '='.repeat(60));
    console.log('📊 APPLICATION STATISTICS');
    console.log('='.repeat(60));
    console.log(`Total Applications: ${stats.total}`);
    console.log(`✅ Successful: ${stats.successful}`);
    console.log(`❌ Failed: ${stats.failed}`);
    console.log(`📈 Average Match Score: ${stats.averageMatchScore}/100`);
    console.log('\nTop Companies Applied To:');

    const topCompanies = Object.entries(stats.byCompany)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    topCompanies.forEach(([company, count]) => {
      console.log(`   ${company}: ${count} application(s)`);
    });

    console.log('\nRecent Applications:');
    stats.recentApplications.slice(0, 5).forEach(app => {
      const status = app.success ? '✅' : '❌';
      const date = new Date(app.appliedAt).toLocaleDateString();
      console.log(`   ${status} ${app.jobTitle} at ${app.company} (${date})`);
    });

    console.log('='.repeat(60) + '\n');
  }

  /**
   * Export applications to CSV
   */
  async exportToCSV(filename = 'applications.csv') {
    const csvPath = path.join(__dirname, 'jobs', filename);

    const headers = [
      'Job ID',
      'Job Title',
      'Company',
      'Location',
      'Job URL',
      'Applied At',
      'Success',
      'Match Score',
      'Match Reason',
      'Error Reason'
    ].join(',');

    const rows = this.applications.map(app => {
      return [
        app.jobId,
        `"${app.jobTitle}"`,
        `"${app.company}"`,
        `"${app.location}"`,
        app.jobUrl,
        app.appliedAt,
        app.success,
        app.matchScore || '',
        `"${app.matchReason}"`,
        `"${app.reason}"`
      ].join(',');
    });

    const csv = [headers, ...rows].join('\n');

    await fs.writeFile(csvPath, csv);
    console.log(`💾 Exported applications to ${filename}`);
  }

  /**
   * Get jobs that need follow-up (applied > 7 days ago, no response)
   */
  getJobsNeedingFollowUp() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return this.applications.filter(app => {
      const appliedDate = new Date(app.appliedAt);
      return app.success && appliedDate < sevenDaysAgo;
    });
  }
}

module.exports = ApplicationTracker;
