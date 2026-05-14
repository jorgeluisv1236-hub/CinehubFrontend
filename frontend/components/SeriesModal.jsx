import React, { useState, useEffect } from 'react';
import { X, ChevronDown, ChevronUp, Play, Clock, Globe, Share2, Check } from 'lucide-react';
import PlaybackPanel from './PlaybackPanel';
import StarRating from './StarRating';
import SimilarMovies from './SimilarMovies';
import { useTmdbData } from '../hooks/useTmdbData';
import { profileUrl } from '../utils/tmdb';
import './SeriesModal.css';

function EpisodeItem({ episode, sources, onPlay }) {
  const hasSources = sources && sources.length > 0;

  return (
    <div className="s-episode-item">
      <div className="s-episode-number">{episode.number}</div>
      <div className="s-episode-info">
        <div className="s-episode-name">{episode.name || `Episodio ${episode.number}`}</div>
        <div className="s-episode-meta">
          {episode.runtime && (
            <span className="s-episode-runtime">
              <Clock size={12} /> {episode.runtime}min
            </span>
          )}
          {episode.languages && episode.languages.length > 0 && (
            <span className="s-episode-languages">
              <Globe size={12} /> {episode.languages.join(', ').toUpperCase()}
            </span>
          )}
        </div>
        {episode.overview && (
          <div className="s-episode-overview">{episode.overview}</div>
        )}
      </div>
      <button
        className={`s-episode-play-btn${hasSources ? ' has-sources' : ''}`}
        disabled={!hasSources}
        onClick={() => onPlay?.(episode, sources || [])}
        title={hasSources ? 'Reproducir' : 'Sin fuentes'}
      >
        <Play size={16} fill={hasSources ? 'currentColor' : 'none'} />
      </button>
    </div>
  );
}

function SeasonSection({ season, episodes, seriesSources, seriesId, onPlay }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="s-season-section">
      <button
        className="s-season-header"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <span className="s-season-title">
          Temporada {season.number}
          <span className="s-episode-count">{episodes.length} episodios</span>
        </span>
        {expanded
          ? <ChevronUp size={18} className="s-season-chevron open" />
          : <ChevronDown size={18} className="s-season-chevron" />}
      </button>
      {expanded && (
        <div className="s-episode-list">
          {episodes.map((ep) => {
            const srcKey = seriesId + '_' + season.id + '_' + ep.id;
            const sources = seriesSources?.[srcKey];
            return (
              <EpisodeItem
                key={ep.id}
                episode={ep}
                sources={sources}
                onPlay={onPlay}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function SeriesModal({ series, onClose, allMovies, onOpenSimilar, onActorClick }) {
  const [seasons, setSeasons] = useState([]);
  const [episodes, setEpisodes] = useState({});
  const [sources, setSources] = useState({});
  const [loading, setLoading] = useState(true);
  const [playingEpisode, setPlayingEpisode] = useState(null);
  const [copied, setCopied] = useState(false);
  const { tmdb, tmdbLoading } = useTmdbData(series);

  const sid = String(series.id);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'auto'; };
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    Promise.all([
      fetch('/series_detail.json').then(r => r.json()),
      fetch('/series_episodes.json').then(r => r.json()),
      fetch('/series_sources.json').then(r => r.json()).catch(() => ({})),
    ]).then(([detailData, epData, srcData]) => {
      const sd = detailData[sid];
      if (sd?.seasons) setSeasons(sd.seasons);
      const prefix = sid + '_';
      const seriesEps = {};
      for (const key of Object.keys(epData)) {
        if (key.startsWith(prefix)) seriesEps[key] = epData[key];
      }
      setEpisodes(seriesEps);
      setSources(srcData);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [sid]);

  const handlePlay = (episode, epSources) => {
    setPlayingEpisode({ episode, sources: epSources });
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const episodeList = (seasonId) => episodes[sid + '_' + seasonId] || [];
  const totalEps = Object.values(episodes).flat().length;

  const backdrop =
    series.artwork?.backdrop?.large ||
    series.artwork?.backdrop?.medium ||
    series.artwork?.backdrop?.small;

  return (
    <div className="s-modal-overlay" onClick={onClose}>
      <div className="s-modal-content" onClick={e => e.stopPropagation()}>
        <button className="s-modal-close" onClick={onClose} aria-label="Cerrar">
          <X size={20} />
        </button>

        {playingEpisode ? (
          <div className="s-playback-area">
            <div className="s-playback-topbar">
              <button className="s-back-btn" onClick={() => setPlayingEpisode(null)}>
                ← Episodios
              </button>
              <span className="s-playing-title">
                {series.title} · {playingEpisode.episode.name || `Episodio ${playingEpisode.episode.number}`}
              </span>
            </div>
            <PlaybackPanel
              title={`${series.title} — ${playingEpisode.episode.name || `Ep. ${playingEpisode.episode.number}`}`}
              sources={playingEpisode.sources}
            />
          </div>
        ) : (
          <>
            <div
              className="s-modal-header"
              style={backdrop ? { backgroundImage: `url(${backdrop})` } : undefined}
            >
              <div className="s-modal-header-gradient" />
              <div className="s-modal-header-info">
                {series.artwork?.logo?.medium ? (
                  <img src={series.artwork.logo.medium} alt={series.title} className="s-modal-logo" loading="lazy" />
                ) : (
                  <h1 className="s-modal-title">{series.title}</h1>
                )}
                <div className="s-modal-meta">
                  {seasons.length > 0 && (
                    <span>{seasons.length} {seasons.length === 1 ? 'Temporada' : 'Temporadas'}</span>
                  )}
                  {totalEps > 0 && <span>{totalEps} episodios</span>}
                </div>
                {(series.overview || tmdb?.overview) && <p className="s-modal-overview">{series.overview || tmdb.overview}</p>}

                {tmdb?.rating && Number(tmdb.rating) > 0 && (
                  <div className="s-tmdb-rating">
                    <span className="s-rating-star">★</span>
                    <span className="s-rating-value">{tmdb.rating}</span>
                    <span className="s-rating-label">/10 TMDB</span>
                    {tmdb.certification && <span className="s-cert-badge">{tmdb.certification}</span>}
                  </div>
                )}

                {tmdb?.trailerKey && (
                  <div className="s-trailer-wrap">
                    <a
                      href={`https://www.youtube.com/watch?v=${tmdb.trailerKey}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="s-trailer-btn"
                    >
                      ▶ Ver Trailer
                    </a>
                  </div>
                )}

                {tmdb?.cast && tmdb.cast.length > 0 && (
                  <div className="s-cast-section">
                    <h4 className="s-cast-title">Reparto</h4>
                    <div className="s-cast-scroll">
                      {tmdb.cast.map(actor => (
                        <div
                          key={actor.id}
                          className="s-cast-card"
                          onClick={() => onActorClick?.(actor)}
                          style={onActorClick ? { cursor: 'pointer' } : undefined}
                          title={onActorClick ? `Ver filmografía de ${actor.name}` : undefined}
                        >
                          <div className="s-cast-photo">
                            {actor.profile_path
                              ? <img src={profileUrl(actor.profile_path)} alt={actor.name} loading="lazy" />
                              : <div className="s-cast-no-photo">{actor.name[0]}</div>
                            }
                          </div>
                          <span className="s-cast-name">{actor.name}</span>
                          <span className="s-cast-char">{actor.character}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="s-modal-body">
              {loading ? (
                <div className="s-loading">Cargando episodios...</div>
              ) : seasons.length === 0 ? (
                <div className="s-no-seasons">No hay información de temporadas disponible.</div>
              ) : (
                seasons.map(sn => (
                  <SeasonSection
                    key={sn.id}
                    season={sn}
                    episodes={episodeList(sn.id)}
                    seriesSources={sources}
                    seriesId={sid}
                    onPlay={handlePlay}
                  />
                ))
              )}
            </div>

            <div className="s-extras">
              <button className="s-share-btn" onClick={handleShare}>
                {copied ? <Check size={14} /> : <Share2 size={14} />}
                {copied ? 'Copiado' : 'Compartir'}
              </button>
              <StarRating contentId={series.id} contentType="series" />
              <SimilarMovies movie={series} allMovies={allMovies} onOpen={onOpenSimilar} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
