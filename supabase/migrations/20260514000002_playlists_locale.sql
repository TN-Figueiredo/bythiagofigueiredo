-- Playlist locale support (denormalized, like youtube_categories)
-- Renames name → name_pt, description → description_pt, adds name_en + description_en

ALTER TABLE public.playlists RENAME COLUMN name TO name_pt;
ALTER TABLE public.playlists ADD COLUMN name_en TEXT NOT NULL DEFAULT '';
ALTER TABLE public.playlists RENAME COLUMN description TO description_pt;
ALTER TABLE public.playlists ADD COLUMN description_en TEXT;
