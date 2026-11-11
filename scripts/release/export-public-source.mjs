import fs from 'node:fs';import path from 'node:path';import {createHash}from'node:crypto';import {fileURLToPath}from'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));const output=path.join(root,'.tools/public-source-w10-20261111');
if(fs.existsSync(output))throw Error('Public snapshot already exists; inspect and reuse deliberately instead of deleting it');
const files=['.editorconfig','.gitignore','.npmrc','.nvmrc','.prettierignore','AGENTS.md','README.md','CONTRIBUTING.md','SECURITY.md','ROADMAP.md','LICENSE','NOTICE.md','CHANGELOG.md','CHANGELOG.en.md','package.json','pnpm-lock.yaml','pnpm-workspace.yaml','turbo.json','dev.bat','Bordena.bat',
 'docs/VERSIONING.md','docs/USER_GUIDE.ru.md','docs/USER_GUIDE.en.md','docs/THIRD_PARTY_LICENSES.md','docs/THIRD_PARTY_NOTICES.txt','docs/RUST_THIRD_PARTY_NOTICES.txt','docs/BORDENA_W10_RELEASE_REPORT.md','docs/BORDENA_W10_RELEASE_CHECKLIST.md','docs/evidence/frontend-packages.json','docs/evidence/rust-packages.json'];
const skip=new Set(['.git','.tools','node_modules','target','dist','.turbo','gen']);
function walk(rel){for(const e of fs.readdirSync(path.join(root,rel),{withFileTypes:true})){if(skip.has(e.name))continue;const f=path.join(rel,e.name);if(e.isSymbolicLink())throw Error('Unexpected source symlink: '+f);if(e.isDirectory())walk(f);else if(!/\.(log|tsbuildinfo|dpapi|pem|pfx|p12|dmp)$/.test(e.name)&&(!e.name.startsWith('.env')||e.name==='.env.example'))files.push(f)}}
for(const dir of ['apps/client','apps/desktop','packages','scripts','assets','integrations','tools/release-verify','.github/workflows','docs/licenses','docs/releases'])walk(dir);
const hash=b=>createHash('sha256').update(b).digest('hex'),inventory=[];
for(const rel of [...new Set(files)].sort()){
 const source=path.join(root,rel);if(!fs.existsSync(source))throw Error('Required public source missing: '+rel);
 const bytes=fs.readFileSync(source);
 if(!/\.(png|ico|woff2?|jpg|jpeg|gif|webp)$/i.test(rel)){
  const text=bytes.toString('utf8');
  if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|github_pat_[A-Za-z0-9_]{30,}|\bgh[pousr]_[A-Za-z0-9_]{25,}/.test(text))throw Error('Potential secret requires review: '+rel);
 }
 const target=path.join(output,rel);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);if(hash(fs.readFileSync(target))!==hash(bytes))throw Error('Source copy readback differs');inventory.push({file:rel.replaceAll('\\','/'),bytes:bytes.length,sha256:hash(bytes)});
}
const report={status:'SOURCE_EXPORTED_NOT_PUBLISHED',output,files:inventory.length,totalBytes:inventory.reduce((n,f)=>n+f.bytes,0),excluded:['.git history','.tools profiles/toolchains/keys','artifacts','private QA evidence','internal master tasks/design references/personal reports'],inventory};
fs.writeFileSync(path.join(root,'docs/evidence/w10-public-source.json'),JSON.stringify(report,null,2));console.log({output,files:report.files,totalBytes:report.totalBytes});
