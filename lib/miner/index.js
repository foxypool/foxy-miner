const scavenger = require('./scavenger');
const conqueror = require('./conqueror');

const miner = {
  scavenger,
  conqueror,
};

const moduleExports = {
  miner,
  getMiner: ({ minerType }) => {
    if (!miner[minerType]) {
      throw new Error(`Unsupported miner type: ${minerType}`);
    }

    return miner[minerType];
  },
  getMinerDownloadInfo: ({ minerType }) => {
    const miner = moduleExports.getMiner({ minerType });
    if (!miner.downloadInfo) {
      throw new Error(`No download info available for ${minerType}`);
    }

    return miner.downloadInfo;
  },
};

module.exports = moduleExports;
