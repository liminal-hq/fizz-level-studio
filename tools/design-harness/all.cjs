const { chromium } = require('/home/scott/source/liminal-hq/lieutenant-fizz/node_modules/@playwright/test');
const fs = require('fs');
(async () => {
  const exe = process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell';
  const b = await chromium.launch({ executablePath: exe, args: ['--mute-audio'] });
  const files = fs.readdirSync(process.env.H).filter((f) => f.endsWith('.dc.html')).sort();
  for (const f of files) {
    const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
    const errs = [];
    p.on('pageerror', (e) => errs.push('pageerror ' + String(e).slice(0, 160)));
    p.on('console', (m) => { if (m.type() === 'error' && !/ERR_|Failed to load resource|attribute d:|attribute (width|height|cx|cy|r|x|y)/.test(m.text())) errs.push(m.text().slice(0, 160)); });
    await p.goto('http://127.0.0.1:8765/' + f, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch((e) => errs.push('goto ' + String(e).slice(0, 80))); await p.waitForTimeout(2200);
    const len = await p.evaluate(() => document.body.innerText.trim().length);
    const holes = await p.evaluate(() => (document.body.innerHTML.match(/\{\{[^}]{1,40}\}\}/g) || []).length);
    console.log((errs.length || len < 40 || holes ? 'CHECK ' : 'ok    ') + f.padEnd(26) + ' text=' + len + ' unresolved-holes=' + holes + (errs.length ? ' errors: ' + errs.slice(0, 2).join(' | ') : ''));
    await p.close();
  }
  await b.close();
})();
