const { chromium } = require('/home/scott/source/liminal-hq/lieutenant-fizz/node_modules/@playwright/test');
const results = [];
const ok = (name, cond, extra) => { results.push((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' — ' + extra : '')); };
(async () => {
  const exe = process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell';
  const b = await chromium.launch({ executablePath: exe, args: ['--mute-audio', '--use-gl=swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  p.on('console', (m) => { if (m.type() === 'error' && !/attribute d:|ERR_CONNECTION/.test(m.text())) errs.push(m.text().slice(0, 200)); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + String(e).slice(0, 300)));
  await p.goto('http://127.0.0.1:8765/Proto.dc.html');
  await p.waitForTimeout(2500);
  await p.getByRole('menuitem', { name: 'File', exact: true }).click(); await p.getByText('Open starter level…').first().click(); await p.waitForTimeout(250); await p.getByRole('button', { name: 'Open Sample draft' }).click(); await p.waitForTimeout(600);
  const txt = async () => p.evaluate(() => document.body.innerText);
  const cell = async (x, y) => { const bb = await p.locator('.cell').nth(y * 40 + x).boundingBox(); return { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 }; };
  const shot = (n) => p.screenshot({ path: process.env.H + '/' + n + '.png' });

  ok('renders 640 cells', (await p.locator('.cell').count()) === 640);
  ok('inspector shows the Gloop', /Gloop\s+enemy/.test(await txt()));

  // select an empty cell
  let c = await cell(20, 11); await p.mouse.click(c.x, c.y); await p.waitForTimeout(200);
  ok('click selects a cell (Inspector shows x 20)', /x 20/.test(await txt()));
  // key focus: press b
  await p.keyboard.press('b'); await p.waitForTimeout(150);
  ok('B key switches to Paint', (await p.locator('button[aria-label="Paint"]').getAttribute('aria-pressed')) === 'true');
  // paint a cell
  c = await cell(3, 8); await p.mouse.move(c.x, c.y); await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(200);
  ok('painting adds a script line', /paint block\s+x=3 y=7/.test(await txt()), '');
  await p.keyboard.press('Control+z'); await p.waitForTimeout(150);
  ok('Ctrl+Z removes it', !/paint block\s+x=3 y=7/.test(await txt()));
  // drag paint a run
  const a = await cell(3, 8), z = await cell(6, 8);
  await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(z.x, z.y, { steps: 12 }); await p.mouse.up(); await p.waitForTimeout(200);
  ok('drag paints a run (x=3..6)', /paint block\s+x=3\.\.6 y=7/.test(await txt()), (await txt()).match(/paint block[^\n]*/g)+'');
  await p.keyboard.press('Control+z'); await p.waitForTimeout(100);

  // window drag
  const before = await p.locator('[role=tab]', { hasText: 'Palette' }).boundingBox();
  await p.mouse.move(90, 104); await p.mouse.down(); await p.mouse.move(190, 214, { steps: 10 }); await p.mouse.up(); await p.waitForTimeout(200);
  const after = await p.locator('[role=tab]', { hasText: 'Palette' }).boundingBox();
  ok('dragging the Palette window moves it', Math.abs(after.x - before.x - 100) < 20 && Math.abs(after.y - before.y - 110) < 25, JSON.stringify([before.x, before.y, after.x, after.y].map(Math.round)));
  await shot('after-window-drag');

  // right-click context menu
  c = await cell(9, 11); await p.mouse.click(c.x, c.y, { button: 'right' }); await p.waitForTimeout(250);
  ok('right-click opens the context menu', /Ask Claude about this/.test(await txt()));
  await shot('context-menu');
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  ok('Escape closes the menu', !/Ask Claude about this/.test(await txt()));

  // accept a hunk
  await p.getByRole('button', { name: 'Accept', exact: true }).first().click(); await p.waitForTimeout(250);
  ok('Accept applies a hunk (toast)', /Accepted: Stepping stones/.test(await txt()));

  // typed line
  await p.locator('#typeline').fill('paint block x=3..5 y=9'); await p.keyboard.press('Enter'); await p.waitForTimeout(250);
  ok('typed line applies', /Added "paint block x=3\.\.5 y=9"/.test(await txt()), (await txt()).match(/Added[^\n]*|There is[^\n]*/)+'');
  await p.locator('#typeline').fill('paint blok x=3..5 y=9'); await p.keyboard.press('Enter'); await p.waitForTimeout(250);
  ok('bad typed line shows a fix', /Did you mean block/.test(await txt()));

  // zoom
  await p.getByRole('button', { name: 'Zoom in' }).click(); await p.waitForTimeout(200);
  ok('Zoom in goes to 48 px', /48 px/.test(await txt()));
  await p.getByRole('button', { name: 'Zoom out' }).click(); await p.getByRole('button', { name: 'Zoom out' }).click(); await p.getByRole('button', { name: 'Zoom out' }).click(); await p.waitForTimeout(200);
  ok('Zoom out reaches 16 px', /16 px/.test(await txt()));
  await shot('zoom16');
  await p.getByRole('button', { name: 'Zoom in' }).click(); await p.getByRole('button', { name: 'Zoom in' }).click(); await p.waitForTimeout(200);

  // shortcuts card
  c = await cell(30, 3); await p.mouse.click(c.x, c.y); await p.keyboard.press('?'); await p.waitForTimeout(200);
  ok('? opens the shortcuts card', /Keyboard shortcuts/.test(await txt()));
  await p.keyboard.press('Escape'); await p.waitForTimeout(100);

  // stamp: select an area, copy, stamp
  await p.getByRole('button', { name: /Select, drag/ }).click();
  const s1 = await cell(12, 7), s2 = await cell(14, 8);
  await p.mouse.move(s1.x, s1.y); await p.mouse.down(); await p.mouse.move(s2.x, s2.y, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(200);
  ok('drag selects an area (3 × 2 shown)', /3 × 2/.test(await txt()));
  await p.keyboard.press('Control+c'); await p.waitForTimeout(150);
  ok('Ctrl+C copies', /Copied a 3 × 2 area/.test(await txt()));
  await p.keyboard.press('t'); const st = await cell(12, 10); await p.mouse.move(st.x, st.y); await p.waitForTimeout(150); await shot('stamp-preview');
  await p.mouse.click(st.x, st.y); await p.waitForTimeout(250);
  ok('Stamp places the copy', /Stamped \d+ tiles? at x 12, y 5/.test(await txt()), (await txt()).match(/Stamped[^\n]*/)+'');

  // pop out
  await p.getByRole('button', { name: /Pop the script out/ }).click(); await p.waitForTimeout(250);
  ok('pop-out shows Display 2', /Display 2/.test(await txt()));
  await shot('popped');

  ok('no unexpected console errors', errs.length === 0, errs.slice(0, 5).join(' | '));
  console.log(results.join('\n'));
  await b.close();
})().catch((e) => { console.log(results.join('\n')); console.log('CRASH', e); process.exit(1); });
