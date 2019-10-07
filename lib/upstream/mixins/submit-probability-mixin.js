module.exports = (upstreamClass) => class SubmitProbabilityMixin extends upstreamClass {
  async init() {
    this.useSubmitProbability = !!this.upstreamConfig.submitProbability;
    this.targetDLFactor = null;
    this.lastCapacity = null;
    if (this.useSubmitProbability) {
      const submitProbability = this.upstreamConfig.submitProbability > 10 ? this.upstreamConfig.submitProbability / 100 : this.upstreamConfig.submitProbability;
      this.targetDLFactor = -1 * Math.log(1 - submitProbability) * (this.blockTime);
    }
    if (super.init) {
      await super.init();
    }
  }

  get blockTime() {
    switch (this.upstreamConfig.coin) {
      case 'BHD':
      case 'BOOM':
      case 'BURST':
      case 'DISC':
        return 240;
      case 'LHD':
      case 'HDD':
        return 300;
      default: return 240;
    }
  }
};