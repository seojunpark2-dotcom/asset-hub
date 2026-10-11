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
if (app.expo.version !== expected || pkg.version !== expected || lock.version !== expected || lock.packages[''].version !== expected || app.expo.android.versionCode !== versionCode) {
  throw new Error(`Next APK must be ${expected}, Android versionCode ${versionCode}. Run npm run version:bump.`);
}
console.log(`Version verified: ${expected}, Android versionCode ${versionCode}`);
