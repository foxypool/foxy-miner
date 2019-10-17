module.exports = (upstreamClass) => class SubmitProbabilityMixin extends upstreamClass {
  async init() {
    this.useSubmitProbability = !!this.upstreamConfig.submitProbability;
    this.targetDLFactor = null;
    this.lastCapacity = null;
    if (this.useSubmitProbability) {
      let submitProbability = this.upstreamConfig.submitProbability > 10 ? this.upstreamConfig.submitProbability / 100 : this.upstreamConfig.submitProbability;
      if (submitProbability >= 1) {
        submitProbability = 0.999999;
      }
      this.targetDLFactor = -1 * Math.log(1 - submitProbability) * (this.blockTime);
    }
    if (super.init) {
      await super.init();
    }
  }

  get blockTime() {
    switch (this.upstreamConfig.coin) {
      case 'BHD':
        return 180;
      case 'LHD':
      case 'HDD':
        return 300;
      default:
        return 240;
    }
  }
};