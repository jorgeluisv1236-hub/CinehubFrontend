const CACHE = 'cinehub-v2';
const JSON_URLS = [
  '/contents_compact.json',
  '/series_genres.json',
  '/movie_genres.json',
  '/playback_sources.json',
  '/series_detail.json',
  '/series_episodes.json',
  '/series_sources.json',
];

// ── Ad blocker ────────────────────────────────────────────────
const AD_DOMAINS = [
  'doubleclick.net','googlesyndication.com','googleadservices.com',
  'adnxs.com','popads.net','popcash.net','trafficjunky.net',
  'juicyads.com','exoclick.com','plugrush.com','adspyglass.com',
  'hilltopads.net','propellerads.com','adskeeper.co.uk','bidvertiser.com',
  'clickadu.com','realsrv.com','tsyndicate.com','onclick.io','adsterra.com',
  'popunder.net','mgid.com','taboola.com','outbrain.com','moatads.com',
  'rubiconproject.com','pubmatic.com','openx.net','appnexus.com',
  'criteo.com','hlsads.com','adservme.com','clicksfly.com',
  'shrinkme.io','stfly.me','cuty.io','exe.io','clksite.com',
  'adf.ly','shorte.st','ouo.io','bc.vc','za.gl','ay.gy',
  'smartadserver.com','lijit.com','buzzcity.com','adsafeprotected.com',
];

const AD_PATH_PATTERNS = [
  '/ads/','/advertisement/','/pagead/','/adsbygoogle',
  '/pop.js','/popunder.js','/banner.js','/popup.js',
];

function isAd(url) {
  try {
    const u = new URL(url);
    if (AD_DOMAINS.some(d => u.hostname === d || u.hostname.endsWith('.' + d))) return true;
    if (AD_PATH_PATTERNS.some(p => u.pathname.includes(p))) return true;
  } catch {}
  return false;
}

const blocked = new Response('', {
  status: 200,
  headers: { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' },
});

// ── Lifecycle ─────────────────────────────────────────────────
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      c.addAll(['/contents_compact.json', '/series_genres.json', '/movie_genres.json', '/playback_sources.json'])
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch handler ─────────────────────────────────────────────
self.addEventListener('fetch', (e) => {
  const url = e.request.url;

  // Block ad requests
  if (isAd(url)) {
    e.respondWith(blocked.clone());
    return;
  }

  // Block popup/redirect navigations to unknown domains
  if (e.request.mode === 'navigate') {
    const dest = new URL(url);
    const mine = self.location.origin;
    const VIDEO_HOSTS = [
      'streamwish.com','lulustream.com','voe.sx','filemoon.sx',
      'streamtape.com','dood.watch','mixdrop.co','upstream.to',
      'vidlox.me','fembed.com','embedsito.com',
    ];
    const ok = dest.origin === mine ||
      VIDEO_HOSTS.some(h => dest.hostname === h || dest.hostname.endsWith('.' + h));
    if (!ok) {
      e.respondWith(blocked.clone());
      return;
    }
  }

  // Cache-first for JSON catalog files
  const pathname = new URL(url).pathname;
  if (JSON_URLS.some((u) => pathname === u)) {
    e.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(e.request);
        const fetchPromise = fetch(e.request).then((res) => {
          cache.put(e.request, res.clone());
          return res;
        });
        return cached || fetchPromise;
      })
    );
  }
});
