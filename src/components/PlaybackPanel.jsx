import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Loader2, AlertCircle, Maximize2, SkipForward, Tv2 } from 'lucide-react';
import './PlaybackPanel.css';

const IFRAME_ALLOW =
  'accelerometer *; autoplay *; clipboard-write *; encrypted-media *; gyroscope *; picture-in-picture *; web-share *; fullscreen *';

// Sandbox not set intentionally -- /api/embed proxy handles ad/popup/redirect
// blocking server-side. Sandbox causes embed sites to detect restrictions
// and refuse to play ("not available due to sandbox iframe").
const IFRAME_SANDBOX = undefined;

const TIMEOUT_MS = 14000;

function isProbablyValidEmbedUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return false;
  if (trimmed.includes('reemplaza_con_tu_file_id')) return false;
  try {
    const u = new URL(trimmed);
    return Boolean(u.hostname);
  } catch {
    return false;
  }
}

function proxyEmbedUrl(embedUrl) {
  if (!embedUrl) return '';
  return `/api/embed?url=${encodeURIComponent(embedUrl.trim())}`;
}

async function extractVideoUrl(embedUrl, signal) {
  const res = await fetch(`/api/extract?url=${encodeURIComponent(embedUrl)}`, { signal });
  if (!res.ok) return null;
  const data = await res.json();
  return data.url ? data : null;
}

const PlaybackPanel = ({ title, sources = [] }) => {
  const usable = useMemo(() => {
    const seen = new Set();
    return (sources || [])
      .map((s, i) => ({ ...s, _index: i, _valid: isProbablyValidEmbedUrl(s.embedUrl) }))
      .filter((s) => {
        if (!s.name || !s.embedUrl) return false;
        const key = s.embedUrl.trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, [sources]);

  const firstValidIdx = useMemo(() => usable.findIndex((s) => s._valid), [usable]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [iframeLoading, setIframeLoading] = useState(true);
  const [timedOut, setTimedOut] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [nativeVideo, setNativeVideo] = useState(null);
  const [extractFailed, setExtractFailed] = useState(false);

  const frameWrapRef = useRef(null);
  const videoRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    setActiveIndex(firstValidIdx >= 0 ? firstValidIdx : 0);
    setIframeLoading(true);
    setTimedOut(false);
    setNativeVideo(null);
    setExtracting(false);
    setExtractFailed(false);
  }, [firstValidIdx, usable]);

  useEffect(() => {
    clearTimeout(timeoutRef.current);
    if (iframeLoading && !nativeVideo) {
      timeoutRef.current = setTimeout(() => {
        setIframeLoading(false);
        setTimedOut(true);
      }, TIMEOUT_MS);
    }
    return () => clearTimeout(timeoutRef.current);
  }, [iframeLoading, activeIndex, nativeVideo]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    if (nativeVideo) return;
    const origOpen = window.open;
    window.open = () => null;

    let focusTimer;
    const onBlur = () => { focusTimer = setTimeout(() => window.focus(), 80); };
    const onFocus = () => clearTimeout(focusTimer);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);

    let first = true;
    const onClickCapture = (e) => {
      if (first) {
        first = false;
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      const a = e.target.closest('a');
      if (a && (a.target === '_blank' || a.target === '_top')) {
        e.preventDefault();
      }
    };
    document.addEventListener('click', onClickCapture, true);

    return () => {
      window.open = origOpen;
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('click', onClickCapture, true);
      clearTimeout(focusTimer);
    };
  }, [nativeVideo]);

  useEffect(() => {
    if (!nativeVideo || !videoRef.current) return;
    const video = videoRef.current;

    if (nativeVideo.type === 'hls' && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true });
      hls.loadSource(nativeVideo.url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
      return () => hls.destroy();
    } else if (nativeVideo.type === 'mp4' || video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = nativeVideo.url;
      video.play().catch(() => {});
    }
  }, [nativeVideo]);

  const active = usable[activeIndex] ?? null;
  const activeUrl = active?._valid ? active.embedUrl.trim() : '';
  const proxiedUrl = useMemo(() => proxyEmbedUrl(activeUrl), [activeUrl]);
  const hasNext = activeIndex < usable.length - 1;

  const onSelect = useCallback((idx) => {
    setActiveIndex(idx);
    setIframeLoading(true);
    setTimedOut(false);
    setNativeVideo(null);
    setExtracting(false);
    setExtractFailed(false);
  }, []);

  const onIframeLoad = useCallback(() => {
    clearTimeout(timeoutRef.current);
    setIframeLoading(false);
    setTimedOut(false);
  }, []);

  const onNextServer = useCallback(() => {
    const nextValid = usable.findIndex((s, i) => i > activeIndex && s._valid);
    if (nextValid !== -1) onSelect(nextValid);
    else if (hasNext) onSelect(activeIndex + 1);
  }, [activeIndex, usable, hasNext, onSelect]);

  const onFullscreen = useCallback(() => {
    const el = frameWrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      el.requestFullscreen?.();
    }
  }, []);

  const onExtract = useCallback(async () => {
    if (!activeUrl || extracting) return;
    setExtracting(true);
    setExtractFailed(false);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    try {
      const result = await extractVideoUrl(activeUrl, controller.signal);
      if (result) {
        setNativeVideo(result);
        setIframeLoading(false);
      } else {
        setExtractFailed(true);
      }
    } catch {
      setExtractFailed(true);
    } finally {
      clearTimeout(timer);
      setExtracting(false);
    }
  }, [activeUrl, extracting]);

  useEffect(() => {
    if (!activeUrl || nativeVideo || extracting || extractFailed) return;
    const timer = setTimeout(() => {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 8000);
      setExtracting(true);
      extractVideoUrl(activeUrl, controller.signal)
        .then((result) => {
          if (result && !controller.signal.aborted) {
            setNativeVideo(result);
            setIframeLoading(false);
          }
        })
        .catch(() => {})
        .finally(() => {
          clearTimeout(t);
          setExtracting(false);
        });
    }, 2000);
    return () => clearTimeout(timer);
  }, [activeUrl]);

  if (!usable.length) {
    return (
      <div className="playback-panel playback-panel--empty">
        <AlertCircle size={40} strokeWidth={1.5} aria-hidden />
        <p className="playback-panel__empty-title">Sin fuentes de reproduccion</p>
      </div>
    );
  }

  return (
    <div className="playback-panel">
      <div className="playback-panel__toolbar">
        <span className="playback-panel__toolbar-label">Servidor:</span>
        <div className="playback-panel__sources" role="tablist" aria-label="Servidor de reproduccion">
          {usable.map((s, idx) => (
            <button
              key={`${s.key ?? s.name}-${idx}`}
              type="button"
              role="tab"
              aria-selected={idx === activeIndex}
              className={`playback-source-chip ${idx === activeIndex ? 'is-active' : ''} ${!s._valid ? 'is-placeholder' : ''}`}
              onClick={() => onSelect(idx)}
            >
              {s.name}
            </button>
          ))}
        </div>
        <span className="playback-panel__lang-hint">Si el audio no es en espanol, cambia de servidor</span>
        <div className="playback-panel__toolbar-actions">
          {activeUrl && !nativeVideo && (
            <button
              type="button"
              className={`playback-panel__action-btn ${extracting ? 'is-loading' : ''}`}
              onClick={onExtract}
              disabled={extracting}
              title={extracting ? 'Extrayendo video...' : 'Reproducir sin anuncios'}
            >
              {extracting
                ? <Loader2 size={15} className="playback-panel__spinner" />
                : <Tv2 size={15} />}
            </button>
          )}
          {nativeVideo && (
            <button
              type="button"
              className="playback-panel__action-btn is-active-mode"
              onClick={() => { setNativeVideo(null); setIframeLoading(true); setExtractFailed(false); }}
              title="Volver al reproductor normal"
            >
              <Tv2 size={15} />
            </button>
          )}
          {(hasNext || usable.some((s, i) => i > activeIndex && s._valid)) && (
            <button
              type="button"
              className="playback-panel__action-btn"
              onClick={onNextServer}
              title="Siguiente servidor"
            >
              <SkipForward size={15} />
            </button>
          )}
          <button
            type="button"
            className="playback-panel__action-btn"
            onClick={onFullscreen}
            title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
          >
            <Maximize2 size={15} />
          </button>
        </div>
      </div>

      <div className="playback-panel__frame-wrap" ref={frameWrapRef}>
        {nativeVideo && (
          <video
            ref={videoRef}
            className="playback-panel__native-video"
            controls
            autoPlay
            playsInline
          />
        )}

        {extractFailed && !nativeVideo && (
          <div className="playback-panel__extract-hint">
            <AlertCircle size={14} />
            <span>No se pudo extraer - usando reproductor normal</span>
          </div>
        )}

        {!nativeVideo && (
          <>
            {iframeLoading && activeUrl && (
              <div className="playback-panel__loading" aria-live="polite">
                <Loader2 className="playback-panel__spinner" size={36} aria-hidden />
                <span>Cargando reproductor...</span>
              </div>
            )}

            {timedOut && (
              <div className="playback-panel__timeout">
                <AlertCircle size={32} strokeWidth={1.5} />
                <p>Este servidor no respondio.</p>
                {hasNext ? (
                  <button type="button" className="playback-panel__retry-btn" onClick={onNextServer}>
                    <SkipForward size={14} /> Probar siguiente servidor
                  </button>
                ) : (
                  <p className="playback-panel__timeout-hint">No hay mas servidores disponibles para este titulo.</p>
                )}
              </div>
            )}

            {!activeUrl ? (
              <div className="playback-panel__blocked">
                <p>La fuente <strong>{active?.name}</strong> no tiene URL valida.</p>
              </div>
            ) : (
              <iframe
                key={activeUrl}
                className="playback-panel__iframe"
                src={proxiedUrl || activeUrl}
                title={`Reproductor - ${active?.name ?? 'fuente'}`}
                allow={IFRAME_ALLOW}
                sandbox={IFRAME_SANDBOX}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                onLoad={onIframeLoad}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PlaybackPanel;

