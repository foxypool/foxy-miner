const Miner = require('../miner');

class Conqueror extends Miner {
  constructor(binPath, configPath = null, outputToConsole = false) {
    super(binPath, configPath, outputToConsole);
    this.software = 'conqueror';
    this.roundFinishedString = 'conquest finished';
  }
}

module.exports = Conqueror;
