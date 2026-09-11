import { remember, share, showLayer, hrefFor, leaveLayer } from "./journey.js";
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
        const d = q("dialog[open]");
        if (d) leaveLayer(d, () => go(e));
        else go(e);
      });
      b.append(
        el("small", "", kinds[e.kind]),
        document.createTextNode(e.title),
      );
      if (e.reason) b.append(el("span", "reason", e.reason));
      root.append(b);
    }
  }
  function open(kind, id) {
    const item = data[kind]?.[kind === "music" ? "tracks" : "items"]?.find(
      (x) => x.id === id && x.published !== false,
    );
    if (!item || !real(item)) return;
    remember(kind, id);
    const d = q(".detail-dialog"),
      host = q("[data-detail-content]");
    host.replaceChildren();

    host.append(el("p", "eyebrow", kinds[kind]));
    const title = el("h2", "", item.title);
    title.id = "detail-title";
    host.append(
      title,
      el("p", "detail-note", item.text || item.note || item.summary || ""),
      el(
        "p",
        "detail-meta",
        [item.year, item.director, item.author, item.dateLabel]
          .filter(Boolean)
          .join(" · "),
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
    host.append(share(kind, id));
    if (item.image)
      host.append(photo({ src: item.image, alt: item.alt || item.title }));
    const r = el("div", "connections");
    connections(r, kind + ":" + id);
    host.append(r);
    showLayer(d, hrefFor(kind, id) + "&view=detail");
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
  visible(data.items)
    .filter(real)
    .forEach((item) => {
      const a = el("article");
      a.id = "notes-" + item.id;
      a.tabIndex = -1;
      a.dataset.contentId = item.id;
      const date = el("time", "", item.dateLabel);
      if (item.date) date.dateTime = item.date;
      a.append(
        date,
        el("h3", "", item.title),
        el(
          "p",
          "",
          item.text?.length > 360 ? item.text.slice(0, 320) + "…" : item.text,
        ),
      );
      if ((item.text || "").length > 360)
        a.append(button("继续阅读", () => detail("notes", item.id)));
      a.append(share("notes", item.id));
      const c = el("div", "connections");
      connections(c, "notes:" + item.id);
      a.append(c);
      root.append(a);
    });
  const realNotes = (data.items || []).filter(real);
  if (realNotes.length >= 8) {
    const toolbar = el("div", "notes-filter");
    const input = el("input");
    input.type = "search";
    input.placeholder = "找一条记录";
    input.setAttribute("aria-label", "搜索记录");
    const years = el("select");
    years.setAttribute("aria-label", "按年份浏览记录");
    years.append(el("option", "", "全部年份"));
    for (const year of [
      ...new Set(realNotes.map((x) => x.date?.slice(0, 4)).filter(Boolean)),
    ]
      .sort()
      .reverse()) {
      const o = el("option", "", year);
      o.value = year;
      years.append(o);
    }
    const count = el("span");
    count.setAttribute("role", "status");
    const filter = () => {
      let visible = 0;
      for (const item of realNotes) {
        const article = document.getElementById("notes-" + item.id);
        article.hidden =
          !(item.title + " " + item.text)
            .toLocaleLowerCase()
            .includes(input.value.trim().toLocaleLowerCase()) ||
          (years.selectedIndex > 0 && !item.date?.startsWith(years.value));
        if (!article.hidden) visible++;
      }
      count.textContent = visible + " 条记录";
    };
    input.addEventListener("input", filter);
    years.addEventListener("change", filter);
    toolbar.append(input, years, count);
    root.before(toolbar);
    filter();
  }
  if (!root.children.length)
    root.append(el("p", "muted", "有事情发生时，再写下来。"));
  return {
    open(id) {
      const n = document.getElementById("notes-" + id);
      if (n) {
        n.hidden = false;
        remember("notes", id);
      }
      return n;
    },
  };
}
