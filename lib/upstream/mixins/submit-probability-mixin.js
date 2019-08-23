module.exports = (upstreamClass) => class SubmitProbabilityMixin extends upstreamClass {
  async init() {
    this.useSubmitProbability = !!this.upstreamConfig.submitProbability;
    this.targetDLFactor = null;
    this.lastCapacity = null;
    if (this.useSubmitProbability) {
      this.targetDLFactor = -1 * Math.log(100 - this.upstreamConfig.submitProbability) * (this.upstreamConfig.blockTime || 240);
    }
    if (super.init) {
      await super.init();
    }
  }
};