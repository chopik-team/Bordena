import fs from 'node:fs/promises';
import path from 'node:path';
import {expect} from '@playwright/test';
import {nativeHost, root} from './native-host.mjs';

// Exercises only the embedded Tauri app, using an isolated, verified QA profile.
const report = {status: 'RUNNING', checks: []};
let host;
const longName = 'CHOPIK — очень длинное название рабочего пространства для видеопроектов и монтажа';
try {
  host = await nativeHost({name: 'aw005-navigation', port: 9237});
  const {page, rows} = host;
  report.profile = host.profile;
  await page.evaluate(() => {
    const key = 'bordena:preferences:v1';
    localStorage.setItem(key, JSON.stringify({...JSON.parse(localStorage.getItem(key)), theme: 'dark'}));
  });
  await page.reload();
  const selector = () => page.getByRole('combobox', {name: 'Рабочее пространство', exact: true});
  await expect(selector()).toHaveAttribute('title', 'Личное пространство');
  report.selector = await selector().evaluate(el => {
    const style = getComputedStyle(el), canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
    ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    return {width: el.clientWidth, availableTextWidth: el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight), textWidth: ctx.measureText(el.selectedOptions[0].text).width, overflow: style.textOverflow};
  });
  expect(report.selector.availableTextWidth).toBeGreaterThan(report.selector.textWidth);
  await page.getByRole('button', {name: 'Новое рабочее пространство', exact: true}).focus();
  await page.keyboard.press('Space');
  await page.getByRole('dialog').getByRole('textbox', {name: 'Название', exact: true}).fill(longName);
  await page.getByRole('dialog').getByRole('button', {name: 'Сохранить', exact: true}).click();
  await expect.poll(async () => (await rows('sidebar'))[0]?.workspaces?.find(w => w.title === longName)?.id).toBeTruthy();
  const spaceId = (await rows('sidebar'))[0].workspaces.find(w => w.title === longName).id;
  await expect(selector()).toHaveValue(spaceId);
  await expect(selector()).toHaveAttribute('title', longName);
  await expect(selector()).toHaveCSS('text-overflow', 'ellipsis');
  await expect(selector()).toHaveCSS('white-space', 'nowrap');
  await selector().focus();
  await expect(selector()).toBeFocused();
  report.checks.push('visible workspace creation button works with Space, full personal name fits, long name uses ellipsis and full title, native selector keeps keyboard focus');

  await page.getByRole('button', {name: 'Создать доску или календарь', exact: true}).click(); await page.getByRole('menuitem', {name: 'Новая доска', exact: true}).click();
  await page.getByRole('dialog').getByRole('textbox', {name: 'Название', exact: true}).fill('Проверка добавления секций');
  await page.getByRole('dialog').getByRole('button', {name: 'Создать доску', exact: true}).click();
  await page.waitForURL(/\/d\/board-/);
  const boardId = new URL(page.url()).pathname.split('/')[2];
  const beforeCards = await rows('cards');
  const lanes = page.locator('[data-layout-lane]');
  const lane = lanes.nth(1);
  const laneId = await lane.getAttribute('data-layout-lane');
  const addSection = lane.getByRole('button', {name: 'Добавить секцию', exact: true});
  const firstSection = lane.getByRole('region').first();
  if (await firstSection.count()) expect((await addSection.boundingBox()).y).toBeLessThan((await firstSection.boundingBox()).y);
  await addSection.focus();
  await page.keyboard.press('Enter');
  const rename = page.getByRole('textbox', {name: 'Название секции: Новая секция', exact: true});
  await rename.fill('Монтаж');
  await rename.press('Enter');
  await expect(lane.getByRole('region', {name: 'Секция: Монтаж', exact: true})).toBeVisible();
  const column = (await rows('columns')).find(c => c.dashboardId === boardId && c.title === 'Монтаж');
  expect((await rows('dashboards')).find(b => b.id === boardId).layout.sections[column.id].laneId).toBe(laneId);
  expect(await rows('cards')).toEqual(beforeCards);
  await expect.poll(() => page.locator('[data-board-surface]').evaluate(el => getComputedStyle(el).opacity)).toBe('1');
  await page.screenshot({path: path.join(root, 'docs/evidence/aw005-navigation-dark.png')});
  report.checks.push('top-of-lane Add section button works with Enter, auto-rename and correct lane placement persist without changing cards');

  await page.evaluate(() => {
    const key = 'bordena:preferences:v1';
    localStorage.setItem(key, JSON.stringify({...JSON.parse(localStorage.getItem(key)), theme: 'light', language: 'en'}));
  });
  await page.reload();
  await expect(page.getByRole('combobox', {name: 'Workspace', exact: true})).toHaveAttribute('title', longName);
  await expect(page.getByRole('button', {name: 'New workspace', exact: true})).toBeVisible();
  await page.setViewportSize({width: 600, height: 800});
  await page.getByRole('button', {name: 'Toggle sidebar', exact: true}).first().click();
  await expect(page.getByRole('button', {name: 'New workspace', exact: true})).toBeVisible();
  const bounds = await page.getByRole('combobox', {name: 'Workspace', exact: true}).boundingBox();
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(600);
  await page.getByRole('button', {name: 'New workspace', exact: true}).evaluate(async el => {
    await Promise.all(el.closest('[role="dialog"]').getAnimations({subtree: true}).map(a => a.finished.catch(() => {})));
  });
  await page.screenshot({path: path.join(root, 'docs/evidence/aw005-navigation-light-compact.png')});
  report.checks.push('light theme, English labels and compact sidebar keep controls visible and inside viewport');
  expect(host.errors).toEqual([]); expect(host.external).toEqual([]);
  const profile = host.profile;
  await host.close(); host = null;
  host = await nativeHost({name: 'aw005-navigation-restart', port: 9237, profile});
  await expect(host.page.getByRole('combobox', {name: 'Рабочее пространство', exact: true})).toHaveValue(spaceId);
  expect((await host.rows('columns')).find(c => c.id === column.id).title).toBe('Монтаж');
  expect((await host.rows('dashboards')).find(b => b.id === boardId).layout.sections[column.id].laneId).toBe(laneId);
  expect(host.errors).toEqual([]); expect(host.external).toEqual([]);
  report.checks.push('workspace selection, created section and lane survive actual native process restart; no external requests or page errors');
  report.status = 'PASS';
} catch (error) {
  report.status = 'FAIL'; report.failure = error.stack; process.exitCode = 1;
  if (host) {
    report.body = await host.page.locator('body').innerText().catch(() => null);
    await host.page.screenshot({path: path.join(root, 'docs/evidence/aw005-navigation-failure.png')}).catch(() => {});
  }
} finally {
  if (host) {
    report.errors = host.errors; report.external = host.external;
    await host.close().catch(error => {report.closeError = error.message; process.exitCode = 1});
  }
  await fs.writeFile(path.join(root, 'docs/evidence/aw005-navigation.json'), JSON.stringify(report, null, 2));
  console.log(report);
}
