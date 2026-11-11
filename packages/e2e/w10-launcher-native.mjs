import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import {expect} from '@playwright/test';import {nativeHost,root,selectCalendarView} from './native-host.mjs';
const report={status:'RUNNING',runs:[],screenshotsCreated:false};let host;
try{
 const bat=await fs.readFile(path.join(root,'Bordena.bat'),'utf8');assert.ok(bat.includes('artifacts\\Bordena-W1.0-Windows-x64\\Bordena.exe')&&bat.includes('%*'));
 for(const launcher of [false,true]){
  host=await nativeHost({name:launcher?'w10-launcher-bat':'w10-launcher-exe',port:launcher?9266:9265,release:true,launcher,executable:path.join(root,'artifacts/Bordena-W1.0-Windows-x64/Bordena.exe')});const {page,rows}=host;
  assert.equal(await page.evaluate(()=>window.__TAURI_INTERNALS__.invoke('plugin:app|version')),'1.0.0');await expect(page.getByRole('tablist')).toHaveCount(0);
  const windowStateIsolation=await page.evaluate(async()=>{try{await window.__TAURI_INTERNALS__.invoke('plugin:window-state|filename');return 'unexpectedly enabled'}catch(e){return String(e)}});assert.match(windowStateIsolation,/not found/i);
  await page.getByRole('button',{name:'Календарь',exact:true}).click();await selectCalendarView(page,'year');await expect(page.locator('.bordena-mini-month')).toHaveCount(12);
  await page.getByRole('button',{name:'Параметры календаря',exact:true}).click();const options=page.getByRole('dialog',{name:'Параметры календаря',exact:true});await options.getByRole('combobox',{name:'Начало недели',exact:true}).selectOption('0');await page.keyboard.press('Escape');await expect(page.locator('[data-year-day="2026-12-01"]')).toHaveCount(1);
  const board=(await rows('dashboards')).find(b=>!b.deletedAt);assert.ok(board);await page.getByText(board.title,{exact:true}).first().click();await expect(page.locator('[data-board-surface]')).toBeVisible();
  await page.getByRole('button',{name:'Меню Bordena',exact:true}).click();await page.getByRole('menuitem',{name:'О программе',exact:true}).click();await expect(page.getByText('Bordena W 1.0',{exact:true})).toBeVisible();
  assert.deepEqual(host.errors,[]);assert.deepEqual(host.external,[]);const profile=host.profile;await host.close();host=null;
  report.runs.push({launcher:launcher?'Bordena.bat':'packaged Bordena.exe',status:'PASS',profile,version:'1.0.0',checks:['native release window','QA window-state plugin absent', 'sidebar','tabs off by default','calendar and year','board navigation','About W 1.0','normal close','offline'],errors:[],external:[]});
 }
 report.status='PASS';
}catch(e){report.failure=e.stack;report.status='FAIL';process.exitCode=1}finally{await host?.close().catch(()=>{});await fs.writeFile(path.join(root,'docs/evidence/w10-launcher-native.json'),JSON.stringify(report,null,2));console.log(report)}
