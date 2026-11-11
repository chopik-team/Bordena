import fs from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {expect} from '@playwright/test';
import {nativeHost,root,delay} from './native-host.mjs';

const report={status:'RUNNING',checks:[],performance:{}},profile=path.join(root,'.tools','qa-aw006-embedded-'+Date.now());
let host;
const go=async url=>{await host.page.evaluate(url=>{history.pushState(null,'',url);dispatchEvent(new PopStateEvent('popstate'))},url);await delay(100)};
async function snapshot(){return host.page.evaluate(async()=>{
  const request=indexedDB.open('bordena'),db=await new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
  const read=store=>new Promise((resolve,reject)=>{const r=db.transaction(store).objectStore(store).getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
  const result={};for(const store of ['dashboards','columns','cards','sidebar','history'])result[store]=(await read(store)).sort((a,b)=>a.id.localeCompare(b.id));
  const tx=db.transaction('meta'),get=tx.objectStore('meta').get('bordena:exchange');result.exchange=await new Promise(resolve=>{get.onsuccess=()=>resolve(get.result)});
  const blobs=await read('bordena-blobs');result.blobs=await Promise.all(blobs.map(async blob=>({size:blob.size,sha256:[...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(b=>b.toString(16).padStart(2,'0')).join('')})));result.blobs.sort((a,b)=>a.sha256.localeCompare(b.sha256));db.close();return result;
})}

try{
  const fixture=JSON.parse(await fs.readFile(path.join(root,'.tools/qa-aw005-payload.json'),'utf8'));
  const goal=fixture.document.boards.find(b=>b.dashboard.goalPath);
  if(fixture.document.schemaVersion!==5||!goal)throw new Error('Run the native AW005 feature QA first');
  host=await nativeHost({name:'aw006-embedded',profile,port:9236});report.profile=profile;
  report.performance.freshMemory=JSON.parse((await promisify(execFile)('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(root,'scripts/measure-native-memory.ps1'),'-Profile',path.join(profile,'WebView2')])).stdout);
  // Fixture setup only: native feature QA already exercised real export/import services.
  // nativeHost has verified this fresh .tools/qa-* storage_profile before any write.
  await host.page.evaluate(async fixture=>{
    const request=indexedDB.open('bordena'),db=await new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)}),stores=['dashboards','columns','cards','sidebar','history','meta','bordena-blobs'];
    await new Promise((resolve,reject)=>{const tx=db.transaction(stores,'readwrite',{durability:'strict'});tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(tx.error);for(const name of stores)tx.objectStore(name).clear();
      for(const board of fixture.document.boards){tx.objectStore('dashboards').put(board.dashboard,board.dashboard.id);for(const c of board.columns)tx.objectStore('columns').put(c,c.id);for(const c of board.cards)tx.objectStore('cards').put(c,c.id)}
      for(const entry of fixture.document.workspace?.history??[])tx.objectStore('history').put(entry,entry.id);
      const sidebar={...fixture.document.workspace.sidebar,workspaces:fixture.document.organization.workspaces};tx.objectStore('sidebar').put(sidebar,'layout');
      for(const attachment of fixture.document.attachmentsManifest){const file=fixture.files.find(f=>f.name===attachment.path);if(!file)throw new Error('Fixture bytes missing');tx.objectStore('bordena-blobs').put(new Blob([new Uint8Array(file.bytes)],{type:file.type}),`${attachment.cardId}/${attachment.key}`)}
      tx.objectStore('meta').put(true,'bordena:initialized');tx.objectStore('meta').put(5,'bordena:model-revision');tx.objectStore('meta').put(0,'bordena:epoch');tx.objectStore('meta').put({extensions:fixture.document.extensions,boards:Object.fromEntries(fixture.document.boards.map(b=>[b.dashboard.id,b.extensions]))},'bordena:exchange');
    });db.close();history.replaceState(null,'','/d/qa-parent');
  },fixture);

  await host.page.reload();await go(`/d/${goal.dashboard.id}`);
  if(await host.page.getByRole('button',{name:'Путь к цели',exact:true}).getAttribute('aria-pressed')!=='true')await host.page.getByRole('button',{name:'Путь к цели',exact:true}).click();
  await host.page.getByRole('heading',{name:'Путь к цели',exact:true}).waitFor();
  await expect.poll(()=>host.page.locator('[data-board-surface]').evaluate(el=>getComputedStyle(el).opacity)).toBe('1');
  expect((await snapshot()).cards).toHaveLength(fixture.document.boards.flatMap(b=>b.cards).length);
  await host.page.screenshot({path:path.join(root,'docs/evidence/aw006-embedded-goal.png')});
  const started=Date.now();await go('/d/qa-large');await expect(host.page.locator('[data-rfd-draggable-id^="qa-large-card-"]')).toHaveCount(1000);report.performance.open1000CardBoardMs=Date.now()-started;
  report.performance.largeMemory=JSON.parse((await promisify(execFile)('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(root,'scripts/measure-native-memory.ps1'),'-Profile',path.join(profile,'WebView2')])).stdout);
  await go(`/d/${goal.dashboard.id}`);await host.page.getByRole('heading',{name:'Путь к цели',exact:true}).waitFor();await delay(400);
  const saved=await snapshot(),views=await host.page.evaluate(()=>localStorage.getItem('bordena:board-views')),navigation=await host.page.evaluate(()=>localStorage.getItem('bordena:navigation:v1'));
  expect(host.errors).toEqual([]);expect(host.external).toEqual([]);await host.close();
  const restart=Date.now();host=await nativeHost({name:'aw006-embedded-restart',profile,port:9236});await host.page.getByRole('heading',{name:'Путь к цели',exact:true}).waitFor();await delay(400);report.performance.restartReadyMs=Date.now()-restart;
  expect(await snapshot()).toEqual(saved);expect(await host.page.evaluate(()=>localStorage.getItem('bordena:board-views'))).toBe(views);expect(await host.page.evaluate(()=>localStorage.getItem('bordena:navigation:v1'))).toBe(navigation);
  report.checks.push('production frontend embedded in native debug EXE, offline with no dev server','all Goal, rule, measurement, execution, link, Markdown and history records survive actual OS process restart','active Goal view and navigation persist; embedded 1000-card opening and memory measured');

  // Closed-app scenario setup in the verified isolated profile only. This edit
  // deliberately bypasses live notifications so the event expires with no host.
  const expires=Date.now()+600;
  await host.page.evaluate(async deadline=>{const r=indexedDB.open('bordena'),db=await new Promise(resolve=>r.onsuccess=()=>resolve(r.result));await new Promise((resolve,reject)=>{const tx=db.transaction('cards','readwrite'),s=tx.objectStore('cards'),get=s.get('qa-large-card-0');get.onsuccess=()=>s.put({...get.result,deadline},'qa-large-card-0');tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error)});db.close()},new Date(expires).toISOString());
  expect((await host.rows('cards')).find(c=>c.id==='qa-large-card-0').automationState).toBeUndefined();
  await host.close();await delay(Math.max(1,expires-Date.now()+300));
  host=await nativeHost({name:'aw005-closed-deadline',profile,port:9236});
  await expect.poll(async()=>(await host.rows('cards')).find(c=>c.id==='qa-large-card-0').automationState?.[0]?.result).toBe('applied');
  let history=(await host.rows('history')).filter(h=>h.entityId==='qa-large-card-0'&&h.data.reason==='automation');expect(history).toHaveLength(1);
  await host.page.reload();await delay(400);history=(await host.rows('history')).filter(h=>h.entityId==='qa-large-card-0'&&h.data.reason==='automation');expect(history).toHaveLength(1);
  report.checks.push('a deadline expiring while the OS process is closed is caught at next start exactly once, including another WebView reload');
  expect(host.errors).toEqual([]);expect(host.external).toEqual([]);report.status='PASS';report.errors=host.errors;report.external=host.external;await host.close();host=undefined;
}catch(error){report.status='FAIL';report.failure=error.stack;process.exitCode=1;if(host){await host.page.screenshot({path:path.join(root,'docs/evidence/aw006-embedded-failure.png')}).catch(()=>{});await host.close().catch(()=>{})}}
finally{await fs.writeFile(path.join(root,'docs/evidence/aw006-embedded.json'),JSON.stringify(report,null,2));console.log(report)}
