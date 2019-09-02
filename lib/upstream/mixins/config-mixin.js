const { hostname } = require('os');
const version = require('../../version');
const outputUtil = require('../../output-util');

module.exports = (upstreamClass) => class ConfigMixin extends upstreamClass {
  constructor(upstreamConfig, proxyIndex, minerColor) {
    super(upstreamConfig, proxyIndex, minerColor);
    this.proxyIndex = proxyIndex;
    this.minerColor = minerColor;
    this.upstreamName = outputUtil.getName(upstreamConfig);
    this.fullUpstreamName = proxyIndex ? `${outputUtil.getString(`Miner #${proxyIndex}`, this.minerColor)} | ${this.upstreamName}` : this.upstreamName;
    this.upstreamConfig = upstreamConfig;
    this.userAgent = `Foxy-Miner ${version}`;
    this.defaultMinerName = `${this.userAgent}/${hostname()}`;
    this.miningInfo = {height: 0, toObject: () => ({height: 0})};
    this.bestDL = null;
    this.roundStart = null;
    this.roundProgress = 0;
    this.on('new-round', () => {
      this.bestDL = null;
      this.roundProgress = 0;
      this.roundStart = new Date();
    });
  }

  get stats() {
    return {
      name: this.upstreamConfig.name,
      color: this.upstreamConfig.color,
      miningInfo: this.miningInfo,
      bestDL: this.bestDL,
      roundStart: this.roundStart,
      roundProgress: this.roundProgress,
      counter: 1,
      lastCapacity: this.lastCapacity || 0,
      miners: [],
    };
  }
};