const { basename, dirname, join } = require('path');
const { createWriteStream, createReadStream, unlinkSync, copyFileSync } = require('fs');
const { exec } = require('pkg');
const mkdirp = require('mkdirp');
const archiver = require('archiver');

const version = require('./lib/version');

const targetNodeVersion = '12';
const targets = [{
  fileName: 'foxy-miner.exe',
  platform: 'windows',
  pkgTarget: `node${targetNodeVersion}-win-x64`,
  includeGpuDetectionModule: true,
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
    await exec([ '--output', join('builds', target.fileName), '--targets', target.pkgTarget, '.' ]);
    if (target.includeGpuDetectionModule) {
      copyFileSync(join('node_modules', 'gpu-detection', 'native', 'gpu-detection.node'), join('builds', 'gpu-detection.node'));
    }
    await createZipArchiveForTarget(target);
  }
})();

async function createZipArchiveForTarget(target) {
  const filePath = join('builds', target.fileName);
  const directory = dirname(filePath);
  const fileName = basename(filePath);
  const zipFileStream = createWriteStream(join(directory, `foxy-miner-${version}-${target.platform}.zip`));
  const zipFileClosedPromise = new Promise(resolve => zipFileStream.once('close', resolve));
  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.pipe(zipFileStream);
  archive.append(createReadStream(filePath), { name: fileName });
  if (target.includeGpuDetectionModule) {
    archive.append(createReadStream(join('builds', 'gpu-detection.node')), { name: 'gpu-detection.node' });
  }
  await archive.finalize();
  await zipFileClosedPromise;
  unlinkSync(filePath);
  if (target.includeGpuDetectionModule) {
    unlinkSync(join('builds', 'gpu-detection.node'));
  }
}
