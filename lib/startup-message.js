const outputUtil = require('./output-util');

module.exports = () => {
  console.log(` ${outputUtil.getString('______  ______   __  __   __  __', '#ff4f19')}       ${outputUtil.getString('__    __   __   __   __   ______   ______', '#ff7a53')}\n` +
    `${outputUtil.getString('/\\  ___\\/\\  __ \\ /\\_\\_\\_\\ /\\ \\_\\ \\', '#ff4f19')}     ${outputUtil.getString('/\\ "-./  \\ /\\ \\ /\\ "-.\\ \\ /\\  ___\\ /\\  == \\', '#ff7a53')}   \n` +
    `${outputUtil.getString('\\ \\  __\\\\ \\ \\/\\ \\\\/_/\\_\\/_\\ \\____ \\', '#ff4f19')}    ${outputUtil.getString('\\ \\ \\-./\\ \\\\ \\ \\\\ \\ \\-.  \\\\ \\  __\\ \\ \\  __<', '#ff7a53')}  \n` +
    ` ${outputUtil.getString('\\ \\_\\   \\ \\_____\\ /\\_\\/\\_\\\\/\\_____\\', '#ff4f19')}    ${outputUtil.getString('\\ \\_\\ \\ \\_\\\\ \\_\\\\ \\_\\\\"\\_\\\\ \\_____\\\\ \\_\\ \\_\\', '#ff7a53')} \n` +
    `  ${outputUtil.getString('\\/_/    \\/_____/ \\/_/\\/_/ \\/_____/', '#ff4f19')}     ${outputUtil.getString('\\/_/  \\/_/ \\/_/ \\/_/ \\/_/ \\/_____/ \\/_/ /_/', '#ff7a53')}\n\n` +
    `                   ${outputUtil.getString('BHD:   33fKEwAHxVwnrhisREFdSNmZkguo76a2ML', '#f99320')}\n` +
    `                   ${outputUtil.getString('SIGNA: S-BVUD-7VWE-HD7F-6RX4P', '#0099ff')}\n`);
};
