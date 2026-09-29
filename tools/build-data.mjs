// Erzeugt die Quran-Daten für die App aus dem Datensatz @quran.ws/text
// (KFGQPC Uthmanic Hafs: Text, Wörter, Verse) und dem Seitenlayout der
// Madina-Ausgabe 1405 H (tools/madina1405.mjs: Seiten- und Zeilenumbrüche,
// Schreibweise mit gedehnten Buchstaben, 604 Seiten à 15 Zeilen).
//
//   npm install && npm run build:data
//
// Ausgabe:
//   data/surahs.js          Metadaten aller 114 Suren
//   data/surah/NNN.js       Zeilen jeder Sure: [seite, zeile, art, tokens, darstellung]
//                           token: [vers, text, typ, text in der Ausgabe 1405]
//                           darstellung: { c: 1 } mittig
//   data/quarters.js        Hizb-Viertel: [viertel, seite, zeile (0-basiert)]
//
// Die Dateien sind klassische Skripte (kein JSON), damit die App auch direkt
// per Doppelklick (file://) funktioniert.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadMadina05, relayout } from "./madina1405.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkgDir = join(root, "node_modules/@quran.ws/text");
const d = JSON.parse(readFileSync(join(pkgDir, "data/hafs.json"), "utf8"));

const words = d.words;
const W = words.length;

// Die App nutzt die Schrift KFGQPC Uthmanic Script HAFS v3.0
// (fonts/UthmanicHafs-v-3.0.ttf, unverändert aus @quran.ws/text), die alle
// Zeichen dieser Textfassung kennt. Der Text bleibt darum unverändert.
const fix = (s) => s;

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

// Seiten und Zeilen wie in der Madina-Ausgabe 1405 (tools/madina1405.mjs)
const M = loadMadina05();
const notes = [];
const juzOfVerse = new Map(); // "s:a" → Juz
const placeOfVerse = new Map(); // "s:a" → [seite, zeile] des ersten Tokens
let textLines = 0;

const meta = [];
for (let s = 0; s < 114; s++) {
  const info = d.surahs[s];
  const n = s + 1;
  const firstAyahGlobal = info.first_ayah;
  const oldLines = [];
  for (const li of lineInfo) {
    if (li.surah !== n) continue;
    const tokens = [];
    for (let i = li.start; i < li.end; i++) {
      const ayah = ayahIdxOfWord(i) - firstAyahGlobal + 1;
      if (!juzOfVerse.has(`${n}:${ayah}`)) juzOfVerse.set(`${n}:${ayah}`, juzOfWord(i));
      if (before.has(i)) tokens.push([ayah, before.get(i), 2]);
      tokens.push([ayah, fix(words[i]) + (after.get(i) || ""), 0]);
      const nextAyahStart = ayahStarts[ayahIdxOfWord(i) + 1] ?? W;
      // Versende: ۝ mit der Versnummer, die Schrift v3.0 setzt daraus das Versende-Zeichen
      if (i === nextAyahStart - 1) tokens.push([ayah, "\u06DD" + toArabicDigits(ayah), 1]);
    }
    oldLines.push([li.page, li.line, "t", tokens]);
  }
  const res = relayout(n, oldLines, M);
  notes.push(...res.notes);
  const lines = res.lines;
  const juz = {};
  for (const l of lines) {
    if (l[2] !== "t") continue;
    textLines++;
    for (const t of l[3]) {
      const key = `${n}:${t[0]}`;
      if (!placeOfVerse.has(key)) placeOfVerse.set(key, [l[0], l[1]]);
    }
    if (!(l[0] in juz)) juz[l[0]] = juzOfVerse.get(`${n}:${l[3][0][0]}`);
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
  const [s0, a0] = verseOfWord(start);
  const [s1, a1] = verseOfWord(end);
  return { n: j + 1, start: [s0, a0], end: [s1, a1], p0: placeOfVerse.get(`${s0}:${a0}`)[0], p1: placeOfVerse.get(`${s1}:${a1}`)[0] };
});

writeFileSync(
  join(root, "data/surahs.js"),
  "// Generiert von tools/build-data.mjs – nicht von Hand bearbeiten.\n" +
    "// Quelle: KFGQPC Uthmanic Hafs via @quran.ws/text (CC BY 4.0); Seiten der Madina-Ausgabe 1405\n" +
    "// aus quran-madina-html (Waqf General Public License 2.0).\n" +
    `window.QURAN_BASMALA=${JSON.stringify(basmala)};\n` +
    `window.QURAN_BASMALA_1405=${JSON.stringify(M.suras[1].ayas[1].r[0].t)};\n` +
    `window.QURAN_SURAHS=${JSON.stringify(meta)};\n` +
    `window.QURAN_JUZ=${JSON.stringify(juzMeta)};\n`
);

// Hizb-Viertel: Zeile, in der der erste Vers des Viertels beginnt
const quarters = JSON.parse(readFileSync(join(root, "tools/vendor/quarters-hafs.json"), "utf8")).map(([q, s, a]) => {
  const [page, line] = placeOfVerse.get(`${s}:${a}`);
  return [q, page, line - 1];
});
writeFileSync(
  join(root, "data/quarters.js"),
  "// Generiert von tools/build-data.mjs – nicht von Hand bearbeiten.\n" +
    "// Hizb-Viertel: [Viertel 1–240, Seite, Zeile (0-basiert)] im Layout der Madina-Ausgabe 1405.\n" +
    "// Viertelanfänge aus quran-meta 7.0.0 (MIT License, Copyright (c) 2020 Quran-Center).\n" +
    `window.QURAN_QUARTERS=${JSON.stringify(quarters)};\n`
);

for (const note of notes) console.log("Hinweis:", note);
console.log(`114 Suren geschrieben, ${W} Wörter, ${textLines} Textzeilen (Ausgabe 1405).`);
