-- Fix broken avatar_url '/identity/thiago.jpg' — file was never committed.
-- Set to NULL so the UI falls back to initials until a real photo is uploaded.
UPDATE public.authors
SET avatar_url = NULL
WHERE avatar_url = '/identity/thiago.jpg';
