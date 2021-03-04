const { basename, dirname, join } = require('path');
const { createWriteStream, createReadStream, unlinkSync } = require('fs');
const { exec } = require('pkg');
const mkdirp = require('mkdirp');
const archiver = require('archiver');

const version = require('./lib/version');

const targetNodeVersion = '12';
const targets = [{
  fileName: 'foxy-miner.exe',
  platform: 'windows',
  pkgTarget: `node${targetNodeVersion}-win-x64`,
}, {
  fileName: 'foxy-miner',
  platform: 'linux',
  pkgTarget: `node${targetNodeVersion}-linux-x64`,
}, {
  fileName: 'foxy-miner',
  platform: 'macos',
  pkgTarget: `node${targetNodeVersion}-macos-x64`,
}];

(async () => {
  mkdirp.sync('builds');
  for (let target of targets) {
    await exec([ '--output', `builds/${target.fileName}`, '--targets', target.pkgTarget, '.' ]);
    await createZipArchiveWithFile(`builds/${target.fileName}`, target.platform);
  }
})();

async function createZipArchiveWithFile(filePath, platform) {
  const directory = dirname(filePath);
  const fileName = basename(filePath);
  const zipFileStream = createWriteStream(join(directory, `foxy-miner-${version}-${platform}.zip`));
  const zipFileClosedPromise = new Promise(resolve => zipFileStream.once('close', resolve));
  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.pipe(zipFileStream);
  archive.append(createReadStream(filePath), { name: fileName });
  await archive.finalize();
  await zipFileClosedPromise;
  unlinkSync(filePath);
}
