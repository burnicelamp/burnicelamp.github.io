import { showLayer, leaveLayer } from "./journey.js";
import { q, qa, el, button } from "./content.js";
import { search, kinds } from "./catalog.js";
export function initSearch(entries, go) {
  const dialog = q(".search-dialog"),
    input = q("#global-query"),
    list = q("#search-results");
  let results = [],
    active = 0,
    opener;
  const help = q("#search-help");
  const example =
    entries.find((e) => e.artist)?.artist || entries[0]?.title || "";
  help.textContent = example
    ? "试试「" + example + "」"
    : "输入关键词，寻找收藏";
  const filters = el("details", "search-filters");
  filters.append(el("summary", "", "按作者、年份或空间筛选"));
  const tips = el(
    "p",
    "",
    "可组合使用 作者:、艺人:、导演:、地点:、年份:、标签:、类型:。例如 " +
      (example ? "艺人:" + example : "类型:记录"),
  );
  filters.append(tips);
  help.after(filters);
  const platform = /Mac|iPhone|iPad/.test(navigator.platform)
    ? "⌘ K"
    : "Ctrl K";
  q("[data-search-open] kbd").textContent = platform;
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
      n.addEventListener("pointermove", (event) => {
        if (event.pointerType === "mouse") select(i);
      });
      n.addEventListener("click", () => activate(i));
      list.append(n);
    });
    if (!results.length) {
      const empty = el("div", "search-empty", "没有找到相符内容。");
      empty.append(
        button("清除条件，看看全部", () => {
          input.value = "";
          render();
          input.focus();
        }),
      );
      list.append(empty);
    }
    q("[data-search-count]").textContent =
      `${results.length} 个真实内容${results.length > 100 ? " · 显示前 100 个" : ""}`;
    select(0);
  }
  function activate(i) {
    const e = results[i];
    if (!e) return;
    leaveLayer(dialog, () => go(e));
  }
  function open() {
    opener = document.activeElement;
    for (const d of qa("dialog[open]")) d.close();
    showLayer(dialog);
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
