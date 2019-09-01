class Store {
  constructor() {
    this.useColors = true;
    this._logLevel = 'info';
    this._configFilePath = 'config.yaml';
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

  get configFilePath() {
    return this._configFilePath;
  }

  set configFilePath(configFilePath) {
    this._configFilePath = configFilePath;
  }
}

module.exports = new Store();
