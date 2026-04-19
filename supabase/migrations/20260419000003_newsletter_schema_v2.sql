-- 1. Newsletter types lookup table
CREATE TABLE IF NOT EXISTS newsletter_types (
  id         text PRIMARY KEY,
  locale     text NOT NULL CHECK (locale IN ('en', 'pt-BR')),
  name       text NOT NULL,
  tagline    text,
  cadence    text,
  color      text NOT NULL DEFAULT '#C14513',
  active     boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Seed 8 newsletter types
INSERT INTO newsletter_types (id, locale, name, tagline, cadence, color, sort_order) VALUES
  ('main-en',   'en',    'The bythiago diary',  'Thoughts from the edge of the keyboard', 'Weekly',   '#C14513', 1),
  ('trips-en',  'en',    'Curves & roads',       'Motorcycle diaries, travel, freedom',    'Monthly',  '#1A6B4A', 2),
  ('growth-en', 'en',    'Grow inward',          'Self-improvement, habits, depth',        'Bi-weekly','#6B4FA0', 3),
  ('code-en',   'en',    'Code in Portuguese',   'Tech content, originally in PT-BR',     'Weekly',   '#1A5280', 4),
  ('main-pt',   'pt-BR', 'Diário do bythiago',   'Pensamentos da beira do teclado',       'Semanal',  '#C14513', 1),
  ('trips-pt',  'pt-BR', 'Curvas & estradas',    'Diários de moto, viagem, liberdade',    'Mensal',   '#1A6B4A', 2),
  ('growth-pt', 'pt-BR', 'Crescer de dentro',    'Desenvolvimento pessoal, hábitos',      'Quinzenal','#6B4FA0', 3),
  ('code-pt',   'pt-BR', 'Código em português',  'Conteúdo tech, em português mesmo',     'Semanal',  '#1A5280', 4)
ON CONFLICT (id) DO NOTHING;

-- 3. Add newsletter_id FK to subscriptions
--    NOTE: locale column already exists (added in 20260416000014) — NOT re-added here
ALTER TABLE newsletter_subscriptions
  ADD COLUMN IF NOT EXISTS newsletter_id text
    REFERENCES newsletter_types(id)
    ON DELETE SET NULL;

-- Backfill existing rows
UPDATE newsletter_subscriptions
  SET newsletter_id = 'main-pt'
  WHERE newsletter_id IS NULL;
