import {selectCalendarView,showCalendarTasks,newCalendar} from './native-host.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {expect} from '@playwright/test';
import {nativeHost,root} from './native-host.mjs';
const report={status:'RUNNING',checks:[]};let host;
try {
  host=await nativeHost({name:'calendar-direct',port:9247});const {page,rows}=host;report.profile=host.profile;
  await page.getByRole('button',{name:'Календарь',exact:true}).click();
  const sample=(await rows('cards'))[0];
  await page.evaluate(async sample=>{
    localStorage.setItem('bordena:calendar:view',JSON.stringify({view:'month',date:'2026-10-20'}));
    const r=indexedDB.open('bordena'),db=await new Promise(ok=>r.onsuccess=()=>ok(r.result));
    await new Promise((ok,no)=>{const tx=db.transaction('cards','readwrite');tx.oncomplete=ok;tx.onerror=()=>no(tx.error);
      for(let i=0;i<30;i++){const id=`direct-${String(i).padStart(2,'0')}`;tx.objectStore('cards').put({...sample,id,title:i===1?"":`Планирование ${i}`,body:'Сохранить текст',deadline:'2026-10-25T18:00:00+03:00',progress:37,calendarId:null,archived:false,deletedAt:null,attachments:[],updatedAt:Date.now()},id)}
    });db.close()
  },sample);await page.reload();
  const aggregate=async()=> (await rows('meta')).find(v=>v?.schemaVersion===1&&Array.isArray(v?.calendars));
  const task=id=>page.locator(`[data-calendar-task="${id}"]`);
  const blocks=async id=>(await aggregate())?.events.filter(e=>!e.deletedAt&&e.kind==='block'&&e.links.some(l=>l.type==='card'&&l.id===id))??[];
  const date=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('bordena:calendar:view')).date);
  const surface=page.locator('[data-calendar-scroll="timeline"]');
  await surface.hover({position:{x:100,y:200}});await page.mouse.wheel(0,120);await expect.poll(date).toBe('2026-11-01');
  await page.mouse.wheel(0,-120);await expect.poll(date).toBe('2026-10-01');
  report.checks.push('real mouse wheel changes month forward and backward');
  await showCalendarTasks(page);
  const panel=page.getByRole('complementary',{name:'Правая панель календаря',exact:true});
  await expect(panel.getByRole('checkbox')).toHaveCount(0);await expect(page.getByRole('button',{name:'Предложить время',exact:true})).toHaveCount(0);
  await panel.hover();await page.mouse.wheel(0,120);await expect.poll(()=>panel.evaluate(el=>el.scrollTop)).toBeGreaterThan(0);expect(await date()).toBe('2026-10-01');
  await task('direct-00').click();
  await expect(page.getByRole('dialog').getByRole('textbox',{name:'Название',exact:true})).toHaveValue('Планирование 0');
  await page.keyboard.press('Escape');await expect(task('direct-00')).toBeVisible();expect(await blocks('direct-00')).toHaveLength(0);
  await task('direct-00').dragTo(page.locator('[data-calendar-day="2026-10-14"]'));
  await expect.poll(()=>blocks('direct-00')).toHaveLength(1);
  let planned=(await blocks('direct-00'))[0];
  expect(await page.evaluate(start=>{const d=new Date(start);return [d.getMonth()+1,d.getDate(),d.getHours()]},planned.start)).toEqual([10,14,10]);
  expect((new Date(planned.end)-new Date(planned.start))/60000).toBe(60);
  await expect(task('direct-00')).toHaveCount(0);await expect(page.getByRole('dialog')).toHaveCount(0);
  const card=(await rows('cards')).find(c=>c.id==='direct-00');expect(card.deadline).toBe('2026-10-25T18:00:00+03:00');expect(card.progress).toBe(37);expect(card.body).toBe('Сохранить текст');
  report.checks.push('native drag onto month date saves one block immediately, preserves original card/deadline/progress, and removes task from unscheduled list');
  await page.keyboard.press('Control+z');await expect.poll(()=>blocks('direct-00')).toHaveLength(0);await expect(task('direct-00')).toBeVisible();
  await selectCalendarView(page,'day');
  await task('direct-01').dragTo(page.locator('[data-calendar-day="2026-10-01"]'));
  await expect.poll(()=>blocks('direct-01')).toHaveLength(1);await expect(page.getByRole('dialog')).toHaveCount(0);
  planned=(await blocks('direct-01'))[0];expect(planned.title).toBe('Без названия');await page.locator(`[data-calendar-event="${planned.id}"]`).dblclick();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');
  report.checks.push('native drop onto time grid saves a block; clicking the block opens the existing editor; structural Undo restores the original task');
  await page.screenshot({path:path.join(root,'docs/evidence/calendar-direct-planning.png')});
  await page.getByRole('button',{name:'Скрыть список задач',exact:true}).click();await expect(panel).toHaveCount(0);await page.reload();await expect(panel).toHaveCount(0);
  await showCalendarTasks(page);await expect(panel).toBeVisible();
  report.checks.push('task list hides with close button, persists through reload, and restores from toolbar');
  expect(host.errors).toEqual([]);expect(host.external).toEqual([]);report.status='PASS';
} catch(error){report.status='FAIL';report.failure=error.stack;process.exitCode=1;if(host)await host.page.screenshot({path:path.join(root,'docs/evidence/calendar-direct-failure.png')}).catch(()=>{})}
finally {if(host){report.errors=host.errors;report.external=host.external;await host.close().catch(e=>{report.closeError=e.message;process.exitCode=1})}await fs.writeFile(path.join(root,'docs/evidence/calendar-direct-native.json'),JSON.stringify(report,null,2));console.log(report)}
