const eventBus = require('./services/event-bus');
const CurrentRound = require('./currentRound');

class CurrentRoundManager {

  constructor(proxyIndex) {
    this.proxyIndex = proxyIndex;
    this.roundQueue = [];
    this.currentRound = {scanDone: true, prio: 9999, startedAt: new Date()};
    eventBus.subscribe('miner/round-finished', (proxyIndex, height) => {
      // Ignore other proxies
      if (this.proxyIndex !== proxyIndex) {
        return;
      }
      // Ignore round endings for previous rounds
      if (this.currentRound.miningInfo.height !== height) {
        return;
      }
      this.currentRound.scanDone = true;
      this.updateCurrentRound();
      if (!this.currentRound.scanDone) {
        return;
      }
      eventBus.publish('miner/all-rounds-finished');
    });
  }

  getMiningInfo() {
    if (!this.currentRound.miningInfo) {
      return {
        error: 'No miningInfo available!',
      };
    }
    return this.currentRound.miningInfo.toObject();
  }

  updateCurrentRound() {
    if (this.roundQueue.length === 0) {
      return;
    }
    this.currentRound = this.roundQueue.shift();
    this.currentRound.start();
  }

  addNewRound(upstream, miningInfo) {
    const currentRound = new CurrentRound(upstream, miningInfo);
    this.roundQueue = this.roundQueue.filter(currRound => currRound.upstream !== upstream);

    this.roundQueue.push(currentRound);
    this.roundQueue.sort((a, b) => b.weight - a.weight);

    // overwrite old round directly if from same upstream
    if (this.currentRound.upstream === this.roundQueue[0].upstream) {
      if (!this.currentRound.scanDone) {
        this.currentRound.cancel();
      }
      this.currentRound = this.roundQueue.shift();
      this.currentRound.start();
      return;
    }

    // new high prio round, use it now and get back to the other one later if it was still running
    if (this.currentRound.weight < this.roundQueue[0].weight) {
      if (!this.currentRound.scanDone) {
        this.currentRound.cancel();
        this.roundQueue.push(this.currentRound);
        this.roundQueue.sort((a, b) => b.weight - a.weight);
      }
      this.currentRound = this.roundQueue.shift();
      this.currentRound.start();
    }

    // init
    if (this.currentRound.scanDone) {
      this.updateCurrentRound();
    }
  }

  getCurrentRound() {
    return this.currentRound;
  }
}

module.exports = CurrentRoundManager;
