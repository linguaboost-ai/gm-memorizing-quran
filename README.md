# German Method – Qur'an auswendig lernen

Web-App zum Auswendiglernen des Qur'an im Layout des Madani-Mushaf (blaue
Ausgabe), mit Rezitation, schrittweisem Ausgrauen und Übungen zum Abschnitt
in den Pausen. Gestaltet nach dem Design-Kit
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

## Startseite

Nur eine Auswahl – **Juz**, **Sure** (mit Versanfang und Versende; bei einer
neuen Sure ist sie von Anfang bis Ende gewählt) oder **Seite**. Jede Zeile ist
zunächst einzeilig und klappt erst beim Antippen auf; gilt immer die zuletzt
gewählte. „Weiter zur Seite“ öffnet die Seitenauswahl im gewählten Bereich.
Darunter der Link **Testen** (immer Sure Ghāfir, auch `index.html?test`).

## Seitenauswahl

Man blättert durch die Seiten des Bereichs (Pfeile, Pfeiltasten) und wählt
über der Seite **Viertel – Hälfte – ganze Seite**. Beim Überfahren mit der Maus
wird der Teil markiert (eine Farbe), ein Klick (am Handy: Antippen) startet
sofort das Auswendiglernen.

Die Teile sind ganze Verse und sollen sinnvolle Blöcke sein: Für Ghāfir legt
`ghafir_teile.csv` Viertel und Hälften jeder Seite inhaltlich fest; sonst
werden die Verse nach Wortzahl geteilt, wobei ein Teil nie mit einem sehr
kurzen Vers (z. B. حمٓ) endet.

## Ablauf eines Teils

1. **Auswendiglernen** – die ganze Mushaf-Seite: der Abschnitt schwarz, der
   Anfang des nächsten Verses blau als Anschluss (ein bis drei Wörter, die
   zusammen Sinn ergeben, z. B. ٱلَّذِينَ يَحۡمِلُونَ ٱلۡعَرۡشَ –
   `ghafir_anschluss.csv`), alle übrigen Wörter der Seite fast unsichtbar
   (Deckkraft 0,05). Endet der Teil am Seitenende, steht die Folgeseite mit
   dem Anschluss darunter. „Weiter“ graut bei jedem Wort – auch beim Anschluss –
   ein Fünftel der Zeichen aus, „Zurück“ holt es wieder. Dann:
   - **1 Minute Lückentext**: Auf der leeren Seite erscheint der Abschnitt der
     Reihe nach, Vers bzw. Versfragment (geteilt an ۘ ۚ ۖ ۗ) mit je einer Lücke.
     Darunter die Übersetzung des Fragments und vier Wörter mit Übersetzung –
     möglichst bekannte Wörter (`ghafir_luecken.csv`). 5–10 Lücken, verteilt
     über den Abschnitt; am Ende ist der ganze Abschnitt zu sehen. Ist alles
     eingesetzt, verschwindet der Text und der Timer läuft groß weiter; ist die
     Zeit vorher um, geht es direkt zur Wiederholung.
   - **2 Minuten Fragen** zum Abschnitt (`ghafir_fragen.csv`, dazu Wortfragen
     aus den Lückenwörtern): Frage deutsch, Antworten arabisch, mit
     eingeschalteter Übersetzung in Klammern. Der Abschnitt bleibt sichtbar
     (mit oder ohne Übersetzung). Es geht weiter, bis die Zeit um ist.
   - **4 Minuten Munāsaba**: Fragen, deren Antwort ein Vers/Fragment ist
     (Munāsaba-Fragen aus `ghafir_munasaba.csv`), in zufälliger Reihenfolge;
     das passende Fragment wird angetippt und bekommt rechts sein Emoji (mit
     Übersetzung, falls eingeschaltet). Danach verschwinden die Fragmente, ihre
     Stichpunkte mit Emoji (`ghafir_geschichte.csv`) stehen gemischt da und
     werden in die richtige Reihenfolge gebracht, zum Schluss nur noch die
     Emojis. 5–10 Teile: In kurzen Abschnitten werden lange Fragmente in
     sinnvolle Unterteile geteilt (`ghafir_unterteile.csv`), bei mehr als zehn
     werden benachbarte zusammengelegt. Die Aufgabe wird zu Ende geführt, auch wenn die Zeit
     vorher abläuft.
   - Nach jeder Pause: **Wiederholung** aus dem Gedächtnis.
2. **Abschluss** – freiwillige Notizen: Was kann ich in 24 Stunden, in sieben
   Tagen, in meinem Leben umsetzen?

Für Suren ohne eigene Inhalte bleiben die allgemeinen Pausen: Dhikr
(`dhikr.csv`), Quiz zur Sīra (`test_quiz.csv`) und Lesetext (`text_quiz.txt`).

Die Vorbereitung mit Emojis, Reihenfolge und Munāsaba zwischen den Fragmenten
(1a–1c, Fragment-Ansicht; Code in `js/prep.js`) ist vorerst nicht im Ablauf.

Rezitation: Die Verse werden lückenlos abgespielt (Web Audio, Stille zwischen
den Versdateien gekürzt); der Anschluss wird nach seinem letzten Wort über 100 ms
ausgeblendet (das Wortende wird geschätzt).

Auswahl, laufende Sitzungen, Timer und Notizen werden im Browser gespeichert
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

Die Inhaltsdateien im Stammverzeichnis werden in `data/content.js` übersetzt
(Semikolon-getrennt, erste Zeile ist die Kopfzeile):

| Datei | Inhalt |
| --- | --- |
| `dhikr.csv`, `test_quiz.csv`, `text_quiz.txt` | allgemeine Pausen (Suren ohne eigene Inhalte) |
| `ghafir.csv` | Fragmente je Vers mit Übersetzung (und ursprünglichem Emoji) |
| `ghafir_munasaba.csv` | Munāsaba je Fragment: Aussage und Frage, die das nächste Fragment beantwortet |
| `ghafir_geschichte.csv` | Stichpunkt und Emoji je Fragment (Munāsaba-Aufgabe) |
| `ghafir_unterteile.csv` | Unterteile langer Fragmente für die Munāsaba-Aufgabe (Wörter im Vers, Frage, Stichpunkt, Emoji, Übersetzung), damit auch ein Viertel mindestens 5 Teile hat |
| `ghafir_luecken.csv` | Lückenwörter je Vers: Wort wie im Vers, Übersetzung, drei falsche Wörter mit Übersetzung, Alltagsbezug |
| `ghafir_fragen.csv` | Fragen je Vers: deutsch, richtige Antwort zuerst, je mit Übersetzung |
| `ghafir_teile.csv` | Viertel und Hälften jeder Seite (Versbereiche, z. B. `1-3 \| 4 \| 5-6 \| 7`) |
| `ghafir_anschluss.csv` | Anzahl der Anschlusswörter (1–3) am Anfang jedes Verses |

Lückenwörter werden über ihre Schreibweise den Wörtern des Verses zugeordnet
(`@2` = zweites Vorkommen); `npm run build:content` meldet Wörter, die nicht
gefunden werden.

`ghafir_munasaba.csv` enthält pro Fragment (Nummerierung wie in `ghafir.csv`
innerhalb des Verses) eine Aussage und eine Frage, die das nächste Fragment
beantwortet; Fragment 0 von Vers 1 ist der Einstieg vor dem ersten Fragment.
Erstellt aus `f-a_biqai-old.txt` und `ghafir_biqai.txt`.

```bash
npm install
npm run build:data      # Qur'an-Daten (nur bei Bedarf)
npm run build:content   # Inhalte (Adhkar, Quiz, Texte, Ghāfir)
```

## Aufbau

| Pfad | Inhalt |
| --- | --- |
| `index.html` | Einstieg |
| `css/app.css` | Design (German Method) und Madani-Mushaf |
| `js/quran.js` | Daten, Seiten, Suren, Seitenteile, Anschluss |
| `js/mushaf.js` | Darstellung der Mushaf-Seite (Zeilen, Ausgrauen) |
| `js/ornaments.js` | Rahmen, Flechtband, Banner, Medaillons als SVG-Pfade |
| `js/fade.js` | Ausgrauen in Fünfteln |
| `js/player.js` | Rezitatoren und lückenlose Wiedergabe |
| `js/prep.js` | Fragmente; Vorbereitung (Emojis, Auswahlrad, Munāsaba) – derzeit nicht im Ablauf |
| `js/exercises.js` | Pausen: Lückentext, Fragen, Munāsaba-Aufgabe |
| `js/activities.js` | Allgemeine Pausen: Dhikr, Quiz, Lesetext |
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
