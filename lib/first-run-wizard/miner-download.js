const EventEmitter = require('events');
const { createWriteStream, unlinkSync } = require('fs');
const request = require('request');
const progress = require('request-progress');
const decompress = require('decompress');
const mkdirp = require('mkdirp');

class MinerDownload {
  constructor(url, destinationDir) {
    this.url = url;
    this.destinationDir = destinationDir;
    this.filename = this.url.split('/').pop();
    this.emitter = new EventEmitter();
  }

  async download() {
    return new Promise((resolve, reject) => {
      let returned = false;
      const download = progress(request(this.url));

      download.on('progress', (state) => {
        this.emitter.emit('download-progress', state);
      });

      download.on('error', (err) => {
        if (returned) {
          return;
        }
        returned = true;
        reject(err);
      });

      download.on('end', () => {
        if (returned) {
          return;
        }
        returned = true;
        resolve();
      });

      download.pipe(createWriteStream(this.filename));
    });
  }

  async extract() {
    mkdirp.sync(this.destinationDir, {
      mode: 0o770,
    });
    if (this.filename.includes('.tar.gz') || this.filename.includes('.zip')) {
      await decompress(this.filename, this.destinationDir);
    } else {
      throw new Error(`No matching extractor found for ${this.filename}`);
    }
  }

  async removeDownloadFile() {
    unlinkSync(this.filename);
  }

  on(...args) {
    return this.emitter.on(...args);
  }
}

module.exports = MinerDownload;
