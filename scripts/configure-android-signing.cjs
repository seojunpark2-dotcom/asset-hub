const fs = require('node:fs');
const file = 'android/app/build.gradle';
for (const key of ['ANDROID_KEYSTORE_PATH','ANDROID_KEYSTORE_PASSWORD','ANDROID_KEY_ALIAS','ANDROID_KEY_PASSWORD']) {
  if (!process.env[key]) throw new Error(`Missing signing environment variable: ${key}`);
}
let source = fs.readFileSync(file, 'utf8');
if (!source.includes('signingConfigs {') || !/release\s*\{[\s\S]*?signingConfig signingConfigs.debug/.test(source)) {
  throw new Error('Generated Android signing configuration changed; review before publishing');
}
source = source.replace(/(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs.debug/, '$1signingConfig signingConfigs.release');
source = source.replace('signingConfigs {', `signingConfigs {
        release {
            storeFile file(System.getenv('ANDROID_KEYSTORE_PATH'))
            storePassword System.getenv('ANDROID_KEYSTORE_PASSWORD')
            keyAlias System.getenv('ANDROID_KEY_ALIAS')
            keyPassword System.getenv('ANDROID_KEY_PASSWORD')
        }`);
if ((source.match(/signingConfig signingConfigs.release/g) ?? []).length !== 1) throw new Error('Release signing replacement failed');
fs.writeFileSync(file, source);
console.log('Release signing configured through environment variables');
