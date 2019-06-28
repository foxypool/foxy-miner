const Miner = require('./miner');

class Conqueror extends Miner {
  constructor(binPath, configPath = null) {
    super(binPath, configPath);
    this.roundFinishedString = 'conquest finished';
  }
}

module.exports = Conqueror;
