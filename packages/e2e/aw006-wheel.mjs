import {selectCalendarView,showCalendarTasks,newCalendar} from './native-host.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {expect} from '@playwright/test';
import {nativeHost,root} from './native-host.mjs';
const report={status:'RUNNING',checks:[],samples:{}};let host;
try{
  host=await nativeHost({name:'aw006-wheel',port:9245});const {page,rows}=host;report.profile=host.profile;
  const card=(await rows('cards'))[0];
  await page.evaluate(async card=>{const r=indexedDB.open('bordena'),db=await new Promise(ok=>r.onsuccess=()=>ok(r.result));await new Promise((ok,no)=>{const tx=db.transaction('cards','readwrite');tx.oncomplete=ok;tx.onerror=()=>no(tx.error);for(let i=0;i<60;i++){const id='qa-wheel-task-'+i;tx.objectStore('cards').put({...card,id,title:'Задача прокрутки '+i,body:'',deadline:null,archived:false,deletedAt:null,attachments:[],updatedAt:Date.now()},id)}});db.close()},card);
  await page.reload();await page.getByRole('button',{name:'Календарь',exact:true}).click();
  await selectCalendarView(page,'day');
  await showCalendarTasks(page);
  const timeline=page.locator('[data-calendar-scroll="timeline"]'),tasks=page.locator('[data-calendar-scroll="tasks"]');
  async function scroll(locator,key){
    await expect(locator).toBeVisible();const box=await locator.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
    const before=await locator.evaluate(el=>{el.scrollTop=200;window.__qaWheelSamples=new Promise(resolve=>{const samples=[];const take=t=>{samples.push({t,top:el.scrollTop});if(samples.length<24)requestAnimationFrame(take);else resolve(samples)};requestAnimationFrame(take)});return el.scrollTop});
    await page.mouse.wheel(0,120);const samples=await page.evaluate(()=>window.__qaWheelSamples);report.samples[key]=samples;
    const values=samples.map(s=>s.top);expect(new Set(values).size).toBeGreaterThan(2);expect(values.some(top=>top>before&&top<before+119)).toBe(true);expect(Math.abs(values.at(-1)-before-120)).toBeLessThanOrEqual(1);
    for(let i=1;i<values.length;i++)expect(values[i]).toBeGreaterThanOrEqual(values[i-1]);
  }
  await scroll(timeline,'day');await scroll(tasks,'tasks');
  await selectCalendarView(page,'week');await scroll(timeline,'week');
  report.checks.push('trusted mouse wheel scrolls day/week and task list through multiple smooth frames while preserving the requested distance');
  const count=(await rows('cards')).length;
  await page.emulateMedia({reducedMotion:'reduce'});
  const native=await timeline.evaluate(el=>{const e=new WheelEvent('wheel',{deltaY:120,cancelable:true,bubbles:true});el.dispatchEvent(e);return !e.defaultPrevented});expect(native).toBe(true);
  expect((await rows('cards')).length).toBe(count);expect(host.errors).toEqual([]);expect(host.external).toEqual([]);
  report.checks.push('reduced-motion mode retains native scrolling and calendar/card data is unchanged');report.status='PASS';
}catch(error){report.status='FAIL';report.failure=error.stack;if(host)await host.page.screenshot({path:path.join(root,'docs/evidence/aw006-wheel-failure.png')}).catch(()=>{});process.exitCode=1}
finally{if(host){report.errors=host.errors;report.external=host.external;await host.close().catch(e=>{report.status='FAIL';report.closeError=e.message;process.exitCode=1})}await fs.writeFile(path.join(root,'docs/evidence/aw006-wheel-native.json'),JSON.stringify(report,null,2)+'\n');console.log({status:report.status,checks:report.checks,failure:report.failure})}
