import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import fs from 'node:fs/promises';
import {chromium,expect} from '@playwright/test';
const runFile=promisify(execFile),root=path.resolve('../..');
const profile=path.join(root,'.tools','qa-performance-'+Date.now());
const results={binaryBytes:(await fs.stat(path.join(root,'apps/desktop/src-tauri/target/debug/bordena.exe'))).size,notes:'Debug build. Fresh-profile launch is not an OS cold-cache measurement. No Doska baseline.'};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
for(const phase of ['freshProfile','warmProfile']){
 const start=performance.now();
 const child=spawn(path.join(root,'apps/desktop/src-tauri/target/debug/bordena.exe'),[],{cwd:root,env:{...process.env,BORDENA_TEST_PROFILE:profile,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9226'},stdio:'ignore'});
 let browser;
 for(let i=0;i<60;i++){try{browser=await chromium.connectOverCDP('http://127.0.0.1:9226');break;}catch{await delay(200);}}
 if(!browser)throw new Error('Native startup did not complete');
  let page;
 for(let attempt=0;attempt<60&&!page;attempt++){for(const candidate of browser.contexts()[0].pages()){if(await candidate.evaluate(()=>window.__TAURI_INTERNALS__?.metadata?.currentWindow?.label).catch(()=>null)==='main'){page=candidate;break;}}if(!page)await delay(100);}
 if(!page)throw new Error('Main WebView not found');
 await page.getByRole('button',{name:'Меню Bordena'}).waitFor();
 results[phase+'StartupMs']=Math.round(performance.now()-start);
 const actual=await page.evaluate(()=>window.__TAURI_INTERNALS__.invoke('storage_profile'));if(!actual.replaceAll('\\','/').includes('/.tools/qa-'))throw new Error('Unsafe profile');
 if(phase==='freshProfile'){
  const ps=`$rootProcessId=${child.pid}; $all=Get-CimInstance Win32_Process; $ids=[Collections.Generic.HashSet[int]]::new(); [void]$ids.Add($rootProcessId); do{$added=$false; foreach($item in $all){if($ids.Contains([int]$item.ParentProcessId) -and $ids.Add([int]$item.ProcessId)){$added=$true}}}while($added); $memory=(Get-Process -Id @($ids) -ErrorAction SilentlyContinue | Measure-Object WorkingSet64 -Sum).Sum; Write-Output $memory`;
  const memory=await runFile('powershell.exe',['-NoProfile','-Command',ps]);results.freshProfileProcessTreeWorkingSetBytes=Number(memory.stdout.trim());
  await page.evaluate(async()=>{const req=indexedDB.open('bordena');const db=await new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});const now=Date.now();await new Promise((resolve,reject)=>{const tx=db.transaction(['dashboards','columns','cards'],'readwrite');tx.objectStore('dashboards').put({id:'perf-board',title:'1000 карточек',position:'a1',sort:[],updatedAt:now,deletedAt:null},'perf-board');for(let c=0;c<3;c++)tx.objectStore('columns').put({id:'perf-col-'+c,dashboardId:'perf-board',title:'Колонка '+c,position:'a'+c,collapsed:false,color:'',done:false,stamps:{},updatedAt:now,deletedAt:null},'perf-col-'+c);for(let i=0;i<1000;i++)tx.objectStore('cards').put({id:'perf-card-'+i,title:'Тест '+i,body:'Заметка **Markdown**',position:'a0'+String(i).padStart(4,'0')+'V',columnId:'perf-col-'+i%3,number:null,deadline:null,priority:'',tags:[],users:[],attachments:[],stamps:{},bodyConflict:null,updatedAt:now,deletedAt:null},'perf-card-'+i);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)});db.close()});
  const opening=performance.now();await page.goto('http://tauri.localhost/d/perf-board');await expect(page.locator('[data-rfd-draggable-id^="perf-card-"]')).toHaveCount(1000,{timeout:30000});results.largeBoard1000RenderMs=Math.round(performance.now()-opening);
  await page.evaluate(async()=>{const r=indexedDB.open('bordena');const db=await new Promise(ok=>{r.onsuccess=()=>ok(r.result)});await new Promise((ok,no)=>{const tx=db.transaction('dashboards','readwrite'),store=tx.objectStore('dashboards'),get=store.get('perf-board');get.onsuccess=()=>{const board=get.result;const stages=[0,1,2].map(i=>({id:'perf-col-'+i,title:'Этап '+i}));board.layout={schemaVersion:1,mode:'matrix',lanes:[{id:'lane',title:'Столбец'}],stages,states:[{id:'active',title:'Активно'}],sections:Object.fromEntries(stages.map(s=>[s.id,{laneId:'lane',stageId:s.id,stateId:'active'}]))};store.put(board,board.id)};tx.oncomplete=ok;tx.onerror=()=>no(tx.error)});db.close()});
  const matrixStart=performance.now();await page.reload();await expect(page.locator('[data-matrix] [data-rfd-draggable-id^="perf-card-"]')).toHaveCount(1000,{timeout:30000});results.matrix1000RenderMs=Math.round(performance.now()-matrixStart);
  await page.evaluate(()=>localStorage.removeItem('bordena:navigation:v1'));await page.goto('http://tauri.localhost/');await page.getByRole('button',{name:'Меню Bordena'}).waitFor();
 }
 const exited=new Promise(resolve=>child.once('exit',resolve));await page.evaluate(()=>window.__TAURI_INTERNALS__.invoke('plugin:window|close',{label:'main'})).catch(()=>{});
 await browser.close().catch(()=>{});await Promise.race([exited,delay(10000).then(()=>{if(child.exitCode===null)throw new Error('Application failed to close')})]);await delay(300);
}
await fs.writeFile('../../docs/evidence/aw002-performance.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));


