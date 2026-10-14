-- A5, E4 (MG4): marcas de views nas idades 1, 7 e 30 dias dos vídeos de concorrentes, e o registro do que não pôde ser medido.
-- Aditiva: duas tabelas novas (vazias) e três funções novas. Nenhuma tabela existente é alterada; o código que está em
-- produção não lê nem grava nada daqui. Idempotente (pode ser aplicada duas vezes).
-- A idade conta de greatest(published_at, live_actual_start_at), a mesma base dos retratos de comentários (MG8).
-- A conta (interpolação e limites) é do código (função pura de M1); o banco só entrega as leituras vizinhas e guarda o resultado.
-- (emenda 1: C-1) Vídeo agendado ou no ar (live_broadcast_content 'upcoming' ou 'live') não tem idade: fica fora das três
-- funções, como na MG8. Marca ou motivo decidido com uma base que depois mudou é apagado e o par é refeito pela série.
-- (emenda 2) Quem grava devolve a base que recebeu (base_at) e o banco confere; linha de vídeo que passou a agendado ou
-- no ar é apagada; a prova não conta vídeo sem data; os pendentes trazem a faixa do vídeo e o motivo anterior do par.

-- (R3, tarefa 8b) Canal com a coleta pausada (MG6) não tem par pendente nem atrasado; cada item de competitor_marks_pending diz
-- se o buraco entre as leituras vizinhas cruza uma pausa registrada (gap_crossed_pause) e a função devolve pares_em_pausa.

-- (R3, tarefa 8b) A pausa de coleta mora na MG6 (competitor_channels.collection_paused_at e competitor_collection_pauses): a MG4 não
-- se aplica pela metade. Guarda: primeira instrução do arquivo.
do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'competitor_channels' and column_name = 'collection_paused_at')
     or to_regclass('public.competitor_collection_pauses') is null then
    raise exception 'MG4 depende da MG6';
  end if;
end $$;

set lock_timeout = '5s';

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. A marca: uma linha por vídeo e idade, gravada UMA vez. Sem linha = não medido (o motivo fica na tabela 2).
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.competitor_video_marks (
  video_id uuid not null references public.competitor_videos(id) on delete cascade,
  age_days smallint not null check (age_days in (1, 7, 30)),
  site_id uuid not null references public.sites(id) on delete cascade,
  views bigint not null check (views >= 0),
  likes bigint check (likes is null or likes >= 0),
  comments bigint check (comments is null or comments >= 0),
  likes_hidden boolean,
  comments_disabled boolean,
  rule_version smallint not null default 1,
  gap_hours numeric not null check (gap_hours >= 0),
  computed_at timestamptz not null default now(),
  age_base_at timestamptz not null,
  read_before_at timestamptz not null,
  read_after_at timestamptz not null,
  primary key (video_id, age_days),
  constraint competitor_video_marks_reads_check check (read_before_at <= read_after_at)
);
create index if not exists idx_cvm_site on public.competitor_video_marks (site_id);
comment on table public.competitor_video_marks is 'A5 E4: views (e curtidas e comentários) de um vídeo de concorrente na idade de 1, 7 ou 30 dias, por interpolação linear entre as duas leituras vizinhas. Gravada uma vez, quando a idade fecha; nunca regravada, salvo quando a base da idade do vídeo mudou depois (age_base_at diferente da base atual: a linha é apagada e o par é refeito). Sem linha = não medido (o motivo está em competitor_video_mark_misses).';
comment on column public.competitor_video_marks.likes is 'Nulo = oculto pelo canal ou não medido (ver likes_hidden). Nunca zero por falta.';
comment on column public.competitor_video_marks.comments is 'Nulo = desligado ou não medido (ver comments_disabled). Nunca zero por falta.';
comment on column public.competitor_video_marks.likes_hidden is 'O estado NA MARCA. false = curtidas medidas; true = ocultas pelo canal; nulo com likes nulo = não medido (não se sabe).';
comment on column public.competitor_video_marks.comments_disabled is 'O estado NA MARCA. false = comentários medidos; true = desligados; nulo com comments nulo = não medido (não se sabe).';
comment on column public.competitor_video_marks.rule_version is 'Versão da regra de M1 (interpolação e limites de distância) com que a marca foi gravada.';
comment on column public.competitor_video_marks.gap_hours is 'Distância, em horas, entre as duas leituras usadas (read_after_at menos read_before_at). Calculada pelo banco.';
comment on column public.competitor_video_marks.age_base_at is 'O instante zero da idade usado: o maior entre published_at e live_actual_start_at, lido do vídeo na hora da gravação.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. O que não pôde ser medido, com o motivo (catálogo fechado). É o "motivo registrado" que o export (E10) confere.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.competitor_video_mark_misses (
  video_id uuid not null references public.competitor_videos(id) on delete cascade,
  age_days smallint not null check (age_days in (1, 7, 30)),
  site_id uuid not null references public.sites(id) on delete cascade,
  reason text not null check (reason in ('sem_leitura', 'views_ocultas', 'leitura_comecou_depois', 'descoberto_tarde', 'leitura_parou_antes', 'leituras_distantes')),
  since_at timestamptz,
  rule_version smallint not null,
  age_base_at timestamptz not null,
  decided_at timestamptz not null default now(),
  primary key (video_id, age_days)
);
create index if not exists idx_cvmm_site on public.competitor_video_mark_misses (site_id);
comment on table public.competitor_video_mark_misses is 'A5 E4: a idade fechou e a marca NÃO foi gravada, com o motivo (código de catálogo fechado; a frase que o dono lê sai do código). Um par (vídeo, idade) está em competitor_video_marks OU aqui, nunca nos dois. Regra nova (rule_version maior) reavalia a linha enquanto a série existir.';
comment on column public.competitor_video_mark_misses.since_at is 'leitura_comecou_depois e descoberto_tarde: a primeira leitura do vídeo. leitura_parou_antes: a última. Nulo nos demais.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RLS. Dado público do YouTube: leitura por can_view_site, como as outras competitor_*. Nenhuma policy de escrita.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.competitor_video_marks enable row level security;
alter table public.competitor_video_mark_misses enable row level security;
drop policy if exists "competitor_video_marks_select" on public.competitor_video_marks;
create policy "competitor_video_marks_select" on public.competitor_video_marks
  for select using (public.can_view_site(site_id));
drop policy if exists "competitor_video_mark_misses_select" on public.competitor_video_mark_misses;
create policy "competitor_video_mark_misses_select" on public.competitor_video_mark_misses
  for select using (public.can_view_site(site_id));
revoke all on public.competitor_video_marks, public.competitor_video_mark_misses from anon;
revoke insert, update, delete, truncate, references, trigger on public.competitor_video_marks, public.competitor_video_mark_misses from authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Os pares (vídeo, idade) cuja idade fechou e que ainda não têm marca nem motivo desta versão da regra, com as
--    leituras vizinhas do instante alvo. Só lê. O mais recente primeiro.
--    (emenda 1: C-1) Fora o vídeo agendado ou no ar; marca ou motivo com a base antiga não conta como decisão.
--    (emenda 1: I-3) Devolve missing_since, para o código separar "o vídeo saiu do YouTube" de "a coleta teve buraco".
--    (emenda 2: m-3 e m-8 de dados, n3 de software) Devolve series_tier (a faixa do vídeo na hora) e prev_reason (o motivo
--    que o par já tinha com ESTA base, nulo se não havia), para o aviso de marca perdida não repetir perda já avisada.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.competitor_marks_pending(
  p_now timestamptz, p_rule_version integer, p_limit integer, p_gap_hours_day1 numeric, p_gap_hours numeric
) returns jsonb
language sql stable security invoker set search_path = '' as $$
  with a(age_days, gap) as (
    values (1, make_interval(secs => (p_gap_hours_day1 * 3600)::double precision)),
           (7, make_interval(secs => (p_gap_hours * 3600)::double precision)),
           (30, make_interval(secs => (p_gap_hours * 3600)::double precision))
  ), cand as (
    select v.id as video_id, c.id as channel_id, c.site_id, c.collection_paused_at, v.discovered_at, v.views_hidden, v.likes_hidden,
           v.comments_disabled, v.missing_since, v.series_tier, a.age_days, a.gap, b.t0, b.t0 + make_interval(days => a.age_days) as t_alvo
      from public.competitor_videos v
      join public.competitor_channels c on c.id = v.competitor_channel_id
      cross join lateral (select greatest(v.published_at, coalesce(v.live_actual_start_at, v.published_at)) as t0) b
      cross join a
     where v.published_at is not null
       and coalesce(v.live_broadcast_content, 'none') not in ('upcoming', 'live')
       and p_now is not null and p_rule_version is not null and p_gap_hours_day1 > 0 and p_gap_hours > 0
       and b.t0 + make_interval(days => a.age_days) <= p_now - interval '30 minutes'
       and not exists (select 1 from public.competitor_video_marks m
                        where m.video_id = v.id and m.age_days = a.age_days and m.age_base_at = b.t0)
       and not exists (select 1 from public.competitor_video_mark_misses x
                        where x.video_id = v.id and x.age_days = a.age_days and x.rule_version >= p_rule_version and x.age_base_at = b.t0)
  ), todos as (
    select * from cand where collection_paused_at is null
  ), pend as (
    select * from todos order by t0 desc, video_id, age_days
     limit greatest(least(coalesce(p_limit, 500), 2000), 1)
  ), lim as (
    -- o intervalo sem leitura em volta do alvo: da última leitura até o alvo (ou o próprio alvo) à primeira depois dele (ou p_now)
    select p.video_id, p.age_days,
           coalesce((select max(x.taken_at) from (
                       select e.taken_at from public.competitor_video_early e where e.video_id = p.video_id and e.taken_at <= p.t_alvo
                       union all
                       select d.taken_at from public.competitor_video_daily d where d.video_id = p.video_id and d.taken_at <= p.t_alvo) x), p.t_alvo) as ini,
           coalesce((select min(x.taken_at) from (
                       select e.taken_at from public.competitor_video_early e where e.video_id = p.video_id and e.taken_at >= p.t_alvo
                       union all
                       select d.taken_at from public.competitor_video_daily d where d.video_id = p.video_id and d.taken_at >= p.t_alvo) x), p_now) as fim
      from pend p
  ), pausas as (
    -- as interseções do intervalo com as pausas do canal, unidas (pausas sobrepostas contam uma vez)
    select l.video_id, l.age_days, l.ini, l.fim, count(cp.id) as n_pausas,
           range_agg(tstzrange(greatest(cp.paused_at, l.ini), least(coalesce(cp.resumed_at, p_now), l.fim))) filter (where cp.id is not null) as mr
      from lim l
      join pend p on p.video_id = l.video_id and p.age_days = l.age_days
      left join public.competitor_collection_pauses cp
        on cp.competitor_channel_id = p.channel_id
       and cp.paused_at < l.fim and coalesce(cp.resumed_at, p_now) > l.ini
     group by l.video_id, l.age_days, l.ini, l.fim
  ), cruz as (
    -- a pausa só explica o buraco se o tempo NÃO pausado dele coubesse no limite do par
    select q.video_id, q.age_days,
           (q.n_pausas > 0
            and (q.fim - q.ini) - coalesce((select sum(upper(r) - lower(r)) from unnest(q.mr) r), interval '0') <= p.gap) as gap_crossed_pause
      from pausas q
      join pend p on p.video_id = q.video_id and p.age_days = q.age_days
  )
  select jsonb_build_object(
    'total_pendentes', (select count(*) from todos),
    'pares_em_pausa', (select count(*) from cand where collection_paused_at is not null),
    'itens', coalesce((
      select jsonb_agg(jsonb_build_object(
        'video_id', p.video_id, 'site_id', p.site_id, 'age_days', p.age_days, 'base_at', p.t0, 'target_at', p.t_alvo,
        'discovered_at', p.discovered_at, 'views_hidden', p.views_hidden, 'likes_hidden', p.likes_hidden, 'comments_disabled', p.comments_disabled,
        'missing_since', p.missing_since, 'series_tier', p.series_tier,
        'gap_crossed_pause', coalesce(z.gap_crossed_pause, false),
        'prev_reason', (select x.reason from public.competitor_video_mark_misses x
                         where x.video_id = p.video_id and x.age_days = p.age_days and x.age_base_at = p.t0),
        'first_reading_at', least(
          (select min(e.taken_at) from public.competitor_video_early e where e.video_id = p.video_id),
          (select d.taken_at from public.competitor_video_daily d where d.video_id = p.video_id order by d.snap_date asc limit 1)),
        'last_reading_at', greatest(
          (select max(e.taken_at) from public.competitor_video_early e where e.video_id = p.video_id),
          (select d.taken_at from public.competitor_video_daily d where d.video_id = p.video_id order by d.snap_date desc limit 1)),
        'readings', coalesce((
          select jsonb_agg(jsonb_build_object('t', r.taken_at, 'views', r.views, 'likes', r.likes, 'comments', r.comments) order by r.taken_at)
            from (
              select e.taken_at, e.views, e.likes, e.comments
                from public.competitor_video_early e
               where e.video_id = p.video_id
                 and e.taken_at between p.t_alvo - p.gap - interval '1 hour' and p.t_alvo + p.gap + interval '1 hour'
              union all
              select d.taken_at, d.views, d.likes, d.comments
                from public.competitor_video_daily d
               where d.video_id = p.video_id
                 and d.snap_date between ((p.t_alvo - p.gap) at time zone 'UTC')::date - 2 and ((p.t_alvo + p.gap) at time zone 'UTC')::date + 2
                 and d.taken_at between p.t_alvo - p.gap - interval '1 hour' and p.t_alvo + p.gap + interval '1 hour'
            ) r), '[]'::jsonb)
      ) order by p.t0 desc, p.video_id, p.age_days)
      from pend p
      left join cruz z on z.video_id = p.video_id and z.age_days = p.age_days), '[]'::jsonb)
  );
$$;
revoke all on function public.competitor_marks_pending(timestamptz, integer, integer, numeric, numeric) from public, anon, authenticated;
grant execute on function public.competitor_marks_pending(timestamptz, integer, integer, numeric, numeric) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. A prova (o alarme). Só lê.
--    atrasadas: pares cuja idade fechou há mais que o limite de distância + 48 h e que não têm marca nem motivo.
--    (R3, tarefa 8b) atrasadas não conta o par de canal com a coleta pausada (collection_paused_at preenchido).
--    em_duas_tabelas: par com marca E motivo (não pode existir).
--    site_divergente: marca ou motivo cujo site_id não é o do canal do vídeo (não pode existir).
--    base_divergente (emenda 1: C-1): marca ou motivo cuja base gravada não é a base atual do vídeo. Lida logo depois de
--    gravar tem de ser 0 (o gravar apaga essas linhas); lida solta, entre duas execuções, pode ser maior que 0 por um dia.
--    (emenda 2: m-5 de dados) Vídeo sem data não conta: o gravar não apaga a linha dele, e a prova ficaria vermelha para sempre.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.competitor_marks_health(p_now timestamptz, p_gap_hours_day1 numeric, p_gap_hours numeric)
returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
begin
  if p_now is null or p_gap_hours_day1 is null or p_gap_hours is null or p_gap_hours_day1 <= 0 or p_gap_hours <= 0 then
    raise exception 'competitor_marks_health: p_now, p_gap_hours_day1 e p_gap_hours são obrigatórios e os limites têm de ser positivos';
  end if;
  return (
    with a(age_days, gap) as (
      values (1, make_interval(secs => (p_gap_hours_day1 * 3600)::double precision)),
             (7, make_interval(secs => (p_gap_hours * 3600)::double precision)),
             (30, make_interval(secs => (p_gap_hours * 3600)::double precision))
    )
    select jsonb_build_object(
      'atrasadas', (
        select count(*)
          from public.competitor_videos v
          join public.competitor_channels ch on ch.id = v.competitor_channel_id and ch.collection_paused_at is null
          cross join a
         where v.published_at is not null
           and coalesce(v.live_broadcast_content, 'none') not in ('upcoming', 'live')
           and greatest(v.published_at, coalesce(v.live_actual_start_at, v.published_at)) + make_interval(days => a.age_days) + a.gap + interval '48 hours' <= p_now
           and not exists (select 1 from public.competitor_video_marks m where m.video_id = v.id and m.age_days = a.age_days)
           and not exists (select 1 from public.competitor_video_mark_misses x where x.video_id = v.id and x.age_days = a.age_days)),
      'em_duas_tabelas', (
        select count(*) from public.competitor_video_marks m
          join public.competitor_video_mark_misses x on x.video_id = m.video_id and x.age_days = m.age_days),
      'site_divergente', (
        select count(*) from (
          select m.video_id, m.site_id from public.competitor_video_marks m
          union all
          select x.video_id, x.site_id from public.competitor_video_mark_misses x) t
          join public.competitor_videos v on v.id = t.video_id
          join public.competitor_channels c on c.id = v.competitor_channel_id
         where c.site_id <> t.site_id),
      'base_divergente', (
        select count(*) from (
          select m.video_id, m.age_base_at from public.competitor_video_marks m
          union all
          select x.video_id, x.age_base_at from public.competitor_video_mark_misses x) t
          join public.competitor_videos v on v.id = t.video_id
         where v.published_at is not null
           and t.age_base_at is distinct from greatest(v.published_at, coalesce(v.live_actual_start_at, v.published_at))),
      'marcas', (select count(*) from public.competitor_video_marks),
      'faltas', (select count(*) from public.competitor_video_mark_misses)
    )
  );
end $$;
revoke all on function public.competitor_marks_health(timestamptz, numeric, numeric) from public, anon, authenticated;
grant execute on function public.competitor_marks_health(timestamptz, numeric, numeric) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Gravar. A marca entra uma vez (on conflict do nothing) e só se o instante alvo está entre as duas leituras;
--    site_id, a base da idade e a distância são do BANCO, nunca de quem chama. O motivo entra se não há marca, e
--    uma versão de regra maior substitui o motivo antigo. Devolve as contagens e a prova lida depois de gravar.
--    (emenda 1: C-1) Antes de tudo apaga marcas e motivos cuja base gravada não é mais a do vídeo (refeitas_por_base);
--    vídeo agendado ou no ar não recebe marca nem motivo.
--    (emenda 1: m-1 de dados, m4 de software) O motivo só entra quando alvo + limite + 1 hora já passou (a leitura das
--    primeiras horas pode ser copiada até 1 hora depois do instante que carrega); o que não passa conta em faltas_recusadas.
--    (emenda 2: m-2 de dados) Cada item traz base_at, a base que competitor_marks_pending devolveu, sem mexer no texto. Se a
--    base do vídeo andou entre a leitura e a gravação (ou base_at não veio), o item é recusado: a conta foi feita para outro alvo.
--    (emenda 2: m-6 de dados) A limpeza do começo apaga também a linha de vídeo que hoje está agendado ou no ar.
--      p_marks:  [{"video_id", "age_days", "base_at", "views", "likes", "comments", "likes_hidden", "comments_disabled", "read_before_at", "read_after_at"}]
--      p_misses: [{"video_id", "age_days", "base_at", "reason", "since_at"}]
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.competitor_marks_apply(
  p_marks jsonb, p_misses jsonb, p_rule_version integer, p_now timestamptz, p_gap_hours_day1 numeric, p_gap_hours numeric
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_marks integer := 0;
  v_recusadas integer := 0;
  v_limpas integer := 0;
  v_faltas integer := 0;
  v_faltas_recusadas integer := 0;
  v_refeitas integer := 0;
  v_n integer := 0;
begin
  if p_marks is null or jsonb_typeof(p_marks) <> 'array' or p_misses is null or jsonb_typeof(p_misses) <> 'array' or p_rule_version is null then
    raise exception 'competitor_marks_apply: p_marks e p_misses têm de ser listas e p_rule_version é obrigatório';
  end if;

  -- (emenda 1: C-1) a base da idade andou depois da decisão (a transmissão começou, ou a releitura trouxe a estreia):
  -- a linha sai e o par volta a ser pendente. Vídeo sem data não é tocado (não teria como ser refeito).
  -- (emenda 2: m-6 de dados) Sai também a linha de vídeo que HOJE está agendado ou no ar (decidida quando o estado ainda era
  -- nulo): ele não tem idade, e se a transmissão nunca começar a base nunca anda e a linha ficaria para sempre.
  delete from public.competitor_video_marks m
   using public.competitor_videos v
   where v.id = m.video_id
     and ((v.published_at is not null and m.age_base_at <> greatest(v.published_at, coalesce(v.live_actual_start_at, v.published_at)))
          or coalesce(v.live_broadcast_content, 'none') in ('upcoming', 'live'));
  get diagnostics v_n = row_count;
  v_refeitas := v_n;
  delete from public.competitor_video_mark_misses x
   using public.competitor_videos v
   where v.id = x.video_id
     and ((v.published_at is not null and x.age_base_at <> greatest(v.published_at, coalesce(v.live_actual_start_at, v.published_at)))
          or coalesce(v.live_broadcast_content, 'none') in ('upcoming', 'live'));
  get diagnostics v_n = row_count;
  v_refeitas := v_refeitas + v_n;

  with src as (
    select x.* from jsonb_to_recordset(p_marks) as x(
      video_id uuid, age_days smallint, base_at timestamptz, views bigint, likes bigint, comments bigint, likes_hidden boolean,
      comments_disabled boolean, read_before_at timestamptz, read_after_at timestamptz)
  ), ok as (
    select s.*, c.site_id, b.t0
      from src s
      join public.competitor_videos v on v.id = s.video_id
      join public.competitor_channels c on c.id = v.competitor_channel_id
      cross join lateral (select greatest(v.published_at, coalesce(v.live_actual_start_at, v.published_at)) as t0) b
     where v.published_at is not null
       and coalesce(v.live_broadcast_content, 'none') not in ('upcoming', 'live')
       and s.base_at = b.t0
       and s.read_before_at <= b.t0 + make_interval(days => s.age_days::integer)
       and s.read_after_at >= b.t0 + make_interval(days => s.age_days::integer)
       and s.read_after_at - s.read_before_at <= make_interval(secs => ((case when s.age_days = 1 then p_gap_hours_day1 else p_gap_hours end) * 3600)::double precision)
  ), ins as (
    insert into public.competitor_video_marks
      (video_id, age_days, site_id, views, likes, comments, likes_hidden, comments_disabled, rule_version, gap_hours, age_base_at, read_before_at, read_after_at)
    select o.video_id, o.age_days, o.site_id, o.views, o.likes, o.comments, o.likes_hidden, o.comments_disabled, p_rule_version,
           round((extract(epoch from (o.read_after_at - o.read_before_at)) / 3600)::numeric, 3), o.t0, o.read_before_at, o.read_after_at
      from ok o
    on conflict (video_id, age_days) do nothing
    returning 1
  )
  select (select count(*) from ins), (select count(*) from src) - (select count(*) from ok) into v_marks, v_recusadas;

  delete from public.competitor_video_mark_misses x
   using public.competitor_video_marks m
   where m.video_id = x.video_id and m.age_days = x.age_days;
  get diagnostics v_limpas = row_count;

  with src as (
    select x.* from jsonb_to_recordset(p_misses) as x(video_id uuid, age_days smallint, base_at timestamptz, reason text, since_at timestamptz)
  ), ok as (
    select s.*, c.site_id, b.t0
      from src s
      join public.competitor_videos v on v.id = s.video_id
      join public.competitor_channels c on c.id = v.competitor_channel_id
      cross join lateral (select greatest(v.published_at, coalesce(v.live_actual_start_at, v.published_at)) as t0) b
     where v.published_at is not null
       and coalesce(v.live_broadcast_content, 'none') not in ('upcoming', 'live')
       and s.base_at = b.t0
       and b.t0 + make_interval(days => s.age_days::integer)
           + make_interval(secs => ((case when s.age_days = 1 then p_gap_hours_day1 else p_gap_hours end) * 3600)::double precision)
           + interval '1 hour' <= p_now
  ), up as (
    insert into public.competitor_video_mark_misses (video_id, age_days, site_id, reason, since_at, rule_version, age_base_at)
    select o.video_id, o.age_days, o.site_id, o.reason, o.since_at, p_rule_version, o.t0 from ok o
     where not exists (select 1 from public.competitor_video_marks m where m.video_id = o.video_id and m.age_days = o.age_days)
    on conflict (video_id, age_days) do update
      set reason = excluded.reason, since_at = excluded.since_at, rule_version = excluded.rule_version,
          age_base_at = excluded.age_base_at, site_id = excluded.site_id, decided_at = now()
      where public.competitor_video_mark_misses.rule_version < excluded.rule_version
    returning 1
  )
  select (select count(*) from up), (select count(*) from src) - (select count(*) from ok) into v_faltas, v_faltas_recusadas;

  return jsonb_build_object(
    'marcas', v_marks, 'marcas_recusadas', v_recusadas, 'faltas', v_faltas, 'faltas_limpas', v_limpas,
    'faltas_recusadas', v_faltas_recusadas, 'refeitas_por_base', v_refeitas,
    'saude', public.competitor_marks_health(p_now, p_gap_hours_day1, p_gap_hours));
end $$;
revoke all on function public.competitor_marks_apply(jsonb, jsonb, integer, timestamptz, numeric, numeric) from public, anon, authenticated;
grant execute on function public.competitor_marks_apply(jsonb, jsonb, integer, timestamptz, numeric, numeric) to service_role;
