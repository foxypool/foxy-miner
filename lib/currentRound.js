class CurrentRound {
  constructor(upstream, miningInfo) {
    this.upstream = upstream;
    this.miningInfo = miningInfo;
    this.prio = (upstream && upstream.upstreamConfig.prio) || 10;
    this.startedAt = null;
    this.scanDone = false;
  }

  start() {
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
