-- =============================================================================
-- pg_cron: versionar os jobs que ate hoje existiam SO no dashboard
-- =============================================================================
-- Incidente 2026-09-05: producao ficou horas indisponivel porque um job de
-- pg_cron ("sync-newsletter-pending", a cada minuto) chamava via pg_net uma
-- rota deletada na saida do Brevo — 1440 POSTs/dia contra um 404. A tabela
-- net._http_response inchou para 792 MB (88% do banco) e o GC do pg_net
-- passou a consumir 90% do tempo de execucao numa instancia Micro.
--
-- Nenhum desses jobs estava em migration; foram criados pelo dashboard. Por
-- isso nenhuma auditoria anterior os viu. Esta migration os torna
-- versionados e idempotentes: cron.schedule(nome, ...) faz upsert por nome.
--
-- O job orfao NAO e recriado aqui — foi removido de proposito.
-- publish-scheduled e lgpd-cleanup-sweep ficam no pg_cron ate main ser
-- promovido: em producao as rotas ainda so exportam POST e o cron da Vercel
-- dispara GET (405). Quando main tiver o alias GET=POST, migrar para a
-- Vercel e DROP EXTENSION pg_net.
-- =============================================================================

-- Guard: o pg_cron so existe onde foi criado (em producao, pelo dashboard). No
-- Supabase local da CI a imagem tem o binario mas a extensao nao e criada, e
-- `schema "cron" does not exist` derruba o `supabase start`. Sem pg_cron, esta
-- migration e no-op — e nao tenta `create extension`, que exigiria
-- shared_preload_libraries e mudaria a topologia do banco.
do $guard$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron ausente: jobs nao agendados (esperado fora de producao)';
    return;
  end if;

  perform cron.schedule(
  'publish-scheduled', '*/5 * * * *',
  $$select public.cron_http_post_web('/api/cron/publish-scheduled')$$
);

  perform cron.schedule(
  'lgpd-cleanup-sweep', '0 7 * * *',
  $$select public.cron_http_post_web('/api/cron/lgpd-cleanup-sweep')$$
);

  perform cron.schedule(
  'purge-sent-emails', '0 6 * * *',
  $$select public.cron_purge_sent_emails()$$
);

  perform cron.schedule(
  'purge-old-contact-submissions', '0 6 * * 0',
  $$select public.cron_purge_old_contact_submissions()$$
);

-- Retencao: net._http_response e UNLOGGED, ninguem le as respostas (o
-- helper devolve o request_id e nunca coleta), e o GC por TTL nao devolve
-- espaco ao SO. Truncar diariamente numa hora vazia impede a recaida.
-- lock_timeout: se o worker do pg_net estiver no meio de um ciclo, aborta
-- limpo e tenta amanha — nunca enfileira atras dele.
  perform cron.schedule(
  'pgnet-response-retention', '0 5 * * *',
  $$set lock_timeout = '60s'; truncate net._http_response;$$
);

-- Historico do proprio pg_cron cresce sem limite (49 MB, nunca vacuumado).
  perform cron.schedule(
  'pgcron-run-details-retention', '30 5 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '7 days'$$
);
end
$guard$;
