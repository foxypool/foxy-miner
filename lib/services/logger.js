const chalk = require('chalk');
const moment = require('moment');
const { homedir } = require('os');
const { join } = require('path');
const rfs = require('rotating-file-stream');
const mkdirp = require('mkdirp');
const stripAnsi = require('strip-ansi');

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
    this.lastLogLine = {
      isMinerLog: false,
    };
    this.logResetCounter = 0;
    eventBus.subscribe('log/trace', (msg, options = {}) => this.onLogs('trace', msg, options));
    eventBus.subscribe('log/debug', (msg, options = {}) => this.onLogs('debug', msg, options));
    eventBus.subscribe('log/info', (msg, options = {}) => this.onLogs('info', msg, options));
    eventBus.subscribe('log/error', (msg, options = {}) => this.onLogs('error', msg, options));
  }

  onLogs(logLevel, msg, { isMinerLog = false } = {}) {
    if (Logger.getLogLevelNumber(store.logLevel) > Logger.getLogLevelNumber(logLevel)) {
      return;
    }
    let logLine = `${moment().format('YYYY-MM-DD HH:mm:ss.SSS')} [${logLevel.toUpperCase()}]  ${msg}`;
    if (this.logWriter && !isMinerLog) {
      this.logWriter.write(`${stripAnsi(logLine)}\n`);
    }
    if (store.useDashboard) {
      return;
    }
    if (this.lastLogLine.isMinerLog) {
      if (isMinerLog && this.logResetCounter > 10) {
        process.stdout.clearLine(0);
        this.logResetCounter = 0;
      } else if (!isMinerLog) {
        process.stdout.clearLine(0);
      }
      process.stdout.cursorTo(0);
    }
    if (isMinerLog && this.lastLogLine.isMinerLog) {
      this.logResetCounter += 1;
    } else {
      this.logResetCounter = 0;
    }
    this.lastLogLine.isMinerLog = isMinerLog;

    switch (logLevel) {
      case 'trace':
      case 'debug':
        if (isMinerLog) {
          process.stdout.write(store.getUseColors() ? chalk.grey(logLine) : logLine);
        } else {
          console.log(store.getUseColors() ? chalk.grey(logLine) : logLine);
        }
        break;
      case 'info':
        if (isMinerLog) {
          process.stdout.write(logLine);
        } else {
          console.log(logLine);
        }
        break;
      case 'error':
        if (isMinerLog) {
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
    this.logWriter.write('\n\n');
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
