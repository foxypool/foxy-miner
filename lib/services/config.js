const chalk = require('chalk');
const prompts = require('prompts');
const fs = require('fs');
const YAML = require('js-yaml');
const eventBus = require('./event-bus');
const outputUtil = require('../output-util');
const store = require('./store');
const startupMessage = require('../startup-message');

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

  static get coins() {
    return Object.keys(Config.pools);
  }

  static get pools() {
    return {
      BHD: ['0-100', '100-0'],
      BOOM: ['0-100', '100-0'],
      BURST: ['0-100'],
      DISC: ['0-100', '100-0'],
      LHD: ['0-100', '100-0'],
    };
  }

  static get coinColors() {
    return {
      BHD: '#f49d11',
      BOOM: '#6576ce',
      BURST: '#4959ff',
      DISC: '#16702a',
      LHD: '#d3d3d3',
    };
  }

  static get poolDescription() {
    return {
      '0-100': '100% of the block reward are distributed to historical shares of miners, 0% to the block winner.',
      '100-0': '0% of the block reward are distributed to historical shares of miners, 100% to the block winner.',
    };
  }

  static logErrorAndExit(error) {
    eventBus.publish('log/error', `There is an error with your config file: ${error}`);
    process.exit(1);
  }

  static logCancelSetupWizardAndExit(value) {
    if (value !== undefined) {
      return;
    }
    eventBus.publish('log/info', `You canceled the setup wizard, exiting ..`);
    process.exit(0);
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

  async init() {
    this.filePath = store.configFilePath;
    await this.loadFromFile();
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
      await this.setupWizard();
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

  async setupWizard() {
    startupMessage();
    eventBus.publish('log/info', `First start detected, starting setup wizard ..`);
    const {
      listenAddr,
      minerType,
      minerBinPath,
      coins,
    } = await prompts([{
      type: 'text',
      name: 'listenAddr',
      message: `Which listen address do you want to use? Your miner will need to connect to this address and port`,
      initial: '127.0.0.1:5000',
    },{
      type: 'select',
      name: 'minerType',
      message: 'Which miner do you want to use?',
      choices: [{
        title: 'Scavenger',
        description: 'A CPU / GPU Miner written in Rust',
        value: 'scavenger',
      }, {
        title: 'Conqueror',
        description: 'A Helix Miner written in Rust',
        value: 'conqueror',
      }],
      initial: 0,
    },{
      type: 'text',
      name: 'minerBinPath',
      message: `What is the full path to the miner binary? (e.g. C:\\miners\\scavenger\\scavenger.exe)`,
      validate: (input) => !!input ? true : 'No miner binary path entered!',
    },{
      type: 'multiselect',
      name: 'coins',
      message: 'Which coins do you want to mine?',
      choices: Config.coins.map(coin => ({
        title: coin,
        value: coin,
      })),
      min: 1,
      initial: 0,
    }]);
    Config.logCancelSetupWizardAndExit(listenAddr);
    Config.logCancelSetupWizardAndExit(minerType);
    Config.logCancelSetupWizardAndExit(minerBinPath);
    Config.logCancelSetupWizardAndExit(coins);
    let pools = [];
    for (let coin of coins) {
      const { pool } = await prompts({
        type: 'select',
        name: 'pool',
        message: `[${chalk.hex(Config.coinColors[coin])(coin)}] Which pool do you want to use?`,
        choices: Config.pools[coin].map(type => ({
          title: type,
          description: Config.poolDescription[type],
          value: {
            name: `FoxyPool ${coin}`,
            type: 'foxypool',
            url: `https://${type}-${coin.toLowerCase()}.foxypool.cf`,
            color: Config.coinColors[coin],
            coin,
          },
        })),
        initial: 0,
      });
      Config.logCancelSetupWizardAndExit(pool);
      const {
        payoutAddress,
        accountName,
        minerName,
      } = await prompts([{
        type: 'text',
        name: 'payoutAddress',
        message: `[${chalk.hex(pool.color)(pool.name)}] Which payout address do you want to use?`,
        validate: (input) => !!input ? true : 'No payout address entered!',
      },{
        type: 'text',
        name: 'accountName',
        message: `[${chalk.hex(pool.color)(pool.name)}] Which account name to you want to use? (optional)`,
      },{
        type: 'text',
        name: 'minerName',
        message: `[${chalk.hex(pool.color)(pool.name)}] Which miner name to you want to use? (optional)`,
      }]);
      Config.logCancelSetupWizardAndExit(payoutAddress);
      Config.logCancelSetupWizardAndExit(accountName);
      Config.logCancelSetupWizardAndExit(minerName);
      pool.payoutAddress = payoutAddress.trim();
      if (accountName.trim()) {
        pool.accountName = accountName.trim();
      }
      if (minerName.trim()) {
        pool.minerName = minerName.trim();
      }
      pools.push(pool);
    }
    let unselectedPools = pools.slice();
    for (let i = 1; i <= pools.length; i += 1) {
      const weight = 11 - i;
      const { selectedPool } = await prompts({
        type: 'autocomplete',
        name: 'selectedPool',
        message: `Select your number ${i} priority coin:`,
        choices: unselectedPools.map(pool => ({
          title: pool.coin,
          value: pool,
        })),
      });
      Config.logCancelSetupWizardAndExit(selectedPool);
      selectedPool.weight = weight;
      unselectedPools = unselectedPools.filter(pool => pool !== selectedPool);
    }
    pools.sort((a, b) => b.weight - a.weight);

    this._config = {
      listenAddr: listenAddr.trim(),
      logLevel: 'info',
      minerBinPath: minerBinPath.trim(),
      minerType,
      upstreams: pools,
    };
    this.saveToFile();
    await prompts({
      type: 'text',
      name: 'exit',
      message: chalk.green(`The setup wizard completed successfully and the config has been written! Head over to your ${minerType} config and change the url to ${chalk.reset('http://' + listenAddr)}${chalk.green('. Press enter to exit the program.')}`),
    });
    process.exit(0);
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
}

module.exports = new Config();
