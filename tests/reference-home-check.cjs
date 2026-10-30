const assert = require('node:assert/strict');
const { launchBrowser } = require('./browser-runtime.cjs');
(async()=>{
  const {server}=await import('../tools/serve.mjs'); const s=server();
  await new Promise(r=>s.listen(0,'127.0.0.1',r));
  const base=`http://127.0.0.1:${s.address().port}`; const browser=await launchBrowser();
  try{
    for(const width of [320,390,768,980,1440]){
      const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
      const errors=[]; page.on('pageerror',e=>errors.push(e.message));
      await page.route('https://embed.music.apple.com/**',r=>r.fulfill({contentType:'text/html',body:'官方播放器测试替身'}));
      await page.goto(base,{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>document.documentElement.dataset.contentReady==='true');
      await page.waitForFunction(()=>document.querySelectorAll('[data-featured] a').length===3);
      assert.equal(await page.locator('.world-index-list a').count(),5);
      assert.equal(await page.locator('[data-featured] a').first().getAttribute('href'),'#music-track-1');
      assert.equal(await page.locator('.hero-waves').count(),1);
      for (const id of ['about','work','contact']) assert.equal(await page.locator(`#${id}`).count(),1);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`overflow at ${width}`);
      assert.equal(await page.locator('.hero-waves').evaluate(e=>getComputedStyle(e,'::after').animationName),'none');
      assert.deepEqual(errors,[]); await page.close();
    }
    const page=await browser.newPage();
    await page.route('https://image.tmdb.org/**',route=>route.abort());
    await page.goto(base,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.querySelectorAll('[data-featured] a').length===3);
    await page.locator('[data-featured] a').nth(1).scrollIntoViewIfNeeded();
    await page.waitForFunction(()=>document.querySelector('[data-featured] a:nth-child(2) .featured-visual span')?.textContent==='风骚律师');
    await page.goto(base+'/#cinema-cinema-1');
    await page.waitForFunction(()=>document.documentElement.dataset.contentReady==='true');
    assert.equal(new URL(page.url()).hash,'#cinema-cinema-1');
    await page.goto(base+'/collection.html#cinema-cinema-1');
    await page.waitForFunction(()=>document.documentElement.dataset.contentReady==='true');
    assert.equal(new URL(page.url()).hash,'#cinema-cinema-1');
    await page.close(); console.log('PASS: unified homepage, five widths, reduced motion and legacy paths.');
  }finally{await browser.close();s.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
