import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { getActorDetails, getActorCredits, profileUrl, posterUrl } from '../utils/tmdb';
import './ActorModal.css';

export default function ActorModal({ actor, allMovies, onOpenMovie, onClose }) {
  const [details, setDetails] = useState(null);
  const [catalogMatches, setCatalogMatches] = useState([]);
  const [loading, setLoading] = useState(true);

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
    if (!actor?.id) return;
    Promise.all([
      getActorDetails(actor.id),
      getActorCredits(actor.id),
    ]).then(([det, credits]) => {
      setDetails(det);
      const byTitle = new Map(
        allMovies.map(m => [m.title?.toLowerCase().trim(), m])
      );
      const seen = new Set();
      const matches = [];
      for (const c of credits) {
        const key = (c.title || c.name || '').toLowerCase().trim();
        const found = byTitle.get(key);
        if (found && !seen.has(found.id)) {
          seen.add(found.id);
          matches.push(found);
        }
      }
      setCatalogMatches(matches);
      setLoading(false);
    });
  }, [actor?.id]);

  if (!actor) return null;

  const photo = details?.profile_path
    ? profileUrl(details.profile_path)
    : actor.profile_path
      ? profileUrl(actor.profile_path)
      : null;

  const bio = details?.biography;
  const birthYear = details?.birthday?.slice(0, 4);

  return (
    <div className="actor-overlay" onClick={onClose}>
      <div className="actor-modal" onClick={e => e.stopPropagation()}>
        <button className="actor-close" onClick={onClose} aria-label="Cerrar">
          <X size={18} />
        </button>

        <div className="actor-header">
          <div className="actor-photo-wrap">
            {photo
              ? <img src={photo} alt={actor.name} className="actor-photo" />
              : <div className="actor-photo-placeholder">{actor.name[0]}</div>
            }
          </div>
          <div className="actor-meta">
            <h2 className="actor-name">{actor.name}</h2>
            {birthYear && <p className="actor-birth">Nacido en {birthYear}</p>}
            {bio && (
              <p className="actor-bio">
                {bio.length > 320 ? bio.slice(0, 320) + '…' : bio}
              </p>
            )}
          </div>
        </div>

        <div className="actor-section-title">
          En nuestro catálogo
          {!loading && <span className="actor-count">{catalogMatches.length}</span>}
        </div>

        {loading ? (
          <div className="actor-loading">Buscando títulos…</div>
        ) : catalogMatches.length === 0 ? (
          <div className="actor-empty">No encontramos títulos de este actor en el catálogo.</div>
        ) : (
          <div className="actor-grid">
            {catalogMatches.map(item => {
              const poster =
                item.artwork?.poster?.medium ||
                item.artwork?.poster?.small ||
                item.artwork?.poster?.large ||
                null;
              return (
                <button
                  key={item.id}
                  className="actor-card"
                  onClick={() => { onClose(); onOpenMovie(item); }}
                >
                  <div className="actor-card-img">
                    {poster
                      ? <img src={poster} alt={item.title} loading="lazy" />
                      : <div className="actor-card-no-img">{item.title[0]}</div>
                    }
                  </div>
                  <span className="actor-card-title">{item.title}</span>
                  {item.releaseDate && (
                    <span className="actor-card-year">{item.releaseDate.slice(0, 4)}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
