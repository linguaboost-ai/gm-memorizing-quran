// Temporär: listet die Release-Dateien von cpfair/quran-align auf.
module.exports = async (req, res) => {
  const r = await fetch("https://api.github.com/repos/cpfair/quran-align/releases", { headers: { "User-Agent": "gm-hifz" } });
  const j = await r.json();
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(Array.isArray(j) ? j.map((x) => ({ tag: x.tag_name, name: x.name, assets: x.assets.map((a) => ({ name: a.name, size: a.size, url: a.browser_download_url })) })) : j, null, 1));
};
