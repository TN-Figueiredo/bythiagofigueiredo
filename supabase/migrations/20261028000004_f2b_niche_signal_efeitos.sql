-- =============================================================================
-- MIGRATION: f2b_niche_signal_efeitos
-- F2b T2: medida da hipótese D2 ("destino esquentou"). Duas tabelas (efeitos e braços congelados) e quatro funções
-- (base de pares, fila, gravar, contagem). Aditivo; só service_role (sem policy nem grant para authenticated até o gatilho).
-- Linha fechada é imutável (`on conflict do nothing`). Plano: docs/superpowers/plans/2026-10-28-f2b-medida-d2-plan.md (r3.1).
-- Rollback e conferência: .superpowers/sdd/ab-lab/f2b/f2b-1-rollback.sql e f2b-1-conferir.sql (fora do git).
-- =============================================================================
set lock_timeout = '5s';

create table if not exists public.niche_signal_efeitos (
  site_id uuid not null references public.sites (id) on delete cascade,
  signal_id uuid not null references public.niche_signals (id) on delete no action,
  outlier_video_id uuid not null,              -- sem FK: o vídeo do competidor pode sair com o canal acompanhado (D4)
  canal_id uuid not null,
  outlier_published_at timestamptz not null,
  papel text not null check (papel in ('alvo', 'controle')),     -- placebo = o mesmo braço com anos_atras > 0
  metrica text not null check (metrica in ('par', 'views_total', 'impressoes_total', 'impressoes_busca', 'impressoes_canal',
                 'impressoes_sugeridos', 'impressoes_inicio', 'views_sugeridos', 'views_busca', 'views_inicio', 'prova_related')),
  anos_atras smallint not null default 0 check (anos_atras in (0, 1, 2)),
  pre numeric,
  pos numeric,
  estado text not null check (estado in ('medido', 'nao_medido')),
  motivo text check (motivo in ('cobertura', 'limiar', 'detalhe_ausente', 'pre_contaminado', 'contaminacao_desconhecida',
                                 'sem_alvo', 'sem_controle', 'outlier_apagado', 'base_zero', 'volume',
                                 'em_revisao', 'sem_valor')),
  dias_sem_cobertura integer,                  -- vídeo-dias sem soma no braço (não cabe em smallint: 600 vídeos x 58 dias)
  videos_medidos integer,                      -- vídeos do braço que entraram na soma (nulo na linha `par` e quando nao_medido)
  fechado_em timestamptz not null default now(),
  versao_regra text not null,
  primary key (signal_id, outlier_video_id, papel, metrica, anos_atras)
);

create table if not exists public.niche_signal_efeito_bracos (          -- braço guardado UMA vez por par
  site_id uuid not null references public.sites (id) on delete cascade,
  signal_id uuid not null references public.niche_signals (id) on delete no action,
  outlier_video_id uuid not null,
  papel text not null check (papel in ('alvo', 'controle')),
  anos_atras smallint not null default 0 check (anos_atras in (0, 1, 2)),
  chave text not null,                          -- chave do par congelada: troca de semente não tira o par da fila
  videos text[] not null,
  chaves_em_evento text[] not null default '{}', -- outros destinos quentes na janela (o estimador testa com e sem)
  criado_em timestamptz not null default now(),
  primary key (signal_id, outlier_video_id, papel, anos_atras)
);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'niche_signal_efeitos_coerencia') then
    alter table public.niche_signal_efeitos add constraint niche_signal_efeitos_coerencia check (
      (estado = 'medido' and motivo is null and pre is not null and pos is not null)
      or (estado = 'nao_medido' and motivo is not null));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'niche_signal_efeitos_medido_com_videos') then
    -- linha medida sem videos_medidos faria o estimador dividir por nulo em silêncio
    alter table public.niche_signal_efeitos add constraint niche_signal_efeitos_medido_com_videos check (
      estado <> 'medido' or coalesce(videos_medidos, 0) > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'niche_signal_efeitos_par') then
    -- a linha `par` é de descarte do par inteiro: sempre nao_medido, anos_atras 0 e papel 'alvo' (a PK exige papel)
    alter table public.niche_signal_efeitos add constraint niche_signal_efeitos_par check (
      metrica <> 'par' or (estado = 'nao_medido' and anos_atras = 0 and papel = 'alvo'));
  end if;
end $$;

create index if not exists niche_signal_efeitos_site_idx on public.niche_signal_efeitos (site_id, fechado_em);

alter table public.niche_signal_efeitos enable row level security;
alter table public.niche_signal_efeito_bracos enable row level security;
-- sem policy e sem grant para authenticated até o gatilho: só service_role
revoke all on public.niche_signal_efeitos, public.niche_signal_efeito_bracos from public, anon, authenticated;
grant select, insert on public.niche_signal_efeitos, public.niche_signal_efeito_bracos to service_role;
-- os privilégios padrão do Supabase dão ALL ao service_role: tira o resto (linha fechada é imutável; a cascata de FK roda como dono)
revoke update, delete, truncate on public.niche_signal_efeitos, public.niche_signal_efeito_bracos from service_role;

-- ---------------------------------------------------------------- funções (todas service_role)

-- Pares (sinal `destino` x outlier) dos últimos 120 d. Membros: os outliers de `evidence` MAIS os de `niche_outliers_vistos`
-- com a chave e que (R3-1, como oportunidades.ts:179) foram publicados em [first_seen_at - janela, fim do evento] e foram
-- vistos depois do fim do evento anterior da mesma chave (lag por (kind, subject_key)). `niche_signals_ancoras` NÃO serve
-- (usa só o último evento da chave). Chave = coalesce(video_lugares.chaves, vistos.chaves); par com braço gravado usa a chave
-- do braço e continua na fila mesmo que a semente de lugar mude.
create or replace function public.niche_signal_pares_base(p_site uuid, p_janela_dias int)
returns table (signal_id uuid, outlier_video_id uuid, canal_id uuid, outlier_published_at timestamptz, chave text, em_evidence boolean)
language sql stable security invoker set search_path = '' as $$
  with eventos as (
    select s.id, s.subject_key, s.first_seen_at, s.evidence,
           coalesce(s.dispensado_em, least(s.expires_at, now())) as fim,
           lag(coalesce(s.dispensado_em, least(s.expires_at, now()))) over (partition by s.kind, s.subject_key order by s.first_seen_at, s.id) as fim_anterior
      from public.niche_signals s
     where s.site_id = p_site and s.kind = 'destino'
  ), vivos as (
    select * from eventos e where e.first_seen_at > now() - interval '120 days'
  ), ev as (
    select e.id as sid, (o ->> 'video_id')::uuid as vid, (o ->> 'canal_id')::uuid as cid, (o ->> 'published_at')::timestamptz as pub, true as em_ev
      from vivos e
     cross join lateral jsonb_array_elements(coalesce(e.evidence -> 'outliers', '[]'::jsonb)) o
     where o ->> 'video_id' is not null and o ->> 'canal_id' is not null and o ->> 'published_at' is not null
  ), vi as (
    select e.id as sid, v.video_id as vid, v.canal_id as cid, v.published_at as pub, false as em_ev
      from vivos e
      join public.niche_outliers_vistos v on v.site_id = p_site
      left join public.video_lugares vl on vl.video_id = v.video_id and vl.site_id = p_site
     where (e.subject_key = any (coalesce(vl.chaves, v.chaves))
            or exists (select 1 from public.niche_signal_efeito_bracos b
                        where b.signal_id = e.id and b.outlier_video_id = v.video_id))
       and v.published_at >= e.first_seen_at - make_interval(days => p_janela_dias)
       and v.published_at <= e.fim
       and v.primeiro_visto_em <= e.fim
       and (e.fim_anterior is null or v.primeiro_visto_em > e.fim_anterior)
  ), todos as (
    select * from ev union all select * from vi
  ), unicos as (
    select distinct on (t.sid, t.vid) t.sid, t.vid, t.cid, t.pub, t.em_ev
      from todos t order by t.sid, t.vid, t.em_ev desc
  )
  select u.sid, u.vid, u.cid, u.pub, coalesce(b.chave, e.subject_key), u.em_ev
    from unicos u
    join vivos e on e.id = u.sid
    left join public.niche_signal_efeito_bracos b
      on b.signal_id = u.sid and b.outlier_video_id = u.vid and b.papel = 'alvo' and b.anos_atras = 0
$$;

-- Fila "par x métrica sem linha": a métrica só sai quando existem as linhas de `alvo` E `controle` com anos_atras = 0;
-- uma linha `par` (descarte) encerra o par. O catálogo de métricas vem por parâmetro.
create or replace function public.niche_signal_pares_abertos(p_site uuid, p_metricas text[], p_janela_dias int)
returns table (signal_id uuid, outlier_video_id uuid, canal_id uuid, outlier_published_at timestamptz, chave text, metricas_faltantes text[],
               videos_alvo text[], videos_controle text[])
language sql stable security invoker set search_path = '' as $$
  select b.signal_id, b.outlier_video_id, b.canal_id, b.outlier_published_at, b.chave, f.faltam, ba.videos, bc.videos
    from public.niche_signal_pares_base(p_site, p_janela_dias) b
    -- braço fixado na 1ª gravação (nulo enquanto o par não tem braço): o recálculo do dia nunca o troca
    left join public.niche_signal_efeito_bracos ba on ba.signal_id = b.signal_id and ba.outlier_video_id = b.outlier_video_id and ba.papel = 'alvo' and ba.anos_atras = 0
    left join public.niche_signal_efeito_bracos bc on bc.signal_id = b.signal_id and bc.outlier_video_id = b.outlier_video_id and bc.papel = 'controle' and bc.anos_atras = 0
   cross join lateral (
     select coalesce(array_agg(m.metrica order by m.ord), '{}'::text[]) as faltam
       from unnest(p_metricas) with ordinality m(metrica, ord)
      where not (
        exists (select 1 from public.niche_signal_efeitos x where x.signal_id = b.signal_id and x.outlier_video_id = b.outlier_video_id
                   and x.metrica = m.metrica and x.anos_atras = 0 and x.papel = 'alvo')
        and exists (select 1 from public.niche_signal_efeitos x where x.signal_id = b.signal_id and x.outlier_video_id = b.outlier_video_id
                   and x.metrica = m.metrica and x.anos_atras = 0 and x.papel = 'controle'))
   ) f
   where cardinality(f.faltam) > 0
     and not exists (select 1 from public.niche_signal_efeitos x where x.signal_id = b.signal_id and x.outlier_video_id = b.outlier_video_id and x.metrica = 'par')
$$;

-- Grava braços e linhas numa transação, só onde o sinal pertence a p_site; `on conflict do nothing` (imutável);
-- `fechado_em` por now(). Devolve só números.
create or replace function public.niche_signal_efeitos_gravar(p_site uuid, p_bracos jsonb, p_linhas jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_br_total int; v_br_ok int; v_br_ins int;
  v_li_total int; v_li_ok int; v_li_ins int;
begin
  if jsonb_typeof(p_bracos) is distinct from 'array' or jsonb_typeof(p_linhas) is distinct from 'array' then
    raise exception 'p_bracos e p_linhas devem ser arrays' using errcode = '22023';
  end if;

  with r as (
    select * from jsonb_to_recordset(p_bracos) as x(signal_id uuid, outlier_video_id uuid, papel text, anos_atras smallint,
                                                    chave text, videos text[], chaves_em_evento text[])
  ), ok as (
    select r.* from r join public.niche_signals s on s.id = r.signal_id and s.site_id = p_site
  ), ins as (
    insert into public.niche_signal_efeito_bracos (site_id, signal_id, outlier_video_id, papel, anos_atras, chave, videos, chaves_em_evento)
    select p_site, ok.signal_id, ok.outlier_video_id, ok.papel, coalesce(ok.anos_atras, 0), ok.chave, ok.videos, coalesce(ok.chaves_em_evento, '{}')
      from ok
    on conflict do nothing
    returning 1
  )
  select (select count(*) from r), (select count(*) from ok), (select count(*) from ins) into v_br_total, v_br_ok, v_br_ins;

  with r as (
    select * from jsonb_to_recordset(p_linhas) as x(signal_id uuid, outlier_video_id uuid, canal_id uuid, outlier_published_at timestamptz,
                                                    papel text, metrica text, anos_atras smallint, pre numeric, pos numeric,
                                                    estado text, motivo text, dias_sem_cobertura integer, videos_medidos integer, versao_regra text)
  ), ok as (
    select r.* from r join public.niche_signals s on s.id = r.signal_id and s.site_id = p_site
  ), ins as (
    insert into public.niche_signal_efeitos (site_id, signal_id, outlier_video_id, canal_id, outlier_published_at, papel, metrica, anos_atras,
                                             pre, pos, estado, motivo, dias_sem_cobertura, videos_medidos, versao_regra)
    select p_site, ok.signal_id, ok.outlier_video_id, ok.canal_id, ok.outlier_published_at, ok.papel, ok.metrica, coalesce(ok.anos_atras, 0),
           ok.pre, ok.pos, ok.estado, ok.motivo, ok.dias_sem_cobertura, ok.videos_medidos, ok.versao_regra
      from ok
    on conflict do nothing
    returning 1
  )
  select (select count(*) from r), (select count(*) from ok), (select count(*) from ins) into v_li_total, v_li_ok, v_li_ins;

  return jsonb_build_object(
    'inseridas', v_li_ins, 'ignoradas', v_li_ok - v_li_ins,
    'bracos_inseridos', v_br_ins, 'bracos_ignorados', v_br_ok - v_br_ins,
    'de_outro_site', (v_li_total - v_li_ok) + (v_br_total - v_br_ok));
end $$;

-- Contagem só com números (a tarefa publica no `detalhe`), mais `v0` (data PT de min(primeiro_visto_em), ou nulo), que a
-- tarefa usa só para montar os pares e nunca publica. `pares_abertos` = pares sem linha `par` e sem `views_total` fechada
-- nos dois papéis (R2/R3/R5 fecham em pub+34, antes de R1; `views_total` é só o marcador de "par ainda aberto").
create or replace function public.niche_signal_medida_contagem(p_site uuid, p_janela_dias int) returns jsonb
language sql stable security invoker set search_path = '' as $$
  with base as (select * from public.niche_signal_pares_base(p_site, p_janela_dias)),
  vivos as (
    select s.id from public.niche_signals s
     where s.site_id = p_site and s.kind = 'destino' and s.first_seen_at > now() - interval '120 days')
  select jsonb_build_object(
    'pares_abertos', (select count(*) from base b
        where not exists (select 1 from public.niche_signal_efeitos x where x.signal_id = b.signal_id and x.outlier_video_id = b.outlier_video_id and x.metrica = 'par')
          and not (exists (select 1 from public.niche_signal_efeitos x where x.signal_id = b.signal_id and x.outlier_video_id = b.outlier_video_id
                             and x.metrica = 'views_total' and x.anos_atras = 0 and x.papel = 'alvo')
               and exists (select 1 from public.niche_signal_efeitos x where x.signal_id = b.signal_id and x.outlier_video_id = b.outlier_video_id
                             and x.metrica = 'views_total' and x.anos_atras = 0 and x.papel = 'controle'))),
    'eventos_fechados', (select count(distinct x.signal_id) from public.niche_signal_efeitos x
        where x.site_id = p_site and x.estado = 'medido' and x.metrica <> 'par' and x.papel = 'alvo' and x.anos_atras = 0),
    'sem_ancora', (select count(*) from vivos v where not exists (select 1 from base b where b.signal_id = v.id)),
    'fora_de_evidence', (select count(*) from base b where not b.em_evidence),
    'sem_entrada', case when exists (select 1 from public.niche_outliers_vistos where site_id = p_site)
                          or exists (select 1 from public.niche_signals where site_id = p_site and kind = 'destino') then 0 else 1 end,
    'v0', (select to_char(min(v.primeiro_visto_em) at time zone 'America/Los_Angeles', 'YYYY-MM-DD')
             from public.niche_outliers_vistos v where v.site_id = p_site))
$$;

revoke all on function public.niche_signal_pares_base(uuid, int) from public, anon, authenticated;
revoke all on function public.niche_signal_pares_abertos(uuid, text[], int) from public, anon, authenticated;
revoke all on function public.niche_signal_efeitos_gravar(uuid, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.niche_signal_medida_contagem(uuid, int) from public, anon, authenticated;
grant execute on function public.niche_signal_pares_base(uuid, int) to service_role;
grant execute on function public.niche_signal_pares_abertos(uuid, text[], int) to service_role;
grant execute on function public.niche_signal_efeitos_gravar(uuid, jsonb, jsonb) to service_role;
grant execute on function public.niche_signal_medida_contagem(uuid, int) to service_role;

reset lock_timeout;
