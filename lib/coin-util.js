const coinUtil = {
  blockTime(coin) {
    switch (coin) {
      default:
        return 240;
    }
  },
  blockZeroBaseTarget(coin) {
    switch (coin) {
      default:
        return 18325193796;
    }
  },
  modifyDeadline(deadline, coin) {
    if (coin !== 'BURST' && coin !== 'SIGNA') {
      return deadline;
    }

    return Math.floor(Math.log(deadline) * (this.blockTime(coin) / Math.log(this.blockTime(coin))));
  },
  modifyNetDiff(netDiff, coin) {
    if (coin !== 'BURST' && coin !== 'SIGNA') {
      return netDiff;
    }

    return Math.round(netDiff / 1.83);
  }
};

module.exports = coinUtil;
