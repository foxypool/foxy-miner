const chalk = require('chalk');
const moment = require('moment');
const store = require('./services/store');

function getName(config) {
  if (!store.getUseColors()) {
    return config.name;
  }

  return `${config.color ? chalk.hex(config.color)(config.name) : config.name}`;
}

function getString(text, color) {
  if (!store.getUseColors() || !color) {
    return text;
  }
  if (!color.startsWith('#')) {
    return chalk[color](text);
  }

  return chalk.hex(color)(text);
}

function getFormattedDeadline(deadline) {
  const duration = moment.duration(deadline, 'seconds');
  if (duration.years() > 0) {
    return `${duration.years()}y ${duration.months()}m ${duration.days()}d ${duration.hours().toString().padStart(2, '0')}:${duration.minutes().toString().padStart(2, '0')}:${duration.seconds().toString().padStart(2, '0')}`;
  } else if (duration.months() > 0) {
    return `${duration.months()}m ${duration.days()}d ${duration.hours().toString().padStart(2, '0')}:${duration.minutes().toString().padStart(2, '0')}:${duration.seconds().toString().padStart(2, '0')}`;
  } else if (duration.days() > 0) {
    return `${duration.days()}d ${duration.hours().toString().padStart(2, '0')}:${duration.minutes().toString().padStart(2, '0')}:${duration.seconds().toString().padStart(2, '0')}`;
  }

  return `${duration.hours().toString().padStart(2, '0')}:${duration.minutes().toString().padStart(2, '0')}:${duration.seconds().toString().padStart(2, '0')}`;
}

module.exports = {
  getName,
  getString,
  getFormattedDeadline,
};