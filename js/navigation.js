import { q, qa } from './content.js';

export function initNavigation() {
  const header = q('[data-site-header]'), toggle = q('.nav-toggle'), menu = q('#mobile-nav');
  function close(restoreFocus = false) {
    toggle.setAttribute('aria-expanded', 'false'); menu.inert = true; header.classList.remove('nav-open');
    if (restoreFocus) toggle.focus({ preventScroll: true });
  }
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open)); menu.inert = !open; header.classList.toggle('nav-open', open);
  });
  menu.addEventListener('click', event => { if (event.target.closest('a')) close(true); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') close(header.classList.contains('nav-open')); });
  document.addEventListener('pointerdown', event => { if (!header.contains(event.target)) close(); });
  header.addEventListener('focusout', event => { if (!header.contains(event.relatedTarget)) close(); });
  const sections = qa('main > section[id], .page-shell > section[id]');
  const labels = { top: '首页', life: '肖像', music: '音乐', cinema: '影像', reading: '阅读', notes: '记录' };
  let frame = 0;
  function update() {
    frame = 0;
    const section = sections.filter(node => node.getBoundingClientRect().top <= Math.min(innerHeight * 0.35, 220)).at(-1) || sections[0];
    q('[data-current-section]').textContent = labels[section.id];
    qa('.site-nav a, .mobile-nav a').forEach(a => { if (a.hash === `#${section.id}`) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
  }
  window.addEventListener('scroll', () => { if (!frame) frame = requestAnimationFrame(update); }, { passive: true });
  window.addEventListener('resize', () => { if (innerWidth > 980) close(); update(); }, { passive: true });
  update(); return { close };
}

export function initWander(targets, interactions, portrait, navigation) {
  const button = q('[data-wander]'), feedback = q('[data-wander-feedback]');
  let previous = '', feedbackTimer = 0, landingTimer = 0, landing = null, highlighted = null;
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  function finish() {
    if (!landing) return;
    clearTimeout(landingTimer);
    const target = landing; landing = null;
    target.node.classList.add('wander-arrival'); highlighted = target.node;
    const focus = target.section === 'reading' ? q('[data-book-scene]') : target.node;
    if (!focus.hasAttribute('tabindex') && focus.tagName !== 'BUTTON') focus.tabIndex = -1;
    focus.focus({ preventScroll: true });
    feedback.textContent = `遇见 · ${target.title}`; feedback.classList.add('is-visible');
    feedbackTimer = setTimeout(() => { feedback.classList.remove('is-visible'); target.node.classList.remove('wander-arrival'); }, 3200);
    button.disabled = targets.length === 0;
  }
  function go(target) {
    clearTimeout(feedbackTimer); clearTimeout(landingTimer); highlighted?.classList.remove('wander-arrival');
    navigation.close();
    if (target.section === 'music') interactions.chooseTrack(target.node);
    if (target.section === 'reading') interactions.showBook(target.index);
    if (target.section === 'life') portrait.show(target.index);
    if (target.section === 'cinema') {
      const rail = q('[data-poster-rail]');
      rail.scrollTo({ left: target.node.offsetLeft - rail.offsetLeft, behavior: reduced() ? 'instant' : 'smooth' });
    }
    const container = target.section === 'life' ? q('[data-portrait]') : target.section === 'reading' ? q('.reading-layout') : target.node;
    // Reveal before positioning so transforms cannot shift the final destination.
    container.closest('.reveal')?.classList.add('is-visible');
    const top = scrollY + container.getBoundingClientRect().top - q('[data-site-header]').offsetHeight - 28;
    landing = target; button.disabled = true;
    window.scrollTo({ top: Math.max(0, top), behavior: reduced() ? 'instant' : 'smooth' });
    history.replaceState(null, '', `#${target.id}`);
    if (reduced() || Math.abs(scrollY - Math.max(0, top)) < 2) finish();
    else landingTimer = setTimeout(finish, 1600);
  }
  // If a visitor starts scrolling, let them take over without a later focus jump.
  const cancel = () => { clearTimeout(landingTimer); landing = null; button.disabled = !targets.length; };
  window.addEventListener('wheel', cancel, { passive: true });
  window.addEventListener('touchstart', cancel, { passive: true });
  window.addEventListener('keydown', event => { if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(event.key)) cancel(); });
  window.addEventListener('scrollend', finish);
  button.disabled = targets.length === 0;
  button.addEventListener('click', () => {
    const options = targets.filter(target => targets.length === 1 || target.id !== previous);
    if (!options.length) return;
    const random = new Uint32Array(1); crypto.getRandomValues(random);
    const target = options[Math.floor(random[0] / 4294967296 * options.length)]; previous = target.id; go(target);
  });
  const openHash = () => { const target = targets.find(item => `#${item.id}` === location.hash); if (target) go(target); };
  window.addEventListener('hashchange', openHash);
  if (location.hash) requestAnimationFrame(() => {
    const target = targets.find(item => `#${item.id}` === location.hash);
    if (target) go(target);
    else document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView({ behavior: 'instant' });
  });
}
