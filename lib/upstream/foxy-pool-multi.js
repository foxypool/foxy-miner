const Base = require('./base');
const foxyPoolGateway = require('../services/foxy-pool-gateway');

const eventBus = require('../services/event-bus');
const config = require('../services/config');
const MiningInfo = require('../miningInfo');
const outputUtil = require('../output-util');

class FoxyPoolMulti extends Base {
  async init() {
    await super.init();
    this.coin = this.upstreamConfig.coin.toUpperCase();
    this.connected = foxyPoolGateway.connected;

    foxyPoolGateway.onConnectionStateChange(() => {
      this.connected = foxyPoolGateway.connected;
    });
    foxyPoolGateway.onNewMiningInfo(this.coin, this.onNewMiningInfo.bind(this));

    const miningInfo = await foxyPoolGateway.getMiningInfo(this.coin);
    await this.onNewMiningInfo(miningInfo);
  }

  async onNewMiningInfo(para) {
    if (this.upstreamConfig.sendTargetDL) {
      para.targetDeadline = this.upstreamConfig.sendTargetDL;
    }
    const miningInfo = new MiningInfo({
      height: para.height,
      baseTarget: para.baseTarget,
      generationSignature: para.generationSignature,
      targetDeadline: para.targetDeadline,
      miningHalted: para.miningHalted,
      coin: this.upstreamConfig.coin,
    });
    if (this.miningInfo && this.miningInfo.height === miningInfo.height && this.miningInfo.baseTarget === miningInfo.baseTarget) {
      return;
    }

    this.dynamicTargetDeadline = null;
    if (this.useSubmitProbability && this.lastCapacity) {
      const totalCapacityInTiB = this.lastCapacity / 1024;
      this.dynamicTargetDeadline = Math.round(this.targetDLFactor * miningInfo.netDiff / totalCapacityInTiB);
      const dynamicTargetDeadlineFormatted = config.humanizeDeadlines ? outputUtil.getFormattedDeadline(this.dynamicTargetDeadline) : this.dynamicTargetDeadline;
      eventBus.publish('log/debug', `${this.fullUpstreamName} | Submit Probability | Using targetDL ${dynamicTargetDeadlineFormatted}`);
    }

    if (this.miningCanBeHalted()) {
      miningInfo.miningHalted = true;
    }

    this.miningInfo = miningInfo;
    this.emit('new-round', miningInfo);
    let newBlockLine = `${this.fullUpstreamName} | ${outputUtil.getString(`New block ${miningInfo.height}, baseTarget ${miningInfo.baseTarget}, netDiff ${miningInfo.netDiffFormatted}`, 'green')}`;
    if (miningInfo.targetDeadline) {
      newBlockLine += outputUtil.getString(`, targetDL: ${miningInfo.targetDeadline}`, 'green');
    }
    eventBus.publish('log/info', newBlockLine);
  }

  async submitNonce(submission, minerSoftware, options) {
    super.submitNonce(submission);

    const optionsToSubmit = {
      minerName: this.upstreamConfig.minerName || options.minerName || this.defaultMinerName,
      userAgent: `${this.userAgent} | ${minerSoftware}`,
      capacity: options.capacity,
      payoutAddress: this.upstreamConfig.payoutAddress || this.upstreamConfig.accountKey,
      accountName: this.upstreamConfig.accountName || options.accountName || null,
      distributionRatio: this.upstreamConfig.distributionRatio || null,
    };

    const result = await foxyPoolGateway.submitNonce(this.coin, submission.toObject(), optionsToSubmit);

    return {
      error: null,
      result,
    };
  }

  getMiningInfo() {
    return this.miningInfo.toObject();
  }
}

module.exports = FoxyPoolMulti;
