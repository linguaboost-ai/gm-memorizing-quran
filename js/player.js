/*
 * Rezitatoren und Wiedergabe eines Versbereichs.
 *
 * Die Verse werden als Audiodaten geladen und mit der Web-Audio-API
 * sample-genau direkt hintereinander abgespielt – ohne Pause zwischen den
 * Dateien. Stille am Anfang und Ende jeder Versdatei wird dabei gekürzt, so
 * dass der Abschnitt wie in einem Rutsch rezitiert klingt.
 *
 * Audio pro Vers von everyayah.com (über /audio auf der eigenen Domain,
 * siehe vercel.json – so darf der Browser die Daten lesen). Falls eine Datei
 * nicht lädt, wird – wo vorhanden – die gleiche Rezitation von
 * cdn.islamic.network versucht. Klappt beides nicht (z. B. lokal über
 * file://), spielt ein normales <audio>-Element die Verse nacheinander.
 */
(function () {
  "use strict";

  const RECITERS = [
    { id: "afasy", name: "Mishary Rashid Al-Afasy", short: "Afasy", folder: "Alafasy_128kbps", alt: "128/ar.alafasy" },
    { id: "hosary", name: "Mahmoud Khalil Al-Hosary", short: "Hosary", folder: "Husary_128kbps", alt: "128/ar.husary" },
    { id: "minshawi", name: "Mohamed Siddiq Al-Minshawi", short: "Minshawi", folder: "Minshawy_Murattal_128kbps", alt: "128/ar.minshawi" },
    { id: "abdulbasit", name: "Abdul Basit Abdus Samad", short: "Abdul Basit", folder: "Abdul_Basit_Murattal_192kbps", alt: "192/ar.abdulbasitmurattal" },
    { id: "sudais", name: "Abdurrahman As-Sudais", short: "Sudais", folder: "Abdurrahmaan_As-Sudais_192kbps", alt: "192/ar.abdurrahmaansudais" },
    { id: "shuraim", name: "Saud Ash-Shuraim", short: "Shuraim", folder: "Saood_ash-Shuraym_128kbps", alt: "64/ar.saoodshuraym" },
    { id: "muaiqly", name: "Maher Al-Muaiqly", short: "Muaiqly", folder: "Maher_AlMuaiqly_64kbps", alt: "128/ar.mahermuaiqly" },
    { id: "ghamdi", name: "Saad Al-Ghamdi", short: "Ghamdi", folder: "Ghamadi_40kbps" },
    { id: "shatri", name: "Abu Bakr Ash-Shatri", short: "Shatri", folder: "Abu_Bakr_Ash-Shaatree_128kbps", alt: "128/ar.shaatree" },
    { id: "matrood", name: "Abdullah Al-Matrood", short: "Matrood", folder: "Abdullah_Matroud_128kbps" },
  ];

  // Wie viel Stille vor bzw. nach der Stimme stehen bleibt (Sekunden)
  const KEEP_LEAD = 0.03;
  const KEEP_TAIL = 0.1;
  const PREFETCH = 4;
  // Anschluss: nach den ersten Wörtern des nächsten Verses so lange ausblenden
  const TAIL_FADE = 0.1;

  const pad3 = (n) => String(n).padStart(3, "0");
  const reciterById = (id) => RECITERS.find((r) => r.id === id) || RECITERS[0];
  const SAME_ORIGIN_PROXY = /^https?:$/.test(location.protocol);
  const AudioCtx = window.AudioContext || window.webkitAudioContext;

  /** Mögliche Quellen eines Verses, in der Reihenfolge, in der sie versucht werden. */
  function sources(reciter, surah, ayah, forElement) {
    const file = `${pad3(surah)}${pad3(ayah)}.mp3`;
    const list = [];
    if (SAME_ORIGIN_PROXY && !forElement) list.push(`audio/${reciter.folder}/${file}`);
    list.push(`https://everyayah.com/data/${reciter.folder}/${file}`);
    if (reciter.alt) {
      const g = window.Quran.globalAyah(surah, ayah);
      if (SAME_ORIGIN_PROXY && !forElement) list.push(`audio-alt/${reciter.alt}/${g}.mp3`);
      list.push(`https://cdn.islamic.network/quran/audio/${reciter.alt}/${g}.mp3`);
    }
    return list;
  }

  function decode(ctx, data) {
    return new Promise((resolve, reject) => {
      const p = ctx.decodeAudioData(data, resolve, reject);
      if (p && p.catch) p.catch(reject);
    });
  }

  /** Schneidet Stille am Anfang und Ende ab (mit kurzem Ein-/Ausblenden). */
  function trimSilence(ctx, buf) {
    const channels = [];
    for (let c = 0; c < buf.numberOfChannels; c++) channels.push(buf.getChannelData(c));
    const n = buf.length;
    const sr = buf.sampleRate;
    let peak = 0;
    for (const d of channels) for (let i = 0; i < n; i += 4) peak = Math.max(peak, Math.abs(d[i]));
    const threshold = Math.max(0.003, peak * 0.015);
    const loud = (i) => channels.some((d) => Math.abs(d[i]) > threshold);
    let first = 0;
    while (first < n && !loud(first)) first++;
    let last = n - 1;
    while (last > first && !loud(last)) last--;
    if (last <= first) return buf;
    const start = Math.max(0, first - Math.round(KEEP_LEAD * sr));
    const end = Math.min(n, last + Math.round(KEEP_TAIL * sr));
    // Bereich der Stimme im gekürzten Puffer (Sekunden)
    const voice = [(first - start) / sr, (last - start) / sr];
    if (start === 0 && end === n) {
      buf.voice = voice;
      return buf;
    }
    const out = ctx.createBuffer(channels.length, end - start, sr);
    out.voice = voice;
    const fade = Math.min(Math.round(0.008 * sr), Math.floor((end - start) / 4));
    channels.forEach((d, c) => {
      const o = out.getChannelData(c);
      o.set(d.subarray(start, end));
      for (let i = 0; i < fade; i++) {
        o[i] *= i / fade;
        o[o.length - 1 - i] *= i / fade;
      }
    });
    return out;
  }

  /*
   * Anschluss-Schnitt: Wo endet im Audio das letzte Anschlusswort?
   *
   * Für die Rezitationen gibt es keine Wort-Zeitstempel. Wir schätzen die
   * Stelle aus dem Text (Dauer in Silbenschlägen: Harakat, Sukun, Shadda,
   * Madd-Dehnungen, Dehnung beim Innehalten am Versende) und setzen den
   * Schnitt dann an die leiseste Stelle in der Nähe – eine Silbengrenze.
   */
  const SHORT_VOWEL = /[\u064E\u064F\u0650]/;
  const TANWEEN = /[\u064B-\u064D\u08F0-\u08F2]/;
  const SUKUN = /[\u0652\u06E1]/;
  const SILENT = /[\u06DF\u06E0]/;
  const MADD_LETTER = /[\u0627\u0648\u064A\u0649\u06E5\u06E6]/;

  function wordBeats(word, isFirst, isLast) {
    let beats = 0;
    window.Fade.analyze(word).clusters.forEach((cl, i) => {
      const base = cl[0];
      const marks = cl.slice(1).join("");
      let b;
      if (SILENT.test(marks)) b = 0;
      else if (SHORT_VOWEL.test(marks)) b = 1;
      else if (TANWEEN.test(marks)) b = 1.5;
      else if (SUKUN.test(marks)) b = 0.5;
      else if (base === "\u0671") b = isFirst && i === 0 ? 1 : 0; // Hamzat al-Wasl (am Versanfang gesprochen)
      else if (MADD_LETTER.test(base)) b = 1; // Dehnungsbuchstabe
      else b = 0.5;
      if (marks.includes("\u0651")) b += /[\u0645\u0646]/.test(base) ? 1.5 : 0.5; // Shadda (mit Ghunna)
      if (marks.includes("\u0670")) b += 1; // kleines Alif
      if (marks.includes("\u0653")) b += 3; // Madd-Zeichen
      beats += b;
    });
    return beats + (isLast ? 2 : 0); // Innehalten am Versende
  }

  /** Anteil der ersten `k` Wörter an der Sprechdauer des Verses (0–1). */
  function firstWordsFraction(words, k) {
    if (!words || words.length <= k) return 1;
    const beats = words.map((w, i) => wordBeats(w, i === 0, i === words.length - 1));
    const total = beats.reduce((a, b) => a + b, 0);
    return total ? beats.slice(0, k).reduce((a, b) => a + b, 0) / total : 1;
  }

  /** Zeitpunkt (s) im Puffer, an dem ausgeblendet wird. */
  function tailCut(buf, fraction) {
    if (fraction >= 1) return Math.max(0, buf.duration - TAIL_FADE);
    const [vs, ve] = buf.voice || [0, buf.duration];
    // leicht nach hinten versetzt: lieber das letzte Wort ganz als abgeschnitten
    const estimate = vs + fraction * (ve - vs) + 0.04;
    const data = buf.getChannelData(0);
    const sr = buf.sampleRate;
    const half = Math.round(0.01 * sr);
    const range = Math.min(0.2, Math.max(0.08, (ve - vs) * 0.04));
    let best = estimate;
    let bestScore = Infinity;
    for (let t = estimate - range; t <= estimate + range; t += 0.005) {
      const c = Math.round(t * sr);
      if (c - half < 0 || c + half >= data.length) continue;
      let e = 0;
      for (let i = c - half; i < c + half; i++) e += data[i] * data[i];
      const score = e * (1 + (0.6 * Math.abs(t - estimate)) / range);
      if (score < bestScore) {
        bestScore = score;
        best = t;
      }
    }
    return Math.max(0.05, Math.min(buf.duration - TAIL_FADE, best));
  }

  class Player {
    constructor(onChange) {
      this.onChange = onChange || (() => {});
      this.queue = [];
      this.index = 0;
      this.progress = 0;
      this.status = "idle"; // idle | loading | playing | paused | ended | error
      this.ctx = null;
      this.buffers = new Map();
      this.session = null;
      this.ticker = null;
      this.useElement = !AudioCtx || !window.fetch;
      this.el = null;
    }

    set(status) {
      if (this.status === status) return;
      this.status = status;
      this.onChange(this, "status");
    }

    /**
     * Verse festlegen (stoppt die Wiedergabe).
     * verses: [{ surah, ayah }] in Mushaf-Reihenfolge – vor jedem Surenanfang
     *         (außer Al-Fātiḥa und At-Tawba) wird die Basmala rezitiert.
     * tail:   { surah, ayah, words, verseWords } – Anfang des nächsten Verses als Anschluss
     */
    load(reciterId, verses, tail) {
      this.stop();
      this.reciter = reciterById(reciterId);
      this.signature = reciterId + "|" + verses.map((v) => v.surah + ":" + v.ayah).join(",");
      this.queue = [];
      for (const v of verses) {
        if (v.ayah === 1 && v.surah !== 1 && v.surah !== 9) this.queue.push({ surah: 1, ayah: 1, basmala: true });
        this.queue.push({ surah: v.surah, ayah: v.ayah, key: `${v.surah}:${v.ayah}` });
      }
      if (tail) this.queue.push({ surah: tail.surah, ayah: tail.ayah, tail: true, fraction: firstWordsFraction(tail.verseWords, tail.words) });
      // Nur die Verse dieses Abschnitts im Speicher behalten
      const keep = new Set(this.queue.map((q) => this.key(q)));
      for (const k of Array.from(this.buffers.keys())) if (!keep.has(k)) this.buffers.delete(k);
      this.index = 0;
      this.progress = 0;
      this.set("idle");
      if (!this.useElement) for (let i = 0; i < Math.min(PREFETCH, this.queue.length); i++) this.getBuffer(i);
    }

    get current() {
      return this.queue[this.index];
    }

    /** Aktuell rezitierter Vers als "Sure:Vers" (null während Basmala, Anschluss oder Stillstand). */
    get activeKey() {
      const c = this.current;
      if (!c || c.basmala || c.tail || this.status === "idle" || this.status === "ended") return null;
      return c.key;
    }

    toggle() {
      if (this.status === "playing" || this.status === "loading") {
        if (this.useElement) this.el.pause();
        else this.ctx.suspend();
        this.set("paused");
      } else if (this.status === "paused") {
        if (this.useElement) {
          const p = this.el.play();
          if (p && p.catch) p.catch(() => {});
        } else {
          this.ctx.resume();
        }
        this.set("loading");
        this.tick();
      } else {
        this.playIndex(0);
      }
    }

    restart() {
      this.playIndex(0);
    }

    playFromKey(key) {
      const i = this.queue.findIndex((q) => q.key === key);
      if (i >= 0) this.playIndex(i);
    }

    playIndex(i) {
      if (!this.queue[i]) return;
      this.stopPlayback();
      this.index = i;
      this.progress = 0;
      this.set("loading");
      if (this.useElement) return this.elStart(i);
      const ctx = this.ensureCtx();
      if (ctx.state !== "running") ctx.resume().catch(() => {});
      const session = (this.session = { entries: [], done: false, failed: false, endTime: Infinity });
      this.startTicker();
      this.schedule(session, i);
    }

    stop() {
      this.stopPlayback();
      this.index = 0;
      this.progress = 0;
      this.set("idle");
    }

    /** Kurzer Probevers für die Auswahl des Rezitators. */
    preview(reciterId, surah, ayah) {
      this.load(reciterId, [{ surah, ayah }]);
      this.queue = [{ surah, ayah, key: `${surah}:${ayah}` }];
      this.playIndex(0);
    }

    /* ---------------------------------------------------------- Web Audio */

    ensureCtx() {
      if (!this.ctx) {
        this.ctx = new AudioCtx();
        // iOS: auch bei stummgeschaltetem Klingelton abspielen
        try {
          if (navigator.audioSession) navigator.audioSession.type = "playback";
        } catch (e) {
          /* nicht unterstützt */
        }
      }
      return this.ctx;
    }

    key(item) {
      return `${this.reciter.id}:${item.surah}:${item.ayah}`;
    }

    getBuffer(i) {
      const item = this.queue[i];
      if (!item) return Promise.resolve(null);
      const k = this.key(item);
      if (!this.buffers.has(k)) {
        const reciter = this.reciter;
        const p = this.fetchBuffer(reciter, item).then((buf) => {
          if (!buf) this.buffers.delete(k);
          return buf;
        });
        this.buffers.set(k, p);
      }
      return this.buffers.get(k);
    }

    async fetchBuffer(reciter, item) {
      const ctx = this.ensureCtx();
      for (const url of sources(reciter, item.surah, item.ayah, false)) {
        try {
          const res = await fetch(url);
          if (!res.ok) continue;
          const buf = await decode(ctx, await res.arrayBuffer());
          return trimSilence(ctx, buf);
        } catch (e) {
          /* nächste Quelle */
        }
      }
      return null;
    }

    /** Plant alle Verse ab `start` lückenlos hintereinander ein. */
    async schedule(session, start) {
      const ctx = this.ctx;
      let when = null;
      for (let j = start; j < this.queue.length; j++) {
        for (let k = j + 1; k <= j + PREFETCH && k < this.queue.length; k++) this.getBuffer(k);
        const buf = await this.getBuffer(j);
        if (session !== this.session) return;
        if (!buf) {
          if (!session.entries.length) {
            // Web Audio geht nicht (z. B. keine Freigabe der Quelle) → <audio>
            this.session = null;
            this.stopTicker();
            this.useElement = true;
            this.elStart(j);
            return;
          }
          session.failed = true;
          break;
        }
        const now = ctx.currentTime;
        if (when === null || when < now + 0.02) when = now + 0.06;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        let dur = buf.duration;
        const item = this.queue[j];
        if (item.tail) {
          // Nur bis zum Ende der Anschlusswörter, dann über 100 ms ausblenden
          const cut = tailCut(buf, item.fraction);
          const gain = ctx.createGain();
          gain.gain.setValueAtTime(1, when + cut);
          gain.gain.linearRampToValueAtTime(0, when + cut + TAIL_FADE);
          src.connect(gain);
          gain.connect(ctx.destination);
          dur = Math.min(buf.duration, cut + TAIL_FADE);
          src.start(when, 0, dur);
        } else {
          src.connect(ctx.destination);
          src.start(when);
        }
        session.entries.push({ index: j, when, dur, src });
        when += dur;
        session.endTime = when;
      }
      session.done = true;
      if (when === null) session.endTime = ctx.currentTime;
    }

    tick() {
      const s = this.session;
      if (!s || !this.ctx || this.status === "paused") return;
      const t = this.ctx.currentTime;
      const e = s.entries.find((x) => t >= x.when && t < x.when + x.dur);
      if (e) {
        this.index = e.index;
        this.progress = (t - e.when) / e.dur;
        this.set("playing");
      } else if (s.done && t >= s.endTime) {
        this.stopTicker();
        this.session = null;
        this.index = 0;
        this.progress = 0;
        this.set(s.failed ? "error" : "ended");
      } else {
        const last = s.entries[s.entries.length - 1];
        if (last && t >= last.when + last.dur) {
          this.index = Math.min(last.index + 1, this.queue.length - 1);
          this.progress = 0;
        }
        this.set("loading");
      }
      this.onChange(this, "time");
    }

    startTicker() {
      this.stopTicker();
      this.ticker = setInterval(() => this.tick(), 80);
    }

    stopTicker() {
      if (this.ticker) clearInterval(this.ticker);
      this.ticker = null;
    }

    stopPlayback() {
      this.stopTicker();
      const s = this.session;
      this.session = null;
      if (s) {
        for (const e of s.entries) {
          try {
            e.src.stop();
            e.src.disconnect();
          } catch (err) {
            /* schon beendet */
          }
        }
      }
      if (this.el) {
        this.el.pause();
        this.el.removeAttribute("src");
        this.el.load();
      }
    }

    /* ------------------------------------------- Ersatz: <audio>-Element */

    elStart(i) {
      if (!this.el) {
        this.el = new Audio();
        this.el.preload = "auto";
        this.warm = new Audio();
        this.warm.preload = "auto";
        this.el.addEventListener("playing", () => this.set("playing"));
        this.el.addEventListener("waiting", () => this.status === "playing" && this.set("loading"));
        this.el.addEventListener("timeupdate", () => {
          const d = this.el.duration;
          this.progress = d && isFinite(d) ? this.el.currentTime / d : 0;
          this.onChange(this, "time");
        });
        this.el.addEventListener("ended", () => {
          if (this.index + 1 < this.queue.length) this.elStart(this.index + 1);
          else {
            this.index = 0;
            this.progress = 0;
            this.set("ended");
          }
        });
        this.el.addEventListener("error", () => {
          if (!this.el.getAttribute("src") || this.status === "idle") return;
          const c = this.current;
          const list = c ? sources(this.reciter, c.surah, c.ayah, true) : [];
          if (this.urlIndex + 1 < list.length) {
            this.urlIndex++;
            this.elPlayCurrent();
          } else {
            this.set("error");
          }
        });
      }
      this.index = i;
      this.urlIndex = 0;
      this.progress = 0;
      this.elPlayCurrent();
    }

    elPlayCurrent() {
      const c = this.current;
      if (!c) return;
      this.el.src = sources(this.reciter, c.surah, c.ayah, true)[this.urlIndex];
      this.set("loading");
      const p = this.el.play();
      if (p && p.catch) p.catch((e) => e && e.name === "NotAllowedError" && this.set("paused"));
      const n = this.queue[this.index + 1];
      if (n) {
        this.warm.src = sources(this.reciter, n.surah, n.ayah, true)[0];
        this.warm.load();
      }
      if (c.tail && c.fraction < 1) this.elWatchTail(c);
    }

    /** Ersatz ohne Web Audio: Anschluss grob nach Textanteil abbrechen und ausblenden. */
    elWatchTail(item) {
      const el = this.el;
      const watch = () => {
        if (this.current !== item || this.status === "idle" || this.status === "ended") return;
        const d = el.duration;
        if (d && isFinite(d) && el.currentTime >= item.fraction * d) {
          const t0 = performance.now();
          const fade = setInterval(() => {
            const k = (performance.now() - t0) / (TAIL_FADE * 1000);
            if (k >= 1 || this.current !== item) {
              clearInterval(fade);
              el.pause();
              el.volume = 1;
              if (this.current === item) {
                this.index = 0;
                this.progress = 0;
                this.set("ended");
              }
            } else {
              el.volume = Math.max(0, 1 - k);
            }
          }, 10);
          return;
        }
        requestAnimationFrame(watch);
      };
      requestAnimationFrame(watch);
    }
  }

  window.Reciters = { list: RECITERS, byId: reciterById };
  window.Player = Player;
  Player.estimate = { firstWordsFraction, tailCut };
})();
