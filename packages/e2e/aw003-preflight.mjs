import fs from 'node:fs/promises';
import {chromium, expect} from '@playwright/test';
let browser, page;
for(let i=0;i<90;i++){try{browser=await chromium.connectOverCDP('http://127.0.0.1:9228');break}catch{await new Promise(r=>setTimeout(r,300))}}
if(!browser)throw new Error('Preflight native host did not start');
for(let i=0;i<60&&!page;i++){for(const p of browser.contexts()[0].pages()){if(await p.evaluate(()=>window.__TAURI_INTERNALS__?.metadata?.currentWindow?.label).catch(()=>null)==='main'){page=p;break}}if(!page)await new Promise(r=>setTimeout(r,100))}
await page.getByRole('button',{name:'Меню Bordena'}).waitFor();
const profile=await page.evaluate(()=>window.__TAURI_INTERNALS__.invoke('storage_profile'));
if(!profile.replaceAll('\\','/').includes('/.tools/qa-aw003-preflight/'))throw new Error('Unsafe preflight profile');
try{
  const result=await page.evaluate(async()=>{
    const workspace=await import('/src/lib/exchange/workspace.ts');
    const format=await import('/src/lib/exchange/format.ts');
    const {webDb}=await import('/src/lib/adapters/web-db.ts');
    const {LocalFiles}=await import('/src/lib/adapters/local-files.ts');
    const {ensureLayout}=await import('/src/lib/layout-workspace.ts');
    const board=(await workspace.exportWorkspace()).document.boards[0];
    const card=board.cards[0];
    const file=await new LocalFiles().put(card.id,{name:'AW003-тест.txt',mime:'text/plain',bytes:new Blob(['Вложение ё'])});
    await webDb.set('cards',card.id,{...card,title:'Контроль 0.2',body:'# Markdown ё\n- [x] Сохранено\n- [ ] Проверить',progress:65,attachments:[{...file,id:'aw003-file',name:'AW003-тест.txt'}]});
    await ensureLayout(board.dashboard.id,'free');
    const before=await workspace.exportWorkspace();
    const backup=await workspace.createBackup();
    const payload=await workspace.readBackup(backup);
    const saved=await webDb.get('cards',card.id);
    await webDb.set('cards',card.id,{...saved,title:'Изменение перед восстановлением'});
    await workspace.applyImport(payload,'replace',await workspace.previewImport(payload));
    const after=await workspace.exportWorkspace();
    if(JSON.stringify(before.document.boards)!==JSON.stringify(after.document.boards))throw new Error('Native restore changed entities');
    const original=[...before.files.values()][0],restored=[...after.files.values()][0];
    if(await format.sha256(new Uint8Array(await original.arrayBuffer()))!==await format.sha256(new Uint8Array(await restored.arrayBuffer())))throw new Error('Native attachment changed');
    return {status:'PASS',schemaVersion:after.document.schemaVersion,boards:after.document.boards.length,cards:after.document.boards[0].cards.length,attachmentText:await restored.text(),backupSha256:backup.sha256,archive:[...backup.bytes]};
  });
  expect(result.status).toBe('PASS');
  await fs.writeFile('../../.tools/qa-aw003-preflight.zip',Buffer.from(result.archive));delete result.archive;
  await fs.writeFile('../../docs/evidence/aw003-preflight.json',JSON.stringify({...result,profile},null,2));
  console.log(result);
}finally{await page.evaluate(()=>window.__TAURI_INTERNALS__.invoke('plugin:window|close',{label:'main'})).catch(()=>{});await browser.close().catch(()=>{})}
