import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, AlertCircle, Maximize2, SkipForward } from 'lucide-react';
import './PlaybackPanel.css';

const IFRAME_ALLOW =
  'accelerometer *; autoplay *; clipboard-write *; encrypted-media *; gyroscope *; picture-in-picture *; web-share *; fullscreen *';

const TIMEOUT_MS = 14000; // 14s without onLoad → assume server failed

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
  const frameWrapRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    setActiveIndex(firstValidIdx >= 0 ? firstValidIdx : 0);
    setIframeLoading(true);
    setTimedOut(false);
  }, [firstValidIdx, usable]);

  // Timeout: if iframe doesn't fire onLoad within TIMEOUT_MS, assume failure
  useEffect(() => {
    clearTimeout(timeoutRef.current);
    if (iframeLoading) {
      timeoutRef.current = setTimeout(() => {
        setIframeLoading(false);
        setTimedOut(true);
      }, TIMEOUT_MS);
    }
    return () => clearTimeout(timeoutRef.current);
  }, [iframeLoading, activeIndex]);

  // Fullscreen change listener
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const active = usable[activeIndex] ?? null;
  const activeUrl = active?._valid ? active.embedUrl.trim() : '';
  const hasNext = activeIndex < usable.length - 1;

  const onSelect = useCallback((idx) => {
    setActiveIndex(idx);
    setIframeLoading(true);
    setTimedOut(false);
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

  if (!usable.length) {
    return (
      <div className="playback-panel playback-panel--empty">
        <AlertCircle size={40} strokeWidth={1.5} aria-hidden />
        <p className="playback-panel__empty-title">Sin fuentes de reproducción</p>
      </div>
    );
  }

  return (
    <div className="playback-panel">
      <div className="playback-panel__toolbar">
        <span className="playback-panel__toolbar-label">Servidor:</span>
        <div className="playback-panel__sources" role="tablist" aria-label="Servidor de reproducción">
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
        <span className="playback-panel__lang-hint">Si el audio no es en español, cambia de servidor</span>
        <div className="playback-panel__toolbar-actions">
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
        {iframeLoading && activeUrl && (
          <div className="playback-panel__loading" aria-live="polite">
            <Loader2 className="playback-panel__spinner" size={36} aria-hidden />
            <span>Cargando reproductor…</span>
          </div>
        )}

        {timedOut && (
          <div className="playback-panel__timeout">
            <AlertCircle size={32} strokeWidth={1.5} />
            <p>Este servidor no respondió.</p>
            {hasNext ? (
              <button type="button" className="playback-panel__retry-btn" onClick={onNextServer}>
                <SkipForward size={14} /> Probar siguiente servidor
              </button>
            ) : (
              <p className="playback-panel__timeout-hint">No hay más servidores disponibles para este título.</p>
            )}
          </div>
        )}

        {!activeUrl ? (
          <div className="playback-panel__blocked">
            <p>La fuente <strong>{active?.name}</strong> no tiene URL válida.</p>
          </div>
        ) : (
          <iframe
            key={activeUrl}
            className="playback-panel__iframe"
            src={activeUrl}
            title={`Reproductor — ${active?.name ?? 'fuente'}`}
            allow={IFRAME_ALLOW}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            onLoad={onIframeLoad}
          />
        )}
      </div>
    </div>
  );
};

export default PlaybackPanel;
