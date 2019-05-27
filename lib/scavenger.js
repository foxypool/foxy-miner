const { dirname, basename } = require('path');
const spawn = require('cross-spawn');
const eventBus = require('./services/event-bus');

class Scavenger {
  constructor(binPath, configPath = null) {
    this.binPath = binPath;
    this.bin = basename(this.binPath);
    this.cwd = dirname(this.binPath);
    this.configPath = configPath;
    this.stopped = true;
    this.currentBlockScanning = null;
  }

  async start() {
    this.stopped = false;
    let args = [];
    if (this.configPath) {
      args = args.concat(['-c', this.configPath]);
    }
    this.scavengerRef = spawn(this.bin, args, {
      cwd: this.cwd,
      stdio: 'pipe',
    });
    this.scavengerRef.stdout.on('data', (data) => {
      process.stdout.write(data);
      const text = data.toString().trim();
      if (text.indexOf('Scavenging') !== -1) {
        return;
      }
      if (text.indexOf('round finished') !== -1) {
        eventBus.publish('scavenger/round-finished', this.currentBlockScanning);
        return;
      }
      const matches = text.match(/new block: height=([0-9]+)/);
      if (matches) {
        this.currentBlockScanning = parseInt(matches[1], 10);
        return;
      }
    });
    this.scavengerRef.stderr.on('data', (data) => process.stderr.write(data));
    this.scavengerRef.on('close', async () => {
      await new Promise(resolve => setTimeout(resolve, 500));
      if (this.stopped) {
        return;
      }
      this.start();
    });
  }

  async stop() {
    this.stopped = true;
    if (!this.scavengerRef) {
      return;
    }
    this.scavengerRef.kill();
    this.scavengerRef = null;
  }
}

module.exports = Scavenger;
