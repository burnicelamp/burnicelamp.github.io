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
  safeUrl,
} from "./content.js";
import { search } from "./catalog.js";
import {
  remember,
  saved,
  share,
  showLayer,
  leaveLayer,
  hrefFor,
} from "./journey.js";

const pad = (value) => String(value).padStart(2, "0");

function updateContentHash(kind, id) {
  const hash = hrefFor(kind, id);
  if (location.hash.split("&")[0] !== hash) history.pushState(null, "", hash);
}

function catalogMatches(entries, kind, query) {
  if (!query.trim()) return null;
  return new Set(
    search(
      entries.filter((entry) => entry.kind === kind),
      query,
    ).map((entry) => entry.id),
  );
}

function imageFor(frame) {
  const image = el("img", "cinema-image");
  image.alt = frame.alt || "";
  image.decoding = "async";
  image.loading = "eager";
  if (frame.width && frame.height) {
    image.width = frame.width;
    image.height = frame.height;
  }
  const src = safeUrl(frame.src || frame.image);
  if (!src) return Promise.reject(new Error("invalid image source"));
  image.src = src;
  return new Promise((resolve, reject) => {
    const ready = async () => {
      try {
        await image.decode();
      } catch {
        if (!image.naturalWidth) return reject(new Error("image decode failed"));
      }
      resolve(image);
    };
    if (image.complete) {
      if (image.naturalWidth) ready();
      else reject(new Error("image unavailable"));
      return;
    }
    image.addEventListener("load", ready, { once: true });
    image.addEventListener("error", () => reject(new Error("image unavailable")), {
      once: true,
    });
  });
}

export function initCinema(data, entries, detail) {
  const items = (data.items || []).filter(real);
  const section = q("#cinema");
  const screening = q("#cinema .cinema-stage");
  const visual = q("[data-film-frame]");
  const info = q("[data-film-info]");
  const dialog = q("#cinema-catalog");
  const query = q("[data-cinema-search]");
  const list = q("[data-cinema-catalog-list]");
  const empty = q("[data-cinema-empty]");
  let selection = Math.max(
    0,
    items.findIndex((item) => item.id === saved().cinema),
  );
  let frameIndex = 0;
  let operation = 0;
  let failedAction = null;
  const preloaded = new Set();

  section.classList.toggle("is-empty", !items.length);

  function framesFor(item) {
    if (item?.gallery?.length) return item.gallery;
    if (item?.image)
      return [
        {
          src: item.image,
          alt: item.alt || item.title,
          width: item.media?.width,
          height: item.media?.height,
        },
      ];
    return [];
  }

  function setStatus(message = "", retry) {
    const host = q("[data-cinema-status]");
    host.replaceChildren();
    host.hidden = !message;
    failedAction = retry || null;
    if (!message) return;
    host.append(document.createTextNode(message));
    if (retry) host.append(button("重新加载", () => failedAction?.()));
  }

  function preload(frame) {
    const src = safeUrl(frame?.src || frame?.image);
    if (!src || preloaded.has(src)) return;
    preloaded.add(src);
    const image = new Image();
    image.decoding = "async";
    image.src = src;
  }

  function preloadNeighbors() {
    const frames = framesFor(items[selection]);
    preload(frames[frameIndex - 1]);
    preload(frames[frameIndex + 1]);
    preload(framesFor(items[selection + 1])[0]);
  }

  function restoreCurrentFrame() {
    visual.querySelectorAll(".cinema-image").forEach((node) => {
      node.getAnimations().forEach((animation) => animation.cancel());
      if (!node.classList.contains("is-current")) node.remove();
    });
  }

  async function crossfade(image, token) {
    if (token !== operation) return false;
    const previous = visual.querySelector(".cinema-image.is-current");
    image.classList.add("is-entering");
    visual.append(image);
    if (reduced() || !previous) {
      if (token !== operation) {
        image.remove();
        return false;
      }
      visual.querySelectorAll(".cinema-image").forEach((node) => {
        if (node !== image) node.remove();
      });
      image.classList.remove("is-entering");
      image.classList.add("is-current");
      return true;
    }
    const options = {
      duration: 360,
      easing: "cubic-bezier(.22,.75,.22,1)",
      fill: "both",
    };
    const incoming = image.animate([{ opacity: 0 }, { opacity: 1 }], options);
    const outgoing = previous.animate([{ opacity: 1 }, { opacity: 0 }], options);
    try {
      await Promise.all([incoming.finished, outgoing.finished]);
    } catch {}
    if (token !== operation) {
      image.remove();
      return false;
    }
    visual.querySelectorAll(".cinema-image").forEach((node) => {
      if (node !== image) node.remove();
    });
    image.classList.remove("is-entering");
    image.classList.add("is-current");
    return true;
  }

  function renderProgress(item) {
    const frames = framesFor(item);
    const progress = q("[data-film-progress]");
    progress.replaceChildren();
    frames.forEach((frame, index) => {
      const dot = button("", () => selectFrame(index), "cinema-progress__dot");
      dot.setAttribute(
        "aria-label",
        `查看第 ${index + 1} 张：${frame.alt || "影视画面"}`,
      );
      dot.setAttribute("aria-pressed", String(index === frameIndex));
      progress.append(dot);
    });
    q("[data-film-prev]").disabled = frameIndex === 0;
    q("[data-film-next]").disabled = frameIndex >= frames.length - 1;
    const frame = frames[frameIndex];
    q("[data-film-frame-label]").textContent = frames.length
      ? `${pad(frameIndex + 1)} / ${pad(frames.length)} · ${frame.alt || "影视画面"}`
      : "暂无画面";
  }

  function renderFilm(item, direction) {
    q("[data-film-meta]").textContent = item.meta || "";
    q("[data-film-title]").textContent = item.title;
    q("[data-film-original]").textContent = item.originalTitle || "";
    q("[data-film-note]").textContent = item.note || "";
    q("[data-cinema-count]").textContent = `${pad(selection + 1)} / ${pad(items.length)}`;
    q("[data-cinema-catalog-label]").textContent = item.title;
    const actions = q("[data-film-actions]");
    actions.replaceChildren(
      button(
        "展开资料",
        () => detail("cinema", item.id),
        "film-detail-trigger",
      ),
      share("cinema", item.id),
    );
    const previous = items[selection - 1];
    const next = items[selection + 1];
    const previousButton = q("[data-cinema-prev]");
    const nextButton = q("[data-cinema-next]");
    previousButton.disabled = !previous;
    nextButton.disabled = !next;
    q("[data-cinema-prev-title]").textContent = previous?.title || "已是第一部";
    q("[data-cinema-next-title]").textContent = next?.title || "已是最后一部";
    renderProgress(item);
    info.getAnimations().forEach((animation) => animation.cancel());
    animate(
      info,
      [
        { opacity: 0.35, transform: `translateX(${direction * 12}px)` },
        { opacity: 1, transform: "translateX(0)" },
      ],
      { duration: 320 },
    );
  }

  async function selectFrame(index, { force = false } = {}) {
    const item = items[selection];
    const frames = framesFor(item);
    if (!item || index < 0 || index >= frames.length) return;
    if (!force && index === frameIndex) return;
    const oldIndex = frameIndex;
    const token = ++operation;
    restoreCurrentFrame();
    setStatus("正在调入画面…");
    try {
      const image = await imageFor(frames[index]);
      if (token !== operation) return;
      const changed = await crossfade(image, token);
      if (!changed) return;
      frameIndex = index;
      setStatus();
      renderProgress(item);
      remember("cinema", item.id);
      preloadNeighbors();
    } catch {
      if (token !== operation) return;
      frameIndex = oldIndex;
      setStatus("这张画面暂时没有抵达。", () =>
        selectFrame(index, { force: true }),
      );
    }
  }

  async function show(index, { history = false, force = false } = {}) {
    if (index < 0 || index >= items.length) return;
    if (!force && index === selection) return;
    const oldIndex = selection;
    const direction = index >= oldIndex ? 1 : -1;
    const item = items[index];
    const first = framesFor(item)[0];
    const token = ++operation;
    restoreCurrentFrame();
    setStatus("正在换片…");
    if (!first) {
      setStatus("这部作品暂时没有可见画面。", () =>
        show(index, { history, force: true }),
      );
      return;
    }
    try {
      const image = await imageFor(first);
      if (token !== operation) return;
      const changed = await crossfade(image, token);
      if (!changed) return;
      selection = index;
      frameIndex = 0;
      renderFilm(item, direction);
      setStatus();
      remember("cinema", item.id);
      if (history) updateContentHash("cinema", item.id);
      renderCatalog();
      preloadNeighbors();
    } catch {
      if (token !== operation) return;
      selection = oldIndex;
      setStatus("新画面加载失败，当前画面已保留。", () =>
        show(index, { history, force: true }),
      );
    }
  }

  function renderCatalog() {
    const ids = catalogMatches(entries, "cinema", query.value);
    const visibleItems = ids ? items.filter((item) => ids.has(item.id)) : items;
    list.replaceChildren();
    visibleItems.forEach((item) => {
      const index = items.indexOf(item);
      const choose = button("", () => {
        leaveLayer(dialog, () =>
          show(index, { history: true, force: index === selection }),
        );
      });
      choose.className = "cinema-catalog-item";
      choose.append(
        el("span", "catalog-number", pad(index + 1)),
        el("strong", "", item.title),
        el("small", "", item.meta || item.director || ""),
      );
      if (index === selection) choose.setAttribute("aria-current", "true");
      list.append(choose);
    });
    empty.hidden = visibleItems.length > 0;
  }

  q("[data-cinema-prev]").addEventListener("click", () =>
    show(selection - 1, { history: true }),
  );
  q("[data-cinema-next]").addEventListener("click", () =>
    show(selection + 1, { history: true }),
  );
  q("[data-film-prev]").addEventListener("click", () =>
    selectFrame(frameIndex - 1),
  );
  q("[data-film-next]").addEventListener("click", () =>
    selectFrame(frameIndex + 1),
  );
  screening.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    selectFrame(frameIndex + (event.key === "ArrowRight" ? 1 : -1));
  });
  swipe(visual, (direction) => selectFrame(frameIndex + direction));
  q("[data-cinema-catalog]").addEventListener("click", () => {
    query.value = "";
    renderCatalog();
    showLayer(dialog, location.href);
    requestAnimationFrame(() => query.focus());
  });
  q("[data-cinema-catalog-close]").addEventListener("click", () =>
    dialog.close(),
  );
  query.addEventListener("input", renderCatalog);

  if (items.length) show(selection, { force: true });
  else {
    visual.append(el("p", "cinema-empty-stage", "等待第一场放映。"));
    q("[data-cinema-catalog]").hidden = true;
    q("[data-cinema-prev]").disabled = true;
    q("[data-cinema-next]").disabled = true;
    q("[data-film-prev]").disabled = true;
    q("[data-film-next]").disabled = true;
  }

  return {
    open(id) {
      const index = items.findIndex((item) => item.id === id);
      if (index >= 0) show(index, { force: index === selection });
      return screening;
    },
  };
}

function reviewParts(text) {
  const lines = String(text || "").split("\n");
  if (lines.length > 1 && lines[0].length <= 12)
    return { label: lines.shift(), body: lines.join("\n").trim() };
  return { label: "阅读线索", body: String(text || "") };
}

export function initBooks(data, entries, connections) {
  const books = (data.items || []).filter(real);
  const section = q("#reading");
  const root = q("[data-book]");
  const scene = q(".reading-stage");
  const dialog = q("#book-catalog");
  const query = q("[data-books-search]");
  const directory = q("[data-book-directory]");
  let current = Math.max(
    0,
    books.findIndex((book) => book.id === saved().books),
  );

  section.classList.toggle("is-empty", !books.length);

  if (data.bibliographyNote) {
    const note = el("details", "bibliography-note");
    note.append(
      el("summary", "", "关于书目与版本"),
      el("p", "", data.bibliographyNote),
    );
    q(".reading-commandbar").after(note);
  }

  function renderBook(direction = 0) {
    root.replaceChildren();
    delete root.dataset.contentId;
    const book = books[current];
    q("[data-book-count]").textContent = books.length
      ? `${pad(current + 1)} / ${pad(books.length)} 个书目入口`
      : "";
    q("[data-book-prev]").disabled = current <= 0;
    q("[data-book-next]").disabled = current >= books.length - 1;
    const previous = books[current - 1];
    const next = books[current + 1];
    q("[data-book-prev-title]").textContent = previous?.title || "已是第一项";
    q("[data-book-next-title]").textContent = next?.title || "已是最后一项";

    if (!book) {
      const left = el("article", "book-page book-title-page");
      left.append(
        el("p", "book-kicker", "书目留白"),
        el("h3", "", "还未落笔"),
      );
      const right = el("article", "book-page book-reading-page");
      right.append(
        el("p", "book-kicker", "页边留白"),
        el("p", "", "留给下一次阅读。"),
      );
      root.append(left, right);
      q("[data-book-catalog]").hidden = true;
      return;
    }

    root.dataset.contentId = book.id;
    remember("books", book.id);
    q("[data-book-status]").textContent = [book.author, book.category]
      .filter(Boolean)
      .join(" · ");
    const authorCount = books.filter((item) => item.author === book.author).length;
    q("[data-book-catalog-label]").textContent = `${book.author || "未署名"} · ${authorCount} 项`;

    const left = el("article", "book-page book-title-page");
    left.append(
      el("p", "book-kicker", book.category || "作品身份"),
      el("span", "book-index", pad(current + 1)),
    );
    if (book.image)
      left.append(
        photo({ src: book.image, alt: book.alt || book.title }, "book-cover"),
      );
    left.append(
      el("h3", "", book.title),
      el(
        "p",
        "book-meta",
        [book.author, book.year].filter(Boolean).join(" · "),
      ),
    );
    if (book.tags?.length)
      left.append(el("p", "book-tags", book.tags.slice(0, 4).join(" · ")));

    const right = el("article", "book-page book-reading-page");
    right.append(el("p", "book-kicker", "页边一笔"));
    if (book.quote?.text) {
      const quote = el("blockquote", "book-quote");
      quote.append(el("p", "", `“${book.quote.text}”`));
      if (book.quote.attribution)
        quote.append(el("cite", "", book.quote.attribution));
      right.append(quote);
    }
    if (book.summary) {
      const summary = el("section", "book-reading-block");
      summary.append(el("h4", "", "作品简介"), el("p", "", book.summary));
      right.append(summary);
    }
    const review = reviewParts(book.review);
    if (review.body) {
      const note = el("section", "book-reading-block");
      note.append(el("h4", "", review.label), el("p", "", review.body));
      right.append(note);
    }
    const actions = el("div", "book-actions");
    const source = Object.values(book.links || {}).find(Boolean);
    if (source) actions.append(link("作品资料 ↗", source));
    if (book.quote?.source)
      actions.append(link("摘句出处 ↗", book.quote.source));
    actions.append(share("books", book.id));
    right.append(actions);
    root.append(left, right);
    connections(q("[data-book-relations]"), `books:${book.id}`);

    root.getAnimations().forEach((animation) => animation.cancel());
    if (direction)
      animate(
        root,
        [
          { opacity: 0.35, transform: `translateX(${direction * 10}px)` },
          { opacity: 1, transform: "translateX(0)" },
        ],
        { duration: 300 },
      );
  }

  function go(index, { history = false } = {}) {
    if (index < 0 || index >= books.length || index === current) return;
    const direction = index > current ? 1 : -1;
    current = index;
    renderBook(direction);
    renderDirectory();
    if (history) updateContentHash("books", books[current].id);
  }

  function renderDirectory() {
    const ids = catalogMatches(entries, "books", query.value);
    const matches = ids ? books.filter((book) => ids.has(book.id)) : books;
    const groups = new Map();
    matches.forEach((book) => {
      const author = book.author || "未署名";
      if (!groups.has(author)) groups.set(author, []);
      groups.get(author).push(book);
    });
    directory.replaceChildren();
    groups.forEach((authorBooks, author) => {
      const group = el("details", "author-group");
      const summary = el("summary");
      summary.append(
        el("strong", "", author),
        el("span", "", `${authorBooks.length} 个入口`),
      );
      group.append(summary);
      const works = el("div", "author-works");
      authorBooks.forEach((book) => {
        const index = books.indexOf(book);
        const choose = button("", () => {
          leaveLayer(dialog, () => go(index, { history: true }));
        });
        choose.append(
          el("strong", "", book.title),
          el(
            "span",
            "",
            [book.year, book.category].filter(Boolean).join(" · "),
          ),
        );
        if (index === current) choose.setAttribute("aria-current", "page");
        works.append(choose);
      });
      group.append(works);
      if (query.value.trim() || author === books[current]?.author) group.open = true;
      directory.append(group);
    });
    q("[data-books-empty]").hidden = matches.length > 0;
    q("[data-book-directory-count]").textContent = `${matches.length} 个书目入口 · ${groups.size} 位作者`;
    q("[data-book-directory-reset]").hidden = !query.value.trim();
  }

  q("[data-book-prev]").addEventListener("click", () =>
    go(current - 1, { history: true }),
  );
  q("[data-book-next]").addEventListener("click", () =>
    go(current + 1, { history: true }),
  );
  scene.addEventListener("keydown", (event) => {
    if (event.target.closest("a,button,input,summary")) return;
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    go(current + (event.key === "ArrowRight" ? 1 : -1), { history: true });
  });
  q("[data-book-catalog]").addEventListener("click", () => {
    query.value = "";
    renderDirectory();
    showLayer(dialog, location.href);
    requestAnimationFrame(() => {
      query.focus();
      q('[data-book-directory] [aria-current="page"]')?.scrollIntoView({
        block: "center",
      });
    });
  });
  q("[data-book-catalog-close]").addEventListener("click", () =>
    dialog.close(),
  );
  q("[data-book-directory-reset]").addEventListener("click", () => {
    query.value = "";
    renderDirectory();
    query.focus();
  });
  query.addEventListener("input", renderDirectory);

  renderBook();
  renderDirectory();
  return {
    open(id) {
      const index = books.findIndex((book) => book.id === id);
      if (index >= 0) {
        current = index;
        renderBook();
        renderDirectory();
      }
      return scene;
    },
  };
}
