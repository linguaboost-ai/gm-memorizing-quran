# German Method – Qur'an auswendig lernen

Web-App zum Auswendiglernen des Qur'an im Layout des Madani-Mushaf (blaue
Ausgabe), mit Rezitation, Vorbereitung über Versfragmente, schrittweisem
Ausgrauen und sinnvoll gefüllten Pausen. Gestaltet nach dem Design-Kit
„Quran verstehen lernen“ (`design-kit.zip`: Farben, DM Sans, weiße Karten,
schwarze Hauptknöpfe, Richtig/Falsch mit Farbe und Symbol), das auf den
„German Method – In-App-Käufe Screens“ beruht.

Der Mushaf ist im Stil des blauen Madani-Mushafs gestaltet (übernommen aus
[gm-quran-progress](https://github.com/linguaboost-ai/gm-quran-progress),
`js/ornaments.js`): weißer Seitenrand, hellblaue Textfläche (#F0FAFF), blauer
Rahmen mit Flechtband und Goldlinien, Eckrosetten, Kopfzeile mit Juz und
Surenname, Seitenzahl im Medaillon, Hizb-Marken am Rand und das blau-goldene
Surenbanner – alles als SVG-Pfade, Farben als CSS-Variablen (`--mp-*`).

Seiten, Zeilen und Schriftbild folgen der Madina-Ausgabe 1405 H (wie auf
quranacademy.org und quran.com): gleiche Seiten- und Zeilenumbrüche, die
Schreibweise mit gedehnten Buchstaben (Tatweel) und die Schrift KFGQPC HAFS
v1.001 mit ihren Sonderformen (gestreckte Kāf, übereinander gesetzte
Buchstaben). `tools/madina1405.mjs` ordnet beim `npm run build:data` jedem Wort
Seite, Zeile und Schreibweise der Ausgabe 1405 zu (Daten aus quran-madina-html).
In der App wird jede Zeile wie dort mit einfachem Leerzeichen gesetzt und
waagerecht auf die Satzbreite gestreckt bzw. gestaucht (`Mushaf.fit`). Kurze
Schlusszeilen stehen mittig; auf den Seiten 1 und 2 folgt die Zeilenbreite dem
Oval. Die Versende-Medaillons kommen aus der Schrift v3.0.

## Der Plan

Ein Schritt pro Screen:

1. **Welche Sure?** Liste aller 114 Suren mit Suche (Name oder Nummer).
2. **An welchen Tagen?** Wochentage zum Ankreuzen (Mehrfachauswahl).
3. **Wie viel pro Tag?** ¼, ½, 1, 1½ oder 2 Seiten, mit Übersicht.

Gelernt wird in **Seitenvierteln**: Jede Mushaf-Seite wird in vier etwa gleich
große Teile aus ganzen Versen geteilt (bei nur drei Versen in drei Teile);
teilen sich mehrere Suren eine Seite, zählen nur die Verse der gewählten Sure.
Die Tage bestehen aus so vielen Vierteln, wie es der Tagesmenge entspricht, und
werden auf die gewählten Wochentage verteilt.

Die Startseite hat vier Tabs: **Heute** (Tagespensum), **Plan** (alle
Lerntage), **Notizen** und **Einstellungen**.

## Zum Testen

Über „Zum Testen: freie Auswahl“ (oder `index.html?test`), je ein Screen:
Sure → Seite → Bereich (Viertel). Die Seite wird klein dargestellt; beim
Überfahren mit der Maus wird das jeweilige Viertel hervorgehoben. Im Testmodus lassen sich alle Schritte frei
ansteuern, Timer können übersprungen werden.

## Ablauf eines Seitenviertels

1. **Auswendiglernen** – die ganze Mushaf-Seite: der Abschnitt schwarz, die
   ersten drei Wörter des nächsten Verses blau als Anschluss, alle übrigen Wörter
   der Seite fast unsichtbar (Deckkraft 0,05; Surenbanner, Kopfzeile und Marken
   bleiben). „Weiter“ graut bei jedem Wort ein Fünftel der Zeichen aus
   (Deckkraft 0,05; Buchstaben und Harakat einzeln, Shadda doppelt, abgerundet),
   „Zurück“ holt es wieder. Nach fünf Schritten ist alles ausgegraut. Dann:
   - **1 Minute Dhikr** (`dhikr.csv`): „Los geht's“ startet den Timer, danach
     „Ich habe … Mal geschafft.“ → Wiederholung
   - **2 Minuten Quiz** im „Wer wird Millionär“-Stil (`test_quiz.csv`), danach
     „Das habe ich heute Neues gelernt.“ → Wiederholung
   - **4 Minuten Lesetext** mit Frage (`text_quiz.txt`), danach „Das nehme ich
     von der Geschichte mit.“ → Wiederholung
2. **Abschluss** – freiwillige Notizen: Was kann ich in 24 Stunden, in sieben
   Tagen, in meinem Leben umsetzen?

Die Vorbereitung mit Emojis, Reihenfolge und Munāsaba (1a–1c, Fragment-Ansicht;
Code in `js/prep.js`, Inhalte aus `ghafir.csv` und `ghafir_munasaba.csv`) ist
vorerst aus dem Ablauf genommen (`PREP_ENABLED` in `js/app.js`) und kommt später
an anderer Stelle wieder.

Rezitation: Die Verse werden lückenlos abgespielt (Web Audio, Stille zwischen
den Versdateien gekürzt); der Anschluss wird nach dem dritten Wort über 100 ms
ausgeblendet (das Wortende wird geschätzt).

Fortschritt, laufende Timer und Notizen werden im Browser gespeichert
(`localStorage`).

## Lokal starten

Die App ist rein statisch (keine Build-Schritte nötig):

```bash
npx serve .
```

`index.html?timer=5` verkürzt jede Pause auf 5 Sekunden.

**Audio:** Auf Vercel werden die Versdateien über `/audio/…` (everyayah.com) und
`/audio-alt/…` (cdn.islamic.network) von der eigenen Domain ausgeliefert
(`vercel.json`). Lokal fehlt diese Weiterleitung; dann spielt die App die Verse
über ein normales `<audio>`-Element nacheinander.

## Inhalte ändern

Die Inhaltsdateien im Stammverzeichnis (`dhikr.csv`, `test_quiz.csv`,
`text_quiz.txt`, `ghafir.csv`, `ghafir_munasaba.csv`) werden in
`data/content.js` übersetzt:

`ghafir_munasaba.csv` enthält pro Fragment (Nummerierung wie in `ghafir.csv`
innerhalb des Verses) eine Aussage und eine Frage, die das nächste Fragment
beantwortet; Fragment 0 von Vers 1 ist der Einstieg vor dem ersten Fragment.
Erstellt aus `f-a_biqai-old.txt` und `ghafir_biqai.txt`.

```bash
npm install
npm run build:data      # Qur'an-Daten (nur bei Bedarf)
npm run build:content   # Adhkar, Quiz, Texte, Fragmente, Munāsaba
```

## Aufbau

| Pfad | Inhalt |
| --- | --- |
| `index.html` | Einstieg |
| `css/app.css` | Design (German Method) und Madani-Mushaf |
| `js/quran.js` | Daten, Seiten, Suren, Seitenviertel, Tagesplan |
| `js/mushaf.js` | Darstellung der Mushaf-Seite (Zeilen, Ausgrauen) |
| `js/ornaments.js` | Rahmen, Flechtband, Banner, Medaillons als SVG-Pfade |
| `js/fade.js` | Ausgrauen in Fünfteln |
| `js/player.js` | Rezitatoren und lückenlose Wiedergabe |
| `js/prep.js` | Vorbereitung: Fragmente, Emojis, Auswahlrad, Munāsaba, Fragment-Ansicht |
| `js/activities.js` | Pausen: Dhikr, Quiz, Lesetext |
| `js/app.js` | Screens, Plan, Testmodus, Ablauf |
| `data/` | Generierte Daten |
| `tools/` | Skripte zum Erzeugen der Daten, `madina1405.mjs` für Seiten und Zeilen der Ausgabe 1405 |
| `fonts/KFGQPC-HAFS-Uthmanic-v1.001.woff2` | Mushaf-Schrift: KFGQPC HAFS Uthmanic Script v1.001 (Lizenz: `fonts/WAQF-LICENSE-Hafs-v1.001.md`) |
| `fonts/UthmanicHafs-v-3.0.ttf` | Schrift: KFGQPC Uthmanic Script HAFS v3.0 (unverändert) |
| `data/quarters.js` | Hizb-Viertel (Seite, Zeile) für die Randmarken |
| `fonts/` | DM Sans (SIL Open Font License, siehe `fonts/OFL-DMSans.txt`) |

## Quellen

- Qur'an-Text (Wörter, Verse, Juz): King Fahd Glorious Qur'an Printing
  Complex (KFGQPC Uthmanic Hafs), aufbereitet von
  [quran-text / quran.ws](https://github.com/quran-ws/quran-text), CC BY 4.0.
  Dieser Text bleibt die Grundlage (Ausgrauen, Rezitation, Übungen).
- Seiten, Zeilen und Schreibweise der Madina-Ausgabe 1405 sowie die Schrift
  KFGQPC HAFS Uthmanic Script v1.001: [quran-madina-html](https://github.com/tarekeldeeb/quran-madina-html)
  1.0.1 („Madina05-Hafs“, `tools/vendor/madina05`), „Waqf“ General Public
  License 2.0 (siehe `tools/vendor/madina05/LICENSE.md`). Schrift © King Fahd
  Glorious Qur'an Printing Complex.
- Schrift: KFGQPC Uthmanic Script HAFS v3.0, © King Fahd Glorious Qur'an Printing
  Complex, unverändert aus `@quran.ws/text` (darf unverändert genutzt und
  weitergegeben werden).
- Hizb-Viertel: [quran-meta](https://github.com/quran-center/quran-meta) 7.0.0,
  MIT License, Copyright (c) 2020 Quran-Center (`tools/vendor/quarters-hafs.json`);
  Seite und Zeile werden für die Ausgabe 1405 neu berechnet.
- Rezitationen: [everyayah.com](https://everyayah.com), ersatzweise
  [cdn.islamic.network](https://alquran.cloud).
