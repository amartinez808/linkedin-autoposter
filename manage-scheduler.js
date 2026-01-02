#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const command = process.argv[2];
const logFile = path.join(__dirname, 'scheduler.log');

function getRunningPid() {
  try {
    const output = execSync('ps aux | grep "node index.js" | grep -v grep', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();
    if (output) {
      return output.split(/\s+/)[1];
    }
    return null;
  } catch {
    return null;
  }
}

function start() {
  const pid = getRunningPid();
  if (pid) {
    console.log(`✅ Scheduler is already running (PID: ${pid})`);
    return;
  }

  console.log('🚀 Starting scheduler...');
  try {
    execSync(`nohup node index.js > ${logFile} 2>&1 &`, {
      cwd: __dirname,
      stdio: 'inherit'
    });

    setTimeout(() => {
      const newPid = getRunningPid();
      if (newPid) {
        console.log(`✅ Scheduler started successfully (PID: ${newPid})`);
        console.log(`📝 Logs: tail -f ${logFile}`);
      } else {
        console.log('⚠️  Scheduler may not have started. Check logs:');
        console.log(`   tail -50 ${logFile}`);
      }
    }, 2000);
  } catch (error) {
    console.error('❌ Failed to start scheduler:', error.message);
  }
}

function stop() {
  const pid = getRunningPid();
  if (!pid) {
    console.log('ℹ️  Scheduler is not running');
    return;
  }

  console.log(`🛑 Stopping scheduler (PID: ${pid})...`);
  try {
    execSync(`kill ${pid}`);
    console.log('✅ Scheduler stopped');
  } catch (error) {
    console.error('❌ Failed to stop scheduler:', error.message);
  }
}

function restart() {
  stop();
  setTimeout(() => start(), 1000);
}

function status() {
  const pid = getRunningPid();
  if (pid) {
    console.log(`✅ Scheduler is running (PID: ${pid})`);
  } else {
    console.log('❌ Scheduler is not running');
  }

  if (fs.existsSync(logFile)) {
    console.log(`\n📝 Latest logs (last 20 lines):`);
    try {
      const lines = execSync(`tail -20 ${logFile}`, { encoding: 'utf-8' });
      console.log(lines);
    } catch (error) {
      console.error('Failed to read logs');
    }
  }
}

function logs(lines = 50) {
  if (!fs.existsSync(logFile)) {
    console.log('📝 No logs found yet');
    return;
  }

  try {
    const output = execSync(`tail -${lines} ${logFile}`, { encoding: 'utf-8' });
    console.log(output);
  } catch (error) {
    console.error('Failed to read logs');
  }
}

switch (command) {
  case 'start':
    start();
    break;
  case 'stop':
    stop();
    break;
  case 'restart':
    restart();
    break;
  case 'status':
    status();
    break;
  case 'logs':
    const lineCount = parseInt(process.argv[3]) || 50;
    logs(lineCount);
    break;
  default:
    console.log(`
Usage: node manage-scheduler.js <command>

Commands:
  start           Start the scheduler
  stop            Stop the scheduler
  restart         Restart the scheduler
  status          Show scheduler status and recent logs
  logs [lines]    Show log output (default: 50 lines)

Examples:
  node manage-scheduler.js start
  node manage-scheduler.js status
  node manage-scheduler.js logs 100
`);
}
