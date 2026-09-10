import { el, q, qa, photo, visible, real, safeUrl } from './content.js';

export function initPortrait(data, targets) {
  q('[data-life-intro]').textContent = data.intro || '';
  const items = visible(data.items); if (!items.length) return { show() {} };
  const stage = q('[data-life-media]'), story = q('#portrait-story'), tabs = q('[data-life-tabs]');
  let current = 0;
  function show(index, focus = false) {
    current = (index + items.length) % items.length;
    const item = items[current];
    qa('button', tabs).forEach((tab, i) => { tab.setAttribute('aria-selected', String(i === current)); tab.tabIndex = i === current ? 0 : -1; });
    story.setAttribute('aria-labelledby', `portrait-tab-${item.id}`);
    story.dataset.contentId = item.id; story.dataset.placeholder = String(!real(item));
    const mark = el('p', 'portrait-eyebrow', item.eyebrow);
    const title = el('h3', '', item.title);
    const text = el('p', 'portrait-text', item.text);
    story.replaceChildren(mark, title, text);
    if (item.detail) story.append(el('p', 'portrait-detail', item.detail));
    const url = safeUrl(item.link?.href);
    if (url) { const link = el('a', 'portrait-link', item.link.label || '展开看看 ↗'); link.href = url; story.append(link); }
    stage.replaceChildren();
    const photos = item.photos || [];
    if (photos.length) {
      const frame = el('figure', 'portrait-frame');
      const caption = el('figcaption');
      const controls = el('div', 'portrait-photo-controls'); controls.setAttribute('aria-label', '切换照片');
      const selectPhoto = i => {
        frame.replaceChildren(photo(photos[i]), caption); caption.textContent = photos[i].caption || photos[i].alt || '';
        qa('button', controls).forEach((button, j) => button.setAttribute('aria-pressed', String(i === j)));
      };
      if (photos.length > 1) photos.forEach((image, i) => {
        const button = el('button', '', String(i + 1).padStart(2, '0')); button.type = 'button';
        button.setAttribute('aria-label', `照片 ${i + 1}：${image.alt || ''}`);
        button.addEventListener('click', () => selectPhoto(i)); controls.append(button);
      });
      selectPhoto(0); stage.append(frame, controls);
    } else {
      const blank = el('div', 'portrait-blank');
      const symbol = el('span', 'portrait-glyph', item.glyph || '◎'); symbol.setAttribute('aria-hidden', 'true');
      blank.append(el('span', 'portrait-blank-label', item.visualLabel || '一处留白'), symbol, el('span', 'portrait-blank-caption', item.visualCaption || '画面不必急着填满'));
      stage.append(blank);
    }
    q('[data-life-count]').textContent = `${String(current + 1).padStart(2, '0')} / ${String(items.length).padStart(2, '0')}`;
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      for (const node of [stage, story]) { node.getAnimations().forEach(animation => animation.cancel()); node.animate([{ opacity: 0.25, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 460, easing: 'cubic-bezier(.22,1,.36,1)' }); }
    }
    if (focus) qa('button', tabs)[current].focus();
  }
  items.forEach((item, index) => {
    const button = el('button', 'portrait-tab'); button.type = 'button'; button.id = `portrait-tab-${item.id}`;
    button.setAttribute('role', 'tab'); button.setAttribute('aria-controls', 'portrait-story');
    button.append(el('span', '', String(index + 1).padStart(2, '0')), el('span', '', item.label));
    button.addEventListener('click', () => show(index));
    button.addEventListener('keydown', event => {
      if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      show(event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : current + (event.key === 'ArrowRight' ? 1 : -1), true);
    });
    tabs.append(button);
    if (real(item)) targets.push({ id: `life-${item.id}`, item, section: 'life', node: story, title: item.title, index });
  });
  q('[data-life-next]').addEventListener('click', () => show(current + 1));
  let start = null;
  stage.addEventListener('touchstart', event => { const p = event.touches[0]; start = { x: p.clientX, y: p.clientY }; }, { passive: true });
  stage.addEventListener('touchend', event => {
    if (!start) return;
    const dx = event.changedTouches[0].clientX - start.x, dy = event.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) show(current + (dx < 0 ? 1 : -1));
    start = null;
  }, { passive: true });
  show(0);
  return { show };
}
