const { dirname, basename } = require('path');
const spawn = require('cross-spawn');
const moment = require('moment');
const eventBus = require('./services/event-bus');
const config = require('./services/config');

class Miner {
  constructor(binPath, configPath = null) {
    this.binPath = binPath;
    this.bin = `./${basename(this.binPath)}`;
    this.cwd = dirname(this.binPath);
    this.configPath = configPath;
    this.stopped = true;
    this.currentBlockScanning = null;
    this.roundFinishedString = 'round finished';
    this.newRoundRegex = /new block: height=([0-9]+)/;
    this.versionRegex = /v\.([0-9]+\.[0-9]+\.[0-9]+)/;
    this.deadlineRegex = /deadline=([0-9]+)/;
    this.version = null;
  }

  static getFormattedDeadline(deadline) {
    if (!config.humanizeDeadlines) {
      return deadline;
    }

    const duration = moment.duration(deadline, 'seconds');
    if (duration.years() > 0) {
      return `${duration.years()}y ${duration.months()}m ${duration.days()}d ${duration.hours().toString().padStart(2, '0')}:${duration.minutes().toString().padStart(2, '0')}:${duration.seconds().toString().padStart(2, '0')}`;
    } else if (duration.months() > 0) {
      return `${duration.months()}m ${duration.days()}d ${duration.hours().toString().padStart(2, '0')}:${duration.minutes().toString().padStart(2, '0')}:${duration.seconds().toString().padStart(2, '0')}`;
    } else if (duration.days() > 0) {
      return `${duration.days()}d ${duration.hours().toString().padStart(2, '0')}:${duration.minutes().toString().padStart(2, '0')}:${duration.seconds().toString().padStart(2, '0')}`;
    }

    return `${duration.hours().toString().padStart(2, '0')}:${duration.minutes().toString().padStart(2, '0')}:${duration.seconds().toString().padStart(2, '0')}`;
  }

  async start() {
    this.stopped = false;
    let args = [];
    if (this.configPath) {
      args = args.concat(['-c', this.configPath]);
    }
    eventBus.publish('log/debug', `${this.constructor.name} | Starting with binary: ${this.bin}, args: ${args.join(' ')}, cwd: ${this.cwd}`);
    this.minerRef = spawn(this.bin, args, {
      cwd: this.cwd,
      stdio: 'pipe',
    });
    this.minerRef.stdout.on('data', (data) => {
      data = data.toString();
      if (data.indexOf('deadline') !== -1) {
        data = data.replace(this.deadlineRegex, (match, deadline) => `deadline=${Miner.getFormattedDeadline(parseInt(deadline, 10))}`);
      }
      process.stdout.write(data);
      const text = data.trim();
      if (text.indexOf(this.roundFinishedString) !== -1) {
        eventBus.publish('miner/round-finished', this.currentBlockScanning);
      }
      const matches = text.match(this.newRoundRegex);
      if (matches) {
        this.currentBlockScanning = parseInt(matches[1], 10);
      }
    });
    this.minerRef.stdout.once('data', (data) => {
      const text = data.toString().trim();
      const matches = text.match(this.versionRegex);
      if (matches) {
        this.version = matches[1];
      }
    });
    this.minerRef.stderr.on('data', (data) => process.stderr.write(data));
    this.minerRef.on('close', async () => {
      await new Promise(resolve => setTimeout(resolve, 500));
      if (this.stopped) {
        return;
      }
      this.start();
    });
  }

  async stop() {
    this.stopped = true;
    if (!this.minerRef) {
      return;
    }
    this.minerRef.kill();
    this.minerRef = null;
  }
}

module.exports = Miner;
