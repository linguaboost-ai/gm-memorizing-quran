/*
 * Rezitatoren und Wiedergabe eines Versbereichs.
 *
 * Audio pro Vers von everyayah.com; falls eine Datei nicht lädt, wird –
 * wo vorhanden – die gleiche Rezitation von cdn.islamic.network versucht.
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

  const pad3 = (n) => String(n).padStart(3, "0");
  const reciterById = (id) => RECITERS.find((r) => r.id === id) || RECITERS[0];

  function urls(reciter, surah, ayah) {
    const list = [`https://everyayah.com/data/${reciter.folder}/${pad3(surah)}${pad3(ayah)}.mp3`];
    if (reciter.alt) list.push(`https://cdn.islamic.network/quran/audio/${reciter.alt}/${window.Quran.globalAyah(surah, ayah)}.mp3`);
    return list;
  }

  class Player {
    constructor(onChange) {
      this.onChange = onChange || (() => {});
      this.audio = new Audio();
      this.audio.preload = "auto";
      this.warm = new Audio();
      this.warm.preload = "auto";
      this.queue = [];
      this.index = 0;
      this.status = "idle"; // idle | loading | playing | paused | ended | error
      this.urlIndex = 0;
      this.progress = 0;

      this.audio.addEventListener("playing", () => this.set("playing"));
      this.audio.addEventListener("waiting", () => this.status === "playing" && this.set("loading"));
      this.audio.addEventListener("timeupdate", () => {
        const d = this.audio.duration;
        this.progress = d && isFinite(d) ? this.audio.currentTime / d : 0;
        this.onChange(this, "time");
      });
      this.audio.addEventListener("ended", () => this.next());
      this.audio.addEventListener("error", () => this.fail());
    }

    set(status) {
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
      this.index = 0;
      this.progress = 0;
      this.set("idle");
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

    playIndex(i) {
      this.index = i;
      this.urlIndex = 0;
      this.progress = 0;
      this.startCurrent();
    }

    startCurrent() {
      const c = this.current;
      if (!c) return;
      this.audio.src = urls(this.reciter, c.surah, c.ayah)[this.urlIndex];
      this.set("loading");
      const p = this.audio.play();
      if (p && p.catch) p.catch((e) => e && e.name === "NotAllowedError" && this.set("paused"));
      const n = this.queue[this.index + 1];
      if (n) {
        this.warm.src = urls(this.reciter, n.surah, n.ayah)[0];
        this.warm.load();
      }
    }

    fail() {
      if (!this.audio.src || this.status === "idle") return;
      const c = this.current;
      const list = c ? urls(this.reciter, c.surah, c.ayah) : [];
      if (this.urlIndex + 1 < list.length) {
        this.urlIndex++;
        this.startCurrent();
      } else {
        this.set("error");
      }
    }

    next() {
      if (this.index + 1 < this.queue.length) {
        this.playIndex(this.index + 1);
      } else {
        this.index = 0;
        this.progress = 0;
        this.set("ended");
      }
    }

    toggle() {
      if (this.status === "playing" || this.status === "loading") {
        this.audio.pause();
        this.set("paused");
      } else if (this.status === "paused") {
        const p = this.audio.play();
        if (p && p.catch) p.catch(() => {});
        this.set("loading");
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

    stop() {
      this.audio.pause();
      this.audio.removeAttribute("src");
      this.audio.load();
      this.index = 0;
      this.progress = 0;
      if (this.status !== "idle") this.set("idle");
    }

    /** Kurzer Probevers für die Auswahl des Rezitators. */
    preview(reciterId, surah, ayah) {
      this.load(reciterId, surah, ayah, ayah);
      this.queue = [{ surah, ayah }];
      this.playIndex(0);
    }
  }

  window.Reciters = { list: RECITERS, byId: reciterById };
  window.Player = Player;
})();
