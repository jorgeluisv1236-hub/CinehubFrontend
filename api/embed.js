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

  // Script that blocks popups, new tabs and top-level redirects
  const blocker = `<script>(function(){
  // Block window.open → no new tabs / popups
  window.open = function(){ return {focus:function(){},blur:function(){},close:function(){},closed:false,location:{href:''}}; };

  // Block first click (many ads fire on first click only)
  var firstClick = true;
  document.addEventListener('click', function(e){
    if(firstClick){
      var t = e.target;
      // If clicking something that looks like an ad overlay (not video controls), block it
      if(!t.closest('video,button,[class*="play"],[class*="control"],[id*="play"],[id*="control"]')){
        e.preventDefault();
        e.stopImmediatePropagation();
        firstClick = false;
        return;
      }
    }
    firstClick = false;
    // Block _blank links
    var a = e.target.closest('a');
    if(a && (a.target==="_blank"||a.target==="_top"||a.target==="top")){
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);

  // Intercept all anchor targets on load
  function fixLinks(){
    document.querySelectorAll('a[target]').forEach(function(a){
      if(a.target!=="_self") a.removeAttribute("target");
    });
  }
  document.addEventListener('DOMContentLoaded', fixLinks);
  setTimeout(fixLinks, 500);
  setTimeout(fixLinks, 2000);

  // Block top navigation attempts
  try {
    Object.defineProperty(window, 'top', { get: function(){ return window; }, configurable: true });
  } catch(e){}
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
