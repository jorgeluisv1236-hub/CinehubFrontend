import React, { useMemo } from 'react';
import './SimilarMovies.css';

export default function SimilarMovies({ movie, allMovies, onOpen }) {
  const similar = useMemo(() => {
    if (!movie || !allMovies?.length) return [];
    const genres = new Set(
      (movie.genres || []).map(g => g.name?.toLowerCase()).filter(Boolean)
    );
    if (!genres.size) return [];
    return allMovies
      .filter(m => String(m.id) !== String(movie.id) &&
        (m.genres || []).some(g => genres.has(g.name?.toLowerCase())))
      .slice(0, 6);
  }, [movie, allMovies]);

  if (!similar.length) return null;

  return (
    <div className="similar-movies">
      <h3 className="similar-title">Más como esta</h3>
      <div className="similar-grid">
        {similar.map(m => {
          const poster = m.artwork?.poster?.medium || m.artwork?.poster?.small;
          return (
            <div key={m.id} className="similar-card" onClick={() => onOpen(m)}>
              {poster ? (
                <img src={poster} alt={m.title} className="similar-poster" loading="lazy" />
              ) : (
                <div className="similar-poster similar-poster-empty">
                  {m.title?.[0] || '?'}
                </div>
              )}
              <p className="similar-name">{m.title}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}