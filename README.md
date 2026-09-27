# German Method – Qur'an auswendig lernen

Web-App zum Auswendiglernen des Qur'an im Layout des Madani-Mushaf (blaue
Ausgabe), mit Rezitation, Vorbereitung über Versfragmente, schrittweisem
Ausgrauen und sinnvoll gefüllten Pausen. Gestaltet nach den „German Method –
In-App-Käufe Screens“.

## Der Plan

1. **Was möchtest du auswendig lernen?** Einer der 30 Juz (mit Anfang und Ende:
   Sure, Surennummer, Vers).
2. **An welchen Tagen?** Wochentage zum Ankreuzen (Mehrfachauswahl).
3. **Wie viel pro Tag?** ¼, ½, 1, 1½ oder 2 Seiten.

Gelernt wird in **Seitenvierteln**: Jede Mushaf-Seite wird in vier etwa gleich
große Teile aus ganzen Versen geteilt (bei nur drei Versen in drei Teile). Die
Tage bestehen aus so vielen Vierteln, wie es der Tagesmenge entspricht, und
werden auf die gewählten Wochentage verteilt.

## Zum Testen

Über „Zum Testen: freie Auswahl“ (oder `index.html?test`): Juz → Seite →
Viertel. Die Seite wird klein dargestellt; beim Überfahren mit der Maus wird das
jeweilige Viertel hervorgehoben. Im Testmodus lassen sich alle Schritte frei
ansteuern, Timer können übersprungen werden.

## Ablauf eines Seitenviertels

1. **Vorbereitung**
   - **1a Emojis zuordnen:** Der Abschnitt in Versfragmenten untereinander
     (getrennt bei ۘ ۚ ۖ ۗ). Die Übersetzung lässt sich ein- und ausblenden.
     Rechts daneben eine Spalte, in die Emojis per Drag & Drop gezogen werden.
     Für Sure Ghāfir kommen Fragmente, Übersetzung und Emojis aus
     `ghafir.csv`; dazu gibt es den Zusammenhang der Verse (Munāsaba nach
     al-Biqāʿī, `f-a_biqai-old.txt`) zum Aufklappen.
   - **1b Reihenfolge:** Die Emojis bleiben, die Fragmente stehen gemischt in
     einem Auswahlrad (nur das mittlere ist lesbar, Mausrad/Touchpad/Pfeile).
     Das gesuchte Fragment wird nach oben gezogen – nur der Reihe nach, falsche
     springen zurück.
2. **Auswendiglernen** – der Abschnitt im Madani-Mushaf, dazu die ersten drei
   Wörter des nächsten Verses (blau) als Anschluss. „Weiter“ graut bei jedem
   Wort ein Fünftel der Zeichen aus (Buchstaben und Harakat einzeln, Shadda
   doppelt, abgerundet), „Zurück“ holt es wieder. Nach fünf Schritten ist alles
   ausgegraut. Dann:
   - **1 Minute Dhikr** (`dhikr.csv`): „Los geht's“ startet den Timer, danach
     „Ich habe … Mal geschafft.“ → Wiederholung
   - **2 Minuten Quiz** im „Wer wird Millionär“-Stil (`test_quiz.csv`), danach
     „Das habe ich heute Neues gelernt.“ → Wiederholung
   - **4 Minuten Lesetext** mit Frage (`text_quiz.txt`), danach „Das nehme ich
     von der Geschichte mit.“ → Wiederholung
3. **Abschluss** – freiwillige Notizen: Was kann ich in 24 Stunden, in sieben
   Tagen, in meinem Leben umsetzen?

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
`text_quiz.txt`, `ghafir.csv`, `f-a_biqai-old.txt`) werden in
`data/content.js` übersetzt:

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
| `js/quran.js` | Daten, Seiten, Juz, Seitenviertel, Tagesplan |
| `js/mushaf.js` | Darstellung im Madani-Mushaf |
| `js/fade.js` | Ausgrauen in Fünfteln |
| `js/player.js` | Rezitatoren und lückenlose Wiedergabe |
| `js/prep.js` | Vorbereitung: Fragmente, Emojis, Auswahlrad |
| `js/activities.js` | Pausen: Dhikr, Quiz, Lesetext |
| `js/app.js` | Screens, Plan, Testmodus, Ablauf |
| `data/` | Generierte Daten |
| `tools/` | Skripte zum Erzeugen der Daten |
| `uthmanic.woff2` | Schrift: KFGQPC Uthmanic Script HAFS |

## Quellen

- Qur'an-Text und Seiten-/Zeilenumbrüche: King Fahd Glorious Qur'an Printing
  Complex (KFGQPC Uthmanic Hafs), aufbereitet von
  [quran-text / quran.ws](https://github.com/quran-ws/quran-text), CC BY 4.0.
  Zeichen, die die Schrift v0.09 noch nicht kennt, werden ersetzt: offene
  Tanwīn → normale Tanwīn, Kasra mit kleinem Mīm unten → Kasratain, kleines Sīn
  unten entfällt (ein Wort).
- Rezitationen: [everyayah.com](https://everyayah.com), ersatzweise
  [cdn.islamic.network](https://alquran.cloud).
