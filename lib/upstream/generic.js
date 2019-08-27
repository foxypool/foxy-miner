const EventEmitter = require('events');
const superagent = require('superagent');
const { hostname } = require('os');
const eventBus = require('../services/event-bus');
const config = require('../services/config');
const MiningInfo = require('../miningInfo');
const version = require('../version');
const outputUtil = require('../output-util');
const Base = require('./base');

class GenericUpstream extends Base {
  static hasUnicode(str) {
    for (let i = 0; i < str.length; i++) {
      if (str.charCodeAt(i) > 127) {
        return true;
      }
    }
    return false;
  }

  constructor(upstreamConfig) {
    super();
    this.upstreamName = outputUtil.getName(upstreamConfig);
    this.upstreamConfig = upstreamConfig;
    this.userAgent = `Foxy-Miner ${version}`;
    this.defaultMinerName = `${this.userAgent}/${hostname()}`;
    this.miningInfo = {height: 0, toObject: () => ({height: 0})};
  }

  async init() {
    await super.init();
    this.connected = false;
    await this.updateMiningInfo();
    const interval = this.upstreamConfig.updateMiningInfoInterval ? this.upstreamConfig.updateMiningInfoInterval : 1000;
    setInterval(this.updateMiningInfo.bind(this), interval);
  }

  async updateMiningInfo() {
    try {
      let request = superagent.get(`${this.upstreamConfig.url}/burst`).timeout({
        response: 20 * 1000,
        deadline: 30 * 1000,
      }).set('User-Agent', this.userAgent);

      let {text: result} = await request.query({requestType: 'getMiningInfo'});
      result = JSON.parse(result);
      this.connected = true;
      const miningInfo = new MiningInfo(result.height, result.baseTarget, result.generationSignature, result.targetDeadline, this.upstreamConfig.coin);
      if (miningInfo.height === this.miningInfo.height && miningInfo.baseTarget === this.miningInfo.baseTarget) {
        return;
      }

      this.dynamicTargetDeadline = null;
      if (this.useSubmitProbability && this.lastCapacity) {
        const totalCapacityInTiB = this.lastCapacity / 1024;
        this.dynamicTargetDeadline = Math.round(this.targetDLFactor * miningInfo.netDiff / totalCapacityInTiB);
        const dynamicTargetDeadlineFormatted = config.humanizeDeadlines ? outputUtil.getFormattedDeadline(this.dynamicTargetDeadline) : this.dynamicTargetDeadline;
        eventBus.publish('log/debug', `${this.upstreamName} | Submit Probability | Using targetDL ${dynamicTargetDeadlineFormatted}`);
      }

      this.miningInfo = miningInfo;
      this.emit('new-round', miningInfo);
      let newBlockLine = `${this.upstreamName} | ${outputUtil.getString(`New block ${miningInfo.height}, baseTarget ${miningInfo.baseTarget}, netDiff ${miningInfo.netDiffFormatted}`, 'green')}`;
      if (!config.compact && miningInfo.targetDeadline) {
        newBlockLine += outputUtil.getString(`, targetDL: ${miningInfo.targetDeadline}`, 'green');
      }
      eventBus.publish('log/info', newBlockLine);
    } catch (err) {
      const message = (err.timeout || err.message === 'Aborted') ? 'getMiningInfo request timed out' : err.message;
      eventBus.publish('log/debug', `${this.upstreamName} | Error: ${message}`);
      this.connected = false;
    }
  }

  async submitNonce(submission, minerSoftware, options) {
    const queryParams = {
      requestType: 'submitNonce',
      accountId: submission.accountId,
      nonce: submission.nonce.toString(),
      blockheight: submission.height,
    };
    if (submission.secretPhrase) {
      queryParams.secretPhrase = submission.secretPhrase;
    } else {
      queryParams.deadline = submission.deadline.toString()
    }

    try {
      let request = superagent.post(`${this.upstreamConfig.url}/burst`)
        .query(queryParams)
        .timeout({
          response: 30 * 1000,
          deadline: 45 * 1000,
        })
        .set('User-Agent', `${this.userAgent} | ${minerSoftware}`)
        .set('X-Capacity', options.capacity)
        .set('X-Miner', this.defaultMinerName)
        .set('X-MinerName', this.upstreamConfig.minerName || options.minerName || this.defaultMinerName)
        .set('X-Plotfile', `${this.defaultMinerName}`);

      const accountKey = options.accountKey || this.upstreamConfig.accountKey;
      if (accountKey) {
        request = request.set('X-Account', accountKey);
        request = request.set('X-AccountKey', accountKey);
      }
      let accountName = this.upstreamConfig.accountName || options.accountName || null;
      if (accountName) {
        if (GenericUpstream.hasUnicode(accountName)) {
          accountName = encodeURI(accountName);
        }
        request = request.set('X-AccountName', accountName);
      }
      const minerColor = this.upstreamConfig.minerColor || options.color || null;
      if (minerColor) {
        request = request.set('X-Color', minerColor);
      }

      let {text: result} = await request.retry(5, (err) => {
        if (!err) {
          return;
        }
        eventBus.publish('log/debug', `${this.upstreamName} | Error: Failed submitting DL ${submission.deadline.toString()}, retrying ..`);
        return true;
      });
      result = JSON.parse(result);

      return {
        error: null,
        result,
      };
    } catch (err) {
      let error = {
        message: 'error reaching upstream',
        code: 3,
      };
      if (err.response && err.response.error && err.response.error.text) {
        try {
          error = JSON.parse(err.response.error.text);
        } catch (e) {}
      }

      return {
        error,
      };
    }
  }

  getMiningInfo() {
    return this.miningInfo.toObject();
  }
}

module.exports = GenericUpstream;
