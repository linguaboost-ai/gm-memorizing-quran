/*
 * Fragmente eines Lernabschnitts und die Vorbereitung vor dem Auswendiglernen.
 *
 * Fragmente: Die Verse werden an den Waqf-Zeichen Mīm (ۘ), Jīm (ۚ), Ṣilī (ۖ)
 * und Qilī (ۗ) getrennt. Für Sure Ghāfir kommen Grenzen, Übersetzung,
 * Stichpunkte und Emoji aus den Inhaltsdateien (data/content.js).
 *
 * Vorbereitung (für Abschnitte mit Inhalten, ghafir_zeilen.csv und
 * ghafir_vorbereitung.md), je ein Schritt mit „Weiter“:
 *   Lesen      Der Abschnitt wie im Mushaf gesetzt (nur seine Zeilen, gleiche
 *              Schrift, Abstände, Position), unter jeder Zeile ihre deutsche
 *              Übersetzung; darunter die Nacherzählung mit Schlüsselwörtern,
 *              Emojis und Übergängen (Munāsaba).
 *   Ordnen     Die Schlüsselwörter (deutsch – Emoji – arabisch) stehen gemischt
 *              untereinander, mit Pfeilen dazwischen, und werden sortiert.
 *   Zuordnen   Die arabischen Schlüsselwörter in der richtigen Reihenfolge,
 *              links je ein Platzhalter für die deutsche Übersetzung.
 *   Emojis     Nur die Emojis, gemischt, in die richtige Reihenfolge bringen.
 *
 * Sortieren: Ziehen (Maus sofort, am Handy nach kurzem Gedrückthalten) oder
 * zwei Einträge nacheinander antippen, um sie zu tauschen.
 */
(function () {
  "use strict";

  const Q = window.Quran;
  const esc = window.Fade.escapeHtml;
  const WAQF_SPLIT = /[ۖۗۘۚ]/;

  /** Fragmente eines Abschnitts in Lesereihenfolge. */
  function fragmentsOf(unit) {
    const out = [];
    const table = window.CONTENT_FRAGMENTS || {};
    for (const v of unit.verses) {
      const words = v.tokens.filter((t) => t.type === Q.TOKEN_WORD);
      const end = v.tokens.find((t) => t.type === Q.TOKEN_AYAH_END);
      let bounds = table[v.key];
      if (!bounds) {
        bounds = [];
        words.forEach((w, i) => {
          if (WAQF_SPLIT.test(w.text) || i === words.length - 1) bounds.push({ end: i + 1 });
        });
      }
      const mun = (window.CONTENT_MUNASABA && window.CONTENT_MUNASABA.frag[v.key]) || [];
      let start = 0;
      bounds.forEach((b, i) => {
        const ws = words.slice(start, b.end);
        const last = i === bounds.length - 1;
        out.push({
          id: out.length,
          key: v.key,
          words: ws,
          end: last ? end || null : null,
          text: ws.map((w) => w.text).join(" ") + (last && end ? " " + end.text : ""),
          de: b.de || "",
          emoji: b.emoji || "",
          bullet: b.bullet || "",
          sub: b.sub || null,
          mun: mun[i] || null,
        });
        start = b.end;
      });
    }
    return out;
  }

  /** Munāsaba-Teile (n + 1) oder null, wenn für den Abschnitt keine vorliegen. */
  function munasabaOf(unit, fragments) {
    const M = window.CONTENT_MUNASABA;
    if (!M || !fragments.length || !fragments.every((f) => f.mun)) return null;
    const first = unit.verses[0];
    let before = null;
    if (first.ayah === 1) before = M.start[first.surah] || null;
    else {
      const prev = M.frag[`${first.surah}:${first.ayah - 1}`];
      before = prev && prev.length ? prev[prev.length - 1] : null;
    }
    if (!before) return null;
    return [before, ...fragments.map((f) => f.mun)];
  }

  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  /* ------------------------------------------------------ Ziehen & Ablegen */

  /**
   * Zeiger-basiertes Drag & Drop (Maus, Touch, Stift).
   * onDrop(target) → true: angenommen; false: Element springt zurück.
   */
  function startDrag(event, sourceEl, label, onDrop, className = "") {
    if (event.cancelable) event.preventDefault();
    const rect = sourceEl.getBoundingClientRect();
    const ghost = document.createElement("div");
    ghost.className = "drag-ghost " + className;
    ghost.innerHTML = label;
    ghost.style.width = rect.width + "px";
    ghost.style.left = rect.left + "px";
    ghost.style.top = rect.top + "px";
    document.body.appendChild(ghost);
    const dx = event.clientX - rect.left;
    const dy = event.clientY - rect.top;
    sourceEl.classList.add("dragging");
    let hover = null;
    // Am oberen/unteren Rand automatisch mitscrollen
    let pointerY = event.clientY;
    const footer = document.querySelector(".footer");
    const scroller = setInterval(() => {
      const bottom = window.innerHeight - (footer ? footer.offsetHeight : 0) - 30;
      if (pointerY < 80) window.scrollBy(0, -14);
      else if (pointerY > bottom) window.scrollBy(0, 14);
    }, 16);
    const move = (e) => {
      pointerY = e.clientY;
      ghost.style.left = e.clientX - dx + "px";
      ghost.style.top = e.clientY - dy + "px";
      ghost.style.visibility = "hidden";
      const under = document.elementFromPoint(e.clientX, e.clientY);
      ghost.style.visibility = "";
      const target = under && under.closest("[data-drop]");
      if (hover !== target) {
        if (hover) hover.classList.remove("drop-hover");
        hover = target;
        if (hover) hover.classList.add("drop-hover");
      }
    };
    const up = (e) => {
      clearInterval(scroller);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      if (hover) hover.classList.remove("drop-hover");
      sourceEl.classList.remove("dragging");
      blockTouch = false;
      const accepted = onDrop(e.type === "pointerup" ? hover : null);
      if (accepted) {
        ghost.remove();
        return;
      }
      // zurückspringen
      ghost.classList.add("returning");
      ghost.style.left = rect.left + "px";
      ghost.style.top = rect.top + "px";
      setTimeout(() => ghost.remove(), 260);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }

  // Während eines Touch-Ziehens darf die Seite nicht scrollen
  let blockTouch = false;
  document.addEventListener(
    "touchmove",
    (e) => {
      if (blockTouch) e.preventDefault();
    },
    { passive: false }
  );

  /**
   * Ziehen starten: mit der Maus ab 6px Bewegung, am Touchscreen nach kurzem
   * Gedrückthalten (sonst bleibt es normales Scrollen bzw. Antippen).
   */
  function holdToDrag(e, onLift) {
    if (e.button !== undefined && e.button !== 0) return;
    const x0 = e.clientX;
    const y0 = e.clientY;
    const mouse = e.pointerType === "mouse";
    let timer = null;
    const cleanup = () => {
      clearTimeout(timer);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", cleanup);
      window.removeEventListener("pointercancel", cleanup);
    };
    const lift = (ev) => {
      cleanup();
      if (!mouse) {
        blockTouch = true;
        if (navigator.vibrate) navigator.vibrate(10);
      }
      onLift(ev);
    };
    function move(ev) {
      const dist = Math.hypot(ev.clientX - x0, ev.clientY - y0);
      if (mouse) {
        if (dist > 6) lift(ev);
      } else if (dist > 8) cleanup();
    }
    if (!mouse) timer = setTimeout(() => lift(e), 260);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", cleanup);
    window.addEventListener("pointercancel", cleanup);
  }

  /* ------------------------------------------------------------ Vorbereitung */

  const range = (n) => Array.from({ length: n }, (_, i) => i);

  /** Gemischt, aber (ab zwei Einträgen) nie schon in der richtigen Reihenfolge. */
  function mixed(n) {
    if (n < 2) return range(n);
    let a;
    do a = shuffle(range(n));
    while (a.every((x, i) => x === i));
    return a;
  }

  const BASMALA_DE = "Im Namen Allahs, des Allerbarmers, des Barmherzigen.";

  /**
   * Inhalte der Vorbereitung für einen Abschnitt – oder null, wenn es für
   * einen seiner Verse keine gibt. Die Nacherzählung liegt je Viertel vor;
   * für größere Abschnitte werden die Verse aneinandergereiht, an den
   * Viertelgrenzen mit dem Übergang dazwischen.
   */
  function study(unit) {
    const P = window.CONTENT_PREP || {};
    const L = window.CONTENT_LINES || {};
    const vs = unit.verses;
    if (!vs.every((v) => P[v.key] && P[v.key].blocks.some((b) => b.t === "kw"))) return null;
    const keys = [];
    for (const v of vs) for (const b of P[v.key].blocks) if (b.t === "kw" && b.de) keys.push({ ar: b.ar, emoji: b.emoji, de: b.de, verse: v.ayah });
    if (keys.length < 2) return null;
    const first = vs[0];
    const last = vs[vs.length - 1];
    const next = P[`${last.surah}:${last.ayah + 1}`];
    return {
      keys,
      before: P[first.key].before || P[first.key].into || "",
      after: P[last.key].after || (next && next.into) || "",
      verses: vs.map((v, i) => ({ ayah: v.ayah, into: i > 0 ? P[v.key].into || "" : "", blocks: P[v.key].blocks })),
      /** Übersetzung der Abschnittswörter einer Mushaf-Zeile. */
      deOf(line) {
        if (line.kind === "b") return BASMALA_DE;
        const m = L[`${line.page}:${line.line}`] || {};
        return vs
          .filter((v) => m[v.key])
          .map((v) => m[v.key])
          .join(" ");
      },
    };
  }

  /** Startzustand der Übungen. */
  function init(st) {
    const n = st.keys.length;
    return { keys: mixed(n), keysOk: false, placed: range(n).map(() => false), pool: shuffle(range(n)), emojis: mixed(n), emojisOk: false };
  }

  const valid = (p, st) => !!p && Array.isArray(p.keys) && p.keys.length === st.keys.length && p.emojis.length === st.keys.length && p.placed.length === st.keys.length;

  /** Ist der Schritt geschafft? */
  function isDone(step, p) {
    if (step === "keys") return p.keysOk;
    if (step === "match") return p.placed.every(Boolean);
    if (step === "emojis") return p.emojisOk;
    return true;
  }

  // Vorübergehende Anzeige: angetippter Eintrag, Prüfergebnis, Fehlversuch
  let selected = null; // { list, pos } oder { chip: i }
  let checked = null; // Liste, deren Reihenfolge geprüft angezeigt wird
  let shake = null;

  function reset() {
    selected = null;
    checked = null;
    shake = null;
  }

  /* ---- Darstellung */

  const AR_RUN = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]+(?:\s+[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]+)*/g;

  /** Fließtext mit arabischen Wörtern (diese isoliert, in Mushaf-Schrift). */
  const inline = (text) => esc(text).replace(AR_RUN, (m) => `<bdi class="ar-inline" lang="ar">${m}</bdi>`);

  const quote = (text, title) => `<blockquote class="story-note">${title ? `<strong>${esc(title)}</strong>` : ""}<em>${inline(text)}</em></blockquote>`;

  /** Nacherzählung im Format der Vorgabe (Überschriften, fette Absätze, Zitatblöcke). */
  function storyHtml(st) {
    const out = [];
    if (st.before) out.push(`<h2>Was davor kam</h2>${quote(st.before)}`);
    for (const v of st.verses) {
      if (v.into) out.push(quote(v.into, `Übergang zu Vers ${v.ayah}`));
      out.push(`<h2>Vers ${v.ayah}</h2>`);
      for (const b of v.blocks) {
        if (b.t === "kw") out.push(`<h3><bdi class="ar-inline" lang="ar">${esc(b.ar)}</bdi> ${esc(b.emoji)}</h3><p class="story-p"><strong>${inline(b.text)}</strong></p>`);
        else out.push(quote(b.text));
      }
    }
    if (st.after) out.push(`<h2>Wie es weitergeht</h2>${quote(st.after)}`);
    return `<article class="story" dir="ltr">${out.join("")}</article>`;
  }

  const heading = (label, frage, hinweis) =>
    `<div class="section-label">${label}</div>${frage ? `<p class="frage">${frage}</p>` : ""}${hinweis ? `<p class="hinweis">${hinweis}</p>` : ""}`;

  const DRAG_HINT = "Zieh die Einträge an die richtige Stelle – oder tippe zwei nacheinander an, um sie zu tauschen.";

  /** Sortierbare Liste: Einträge in der aktuellen Reihenfolge, Pfeile dazwischen. */
  function sortableHtml(list, order, ok, item, arrow) {
    const isChecked = checked === list && !ok;
    return `<div class="sortable sort-${list} ${ok ? "done" : ""}" data-sort="${list}">${order
      .map((k, pos) => {
        const cls = ["sort-item"];
        if (ok) cls.push("ok");
        else if (isChecked) cls.push(k === pos ? "ok" : "bad");
        if (selected && selected.list === list && selected.pos === pos) cls.push("selected");
        return `${pos ? `<span class="sort-arrow" aria-hidden="true">${arrow}</span>` : ""}<div class="${cls.join(" ")}" data-drop="item" data-pos="${pos}" role="button" tabindex="0">${item(k)}</div>`;
      })
      .join("")}</div>`;
  }

  /**
   * HTML eines Vorbereitungsschritts.
   * @param {string} step   "read" | "keys" | "match" | "emojis"
   */
  function view(step, p, info) {
    const st = info.prep;
    const n = st.keys.length;
    if (step === "read") {
      return `
        <div class="section-label">Vorbereitung · <span class="multi">Lesen und verstehen</span></div>
        <div class="prep-text" id="prep-lines">${window.Mushaf.linesHtml(info.unit, st.deOf)}</div>
        ${storyHtml(st)}`;
    }
    if (step === "keys") {
      const item = (k) => `<span class="grip" aria-hidden="true">⠿</span><span class="kw-de">${esc(st.keys[k].de)}</span><span class="kw-emo">${esc(st.keys[k].emoji)}</span><bdi class="kw-ar" lang="ar">${esc(st.keys[k].ar)}</bdi>`;
      return `
        ${heading("Vorbereitung · <span class=\"multi\">Schlüsselwörter ordnen</span>", "In welcher Reihenfolge kommen sie im Abschnitt?", DRAG_HINT)}
        ${sortableHtml("keys", p.keys, p.keysOk, item, "↓")}
        ${p.keysOk ? `<div class="order-done">Ma schā' Allāh – die Reihenfolge stimmt.</div>` : `<button class="btn secondary check-btn" data-action="prep" data-value="check:keys">Prüfen</button>`}`;
    }
    if (step === "match") {
      const done = p.placed.every(Boolean);
      const sel = selected && selected.chip !== undefined ? selected.chip : null;
      return `
        ${heading("Vorbereitung · <span class=\"multi\">Übersetzung zuordnen</span>", "Was bedeuten die Schlüsselwörter?", "Zieh jedes deutsche Wort auf den Platzhalter links neben seinem arabischen Wort – oder tippe erst das Wort, dann den Platzhalter an.")}
        <div class="match-list">${st.keys
          .map(
            (k, i) => `<div class="match-row">
              <div class="match-slot ${p.placed[i] ? "filled" : sel !== null ? "armed" : ""} ${shake === "slot:" + i ? "shake" : ""}" data-drop="slot" data-i="${i}">${p.placed[i] ? esc(k.de) : ""}</div>
              <bdi class="kw-ar" lang="ar">${esc(k.ar)}</bdi>
            </div>`
          )
          .join("")}</div>
        ${
          done
            ? `<div class="order-done">Ma schā' Allāh – alles richtig zugeordnet.</div>`
            : `<div class="match-pool" data-drop="pool">${p.pool
                .filter((i) => !p.placed[i])
                .map((i) => `<button class="match-chip ${sel === i ? "selected" : ""} ${shake === "chip:" + i ? "shake" : ""}" data-chip="${i}">${esc(st.keys[i].de)}</button>`)
                .join("")}</div>`
        }`;
    }
    const item = (k) => `<span class="kw-emo">${esc(st.keys[k].emoji)}</span>`;
    return `
      ${heading("Vorbereitung · <span class=\"multi\">Emojis ordnen</span>", "Und jetzt nur mit den Emojis?", DRAG_HINT)}
      ${sortableHtml("emojis", p.emojis, p.emojisOk, item, "→")}
      ${p.emojisOk ? `<div class="order-done">Ma schā' Allāh – die Geschichte steht.</div>` : `<button class="btn secondary check-btn" data-action="prep" data-value="check:emojis">Prüfen</button>`}`;
  }

  /* ---- Bedienung */

  /** Eintrag von Platz `from` an Platz `to` verschieben. */
  function moveItem(p, list, from, to, api) {
    const order = p[list];
    if (from === to) return;
    const [k] = order.splice(from, 1);
    order.splice(to, 0, k);
    afterChange(p, list, api);
  }

  function swapItems(p, list, a, b, api) {
    const order = p[list];
    [order[a], order[b]] = [order[b], order[a]];
    afterChange(p, list, api);
  }

  function afterChange(p, list, api) {
    selected = null;
    checked = null;
    if (p[list].every((k, i) => k === i)) p[list + "Ok"] = true;
    api.save();
    api.render();
  }

  function placeChip(p, chip, slot, api) {
    if (chip !== slot) {
      shake = "slot:" + slot;
      selected = null;
      if (navigator.vibrate) navigator.vibrate(40);
      api.render();
      api.later(() => {
        if (shake !== "slot:" + slot) return;
        shake = null;
        api.render();
      }, 600);
      return false;
    }
    p.placed[slot] = true;
    selected = null;
    api.save();
    api.render();
    return true;
  }

  /** Klicks auf Knöpfe (data-action="prep"). */
  function act(p, value) {
    const [what, list] = String(value).split(":");
    if (what === "check") {
      checked = list;
      selected = null;
      return true;
    }
    return false;
  }

  /**
   * Ziehen und Antippen einbinden (nach jedem Zeichnen).
   * api: { save, render, later }
   */
  function mount(root, step, p, api) {
    const sortEl = root.querySelector(".sortable:not(.done)");
    if (sortEl) {
      const list = sortEl.dataset.sort;
      let dragged = false;
      sortEl.addEventListener("pointerdown", (e) => {
        const it = e.target.closest(".sort-item");
        if (!it) return;
        dragged = false;
        holdToDrag(e, (ev) => {
          dragged = true;
          const from = +it.dataset.pos;
          startDrag(ev, it, it.innerHTML, (target) => {
            if (!target || target.dataset.drop !== "item") return false;
            moveItem(p, list, from, +target.dataset.pos, api);
            return true;
          }, "sort-ghost");
        });
      });
      sortEl.addEventListener("click", (e) => {
        const it = e.target.closest(".sort-item");
        if (!it || dragged) return;
        const pos = +it.dataset.pos;
        if (selected && selected.list === list && selected.pos !== pos) return swapItems(p, list, selected.pos, pos, api);
        selected = selected && selected.list === list && selected.pos === pos ? null : { list, pos };
        api.render();
      });
      sortEl.addEventListener("keydown", (e) => {
        const it = e.target.closest(".sort-item");
        if (it && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          it.click();
        }
      });
    }
    const pool = root.querySelector(".match-pool");
    if (pool) {
      let dragged = false;
      pool.addEventListener("pointerdown", (e) => {
        const chip = e.target.closest("[data-chip]");
        if (!chip) return;
        dragged = false;
        holdToDrag(e, (ev) => {
          dragged = true;
          const i = +chip.dataset.chip;
          startDrag(ev, chip, esc(chip.textContent), (target) => !!target && target.dataset.drop === "slot" && !p.placed[+target.dataset.i] && placeChip(p, i, +target.dataset.i, api), "chip-ghost");
        });
      });
      pool.addEventListener("click", (e) => {
        const chip = e.target.closest("[data-chip]");
        if (!chip || dragged) return;
        const i = +chip.dataset.chip;
        selected = selected && selected.chip === i ? null : { chip: i };
        api.render();
      });
      root.querySelectorAll('.match-slot:not(.filled)').forEach((slot) =>
        slot.addEventListener("click", () => {
          if (selected && selected.chip !== undefined) placeChip(p, selected.chip, +slot.dataset.i, api);
        })
      );
    }
    const lines = root.querySelector("#prep-lines");
    if (lines) window.Mushaf.fitLines(lines);
  }

  window.Prep = { fragmentsOf, munasabaOf, shuffle, startDrag, holdToDrag, study, init, valid, isDone, view, act, mount, reset };
})();
