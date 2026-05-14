"""
Generates public/movie_genres.json  —  {movieId: [{id, name}, ...]}
1 request per movie (search only). Genre names resolved from the genre list.
~5721 movies × 0.26s ≈ 25 min. Supports resume.
"""
import json, time, sys, urllib.request, urllib.parse

TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJkYzcxOWE5MWVlYjMwNzhiYmE3NDRlZDY3MTdiYTM2YyIsIm5iZiI6MTc3ODc3NzkwMS40NzUwMDAxLCJzdWIiOiI2YTA1ZmYyZGZmYThmNjA0MmRlM2M1YWMiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.52dihADs-cdeEJmSCsRUOwUGIwMmkJugLX4VZ0J4mB8"
BASE = "https://api.themoviedb.org/3"
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Accept": "application/json"}
OUT = "public/movie_genres.json"

def tmdb_get(path):
    req = urllib.request.Request(BASE + path, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.loads(r.read())
    except Exception:
        return None

# 1. Fetch genre name map once
genre_map = {}
for lang in ["es-MX", "en-US"]:
    data = tmdb_get(f"/genre/movie/list?language={lang}")
    if data:
        for g in data.get("genres", []):
            if g["id"] not in genre_map:
                genre_map[g["id"]] = g["name"]
print(f"Genre map: {len(genre_map)} genres loaded")

# 2. Load catalog
with open("public/contents_compact.json", encoding="utf-8") as f:
    catalog = json.load(f)["data"]
movies = [m for m in catalog if m.get("type") != "Show"]
print(f"Movies to process: {len(movies)}")

# 3. Resume support
try:
    with open(OUT, encoding="utf-8") as f:
        result = json.load(f)
    print(f"Resuming — {len(result)} already done")
except FileNotFoundError:
    result = {}

done = 0
failed = 0

for i, movie in enumerate(movies):
    mid = str(movie["id"])
    if mid in result:
        continue

    title = movie.get("title", "")
    # Extract year from title like "Movie Title (2023)"
    year = None
    if title.endswith(")") and "(" in title:
        part = title[title.rfind("(")+1:-1]
        if part.isdigit() and len(part) == 4:
            year = part

    q = urllib.parse.quote(title)
    yr = f"&year={year}" if year else ""
    data = tmdb_get(f"/search/movie?query={q}{yr}&language=es-MX&page=1")
    hit = (data or {}).get("results", [None])[0] if data else None

    if hit and hit.get("genre_ids"):
        genres = [{"id": gid, "name": genre_map.get(gid, str(gid))} for gid in hit["genre_ids"]]
        result[mid] = genres
        done += 1
    else:
        result[mid] = []
        failed += 1

    # Save every 200 movies
    if (i + 1) % 200 == 0:
        with open(OUT, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False)
        pct = round((i + 1) / len(movies) * 100, 1)
        eta = round((len(movies) - i - 1) * 0.26 / 60, 1)
        print(f"  [{pct}%] {i+1}/{len(movies)} — matched:{done} not_found:{failed} — ETA ~{eta}min", flush=True)

    time.sleep(0.26)

# Final save
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(result, f, ensure_ascii=False)

print(f"\nDone! {done} matched, {failed} not found. Saved to {OUT}")
