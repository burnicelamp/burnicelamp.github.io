import { loadContent, renderContent, q, el, safeUrl } from './content.js';
import { LyricsView, mediaClock } from './lyrics.js';
import { initPortrait } from './portrait.js';
import { initNavigation, initWander } from './navigation.js';
import { initInteractions } from '../script.js';

async function start() {
  const navigation = initNavigation();
  const data = await loadContent();
  const { targets, books, pages } = renderContent(data);
  const portrait = initPortrait(data.life, targets);
  const lyrics = new LyricsView(q('.lyrics-card'), data.lyrics);
  if (!q('.track-row')) {
    q('[data-apple-player]').hidden = true;
    lyrics.setTrack({ id: '', title: '留给声音' });
  }
  let media = null;
  const interactions = initInteractions({
    books,
    onTrack(id) {
      const track = data.music.tracks.find(item => item.id === id); if (!track) return;
      media?.pause(); media?.remove(); media = null;
      const iframe = q('[data-apple-player]');
      const src = track.audio?.publicPlayback === true && safeUrl(track.audio.src);
      iframe.hidden = Boolean(src);
      q('.source-note').textContent = src ? track.audio.attribution || '由创作者授权提供音频。' : '试听由 Apple Music 提供；本站不保存或分发音频文件。';
      if (src) {
        // First-party licensed audio is optional. Existing Apple embeds stay intact.
        iframe.removeAttribute('src');
        media = el('audio'); media.controls = true; media.preload = 'metadata'; media.src = src;
        media.setAttribute('aria-label', `${track.title} 播放器`); iframe.after(media);
      }
      lyrics.setTrack(track, media ? mediaClock(media, Number(track.audio.offsetSeconds) || 0) : null);
    },
    onBook(index) {
      const selected = pages[index];
      q('[data-book-heading]').textContent = selected && !selected.book.placeholder ? selected.page.title : data.books.title || '书页之间';
      q('[data-book-description]').textContent = selected && !selected.book.placeholder ? selected.page.text : data.books.description || '';
    }
  });
  initWander(targets, interactions, portrait, navigation);
  document.documentElement.dataset.contentReady = 'true';
}
start().catch(error => {
  console.error('Page initialization failed', error);
  document.documentElement.classList.remove('js');
  const message = el('p', 'content-message', '页面未能完整展开，请刷新重试。'); q('.page-shell').prepend(message);
});
