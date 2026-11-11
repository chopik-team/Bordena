import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, expect } from '@playwright/test';

const root = path.resolve('../..');
const profile = path.join(root, '.tools', 'qa-major-' + Date.now());
const evidence = path.join(root, 'docs/evidence');
const result = { status: 'RUNNING', profile, checks: [], errors: [], external: [] };
const delay = ms => new Promise(r => setTimeout(r, ms));
let child, browser, page;
async function launch() {
  child = spawn(path.join(root, 'apps/desktop/src-tauri/target/debug/bordena.exe'), [], { cwd: root, env: { ...process.env, BORDENA_TEST_PROFILE: profile, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: '--remote-debugging-port=9227' }, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { try { browser = await chromium.connectOverCDP('http://127.0.0.1:9227'); break } catch { await delay(200) } }
  if (!browser) throw new Error('Native startup timed out');
  page = undefined;
  for (let i = 0; i < 60 && !page; i++) {
    for (const candidate of browser.contexts()[0].pages()) {
      if (await candidate.evaluate(() => window.__TAURI_INTERNALS__?.metadata?.currentWindow?.label).catch(() => null) === 'main') { page = candidate; break }
    }
    if (!page) await delay(100);
  }
  if (!page) throw new Error('Main WebView was not found');
  await page.evaluate(()=>{const k='bordena:preferences:v1';localStorage.setItem(k,JSON.stringify({...JSON.parse(localStorage.getItem(k)??'{}'),language:'ru'}))});await page.reload();
  await page.getByRole('button', { name: 'Меню Bordena' }).waitFor();
  const actual = await page.evaluate(() => window.__TAURI_INTERNALS__.invoke('storage_profile'));
  if (!actual.replaceAll('\\', '/').includes('/.tools/qa-')) throw new Error('Refusing non-QA profile');
  page.on('pageerror', e => result.errors.push(e.message));
  page.on('request', r => { if (!/^(http:\/\/(tauri|ipc)\.localhost\/|blob:|data:|ipc:)/.test(r.url())) result.external.push(r.url()) });
  await browser.contexts()[0].setOffline(true);
}
async function close() {
  if (page && !page.isClosed()) await page.evaluate(() => window.__TAURI_INTERNALS__.invoke('plugin:window|close', { label: 'main' })).catch(() => {});
  await browser?.close().catch(() => {}); browser = undefined;
  for (let i = 0; i < 50 && child.exitCode === null; i++) await delay(100);
  if (child.exitCode === null) throw new Error('Native process did not close');
}
async function rows(store) {
  return page.evaluate(async store => { const r = indexedDB.open('bordena'); const db = await new Promise((ok, no) => { r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error) }); const tx = db.transaction(store), req = tx.objectStore(store).getAll(); const values = await new Promise((ok, no) => { req.onsuccess = () => ok(req.result); req.onerror = () => no(req.error) }); db.close(); return values }, store);
}
async function create(title, mode) {
  await page.getByRole('button', {name: 'Создать доску или календарь', exact: true}).click(); await page.getByRole('menuitem', {name: 'Новая доска', exact: true}).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Название', exact: true }).fill(title);
  await dialog.getByRole('combobox', {name:'Компоновка',exact:true}).selectOption(mode);
  await dialog.getByRole('button', { name: 'Создать доску', exact: true }).click();
  await page.waitForURL(/\/d\/board-/);
  await expect(page.getByRole('combobox', { name: 'Компоновка доски' })).toHaveValue(mode);
  return new URL(page.url()).pathname.split('/')[2];
}
try {
  await launch();
  const a = await create('Проект Альфа QA', 'free');
  await page.getByRole('button', { name: 'В избранное: Проект Альфа QA', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Избранные доски' })).toBeVisible();
  const b = await create('Проект Бета QA', 'matrix');
  await expect(page.getByRole('tab')).toHaveCount(2);
  await page.keyboard.press('Control+Tab'); await page.waitForURL(new RegExp('/d/' + a + '$'));
  await page.keyboard.press('Control+Shift+Tab'); await page.waitForURL(new RegExp('/d/' + b + '$'));
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox', { name: 'Поиск досок и карточек' }).fill('Альфа');
  await page.getByRole('combobox', { name: 'Поиск досок и карточек' }).press('Enter');
  await page.waitForURL(new RegExp('/d/' + a + '$'));
  await page.getByRole('button', { name: 'Закрыть вкладку: Проект Бета QA' }).click();
  expect((await rows('dashboards')).some(d => d.id === b && !d.deletedAt)).toBe(true);
  result.checks.push('tabs, favorite, local search, keyboard switching, close tab preserves board');

  await page.getByRole('button', { name: 'Добавить секцию', exact: true }).first().click();
  let section = page.getByRole('region', { name: 'Секция: Новая секция', exact: true });
  await page.getByRole('textbox',{name:'Название секции: Новая секция',exact:true}).fill('Монтаж QA');await page.getByRole('textbox',{name:'Название секции: Новая секция',exact:true}).press('Enter');
  section = page.getByRole('region', { name: 'Секция: Монтаж QA', exact: true });
  await section.getByRole('button',{name:'Действия с секцией: Монтаж QA'}).click();await page.getByRole('menuitem',{name:'Настройки секции',exact:true}).click();await page.getByRole('combobox',{name:'Перенести в столбец',exact:true}).selectOption({index:1});await page.getByRole('combobox',{name:'Готовность секции',exact:true}).selectOption('manual');await page.getByRole('button',{name:'Готово',exact:true}).click();
  await section.getByRole('button', { name: 'Свернуть секцию: Монтаж QA' }).click();
  await expect(section.getByRole('button', { name: 'Добавить карточку: Монтаж QA' })).toBeHidden();
  await section.getByRole('button', { name: 'Развернуть секцию: Монтаж QA' }).click();
  await section.getByRole('button', { name: 'Добавить карточку: Монтаж QA' }).click();
  await section.getByText('Без названия', { exact: true }).click();
  await page.getByPlaceholder('Название', { exact: true }).fill('Сценарий QA');
  await page.getByRole('textbox', { name: 'Заметки', exact: true }).fill('**Текст ё**\n- [x] Сценарий\n- [ ] Монтаж');
  await page.getByRole('spinbutton', { name: 'Готовность задачи' }).fill('0');
  await page.getByRole('spinbutton', { name: 'Готовность задачи' }).press('Enter');
  await page.locator('input[type=file]').setInputFiles({ name: 'текст.txt', mimeType: 'text/plain', buffer: Buffer.from('Файл проекта ё') });
  await page.getByRole('button', { name: 'Закрыть карточку' }).click();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  await expect.poll(async () => (await rows('cards')).find(c => c.title === 'Сценарий QA')?.attachments.length).toBe(1);
  const saved = (await rows('cards')).find(c => c.title === 'Сценарий QA');
  result.checks.push('create, rename, move, collapse section; card progress 0; Markdown/checklist/attachment; section manual mode');
  await page.getByRole('button', { name: 'Добавить секцию', exact: true }).first().click();
  const temporary = page.getByRole('region', { name: 'Секция: Новая секция', exact: true });
  await temporary.getByRole('button', { name: 'Действия с секцией: Новая секция', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Удалить колонку', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Удалить колонку?' })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Удалить колонку', exact: true }).click();
  await expect(temporary).toBeHidden();
  expect((await rows('columns')).some(c => c.title === 'Новая секция' && c.deletedAt)).toBe(true);
  result.checks.push('section deletion requires confirmation and keeps a restorable tombstone');

  await page.getByRole('combobox', { name: 'Компоновка доски' }).selectOption('matrix');
  await expect(page.locator('[data-matrix]')).toBeVisible();
  await page.getByRole('button', { name: 'Компоновка…', exact: true }).click();
  await page.getByRole('button', { name: 'Добавить состояние', exact: true }).click();
  await expect.poll(async () => (await rows('dashboards')).find(d => d.id === a)?.layout.states.length).toBe(2);
  await page.getByRole('button', { name: 'Добавить этап', exact: true }).click();
  await expect.poll(async () => (await rows('dashboards')).find(d => d.id === a)?.layout.stages.length).toBe(4);
  await page.getByRole('checkbox', { name: 'Лёгкая тонировка фона' }).click();
  await expect(page.getByRole('checkbox', { name: 'Лёгкая тонировка фона' })).toBeChecked();
  await page.getByRole('combobox', { name: 'Цвет: К выполнению', exact: true }).first().selectOption('blue');
  await page.keyboard.press('Escape');
  // Keyboard DnD uses the same real sensor as pointer dragging, without timing-sensitive mouse paths.
  const draggable = page.locator(`[data-rfd-draggable-id="${saved.id}"]`);
  await draggable.focus(); await page.keyboard.press('Space'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Space');
  await expect.poll(async () => (await rows('cards')).find(c => c.id === saved.id)?.stageId).not.toBeUndefined();
  await page.waitForTimeout(350);
  const movedAxes = (await rows('cards')).find(c => c.id === saved.id);
  const currentLayout = (await rows('dashboards')).find(d => d.id === a).layout;
  const targetCell = page.locator(`[data-matrix-cell="${movedAxes.stageId}|${currentLayout.states[1].id}"]`);
  const from = await draggable.boundingBox(), to = await targetCell.boundingBox();
  result.dragGeometry = { from, to };
  result.dragTarget = await page.evaluate(({x,y}) => { let el = document.elementFromPoint(x,y); const parents=[]; for(let i=0;el&&i<7;i++,el=el.parentElement) parents.push({tag:el.tagName,role:el.getAttribute('role'),slot:el.getAttribute('data-slot')}); return parents }, {x:from.x+from.width/2,y:from.y+from.height/2});
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2); await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 10, from.y + from.height / 2 + 10, { steps: 3 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 });
  await page.waitForTimeout(250);
  result.dragStyle = await draggable.getAttribute('style');
  await page.mouse.up();
  await expect.poll(async () => (await rows('cards')).find(c => c.id === saved.id)?.stateId).not.toBe('state-active');
  await page.getByRole('button', { name: 'Свернуть строку: Новое состояние' }).click();
  await expect(draggable).toBeHidden();
  await page.getByRole('button', { name: 'Развернуть строку: Новое состояние' }).click();
  await expect(draggable).toBeVisible();
  await draggable.click();
  const stateSelect = page.getByRole('combobox', { name: 'Состояние', exact: true });
  await stateSelect.selectOption({ index: 1 });
  await page.getByRole('spinbutton', { name: 'Готовность задачи' }).fill('100'); await page.getByRole('spinbutton', { name: 'Готовность задачи' }).press('Enter');
  await page.getByRole('button', { name: 'Закрыть карточку' }).click();
  await expect.poll(async () => (await rows('cards')).find(c => c.id === saved.id)?.progress).toBe(100);
  await page.getByRole('combobox', { name: 'Компоновка доски' }).selectOption('free');
  await expect(page.getByRole('button', { name: 'Закрыть карточку' })).toBeHidden();
  await expect(page.locator(`[data-rfd-draggable-id="${saved.id}"]`)).toBeVisible();
  expect((await rows('cards')).find(c => c.id === saved.id)).toMatchObject({ columnId: saved.columnId, body: saved.body, attachments: saved.attachments, progress: 100 });
  expect((await rows('bordena-backups')).length).toBeGreaterThanOrEqual(4);
  result.checks.push('matrix DnD, independent state edit, 100%, Free/Matrix switch preserves ID/content/files and creates backups');

  // Horizontal/vertical pan on a scrollable test lane. Test content only, never a real profile.
  await page.evaluate(() => { const lane = document.querySelector('[data-layout-lane]'); const filler = document.createElement('div'); filler.dataset.qaPan = 'true'; filler.style.height = '1600px'; filler.style.flexShrink = '0'; lane.append(filler) });
  const panTarget = page.locator('[data-qa-pan]');
  await panTarget.evaluate(el => el.scrollIntoView({ block: 'start', inline: 'start' }));
  const box = await panTarget.boundingBox(), surface = page.locator('[data-board-surface]');
  const bounds = await surface.boundingBox();
  const startX = Math.max(bounds.x + 100, box.x + 100), startY = Math.max(bounds.y + 120, box.y + 120);
  const initialTop = await panTarget.evaluate(el => el.parentElement.scrollTop);
  await page.mouse.move(startX, startY); await page.mouse.down({ button: 'middle' });
  await page.mouse.move(startX - 80, startY - 70, { steps: 5 });
  expect(await surface.getAttribute('data-panning')).toBe('true');
  expect(await surface.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
  expect(await panTarget.evaluate(el => el.parentElement.scrollTop)).toBeGreaterThan(initialTop);
  await page.mouse.up({ button: 'middle' });
  await expect(surface).not.toHaveAttribute('data-panning');
  await page.evaluate(() => document.querySelector('[data-qa-pan]')?.remove());
  result.checks.push('native middle-button pan and release');
  await page.screenshot({ path: path.join(evidence, 'aw006-free.png') });
  await page.getByRole('combobox', { name: 'Компоновка доски' }).selectOption('matrix');
  await page.screenshot({ path: path.join(evidence, 'aw006-matrix.png') });
  await page.getByRole('button',{name:'Меню Bordena'}).click();await page.getByRole('menuitem',{name:'Настройки Bordena',exact:true}).click();await page.getByRole('combobox',{name:'Тема',exact:true}).selectOption('dark');await page.getByRole('dialog').getByRole('button',{name:'Закрыть',exact:true}).click();
  await page.screenshot({ path: path.join(evidence, 'aw006-matrix-theme.png') });
  await page.keyboard.press('Control+b');
  await expect.poll(() => page.evaluate(() => String(JSON.parse(localStorage.getItem('bordena:preferences:v1')).sidebarOpen))).toBe('false');
  await close(); await launch();
  await page.waitForURL(new RegExp('/d/' + a + '$'));
  await expect(page.getByRole('combobox', { name: 'Компоновка доски' })).toHaveValue('matrix');
  expect(await page.evaluate(() => String(JSON.parse(localStorage.getItem('bordena:preferences:v1')).sidebarOpen))).toBe('false');
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  await expect(page.getByRole('spinbutton', { name: 'Готовность проекта' })).toHaveCount(0);
  await page.keyboard.press('Control+b');
  await page.keyboard.press('Control+k'); await page.getByRole('combobox', { name: 'Поиск досок и карточек' }).fill('Сценарий QA');
  await expect(page.getByRole('option', { name: /Сценарий QA/ })).toBeVisible(); await page.keyboard.press('Escape');
  result.checks.push('OS process restart restores active board, layout, collapsed sidebar, section/card progress and local search');
  expect(result.errors).toEqual([]); expect(result.external).toEqual([]);
  result.status = 'PASS'; await close();
} catch (error) {
  result.status = 'FAIL'; result.failure = error.stack; console.error(error);
  if (page && !page.isClosed()) { await page.screenshot({ path: path.join(evidence, 'aw006-failure.png') }).catch(() => {}); result.body = await page.locator('body').innerText().catch(() => '') }
  await close().catch(() => {}); process.exitCode = 1;
} finally {
  await fs.writeFile(path.join(evidence, 'aw006-native-major.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}
