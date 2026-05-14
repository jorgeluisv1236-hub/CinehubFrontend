import React, { useEffect, useState, useRef, useCallback, memo } from 'react';
import './MovieGrid.css';

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

const MovieCard = memo(({ movie, idx, onOpenModal, onMarkWatched, watchedIds, top10 }) => {
  const year = releaseYear(movie.releaseDate);
  const runtime = formatRuntime(movie.runtime);
  const genres = movie.genres?.slice(0, 2).map((g) => g.name).filter(Boolean) || [];
  const poster =
    movie.artwork?.poster?.medium ||
    movie.artwork?.poster?.small ||
    'https://via.placeholder.com/200x300/1e1e1e/9b9b9b?text=Sin+imagen';
  const isSeen = watchedIds?.has(Number(movie.id));

  const card = (
    <div
      className={`movie-card${isSeen ? ' card-seen' : ''}`}
      style={{ animationDelay: `${(idx % 12) * 0.04}s` }}
      onClick={() => onOpenModal(movie)}
    >
      <div className="card-image-wrapper">
        <img
          src={poster}
          alt={movie.title}
          className="card-image"
          loading="lazy"
        />
        <span className="card-hd-badge">HD</span>
        <div className="card-overlay">
          <div className="card-play-icon">▶</div>
          {onMarkWatched && (
            <button
              className={`card-watched-btn${isSeen ? ' watched' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onMarkWatched(movie.id, movie.type === 'Show' ? 'series' : 'movie', !isSeen);
              }}
              title={isSeen ? 'Quitar de visto' : 'Marcar como visto'}
            >
              ✓
            </button>
          )}
        </div>
      </div>
      <div className="card-info">
        <h3 className="card-title">{movie.title}</h3>
        {(year || runtime) && (
          <div className="card-meta-row">
            {year && <span>{year}</span>}
            {year && runtime && <span className="card-meta-dot">·</span>}
            {runtime && <span>{runtime}</span>}
          </div>
        )}
        {genres.length > 0 && (
          <div className="card-genre-tags">
            {genres.map((g) => (
              <span key={g} className="card-genre-chip">{g}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  if (top10) {
    return (
      <div className="top10-item">
        <span className="top10-number">{idx + 1}</span>
        {card}
      </div>
    );
  }

  return card;
});

const MovieGrid = ({ title, movies, onOpenModal, batchSize = 60, watchedIds, onMarkWatched, top10 = false }) => {
  const [visible, setVisible] = useState(batchSize);
  const sentinelRef = useRef(null);

  useEffect(() => {
    setVisible(batchSize);
  }, [movies, batchSize]);

  const loadMore = useCallback(() => {
    setVisible((v) => Math.min(v + batchSize, movies.length));
  }, [batchSize, movies.length]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { rootMargin: '400px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  if (!movies || movies.length === 0) return null;

  const slice = movies.slice(0, visible);
  const hasMore = visible < movies.length;

  return (
    <section className="movie-section container">
      <div className="section-header">
        <h2 className="section-title">{title}</h2>
      </div>

      <div className={`movie-grid${top10 ? ' movie-grid--top10' : ''}`}>
        {slice.map((movie, idx) => (
          <MovieCard
            key={movie.uuid || `movie-${movie.id}`}
            movie={movie}
            idx={idx}
            onOpenModal={onOpenModal}
            onMarkWatched={onMarkWatched}
            watchedIds={watchedIds}
            top10={top10}
          />
        ))}
      </div>

      {hasMore && (
        <div ref={sentinelRef} className="movie-grid-sentinel" aria-hidden>
          <span className="movie-grid-sentinel-text">Cargando más...</span>
        </div>
      )}
    </section>
  );
};

export default memo(MovieGrid);
