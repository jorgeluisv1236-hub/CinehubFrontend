export const config = { maxDuration: 15 };

const SKIP_HOSTS = [
  'doubleclick','googlesyndication','adnxs','popads','exoclick',
  'trafficjunky','juicyads','hlsads','adsterra','propellerads',
];

function isSkippable(url) {
  try {
    const h = new URL(url).hostname;
    return SKIP_HOSTS.some(s => h.includes(s));
  } catch { return false; }
}

// Look for m3u8/mp4 URLs inside quotes or JSON-escaped in page source
const PATTERNS = [
  /["'`](https?:\/\/[^"'`\s]{8,}\.m3u8[^"'`\s]*)/gi,
  /["'`](https?:\/\/[^"'`\s]{8,}\.mp4[^"'`\s]*)/gi,
  /(https?:\\\/\\\/[^\s"'\\]{8,}\.m3u8[^\s"'\\]*)/gi,
  /(https?:\\\/\\\/[^\s"'\\]{8,}\.mp4[^\s"'\\]*)/gi,
];

function findVideoUrl(html) {
  for (const re of PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(html)) !== null) {
      const raw = m[1] || m[0];
      const url = raw
        .replace(/\\\/\//g, '//')
        .replace(/\\\//g, '/')
        .replace(/['")`\]\\;,]+$/, '');
      try {
        new URL(url);
        if (!isSkippable(url)) return url;
      } catch {}
    }
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url' });

  let origin;
  try { origin = new URL(url).origin; }
  catch { return res.status(400).json({ error: 'Invalid url' }); }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Referer': origin + '/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return res.status(404).json({ error: 'Page not accessible' });

    const html = await response.text();
    const videoUrl = findVideoUrl(html);

    if (!videoUrl) return res.status(404).json({ error: 'No video URL found' });

    const type = videoUrl.includes('.m3u8') ? 'hls' : 'mp4';
    return res.status(200).json({ url: videoUrl, type, referer: origin + '/' });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
