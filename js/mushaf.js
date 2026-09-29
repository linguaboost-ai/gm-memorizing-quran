/*
 * Darstellung im Layout des blauen Madani-Mushaf (Gestaltung aus
 * linguaboost-ai/gm-quran-progress, siehe js/ornaments.js).
 *
 * Es wird immer die ganze Seite gezeigt: Rahmen, Kopfzeile, Surenbanner und
 * Seitenzahl als SVG (Seite 1000 × 1414 Einheiten), darüber die 15 Zeilen als
 * Text (für das Ausgrauen einzelner Buchstaben). Die Zeilen stehen im
 * Blocksatz wie im gedruckten Mushaf: Die Wörter kommen mit Kaschida (gedehnten
 * Buchstaben) aus den Daten (tools/kashida.mjs), die Schrift hat die feste
 * Größe von 40 Einheiten, den Rest übernehmen die Wortabstände. Beim Lernen ist der Abschnitt
 * schwarz, der Anschluss blau und alle übrigen Wörter der Seite sind fast
 * unsichtbar (Deckkraft 0,05). Surenbanner, Kopfzeile und Randmarken bleiben.
 */
(function () {
  "use strict";

  const Q = window.Quran;
  const O = window.Ornaments;
  const { TOKEN_AYAH_END, TOKEN_SYMBOL } = Q;
  const { escapeHtml, wordHtml } = window.Fade;
  const T = O.TEXT;

  const MIN_FONT = 6;
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

  /** Lage einer Zeile in Seiteneinheiten (info.w: Satzbreite aus dem Blocksatz). */
  function rowBox(page, lineNo, info) {
    if (!isOpeningPage(page)) return { x: T.left, w: T.right - T.left, y: T.top + (lineNo - 1) * T.pitch };
    const y = O.SPECIAL.cy - (SHORT_PAGE_LINES * T.pitch) / 2 + (lineNo - 1) * T.pitch;
    const w = info && info.w ? info.w : Math.min(T.right - T.left, O.ovalWidth(y + T.pitch / 2));
    return { x: O.PAGE_W / 2 - w / 2, w, y };
  }

  const rowStyle = (b) => `left:${pct(b.x, O.PAGE_W)};width:${pct(b.w, O.PAGE_W)};top:${pct(b.y, O.PAGE_H)};height:${pct(T.pitch, O.PAGE_H)}`;

  function tokenHtml(token, ctx) {
    const cls = ["t"];
    let attrs = "";
    let inner = escapeHtml(token.display || token.text);
    if (ctx.mode === "page") {
      const q = ctx.partOf.get(token.key);
      if (q === undefined) cls.push("prev");
      else attrs = ` data-q="${q}"`;
    } else {
      const inUnit = ctx.keys.has(token.key);
      if (ctx.tail.has(token)) cls.push("next");
      else if (!inUnit) cls.push("rest");
      if (inUnit) {
        attrs = ` data-key="${token.key}"`;
        if (token.key === ctx.activeKey) cls.push("active");
        if (token.type === Q.TOKEN_WORD) {
          const i = ctx.wordIndex.get(token);
          if (i !== undefined) inner = wordHtml(ctx.shapes[i], ctx.levels[i] || 0);
        }
      }
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
      const box = rowBox(page, l.line, l.info);
      if (l.kind === "h") {
        banners.push(Object.assign({ surahAr: Q.meta(l.surah).ar, y0: box.y }, isOpeningPage(page) ? { x: box.x, w: box.w } : {}));
        continue;
      }
      if (l.kind === "b") {
        let cls = "t b";
        if (ctx.mode === "page") cls += ctx.partOf.has(`${l.surah}:1`) ? "" : " prev";
        else if (!ctx.keys.has(`${l.surah}:1`)) cls += " rest";
        rows.push(`<div class="ml ml-basmala ml-center" style="${rowStyle(box)}"><span class="${cls}">${escapeHtml(Q.basmala)}</span></div>`);
        continue;
      }
      // mittig: kurze Schlusszeilen einer Sure (aus dem Blocksatz)
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
   * @param {object} unit   Einheit (Quran.pageParts)
   * @param {object} opts   { levels, shapes, wordIndex, activeKey, tail }
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

  /** Ganze Seite mit den Seitenvierteln als data-q (für die Auswahl). */
  function pageHtml(page, parts) {
    const partOf = new Map();
    parts.forEach((u, i) => u.verses.forEach((v) => partOf.set(v.key, i)));
    return figureHtml(page, { mode: "page", partOf });
  }

  /**
   * Schriftgröße wie in der Vorlage: 40 Einheiten bei 1000 Einheiten
   * Seitenbreite. Formt ein Browser ein Wort etwas breiter als HarfBuzz, wird
   * die Zeile minimal gestaucht, damit sie nicht über den Rand läuft.
   */
  function fit(container) {
    const figures = container.querySelectorAll(".mushaf-page");
    if (!figures.length) return;
    const W = figures[0].clientWidth;
    if (!W) return;
    const size = Math.max(MIN_FONT, Math.floor(((T.fontSize * W) / O.PAGE_W) * 100) / 100);
    container.style.setProperty("--mushaf-size", size + "px");
    for (const fig of figures) {
      fig.querySelectorAll(".ml").forEach((row) => {
        row.style.transform = "";
        const need = row.scrollWidth;
        const have = row.clientWidth;
        if (need > have + 0.5) row.style.transform = `scaleX(${(have / need).toFixed(4)})`;
      });
    }
  }

  window.Mushaf = { unitHtml, pageHtml, fit };
})();
