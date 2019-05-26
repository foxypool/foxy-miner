const moment = require('moment');
const eventBus = require('./services/event-bus');
const CurrentRound = require('./currentRound');

class CurrentRoundManager {

  constructor() {
    this.roundQueue = [];
    this.currentRound = {scanDone: true, prio: 9999, startedAt: new Date()};
    eventBus.subscribe('scavenger/round-finished', this.updateCurrentRound.bind(this));
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
    // Ignore round endings for previous rounds
    if (moment().diff(this.currentRound.startedAt, 'seconds') < 3) {
      return;
    }
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
    this.roundQueue.sort((a, b) => b.prio - a.prio);

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
    if (this.currentRound.prio < this.roundQueue[0].prio) {
      if (!this.currentRound.scanDone) {
        this.currentRound.cancel();
        this.roundQueue.push(this.currentRound);
        this.roundQueue.sort((a, b) => b.prio - a.prio);
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
