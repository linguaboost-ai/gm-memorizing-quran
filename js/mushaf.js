/*
 * Darstellung eines Abschnitts im Layout des Medina-Mushaf.
 *
 * Es werden die Mushaf-Zeilen gezeigt, die der Abschnitt berührt – jeweils mit
 * allen Wörtern der Zeile, damit Blocksatz und Wortpositionen exakt der
 * gedruckten Seite entsprechen. Wörter außerhalb des Abschnitts sind
 * unsichtbar (sie halten nur ihren Platz).
 */
(function () {
  "use strict";

  const { TOKEN_WORD, TOKEN_AYAH_END, TOKEN_SYMBOL } = window.Quran;
  const { escapeHtml, wordHtml } = window.Fade;

  const FONT = "UthmanicHafs";
  const MAX_FONT = 30;
  const MIN_FONT = 12;
  const GAP_EM = 0.18;
  const widthCache = new Map();
  // Eine volle Zeile (Seite 3, Zeile 1) als Maßstab für die kurzen Zeilen der Eröffnungsseiten
  const REFERENCE_LINE = "إِنَّ ٱلَّذِينَ كَفَرُواْ سَوَآءٌ عَلَيۡهِمۡ ءَأَنذَرۡتَهُمۡ أَمۡ لَمۡ تُنذِرۡهُمۡ".split(" ");

  const toArabicDigits = (n) => String(n).replace(/\d/g, (c) => "٠١٢٣٤٥٦٧٨٩"[c]);

  /** Seiten 1 und 2 haben im Mushaf kürzere, zentrierte Zeilen. */
  const isOpeningPage = (page) => page <= 2;

  function tokenHtml(token, ctx) {
    const inRange = token.ayah >= ctx.from && token.ayah <= ctx.to;
    const cls = ["t"];
    if (ctx.tail.has(token)) cls.push("next");
    else if (!inRange) cls.push("out");
    if (token.ayah === ctx.activeAyah && inRange) cls.push("active");
    const data = inRange ? ` data-ayah="${token.ayah}"` : "";
    if (token.type === TOKEN_AYAH_END) {
      cls.push("ayah-end");
      return `<span class="${cls.join(" ")}"${data}>${escapeHtml(token.text)}</span>`;
    }
    if (token.type === TOKEN_SYMBOL) {
      cls.push("sym");
      return `<span class="${cls.join(" ")}"${data}>${escapeHtml(token.text)}</span>`;
    }
    const level = inRange ? ctx.levels[token.id - ctx.firstId] || 0 : 0;
    const shape = ctx.shapes[token.id - ctx.firstId];
    cls.push("w");
    const inner = inRange && shape ? wordHtml(shape, level) : escapeHtml(token.text);
    return `<span class="${cls.join(" ")}"${data}>${inner}</span>`;
  }

  function lineHtml(line, surah, ctx) {
    if (line.kind === "h") {
      return `<div class="ml ml-head"><div class="sura-frame"><span>سُورَةُ ${escapeHtml(surah.meta.ar)}</span></div></div>`;
    }
    if (line.kind === "b") {
      return `<div class="ml ml-basmala"><span>${escapeHtml(window.Quran.basmala)}</span></div>`;
    }
    const cls = "ml" + (isOpeningPage(line.page) ? " ml-center" : "");
    return `<div class="${cls}">${line.tokens.map((t) => tokenHtml(t, ctx)).join("")}</div>`;
  }

  /**
   * @param {object} surah   vorbereitete Sure (Quran.load)
   * @param {object} opts    { from, to, levels, shapes, firstId, activeAyah, tail }
   *                          tail: Anschluss-Tokens des nächsten Verses (werden normal gezeigt)
   */
  function html(surah, opts) {
    const ctx = Object.assign({}, opts, { tail: new Set(opts.tail || []) });
    const lines = surah.lines.filter((l) => {
      if (l.kind !== "t") return ctx.from === 1;
      return l.tokens.some((t) => (t.ayah >= ctx.from && t.ayah <= ctx.to) || ctx.tail.has(t));
    });
    const pages = [];
    for (const l of lines) {
      let p = pages[pages.length - 1];
      if (!p || p.page !== l.page) pages.push((p = { page: l.page, lines: [] }));
      p.lines.push(l);
    }
    return pages
      .map(
        (p) => `
      <figure class="mushaf-page" data-page="${p.page}">
        <div class="mp-paper">
          <div class="mp-top">
            <span class="mp-sura">سُورَةُ ${escapeHtml(surah.meta.ar)}</span>
            <span class="mp-juz">Juz ${surah.juz[p.page]}</span>
          </div>
          <div class="mp-lines">${p.lines.map((l) => lineHtml(l, surah, ctx)).join("")}</div>
          <div class="mp-bottom"><span class="mp-num">${p.page}</span></div>
        </div>
      </figure>`
      )
      .join("");
  }

  /** Natürliche Breite aller Zeilen einer Seite bei 100px Schriftgröße. */
  function naturalWidth(surah, page) {
    const key = surah.n + ":" + page;
    if (widthCache.has(key)) return widthCache.get(key);
    const probe = document.createElement("div");
    probe.className = "ml-probe";
    probe.style.cssText = `position:absolute;visibility:hidden;left:-99999px;top:0;font-family:${FONT};font-size:100px;white-space:nowrap;direction:rtl;`;
    const lines = isOpeningPage(page) ? [REFERENCE_LINE] : surah.lines.filter((l) => l.page === page && l.kind === "t").map((l) => l.tokens.map((t) => t.text));
    probe.innerHTML = lines
      .map((words) => `<div style="display:inline-flex;column-gap:${GAP_EM}em">${words.map((w) => `<span>${escapeHtml(w)}</span>`).join("")}</div><br>`)
      .join("");
    document.body.appendChild(probe);
    let max = 0;
    for (const el of probe.children) if (el.tagName === "DIV") max = Math.max(max, el.getBoundingClientRect().width);
    probe.remove();
    widthCache.set(key, max);
    return max;
  }

  /** Schriftgröße so wählen, dass die längste Zeile der Seite genau passt. */
  function fit(container, surah) {
    const figures = container.querySelectorAll(".mushaf-page");
    if (!figures.length) return;
    const linesEl = figures[0].querySelector(".mp-lines");
    const avail = linesEl.clientWidth;
    if (!avail) return;
    let size = MAX_FONT;
    for (const f of figures) {
      const w = naturalWidth(surah, +f.dataset.page);
      if (w > 0) size = Math.min(size, (avail / w) * 100 * 0.985);
    }
    size = Math.max(MIN_FONT, Math.floor(size * 10) / 10);
    container.style.setProperty("--mushaf-size", size + "px");
  }

  function clearCache() {
    widthCache.clear();
  }

  window.Mushaf = { html, fit, clearCache, toArabicDigits, TOKEN_WORD };
})();
