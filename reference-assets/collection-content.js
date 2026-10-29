// The collection JSON remains the source of truth for the visual index.
(async () => {
  try {
    const [music, cinema, books] = await Promise.all(
      ['music', 'cinema', 'books'].map(async name => {
        const response = await fetch(`/content/${name}.json`);
        if (!response.ok) throw new Error(`Unable to load ${name}`);
        return response.json();
      })
    );
    const visible = item => item.published !== false && item.placeholder !== true;
    const entries = [
      ...music.tracks.filter(visible).map(item => ({ title: `声场 · ${item.title}`, hash: `music-${item.id}` })),
      ...cinema.items.filter(visible).map(item => ({ title: `银幕 · ${item.title}`, hash: `cinema-${item.id}` })),
      ...books.items.filter(visible).map(item => ({ title: `书页 · ${item.title}`, hash: `reading-${item.id}` }))
    ];
    document.querySelectorAll('#work a-work').forEach((card, index) => {
      if (!entries.length) return;
      const entry = entries[index % entries.length];
      const link = card.querySelector('a');
      link.href = `/collection.html#${entry.hash}`;
      link.setAttribute('aria-label', `${entry.title}，进入完整收藏`);
      card.querySelector('.a__caption__text').textContent = entry.title;
    });
    const pictures = cinema.items.filter(visible).filter(item => item.image)
      .map(item => ({ src: item.image, alt: item.alt || item.title }));
    pictures.push({ src: '/assets/portrait/dostoevsky-800.webp', alt: '陀思妥耶夫斯基肖像' });
    if (music.tracks[0]?.cover?.src) pictures.push(music.tracks[0].cover);
    document.querySelectorAll('.s-my-way figure').forEach((frame, index) => {
      const item = pictures[index % pictures.length];
      const image = frame.querySelector('img');
      image.src = item.src;
      image.alt = item.alt || '';
      frame.querySelector('figcaption').textContent = item.alt || '';
    });
  } catch (error) {
    console.error('Collection index unavailable:', error);
  }
})();
