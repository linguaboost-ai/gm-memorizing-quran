/*
 * German Method – Hifz: Screens, Zustand und Ablauf.
 *
 * Ablauf pro Lernabschnitt:
 *   Lernen    – mitlesen/anhören, „Gelernt“ graut schrittweise Buchstaben aus,
 *               bis alle Wörter ausgegraut sind.
 *   Pause 1   – 1 Minute nur Timer, danach Wiederholung (Seite ausgegraut)
 *   Pause 2   – 2 Minuten, danach Wiederholung
 *   Pause 3   – 4 Minuten, danach Wiederholung → nächster Abschnitt
 */
(function () {
  "use strict";

  const { Quran, Fade, Mushaf, Player, Reciters } = window;
  const esc = Fade.escapeHtml;

  const STORAGE_KEY = "gm-hifz:v1";
  const params = new URLSearchParams(location.search);
  // ?timer=5 verkürzt alle Pausen auf 5 Sekunden (zum Ausprobieren)
  const TEST_SECONDS = Math.max(0, Number(params.get("timer")) || 0);
  const PAUSES = [60, 120, 240].map((s) => TEST_SECONDS || s);

  const DAILY_OPTIONS = [0.5, 1, 2];
  const CHUNK_OPTIONS = [0.25, 0.5, 1, 2];
  const DEFAULT_SURAH = 67;

  const ICONS = {
    close: "M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z",
    play: "M8 5v14l11-7z",
    pause: "M6 19h4V5H6v14zm8-14v14h4V5h-4z",
    replay: "M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z",
    loading: "M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z",
    check: "M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z",
    chevron: "M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z",
    arrow: "M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z",
    undo: "M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z",
    lock: "M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z",
  };
  const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name]}"/></svg>`;

  // Wellenform wie im Design (Höhen in px)
  const BAR_HEIGHTS = [4, 10, 16, 24, 12, 8, 14, 22, 18, 10, 6, 12, 20, 26, 14, 8, 4, 10, 18, 24, 12, 16, 8, 6, 14, 20, 10, 4];

  /* ---------------------------------------------------------------- Zustand */

  const blankState = () => ({ plan: null, progress: null, session: null, reciter: "afasy" });

  function loadState() {
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (s && typeof s === "object") return Object.assign(blankState(), s);
    } catch (e) {
      /* leer oder ungültig */
    }
    return blankState();
  }

  let state = loadState();
  const save = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      /* privater Modus o. Ä. */
    }
  };

  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  /* ------------------------------------------------------------ Formatierung */

  function pagesLabel(x, withUnit = true) {
    if (x < 0.2) {
      const lines = Math.max(1, Math.round(x * 15));
      return `${lines} ${lines === 1 ? "Zeile" : "Zeilen"}`;
    }
    const q = Math.round(x * 4) / 4;
    const whole = Math.floor(q);
    const frac = { 0: "", 0.25: "¼", 0.5: "½", 0.75: "¾" }[q - whole];
    const num = (whole ? String(whole) : "") + frac || "0";
    if (!withUnit) return num;
    return `${num} ${q > 1 ? "Seiten" : "Seite"}`;
  }

  const fractionLabel = (v) => ({ 0.25: "¼", 0.5: "½", 1: "1", 2: "2" })[v];
  const unitLabel = (v) => (v > 1 ? "Seiten" : "Seite");
  const versesLabel = (a, b) => (a === b ? `Vers ${a}` : `Verse ${a}–${b}`);
  const mmss = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
  const minutesLabel = (sec) => (sec % 60 === 0 ? `${sec / 60} ${sec === 60 ? "Minute" : "Minuten"}` : `${sec} Sekunden`);

  function pageSpan(surah, from, to) {
    const p0 = surah.ayahs[from - 1].tokens[0].line.page;
    const lastTokens = surah.ayahs[to - 1].tokens;
    const p1 = lastTokens[lastTokens.length - 1].line.page;
    return p0 === p1 ? `Seite ${p0}` : `Seite ${p0}–${p1}`;
  }

  const normalize = (s) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[‘’'ʿʾ\-\s]/g, "");

  /* ------------------------------------------------------------------ Kontext */

  const root = document.getElementById("app");
  let screen = { name: "loading" };
  let ctx = null; // { surah, days } für den aktiven Plan
  let timerTicker = null;
  let wakeLock = null;
  let audioCtx = null;

  const player = new Player(onPlayerChange);

  async function loadPlanContext() {
    if (!state.plan) {
      ctx = null;
      return;
    }
    const surah = await Quran.load(state.plan.surah);
    ctx = { surah, days: Quran.plan(surah, state.plan.daily, state.plan.chunk) };
  }

  const chunkCache = new Map();
  function chunkInfo(dayIdx, chunkIdx) {
    const key = `${ctx.surah.n}:${state.plan.daily}:${state.plan.chunk}:${dayIdx}:${chunkIdx}`;
    if (chunkCache.has(key)) return chunkCache.get(key);
    const day = ctx.days[dayIdx];
    const chunk = day.chunks[chunkIdx];
    const words = Quran.wordsOf(ctx.surah, chunk.from, chunk.to);
    const letters = words.map((w) => Fade.letters(w.text));
    const info = {
      day,
      chunk,
      words,
      letters,
      counts: letters.map((l) => l.length),
      firstId: words[0].id,
    };
    chunkCache.set(key, info);
    return info;
  }

  function newSession(dayIdx, chunkIdx) {
    const info = chunkInfo(dayIdx, chunkIdx);
    return {
      day: dayIdx,
      chunk: chunkIdx,
      phase: "learn",
      round: 0,
      levels: new Array(info.words.length).fill(0),
      prev: null,
      review: 0,
      timerIdx: 0,
      timerEnd: 0,
    };
  }

  /* --------------------------------------------------------------- Navigation */

  function go(name, data = {}) {
    if ((screen.name === "learn" || screen.name === "setup") && name !== screen.name) player.stop();
    if (screen.name === "timer" && name !== "timer") releaseWakeLock();
    stopTimerTicker();
    screen = Object.assign({ name }, data);
    render();
    window.scrollTo(0, 0);
  }

  function render() {
    closeSheet();
    const views = { loading: viewLoading, setup: viewSetup, home: viewHome, learn: viewLearn, timer: viewTimer, chunkDone: viewChunkDone, dayDone: viewDayDone, surahDone: viewSurahDone };
    root.innerHTML = `<div class="screen screen-${screen.name}">${views[screen.name]()}</div>`;
    const after = { setup: afterSetup, home: afterHome, learn: afterLearn, timer: afterTimer };
    if (after[screen.name]) after[screen.name]();
    if (screen.name !== "timer") document.title = "German Method – Qur'an auswendig lernen";
  }

  function viewLoading() {
    return `<div class="loading-screen">${esc(screen.message || "Lädt …")}</div>`;
  }

  /* ------------------------------------------------------------------- Setup */

  let draft = null;

  function openSetup() {
    const p = state.plan;
    draft = {
      surah: p ? p.surah : DEFAULT_SURAH,
      daily: p ? p.daily : 0.5,
      chunk: p ? p.chunk : 0.25,
      reciter: (p && p.reciter) || state.reciter || "afasy",
      preview: null,
    };
    go("setup");
  }

  function surahLine(m) {
    return `${m.ayahs} Verse · ${pagesLabel(m.size)} · ${m.p0 === m.p1 ? "S. " + m.p0 : "S. " + m.p0 + "–" + m.p1}`;
  }

  function viewSetup() {
    const m = Quran.meta(draft.surah);
    const canClose = !!state.plan;
    return `
      <header class="topbar">
        ${canClose ? `<button class="icon-btn" data-action="home" aria-label="Schließen">${icon("close")}</button>` : ""}
        <span class="topbar-title">${canClose ? "Neuer Lernplan" : "German Method · Hifz"}</span>
      </header>
      <main class="content">
        ${canClose ? "" : `<div class="bismillah">${esc(Quran.basmala)}</div>`}
        <h1 class="h1">Was möchtest du auswendig lernen?</h1>
        <p class="lead">Wähle eine Sure und dein Tempo. Wir teilen sie nach den Seiten des Medina-Mushaf ein – immer nur ganze Verse.</p>

        <div class="section-title"><h2>Sure</h2></div>
        <button class="card picker" data-action="pick-surah">
          <span class="num-badge">${m.n}</span>
          <span class="picker-main"><strong>${esc(m.tr)}</strong><span>${esc(m.de)} · ${surahLine(m)}</span></span>
          <span class="picker-ar">${esc(m.ar)}</span>
          <svg class="chevron" viewBox="0 0 24 24"><path d="${ICONS.chevron}"/></svg>
        </button>

        <div class="section-title"><h2>Pro Tag lernen</h2><small>Tagespensum</small></div>
        <div class="options options-3" role="radiogroup" aria-label="Pro Tag lernen">
          ${DAILY_OPTIONS.map(
            (v) => `<button class="option" role="radio" aria-checked="${draft.daily === v}" data-action="daily" data-value="${v}">
              <b>${fractionLabel(v)}</b><span>${unitLabel(v)}</span></button>`
          ).join("")}
        </div>

        <div class="section-title"><h2>Auf einmal lernen</h2><small>Lerneinheit</small></div>
        <div class="options options-4" role="radiogroup" aria-label="Auf einmal lernen">
          ${CHUNK_OPTIONS.map(
            (v) => `<button class="option" role="radio" aria-checked="${draft.chunk === v}" data-action="chunk" data-value="${v}" ${v >= draft.daily ? "disabled" : ""}>
              <b>${fractionLabel(v)}</b><span>${unitLabel(v)}</span></button>`
          ).join("")}
        </div>
        <p class="field-note">Muss kleiner sein als dein Tagespensum.</p>

        <div class="section-title"><h2>Rezitator</h2><small>${Reciters.list.length} zur Auswahl</small></div>
        <div class="reciters" role="radiogroup" aria-label="Rezitator">${recitersHtml(draft.reciter, draft.preview)}</div>

        <div class="card-dark summary" id="plan-summary">${summaryHtml(null)}</div>
      </main>
      <footer class="footer">
        <button class="btn" data-action="start-plan">Plan starten</button>
      </footer>`;
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

  function summaryHtml(days) {
    if (!days) return `<span class="eyebrow">Dein Plan</span><div class="summary-row">Wird berechnet …</div>`;
    const counts = days.map((d) => d.chunks.length);
    const lo = Math.min(...counts);
    const hi = Math.max(...counts);
    const perDay = lo === hi ? String(lo) : `${lo}–${hi}`;
    return `
      <span class="eyebrow">So sieht dein Plan aus</span>
      <div class="summary-row"><b>${days.length}</b> ${days.length === 1 ? "Tag" : "Tage"} · je ca. ${pagesLabel(draft.daily)}</div>
      <small>Pro Tag ${perDay} ${hi === 1 ? "Lerneinheit" : "Lerneinheiten"} à ca. ${pagesLabel(draft.chunk)}.
      Jede Einheit: mitlesen, schrittweise ausgrauen, dann Pausen von 1, 2 und 4 Minuten mit Wiederholung.</small>`;
  }

  async function afterSetup() {
    const token = (afterSetup.token = (afterSetup.token || 0) + 1);
    try {
      const surah = await Quran.load(draft.surah);
      if (token !== afterSetup.token || screen.name !== "setup") return;
      const days = Quran.plan(surah, draft.daily, draft.chunk);
      const el = document.getElementById("plan-summary");
      if (el) el.innerHTML = summaryHtml(days);
    } catch (e) {
      const el = document.getElementById("plan-summary");
      if (el) el.textContent = e.message;
    }
  }

  function setDraft(changes) {
    Object.assign(draft, changes);
    if (draft.chunk >= draft.daily) draft.chunk = CHUNK_OPTIONS.filter((v) => v < draft.daily).pop();
    const y = window.scrollY;
    render();
    window.scrollTo(0, y);
  }

  async function startPlan(confirmed) {
    const hasProgress = state.plan && state.progress && (state.progress.day > 0 || state.progress.chunk > 0 || state.session);
    if (hasProgress && !confirmed) {
      confirmDialog(
        "Neuen Plan starten?",
        `Dein Fortschritt in Sure ${esc(Quran.meta(state.plan.surah).tr)} wird dabei zurückgesetzt.`,
        "Neuen Plan starten",
        () => startPlan(true)
      );
      return;
    }
    player.stop();
    state.plan = { surah: draft.surah, daily: draft.daily, chunk: draft.chunk, reciter: draft.reciter, created: today() };
    state.reciter = draft.reciter;
    state.progress = { day: 0, chunk: 0, completed: [], lastDoneDate: null };
    state.session = null;
    save();
    go("loading");
    await loadPlanContext();
    go("home");
  }

  /* --------------------------------------------------------------------- Home */

  let showAllDays = false;

  function planStatus() {
    const p = state.progress;
    const total = ctx.days.length;
    const finished = p.day >= total;
    const doneToday = !finished && p.lastDoneDate === today() && p.chunk === 0 && !state.session;
    return { total, finished, doneToday };
  }

  function viewHome() {
    const m = ctx.surah.meta;
    const p = state.progress;
    const { total, finished, doneToday } = planStatus();
    const pct = Math.round((Math.min(p.day, total) / total) * 100);
    const reciter = Reciters.byId(state.plan.reciter);

    return `
      <main class="content" style="padding-top:max(20px, env(safe-area-inset-top))">
        <div class="card hello">
          <div class="hello-main"><span>Assalamu 'Alaikum</span><strong>Dein Hifz-Plan</strong></div>
          <span class="pill pill-gold">${finished ? "Fertig" : `Tag ${p.day + 1} / ${total}`}</span>
        </div>
        <div class="bismillah">${esc(Quran.basmala)}</div>
        <h1 class="hero-title">${finished ? `Sure ${esc(m.tr)} ist geschafft.` : `Lerne Sure ${esc(m.tr)} auswendig.`}</h1>
        ${todayCardHtml(finished, doneToday)}

        <div class="section-title"><h2>Dein Weg</h2><small>${pct} % · ${total} ${total === 1 ? "Tag" : "Tage"}</small></div>
        <div class="card">
          <div class="progress" aria-label="Fortschritt"><i style="width:${pct}%"></i></div>
          <div class="days" style="margin-top:6px">${daysHtml()}</div>
        </div>

        <div class="section-title"><h2>Einstellungen</h2></div>
        <div class="card">
          <div class="settings-row"><div><small>Sure</small><strong>${m.n} · ${esc(m.tr)} <span class="arabic" style="color:var(--primary)">${esc(m.ar)}</span></strong></div></div>
          <div class="settings-row"><div><small>Tempo</small><strong>${pagesLabel(state.plan.daily)} pro Tag · ${pagesLabel(state.plan.chunk)} auf einmal</strong></div></div>
          <div class="settings-row"><div><small>Rezitator</small><strong>${esc(reciter.name)}</strong></div><button class="link-btn" data-action="change-reciter">Ändern</button></div>
          <div style="padding-top:12px"><button class="btn btn-outline" data-action="new-plan">Neuen Plan erstellen</button></div>
        </div>
        <p class="credits">Text &amp; Seitenlayout: King Fahd Complex (KFGQPC Uthmanic Hafs) via <a href="https://quran.ws" target="_blank" rel="noopener">quran.ws</a> (CC BY 4.0) · Audio: <a href="https://everyayah.com" target="_blank" rel="noopener">everyayah.com</a></p>
      </main>`;
  }

  function todayCardHtml(finished, doneToday) {
    const s = state.session;
    if (finished) {
      return `<div class="card-dark">
        <span class="eyebrow">Ma schā' Allāh</span>
        <h2 class="today-title">Alle ${ctx.days.length} Tage geschafft</h2>
        <p class="today-meta" style="text-align:left;margin:6px 0 16px">Wiederhole die Sure regelmäßig, damit sie bleibt.</p>
        <button class="btn btn-white" data-action="new-plan">Neue Sure wählen ${icon("arrow")}</button>
      </div>`;
    }
    const dayIdx = s ? s.day : state.progress.day;
    const day = ctx.days[dayIdx];
    const first = ctx.surah.ayahs[day.from - 1].tokens.filter((t) => t.type === Quran.TOKEN_WORD).slice(0, 4);
    const preview = first.map((t) => esc(t.text)).join(" ");
    const meta = `Sure ${ctx.surah.n} · ${esc(ctx.surah.meta.tr)} · ${pageSpan(ctx.surah, day.from, day.to)}`;

    if (doneToday) {
      return `<div class="card-dark">
        <div class="today-head"><span class="eyebrow">Tagespensum</span><span class="pill pill-light">${icon("check").replace("<svg", '<svg width="14" height="14" fill="#fff"')} Heute geschafft</span></div>
        <h2 class="today-title">Für heute geschafft</h2>
        <p class="today-meta" style="text-align:left;margin:6px 0 16px">Morgen geht es weiter mit Tag ${dayIdx + 1}: ${versesLabel(day.from, day.to)}.</p>
        <button class="btn btn-white" data-action="learn">Tag ${dayIdx + 1} jetzt schon lernen ${icon("arrow")}</button>
      </div>`;
    }

    let label = "Jetzt lernen";
    let pill = pagesLabel(day.size);
    if (s && s.phase === "timer") {
      const left = Math.max(0, Math.ceil((s.timerEnd - Date.now()) / 1000));
      label = left > 0 ? "Zum Timer" : "Weiterlernen";
      pill = left > 0 ? `Pause · <span id="home-timer">${mmss(left)}</span>` : "Pause vorbei";
    } else if (s || state.progress.chunk > 0) {
      label = "Weiterlernen";
      pill = `Abschnitt ${(s ? s.chunk : state.progress.chunk) + 1} / ${day.chunks.length}`;
    }
    return `<div class="card-dark">
      <div class="today-head"><span class="eyebrow">Tagespensum · Tag ${dayIdx + 1}</span><span class="pill pill-light">${pill}</span></div>
      <h2 class="today-title">${versesLabel(day.from, day.to)}</h2>
      <div class="today-arabic">${preview} …</div>
      <div class="today-meta">${meta}</div>
      <button class="btn btn-white" data-action="learn">${label} ${icon("arrow")}</button>
    </div>`;
  }

  function daysHtml() {
    const p = state.progress;
    const total = ctx.days.length;
    const current = state.session ? state.session.day : p.day;
    let list = ctx.days;
    let lo = 0;
    let hi = total;
    if (!showAllDays && total > 8) {
      lo = Math.max(0, Math.min(current - 2, total - 7));
      hi = Math.min(total, lo + 7);
    }
    list = ctx.days.slice(lo, hi);
    const rows = list
      .map((d) => {
        const done = d.index < p.day;
        const isCurrent = d.index === current && p.day < total;
        const cls = done ? "done" : isCurrent ? "current" : "";
        const dot = done ? icon("check") : String(d.index + 1);
        const doneDate = p.completed && p.completed[d.index];
        const right = isCurrent ? `<span class="pill pill-primary">Heute</span>` : done && doneDate ? `<span class="pill">${formatDate(doneDate)}</span>` : "";
        return `<div class="day ${cls}">
          <span class="day-dot">${dot}</span>
          <span class="day-main"><strong>Tag ${d.index + 1} · ${versesLabel(d.from, d.to)}</strong>
          <span>${pagesLabel(d.size)} · ${d.chunks.length} ${d.chunks.length === 1 ? "Lerneinheit" : "Lerneinheiten"} · ${pageSpan(ctx.surah, d.from, d.to)}</span></span>
          ${right}
        </div>`;
      })
      .join("");
    const toggle =
      total > 8 ? `<button class="link-btn" data-action="toggle-days" style="align-self:center;margin-top:6px">${showAllDays ? "Weniger anzeigen" : `Alle ${total} Tage anzeigen`}</button>` : "";
    return rows + toggle;
  }

  function formatDate(iso) {
    const [y, m, d] = iso.split("-");
    return `${d}.${m}.`;
  }

  function afterHome() {
    const s = state.session;
    if (s && s.phase === "timer") {
      startTimerTicker(() => {
        const left = Math.max(0, Math.ceil((s.timerEnd - Date.now()) / 1000));
        const el = document.getElementById("home-timer");
        if (el) el.textContent = mmss(left);
        if (left <= 0) {
          stopTimerTicker();
          finishPause(false);
          render();
        }
      });
    }
  }

  /* ------------------------------------------------------------------- Lernen */

  function startLearning() {
    if (!ctx || state.progress.day >= ctx.days.length) return;
    if (!state.session) {
      state.session = newSession(state.progress.day, state.progress.chunk);
      save();
    }
    checkPauseExpired();
    go(state.session.phase === "timer" ? "timer" : "learn");
  }

  function learnProgress(s, info) {
    return Fade.progress(s.levels, info.counts);
  }

  function segmentsHtml(s, info) {
    const fills = [s.phase === "learn" ? Math.round(learnProgress(s, info) * 100) : 100];
    for (let i = 0; i < PAUSES.length; i++) {
      const done = (s.phase === "review" && s.review >= i) || (s.phase === "timer" && s.timerIdx > i);
      fills.push(done ? 100 : 0);
    }
    return `<div class="segments" aria-hidden="true">${fills.map((f) => `<span><i style="--fill:${f}%"></i></span>`).join("")}</div>`;
  }

  function viewLearn() {
    const s = state.session;
    const info = chunkInfo(s.day, s.chunk);
    const { day, chunk } = info;
    const pct = Math.round(learnProgress(s, info) * 100);
    const allFaded = Fade.isDone(s.levels);

    let status;
    if (s.phase === "learn") {
      status = `<span class="pill pill-primary">Runde ${s.round + 1}</span>
        <span class="status-text">${s.round === 0 ? "Alles sichtbar" : allFaded ? "Alles ausgegraut" : `${pct} % ausgegraut`}</span>`;
    } else {
      status = `<span class="pill pill-gold">Wiederholung ${s.review + 1} / ${PAUSES.length}</span>
        <span class="status-text">aus dem Gedächtnis</span>`;
    }
    const undo = s.phase === "learn" && s.prev ? `<button class="link-btn muted" data-action="undo" aria-label="Rückgängig">↶ Rückgängig</button>` : "";

    return `
      <header class="topbar">
        <button class="icon-btn" data-action="home" aria-label="Zur Übersicht">${icon("close")}</button>
        <span class="topbar-title">Tag ${s.day + 1} · Abschnitt ${s.chunk + 1} / ${day.chunks.length}</span>
      </header>
      ${segmentsHtml(s, info)}
      <main class="content">
        <div class="status-row"><div class="left">${status}</div>${undo}</div>
        <div class="range-caption">${esc(ctx.surah.meta.tr)} · ${versesLabel(chunk.from, chunk.to)} · ${pageSpan(ctx.surah, chunk.from, chunk.to)}</div>
        <div class="mushaf" id="mushaf">${mushafHtml()}</div>
      </main>
      <footer class="footer">
        <div class="player" id="player">${playerHtml()}</div>
        <p class="player-error" id="player-error" hidden>Die Rezitation konnte nicht geladen werden. Bitte prüfe deine Internetverbindung.</p>
        <button class="btn" data-action="learned">${icon("check")} Gelernt</button>
        <p class="hint">${learnHint(s, day)}</p>
      </footer>`;
  }

  function learnHint(s, day) {
    if (s.phase === "learn") {
      if (s.round === 0) return "Hör zu und lies mit – so oft du willst. Dann tippe auf „Gelernt“.";
      if (!Fade.isDone(s.levels)) return "Lies weiter mit dem Rezitator. „Gelernt“ graut weitere Buchstaben aus.";
      return `Alles ausgegraut. Nach „Gelernt“ folgt eine Pause von ${minutesLabel(PAUSES[0])}.`;
    }
    if (s.review + 1 < PAUSES.length) return `Sag den Abschnitt auswendig auf. Danach: ${minutesLabel(PAUSES[s.review + 1])} Pause.`;
    return s.chunk + 1 < day.chunks.length
      ? "Letzte Wiederholung. Danach geht es weiter zum nächsten Abschnitt."
      : "Letzte Wiederholung. Danach ist dein Tagespensum geschafft.";
  }

  function mushafHtml() {
    const s = state.session;
    const info = chunkInfo(s.day, s.chunk);
    const levels = s.phase === "learn" ? s.levels : s.levels.map(() => Fade.PARTS);
    return Mushaf.html(ctx.surah, {
      from: info.chunk.from,
      to: info.chunk.to,
      levels,
      letters: info.letters,
      firstId: info.firstId,
      activeAyah: player.activeAyah,
    });
  }

  function afterLearn() {
    const s = state.session;
    const info = chunkInfo(s.day, s.chunk);
    const el = document.getElementById("mushaf");
    Mushaf.fit(el, ctx.surah);
    const reciter = state.plan.reciter;
    const same = player.surah === ctx.surah.n && player.from === info.chunk.from && player.to === info.chunk.to && player.reciter && player.reciter.id === reciter;
    if (!same) player.load(reciter, ctx.surah.n, info.chunk.from, info.chunk.to);
    updatePlayerUi();
  }

  function learned() {
    const s = state.session;
    ensureAudioCtx();
    if (s.phase === "learn") {
      if (Fade.isDone(s.levels)) return startPause(0);
      s.prev = s.levels;
      s.levels = Fade.step(s.levels);
      s.round++;
      save();
      rerenderLearn();
    } else if (s.phase === "review") {
      if (s.review + 1 < PAUSES.length) startPause(s.review + 1);
      else completeChunk();
    }
  }

  function undo() {
    const s = state.session;
    if (!s || !s.prev) return;
    s.levels = s.prev;
    s.prev = null;
    s.round = Math.max(0, s.round - 1);
    save();
    rerenderLearn();
  }

  function rerenderLearn() {
    const y = window.scrollY;
    const html = viewLearn();
    root.innerHTML = `<div class="screen screen-learn" style="animation:none">${html}</div>`;
    afterLearn();
    window.scrollTo(0, y);
  }

  /* ------------------------------------------------------------------- Player */

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
    const verses = player.queue.filter((x) => !x.basmala);
    if (st === "idle") return `${verses.length} ${verses.length === 1 ? "Vers" : "Verse"}`;
    if (st === "ended") return "Fertig";
    if (c && c.basmala) return "Basmala";
    if (c) return `Vers ${c.ayah - player.from + 1} / ${verses.length}`;
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
  /** Bei Statuswechsel den Player neu zeichnen, sonst nur Fortschritt und Versanzeige. */
  function updatePlayerUi() {
    const el = document.getElementById("player");
    if (el) {
      if (player.status !== lastPlayerStatus || !el.firstElementChild) {
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
    const active = player.activeAyah;
    if (active !== lastActive) {
      lastActive = active;
      document.querySelectorAll("#mushaf .t[data-ayah]").forEach((t) => t.classList.toggle("active", +t.dataset.ayah === active));
    }
  }

  function onPlayerChange(p, kind) {
    if (screen.name === "learn") updatePlayerUi();
    else if (screen.name === "setup" && kind === "status") {
      const list = document.querySelector(".reciters");
      if (list) list.innerHTML = recitersHtml(draft.reciter, draft.preview);
    } else if (kind === "status") {
      const list = document.querySelector(".sheet .reciters");
      if (list) list.innerHTML = recitersHtml(state.plan.reciter, sheetPreview);
    }
  }

  /* -------------------------------------------------------------------- Timer */

  function startPause(i) {
    const s = state.session;
    player.stop();
    s.phase = "timer";
    s.timerIdx = i;
    s.timerEnd = Date.now() + PAUSES[i] * 1000;
    s.prev = null;
    save();
    go("timer");
  }

  /** Pause beendet → Wiederholung. */
  function finishPause(notify = true) {
    const s = state.session;
    if (!s || s.phase !== "timer") return;
    s.phase = "review";
    s.review = s.timerIdx;
    save();
    releaseWakeLock();
    if (notify) {
      chime();
      if (navigator.vibrate) navigator.vibrate([180, 90, 180]);
    }
  }

  function checkPauseExpired() {
    const s = state.session;
    if (s && s.phase === "timer" && Date.now() >= s.timerEnd) finishPause(false);
  }

  function viewTimer() {
    const s = state.session;
    const info = chunkInfo(s.day, s.chunk);
    const steps = PAUSES.map((sec, i) => `<span class="${i === s.timerIdx ? "now" : i < s.timerIdx ? "past" : ""}">${sec % 60 === 0 ? sec / 60 + " Min" : sec + " s"}</span>`).join("");
    return `
      <header class="topbar">
        <button class="icon-btn" data-action="home" aria-label="Zur Übersicht">${icon("close")}</button>
        <span class="topbar-title">Tag ${s.day + 1} · Abschnitt ${s.chunk + 1} / ${info.day.chunks.length}</span>
      </header>
      ${segmentsHtml(s, info)}
      <div class="timer-wrap">
        <span class="eyebrow">Pause ${s.timerIdx + 1} von ${PAUSES.length}</span>
        <div class="ring">
          <svg viewBox="0 0 120 120"><circle class="track" cx="60" cy="60" r="52"/><circle class="bar" id="ring-bar" cx="60" cy="60" r="52" stroke-dasharray="326.73" stroke-dashoffset="0"/></svg>
          <div class="ring-label"><b id="ring-time">${mmss(PAUSES[s.timerIdx])}</b></div>
        </div>
        <div class="timer-steps">${steps}</div>
        <p class="lead" style="max-width:300px">Danach erscheint dein Abschnitt wieder – ausgegraut.</p>
      </div>`;
  }

  function afterTimer() {
    const s = state.session;
    const total = PAUSES[s.timerIdx] * 1000;
    requestWakeLock();
    const tick = () => {
      const leftMs = Math.max(0, s.timerEnd - Date.now());
      const left = Math.ceil(leftMs / 1000);
      const t = document.getElementById("ring-time");
      const bar = document.getElementById("ring-bar");
      if (t) t.textContent = mmss(left);
      if (bar) bar.setAttribute("stroke-dashoffset", String(326.73 * (1 - leftMs / total)));
      document.title = `${mmss(left)} · Pause`;
      if (leftMs <= 0) {
        stopTimerTicker();
        finishPause(true);
        go("learn");
      }
    };
    tick();
    startTimerTicker(tick);
  }

  function startTimerTicker(fn) {
    stopTimerTicker();
    timerTicker = setInterval(fn, 250);
  }

  function stopTimerTicker() {
    if (timerTicker) clearInterval(timerTicker);
    timerTicker = null;
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

  /* -------------------------------------------------------------- Abschlüsse */

  function completeChunk() {
    const s = state.session;
    const day = ctx.days[s.day];
    player.stop();
    state.session = null;
    if (s.chunk + 1 < day.chunks.length) {
      state.progress.day = s.day;
      state.progress.chunk = s.chunk + 1;
      save();
      go("chunkDone", { day: s.day, chunk: s.chunk });
    } else {
      state.progress.completed = state.progress.completed || [];
      state.progress.completed[s.day] = today();
      state.progress.day = s.day + 1;
      state.progress.chunk = 0;
      state.progress.lastDoneDate = today();
      save();
      go(s.day + 1 >= ctx.days.length ? "surahDone" : "dayDone", { day: s.day });
    }
  }

  function doneScreen(title, text, stats, buttons) {
    return `
      <div class="done-wrap">
        <div class="done-icon">${icon("check")}</div>
        <span class="eyebrow">Ma schā' Allāh</span>
        <h1 class="h1" style="text-align:center">${title}</h1>
        <p class="lead">${text}</p>
        ${stats ? `<div class="stats">${stats.map(([b, s]) => `<div class="stat"><b>${b}</b><span>${s}</span></div>`).join("")}</div>` : ""}
      </div>
      <footer class="footer">${buttons}</footer>`;
  }

  function viewChunkDone() {
    const day = ctx.days[screen.day];
    const chunk = day.chunks[screen.chunk];
    const next = day.chunks[screen.chunk + 1];
    return doneScreen(
      "Abschnitt geschafft!",
      `${versesLabel(chunk.from, chunk.to)} sitzen. Weiter mit Abschnitt ${screen.chunk + 2} von ${day.chunks.length}: ${versesLabel(next.from, next.to)}.`,
      [
        [`${screen.chunk + 1}/${day.chunks.length}`, "Abschnitte heute"],
        [pagesLabel(chunk.size, false), chunk.size > 1 ? "Seiten gelernt" : "Seite gelernt"],
      ],
      `<button class="btn" data-action="learn">Weiter zu Abschnitt ${screen.chunk + 2} ${icon("arrow")}</button>
       <button class="link-btn muted" data-action="home">Später weitermachen</button>`
    );
  }

  function viewDayDone() {
    const day = ctx.days[screen.day];
    const next = ctx.days[screen.day + 1];
    return doneScreen(
      "Tagespensum geschafft!",
      `Tag ${screen.day + 1} ist gelernt: ${versesLabel(day.from, day.to)}. Morgen geht es weiter mit Tag ${screen.day + 2} (${versesLabel(next.from, next.to)}).`,
      [
        [String(day.to - day.from + 1), day.to === day.from ? "Vers" : "Verse"],
        [pagesLabel(day.size, false), day.size > 1 ? "Seiten" : "Seite"],
        [`${screen.day + 1}/${ctx.days.length}`, "Tage"],
      ],
      `<button class="btn" data-action="home">Zur Übersicht</button>`
    );
  }

  function viewSurahDone() {
    const m = ctx.surah.meta;
    return doneScreen(
      `Sure ${esc(m.tr)} gelernt!`,
      `Du hast alle ${m.ayahs} Verse in ${ctx.days.length} ${ctx.days.length === 1 ? "Tag" : "Tagen"} gelernt. Möge Allah es dir leicht machen, sie zu bewahren.`,
      [
        [String(m.ayahs), "Verse"],
        [pagesLabel(m.size, false), m.size > 1 ? "Seiten" : "Seite"],
      ],
      `<button class="btn" data-action="new-plan">Neue Sure wählen</button>
       <button class="link-btn muted" data-action="home">Zur Übersicht</button>`
    );
  }

  /* ------------------------------------------------------------ Sheets/Dialog */

  let sheetPreview = null;

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
      if (screen.name !== "learn") player.stop();
    }
  }

  function openSurahSheet() {
    const rows = (q) => {
      const nq = normalize(q || "");
      return Quran.surahs
        .filter((m) => !nq || String(m.n) === nq || normalize(m.tr).includes(nq) || normalize(m.de).includes(nq) || m.ar.includes(q))
        .map(
          (m) => `<button class="sura-row" data-action="select-surah" data-value="${m.n}" aria-selected="${m.n === draft.surah}">
            <span class="num-badge">${m.n}</span>
            <span class="picker-main"><strong style="font-size:15px">${esc(m.tr)}</strong><span>${esc(m.de)} · ${m.ayahs} Verse · ${pagesLabel(m.size)}</span></span>
            <span class="picker-ar">${esc(m.ar)}</span>
          </button>`
        )
        .join("");
    };
    openSheet(
      `<div class="sheet" role="dialog" aria-label="Sure wählen">
        <div class="sheet-head">
          <div class="sheet-head-row"><h3>Sure wählen</h3><button class="icon-btn" data-action="close-sheet" aria-label="Schließen">${icon("close")}</button></div>
          <input class="search" type="search" placeholder="Name oder Nummer suchen" autocomplete="off" />
        </div>
        <div class="sheet-list">${rows("")}</div>
      </div>`,
      (el) => {
        const input = el.querySelector(".search");
        const list = el.querySelector(".sheet-list");
        input.addEventListener("input", () => (list.innerHTML = rows(input.value.trim()) || `<p class="hint">Keine Sure gefunden.</p>`));
        const sel = list.querySelector('[aria-selected="true"]');
        if (sel) sel.scrollIntoView({ block: "center" });
      }
    );
  }

  function openReciterSheet() {
    openSheet(
      `<div class="sheet" role="dialog" aria-label="Rezitator wählen">
        <div class="sheet-head"><div class="sheet-head-row"><h3>Rezitator</h3><button class="icon-btn" data-action="close-sheet" aria-label="Schließen">${icon("close")}</button></div></div>
        <div class="sheet-list"><div class="reciters">${recitersHtml(state.plan.reciter, null)}</div></div>
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

  function handleAction(action, value, target, event) {
    switch (action) {
      case "home":
        checkPauseExpired();
        return go(state.plan ? "home" : "setup");
      case "learn":
        return startLearning();
      case "learned":
        return learned();
      case "undo":
        return undo();
      case "play":
        ensureAudioCtx();
        return player.toggle();
      case "restart":
        return player.restart();
      case "seek": {
        const q = player.queue.length;
        if (!q) return;
        player.playIndex(Math.min(q - 1, Math.floor((+value / BAR_HEIGHTS.length) * q)));
        return;
      }
      case "new-plan":
        return openSetup();
      case "pick-surah":
        return openSurahSheet();
      case "select-surah":
        closeSheet();
        return setDraft({ surah: +value });
      case "daily":
        return setDraft({ daily: +value });
      case "chunk":
        if (target.disabled) return;
        return setDraft({ chunk: +value });
      case "reciter":
        if (screen.name === "setup") {
          draft.reciter = value;
          document.querySelectorAll(".reciters .reciter").forEach((r) => r.setAttribute("aria-checked", String(r.dataset.value === value)));
        } else if (state.plan) {
          state.plan.reciter = value;
          state.reciter = value;
          save();
          closeSheet();
          render();
        }
        return;
      case "preview": {
        event.stopPropagation();
        const isSetup = screen.name === "setup";
        const current = isSetup ? draft.preview : sheetPreview;
        const surahN = isSetup ? draft.surah : state.plan.surah;
        if (current === value && (player.status === "playing" || player.status === "loading")) {
          player.stop();
        } else {
          if (isSetup) draft.preview = value;
          else sheetPreview = value;
          player.preview(value, surahN, 1);
        }
        return;
      }
      case "start-plan":
        return startPlan(false);
      case "change-reciter":
        return openReciterSheet();
      case "close-sheet":
        return closeSheet();
      case "toggle-days":
        showAllDays = !showAllDays;
        return render();
      default:
    }
  }

  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (el) {
      if (el.tagName === "BUTTON" && el.disabled) return;
      handleAction(el.dataset.action, el.dataset.value, el, e);
      return;
    }
    // Tippen auf einen Vers spielt ab diesem Vers
    const tok = e.target.closest("#mushaf .t[data-ayah]");
    if (tok) {
      ensureAudioCtx();
      player.playFromAyah(+tok.dataset.ayah);
    }
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
      const el = document.getElementById("mushaf");
      if (el && ctx) Mushaf.fit(el, ctx.surah);
    }, 120);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && screen.name === "timer") requestWakeLock();
  });

  /* ------------------------------------------------------------------- Start */

  async function init() {
    render();
    try {
      if (document.fonts && document.fonts.load) await Promise.race([document.fonts.load('20px "UthmanicHafs"'), new Promise((r) => setTimeout(r, 4000))]);
      await loadPlanContext();
    } catch (e) {
      screen = { name: "loading", message: "Die Daten konnten nicht geladen werden. Bitte lade die Seite neu." };
      render();
      return;
    }
    if (!state.plan) return openSetup();
    if (state.session) {
      // Plan-Änderungen der Daten abfangen
      const d = ctx.days[state.session.day];
      if (!d || !d.chunks[state.session.chunk] || chunkInfo(state.session.day, state.session.chunk).words.length !== state.session.levels.length) {
        state.session = null;
        save();
      }
    }
    checkPauseExpired();
    if (state.session && state.session.phase === "timer") return go("timer");
    go("home");
  }

  init();
})();
