module.exports = (upstreamClass) => class SubmitProbabilityMixin extends upstreamClass {
  async init() {
    this.useSubmitProbability = !!this.upstreamConfig.submitProbability;
    this.targetDLFactor = null;
    this.lastCapacity = null;
    if (this.useSubmitProbability) {
      const submitProbability = this.upstreamConfig.submitProbability > 10 ? this.upstreamConfig.submitProbability / 100 : this.upstreamConfig.submitProbability;
      this.targetDLFactor = -1 * Math.log(1 - submitProbability) * (this.upstreamConfig.blockTime || 240);
    }
    if (super.init) {
      await super.init();
    }
  }
};