// Seiten- und Zeilenlayout der Madina-Ausgabe 1405 H (King Fahd Complex),
// wie auf quranacademy.org und quran.com (V1) – mit den dortigen Zeilen-
// umbrüchen und der Schreibweise mit Tatweel (gedehnte Buchstaben).
//
// Quelle: quran-madina-html (npm, „Madina05-Hafs“), Waqf General Public
// License 2.0 – tools/vendor/madina05/.
//
// Die Wörter werden Vers für Vers unseren Daten zugeordnet (gleiche Wortzahl,
// einzige Ausnahme 15:7 „لَّوۡمَا“, dort getrennt geschrieben). Unser Text
// bleibt der Bezug (Schlüssel, Rezitation); angezeigt wird die Form der
// Ausgabe 1405 (token[3]).

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const AYAH_END = /^﴿.*﴾$/;
const SYMBOL = /^[۞۩]+$/;

export function loadMadina05() {
  return JSON.parse(readFileSync(join(root, "tools/vendor/madina05/Madina05-Hafs-24px.json"), "utf8"));
}

/**
 * Ordnet die Token einer Sure den Zeilen der Ausgabe 1405 zu.
 * @param {number} n          Sure
 * @param {Array} oldLines    Zeilen aus @quran.ws/text: [seite, zeile, art, tokens]
 * @param {object} M          loadMadina05()
 * @returns {{ lines: Array, notes: string[] }}  Zeilen [seite, zeile, art, tokens, info]
 *          token: [vers, text, typ, anzeige]; info: { c: 1 } = mittig
 */
export function relayout(n, oldLines, M) {
  const S = M.suras[n - 1];
  const notes = [];
  const byAyah = new Map();
  for (const l of oldLines) {
    if (l[2] !== "t") continue;
    for (const t of l[3]) {
      if (!byAyah.has(t[0])) byAyah.set(t[0], []);
      byAyah.get(t[0]).push(t);
    }
  }
  const out = [];
  // Die beiden ersten Einträge: Surenkopf und Basmala (bei Al-Fātiḥa ist die
  // Basmala Vers 1, bei At-Tawba fehlt sie – dann ist der Eintrag leer)
  for (const e of S.ayas.slice(0, 2)) {
    const r = e.r[0];
    if (r && r.t) out.push([e.p, r.l, r.t.startsWith("سورة") ? "h" : "b"]);
  }
  const lineMap = new Map();
  const lineOf = (p, l) => {
    const key = p * 100 + l;
    if (!lineMap.has(key)) {
      const entry = [p, l, "t", []];
      entry.stretch = [];
      lineMap.set(key, entry);
      out.push(entry);
    }
    return lineMap.get(key);
  };

  for (let k = 1; k + 1 < S.ayas.length; k++) {
    const e = S.ayas[k + 1];
    const toks = byAyah.get(k) || [];
    const words = toks.filter((t) => !t[2]);
    const symbols = toks.filter((t) => t[2] === 2);
    const end = toks.find((t) => t[2] === 1);
    const segs = e.r.map((r) => {
      const ws = [];
      for (const w of r.t.split(/\s+/)) {
        if (!w || AYAH_END.test(w)) continue;
        // Sajda-Zeichen ۩ gehört zum Wort davor; ۞ steht als eigenes Zeichen vor dem Vers
        if (SYMBOL.test(w)) {
          if (w.includes("۩") && ws.length) ws[ws.length - 1] += " " + w;
          continue;
        }
        ws.push(w);
      }
      return { r, words: ws };
    });
    let theirs = segs.reduce((a, s) => a + s.words.length, 0);
    while (theirs > words.length) {
      const seg = segs.find((s) => s.words.length > 1);
      if (!seg) break;
      seg.words.splice(0, 2, seg.words[0] + " " + seg.words[1]);
      theirs--;
      notes.push(`${n}:${k} zwei Wörter zusammengelegt`);
    }
    if (theirs < words.length) notes.push(`${n}:${k} ${words.length - theirs} Wort/Wörter ohne Form der Ausgabe 1405`);
    let wi = 0;
    segs.forEach((s, si) => {
      const line = lineOf(e.p, s.r.l);
      line.stretch.push(s.r.s);
      if (si === 0) for (const t of symbols) line[3].push([t[0], t[1], 2]);
      for (const w of s.words) {
        const t = words[wi++];
        if (t) line[3].push([t[0], t[1], 0, w]);
      }
      if (si === segs.length - 1) {
        while (wi < words.length) {
          const t = words[wi++];
          line[3].push([t[0], t[1], 0]);
        }
        if (end) line[3].push([end[0], end[1], 1]);
      }
    });
  }

  for (const entry of lineMap.values()) {
    // s < 0: Zeile steht mittig (kurze Schlusszeilen, Seiten 1–2)
    if (entry.stretch.every((s) => s < 0)) entry.push({ c: 1 });
    delete entry.stretch;
  }
  out.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return { lines: out, notes };
}
