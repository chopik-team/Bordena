import fs from 'node:fs/promises';
import path from 'node:path';
import {expect} from '@playwright/test';
import {nativeHost,root} from './native-host.mjs';
const report={status:'RUNNING',checks:[],dialogs:[]};let host;
try{
  host=await nativeHost({name:'aw006-dialogs',port:9244});const {page,rows}=host;report.profile=host.profile;
  await page.evaluate(()=>{const k='bordena:preferences:v1';localStorage.setItem(k,JSON.stringify({...JSON.parse(localStorage.getItem(k)),theme:'dark'}))});await page.reload();
  const popup=()=>page.getByRole('dialog');
  const checkDialog=async(name,{header=false}={})=>{
    const d=popup();await expect(d).toHaveCSS('opacity','1');await expect(d.getByRole('button',{name:'Закрыть',exact:true})).toHaveCount(1);
    const geometry=await d.evaluate(el=>{const r=el.getBoundingClientRect(),title=el.querySelector('[data-slot="modal-title"]'),b=el.querySelector('button[aria-label="Закрыть"]'),range=document.createRange();range.selectNodeContents(title);const tr=range.getBoundingClientRect(),br=b.getBoundingClientRect();return {padding:parseFloat(getComputedStyle(el).paddingLeft),titleInset:title.getBoundingClientRect().left-r.left,overflow:el.scrollWidth>el.clientWidth,buttonInside:br.left>=r.left&&br.right<=r.right&&br.top>=r.top&&br.bottom<=r.bottom,titleOverlapsClose:tr.right>br.left&&tr.bottom>br.top&&tr.top<br.bottom}});
    expect(geometry.overflow).toBe(false);expect(geometry.buttonInside).toBe(true);expect(geometry.titleOverlapsClose).toBe(false);expect(geometry.titleInset).toBeGreaterThanOrEqual(header?12:20);
    report.dialogs.push({name,...geometry});
  };
  const plus=page.getByRole('button',{name:'Новая вкладка',exact:true});await plus.focus();await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitem',{name:'Новая доска',exact:true})).toBeVisible();await expect(page.getByRole('menuitem',{name:'Новый календарь',exact:true})).toBeVisible();
  await page.getByRole('menuitem',{name:'Новая доска',exact:true}).click();await checkDialog('new board');
  const category=popup().getByRole('combobox',{name:'Категория шаблона',exact:true}),template=popup().getByRole('combobox',{name:'Шаблон',exact:true});
  await expect(template).toBeDisabled();await category.selectOption({label:'YouTube'});await expect(template).toHaveValue('builtin-video');
  await expect(template.locator('option')).toHaveCount(1);await expect(popup().locator('[data-template-preview]')).toContainText('Идеи → Сценарий → Запись → Монтаж → Публикация');
  await popup().getByRole('checkbox',{name:'Добавить примеры задач',exact:true}).check();
  await category.selectOption({label:'Разработка'});await expect(popup().getByRole('checkbox',{name:'Добавить примеры задач',exact:true})).not.toBeChecked();await expect(template.locator('option')).not.toContainText(['Видеопроизводство']);
  await category.selectOption({label:'Личное'});await template.selectOption('builtin-goal-personal-goal');await expect(popup().getByRole('combobox',{name:'Компоновка',exact:true})).toHaveValue('goal');
  await category.selectOption({label:'Универсальное'});await template.selectOption('builtin-matrix');await expect(popup().getByRole('combobox',{name:'Компоновка',exact:true})).toHaveValue('matrix');
  await category.selectOption({label:'YouTube'});await popup().getByRole('textbox',{name:'Название',exact:true}).fill('Видео — два списка шаблонов');
  await popup().screenshot({path:path.join(root,'docs/evidence/aw006-dialog-template-dark.png'),animations:'disabled'});
  await popup().getByRole('button',{name:'Создать доску',exact:true}).click();await page.waitForURL(/\/d\//);
  const boardId=new URL(page.url()).pathname.split('/')[2];expect((await rows('columns')).filter(c=>c.dashboardId===boardId&&!c.deletedAt).map(c=>c.title).sort()).toEqual(['Идеи','Сценарий','Запись','Монтаж','Публикация'].sort());
  report.checks.push('tab + offers board/calendar via keyboard; category/template selects filter the catalog, preview stages, reset examples, and create the selected template');
  await page.getByRole('button',{name:'Компоновка…',exact:true}).click();await checkDialog('board layout');await popup().getByRole('button',{name:'Закрыть',exact:true}).click();await expect(popup()).toHaveCount(0);
  await page.getByRole('button',{name:'Новое рабочее пространство',exact:true}).click();await checkDialog('workspace');await popup().getByRole('button',{name:'Закрыть',exact:true}).click();
  await plus.click();await page.getByRole('menuitem',{name:'Новый календарь',exact:true}).click();await checkDialog('calendar');
  await popup().getByRole('button',{name:'Закрыть',exact:true}).click();await expect(popup()).toHaveCount(0);
  await page.getByRole('button',{name:'Создать событие',exact:true}).click();await checkDialog('event');
  await popup().screenshot({path:path.join(root,'docs/evidence/aw006-dialog-event-dark.png'),animations:'disabled'});await popup().getByRole('button',{name:'Закрыть',exact:true}).click();
  await page.getByRole('button',{name:'Меню Bordena',exact:true}).click();await page.getByRole('menuitem',{name:'Настройки Bordena',exact:true}).click();await checkDialog('settings',{header:true});await popup().getByRole('button',{name:'Закрыть',exact:true}).click();
  await page.keyboard.press('Control+k');await checkDialog('quick search');await popup().getByRole('button',{name:'Закрыть',exact:true}).click();
  report.checks.push('board, layout, workspace, calendar, event, settings and search have in-bounds text and exactly one working close cross');
  await plus.click();await page.getByRole('menuitem',{name:'Новая доска',exact:true}).click();await popup().getByRole('combobox',{name:'Категория шаблона',exact:true}).selectOption({label:'YouTube'});
  await page.setViewportSize({width:640,height:800});await page.waitForTimeout(250);await checkDialog('new board compact');await popup().screenshot({path:path.join(root,'docs/evidence/aw006-dialog-template-640.png'),animations:'disabled'});await popup().getByRole('button',{name:'Закрыть',exact:true}).click();
  expect(host.errors).toEqual([]);expect(host.external).toEqual([]);report.status='PASS';
}catch(error){report.status='FAIL';report.failure=error.stack;if(host){report.body=await host.page.locator('body').innerText().catch(()=>null);await host.page.screenshot({path:path.join(root,'docs/evidence/aw006-dialogs-failure.png')}).catch(()=>{})}process.exitCode=1}
finally{if(host){report.errors=host.errors;report.external=host.external;await host.close().catch(e=>{report.status='FAIL';report.closeError=e.message;process.exitCode=1})}await fs.writeFile(path.join(root,'docs/evidence/aw006-dialogs.json'),JSON.stringify(report,null,2)+'\n');console.log(report)}
