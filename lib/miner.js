const { dirname, basename } = require('path');
const spawn = require('cross-spawn');
const moment = require('moment');
const eventBus = require('./services/event-bus');
const config = require('./services/config');
const outputUtil = require('./output-util');

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
    this.accountRegex = /account=([0-9]+)/;
    this.nonceRegex = /, nonce=([0-9]+)/;
    this.version = null;
  }

  static getFormattedDeadline(deadline) {
    if (!config.humanizeDeadlines) {
      return deadline.toString();
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

  static getDeadlineColor(deadline, limit = 2419200) {
    if (deadline <= 600) {
      return '#00ffbb';
    }

    const percent = Math.min(Math.max((1 - (deadline / limit)), 0), 1);
    if (percent < 0.5) {
      return null;
    }
    const red = Math.max(Math.min(Math.floor(255 - ((percent * 2) - 1) * 255), 255), 0);
    const green = Math.max(Math.min(Math.floor(percent * 2 * 255), 255), 0);

    return `#${red.toString(16).padStart(2, '0')}${green.toString(16).padStart(2, '0')}00`;
  }

  modifyDeadline(data) {
    if (data.indexOf('deadline=') === -1) {
     return data;
    }

    return data.replace(this.deadlineRegex, (match, deadline) => {
      deadline = parseInt(deadline, 10);

      return `${config.compact ? '' : 'deadline='}${outputUtil.getString(Miner.getFormattedDeadline(deadline), Miner.getDeadlineColor(deadline))}${(config.compact && data.length < 95) ? ' '.repeat(100 - data.length) : ''}`;
    });
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

      if (data.indexOf('account=') !== -1) {
        data = data.replace(this.accountRegex, (match, account) => {
          return `account=${outputUtil.getString(account, config.getAccountColor(account))}`;
        });
      }

      if (config.compact && data.indexOf('nonce=') !== -1) {
        data = data.replace(this.nonceRegex, '');
      }

      data = this.modifyDeadline(data);

      const newRoundMatches = data.match(this.newRoundRegex);
      if (newRoundMatches) {
        this.currentBlockScanning = parseInt(newRoundMatches[1], 10);
      }

      if (data.indexOf(this.roundFinishedString) !== -1) {
        eventBus.publish('miner/round-finished', this.currentBlockScanning);
      }

      process.stdout.write(data);
    });
    this.minerRef.stdout.once('data', (data) => {
      const text = data.toString().trim();
      const matches = text.match(this.versionRegex);
      if (matches) {
        this.version = matches[1];
      }
    });
    this.minerRef.stderr.on('data', (data) => {
      data = data.toString();

      data = this.modifyDeadline(data);

      process.stderr.write(data);
    });
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
