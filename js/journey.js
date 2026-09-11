import { button, el, notify, q } from "./content.js";
import { sectionFor } from "./catalog.js";
export const hrefFor = (kind, id) => "#" + sectionFor(kind) + "-" + id;
let tracking = false;
export const startJourney = () => {
  tracking = true;
};
export function remember(kind, id) {
  if (!tracking) return;
  try {
    const old = JSON.parse(sessionStorage.getItem("burnlamp-visit") || "{}");
    old[kind] = id;
    old.last = { kind, id };
    sessionStorage.setItem("burnlamp-visit", JSON.stringify(old));
  } catch {}
  document.dispatchEvent(
    new CustomEvent("world:visit", { detail: { kind, id } }),
  );
}
export function saved() {
  try {
    return JSON.parse(sessionStorage.getItem("burnlamp-visit") || "{}");
  } catch {
    return {};
  }
}
export function share(kind, id) {
  return button(
    "复制链接",
    async () => {
      const url = new URL(hrefFor(kind, id), location.href).href;
      try {
        await navigator.clipboard.writeText(url);
        notify("链接已复制");
      } catch {
        const box = el("input", "share-fallback");
        box.readOnly = true;
        box.value = url;
        box.setAttribute("aria-label", "内容链接，选中后复制");
        const host = q("dialog[open]") || document.body;
        host.append(box);
        box.focus();
        box.select();
        box.addEventListener("blur", () => box.remove(), { once: true });
        notify("请复制选中的链接");
      }
    },
    "share-link",
  );
}
// Each modal owns one history entry. Back dismisses it without moving the room.
let returning = false,
  quietUntil = 0;
export const isLayerReturn = () => performance.now() < quietUntil;
export function showLayer(dialog, hash) {
  if (!dialog.open) {
    dialog._origin = document.activeElement;
    dialog._scroll = scrollY;
    if (!returning && history.state?.layer !== dialog.className)
      history.pushState({ layer: dialog.className }, "", hash || location.href);
    dialog.showModal();
  }
}
export function initLayers() {
  addEventListener("pagehide", () => {
    returning = true;
  });
  for (const dialog of document.querySelectorAll("dialog"))
    dialog.addEventListener("close", () => {
      if (!returning && history.state?.layer === dialog.className) {
        quietUntil = performance.now() + 200;
        history.back();
      }
      dialog._origin?.isConnected &&
        dialog._origin.focus({ preventScroll: true });
    });
  addEventListener("popstate", () => {
    returning = true;
    for (const d of document.querySelectorAll("dialog[open]"))
      if (history.state?.layer !== d.className) {
        quietUntil = performance.now() + 200;
        d.close();
        window.scrollTo({ top: d._scroll || 0, behavior: "instant" });
      }
    queueMicrotask(() => (returning = false));
  });
}

export function leaveLayer(dialog, action) {
  if (history.state?.layer === dialog.className) {
    addEventListener("popstate", () => setTimeout(action, 0), { once: true });
    dialog.close();
  } else {
    dialog.close();
    action();
  }
}
