/*
 * Aktivitäten für die Pausen zwischen den Wiederholungen.
 *
 *   1 Minute  – Dhikr (dhikr.csv): „Los geht's“ startet den Timer, danach
 *               „Ich habe … Mal geschafft.“
 *   2 Minuten – Quiz im „Wer wird Millionär“-Stil (test_quiz.csv), danach
 *               „Das habe ich heute Neues gelernt.“
 *   4 Minuten – Lesetext mit Frage (text_quiz.txt), danach
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
    if (k === 0) return { idx: random(DHIKR.length), count: "" };
    if (k === 1) return { order: shuffle(QUIZ.map((_, i) => i)), pos: 0, perms: {}, answers: {}, note: "" };
    return { idx: random(TEXTS.length), choice: null, note: "" };
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

  function dhikrHtml(a, t) {
    const d = DHIKR[a.idx] || DHIKR[0];
    let timer;
    if (!t.started) timer = `<button class="btn" data-action="timer-start">Los geht's</button>`;
    else if (!t.done) timer = ring(t.left, t.total, true);
    else timer = `<div class="time-up">✓ Die Minute ist um.</div>`;
    return `
      <div class="activity">
        ${heading("Pause · <span class=\"multi\">1 Minute Dhikr</span>", "Es geht gleich weiter.", "Nimm dir 1 Minute Zeit für Dhikr.")}
        <div class="text-card"><p class="ar-text" lang="ar" dir="rtl">${esc(d.ar)}</p></div>
        <div class="activity-timer">${timer}</div>
        <label class="count-row ${t.done ? "" : "disabled"}">
          Ich habe <input type="number" inputmode="numeric" min="0" class="num count-input" data-field="dhikr-count" value="${esc(String(a.count || ""))}" ${t.done ? "" : "disabled"} placeholder="…" /> Mal geschafft.
        </label>
        <div class="card dhikr-info">
          <span class="label">Umschrift</span>
          <p class="dhikr-tr">${esc(d.tr)}</p>
          <span class="label">Übersetzung</span>
          <p class="dhikr-de">${esc(d.de)}</p>
          <span class="label">Belohnung</span>
          <p class="dhikr-reward">${esc(d.reward)}</p>
        </div>
      </div>`;
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
    const right = x.options.findIndex((o) => o.correct);
    return `
      <div class="activity">
        ${timerBar("Lesen · 4 Minuten", t.left, t.total, t.done)}
        ${heading("Pause · <span class=\"multi\">4 Minuten Lesen</span>", "Lies den Text, dann beantworte die Fragen am Schluss.", "Es geht gleich weiter.")}
        <article class="card read-text">
          <h2>${esc(x.title)}</h2>
          ${x.text
            .split(/\n+/)
            .map((p) => `<p>${esc(p)}</p>`)
            .join("")}
        </article>
        <div class="section-label">Frage</div>
        <p class="frage small">${esc(x.question)}</p>
        <div class="options">
          ${x.options
            .map((o, i) => {
              let st = "";
              if (a.choice !== null) st = o.correct ? (i === a.choice ? "ok" : "missed") : i === a.choice ? "bad" : "dim";
              return optionHtml(LETTERS[i], o.text, "text-answer", i, st, a.choice !== null);
            })
            .join("")}
        </div>
        ${a.choice !== null ? feedbackHtml(a.choice === right, right >= 0 ? x.options[right].text : "", "") : ""}
        ${
          t.done
            ? `<label class="note-field"><span>Das nehme ich von der Geschichte mit.</span>
                 <textarea rows="3" data-field="text-note" placeholder="Schreib es kurz auf …">${esc(a.note || "")}</textarea></label>`
            : ""
        }
      </div>`;
  }

  window.Activities = { init, dhikrHtml, quizHtml, textHtml, ring, mmss, DHIKR, QUIZ, TEXTS };
})();
