import fs from 'node:fs/promises';import path from 'node:path';import {chromium,expect} from '@playwright/test';import {root,delay} from './native-host.mjs';
let browser,page;const report={status:'RUNNING'};
try{
 for(let i=0;i<480;i++){try{browser=await chromium.connectOverCDP('http://127.0.0.1:9235');break}catch{await delay(250)}}
 if(!browser)throw new Error('QA native dev host did not start');
 for(let i=0;i<80&&!page;i++){for(const candidate of browser.contexts()[0].pages())if(await candidate.evaluate(()=>window.__TAURI_INTERNALS__?.metadata?.currentWindow?.label).catch(()=>null)==='main'){page=candidate;break}if(!page)await delay(100)}
 if(!page||!page.url().startsWith('http://127.0.0.1:5173/'))throw new Error('Wrong QA native dev view');
 await page.getByRole('button',{name:/^(Меню Bordena|Bordena menu)$/}).waitFor();
 const profile=await page.evaluate(()=>window.__TAURI_INTERNALS__.invoke('storage_profile'));
 if(path.resolve(profile).toLowerCase()!==path.resolve(process.env.BORDENA_TEST_PROFILE,'WebView2').toLowerCase()||!profile.toLowerCase().startsWith(path.join(root,'.tools','qa-aw005-baseline-').toLowerCase()))throw new Error('Unsafe native profile');
 const result=await page.evaluate(async()=>{
  const workspace=await import('/src/lib/exchange/workspace.ts'),format=await import('/src/lib/exchange/format.ts'),organization=await import('/src/lib/workspaces.ts'),layout=await import('/src/lib/layout-workspace.ts'),preferences=await import('/src/lib/preferences.ts'),{webDb}=await import('/src/lib/adapters/web-db.ts'),{LocalFiles}=await import('/src/lib/adapters/local-files.ts');
  const initial=await workspace.exportWorkspace(), board=initial.document.boards[0], card=board.cards[0];
  const space=await organization.createWorkspace('CHOPIK native'),project=await organization.createProject('Фильм ё',space);await organization.moveBoardGroup(board.dashboard.id,space,project);await organization.changeProject(project,{archived:true});
  await layout.ensureLayout(board.dashboard.id,'free');await layout.changeLayout(board.dashboard.id,l=>({...l,sections:{...l.sections,[board.columns[0].id]:{...l.sections[board.columns[0].id],laneId:l.lanes[1].id,progressMode:'position',position:'a9',collapsed:true}}}));
  const stored=await new LocalFiles().put(card.id,{name:'Сценарий ё.txt',mime:'text/plain',bytes:new Blob(['Native ZIP bytes ё\u0000test'])});
  await webDb.set('cards',card.id,{...card,title:'Сценарий FIFA 23',body:'# Работа ё\n- [x] Сценарий\n- [ ] Монтаж',progress:37,tags:['видео'],priority:'high',attachments:[{...stored,id:'roundtrip-file',name:'Сценарий ё.txt'}]});
  preferences.setPreferences({language:'en',density:'compact',workspaceId:space,animations:false});
  const before=await workspace.exportWorkspace(),archive=await format.encodeArchive(before),decoded=await format.decodeImport(archive),verified=await workspace.createBackup();
  const empty={document:{format:'bordena',schemaVersion:4,scope:'workspace',exportedAt:new Date().toISOString(),boards:[],attachmentsManifest:[]},files:new Map()};
  await workspace.applyImport(empty,'replace',await workspace.previewImport(empty));if((await webDb.count('dashboards'))!==0)throw new Error('QA profile did not become empty');
  await webDb.bindEpoch();await workspace.applyImport(decoded,'replace',await workspace.previewImport(decoded));await webDb.bindEpoch();
  const after=await workspace.exportWorkspace();
  const canonical=doc=>JSON.stringify({boards:doc.boards,organization:doc.organization,workspace:doc.workspace,preferences:doc.preferences});
  if(canonical(before.document)!==canonical(after.document))throw new Error('Native roundtrip changed model or preferences');
  for(const [name,blob]of before.files){const other=after.files.get(name);if(!other||await format.sha256(new Uint8Array(await blob.arrayBuffer()))!==await format.sha256(new Uint8Array(await other.arrayBuffer())))throw new Error('Native attachment bytes changed')}
  const backup=await workspace.readBackup(verified);if(canonical(backup.document)!==canonical(before.document))throw new Error('Verified backup differs');
  return {schemaVersion:after.document.schemaVersion,boards:after.document.boards.length,projects:after.document.workspace.sidebar.items.filter(i=>i.type==='folder').length,workspaces:after.document.organization.workspaces.length,attachmentSha256:after.document.attachmentsManifest[0].sha256,backupSha256:verified.sha256,archive:[...archive]};
 });
 await fs.writeFile(path.join(root,'.tools/qa-aw005-baseline.zip'),Buffer.from(result.archive));delete result.archive;Object.assign(report,{status:'PASS',profile,...result,checks:['native export -> empty isolated profile -> import','workspaces/projects/archive flags/section rank/collapse/progress mode/manual37','Markdown/checklist/tags/priority/attachment SHA256','preferences and verified-backup roundtrip']});
 expect(report.schemaVersion).toBe(4);
}catch(error){report.status='FAIL';report.failure=error.stack;process.exitCode=1}
finally{if(page)await page.evaluate(()=>window.__TAURI_INTERNALS__.invoke('plugin:window|close',{label:'main'})).catch(()=>{});await browser?.close().catch(()=>{});await fs.writeFile(path.join(root,'docs/evidence/aw005-baseline.json'),JSON.stringify(report,null,2));console.log(report)}
