-- Manutenção M9: expurgo enxuto (fatia 12b). Rascunho: vira a migration manutencao_m9_expurgo na Tarefa 10 (TRAVA M9-1).
-- Depende da M3b (obs_archive_*) e da E9 (competitor_video_purge / competitor_comments_purge) aplicadas.

-- M9 PARTE 1: guardas, colunas, tabelas, interruptor
do $$ declare v_def text; begin
  if to_regclass('public.obs_archive_units') is null or to_regclass('public.competitor_removed_items') is null
     or to_regprocedure('public.obs_archive_record_core(uuid,text,jsonb,text)') is null then
    raise exception 'm9_m3b_ausente' using errcode = 'P0001';
  end if;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname in ('competitor_video_purge', 'competitor_comments_purge', 'competitor_channel_purge')) <> 3 then
    raise exception 'm9_sem_e9' using errcode = 'P0001';
  end if;
  select pg_get_constraintdef(c.oid) into v_def from pg_constraint c
    where c.conrelid = 'public.obs_archive_months'::regclass and c.contype = 'c' and pg_get_constraintdef(c.oid) like '%unsealed_reason%' limit 1;
  if v_def is null or v_def not like '%expurgo%' then
    raise exception 'm9_m3b_sem_expurgo' using errcode = 'P0001',
      detail = 'a M3b precisa aceitar unsealed_reason = expurgo (pedido da M9 para a Tarefa 10 da M3b)';
  end if;
end $$;

alter table public.competitor_removed_items add column if not exists marcado_rodado_em timestamptz;
alter table public.obs_archive_channel_removals add column if not exists marcado_rodado_em timestamptz;
alter table public.obs_archive_channel_removals add column if not exists nas_last_absent_at timestamptz;
-- O resumo do expurgo é gravado pela M9; a origem separa o que o site exporta do que o Mac refez (D-M9-16).
alter table public.obs_archive_summaries add column if not exists origem text not null default 'rota';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'obs_archive_summaries_origem_check') then
    alter table public.obs_archive_summaries add constraint obs_archive_summaries_origem_check check (origem in ('rota', 'expurgo'));
  end if;
end $$;

-- A lista do item (02 §11.3 item 2; D-M9-1): um alvo por unidade (classe, tabela, canal, mês), tipo e geração.
create table if not exists public.obs_archive_item_targets (
  id bigint generated always as identity primary key,
  site_id uuid not null,
  item_kind text not null check (item_kind in ('video', 'comentario')),
  item_refs text[] not null check (cardinality(item_refs) between 1 and 20000),       -- youtube_id do vídeo / youtube_comment_id
  item_id bigint,                                                                      -- representante: menor id de competitor_removed_items que casa
  class text not null check (class in ('horaria', 'serie', 'texto', 'video_antigo')),
  table_name text not null,
  channel_ref text not null check (channel_ref ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  month date not null check (month = date_trunc('month', month)::date),
  geracao integer not null default 1 check (geracao between 1 and 99),
  keys text[] not null check (cardinality(keys) <= 20000),                              -- uuid do vídeo; id do comentário (com respostas). Emenda 23/10 (D-M9-25b): vazio só quando o alvo está concluído
  keys_n integer check (keys_n >= 0),                                                  -- contagem guardada ao esvaziar `keys` em concluido/sem_linhas
  esperadas bigint check (esperadas >= 0),                                             -- linhas do item no online; nulo = não conferível
  from_unit_id uuid not null,
  from_version integer not null check (from_version between 1 and 9999),
  estado text not null default 'copiar'
    check (estado in ('copiar', 'aguardando_nova', 'apagar_antigas', 'conferir_b2', 'concluido', 'sem_linhas', 'bloqueado')),
  motivo text check (motivo in ('antiga_ausente', 'antiga_divergente', 'depende_m10b', 'grande_demais', 'contagem_divergente')),
  motivo_fim text check (motivo_fim in ('canal_apagado')),
  to_unit_id uuid, to_version integer, rows_removed bigint check (rows_removed >= 0),
  done_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (site_id, class, table_name, channel_ref, month, item_kind, geracao),
  check ((estado = 'bloqueado') = (motivo is not null)),
  check ((estado in ('concluido', 'sem_linhas')) = (done_at is not null)),
  check (motivo_fim is null or estado = 'concluido'),
  check (cardinality(keys) >= 1 or estado in ('concluido', 'sem_linhas'))             -- D-M9-25b
);
-- D-M9-25b (decisão: Phil): `keys` guarda ids de espectador (F2) só enquanto o alvo está aberto; ao concluir, esvazia e guarda a contagem.
create or replace function public.obs_archive_item_targets_esvazia_keys() returns trigger language plpgsql set search_path = '' as $f$
begin
  if new.estado in ('concluido', 'sem_linhas') and cardinality(new.keys) > 0 then
    new.keys_n := cardinality(new.keys); new.keys := '{}';
  end if;
  return new;
end $f$;
drop trigger if exists obs_archive_item_targets_esvazia_keys on public.obs_archive_item_targets;
create trigger obs_archive_item_targets_esvazia_keys before insert or update on public.obs_archive_item_targets for each row execute function public.obs_archive_item_targets_esvazia_keys();
create index if not exists idx_oait_item on public.obs_archive_item_targets (site_id, item_id);
create index if not exists idx_oait_open on public.obs_archive_item_targets (site_id, channel_ref) where done_at is null;
create index if not exists idx_oait_refs on public.obs_archive_item_targets using gin (item_refs) where done_at is null;

-- A prova de ausência (D-M9-8): o que o site quer ver sumir e o que o copiador e o conferir-b2 disseram. Junções tipadas (Yannis I11).
create table if not exists public.obs_archive_absence (
  id bigint generated always as identity primary key,
  site_id uuid not null,
  alvo text not null check (alvo ~ '^(?:canal:[0-9a-f-]{36}|alvo:[1-9][0-9]{0,18}|antiga:[0-9a-f-]{36})$'),
  canal_ref text check (canal_ref ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  alvo_id bigint,
  unidade_id uuid,
  filho text not null check (filho in ('numerico', 'texto')),
  prefixo text not null check (prefixo ~ '^[A-Za-z0-9_][A-Za-z0-9._/-]*$' and length(prefixo) <= 300 and prefixo !~ '(^|/)\.\.?(/|$)'),
  e_prefixo boolean not null,                            -- true: diretório do canal; false: arquivo exato
  sha256 text check (sha256 ~ '^[0-9a-f]{64}$'),
  nova_caminho text, nova_sha256 text check (nova_sha256 ~ '^[0-9a-f]{64}$'),
  liberado_em timestamptz, encerrada_at timestamptz,
  nas_absent_first_at timestamptz, nas_absent_at timestamptz, nas_last_absent_at timestamptz, nas_present_at timestamptz,
  snap_absent_at timestamptz, snap_oldest date, snap_checked_at timestamptz,
  b2_absent_at timestamptz, b2_present_at timestamptz, b2_checked_at timestamptz, b2_nomes text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (site_id, alvo, filho, prefixo),
  check (e_prefixo or sha256 is not null),
  check ((nova_caminho is null) = (nova_sha256 is null)),
  check ((alvo like 'canal:%' and canal_ref is not null and alvo_id is null and unidade_id is null)
      or (alvo like 'alvo:%' and alvo_id is not null and canal_ref is null and unidade_id is null)
      or (alvo like 'antiga:%' and unidade_id is not null and canal_ref is null and alvo_id is null)),
  check (nas_absent_at is null or nas_absent_first_at is not null),
  check (snap_absent_at is null or nas_absent_at is not null),
  check (b2_absent_at is null or snap_absent_at is not null)
);
create index if not exists idx_oaa_abertas on public.obs_archive_absence (site_id, canal_ref) where encerrada_at is null;
create index if not exists idx_oaa_alvo on public.obs_archive_absence (site_id, alvo_id) where encerrada_at is null;
create index if not exists idx_oaa_unidade on public.obs_archive_absence (site_id, unidade_id) where encerrada_at is null;

-- O interruptor (D-M9-20): desligado, o site manda prefixos_ausentes = [] e o kit antigo segue verde.
create table if not exists public.obs_archive_m9_interruptor (
  site_id uuid primary key,
  ligado boolean not null default false,
  ligado_em timestamptz, ligado_por text
);

do $$ declare t text; begin
  foreach t in array array['obs_archive_item_targets', 'obs_archive_absence', 'obs_archive_m9_interruptor'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_leitura', t);
    execute format('create policy %I on public.%I for select using (public.can_edit_site(site_id))', t || '_leitura', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('revoke insert, update, delete, truncate, references, trigger on public.%I from service_role', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;

create or replace function public.obs_archive_m9_ligado(p_site uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select i.ligado from public.obs_archive_m9_interruptor i where i.site_id = p_site), false)
$$;
revoke all on function public.obs_archive_m9_ligado(uuid) from public, anon, authenticated, service_role;

-- Só o dono, pelo SQL do painel (postgres); nenhuma role de API chama.
create or replace function public.obs_archive_m9_ligar(p_site uuid, p_ligar boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if p_ligar and not public.obs_archive_m9_captura_presente() then
    raise exception 'captura_ausente' using errcode = 'P0001';
  end if;
  insert into public.obs_archive_m9_interruptor (site_id, ligado, ligado_em, ligado_por)
  values (p_site, p_ligar, now(), current_user)
  on conflict (site_id) do update set ligado = excluded.ligado, ligado_em = excluded.ligado_em, ligado_por = excluded.ligado_por;
  return p_ligar;
end $$;
revoke all on function public.obs_archive_m9_ligar(uuid, boolean) from public, anon, authenticated, service_role;

-- Mês fora do banco: o seal recalcularia days_* da tabela online (zeraria). Redundante se a M3b aceitar o pedido opcional (Yannis I10).
create or replace function public.obs_archive_congela_dias() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.detached_at is not null or old.dropped_at is not null then
    new.days_measured := old.days_measured;
    new.days_in_month := old.days_in_month;
  end if;
  return new;
end $$;
revoke all on function public.obs_archive_congela_dias() from public, anon, authenticated, service_role;
drop trigger if exists obs_archive_congela_dias on public.obs_archive_months;
create trigger obs_archive_congela_dias before update on public.obs_archive_months
  for each row execute function public.obs_archive_congela_dias();

-- M9 PARTE 2: a lista do item antes da cascata (esperadas, captura, bandeira por chave, guarda do record, injeção na E9)

-- Quantas linhas do item a unidade tem no online agora. Nulo = não conferível (unidade defasada do online, filtro desconhecido).
create or replace function public.obs_archive_item_esperadas(p_site uuid, p_class text, p_table text, p_channel uuid, p_month date,
                                                             p_kind text, p_keys text[], p_unit_rows bigint)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  v_src record; v_prox date := (p_month + interval '1 month')::date;
  v_ini timestamptz := (p_month::text || ' 00:00:00-03')::timestamptz;
  v_fim timestamptz := ((p_month + interval '1 month')::date::text || ' 00:00:00-03')::timestamptz;
  v_filtro text; v_total bigint; v_item bigint;
begin
  select * into v_src from public.obs_archive_unit_source(p_class, p_table);
  v_filtro := case
    when p_kind = 'comentario' and p_table = 'competitor_video_comments' then 't.id::text = any($7)'
    when p_kind = 'comentario' and p_table = 'competitor_video_comment_marks' then 't.comment_id::text = any($7)'
    when p_kind = 'video' and p_table = 'competitor_video_comment_marks' then 'k.video_id::text = any($7)'
    when p_kind = 'video' then 't.video_id::text = any($7)'
  end;
  if v_filtro is null then return null; end if;
  execute 'select count(*) ' || v_src.from_where into v_total using p_site, p_channel, p_month, v_ini, v_fim, v_prox, p_keys;
  if v_total is distinct from p_unit_rows then return null; end if;      -- unidade defasada do online
  execute 'select count(*) ' || v_src.from_where || ' and ' || v_filtro into v_item using p_site, p_channel, p_month, v_ini, v_fim, v_prox, p_keys;
  return v_item;
end $$;
revoke all on function public.obs_archive_item_esperadas(uuid, text, text, uuid, date, text, text[], bigint) from public, anon, authenticated, service_role;

create or replace function public.obs_archive_item_capture(p_site uuid, p_kind text, p_channel uuid, p_refs text[], p_keys text[])
returns integer language plpgsql security definer set search_path = '' as $$
declare
  r record; u record; t record; v_fora boolean; v_bloq boolean; v_esp bigint; v_fuse boolean; v_n integer := 0;
begin
  if p_kind not in ('video', 'comentario') or coalesce(cardinality(p_refs), 0) = 0 or coalesce(cardinality(p_keys), 0) = 0 then return 0; end if;
  -- canal que vai inteiro: o arquivo sai pelo caminho do canal (Tarefa 4), não por item
  if exists (select 1 from public.obs_archive_channel_removals cr
              where cr.site_id = p_site and cr.channel_ref = p_channel::text and cr.archive_decision = 'apagar') then return 0; end if;
  -- mês entre destacado e descartado: o online já não tem as linhas e a unidade antiga é a única; refazer agora perderia o item
  if exists (select 1 from public.obs_archive_units x
               join public.obs_archive_months m on m.site_id = x.site_id and m.class = x.class and m.table_name = x.table_name and m.month = x.month
              where x.site_id = p_site and x.channel_ref = p_channel::text and x.class <> 'ensaio' and (p_kind = 'video' or x.class = 'texto')
                and x.lost_at is null and x.purged_at is null and m.detached_at is not null and m.dropped_at is null) then
    raise exception 'mes_destacado_em_transito' using errcode = 'P0001';
  end if;
  for r in
    select distinct x.class, x.table_name, x.month from public.obs_archive_units x
     where x.site_id = p_site and x.channel_ref = p_channel::text and x.class <> 'ensaio'
       and (p_kind = 'video' or (x.class = 'texto' and x.table_name in ('competitor_video_comments', 'competitor_video_comment_marks')))
       and x.lost_at is null and x.purged_at is null
     order by 1, 2, 3
  loop
    -- a mesma trava do record_core (kind 'unidade'), em ordem estável
    perform pg_advisory_xact_lock(hashtextextended(p_site::text || '|unidade|' || r.class || '|' || r.table_name || '|' || p_channel::text || '|' || r.month::text, 0));
    select * into u from public.obs_archive_units x
     where x.site_id = p_site and x.channel_ref = p_channel::text and x.class = r.class and x.table_name = r.table_name and x.month = r.month
       and x.lost_at is null and x.purged_at is null
     order by x.version desc limit 1;
    if u.id is null or u.row_count = 0 then continue; end if;               -- unidade mais nova vazia: sem alvo (limite declarado)
    select coalesce(m.dropped_at is not null, false) into v_fora from public.obs_archive_months m
     where m.site_id = p_site and m.class = r.class and m.table_name = r.table_name and m.month = r.month;
    v_fora := coalesce(v_fora, false);
    select * into t from public.obs_archive_item_targets g
     where g.site_id = p_site and g.class = r.class and g.table_name = r.table_name and g.channel_ref = p_channel::text and g.month = r.month and g.item_kind = p_kind
     order by g.geracao desc limit 1;
    v_fuse := t.id is not null and t.estado in ('copiar', 'bloqueado');
    v_bloq := false;
    if r.class = 'video_antigo' then
      if p_kind <> 'video' or not exists (
           select 1 from public.competitor_videos v
            where v.id::text = any(p_keys)
              and v.archive_frozen_at >= (r.month::text || ' 00:00:00-03')::timestamptz
              and v.archive_frozen_at < ((r.month + interval '1 month')::date::text || ' 00:00:00-03')::timestamptz) then continue; end if;
      v_bloq := true; v_esp := null;                                        -- até a M10b (D-M9-14)
    elsif v_fora or (v_fuse and t.esperadas is null) then
      v_esp := null;
    else
      -- na fusão, as linhas do item anterior já saíram do online: descontar do row_count da unidade
      v_esp := public.obs_archive_item_esperadas(p_site, r.class, r.table_name, p_channel, r.month, p_kind, p_keys,
                                                 u.row_count - case when v_fuse then coalesce(t.esperadas, 0) else 0 end);
      if v_esp = 0 then continue; end if;                                   -- o item não está nesta unidade
    end if;
    if v_fuse then
      update public.obs_archive_item_targets g
         set keys = (select array_agg(distinct k order by k) from unnest(g.keys || p_keys) k),
             item_refs = (select array_agg(distinct k order by k) from unnest(g.item_refs || p_refs) k),
             esperadas = case when v_esp is null or g.esperadas is null then null else g.esperadas + v_esp end,
             updated_at = now()
       where g.id = t.id;
    else
      insert into public.obs_archive_item_targets (site_id, item_kind, item_refs, class, table_name, channel_ref, month, geracao, keys, esperadas,
                                                   from_unit_id, from_version, estado, motivo)
      values (p_site, p_kind, (select array_agg(distinct k order by k) from unnest(p_refs) k), r.class, r.table_name, p_channel::text, r.month,
              coalesce(t.geracao, 0) + 1, (select array_agg(distinct k order by k) from unnest(p_keys) k), v_esp, u.id, u.version,
              case when v_bloq then 'bloqueado' else 'copiar' end, case when v_bloq then 'depende_m10b' end);
    end if;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
revoke all on function public.obs_archive_item_capture(uuid, text, uuid, text[], text[]) from public, anon, authenticated;
-- As funções da E9 são security invoker e rodam como service_role (supabase.rpc da server action): sem este grant "apagar" quebra (Phil C1).
grant execute on function public.obs_archive_item_capture(uuid, text, uuid, text[], text[]) to service_role;

create or replace function public.obs_archive_m9_captura_presente() returns boolean
language sql stable security definer set search_path = '' as $$
  select count(*) = 2 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in ('competitor_video_purge', 'competitor_comments_purge')
     and position('obs_archive_item_capture' in p.prosrc) > 0
$$;
revoke all on function public.obs_archive_m9_captura_presente() from public, anon, authenticated, service_role;

-- A bandeira archive_pending, derivada por chave (D-M9-2): ligada quando existe alvo aberto do mesmo tipo com a chave.
create or replace function public.obs_archive_flag_pending() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.kind in ('video', 'comentario') then
    new.archive_pending := exists (select 1 from public.obs_archive_item_targets g
                                    where g.site_id = new.site_id and g.item_kind = new.kind and g.done_at is null
                                      and new.youtube_id = any(g.item_refs));
  end if;
  return new;
end $$;
revoke all on function public.obs_archive_flag_pending() from public, anon, authenticated, service_role;
drop trigger if exists obs_archive_flag_pending on public.competitor_removed_items;
create trigger obs_archive_flag_pending before insert or update of rows_deleted, purge_count on public.competitor_removed_items
  for each row execute function public.obs_archive_flag_pending();

create or replace function public.obs_archive_link_item() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.kind in ('video', 'comentario') then
    update public.obs_archive_item_targets g set item_id = least(coalesce(g.item_id, new.id), new.id), updated_at = now()
     where g.site_id = new.site_id and g.item_kind = new.kind and g.done_at is null and new.youtube_id = any(g.item_refs)
       and g.item_id is distinct from least(coalesce(g.item_id, new.id), new.id);
  end if;
  return null;
end $$;
revoke all on function public.obs_archive_link_item() from public, anon, authenticated, service_role;
drop trigger if exists obs_archive_link_item on public.competitor_removed_items;
create trigger obs_archive_link_item after insert or update of rows_deleted, purge_count on public.competitor_removed_items
  for each row execute function public.obs_archive_link_item();

-- A guarda do record (D-M9-3): a rota de exportação comum não grava versão nova de um grupo que o expurgo está refazendo.
-- Substitui a casca de uma linha da M3b (m3b.sql:724-731); o expurgo chama record_core direto, com origem 'expurgo'.
create or replace function public.obs_archive_record(p_site uuid, p_kind text, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_class text := p_payload->>'classe'; v_table text := p_payload->>'tabela'; v_canal text := p_payload->>'canal'; v_mes text := p_payload->>'mes';
begin
  if p_kind in ('unidade', 'resumo') and v_class is not null and v_canal is not null and v_mes is not null then
    perform pg_advisory_xact_lock(hashtextextended(p_site::text || '|' || p_kind || '|' || coalesce(v_class, '') || '|' || coalesce(v_table, '')
                                                   || '|' || v_canal || '|' || v_mes, 0));
    if exists (select 1 from public.obs_archive_item_targets g
                where g.site_id = p_site and g.class = v_class and g.channel_ref = v_canal and g.month = v_mes::date
                  and g.estado in ('copiar', 'aguardando_nova', 'bloqueado')
                  and (p_kind = 'resumo' or g.table_name = v_table)) then
      return jsonb_build_object('status', 'expurgo_em_curso');
    end if;
  end if;
  return public.obs_archive_record_core(p_site, p_kind, p_payload, null);
end $$;
revoke all on function public.obs_archive_record(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.obs_archive_record(uuid, text, jsonb) to service_role;

-- Rodada 0.8 (Phil M9-N1): as funções da E9 são security invoker e rodam como service_role; as yt_watch_* só revogam delete de authenticated/anon, mas o
-- grant explícito (idempotente) fecha a dúvida sem depender do default do Supabase. As tabelas existem a partir de origin/staging (20261018000005).
do $g$ begin
  if to_regclass('public.yt_watch_readings') is not null and to_regclass('public.yt_watch_thumbs') is not null and to_regclass('public.yt_watch_alvos') is not null then
    grant delete on public.yt_watch_alvos, public.yt_watch_thumbs, public.yt_watch_readings to service_role;
  end if;
end $g$;

-- Rodada 0.8 (Yannis N7-3, D-M9-26): a recusa mora no SQL e lê o BANCO (não o env). Inerte quando a M9 é ligada ou quando a M3b não exportou nada.
create or replace function public.obs_archive_m9_pronto(p_site uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  -- Phil M1 (mantido da recusa da M3b): volatile + lock share fecham a corrida do 1º plano (SHARE conflita com o ROW EXCLUSIVE do upsert do plano).
  lock table public.obs_archive_switch in share mode;
  -- Emenda 24/10 (Phil, janela): "a M3b tocou o site" = unidade gravada OU switch com first_month_at/armed_at (monótonos, nascem antes da 1ª leitura). NÃO usar disarmed_at.
  if (   exists (select 1 from public.obs_archive_units x where x.site_id = p_site)
      or exists (select 1 from public.obs_archive_switch s where s.site_id = p_site
                  and (s.first_month_at is not null or s.armed_at is not null)) )
     and not public.obs_archive_m9_ligado(p_site) then
    raise exception 'm9_desligada' using errcode = 'P0001', hint = 'o apagar do arquivo ainda não está ligado; espere';
  end if;
end $$;
revoke all on function public.obs_archive_m9_pronto(uuid) from public, anon, authenticated;
grant execute on function public.obs_archive_m9_pronto(uuid) to service_role;  -- as funções da E9 são invoker e rodam como service_role

-- A injeção na E9 (única por texto, fail-closed): md5 do corpo conferido no dia (Tarefa 0, Passo 2), âncora única, resultado conferido.
-- Rodada 0.7 (D-M9-25, decidida pelo dono em 23/10): TRÊS funções e três tipos de efeito (0.8: `recusa` = D-M9-26, só vídeo e comentários, injetado ANTES da captura; a ordem da lista `values` é a ordem no corpo). `captura` = a lista do item (D-M9-1); `watch` = a limpeza de
-- yt_watch_readings/thumbs/alvos. O marcador "já injetada" é UM POR FUNÇÃO E POR EFEITO (a channel_purge não tem obs_archive_item_capture; um só
-- marcador pularia ou duplicaria). O md5 só vale para o corpo ainda não tocado pela M9 (nenhum marcador presente); o corpo parcialmente injetado
-- (reaplicação) pula a conferência de md5 e aplica só o efeito que falta. No canal, `v_yt` é o id do CANAL: a chave da watch é array_agg(video_id).
do $m9$
declare
  r record; e record; v_def text; v_md5 text; v_pos integer; v_n integer; v_tocada boolean; v_mudou boolean;
begin
  if to_regclass('public.yt_watch_readings') is null or to_regclass('public.yt_watch_thumbs') is null or to_regclass('public.yt_watch_alvos') is null then
    raise exception 'm9_sem_watch' using errcode = 'P0001', hint = 'a migration 20261018000005 (A5 S4) vem antes';
  end if;
  for r in select * from (values
    ('competitor_video_purge', '<<MD5_VIDEO>>'),
    ('competitor_comments_purge', '<<MD5_COMENTARIOS>>'),
    ('competitor_channel_purge', '<<MD5_CANAL>>')
  ) as t(nome, md5_esperado)
  loop
    select pg_get_functiondef(p.oid), md5(p.prosrc) into v_def, v_md5 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = r.nome;
    if v_def is null then raise exception 'm9_sem_e9' using errcode = 'P0001', detail = r.nome; end if;
    v_tocada := position('obs_archive_item_capture' in v_def) > 0 or position('yt_watch_readings' in v_def) > 0;   -- a recusa da M3b (obs_archive_m9_pronto) não conta: o md5 de partida já a inclui
    v_mudou := false;
    for e in select * from (values
      ('competitor_video_purge', 'obs_archive_m9_pronto', 'delete from public.competitor_videos v where v.id = p_video;',
       'perform public.obs_archive_m9_pronto(p_site);'),
      ('competitor_video_purge', 'obs_archive_item_capture', 'delete from public.competitor_videos v where v.id = p_video;',
       'perform public.obs_archive_item_capture(p_site, ''video'', v_channel, array[v_yt], array[p_video::text]);'),
      ('competitor_video_purge', 'yt_watch_readings', 'delete from public.competitor_videos v where v.id = p_video;',
       $w$  with d as (delete from public.yt_watch_readings w where w.site_id = p_site and w.youtube_video_id = v_yt and not exists (select 1 from public.competitor_videos o join public.competitor_channels oc on oc.id = o.competitor_channel_id where oc.site_id = p_site and o.video_id = w.youtube_video_id and o.id <> p_video) and not exists (select 1 from public.yt_watch_alvos x where x.site_id = p_site and x.youtube_video_id = w.youtube_video_id and x.tipo <> 'concorrente') returning 1)
  select v_rows || jsonb_build_object('yt_watch_readings', count(*)) into v_rows from d;
  with d as (delete from public.yt_watch_thumbs w where w.site_id = p_site and w.youtube_video_id = v_yt and not exists (select 1 from public.competitor_videos o join public.competitor_channels oc on oc.id = o.competitor_channel_id where oc.site_id = p_site and o.video_id = w.youtube_video_id and o.id <> p_video) and not exists (select 1 from public.yt_watch_alvos x where x.site_id = p_site and x.youtube_video_id = w.youtube_video_id and x.tipo <> 'concorrente') returning 1)
  select v_rows || jsonb_build_object('yt_watch_thumbs', count(*)) into v_rows from d;
  with d as (delete from public.yt_watch_alvos w where w.site_id = p_site and w.youtube_video_id = v_yt and not exists (select 1 from public.competitor_videos o join public.competitor_channels oc on oc.id = o.competitor_channel_id where oc.site_id = p_site and o.video_id = w.youtube_video_id and o.id <> p_video) and not exists (select 1 from public.yt_watch_alvos x where x.site_id = p_site and x.youtube_video_id = w.youtube_video_id and x.tipo <> 'concorrente') returning 1)
  select v_rows || jsonb_build_object('yt_watch_alvos', count(*)) into v_rows from d;
$w$),
      ('competitor_comments_purge', 'obs_archive_m9_pronto', 'insert into public.competitor_removed_items as r',
       'perform public.obs_archive_m9_pronto(p_site);'),
      ('competitor_comments_purge', 'obs_archive_item_capture', 'insert into public.competitor_removed_items as r',
       'perform public.obs_archive_item_capture(p_site, ''comentario'', p_channel, array(select k.youtube_comment_id::text from public.competitor_video_comments k where k.id = any(v_todos) and (k.parent_id is null or k.is_creator)), array(select x::text from unnest(v_todos) x));'),
      ('competitor_channel_purge', 'yt_watch_readings', 'if to_regprocedure(''public.competitor_channel_remove(uuid,uuid,text,text,uuid)'') is not null then',
       $w$  with d as (delete from public.yt_watch_readings w where w.site_id = p_site and w.youtube_video_id = any(array(select v.video_id from public.competitor_videos v where v.competitor_channel_id = p_channel)) and not exists (select 1 from public.competitor_videos o join public.competitor_channels oc on oc.id = o.competitor_channel_id where oc.site_id = p_site and o.video_id = w.youtube_video_id and o.competitor_channel_id <> p_channel) and not exists (select 1 from public.yt_watch_alvos x where x.site_id = p_site and x.youtube_video_id = w.youtube_video_id and x.tipo <> 'concorrente') returning 1)
  select v_rows || jsonb_build_object('yt_watch_readings', count(*)) into v_rows from d;
  with d as (delete from public.yt_watch_thumbs w where w.site_id = p_site and w.youtube_video_id = any(array(select v.video_id from public.competitor_videos v where v.competitor_channel_id = p_channel)) and not exists (select 1 from public.competitor_videos o join public.competitor_channels oc on oc.id = o.competitor_channel_id where oc.site_id = p_site and o.video_id = w.youtube_video_id and o.competitor_channel_id <> p_channel) and not exists (select 1 from public.yt_watch_alvos x where x.site_id = p_site and x.youtube_video_id = w.youtube_video_id and x.tipo <> 'concorrente') returning 1)
  select v_rows || jsonb_build_object('yt_watch_thumbs', count(*)) into v_rows from d;
  with d as (delete from public.yt_watch_alvos w where w.site_id = p_site and w.youtube_video_id = any(array(select v.video_id from public.competitor_videos v where v.competitor_channel_id = p_channel)) and not exists (select 1 from public.competitor_videos o join public.competitor_channels oc on oc.id = o.competitor_channel_id where oc.site_id = p_site and o.video_id = w.youtube_video_id and o.competitor_channel_id <> p_channel) and not exists (select 1 from public.yt_watch_alvos x where x.site_id = p_site and x.youtube_video_id = w.youtube_video_id and x.tipo <> 'concorrente') returning 1)
  select v_rows || jsonb_build_object('yt_watch_alvos', count(*)) into v_rows from d;
$w$)
    ) as x(nome, marcador, ancora, texto) where x.nome = r.nome
    loop
      if position(e.marcador in v_def) > 0 then continue; end if;                          -- este efeito já está injetado
      if not v_tocada and not v_mudou and v_md5 <> r.md5_esperado then                     -- corpo virgem: confere o md5 antes do 1º efeito
        raise exception 'm9_e9_mudou' using errcode = 'P0001', detail = r.nome || ' md5 ' || v_md5;
      end if;
      v_n := (length(v_def) - length(replace(v_def, e.ancora, ''))) / length(e.ancora);
      if v_n <> 1 then raise exception 'm9_e9_ancora' using errcode = 'P0001', detail = r.nome || ' ' || e.marcador; end if;
      v_pos := position(e.ancora in v_def);                                                 -- a única ocorrência
      v_def := left(v_def, v_pos - 1) || e.texto || E'\n  ' || substr(v_def, v_pos);
      if position(e.marcador in v_def) = 0 then raise exception 'm9_e9_ancora' using errcode = 'P0001', detail = r.nome || ' ' || e.marcador; end if;
      v_mudou := true;
    end loop;
    if v_mudou then execute v_def; end if;
  end loop;
end $m9$;
