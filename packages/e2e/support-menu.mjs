import fs from 'node:fs/promises';
import path from 'node:path';
import {expect} from '@playwright/test';
import {nativeHost,root} from './native-host.mjs';

const report={status:'RUNNING',checks:[]};let host;
try {
  host=await nativeHost({name:'support-menu',port:9246});
  const {page}=host;report.profile=host.profile;
  for(const theme of ['dark','light']) {
    await page.evaluate(theme=>{const key='bordena:preferences:v1';localStorage.setItem(key,JSON.stringify({...JSON.parse(localStorage.getItem(key)),theme}))},theme);
    await page.reload();
    const session=await page.context().newCDPSession(page);
    await session.send('Emulation.setDeviceMetricsOverride',{width:640,height:800,deviceScaleFactor:1,mobile:false});
    const trigger=page.getByRole('button',{name:'Меню Bordena',exact:true});
    // Narrow windows keep the logo inside the existing collapsible sidebar.
    if(!await trigger.isVisible())await page.getByRole('button',{name:'Переключить боковую панель',exact:true}).click();
    await trigger.focus();await page.keyboard.press('Enter');
    const support=page.getByRole('menuitem',{name:'Поддержать разработчика',exact:true});
    await expect(support).toBeVisible();
    await expect(support).toHaveAttribute('href','https://boosty.to/cho_pik');
    await expect(support.locator('[data-slot="boosty-logo"]')).toBeVisible();
    await expect.poll(async()=>Math.round((await support.locator('svg').boundingBox()).width*100)/100).toBe(16);
    const geometry=await support.evaluate(el=>{const r=el.getBoundingClientRect(),icon=el.querySelector('svg'),i=icon.getBoundingClientRect();return {overflow:el.scrollWidth>el.clientWidth,left:r.left,right:r.right,iconWidth:i.width,iconHeight:i.height,iconColor:getComputedStyle(icon).fill,textColor:getComputedStyle(el).color}});
    expect(geometry.overflow).toBe(false);expect(geometry.left).toBeGreaterThanOrEqual(0);expect(geometry.right).toBeLessThanOrEqual(640);
    expect(geometry.iconWidth).toBe(16);expect(geometry.iconHeight).toBe(16);expect(geometry.iconColor).toBe(geometry.textColor);
    await support.focus();expect(await support.evaluate(el=>el===document.activeElement)).toBe(true);
    await page.screenshot({path:path.join(root,`docs/evidence/support-menu-${theme}.png`)});
    await page.keyboard.press('Escape');await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(trigger).toBeFocused();await page.keyboard.press('Space');
    await page.getByRole('menuitem',{name:'О программе',exact:true}).click();
    const link=page.getByRole('link',{name:'Поддержать разработчика · Boosty',exact:true});
    await expect(link).toBeVisible();await expect(link.locator('[data-slot="boosty-logo"]')).toBeVisible();
    await expect(link).toHaveAttribute('href','https://boosty.to/cho_pik');await page.keyboard.press('Escape');
    report.checks.push({theme,geometry,keyboard:true,about:true});
  }
  expect(host.errors).toEqual([]);expect(host.external).toEqual([]);report.status='PASS';
} catch(error) {report.status='FAIL';report.failure=error.stack;process.exitCode=1}
finally {if(host){report.errors=host.errors;report.external=host.external;await host.close().catch(e=>{report.closeError=e.message;process.exitCode=1})}await fs.writeFile(path.join(root,'docs/evidence/support-menu-native.json'),JSON.stringify(report,null,2));console.log(report)}
