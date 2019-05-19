const chalk = require('chalk');
const fs = require('fs');
const YAML = require('js-yaml');
const eventBus = require('./event-bus');
const outputUtil = require('../output-util');
const store = require('./store');

class Config {
  static get defaultConfig() {
    return {
      upstreams: [{
        name: 'Burst',
        url: 'http://localhost:12345/burst',
        prio: 10,
        color: '#4959ff',
      }, {
        name: 'BHD',
        url: 'http://localhost:12345/bhd',
        prio: 11,
        color: '#f49d11',
      }],
      listenAddr: '127.0.0.1:5000',
      logLevel: 'info',
      scavengerBinPath: '/some/path/to/scavenger.exe',
    };
  }

  static logErrorAndExit(error) {
    eventBus.publish('log/error', `There is an error with your config file: ${error}`);
    process.exit(1);
  }

  constructor() {
    this.filePath = 'config.yaml';
    this.loadFromFile();
    this.validateConfig();
    store.setUseColors(this.useColors);
    store.logLevel = this.logLevel;
  }

  validateConfig() {
    const validListenAddrExists = this.config.listenAddr && this.config.listenAddr.split(':').length === 2;
    if (!validListenAddrExists) {
      Config.logErrorAndExit('No valid listenAddr specified!');
    }
    if (this.listenPort < 1 || this.listenPort > 65535) {
      Config.logErrorAndExit('No valid port specified!');
    }
    if (!this.scavengerBinPath) {
      Config.logErrorAndExit('No valid scavenger bin path specified!');
    }
    if (!this.upstreams || !Array.isArray(this.upstreams) || this.upstreams.length === 0) {
      Config.logErrorAndExit(`No upstreams defined!`);
    }
    this.upstreams.forEach(upstream => {
      if (!upstream.name) {
        Config.logErrorAndExit(`At least one upstream does not have a name!`);
      }
      if (!upstream.url) {
        Config.logErrorAndExit(`Upstream ${outputUtil.getName(upstream)}: No url defined!`);
      }
    });
  }

  loadFromFile() {
    let file;
    try {
      file = fs.readFileSync(this.filePath);
    } catch (err) {
      eventBus.publish('log/info', `First start detected, creating the config file (${chalk.cyan(this.filePath)}), please adjust it to your preferences.\n` +
          'Config examples are available here: https://github.com/felixbrucker/foxy-miner/wiki/Config-examples');
      this.initFromObject();
      this.saveToFile();
      process.exit(0);
    }
    let configObject = null;
    try {
      configObject = YAML.safeLoad(file);
    } catch (err) {
      Config.logErrorAndExit(err);
    }
    this.initFromObject(configObject);
  }

  saveToFile() {
    const yaml = YAML.safeDump(this.config, {
      lineWidth: 140,
    });
    fs.writeFileSync(this.filePath, yaml);
  }

  initFromObject(configObject = null) {
    this._config = configObject || Config.defaultConfig;
  }

  get upstreams() {
    return this.config.upstreams;
  }

  get listenAddr() {
    return this.config.listenAddr;
  }

  get listenHost() {
    return this.config.listenAddr.split(':')[0];
  }

  get listenPort() {
    return parseInt(this.config.listenAddr.split(':')[1], 10);
  }

  get config() {
    return this._config;
  }

  get logLevel() {
    return this.config.logLevel;
  }

  get useColors() {
    return !this.config.noColors;
  }

  get scavengerBinPath() {
    return this.config.scavengerBinPath;
  }

  get scavengerConfigPath() {
    return this.config.scavengerConfigPath;
  }
}

module.exports = new Config();
