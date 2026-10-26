#!/usr/bin/env python3
"""Gera o create or replace de competitor_hourly_health para a M5 (parte 3) a partir da migration da A5, trocando só a linha 'desde'."""
import re, sys, pathlib
MIG = pathlib.Path('supabase/migrations/20261013000002_observatorio_a5_e15_leitura_horaria.sql')
OUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'supabase/rascunhos/m5-parte3-hourly-health.sql')
src = MIG.read_text()
ini = src.index('create or replace function public.competitor_hourly_health(')
fim = src.index("to service_role;", src.index('grant execute on function public.competitor_hourly_health(')) + len("to service_role;")
bloco = src[ini:fim]
antiga = "    'desde', (select min(h.hour_slot) from public.competitor_video_hourly h where h.site_id = p_site_id),"
assert bloco.count(antiga) == 1, f"a linha 'desde' apareceu {bloco.count(antiga)} vezes; a migration mudou, reescreva a troca"
nova = ("    'desde', (select d.desde from public.obs_archive_horaria_desde(p_site_id) d),\n"
        "    'desde_precisao', (select d.precisao from public.obs_archive_horaria_desde(p_site_id) d),\n"
        "    'online_desde', (select min(h.hour_slot) from public.competitor_video_hourly h where h.site_id = p_site_id),")
OUT.write_text("-- Gerado por gerar-m5-parte3.py a partir de " + MIG.name + "; só a linha 'desde' muda (M5, Phil I7).\n" + bloco.replace(antiga, nova) + "\n")
print('ok', OUT)
