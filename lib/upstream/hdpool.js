const { HDPoolMiningApi } = require('hdpool-api');
const { hostname } = require('os');
const EventEmitter = require('events');
const BigNumber = require('bignumber.js');
const eventBus = require('../services/event-bus');
const config = require('../services/config');
const MiningInfo = require('../miningInfo');
const version = require('../version');
const outputUtil = require('../output-util');
const OutageDetectionMixin = require('./mixins/outage-detection-mixin');

class HDPool extends OutageDetectionMixin(EventEmitter) {
  constructor(upstreamConfig) {
    super();
    this.upstreamName = outputUtil.getName(upstreamConfig);
    this.upstreamConfig = upstreamConfig;
    this.userAgent = `Foxy-Miner ${version}`;
    this.defaultMinerName = hostname();
    this.miningInfo = {height: 0, toObject: () => ({height: 0})};
    if (this.upstreamConfig.targetDL === undefined) {
      this.upstreamConfig.targetDL = 4294967295;
    }
    this.minerName = this.upstreamConfig.minerName || this.defaultMinerName;
  }

  async init() {
    await super.init();

    this.client = new HDPoolMiningApi(this.upstreamConfig.accountKey, this.minerName, 1, this.upstreamConfig.useEcoPool);
    this.client.subscribe('debug', (message) => {
      eventBus.publish('log/debug', `${this.upstreamName} | miner=${this.minerName} | ${message}`);
    });

    await this.client.init();
    this.client.subscribe('websocket/opened', () => {
      this.connected = true;
      eventBus.publish('log/debug', `${this.upstreamName} | miner=${this.minerName} | websocket opened`);
    });
    this.client.subscribe('websocket/closed', () => {
      this.connected = false;
      eventBus.publish('log/debug', `${this.upstreamName} | miner=${this.minerName} | websocket closed`);
    });
    this.client.subscribe('websocket/broken', () => {
      this.connected = false;
      eventBus.publish('log/debug', `${this.upstreamName} | miner=${this.minerName} | websocket closed`);
    });

    // Ensure miningInfo after reconnects
    this.client.subscribe('websocket/opened', async () => {
      const miningInfo = await this.client.getMiningInfo();
      await this.onNewRound(miningInfo);
    });

    this.client.onMiningInfo(this.onNewRound.bind(this));
    const miningInfo = await this.client.getMiningInfo();
    await this.onNewRound(miningInfo);
  }

  async onNewRound(para) {
    this.connected = true;
    if (this.upstreamConfig.sendTargetDL) {
      para.targetDeadline = this.upstreamConfig.sendTargetDL;
    }
    const miningInfo = new MiningInfo(para.height, para.baseTarget, para.generationSignature, para.targetDeadline);

    const duplicate = miningInfo.height === this.miningInfo.height && miningInfo.baseTarget === this.miningInfo.baseTarget;
    if (duplicate) {
      return;
    }

    this.miningInfo = miningInfo;
    this.emit('new-round', miningInfo);
    let newBlockLine = `${this.upstreamName} | ${outputUtil.getString(`New block ${miningInfo.height}, baseTarget ${miningInfo.baseTarget}`, 'green')}`;
    if (!config.compact) {
      newBlockLine += outputUtil.getString(`, netDiff ${miningInfo.netDiff.toFixed(0)} TiB`, 'green');
      if (miningInfo.targetDeadline) {
        newBlockLine += outputUtil.getString(`, targetDeadline: ${miningInfo.targetDeadline}`, 'green');
      }
    }
    eventBus.publish('log/info', newBlockLine);
  }

  submitNonce(submission, minerSoftware, options) {
    if (this.client.capacity !== options.capacity) {
      this.client.capacity = options.capacity;
    }
    this.client.submitNonce(
      submission.accountId,
      submission.height,
      submission.nonce.toString(),
      submission.deadline.toNumber()
    );
    const adjustedDL = submission.deadline.dividedBy(this.miningInfo.baseTarget).integerValue(BigNumber.ROUND_FLOOR);

    return {
      result: {
        result: 'success',
        deadline: adjustedDL.toNumber(),
      },
    };
  }

  getMiningInfo() {
    return this.miningInfo.toObject();
  }
}

module.exports = HDPool;