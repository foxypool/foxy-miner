const { existsSync, writeFileSync, readFileSync } = require('fs');
const { homedir } = require('os');
const { join } = require('path');
const mkdirp = require('mkdirp');

const { getMiner } = require('../');

class ConfigManager {
  ensureMinerConfigExists({ minerType, config = {}, minerIndex = null }) {
    const minerConfigPath = this.getMinerConfigPath({ minerType, minerIndex });
    if (existsSync(minerConfigPath)) {
      return;
    }
    const miner = getMiner({ minerType });
    if (!miner.ConfigGenerator) {
      throw new Error(`No config generator available for ${minerType}`);
    }
    const minerConfigs = config.miner || [];
    const minerConfig = minerIndex !== null ? minerConfigs[minerIndex] : {};

    const configGenerator = new miner.ConfigGenerator({ config });
    const minerConfigYaml = configGenerator.generate({ minerConfig, minerIndex });

    mkdirp.sync(this.configDirectory, { mode: 0o770 });
    writeFileSync(minerConfigPath, minerConfigYaml, 'utf8');
  }

  updateMinerConfig({ minerType, config = {}, minerIndex = null }) {
    const minerConfigPath = this.getMinerConfigPath({ minerType, minerIndex });
    if (!existsSync(minerConfigPath)) {
      return;
    }
    const miner = getMiner({ minerType });
    if (!miner.ConfigGenerator) {
      throw new Error(`No config generator available for ${minerType}`);
    }
    const minerConfigs = config.miner || [];
    const minerConfig = minerIndex !== null ? minerConfigs[minerIndex] : {};

    const configGenerator = new miner.ConfigGenerator({ config });

    const configYaml = readFileSync(minerConfigPath, 'utf8');
    const updatedConfigYaml = configGenerator.updateConfig({ configYaml, minerConfig, minerIndex });
    if (configYaml !== updatedConfigYaml) {
      writeFileSync(minerConfigPath, updatedConfigYaml, 'utf8');
    }
  }

  getMinerConfigPath({ minerType, minerIndex = null }) {
    return join(this.configDirectory, this.getMinerConfigName({ minerType, minerIndex }));
  }

  getMinerConfigName({ minerType, minerIndex = null }) {
    if (minerIndex !== null) {
      return `${minerType}-${minerIndex + 1}.yaml`;
    }

    return `${minerType}.yaml`;
  }

  get configDirectory() {
    return join(homedir(), '.config', 'foxy-miner', 'miner', 'configs');
  }
}

module.exports = new ConfigManager();
