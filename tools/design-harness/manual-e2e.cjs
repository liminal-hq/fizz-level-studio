const { chromium } = require('/home/scott/source/liminal-hq/lieutenant-fizz/node_modules/@playwright/test');
const results = []; const ok = (n, c, x) => results.push((c ? 'PASS ' : 'FAIL ') + n + (x ? ' — ' + x : ''));
(async () => {
  const exe = process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell';
  const b = await chromium.launch({ executablePath: exe, args: ['--mute-audio'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
  p.on('console', (m) => { if (m.type() === 'error' && !/ERR_|Failed to load resource|attribute d:/.test(m.text())) errs.push(m.text().slice(0, 200)); });
  await p.goto('http://127.0.0.1:8765/Manual.dc.html', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2200);
  const txt = () => p.evaluate(() => document.body.innerText);
  ok('page renders the title and twelve contents links', /The Fizz builder language/.test(await txt()) && (await p.locator('nav a').count()) === 12);
  ok('default line parses and shows three fills', /It parses/.test(await txt()) && /b\.fill\(26, 26, 9, 9, PLAT\);/.test(await txt()) && /b\.fill\(30, 30, 9, 9, PLAT\);/.test(await txt()));
  await p.getByRole('button', { name: 'paint blok x=3..5 y=9' }).click(); await p.waitForTimeout(150);
  ok('a typo gets E002 and a suggestion', /E002/.test(await txt()) && /did you mean `block`\?/.test(await txt()));
  await p.locator('#chk').fill('paint block x=190..200 y=9'); await p.waitForTimeout(200);
  ok('typing a line is checked live (E013)', /E013/.test(await txt()) && /outside the level \(x runs 0\.\.191\)/.test(await txt()));
  await p.locator('#chk').fill('place cheezie x=1..2 y=3..4'); await p.waitForTimeout(200);
  ok('place expands x first, then y', /b\.item\(ItemKind::Cheezie, 1, 3\);\s*b\.item\(ItemKind::Cheezie, 1, 4\);\s*b\.item\(ItemKind::Cheezie, 2, 3\)/.test(await txt()));
  await p.locator('#chk').fill(''); await p.waitForTimeout(150);
  ok('an empty box shows the hint', /Type a line, or pick one of the examples above/.test(await txt()));
  // statements
  const nStart = await p.locator('#reference button[aria-pressed]').count();
  await p.getByRole('button', { name: /^Enemies/ }).click(); await p.waitForTimeout(150);
  ok('Enemies filter shows four statements', ((await p.locator('#reference').innerText()).split('Becomes').length - 1) === 4);
  await p.getByRole('button', { name: /^All/ }).click(); await p.locator('#find').fill('ladder'); await p.waitForTimeout(200);
  ok('search narrows to the ladder statement', /ladder x=N y=RANGE/.test(await txt()) && !/stairs-right x=N/.test(await txt()));
  await p.locator('#find').fill('zzzz'); await p.waitForTimeout(150);
  ok('an empty search says so', /No statement matches that search/.test(await txt()));
  await p.locator('#find').fill(''); await p.getByRole('button', { name: /^Edits/ }).click(); await p.getByRole('button', { name: 'Put this in the checker' }).first().click(); await p.waitForTimeout(200);
  ok('Put this in the checker loads the example', (await p.locator('#chk').inputValue()) === 'paint one-way x=26,28,30 y=9');
  // words
  await p.getByRole('tab', { name: /^Items/ }).click(); await p.waitForTimeout(150);
  ok('Items tab lists key-red', /key-red/.test(await p.locator('#words').innerText()));
  // errors
  await p.getByRole('option', { name: /E013/ }).click(); await p.waitForTimeout(150);
  ok('E013 detail shows', /Outside the level/.test(await txt()));
  await p.getByRole('button', { name: 'Make this error in the checker' }).click(); await p.waitForTimeout(200);
  ok('Make this error loads a line that gives E013', (await p.locator('#chk').inputValue()) === 'paint block x=190..200 y=9' && /E013/.test(await p.locator('#try').innerText()));
  await p.getByRole('option', { name: /E006/ }).click(); await p.waitForTimeout(150);
  ok('E006 says the checker cannot produce it', /cannot produce this one/.test(await txt()));
  // example
  await p.locator('#example button', { hasText: 'row choc    x=46..52 y=8 by=3' }).click(); await p.waitForTimeout(150);
  ok('line 29 explains the row and shows its Rust', /Chocolate every 3 tiles/.test(await txt()) && /b\.row\(ItemKind::Choc, 46, 3, 8, 3\);/.test(await txt()));
  await p.locator('#example button', { hasText: 'level "Crater Fields"' }).click(); await p.waitForTimeout(150);
  ok('line 2 shows the Builder::new call', /Builder::new\(192, 28, 4\)/.test(await txt()));
  console.log('page height', await p.evaluate(() => document.documentElement.scrollHeight));
  await p.screenshot({ path: process.env.H + '/manual-top.png' });
  await p.locator('#try').scrollIntoViewIfNeeded(); await p.screenshot({ path: process.env.H + '/manual-try.png' });
  ok('no console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(results.join('\n')); await b.close();
})().catch((e) => { console.log(results.join('\n')); console.log('CRASH', String(e).slice(0, 600)); process.exit(1); });
