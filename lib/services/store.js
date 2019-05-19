class Store {
  constructor() {
    this.useColors = true;
    this._logLevel = 'info';
  }

  getUseColors() {
    return this.useColors;
  }

  setUseColors(useColors) {
    this.useColors = useColors;
  }

  get logLevel() {
    return this._logLevel;
  }

  set logLevel(logLevel) {
    this._logLevel = logLevel;
  }
}

module.exports = new Store();
