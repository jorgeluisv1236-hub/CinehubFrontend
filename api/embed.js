// Known ad/tracker domains stripped server-side from the HTML
const AD_KEYWORDS = [
  'doubleclick', 'googlesyndication', 'googleadservices', 'google-analytics',
  'adnxs', 'popads', 'popcash', 'trafficjunky', 'juicyads', 'exoclick',
  'plugrush', 'adspyglass', 'hilltopads', 'propellerads', 'adskeeper',
  'bidvertiser', 'clickadu', 'realsrv', 'tsyndicate', 'onclick',
  'adsterra', 'mgid', 'taboola', 'outbrain', 'moatads', 'rubiconproject',
  'pubmatic', 'openx', 'appnexus', 'criteo', 'hlsads', 'adservme',
  'clicksfly', 'shrinkme', 'adf.ly', 'shorte.st', 'ouo.io', 'exe.io',
  'clksite', 'smartadserver', 'lijit', 'buzzcity', 'adsafeprotected',
  'adap.tv', 'adition', 'ad4game', 'adbutler', 'adform', 'adgebra',
  'adglare', 'adiquity', 'adkernel', 'adman', 'admetrics', 'adreactor',
  'adroll', 'ads24', 'ads30', 'ads2', 'adsbookie', 'adservice',
  'adtech', 'adthrive', 'adtiger', 'adventory', 'adzerk', 'affiliate',
  'amazon-adsystem', 'bluekai', 'brainient', 'britever', 'casalemedia',
  'contextweb', 'convertro', 'crwdcntrl', 'demdex', 'dotomi',
  'exelator', 'eyeota', 'fifty-six', 'googleadservices',
  'impdesk', 'indexww', 'innovid', 'intentiq', 'krux',
  'liveintent', 'lotame', 'media6degrees', 'mediaforge', 'mexad',
  'ml314', 'moolahmedia', 'nativeads', 'neustar', 'nielsen',
  'nuffnang', 'optimizely', 'orbitx', 'pepperjam', 'phluant',
  'picadmedia', 'pixels', 'platformtwitter', 'pulsepoint',
  'quantserve', 'quantummetric', 'revjet', 'revrtb', 'rfihub',
  'rnmd', 'rokt', 'rtbhouse', 'rubicon', 'sabio', 'scanscout',
  'scorecardresearch', 'segment', 'sharethrough', 'simpli.fi',
  'sitescout', 'smaato', 'smartadserver', 'socialtwist',
  'sociomantic', 'sojern', 'specificmedia', 'spotxchange',
  'stickyadstv', 'sumo', 'supersonicads', 'swollab', 'tapad',
  'thetradedesk', 'tidal', 'tidaltv', 'tracking', 'tradead',
  'tremorhub', 'tribalfusion', 'triplelift', 'trueffect',
  'tumri', 'turn', 'twyn', 'underscore', 'undertone',
  'veoxa', 'verizonmedia', 'vertamedia', 'vibrantmedia',
  'videology', 'vizu', 'xad', 'xaxis', 'yadro', 'yahooads',
  'yieldbot', 'yieldmo', 'yieldtraffic', 'yume',
  'zergnet', 'zeta',
];

function containsAdDomain(url) {
  try {
    const u = typeof url === 'string' ? new URL(url) : url;
    return AD_KEYWORDS.some(k => u.hostname.includes(k) || u.pathname.includes(k));
  } catch { return false; }
}

function stripAdElements(html) {
  // Remove script tags loading from ad domains
  let cleaned = html.replace(
    /<script[^>]*src=["'][^"']*(?:' + AD_KEYWORDS.join('|') + ')[^"']*["'][^>]*>[\s\S]*?<\/script>/gi,
    '<!-- ad script removed -->'
  );

  // Remove inline scripts that look like ad code
  cleaned = cleaned.replace(
    /<script[^>]*>[\s\S]*?(?:atob\(|popunder|popup|adsbygoogle|adblock|exoClick|propeller|'ad'\+'s'|'ad'\+'v'|ad_load|showAd|adTimer|adContainer|adDiv|adSlot)[\s\S]*?<\/script>/gi,
    '<!-- ad inline removed -->'
  );

  // Remove iframes pointing to ad domains
  cleaned = cleaned.replace(
    /<iframe[^>]*src=["'][^"']*(?:doubleclick|googlesyndication|popads|adsterra|propellerads|exoclick|adnxs)[^"']*["'][^>]*>[\s\S]*?<\/iframe>/gi,
    '<!-- ad iframe removed -->'
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

  // Comprehensive anti-ad + anti-popup injection script
  const blocker = `<script>(function(){
  'use strict';

  // ── 1. Block window.open completely ──
  var noop = function(){};
  var fakeWin = { focus:noop, blur:noop, close:noop, closed:false,
    location: { href:'', assign:noop, replace:noop, reload:noop },
    document: {}, navigator: {}, screen: {}, history: {},
    stop:noop, print:noop, moveTo:noop, moveBy:noop,
    resizeTo:noop, resizeBy:noop, scrollTo:noop, scroll:noop,
    open:function(){ return fakeWin; }, closed:false };
  window.open = function(){ return fakeWin; };

  // ── 2. Block beforeunload (prevents redirect-on-leave tricks) ──
  window.addEventListener('beforeunload', function(e){
    e.preventDefault();
    e.stopImmediatePropagation();
    delete e.returnValue;
  }, true);

  // ── 3. Block unload (some embeds redirect on unload) ──
  window.addEventListener('unload', function(e){
    e.preventDefault();
    e.stopImmediatePropagation();
  }, true);

  // ── 4. Block history manipulation (prevents URL changes in embed) ──
  try {
    var _pushState = history.pushState;
    var _replaceState = history.replaceState;
    history.pushState = function(){};
    history.replaceState = function(){};
    // Restore after a small delay so the page loads normally, then block
    setTimeout(function(){
      history.pushState = function(){};
      history.replaceState = function(){};
    }, 500);
  } catch(e){}

  // ── 5. Block top-level navigation ──
  try {
    Object.defineProperty(window, 'top', { get: function(){ return window; }, configurable: false });
    Object.defineProperty(window, 'parent', { get: function(){ return window; }, configurable: false });
  } catch(e){}

  // ── 6. Block window.location.replace/assign redirects ──
  try {
    var _locReplace = window.location.replace;
    var _locAssign = window.location.assign;
    var _locHref = Object.getOwnPropertyDescriptor(Window.prototype, 'location');
    var blockedHref = window.location.href;
    window.location.replace = function(v){
      if(v && v.indexOf(document.domain) === -1 && v.indexOf('about:blank') === -1) return;
      _locReplace.call(window.location, v);
    };
    window.location.assign = function(v){
      if(v && v.indexOf(document.domain) === -1 && v.indexOf('about:blank') === -1) return;
      _locAssign.call(window.location, v);
    };
  } catch(e){}

  // ── 7. Intercept fetch requests to ad domains ──
  var origFetch = window.fetch;
  window.fetch = function(input, opts){
    var url = (typeof input === 'string') ? input : (input && input.url ? input.url : '');
    if(url && (AD_KEYWORDS.some(function(k){ return url.indexOf(k) !== -1; }))){
      return Promise.resolve(new Response('', { status: 200, headers: { 'Content-Type': 'text/plain' } }));
    }
    return origFetch.call(this, input, opts);
  };

  // ── 8. Intercept XMLHttpRequest to ad domains ──
  var origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url){
    if(url && (AD_KEYWORDS.some(function(k){ return (typeof url === 'string' && url.indexOf(k) !== -1); }))){
      return;
    }
    return origOpen.apply(this, arguments);
  };

  // ── 9. Block first click (many ads trigger on first interaction) ──
  var firstClick = true;
  document.addEventListener('click', function(e){
    if(firstClick){
      var t = e.target;
      if(!t.closest('video,button,[class*="play"],[class*="control"],[id*="play"],[id*="control"],[class*="btn"],[class*="vjs"],[class*="jw"]')){
        e.preventDefault();
        e.stopImmediatePropagation();
        firstClick = false;
        return;
      }
    }
    firstClick = false;
    var a = e.target.closest('a');
    if(a && (a.target==="_blank"||a.target==="_top"||a.target==="top"||a.target==="_parent")){
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);

  // ── 10. Block middle-click on links (opens new tabs) ──
  document.addEventListener('auxclick', function(e){
    var a = e.target.closest('a');
    if(a){
      e.preventDefault();
      e.stopImmediatePropagation();
  
