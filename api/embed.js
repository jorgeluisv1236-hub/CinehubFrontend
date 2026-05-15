// High-impact ad/tracker substrings for server-side HTML stripping
// Focused on what actually appears in streamwish/vidhide embeds
const AD_KEYWORDS = [
  'doubleclick', 'googlesyndication', 'googleadservices', 'google-analytics',
  'adnxs', 'popads', 'popcash', 'trafficjunky', 'juicyads', 'exoclick',
  'plugrush', 'adspyglass', 'hilltopads', 'propellerads', 'adskeeper',
  'clickadu', 'realsrv', 'tsyndicate', 'onclick', 'adsterra', 'popunder',
  'mgid', 'taboola', 'outbrain', 'moatads', 'rubiconproject',
  'pubmatic', 'openx', 'appnexus', 'criteo', 'hlsads', 'adservme',
  'clicksfly', 'smartadserver', 'lijit', 'buzzcity', 'adsafeprotected',
  'adservice', 'affiliate', 'tracking', 'pixel',
];

// Check if a URL string matches any ad keyword (faster than regex alternation)
function matchesAdKeyword(str) {
  if (!str || typeof str !== 'string') return false;
  const lower = str.toLowerCase();
  for (let i = 0; i < AD_KEYWORDS.length; i++) {
    if (lower.includes(AD_KEYWORDS[i])) return true;
  }
  return false;
}

function stripAdElements(html) {
  // Remove <script src="..."> where src contains an ad keyword
  let cleaned = html.replace(
    /<script[^>]*src=["']([^"']*?)["'][^>]*>[\s\S]*?<\/script>/gi,
    (match, src) => matchesAdKeyword(src) ? '<!-- ad script removed -->' : match
  );

  // Remove inline scripts containing ad-like code
  cleaned = cleaned.replace(
    /<script[^>]*>[\s\S]*?(?:popunder|popup|adsbygoogle|exoClick|propeller|adblock|ad_load|showAd|adTimer|adContainer|adDiv|adSlot|atob\s*\()[\s\S]*?<\/script>/gi,
    '<!-- ad inline removed -->'
  );

  // Remove iframes pointing to ad domains
  cleaned = cleaned.replace(
    /<iframe[^>]*src=["']([^"']*?)["'][^>]*>[\s\S]*?<\/iframe>/gi,
    (match, src) => matchesAdKeyword(src) ? '<!-- ad iframe removed -->' : match
  );

  return cleaned;
}

export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) return res.status(400).send('Missing url');

  let origin;
  try { origin = new URL(url).origin; } catch { return res.status(400).send('Invalid url'); }

  const r = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      'Referer': origin + '/',
      'Accept': 'text/html,application/xhtml+xml,*/*;q=0.9',
      'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8',
    },
  }).catch(() => null);

  if (!r || !r.ok) return res.status(502).send('Embed fetch failed');

  let html = await r.text();

  // Server-side: strip known ad elements
  html = stripAdElements(html);

  // Serialize AD_KEYWORDS for the browser-side script
  const adKwJson = JSON.stringify(AD_KEYWORDS);

  // Comprehensive anti-ad + anti-popup injection script
  const blocker = `<script>(function(){
  'use strict';
  var AD = ${adKwJson};
  function isAd(url){ return url && AD.some(function(k){ return url.indexOf(k) !== -1; }); }

  // ── 1. Block window.open ──
  var noop = function(){};
  var fakeWin = { focus:noop, blur:noop, close:noop, closed:false,
    location: { href:'', assign:noop, replace:noop, reload:noop },
    document: {}, navigator: {}, screen: {}, history: {},
    stop:noop, print:noop, moveTo:noop, moveBy:noop,
    resizeTo:noop, resizeBy:noop, scrollTo:noop, scroll:noop,
    open:function(){ return fakeWin; }, closed:false };
  window.open = function(){ return fakeWin; };

  // ── 2. Block beforeunload (prevents redirect-on-leave) ──
  window.addEventListener('beforeunload', function(e){
    e.preventDefault(); e.stopImmediatePropagation(); delete e.returnValue;
  }, true);

  // ── 3. Block unload ──
  window.addEventListener('unload', function(e){
    e.preventDefault(); e.stopImmediatePropagation();
  }, true);

  // ── 4. Block history manipulation ──
  try { history.pushState = function(){}; history.replaceState = function(){}; } catch(e){}

  // ── 5. Block top/parent access ──
  try {
    Object.defineProperty(window, 'top', { get: function(){ return window; }, configurable: false });
    Object.defineProperty(window, 'parent', { get: function(){ return window; }, configurable: false });
  } catch(e){}

  // ── 6. Block location.replace/assign to external domains ──
  try {
    var _locR = window.location.replace;
    var _locA = window.location.assign;
    window.location.replace = function(v){
      if(v && v.indexOf(document.domain) === -1 && v.indexOf('about:blank') === -1) return;
      _locR.call(window.location, v);
    };
    window.location.assign = function(v){
      if(v && v.indexOf(document.domain) === -1 && v.indexOf('about:blank') === -1) return;
      _locA.call(window.location, v);
    };
  } catch(e){}

  // ── 7. Intercept fetch to ad domains ──
  var _fetch = window.fetch;
  window.fetch = function(input, opts){
    var url = (typeof input === 'string') ? input : (input && input.url ? input.url : '');
    if(isAd(url)) return Promise.resolve(new Response('',{status:200,headers:{'Content-Type':'text/plain'}}));
    return _fetch.call(this, input, opts);
  };

  // ── 8. Intercept XHR to ad domains ──
  var _xhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url){
    if(isAd(url)) return;
    return _xhrOpen.apply(this, arguments);
  };

  // ── 9. Block first-click ad triggers ──
  var firstClick = true;
  document.addEventListener('click', function(e){
    if(firstClick){
      var t = e.target;
      if(!t.closest('video,button,[class*="play"],[class*="control"],[id*="play"],[id*="control"],[class*="btn"],[class*="vjs"],[class*="jw"]')){
        e.preventDefault(); e.stopImmediatePropagation();
        firstClick = false; return;
      }
    }
    firstClick = false;
    var a = e.target.closest('a');
    if(a && (a.target==="_blank"||a.target==="_top"||a.target==="top"||a.target==="_parent")){
      e.preventDefault(); e.stopImmediatePropagation();
    }
  }, true);

  // ── 10. Block middle-click on links ──
  document.addEventListener('auxclick', function(e){
    if(e.target.closest('a')){ e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);

  // ── 11. Fix anchor targets ──
  function fixLinks(){
    document.querySelectorAll('a[target]').forEach(function(a){
      if(a.target !== "_self") a.removeAttribute("target");
    });
    document.querySelectorAll('[onclick*="open"]').forEach(function(el){
      el.removeAttribute('onclick');
    });
  }
  document.addEventListener('DOMContentLoaded', fixLinks);
  setTimeout(fixLinks, 500);
  setTimeout(fixLinks, 2000);

  // ── 12. Prevent dragging links ──
  document.addEventListener('dragstart', function(e){
    if(e.target.closest('a')) e.preventDefault();
  }, true);
}());</script>`;

  // Inject blocker as first thing in <head>
  if (/<head[^>]*>/i.test(html)) {
    html = html.replace(/<head([^>]*)>/i, '<head$1>' + blocker);
  } else {
    html = blocker + html;
  }

  // Add base href so relative URLs still load from original domain
  if (!/<base/i.test(html)) {
    html = html.replace(/<head([^>]*)>/i, `<head$1><base href="${origin}/">`);
  }

  // Strip headers that would block iframe embedding
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Frame-Options', 'ALLOWALL');
  res.setHeader('Content-Security-Policy', '');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.send(html);
}

