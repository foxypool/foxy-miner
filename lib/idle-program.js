const { dirname, basename } = require('path');
const { exec } = require('child_process');
const spawn = require('cross-spawn');
const eventBus = require('./services/event-bus');

class IdleProgram {
  constructor(binPath, killBinPath = null) {
    this.binPath = binPath;
    this.bin = `./${basename(this.binPath)}`;
    this.cwd = dirname(this.binPath);
    this.killBinPath = killBinPath;
    this.stopped = true;
  }

  async start() {
    while (this.stopping) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    this.stopped = false;
    const args = []; // Not supported for now

    const options = {
      cwd: this.cwd,
      stdio: 'pipe',
    };
    let bin = this.bin;
    if (this.killBinPath) {
      delete options.stdio;
      options.detached = true;
      options.shell = true;
      bin = this.binPath;
    }
    eventBus.publish('log/debug', `${this.constructor.name} | Starting with binary: ${bin}, args: ${args.join(' ')}, cwd: ${this.cwd}`);
    this.programRef = spawn(bin, args, options);
    if (!this.killBinPath) {
      this.programRef.stdout.on('data', (data) => process.stdout.write(data));
      this.programRef.stderr.on('data', (data) => process.stderr.write(data));
    }
    this.programRef.on('close', async () => {
      if (this.stopped || this.stopping) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
      this.start();
    });
  }

  async stop() {
    if (!this.programRef || this.stopping) {
      return;
    }
    eventBus.publish('log/debug', `${this.constructor.name} | Stopping ..`);
    this.stopping = true;
    if (this.killBinPath) {
      await new Promise(resolve => exec(this.killBinPath, resolve));
    }

    this.programRef.kill();
    this.programRef = null;
    this.stopped = true;
    this.stopping = false;
  }
}

module.exports = IdleProgram;
