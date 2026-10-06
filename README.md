# German Method – Qur'an auswendig lernen

Web-App zum Auswendiglernen des Qur'an im Layout des Madani-Mushaf (blaue
Ausgabe), mit Rezitation, schrittweisem Ausgrauen, Pausen-Aufgaben,
Ordnen der Schlüsselwörter und einem Tresor für schwierige Stellen. Gestaltet nach dem Design-Kit
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
sofort das Auswendiglernen – ohne Vorbereitung. Über der Seite steht, welche
Teile sie hat (z. B. „Viertel · Viertel · Viertel“).

Damit die Einteilung glatt aufgeht, wird gerundet: Die Zahl der Teile ergibt
sich aus dem Anteil der Seite, den der Bereich füllt (Kopfzeile und Basmala
zählen mit). Unter 37,5 % ist es ein Viertel, bis 62,5 % eine Hälfte, darüber
drei Viertel, ab 87,5 % eine ganze Seite. Die erste Seite von Ghāfir füllt
die Sure nur zu drei Vierteln – sie hat deshalb drei Viertel, zwei Hälften
oder als „ganze Seite“ ein Dreiviertel. Ist eine Sure gewählt, enthält kein
Teil ein Stück der nächsten Sure, und der Anschluss endet am Ende der Sure.

Die Teile sind ganze Verse, möglichst gleich lang und sinnvolle Blöcke: Für
Ghāfir legt `ghafir_teile.csv` Viertel und Hälften jeder Seite fest (wenn die
Zahl der Teile passt) – nach Zeilen ausgewogen, ohne einen Satz zu trennen,
der über das Versende weiterläuft, wo es sich vermeiden lässt (z. B. Seite 468:
8–9 | 10–11 | 12–13 | 14–16 mit je 3,4–4 Zeilen). Sonst werden die Verse nach
Wortzahl geteilt, wobei ein Teil nie mit einem sehr kurzen Vers (z. B. حمٓ)
endet.

## Ablauf eines Teils

1. **Auswendiglernen** – die ganze Mushaf-Seite: der Abschnitt schwarz, der
   Anfang des nächsten Verses blau als Anschluss (ein bis drei Wörter, die
   zusammen Sinn ergeben, z. B. ٱلَّذِينَ يَحۡمِلُونَ ٱلۡعَرۡشَ –
   `ghafir_anschluss.csv`), alle übrigen Wörter der Seite fast unsichtbar
   (Deckkraft 0,05). Endet der Teil am Seitenende, steht die Folgeseite mit
   dem Anschluss darunter. „Weiter“ graut bei jedem Wort – auch beim Anschluss –
   ein Fünftel der Zeichen aus, „Zurück“ holt es wieder.
2. **Nachbereitung** – drei Runden aus Pause, Wiederholung und Ordnen:
   - **1 Minute Dhikr:** zufällige Adhkar aus `dhikr.csv` als Aufgabe mit
     Anzahl – lange 3 Mal, mittlere 7 Mal, kurze 10 Mal (z. B. die Salawat
     10 Mal). Mitzählen per Antippen oder direkt „… Mal gemacht“ bestätigen,
     dann kommt der nächste, bis die Minute um ist. Danach geht es von selbst
     zur **Wiederholung** aus dem Gedächtnis, dann zu **Zuordnen**: Die
     Versstücke stehen in der richtigen Reihenfolge untereinander, mit
     Pfeilen dazwischen, rechts oben an jedem ein freies Feld. Darüber die
     Kästchen „Deutsch EMOJI Arabisch“ (gemischt, beim Scrollen sichtbar); sie
     werden auf ihr Versstück gezogen oder erst das Kästchen, dann das Feld
     angetippt. Falsche springen zurück. Alle Kästchen und Felder sind gleich
     groß (passend für das größte; am Handy zwei nebeneinander).
   - **2 Minuten Quiz** zur Sīra („Wer wird Millionär“, `test_quiz.csv`) →
     Wiederholung → **Ordnen 2**: „Deutsch EMOJI Arabisch“ ohne Versstück.
   - **4 Minuten Lesetext** mit drei Fragen (`text_quiz.txt`) → Wiederholung →
     **Ordnen 3**: nur die Emojis.
   - Ordnen 2 und 3 gehen von oben nach unten: Unten ist ein Auswahlrad (weiches
     Scrollfenster: wischen, Mausrad, Pfeile), der mittlere Eintrag wird mit
     „Einsetzen“ oder durch Hochziehen in die gesuchte Zeile gesetzt. Falsche
     Einträge springen zurück – eine falsche Reihenfolge ist nicht möglich.
3. **Zusammenhang** – die Verse Fragment für Fragment (arabisch, Übersetzung,
   Schlüsselwörter) mit den Übergängen nach al-Biqāʿī: was davor kam, zwischen
   den Versen, innerhalb eines Verses (hinter dem passenden Fragment) und wie es
   weitergeht (`ghafir_vorbereitung.md`).
4. **Abschluss** – freiwillige Notizen: Was kann ich in 24 Stunden, in sieben
   Tagen, in meinem Leben umsetzen?

Ordnen und Zusammenhang gibt es für Abschnitte mit Inhalten (derzeit Ghāfir);
bei anderen Suren folgen auf die Pausen nur die Wiederholungen.

Die Schlüsselwörter stammen aus `ghafir_vorbereitung.md` – höchstens fünf je
Viertel (zehn je Hälfte, zwanzig je Seite). Gibt es mehr, bleibt das erste
jedes Verses, die übrigen werden so gewählt, dass sie den Abschnitt möglichst
gleichmäßig teilen; im Zusammenhang erscheinen dieselben. Ihr Versstück reicht vom Anfang des Fragments, in dem sie stehen
(beim ersten Schlüsselwort eines Verses vom Versanfang), bis vor das Stück des
nächsten Schlüsselworts; das letzte endet mit dem Vers.

## Tresor

Passiert beim Wiederholen ein Fehler, tippt man auf das Wort (mit „Text zum
Prüfen zeigen“ lässt sich der ausgegraute Text dafür einblenden; auch im
Zusammenhang sind die Wörter antippbar). Ein Blatt bietet an: **Wort**,
**mehrere Wörter** (danach das letzte Wort im selben Vers antippen),
**Fragment** (bis zum Pausenzeichen) oder **ganzer Vers** in den Tresor – oder
ab diesem Vers anhören. Kommt dieselbe Stelle wieder hinein, zählt der Tresor
einen Fehler mehr. Stellen im Tresor sind im Mushaf rot unterlegt.

Der Tresor (Startseite und nach jedem Teil) listet die Stellen, die mit den
meisten Fehlern zuerst: anhören, üben, „Sitzt – entfernen“. Beim **Üben** steht
der Anfang des Verses (bzw. das Ende des vorigen) da, die Stelle ist verdeckt:
aufsagen, aufdecken, dann „Gewusst“ oder „Wieder Fehler“. Nach drei Mal
„Gewusst“ in Folge gilt eine Stelle als sitzend und rückt nach unten.

Die frühere Vorbereitung (Lesen, Zuordnen) und die Ghāfir-Pausen (Lückentext,
Fragen zum Abschnitt, Munāsaba-Aufgabe) sind nicht mehr im Ablauf; ihr Code
(`js/prep.js`, `js/exercises.js`) und ihre Inhalte bleiben erhalten.

Rezitation: Die Verse werden lückenlos abgespielt (Web Audio, Stille zwischen
den Versdateien gekürzt); der Anschluss wird nach seinem letzten Wort über 100 ms
ausgeblendet (das Wortende wird geschätzt).

Auswahl, laufende Sitzungen, Timer, Notizen und der Tresor werden im Browser
gespeichert (`localStorage`).

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
| `dhikr.csv` | Adhkar für die 1-Minuten-Pause (Anzahl 3/7/10 nach Länge des arabischen Textes) |
| `test_quiz.csv` | Quiz zur Sīra (2 Minuten, Antwort 1 ist richtig) |
| `text_quiz.txt` | Lesetexte mit je drei Fragen (`Frage 1:` … `Frage 3:`, Antworten A–C mit `(Richtig)`) |
| `ghafir.csv` | Fragmente je Vers mit Übersetzung (und ursprünglichem Emoji) |
| `ghafir_munasaba.csv` | Munāsaba je Fragment: Aussage und Frage, die das nächste Fragment beantwortet |
| `ghafir_geschichte.csv` | Stichpunkt und Emoji je Fragment (Munāsaba-Aufgabe) |
| `ghafir_unterteile.csv` | Unterteile langer Fragmente für die Munāsaba-Aufgabe (Wörter im Vers, Frage, Stichpunkt, Emoji, Übersetzung), damit auch ein Viertel mindestens 5 Teile hat |
| `ghafir_luecken.csv` | Lückenwörter je Vers: Wort wie im Vers, Übersetzung, drei falsche Wörter mit Übersetzung, Alltagsbezug |
| `ghafir_fragen.csv` | Fragen je Vers: deutsch, richtige Antwort zuerst, je mit Übersetzung |
| `ghafir_teile.csv` | Viertel und Hälften jeder Seite (Versbereiche, z. B. `1-3 \| 4 \| 5-6 \| 7`) |
| `ghafir_anschluss.csv` | Anzahl der Anschlusswörter (1–3) am Anfang jedes Verses |
| `ghafir_zeilen.csv` | Vorbereitung: deutsche Übersetzung je Mushaf-Zeile und Vers |
| `ghafir_vorbereitung.md` | Schlüsselwörter (Ordnen) und Übergänge nach al-Biqāʿī (Zusammenhang), je Viertel (`<!-- Teil 40:5-6 -->`); Schlüsselwort = `### ARABISCH EMOJI`, deutsches Wort direkt vor `(EMOJI ARABISCH)` |

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
| `js/prep.js` | Fragmente, Ziehen & Ablegen, Inhalte der Nacherzählung (die Vorbereitungs-Screens sind nicht mehr im Ablauf) |
| `js/activities.js` | Pausen: Dhikr-Aufgaben, Quiz, Lesetext mit drei Fragen |
| `js/review.js` | Ordnen mit Auswahlrad, Zusammenhang nach al-Biqāʿī |
| `js/vault.js` | Tresor: Stellen sammeln, Liste, Üben |
| `js/exercises.js` | frühere Ghāfir-Pausen (Lückentext, Fragen, Munāsaba-Aufgabe) – derzeit nicht eingebunden |
| `js/app.js` | Screens, Testmodus, Ablauf |
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
