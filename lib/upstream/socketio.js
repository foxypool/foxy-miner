const io = require('socket.io-client');
const eventBus = require('../services/event-bus');
const config = require('../services/config');
const MiningInfo = require('../miningInfo');
const outputUtil = require('../output-util');
const Base = require('./base');

class SocketIo extends Base {
  async init() {
    await super.init();
    this.connected = false;
    this.client = io(this.upstreamConfig.url);

    this.client.on('connect', () => {
      this.connected = true;
      eventBus.publish('log/debug', `${this.fullUpstreamName} | url=${this.upstreamConfig.url} | socketio opened`);
    });
    this.client.on('disconnect', () => {
      this.connected = false;
      eventBus.publish('log/debug', `${this.fullUpstreamName} | url=${this.upstreamConfig.url} | socketio closed`);
    });

    this.client.on('miningInfo', this.onNewRound.bind(this));
    this.client.on('connect', () => this.client.emit('getMiningInfo', this.onNewRound.bind(this)));
    this.client.emit('getMiningInfo', this.onNewRound.bind(this));
  }

  async onNewRound(para) {
    this.connected = true;
    if (this.upstreamConfig.sendTargetDL) {
      para.targetDeadline = this.upstreamConfig.sendTargetDL;
    }
    const miningInfo = new MiningInfo(para.height, para.baseTarget, para.generationSignature, para.targetDeadline, this.upstreamConfig.coin);
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

    this.miningInfo = miningInfo;
    this.emit('new-round', miningInfo);
    let newBlockLine = `${this.fullUpstreamName} | ${outputUtil.getString(`New block ${miningInfo.height}, baseTarget ${miningInfo.baseTarget}, netDiff ${miningInfo.netDiffFormatted}`, 'green')}`;
    if (miningInfo.targetDeadline) {
      newBlockLine += outputUtil.getString(`, targetDL: ${miningInfo.targetDeadline}`, 'green');
    }
    eventBus.publish('log/info', newBlockLine);
  }

  async submitNonce(submission, minerSoftware, options) {
    const result = await new Promise(resolve => this.client.emit('submitNonce', submission.toObject(), {
      minerName: this.upstreamConfig.minerName || options.minerName || this.defaultMinerName,
      userAgent: `${this.userAgent} | ${minerSoftware}`,
      capacity: options.capacity,
      accountKey: this.upstreamConfig.accountKey,
      payoutAddress: this.upstreamConfig.payoutAddress || this.upstreamConfig.accountKey,
      maxScanTime: this.upstreamConfig.maxScanTime,
      accountName: this.upstreamConfig.accountName || options.accountName || null,
      distributionRatio: this.upstreamConfig.distributionRatio || null,
      color: this.upstreamConfig.minerColor || options.color || null,
    }, resolve));

    return {
      error: null,
      result,
    };
  }

  getMiningInfo() {
    return this.miningInfo.toObject();
  }
}

module.exports = SocketIo;