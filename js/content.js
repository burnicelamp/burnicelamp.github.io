// Content is untrusted text. Never interpolate it into HTML.
export const q = (s, parent = document) => parent.querySelector(s);
export const qa = (s, parent = document) => [...parent.querySelectorAll(s)];
export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}
export function safeUrl(value, { local = true } = {}) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value, document.baseURI);
    return url.protocol === 'https:' || (local && url.origin === location.origin) ? url.href : '';
  } catch { return ''; }
}
export function photo(data, className = '') {
  const image = el('img', className);
  const src = safeUrl(data.src);
  image.alt = data.alt || '';
  image.loading = 'lazy'; image.decoding = 'async';
  if (src) image.src = src;
  image.addEventListener('error', () => {
    const fallback = el('div', 'image-unavailable', data.alt || '画面暂不可见');
    image.replaceWith(fallback);
  }, { once: true });
  return image;
}
export const visible = (items = []) => items.filter(item => item.published !== false);
export const real = item => item.published !== false && item.placeholder === false;
export async function loadContent() {
  const names = ['music', 'lyrics', 'cinema', 'books', 'notes', 'life'];
  const entries = await Promise.all(names.map(async name => {
    try {
      const response = await fetch(new URL(`../content/${name}.json`, import.meta.url));
      if (!response.ok) throw Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!data || typeof data !== 'object') throw Error('Expected an object');
      if (name !== 'lyrics' && !Array.isArray(data[name === 'music' ? 'tracks' : 'items'])) throw Error('Expected items');
      return [name, data];
    } catch (error) {
      console.error(`Unable to load ${name} content`, error);
      return [name, { error: true, items: [], tracks: [] }];
    }
  }));
  return Object.fromEntries(entries);
}
export function renderContent(data) {
  const targets = [];
  const register = (item, section, node, title = item.title, index = 0) => {
    node.dataset.contentId = item.id;
    node.dataset.placeholder = String(item.placeholder !== false);
    node.id = `${section}-${item.id}`;
    if (real(item)) targets.push({ id: node.id, item, section, node, title, index });
  };
  const music = data.music;
  const musicText = text => (text || '').replaceAll('{count}', new Intl.NumberFormat('zh-CN-u-nu-hanidec').format(visible(music.tracks).length));
  q('[data-music-intro]').textContent = musicText(music.intro);
  if (music.album) {
    const a = music.album;
    const art = q('[data-album-art]');
    art.href = safeUrl(a.url); art.setAttribute('aria-label', `在 Apple Music 打开${a.title}`);
    art.append(photo({ src: a.image, alt: a.alt }), el('span', '', '在 Apple Music 打开'));
    q('[data-album-meta]').append(el('p', '', a.meta), el('h3', '', a.title), el('span', '', musicText(a.selection)));
  }
  visible(music.tracks).forEach(track => {
    const row = el('button', 'track-row'); row.type = 'button';
    row.dataset.trackTitle = track.title;
    row.dataset.embedSrc = safeUrl(track.embedSrc);
    row.dataset.appleUrl = safeUrl(track.appleUrl);
    row.setAttribute('aria-pressed', 'false');
    const label = el('span'); const indicator = el('i'); indicator.setAttribute('aria-hidden', 'true');
    label.append(indicator, el('b', '', track.title)); row.append(label, el('small', '', track.duration));
    register(track, 'music', row); q('[data-track-list]').append(row);
  });
  q('[data-cinema-intro]').textContent = data.cinema.intro || '';
  visible(data.cinema.items).forEach((item, index) => {
    const card = el('article', 'poster-card'); card.dataset.posterCard = ''; card.tabIndex = -1;
    const style = ['one', 'two', 'three', 'four'].includes(item.artStyle) ? item.artStyle : 'one';
    const art = el('div', `poster-art poster-art--${style}`);
    if (item.image) art.append(photo({ src: item.image, alt: item.alt || item.title }));
    else art.append(el('span', '', item.emptyLabel || item.title));
    const copy = el('div', 'poster-copy'); copy.append(el('h3', '', item.title), el('p', '', item.meta), el('small', '', item.note));
    card.append(art, copy); register(item, 'cinema', card, item.title, index); q('[data-poster-rail]').append(card);
  });
  q('[data-books-intro]').textContent = data.books.intro || '';
  q('[data-book-heading]').textContent = data.books.title || '';
  q('[data-book-description]').textContent = data.books.description || '';
  const books = visible(data.books.items);
  const pages = books.flatMap(book => book.pages.map((page, i) => ({ book, page, first: i === 0 })));
  pages.forEach(({ book, page, first }, index) => {
    const sheet = el('article', 'book-sheet'); sheet.dataset.bookSheet = '';
    sheet.style.setProperty('--sheet', String(pages.length - index));
    const front = el('div', 'book-page book-page--front');
    if (book.image && first) { front.classList.add('has-cover'); front.append(photo({ src: book.image, alt: book.alt || page.title }, 'book-cover')); }
    front.append(el('span', '', page.label), el('h4', '', page.title), el('p', '', page.text), el('small', '', page.footer));
    const back = el('div', 'book-page book-page--back'); back.setAttribute('aria-hidden', 'true');
    back.append(el('span', '', page.label), el('h4', '', page.title), el('p', '', page.text));
    sheet.append(front, back); if (first) register(book, 'reading', sheet, book.title || page.title, index);
    q('[data-book]').append(sheet);
  });
  visible(data.notes.items).forEach(item => {
    const article = el('article'); article.tabIndex = -1;
    const time = el('time', '', item.dateLabel); if (item.date) time.dateTime = item.date;
    const copy = el('div'); copy.append(el('h3', '', item.title), el('p', '', item.text));
    article.append(time, copy); register(item, 'notes', article); q('.notes-list').append(article);
  });
  const destinations = { music: '[data-track-list]', cinema: '[data-poster-rail]', books: '[data-book-description]', notes: '.notes-list', life: '.portrait-story' };
  for (const [name, selector] of Object.entries(destinations)) {
    if (data[name].error) {
      const message = el('p', 'content-message', '内容暂时没有抵达。');
      const retry = el('button', 'text-button', '重新载入'); retry.addEventListener('click', () => location.reload());
      message.append(retry); q(selector).replaceChildren(message);
    } else if (visible(data[name][name === 'music' ? 'tracks' : 'items']).length === 0) {
      q(selector).append(el('p', 'content-message', '这里先留一页空白。'));
    }
  }
  return { targets, books, pages };
}
