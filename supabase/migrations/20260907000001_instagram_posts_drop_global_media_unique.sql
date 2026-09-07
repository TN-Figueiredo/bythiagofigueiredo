-- =============================================================================
-- MIGRATION: instagram_posts — drop da unique global de ig_media_id (C4, contract)
-- =============================================================================
-- Spec: docs/superpowers/specs/2026-09-06-instagram-oauth-reconnect-design.md
--       §3.2 "M2 (C4)", §0 linha C4, §7 passo 4.
--
-- M1 (C1) acrescentou instagram_posts_account_media_key (account_id, ig_media_id)
-- deixando-a COEXISTIR com instagram_posts_ig_media_id_key (ig_media_id), criada
-- em 20260507190000_instagram_feed.sql:49-50 — expand puro, sem quebrar o código
-- antigo. Enquanto as duas coexistem, a 2ª linha de locale da mesma conta
-- Instagram falha o upsert com 23505 e o ramo `c2c4dup` de §3.3 passo 6 mascara
-- o ruído. Este é o passo contract: a composta passa a ser a única unique, cada
-- linha de locale ganha a sua própria cópia dos posts, e o ramo `c2c4dup` sai do
-- código no mesmo lote.
--
-- Pré-requisitos (§7 passo 4, verificados antes de aplicar): C2 em produção,
-- ≥ 1 ciclo agendado das 13:00 UTC executado, ≤ 2 dias desde a promoção de C2.
-- =============================================================================

alter table public.instagram_posts
  drop constraint if exists instagram_posts_ig_media_id_key;

-- As chaves de rate-limit `c2c4dup:<accountId>` perdem o emissor neste mesmo
-- commit. Sem esta limpeza elas viram fóssil permanente em ops_alert_state.
-- O guard existe porque ops_alert_state nasce em M1 (C1): esta migration não
-- deve depender da ordem de aplicação para ser idempotente.
do $$
begin
  if to_regclass('public.ops_alert_state') is not null then
    delete from public.ops_alert_state where key like 'c2c4dup:%';
  end if;
end $$;

notify pgrst, 'reload schema';

-- =============================================================================
-- ROLLBACK de C4 (§7, parágrafo "Depois de C4") — NÃO é `git revert`.
-- =============================================================================
-- Recriar a unique global sobre uma tabela que já ganhou cópias por conta falha
-- com 23505 enquanto as cópias extras existirem. A ordem abaixo é obrigatória e
-- os três passos são um só procedimento.
--
-- Passo 1 — apagar as cópias extras, mantendo a mais recente de cada media.
-- EFEITO COLATERAL A REGISTRAR NO RUNBOOK: instagram_feed_slots.post_id tem
-- ON DELETE SET NULL (20260507190000_instagram_feed.sql:59); todo slot que
-- apontava para uma cópia apagada vira NULL e o CMS mostra o slot vazio até
-- alguém repicar o post. Nenhum slot é removido.
--
--   delete from public.instagram_posts
--    where id in (
--      select id from (
--        select id, row_number() over (
--          partition by ig_media_id order by created_at desc, id desc
--        ) as rn
--        from public.instagram_posts
--      ) ranked
--     where rn > 1);
--
-- Passo 2 — recriar a unique global.
--
--   alter table public.instagram_posts
--     drop constraint if exists instagram_posts_ig_media_id_key;
--   alter table public.instagram_posts
--     add constraint instagram_posts_ig_media_id_key unique (ig_media_id);
--
-- Passo 3 — MUST quando o rollback continuar para trás e passar por C2
-- (§7: "repetir o mesmo reset de identidade do passo de banco de C2"). Sem
-- ele, ficam linhas com ig_user_id_source='oauth' sem token e sem dono
-- conhecido, alcançáveis pelo data-deletion no roll-forward: uma colisão
-- numérica entre espaços de id apagaria token, instagram_posts,
-- instagram_feed_slots, blobs e instagram_sync_log de um terceiro.
--
--   update public.instagram_accounts
--      set ig_user_id_source = 'legacy', ig_professional_id = null
--    where access_token is null and ig_user_id_source = 'oauth';
--
-- Reversão da limpeza de ops_alert_state: nenhuma. As chaves `c2c4dup:%` são
-- rate limiters de 23 h; ausentes, o primeiro run pós-rollback apenas emite o
-- captureMessage de novo. A composta instagram_posts_account_media_key (M1)
-- FICA — ela não é de C4 e não atrapalha o código pré-C2 (onConflict:'ig_media_id').
--
-- Prova executável desta receita:
-- apps/web/test/integration/ops-alert-claim.test.ts →
--   'the documented C4 rollback recipe restores the global unique'
-- =============================================================================
