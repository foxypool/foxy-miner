const SocketIo = require('./socketio');

class FoxyPool extends SocketIo {
  async init() {
    if (!this.upstreamConfig.url) {
      this.upstreamConfig.url = 'https://foxypool.bhd.network/mining';
    }
    await super.init();
  }
}

module.exports = FoxyPool;
