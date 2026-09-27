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
      let start = 0;
      bounds.forEach((b, i) => {
        const ws = words.slice(start, b.end);
        const last = i === bounds.length - 1;
        out.push({
          id: out.length,
          key: v.key,
          text: ws.map((w) => w.text).join(" ") + (last && end ? " " + end.text : ""),
          de: b.de || "",
          emoji: b.emoji || "",
        });
        start = b.end;
      });
    }
    return out;
  }

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
    event.preventDefault();
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
      const accepted = e.type === "pointerup" && onDrop(hover);
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
          ${st.fragments.some((f) => f.de) ? `<button class="chip-btn ${st.showDe ? "on" : ""}" data-prep="toggle-de">${st.showDe ? "Übersetzung aus" : "Übersetzung an"}</button>` : ""}
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
        <p class="hint">Zieh ein Emoji in die Spalte neben das passende Fragment (oder tippe erst das Emoji, dann das Feld an). Zurück in die Leiste ziehen entfernt es wieder.</p>`;
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
   * @param {HTMLElement} el
   * @param {object} st         { fragments, emojis, order: [ids gemischt], placed, wheel }
   * @param {Function} changed
   */
  function mountOrder(el, st, changed) {
    const remaining = () => st.order.filter((id) => id >= st.placed);

    function render() {
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
          <div class="wheel" tabindex="0" aria-label="Fragmente – mit Mausrad oder Pfeiltasten blättern">
            ${[-2, -1, 0, 1, 2]
              .map((d) => {
                const id = rest[st.wheel + d];
                if (id === undefined) return `<div class="wheel-item empty d${d}"></div>`;
                return `<div class="wheel-item d${d}" ${d === 0 ? 'data-current="1"' : `data-step="${d}"`}>${esc(st.fragments[id].text)}</div>`;
              })
              .join("")}
          </div>
          <button class="wheel-arrow" data-wheel="1" aria-label="Nächstes Fragment">▼</button>
          <button class="btn btn-outline insert-btn" data-insert="1">↑ Einsetzen</button>
        </div>
        <p class="hint">Blättere zum gesuchten Fragment und zieh es nach oben. Falsche Fragmente springen zurück.</p>`
        }`;
    }

    function scroll(delta) {
      const n = remaining().length;
      st.wheel = Math.max(0, Math.min(n - 1, st.wheel + delta));
      render();
    }

    function tryInsert() {
      const id = remaining()[st.wheel];
      if (id === undefined) return false;
      if (id === st.placed) {
        st.placed++;
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
      return false;
    }

    el.addEventListener("click", (e) => {
      const arrow = e.target.closest("[data-wheel]");
      if (arrow) return scroll(+arrow.dataset.wheel);
      const step = e.target.closest("[data-step]");
      if (step) return scroll(+step.dataset.step);
      if (e.target.closest("[data-insert]")) tryInsert();
    });

    let acc = 0;
    el.addEventListener(
      "wheel",
      (e) => {
        if (!e.target.closest(".wheel")) return;
        e.preventDefault();
        acc += e.deltaY;
        if (Math.abs(acc) >= 40) {
          scroll(acc > 0 ? 1 : -1);
          acc = 0;
        }
      },
      { passive: false }
    );

    el.addEventListener("keydown", (e) => {
      if (!e.target.closest(".wheel")) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        scroll(1);
        el.querySelector(".wheel").focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        scroll(-1);
        el.querySelector(".wheel").focus();
      } else if (e.key === "Enter") {
        tryInsert();
      }
    });

    // Wischen auf dem Rad blättert; das mittlere Fragment nach oben ziehen setzt es ein
    el.addEventListener("pointerdown", (e) => {
      const wheel = e.target.closest(".wheel");
      if (!wheel || (e.button !== undefined && e.button !== 0)) return;
      const current = e.target.closest("[data-current]");
      const x0 = e.clientX;
      const y0 = e.clientY;
      let last = y0;
      let dragging = false;
      const move = (ev) => {
        if (dragging) return;
        const dy = ev.clientY - y0;
        if (current && dy < -18 && Math.abs(dy) > Math.abs(ev.clientX - x0)) {
          // nach oben aus dem Rad heraus: ziehen
          dragging = true;
          cleanup();
          startDrag(ev, current, esc(current.textContent), (target) => !!target && target.dataset.drop === "sheet" && tryInsert(), "frag-ghost");
          return;
        }
        if (!current || Math.abs(dy) > 10) {
          // Finger nach oben → nächstes Fragment rückt nach
          const step = Math.trunc((last - ev.clientY) / 34);
          if (step) {
            scroll(step > 0 ? 1 : -1);
            last = ev.clientY;
          }
        }
      };
      const cleanup = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", cleanup);
        window.removeEventListener("pointercancel", cleanup);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", cleanup);
      window.addEventListener("pointercancel", cleanup);
    });

    render();
  }

  window.Prep = { fragmentsOf, palette, shuffle, mountAssign, mountOrder };
})();
