import {
  loadContent,
  populateShell,
  q,
  qa,
  el,
  notify,
  reduced,
} from "./content.js";
import { catalog, sectionFor } from "./catalog.js";
import { initNavigation } from "./navigation.js";
import { initMusic } from "./music.js";
import { initCinema, initBooks } from "./spaces.js";
import { initDarkroom } from "./darkroom.js";
import { initDetails, renderNotes } from "./details.js";
import { initSearch } from "./search.js";
async function start() {
  const data = await loadContent();
  populateShell(data);
  const entries = catalog(data),
    navigation = initNavigation(),
    controllers = {};
  let landing = 0,
    previous = "";
  function go(entry, { autoplay = true, hash = true } = {}) {
    if (!entry) return;
    clearTimeout(landing);
    navigation.close();
    const section = sectionFor(entry.kind);
    if (entry.kind === "darkroom")
      q("#darkroom").scrollIntoView({ behavior: "instant", block: "start" });
    const node = controllers[entry.kind]?.open(entry.id, autoplay);
    if (hash) history.replaceState(null, "", "#" + section + "-" + entry.id);
    if (entry.kind === "darkroom") return;
    if (node) {
      const area = entry.kind === "music" ? q(".sound-layout") : node;
      area.scrollIntoView({
        behavior: reduced() ? "instant" : "smooth",
        block: "center",
      });
      const finish = () => {
        if (q("dialog[open]")) return;
        node.tabIndex = node.tabIndex < 0 ? -1 : node.tabIndex;
        node.focus({ preventScroll: true });
        node.classList.add("arrival");
        setTimeout(() => node.classList.remove("arrival"), 1800);
      };
      landing = setTimeout(finish, reduced() ? 0 : 800);
    }
  }
  const detail = initDetails(data, entries, go);
  controllers.music = initMusic(data, entries, detail.connections);
  controllers.cinema = initCinema(data.cinema, entries, detail.open);
  controllers.books = initBooks(data.books, entries, detail.connections);
  controllers.darkroom = initDarkroom(data.darkroom, detail.connections);
  controllers.notes = renderNotes(data.notes, detail.open, detail.connections);
  initSearch(entries, go);
  q("[data-wander]").disabled = !entries.length;
  q("[data-wander]").addEventListener("click", () => {
    const pool = entries.filter(
      (e) => entries.length === 1 || e.key !== previous,
    );
    const random = new Uint32Array(1);
    crypto.getRandomValues(random);
    const entry = pool[Math.floor((random[0] / 4294967296) * pool.length)];
    if (entry) {
      previous = entry.key;
      go(entry);
      notify("遇见 · " + entry.title);
    }
  });
  const cancel = () => clearTimeout(landing);
  addEventListener("wheel", cancel, { passive: true });
  addEventListener("touchstart", cancel, { passive: true });
  addEventListener("keydown", (e) => {
    if (
      ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"].includes(
        e.key,
      )
    )
      cancel();
  });
  function openHash() {
    const entry = entries.find(
      (e) => `#${sectionFor(e.kind)}-${e.id}` === location.hash,
    );
    if (entry) go(entry, { autoplay: false, hash: false });
    else if (location.hash === "#life") {
      history.replaceState(null, "", "#darkroom");
      q("#darkroom").scrollIntoView();
    }
  }
  addEventListener("hashchange", openHash);
  document.documentElement.dataset.contentReady = "true";
  if (location.hash) requestAnimationFrame(openHash);
}
start().catch((error) => {
  console.error("Unable to initialize world", error);
  const n = el("p", "load-error", "页面未能完整展开，请刷新重试。");
  q("main").prepend(n);
});
