import { useState, useEffect } from 'react';

const TOKEN = import.meta.env.VITE_TMDB_TOKEN;

export function useTrending(catalog) {
  const [trending, setTrending] = useState([]);

  useEffect(() => {
    if (!TOKEN || !catalog.length) return;

    const fetchTrending = async () => {
      try {
        const [moviesRes, tvRes] = await Promise.all([
          fetch('https://api.themoviedb.org/3/trending/movie/week?language=es-MX', {
            headers: { Authorization: `Bearer ${TOKEN}` },
          }),
          fetch('https://api.themoviedb.org/3/trending/tv/week?language=es-MX', {
            headers: { Authorization: `Bearer ${TOKEN}` },
          }),
        ]);

        const [moviesData, tvData] = await Promise.all([
          moviesRes.json(),
          tvRes.json(),
        ]);

        const tmdbItems = [
          ...(moviesData.results || []),
          ...(tvData.results || []),
        ];

        // Build title lookup from catalog (lowercase)
        const byTitle = new Map();
        catalog.forEach(item => {
          byTitle.set(item.title?.toLowerCase().trim(), item);
        });

        // Match TMDB trending to our catalog
        const matched = [];
        const seen = new Set();

        for (const t of tmdbItems) {
          const title = (t.title || t.name || '').toLowerCase().trim();
          const original = (t.original_title || t.original_name || '').toLowerCase().trim();

          let found = byTitle.get(title) || byTitle.get(original);

          if (found && !seen.has(found.id)) {
            seen.add(found.id);
            matched.push(found);
          }
        }

        setTrending(matched);
      } catch {
        // silently fail
      }
    };

    fetchTrending();
  }, [catalog.length]);

  return trending;
}
