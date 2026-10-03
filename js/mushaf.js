/*
 * Darstellung im Layout des blauen Madani-Mushaf (Gestaltung aus
 * linguaboost-ai/gm-quran-progress, siehe js/ornaments.js).
 *
 * Es wird immer die ganze Seite gezeigt: Rahmen, Kopfzeile, Surenbanner und
 * Seitenzahl als SVG (Seite 1000 × 1414 Einheiten), darüber die 15 Zeilen als
 * Text (für das Ausgrauen einzelner Buchstaben). Seiten, Zeilen und
 * Schreibweise folgen der Madina-Ausgabe 1405 (tools/madina1405.mjs), gesetzt
 * in KFGQPC HAFS v1.001 wie bei quran-madina-html: Wörter mit einfachem
 * Leerzeichen, jede Zeile auf die Satzbreite gestreckt bzw. gestaucht. Beim
 * Lernen ist der Abschnitt schwarz, der Anschluss blau und alle übrigen Wörter
 * der Seite sind fast unsichtbar (Deckkraft 0,05). Surenbanner, Kopfzeile und
 * Randmarken bleiben.
 */
(function () {
  "use strict";

  const Q = window.Quran;
  const O = window.Ornaments;
  const { TOKEN_AYAH_END, TOKEN_SYMBOL } = Q;
  const { escapeHtml, wordHtml } = window.Fade;
  const T = O.TEXT;

  const MIN_FONT = 6;
  /** Schriftgröße wie in der Vorlage: 24 px auf 410 px Satzbreite. */
  const FONT = (24 * (T.right - T.left)) / 410;
  const SHORT_PAGE_LINES = 8;

  /** Seiten 1 und 2 haben im Mushaf kürzere, zentrierte Zeilen im Oval. */
  const isOpeningPage = (page) => page <= 2;

  /** Hizb-Viertel je Seite (data/quarters.js). */
  const quartersByPage = new Map();
  for (const [q, page, line] of window.QURAN_QUARTERS || []) {
    if (!quartersByPage.has(page)) quartersByPage.set(page, []);
    quartersByPage.get(page).push({ q, line });
  }

  const pct = (v, of) => `${((v / of) * 100).toFixed(3)}%`;

  /** Lage einer Zeile in Seiteneinheiten. */
  function rowBox(page, lineNo) {
    if (!isOpeningPage(page)) return { x: T.left, w: T.right - T.left, y: T.top + (lineNo - 1) * T.pitch };
    const y = O.SPECIAL.cy - (SHORT_PAGE_LINES * T.pitch) / 2 + (lineNo - 1) * T.pitch;
    const w = Math.min(T.right - T.left, O.ovalWidth(y + T.pitch / 2));
    return { x: O.PAGE_W / 2 - w / 2, w, y };
  }

  const rowStyle = (b) => `left:${pct(b.x, O.PAGE_W)};width:${pct(b.w, O.PAGE_W)};top:${pct(b.y, O.PAGE_H)};height:${pct(T.pitch, O.PAGE_H)}`;

  /** Zustände beim Lückentext: verborgen, Lücke (aktuell/später), gerade eingesetzt. */
  const REVEAL_CLASS = { hide: "hid", gap: "gap now", blank: "gap", fill: "fill" };

  function tokenHtml(token, ctx) {
    const cls = ["t"];
    let attrs = "";
    let inner = escapeHtml(token.display || token.text);
    if (ctx.mode === "page") {
      const q = ctx.partOf.get(token.key);
      if (q === undefined) cls.push("off");
      else attrs = ` data-q="${q}"`;
    } else {
      const inUnit = ctx.keys.has(token.key);
      const isTail = ctx.tail.has(token);
      if (isTail) cls.push("next");
      else if (!inUnit) cls.push("rest");
      if (inUnit) {
        attrs = ` data-key="${token.key}"`;
        if (token.key === ctx.activeKey) cls.push("active");
      }
      // Abschnitt und Anschluss werden in Fünfteln ausgegraut
      if ((inUnit || isTail) && token.type === Q.TOKEN_WORD) {
        const i = ctx.wordIndex.get(token);
        if (i !== undefined) inner = wordHtml(ctx.shapes[i], ctx.levels[i] || 0);
      }
      const r = ctx.reveal && ctx.reveal.get(token);
      if (r) cls.push(REVEAL_CLASS[r]);
    }
    if (token.type === TOKEN_AYAH_END) cls.push("ayah-end");
    else if (token.type === TOKEN_SYMBOL) cls.push("sym");
    else cls.push("w");
    return `<span class="${cls.join(" ")}"${attrs}>${inner}</span>`;
  }

  function figureHtml(page, ctx) {
    const lines = Q.linesOfPage(page);
    const top = lines.find((l) => l.kind === "t") || lines[0];
    const banners = [];
    const rows = [];
    for (const l of lines) {
      const box = rowBox(page, l.line);
      if (l.kind === "h") {
        banners.push(Object.assign({ surahAr: Q.meta(l.surah).ar, y0: box.y }, isOpeningPage(page) ? { x: box.x, w: box.w } : {}));
        continue;
      }
      if (l.kind === "b") {
        let cls = "t b";
        let attrs = "";
        if (ctx.mode === "page") {
          const q = ctx.partOf.get(`${l.surah}:1`);
          if (q === undefined) cls += " off";
          else attrs = ` data-q="${q}"`;
        } else if (!ctx.keys.has(`${l.surah}:1`)) cls += " rest";
        rows.push(`<div class="ml ml-basmala ml-center" style="${rowStyle(box)}"><span class="${cls}"${attrs}>${escapeHtml(Q.basmalaMushaf)}</span></div>`);
        continue;
      }
      // mittig: kurze Schlusszeilen einer Sure, Seiten 1–2
      const center = l.info && l.info.c;
      rows.push(`<div class="ml${center ? " ml-center" : ""}" data-line="${l.line}" style="${rowStyle(box)}">${l.tokens.map((t) => tokenHtml(t, ctx)).join("")}</div>`);
    }
    const quarters = (quartersByPage.get(page) || []).map(({ q, line }) => ({ q, y: rowBox(page, line + 1).y + T.pitch / 2 }));
    const svg = O.pageSvg({ page, juz: Q.juzOfPage(page), surahAr: Q.meta(top.surah).ar, quarters, banners });
    return `
      <figure class="mushaf-page" data-page="${page}">
        ${svg}
        <div class="mp-rows">${rows.join("")}</div>
      </figure>`;
  }

  /**
   * Lernabschnitt: die ganzen Seiten, auf denen er (und sein Anschluss) steht.
   * @param {object} unit   Einheit (Quran.pageUnits)
   * @param {object} opts   { levels, shapes, wordIndex, activeKey, tail,
   *                          reveal: Map Token → "hide" | "gap" | "blank" | "fill" }
   */
  function unitHtml(unit, opts) {
    const ctx = Object.assign({ mode: "unit", keys: unit.keys, levels: [], shapes: [], wordIndex: new Map() }, opts, { tail: new Set(opts.tail || []) });
    const pages = new Set();
    for (const v of unit.verses) for (const t of v.tokens) pages.add(t.line.page);
    for (const t of ctx.tail) pages.add(t.line.page);
    return Array.from(pages)
      .sort((a, b) => a - b)
      .map((p) => figureHtml(p, ctx))
      .join("");
  }

  /** Ganze Seite mit den Teilen als data-q (für die Auswahl); übrige Wörter blass. */
  function pageHtml(page, parts) {
    const partOf = new Map();
    parts.forEach((u, i) => u.verses.forEach((v) => partOf.set(v.key, i)));
    return figureHtml(page, { mode: "page", partOf });
  }

  /** Breite des Zeileninhalts (ohne Streckung). */
  const range = document.createRange();
  function naturalWidth(row) {
    range.selectNodeContents(row);
    return range.getBoundingClientRect().width;
  }

  /** Stärkste Stauchung auf den Seiten 1–2, darüber wird die Schrift kleiner. */
  const OPENING_MIN_SCALE = 0.85;

  /** Streckfaktor je Zeile (1 = passt schon). */
  function scaleOf(row) {
    const need = naturalWidth(row);
    const have = row.clientWidth;
    if (!need || !have) return 1;
    const center = row.classList.contains("ml-center");
    return (center ? need > have + 0.5 : Math.abs(need - have) > 0.5) ? have / need : 1;
  }

  /**
   * Schrift in fester Größe (FONT Einheiten bei 1000 Einheiten Seitenbreite),
   * dann jede Zeile waagerecht auf die Satzbreite gebracht wie in der
   * Madina-Ausgabe 1405 (dort Faktor 0,7–1,06). Mittige Zeilen werden nur
   * gestaucht, falls sie zu breit sind. Im Oval der Seiten 1–2 sind die
   * Zeilen kürzer, dort wird notfalls die ganze Schrift etwas kleiner.
   */
  function fit(container) {
    const figures = Array.from(container.querySelectorAll(".mushaf-page"));
    if (!figures.length) return;
    const W = figures[0].clientWidth;
    if (!W) return;
    const size = Math.max(MIN_FONT, Math.floor(((FONT * W) / O.PAGE_W) * 100) / 100);
    container.style.setProperty("--mushaf-size", size + "px");
    // erst alle messen, dann alle setzen (ein Layout statt eines je Zeile)
    const pages = figures.map((fig) => {
      const layer = fig.querySelector(".mp-rows");
      if (layer) layer.style.fontSize = "";
      const rows = Array.from(fig.querySelectorAll(".ml"));
      for (const row of rows) row.style.transform = "";
      return { fig, layer, rows };
    });
    for (const pg of pages) pg.scales = pg.rows.map(scaleOf);
    for (const pg of pages) {
      if (!pg.layer || !isOpeningPage(Number(pg.fig.dataset.page))) continue;
      // die Breite wächst nicht ganz proportional zur Schriftgröße: bis zu drei Schritte
      let font = size;
      for (let k = 0; k < 3; k++) {
        const min = Math.min(1, ...pg.scales);
        if (min >= OPENING_MIN_SCALE - 0.005) break;
        font = (font * min) / OPENING_MIN_SCALE;
        pg.layer.style.fontSize = font.toFixed(2) + "px";
        pg.scales = pg.rows.map(scaleOf);
      }
    }
    for (const pg of pages) pg.rows.forEach((row, i) => (row.style.transform = pg.scales[i] === 1 ? "" : `scaleX(${pg.scales[i].toFixed(4)})`));
  }

  /**
   * Vorbereitung: nur die Zeilen des Abschnitts, jede genau wie auf der
   * Mushaf-Seite gesetzt (gleiche Schrift, Abstände, Position; Wörter anderer
   * Abschnitte unsichtbar), darunter die deutsche Übersetzung dieser Zeile.
   * @param {object} unit   Einheit
   * @param {Function} deOf (line) → Übersetzung der Abschnittswörter dieser Zeile
   */
  function linesHtml(unit, deOf) {
    const pages = [...new Set(unit.verses.map((v) => v.page))];
    const out = [];
    for (const page of pages) {
      for (const l of Q.linesOfPage(page)) {
        const box = rowBox(page, l.line);
        const width = `width:${((box.w / (T.right - T.left)) * 100).toFixed(2)}%`;
        let row = "";
        if (l.kind === "b") {
          if (!unit.keys.has(`${l.surah}:1`)) continue;
          row = `<div class="ml ml-basmala ml-center" style="${width}"><span class="t b">${escapeHtml(Q.basmalaMushaf)}</span></div>`;
        } else if (l.kind === "t" && l.tokens.some((t) => unit.keys.has(t.key))) {
          const tokens = l.tokens.map((t) => {
            const kind = t.type === TOKEN_AYAH_END ? "ayah-end" : t.type === TOKEN_SYMBOL ? "sym" : "w";
            return `<span class="t ${kind}${unit.keys.has(t.key) ? "" : " void"}">${escapeHtml(t.display || t.text)}</span>`;
          });
          row = `<div class="ml${l.info && l.info.c ? " ml-center" : ""}" style="${width}">${tokens.join("")}</div>`;
        } else continue;
        const de = deOf(l);
        out.push(`<div class="pl-pair"><div class="pl-ar">${row}</div>${de ? `<p class="pl-de">${escapeHtml(de)}</p>` : ""}</div>`);
      }
    }
    return `<div class="prep-lines">${out.join("")}</div>`;
  }

  /** Schrift und Streckung der Zeilen in der Vorbereitung (wie auf der Seite). */
  function fitLines(container) {
    const first = container.querySelector(".pl-ar");
    if (!first || !first.clientWidth) return;
    const size = Math.max(MIN_FONT, Math.floor(((FONT * first.clientWidth) / (T.right - T.left)) * 100) / 100);
    container.style.setProperty("--mushaf-size", size + "px");
    const rows = Array.from(container.querySelectorAll(".pl-ar .ml"));
    for (const row of rows) row.style.transform = "";
    const scales = rows.map(scaleOf);
    rows.forEach((row, i) => (row.style.transform = scales[i] === 1 ? "" : `scaleX(${scales[i].toFixed(4)})`));
  }

  window.Mushaf = { unitHtml, pageHtml, fit, linesHtml, fitLines };
})();
