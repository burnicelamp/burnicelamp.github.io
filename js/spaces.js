import {
  q,
  el,
  button,
  photo,
  real,
  link,
  swipe,
  animate,
  reduced,
} from "./content.js";
import { search } from "./catalog.js";
import { remember, saved, share } from "./journey.js";
function picker(host, label, onchange) {
  const s = el("select", "collection-picker");
  s.setAttribute("aria-label", label);
  s.addEventListener("change", () => onchange(Number(s.value)));
  host.append(s);
  return s;
}
function options(select, items, index) {
  select.replaceChildren(
    ...items.map((x, i) => {
      const o = el(
        "option",
        "",
        String(i + 1).padStart(2, "0") + " · " + x.title,
      );
      o.value = i;
      return o;
    }),
  );
  select.value = index;
  select.hidden = items.length < 2;
}
export function initCinema(data, entries, detail) {
  const items = (data.items || []).filter(real);
  let filtered = items,
    selection = Math.max(
      0,
      items.findIndex((x) => x.id === saved().cinema),
    );
  const stage = q("[data-film-stage]"),
    section = q("#cinema");
  const select = picker(q("#cinema .space-toolbar"), "快速定位电影", show);
  section.classList.toggle("is-empty", !items.length);
  function render() {
    stage.replaceChildren();
    delete stage.dataset.contentId;
    const item = filtered[selection];
    q("[data-cinema-count]").textContent = filtered.length
      ? selection + 1 + " / " + filtered.length
      : "";
    q("[data-cinema-prev]").disabled = selection <= 0;
    q("[data-cinema-next]").disabled = selection >= filtered.length - 1;
    q("[data-next-frame]").hidden = !filtered[selection + 1];
    q("[data-next-frame]").replaceChildren();
    options(select, filtered, selection);
    if (!item) {
      const empty = el("div", "screening-empty");
      empty.append(
        el("span", "screening-light"),
        el("h3", "", items.length ? "没有找到这部电影" : "等待第一场放映"),
        el(
          "p",
          "",
          items.length
            ? "换个片名、导演，或清除搜索。"
            : "灯光已暗下，银幕暂时留白。",
        ),
      );
      if (items.length)
        empty.append(
          button("显示全部片目", () => {
            q("[data-cinema-search]").value = "";
            filtered = items;
            selection = 0;
            render();
          }),
        );
      stage.append(empty);
      return;
    }
    stage.dataset.contentId = item.id;
    remember("cinema", item.id);
    const art = button("", () => detail("cinema", item.id), "film-art");
    art.setAttribute("aria-label", "展开 " + item.title);
    if (item.image) {
      art.append(
        photo({ src: item.image, alt: item.alt || item.title, ...item.media }),
      );
      const portrait = (item.media?.width || 0) < (item.media?.height || 0);
      art.classList.toggle("is-poster", portrait);
    } else art.append(el("div", "film-placeholder"));
    const copy = el("div", "film-copy");
    copy.append(
      el(
        "span",
        "film-meta",
        [item.year, item.director].filter(Boolean).join(" / "),
      ),
      el("h3", "", item.title),
      el("p", "", item.note || ""),
      button("展开这部电影", () => detail("cinema", item.id)),
      share("cinema", item.id),
    );
    stage.append(art, copy);
    const next = filtered[selection + 1];
    if (next) {
      if (next.image)
        q("[data-next-frame]").append(
          photo({ src: next.image, alt: next.alt || next.title }),
        );
      q("[data-next-frame]").append(el("span", "", "下一部 · " + next.title));
    }
  }
  function show(i) {
    if (i < 0 || i >= filtered.length || i === selection) return;
    const direction = i > selection ? 1 : -1;
    selection = i;
    stage.getAnimations().forEach((a) => a.cancel());
    render();
    animate(
      stage,
      [
        { opacity: 0.35, transform: "translateX(" + direction * 4 + "%)" },
        { opacity: 1, transform: "translateX(0)" },
      ],
      { duration: 380 },
    );
  }
  const step = (d) => show(selection + d);
  q("[data-cinema-prev]").addEventListener("click", () => step(-1));
  q("[data-cinema-next]").addEventListener("click", () => step(1));
  q("[data-next-frame]").addEventListener("click", () => step(1));
  q(".screening").addEventListener("keydown", (e) => {
    if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
      e.preventDefault();
      step(e.key === "ArrowRight" ? 1 : -1);
    }
  });
  swipe(q(".screening"), step);
  q("[data-cinema-search]").addEventListener("input", () => {
    const query = q("[data-cinema-search]").value;
    const ids = new Set(
      search(
        entries.filter((e) => e.kind === "cinema"),
        query,
      ).map((e) => e.id),
    );
    filtered = query.trim() ? items.filter((i) => ids.has(i.id)) : items;
    selection = 0;
    render();
  });
  render();
  return {
    open(id) {
      q("[data-cinema-search]").value = "";
      filtered = items;
      selection = Math.max(
        0,
        items.findIndex((i) => i.id === id),
      );
      render();
      return q(".screening");
    },
  };
}
// Paragraph-aware sheets keep long notes inside a bounded, readable book.
function sheets(text) {
  const result = [];
  let chunk = "";
  for (const paragraph of String(text || "").split(/\n/)) {
    for (let at = 0; at < paragraph.length || at === 0; at += 540) {
      const part = paragraph.slice(at, at + 540);
      if (chunk.length + part.length > 620) {
        result.push(chunk);
        chunk = "";
      }
      chunk += (chunk ? "\n\n" : "") + part;
    }
  }
  if (chunk) result.push(chunk);
  return result.length ? result : [""];
}
export function initBooks(data, entries, connections) {
  const books = (data.items || []).filter(real);
  let items = books,
    current = Math.max(
      0,
      books.findIndex((x) => x.id === saved().books),
    ),
    page = 0;
  const root = q("[data-book]"),
    section = q("#reading");
  section.classList.toggle("is-empty", !books.length);
  const select = picker(q("#reading .space-toolbar"), "快速定位书籍", go);
  q("[data-book-side]").hidden = true;
  function render() {
    root.replaceChildren();
    delete root.dataset.contentId;
    options(select, items, current);
    const b = items[current];
    q("[data-book-count]").textContent = items.length
      ? current + 1 + " / " + items.length + " 本"
      : "";
    q("[data-book-prev]").disabled = current <= 0;
    q("[data-book-next]").disabled = current >= items.length - 1;
    q("[data-book-status]").textContent = b?.status || "";
    if (!b) {
      const left = el("article", "paper paper-left");
      left.append(
        el("span", "book-stamp", "书页"),
        el("h3", "", books.length ? "没有找到这本书" : "还未落笔"),
        el("p", "", "在别人的句子里，停留片刻。"),
      );
      const right = el("article", "paper paper-right");
      right.append(
        el("span", "book-stamp", "页边留白"),
        el("h3", "", books.length ? "换个词，再找找。" : "留给下一次阅读。"),
      );
      if (books.length)
        right.append(
          button("显示全部书目", () => {
            q("[data-books-search]").value = "";
            items = books;
            current = page = 0;
            render();
          }),
        );
      root.append(left, right);
      q("[data-book-relations]").replaceChildren();
      return;
    }
    root.dataset.contentId = b.id;
    remember("books", b.id);
    const left = el("article", "paper paper-left");
    left.append(el("span", "book-stamp", "阅读札记"));
    if (b.image)
      left.append(photo({ src: b.image, alt: b.alt || b.title }, "book-cover"));
    else left.append(el("div", "book-monogram", b.title.slice(0, 1)));
    left.append(
      el("h3", "", b.title),
      el(
        "p",
        "book-meta",
        [b.author, b.publisher, b.year].filter(Boolean).join(" · "),
      ),
    );
    const short = el(
      "p",
      "book-core",
      (b.review || b.summary || "").slice(0, 100),
    );
    left.append(short);
    const right = el("article", "paper paper-right");
    right.append(
      el("span", "book-stamp", page ? "续页" : "页边一笔"),
      el("h3", "", b.title),
      el("p", "book-meta", b.author || ""),
    );
    const pages = sheets([b.review, b.summary].filter(Boolean).join("\n\n"));
    page = Math.min(page, pages.length - 1);
    right.append(el("p", "review", pages[page]));
    const controls = el("div", "paper-pagination");
    const prev = button("← 上一页", () => turn(page - 1));
    prev.disabled = page === 0;
    const next = button("下一页 →", () => turn(page + 1));
    next.disabled = page === pages.length - 1;
    controls.append(
      prev,
      el("span", "", page + 1 + " / " + pages.length + " 页"),
      next,
    );
    if (pages.length > 1) right.append(controls);
    const actions = el("div", "paper-actions");
    const url = Object.values(b.links || {}).find(Boolean);
    if (url) actions.append(link("书籍资料 ↗", url));
    actions.append(share("books", b.id));
    right.append(actions);
    root.append(left, right);
    q("[data-authors]")
      .querySelectorAll("button")
      .forEach((n) =>
        n.setAttribute("aria-pressed", String(n.textContent === b.author)),
      );
    const selectedAuthor = q('[data-authors] [aria-pressed="true"]');
    if (selectedAuthor) {
      const rail = q("[data-authors]");
      if (
        selectedAuthor.offsetLeft < rail.scrollLeft ||
        selectedAuthor.offsetLeft + selectedAuthor.offsetWidth >
          rail.scrollLeft + rail.clientWidth
      )
        rail.scrollLeft = selectedAuthor.offsetLeft - 24;
    }
    connections(q("[data-book-relations]"), "books:" + b.id);
  }
  function turn(i) {
    const b = items[current];
    if (!b) return;
    const length = sheets(
      [b.review, b.summary].filter(Boolean).join("\n\n"),
    ).length;
    if (i < 0 || i >= length) return;
    page = i;
    render();
    animate(q(".paper-right"), [{ opacity: 0.4 }, { opacity: 1 }], {
      duration: 240,
    });
  }
  function go(i) {
    if (i < 0 || i >= items.length || i === current) return;
    const direction = i > current ? 1 : -1;
    current = i;
    page = 0;
    root.getAnimations().forEach((a) => a.cancel());
    render();
    if (!reduced()) {
      const leaf = el("div", "page-turn");
      leaf.setAttribute("aria-hidden", "true");
      root.append(leaf);
      animate(
        leaf,
        [
          {
            transform: "rotateY(" + (direction > 0 ? 0 : -170) + "deg)",
            opacity: 0.9,
          },
          {
            transform: "rotateY(" + (direction > 0 ? -170 : 0) + "deg)",
            opacity: 0,
          },
        ],
        { duration: 420 },
      ).then(() => leaf.remove());
    }
  }
  q("[data-book-prev]").addEventListener("click", () => go(current - 1));
  q("[data-book-next]").addEventListener("click", () => go(current + 1));
  q(".book-scene").addEventListener("keydown", (e) => {
    if (e.target.closest("input,a,button,select")) return;
    if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
      e.preventDefault();
      go(current + (e.key === "ArrowRight" ? 1 : -1));
    }
  });
  swipe(q(".book-scene"), (d) => turn(page + d));
  const authors = [...new Set(books.map((b) => b.author).filter(Boolean))];
  for (const author of authors)
    q("[data-authors]").append(
      button(author, () => {
        items = books;
        q("[data-books-search]").value = "";
        const i = books.findIndex((b) => b.author === author);
        if (i === current) render();
        else go(i);
      }),
    );
  q("[data-books-search]").addEventListener("input", () => {
    const query = q("[data-books-search]").value;
    const ids = new Set(
      search(
        entries.filter((e) => e.kind === "books"),
        query,
      ).map((e) => e.id),
    );
    items = query.trim() ? books.filter((b) => ids.has(b.id)) : books;
    current = page = 0;
    render();
  });
  render();
  return {
    open(id) {
      q("[data-books-search]").value = "";
      items = books;
      current = Math.max(
        0,
        books.findIndex((x) => x.id === id),
      );
      page = 0;
      render();
      return q(".book-scene");
    },
  };
}
