const { basename, dirname } = require('path');
const BigNumber = require('bignumber.js');

const plotFileRegex = /^([0-9]+)_([0-9]+)_([0-9]+)$/;

class Plot {
  static isPlot(file) {
    return !!file.match(plotFileRegex);
  }

  constructor(path) {
    this.path = path;
    this.directoryPath = dirname(this.path);
    this.fileName = basename(this.path);
    const parts = this.fileName.match(plotFileRegex);
    this.accountId = parts[1];
    this.nonces = parts[3];
    this.sizeInTiB = (new BigNumber(this.nonces)).multipliedBy(256).dividedBy(new BigNumber(1024).exponentiatedBy(3));
  }
}

module.exports = Plot;
