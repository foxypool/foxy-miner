const chalk = require('chalk');
const moment = require('moment');
const store = require('./services/store');
const coinUtil = require('./coin-util');

module.exports = {
  getName(config) {
    if (!store.getUseColors()) {
      return config.name;
    }

    return `${config.color ? chalk.hex(config.color)(config.name) : config.name}`;
  },
  getString(text, color) {
    if (!store.getUseColors() || !color) {
      return text;
    }
    if (!color.startsWith('#')) {
      return chalk[color](text);
    }

    return chalk.hex(color)(text);
  },
  getFormattedDeadline(deadline) {
    const duration = moment.duration(deadline, 'seconds');
    if (duration.years() > 0) {
      return `${duration.years()}y ${duration.months()}m ${duration.days()}d ${duration.hours().toString().padStart(2, '0')}:${duration.minutes().toString().padStart(2, '0')}:${duration.seconds().toString().padStart(2, '0')}`;
    } else if (duration.months() > 0) {
      return `${duration.months()}m ${duration.days()}d ${duration.hours().toString().padStart(2, '0')}:${duration.minutes().toString().padStart(2, '0')}:${duration.seconds().toString().padStart(2, '0')}`;
    } else if (duration.days() > 0) {
      return `${duration.days()}d ${duration.hours().toString().padStart(2, '0')}:${duration.minutes().toString().padStart(2, '0')}:${duration.seconds().toString().padStart(2, '0')}`;
    }

    return `${duration.hours().toString().padStart(2, '0')}:${duration.minutes().toString().padStart(2, '0')}:${duration.seconds().toString().padStart(2, '0')}`;
  },
  getDeadlineColor(deadline, coin) {
    if (deadline === null) {
      return null;
    }
    const aMonth = 30 * 24 * 60 * 60;
    const tenMinutes = 10 * 60;
    const limit = coinUtil.modifyDeadline(aMonth, coin);
    const lowLimit = coinUtil.modifyDeadline(tenMinutes, coin);
    if (deadline <= lowLimit) {
      return '#00ffbb';
    }

    const percent = Math.min(Math.max((1 - (deadline / limit)), 0), 1);
    if (percent < 0.5) {
      return null;
    }
    const red = Math.max(Math.min(Math.floor(255 - ((percent * 2) - 1) * 255), 255), 0);
    const green = Math.max(Math.min(Math.floor(percent * 2 * 255), 255), 0);

    return `#${red.toString(16).padStart(2, '0')}${green.toString(16).padStart(2, '0')}00`;
  }
};