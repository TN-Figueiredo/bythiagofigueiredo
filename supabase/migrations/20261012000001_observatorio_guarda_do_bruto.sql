-- MG13 (A5, E20): o bruto dos relatórios em lote deixa de ser apagado por cron.
-- Mesma assinatura e mesmos grants: o cron diário continua chamando e passa a receber 0.
-- O corpo antigo (apaga o normalizado há 90 dias e o sem normalizador baixado há 180) está em
-- 20261007000006_coleta_canais_proprios_l1a.sql, linhas 186 a 206. Não recriar: é o que apaga.
create or replace function public.yt_reporting_blobs_purge(p_sem_normalizador text[])
returns integer
language plpgsql
set search_path = ''
as $$
begin
  return 0;   -- nada é apagado. A MG6 (E10) troca este corpo por "só o bruto em lote com nas_confirmed_at".
end $$;

revoke all on function public.yt_reporting_blobs_purge(text[]) from public, anon, authenticated;
grant execute on function public.yt_reporting_blobs_purge(text[]) to service_role;

-- Estado que a E12 pediu e não tinha onde gravar (pendência M6 do ledger da E12), e a perda reconhecida pelo dono.
alter table public.yt_reporting_reports
  add column if not exists expired_at timestamptz,
  add column if not exists download_attempts integer not null default 0,
  add column if not exists last_error_at timestamptz,
  add column if not exists blob_lost_at timestamptz;

comment on column public.yt_reporting_reports.expired_at is
  'Instante em que a origem respondeu 404 ou 410 ao download. Nulo = a origem não recusou: não venceu, venceu por idade sem resposta da origem (error = ''passou do prazo sem baixar''), ou linha anterior à MG13 (sem registro de vencimento).';
comment on column public.yt_reporting_reports.download_attempts is
  'Tentativas de download deste relatório desde a MG13 (zero em linha baixada antes dela = não contado). Leitura e soma sem trava: duas execuções sobrepostas podem contar uma só.';
comment on column public.yt_reporting_reports.last_error_at is
  'Última tentativa que não guardou o bruto (download ou gravação). Nulo = nunca falhou desde a MG13.';
comment on column public.yt_reporting_reports.blob_lost_at is
  'O dono reconheceu que o bruto deste relatório se perdeu e não existe mais na origem. Nulo = sem perda reconhecida. Tira o relatório do alarme baixados_sem_bruto; conta em perdas_reconhecidas. Só o dono grava (runbook da coleta, seção 13).';

-- Conferência exata da guarda (anti-junção nos dois sentidos), lida pelo cron em toda execução. Só leitura.
create or replace function public.yt_reporting_guarda_conferir()
returns table (brutos bigint, baixados bigint, baixados_sem_bruto bigint, brutos_sem_baixado bigint, perdas_reconhecidas bigint)
language sql
stable
set search_path = ''
as $$
  select
    (select count(*) from public.yt_reporting_report_blobs),
    (select count(*) from public.yt_reporting_reports r where r.downloaded_at is not null),
    (select count(*) from public.yt_reporting_reports r
      where r.downloaded_at is not null and r.blob_lost_at is null
        and not exists (select 1 from public.yt_reporting_report_blobs b where b.report_id = r.report_id)),
    (select count(*) from public.yt_reporting_report_blobs b
      where not exists (select 1 from public.yt_reporting_reports r where r.report_id = b.report_id and r.downloaded_at is not null)),
    (select count(*) from public.yt_reporting_reports r where r.blob_lost_at is not null);
$$;

revoke all on function public.yt_reporting_guarda_conferir() from public, anon, authenticated;
grant execute on function public.yt_reporting_guarda_conferir() to service_role;

notify pgrst, 'reload schema';
