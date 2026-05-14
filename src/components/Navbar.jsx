import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, LogOut, Users, Search, Settings } from 'lucide-react';
import BrandLogo from './BrandLogo';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../contexts/ProfileContext';
import './Navbar.css';

const NAV_LINKS = ['Inicio', 'Películas', 'Series', 'Historial', 'Mi Lista'];

const Navbar = ({ searchQuery = '', onSearchChange, activeSection = 'Inicio', onSectionChange, onOpenSettings }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [scrolled, setScrolled] = useState(false);
  const menuRef = useRef(null);
  const { signOut } = useAuth();
  const { activeProfile, selectProfile } = useProfile();

  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    onSearchChange?.(localSearch);
  };

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setLocalSearch(val);
    onSearchChange?.(val);
  };

  const avatarColor = activeProfile?.avatar_color || '#e50914';
  const initials = activeProfile?.name?.slice(0, 2).toUpperCase() || '?';

  return (
    <nav className={`navbar${scrolled ? ' navbar--scrolled' : ''}`}>
      <div className="navbar-container container">
        {/* Logo */}
        <a href="/" className="navbar-logo" aria-label="CineHub — inicio" onClick={(e) => e.preventDefault()}>
          <BrandLogo />
        </a>

        {/* Nav links */}
        <div className="navbar-links">
          {NAV_LINKS.map((link) => (
            <button
              key={link}
              className={`navbar-link${activeSection === link ? ' active' : ''}`}
              onClick={() => onSectionChange?.(link)}
            >
              {link}
            </button>
          ))}
        </div>

        {/* Right: search + settings + avatar */}
        <div className="navbar-right">
          <button className="navbar-theme-btn" onClick={onOpenSettings} title="Configuración">
            <Settings size={17} />
          </button>

          <form className="navbar-search" onSubmit={handleSearchSubmit}>
            <span className="navbar-search-icon" aria-hidden>
              <Search size={15} />
            </span>
            <input
              type="search"
              className="navbar-search-input"
              enterKeyHint="search"
              autoComplete="off"
              placeholder="Buscar..."
              aria-label="Buscar títulos"
              value={localSearch}
              onChange={handleSearchChange}
            />
          </form>

          {/* Profile */}
          <div className="profile-menu-wrapper" ref={menuRef}>
            <button
              className="profile-menu-trigger"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-label="Menú de perfil"
            >
              <div className="navbar-avatar" style={{ background: avatarColor }} aria-hidden>
                {initials}
              </div>
              <ChevronDown size={14} className={`profile-chevron ${menuOpen ? 'open' : ''}`} />
            </button>

            {menuOpen && (
              <div className="profile-dropdown">
                <div className="profile-dropdown-name">{activeProfile?.name}</div>
                <hr className="profile-dropdown-divider" />
                <button
                  className="profile-dropdown-item"
                  onClick={() => { selectProfile(null); setMenuOpen(false); }}
                >
                  <Users size={15} />
                  Cambiar perfil
                </button>
                <button
                  className="profile-dropdown-item profile-dropdown-signout"
                  onClick={signOut}
                >
                  <LogOut size={15} />
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
