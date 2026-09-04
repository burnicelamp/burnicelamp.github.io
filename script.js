(() => {
  "use strict";

  const root = document.documentElement;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const pad = (value) => String(value).padStart(2, "0");

  function updateTime() {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const exactTime = `${pad(hour)}:${pad(minute)}`;
    const period = hour < 5 ? "深夜" : hour < 9 ? "清晨" : hour < 12 ? "上午" : hour < 14 ? "正午" : hour < 18 ? "下午" : hour < 22 ? "夜晚" : "深夜";
    const isNight = hour >= 18 || hour < 6;

    root.dataset.period = isNight ? "night" : "day";
    root.style.setProperty("--sky-hue", isNight ? "215" : hour < 10 ? "38" : "194");

    document.querySelectorAll("[data-time-label]").forEach((element) => {
      element.textContent = `${period} ${exactTime}`;
    });
    document.querySelector("[data-now-time]").textContent = exactTime;
    document.querySelector("[data-now-period]").textContent =
      period === "深夜" ? "岛屿已经安静下来" :
      period === "清晨" ? "今天的光刚刚抵达" :
      period === "夜晚" ? "灯亮了，世界慢慢变小" :
      `这里正在经过一个${period}`;
  }

  updateTime();
  window.setInterval(updateTime, 60000);
  document.querySelector("[data-year]").textContent = new Date().getFullYear();

  const header = document.querySelector("[data-header]");
  let lastScrollY = -1;
  function onScroll() {
    if (window.scrollY === lastScrollY) return;
    lastScrollY = window.scrollY;
    header.classList.toggle("is-scrolled", window.scrollY > 30);
  }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  const revealItems = [...document.querySelectorAll(".reveal")];
  if (reducedMotion.matches || !("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
  } else {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -9%", threshold: 0.08 });
    revealItems.forEach((item, index) => {
      item.style.transitionDelay = `${Math.min(index % 4, 3) * 55}ms`;
      revealObserver.observe(item);
    });
  }

  const navLinks = [...document.querySelectorAll(".site-nav a")];
  const navSections = navLinks
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);
  if ("IntersectionObserver" in window) {
    const navObserver = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      navLinks.forEach((link) => {
        link.classList.toggle("is-active", link.getAttribute("href") === `#${visible.target.id}`);
      });
    }, { rootMargin: "-35% 0px -50%", threshold: [0, 0.25, 0.6] });
    navSections.forEach((section) => navObserver.observe(section));
  }

  const interestData = {
    sound: {
      number: "01 / 05",
      icon: "♪",
      kicker: "最近循环",
      title: "声音是一种随身携带的天气",
      copy: "有些歌不是因为旋律被记住，而是它曾恰好陪我穿过一段路。这里以后会放下最近循环、现场记忆和私人歌单。",
      tags: ["最近循环", "歌单", "现场"],
      color: "#e86d4f"
    },
    film: {
      number: "02 / 05",
      icon: "◒",
      kicker: "电影与剧集",
      title: "借两小时，住进另一种人生",
      copy: "我喜欢那些结束后仍在心里继续发生的画面。以后这里会收录反复重看的作品、某句对白与看完那天的天气。",
      tags: ["电影", "剧集", "画面"],
      color: "#6f91a4"
    },
    book: {
      number: "03 / 05",
      icon: "⌇",
      kicker: "书页之间",
      title: "阅读是安静地扩大自己的边界",
      copy: "不是年度书单，而是一些真正留下痕迹的句子、观念和人物。数量可以很少，但每一本都应该有被记住的理由。",
      tags: ["在读", "划线", "重读"],
      color: "#778b72"
    },
    travel: {
      number: "04 / 05",
      icon: "⌁",
      kicker: "去过与想去",
      title: "远方让日常重新获得比例",
      copy: "地图不会只记录抵达过的城市，也会保存喜欢的街角、迷路的方向，以及那些还没有出发的念头。",
      tags: ["地图", "散步", "在路上"],
      color: "#d4ad45"
    },
    objects: {
      number: "05 / 05",
      icon: "◇",
      kicker: "私人收藏",
      title: "物件也有自己的微小传记",
      copy: "一张旧票根、一只常用的杯子、偶然捡到的石头。这里留给那些不昂贵，却因为陪伴而变得重要的东西。",
      tags: ["收藏", "旧物", "来历"],
      color: "#c98c83"
    }
  };

  const affinity = document.querySelector("[data-affinity]");
  const affinityStory = affinity?.querySelector(".affinity__story");
  document.querySelectorAll("[data-interest]").forEach((button) => {
    button.addEventListener("click", () => {
      const data = interestData[button.dataset.interest];
      if (!data) return;
      document.querySelectorAll("[data-interest]").forEach((item) => {
        const active = item === button;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-pressed", String(active));
      });
      affinity.style.setProperty("--interest", data.color);
      affinityStory.classList.add("is-changing");
      window.setTimeout(() => {
        affinity.querySelector("[data-interest-number]").textContent = data.number;
        affinity.querySelector("[data-interest-icon]").textContent = data.icon;
        affinity.querySelector("[data-interest-kicker]").textContent = data.kicker;
        affinity.querySelector("[data-interest-title]").textContent = data.title;
        affinity.querySelector("[data-interest-copy]").textContent = data.copy;
        affinity.querySelector("[data-interest-tags]").replaceChildren(...data.tags.map((tag) => {
          const span = document.createElement("span");
          span.textContent = tag;
          return span;
        }));
        affinityStory.classList.remove("is-changing");
      }, reducedMotion.matches ? 0 : 170);
    });
  });

  const fragments = [
    ["“希望我一直保留被小事打动的能力。”", "未归档想法 · 001"],
    ["“有些答案，要等生活走到那里才会出现。”", "路上想到 · 002"],
    ["“比起拥有很多，更想认真地喜欢一些。”", "偏爱记录 · 003"],
    ["“偶尔绕远路，也许只是为了遇见另一种风景。”", "散步备忘 · 004"],
    ["“不要急着把每一种感受都解释清楚。”", "夜间纸片 · 005"],
    ["“今天没有大事发生，但有一阵很好看的风。”", "生活切片 · 006"]
  ];
  let fragmentIndex = 0;
  const fragmentButton = document.querySelector("[data-fragment-button]");
  fragmentButton?.addEventListener("click", () => {
    let nextIndex = fragmentIndex;
    while (nextIndex === fragmentIndex) nextIndex = Math.floor(Math.random() * fragments.length);
    fragmentIndex = nextIndex;
    fragmentButton.classList.add("is-shuffling");
    document.querySelector("[data-fragment-text]").textContent = fragments[fragmentIndex][0];
    document.querySelector("[data-fragment-meta]").textContent = fragments[fragmentIndex][1];
    window.setTimeout(() => fragmentButton.classList.remove("is-shuffling"), 520);
  });

  const recordToggle = document.querySelector("[data-record-toggle]");
  recordToggle?.addEventListener("click", () => {
    const pressed = recordToggle.getAttribute("aria-pressed") !== "true";
    recordToggle.setAttribute("aria-pressed", String(pressed));
    recordToggle.querySelector("[data-record-label]").textContent = pressed ? "唱片正在安静旋转" : "让唱片转起来";
  });

  const dialog = document.querySelector("[data-photo-dialog]");
  const dialogTitle = dialog?.querySelector("[data-dialog-title]");
  const dialogCaption = dialog?.querySelector("[data-dialog-caption]");
  const dialogVisual = dialog?.querySelector("[data-dialog-visual]");
  const photoGradients = [
    "linear-gradient(145deg, #d8b269, #d87b62 45%, #789992 45%)",
    "linear-gradient(180deg, #8fb6bd, #cbd4bd 48%, #687c61 48%)",
    "linear-gradient(145deg, #d1b99a 0 48%, #4c655d 48% 54%, #8db1ae 54%)",
    "linear-gradient(90deg, #cf897d 0 48%, #efe2bc 48% 52%, #7e9996 52%)",
    "linear-gradient(145deg, #768c84, #91a69c 53%, #d5b15b 53%)"
  ];
  document.querySelectorAll("[data-photo]").forEach((photo, index) => {
    photo.addEventListener("click", () => {
      if (!dialog?.showModal) return;
      dialogTitle.textContent = photo.dataset.title;
      dialogCaption.textContent = photo.dataset.caption;
      dialogVisual.style.background = photoGradients[index] || photoGradients[0];
      dialog.showModal();
    });
  });
  dialog?.querySelector("[data-dialog-close]")?.addEventListener("click", () => dialog.close());
  dialog?.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  const copyButton = document.querySelector("[data-copy-contact]");
  copyButton?.addEventListener("click", async () => {
    const label = copyButton.querySelector("[data-copy-label]");
    const contact = copyButton.dataset.contact;
    try {
      await navigator.clipboard.writeText(contact);
      label.textContent = "邮箱已复制 ✓";
    } catch {
      label.textContent = contact;
    }
    window.setTimeout(() => { label.textContent = "复制邮箱"; }, 2400);
  });

  const secret = document.querySelector("[data-secret]");
  const secretMessage = document.querySelector("[data-secret-message]");
  secret?.addEventListener("click", () => {
    secretMessage.classList.toggle("is-visible");
  });

  if (!reducedMotion.matches && window.matchMedia("(pointer: fine)").matches) {
    const depthItems = [...document.querySelectorAll("[data-depth]")];
    const world = document.querySelector(".world");
    let pointerX = 0;
    let pointerY = 0;
    let frameRequested = false;
    world?.addEventListener("pointermove", (event) => {
      const bounds = world.getBoundingClientRect();
      pointerX = (event.clientX - bounds.left) / bounds.width - 0.5;
      pointerY = (event.clientY - bounds.top) / bounds.height - 0.5;
      if (frameRequested) return;
      frameRequested = true;
      window.requestAnimationFrame(() => {
        depthItems.forEach((item) => {
          const depth = Number(item.dataset.depth || 0.2);
          item.style.transform = `translate3d(${pointerX * 24 * depth}px, ${pointerY * 20 * depth}px, 0)`;
        });
        frameRequested = false;
      });
    });
    world?.addEventListener("pointerleave", () => {
      depthItems.forEach((item) => { item.style.transform = "translate3d(0, 0, 0)"; });
    });

    const cursor = document.querySelector("[data-cursor]");
    window.addEventListener("pointermove", (event) => {
      cursor.style.left = `${event.clientX}px`;
      cursor.style.top = `${event.clientY}px`;
      cursor.classList.add("is-visible");
    }, { passive: true });
    document.querySelectorAll("a, button").forEach((item) => {
      item.addEventListener("pointerenter", () => cursor.classList.add("is-hovering"));
      item.addEventListener("pointerleave", () => cursor.classList.remove("is-hovering"));
    });
  }
})();
