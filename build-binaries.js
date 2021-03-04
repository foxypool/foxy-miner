const { basename, dirname, join } = require('path');
const { createWriteStream, createReadStream, unlinkSync } = require('fs');
const { exec } = require('pkg');
const mkdirp = require('mkdirp');
const archiver = require('archiver');

const version = require('./lib/version');

(async () => {
  mkdirp.sync('builds');
  await exec([ '--output', `builds/foxy-miner-${version}.exe`, '--targets', 'node12-win-x64', '.' ]);
  await createZipArchiveWithFile(`builds/foxy-miner-${version}.exe`, 'windows');
  await exec([ '--output', `builds/foxy-miner-${version}`, '--targets', 'node12-linux-x64', '.' ]);
  await createZipArchiveWithFile(`builds/foxy-miner-${version}`, 'linux');
  await exec([ '--output', `builds/foxy-miner-${version}`, '--targets', 'node12-macos-x64', '.' ]);
  await createZipArchiveWithFile(`builds/foxy-miner-${version}`, 'macos');
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
