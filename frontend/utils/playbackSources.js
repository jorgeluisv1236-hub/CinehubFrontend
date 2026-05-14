/**
 * Orden de búsqueda en playback_sources.json:
 * 1) id del contenido (p. ej. "8557")
 */
export function resolvePlaybackSources(catalog, movie, orderedMovies) {
  if (!movie || !catalog || typeof catalog !== 'object') return [];

  const tryList = (arr) => (Array.isArray(arr) && arr.length > 0 ? arr : null);

  const byContentId = tryList(catalog[String(movie.id)] ?? catalog[movie.id]);
  if (byContentId) return byContentId;

  if (Array.isArray(movie.playbackSources) && movie.playbackSources.length > 0) {
    return movie.playbackSources;
  }

  return [];
}
