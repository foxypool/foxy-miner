const { dirname, basename } = require('path');
const spawn = require('cross-spawn');
const eventBus = require('./services/event-bus');

class Scavenger {
  constructor(binPath) {
    this.binPath = binPath;
    this.bin = basename(this.binPath);
    this.cwd = dirname(this.binPath);
    this.stopped = true;
  }

  async start() {
    this.stopped = false;
    this.scavengerRef = spawn(this.bin, [], {
      cwd: this.cwd,
      stdio: 'pipe',
    });
    this.scavengerRef.stdout.on('data', (data) => {
      process.stdout.write(data);
      const text = data.toString().trim();
      if (text.indexOf('round finished') === -1) {
        return;
      }
      eventBus.publish('scavenger/round-finished');
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
