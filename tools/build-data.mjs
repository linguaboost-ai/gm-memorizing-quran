// Erzeugt die Quran-Daten für die App aus dem Datensatz @quran.ws/text
// (KFGQPC Uthmanic Hafs, Seiten- und Zeilenumbrüche des Medina-Mushaf, 604 Seiten à 15 Zeilen).
//
//   npm install && npm run build:data
//
// Ausgabe:
//   data/surahs.js          Metadaten aller 114 Suren
//   data/surah/NNN.js       Zeilen jeder Sure: [seite, zeile, art, tokens]
//
// Die Dateien sind klassische Skripte (kein JSON), damit die App auch direkt
// per Doppelklick (file://) funktioniert.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkgDir = join(root, "node_modules/@quran.ws/text");
const d = JSON.parse(readFileSync(join(pkgDir, "data/hafs.json"), "utf8"));

const words = d.words;
const W = words.length;

// Die Schrift im Repository (KFGQPC Uthmanic Script HAFS v0.09) kennt einige
// Zeichen der neueren Textfassung nicht (sie erscheinen als Platzhalter):
//   offene Tanwīn (U+08F0–08F2)            → normale Tanwīn
//   Kasra + kleines Mīm unten (U+06ED)      → Kasratain (Tanwīn bleibt erkennbar)
//   kleines Sīn unten (U+06E3, ein Wort)    → entfällt
const FIX = { "ࣰ": "ً", "ࣱ": "ٌ", "ࣲ": "ٍ" };
const fix = (s) =>
  s
    .replace(/[ࣰ-ࣲ]/g, (c) => FIX[c])
    .replace(/ِۭ/g, "ٍ")
    .replace(/[ۭۣ]/g, "");

const toArabicDigits = (n) => String(n).replace(/\d/g, (c) => "٠١٢٣٤٥٦٧٨٩"[c]);

// Zeichen (Waqf, ۞, ۩) wieder an die Wörter hängen
const after = new Map();
const before = new Map();
for (const [pos, t] of d.marks) {
  const m = d.mark_types[t];
  const map = m.side === "after" ? after : before;
  map.set(pos, (map.get(pos) || "") + m.sign);
}

const upperBound = (arr, x) => {
  let lo = 0, hi = arr.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (arr[mid] <= x) lo = mid + 1; else hi = mid; }
  return lo;
};

const surahStarts = d.surah_starts;
const ayahStarts = d.ayah_starts;
const pageStarts = d.page_starts;
const lineStarts = d.line_starts;
const juzStarts = d.juz_starts;

const surahOfWord = (i) => upperBound(surahStarts, i) - 1; // 0-basiert
const ayahIdxOfWord = (i) => upperBound(ayahStarts, i) - 1; // global, 0-basiert
const pageOfWord = (i) => upperBound(pageStarts, i); // 1-basiert
const juzOfWord = (i) => upperBound(juzStarts, i);

const lineSet = new Set(lineStarts);
for (const s of surahStarts) if (!lineSet.has(s)) throw new Error("Sure beginnt nicht am Zeilenanfang: " + s);

// Zeilennummer (1–15) inkl. Kopfzeile und Basmala je Seite berechnen
const hasBasmalaLine = (n) => n !== 1 && n !== 9; // Al-Fātiḥa: Basmala ist Vers 1
const lineInfo = []; // pro Textzeile: {page, line, start, end, headerLines}
{
  let curPage = 0, lineNo = 0;
  for (let k = 0; k < lineStarts.length; k++) {
    const start = lineStarts[k];
    const end = k + 1 < lineStarts.length ? lineStarts[k + 1] : W;
    const page = pageOfWord(start);
    if (page !== curPage) { curPage = page; lineNo = 0; }
    const sIdx = surahOfWord(start);
    if (surahOfWord(end - 1) !== sIdx) throw new Error("Zeile mit zwei Suren: " + k);
    const header = surahStarts[sIdx] === start;
    let headerAt = null, basmalaAt = null;
    if (header) {
      headerAt = ++lineNo;
      if (hasBasmalaLine(sIdx + 1)) basmalaAt = ++lineNo;
    }
    lineInfo.push({ page, line: ++lineNo, start, end, surah: sIdx + 1, headerAt, basmalaAt });
  }
}

const basmala = [0, 1, 2, 3].map((i) => fix(words[i])).join(" ");

const GERMAN = [
  "Die Eröffnende", "Die Kuh", "Die Sippe Imrans", "Die Frauen", "Der Tisch", "Das Vieh", "Die Höhen",
  "Die Beute", "Die Reue", "Yunus", "Hud", "Yusuf", "Der Donner", "Ibrahim", "Al-Hidschr", "Die Bienen",
  "Die Nachtreise", "Die Höhle", "Maryam", "Ta-Ha", "Die Propheten", "Die Pilgerfahrt", "Die Gläubigen",
  "Das Licht", "Die Unterscheidung", "Die Dichter", "Die Ameisen", "Die Geschichte", "Die Spinne",
  "Die Römer", "Luqman", "Die Niederwerfung", "Die Gruppierungen", "Saba", "Der Erschaffer", "Ya-Sin",
  "Die sich Reihenden", "Sad", "Die Scharen", "Der Vergebende", "Ausführlich dargelegt", "Die Beratung",
  "Der Prunk", "Der Rauch", "Die Kniende", "Die Sanddünen", "Muhammad", "Der Sieg", "Die Gemächer", "Qaf",
  "Die Aufwirbelnden", "Der Berg", "Der Stern", "Der Mond", "Der Allerbarmer", "Das eintreffende Ereignis",
  "Das Eisen", "Die Streitende", "Die Versammlung", "Die Geprüfte", "Die Reihe", "Der Freitag",
  "Die Heuchler", "Die Übervorteilung", "Die Scheidung", "Das Verbot", "Die Herrschaft", "Das Schreibrohr",
  "Die fällige Stunde", "Die Aufstiegswege", "Nuh", "Die Dschinn", "Der Eingehüllte", "Der Zugedeckte",
  "Die Auferstehung", "Der Mensch", "Die Entsandten", "Die Kunde", "Die Entreißenden",
  "Er runzelte die Stirn", "Das Umschlingen", "Das Zerbrechen", "Die das Maß Kürzenden", "Das Zerreißen",
  "Die Türme", "Der Nachtstern", "Der Höchste", "Die Überdeckende", "Die Morgendämmerung", "Die Ortschaft",
  "Die Sonne", "Die Nacht", "Der Vormittag", "Das Weiten", "Die Feige", "Das Anhängsel", "Die Bestimmung",
  "Der klare Beweis", "Das Beben", "Die Rennenden", "Das Verhängnis", "Die Vermehrung", "Das Zeitalter",
  "Der Stichler", "Der Elefant", "Die Quraisch", "Die Hilfeleistung", "Die Fülle", "Die Ungläubigen",
  "Die Hilfe", "Die Palmfasern", "Die Aufrichtigkeit", "Das Frühlicht", "Die Menschen",
];

mkdirSync(join(root, "data/surah"), { recursive: true });

const meta = [];
for (let s = 0; s < 114; s++) {
  const info = d.surahs[s];
  const n = s + 1;
  const firstAyahGlobal = info.first_ayah;
  const lines = [];
  const juz = {};
  for (const li of lineInfo) {
    if (li.surah !== n) continue;
    if (li.headerAt) lines.push([li.page, li.headerAt, "h"]);
    if (li.basmalaAt) lines.push([li.page, li.basmalaAt, "b"]);
    const tokens = [];
    for (let i = li.start; i < li.end; i++) {
      const ayah = ayahIdxOfWord(i) - firstAyahGlobal + 1;
      if (before.has(i)) tokens.push([ayah, before.get(i), 2]);
      tokens.push([ayah, fix(words[i]) + (after.get(i) || "")]);
      const nextAyahStart = ayahStarts[ayahIdxOfWord(i) + 1] ?? W;
      if (i === nextAyahStart - 1) tokens.push([ayah, toArabicDigits(ayah), 1]);
    }
    lines.push([li.page, li.line, "t", tokens]);
    juz[li.page] = juzOfWord(li.start);
  }
  // Seiten 1 und 2 haben nur 8 Zeilen, zählen aber als ganze Seite
  const height = (page) => (page <= 2 ? 15 / 8 : 1);
  const pos = ([page, line]) => (page - 1) * 15 + (line - 1) * height(page);
  const first = lines[0], last = lines[lines.length - 1];
  const size = (pos(last) + height(last[0]) - pos(first)) / 15;
  meta.push({
    n,
    ar: info.name_ar,
    tr: info.name_en,
    de: GERMAN[s],
    ayahs: info.ayah_count,
    rev: info.revelation === "madani" ? "Medina" : "Mekka",
    p0: first[0],
    p1: last[0],
    size: Math.round(size * 100) / 100,
  });
  const file = `window.QURAN_SURAH_DATA=window.QURAN_SURAH_DATA||{};QURAN_SURAH_DATA[${n}]=${JSON.stringify({ n, juz, lines })};\n`;
  writeFileSync(join(root, `data/surah/${String(n).padStart(3, "0")}.js`), file);
}

// Juz: Anfang und Ende (Sure, Vers) sowie Seiten
const verseOfWord = (i) => {
  const s = surahOfWord(i);
  return [s + 1, ayahIdxOfWord(i) - d.surahs[s].first_ayah + 1];
};
const juzMeta = juzStarts.map((start, j) => {
  const end = (juzStarts[j + 1] ?? W) - 1;
  return { n: j + 1, start: verseOfWord(start), end: verseOfWord(end), p0: pageOfWord(start), p1: pageOfWord(end) };
});

writeFileSync(
  join(root, "data/surahs.js"),
  "// Generiert von tools/build-data.mjs – nicht von Hand bearbeiten.\n" +
    "// Quelle: KFGQPC Uthmanic Hafs via @quran.ws/text (CC BY 4.0).\n" +
    `window.QURAN_BASMALA=${JSON.stringify(basmala)};\n` +
    `window.QURAN_SURAHS=${JSON.stringify(meta)};\n` +
    `window.QURAN_JUZ=${JSON.stringify(juzMeta)};\n`
);

console.log(`114 Suren geschrieben, ${W} Wörter, ${lineInfo.length} Textzeilen.`);
