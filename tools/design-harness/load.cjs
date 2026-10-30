const { chromium } = require('/home/scott/source/liminal-hq/lieutenant-fizz/node_modules/@playwright/test');
(async () => {
  const exe = process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell';
  const b = await chromium.launch({ executablePath: exe, args: ['--mute-audio', '--use-gl=swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text().slice(0, 200)); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + String(e).slice(0, 300)));
  await p.goto('http://127.0.0.1:8765/' + (process.argv[2] || 'Proto.dc.html'));
  await p.waitForTimeout(2500);
  console.log('title:', await p.title());
  console.log('body text start:', (await p.evaluate(() => document.body.innerText)).slice(0, 200).replace(/\n/g, ' | '));
  console.log('cells:', await p.evaluate(() => document.querySelectorAll('.cell').length));
  await p.screenshot({ path: process.argv[3] || '/home/scott/.claude/jobs/66cb2a84/tmp/real-harness/proto-real.png' });
  console.log('errors:', errs.length ? errs.join('\n') : 'none');
  await b.close();
})();
