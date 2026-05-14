import React from 'react';
import './Hero.css';

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

const Hero = ({ movie, onOpenModal, onSorprendeme }) => {
  if (!movie) return null;

  const backdrop =
    movie.artwork?.backdrop?.large ||
    movie.artwork?.backdrop?.medium ||
    movie.artwork?.backdrop?.small;

  const genres = movie.genres?.slice(0, 3).map((g) => g.name).filter(Boolean) || [];
  const year = releaseYear(movie.releaseDate);
  const runtime = formatRuntime(movie.runtime);
  const cert = movie.certification || null;

  const metaParts = [year, runtime, cert].filter(Boolean);

  return (
    <div className="hero">
      {backdrop && (
        <div
          className="hero-backdrop"
          style={{ backgroundImage: `url(${backdrop})` }}
          aria-hidden
        />
      )}
      <div className="hero-gradient" aria-hidden />

      <div className="hero-content">
        <span className="hero-badge">Destacado</span>

        <h1 className="hero-title">{movie.title}</h1>

        {genres.length > 0 && (
          <div className="hero-genre-tags">
            {genres.map((g) => (
              <span key={g} className="hero-genre-tag">{g}</span>
            ))}
          </div>
        )}

        {movie.overview && (
          <p className="hero-overview">{movie.overview}</p>
        )}

        {metaParts.length > 0 && (
          <div className="hero-meta">
            {metaParts.map((part, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span className="hero-meta-dot" aria-hidden />}
                <span>{part}</span>
              </React.Fragment>
            ))}
          </div>
        )}

        <div className="hero-actions">
          <button className="hero-btn-play" onClick={() => onOpenModal(movie)}>
            ▶ Reproducir
          </button>
          <button className="hero-btn-info" onClick={() => onOpenModal(movie)}>
            ℹ Más info
          </button>
          {onSorprendeme && (
            <button className="hero-btn-surprise" onClick={onSorprendeme}>
              🎲 Sorpréndeme
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Hero;
