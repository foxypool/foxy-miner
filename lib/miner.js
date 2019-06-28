const { dirname, basename } = require('path');
const spawn = require('cross-spawn');
const eventBus = require('./services/event-bus');

class Miner {
  constructor(binPath, configPath = null) {
    this.binPath = binPath;
    this.bin = basename(this.binPath);
    this.cwd = dirname(this.binPath);
    this.configPath = configPath;
    this.stopped = true;
    this.currentBlockScanning = null;
    this.roundFinishedString = 'round finished';
    this.newRoundRegex = /new block: height=([0-9]+)/;
  }

  async start() {
    this.stopped = false;
    let args = [];
    if (this.configPath) {
      args = args.concat(['-c', this.configPath]);
    }
    this.minerRef = spawn(this.bin, args, {
      cwd: this.cwd,
      stdio: 'pipe',
    });
    this.minerRef.stdout.on('data', (data) => {
      process.stdout.write(data);
      const text = data.toString().trim();
      if (text.indexOf(this.roundFinishedString) !== -1) {
        eventBus.publish('miner/round-finished', this.currentBlockScanning);
      }
      const matches = text.match(this.newRoundRegex);
      if (matches) {
        this.currentBlockScanning = parseInt(matches[1], 10);
      }
    });
    this.minerRef.stderr.on('data', (data) => process.stderr.write(data));
    this.minerRef.on('close', async () => {
      await new Promise(resolve => setTimeout(resolve, 500));
      if (this.stopped) {
        return;
      }
      this.start();
    });
  }

  async stop() {
    this.stopped = true;
    if (!this.minerRef) {
      return;
    }
    this.minerRef.kill();
    this.minerRef = null;
  }
}

module.exports = Miner;
