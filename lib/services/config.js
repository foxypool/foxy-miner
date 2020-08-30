const fs = require('fs');
const YAML = require('js-yaml');

const eventBus = require('./event-bus');
const outputUtil = require('../output-util');
const store = require('./store');
const FirstRunWizard = require('../first-run-wizard/first-run-wizard');

class Config {
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
    ];
  }

  async init() {
    this.filePath = store.configFilePath;
    await this.loadFromFile();
    this.validateConfig();
    store.setUseColors(this.useColors);
    store.logLevel = this.logLevel;
  }

  validateConfig() {
    const validListenAddrExists = this.config.listenAddr && this.config.listenAddr.split(':').length >= 2;
    if (!validListenAddrExists) {
      Config.logErrorAndExit('No valid listenAddr specified!');
    }
    if (this.listenPort < 1 || this.listenPort > 65535) {
      Config.logErrorAndExit('No valid port specified!');
    }
    if (!this.minerBinPath && !this.miner) {
      Config.logErrorAndExit('No valid miner bin path specified!');
    }
    if ((!this.minerType || !this.validMinerTypes.some(minerType => this.minerType === minerType)) && !this.miner) {
      Config.logErrorAndExit('No valid miner type specified!');
    }
    if ((!this.upstreams || !Array.isArray(this.upstreams) || this.upstreams.length === 0) && !this.miner) {
      Config.logErrorAndExit(`No upstreams defined!`);
    }
    if (this.upstreams) {
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
    if (this.miner) {
      this.miner.forEach(miner => {
        if (!miner.minerBinPath) {
          Config.logErrorAndExit('No valid miner bin path specified!');
        }
        if (!miner.minerType || !this.validMinerTypes.some(minerType => miner.minerType === minerType)) {
          Config.logErrorAndExit('No valid miner type specified!');
        }
        if (!miner.upstreams || !Array.isArray(miner.upstreams) || miner.upstreams.length === 0) {
          Config.logErrorAndExit(`No upstreams defined!`);
        }
        miner.upstreams.forEach(upstream => {
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
      });
    }
  }

  async loadFromFile() {
    let file;
    try {
      file = fs.readFileSync(this.filePath);
    } catch (err) {
      try {
        file = fs.readFileSync('config.yaml');
      } catch (err) {
        const firstRunWizard = new FirstRunWizard(this.filePath);
        await firstRunWizard.run();
        process.exit(0);
      }
    }
    let configObject = null;
    try {
      configObject = YAML.safeLoad(file);
    } catch (err) {
      Config.logErrorAndExit(err);
    }
    this.initFromObject(configObject);
  }

  initFromObject(configObject) {
    this._config = configObject;
  }

  get upstreams() {
    return this.config.upstreams;
  }

  get listenAddr() {
    return this.config.listenAddr;
  }

  get listenHost() {
    const parts = this.config.listenAddr.split(':');
    parts.pop();
    return parts.join(':');
  }

  get listenPort() {
    const parts = this.config.listenAddr.split(':');
    return parseInt(parts.pop(), 10);
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

  get miner() {
    return this.config.miner;
  }

  getAccountColor(account) {
    if (!this.config.accountColors || !this.config.accountColors[account]) {
      return null;
    }

    return this.config.accountColors[account];
  }

  get dashboardLogLines() {
    return this.config.dashboardLogLines || 16;
  }

  get useEcoBlockRewardsForProfitability() {
    return !!this.config.useEcoBlockRewards;
  }

  get minerOutputToConsole() {
    return !!this.config.minerOutputToConsole;
  }

  get hideScanProgress() {
    return !!this.config.hideScanProgress;
  }
}

module.exports = new Config();
