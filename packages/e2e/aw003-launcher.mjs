import fs from 'node:fs/promises';import path from 'node:path';import {chromium,expect} from '@playwright/test';import {root,delay} from './native-host.mjs';
let browser,page;const report={status:'RUNNING',launcher:'dev.bat'};
try{
 const started=Date.now();
 for(let i=0;i<960;i++){try{browser=await chromium.connectOverCDP('http://127.0.0.1:9231');break}catch{
   for(const name of ['aw006-dev-bat.log','aw006-dev-bat-errors.log']){const file=path.join(root,'docs/evidence',name),stat=await fs.stat(file).catch(()=>null);if(stat&&stat.mtimeMs>=started){const log=await fs.readFile(file,'utf8');if(/beforeBuildCommand.*failed|error TS\d+|ERR_PNPM/.test(log))throw new Error('dev.bat build failed; see '+name)}}
   await delay(250)
 }}
 if(!browser)throw new Error('dev.bat did not start the native application');
 for(let i=0;i<80&&!page;i++){for(const candidate of browser.contexts()[0].pages())if(await candidate.evaluate(()=>window.__TAURI_INTERNALS__?.metadata?.currentWindow?.label).catch(()=>null)==='main'){page=candidate;break}if(!page)await delay(100)}
 if(!page||!page.url().startsWith('http://tauri.localhost/'))throw new Error('Expected embedded native URL');
const profile=await page.evaluate(()=>window.__TAURI_INTERNALS__.invoke('storage_profile'));
 if(path.resolve(profile).toLowerCase()!==path.resolve(process.env.BORDENA_TEST_PROFILE,'WebView2').toLowerCase()||!profile.toLowerCase().startsWith(path.join(root,'.tools','qa-launcher-aw006-').toLowerCase()))throw new Error('Unsafe native profile');
 const packageVersion=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8')).version;
 const nativeVersion=await page.evaluate(()=>window.__TAURI_INTERNALS__.invoke('plugin:app|version'));expect(nativeVersion).toBe(packageVersion);const displayVersion=packageVersion.replace(/\.0$/,'');
 await browser.contexts()[0].setOffline(true);await page.getByRole('button',{name:/^(Меню Bordena|Bordena menu)$/}).click();await page.getByRole('menuitem',{name:/^(О программе|About)$/}).click();await expect(page.getByText('Bordena '+displayVersion,{exact:true})).toBeVisible();if(process.env.BORDENA_QA_NO_SCREENSHOTS!=='1')await page.screenshot({path:path.join(root,'docs/evidence/aw006-launcher.png')});Object.assign(report,{status:'PASS',profile,url:page.url(),version:displayVersion,nativeVersion,offline:true});
}catch(error){report.status='FAIL';report.failure=error.stack;process.exitCode=1}
finally{if(page)await page.evaluate(()=>window.__TAURI_INTERNALS__.invoke('plugin:window|close',{label:'main'})).catch(()=>{});await browser?.close().catch(()=>{});await fs.writeFile(path.join(root,'docs/evidence/aw006-launcher.json'),JSON.stringify(report,null,2));console.log(report)}

