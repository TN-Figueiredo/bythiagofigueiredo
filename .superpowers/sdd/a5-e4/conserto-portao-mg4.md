# Conserto do portão da MG4 (A5 E4), 15/10
- Yannis I-1: dois pares de competitor_marks_apply (disparo agenda) em observatorio-a5-e10-lista-fechada.test.ts; linha pendente da E9 (saiu-varredura) na seção 2 de .superpowers/sdd/a5/fila-do-db-push.md (arquivo fora do git).
- Phil D2 / Yannis M-1: set local lock_timeout. Phil D1: pg_advisory_xact_lock(hashtext('competitor_marks_apply')) no início do apply.
  SQL igual (cmp/diff) na fixture, no ensaio mg4-com-pausa.sql e no Apêndice A do plano (marcado "portão 15/10"). Reaplicado no bythiago_int só a função apply (create or replace).
- Prova da trava: test/integration/observatorio-a5-e4-apply-concorrente.test.ts (2 conexões, A segura a transação com a marca, B manda o motivo do mesmo par). Vermelho com a função antiga ({marcas:1,faltas:1}), verde com a nova.
- Yannis M-3: ler.ts, .order('id') nas duas consultas de versões; Consulta de medidas-fixture.ts registra `ordem`; teste novo em medidas-ler.test.ts.
- Rodado (HAS_LOCAL_DB=1, 54422): observatorio-a5-e4-*, e10-lista-fechada, medidas-fechar-marcas, test/youtube/observatorio/medidas-: 29 arquivos, 466 testes verdes. tsc --noEmit -p apps/web: rc 0.
