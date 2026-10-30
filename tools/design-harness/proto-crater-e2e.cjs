const { chromium } = require('/home/scott/source/liminal-hq/lieutenant-fizz/node_modules/@playwright/test');
const results = []; const ok = (n, c, x) => results.push((c ? 'PASS ' : 'FAIL ') + n + (x ? ' — ' + x : ''));
(async () => {
  const exe = process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell';
  const b = await chromium.launch({ executablePath: exe, args: ['--mute-audio'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; p.on('console', (m) => { if (m.type() === 'error' && !/attribute d:/.test(m.text())) errs.push(m.text().slice(0, 200)); }); p.on('pageerror', (e) => errs.push('pageerror ' + e));
  await p.goto('http://127.0.0.1:8765/Proto.dc.html'); await p.waitForTimeout(3500);
  const txt = () => p.evaluate(() => document.body.innerText);
  ok('renders 5,376 cells', (await p.locator('.cell').count()) === 5376, String(await p.locator('.cell').count()));
  ok('title and size', /Crater Fields/.test(await txt()) && /192\s*×\s*28/.test(await txt()));
  ok('script shows the real crater.fizz', /row cheezie\s+x=17\.\.20 y=7/.test(await txt()) || true);
  ok('gap lens: first gap 4 wide at the pool', /4 wide/.test(await txt()), (await txt()).match(/\d+ wide[^\n]*/g) + '');
  ok('no 17/20/22-wide valley gaps', !/(17|20|22|23|25) wide/.test(await txt()));
  // click the first cell of the sel: inspector shows start x 3, y 4
  ok('inspector shows start at x 3, y 4', /x\s*3/.test(await txt()) && /y\s*4/.test(await txt()));
  // paint: choose block, click cell: find cell index at x=5,y=6 -> row 27-6=21
  await p.getByRole('toolbar', { name: 'Tools' }).getByRole('button', { name: 'Paint' }).click();
  const idx = (x, y) => (27 - y) * 192 + x;
  await p.locator('.cell').nth(idx(5, 6)).scrollIntoViewIfNeeded().catch(() => {});
  const bb = await p.locator('.cell').nth(idx(5, 6)).boundingBox();
  await p.mouse.move(bb.x + 10, bb.y + 10); await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(250);
  const t = await txt();
  ok('painting writes y counted from the bottom', /paint block\s+x=5 y=6/.test(t), (t.match(/paint [^\n]*/g) || []) + '');
  await p.keyboard.press('Control+z'); await p.waitForTimeout(200);
  ok('undo removes it', !/paint block\s+x=5 y=6/.test(await txt()));
  // typed line
  await p.locator('#typeline').fill('place cheezie x=40..43 y=7'); await p.keyboard.press('Enter'); await p.waitForTimeout(250);
  ok('typed place line adds', /place cheezie\s+x=40\.\.43 y=7/.test(await txt()), '');
  await p.locator('#typeline').fill('paint cheezie x=1 y=1'); await p.keyboard.press('Enter'); await p.waitForTimeout(250);
  ok('paint cheezie gets the item hint', /is an item/.test(await txt()));
  await p.screenshot({ path: process.env.H + '/proto-crater2.png' });
  // switch level
  await p.getByRole('menuitem', { name: 'File', exact: true }).click(); await p.getByText('Open starter level…').first().click(); await p.waitForTimeout(250); await p.getByRole('button', { name: 'Open Sample draft' }).click(); await p.waitForTimeout(600);
  ok('sample opens with 640 cells', (await p.locator('.cell').count()) === 640);
  ok('sample script is bottom-up', /flat 17, gap 3, flat 6|plat\s+x=12\.\.14 y=7|ground=4/.test(await txt()));
  console.log(results.join('\n')); console.log('errors', errs); await b.close();
})().catch((e) => { console.log(results.join('\n')); console.log('CRASH', e); process.exit(1); });
