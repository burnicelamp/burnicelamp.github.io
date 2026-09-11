import {
  initLayers,
  saved,
  remember,
  startJourney,
  isLayerReturn,
} from "./journey.js";
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
  initLayers();
  const data = await loadContent();
  populateShell(data);
  const entries = catalog(data),
    navigation = initNavigation(),
    controllers = {};
  let landing = 0,
    previous = "";
  let recent = [];
  try {
    recent = JSON.parse(sessionStorage.getItem("burnlamp-wander") || "[]");
  } catch {}
  function go(entry, { autoplay = true, hash = true } = {}) {
    if (!entry) return;
    clearTimeout(landing);
    navigation.close();
    const section = sectionFor(entry.kind);
    if (entry.kind === "darkroom")
      q("#darkroom").scrollIntoView({ behavior: "instant", block: "start" });
    if (hash && entry.kind !== "darkroom")
      history.pushState(null, "", "#" + section + "-" + entry.id);
    const node = controllers[entry.kind]?.open(entry.id, autoplay);
    remember(entry.kind, entry.id);
    if (entry.kind === "darkroom") return;
    if (node) {
      const area = entry.kind === "music" ? q(".sound-layout") : node;
      area.scrollIntoView({
        behavior: reduced() ? "instant" : "smooth",
        block: "start",
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
  startJourney();
  initSearch(entries, go);
  q("[data-wander]").disabled = !entries.length;
  q("[data-wander]").addEventListener("click", () => {
    let pool = entries.filter((e) => !recent.includes(e.key));
    if (!pool.length) {
      recent = recent.slice(-1);
      pool = entries.filter(
        (e) => entries.length === 1 || !recent.includes(e.key),
      );
    }
    const groups = [...new Set(pool.map((e) => e.kind))];
    if (groups.length > 1) {
      const kind = groups[Math.floor(Math.random() * groups.length)];
      pool = pool.filter((e) => e.kind === kind);
    }
    const random = new Uint32Array(1);
    crypto.getRandomValues(random);
    const entry = pool[Math.floor((random[0] / 4294967296) * pool.length)];
    if (entry) {
      previous = entry.key;
      recent.push(entry.key);
      recent = recent.slice(-Math.min(12, Math.max(1, entries.length - 1)));
      try {
        sessionStorage.setItem("burnlamp-wander", JSON.stringify(recent));
      } catch {}
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
    if (isLayerReturn()) return;
    const entry = entries.find(
      (e) => `#${sectionFor(e.kind)}-${e.id}` === location.hash.split("&")[0],
    );
    if (entry) {
      go(entry, { autoplay: false, hash: false });
      if (location.hash.endsWith("&view=detail"))
        detail.open(entry.kind, entry.id);
    } else if (location.hash === "#life") {
      history.replaceState(null, "", "#darkroom");
      q("#darkroom").scrollIntoView();
    }
  }
  addEventListener("hashchange", openHash);
  addEventListener("popstate", () => {
    if (history.state?.layer && history.state.layer !== "search-dialog")
      openHash();
  });
  const resume = el("button", "resume-visit");
  resume.hidden = true;
  q(".hero-baseline").append(resume);
  function updateResume() {
    const last = saved().last;
    const entry = entries.find(
      (e) => e.kind === last?.kind && e.id === last?.id,
    );
    resume.hidden = !entry;
    if (entry) {
      resume.textContent = "接着看 · " + entry.title;
      resume.onclick = () => go(entry, { autoplay: false });
    }
  }
  document.addEventListener("world:visit", updateResume);
  updateResume();
  document.documentElement.dataset.contentReady = "true";
  if (location.hash) requestAnimationFrame(openHash);
}
start().catch((error) => {
  console.error("Unable to initialize world", error);
  const n = el("p", "load-error", "页面未能完整展开，请刷新重试。");
  q("main").prepend(n);
});
