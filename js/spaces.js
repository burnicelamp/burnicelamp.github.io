import {
  q,
  el,
  button,
  photo,
  visible,
  link,
  swipe,
  animate,
  reduced,
} from "./content.js";
import { search } from "./catalog.js";
export function initCinema(data, entries, detail) {
  const items = visible(data.items);
  let selection = 0,
    filtered = items,
    animationToken = 0;
  const stage = q("[data-film-stage]");
  function render() {
    stage.replaceChildren();
    const item = filtered[selection];
    q("[data-cinema-count]").textContent = filtered.length
      ? `${String(selection + 1).padStart(2, "0")} / ${String(filtered.length).padStart(2, "0")}`
      : "00 / 00";
    q("[data-cinema-prev]").disabled = selection <= 0;
    q("[data-cinema-next]").disabled = q("[data-next-frame]").disabled =
      selection >= filtered.length - 1;
    if (!item) {
      stage.append(el("div", "search-empty", "没有找到这部电影。"));
      q("[data-next-frame]").replaceChildren();
      return;
    }
    stage.dataset.contentId = item.id;
    const art = button("", () => detail("cinema", item.id), "film-art");
    art.setAttribute("aria-label", `展开 ${item.title}`);
    if (item.image)
      art.append(
        photo({ src: item.image, alt: item.alt || item.title, ...item.media }),
      );
    else art.append(el("div", "film-placeholder"));
    const copy = el("div", "film-copy");
    copy.append(
      el(
        "span",
        "eyebrow",
        item.placeholder
          ? "PRIVATE SCREENING · 待放映"
          : [item.year, item.director].filter(Boolean).join(" / "),
      ),
      el("h3", "", item.title),
      el("p", "", item.note || item.emptyLabel || ""),
      button("进入放映详情 ↗", () => detail("cinema", item.id)),
    );
    stage.append(art, copy);
    const next = filtered[selection + 1];
    q("[data-next-frame]").replaceChildren();
    if (next?.image)
      q("[data-next-frame]").append(
        photo({ src: next.image, alt: next.alt || next.title }),
      );
    if (next) q("[data-next-frame]").append(el("span", "", next.title));
  }
  async function show(i) {
    if (i < 0 || i >= filtered.length || i === selection) return;
    const direction = i > selection ? 1 : -1;
    const token = ++animationToken;
    stage.getAnimations().forEach((a) => a.cancel());
    await animate(
      stage,
      [
        { transform: "translateX(0) scale(1)", opacity: 1 },
        { transform: `translateX(${-direction * 8}%) scale(.97)`, opacity: 0 },
      ],
      { duration: 220 },
    );
    if (token !== animationToken) return;
    selection = i;
    render();
    animate(
      stage,
      [
        {
          transform: `translateX(${direction * 12}%) scale(1.06)`,
          opacity: 0.35,
        },
        { transform: "translateX(0) scale(1)", opacity: 1 },
      ],
      { duration: 650 },
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
    animationToken++;
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
      animationToken++;
      q("[data-cinema-search]").value = "";
      filtered = items;
      const i = items.findIndex((x) => x.id === id);
      if (i >= 0) {
        selection = i;
        render();
      }
      return q(".screening");
    },
  };
}
export function initBooks(data, entries, connections) {
  const books = visible(data.items);
  let items = books,
    current = 0,
    target = 0,
    flipping = false,
    mobileRight = false;
  const root = q("[data-book]");
  function paper(book, side, index) {
    const p = el("article", `paper paper-${side}`);
    const legacy = book.pages?.[side === "left" ? 0 : 1];
    p.append(
      el(
        "span",
        "eyebrow",
        side === "left" ? "BURNLAMP / READING NOTES" : "BETWEEN THE PAGES",
      ),
    );
    if (side === "left") {
      if (book.image)
        p.append(
          photo({ src: book.image, alt: book.alt || book.title }, "book-cover"),
        );
      else
        p.append(
          el("span", "blank-number", String(index + 1).padStart(2, "0")),
        );
      const h = el("h3");
      const url = Object.values(book.links || {}).find(Boolean);
      h.append(
        url ? link(book.title, url) : document.createTextNode(book.title),
      );
      p.append(
        h,
        el(
          "p",
          "book-meta",
          [book.author, book.publisher, book.year, book.readDate]
            .filter(Boolean)
            .join(" · "),
        ),
        el("small", "", book.status || legacy?.label || ""),
      );
    } else {
      p.append(
        el("div", "paper-ghost", book.title),
        el("h3", "", book.placeholder ? "这一页，\n先留白。" : book.title),
        el("p", "", book.summary || legacy?.text || ""),
        el("span", "review-label", book.review ? "页边一笔" : ""),
        el("p", "review", book.review || ""),
      );
      const url = Object.values(book.links || {}).find(Boolean);
      if (url) p.append(link("书籍详情 ↗", url));
      p.append(
        el("small", "", book.placeholder ? "等待真实内容" : book.status || ""),
      );
    }
    return p;
  }
  function render() {
    const b = items[current];
    root.replaceChildren();
    root.classList.toggle("show-right", mobileRight);
    q("[data-book-side]").textContent = mobileRight
      ? "← 回到左页"
      : "翻看右页 →";
    q("[data-book-count]").textContent = items.length
      ? `${String(current + 1).padStart(2, "0")} / ${String(items.length).padStart(2, "0")}`
      : "00 / 00";
    q("[data-book-status]").textContent = b?.status || "";
    q("[data-book-prev]").disabled = current <= 0;
    q("[data-book-next]").disabled = current >= items.length - 1;
    q("[data-book-side]").disabled = !b;
    if (!b) {
      root.append(el("div", "paper", "没有找到这本书。"));
      q("[data-book-relations]").replaceChildren();
      return;
    }
    root.dataset.contentId = b.id;
    root.append(paper(b, "left", current), paper(b, "right", current));
    connections(q("[data-book-relations]"), "books:" + b.id);
  }
  async function move() {
    if (flipping) return;
    flipping = true;
    try {
      while (current !== target) {
        const direction = Math.sign(target - current);
        const distance = Math.abs(target - current);
        if (reduced()) {
          current = target;
          render();
          break;
        }
        const leaf = el("div", "page-turn");
        leaf.setAttribute("aria-hidden", "true");
        root.append(leaf);
        const small = matchMedia("(max-width:700px)").matches;
        const duration = distance > 1 ? Math.max(100, 320 / distance) : 760;
        const anim = leaf.animate(
          direction > 0
            ? [
                { transform: "rotateY(0deg)", opacity: 1 },
                { transform: "rotateY(-80deg)", offset: 0.5, opacity: 1 },
                { transform: `rotateY(${small ? -160 : -179}deg)`, opacity: 0 },
              ]
            : [
                { transform: `rotateY(${small ? -160 : -179}deg)`, opacity: 0 },
                { transform: "rotateY(-85deg)", offset: 0.5, opacity: 1 },
                { transform: "rotateY(0deg)", opacity: 1 },
              ],
          { duration, easing: "cubic-bezier(.32,.03,.25,1)" },
        );
        try {
          await anim.finished;
        } catch {}
        leaf.remove();
        current += direction;
        mobileRight = false;
        render();
      }
    } finally {
      flipping = false;
    }
  }
  function go(i) {
    target = Math.max(0, Math.min(items.length - 1, i));
    if (items.length) move();
  }
  q("[data-book-prev]").addEventListener("click", () => go(target - 1));
  q("[data-book-next]").addEventListener("click", () => go(target + 1));
  q("[data-book-side]").addEventListener("click", () => {
    mobileRight = !mobileRight;
    render();
    animate(
      root,
      [
        { opacity: 0.55, transform: "rotateY(-4deg)" },
        { opacity: 1, transform: "rotateY(0deg)" },
      ],
      { duration: 500 },
    );
  });
  q(".book-scene").addEventListener("keydown", (e) => {
    if (e.target.closest("input,a")) return;
    if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
      e.preventDefault();
      go(target + (e.key === "ArrowRight" ? 1 : -1));
    }
  });
  swipe(q(".book-scene"), (d) => {
    if (
      matchMedia("(max-width:700px)").matches &&
      ((d === 1 && !mobileRight) || (d === -1 && mobileRight))
    ) {
      mobileRight = !mobileRight;
      render();
    } else go(target + d);
  });
  const authors = [
    ...new Set(
      books
        .filter((b) => !b.placeholder)
        .map((b) => b.author)
        .filter(Boolean),
    ),
  ];
  authors.forEach((author) =>
    q("[data-authors]").append(
      button(author, () => {
        q("[data-books-search]").value = "";
        items = books;
        go(books.findIndex((b) => b.author === author));
      }),
    ),
  );
  q("[data-books-search]").addEventListener("input", async () => {
    const query = q("[data-books-search]").value;
    const ids = new Set(
      search(
        entries.filter((e) => e.kind === "books"),
        query,
      ).map((e) => e.id),
    );
    target = current;
    while (flipping) await new Promise((resolve) => setTimeout(resolve, 30));
    items = query.trim() ? books.filter((b) => ids.has(b.id)) : books;
    current = target = 0;
    mobileRight = false;
    render();
  });
  render();
  return {
    open(id) {
      q("[data-books-search]").value = "";
      items = books;
      go(books.findIndex((b) => b.id === id));
      return q(".book-scene");
    },
  };
}
