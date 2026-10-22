-- =============================================================================
-- MIGRATION: f2_niche_signals
-- F2 T4: `niche_signals`, `niche_outliers_vistos`, `niche_signals_estado` e as funções de gravar, expirar, dispensar
-- e ler âncoras. Aditivo; depende da f2_lugares só por convenção (nenhuma FK).
-- Rollback: drop function niche_signals_ancoras, niche_signals_dispensar, niche_signals_gravar, niche_signals_expirar,
--           niche_signals_sincronizar_sino, niche_signals_mesclar_evidence; drop table niche_signals_estado,
--           niche_outliers_vistos, niche_signals.
-- =============================================================================
set lock_timeout = '5s';

create table if not exists public.niche_signals (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete cascade,
  kind text not null check (kind in ('destino', 'parecido')),
  subject_key text not null,
  rule_version text not null,
  evidence jsonb not null,
  forca numeric(8, 2) not null,
  acao text not null check (acao in ('titulo_descricao', 'playlist', 'video_novo', 'titulo_complementar', 'thumbnail_ideias')),
  status text not null default 'aberto' check (status in ('aberto', 'dispensado', 'feito', 'expirado')),
  first_seen_at timestamptz not null,
  computed_at timestamptz not null,
  expires_at timestamptz not null,
  dispensado_em timestamptz,
  motivo text not null,
  notificar_como text not null default 'individual' check (notificar_como in ('individual', 'resumo')),
  notificado_em timestamptz,
  notificacao_tentativas smallint not null default 0,
  notificacao_falhou_em timestamptz,
  dispensa_motivo text check (dispensa_motivo in ('nao_e_parecido', 'lugar_errado', 'ja_fiz', 'nao_interessa')),
  dispensado_por text
);
create unique index if not exists niche_signals_aberto_uq on public.niche_signals (site_id, kind, subject_key) where status = 'aberto';
create index if not exists niche_signals_site_status_idx on public.niche_signals (site_id, status, expires_at);
create index if not exists niche_signals_pendentes_idx on public.niche_signals (site_id)
  where notificado_em is null and notificacao_falhou_em is null and status = 'aberto';

create table if not exists public.niche_outliers_vistos (
  site_id uuid not null references public.sites (id) on delete cascade,
  video_id uuid not null,
  canal_id uuid not null,
  formato text not null,
  published_at timestamptz not null,
  n_canal int not null,
  primeiro_visto_em timestamptz not null,
  ultimo_visto_em timestamptz not null,
  mult_max numeric(8, 2) not null,
  vpd7_max numeric not null,
  chaves text[] not null,
  primary key (site_id, video_id)
);

create table if not exists public.niche_signals_estado (
  site_id uuid primary key references public.sites (id) on delete cascade,
  computed_at timestamptz not null,
  rule_version text not null,
  motivo_vazio text check (motivo_vazio in ('sem-historico', 'sem-terceiro-outlier', 'sem-lugar', 'sync-atrasado', 'abaixo-do-minimo', 'sem-grupo')),
  contagens jsonb not null,
  baseline_em timestamptz
);

alter table public.niche_signals enable row level security;
alter table public.niche_outliers_vistos enable row level security;
alter table public.niche_signals_estado enable row level security;

revoke all on public.niche_signals, public.niche_outliers_vistos, public.niche_signals_estado from public, anon, authenticated;
grant select on public.niche_signals, public.niche_outliers_vistos, public.niche_signals_estado to authenticated;
grant select, insert, update, delete on public.niche_signals, public.niche_outliers_vistos, public.niche_signals_estado to service_role;

drop policy if exists niche_signals_select on public.niche_signals;
create policy niche_signals_select on public.niche_signals for select to authenticated using (public.can_edit_site(site_id));
drop policy if exists niche_outliers_vistos_select on public.niche_outliers_vistos;
create policy niche_outliers_vistos_select on public.niche_outliers_vistos for select to authenticated using (public.can_edit_site(site_id));
drop policy if exists niche_signals_estado_select on public.niche_signals_estado;
create policy niche_signals_estado_select on public.niche_signals_estado for select to authenticated using (public.can_edit_site(site_id));

-- ---------------------------------------------------------------- funções (todas service_role)

-- Evidência: criação (p_antiga nula) fica com os 20 mais fortes; depois só acrescenta outliers novos até o teto de 20,
-- sem remover nem mudar os existentes (published_at e canal_id gravados na criação). `outliers_total`, `canais` só crescem.
create or replace function public.niche_signals_mesclar_evidence(p_antiga jsonb, p_nova jsonb) returns jsonb
language plpgsql immutable security invoker set search_path = '' as $$
declare
  v_base jsonb;
  v_novos jsonb;
  v_lista jsonb;
  v_total numeric;
begin
  v_novos := coalesce(p_nova -> 'outliers', '[]'::jsonb);
  if p_antiga is null then
    select coalesce(jsonb_agg(e order by (e ->> 'mult_vpd7')::numeric desc nulls last, ord), '[]'::jsonb) into v_lista
      from (select e, ord from jsonb_array_elements(v_novos) with ordinality t(e, ord)
            order by (e ->> 'mult_vpd7')::numeric desc nulls last, ord limit 20) x;
    v_total := greatest(coalesce((p_nova ->> 'outliers_total')::numeric, 0), jsonb_array_length(v_novos));
    return p_nova || jsonb_build_object('outliers', v_lista, 'outliers_total', v_total);
  end if;
  v_base := coalesce(p_antiga -> 'outliers', '[]'::jsonb);
  select v_base || coalesce(jsonb_agg(n.e order by n.ord), '[]'::jsonb) into v_lista
    from jsonb_array_elements(v_novos) with ordinality n(e, ord)
   where not exists (select 1 from jsonb_array_elements(v_base) b where b ->> 'video_id' = n.e ->> 'video_id');
  select coalesce(jsonb_agg(e order by ord), '[]'::jsonb) into v_lista
    from jsonb_array_elements(v_lista) with ordinality t(e, ord) where ord <= 20;
  v_total := greatest(coalesce((p_antiga ->> 'outliers_total')::numeric, 0), coalesce((p_nova ->> 'outliers_total')::numeric, 0), jsonb_array_length(v_lista));
  return p_antiga || jsonb_build_object(
    'outliers', v_lista,
    'outliers_total', v_total,
    'canais', greatest(coalesce((p_antiga ->> 'canais')::numeric, 0), coalesce((p_nova ->> 'canais')::numeric, 0)),
    'proprios', coalesce(p_nova -> 'proprios', p_antiga -> 'proprios', '[]'::jsonb));
end $$;

-- Expira no sino as notificações cujo sinal não está mais `aberto`, e os resumos sem nenhum id aberto.
create or replace function public.niche_signals_sincronizar_sino(p_site uuid) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  update public.notifications n set expired_at = now()
   where n.site_id = p_site and n.domain = 'youtube' and n.type = 'youtube.niche_signal'
     and n.expired_at is null and n.dedup_key like 'nicho:%'
     and not exists (select 1 from public.niche_signals s
                      where s.site_id = p_site and 'nicho:' || s.id::text = n.dedup_key and s.status = 'aberto');
  update public.notifications n set expired_at = now()
   where n.site_id = p_site and n.domain = 'youtube' and n.type = 'youtube.niche_signal'
     and n.expired_at is null and n.dedup_key like 'nicho-resumo:%'
     and not exists (select 1 from jsonb_array_elements_text(coalesce(n.payload -> 'ids', '[]'::jsonb)) i(id)
                      join public.niche_signals s on s.id::text = i.id and s.site_id = p_site and s.status = 'aberto');
end $$;

create or replace function public.niche_signals_expirar(p_site uuid) returns integer
language plpgsql security invoker set search_path = '' as $$
declare n integer;
begin
  if p_site is null then raise exception 'niche_signals_expirar: site nulo' using errcode = '22004'; end if;
  update public.niche_signals set status = 'expirado'
   where site_id = p_site and status = 'aberto' and expires_at <= now();
  get diagnostics n = row_count;
  perform public.niche_signals_sincronizar_sino(p_site);
  return n;
end $$;

-- p_lote: [{kind, subject_key, rule_version?, evidence, forca, acao, motivo, notificar_como?}]
-- p_estado: {rule_version, motivo_vazio, contagens}; p_vistos: [{video_id, canal_id, formato, published_at, n_canal, mult_max, vpd7_max, chaves[]}]
create or replace function public.niche_signals_gravar(p_site uuid, p_lote jsonb, p_estado jsonb, p_linha_de_base boolean, p_vistos jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_expirados integer;
  v_novos uuid[];
  v_atualizados integer;
begin
  if p_site is null or p_estado is null then raise exception 'niche_signals_gravar: parametro nulo' using errcode = '22004'; end if;
  v_expirados := public.niche_signals_expirar(p_site);

  with item as (
    select * from jsonb_to_recordset(coalesce(p_lote, '[]'::jsonb)) as x(
      kind text, subject_key text, rule_version text, evidence jsonb, forca numeric, acao text, motivo text, notificar_como text)
  ), ins as (
    insert into public.niche_signals (site_id, kind, subject_key, rule_version, evidence, forca, acao, status,
                                      first_seen_at, computed_at, expires_at, motivo, notificar_como)
    select p_site, i.kind, i.subject_key, coalesce(i.rule_version, p_estado ->> 'rule_version'),
           public.niche_signals_mesclar_evidence(null, i.evidence), i.forca, i.acao, 'aberto',
           now(), now(), now() + interval '30 days', i.motivo,
           case when p_linha_de_base then 'resumo' else coalesce(i.notificar_como, 'individual') end
      from item i
     where not exists (select 1 from public.niche_signals s
                        where s.site_id = p_site and s.kind = i.kind and s.subject_key = i.subject_key and s.status = 'aberto')
       and not exists (select 1 from public.niche_signals s
                        where s.site_id = p_site and s.kind = i.kind and s.subject_key = i.subject_key
                          and s.status = 'dispensado' and s.dispensado_em > now() - interval '30 days')
    on conflict (site_id, kind, subject_key) where status = 'aberto' do nothing
    returning id
  )
  select coalesce(array_agg(id), '{}') into v_novos from ins;

  with item as (
    select * from jsonb_to_recordset(coalesce(p_lote, '[]'::jsonb)) as x(
      kind text, subject_key text, rule_version text, evidence jsonb, forca numeric, acao text, motivo text, notificar_como text)
  )
  update public.niche_signals s
     set evidence = public.niche_signals_mesclar_evidence(s.evidence, i.evidence),
         forca = i.forca, motivo = i.motivo,
         rule_version = coalesce(i.rule_version, p_estado ->> 'rule_version'), computed_at = now()
    from item i
   where s.site_id = p_site and s.kind = i.kind and s.subject_key = i.subject_key and s.status = 'aberto'
     and s.id <> all (v_novos);
  get diagnostics v_atualizados = row_count;

  insert into public.niche_outliers_vistos (site_id, video_id, canal_id, formato, published_at, n_canal,
                                            primeiro_visto_em, ultimo_visto_em, mult_max, vpd7_max, chaves)
  select p_site, v.video_id, v.canal_id, v.formato, v.published_at, v.n_canal, now(), now(), v.mult_max, v.vpd7_max, v.chaves
    from jsonb_to_recordset(coalesce(p_vistos, '[]'::jsonb)) as v(
      video_id uuid, canal_id uuid, formato text, published_at timestamptz, n_canal int, mult_max numeric, vpd7_max numeric, chaves text[])
  on conflict (site_id, video_id) do update
     set primeiro_visto_em = least(public.niche_outliers_vistos.primeiro_visto_em, excluded.primeiro_visto_em),
         ultimo_visto_em = greatest(public.niche_outliers_vistos.ultimo_visto_em, excluded.ultimo_visto_em),
         mult_max = greatest(public.niche_outliers_vistos.mult_max, excluded.mult_max),
         vpd7_max = greatest(public.niche_outliers_vistos.vpd7_max, excluded.vpd7_max),
         n_canal = excluded.n_canal, chaves = excluded.chaves;

  -- baseline_em fica de fora do do-update de propósito: só o outbox o grava.
  insert into public.niche_signals_estado (site_id, computed_at, rule_version, motivo_vazio, contagens)
  values (p_site, now(), p_estado ->> 'rule_version', p_estado ->> 'motivo_vazio', coalesce(p_estado -> 'contagens', '{}'::jsonb))
  on conflict (site_id) do update
     set computed_at = excluded.computed_at, rule_version = excluded.rule_version,
         motivo_vazio = excluded.motivo_vazio, contagens = excluded.contagens;

  return jsonb_build_object('novos', coalesce(array_length(v_novos, 1), 0), 'atualizados', v_atualizados, 'expirados', v_expirados);
end $$;

create or replace function public.niche_signals_dispensar(p_site uuid, p_id uuid, p_status text, p_motivo text, p_por text) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare s public.niche_signals;
begin
  select * into s from public.niche_signals where id = p_id and site_id = p_site for update;
  if not found then return jsonb_build_object('ok', false, 'motivo', 'nao_encontrado'); end if;
  if s.status <> 'aberto' then return jsonb_build_object('ok', false, 'motivo', 'nao_aberto'); end if;
  if p_status is null or p_status not in ('dispensado', 'feito')
     or (p_motivo is null and p_status <> 'feito')
     or (p_motivo is not null and p_motivo not in ('nao_e_parecido', 'lugar_errado', 'ja_fiz', 'nao_interessa'))
     or (p_motivo = 'nao_e_parecido' and s.kind <> 'parecido')
     or (p_motivo = 'lugar_errado' and s.kind <> 'destino') then
    return jsonb_build_object('ok', false, 'motivo', 'motivo_invalido');
  end if;
  update public.niche_signals set status = p_status, dispensado_em = now(), dispensa_motivo = p_motivo, dispensado_por = p_por
   where id = p_id;
  perform public.niche_signals_sincronizar_sino(p_site);
  return jsonb_build_object('ok', true);
end $$;

-- Âncoras (Phil 5, A3): por chave, os vídeos já vistos até o fim do último evento da chave (60 d). A borda recompõe as
-- chaves por `video_lugares` (M2); aqui a leitura é de `niche_outliers_vistos.chaves`, sem teto.
create or replace function public.niche_signals_ancoras(p_site uuid) returns table (subject_key text, video_id uuid)
language sql stable security invoker set search_path = '' as $$
  with ultimo as (
    select distinct on (s.subject_key) s.subject_key, coalesce(s.dispensado_em, least(s.expires_at, now())) as fim
      from public.niche_signals s
     where s.site_id = p_site and s.first_seen_at > now() - interval '60 days'
     order by s.subject_key, s.first_seen_at desc, s.id)
  select u.subject_key, v.video_id
    from ultimo u
    join public.niche_outliers_vistos v on v.site_id = p_site and u.subject_key = any (v.chaves) and v.primeiro_visto_em <= u.fim
$$;

revoke all on function public.niche_signals_mesclar_evidence(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.niche_signals_sincronizar_sino(uuid) from public, anon, authenticated;
revoke all on function public.niche_signals_expirar(uuid) from public, anon, authenticated;
revoke all on function public.niche_signals_gravar(uuid, jsonb, jsonb, boolean, jsonb) from public, anon, authenticated;
revoke all on function public.niche_signals_dispensar(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.niche_signals_ancoras(uuid) from public, anon, authenticated;
grant execute on function public.niche_signals_mesclar_evidence(jsonb, jsonb) to service_role;
grant execute on function public.niche_signals_sincronizar_sino(uuid) to service_role;
grant execute on function public.niche_signals_expirar(uuid) to service_role;
grant execute on function public.niche_signals_gravar(uuid, jsonb, jsonb, boolean, jsonb) to service_role;
grant execute on function public.niche_signals_dispensar(uuid, uuid, text, text, text) to service_role;
grant execute on function public.niche_signals_ancoras(uuid) to service_role;

reset lock_timeout;
