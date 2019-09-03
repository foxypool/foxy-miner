const chalk = require('chalk');
const logUpdate = require('log-update');
const moment = require('moment');
const Table = require('cli-table3');
const { flatten } = require('lodash');
const eventBus = require('./event-bus');
const store = require('./store');
const config = require('./config');
const version = require('../version');
const Capacity = require('../capacity');
const outputUtil = require('../output-util');

class Dashboard {
  static getLogLevelNumber(logLevel) {
    switch (logLevel) {
      case 'debug': return 1;
      case 'info': return 2;
      case 'error': return 3;
    }
  }

  static getTimeElapsedSinceLastBlock(blockStart) {
    const duration = moment.duration(moment().diff(moment(blockStart)));

    return `${duration.hours().toString().padStart(2, '0')}:${duration.minutes().toString().padStart(2, '0')}:${duration.seconds().toString().padStart(2, '0')}`;
  }

  static getBestDeadlineString(bestDL) {
    if (bestDL === null) {
      return 'N/A';
    }

    return outputUtil.getFormattedDeadline(bestDL);
  };

  static getDeadlineColor(deadline, limit = 2419200) {
    if (deadline === null) {
      return null;
    }
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

  constructor() {
    this.maxLogLines = 16;
    this.lastLogLines= [];
  }

  init() {
    eventBus.subscribe('log/info', (msg) => this.onLogs('info', msg));
    eventBus.subscribe('log/debug', (msg) => this.onLogs('debug', msg));
    eventBus.subscribe('log/error', (msg) => this.onLogs('error', msg));
  }

  onLogs(logLevel, msg) {
    const logLine = `${moment().format('YYYY-MM-DD HH:mm:ss.SSS')} [${logLevel.toUpperCase()}]  ${msg}`;
    if (Dashboard.getLogLevelNumber(store.logLevel) > Dashboard.getLogLevelNumber(logLevel)) {
      return;
    }
    switch (logLevel) {
      case 'debug':
        this.lastLogLines.push(store.getUseColors() ? chalk.grey(logLine) : logLine);
        break;
      case 'info':
        this.lastLogLines.push(logLine);
        break;
      case 'error':
        this.lastLogLines.push(store.getUseColors() ? chalk.red(logLine) : logLine);
        break;
    }
    if (this.lastLogLines.length > this.maxLogLines) {
      this.lastLogLines = this.lastLogLines.slice(this.maxLogLines * -1);
    }
    this.render();
  }

  buildTable() {
    const table = new Table({
      head: ['Upstream', 'Block #', 'NetDiff', 'Elapsed', 'Best DL', 'Capacity', 'Progress'],
      style: {
        head: ['cyan'],
      },
    });
    if (!this.proxies || this.proxies.some(proxy => !proxy.upstreams)) {
      return table.toString();
    }
    const upstreams = flatten(this.proxies.map(proxy => proxy.upstreams.map(upstream => upstream.stats))).reduce((acc, curr) => {
      let upstream = acc.find(data => data.name === curr.name);
      if (!upstream) {
        acc.push(curr);
        return acc;
      }
      if (!upstream.bestDL || upstream.bestDL > curr.bestDL) {
        upstream.bestDL = curr.bestDL;
      }
      upstream.roundProgress += curr.roundProgress;
      upstream.lastCapacity += curr.lastCapacity;
      upstream.counter += 1;
      return acc;
    }, []);
    upstreams.forEach(upstream => upstream.roundProgress /= upstream.counter);
    this.proxies.forEach(proxy => {
      const minerStats = proxy.miner.stats;
      const upstream = upstreams.find(upstream => upstream.miningInfo.height === minerStats.currentBlockScanning && minerStats.progress !== 100);
      if (!upstream) {
        return;
      }

      upstream.miners.push(minerStats);
    });
    upstreams.forEach(upstream => {
      const roundProgressRounding = upstream.roundProgress === 100 ? 0 : 2;
      let roundProgressText = 'Interrupted';
      if (upstream.miners.length === 0) {
        if (upstream.roundProgress === 0) {
          roundProgressText = 'Waiting';
        } else if (upstream.roundProgress === 100) {
          roundProgressText = 'Done';
        }
        roundProgressText += ` (${upstream.roundProgress.toFixed(roundProgressRounding)} %)`;
      } else {
        roundProgressText = this.isSingleMiner ? '' : `${upstream.roundProgress.toFixed(roundProgressRounding)} %\n`;
        roundProgressText += upstream.miners.map(minerStats => {
          const minerNameString = this.isSingleMiner ? '' : `${outputUtil.getString(`Miner #${minerStats.proxyIndex}`, minerStats.color)} | `;

          return `${minerNameString}Scanning with ${minerStats.scanSpeed}, ${minerStats.remainingTime} (${minerStats.progress} %)`;
        }).join('\n');
      }

      upstream.roundProgressText = roundProgressText;

      table.push([
        outputUtil.getName(upstream),
        upstream.miningInfo.height,
        upstream.miningInfo.netDiff ? `${Capacity.fromTiB(upstream.miningInfo.netDiff).toString(2)}` : 'N/A',
        Dashboard.getTimeElapsedSinceLastBlock(upstream.roundStart),
        outputUtil.getString(Dashboard.getBestDeadlineString(upstream.bestDL), Dashboard.getDeadlineColor(upstream.bestDL)),
        upstream.lastCapacity ? Capacity.fromGiB(upstream.lastCapacity).toString() : 'N/A',
        roundProgressText,
      ]);
    });

    return table.toString();
  }

  buildLogs() {
    return this.lastLogLines.join('\n');
  }

  render() {
    logUpdate([
      chalk.bold.blueBright(`Foxy-Miner ${version}`),
      this.buildTable(),
      '',
      'Last log lines:',
      this.buildLogs(),
    ].join('\n'));
  }

  start() {
    this.maxLogLines = config.dashboardLogLines;
    this.render();
    this.timer = setInterval(this.render.bind(this), 1000);
  }

  stop() {
    clearInterval(this.timer);
  }

  get proxies() {
    return this._proxies;
  }

  set proxies(proxies) {
    this._proxies = proxies;
    this.isSingleMiner = proxies.length === 1;
  }
}

module.exports = new Dashboard();
