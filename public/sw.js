const CACHE = 'cinehub-v6';
const JSON_URLS = [
  '/contents_compact.json',
  '/series_genres.json',
  '/movie_genres.json',
  '/playback_sources.json',
  '/movie_detail.json',
  '/series_detail.json',
  '/series_episodes.json',
  '/series_sources.json',
];

// ── Ad/tracker domain blocklist ───────────────────────────────
const AD_DOMAINS = [
  // Major ad networks
  'doubleclick.net','googlesyndication.com','googleadservices.com','google-analytics.com',
  'adnxs.com','popads.net','popcash.net','popadscdn.net','trafficjunky.net',
  'juicyads.com','exoclick.com','plugrush.com','adspyglass.com','hilltopads.net',
  'hilltopads.com','propellerads.com','adskeeper.co.uk','bidvertiser.com',
  'clickadu.com','realsrv.com','tsyndicate.com','onclick.io','onclickalgo.com',
  'adsterra.com','popunder.net','mgid.com','taboola.com','outbrain.com',
  'moatads.com','rubiconproject.com','pubmatic.com','openx.net','appnexus.com',
  'criteo.com','hlsads.com','adservme.com','clicksfly.com','trafficstars.com',
  'tubecorporate.com','etargetnet.com','passthroughads.com',
  // Programmatic / RTB
  'smartadserver.com','lijit.com','buzzcity.com','adsafeprotected.com',
  'contextweb.com','casalemedia.com','bluekai.com','demdex.net','adsrvr.org',
  'media.net','tidaltv.com','servedbyadbutler.com','adzerk.net','tremorhub.com',
  'adroll.com','sharethrough.com','rlcdn.com','amazon-adsystem.com',
  'sovrn.com','indexww.com','agkn.com','mathtag.com','bidswitch.net',
  '3lift.com','advertising.com','atdmt.com','mookie1.com','nexage.com',
  'c1exchange.com','adtrue.com','cpmstar.com','zemanta.com','adform.net',
  'adform.com','yieldmo.com','sharethrough.com','undertone.com',
  'conversantmedia.com','adsymptotic.com','adtelligent.com',
  // Analytics / trackers
  'scorecardresearch.com','quantserve.com','pixel.quantserve.com',
  'pixel.mathtag.com','optimizely.com','hotjar.com','mouseflow.com',
  'fullstory.com','logrocket.com','clarity.ms',
  // Social ad trackers
  'connect.facebook.net','ads.linkedin.com','analytics.twitter.com',
  // Link shorteners / redirect chains
  'shrinkme.io','stfly.me','cuty.io','exe.io','clksite.com',
  'adf.ly','shorte.st','ouo.io','bc.vc','za.gl','ay.gy',
  'shortfly.com','fc.lc','fc.clickclicklick.info','rlu.ru',
  'shrinkearn.com','link1s.com','linkvertise.com','rekonise.com',
  // Streaming-site specific ad/popup networks
  'hlsads.com','vidads.net','adside.net','popundex.com',
  'cpx.to','adsspeed.com','videosadv.com','teasermedia.net',
  'affbuzzads.com','richpush.co','megapu.sh','evadav.com',
  'kadam.net','galaksion.com','adcash.com','zeropark.com',
  'pushground.com','admaven.com','dntx.com','clickaine.com',
];

const AD_PATH_PATTERNS = [
  '/ads/','/advertisement/','/pagead/','/adsbygoogle',
  '/pop.js','/popunder.js','/banner.js','/popup.js',
  '/adframe','/adserver','/adser','/adban',
  '/advert','/adwidget','/adlayer','/adbanner',
  '/sponsor','/promo','/banner','/countdown',
  '/tracking','/tracker','/analytics','/beacon',
  '/pixel','/impression','/click',
  '.min.js?ad','.js?zone','.js?siteid','.js?n',
  '/static/ads/','/assets/ads/','/js/ads/',
  '/cdn/ads/','/wp-content/ads/',
];

function isAd(url) {
  try {
    const u = new URL(url);
    // Always allow our own origin
    if (u.origin === self.location.origin) return false;
    // Block known ad domains
    if (AD_DOMAINS.some(d =>
      u.hostname === d ||
      u.hostname.endsWith('.' + d) ||
      u.hostname.endsWith('-.' + d)
    )) return true;
    // Block by path patterns
    const path = u.pathname.toLowerCase();
    if (AD_PATH_PATTERNS.some(p => path.includes(p))) return true;
    // Block common ad file patterns
    if (/\.(popunder|popup|advert|banner|tracker)\.(js|html?)$/i.test(path)) return true;
    // Block random subdomain patterns common in ad CDNs
    if (/^[a-z]{2,3}\d{2,}\./.test(u.hostname) && !u.hostname.includes('.' + u.hostname.split('.').slice(-2).join('.'))) {
      // Only block if the TLD is suspicious (not a common CDN)
      const tld = u.hostname.split('.').pop();
      if (['xyz','click','bid','download','review','top','win','best'].includes(tld)) return true;
    }
  } catch {}
  return false;
}

// Also intercept and clean the /api/embed response to strip more ads
function isAdResponse(response) {
  // If the response is from /api/embed, it's already cleaned server-side
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

  // Block ad requests aggressively
  if (isAd(url)) {
    e.respondWith(blocked.clone());
    return;
  }

  // Block redirect navigations to unknown external domains
  if (e.request.mode === 'navigate') {
    const dest = new URL(url);
    const mine = self.location.origin;
    // Only allow our own origin, known embed hosts, and common video CDNs
    const ALLOWED_NAV_HOSTS = [
      'streamwish.com','lulustream.com','luluvdo.com','voe.sx','filemoon.sx',
      'streamtape.com','dood.watch','dood.la','mixdrop.co','upstream.to',
      'vidlox.me','fembed.com','embedsito.com','vidhide.com','vidhidefast.com',
      'awish.com','dwish.com','sfastwish.com','strwish.com',
      'wishfast.com','embedwish.com','abstream.com',
      // Common CDNs for video
      'cloudflare.com','cloudflare.net','akamaized.net','fastly.net',
      'cloudfront.net','googleapis.com','googlevideo.com','ytimg.com',
    ];
    const isAllowed = dest.origin === mine ||
      ALLOWED_NAV_HOSTS.some(h => dest.hostname === h || dest.hostname.endsWith('.' + h));
    if (!isAllowed) {
      e.respondWith(Response.redirect(mine + '/', 302));
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

