-- ============================================================
-- Playhub / Volta — Schema de perfiles de usuario
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- Perfiles (múltiples por cuenta, como Netflix)
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name        TEXT        NOT NULL,
  avatar_color TEXT       DEFAULT '#f3590a',
  is_kids     BOOLEAN     DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- "Mi Lista" (watchlist)
CREATE TABLE IF NOT EXISTS watchlist (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id   UUID        REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content_id   BIGINT      NOT NULL,
  content_type TEXT        NOT NULL CHECK (content_type IN ('movie', 'series')),
  added_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE (profile_id, content_id)
);

-- Historial de reproducción (progreso por título)
CREATE TABLE IF NOT EXISTS watch_history (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id       UUID        REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content_id       BIGINT      NOT NULL,
  content_type     TEXT        NOT NULL CHECK (content_type IN ('movie', 'series')),
  progress_seconds INTEGER     DEFAULT 0,
  duration_seconds INTEGER,
  completed        BOOLEAN     DEFAULT false,
  last_watched_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (profile_id, content_id)
);

-- Calificaciones (me gusta / no me gusta)
CREATE TABLE IF NOT EXISTS ratings (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID        REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content_id BIGINT      NOT NULL,
  rating     TEXT        NOT NULL CHECK (rating IN ('like', 'dislike')),
  rated_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (profile_id, content_id)
);

-- ============================================================
-- Row Level Security — cada usuario solo ve sus propios datos
-- ============================================================
ALTER TABLE profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist     ENABLE ROW LEVEL SECURITY;
ALTER TABLE watch_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings       ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "profiles_owner" ON profiles
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Watchlist (acceso a través de los perfiles del usuario)
CREATE POLICY "watchlist_owner" ON watchlist
  USING  (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Historial
CREATE POLICY "history_owner" ON watch_history
  USING  (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Calificaciones
CREATE POLICY "ratings_owner" ON ratings
  USING  (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Actualizar updated_at automáticamente en profiles
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
