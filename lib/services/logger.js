const chalk = require('chalk');
const moment = require('moment');
const { homedir } = require('os');
const { join } = require('path');
const rfs = require('rotating-file-stream');
const mkdirp = require('mkdirp');

const eventBus = require('./event-bus');
const store = require('./store');

class Logger {
  static getLogLevelNumber(logLevel) {
    switch (logLevel) {
      case 'trace': return 1;
      case 'debug': return 2;
      case 'info': return 3;
      case 'error': return 4;
    }
  }

  constructor() {
    eventBus.subscribe('log/trace', (msg, resetCursor = false) => this.onLogs('trace', msg, resetCursor));
    eventBus.subscribe('log/debug', (msg, resetCursor = false) => this.onLogs('debug', msg, resetCursor));
    eventBus.subscribe('log/info', (msg, resetCursor = false) => this.onLogs('info', msg, resetCursor));
    eventBus.subscribe('log/error', (msg, resetCursor = false) => this.onLogs('error', msg, resetCursor));
  }

  onLogs(logLevel, msg, resetCursor) {
    if (Logger.getLogLevelNumber(store.logLevel) > Logger.getLogLevelNumber(logLevel)) {
      return;
    }
    let logLine = `\r${moment().format('YYYY-MM-DD HH:mm:ss.SSS')} [${logLevel.toUpperCase()}]  ${msg}`;
    if (this.logWriter) {
      this.logWriter.write(logLine);
    }
    if (store.useDashboard) {
      return;
    }
    if (!resetCursor) {
      logLine = logLine.padEnd(127, ' ');
    }
    switch (logLevel) {
      case 'trace':
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

  enableFileLogging() {
    if (this.logWriter) {
      return;
    }
    mkdirp.sync(this.logDirectory, { mode: 0o770 });

    const loggerOptions = {
      size: '10M',
      interval: '1d',
      path: this.logDirectory,
      maxFiles: 10,
    };

    this.logWriter = rfs.createStream(Logger.logFileGenerator, loggerOptions);
    this.logWriter.write('\n');
  }

  static logFileGenerator(time, index) {
    const fileName = 'foxy-miner.log';
    if (!time) {
      return fileName;
    }

    return `${moment(time).format('YYYY-MM-DD')}-foxy-miner.${index}.log`;
  }

  get logDirectory() {
    return join(homedir(), '.config', 'foxy-miner', 'logs');
  }
}

module.exports = new Logger();
