import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import MovieGrid from './components/MovieGrid';
import MovieModal from './components/MovieModal';
import SeriesModal from './components/SeriesModal';
import ActorModal from './components/ActorModal';
import AuthModal from './components/AuthModal';
import ProfileSelector from './components/ProfileSelector';
import SettingsModal from './components/SettingsModal';
import { rankedSearchMovies } from './utils/searchMovies';
import { resolvePlaybackSources } from './utils/playbackSources';
import { useDebounce } from './utils/useDebounce';
import { useAuth } from './contexts/AuthContext';
import { useProfile } from './contexts/ProfileContext';
import { applyDisguise } from './utils/disguise';
import { useTrending } from './utils/useTrending';
import { getUpcoming } from './utils/tmdb';

function App() {
  const { user, authLoading } = useAuth();
  const { activeProfile, watchlistIds, watchedIds, historyItems, markWatched, clearHistory } = useProfile();

  const [movies, setMovies] = useState([]);
  const [playbackSourcesById, setPlaybackSourcesById] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedContent, setSelectedContent] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState('Inicio'); // 'Inicio'|'Películas'|'Series'|'Mi Lista'
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('cinehub_dark') !== 'false');
  const [batchSize, setBatchSize] = useState(() => Number(localStorage.getItem('cinehub_batch')) || 60);
  const [showSettings, setShowSettings] = useState(false);
  const [upcoming, setUpcoming] = useState([]);
  const [selectedActor, setSelectedActor] = useState(null);

  // Panic mode: double Escape redirects to saved URL
  useEffect(() => {
    let lastEsc = 0;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        const now = Date.now();
        if (now - lastEsc < 500) {
          const url = localStorage.getItem('cinehub_panic_url') || 'https://www.google.com';
          window.location.replace(url);
        }
        lastEsc = now;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const trendingMovies = useTrending(movies);

  useEffect(() => {
    if (!movies.length) return;
    getUpcoming().then(results => {
      // match to catalog by title
      const byTitle = new Map(movies.map(m => [m.title?.toLowerCase().trim(), m]));
      const matched = results
        .map(r => byTitle.get((r.title || '').toLowerCase().trim()))
        .filter(Boolean);
      setUpcoming(matched);
    });
  }, [movies.length]);

  const handleSectionChange = useCallback((section) => {
    setActiveSection(section);
    setSearchQuery('');
  }, []);

  const handleBatchSize = useCallback((size) => {
    setBatchSize(size);
    localStorage.setItem('cinehub_batch', size);
  }, []);

  const handleClearHistory = useCallback(async () => {
    await clearHistory();
  }, [clearHistory]);

  const debouncedSearch = useDebounce(searchQuery, 300);

  useEffect(() => {
    document.body.classList.toggle('light', !darkMode);
    localStorage.setItem('cinehub_dark', darkMode);
  }, [darkMode]);

  // Apply disguise on app mount
  useEffect(() => {
    applyDisguise(localStorage.getItem('cinehub_disguise') || 'cinehub');
  }, []);

  useEffect(() => {
    if (!movies.length || isLoading) return;
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get('id');
    if (idParam && !selectedContent) {
      const found = movies.find(m => String(m.id) === idParam);
      if (found) handleOpenModal(found);
    }
  }, [movies, isLoading]);

  useEffect(() => {
    Promise.all([
      fetch('/contents_compact.json').then((r) => r.json()),
      fetch('/playback_sources.json').then((r) => r.json()),
      fetch('/series_genres.json').then((r) => r.json()).catch(() => ({})),
      fetch('/movie_genres.json').then((r) => r.json()).catch(() => ({})),
      fetch('/movie_detail.json').then((r) => r.json()).catch(() => ({})),
    ]).then(([contentsData, sourcesData, seriesGenresData, movieGenresData, movieDetailData]) => {
      const raw = contentsData.data || [];
      const list = raw.map((m) => {
        let item = m;
        if (item.type === 'Show') {
          const genres = seriesGenresData[String(item.id)];
          if (genres) item = { ...item, genres };
        } else {
          const genres = movieGenresData[String(item.id)];
          if (genres) item = { ...item, genres };
          const md = movieDetailData[String(item.id)];
          if (md) item = {
            ...item,
            people:      md.people      ?? item.people,
            trailer:     md.trailer     ?? item.trailer,
            tmdbId:      md.tmdbId      ?? item.tmdbId,
            certification: md.certification ?? item.certification,
            overview:    md.overview    || item.overview,
          };
        }
        return item;
      });
      setMovies(list);
      setPlaybackSourcesById(sourcesData);
      setIsLoading(false);
    });
  }, []);

  const trimmedSearch = debouncedSearch.trim();

  const GENRE_ROWS = [
    { label: 'Acción',          terms: ['action', 'acción', 'adventure', 'action & adventure'] },
    { label: 'Drama',           terms: ['drama'] },
    { label: 'Comedia',         terms: ['comedy', 'comedia'] },
    { label: 'Terror',          terms: ['horror', 'terror'] },
    { label: 'Thriller',        terms: ['thriller', 'suspenso', 'mystery'] },
    { label: 'Ciencia Ficción', terms: ['sci-fi', 'science fiction', 'ciencia ficción', 'sci-fi & fantasy'] },
    { label: 'Animación',       terms: ['animation', 'animación', 'anime'] },
    { label: 'Romance',         terms: ['romance'] },
    { label: 'Crimen',          terms: ['crime', 'crimen'] },
    { label: 'Fantasía',        terms: ['fantasy', 'fantasía', 'sci-fi & fantasy'] },
    { label: 'Familia',         terms: ['family', 'familia'] },
    { label: 'Documental',      terms: ['documentary', 'documental'] },
    { label: 'Historia',        terms: ['history', 'historia'] },
    { label: 'Música',          terms: ['music', 'música'] },
    { label: 'Western',         terms: ['western'] },
    { label: 'Guerra',          terms: ['war', 'guerra'] },
  ];

  // Section-filtered base list
  const sectionMovies = useMemo(() => {
    if (activeSection === 'Películas') return movies.filter((m) => m.type !== 'Show');
    if (activeSection === 'Series')   return movies.filter((m) => m.type === 'Show');
    if (activeSection === 'Mi Lista') return movies.filter((m) => watchlistIds.has(Number(m.id)));
    if (activeSection === 'Historial') {
      const ids = new Set(historyItems.map(r => Number(r.content_id)));
      return movies.filter(m => ids.has(Number(m.id)));
    }
    return movies;
  }, [movies, activeSection, watchlistIds, historyItems]);

  // Per-genre rows from sectionMovies
  const genreRows = useMemo(() => {
    return GENRE_ROWS.map(({ label, terms }) => ({
      label,
      items: sectionMovies.filter(m =>
        (m.genres || []).some(g => {
          const name = g.name?.toLowerCase() || '';
          return terms.some(t => name.includes(t));
        })
      ),
    })).filter(r => r.items.length > 0);
  }, [sectionMovies]);

  // Search results from sectionMovies
  const filteredMovies = useMemo(() => {
    if (!trimmedSearch) return sectionMovies;
    return rankedSearchMovies(sectionMovies, debouncedSearch);
  }, [sectionMovies, debouncedSearch]);

  // Hero: #1 trending with backdrop, else first sectionMovie with backdrop
  const heroMovie = useMemo(() => {
    const hasBackdrop = (m) => {
      const b = m?.artwork?.backdrop;
      return [b?.large, b?.medium, b?.small].some(u => typeof u === 'string' && u.trim().length > 0);
    };
    return trendingMovies.find(hasBackdrop) || sectionMovies.find(hasBackdrop) || sectionMovies[0] || null;
  }, [trendingMovies, sectionMovies]);

  const handleOpenModal = useCallback((item) => {
    window.history.replaceState({}, '', `?id=${item.id}`);
    if (item.type === 'Show') {
      setSelectedContent({ type: 'series', data: item });
    } else {
      const detail = { ...item };
      detail.playbackSources = resolvePlaybackSources(playbackSourcesById, detail, movies);
      setSelectedContent({ type: 'movie', data: detail });
    }
  }, [playbackSourcesById, movies]);

  const handleCloseModal = useCallback(() => {
    window.history.replaceState({}, '', window.location.pathname);
    setSelectedContent(null);
  }, []);

  const handleSorprendeme = useCallback(() => {
    if (!sectionMovies.length) return;
    const pick = sectionMovies[Math.floor(Math.random() * sectionMovies.length)];
    handleOpenModal(pick);
  }, [sectionMovies, handleOpenModal]);

  // Auth gate: show spinner while Supabase resolves session
  if (authLoading) {
    return <div className="skeleton-hero" style={{ height: '100vh' }} />;
  }

  // Not logged in → show auth modal
  if (!user) return <AuthModal />;

  // Logged in but no profile selected → show profile selector
  if (!activeProfile) return <ProfileSelector />;

  if (isLoading) {
    return (
      <div className="app-container">
        <Navbar searchQuery={searchQuery} onSearchChange={setSearchQuery} activeSection={activeSection} onSectionChange={handleSectionChange} onOpenSettings={() => setShowSettings(true)} />
        <div className="skeleton-hero" />
        <div className="container" style={{ paddingTop: '2rem' }}>
          <div className="skeleton-section-title" />
          <div className="skeleton-grid">
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className="skeleton-card"
                style={{ animationDelay: `${(i % 6) * 0.1}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <Navbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        onOpenSettings={() => setShowSettings(true)}
      />

      <main style={{ paddingTop: '68px' }}>
        {/* Hero on Inicio and Películas and Series (not search/list/historial) */}
        {!trimmedSearch && ['Inicio', 'Películas', 'Series'].includes(activeSection) && (
          <Hero movie={heroMovie} onOpenModal={handleOpenModal} onSorprendeme={handleSorprendeme} />
        )}

        <div style={{ paddingBottom: '50px' }}>
          {trimmedSearch ? (
            <>
              <MovieGrid
                title={`Resultados (${filteredMovies.length})`}
                movies={filteredMovies}
                onOpenModal={handleOpenModal}
                batchSize={batchSize}
                watchedIds={watchedIds}
                onMarkWatched={markWatched}
              />
              {filteredMovies.length === 0 && (
                <p className="search-empty" role="status">
                  No hay coincidencias para «{trimmedSearch}».
                </p>
              )}
            </>
          ) : activeSection === 'Mi Lista' ? (
            sectionMovies.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--fg-muted)' }}>
                <p style={{ fontSize: '1.1rem', marginBottom: '8px' }}>Tu lista está vacía</p>
                <p style={{ fontSize: '0.9rem' }}>Agrega películas y series con el botón + en cada título.</p>
              </div>
            ) : (
              <MovieGrid
                title={`Mi Lista (${sectionMovies.length})`}
                movies={sectionMovies}
                onOpenModal={handleOpenModal}
                batchSize={batchSize}
                watchedIds={watchedIds}
                onMarkWatched={markWatched}
              />
            )
          ) : activeSection === 'Historial' ? (
            sectionMovies.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--fg-muted)' }}>
                <p style={{ fontSize: '1.1rem', marginBottom: '8px' }}>Tu historial está vacío</p>
                <p style={{ fontSize: '0.9rem' }}>Los títulos que veas aparecerán aquí.</p>
              </div>
            ) : (
              <MovieGrid
                title={`Historial (${sectionMovies.length})`}
                movies={sectionMovies}
                onOpenModal={handleOpenModal}
                batchSize={batchSize}
                watchedIds={watchedIds}
                onMarkWatched={markWatched}
              />
            )
          ) : (
            /* Inicio / Películas / Series — genre rows */
            <>
              {activeSection === 'Inicio' && trendingMovies.length > 0 && (
                <MovieGrid title="🔥 Tendencias esta semana" movies={trendingMovies} onOpenModal={handleOpenModal} batchSize={20} watchedIds={watchedIds} onMarkWatched={markWatched} />
              )}
              {activeSection === 'Inicio' && upcoming.length > 0 && (
                <MovieGrid title="🎬 Próximos estrenos" movies={upcoming} onOpenModal={handleOpenModal} batchSize={10} watchedIds={watchedIds} onMarkWatched={markWatched} />
              )}
              {activeSection === 'Inicio' && (
                <MovieGrid title="Top 10 Hoy" movies={sectionMovies.slice(0, 10)} onOpenModal={handleOpenModal} top10 batchSize={10} watchedIds={watchedIds} onMarkWatched={markWatched} />
              )}
              {genreRows.map(({ label, items }) => (
                <MovieGrid
                  key={label}
                  title={label}
                  movies={items}
                  onOpenModal={handleOpenModal}
                  batchSize={batchSize}
                  watchedIds={watchedIds}
                  onMarkWatched={markWatched}
                />
              ))}
            </>
          )}
        </div>
      </main>

      {selectedContent?.type === 'movie' && (
        <MovieModal movie={selectedContent.data} onClose={handleCloseModal} allMovies={movies} onOpenSimilar={handleOpenModal} onActorClick={setSelectedActor} />
      )}
      {selectedContent?.type === 'series' && (
        <SeriesModal series={selectedContent.data} onClose={handleCloseModal} allMovies={movies} onOpenSimilar={handleOpenModal} onActorClick={setSelectedActor} />
      )}
      {selectedActor && (
        <ActorModal actor={selectedActor} allMovies={movies} onOpenMovie={handleOpenModal} onClose={() => setSelectedActor(null)} />
      )}

      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          darkMode={darkMode}
          onToggleDark={() => setDarkMode(v => !v)}
          batchSize={batchSize}
          onBatchSize={handleBatchSize}
          onClearHistory={handleClearHistory}
        />
      )}

      <footer
        style={{
          textAlign: 'center',
          padding: '36px 20px',
          color: 'var(--fg-muted)',
          fontSize: '0.82rem',
          borderTop: '1px solid var(--border)',
          fontFamily: "'Inter', system-ui, sans-serif",
          letterSpacing: '0.02em',
        }}
      >
        <p>{movies.length.toLocaleString('es')} títulos en catálogo · CineHub 2025</p>
      </footer>

    </div>
  );
}

export default App;
