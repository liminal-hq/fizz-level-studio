const { chromium } = require('/home/scott/source/liminal-hq/lieutenant-fizz/node_modules/@playwright/test');
const results = []; const ok = (n, c, x) => results.push((c ? 'PASS ' : 'FAIL ') + n + (x ? ' — ' + x : ''));
(async () => {
  const exe = process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell';
  const b = await chromium.launch({ executablePath: exe, args: ['--mute-audio', '--use-gl=swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
  await p.goto('http://127.0.0.1:8765/Proto.dc.html'); await p.waitForTimeout(2500);
  await p.getByRole('menuitem', { name: 'File', exact: true }).click(); await p.getByText('Open starter level…').first().click(); await p.waitForTimeout(250); await p.getByRole('button', { name: 'Open Sample draft' }).click(); await p.waitForTimeout(600);
  const txt = () => p.evaluate(() => document.body.innerText);
  const cell = async (x, y) => { const bb = await p.locator('.cell').nth(y * 40 + x).boundingBox(); return { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 }; };
  { const far = await cell(25, 5); await p.mouse.click(far.x, far.y); await p.waitForTimeout(150); } await p.getByRole('button', { name: /Select, drag/ }).click();
  const s1 = await cell(5, 10), s2 = await cell(7, 10);
  await p.mouse.move(s1.x, s1.y); await p.mouse.down(); await p.waitForTimeout(60); for (let i = 1; i <= 8; i++) { await p.mouse.move(s1.x + (s2.x - s1.x) * i / 8, s1.y + (s2.y - s1.y) * i / 8); await p.waitForTimeout(40); } await p.mouse.up(); await p.waitForTimeout(250);
  ok('drag selects an area (3 × 1 shown)', /3 × 1/.test(await txt()));
  await p.keyboard.press('Control+c'); await p.waitForTimeout(150);
  ok('Ctrl+C copies', /Copied a 3 × 1 area/.test(await txt()));
  await p.keyboard.press('t'); const st = await cell(5, 8); await p.mouse.move(st.x, st.y); await p.waitForTimeout(150);
  await p.screenshot({ path: process.env.H + '/stamp-preview2.png' });
  await p.mouse.click(st.x, st.y); await p.waitForTimeout(250);
  ok('Stamp places the copy', /Stamped 3 tiles at x 5, y 7/.test(await txt()), (await txt()).match(/Stamped[^\n]*/) + '');
  ok('script lists the stamp', /place cheezie\s+x=5\.\.7 y=7/.test(await txt()));
  await p.keyboard.press('Control+z'); await p.waitForTimeout(150);
  ok('undo takes the stamp back', !/place cheezie\s+x=5\.\.7 y=7/.test(await txt()));
  // cut
  await p.keyboard.press('s'); await p.mouse.move(s1.x, s1.y); await p.mouse.down(); await p.waitForTimeout(60); for (let i = 1; i <= 6; i++) { await p.mouse.move(s1.x + (s2.x - s1.x) * i / 6, s1.y + (s2.y - s1.y) * i / 6); await p.waitForTimeout(40); } await p.mouse.up();
  await p.keyboard.press('Control+x'); await p.waitForTimeout(200);
  ok('Ctrl+X cuts', /Cut a 3 × 1 area/.test(await txt()));
  // arrow move on selected thing
  const g = await cell(9, 11); await p.mouse.click(g.x, g.y); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(200);
  ok('arrow moves the selected gloop to x 10', /x 10/.test(await txt()));
  // menu hover switching
  await p.getByRole('menuitem', { name: 'Edit', exact: true }).click(); await p.waitForTimeout(100);
  await p.getByRole('menuitem', { name: 'View', exact: true }).hover(); await p.waitForTimeout(150);
  ok('hovering the bar switches menus', /Zoom in/.test(await txt()));
  // Ask Claude from the Claude menu in direct mode via Claude tab
  await p.keyboard.press('Escape');
  console.log(results.join('\n'), '\nerrors:', errs.length ? errs : 'none');
  await b.close();
})().catch((e) => { console.log(results.join('\n')); console.log('CRASH', e); process.exit(1); });
