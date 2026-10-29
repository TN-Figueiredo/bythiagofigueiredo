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
-- antigas_open e o "nunca duplica" procuram por prefixo (Phil M2)
create index if not exists idx_oaa_prefixo on public.obs_archive_absence (site_id, prefixo);

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
     and position('public.obs_archive_item_capture(' in p.prosrc) > 0
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
    ('competitor_video_purge', 'ef1c5f6ec42164c59b9b0652edc88cbc'),
    ('competitor_comments_purge', '07cd637de2ded4cc0f5e2ebcb71b2e22'),
    ('competitor_channel_purge', '02d2a5b50a930a06ff2bc523226a0697')
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

-- M9 PARTE 3: abrir, registrar, bloquear e desbloquear o expurgo (rota C14)

create or replace function public.obs_archive_caminho_unidade(p_class text, p_ref text, p_table text, p_month date, p_ver integer, p_parte integer default null)
returns text language sql immutable set search_path = '' as $$
  select p_class || '/canais/' || p_ref || '/' || p_table || '/' || to_char(p_month, 'YYYY-MM') || '.v' || p_ver
         || case when p_parte is null then '' else '.p' || lpad(p_parte::text, 2, '0') end || '.csv.gz'
$$;
revoke all on function public.obs_archive_caminho_unidade(text, text, text, date, integer, integer) from public, anon, authenticated, service_role;

-- Arquivos de uma unidade: um (parts = 1) ou um por parte. Unidade vazia não tem arquivo.
create or replace function public.obs_archive_arquivos_da_unidade(p_unit uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(f.o order by f.p), '[]'::jsonb) from (
    select 1 as p, jsonb_build_object('caminho', public.obs_archive_caminho_unidade(u.class, u.channel_ref, u.table_name, u.month, u.version), 'sha256', u.sha256_bytes, 'parte', 1) as o
      from public.obs_archive_units u where u.id = p_unit and u.parts = 1 and u.row_count > 0
    union all
    select pt.part, jsonb_build_object('caminho', public.obs_archive_caminho_unidade(u.class, u.channel_ref, u.table_name, u.month, u.version, pt.part), 'sha256', pt.sha256_bytes, 'parte', pt.part)
      from public.obs_archive_units u join public.obs_archive_unit_parts pt on pt.unit_id = u.id where u.id = p_unit and u.parts > 1 and u.row_count > 0
  ) f
$$;
revoke all on function public.obs_archive_arquivos_da_unidade(uuid) from public, anon, authenticated, service_role;

-- As unidades correntes do grupo (classe, canal, mês): a maior versão por tabela, nem perdida nem purgada.
create or replace function public.obs_archive_cur_group(p_site uuid, p_class text, p_channel text, p_month date)
returns setof public.obs_archive_units language sql stable security definer set search_path = '' as $$
  select distinct on (x.table_name) x.* from public.obs_archive_units x
   where x.site_id = p_site and x.class = p_class and x.channel_ref = p_channel and x.month = p_month and x.lost_at is null and x.purged_at is null
   order by x.table_name, x.version desc
$$;
revoke all on function public.obs_archive_cur_group(uuid, text, text, date) from public, anon, authenticated, service_role;

-- Pronto para refazer: toda corrente com linhas está recebida e o último resumo está recebido (ou vazio). Também usado pelo owner_pending.
create or replace function public.obs_archive_grupo_pronto(p_site uuid, p_class text, p_channel text, p_month date) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from public.obs_archive_cur_group(p_site, p_class, p_channel, p_month) c where c.row_count > 0 and c.received_at is null)
     and coalesce((select s.empty or s.received_at is not null from public.obs_archive_summaries s
                    where s.site_id = p_site and s.class = p_class and s.channel_ref = p_channel and s.month = p_month and s.lost_at is null and s.purged_at is null
                    order by s.version desc limit 1), true)
$$;
revoke all on function public.obs_archive_grupo_pronto(uuid, text, text, date) from public, anon, authenticated, service_role;

create or replace function public.obs_archive_expurgo_open(p_site uuid, p_item_id bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  a record; g record; c record; s record; v_grupos jsonb := '[]'::jsonb; v_esperando integer := 0; v_alvos jsonb; v_outras jsonb; v_vazias jsonb; v_resumo jsonb;
  v_fora boolean;
begin
  if not exists (select 1 from public.obs_archive_item_targets t where t.site_id = p_site and t.item_id = p_item_id) then
    raise exception 'item_desconhecido' using errcode = 'P0001';
  end if;
  -- rebase: alvo em copiar cuja origem deixou de ser a corrente
  for a in select * from public.obs_archive_item_targets t where t.site_id = p_site and t.item_id = p_item_id and t.estado = 'copiar' order by t.id for update loop
    select * into c from public.obs_archive_cur_group(p_site, a.class, a.channel_ref, a.month) x where x.table_name = a.table_name;
    if c.id is not null and c.id = a.from_unit_id then continue; end if;
    if c.id is null or c.row_count = 0 then
      update public.obs_archive_item_targets set estado = 'sem_linhas', done_at = now(), updated_at = now() where id = a.id;
    elsif c.received_at is not null then
      update public.obs_archive_item_targets set from_unit_id = c.id, from_version = c.version, updated_at = now() where id = a.id;
    end if;
  end loop;
  for g in select distinct t.class, t.channel_ref, t.month from public.obs_archive_item_targets t
            where t.site_id = p_site and t.item_id = p_item_id and t.estado = 'copiar' order by 1, 2, 3 loop
    -- todo alvo copiar do grupo (deste item) precisa estar na corrente e recebida
    if not public.obs_archive_grupo_pronto(p_site, g.class, g.channel_ref, g.month)
       or exists (select 1 from public.obs_archive_item_targets t
                   where t.site_id = p_site and t.item_id = p_item_id and t.estado = 'copiar' and t.class = g.class and t.channel_ref = g.channel_ref and t.month = g.month
                     and not exists (select 1 from public.obs_archive_cur_group(p_site, g.class, g.channel_ref, g.month) x
                                      where x.id = t.from_unit_id and x.received_at is not null)) then
      v_esperando := v_esperando + 1; continue;
    end if;
    select coalesce(jsonb_agg(jsonb_build_object('alvo_id', t.id, 'tabela', t.table_name, 'versao', u.version, 'linhas', u.row_count, 'soma', u.control_sum::text,
             'coluna_controle', pol.control_column, 'schema_fp', u.schema_fp, 'hash_conteudo', u.hash_conteudo, 'esperadas', t.esperadas,
             'chaves', to_jsonb(t.keys), 'refs', to_jsonb(t.item_refs), 'arquivos', public.obs_archive_arquivos_da_unidade(u.id)) order by t.table_name), '[]'::jsonb)
      into v_alvos
      from public.obs_archive_item_targets t join public.obs_archive_units u on u.id = t.from_unit_id
      left join public.obs_archive_policy() pol on pol.class = t.class and pol.table_name = t.table_name
     where t.site_id = p_site and t.item_id = p_item_id and t.estado = 'copiar' and t.class = g.class and t.channel_ref = g.channel_ref and t.month = g.month;
    select coalesce(jsonb_agg(jsonb_build_object('tabela', x.table_name, 'unidade_id', x.id, 'versao', x.version, 'linhas', x.row_count, 'hash_conteudo', x.hash_conteudo,
             'arquivos', public.obs_archive_arquivos_da_unidade(x.id)) order by x.table_name), '[]'::jsonb) into v_outras
      from public.obs_archive_cur_group(p_site, g.class, g.channel_ref, g.month) x
     where x.row_count > 0 and not exists (select 1 from public.obs_archive_item_targets t
                                            where t.site_id = p_site and t.item_id = p_item_id and t.estado = 'copiar' and t.class = g.class and t.channel_ref = g.channel_ref
                                              and t.month = g.month and t.table_name = x.table_name);
    select coalesce(jsonb_agg(jsonb_build_object('tabela', x.table_name, 'hash_conteudo', x.hash_conteudo) order by x.table_name), '[]'::jsonb) into v_vazias
      from public.obs_archive_cur_group(p_site, g.class, g.channel_ref, g.month) x where x.row_count = 0;
    select * into s from public.obs_archive_summaries z
     where z.site_id = p_site and z.class = g.class and z.channel_ref = g.channel_ref and z.month = g.month and z.lost_at is null and z.purged_at is null order by z.version desc limit 1;
    v_resumo := case when s.id is null then null else jsonb_build_object('versao', s.version, 'canal', s.canal_sha256, 'video', s.video_sha256) end;
    -- fora do banco = a tabela de CADA alvo do grupo está fora (nunca "qualquer linha do mês"; conserto Yannis I-1)
    select coalesce(bool_and(exists (select 1 from public.obs_archive_months m
                                      where m.site_id = p_site and m.class = g.class and m.table_name = t.table_name and m.month = g.month
                                        and (m.dropped_at is not null or m.detached_at is not null))), false) into v_fora
      from public.obs_archive_item_targets t
     where t.site_id = p_site and t.item_id = p_item_id and t.estado = 'copiar' and t.class = g.class and t.channel_ref = g.channel_ref and t.month = g.month;
    v_grupos := v_grupos || jsonb_build_object('classe', g.class, 'canal', g.channel_ref, 'mes', to_char(g.month, 'YYYY-MM'),
      'filho', (select p.filho from public.obs_archive_policy() p where p.class = g.class limit 1),
      'alvos', v_alvos, 'outras', v_outras, 'vazias', v_vazias, 'resumo', v_resumo,
      'mes_online', not coalesce(v_fora, false), 'dias_do_mes', extract(day from (g.month + interval '1 month' - interval '1 day'))::int);
  end loop;
  return jsonb_build_object('grupos', v_grupos, 'esperando', v_esperando);
end $$;
revoke all on function public.obs_archive_expurgo_open(uuid, bigint) from public, anon, authenticated;
grant execute on function public.obs_archive_expurgo_open(uuid, bigint) to service_role;

create or replace function public.obs_archive_expurgo_record(p_site uuid, p_item_id bigint, p_grupo jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_class text := p_grupo->>'classe'; v_canal text := p_grupo->>'canal'; v_mes date := (p_grupo->>'mes' || '-01')::date;
  v_corpo jsonb := p_grupo->'alvos'; v_res jsonb := p_grupo->'resumo';
  b jsonb; a public.obs_archive_item_targets; c public.obs_archive_units; v_ids bigint[]; v_copiar bigint[]; v_fora boolean;
  v_rem bigint; v_novo bigint; v_saida jsonb := '[]'::jsonb; v_ret jsonb; v_uid uuid; v_ver integer; v_arq text;
  v_max integer; v_lidas text[]; v_correntes text[]; v_pol record; v_primeiro bigint; v_novas integer := 0; v_sid uuid; v_sver integer;
  v_nova_cam text; v_nova_sha text; w record; ps record; pap text;
begin
  if v_class is null or v_canal is null or v_mes is null or jsonb_typeof(v_corpo) <> 'array' then
    return jsonb_build_object('status', 'recusado', 'motivo', 'forma');
  end if;
  if not exists (select 1 from public.obs_archive_item_targets t where t.site_id = p_site and t.item_id = p_item_id) then
    raise exception 'item_desconhecido' using errcode = 'P0001';
  end if;
  -- as mesmas travas do record_core, em ordem de tabela, e a do resumo
  for b in select x from jsonb_array_elements(v_corpo) x order by x->>'tabela' loop
    select * into a from public.obs_archive_item_targets t where t.id = (b->>'alvo_id')::bigint and t.site_id = p_site;
    if a.id is null then return jsonb_build_object('status', 'recusado', 'motivo', 'alvo_de_outro_item', 'alvo_id', (b->>'alvo_id')::bigint); end if;
    perform pg_advisory_xact_lock(hashtextextended(p_site::text || '|unidade|' || a.class || '|' || a.table_name || '|' || a.channel_ref || '|' || a.month::text, 0));
  end loop;
  perform pg_advisory_xact_lock(hashtextextended(p_site::text || '|resumo|' || v_class || '||' || v_canal || '|' || v_mes::text, 0));
  select array_agg((x->>'alvo_id')::bigint order by (x->>'alvo_id')::bigint) into v_ids from jsonb_array_elements(v_corpo) x;
  -- 1. cada alvo é deste item e deste grupo, e está em copiar
  for a in select * from public.obs_archive_item_targets t where t.id = any(v_ids) and t.site_id = p_site order by t.id for update loop
    if a.item_id is distinct from p_item_id or a.class <> v_class or a.channel_ref <> v_canal or a.month <> v_mes then
      return jsonb_build_object('status', 'recusado', 'motivo', 'alvo_de_outro_item', 'alvo_id', a.id);
    end if;
    if a.estado <> 'copiar' then return jsonb_build_object('status', 'recusado', 'motivo', 'alvo_fora_de_copiar', 'alvo_id', a.id); end if;
  end loop;
  if (select count(*) from public.obs_archive_item_targets t where t.id = any(v_ids) and t.site_id = p_site) <> coalesce(cardinality(v_ids), 0) then
    return jsonb_build_object('status', 'recusado', 'motivo', 'alvo_de_outro_item');
  end if;
  -- 2. o corpo cobre todos os alvos copiar do item neste grupo
  select array_agg(t.id order by t.id) into v_copiar from public.obs_archive_item_targets t
   where t.site_id = p_site and t.item_id = p_item_id and t.estado = 'copiar' and t.class = v_class and t.channel_ref = v_canal and t.month = v_mes;
  if v_copiar is distinct from v_ids then return jsonb_build_object('status', 'recusado', 'motivo', 'grupo_incompleto'); end if;
  -- 3. a base: cada origem ainda é a corrente e está recebida
  for a in select * from public.obs_archive_item_targets t where t.id = any(v_ids) order by t.id loop
    select * into c from public.obs_archive_cur_group(p_site, a.class, a.channel_ref, a.month) x where x.table_name = a.table_name;
    if c.id is distinct from a.from_unit_id or c.received_at is null then
      return jsonb_build_object('status', 'recusado', 'motivo', 'base_mudou', 'alvo_id', a.id);
    end if;
  end loop;
  -- 4. a contagem: antes de qualquer escrita
  for b in select x from jsonb_array_elements(v_corpo) x order by (x->>'alvo_id')::bigint loop
    select * into a from public.obs_archive_item_targets t where t.id = (b->>'alvo_id')::bigint;
    select * into c from public.obs_archive_units u where u.id = a.from_unit_id;
    v_rem := (b->>'removidas')::bigint;
    v_novo := (b->'unidade'->>'row_count')::bigint;
    -- a tabela DESTE alvo fora do banco (Yannis I-1): outra tabela da classe fora não conta
    select exists (select 1 from public.obs_archive_months m where m.site_id = p_site and m.class = v_class and m.table_name = a.table_name and m.month = v_mes
                    and (m.dropped_at is not null or m.detached_at is not null)) into v_fora;
    if v_rem is null or v_rem < 0 or (v_rem > 0 and b->'unidade' is null) then return jsonb_build_object('status', 'recusado', 'motivo', 'forma', 'alvo_id', a.id); end if;
    if (v_rem = 0 and (a.esperadas > 0 or (a.esperadas is null and not v_fora)))
       or (a.esperadas is not null and v_rem > a.esperadas)
       or (v_rem > 0 and v_novo is distinct from c.row_count - v_rem) then
      update public.obs_archive_item_targets set estado = 'bloqueado', motivo = 'contagem_divergente', updated_at = now() where id = a.id;
      return jsonb_build_object('status', 'recusado', 'motivo', 'contagem_divergente', 'alvo_id', a.id);
    end if;
    if v_rem > 0 then v_novas := v_novas + 1; end if;
  end loop;
  -- 5. o resumo (só quando houve unidade nova)
  if v_novas > 0 then
    if v_res is null or jsonb_typeof(v_res) <> 'object' then return jsonb_build_object('status', 'recusado', 'motivo', 'resumo_forma'); end if;
    select coalesce(max(s.version), 0) into v_max from public.obs_archive_summaries s where s.site_id = p_site and s.class = v_class and s.channel_ref = v_canal and s.month = v_mes;
    if (v_res->>'versao')::int is distinct from v_max + 1 then return jsonb_build_object('status', 'recusado', 'motivo', 'resumo_versao_mudou'); end if;
    if (v_res->>'vazio') is null or ((v_res->>'vazio')::boolean) <> (v_res->>'canal_sha256' is null)
       or (v_res->>'canal_sha256' is not null and v_res->>'canal_sha256' !~ '^[0-9a-f]{64}$') then
      return jsonb_build_object('status', 'recusado', 'motivo', 'resumo_forma');
    end if;
    select array_agg(x order by x) into v_lidas from jsonb_array_elements_text(coalesce(v_res->'tabelas_lidas', '[]'::jsonb)) x;
    select array_agg(x.table_name order by x.table_name) into v_correntes from public.obs_archive_cur_group(p_site, v_class, v_canal, v_mes) x where x.row_count > 0;
    if v_lidas is distinct from v_correntes then return jsonb_build_object('status', 'recusado', 'motivo', 'resumo_com_unidade_nao_lida'); end if;
  end if;
  -- 6. escreve (a marca do expurgo vale a transação inteira; o record_core a regrava em cada chamada, então o resumo a repõe)
  for b in select x from jsonb_array_elements(v_corpo) x order by (x->>'alvo_id')::bigint loop
    select * into a from public.obs_archive_item_targets t where t.id = (b->>'alvo_id')::bigint;
    select * into c from public.obs_archive_units u where u.id = a.from_unit_id;
    v_rem := (b->>'removidas')::bigint;
    if v_rem = 0 then
      update public.obs_archive_item_targets set estado = 'sem_linhas', done_at = now(), updated_at = now() where id = a.id;
      v_saida := v_saida || jsonb_build_object('alvo_id', a.id, 'estado', 'sem_linhas');
      continue;
    end if;
    v_ret := public.obs_archive_record_core(p_site, 'unidade',
               (b->'unidade') || jsonb_build_object('classe', a.class, 'tabela', a.table_name, 'canal', a.channel_ref, 'mes', to_char(a.month, 'YYYY-MM-DD')), 'expurgo');
    v_uid := substr(v_ret->>'arquivo_id', 3)::uuid; v_ver := (v_ret->>'versao')::int;
    update public.obs_archive_item_targets set estado = 'aguardando_nova', to_unit_id = v_uid, to_version = v_ver, rows_removed = v_rem, updated_at = now() where id = a.id;
    select pol.filho into v_pol from public.obs_archive_policy() pol where pol.class = a.class and pol.table_name = a.table_name;
    -- a nova (vazia: nulos)
    select f->>'caminho', f->>'sha256' into v_nova_cam, v_nova_sha from jsonb_array_elements(public.obs_archive_arquivos_da_unidade(v_uid)) f order by (f->>'parte')::int limit 1;
    -- TODAS as versões anteriores da unidade, inteira ou por parte (pula perdida e purgada)
    for w in select u.id, u.version, u.parts, u.sha256_bytes from public.obs_archive_units u
              where u.site_id = p_site and u.class = a.class and u.table_name = a.table_name and u.channel_ref = a.channel_ref and u.month = a.month
                and u.version < v_ver and u.lost_at is null and u.purged_at is null and u.row_count > 0 loop
      for ps in select (f->>'caminho') as caminho, (f->>'sha256') as sha from jsonb_array_elements(public.obs_archive_arquivos_da_unidade(w.id)) f loop
        insert into public.obs_archive_absence (site_id, alvo, alvo_id, filho, prefixo, e_prefixo, sha256, nova_caminho, nova_sha256)
        values (p_site, 'alvo:' || a.id, a.id, v_pol.filho, ps.caminho, false, ps.sha, v_nova_cam, v_nova_sha)
        on conflict (site_id, alvo, filho, prefixo) do nothing;
      end loop;
    end loop;
    v_saida := v_saida || jsonb_build_object('alvo_id', a.id, 'estado', 'aguardando_nova', 'arquivo_id', v_ret->>'arquivo_id', 'versao', v_ver);
  end loop;
  v_ret := null;
  if v_novas > 0 then
    perform set_config('obs_archive.origem', 'expurgo:' || pg_current_xact_id()::text, true);
    v_sver := v_max + 1;
    insert into public.obs_archive_summaries (site_id, class, channel_ref, month, version, empty, canal_sha256, canal_bytes, canal_rows, video_sha256, video_bytes, video_rows,
                                              unit_hashes, origem, received_at)
    values (p_site, v_class, v_canal, v_mes, v_sver, (v_res->>'vazio')::boolean, v_res->>'canal_sha256', (v_res->>'canal_bytes')::bigint, (v_res->>'canal_rows')::int,
            v_res->>'video_sha256', (v_res->>'video_bytes')::bigint, (v_res->>'video_rows')::int,
            public.obs_archive_channel_unit_hashes(p_site, v_class, v_canal, v_mes), 'expurgo', case when (v_res->>'vazio')::boolean then now() end)
    returning id into v_sid;
    v_primeiro := v_ids[1];
    select pol.filho into v_pol from public.obs_archive_policy() pol where pol.class = v_class limit 1;
    -- a versão anterior de CADA papel entra na ausência, mesmo se o papel novo ficou vazio (nova nula)
    for w in select s.id, s.version, s.canal_sha256, s.video_sha256, s.ficha_sha256 from public.obs_archive_summaries s
              where s.site_id = p_site and s.class = v_class and s.channel_ref = v_canal and s.month = v_mes and s.version < v_sver and s.lost_at is null and s.purged_at is null loop
      foreach pap in array array['canal', 'video', 'ficha'] loop
        if (case pap when 'canal' then w.canal_sha256 when 'video' then w.video_sha256 else w.ficha_sha256 end) is null then continue; end if;
        v_nova_sha := case pap when 'canal' then v_res->>'canal_sha256' when 'video' then v_res->>'video_sha256' else null end;
        v_nova_cam := case when v_nova_sha is null then null else
          v_class || '/canais/' || v_canal || '/resumo/' || to_char(v_mes, 'YYYY-MM') || '.v' || v_sver || '.' || pap || '.csv.gz' end;
        insert into public.obs_archive_absence (site_id, alvo, alvo_id, filho, prefixo, e_prefixo, sha256, nova_caminho, nova_sha256)
        values (p_site, 'alvo:' || v_primeiro, v_primeiro, v_pol.filho,
                v_class || '/canais/' || v_canal || '/resumo/' || to_char(v_mes, 'YYYY-MM') || '.v' || w.version || '.' || pap || '.csv.gz', false,
                case pap when 'canal' then w.canal_sha256 when 'video' then w.video_sha256 else w.ficha_sha256 end, v_nova_cam, v_nova_sha)
        on conflict (site_id, alvo, filho, prefixo) do nothing;
      end loop;
    end loop;
    update public.obs_archive_months set unsealed_at = now(), unsealed_reason = 'expurgo'
     where site_id = p_site and class = v_class and month = v_mes and sealed_at is not null;
    v_ret := jsonb_build_object('arquivo_id', 's:' || v_sid, 'versao', v_sver);
  end if;
  perform set_config('obs_archive.origem', '', true);       -- a marca não sobrevive ao expurgo (conserto do lote 1, ponto 3)
  return jsonb_build_object('status', 'ok', 'alvos', v_saida, 'resumo', v_ret);
end $$;
revoke all on function public.obs_archive_expurgo_record(uuid, bigint, jsonb) from public, anon, authenticated;
grant execute on function public.obs_archive_expurgo_record(uuid, bigint, jsonb) to service_role;

create or replace function public.obs_archive_expurgo_block(p_site uuid, p_alvo bigint, p_motivo text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.obs_archive_item_targets;
begin
  if p_motivo not in ('antiga_ausente', 'antiga_divergente', 'grande_demais', 'contagem_divergente') then
    return jsonb_build_object('status', 'recusado', 'motivo', 'forma');
  end if;
  select * into a from public.obs_archive_item_targets t where t.id = p_alvo and t.site_id = p_site for update;
  if a.id is null then raise exception 'item_desconhecido' using errcode = 'P0001'; end if;
  if a.estado <> 'copiar' then return jsonb_build_object('status', 'recusado', 'motivo', 'alvo_fora_de_copiar', 'alvo_id', a.id); end if;
  update public.obs_archive_item_targets set estado = 'bloqueado', motivo = p_motivo, updated_at = now() where id = a.id;
  return jsonb_build_object('status', 'ok', 'alvo_id', a.id);
end $$;
revoke all on function public.obs_archive_expurgo_block(uuid, bigint, text) from public, anon, authenticated;
grant execute on function public.obs_archive_expurgo_block(uuid, bigint, text) to service_role;

-- Só o dono, pelo SQL do painel (D-M9-5): volta um alvo bloqueado a copiar. depende_m10b só sai quando a M10b existir.
create or replace function public.obs_archive_expurgo_unblock(p_site uuid, p_alvo bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.obs_archive_item_targets;
begin
  select * into a from public.obs_archive_item_targets t where t.id = p_alvo and t.site_id = p_site for update;
  if a.id is null then raise exception 'item_desconhecido' using errcode = 'P0001'; end if;
  if a.estado <> 'bloqueado' then return jsonb_build_object('status', 'recusado', 'motivo', 'alvo_fora_de_bloqueado'); end if;
  if a.motivo = 'depende_m10b' then return jsonb_build_object('status', 'recusado', 'motivo', 'depende_m10b'); end if;
  update public.obs_archive_item_targets set estado = 'copiar', motivo = null, updated_at = now() where id = a.id;
  return jsonb_build_object('status', 'ok', 'alvo_id', a.id);
end $$;
revoke all on function public.obs_archive_expurgo_unblock(uuid, bigint) from public, anon, authenticated, service_role;

-- M9 PARTE 4: prova de ausência, marcos da remoção, reaparecimento

-- Os prefixos do canal: um por (filho, classe) com unidade ou resumo, mais os dois de _recebendo. Idempotente.
create or replace function public.obs_archive_removal_open_rows(p_site uuid, p_channel text) returns integer
language plpgsql security definer set search_path = '' as $$
declare r record; v_n integer := 0;
begin
  for r in
    select distinct pol.filho, c.class
      from (select u.class from public.obs_archive_units u where u.site_id = p_site and u.channel_ref = p_channel
            union select s.class from public.obs_archive_summaries s where s.site_id = p_site and s.channel_ref = p_channel) c
      join (select distinct class, filho from public.obs_archive_policy()) pol on pol.class = c.class
  loop
    insert into public.obs_archive_absence (site_id, alvo, canal_ref, filho, prefixo, e_prefixo, liberado_em)
    select p_site, 'canal:' || p_channel, p_channel, r.filho, x.prefixo, true, now()
      from (values (r.class || '/canais/' || p_channel), ('_recebendo/' || r.class || '/canais/' || p_channel),
                   ('_recebendo/_quarentena/' || r.class || '/canais/' || p_channel)) x(prefixo)
    on conflict (site_id, alvo, filho, prefixo) do nothing;
    get diagnostics v_n = row_count;
  end loop;
  return v_n;
end $$;
revoke all on function public.obs_archive_removal_open_rows(uuid, text) from public, anon, authenticated, service_role;

-- "Apagar canal" (decisão apagar): fecha os alvos de item em voo (Phil C6, Yannis I7) e abre as linhas do canal.
create or replace function public.obs_archive_canal_apagado() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.archive_decision = 'apagar' then
    update public.obs_archive_absence a set encerrada_at = now()
     where a.site_id = new.site_id and a.encerrada_at is null
       and ((a.alvo_id is not null and exists (select 1 from public.obs_archive_item_targets t where t.id = a.alvo_id and t.channel_ref = new.channel_ref and t.done_at is null))
         or (a.unidade_id is not null and exists (select 1 from public.obs_archive_units u where u.id = a.unidade_id and u.channel_ref = new.channel_ref)));
    update public.obs_archive_item_targets t
       set estado = 'concluido', motivo = null, motivo_fim = 'canal_apagado', done_at = now(), updated_at = now()
     where t.site_id = new.site_id and t.channel_ref = new.channel_ref and t.done_at is null;
    perform public.obs_archive_removal_open_rows(new.site_id, new.channel_ref);
  end if;
  return null;
end $$;
revoke all on function public.obs_archive_canal_apagado() from public, anon, authenticated, service_role;
drop trigger if exists obs_archive_canal_apagado on public.obs_archive_channel_removals;
create trigger obs_archive_canal_apagado after insert or update of archive_decision on public.obs_archive_channel_removals
  for each row execute function public.obs_archive_canal_apagado();

-- Remoções que já existiam antes da M9 ganham as linhas.
select public.obs_archive_removal_open_rows(site_id, channel_ref) from public.obs_archive_channel_removals
 where archive_decision = 'apagar' and completed_at is null;

create or replace function public.obs_archive_prefixos_ausentes(p_site uuid, p_origem text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.obs_archive_m9_ligado(p_site) then return '[]'::jsonb; end if;
  if p_origem = 'nas' then
    return coalesce((select jsonb_agg(jsonb_build_object('alvo', q.alvo, 'filho', q.filho, 'prefixo', q.prefixo, 'e_prefixo', q.e_prefixo,
                      'provar_snapshots', q.nas_absent_at is not null and q.snap_absent_at is null) order by q.ord, q.id)
                      from (select a.*, coalesce(a.nas_last_absent_at, a.nas_present_at) is not null as ord_f,
                                   row_number() over (order by coalesce(a.nas_last_absent_at, a.nas_present_at) nulls first, a.id) as ord
                              from public.obs_archive_absence a
                             where a.site_id = p_site and a.liberado_em is not null and a.encerrada_at is null
                             order by coalesce(a.nas_last_absent_at, a.nas_present_at) nulls first, a.id limit 2000) q), '[]'::jsonb);
  elsif p_origem = 'b2' then
    return coalesce((select jsonb_agg(jsonb_build_object('alvo', q.alvo, 'filho', q.filho, 'prefixo', q.prefixo, 'e_prefixo', q.e_prefixo) order by q.id)
                      from (select a.* from public.obs_archive_absence a
                             where a.site_id = p_site and a.liberado_em is not null and a.encerrada_at is null
                               and a.snap_absent_at is not null and a.b2_absent_at is null and a.nas_last_absent_at > now() - interval '24 hours'
                             order by a.b2_checked_at nulls first, a.id limit 2000) q), '[]'::jsonb);
  end if;
  return '[]'::jsonb;
end $$;
revoke all on function public.obs_archive_prefixos_ausentes(uuid, text) from public, anon, authenticated;
grant execute on function public.obs_archive_prefixos_ausentes(uuid, text) to service_role;

-- Reaparecimento: o arquivo voltou DEPOIS de ter sido dado como ausente (nível 'nas': recomeça tudo; 'b2': só o estágio B2).
create or replace function public.obs_archive_reabrir(p_linha bigint, p_nivel text) returns void
language plpgsql security definer set search_path = '' as $$
declare a public.obs_archive_absence;
begin
  select * into a from public.obs_archive_absence x where x.id = p_linha for update;
  if a.id is null or a.encerrada_at is not null then return; end if;   -- linha fechada não reabre: alvo concluído já perdeu as chaves (D-M9-25b; ponto 2 do controlador)
  if p_nivel = 'nas' then
    update public.obs_archive_absence set nas_absent_first_at = null, nas_absent_at = null, nas_last_absent_at = null, nas_present_at = now(),
           snap_absent_at = null, snap_oldest = null, snap_checked_at = null, b2_absent_at = null, b2_checked_at = null, b2_nomes = '{}', encerrada_at = null
     where id = a.id;
  else
    update public.obs_archive_absence set b2_absent_at = null, b2_present_at = now(), encerrada_at = null where id = a.id;
  end if;
  if a.alvo_id is not null then
    update public.obs_archive_item_targets t
       set estado = case when p_nivel = 'nas' then 'apagar_antigas' else 'conferir_b2' end, done_at = null, motivo_fim = null, updated_at = now()
     where t.id = a.alvo_id and t.estado in ('conferir_b2', 'apagar_antigas') and t.motivo_fim is null;
    -- religa a bandeira do item (Phil m3)
    update public.competitor_removed_items i set archive_pending = true, archive_note = null
     where i.site_id = a.site_id and exists (select 1 from public.obs_archive_item_targets t where t.id = a.alvo_id and t.item_kind = i.kind and i.youtube_id = any(t.item_refs));
  elsif a.canal_ref is not null then
    update public.obs_archive_channel_removals r
       set completed_at = null, b2_absent_at = null, snapshots_clear_on = null,
           nas_absent_at = case when p_nivel = 'nas' then null else r.nas_absent_at end,
           nas_absent_first_at = case when p_nivel = 'nas' then null else r.nas_absent_first_at end,
           reappeared_at = now(), reappeared_count = r.reappeared_count + 1
     where r.site_id = a.site_id and r.channel_ref = a.canal_ref;
  end if;
end $$;
revoke all on function public.obs_archive_reabrir(bigint, text) from public, anon, authenticated, service_role;

create or replace function public.obs_archive_attest_prefixos(p_site uuid, p_fonte text, p_execucao uuid, p_filhos jsonb, p_prefixos jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  it jsonb; a public.obs_archive_absence; v_saida jsonb := '[]'::jsonb; v_resp text; v_mot text; v_run public.obs_archive_b2_runs; v_nomes text[]; v_estado text; v_snap text;
  v_filho_ok boolean; v_controle boolean := false;
begin
  if p_fonte not in ('nas', 'b2') then raise exception 'forma' using errcode = 'P0001'; end if;
  if p_fonte = 'b2' then
    select * into v_run from public.obs_archive_b2_runs r where r.id = p_execucao and r.site_id = p_site;
    v_controle := v_run.id is not null and v_run.estado = 'controle_ok' and v_run.expires_at > now();
  end if;
  for it in select x from jsonb_array_elements(coalesce(p_prefixos, '[]'::jsonb)) x loop
    v_resp := 'recusado'; v_mot := null;
    select * into a from public.obs_archive_absence x
     where x.site_id = p_site and x.alvo = it->>'alvo' and x.filho = it->>'filho' and x.prefixo = it->>'prefixo' for update;
    v_estado := it->>'estado';
    if a.id is null then v_mot := 'desconhecido';
    elsif a.liberado_em is null or a.encerrada_at is not null then v_mot := 'nao_aberto';
    elsif p_fonte = 'nas' then
      v_filho_ok := coalesce((p_filhos->(a.filho)->>'montado')::boolean, false) and coalesce((p_filhos->(a.filho)->>'sentinela')::boolean, false);
      v_snap := it->>'snapshots';
      if not v_filho_ok then v_mot := 'filho_fora';
      elsif v_estado = 'presente' then
        if a.nas_absent_at is not null then perform public.obs_archive_reabrir(a.id, 'nas');
        else update public.obs_archive_absence set nas_absent_first_at = null, nas_last_absent_at = null, nas_present_at = now() where id = a.id; end if;
        v_resp := 'aceito';
      elsif v_estado = 'ausente' then
        update public.obs_archive_absence set
               nas_absent_first_at = coalesce(nas_absent_first_at, now()),
               nas_last_absent_at = now(),
               nas_absent_at = case when nas_absent_at is not null then nas_absent_at
                                    when nas_absent_first_at is not null and now() - nas_absent_first_at >= interval '11 hours' then now() end
         where id = a.id returning * into a;
        -- snapshots: só valem com a ausência no dataset já provada (duas execuções)
        if a.nas_absent_at is not null and v_snap in ('ausente', 'presente', 'indisponivel') then
          update public.obs_archive_absence set
                 snap_checked_at = now(),
                 snap_oldest = case when v_snap = 'indisponivel' then snap_oldest else nullif(it->>'snapshot_mais_antigo', '')::date end,
                 snap_absent_at = case when v_snap = 'ausente' then coalesce(snap_absent_at, now()) when v_snap = 'presente' then null else snap_absent_at end
           where id = a.id;
        end if;
        v_resp := 'aceito';
      else v_mot := 'forma';
      end if;
    else   -- b2
      if not v_controle then v_mot := 'controle_pendente';
      elsif v_estado = 'ausente' and a.snap_absent_at is null then v_mot := 'snapshots_pendentes';
      elsif v_estado = 'ausente' and not (a.nas_last_absent_at > now() - interval '24 hours') then v_mot := 'conferencia_nas_velha';
      elsif v_estado in ('ausente', 'presente') then
        select coalesce(array_agg(x), '{}') into v_nomes from (select jsonb_array_elements_text(coalesce(it->'nomes', '[]'::jsonb)) x limit 20) q;
        if v_estado = 'presente' and cardinality(v_nomes) = 0 then v_mot := 'forma';
        elsif v_estado = 'ausente' and coalesce(jsonb_array_length(it->'nomes'), 0) > 0 then v_mot := 'forma';
        elsif v_estado = 'presente' then
          if a.b2_absent_at is not null then perform public.obs_archive_reabrir(a.id, 'b2'); end if;
          update public.obs_archive_absence set b2_present_at = now(), b2_checked_at = now(), b2_nomes = v_nomes where id = a.id;
          v_resp := 'aceito';
        else
          update public.obs_archive_absence set b2_absent_at = coalesce(b2_absent_at, now()), b2_checked_at = now(), b2_nomes = '{}' where id = a.id;
          v_resp := 'aceito';
        end if;
      else v_mot := 'forma';
      end if;
    end if;
    v_saida := v_saida || jsonb_strip_nulls(jsonb_build_object('alvo', it->>'alvo', 'filho', it->>'filho', 'prefixo', it->>'prefixo', 'resposta', v_resp, 'motivo', v_mot));
  end loop;
  perform public.obs_archive_removal_advance(p_site);
  perform public.obs_archive_item_advance(p_site);
  return jsonb_build_object('prefixos', v_saida);
end $$;
revoke all on function public.obs_archive_attest_prefixos(uuid, text, uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.obs_archive_attest_prefixos(uuid, text, uuid, jsonb, jsonb) to service_role;

create or replace function public.obs_archive_removal_advance(p_site uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r record; g record; v_conclui boolean;
begin
  if not public.obs_archive_m9_ligado(p_site) then return; end if;
  for r in select * from public.obs_archive_channel_removals x
            where x.site_id = p_site and x.archive_decision = 'apagar' and x.completed_at is null order by x.channel_ref for update loop
    select count(*) as n, count(*) filter (where a.nas_absent_at is not null) as n_nas, count(*) filter (where a.snap_absent_at is not null) as n_snap,
           count(*) filter (where a.b2_absent_at is not null) as n_b2, min(a.nas_absent_first_at) as primeiro, max(a.nas_absent_at) as nas_em,
           min(a.nas_last_absent_at) as ultimo, max(a.snap_absent_at) as snap_em, max(a.b2_absent_at) as b2_em
      into g from public.obs_archive_absence a
     where a.site_id = p_site and a.alvo = 'canal:' || r.channel_ref and a.encerrada_at is null;
    update public.obs_archive_channel_removals set
           nas_absent_first_at = coalesce(g.primeiro, nas_absent_first_at),
           nas_absent_at = case when g.n > 0 and g.n_nas = g.n then g.nas_em else null end,
           nas_last_absent_at = case when g.n > 0 and g.n_nas = g.n then g.ultimo else nas_last_absent_at end,
           snapshots_clear_on = case when g.n > 0 and g.n_snap = g.n then (g.snap_em at time zone 'America/Sao_Paulo')::date else null end,
           b2_absent_at = case when g.n > 0 and g.n_b2 = g.n then g.b2_em else null end
     where site_id = r.site_id and channel_ref = r.channel_ref;
    v_conclui := (g.n = 0 or g.n_b2 = g.n)
             and cardinality(r.blobs_pending) = 0 and (r.online_thumbs_known or r.thumbs_unknown_ack_at is not null)
             and not exists (select 1 from public.obs_archive_batches b where b.site_id = r.site_id and b.kind = 'canal' and b.channel_ref = r.channel_ref and b.deleted_at is null and b.closed_at is null);
    if v_conclui then
      update public.obs_archive_channel_removals set completed_at = now() where site_id = r.site_id and channel_ref = r.channel_ref;
      update public.obs_archive_absence set encerrada_at = now() where site_id = p_site and alvo = 'canal:' || r.channel_ref and encerrada_at is null;
    end if;
  end loop;
end $$;
revoke all on function public.obs_archive_removal_advance(uuid) from public, anon, authenticated, service_role;

-- M9 PARTE 5: avanço dos itens, versões superadas de texto, já rodei

-- O que ainda falta para o alvo aguardando_nova poder apagar a antiga (D-M9-16): a primeira falta, na ordem.
create or replace function public.obs_archive_item_falta(p_alvo bigint) returns text
language plpgsql stable security definer set search_path = '' as $$
declare t public.obs_archive_item_targets; u public.obs_archive_units; s public.obs_archive_summaries;
begin
  select * into t from public.obs_archive_item_targets x where x.id = p_alvo;
  if t.id is null or t.estado <> 'aguardando_nova' then return null; end if;
  select * into u from public.obs_archive_units x where x.id = t.to_unit_id;
  if u.row_count > 0 and (u.received_at is null or u.nas_attested_at is null) then return 'unidade_no_nas'; end if;
  select * into s from public.obs_archive_summaries x
   where x.site_id = t.site_id and x.class = t.class and x.channel_ref = t.channel_ref and x.month = t.month and x.lost_at is null and x.purged_at is null
   order by x.version desc limit 1;
  if s.id is not null and not s.empty and (s.received_at is null or s.nas_attested_at is null) then return 'resumo'; end if;
  -- o manifesto novo: o mês foi selado de novo DEPOIS da unidade nova e o B2 o atestou depois do selo (conferir no teste: NÃO VERIFICADO 12)
  if exists (select 1 from public.obs_archive_months m
              where m.site_id = t.site_id and m.class = t.class and m.table_name = t.table_name and m.month = t.month
                and not (m.sealed_at is not null and m.unsealed_at is null and m.sealed_at > coalesce(u.received_at, u.exported_at))) then return 'manifesto'; end if;
  if u.row_count > 0 and exists (
       select 1 from (select 'u:' || u.id as aid where u.parts = 1
                      union all select 'p:' || u.id || ':' || lpad(pt.part::text, 2, '0') from public.obs_archive_unit_parts pt where pt.unit_id = u.id and u.parts > 1) f
        where not exists (select 1 from public.obs_archive_b2_files b where b.site_id = t.site_id and b.arquivo_id = f.aid and b.last_ok_at is not null)) then return 'b2_nova'; end if;
  if s.id is not null and not s.empty and exists (
       select 1 from (values ('canal', s.canal_sha256), ('video', s.video_sha256), ('ficha', s.ficha_sha256)) k(papel, sha)
        where k.sha is not null and not exists (select 1 from public.obs_archive_b2_files b where b.site_id = t.site_id
                                                  and b.arquivo_id = 's:' || s.id || ':' || k.papel and b.last_ok_at is not null)) then return 'b2_nova'; end if;
  if exists (select 1 from public.obs_archive_months m where m.site_id = t.site_id and m.class = t.class and m.table_name = t.table_name and m.month = t.month
                and (m.b2_attested_at is null or m.b2_attested_at < m.sealed_at)) then return 'b2_nova'; end if;
  if not public.obs_archive_m9_ligado(t.site_id) then return 'm9_desligado'; end if;
  return null;
end $$;
revoke all on function public.obs_archive_item_falta(bigint) from public, anon, authenticated, service_role;

-- A etapa de uma prova de ausência (itens, canais, versões superadas): 'apagar_antigas', 'conferir_b2' ou a falta que segura.
create or replace function public.obs_archive_etapa(p_sem_primeiro bigint, p_sem_nas bigint, p_sem_snap bigint, p_min_last timestamptz,
                                                    p_nao_checado bigint, p_lig boolean, p_agora timestamptz) returns text
language sql immutable set search_path = '' as $$
  select case
    when p_sem_primeiro > 0 then 'apagar_antigas'
    when not p_lig then 'm9_desligado'
    when p_sem_nas > 0 then 'segunda_conferencia'
    when p_sem_snap > 0 then 'snapshots'
    when p_min_last is null or p_min_last < p_agora - interval '24 hours' then 'conferencia_nas_recente'
    when p_nao_checado > 0 then 'b2_sync'
    else 'conferir_b2' end
$$;
revoke all on function public.obs_archive_etapa(bigint, bigint, bigint, timestamptz, bigint, boolean, timestamptz) from public, anon, authenticated, service_role;

-- Versão superada de texto: a antiga sai 30 DIAS DEPOIS DE A NOVA CHEGAR ao NAS (received_at), desde que AGORA o NAS a confirme (atestada há <= 48 h, nunca retirada)
-- e o B2 tenha conferido TODAS as partes da nova há <= 7 dias (02 §11.3; item 110). Conserto Phil C1: contar os 30 dias da última conferência nunca disparava.
-- Uma linha `antiga:` por parte da antiga (ponto 1 do controlador, 29/10). Mesmas janelas da M3b: 48 h (segunda conferência), 7 dias (b2_forja_ok).
create or replace function public.obs_archive_antigas_open(p_site uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer := 0;
begin
  insert into public.obs_archive_absence (site_id, alvo, unidade_id, filho, prefixo, e_prefixo, sha256, nova_caminho, nova_sha256, liberado_em)
  select p_site, 'antiga:' || o.id, o.id, 'texto', f->>'caminho', false, f->>'sha256', nf->>'caminho', nf->>'sha256', public.obs_archive_agora()
    from public.obs_archive_units o
    join lateral (select x.* from public.obs_archive_units x where x.site_id = o.site_id and x.class = o.class and x.table_name = o.table_name
                    and x.channel_ref = o.channel_ref and x.month = o.month and x.version > o.version and x.received_at is not null
                    and x.lost_at is null and x.purged_at is null
                  order by x.version desc limit 1) nx on true
    cross join lateral jsonb_array_elements(public.obs_archive_arquivos_da_unidade(o.id)) f
    cross join lateral (select e as nf from jsonb_array_elements(public.obs_archive_arquivos_da_unidade(nx.id)) e order by (e->>'parte')::int limit 1) z
   where o.site_id = p_site and o.class = 'texto' and o.superseded_at is not null and o.row_count > 0 and o.purged_at is null and o.lost_at is null
     and nx.row_count > 0
     and nx.received_at <= public.obs_archive_agora() - interval '30 days'
     and nx.nas_attested_at >= public.obs_archive_agora() - interval '48 hours'
     and nx.nas_withdrawn_at is null and nx.nas_unreadable_at is null
     and not exists (
           select 1 from (select 'u:' || nx.id as aid where nx.parts = 1
                          union all
                          select 'p:' || nx.id || ':' || lpad(pt.part::text, 2, '0') from public.obs_archive_unit_parts pt where pt.unit_id = nx.id and nx.parts > 1) fa
            where not exists (select 1 from public.obs_archive_b2_files b
                               where b.site_id = p_site and b.arquivo_id = fa.aid and b.last_ok_at >= public.obs_archive_agora() - interval '7 days' and b.pending_mismatch is null))
     and not exists (select 1 from public.obs_archive_channel_removals r where r.site_id = p_site and r.channel_ref = o.channel_ref)
     and not exists (select 1 from public.obs_archive_absence z2 where z2.site_id = p_site and z2.prefixo = f->>'caminho')
  on conflict (site_id, alvo, filho, prefixo) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.obs_archive_antigas_open(uuid) from public, anon, authenticated, service_role;

create or replace function public.obs_archive_item_advance(p_site uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare t record; n integer := 0; v_lig boolean := public.obs_archive_m9_ligado(p_site);
begin
  if v_lig then
    -- 1. a nova está recebida, atestada, no B2, com resumo e manifesto: as antigas podem sair
    for t in select * from public.obs_archive_item_targets x where x.site_id = p_site and x.estado = 'aguardando_nova' order by x.id for update loop
      if public.obs_archive_item_falta(t.id) is null then
        update public.obs_archive_item_targets set estado = 'apagar_antigas', updated_at = now() where id = t.id;
        update public.obs_archive_units set superseded_at = coalesce(superseded_at, now())
         where site_id = p_site and class = t.class and table_name = t.table_name and channel_ref = t.channel_ref and month = t.month and version < t.to_version;
        update public.obs_archive_summaries set superseded_at = coalesce(superseded_at, now())
         where site_id = p_site and class = t.class and channel_ref = t.channel_ref and month = t.month
           and version < (select max(s.version) from public.obs_archive_summaries s where s.site_id = p_site and s.class = t.class and s.channel_ref = t.channel_ref and s.month = t.month);
        update public.obs_archive_absence set liberado_em = coalesce(liberado_em, now()) where site_id = p_site and alvo_id = t.id;
        n := n + 1;
      end if;
    end loop;
    -- 2. todas as linhas provadas ausentes do NAS e dos snapshots: a vez do B2 (sem linha nenhuma: nada a provar)
    for t in select * from public.obs_archive_item_targets x where x.site_id = p_site and x.estado = 'apagar_antigas' order by x.id for update loop
      if not exists (select 1 from public.obs_archive_absence a where a.site_id = p_site and a.alvo_id = t.id and a.encerrada_at is null) then
        update public.obs_archive_item_targets set estado = 'concluido', done_at = now(), updated_at = now() where id = t.id;
        n := n + 1;
      elsif not exists (select 1 from public.obs_archive_absence a where a.site_id = p_site and a.alvo_id = t.id and a.encerrada_at is null and a.snap_absent_at is null) then
        update public.obs_archive_item_targets set estado = 'conferir_b2', updated_at = now() where id = t.id;
        n := n + 1;
      end if;
    end loop;
    -- 3. B2 sem nenhuma versão: concluído
    for t in select * from public.obs_archive_item_targets x where x.site_id = p_site and x.estado = 'conferir_b2' order by x.id for update loop
      if not exists (select 1 from public.obs_archive_absence a where a.site_id = p_site and a.alvo_id = t.id and a.encerrada_at is null and a.b2_absent_at is null) then
        update public.obs_archive_absence set encerrada_at = now() where site_id = p_site and alvo_id = t.id and encerrada_at is null;
        update public.obs_archive_item_targets set estado = 'concluido', done_at = now(), updated_at = now() where id = t.id;
        n := n + 1;
      end if;
    end loop;
    n := n + public.obs_archive_antigas_open(p_site);
    update public.obs_archive_absence set encerrada_at = now() where site_id = p_site and alvo like 'antiga:%' and encerrada_at is null and b2_absent_at is not null;
  end if;
  -- limpeza da bandeira, sempre (D-M9-2): sem alvo aberto com a chave, o arquivo está limpo
  update public.competitor_removed_items i set archive_pending = false, archive_note = coalesce(i.archive_note, 'arquivo limpo')
   where i.site_id = p_site and i.archive_pending and i.kind in ('video', 'comentario')
     and not exists (select 1 from public.obs_archive_item_targets g where g.site_id = p_site and g.item_kind = i.kind and g.done_at is null and i.youtube_id = any(g.item_refs));
  return n;
end $$;
revoke all on function public.obs_archive_item_advance(uuid) from public, anon, authenticated, service_role;

-- O manifesto anterior também sai: entra na lista do alvo (o de menor id do grupo) quando a versão do manifesto sobe (alvo ainda em copiar/aguardando_nova).
create or replace function public.obs_archive_manifesto_antigo() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_alvo bigint;
begin
  if old.manifest_version is not null and new.manifest_version > old.manifest_version and old.manifest_sha256 is not null then
    select min(t.id) into v_alvo from public.obs_archive_item_targets t
     where t.site_id = new.site_id and t.class = new.class and t.month = new.month and t.estado in ('copiar', 'aguardando_nova');
    if v_alvo is not null then
      insert into public.obs_archive_absence (site_id, alvo, alvo_id, filho, prefixo, e_prefixo, sha256, nova_caminho, nova_sha256)
      select new.site_id, 'alvo:' || v_alvo, v_alvo, pol.filho,
             new.class || '/manifestos/' || to_char(new.month, 'YYYY-MM') || '.v' || old.manifest_version || '.' || k.ext, false, k.sha_old,
             new.class || '/manifestos/' || to_char(new.month, 'YYYY-MM') || '.v' || new.manifest_version || '.' || k.ext, k.sha_new
        from (select min(p.filho) as filho from public.obs_archive_policy() p where p.class = new.class) pol
        cross join (values ('json', old.manifest_sha256, new.manifest_sha256), ('sha256', old.manifest_list_sha256, new.manifest_list_sha256)) k(ext, sha_old, sha_new)
       where k.sha_old is not null and k.sha_new is not null
      on conflict (site_id, alvo, filho, prefixo) do nothing;
    end if;
  end if;
  return new;
end $$;
revoke all on function public.obs_archive_manifesto_antigo() from public, anon, authenticated, service_role;
drop trigger if exists obs_archive_manifesto_antigo on public.obs_archive_months;
create trigger obs_archive_manifesto_antigo before update of manifest_version on public.obs_archive_months
  for each row execute function public.obs_archive_manifesto_antigo();

-- "Já rodei" / "Desfazer": só item: e canal: (antiga: fica fora, Yannis m6). Não muda estado; só marca.
create or replace function public.obs_archive_marcar_rodado(p_site uuid, p_item_id text, p_actor uuid, p_desfazer boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v timestamptz := case when p_desfazer then null else public.obs_archive_agora() end;
begin
  if p_actor is null or not public.obs_archive_is_site_admin(p_site, p_actor) then raise exception 'sem_permissao' using errcode = 'P0001'; end if;
  if p_item_id ~ '^item:[1-9][0-9]{0,18}$' then
    update public.competitor_removed_items set marcado_rodado_em = v where site_id = p_site and id = substr(p_item_id, 6)::bigint;
  elsif p_item_id ~ '^canal:[0-9a-f-]{36}$' then
    update public.obs_archive_channel_removals set marcado_rodado_em = v where site_id = p_site and channel_ref = substr(p_item_id, 7);
  else
    raise exception 'item_invalido' using errcode = 'P0001';
  end if;
  if not found then raise exception 'item_desconhecido' using errcode = 'P0001'; end if;
  return jsonb_build_object('item_id', p_item_id, 'marcado_rodado_em', v);
end $$;
revoke all on function public.obs_archive_marcar_rodado(uuid, text, uuid, boolean) from public, anon, authenticated;
grant execute on function public.obs_archive_marcar_rodado(uuid, text, uuid, boolean) to service_role;

-- A lista de apagar: as linhas liberadas ainda sem a primeira ausência.
create or replace function public.obs_archive_apagar_do_item(p_site uuid, p_item bigint) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('filho', a.filho, 'caminho', a.prefixo, 'sha256', a.sha256,
           'nova', case when a.nova_caminho is null then null else jsonb_build_object('caminho', a.nova_caminho, 'sha256', a.nova_sha256) end)
         order by a.filho, a.prefixo), '[]'::jsonb)
    from public.obs_archive_absence a join public.obs_archive_item_targets t on t.id = a.alvo_id
   where a.site_id = p_site and t.item_id = p_item and t.estado = 'apagar_antigas' and not a.e_prefixo and a.liberado_em is not null
     and a.encerrada_at is null and a.nas_absent_first_at is null
$$;
revoke all on function public.obs_archive_apagar_do_item(uuid, bigint) from public, anon, authenticated, service_role;

create or replace function public.obs_archive_apagar_da_antiga(p_site uuid, p_alvo text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('filho', a.filho, 'caminho', a.prefixo, 'sha256', a.sha256,
           'nova', case when a.nova_caminho is null then null else jsonb_build_object('caminho', a.nova_caminho, 'sha256', a.nova_sha256) end)
         order by a.filho, a.prefixo), '[]'::jsonb)
    from public.obs_archive_absence a
   where a.site_id = p_site and a.alvo = p_alvo and not a.e_prefixo and a.liberado_em is not null and a.encerrada_at is null and a.nas_absent_first_at is null
$$;
revoke all on function public.obs_archive_apagar_da_antiga(uuid, text) from public, anon, authenticated, service_role;

-- Todos os arquivos que o registro conhece de um canal removido (unidades em todas as versões, partes, resumos), com o sha256.
create or replace function public.obs_archive_arquivos_do_canal(p_site uuid, p_ref text) returns jsonb
language sql stable security definer set search_path = '' as $$
  with pol as (select distinct p.class, p.filho from public.obs_archive_policy() p),
  f as (
    select pol.filho, public.obs_archive_caminho_unidade(u.class, u.channel_ref, u.table_name, u.month, u.version, null) as caminho, u.sha256_bytes as sha
      from public.obs_archive_units u join pol on pol.class = u.class
     where u.site_id = p_site and u.channel_ref = p_ref and u.parts = 1 and u.sha256_bytes is not null
    union all
    select pol.filho, public.obs_archive_caminho_unidade(u.class, u.channel_ref, u.table_name, u.month, u.version, pt.part), pt.sha256_bytes
      from public.obs_archive_units u join public.obs_archive_unit_parts pt on pt.unit_id = u.id join pol on pol.class = u.class
     where u.site_id = p_site and u.channel_ref = p_ref and u.parts > 1
    union all
    select pol.filho, s.class || '/canais/' || s.channel_ref || '/resumo/' || to_char(s.month, 'YYYY-MM') || '.v' || s.version || '.' || k.papel || '.csv.gz', k.sha
      from public.obs_archive_summaries s join pol on pol.class = s.class
      cross join lateral (values ('canal', s.canal_sha256), ('video', s.video_sha256), ('ficha', s.ficha_sha256)) k(papel, sha)
     where s.site_id = p_site and s.channel_ref = p_ref and k.sha is not null
  )
  select coalesce(jsonb_agg(jsonb_build_object('filho', f.filho, 'caminho', f.caminho, 'sha256', f.sha, 'nova', null) order by f.filho, f.caminho), '[]'::jsonb) from f
$$;
revoke all on function public.obs_archive_arquivos_do_canal(uuid, text) from public, anon, authenticated, service_role;

-- M9 PARTE 6: wrappers do plano (sem editar função da M3b), lista de canais e pendências na versao 2

-- Renomeia as originais uma única vez e fecha o acesso a elas. Rodar de novo não faz nada.
do $m9$ begin
  if to_regprocedure('public.obs_archive_plan_base(uuid,boolean,text)') is null then
    alter function public.obs_archive_plan(uuid, boolean, text) rename to obs_archive_plan_base;
  end if;
  if to_regprocedure('public.obs_archive_b2_plan_base(uuid,boolean,text)') is null then
    alter function public.obs_archive_b2_plan(uuid, boolean, text) rename to obs_archive_b2_plan_base;
  end if;
  if to_regprocedure('public.obs_archive_removed_channel_list_base(uuid)') is null then
    alter function public.obs_archive_removed_channel_list(uuid) rename to obs_archive_removed_channel_list_base;
  end if;
end $m9$;
revoke all on function public.obs_archive_plan_base(uuid, boolean, text) from public, anon, authenticated, service_role;
revoke all on function public.obs_archive_b2_plan_base(uuid, boolean, text) from public, anon, authenticated, service_role;
revoke all on function public.obs_archive_removed_channel_list_base(uuid) from public, anon, authenticated, service_role;

create or replace function public.obs_archive_plan(p_site uuid, p_completo boolean, p_cursor text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v jsonb; v_lig boolean := public.obs_archive_m9_ligado(p_site); v_dono jsonb; v_man jsonb;
begin
  perform public.obs_archive_removal_advance(p_site);
  perform public.obs_archive_item_advance(p_site);
  v := public.obs_archive_plan_base(p_site, p_completo, p_cursor);
  -- D-M9-3: o que o expurgo está refazendo não se reexporta
  v := jsonb_set(v, '{exportar}', coalesce((
         select jsonb_agg(e) from jsonb_array_elements(v->'exportar') e
          where not exists (select 1 from public.obs_archive_item_targets g
                             where g.site_id = p_site and g.estado in ('copiar', 'aguardando_nova', 'bloqueado') and g.class = e->>'classe' and g.table_name = e->>'tabela'
                               and g.channel_ref = e->>'canal' and to_char(g.month, 'YYYY-MM') = e->>'mes')), '[]'::jsonb));
  v := jsonb_set(v, '{resumos}', coalesce((
         select jsonb_agg(e) from jsonb_array_elements(v->'resumos') e
          where not exists (select 1 from public.obs_archive_item_targets g
                             where g.site_id = p_site and g.estado in ('copiar', 'aguardando_nova', 'bloqueado') and g.class = e->>'classe'
                               and g.channel_ref = e->>'canal' and to_char(g.month, 'YYYY-MM') = e->>'mes')), '[]'::jsonb));
  if p_cursor is null then
    -- D-M9-16: a versão nova do expurgo chega a "recebida" pelo mesmo caminho das outras (o dono grava em _recebendo, o copiador recebe)
    select coalesce(jsonb_agg(x.item order by x.item->>'caminho'), '[]'::jsonb) into v_dono from (
      select jsonb_build_object('arquivo_id', 'u:' || u.id, 'tipo', 'unidade', 'filho', pol.filho,
               'caminho', public.obs_archive_caminho_unidade(u.class, u.channel_ref, u.table_name, u.month, u.version), 'classe', u.class, 'tabela', u.table_name,
               'canal', u.channel_ref, 'mes', to_char(u.month, 'YYYY-MM'), 'versao', u.version, 'coluna_controle', pol.control_column, 'b2_file_id_bom', null) as item
        from public.obs_archive_units u join public.obs_archive_policy() pol on pol.class = u.class and pol.table_name = u.table_name
       where u.site_id = p_site and u.origem = 'expurgo' and u.parts = 1 and u.row_count > 0 and u.received_at is null and u.lost_at is null and u.purged_at is null
      union all
      select jsonb_build_object('arquivo_id', 'p:' || u.id || ':' || lpad(pt.part::text, 2, '0'), 'tipo', 'parte', 'filho', pol.filho,
               'caminho', public.obs_archive_caminho_unidade(u.class, u.channel_ref, u.table_name, u.month, u.version, pt.part), 'classe', u.class, 'tabela', u.table_name,
               'canal', u.channel_ref, 'mes', to_char(u.month, 'YYYY-MM'), 'versao', u.version, 'coluna_controle', pol.control_column, 'b2_file_id_bom', null)
        from public.obs_archive_units u join public.obs_archive_unit_parts pt on pt.unit_id = u.id
        join public.obs_archive_policy() pol on pol.class = u.class and pol.table_name = u.table_name
       where u.site_id = p_site and u.origem = 'expurgo' and u.parts > 1 and u.received_at is null and pt.received_at is null and u.lost_at is null and u.purged_at is null
      union all
      select jsonb_build_object('arquivo_id', 's:' || s.id || ':' || k.papel, 'tipo', 'resumo', 'filho', pol.filho,
               'caminho', s.class || '/canais/' || s.channel_ref || '/resumo/' || to_char(s.month, 'YYYY-MM') || '.v' || s.version || '.' || k.papel || '.csv.gz',
               'classe', s.class, 'tabela', null, 'canal', s.channel_ref, 'mes', to_char(s.month, 'YYYY-MM'), 'versao', s.version, 'coluna_controle', null, 'b2_file_id_bom', null)
        from public.obs_archive_summaries s
        join (select distinct class, filho from public.obs_archive_policy()) pol on pol.class = s.class
        cross join lateral (values ('canal', s.canal_sha256), ('video', s.video_sha256), ('ficha', s.ficha_sha256)) k(papel, sha)
       where s.site_id = p_site and s.origem = 'expurgo' and not s.empty and s.received_at is null and k.sha is not null and s.lost_at is null and s.purged_at is null
         and not (k.papel = any(s.received_papers))
    ) x;
    v := jsonb_set(v, '{aguardando_dono}', coalesce(v->'aguardando_dono', '[]'::jsonb) || v_dono);
    -- manifestos de meses refeitos pelo expurgo, inclusive meses fora do banco, quando unidades e resumos já estão recebidos
    select coalesce(jsonb_agg(distinct jsonb_build_object('classe', m.class, 'mes', to_char(m.month, 'YYYY-MM'))), '[]'::jsonb) into v_man
      from public.obs_archive_months m
     where m.site_id = p_site and m.unsealed_reason = 'expurgo' and m.unsealed_at is not null
       and not exists (select 1 from public.obs_archive_pending_units(p_site, m.class, m.month, null))
       and not exists (select 1 from public.obs_archive_summaries s where s.site_id = p_site and s.class = m.class and s.month = m.month and s.origem = 'expurgo'
                          and not s.empty and s.received_at is null and s.lost_at is null and s.purged_at is null);
    v := jsonb_set(v, '{manifestos}', (
           select coalesce(jsonb_agg(distinct e), '[]'::jsonb) from jsonb_array_elements(coalesce(v->'manifestos', '[]'::jsonb) || v_man) e));
    v := jsonb_set(v, '{prefixos_ausentes}', public.obs_archive_prefixos_ausentes(p_site, 'nas'));
    if v_lig and not public.obs_archive_m9_captura_presente() then
      v := jsonb_set(v, '{vermelhos}', coalesce(v->'vermelhos', '[]'::jsonb)
             || to_jsonb('captura_ausente: as funções de apagar da E9 não chamam a captura do arquivo (M9); apagar vídeo/comentário não guarda a lista'::text));
    end if;
  end if;
  return v;
end $$;
revoke all on function public.obs_archive_plan(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.obs_archive_plan(uuid, boolean, text) to service_role;

create or replace function public.obs_archive_b2_plan(p_site uuid, p_completo boolean, p_cursor text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v jsonb;
begin
  v := public.obs_archive_b2_plan_base(p_site, p_completo, p_cursor);
  if p_cursor is null then
    v := jsonb_set(v, '{prefixos_ausentes}', public.obs_archive_prefixos_ausentes(p_site, 'b2'));
  end if;
  return v;
end $$;
revoke all on function public.obs_archive_b2_plan(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.obs_archive_b2_plan(uuid, boolean, text) to service_role;

create or replace function public.obs_archive_removed_channel_list(p_site uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(
           (e - 'estado') || jsonb_build_object(
             'estado', case
                 when r.archive_decision = 'apagar' and r.completed_at is not null then 'concluido'
                 when r.archive_decision = 'apagar' and r.b2_absent_at is not null then 'apagado_b2'
                 when r.archive_decision = 'apagar' and r.nas_absent_at is not null then 'apagado_nas'
                 else e->>'estado' end,
             'nas_last_absent_at', r.nas_last_absent_at, 'marcado_rodado_em', r.marcado_rodado_em, 'completed_at', r.completed_at,
             'lote_e10_aberto', exists (select 1 from public.obs_archive_batches b where b.site_id = p_site and b.kind = 'canal' and b.channel_ref = r.channel_ref
                                         and b.deleted_at is null and b.closed_at is null),
             'prefixos_total', coalesce(ab.n, 0), 'prefixos_ausentes_nas', coalesce(ab.n_nas, 0), 'snap_ok', coalesce(ab.n_snap, 0),
             'snapshot_mais_antigo', ab.snap_oldest)
           order by e->>'channel_ref'), '[]'::jsonb)
    from jsonb_array_elements(public.obs_archive_removed_channel_list_base(p_site)) e
    left join public.obs_archive_channel_removals r on r.site_id = p_site and r.channel_ref = e->>'channel_ref'
    left join lateral (select count(*) as n, count(*) filter (where a.nas_absent_at is not null) as n_nas, count(*) filter (where a.snap_absent_at is not null) as n_snap,
                              min(a.snap_oldest) filter (where a.snap_absent_at is null) as snap_oldest
                         from public.obs_archive_absence a where a.site_id = p_site and a.alvo = 'canal:' || (e->>'channel_ref')) ab on true
$$;
revoke all on function public.obs_archive_removed_channel_list(uuid) from public, anon, authenticated;
grant execute on function public.obs_archive_removed_channel_list(uuid) to service_role;

-- As pendências do dono na versao 2 (C12 r2.6): SÓ LÊ (stable). Quem avança os estados é o plano, o attest e o record (D-M9-5).
create or replace function public.obs_archive_owner_pending(p_site uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_site uuid := p_site; v_itens jsonb; v_agora timestamptz := public.obs_archive_agora(); v_lig boolean;
begin
  if v_site is null then
    if (select count(*) from (select c.site_id from public.competitor_channels c union select r.site_id from public.obs_archive_channel_removals r
                              union select u.site_id from public.obs_archive_units u) x) <> 1 then raise exception 'site_ambiguo' using errcode = 'P0001'; end if;
    select c.site_id into v_site from (select c0.site_id from public.competitor_channels c0 union select r.site_id from public.obs_archive_channel_removals r
                                       union select u.site_id from public.obs_archive_units u) c;
  end if;
  v_lig := public.obs_archive_m9_ligado(v_site);
  with alvos as (
    select t.item_id,
           count(*) filter (where t.estado = 'copiar') as n_copiar, count(*) filter (where t.estado = 'bloqueado') as n_bloq,
           count(*) filter (where t.estado = 'aguardando_nova') as n_agu,
           bool_and(public.obs_archive_grupo_pronto(t.site_id, t.class, t.channel_ref, t.month)) filter (where t.estado = 'copiar') as copiar_pronto,
           min(t.month) as mes, min(t.channel_ref) as channel_ref, min(t.item_kind) as kind,
           min(public.obs_archive_item_falta(t.id)) filter (where t.estado = 'aguardando_nova') as falta_agu,
           min(t.motivo) filter (where t.estado = 'bloqueado') as motivo
      from public.obs_archive_item_targets t where t.site_id = v_site and t.done_at is null and t.item_id is not null group by t.item_id
  ), ab as (
    select t.item_id, count(*) filter (where a.nas_absent_first_at is null) as sem_primeiro, count(*) filter (where a.nas_absent_at is null) as sem_nas,
           count(*) filter (where a.snap_absent_at is null) as sem_snap, min(a.nas_last_absent_at) as min_last,
           count(*) filter (where a.b2_checked_at is null) as nao_checado, min(a.snap_oldest) filter (where a.snap_absent_at is null) as snap_oldest
      from public.obs_archive_item_targets t join public.obs_archive_absence a on a.alvo_id = t.id and a.encerrada_at is null and a.liberado_em is not null and a.b2_absent_at is null
     where t.site_id = v_site and t.estado in ('apagar_antigas', 'conferir_b2') group by t.item_id
  ), it as (
    select x.*, i.youtube_id, i.decided_at, i.marcado_rodado_em, ab.snap_oldest,
           public.obs_archive_etapa(coalesce(ab.sem_primeiro, 0), coalesce(ab.sem_nas, 0), coalesce(ab.sem_snap, 0), ab.min_last, coalesce(ab.nao_checado, 0), v_lig, v_agora) as et
      from alvos x left join ab on ab.item_id = x.item_id left join public.competitor_removed_items i on i.id = x.item_id
  ), it_tempo as (
    select it.*,
           case when n_copiar > 0 and coalesce(copiar_pronto, false) then 'copiar' when n_bloq > 0 then 'bloqueado'
                when n_copiar > 0 or n_agu > 0 then 'sem_comando' when et in ('apagar_antigas', 'conferir_b2') then et else 'sem_comando' end as tempo,
           case when n_copiar > 0 and coalesce(copiar_pronto, false) then null when n_bloq > 0 then null
                when n_copiar > 0 then 'versao_em_curso' when n_agu > 0 then coalesce(falta_agu, 'versao_em_curso')
                when et in ('apagar_antigas', 'conferir_b2') then null else et end as falta
      from it
  ), item_item as (
    select 'item:' || x.item_id as item_id, x.kind, x.tempo, x.falta, case when x.tempo = 'bloqueado' then x.motivo end as motivo, x.decided_at as desde,
           to_char(x.mes, 'YYYY-MM') as mes, x.channel_ref, x.youtube_id, x.marcado_rodado_em as marcado, x.n_bloq as bloqueados, x.snap_oldest,
           case when x.tempo = 'apagar_antigas' then public.obs_archive_apagar_do_item(v_site, x.item_id) else '[]'::jsonb end as apagar,
           case when x.tempo = 'conferir_b2' then (select coalesce(jsonb_agg(a.filho || '/' || n order by a.filho, n), '[]'::jsonb)
                                                     from public.obs_archive_item_targets t2 join public.obs_archive_absence a on a.alvo_id = t2.id
                                                     cross join lateral unnest(a.b2_nomes) n
                                                    where t2.item_id = x.item_id and t2.estado = 'conferir_b2' and a.encerrada_at is null and a.b2_absent_at is null)
                else '[]'::jsonb end as b2_nomes,
           '[]'::jsonb as prefixos
      from it_tempo x
  ), canal as (
    select r.*, (select count(*) from public.obs_archive_absence a where a.site_id = r.site_id and a.alvo = 'canal:' || r.channel_ref and a.encerrada_at is null and a.liberado_em is not null and a.b2_absent_at is null) as n_abertas,
           (select count(*) filter (where a.nas_absent_first_at is null) from public.obs_archive_absence a where a.site_id = r.site_id and a.alvo = 'canal:' || r.channel_ref and a.encerrada_at is null and a.liberado_em is not null and a.b2_absent_at is null) as sem_primeiro,
           (select count(*) filter (where a.nas_absent_at is null) from public.obs_archive_absence a where a.site_id = r.site_id and a.alvo = 'canal:' || r.channel_ref and a.encerrada_at is null and a.liberado_em is not null and a.b2_absent_at is null) as sem_nas,
           (select count(*) filter (where a.snap_absent_at is null) from public.obs_archive_absence a where a.site_id = r.site_id and a.alvo = 'canal:' || r.channel_ref and a.encerrada_at is null and a.liberado_em is not null and a.b2_absent_at is null) as sem_snap,
           (select min(a.nas_last_absent_at) from public.obs_archive_absence a where a.site_id = r.site_id and a.alvo = 'canal:' || r.channel_ref and a.encerrada_at is null and a.liberado_em is not null and a.b2_absent_at is null) as min_last,
           (select count(*) filter (where a.b2_checked_at is null) from public.obs_archive_absence a where a.site_id = r.site_id and a.alvo = 'canal:' || r.channel_ref and a.encerrada_at is null and a.liberado_em is not null and a.b2_absent_at is null) as nao_checado,
           (select min(a.snap_oldest) filter (where a.snap_absent_at is null) from public.obs_archive_absence a where a.site_id = r.site_id and a.alvo = 'canal:' || r.channel_ref and a.encerrada_at is null) as snap_oldest,
           jsonb_array_length(public.obs_archive_arquivos_do_canal(v_site, r.channel_ref)) as n_arquivos
      from public.obs_archive_channel_removals r where r.site_id = v_site and r.archive_decision = 'apagar' and r.completed_at is null
  ), canal_tempo as (
    select c.*, public.obs_archive_etapa(coalesce(c.sem_primeiro, 0), coalesce(c.sem_nas, 0), coalesce(c.sem_snap, 0), c.min_last, coalesce(c.nao_checado, 0), v_lig, v_agora) as et
      from canal c
  ), canal_item as (
    select 'canal:' || c.channel_ref as item_id, 'canal'::text as kind,
           case when c.n_abertas > 0 and c.et = 'apagar_antigas' and c.n_arquivos > 0 then 'apagar_antigas'
                when c.n_abertas > 0 and c.et = 'conferir_b2' then 'conferir_b2' else 'sem_comando' end as tempo,
           case when c.n_abertas > 0 and c.et = 'apagar_antigas' and c.n_arquivos > 0 then null
                when c.n_abertas > 0 and c.et = 'apagar_antigas' then 'so_prefixo'
                when c.n_abertas > 0 and c.et = 'conferir_b2' then null
                when c.n_abertas > 0 then c.et
                when cardinality(c.blobs_pending) > 0 then 'blobs'
                when not c.online_thumbs_known and c.thumbs_unknown_ack_at is null then 'imagens'
                when exists (select 1 from public.obs_archive_batches b where b.site_id = c.site_id and b.kind = 'canal' and b.channel_ref = c.channel_ref
                              and b.deleted_at is null and b.closed_at is null) then 'lote_e10'
                when not v_lig then 'm9_desligado' else 'so_prefixo' end as falta,
           null::text as motivo, greatest(c.decided_at, c.reappeared_at) as desde, null::text as mes, c.channel_ref, nullif(c.youtube_channel_id, '') as youtube_id,
           c.marcado_rodado_em as marcado, 0::bigint as bloqueados, c.snap_oldest,
           case when c.n_abertas > 0 and c.et = 'apagar_antigas' and c.n_arquivos > 0 then public.obs_archive_arquivos_do_canal(v_site, c.channel_ref) else '[]'::jsonb end as apagar,
           case when c.n_abertas > 0 and c.et = 'conferir_b2' then (select coalesce(jsonb_agg(a.filho || '/' || n order by a.filho, n), '[]'::jsonb)
                                                                    from public.obs_archive_absence a cross join lateral unnest(a.b2_nomes) n
                                                                   where a.alvo = 'canal:' || c.channel_ref and a.encerrada_at is null and a.b2_absent_at is null)
                else '[]'::jsonb end as b2_nomes,
           (select coalesce(jsonb_agg(a.prefixo order by a.prefixo), '[]'::jsonb) from public.obs_archive_absence a
             where a.alvo = 'canal:' || c.channel_ref and a.prefixo not like '\_recebendo/%') as prefixos
      from canal_tempo c
  ), antiga as (
    select a.alvo as item_id, 'versao'::text as kind,
           case when e.et in ('apagar_antigas', 'conferir_b2') then e.et else 'sem_comando' end as tempo,
           case when e.et in ('apagar_antigas', 'conferir_b2') then null else e.et end as falta, null::text as motivo,
           min(a.liberado_em) as desde, to_char(min(u.month), 'YYYY-MM') as mes, min(u.channel_ref) as channel_ref, null::text as youtube_id, null::timestamptz as marcado,
           0::bigint as bloqueados, min(a.snap_oldest) filter (where a.snap_absent_at is null) as snap_oldest,
           case when e.et = 'apagar_antigas' then public.obs_archive_apagar_da_antiga(v_site, a.alvo) else '[]'::jsonb end as apagar,
           case when e.et = 'conferir_b2' then (select coalesce(jsonb_agg(a2.filho || '/' || n order by a2.filho, n), '[]'::jsonb)
                                                  from public.obs_archive_absence a2 cross join lateral unnest(a2.b2_nomes) n
                                                 where a2.alvo = a.alvo and a2.encerrada_at is null and a2.b2_absent_at is null) else '[]'::jsonb end as b2_nomes,
           '[]'::jsonb as prefixos
      from public.obs_archive_absence a join public.obs_archive_units u on u.id = a.unidade_id
      cross join lateral (select public.obs_archive_etapa(count(*) filter (where z.nas_absent_first_at is null), count(*) filter (where z.nas_absent_at is null),
                                  count(*) filter (where z.snap_absent_at is null), min(z.nas_last_absent_at), count(*) filter (where z.b2_checked_at is null), v_lig, v_agora) as et
                            from public.obs_archive_absence z where z.alvo = a.alvo and z.encerrada_at is null and z.liberado_em is not null and z.b2_absent_at is null) e
     where a.site_id = v_site and a.alvo like 'antiga:%' and a.encerrada_at is null and a.b2_absent_at is null
     group by a.alvo, e.et
  ), tudo (item_id, kind, tempo, falta, motivo, desde, mes, channel_ref, youtube_id, marcado, bloqueados, snap_oldest, apagar, b2_nomes, prefixos) as (
    select * from item_item union all select * from canal_item union all select * from antiga
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'item_id', item_id, 'kind', kind, 'tempo', tempo, 'falta', falta, 'motivo', motivo, 'desde', desde, 'mes', mes,
           'channel_ref', channel_ref, 'youtube_id', youtube_id, 'marcado_rodado_em', marcado, 'bloqueados', bloqueados,
           'snapshot_mais_antigo', snap_oldest, 'apagar', apagar, 'b2_nomes', b2_nomes, 'prefixos', prefixos) order by desde, item_id), '[]'::jsonb)
    into v_itens from tudo;
  return jsonb_build_object('versao', 2, 'lido_em', now(), 'total', jsonb_array_length(v_itens), 'itens', v_itens);
end $$;
revoke all on function public.obs_archive_owner_pending(uuid) from public, anon, authenticated;
grant execute on function public.obs_archive_owner_pending(uuid) to service_role, postgres;
