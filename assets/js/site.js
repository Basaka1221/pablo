/* ============================================================
   site.js — 站点交互（无依赖）
   导航吸顶 / 移动抽屉 / 手风琴 / 场景 Tabs / 案例筛选 / 表单校验
   ============================================================ */

(function () {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ---------- 顶部导航吸顶 ---------- */

  const header = $(".header");
  if (header) {
    const onScroll = () => {
      header.classList.toggle("is-stuck", window.scrollY > 24);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---------- 移动端抽屉 ---------- */

  const burger = $("[data-burger]");
  const drawer = $("[data-drawer]");
  if (burger && drawer) {
    const links = $$("a", drawer);
    const setOpen = (open) => {
      burger.setAttribute("aria-expanded", String(open));
      drawer.classList.toggle("is-open", open);
      drawer.setAttribute("aria-hidden", String(!open));
      document.body.style.overflow = open ? "hidden" : "";
      if (open) links[0] && links[0].focus();
      else burger.focus();
    };
    burger.addEventListener("click", () =>
      setOpen(burger.getAttribute("aria-expanded") !== "true")
    );
    links.forEach((a) => a.addEventListener("click", () => setOpen(false)));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && drawer.classList.contains("is-open")) setOpen(false);
    });
    window.addEventListener("resize", () => {
      if (window.innerWidth > 900 && drawer.classList.contains("is-open")) setOpen(false);
    });
  }

  /* ---------- 手风琴（流程步骤 / FAQ 共用） ---------- */

  $$("[data-accordion]").forEach((group) => {
    const single = group.dataset.accordion === "single";
    const heads = $$("[data-acc-head]", group);

    const close = (head) => {
      const panel = document.getElementById(head.getAttribute("aria-controls"));
      head.setAttribute("aria-expanded", "false");
      if (panel) {
        panel.style.height = panel.scrollHeight + "px";
        requestAnimationFrame(() => {
          panel.style.height = "0px";
        });
      }
    };
    const open = (head) => {
      const panel = document.getElementById(head.getAttribute("aria-controls"));
      head.setAttribute("aria-expanded", "true");
      if (panel) {
        panel.style.height = panel.scrollHeight + "px";
        const done = () => {
          panel.style.height = "auto";
          panel.removeEventListener("transitionend", done);
        };
        panel.addEventListener("transitionend", done);
      }
    };

    heads.forEach((head) => {
      head.addEventListener("click", () => {
        const isOpen = head.getAttribute("aria-expanded") === "true";
        if (single) {
          heads.forEach((h) => {
            if (h !== head && h.getAttribute("aria-expanded") === "true") close(h);
          });
        }
        isOpen ? close(head) : open(head);
      });
    });

    // 默认展开第一项 / 指定项
    const first =
      $("[data-acc-open]", group) || (group.dataset.accordion === "single" ? heads[0] : null);
    if (first) {
      const panel = document.getElementById(first.getAttribute("aria-controls"));
      first.setAttribute("aria-expanded", "true");
      if (panel) panel.style.height = "auto";
    }
  });

  /* ---------- 场景 Tabs ---------- */

  $$("[data-tabs]").forEach((wrap) => {
    const tabs = $$("[role='tab']", wrap);
    const panels = $$("[role='tabpanel']", wrap);
    if (!tabs.length) return;

    const select = (idx, focus = false) => {
      tabs.forEach((t, i) => {
        const on = i === idx;
        t.setAttribute("aria-selected", String(on));
        t.setAttribute("tabindex", on ? "0" : "-1");
        if (on && focus) t.focus();
      });
      panels.forEach((p, i) => {
        p.hidden = i !== idx;
      });
    };

    tabs.forEach((tab, i) => {
      tab.addEventListener("click", () => select(i));
      tab.addEventListener("keydown", (e) => {
        const last = tabs.length - 1;
        let next = null;
        if (e.key === "ArrowDown" || e.key === "ArrowRight") next = i === last ? 0 : i + 1;
        if (e.key === "ArrowUp" || e.key === "ArrowLeft") next = i === 0 ? last : i - 1;
        if (e.key === "Home") next = 0;
        if (e.key === "End") next = last;
        if (next !== null) {
          e.preventDefault();
          select(next, true);
        }
      });
    });

    const initial = tabs.findIndex((t) => t.getAttribute("aria-selected") === "true");
    select(initial < 0 ? 0 : initial);
  });

  /* ---------- 案例筛选 ---------- */

  const filterWrap = $("[data-filters]");
  if (filterWrap) {
    const chips = $$("[data-filter]", filterWrap);
    const items = $$("[data-cat]");
    const empty = $("[data-empty]");

    const apply = (key) => {
      let shown = 0;
      items.forEach((item) => {
        const hit = key === "all" || item.dataset.cat === key;
        item.hidden = !hit;
        if (hit) shown += 1;
      });
      chips.forEach((c) =>
        c.setAttribute("aria-pressed", String(c.dataset.filter === key))
      );
      if (empty) empty.classList.toggle("is-on", shown === 0);
    };

    chips.forEach((chip) => {
      chip.addEventListener("click", () => apply(chip.dataset.filter));
    });
    apply("all");
  }

  /* ---------- 表单校验（备用：当前首页已改为外链，保留以便恢复表单） ---------- */

  const form = $("[data-lead-form]");
  if (form) {
    const success = $("[data-form-success]");
    const rules = {
      name: (v) => (v.trim().length >= 2 ? "" : "请填写称呼，至少 2 个字"),
      phone: (v) =>
        /^1[3-9]\d{9}$/.test(v.trim().replace(/[\s-]/g, "")) ? "" : "请输入 11 位手机号",
      scene: (v) => (v ? "" : "请选择想做的空间"),
    };

    const fieldOf = (input) => input.closest(".field");

    const validate = (input) => {
      const rule = rules[input.name];
      if (!rule) return true;
      const msg = rule(input.value);
      const field = fieldOf(input);
      field.dataset.invalid = String(!!msg);
      input.setAttribute("aria-invalid", msg ? "true" : "false");
      const err = $(".field__err", field);
      if (err) err.textContent = msg;
      return !msg;
    };

    form.addEventListener("input", (e) => {
      if (e.target.matches("input, select, textarea")) {
        if (fieldOf(e.target).dataset.invalid === "true") validate(e.target);
      }
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const fields = $$("input[name], select[name]", form);
      const bad = fields.filter((f) => !validate(f));
      if (bad.length) {
        bad[0].focus();
        return;
      }
      const btn = $("button[type='submit']", form);
      btn.disabled = true;
      btn.dataset.loading = "true";
      const label = btn.querySelector("[data-btn-label]");
      const old = label ? label.textContent : "";
      if (label) label.textContent = "提交中";

      // 演示环境：本地模拟提交，不发送任何数据
      window.setTimeout(() => {
        btn.disabled = false;
        btn.dataset.loading = "false";
        if (label) label.textContent = old;
        form.reset();
        if (success) {
          success.classList.add("is-on");
          success.setAttribute("tabindex", "-1");
          success.focus({ preventScroll: false });
        }
      }, 700);
    });
  }

  /* ---------- 年份 ---------- */

  $$("[data-year]").forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });
})();
