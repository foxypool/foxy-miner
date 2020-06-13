const {writeFileSync, existsSync, readFileSync } = require('fs');
const YAML = require('js-yaml');
const chalk = require('chalk');
const prompts = require('prompts');
const {type: os, arch} = require('os');
const {join, dirname } = require('path');
const cliProgress = require('cli-progress');
const bytes = require('bytes');

const eventBus = require('../services/event-bus');
const startupMessage = require('../startup-message');
const MinerDownload = require('./miner-download');

class FirstRunWizard {
  constructor(configFilePath) {
    this.configFilePath = configFilePath;
    this.listenAddressRegex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3}):(\d{1,5})$/;
  }

  async run() {
    startupMessage();
    eventBus.publish('log/info', `First start detected, starting the first run wizard ..`);
    const {
      listenAddr,
      minerType,
    } = await prompts([{
      type: 'text',
      name: 'listenAddr',
      message: `Which listen address do you want to use? Your miner will need to connect to this address and port`,
      initial: '127.0.0.1:5000',
      validate: (input) => this.listenAddressRegex.test(input) ? true : 'Invalid IP:Port combination entered',
    }, {
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
    }]);
    let minerBinPath = null;
    if (minerType === 'conqueror') {
      const result = await prompts([{
        type: 'text',
        name: 'minerBinPath',
        message: `What is the full path to the miner binary? (e.g. C:\\miners\\conqueror\\conqueror.exe)`,
        validate: (input) => !!input ? true : 'No miner binary path entered!',
      }]);
      minerBinPath = result.minerBinPath;
    } else {
      const cwd = process.cwd();
      const destinationDir = join(cwd, 'scavenger');
      minerBinPath = join(destinationDir, this.getScavengerBinaryNameForSystem());
      if (!existsSync(minerBinPath)) {
        const downloadProgressBar = new cliProgress.SingleBar({
          format: `Downloading scavenger: {bar} | {percentage}% | Speed: {speed}`,
          barCompleteChar: '\u2588',
          barIncompleteChar: '\u2591',
          hideCursor: true,
          clearOnComplete: true,
        });
        const minerDownload = new MinerDownload(this.getScavengerDownloadLinkForSystem(), destinationDir);
        downloadProgressBar.start(100, 0, {
          speed: 'N/A',
        });
        minerDownload.on('download-progress', (state) => {
          downloadProgressBar.update(state.percent * 100, {
            speed: `${bytes(state.speed)}/s`,
          });
        });
        await minerDownload.download();
        downloadProgressBar.update(100, {
          speed: 'N/A',
        });
        downloadProgressBar.stop();
        await minerDownload.extract();
        await minerDownload.removeDownloadFile();
        this.updateScavengerConfig({ configFile: join(destinationDir, 'config.yaml'), listenAddr });
      }
    }
    const {coins} = await prompts([{
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
      }, {
        type: 'text',
        name: 'accountName',
        message: `[${chalk.hex(pool.color)(pool.name)}] Which account name to you want to use? (optional)`,
      }, {
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

    const configPath = join(dirname(minerBinPath), 'config.yaml');
    let text = `The first run wizard completed successfully and the config has been written!`;
    if (minerType === 'conqueror') {
      text += chalk.cyan(`\n\nHead over to your ${minerType} config (${configPath}) and change the url to ${chalk.reset('http://' + listenAddr)}.`);
    } else {
      text += chalk.cyan(`\n\nPlease add your plot file paths to the scavenger config (${configPath}).`);
    }
    text += chalk.green('\n\nPress enter to exit the program.');

    await prompts({
      type: 'text',
      name: 'exit',
      message: chalk.green(text),
    });
    process.exit(0);
  }

  getScavengerDownloadLinkForSystem() {
    switch (os()) {
      case 'Linux':
        switch (arch()) {
          case 'arm64':
            return 'https://github.com/felixbrucker/foxy-miner/releases/download/0.0.0/scavenger-1.7.8-aarch64-unknown-linux-android-cpu-only.tar.gz';
          case 'arm':
            return 'https://github.com/felixbrucker/foxy-miner/releases/download/0.0.0/scavenger-1.7.8-armv7-unknown-linux-gnueabihf-cpu-gpu.tar.gz';
          default:
            return 'https://github.com/felixbrucker/foxy-miner/releases/download/0.0.0/scavenger-1.7.8-x86_64-unknown-linux-gnu-cpu-gpu.tar.gz';
        }
      case 'Windows_NT':
        return 'https://github.com/felixbrucker/foxy-miner/releases/download/0.0.0/scavenger-1.7.8-x86_64-pc-windows-msvc-cpu-gpu.zip';
      case 'Darwin':
        return 'https://github.com/felixbrucker/foxy-miner/releases/download/0.0.0/scavenger-1.7.8-x86_64-unknown-linux-gnu-cpu-gpu.tar.gz';
    }
  }

  getScavengerBinaryNameForSystem() {
    if (os() === 'Windows_NT') {
      return 'scavenger.exe';
    }

    return 'scavenger';
  }

  saveToFile(config) {
    const yaml = YAML.safeDump(config, {
      lineWidth: 140,
    });
    writeFileSync(this.configFilePath, yaml, 'utf8');
  }

  get coins() {
    return Object.keys(this.coinColors);
  }

  get coinColors() {
    return {
      BHD: '#f49d11',
      BURST: '#4959ff',
      DISC: '#16702a',
      LHD: '#d3d3d3',
      HDD: '#ff4aa1',
      XHD: '#ffffff',
    };
  }

  logCancelFirstRunWizardAndExit(value) {
    if (value !== undefined) {
      return;
    }
    eventBus.publish('log/info', `You canceled the first run wizard, exiting ..`);
    process.exit(0);
  }

  updateScavengerConfig({ configFile, listenAddr }) {
    let configFileContents = readFileSync(configFile, 'utf8');
    const skippTill = configFileContents.indexOf('plot_dirs');
    configFileContents = configFileContents.substr(skippTill);
    configFileContents = configFileContents.replace(
      `url: 'http://50-50-pool.burst.cryptoguru.org:8124'  # cryptoguru 50-50 pool`,
      `url: 'http://${listenAddr}'`
    );
    configFileContents = configFileContents.replace(
      "#url: 'http://dummypool.megash.it'            \t    # dummypool with constant scoop number for benchmarking\r\n",
      ''
    );
    configFileContents = configFileContents.replace(
      "#url: 'http://dummypool.megash.it'                  # dummypool with constant scoop number for benchmarking\r\n",
      ''
    );
    configFileContents = configFileContents.replace(
      "#url: 'http://dummypool.megash.it'                  # dummypool with constant scoop number for benchmarking\n",
      ''
    );
    configFileContents = configFileContents.replace(
      "account_id_to_target_deadline:        # target dls for multi-id (optional)\n" +
      " 10282355196851764065: 600000\n" +
      " 1796535821016683299: 55555555\n",
      ''
    );
    configFileContents = configFileContents.replace(
      "account_id_to_target_deadline:        # target dls for multi-id (optional)\r\n" +
      " 10282355196851764065: 600000\r\n" +
      " 1796535821016683299: 55555555\r\n",
      ''
    );
    configFileContents = configFileContents.replace(
      'get_mining_info_interval: 3000',
      'get_mining_info_interval: 500 '
    );

    writeFileSync(configFile, configFileContents);
  }
}

module.exports = FirstRunWizard;
