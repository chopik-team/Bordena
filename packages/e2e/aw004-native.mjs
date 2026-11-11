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
  for(let i=0;i<720;i++){try{browser=await chromium.connectOverCDP('http://127.0.0.1:9232');break}catch{await delay(250)}}
  if(!browser)throw new Error('Native QA host did not start');
  for(let i=0;i<100&&!page;i++){for(const candidate of browser.contexts()[0].pages())if(await candidate.evaluate(()=>window.__TAURI_INTERNALS__?.metadata?.currentWindow?.label).catch(()=>null)==='main'){page=candidate;break}if(!page)await delay(100)}
  if(!page||!page.url().startsWith('http://127.0.0.1:5173/'))throw new Error('Wrong native QA view');
  const profile=await page.evaluate(()=>window.__TAURI_INTERNALS__.invoke('storage_profile'));
  if(path.resolve(profile).toLowerCase()!==path.resolve(process.env.BORDENA_TEST_PROFILE,'WebView2').toLowerCase()||!profile.toLowerCase().startsWith(path.join(root,'.tools','qa-aw004-').toLowerCase()))throw new Error('Unsafe profile');
  report.profile=profile;
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(!/^(http:\/\/(127\.0\.0\.1:5173|ipc\.localhost|asset\.localhost)\/|blob:|data:|ipc:|asset:)/.test(request.url()))external.push(request.url())});
  await page.evaluate(()=>localStorage.setItem('bordena:preferences:v1',JSON.stringify({language:'ru'})));await page.reload();
  await page.getByRole('button',{name:'Меню Bordena',exact:true}).waitFor();
  report.performance.startupMemory=JSON.parse((await promisify(execFile)('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(root,'scripts/measure-native-memory.ps1'),'-Profile',profile])).stdout);
  report.performance.nativeDevReadyMs=await page.evaluate(()=>Math.round(performance.now()));

  stage='changeset creation';
  const creation=batch([
    {op:'create-workspace',id:'qa-space',title:'CHOPIK QA'},
    {op:'create-project',id:'qa-project',workspaceId:'qa-space',title:'Видеопроекты'},
    {op:'create-board',id:'qa-parent',workspaceId:'qa-space',projectId:'qa-project',title:'CHOPIK AW004'},
    {op:'create-section',id:'qa-ideas',boardId:'qa-parent',title:'Идеи',color:'blue'},
    {op:'create-section',id:'qa-work',boardId:'qa-parent',title:'В работе',color:'violet'},
    {op:'create-section',id:'qa-final',boardId:'qa-parent',title:'Готово',done:true},
    {op:'create-card',id:'qa-fifa',columnId:'qa-ideas',title:'FIFA 23',body:'Сценарий FIFA 23',progress:37},
    {op:'create-board',id:'qa-child',title:'FIFA 23 — Производство'},
    {op:'create-section',id:'qa-script',boardId:'qa-child',title:'Сценарий'},
    {op:'create-section',id:'qa-done',boardId:'qa-child',title:'Выполнено',done:true},
    {op:'create-card',id:'qa-task-one',columnId:'qa-script',title:'Записать видео',body:'- [ ] Запись',progress:0},
    {op:'create-card',id:'qa-task-two',columnId:'qa-done',title:'Подготовить сценарий',body:'- [x] Сценарий',progress:100},
  ]);
  let started=Date.now();expect((await call(modules.exchange,'applyChangeset',[creation])).status).toBe('applied');report.performance.initialChangesetMs=Date.now()-started;
  expect((await call(modules.exchange,'applyChangeset',[creation])).status).toBe('duplicate');
  await page.evaluate(async({layoutModule})=>{
    const {changeLayout}=await import(layoutModule);
    await changeLayout('qa-parent',layout=>({...layout,lanes:[{id:'qa-left',title:'Основное'},{id:'qa-right',title:'Дополнительно'}],states:[...layout.states,{id:'qa-frozen',title:'Заморожено'}],sections:Object.fromEntries(Object.entries(layout.sections).map(([id,s])=>[id,{...s,laneId:'qa-left'}]))}));
    await changeLayout('qa-child',layout=>({...layout,lanes:[{id:'qa-child-left',title:'Работа'},{id:'qa-child-right',title:'Готово'}],sections:Object.fromEntries(Object.entries(layout.sections).map(([id,s])=>[id,{...s,laneId:id==='qa-done'?'qa-child-right':'qa-child-left'}]))}));
    const {queryClient}=await import('/@fs/C:/Bordena/packages/core/src/index.ts');await queryClient.invalidateQueries();
  },{layoutModule:modules.layout});
  await goto('/d/qa-parent');await page.getByText('FIFA 23',{exact:true}).first().waitFor();
  report.checks.push('Changeset creates workspace/project/boards/sections/cards atomically; duplicate is idempotent');

  stage='header drag and direct palette';
  const section=page.getByRole('region',{name:'Секция: Идеи',exact:true});
  await section.getByRole('button',{name:'Выбрать цвет секции',exact:true}).click();
  await page.getByRole('menuitem',{name:/Зел/}).click();
  await expect.poll(async()=>(await rows('columns')).find(c=>c.id==='qa-ideas').color).not.toBe('blue');
  const header=section.getByRole('button',{name:'Переместить секцию: Идеи',exact:true});
  const box=await header.boundingBox(),target=await page.locator('[data-layout-lane="qa-right"]').boundingBox();
  await page.mouse.move(box.x+box.width*0.56,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width*0.56+10,box.y+box.height/2,{steps:3});
  await page.mouse.move(target.x+150,target.y+90,{steps:20});await delay(200);await page.mouse.up();
  await expect.poll(async()=>(await board('qa-parent')).layout.sections['qa-ideas'].laneId).toBe('qa-right');
  expect((await card('qa-fifa')).progress).toBe(37);
  report.checks.push('whole colored header drag moves section and preserves cards; swatch opens keyboard-accessible palette');

  stage='stage state section selectors';
  await goto('/d/qa-parent/c/qa-fifa');
  await page.getByRole('combobox',{name:'Этап',exact:true}).selectOption('qa-work');
  await page.getByRole('combobox',{name:'Состояние',exact:true}).selectOption('qa-frozen');
  await page.getByRole('combobox',{name:'Секция карточки',exact:true}).selectOption('qa-work');
  await expect.poll(async()=>{const c=await card('qa-fifa');return [c.stageId,c.stateId,c.columnId]}).toEqual(['qa-work','qa-frozen','qa-work']);
  await page.getByRole('button',{name:'Закрыть карточку'}).click();await goto('/d/qa-parent/c/qa-fifa');
  await expect(page.getByRole('combobox',{name:'Состояние',exact:true})).toHaveValue('qa-frozen');
  report.checks.push('stage, state and physical section are independent, update live and survive card reopening');

  stage='link editor automatic progress';
  await page.locator('summary').filter({hasText:/^Связанная доска/}).click();
  await page.getByRole('combobox',{name:'Дочерняя доска'}).selectOption('qa-child');
  await page.getByRole('combobox',{name:'Режим связи'}).selectOption('auto-move');
  await page.getByRole('button',{name:'Добавить диапазон'}).click();
  await page.getByRole('spinbutton',{name:'До 1',exact:true}).fill('49');
  await page.getByRole('combobox',{name:'Целевой этап',exact:true}).first().selectOption('qa-ideas');
  await page.getByRole('button',{name:'Добавить диапазон'}).click();
  await page.getByRole('combobox',{name:'Целевой этап',exact:true}).nth(1).selectOption('qa-final');
  await page.getByRole('button',{name:'Сохранить связь'}).click();
  await expect.poll(async()=>(await card('qa-fifa')).linkedProgress?.value,{timeout:15000}).toBe(50);
  expect(await card('qa-fifa')).toMatchObject({progress:37,stateId:'qa-frozen',columnId:'qa-work',stageId:'qa-final'});
  await call(modules.core,'moveCardToColumn',['qa-task-one','qa-done']);await call(modules.linked,'flushLinkedSync');
  await expect.poll(async()=>(await card('qa-fifa')).linkedProgress?.value).toBe(100);
  const stable=(await card('qa-fifa')).updatedAt;
  await call(modules.linked,'requestLinkedSync',['qa-child']);await call(modules.linked,'flushLinkedSync');expect((await card('qa-fifa')).updatedAt).toBe(stable);
  await call(modules.core,'updateCard',['qa-task-one',{body:'Changed text only ё'}]);await delay(350);expect((await card('qa-fifa')).updatedAt).toBe(stable);
  report.checks.push('native post-commit progress propagation, explicit auto stage move, no state/section/manual overwrite, idempotence and text-only skip');

  stage='mirror source and position';
  await page.locator('summary').filter({hasText:/^Связанная доска/}).click();
  await page.locator('summary').filter({hasText:'Зеркала карточки'}).click();
  await page.getByRole('combobox',{name:'Доска для зеркала'}).selectOption('qa-child');await page.getByRole('combobox',{name:'Секция зеркала'}).selectOption('qa-script');
  await page.getByRole('button',{name:'Создать зеркало',exact:true}).click();
  await expect.poll(async()=>(await board('qa-child')).mirrors?.length,{timeout:15000}).toBe(1);
  const mirror=(await board('qa-child')).mirrors[0];await page.getByRole('button',{name:'Закрыть карточку'}).click();
  await goto('/d/qa-child');await page.locator(`[data-mirror-id="${mirror.id}"]`).waitFor();
  await page.locator(`[data-mirror-id="${mirror.id}"]`).getByText('FIFA 23',{exact:true}).click();
  const renameEdit=page.getByRole('button',{name:'Редактировать',exact:true});if(await renameEdit.isVisible())await renameEdit.click();
  await page.getByPlaceholder('Название',{exact:true}).fill('FIFA 23 — обновлено');await page.getByRole('button',{name:'Закрыть карточку'}).click();await goto('/d/qa-child');
  await expect(page.locator(`[data-mirror-id="${mirror.id}"]`).getByText('FIFA 23 — обновлено',{exact:true})).toBeVisible();
  expect((await rows('cards')).filter(c=>c.id==='qa-fifa')).toHaveLength(1);
  const originalColumn=(await card('qa-fifa')).columnId;
  await call(modules.exchange,'applyOperations',[[{op:'move-mirror',boardId:'qa-child',id:mirror.id,expectedUpdatedAt:(await board('qa-child')).updatedAt,patch:{columnId:'qa-done',position:'a1'}}]]);
  expect((await card('qa-fifa')).columnId).toBe(originalColumn);
  report.checks.push('mirror UI creates a reference, source edits update it, its placement does not move the original');

  stage='cycle rejection and child removal';
  const before=(await rows('cards')).length;
  let rejected=false;
  try{await call(modules.exchange,'applyOperations',[[{op:'link-board',id:'qa-task-two',expectedUpdatedAt:(await card('qa-task-two')).updatedAt,link:{schemaVersion:1,boardId:'qa-parent',mode:'navigation',source:{type:'tasks'},rules:[],requireFullCoverage:true}}]])}catch{rejected=true}
  expect(rejected).toBe(true);expect((await rows('cards')).length).toBe(before);
  await call(modules.core,'deleteDashboard',['qa-child']);await call(modules.linked,'flushLinkedSync');
  await expect.poll(async()=>(await card('qa-fifa')).linkedProgress?.reason).toBe('missing');expect((await card('qa-fifa')).progress).toBe(37);
  await call(modules.core,'restore',['dashboards','qa-child']);await call(modules.linked,'flushLinkedSync');
  await expect.poll(async()=>(await card('qa-fifa')).linkedProgress?.value).toBe(100);
  report.checks.push('cycle rejected without partial writes; deleting/restoring child keeps parent and resolves stable IDs');

  stage='template and custom field table';
  const templateBatch=batch([{op:'create-board',id:'qa-template',title:'Разработка QA'},{op:'apply-template',boardId:'qa-template',templateId:'builtin-software'}]);
  await call(modules.exchange,'applyChangeset',[templateBatch]);
  expect((await rows('columns')).filter(c=>c.dashboardId==='qa-template')).toHaveLength(5);
  expect((await rows('cards')).filter(c=>(['qa-template']).includes(c.columnId))).toHaveLength(0);
  await call(modules.exchange,'applyOperations',[[{op:'update-board',id:'qa-parent',expectedUpdatedAt:(await board('qa-parent')).updatedAt,patch:{fieldDefinitions:[{id:'qa-version',title:'Версия',type:'text'}]}}]]);
  await goto('/d/qa-parent/c/qa-fifa');await page.locator('summary').filter({hasText:'Дополнительные поля'}).click();
  const field=page.locator('label').filter({hasText:'Версия'}).getByRole('textbox');await field.fill('0.4');await field.press('Tab');
  await expect.poll(async()=>(await card('qa-fifa')).fieldValues?.['qa-version']).toBe('0.4');
  await page.getByRole('button',{name:'Закрыть карточку'}).click();await page.getByRole('button',{name:'Список',exact:true}).click();
  await expect(page.getByRole('table')).toBeVisible();await page.getByRole('textbox',{name:'Фильтр списка'}).fill('FIFA');await expect(page.getByRole('table').getByRole('row')).toHaveCount(2);
  await page.getByRole('table').getByRole('combobox',{name:/^Приоритет:/}).selectOption('high');await expect.poll(async()=>(await card('qa-fifa')).priority).toBe('high');
  report.checks.push('template creates fresh section IDs without demo cards; custom values and table edits share the same card');

  stage='selection links';
  await goto('/d/qa-parent/c/qa-fifa');const edit=page.getByRole('button',{name:'Редактировать',exact:true});if(await edit.isVisible())await edit.click();
  const editor=page.getByRole('textbox',{name:'Заметки',exact:true});await editor.fill('Подготовить сценарий FIFA 23');await editor.press('Control+a');await editor.click({button:'right'});
  await page.getByRole('dialog',{name:'Действия с текстом'}).waitFor();await page.getByRole('combobox',{name:'Объект ссылки'}).selectOption('qa-child');await page.getByRole('button',{name:'Вставить локальную ссылку'}).click();
  await expect.poll(async()=>(await card('qa-fifa')).body,{timeout:10000}).toContain('bordena://board/qa-child');
  report.checks.push('CodeMirror selection becomes a safe ID-based Markdown link without replacing the editor document');
  await page.getByRole('button',{name:'Просмотр',exact:true}).click();await page.locator('a[href="bordena://board/qa-child"]').click();await page.waitForURL(/\/d\/qa-child$/);
  await page.getByRole('button',{name:'Назад',exact:true}).click();await page.waitForURL(/\/d\/qa-parent\/c\/qa-fifa$/);
  await page.getByRole('button',{name:'Редактировать',exact:true}).click();

  stage='media playback';
  const image=await fs.readFile(path.join(root,'apps/desktop/src-tauri/icons/32x32.png'));
  const frame=Buffer.alloc(417);Buffer.from([0xff,0xfb,0x90,0x64]).copy(frame);const mp3=Buffer.concat(Array(40).fill(frame));
  const wav=Buffer.alloc(44+16000);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(16000,40);
  await page.evaluate(async files=>{
    const {LocalFiles}=await import('/src/lib/adapters/local-files.ts'),{updateCard}=await import('/@fs/C:/Bordena/packages/core/src/index.ts'),{webDb}=await import('/src/lib/adapters/web-db.ts');
    const current=await webDb.get('cards','qa-fifa'),attachments=[...current.attachments];
    for(const file of files){const bytes=new Blob([new Uint8Array(file.bytes)],{type:file.mime});const stored=await new LocalFiles().put('qa-fifa',{name:file.name,mime:file.mime,bytes});attachments.push({...stored,id:file.id,name:file.name})}
    await updateCard('qa-fifa',{attachments});const {queryClient}=await import('/@fs/C:/Bordena/packages/core/src/index.ts');await queryClient.invalidateQueries();
  },[{id:'qa-wav',name:'QA silence.wav',mime:'audio/wav',bytes:[...wav]},{id:'qa-mp3',name:'QA silence.mp3',mime:'audio/mpeg',bytes:[...mp3]},{id:'qa-image',name:'QA image.png',mime:'image/png',bytes:[...image]}]);
  await page.getByRole('button',{name:'QA image.png',exact:true}).click();
  const previewImage=page.getByRole('dialog').getByRole('img',{name:'QA image.png',exact:true});await expect.poll(()=>previewImage.evaluate(el=>el.naturalWidth)).toBe(32);await page.getByRole('dialog').getByRole('button',{name:'Закрыть',exact:true}).click();
  await page.locator('[data-slot="attachment"]').filter({hasText:'QA image.png'}).getByRole('button',{name:'Действия с вложением'}).click();await page.getByRole('menuitem',{name:'Удалить копию',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Удалить копию',exact:true}).click();await expect.poll(async()=>(await card('qa-fifa')).attachments.some(a=>a.id==='qa-image')).toBe(false);
  report.audio=[];
  for(const name of ['QA silence.wav','QA silence.mp3']){
    await page.getByRole('button',{name,exact:true}).click();const audio=page.getByRole('dialog').locator('audio');await audio.waitFor();
    await expect.poll(()=>audio.evaluate(el=>Number.isFinite(el.duration)&&el.duration>0),{timeout:10000}).toBe(true);
    const decoded=await audio.evaluate(async el=>{await el.play();return {duration:el.duration,readyState:el.readyState,error:el.error?.code??null}});expect(decoded.error).toBeNull();report.audio.push({name,...decoded});
    await page.getByRole('dialog').getByRole('button',{name:'Закрыть',exact:true}).click();
  }
  const webm=await page.evaluate(async()=>{
    const canvas=document.createElement('canvas');canvas.width=160;canvas.height=90;const context=canvas.getContext('2d');const stream=canvas.captureStream(10),chunks=[];
    const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8'});recorder.ondataavailable=e=>chunks.push(e.data);
    const complete=new Promise(resolve=>recorder.onstop=async()=>resolve([...new Uint8Array(await new Blob(chunks).arrayBuffer())]));recorder.start();
    for(let i=0;i<12;i++){context.fillStyle=i%2?'#638bff':'#7868ee';context.fillRect(0,0,160,90);await new Promise(resolve=>setTimeout(resolve,100))}
    recorder.stop();stream.getTracks().forEach(track=>track.stop());return complete;
  });
  const videoPath=path.join(process.env.BORDENA_TEST_PROFILE,'qa-preview.webm');await fs.writeFile(videoPath,Buffer.from(webm));
  const info=await page.evaluate(path=>window.__TAURI_INTERNALS__.invoke('local_file_info',{path}),videoPath);expect(info.exists).toBe(true);
  await call(modules.core,'updateCard',['qa-fifa',{externalFiles:[{id:'qa-video',path:videoPath,name:'QA preview.webm',mime:'video/webm',size:webm.length,pinned:true}]}]);
  await page.evaluate(async()=>{const {queryClient}=await import('/@fs/C:/Bordena/packages/core/src/index.ts');await queryClient.invalidateQueries()});
  await page.getByRole('button',{name:'Предпросмотр / проверить',exact:true}).click();const video=page.locator('video');await video.waitFor();
  await expect.poll(()=>video.evaluate(el=>el.readyState>=1),{timeout:10000}).toBe(true);
  report.video=await video.evaluate(async el=>{await el.play();return {readyState:el.readyState,error:el.error?.code??null}});expect(report.video.error).toBeNull();
  await fs.rename(videoPath,videoPath+'.moved');await page.getByRole('button',{name:'Предпросмотр / проверить',exact:true}).click();await expect(page.getByText('Файл недоступен. Измените путь.',{exact:true})).toBeVisible();
  report.checks.push('real WAV and MP3 decoding/playback; external WebM preview plays through native asset protocol and missing file is reported');

  stage='shared calendar and text dates';
  await page.getByRole('button',{name:'Дата и время срока',exact:true}).click();
  await page.getByLabel('Дата календаря',{exact:true}).fill('2026-12-19');await page.getByRole('checkbox',{name:'Указать время',exact:true}).check();await page.getByLabel('Время календаря',{exact:true}).fill('17:40');
  await page.getByRole('button',{name:'Применить',exact:true}).click();
  await expect.poll(async()=>(await card('qa-fifa')).deadline).toMatch(/^2026-12-19T17:40:00[+-]/);
  const taskDeadline=(await card('qa-fifa')).deadline;
  await editor.press('Control+End');await editor.press('Enter');await editor.pressSequentially('Монтаж');await editor.press('Shift+Home');await editor.press('Shift+F10');
  await page.getByRole('dialog',{name:'Действия с текстом'}).waitFor();await page.getByRole('button',{name:'Привязать дату к слову',exact:true}).click();
  await page.getByLabel('Дата календаря',{exact:true}).fill('2026-12-20');await page.getByRole('checkbox',{name:'Указать время',exact:true}).check();await page.getByLabel('Время календаря',{exact:true}).fill('10:15');await page.getByRole('button',{name:'Применить',exact:true}).click();
  await expect.poll(async()=>(await card('qa-fifa')).body).toContain('[Монтаж](#bordena-date=');expect((await card('qa-fifa')).deadline).toBe(taskDeadline);
  await page.getByRole('button',{name:'Просмотр',exact:true}).click();await page.getByRole('button',{name:'Изменить дату в тексте',exact:true}).last().click();
  await page.getByLabel('Дата календаря',{exact:true}).fill('2026-12-21');await page.getByRole('button',{name:'Применить',exact:true}).click();
  await expect.poll(async()=>(await card('qa-fifa')).body).toContain('#bordena-date=2026-12-21');
  expect((await card('qa-fifa')).body).toContain('bordena://board/qa-child');expect((await card('qa-fifa')).deadline).toBe(taskDeadline);
  await page.getByRole('button',{name:'Дата и время срока',exact:true}).click();await page.getByLabel('Дата календаря',{exact:true}).fill('2027-01-01');await page.keyboard.press('Escape');expect((await card('qa-fifa')).deadline).toBe(taskDeadline);
  await page.screenshot({path:path.join(root,'docs/evidence/aw004-inline-calendar.png')});
  report.checks.push('shared native calendar saves date/time with local offset; Shift+F10 anchors a date to a word; preview calendar edits only that anchor; Escape cancels and card deadline remains independent');

  stage='state deadlines and matrix mirrors';
  await page.getByRole('button',{name:'Закрыть карточку'}).click();
  await call(modules.layout,'ensureLayout',['qa-child','matrix']);
  await page.evaluate(async({module})=>{const {changeLayout}=await import(module);await changeLayout('qa-child',l=>({...l,states:[...l.states,{id:'qa-closed',title:'Переименованное состояние',done:true},{id:'qa-paused',title:'Заморожено',done:false}]}))},{module:modules.layout});
  await call(modules.core,'updateCard',['qa-task-one',{stateId:'qa-closed',deadline:'2020-01-01T12:00'}]);
  await goto('/d/qa-child');
  const stateCard=page.locator('[data-rfd-draggable-id="qa-task-one"]');await stateCard.waitFor();await expect(stateCard).not.toHaveClass(/bordena-overdue/);
  await call(modules.core,'updateCard',['qa-task-one',{stateId:'qa-paused'}]);
  await page.evaluate(async()=>{const {queryClient}=await import('/@fs/C:/Bordena/packages/core/src/index.ts');await queryClient.invalidateQueries()});
  await expect(stateCard).toHaveClass(/bordena-overdue/);
  await page.emulateMedia({reducedMotion:'reduce'});expect(await stateCard.evaluate(el=>getComputedStyle(el).animationName)).toBe('none');await page.emulateMedia({reducedMotion:'no-preference'});
  const mirrorHandle=page.locator(`[data-mirror-id="${mirror.id}"]`);await mirrorHandle.scrollIntoViewIfNeeded();await mirrorHandle.locator('summary').filter({hasText:'Положение зеркала'}).click();await mirrorHandle.getByRole('combobox',{name:'Состояние зеркала',exact:true}).selectOption('qa-closed');
  await expect.poll(async()=>{const m=(await board('qa-child')).mirrors[0];return m.stateId??'state-active'}).not.toBe('state-active');
  expect((await card('qa-fifa')).columnId).toBe(originalColumn);
  await page.screenshot({path:path.join(root,'docs/evidence/aw004-matrix-mirrors.png')});
  await goto('/d/qa-parent/c/qa-fifa');await page.setViewportSize({width:640,height:680});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(640);
  await page.screenshot({path:path.join(root,'docs/evidence/aw004-card-640.png')});await page.setViewportSize({width:1280,height:800});
  report.checks.push('explicit closed state suppresses overdue styling; frozen stays overdue; reduced motion removes pulse; accessible matrix mirror placement leaves original unchanged; 640px card fits');

  stage='JSON4 backup and restore';
  await page.getByRole('button',{name:'Закрыть карточку'}).click();
  started=Date.now();
  report.roundtrip=await page.evaluate(async()=>{
    const workspace=await import('/src/lib/exchange/workspace.ts'),format=await import('/src/lib/exchange/format.ts'),{webDb}=await import('/src/lib/adapters/web-db.ts');
    const payload=await workspace.exportWorkspace(),archive=await format.encodeArchive(payload),decoded=await format.decodeImport(archive),backup=await workspace.createBackup('manual','AW004 native roundtrip');
    const before=payload.document.boards;
    await workspace.applyImport(decoded,'replace',await workspace.previewImport(decoded));await webDb.bindEpoch();
    const after=await workspace.exportWorkspace();if(JSON.stringify(before)!==JSON.stringify(after.document.boards))throw new Error('JSON4 changed board data');
    for(const [name,blob]of payload.files){const other=after.files.get(name);if(!other||await format.sha256(new Uint8Array(await blob.arrayBuffer()))!==await format.sha256(new Uint8Array(await other.arrayBuffer())))throw new Error('Attachment bytes changed')}
    await workspace.readBackup(backup);return {schemaVersion:after.document.schemaVersion,attachments:after.document.attachmentsManifest.length,boards:after.document.boards.length,backupSha256:backup.sha256};
  });report.performance.backupRestoreMs=Date.now()-started;expect(report.roundtrip.schemaVersion).toBe(4);
  report.checks.push('JSON4/ZIP and verified backup preserve links, rules, mirrors, fields, Markdown and media SHA256; external videos remain references');

  stage='changeset rollback';
  const latest=await card('qa-fifa');await call(modules.exchange,'applyChangeset',[batch([{op:'update-card',id:latest.id,expectedUpdatedAt:latest.updatedAt,patch:{title:'Temporary batch rename'}}])]);
  await call(modules.exchange,'undoChangeset');expect((await card('qa-fifa')).title).toBe(latest.title);
  report.checks.push('whole native changeset rollback restores exact previous card state');
  stage='large board and portable fixture';
  const big=batch([{op:'create-board',id:'qa-large',title:'1000 карточек QA'},{op:'create-section',id:'qa-large-section',boardId:'qa-large',title:'Большая секция'},...Array.from({length:1000},(_,index)=>({op:'create-card',id:`qa-large-card-${index}`,columnId:'qa-large-section',title:`Задача ${index+1}`,body:'Локальная задача · Markdown ё'}))]);
  started=Date.now();await call(modules.exchange,'applyChangeset',[big]);report.performance.largeChangeset1000Ms=Date.now()-started;
  started=Date.now();await goto('/d/qa-large');await expect(page.locator('[data-rfd-draggable-id^="qa-large-card-"]')).toHaveCount(1000);report.performance.open1000CardBoardMs=Date.now()-started;
  started=Date.now();await goto('/d/qa-parent');await page.getByText('FIFA 23 — обновлено',{exact:true}).first().waitFor();report.performance.switchBoardMs=Date.now()-started;
  report.performance.jsHeapBytes=await page.evaluate(()=>performance.memory?.usedJSHeapSize??null);
  const fixture=await page.evaluate(async()=>{const {exportWorkspace}=await import('/src/lib/exchange/workspace.ts');const payload=await exportWorkspace();return {document:payload.document,files:await Promise.all([...payload.files].map(async([name,blob])=>({name,type:blob.type,bytes:[...new Uint8Array(await blob.arrayBuffer())]})))}});
  await fs.writeFile(path.join(root,'.tools/qa-aw004-payload.json'),JSON.stringify(fixture));
  report.performance.afterLargeBoardMemory=JSON.parse((await promisify(execFile)('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(root,'scripts/measure-native-memory.ps1'),'-Profile',profile])).stdout);
  report.checks.push('1000-card changeset and board opening measured; portable fixture saved for embedded restart checks');
  await page.screenshot({path:path.join(root,'docs/evidence/aw004-native.png')});
  expect(errors).toEqual([]);expect(external).toEqual([]);report.status='PASS';
} catch(error) {
  report.status='FAIL';report.stage=stage;report.failure=error.stack;process.exitCode=1;
  if(page)await page.screenshot({path:path.join(root,'docs/evidence/aw004-native-failure.png')}).catch(()=>{});
} finally {
  report.errors=errors;report.external=external;
  if(page)await page.evaluate(()=>window.__TAURI_INTERNALS__.invoke('plugin:window|close',{label:'main'})).catch(()=>{});
  await browser?.close().catch(()=>{});
  await fs.writeFile(path.join(root,'docs/evidence/aw004-native.json'),JSON.stringify(report,null,2));console.log(report);
}
