const { existsSync } = require('fs');
const { type: os, homedir, arch } = require('os');
const { join } = require('path');
const cliProgress = require('cli-progress');
const bytes = require('bytes');

const Download = require('./download');
const { miner, getMinerDownloadInfo } = require('../');

class BinaryManager {
  async ensureMinerDownloaded({ minerType, isCpuOnly }) {
    if (minerType !== miner.scavenger.minerType) {
      throw new Error('Only scavenger supported at this time');
    }
    const downloadInfo = getMinerDownloadInfo({ minerType });
    const minerBinPath = this.getMinerBinaryPath({ minerType, isCpuOnly, version: downloadInfo.version });
    if (existsSync(minerBinPath)) {
      return;
    }
    const downloadProgressBar = new cliProgress.SingleBar({
      format: `Downloading ${minerType}: {bar} | {percentage}% | Speed: {speed}`,
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
      clearOnComplete: true,
    });
    const downloadUrl = this.getMinerDownloadUrl({ minerType, isCpuOnly, version: downloadInfo.version });
    const minerDownload = new Download({ url: downloadUrl, destinationDir: this.binaryDirectory });
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
  }

  getMinerBinaryPath({ minerType, isCpuOnly, version = getMinerDownloadInfo({ minerType }).version }) {
    return join(this.binaryDirectory, this.getMinerBinaryName({ minerType, isCpuOnly, version }));
  }

  getMinerBinaryName({ minerType, isCpuOnly, version }) {
    let name = `${minerType}-${version}`;
    switch (os()) {
      case 'Linux':
        name += '-linux';
        switch (arch()) {
          case 'arm64':
            name += '-arm64';
            break;
          case 'arm':
            name += '-armv7';
            break;
          default:
            name += '-x86_64';
        }
        break;
      case 'Windows_NT':
        name += '-windows-x86_64';
        break;
      case 'Darwin':
        name += '-apple-x86_64';
        break;
    }
    switch (arch()) {
      case 'arm64':
        name += '-cpu-only';
        break;
      default:
        name += isCpuOnly ? '-cpu-only' : '-cpu-gpu';
    }
    if (os() === 'Windows_NT') {
      name += '.exe'
    }

    return name;
  }

  getMinerDownloadUrl({ minerType, isCpuOnly, version }) {
    const binaryName = this.getMinerBinaryName({ minerType, isCpuOnly, version });

    return `${this.minerDownloadBaseUrl}/${binaryName}.zip`;
  }

  get minerDownloadBaseUrl() {
    return 'https://github.com/felixbrucker/foxy-miner/releases/download/0.0.0';
  }

  get binaryDirectory() {
    return join(homedir(), '.config', 'foxy-miner', 'miner', 'binaries');
  }
}

module.exports = new BinaryManager();
