// Lightbridge Proxy — minimal pass-through with <base> tag only.
// No script injection, no HTML stripping, no detectable tampering.
// The embed code runs 100% unmodified — ad blocking happens externally
// from the parent page via contentDocument + contentWindow (same-origin).

const AD_DOMAINS = [
  'doubleclick.net', 'googlesyndication.com', 'googleadservices.com',
  'google-analytics.com', 'adnxs.com', 'popads.net', 'popcash.net',
  'popadscdn.net', 'trafficjunky.com', 'juicyads.com', 'exoclick.com',
  'plugrush.com', 'adspyglass.com', 'hilltopads.com', 'propellerads.com',
  'adskeeper.co.uk', 'clickadu.com', 'realsrv.com', 'tsyndicate.com',
  'onclickalgo.com', 'adsterra.com', 'mgid.com', 'taboola.com',
  'outbrain.com', 'moatads.com', 'rubiconproject.com', 'pubmatic.com',
  'openx.net', 'appnexus.com', 'criteo.com', 'smartadserver.com',
  'lijit.com', 'buzzcity.com', 'adsafeprotected.com', 'adservice.com',
  'cpmstar.com', 'zemanta.com', 'contextweb.com', 'casalemedia.com',
  'bluekai.com', 'exelator.com', 'demdex.net', 'adsrvr.org',
  'media.net', 'tidaltv.com', 'servedbyadbutler.com', 'adzerk.net',
  'tremorhub.com', 'revjet.com', 'adroll.com', 'sharethrough.com',
  'adsymptotic.com', 'rlcdn.com', 'scorecardresearch.com',
  'quantserve.com', 'crwdcntrl.net', 'amazon-adsystem.com',
  'amazonadsi.com', 'sovrn.com', 'indexww.com', 'agkn.com',
  'mathtag.com', 'bidswitch.net', 'pubcid.org', 'ipredictive.com',
  '3lift.com', 'ads.linkedin.com', 'ads.facebook.com',
  'advertising.com', 'atdmt.com', 'dmtry.com', 'invitemedia.com',
  'mookie1.com', 'nexage.com', 'openadserve.com', 'openx.com',
  'pubnub.com', 'revsci.net', 'specificmedia.com', 'tacoda.net',
  'c1exchange.com', 'c2stack.com', 'adtrue.com', 'playbuzz.com',
  'skimresources.com', 'viglink.com', 'affiliate.com',
  'clickserve.dartsearch.net', 'adcdn.net',
];

export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) return res.status(400).send('Missing url');

  let targetUrl;
  try {
    targetUrl = new URL(url);
  } catch {
    return res.status(400).send('Invalid url');
  }

  const origin = targetUrl.origin;

  // Fetch the embed page with realistic browser headers
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Referer': origin + '/',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate',
    },
  }).catch(() => null);

  if (!response || !response.ok) {
    return res.status(502).send('Proxy fetch failed');
  }

  let html = await response.text();

  // ── Minimal modification: inject <base> tag for relative URLs ──
  // This is necessary so assets (JS, CSS, video) resolve to the
  // original embed domain, not our proxy domain.
  // Embed sites use <base> themselves, so this does NOT look suspicious.
  const baseTag = `<base href="${origin}/">`;
  if (/<head[^>]*>/i.test(html)) {
    // Insert right after <head> (or <head attr="...">)
    html = html.replace(/<head([^>]*)>/i, '<head$1>' + baseTag);
  } else if (/<html[^>]*>/i.test(html)) {
    html = html.replace(/<html([^>]*)>/i, '<html$1><head>' + baseTag + '</head>');
  } else {
    html = baseTag + html;
  }

  // ── Headers for embedding ──
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Frame-Options', 'ALLOWALL');
  res.setHeader('Access-Control-Allow-Origin', '*');
  // Relax CSP completely — we handle blocking from the parent
  res.setHeader('Content-Security-Policy', '');

  res.status(200).send(html);
}

