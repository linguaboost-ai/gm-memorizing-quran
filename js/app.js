/*
 * German Method – Hifz: Screens, Zustand und Ablauf.
 *
 * Startseite: eine Auswahl – Juz, Sure (mit Versanfang und -ende) oder Seite;
 * jede Zeile ist einzeilig und klappt erst beim Antippen auf. Darunter der
 * Link zum Testen (immer Sure Ghāfir).
 *
 * Seitenauswahl: Blättern durch die Seiten des Bereichs; über der Seite
 * Viertel – Hälfte – ganze Seite. Gerundet wird nach Größe: Füllt der Bereich
 * eine Seite nur zu drei Vierteln (erste Seite einer Sure), gibt es drei
 * Viertel. Die Teile werden beim Überfahren markiert, ein Klick startet sofort
 * das Auswendiglernen.
 *
 * Ablauf pro Teil:
 *   Auswendiglernen  im Mushaf, Ausgrauen in Fünfteln (Weiter/Zurück) – auch
 *                    die Anschlusswörter des nächsten Verses
 *   Pause 1 Min      Dhikr-Aufgaben (3/7/10 Mal) → Wiederholung → Ordnen 1
 *   Pause 2 Min      Quiz zur Sīra → Wiederholung → Ordnen 2
 *   Pause 4 Min      Lesetext mit drei Fragen → Wiederholung → Ordnen 3
 *   Zusammenhang     die Verse mit den Übergängen nach al-Biqāʿī
 *   Abschluss        freiwillige Notizen zur Umsetzung
 * Ordnen und Zusammenhang gibt es für Abschnitte mit Inhalten (Ghāfir).
 *
 * Tresor: Beim Wiederholen auf ein Wort tippen, um Wort, Fragment oder Vers
 * für später zu sammeln (js/vault.js).
 *
 * Im Testmodus lassen sich alle Schritte frei ansteuern und Timer überspringen.
 */
(function () {
  "use strict";

  const { Quran, Fade, Mushaf, Player, Reciters, Prep, Activities, Review, Vault } = window;
  const esc = Fade.escapeHtml;

  const STORAGE_KEY = "gm-hifz:v3";
  const OLD_KEYS = ["gm-hifz:v2", "gm-hifz:v1"];
  const params = new URLSearchParams(location.search);
  // ?timer=5 verkürzt alle Pausen auf 5 Sekunden (zum Ausprobieren)
  const TEST_SECONDS = Math.max(0, Number(params.get("timer")) || 0);
  const PAUSES = [60, 120, 240].map((s) => TEST_SECONDS || s);
  const DEFAULT_SURAH = 67;
  const TEST_SURAH = 40;

  const SIZES = [
    { k: 4, label: "Viertel", short: "Viertel" },
    { k: 2, label: "Hälfte", short: "Hälfte" },
    { k: 1, label: "Ganze Seite", short: "Seite" },
  ];
  /** Bezeichnung eines Teils nach seiner gerundeten Größe (Viertel … Seite). */
  const partName = (info) => Quran.sizeName(info.unit);

  // Nach jeder Wiederholung: Ordnen (nur mit Inhalten), am Ende der Zusammenhang
  const CONTENT_STEPS = ["sort1", "sort2", "sort3", "verses"];
  const STEPS = ["learn", "pause1", "review1", "sort1", "pause2", "review2", "sort2", "pause3", "review3", "sort3", "verses", "reflect"];
  /** Schritte dieses Teils: Ordnen und Zusammenhang nur, wenn es Inhalte dafür gibt. */
  const stepsOf = (info) => (info && info.keys && info.prep ? STEPS : STEPS.filter((x) => !CONTENT_STEPS.includes(x)));
  const isSort = (step) => /^sort/.test(step);
  const sortIndex = (step) => +step.slice(-1) - 1;
  const STEP_LABEL = {
    learn: "Lernen",
    pause1: "1 Min",
    review1: "Wdh. 1",
    sort1: "Zuordnen",
    pause2: "2 Min",
    review2: "Wdh. 2",
    sort2: "Ordnen 2",
    pause3: "4 Min",
    review3: "Wdh. 3",
    sort3: "Ordnen 3",
    verses: "Zusammenhang",
    reflect: "Abschluss",
  };
  const STEP_GROUP = {
    learn: "Auswendiglernen",
    pause1: "Pause · Dhikr",
    review1: "Wiederholung",
    sort1: "Schlüsselwörter den Versstücken zuordnen",
    pause2: "Pause · Quiz",
    review2: "Wiederholung",
    sort2: "Schlüsselwörter ordnen",
    pause3: "Pause · Lesetext",
    review3: "Wiederholung",
    sort3: "Emojis ordnen",
    verses: "Zusammenhang nach al-Biqāʿī",
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
    expand: "M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z",
    back: "M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z",
    arrow: "M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z",
  };
  const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name]}"/></svg>`;

  /* ---------------------------------------------------------------- Zustand */

  const defaultSel = (surah) => ({ mode: "surah", juz: 1, surah, from: 1, to: Quran.meta(surah).ayahs, page: Quran.meta(surah).p0 });

  const blankState = () => ({
    v: 3,
    reciter: "afasy",
    prefs: { de: false },
    sel: defaultSel(DEFAULT_SURAH),
    pick: { main: { page: 0, size: 4 }, test: { page: Quran.meta(TEST_SURAH).p0, size: 4 } },
    sessions: { main: null, test: null },
    journal: [],
    vault: [],
  });

  function loadState() {
    let state = blankState();
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (s && s.v === 3) state = Object.assign(state, s);
      // Umstellung: Rezitator, Einstellungen, Notizen und die Sure des alten Plans bleiben
      for (const k of OLD_KEYS) {
        const old = JSON.parse(localStorage.getItem(k) || "null");
        if (old && !(s && s.v === 3)) {
          state.reciter = old.reciter || (old.plan && old.plan.reciter) || state.reciter;
          if (old.prefs) state.prefs = Object.assign(state.prefs, old.prefs);
          if (Array.isArray(old.journal)) state.journal = old.journal;
          if (old.plan && old.plan.surah) state.sel = defaultSel(old.plan.surah);
        }
        localStorage.removeItem(k);
      }
    } catch (e) {
      /* leer oder ungültig */
    }
    state.prefs = Object.assign({ de: false }, state.prefs);
    state.pick = Object.assign(blankState().pick, state.pick);
    state.sessions = Object.assign({ main: null, test: null }, state.sessions);
    if (!Array.isArray(state.vault)) state.vault = [];
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

  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const today = () => iso(new Date());
  const mmss = Activities.mmss;
  const touchOnly = window.matchMedia && window.matchMedia("(hover: none)").matches;

  /* --------------------------------------------------------------- Bereiche */

  const cmp = (s1, a1, s2, a2) => (s1 - s2) * 1000 + (a1 - a2);

  /**
   * Bereich zur Auswahl: { key, label, p0, p1, has(vers) }. Im Testmodus immer
   * Sure Ghāfir. Bei einer Sure stehen die Seiten erst nach dem Laden fest.
   */
  function rangeOf(mode, sel) {
    if (mode === "test") {
      const m = Quran.meta(TEST_SURAH);
      return { key: "test", label: m.tr, p0: m.p0, p1: m.p1, surah: TEST_SURAH, has: (v) => v.surah === TEST_SURAH };
    }
    if (sel.mode === "juz") {
      const j = Quran.juzList[sel.juz - 1];
      return {
        key: `j${sel.juz}`,
        label: `Juz ${sel.juz}`,
        p0: j.p0,
        p1: j.p1,
        has: (v) => cmp(v.surah, v.ayah, j.start[0], j.start[1]) >= 0 && cmp(v.surah, v.ayah, j.end[0], j.end[1]) <= 0,
      };
    }
    if (sel.mode === "page") return { key: `p${sel.page}`, label: `Seite ${sel.page}`, p0: sel.page, p1: sel.page, has: null };
    const m = Quran.meta(sel.surah);
    const whole = sel.from === 1 && sel.to === m.ayahs;
    return {
      key: `s${sel.surah}:${sel.from}-${sel.to}`,
      label: whole ? m.tr : `${m.tr} ${sel.from}–${sel.to}`,
      p0: null,
      p1: null,
      surah: sel.surah,
      from: sel.from,
      to: sel.to,
      has: (v) => v.surah === sel.surah && v.ayah >= sel.from && v.ayah <= sel.to,
    };
  }

  /** Seiten einer Sure-Auswahl ermitteln (Sure laden). */
  async function resolveRange(r) {
    if (r.p0 === null) {
      const d = await Quran.load(r.surah);
      r.p0 = d.ayahs[r.from - 1].page;
      r.p1 = d.ayahs[r.to - 1].page;
    }
    return r;
  }

  /* --------------------------------------------------------------- Kontext */

  const root = document.getElementById("app");
  let screen = { name: "loading" };
  const unitCache = new Map();
  let ticker = null;
  let wakeLock = null;
  let audioCtx = null;
  let laterTimers = [];

  const player = new Player(onPlayerChange);

  const refKey = (ref) => `${ref.mode}|${ref.range}|${ref.page}:${ref.size}:${ref.part}`;

  /** Alles, was für einen Teil gebraucht wird. */
  async function unitContext(ref) {
    const key = refKey(ref);
    if (unitCache.has(key)) return unitCache.get(key);
    const range = rangeOf(ref.mode, ref.sel);
    await Quran.loadPages([ref.page, ref.page + 1]);
    const units = Quran.pageUnits(ref.page, ref.size, range.has);
    const idx = Math.max(0, Math.min(units.length - 1, ref.part));
    const unit = units[idx];
    // Ist eine Sure gewählt, reicht der Anschluss nicht in die nächste Sure
    const tail = Quran.tailOf(unit, !!range.surah);
    // Ausgrauen: Abschnitt und Anschluss, nach der dargestellten Form (Ausgabe 1405); Tatweel zählt nicht mit
    const words = [...Quran.wordsOf(unit), ...(tail ? tail.words : [])];
    const shapes = words.map((w) => Fade.analyze(w.display));
    const fragments = Prep.fragmentsOf(unit);
    const prep = Prep.study(unit);
    const info = {
      ref,
      unit,
      parts: units.length,
      partNo: idx + 1,
      words,
      shapes,
      wordIndex: new Map(words.map((w, i) => [w, i])),
      tail,
      fragments,
      prep,
      keys: prep ? Review.keysOf(unit, fragments) : null,
      label: Quran.label(unit),
    };
    unitCache.set(key, info);
    return info;
  }

  function newSession(ref, info) {
    return {
      ref,
      step: stepsOf(info)[0],
      levels: new Array(info.words.length).fill(0),
      pauses: [{}, {}, {}],
      ex: [null, null, null],
      sorts: [null, null, null],
      reflect: { d1: "", d7: "", life: "" },
    };
  }

  /** Passt die gespeicherte Sitzung zu diesem Teil? (sonst neu beginnen) */
  function sessionFits(s, ref, info) {
    const fits = !!s && !!s.ref && refKey(s.ref) === refKey(ref) && s.levels.length === info.words.length && Array.isArray(s.ex);
    if (fits && !Array.isArray(s.sorts)) s.sorts = [null, null, null];
    if (fits && !stepsOf(info).includes(s.step)) s.step = stepsOf(info)[0];
    return fits;
  }

  /* ------------------------------------------------------------ Navigation */

  function go(name, data = {}) {
    if (screen.name === "session" && name !== "session") player.stop();
    if (name !== "session") releaseWakeLock();
    stopTicker();
    clearLater();
    const t = document.getElementById("toast");
    if (t) t.remove();
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
      start: viewStart,
      pick: viewPick,
      session: viewSession,
      unitDone: viewUnitDone,
      vault: viewVault,
      practice: viewPractice,
    };
    root.innerHTML = `<div class="screen screen-${screen.name}" ${keepScroll ? 'style="animation:none"' : ""}>${views[screen.name]()}</div>`;
    const after = { start: afterStart, pick: afterPick, session: afterSession };
    if (after[screen.name]) after[screen.name]();
    showRangeBar();
    if (screen.name !== "session" || !isPause(currentSession())) document.title = "German Method – Qur'an auswendig lernen";
    if (keepScroll) window.scrollTo(0, y);
  }

  /** Abschnittslabel, Frage und Hinweis wie im Design-Kit. */
  const heading = (label, frage, hinweis) =>
    `<div class="section-label">${label}</div>${frage ? `<p class="frage">${frage}</p>` : ""}${hinweis ? `<p class="hinweis">${hinweis}</p>` : ""}`;

  /* -------------------------------------------------------------- Startseite */

  const fold = (x) =>
    String(x || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[‘’'`ʿʾ\-\s]/g, "")
      // Umschrift-Varianten: Ghāfir/Ġāfir, Kahf/Ḫ…, Shams/Šams, …
      .replace(/([gkstd])h/g, "$1")
      .replace(/(.)\1/g, "$1");

  function suraListHtml(selected, query) {
    const q = fold(query);
    const list = Quran.surahs.filter((m) => !q || String(m.n) === q || fold(m.tr).includes(q) || fold(m.de).includes(q) || m.ar.includes((query || "").trim()));
    if (!list.length) return `<p class="hint">Keine Sure gefunden.</p>`;
    return list
      .map(
        (m) => `<button class="sura-row" data-action="sel-surah" data-value="${m.n}" aria-selected="${m.n === selected}">
          <span class="num-badge">${m.n}</span>
          <span class="picker-main"><strong>${esc(m.tr)}</strong><span>${esc(m.de)} · ${m.ayahs} Verse</span></span>
          <span class="picker-ar">${esc(m.ar)}</span>
        </button>`
      )
      .join("");
  }

  const surahsOnPage = (p) => Quran.surahs.filter((m) => m.p0 <= p && p <= m.p1);
  const pageNote = (p) => `Juz ${Quran.juzOfPage(p)} · ${surahsOnPage(p).map((m) => m.tr).join(", ")}`;

  function selValue(mode) {
    const s = state.sel;
    if (mode === "juz") {
      const j = Quran.juzList[s.juz - 1];
      return `<b>Juz ${s.juz}</b><span>S. ${j.p0}–${j.p1}</span>`;
    }
    if (mode === "surah") {
      const m = Quran.meta(s.surah);
      return `<b>${m.n}. ${esc(m.tr)}</b><span>Vers ${s.from}–${s.to}</span>`;
    }
    return `<b>Seite ${s.page}</b><span>${esc(pageNote(s.page))}</span>`;
  }

  function selBody(mode) {
    const s = state.sel;
    if (mode === "juz") {
      return `<div class="juz-grid">${Quran.juzList
        .map((j) => `<button class="juz-chip" data-action="sel-juz" data-value="${j.n}" aria-selected="${s.mode === "juz" && s.juz === j.n}"><b>${j.n}</b><span>S. ${j.p0}</span></button>`)
        .join("")}</div>`;
    }
    if (mode === "surah") {
      const m = Quran.meta(s.surah);
      const opts = (sel) => Array.from({ length: m.ayahs }, (_, i) => `<option value="${i + 1}" ${i + 1 === sel ? "selected" : ""}>${i + 1}</option>`).join("");
      return `
        <div class="verse-range">
          <span class="vr-name">${esc(m.tr)}</span>
          <label>Vers <select data-action="sel-from" aria-label="Versanfang">${opts(s.from)}</select></label>
          <label>bis <select data-action="sel-to" aria-label="Versende">${opts(s.to)}</select></label>
        </div>
        <input class="search" type="search" placeholder="Andere Sure suchen – Name oder Nummer" data-field="sura-search" value="${esc(screen.query || "")}" autocomplete="off" />
        <div class="sura-list compact" id="sura-list">${suraListHtml(s.surah, screen.query)}</div>`;
    }
    return `
      <div class="page-stepper">
        <button class="icon-btn" data-action="sel-page-step" data-value="-1" aria-label="Seite zurück">${icon("chevronLeft")}</button>
        <input class="num page-input" type="number" inputmode="numeric" min="1" max="604" value="${s.page}" data-field="sel-page" aria-label="Seite" />
        <button class="icon-btn" data-action="sel-page-step" data-value="1" aria-label="Seite vor">${icon("chevron")}</button>
      </div>
      <input class="page-range" type="range" min="1" max="604" value="${s.page}" data-field="sel-page" aria-label="Seite wählen" />
      <p class="hint" id="page-note">${esc(pageNote(s.page))}</p>`;
  }

  function selRow(mode, label) {
    const open = screen.open === mode;
    const active = state.sel.mode === mode;
    return `<div class="sel-row ${active ? "active" : ""} ${open ? "open" : ""}">
      <button class="sel-head" data-action="sel-open" data-value="${mode}" aria-expanded="${open}">
        <span class="sel-dot" aria-hidden="true"></span>
        <span class="sel-label">${label}</span>
        <span class="sel-value" id="sel-value-${mode}">${selValue(mode)}</span>
        <span class="sel-chev">${icon("expand")}</span>
      </button>
      ${open ? `<div class="sel-body">${selBody(mode)}</div>` : ""}
    </div>`;
  }

  function viewStart() {
    const s = state.sessions.main;
    const reciter = Reciters.byId(state.reciter);
    const resume = s && s.ref ? unitCache.get(refKey(s.ref)) : null;
    return `
      <header class="topbar kit"><span class="topbar-side"></span><span class="topbar-title">Auswendiglernen</span><span class="topbar-side"></span></header>
      <main class="content">
        <div class="basmala">${esc(Quran.basmala)}</div>
        ${heading("Deine Auswahl", "Was möchtest du auswendig lernen?", "Wähle eine Juz, eine Sure (mit Versen) oder eine Seite.")}
        ${
          s && s.ref
            ? `<button class="card resume-card" data-action="resume">
                <span class="label">Weiterlernen</span>
                <strong>${esc(resume ? `${resume.label} · ${partName(resume)}` : `Seite ${s.ref.page}`)}</strong>
                <span>${STEP_GROUP[s.step]} · Seite ${s.ref.page}</span>
              </button>`
            : ""
        }
        <div class="sel-card" role="radiogroup" aria-label="Auswahl">
          ${selRow("juz", "Juz")}
          ${selRow("surah", "Sure")}
          ${selRow("page", "Seite")}
        </div>
        ${vaultRowHtml()}
        <div class="settings-row card"><div><small>Rezitator</small><strong>${esc(reciter.name)}</strong></div><button class="link-btn" data-action="change-reciter">Ändern</button></div>
      </main>
      <footer class="footer">
        <button class="btn" data-action="start-range">Weiter zur Seite ${icon("arrow")}</button>
        <button class="link-btn test-link" data-action="test">Testen: Sure Ghāfir</button>
      </footer>`;
  }

  /** Zeile „Tresor“ mit der Zahl der Stellen. */
  function vaultRowHtml() {
    const n = state.vault.length;
    const open = state.vault.filter((x) => !Vault.solid(x)).length;
    return `<button class="settings-row card vault-row" data-action="vault">
        <span class="vault-row-icon" aria-hidden="true">🔒</span>
        <div><small>Tresor</small><strong>${n ? `${n} ${n === 1 ? "Stelle" : "Stellen"}${open < n ? ` · ${open} offen` : ""}` : "noch leer"}</strong></div>
        <span class="link-btn">Öffnen</span>
      </button>`;
  }

  function afterStart() {
    const sel = document.querySelector('.sura-row[aria-selected="true"]');
    if (sel && screen.open === "surah") sel.scrollIntoView({ block: "nearest" });
  }

  /** Nur die Zeilenwerte aktualisieren (ohne die Seite neu zu zeichnen). */
  function refreshSel() {
    for (const m of ["juz", "surah", "page"]) {
      const el = document.getElementById("sel-value-" + m);
      if (el) el.innerHTML = selValue(m);
    }
    document.querySelectorAll(".sel-row").forEach((r, i) => r.classList.toggle("active", ["juz", "surah", "page"][i] === state.sel.mode));
  }

  function setPage(p) {
    p = Math.max(1, Math.min(604, Math.round(p) || 1));
    state.sel.page = p;
    state.sel.mode = "page";
    save();
    document.querySelectorAll('[data-field="sel-page"]').forEach((el) => {
      if (+el.value !== p && document.activeElement !== el) el.value = p;
    });
    const note = document.getElementById("page-note");
    if (note) note.textContent = pageNote(p);
    refreshSel();
  }

  /* ---------------------------------------------------------- Seitenauswahl */

  async function openPick(mode, page) {
    const range = await resolveRange(rangeOf(mode, state.sel));
    const pk = state.pick[mode];
    if (mode === "main" && pk.range !== range.key) pk.page = 0;
    pk.range = range.key;
    if (page) pk.page = page;
    if (!pk.page || pk.page < range.p0 || pk.page > range.p1) pk.page = range.p0;
    save();
    go("pick", { mode, range });
  }

  function viewPick() {
    const { mode, range } = screen;
    const pk = state.pick[mode];
    const count = range.p1 - range.p0 + 1;
    return `
      <header class="topbar kit">
        <button class="icon-btn" data-action="start" aria-label="Zur Auswahl">${icon("back")}</button>
        <span class="topbar-title">${mode === "test" ? `Testen · ${esc(range.label)}` : esc(range.label)}</span>
        <span class="topbar-side"></span>
      </header>
      <main class="content pick">
        <div class="pick-bar">
          <div class="seg size-switch" role="group" aria-label="Größe">${SIZES.map(
            (x) => `<button class="seg-btn ${pk.size === x.k ? "on" : ""}" data-action="pick-size" data-value="${x.k}" aria-pressed="${pk.size === x.k}">${x.label}</button>`
          ).join("")}</div>
          <div class="page-nav">
            <button class="icon-btn" data-action="pick-page" data-value="-1" aria-label="Vorherige Seite" ${pk.page > range.p0 ? "" : "disabled"}>${icon("chevronLeft")}</button>
            <span class="page-nav-label"><b>Seite ${pk.page}</b>${count > 1 ? `<small>${pk.page - range.p0 + 1} / ${count}</small>` : ""}</span>
            <button class="icon-btn" data-action="pick-page" data-value="1" aria-label="Nächste Seite" ${pk.page < range.p1 ? "" : "disabled"}>${icon("chevron")}</button>
          </div>
        </div>
        <p class="hinweis pick-hint">${touchOnly ? "Tippe auf einen Teil – dann geht es direkt los." : "Fahre mit der Maus über die Seite und klicke den Teil an, den du lernen willst."} <span id="pick-parts"></span></p>
        <div class="mushaf full pick" id="pick-page"><div class="loading-screen">Lädt …</div></div>
      </main>`;
  }

  async function afterPick() {
    const { mode, range } = screen;
    const pk = state.pick[mode];
    const page = pk.page;
    await Quran.loadPages([page, page + 1]);
    if (screen.name !== "pick" || state.pick[mode].page !== page) return;
    const units = Quran.pageUnits(page, pk.size, range.has);
    const box = document.getElementById("pick-page");
    if (!box) return;
    box.innerHTML = Mushaf.pageHtml(page, units);
    Mushaf.fit(box);
    const note = document.getElementById("pick-parts");
    if (note && units.length) note.textContent = `Auf dieser Seite: ${units.map((u) => Quran.sizeName(u)).join(" · ")}`;
    let cur = null;
    const mark = (q) => {
      if (q === cur) return;
      cur = q;
      box.querySelectorAll(".t.hl").forEach((x) => x.classList.remove("hl"));
      if (q !== null) box.querySelectorAll(`.t[data-q="${q}"]`).forEach((x) => x.classList.add("hl"));
    };
    box.addEventListener("mouseover", (e) => {
      const el = e.target.closest(".t");
      if (el) mark(el.dataset.q === undefined ? null : el.dataset.q);
    });
    box.addEventListener("mouseleave", () => mark(null));
    box.addEventListener("click", (e) => {
      const el = e.target.closest("[data-q]");
      if (!el) return;
      mark(el.dataset.q);
      startUnit(mode, page, pk.size, +el.dataset.q);
    });
  }

  function pickPage(mode, delta) {
    const range = screen.range;
    const pk = state.pick[mode];
    const p = Math.max(range.p0, Math.min(range.p1, pk.page + delta));
    if (p === pk.page) return;
    pk.page = p;
    save();
    render();
  }

  /** Teil starten (eine begonnene Sitzung desselben Teils geht weiter). */
  async function startUnit(mode, page, size, part, fresh) {
    const sel = mode === "main" ? Object.assign({}, state.sel) : null;
    const range = rangeOf(mode, sel || state.sel);
    const ref = { mode, range: range.key, sel, page, size, part };
    const info = await unitContext(ref);
    if (fresh || !sessionFits(state.sessions[mode], ref, info)) {
      state.sessions[mode] = newSession(ref, info);
    }
    state.pick[mode] = Object.assign(state.pick[mode], { page, size, range: range.key });
    save();
    go("session", { mode });
  }

  async function resumeSession(mode) {
    const s = state.sessions[mode];
    if (!s || !s.ref) return;
    const info = await unitContext(s.ref);
    if (!sessionFits(s, s.ref, info)) {
      state.sessions[mode] = null;
      save();
      return render();
    }
    go("session", { mode });
  }

  /* --------------------------------------------------------------- Sitzung */

  const currentSession = () => (screen.name === "session" ? state.sessions[screen.mode] : null);
  const isPause = (s) => !!s && /^pause/.test(s.step);
  const pauseIndex = (s) => +s.step.slice(-1) - 1;

  function sessionInfo() {
    const s = currentSession();
    return s && unitCache.get(refKey(s.ref));
  }

  function sessionTitle(s, info) {
    return `${s.ref.mode === "test" ? "Test · " : ""}${info.label}`;
  }

  /** Fortschritt wie im Design-Kit: Balken über alle Schritte des Teils. */
  function progressHtml(s, info) {
    const steps = stepsOf(info);
    const idx = steps.indexOf(s.step);
    const pct = Math.round(((idx + 1) / steps.length) * 100);
    const where = info.parts > 1 ? `${partName(info)} · Teil ${info.partNo}/${info.parts}` : partName(info);
    return `<div class="progress run"><div class="progress-bar"><span style="width:${pct}%"></span></div><span class="progress-score">${where} · S. ${s.ref.page}</span></div>`;
  }

  /** Kopfzeile: Schließen, Titel, Schritt. Im Testmodus mit Pfeilen und Schrittliste. */
  function sessionTopbar(s, info) {
    const steps = stepsOf(info);
    const idx = steps.indexOf(s.step);
    const side =
      s.ref.mode === "test"
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

  function openStepSheet(s) {
    const steps = stepsOf(sessionInfo());
    const cur = steps.indexOf(s.step);
    openSheet(
      `<div class="sheet" role="dialog" aria-label="Schritt wählen">
        <div class="sheet-head"><div class="sheet-head-row"><h3>Schritt wählen</h3><button class="icon-btn" data-action="close-sheet" aria-label="Schließen">${icon("close")}</button></div></div>
        <div class="sheet-list">${steps.map(
          (st, i) => `<button class="lesson-card ${st === s.step ? "current" : ""}" data-action="goto-step" data-value="${st}">
              <span class="dot ${i < cur ? "done" : "open"}">${i < cur ? icon("check") : ""}</span>
              <span class="lesson-card-text"><span class="lesson-card-title">${STEP_LABEL[st]}</span><span class="lesson-card-sub">${STEP_GROUP[st]}</span></span>
            </button>`
        ).join("")}</div>
      </div>`
    );
  }

  /** Aufgabe der aktuellen Pause (wird bei Bedarf neu angelegt). */
  function exerciseOf(s) {
    const k = pauseIndex(s);
    if (!Activities.valid(s.ex[k], k)) {
      s.ex[k] = Activities.init(k);
      save();
    }
    return s.ex[k];
  }

  /** Zustand von Ordnen k (wird bei Bedarf neu angelegt). */
  function sortOf(s, info) {
    const k = sortIndex(s.step);
    if (!Review.sortValid(s.sorts[k], info.keys.length, k)) {
      s.sorts[k] = Review.sortInit(info.keys.length, k);
      save();
    }
    return s.sorts[k];
  }

  const vaultMarks = () => Vault.marks(state.vault);

  function viewSession() {
    const s = currentSession();
    const info = sessionInfo();
    if (!s || !info) return `<div class="loading-screen">Lädt …</div>`;
    let body = "";
    let footer = null;
    let showPlayer = false;
    let wheel = "";
    if (s.step === "learn" || /^review/.test(s.step)) {
      body = learnBodyHtml(s, info);
      showPlayer = true;
    } else if (isPause(s)) {
      const k = pauseIndex(s);
      const ex = exerciseOf(s);
      const t = pauseState(s, k);
      if (k === 0) body = Activities.dhikrHtml(ex, t);
      else if (k === 1) body = Activities.quizHtml(ex, t);
      else body = Activities.textHtml(ex, t);
    } else if (isSort(s.step) && info.keys) {
      const st = sortOf(s, info);
      body = Review.sortSheetHtml(sortIndex(s.step), st, info.keys);
      wheel = Review.sortWheelHtml(sortIndex(s.step), st, info.keys);
    } else if (s.step === "verses" && info.prep) {
      body = Review.contextHtml(info, vaultMarks());
      showPlayer = true;
    } else if (s.step === "reflect") body = reflectHtml(s);
    if (footer === null) {
      footer = `
        ${wheel}
        ${showPlayer ? `<div class="player audio-card" id="player">${playerHtml()}</div><p class="player-error" id="player-error" hidden>Die Rezitation konnte nicht geladen werden. Bitte prüfe deine Internetverbindung.</p>` : ""}
        <div class="nav-row">
          <button class="btn secondary btn-back" data-action="back" ${canGoBack(s) ? "" : "disabled"}>Zurück</button>
          <button class="btn" data-action="next" ${canGoNext(s) ? "" : "disabled"}>${nextLabel(s)}</button>
        </div>
        <p class="how" id="session-hint">${hintText(s)}</p>`;
    }
    return `
      ${sessionTopbar(s, info)}
      ${progressHtml(s, info)}
      <main class="content">${body}</main>
      <footer class="footer ${isPause(s) ? "ex-footer" : ""} ${wheel ? "wheel-footer" : ""}">${footer}</footer>`;
  }

  function learnBodyHtml(s, info) {
    const review = s.step !== "learn";
    const fifths = Math.min(...s.levels);
    const status = !review
      ? `Auswendiglernen · <span class="multi">Runde ${fifths + 1} · ${fifths === 0 ? "alles sichtbar" : fifths >= Fade.PARTS ? "alles ausgegraut" : `${fifths}/${Fade.PARTS} ausgegraut`}</span>`
      : `Wiederholung ${s.step.slice(-1)}/3 · <span class="multi">aus dem Gedächtnis</span>`;
    const pages = [...new Set(info.unit.verses.map((v) => v.page))];
    return `
      <div class="section-label">${status}</div>
      <div class="range-caption">${esc(info.label)} · Seite ${pages.join("–")}${info.tail ? `<br><span class="next-note">Blau: Anfang des nächsten Verses als Anschluss</span>` : ""}${review ? `<br><span class="vault-note">🔒 Vertan? Tippe auf das Wort – dann kommt es in den Tresor.</span>` : ""}</div>
      ${review ? `<div class="peek-row"><button class="chip-btn ${screen.peek ? "on" : ""}" data-action="peek" aria-pressed="${!!screen.peek}">${screen.peek ? "Text verbergen" : "👁 Text zum Prüfen zeigen"}</button></div>` : ""}
      <div class="mushaf full" id="mushaf">${Mushaf.unitHtml(info.unit, {
        // Wiederholung: alles ausgegraut – zum Prüfen lässt sich der Text zeigen
        levels: s.step === "learn" ? s.levels : s.levels.map(() => (screen.peek ? 0 : Fade.PARTS)),
        shapes: info.shapes,
        wordIndex: info.wordIndex,
        activeKey: player.activeKey,
        tail: info.tail ? info.tail.tokens : [],
        marked: vaultMarks(),
      })}</div>`;
  }

  /* ---- Pausen */

  function pauseState(s, k) {
    const p = s.pauses[k];
    const total = PAUSES[k];
    const left = p.started ? Math.max(0, (p.end - Date.now()) / 1000) : total;
    return { started: !!p.started, done: !!p.done, left, total };
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

  /** Pause vorbei? (Zeit um) */
  const pauseFinished = (s) => !!s.pauses[pauseIndex(s)].done;

  /** Nach der Dhikr-Minute geht es von selbst zur Wiederholung. */
  function autoAdvance(s, delay) {
    if (pauseIndex(s) !== 0 || !pauseFinished(s)) return false;
    const step = s.step;
    later(() => {
      const steps = stepsOf(sessionInfo());
      if (currentSession() === s && s.step === step) gotoStep(s, steps[steps.indexOf(step) + 1]);
    }, delay || 0);
    return true;
  }

  function runPauseTicker(s) {
    const k = pauseIndex(s);
    const p = s.pauses[k];
    if (!p.started || p.done) return;
    requestWakeLock();
    const total = PAUSES[k];
    const tick = () => {
      const left = Math.max(0, (p.end - Date.now()) / 1000);
      document.querySelectorAll("#ring-time").forEach((t) => (t.textContent = mmss(Math.ceil(left))));
      const bar = document.getElementById("ring-bar");
      if (bar) bar.setAttribute("stroke-dashoffset", String(2 * Math.PI * 52 * (1 - left / total)));
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
    if (s.ref.mode === "test") return true;
    if (isPause(s)) return pauseFinished(s);
    if (isSort(s.step)) {
      const info = sessionInfo();
      return !info || !info.keys || Review.sortDone(s.sorts[sortIndex(s.step)], info.keys.length);
    }
    return true;
  }

  function nextLabel(s) {
    if (s.ref.mode === "test" && isPause(s) && !pauseFinished(s)) return "Timer überspringen";
    return "Weiter";
  }

  function hintText(s) {
    switch (s.step) {
      case "learn": {
        const f = Math.min(...s.levels);
        if (f === 0) return "Hör zu und lies mit – so oft du willst. „Weiter“ graut ein Fünftel jedes Wortes aus.";
        if (f < Fade.PARTS) return "Lies weiter mit dem Rezitator. „Weiter“ graut ein weiteres Fünftel aus, „Zurück“ holt es wieder.";
        return `Alles ausgegraut. Nach „Weiter“ folgt eine Pause von ${PAUSES[0] >= 60 ? PAUSES[0] / 60 + " Minute" : PAUSES[0] + " Sekunden"}.`;
      }
      case "review1":
      case "review2":
      case "review3": {
        const steps = stepsOf(sessionInfo());
        const nxt = steps[steps.indexOf(s.step) + 1];
        return `Sag den Abschnitt aus dem Gedächtnis auf. Danach ${isSort(nxt) ? "ordnest du die Schlüsselwörter" : nxt === "reflect" ? "kommt der Abschluss" : "folgt die nächste Pause"}.`;
      }
      case "sort1":
      case "sort2":
      case "sort3": {
        const info = sessionInfo();
        if (info && info.keys && Review.sortDone(s.sorts[sortIndex(s.step)], info.keys.length)) return s.step === "sort3" ? "Geschafft. Weiter zum Zusammenhang." : "Geschafft. Weiter zur nächsten Pause.";
        return s.step === "sort1" ? "Ordne jedem Versstück sein Schlüsselwort zu." : "Wische zum gesuchten Eintrag und setze ihn ein – oder zieh ihn nach oben.";
      }
      case "verses":
        return "Tippe auf ein Wort, um es in den Tresor zu legen. „Weiter“ führt zum Abschluss.";
      case "reflect":
        return "Freiwillig – „Weiter“ schließt den Abschnitt ab.";
      default:
        return pauseFinished(s) ? "Zeit um. Weiter zur Wiederholung." : "Die Zeit läuft …";
    }
  }

  function gotoStep(s, step) {
    clearLater();
    s.step = step;
    screen.peek = false;
    screen.vaultRange = null;
    if (isPause(s)) {
      const k = pauseIndex(s);
      // Eine schon beendete Pause beginnt beim erneuten Betreten von vorn
      if (s.pauses[k].done) {
        s.pauses[k] = {};
        s.ex[k] = null;
      }
      exerciseOf(s);
      startTimer(s, k);
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
    if (isPause(s) && !pauseFinished(s)) {
      if (s.ref.mode !== "test") return;
      finishTimer(s, pauseIndex(s), false); // Testmodus: überspringen
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

  function completeUnit(s) {
    const info = sessionInfo();
    state.journal.push({
      date: today(),
      label: `${info.label} · S. ${s.ref.page}`,
      d1: s.reflect.d1 || "",
      d7: s.reflect.d7 || "",
      life: s.reflect.life || "",
    });
    if (state.journal.length > 200) state.journal = state.journal.slice(-200);
    player.stop();
    const mode = s.ref.mode;
    state.sessions[mode] = null;
    save();
    go("unitDone", { mode, ref: s.ref, label: info.label, part: partName(info) });
  }

  function afterSession() {
    const s = currentSession();
    const info = sessionInfo();
    if (!s || !info) return;
    const el = document.getElementById("mushaf");
    if (el) Mushaf.fit(el);
    if (isSort(s.step) && info.keys) {
      const step = s.step;
      Review.mountSort(root, sortIndex(step), sortOf(s, info), info.keys, {
        save,
        render: () => {
          if (currentSession() === s && s.step === step) render(true);
        },
        buzz: () => navigator.vibrate && navigator.vibrate(40),
      });
    }
    if (document.getElementById("player")) {
      const verses = info.unit.verses.map((v) => ({ surah: v.surah, ayah: v.ayah }));
      const tail = info.tail && { surah: info.tail.verse.surah, ayah: info.tail.verse.ayah, words: info.tail.words.length, verseWords: info.tail.verseWords };
      const sig = state.reciter + "|" + verses.map((v) => v.surah + ":" + v.ayah).join(",");
      if (player.signature !== sig) player.load(state.reciter, verses, tail);
      updatePlayerUi(true);
    }
    // Nach der Dhikr-Minute kurz „Die Minute ist um“ zeigen, dann weiter
    if (isPause(s)) {
      if (!autoAdvance(s, 1800)) runPauseTicker(s);
    }
  }

  /* ------------------------------------------------------------- Abschlüsse */

  function viewUnitDone() {
    return `
      <header class="topbar kit"><span class="topbar-side"></span><span class="topbar-title">Geschafft!</span><span class="topbar-side"></span></header>
      <main class="content result">
        <div class="done-icon">${icon("check")}</div>
        <h1 class="result-title">${esc(screen.part || "Teil")} geschafft!</h1>
        <p class="result-sub">Ma schā' Allāh</p>
        <div class="card score-card"><span class="label">Gelernt</span><span class="score-num">${esc(screen.label)}</span><span class="score-pct">Seite ${screen.ref.page}</span></div>
        ${vaultRowHtml()}
      </main>
      <footer class="footer two">
        <button class="btn secondary" data-action="to-pick">Zur Seite</button>
        <button class="btn" data-action="next-unit">Nächster Teil</button>
      </footer>`;
  }

  /** Nächster Teil: auf der Seite, sonst auf der nächsten Seite des Bereichs. */
  async function nextUnit() {
    const ref = screen.ref;
    const range = await resolveRange(rangeOf(ref.mode, ref.sel || state.sel));
    await Quran.loadPages([ref.page, ref.page + 1, ref.page + 2]);
    let { page, part } = ref;
    if (part + 1 < Quran.pageUnits(page, ref.size, range.has).length) part++;
    else if (page < range.p1) {
      page++;
      part = 0;
    } else return openPick(ref.mode, ref.page);
    if (ref.mode === "main" && ref.sel) state.sel = Object.assign({}, ref.sel);
    startUnit(ref.mode, page, ref.size, part, true);
  }

  /* ----------------------------------------------------------------- Tresor */

  /** Tresor öffnen: Suren der Stellen laden, dann die Liste zeigen. */
  async function openVault() {
    // Zurück führt zum Abschluss eines Teils bzw. zur Startseite
    const back = screen.name === "unitDone" ? Object.assign({}, screen) : screen.name === "vault" || screen.name === "practice" ? screen.back : null;
    await Promise.all([...new Set(state.vault.map((x) => x.s))].map((n) => Quran.load(n)));
    go("vault", { back });
  }

  function viewVault() {
    const n = state.vault.length;
    const open = state.vault.filter((x) => !Vault.solid(x)).length;
    return `
      <header class="topbar kit">
        <button class="icon-btn" data-action="vault-back" aria-label="Zurück">${icon("back")}</button>
        <span class="topbar-title">Tresor</span>
        <span class="topbar-side count">${n || ""}</span>
      </header>
      <main class="content vault-page">
        ${heading("Tresor · <span class=\"multi\">schwierige Stellen</span>", "Wo vertust du dich immer wieder?", n ? "Die Stellen mit den meisten Fehlern stehen oben. Üben: Die Stelle ist verdeckt – sag sie auf, deck sie auf und sag ehrlich, ob du sie wusstest." : "")}
        <div class="vault-list">${Vault.listHtml(state.vault, screen.playing)}</div>
      </main>
      ${n ? `<footer class="footer"><button class="btn" data-action="vault-practice">Alle üben (${open || n})</button></footer>` : ""}`;
  }

  /** Üben: offene Stellen (sonst alle), die schwierigsten zuerst – oder nur eine. */
  function startPractice(id) {
    const list = Vault.sorted(state.vault);
    const open = list.filter((x) => !Vault.solid(x));
    const queue = id ? [id] : (open.length ? open : list).map((x) => x.id);
    if (!queue.length) return;
    player.stop();
    go("practice", { queue, pos: 0, revealed: false, known: 0, back: screen.back });
  }

  function viewPractice() {
    const { queue, pos } = screen;
    const it = state.vault.find((x) => x.id === queue[pos]);
    let body;
    let footer;
    if (!it) {
      body = `<div class="result"><div class="done-icon">${icon("check")}</div>
          <h1 class="result-title">Geübt!</h1>
          <p class="result-sub">${screen.known} von ${queue.length} gewusst</p></div>`;
      footer = `<button class="btn" data-action="vault">Zurück zum Tresor</button>`;
    } else {
      body = Vault.practiceHtml(it, screen.revealed, pos, queue.length);
      const playing = screen.playing === it.id;
      footer = screen.revealed
        ? `<div class="nav-row"><button class="btn bad-btn" data-action="practice-grade" data-value="0">✕ Wieder Fehler</button><button class="btn ok-btn" data-action="practice-grade" data-value="1">✓ Gewusst</button></div>
           <button class="link-btn" data-action="vault-play" data-value="${it.id}">${playing ? "❚❚ Stopp" : "▶ Vers anhören"}</button>`
        : `<button class="btn" data-action="practice-reveal">Aufdecken</button>
           <button class="link-btn" data-action="vault-play" data-value="${it.id}">${playing ? "❚❚ Stopp" : "▶ Vers anhören"}</button>`;
    }
    return `
      <header class="topbar kit">
        <button class="icon-btn" data-action="vault" aria-label="Zum Tresor">${icon("close")}</button>
        <span class="topbar-title">Tresor üben</span>
        <span class="topbar-side count">${Math.min(pos + 1, queue.length)}/${queue.length}</span>
      </header>
      <main class="content">${body}</main>
      <footer class="footer">${footer}</footer>`;
  }

  /** Vers einer Stelle anhören (noch einmal: Stopp). */
  function vaultPlay(id) {
    const it = state.vault.find((x) => x.id === id);
    if (!it) return;
    ensureAudioCtx();
    if (screen.playing === id && (player.status === "playing" || player.status === "loading")) {
      player.stop();
      screen.playing = null;
    } else {
      screen.playing = id;
      player.preview(state.reciter, it.s, it.a);
    }
    render(true);
  }

  /** Mehrere Wörter: das erste ist gewählt, jetzt das letzte antippen. */
  function startVaultRange(w) {
    const sheet = document.querySelector(".vault-sheet");
    if (!sheet) return;
    screen.vaultRange = { key: sheet.dataset.key, w: +w };
    closeSheet();
    showRangeBar();
  }

  function showRangeBar() {
    document.querySelectorAll(".range-bar").forEach((x) => x.remove());
    document.querySelectorAll(".t.range-start").forEach((x) => x.classList.remove("range-start"));
    const r = screen.vaultRange;
    if (!r) return;
    document.querySelectorAll(`.t[data-key="${r.key}"][data-w="${r.w}"]`).forEach((x) => x.classList.add("range-start"));
    const bar = document.createElement("div");
    bar.className = "range-bar";
    bar.setAttribute("role", "status");
    bar.innerHTML = `<span>🔒 Tippe jetzt das <b>letzte Wort</b> der Stelle an (im selben Vers).</span><button class="link-btn" data-action="vault-range-cancel">Abbrechen</button>`;
    document.body.appendChild(bar);
  }

  /** Zweites Wort angetippt: Wörter dazwischen in den Tresor. */
  function finishVaultRange(key, w) {
    const r = screen.vaultRange;
    if (key !== r.key) return toast("Bitte ein Wort im selben Vers antippen");
    const [sNo, aNo] = key.split(":").map(Number);
    const w0 = Math.min(r.w, w);
    const w1 = Math.max(r.w, w);
    const it = Vault.add(state.vault, sNo, aNo, w0, w1, w0 === w1 ? "word" : "words");
    screen.vaultRange = null;
    save();
    render(true);
    toast(`🔒 ${w1 - w0 + 1} ${w0 === w1 ? "Wort" : "Wörter"} im Tresor${it.n > 1 ? ` · ${it.n}× Fehler` : ""}`);
  }

  /** Blatt „In den Tresor“ nach dem Antippen eines Wortes. */
  function openVaultSheet(key, w) {
    const info = sessionInfo();
    const [sNo, aNo] = key.split(":").map(Number);
    const verse = Quran.verse(sNo, aNo);
    if (!info || !verse) return;
    const f = info.fragments.find((x) => x.key === key && x.words.length && x.words[0].w <= w && w <= x.words[x.words.length - 1].w);
    openSheet(Vault.sheetHtml({ list: state.vault, verse, w, frag: f ? [f.words[0].w, f.words[f.words.length - 1].w] : null, canPlay: !!document.getElementById("player") }));
  }

  function vaultAdd(value) {
    const sheet = document.querySelector(".vault-sheet");
    const key = sheet && sheet.dataset.key;
    if (!key) return;
    const [kind, w0, w1] = value.split(":");
    const [sNo, aNo] = key.split(":").map(Number);
    const it = Vault.add(state.vault, sNo, aNo, +w0, +w1, kind);
    save();
    closeSheet();
    render(true);
    toast(`🔒 ${Vault.KIND[kind]} im Tresor${it.n > 1 ? ` · ${it.n}× Fehler` : ""}`);
  }

  function toast(text) {
    const old = document.getElementById("toast");
    if (old) old.remove();
    const el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    el.setAttribute("role", "status");
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add("out"), 1800);
    setTimeout(() => el.remove(), 2300);
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
      document.querySelectorAll("#mushaf .t[data-key], #ctx .t[data-key]").forEach((t) => t.classList.toggle("active", t.dataset.key === active));
    }
  }

  let sheetPreview = null;
  function onPlayerChange(p, kind) {
    if (screen.name === "session") updatePlayerUi();
    if ((screen.name === "vault" || screen.name === "practice") && kind === "status" && screen.playing && (p.status === "ended" || p.status === "error" || p.status === "idle")) {
      screen.playing = null;
      render(true);
    }
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

  /** Verzögerte Schritte (werden beim Screenwechsel verworfen). */
  function later(fn, ms) {
    const id = setTimeout(() => {
      laterTimers = laterTimers.filter((x) => x !== id);
      fn();
    }, ms);
    laterTimers.push(id);
  }

  function clearLater() {
    laterTimers.forEach(clearTimeout);
    laterTimers = [];
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

  /* ------------------------------------------------------------------ Events */

  async function handleAction(action, value, target, event) {
    const s = currentSession();
    switch (action) {
      case "start":
        return go("start");
      // Startseite
      case "sel-open":
        screen.open = screen.open === value ? null : value;
        screen.query = "";
        render(true);
        return;
      case "sel-juz":
        state.sel.mode = "juz";
        state.sel.juz = +value;
        screen.open = null;
        save();
        return render(true);
      case "sel-surah": {
        const n = +value;
        state.sel = Object.assign(state.sel, { mode: "surah", surah: n, from: 1, to: Quran.meta(n).ayahs });
        screen.query = "";
        save();
        render(true);
        const vr = document.querySelector(".verse-range");
        if (vr) vr.scrollIntoView({ block: "nearest", behavior: "smooth" });
        return;
      }
      case "sel-from":
      case "sel-to": {
        const v = +target.value;
        state.sel.mode = "surah";
        if (action === "sel-from") state.sel.from = v;
        else state.sel.to = v;
        if (state.sel.from > state.sel.to) {
          if (action === "sel-from") state.sel.to = state.sel.from;
          else state.sel.from = state.sel.to;
        }
        save();
        return render(true);
      }
      case "sel-page-step":
        setPage(state.sel.page + +value);
        return;
      case "start-range":
        return openPick("main");
      case "resume":
        return resumeSession("main");
      case "test":
        return openPick("test");
      // Seitenauswahl
      case "pick-size":
        state.pick[screen.mode].size = +value;
        save();
        return render(true);
      case "pick-page":
        return pickPage(screen.mode, +value);
      case "to-pick":
        return openPick(screen.mode, screen.ref && screen.ref.page);
      case "next-unit":
        return nextUnit();
      // Rezitator
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
      // Sitzung
      case "close-session":
        player.stop();
        if (s) return openPick(s.ref.mode, s.ref.page);
        return go("start");
      case "pref":
        if (value === "de") state.prefs.de = !state.prefs.de;
        save();
        return render(true);
      case "peek":
        screen.peek = !screen.peek;
        return render(true);
      case "next":
        return next();
      case "back":
        return back();
      case "goto-step":
        if (s && s.ref.mode === "test") gotoStep(s, value);
        return;
      case "step-jump": {
        if (!s || s.ref.mode !== "test") return;
        const steps = stepsOf(sessionInfo());
        const i = steps.indexOf(s.step) + +value;
        if (i >= 0 && i < steps.length) gotoStep(s, steps[i]);
        return;
      }
      case "step-sheet":
        if (s) openStepSheet(s);
        return;
      // Pausen
      case "dhikr-tap":
      case "dhikr-done":
        if (s && isPause(s) && pauseIndex(s) === 0 && !pauseFinished(s)) {
          if (navigator.vibrate) navigator.vibrate(action === "dhikr-tap" ? 8 : 20);
          Activities.dhikrAct(s.ex[0], action === "dhikr-tap" ? "tap" : "done");
          save();
          render(true);
        }
        return;
      case "timer-start":
        if (s && isPause(s)) {
          ensureAudioCtx();
          startTimer(s, pauseIndex(s));
          render(true);
        }
        return;
      case "quiz-answer": {
        const a = s.ex[1];
        const qid = a.order[a.pos];
        if (a.answers[qid] === undefined && !s.pauses[1].done) {
          a.answers[qid] = +value;
          save();
          render(true);
        }
        return;
      }
      case "quiz-next":
        s.ex[1].pos++;
        save();
        return render(true);
      case "text-answer": {
        const [qi, i] = value.split(":").map(Number);
        const a = s && s.ex[2];
        if (a && a.choices[qi] === null) {
          a.choices[qi] = i;
          save();
          render(true);
        }
        return;
      }
      // Tresor
      case "vault":
        return openVault();
      case "vault-back":
        player.stop();
        if (screen.back && screen.back.name === "unitDone") return go("unitDone", screen.back);
        return go("start");
      case "vault-add":
        return vaultAdd(value);
      case "vault-range":
        return startVaultRange(value);
      case "vault-range-cancel":
        screen.vaultRange = null;
        return showRangeBar();
      case "vault-listen":
        closeSheet();
        ensureAudioCtx();
        return player.playFromKey(value);
      case "vault-play":
        return vaultPlay(value);
      case "vault-practice":
        return startPractice(value);
      case "vault-remove": {
        state.vault = state.vault.filter((x) => x.id !== value);
        save();
        render(true);
        return toast("Aus dem Tresor genommen");
      }
      case "practice-reveal":
        screen.revealed = true;
        return render(true);
      case "practice-grade": {
        const it = state.vault.find((x) => x.id === screen.queue[screen.pos]);
        if (it) {
          if (+value) {
            it.ok = (it.ok || 0) + 1;
            screen.known++;
          } else {
            it.n++;
            it.ok = 0;
          }
          it.last = Date.now();
          save();
        }
        player.stop();
        screen.playing = null;
        screen.pos++;
        screen.revealed = false;
        render();
        return window.scrollTo(0, 0);
      }
      // Rezitation
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
      if (el.tagName === "INPUT" || el.tagName === "SELECT") return; // über "change"
      if (el.tagName === "BUTTON" && el.disabled) return;
      handleAction(el.dataset.action, el.dataset.value, el, e);
      return;
    }
    // Tippen auf ein Wort: beim Lernen ab diesem Vers abspielen,
    // beim Wiederholen und im Zusammenhang in den Tresor legen
    const tok = e.target.closest("#mushaf .t[data-key], #ctx .t[data-key]");
    const s = currentSession();
    if (!tok || !s) return;
    if ((/^review/.test(s.step) || s.step === "verses") && tok.dataset.w !== undefined) {
      if (screen.vaultRange) return finishVaultRange(tok.dataset.key, +tok.dataset.w);
      return openVaultSheet(tok.dataset.key, +tok.dataset.w);
    }
    if (s.step === "learn") {
      ensureAudioCtx();
      player.playFromKey(tok.dataset.key);
    }
  });

  document.addEventListener("change", (e) => {
    const el = e.target.closest("input[data-action], select[data-action]");
    if (el) handleAction(el.dataset.action, el.dataset.value, el, e);
  });

  // Eingaben (Suche, Seite, Notizen) sofort übernehmen
  document.addEventListener("input", (e) => {
    const field = e.target.dataset && e.target.dataset.field;
    if (field === "sura-search") {
      screen.query = e.target.value;
      const list = document.getElementById("sura-list");
      if (list) list.innerHTML = suraListHtml(state.sel.surah, screen.query);
      return;
    }
    if (field === "sel-page") {
      if (e.target.value !== "") setPage(+e.target.value);
      return;
    }
    const s = currentSession();
    if (!field || !s) return;
    const v = e.target.value;
    const ex = isPause(s) ? s.ex[pauseIndex(s)] : null;
    if (field === "dhikr-count" && ex) ex.count = v;
    else if (field === "quiz-note" && ex) ex.note = v;
    else if (field === "text-note" && ex) ex.note = v;
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
    // Seitenauswahl: Pfeiltasten blättern
    if (screen.name === "pick" && !/INPUT|SELECT|TEXTAREA/.test(e.target.tagName || "")) {
      if (e.key === "ArrowLeft") pickPage(screen.mode, -1);
      if (e.key === "ArrowRight") pickPage(screen.mode, 1);
    }
  });

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      for (const id of ["mushaf", "pick-page"]) {
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
      if (document.fonts && document.fonts.load) await Promise.race([Promise.all(['20px "UthmanicHafs"', '20px "MadinaHafs"'].map((f) => document.fonts.load(f))), new Promise((r) => setTimeout(r, 4000))]);
      // Abgelaufene Timer beim Laden abschließen
      for (const s of [state.sessions.main, state.sessions.test]) {
        if (!s || !Array.isArray(s.pauses)) continue;
        s.pauses.forEach((p) => {
          if (p.started && !p.done && Date.now() >= p.end) p.done = true;
        });
      }
      save();
    } catch (e) {
      screen = { name: "loading", message: "Die Daten konnten nicht geladen werden. Bitte lade die Seite neu." };
      render();
      return;
    }
    if (params.has("test")) return openPick("test");
    go("start");
  }

  init();
})();
