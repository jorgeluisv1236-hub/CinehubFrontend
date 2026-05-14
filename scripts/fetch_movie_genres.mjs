// Uses the Vercel proxy to reach TMDB — runs locally without browser
import { readFileSync, writeFileSync } from 'fs';

const PROXY = 'https://cinehub-roan.vercel.app/api/tmdb';
const OUT   = 'public/movie_genres.json';
const BATCH = 10;
const DELAY = 700;

async function tmdbGet(path) {
  try {
    const r = await fetch(`${PROXY}?path=${encodeURIComponent(path)}`);
    if (r.ok) return await r.json();
  } catch {}
  return null;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Load genre map
const genreData = await tmdbGet('/genre/movie/list?language=es-MX');
const genreMap  = {};
(genreData?.genres || []).forEach(g => genreMap[g.id] = g.name);
console.log(`Géneros cargados: ${Object.keys(genreMap).length}`);

// Load catalog
const catalog = JSON.parse(readFileSync('public/contents_compact.json', 'utf-8'));
const movies  = (catalog.data || []).filter(m => m.type !== 'Show');
console.log(`Películas: ${movies.length}`);

// Load existing results (resume support)
let result = {};
try { result = JSON.parse(readFileSync(OUT, 'utf-8')); } catch {}
const pending = movies.filter(m => result[String(m.id)] === undefined);
console.log(`Por procesar: ${pending.length} (ya hechas: ${movies.length - pending.length})\n`);

let done = 0, failed = 0;
const t0 = Date.now();

for (let i = 0; i < pending.length; i += BATCH) {
  const batch = pending.slice(i, i + BATCH);

  await Promise.all(batch.map(async movie => {
    const mid   = String(movie.id);
    const title = encodeURIComponent(movie.title || '');
    const data  = await tmdbGet(`/search/movie?query=${title}&language=es-MX&page=1`);
    const hit   = data?.results?.[0];

    if (hit?.genre_ids?.length) {
      result[mid] = hit.genre_ids.map(id => ({ id, name: genreMap[id] || String(id) }));
      done++;
    } else {
      result[mid] = [];
      failed++;
    }
  }));

  const processed = Math.min(i + BATCH, pending.length);
  const pct     = Math.round(processed / pending.length * 100);
  const elapsed = (Date.now() - t0) / 1000;
  const eta     = Math.round((pending.length - processed) * (elapsed / processed));

  if (processed % 100 === 0 || processed === pending.length) {
    writeFileSync(OUT, JSON.stringify(result));
    console.log(`[${pct}%] ${processed}/${pending.length} — encontradas:${done} sin_resultado:${failed} — ETA ~${eta}s`);
  }

  if (i + BATCH < pending.length) await sleep(DELAY);
}

writeFileSync(OUT, JSON.stringify(result));
console.log(`\n¡Listo! ${done} encontradas, ${failed} sin resultado. Guardado en ${OUT}`);
