// Blocksatz wie im gedruckten Madani-Mushaf: Die Zeilen werden vor allem durch
// die Kaschida-Formen der Schrift (gedehnte Buchstaben) auf volle Breite
// gebracht und erst danach über die Wortabstände – nach dem Verfahren aus
// linguaboost-ai/gm-quran-progress (js/mushaf.js, layoutLine/stretchOptions).
//
// Gemessen wird mit HarfBuzz und der Schrift KFGQPC Uthmanic HAFS v3.0, also
// genau so, wie der Browser die Wörter formt. Ergebnis je Zeile: die Wörter
// mit eingefügten Tatweel (U+0640), aus denen die Schrift ihre gedehnten
// Buchstabenformen bildet, und ob die Zeile mittig steht.
//
// Seitenmaße wie in js/ornaments.js: Seite 1000 × 1414, Textbreite 760,
// Schriftgröße 40, Zeilenabstand 74,5.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as hb from "./vendor/harfbuzzjs/index.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export const TEXT = { left: 120, right: 880, top: 152, pitch: 74.5, fontSize: 40 };
const FRAME = { y0: 100, y1: 1318 };
const SPECIAL = { cx: 500, cy: (FRAME.y0 + FRAME.y1) / 2 + 6, rx: 352, ry: 440 };

const TATWEEL = "ـ";
const DUAL = new Set([..."بتثجحخسشصضطظعغفقكلمنهيىئ"]);
const RIGHT = new Set([..."اأإآٱدذرزوؤة"]);
const joinsLeft = (c) => DUAL.has(c);
const joinsRight = (c) => DUAL.has(c) || RIGHT.has(c);
const isMarkChar = (c) => /\p{M}/u.test(c) || c === "ۥ" || c === "ۦ";

export class Justifier {
  constructor() {
    const bytes = readFileSync(join(root, "fonts/UthmanicHafs-v-3.0.ttf"));
    this.face = new hb.Face(new hb.Blob(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)));
    this.font = new hb.Font(this.face);
    this.upem = this.face.upem;
    this.ligatures = JSON.parse(readFileSync(join(root, "tools/vendor/ligatures.json"), "utf8"));
    this.buf = new hb.Buffer();
    this.cache = new Map();
    this.tatweelGid = this.font.glyph(0x640);
    this.spaceAdv = this.font.glyphHAdvance(this.font.glyph(0x20));
  }

  /** Formt einen Text (ein Wort): Glyphen und Breite in Schrifteinheiten. */
  shape(text) {
    let r = this.cache.get(text);
    if (r) return r;
    const { buf } = this;
    buf.clearContents();
    buf.addText(text);
    buf.guessSegmentProperties();
    hb.shape(this.font, buf);
    const infos = buf.getGlyphInfos();
    const pos = buf.getGlyphPositions();
    let width = 0;
    const gids = infos.map((g, i) => {
      width += pos[i].xAdvance;
      return g.codepoint;
    });
    r = { gids, width };
    this.cache.set(text, r);
    return r;
  }

  /**
   * Mögliche Dehnungen eines Wortes: Tatweel an einer Verbindung einfügen;
   * die Schrift bildet daraus ihre gedehnten Buchstabenformen. Stufen: erst
   * 1–3 Tatweel an der letzten brauchbaren Verbindung, danach zusätzlich an
   * der vorletzten. Eine Stufe gilt nur, wenn die Schrift das Tatweel ganz in
   * gedehnte Formen umsetzt und keine große Ligatur (z. B. ٱللَّه) zerfällt.
   */
  stretchOptions(word) {
    const base = this.shape(word);
    const bigLigs = new Set(base.gids.filter((g) => this.ligatures[g] && this.ligatures[g].n >= 3));
    const bases = [];
    for (let i = 0; i < word.length; i++) if (!isMarkChar(word[i])) bases.push(i);
    const positions = [];
    for (let k = 1; k < bases.length; k++) {
      const p = word[bases[k - 1]];
      const c = word[bases[k]];
      // nie zwischen ل und Alif dehnen: das zerstört die Lām-Alif-Ligatur (لا)
      if (p === "ل" && "اأإآٱ".includes(c)) continue;
      if (joinsLeft(p) && joinsRight(c)) positions.push(bases[k]);
    }
    positions.reverse();
    const build = (ins) => {
      let text = word;
      for (const { pos, n } of [...ins].sort((a, b) => b.pos - a.pos)) text = text.slice(0, pos) + TATWEEL.repeat(n) + text.slice(pos);
      return text;
    };
    const ok = (s, prevWidth) => !s.gids.includes(this.tatweelGid) && ![...bigLigs].some((g) => !s.gids.includes(g)) && s.width > prevWidth;
    const levels = [];
    const fixed = [];
    let width = base.width;
    for (const pos of positions) {
      let added = 0;
      for (let n = 1; n <= 3; n++) {
        const text = build([...fixed, { pos, n }]);
        const s = this.shape(text);
        if (!ok(s, width)) break;
        levels.push({ text, width: s.width });
        width = s.width;
        added = n;
      }
      if (added) fixed.push({ pos, n: added });
      if (fixed.length >= 2) break;
    }
    return levels;
  }

  /**
   * Setzt eine Zeile. items: [{ text, word: bool }]
   * @returns {{ texts: string[], width: number, gap: number, scaleX: number }} (Schrifteinheiten)
   */
  layoutLine(items, target, { center = false, maxGap = 1.5 } = {}) {
    const its = items.map((it) => ({ ...it, shaped: this.shape(it.text), out: it.text }));
    const S0 = this.spaceAdv;
    const spaces = Math.max(its.length - 1, 0);
    const sum = () => its.reduce((a, it) => a + it.shaped.width, 0);
    const natural = sum() + spaces * S0;
    if (!center && natural < target) {
      // Kaschida verteilen, bis die Wortabstände höchstens maxGap-fach sind:
      // immer das bisher am wenigsten gedehnte Wort (längere Wörter zuerst).
      const cands = its.filter((it) => it.word && !it.text.includes("ۤ"));
      const opts = new Map(cands.map((it) => [it, this.stretchOptions(it.text)]));
      const level = new Map(cands.map((it) => [it, 0]));
      for (let guard = 0; guard < 80; guard++) {
        const deficit = target - sum();
        if (deficit <= Math.max(spaces, 0.5) * S0 * maxGap) break;
        const next = cands.filter((it) => level.get(it) < opts.get(it).length).sort((a, b) => level.get(a) - level.get(b) || b.shaped.width - a.shaped.width)[0];
        if (!next) break;
        const lv = level.get(next) + 1;
        const o = opts.get(next)[lv - 1];
        // nicht über das Ziel hinaus dehnen (Abstände sollen nicht zu eng werden)
        if (target - (sum() + (o.width - next.shaped.width)) < spaces * S0 * 0.8) break;
        level.set(next, lv);
        next.shaped = this.shape(o.text);
        next.out = o.text;
      }
    }
    const words = sum();
    let gap = S0;
    let scaleX = 1;
    if (!center && spaces) {
      gap = (target - words) / spaces;
      if (gap < S0 * 0.55) {
        gap = S0 * 0.55;
        scaleX = target / (words + gap * spaces);
      }
    }
    return { texts: its.map((it) => it.out), width: (words + gap * spaces) * scaleX, natural, gap, scaleX };
  }

  /**
   * Blocksatz für alle Textzeilen einer Sure (Format data/surah/NNN.js).
   * Ergänzt je Wort das gedehnte Wort (token[3]) und je Zeile Angaben für die
   * Darstellung (line[4]): { c: 1 } mittig, { w } Zeilenbreite in Seiteneinheiten.
   */
  justifySurah(lines, lastAyah, linesOnPage) {
    const scale = TEXT.fontSize / this.upem;
    const width = TEXT.right - TEXT.left;
    let stretched = 0;
    for (const line of lines) {
      const [page, lineNo, kind, tokens] = line;
      if (kind !== "t") continue;
      const special = page <= 2;
      let avail = width;
      if (special) {
        const n = linesOnPage(page);
        const y0 = SPECIAL.cy - (n * TEXT.pitch) / 2 + (lineNo - 1) * TEXT.pitch;
        const t = (y0 + TEXT.pitch / 2 - SPECIAL.cy) / SPECIAL.ry;
        avail = Math.min(width, 2 * (SPECIAL.rx * Math.sqrt(Math.max(0, 1 - t * t)) - 38));
      }
      const items = tokens.map((t) => ({ text: t[1], word: !t[2] }));
      let target = avail / scale;
      const natural = this.layoutLine(items, target, { center: true });
      const surahEnd = tokens.some((t) => t[2] === 1 && t[0] === lastAyah);
      // Kurze Schlusszeilen einer Sure mittig; ebenso extrem kurze Zeilen (nur S. 604)
      const center = (surahEnd && natural.width < target * 0.8) || natural.width < target * 0.5;
      // Seiten 1 und 2: mäßig dehnen und mittig setzen, so entsteht die runde Form
      if (special) target = Math.min(target, natural.width * 1.3);
      if (natural.width > target) target = natural.width;
      const lay = center ? natural : this.layoutLine(items, target, { maxGap: special ? 1.8 : 1.5 });
      lay.texts.forEach((text, i) => {
        if (text !== tokens[i][1]) {
          tokens[i][2] = tokens[i][2] || 0; // Typ „Wort“ ausdrücklich, sonst stünde null im JSON
          tokens[i][3] = text;
          stretched++;
        }
      });
      const info = {};
      if (center) info.c = 1;
      if (special && !center) info.w = Math.round(target * scale * 10) / 10;
      if (Object.keys(info).length) line[4] = info;
    }
    return stretched;
  }
}
