-- 20260502000003_newsletter_types_landing.sql
-- Adds landing page columns to newsletter_types for /newsletters/[slug] pages.

-- 1. New columns
ALTER TABLE public.newsletter_types
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS og_image_url text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS color_dark text,
  ADD COLUMN IF NOT EXISTS badge text,
  ADD COLUMN IF NOT EXISTS cadence_label text,
  ADD COLUMN IF NOT EXISTS landing_content jsonb NOT NULL DEFAULT '{}';

-- 2. Constraints (idempotent via DO block)
DO $$ BEGIN
  ALTER TABLE public.newsletter_types
    ADD CONSTRAINT newsletter_types_slug_unique UNIQUE (slug);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.newsletter_types
    ADD CONSTRAINT newsletter_types_slug_format
    CHECK (slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.newsletter_types
    ADD CONSTRAINT newsletter_types_slug_length
    CHECK (char_length(slug) >= 3 AND char_length(slug) <= 80);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.newsletter_types
    ADD CONSTRAINT newsletter_types_slug_reserved
    CHECK (slug !~ '^(archive|subscribe|new|settings|edit|confirm|api|admin|hub|rss|feed)$');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.newsletter_types
    ADD CONSTRAINT newsletter_types_og_image_url_https
    CHECK (og_image_url IS NULL OR og_image_url ~ '^https://');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.newsletter_types
    ADD CONSTRAINT newsletter_types_color_dark_hex
    CHECK (color_dark IS NULL OR color_dark ~ '^#[0-9a-fA-F]{6}$');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.newsletter_types
    ADD CONSTRAINT newsletter_types_landing_content_shape
    CHECK (
      landing_content IS NULL
      OR (
        jsonb_typeof(landing_content) = 'object'
        AND (
          landing_content->'promise' IS NULL
          OR jsonb_typeof(landing_content->'promise') = 'array'
        )
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Trigger (reuse existing tg_set_updated_at)
DROP TRIGGER IF EXISTS set_newsletter_types_updated_at ON public.newsletter_types;
CREATE TRIGGER set_newsletter_types_updated_at
  BEFORE UPDATE ON public.newsletter_types
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 4. Backfill (guarded: only runs if slug IS NULL)

-- main-pt
UPDATE public.newsletter_types SET
  slug = 'diario-do-bythiago',
  description = 'Toda sexta, eu paro e escrevo o que aconteceu na semana — o post novo do blog, o vídeo do canal, o bug que me derrubou, o livro que tô lendo. É a newsletter principal, a que junta tudo num lugar só. Não é resumo formal: é mais carta pra um amigo que tá longe.',
  color_dark = '#FF8240',
  cadence_label = '1× por semana, sextas',
  badge = 'principal',
  landing_content = '{"promise":["o post mais recente, com nota pessoal de bastidor","o vídeo da semana, com o que eu cortei e por quê","3–5 links que eu salvei pra ler depois","uma coisa pequena que aprendi (ou quebrei)"]}'
WHERE id = 'main-pt' AND slug IS NULL;

-- main-en
UPDATE public.newsletter_types SET
  slug = 'the-bythiago-diary',
  description = E'Every Friday, I stop and write down the week — the new blog post, the new video, the bug that took me down, the book I''m reading. It''s the main newsletter, the one that pulls everything together. Not a corporate digest: more like a letter to a friend who''s far away.',
  color_dark = '#FF8240',
  cadence_label = 'weekly, Fridays',
  badge = 'main',
  landing_content = '{"promise":["the latest post, with a behind-the-scenes note","the week''s video, with what I cut and why","3–5 links I bookmarked to read later","one small thing I learned (or broke)"]}'
WHERE id = 'main-en' AND slug IS NULL;

-- trips-pt
UPDATE public.newsletter_types SET
  slug = 'curvas-e-estradas',
  description = 'Eu tenho uma Tenere 250 e uma certeza: a melhor parte do trabalho de hoje é poder fechar o laptop na quinta e abrir o mapa. Essa newsletter é o que sobra depois da viagem — o trecho que valeu, o que evitar, o restaurante de beira de estrada que não tem Google review, e a foto que a câmera do celular conseguiu salvar.',
  color_dark = '#5FA87D',
  cadence_label = 'quando eu pegar estrada',
  badge = 'novo',
  landing_content = '{"promise":["o trajeto, com mapa anotado","3–5 lugares pra parar (e 1 pra evitar)","foto crua, sem filtro, sem stories","o que deu errado — porque sempre dá"]}'
WHERE id = 'trips-pt' AND slug IS NULL;

-- trips-en
UPDATE public.newsletter_types SET
  slug = 'curves-and-roads',
  description = E'I have a Tenere 250 and one certainty: the best part of today''s work is being able to close the laptop on Thursday and open the map. This newsletter is what''s left after the trip — the stretch that was worth it, what to avoid, the roadside diner with no Google reviews, and the photo my phone camera managed to save.',
  color_dark = '#5FA87D',
  cadence_label = 'whenever I hit the road',
  badge = 'new',
  landing_content = '{"promise":["the route, with an annotated map","3–5 places to stop (and 1 to avoid)","raw photos, no filter, no stories","what went wrong — because it always does"]}'
WHERE id = 'trips-en' AND slug IS NULL;

-- growth-pt
UPDATE public.newsletter_types SET
  slug = 'crescer-de-dentro',
  description = 'Eu trabalho sozinho. Isso significa que ninguém me empurra, ninguém me cobra, e ninguém me lembra de almoçar. Essa newsletter é o que eu fui aprendendo a fazer pra continuar funcional — não é guru de produtividade, é mais o caderno de campo de quem tá testando o que dá certo no longo prazo. Domingo, café, e uma pergunta pra semana.',
  color_dark = '#A983D6',
  cadence_label = 'a cada 2 semanas, domingos',
  landing_content = '{"promise":["um hábito que eu testei (e o que aconteceu)","um livro ou ensaio que mexeu comigo","uma pergunta pra você levar na semana","sem checklist, sem app novo, sem urgência"]}'
WHERE id = 'growth-pt' AND slug IS NULL;

-- growth-en
UPDATE public.newsletter_types SET
  slug = 'grow-inward',
  description = E'I work alone. That means nobody pushes me, nobody nags me, and nobody reminds me to have lunch. This newsletter is what I''ve been learning to do to stay functional — not productivity-guru stuff, more like the field journal of someone testing what works long-term. Sunday, coffee, and one question for the week.',
  color_dark = '#A983D6',
  cadence_label = 'every 2 weeks, Sundays',
  landing_content = '{"promise":["a habit I tested (and what happened)","a book or essay that hit me","a question for you to carry through the week","no checklist, no new app, no urgency"]}'
WHERE id = 'growth-en' AND slug IS NULL;

-- code-pt
UPDATE public.newsletter_types SET
  slug = 'codigo-em-portugues',
  description = E'A internet técnica em inglês é boa demais. Mas falta uma coisa em português que não seja tutorial básico nem tradução tardia de hype. Essa newsletter é o que eu queria ter lido quando estava decidindo se aguentava migrar pra microserviço (não aguentei) ou se compensava trocar de banco (não compensava). Decisões reais, com nome e número do projeto.',
  color_dark = '#5FA8E0',
  cadence_label = 'mensal, última quinta',
  landing_content = '{"promise":["uma decisão real de stack (e por que)","o bug do mês — diagnóstico completo","código que rodou em produção","zero hype, zero ''X tools every dev needs''"]}'
WHERE id = 'code-pt' AND slug IS NULL;

-- code-en
UPDATE public.newsletter_types SET
  slug = 'code-in-portuguese',
  description = E'Technical writing in English is great. But there''s a gap in Portuguese — between basic tutorials and late translations of hype. This newsletter is what I wish I''d read when deciding whether microservices were worth it (they weren''t) or whether to switch databases (it wasn''t). Real decisions, with project names and numbers.',
  color_dark = '#5FA8E0',
  cadence_label = 'monthly, last Thursday',
  landing_content = '{"promise":["a real stack decision (and why)","the bug of the month — full postmortem","code that ran in production","zero hype, zero ''X tools every dev needs''"]}'
WHERE id = 'code-en' AND slug IS NULL;

-- 5. Make slug NOT NULL now that all rows are backfilled
ALTER TABLE public.newsletter_types ALTER COLUMN slug SET NOT NULL;
