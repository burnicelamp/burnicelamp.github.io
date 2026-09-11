import { q, qa, button, reduced } from "./content.js";
export function initNavigation() {
  const header = q(".site-header"),
    menu = q("#mobile-nav"),
    toggle = q(".nav-toggle");
  function close() {
    menu.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
  }
  toggle.addEventListener("click", () => {
    menu.hidden = !menu.hidden;
    toggle.setAttribute("aria-expanded", String(!menu.hidden));
  });
  menu.append(
    button("随便看看", () => {
      close();
      q("[data-wander]").click();
    }),
  );
  menu.addEventListener("click", (e) => {
    if (e.target.closest("a")) {
      close();
      toggle.focus({ preventScroll: true });
    }
  });
  document.addEventListener("pointerdown", (e) => {
    if (!header.contains(e.target)) close();
  });
  header.addEventListener("focusout", (e) => {
    if (!header.contains(e.relatedTarget)) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !menu.hidden) {
      close();
      toggle.focus();
    }
  });
  window.addEventListener(
    "resize",
    () => {
      if (innerWidth > 900) close();
    },
    { passive: true },
  );
  const sections = qa("main>section"),
    cursor = q(".cursor"),
    hero = q("[data-hero-image]"),
    copy = q(".hero-copy");
  let frame = 0,
    heroVisible = true,
    active = "top",
    px = 0,
    py = 0;
  function update() {
    frame = 0;
    header.classList.toggle("scrolled", scrollY > 70);
    const target =
      sections
        .filter((n) => n.getBoundingClientRect().top < innerHeight * 0.42)
        .at(-1) || sections[0];
    active = target.id;
    cursor.dataset.space = active;
    qa("[data-navigation] a").forEach((a) =>
      a.hash === "#" + active
        ? a.setAttribute("aria-current", "location")
        : a.removeAttribute("aria-current"),
    );
    if (!reduced()) {
      const amount = Math.min(1, scrollY / (innerHeight * 0.8));
      hero.style.opacity = String(1 - amount * 0.9);
      copy.style.opacity = String(1 - amount);
      copy.style.transform = `translateY(${amount * 55}px)`;
    } else if (reduced()) {
      hero.style.opacity = "1";
      copy.style.opacity = "1";
      copy.style.transform = "";
    }
  }
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  addEventListener("scroll", schedule, { passive: true });
  addEventListener("resize", schedule, { passive: true });
  new IntersectionObserver((es) => {
    heroVisible = es[0].isIntersecting;
  }).observe(q("#top"));
  let pointerFrame = 0;
  addEventListener(
    "pointermove",
    (e) => {
      if (
        e.pointerType !== "mouse" ||
        !matchMedia("(hover:hover) and (pointer:fine)").matches ||
        reduced()
      )
        return;
      px = e.clientX;
      py = e.clientY;
      document.body.classList.add("custom-cursor");
      cursor.style.opacity = e.target.closest(
        "input,textarea,select,p,h1,h2,h3,[contenteditable],button,a",
      )
        ? "0"
        : "1";
      cursor.classList.toggle(
        "over-target",
        Boolean(e.target.closest("button,a,input")),
      );
      if (!pointerFrame)
        pointerFrame = requestAnimationFrame(() => {
          pointerFrame = 0;
          cursor.style.transform = `translate3d(${px - 15}px,${py - 15}px,0)`;
          if (heroVisible) {
            hero.style.setProperty(
              "--hero-x",
              `${(px / innerWidth - 0.5) * 10}px`,
            );
            hero.style.setProperty(
              "--hero-y",
              `${(py / innerHeight - 0.5) * 7}px`,
            );
          }
        });
    },
    { passive: true },
  );
  document.addEventListener("mouseleave", () => (cursor.style.opacity = "0"));
  addEventListener("blur", () => (cursor.style.opacity = "0"));
  matchMedia("(prefers-reduced-motion: reduce)").addEventListener(
    "change",
    () => {
      document.body.classList.remove("custom-cursor");
      schedule();
    },
  );
  update();
  return { close };
}
