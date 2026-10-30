const { chromium } = require('/home/scott/source/liminal-hq/lieutenant-fizz/node_modules/@playwright/test');
const results = []; const ok = (n, c, x) => results.push((c ? 'PASS ' : 'FAIL ') + n + (x ? ' — ' + x : ''));
(async () => {
  const exe = process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell';
  const b = await chromium.launch({ executablePath: exe, args: ['--mute-audio'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; p.on('console', (m) => { if (m.type() === 'error' && !/attribute d:/.test(m.text())) errs.push(m.text().slice(0, 200)); }); p.on('pageerror', (e) => errs.push('pageerror ' + e));
  await p.goto('http://127.0.0.1:8765/Proto.dc.html'); await p.waitForTimeout(3500);
  const txt = () => p.evaluate(() => document.body.innerText);
  const levels = await p.evaluate(() => window.FIZZ_LEVELS.order.map((id) => [id, window.FIZZ_LEVELS.levels[id].w * window.FIZZ_LEVELS.levels[id].h, window.FIZZ_LEVELS.levels[id].name]));
  const openCard = async () => { await p.getByRole('menuitem', { name: 'File', exact: true }).click(); await p.getByText('Open starter level…').first().click(); await p.waitForTimeout(250); };
  await openCard();
  ok('card lists 18 entries', (await p.locator('[role=dialog][aria-label="Starter levels"] button[aria-label^="Open"], [role=dialog][aria-label="Starter levels"] button[aria-label^="Already"]').count()) === 18);
  await p.screenshot({ path: process.env.H + '/levels-card.png' });
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  ok('Escape closes the card', (await p.locator('[role=dialog][aria-label="Starter levels"]').count()) === 0);
  for (const [id, cells, name] of levels) {
    await openCard();
    const btn = p.locator('[role=dialog][aria-label="Starter levels"] button[aria-label="Open ' + name + '"], [role=dialog][aria-label="Starter levels"] button[aria-label="Already open: ' + name + '"]');
    if ((await btn.getAttribute('aria-label')).startsWith('Open ')) await btn.click(); else await p.keyboard.press('Escape');
    await p.waitForTimeout(700);
    const n = await p.locator('.cell').count();
    const t = await txt();
    ok(id + ': ' + cells + ' cells and the title', n === cells && t.replace(/\s+/g, ' ').includes(name + ' — Episode 1'), n + '');
    if (['zarg-lookout', 'mirror-shafts', 'bonbon-playhouse', 'citadel', 'cocoa-foundry'].includes(id)) await p.screenshot({ path: process.env.H + '/lv-' + id + '.png' });
  }
  console.log(results.join('\n')); console.log('errors', errs); await b.close();
})().catch((e) => { console.log(results.join('\n')); console.log('CRASH', e); process.exit(1); });
