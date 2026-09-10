import { el, q, safeUrl } from './content.js';

// Pure functions also used by the regression suite. Time values are seconds.
export function currentLine(lines, time) {
  let low = 0, high = lines.length - 1, result = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (lines[middle].time <= time) { result = middle; low = middle + 1; }
    else high = middle - 1;
  }
  return result;
}
export function permittedLyrics(entry, now = Date.now()) {
  const rights = entry?.rights;
  // API-provider responses must not be cached into a public static repository.
  if (!rights?.publicDisplay || !rights.staticPublication || !rights.attribution ||
      !['owned', 'direct-permission', 'public-domain'].includes(rights.kind) ||
      (rights.expiresAt && (!Number.isFinite(Date.parse(rights.expiresAt)) || Date.parse(rights.expiresAt) <= now))) return null;
  if (!Array.isArray(entry.lines) || !entry.lines.length || entry.lines.some(line => typeof line.text !== 'string')) return null;
  const timed = entry.lines.every((line, i, lines) => Number.isFinite(line.time) && line.time >= 0 && (!i || line.time > lines[i - 1].time));
  return { ...entry, timed };
}
export class LyricsView {
  constructor(root, data) {
    this.root = root; this.data = data; this.viewport = q('[data-lyrics-viewport]', root);
    this.resume = q('[data-lyrics-resume]', root); this.status = q('[data-lyrics-status]', root);
    this.active = -1; this.manual = false; this.timer = 0; this.cleanup = () => {};
    this.resume.addEventListener('click', () => this.follow());
    const pause = () => {
      if (!this.clock || !this.entry?.timed) return;
      this.manual = true; this.resume.hidden = false;
      this.status.textContent = '自由浏览 · 停留 5 秒后跟随';
      clearTimeout(this.timer); this.timer = setTimeout(() => this.follow(), 5000);
    };
    this.viewport.addEventListener('wheel', pause, { passive: true });
    this.viewport.addEventListener('touchstart', pause, { passive: true });
    this.viewport.addEventListener('touchmove', pause, { passive: true });
    this.viewport.addEventListener('pointerdown', pause);
    this.viewport.addEventListener('keydown', event => {
      if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) pause();
    });
    this.viewport.addEventListener('scroll', () => { if (this.manual) pause(); }, { passive: true });
  }
  setTrack(track, clock = null) {
    this.cleanup(); clearTimeout(this.timer); clearTimeout(this.expiryTimer); this.manual = false; this.active = -1;
    this.resume.hidden = true; this.clock = clock; this.track = track;
    this.entry = permittedLyrics(this.data.tracks?.[track.id]);
    if (this.entry?.rights.expiresAt) {
      this.expiryTimer = setTimeout(() => this.setTrack(track, clock), Math.min(2147483647, Math.max(1, Date.parse(this.entry.rights.expiresAt) - Date.now())));
    }
    q('[data-lyrics-title]', this.root).textContent = track.title;
    const link = q('[data-lyrics-link]', this.root); const url = safeUrl(track.appleUrl);
    if (url) link.href = url; else link.removeAttribute('href');
    this.viewport.replaceChildren(); this.viewport.scrollTop = 0;
    const attribution = q('[data-lyrics-attribution]', this.root); attribution.replaceChildren();
    const mode = q('[data-lyrics-mode]', this.root);
    if (!this.entry) {
      mode.textContent = '留给声音';
      const empty = el('div', 'lyrics-empty');
      const wave = el('div', 'lyrics-wave'); wave.setAttribute('aria-hidden', 'true');
      for (let i = 0; i < 17; i++) { const bar = el('i'); bar.style.setProperty('--bar', String(12 + Math.sin(i * 0.8) ** 2 * 28)); wave.append(bar); }
      const fallback = this.data.fallback || {};
      empty.append(wave, el('p', '', fallback.title || '让声音先抵达。'), el('span', '', fallback.description || '歌词可在音乐平台中查看。'));
      this.viewport.append(empty); this.status.textContent = '';
      return;
    }
    const synced = Boolean(clock && this.entry.timed);
    mode.textContent = synced ? '随声同步' : '自由阅读';
    this.status.textContent = synced ? '跟随播放' : '自由阅读 · 歌词可上下浏览';
    this.rows = this.entry.lines.map((line, i) => {
      const row = el(synced && clock.seek ? 'button' : 'p', 'lyric-line', line.text || '♪');
      if (row.tagName === 'BUTTON') {
        row.type = 'button'; row.setAttribute('aria-label', `跳到：${line.text || '间奏'}`);
        row.addEventListener('click', () => { clock.seek(line.time); this.follow(); });
      }
      row.dataset.line = String(i); this.viewport.append(row); return row;
    });
    attribution.append(el('span', '', this.entry.rights.attribution));
    const source = safeUrl(this.entry.rights.sourceUrl, { local: false });
    if (source) { const a = el('a', '', '歌词来源 ↗'); a.href = source; a.target = '_blank'; a.rel = 'noreferrer'; attribution.append(a); }
    if (synced) { this.cleanup = clock.subscribe(() => this.update()); this.update(); }
  }
  update() {
    if (!this.clock || !this.entry?.timed) return;
    const index = currentLine(this.entry.lines, this.clock.time());
    if (index === this.active) return;
    if (this.rows[this.active]) { this.rows[this.active].classList.remove('is-current'); this.rows[this.active].removeAttribute('aria-current'); }
    this.active = index;
    if (this.rows[index]) { this.rows[index].classList.add('is-current'); this.rows[index].setAttribute('aria-current', 'true'); }
    if (!this.manual) this.center();
  }
  center() {
    const row = this.rows?.[this.active]; if (!row) return;
    // Scroll the lyric container only, never the page.
    const top = this.viewport.scrollTop + row.getBoundingClientRect().top - this.viewport.getBoundingClientRect().top - (this.viewport.clientHeight - row.offsetHeight) / 2;
    this.viewport.scrollTo({ top, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }
  follow() {
    clearTimeout(this.timer); this.manual = false; this.resume.hidden = true;
    this.status.textContent = '跟随播放'; this.update(); this.center();
  }
}

// Optional first-party audio: only a real media clock can drive lyric highlighting.
// Offset is the full-song start time of a licensed excerpt, never guessed.
export function mediaClock(media, offset = 0) {
  return {
    time: () => media.currentTime + offset,
    seek: time => { media.currentTime = Math.max(0, Math.min(Number.isFinite(media.duration) ? media.duration : Infinity, time - offset)); },
    subscribe(callback) {
      const events = ['timeupdate', 'seeking', 'seeked', 'loadedmetadata', 'ended'];
      events.forEach(event => media.addEventListener(event, callback));
      return () => events.forEach(event => media.removeEventListener(event, callback));
    }
  };
}
