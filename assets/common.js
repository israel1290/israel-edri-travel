// קוד משותף לכל העמודים הציבוריים: כותרת, תפריט, נגישות, מעקב לחיצות והודעות קצרות
(function () {
  const root = document.documentElement;
  root.classList.add("js");
  const $ = (s, el = document) => el.querySelector(s);
  const CFG = window.SITE_CONFIG || {};

  // ---------- שמירה מקומית בטוחה ----------
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} }
  };

  // ---------- Supabase (REST, בלי ספרייה) ----------
  const db = {
    ready: !!(CFG.supabaseUrl && CFG.supabaseAnonKey),
    headers() {
      return { apikey: CFG.supabaseAnonKey, Authorization: "Bearer " + CFG.supabaseAnonKey, "Content-Type": "application/json" };
    },
    async insert(table, row) {
      if (!this.ready) throw new Error("not-configured");
      const r = await fetch(CFG.supabaseUrl + "/rest/v1/" + table, {
        method: "POST", headers: { ...this.headers(), Prefer: "return=minimal" }, body: JSON.stringify(row), keepalive: true
      });
      if (!r.ok) throw new Error("http-" + r.status);
    },
    async select(path) {
      if (!this.ready) throw new Error("not-configured");
      const r = await fetch(CFG.supabaseUrl + "/rest/v1/" + path, { headers: this.headers() });
      if (!r.ok) throw new Error("http-" + r.status);
      return r.json();
    }
  };

  function track(type) {
    if (!db.ready) return;
    db.insert("events", { type, page: location.pathname.slice(0, 120), ref: (document.referrer || "").slice(0, 200) || null }).catch(() => {});
  }

  // ---------- הודעה קצרה ----------
  let toastTimer;
  function toast(text) {
    let el = $("#toast");
    if (!el) { el = document.createElement("div"); el.id = "toast"; el.className = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    el.textContent = text; el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => (el.hidden = true), 2600);
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // ---------- כותרת שהופכת לאטומה בגלילה ----------
  const head = $(".site-head");
  if (head && !head.classList.contains("static")) {
    const onScroll = () => head.classList.toggle("solid", window.scrollY > 40 || $("#nav")?.classList.contains("open"));
    addEventListener("scroll", onScroll, { passive: true }); onScroll();
  }

  // ---------- תפריט נייד ----------
  const menuBtn = $("#menuBtn"), nav = $("#nav");
  if (menuBtn && nav) {
    const setMenu = open => {
      nav.classList.toggle("open", open); menuBtn.setAttribute("aria-expanded", open);
      head && head.classList.toggle("solid", open || window.scrollY > 40);
    };
    menuBtn.addEventListener("click", () => setMenu(!nav.classList.contains("open")));
    nav.addEventListener("click", e => { if (e.target.closest("a")) setMenu(false); });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && nav.classList.contains("open")) { setMenu(false); menuBtn.focus(); } });
  }

  // ---------- נגישות ----------
  const A11Y = [
    { id: "hc", label: "ניגודיות גבוהה" },
    { id: "links", label: "הדגשת קישורים" },
    { id: "readable", label: "גופן קריא" },
    { id: "still", label: "עצירת אנימציות" }
  ];
  let scale = parseFloat(store.get("a11y-scale")) || 1;
  const applyScale = () => root.style.setProperty("--scale", scale);
  A11Y.forEach(o => { if (store.get("a11y-" + o.id)) root.classList.add(o.id); });
  applyScale();

  const a11yBtn = $("#a11yBtn");
  if (a11yBtn) {
    const panel = document.createElement("div");
    panel.className = "a11y-panel"; panel.id = "a11yPanel"; panel.hidden = true;
    panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", "הגדרות נגישות");
    const base = a11yBtn.dataset.base || "./";
    panel.innerHTML = `<h2>הגדרות נגישות</h2>
      <div class="a11y-grid">
        <button type="button" data-scale="up">הגדלת טקסט <span aria-hidden="true">א+</span></button>
        <button type="button" data-scale="down">הקטנת טקסט <span aria-hidden="true">א−</span></button>
        ${A11Y.map(o => `<button type="button" data-toggle="${o.id}" aria-pressed="${root.classList.contains(o.id)}">${o.label}</button>`).join("")}
      </div>
      <div class="a11y-foot"><a href="${base}accessibility.html">הצהרת נגישות</a><button type="button" data-reset>איפוס הגדרות</button></div>`;
    document.body.appendChild(panel);
    const close = (focusBtn) => { panel.hidden = true; a11yBtn.setAttribute("aria-expanded", "false"); if (focusBtn) a11yBtn.focus(); };
    a11yBtn.addEventListener("click", () => {
      const open = panel.hidden; panel.hidden = !open; a11yBtn.setAttribute("aria-expanded", open);
      if (open) panel.querySelector("button").focus();
    });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && !panel.hidden) close(true); });
    document.addEventListener("click", e => { if (!panel.hidden && !panel.contains(e.target) && !a11yBtn.contains(e.target)) close(false); });
    panel.addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.scale) {
        scale = Math.min(1.6, Math.max(0.9, Math.round((scale + (b.dataset.scale === "up" ? 0.1 : -0.1)) * 10) / 10));
        applyScale(); store.set("a11y-scale", scale === 1 ? null : scale);
        toast("גודל טקסט: " + Math.round(scale * 100) + "%");
      } else if (b.dataset.toggle) {
        const on = root.classList.toggle(b.dataset.toggle);
        b.setAttribute("aria-pressed", on); store.set("a11y-" + b.dataset.toggle, on ? "1" : null);
      } else if (b.hasAttribute("data-reset")) {
        A11Y.forEach(o => { root.classList.remove(o.id); store.set("a11y-" + o.id, null); });
        panel.querySelectorAll("[data-toggle]").forEach(x => x.setAttribute("aria-pressed", "false"));
        scale = 1; applyScale(); store.set("a11y-scale", null); toast("ההגדרות אופסו");
      }
    });
  }

  // ---------- מעקב לחיצות ----------
  document.addEventListener("click", e => {
    const a = e.target.closest("[data-track]"); if (a) track(a.dataset.track);
  });
  try {
    if (!sessionStorage.getItem("v")) { sessionStorage.setItem("v", "1"); track("visit"); }
  } catch (e) {}

  // ---------- העתקת מספר ----------
  document.querySelectorAll("[data-copy]").forEach(b => b.addEventListener("click", () => {
    const fallback = () => { const t = $(b.dataset.copyTarget || ".big-phone"); if (t) getSelection().selectAllChildren(t); toast("המספר מסומן, אפשר להעתיק"); };
    try { navigator.clipboard.writeText(b.dataset.copy).then(() => toast("המספר הועתק"), fallback); } catch (e) { fallback(); }
  }));

  const y = $("#year"); if (y) y.textContent = new Date().getFullYear();

  window.SITE = { $, db, track, toast, esc, store, CFG };
})();
