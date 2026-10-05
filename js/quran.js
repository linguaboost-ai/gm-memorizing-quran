/*
 * Quran-Daten (Madani-Mushaf, 604 Seiten à 15 Zeilen): laden, Seiten, Suren
 * und Seitenteile (Viertel, Hälften, ganze Seite).
 *
 * Positionen werden in "Zeilen" gemessen: Seite p, Zeile l (1–15) liegt bei
 * (p - 1) * 15 + (l - 1). Innerhalb einer Zeile wird jedem Token der gleiche
 * Anteil zugeteilt.
 *
 * Ein Lernabschnitt ("Einheit") ist ein Teil einer Seite: eine Folge ganzer
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
    for (const [page, line, kind, rawTokens, info] of raw.lines) {
      const height = SHORT_PAGES[page] ? LINES_PER_PAGE / SHORT_PAGES[page] : 1;
      const pos = (page - 1) * LINES_PER_PAGE + (line - 1) * height;
      // info: { c: 1 } Zeile steht mittig
      const entry = { surah: raw.n, page, line, kind, pos, height, tokens: [], info: info || null };
      if (kind === "t") {
        const count = rawTokens.length;
        // display: Wort in der Schreibweise der Madina-Ausgabe 1405 (mit Tatweel), sonst wie text
        rawTokens.forEach(([ayah, text, rawType, display], i) => {
          const type = rawType == null ? TOKEN_WORD : rawType;
          const token = {
            surah: raw.n,
            ayah,
            key: `${raw.n}:${ayah}`,
            text,
            display: display || text,
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
          // Wortnummer im Vers (0-basiert), z. B. für den Tresor
          if (type === TOKEN_WORD) token.w = (v.wc = (v.wc || 0) + 1) - 1;
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

  /* ---------------------------------------------------------- Seitenteile */

  const wordCount = (v) => v.tokens.filter((t) => t.type === TOKEN_WORD).length;

  /**
   * Teilt Verse in höchstens k zusammenhängende Teile mit möglichst gleich
   * vielen Wörtern. Ein Teil endet nie mit einem sehr kurzen Vers (z. B. حمٓ),
   * außer mit dem letzten Vers – lieber wird ein Teil etwas länger. Wo möglich
   * wird an Surengrenzen geteilt.
   */
  function splitVerses(verses, k) {
    const n = verses.length;
    const w = verses.map(wordCount);
    const pre = [0];
    for (const x of w) pre.push(pre[pre.length - 1] + x);
    const canEnd = (i) => i === n - 1 || w[i] > 2 || verses[i + 1].surah !== verses[i].surah;
    for (let kk = Math.min(k, n); kk >= 1; kk--) {
      const target = pre[n] / kk;
      const cost = Array.from({ length: kk + 1 }, () => new Array(n + 1).fill(Infinity));
      const from = Array.from({ length: kk + 1 }, () => new Array(n + 1).fill(-1));
      cost[0][0] = 0;
      for (let j = 1; j <= kk; j++) {
        for (let i = 1; i <= n; i++) {
          if (!canEnd(i - 1)) continue;
          for (let m = j - 1; m < i; m++) {
            if (cost[j - 1][m] === Infinity) continue;
            // Teile über eine Surengrenze hinweg nur, wenn es nicht anders geht
            const mixed = verses[m].surah !== verses[i - 1].surah ? target * target : 0;
            const c = cost[j - 1][m] + (pre[i] - pre[m] - target) ** 2 + mixed;
            if (c < cost[j][i]) {
              cost[j][i] = c;
              from[j][i] = m;
            }
          }
        }
      }
      if (cost[kk][n] === Infinity) continue;
      const groups = [];
      for (let j = kk, i = n; j >= 1; j--) {
        const m = from[j][i];
        groups.unshift(verses.slice(m, i));
        i = m;
      }
      return groups;
    }
    return [verses];
  }

  /**
   * Größe in Vierteln einer Seite, gerundet: unter 37,5 % ein Viertel,
   * 37,5–62,5 % eine Hälfte, darüber drei Viertel, ab 87,5 % eine Seite.
   */
  function quartersOf(size) {
    const q = size * 4;
    return Math.max(1, Math.min(4, Math.abs(q - 2.5) < 1e-6 ? 2 : Math.round(q)));
  }

  /** Bezeichnung einer Teilgröße. */
  const SIZE_NAMES = { 1: "Viertel", 2: "Hälfte", 3: "Dreiviertel", 4: "Seite" };
  const sizeName = (unit) => SIZE_NAMES[unit.quarters] || "Teil";

  /** Ausdehnung von Versen in Seiten (Kopfzeile und Basmala zählen beim ersten Vers mit). */
  const extentOf = (verses) => (verses[verses.length - 1].end - verseStart(verses[0])) / LINES_PER_PAGE;

  /**
   * Teile einer Seite – gewählt wird Viertel (size 4), Hälfte (2) oder ganze
   * Seite (1). Damit die Einteilung glatt aufgeht, wird gerundet: Füllt der
   * Bereich die Seite nur zu drei Vierteln (z. B. die erste Seite einer Sure),
   * gibt es drei Viertel statt vier. Die Teile sind ganze Verse; `has`
   * beschränkt auf einen Bereich (z. B. eine Sure). Für Seiten mit Inhalten
   * (ghafir_teile.csv) gilt die dort festgelegte, inhaltlich sinnvolle
   * Einteilung, wenn sie zur gerundeten Zahl der Teile passt.
   */
  function pageUnits(p, size, has) {
    const all = versesStartingOn(p);
    const verses = has ? all.filter(has) : all;
    if (!verses.length) return [];
    const n = Math.max(1, Math.min(verses.length, Math.round(extentOf(verses) * size + 1e-9)));
    let groups = null;
    const c = (window.CONTENT_PARTS || {})[p];
    if (n > 1 && c && c[size] && c[size].length === n && verses.every((v) => v.surah === c.s)) {
      const fixed = c[size].map(([a, b]) => verses.filter((v) => v.ayah >= a && v.ayah <= b));
      // nur, wenn die festgelegten Teile genau die Verse des Bereichs abdecken
      if (fixed.every((g) => g.length) && fixed.reduce((x, g) => x + g.length, 0) === verses.length) groups = fixed;
    }
    if (!groups) groups = n === 1 ? [verses] : splitVerses(verses, n);
    // Bezeichnung: mehrere Teile heißen wie gewählt (Viertel, Hälfte); ein
    // einzelner Teil nach seiner gerundeten Größe (z. B. Dreiviertel)
    return groups.map((vs, i) => {
      const unit = makeUnit(vs, { page: p, part: i, parts: groups.length, kind: size });
      if (groups.length > 1) unit.quarters = 4 / size;
      return unit;
    });
  }

  function makeUnit(verses, extra) {
    const first = verses[0];
    const last = verses[verses.length - 1];
    return Object.assign(
      {
        verses,
        keys: new Set(verses.map((v) => v.key)),
        size: (last.end - verseStart(first)) / LINES_PER_PAGE,
        quarters: quartersOf((last.end - verseStart(first)) / LINES_PER_PAGE),
      },
      extra
    );
  }

  /** Lädt die Seiten einer Sure (plus die Folgeseite für den Anschluss). */
  function loadSurahPages(n) {
    const m = surahs[n - 1];
    const pages = [];
    for (let p = m.p0; p <= Math.min(604, m.p1 + 1); p++) pages.push(p);
    return loadPages(pages);
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

  const PAUSE_MARK = /[\u06D6-\u06DB]/;

  /**
   * Anschluss: die ersten Wörter des Verses nach der Einheit (samt
   * davorstehender Zeichen wie ۞) – ein bis drei Wörter, die zusammen Sinn
   * ergeben (ghafir_anschluss.csv), sonst bis zu drei Wörter, höchstens bis
   * zum ersten Pausenzeichen. Ist der Vers so kurz, gehört er ganz dazu.
   * Mit `sameSurah` gibt es am Ende einer Sure keinen Anschluss.
   */
  function tailOf(unit, sameSurah) {
    const last = unit.verses[unit.verses.length - 1];
    const next = nextVerse(last);
    // Ist eine Sure gewählt, endet der Anschluss an ihrem Ende
    if (!next || (sameSurah && next.surah !== last.surah)) return null;
    const words = next.tokens.filter((t) => t.type === TOKEN_WORD);
    let n = (window.CONTENT_TAIL || {})[next.key];
    if (!n) {
      n = 0;
      for (const w of words) {
        n++;
        if (n >= 3 || PAUSE_MARK.test(w.text)) break;
      }
    }
    n = Math.max(1, Math.min(n, words.length));
    const tokens = [];
    let count = 0;
    for (const t of next.tokens) {
      if (t.type === TOKEN_WORD) {
        if (count === n) break;
        count++;
      }
      tokens.push(t);
    }
    return {
      verse: next,
      tokens,
      words: tokens.filter((t) => t.type === TOKEN_WORD),
      complete: n === words.length,
      verseWords: words.map((t) => t.text),
    };
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
    /** Vers einer geladenen Sure (sonst null). */
    verse: (n, a) => (cache[n] && cache[n].ayahs[a - 1]) || null,
    loadPages,
    loadSurahPages,
    linesOfPage,
    versesStartingOn,
    juzOfPage,
    pageUnits,
    sizeName,
    wordsOf,
    tailOf,
    label,
    globalAyah,
    basmala: window.QURAN_BASMALA,
    /** Basmala in der Schreibweise der Madina-Ausgabe 1405 (Mushaf-Seite). */
    basmalaMushaf: window.QURAN_BASMALA_1405 || window.QURAN_BASMALA,
  };
})();
