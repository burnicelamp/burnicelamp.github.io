async function loadFeatured() {
  const container = document.querySelector('[data-featured]');
  if (!container) return;
  try {
    const [music, cinema, books] = await Promise.all(['music','cinema','books'].map(async name => {
      const response = await fetch(`./content/${name}.json`);
      if (!response.ok) throw new Error(name);
      return response.json();
    }));
    const visible = item => item.published !== false && !item.placeholder;
    const track = music.tracks.find(visible), film = cinema.items.find(visible), book = books.items.find(visible);
    const items = [
      track && {title:track.title, category:'音乐', detail:track.artist, hash:`music-${track.id}`, img:track.cover?.src, alt:track.cover?.alt},
      film && {title:film.title, category:'影视', detail:film.originalTitle, hash:`cinema-${film.id}`, img:film.image, alt:film.alt},
      book && {title:book.title, category:'阅读', detail:book.author, hash:`reading-${book.id}`}
    ].filter(Boolean);
    for (const item of items) {
      const link=document.createElement('a'); link.className='featured-card'; link.href=`#${item.hash}`;
      const visual=document.createElement('div'); visual.className='featured-visual';
      if(item.img){const img=document.createElement('img');img.src=item.img;img.alt=item.alt||'';img.loading='lazy';visual.append(img)}
      else {const text=document.createElement('span');text.textContent=item.title;visual.append(text)}
      const info=document.createElement('div');info.className='featured-caption';
      for(const [tag,value] of [['small',item.category],['strong',item.title],['span',item.detail||'']]){const el=document.createElement(tag);el.textContent=value;info.append(el)}
      link.append(visual,info);container.append(link);
    }
  } catch { container.hidden=true; }
}
loadFeatured();
