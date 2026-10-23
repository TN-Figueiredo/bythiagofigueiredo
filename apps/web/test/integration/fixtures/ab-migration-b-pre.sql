-- Só para teste. Devolve a forma de antes da B dentro da transação desfeita, para o teste
-- rodar igual no banco do CI, que já nasce migrado.
alter table public.ab_tests add column if not exists original_description text;
alter table public.ab_test_variants add column if not exists description_text text;
create table if not exists public.ab_test_tracked_links (
  id uuid primary key default gen_random_uuid(),
  ab_test_id uuid not null references public.ab_tests(id) on delete cascade,
  variant_id uuid not null references public.ab_test_variants(id) on delete cascade,
  link_id uuid not null references public.tracked_links(id) on delete cascade,
  template_name text not null,
  short_code text not null,
  created_at timestamptz not null default now(),
  unique (ab_test_id, variant_id, template_name)
);
create or replace function public.create_playoff_test(p_parent_test_id uuid, p_variant_ids uuid[], p_cooldown_hours integer default 4)
returns uuid language sql security definer set search_path = public as $f$ select null::uuid $f$;
