const { hostname } = require('os');
const version = require('../../version');
const outputUtil = require('../../output-util');

module.exports = (upstreamClass) => class ConfigMixin extends upstreamClass {
  constructor(upstreamConfig, proxyIndex) {
    super(upstreamConfig, proxyIndex);
    this.upstreamName = outputUtil.getName(upstreamConfig);
    this.fullUpstreamName = proxyIndex ? `Miner #${proxyIndex} | ${this.upstreamName}` : this.upstreamName;
    this.upstreamConfig = upstreamConfig;
    this.userAgent = `Foxy-Miner ${version}`;
    this.defaultMinerName = `${this.userAgent}/${hostname()}`;
    this.miningInfo = {height: 0, toObject: () => ({height: 0})};
  }
};