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
//   ghafir_geschichte.csv  je Fragment ein Stichpunkt und das Emoji
//                  (ersetzt das Emoji aus ghafir.csv)
//   ghafir_unterteile.csv  Unterteile langer Fragmente für die Munāsaba-
//                  Aufgabe (Wortbereich, Frage, Stichpunkt, Emoji, Übersetzung)
//   ghafir_luecken.csv     bekannte Wörter je Vers für den Lückentext
//                  (Wort, Übersetzung, drei falsche Wörter, Alltagsbezug)
//   ghafir_fragen.csv      Fragen je Vers (deutsch), Antworten arabisch
//                  (Antwort 1 ist richtig)
//   ghafir_teile.csv       Viertel und Hälften jeder Seite (Verse)
//   ghafir_anschluss.csv   Anzahl der Anschlusswörter je Versanfang
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
  // Gleiche Wortzahl wie im Madani-Text: Grenzen direkt nach der Wortzahl
  // (sonst, z. B. bei getrennt geschriebenem „يَا قَوْمِ“, über das Gerüst)
  const counts = frs.map((f) => f.ar.split(/\s+/).filter(Boolean).length);
  const byCount = counts.reduce((x, y) => x + y, 0) === words.length;
  let countSum = 0;
  frs.forEach((f, i) => {
    csvSum += skeleton(f.ar).length;
    countSum += counts[i];
    let end = words.length;
    if (i < frs.length - 1 && byCount) end = countSum;
    else if (i < frs.length - 1) {
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

// --- Stichpunkte und Emojis je Fragment ---
let bullets = 0;
if (existsSync(join(root, "ghafir_geschichte.csv"))) {
  for (const [s, a, f, bullet, emoji] of parseCsv(read("ghafir_geschichte.csv")).slice(1)) {
    if (!/^\d+$/.test(s) || !/^\d+$/.test(a) || !/^\d+$/.test(f)) continue;
    const entry = (fragments[`${+s}:${+a}`] || [])[+f - 1];
    if (!entry) {
      console.warn(`Geschichte ${s}:${a} Fragment ${f}: kein solches Fragment`);
      continue;
    }
    if (bullet) entry.bullet = bullet;
    if (emoji) entry.emoji = emoji;
    bullets++;
  }
}

// --- Unterteile langer Fragmente (nur für die Munāsaba-Aufgabe) ---
let subCount = 0;
if (existsSync(join(root, "ghafir_unterteile.csv"))) {
  const bySub = new Map();
  for (const [s, a, f, t, range, q, bullet, emoji, de] of parseCsv(read("ghafir_unterteile.csv")).slice(1)) {
    if (!/^\d+$/.test(s) || !/^\d+$/.test(a) || !/^\d+$/.test(f) || !/^\d+$/.test(t)) continue;
    const [w0, w1] = range.split("-").map(Number);
    const key = `${+s}:${+a}:${+f}`;
    if (!bySub.has(key)) bySub.set(key, []);
    bySub.get(key)[+t - 1] = { w: [w0, w1 || w0], q, bullet, emoji, de };
  }
  for (const [key, subs] of bySub) {
    const [s, a, f] = key.split(":").map(Number);
    const list = fragments[`${s}:${a}`] || [];
    const entry = list[f - 1];
    const start = f > 1 ? list[f - 2].end + 1 : 1;
    // Unterteile müssen das Fragment genau abdecken
    let next = start;
    const ok = entry && subs.length > 1 && subs.every((x) => x && x.w[0] === next && x.w[1] >= x.w[0] && (next = x.w[1] + 1)) && next === entry.end + 1;
    if (!ok) {
      console.warn(`Unterteile ${key}: decken das Fragment nicht genau ab`);
      continue;
    }
    entry.sub = subs;
    subCount += subs.length;
  }
}

// Wörter (Uthmani) einer Sure je Vers, für die Zuordnung der Lückenwörter
const PAUSE = /[\u06D6-\u06DB]/g;
const bare = (w) => w.replace(PAUSE, "").trim();
const sameWord = (a, b) => bare(a) === bare(b) || (skeleton(a) && skeleton(a) === skeleton(b));

/** Position einer Wortfolge im Vers: [erstes, letztes] Wort (0-basiert) oder null. */
function findWords(words, phrase) {
  let [text, nth] = phrase.split("@");
  nth = +nth || 1;
  const want = text.trim().split(/\s+/);
  let seen = 0;
  for (let i = 0; i + want.length <= words.length; i++) {
    if (want.every((w, j) => sameWord(words[i + j], w)) && ++seen === nth) return [i, i + want.length - 1];
  }
  return null;
}

// --- Lückenwörter ---
const gaps = {};
let gapCount = 0;
if (existsSync(join(root, "ghafir_luecken.csv"))) {
  for (const r of parseCsv(read("ghafir_luecken.csv")).slice(1)) {
    const [s, a, word, de, w1, d1, w2, d2, w3, d3, ctx] = r;
    if (!/^\d+$/.test(s) || !/^\d+$/.test(a) || !word) continue;
    surahWords[+s] = surahWords[+s] || loadSurah(+s);
    const words = surahWords[+s][+a] || [];
    const pos = findWords(words, word);
    if (!pos) {
      console.warn(`Lücke ${s}:${a} „${word}“ nicht im Vers gefunden`);
      continue;
    }
    const wrong = [[w1, d1], [w2, d2], [w3, d3]].filter(([w]) => w);
    if (wrong.length < 3) {
      console.warn(`Lücke ${s}:${a} „${word}“: weniger als drei falsche Wörter`);
      continue;
    }
    const clash = wrong.find(([w]) => findWords(words, w));
    if (clash) console.warn(`Lücke ${s}:${a}: falsches Wort „${clash[0]}“ steht im Vers`);
    (gaps[`${+s}:${+a}`] = gaps[`${+s}:${+a}`] || []).push({ w: pos, de, wrong, ctx: ctx || "" });
    gapCount++;
  }
}

// --- Fragen zum Abschnitt ---
const questions = {};
let questionCount = 0;
if (existsSync(join(root, "ghafir_fragen.csv"))) {
  for (const r of parseCsv(read("ghafir_fragen.csv")).slice(1)) {
    const [s, a, q, ...rest] = r;
    if (!/^\d+$/.test(s) || !/^\d+$/.test(a) || !q) continue;
    const answers = [];
    for (let i = 0; i + 1 < rest.length && answers.length < 4; i += 2) if (rest[i]) answers.push([rest[i], rest[i + 1] || ""]);
    if (answers.length < 4 || new Set(answers.map(([x]) => bare(x))).size < 4) {
      console.warn(`Frage ${s}:${a} „${q}“: keine vier verschiedenen Antworten`);
      continue;
    }
    (questions[`${+s}:${+a}`] = questions[`${+s}:${+a}`] || []).push({ q, a: answers });
    questionCount++;
  }
}

// --- Teile je Seite: { "467": { s: 40, 4: [[1, 3], …], 2: [[1, 4], …] } } ---
const parts = {};
const parseRanges = (txt) =>
  txt
    .split("|")
    .map((x) => x.trim().split("-").map(Number))
    .filter((x) => x[0])
    .map(([a, b]) => [a, b || a]);
if (existsSync(join(root, "ghafir_teile.csv"))) {
  for (const [s, page, q4, q2] of parseCsv(read("ghafir_teile.csv")).slice(1)) {
    if (!/^\d+$/.test(s) || !/^\d+$/.test(page)) continue;
    parts[+page] = { s: +s, 4: parseRanges(q4 || ""), 2: parseRanges(q2 || "") };
  }
}

// --- Anschluss: Wörter am Versanfang ---
const tails = {};
if (existsSync(join(root, "ghafir_anschluss.csv"))) {
  for (const [s, a, n] of parseCsv(read("ghafir_anschluss.csv")).slice(1)) {
    if (/^\d+$/.test(s) && /^\d+$/.test(a) && /^[1-9]$/.test(n)) tails[`${+s}:${+a}`] = +n;
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
    `window.CONTENT_MUNASABA=${JSON.stringify(munasaba)};\n` +
    `window.CONTENT_GAPS=${JSON.stringify(gaps)};\n` +
    `window.CONTENT_QUESTIONS=${JSON.stringify(questions)};\n` +
    `window.CONTENT_PARTS=${JSON.stringify(parts)};\n` +
    `window.CONTENT_TAIL=${JSON.stringify(tails)};\n`
);
console.log(`${dhikr.length} Adhkar, ${quiz.length} Quizfragen, ${texts.length} Texte, ${byVerse.size} Verse mit Fragmenten (${unmatched} Grenzen nur ungefähr), Munāsaba für ${munCount} Fragmente.`);
console.log(`Ghāfir: ${bullets} Stichpunkte, ${subCount} Unterteile, ${gapCount} Lückenwörter, ${questionCount} Fragen, ${Object.keys(parts).length} Seiten mit Teilen, ${Object.keys(tails).length} Anschlüsse.`);
