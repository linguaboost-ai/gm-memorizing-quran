/*
 * Vorbereitung eines Lernabschnitts.
 *
 * Fragmente: Die Verse werden an den Waqf-Zeichen Mīm (ۘ), Jīm (ۚ), Ṣilī (ۖ)
 * und Qilī (ۗ) getrennt. Für Sure Ghāfir kommen Grenzen, Übersetzung und
 * Emoji aus ghafir.csv (data/content.js).
 *
 * 1a „Emojis zuordnen“: Die Fragmente stehen untereinander, rechts daneben eine
 *    schmale Spalte, in die Emojis per Drag & Drop gezogen werden.
 * 1b „Reihenfolge“: Die Fragmente verschwinden, die Emojis bleiben. Aus einem
 *    Auswahlrad (nur das mittlere Fragment ist lesbar) wird der Reihe nach das
 *    jeweils gesuchte Fragment nach oben gezogen; falsche springen zurück.
 * 1c „Munāsaba“: Die Teile des Zusammenhangs (Aussage + Frage, die das
 *    nächste Fragment beantwortet) stehen gemischt untereinander und werden
 *    in die Lücken vor, zwischen und nach den Fragmenten gezogen. Erst danach
 *    lässt sich die Munāsaba beim Lernen einblenden.
 *
 * Munāsaba-Teile eines Abschnitts mit n Fragmenten: n + 1 Stück. Teil 0 steht
 * vor dem ersten Fragment (Einstieg der Sure oder der Teil des vorigen
 * Fragments), Teil g (g ≥ 1) nach Fragment g.
 */
(function () {
  "use strict";

  const Q = window.Quran;
  const esc = window.Fade.escapeHtml;
  const WAQF_SPLIT = /[ۖۗۘۚ]/;
  const GENERIC = ["📖", "🤲", "☝️", "🔥", "🌳", "👑", "🛡️", "⚖️", "🌍", "💧", "🌙", "☀️", "⭐", "🗣️", "❤️", "👥", "🏆", "⏳", "🚪", "📜", "🌧️", "🕊️", "⚡", "🌊", "⛰️", "🌱", "🔑", "👁️", "✋", "🏠"];

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

  /** Ein Munāsaba-Teil: Aussage und Frage. */
  function partHtml(p) {
    return `<p class="mun-t">${esc(p.t)}</p>${p.q ? `<p class="mun-q"><span aria-hidden="true">❓</span> ${esc(p.q)}</p>` : ""}`;
  }

  /** Zeile zwischen zwei Fragmenten (die Emoji-Spalte läuft weiter). */
  const gapRow = (inner, cls = "", attrs = "") => `<div class="frag-row gap ${cls}"${attrs}><div class="gap-main">${inner}</div><div class="frag-slot blank"></div></div>`;

  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  /** Emojis zur Auswahl: die hinterlegten (gemischt) oder eine allgemeine Auswahl. */
  function palette(fragments) {
    const own = fragments.map((f) => f.emoji).filter(Boolean);
    if (own.length === fragments.length) return { items: shuffle(own), unlimited: false };
    return { items: GENERIC.slice(), unlimited: true };
  }

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

  /* ---------------------------------------------------- 1a Emojis zuordnen */

  /**
   * @param {HTMLElement} el     Container
   * @param {object} st          { fragments, emojis: [emoji|null], showDe, palette }
   * @param {Function} changed   wird nach jeder Änderung aufgerufen
   */
  function mountAssign(el, st, changed) {
    let selected = null; // Tipp-Alternative: erst Emoji, dann Feld antippen

    const available = () => {
      if (st.palette.unlimited) return st.palette.items.map((e, i) => ({ e, i }));
      const used = {};
      for (const e of st.emojis) if (e) used[e] = (used[e] || 0) + 1;
      return st.palette.items
        .map((e, i) => ({ e, i }))
        .filter(({ e }) => {
          if (used[e]) {
            used[e]--;
            return false;
          }
          return true;
        });
    };

    function render() {
      const done = st.emojis.filter(Boolean).length;
      el.innerHTML = `
        <div class="prep-bar">
          <span class="status-text">${done} / ${st.fragments.length} zugeordnet</span>
          <span class="toggles">
            ${st.fragments.some((f) => f.de) ? `<label class="switch-row"><input type="checkbox" class="switch" data-prep="toggle-de" ${st.showDe ? "checked" : ""} />Übersetzung</label>` : ""}
          </span>
        </div>
        <div class="emoji-tray" data-drop="tray">
          ${available()
            .map(({ e, i }) => `<span class="emoji-chip ${selected === i ? "selected" : ""}" data-tray="${i}">${e}</span>`)
            .join("") || `<span class="status-text">Alle Emojis sind verteilt.</span>`}
        </div>
        <div class="frag-sheet">
          ${st.fragments
            .map(
              (f, i) => `
            <div class="frag-row">
              <div class="frag-main">
                <div class="frag-ar">${esc(f.text)}</div>
                ${st.showDe && f.de ? `<div class="frag-de">${esc(f.de)}</div>` : ""}
              </div>
              <div class="frag-slot ${st.emojis[i] ? "filled" : ""}" data-drop="slot" data-i="${i}">
                ${st.emojis[i] ? `<span class="emoji-chip in-slot" data-slot-emoji="${i}">${st.emojis[i]}</span>` : ""}
              </div>
            </div>`
            )
            .join("")}
        </div>
        <p class="how">Zieh ein Emoji in die Spalte neben das passende Fragment (oder tippe erst das Emoji, dann das Feld an). Zurück in die Leiste ziehen entfernt es wieder.</p>`;
    }

    function assign(slot, emoji, fromSlot) {
      if (fromSlot !== undefined && fromSlot !== null) st.emojis[fromSlot] = st.emojis[slot] && !st.palette.unlimited ? st.emojis[slot] : null;
      st.emojis[slot] = emoji;
      selected = null;
      render();
      changed();
    }

    el.addEventListener("click", (e) => {
      const t = e.target;
      if (t.closest("[data-prep='toggle-de']")) {
        st.showDe = !st.showDe;
        render();
        changed();
        return;
      }
      const chip = t.closest("[data-tray]");
      if (chip) {
        selected = selected === +chip.dataset.tray ? null : +chip.dataset.tray;
        render();
        return;
      }
      const slot = t.closest("[data-drop='slot']");
      if (slot && selected !== null) assign(+slot.dataset.i, st.palette.items[selected]);
    });

    el.addEventListener("pointerdown", (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      const trayChip = e.target.closest("[data-tray]");
      const slotChip = e.target.closest("[data-slot-emoji]");
      const chip = trayChip || slotChip;
      if (!chip) return;
      const emoji = chip.textContent;
      const fromSlot = slotChip ? +slotChip.dataset.slotEmoji : null;
      let moved = false;
      const x0 = e.clientX;
      const y0 = e.clientY;
      const pre = (ev) => {
        if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > 6 && !moved) {
          moved = true;
          window.removeEventListener("pointermove", pre);
          startDrag(ev, chip, emoji, (target) => {
            if (!target) return false;
            if (target.dataset.drop === "slot") {
              assign(+target.dataset.i, emoji, fromSlot);
              return true;
            }
            if (target.dataset.drop === "tray" && fromSlot !== null) {
              st.emojis[fromSlot] = null;
              render();
              changed();
              return true;
            }
            return false;
          }, "emoji-ghost");
        }
      };
      const cancel = () => {
        window.removeEventListener("pointermove", pre);
        window.removeEventListener("pointerup", cancel);
      };
      window.addEventListener("pointermove", pre);
      window.addEventListener("pointerup", cancel);
    });

    render();
  }

  /* ------------------------------------------------- 1b Reihenfolge finden */

  /**
   * Auswahlrad wie beim iPhone: echte Scroll-Liste mit Einrasten (Scroll-Snap),
   * Schwung beim Wischen, Mausrad und Touchpad. Unschärfe, Transparenz und
   * Neigung hängen stufenlos vom Abstand zur Mitte ab – nur das mittlere
   * Fragment ist lesbar.
   *
   * @param {HTMLElement} el
   * @param {object} st         { fragments, emojis, order: [ids gemischt], placed, wheel }
   * @param {Function} changed
   */
  function mountOrder(el, st, changed) {
    const remaining = () => st.order.filter((id) => id >= st.placed);
    let scroller = null;
    let items = [];
    let current = 0;
    let frame = 0;
    let settleTimer = null;
    let target = null; // Ziel einer laufenden Animation (Pfeile, Mausrad-Rasten)

    function render() {
      const hadFocus = !!scroller && document.activeElement === scroller;
      const rest = remaining();
      if (st.wheel >= rest.length) st.wheel = Math.max(0, rest.length - 1);
      const done = st.placed >= st.fragments.length;
      el.innerHTML = `
        <div class="prep-bar">
          <span class="status-text">${done ? "Alle Fragmente eingesetzt" : `Gesucht: Fragment ${st.placed + 1} von ${st.fragments.length}`}</span>
        </div>
        <div class="frag-sheet" data-drop="sheet">
          ${st.fragments
            .map((f, i) => {
              const state = i < st.placed ? "placed" : i === st.placed ? "wanted" : "empty";
              return `
            <div class="frag-row ${state}">
              <div class="frag-main">
                ${state === "placed" ? `<div class="frag-ar">${esc(f.text)}</div>` : `<div class="frag-hole">${state === "wanted" ? `Fragment ${i + 1} hier einsetzen` : ""}</div>`}
              </div>
              <div class="frag-slot filled">${st.emojis[i] ? `<span class="emoji-chip in-slot">${st.emojis[i]}</span>` : ""}</div>
            </div>`;
            })
            .join("")}
        </div>
        ${
          done
            ? `<div class="order-done">Ma schā' Allāh – alle Fragmente stehen an ihrem Platz.</div>`
            : `<div class="wheel-wrap">
          <button class="wheel-arrow" data-wheel="-1" aria-label="Vorheriges Fragment">▲</button>
          <div class="wheel">
            <div class="wheel-band" aria-hidden="true"></div>
            <div class="wheel-scroll" tabindex="0" aria-label="Fragmente – wischen, Mausrad oder Pfeiltasten">
              ${rest.map((id) => `<div class="wheel-item" data-id="${id}">${esc(st.fragments[id].text)}</div>`).join("")}
            </div>
          </div>
          <button class="wheel-arrow" data-wheel="1" aria-label="Nächstes Fragment">▼</button>
          <button class="btn secondary insert-btn" data-insert="1">↑ Einsetzen</button>
        </div>
        <p class="how">Wische zum gesuchten Fragment und zieh es nach oben (am Handy: kurz gedrückt halten, dann ziehen). Falsche Fragmente springen zurück.</p>`
        }`;
      scroller = el.querySelector(".wheel-scroll");
      items = scroller ? Array.from(scroller.children) : [];
      if (!scroller) return;
      layout();
      scrollToIndex(st.wheel, false);
      paint();
      scroller.addEventListener("scroll", onScroll, { passive: true });
      scroller.addEventListener("wheel", onWheel, { passive: false });
      if (hadFocus) scroller.focus({ preventScroll: true });
      // Zeilenhöhen stimmen erst mit geladener Schrift
      if (document.fonts && document.fonts.status !== "loaded") document.fonts.ready.then(relayout);
    }

    function relayout() {
      if (!scroller || !scroller.isConnected) return;
      layout();
      scrollToIndex(current, false);
      paint();
    }

    /** Innenabstand, damit auch das erste und letzte Fragment mittig stehen können. */
    function layout() {
      const h = scroller.clientHeight;
      const first = items[0];
      const last = items[items.length - 1];
      scroller.style.paddingTop = Math.max(0, h / 2 - first.offsetHeight / 2) + "px";
      scroller.style.paddingBottom = Math.max(0, h / 2 - last.offsetHeight / 2) + "px";
    }

    function offsetFor(i) {
      const it = items[i];
      return it.offsetTop - scroller.clientHeight / 2 + it.offsetHeight / 2;
    }

    function scrollToIndex(i, smooth) {
      i = Math.max(0, Math.min(items.length - 1, i));
      target = smooth ? i : null;
      scroller.scrollTo({ top: offsetFor(i), behavior: smooth ? "smooth" : "auto" });
    }

    /** Einen Schritt weiter – auch mehrfach schnell hintereinander. */
    function step(dir) {
      scrollToIndex((target ?? current) + dir, true);
    }

    function onScroll() {
      if (!frame) frame = requestAnimationFrame(paint);
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        target = null;
        st.wheel = current;
        changed();
      }, 160);
    }

    // Maus mit Rasten: pro Raste genau ein Fragment (weich animiert).
    // Touchpad und Touch scrollen nativ mit Schwung und rasten ein.
    // Rasten erkennt man an wheelDeltaY in 120er-Schritten (Chrome, Edge,
    // Safari) bzw. an zeilenweisem deltaMode (Firefox); das Mac-Touchpad
    // liefert wheelDeltaY = -3 · deltaY.
    function onWheel(e) {
      if (e.ctrlKey || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const w = e.wheelDeltaY;
      const notch = e.deltaMode !== 0 || (!!w && w % 120 === 0 && w !== -3 * e.deltaY);
      if (!notch) return;
      e.preventDefault();
      step(Math.sign(e.deltaY));
    }

    /** Stil jedes Eintrags nach seinem Abstand zur Mitte. */
    function paint() {
      frame = 0;
      if (!scroller || !scroller.isConnected) return;
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
        const blur = Math.min(8, ad / 9);
        it.style.filter = blur < 0.4 ? "none" : `blur(${blur.toFixed(1)}px)`;
        it.style.opacity = String(Math.max(0.18, 1 - ad / 170));
        const tilt = Math.max(-50, Math.min(50, -d / 4));
        it.style.transform = `perspective(700px) rotateX(${tilt.toFixed(1)}deg) scale(${Math.max(0.84, 1 - ad / 800).toFixed(3)})`;
      });
      if (best !== current || !items[best].classList.contains("current")) {
        current = best;
        items.forEach((it, i) => it.classList.toggle("current", i === best));
        const band = el.querySelector(".wheel-band");
        if (band) band.style.height = items[best].offsetHeight + "px";
      }
    }

    function tryInsert() {
      const id = remaining()[current];
      if (id === undefined) return false;
      if (id === st.placed) {
        st.placed++;
        st.wheel = current;
        render();
        changed();
        return true;
      }
      const wanted = el.querySelector(".frag-row.wanted");
      if (wanted) {
        wanted.classList.remove("shake");
        void wanted.offsetWidth;
        wanted.classList.add("shake");
      }
      if (navigator.vibrate) navigator.vibrate(40);
      return false;
    }

    el.addEventListener("click", (e) => {
      const arrow = e.target.closest("[data-wheel]");
      if (arrow && scroller) return step(+arrow.dataset.wheel);
      const item = e.target.closest(".wheel-item");
      if (item && scroller && !item.classList.contains("current")) return scrollToIndex(items.indexOf(item), true);
      if (e.target.closest("[data-insert]")) tryInsert();
    });

    el.addEventListener("keydown", (e) => {
      if (!e.target.closest(".wheel-scroll")) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        step(e.key === "ArrowDown" ? 1 : -1);
      } else if (e.key === "Enter") {
        tryInsert();
      }
    });

    // Mittleres Fragment nach oben ziehen: mit der Maus direkt, am Touchscreen
    // nach kurzem Gedrückthalten (sonst ist es normales Wischen).
    el.addEventListener("pointerdown", (e) => {
      const item = e.target.closest(".wheel-item.current");
      if (!item) return;
      holdToDrag(e, (ev) => {
        item.classList.add("lifted");
        startDrag(
          ev,
          item,
          esc(item.textContent),
          (target) => {
            item.classList.remove("lifted");
            return !!target && target.dataset.drop === "sheet" && tryInsert();
          },
          "frag-ghost"
        );
      });
    });

    const onResize = () => {
      if (!el.isConnected) return window.removeEventListener("resize", onResize);
      relayout();
    };
    window.addEventListener("resize", onResize);

    render();
  }

  /* ----------------------------------------------------- 1c Munāsaba zuordnen */

  /**
   * @param {HTMLElement} el
   * @param {object} st        { fragments, emojis, parts, order: [Teil-Ids gemischt], placed: [bool], showDe }
   * @param {Function} changed
   */
  function mountLink(el, st, changed) {
    let selected = null; // Tipp-Alternative: erst Teil, dann Lücke antippen
    const n = st.parts.length;

    function render() {
      const done = st.placed.filter(Boolean).length;
      const pool = st.order.filter((id) => !st.placed[id]);
      if (selected !== null && st.placed[selected]) selected = null;
      const gap = (g) =>
        st.placed[g]
          ? gapRow(partHtml(st.parts[g]), "placed", ` data-g="${g}"`)
          : gapRow(`<span class="gap-label">${selected !== null ? "Hier ablegen?" : "Munāsaba-Teil hierher ziehen"}</span>`, "open" + (selected !== null ? " armed" : ""), ` data-drop="gap" data-g="${g}"`);
      el.innerHTML = `
        <div class="prep-bar">
          <span class="status-text">${done} / ${n} zugeordnet</span>
          <span class="toggles">
            ${st.fragments.some((f) => f.de) ? `<label class="switch-row"><input type="checkbox" class="switch" data-prep="toggle-de" ${st.showDe ? "checked" : ""} />Übersetzung</label>` : ""}
          </span>
        </div>
        <div class="frag-sheet link-sheet">
          ${st.fragments
            .map(
              (f, i) => `${gap(i)}
            <div class="frag-row">
              <div class="frag-main">
                <div class="frag-ar">${esc(f.text)}</div>
                ${st.showDe && f.de ? `<div class="frag-de">${esc(f.de)}</div>` : ""}
              </div>
              <div class="frag-slot filled">${st.emojis[i] ? `<span class="emoji-chip in-slot">${st.emojis[i]}</span>` : ""}</div>
            </div>`
            )
            .join("")}
          ${gap(st.fragments.length)}
        </div>
        ${
          pool.length
            ? `<div class="mun-pool-head"><h3>Munāsaba-Teile</h3><span class="status-text">${pool.length} übrig · gemischt</span></div>
          <div class="mun-pool">${pool
            .map((id) => `<div class="mun-card ${selected === id ? "selected" : ""}" data-card="${id}" role="button" tabindex="0">${partHtml(st.parts[id])}</div>`)
            .join("")}</div>
          <p class="how">Jeder Teil besteht aus einer Aussage und einer Frage – die Frage beantwortet das Fragment direkt danach. Zieh die Teile in die passenden Lücken (oder tippe erst einen Teil, dann die Lücke an). Am Handy: kurz gedrückt halten, dann ziehen.</p>`
            : `<div class="order-done">Ma schā' Allāh – alle Teile stehen an ihrem Platz.</div>`
        }`;
    }

    function tryPlace(id, g) {
      const zone = el.querySelector(`[data-drop="gap"][data-g="${g}"]`);
      if (id === g) {
        st.placed[g] = true;
        selected = null;
        render();
        changed();
        const placed = el.querySelector(`.frag-row.gap.placed[data-g="${g}"]`);
        if (placed) placed.classList.add("just");
        return true;
      }
      if (zone) {
        zone.classList.remove("shake");
        void zone.offsetWidth;
        zone.classList.add("shake");
      }
      const card = el.querySelector(`[data-card="${id}"]`);
      if (card) {
        card.classList.remove("shake");
        void card.offsetWidth;
        card.classList.add("shake");
      }
      if (navigator.vibrate) navigator.vibrate(40);
      return false;
    }

    el.addEventListener("click", (e) => {
      if (e.target.closest("[data-prep='toggle-de']")) {
        st.showDe = !st.showDe;
        render();
        changed();
        return;
      }
      const card = e.target.closest("[data-card]");
      if (card) {
        selected = selected === +card.dataset.card ? null : +card.dataset.card;
        render();
        return;
      }
      const zone = e.target.closest("[data-drop='gap']");
      if (zone && selected !== null) tryPlace(selected, +zone.dataset.g);
    });

    el.addEventListener("keydown", (e) => {
      const card = e.target.closest("[data-card]");
      if (card && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        card.click();
      }
    });

    el.addEventListener("pointerdown", (e) => {
      const card = e.target.closest("[data-card]");
      if (!card) return;
      const id = +card.dataset.card;
      holdToDrag(e, (ev) => {
        startDrag(ev, card, partHtml(st.parts[id]), (target) => !!target && target.dataset.drop === "gap" && tryPlace(id, +target.dataset.g), "mun-ghost");
      });
    });

    render();
  }

  /* ------------------------------------------------ Lernen: Fragment-Ansicht */

  /**
   * Der Abschnitt als Fragmentliste zum Auswendiglernen (statt Mushaf).
   * @param {object} o  { fragments, emojis, parts, show: { emoji, de, mun },
   *                      word(token) → HTML, tail: HTML des Anschlusses }
   */
  function readHtml(o) {
    const showMun = o.show.mun && o.parts;
    const slot = (i) => (o.show.emoji ? `<div class="frag-slot filled">${o.emojis[i] ? `<span class="emoji-chip in-slot static">${o.emojis[i]}</span>` : ""}</div>` : "");
    const gap = (g) => (showMun ? (o.show.emoji ? gapRow(partHtml(o.parts[g])) : `<div class="frag-row gap"><div class="gap-main">${partHtml(o.parts[g])}</div></div>`) : "");
    const rows = o.fragments
      .map(
        (f, i) => `${gap(i)}
        <div class="frag-row">
          <div class="frag-main">
            <div class="frag-ar read">${f.words.map(o.word).join(" ")}${f.end ? " " + o.word(f.end) : ""}</div>
            ${o.show.de && f.de ? `<div class="frag-de">${esc(f.de)}</div>` : ""}
          </div>
          ${slot(i)}
        </div>`
      )
      .join("");
    const tail = o.tail
      ? `<div class="frag-row tail"><div class="frag-main"><div class="frag-ar read">${o.tail}</div></div>${o.show.emoji ? `<div class="frag-slot blank"></div>` : ""}</div>`
      : "";
    return `<div class="frag-sheet read-sheet ${o.show.emoji ? "" : "no-emoji"}">${rows}${gap(o.fragments.length)}${tail}</div>`;
  }

  window.Prep = { fragmentsOf, munasabaOf, partHtml, palette, shuffle, mountAssign, mountOrder, mountLink, readHtml };
})();
