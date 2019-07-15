const eventBus = require('./services/event-bus');

class CurrentRound {
  constructor(upstream, miningInfo) {
    this.upstream = upstream;
    this.miningInfo = miningInfo;
    this.prio = (upstream && (upstream.prio || upstream.upstreamConfig.prio || upstream.upstreamConfig.weight)) || 10;
    this.startedAt = null;
    this.scanDone = false;
  }

  start() {
    eventBus.publish('miner/new-round', this.miningInfo);
    this.startedAt = new Date();
  }

  cancel() {
    this.startedAt = null;
  }

  getStartedAt() {
    return this.startedAt;
  }

  getHeight() {
    return this.miningInfo.height;
  }
}

module.exports = CurrentRound;
