import React, { useEffect, useMemo, useState } from 'react';
import { X, Share2, Check } from 'lucide-react';
import PlaybackPanel from './PlaybackPanel';
import StarRating from './StarRating';
import SimilarMovies from './SimilarMovies';
import { useTmdbData } from '../hooks/useTmdbData';
import { profileUrl } from '../utils/tmdb';
import './MovieModal.css';

function formatRuntime(minutes) {
  if (!minutes || Number.isNaN(Number(minutes))) return null;
  const m = Number(minutes);
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h <= 0) return `${r}m`;
  return r > 0 ? `${h}h ${r}m` : `${h}h`;
}

function releaseYear(releaseDate) {
  if (!releaseDate || typeof releaseDate !== 'string') return null;
  const y = releaseDate.slice(0, 4);
  return /^\d{4}$/.test(y) ? y : null;
}

const MovieModal = ({ movie, onClose, allMovies, onOpenSimilar, onActorClick }) => {
  const [copied, setCopied] = useState(false);
  const { tmdb, tmdbLoading } = useTmdbData(movie);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const castNames = useMemo(() => {
    const people = movie?.people;
    if (!Array.isArray(people) || people.length === 0) return null;
    return people
      .slice(0, 14)
      .map((p) => p.name)
      .filter(Boolean)
      .join(', ');
  }, [movie?.people]);

  const genreLine = useMemo(() => {
    const g = movie?.genres;
    if (!Array.isArray(g) || g.length === 0) return null;
    return g.map((x) => x.name).filter(Boolean);
  }, [movie?.genres]);

  if (!movie) return null;

  const runtimeLabel = formatRuntime(movie.runtime);
  const yearLabel = releaseYear(movie.releaseDate);
  const sources = movie.playbackSources;

  const backdrop =
    movie.artwork?.backdrop?.large ||
    movie.artwork?.backdrop?.medium ||
    movie.artwork?.backdrop?.small;

  const metaParts = [
    yearLabel,
    runtimeLabel,
    movie.languages?.length ? movie.languages.join(', ').toUpperCase() : null,
  ].filter(Boolean);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar">
          <X size={18} />
        </button>

        {backdrop && (
          <div
            className="modal-header"
            style={{ backgroundImage: `url(${backdrop})` }}
            aria-hidden
          >
            <div className="modal-header-gradient" />
            <div className="modal-header-info">
              <h2 className="modal-header-title">{movie.title}</h2>
              {genreLine && genreLine.length > 0 && (
                <div className="modal-header-genres">
                  {genreLine.slice(0, 3).map((g) => (
                    <span key={g} className="modal-header-genre">{g}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="modal-player-section">
          <PlaybackPanel title={movie.title} sources={sources} />
        </div>

        <div className="modal-details">
          <div className="modal-title-row">
            <h2 className="modal-title">{movie.title}</h2>
            <span className="modal-hd-badge">HD</span>
            <button className="modal-share-btn" onClick={handleShare}>
              {copied ? <Check size={14} /> : <Share2 size={14} />}
              {copied ? 'Copiado' : 'Compartir'}
            </button>
          </div>

          {tmdb?.rating && Number(tmdb.rating) > 0 && (
            <div className="modal-tmdb-rating">
              <span className="modal-rating-star">★</span>
              <span className="modal-rating-value">{tmdb.rating}</span>
              <span className="modal-rating-label">/10 TMDB</span>
              {tmdb.certification && <span className="modal-cert-badge">{tmdb.certification}</span>}
            </div>
          )}

          {metaParts.length > 0 && (
            <div className="modal-meta-row">
              {metaParts.map((part, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <span className="modal-meta-dot">·</span>}
                  <span>{part}</span>
                </React.Fragment>
              ))}
            </div>
          )}

          {genreLine && genreLine.length > 0 && (
            <div className="modal-genre-tags">
              {genreLine.map((g) => (
                <span key={g} className="modal-genre-tag">{g}</span>
              ))}
            </div>
          )}

          {(movie.overview || tmdb?.overview) && (
            <p className="modal-overview">{movie.overview || tmdb.overview}</p>
          )}

          {tmdb?.trailerKey && (
            <div className="modal-trailer-wrap">
              <a
                href={`https://www.youtube.com/watch?v=${tmdb.trailerKey}`}
                target="_blank"
                rel="noopener noreferrer"
                className="modal-trailer-btn"
              >
                ▶ Ver Trailer
              </a>
            </div>
          )}

          {tmdb?.cast && tmdb.cast.length > 0 && (
            <div className="modal-cast-section">
              <h4 className="modal-cast-title">Reparto</h4>
              <div className="modal-cast-scroll">
                {tmdb.cast.map(actor => (
                  <div
                    key={actor.id}
                    className="modal-cast-card"
                    onClick={() => onActorClick?.(actor)}
                    style={onActorClick ? { cursor: 'pointer' } : undefined}
                    title={onActorClick ? `Ver filmografía de ${actor.name}` : undefined}
                  >
                    <div className="modal-cast-photo">
                      {actor.profile_path
                        ? <img src={profileUrl(actor.profile_path)} alt={actor.name} loading="lazy" />
                        : <div className="modal-cast-no-photo">{actor.name[0]}</div>
                      }
                    </div>
                    <span className="modal-cast-name">{actor.name}</span>
                    <span className="modal-cast-char">{actor.character}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {castNames && (
            <div className="modal-cast">
              <strong>Reparto:</strong> {castNames}
            </div>
          )}

          <StarRating contentId={movie.id} contentType="movie" />

          <SimilarMovies movie={movie} allMovies={allMovies} onOpen={onOpenSimilar} />
        </div>
      </div>
    </div>
  );
};

export default MovieModal;
