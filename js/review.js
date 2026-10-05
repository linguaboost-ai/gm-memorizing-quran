/*
 * Nachbereitung eines Abschnitts mit Inhalten (Sure Ghāfir):
 *
 *   Ordnen       nach jeder Wiederholung die Schlüsselwörter in die
 *                Reihenfolge des Abschnitts bringen – von oben nach unten,
 *                mit dem Auswahlrad unten (weiches Scrollfenster). Eine
 *                falsche Reihenfolge ist nicht möglich: falsche Einträge
 *                springen zurück.
 *                  1  Deutsch EMOJI arabisch, darunter das Versstück
 *                  2  Deutsch EMOJI arabisch
 *                  3  nur das Emoji
 *   Zusammenhang die Verse in Fragmenten mit Übersetzung, davor, dazwischen
 *                und danach die Übergänge nach al-Biqāʿī
 *                (ghafir_vorbereitung.md).
 *
 * Schlüsselwörter und Übergänge stammen aus der Vorbereitung
 * (CONTENT_PREP). Das Versstück eines Schlüsselworts reicht vom Beginn
 * seines Fragments (bzw. vom Versanfang beim ersten Schlüsselwort eines
 * Verses) bis vor das Stück des nächsten Schlüsselworts.
 */
(function () {
  "use strict";

  const Q = window.Quran;
  const esc = window.Fade.escapeHtml;
  const { shuffle, startDrag, holdToDrag } = window.Prep;

  const range = (n) => Array.from({ length: n }, (_, i) => i);

  /** Gemischt, aber (ab zwei Einträgen) nie schon in der richtigen Reihenfolge. */
  function mixed(n) {
    if (n < 2) return range(n);
    let a;
    do a = shuffle(range(n));
    while (a.every((x, i) => x === i));
    return a;
  }

  const wordsOfVerse = (v) => v.tokens.filter((t) => t.type === Q.TOKEN_WORD);

  /** Wörter als HTML in Mushaf-Schreibweise; mit `tap` antippbar (Tresor). */
  function wordsHtml(tokens, opts = {}) {
    return tokens
      .map((t) => {
        if (t.type === Q.TOKEN_AYAH_END) return `<span class="t ayah-end">${esc(t.text)}</span>`;
        if (t.type !== Q.TOKEN_WORD) return `<span class="t sym">${esc(t.text)}</span>`;
        const mark = opts.marked && opts.marked.has(`${t.key}:${t.w}`) ? " vault" : "";
        const attrs = opts.tap ? ` data-key="${t.key}" data-w="${t.w}"` : "";
        return `<span class="t w${mark}"${attrs}>${esc(t.display || t.text)}</span>`;
      })
      .join(" ");
  }

  /** Höchstens so viele Schlüsselwörter je Viertel einer Seite. */
  const KEYS_PER_QUARTER = 5;

  /**
   * Auswahl, wenn es mehr Schlüsselwörter gibt als erlaubt: zuerst das erste
   * jedes Verses (Versanfänge sind beim Auswendiglernen die wichtigsten
   * Anker), dann die, die die größten Lücken am gleichmäßigsten teilen.
   * Positionen g zählen die Wörter ab Abschnittsbeginn.
   */
  function pick(cands, limit, total) {
    if (cands.length <= limit) return cands;
    const fill = (chosen, rest) => {
      while (chosen.length < limit && rest.length) {
        let best = 0;
        let bestScore = -1;
        rest.forEach((c, i) => {
          const before = Math.max(0, ...chosen.filter((x) => x.g <= c.g).map((x) => x.g));
          const after = Math.min(total, ...chosen.filter((x) => x.g > c.g).map((x) => x.g));
          const score = Math.min(c.g - before, after - c.g);
          if (score > bestScore) {
            bestScore = score;
            best = i;
          }
        });
        chosen.push(rest.splice(best, 1)[0]);
      }
      return chosen;
    };
    const firsts = cands.filter((c, i) => i === 0 || cands[i - 1].vi !== c.vi);
    const chosen = firsts.length <= limit ? firsts.slice() : fill([firsts[0]], firsts.slice(1));
    return fill(chosen, cands.filter((c) => !chosen.includes(c))).sort((x, y) => x.g - y.g);
  }

  /**
   * Schlüsselwörter eines Abschnitts in Lesereihenfolge mit ihrem Versstück –
   * höchstens fünf je Viertel – oder null, wenn es für einen Vers keine gibt.
   * Das Versstück beginnt beim ersten Schlüsselwort eines Verses am
   * Versanfang, sonst am Anfang seines Fragments (bzw. beim Wort selbst), und
   * reicht bis vor das nächste Stück; Verse ohne ausgewähltes Schlüsselwort
   * gehören zum Stück davor.
   * @returns {Array<{ ar, emoji, de, verse, tokens, block }>}
   */
  function keysOf(unit, fragments) {
    const P = window.CONTENT_PREP || {};
    const flat = []; // Wörter und Versende-Zeichen des Abschnitts
    const wordAt = []; // Position im Abschnitt → Index in flat
    const cands = [];
    const verseStart = [];
    for (const [vi, v] of unit.verses.entries()) {
      const e = P[v.key];
      const kws = e ? e.blocks.filter((b) => b.t === "kw" && b.de && b.w !== undefined) : [];
      if (!kws.length) return null;
      verseStart[vi] = wordAt.length;
      for (const b of kws) cands.push({ b, v, vi, g: wordAt.length + b.w });
      for (const t of v.tokens) {
        if (t.type === Q.TOKEN_WORD) {
          wordAt.push(flat.length);
          flat.push(t);
        } else if (t.type === Q.TOKEN_AYAH_END) flat.push(t);
      }
    }
    const limit = KEYS_PER_QUARTER * (unit.quarters || 1);
    const chosen = pick(cands, limit, wordAt.length);
    const starts = chosen.map((c, i) => {
      if (i === 0) return 0;
      const prev = chosen[i - 1];
      if (prev.vi !== c.vi) return verseStart[c.vi];
      // Anfang des Fragments, in dem das Schlüsselwort steht (Waqf bzw. ghafir.csv)
      const near = fragments.filter((f) => f.key === c.v.key && f.words.length && f.words[0].w > prev.b.w && f.words[0].w <= c.b.w).map((f) => f.words[0].w);
      return verseStart[c.vi] + (near.length ? Math.max(...near) : c.b.w);
    });
    const out = chosen.map((c, i) => {
      const from = wordAt[starts[i]];
      const to = i + 1 < chosen.length ? wordAt[starts[i + 1]] : flat.length;
      return { ar: c.b.ar, emoji: c.b.emoji, de: c.b.de, verse: c.v.ayah, tokens: flat.slice(from, to), block: c.b };
    });
    return out.length >= 2 ? out : null;
  }

  /* ---------------------------------------------------------------- Ordnen */

  const SORTS = [
    { title: "Schlüsselwörter mit Versstück", frage: "In welcher Reihenfolge kommen sie im Abschnitt?" },
    { title: "Schlüsselwörter", frage: "Und jetzt ohne das Versstück?" },
    { title: "Emojis", frage: "Und jetzt nur mit den Emojis?" },
  ];

  const sortInit = (n) => ({ order: mixed(n), placed: 0, wheel: 0 });
  const sortValid = (st, n) => !!st && Array.isArray(st.order) && st.order.length === n && st.placed >= 0 && st.placed <= n;
  const sortDone = (st, n) => !!st && st.placed >= n;

  const keyLine = (k) => `<span class="kw-de">${esc(k.de)}</span><span class="kw-emo">${esc(k.emoji)}</span><bdi class="kw-ar" lang="ar">${esc(k.ar)}</bdi>`;

  /** Inhalt eines Eintrags für Ordnen k (0, 1, 2). */
  function itemHtml(k, key) {
    if (k === 2) return `<span class="kw-emo big">${esc(key.emoji)}</span>`;
    const line = `<div class="kw-line">${keyLine(key)}</div>`;
    return k === 0 ? `${line}<div class="kw-frag" lang="ar" dir="rtl">${wordsHtml(key.tokens)}</div>` : line;
  }

  /** Gleich aussehende Einträge (z. B. dasselbe Emoji) sind austauschbar. */
  function signature(k, key) {
    if (k === 2) return key.emoji;
    const s = `${key.de}|${key.emoji}|${key.ar}`;
    return k === 0 ? s + "|" + key.tokens.map((t) => t.text).join(" ") : s;
  }

  /** Blatt mit den eingesetzten Einträgen (oben). */
  function sortSheetHtml(k, st, keys) {
    const done = st.placed >= keys.length;
    return `
      <div class="section-label">Ordnen ${k + 1}/3 · <span class="multi">${SORTS[k].title}</span></div>
      <p class="frage">${SORTS[k].frage}</p>
      <div class="sort-sheet kind-${k}" data-drop="sheet">
        ${keys
          .map((key, i) => {
            const state = i < st.placed ? "placed" : i === st.placed ? "wanted" : "empty";
            return `<div class="sort-row ${state}">
              <span class="sort-no">${i + 1}</span>
              <div class="sort-cell">${state === "placed" ? itemHtml(k, key) : state === "wanted" ? `<span class="sort-hole">${i === 0 ? "Was kommt zuerst?" : "Was kommt als Nächstes?"}</span>` : ""}</div>
            </div>`;
          })
          .join("")}
      </div>
      ${done ? `<div class="order-done">Ma schā' Allāh – alles in der richtigen Reihenfolge.</div>` : ""}`;
  }

  /** Auswahlrad (unten, in der Fußleiste) – leer, wenn alles eingesetzt ist. */
  function sortWheelHtml(k, st, keys) {
    if (st.placed >= keys.length) return "";
    const rest = st.order.filter((id) => id >= st.placed);
    return `<div class="wheel-wrap in-footer kind-${k}">
        <div class="wheel">
          <div class="wheel-band" aria-hidden="true"></div>
          <div class="wheel-scroll" tabindex="0" aria-label="Auswahl – wischen, Mausrad oder Pfeiltasten">
            ${rest.map((id) => `<div class="wheel-item kind-${k}" data-id="${id}">${itemHtml(k, keys[id])}</div>`).join("")}
          </div>
          <button class="wheel-arrow up" data-wheel="-1" aria-label="Vorheriger Eintrag">▲</button>
          <button class="wheel-arrow down" data-wheel="1" aria-label="Nächster Eintrag">▼</button>
        </div>
        <button class="btn insert-btn" data-insert="1">↑ Einsetzen</button>
      </div>`;
  }

  /**
   * Auswahlrad wie beim iPhone: echte Scroll-Liste mit Einrasten (Scroll-Snap),
   * Schwung beim Wischen, Mausrad und Touchpad. Unschärfe, Transparenz und
   * Neigung hängen stufenlos vom Abstand zur Mitte ab – nur der mittlere
   * Eintrag ist klar lesbar. Einsetzen: nach oben ziehen oder „Einsetzen“.
   *
   * api: { save, render, buzz }
   */
  function mountSort(root, k, st, keys, api) {
    const wrap = root.querySelector(".wheel-wrap");
    const sheet = root.querySelector(".sort-sheet");
    // Gesuchte Zeile sichtbar halten (über der Fußleiste)
    // (erst nach dem Zeichnen, das die alte Scrollposition wiederherstellt)
    const wanted = sheet && (sheet.querySelector(".sort-row.wanted") || (st.placed >= keys.length && sheet.lastElementChild));
    if (wanted) {
      requestAnimationFrame(() => {
        if (!wanted.isConnected) return;
        const footer = document.querySelector(".footer");
        const r = wanted.getBoundingClientRect();
        const bottom = (footer ? footer.getBoundingClientRect().top : window.innerHeight) - 12;
        if (r.bottom > bottom || r.top < 60) window.scrollBy({ top: r.bottom > bottom ? r.bottom - bottom : r.top - 80, behavior: "smooth" });
      });
    }
    if (!wrap) return;
    const scroller = wrap.querySelector(".wheel-scroll");
    const items = Array.from(scroller.children);
    const band = wrap.querySelector(".wheel-band");
    const remaining = () => st.order.filter((id) => id >= st.placed);
    let current = -1;
    let frame = 0;
    let settleTimer = null;
    let target = null;

    function layout() {
      const h = scroller.clientHeight;
      scroller.style.paddingTop = Math.max(0, h / 2 - items[0].offsetHeight / 2) + "px";
      scroller.style.paddingBottom = Math.max(0, h / 2 - items[items.length - 1].offsetHeight / 2) + "px";
    }

    const offsetFor = (i) => items[i].offsetTop - scroller.clientHeight / 2 + items[i].offsetHeight / 2;

    function scrollToIndex(i, smooth) {
      i = Math.max(0, Math.min(items.length - 1, i));
      target = smooth ? i : null;
      scroller.scrollTo({ top: offsetFor(i), behavior: smooth ? "smooth" : "auto" });
    }

    const step = (dir) => scrollToIndex((target ?? current) + dir, true);

    function paint() {
      frame = 0;
      if (!scroller.isConnected) return;
      const box = scroller.getBoundingClientRect();
      const mid = box.top + box.height / 2;
      let best = 0;
      let bestDist = Infinity;
      items.forEach((it, i) => {
        const r = it.getBoundingClientRect();
        const d = r.top + r.height / 2 - mid;
        const ad = Math.abs(d);
        if (ad < bestDist) {
          bestDist = ad;
          best = i;
        }
        const blur = Math.min(6, ad / 12);
        it.style.filter = blur < 0.4 ? "none" : `blur(${blur.toFixed(1)}px)`;
        it.style.opacity = String(Math.max(0.2, 1 - ad / 150));
        const tilt = Math.max(-45, Math.min(45, -d / 3.5));
        it.style.transform = `perspective(700px) rotateX(${tilt.toFixed(1)}deg) scale(${Math.max(0.86, 1 - ad / 700).toFixed(3)})`;
      });
      if (best !== current) {
        current = best;
        items.forEach((it, i) => it.classList.toggle("current", i === best));
        band.style.height = items[best].offsetHeight + "px";
      }
    }

    function onScroll() {
      if (!frame) frame = requestAnimationFrame(paint);
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        target = null;
        st.wheel = current;
        api.save();
      }, 160);
    }

    // Maus mit Rasten: pro Raste genau ein Eintrag; Touchpad und Touch scrollen nativ
    function onWheel(e) {
      if (e.ctrlKey || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const w = e.wheelDeltaY;
      const notch = e.deltaMode !== 0 || (!!w && w % 120 === 0 && w !== -3 * e.deltaY);
      if (!notch) return;
      e.preventDefault();
      step(Math.sign(e.deltaY));
    }

    function tryInsert() {
      const rest = remaining();
      const id = rest[current];
      if (id === undefined) return false;
      if (id === st.placed || signature(k, keys[id]) === signature(k, keys[st.placed])) {
        if (id !== st.placed) {
          const a = st.order.indexOf(id);
          const b = st.order.indexOf(st.placed);
          [st.order[a], st.order[b]] = [st.order[b], st.order[a]];
        }
        st.placed++;
        st.wheel = Math.max(0, Math.min(current, rest.length - 2));
        api.save();
        api.render();
        return true;
      }
      const row = sheet && sheet.querySelector(".sort-row.wanted");
      if (row) {
        row.classList.remove("shake");
        void row.offsetWidth;
        row.classList.add("shake");
      }
      const it = items[current];
      if (it) {
        it.classList.remove("nope");
        void it.offsetWidth;
        it.classList.add("nope");
      }
      api.buzz();
      return false;
    }

    wrap.addEventListener("click", (e) => {
      const arrow = e.target.closest("[data-wheel]");
      if (arrow) return step(+arrow.dataset.wheel);
      const item = e.target.closest(".wheel-item");
      if (item && !item.classList.contains("current")) return scrollToIndex(items.indexOf(item), true);
      if (e.target.closest("[data-insert]")) tryInsert();
    });

    scroller.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        step(e.key === "ArrowDown" ? 1 : -1);
      } else if (e.key === "Enter") tryInsert();
    });

    // Mittleren Eintrag nach oben ziehen: Maus direkt, Touch nach kurzem Halten
    scroller.addEventListener("pointerdown", (e) => {
      const item = e.target.closest(".wheel-item.current");
      if (!item) return;
      holdToDrag(e, (ev) => {
        item.classList.add("lifted");
        startDrag(
          ev,
          item,
          item.innerHTML,
          (t) => {
            item.classList.remove("lifted");
            return !!t && t.dataset.drop === "sheet" && tryInsert();
          },
          `sort-ghost kind-${k}`
        );
      });
    });

    layout();
    scrollToIndex(st.wheel || 0, false);
    paint();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    scroller.addEventListener("wheel", onWheel, { passive: false });
    const relayout = () => {
      if (!scroller.isConnected) return;
      layout();
      scrollToIndex(current < 0 ? st.wheel || 0 : current, false);
      paint();
    };
    // Zeilenhöhen stimmen erst mit geladener Schrift
    if (document.fonts && document.fonts.status !== "loaded") document.fonts.ready.then(relayout);
    const onResize = () => (scroller.isConnected ? relayout() : window.removeEventListener("resize", onResize));
    window.addEventListener("resize", onResize);
  }

  /* ---------------------------------------------------------- Zusammenhang */

  const AR_RUN = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]+(?:\s+[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]+)*/g;
  const inline = (text) => esc(text).replace(AR_RUN, (m) => `<bdi class="ar-inline" lang="ar">${m}</bdi>`);

  const note = (label, text, cls) => `<aside class="ctx-note ${cls || ""}"><span class="ctx-label">${label}</span><p>${inline(text)}</p></aside>`;

  /**
   * Die Verse des Abschnitts in Fragmenten (arabisch, Übersetzung,
   * Schlüsselwörter) mit den Übergängen nach al-Biqāʿī: was davor kam,
   * zwischen den Versen, innerhalb eines Verses und wie es weitergeht.
   * Wörter sind antippbar (Tresor).
   */
  function contextHtml(info, marked) {
    const st = info.prep;
    const out = [];
    // nur die Schlüsselwörter, die auch beim Ordnen vorkommen
    const shown = new Set((info.keys || []).map((k) => k.block));
    if (st.before) out.push(note("Was davor kam", st.before, "before"));
    info.unit.verses.forEach((v, vi) => {
      const meta = st.verses[vi];
      if (vi > 0 && meta.into) out.push(note(`Übergang zu Vers ${v.ayah}`, meta.into, "into"));
      const frs = info.fragments.filter((f) => f.key === v.key);
      // Notizen innerhalb des Verses hinter das Fragment des vorangehenden Schlüsselworts
      const notesAfter = frs.map(() => []);
      const notesBefore = [];
      const kwOf = frs.map(() => []);
      let lastW = -1;
      for (const b of meta.blocks) {
        const fi = (w) => frs.findIndex((f) => f.words.length && f.words[0].w <= w && w <= f.words[f.words.length - 1].w);
        if (b.t === "kw") {
          if (b.w !== undefined) {
            lastW = b.w;
            const i = fi(b.w);
            if (i >= 0 && shown.has(b)) kwOf[i].push(b);
          }
        } else if (lastW < 0) notesBefore.push(b.text);
        else {
          const i = fi(lastW);
          (i >= 0 ? notesAfter[i] : notesBefore).push(b.text);
        }
      }
      const rows = [];
      notesBefore.forEach((t) => rows.push(note("Übergang", t, "inner")));
      frs.forEach((f, i) => {
        const tokens = f.end ? [...f.words, f.end] : f.words;
        rows.push(`<div class="ctx-frag">
            <div class="ctx-ar" lang="ar" dir="rtl">${wordsHtml(tokens, { tap: true, marked })}</div>
            ${f.de ? `<p class="ctx-de">${esc(f.de)}</p>` : ""}
            ${kwOf[i].length ? `<div class="ctx-kws">${kwOf[i].map((b) => `<span class="ctx-kw"><span class="kw-emo">${esc(b.emoji)}</span>${esc(b.de)}</span>`).join("")}</div>` : ""}
          </div>`);
        notesAfter[i].forEach((t) => rows.push(note("Übergang", t, "inner")));
      });
      out.push(`<section class="ctx-verse"><div class="ctx-verse-head"><span class="num-badge">${v.ayah}</span>Vers ${v.ayah}</div>${rows.join("")}</section>`);
    });
    if (st.after) out.push(note("Wie es weitergeht", st.after, "after"));
    return `
      <div class="section-label">Zusammenhang · <span class="multi">nach al-Biqāʿī</span></div>
      <p class="frage">Wie hängen die Verse zusammen?</p>
      <p class="hinweis">Lies die Verse Fragment für Fragment – mit dem, was davor kam, den Übergängen und wie es weitergeht.</p>
      <article class="ctx" id="ctx">${out.join("")}</article>`;
  }

  window.Review = { keysOf, wordsHtml, sortInit, sortValid, sortDone, sortSheetHtml, sortWheelHtml, mountSort, contextHtml, SORTS };
})();
