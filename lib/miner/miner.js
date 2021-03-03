const { dirname, basename } = require('path');
const EventEmitter = require('events');
const spawn = require('cross-spawn');
const { flatten } = require('lodash');
const eventBus = require('../services/event-bus');
const config = require('../services/config');
const store = require('../services/store');
const outputUtil = require('../output-util');
const coinUtil = require('../coin-util');

class Miner {
  constructor(binPath, configPath = null, outputToConsole = false) {
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
    this.progressRegex = /([0-9]+\.?[0-9]*) %/;
    this.scanSpeedRegex = /([0-9]+\.?[0-9]* [KMG]B\/s)/;
    this.remainingTimeRegex = /([0-9]+[s,m])/;
    this.timestampRegex = /(([0-9]+:[0-9]+:[0-9]+)(\.[0-9]+)?( \[(.+)\])?) +/;
    this.progressIndicator = ' % ';
    this.version = null;
    this.software = 'scavenger';
    this.emitter = new EventEmitter();
    this.outputToConsole = outputToConsole;
  }

  static getFormattedDeadline(deadline) {
    if (!config.humanizeDeadlines) {
      return deadline.toString();
    }

    return outputUtil.getFormattedDeadline(deadline);
  }

  modifyDeadline(data) {
    if (data.indexOf('deadline=') === -1) {
     return data;
    }

    const upstream = this.proxy.currentRoundManager.getCurrentRound() ? this.proxy.currentRoundManager.getCurrentRound().upstream : null;
    const coin = upstream && upstream.upstreamConfig.coin;

    return data.replace(this.deadlineRegex, (match, deadline) => {
      deadline = coinUtil.modifyDeadline(parseInt(deadline, 10), coin);

      return `deadline=${outputUtil.getString(Miner.getFormattedDeadline(deadline), outputUtil.getDeadlineColor(deadline, coin))}`;
    });
  }

  async start() {
    this.stopped = false;
    let args = [];
    if (this.configPath) {
      args = args.concat(['-c', this.configPath]);
    }
    eventBus.publish('log/debug', `${this.fullMinerName} | Starting with binary: ${this.bin}, args: ${args.join(' ')}, cwd: ${this.cwd}`);
    try {
      this.minerRef = spawn(this.bin, args, {
        cwd: this.cwd,
        stdio: 'pipe',
      });
    } catch (err) {
      eventBus.publish('log/error', `An error occurred while starting the miner binary ${this.binPath}, exiting ..`);
      process.exit(1);
    }
    this.minerRef.on('error', (err) => {
      if (err.message.indexOf('ENOENT') !== -1) {
        eventBus.publish('log/error', `Invalid miner binary path, could not start ${this.constructor.name}, exiting ..`);
        process.exit(1);
      }
      if (err.message.indexOf('EACCES') !== -1) {
        eventBus.publish('log/error', `The miner binary ${this.binPath} might not be marked as executable or you are missing the required rights to start it, exiting ..`);
        process.exit(1);
      }
    });
    this.minerRef.stdout.on('data', (data) => {
      data = data.toString();

      const lines = flatten(data.trim().split('\n').map(line => line.trim().split('\r')));

      lines.forEach(line => {
        let logLevel = 'info';
        line = line.replace(this.timestampRegex, (match, all, time, ms, levelFull, level) => {
          if (level) {
            logLevel = level.toLowerCase();
          }

          return '';
        });

        if (line.indexOf(this.progressIndicator) !== -1) {
          let matches = line.match(this.progressRegex);
          if (matches && matches.length > 1) {
            this.progress = parseFloat(matches[1]);
          }
          matches = line.match(this.scanSpeedRegex);
          this.scanSpeed = matches ? matches[1] : '0B/s';
          matches = line.match(this.remainingTimeRegex);
          this.remainingTime = matches ? matches[1] : null;
          if (this.proxy.currentRoundManager.getCurrentRound() && this.proxy.currentRoundManager.getCurrentRound().upstream) {
            this.proxy.currentRoundManager.getCurrentRound().upstream.roundProgress = this.progress;
            this.proxy.currentRoundManager.getCurrentRound().progress = this.progress;
          }
          if (store.useDashboard || this.outputToConsole || config.hideScanProgress) {
            return;
          }
          this.publish('log', logLevel, line, true, { isMinerLog: true });
          return;
        } else if (line.indexOf(this.roundFinishedString) !== -1) {
          this.progress = 100;
          this.scanSpeed = null;
          this.remainingTime = null;
          if (this.proxy.currentRoundManager.getCurrentRound() && this.proxy.currentRoundManager.getCurrentRound().upstream) {
            this.proxy.currentRoundManager.getCurrentRound().upstream.roundProgress = this.progress;
            this.proxy.currentRoundManager.getCurrentRound().progress = this.progress;
          }
          this.publish('round-finished', this.currentBlockScanning);
        }

        if (line.indexOf('account=') !== -1) {
          line = line.replace(this.accountRegex, (match, account) => {
            return `account=${outputUtil.getString(account, config.getAccountColor(account))}`;
          });
        }

        line = this.modifyDeadline(line);

        const newRoundMatches = line.match(this.newRoundRegex);
        if (newRoundMatches) {
          this.currentBlockScanning = parseInt(newRoundMatches[1], 10);
          if (this.proxy.currentRoundManager.getCurrentRound() && this.proxy.currentRoundManager.getCurrentRound().upstream) {
            line = `Starting scan of ${line} (${this.proxy.currentRoundManager.getCurrentRound().upstream.upstreamName})`;
          }
        }

        if (!this.outputToConsole) {
          this.publish('log', logLevel, line);
        }
      });

      if (this.outputToConsole) {
        process.stdout.write(data);
      }
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

      if (this.outputToConsole) {
        process.stderr.write(data);
        return;
      }

      const lines = flatten(data.trim().split('\n').map(line => line.trim().split('\r')));
      lines.forEach(line => {
        let logLevel = 'error';
        line = line.replace(this.timestampRegex, (match, all, time, ms, levelFull, level) => {
          if (level) {
            logLevel = level.toLowerCase();
          }
          return '';
        });
        line = this.modifyDeadline(line);
        this.publish('log', logLevel, line, { isMinerLog: true });
      });
    });
    this.minerRef.on('close', async () => {
      await new Promise(resolve => setTimeout(resolve, 2000));
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

  publish(topic, ...msg) {
    this.emitter.emit(topic, ...msg);
  }

  subscribe(topic, cb) {
    this.emitter.on(topic, cb);
  }

  get proxy() {
    return this._proxy;
  }

  set proxy(proxy) {
    this._proxy = proxy;
    this.color = proxy.minerColor;
    this.fullMinerName = proxy.showProxyIndex ? `${outputUtil.getString(`Miner #${proxy.proxyIndex}`, this.color)} | ${this.constructor.name}` : this.constructor.name;
  }

  get stats() {
    return {
      software: this.software,
      version: this.version,
      progress: this.progress,
      scanSpeed: this.scanSpeed,
      remainingTime: this.remainingTime,
      currentBlockScanning: this.currentBlockScanning,
      proxyIndex: this.proxy.proxyIndex,
      color: this.color,
    };
  }
}

module.exports = Miner;
