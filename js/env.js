const path = require('path');
const ext = process.platform === 'win32' ? '.exe' : '';

process.env['MAGICK_HOME'] = path.join(
  __dirname,
  '..',
  'libs',
  process.platform,
  'imagemagick',
  'bin'
);

process.env['DYLD_LIBRARY_PATH'] = path.join(
  __dirname,
  'libs',
  process.platform,
  'imagemagick',
  'lib'
);

if (process.platform !== 'linux' && process.platform !== 'darwin' && process.platform !== 'win32') {
  console.error('Unsupported platform.');
  process.exit(1);
}

if (process.platform === 'darwin' && process.arch !== 'x64') {
  console.error('Unsupported architecture.');
  process.exit(1);
}

var imagemagickPath = path.join(
  __dirname,
  '..',
  'libs',
  process.platform,
  'imagemagick',
  'bin'
);

exports.path = imagemagickPath;