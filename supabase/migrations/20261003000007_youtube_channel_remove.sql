-- =============================================================================
-- MIGRATION: remoção de um canal próprio do YouTube, tudo ou nada
-- =============================================================================

-- Até aqui a remoção era feita pela aplicação em quatro deletes soltos (comentários, vídeos, log, canal): se o
-- segundo falhasse, os comentários já tinham sido apagados. Um teste A/B em qualquer vídeo do canal fazia
-- exatamente isso, porque ab_tests.youtube_video_id não tem ON DELETE.
-- Aqui a remoção vira UMA chamada, dentro de uma transação: ou some o canal com tudo o que depende dele, ou
-- nenhuma linha é apagada. Só cria/substitui duas funções: não muda tabela, coluna, constraint nem dado.
-- Idempotente (create or replace + revoke/grant). Depende de 20261003000006 (youtube_channels.slug).
--
-- O que depende de um canal (levantado pelas chaves estrangeiras) e o que acontece com cada coisa:
--   youtube_videos (channel_id, sem ON DELETE) ................ apagado aqui
--     youtube_curated_comments, youtube_video_analytics,
--     video_grade_history, youtube_fatigue_alerts,
--     youtube_intelligence (video_id) .......................... cascata dos vídeos
--     optimization_cycles (cascata dos vídeos, mas aponta para
--       ab_tests sem ON DELETE) ................................ apagado aqui, ANTES dos testes
--     ab_tests (youtube_video_id, sem ON DELETE) ............... apagado aqui (só existe remoção sem teste rodando)
--       ab_test_variants / _cycles / _polls / _tracked_links ... cascata dos testes
--       thumbnail_library,
--       youtube_fatigue_alerts.resolved_by_test_id ............. SET NULL (a linha fica, perde o vínculo)
--     content_pipeline.youtube_video_id ....................... SET NULL (a linha fica, perde o vínculo)
--     yt_notifications (vídeo, teste ou ciclo do canal; a FK é
--       SET NULL, mas o link da notificação morreria) .......... apagado aqui
--   youtube_sync_log (channel_id, sem ON DELETE) ............... apagado aqui
--   youtube_intelligence, youtube_intelligence_tasks,
--   youtube_notes (channel_id) ................................. cascata do canal
--   content_pipeline.youtube_channel_id ........................ SET NULL
--   social_connections (provider 'youtube', account_id = id do
--     canal no YouTube; sem FK) ................................ DESLIGADA aqui: revoked_at + tokens zerados
--
-- Teste A/B que BLOQUEIA: status 'active', 'paused' ou 'queued' — começou e não terminou (pode haver uma variante no
-- ar no YouTube, e a thumbnail original só está guardada na linha do teste), ou está na fila e o cron o inicia
-- sozinho. Encerrado ('completed') e arquivado ('archived') não bloqueiam e são apagados junto (contagem ab_tests);
-- rascunho ('draft') também é apagado junto, com contagem própria (ab_drafts).

-- 1. O que a remoção apagaria, e o que a impede. Só leitura.
create or replace function public.youtube_channel_removal_impact(p_site_id uuid, p_channel_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_name text;
  v_slug text;
  v_yt text;
begin
  select c.name, c.slug, c.channel_id into v_name, v_slug, v_yt
  from public.youtube_channels c where c.id = p_channel_id and c.site_id = p_site_id;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'name', v_name,
    'slug', v_slug,
    'videos', (select count(*) from public.youtube_videos v where v.channel_id = p_channel_id),
    'comments', (select count(*) from public.youtube_curated_comments cc
                 join public.youtube_videos v on v.id = cc.video_id where v.channel_id = p_channel_id),
    'sync_logs', (select count(*) from public.youtube_sync_log l where l.channel_id = p_channel_id),
    -- os testes encerrados que serão apagados junto
    'ab_tests', (select count(*) from public.ab_tests t
                 join public.youtube_videos v on v.id = t.youtube_video_id
                 where v.channel_id = p_channel_id and t.status not in ('active', 'paused', 'queued', 'draft')),
    -- os rascunhos (nunca rodaram), apagados junto, contados à parte
    'ab_drafts', (select count(*) from public.ab_tests t
                  join public.youtube_videos v on v.id = t.youtube_video_id
                  where v.channel_id = p_channel_id and t.status = 'draft'),
    'analyses', (select count(*) from public.youtube_intelligence i
                 where i.channel_id = p_channel_id
                    or i.video_id in (select v.id from public.youtube_videos v where v.channel_id = p_channel_id)),
    'tasks', (select count(*) from public.youtube_intelligence_tasks k where k.channel_id = p_channel_id),
    'notes', (select count(*) from public.youtube_notes n where n.channel_id = p_channel_id),
    -- notificações de um vídeo, teste ou ciclo de otimização do canal
    'notifications', (select count(*) from public.yt_notifications nt
                      where nt.youtube_video_id in (select v.id from public.youtube_videos v where v.channel_id = p_channel_id)
                         or nt.ab_test_id in (select t.id from public.ab_tests t join public.youtube_videos v on v.id = t.youtube_video_id
                                              where v.channel_id = p_channel_id)
                         or nt.optimization_cycle_id in (select oc.id from public.optimization_cycles oc
                                                         join public.youtube_videos v on v.id = oc.youtube_video_id
                                                         where v.channel_id = p_channel_id)),
    -- conexões OAuth vivas deste canal neste site (serão desligadas)
    'connections', (select count(*) from public.social_connections sc
                    where sc.site_id = p_site_id and sc.provider = 'youtube' and sc.account_id = v_yt and sc.revoked_at is null),
    -- itens do pipeline que ficam, sem o vínculo
    'pipeline_links', (select count(*) from public.content_pipeline p
                       where p.youtube_channel_id = p_channel_id
                          or p.youtube_video_id in (select v.id from public.youtube_videos v where v.channel_id = p_channel_id)),
    'blockers', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'status', t.status, 'started_at', t.started_at,
                                          'paused_at', t.paused_at, 'video_title', v.title)
                       order by t.started_at nulls last, t.id)
      from public.ab_tests t join public.youtube_videos v on v.id = t.youtube_video_id
      where v.channel_id = p_channel_id and t.status in ('active', 'paused', 'queued')), '[]'::jsonb)
  );
end $$;

-- 2. A remoção. Uma chamada = uma transação: qualquer erro desfaz tudo o que ela já tinha apagado.
--    Devolve o mesmo objeto do impacto (contado ANTES de apagar), com status:
--      'removed' | 'blocked' (nada apagado; blockers diz quais testes parar) | 'not_found' | 'slug_mismatch'.
--    p_confirm_slug é o slug que o dono digitou na confirmação: tem de ser o do canal.
--    O retorno só tem status, nome, slug, contagens e blockers: NENHUM token sai do banco, cifrado ou não.
--    Nada é revogado no Google: canais do mesmo usuário Google podem compartilhar a autorização.
create or replace function public.youtube_channel_remove(p_site_id uuid, p_channel_id uuid, p_confirm_slug text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_slug text;
  v_yt text;
  v_videos uuid[];
  v_tests uuid[];
  v_impact jsonb;
begin
  -- trava o canal: duas remoções simultâneas do mesmo canal não se cruzam
  select c.slug, c.channel_id into v_slug, v_yt from public.youtube_channels c
  where c.id = p_channel_id and c.site_id = p_site_id for update;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  if p_confirm_slug is distinct from v_slug then
    return jsonb_build_object('status', 'slug_mismatch');
  end if;

  -- trava os vídeos (um teste novo não entra: o insert em ab_tests precisa da chave do vídeo) e os testes
  -- (nenhum muda de status entre a checagem e o delete)
  select coalesce(array_agg(s.id), '{}') into v_videos
  from (select v.id from public.youtube_videos v where v.channel_id = p_channel_id for update) s;
  select coalesce(array_agg(s.id), '{}') into v_tests
  from (select t.id from public.ab_tests t where t.youtube_video_id = any(v_videos) for update) s;

  v_impact := public.youtube_channel_removal_impact(p_site_id, p_channel_id);
  if jsonb_array_length(v_impact -> 'blockers') > 0 then
    return v_impact || jsonb_build_object('status', 'blocked');
  end if;

  -- A conexão OAuth deste canal neste site é desligada junto: revoked_at é como todo o código reconhece uma conexão
  -- desligada (todo leitor filtra revoked_at is null), e os tokens guardados são zerados (access_token_enc é NOT
  -- NULL: fica ''). A de outro canal, e a deste canal em outro site, não são tocadas. Os tokens são apagados aqui e
  -- não são devolvidos a ninguém.
  update public.social_connections sc
  set revoked_at = now(), access_token_enc = '', refresh_token_enc = null, page_token_enc = null, token_expires_at = null
  where sc.site_id = p_site_id and sc.provider = 'youtube' and sc.account_id = v_yt and sc.revoked_at is null;

  -- as notificações de um vídeo, teste ou ciclo do canal saem antes deles (a FK só anularia o vínculo)
  delete from public.yt_notifications nt
  where nt.youtube_video_id = any(v_videos) or nt.ab_test_id = any(v_tests)
     or nt.optimization_cycle_id in (select oc.id from public.optimization_cycles oc where oc.youtube_video_id = any(v_videos));

  -- optimization_cycles aponta para ab_tests sem ON DELETE: os ciclos dos vídeos do canal saem antes dos testes;
  -- um ciclo de outro vídeo que aponte para um destes testes fica, sem o vínculo.
  update public.optimization_cycles oc set ab_test_id = null
  where oc.ab_test_id = any(v_tests) and not (oc.youtube_video_id = any(v_videos));
  delete from public.optimization_cycles oc where oc.youtube_video_id = any(v_videos);
  delete from public.ab_tests t where t.id = any(v_tests);
  delete from public.youtube_videos v where v.channel_id = p_channel_id;
  delete from public.youtube_sync_log l where l.channel_id = p_channel_id;
  delete from public.youtube_channels c where c.id = p_channel_id and c.site_id = p_site_id;

  return v_impact || jsonb_build_object('status', 'removed');
end $$;

-- SECURITY DEFINER e sem checagem de permissão por dentro: só o service role as chama, depois do guard da action.
revoke all on function public.youtube_channel_removal_impact(uuid, uuid) from public, anon, authenticated;
revoke all on function public.youtube_channel_remove(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.youtube_channel_removal_impact(uuid, uuid) to service_role;
grant execute on function public.youtube_channel_remove(uuid, uuid, text) to service_role;

comment on function public.youtube_channel_removal_impact(uuid, uuid) is 'Conta o que a remoção de um canal próprio apagaria e lista os testes A/B (active/paused/queued) que a bloqueiam. Só leitura; só service role.';
comment on function public.youtube_channel_remove(uuid, uuid, text) is 'Remove um canal próprio e tudo o que depende dele em uma transação (tudo ou nada). Teste A/B active/paused/queued bloqueia antes de apagar. Desliga a conexão OAuth do canal. Só service role.';
