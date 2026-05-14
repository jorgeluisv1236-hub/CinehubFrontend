function normalizeText(s) {
  return (s ?? '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const STOP_WORDS = new Set([
  'el',
  'la',
  'los',
  'las',
  'lo',
  'un',
  'una',
  'unos',
  'unas',
  'de',
  'del',
  'al',
  'y',
  'o',
  'u',
  'en',
  'con',
  'por',
  'para',
  'the',
  'a',
  'an',
  'and',
  'or',
  'of',
  'to',
  'in',
  'on',
  'for',
  'from',
  'by',
  'que',
  'se',
  'su',
  'sus',
  'es',
  'son',
  'le',
  'les',
]);

/** Palabras con peso semántico (evita que «el», «de»… matcheen a medias en sinopsis). */
function meaningfulTokens(rawQuery) {
  return normalizeText(rawQuery)
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));
}

function buildHaystack(movie) {
  const title = normalizeText(movie.title);
  const overview = normalizeText(movie.overview);
  const people = (movie.people || []).map((p) => normalizeText(p?.name)).filter(Boolean).join(' ');
  const genres = (movie.genres || []).map((g) => normalizeText(g?.name)).filter(Boolean).join(' ');
  return { title, overview, hay: `${title} ${overview} ${people} ${genres}` };
}

/**
 * Búsqueda ordenada por relevancia (no al azar):
 * - Coincidencia exacta / empieza por / contiene la frase en el título primero.
 * - Luego todas las palabras significativas en el título.
 * - Después frase en sinopsis.
 * - Por último palabras repartidas en título+sinopsis+reparto+géneros (con umbral si hay términos muy cortos).
 *
 * Modo exacto en título: comillas "así" → solo títulos que contengan esa frase (normalizada).
 */
export function rankedSearchMovies(movies, rawQuery) {
  if (!Array.isArray(movies)) return [];
  const q = rawQuery.trim();
  if (!q) return movies;
  if (q.length < 2) return [];

  const quoted =
    (q.startsWith('"') && q.endsWith('"') && q.length >= 4) || (q.startsWith('«') && q.endsWith('»') && q.length >= 4);
  if (quoted) {
    const inner = q.slice(1, -1).trim();
    if (inner.length < 2) return [];
    const needle = normalizeText(inner);
    return movies
      .filter((m) => buildHaystack(m).title.includes(needle))
      .sort((a, b) => {
        const ta = buildHaystack(a).title;
        const tb = buildHaystack(b).title;
        if (ta === needle && tb !== needle) return -1;
        if (tb === needle && ta !== needle) return 1;
        const sa = ta.startsWith(needle) ? 0 : 1;
        const sb = tb.startsWith(needle) ? 0 : 1;
        if (sa !== sb) return sa - sb;
        return ta.length - tb.length;
      });
  }

  const nq = normalizeText(q);
  const meaningful = meaningfulTokens(q);
  const tokens = meaningful.length > 0 ? meaningful : nq.split(/\s+/).filter((t) => t.length > 0);
  const hasShortToken = tokens.some((t) => t.length < 3);

  const weakQuery =
    meaningful.length === 0 && tokens.length > 0 && tokens.every((t) => STOP_WORDS.has(t));
  if (weakQuery) {
    return movies
      .filter((m) => buildHaystack(m).title.includes(nq))
      .sort((a, b) => buildHaystack(a).title.length - buildHaystack(b).title.length);
  }

  const rows = [];

  for (const m of movies) {
    const { title, overview, hay } = buildHaystack(m);
    let score = 0;

    if (title === nq) {
      score = 100_000;
    } else if (title.startsWith(nq)) {
      score = 95_000 - Math.min(title.length, 500);
    } else if (title.includes(nq)) {
      score = 90_000 - title.indexOf(nq);
    } else if (tokens.length > 0 && tokens.every((t) => title.includes(t))) {
      score = 75_000;
      let pos = 0;
      for (const t of tokens) {
        const i = title.indexOf(t, pos);
        if (i >= 0) {
          score += 500 - Math.min(i, 400);
          pos = i + t.length;
        }
      }
      score -= Math.min(title.length, 300) * 0.05;
    } else if (overview.includes(nq)) {
      score = 40_000 - Math.min(overview.indexOf(nq), 2000) * 0.01;
    } else if (tokens.length > 0 && tokens.every((t) => hay.includes(t))) {
      if (hasShortToken && !tokens.every((t) => title.includes(t))) {
        score = 0;
      } else {
        const inTitle = tokens.filter((t) => title.includes(t)).length;
        score = 22_000 + inTitle * 2_500;
        if (tokens.length === 1 && tokens[0].length >= 4 && !title.includes(tokens[0])) {
          score = Math.min(score, 18_000);
        }
      }
    }

    if (score > 0) {
      rows.push({ movie: m, score });
    }
  }

  rows.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.movie.title || '').length - (b.movie.title || '').length;
  });

  return rows.map((r) => r.movie);
}

/** @deprecated usar rankedSearchMovies para orden fijo por relevancia */
export function filterMoviesByQuery(movies, rawQuery) {
  return rankedSearchMovies(movies, rawQuery);
}
