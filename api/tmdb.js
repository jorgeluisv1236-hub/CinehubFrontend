export default async function handler(req, res) {
  const path = req.query.path || '';
  const token = process.env.VITE_TMDB_TOKEN;

  if (!token) {
    return res.status(500).json({ error: 'TMDB token not configured' });
  }

  const url = `https://api.themoviedb.org/3${path.startsWith('/') ? path : '/' + path}`;

  try {
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await r.json();
    res.setHeader('Cache-Control', 's-maxage=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(r.status).json(data);
  } catch (e) {
    return res.status(502).json({ error: 'TMDB unreachable', detail: e.message });
  }
}
