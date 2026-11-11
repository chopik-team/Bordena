import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {nativeHost, root} from './native-host.mjs';
const host = await nativeHost({name:'aw006-baseline',port:9238});
try {
  const fixture = JSON.parse(await fs.readFile(path.join(root,'.tools/qa-aw005-payload.json'),'utf8'));
  await host.page.evaluate(async fixture => {
    const r=indexedDB.open('bordena'),db=await new Promise((ok,no)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
    await new Promise((ok,no)=>{
      const tx=db.transaction(['dashboards','columns','cards','sidebar','history','meta','bordena-blobs'],'readwrite');
      tx.oncomplete=ok;tx.onabort=tx.onerror=()=>no(tx.error);
      for(const name of ['dashboards','columns','cards','sidebar','history','bordena-blobs'])tx.objectStore(name).clear();
      for(const b of fixture.document.boards){tx.objectStore('dashboards').put(b.dashboard,b.dashboard.id);for(const c of b.columns)tx.objectStore('columns').put(c,c.id);for(const c of b.cards)tx.objectStore('cards').put(c,c.id)}
      tx.objectStore('sidebar').put({...fixture.document.workspace.sidebar,workspaces:fixture.document.organization.workspaces},'layout');
      for(const h of fixture.document.workspace.history)tx.objectStore('history').put(h,h.id);
      for(const a of fixture.document.attachmentsManifest){const file=fixture.files.find(f=>f.name===a.path);tx.objectStore('bordena-blobs').put(new Blob([new Uint8Array(file.bytes)],{type:file.type}),`${a.cardId}/${a.key}`)}
      tx.objectStore('meta').put(5,'bordena:model-revision');
    });db.close();
  },fixture);
  const data={profile:host.profile,document:fixture.document,files:fixture.files};
  const bytes=Buffer.from(JSON.stringify(data)),sha256=createHash('sha256').update(bytes).digest('hex');
  const target=path.join(root,'.tools/qa-aw006-aw005-backup.json');await fs.writeFile(target,bytes);
  if(createHash('sha256').update(await fs.readFile(target)).digest('hex')!==sha256)throw new Error('Backup verification failed');
  await fs.writeFile(path.join(root,'docs/evidence/aw006-baseline.json'),JSON.stringify({status:'PASS',profile:host.profile,backup:target,sha256,boards:fixture.document.boards.length,cards:fixture.document.boards.flatMap(b=>b.cards).length},null,2));
} finally {await host.close()}
