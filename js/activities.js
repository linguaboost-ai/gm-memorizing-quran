/*
 * Aktivitäten für die Pausen zwischen den Wiederholungen.
 *
 *   1 Minute  – Dhikr-Aufgaben (dhikr.csv): zufällig, je mit Anzahl
 *               (lange 3 Mal, mittlere 7 Mal, kurze 10 Mal). Bestätigen –
 *               dann kommt der nächste, bis die Minute um ist.
 *   2 Minuten – Quiz im „Wer wird Millionär“-Stil (test_quiz.csv), danach
 *               „Das habe ich heute Neues gelernt.“
 *   4 Minuten – Lesetext mit drei Fragen (text_quiz.txt), danach
 *               „Das nehme ich von der Geschichte mit.“
 *
 * Die Funktionen erzeugen nur HTML; Klicks laufen über data-action in app.js.
 */
(function () {
  "use strict";

  const esc = window.Fade.escapeHtml;
  const DHIKR = window.CONTENT_DHIKR || [];
  const QUIZ = window.CONTENT_QUIZ || [];
  const TEXTS = window.CONTENT_TEXTS || [];
  const LETTERS = ["A", "B", "C", "D"];

  const random = (n) => Math.floor(Math.random() * n);
  const shuffle = (arr) => window.Prep.shuffle(arr);
  const mmss = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

  /** Startzustand der Aktivität zur Pause k (0, 1, 2). */
  function init(k) {
    if (k === 0) return { queue: shuffle(DHIKR.map((_, i) => i)), pos: 0, taps: 0, done: [] };
    if (k === 1) return { order: shuffle(QUIZ.map((_, i) => i)), pos: 0, perms: {}, answers: {}, note: "" };
    const idx = random(TEXTS.length);
    return { idx, choices: (TEXTS[idx] ? TEXTS[idx].questions : []).map(() => null), note: "" };
  }

  /** Passt ein gespeicherter Zustand noch? */
  function valid(a, k) {
    if (!a) return false;
    if (k === 0) return Array.isArray(a.queue) && a.queue.length === DHIKR.length && Array.isArray(a.done);
    if (k === 1) return Array.isArray(a.order) && a.order.length === QUIZ.length;
    return !!TEXTS[a.idx] && Array.isArray(a.choices) && a.choices.length === TEXTS[a.idx].questions.length;
  }

  /** Timer-Anzeige: Ring mit Restzeit. */
  function ring(left, total, big) {
    const r = 52;
    const c = 2 * Math.PI * r;
    const frac = total ? Math.max(0, Math.min(1, left / total)) : 0;
    return `<div class="ring ${big ? "" : "ring-small"}">
      <svg viewBox="0 0 120 120"><circle class="track" cx="60" cy="60" r="${r}"/><circle class="bar" id="ring-bar" cx="60" cy="60" r="${r}" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${(c * (1 - frac)).toFixed(2)}"/></svg>
      <div class="ring-label"><b id="ring-time">${mmss(Math.ceil(left))}</b></div>
    </div>`;
  }

  /** Leiste mit Timer, die beim Quiz und beim Text stehen bleibt. */
  function timerBar(label, left, total, done) {
    const pct = total ? Math.max(0, Math.min(100, (left / total) * 100)) : 0;
    return `<div class="timer-bar ${done ? "done" : ""}">
      <span class="timer-bar-label">${esc(label)}</span>
      <span class="timer-bar-track"><i id="timer-bar-fill" style="width:${pct}%"></i></span>
      <b id="ring-time">${done ? "Zeit um" : mmss(Math.ceil(left))}</b>
    </div>`;
  }

  /** Abschnittslabel, Frage und Hinweis wie im Design-Kit. */
  const heading = (label, frage, hinweis) =>
    `<div class="section-label">${label}</div>${frage ? `<p class="frage">${frage}</p>` : ""}${hinweis ? `<p class="hinweis">${hinweis}</p>` : ""}`;

  /**
   * Antwortoption im Stil des Design-Kits. state: "" | "ok" | "bad" | "missed" | "dim"
   * Richtig/falsch immer mit Farbe und Symbol.
   */
  function optionHtml(letter, text, action, value, state, locked) {
    const mark = state === "ok" || state === "missed" ? "✓" : state === "bad" ? "✕" : "";
    const cls = ["option", state === "ok" || state === "bad" ? "selected " + state : state].filter(Boolean).join(" ");
    return `<button class="${cls}" data-action="${action}" data-value="${value}" ${locked ? "disabled" : ""}>
      <span class="letter">${letter}</span><span class="option-text">${esc(text)}</span>${mark ? `<span class="mark">${mark}</span>` : ""}
    </button>`;
  }

  /** Rückmeldung nach einer Antwort. */
  function feedbackHtml(ok, solution, button) {
    return `<div class="feedback inline ${ok ? "ok" : "bad"}" role="status">
      <div class="feedback-head"><span class="feedback-icon">${ok ? "✓" : "✕"}</span>${ok ? "Richtig!" : "Leider falsch"}</div>
      ${!ok && solution ? `<div class="solution"><span class="label">Richtige Lösung</span><div class="solution-list">${esc(solution)}</div></div>` : ""}
      ${button || ""}
    </div>`;
  }

  /* ------------------------------------------------------------- Dhikr */

  /** Kurzname eines Dhikr für die Liste der geschafften. */
  const shortName = (d) => (d.tr.length > 34 ? d.tr.split(/[,.]/)[0] : d.tr);

  const currentDhikr = (a) => DHIKR[a.queue[a.pos % a.queue.length]] || DHIKR[0];

  function dhikrHtml(a, t) {
    const d = currentDhikr(a);
    const n = d.n || 3;
    const done = a.done.map((i) => DHIKR[i]).filter(Boolean);
    const list = done.length
      ? `<div class="dhikr-done"><span class="label">Geschafft</span>${done.map((x) => `<span class="dhikr-chip">✓ ${esc(shortName(x))} · ${x.n || 3}×</span>`).join("")}</div>`
      : "";
    if (t.done) {
      return `
      <div class="activity">
        ${timerBar("Dhikr · 1 Minute", 0, t.total, true)}
        <div class="time-up big">✓ Die Minute ist um.<small>Jetzt wiederholst du den Abschnitt aus dem Gedächtnis.</small></div>
        ${list}
      </div>`;
    }
    const pct = Math.min(100, (a.taps / n) * 100);
    return `
      <div class="activity">
        ${timerBar("Dhikr · 1 Minute", t.left, t.total, false)}
        ${heading(`Pause · <span class="multi">Aufgabe ${a.pos + 1}</span>`, `Sprich ${n} Mal:`, "Danach bestätigen – dann kommt der nächste Dhikr, bis die Minute um ist.")}
        <div class="card dhikr-task">
          <span class="dhikr-times">${n}×</span>
          <p class="ar-text" lang="ar" dir="rtl">${esc(d.ar)}</p>
          <p class="dhikr-tr">${esc(d.tr)}</p>
          <p class="dhikr-de">${esc(d.de)}</p>
          ${d.reward ? `<details class="dhikr-reward"><summary>Belohnung</summary><p>${esc(d.reward)}</p></details>` : ""}
        </div>
        <button class="tap-counter" data-action="dhikr-tap" aria-label="Mitzählen" style="--p:${pct}%">
          <b>${a.taps}</b><span>/ ${n}</span><small>zum Mitzählen tippen</small>
        </button>
        <button class="btn" data-action="dhikr-done">✓ ${n} Mal gemacht</button>
        ${list}
      </div>`;
  }

  /** Antippen: mitzählen bzw. bestätigen. Gibt true zurück, wenn neu zu zeichnen ist. */
  function dhikrAct(a, what) {
    const n = currentDhikr(a).n || 3;
    if (what === "tap" && a.taps + 1 < n) {
      a.taps++;
      return true;
    }
    a.done.push(a.queue[a.pos % a.queue.length]);
    a.pos++;
    a.taps = 0;
    return true;
  }

  /* -------------------------------------------------------------- Quiz */

  function quizHtml(a, t) {
    const qid = a.order[a.pos];
    const q = QUIZ[qid];
    const answered = Object.keys(a.answers).length;
    const right = Object.entries(a.answers).filter(([id, pos]) => a.perms[id] && a.perms[id][pos] === 0).length;
    let body;
    if (!q) body = `<div class="time-up">✓ Alle Fragen beantwortet – stark!</div>`;
    else {
      if (!a.perms[qid]) a.perms[qid] = shuffle([0, 1, 2, 3]);
      const perm = a.perms[qid];
      const chosen = a.answers[qid];
      const locked = chosen !== undefined || t.done;
      const ok = chosen !== undefined && perm[chosen] === 0;
      body = `
        <div class="section-label">Wer wird Millionär · <span class="multi">Frage ${a.pos + 1}</span></div>
        <p class="frage">${esc(q.q)}</p>
        <div class="options quiz-options">
          ${perm
            .map((orig, pos) => {
              let st = "";
              if (chosen !== undefined) st = orig === 0 ? (pos === chosen ? "ok" : "missed") : pos === chosen ? "bad" : "dim";
              return optionHtml(LETTERS[pos], q.answers[orig], "quiz-answer", pos, st, locked);
            })
            .join("")}
        </div>
        ${
          chosen !== undefined
            ? feedbackHtml(ok, q.answers[0], t.done ? "" : `<button class="btn ${ok ? "ok" : "bad"}" data-action="quiz-next">Nächste Frage</button>`)
            : ""
        }`;
    }
    return `
      <div class="activity">
        ${timerBar("Quiz · 2 Minuten", t.left, t.total, t.done)}
        <p class="hinweis top">Es geht gleich weiter. Beantworte in 2 Minuten so viele Fragen zur Sīra, wie du schaffst.</p>
        <div class="score-line"><span class="progress-score">✓ ${right}</span><span>von ${answered} richtig</span></div>
        ${body}
        ${
          t.done
            ? `<label class="note-field"><span>Das habe ich heute Neues gelernt.</span>
                 <textarea rows="3" data-field="quiz-note" placeholder="Schreib es kurz auf …">${esc(a.note || "")}</textarea></label>`
            : ""
        }
      </div>`;
  }

  /* -------------------------------------------------------------- Text */

  function textHtml(a, t) {
    const x = TEXTS[a.idx] || TEXTS[0];
    const answered = a.choices.filter((c) => c !== null).length;
    return `
      <div class="activity">
        ${timerBar("Lesen · 4 Minuten", t.left, t.total, t.done)}
        ${heading("Pause · <span class=\"multi\">4 Minuten Lesen</span>", "Lies den Text, dann beantworte die drei Fragen.", "Es geht gleich weiter.")}
        <article class="card read-text">
          <h2>${esc(x.title)}</h2>
          ${x.text
            .split(/\n+/)
            .map((p) => `<p>${esc(p)}</p>`)
            .join("")}
        </article>
        ${x.questions
          .map((q, qi) => {
            const choice = a.choices[qi];
            const right = q.options.findIndex((o) => o.correct);
            return `<div class="text-question">
              <div class="section-label">Frage ${qi + 1} von ${x.questions.length}</div>
              <p class="frage small">${esc(q.q)}</p>
              <div class="options">
                ${q.options
                  .map((o, i) => {
                    let st = "";
                    if (choice !== null) st = o.correct ? (i === choice ? "ok" : "missed") : i === choice ? "bad" : "dim";
                    return optionHtml(LETTERS[i], o.text, "text-answer", `${qi}:${i}`, st, choice !== null);
                  })
                  .join("")}
              </div>
              ${choice !== null ? feedbackHtml(choice === right, right >= 0 ? q.options[right].text : "", "") : ""}
            </div>`;
          })
          .join("")}
        ${answered === x.questions.length && !t.done ? `<p class="hinweis center">Alle Fragen beantwortet – gleich geht es weiter.</p>` : ""}
        ${
          t.done
            ? `<label class="note-field"><span>Das nehme ich von der Geschichte mit.</span>
                 <textarea rows="3" data-field="text-note" placeholder="Schreib es kurz auf …">${esc(a.note || "")}</textarea></label>`
            : ""
        }
      </div>`;
  }

  window.Activities = { init, valid, dhikrHtml, dhikrAct, quizHtml, textHtml, ring, timerBar, mmss, DHIKR, QUIZ, TEXTS };
})();
