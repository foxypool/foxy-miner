const Scavenger = require('./scavenger');
const ScavengerConfigGenerator = require('./scavenger-config-generator');

module.exports  = {
  Miner: Scavenger,
  ConfigGenerator: ScavengerConfigGenerator,
  minerType: 'scavenger',
  downloadInfo: {
    version: '1.7.8',
  },
};
