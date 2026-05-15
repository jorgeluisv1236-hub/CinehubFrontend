import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Loader2, AlertCircle, Maximize2, SkipForward, Tv2 } from 'lucide-react';
import './PlaybackPanel.css';

const IFRAME_ALLOW =
  'accelerometer *; autoplay *; clipboard-write *; encrypted-media *; gyroscope *; picture-in-picture *; web-share *; fullscreen *';

const TIMEOUT_MS = 18000;


function isValidUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const t = url.trim();
  if (!t.startsWith('http://')&&!t.startsWith('https://')) return false;
  if (t.includes('reemplaza_con_tu_file_id')) return false;
  try { return !!new URL(t).hostname; } catch { return false; }
}
async function extUrl(embedUrl, signal) {
  const r = await fetch('/api/extract?url='+encodeURIComponent(embedUrl), { signal });
  if (!r.ok) return null;
  const d = await r.json();
  return d.url ? d : null;
}

const PlaybackPanel = ({ title, sources = [] }) => {
  const usable = useMemo(() => {
    const seen = new Set();
    return (sources||[]).map((s,i)=>({...s,_index:i,_valid:isValidUrl(s.embedUrl)})).filter(s=>{
      if (!s.name||!s.embedUrl) return false;
      const k = s.embedUrl.trim();
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });
  }, [sources]);
  const fvi = useMemo(()=>usable.findIndex(s=>s._valid),[usable]);
  const [ai, setAi] = useState(0);
  const [loading, setLoading] = useState(true);
  const [timedOut, setTimedOut] = useState(false);
  const [fs, setFs] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [nv, setNv] = useState(null);
  const [ef, setEf] = useState(false);
  const fwRef = useRef(null);
  const ifRef = useRef(null);
  const vRef = useRef(null);
  const toRef = useRef(null);

  useEffect(()=>{
    setAi(fvi>=0?fvi:0); setLoading(true); setTimedOut(false);
    setNv(null); setExtracting(false); setEf(false);
  },[fvi,usable]);
  useEffect(()=>{
    clearTimeout(toRef.current);
    if(loading&&!nv) toRef.current=setTimeout(()=>{setLoading(false);setTimedOut(true);},TIMEOUT_MS);
    return ()=>clearTimeout(toRef.current);
  },[loading,ai,nv]);
  useEffect(()=>{
    const o=()=>setFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange',o);
    return ()=>document.removeEventListener('fullscreenchange',o);
  },[]);

  // ── Parent-side protection: popups, focus, clicks, frame-busting ──
  useEffect(()=>{
    if(nv) return;
    const oo = window.open;
    window.open = ()=>null;
    let ft;
    const b = ()=>{ ft=setTimeout(()=>window.focus(),80); };
    const f = ()=>clearTimeout(ft);
    window.addEventListener('blur',b); window.addEventListener('focus',f);
    let first=true;
    const cc = (e)=>{
      if(first){first=false;e.preventDefault();e.stopPropagation();return;}
      const a=e.target.closest('a');
      if(a&&(a.target==='_blank'||a.target==='_top')) e.preventDefault();
    };
    document.addEventListener('click',cc,true);
    const lo = window.location.origin+'/';
    let un = false;
    const mn = ()=>{un=true;setTimeout(()=>un=false,3000);};
    document.addEventListener('click',mn); document.addEventListener('submit',mn);
    const bg = setInterval(()=>{
      const h = window.location.href;
      if(!h.startsWith(lo)&&!h.startsWith('blob:')&&!h.startsWith('about:')&&!un) window.location.replace(lo);
    },300);
    return ()=>{
      window.open=oo; window.removeEventListener('blur',b); window.removeEventListener('focus',f);
      document.removeEventListener('click',cc,true); clearTimeout(ft);
      document.removeEventListener('click',mn); document.removeEventListener('submit',mn);
      clearInterval(bg);
    };
  },[nv]);

  // ── HLS.js ──
  useEffect(()=>{
    if(!nv||!vRef.current) return;
    const v = vRef.current;
    if(nv.type==='hls'&&Hls.isSupported()){
      const h = new Hls({enableWorker:true});
      h.loadSource(nv.url); h.attachMedia(v);
      h.on(Hls.Events.MANIFEST_PARSED,()=>v.play().catch(()=>{}));
      return ()=>h.destroy();
    } else if(nv.type==='mp4'||v.canPlayType('application/vnd.apple.mpegurl')){
      v.src=nv.url; v.play().catch(()=>{});
    }
  },[nv]);

  const active = usable[ai] ?? null;
  const activeUrl = active?._valid ? active.embedUrl.trim() : '';
  const hasNext = ai < usable.length - 1;

  const onSelect = useCallback((idx)=>{
    setAi(idx); setLoading(true); setTimedOut(false);
    setNv(null); setExtracting(false); setEf(false);
  },[]);

  const onLoad = useCallback(()=>{
    clearTimeout(toRef.current); setLoading(false); setTimedOut(false);
  },[]);

  const onNext = useCallback(()=>{
    const n = usable.findIndex((s,i)=>i>ai&&s._valid);
    if(n!==-1) onSelect(n);
    else if(hasNext) onSelect(ai+1);
  },[ai,usable,hasNext,onSelect]);

  const onFs = useCallback(()=>{
    const el = fwRef.current;
    if(!el) return;
    if(document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  },[]);

  const onExtract = useCallback(async ()=>{
    if(!activeUrl||extracting) return;
    setExtracting(true); setEf(false);
    const ctrl = new AbortController();
    const t = setTimeout(()=>ctrl.abort(),25000);
    try {
      const r = await extUrl(activeUrl,ctrl.signal);
      if(r){ setNv(r); setLoading(false); } else setEf(true);
    } catch { setEf(true); }
    finally { clearTimeout(t); setExtracting(false); }
  },[activeUrl,extracting]);

  useEffect(()=>{
    if(!activeUrl||nv||extracting||ef) return;
    const t = setTimeout(()=>{
      const ctrl = new AbortController();
      const t2 = setTimeout(()=>ctrl.abort(),8000);
      setExtracting(true);
      extUrl(activeUrl,ctrl.signal).then(r=>{if(r&&!ctrl.signal.aborted){setNv(r);setLoading(false);}}).catch(()=>{}).finally(()=>{clearTimeout(t2);setExtracting(false);});
    },2000);
    return ()=>clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[activeUrl]);

  if(!usable.length){
    return (<div className="playback-panel playback-panel--empty"><AlertCircle size={40} strokeWidth={1.5} aria-hidden /><p className="playback-panel__empty-title">Sin fuentes de reproduccion</p></div>);
  }

  return (<div className="playback-panel">
    <div className="playback-panel__toolbar">
      <span className="playback-panel__toolbar-label">Servidor:</span>
      <div className="playback-panel__sources" role="tablist" aria-label="Servidor de reproduccion">
        {usable.map((s,idx)=>(
          <button key={`${s.key??s.name}-${idx}`} type="button" role="tab"
            aria-selected={idx===ai}
            className={`playback-source-chip ${idx===ai?'is-active':''} ${!s._valid?'is-placeholder':''}`}
            onClick={()=>onSelect(idx)}>{s.name}</button>
        ))}
      </div>
      <span className="playback-panel__lang-hint">Si el audio no es en espanol, cambia de servidor</span>
      <div className="playback-panel__toolbar-actions">
        {activeUrl&&!nv&&<button type="button" className={`playback-panel__action-btn ${extracting?'is-loading':''}`}
          onClick={onExtract} disabled={extracting}
          title={extracting?'Extrayendo video...':'Reproducir sin anuncios'}>
          {extracting?<Loader2 size={15} className="playback-panel__spinner"/>:<Tv2 size={15}/>}
        </button>}
        {nv&&<button type="button" className="playback-panel__action-btn is-active-mode"
          onClick={()=>{setNv(null);setLoading(true);setEf(false);}}
          title="Volver al reproductor normal"><Tv2 size={15}/></button>}
        {(hasNext||usable.some((s,i)=>i>ai&&s._valid))&&<button type="button" className="playback-panel__action-btn"
          onClick={onNext} title="Siguiente servidor"><SkipForward size={15}/></button>}
        <button type="button" className="playback-panel__action-btn"
          onClick={onFs} title={fs?'Salir de pantalla completa':'Pantalla completa'}>
          <Maximize2 size={15}/></button>
      </div>
    </div>
    <div className="playback-panel__frame-wrap" ref={fwRef}>
      {nv&&<video ref={vRef} className="playback-panel__native-video" controls autoPlay playsInline/>}
      {ef&&!nv&&<div className="playback-panel__extract-hint"><AlertCircle size={14}/><span>No se pudo extraer - usando reproductor normal</span></div>}
      {!nv&&<>
        {loading&&activeUrl&&<div className="playback-panel__loading" aria-live="polite">
          <Loader2 className="playback-panel__spinner" size={36} aria-hidden/>
          <span>Cargando reproductor...</span></div>}
        {timedOut&&<div className="playback-panel__timeout">
          <AlertCircle size={32} strokeWidth={1.5}/>
          <p>Este servidor no respondio.</p>
          {hasNext?<button type="button" className="playback-panel__retry-btn" onClick={onNext}>
            <SkipForward size={14}/> Probar siguiente servidor</button>
          :<p className="playback-panel__timeout-hint">No hay mas servidores disponibles para este titulo.</p>}
        </div>}
        {!activeUrl?<div className="playback-panel__blocked"><p>La fuente <strong>{active?.name}</strong> no tiene URL valida.</p></div>
        :<iframe ref={ifRef} key={activeUrl} className="playback-panel__iframe"
          src={activeUrl}
          title={`Reproductor - ${active?.name??'fuente'}`}
          allow={IFRAME_ALLOW}
          loading="lazy" referrerPolicy="no-referrer-when-downgrade"
          onLoad={onLoad}/>
        }
      </>}
    </div>
  </div>);
};

export default PlaybackPanel;

