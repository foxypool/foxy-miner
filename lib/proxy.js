const BigNumber = require('bignumber.js');
const GenericUpstream = require('./upstream/generic');
const SocketIo = require('./upstream/socketio');
const FoxyPool = require('./upstream/foxypool');
const HDPool = require('./upstream/hdpool');
const Submission = require('./submission');
const CurrentRoundManager = require('./currentRoundManager');
const config = require('./services/config');
const profitabilityService = require('./services/profitability-service');
const eventBus = require('./services/event-bus');
const outputUtil = require('./output-util');

class Proxy {
  static getUpstreamClass(type) {
    switch (type) {
      case 'foxypool':
        return FoxyPool;
      case 'socketio':
        return SocketIo;
      case 'hdpool':
      case 'hdpool-eco':
        return HDPool;
      default:
        return GenericUpstream;
    }
  }

  constructor({upstreamConfigs, proxyIndex, miner, showProxyIndex = false, minerColor}) {
    this.proxyIndex = proxyIndex;
    this.miner = miner;
    this.minerColor = minerColor;
    this.showProxyIndex = showProxyIndex;
    this.upstreamConfigs = upstreamConfigs;
    this.currentRoundManager = new CurrentRoundManager(this.miner); // Default Round Manager
    const assumeScannedAfter = upstreamConfigs.assumeScannedAfter || config.config.upstreamConfigs;
    if (assumeScannedAfter) {
      this.miner.subscribe('new-round', async (miningInfo) => {
        await new Promise(resolve => setTimeout(resolve, assumeScannedAfter * 1000));
        this.miner.publish('round-finished', miningInfo.height);
      });
    }
    this.miner.subscribe('log', this.onMinerLog.bind(this));
  }

  onMinerLog(logLevel, msg, resetCursor) {
    const fullMessage = this.showProxyIndex ? `${outputUtil.getString(`Miner #${this.proxyIndex}`, this.minerColor)} | ${msg}` : msg;
    eventBus.publish(`log/${logLevel}`, fullMessage, resetCursor);
  }

  async init() {
    this.upstreams = await Promise.all(this.upstreamConfigs.map(async upstreamConfig => {
      if (upstreamConfig.type === 'hdpool-eco') {
        upstreamConfig.useEcoPool = true;
      }
      const upstreamClass = Proxy.getUpstreamClass(upstreamConfig.type);
      const upstream = new upstreamClass(upstreamConfig, this.showProxyIndex ? this.proxyIndex : false, this.minerColor);

      upstream.on('new-round', (miningInfo) => {
        if (config.useProfitability) {
          upstream.weight = profitabilityService.getProfitability(upstream.miningInfo, upstream.upstreamConfig.coin.toLowerCase(), upstream.upstreamConfig.blockReward);
          const realWeight = (upstream.weight || upstreamConfig.prio || upstream.upstreamConfig.weight || 10);
          eventBus.publish('log/debug', `${upstream.fullUpstreamName} | Profitability-Service | Set weight ${realWeight}`);
        }
        if (this.upstreams && config.maxNumberOfChains) {
          const weight = (upstream.weight || upstream.upstreamConfig.prio || upstream.upstreamConfig.weight) || 10;
          const upstreamsWithWeight = this.upstreams
            .map(upstream => [upstream, (upstream.weight || upstream.upstreamConfig.prio || upstream.upstreamConfig.weight) || 10])
            .sort((a, b) => b[1] - a[1])
            .slice(0, config.maxNumberOfChains)
            .reverse();
          if (!upstreamsWithWeight.some(upstreamWithWeight => upstreamWithWeight[0] === upstream) && weight <= upstreamsWithWeight[0][1]) {
            eventBus.publish('log/debug', `${upstream.fullUpstreamName} | Not queuing new block because maxNumberOfChains is set to ${config.maxNumberOfChains} and the weight is too low`);
            return;
          }
        }
        this.currentRoundManager.addNewRound(upstream, miningInfo);
      });

      await upstream.init();

      return upstream;
    }));
  }

  getMiningInfo() {
    return this.currentRoundManager.getMiningInfo();
  }

  getUpstreamForHeight(height) {
    return this.upstreams.find(upstream => upstream.getMiningInfo().height === height);
  }

  async submitNonce(submissionObj, options) {
    const blockHeight = submissionObj.blockheight || this.currentRoundManager.getMiningInfo().height;
    const submission = new Submission(
      submissionObj.accountId,
      blockHeight,
      submissionObj.nonce,
      submissionObj.deadline,
      submissionObj.secretPhrase
    );
    const minerSoftware = options.userAgent || options.miner || 'unknown';

    if (!submission.isValid()) {
      return {
        error:  {
          message: 'submission has wrong format',
          code: 1,
        },
      };
    }
    const upstream = this.getUpstreamForHeight(submission.height);
    if (!upstream) {
      return {
        error: {
          message: 'submission is for different round',
          code: 2,
        },
      };
    }

    upstream.lastCapacity = options.capacity;
    const adjustedDL = submission.deadline.dividedBy(upstream.miningInfo.baseTarget).integerValue(BigNumber.ROUND_FLOOR);
    if (upstream.bestDL === null || adjustedDL.toNumber() < upstream.bestDL) {
      upstream.bestDL = adjustedDL.toNumber();
    }
    if (upstream.upstreamConfig.targetDL && adjustedDL > upstream.upstreamConfig.targetDL) {
      return {
        result: 'success',
        deadline: adjustedDL.toNumber(),
      };
    }
    if (upstream.dynamicTargetDeadline && adjustedDL.toNumber() > upstream.dynamicTargetDeadline) {
      return {
        result: 'success',
        deadline: adjustedDL.toNumber(),
      };
    }

    const result = await upstream.submitNonce(submission, minerSoftware, options);
    if (result.error) {
      return {
        error: result.error,
      };
    }

    return result.result;
  }
}

module.exports = Proxy;
