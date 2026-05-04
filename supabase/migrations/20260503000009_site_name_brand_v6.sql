-- Update site name to Brand Guide v6 canonical name.
-- "ByThiagoFigueiredo" → "Thiago Figueiredo" (clean personal brand).
-- This value drives the <title> tag via generateRootMetadata().

update public.sites
set name = 'Thiago Figueiredo'
where slug = 'bythiagofigueiredo';
