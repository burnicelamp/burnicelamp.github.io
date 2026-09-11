// Shared DOM and content boundary. Content is always rendered as text, never HTML.
export const q = (s, p = document) => p.querySelector(s);
export const qa = (s, p = document) => [...p.querySelectorAll(s)];
export function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}
export const visible = (items = []) =>
  items.filter((x) => x.published !== false);
export const real = (x) => x.published !== false && x.placeholder === false;
export const reduced = () =>
  matchMedia("(prefers-reduced-motion: reduce)").matches;
export function safeUrl(value, { local = true } = {}) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const u = new URL(value, document.baseURI);
    return u.protocol === "https:" ||
      (local &&
        u.origin === location.origin &&
        ["http:", "https:"].includes(u.protocol))
      ? u.href
      : "";
  } catch {
    return "";
  }
}
export function photo(data, cls = "", priority = false) {
  const n = el("img", cls);
  n.alt = data.alt || "";
  n.decoding = "async";
  n.loading = priority ? "eager" : "lazy";
  if (priority) n.fetchPriority = "high";
  if (data.width && data.height) {
    n.width = data.width;
    n.height = data.height;
  }
  const url = safeUrl(data.src || data.image);
  if (url) n.src = url;
  if (data.variants?.length) {
    n.srcset = data.variants
      .filter((v) => safeUrl(v.src) && v.width > 0)
      .map((v) => `${safeUrl(v.src)} ${v.width}w`)
      .join(", ");
    n.sizes = data.sizes || "(max-width: 700px) 90vw, 50vw";
  }
  n.addEventListener(
    "error",
    () => {
      const fallback = el(
        "span",
        "image-unavailable",
        "画面暂不可见 · " + (data.alt || ""),
      );
      const retry = el("span", "image-retry", "重新加载");
      retry.tabIndex = 0;
      retry.setAttribute("role", "button");
      const reload = (e) => {
        e.preventDefault();
        e.stopPropagation();
        fallback.replaceWith(photo(data, cls, priority));
      };
      retry.addEventListener("click", reload);
      retry.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") reload(e);
      });
      fallback.append(retry);
      n.replaceWith(fallback);
    },
    { once: true },
  );
  return n;
}
export function link(label, url) {
  const n = el("a", "", label);
  const href = safeUrl(url);
  if (href) {
    n.href = href;
    n.target = "_blank";
    n.rel = "noreferrer";
  }
  return n;
}
export function button(label, fn, cls = "") {
  const n = el("button", cls, label);
  n.type = "button";
  n.addEventListener("click", fn);
  return n;
}
export function notify(message) {
  const n = q(".notice");
  n.textContent = message;
  n.classList.add("visible");
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => n.classList.remove("visible"), 3500);
}
export async function loadContent() {
  const names = [
    "site",
    "music",
    "lyrics",
    "cinema",
    "books",
    "darkroom",
    "notes",
    "relations",
  ];
  return Object.fromEntries(
    await Promise.all(
      names.map(async (name) => {
        try {
          const r = await fetch(
            new URL(`../content/${name}.json`, import.meta.url),
          );
          if (!r.ok) throw Error(`${r.status}`);
          const d = await r.json();
          if (!d || typeof d !== "object") throw Error("Invalid JSON");
          if (
            ["music", "cinema", "books", "darkroom", "notes"].includes(name) &&
            !Array.isArray(d[name === "music" ? "tracks" : "items"])
          )
            throw Error("Missing entries");
          return [name, d];
        } catch (e) {
          console.warn(`Content unavailable: ${name}`, e.message);
          return [
            name,
            {
              error: true,
              items: [],
              tracks: [],
              rolls: [],
              links: [],
              spaces: [],
            },
          ];
        }
      }),
    ),
  );
}
export function populateShell(data) {
  const s = data.site;
  for (const nav of qa("[data-navigation]"))
    for (const space of s.spaces || []) {
      const a = el("a", "", space.title);
      a.href = "#" + space.id;
      nav.append(a);
    }
  for (const space of s.spaces || []) {
    if (space.id === "top") continue;
    const h = q(`[data-heading=${space.id}]`);
    const title = el("div");
    const kicker = el("p", "eyebrow");
    kicker.append(
      el("span", "space-index", space.number),
      document.createTextNode(space.english),
    );
    const name = el("h2", "", space.title);
    name.id = space.id + "-title";
    title.append(name);
    h.append(
      title,
      el(
        "p",
        "",
        data[space.id === "reading" ? "books" : space.id]?.intro || "",
      ),
    );
  }
  if (s.hero) {
    q("[data-hero-eyebrow]").textContent = s.hero.eyebrow;
    q("#hero-title").textContent = s.hero.title;
    q("[data-hero-footer]").textContent = s.hero.footer;
    const p = s.hero.portrait;
    q("[data-hero-image]").append(
      photo({ ...p, sizes: "(max-width: 700px) 100vw, 65vw" }, "", true),
    );
    q("[data-portrait-credit]").textContent = p.credit;
    q("[data-portrait-credit]").href = safeUrl(p.source);
  }
  q("[data-footer]").textContent = s.footer || "";
  for (const [name, section] of Object.entries({
    music: "music",
    cinema: "cinema",
    books: "reading",
    darkroom: "darkroom",
    notes: "notes",
    site: "top",
  })) {
    if (data[name].error) {
      const message = el("p", "load-error", "内容暂时没有抵达。");
      message.append(button("重新载入", () => location.reload()));
      q("#" + section).prepend(message);
    }
  }
}
export function swipe(node, onStep) {
  let start,
    swiped = 0;
  node.addEventListener("pointerdown", (e) => {
    if (
      e.target.closest("input,a") ||
      (e.target.closest("button") && !e.target.closest(".film-art"))
    )
      return;
    start = { x: e.clientX, y: e.clientY };
  });
  node.addEventListener("pointerup", (e) => {
    if (!start) return;
    const dx = e.clientX - start.x,
      dy = e.clientY - start.y;
    start = null;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      swiped = Date.now();
      onStep(dx < 0 ? 1 : -1);
    }
  });
  node.addEventListener(
    "click",
    (e) => {
      if (Date.now() - swiped < 300) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    true,
  );
  node.addEventListener("pointercancel", () => (start = null));
}
export async function animate(node, frames, options = {}) {
  if (reduced()) return;
  const a = node.animate(frames, {
    duration: 600,
    easing: "cubic-bezier(.22,1,.36,1)",
    ...options,
  });
  try {
    await a.finished;
  } catch {}
}
