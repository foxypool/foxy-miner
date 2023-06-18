const {writeFileSync } = require('fs');
const YAML = require('js-yaml');
const chalk = require('chalk');
const prompts = require('prompts');
const ora = require('ora');
const { cpus } = require('os');
const { flatMap } = require('lodash');
const BigNumber = require('bignumber.js');

const eventBus = require('../services/event-bus');
const startupMessage = require('../startup-message');
const binaryManager = require('../miner/binary-manager/binary-manager');
const configManager = require('../miner/config-manager/config-manager');
const { miner } = require('../miner');
const PlotFileFinder = require('../plot-file-finder/plot-file-finder');

let getPlatformInfo = null;
let OpenclUnavailableError = null;
  try {
  const openclInfo = require('opencl-info');
  getPlatformInfo = openclInfo.getPlatformInfo;
  OpenclUnavailableError = openclInfo.OpenclUnavailableError;
} catch (err) {}

class FirstRunWizard {
  constructor(configFilePath) {
    this.configFilePath = configFilePath;
  }

  async run() {
    startupMessage();
    eventBus.publish('log/info', `First start detected, starting the first run wizard ..`);
    let platformInfo = null;
    let isCpuOnly = null;
    if (getPlatformInfo !== null) {
      try {
        platformInfo = getPlatformInfo();
        isCpuOnly = false;
      } catch (err) {
        if (!(err instanceof OpenclUnavailableError)) {
          isCpuOnly = true;
        }
      }
    }
    if (isCpuOnly === null) {
      const result = await prompts([{
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
      isCpuOnly = result.isCpuOnly;
      this.logCancelFirstRunWizardAndExit(isCpuOnly);
    }
    let selectedGpu = null;
    if (!isCpuOnly && platformInfo !== null) {
      const devices = flatMap(platformInfo, platform => platform.devices.map(device => ({
        ...device,
        platform: {
          id: platform.id,
          name: platform.name,
        },
      })));
      const gpus = devices.filter(device => device.type !== 'CPU');
      if (gpus.length === 1) {
        selectedGpu = gpus[0];
        ora().succeed(`Only one GPU detected, using ${selectedGpu.vendor} - ${selectedGpu.name}`);
      } else if (gpus.length > 1) {
        const { selectedGpuSelection } = await prompts([{
          type: 'select',
          name: 'selectedGpuSelection',
          message: 'Please select the GPU you want to use',
          choices: gpus.map(gpu => ({
            title: `${gpu.vendor} - ${gpu.name}`,
            value: gpu,
          })),
          initial: 0,
        }]);
        this.logCancelFirstRunWizardAndExit(selectedGpuSelection);
        selectedGpu = selectedGpuSelection;
      }
    }
    const minerType = miner.scavenger.minerType;
    await binaryManager.ensureMinerDownloaded({ minerType, isCpuOnly });
    const { coins } = await prompts([{
      type: 'multiselect',
      name: 'coins',
      message: 'Which coins do you want to mine?',
      choices: this.coins.map(coin => ({
        title: coin,
        value: coin,
        selected: coin === 'SIGNA',
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
    const plotDirs = plotFileFinder.plotDirectories;

    let gpuPlatform = 0;
    let gpuDevice = 0;
    let gpuWorkers = isCpuOnly ? 0 : 12;
    let gpuNoncesPerCache = 262144;
    let useGpuMemMapping = false;
    let useGpuAsyncCompute = false;
    if (selectedGpu !== null) {
      gpuPlatform = selectedGpu.platform.id;
      gpuDevice = selectedGpu.id;
      gpuWorkers = Math.max(plotDirs.length, gpuWorkers);
      const threadMemInMib = new BigNumber(45).multipliedBy(2);
      const nonceMemInMib = new BigNumber(gpuNoncesPerCache).multipliedBy(64).dividedBy(new BigNumber(1024).pow(2));
      const gpuMemoryInMib = new BigNumber(selectedGpu.memory).dividedBy(new BigNumber(1024).pow(2));
      const maxGpuWorkers = gpuMemoryInMib.minus(threadMemInMib).dividedBy(nonceMemInMib).integerValue(BigNumber.ROUND_FLOOR);
      gpuWorkers = BigNumber.min(gpuWorkers, maxGpuWorkers).toNumber();
      const isIntel = selectedGpu.vendor.toLowerCase().indexOf('intel') !== -1;
      useGpuAsyncCompute = !isIntel;
      useGpuMemMapping = isIntel;
    }
    let cpuWorkers = isCpuOnly ? 4 : 0;
    if (isCpuOnly) {
      cpuWorkers = Math.min(Math.max(plotDirs.length, cpuWorkers), (cpus().length * 4));
    }

    const config = {
      logLevel: 'info',
      logToFile: true,
      humanizeDeadlines: true,
      isCpuOnly,
      upstreams: pools,
      minerConfig: {
        useHddDirectIo: true,
        cpuWorkers,
        useCpuThreadPinning: false,
        gpuPlatform,
        gpuDevice,
        gpuThreads: isCpuOnly ? 0 : 1,
        gpuWorkers,
        gpuNoncesPerCache,
        useGpuMemMapping,
        useGpuAsyncCompute,
        plotDirs,
      },
      listenAddr: '127.0.0.1:5000',
      isManaged: true,
      minerType,
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
      SIGNA: '#0099ff',
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
