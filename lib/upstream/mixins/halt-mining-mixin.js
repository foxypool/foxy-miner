const superagent = require('superagent');

module.exports = (upstreamClass) => class HaltMiningMixin extends upstreamClass {
  constructor() {
    super();
    this.plotterIds = {};
    this.on('new-round', async () => {
      await this.updatePlotterIdStates();
    });
  }

  miningCanBeHalted() {
    if (Object.keys(this.plotterIds).length === 0) {
      return false;
    }

    return Object.keys(this.plotterIds)
      .map(plotterId => this.plotterIds[plotterId])
      .every(plotterId => plotterId.miningHalted);
  }

  async updatePlotterIdStates() {
    if (this.upstreamConfig.coin === 'BTB' && !!this.upstreamConfig.walletUrl) {
      await Promise.all(Object.keys(this.plotterIds).map(async plotterId => {
        this.plotterIds[plotterId].miningHalted = await this.isPlotterIdOverSizeBTB(plotterId);
      }));
    }
  }

  async isPlotterIdOverSizeBTB(plotterId) {
    try {
      const res = await this.doWalletApiCall('getplottermininginfo', [plotterId]);

      return res.oversize;
    } catch (err) {
      return null;
    }
  }

  async doWalletApiCall(method, params = []) {
    const res = await superagent.post(this.upstreamConfig.walletUrl).send({
      jsonrpc: '2.0',
      id: 0,
      method,
      params,
    });

    return res.body.result;
  }

  submitNonce(submission) {
    if (this.plotterIds[submission.accountId]) {
      return;
    }
    this.plotterIds[submission.accountId] = {};
  }
};