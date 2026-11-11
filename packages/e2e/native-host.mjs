import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {chromium} from '@playwright/test';
export const root=fileURLToPath(new URL('../../',import.meta.url));
export const delay=ms=>new Promise(r=>setTimeout(r,ms));
export async function selectCalendarView(page, value) {
  const combo=page.getByRole('combobox',{name:/^(Представление календаря|Calendar view)$/});
  if(await combo.isVisible()) return combo.selectOption(value);
  const labels={day:/^(День|Day)$/,week:/^(Неделя|Week)$/,month:/^(Месяц|Month)$/,agenda:/^(Список|List)$/,year:/^(Год|Year)$/};
  return page.getByRole('group',{name:/^(Представление календаря|Calendar view)$/}).getByRole('button',{name:labels[value]}).click();
}
export async function showCalendarTasks(page) {
  const button=page.locator('[data-calendar-panel-toggle]');
  if(await button.getAttribute('aria-expanded')!=='true')await button.click();
  const tasks=page.getByRole('complementary').getByRole('button',{name:/^(Задачи|Tasks)$/});if(await tasks.isVisible())await tasks.click();
}
export async function newCalendar(page) {
  await page.getByRole('button',{name:/^(Новая вкладка|New tab)$/}).click();
  await page.getByRole('menuitem',{name:/^(Новый календарь|New calendar)$/}).click();
}
export async function nativeHost({name='aw005',port=9229,profile=path.join(root,'.tools','qa-'+name+'-'+Date.now()),language='ru',release=false,executable,launcher=false,launcherPath}={}){
  if(!path.resolve(profile).toLowerCase().startsWith(path.join(root,'.tools','qa-').toLowerCase()))throw new Error('Unsafe QA directory');
  const child=spawn(launcher?'cmd.exe':executable??path.join(root,`apps/desktop/src-tauri/target/${release?'release':'debug'}/bordena.exe`),launcher?['/d','/s','/c',`""${launcherPath??path.join(root,'Bordena.bat')}" --bordena-qa"`]:release?['--bordena-qa']:[],{cwd:root,windowsVerbatimArguments:launcher,env:{...process.env,BORDENA_TEST_PROFILE:profile,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port='+port},stdio:'ignore'});
  let browser,page;
  for(let i=0;i<80;i++){try{browser=await chromium.connectOverCDP('http://127.0.0.1:'+port);break}catch{await delay(200)}}
  if(!browser)throw new Error('Native host did not start');
  for(let i=0;i<60&&!page;i++){for(const p of browser.contexts()[0].pages()){if(await p.evaluate(()=>window.__TAURI_INTERNALS__?.metadata?.currentWindow?.label).catch(()=>null)==='main'){page=p;break}}if(!page)await delay(100)}
  if(!page)throw new Error('Main window missing');
  if(process.env.BORDENA_QA_NO_SCREENSHOTS==='1')page.screenshot=async()=>Buffer.alloc(0);
  page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(15000);
  const actual=await page.evaluate(()=>window.__TAURI_INTERNALS__.invoke('storage_profile'));
  if(path.resolve(actual).toLowerCase()!==path.join(profile,'WebView2').toLowerCase())throw new Error('Wrong native QA profile');
  const errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!/^(http:\/\/(tauri|ipc|asset)\.localhost\/|blob:|data:|ipc:)/.test(r.url()))external.push(r.url())});
  await browser.contexts()[0].setOffline(true);
  await page.evaluate(({language,legacyTabs})=>{const key='bordena:preferences:v1', prefs=JSON.parse(localStorage.getItem(key)??'{}');localStorage.setItem(key,JSON.stringify({...prefs,language,...(legacyTabs?{useTabs:true}:{})}))},{language,legacyTabs:process.env.BORDENA_QA_LEGACY_TABS==='1'});
  await page.reload();
  // Main renders after desktop lifecycle listeners are installed. Closing a
  // restarted process before that point destroys the window before save/quit.
  await page.locator('#root button').first().waitFor({state:'attached'});
  const rows=store=>page.evaluate(async store=>{const r=indexedDB.open('bordena'),db=await new Promise((ok,no)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});const tx=db.transaction(store),req=tx.objectStore(store).getAll();const values=await new Promise((ok,no)=>{req.onsuccess=()=>ok(req.result);req.onerror=()=>no(req.error)});db.close();return values},store);
  const close=async()=>{await page.locator('#root button').first().waitFor({state:'attached'});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.evaluate(()=>window.__TAURI_INTERNALS__.invoke('plugin:window|close',{label:'main'})).catch(()=>{});await browser.close().catch(()=>{});for(let i=0;i<60&&child.exitCode===null;i++)await delay(100);if(child.exitCode===null)throw new Error('Native process remained open')};
  return {page,browser,profile,rows,close,errors,external,pid:child.pid};
}
