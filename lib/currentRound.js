class CurrentRound {
  constructor(upstream, miningInfo, miner) {
    this.upstream = upstream;
    this.miningInfo = miningInfo;
    this.miner = miner;
    this.weight = (upstream && (upstream.weight || upstream.upstreamConfig.prio || upstream.upstreamConfig.weight)) || 10;
    this.scanDone = false;
  }

  start() {
    this.miner.publish('new-round', this.miningInfo);
  }

  getHeight() {
    return this.miningInfo.height;
  }
}

module.exports = CurrentRound;
