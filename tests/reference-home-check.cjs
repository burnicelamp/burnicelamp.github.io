const assert = require('node:assert/strict');
const { launchBrowser } = require('./browser-runtime.cjs');

(async () => {
  const { server } = await import('../tools/serve.mjs');
  const serverInstance = server();
  await new Promise(resolve => serverInstance.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${serverInstance.address().port}`;
  const browser = await launchBrowser();
  try {
    for (const width of [320, 390, 768, 980, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('response', response => {
        if (response.url().startsWith(base) && response.status() === 404) errors.push(`404 ${response.url()}`);
      });
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.querySelector('#work a-work a')?.getAttribute('href')?.includes('music-track-1'));
      await page.waitForFunction(() => !document.documentElement.classList.contains('is-scroll-blocked'), null, { timeout: 25000 });
      assert.equal(await page.locator('#work a-work').count(), 34);
      assert.equal(await page.locator('.s-my-way figure').count(), 16);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `overflow at ${width}`);
      assert.equal((await page.locator('h1').innerText()).replace(/\s/g, '').toLowerCase(), 'privateworld');
      assert.deepEqual(errors, [], `browser errors at ${width}`);
      await page.close();
    }
    const page = await browser.newPage();
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('#work a-work a')?.getAttribute('href')?.includes('music-track-1'));
    await page.waitForFunction(() => customElements.get('a-work'));
    await Promise.all([
      page.waitForURL('**/collection.html#music-track-1'),
      page.locator('#work a-work a').first().evaluate(link => link.click()),
    ]);
    await page.waitForFunction(() => document.documentElement.dataset.contentReady === 'true');
    await page.goto(base + '/#music-track-1', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => location.pathname === '/collection.html' && document.documentElement.dataset.contentReady === 'true');
    assert.equal(new URL(page.url()).hash, '#music-track-1');
    await page.close();
    console.log('PASS: reference homepage, five widths, 34 cards, 16 frames, JSON mapping and legacy deep-link redirect.');
  } finally { await browser.close(); serverInstance.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
