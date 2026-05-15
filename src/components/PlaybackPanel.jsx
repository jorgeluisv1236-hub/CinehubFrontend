import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Loader2, AlertCircle, Maximize2, SkipForward, Tv2 } from 'lucide-react';
import './PlaybackPanel.css';

const IFRAME_ALLOW =
  'accelerometer *; autoplay *; clipboard-write *; encrypted-media *; gyroscope *; picture-in-picture *; web-share *; fullscreen *';

// Sandbox: block popups, top nav, pointer lock, and modal dialogs
const IFRAME_SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-presentation';

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

// Build proxied embed URL for clean, ad-free iframe loading
function proxyEmbedUrl(embedUrl) {
  if (!embedUrl) return '';
  return `/api/embed?url=${encodeURIComponent(embedUrl.trim())}`;
}

// Try to extract direct video URL via our Puppeteer API (25s timeout)
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

  // Native video extraction state
  const [extracting, setExtracting] = useState(false);
  const [nativeVideo, setNativeVideo] = useState(null);
  const [extractFailed, setExtractFailed] = useState(false);

  const frameWrapRef = useRef(null);
  const videoRef = useRef(null);
  const timeoutRef = useRef(null);
  const extractAbortRef = useRef(null);

  useEffect(() => {
    setActiveIndex(firstValidIdx >= 0 ? firstValidIdx : 0);
    setIframeLoading(true);
    setTimedOut(false);
    setNativeVideo(null);
    setExtracting(false);
    setExtractFailed(false);
  }, [firstValidIdx, usable]);

  // Iframe timeout
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

  // Fullscreen listener
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // Ad blocker: 3-layer fallback (only active when using iframe)
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

  // HLS.js setup when nativeVideo changes
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

  // Trigger extraction for active source (25s client timeout)
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

  // Auto-extract: when no native video and we have a valid URL, try extraction
  // silently with a short timeout. If it succeeds, we get an ad-free native player.
  // This runs once per source change.
  useEffect(() => {
    if (!activeUrl || nativeVideo || extracting || extractFailed) return;
    // Small delay to let the iframe start loading first
    const timer = setTimeout(() => {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 8000); // shorter timeout for auto
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
    // Only run on source change, not when extracting state changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUrl]);

  if (!usabl
