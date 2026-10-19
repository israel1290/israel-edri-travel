// עמוד הבית: לוח יעדים, טופס בקשת הצעה ואנימציות
(function () {
  const { $, db, track, esc, CFG } = window.SITE;
  const root = document.documentElement;
  const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches || root.classList.contains("still");

  // רשימת ברירת מחדל – מוצגת עד שמחברים את Supabase. אחרי החיבור היעדים נערכים מאיזור הניהול.
  const FALLBACK = [
    { name_he: "לונדון", name_en: "London", code: "LHR", region: "אירופה", via: null, duration: "5:20" },
    { name_he: "פריז", name_en: "Paris", code: "CDG", region: "אירופה", via: null, duration: "4:50" },
    { name_he: "רומא", name_en: "Rome", code: "FCO", region: "אירופה", via: null, duration: "3:50" },
    { name_he: "ליסבון", name_en: "Lisbon", code: "LIS", region: "אירופה", via: null, duration: "5:45" },
    { name_he: "דבלין", name_en: "Dublin", code: "DUB", region: "אירופה", via: "לונדון", duration: "8:30" },
    { name_he: "ניו יורק", name_en: "New York", code: "JFK", region: "צפון אמריקה", via: null, duration: "12:10" },
    { name_he: "מיאמי", name_en: "Miami", code: "MIA", region: "צפון אמריקה", via: null, duration: "13:30" },
    { name_he: "לאס וגאס", name_en: "Las Vegas", code: "LAS", region: "צפון אמריקה", via: "ניו יורק", duration: "18:40" },
    { name_he: "בנגקוק", name_en: "Bangkok", code: "BKK", region: "אסיה", via: null, duration: "11:00" },
    { name_he: "טוקיו", name_en: "Tokyo", code: "NRT", region: "אסיה", via: null, duration: "12:30" },
    { name_he: "הו צ׳י מין", name_en: "Ho Chi Minh", code: "SGN", region: "אסיה", via: "בנגקוק", duration: "14:20" },
    { name_he: "דובאי", name_en: "Dubai", code: "DXB", region: "מזרח תיכון", via: null, duration: "3:20" },
    { name_he: "קייפטאון", name_en: "Cape Town", code: "CPT", region: "אפריקה", via: "יוהנסבורג", duration: "14:00" },
    { name_he: "בואנוס איירס", name_en: "Buenos Aires", code: "EZE", region: "דרום אמריקה", via: "מדריד", duration: "20:30" },
    { name_he: "סידני", name_en: "Sydney", code: "SYD", region: "אוקיאניה", via: "סינגפור", duration: "21:00" }
  ];
  const ALL = "כל היעדים";
  let DESTS = FALLBACK, region = ALL;

  // ---------- אורות מסלול ----------
  const lights = $("#rlights");
  if (lights) {
    let h = "";
    for (let i = 0; i < 36; i++) h += `<circle class="rlight" cx="${20 + i * 40}" cy="566" r="2" style="animation-delay:${(-i * 0.045).toFixed(2)}s"/>`;
    lights.innerHTML = h;
  }

  // ---------- לוח המראות ----------
  const AB = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  function flap(el, code) {
    el.innerHTML = [...code].map(() => '<span aria-hidden="true"></span>').join("") + `<span class="sr-only">${esc(code)}</span>`;
    [...el.children].slice(0, code.length).forEach((s, i) => {
      if (calm()) { s.textContent = code[i]; return; }
      let n = 6 + i * 3;
      const tick = () => { s.textContent = n-- > 0 ? AB[(Math.random() * 26) | 0] : code[i]; if (n >= 0) setTimeout(tick, 45); };
      tick();
    });
  }
  function renderTabs() {
    const regions = [ALL, ...new Set(DESTS.map(d => d.region))];
    if (!regions.includes(region)) region = ALL;
    $("#tabs").innerHTML = regions.map(r => `<button type="button" aria-pressed="${r === region}">${esc(r)}</button>`).join("");
  }
  function renderRows() {
    const list = DESTS.filter(d => region === ALL || d.region === region);
    $("#rows").innerHTML = list.length ? list.map((d, i) => `<tr>
      <td class="dest"><b>${esc(d.name_he)}</b><small>${d.name_en ? `<span class="ltr">${esc(d.name_en)}</span> · ` : ""}${esc(d.region)}</small></td>
      <td>${d.code ? `<span class="flap" data-code="${esc(String(d.code).toUpperCase().slice(0, 4))}"></span>` : "—"}</td>
      <td>${d.via ? `<span class="pill via"><i></i>קונקשן דרך ${esc(d.via)}</span>` : `<span class="pill direct"><i></i>טיסה ישירה</span>`}</td>
      <td class="dur">${d.duration ? esc(d.duration) + " ש׳" : "—"}</td>
      <td><button class="btn btn-light" type="button" data-i="${DESTS.indexOf(d)}">בקשת הצעה<span class="sr-only"> ל${esc(d.name_he)}</span></button></td></tr>`).join("")
      : `<tr><td colspan="5" class="empty">אין כרגע יעדים באזור הזה. שלחו הודעה ונבנה לכם מסלול.</td></tr>`;
    $("#rows").querySelectorAll(".flap").forEach(f => flap(f, f.dataset.code));
  }
  $("#tabs").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    region = b.textContent; renderTabs(); renderRows();
    $("#tabs").querySelector('[aria-pressed="true"]')?.focus();
  });
  $("#rows").addEventListener("click", e => {
    const b = e.target.closest("button[data-i]"); if (!b) return;
    const d = DESTS[+b.dataset.i]; $("#to").value = d.name_he; $("#to").removeAttribute("aria-invalid");
    $("#search").scrollIntoView({ behavior: calm() ? "auto" : "smooth", block: "start" });
    setTimeout(() => $("#dep").focus({ preventScroll: true }), calm() ? 0 : 600);
  });
  function fillDatalist() { $("#destList").innerHTML = DESTS.map(d => `<option value="${esc(d.name_he)}">`).join(""); }
  function renderAll() { renderTabs(); renderRows(); fillDatalist(); }
  renderAll();

  if (db.ready) {
    db.select("destinations?select=name_he,name_en,code,region,via,duration&active=eq.true&order=sort.asc,id.asc")
      .then(rows => { if (Array.isArray(rows) && rows.length) { DESTS = rows; renderAll(); } })
      .catch(() => {});
  }

  // ---------- טופס ----------
  const form = $("#quote"), res = $("#result");
  const pad = n => String(n).padStart(2, "0");
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fmt = s => s ? s.split("-").reverse().join("/") : "";
  (function initDates() {
    const today = new Date(), a = new Date(); a.setDate(a.getDate() + 30);
    const b = new Date(a); b.setDate(b.getDate() + 7);
    $("#dep").min = ymd(today); $("#ret").min = ymd(today);
    $("#dep").value = ymd(a); $("#ret").value = ymd(b);
  })();
  $("#dep").addEventListener("change", () => {
    $("#ret").min = $("#dep").value || $("#ret").min;
    if ($("#ret").value && $("#ret").value < $("#dep").value) $("#ret").value = "";
  });
  form.querySelectorAll('input[name="trip"]').forEach(r => r.addEventListener("change", () => {
    const one = $("#tripOne").checked; $("#ret").disabled = one; if (one) $("#ret").value = "";
  }));
  form.addEventListener("input", e => e.target.removeAttribute("aria-invalid"));

  const phoneOk = p => /^0\d{8,9}$|^\+?972\d{8,9}$/.test(p.replace(/[\s-]/g, ""));
  function show(kind, html) { res.className = "result " + kind; res.innerHTML = html; res.hidden = false; }

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const v = {
      trip: form.querySelector('input[name="trip"]:checked').value,
      from: $("#from").selectedOptions[0].text,
      to: $("#to").value.trim(), dep: $("#dep").value, ret: $("#ret").disabled ? "" : $("#ret").value,
      pax: $("#pax").value, name: $("#name").value.trim(), phone: $("#phone").value.trim()
    };
    const missing = [];
    if (!v.to) missing.push(["to", "יעד"]);
    if (!v.dep) missing.push(["dep", "תאריך יציאה"]);
    if (v.name.length < 2) missing.push(["name", "שם"]);
    if (!phoneOk(v.phone)) missing.push(["phone", "טלפון תקין"]);
    if (!$("#consent").checked) missing.push(["consent", "אישור מדיניות הפרטיות"]);
    if (missing.length) {
      missing.forEach(([id]) => $("#" + id).setAttribute("aria-invalid", "true"));
      show("err", `<span>כדי לשלוח צריך למלא: ${missing.map(m => m[1]).join(", ")}.</span>`);
      $("#" + missing[0][0]).focus(); return;
    }
    // מלכודת לבוטים
    if ($("#company").value) { show("ok", "<span>תודה! הפנייה התקבלה.</span>"); return; }

    const msg = `שלום ישראל, אשמח להצעה:\n• ${v.trip}\n• מ־${v.from} אל ${v.to}\n• יציאה: ${fmt(v.dep)}${v.ret ? `\n• חזרה: ${fmt(v.ret)}` : ""}\n• נוסעים: ${v.pax}\n• שם: ${v.name}\n• טלפון: ${v.phone}`;
    const wa = `https://wa.me/${CFG.whatsapp}?text=${encodeURIComponent(msg)}`;
    const waBtn = label => `<a class="btn btn-primary" target="_blank" rel="noopener" data-track="whatsapp_click" href="${wa}"><svg aria-hidden="true"><use href="#i-chat"/></svg>${label}</a>`;

    if (!db.ready) { show("", `<span><b>הבקשה מוכנה.</b> לחצו כדי לשלוח אותה לישראל בוואטסאפ:</span>${waBtn("שליחה בוואטסאפ")}`); return; }

    const btn = form.querySelector('button[type="submit"]'); btn.disabled = true; btn.textContent = "שולח…";
    try {
      await db.insert("leads", {
        name: v.name, phone: v.phone, trip_type: v.trip, origin: v.from, destination: v.to,
        depart_date: v.dep || null, return_date: v.ret || null, passengers: v.pax
      });
      track("quote_submit");
      show("ok", `<span><b>הפנייה נשלחה.</b> ישראל יחזור אליכם בהקדם. רוצים תשובה מהר יותר? שלחו גם בוואטסאפ.</span>${waBtn("וואטסאפ")}`);
      $("#name").value = ""; $("#phone").value = "";
    } catch (err) {
      show("err", `<span>לא הצלחנו לשמור את הפנייה באתר. אפשר לשלוח אותה ישירות בוואטסאפ:</span>${waBtn("שליחה בוואטסאפ")}`);
    } finally { btn.disabled = false; btn.textContent = "קבלת הצעה"; }
  });

  // ---------- הופעה בגלילה ----------
  const rv = document.querySelectorAll(".rv");
  if (!calm() && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } }), { threshold: 0.12 });
    rv.forEach((el, i) => { el.style.transitionDelay = (i % 4) * 80 + "ms"; io.observe(el); });
  } else rv.forEach(el => el.classList.add("in"));
})();
