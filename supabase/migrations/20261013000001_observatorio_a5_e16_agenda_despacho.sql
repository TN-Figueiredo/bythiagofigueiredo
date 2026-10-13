-- Observatório A5, E16 parte 1 (MG10): a agenda única do cron de concorrentes.
-- Execuções por tarefa e período, arrendamento com validade (no lugar da trava de sessão) e tomada atômica.
-- Só acrescenta: duas tabelas e sete funções novas. Nada que o código de main usa é tocado.
set lock_timeout = '5s';

create table if not exists public.competitor_agenda_runs (
  task text not null,                       -- nome do catálogo (apps/web/src/lib/youtube/agenda/catalogo.ts)
  period_key text not null,                 -- '2026-10-12T21' (hora), '2026-10-12' (dia), '2026-10-12#18' (faixa de 6 horas); sempre de São Paulo
  status text not null check (status in ('rodando', 'ok', 'parcial', 'adiada', 'erro', 'esgotada')),
  attempts smallint not null default 1,     -- tentativas que GASTAM o teto do período (retomada com progresso não soma)
  runs smallint not null default 1,         -- quantas vezes a linha foi tomada, com ou sem progresso
  unfinished_n smallint not null default 0, -- fechos seguidos sem terminar ('parcial', ou 'adiada' por falta de tempo); zera no 'ok'
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms integer,
  done_n integer,                           -- unidades feitas NA ÚLTIMA execução (não o acumulado)
  left_n integer,                           -- unidades que ficaram para trás; nulo = não se aplica
  -- (emenda do portão: S-I4, R3) CÓDIGO de motivo, de catálogo fechado no código (agenda/motivos.ts e Tarefa.motivos);
  -- nunca texto de exceção: a frase que o dono lê sai de fraseDoMotivo(), o detalhe técnico vai ao Sentry
  reason text check (reason is null or reason ~ '^[a-z0-9_]{1,60}$'),
  detail jsonb,                             -- contadores da última execução da tarefa (só números e nomes de contador)
  primary key (task, period_key)
);
create index if not exists idx_car_task_started on public.competitor_agenda_runs (task, started_at desc);
create index if not exists idx_car_task_ok on public.competitor_agenda_runs (task, finished_at desc) where status = 'ok';
alter table public.competitor_agenda_runs enable row level security;
drop policy if exists "competitor_agenda_runs_select" on public.competitor_agenda_runs;
create policy "competitor_agenda_runs_select" on public.competitor_agenda_runs
  for select using (public.is_member_staff());   -- só estado de execução; nenhuma policy de escrita (service role)

create table if not exists public.competitor_agenda_lease (
  name text primary key,                    -- 'despachante'
  holder uuid not null,                     -- id sorteado por disparo
  expires_at timestamptz not null           -- função morta sem finally libera sozinha ao vencer
);
alter table public.competitor_agenda_lease enable row level security;   -- sem policy nenhuma: só service role

-- Toma o arrendamento se ele não existe ou já venceu. true para exatamente um chamador.
create or replace function public.competitor_agenda_lease_take(p_name text, p_holder uuid, p_ttl interval)
returns boolean language sql security invoker set search_path = '' as $$
  with t as (
    insert into public.competitor_agenda_lease as l (name, holder, expires_at) values (p_name, p_holder, now() + p_ttl)
    on conflict (name) do update set holder = excluded.holder, expires_at = excluded.expires_at
      where l.expires_at < now()
    returning 1)
  select exists (select 1 from t);
$$;

-- Solta o arrendamento SÓ de quem o tem (OP-4): um disparo atrasado nunca apaga o arrendamento do seguinte.
create or replace function public.competitor_agenda_lease_release(p_name text, p_holder uuid)
returns boolean language sql security invoker set search_path = '' as $$
  with d as (delete from public.competitor_agenda_lease l where l.name = p_name and l.holder = p_holder returning 1)
  select exists (select 1 from d);
$$;

-- Tomada ATÔMICA de uma tarefa: a primeira vez no período e a retomada de 'parcial', 'adiada', 'erro' e 'rodando' vencida.
-- true para exatamente um chamador; quem recebe false não roda.
-- p_reopen = true retoma também uma linha 'ok': só para a tarefa cujo trabalho é devido pelo próprio dado
-- (um canal acrescentado depois de a faixa fechar; a passada semanal reaberta pelo banco). O teto de tentativas não vale para reabrir.
create or replace function public.competitor_agenda_claim(
  p_task text, p_period_key text, p_max_attempts smallint, p_stale interval default interval '10 minutes', p_reopen boolean default false
) returns boolean language sql security invoker set search_path = '' as $$
  with t as (
    insert into public.competitor_agenda_runs as r (task, period_key, status) values (p_task, p_period_key, 'rodando')
    on conflict (task, period_key) do update
      set status = 'rodando',
          -- retomada de 'parcial' com progresso não gasta tentativa; 'adiada' nasce com attempts = 0
          -- reabrir um 'ok' (p_reopen: a tarefa voltou a ter trabalho pelo próprio dado) também não gasta
          attempts = r.attempts + case when r.status = 'ok' or (r.status = 'parcial' and coalesce(r.done_n, 0) > 0) then 0 else 1 end,
          runs = r.runs + 1,
          started_at = now(), finished_at = null
      where ((r.status in ('parcial', 'adiada', 'erro')
              or (r.status = 'rodando' and r.started_at < now() - p_stale))
             and r.attempts < p_max_attempts)
         or (p_reopen and r.status = 'ok')
    returning 1)
  select exists (select 1 from t);
$$;

-- Fecha a execução que este disparo tomou. Só fecha linha 'rodando' (um fecho atrasado não desfaz uma retomada nem um 'ok').
-- 'parcial' soma em unfinished_n; 'ok' zera; 'erro' não mexe (o teto de tentativas é quem cuida dele).
create or replace function public.competitor_agenda_finish(
  p_task text, p_period_key text, p_status text, p_done_n integer, p_left_n integer, p_reason text, p_duration_ms integer, p_detail jsonb
) returns boolean language plpgsql security invoker set search_path = '' as $$
declare v_n integer;
begin
  if p_status not in ('ok', 'parcial', 'erro') then
    raise exception 'competitor_agenda_finish: estado % não fecha execução', p_status;
  end if;
  update public.competitor_agenda_runs r
     set status = p_status, finished_at = now(), duration_ms = p_duration_ms,
         done_n = p_done_n, left_n = p_left_n,
         -- (emenda do portão: S-I4, R3) só código; qualquer outra coisa vira 'motivo_invalido' (o fecho nunca falha por causa do motivo)
         reason = case when p_reason is null then null when p_reason ~ '^[a-z0-9_]{1,60}$' then p_reason else 'motivo_invalido' end,
         detail = p_detail,
         unfinished_n = case p_status when 'ok' then 0 when 'parcial' then r.unfinished_n + 1 else r.unfinished_n end
   where r.task = p_task and r.period_key = p_period_key and r.status = 'rodando';
  get diagnostics v_n = row_count;
  return v_n = 1;
end $$;

-- A tarefa devida que nem começou neste disparo. Não gasta tentativa (attempts = 0 na linha nova) e nunca mexe em linha
-- 'rodando', 'ok' ou 'esgotada'. Só 'sem_tempo' soma em unfinished_n: ceder a vez a outra pesada é esperado, faltar tempo não.
create or replace function public.competitor_agenda_defer(p_task text, p_period_key text, p_reason text)
returns boolean language sql security invoker set search_path = '' as $$
  with t as (
    insert into public.competitor_agenda_runs as r (task, period_key, status, attempts, runs, unfinished_n, reason, finished_at)
    values (p_task, p_period_key, 'adiada', 0, 0, case when p_reason = 'sem_tempo' then 1 else 0 end,
            case when p_reason ~ '^[a-z0-9_]{1,60}$' then p_reason else 'motivo_invalido' end, now())
    on conflict (task, period_key) do update
      -- (emenda do portão: D-I4) adiar uma linha 'erro' ou 'parcial' NÃO apaga o motivo nem o instante do fecho dela
      set reason = case when r.status = 'adiada' then excluded.reason else r.reason end,
          finished_at = case when r.status = 'adiada' then now() else r.finished_at end,
          unfinished_n = r.unfinished_n + case when p_reason = 'sem_tempo' then 1 else 0 end
      where r.status in ('adiada', 'parcial', 'erro')
    returning 1)
  select exists (select 1 from t);
$$;

-- Marca 'esgotada' a linha que bateu o teto de tentativas do período e não pode mais ser tomada. true = marcou agora.
create or replace function public.competitor_agenda_exhaust(p_task text, p_period_key text, p_max_attempts smallint, p_stale interval default interval '10 minutes')
returns boolean language sql security invoker set search_path = '' as $$
  with u as (
    update public.competitor_agenda_runs r set status = 'esgotada', finished_at = now()
     where r.task = p_task and r.period_key = p_period_key and r.attempts >= p_max_attempts
       and (r.status in ('parcial', 'adiada', 'erro') or (r.status = 'rodando' and r.started_at < now() - p_stale))
    returning 1)
  select exists (select 1 from u);
$$;

-- O estado que o despachante e o vigia leem, numa ida só: a linha do período corrente de cada tarefa pedida (ou nulos),
-- o último 'ok' de cada uma, e desde quando a agenda existe neste banco (a primeira linha das tarefas pedidas).
-- p_tasks e p_period_keys andam juntos (mesma posição).
create or replace function public.competitor_agenda_state(p_tasks text[], p_period_keys text[])
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'agora', now(),
    -- (emenda do portão: R5) só as tarefas pedidas: quem chama pede o catálogo inteiro; um teste pede só as dele
    'desde', (select min(r.started_at) from public.competitor_agenda_runs r where r.task = any(p_tasks)),
    'tarefas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'task', k.task, 'period_key', k.period_key,
        'status', r.status, 'attempts', r.attempts, 'runs', r.runs, 'unfinished_n', r.unfinished_n,
        'started_at', r.started_at, 'finished_at', r.finished_at, 'done_n', r.done_n, 'left_n', r.left_n, 'reason', r.reason,
        'last_ok_at', (select max(o.finished_at) from public.competitor_agenda_runs o where o.task = k.task and o.status = 'ok'),
        'last_run_status', (select p.status from public.competitor_agenda_runs p where p.task = k.task and p.runs > 0 order by p.started_at desc limit 1),
        'last_run_done_n', (select p.done_n from public.competitor_agenda_runs p where p.task = k.task and p.runs > 0 order by p.started_at desc limit 1)
      ) order by k.ord)
      from unnest(p_tasks, p_period_keys) with ordinality as k(task, period_key, ord)
      left join public.competitor_agenda_runs r on r.task = k.task and r.period_key = k.period_key), '[]'::jsonb));
$$;

revoke all on function public.competitor_agenda_lease_take(text, uuid, interval) from public, anon, authenticated;
revoke all on function public.competitor_agenda_lease_release(text, uuid) from public, anon, authenticated;
revoke all on function public.competitor_agenda_claim(text, text, smallint, interval, boolean) from public, anon, authenticated;
revoke all on function public.competitor_agenda_finish(text, text, text, integer, integer, text, integer, jsonb) from public, anon, authenticated;
revoke all on function public.competitor_agenda_defer(text, text, text) from public, anon, authenticated;
revoke all on function public.competitor_agenda_exhaust(text, text, smallint, interval) from public, anon, authenticated;
revoke all on function public.competitor_agenda_state(text[], text[]) from public, anon, authenticated;
grant execute on function public.competitor_agenda_lease_take(text, uuid, interval) to service_role;
grant execute on function public.competitor_agenda_lease_release(text, uuid) to service_role;
grant execute on function public.competitor_agenda_claim(text, text, smallint, interval, boolean) to service_role;
grant execute on function public.competitor_agenda_finish(text, text, text, integer, integer, text, integer, jsonb) to service_role;
grant execute on function public.competitor_agenda_defer(text, text, text) to service_role;
grant execute on function public.competitor_agenda_exhaust(text, text, smallint, interval) to service_role;
grant execute on function public.competitor_agenda_state(text[], text[]) to service_role;

reset lock_timeout;
