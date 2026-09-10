(() => {
  "use strict";

  const root = document.documentElement;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(pointer: fine)");
  const select = (selector, context = document) => context.querySelector(selector);
  const selectAll = (selector, context = document) => [...context.querySelectorAll(selector)];

  const year = select("[data-year]");
  if (year) year.textContent = String(new Date().getFullYear());

  const header = select("[data-site-header]");
  const updateHeader = () => header?.classList.toggle("is-scrolled", window.scrollY > window.innerHeight * 0.72);
  updateHeader();
  window.addEventListener("scroll", updateHeader, { passive: true });

  const revealItems = selectAll(".reveal");
  if (reducedMotion.matches || !("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
  } else {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -10%", threshold: 0.08 });
    revealItems.forEach((item) => revealObserver.observe(item));
  }

  const applePlayer = select("[data-apple-player]");
  const appleLink = select("[data-apple-link]");
  const lyricsLink = select("[data-lyrics-link]");
  const currentTrack = select("[data-current-track]");
  const trackRows = selectAll("[data-track-title]");

  const chooseTrack = (track) => {
    const title = track.dataset.trackTitle || "当前曲目";
    const embedSource = track.dataset.embedSrc;
    const platformUrl = track.dataset.appleUrl;

    if (applePlayer && embedSource && applePlayer.getAttribute("src") !== embedSource) {
      applePlayer.src = embedSource;
      applePlayer.title = `在 Apple Music 试听《${title}》`;
    }
    if (appleLink && platformUrl) appleLink.href = platformUrl;
    if (lyricsLink && platformUrl) lyricsLink.href = platformUrl;
    if (currentTrack) currentTrack.textContent = title;

    trackRows.forEach((item) => {
      const active = item === track;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-pressed", String(active));
    });
  };

  trackRows.forEach((track) => track.addEventListener("click", () => chooseTrack(track)));

  const posterRail = select("[data-poster-rail]");
  const posterCards = selectAll("[data-poster-card]");
  const previousPoster = select("[data-cinema-prev]");
  const nextPoster = select("[data-cinema-next]");
  let posterScrollFrame = 0;
  let railDrag = null;

  const updatePosterDepth = () => {
    posterScrollFrame = 0;
    if (!posterRail || !posterCards.length) return;
    const railBounds = posterRail.getBoundingClientRect();
    let closestCard = posterCards[0];
    let closestDistance = Number.POSITIVE_INFINITY;

    posterCards.forEach((card) => {
      const cardBounds = card.getBoundingClientRect();
      const rawDistance = Math.abs(cardBounds.left - railBounds.left) / Math.max(1, cardBounds.width * 0.92);
      const distance = Math.min(1, rawDistance);
      card.style.setProperty("--distance", distance.toFixed(3));
      if (rawDistance < closestDistance) {
        closestDistance = rawDistance;
        closestCard = card;
      }
    });

    posterCards.forEach((card) => card.classList.toggle("is-active", card === closestCard));
  };

  const requestPosterUpdate = () => {
    if (posterScrollFrame) return;
    posterScrollFrame = window.requestAnimationFrame(updatePosterDepth);
  };

  const posterStep = () => {
    const first = posterCards[0];
    if (!first || !posterRail) return 320;
    const gap = Number.parseFloat(getComputedStyle(posterRail).columnGap) || 0;
    return first.getBoundingClientRect().width + gap;
  };

  previousPoster?.addEventListener("click", () => posterRail?.scrollBy({ left: -posterStep(), behavior: "smooth" }));
  nextPoster?.addEventListener("click", () => posterRail?.scrollBy({ left: posterStep(), behavior: "smooth" }));
  posterRail?.addEventListener("scroll", requestPosterUpdate, { passive: true });
  posterRail?.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    posterRail.scrollBy({ left: event.key === "ArrowRight" ? posterStep() : -posterStep(), behavior: "smooth" });
  });

  posterRail?.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    railDrag = { x: event.clientX, scrollLeft: posterRail.scrollLeft };
    posterRail.classList.add("is-dragging");
    posterRail.setPointerCapture(event.pointerId);
  });
  posterRail?.addEventListener("pointermove", (event) => {
    if (!railDrag || !posterRail.hasPointerCapture(event.pointerId)) return;
    posterRail.scrollLeft = railDrag.scrollLeft - (event.clientX - railDrag.x);
  });
  const finishRailDrag = () => {
    railDrag = null;
    posterRail?.classList.remove("is-dragging");
  };
  posterRail?.addEventListener("pointerup", finishRailDrag);
  posterRail?.addEventListener("pointercancel", finishRailDrag);

  posterCards.forEach((card) => {
    const art = select(".poster-art", card);
    if (!art || !finePointer.matches || reducedMotion.matches) return;
    card.addEventListener("pointermove", (event) => {
      const bounds = art.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
      const y = Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height));
      art.style.setProperty("--poster-x", `${(x - 0.5) * 5}deg`);
      art.style.setProperty("--poster-y", `${(0.5 - y) * 5}deg`);
      art.style.setProperty("--light-x", `${x * 100}%`);
      art.style.setProperty("--light-y", `${y * 100}%`);
    });
    card.addEventListener("pointerleave", () => {
      art.style.setProperty("--poster-x", "0deg");
      art.style.setProperty("--poster-y", "0deg");
    });
  });

  updatePosterDepth();
  window.addEventListener("resize", requestPosterUpdate, { passive: true });

  const bookScene = select("[data-book-scene]");
  const bookSheets = selectAll("[data-book-sheet]");
  const bookPrevious = select("[data-book-prev]");
  const bookNext = select("[data-book-next]");
  const bookStatus = select("[data-book-status]");
  const bookStates = ["正在读", "再次翻阅", "以后", "暂时读到这里"];
  let turnedPages = 0;

  const updateBook = () => {
    if (bookPrevious) bookPrevious.disabled = turnedPages === 0;
    if (bookNext) {
      bookNext.disabled = turnedPages === bookSheets.length;
      bookNext.innerHTML = turnedPages === bookSheets.length ? "已经读完" : "翻一页 <span aria-hidden=\"true\">→</span>";
    }
    if (bookStatus) bookStatus.textContent = bookStates[turnedPages] || bookStates.at(-1);
  };

  const turnForward = () => {
    if (turnedPages >= bookSheets.length) return;
    const sheet = bookSheets[turnedPages];
    sheet.style.zIndex = String(20 + turnedPages);
    sheet.classList.add("is-turned");
    turnedPages += 1;
    updateBook();
  };

  const turnBack = () => {
    if (turnedPages <= 0) return;
    turnedPages -= 1;
    const sheet = bookSheets[turnedPages];
    sheet.classList.remove("is-turned");
    window.setTimeout(() => {
      if (!sheet.classList.contains("is-turned")) sheet.style.zIndex = "";
    }, reducedMotion.matches ? 0 : 920);
    updateBook();
  };

  bookNext?.addEventListener("click", turnForward);
  bookPrevious?.addEventListener("click", turnBack);
  bookScene?.addEventListener("click", turnForward);
  bookScene?.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight") turnForward();
    if (event.key === "ArrowLeft") turnBack();
  });
  updateBook();

  const tiltSurface = select("[data-tilt-surface]");
  if (tiltSurface && finePointer.matches && !reducedMotion.matches) {
    tiltSurface.addEventListener("pointermove", (event) => {
      const bounds = tiltSurface.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width - 0.5;
      const y = (event.clientY - bounds.top) / bounds.height - 0.5;
      tiltSurface.style.setProperty("--tilt-x", `${x * 1.4}deg`);
      tiltSurface.style.setProperty("--tilt-y", `${y * -1.1}deg`);
    });
    tiltSurface.addEventListener("pointerleave", () => {
      tiltSurface.style.setProperty("--tilt-x", "0deg");
      tiltSurface.style.setProperty("--tilt-y", "0deg");
    });
  }

  if (finePointer.matches && !reducedMotion.matches) {
    const pointerLight = select("[data-pointer-light]");
    const hero = select(".hero");
    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let currentX = targetX;
    let currentY = targetY;
    let pointerFrame = 0;

    const renderPointer = () => {
      currentX += (targetX - currentX) * 0.13;
      currentY += (targetY - currentY) * 0.13;
      if (pointerLight) pointerLight.style.transform = `translate3d(${currentX - 170}px, ${currentY - 170}px, 0)`;
      if (Math.abs(targetX - currentX) > 0.1 || Math.abs(targetY - currentY) > 0.1) {
        pointerFrame = window.requestAnimationFrame(renderPointer);
      } else {
        pointerFrame = 0;
      }
    };

    window.addEventListener("pointermove", (event) => {
      targetX = event.clientX;
      targetY = event.clientY;
      document.body.classList.add("has-pointer");
      if (hero) {
        hero.style.setProperty("--hero-x", ((event.clientX / window.innerWidth) - 0.5).toFixed(3));
        hero.style.setProperty("--hero-y", ((event.clientY / window.innerHeight) - 0.5).toFixed(3));
      }
      if (!pointerFrame) pointerFrame = window.requestAnimationFrame(renderPointer);
    }, { passive: true });
  }
})();
