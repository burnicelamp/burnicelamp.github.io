import { q, qa, el } from "./content.js";
import { search, kinds } from "./catalog.js";
export function initSearch(entries, go) {
  const dialog = q(".search-dialog"),
    input = q("#global-query"),
    list = q("#search-results");
  let results = [],
    active = 0,
    opener;
  function select(i) {
    active = Math.max(0, Math.min(results.length - 1, i));
    qa("[role=option]", list).forEach((n, j) =>
      n.setAttribute("aria-selected", String(j === active)),
    );
    const n = q(`[data-index="${active}"]`, list);
    if (n) {
      input.setAttribute("aria-activedescendant", n.id);
      n.scrollIntoView({ block: "nearest", behavior: "instant" });
    } else input.removeAttribute("aria-activedescendant");
  }
  function render() {
    results = search(entries, input.value);
    list.replaceChildren();
    results.slice(0, 100).forEach((e, i) => {
      const n = el("div", "search-result");
      n.id = "search-result-" + i;
      n.role = "option";
      n.dataset.index = i;
      const copy = el("span");
      copy.append(
        el("strong", "", e.title),
        el(
          "small",
          "",
          [e.artist, e.author, e.director, e.location, e.year]
            .filter(Boolean)
            .join(" · "),
        ),
      );
      n.append(copy, el("small", "", kinds[e.kind] + " ↗"));
      n.addEventListener("pointermove", () => select(i));
      n.addEventListener("click", () => activate(i));
      list.append(n);
    });
    if (!results.length)
      list.append(el("p", "search-empty", "还没有这一页。换个词，再找找。"));
    q("[data-search-count]").textContent =
      `${results.length} 个真实内容${results.length > 100 ? " · 显示前 100 个" : ""}`;
    select(0);
  }
  function activate(i) {
    const e = results[i];
    if (!e) return;
    dialog.close();
    go(e);
  }
  function open() {
    opener = document.activeElement;
    for (const d of qa("dialog[open]")) d.close();
    dialog.showModal();
    render();
    input.focus();
    input.select();
  }
  input.addEventListener("input", render);
  input.addEventListener("keydown", (e) => {
    if (e.isComposing) return;
    if (["ArrowDown", "ArrowUp"].includes(e.key)) {
      e.preventDefault();
      select(Math.min(99, active + (e.key === "ArrowDown" ? 1 : -1)));
    }
    if (e.key === "Enter") {
      e.preventDefault();
      activate(active);
    }
  });
  q("[data-search-close]").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => {
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  });
  q("[data-search-open]").addEventListener("click", open);
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      if (dialog.open) dialog.close();
      else open();
    }
  });
  return { open };
}
