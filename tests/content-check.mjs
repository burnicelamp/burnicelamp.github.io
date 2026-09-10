import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { currentLine, permittedLyrics } from '../js/lyrics.js';
const root = fileURLToPath(new URL('../', import.meta.url));
const read = name => JSON.parse(fs.readFileSync(path.join(root, 'content', `${name}.json`), 'utf8').replace(/^\uFEFF/, ''));
const names = ['music', 'cinema', 'books', 'notes', 'life'];
const data = Object.fromEntries(names.map(name => [name, read(name)]));
const asset = src => {
  assert.equal(typeof src, 'string');
  if (src.startsWith('https://') || src.startsWith('#')) return;
  assert(src.startsWith('assets/'), `Local content must live in assets/: ${src}`);
  const resolved = path.resolve(root, src);
  assert(resolved.startsWith(path.join(root, 'assets') + path.sep), `Unsafe path: ${src}`);
  assert(fs.existsSync(resolved), `Missing asset: ${src}`);
};
for (const name of names) {
  const items = data[name][name === 'music' ? 'tracks' : 'items'];
  assert(Array.isArray(items), `${name} needs an array`);
  const ids = new Set();
  for (const item of items) {
    assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id), `Invalid ID in ${name}`);
    assert(!ids.has(item.id), `Duplicate ${name} ID: ${item.id}`); ids.add(item.id);
    assert.equal(typeof item.published, 'boolean'); assert.equal(typeof item.placeholder, 'boolean');
    if (name !== 'books') assert(item.title?.trim(), `${name}/${item.id} needs title`);
    if (item.image) { asset(item.image); assert(item.alt?.trim(), `Missing alt: ${item.id}`); }
    if (name === 'music') {
      assert.equal(new URL(item.appleUrl).hostname, 'music.apple.com');
      assert.equal(new URL(item.embedSrc).hostname, 'embed.music.apple.com');
      assert(/^\d+:\d{2}$/.test(item.duration));
      if (item.audio) { asset(item.audio.src); assert(item.audio.publicPlayback === true && item.audio.attribution); assert(Number.isFinite(item.audio.offsetSeconds) && item.audio.offsetSeconds >= 0); }
    }
    if (name === 'books') { assert(item.pages?.length); item.pages.forEach(page => assert(page.title && typeof page.text === 'string')); }
    if (name === 'life') {
      assert(item.label && item.text && Array.isArray(item.photos));
      item.photos.forEach(image => { asset(image.src); assert(image.alt?.trim()); });
    }
    if (name === 'notes') assert(item.text && item.dateLabel);
  }
}
asset(data.music.album.image);
const lyrics = read('lyrics');
for (const [id, entry] of Object.entries(lyrics.tracks)) {
  assert(data.music.tracks.some(track => track.id === id), `Unknown lyric track: ${id}`);
  assert(permittedLyrics(entry), `Missing or expired static display permission: ${id}`);
  if (entry.lines.some(line => 'time' in line)) assert(permittedLyrics(entry).timed, `Unsorted or invalid lyric times: ${id}`);
}
const owned = { rights: { kind: 'owned', publicDisplay: true, staticPublication: true, attribution: 'Original test text' }, lines: [{ time: 2, text: '测试一' }, { time: 5, text: '测试二' }] };
assert.equal(currentLine(owned.lines, 0), -1);
assert.equal(currentLine(owned.lines, 2), 0);
assert.equal(currentLine(owned.lines, 5), 1);
assert.equal(currentLine(owned.lines, 999), 1);
assert.equal(currentLine([], 10), -1);
assert.equal(permittedLyrics(owned).timed, true);
assert.equal(permittedLyrics({ ...owned, rights: { ...owned.rights, expiresAt: '2000-01-01' } }), null);
assert.equal(permittedLyrics({ ...owned, rights: { ...owned.rights, kind: 'musixmatch' } }), null);
assert.equal(permittedLyrics({ ...owned, rights: { ...owned.rights, staticPublication: false } }), null);
assert.equal(permittedLyrics({ ...owned, lines: [{ text: '阅读测试' }] }).timed, false);
assert.equal(permittedLyrics({ ...owned, lines: [...owned.lines].reverse() }).timed, false);
assert.equal(fs.readFileSync(path.join(root, 'CNAME'), 'utf8').trim(), 'burnlamp.is-my.id');
assert(fs.existsSync(path.join(root, '.nojekyll')));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
for (const title of data.music.tracks.map(track => track.title)) assert(!html.includes(title), `Content leaked into page: ${title}`);
assert(!html.includes('等待真实内容'));
console.log('PASS: six content sources, IDs, assets, lyric permission/time boundaries, static page skeleton and domain.');
