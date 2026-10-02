/*
 * Übungen in den Pausen zwischen den Wiederholungen. Inhalte (Lückenwörter,
 * Fragen, Stichpunkte, Emojis, Munāsaba) gibt es für Sure Ghāfir
 * (data/content.js); ohne Inhalte bleibt es bei den allgemeinen Aktivitäten
 * aus activities.js (Dhikr, Sīra-Quiz, Lesetext).
 *
 *   1 Minute  – Lückentext: Auf der leeren Mushaf-Seite erscheint der
 *               Abschnitt Fragment für Fragment, jeweils mit einer Lücke. Vier
 *               Wörter zur Auswahl (mit Übersetzung), dazu die Übersetzung des
 *               Fragments. 5–10 Lücken, über den Abschnitt verteilt. Danach
 *               verschwindet der Text und der Timer läuft groß weiter.
 *   2 Minuten – Fragen zum Abschnitt (deutsch, Antworten arabisch), bis die
 *               Zeit um ist. Der Abschnitt bleibt sichtbar, auf Wunsch mit
 *               Übersetzung (dann auch bei den Antworten).
 *   4 Minuten – Munāsaba: Fragen, deren Antwort ein Fragment ist, in
 *               zufälliger Reihenfolge; das passende Fragment wird angetippt
 *               und bekommt sein Emoji. Dann Stichpunkte mit Emojis in die
 *               richtige Reihenfolge bringen, dann nur die Emojis. Muss zu
 *               Ende geführt werden, auch wenn die Zeit vorher abläuft.
 *
 * Der Zustand einer Übung (s.ex[k]) wird mit der Sitzung gespeichert und
 * enthält nur Zahlen; die Inhalte kommen aus study() (je Abschnitt).
 */
(function () {
  "use strict";

  const Q = window.Quran;
  const esc = window.Fade.escapeHtml;
  const A = window.Activities;
  const LETTERS = ["A", "B", "C", "D"];
  const MIN_GAPS = 5;
  const MAX_GAPS = 10;
  const WORDS_PER_GAP = 8;
  const MAX_UNITS = 10;

  const shuffle = (a) => window.Prep.shuffle(a);
  const range = (n) => Array.from({ length: n }, (_, i) => i);

  /** Gemischt, aber (ab zwei Einträgen) nie schon in der richtigen Reihenfolge. */
  function mixed(n) {
    if (n < 2) return range(n);
    let a;
    do a = shuffle(range(n));
    while (a.every((x, i) => x === i));
    return a;
  }

  /** Wortform für Antworten: ohne Dehnungs-Tatweel und Pausenzeichen. */
  const plain = (s) =>
    String(s || "")
      .replace(/ـ(?![ً-ٰٟۖ-ۭ])/g, "")
      .replace(/[ۖ-ۛ]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const arHtml = (s) => `<span class="ex-ar" lang="ar" dir="rtl">${esc(s)}</span>`;

  /** Ein Fragment in der Schreibweise der Mushaf-Seite (ohne Dehnung). */
  function fragAr(f) {
    const words = f.words.map((w) => esc(plain(w.display))).join(" ");
    return `<span class="ex-ar" lang="ar" dir="rtl">${words}${f.end ? ` <span class="ex-end">${esc(f.end.text)}</span>` : ""}</span>`;
  }

  /* ------------------------------------------------------------ Material */

  /**
   * Alles, was die Übungen zu einem Abschnitt brauchen.
   * @param {object} unit       Einheit (Quran.pageUnits)
   * @param {Array} fragments   Prep.fragmentsOf(unit)
   */
  function study(unit, fragments) {
    const GAPS = window.CONTENT_GAPS || {};
    const QUESTIONS = window.CONTENT_QUESTIONS || {};
    // Reihenfolge aller Token und das Fragment, zu dem jedes gehört
    const fragOf = new Map();
    fragments.forEach((f, i) => {
      f.words.forEach((w) => fragOf.set(w, i));
      if (f.end) fragOf.set(f.end, i);
    });
    const order = [];
    for (const v of unit.verses) {
      v.tokens.forEach((t, j) => {
        if (!fragOf.has(t)) {
          // Zeichen wie ۞ gehören zum folgenden Wort
          const next = v.tokens.slice(j).find((x) => fragOf.has(x));
          fragOf.set(t, next ? fragOf.get(next) : Math.max(0, fragments.length - 1));
        }
        order.push(t);
      });
    }
    const pos = new Map();
    order.filter((t) => t.type === Q.TOKEN_WORD).forEach((t, i) => pos.set(t, i));

    // Lücken: bekannte Wörter mit drei falschen Antworten
    const gaps = [];
    for (const v of unit.verses) {
      const words = v.tokens.filter((t) => t.type === Q.TOKEN_WORD);
      for (const g of GAPS[v.key] || []) {
        const toks = words.slice(g.w[0], g.w[1] + 1);
        if (!toks.length || !g.wrong || g.wrong.length < 3) continue;
        gaps.push({
          tokens: toks,
          frag: fragOf.get(toks[0]),
          pos: pos.get(toks[0]),
          ar: plain(toks.map((t) => t.display || t.text).join(" ")),
          de: g.de,
          wrong: g.wrong.slice(0, 3).map(([ar, de]) => ({ ar: plain(ar), de })),
          ctx: g.ctx || "",
        });
      }
    }
    gaps.sort((a, b) => a.pos - b.pos);

    // Fragen zum Inhalt, dazu Wortfragen aus den Lückenwörtern
    const quiz = [];
    for (const v of unit.verses) {
      for (const x of QUESTIONS[v.key] || []) {
        if (x.a && x.a.length >= 4) quiz.push({ q: x.q, opts: x.a.slice(0, 4).map(([ar, de]) => ({ ar: plain(ar), de })) });
      }
    }
    const vocab = gaps.map((g) => ({ q: `Welches Wort im Abschnitt bedeutet „${g.de}“?`, opts: [{ ar: g.ar, de: g.de }, ...g.wrong], vocab: true }));

    return { order, fragOf, words: pos.size, gaps, quiz, vocab, units: munUnits(unit, fragments) };
  }

  /**
   * Teile für die Munāsaba-Aufgabe: die Fragmente, bei mehr als zehn
   * benachbarte zusammengelegt (zuerst innerhalb eines Verses, die kürzesten
   * zuerst). Frage = Munāsaba-Frage vor dem ersten Fragment des Teils.
   */
  function munUnits(unit, fragments) {
    const mun = window.Prep.munasabaOf(unit, fragments);
    if (!mun || fragments.length < 2) return [];
    let groups = fragments.map((_, i) => [i]);
    const size = (g) => g.reduce((a, i) => a + fragments[i].words.length, 0);
    while (groups.length > MAX_UNITS) {
      let best = 0;
      let bestCost = Infinity;
      for (let i = 0; i < groups.length - 1; i++) {
        const sameVerse = fragments[groups[i][0]].key === fragments[groups[i + 1][0]].key;
        const cost = size(groups[i]) + size(groups[i + 1]) + (sameVerse ? 0 : 1000);
        if (cost < bestCost) {
          bestCost = cost;
          best = i;
        }
      }
      groups.splice(best, 2, groups[best].concat(groups[best + 1]));
    }
    return groups.map((g) => {
      const fs = g.map((i) => fragments[i]);
      const emojis = [...new Set(fs.map((f) => f.emoji).filter(Boolean))];
      return {
        frags: g,
        q: (mun[g[0]] && mun[g[0]].q) || "",
        emoji: emojis.slice(0, 2).join("") || "•",
        bullet: fs.map((f) => f.bullet || f.de).filter(Boolean).join(" – "),
        de: fs.map((f) => f.de).filter(Boolean).join(" "),
      };
    });
  }

  /** Lücken auswählen: 5–10, möglichst gleichmäßig über den Abschnitt verteilt. */
  function pickGaps(st) {
    const c = st.gaps;
    const n = Math.min(c.length, Math.max(MIN_GAPS, Math.min(MAX_GAPS, Math.round(st.words / WORDS_PER_GAP))));
    const chosen = [];
    const used = new Set();
    for (let i = 0; i < n; i++) {
      const target = ((i + 0.5) / n) * st.words;
      let best = -1;
      let bd = Infinity;
      c.forEach((g, j) => {
        if (chosen.includes(j) || g.tokens.some((t) => used.has(t))) return;
        const d = Math.abs(g.pos - target);
        if (d < bd) {
          bd = d;
          best = j;
        }
      });
      if (best < 0) break;
      chosen.push(best);
      c[best].tokens.forEach((t) => used.add(t));
    }
    return chosen.sort((a, b) => c[a].pos - c[b].pos);
  }

  /** Reihenfolge der Fragen: erst die Inhaltsfragen, dann die Wortfragen (je gemischt). */
  const quizOrder = (st) => [...shuffle(st.quiz.map((_, i) => "q" + i)), ...shuffle(st.vocab.map((_, i) => "v" + i))];
  const quizItem = (st, id) => (id[0] === "q" ? st.quiz : st.vocab)[+id.slice(1)];

  /* ------------------------------------------------------------ Zustand */

  /** Startzustand der Übung zur Pause k (0, 1, 2). */
  function init(k, info) {
    const st = info.study;
    if (k === 0) {
      if (!st.gaps.length) return Object.assign({ kind: "dhikr" }, A.init(0));
      const items = pickGaps(st);
      return { kind: "gap", items, perms: items.map(() => shuffle([0, 1, 2, 3])), pos: 0, wrong: [], done: false };
    }
    if (k === 1) {
      if (!st.quiz.length && !st.vocab.length) return Object.assign({ kind: "sira" }, A.init(1));
      return { kind: "quiz", order: quizOrder(st), pos: 0, perm: shuffle([0, 1, 2, 3]), chosen: null, right: 0, total: 0 };
    }
    const n = st.units.length;
    if (n < 2) return Object.assign({ kind: "text" }, A.init(2));
    return { kind: "mun", phase: "ask", ask: shuffle(range(n)), askPos: 0, placed: range(n).map(() => false), bullets: mixed(n), bulletDone: 0, emojis: mixed(n), emojiDone: 0, done: false };
  }

  /** Passt ein gespeicherter Zustand noch zu den Inhalten? */
  function valid(ex, k, info) {
    if (!ex) return false;
    const st = info.study;
    if (ex.kind === "gap") return k === 0 && ex.items.every((i) => i < st.gaps.length) && ex.items.length > 0;
    if (ex.kind === "quiz") return k === 1 && ex.order.length > 0 && ex.order.every((id) => !!quizItem(st, id));
    if (ex.kind === "mun") return k === 2 && ex.placed.length === st.units.length;
    return { dhikr: 0, sira: 1, text: 2 }[ex.kind] === k;
  }

  /** Ist die Übung abgeschlossen? (Fragen laufen bis zum Ende der Zeit) */
  const isDone = (ex) => !!ex && (ex.kind === "gap" || ex.kind === "mun" ? ex.done : true);

  /** Neue Übungen (sonst die allgemeinen Aktivitäten). */
  const isNew = (ex) => !!ex && (ex.kind === "gap" || ex.kind === "quiz" || ex.kind === "mun");

  /* ---------------------------------------------------------- Bausteine */

  // Kurzzeitige Anzeige nach einer richtigen Lücke bzw. bei einer falschen Wahl
  let flash = null; // { pos } – Lücke pos gerade richtig eingesetzt
  let shake = null; // Wert der zuletzt falsch angetippten Auswahl

  const heading = (label, frage, hinweis) =>
    `<div class="section-label">${label}</div>${frage ? `<p class="frage">${frage}</p>` : ""}${hinweis ? `<p class="hinweis">${hinweis}</p>` : ""}`;

  /** Großer Timer, wenn die Aufgabe vor Ablauf der Zeit geschafft ist. */
  function bigTimer(label, title, text, t, extra) {
    return `
      <div class="activity ex-wait">
        ${heading(label, title, text)}
        ${extra || ""}
        <div class="activity-timer">${t.done ? `<div class="time-up">✓ Zeit um</div>` : A.ring(t.left, t.total, true)}</div>
      </div>`;
  }

  /** Antwort: arabisch, darunter die Übersetzung (bei den Fragen in Klammern). */
  function wordOption(o, value, state, locked, showDe, letter) {
    const mark = state === "ok" ? "✓" : state === "bad" ? "✕" : "";
    const de = showDe && o.de ? `<span class="de">${esc(letter ? `(${o.de})` : o.de)}</span>` : "";
    return `<button class="word-opt ${state} ${shake === value ? "shake" : ""}" ${letter ? `data-letter="${letter}"` : ""} data-action="ex" data-value="${value}" ${locked ? "disabled" : ""}>
      ${arHtml(o.ar)}${de}${mark ? `<span class="mark">${mark}</span>` : ""}
    </button>`;
  }

  const deSwitch = (on) => `<label class="switch-row"><input type="checkbox" class="switch" data-action="pref" data-value="de" ${on ? "checked" : ""} />Übersetzung</label>`;

  /** Der Abschnitt als Fragmentliste (mit oder ohne Übersetzung). */
  function textCard(info, showDe) {
    return `<div class="card ex-text">
      <div class="ex-text-head"><span class="label">Dein Abschnitt · ${esc(info.label)}</span>${deSwitch(showDe)}</div>
      ${info.fragments.map((f) => `<div class="ex-frag">${fragAr(f)}${showDe && f.de ? `<p class="ex-frag-de">${esc(f.de)}</p>` : ""}</div>`).join("")}
    </div>`;
  }

  /* ------------------------------------------------------- 1 Min: Lücken */

  /** Was auf der Seite zu sehen ist: alles bis zum Fragment der aktuellen Lücke. */
  function gapReveal(ex, info, pos, filled) {
    const st = info.study;
    const map = new Map();
    const cur = st.gaps[ex.items[pos]];
    for (const t of st.order) if (st.fragOf.get(t) > cur.frag) map.set(t, "hide");
    ex.items.forEach((gi, i) => {
      if (i < pos) return;
      const state = i === pos ? (filled ? "fill" : "gap") : "blank";
      for (const t of st.gaps[gi].tokens) if (!map.has(t)) map.set(t, state);
    });
    return map;
  }

  function gapView(ex, info, t) {
    const st = info.study;
    const showing = flash ? flash.pos : ex.pos;
    if (ex.done && !flash) {
      return {
        body: bigTimer(
          "Pause · <span class=\"multi\">1 Minute Lückentext</span>",
          "Alles eingesetzt – Ma schā' Allāh!",
          "Sag den Abschnitt in Gedanken auf. Wenn die Minute um ist, geht es mit der Wiederholung weiter.",
          t
        ),
        footer: "",
      };
    }
    const g = st.gaps[ex.items[showing]];
    const frag = info.fragments[g.frag] || {};
    const opts = [{ ar: g.ar, de: g.de }, ...g.wrong];
    const perm = ex.perms[showing] || [0, 1, 2, 3];
    const body = `
      ${A.timerBar("Lückentext · 1 Minute", t.left, t.total, t.done)}
      <div class="section-label">Pause · <span class="multi">Lücke ${showing + 1} von ${ex.items.length}</span></div>
      <div class="mushaf full ex-page" id="mushaf">${window.Mushaf.unitHtml(info.unit, {
        levels: [],
        shapes: info.shapes,
        wordIndex: info.wordIndex,
        tail: [],
        reveal: gapReveal(ex, info, showing, !!flash),
      })}</div>`;
    const footer = `
      <div class="ex-panel">
        <p class="ex-de"><span class="label">Übersetzung</span> ${esc(frag.de || "")}</p>
        <div class="word-options">${perm
          .map((o) => {
            const state = flash && o === 0 ? "ok" : !flash && ex.wrong.includes(o) ? "bad" : "";
            return wordOption(opts[o], "gap:" + o, state, !!flash || state === "bad", true);
          })
          .join("")}</div>
        ${
          flash
            ? `<p class="ex-note ok">✓ ${arHtml(g.ar)} – ${esc(g.de)}${g.ctx ? ` · ${esc(g.ctx)}` : ""}</p>`
            : `<p class="ex-note">Welches Wort gehört in die markierte Lücke?</p>`
        }
      </div>`;
    return { body, footer };
  }

  /* ------------------------------------------------------- 2 Min: Fragen */

  function quizView(ex, info, t, showDe) {
    const st = info.study;
    const item = quizItem(st, ex.order[ex.pos]);
    const chosen = ex.chosen;
    const locked = chosen !== null || t.done;
    const right = chosen !== null && ex.perm[chosen] === 0;
    const withDe = showDe && !item.vocab;
    const body = `
      ${A.timerBar("Fragen · 2 Minuten", t.left, t.total, t.done)}
      <div class="score-line"><span class="progress-score">✓ ${ex.right}</span><span>von ${ex.total} richtig</span></div>
      ${textCard(info, showDe)}`;
    const footer = `
      <div class="ex-panel">
        <span class="label">Frage ${ex.total + (chosen === null ? 1 : 0)}</span>
        <p class="ex-q">${esc(item.q)}</p>
        <div class="word-options">${ex.perm
          .map((o, pos) => {
            let state = "";
            if (chosen !== null) state = o === 0 ? "ok" : pos === chosen ? "bad" : "dim";
            return wordOption(item.opts[o], "quiz:" + pos, state, locked, withDe, LETTERS[pos]);
          })
          .join("")}</div>
        ${
          chosen !== null && !t.done
            ? `<button class="btn ${right ? "ok" : "bad"}" data-action="ex" data-value="quiz-next">${right ? "Richtig! " : "Leider falsch · "}Nächste Frage</button>`
            : ""
        }
      </div>`;
    return { body, footer };
  }

  /* ----------------------------------------------------- 4 Min: Munāsaba */

  function munView(ex, info, t, showDe) {
    const st = info.study;
    const units = st.units;
    const n = units.length;
    const timer = A.timerBar(t.done ? "Zeit um – bring die Aufgabe zu Ende" : "Munāsaba · 4 Minuten", t.left, t.total, t.done);
    const unitAr = (u) => u.frags.map((i) => fragAr(info.fragments[i])).join(" ");

    if (ex.phase === "ask") {
      const cur = units[ex.ask[ex.askPos]];
      const body = `
        ${timer}
        <div class="ex-ask card">
          <div class="ex-text-head"><span class="label">Frage ${ex.askPos + 1} von ${n}</span>${deSwitch(showDe)}</div>
          <p class="ex-q">${esc(cur.q)}</p>
          <p class="hinweis">Tippe auf den Teil des Abschnitts, der die Frage beantwortet.</p>
        </div>
        <div class="mun-list">${units
          .map((u, i) =>
            ex.placed[i]
              ? `<div class="mun-item placed"><div class="mun-main">${unitAr(u)}${showDe && u.de ? `<p class="ex-frag-de">${esc(u.de)}</p>` : ""}</div><span class="mun-emoji">${esc(u.emoji)}</span></div>`
              : `<button class="mun-item ${shake === "ask:" + i ? "shake" : ""}" data-action="ex" data-value="ask:${i}"><div class="mun-main">${unitAr(u)}</div><span class="mun-emoji empty"></span></button>`
          )
          .join("")}</div>`;
      return { body, footer: "" };
    }

    if (ex.phase === "bullets" || ex.phase === "emojis") {
      const bullets = ex.phase === "bullets";
      const done = bullets ? ex.bulletDone : ex.emojiDone;
      const pool = (bullets ? ex.bullets : ex.emojis).filter((i) => i >= done);
      // Gelegte Teile und ein Platz für den nächsten (die übrigen liegen darunter)
      const slots = range(Math.min(n, done + 1))
        .map((i) =>
          i < done
            ? bullets
              ? `<li class="slot filled"><span class="emo">${esc(units[i].emoji)}</span><span class="txt">${esc(units[i].bullet)}</span></li>`
              : `<li class="slot filled emoji-only"><span class="emo">${esc(units[i].emoji)}</span></li>`
            : `<li class="slot next ${bullets ? "" : "emoji-only"}"><span class="slot-no">${bullets ? `${i + 1}. – was kommt jetzt?` : i + 1}</span></li>`
        )
        .join("");
      const chips = pool
        .map((i) =>
          bullets
            ? `<button class="order-chip ${shake === "bullet:" + i ? "shake" : ""}" data-action="ex" data-value="bullet:${i}"><span class="emo">${esc(units[i].emoji)}</span><span class="txt">${esc(units[i].bullet)}</span></button>`
            : `<button class="order-chip emoji-only ${shake === "emoji:" + i ? "shake" : ""}" data-action="ex" data-value="emoji:${i}"><span class="emo">${esc(units[i].emoji)}</span></button>`
        )
        .join("");
      const body = `
        ${timer}
        ${heading(
          `Munāsaba · <span class="multi">${bullets ? "Stichpunkte ordnen" : "Emojis ordnen"}</span>`,
          bullets ? "In welcher Reihenfolge erzählt der Abschnitt das?" : "Und jetzt nur mit den Emojis?",
          bullets ? "Tippe die Stichpunkte der Reihe nach an – was kommt zuerst?" : "Tippe die Emojis in der Reihenfolge des Abschnitts an."
        )}
        <ol class="order-slots ${bullets ? "" : "emoji-row"}">${slots}</ol>
        ${pool.length ? `<div class="order-pool ${bullets ? "" : "emoji-row"}">${chips}</div>` : ""}`;
      return { body, footer: "" };
    }

    // geschafft
    const story = `<div class="emoji-story">${units.map((u) => `<span>${esc(u.emoji)}</span>`).join("")}</div>`;
    return {
      body: bigTimer(
        "Munāsaba · <span class=\"multi\">geschafft</span>",
        "Ma schā' Allāh – die Geschichte steht.",
        t.done ? "Gleich geht es mit der letzten Wiederholung weiter." : "Erzähl dir den Abschnitt anhand der Emojis noch einmal. Wenn die Zeit um ist, geht es weiter.",
        t,
        story
      ),
      footer: "",
    };
  }

  /**
   * HTML einer neuen Übung: { body, footer }.
   * @param {object} t   Timer { started, done, left, total }
   */
  function view(ex, info, t, prefs) {
    if (ex.kind === "gap") return gapView(ex, info, t);
    if (ex.kind === "quiz") return quizView(ex, info, t, !!prefs.de);
    return munView(ex, info, t, !!prefs.de);
  }

  /* ---------------------------------------------------------- Antworten */

  /**
   * Klick in einer Übung (data-action="ex").
   * api: { save, render, later(fn, ms), buzz(), done() } – done() meldet, dass
   * die Aufgabe abgeschlossen ist.
   */
  function act(ex, info, value, api) {
    const st = info.study;
    const [what, arg] = String(value).split(":");
    const i = +arg;
    const wrong = (v) => {
      shake = v;
      api.buzz();
      api.render();
      api.later(() => {
        if (shake !== v) return;
        shake = null;
        api.render();
      }, 600);
    };

    if (ex.kind === "gap" && what === "gap") {
      if (ex.done || flash) return;
      if (i !== 0) {
        if (!ex.wrong.includes(i)) ex.wrong.push(i);
        api.save();
        return wrong(value);
      }
      flash = { pos: ex.pos };
      ex.pos++;
      ex.wrong = [];
      if (ex.pos >= ex.items.length) ex.done = true;
      api.save();
      api.render();
      api.later(
        () => {
          flash = null;
          api.render();
          if (ex.done) api.done();
        },
        1300,
        () => (flash = null)
      );
      return;
    }

    if (ex.kind === "quiz") {
      if (what === "quiz" && ex.chosen === null) {
        ex.chosen = i;
        ex.total++;
        const right = ex.perm[i] === 0;
        if (right) ex.right++;
        api.save();
        api.render();
        if (right) api.later(() => next(), 1200);
        return;
      }
      if (what === "quiz-next") return next();
    }

    if (ex.kind === "mun") {
      if (what === "ask" && ex.phase === "ask") {
        const want = ex.ask[ex.askPos];
        if (i !== want) return wrong(value);
        ex.placed[i] = true;
        ex.askPos++;
        if (ex.askPos >= st.units.length) ex.phase = "bullets";
        api.save();
        return api.render();
      }
      if (what === "bullet" && ex.phase === "bullets") {
        if (i !== ex.bulletDone) return wrong(value);
        ex.bulletDone++;
        if (ex.bulletDone >= st.units.length) ex.phase = "emojis";
        api.save();
        return api.render();
      }
      if (what === "emoji" && ex.phase === "emojis") {
        if (i !== ex.emojiDone) return wrong(value);
        ex.emojiDone++;
        if (ex.emojiDone >= st.units.length) {
          ex.phase = "done";
          ex.done = true;
        }
        api.save();
        api.render();
        if (ex.done) api.done();
      }
    }

    function next() {
      if (ex.chosen === null) return;
      ex.pos++;
      if (ex.pos >= ex.order.length) {
        // alle Fragen gestellt: neu mischen und weiter, bis die Zeit um ist
        const last = ex.order[ex.order.length - 1];
        ex.order = quizOrder(st);
        if (ex.order.length > 1 && ex.order[0] === last) ex.order.push(ex.order.shift());
        ex.pos = 0;
      }
      ex.perm = shuffle([0, 1, 2, 3]);
      ex.chosen = null;
      api.save();
      api.render();
    }
  }

  /** Vorübergehende Anzeigen verwerfen (z. B. beim Verlassen der Pause). */
  function reset() {
    flash = null;
    shake = null;
  }

  window.Exercises = { study, init, valid, isDone, isNew, view, act, reset, plain };
})();
