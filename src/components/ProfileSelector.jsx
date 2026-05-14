import React, { useState } from 'react';
import { Plus, Trash2, Check } from 'lucide-react';
import { useProfile } from '../contexts/ProfileContext';
import { useAuth } from '../contexts/AuthContext';
import './ProfileSelector.css';

const AVATAR_COLORS = ['#ff9000', '#0080ff', '#e5a00d', '#03b03b', '#9b59b6'];
const MAX_PROFILES = 5;

function getInitials(name) {
  return name.trim().slice(0, 2).toUpperCase();
}

const ProfileSelector = () => {
  const { profiles, selectProfile, createProfile, deleteProfile, loadingProfiles } = useProfile();
  const { signOut } = useAuth();
  const [managing, setManaging] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(AVATAR_COLORS[0]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) { setError('Ingresa un nombre.'); return; }
    setCreating(true);
    const { error: err } = await createProfile(newName.trim(), newColor);
    setCreating(false);
    if (err) { setError(err.message); return; }
    setAdding(false);
    setNewName('');
    setNewColor(AVATAR_COLORS[0]);
    setError('');
  };

  if (loadingProfiles) {
    return (
      <div className="profile-selector-overlay">
        <div className="profile-selector-loading">Cargando perfiles…</div>
      </div>
    );
  }

  return (
    <div className="profile-selector-overlay">
      <div className="profile-selector">
        <h1 className="profile-selector-title">
          {managing ? 'Administrar perfiles' : '¿Quién está viendo?'}
        </h1>

        <div className="profile-grid">
          {profiles.map((profile) => (
            <div key={profile.id} className="profile-item">
              <button
                className={`profile-avatar-btn ${managing ? 'shake' : ''}`}
                onClick={() => !managing && selectProfile(profile)}
                aria-label={`Seleccionar perfil ${profile.name}`}
              >
                <div
                  className="profile-avatar"
                  style={{ background: profile.avatar_color || AVATAR_COLORS[0] }}
                >
                  {getInitials(profile.name)}
                </div>
                {managing && (
                  <button
                    className="profile-delete-btn"
                    onClick={(e) => { e.stopPropagation(); deleteProfile(profile.id); }}
                    aria-label={`Eliminar perfil ${profile.name}`}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </button>
              <span className="profile-name">{profile.name}</span>
            </div>
          ))}

          {profiles.length < MAX_PROFILES && !managing && (
            <div className="profile-item">
              <button
                className="profile-avatar-btn"
                onClick={() => setAdding(true)}
                aria-label="Agregar perfil"
              >
                <div className="profile-avatar profile-avatar-add">
                  <Plus size={34} />
                </div>
              </button>
              <span className="profile-name">Agregar</span>
            </div>
          )}
        </div>

        {adding && (
          <div className="profile-add-form">
            <h3>Nuevo perfil</h3>
            <form onSubmit={handleCreate}>
              <input
                type="text"
                placeholder="Nombre del perfil"
                value={newName}
                maxLength={20}
                onChange={(e) => { setNewName(e.target.value); setError(''); }}
                autoFocus
              />
              <div className="profile-color-picker">
                {AVATAR_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`color-swatch ${newColor === c ? 'selected' : ''}`}
                    style={{ background: c }}
                    onClick={() => setNewColor(c)}
                    aria-label={`Color ${c}`}
                  >
                    {newColor === c && <Check size={14} />}
                  </button>
                ))}
              </div>
              {error && <p className="profile-form-error">{error}</p>}
              <div className="profile-form-actions">
                <button type="submit" className="pf-btn-primary" disabled={creating}>
                  {creating ? 'Creando…' : 'Crear'}
                </button>
                <button
                  type="button"
                  className="pf-btn-secondary"
                  onClick={() => { setAdding(false); setError(''); }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="profile-actions">
          <button
            className="profile-manage-btn"
            onClick={() => { setManaging((v) => !v); setAdding(false); }}
          >
            {managing ? 'Listo' : 'Administrar perfiles'}
          </button>
          <button className="profile-signout-btn" onClick={signOut}>
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileSelector;
