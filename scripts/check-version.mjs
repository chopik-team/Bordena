import fs from 'node:fs';
import assert from 'node:assert/strict';
import {displayVersion} from '../packages/utils/src/versions.ts';

const root = new URL('../', import.meta.url);
const read = file => fs.readFileSync(new URL(file, root), 'utf8');
const {version} = JSON.parse(read('package.json'));
assert.match(version, /^\d+\.\d+\.\d+$/);
const label = displayVersion(version);
const manifests = ['apps/client/package.json', 'apps/desktop/package.json',
  ...fs.readdirSync(new URL('packages/', root)).map(name => `packages/${name}/package.json`)
    .filter(file => fs.existsSync(new URL(file, root)))];
for (const file of manifests) assert.equal(JSON.parse(read(file)).version, version, file);
for (const file of ['apps/desktop/src-tauri/Cargo.toml', 'apps/desktop/src-tauri/Cargo.lock']) {
  assert.equal(read(file).match(/name = "bordena"\r?\nversion = "([^"]+)"/)[1], version, file);
}
assert.equal(JSON.parse(read('apps/desktop/src-tauri/tauri.conf.json')).version, '../../../package.json');
for (const file of ['README.md', 'AGENTS.md', 'docs/USER_GUIDE.ru.md', 'docs/USER_GUIDE.en.md']) {
  assert.ok(read(file).split('\n')[0].includes(`Bordena ${label}`), file);
}
for (const file of ['CHANGELOG.md', 'CHANGELOG.en.md']) {
  assert.ok(read(file).includes(`## ${label}\n`), file);
  assert.doesNotMatch(read(file), /^## .*\d{4}-\d\d-\d\d/m);
  assert.doesNotMatch(read(file), /AW0\.\d+/);
}
console.log(`PASS: Bordena ${label}; Windows/SemVer ${version}; ${manifests.length + 1} package manifests agree.`);
