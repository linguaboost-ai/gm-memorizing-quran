/*
 * German Method – Hifz: Screens, Zustand und Ablauf.
 *
 * Plan (drei Screens): Sure, Lerntage in der Woche, Menge pro Tag (¼–2
 * Seiten). Gelernt wird in Seitenvierteln des Madani-Mushaf.
 *
 * Ablauf pro Seitenviertel:
 *   1  Vorbereitung   1a Emojis den Fragmenten zuordnen, 1b Reihenfolge finden,
 *                     1c Munāsaba zwischen die Fragmente setzen (falls vorhanden)
 *   2  Auswendiglernen  im Mushaf oder in der Fragment-Ansicht (mit Emojis,
 *                       Übersetzung, Munāsaba); Ausgrauen in Fünfteln (Weiter/Zurück), dann
 *                       Pause 1 Min (Dhikr) → Wiederholung → Pause 2 Min (Quiz)
 *                       → Wiederholung → Pause 4 Min (Text) → Wiederholung
 *   3  Abschluss       freiwillige Notizen zur Umsetzung
 *
 * Zum Testen gibt es eine freie Auswahl (Sure → Seite → Bereich, je ein Screen)
 * mit freier Navigation zwischen allen Schritten.
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
  const DEFAULT_SURAH = 67;
  const TEST_DEFAULT = { surah: 40, page: 467, part: 0 };
  const DEFAULT_PREFS = { de: false };

  const STEPS = ["assign", "order", "link", "learn", "pause1", "review1", "pause2", "review2", "pause3", "review3", "reflect"];
  // Die Vorbereitung (1a Emojis, 1b Reihenfolge, 1c Munāsaba, Fragment-Ansicht)
  // ist vorerst aus dem Ablauf genommen; sie kommt später an anderer Stelle wieder.
  const PREP_ENABLED = false;
  const PREP_STEPS = ["assign", "order", "link"];
  const STEP_LABEL = {
    assign: "1a Emojis",
    order: "1b Reihenfolge",
    link: "1c Munāsaba",
    learn: "2 Lernen",
    pause1: "1 Min",
    review1: "Wdh. 1",
    pause2: "2 Min",
    review2: "Wdh. 2",
    pause3: "4 Min",
    review3: "Wdh. 3",
    reflect: "3 Abschluss",
  };
  const STEP_GROUP = {
    assign: "Vorbereitung",
    order: "Vorbereitung",
    link: "Vorbereitung",
    learn: "Auswendiglernen",
    pause1: "Pause · Dhikr",
    review1: "Wiederholung",
    pause2: "Pause · Quiz",
    review2: "Wiederholung",
    pause3: "Pause · Lesetext",
    review3: "Wiederholung",
    reflect: "Abschluss",
  };

  const ICONS = {
    close: "M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z",
    play: "M8 5v14l11-7z",
    pause: "M6 19h4V5H6v14zm8-14v14h4V5h-4z",
    replay: "M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z",
    loading: "M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z",
    check: "M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z",
    chevron: "M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z",
    chevronLeft: "M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z",
    back: "M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z",
    arrow: "M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z",
    home: "M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z",
    calendar: "M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11zM7 11h5v5H7z",
    notes: "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z",
    tune: "M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z",
  };
  const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name]}"/></svg>`;


  /* ---------------------------------------------------------------- Zustand */

  const blankState = () => ({
    v: 2,
    reciter: "afasy",
    plan: null,
    progress: null,
    sessions: { plan: null, test: null },
    test: Object.assign({}, TEST_DEFAULT),
    prefs: Object.assign({}, DEFAULT_PREFS),
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
    // Pläne nach Juz gibt es nicht mehr: neu einrichten (nach Sure)
    if (state.plan && !state.plan.surah) {
      state.plan = null;
      state.progress = null;
      state.sessions.plan = null;
    }
    if (!state.test || !state.test.surah) {
      state.test = Object.assign({}, TEST_DEFAULT);
      state.sessions.test = null;
    }
    state.prefs = Object.assign({}, DEFAULT_PREFS, state.prefs);
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
  const suraName = (n) => Quran.meta(n).tr;
  const pagesOf = (m) => (m.p1 !== m.p0 ? `S. ${m.p0}–${m.p1}` : `S. ${m.p0}`);
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

  const player = new Player(onPlayerChange);

  async function loadPlanContext() {
    if (!state.plan) {
      planCtx = null;
      return;
    }
    await Quran.loadSurahPages(state.plan.surah);
    planCtx = { days: Quran.planDays(state.plan.surah, state.plan.daily) };
  }

  const refKey = (ref) => `${ref.page}:${ref.part}:${ref.surah || 0}`;

  /** Alles, was für ein Seitenviertel gebraucht wird. */
  async function unitContext(ref) {
    const key = refKey(ref);
    if (unitCache.has(key)) return unitCache.get(key);
    await Quran.loadPages([ref.page, ref.page + 1]);
    const list = Quran.surahPageParts(ref.page, ref.surah);
    const idx = Math.max(0, list.findIndex((u) => u.part === ref.part));
    const unit = list[idx];
    const words = Quran.wordsOf(unit);
    const fragments = Prep.fragmentsOf(unit);
    // Ausgrauen nach der dargestellten Form (mit Kaschida); Tatweel zählt nicht mit
    const shapes = words.map((w) => Fade.analyze(w.display));
    const wordIndex = new Map(words.map((w, i) => [w, i]));
    const tail = Quran.tailOf(unit, TAIL_WORDS);
    const info = {
      ref,
      unit,
      parts: list.length,
      partNo: idx + 1,
      words,
      shapes,
      wordIndex,
      tail,
      totals: shapes.map((s) => s.total),
      fragments,
      mun: Prep.munasabaOf(unit, fragments),
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
        ref: { page: ref.page, part: ref.part, surah: ref.surah },
        step: stepsOf(info)[0],
        levels: new Array(info.words.length).fill(0),
        emojis: new Array(info.fragments.length).fill(null),
        palette: Prep.palette(info.fragments),
        order: Prep.shuffle(info.fragments.map((f) => f.id)),
        placed: 0,
        wheel: 0,
        linkOrder: info.mun ? Prep.shuffle(info.mun.map((_, i) => i)) : [],
        linkPlaced: info.mun ? info.mun.map(() => false) : [],
        // Lernen beginnt in der Fragment-Ansicht, Emojis und Munāsaba zunächst an
        view: "frag",
        show: { emoji: true, mun: true },
        pauses: [{}, {}, {}],
        acts: [null, null, null],
        reflect: { d1: "", d7: "", life: "" },
      },
      extra || {}
    );
  }

  /** Passt die Sitzung zu diesem Abschnitt? (sonst neu beginnen) */
  function sessionFits(s, ref, info) {
    const fits =
      !!s && s.ref.page === ref.page && s.ref.part === ref.part && (s.ref.surah || 0) === (ref.surah || 0) && s.levels.length === info.words.length && Array.isArray(s.linkPlaced) && s.linkPlaced.length === (info.mun ? info.mun.length : 0);
    // Schritt, den es (nicht mehr) gibt: beim ersten Schritt weitermachen
    if (fits && !stepsOf(info).includes(s.step)) s.step = stepsOf(info)[0];
    return fits;
  }

  /** Munāsaba erst anzeigen, wenn sie in 1c richtig eingesetzt wurde. */
  const munReady = (s, info) => !!info.mun && s.linkPlaced.length > 0 && s.linkPlaced.every(Boolean);

  /** Emojis der Fragmente; im Testmodus übersprungene aus der Vorlage. */
  const emojisOf = (s, info) => info.fragments.map((f, i) => s.emojis[i] || f.emoji || null);

  const viewOf = (s) => (PREP_ENABLED && s.view !== "mushaf" ? "frag" : "mushaf");
  const showOf = (s) => Object.assign({ emoji: true, mun: true }, s.show);

  /** Schritte dieses Abschnitts: 1c nur, wenn es eine Munāsaba gibt. */
  function stepsOf(info) {
    if (!PREP_ENABLED) return STEPS.filter((x) => !PREP_STEPS.includes(x));
    return info && info.mun ? STEPS : STEPS.filter((x) => x !== "link");
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

  /* ------------------------------------------------------- Screens-Bausteine */

  /** Fortschritt eines mehrteiligen Ablaufs (ein Schritt pro Screen). */
  function wizardSteps(labels, current) {
    const pct = Math.round(((current + 1) / labels.length) * 100);
    return `<div class="progress run" aria-label="Schritt ${current + 1} von ${labels.length}: ${esc(labels[current])}">
      <div class="progress-bar"><span style="width:${pct}%"></span></div><span class="progress-score step">${current + 1}/${labels.length}</span></div>`;
  }

  const fold = (x) =>
    String(x || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[‘’'`ʿʾ\-\s]/g, "")
      // Umschrift-Varianten: Ghāfir/Ġāfir, Kahf/Ḫ…, Shams/Šams, …
      .replace(/([gkstd])h/g, "$1")
      .replace(/(.)\1/g, "$1");

  function suraListHtml(selected, action, query) {
    const q = fold(query);
    const list = Quran.surahs.filter((m) => !q || String(m.n) === q || fold(m.tr).includes(q) || fold(m.de).includes(q) || m.ar.includes((query || "").trim()));
    if (!list.length) return `<p class="hint">Keine Sure gefunden.</p>`;
    return list
      .map(
        (m) => `<button class="sura-row" data-action="${action}" data-value="${m.n}" aria-selected="${m.n === selected}">
          <span class="num-badge">${m.n}</span>
          <span class="picker-main"><strong>${esc(m.tr)}</strong><span>${esc(m.de)} · ${m.ayahs} Verse · ${pagesOf(m)}</span></span>
          <span class="picker-ar">${esc(m.ar)}</span>
        </button>`
      )
      .join("");
  }

  function suraPickHtml(selected, action, query) {
    return `<input class="search" type="search" placeholder="Sure suchen – Name oder Nummer" data-field="sura-search" value="${esc(query || "")}" autocomplete="off" />
      <div class="sura-list" id="sura-list">${suraListHtml(selected, action, query)}</div>`;
  }

  /* ------------------------------------------------------------------ Setup */

  const SETUP_STEPS = ["Sure", "Lerntage", "Menge"];

  function openSetup() {
    const p = state.plan;
    draft = {
      step: 0,
      query: "",
      surah: p ? p.surah : DEFAULT_SURAH,
      weekdays: p ? p.weekdays.slice() : [1, 2, 3, 4, 5],
      daily: p ? p.daily : 0.5,
    };
    go("setup");
  }

  function viewSetup() {
    const canClose = !!state.plan;
    const st = draft.step;
    const m = Quran.meta(draft.surah);
    let body;
    let footer;
    if (st === 0) {
      body = `
        ${canClose ? "" : `<div class="basmala">${esc(Quran.basmala)}</div>`}
        ${heading("Dein Lernplan · <span class=\"multi\">Sure</span>", "Welche Sure möchtest du auswendig lernen?", "Gelernt wird im Madani-Mushaf, Seite für Seite – immer in ganzen Versen.")}
        ${suraPickHtml(draft.surah, "setup-sura", draft.query)}`;
      footer = `<button class="btn" data-action="setup-next">Weiter mit ${esc(m.tr)} ${icon("arrow")}</button>
        ${canClose ? "" : `<button class="link-btn muted" data-action="test">Zum Testen: freie Auswahl</button>`}`;
    } else if (st === 1) {
      body = `
        ${heading(`${esc(m.tr)} · <span class="multi">Lerntage</span>`, "An welchen Tagen willst du lernen?", "Mehrere Antworten sind möglich.")}
        <div class="options weekday-list" role="group" aria-label="Lerntage">
          ${WEEKDAYS.map((w) => {
            const on = draft.weekdays.includes(w.d);
            return `<label class="option ${on ? "selected" : ""}">
              <input type="checkbox" data-action="weekday" data-value="${w.d}" ${on ? "checked" : ""} />
              <span class="box">${on ? "✓" : ""}</span><span class="option-text">${w.long}</span></label>`;
          }).join("")}
        </div>`;
      footer = `<button class="btn" data-action="setup-next" ${draft.weekdays.length ? "" : "disabled"}>Weiter ${icon("arrow")}</button>`;
    } else {
      body = `
        ${heading(`${esc(m.tr)} · <span class="multi">${WEEKDAYS.filter((w) => draft.weekdays.includes(w.d)).map((w) => w.short).join(", ")}</span>`, "Wie viel pro Tag?", "Menge in Mushaf-Seiten. Gelernt wird in Seitenvierteln.")}
        <div class="options options-5" role="radiogroup" aria-label="Menge pro Tag">
          ${DAILY_OPTIONS.map(
            (v) => `<label class="option ${draft.daily === v ? "selected" : ""}">
              <input type="radio" name="daily" data-action="daily" data-value="${v}" ${draft.daily === v ? "checked" : ""} />
              <b>${dailyLabel(v)}</b><span>${v > 1 ? "Seiten" : "Seite"}</span></label>`
          ).join("")}
        </div>
        <div class="card summary" id="plan-summary">${summaryHtml(null)}</div>`;
      footer = `<button class="btn" data-action="start-plan">Plan erstellen</button>`;
    }
    return `
      <header class="topbar kit">
        ${st > 0 ? `<button class="icon-btn" data-action="setup-back" aria-label="Zurück">${icon("back")}</button>` : canClose ? `<button class="icon-btn" data-action="home" aria-label="Schließen">${icon("close")}</button>` : `<span class="topbar-side"></span>`}
        <span class="topbar-title">${canClose ? "Neuer Lernplan" : "Dein Lernplan"}</span>
        <span class="topbar-side"></span>
      </header>
      ${wizardSteps(SETUP_STEPS, st)}
      <main class="content">${body}</main>
      <footer class="footer">${footer}</footer>`;
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
    if (!days) return `<span class="label">Dein Plan</span><div class="summary-row">Wird berechnet …</div>`;
    const dates = scheduleDates(days.length, draft.weekdays, new Date());
    const units = days.reduce((s, d) => s + d.units.length, 0);
    const last = dates[dates.length - 1];
    return `
      <span class="label">So sieht dein Plan aus</span>
      <div class="summary-row"><b>${days.length}</b> ${days.length === 1 ? "Lerntag" : "Lerntage"} · je ca. ${pagesLabel(draft.daily)}</div>
      <small>${units} Seitenviertel · voraussichtlich fertig: ${dateLabel(last)}${last.getFullYear() !== new Date().getFullYear() ? last.getFullYear() : ""}<br>
      Jedes Viertel: Auswendiglernen im Mushaf mit Pausen von 1, 2 und 4 Minuten, Abschluss.</small>`;
  }

  async function afterSetup() {
    if (draft.step !== 2) return;
    const token = (afterSetup.token = (afterSetup.token || 0) + 1);
    await Quran.loadSurahPages(draft.surah);
    if (token !== afterSetup.token || screen.name !== "setup") return;
    const el = document.getElementById("plan-summary");
    if (el) el.innerHTML = summaryHtml(Quran.planDays(draft.surah, draft.daily));
  }

  async function startPlan(confirmed) {
    const hasProgress = state.plan && state.progress && (state.progress.day > 0 || state.progress.unit > 0 || state.sessions.plan);
    if (hasProgress && !confirmed) {
      return confirmDialog("Neuen Plan erstellen?", "Dein bisheriger Fortschritt im Plan wird dabei zurückgesetzt.", "Neuen Plan erstellen", () => startPlan(true));
    }
    state.plan = { surah: draft.surah, weekdays: draft.weekdays.slice(), daily: draft.daily, created: today() };
    state.progress = { day: 0, unit: 0, completed: [], lastDoneDate: null };
    state.sessions.plan = null;
    save();
    go("loading");
    await loadPlanContext();
    go("home");
  }

  /* ------------------------------------------------------------------- Home */

  const TABS = [
    ["today", "Heute", "home"],
    ["plan", "Plan", "calendar"],
    ["notes", "Notizen", "notes"],
    ["more", "Einstellungen", "tune"],
  ];

  /** Termine: erledigte Tage mit Datum, offene ab heute auf den Lerntagen. */
  function planSchedule() {
    const p = state.progress;
    const days = planCtx.days;
    const doneToday = p.lastDoneDate === today() && !state.sessions.plan;
    const upcoming = scheduleDates(Math.max(0, days.length - p.day), state.plan.weekdays, doneToday ? addDays(new Date(), 1) : new Date());
    return days.map((d, i) => (i < p.day ? { done: true, date: p.completed[i] ? parseIso(p.completed[i]) : null } : { done: false, date: upcoming[i - p.day] }));
  }

  function viewHome() {
    const tab = screen.tab || "today";
    const p = state.progress;
    const total = planCtx.days.length;
    const finished = p.day >= total;
    const pct = Math.round((Math.min(p.day, total) / total) * 100);
    const m = Quran.meta(state.plan.surah);
    const sched = planSchedule();
    let body = "";
    if (tab === "today") {
      body = `
        <div class="card hello">
          <div class="hello-main"><span>Assalamu 'Alaikum</span><strong>Dein Hifz-Plan</strong></div>
          <span class="chip">${finished ? "Fertig" : `Tag ${p.day + 1} / ${total}`}</span>
        </div>
        <div class="basmala">${esc(Quran.basmala)}</div>
        <h1 class="hero-title">${finished ? `${esc(m.tr)} ist geschafft.` : `Lerne ${esc(m.tr)} auswendig.`}</h1>
        ${todayCardHtml(finished, sched)}
        <button class="card progress-card" data-action="tab" data-value="plan">
          <span class="progress-head"><strong>Dein Weg</strong><small>${pct} % · ${Math.min(p.day, total)} von ${total} Lerntagen</small></span>
          <span class="progress" aria-hidden="true"><i style="width:${pct}%"></i></span>
        </button>`;
    } else if (tab === "plan") {
      body = `
        <h1 class="h1">Dein Weg</h1>
        <p class="lead">${esc(m.tr)} · ${pagesLabel(state.plan.daily)} pro Tag · ${total} Lerntage</p>
        <div class="card">
          <div class="progress" aria-label="Fortschritt"><i style="width:${pct}%"></i></div>
          <div class="days" style="margin-top:6px">${daysHtml(sched)}</div>
        </div>`;
    } else if (tab === "notes") {
      body = `<h1 class="h1">Deine Notizen</h1>${journalHtml()}`;
    } else {
      const reciter = Reciters.byId(state.reciter);
      const names = WEEKDAYS.filter((w) => state.plan.weekdays.includes(w.d)).map((w) => w.short).join(", ");
      body = `
        <h1 class="h1">Einstellungen</h1>
        <div class="card">
          <div class="settings-row"><div><small>Sure</small><strong>${m.n}. ${esc(m.tr)} · ${pagesOf(m)}</strong></div></div>
          <div class="settings-row"><div><small>Lerntage</small><strong>${names}</strong></div></div>
          <div class="settings-row"><div><small>Pro Tag</small><strong>${pagesLabel(state.plan.daily)}</strong></div></div>
          <div class="settings-row"><div><small>Rezitator</small><strong>${esc(reciter.name)}</strong></div><button class="link-btn" data-action="change-reciter">Ändern</button></div>
          <div style="padding-top:12px"><button class="btn secondary" data-action="new-plan">Neuen Plan erstellen</button></div>
        </div>
        <div class="section-title"><h2>Zum Testen</h2></div>
        <button class="card picker" data-action="test">
          <span class="num-badge">${icon("arrow")}</span>
          <span class="picker-main"><strong>Freie Auswahl</strong><span>Sure, Seite und Bereich direkt wählen – unabhängig vom Plan</span></span>
          <svg class="chevron" viewBox="0 0 24 24"><path d="${ICONS.chevron}"/></svg>
        </button>
        <p class="credits">Text &amp; Seitenlayout: King Fahd Complex (KFGQPC Uthmanic Hafs) via <a href="https://quran.ws" target="_blank" rel="noopener">quran.ws</a> (CC BY 4.0) · Audio: <a href="https://everyayah.com" target="_blank" rel="noopener">everyayah.com</a></p>`;
    }
    return `
      <main class="content with-tabbar" style="padding-top:max(20px, env(safe-area-inset-top))">${body}</main>
      <nav class="tabbar" aria-label="Bereiche">${TABS.map(
        ([id, label, ic]) => `<button data-action="tab" data-value="${id}" ${id === tab ? 'aria-current="page"' : ""}>${icon(ic)}<span>${label}</span></button>`
      ).join("")}</nav>`;
  }

  function todayCardHtml(finished, sched) {
    if (finished) {
      return `<div class="card today-card">
        <span class="label">Ma schā' Allāh</span>
        <h2 class="today-title">Alle ${planCtx.days.length} Lerntage geschafft</h2>
        <p class="today-meta left">Wiederhole die Sure regelmäßig, damit sie bleibt.</p>
        <button class="btn" data-action="new-plan">Neuen Plan erstellen</button>
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
      button = `<button class="btn" data-action="learn">Weiterlernen</button>`;
    } else if (isToday) {
      head = `Heute · ${dateLabel(date)}`;
      button = `<button class="btn" data-action="learn">Jetzt lernen</button>`;
    } else {
      head = doneToday ? "Für heute geschafft ✓" : `Nächster Lerntag: ${date ? dateLabel(date) : "–"}`;
      button = `<button class="btn" data-action="learn">Tag ${p.day + 1} jetzt schon lernen</button>`;
    }
    return `<div class="card today-card">
      <div class="today-head"><span class="label">Tagespensum · Tag ${p.day + 1}</span><span class="chip">${pagesLabel(day.size)}</span></div>
      <h2 class="today-title">${head}</h2>
      <ol class="unit-list">${units}</ol>
      ${button}
    </div>`;
  }

  function daysHtml(sched) {
    const p = state.progress;
    return planCtx.days
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
          <span>${pagesLabel(d.size)} · ${d.units.length} Viertel · S. ${first.page}${last.page !== first.page ? "–" + last.page : ""}</span></span>
          ${current ? `<span class="chip now">Als Nächstes</span>` : ""}
        </div>`;
      })
      .join("");
  }

  function journalHtml() {
    const items = (state.journal || []).slice().reverse();
    if (!items.length) return `<div class="card empty-note"><p>Noch keine Notizen. Nach jedem Abschnitt kannst du festhalten, was du gelernt hast und umsetzen willst.</p></div>`;
    return `<div class="card journal">${items
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

  const TEST_STEPS = ["sura", "page", "area"];

  function viewTestPick() {
    const t = state.test;
    const step = screen.step || "sura";
    const k = TEST_STEPS.indexOf(step);
    const m = Quran.meta(t.surah);
    let body = "";
    let footer = "";
    if (step === "sura") {
      body = `
        ${heading("Freie Auswahl · <span class=\"multi\">Sure</span>", "Welche Sure?", "Zum Testen – unabhängig vom Plan. Alle Schritte lassen sich frei ansteuern, Timer kannst du überspringen.")}
        ${suraPickHtml(t.surah, "test-sura", screen.query)}`;
      footer = `<button class="btn" data-action="test-goto" data-value="page">Weiter mit ${esc(m.tr)} ${icon("arrow")}</button>`;
    } else if (step === "page") {
      body = `
        ${heading(`${m.n}. ${esc(m.tr)} · <span class="multi">Seite</span>`, "Welche Seite?", `${m.p1 > m.p0 ? `${m.p1 - m.p0 + 1} Seiten im Madani-Mushaf` : "Die Sure steht auf einer Seite"}.`)}
        <div class="page-grid" id="page-grid"><div class="loading-screen">Lädt …</div></div>`;
    } else {
      const reciter = Reciters.byId(state.reciter);
      body = `
        ${heading(`${m.n}. ${esc(m.tr)} · <span class="multi">Seite ${t.page}</span>`, "Welcher Bereich?", "Die Seite ist in Viertel aus ganzen Versen geteilt. Tippe auf ein Viertel.")}
        <div class="mini-wrap">
          <div class="mushaf mini" id="mini-page"><div class="loading-screen">Lädt …</div></div>
          <div class="part-list" id="part-list"></div>
        </div>
        <div class="settings-row card" style="padding:12px 16px"><div><small>Rezitator</small><strong>${esc(reciter.name)}</strong></div><button class="link-btn" data-action="change-reciter">Ändern</button></div>`;
      footer = `<button class="btn" data-action="test-start">Auswendiglernen starten</button>`;
    }
    return `
      <header class="topbar kit">
        ${
          k > 0
            ? `<button class="icon-btn" data-action="test-goto" data-value="${TEST_STEPS[k - 1]}" aria-label="Zurück">${icon("back")}</button>`
            : `<button class="icon-btn" data-action="${state.plan ? "home" : "setup"}" aria-label="Schließen">${icon("close")}</button>`
        }
        <span class="topbar-title">Freie Auswahl</span>
        <span class="topbar-side"></span>
      </header>
      ${wizardSteps(["Sure", "Seite", "Bereich"], k)}
      <main class="content">${body}</main>
      ${footer ? `<footer class="footer">${footer}</footer>` : ""}`;
  }

  async function afterTestPick() {
    const t = state.test;
    const step = screen.step || "sura";
    if (step === "sura") return;
    if (step === "page") {
      await Quran.loadSurahPages(t.surah);
      if (screen.name !== "testpick" || screen.step !== "page") return;
      const m = Quran.meta(t.surah);
      const chips = [];
      for (let p = m.p0; p <= m.p1; p++) {
        const vs = Quran.versesStartingOn(p).filter((v) => v.surah === t.surah);
        const range = vs.length ? (vs.length > 1 ? `Vers ${vs[0].ayah}–${vs[vs.length - 1].ayah}` : `Vers ${vs[0].ayah}`) : "Fortsetzung";
        chips.push(`<button class="page-chip" data-action="test-page" data-value="${p}" aria-selected="${p === t.page}"><b>${p}</b><span>${range}</span></button>`);
      }
      document.getElementById("page-grid").innerHTML = chips.join("");
      const sel = document.querySelector('.page-chip[aria-selected="true"]');
      if (sel) sel.scrollIntoView({ block: "nearest" });
      return;
    }
    await Quran.loadPages([t.page, t.page + 1]);
    if (screen.name !== "testpick" || screen.step !== "area") return;
    const parts = Quran.surahPageParts(t.page, t.surah);
    let idx = parts.findIndex((u) => u.part === t.part);
    if (idx < 0) {
      idx = 0;
      t.part = parts.length ? parts[0].part : 0;
      save();
    }
    const mini = document.getElementById("mini-page");
    mini.innerHTML = Mushaf.pageHtml(t.page, parts);
    mini.dataset.selected = idx;
    Mushaf.fit(mini);
    document.getElementById("part-list").innerHTML = parts
      .map(
        (u, i) => `<button class="part-row" data-action="test-part" data-value="${i}" data-q="${i}" aria-selected="${i === idx}">
          <span class="part-dot q${i}"></span><span><strong>Viertel ${u.part + 1}</strong><small>${esc(Quran.label(u))}</small></span></button>`
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
    const parts = Quran.surahPageParts(state.test.page, state.test.surah);
    if (!parts[i]) return;
    state.test.part = parts[i].part;
    save();
    const mini = document.getElementById("mini-page");
    if (mini) mini.dataset.selected = i;
    document.querySelectorAll(".part-row").forEach((r) => r.setAttribute("aria-selected", String(+r.dataset.value === i)));
  }

  async function startTest(fresh) {
    const ref = { page: state.test.page, part: state.test.part, surah: state.test.surah };
    const info = await unitContext(ref);
    ref.part = info.unit.part;
    // gleiche Auswahl: begonnene Sitzung fortsetzen
    if (fresh || !sessionFits(state.sessions.test, ref, info)) {
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
    const ref = { page: unit.page, part: unit.part, surah: state.plan.surah };
    const info = await unitContext(ref);
    let s = state.sessions.plan;
    if (!sessionFits(s, ref, info)) {
      s = state.sessions.plan = newSession("plan", ref, info, { day: p.day, unit: p.unit });
      save();
    }
    go("session", { mode: "plan" });
  }

  function sessionInfo() {
    const s = currentSession();
    return s && unitCache.get(refKey(s.ref));
  }

  function sessionTitle(s, info) {
    if (s.mode === "test") return `Test · ${info.label}`;
    return `Tag ${s.day + 1} · ${info.label}`;
  }

  /** Fortschritt wie im Design-Kit: Balken über alle Schritte des Abschnitts. */
  function progressHtml(s, info) {
    const steps = stepsOf(info);
    const idx = steps.indexOf(s.step);
    const pct = Math.round(((idx + 1) / steps.length) * 100);
    const where = s.mode === "test" ? `Viertel ${info.partNo}/${info.parts}` : `Viertel ${s.unit + 1}/${planCtx.days[s.day].units.length}`;
    return `<div class="progress run"><div class="progress-bar"><span style="width:${pct}%"></span></div><span class="progress-score">${where}</span></div>`;
  }

  /** Kopfzeile: Schließen, Titel, Schritt. Im Testmodus mit Pfeilen und Schrittliste. */
  function sessionTopbar(s, info) {
    const steps = stepsOf(info);
    const idx = steps.indexOf(s.step);
    const side =
      s.mode === "test"
        ? `<span class="topbar-side nav">
            <button class="step-btn" data-action="step-jump" data-value="-1" aria-label="Vorheriger Schritt" ${idx > 0 ? "" : "disabled"}>${icon("chevronLeft")}</button>
            <button class="count-btn" data-action="step-sheet" aria-label="Schritt wählen">${idx + 1}/${steps.length}</button>
            <button class="step-btn" data-action="step-jump" data-value="1" aria-label="Nächster Schritt" ${idx < steps.length - 1 ? "" : "disabled"}>${icon("chevron")}</button>
          </span>`
        : `<span class="topbar-side count">${idx + 1}/${steps.length}</span>`;
    return `<header class="topbar kit">
        <button class="icon-btn" data-action="close-session" aria-label="Schließen">${icon("close")}</button>
        <span class="topbar-title">${esc(sessionTitle(s, info))}</span>
        ${side}
      </header>`;
  }

  function openStepSheet(s, info) {
    const steps = stepsOf(info);
    openSheet(
      `<div class="sheet" role="dialog" aria-label="Schritt wählen">
        <div class="sheet-head"><div class="sheet-head-row"><h3>Schritt wählen</h3><button class="icon-btn" data-action="close-sheet" aria-label="Schließen">${icon("close")}</button></div></div>
        <div class="sheet-list">${steps
          .map(
            (st, i) => `<button class="lesson-card ${st === s.step ? "current" : ""}" data-action="goto-step" data-value="${st}">
              <span class="dot ${i < steps.indexOf(s.step) ? "done" : "open"}">${i < steps.indexOf(s.step) ? icon("check") : ""}</span>
              <span class="lesson-card-text"><span class="lesson-card-title">${STEP_LABEL[st]}</span><span class="lesson-card-sub">${STEP_GROUP[st]}</span></span>
            </button>`
          )
          .join("")}</div>
      </div>`
    );
  }

  /** Abschnittslabel, Frage und Hinweis wie im Design-Kit. */
  const heading = (label, frage, hinweis) =>
    `<div class="section-label">${label}</div>${frage ? `<p class="frage">${frage}</p>` : ""}${hinweis ? `<p class="hinweis">${hinweis}</p>` : ""}`;

  function viewSession() {
    const s = currentSession();
    const info = sessionInfo();
    if (!s || !info) return `<div class="loading-screen">Lädt …</div>`;
    let body = "";
    let showPlayer = false;
    switch (s.step) {
      case "assign":
        body = `${heading("Vorbereitung · <span class=\"multi\">1a Emojis zuordnen</span>", "Welches Emoji passt zu welchem Fragment?", "Der Abschnitt in Fragmenten. Jedes Emoji ist eine Merkhilfe für sein Fragment.")}
          <div id="prep"></div>`;
        break;
      case "link":
        body = `${heading("Vorbereitung · <span class=\"multi\">1c Munāsaba</span>", "Wo gehört welcher Zusammenhang hin?", "Jeder Teil ist eine Aussage mit einer Frage, die das Fragment direkt danach beantwortet – auch vor dem ersten und nach dem letzten Fragment.")}
          <div id="prep"></div>`;
        break;
      case "order":
        body = `${heading("Vorbereitung · <span class=\"multi\">1b Reihenfolge</span>", "In welcher Reihenfolge kommen die Fragmente?", "Die Emojis bleiben, die Fragmente sind gemischt. Setze sie der Reihe nach wieder ein.")}
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
      ${sessionTopbar(s, info)}
      ${progressHtml(s, info)}
      <main class="content">${body}</main>
      <footer class="footer">
        ${showPlayer ? `<div class="player audio-card" id="player">${playerHtml()}</div><p class="player-error" id="player-error" hidden>Die Rezitation konnte nicht geladen werden. Bitte prüfe deine Internetverbindung.</p>` : ""}
        <div class="nav-row">
          <button class="btn secondary btn-back" data-action="back" ${canGoBack(s) ? "" : "disabled"}>Zurück</button>
          <button class="btn" data-action="next" ${canGoNext(s) ? "" : "disabled"}>${nextLabel(s)}</button>
        </div>
        <p class="how" id="session-hint">${hintText(s)}</p>
      </footer>`;
  }

  function learnBodyHtml(s, info) {
    const review = s.step !== "learn";
    const fifths = Math.min(...s.levels);
    const status = !review
      ? `Auswendiglernen · <span class="multi">Runde ${fifths + 1} · ${fifths === 0 ? "alles sichtbar" : fifths >= Fade.PARTS ? "alles ausgegraut" : `${fifths}/${Fade.PARTS} ausgegraut`}</span>`
      : `Wiederholung ${s.step.slice(-1)}/3 · <span class="multi">aus dem Gedächtnis</span>`;
    const pages = [...new Set(info.unit.verses.map((v) => v.page))];
    const on = Object.assign(showOf(s), { de: state.prefs.de });
    const frag = viewOf(s) === "frag";
    const toggle = (key, label, show) =>
      show ? `<label class="switch-row"><input type="checkbox" class="switch" data-action="pref" data-value="${key}" ${on[key] ? "checked" : ""} />${label}</label>` : "";
    return `
      <div class="section-label">${status}</div>
      ${PREP_ENABLED ? `<div class="view-bar">
        <div class="seg view-switch" role="group" aria-label="Ansicht">
          <button class="seg-btn ${!frag ? "on" : ""}" data-action="view" data-value="mushaf" aria-pressed="${!frag}">Mushaf</button>
          <button class="seg-btn ${frag ? "on" : ""}" data-action="view" data-value="frag" aria-pressed="${frag}">Fragmente</button>
        </div>
        ${
          frag
            ? `<div class="toggle-row" aria-label="Einblenden">
          ${toggle("emoji", "Emojis", true)}
          ${toggle("de", "Übersetzung", info.fragments.some((f) => f.de))}
          ${toggle("mun", "Munāsaba", munReady(s, info))}
        </div>`
            : ""
        }
      </div>` : ""}
      <div class="range-caption">${esc(info.label)} · Seite ${pages.join("–")}${info.tail ? `<br><span class="next-note">Blau: Anfang des nächsten Verses als Anschluss</span>` : ""}</div>
      ${frag ? `<div class="read-wrap" id="read">${readHtml(s, info)}</div>` : `<div class="mushaf full" id="mushaf">${mushafHtml(s, info)}</div>`}`;
  }

  const levelsOf = (s) => (s.step === "learn" ? s.levels : s.levels.map(() => Fade.PARTS));

  function mushafHtml(s, info) {
    return Mushaf.unitHtml(info.unit, {
      levels: levelsOf(s),
      shapes: info.shapes,
      wordIndex: info.wordIndex,
      activeKey: player.activeKey,
      tail: info.tail ? info.tail.tokens : [],
    });
  }

  /** Fragment-Ansicht: gleiche Ausgrau-Stufen wie im Mushaf. */
  function readHtml(s, info) {
    const levels = levelsOf(s);
    const active = player.activeKey;
    const word = (t) => {
      const cls = `t ${t.type === Quran.TOKEN_WORD ? "w" : "ayah-end"}${t.key === active ? " active" : ""}`;
      const i = info.wordIndex.get(t);
      const inner = t.type === Quran.TOKEN_WORD && i !== undefined ? Fade.wordHtml(info.shapes[i], levels[i] || 0) : esc(t.text);
      return `<span class="${cls}" data-key="${t.key}">${inner}</span>`;
    };
    const tail = info.tail ? info.tail.tokens.map((t) => `<span class="t next">${esc(t.text)}</span>`).join(" ") : "";
    const show = showOf(s);
    return Prep.readHtml({
      fragments: info.fragments,
      emojis: emojisOf(s, info),
      parts: munReady(s, info) ? info.mun : null,
      show: { emoji: show.emoji, de: state.prefs.de, mun: show.mun },
      word,
      tail,
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
        ${heading("Abschluss · <span class=\"multi\">freiwillig</span>", "Abschnitt geschafft! Was willst du umsetzen?", "<b>Das Ausfüllen ist freiwillig</b> – du kannst auch direkt auf „Weiter“ tippen.")}
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
    return stepsOf(sessionInfo()).indexOf(s.step) > 0 || (s.step === "learn" && Math.min(...s.levels) > 0);
  }

  function canGoNext(s) {
    if (s.mode === "test") return true;
    if (s.step === "assign") return s.emojis.every(Boolean);
    if (s.step === "order") return s.placed >= s.emojis.length;
    if (s.step === "link") return s.linkPlaced.every(Boolean);
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
        return s.placed >= s.emojis.length ? `Alles richtig eingesetzt. Weiter ${sessionInfo() && sessionInfo().mun ? "zur Munāsaba" : "zum Auswendiglernen"}.` : "Setze die Fragmente der Reihe nach ein.";
      case "link":
        return s.linkPlaced.every(Boolean) ? "Alles an seinem Platz. Weiter zum Auswendiglernen." : "Ordne jeden Munāsaba-Teil seiner Lücke zu.";
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
    const steps = stepsOf(sessionInfo());
    gotoStep(s, steps[steps.indexOf(s.step) + 1]);
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
    const steps = stepsOf(sessionInfo());
    const i = steps.indexOf(s.step);
    if (i > 0) gotoStep(s, steps[i - 1]);
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
    const prefs = state.prefs;
    if (prep && s.step === "assign") {
      const st = {
        fragments: info.fragments,
        emojis: s.emojis,
        palette: s.palette,
        parts: null, // Munāsaba erst nach 1c
        get showDe() { return prefs.de; },
        set showDe(v) { prefs.de = v; },
      };
      Prep.mountAssign(prep, st, () => {
        save();
        refreshNav(s);
      });
    }
    if (prep && s.step === "link" && info.mun) {
      const st = {
        fragments: info.fragments,
        emojis: emojisOf(s, info),
        parts: info.mun,
        order: s.linkOrder,
        placed: s.linkPlaced,
        get showDe() { return prefs.de; },
        set showDe(v) { prefs.de = v; },
      };
      Prep.mountLink(prep, st, () => {
        save();
        refreshNav(s);
      });
    }
    if (prep && s.step === "order") {
      const st = { fragments: info.fragments, emojis: emojisOf(s, info), order: s.order, placed: s.placed, wheel: s.wheel };
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

  /** Abschluss-Screen wie die Auswertung im Design-Kit. */
  function doneScreen(title, card, buttons) {
    return `
      <header class="topbar kit"><span class="topbar-side"></span><span class="topbar-title">${title}</span><span class="topbar-side"></span></header>
      <main class="content result">
        <div class="done-icon">${icon("check")}</div>
        <h1 class="result-title">${title}</h1>
        <p class="result-sub">Ma schā' Allāh</p>
        <div class="card score-card">${card}</div>
      </main>
      <footer class="footer two">${buttons}</footer>`;
  }

  const scoreCard = (label, num, pct) => `<span class="label">${label}</span><span class="score-num">${num}</span>${pct ? `<span class="score-pct">${pct}</span>` : ""}`;

  function viewUnitDone() {
    if (screen.mode === "test") {
      return doneScreen(
        "Viertel geschafft!",
        scoreCard("Gelernt", esc(screen.label), "Aus der freien Auswahl"),
        `<button class="btn secondary" data-action="test-goto" data-value="area">Zur Auswahl</button>
         <button class="btn" data-action="test-next">Nächstes Viertel</button>`
      );
    }
    const p = state.progress;
    const day = planCtx.days[p.day];
    return doneScreen(
      "Viertel geschafft!",
      scoreCard("Gelernt", esc(screen.label), `Als Nächstes: Viertel ${p.unit + 1} von ${day.units.length} · ${esc(Quran.label(day.units[p.unit]))}`),
      `<button class="btn secondary" data-action="home">Später</button>
       <button class="btn" data-action="learn">Weiter</button>`
    );
  }

  function viewDayDone() {
    const sched = planSchedule();
    const next = sched[state.progress.day];
    const total = planCtx.days.length;
    return doneScreen(
      "Tagespensum geschafft!",
      scoreCard("Lerntage geschafft", `${state.progress.day} von ${total}`, `${Math.round((state.progress.day / total) * 100)} %${next && next.date ? ` · nächster Lerntag: ${dateLabel(next.date)}` : ""}`),
      `<button class="btn" data-action="home">Zur Übersicht</button>`
    );
  }

  function viewPlanDone() {
    return doneScreen(
      `${esc(suraName(state.plan.surah))} gelernt!`,
      scoreCard("Plan abgeschlossen", `${planCtx.days.length} Lerntage`, "Möge Allah es dir leicht machen, die Sure zu bewahren."),
      `<button class="btn secondary" data-action="home">Zur Übersicht</button>
       <button class="btn" data-action="new-plan">Neuer Plan</button>`
    );
  }

  /** Nächstes Viertel: auf der Seite, dann nächste Seite der Sure, dann nächste Sure. */
  async function testNext() {
    const t = state.test;
    await Quran.loadPages([t.page, t.page + 1, t.page + 2]);
    const parts = Quran.surahPageParts(t.page, t.surah);
    const idx = parts.findIndex((u) => u.part === t.part);
    const m = Quran.meta(t.surah);
    if (idx >= 0 && idx + 1 < parts.length) t.part = parts[idx + 1].part;
    else if (t.page < m.p1) {
      t.page++;
      t.part = (Quran.surahPageParts(t.page, t.surah)[0] || { part: 0 }).part;
    } else if (t.surah < 114) {
      t.surah++;
      t.page = Quran.meta(t.surah).p0;
      await Quran.loadPages([t.page, t.page + 1]);
      t.part = (Quran.surahPageParts(t.page, t.surah)[0] || { part: 0 }).part;
    }
    save();
    startTest(true);
  }

  /* ----------------------------------------------------------------- Player */

  /** Anteil der Wiedergabe (0–1) über alle Verse. */
  function playFrac() {
    const st = player.status;
    if (st === "ended") return 1;
    if (st === "idle") return 0;
    return (player.index + player.progress) / (player.queue.length || 1);
  }

  function playerMeta() {
    const st = player.status;
    const c = player.current;
    const verses = player.queue.filter((x) => !x.basmala && !x.tail);
    if (st === "idle") return `${verses.length} ${verses.length === 1 ? "Vers" : "Verse"} · Abspielen`;
    if (st === "ended") return "Fertig";
    if (st === "loading") return "Lädt …";
    if (c && c.basmala) return "Basmala";
    if (c && c.tail) return "Anschluss";
    if (c) return `Vers ${verses.indexOf(c) + 1} / ${verses.length}`;
    return "";
  }

  function playerHtml() {
    const st = player.status;
    const busy = st === "loading";
    const playing = st === "playing" || busy;
    const reciter = Reciters.byId(state.reciter);
    return `
      <button class="play-btn ${busy ? "loading" : ""}" data-action="play" aria-label="${playing ? "Pause" : "Abspielen"}">${icon(busy ? "loading" : playing ? "pause" : st === "ended" ? "replay" : "play")}</button>
      <span class="audio-text"><span class="audio-note">${playerMeta()}</span><span class="audio-reciter">${esc(reciter.name)}</span></span>
      <button class="restart-btn" data-action="restart" ${st === "idle" ? "hidden" : ""}>${icon("replay")} Von vorn</button>
      <span class="audio-track" data-action="seek-track" aria-hidden="true"><i style="width:${playFrac() * 100}%"></i></span>`;
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
        const track = el.querySelector(".audio-track i");
        if (track) track.style.width = playFrac() * 100 + "%";
        const meta = el.querySelector(".audio-note");
        if (meta) meta.textContent = playerMeta();
      }
    }
    const err = document.getElementById("player-error");
    if (err) err.hidden = player.status !== "error";
    const active = player.activeKey;
    if (active !== lastActive || force) {
      lastActive = active;
      document.querySelectorAll("#mushaf .t[data-key], #read .t[data-key]").forEach((t) => t.classList.toggle("active", t.dataset.key === active));
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
        return state.plan ? go("home", { tab: "today" }) : openSetup();
      case "tab":
        return go("home", { tab: value });
      case "setup":
        return openSetup();
      case "new-plan":
        return openSetup();
      case "setup-sura":
        draft.surah = +value;
        draft.step = 1;
        render();
        return window.scrollTo(0, 0);
      case "setup-next":
        draft.step = Math.min(2, draft.step + 1);
        render();
        return window.scrollTo(0, 0);
      case "setup-back":
        draft.step = Math.max(0, draft.step - 1);
        render();
        return window.scrollTo(0, 0);
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
        return go("testpick", { step: "sura" });
      case "test-goto":
        return go("testpick", { step: value });
      case "test-sura": {
        const n = +value;
        if (n !== state.test.surah) state.test = { surah: n, page: Quran.meta(n).p0, part: -1 };
        save();
        return go("testpick", { step: "page" });
      }
      case "test-page":
        if (+value !== state.test.page) {
          state.test.page = +value;
          state.test.part = -1;
        }
        save();
        return go("testpick", { step: "area" });
      case "test-part":
        return selectTestPart(+value);
      case "test-start":
        return startTest();
      case "test-next":
        return testNext();
      // Sitzung
      case "close-session":
        player.stop();
        if (s && s.mode === "test") return go("testpick", { step: "area" });
        return state.plan ? go("home", { tab: "today" }) : openSetup();
      case "view":
        if (!s) return;
        s.view = value === "mushaf" ? "mushaf" : "frag";
        save();
        return render(true);
      case "pref":
        if (value === "de") state.prefs.de = !state.prefs.de;
        else if (s) s.show = Object.assign(showOf(s), { [value]: !showOf(s)[value] });
        save();
        return render(true);
      case "next":
        return next();
      case "back":
        return back();
      case "goto-step":
        if (s && s.mode === "test") gotoStep(s, value);
        return;
      case "step-jump": {
        if (!s || s.mode !== "test") return;
        const steps = stepsOf(sessionInfo());
        const i = steps.indexOf(s.step) + +value;
        if (i >= 0 && i < steps.length) gotoStep(s, steps[i]);
        return;
      }
      case "step-sheet":
        if (s) openStepSheet(s, sessionInfo());
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
      case "seek-track": {
        const q = player.queue.length;
        const r = target.getBoundingClientRect();
        const frac = Math.max(0, Math.min(0.999, (event.clientX - r.left) / r.width));
        if (q) {
          ensureAudioCtx();
          player.playIndex(Math.floor(frac * q));
        }
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
    const tok = e.target.closest("#mushaf .t[data-key], #read .t[data-key]");
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
    if (field === "sura-search") {
      const list = document.getElementById("sura-list");
      const q = e.target.value;
      if (screen.name === "setup") {
        draft.query = q;
        list.innerHTML = suraListHtml(draft.surah, "setup-sura", q);
      } else {
        screen.query = q;
        list.innerHTML = suraListHtml(state.test.surah, "test-sura", q);
      }
      return;
    }
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
    if (params.has("test")) return go("testpick", { step: "sura" });
    if (!state.plan) return openSetup();
    go("home", { tab: "today" });
  }

  init();
})();
