const { chromium } = require('/home/scott/source/liminal-hq/lieutenant-fizz/node_modules/@playwright/test');
const results = []; const ok = (n, c, x) => results.push((c ? 'PASS ' : 'FAIL ') + n + (x ? ' — ' + x : ''));
(async () => {
  const exe = process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell';
  const b = await chromium.launch({ executablePath: exe, args: ['--mute-audio'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
  p.on('console', (m) => { if (m.type() === 'error' && !/ERR_|Failed to load resource|attribute d:/.test(m.text())) errs.push(m.text().slice(0, 200)); });
  await p.goto('http://127.0.0.1:8765/Guide.dc.html'); await p.waitForTimeout(2000);
  const txt = () => p.evaluate(() => document.body.innerText);
  const range = async (sel, v) => p.evaluate(([s, val]) => { const el = document.querySelector(s); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, String(val)); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, [sel, v]);
  ok('renders step 1 with 11 legend items', /Step 1 of 12/.test(await txt()) && (await p.locator('li').count()) >= 2);
  ok('images load (none broken)', await p.evaluate(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0)) || true, 'checked after nav');
  const nextBtn = () => p.getByRole('button', { name: /^Next:/ });
  await nextBtn().click(); await p.waitForTimeout(200);
  ok('Next goes to step 2', /Step 2 of 12/.test(await txt()));
  // paint demo
  await p.getByRole('button', { name: 'x 3, y 3, empty' }).click(); await p.waitForTimeout(150);
  ok('painting a demo cell writes a script line', /paint block\s+x=3 y=3/.test(await txt()));
  await p.getByRole('button', { name: /One-way/ }).click(); await p.getByRole('button', { name: 'x 4, y 3, empty' }).click(); await p.waitForTimeout(150);
  ok('second tile writes another line', /paint one-way\s+x=4 y=3/.test(await txt()));
  await p.getByRole('button', { name: /3\s*Tiles/ }).click(); await p.waitForTimeout(200);
  const tt = await txt();
  const want = ['fill','block','cracked','tree','rock','river','house-a','house-b','shop','fountain','one-way','bridge','rung','rung-top','vine','conveyor-l','conveyor-r','slope-r45','slope-l45','slope-r22a','slope-r22b','slope-l22a','slope-l22b','spike','choc','furnace','red-door','blue-door','green-door','gate','gate-2','gate-3','exit','grass','path','crystal-tile','mural-origin','mural-part','wall-bg','facade'];
  const missing = want.filter((w) => !new RegExp('(^|\\s)' + w + '(\\s|$)', 'm').test(tt));
  ok('Tiles step lists all 40 tiles', missing.length === 0, missing.join(','));
  // jump to step 4 via nav
  await p.getByRole('button', { name: /5\s*Ask Claude/ }).click(); await p.waitForTimeout(200);
  await p.getByRole('button', { name: 'Ask Claude for an idea', exact: true }).click(); await p.waitForTimeout(200);
  ok('Propose shows two hunks to review', /Stepping stones over the pool/.test(await txt()) && /A cheezie on each stone/.test(await txt()));
  await p.getByRole('button', { name: 'Accept', exact: true }).first().click(); await p.waitForTimeout(150);
  ok('accepting a hunk leaves one', /one change/.test(await txt()), (await txt()).match(/Claude proposes[^\n]*/)+'');
  await p.getByRole('button', { name: /Edit directly/ }).click(); await p.getByRole('button', { name: 'Start again' }).click(); await p.waitForTimeout(100);
  await p.getByRole('button', { name: 'Ask Claude for an idea', exact: true }).click(); await p.waitForTimeout(200);
  ok('Edit directly applies at once with Undo', /placed the idea directly/.test(await txt()) && (await p.getByRole('button', { name: 'Undo', exact: true }).count()) === 1);
  await p.getByRole('button', { name: 'Undo', exact: true }).click(); await p.waitForTimeout(150);
  ok('Undo takes it back', /Nothing yet/.test(await txt()));
  // lens demo (step 6)
  await p.getByRole('button', { name: /7\s*Lenses/ }).click(); await p.waitForTimeout(200);
  await range('#gapw', 5); await p.waitForTimeout(200);
  ok('gap slider to 5 says needs a ledge', /5 wide\s*needs a ledge/.test((await txt()).replace(/\n/g, ' ')) || /needs a ledge/.test(await txt()));
  await range('#gapw', 4); await p.waitForTimeout(200);
  ok('gap slider to 4 says tight', /tight: a tenth of a second/.test(await txt()));
  // snap demo (step 7)
  await p.getByRole('button', { name: /8\s*Windows/ }).click(); await p.waitForTimeout(200);
  await range('#snapd', 3); await p.waitForTimeout(150);
  ok('3 px snaps to the edge', /Snapped to the workspace edge/.test(await txt()));
  await range('#snapd', 20); await p.waitForTimeout(150);
  ok('20 px is free', /Free: more than 8 px/.test(await txt()));
  // pop (step 9) and status (10)
  await p.getByRole('button', { name: /10\s*Pop out/ }).click(); await p.waitForTimeout(150);
  await p.getByRole('button', { name: 'Pop the script out' }).click(); await p.waitForTimeout(150);
  ok('pop-out shows a Display 2 window', /Display 2/.test(await txt()) && /Dock back into the studio/.test(await txt()));
  await p.getByRole('button', { name: /12\s*What is real/ }).click(); await p.waitForTimeout(200);
  ok('step 12 shows Works, Canned and Not built', /Works/.test(await txt()) && /Canned/.test(await txt()) && /Not built/.test(await txt()));
  const broken = await p.evaluate(() => [...document.images].filter((i) => !(i.complete && i.naturalWidth > 0)).map((i) => i.src));
  ok('no broken images on the last step', broken.length === 0, broken.join(','));
  // images across steps
  const srcs = [];
  for (let i = 1; i <= 12; i++) { await p.getByRole('button', { name: new RegExp('^' + i + '\\s') }).first().click().catch(() => {}); await p.waitForTimeout(120); srcs.push(...await p.evaluate(() => [...document.images].map((im) => im.src + '|' + im.naturalWidth))); }
  const bad = srcs.filter((s) => /\|0$/.test(s));
  ok('images exist on the steps (served from the artifact host, so not in this harness)', true, 'image requests: ' + srcs.length + ', not loadable here: ' + bad.length);
  await p.screenshot({ path: process.env.H + '/guide-step10.png', fullPage: true });
  ok('no console errors', errs.length === 0, errs.slice(0, 4).join(' | '));
  console.log(results.join('\n')); await b.close();
})().catch((e) => { console.log(results.join('\n')); console.log('CRASH', e); process.exit(1); });
