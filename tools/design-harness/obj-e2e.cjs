const { chromium } = require('/home/scott/source/liminal-hq/lieutenant-fizz/node_modules/@playwright/test');
const results = []; const ok = (n, c, x) => results.push((c ? 'PASS ' : 'FAIL ') + n + (x ? ' — ' + x : ''));
(async () => {
  const exe = process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell';
  const b = await chromium.launch({ executablePath: exe, args: ['--mute-audio'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; p.on('console', (m) => { if (m.type() === 'error' && !/attribute d:/.test(m.text())) errs.push(m.text().slice(0, 200)); }); p.on('pageerror', (e) => errs.push('pageerror ' + e));
  await p.goto('http://127.0.0.1:8765/Proto.dc.html'); await p.waitForTimeout(3500);
  const txt = () => p.evaluate(() => document.body.innerText);
  const openLevel = async (name) => { await p.getByRole('menuitem', { name: 'File', exact: true }).click(); await p.getByText('Open starter level…').first().click(); await p.waitForTimeout(250); await p.getByRole('button', { name: 'Open ' + name, exact: true }).click(); await p.waitForTimeout(900); };
  // Zarg Lookout has a lift with a size and a rest time
  await openLevel('Zarg Lookout');
  await p.getByRole('button', { name: 'Expand objects' }).click(); await p.waitForTimeout(250);
  ok('Objects window lists the lift', /Lift 18,4[78] to 18,5[67]/.test(await txt()), (await txt()).match(/Lift [^\n]*/g) + '');
  await p.locator('[role=listitem]', { hasText: /^Lift 18/ }).click(); await p.waitForTimeout(250);
  ok('selecting it shows its fields', /Rests \(s\)/.test(await txt()) && /Speed/.test(await txt()));
  await p.getByRole('button', { name: 'More Rests (s)' }).click(); await p.waitForTimeout(250);
  ok('changing the rest time rewrites its script line', /hover from=18,47\.5 to=18,56\.5 speed=0\.1 size=3x0\.5 dwell=2\.5/.test(await txt()), (await txt()).match(/hover[^\n]*/g) + '');
  await p.keyboard.press('Control+z'); await p.waitForTimeout(250);
  ok('undo restores dwell=2', /dwell=2(?!\.)/.test(await txt()) && !/dwell=2\.5/.test(await txt()));
  // draw a new lift with the tool
  await p.getByRole('toolbar', { name: 'Tools' }).getByRole('button', { name: /^Lift/ }).click();
  const cells = p.locator('.cell');
  const bb1 = await cells.nth(60 * 40 + 5).boundingBox().catch(() => null);
  await p.screenshot({ path: process.env.H + '/obj-zarg.png' });
  // channels (Mirror Shafts)
  await openLevel('Mirror Shafts');
  if (await p.getByRole('button', { name: 'Expand objects' }).count()) await p.getByRole('button', { name: 'Expand objects' }).click();
  await p.waitForTimeout(200);
  ok('channels 1,2,3 start on', (await p.getByRole('button', { name: 'Channel 2' }).getAttribute('aria-pressed')) === 'true');
  await p.getByRole('button', { name: 'Channel 2' }).click(); await p.waitForTimeout(300);
  ok('turning channel 2 off rewrites the channel line', /channel 1,3 on/.test(await txt()), (await txt()).match(/channel[^\n]*/g) + '');
  // Sugar glass gallery rooms
  await openLevel('Sugar Glass Gallery');
  ok('rooms are listed', /Secret room|Room /.test(await txt()));
  // overworld
  await p.getByRole('menuitem', { name: 'File', exact: true }).click(); await p.getByText('Open starter level…').first().click(); await p.waitForTimeout(250);
  const owBtn = p.getByRole('button', { name: 'Open Overworld', exact: true });
  ok('the card lists the overworld', (await owBtn.count()) === 1);
  await owBtn.click(); await p.waitForTimeout(1200);
  if (await p.getByRole('button', { name: 'Expand objects' }).count()) await p.getByRole('button', { name: 'Expand objects' }).click();
  await p.waitForTimeout(200);
  ok('overworld has 60 x 44 cells', (await p.locator('.cell').count()) === 2640);
  ok('its points are listed as objects', /Level: Crater Fields/.test(await txt()) && /Teleporter/.test(await txt()), (await txt()).match(/Level: [^\n]*/g) + '');
  // add a sign with the Point tool, then change a level point's level and its requirements
  await p.getByRole('button', { name: 'Sign', exact: true }).click(); await p.waitForTimeout(200);
  await p.mouse.click(900, 430); await p.waitForTimeout(350);
  ok('the Point tool adds a sign', /Sign 3/.test(await txt()) && /sign 3 at=\d+,\d+/.test(await txt()), (await txt()).match(/sign [^\n]*/g) + '');
  await p.locator('[role=listitem]', { hasText: /^Level: Meteor Mesa/ }).click(); await p.waitForTimeout(250);
  await p.getByRole('button', { name: 'More Level' }).click(); await p.waitForTimeout(300);
  ok('changing the level on a point rewrites its line', /level zarg-lookout at=16,14 req=crater/.test(await txt()), (await txt()).match(/level [^\n]*at=16,14[^\n]*/g) + '');
  await p.keyboard.press('Control+z'); await p.waitForTimeout(250);
  ok('undo puts the level back', /level meteor-mesa at=16,14 req=crater/.test(await txt()));
  await p.screenshot({ path: process.env.H + '/obj-overworld.png' });
  console.log(results.join('\n')); console.log('errors', errs); await b.close();
})().catch((e) => { console.log(results.join('\n')); console.log('CRASH', e); process.exit(1); });
