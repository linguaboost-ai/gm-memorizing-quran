/*
 * German Method – Hifz: Screens, Zustand und Ablauf.
 *
 * Plan: Juz, Lerntage in der Woche, Menge pro Tag (¼–2 Seiten). Gelernt wird
 * in Seitenvierteln des Madani-Mushaf.
 *
 * Ablauf pro Seitenviertel:
 *   1  Vorbereitung   1a Emojis den Fragmenten zuordnen, 1b Reihenfolge finden
 *   2  Auswendiglernen  Ausgrauen in Fünfteln (Weiter/Zurück), dann
 *                       Pause 1 Min (Dhikr) → Wiederholung → Pause 2 Min (Quiz)
 *                       → Wiederholung → Pause 4 Min (Text) → Wiederholung
 *   3  Abschluss       freiwillige Notizen zur Umsetzung
 *
 * Zum Testen gibt es eine freie Auswahl (Juz → Seite → Viertel) mit freier
 * Navigation zwischen allen Schritten.
 */
(function () {
  "use strict";

  const { Quran, Fade, Mushaf, Player, Reciters, Prep, Activities } = window;
  const esc = Fade.escapeHtml;

  const STORAGE_KEY = "gm-hifz:v2";
  const OLD_KEYS = ["gm-hifz:v1"];
  const params = new URLSearchParams(location.search);
  // ?timer=5 verkürzt alle Pausen auf 5 Sekunden (zum Ausprobieren)
  const TEST_SECONDS = Math.max(0, Number(params.get("timer")) || 0);
  const PAUSES = [60, 120, 240].map((s) => TEST_SECONDS || s);
  const TAIL_WORDS = 3;

  const DAILY_OPTIONS = [0.25, 0.5, 1, 1.5, 2];
  const WEEKDAYS = [
    { d: 1, short: "Mo", long: "Montag" },
    { d: 2, short: "Di", long: "Dienstag" },
    { d: 3, short: "Mi", long: "Mittwoch" },
    { d: 4, short: "Do", long: "Donnerstag" },
    { d: 5, short: "Fr", long: "Freitag" },
    { d: 6, short: "Sa", long: "Samstag" },
    { d: 0, short: "So", long: "Sonntag" },
  ];
  const DAY_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  const DEFAULT_JUZ = 30;
  const TEST_DEFAULT = { juz: 24, page: 467, part: 1 };

  const STEPS = ["assign", "order", "learn", "pause1", "review1", "pause2", "review2", "pause3", "review3", "reflect"];
  const STEP_LABEL = {
    assign: "1a Emojis",
    order: "1b Reihenfolge",
    learn: "2 Lernen",
    pause1: "1 Min",
    review1: "Wdh. 1",
    pause2: "2 Min",
    review2: "Wdh. 2",
    pause3: "4 Min",
    review3: "Wdh. 3",
    reflect: "3 Abschluss",
  };

  const ICONS = {
    close: "M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z",
    play: "M8 5v14l11-7z",
    pause: "M6 19h4V5H6v14zm8-14v14h4V5h-4z",
    replay: "M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z",
    loading: "M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z",
    check: "M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z",
    chevron: "M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z",
    back: "M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z",
    arrow: "M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z",
  };
  const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name]}"/></svg>`;

  // Wellenform wie im Design (Höhen in px)
  const BAR_HEIGHTS = [4, 10, 16, 24, 12, 8, 14, 22, 18, 10, 6, 12, 20, 26, 14, 8, 4, 10, 18, 24, 12, 16, 8, 6, 14, 20, 10, 4];

  /* ---------------------------------------------------------------- Zustand */

  const blankState = () => ({
    v: 2,
    reciter: "afasy",
    plan: null,
    progress: null,
    sessions: { plan: null, test: null },
    test: Object.assign({}, TEST_DEFAULT),
    journal: [],
  });

  function loadState() {
    let state = blankState();
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (s && s.v === 2) state = Object.assign(state, s);
      // Umstellung: alter Plan wird gelöscht, nur der Rezitator bleibt
      for (const k of OLD_KEYS) {
        const old = JSON.parse(localStorage.getItem(k) || "null");
        if (old && !(s && s.v === 2)) state.reciter = (old.plan && old.plan.reciter) || old.reciter || state.reciter;
        localStorage.removeItem(k);
      }
    } catch (e) {
      /* leer oder ungültig */
    }
    return state;
  }

  let state = loadState();
  const save = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      /* privater Modus o. Ä. */
    }
  };

  /* ------------------------------------------------------------ Datum/Format */

  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const today = () => iso(new Date());
  const parseIso = (s) => {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  };
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const dateLabel = (d) => `${DAY_SHORT[d.getDay()]}, ${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.`;

  function pagesLabel(x) {
    const q = Math.round(x * 4) / 4;
    const whole = Math.floor(q);
    const frac = { 0: "", 0.25: "¼", 0.5: "½", 0.75: "¾" }[q - whole];
    const num = (whole ? String(whole) : "") + frac || "¼";
    return `${num} ${q > 1 ? "Seiten" : "Seite"}`;
  }
  const dailyLabel = (v) => ({ 0.25: "¼", 0.5: "½", 1: "1", 1.5: "1½", 2: "2" })[v];
  const juzRange = (j) => {
    const s = Quran.meta(j.start[0]);
    const e = Quran.meta(j.end[0]);
    return `${esc(s.tr)} (${j.start[0]}:${j.start[1]}) – ${esc(e.tr)} (${j.end[0]}:${j.end[1]})`;
  };
  const mmss = Activities.mmss;

  /* --------------------------------------------------------------- Kontext */

  const root = document.getElementById("app");
  let screen = { name: "loading" };
  let planCtx = null; // { days }
  let unitCache = new Map();
  let ticker = null;
  let wakeLock = null;
  let audioCtx = null;
  let draft = null;
  let showAllDays = false;

  const player = new Player(onPlayerChange);

  async function loadPlanContext() {
    if (!state.plan) {
      planCtx = null;
      return;
    }
    await Quran.loadJuz(state.plan.juz);
    planCtx = { days: Quran.planDays(state.plan.juz, state.plan.daily) };
  }

  /** Alles, was für ein Seitenviertel gebraucht wird. */
  async function unitContext(ref) {
    const key = ref.page + ":" + ref.part;
    if (unitCache.has(key)) return unitCache.get(key);
    await Quran.loadPages([ref.page, ref.page + 1]);
    const parts = Quran.pageParts(ref.page);
    const unit = parts[Math.min(ref.part, parts.length - 1)];
    const words = Quran.wordsOf(unit);
    const shapes = words.map((w) => Fade.analyze(w.text));
    const wordIndex = new Map(words.map((w, i) => [w, i]));
    const tail = Quran.tailOf(unit, TAIL_WORDS);
    const info = {
      ref,
      unit,
      parts: parts.length,
      words,
      shapes,
      wordIndex,
      tail,
      totals: shapes.map((s) => s.total),
      fragments: Prep.fragmentsOf(unit),
      label: Quran.label(unit),
    };
    unitCache.set(key, info);
    return info;
  }

  /** Neue Sitzung für ein Seitenviertel. */
  function newSession(mode, ref, info, extra) {
    return Object.assign(
      {
        mode,
        ref: { page: ref.page, part: ref.part },
        step: "assign",
        levels: new Array(info.words.length).fill(0),
        emojis: new Array(info.fragments.length).fill(null),
        palette: Prep.palette(info.fragments),
        order: Prep.shuffle(info.fragments.map((f) => f.id)),
        placed: 0,
        wheel: 0,
        showDe: false,
        pauses: [{}, {}, {}],
        acts: [null, null, null],
        reflect: { d1: "", d7: "", life: "" },
      },
      extra || {}
    );
  }

  /* ------------------------------------------------------------ Navigation */

  function go(name, data = {}) {
    if (screen.name === "session" && name !== "session") player.stop();
    if (name !== "session") releaseWakeLock();
    stopTicker();
    screen = Object.assign({ name }, data);
    render();
    window.scrollTo(0, 0);
  }

  function render(keepScroll) {
    const y = window.scrollY;
    stopTicker();
    closeSheet();
    const views = {
      loading: () => `<div class="loading-screen">${esc(screen.message || "Lädt …")}</div>`,
      setup: viewSetup,
      home: viewHome,
      testpick: viewTestPick,
      session: viewSession,
      unitDone: viewUnitDone,
      dayDone: viewDayDone,
      planDone: viewPlanDone,
    };
    root.innerHTML = `<div class="screen screen-${screen.name}" ${keepScroll ? 'style="animation:none"' : ""}>${views[screen.name]()}</div>`;
    const after = { setup: afterSetup, home: afterHome, testpick: afterTestPick, session: afterSession };
    if (after[screen.name]) after[screen.name]();
    if (screen.name !== "session" || !isPause(currentSession())) document.title = "German Method – Qur'an auswendig lernen";
    if (keepScroll) window.scrollTo(0, y);
  }

  /* ------------------------------------------------------------ Juz-Liste */

  function juzListHtml(selected, action) {
    return Quran.juzList
      .map(
        (j) => `<button class="juz-row" data-action="${action}" data-value="${j.n}" aria-selected="${j.n === selected}">
          <span class="num-badge">${j.n}</span>
          <span class="picker-main"><strong>Juz ${j.n}</strong><span>${juzRange(j)} · S. ${j.p0}–${j.p1}</span></span>
        </button>`
      )
      .join("");
  }

  function openJuzSheet(selected, action) {
    openSheet(
      `<div class="sheet" role="dialog" aria-label="Juz wählen">
        <div class="sheet-head"><div class="sheet-head-row"><h3>Juz wählen</h3><button class="icon-btn" data-action="close-sheet" aria-label="Schließen">${icon("close")}</button></div></div>
        <div class="sheet-list">${juzListHtml(selected, action)}</div>
      </div>`,
      (el) => {
        const sel = el.querySelector('[aria-selected="true"]');
        if (sel) sel.scrollIntoView({ block: "center" });
      }
    );
  }

  function juzPickerHtml(n, action) {
    const j = Quran.juz(n);
    return `<button class="card picker" data-action="${action}">
      <span class="num-badge">${j.n}</span>
      <span class="picker-main"><strong>Juz ${j.n}</strong><span>${juzRange(j)}</span><span>Seite ${j.p0}–${j.p1}</span></span>
      <svg class="chevron" viewBox="0 0 24 24"><path d="${ICONS.chevron}"/></svg>
    </button>`;
  }

  /* ------------------------------------------------------------------ Setup */

  function openSetup() {
    const p = state.plan;
    draft = {
      juz: p ? p.juz : DEFAULT_JUZ,
      weekdays: p ? p.weekdays.slice() : [1, 2, 3, 4, 5],
      daily: p ? p.daily : 0.5,
    };
    go("setup");
  }

  function viewSetup() {
    const canClose = !!state.plan;
    return `
      <header class="topbar">
        ${canClose ? `<button class="icon-btn" data-action="home" aria-label="Schließen">${icon("close")}</button>` : ""}
        <span class="topbar-title">${canClose ? "Neuer Lernplan" : "German Method · Hifz"}</span>
      </header>
      <main class="content">
        ${canClose ? "" : `<div class="bismillah">${esc(Quran.basmala)}</div>`}
        <h1 class="h1">Dein Lernplan</h1>
        <p class="lead">Gelernt wird im Madani-Mushaf, Seite für Seite – immer in ganzen Versen.</p>

        <div class="section-title"><h2>Was möchtest du auswendig lernen?</h2></div>
        ${juzPickerHtml(draft.juz, "pick-juz")}

        <div class="section-title"><h2>An welchen Tagen in der Woche willst du auswendig lernen?</h2></div>
        <div class="weekday-row" role="group" aria-label="Lerntage">
          ${WEEKDAYS.map(
            (w) => `<label class="weekday ${draft.weekdays.includes(w.d) ? "on" : ""}">
              <input type="checkbox" data-action="weekday" data-value="${w.d}" ${draft.weekdays.includes(w.d) ? "checked" : ""} />
              <span>${w.short}</span></label>`
          ).join("")}
        </div>

        <div class="section-title"><h2>Wie viel pro Tag auswendig lernen?</h2></div>
        <div class="options options-5" role="radiogroup" aria-label="Menge pro Tag">
          ${DAILY_OPTIONS.map(
            (v) => `<label class="option ${draft.daily === v ? "on" : ""}">
              <input type="radio" name="daily" data-action="daily" data-value="${v}" ${draft.daily === v ? "checked" : ""} />
              <b>${dailyLabel(v)}</b><span>${v > 1 ? "Seiten" : "Seite"}</span></label>`
          ).join("")}
        </div>

        <div class="card-dark summary" id="plan-summary">${summaryHtml(null)}</div>
        <button class="link-btn" data-action="test">Zum Testen: freie Auswahl →</button>
      </main>
      <footer class="footer">
        <button class="btn" data-action="start-plan" ${draft.weekdays.length ? "" : "disabled"}>Plan erstellen</button>
      </footer>`;
  }

  function scheduleDates(count, weekdays, from) {
    const out = [];
    let d = from;
    for (let guard = 0; out.length < count && guard < 5000; guard++) {
      if (weekdays.includes(d.getDay())) out.push(d);
      d = addDays(d, 1);
    }
    return out;
  }

  function summaryHtml(days) {
    if (!days) return `<span class="eyebrow">Dein Plan</span><div class="summary-row">Wird berechnet …</div>`;
    if (!draft.weekdays.length) return `<span class="eyebrow">Dein Plan</span><div class="summary-row">Bitte wähle mindestens einen Lerntag.</div>`;
    const dates = scheduleDates(days.length, draft.weekdays, new Date());
    const units = days.reduce((s, d) => s + d.units.length, 0);
    const names = WEEKDAYS.filter((w) => draft.weekdays.includes(w.d)).map((w) => w.short).join(", ");
    return `
      <span class="eyebrow">So sieht dein Plan aus</span>
      <div class="summary-row"><b>${days.length}</b> Lerntage · je ca. ${pagesLabel(draft.daily)}</div>
      <small>${names} · ${units} Seitenviertel · voraussichtlich fertig: ${dateLabel(dates[dates.length - 1])}${dates[dates.length - 1].getFullYear() !== new Date().getFullYear() ? dates[dates.length - 1].getFullYear() : ""}<br>
      Jedes Viertel: Vorbereitung mit Emojis, Auswendiglernen mit Pausen von 1, 2 und 4 Minuten, Abschluss.</small>`;
  }

  async function afterSetup() {
    const token = (afterSetup.token = (afterSetup.token || 0) + 1);
    await Quran.loadJuz(draft.juz);
    if (token !== afterSetup.token || screen.name !== "setup") return;
    const el = document.getElementById("plan-summary");
    if (el) el.innerHTML = summaryHtml(Quran.planDays(draft.juz, draft.daily));
  }

  async function startPlan(confirmed) {
    const hasProgress = state.plan && state.progress && (state.progress.day > 0 || state.progress.unit > 0 || state.sessions.plan);
    if (hasProgress && !confirmed) {
      return confirmDialog("Neuen Plan erstellen?", "Dein bisheriger Fortschritt im Plan wird dabei zurückgesetzt.", "Neuen Plan erstellen", () => startPlan(true));
    }
    state.plan = { juz: draft.juz, weekdays: draft.weekdays.slice(), daily: draft.daily, created: today() };
    state.progress = { day: 0, unit: 0, completed: [], lastDoneDate: null };
    state.sessions.plan = null;
    save();
    go("loading");
    await loadPlanContext();
    go("home");
  }

  /* ------------------------------------------------------------------- Home */

  /** Termine: erledigte Tage mit Datum, offene ab heute auf den Lerntagen. */
  function planSchedule() {
    const p = state.progress;
    const days = planCtx.days;
    const doneToday = p.lastDoneDate === today() && !state.sessions.plan;
    const upcoming = scheduleDates(Math.max(0, days.length - p.day), state.plan.weekdays, doneToday ? addDays(new Date(), 1) : new Date());
    return days.map((d, i) => (i < p.day ? { done: true, date: p.completed[i] ? parseIso(p.completed[i]) : null } : { done: false, date: upcoming[i - p.day] }));
  }

  function viewHome() {
    const p = state.progress;
    const days = planCtx.days;
    const total = days.length;
    const finished = p.day >= total;
    const pct = Math.round((Math.min(p.day, total) / total) * 100);
    const reciter = Reciters.byId(state.reciter);
    const j = Quran.juz(state.plan.juz);
    const sched = planSchedule();
    const names = WEEKDAYS.filter((w) => state.plan.weekdays.includes(w.d)).map((w) => w.short).join(", ");
    return `
      <main class="content" style="padding-top:max(20px, env(safe-area-inset-top))">
        <div class="card hello">
          <div class="hello-main"><span>Assalamu 'Alaikum</span><strong>Dein Hifz-Plan</strong></div>
          <span class="pill pill-gold">${finished ? "Fertig" : `Tag ${p.day + 1} / ${total}`}</span>
        </div>
        <div class="bismillah">${esc(Quran.basmala)}</div>
        <h1 class="hero-title">${finished ? `Juz ${j.n} ist geschafft.` : `Lerne Juz ${j.n} auswendig.`}</h1>
        ${todayCardHtml(finished, sched)}

        <div class="section-title"><h2>Dein Weg</h2><small>${pct} % · ${total} Lerntage</small></div>
        <div class="card">
          <div class="progress" aria-label="Fortschritt"><i style="width:${pct}%"></i></div>
          <div class="days" style="margin-top:6px">${daysHtml(sched)}</div>
        </div>

        ${journalHtml()}

        <div class="section-title"><h2>Einstellungen</h2></div>
        <div class="card">
          <div class="settings-row"><div><small>Juz</small><strong>Juz ${j.n} · ${juzRange(j)}</strong></div></div>
          <div class="settings-row"><div><small>Lerntage</small><strong>${names}</strong></div></div>
          <div class="settings-row"><div><small>Pro Tag</small><strong>${pagesLabel(state.plan.daily)}</strong></div></div>
          <div class="settings-row"><div><small>Rezitator</small><strong>${esc(reciter.name)}</strong></div><button class="link-btn" data-action="change-reciter">Ändern</button></div>
          <div style="padding-top:12px"><button class="btn btn-outline" data-action="new-plan">Neuen Plan erstellen</button></div>
        </div>

        <div class="section-title"><h2>Zum Testen</h2></div>
        <button class="card picker" data-action="test">
          <span class="num-badge">${icon("arrow")}</span>
          <span class="picker-main"><strong>Freie Auswahl</strong><span>Juz, Seite und Viertel direkt wählen – unabhängig vom Plan</span></span>
          <svg class="chevron" viewBox="0 0 24 24"><path d="${ICONS.chevron}"/></svg>
        </button>
        <p class="credits">Text &amp; Seitenlayout: King Fahd Complex (KFGQPC Uthmanic Hafs) via <a href="https://quran.ws" target="_blank" rel="noopener">quran.ws</a> (CC BY 4.0) · Audio: <a href="https://everyayah.com" target="_blank" rel="noopener">everyayah.com</a></p>
      </main>`;
  }

  function todayCardHtml(finished, sched) {
    if (finished) {
      return `<div class="card-dark">
        <span class="eyebrow">Ma schā' Allāh</span>
        <h2 class="today-title">Alle ${planCtx.days.length} Lerntage geschafft</h2>
        <p class="today-meta left">Wiederhole den Juz regelmäßig, damit er bleibt.</p>
        <button class="btn btn-white" data-action="new-plan">Neuen Plan erstellen ${icon("arrow")}</button>
      </div>`;
    }
    const p = state.progress;
    const s = state.sessions.plan;
    const day = planCtx.days[p.day];
    const date = sched[p.day].date;
    const isToday = date && iso(date) === today();
    const units = day.units.map((u, i) => `<li class="${i < p.unit ? "done" : i === p.unit ? "now" : ""}">${esc(Quran.label(u))} <small>S. ${u.page}</small></li>`).join("");
    const doneToday = p.lastDoneDate === today() && !s && p.unit === 0;
    let head;
    let button;
    if (s || p.unit > 0) {
      head = `Tag ${p.day + 1} · weiterlernen`;
      button = `<button class="btn btn-white" data-action="learn">Weiterlernen ${icon("arrow")}</button>`;
    } else if (isToday) {
      head = `Heute · ${dateLabel(date)}`;
      button = `<button class="btn btn-white" data-action="learn">Jetzt lernen ${icon("arrow")}</button>`;
    } else {
      head = doneToday ? "Für heute geschafft ✓" : `Nächster Lerntag: ${date ? dateLabel(date) : "–"}`;
      button = `<button class="btn btn-white" data-action="learn">Tag ${p.day + 1} jetzt schon lernen ${icon("arrow")}</button>`;
    }
    return `<div class="card-dark">
      <div class="today-head"><span class="eyebrow">Tagespensum · Tag ${p.day + 1}</span><span class="pill pill-light">${pagesLabel(day.size)}</span></div>
      <h2 class="today-title">${head}</h2>
      <ol class="unit-list">${units}</ol>
      ${button}
    </div>`;
  }

  function daysHtml(sched) {
    const p = state.progress;
    const total = planCtx.days.length;
    let lo = 0;
    let hi = total;
    if (!showAllDays && total > 8) {
      lo = Math.max(0, Math.min(p.day - 2, total - 7));
      hi = Math.min(total, lo + 7);
    }
    const rows = planCtx.days
      .slice(lo, hi)
      .map((d) => {
        const i = d.index;
        const done = i < p.day;
        const current = i === p.day;
        const first = d.units[0];
        const last = d.units[d.units.length - 1];
        const date = sched[i].date;
        return `<div class="day ${done ? "done" : current ? "current" : ""}">
          <span class="day-dot">${done ? icon("check") : i + 1}</span>
          <span class="day-main"><strong>${date ? dateLabel(date) : `Tag ${i + 1}`} · ${esc(Quran.label({ verses: [first.verses[0], last.verses[last.verses.length - 1]] }))}</strong>
          <span>${pagesLabel(d.size)} · ${d.units.length} ${d.units.length === 1 ? "Viertel" : "Viertel"} · S. ${first.page}${last.page !== first.page ? "–" + last.page : ""}</span></span>
          ${current ? `<span class="pill pill-primary">Als Nächstes</span>` : ""}
        </div>`;
      })
      .join("");
    const toggle = total > 8 ? `<button class="link-btn" data-action="toggle-days" style="align-self:center;margin-top:6px">${showAllDays ? "Weniger anzeigen" : `Alle ${total} Lerntage anzeigen`}</button>` : "";
    return rows + toggle;
  }

  function journalHtml() {
    const items = (state.journal || []).slice(-3).reverse();
    if (!items.length) return "";
    return `<div class="section-title"><h2>Deine Notizen</h2><small>${state.journal.length}</small></div>
      <div class="card journal">${items
        .map((e) => {
          const lines = [
            e.dhikrCount ? `Dhikr: ${esc(e.dhikrCount)} Mal` : "",
            e.learned ? `Neu gelernt: ${esc(e.learned)}` : "",
            e.takeaway ? `Aus der Geschichte: ${esc(e.takeaway)}` : "",
            e.d1 ? `24 Stunden: ${esc(e.d1)}` : "",
            e.d7 ? `7 Tage: ${esc(e.d7)}` : "",
            e.life ? `Im Leben: ${esc(e.life)}` : "",
          ].filter(Boolean);
          return `<div class="journal-item"><strong>${esc(e.label)}</strong><small>${dateLabel(parseIso(e.date))}</small>${lines.map((l) => `<p>${l}</p>`).join("") || "<p>–</p>"}</div>`;
        })
        .join("")}</div>`;
  }

  function afterHome() {}

  /* ------------------------------------------------------------- Testmodus */

  function viewTestPick() {
    const t = state.test;
    const j = Quran.juz(t.juz);
    const pages = [];
    for (let p = j.p0; p <= j.p1; p++) pages.push(p);
    const reciter = Reciters.byId(state.reciter);
    return `
      <header class="topbar">
        <button class="icon-btn" data-action="${state.plan ? "home" : "setup"}" aria-label="Schließen">${icon("close")}</button>
        <span class="topbar-title">Freie Auswahl</span>
      </header>
      <main class="content">
        <p class="lead">Wähle Juz, Seite und Viertel – dann geht es direkt zum Auswendiglernen. Alle Schritte lassen sich frei ansteuern, Timer kannst du überspringen.</p>
        <div class="section-title"><h2>Juz</h2></div>
        ${juzPickerHtml(t.juz, "test-pick-juz")}

        <div class="section-title"><h2>Seite</h2><small>${pages.length} Seiten</small></div>
        <div class="page-grid">
          ${pages
            .map((p) => {
              const first = Quran.surahs.find((m) => m.p0 <= p && p <= m.p1);
              const name = Quran.surahs.filter((m) => m.p0 <= p && p <= m.p1).pop() || first;
              return `<button class="page-chip" data-action="test-page" data-value="${p}" aria-selected="${p === t.page}"><b>${p}</b><span>${esc(name.tr)}</span></button>`;
            })
            .join("")}
        </div>

        <div class="section-title"><h2>Viertel auf Seite ${t.page}</h2></div>
        <div class="mini-wrap">
          <div class="mushaf mini" id="mini-page" data-selected="${t.part}"><div class="loading-screen">Lädt …</div></div>
          <div class="part-list" id="part-list"></div>
        </div>

        <div class="settings-row card" style="padding:12px 16px"><div><small>Rezitator</small><strong>${esc(reciter.name)}</strong></div><button class="link-btn" data-action="change-reciter">Ändern</button></div>
      </main>
      <footer class="footer">
        <button class="btn" data-action="test-start">Auswendiglernen starten</button>
      </footer>`;
  }

  async function afterTestPick() {
    const t = state.test;
    await Quran.loadPages([t.page, t.page + 1]);
    if (screen.name !== "testpick") return;
    const parts = Quran.pageParts(t.page);
    if (t.part >= parts.length) t.part = 0;
    const mini = document.getElementById("mini-page");
    mini.innerHTML = Mushaf.pageHtml(t.page, parts);
    mini.dataset.selected = t.part;
    Mushaf.fit(mini);
    document.getElementById("part-list").innerHTML = parts
      .map(
        (u, i) => `<button class="part-row" data-action="test-part" data-value="${i}" data-q="${i}" aria-selected="${i === t.part}">
          <span class="part-dot q${i}"></span><span><strong>Viertel ${i + 1}</strong><small>${esc(Quran.label(u))}</small></span></button>`
      )
      .join("");
    // Hover: Viertel hervorheben
    const wrap = document.querySelector(".mini-wrap");
    wrap.addEventListener("mouseover", (e) => {
      const el = e.target.closest("[data-q]");
      mini.dataset.hover = el ? el.dataset.q : "";
    });
    wrap.addEventListener("mouseleave", () => (mini.dataset.hover = ""));
    mini.addEventListener("click", (e) => {
      const el = e.target.closest("[data-q]");
      if (el) selectTestPart(+el.dataset.q);
    });
  }

  function selectTestPart(i) {
    state.test.part = i;
    save();
    const mini = document.getElementById("mini-page");
    if (mini) mini.dataset.selected = i;
    document.querySelectorAll(".part-row").forEach((r) => r.setAttribute("aria-selected", String(+r.dataset.value === i)));
  }

  async function startTest(fresh) {
    const ref = { page: state.test.page, part: state.test.part };
    const info = await unitContext(ref);
    const old = state.sessions.test;
    // gleiche Auswahl: begonnene Sitzung fortsetzen
    if (fresh || !old || old.ref.page !== ref.page || old.ref.part !== ref.part || old.levels.length !== info.words.length) {
      state.sessions.test = newSession("test", ref, info);
      save();
    }
    go("session", { mode: "test" });
  }

  /* --------------------------------------------------------------- Sitzung */

  const currentSession = () => (screen.name === "session" ? state.sessions[screen.mode] : null);
  const isPause = (s) => !!s && /^pause/.test(s.step);
  const pauseIndex = (s) => +s.step.slice(-1) - 1;

  async function openPlanSession() {
    const p = state.progress;
    if (!planCtx || p.day >= planCtx.days.length) return;
    const unit = planCtx.days[p.day].units[p.unit];
    const ref = { page: unit.page, part: unit.part };
    const info = await unitContext(ref);
    let s = state.sessions.plan;
    if (!s || s.ref.page !== ref.page || s.ref.part !== ref.part || s.levels.length !== info.words.length) {
      s = state.sessions.plan = newSession("plan", ref, info, { day: p.day, unit: p.unit });
      save();
    }
    go("session", { mode: "plan" });
  }

  function sessionInfo() {
    const s = currentSession();
    return s && unitCache.get(s.ref.page + ":" + s.ref.part);
  }

  function sessionTitle(s, info) {
    if (s.mode === "test") return `Test · S. ${s.ref.page} · Viertel ${s.ref.part + 1}/${info.parts}`;
    return `Tag ${s.day + 1} · Viertel ${s.unit + 1}/${planCtx.days[s.day].units.length}`;
  }

  function stepperHtml(s) {
    const idx = STEPS.indexOf(s.step);
    if (s.mode === "test") {
      return `<div class="stepper test">${STEPS.map(
        (st, i) => `<button class="step-chip ${i === idx ? "now" : i < idx ? "past" : ""}" data-action="goto-step" data-value="${st}">${STEP_LABEL[st]}</button>`
      ).join("")}</div>`;
    }
    const groups = [
      ["1 Vorbereitung", 0, 1],
      ["2 Auswendiglernen", 2, 8],
      ["3 Abschluss", 9, 9],
    ];
    return `<div class="stepper">${groups
      .map(([label, a, b]) => {
        const fill = idx > b ? 100 : idx < a ? 0 : ((idx - a + 1) / (b - a + 2)) * 100;
        return `<div class="step-group ${idx >= a && idx <= b ? "now" : ""}"><span class="step-bar"><i style="width:${fill}%"></i></span><small>${label}</small></div>`;
      })
      .join("")}</div>`;
  }

  function viewSession() {
    const s = currentSession();
    const info = sessionInfo();
    if (!s || !info) return `<div class="loading-screen">Lädt …</div>`;
    let body = "";
    let showPlayer = false;
    switch (s.step) {
      case "assign":
        body = `<h2 class="step-title">1a · Emojis zuordnen</h2>
          <p class="lead">Der Abschnitt in Fragmenten. Ordne jedem Fragment ein Emoji zu – als Merkhilfe.</p>
          <div id="prep"></div>
          ${munasabaHtml(info)}`;
        break;
      case "order":
        body = `<h2 class="step-title">1b · Reihenfolge</h2>
          <p class="lead">Jetzt umgekehrt: Die Emojis bleiben, die Fragmente sind gemischt. Setze sie der Reihe nach wieder ein.</p>
          <div id="prep"></div>`;
        break;
      case "learn":
      case "review1":
      case "review2":
      case "review3":
        body = learnBodyHtml(s, info);
        showPlayer = true;
        break;
      case "pause1":
      case "pause2":
      case "pause3":
        body = pauseBodyHtml(s);
        break;
      case "reflect":
        body = reflectHtml(s);
        break;
      default:
    }
    return `
      <header class="topbar">
        <button class="icon-btn" data-action="close-session" aria-label="Schließen">${icon("close")}</button>
        <span class="topbar-title">${esc(sessionTitle(s, info))}</span>
      </header>
      ${stepperHtml(s)}
      <main class="content">${body}</main>
      <footer class="footer">
        ${showPlayer ? `<div class="player" id="player">${playerHtml()}</div><p class="player-error" id="player-error" hidden>Die Rezitation konnte nicht geladen werden. Bitte prüfe deine Internetverbindung.</p>` : ""}
        <div class="nav-row">
          <button class="btn btn-outline btn-back" data-action="back" ${canGoBack(s) ? "" : "disabled"}>${icon("back")} Zurück</button>
          <button class="btn" data-action="next" ${canGoNext(s) ? "" : "disabled"}>${nextLabel(s)}</button>
        </div>
        <p class="hint" id="session-hint">${hintText(s)}</p>
      </footer>`;
  }

  /** Zusammenhang der Verse nach al-Biqāʿī (falls für diese Verse vorhanden). */
  function munasabaHtml(info) {
    const M = window.CONTENT_MUNASABA;
    if (!M) return "";
    const entries = info.unit.verses.map((v) => [v, M.verses[v.key]]).filter(([, e]) => e);
    if (!entries.length) return "";
    const first = entries[0][0];
    const page = M.pages.find((p) => first.surah === M.surah && first.ayah >= p.from && first.ayah <= p.to);
    const bridge =
      page && page.bridge && entries.some(([v]) => v.ayah === page.from)
        ? `<p class="mun-verse"><b>Brücke:</b> ${esc(page.bridge)}${page.bridgeQ ? `<span class="mun-q">❓ ${esc(page.bridgeQ)}</span>` : ""}</p>`
        : "";
    return `<details class="card munasaba">
      <summary>Zusammenhang der Verse (Munāsaba nach al-Biqāʿī)</summary>
      ${bridge}
      ${entries.map(([v, e]) => `<p class="mun-verse"><b>Vers ${v.ayah}:</b> ${esc(e.t)}${e.q ? `<span class="mun-q">❓ ${esc(e.q)}</span>` : ""}</p>`).join("")}
      ${page && page.thread ? `<div class="mun-thread"><b>Merkfaden der Seite:</b> ${esc(page.thread)}</div>` : ""}
    </details>`;
  }

  function learnBodyHtml(s, info) {
    const review = s.step !== "learn";
    const fifths = Math.min(...s.levels);
    let status;
    if (!review) {
      status = `<span class="pill pill-primary">Runde ${fifths + 1}</span>
        <span class="status-text">${fifths === 0 ? "Alles sichtbar" : fifths >= Fade.PARTS ? "Alles ausgegraut" : `${fifths}/${Fade.PARTS} ausgegraut`}</span>`;
    } else {
      status = `<span class="pill pill-gold">Wiederholung ${s.step.slice(-1)} / 3</span><span class="status-text">aus dem Gedächtnis</span>`;
    }
    const pages = [...new Set(info.unit.verses.map((v) => v.page))];
    return `
      <div class="status-row"><div class="left">${status}</div></div>
      <div class="range-caption">${esc(info.label)} · Seite ${pages.join("–")}${info.tail ? `<br><span class="next-note">Blau: Anfang des nächsten Verses als Anschluss</span>` : ""}</div>
      <div class="mushaf" id="mushaf">${mushafHtml(s, info)}</div>`;
  }

  function mushafHtml(s, info) {
    const levels = s.step === "learn" ? s.levels : s.levels.map(() => Fade.PARTS);
    return Mushaf.unitHtml(info.unit, {
      levels,
      shapes: info.shapes,
      wordIndex: info.wordIndex,
      activeKey: player.activeKey,
      tail: info.tail ? info.tail.tokens : [],
    });
  }

  /* ---- Pausen */

  function pauseState(s, k) {
    const p = s.pauses[k];
    const total = PAUSES[k];
    const left = p.started ? Math.max(0, (p.end - Date.now()) / 1000) : total;
    return { started: !!p.started, done: !!p.done, left, total };
  }

  function pauseBodyHtml(s) {
    const k = pauseIndex(s);
    if (!s.acts[k]) s.acts[k] = Activities.init(k);
    const t = pauseState(s, k);
    if (k === 0) return Activities.dhikrHtml(s.acts[0], t);
    if (k === 1) return Activities.quizHtml(s.acts[1], t);
    return Activities.textHtml(s.acts[2], t);
  }

  function startTimer(s, k) {
    const p = s.pauses[k];
    if (p.started) return;
    p.started = true;
    p.end = Date.now() + PAUSES[k] * 1000;
    p.done = false;
    save();
  }

  function finishTimer(s, k, notify) {
    const p = s.pauses[k];
    if (p.done) return;
    p.done = true;
    p.started = true;
    save();
    releaseWakeLock();
    if (notify) {
      chime();
      if (navigator.vibrate) navigator.vibrate([180, 90, 180]);
    }
  }

  function runPauseTicker(s) {
    const k = pauseIndex(s);
    const p = s.pauses[k];
    if (!p.started || p.done) return;
    requestWakeLock();
    const total = PAUSES[k];
    const tick = () => {
      const left = Math.max(0, (p.end - Date.now()) / 1000);
      const t = document.getElementById("ring-time");
      if (t) t.textContent = mmss(Math.ceil(left));
      const bar = document.getElementById("ring-bar");
      if (bar) {
        const c = 2 * Math.PI * 52;
        bar.setAttribute("stroke-dashoffset", String(c * (1 - left / total)));
      }
      const fill = document.getElementById("timer-bar-fill");
      if (fill) fill.style.width = (left / total) * 100 + "%";
      document.title = `${mmss(Math.ceil(left))} · Pause`;
      if (left <= 0) {
        stopTicker();
        finishTimer(s, k, true);
        render(true);
      }
    };
    tick();
    startTicker(tick);
  }

  /* ---- Abschluss */

  function reflectHtml(s) {
    const r = s.reflect;
    return `
      <div class="activity">
        <div class="done-icon small">${icon("check")}</div>
        <h1 class="h1 center">Abschnitt geschafft!</h1>
        <p class="lead center">Möchtest du noch festhalten, was du umsetzen willst?<br><b>Das Ausfüllen ist freiwillig</b> – du kannst auch direkt auf „Weiter“ klicken.</p>
        <label class="note-field"><span>Das kann ich aus diesem Abschnitt in den nächsten 24 Stunden umsetzen:</span>
          <textarea rows="3" data-field="reflect-d1" placeholder="freiwillig">${esc(r.d1 || "")}</textarea></label>
        <label class="note-field"><span>Das kann ich aus diesem Abschnitt in den nächsten sieben Tagen umsetzen:</span>
          <textarea rows="3" data-field="reflect-d7" placeholder="freiwillig">${esc(r.d7 || "")}</textarea></label>
        <label class="note-field"><span>Das kann ich aus diesem Abschnitt in meinem Leben umsetzen:</span>
          <textarea rows="3" data-field="reflect-life" placeholder="freiwillig">${esc(r.life || "")}</textarea></label>
      </div>`;
  }

  /* ---- Weiter / Zurück */

  function canGoBack(s) {
    return STEPS.indexOf(s.step) > 0 || (s.step === "learn" && Math.min(...s.levels) > 0);
  }

  function canGoNext(s) {
    if (s.mode === "test") return true;
    if (s.step === "assign") return s.emojis.every(Boolean);
    if (s.step === "order") return s.placed >= s.emojis.length;
    if (isPause(s)) return !!s.pauses[pauseIndex(s)].done;
    return true;
  }

  function nextLabel(s) {
    if (s.mode === "test" && isPause(s) && !s.pauses[pauseIndex(s)].done) return "Timer überspringen";
    if (s.step === "reflect") return "Weiter";
    return `Weiter`;
  }

  function hintText(s) {
    switch (s.step) {
      case "assign":
        return s.emojis.every(Boolean) ? "Alle Fragmente haben ein Emoji. Weiter zu 1b." : "Ordne jedem Fragment ein Emoji zu.";
      case "order":
        return s.placed >= s.emojis.length ? "Alles richtig eingesetzt. Weiter zum Auswendiglernen." : "Setze die Fragmente der Reihe nach ein.";
      case "learn": {
        const f = Math.min(...s.levels);
        if (f === 0) return "Hör zu und lies mit – so oft du willst. „Weiter“ graut ein Fünftel jedes Wortes aus.";
        if (f < Fade.PARTS) return "Lies weiter mit dem Rezitator. „Weiter“ graut ein weiteres Fünftel aus, „Zurück“ holt es wieder.";
        return `Alles ausgegraut. Nach „Weiter“ folgt eine Pause von ${PAUSES[0] >= 60 ? PAUSES[0] / 60 + " Minute" : PAUSES[0] + " Sekunden"}.`;
      }
      case "review1":
      case "review2":
        return "Sag den Abschnitt aus dem Gedächtnis auf. Danach folgt die nächste Pause.";
      case "review3":
        return "Letzte Wiederholung. Danach kommt der Abschluss.";
      case "reflect":
        return "Freiwillig – „Weiter“ schließt den Abschnitt ab.";
      default: {
        const k = pauseIndex(s);
        const p = s.pauses[k];
        if (!p.started) return "Starte die Minute mit „Los geht's“.";
        if (!p.done) return "Die Zeit läuft …";
        return "Zeit um. Weiter zur Wiederholung.";
      }
    }
  }

  function gotoStep(s, step) {
    s.step = step;
    if (isPause(s)) {
      const k = pauseIndex(s);
      if (!s.acts[k]) s.acts[k] = Activities.init(k);
      if (k > 0) startTimer(s, k);
    }
    save();
    render();
    window.scrollTo(0, 0);
  }

  function next() {
    const s = currentSession();
    if (!s) return;
    ensureAudioCtx();
    if (s.step === "learn" && !Fade.isDone(s.levels)) {
      s.levels = Fade.step(s.levels);
      save();
      render(true);
      return;
    }
    if (isPause(s)) {
      const k = pauseIndex(s);
      if (!s.pauses[k].done) {
        if (s.mode !== "test") return;
        finishTimer(s, k, false); // Testmodus: Timer überspringen
      }
    }
    if (s.step === "reflect") return completeUnit(s);
    const i = STEPS.indexOf(s.step);
    gotoStep(s, STEPS[i + 1]);
  }

  function back() {
    const s = currentSession();
    if (!s) return;
    if (s.step === "learn" && Math.min(...s.levels) > 0) {
      s.levels = s.levels.map((l) => Math.max(0, l - 1));
      save();
      render(true);
      return;
    }
    const i = STEPS.indexOf(s.step);
    if (i > 0) gotoStep(s, STEPS[i - 1]);
  }

  async function completeUnit(s) {
    const info = sessionInfo();
    const d = s.acts;
    state.journal.push({
      date: today(),
      label: `${info.label} · S. ${s.ref.page}`,
      dhikrCount: d[0] && d[0].count ? String(d[0].count) : "",
      learned: (d[1] && d[1].note) || "",
      takeaway: (d[2] && d[2].note) || "",
      d1: s.reflect.d1 || "",
      d7: s.reflect.d7 || "",
      life: s.reflect.life || "",
    });
    if (state.journal.length > 200) state.journal = state.journal.slice(-200);
    player.stop();
    if (s.mode === "test") {
      state.sessions.test = null;
      save();
      return go("unitDone", { mode: "test", ref: s.ref, label: info.label });
    }
    const p = state.progress;
    const day = planCtx.days[p.day];
    state.sessions.plan = null;
    if (p.unit + 1 < day.units.length) {
      p.unit++;
      save();
      return go("unitDone", { mode: "plan", label: info.label });
    }
    p.completed[p.day] = today();
    p.day++;
    p.unit = 0;
    p.lastDoneDate = today();
    save();
    go(p.day >= planCtx.days.length ? "planDone" : "dayDone");
  }

  function afterSession() {
    const s = currentSession();
    const info = sessionInfo();
    if (!s || !info) return;
    const el = document.getElementById("mushaf");
    if (el) Mushaf.fit(el);
    const prep = document.getElementById("prep");
    if (prep && s.step === "assign") {
      Prep.mountAssign(prep, { fragments: info.fragments, emojis: s.emojis, palette: s.palette, get showDe() { return s.showDe; }, set showDe(v) { s.showDe = v; } }, () => {
        save();
        refreshNav(s);
      });
    }
    if (prep && s.step === "order") {
      const st = { fragments: info.fragments, emojis: s.emojis, order: s.order, placed: s.placed, wheel: s.wheel };
      Prep.mountOrder(prep, st, () => {
        s.placed = st.placed;
        s.wheel = st.wheel;
        save();
        refreshNav(s);
      });
    }
    if (document.getElementById("player")) {
      const verses = info.unit.verses.map((v) => ({ surah: v.surah, ayah: v.ayah }));
      const tail = info.tail && { surah: info.tail.verse.surah, ayah: info.tail.verse.ayah, words: info.tail.complete ? info.tail.verseWords.length : TAIL_WORDS, verseWords: info.tail.verseWords };
      const sig = state.reciter + "|" + verses.map((v) => v.surah + ":" + v.ayah).join(",");
      if (player.signature !== sig) player.load(state.reciter, verses, tail);
      updatePlayerUi(true);
    }
    if (isPause(s)) runPauseTicker(s);
  }

  /** Weiter/Zurück und Hinweis aktualisieren, ohne den Inhalt neu zu zeichnen. */
  function refreshNav(s) {
    const nextBtn = document.querySelector('[data-action="next"]');
    if (nextBtn) nextBtn.disabled = !canGoNext(s);
    const backBtn = document.querySelector('[data-action="back"]');
    if (backBtn) backBtn.disabled = !canGoBack(s);
    const hint = document.getElementById("session-hint");
    if (hint) hint.textContent = hintText(s);
  }

  /* ------------------------------------------------------------- Abschlüsse */

  function doneScreen(title, text, buttons) {
    return `
      <div class="done-wrap">
        <div class="done-icon">${icon("check")}</div>
        <span class="eyebrow">Ma schā' Allāh</span>
        <h1 class="h1" style="text-align:center">${title}</h1>
        <p class="lead">${text}</p>
      </div>
      <footer class="footer">${buttons}</footer>`;
  }

  function viewUnitDone() {
    if (screen.mode === "test") {
      return doneScreen(
        "Viertel geschafft!",
        `${esc(screen.label)} ist gelernt.`,
        `<button class="btn" data-action="test-next">Nächstes Viertel ${icon("arrow")}</button>
         <button class="link-btn muted" data-action="test">Zur Auswahl</button>`
      );
    }
    const p = state.progress;
    const day = planCtx.days[p.day];
    return doneScreen(
      "Viertel geschafft!",
      `${esc(screen.label)} ist gelernt. Weiter mit Viertel ${p.unit + 1} von ${day.units.length}: ${esc(Quran.label(day.units[p.unit]))}.`,
      `<button class="btn" data-action="learn">Weiter ${icon("arrow")}</button>
       <button class="link-btn muted" data-action="home">Später weitermachen</button>`
    );
  }

  function viewDayDone() {
    const sched = planSchedule();
    const next = sched[state.progress.day];
    return doneScreen(
      "Tagespensum geschafft!",
      `Tag ${state.progress.day} ist gelernt.${next && next.date ? ` Nächster Lerntag: ${dateLabel(next.date)}.` : ""}`,
      `<button class="btn" data-action="home">Zur Übersicht</button>`
    );
  }

  function viewPlanDone() {
    return doneScreen(
      `Juz ${state.plan.juz} gelernt!`,
      "Du hast alle Lerntage deines Plans geschafft. Möge Allah es dir leicht machen, ihn zu bewahren.",
      `<button class="btn" data-action="new-plan">Neuen Plan erstellen</button>
       <button class="link-btn muted" data-action="home">Zur Übersicht</button>`
    );
  }

  async function testNext() {
    const ref = screen.ref;
    await Quran.loadPages([ref.page, ref.page + 1, ref.page + 2]);
    const parts = Quran.pageParts(ref.page);
    let page = ref.page;
    let part = ref.part + 1;
    if (part >= parts.length) {
      page = Math.min(604, page + 1);
      part = 0;
    }
    state.test.page = page;
    state.test.part = part;
    state.test.juz = Quran.juzOfPage(page);
    save();
    startTest(true);
  }

  /* ----------------------------------------------------------------- Player */

  function barFill(i) {
    const st = player.status;
    const frac = st === "ended" ? 1 : st === "idle" ? 0 : (player.index + player.progress) / (player.queue.length || 1);
    const a = i / BAR_HEIGHTS.length;
    const b = (i + 1) / BAR_HEIGHTS.length;
    return frac >= b ? 100 : frac <= a ? 0 : ((frac - a) / (b - a)) * 100;
  }

  function playerMeta() {
    const st = player.status;
    const c = player.current;
    const verses = player.queue.filter((x) => !x.basmala && !x.tail);
    if (st === "idle") return `${verses.length} ${verses.length === 1 ? "Vers" : "Verse"}`;
    if (st === "ended") return "Fertig";
    if (c && c.basmala) return "Basmala";
    if (c && c.tail) return "Anschluss";
    if (c) return `Vers ${verses.indexOf(c) + 1} / ${verses.length}`;
    return "";
  }

  function playerHtml() {
    const st = player.status;
    const busy = st === "loading";
    const playing = st === "playing" || busy;
    const bars = BAR_HEIGHTS.map((h, i) => `<span data-action="seek" data-value="${i}" style="height:${h}px"><i style="width:${barFill(i)}%"></i></span>`).join("");
    return `
      <button class="play-btn ${busy ? "loading" : ""}" data-action="play" aria-label="${playing ? "Pause" : "Abspielen"}">${icon(busy ? "loading" : playing ? "pause" : st === "ended" ? "replay" : "play")}</button>
      <div class="bars" aria-hidden="true">${bars}</div>
      <div class="player-meta"><b>${playerMeta()}</b>
        <button class="restart-btn" data-action="restart" ${st === "idle" ? "hidden" : ""}>${icon("replay")} Von vorn</button>
      </div>`;
  }

  let lastActive = null;
  let lastPlayerStatus = null;
  function updatePlayerUi(force) {
    const el = document.getElementById("player");
    if (el) {
      if (force || player.status !== lastPlayerStatus || !el.firstElementChild) {
        lastPlayerStatus = player.status;
        el.innerHTML = playerHtml();
      } else {
        el.querySelectorAll(".bars i").forEach((bar, i) => (bar.style.width = barFill(i) + "%"));
        const meta = el.querySelector(".player-meta b");
        if (meta) meta.textContent = playerMeta();
      }
    }
    const err = document.getElementById("player-error");
    if (err) err.hidden = player.status !== "error";
    const active = player.activeKey;
    if (active !== lastActive || force) {
      lastActive = active;
      document.querySelectorAll("#mushaf .t[data-key]").forEach((t) => t.classList.toggle("active", t.dataset.key === active));
    }
  }

  let sheetPreview = null;
  function onPlayerChange(p, kind) {
    if (screen.name === "session") updatePlayerUi();
    if (kind === "status") {
      const list = document.querySelector(".sheet .reciters");
      if (list) list.innerHTML = recitersHtml(state.reciter, sheetPreview);
    }
  }

  function recitersHtml(selected, previewing) {
    return Reciters.list
      .map(
        (r, i) => `
      <div class="reciter" role="radio" tabindex="0" aria-checked="${selected === r.id}" data-action="reciter" data-value="${r.id}">
        <span class="reciter-num">${i + 1}</span>
        <span class="reciter-name">${esc(r.name)}</span>
        <button class="mini-play" data-action="preview" data-value="${r.id}" aria-label="Hörprobe ${esc(r.short)}">
          ${icon(previewing === r.id && (player.status === "playing" || player.status === "loading") ? "pause" : "play")}
        </button>
      </div>`
      )
      .join("");
  }

  /* ------------------------------------------------------------ Timer/Ton */

  function startTicker(fn) {
    stopTicker();
    ticker = setInterval(fn, 250);
  }

  function stopTicker() {
    if (ticker) clearInterval(ticker);
    ticker = null;
  }

  async function requestWakeLock() {
    try {
      if ("wakeLock" in navigator && !wakeLock) {
        wakeLock = await navigator.wakeLock.request("screen");
        wakeLock.addEventListener("release", () => (wakeLock = null));
      }
    } catch (e) {
      wakeLock = null;
    }
  }

  function releaseWakeLock() {
    if (wakeLock) wakeLock.release().catch(() => {});
    wakeLock = null;
  }

  function ensureAudioCtx() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
    } catch (e) {
      audioCtx = null;
    }
  }

  function chime() {
    if (!audioCtx) return;
    const t0 = audioCtx.currentTime + 0.05;
    [659.25, 880, 1318.5].forEach((f, i) => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      const t = t0 + i * 0.18;
      o.type = "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
      o.connect(g).connect(audioCtx.destination);
      o.start(t);
      o.stop(t + 1.3);
    });
  }

  /* --------------------------------------------------------- Sheets/Dialog */

  function openSheet(html, onMount) {
    closeSheet();
    const el = document.createElement("div");
    el.className = "sheet-backdrop";
    el.id = "sheet";
    el.innerHTML = html;
    el.addEventListener("click", (e) => {
      if (e.target === el) closeSheet();
    });
    document.body.appendChild(el);
    if (onMount) onMount(el);
  }

  function closeSheet() {
    const el = document.getElementById("sheet");
    if (el) el.remove();
    if (sheetPreview) {
      sheetPreview = null;
      if (screen.name !== "session") player.stop();
    }
  }

  function openReciterSheet() {
    openSheet(
      `<div class="sheet" role="dialog" aria-label="Rezitator wählen">
        <div class="sheet-head"><div class="sheet-head-row"><h3>Rezitator</h3><button class="icon-btn" data-action="close-sheet" aria-label="Schließen">${icon("close")}</button></div></div>
        <div class="sheet-list"><div class="reciters">${recitersHtml(state.reciter, null)}</div></div>
      </div>`
    );
  }

  function confirmDialog(title, text, okLabel, onOk) {
    openSheet(
      `<div class="dialog" role="alertdialog">
        <h3>${title}</h3><p>${text}</p>
        <button class="btn" data-action="dialog-ok">${okLabel}</button>
        <button class="link-btn muted" data-action="close-sheet">Abbrechen</button>
      </div>`,
      (el) => {
        el.classList.add("dialog-backdrop");
        el.querySelector('[data-action="dialog-ok"]').addEventListener("click", (e) => {
          e.stopPropagation();
          closeSheet();
          onOk();
        });
      }
    );
  }

  /* ------------------------------------------------------------------ Events */

  async function handleAction(action, value, target, event) {
    const s = currentSession();
    switch (action) {
      case "home":
        return go(state.plan ? "home" : "setup");
      case "setup":
        return openSetup();
      case "new-plan":
        return openSetup();
      case "pick-juz":
        return openJuzSheet(draft.juz, "select-juz");
      case "select-juz":
        draft.juz = +value;
        closeSheet();
        return render(true);
      case "weekday": {
        const d = +value;
        draft.weekdays = target.checked ? [...new Set([...draft.weekdays, d])] : draft.weekdays.filter((x) => x !== d);
        return render(true);
      }
      case "daily":
        draft.daily = +value;
        return render(true);
      case "start-plan":
        return startPlan(false);
      case "learn":
        return openPlanSession();
      case "toggle-days":
        showAllDays = !showAllDays;
        return render(true);
      case "change-reciter":
        return openReciterSheet();
      case "reciter":
        state.reciter = value;
        save();
        player.stop();
        player.signature = null;
        closeSheet();
        return render(true);
      case "preview":
        event.stopPropagation();
        if (sheetPreview === value && (player.status === "playing" || player.status === "loading")) {
          player.stop();
        } else {
          sheetPreview = value;
          player.preview(value, 1, 2);
        }
        return;
      case "close-sheet":
        return closeSheet();
      // Testmodus
      case "test":
        go("testpick");
        return;
      case "test-pick-juz":
        return openJuzSheet(state.test.juz, "test-select-juz");
      case "test-select-juz": {
        const j = Quran.juz(+value);
        state.test = { juz: j.n, page: j.p0, part: 0 };
        save();
        closeSheet();
        return render(true);
      }
      case "test-page":
        state.test.page = +value;
        state.test.part = 0;
        save();
        return render(true);
      case "test-part":
        return selectTestPart(+value);
      case "test-start":
        return startTest();
      case "test-next":
        return testNext();
      // Sitzung
      case "close-session":
        player.stop();
        return go(s && s.mode === "test" ? "testpick" : state.plan ? "home" : "setup");
      case "next":
        return next();
      case "back":
        return back();
      case "goto-step":
        if (s && s.mode === "test") gotoStep(s, value);
        return;
      case "timer-start":
        if (s && isPause(s)) {
          ensureAudioCtx();
          startTimer(s, pauseIndex(s));
          render(true);
        }
        return;
      case "quiz-answer": {
        const a = s.acts[1];
        const qid = a.order[a.pos];
        if (a.answers[qid] === undefined && !s.pauses[1].done) {
          a.answers[qid] = +value;
          save();
          render(true);
        }
        return;
      }
      case "quiz-next":
        s.acts[1].pos++;
        save();
        return render(true);
      case "text-answer":
        if (s.acts[2].choice === null) {
          s.acts[2].choice = +value;
          save();
          render(true);
        }
        return;
      case "play":
        ensureAudioCtx();
        return player.toggle();
      case "restart":
        return player.restart();
      case "seek": {
        const q = player.queue.length;
        if (q) player.playIndex(Math.min(q - 1, Math.floor((+value / BAR_HEIGHTS.length) * q)));
        return;
      }
      default:
    }
  }

  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (el) {
      if (el.tagName === "INPUT") return; // Checkboxen/Radios über "change"
      if (el.tagName === "BUTTON" && el.disabled) return;
      handleAction(el.dataset.action, el.dataset.value, el, e);
      return;
    }
    // Tippen auf einen Vers spielt ab diesem Vers
    const tok = e.target.closest("#mushaf .t[data-key]");
    if (tok) {
      ensureAudioCtx();
      player.playFromKey(tok.dataset.key);
    }
  });

  document.addEventListener("change", (e) => {
    const el = e.target.closest("input[data-action]");
    if (el) handleAction(el.dataset.action, el.dataset.value, el, e);
  });

  // Eingaben (Anzahl, Notizen) sofort speichern
  document.addEventListener("input", (e) => {
    const field = e.target.dataset && e.target.dataset.field;
    const s = currentSession();
    if (!field || !s) return;
    const v = e.target.value;
    if (field === "dhikr-count") s.acts[0].count = v;
    else if (field === "quiz-note") s.acts[1].note = v;
    else if (field === "text-note") s.acts[2].note = v;
    else if (field === "reflect-d1") s.reflect.d1 = v;
    else if (field === "reflect-d7") s.reflect.d7 = v;
    else if (field === "reflect-life") s.reflect.life = v;
    save();
  });

  document.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches('.reciter[role="radio"]')) {
      e.preventDefault();
      handleAction("reciter", e.target.dataset.value, e.target, e);
    }
    if (e.key === "Escape") closeSheet();
  });

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      for (const id of ["mushaf", "mini-page"]) {
        const el = document.getElementById(id);
        if (el) Mushaf.fit(el);
      }
    }, 120);
  });

  document.addEventListener("visibilitychange", () => {
    const s = currentSession();
    if (document.visibilityState === "visible" && isPause(s)) requestWakeLock();
  });

  /* ------------------------------------------------------------------ Start */

  async function init() {
    render();
    try {
      if (document.fonts && document.fonts.load) await Promise.race([document.fonts.load('20px "UthmanicHafs"'), new Promise((r) => setTimeout(r, 4000))]);
      await loadPlanContext();
      // Abgelaufene Timer beim Laden abschließen
      for (const s of [state.sessions.plan, state.sessions.test]) {
        if (!s) continue;
        s.pauses.forEach((p, k) => {
          if (p.started && !p.done && Date.now() >= p.end) p.done = true;
        });
      }
      save();
    } catch (e) {
      screen = { name: "loading", message: "Die Daten konnten nicht geladen werden. Bitte lade die Seite neu." };
      render();
      return;
    }
    if (params.has("test")) return go("testpick");
    if (!state.plan) return openSetup();
    go("home");
  }

  init();
})();
