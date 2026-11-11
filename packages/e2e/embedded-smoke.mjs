import fs from 'node:fs/promises';
import {chromium,expect} from '@playwright/test';
const browser=await chromium.connectOverCDP('http://127.0.0.1:9224');const context=browser.contexts()[0];
const page=context.pages().find(p=>!p.url().includes('quick-note')&&!p.url().includes('tear-ghost'));
const profile=await page.evaluate(()=>window.__TAURI_INTERNALS__.invoke('storage_profile'));
if(!profile.replaceAll('\\','/').includes('/.tools/qa-')) throw new Error('Refusing to test a non-isolated profile');
const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
const phase=process.argv[2]??'create';
try{
 expect(new URL(page.url()).hostname).toBe('tauri.localhost');
 await context.setOffline(true);await page.reload();await page.getByRole('button',{name:'Меню Bordena'}).waitFor();
 if(phase==='create'){
  await page.getByRole('button', {name: 'Создать доску или календарь', exact: true}).click(); await page.getByRole('menuitem', {name: 'Новая доска', exact: true}).click();await page.getByRole('button',{name:'Создать доску',exact:true}).click();await page.waitForURL(/\/d\/board-/);
  await page.locator('header').getByText('Новая доска',{exact:true}).click();await page.getByRole('textbox',{name:'Название доски'}).fill('Автономная проверка');await page.getByRole('textbox',{name:'Название доски'}).press('Enter');
  await page.getByRole('group',{name:'К выполнению',exact:true}).getByRole('button',{name:'Добавить карточку: К выполнению'}).click();
  await page.locator('[data-rfd-draggable-id]').filter({has:page.locator('[data-slot="card-title"]',{hasText:'Без названия'})}).click();
  await page.getByPlaceholder('Название',{exact:true}).fill('Перезапуск офлайн');await page.getByRole('textbox',{name:'Заметки',exact:true}).fill('**Сохранено локально**\n- [x] Без подключения');
  await page.locator('input[type=file]').setInputFiles({name:'offline.txt',mimeType:'text/plain',buffer:Buffer.from('Offline attachment')});
  await page.getByRole('button',{name:'Закрыть карточку'}).click();await expect(page.getByText('Перезапуск офлайн',{exact:true})).toBeVisible();await page.waitForTimeout(800);
 } else {
  await page.getByText('Автономная проверка',{exact:true}).first().click();await expect(page.getByText('Перезапуск офлайн',{exact:true})).toBeVisible();
  await page.getByText('Перезапуск офлайн',{exact:true}).click();await expect(page.getByText('Сохранено локально',{exact:true}).last()).toBeVisible();await expect(page.getByText('offline.txt',{exact:true}).last()).toBeVisible();await page.getByRole('button',{name:'Закрыть карточку'}).click();
 }
 await page.getByRole('button',{name:'Меню Bordena'}).click();await page.getByRole('menuitem',{name:'О программе',exact:true}).click();await expect(page.getByText('Bordena 0.7',{exact:true})).toBeVisible();await page.keyboard.press('Escape');
 await page.waitForTimeout(500);await page.screenshot({path:`../../docs/evidence/embedded-${phase}.png`});
 const external=requests.filter(url=>!url.startsWith('http://tauri.localhost/')&&!url.startsWith('http://ipc.localhost/')&&!url.startsWith('data:')&&!url.startsWith('blob:'));
 expect(errors).toEqual([]);expect(external).toEqual([]);
 await fs.writeFile(`../../docs/evidence/embedded-${phase}.json`,JSON.stringify({status:'PASS',origin:new URL(page.url()).origin,offline:true,phase,errors,external},null,2));console.log('PASS',phase,'offline embedded application');
 await context.setOffline(false);
 // End this isolated QA process; persisted content is checked after a new OS process starts.
 await page.evaluate(()=>window.__TAURI_INTERNALS__.invoke('plugin:window|close', {label:'main'})).catch(()=>{});
}catch(error){await context.setOffline(false).catch(()=>{});console.error(error);await fs.writeFile(`../../docs/evidence/embedded-${phase}.json`,JSON.stringify({status:'FAIL',error:error.message,errors,requests},null,2));process.exitCode=1;}
await browser.close().catch(()=>{});
