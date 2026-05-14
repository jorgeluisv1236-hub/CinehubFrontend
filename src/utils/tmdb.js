const TOKEN = import.meta.env.VITE_TMDB_TOKEN;
const DIRECT = 'https://api.themoviedb.org/3';
const PROXY  = '/api/tmdb';          // Vercel serverless proxy
const IMG    = 'https://image.tmdb.org/t/p';

const headers = { Authorization: `Bearer ${TOKEN}` };
const cache   = new Map();

async function get(path) {
  if (cache.has(path)) return cache.get(path);
  try {
    // Try direct first; if connection fails use the Vercel proxy
    let res = await fetch(`${DIRECT}${path}`, { headers }).catch(() => null);
    if (!res || !res.ok) {
      res = await fetch(`${PROXY}?path=${encodeURIComponent(path)}`);
    }
    const data = await res.json();
    cache.set(path, data);
    return data;
  } catch { return null; }
}

export async function searchTmdb(title, year, type = 'movie') {
  const q = encodeURIComponent(title);
  const yr = year ? `&year=${year}` : '';
  const endpoint = type === 'tv' ? 'tv' : 'movie';
  const data = await get(`/search/${endpoint}?query=${q}${yr}&language=es-MX&page=1`);
  return data?.results?.[0] || null;
}

export async function getTmdbDetails(tmdbId, type = 'movie') {
  const lang = 'es-MX';
  if (type === 'tv') {
    return get(`/tv/${tmdbId}?language=${lang}&append_to_response=content_ratings`);
  }
  return get(`/movie/${tmdbId}?language=${lang}&append_to_response=release_dates`);
}

export async function getTmdbCast(tmdbId, type = 'movie') {
  const endpoint = type === 'tv' ? 'tv' : 'movie';
  const data = await get(`/${endpoint}/${tmdbId}/credits?language=es-MX`);
  return (data?.cast || []).slice(0, 10);
}

export async function getTmdbTrailer(tmdbId, type = 'movie') {
  const endpoint = type === 'tv' ? 'tv' : 'movie';
  const data = await get(`/${endpoint}/${tmdbId}/videos?language=es-MX`);
  const videos = data?.results || [];
  const trailer = videos.find(v => v.type === 'Trailer' && v.site === 'YouTube')
    || videos.find(v => v.site === 'YouTube');
  if (trailer) return trailer.key;
  const enData = await get(`/${endpoint}/${tmdbId}/videos?language=en-US`);
  const enVideos = enData?.results || [];
  return enVideos.find(v => v.type === 'Trailer' && v.site === 'YouTube')?.key
    || enVideos.find(v => v.site === 'YouTube')?.key
    || null;
}

export async function getTmdbSimilar(tmdbId, type = 'movie') {
  const endpoint = type === 'tv' ? 'tv' : 'movie';
  const data = await get(`/${endpoint}/${tmdbId}/similar?language=es-MX&page=1`);
  return (data?.results || []).slice(0, 8).map(r => ({
    tmdbId: r.id,
    title: r.title || r.name,
    posterUrl: r.poster_path ? `${IMG}/w185${r.poster_path}` : null,
    year: (r.release_date || r.first_air_date || '').slice(0, 4),
    rating: r.vote_average?.toFixed(1),
  }));
}

export async function getUpcoming() {
  const data = await get('/movie/upcoming?language=es-MX&page=1&region=MX');
  return (data?.results || []).slice(0, 10);
}

export function posterUrl(path, size = 'w185') {
  return path ? `${IMG}/${size}${path}` : null;
}

export function profileUrl(path) {
  return path ? `${IMG}/w185${path}` : null;
}

export async function getActorCredits(personId) {
  const data = await get(`/person/${personId}/combined_credits?language=es-MX`);
  return (data?.cast || [])
    .filter(r => r.poster_path && (r.title || r.name))
    .sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
}

export async function getActorDetails(personId) {
  return get(`/person/${personId}?language=es-MX`);
}
