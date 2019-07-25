const SocketIo = require('./socketio');

class FoxyPool extends SocketIo {
  async init() {
    if (!this.upstreamConfig.url) {
      this.upstreamConfig.url = 'https://0-100-bhd.foxypool.cf/mining';
    }
    if (!this.upstreamConfig.url.endsWith('/mining')) {
      this.upstreamConfig.url += '/mining';
    }
    await super.init();
  }
}

module.exports = FoxyPool;
