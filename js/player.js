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
    if (start === 0 && end === n) return buf;
    const out = ctx.createBuffer(channels.length, end - start, sr);
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

    /** Bereich festlegen (stoppt die Wiedergabe). */
    load(reciterId, surah, from, to) {
      this.stop();
      this.reciter = reciterById(reciterId);
      this.surah = surah;
      this.from = from;
      this.to = to;
      this.queue = [];
      if (from === 1 && surah !== 1 && surah !== 9) this.queue.push({ surah: 1, ayah: 1, basmala: true });
      for (let a = from; a <= to; a++) this.queue.push({ surah, ayah: a });
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

    /** Aktuell rezitierter Vers (null während der Basmala oder im Stillstand). */
    get activeAyah() {
      const c = this.current;
      if (!c || c.basmala || this.status === "idle" || this.status === "ended") return null;
      return c.ayah;
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

    playFromAyah(ayah) {
      const i = this.queue.findIndex((q) => !q.basmala && q.ayah === ayah);
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
      this.load(reciterId, surah, ayah, ayah);
      this.queue = [{ surah, ayah }];
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
        src.connect(ctx.destination);
        src.start(when);
        session.entries.push({ index: j, when, dur: buf.duration, src });
        when += buf.duration;
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
    }
  }

  window.Reciters = { list: RECITERS, byId: reciterById };
  window.Player = Player;
})();
