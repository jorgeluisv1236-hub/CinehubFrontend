import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const ProfileContext = createContext(null);

export function ProfileProvider({ children }) {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [activeProfile, setActiveProfileState] = useState(null);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [watchlistIds, setWatchlistIds] = useState(new Set());
  const [watchedIds, setWatchedIds] = useState(new Set());
  const [historyItems, setHistoryItems] = useState([]);

  const loadProfiles = useCallback(async () => {
    if (!user) return;
    setLoadingProfiles(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at');
    setProfiles(data || []);
    setLoadingProfiles(false);
    return data || [];
  }, [user]);

  useEffect(() => {
    if (!user) {
      setProfiles([]);
      setActiveProfileState(null);
      setWatchlistIds(new Set());
      return;
    }
    loadProfiles().then((data) => {
      // Restore last active profile from localStorage
      const savedId = localStorage.getItem('volta_profile_id');
      if (savedId && data) {
        const found = data.find((p) => p.id === savedId);
        if (found) setActiveProfileState(found);
      }
    });
  }, [user, loadProfiles]);

  useEffect(() => {
    if (!activeProfile) { setWatchlistIds(new Set()); return; }
    supabase
      .from('watchlist')
      .select('content_id')
      .eq('profile_id', activeProfile.id)
      .then(({ data }) => {
        setWatchlistIds(new Set((data || []).map((r) => Number(r.content_id))));
      });
  }, [activeProfile?.id]);

  // Cargar historial cuando cambia el perfil activo
  useEffect(() => {
    if (!activeProfile) { setWatchedIds(new Set()); setHistoryItems([]); return; }
    supabase.from('watch_history')
      .select('content_id, completed, last_watched_at')
      .eq('profile_id', activeProfile.id)
      .order('last_watched_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setHistoryItems(data || []);
        setWatchedIds(new Set((data || []).filter(r => r.completed).map(r => Number(r.content_id))));
      });
  }, [activeProfile?.id]);

  const selectProfile = (profile) => {
    if (!profile) {
      setActiveProfileState(null);
      localStorage.removeItem('volta_profile_id');
      return;
    }
    setActiveProfileState(profile);
    localStorage.setItem('volta_profile_id', profile.id);
  };

  const createProfile = async (name, avatarColor = '#f3590a') => {
    const { data, error } = await supabase
      .from('profiles')
      .insert({ user_id: user.id, name, avatar_color: avatarColor })
      .select()
      .single();
    if (!error && data) setProfiles((prev) => [...prev, data]);
    return { data, error };
  };

  const deleteProfile = async (profileId) => {
    const { error } = await supabase.from('profiles').delete().eq('id', profileId);
    if (!error) {
      setProfiles((prev) => prev.filter((p) => p.id !== profileId));
      if (activeProfile?.id === profileId) {
        setActiveProfileState(null);
        localStorage.removeItem('volta_profile_id');
      }
    }
    return { error };
  };

  const toggleWatchlist = async (contentId, contentType) => {
    if (!activeProfile) return;
    const id = Number(contentId);
    if (watchlistIds.has(id)) {
      await supabase
        .from('watchlist')
        .delete()
        .eq('profile_id', activeProfile.id)
        .eq('content_id', id);
      setWatchlistIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
    } else {
      await supabase
        .from('watchlist')
        .insert({ profile_id: activeProfile.id, content_id: id, content_type: contentType });
      setWatchlistIds((prev) => new Set([...prev, id]));
    }
  };

  const saveProgress = async (contentId, contentType, progressSeconds, durationSeconds) => {
    if (!activeProfile) return;
    await supabase.from('watch_history').upsert(
      {
        profile_id: activeProfile.id,
        content_id: Number(contentId),
        content_type: contentType,
        progress_seconds: progressSeconds,
        duration_seconds: durationSeconds,
        last_watched_at: new Date().toISOString(),
        completed: durationSeconds > 0 && progressSeconds / durationSeconds > 0.9,
      },
      { onConflict: 'profile_id,content_id' }
    );
  };

  const markWatched = async (contentId, contentType, completed = true) => {
    if (!activeProfile) return;
    const id = Number(contentId);
    await supabase.from('watch_history').upsert(
      { profile_id: activeProfile.id, content_id: id, content_type: contentType, completed, last_watched_at: new Date().toISOString(), progress_seconds: completed ? 100 : 1, duration_seconds: 100 },
      { onConflict: 'profile_id,content_id' }
    );
    if (completed) setWatchedIds(prev => new Set([...prev, id]));
    else setWatchedIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    setHistoryItems(prev => {
      const filtered = prev.filter(r => Number(r.content_id) !== id);
      return [{ content_id: id, completed, last_watched_at: new Date().toISOString() }, ...filtered].slice(0, 50);
    });
  };

  const clearHistory = useCallback(async () => {
    if (!activeProfile) return;
    await supabase.from('watch_history').delete().eq('profile_id', activeProfile.id);
    setHistoryItems([]);
    setWatchedIds(new Set());
  }, [activeProfile]);

  return (
    <ProfileContext.Provider
      value={{
        profiles,
        activeProfile,
        loadingProfiles,
        watchlistIds,
        watchedIds,
        historyItems,
        selectProfile,
        createProfile,
        deleteProfile,
        toggleWatchlist,
        saveProgress,
        markWatched,
        clearHistory,
        refreshProfiles: loadProfiles,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export const useProfile = () => useContext(ProfileContext);
