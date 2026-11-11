import {selectCalendarView,showCalendarTasks,newCalendar} from './native-host.mjs';
import fs from 'node:fs/promises';import path from 'node:path';import {expect} from '@playwright/test';import {nativeHost,root,delay} from './native-host.mjs';
import {execFile} from 'node:child_process';import {promisify} from 'node:util';
const report={status:'RUNNING',checks:[],performance:{}},host=await nativeHost({name:'aw006-integration',port:9240}),{page,rows}=host;report.profile=host.profile;
const go=async route=>{await page.evaluate(route=>{history.pushState(null,'',route);dispatchEvent(new PopStateEvent('popstate'))},route)};
const getState=()=>page.evaluate(async()=>{const r=indexedDB.open('bordena'),db=await new Promise(ok=>r.onsuccess=()=>ok(r.result)),req=db.transaction('meta').objectStore('meta').get('bordena:calendar');const value=await new Promise(ok=>req.onsuccess=()=>ok(req.result));db.close();return value});
try{
  const card=(await rows('cards'))[0],column=(await rows('columns')).find(c=>c.id===card.columnId),now=Date.now();
  const calendar={id:'qa-calendar',title:'Работа',description:'',color:'#7866d5',visible:true,favorite:false,sourceBoardIds:[],showDeadlines:true,order:0,reschedule:'smart',profileId:'qa-profile',horizon:7,updatedAt:1,deletedAt:null};
  const event={id:'qa-block',calendarId:calendar.id,title:'Рабочая сессия',description:'',kind:'block',start:new Date(now-3600000).toISOString(),end:new Date(now-1800000).toISOString(),timeZone:'UTC',allDay:false,status:'planned',links:[{type:'card',id:card.id}],priority:'medium',flexible:true,pinned:false,syncCompletion:false,allowArchived:false,updatedAt:1,deletedAt:null};
  const linked={...event,id:'qa-checklist-block',title:'Пункт чек-листа',start:new Date(now+3600000).toISOString(),end:new Date(now+5400000).toISOString(),links:[{type:'checklist',id:'qa-check',cardId:card.id}],flexible:false,syncCompletion:true};
  const state={schemaVersion:1,updatedAt:1,calendars:[calendar],events:[event,linked],profiles:[{id:'qa-profile',title:'Свободное время',color:'#7866d5',weekdays:[0,1,2,3,4,5,6],dates:[],excludedDates:[],intervals:[{start:0,end:1440}],breaks:[],updatedAt:1}]};
  // Fixture setup occurs only after nativeHost verified this isolated profile.
  await page.evaluate(async({state,card})=>{const r=indexedDB.open('bordena'),db=await new Promise(ok=>r.onsuccess=()=>ok(r.result));await new Promise((ok,no)=>{const tx=db.transaction(['meta','cards'],'readwrite');tx.oncomplete=ok;tx.onerror=()=>no(tx.error);tx.objectStore('meta').put(state,'bordena:calendar');tx.objectStore('cards').put({...card,body:'- [ ] [Работа](#bordena-task=qa-check)',deadline:'2099-12-31',stateId:undefined},card.id)});db.close()}, {state,card});
  await page.reload();await go('/calendar');
  await expect.poll(async()=>(await getState()).events.find(e=>e.id===event.id).execution?.result).toBe('moved');
  expect((await rows('cards')).find(c=>c.id===card.id).deadline).toBe('2099-12-31');
  await expect.poll(async()=>(await rows('history')).filter(h=>h.entityId===event.id&&h.data.reason==='calendar').length).toBe(1);
  const moved=(await getState()).events.find(e=>e.id===event.id);await page.reload();await delay(400);expect((await getState()).events.find(e=>e.id===event.id)).toEqual(moved);report.checks.push('shared scheduler moves missed work once, preserves deadline and durable history through reload');
  await go(`/d/${column.dashboardId}/c/${card.id}`);await page.getByRole('button',{name:'Закрыть карточку',exact:true}).waitFor();await page.getByRole('button',{name:'Действия с карточкой',exact:true}).last().click();await page.getByRole('menuitem',{name:'Открыть в отдельном окне',exact:true}).click();
  let popout;await expect.poll(async()=>{for(const p of host.browser.contexts().flatMap(context=>context.pages()))if(await p.evaluate(()=>window.__TAURI_INTERNALS__?.metadata?.currentWindow?.label).catch(()=>null)==='popout-'+card.id)popout=p;report.windows=await page.evaluate(()=>window.__TAURI_INTERNALS__.invoke('plugin:window|get_all_windows'));report.targets=await Promise.all(host.browser.contexts().flatMap(context=>context.pages()).map(async p=>({url:p.url(),label:await p.evaluate(()=>window.__TAURI_INTERNALS__?.metadata?.currentWindow?.label).catch(()=>null)})));return !!popout},{timeout:20000}).toBe(true);
  await go('/calendar');
  await popout.getByRole('button',{name:'Редактировать',exact:true}).waitFor();
  if(await popout.getByRole('button',{name:'Редактировать',exact:true}).count())await popout.getByRole('button',{name:'Редактировать',exact:true}).click();
  await popout.getByRole('textbox',{name:'Заметки',exact:true}).fill('- [x] [Переименовано](#bordena-task=qa-check)');
  await expect.poll(async()=>(await getState()).events.find(e=>e.id===linked.id).status).toBe('completed');
  expect((await rows('history')).filter(h=>h.entityId===linked.id&&h.data.reason==='calendar')).toHaveLength(1);
  await popout.evaluate(()=>window.__TAURI_INTERNALS__.invoke('plugin:window|destroy',{label:window.__TAURI_INTERNALS__.metadata.currentWindow.label})).catch(error=>{if(!/closed/.test(error.message))throw error});
  report.checks.push('card edit in a second native window completes stable checklist-linked work exactly once in the main coordinator');
  await go(`/d/${column.dashboardId}/c/${card.id}`);
  if(await page.getByRole('button',{name:'Редактировать',exact:true}).count())await page.getByRole('button',{name:'Редактировать',exact:true}).click();
  await page.getByRole('button',{name:'Закрыть карточку',exact:true}).waitFor();if(await page.getByRole('button',{name:'Редактировать',exact:true}).count())await page.getByRole('button',{name:'Редактировать',exact:true}).click();const notes=page.getByRole('textbox',{name:'Заметки',exact:true});await notes.fill('- [ ] Новый пункт');await notes.press('Control+Home');await notes.press('Shift+End');await notes.press('Shift+F10');
  await page.getByRole('button',{name:'Запланировать пункт чек-листа',exact:true}).click();
  await expect(page.getByRole('dialog').getByRole('heading',{name:'Изменить событие',exact:true})).toBeVisible();
  expect((await rows('cards')).find(c=>c.id===card.id).body).toMatch(/#bordena-task=/);
  expect((await getState()).events.some(e=>e.links.some(l=>l.type==='checklist'&&l.id!=='qa-check'))).toBe(true);
  await page.keyboard.press('Escape');report.checks.push('Shift+F10 schedules a checklist item using a portable stable Markdown anchor through the real editor');
  const anchoredBody=(await rows('cards')).find(c=>c.id===card.id).body;
  const openNotes=async()=>{await go(`/d/${column.dashboardId}/c/${card.id}`);await page.getByRole('button',{name:'Закрыть карточку',exact:true}).waitFor();await page.getByRole('button',{name:'Редактировать',exact:true}).click();return page.getByRole('textbox',{name:'Заметки',exact:true})};
  const wordNotes=await openNotes();await wordNotes.fill(anchoredBody+'\nСобытие в тексте');await wordNotes.press('Control+End');await wordNotes.press('Shift+Home');await wordNotes.press('Shift+F10');await page.getByRole('button',{name:'Добавить в календарь',exact:true}).click();
  await expect(page.getByRole('dialog').getByRole('heading',{name:'Изменить событие',exact:true})).toBeVisible();
  const wordEvent=(await getState()).events.find(e=>e.title==='Событие в тексте');expect(wordEvent.kind).toBe('event');await page.keyboard.press('Escape');
  const unlinkNotes=await openNotes();await unlinkNotes.press('Control+End');await unlinkNotes.press('Shift+Home');await unlinkNotes.press('Shift+F10');await expect(page.getByRole('button',{name:'Открыть календарное событие',exact:true})).toBeVisible();await page.getByRole('button',{name:'Удалить календарную связь',exact:true}).click();
  await expect.poll(async()=>(await rows('cards')).find(c=>c.id===card.id).body).toBe(anchoredBody+'\nСобытие в тексте');expect((await getState()).events.some(e=>e.id===wordEvent.id)).toBe(true);await go('/calendar');
  report.checks.push('ordinary words create standalone linked events; removing the Markdown calendar link preserves both the word and the event');
  const before=await getState();
  await page.evaluate(async before=>{const now=Date.now(),events=Array.from({length:1000},(_,i)=>({...before.events[0],id:'qa-event-'+i,title:'Событие '+i,kind:'event',start:new Date(now+i*60000).toISOString(),end:new Date(now+i*60000+3600000).toISOString(),links:[],flexible:false,execution:undefined}));for(let i=0;i<300;i++)events.push({...events[i],id:'qa-series-'+i,title:'Повторение '+i,recurrence:{frequency:'daily',interval:1}});const r=indexedDB.open('bordena'),db=await new Promise(ok=>r.onsuccess=()=>ok(r.result));await new Promise((ok,no)=>{const tx=db.transaction('meta','readwrite');tx.oncomplete=ok;tx.onerror=()=>no(tx.error);tx.objectStore('meta').put({...before,events},'bordena:calendar')});db.close()},before);
  const started=Date.now();await page.reload();await page.locator('[data-calendar-view]').waitFor();await expect.poll(()=>page.locator('[data-calendar-event]').count()).toBeGreaterThan(0);report.performance.load1300Ms=Date.now()-started;
  for(const mode of ['month','week','agenda']){const at=Date.now();await selectCalendarView(page,mode);await expect(page.locator('[data-calendar-view]')).toHaveAttribute('data-calendar-view',mode);if(mode==='month')await page.locator('.bordena-calendar-event').first().waitFor();else await expect.poll(()=>page.locator('[data-calendar-event]').count()).toBeGreaterThan(0);report.performance[mode+'Ms']=Date.now()-at}
  expect(await page.locator('[data-calendar-event]').count()).toBeLessThanOrEqual(300);
  await page.screenshot({path:path.join(root,'docs/evidence/aw006-calendar-stress.png')});
  report.performance.memory=JSON.parse((await promisify(execFile)('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(root,'scripts/measure-native-memory.ps1'),'-Profile',path.join(host.profile,'WebView2')])).stdout);
  report.checks.push('1000 events plus 300 unlimited series render bounded month/week/agenda views');
  expect(host.errors).toEqual([]);expect(host.external).toEqual([]);report.status='PASS';
}catch(error){report.status='FAIL';report.failure=error.stack;report.body=await page.locator('body').innerText().catch(()=>null);await page.screenshot({path:path.join(root,'docs/evidence/aw006-integration-failure.png')}).catch(()=>{});process.exitCode=1}
finally{report.errors=host.errors;report.external=host.external;await host.close().catch(e=>{report.closeError=e.message;process.exitCode=1});await fs.writeFile(path.join(root,'docs/evidence/aw006-integration.json'),JSON.stringify(report,null,2));console.log(report)}
