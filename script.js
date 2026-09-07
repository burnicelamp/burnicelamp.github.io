(() => {
  "use strict";

  const root = document.documentElement;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(pointer: fine)");
  const select = (selector, context = document) => context.querySelector(selector);
  const selectAll = (selector, context = document) => [...context.querySelectorAll(selector)];
  const pad = (value) => String(value).padStart(2, "0");

  root.classList.add("js");

  const bootScreen = select("[data-boot]");
  window.setTimeout(() => bootScreen?.classList.add("is-complete"), reducedMotion.matches ? 0 : 480);

  function updateClock() {
    const now = new Date();
    const hours = pad(now.getHours());
    const minutes = pad(now.getMinutes());
    const seconds = pad(now.getSeconds());
    selectAll("[data-clock]").forEach((clock) => { clock.textContent = `${hours}:${minutes}`; });
    const clockWithSeconds = select("[data-clock-seconds]");
    if (clockWithSeconds) {
      clockWithSeconds.textContent = `${hours}:${minutes}:${seconds}`;
      clockWithSeconds.setAttribute("datetime", now.toISOString());
    }
  }

  updateClock();
  window.setInterval(updateClock, 1000);
  const year = select("[data-year]");
  if (year) year.textContent = String(new Date().getFullYear());

  const revealItems = selectAll("[data-reveal]");
  if (reducedMotion.matches || !("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("is-seen"));
  } else {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-seen");
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -12%", threshold: 0.12 });
    revealItems.forEach((item) => revealObserver.observe(item));
  }

  const sections = selectAll("[data-section]");
  const navLinks = selectAll("[data-nav-link]");
  const progressBar = select("[data-scroll-progress]");
  let scrollFrame = 0;
  let activeSectionId = "";

  function updateScrollState() {
    scrollFrame = 0;
    const scrollRange = document.documentElement.scrollHeight - window.innerHeight;
    const progress = scrollRange > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollRange)) : 0;
    if (progressBar) progressBar.style.transform = `scaleY(${progress})`;

    const anchor = window.innerHeight * 0.34;
    let active = sections[0];
    let closestDistance = Number.POSITIVE_INFINITY;
    sections.forEach((section) => {
      const bounds = section.getBoundingClientRect();
      if (bounds.top <= anchor && bounds.bottom > anchor) {
        active = section;
        closestDistance = 0;
      } else if (closestDistance !== 0) {
        const distance = Math.min(Math.abs(bounds.top - anchor), Math.abs(bounds.bottom - anchor));
        if (distance < closestDistance) {
          closestDistance = distance;
          active = section;
        }
      }
    });

    if (!active || active.id === activeSectionId) return;
    activeSectionId = active.id;
    root.style.setProperty("--active", active.dataset.accent || "#ff542e");
    root.dataset.section = active.id;
    navLinks.forEach((link) => {
      link.classList.toggle("is-active", link.getAttribute("href") === `#${active.id}`);
    });
  }

  function requestScrollUpdate() {
    if (scrollFrame) return;
    scrollFrame = window.requestAnimationFrame(updateScrollState);
  }

  updateScrollState();
  window.addEventListener("scroll", requestScrollUpdate, { passive: true });
  window.addEventListener("resize", requestScrollUpdate, { passive: true });

  const channels = [
    {
      id: "live",
      number: "01",
      label: "此刻",
      kicker: "正在接收",
      title: "此刻 / 信号输入",
      copy: "最近状态与注意力入口。内容只保留真实更新。",
    },
    {
      id: "media",
      number: "02",
      label: "媒介",
      kicker: "接口已就绪",
      title: "偏爱 / 媒介接口",
      copy: "用不同媒介结构浏览声音、影像、阅读、地点与物件。",
    },
    {
      id: "frames",
      number: "03",
      label: "影像",
      kicker: "底片架已就绪",
      title: "影像 / 接触印样",
      copy: "可拖动、可点开的影像架；素材位等待真实照片。",
    },
    {
      id: "log",
      number: "04",
      label: "记录",
      kicker: "记录已编目",
      title: "记录 / 时间游标",
      copy: "通过时间调谐器浏览真实经历与站点更新记录。",
    },
    {
      id: "queue",
      number: "05",
      label: "待播",
      kicker: "队列待机中",
      title: "未来 / 待播队列",
      copy: "尚未发生的计划按状态排队，不用虚构内容填满版面。",
    },
  ];

  const tuner = select("[data-tuner-zone]");
  const dial = select("[data-tuner-dial]");
  const channelKeys = selectAll("[data-tune-channel]");
  const channelLink = select("[data-open-channel]");
  let channelIndex = 0;

  function setChannel(nextIndex, persist = true) {
    channelIndex = (nextIndex + channels.length) % channels.length;
    const channel = channels[channelIndex];
    root.dataset.channel = channel.id;
    tuner?.style.setProperty("--dial-angle", `${-72 + channelIndex * 36}deg`);
    const readout = select("[data-tuner-readout]");
    if (readout) readout.textContent = `${channel.number}.0`;
    const number = select("[data-preview-number]");
    const kicker = select("[data-preview-kicker]");
    const title = select("[data-preview-title]");
    const copy = select("[data-preview-copy]");
    if (number) number.textContent = `频道 ${channel.number}`;
    if (kicker) kicker.textContent = channel.kicker;
    if (title) title.textContent = channel.title;
    if (copy) copy.textContent = channel.copy;
    if (channelLink) channelLink.href = `#${channel.id}`;
    if (dial) dial.setAttribute("aria-label", `频道旋钮，当前频道 ${channel.number} ${channel.label}。点击切换，也可使用左右方向键`);
    channelKeys.forEach((key) => {
      const isActive = key.dataset.tuneChannel === channel.id;
      key.classList.toggle("is-active", isActive);
      key.setAttribute("aria-pressed", String(isActive));
    });
    if (persist) {
      try { window.sessionStorage.setItem("burnlamp-channel", channel.id); } catch { /* storage is optional */ }
    }
  }

  channelKeys.forEach((key) => {
    key.addEventListener("click", () => {
      const index = channels.findIndex((channel) => channel.id === key.dataset.tuneChannel);
      if (index >= 0) setChannel(index);
    });
  });

  let dialDragged = false;
  dial?.addEventListener("click", () => {
    if (dialDragged) {
      dialDragged = false;
      return;
    }
    setChannel(channelIndex + 1);
  });
  dial?.addEventListener("keydown", (event) => {
    if (["ArrowRight", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      setChannel(channelIndex + 1);
    }
    if (["ArrowLeft", "ArrowDown"].includes(event.key)) {
      event.preventDefault();
      setChannel(channelIndex - 1);
    }
    if (event.key === "Home") {
      event.preventDefault();
      setChannel(0);
    }
    if (event.key === "End") {
      event.preventDefault();
      setChannel(channels.length - 1);
    }
  });

  let dialDragStart = null;
  dial?.addEventListener("pointerdown", (event) => {
    dialDragStart = { x: event.clientX, index: channelIndex };
    dialDragged = false;
    dial.setPointerCapture(event.pointerId);
  });
  dial?.addEventListener("pointermove", (event) => {
    if (!dialDragStart || !dial.hasPointerCapture(event.pointerId)) return;
    if (Math.abs(event.clientX - dialDragStart.x) > 6) dialDragged = true;
    const delta = Math.round((event.clientX - dialDragStart.x) / 34);
    const nextIndex = Math.max(0, Math.min(channels.length - 1, dialDragStart.index + delta));
    if (nextIndex !== channelIndex) setChannel(nextIndex);
  });
  dial?.addEventListener("pointerup", () => { dialDragStart = null; });
  dial?.addEventListener("pointercancel", () => { dialDragStart = null; });

  try {
    const savedChannel = window.sessionStorage.getItem("burnlamp-channel");
    const savedIndex = channels.findIndex((channel) => channel.id === savedChannel);
    setChannel(savedIndex >= 0 ? savedIndex : 0, false);
  } catch {
    setChannel(0, false);
  }

  const mediaData = {
    audio: {
      index: "01",
      label: "声音",
      accent: "#ff542e",
      title: "寸铁《近人可读》",
      copy: "从专辑中选取五首歌。站内只接入 Apple Music 官方试听，完整播放以平台所在地区与订阅状态为准。",
      slots: ["最近一项 / 待录入", "长期留存 / 待录入", "一则记忆 / 待录入"],
      speed: "33⅓ 转/分",
    },
    screen: {
      index: "02",
      label: "影像",
      accent: "#5ad0ff",
      title: "观看记录等待片单",
      copy: "电影、剧集与真正想留下的画面将在这里出现。没有片名时，界面保持待机。",
      slots: ["最近观看 / 待录入", "值得重看 / 待录入", "画面一笔 / 待录入"],
      speed: "24 格/秒",
    },
    reading: {
      index: "03",
      label: "阅读",
      accent: "#c8ff3d",
      title: "书页索引等待内容",
      copy: "这里用于在读、重读与真正留下痕迹的文字，不自动生成书单或感想。",
      slots: ["正在读 / 待录入", "再次翻阅 / 待录入", "页边一笔 / 待录入"],
      speed: "索引 03",
    },
    places: {
      index: "04",
      label: "地点",
      accent: "#efeee7",
      title: "地点频道尚无坐标",
      copy: "去过的地方、愿意再去的位置与真实旅行记录，可以在这里建立索引。",
      slots: ["曾经到达 / 待录入", "愿意重返 / 待录入", "下一站 / 待录入"],
      speed: "坐标 —",
    },
    objects: {
      index: "05",
      label: "物件",
      accent: "#ff542e",
      title: "物件目录等待建档",
      copy: "只有确实拥有来历与记忆的物件才进入这里；昂贵与否不是筛选标准。",
      slots: ["日常使用 / 待录入", "长久留存 / 待录入", "背后故事 / 待录入"],
      speed: "目录 05",
    },
  };

  const mediaConsole = select("[data-media-console]");
  const mediaPanel = select("[data-media-panel]");
  const mediaTabs = selectAll("[data-medium]");

  function setMedium(key, moveFocus = false) {
    const data = mediaData[key];
    if (!data || !mediaConsole || !mediaPanel) return;
    mediaConsole.style.setProperty("--media-accent", data.accent);
    const visual = select("[data-media-visual]", mediaPanel);
    visual?.setAttribute("data-media-visual", key);
    const visualLabel = visual?.querySelector(":scope > p");
    if (visualLabel) visualLabel.textContent = data.speed;
    select("[data-media-code]", mediaPanel).textContent = `媒介 ${data.index} / ${data.label}`;
    select("[data-media-title]", mediaPanel).textContent = data.title;
    select("[data-media-copy]", mediaPanel).textContent = data.copy;
    select("[data-media-slot-a]", mediaPanel).textContent = data.slots[0];
    select("[data-media-slot-b]", mediaPanel).textContent = data.slots[1];
    select("[data-media-slot-c]", mediaPanel).textContent = data.slots[2];
    const isAudio = key === "audio";
    select("[data-music-player]", mediaPanel)?.toggleAttribute("hidden", !isAudio);
    select("[data-media-slots]", mediaPanel)?.toggleAttribute("hidden", isAudio);
    select(".media-copy", mediaPanel)?.classList.toggle("has-player", isAudio);
    mediaTabs.forEach((tab) => {
      const isActive = tab.dataset.medium === key;
      tab.setAttribute("aria-selected", String(isActive));
      tab.tabIndex = isActive ? 0 : -1;
      if (isActive) {
        mediaPanel.setAttribute("aria-labelledby", tab.id);
        if (moveFocus) tab.focus();
      }
    });
    try { window.sessionStorage.setItem("burnlamp-medium", key); } catch { /* storage is optional */ }
  }

  mediaTabs.forEach((tab, index) => {
    tab.addEventListener("click", () => setMedium(tab.dataset.medium));
    tab.addEventListener("keydown", (event) => {
      let nextIndex = null;
      if (["ArrowRight", "ArrowDown"].includes(event.key)) nextIndex = (index + 1) % mediaTabs.length;
      if (["ArrowLeft", "ArrowUp"].includes(event.key)) nextIndex = (index - 1 + mediaTabs.length) % mediaTabs.length;
      if (event.key === "Home") nextIndex = 0;
      if (event.key === "End") nextIndex = mediaTabs.length - 1;
      if (nextIndex === null) return;
      event.preventDefault();
      setMedium(mediaTabs[nextIndex].dataset.medium, true);
    });
  });

  try {
    const savedMedium = window.sessionStorage.getItem("burnlamp-medium");
    setMedium(mediaData[savedMedium] ? savedMedium : "audio");
  } catch {
    setMedium("audio");
  }

  const applePlayer = select("[data-apple-player]");
  const appleLink = select("[data-apple-link]");
  const appleTracks = selectAll("[data-apple-track]");

  appleTracks.forEach((track) => {
    track.addEventListener("click", () => {
      const title = track.dataset.trackTitle || "当前曲目";
      const embedSource = track.dataset.embedSrc;
      if (applePlayer && embedSource && applePlayer.src !== embedSource) {
        applePlayer.src = embedSource;
        applePlayer.title = `在 Apple Music 试听《${title}》`;
      }
      if (appleLink && track.dataset.appleUrl) appleLink.href = track.dataset.appleUrl;
      appleTracks.forEach((item) => {
        const isActive = item === track;
        item.classList.toggle("is-active", isActive);
        item.setAttribute("aria-pressed", String(isActive));
      });
    });
  });

  const filmViewport = select("[data-film-viewport]");
  const filmFrames = selectAll("[data-frame]");
  const filmCounter = select("[data-film-counter]");
  let filmDrag = null;
  let filmMoved = false;
  let filmFrame = 0;

  filmViewport?.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    filmDrag = { x: event.clientX, scrollLeft: filmViewport.scrollLeft };
    filmMoved = false;
    filmViewport.classList.add("is-dragging");
  });
  filmViewport?.addEventListener("pointermove", (event) => {
    if (!filmDrag) return;
    const distance = event.clientX - filmDrag.x;
    if (Math.abs(distance) > 6) filmMoved = true;
    filmViewport.scrollLeft = filmDrag.scrollLeft - distance;
  });
  const stopFilmDrag = () => {
    filmDrag = null;
    filmViewport?.classList.remove("is-dragging");
  };
  filmViewport?.addEventListener("pointerup", stopFilmDrag);
  filmViewport?.addEventListener("pointercancel", stopFilmDrag);
  filmViewport?.addEventListener("pointerleave", stopFilmDrag);
  filmViewport?.addEventListener("scroll", () => {
    if (filmFrame) return;
    filmFrame = window.requestAnimationFrame(() => {
      filmFrame = 0;
      const firstFrame = filmFrames[0];
      if (!firstFrame || !filmCounter) return;
      const unit = firstFrame.getBoundingClientRect().width;
      const current = Math.max(0, Math.min(filmFrames.length - 1, Math.round(filmViewport.scrollLeft / unit)));
      filmCounter.textContent = `${pad(current + 1)} / ${pad(filmFrames.length)}`;
    });
  }, { passive: true });

  const frameDialog = select("[data-frame-dialog]");
  filmFrames.forEach((frame, index) => {
    frame.addEventListener("click", (event) => {
      if (filmMoved) {
        event.preventDefault();
        filmMoved = false;
        return;
      }
      if (!frameDialog?.showModal) return;
      select("[data-dialog-number]", frameDialog).textContent = pad(index + 1);
      select("[data-dialog-title]", frameDialog).textContent = frame.dataset.title || `画面 ${pad(index + 1)}`;
      select("[data-dialog-caption]", frameDialog).textContent = frame.dataset.caption || "待补充真实素材。";
      frameDialog.showModal();
    });
  });
  select("[data-dialog-close]", frameDialog)?.addEventListener("click", () => frameDialog.close());
  frameDialog?.addEventListener("click", (event) => {
    if (event.target === frameDialog) frameDialog.close();
  });

  const logEntries = [
    {
      code: "记录 00",
      date: "待补充",
      title: "起点记录尚未录入",
      copy: "这里应放一条真实、重要且适合公开的早期经历。当前不根据模板推测人生背景。",
      status: "状态 / 暂空",
      valueText: "起点 / 待补充",
    },
    {
      code: "记录 01",
      date: "待补充",
      title: "转折记录尚未录入",
      copy: "这里留给一次真实的选择、变化或开始。可以很短，但需要由本人确认。",
      status: "状态 / 暂空",
      valueText: "转折 / 待补充",
    },
    {
      code: "记录 02",
      date: "2026.09",
      title: "网站界面重构",
      copy: "将个人网站重构为统一的信号工作台，并保留现有域名与 GitHub Pages 发布方式。",
      status: "状态 / 已记录",
      valueText: "现在 / 网站重构",
    },
    {
      code: "记录 03",
      date: "待补充",
      title: "下一条记录等待发生",
      copy: "未来内容保持开放；发生以后再记录，而不是先写好一个看似完整的故事。",
      status: "状态 / 待机",
      valueText: "下一步 / 待补充",
    },
  ];

  const logSlider = select("[data-log-slider]");
  const logButtons = selectAll("[data-log-index]");

  function setLog(index) {
    const safeIndex = Math.max(0, Math.min(logEntries.length - 1, Number(index)));
    const entry = logEntries[safeIndex];
    if (!entry) return;
    if (logSlider) {
      logSlider.value = String(safeIndex);
      logSlider.setAttribute("aria-valuetext", entry.valueText);
    }
    select("[data-log-code]").textContent = entry.code;
    select("[data-log-date]").textContent = entry.date;
    select("[data-log-title]").textContent = entry.title;
    select("[data-log-copy]").textContent = entry.copy;
    select("[data-log-status]").textContent = entry.status;
    logButtons.forEach((button) => button.classList.toggle("is-active", Number(button.dataset.logIndex) === safeIndex));
  }

  logSlider?.addEventListener("input", () => setLog(logSlider.value));
  logButtons.forEach((button) => button.addEventListener("click", () => setLog(button.dataset.logIndex)));

  if (finePointer.matches) {
    const pointer = select("[data-pointer]");
    let pointerFrame = 0;
    let pointerX = -40;
    let pointerY = -40;
    window.addEventListener("pointermove", (event) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      if (pointerFrame) return;
      pointerFrame = window.requestAnimationFrame(() => {
        root.style.setProperty("--pointer-x", `${pointerX}px`);
        root.style.setProperty("--pointer-y", `${pointerY}px`);
        pointer?.classList.add("is-visible");
        pointerFrame = 0;
      });
    }, { passive: true });
    selectAll("a, button, input, summary").forEach((control) => {
      control.addEventListener("pointerenter", () => pointer?.classList.add("is-over"));
      control.addEventListener("pointerleave", () => pointer?.classList.remove("is-over"));
    });
  }
})();
