/*
 * Schrittweises Ausgrauen der Wörter.
 *
 * Gezählt werden Buchstaben und Harakat einzeln: jedes Zeichen zählt 1, die
 * Shadda 2 (sie steht für einen verdoppelten Buchstaben mit Sukun), Tatweel
 * und Waqf-/Gliederungszeichen zählen nicht. كَذَّبَتۡ hat so 10 Zeichen.
 *
 * Jeder Klick auf „Gelernt“ graut bei jedem Wort ein weiteres Fünftel aus,
 * vom Wortende her und abgerundet: Nach k Klicks sind floor(k · n / 5) der n
 * Zeichen ausgegraut – im Zweifel bleibt also ein Zeichen mehr sichtbar. Nach
 * fünf Klicks ist alles ausgegraut.
 *
 * Darstellung: Browser färben eine Haraka immer wie ihren Buchstaben. Deshalb
 * liegt jedes angefangene Wort in zwei deckungsgleichen Ebenen übereinander:
 * hinten das ganze Wort blass (opacity 0.1), vorne nur der sichtbare Teil –
 * ausgegraute Buchstaben unsichtbar, ausgegraute Harakat entfernt.
 */
(function () {
  "use strict";

  const PARTS = 5;
  const segmenter = typeof Intl !== "undefined" && Intl.Segmenter ? new Intl.Segmenter("ar", { granularity: "grapheme" }) : null;
  const HAS_LETTER = /\p{L}/u;
  const SHADDA = "ّ";
  const NO_WEIGHT = /[ـۖ-۞۩]/;

  const weight = (ch) => (ch === SHADDA ? 2 : NO_WEIGHT.test(ch) ? 0 : 1);

  /** Buchstaben eines Wortes inkl. ihrer Harakat; Zeichen ohne Buchstaben hängen am Vorgänger. */
  function clustersOf(text) {
    const parts = segmenter ? Array.from(segmenter.segment(text), (s) => s.segment) : text.match(/\P{M}\p{M}*/gu) || [text];
    const out = [];
    let pending = "";
    for (const p of parts) {
      if (HAS_LETTER.test(p)) {
        out.push(pending + p);
        pending = "";
      } else if (out.length) {
        out[out.length - 1] += p;
      } else {
        pending += p;
      }
    }
    if (pending) out.length ? (out[out.length - 1] += pending) : out.push(pending);
    return out;
  }

  /** Zerlegt ein Wort in Buchstaben-Cluster und zählt seine Zeichen. */
  function analyze(text) {
    const clusters = clustersOf(text).map((c) => Array.from(c));
    const chars = [].concat(...clusters);
    return { text, clusters, chars, total: chars.reduce((s, c) => s + weight(c), 0) };
  }

  /** Anzahl ausgegrauter Zeichen bei Stufe `level` (0–5) und `n` Zeichen (abgerundet). */
  function fadedCount(n, level) {
    if (level <= 0) return 0;
    if (level >= PARTS) return n;
    return Math.floor((level * n) / PARTS);
  }

  /** Wie viele Zeichen am Wortende ausgegraut werden (ihr Gewicht übersteigt das Fünftel nie). */
  function fadedChars(word, level) {
    if (level >= PARTS) return word.chars.length;
    const target = fadedCount(word.total, level);
    if (target <= 0) return 0;
    let sum = 0;
    let k = 0;
    for (let i = word.chars.length - 1; i >= 0; i--) {
      const w = weight(word.chars[i]);
      if (sum + w > target) break;
      sum += w;
      k++;
    }
    return k;
  }

  /** Ein Klick auf „Gelernt“: jedes Wort verliert ein weiteres Fünftel. */
  const step = (levels) => levels.map((l) => Math.min(PARTS, l + 1));

  const isDone = (levels) => levels.every((l) => l >= PARTS);

  /** Anteil ausgegrauter Zeichen (0–1). */
  function progress(levels, totals) {
    let total = 0;
    let faded = 0;
    levels.forEach((l, i) => {
      total += totals[i];
      faded += fadedCount(totals[i], l);
    });
    return total ? faded / total : 0;
  }

  // Safari (WebKit) formt arabische Buchstaben nicht über Elementgrenzen
  // hinweg. Dort erzwingen wir die Verbindung mit einem Zero-Width-Joiner.
  const ua = navigator.userAgent;
  const WEBKIT_SPLITS_SHAPING = /AppleWebKit/.test(ua) && (!/(Chrome|Chromium|Edg|OPR)\//.test(ua) || /iPhone|iPad|iPod/.test(ua));
  const JOINS_BOTH = /[ئبت-خس-غـ-هىي]/;
  const JOINS_RIGHT = /[آ-إاةد-زوٱ]/;
  const ZWJ = "‍";

  const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  /** HTML eines Wortes (Ergebnis von `analyze`) auf Stufe `level`. */
  function wordHtml(word, level) {
    const k = fadedChars(word, level);
    if (k === 0) return escapeHtml(word.text);
    const ghost = `<span class="ghost">${escapeHtml(word.text)}</span>`;
    if (k >= word.chars.length) return ghost;

    const cut = word.chars.length - k;
    let front = "";
    let hidden = "";
    let lastKept = "";
    let firstHidden = "";
    let i = 0;
    for (const cl of word.clusters) {
      const start = i;
      i += cl.length;
      if (i <= cut) {
        front += cl.join("");
        lastKept = cl[0];
      } else if (start >= cut) {
        hidden += cl.join("");
        firstHidden = firstHidden || cl[0];
      } else {
        // Buchstabe bleibt sichtbar, seine hinteren Harakat sind ausgegraut
        front += cl.slice(0, cut - start).join("");
        lastKept = cl[0];
      }
    }
    if (hidden && WEBKIT_SPLITS_SHAPING && JOINS_BOTH.test(lastKept) && (JOINS_BOTH.test(firstHidden) || JOINS_RIGHT.test(firstHidden))) {
      front += ZWJ;
      hidden = ZWJ + hidden;
    }
    const hide = hidden ? `<span class="hide">${escapeHtml(hidden)}</span>` : "";
    return `${ghost}<span class="front" aria-hidden="true">${escapeHtml(front)}${hide}</span>`;
  }

  window.Fade = { PARTS, analyze, fadedCount, fadedChars, step, isDone, progress, wordHtml, escapeHtml };
})();
