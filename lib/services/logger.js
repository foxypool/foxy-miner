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
    eventBus.subscribe('log/info', (msg, resetCursor = false) => Logger.onLogs('info', msg, resetCursor));
    eventBus.subscribe('log/debug', (msg, resetCursor = false) => Logger.onLogs('debug', msg, resetCursor));
    eventBus.subscribe('log/error', (msg, resetCursor = false) => Logger.onLogs('error', msg, resetCursor));
  }

  static onLogs(logLevel, msg, resetCursor) {
    let logLine = `\r${moment().format('YYYY-MM-DD HH:mm:ss.SSS')} [${logLevel.toUpperCase()}]  ${msg}`;
    if (!resetCursor) {
      logLine = logLine.padEnd(127, ' ');
    }
    if (Logger.getLogLevelNumber(store.logLevel) > Logger.getLogLevelNumber(logLevel)) {
      return;
    }
    switch (logLevel) {
      case 'debug':
        if (resetCursor) {
          process.stdout.write(store.getUseColors() ? chalk.grey(logLine) : logLine);
        } else {
          console.log(store.getUseColors() ? chalk.grey(logLine) : logLine);
        }
        break;
      case 'info':
        if (resetCursor) {
          process.stdout.write(logLine);
        } else {
          console.log(logLine);
        }
        break;
      case 'error':
        if (resetCursor) {
          process.stderr.write(store.getUseColors() ? chalk.red(logLine) : logLine);
        } else {
          console.error(store.getUseColors() ? chalk.red(logLine) : logLine);
        }
        break;
    }
  }
}

module.exports = new Logger();
