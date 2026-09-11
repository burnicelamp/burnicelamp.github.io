import { remember, saved, share } from "./journey.js";
import {
  q,
  qa,
  el,
  button,
  photo,
  visible,
  notify,
  safeUrl,
} from "./content.js";
import { search } from "./catalog.js";
import { createAdapter, sourceFor } from "./providers.js";
import { LyricsView, mediaClock } from "./lyrics.js";
const time = (t) =>
  Number.isFinite(t)
    ? `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`
    : "0:00";
export function initMusic(data, entries, connections) {
  const tracks = visible(data.music.tracks).filter(
      (t) => t.placeholder === false,
    ),
    host = q("[data-provider-host]"),
    lyrics = new LyricsView(q(".lyrics-card"), data.lyrics);
  let current = -1,
    adapter = null,
    cleanups = [],
    shuffle = false,
    repeat = false,
    generation = 0,
    expiryTimer;
  const play = q("[data-play]"),
    progress = q("[data-progress]"),
    volume = q("[data-volume]"),
    status = q("[data-player-status]");
  const sharing = el("div", "player-sharing");
  q(".listening-desk").append(sharing);
  const retry = button(
    "重新加载播放器",
    () => {
      const index = current;
      current = -1;
      choose(index, false);
    },
    "provider-retry",
  );
  q(".listening-desk").append(retry);
  const mini = el("aside", "mini-player");
  mini.hidden = true;
  mini.setAttribute("aria-label", "正在听");
  const miniReturn = button("", () =>
    q("#music").scrollIntoView({ block: "start", behavior: "smooth" }),
  );
  const miniPlay = button("暂停", () => toggle());
  mini.append(miniReturn, miniPlay);
  document.body.append(mini);
  let inRoom = true;
  new IntersectionObserver((es) => {
    inRoom = es[0].isIntersecting;
    sync();
  }).observe(q("#music"));
  function sync() {
    const a = adapter;
    if (!a) {
      mini.hidden = true;
      return;
    }
    mini.hidden = a.mode !== "audio" || inRoom;
    miniReturn.textContent =
      (a.paused ? "已暂停 · " : "正在听 · ") + (tracks[current]?.title || "");
    miniPlay.textContent = a.paused ? "播放" : "暂停";
    play.textContent = a.mode === "audio" && !a.paused ? "Ⅱ" : "▶";
    play.setAttribute(
      "aria-label",
      a.mode === "audio" && !a.paused ? "暂停" : "播放",
    );
    if (a.mode === "audio") {
      progress.max = String(Number.isFinite(a.duration) ? a.duration : 0);
      progress.value = String(a.time);
      q("[data-elapsed]").textContent = time(a.time);
      q("[data-duration]").textContent = time(a.duration);
    }
  }
  function renderQueue() {
    const hits = new Set(
      search(
        entries.filter((e) => e.kind === "music"),
        q("[data-music-search]").value,
      ).map((e) => e.id),
    );
    const filter = q("[data-music-search]").value.trim();
    const list = q("[data-track-list]");
    list.replaceChildren();
    tracks.forEach((t, i) => {
      if (filter && !hits.has(t.id)) return;
      const row = button("", () => choose(i, true), "track-row");
      row.id = "music-" + t.id;
      row.dataset.contentId = t.id;
      row.setAttribute("aria-pressed", String(i === current));
      row.classList.toggle("is-active", i === current);
      row.append(
        el(
          "span",
          "track-number",
          i === current ? "↗" : String(i + 1).padStart(2, "0"),
        ),
        el("b", "", t.title),
        el("small", "", t.duration || ""),
      );
      list.append(row);
    });
    if (!list.children.length)
      list.append(el("p", "search-empty", "没有找到这首歌。"));
    q("[data-queue-count]").textContent = String(tracks.length).padStart(
      2,
      "0",
    );
  }
  async function choose(index, autoplay = false) {
    if (!tracks[index]) return;
    if (current === index && adapter) {
      if (autoplay) await toggle();
      return;
    }
    const version = ++generation;
    clearTimeout(expiryTimer);
    cleanups.forEach((fn) => fn());
    cleanups = [];
    adapter?.dispose();
    adapter = null;
    host.replaceChildren();
    current = index;
    const t = tracks[index];
    remember("music", t.id);
    sharing.replaceChildren(share("music", t.id));
    q("[data-current-track]").textContent = t.title;
    q("[data-current-artist]").textContent = [t.artist, t.album, t.year]
      .filter(Boolean)
      .join(" · ");
    q("#music").dataset.environment = ["indigo", "wine"].includes(t.environment)
      ? t.environment
      : "indigo";
    q("[data-cover]").replaceChildren();
    const cover = t.cover || {
      src: data.music.album?.image,
      alt: data.music.album?.alt,
    };
    const art = q("[data-cover]");
    art.classList.remove("has-cover");
    const fallback = el("div", "album-placeholder");
    fallback.append(
      el("strong", "", t.album || t.title),
      el("span", "", t.artist || ""),
    );
    art.append(fallback);
    if (cover.src) {
      const image = photo(cover);
      image.addEventListener("load", () => art.classList.add("has-cover"), {
        once: true,
      });
      art.append(image);
    }
    adapter = createAdapter(t, host);
    const source = sourceFor(t);
    q("[data-source-label]").textContent = adapter?.label || "";
    q("#music").dataset.playback = adapter?.mode || "none";
    const audio = adapter?.mode === "audio";
    play.hidden = !audio;
    q("[data-shuffle]").hidden = !audio;
    q("[data-repeat]").hidden = !audio;
    q(".timeline").hidden = !audio;
    q(".volume").hidden = !audio;
    retry.hidden = !adapter || (adapter.mode === "official" && !source?.embed);
    q("[data-previous]").textContent = "← 上一首";
    q("[data-next]").textContent = "下一首 →";
    const a = q("[data-platform-link]");
    const platformUrl = safeUrl(source?.url, { local: false });
    a.hidden = !platformUrl;
    if (platformUrl) {
      a.href = platformUrl;
      a.textContent = `在 ${adapter.label} 聆听 ↗`;
    }
    for (const [control, cap] of [
      [play, "play"],
      [progress, "seek"],
      [volume, "volume"],
      [q("[data-repeat]"), "loop"],
    ])
      control.disabled = !adapter?.capabilities[cap];
    q("[data-elapsed]").textContent = "0:00";
    q("[data-duration]").textContent = t.duration || "0:00";
    progress.value = "0";
    status.textContent = adapter?.message || "这首歌还没有可用音源。";
    if (adapter?.mode === "audio") {
      const live = adapter;
      live.setVolume(Number(volume.value));
      live.setLoop(repeat);
      lyrics.setTrack(
        t,
        mediaClock(live.media, Number(source.offsetSeconds) || 0),
      );
      for (const event of [
        "timeupdate",
        "play",
        "pause",
        "loadedmetadata",
        "durationchange",
      ])
        cleanups.push(live.subscribe(event, sync));
      cleanups.push(live.subscribe("ended", () => step(1, true)));
      cleanups.push(
        live.subscribe("waiting", () => (status.textContent = "正在缓冲…")),
      );
      cleanups.push(
        live.subscribe("playing", () => (status.textContent = live.message)),
      );
      cleanups.push(
        live.subscribe("error", () => {
          status.textContent = "音源暂时无法播放，请重试或前往来源平台。";
          play.textContent = "▶";
        }),
      );
      if (source.rights.expiresAt) {
        const check = () => {
          const remaining = Date.parse(source.rights.expiresAt) - Date.now();
          if (remaining <= 0) {
            current = -1;
            choose(index, false);
          } else
            expiryTimer = setTimeout(check, Math.min(remaining, 2147483647));
        };
        check();
      }
      if (autoplay)
        try {
          await live.play();
        } catch {
          if (version === generation)
            status.textContent =
              "未能开始播放，请点击播放重试，或前往来源平台。";
        }
    } else {
      lyrics.setTrack(t);
      if (adapter) {
        adapter.open();
        status.textContent = adapter.message;
      }
    }
    if (version !== generation) return;
    renderQueue();
    connections(q("[data-music-relations]"), "music:" + t.id, {
      kind: "music",
      title: "继续探索",
    });
    const siblings = tracks.filter(
      (x) =>
        x.id !== t.id &&
        x.album &&
        x.album === t.album &&
        x.artist === t.artist,
    );
    if (siblings.length) {
      const r = q("[data-music-relations]");
      r.replaceChildren(el("p", "", "继续听这张专辑 · " + t.album));
      for (const x of siblings.slice(0, 4))
        r.append(button(x.title, () => choose(tracks.indexOf(x), true)));
    }
    sync();
  }
  async function toggle() {
    if (adapter?.mode !== "audio") {
      q("[data-provider-host] iframe")?.focus();
      return;
    }
    if (!adapter.paused) adapter.pause();
    else
      try {
        await adapter.play();
        status.textContent = adapter.message;
      } catch {
        status.textContent = "播放未能开始，请检查音源或稍后重试。";
      }
    sync();
  }
  function step(direction, autoplay = true) {
    if (!tracks.length) return;
    let next = (current + direction + tracks.length) % tracks.length;
    if (shuffle && tracks.length > 1) {
      const pool = tracks.map((_, i) => i).filter((i) => i !== current);
      next = pool[Math.floor(Math.random() * pool.length)];
    }
    choose(next, autoplay);
  }
  play.addEventListener("click", toggle);
  q("[data-previous]").addEventListener("click", () => step(-1));
  q("[data-next]").addEventListener("click", () => step(1));
  q("[data-shuffle]").addEventListener("click", (e) => {
    shuffle = !shuffle;
    e.currentTarget.setAttribute("aria-pressed", String(shuffle));
  });
  q("[data-repeat]").addEventListener("click", (e) => {
    repeat = !repeat;
    adapter?.setLoop?.(repeat);
    e.currentTarget.setAttribute("aria-pressed", String(repeat));
  });
  progress.addEventListener("input", () => {
    adapter?.seek?.(Number(progress.value));
    sync();
  });
  volume.addEventListener("input", () =>
    adapter?.setVolume?.(Number(volume.value)),
  );
  q("[data-music-search]").addEventListener("input", renderQueue);
  q("[data-queue-toggle]").addEventListener("click", (e) => {
    q("#queue").hidden = !q("#queue").hidden;
    e.currentTarget.setAttribute("aria-expanded", String(!q("#queue").hidden));
  });
  document.addEventListener("keydown", (e) => {
    if (
      e.code !== "Space" ||
      e.repeat ||
      e.ctrlKey ||
      e.metaKey ||
      e.altKey ||
      e.target.closest(
        "input,textarea,button,a,[contenteditable=true],dialog,[data-lyrics-viewport]",
      )
    )
      return;
    if (adapter?.mode === "audio") {
      e.preventDefault();
      toggle();
    }
  });
  q("[data-previous]").disabled =
    q("[data-next]").disabled =
    q("[data-shuffle]").disabled =
      tracks.length < 2;
  if (tracks.length)
    choose(
      Math.max(
        0,
        tracks.findIndex((t) => t.id === saved().music),
      ),
    );
  else {
    q("[data-current-track]").textContent = "留给下一段声音";
    lyrics.setTrack({ id: "", title: "声场" });
    q(".transport").hidden = true;
    q(".timeline").hidden = true;
    q(".volume").hidden = true;
    retry.hidden = true;
  }
  return {
    open(id, autoplay = true) {
      q("[data-music-search]").value = "";
      q("#queue").hidden = false;
      q("[data-queue-toggle]").setAttribute("aria-expanded", "true");
      const i = tracks.findIndex((t) => t.id === id);
      if (i !== current) choose(i, autoplay);
      else if (autoplay && adapter?.mode === "audio" && adapter.paused)
        toggle();
      else if (adapter?.mode === "official")
        notify("已选中曲目，请在官方播放器中开始聆听。");
      renderQueue();
      return q("[data-current-track]");
    },
  };
}
