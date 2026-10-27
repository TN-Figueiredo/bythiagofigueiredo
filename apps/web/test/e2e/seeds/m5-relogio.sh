#!/bin/bash
# Relógio simulado do banco de integração SÓ para o papel authenticator (o PostgREST): os testes de integração usam o papel postgres e não são afetados.
# Uso: m5-relogio.sh ligar | desligar. Depois, as conexões do PostgREST são recicladas.
set -e
C=supabase_db_bythiago_int
case "$1" in
  ligar) docker exec -e PGPASSWORD=postgres $C psql -h 127.0.0.1 -U supabase_admin -d postgres -qAt -c "alter role authenticator set obs_archive.hoje = '2028-05-03'" -c "alter role authenticator set obs_archive.agora = '2028-05-03 14:00:00-03'";;
  desligar) docker exec -e PGPASSWORD=postgres $C psql -h 127.0.0.1 -U supabase_admin -d postgres -qAt -c "alter role authenticator reset obs_archive.hoje" -c "alter role authenticator reset obs_archive.agora";;
esac
docker exec -e PGPASSWORD=postgres $C psql -h 127.0.0.1 -U supabase_admin -d postgres -qAt -c "select count(pg_terminate_backend(pid)) from pg_stat_activity where usename = 'authenticator'"
