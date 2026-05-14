import React, { useState, useEffect } from 'react';
import { X, Check, Trash2, ShieldAlert, ExternalLink } from 'lucide-react';

const PANIC_PRESETS = [
  { label: 'Google', url: 'https://www.google.com' },
  { label: 'Google Classroom', url: 'https://classroom.google.com' },
  { label: 'Google Meet', url: 'https://meet.google.com' },
  { label: 'Outlook', url: 'https://outlook.live.com' },
  { label: 'Wikipedia', url: 'https://www.wikipedia.org' },
  { label: 'Duolingo', url: 'https://www.duolingo.com' },
];
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../contexts/ProfileContext';
import { DISGUISES, applyDisguise } from '../utils/disguise';
import './SettingsModal.css';

const SettingsModal = ({
  onClose,
  darkMode,
  onToggleDark,
  batchSize,
  onBatchSize,
  onClearHistory
}) => {
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const [selectedDisguise, setSelectedDisguise] = useState(() =>
    localStorage.getItem('cinehub_disguise') || 'cinehub'
  );
  const [confirmClear, setConfirmClear] = useState(false);
  const [panicUrl, setPanicUrl] = useState(() => localStorage.getItem('cinehub_panic_url') || 'https://www.google.com');
  const [panicInput, setPanicInput] = useState(() => localStorage.getItem('cinehub_panic_url') || 'https://www.google.com');
  const [panicSaved, setPanicSaved] = useState(false);

  const handleSavePanic = () => {
    const url = panicInput.trim().startsWith('http') ? panicInput.trim() : 'https://' + panicInput.trim();
    setPanicUrl(url);
    setPanicInput(url);
    localStorage.setItem('cinehub_panic_url', url);
    setPanicSaved(true);
    setTimeout(() => setPanicSaved(false), 2000);
  };

  // Apply disguise on mount
  useEffect(() => {
    applyDisguise(selectedDisguise);
  }, []);

  const handleDisguiseChange = (key) => {
    setSelectedDisguise(key);
    applyDisguise(key);
  };

  const handleClearConfirm = async () => {
    if (!activeProfile) return;

    try {
      // Clear from Supabase
      await supabase
        .from('watch_history')
        .delete()
        .eq('profile_id', activeProfile.id);

      // Call the parent callback
      onClearHistory?.();

      // Reset UI state
      setConfirmClear(false);
    } catch (error) {
      console.error('Error clearing history:', error);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        <button className="settings-modal-close" onClick={onClose}>
          <X size={20} />
        </button>

        <h2 className="settings-modal-title">Configuración</h2>

        {/* Section 1: Camuflaje */}
        <div className="settings-section">
          <h3 className="settings-section-title">Camuflaje</h3>
          <p className="settings-section-description">
            Cambia la apariencia de la pestaña para mayor discreción
          </p>
          <div className="settings-option-grid">
            {DISGUISES.map((disguise) => (
              <button
                key={disguise.key}
                className={`settings-option-card ${selectedDisguise === disguise.key ? 'active' : ''}`}
                onClick={() => handleDisguiseChange(disguise.key)}
              >
                <div className="disguise-icon" dangerouslySetInnerHTML={{ __html: disguise.icon }} />
                <span className="disguise-label">{disguise.label}</span>
                {selectedDisguise === disguise.key && (
                  <Check size={16} className="settings-option-check" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Section 2: Tema */}
        <div className="settings-section">
          <h3 className="settings-section-title">Tema</h3>
          <div className="settings-option-grid settings-theme-grid">
            <button
              className={`settings-option-card settings-theme-card ${darkMode ? 'active' : ''}`}
              onClick={() => !darkMode && onToggleDark()}
            >
              <div className="theme-preview theme-dark"></div>
              <span>Oscuro</span>
              {darkMode && <Check size={16} className="settings-option-check" />}
            </button>
            <button
              className={`settings-option-card settings-theme-card ${!darkMode ? 'active' : ''}`}
              onClick={() => darkMode && onToggleDark()}
            >
              <div className="theme-preview theme-light"></div>
              <span>Claro</span>
              {!darkMode && <Check size={16} className="settings-option-check" />}
            </button>
          </div>
        </div>

        {/* Section 3: Carga */}
        <div className="settings-section">
          <h3 className="settings-section-title">Carga</h3>
          <p className="settings-section-description">
            Cantidad de títulos que se cargan por sección
          </p>
          <div className="settings-batch-controls">
            {[20, 40, 60, 100].map((size) => (
              <button
                key={size}
                className={`settings-batch-option ${batchSize === size ? 'active' : ''}`}
                onClick={() => onBatchSize(size)}
              >
                {size}
                {batchSize === size && <Check size={14} />}
              </button>
            ))}
          </div>
        </div>

        {/* Section 4: Historial */}
        <div className="settings-section">
          <h3 className="settings-section-title">Historial</h3>
          <p className="settings-section-description">
            Administra tu historial de visualización
          </p>
          {!confirmClear ? (
            <button
              className="settings-danger-button"
              onClick={() => setConfirmClear(true)}
            >
              <Trash2 size={16} />
              Limpiar historial
            </button>
          ) : (
            <div className="settings-confirm-group">
              <p className="settings-confirm-text">
                ¿Seguro? Esto no se puede deshacer
              </p>
              <div className="settings-confirm-buttons">
                <button
                  className="settings-confirm-cancel"
                  onClick={() => setConfirmClear(false)}
                >
                  Cancelar
                </button>
                <button
                  className="settings-confirm-delete"
                  onClick={handleClearConfirm}
                >
                  Confirmar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Section 5: Modo Pánico */}
        <div className="settings-section">
          <h3 className="settings-section-title">
            <ShieldAlert size={16} style={{ display: 'inline', marginRight: 6, color: 'var(--primary)' }} />
            Modo Pánico
          </h3>
          <div className="panic-description">
            <p>Presiona <kbd>Esc</kbd> dos veces rápido para salir de la página al instante y abrir otro sitio.</p>
            <p>Útil si alguien se acerca inesperadamente. Elige a qué página quieres ir:</p>
          </div>
          <div className="panic-presets">
            {PANIC_PRESETS.map(p => (
              <button
                key={p.url}
                className={`panic-preset-btn${panicUrl === p.url ? ' active' : ''}`}
                onClick={() => { setPanicInput(p.url); setPanicUrl(p.url); localStorage.setItem('cinehub_panic_url', p.url); }}
              >
                {panicUrl === p.url && <Check size={12} />}
                {p.label}
              </button>
            ))}
          </div>
          <div className="panic-custom">
            <input
              className="panic-input"
              type="url"
              placeholder="O escribe un link personalizado..."
              value={panicInput}
              onChange={e => setPanicInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSavePanic()}
            />
            <button className="panic-save-btn" onClick={handleSavePanic}>
              {panicSaved ? <><Check size={14} /> Guardado</> : 'Guardar'}
            </button>
          </div>
          <div className="panic-active-url">
            <ExternalLink size={12} />
            Activo: <strong>{panicUrl}</strong>
          </div>
        </div>

        {/* Section 6: Sesión */}
        <div className="settings-section">
          <h3 className="settings-section-title">Sesión</h3>
          <div className="settings-user-info">
            <p className="settings-user-email">{user?.email}</p>
            <button className="settings-signout-button" onClick={handleSignOut}>
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;