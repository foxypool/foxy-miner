const Capacity = require('./capacity');

module.exports = class MiningInfo {
  constructor({
    height,
    baseTarget,
    generationSignature,
    targetDeadline = null,
    miningHalted = false,
    coin = null,
    showSodiumStats = false,
  }) {
    this._height = parseInt(height, 10);
    this._baseTarget = parseInt(baseTarget, 10);
    this._generationSignature = generationSignature;
    this._targetDeadline = targetDeadline >= Number.MAX_SAFE_INTEGER ? Number.MAX_SAFE_INTEGER : targetDeadline;
    this._miningHalted = miningHalted;
    this._coin = coin;
    this._showSodiumStats = showSodiumStats;
  }

  static blockZeroBaseTarget(coin) {
    switch (coin) {
      case 'BHD':
        return 24433591728;
      case 'AETH':
      case 'LHD':
      case 'HDD':
      case 'XHD':
        return 14660155037;
      default:
        return 18325193796;
    }
  }

  get blockZeroBaseTarget() {
    return MiningInfo.blockZeroBaseTarget(this._coin);
  }

  get height() {
    return this._height;
  }

  get baseTarget() {
    return this._baseTarget;
  }

  get generationSignature() {
    return this._generationSignature;
  }

  get targetDeadline() {
    return this._targetDeadline;
  }

  get netDiff() {
    if (this._showSodiumStats) {
      return Math.round(this.blockZeroBaseTarget / (1.83 * this.baseTarget));
    } else {
      return Math.round(this.blockZeroBaseTarget / this.baseTarget);
    }
  }

  get netDiffFormatted() {
    return Capacity.fromTiB(this.netDiff).toString();
  }

  get miningHalted() {
    return this._miningHalted;
  }

  set miningHalted(value) {
    this._miningHalted = value;
  }

  toObject() {
    const obj = {
      height: this.height,
      baseTarget: this.baseTarget,
      generationSignature: this.generationSignature,
    };
    if (this.targetDeadline) {
      obj.targetDeadline = this.targetDeadline;
    }
    if (this.miningHalted) {
      obj.miningHalted = this.miningHalted;
    }

    return obj;
  }
};
