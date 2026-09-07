-- =============================================================================
-- MIGRATION: instagram_public_view_lockdown  (spec §0 linha A / A3)
--
-- (a) A view `instagram_accounts_public` roda hoje como SECURITY DEFINER (o
--     default do Postgres) e `anon` tem SELECT herdado do
--     `ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public"
--      GRANT ALL ON TABLES TO "anon"` de 20260507000001_schema.sql:7460 —
--     não existe GRANT literal sobre a view para grepar. Resultado: a anon
--     key pública lê a view de TODOS os sites.
--
-- (b) `instagram_accounts_staff_read` é `FOR SELECT TO authenticated`
--     (20260507190000:98-101) e RLS NÃO filtra colunas: qualquer editor lê
--     `access_token` em claro por PostgREST.
--     `revoke select (access_token)` sozinho é NO-OP — privilégio de TABELA
--     implica todas as colunas e não há grant de coluna a revogar. Só
--     derrubando o de tabela e re-concedendo a allow-list o PostgREST devolve
--     42501 (verificado localmente).
--
-- `anon` também sai do grant de tabela e recebe exatamente {id, site_id}: são
-- as duas colunas que o EXISTS das policies *_public_read dereferencia
-- (20260507190000:111-119 e :139-147), então o EXISTS continua executando sem
-- 42501 e continua devolvendo 0 linhas para `anon` (a única policy de SELECT
-- sobre a tabela é `instagram_accounts_staff_read TO authenticated`).
--
-- Racional (MUST): manter o grant de tabela deixaria `access_token` protegido
-- só por RLS; bastaria alguém acrescentar o `instagram_accounts_public_read`
-- que o CLAUDE.md manda usar (`public.site_visible(site_id)`) para a anon key
-- pública ler o token de todos os sites.
--
-- IMPACTO NA APLICAÇÃO: nenhum. Todo leitor de `instagram_accounts` e de
-- `instagram_accounts_public` no código passa por `getSupabaseServiceClient()`
-- (`lib/instagram/queries.ts`, `app/go/linktree/_lib/queries.ts`,
-- `app/cms/(authed)/settings/{page,actions}.tsx|ts`, os dois crons) — o papel
-- `service_role` não é tocado por esta migration.
--
-- Idempotente: `alter view … set`, `revoke` e `grant` podem rodar N vezes.
-- MANUTENÇÃO: toda coluna nova de `instagram_accounts` (M1/C1) MUST ser
-- re-concedida a `authenticated`; `anon` NUNCA ganha coluna nova. O ratchet
-- DB-gated `test/integration/instagram-accounts-public-view.test.ts` falha se
-- qualquer das duas regras for quebrada.
-- =============================================================================

alter view public.instagram_accounts_public set (security_invoker = true);

revoke all on public.instagram_accounts_public from anon, authenticated;

-- authenticated: allow-list de 16 colunas = a view inteira (tudo menos access_token)
revoke select on public.instagram_accounts from authenticated;
grant select (
  id, site_id, locale, handle, ig_user_id, token_expires_at, sync_enabled,
  display_slots, layout_type, section_title_pt, section_title_en,
  section_subtitle_pt, section_subtitle_en, last_synced_at, created_at, updated_at
) on public.instagram_accounts to authenticated;

-- anon: exatamente o que o EXISTS das policies *_public_read dereferencia
revoke select on public.instagram_accounts from anon;
grant select (id, site_id) on public.instagram_accounts to anon;

notify pgrst, 'reload schema';
