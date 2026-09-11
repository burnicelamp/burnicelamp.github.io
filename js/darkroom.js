import { remember, saved, share, showLayer, hrefFor } from "./journey.js";
import {
  q,
  qa,
  el,
  button,
  photo,
  visible,
  swipe,
  reduced,
  animate,
} from "./content.js";
export function initDarkroom(data, connections) {
  const all = visible(data.items)
    .filter((p) => p.placeholder === false)
    .filter((p) =>
      data.rolls?.some((r) => r.id === p.rollId && r.published !== false),
    );
  let roll = data.rolls?.find((r) => r.published !== false)?.id || "",
    selected = -1,
    origin = null,
    busy = false;
  const dialog = q(".enlarger"),
    sheet = q("[data-contact-sheet]");
  const rolls = visible(data.rolls || []);
  const developed = new Set();
  q("#darkroom").classList.toggle("is-empty", !all.length);
  const list = () => {
    const cover = rolls.find((r) => r.id === roll)?.coverId;
    return all
      .filter((p) => !roll || p.rollId === roll)
      .sort((a, b) => Number(b.id === cover) - Number(a.id === cover));
  };
  const observer =
    "IntersectionObserver" in window
      ? new IntersectionObserver(
          (es) => {
            es.forEach((e) => {
              if (e.isIntersecting) {
                e.target.classList.add("developed");
                developed.add(e.target.dataset.photo);
                observer.unobserve(e.target);
              }
            });
          },
          { threshold: 0.1 },
        )
      : null;
  function render() {
    observer?.disconnect();
    sheet.replaceChildren();
    for (const b of qa("[data-rolls] button"))
      b.setAttribute("aria-pressed", String(b.dataset.roll === roll));
    const photos = list();
    if (!photos.length) {
      const blank = el("div", "empty-roll");
      blank.append(
        el("i", "safety-light"),
        el("span", "", data.empty?.label || "未曝光 / 00"),
        el("h3", "", data.empty?.title || "这一卷，还没有显影。"),
        el("p", "", data.empty?.text || "留给真实发生的日子。"),
      );
      sheet.append(blank);
      return;
    }
    photos.forEach((p, i) => {
      const ratio = p.width / p.height || 1.5;
      const frame = el(
        "figure",
        `contact-frame ${ratio < 0.9 ? "portrait" : ratio > 1.6 ? "landscape" : ""}`,
      );
      frame.dataset.photo = p.id;
      frame.classList.toggle("lead-frame", i === 0);
      frame.classList.toggle(
        "closing-frame",
        i === photos.length - 1 && photos.length > 2,
      );
      const b = button("", () => open(p.id, b));
      b.setAttribute("aria-label", "放大 " + (p.alt || p.title));
      b.dataset.photoId = p.id;
      const img = photo({ ...p, sizes: "(max-width: 700px) 90vw, 40vw" });
      img.style.setProperty("--ratio", ratio);
      b.append(img);
      const caption = el("figcaption");
      caption.append(
        el("span", "", `${String(i + 1).padStart(2, "0")} ▷`),
        el(
          "span",
          "",
          [p.date?.replaceAll("-", "."), p.location]
            .filter(Boolean)
            .join(" / "),
        ),
      );
      frame.append(b, caption);
      sheet.append(frame);
      if (reduced() || !observer || developed.has(p.id))
        frame.classList.add("developed");
      else observer.observe(frame);
    });
  }
  function fill() {
    const p = list()[selected];
    if (!p) return;
    const host = q("[data-enlarger-image]");
    remember("darkroom", p.id);
    if (dialog.open && history.state?.layer === dialog.className)
      history.replaceState(history.state, "", hrefFor("darkroom", p.id));
    host.classList.remove("zoomed");
    const img = photo({ ...p, sizes: "95vw" }, "", true);
    host.replaceChildren(img);
    const loading = el("span", "photo-loading", "正在显影…");
    host.append(loading);
    const done = () => loading.remove();
    img.addEventListener("load", done, { once: true });
    img.addEventListener("error", done, { once: true });
    if (img.complete) done();
    const tools = q("[data-photo-tools]");
    tools.replaceChildren(
      share("darkroom", p.id),
      button("查看细节", (e) => {
        host.classList.toggle("zoomed");
        e.currentTarget.textContent = host.classList.contains("zoomed")
          ? "适合窗口"
          : "查看细节";
      }),
    );
    q("[data-photo-counter]").textContent =
      `${String(selected + 1).padStart(2, "0")} / ${String(list().length).padStart(2, "0")}`;
    q("[data-photo-caption]").replaceChildren(
      el(
        "p",
        "",
        [p.date?.replaceAll("-", "."), p.location].filter(Boolean).join(" · "),
      ),
      el("small", "", p.caption || ""),
    );
    q("[data-photo-prev]").disabled = selected <= 0;
    q("[data-photo-next]").disabled = selected >= list().length - 1;
    connections(q("[data-photo-relations]"), "darkroom:" + p.id);
  }
  // FLIP fallback gives continuous source-to-enlarger geometry without layout per frame.
  async function transition(from, change, getTo) {
    if (reduced() || !from) {
      change();
      return;
    }
    if (document.startViewTransition && !dialog.open) {
      from.style.viewTransitionName = "enlarged-photo";
      let target;
      const t = document.startViewTransition(() => {
        from.style.viewTransitionName = "";
        change();
        target = getTo();
        if (target) target.style.viewTransitionName = "enlarged-photo";
      });
      try {
        await t.finished;
      } catch {
      } finally {
        from.style.viewTransitionName = "";
        if (target) target.style.viewTransitionName = "";
      }
      return;
    }
    const fitted = (image) => {
      const rect = image.getBoundingClientRect();
      const ratio =
        (image.naturalWidth || image.width) /
        (image.naturalHeight || image.height);
      if (getComputedStyle(image).objectFit !== "contain" || !ratio)
        return rect;
      const width = Math.min(rect.width, rect.height * ratio),
        height = width / ratio;
      return {
        left: rect.left + (rect.width - width) / 2,
        top: rect.top + (rect.height - height) / 2,
        width,
        height,
      };
    };
    const r = fitted(from);
    const clone = from.cloneNode(true);
    clone.className = "photo-flight";
    clone.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;
    change();
    const target = getTo();
    if (!target) return;
    const end = fitted(target);
    dialog.open ? dialog.append(clone) : document.body.append(clone);
    target.style.opacity = "0";
    await animate(
      clone,
      [
        { transform: "translate(0,0) scale(1,1)" },
        {
          transform: `translate(${end.left - r.left}px,${end.top - r.top}px) scale(${end.width / r.width},${end.height / r.height})`,
        },
      ],
      { duration: 650 },
    );
    clone.remove();
    target.style.opacity = "";
  }
  async function open(id, source) {
    if (busy) return;
    const p = all.find((x) => x.id === id);
    if (!p) return;
    if (p.rollId !== roll) {
      roll = p.rollId;
      render();
    }
    selected = list().findIndex((x) => x.id === id);
    origin =
      source || qa("[data-photo-id]").find((n) => n.dataset.photoId === id);
    busy = true;
    try {
      await transition(
        origin?.querySelector("img"),
        () => {
          fill();
          showLayer(dialog, hrefFor("darkroom", p.id));
        },
        () => q("[data-enlarger-image] img"),
      );
    } finally {
      busy = false;
    }
  }
  async function close() {
    if (busy || !dialog.open) return;
    busy = true;
    const p = list()[selected];
    const target = qa("[data-photo-id]").find(
      (n) => n.dataset.photoId === p?.id,
    );
    try {
      await transition(
        q("[data-enlarger-image] img"),
        () => dialog.close(),
        () => target?.querySelector("img"),
      );
      origin?.focus({ preventScroll: true });
    } finally {
      busy = false;
    }
  }
  const step = (d) => {
    if (busy || selected + d < 0 || selected + d >= list().length) return;
    selected += d;
    fill();
    animate(
      q("[data-enlarger-image]"),
      [
        { opacity: 0.35, transform: `translateX(${d * 18}px)` },
        { opacity: 1, transform: "translateX(0)" },
      ],
      { duration: 450 },
    );
  };
  q("[data-photo-prev]").addEventListener("click", () => step(-1));
  q("[data-photo-next]").addEventListener("click", () => step(1));
  q("[data-photo-close]").addEventListener("click", close);
  dialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    close();
  });
  dialog.addEventListener("keydown", (e) => {
    if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
      e.preventDefault();
      step(e.key === "ArrowRight" ? 1 : -1);
    }
  });
  swipe(q("[data-enlarger-image]"), step);
  rolls.forEach((r) => {
    const b = button(r.title, () => {
      roll = r.id;
      render();
    });
    b.dataset.roll = r.id;
    q("[data-rolls]").append(b);
  });
  const tools = el("div", "photo-tools");
  tools.dataset.photoTools = "";
  dialog.querySelector("header").after(tools);
  render();
  return {
    open(id) {
      open(id);
      return sheet;
    },
  };
}
