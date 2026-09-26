/*
 * Schrittweises Ausgrauen der Wörter.
 *
 * Jedes Wort wird in fünf Teile (Fünftel) seiner Buchstaben geteilt. Stufe 0 =
 * vollständig sichtbar, Stufe 5 = ganz ausgegraut. Ausgegraut wird vom Wortende
 * her, damit der Wortanfang als Stütze am längsten sichtbar bleibt.
 *
 * Ein Klick auf „Gelernt“:
 *   1. Wörter, bei denen schon Fünftel fehlen, verlieren ein weiteres Fünftel.
 *   2. Von den noch vollständigen Wörtern verliert jedes fünfte ein Fünftel
 *      (bleiben weniger als fünf übrig, trifft es das letzte davon).
 */
(function () {
  "use strict";

  const PARTS = 5;
  const segmenter = typeof Intl !== "undefined" && Intl.Segmenter ? new Intl.Segmenter("ar", { granularity: "grapheme" }) : null;
  const HAS_LETTER = /\p{L}/u;

  /** Buchstaben eines Wortes inkl. ihrer Vokalzeichen; Zeichen ohne Buchstaben hängen am Vorgänger. */
  function letters(text) {
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

  /** Anzahl ausgegrauter Buchstaben bei Stufe `level` (0–5) und `n` Buchstaben. */
  function fadedCount(n, level) {
    if (level <= 0) return 0;
    if (level >= PARTS) return n;
    return Math.min(n, Math.max(1, Math.round((level * n) / PARTS)));
  }

  function step(levels) {
    const next = levels.slice();
    const full = [];
    levels.forEach((l, i) => {
      if (l === 0) full.push(i);
      else if (l < PARTS) next[i] = l + 1;
    });
    const picks = [];
    for (let j = PARTS - 1; j < full.length; j += PARTS) picks.push(full[j]);
    if (!picks.length && full.length) picks.push(full[full.length - 1]);
    for (const i of picks) next[i] = 1;
    return next;
  }

  const isDone = (levels) => levels.every((l) => l >= PARTS);

  /** Anteil ausgegrauter Buchstaben (0–1). */
  function progress(levels, counts) {
    let total = 0;
    let faded = 0;
    levels.forEach((l, i) => {
      total += counts[i];
      faded += fadedCount(counts[i], l);
    });
    return total ? faded / total : 0;
  }

  /** Wie viele Runden braucht ein Abschnitt mit `n` Wörtern, bis alles ausgegraut ist? */
  function roundsFor(n) {
    let levels = new Array(n).fill(0);
    let r = 0;
    while (!isDone(levels) && r < 1000) {
      levels = step(levels);
      r++;
    }
    return r;
  }

  // Safari (WebKit) formt arabische Buchstaben nicht über Elementgrenzen
  // hinweg. Dort erzwingen wir die Verbindung mit einem Zero-Width-Joiner.
  const ua = navigator.userAgent;
  const WEBKIT_SPLITS_SHAPING = /AppleWebKit/.test(ua) && (!/(Chrome|Chromium|Edg|OPR)\//.test(ua) || /iPhone|iPad|iPod/.test(ua));
  const JOINS_BOTH = /[ئبت-خس-غـ-هىي]/;
  const JOINS_RIGHT = /[آ-إاةد-زوٱ]/;
  const ZWJ = "‍";

  const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  /** HTML eines Wortes mit ausgegrautem Ende. */
  function wordHtml(parts, level) {
    const n = parts.length;
    const k = fadedCount(n, level);
    if (k === 0) return escapeHtml(parts.join(""));
    let keep = parts.slice(0, n - k).join("");
    let gone = parts.slice(n - k).join("");
    if (keep && WEBKIT_SPLITS_SHAPING && JOINS_BOTH.test(parts[n - k - 1][0]) && (JOINS_BOTH.test(gone[0]) || JOINS_RIGHT.test(gone[0]))) {
      keep += ZWJ;
      gone = ZWJ + gone;
    }
    return escapeHtml(keep) + '<span class="gone">' + escapeHtml(gone) + "</span>";
  }

  window.Fade = { PARTS, letters, fadedCount, step, isDone, progress, roundsFor, wordHtml, escapeHtml };
})();
