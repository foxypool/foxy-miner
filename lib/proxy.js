const GenericUpstream = require('./upstream/generic');
const SocketIo = require('./upstream/socketio');
const FoxyPool = require('./upstream/foxypool');
const Submission = require('./submission');
const CurrentRoundManager = require('./currentRoundManager');
const config = require('./services/config');
const profitabilityService = require('./services/profitability-service');
const eventBus = require('./services/event-bus');

class Proxy {
  static getUpstreamClass(type) {
    switch (type) {
      case 'foxypool':
        return FoxyPool;
      case 'socketio':
        return SocketIo;
      default:
        return GenericUpstream;
    }
  }

  constructor(upstreamConfigs) {
    this.upstreamConfigs = upstreamConfigs;
    this.currentRoundManager = new CurrentRoundManager(); // Default Round Manager
  }

  async init() {
    this.upstreams = await Promise.all(this.upstreamConfigs.map(async upstreamConfig => {
      const upstreamClass = Proxy.getUpstreamClass(upstreamConfig.type);
      const upstream = new upstreamClass(upstreamConfig);

      upstream.on('new-round', (miningInfo) => {
        if (config.useProfitability) {
          upstream.prio = profitabilityService.getProfitability(upstream.miningInfo, upstream.upstreamConfig.coin.toLowerCase(), upstream.upstreamConfig.blockReward);
          eventBus.publish('log/debug', `Profitability-Service | ${upstream.upstreamName} | Set prio ${upstream.prio}`);
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
