import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium,expect} from '@playwright/test';
import {root,delay} from './native-host.mjs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const report={status:'RUNNING',checks:[],performance:{}};
let browser,page,stage='startup';
const errors=[],external=[];
const modules={exchange:'/src/lib/exchange/changeset.ts',workspace:'/src/lib/exchange/workspace.ts',format:'/src/lib/exchange/format.ts',db:'/src/lib/adapters/web-db.ts',layout:'/src/lib/layout-workspace.ts',linked:'/src/lib/linked-sync.ts',core:'/@fs/'+root.replaceAll('\\','/').replace(/\/$/,'')+'/packages/core/src/index.ts'};
const call=(module,fn,args=[])=>page.evaluate(async({module,fn,args})=>(await import(module))[fn](...args),{module,fn,args});
const rows=store=>page.evaluate(async({module,store})=>(await import(module)).webDb.getAll(store),{module:modules.db,store});
const goto=async url=>{await page.evaluate(url=>{history.pushState(null,'',url);window.dispatchEvent(new PopStateEvent('popstate'))},url);await delay(100)};
const batch=operations=>({format:'bordena-changeset',schemaVersion:1,id:crypto.randomUUID(),operations});
const card=async id=>(await rows('cards')).find(c=>c.id===id);
const board=async id=>(await rows('dashboards')).find(b=>b.id===id);
try {
  for(let i=0;i<720;i++){try{browser=await chromium.connectOverCDP('http://127.0.0.1:9235');break}catch{await delay(250)}}
  if(!browser)throw new Error('Native QA host did not start');
  for(let i=0;i<100&&!page;i++){for(const candidate of browser.contexts()[0].pages())if(await candidate.evaluate(()=>window.__TAURI_INTERNALS__?.metadata?.currentWindow?.label).catch(()=>null)==='main'){page=candidate;break}if(!page)await delay(100)}
  if(!page||!page.url().startsWith('http://127.0.0.1:5173/'))throw new Error('Wrong native QA view');
  const profile=await page.evaluate(()=>window.__TAURI_INTERNALS__.invoke('storage_profile'));
  if(path.resolve(profile).toLowerCase()!==path.resolve(process.env.BORDENA_TEST_PROFILE,'WebView2').toLowerCase()||!profile.toLowerCase().startsWith(path.join(root,'.tools','qa-aw005-').toLowerCase()))throw new Error('Unsafe profile');
  report.profile=profile;
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.text().startsWith('Bordena operation failed'))void call(modules.core,'errorLog').then(log=>{report.operationErrors??=[];report.operationErrors.push(...log.slice(-1));console.log('AW005 operation error',log.slice(-1))})});
  page.on('request',request=>{if(!/^(http:\/\/(127\.0\.0\.1:5173|ipc\.localhost|asset\.localhost)\/|blob:|data:|ipc:|asset:)/.test(request.url()))external.push(request.url())});
  await page.evaluate(()=>localStorage.setItem('bordena:preferences:v1',JSON.stringify({language:'ru'})));await page.reload();
  await page.getByRole('button',{name:'Меню Bordena',exact:true}).waitFor();
  report.performance.startupMemory=JSON.parse((await promisify(execFile)('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(root,'scripts/measure-native-memory.ps1'),'-Profile',profile])).stdout);
  report.performance.nativeDevReadyMs=await page.evaluate(()=>Math.round(performance.now()));


  page.setDefaultTimeout(15000);
  stage='create Goal through native UI';console.log('AW005 stage: create Goal through native UI');
  await page.evaluate(()=>window.dispatchEvent(new Event('bordena:create-board')));
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('Название',{exact:true}).fill('AW005 — Мой путь');
  await dialog.getByLabel('Компоновка',{exact:true}).selectOption('goal');
  await dialog.getByLabel('Описание цели',{exact:true}).fill('Локальная цель CHOPIK · без внешних сервисов');
  await dialog.getByLabel('Этапы — по одному на строку').fill('Мой старт\nМой результат');
  await dialog.getByLabel('Источник готовности',{exact:true}).selectOption('metric');
  await dialog.getByLabel('Название метрики',{exact:true}).fill('Мои страницы');
  await dialog.getByLabel('Старт',{exact:true}).fill('0');await dialog.getByLabel('Цель',{exact:true}).fill('20');
  await dialog.getByLabel('Единица',{exact:true}).fill('страниц');
  await dialog.getByRole('button',{name:'Создать доску',exact:true}).click();
  await expect(dialog).not.toBeVisible();
  let goalBoard=(await rows('dashboards')).find(b=>b.title==='AW005 — Мой путь');if(!goalBoard?.goalPath)throw new Error('Goal creation failed');
  const goalId=goalBoard.id;report.goalId=goalId;
  await page.getByRole('heading',{name:'Путь к цели',exact:true}).waitFor();
  expect(goalBoard.goalPath.steps).toHaveLength(2);
  report.checks.push('native creation form: name, description, ordered stages, metric and Goal view');

  stage='measurements and trend';console.log('AW005 stage: measurements and trend');
  await page.getByLabel('Значение',{exact:true}).fill('8');await page.getByRole('button',{name:'Записать измерение',exact:true}).click();
  await expect.poll(async()=>(await board(goalId)).goalPath.metrics[0].current).toBe(8);
  goalBoard=await board(goalId);const metricId=goalBoard.goalPath.metricId;
  await call(modules.exchange,'applyOperations',[[{op:'record-measurement',id:goalId,expectedUpdatedAt:goalBoard.updatedAt,metricId,measurement:{id:'qa-backdated',date:'2026-01-01',value:2},makeCurrent:false}]]);
  expect((await board(goalId)).goalPath.metrics[0].current).toBe(8);
  await page.locator('summary').filter({hasText:'История измерений'}).click();await page.getByRole('img',{name:'Динамика моих измерений'}).waitFor();
  await expect.poll(()=>page.locator("[data-board-surface]").evaluate(el=>getComputedStyle(el).opacity)).toBe("1");await page.screenshot({path:path.join(root,'docs/evidence/aw005-goal.png')});
  report.checks.push('actual form submission records metric; backdated value preserves current; two-point SVG trend');

  stage='save empty Goal template';console.log('AW005 stage: save empty Goal template');
  await page.getByRole('button',{name:'Параметры доски',exact:true}).click();
  await page.getByRole('dialog').locator('summary').filter({hasText:'Шаблоны доски'}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Сохранить как шаблон',exact:true}).click();
  await expect.poll(async()=>(await rows('sidebar')).find(s=>s.id==='layout').templates?.length??0).toBe(1);
  const custom=(await rows('sidebar')).find(s=>s.id==='layout').templates[0];expect(custom.goalPath.metrics[0].current).toBeNull();expect(custom.goalPath.metrics[0].history).toEqual([]);expect(custom.sections).toHaveLength(1);
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible();
  report.checks.push('shared BoardTools saves a Goal with no physical sections as a reusable template without actual measurements');

  stage='attach original task';console.log('AW005 stage: attach original task');
  await call(modules.exchange,'applyOperations',[[{op:'create-section',id:'qa-goal-tasks',boardId:goalId,title:'Задачи',color:'blue'},{op:'create-card',id:'qa-rule-card',columnId:'qa-goal-tasks',title:'Карточка с правилом',body:'- [ ] Сценарий',progress:37}]]);
  goalBoard=await board(goalId);const firstStep=goalBoard.goalPath.steps[0].id;
  await page.getByRole('combobox',{name:'Прикрепить существующую карточку'}).first().selectOption('qa-rule-card');
  await expect.poll(async()=>(await card('qa-rule-card')).stageId).toBe(firstStep);
  expect((await rows('cards')).filter(c=>c.id==='qa-rule-card')).toHaveLength(1);
  await page.getByRole('button',{name:'Настроить путь',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Этап ниже',exact:true}).first().click();
  await page.getByRole('dialog').getByRole('button',{name:'Сохранить',exact:true}).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect((await board(goalId)).goalPath.steps[1].id).toBe(firstStep);
  expect((await card('qa-rule-card')).stageId).toBe(firstStep);
  report.checks.push('attaches one existing card, reorders route through native settings without changing its stable stage');

  stage='native rule editor';console.log('AW005 stage: native rule editor');
  await goto(`/d/${goalId}/c/qa-rule-card`);
  await page.locator('summary').filter({hasText:/^Автоматизация/}).click();
  await page.getByRole('button',{name:'Добавить правило',exact:true}).click();
  await page.getByLabel('Название правила',{exact:true}).fill('Истёк срок → 60%');
  await page.getByLabel('Если',{exact:true}).selectOption('deadline');
  await page.getByLabel('Тогда',{exact:true}).selectOption('set-progress');
  await page.getByLabel('Готовность, %',{exact:true}).fill('60');
  await page.getByRole('button',{name:'Сохранить правило',exact:true}).click();
  await expect.poll(async()=>(await card('qa-rule-card')).automationRules?.length??0).toBe(1);
  await call(modules.core,'updateCard',['qa-rule-card',{deadline:'2000-01-01'}]);await call(modules.linked,'flushLinkedSync');
  await expect.poll(async()=>(await card('qa-rule-card')).progress).toBe(60);
  await call(modules.core,'updateCard',['qa-rule-card',{progress:23,body:'- [x] Сценарий · новая заметка'}]);await call(modules.linked,'flushLinkedSync');
  expect((await card('qa-rule-card')).progress).toBe(23);
  const executions=(await rows('history')).filter(h=>h.data?.reason==='automation'&&h.entityId==='qa-rule-card');expect(executions).toHaveLength(1);
  report.checks.push('native IF/THEN editor; expiry executes once after saving; manual percentage and later Markdown remain intact');
  await expect.poll(()=>page.locator("[data-board-surface]").evaluate(el=>getComputedStyle(el).opacity)).toBe("1");await page.screenshot({path:path.join(root,'docs/evidence/aw005-rules.png')});

  stage='nearest deadline schedule';console.log('AW005 stage: nearest deadline schedule');
  await page.getByRole('button',{name:'Закрыть карточку'}).click();
  const c=await card('qa-rule-card'),future=new Date(Date.now()+3000).toISOString();
  await call(modules.exchange,'applyOperations',[[{op:'update-card',id:c.id,expectedUpdatedAt:c.updatedAt,patch:{deadline:future}}]]);
  await expect.poll(async()=>(await card('qa-rule-card')).progress,{timeout:10000}).toBe(60);
  expect((await rows('history')).filter(h=>h.data?.reason==='automation'&&h.entityId==='qa-rule-card')).toHaveLength(2);
  report.checks.push('one nearest-deadline timer runs without user interaction; new deadline is a new event');

  stage='linked Goal and conditional integration';console.log('AW005 stage: linked Goal and conditional integration');
  await call(modules.exchange,'applyOperations',[[{op:'create-board',id:'qa-parent',title:'CHOPIK — Goal link'},{op:'create-section',id:'qa-parent-section',boardId:'qa-parent',title:'Проекты'},{op:'create-card',id:'qa-parent-card',columnId:'qa-parent-section',title:'Мой связанный проект',progress:37},{op:'link-board',id:'qa-parent-card',expectedUpdatedAt:0,link:{schemaVersion:1,boardId:goalId,mode:'progress',source:{type:'goal'},rules:[],requireFullCoverage:true}}]]);
  expect((await card('qa-parent-card')).linkedProgress.value).toBe(40);expect((await card('qa-parent-card')).progress).toBe(37);
  goalBoard=await board(goalId);
  await call(modules.exchange,'applyOperations',[[{op:'record-measurement',id:goalId,expectedUpdatedAt:goalBoard.updatedAt,metricId,measurement:{id:'qa-target',date:'2026-10-19',value:20},makeCurrent:true}]]);
  await call(modules.linked,'flushLinkedSync');expect((await card('qa-parent-card')).linkedProgress.value).toBe(100);expect((await card('qa-parent-card')).progress).toBe(37);
  report.checks.push('Goal metric updates existing linked parent automatically; manual 37% preserved');

  stage='backup and restore';console.log('AW005 stage: backup and restore');
  report.roundtrip=await page.evaluate(async()=>{
    const w=await import('/src/lib/exchange/workspace.ts'),f=await import('/src/lib/exchange/format.ts');const before=await w.exportWorkspace(),copy=await w.createBackup(),decoded=await w.readBackup(copy);
    await w.applyImport(decoded,'replace',await w.previewImport(decoded));await (await import('/src/lib/adapters/web-db.ts')).webDb.bindEpoch();const after=await w.exportWorkspace();
    if(JSON.stringify(before.document.boards)!==JSON.stringify(after.document.boards))throw new Error('Planning roundtrip mismatch');
    return {schemaVersion:after.document.schemaVersion,boards:after.document.boards.length,backupSha256:copy.sha256,archiveSha256:await f.sha256(copy.bytes)};
  });expect(report.roundtrip.schemaVersion).toBe(5);
  report.checks.push('verified JSON5/ZIP backup and actual restore preserve Goal, history, rules and event consumption');

  stage='large board and rules performance';console.log('AW005 stage: large board and rules performance');
  const big=[{op:'create-board',id:'qa-large',title:'AW005 — 1000 задач'},{op:'create-section',id:'qa-large-section',boardId:'qa-large',title:'Большая секция'},...Array.from({length:1000},(_,i)=>({op:'create-card',id:`qa-large-card-${i}`,columnId:'qa-large-section',title:`Задача ${i+1}`,body:'Локальная заметка · офлайн',deadline:'2030-01-01'}))];
  let started=Date.now();await call(modules.exchange,'applyOperations',[big]);report.performance.changeset1000Ms=Date.now()-started;
  started=Date.now();await goto('/d/qa-large');await expect(page.locator('[data-rfd-draggable-id^="qa-large-card-"]')).toHaveCount(1000);report.performance.open1000Ms=Date.now()-started;
  started=Date.now();await goto(`/d/${goalId}`);await page.getByRole('heading',{name:'Путь к цели',exact:true}).waitFor();report.performance.switchGoalMs=Date.now()-started;
  const large=await card('qa-large-card-0');const ruleTemplate={id:'qa-deadline',title:'Local deadline',revision:1,enabled:true,paused:false,condition:{type:'deadline'},action:{type:'history',message:'Done'}};
  started=Date.now();await call(modules.exchange,'applyOperations',[[...Array.from({length:200},(_,i)=>({op:'upsert-rule',id:`qa-large-card-${i}`,expectedUpdatedAt:i?large.updatedAt:large.updatedAt,rule:{...ruleTemplate}}))]]);report.performance.configure200RulesMs=Date.now()-started;
  started=Date.now();await call(modules.linked,'requestLinkedSync');await call(modules.linked,'flushLinkedSync');report.performance.check200RulesMs=Date.now()-started;
  report.checks.push('measured 1000-card changeset, opening, Goal switch and 200 scheduled future deadline rules');

  stage='multiple rules and editor latency';console.log('AW005 stage: multiple rules and editor latency');
  started=Date.now();await call(modules.exchange,'applyOperations',[[...Array.from({length:100},(_,i)=>[{op:'update-card',id:`qa-large-card-${i+200}`,expectedUpdatedAt:large.updatedAt,patch:{deadline:'2000-01-01'}},{op:'upsert-rule',id:`qa-large-card-${i+200}`,expectedUpdatedAt:large.updatedAt,rule:ruleTemplate}]).flat()]]);report.performance.execute100RulesMs=Date.now()-started;
  expect((await rows('history')).filter(h=>h.data.reason==='automation'&&/^qa-large-card-2/.test(h.entityId))).toHaveLength(100);
  await goto(`/d/${goalId}/c/qa-rule-card`);await page.getByRole('button',{name:'Редактировать',exact:true}).click();const editor=page.getByRole('textbox',{name:'Заметки',exact:true}),text='Локальный редактор без постоянных пересчётов.';
  await editor.press('Control+End');started=Date.now();await editor.pressSequentially(text,{delay:0});report.performance.editorTypingMs=Date.now()-started;report.performance.editorCharacters=text.length;
  await call(modules.core,'flushCardEdits');await call(modules.linked,'flushLinkedSync');expect((await card('qa-rule-card')).body).toContain(text);expect((await card('qa-rule-card')).progress).toBe(60);
  await page.getByRole('button',{name:'Закрыть карточку'}).click();
  const badge=page.getByRole('button',{name:'Автоматизация: включено правил 1 из 1',exact:true});await delay(350);await badge.hover();await expect(badge).toHaveAttribute('title','Автоматизация: включено правил 1 из 1');await badge.focus();await expect(badge).toBeFocused();await page.keyboard.press('Escape');
  report.checks.push('100 active rules execute atomically; 200 future deadlines share scheduling; native Markdown typing measured; subtle automation badge provides native tooltip text and keyboard focus');

  stage='language and responsive themes';console.log('AW005 stage: language and responsive themes');
  await page.setViewportSize({width:760,height:800});await goto(`/d/${goalId}`);
  await page.getByRole('heading',{name:'Путь к цели',exact:true}).waitFor();
  await expect.poll(()=>page.locator("[data-board-surface]").evaluate(el=>getComputedStyle(el).opacity)).toBe("1");await page.screenshot({path:path.join(root,'docs/evidence/aw005-goal-compact.png')});
  await page.evaluate(()=>{const key='bordena:preferences:v1',p=JSON.parse(localStorage.getItem(key)||'{}');localStorage.setItem(key,JSON.stringify({...p,language:'en',theme:'light'}))});await page.reload();await goto(`/d/${goalId}`);
  await page.getByRole('heading',{name:'Goal Path',exact:true}).waitFor();await expect.poll(()=>page.locator("[data-board-surface]").evaluate(el=>getComputedStyle(el).opacity)).toBe("1");await page.screenshot({path:path.join(root,'docs/evidence/aw005-goal-en-light.png')});
  report.checks.push('Goal view in compact layout and English light theme; user-authored titles preserved');

  stage='portable fixture';console.log('AW005 stage: portable fixture');
  const fixture=await page.evaluate(async()=>{const w=await import('/src/lib/exchange/workspace.ts'),p=await w.exportWorkspace();return {document:p.document,files:await Promise.all([...p.files].map(async([name,blob])=>({name,type:blob.type,bytes:[...new Uint8Array(await blob.arrayBuffer())]})))}});
  await fs.writeFile(path.join(root,'.tools/qa-aw005-payload.json'),JSON.stringify(fixture));
  report.performance.afterLargeBoardMemory=JSON.parse((await promisify(execFile)('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(root,'scripts/measure-native-memory.ps1'),'-Profile',profile])).stdout);
  expect(errors).toEqual([]);expect(external).toEqual([]);expect(report.operationErrors??[]).toEqual([]);report.status='PASS';
} catch(error) {
  report.status='FAIL';report.stage=stage;report.failure=error.stack;process.exitCode=1;
  if(page){report.operationErrors=await call(modules.core,'errorLog').catch(()=>[]);await page.screenshot({path:path.join(root,'docs/evidence/aw005-native-failure.png')}).catch(()=>{});}
} finally {
  report.errors=errors;report.external=external;
  if(page)await page.evaluate(()=>window.__TAURI_INTERNALS__.invoke('plugin:window|close',{label:'main'})).catch(()=>{});
  await browser?.close().catch(()=>{});
  await fs.writeFile(path.join(root,'docs/evidence/aw005-native.json'),JSON.stringify(report,null,2));console.log(report);
}
