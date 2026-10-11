const fs = require('node:fs');
const app = JSON.parse(fs.readFileSync('app.json', 'utf8'));
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
const history = JSON.parse(fs.readFileSync('release-history.json', 'utf8'));
const previous = history.releases.at(-1);
const parse = version => {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) throw Error('Invalid semantic version: ' + version);
  const parts = version.split('.').map(Number);
  if (!parts.every(Number.isSafeInteger)) throw Error('Version exceeds safe integer range');
  return parts;
};
const compare = (a, b) => {
  const left = parse(a), right = parse(b);
  for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return left[i] - right[i];
  return 0;
};
// Preserve actual historical versions, including the short-lived 1.0.3 numbering rule.
const baseline = history.releases.map(r => r.version).sort(compare).at(-1);
const nextVersion = kind => {
  const parts = parse(baseline);
  const index = { major: 0, minor: 1, patch: 2 }[kind];
  if (index === undefined) throw Error('Choose major, minor or patch: npm run version:bump -- <kind>');
  parts[index]++;
  for (let i = index + 1; i < 3; i++) parts[i] = 0;
  return parts.join('.');
};
const action = process.argv[2];
if (action === 'bump') {
  const kind = process.argv[3];
  history.plannedRelease = { kind, version: nextVersion(kind), versionCode: previous.versionCode + 1 };
  app.expo.version = pkg.version = lock.version = lock.packages[''].version = history.plannedRelease.version;
  app.expo.android.versionCode = history.plannedRelease.versionCode;
  for (const [file, value] of [['app.json', app], ['package.json', pkg], ['package-lock.json', lock], ['release-history.json', history]]) {
    fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
  }
}
const plan = history.plannedRelease;
const published = !plan && action !== 'release';
if (!published && (!plan || plan.version !== nextVersion(plan.kind) || plan.versionCode !== previous.versionCode + 1 || history.releases.some(r => r.version === plan.version))) {
  throw Error('A new major/minor/patch release plan is required. Run npm run version:bump -- <kind>.');
}
const checkedVersion = published ? previous.version : plan.version;
const checkedCode = published ? previous.versionCode : plan.versionCode;
if (app.expo.version !== checkedVersion || pkg.version !== checkedVersion || lock.version !== checkedVersion || lock.packages[''].version !== checkedVersion || app.expo.android.versionCode !== checkedCode) {
  throw Error(`Version metadata must match ${checkedVersion}, Android versionCode ${checkedCode}.`);
}
console.log(`Version verified: ${checkedVersion}, Android versionCode ${checkedCode}`);
