/*
 * Darstellung im Layout des blauen Madani-Mushaf (Gestaltung aus
 * linguaboost-ai/gm-quran-progress, siehe js/ornaments.js).
 *
 * Es wird immer die ganze Seite gezeigt: Rahmen, Kopfzeile, Surenbanner und
 * Seitenzahl als SVG (Seite 1000 × 1414 Einheiten), darüber die 15 Zeilen als
 * Text (für das Ausgrauen einzelner Buchstaben). Beim Lernen ist der Abschnitt
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

  const FONT = "UthmanicHafs";
  const MIN_FONT = 6;
  const widthCache = new Map();
  // Eine volle Zeile (Seite 3, Zeile 1) als Maßstab für die kurzen Zeilen der Eröffnungsseiten
  const REFERENCE_LINE = "إِنَّ ٱلَّذِينَ كَفَرُواْ سَوَآءٌ عَلَيۡهِمۡ ءَأَنذَرۡتَهُمۡ أَمۡ لَمۡ تُنذِرۡهُمۡ".split(" ");
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

  function tokenHtml(token, ctx) {
    const cls = ["t"];
    let attrs = "";
    let inner = escapeHtml(token.text);
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
      const box = rowBox(page, l.line);
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
      // Letzte Zeile einer Sure: darf mittig stehen, wenn sie kurz ist
      const ends = l.tokens.some((t) => t.type === TOKEN_AYAH_END && t.ayah === Q.meta(t.surah).ayahs);
      rows.push(`<div class="ml${isOpeningPage(page) ? " ml-center" : ""}" data-line="${l.line}"${ends ? " data-end" : ""} style="${rowStyle(box)}">${l.tokens.map((t) => tokenHtml(t, ctx)).join("")}</div>`);
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

  /** Natürliche Breiten (bei 100px) aller Textzeilen einer Seite und die längste. */
  function naturalWidths(page) {
    if (widthCache.has(page)) return widthCache.get(page);
    const probe = document.createElement("div");
    probe.style.cssText = `position:absolute;visibility:hidden;left:-99999px;top:0;font-family:${FONT};font-size:100px;white-space:nowrap;direction:rtl;`;
    const textLines = Q.linesOfPage(page).filter((l) => l.kind === "t");
    const rows = textLines.map((l) => l.tokens.map((t) => t.text));
    if (isOpeningPage(page)) rows.push(REFERENCE_LINE);
    probe.innerHTML = rows.map((words) => `<div style="display:inline-flex;column-gap:0.18em">${words.map((w) => `<span>${escapeHtml(w)}</span>`).join("")}</div><br>`).join("");
    document.body.appendChild(probe);
    const widths = Array.from(probe.querySelectorAll("div")).map((el) => el.getBoundingClientRect().width);
    probe.remove();
    const byLine = new Map(textLines.map((l, i) => [l.line, widths[i]]));
    const max = isOpeningPage(page) ? widths[widths.length - 1] : Math.max(0, ...widths);
    const res = { max, byLine };
    if (max > 0) widthCache.set(page, res);
    return res;
  }

  /**
   * Schriftgröße so wählen, dass die längste Zeile der Seite genau passt
   * (höchstens 40 Einheiten wie in der Vorlage). Kurze Schlusszeilen einer
   * Sure stehen mittig, alle anderen Zeilen im Blocksatz.
   */
  function fit(container) {
    const figures = container.querySelectorAll(".mushaf-page");
    if (!figures.length) return;
    let size = Infinity;
    const info = [];
    for (const fig of figures) {
      const W = fig.clientWidth;
      if (!W) continue;
      const u = W / O.PAGE_W;
      const avail = (T.right - T.left) * u;
      const nat = naturalWidths(+fig.dataset.page);
      size = Math.min(size, T.fontSize * u);
      if (nat.max > 0) size = Math.min(size, (avail / nat.max) * 100 * 0.985);
      info.push([fig, nat, avail]);
    }
    if (!isFinite(size)) return;
    size = Math.max(MIN_FONT, Math.floor(size * 10) / 10);
    container.style.setProperty("--mushaf-size", size + "px");
    for (const [fig, nat, avail] of info) {
      if (isOpeningPage(+fig.dataset.page)) continue;
      fig.querySelectorAll(".ml[data-end]").forEach((row) => {
        const w = (nat.byLine.get(+row.dataset.line) || 0) * (size / 100);
        row.classList.toggle("ml-center", w > 0 && w < avail * 0.8);
      });
    }
  }

  window.Mushaf = { unitHtml, pageHtml, fit };
})();
