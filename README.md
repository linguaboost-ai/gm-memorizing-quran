# German Method – Qur'an auswendig lernen

Web-App zum Auswendiglernen des Qur'an – Abschnitt für Abschnitt, im Layout des
Medina-Mushaf, mit Rezitation und schrittweisem Ausgrauen der Wörter.
Gestaltet nach den „German Method – In-App-Käufe Screens“.

## So funktioniert es

1. **Plan erstellen:** Sure wählen, Tagespensum (½, 1 oder 2 Seiten), Lerneinheit
   (¼, ½, 1 oder 2 Seiten – immer kleiner als das Tagespensum) und einen von
   10 Rezitatoren (Nr. 10: Abdullah Al-Matrood).
2. **Einteilung:** Die Sure wird nach den Seiten des Medina-Mushaf (604 Seiten à
   15 Zeilen) in Tagesabschnitte geteilt, jeder Tag gleichmäßig in Lerneinheiten.
   Grenzen liegen immer an einem Versende – Verse werden nie geteilt.
3. **Lernen:** Die Lerneinheit wird wie im blauen Medina-Mushaf dargestellt
   (Zeilen, Blocksatz und Wortpositionen wie auf der gedruckten Seite). ▶ spielt
   nur diesen Abschnitt und stoppt am Ende; Pause, „Von vorn“ und Tippen auf einen
   Vers (spielt ab diesem Vers) sind möglich. Die Verse werden lückenlos in einem
   Rutsch abgespielt (Web Audio, Stille zwischen den Versdateien wird gekürzt).
   Als Anschluss werden die ersten drei Wörter des nächsten Verses blau mit
   angezeigt und mitrezitiert; danach wird über 100 ms ausgeblendet. Da es für
   die Rezitationen keine Wort-Zeitstempel gibt, wird das Wortende geschätzt
   (Sprechdauer aus dem Text, Schnitt an der leisesten Stelle in der Nähe).
4. **„Gelernt“:** Bei jedem Wort wird ein Fünftel der Zeichen ausgegraut
   (`opacity: 0.1`, der Buchstabenfluss bleibt erhalten), vom Wortende her und
   abgerundet – im Zweifel bleibt ein Zeichen mehr sichtbar. Buchstaben und
   Harakat zählen einzeln, die Shadda doppelt (كَذَّبَتۡ = 10 Zeichen, nach dem
   ersten Klick ist تۡ ausgegraut). Nach fünf Klicks ist alles ausgegraut.
5. **Pausen:** Danach nur ein Timer (1 Minute) → Seite erscheint ausgegraut →
   „Gelernt“ → 2 Minuten → Wiederholung → 4 Minuten → Wiederholung → nächste
   Lerneinheit, bis das Tagespensum geschafft ist.

Der Fortschritt wird im Browser gespeichert (`localStorage`), auch ein laufender Timer.

## Lokal starten

Die App ist rein statisch (HTML/CSS/JS, keine Build-Schritte). `index.html` kann
direkt im Browser geöffnet werden, oder mit einem lokalen Server:

```bash
npx serve .
```

Zum Ausprobieren lassen sich die Pausen verkürzen: `index.html?timer=5`
(jede Pause dauert dann 5 Sekunden).

**Audio:** Auf Vercel werden die Versdateien über `/audio/…` (everyayah.com) und
`/audio-alt/…` (cdn.islamic.network) von der eigenen Domain ausgeliefert
(`vercel.json`). Nur so darf der Browser die Audiodaten lesen und die Verse ohne
Pause aneinanderfügen. Lokal gibt es diese Weiterleitung nicht; dann spielt die
App die Verse über ein normales `<audio>`-Element nacheinander (mit kurzen Pausen).

## Aufbau

| Pfad | Inhalt |
| --- | --- |
| `index.html` | Einstieg |
| `css/app.css` | Design (German Method) und Mushaf-Darstellung |
| `js/quran.js` | Daten laden, Einteilung in Tages- und Lernabschnitte |
| `js/fade.js` | Ausgrau-Logik (Fünftel pro Wort) |
| `js/mushaf.js` | Darstellung im Medina-Mushaf-Layout |
| `js/player.js` | Rezitatoren und Wiedergabe |
| `js/app.js` | Screens, Zustand und Ablauf |
| `data/` | Generierte Qur'an-Daten (Text, Seiten, Zeilen) |
| `tools/build-data.mjs` | Erzeugt `data/` neu |
| `uthmanic.woff2` | Schrift: KFGQPC Uthmanic Script HAFS |

Daten neu erzeugen:

```bash
npm install
npm run build:data
```

## Quellen

- Qur'an-Text und Seiten-/Zeilenumbrüche: King Fahd Glorious Qur'an Printing
  Complex (KFGQPC Uthmanic Hafs), aufbereitet von
  [quran-text / quran.ws](https://github.com/quran-ws/quran-text), CC BY 4.0.
  Die offenen Tanwīn-Zeichen (U+08F0–08F2) werden als normale Tanwīn dargestellt,
  da die Schrift v0.09 sie noch nicht enthält.
- Rezitationen: [everyayah.com](https://everyayah.com), ersatzweise
  [cdn.islamic.network](https://alquran.cloud).
