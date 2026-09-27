/*
 * Darstellung im Layout des Madani-Mushaf (blaue Ausgabe).
 *
 * Für einen Lernabschnitt werden die Mushaf-Zeilen gezeigt, die er berührt –
 * jeweils mit allen Wörtern der Zeile, damit Blocksatz und Wortpositionen
 * exakt der gedruckten Seite entsprechen. Wörter außerhalb des Abschnitts
 * sind unsichtbar (sie halten nur ihren Platz). Ein Abschnitt kann mehrere
 * Suren umfassen.
 */
(function () {
  "use strict";

  const Q = window.Quran;
  const { TOKEN_AYAH_END, TOKEN_SYMBOL } = Q;
  const { escapeHtml, wordHtml } = window.Fade;

  const FONT = "UthmanicHafs";
  const MAX_FONT = 30;
  const MIN_FONT = 8;
  const GAP_EM = 0.18;
  const widthCache = new Map();
  // Eine volle Zeile (Seite 3, Zeile 1) als Maßstab für die kurzen Zeilen der Eröffnungsseiten
  const REFERENCE_LINE = "إِنَّ ٱلَّذِينَ كَفَرُواْ سَوَآءٌ عَلَيۡهِمۡ ءَأَنذَرۡتَهُمۡ أَمۡ لَمۡ تُنذِرۡهُمۡ".split(" ");

  /** Seiten 1 und 2 haben im Mushaf kürzere, zentrierte Zeilen. */
  const isOpeningPage = (page) => page <= 2;

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
      else if (!inUnit) cls.push("out");
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

  function lineHtml(line, ctx) {
    if (line.kind === "h") {
      return `<div class="ml ml-head"><div class="sura-frame"><span>سُورَةُ ${escapeHtml(Q.meta(line.surah).ar)}</span></div></div>`;
    }
    if (line.kind === "b") {
      return `<div class="ml ml-basmala"><span>${escapeHtml(Q.basmala)}</span></div>`;
    }
    const cls = "ml" + (isOpeningPage(line.page) ? " ml-center" : "");
    return `<div class="${cls}">${line.tokens.map((t) => tokenHtml(t, ctx)).join("")}</div>`;
  }

  function figureHtml(page, lines, ctx) {
    const all = Q.linesOfPage(page);
    const top = all.find((l) => l.kind === "t") || all[0];
    return `
      <figure class="mushaf-page" data-page="${page}">
        <div class="mp-paper">
          <div class="mp-top">
            <span class="mp-sura">سُورَةُ ${escapeHtml(Q.meta(top.surah).ar)}</span>
            <span class="mp-juz">Juz ${Q.juzOfPage(page)}</span>
          </div>
          <div class="mp-lines">${lines.map((l) => lineHtml(l, ctx)).join("")}</div>
          <div class="mp-bottom"><span class="mp-num">${page}</span></div>
        </div>
      </figure>`;
  }

  /**
   * Lernabschnitt.
   * @param {object} unit   Einheit (Quran.pageParts)
   * @param {object} opts   { levels, shapes, wordIndex, activeKey, tail }
   *                        levels/shapes je Wort, wordIndex: Token → Index,
   *                        tail: Anschluss-Tokens des nächsten Verses (normal gezeigt)
   */
  function unitHtml(unit, opts) {
    const ctx = Object.assign({ mode: "unit", keys: unit.keys, levels: [], shapes: [], wordIndex: new Map() }, opts, { tail: new Set(opts.tail || []) });
    const pages = new Set();
    for (const v of unit.verses) for (const t of v.tokens) pages.add(t.line.page);
    for (const t of ctx.tail) pages.add(t.line.page);
    return Array.from(pages)
      .sort((a, b) => a - b)
      .map((p) => {
        const lines = Q.linesOfPage(p).filter((l) => (l.kind === "t" ? l.tokens.some((t) => ctx.keys.has(t.key) || ctx.tail.has(t)) : ctx.keys.has(`${l.surah}:1`)));
        return figureHtml(p, lines, ctx);
      })
      .join("");
  }

  /** Ganze Seite mit den Seitenvierteln als data-q (für die Auswahl). */
  function pageHtml(page, parts) {
    const partOf = new Map();
    parts.forEach((u, i) => u.verses.forEach((v) => partOf.set(v.key, i)));
    return figureHtml(page, Q.linesOfPage(page), { mode: "page", partOf });
  }

  /** Natürliche Breite der längsten Zeile einer Seite bei 100px Schriftgröße. */
  function naturalWidth(page) {
    if (widthCache.has(page)) return widthCache.get(page);
    const probe = document.createElement("div");
    probe.style.cssText = `position:absolute;visibility:hidden;left:-99999px;top:0;font-family:${FONT};font-size:100px;white-space:nowrap;direction:rtl;`;
    const lines = isOpeningPage(page)
      ? [REFERENCE_LINE]
      : Q.linesOfPage(page)
          .filter((l) => l.kind === "t")
          .map((l) => l.tokens.map((t) => t.text));
    probe.innerHTML = lines.map((words) => `<div style="display:inline-flex;column-gap:${GAP_EM}em">${words.map((w) => `<span>${escapeHtml(w)}</span>`).join("")}</div><br>`).join("");
    document.body.appendChild(probe);
    let max = 0;
    for (const el of probe.children) if (el.tagName === "DIV") max = Math.max(max, el.getBoundingClientRect().width);
    probe.remove();
    if (max > 0) widthCache.set(page, max);
    return max;
  }

  /** Schriftgröße so wählen, dass die längste Zeile der Seite genau passt. */
  function fit(container) {
    const figures = container.querySelectorAll(".mushaf-page");
    if (!figures.length) return;
    const avail = figures[0].querySelector(".mp-lines").clientWidth;
    if (!avail) return;
    let size = MAX_FONT;
    for (const f of figures) {
      const w = naturalWidth(+f.dataset.page);
      if (w > 0) size = Math.min(size, (avail / w) * 100 * 0.985);
    }
    size = Math.max(MIN_FONT, Math.floor(size * 10) / 10);
    container.style.setProperty("--mushaf-size", size + "px");
  }

  window.Mushaf = { unitHtml, pageHtml, fit };
})();
