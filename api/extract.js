import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

// Vercel function config
export const config = { maxDuration: 30 };

const M3U8_RE = /https?:\/\/[^\s"']+\.m3u8[^\s"']*/i;
const MP4_RE  = /https?:\/\/[^\s"']+\.mp4[^\s"']*/i;

function isVideoUrl(url) {
  return M3U8_RE.test(url) || MP4_RE.test(url);
}

// Skip these — they're ads or trackers, not the real video
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url' });

  let origin;
  try { origin = new URL(url).origin; }
  catch { return res.status(400).json({ error: 'Invalid url' }); }

  let browser = null;
  try {
    const executablePath = await Promise.race([
      chromium.executablePath(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('chromium path timeout')), 8000)),
    ]);

    browser = await Promise.race([
      puppeteer.launch({
        args: chromium.args,
        defaultViewport: { width: 1280, height: 720 },
        executablePath,
        headless: true,
      }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('browser launch timeout')), 15000)),
    ]);

    const page = await browser.newPage();

    // Realistic browser identity
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
    );
    await page.setExtraHTTPHeaders({ Referer: origin + '/' });

    let videoUrl = null;

    // Capture video URLs from network requests
    page.on('response', async (response) => {
      if (videoUrl) return;
      const reqUrl = response.url();
      if (isVideoUrl(reqUrl) && !isSkippable(reqUrl)) {
        videoUrl = reqUrl;
      }
    });

    // Also scan page source for embedded URLs
    page.on('requestfinished', (request) => {
      if (videoUrl) return;
      const reqUrl = request.url();
      if (isVideoUrl(reqUrl) && !isSkippable(reqUrl)) {
        videoUrl = reqUrl;
      }
    });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });

    // Wait up to 12s for video request to appear
    const deadline = Date.now() + 12000;
    while (!videoUrl && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 300));

      // Also try scanning page JS for embedded URLs if not found yet
      if (!videoUrl) {
        try {
          const found = await page.evaluate(() => {
            const scripts = [...document.querySelectorAll('script')].map(s => s.textContent).join('\n');
            const m = scripts.match(/https?:\/\/[^\s"'\\]+\.m3u8[^\s"'\\]*/i)
                   || scripts.match(/https?:\/\/[^\s"'\\]+\.mp4[^\s"'\\]*/i);
            return m ? m[0] : null;
          });
          if (found && !isSkippable(found)) videoUrl = found;
        } catch {}
      }
    }

    await browser.close();
    browser = null;

    if (!videoUrl) {
      return res.status(404).json({ error: 'No video URL found' });
    }

    const type = videoUrl.includes('.m3u8') ? 'hls' : 'mp4';
    return res.status(200).json({ url: videoUrl, type, referer: origin + '/' });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
