import fs from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
const browser=await chromium.connectOverCDP('http://127.0.0.1:9223');
const context=browser.contexts()[0];
const page=context.pages().find(p=>!p.url().includes('quick-note')&&!p.url().includes('tear-ghost'));
const profile=await page.evaluate(()=>window.__TAURI_INTERNALS__.invoke('storage_profile'));
if(!profile.replaceAll('\\','/').includes('/.tools/qa-')) throw new Error('Refusing to test a non-isolated profile');
const results=[]; const errors=[];const external=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('request',r=>{if(!/^(http:\/\/127\.0\.0\.1:5173|blob:|data:|tauri:|ipc:|http:\/\/ipc\.localhost)/.test(r.url()))external.push(r.url())});
async function check(name,fn){const start=performance.now();try{await fn();results.push({name,status:'PASS',ms:Math.round(performance.now()-start)});}catch(e){results.push({name,status:'FAIL',error:e.message.slice(0,1500)});console.log(name,'FAIL',e.message.slice(0,400));}}
await page.reload(); await page.getByRole('button',{name:'Меню Bordena'}).waitFor();
const trigger=page.getByRole('button',{name:'Меню Bordena'});
await check('Logo click, repeat, outside, Esc, Enter, Space and focus',async()=>{
 await trigger.click();await expect(page.getByRole('menu')).toBeVisible();await trigger.click();await expect(page.getByRole('menu')).toHaveCount(0);
 await trigger.click();await page.getByText('Доски',{exact:true}).click();await expect(page.getByRole('menu')).toHaveCount(0);
 for(const key of ['Enter','Space']){await trigger.focus();await page.keyboard.press(key);await expect(page.getByRole('menu')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('menu')).toHaveCount(0);await expect(trigger).toBeFocused();}
});
await check('Logo glow duration, cursor, light/dark and 640px menu bounds',async()=>{
 const image=trigger.locator('img');await trigger.evaluate(e=>e.blur());await page.mouse.move(600,600);await page.waitForTimeout(230);
 await expect(image).toHaveCSS('transition-duration','0.2s');await expect(trigger).toHaveCSS('cursor','pointer');
 const resting=await image.evaluate(e=>getComputedStyle(e).filter);await trigger.hover();await page.waitForTimeout(230);const lit=await image.evaluate(e=>getComputedStyle(e).filter);expect(lit).not.toBe(resting);
 await page.setViewportSize({width:640,height:680});await page.getByRole('button',{name:'Переключить боковую панель'}).click();await trigger.click();
 let box=await page.getByRole('menu').boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(640);
 await page.screenshot({path:'../../docs/evidence/logo-menu-640.png'});await page.keyboard.press('Escape');
 await page.setViewportSize({width:1280,height:800});await page.reload();await page.getByRole('button',{name:'Меню Bordena'}).waitFor();
 await page.getByRole('button',{name:/Светлая тема|Тёмная тема/}).click();await trigger.click();await page.screenshot({path:'../../docs/evidence/logo-menu-dark.png'});await page.keyboard.press('Escape');
});
await check('About and file-backed Changelog',async()=>{
 await trigger.click();await page.getByRole('menuitem',{name:'О программе',exact:true}).click();await expect(page.getByText('Bordena 0.7',{exact:true})).toBeVisible();await expect(page.getByText(/В Bordena использована часть кода Doska/)).toBeVisible();await page.keyboard.press('Escape');
 await trigger.click();await page.getByRole('menuitem',{name:'История изменений',exact:true}).click();await expect(page.getByText('0.1 — в разработке')).toBeVisible();await page.keyboard.press('Escape');
});
let boardId,cardId;
await check('Create and rename board, add column',async()=>{
 await page.getByRole('button', {name: 'Создать доску или календарь', exact: true}).click(); await page.getByRole('menuitem', {name: 'Новая доска', exact: true}).click();await page.waitForURL(/\/d\/board-/);boardId=new URL(page.url()).pathname.split('/')[2];
 await page.locator('header').getByText('Новая доска',{exact:true}).click();await page.getByRole('textbox',{name:'Название доски'}).fill('Проверка 0.1 — Ё & <>');await page.getByRole('textbox',{name:'Название доски'}).press('Enter');
 await page.getByRole('button',{name:'Добавить колонку',exact:true}).click();await expect(page.getByRole('group',{name:'Новая колонка',exact:true})).toBeVisible();
});
await check('Create card, Markdown, checklist and local attachment without auth',async()=>{
 await page.getByRole('group',{name:'К выполнению',exact:true}).getByRole('button',{name:'Добавить карточку: К выполнению'}).click();
 const tile=page.locator('[data-rfd-draggable-id]').filter({has:page.locator('[data-slot="card-title"]',{hasText:'Без названия'})});await tile.click();
 await page.getByPlaceholder('Название',{exact:true}).fill('Карточка Ё & <>');await page.getByRole('textbox',{name:'Заметки',exact:true}).fill('# Markdown\n**Жирный текст**\n- [x] Готово\n- [ ] В работе');
 await page.locator('input[type=file]').setInputFiles({name:'проверка.txt',mimeType:'text/plain',buffer:Buffer.from('Локальное вложение Ё')});
 await page.getByRole('button',{name:'Закрыть карточку'}).click();await expect(page.getByText('Карточка Ё & <>',{exact:true})).toBeVisible();
 const data=await page.evaluate(async()=>{const {webDb}=await import('/src/lib/adapters/web-db.ts');return webDb.getAll('cards')});
 const found=data.find(c=>c.title==='Карточка Ё & <>');cardId=found.id;expect(found.body).toContain('- [x] Готово');expect(found.attachments).toHaveLength(1);
});
await check('Tags, priorities and keyboard drag persist after reload',async()=>{
 await page.evaluate(async(id)=>{const core=await import('/@fs/C:/Bordena/packages/core/src/index.ts');await core.updateCard(id,{tags:['проект'],priority:'high'});await core.queryClient.invalidateQueries()},cardId);
 const tile=page.locator(`[data-rfd-draggable-id="${cardId}"]`);await tile.focus();await page.keyboard.press('Space');await page.waitForTimeout(150);await page.keyboard.press('ArrowRight');await page.waitForTimeout(200);await page.keyboard.press('Space');await page.waitForTimeout(350);await page.reload();
 await expect(page.getByRole('group',{name:'В работе',exact:true}).getByText('Карточка Ё & <>',{exact:true})).toBeVisible();
 const data=await page.evaluate(async(id)=>{const {webDb}=await import('/src/lib/adapters/web-db.ts');return webDb.get('cards',id)},cardId);expect(data.tags).toEqual(['проект']);expect(data.priority).toBe('high');
});
await check('Actual IDB JSON/ZIP export, repeat import rejection, backup, replacement and restore',async()=>{
 const outcome=await page.evaluate(async()=>{
  const w=await import('/src/lib/exchange/workspace.ts');const f=await import('/src/lib/exchange/format.ts');
  const original=await w.exportWorkspace();const bytes=await f.encodeArchive(original);const payload=await f.decodeImport(bytes);const preview=await w.previewImport(payload);
  let refused=false;try{await w.applyImport(payload,'add',preview)}catch{refused=true}
  const backup=await w.createBackup();const restored=await w.readBackup(backup);
  await w.applyImport(restored,'replace',await w.previewImport(restored));
  const after=await w.exportWorkspace();return {refused,identical:JSON.stringify(after.document.boards)===JSON.stringify(original.document.boards),backups:(await w.listBackups()).length,bytes:bytes.length};
 });expect(outcome.refused).toBe(true);expect(outcome.identical).toBe(true);expect(outcome.backups).toBeGreaterThanOrEqual(2);results.push({name:'Archive bytes',...outcome});await page.reload();
});
await check('Offline transport is disabled, native storage profile is isolated, no outgoing app requests',async()=>{
 const data=await page.evaluate(async()=>{const {webHttp}=await import('/src/lib/adapters/web-http.ts');let rejected=false;try{await webHttp.fetch('https://example.com')}catch{rejected=true};const {invoke}=await import('/node_modules/.vite/deps/@tauri-apps_api_core.js');return {configured:webHttp.isConfigured(),rejected,profile:await invoke('storage_profile')}});
 expect(data.configured).toBe(false);expect(data.rejected).toBe(true);expect(data.profile).toContain('qa-profile');expect(external).toEqual([]);
});
await page.getByRole('group',{name:'В работе',exact:true}).waitFor();await page.waitForTimeout(400);await page.screenshot({path:'../../docs/evidence/native-final.png'});
await fs.writeFile('../../docs/evidence/native-smoke.json',JSON.stringify({at:new Date().toISOString(),results,errors,external},null,2));
console.log(JSON.stringify(results,null,2));
await browser.close();process.exit(results.some(r=>r.status==='FAIL')?1:0);


