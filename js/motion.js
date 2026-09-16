// Progressive material cues. Content is always visible without this module.
export function initMotion() {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const fine = matchMedia("(hover: hover) and (pointer: fine)");
  const seen = new WeakSet(),
    watched = new WeakSet(),
    running = new Set();
  let active = null,
    bounds = null,
    frame = 0,
    scanFrame = 0,
    pointer = null;
  const reset = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    if (active) {
      active.style.removeProperty("--tilt-x");
      active.style.removeProperty("--tilt-y");
      active.style.removeProperty("--light-x");
      active.classList.remove("material-active");
    }
    active = null;
    bounds = null;
  };
  const allowed = () =>
    !reduce.matches &&
    fine.matches &&
    !document.hidden &&
    !document.querySelector("dialog[open]");
  function enter(target) {
    if (active === target) return;
    reset();
    if (!target) return;
    active = target;
    bounds = target.getBoundingClientRect();
    active.classList.add("material-active");
  }
  document.addEventListener(
    "pointermove",
    (event) => {
      if (event.pointerType !== "mouse" || !allowed()) {
        reset();
        return;
      }
      const target = event.target.closest(".record-art");
      enter(target);
      if (!active) return;
      pointer = { x: event.clientX, y: event.clientY };
      if (!frame)
        frame = requestAnimationFrame(() => {
          frame = 0;
          if (!active || !bounds || !allowed()) return;
          const x = Math.max(
            -1,
            Math.min(1, ((pointer.x - bounds.left) / bounds.width) * 2 - 1),
          );
          const y = Math.max(
            -1,
            Math.min(1, ((pointer.y - bounds.top) / bounds.height) * 2 - 1),
          );
          active.style.setProperty("--tilt-x", (-y * 3).toFixed(2) + "deg");
          active.style.setProperty("--tilt-y", (x * 4).toFixed(2) + "deg");
          active.style.setProperty("--light-x", (x * 22).toFixed(1) + "%");
        });
    },
    { passive: true },
  );
  document.documentElement.addEventListener("pointerleave", reset);
  addEventListener("blur", reset);
  addEventListener("scroll", reset, { passive: true });
  document.addEventListener("visibilitychange", () => {
    reset();
    if (document.hidden) for (const animation of running) animation.cancel();
  });
  document.addEventListener("focusin", () => {
    if (document.querySelector("dialog[open]")) reset();
  });
  // Never conceal content before it intersects: interruption and no-JS remain readable.
  const observer =
    "IntersectionObserver" in window
      ? new IntersectionObserver(
          (entries) => {
            for (const { target, isIntersecting } of entries) {
              if (!isIntersecting) continue;
              observer.unobserve(target);
              seen.add(target);
              if (reduce.matches || document.hidden || !target.animate)
                continue;
              const animation = target.animate(
                [
                  { opacity: 0.76, translate: "0 12px" },
                  { opacity: 1, translate: "0 0" },
                ],
                { duration: 520, easing: "cubic-bezier(.22,1,.36,1)" },
              );
              running.add(animation);
              animation.finished
                .catch(() => {})
                .finally(() => running.delete(animation));
            }
          },
          { threshold: 0.12 },
        )
      : null;
  function scan() {
    scanFrame = 0;
    document
      .querySelectorAll(
        ".sound-layout,.cinema-stage,.reading-stage,.notes-list article",
      )
      .forEach((node) => {
        if (node.closest(".is-empty") || watched.has(node) || seen.has(node))
          return;
        watched.add(node);
        observer?.observe(node);
      });
  }
  scan();
  new MutationObserver(() => {
    if (!scanFrame) scanFrame = requestAnimationFrame(scan);
  }).observe(document.querySelector("main"), {
    childList: true,
    subtree: true,
  });
  function change() {
    reset();
    if (reduce.matches) for (const animation of running) animation.cancel();
  }
  reduce.addEventListener("change", change);
  fine.addEventListener("change", change);
  addEventListener("pagehide", () => {
    reset();
    for (const animation of running) animation.cancel();
  });
}
