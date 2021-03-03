const { join } = require('path');
const { existsSync, promises: fs } = require('fs');
const EventEmitter = require('events');
const BigNumber = require('bignumber.js');

const Plot = require('./plot');

class PlotFileFinder {
  constructor() {
    this.plots = [];
    this.directoriesScanned = 0;

    this.maxDepth = 2;
    this.directoryBlacklist = new Set([
      'appdata',
      'program files',
      'program files (x86)',
      'windows',
      'system volume information',
      '$recycle.bin',
    ]);
    this.directoryWhitelist = [
      'burst',
      'bhd',
      'plot',
      'disk',
      'disc',
    ];
    this.alphabet = [...Array(26)].map((_, i) => String.fromCharCode('A'.charCodeAt(0) + i));

    this.emitter = new EventEmitter();
  }

  async findPlots() {
    this.plots = [];
    this.directoriesScanned = 0;

    const rootDirs = this.alphabet.map(char => `${char}:\\`).filter(path => existsSync(path));

    await Promise.all(rootDirs.map(rootDir => this.scan(rootDir, 0)));
  }

  async scan(dir, currentDepth) {
    let files = null;
    try {
      files = await fs.readdir(dir);
    } catch(err) {
      return;
    }
    this.directoriesScanned += 1;
    this.emitter.emit('directory-scanned', {
      directory: dir,
    });
    await Promise.all(files.map(async file => {
      let localDepth = currentDepth;
      const filePath = join(dir, file);
      let stats = null;
      try {
        stats = await fs.stat(filePath);
      } catch (err) {
        return;
      }
      if (stats.isDirectory()) {
        if (this.directoryBlacklist.has(file.toLowerCase())) {
          return;
        }
        // Scan whitelisted dirs as far as it goes
        if (this.directoryWhitelist.some(dir => filePath.toLowerCase().indexOf(dir) !== -1)) {
          localDepth = 0;
        }
        if (localDepth < this.maxDepth) {
          await this.scan(filePath, localDepth + 1);
        }
        return;
      }
      if (!Plot.isPlot(file)) {
        return;
      }
      const plot = new Plot(filePath);
      this.plots.push(plot);
      this.emitter.emit('plot-found', {
        plot,
      });
    }));
  }

  get plotDirectories() {
    return [...new Set(this.plots.map(plot => plot.directoryPath))];
  }

  get totalPlotSizeInTiB() {
    return this.plots.reduce((acc, curr) => acc.plus(curr.sizeInTiB), new BigNumber(0));
  }

  on(...args) {
    return this.emitter.on(...args);
  }
}

module.exports = PlotFileFinder;
