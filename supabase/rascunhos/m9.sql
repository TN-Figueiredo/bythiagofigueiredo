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
