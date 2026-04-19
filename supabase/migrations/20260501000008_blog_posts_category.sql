ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS category text
    CHECK (category IN ('tech', 'vida', 'viagem', 'crescimento', 'code', 'negocio'));
