// Erzeugt data/content.js aus den Inhaltsdateien im Stammverzeichnis:
//
//   dhikr.csv      Adhkar für die 1-Minuten-Pause
//   test_quiz.csv  Quizfragen für die 2-Minuten-Pause (Antwort 1 ist richtig)
//   text_quiz.txt  Texte mit Frage für die 4-Minuten-Pause
//   ghafir.csv     Versfragmente mit Übersetzung und Emoji
//   ghafir_munasaba.csv  Munāsaba nach al-Biqāʿī zwischen den Fragmenten:
//                  je Fragment eine Aussage und eine Frage, die das nächste
//                  Fragment beantwortet; Fragment 0 = Einstieg vor Vers 1
//                  (erstellt aus f-a_biqai-old.txt und ghafir_biqai.txt)
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

// --- Munāsaba zwischen den Fragmenten ---
// { start: { "40": {t, q} }, frag: { "40:3": [{t, q}, …] } } – Reihenfolge wie die Fragmente
const munasaba = { start: {}, frag: {} };
let munCount = 0;
if (existsSync(join(root, "ghafir_munasaba.csv"))) {
  const rowsM = parseCsv(read("ghafir_munasaba.csv"))
    .slice(1)
    .filter((r) => /^\d+$/.test(r[0]) && /^\d+$/.test(r[1]) && /^\d+$/.test(r[2]) && r[3]);
  for (const [s, a, f, t, q] of rowsM) {
    const entry = { t, q: q || "" };
    if (+f === 0) {
      munasaba.start[+s] = entry;
      continue;
    }
    const key = `${+s}:${+a}`;
    (munasaba.frag[key] = munasaba.frag[key] || [])[+f - 1] = entry;
    munCount++;
  }
  for (const [key, list] of Object.entries(munasaba.frag)) {
    const want = (fragments[key] || []).length;
    if (list.length !== want || list.some((e) => !e)) console.warn(`Munāsaba ${key}: ${list.filter(Boolean).length} Einträge, ${want} Fragmente`);
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
console.log(`${dhikr.length} Adhkar, ${quiz.length} Quizfragen, ${texts.length} Texte, ${byVerse.size} Verse mit Fragmenten (${unmatched} Grenzen nur ungefähr), Munāsaba für ${munCount} Fragmente.`);
