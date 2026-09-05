-- =============================================================================
-- Remover pg_net e os jobs de pg_cron que dependiam dele
-- =============================================================================
-- Contexto: incidente 2026-09-05. pg_cron + pg_net eram 97,9% do tempo de
-- execucao do banco (o site inteiro: 0,2%). A causa raiz — um job orfao que
-- chamava uma rota 404 a cada minuto — ja foi removida na migration anterior.
-- Esta tira o pg_net do caminho de vez.
--
-- PRE-REQUISITO (ordem obrigatoria): o deploy de producao com o vercel.json
-- que agenda publish-scheduled (*/5) e lgpd-cleanup-sweep (0 7) na Vercel
-- precisa estar Ready ANTES de aplicar isto — senao ha janela sem publish.
-- As rotas em main ja exportam GET (verificado em producao: 401, nao 405).
--
-- Seguranca do DROP EXTENSION (verificado em producao, nao presumido):
--   - schema supabase_functions nao existe -> sem Database Webhooks
--   - zero triggers com funcao %http%
--   - unico consumidor e public.cron_http_post_web(), plpgsql: resolve em
--     runtime, nao cascateia, vira funcao morta
-- purge-sent-emails e purge-old-contact-submissions sao SQL puro e FICAM no
-- pg_cron (as copias no vercel.json e que foram removidas — eram duplicatas).
-- =============================================================================

do $guard$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- jobs HTTP: a Vercel assume
    perform cron.unschedule(jobid)
      from cron.job
     where jobname in ('publish-scheduled', 'lgpd-cleanup-sweep');
    -- retencao da tabela que deixa de existir
    perform cron.unschedule(jobid)
      from cron.job
     where jobname = 'pgnet-response-retention';
  else
    raise notice 'pg_cron ausente: nada a desagendar (esperado fora de producao)';
  end if;
end
$guard$;

drop extension if exists pg_net;

-- A funcao helper fica orfa; remover para nao enganar a proxima auditoria.
drop function if exists public.cron_http_post_web(text);
