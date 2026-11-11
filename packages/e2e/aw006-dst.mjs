import fs from 'node:fs/promises';import path from 'node:path';import {expect} from '@playwright/test';import {nativeHost,root} from './native-host.mjs';
const host=await nativeHost({name:'aw006-dst',port:9241}),{page}=host,report={status:'RUNNING',profile:host.profile,checks:[]};
try{
  const session=await page.context().newCDPSession(page);await session.send('Emulation.setTimezoneOverride',{timezoneId:'Europe/Berlin'});
  await page.evaluate(async()=>{
    const calendar={id:'dst-cal',title:'DST',description:'',color:'#7866d5',visible:true,favorite:false,sourceBoardIds:[],showDeadlines:false,order:0,reschedule:'manual',horizon:14,updatedAt:1,deletedAt:null};
    const event={calendarId:'dst-cal',title:'Первая 02:15',description:'',kind:'event',start:'2026-10-25T00:15:00Z',end:'2026-10-25T00:45:00Z',timeZone:'Europe/Berlin',allDay:false,status:'planned',links:[],priority:'medium',flexible:false,pinned:false,syncCompletion:false,allowArchived:false,updatedAt:1,deletedAt:null};
    const state={schemaVersion:1,updatedAt:1,calendars:[calendar],events:[{...event,id:'dst-first'},{...event,id:'dst-second',title:'Вторая 02:15',start:'2026-10-25T01:15:00Z',end:'2026-10-25T01:45:00Z'}],profiles:[]};
    const r=indexedDB.open('bordena'),db=await new Promise(ok=>r.onsuccess=()=>ok(r.result));await new Promise((ok,no)=>{const tx=db.transaction('meta','readwrite');tx.oncomplete=ok;tx.onerror=()=>no(tx.error);tx.objectStore('meta').put(state,'bordena:calendar')});db.close();
    const prefs=JSON.parse(localStorage.getItem('bordena:preferences:v1')??'{}');localStorage.setItem('bordena:preferences:v1',JSON.stringify({...prefs,language:'en',theme:'dark'}));
    localStorage.setItem('bordena:calendar:view',JSON.stringify({view:'day',date:'2026-10-25',zoom:64}));history.replaceState(null,'','/calendar');
  });
  await page.reload();await page.locator('[data-calendar-view]').waitFor();
  const first=page.locator('[data-calendar-event="dst-first"]'),second=page.locator('[data-calendar-event="dst-second"]');await first.scrollIntoViewIfNeeded();
  const a=await first.boundingBox(),b=await second.boundingBox();expect(b.y-a.y).toBeGreaterThan(60);
  expect((await page.locator('[data-calendar-day="2026-10-25"]').boundingBox()).height).toBe(25*64);
  await page.screenshot({path:path.join(root,'docs/evidence/aw006-calendar-dst-dark.png')});
  await page.setViewportSize({width:640,height:600});await expect(page.getByRole('button',{name:'Create event',exact:true})).toBeVisible();await page.screenshot({path:path.join(root,'docs/evidence/aw006-calendar-small-en.png')});
  report.checks.push('two ambiguous 02:15 intervals occupy different visible positions on a 25-hour native day','English labels, dark theme and compact width keep primary controls accessible');expect(host.errors).toEqual([]);expect(host.external).toEqual([]);report.status='PASS';
}catch(error){report.status='FAIL';report.failure=error.stack;process.exitCode=1}
finally{await host.close();await fs.writeFile(path.join(root,'docs/evidence/aw006-dst.json'),JSON.stringify(report,null,2));console.log(report)}
