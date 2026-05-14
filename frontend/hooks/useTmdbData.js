import { useState, useEffect } from 'react';
import { searchTmdb, getTmdbDetails, getTmdbCast, getTmdbTrailer, getTmdbSimilar } from '../utils/tmdb';

const hookCache = new Map();

export function useTmdbData(item) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!item) return;
    const key = `${item.id}`;
    if (hookCache.has(key)) { setData(hookCache.get(key)); setLoading(false); return; }

    setLoading(true);
    const type = item.type === 'Show' ? 'tv' : 'movie';
    const year = item.releaseDate?.slice(0, 4) || '';

    const run = async () => {
      try {
        // Search TMDB for this item
        const result = await searchTmdb(item.title, year, type);
        if (!result) { setLoading(false); return; }

        const tmdbId = result.id;

        // Fetch all in parallel
        const [details, cast, trailerKey, similar] = await Promise.all([
          getTmdbDetails(tmdbId, type),
          getTmdbCast(tmdbId, type),
          getTmdbTrailer(tmdbId, type),
          getTmdbSimilar(tmdbId, type),
        ]);

        // Extract certification
        let certification = null;
        if (type === 'movie') {
          const releases = details?.release_dates?.results || [];
          const mx = releases.find(r => r.iso_3166_1 === 'MX') || releases.find(r => r.iso_3166_1 === 'US');
          certification = mx?.release_dates?.[0]?.certification || null;
        } else {
          const ratings = details?.content_ratings?.results || [];
          const mx = ratings.find(r => r.iso_3166_1 === 'MX') || ratings.find(r => r.iso_3166_1 === 'US');
          certification = mx?.rating || null;
        }

        const enriched = {
          tmdbId,
          rating: result.vote_average?.toFixed(1),
          voteCount: result.vote_count,
          overview: details?.overview || result.overview || '',
          runtime: type === 'movie' ? details?.runtime : null,
          originCountry: (details?.origin_country || details?.production_countries?.map(c => c.iso_3166_1) || []),
          certification,
          cast,
          trailerKey,
          similar,
        };

        hookCache.set(key, enriched);
        setData(enriched);
      } catch { }
      setLoading(false);
    };

    run();
  }, [item?.id]);

  return { tmdb: data, tmdbLoading: loading };
}