const BigNumber = require('bignumber.js');
const GenericUpstream = require('./upstream/generic');
const SocketIo = require('./upstream/socketio');
const FoxyPool = require('./upstream/foxypool');
const FoxyPoolMulti = require('./upstream/foxy-pool-multi');
const Submission = require('./submission');
const CurrentRoundManager = require('./currentRoundManager');
const config = require('./services/config');
const profitabilityService = require('./services/profitability-service');
const eventBus = require('./services/event-bus');
const outputUtil = require('./output-util');
const coinUtil = require('./coin-util');

class Proxy {
  static getUpstreamClass(upstreamConfig) {
    if (upstreamConfig.type === 'foxypool' && upstreamConfig.url) {
      return FoxyPool;
    } else if (upstreamConfig.type === 'foxypool' && upstreamConfig.coin) {
      return FoxyPoolMulti;
    } else if (upstreamConfig.type === 'socketio') {
      return SocketIo;
    }

    return GenericUpstream;
  }

  constructor({upstreamConfigs, proxyIndex, miner, showProxyIndex, minerConfig}) {
    this.proxyIndex = proxyIndex;
    this.miner = miner;
    this.minerConfig = minerConfig;
    this.minerColor = minerConfig.minerColor;
    this.showProxyIndex = showProxyIndex;
    this.upstreamConfigs = upstreamConfigs;
    this.currentRoundManager = new CurrentRoundManager(this.miner); // Default Round Manager
    const assumeScannedAfter = this.minerConfig.assumeScannedAfter || config.config.assumeScannedAfter;
    if (assumeScannedAfter) {
      let timeout = null;
      this.miner.subscribe('new-round', async (miningInfo) => {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        timeout = setTimeout(() => {
          this.miner.publish('round-finished', miningInfo.height);
          timeout = null;
        }, assumeScannedAfter * 1000);
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
      const upstreamClass = Proxy.getUpstreamClass(upstreamConfig);
      const upstream = new upstreamClass(upstreamConfig, this.showProxyIndex ? this.proxyIndex : false, this.minerColor);

      upstream.on('new-round', (miningInfo) => {
        this.currentRoundManager.removeOldRoundsFromUpstream(upstream);
        if (config.useProfitability) {
          upstream.weight = profitabilityService.getProfitability(upstream.miningInfo, upstream.upstreamConfig.coin.toLowerCase(), upstream.upstreamConfig.blockReward);
          eventBus.publish('log/debug', `${upstream.fullUpstreamName} | Profitability-Service | Got weight ${upstream.weight}`);
        }
        if (upstream.upstreamConfig.allowMiningToBeHalted && miningInfo.miningHalted) {
          eventBus.publish('log/info', `${upstream.fullUpstreamName} | Not queuing new block because mining is halted for this round`);
          return;
        }
        const weight = (upstreamConfig.weight || upstreamConfig.prio || upstream.weight) || 10;
        if (upstreamConfig.minWeight && upstreamConfig.minWeight > weight) {
          eventBus.publish('log/info', `${upstream.fullUpstreamName} | Not queuing new block because minWeight is set to ${upstreamConfig.minWeight} and the weight is too low`);
          return;
        }
        if (this.upstreams && config.maxNumberOfChains) {
          const upstreamsWithWeight = this.upstreams
            .map(upstream => [upstream, (upstream.upstreamConfig.weight || upstream.upstreamConfig.prio || upstream.weight) || 10])
            .sort((a, b) => b[1] - a[1])
            .slice(0, config.maxNumberOfChains)
            .reverse();
          if (!upstreamsWithWeight.some(upstreamWithWeight => upstreamWithWeight[0] === upstream) && weight <= upstreamsWithWeight[0][1]) {
            eventBus.publish('log/info', `${upstream.fullUpstreamName} | Not queuing new block because maxNumberOfChains is set to ${config.maxNumberOfChains} and the weight is too low`);
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
    const modifiedAdjustedDL = coinUtil.modifyDeadline(adjustedDL.toNumber(), upstream.upstreamConfig.coin);
    if (upstream.bestDL === null || modifiedAdjustedDL < upstream.bestDL) {
      upstream.bestDL = modifiedAdjustedDL;
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
