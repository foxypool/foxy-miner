const chalk = require('chalk');
const moment = require('moment');
const eventBus = require('./event-bus');
const store = require('./store');

class Logger {
  static getLogLevelNumber(logLevel) {
    switch (logLevel) {
      case 'debug': return 1;
      case 'info': return 2;
      case 'error': return 3;
    }
  }

  constructor() {
    eventBus.subscribe('log/info', (msg) => Logger.onLogs('info', msg));
    eventBus.subscribe('log/debug', (msg) => Logger.onLogs('debug', msg));
    eventBus.subscribe('log/error', (msg) => Logger.onLogs('error', msg));
  }

  static onLogs(logLevel, msg) {
    const format = store.compact ? 'HH:mm:ss' : 'YYYY-MM-DD HH:mm:ss.SSS';
    let logLine = `\r${moment().format(format)} [${logLevel.toUpperCase()}]  ${msg}`;
    if (store.compact) {
      logLine += ' '.repeat(16);
    }
    if (Logger.getLogLevelNumber(store.logLevel) > Logger.getLogLevelNumber(logLevel)) {
      return;
    }
    switch (logLevel) {
      case 'debug':
        console.log(store.getUseColors() ? chalk.grey(logLine) : logLine);
        break;
      case 'info':
        console.log(logLine);
        break;
      case 'error':
        console.error(store.getUseColors() ? chalk.red(logLine) : logLine);
        break;
    }
  }
}

module.exports = new Logger();
