const fs = require('node:fs');
const app = JSON.parse(fs.readFileSync('app.json', 'utf8'));
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
const history = JSON.parse(fs.readFileSync('release-history.json', 'utf8'));
const previous = history.releases.at(-1);
const expected = history.baseVersion + '.' + (Number(previous.version.split('.').at(-1)) + 1);
const versionCode = previous.versionCode + 1;
if (process.argv[2] === 'bump') {
  app.expo.version = pkg.version = lock.version = lock.packages[''].version = expected;
  app.expo.android.versionCode = versionCode;
  for (const [file, value] of [['app.json', app], ['package.json', pkg], ['package-lock.json', lock]]) {
    fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
  }
}
// A completed release stays valid in the checkout; another APK must use the next number.
const published = process.argv[2] !== 'release' && pkg.version === previous.version;
const checkedVersion = published ? previous.version : expected;
const checkedCode = published ? previous.versionCode : versionCode;
if (app.expo.version !== checkedVersion || pkg.version !== checkedVersion || lock.version !== checkedVersion || lock.packages[''].version !== checkedVersion || app.expo.android.versionCode !== checkedCode) {
  throw new Error(`Next APK must be ${expected}, Android versionCode ${versionCode}. Run npm run version:bump.`);
}
console.log(`Version verified: ${checkedVersion}, Android versionCode ${checkedCode}`);
