import fs from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {expect} from '@playwright/test';
import {nativeHost,root,delay} from './native-host.mjs';

const report={status:'RUNNING',checks:[],performance:{}},profile=path.join(root,'.tools','qa-aw004-embedded-'+Date.now());
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
  const fixture=JSON.parse(await fs.readFile(path.join(root,'.tools/qa-aw004-payload.json'),'utf8'));
  if(fixture.document.schemaVersion!==4||!fixture.document.boards.some(b=>b.dashboard.id==='qa-large'))throw new Error('Run the native AW004 feature QA first');
  host=await nativeHost({name:'aw004-embedded',profile,port:9233});report.profile=profile;
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
      tx.objectStore('meta').put(true,'bordena:initialized');tx.objectStore('meta').put(4,'bordena:model-revision');tx.objectStore('meta').put(0,'bordena:epoch');tx.objectStore('meta').put({extensions:fixture.document.extensions,boards:Object.fromEntries(fixture.document.boards.map(b=>[b.dashboard.id,b.extensions]))},'bordena:exchange');
    });db.close();history.replaceState(null,'','/d/qa-parent');
  },fixture);
  await host.page.reload();await host.page.getByRole('button',{name:'Меню Bordena',exact:true}).waitFor();await go('/d/qa-parent');await host.page.getByText('CHOPIK AW004',{exact:true}).first().waitFor();await delay(300);
  const before=await snapshot();expect(before.cards).toHaveLength(fixture.document.boards.flatMap(b=>b.cards).length);expect(before.blobs).toHaveLength(2);
  expect(before.cards.find(c=>c.id==='qa-fifa').body).toContain('#bordena-date=2026-12-21');
  await go('/d/qa-parent/c/qa-fifa');await host.page.getByRole('button',{name:'Изменить дату в тексте',exact:true}).last().click();await expect(host.page.getByLabel('Дата календаря',{exact:true})).toHaveValue('2026-12-21');await host.page.locator('[data-slot="date-input-popup"]').screenshot({path:path.join(root,'docs/evidence/aw004-calendar-popup.png')});await host.page.keyboard.press('Escape');
  await host.page.screenshot({path:path.join(root,'docs/evidence/aw004-embedded-card.png')});await host.page.getByRole('button',{name:'Закрыть карточку'}).click();
  await go('/d/qa-child');await host.page.locator('[data-mirror-id]').waitFor();
  const started=Date.now();await go('/d/qa-large');await expect(host.page.locator('[data-rfd-draggable-id^="qa-large-card-"]')).toHaveCount(1000);report.performance.open1000CardBoardMs=Date.now()-started;
  report.performance.largeMemory=JSON.parse((await promisify(execFile)('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(root,'scripts/measure-native-memory.ps1'),'-Profile',path.join(profile,'WebView2')])).stdout);
  await go('/d/qa-parent');await host.page.getByRole('button',{name:'Список',exact:true}).click();await expect(host.page.getByRole('table')).toBeVisible();
  const views=await host.page.evaluate(()=>localStorage.getItem('bordena:board-views'));expect(JSON.parse(views)['qa-parent']).toBe('table');await delay(200);
  const saved=await snapshot(),navigation=await host.page.evaluate(()=>JSON.parse(localStorage.getItem('bordena:navigation:v1')));
  expect(host.errors).toEqual([]);expect(host.external).toEqual([]);await host.close();
  const restart=Date.now();host=await nativeHost({name:'aw004-embedded-restart',profile,port:9233});await host.page.waitForURL(/\/d\/qa-parent$/);await expect(host.page.getByRole('table')).toBeVisible();report.performance.restartReadyMs=Date.now()-restart;
  expect(await snapshot()).toEqual(saved);expect(await host.page.evaluate(()=>JSON.parse(localStorage.getItem('bordena:navigation:v1')))).toEqual(navigation);
  expect(await host.page.evaluate(()=>localStorage.getItem('bordena:board-views'))).toBe(views);
  expect(host.errors).toEqual([]);expect(host.external).toEqual([]);
  report.checks.push('embedded production frontend in native debug EXE, offline, no Vite server','schema4 fixture retains stable IDs, links, rules, mirrors, fields, text dates and managed media SHA256','real OS process restart retains all business records, tabs, active board and table view','calendar opens a persisted word date; 1000-card opening and native memory measured');
  report.status='PASS';report.errors=host.errors;report.external=host.external;await host.close();host=undefined;
}catch(error){report.status='FAIL';report.failure=error.stack;process.exitCode=1;if(host){await host.page.screenshot({path:path.join(root,'docs/evidence/aw004-embedded-failure.png')}).catch(()=>{});await host.close().catch(()=>{})}}
finally{await fs.writeFile(path.join(root,'docs/evidence/aw004-embedded.json'),JSON.stringify(report,null,2));console.log(report)}
