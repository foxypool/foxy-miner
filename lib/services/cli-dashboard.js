const chalk = require('chalk');
const logUpdate = require('log-update');
const moment = require('moment');
const Table = require('cli-table3');
const eventBus = require('./event-bus');
const store = require('./store');
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
    if (!bestDL) {
      return 'N/A';
    }

    return outputUtil.getFormattedDeadline(bestDL);
  };

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
  }

  buildTable() {
    const table = new Table({
      head: ['Proxy', 'Upstream', 'Block #', 'NetDiff', 'Elapsed', 'Best DL', 'Capacity', 'Progress'],
      style: {
        head: ['cyan'],
      },
    });
    this.proxies.map(proxy => {
      const minerStats = proxy.miner.stats;
      return proxy.upstreams.map(upstream => {
        const minerProcessesThisChain = minerStats.currentBlockScanning === upstream.getMiningInfo().height && minerStats.progress !== 100;
        let roundProgressText = 'Interrupted';
        if (minerProcessesThisChain) {
          roundProgressText = `Scanning with ${minerStats.scanSpeed}, ${minerStats.remainingTime}`;
        } else if (upstream.roundProgress === 0) {
          roundProgressText = 'Waiting';
        } else if (upstream.roundProgress === 100) {
          roundProgressText = 'Done';
        }
        roundProgressText += ` (${upstream.roundProgress} %)`;
        table.push([
          `Miner #${proxy.proxyIndex}`,
          outputUtil.getName(upstream.upstreamConfig),
          upstream.getMiningInfo().height,
          upstream.miningInfo.netDiff ? `${Capacity.fromTiB(upstream.miningInfo.netDiff).toString(2)}` : 'N/A',
          Dashboard.getTimeElapsedSinceLastBlock(upstream.roundStart),
          Dashboard.getBestDeadlineString(upstream.bestDL),
          upstream.lastCapacity ? Capacity.fromGiB(upstream.lastCapacity).toString() : 'N/A',
          roundProgressText,
        ]);
      });
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
  }
}

module.exports = new Dashboard();
