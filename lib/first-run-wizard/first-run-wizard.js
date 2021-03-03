const {writeFileSync, readFileSync } = require('fs');
const YAML = require('js-yaml');
const chalk = require('chalk');
const prompts = require('prompts');
const ora = require('ora');

const eventBus = require('../services/event-bus');
const startupMessage = require('../startup-message');
const binaryManager = require('../miner/binary-manager/binary-manager');
const configManager = require('../miner/config-manager/config-manager');
const { miner } = require('../miner');
const PlotFileFinder = require('../plot-file-finder/plot-file-finder');

class FirstRunWizard {
  constructor(configFilePath) {
    this.configFilePath = configFilePath;
  }

  async run() {
    startupMessage();
    eventBus.publish('log/info', `First start detected, starting the first run wizard ..`);
    const listenAddr = '127.0.0.1:5000';
    const minerType = miner.scavenger.minerType;
    const { isCpuOnly } = await prompts([{
      type: 'select',
      name: 'isCpuOnly',
      message: 'Do you want to mine with your CPU or GPU?',
      choices: [{
        title: 'CPU',
        description: 'CPU only',
        value: true,
      }, {
        title: 'CPU/GPU',
        description: 'CPU and/or GPU',
        value: false,
      }],
      initial: 0,
    }]);
    this.logCancelFirstRunWizardAndExit(isCpuOnly);
    await binaryManager.ensureMinerDownloaded({ minerType, isCpuOnly });
    const minerBinPath = binaryManager.getMinerBinaryPath({ minerType, isCpuOnly });
    const { coins } = await prompts([{
      type: 'multiselect',
      name: 'coins',
      message: 'Which coins do you want to mine?',
      choices: this.coins.map(coin => ({
        title: coin,
        value: coin,
        selected: coin === 'BHD',
      })),
      min: 1,
    }]);
    this.logCancelFirstRunWizardAndExit(coins);
    let pools = [];
    for (let coin of coins) {
      const pool = {
        name: `FoxyPool ${coin}`,
        type: 'foxypool',
        color: this.coinColors[coin],
        coin,
        distributionRatio: '0-100',
      };
      const {
        payoutAddress,
        accountName,
        minerName,
      } = await prompts([{
        type: 'text',
        name: 'payoutAddress',
        message: `[${chalk.hex(pool.color)(pool.name)}] Please enter your ${coin} payout address`,
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

    const plotFileFinder = new PlotFileFinder();
    const spinner = ora('Searching for plot files .. Found plots: 0 | Scanned directories: 0').start();

    let lastScannedDirectory = null;
    plotFileFinder.on('directory-scanned', ({ directory }) => {
      lastScannedDirectory = directory;
      spinner.text = `Searching for plot files in ${lastScannedDirectory}. Found plots: ${plotFileFinder.plots.length} | Scanned directories: ${plotFileFinder.directoriesScanned}`;
    });
    plotFileFinder.on('plot-found', () => {
      spinner.text = `Searching for plot files in ${lastScannedDirectory}. Found plots: ${plotFileFinder.plots.length} | Scanned directories: ${plotFileFinder.directoriesScanned}`;
    });
    await plotFileFinder.findPlots();
    spinner.succeed(`Finished searching for plots. Found plots: ${plotFileFinder.plots.length} (${plotFileFinder.totalPlotSizeInTiB.toFixed(2)} TiB) | Scanned directories: ${plotFileFinder.directoriesScanned}`);

    const config = {
      logLevel: 'info',
      logToFile: true,
      humanizeDeadlines: true,
      isCpuOnly,
      upstreams: pools,
      minerConfig: {
        useHddDirectIo: true,
        cpuWorkers: isCpuOnly ? 4 : 0,
        useCpuThreadPinning: false,
        gpuPlatform: 0,
        gpuDevice: 0,
        gpuThreads: isCpuOnly ? 0 : 1,
        gpuWorkers: isCpuOnly ? 0 : 12,
        gpuNoncesPerCache: 262144,
        useGpuMemMapping: false,
        useGpuAsyncCompute: !isCpuOnly,
        plotDirs: plotFileFinder.plotDirectories,
      },
      listenAddr,
      isManaged: true,
      minerType,
      minerBinPath: minerBinPath.trim(),
      minerConfigPath: configManager.getMinerConfigPath({ minerType }),
    };
    this.saveToFile(config);
    configManager.ensureMinerConfigExists({ minerType, config });

    let text = `The first run wizard completed successfully and the config has been written to ${this.configFilePath}!`;
    text += chalk.cyan(`\n\nPlease add any missing plot file paths to the config (${this.configFilePath}).`);
    text += chalk.green('\n\nPress enter to exit the program.');

    await prompts({
      type: 'text',
      name: 'exit',
      message: chalk.green(text),
    });
    process.exit(0);
  }

  saveToFile(config) {
    const yaml = YAML.dump(config, {
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
