/*
 * Quran-Daten (Madani-Mushaf, 604 Seiten à 15 Zeilen): laden, Seiten, Suren,
 * Seitenviertel und Tagesplan.
 *
 * Positionen werden in "Zeilen" gemessen: Seite p, Zeile l (1–15) liegt bei
 * (p - 1) * 15 + (l - 1). Innerhalb einer Zeile wird jedem Token der gleiche
 * Anteil zugeteilt.
 *
 * Ein Lernabschnitt ("Einheit") ist ein Seitenviertel: eine Folge ganzer
 * Verse in Mushaf-Reihenfolge – auch über Surengrenzen hinweg.
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
  const juzList = window.QURAN_JUZ;
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
    const surah = { n: raw.n, meta, juz: raw.juz, lines: [], ayahs: [] };
    for (const [page, line, kind, rawTokens] of raw.lines) {
      const height = SHORT_PAGES[page] ? LINES_PER_PAGE / SHORT_PAGES[page] : 1;
      const pos = (page - 1) * LINES_PER_PAGE + (line - 1) * height;
      const entry = { surah: raw.n, page, line, kind, pos, height, tokens: [] };
      if (kind === "t") {
        const count = rawTokens.length;
        rawTokens.forEach(([ayah, text, type = TOKEN_WORD], i) => {
          const token = {
            surah: raw.n,
            ayah,
            key: `${raw.n}:${ayah}`,
            text,
            type,
            start: pos + (i / count) * height,
            end: pos + ((i + 1) / count) * height,
            line: entry,
          };
          entry.tokens.push(token);
          let v = surah.ayahs[ayah - 1];
          if (!v) v = surah.ayahs[ayah - 1] = { surah: raw.n, ayah, key: token.key, data: surah, tokens: [], start: token.start, page };
          v.tokens.push(token);
          v.end = token.end;
        });
      }
      surah.lines.push(entry);
    }
    surah.start = surah.lines[0].pos;
    const last = surah.lines[surah.lines.length - 1];
    surah.end = last.pos + last.height;
    return surah;
  }

  /** Beginn eines Verses inkl. Kopfzeile und Basmala beim ersten Vers. */
  const verseStart = (v) => (v.ayah === 1 ? v.data.start : v.tokens[0].start);

  /* ------------------------------------------------------------- Seiten */

  const surahsOnPage = (p) => surahs.filter((m) => m.p0 <= p && p <= m.p1).map((m) => m.n);

  async function loadPages(pages) {
    const need = new Set();
    for (const p of pages) if (p >= 1 && p <= 604) for (const n of surahsOnPage(p)) need.add(n);
    await Promise.all(Array.from(need).map(load));
  }

  /** Alle Zeilen einer Seite (die Suren der Seite müssen geladen sein). */
  function linesOfPage(p) {
    const out = [];
    for (const n of surahsOnPage(p)) if (cache[n]) for (const l of cache[n].lines) if (l.page === p) out.push(l);
    return out.sort((a, b) => a.line - b.line);
  }

  /** Verse, die auf Seite p beginnen, in Mushaf-Reihenfolge. */
  function versesStartingOn(p) {
    const out = [];
    for (const n of surahsOnPage(p)) if (cache[n]) for (const v of cache[n].ayahs) if (v.page === p) out.push(v);
    return out;
  }

  const juzOfPage = (p) => (juzList.find((j) => j.p0 <= p && p <= j.p1) || juzList[juzList.length - 1]).n;

  /* -------------------------------------------------------- Seitenviertel */

  /**
   * Teilt die auf Seite p beginnenden Verse in (höchstens) vier etwa gleich
   * große Teile aus ganzen Versen. Bei weniger als vier Versen: ein Teil pro Vers.
   */
  function pageParts(p) {
    const verses = versesStartingOn(p);
    if (!verses.length) return [];
    const n = Math.min(4, verses.length);
    const s = verseStart(verses[0]);
    const e = verses[verses.length - 1].end;
    const cuts = [];
    let prev = -1;
    for (let k = 1; k < n; k++) {
      const target = s + ((e - s) * k) / n;
      let best = prev + 1;
      for (let i = prev + 1; i <= verses.length - 1 - (n - k); i++) {
        if (Math.abs(verses[i].end - target) < Math.abs(verses[best].end - target)) best = i;
      }
      cuts.push(best);
      prev = best;
    }
    cuts.push(verses.length - 1);
    const parts = [];
    let from = 0;
    cuts.forEach((c, index) => {
      const vs = verses.slice(from, c + 1);
      parts.push(makeUnit(vs, { page: p, part: index, parts: n }));
      from = c + 1;
    });
    return parts;
  }

  function makeUnit(verses, extra) {
    const first = verses[0];
    const last = verses[verses.length - 1];
    return Object.assign(
      {
        verses,
        keys: new Set(verses.map((v) => v.key)),
        size: (last.end - verseStart(first)) / LINES_PER_PAGE,
      },
      extra
    );
  }

  /* ------------------------------------------------------------- Suren */

  /** Lädt die Seiten einer Sure (plus die Folgeseite für den Anschluss). */
  function loadSurahPages(n) {
    const m = surahs[n - 1];
    const pages = [];
    for (let p = m.p0; p <= Math.min(604, m.p1 + 1); p++) pages.push(p);
    return loadPages(pages);
  }

  /**
   * Seitenviertel einer Seite, beschränkt auf die Verse einer Sure. Teilen
   * sich mehrere Suren eine Seite, bleiben nur die Verse dieser Sure übrig;
   * leere Viertel entfallen. `part` bleibt die Nummer des Seitenviertels.
   */
  function surahPageParts(p, n) {
    const parts = pageParts(p);
    if (!n) return parts;
    const out = [];
    for (const u of parts) {
      const vs = u.verses.filter((v) => v.surah === n);
      if (!vs.length) continue;
      out.push(vs.length === u.verses.length ? u : makeUnit(vs, { page: u.page, part: u.part, parts: u.parts, surah: n }));
    }
    return out;
  }

  /** Einheit zu einer Auswahl { page, part, surah? }. */
  function unitFor(ref) {
    const parts = surahPageParts(ref.page, ref.surah);
    return parts.find((u) => u.part === ref.part) || parts[0] || null;
  }

  /** Alle Seitenviertel einer Sure in Reihenfolge. */
  function surahParts(n) {
    const m = surahs[n - 1];
    const out = [];
    for (let p = m.p0; p <= m.p1; p++) out.push(...surahPageParts(p, n));
    return out;
  }

  /**
   * Tagesplan: aufeinanderfolgende Seitenviertel, bis die Tagesmenge (in
   * Seiten) erreicht ist. Ein sehr kleiner Rest am Ende kommt zum Vortag.
   */
  function planDays(surahN, daily) {
    const parts = surahParts(surahN);
    const days = [];
    let cur = [];
    let acc = 0;
    for (const part of parts) {
      cur.push(part);
      acc += part.size;
      // ¼ Seite: genau ein Viertel pro Tag; sonst bis die Tagesmenge erreicht ist
      if (daily <= 0.25 || acc >= daily - 0.125 - 1e-9) {
        days.push(cur);
        cur = [];
        acc = 0;
      }
    }
    if (cur.length) {
      if (days.length && acc < daily * 0.3) days[days.length - 1].push(...cur);
      else days.push(cur);
    }
    return days.map((units, index) => ({ index, units, size: units.reduce((s, u) => s + u.size, 0) }));
  }

  /* ------------------------------------------------------------ Einheit */

  function wordsOf(unit) {
    const out = [];
    for (const v of unit.verses) for (const t of v.tokens) if (t.type === TOKEN_WORD) out.push(t);
    return out;
  }

  /** Vers nach v (auch in der nächsten Sure) – falls geladen. */
  function nextVerse(v) {
    const s = v.data;
    if (v.ayah < s.ayahs.length) return s.ayahs[v.ayah];
    const next = cache[v.surah + 1];
    return next ? next.ayahs[0] : null;
  }

  /**
   * Anschluss: die ersten `n` Wörter des Verses nach der Einheit (samt
   * davorstehender Zeichen wie ۞). Hat der Vers höchstens `n` Wörter, gehört
   * er ganz dazu.
   */
  function tailOf(unit, n = 3) {
    const next = nextVerse(unit.verses[unit.verses.length - 1]);
    if (!next) return null;
    const tokens = [];
    let words = 0;
    let complete = true;
    for (const t of next.tokens) {
      if (t.type === TOKEN_WORD && words === n) {
        complete = false;
        break;
      }
      if (t.type === TOKEN_WORD) words++;
      tokens.push(t);
    }
    return { verse: next, tokens, complete, verseWords: next.tokens.filter((t) => t.type === TOKEN_WORD).map((t) => t.text) };
  }

  /** Beschriftung, z. B. „Ghāfir 1–4“ oder „An-Naba’ 38 – An-Nāzi‘āt 5“. */
  function label(unit) {
    const f = unit.verses[0];
    const l = unit.verses[unit.verses.length - 1];
    const name = (v) => surahs[v.surah - 1].tr;
    if (f.surah === l.surah) return f.ayah === l.ayah ? `${name(f)} ${f.ayah}` : `${name(f)} ${f.ayah}–${l.ayah}`;
    return `${name(f)} ${f.ayah} – ${name(l)} ${l.ayah}`;
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
    juzList,
    meta: (n) => surahs[n - 1],
    load,
    loadPages,
    loadSurahPages,
    linesOfPage,
    versesStartingOn,
    juzOfPage,
    pageParts,
    surahPageParts,
    unitFor,
    surahParts,
    planDays,
    wordsOf,
    tailOf,
    label,
    globalAyah,
    basmala: window.QURAN_BASMALA,
  };
})();
