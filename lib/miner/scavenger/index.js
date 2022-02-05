const { type: os } = require('os');

const Scavenger = require('./scavenger');
const ScavengerConfigGenerator = require('./scavenger-config-generator');

module.exports  = {
  Miner: Scavenger,
  ConfigGenerator: ScavengerConfigGenerator,
  minerType: 'scavenger',
  supportsManagement: true,
  downloadInfo: {
    version: os() === 'Darwin' ? '1.7.8' : '1.9.0',
  },
};
