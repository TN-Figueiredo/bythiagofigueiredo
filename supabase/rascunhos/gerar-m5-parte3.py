#!/usr/bin/env python3
"""Gera o create or replace de competitor_hourly_health para a M5 (parte 3) a partir da migration da A5, trocando só a linha 'desde'."""
import re, sys, pathlib
# a ÚLTIMA definição da função em supabase/migrations (se a A5 a redefinir antes da Tarefa 13, a M5 parte dela, não da antiga; Yannis m-2)
_ASSINATURA = 'create or replace function public.competitor_hourly_health('
_candidatas = sorted(f for f in pathlib.Path('supabase/migrations').glob('*.sql') if _ASSINATURA in f.read_text())
assert _candidatas, 'nenhuma migration define competitor_hourly_health'
MIG = _candidatas[-1]
OUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'supabase/rascunhos/m5-parte3-hourly-health.sql')
src = MIG.read_text()
ini = src.index('create or replace function public.competitor_hourly_health(')
fim = src.index("to service_role;", src.index('grant execute on function public.competitor_hourly_health(')) + len("to service_role;")
bloco = src[ini:fim]
antiga = "    'desde', (select min(h.hour_slot) from public.competitor_video_hourly h where h.site_id = p_site_id),"
assert bloco.count(antiga) == 1, f"a linha 'desde' apareceu {bloco.count(antiga)} vezes; a migration mudou, reescreva a troca"
cte_antiga = "  ), n as (select count(*) as lidas from horas)\n"
assert bloco.count(cte_antiga) == 1, 'o CTE n mudou; reescreva a troca'
cte_nova = "  ), n as (select count(*) as lidas from horas), d as materialized (select x.desde, x.precisao from public.obs_archive_horaria_desde(p_site_id) x)\n"  # lido 1x (security definer não é incorporada)
nova = ("    'desde', (select d.desde from d),\n"
        "    'desde_precisao', (select d.precisao from d),\n"
        "    'online_desde', (select min(h.hour_slot) from public.competitor_video_hourly h where h.site_id = p_site_id),")
OUT.write_text("-- Gerado por gerar-m5-parte3.py a partir de " + MIG.name + "; só a linha 'desde' muda (M5, Phil I7).\n" + bloco.replace(antiga, nova).replace(cte_antiga, cte_nova) + "\n")
print('ok', OUT)
