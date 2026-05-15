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
        // Use pre-fetched tmdbId if available, otherwise search TMDB
        let tmdbId = item.tmdbId ? Number(item.tmdbId) : null;
        let searchResult = null;
        if (!tmdbId) {
          searchResult = await searchTmdb(item.title, year, type);
          if (!searchResult) { setLoading(false); return; }
          tmdbId = searchResult.id;
        }

        // Skip trailer fetch if already pre-fetched in item data
        const [details, cast, trailerKeyFetched, similar] = await Promise.all([
          getTmdbDetails(tmdbId, type),
          getTmdbCast(tmdbId, type),
          item.trailer ? Promise.resolve(null) : getTmdbTrailer(tmdbId, type),
          getTmdbSimilar(tmdbId, type),
        ]);
        const trailerKey = item.trailer || trailerKeyFetched;

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
          rating: (searchResult?.vote_average ?? details?.vote_average)?.toFixed(1),
          voteCount: searchResult?.vote_count ?? details?.vote_count,
          overview: details?.overview || searchResult?.overview || '',
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