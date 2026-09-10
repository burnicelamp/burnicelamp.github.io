const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, 'content', name + '.json'), 'utf8'));
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const file = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (error, bytes) => { res.writeHead(error ? 404 : 200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }); res.end(error ? 'Not found' : bytes); });
});
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><rect width="600" height="800" fill="#bcc5e2"/><circle cx="300" cy="380" r="150" fill="#7c8bbe"/></svg>';
function silentWav() {
  const rate = 8000, size = rate * 2 * 60, b = Buffer.alloc(44 + size);
  b.write('RIFF'); b.writeUInt32LE(36 + size, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(size, 40); return b;
}
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://embed.music.apple.com/**', route => route.fulfill({ contentType: 'text/html', body: '<p>Official player network stub</p>' }));
  await page.route('https://is1-ssl.mzstatic.com/**', route => route.fulfill({ contentType: 'image/svg+xml', body: svg }));
  let visit = 0;
  const go = async (hash = '') => { await page.goto(base + '/?visit=' + (++visit) + hash, { waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => document.documentElement.dataset.contentReady === 'true'); };
  try {
    await go();
    assert.deepEqual(await page.locator('.page-shell>section').evaluateAll(nodes => nodes.map(n => n.id)), ['life', 'music', 'cinema', 'reading', 'notes']);
    assert.equal(await page.locator('.track-row').count(), 5);
    for (const [i, track] of read('music').tracks.entries()) {
      await page.locator('.track-row').nth(i).click();
      assert.equal(await page.locator('[data-current-track]').textContent(), track.title);
      assert.equal(await page.locator('[data-lyrics-title]').textContent(), track.title);
      assert.equal(await page.locator('[data-apple-player]').getAttribute('src'), track.embedSrc);
      assert.equal(await page.locator('[data-lyrics-link]').getAttribute('href'), track.appleUrl);
    }
    assert.equal(await page.locator('.lyrics-empty').count(), 1);
    await page.locator('[data-cinema-next]').click();
    await page.waitForFunction(() => document.querySelector('[data-poster-rail]').scrollLeft > 100);
    await page.locator('[data-cinema-prev]').click();
    await page.waitForFunction(() => document.querySelector('[data-poster-rail]').scrollLeft < 5);
    await page.locator('[data-book-next]').click();
    assert.equal(await page.locator('[data-book-status]').textContent(), read('books').items[0].pages[1].label);
    await page.locator('[data-book-prev]').click();
    assert.equal(await page.locator('.book-sheet.is-turned').count(), 0);
    const pageCount = await page.locator('.book-sheet').count();
    for (let i = 0; i < pageCount; i++) await page.locator('[data-book-next]').click();
    assert.equal(await page.locator('[data-book-next]').isDisabled(), true);
    for (let i = 0; i < pageCount; i++) await page.locator('[data-book-prev]').click();
    assert.equal(await page.locator('[data-book-prev]').isDisabled(), true);
    await page.locator('.portrait-tab').nth(1).click();
    assert.equal(await page.locator('#portrait-story').getAttribute('data-placeholder'), 'true');
    await page.locator('.portrait-tab').nth(1).press('ArrowRight');
    assert.equal(await page.locator('.portrait-tab').nth(2).getAttribute('aria-selected'), 'true');
    for (const width of [320, 390, 768, 980, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Overflow at ${width}`);
      const tiny = await page.locator('body *').evaluateAll(nodes => nodes.filter(n => n.childNodes.length && [...n.childNodes].some(c => c.nodeType === 3 && c.textContent.trim()) && getComputedStyle(n).display !== 'none' && n.getClientRects().length && parseFloat(getComputedStyle(n).fontSize) < 12.5).map(n => n.className));
      assert.deepEqual(tiny, [], `Tiny type at ${width}`);
      if (width <= 980) {
        await page.locator('.nav-toggle').click();
        assert.equal(await page.locator('#mobile-nav').evaluate(n => n.inert), false);
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#mobile-nav').evaluate(n => n.inert), true);
        await page.locator('.nav-toggle').click(); await page.locator('#mobile-nav a[href="#notes"]').click();
        await page.waitForFunction(() => document.querySelector('[data-current-section]').textContent === '记录');
      }
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    let previous = '';
    for (let i = 0; i < 14; i++) {
      await page.locator('[data-wander]').click();
      await page.waitForFunction(() => !document.querySelector('[data-wander]').disabled);
      const hash = new URL(page.url()).hash;
      assert.notEqual(hash, previous); previous = hash;
      assert(/^#(music-track-[1-5]|notes-note-1|life-through-music)$/.test(hash), `Invalid random target ${hash}`);
      const target = await page.locator('.wander-arrival').evaluate(n => ({ placeholder: n.dataset.placeholder, top: n.getBoundingClientRect().top }));
      assert.equal(target.placeholder, 'false'); assert(target.top >= 60, `Target covered: ${hash}`);
    }
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior), 'auto');
    console.log('PASS: existing tracks, lyrics fallback, carousel, all book pages, portrait keyboard, five viewport sizes, navigation and random eligibility.');

    // Adding one entry with three photos, a film, a book and a note needs no HTML edit.
    const life = read('life'); life.items.push({ id: 'test-life', published: true, placeholder: false, label: '测试视角', title: '测试肖像', text: '原创测试内容', photos: [1, 2, 3].map(i => ({ src: `assets/life/test-${i}.svg`, alt: `测试照片 ${i}` })) });
    const cinema = read('cinema'); cinema.items.push({ id: 'test-film', title: '测试影片', meta: '测试', note: '原创测试短评', published: true, placeholder: false, image: 'assets/life/test-1.svg', alt: '测试图' });
    const books = read('books'); books.items.push({ id: 'test-book', title: '测试书', published: true, placeholder: false, pages: [{ label: '测试阅读', title: '测试书', text: '原创测试读后感', footer: '测试' }] });
    const notes = read('notes'); notes.items.push({ id: 'test-note', title: '测试记录', text: '<img src=x onerror=alert(1)>', dateLabel: '测试', published: true, placeholder: false });
    for (const [name, data] of Object.entries({ life, cinema, books, notes })) await page.route(`**/content/${name}.json`, route => route.fulfill({ json: data }));
    await page.route('**/assets/life/test-*.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: svg }));
    for (const [hash, text] of [['life-test-life', '测试肖像'], ['cinema-test-film', '测试影片'], ['reading-test-book', '测试书'], ['notes-test-note', '测试记录']]) {
      await go('#' + hash); await page.waitForFunction(() => document.querySelector('.wander-arrival'));
      assert((await page.locator('body').textContent()).includes(text), `Deep link did not render: ${hash}`);
      if (hash === 'life-test-life') { assert.equal(await page.locator('.portrait-photo-controls button').count(), 3); await page.locator('.portrait-photo-controls button').nth(2).click(); assert.equal(await page.locator('.portrait-frame img').getAttribute('alt'), '测试照片 3'); }
      if (hash === 'reading-test-book') assert.equal(await page.locator('[data-book-heading]').textContent(), '测试书');
    }
    assert.equal(await page.locator('.notes-list img').count(), 0);
    console.log('PASS: data-only additions and deep links for life/photos, film, book, note; content remains text.');

    const music = read('music'); music.tracks[0].audio = { src: '/fixture.wav', publicPlayback: true, offsetSeconds: 2, attribution: 'Original test silence' };
    const lyrics = { tracks: { 'track-1': { rights: { kind: 'owned', publicDisplay: true, staticPublication: true, attribution: '原创测试文字' }, lines: Array.from({ length: 20 }, (_, i) => ({ time: i * 2, text: `仅用于回归的原创测试行 ${i + 1}` })) } } };
    await page.route('**/content/music.json', route => route.fulfill({ json: music }));
    await page.route('**/content/lyrics.json', route => route.fulfill({ json: lyrics }));
    await page.route('**/fixture.wav', route => {
      const bytes = silentWav(), range = /bytes=(\d+)-(\d*)/.exec(route.request().headers().range || '');
      const start = range ? Number(range[1]) : 0, end = range?.[2] ? Number(range[2]) : bytes.length - 1;
      return route.fulfill({ status: range ? 206 : 200, contentType: 'audio/wav', headers: { 'Accept-Ranges': 'bytes', ...(range ? { 'Content-Range': `bytes ${start}-${end}/${bytes.length}` } : {}) }, body: bytes.subarray(start, end + 1) });
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await go(); await page.locator('.lyrics-card').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector('audio')?.readyState >= 1);
    await page.locator('audio').evaluate(media => { media.currentTime = 10; });
    await page.waitForFunction(() => document.querySelector('.lyric-line.is-current')?.dataset.line === '6');
    assert.equal(await page.locator('[data-lyrics-mode]').textContent(), '随声同步');
    await page.locator('audio').evaluate(async media => { await media.play(); });
    await page.waitForFunction(() => document.querySelector('audio').currentTime > 10.2);
    await page.locator('audio').evaluate(media => media.pause());
    const pausedTime = await page.locator('audio').evaluate(media => media.currentTime);
    await page.waitForTimeout(350);
    assert.equal(await page.locator('audio').evaluate(media => media.currentTime), pausedTime);
    await page.locator('[data-lyrics-viewport]').dispatchEvent('wheel', { deltaY: 100 });
    assert.equal(await page.locator('[data-lyrics-resume]').isVisible(), true);
    const pageY = await page.evaluate(() => scrollY);
    await page.locator('audio').evaluate(media => { media.currentTime = 16; });
    await page.waitForFunction(() => document.querySelector('.lyric-line.is-current')?.dataset.line === '9');
    await page.waitForFunction(() => document.querySelector('[data-lyrics-resume]').hidden, { timeout: 7500 });
    assert.equal(await page.evaluate(() => scrollY), pageY, 'Lyrics scrolled the page');
    await page.locator('.lyric-line').nth(10).click();
    assert.equal(Math.round(await page.locator('audio').evaluate(media => media.currentTime)), 18);
    await page.locator('audio').evaluate(media => { media.currentTime = 0; });
    await page.waitForFunction(() => document.querySelector('.lyric-line.is-current')?.dataset.line === '1');
    await page.locator('.track-row').nth(1).click();
    assert.equal(await page.locator('audio').count(), 0); assert.equal(await page.locator('.lyric-line').count(), 0);
    assert.equal(await page.locator('.lyrics-empty').count(), 1);
    // Lyrics with an iframe remain readable and never simulate a clock.
    delete music.tracks[0].audio; await go();
    assert.equal(await page.locator('.lyric-line').count(), 20);
    assert.equal(await page.locator('.lyric-line.is-current').count(), 0);
    assert.equal(await page.locator('[data-lyrics-mode]').textContent(), '自由阅读');
    console.log('PASS: real media time, excerpt offset, seek/backseek, manual scroll/resume, no page scroll, track cleanup, iframe reading mode.');
    await page.route('**/content/cinema.json', route => route.fulfill({ status: 500, body: 'Unavailable' }));
    await go(); assert.equal(await page.locator('.track-row').count(), 5);
    assert((await page.locator('#cinema').textContent()).includes('重新载入'));
    assert.deepEqual(errors, []);
    console.log('PASS: isolated fetch failure; no uncaught browser errors. External Apple network is stubbed, not a playback verification.');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
