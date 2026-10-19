// איזור ניהול: כניסה עם Supabase Auth, צפייה בפניות, סטטיסטיקה ועריכת יעדים.
// ההגנה האמיתית היא בהרשאות (RLS) במסד הנתונים: בלי משתמש מנהל מחובר אי אפשר לקרוא שום פנייה.
(function () {
  const CFG = window.SITE_CONFIG || {};
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const STATUS = { new: "חדשה", in_progress: "בטיפול", closed: "נסגרה עסקה", cancelled: "לא רלוונטי" };

  let toastTimer;
  function toast(t) { const el = $("#toast"); el.textContent = t; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => (el.hidden = true), 2400); }

  if (!CFG.supabaseUrl || !CFG.supabaseAnonKey || !window.supabase) {
    document.body.innerHTML = `<div class="setup"><h1>הדף אינו זמין כרגע</h1></div>`;
    return;
  }
  const sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true } });

  let LEADS = [], DESTS = [], EVENTS = [];

  // ---------- כניסה ----------
  async function boot() {
    const { data } = await sb.auth.getSession();
    if (data.session && await isAdmin()) return enter();
    if (data.session) await sb.auth.signOut();
    $("#login").hidden = false; $("#email").focus();
  }
  async function isAdmin() {
    const { data, error } = await sb.rpc("is_admin");
    return !error && data === true;
  }
  $("#loginForm").addEventListener("submit", async e => {
    e.preventDefault();
    const btn = $("#loginBtn"), msg = $("#loginMsg");
    const email = $("#email").value.trim(), password = $("#password").value;
    if (!email || !password) { msg.textContent = "צריך למלא אימייל וסיסמה."; return; }
    btn.disabled = true; msg.textContent = "";
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) { btn.disabled = false; msg.textContent = "האימייל או הסיסמה לא נכונים."; $("#password").select(); return; }
    if (!(await isAdmin())) { await sb.auth.signOut(); btn.disabled = false; msg.textContent = "לחשבון הזה אין הרשאת ניהול."; return; }
    $("#password").value = ""; btn.disabled = false; enter();
  });
  $("#logout").addEventListener("click", async () => { await sb.auth.signOut(); location.reload(); });

  async function enter() {
    $("#login").hidden = true; $("#app").hidden = false; document.title = "ניהול · ישראל אדרי";
    await loadAll();
  }

  // ---------- טעינת נתונים ----------
  async function loadAll() {
    const since = new Date(Date.now() - 30 * 864e5).toISOString();
    const [l, d, ev] = await Promise.all([
      sb.from("leads").select("*").order("created_at", { ascending: false }).limit(2000),
      sb.from("destinations").select("*").order("sort", { ascending: true }).order("id", { ascending: true }),
      sb.from("events").select("type,created_at").gte("created_at", since).limit(20000)
    ]);
    if (l.error || d.error || ev.error) {
      const err = l.error || d.error || ev.error;
      if (/JWT|auth/i.test(err.message)) { await sb.auth.signOut(); location.reload(); return; }
      toast("שגיאה בטעינת הנתונים: " + err.message);
    }
    LEADS = l.data || []; DESTS = d.data || []; EVENTS = ev.data || [];
    renderOverview(); renderLeads(); renderDests();
  }
  $("#refresh").addEventListener("click", async () => { await loadAll(); toast("הנתונים עודכנו"); });
  setInterval(() => { if (!document.hidden && !$("#app").hidden && !document.activeElement.closest?.("#destRows, #leadRows")) loadAll(); }, 120000);

  // ---------- לשוניות ----------
  document.querySelector(".tabs").addEventListener("click", e => {
    const b = e.target.closest("button[data-view]"); if (!b) return;
    document.querySelectorAll(".tabs button").forEach(x => x.setAttribute("aria-pressed", x === b));
    document.querySelectorAll(".view").forEach(v => (v.hidden = v.id !== "v-" + b.dataset.view));
  });

  const dt = s => new Date(s).toLocaleString("he-IL", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  const d8 = s => s ? s.split("-").reverse().join("/") : "";
  const intlPhone = p => { const n = String(p).replace(/\D/g, ""); return n.startsWith("0") ? "972" + n.slice(1) : n; };

  // ---------- סקירה ----------
  function renderOverview() {
    const now = Date.now(), d30 = now - 30 * 864e5, d7 = now - 7 * 864e5;
    const newCount = LEADS.filter(x => x.status === "new").length;
    const l30 = LEADS.filter(x => +new Date(x.created_at) >= d30);
    const count = t => EVENTS.filter(e => e.type === t).length;
    const visits = count("visit"), wa = count("whatsapp_click"), calls = count("call_click");
    const closed30 = l30.filter(x => x.status === "closed").length;
    const kpis = [
      { v: newCount, t: "פניות חדשות שמחכות", alert: newCount > 0 },
      { v: LEADS.filter(x => +new Date(x.created_at) >= d7).length, t: "פניות ב-7 ימים" },
      { v: l30.length, t: "פניות ב-30 יום" },
      { v: closed30, t: "עסקאות שנסגרו ב-30 יום" },
      { v: visits, t: "ביקורים ב-30 יום" },
      { v: wa, t: "לחיצות וואטסאפ ב-30 יום" },
      { v: calls, t: "לחיצות חיוג ב-30 יום" }
    ];
    $("#kpis").innerHTML = kpis.map(k => `<div class="kpi${k.alert ? " alert" : ""}"><b>${k.v.toLocaleString("he-IL")}</b><span>${k.t}</span></div>`).join("");
    const badge = $("#newBadge"); badge.hidden = !newCount; badge.textContent = newCount;

    const tally = {};
    l30.forEach(x => { const k = (x.destination || "").trim(); if (k) tally[k] = (tally[k] || 0) + 1; });
    const top = Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 8);
    $("#topDests").innerHTML = top.length ? top.map(([k, n]) => `<li><span>${esc(k)}</span><b>${n}</b></li>`).join("") : `<li class="empty">עוד אין פניות בחודש האחרון.</li>`;
    $("#recent").innerHTML = LEADS.slice(0, 6).map(x => `<li><span><b>${esc(x.name)}</b> · ${esc(x.destination)}<br><small>${dt(x.created_at)}</small></span><span class="status st-${esc(x.status)}">${STATUS[x.status] || esc(x.status)}</span></li>`).join("") || `<li class="empty">עוד אין פניות.</li>`;
  }

  // ---------- פניות ----------
  function filteredLeads() {
    const q = $("#q").value.trim().toLowerCase(), st = $("#fStatus").value;
    return LEADS.filter(x => (!st || x.status === st) &&
      (!q || [x.name, x.phone, x.destination, x.admin_note].some(v => String(v || "").toLowerCase().includes(q))));
  }
  function renderLeads() {
    const list = filteredLeads();
    $("#leadRows").innerHTML = list.length ? list.map(x => `<tr data-id="${x.id}" class="${x.status === "new" ? "is-new" : ""}">
      <td class="when">${dt(x.created_at)}</td>
      <td><b>${esc(x.name)}</b><br><span class="phone">${esc(x.phone)}</span></td>
      <td>${esc(x.origin || "")} ← <b>${esc(x.destination)}</b><br><small>${esc(x.trip_type || "")}</small></td>
      <td class="when">${d8(x.depart_date)}${x.return_date ? "<br>" + d8(x.return_date) : ""}</td>
      <td>${esc(x.passengers || "")}</td>
      <td><select data-f="status" aria-label="סטטוס">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}"${k === x.status ? " selected" : ""}>${v}</option>`).join("")}</select></td>
      <td><textarea data-f="admin_note" rows="2" aria-label="הערה פנימית" maxlength="1000">${esc(x.admin_note || "")}</textarea></td>
      <td><div class="acts">
        <a class="btn small" href="https://wa.me/${esc(intlPhone(x.phone))}" target="_blank" rel="noopener">וואטסאפ</a>
        <a class="btn small" href="tel:${esc(String(x.phone).replace(/[^\d+]/g, ""))}">חיוג</a>
        <button type="button" class="btn small danger" data-del>מחיקה</button>
      </div></td></tr>`).join("") : `<tr><td colspan="8" class="empty">אין פניות להצגה.</td></tr>`;
    $("#leadCount").textContent = `מוצגות ${list.length} מתוך ${LEADS.length} פניות.`;
  }
  $("#q").addEventListener("input", renderLeads);
  $("#fStatus").addEventListener("change", renderLeads);

  async function updateLead(id, patch) {
    const { error } = await sb.from("leads").update(patch).eq("id", id);
    if (error) { toast("השמירה נכשלה: " + error.message); return false; }
    Object.assign(LEADS.find(x => x.id === id), patch); renderOverview(); toast("נשמר"); return true;
  }
  $("#leadRows").addEventListener("change", async e => {
    const tr = e.target.closest("tr[data-id]"); if (!tr || !e.target.dataset.f) return;
    const id = +tr.dataset.id, f = e.target.dataset.f;
    if (await updateLead(id, { [f]: e.target.value || null }) && f === "status") tr.classList.toggle("is-new", e.target.value === "new");
  });
  $("#leadRows").addEventListener("click", async e => {
    const b = e.target.closest("[data-del]"); if (!b) return;
    if (!b.dataset.armed) { b.dataset.armed = "1"; b.textContent = "בטוח? למחוק"; setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.textContent = "מחיקה"; } }, 4000); return; }
    const id = +b.closest("tr").dataset.id;
    const { error } = await sb.from("leads").delete().eq("id", id);
    if (error) return toast("המחיקה נכשלה: " + error.message);
    LEADS = LEADS.filter(x => x.id !== id); renderLeads(); renderOverview(); toast("הפנייה נמחקה");
  });

  $("#csv").addEventListener("click", () => {
    const cols = [["created_at", "התקבלה"], ["name", "שם"], ["phone", "טלפון"], ["trip_type", "סוג"], ["origin", "מוצא"], ["destination", "יעד"], ["depart_date", "יציאה"], ["return_date", "חזרה"], ["passengers", "נוסעים"], ["status", "סטטוס"], ["admin_note", "הערה"]];
    const cell = v => { let s = String(v ?? ""); if (/^[=+\-@]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
    const rows = filteredLeads().map(x => cols.map(([k]) => cell(k === "created_at" ? dt(x[k]) : k === "status" ? STATUS[x[k]] : x[k])).join(","));
    const csv = "﻿" + [cols.map(c => cell(c[1])).join(","), ...rows].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `פניות-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });

  // ---------- יעדים ----------
  const destRow = d => `<tr data-id="${d.id ?? ""}">
    <td><input data-f="name_he" value="${esc(d.name_he)}" aria-label="שם בעברית" required maxlength="60"></td>
    <td><input data-f="name_en" value="${esc(d.name_en)}" aria-label="שם באנגלית" dir="ltr" maxlength="60"></td>
    <td><input data-f="code" class="code-in" value="${esc(d.code)}" aria-label="קוד שדה" dir="ltr" maxlength="4"></td>
    <td><input data-f="region" value="${esc(d.region)}" list="regionList" aria-label="אזור" required maxlength="40"></td>
    <td><input data-f="via" value="${esc(d.via)}" aria-label="קונקשן דרך" placeholder="ישירה" maxlength="60"></td>
    <td><input data-f="duration" value="${esc(d.duration)}" aria-label="משך טיסה" dir="ltr" placeholder="5:20" maxlength="10"></td>
    <td><input data-f="sort" type="number" value="${d.sort ?? 0}" aria-label="סדר"></td>
    <td><input data-f="active" type="checkbox" ${d.active !== false ? "checked" : ""} aria-label="מוצג באתר"></td>
    <td><div class="acts"><button type="button" class="btn small primary" data-save>שמירה</button><button type="button" class="btn small danger" data-del>מחיקה</button></div></td></tr>`;
  function renderDests() {
    $("#destRows").innerHTML = DESTS.length ? DESTS.map(destRow).join("") : `<tr><td colspan="9" class="empty">עוד אין יעדים. לחצו על ״הוספת יעד״.</td></tr>`;
    $("#regionList").innerHTML = [...new Set(DESTS.map(d => d.region).concat(["אירופה", "צפון אמריקה", "אסיה", "מזרח תיכון", "אפריקה", "דרום אמריקה", "אוקיאניה"]))].map(r => `<option value="${esc(r)}">`).join("");
  }
  $("#addDest").addEventListener("click", () => {
    if (!DESTS.length) $("#destRows").innerHTML = "";
    $("#destRows").insertAdjacentHTML("afterbegin", destRow({ name_he: "", region: "", sort: 0, active: true }));
    $("#destRows input").focus();
  });
  $("#destRows").addEventListener("click", async e => {
    const tr = e.target.closest("tr"); if (!tr) return;
    const id = tr.dataset.id ? +tr.dataset.id : null;
    if (e.target.closest("[data-save]")) {
      const row = {};
      tr.querySelectorAll("[data-f]").forEach(i => { row[i.dataset.f] = i.type === "checkbox" ? i.checked : i.type === "number" ? +i.value || 0 : (i.value.trim() || null); });
      if (row.code) row.code = row.code.toUpperCase();
      if (!row.name_he || !row.region) { toast("חובה למלא שם בעברית ואזור"); return; }
      const q = id ? sb.from("destinations").update(row).eq("id", id).select().single() : sb.from("destinations").insert(row).select().single();
      const { data, error } = await q;
      if (error) return toast("השמירה נכשלה: " + error.message);
      if (id) Object.assign(DESTS.find(d => d.id === id), data); else { DESTS.push(data); tr.dataset.id = data.id; }
      toast("היעד נשמר ויופיע באתר");
    } else if (e.target.closest("[data-del]")) {
      const b = e.target.closest("[data-del]");
      if (!id) { tr.remove(); return; }
      if (!b.dataset.armed) { b.dataset.armed = "1"; b.textContent = "בטוח?"; setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.textContent = "מחיקה"; } }, 4000); return; }
      const { error } = await sb.from("destinations").delete().eq("id", id);
      if (error) return toast("המחיקה נכשלה: " + error.message);
      DESTS = DESTS.filter(d => d.id !== id); tr.remove(); toast("היעד נמחק");
    }
  });

  boot();
})();
