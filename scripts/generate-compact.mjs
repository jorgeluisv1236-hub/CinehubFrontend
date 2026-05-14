import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const publicDir = 'public';

console.log('🚀 Generating compact JSON files...');

// 1. Process contents.json → contents_compact.json
console.log('📝 Processing contents.json...');
const contentsRaw = readFileSync(join(publicDir, 'contents.json'), 'utf8');
const contentsData = JSON.parse(contentsRaw);

const compactContents = {
  data: (contentsData.data || []).map(item => ({
    id: item.id,
    title: item.title,
    type: item.type,
    overview: item.overview,
    artwork: item.artwork,
    languages: item.languages,
    releaseDate: item.releaseDate,
    runtime: item.runtime,
    certification: item.certification
  }))
};

writeFileSync(
  join(publicDir, 'contents_compact.json'),
  JSON.stringify(compactContents),
  'utf8'
);

console.log(`✅ Created contents_compact.json (${compactContents.data.length} items)`);

// 2. Process series_detail.json → series_genres.json
console.log('📝 Processing series_detail.json...');
const seriesDetailRaw = readFileSync(join(publicDir, 'series_detail.json'), 'utf8');
const seriesDetailData = JSON.parse(seriesDetailRaw);

const seriesGenres = {};
for (const [seriesId, seriesData] of Object.entries(seriesDetailData)) {
  if (seriesData && seriesData.genres) {
    seriesGenres[seriesId] = seriesData.genres;
  }
}

writeFileSync(
  join(publicDir, 'series_genres.json'),
  JSON.stringify(seriesGenres),
  'utf8'
);

console.log(`✅ Created series_genres.json (${Object.keys(seriesGenres).length} series with genres)`);

// Display file sizes
const files = [
  'contents.json',
  'contents_compact.json',
  'series_detail.json',
  'series_genres.json'
];

console.log('\n📊 File sizes:');
files.forEach(filename => {
  try {
    const stats = readFileSync(join(publicDir, filename));
    const sizeMB = (stats.length / (1024 * 1024)).toFixed(2);
    console.log(`   ${filename}: ${sizeMB} MB`);
  } catch (e) {
    console.log(`   ${filename}: not found`);
  }
});

console.log('\n✨ Compact files generated successfully!');