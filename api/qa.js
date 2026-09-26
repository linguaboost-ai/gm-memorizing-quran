// Temporär: liest Wort-Zeitstempel aus den Releases von cpfair/quran-align (CC BY 4.0).
const zlib = require("zlib");
const KEY = "dc081b831a8b1733ab49a8c5";

function unzip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 70000); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("no zip");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = [];
  for (let n = 0; n < count; n++) {
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), nlen = buf.readUInt16LE(p + 28), xlen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32), off = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nlen);
    p += 46 + nlen + xlen + clen;
    const lstart = off + 30 + buf.readUInt16LE(off + 26) + buf.readUInt16LE(off + 28);
    files.push({ name, get: () => { const d = buf.subarray(lstart, lstart + csize); return method === 8 ? zlib.inflateRawSync(d) : d; } });
  }
  return files;
}

// Ende von Wort w (0-basiert) in ms, aus Segmenten [ws, we, start, end]
function wordEnd(segs, w) {
  for (const [ws, we, s, e] of segs) if (w >= ws && w < we) return Math.round(s + ((e - s) * (w + 1 - ws)) / (we - ws));
  const next = segs.find((x) => x[0] > w);
  return next ? next[2] : null;
}

function compact(data) {
  const out = {};
  for (const a of data) {
    const segs = (a.segments || []).slice().sort((x, y) => x[0] - y[0]);
    if (!segs.length) continue;
    out[a.surah + ":" + a.ayah] = [segs[0][2], wordEnd(segs, 0), wordEnd(segs, 1), wordEnd(segs, 2), segs.length && segs[segs.length - 1][3]];
  }
  return out;
}

module.exports = async (req, res) => {
  const url = new URL(req.url, "http://x");
  res.setHeader("content-type", "application/json");
  if (url.searchParams.get("key") !== KEY) { res.statusCode = 403; return res.end("{}"); }
  try {
    if (url.searchParams.get("op") === "list") {
      const r = await fetch("https://api.github.com/repos/cpfair/quran-align/releases", { headers: { "User-Agent": "gm-hifz" } });
      const j = await r.json();
      return res.end(JSON.stringify(Array.isArray(j) ? j.map((x) => ({ tag: x.tag_name, name: x.name, body: (x.body || "").slice(0, 3000), assets: x.assets.map((a) => ({ name: a.name, size: a.size, url: a.browser_download_url })) })) : j, null, 1));
    }
    const asset = url.searchParams.get("asset");
    const filter = (url.searchParams.get("filter") || "").split(",").filter(Boolean);
    const r = await fetch(asset, { headers: { "User-Agent": "gm-hifz" } });
    const buf = Buffer.from(await r.arrayBuffer());
    const result = { status: r.status, size: buf.length, entries: {} };
    if (url.searchParams.get("op") === "names") { result.names = unzip(buf).map((f) => f.name); return res.end(JSON.stringify(result)); }
    const files = asset.endsWith(".zip") ? unzip(buf) : [{ name: asset.split("/").pop(), get: () => buf }];
    for (const f of files) {
      if (!f.name.endsWith(".json")) continue;
      if (filter.length && !filter.some((x) => f.name.includes(x))) continue;
      result.entries[f.name] = compact(JSON.parse(f.get().toString("utf8")));
    }
    res.end(JSON.stringify(result));
  } catch (e) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: String(e && e.stack) }));
  }
};
module.exports.config = { maxDuration: 60 };
