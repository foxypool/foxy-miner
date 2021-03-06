const { homedir } = require('os');
const { join } = require('path');

class Store {
  constructor() {
    this.useColors = true;
    this._logLevel = 'info';
    this._configFilePath = join(this.configDirectory, 'foxy-miner.yaml');
    this._useDashboard = false;
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

  get useDashboard() {
    return this._useDashboard;
  }

  set useDashboard(value) {
    this._useDashboard = value;
  }

  get configDirectory() {
    return join(homedir(), '.config', 'foxy-miner');
  }
}

module.exports = new Store();
