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
        name: 'FoxyPool BURST',
        type: 'foxypool',
        url: 'https://burst.foxypool.cf/mining',
        payoutAddress: 'your BURST payout address',
        accountName: 'your desired name',
        minerName: 'your desired miner name',
        weight: 10,
        color: '#3c55d1',
      }, {
        name: 'FoxyPool BHD',
        type: 'foxypool',
        payoutAddress: 'your BHD payout address',
        accountName: 'your desired name',
        minerName: 'your desired miner name',
        weight: 11,
        color: '#e25898',
      }],
      listenAddr: '127.0.0.1:5000',
      logLevel: 'info',
      minerBinPath: 'C:\\some\\path\\to\\scavenger.exe',
      minerType: 'scavenger',
    };
  }

  static logErrorAndExit(error) {
    eventBus.publish('log/error', `There is an error with your config file: ${error}`);
    process.exit(1);
  }

  constructor() {
    this.validMinerTypes = [
      'scavenger',
      'conqueror',
    ];
    this.upstreamTypesWithoutUrl = [
      'foxypool',
      'hdpool',
      'hdpool-eco',
    ];
  }

  init() {
    this.filePath = store.configFilePath;
    this.loadFromFile();
    this.migrate();
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
    if (!this.minerBinPath) {
      Config.logErrorAndExit('No valid miner bin path specified!');
    }
    if (!this.minerType || !this.validMinerTypes.some(minerType => this.minerType === minerType)) {
      Config.logErrorAndExit('No valid miner type specified!');
    }
    if (!this.upstreams || !Array.isArray(this.upstreams) || this.upstreams.length === 0) {
      Config.logErrorAndExit(`No upstreams defined!`);
    }
    this.upstreams.forEach(upstream => {
      if (!upstream.name) {
        Config.logErrorAndExit(`At least one upstream does not have a name!`);
      }
      if (!this.upstreamTypesWithoutUrl.some(type => type === upstream.type) && !upstream.url) {
        Config.logErrorAndExit(`Upstream ${outputUtil.getName(upstream)}: No url defined!`);
      }
      if (this.useProfitability && !upstream.coin) {
        Config.logErrorAndExit(`Upstream ${outputUtil.getName(upstream)}: No coin defined!`);
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
    fs.writeFileSync(this.filePath, yaml, 'utf8');
  }

  initFromObject(configObject = null) {
    this._config = configObject || Config.defaultConfig;
  }

  migrate() {
    let migrated = false;
    if (this.config.scavengerBinPath) {
      this.config.minerBinPath = this.config.scavengerBinPath;
      delete this.config.scavengerBinPath;
      migrated = true;
    }
    if (this.config.scavengerConfigPath) {
      this.config.minerConfigPath = this.config.scavengerConfigPath;
      delete this.config.scavengerConfigPath;
      migrated = true;
    }
    if (!this.config.minerType) {
      this.config.minerType = 'scavenger';
      migrated = true;
    }
    this.config.upstreams.forEach(upstream => {
      if (!upstream.minerAlias) {
        return;
      }
      upstream.accountName = upstream.minerAlias;
      delete upstream.minerAlias;
      migrated = true;
    });
    if (migrated) {
      this.saveToFile();
    }
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

  get minerBinPath() {
    return this.config.minerBinPath;
  }

  get minerType() {
    return this.config.minerType;
  }

  get minerConfigPath() {
    return this.config.minerConfigPath;
  }

  get useProfitability() {
    return !!this.config.useProfitability;
  }

  get maxNumberOfChains() {
    return this.config.maxNumberOfChains;
  }

  get humanizeDeadlines() {
    return !!this.config.humanizeDeadlines;
  }

  get hideNonces() {
    return !!this.config.hideNonces;
  }

  getAccountColor(account) {
    if (!this.config.accountColors || !this.config.accountColors[account]) {
      return null;
    }

    return this.config.accountColors[account];
  }
}

module.exports = new Config();
