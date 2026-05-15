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

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function extractFileId(url) {
  const m = url.match(/\/e\/([a-zA-Z0-9]+)/) || url.match(/\/([a-zA-Z0-9]{8,})(?:[/?#]|$)/);
  return m ? m[1] : null;
}

// StreamWish / VidHide / LuluStream — all share the same player engine
// POST /api/source/{id} → { success: true, data: [{ file, type }] }
async function trySourceApi(embedUrl, hostname) {
  const id = extractFileId(embedUrl);
  if (!id) return null;

  const res = await fetch(`https://${hostname}/api/source/${id}`, {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      'Referer': `https://${hostname}/`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: `r=&d=${hostname}`,
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  if (!data?.success || !Array.isArray(data.data)) return null;

  for (const src of data.data) {
    if (src.file && !isSkippable(src.file)) {
      const type = src.file.includes('.m3u8') ? 'hls' : 'mp4';
      return { url: src.file, type };
    }
  }
  return null;
}

// Regex scan on raw HTML for sites that embed the URL in the page source
const VIDEO_RE = [
  /["'`](https?:\/\/[^"'`\s]{8,}\.m3u8[^"'`\s]*)/gi,
  /["'`](https?:\/\/[^"'`\s]{8,}\.mp4[^"'`\s]*)/gi,
  /(https?:\\\/\\\/[^\s"'\\]{8,}\.m3u8[^\s"'\\]*)/gi,
  /(https?:\\\/\\\/[^\s"'\\]{8,}\.mp4[^\s"'\\]*)/gi,
];

function findInHtml(html) {
  for (const re of VIDEO_RE) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(html)) !== null) {
      const raw = (m[1] || m[0])
        .replace(/\\\/\//g, '//')
        .replace(/\\\//g, '/')
        .replace(/['")`\]\\;,]+$/, '');
      try {
        new URL(raw);
        if (!isSkippable(raw)) return raw;
      } catch {}
    }
  }
  return null;
}

// Hosts that use the shared source API
const API_HOSTS = [
  'streamwish', 'vidhide', 'vidhidefast', 'lulustream', 'luluvdo',
  'awish', 'dwish', 'sfastwish', 'strwish', 'wishfast', 'embedwish',
  'abstream',
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url' });

  let origin, hostname;
  try { const u = new URL(url); origin = u.origin; hostname = u.hostname; }
  catch { return res.status(400).json({ error: 'Invalid url' }); }

  try {
    let result = null;

    // Try site-specific API first (fast, reliable)
    if (API_HOSTS.some(h => hostname.includes(h))) {
      result = await trySourceApi(url, hostname).catch(() => null);
    }

    // Fallback: fetch HTML and regex scan
    if (!result) {
      const response = await fetch(url, {
        headers: {
          'User-Agent': UA,
          'Referer': origin + '/',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        signal: AbortSignal.timeout(8000),
      });
      if (response.ok) {
        const html = await response.text();
        const videoUrl = findInHtml(html);
        if (videoUrl) result = { url: videoUrl, type: videoUrl.includes('.m3u8') ? 'hls' : 'mp4' };
      }
    }

    if (!result) return res.status(404).json({ error: 'No video URL found' });

    return res.status(200).json({ ...result, referer: origin + '/' });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
