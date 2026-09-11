import { el, safeUrl } from "./content.js";
const domains = {
  apple: ["music.apple.com", "embed.music.apple.com"],
  netease: ["music.163.com"],
  bilibili: ["www.bilibili.com", "bilibili.com", "player.bilibili.com"],
};
export function providerUrl(value, provider, embed = false) {
  const s = safeUrl(value, { local: false });
  if (!s) return "";
  const u = new URL(s);
  if (!domains[provider]?.includes(u.hostname)) return "";
  if (embed && provider === "apple" && u.hostname !== "embed.music.apple.com")
    return "";
  if (
    embed &&
    provider === "netease" &&
    !u.pathname.startsWith("/outchain/player")
  )
    return "";
  if (embed && provider === "bilibili" && u.hostname !== "player.bilibili.com")
    return "";
  return s;
}
export function authorized(source, now = Date.now()) {
  const r = source?.rights;
  return (
    source?.provider === "local-authorized" &&
    source.src &&
    r?.publicPlayback === true &&
    r?.staticPublication === true &&
    ["owned", "direct-permission", "public-domain"].includes(r.kind) &&
    Boolean(r.attribution) &&
    (!r.expiresAt ||
      (Number.isFinite(Date.parse(r.expiresAt)) &&
        Date.parse(r.expiresAt) > now))
  );
}
export class AudioAdapter {
  constructor(source, host) {
    this.source = source;
    this.mode = "audio";
    this.capabilities = {
      play: true,
      seek: true,
      volume: true,
      clock: true,
      loop: true,
    };
    this.media = el("audio");
    this.media.preload = "metadata";
    this.media.src = safeUrl(source.src);
    this.media.setAttribute("aria-label", "授权音频");
    host.append(this.media);
    this.label = "授权音频";
    this.message = source.rights.attribution;
  }
  play() {
    return this.media.play();
  }
  pause() {
    this.media.pause();
  }
  seek(t) {
    if (Number.isFinite(this.media.duration))
      this.media.currentTime = Math.max(0, Math.min(this.media.duration, t));
  }
  setVolume(v) {
    this.media.volume = v;
  }
  setLoop(v) {
    this.media.loop = v;
  }
  get paused() {
    return this.media.paused;
  }
  get duration() {
    return this.media.duration;
  }
  get time() {
    return this.media.currentTime;
  }
  subscribe(event, fn) {
    this.media.addEventListener(event, fn);
    return () => this.media.removeEventListener(event, fn);
  }
  dispose() {
    this.pause();
    this.media.removeAttribute("src");
    this.media.load();
    this.media.remove();
  }
}
export class OfficialAdapter {
  constructor(source, host) {
    this.source = source;
    this.host = host;
    this.mode = "official";
    this.capabilities = {
      play: false,
      seek: false,
      volume: false,
      clock: false,
      loop: false,
    };
    this.label =
      { apple: "Apple Music", netease: "网易云音乐", bilibili: "哔哩哔哩" }[
        source.provider
      ] || "原始来源";
    this.message = "此曲由平台提供播放；请使用下方官方播放器。";
  }
  open() {
    const src = providerUrl(this.source.embed, this.source.provider, true);
    if (!src) {
      this.message = "这首歌暂不能站内播放，可通过下方入口在来源平台聆听。";
      return;
    }
    const f = el("iframe");
    f.src = src;
    f.loading = "lazy";
    f.title = this.label + " 官方播放器";
    f.allow = "autoplay; encrypted-media; fullscreen";
    f.referrerPolicy = "strict-origin-when-cross-origin";
    f.setAttribute(
      "sandbox",
      "allow-scripts allow-same-origin allow-popups allow-forms allow-presentation",
    );
    this.host.replaceChildren(f);
    this.frame = f;
  }
  dispose() {
    this.host.replaceChildren();
  }
}
// New providers implement the same capability contract. UI never reaches into iframes.
const registry = new Map([
  ["local-authorized", (s, h) => new AudioAdapter(s, h)],
  ...["apple", "netease", "bilibili"].map((name) => [
    name,
    (s, h) => new OfficialAdapter(s, h),
  ]),
]);
export function registerProvider(name, factory) {
  registry.set(name, factory);
}
export function sourceFor(track) {
  const sources = track.sources || [];
  const local = sources.find((s) => authorized(s) && safeUrl(s.src));
  if (local) return local;
  return (
    sources.find(
      (s) => domains[s.provider] && providerUrl(s.url, s.provider),
    ) || null
  );
}
export function createAdapter(track, host) {
  const source = sourceFor(track);
  return source ? registry.get(source.provider)?.(source, host) : null;
}
