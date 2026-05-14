const https = require('https');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const AES_KEY = crypto.createHash('sha256').update('Dx5VYERoLOVevR9C').digest('hex').substring(0, 32);
const AES_IV = crypto.createHash('sha256').update('Dx5VYERoLOVevR9C').digest('hex').substring(0, 16);
const OUTDIR = path.join(__dirname, 'public');

async function getJson(url, retries=3) {
  for(let n=1; n<=retries; n++) {
    try {
      const res = await new Promise((ok, fail)=>{
        const req=https.get(url,{timeout:18000},(r)=>{
          let buf='';
          if(r.statusCode!==200) return fail(new Error(`HTTP ${r.statusCode}`));
          r.on('data',c=>buf+=c); r.on('end',()=>{try{ok(JSON.parse(buf))}catch(e){fail(e)}});
        });
        req.on('error',fail); req.on('timeout',()=>{req.destroy();fail(new Error('timeout'))});
      });
      return res;
    } catch(e){ if(n===retries)throw e; await new Promise(r=>setTimeout(r,1500*n)); }
  }
}

function decrypt(encryptedBase64) {
  const dec = crypto.createDecipheriv('aes-256-cbc', AES_KEY, AES_IV);
  let plain = dec.update(encryptedBase64,'base64','utf8'); plain+=dec.final('utf8');
  return JSON.parse(plain);
}

const PROVIDERS={
  'VidHide':{key:'vidhide',name:'VidHide',url:i=>`https://vidhidefast.com/embed/${i}`},
  'LuluStream':{key:'lulustream',name:'LuluStream',url:i=>`https://lulustream.com/embed/${i}`},
  'StreamWish':{key:'streamwish',name:'StreamWish',url:i=>`https://streamwish.to/e/${i}`},
  'Doodstream':{key:'doodstream',name:'Doodstream',url:i=>`https://dood.to/e/${i}`},
  'Filemoon':{key:'filemoon',name:'Filemoon',url:i=>`https://filemoon.sx/e/${i}`}
};
function emb(src){
  const p=PROVIDERS[src.hostName]; const fid=src.url.split('/').pop();
  return p?{key:p.key,name:p.name,embedUrl:p.url(fid)}:{key:src.hostName.toLowerCase().replace(/[^a-z0-9]/g,''),name:src.hostName,embedUrl:src.url};
}

/* STAGE 1 */
async function stage1(){
  const out=path.join(OUTDIR,'series_catalog.json');
  if(fs.existsSync(out)) return JSON.parse(fs.readFileSync(out,'utf8'));
  let list=[],p=1;
  while(true){
    const j=await getJson(`https://api.playhubmax.com/api/XX/en/contents?content_type=Show&page=${p}&per_page=50`);
    if(!j.data||!j.data.length)break;
    list.push(...j.data); p++; process.stdout.write(`\rS1: ${list.length} series`);
    if(j.data.length<15)break; await new Promise(r=>setTimeout(r,80));
  }
  console.log(`\nS1 complete: ${list.length} series`);
  fs.writeFileSync(out,JSON.stringify(list,null,2));
  return list;
}

/* STAGE 2 - concurrent */
async function stage2(cat){
  const out=path.join(OUTDIR,'series_detail.json');
  let det=fs.existsSync(out)?JSON.parse(fs.readFileSync(out,'utf8')):{}; let cur=Object.keys(det).length;
  const CONCUR=3;
  for(let i=cur;i<cat.length;i+=CONCUR){
    const batch=cat.slice(i,Math.min(i+CONCUR,cat.length));
    await Promise.allSettled(batch.map(async(s)=>{
      const uuid=s.uuid||s.id;
      try{
        const dd=await getJson(`https://api.playhubmax.com/api/en/contents/${uuid}`);
        det[s.id]={id:s.id,uuid:dd.uuid,title:dd.title,overview:dd.overview,artwork:dd.artwork,languages:dd.languages,runtime:dd.runtime,certification:dd.certification,genres:dd.genres,people:dd.people,seasonCount:dd.seasonCount,episodeCount:dd.episodeCount,seasons:(dd.seasons||[]).map(x=>({id:x.id,number:x.seasonNumber}))};
      }catch(e){
        det[s.id]={id:s.id,uuid,title:s.title,overview:s.overview,artwork:s.artwork,languages:s.languages||[],seasons:[],seasonCount:0,episodeCount:0};
      }
    }));
    if((i+CONCUR)%100<=CONCUR||i+CONCUR>=cat.length){fs.writeFileSync(out,JSON.stringify(det));process.stdout.write(`\rS2: ${Math.min(i+CONCUR,cat.length)}/${cat.length}`);}
    await new Promise(r=>setTimeout(r,50));
  }
  fs.writeFileSync(out,JSON.stringify(det));
  console.log(`\nS2 complete: ${Object.keys(det).length} series details`);
  return det;
}

/* STAGE 3 - concurrent */
async function stage3(dets){
  const out=path.join(OUTDIR,'series_episodes.json');
  let eps = fs.existsSync(out)?JSON.parse(fs.readFileSync(out,'utf8')):{};
  let totalSeasons=0; for(const sid of Object.keys(dets)) if(dets[sid].seasons) totalSeasons+=dets[sid].seasons.length;
  let idx=0;
  const CONCUR=3;
  // Build list of season keys to process
  let seasonList=[]; for(const sid of Object.keys(dets)){const d=dets[sid];if(!d.seasons)continue;for(const sn of d.seasons)seasonList.push({sid,seasonId:sn.id});}
  for(let i=0;i<seasonList.length;i+=CONCUR){
    const batch=seasonList.slice(i,Math.min(i+CONCUR,seasonList.length));
    await Promise.allSettled(batch.map(async({sid,seasonId})=>{
      const k=`${sid}_${seasonId}`;
      if(eps[k]) return;
      let buf=[]; let pg=1;
      while(true){
        const ee=await getJson(`https://api.playhubmax.com/api/en/episodes?season_id=${seasonId}&page=${pg}`);
        if(!ee.data||!ee.data.length)break;
        buf.push(...ee.data.map(x=>({id:x.id,uuid:x.uuid,number:x.episodeNumber,name:x.name,overview:x.overview,languages:x.languages,runtime:x.runtime,artwork:x.artwork,sn:x.seasonNumber})));
        if(!ee.hasMore)break; pg++; await new Promise(r=>setTimeout(r,60));
      }
      eps[k]=buf;
    }));
    idx+=batch.length;
    if(idx%50<CONCUR||idx>=seasonList.length){fs.writeFileSync(out,JSON.stringify(eps));process.stdout.write(`\rS3: ${idx}/${totalSeasons}`);}
    await new Promise(r=>setTimeout(r,50));
  }
  fs.writeFileSync(out,JSON.stringify(eps));
  console.log(`\nS3 complete: ${Object.values(eps).flat().length} episodes`);
  return eps;
}

/* STAGE 4 - concurrent */
async function stage4(episodeData){
  const out=path.join(OUTDIR,'series_sources.json');
  let src = fs.existsSync(out)?JSON.parse(fs.readFileSync(out,'utf8')):{};
  let flat=[]; for(const[ek,eps]of Object.entries(episodeData)) for(const e of eps) flat.push({ek,...e});
  const CONCUR=5;
  let done=0;
  for(let i=0;i<flat.length;i+=CONCUR){
    const batch=flat.slice(i,Math.min(i+CONCUR,flat.length));
    await Promise.allSettled(batch.map(async(e)=>{
      const sk=`${e.ek}_${e.id}`;
      if(src[sk]) return;
      try{
        const rsp=await getJson(`https://api.playhubmax.com/api/episode/${e.uuid}/sources`);
        src[sk]=(rsp&&rsp.data)?decrypt(rsp.data).map(emb):[];
      }catch(e2){ src[sk]=[]; }
    }));
    done+=batch.length;
    if(done%500<CONCUR||done>=flat.length){fs.writeFileSync(out,JSON.stringify(src));process.stdout.write(`\rS4: ${done}/${flat.length}`);}
  }
  fs.writeFileSync(out,JSON.stringify(src));
  console.log(`\nS4 complete: ${Object.keys(src).length} episodes with sources`);
  return src;
}

async function main(){
  console.time('total');
  const cat=await stage1();
  const det=await stage2(cat);
  const eps=await stage3(det);
  const src=await stage4(eps);
  console.timeEnd('total');
  console.log(`✅ Finished: series=${cat.length} episodes=${Object.values(eps).flat().length} sources=${Object.keys(src).length}`);
}
main().catch(console.error);


