/*
 * Tresor: schwierige Stellen sammeln und gezielt wiederholen.
 *
 * Passiert beim Wiederholen aus dem Gedächtnis ein Fehler, tippt man auf das
 * Wort und legt es in den Tresor – als einzelnes Wort, als mehrere Wörter
 * (danach das letzte Wort antippen), als Fragment (bis zum nächsten
 * Pausenzeichen) oder als ganzen Vers. Kommt dieselbe Stelle wieder
 * dazu, zählt der Tresor mit: oben stehen die Stellen mit den meisten Fehlern.
 *
 * Üben: Der Anfang des Verses (bzw. das Ende des vorigen) steht da, die
 * Stelle selbst ist verdeckt. Aufsagen, aufdecken, dann „Gewusst“ oder
 * „Wieder Fehler“. Nach drei Mal „Gewusst“ in Folge gilt eine Stelle als
 * sitzend und rückt nach unten; „Sitzt – entfernen“ nimmt sie heraus.
 *
 * Eintrag: { id, s, a, w0, w1, kind: "word" | "words" | "frag" | "verse", n, ok, added, last }
 * (w0–w1: Wörter im Vers, 0-basiert; n: Fehler; ok: „Gewusst“ in Folge)
 */
(function () {
  "use strict";

  const Q = window.Quran;
  const esc = window.Fade.escapeHtml;
  const KIND = { word: "Wort", words: "Wörter", frag: "Fragment", verse: "Vers" };
  const SOLID = 3;

  const ref = (it) => `${Q.meta(it.s).tr} ${it.a}`;
  const find = (list, s, a, w0, w1) => list.find((x) => x.s === s && x.a === a && x.w0 === w0 && x.w1 === w1) || null;

  /** Stelle hinzufügen – oder, wenn sie schon drin ist, einen Fehler mehr zählen. */
  function add(list, s, a, w0, w1, kind) {
    const now = Date.now();
    let it = find(list, s, a, w0, w1);
    if (it) {
      it.n++;
      it.ok = 0;
      it.last = now;
    } else {
      it = { id: now.toString(36) + Math.random().toString(36).slice(2, 6), s, a, w0, w1, kind, n: 1, ok: 0, added: now, last: now };
      list.push(it);
    }
    return it;
  }

  /** Alle Wörter im Tresor als Menge „Sure:Vers:Wort“ (zum Markieren). */
  function marks(list) {
    const set = new Set();
    for (const it of list) for (let w = it.w0; w <= it.w1; w++) set.add(`${it.s}:${it.a}:${w}`);
    return set;
  }

  const solid = (it) => it.ok >= SOLID;

  /** Reihenfolge: offene Stellen mit den meisten Fehlern zuerst, sitzende zuletzt. */
  const sorted = (list) => list.slice().sort((x, y) => solid(x) - solid(y) || y.n - x.n || y.last - x.last);

  const wordsOf = (v) => v.tokens.filter((t) => t.type === Q.TOKEN_WORD);

  /** Wörter einer Stelle (Vers muss geladen sein). */
  function tokensOf(it) {
    const v = Q.verse(it.s, it.a);
    if (!v) return [];
    const words = wordsOf(v).slice(it.w0, it.w1 + 1);
    const end = v.tokens.find((t) => t.type === Q.TOKEN_AYAH_END);
    if (it.kind === "verse" && end) words.push(end);
    return words;
  }

  const arHtml = (tokens) =>
    tokens.map((t) => (t.type === Q.TOKEN_AYAH_END ? `<span class="t ayah-end">${esc(t.text)}</span>` : `<span class="t w">${esc(t.display || t.text)}</span>`)).join(" ");

  /* ------------------------------------------------------- Auswahl-Blatt */

  /**
   * Blatt nach dem Antippen eines Wortes: Wort, Fragment oder Vers in den
   * Tresor – oder ab hier anhören.
   * @param {object} o  { list, verse, w, frag: [w0, w1], canPlay }
   */
  function sheetHtml(o) {
    const v = o.verse;
    const words = wordsOf(v);
    const last = words.length - 1;
    const opts = [{ kind: "word", w0: o.w, w1: o.w }];
    if (o.frag && !(o.frag[0] === o.w && o.frag[1] === o.w) && !(o.frag[0] === 0 && o.frag[1] === last)) opts.push({ kind: "frag", w0: o.frag[0], w1: o.frag[1] });
    if (!(o.w === 0 && last === 0)) opts.push({ kind: "verse", w0: 0, w1: last });
    const row = (x) => {
      const it = find(o.list, v.surah, v.ayah, x.w0, x.w1);
      const text = x.kind === "verse" ? `${Q.meta(v.surah).tr}, Vers ${v.ayah}` : "";
      return `<button class="vault-opt" data-action="vault-add" data-value="${x.kind}:${x.w0}:${x.w1}">
          <span class="vault-kind">${KIND[x.kind]}</span>
          ${text ? `<span class="vault-opt-ref">${esc(text)}</span>` : `<span class="vault-opt-ar" lang="ar" dir="rtl">${arHtml(words.slice(x.w0, x.w1 + 1))}</span>`}
          <span class="vault-opt-count">${it ? `schon ${it.n}× drin · +1` : "in den Tresor"}</span>
        </button>`;
    };
    const range =
      last > 0
        ? `<button class="vault-opt" data-action="vault-range" data-value="${o.w}"><span class="vault-kind">${KIND.words}</span><span class="vault-opt-ref">Mehrere Wörter …<small>Danach das letzte Wort der Stelle antippen</small></span></button>`
        : "";
    return `<div class="sheet vault-sheet" role="dialog" aria-label="In den Tresor" data-key="${v.key}">
        <div class="sheet-head"><div class="sheet-head-row"><h3>🔒 In den Tresor</h3><button class="icon-btn" data-action="close-sheet" aria-label="Schließen">✕</button></div>
          <p class="hinweis">Hier hast du dich vertan? Leg die Stelle in den Tresor – dort kannst du sie später gezielt wiederholen.</p></div>
        <div class="sheet-list">${row(opts[0])}${range}${opts.slice(1).map(row).join("")}
          ${o.canPlay ? `<button class="vault-opt play" data-action="vault-listen" data-value="${v.key}"><span class="vault-kind">▶</span><span class="vault-opt-ref">Ab diesem Vers anhören</span></button>` : ""}
        </div>
      </div>`;
  }

  /* --------------------------------------------------------- Tresor-Seite */

  function itemHtml(it, playing) {
    return `<div class="card vault-item ${solid(it) ? "solid" : ""}">
        <div class="vault-item-head">
          <span class="vault-kind">${KIND[it.kind]}</span>
          <span class="vault-ref">${esc(ref(it))}</span>
          <span class="vault-n" title="Fehler">${it.n}× Fehler</span>
          ${solid(it) ? `<span class="vault-solid">✓ sitzt</span>` : it.ok ? `<span class="vault-ok">${it.ok}/${SOLID} gewusst</span>` : ""}
        </div>
        <div class="vault-ar" lang="ar" dir="rtl">${arHtml(tokensOf(it))}</div>
        <div class="vault-actions">
          <button class="chip-btn ${playing ? "on" : ""}" data-action="vault-play" data-value="${it.id}">${playing ? "❚❚ Stopp" : "▶ Anhören"}</button>
          <button class="chip-btn" data-action="vault-practice" data-value="${it.id}">Üben</button>
          <button class="chip-btn quiet" data-action="vault-remove" data-value="${it.id}">Sitzt – entfernen</button>
        </div>
      </div>`;
  }

  /** Liste der Tresor-Seite. */
  function listHtml(list, playingId) {
    if (!list.length) {
      return `<div class="vault-empty card">
          <div class="vault-empty-icon">🔒</div>
          <p><b>Der Tresor ist leer.</b></p>
          <p class="hinweis">Beim Wiederholen aus dem Gedächtnis tippst du auf ein Wort, bei dem du dich vertan hast – dann kannst du das Wort, das Fragment oder den ganzen Vers hier hineinlegen.</p>
        </div>`;
    }
    return sorted(list)
      .map((it) => itemHtml(it, playingId === it.id))
      .join("");
  }

  /* ---------------------------------------------------------------- Üben */

  /** Hinweis vor der Stelle: Wörter davor im Vers bzw. das Ende des vorigen Verses. */
  function cueTokens(it) {
    const v = Q.verse(it.s, it.a);
    if (!v) return { tokens: [], more: false, prev: false };
    if (it.w0 > 0) {
      const words = wordsOf(v).slice(0, it.w0);
      const from = Math.max(0, words.length - 7);
      return { tokens: words.slice(from), more: from > 0, prev: false };
    }
    const p = it.a > 1 ? Q.verse(it.s, it.a - 1) : null;
    if (!p) return { tokens: [], more: false, prev: false };
    const words = wordsOf(p);
    const end = p.tokens.find((t) => t.type === Q.TOKEN_AYAH_END);
    const tail = words.slice(Math.max(0, words.length - 4));
    if (end) tail.push(end);
    return { tokens: tail, more: words.length > 4, prev: true };
  }

  function practiceHtml(it, revealed, pos, total) {
    const cue = cueTokens(it);
    const target = tokensOf(it);
    const hidden = target
      .filter((t) => t.type === Q.TOKEN_WORD)
      .map((t) => `<span class="vault-hole" style="width:${Math.max(1.6, (t.display || t.text).length * 0.42).toFixed(1)}em"></span>`)
      .join(" ");
    const start = it.a === 1 && it.w0 === 0;
    return `
      <div class="section-label">Tresor üben · <span class="multi">${pos + 1} von ${total}</span></div>
      <p class="frage">${it.kind === "verse" ? `Wie lautet Vers ${it.a}?` : "Wie geht es weiter?"}</p>
      <p class="hinweis">${esc(ref(it))} · ${KIND[it.kind]} · ${it.n}× Fehler${it.ok ? ` · ${it.ok}/${SOLID} gewusst` : ""}</p>
      <div class="vault-card card">
        ${cue.prev ? `<span class="vault-cue-label">Ende von Vers ${it.a - 1}</span>` : start ? `<span class="vault-cue-label">Beginn der Sure ${esc(Q.meta(it.s).tr)}</span>` : ""}
        <div class="vault-practice" lang="ar" dir="rtl">
          ${cue.more ? `<span class="t dots">…</span> ` : ""}${arHtml(cue.tokens)}
          ${cue.prev ? `<span class="vault-break"></span>` : ""}
          <span class="vault-target ${revealed ? "shown" : ""}">${revealed ? arHtml(target) : hidden}</span>
        </div>
      </div>`;
  }

  window.Vault = { KIND, SOLID, add, marks, sorted, solid, find, tokensOf, sheetHtml, listHtml, practiceHtml, ref };
})();
