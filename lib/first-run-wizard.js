const fs = require('fs');
const YAML = require('js-yaml');
const chalk = require('chalk');
const prompts = require('prompts');

const eventBus = require('./services/event-bus');
const startupMessage = require('./startup-message');

class FirstRunWizard {
  constructor(configFilePath) {
    this.configFilePath = configFilePath;
  }

  async run() {
    startupMessage();
    eventBus.publish('log/info', `First start detected, starting the first run wizard ..`);
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
      choices: this.coins.map(coin => ({
        title: coin,
        value: coin,
      })),
      min: 1,
      initial: 0,
    }]);
    this.logCancelFirstRunWizardAndExit(listenAddr);
    this.logCancelFirstRunWizardAndExit(minerType);
    this.logCancelFirstRunWizardAndExit(minerBinPath);
    this.logCancelFirstRunWizardAndExit(coins);
    let pools = [];
    for (let coin of coins) {
      const pool = {
        name: `FoxyPool ${coin}`,
        type: 'foxypool',
        color: this.coinColors[coin],
        coin,
      };
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
      this.logCancelFirstRunWizardAndExit(payoutAddress);
      this.logCancelFirstRunWizardAndExit(accountName);
      this.logCancelFirstRunWizardAndExit(minerName);
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
      const weight = 31 - i;
      const { selectedPool } = await prompts({
        type: 'autocomplete',
        name: 'selectedPool',
        message: `Select your number ${i} priority coin:`,
        choices: unselectedPools.map(pool => ({
          title: pool.coin,
          value: pool,
        })),
      });
      this.logCancelFirstRunWizardAndExit(selectedPool);
      selectedPool.weight = weight;
      unselectedPools = unselectedPools.filter(pool => pool !== selectedPool);
    }
    pools.sort((a, b) => b.weight - a.weight);

    const config = {
      listenAddr: listenAddr.trim(),
      logLevel: 'info',
      minerBinPath: minerBinPath.trim(),
      minerType,
      upstreams: pools,
    };
    this.saveToFile(config);
    await prompts({
      type: 'text',
      name: 'exit',
      message: chalk.green(`The setup wizard completed successfully and the config has been written! Head over to your ${minerType} config and change the url to ${chalk.reset('http://' + listenAddr)}${chalk.green('. Press enter to exit the program.')}`),
    });
    process.exit(0);
  }

  saveToFile(config) {
    const yaml = YAML.safeDump(config, {
      lineWidth: 140,
    });
    fs.writeFileSync(this.configFilePath, yaml, 'utf8');
  }

  get coins() {
    return Object.keys(this.coinColors);
  }

  get coinColors() {
    return {
      AETH: '#ecf0f1',
      BHD: '#f49d11',
      BURST: '#4959ff',
      DISC: '#16702a',
      LHD: '#d3d3d3',
      HDD: '#ff4aa1',
      LAVA: '#fd7e14',
      XHD: '#ffffff',
      BTB: '#f08426',
    };
  }

  logCancelFirstRunWizardAndExit(value) {
    if (value !== undefined) {
      return;
    }
    eventBus.publish('log/info', `You canceled the first run wizard, exiting ..`);
    process.exit(0);
  }
}

module.exports = FirstRunWizard;
