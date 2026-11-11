import {selectCalendarView,showCalendarTasks,newCalendar} from './native-host.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {expect} from '@playwright/test';
import {nativeHost,root,delay} from './native-host.mjs';
const report={status:'RUNNING',checks:[],performance:{}};
let host;
try {
  host=await nativeHost({name:'aw006-calendar',port:9239});const {page,rows}=host;
  report.profile=host.profile;
  await newCalendar(page);
  const calendarDialog=page.getByRole('dialog');
  await expect(calendarDialog.getByRole('heading',{name:'Настройки календаря',exact:true})).toBeVisible();
  await calendarDialog.getByRole('textbox',{name:'Название',exact:true}).fill('Работа');
  await calendarDialog.getByRole('button',{name:'Сохранить',exact:true}).click();
  await expect(calendarDialog).toHaveCount(0);
  const readCalendar=()=>page.evaluate(async()=>{const r=indexedDB.open('bordena'),db=await new Promise(ok=>r.onsuccess=()=>ok(r.result)),get=db.transaction('meta').objectStore('meta').get('bordena:calendar');const state=await new Promise(ok=>get.onsuccess=()=>ok(get.result));db.close();return state});
  await expect.poll(async()=>(await readCalendar())?.calendars?.length).toBe(1);
  report.checks.push('sidebar Add calendar works on first navigation and creates a manual calendar');
  const createdIds=[];
  const now=new Date(),localDay=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  for(const [title,start,end] of [['Монтаж','11:00','12:00'],['Проверка','11:30','12:30'],['Личное','11:45','12:15']]){
    await page.getByRole('button',{name:'Создать событие',exact:true}).click();
    const dialog=page.getByRole('dialog');await dialog.getByRole('textbox',{name:'Название',exact:true}).fill(title);
    await dialog.locator('input[type="datetime-local"]').nth(0).fill(localDay+'T'+start);
    await dialog.locator('input[type="datetime-local"]').nth(1).fill(localDay+'T'+end);
    await dialog.getByRole('button',{name:'Сохранить',exact:true}).click();
    await expect(dialog).toHaveCount(0);
    const state=await readCalendar();createdIds.push(state.events.find(e=>e.title===title).id);
  }
  const view={selectOption:value=>selectCalendarView(page,value)};await view.selectOption('day');
  await page.getByRole('button',{name:'Сегодня',exact:true}).click();
  await expect(page.locator('[data-calendar-event]')).toHaveCount(3);
  const boxes=await Promise.all(createdIds.map(id=>page.locator(`[data-calendar-event="${id}"]`).boundingBox()));
  expect(boxes.every(Boolean)).toBe(true);expect(boxes[0].x).not.toBe(boxes[1].x);expect(boxes[1].x).not.toBe(boxes[2].x);
  await page.screenshot({path:path.join(root,'docs/evidence/aw006-calendar-day.png')});
  report.checks.push('three overlapping intervals keep independent horizontal columns');
  const original=(await readCalendar()).events.find(e=>e.id===createdIds[0]);
  const block=page.locator(`[data-calendar-event="${original.id}"]`);await block.scrollIntoViewIfNeeded();const beforeBox=await block.boundingBox();
  await page.mouse.move(beforeBox.x+beforeBox.width/2,beforeBox.y+10);await page.mouse.down();await page.mouse.move(beforeBox.x+beforeBox.width/2,beforeBox.y+74,{steps:10});await page.mouse.up();
  await expect.poll(async()=>(await readCalendar()).events.find(e=>e.id===original.id).start).not.toBe(original.start);
  const moved=(await readCalendar()).events.find(e=>e.id===original.id);
  await page.keyboard.press('Control+z');await expect.poll(async()=>(await readCalendar()).events.find(e=>e.id===original.id).start).toBe(original.start);
  await page.keyboard.press('Control+Shift+z');await expect.poll(async()=>(await readCalendar()).events.find(e=>e.id===original.id).start).toBe(moved.start);
  await block.scrollIntoViewIfNeeded();const escapeBox=await block.boundingBox();
  await page.mouse.move(escapeBox.x+20,escapeBox.y+10);await page.mouse.down();await page.mouse.move(escapeBox.x+20,escapeBox.y+80,{steps:10});await page.keyboard.press('Escape');await page.mouse.up();expect((await readCalendar()).events.find(e=>e.id===original.id).start).toBe(moved.start);
  report.checks.push('pointer movement, Undo/Redo and Escape preserve source identity');
  const resize=block.locator('[aria-label="Изменить длительность"]');await resize.scrollIntoViewIfNeeded();const resizeBox=await resize.boundingBox();
  await page.mouse.move(resizeBox.x+resizeBox.width/2,resizeBox.y+resizeBox.height/2);await page.mouse.down();await page.mouse.move(resizeBox.x+resizeBox.width/2,resizeBox.y+resizeBox.height/2+32,{steps:8});await page.mouse.up();
  await expect.poll(async()=>(await readCalendar()).events.find(e=>e.id===original.id).end).not.toBe(moved.end);
  report.checks.push('bottom-edge resize changes the end while retaining the start');
  await newCalendar(page);
  await page.getByRole('dialog').getByRole('textbox',{name:'Название',exact:true}).fill('Личное');await page.getByRole('dialog').getByRole('button',{name:'Сохранить',exact:true}).click();
  await expect.poll(async()=>(await readCalendar()).calendars.length).toBe(3);
  const calendars=(await readCalendar()).calendars,filter=page.getByRole('combobox',{name:'Календари',exact:true});
  await filter.selectOption(calendars.find(c=>c.title==='Личное').id);await expect(page.locator('[data-calendar-event]')).toHaveCount(0);
  await filter.selectOption('all');await expect(page.locator('[data-calendar-event]')).toHaveCount(3);
  report.checks.push('a second calendar can be created from the already open calendar; filtering never duplicates or deletes records');
  for(const mode of ['week','month','agenda']){const at=Date.now();await view.selectOption(mode);await expect(page.locator('[data-calendar-view]')).toHaveAttribute('data-calendar-view',mode);report.performance[mode+'SwitchMs']=Date.now()-at;}
  await page.screenshot({path:path.join(root,'docs/evidence/aw006-calendar-agenda.png')});
  const snapshot=await readCalendar();const profile=host.profile;
  expect(host.errors).toEqual([]);expect(host.external).toEqual([]);
  await host.close();host=null;host=await nativeHost({name:'aw006-calendar-restart',port:9239,profile});
  await host.page.waitForURL(/\/calendar$/);expect(await host.page.evaluate(()=>JSON.parse(localStorage.getItem('bordena:calendar:view')).view)).toBe('agenda');
  const stateAfter=await host.page.evaluate(async()=>{const r=indexedDB.open('bordena'),db=await new Promise(ok=>r.onsuccess=()=>ok(r.result)),get=db.transaction('meta').objectStore('meta').get('bordena:calendar');const value=await new Promise(ok=>get.onsuccess=()=>ok(get.result));db.close();return value});
  expect(stateAfter).toEqual(snapshot);report.checks.push('all four views, native restart and restored calendar tab/view preserve records');
  expect(host.errors).toEqual([]);expect(host.external).toEqual([]);report.status='PASS';
}catch(error){report.status='FAIL';report.failure=error.stack;process.exitCode=1;if(host){report.body=await host.page.locator('body').innerText().catch(()=>null);await host.page.screenshot({path:path.join(root,'docs/evidence/aw006-calendar-failure.png')}).catch(()=>{})}}
finally{if(host){report.errors=host.errors;report.external=host.external;await host.close().catch(error=>{report.closeError=error.message;process.exitCode=1})}await fs.writeFile(path.join(root,'docs/evidence/aw006-calendar.json'),JSON.stringify(report,null,2));console.log(report)}
