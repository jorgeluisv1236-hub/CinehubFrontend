const https = require('https');
const fs = require('fs');
const crypto = require('crypto');

const KEY = crypto.createHash('sha256').update('Dx5VYERoLOVevR9C').digest('hex').substring(0, 32);
const IV = crypto.createHash('sha256').update('Dx5VYERoLOVevR9C').digest('hex').substring(0, 16);

// ========== HELPERS ==========

async function getJson(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await new Promise((resolve, reject) => {
        const req = https.get(url, { timeout: 20000 }, (res) => {
          let d = '';
          if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
          res.on('data', c => d += c);
          res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
      });
    } catch (e) {
      if (attempt === 3) throw e;
      await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
}

function decrypt(encrypted) {
  const decipher = crypto.createDecipheriv('aes-256-cbc', KEY, IV);
  let d = decipher.update(encrypted, 'base64', 'utf8');
  d += decipher.final('utf8');
  return JSON.parse(d);
}

const PROVIDER_MAP = {
  'VidHide':     { key: 'vidhide',     name: 'VidHide',     url: (id) => `https://vidhidefast.com/embed/${id}` },
  'LuluStream':  { key: 'lulustream',  name: 'LuluStream',  url: (id) => `https://lulustream.com/embed/${id}` },
  'StreamWish':  { key: 'streamwish',  name: 'StreamWish',  url: (id) => `https://streamwish.to/e/${id}` },
  'Doodstream':  { key: 'doodstream',  name: 'Doodstream',  url: (id) => `https://dood.to/e/${id}` },
  'Filemoon':    { key: 'filemoon',    name: 'Filemoon',    url: (id) => `https://filemoon.sx/e/${id}` },
};

function buildEmbed(source) {
  const p = PROVIDER_MAP[source.hostName];
  const fid = source.url.split('/').pop();
  return p
    ? { key: p.key, name: p.name, embedUrl: p.url(fid) }
    : { key: source.hostName.toLowerCase().replace(/[^a-z0-9]/g, ''), name: source.hostName, embedUrl: source.url };
}

// ========== STAGE 1: SERIES CATALOG ==========

const CATALOG_FILE = 'series_catalog.json';
const CK_FILE = 'series_checkpoint.json';

async function stage1_catalog() {
  if (fs.existsSync(CATALOG_FILE)) {
    const data = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'));
    console.log(`Stage 1 (catalog): already done — ${data.length} series`);
    return data;
  }

  let all = [];
  let page = 1;
  while (true) {
    const url = `https://api.playhubmax.com/api/XX/en/contents?content_type=Show&page=${page}&per_page=50`;
    const resp = await getJson(url);
    if (!resp.data || resp.data.length === 0) break;
    all.push(...resp.data);
    process.stdout.write(`\rPage ${page}: ${all.length} series`);
    page++;
    if (resp.data.length < 15) break;
    await new Promise(r => setTimeout(r, 100));
  }
  console.log(`\nStage 1 done — ${all.length} series`);
  fs.writeFileSync(CATALOG_FILE, JSON.stringify(all, null, 2));
  return all;
}

// ========== STAGE 2: SERIES DETAILS (seasons) ==========

async function stage2_details(series) {
  const outFile = 'series_detail.json';
  let results = {};
  let resumeIdx = 0;

  if (fs.existsSync(outFile)) {
    results = JSON.parse(fs.readFileSync(outFile, 'utf8'));
    resumeIdx = Object.keys(results).length;
    console.log(`Stage 2 (detail): resuming at index ${resumeIdx}/${series.length}`);
  }

  for (let i = resumeIdx; i < series.length; i++) {
    const s = series[i];
    const uuid = s.uuid || s.id;
    try {
      const url = `https://api.playhubmax.com/api/en/contents/${uuid}`;
      const detail = await getJson(url);
      results[String(s.id)] = {
        id: s.id, uuid: detail.uuid, title: detail.title, overview: detail.overview,
        type: detail.type, artwork: detail.artwork,
        languages: detail.languages, runtime: detail.runtime, certification: detail.certification,
        genres: detail.genres, people: detail.people,
        seasonCount: detail.seasonCount, episodeCount: detail.episodeCount,
        seasons: (detail.seasons || []).map(sn => ({ id: sn.id, number: sn.seasonNumber })),
      };
    } catch (e) {
      results[String(s.id)] = {
        id: s.id, uuid, title: s.title, overview: s.overview,
        artwork: s.artwork, languages: s.languages || [],
        seasons: [], seasonCount: 0, episodeCount: 0,
      };
    }

    if ((i + 1) % 50 === 0) {
      fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
      process.stdout.write(`\rDetail ${i + 1}/${series.length}`);
    }
    await new Promise(r => setTimeout(r, 200));
  }

  fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
  console.log(`\nStage 2 done — ${Object.keys(results).length} series details`);
  return results;
}

// ========== STAGE 3: EPISODES per season ==========

async function stage3_episodes(details) {
  const outFile = 'series_episodes.json';
  let episodes = {};
  let totalSeasons = 0;
  let processedSeasons = 0;

  if (fs.existsSync(outFile)) {
    episodes = JSON.parse(fs.readFileSync(outFile, 'utf8'));
    processedSeasons = Object.keys(episodes).length;
  }

  // Count total seasons
  for (const sid of Object.keys(details)) {
    const d = details[sid];
    if (d.seasons) totalSeasons += d.seasons.length;
  }
  console.log(`Stage 3 (episodes): ${processedSeasons}/${totalSeasons} seasons processed`);

  let idx = 0;
  for (const sid of Object.keys(details)) {
    const d = details[sid];
    if (!d.seasons) continue;
    for (const sn of d.seasons) {
      const epKey = `${sid}_${sn.id}`;
      if (episodes[epKey]) { idx++; continue; }

      try {
        let allEps = [];
        let page = 1;
        while (true) {
          const url = `https://api.playhubmax.com/api/en/episodes?season_id=${sn.id}&page=${page}`;
          const resp = await getJson(url);
          if (!resp.data || resp.data.length === 0) break;
          allEps.push(...resp.data.map(ep => ({
            id: ep.id, uuid: ep.uuid, number: ep.episodeNumber,
            name: ep.name, overview: ep.overview,
            languages: ep.languages, runtime: ep.runtime,
            artwork: ep.artwork, seasonNumber: ep.seasonNumber,
          })));
          if (!resp.hasMore) break;
          page++;
          await new Promise(r => setTimeout(r, 100));
        }
        episodes[epKey] = allEps;
        idx++;
      } catch (e) {
        episodes[epKey] = [];
        idx++;
      }

      if (idx % 50 === 0) {
        fs.writeFileSync(outFile, JSON.stringify(episodes, null, 2));
        process.stdout.write(`\rEpisodes ${idx}/${totalSeasons} seasons`);
      }
      await new Promise(r => setTimeout(r, 100));
    }
  }

  fs.writeFileSync(outFile, JSON.stringify(episodes, null, 2));
  console.log(`\nStage 3 done — ${idx} seasons, ${Object.values(episodes).flat().length} total episodes`);
  return episodes;
}

// ========== STAGE 4: SOURCES per episode ==========

async function stage4_sources(episodesMap) {
  const outFile = 'series_sources.json';
  let sources = {};

  if (fs.existsSync(outFile)) {
    sources = JSON.parse(fs.readFileSync(outFile, 'utf8'));
    console.log(`Stage 4 (sources): resuming from ${Object.keys(sources).length} episodes`);
  }

  const allEps = [];
  for (const [epKey, eps] of Object.entries(episodesMap)) {
    for (const ep of eps) {
      allEps.push({ epKey, ...ep });
    }
  }

  let processed = 0;
  const totalEpisodes = allEps.length;
  console.log(`Stage 4: ${totalEpisodes} total episodes to process`);

  for (const ep of allEps) {
    const srcKey = `${ep.epKey}_${ep.id}`;
    if (sources[srcKey]) { processed++; continue; }

    try {
      const url = `https://api.playhubmax.com/api/episode/${ep.uuid}/sources`;
      const resp = await getJson(url);
      if (resp && resp.data) {
        const decrypted = decrypt(resp.data);
        sources[srcKey] = decrypted.map(buildEmbed);
      } else {
        sources[srcKey] = [];
      }
    } catch (e) {
      sources[srcKey] = [
