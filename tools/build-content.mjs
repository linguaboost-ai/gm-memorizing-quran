// Erzeugt data/content.js aus den Inhaltsdateien im Stammverzeichnis:
//
//   dhikr.csv      Adhkar für die 1-Minuten-Pause
//   test_quiz.csv  Quizfragen für die 2-Minuten-Pause (Antwort 1 ist richtig)
//   text_quiz.txt  Texte mit Frage für die 4-Minuten-Pause
//   ghafir.csv     Versfragmente mit Übersetzung und Emoji
//   f-a_biqai-old.txt  Munāsaba (Zusammenhang der Verse) nach al-Biqāʿī
//
//   npm run build:content
//
// Die Fragmente der CSV werden über das Konsonantengerüst den Wörtern des
// Madani-Textes (data/surah/NNN.js) zugeordnet – angezeigt wird immer der
// Uthmani-Text des Madani-Mushaf.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(join(root, f), "utf8").replace(/^﻿/, "");

/** CSV mit Semikolon und Anführungszeichen. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ";") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.map((r) => r.map((c) => c.trim()));
}

// --- Adhkar ---
const dhikr = parseCsv(read("dhikr.csv"))
  .slice(1)
  .filter((r) => r[0] && r[1] && r[2])
  // Tippfehler in der Vorlage: lateinisches „d“ in مُحَمَّدٍ
  .map(([ar, tr, de, reward]) => ({ ar: ar.replace(/مُحَمَّdٍ/g, "مُحَمَّدٍ"), tr, de, reward }));

// --- Quiz (Antwort 1 ist jeweils richtig) ---
const quiz = parseCsv(read("test_quiz.csv"))
  .slice(1)
  .filter((r) => r[0] && r[1] && r[4])
  .map(([q, a1, a2, a3, a4]) => ({ q, answers: [a1, a2, a3, a4].map((a) => a.replace(/\s*\[\d+\]\s*$/, "")) }));

// --- Texte mit Frage ---
const texts = [];
{
  const blocks = read("text_quiz.txt").split(/\n(?=Ausschnitt \d+:)/);
  for (const block of blocks) {
    const lines = block.split(/\r?\n/).map((l) => l.trim());
    const title = lines[0].replace(/^Ausschnitt \d+:\s*/, "").replace(/\s*\(ca\.[^)]*\)\s*$/, "");
    const qIdx = lines.findIndex((l) => /^Frage:?$/.test(l));
    const text = lines.slice(1, qIdx).filter(Boolean).join("\n");
    const rest = lines.slice(qIdx + 1).filter(Boolean);
    const question = rest[0];
    const options = rest.slice(1).map((l) => {
      const m = l.match(/^([A-D])\)\s*(.*?)\s*\((Richtig|Falsch[^)]*)\)\s*$/);
      return { text: m ? m[2] : l.replace(/^[A-D]\)\s*/, ""), correct: !!m && m[3] === "Richtig" };
    });
    if (title && text && question) texts.push({ title, text, question, options });
  }
}

// --- Fragmente ---
const SKIP = /[اىيوءؤئٱأإآ]/;
const skeleton = (s) =>
  s
    .replace(/[^ء-يٱ]/g, "")
    .replace(/ة/g, "ه")
    .split("")
    .filter((c) => !SKIP.test(c))
    .join("");

function loadSurah(n) {
  const file = join(root, `data/surah/${String(n).padStart(3, "0")}.js`);
  if (!existsSync(file)) throw new Error("Bitte zuerst npm run build:data ausführen");
  const ctx = { window: {} };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(readFileSync(file, "utf8"), ctx);
  const words = {};
  for (const [, , kind, tokens] of ctx.QURAN_SURAH_DATA[n].lines) {
    if (kind !== "t") continue;
    for (const [a, text, type] of tokens) if (!type) (words[a] = words[a] || []).push(text);
  }
  return words;
}

const fragments = {};
const surahWords = {};
const rows = parseCsv(read("ghafir.csv"))
  .slice(1)
  .filter((r) => /^\d+$/.test(r[0]) && /^\d+$/.test(r[1]) && r[2]);
const byVerse = new Map();
for (const [s, a, ar, de, emoji] of rows) {
  const key = `${+s}:${+a}`;
  if (!byVerse.has(key)) byVerse.set(key, []);
  byVerse.get(key).push({ ar, de, emoji });
}
let unmatched = 0;
for (const [key, frs] of byVerse) {
  const [s, a] = key.split(":").map(Number);
  surahWords[s] = surahWords[s] || loadSurah(s);
  const words = surahWords[s][a];
  // kumulierte Gerüstlänge an jedem Wortende
  const wordEnds = [];
  let sum = 0;
  for (const w of words) wordEnds.push((sum += skeleton(w).length));
  let csvSum = 0;
  let prev = 0;
  const out = [];
  frs.forEach((f, i) => {
    csvSum += skeleton(f.ar).length;
    let end = words.length;
    if (i < frs.length - 1) {
      // Wortende mit der nächsten Gerüstlänge, mindestens ein Wort, Platz für die übrigen
      let best = prev + 1;
      for (let j = prev + 1; j <= words.length - (frs.length - 1 - i); j++) {
        if (Math.abs(wordEnds[j - 1] - csvSum) < Math.abs(wordEnds[best - 1] - csvSum)) best = j;
      }
      if (wordEnds[best - 1] !== csvSum) unmatched++;
      end = best;
    }
    out.push({ end, de: f.de, emoji: f.emoji });
    prev = end;
  });
  fragments[key] = out;
}

// --- Munāsaba nach al-Biqāʿī (Sure Ghāfir) ---
const munasaba = { surah: 40, verses: {}, pages: [], arc: "" };
{
  const clean = (t) => t.replace(/\*\*/g, "").replace(/(^|\s)\*([^*]+)\*/g, "$1$2").trim();
  const lines = existsSync(join(root, "f-a_biqai-old.txt")) ? read("f-a_biqai-old.txt").split(/\r?\n/) : [];
  let page = null;
  let last = null; // Eintrag, zu dem die nächste ❓-Frage gehört
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    let m;
    if ((m = l.match(/^\*\*Surat .*Seite (\d+) \(Verse (\d+)[–-](\d+)\)/))) {
      page = { n: +m[1], from: +m[2], to: +m[3], bridge: "", bridgeQ: "", thread: "" };
      munasaba.pages.push(page);
      last = null;
    } else if ((m = l.match(/^\*Brücke[^*]*\*\s*(.*)$/)) && page) {
      page.bridge = clean(m[1]);
      last = { set: (q) => (page.bridgeQ = q) };
    } else if ((m = l.match(/^\*\*Vers (\d+)[^*]*:\*\*\s*(.*)$/))) {
      const entry = { t: clean(m[2]), q: "" };
      munasaba.verses[`40:${+m[1]}`] = entry;
      last = { set: (q) => (entry.q = q) };
    } else if (l.startsWith("❓") && last) {
      last.set(clean(l.replace(/^❓\s*/, "")));
      last = null;
    } else if (/^\*\*Merkfaden/.test(l) && page) {
      page.thread = clean(lines[i + 1] || "");
    } else if (/^\*\*Der große Bogen/.test(l)) {
      munasaba.arc = clean(lines[i + 1] || "");
    }
  }
}

const header = "// Generiert von tools/build-content.mjs – nicht von Hand bearbeiten.\n";
writeFileSync(
  join(root, "data/content.js"),
  header +
    `window.CONTENT_DHIKR=${JSON.stringify(dhikr)};\n` +
    `window.CONTENT_QUIZ=${JSON.stringify(quiz)};\n` +
    `window.CONTENT_TEXTS=${JSON.stringify(texts)};\n` +
    `window.CONTENT_FRAGMENTS=${JSON.stringify(fragments)};\n` +
    `window.CONTENT_MUNASABA=${JSON.stringify(munasaba)};\n`
);
console.log(`${dhikr.length} Adhkar, ${quiz.length} Quizfragen, ${texts.length} Texte, ${byVerse.size} Verse mit Fragmenten (${unmatched} Grenzen nur ungefähr), Munāsaba für ${Object.keys(munasaba.verses).length} Verse auf ${munasaba.pages.length} Seiten.`);
