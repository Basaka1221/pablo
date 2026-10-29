/* ============================================================
   bits.js — 动效组件
   移植自 React Bits（https://www.reactbits.dev，MIT + Commons Clause）
   的免费组件，改写为无依赖的原生 DOM / Canvas 实现：
     SplitText · Aurora · CountUp · SpotlightCard · Magnetic
     Marquee · ScenePlayer
   全部离线运行，不加载任何外部资源。
   ============================================================ */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const REDUCE = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const FINE = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

/* ---------- 1. SplitText：字符级入场 ---------- */

function splitText(el) {
  if (REDUCE) {
    el.classList.add("st-ready");
    return;
  }
  const frag = document.createDocumentFragment();
  let i = 0;

  const walk = (node, target) => {
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType === 3) {
        const tokens =
          child.textContent.match(/[A-Za-z0-9]+[A-Za-z0-9.%+\-/]*|\s+|[\s\S]/g) ||
          [];
        tokens.forEach((tk) => {
          if (tk === "\n") return;
          if (/^\s+$/.test(tk)) {
            target.appendChild(document.createTextNode(" "));
            return;
          }
          const span = document.createElement("span");
          span.className = "st-char";
          span.style.setProperty("--i", i++);
          span.textContent = tk;
          target.appendChild(span);
        });
      } else if (child.nodeName === "BR") {
        target.appendChild(child.cloneNode(false));
      } else if (child.nodeType === 1) {
        const clone = child.cloneNode(false);
        walk(child, clone);
        target.appendChild(clone);
      }
    });
  };

  walk(el, frag);
  el.textContent = "";
  el.appendChild(frag);
}

function playSplitText(el, delay = 100) {
  window.setTimeout(() => el.classList.add("st-ready"), delay);
}

/* ---------- 2. Reveal：滚动入场 ---------- */

function initReveal() {
  const items = $$("[data-reveal]");
  if (!items.length) return;
  if (REDUCE || !("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("is-in"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("is-in");
          io.unobserve(e.target);
        }
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
  );
  items.forEach((el) => io.observe(el));
}

/* ---------- 3. CountUp：数字滚动 ---------- */

function initCountUp() {
  const nodes = $$("[data-count]");
  if (!nodes.length) return;

  const run = (el) => {
    const target = parseFloat(el.dataset.count);
    const dec = parseInt(el.dataset.decimals || "0", 10);
    const dur = 1400;
    if (REDUCE) {
      el.textContent = target.toFixed(dec);
      return;
    }
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = (target * eased).toFixed(dec);
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = target.toFixed(dec);
    };
    requestAnimationFrame(tick);
  };

  if (!("IntersectionObserver" in window)) {
    nodes.forEach(run);
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          run(e.target);
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.6 }
  );
  nodes.forEach((el) => io.observe(el));
}

/* ---------- 4. SpotlightCard：指针跟随光斑 ---------- */

function initSpotlight() {
  if (!FINE) return;
  $$("[data-spotlight]").forEach((card) => {
    card.addEventListener(
      "pointermove",
      (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${e.clientX - r.left}px`);
        card.style.setProperty("--my", `${e.clientY - r.top}px`);
      },
      { passive: true }
    );
  });
}

/* ---------- 5. Magnetic：磁吸按钮 ---------- */

function initMagnetic() {
  if (!FINE || REDUCE) return;
  $$("[data-magnetic]").forEach((el) => {
    const strength = 8;
    let raf = null;
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const dx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      const dy = ((e.clientY - r.top) / r.height - 0.5) * 2;
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.transform = `translate(${dx * strength}px, ${dy * strength * 0.5}px)`;
      });
    });
    el.addEventListener("pointerleave", () => {
      if (raf) cancelAnimationFrame(raf);
      el.style.transform = "";
    });
  });
}

/* ---------- 6. Marquee：无缝跑马灯 ---------- */

function initMarquee() {
  $$("[data-marquee]").forEach((box) => {
    const track = $(".marquee__track", box);
    if (!track) return;
    const set = Array.from(track.children);
    if (!set.length) return;
    let copies = 2;
    const need = () => box.clientWidth * 2;
    while (track.scrollWidth < need() && copies < 8) {
      set.forEach((n) => track.appendChild(n.cloneNode(true)));
      copies += 1;
    }
    if (copies % 2 !== 0) {
      set.forEach((n) => track.appendChild(n.cloneNode(true)));
    }
    if (REDUCE) track.style.animation = "none";
  });
}

/* ---------- 7. Aurora：Hero 背景光场 ---------- */

class Aurora {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext("2d");
    this.t = 0;
    this.raf = null;
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    this.blobs = [
      { c: "rgba(21,94,239,0.55)", r: 0.46, x: 0.24, y: 0.62, sx: 0.11, sy: 0.07, sp: 0.06 },
      { c: "rgba(120,148,180,0.22)", r: 0.34, x: 0.72, y: 0.34, sx: 0.09, sy: 0.1, sp: 0.045 },
      { c: "rgba(11,61,168,0.5)", r: 0.5, x: 0.86, y: 0.78, sx: 0.13, sy: 0.06, sp: 0.033 },
      { c: "rgba(210,220,232,0.1)", r: 0.24, x: 0.5, y: 0.18, sx: 0.07, sy: 0.09, sp: 0.08 },
    ];
    this.resize = this.resize.bind(this);
    this.loop = this.loop.bind(this);
    this.resize();

    if ("ResizeObserver" in window) {
      new ResizeObserver(this.resize).observe(canvas);
    } else {
      window.addEventListener("resize", this.resize);
    }
    if (REDUCE) {
      this.draw(0);
      return;
    }
    // 只在真正可见时跑 rAF，避免后台空转
    this.visible = true;
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(
        (es) => {
          es.forEach((e) => {
            this.visible = e.isIntersecting;
            this.visible ? this.start() : this.stop();
          });
        },
        { threshold: 0 }
      ).observe(canvas);
    }
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.stop();
      else if (this.visible) this.start();
    });
    this.start();
  }

  resize() {
    const r = this.cv.getBoundingClientRect();
    if (!r.width) return;
    this.w = r.width;
    this.h = r.height;
    this.cv.width = Math.round(r.width * this.dpr);
    this.cv.height = Math.round(r.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (REDUCE) this.draw(this.t);
  }

  start() {
    if (REDUCE || this.raf) return;
    this.raf = requestAnimationFrame(this.loop);
  }

  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
  }

  loop(now) {
    this.raf = requestAnimationFrame(this.loop);
    this.t = now / 1000;
    this.draw(this.t);
  }

  draw(t) {
    const { ctx, w, h } = this;
    if (!w || !h) return;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#0d0e10";
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "lighter";
    const base = Math.max(w, h);
    this.blobs.forEach((b) => {
      const x = (b.x + Math.sin(t * b.sp) * b.sx) * w;
      const y = (b.y + Math.cos(t * b.sp * 1.3) * b.sy) * h;
      const rad = b.r * base * (1 + Math.sin(t * b.sp * 2) * 0.05);
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, b.c);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
    });
    // 钢板反光扫过
    const sweep = ((t * 0.08) % 1.6) - 0.3;
    const gx = sweep * w;
    const lg = ctx.createLinearGradient(gx - 120, 0, gx + 120, h);
    lg.addColorStop(0, "rgba(255,255,255,0)");
    lg.addColorStop(0.5, "rgba(214,224,236,0.16)");
    lg.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = lg;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "source-over";
  }
}

/* ---------- 8. ScenePlayer：结构演示播放器 ---------- */

class ScenePlayer {
  constructor(root) {
    this.root = root;
    this.cv = $("canvas", root);
    this.ctx = this.cv.getContext("2d");
    this.duration = 20;
    this.time = 0;
    this.playing = false;
    this.last = 0;
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    this.scaleMul = 1;
    this.captions = [
      { at: 0, label: "01 现场测量", note: "毫米级复尺" },
      { at: 5, label: "02 结构拆单", note: "柜体分件建模" },
      { at: 10, label: "03 工厂成型", note: "激光下料 / 折弯" },
      { at: 15, label: "04 现场安装", note: "无尘拼装" },
    ];
    this.cap = $("[data-player-caption]", root.parentElement) || null;
    this.seek = $("[data-player-seek]", root.parentElement);
    this.timeEl = $("[data-player-time]", root.parentElement);
    this.btn = $("[data-player-toggle]", root.parentElement);

    this.resize = this.resize.bind(this);
    this.frame = this.frame.bind(this);
    this.resize();
    if ("ResizeObserver" in window) new ResizeObserver(this.resize).observe(this.cv);
    else window.addEventListener("resize", this.resize);

    this.bind();
    this.render(0);
    this.updateUI();
  }

  resize() {
    const r = this.cv.getBoundingClientRect();
    if (!r.width) return;
    this.w = r.width;
    this.h = r.height;
    this.cv.width = Math.round(r.width * this.dpr);
    this.cv.height = Math.round(r.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.render(this.time);
  }

  bind() {
    if (this.btn) {
      this.btn.addEventListener("click", () => (this.playing ? this.pause() : this.play()));
    }
    if (this.seek) {
      this.seek.max = String(this.duration);
      this.seek.addEventListener("input", () => {
        this.time = parseFloat(this.seek.value);
        this.render(this.time);
        this.updateUI();
      });
    }
    const pre = $("[data-player-full]", this.root.parentElement);
    if (pre) {
      pre.addEventListener("click", () => {
        const box = this.root.closest(".player");
        if (!box) return;
        if (document.fullscreenElement) document.exitFullscreen();
        else if (box.requestFullscreen) box.requestFullscreen();
      });
    }
    this.cv.addEventListener("click", () => (this.playing ? this.pause() : this.play()));
  }

  play() {
    this.playing = true;
    this.last = performance.now();
    this.btn && this.btn.setAttribute("data-state", "playing");
    this.btn && (this.btn.setAttribute("aria-label", "暂停"));
    this.raf = requestAnimationFrame(this.frame);
  }

  pause() {
    this.playing = false;
    cancelAnimationFrame(this.raf);
    this.btn && this.btn.setAttribute("data-state", "paused");
    this.btn && (this.btn.setAttribute("aria-label", "播放"));
  }

  frame(now) {
    const dt = Math.min(0.06, (now - this.last) / 1000);
    this.last = now;
    this.time += dt;
    if (this.time >= this.duration) this.time = 0;
    this.render(this.time);
    this.updateUI();
    if (this.playing) this.raf = requestAnimationFrame(this.frame);
  }

  updateUI() {
    if (this.seek) this.seek.value = String(this.time);
    if (this.timeEl) {
      const f = (s) =>
        `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(
          Math.floor(s % 60)
        ).padStart(2, "0")}`;
      this.timeEl.textContent = `${f(this.time)} / ${f(this.duration)}`;
    }
    if (this.cap) {
      const c = [...this.captions].reverse().find((x) => this.time >= x.at);
      this.cap.textContent = `${c.label} · ${c.note}`;
    }
  }

  project(p, rot, cx, cy) {
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const x = p.x * cos - p.z * sin;
    const z = p.x * sin + p.z * cos;
    const d = 780;
    const s = (d / (d + z + 640)) * this.scaleMul;
    return { x: cx + x * s, y: cy + p.y * s, s };
  }

  render(t) {
    const { ctx, w, h } = this;
    if (!w || !h) return;
    ctx.clearRect(0, 0, w, h);

    // 背景
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, "#101215");
    bg.addColorStop(1, "#0a0b0d");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h * 0.5;
    this.scaleMul = Math.min(w / 560, h / 400);
    const rot = -0.52 + Math.sin(t * 0.18) * 0.22;

    // 地面网格
    ctx.strokeStyle = "rgba(198,203,209,0.10)";
    ctx.lineWidth = 1;
    for (let i = -4; i <= 4; i++) {
      const a = this.project({ x: i * 90, y: 0, z: -220 }, rot, cx, cy);
      const b = this.project({ x: i * 90, y: 0, z: 220 }, rot, cx, cy);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      const c = this.project({ x: -380, y: 0, z: i * 55 }, rot, cx, cy);
      const d = this.project({ x: 380, y: 0, z: i * 55 }, rot, cx, cy);
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.stroke();
    }

    const W = 150;
    const H = 190;
    const D = 70;

    // 柜体框架
    const v = {
      a: [-W, -H, -D],
      b: [W, -H, -D],
      c: [W, 0, -D],
      d: [-W, 0, -D],
      e: [-W, -H, D],
      f: [W, -H, D],
      g: [W, 0, D],
      h: [-W, 0, D],
    };
    const P = (k) =>
      this.project({ x: v[k][0], y: v[k][1], z: v[k][2] }, rot, cx, cy);

    const edges = [
      ["a", "b"], ["b", "c"], ["c", "d"], ["d", "a"],
      ["e", "f"], ["f", "g"], ["g", "h"], ["h", "e"],
      ["a", "e"], ["b", "f"], ["c", "g"], ["d", "h"],
    ];

    // 分阶段显现
    const phase = Math.min(3, Math.floor(t / 5));
    const localP = (t % 5) / 5;
    ctx.lineCap = "round";

    edges.forEach(([p, q], idx) => {
      const on = idx < 8 ? phase >= 1 : phase >= 2 || localP > 0.4;
      const A = P(p);
      const B = P(q);
      ctx.beginPath();
      ctx.strokeStyle = on
        ? `rgba(233,235,237,${0.34 + 0.3 * localP})`
        : "rgba(233,235,237,0.10)";
      ctx.lineWidth = on ? 1.4 : 1;
      ctx.moveTo(A.x, A.y);
      ctx.lineTo(B.x, B.y);
      ctx.stroke();
    });

    // 层板
    const shelves = [-H / 3, (-H * 2) / 3];
    shelves.forEach((y, i) => {
      const on = phase >= 2 || localP > 0.6;
      ctx.beginPath();
      ctx.strokeStyle = on
        ? `rgba(21,94,239,${0.55 + 0.35 * Math.sin(t * 1.6 + i)})`
        : "rgba(21,94,239,0.14)";
      ctx.lineWidth = on ? 1.6 : 1;
      const p1 = this.project({ x: -W, y, z: -D }, rot, cx, cy);
      const p2 = this.project({ x: W, y, z: -D }, rot, cx, cy);
      const p3 = this.project({ x: W, y, z: D }, rot, cx, cy);
      const p4 = this.project({ x: -W, y, z: D }, rot, cx, cy);
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.lineTo(p4.x, p4.y);
      ctx.closePath();
      ctx.stroke();
    });

    // 门缝
    if (phase >= 2) {
      ctx.beginPath();
      ctx.strokeStyle = "rgba(198,203,209,0.5)";
      ctx.lineWidth = 1;
      const t1 = this.project({ x: 0, y: -H, z: -D }, rot, cx, cy);
      const t2 = this.project({ x: 0, y: 0, z: -D }, rot, cx, cy);
      ctx.moveTo(t1.x, t1.y);
      ctx.lineTo(t2.x, t2.y);
      ctx.stroke();
    }

    // 安装高亮角标
    if (phase >= 3) {
      const g = P("c");
      const r = 16 * (0.9 + Math.sin(t * 3) * 0.12);
      ctx.beginPath();
      ctx.strokeStyle = "rgba(21,94,239,0.85)";
      ctx.lineWidth = 1.2;
      ctx.arc(g.x, g.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 刻度尺 HUD
    ctx.fillStyle = "rgba(244,244,242,0.34)";
    ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText("600mm", 26, h - 26);
    ctx.fillText("2200mm", 26, 74);
    ctx.strokeStyle = "rgba(244,244,242,0.18)";
    ctx.beginPath();
    ctx.moveTo(21, 82);
    ctx.lineTo(21, h - 34);
    ctx.stroke();
    for (let i = 0; i <= 6; i++) {
      const y = 82 + ((h - 116) / 6) * i;
      ctx.beginPath();
      ctx.moveTo(18, y);
      ctx.lineTo(21, y);
      ctx.stroke();
    }

    // 进度弧
    const prog = t / this.duration;
    ctx.strokeStyle = "rgba(21,94,239,0.75)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(w - 40, h - 40, 18, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(244,244,242,0.14)";
    ctx.beginPath();
    ctx.arc(w - 40, h - 40, 18, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/* ---------- 启动 ---------- */

function initBits() {
  const heroTitle = $("[data-split]");
  if (heroTitle) {
    splitText(heroTitle);
    playSplitText(heroTitle, 180);
  }
  $$("[data-split-late]").forEach((el, i) => {
    splitText(el);
    playSplitText(el, 420 + i * 180);
  });

  const heroCanvas = $("[data-aurora]");
  if (heroCanvas) new Aurora(heroCanvas);

  initReveal();
  initCountUp();
  initSpotlight();
  initMagnetic();
  initMarquee();

  const playerRoot = $("[data-player]");
  if (playerRoot) window.__player = new ScenePlayer(playerRoot);
}

document.addEventListener("DOMContentLoaded", initBits);
