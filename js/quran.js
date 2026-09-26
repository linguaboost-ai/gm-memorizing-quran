/*
 * Quran-Daten laden und in Tages- und Lernabschnitte einteilen.
 *
 * Positionen werden in "Zeilen" gemessen: Seite p, Zeile l (1–15) liegt bei
 * (p - 1) * 15 + (l - 1). Innerhalb einer Zeile wird jedem Token der gleiche
 * Anteil zugeteilt. So lassen sich Viertel-, halbe und ganze Mushaf-Seiten
 * direkt als Raster ausdrücken.
 */
(function () {
  "use strict";

  const LINES_PER_PAGE = 15;
  // Die beiden Eröffnungsseiten haben im Mushaf nur 8 Zeilen, füllen aber
  // trotzdem eine ganze Seite.
  const SHORT_PAGES = { 1: 8, 2: 8 };
  const TOKEN_WORD = 0;
  const TOKEN_AYAH_END = 1;
  const TOKEN_SYMBOL = 2;

  const surahs = window.QURAN_SURAHS;
  const cache = {};

  const pad3 = (n) => String(n).padStart(3, "0");

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error("Datei konnte nicht geladen werden: " + src));
      document.head.appendChild(s);
    });
  }

  async function load(n) {
    if (cache[n]) return cache[n];
    const store = window.QURAN_SURAH_DATA || {};
    if (!store[n]) await loadScript(`data/surah/${pad3(n)}.js`);
    cache[n] = prepare(window.QURAN_SURAH_DATA[n]);
    return cache[n];
  }

  function prepare(raw) {
    const meta = surahs[raw.n - 1];
    const lines = [];
    const ayahs = [];
    let wordId = 0;

    for (const [page, line, kind, rawTokens] of raw.lines) {
      const height = SHORT_PAGES[page] ? LINES_PER_PAGE / SHORT_PAGES[page] : 1;
      const pos = (page - 1) * LINES_PER_PAGE + (line - 1) * height;
      const entry = { page, line, kind, pos, height, tokens: [] };
      if (kind === "t") {
        const count = rawTokens.length;
        rawTokens.forEach(([ayah, text, type = TOKEN_WORD], i) => {
          const token = {
            ayah,
            text,
            type,
            start: pos + (i / count) * height,
            end: pos + ((i + 1) / count) * height,
            line: entry,
          };
          if (type === TOKEN_WORD) token.id = wordId++;
          entry.tokens.push(token);
          const a = ayahs[ayah - 1] || (ayahs[ayah - 1] = { n: ayah, tokens: [], start: token.start });
          a.tokens.push(token);
          a.end = token.end;
          a.page = a.page || page;
        });
      }
      lines.push(entry);
    }

    const first = lines[0];
    const last = lines[lines.length - 1];
    return {
      n: raw.n,
      meta,
      juz: raw.juz,
      lines,
      ayahs,
      start: first.pos,
      end: last.pos + last.height,
      anchor: (first.page - 1) * LINES_PER_PAGE,
    };
  }

  /** Beginn eines Verses inkl. Kopfzeile und Basmala beim ersten Vers. */
  function ayahStart(surah, a) {
    return a === 1 ? surah.start : surah.ayahs[a - 2].end;
  }

  function rangeSize(surah, from, to) {
    return (surah.ayahs[to - 1].end - ayahStart(surah, from)) / LINES_PER_PAGE;
  }

  /**
   * Teilt die Verse from..to in Abschnitte von etwa `pages` Seiten. Verse
   * werden nie geteilt: jede Grenze liegt am Versende, das einer Zielposition
   * am nächsten ist.
   *
   * mode "grid": Zielpositionen sind Seitenbruchteile des Mushaf (ab dem
   *   oberen Rand der ersten Surenseite) – so fallen Tagesabschnitte z. B.
   *   genau auf obere/untere Seitenhälften.
   * mode "even": der Bereich wird in gleich große Teile zerlegt – für die
   *   Lerneinheiten innerhalb eines Tages.
   *
   * Sehr kleine Reste (< 30 % eines Abschnitts) werden an den Nachbarn angehängt.
   */
  function divide(surah, from, to, pages, mode = "grid") {
    const startPos = ayahStart(surah, from);
    const endPos = surah.ayahs[to - 1].end;
    const end = (a) => surah.ayahs[a - 1].end;
    const eps = 1e-6;

    const targets = [];
    let step = pages * LINES_PER_PAGE;
    if (mode === "even") {
      const n = Math.max(1, Math.round((endPos - startPos) / step));
      step = (endPos - startPos) / n;
      for (let k = 1; k < n; k++) targets.push(startPos + k * step);
    } else {
      let k = Math.floor((startPos - surah.anchor) / step) + 1;
      for (let g = surah.anchor + k * step; g < endPos - eps; g = surah.anchor + ++k * step) targets.push(g);
    }

    const cuts = [];
    for (const g of targets) {
      let best = null;
      let bestDist = Infinity;
      for (let a = from; a < to; a++) {
        const dist = Math.abs(end(a) - g);
        if (dist < bestDist - eps) {
          bestDist = dist;
          best = a;
        }
      }
      if (best !== null && (cuts.length === 0 || best > cuts[cuts.length - 1])) cuts.push(best);
    }

    const sections = [];
    let s = from;
    for (const c of cuts) {
      sections.push([s, c]);
      s = c + 1;
    }
    sections.push([s, to]);

    const length = ([a, b]) => end(b) - ayahStart(surah, a);
    for (let guard = 0; guard < 1000 && sections.length > 1; guard++) {
      const i = sections.findIndex((sec) => length(sec) < 0.3 * step);
      if (i < 0) break;
      const j = i === 0 ? 1 : i - 1;
      const lo = Math.min(i, j);
      sections.splice(lo, 2, [sections[lo][0], sections[lo + 1][1]]);
    }
    return sections;
  }

  /** Vollständiger Plan: Tagesabschnitte, jeweils unterteilt in Lernabschnitte. */
  function plan(surah, daily, chunk) {
    return divide(surah, 1, surah.ayahs.length, daily).map(([from, to], index) => ({
      index,
      from,
      to,
      size: rangeSize(surah, from, to),
      chunks: divide(surah, from, to, chunk, "even").map(([a, b]) => ({ from: a, to: b, size: rangeSize(surah, a, b) })),
    }));
  }

  /** Wörter (ohne Versnummern und Zeichen) eines Versbereichs in Lesereihenfolge. */
  function wordsOf(surah, from, to) {
    const out = [];
    for (let a = from; a <= to; a++) for (const t of surah.ayahs[a - 1].tokens) if (t.type === TOKEN_WORD) out.push(t);
    return out;
  }

  /** Globale Versnummer (1–6236), z. B. für alternative Audioquellen. */
  function globalAyah(n, a) {
    let sum = 0;
    for (let i = 0; i < n - 1; i++) sum += surahs[i].ayahs;
    return sum + a;
  }

  window.Quran = {
    LINES_PER_PAGE,
    TOKEN_WORD,
    TOKEN_AYAH_END,
    TOKEN_SYMBOL,
    surahs,
    meta: (n) => surahs[n - 1],
    load,
    plan,
    divide,
    rangeSize,
    wordsOf,
    globalAyah,
    basmala: window.QURAN_BASMALA,
  };
})();
