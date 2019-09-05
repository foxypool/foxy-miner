const CurrentRound = require('./currentRound');
const config = require('./services/config');

class CurrentRoundManager {

  constructor(miner) {
    this.miner = miner;
    this.roundQueue = [];
    this.currentRound = {scanDone: true, prio: 9999};
    this.miner.subscribe('round-finished', (height) => {
      // Ignore round endings for previous rounds
      if (this.currentRound.miningInfo.height !== height) {
        return;
      }
      this.currentRound.scanDone = true;
      this.currentRound.progress = 100;
      this.updateCurrentRound();
      if (!this.currentRound.scanDone) {
        return;
      }
      this.miner.publish('all-rounds-finished');
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
    const currentRound = new CurrentRound(upstream, miningInfo, this.miner);
    this.roundQueue = this.roundQueue.filter(currRound => currRound.upstream !== upstream);

    this.roundQueue.push(currentRound);
    this.roundQueue.sort((a, b) => b.weight - a.weight);
    if (config.maxNumberOfChains && this.roundQueue.length > config.maxNumberOfChains) {
      this.roundQueue = this.roundQueue.slice(0, config.maxNumberOfChains);
    }

    // overwrite old round directly if from same upstream
    if (this.currentRound.upstream === this.roundQueue[0].upstream) {
      this.currentRound = this.roundQueue.shift();
      this.currentRound.start();
      return;
    }

    // Do not interrupt almost finished rounds
    const doNotInterruptAbovePercent = this.currentRound.upstream && this.currentRound.upstream.upstreamConfig.doNotInterruptAbovePercent;
    if (!!doNotInterruptAbovePercent && !this.currentRound.scanDone && this.currentRound.progress >= doNotInterruptAbovePercent) {
      return;
    }

    // new high prio round, use it now and get back to the other one later if it was still running
    if (this.currentRound.weight < this.roundQueue[0].weight) {
      if (!this.currentRound.scanDone) {
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
