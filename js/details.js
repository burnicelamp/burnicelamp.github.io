import { q, qa, el, button, photo, link, visible, real } from "./content.js";
import { kinds, related } from "./catalog.js";
export function initDetails(data, entries, go) {
  function connections(root, key, options = {}) {
    root.replaceChildren();
    const hits = related(entries, data.relations, key, {
      limit: data.relations.maxItems || 3,
      ...options,
    });
    if (!hits.length) return;
    root.append(el("p", "", options.title || "同一页世界里"));
    for (const e of hits) {
      const b = button("", () => {
        for (const d of qa("dialog[open]")) d.close();
        go(e);
      });
      b.append(
        el("small", "", kinds[e.kind]),
        document.createTextNode(e.title),
      );
      if (options.kind) b.append(el("span", "reason", e.reason));
      root.append(b);
    }
  }
  function open(kind, id) {
    const item = data[kind]?.[kind === "music" ? "tracks" : "items"]?.find(
      (x) => x.id === id && x.published !== false,
    );
    if (!item) return;
    const d = q(".detail-dialog"),
      host = q("[data-detail-content]");
    host.replaceChildren();
    if (item.image)
      host.append(photo({ src: item.image, alt: item.alt || item.title }));
    host.append(el("p", "eyebrow", kinds[kind]));
    const title = el("h2", "", item.title);
    title.id = "detail-title";
    host.append(
      title,
      el(
        "p",
        "",
        [item.year, item.director, item.author, item.dateLabel]
          .filter(Boolean)
          .join(" · "),
      ),
      el(
        "p",
        "",
        item.text ||
          item.note ||
          item.summary ||
          (item.placeholder ? "这里等待一份真实收藏。" : ""),
      ),
    );
    if (item.rating != null) host.append(el("p", "", `评分 ${item.rating}`));
    if (typeof item.rewatch === "boolean")
      host.append(el("p", "", item.rewatch ? "愿意重看" : "暂不重看"));
    const links = el("div", "detail-links");
    for (const [key, label] of Object.entries({
      douban: "豆瓣 ↗",
      imdb: "IMDb ↗",
      publisher: "出版社 ↗",
      googleBooks: "Google Books ↗",
    }))
      if (item.links?.[key]) links.append(link(label, item.links[key]));
    host.append(links);
    const r = el("div", "connections");
    connections(r, kind + ":" + id);
    host.append(r);
    if (!d.open) d.showModal();
  }
  q("[data-detail-close]").addEventListener("click", () =>
    q(".detail-dialog").close(),
  );
  q(".detail-dialog").addEventListener("click", (e) => {
    if (e.target !== e.currentTarget) return;
    const r = e.currentTarget.getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      e.currentTarget.close();
  });
  return { open, connections };
}
export function renderNotes(data, detail, connections) {
  const root = q("[data-notes]");
  visible(data.items).forEach((item) => {
    const a = el("article");
    a.id = "notes-" + item.id;
    a.tabIndex = -1;
    a.dataset.contentId = item.id;
    const date = el("time", "", item.dateLabel);
    if (item.date) date.dateTime = item.date;
    a.append(date, el("h3", "", item.title), el("p", "", item.text));
    if (real(item))
      a.append(button("展开这条记录 ↗", () => detail("notes", item.id)));
    const c = el("div", "connections");
    connections(c, "notes:" + item.id);
    a.append(c);
    root.append(a);
  });
  if (!root.children.length)
    root.append(el("p", "muted", "有事情发生时，再写下来。"));
  return {
    open(id) {
      return document.getElementById("notes-" + id);
    },
  };
}
