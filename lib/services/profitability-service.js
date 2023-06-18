const CoinGecko = require('./coin-gecko');

class ProfitabilityService {
  constructor() {
    this.coinGecko = new CoinGecko();
    this.rates = {};
  }

  getBlockReward(miningInfo, coin) {
    switch (coin) {
      case 'burst':
      case 'signa':
        const month = Math.floor(miningInfo.height / 10800);
        return Math.floor(10000 * Math.pow(95, month) / Math.pow(100, month));
    }

    return 0;
  }

  async init(useEcoBlockRewards) {
    this.useEcoBlockRewards = useEcoBlockRewards;
    await this.updateRates();
    setInterval(this.updateRates.bind(this), 5 * 60 * 1000);
  }

  async updateRates() {
    try {
      const rates = await this.coinGecko.getRates(['signum']);
      this.rates.signa = rates.signum.usd;
      this.rates.burst = this.rates.signa;
    } catch (err) {}
  }

  getRate(symbol) {
    return this.rates[symbol];
  }

  getProfitability(miningInfo, coin, blockReward) {
    const rate = this.getRate(coin);
    if (!rate) {
      return 0;
    }

    if (!blockReward) {
      blockReward = this.getBlockReward(miningInfo, coin);
    }

    return Math.round((Math.pow(1024, 2) / miningInfo.netDiff) * 100 * blockReward * rate);
  }
}

module.exports = new ProfitabilityService();
