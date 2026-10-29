-- M6: conferência de LEITURA antes da migration da Tarefa 14 (e antes do db:push:prod). Só select; o dono roda, ou o controlador com autorização.
-- Esperado: as DUAS consultas devolvem 0 linhas. Qualquer linha = a migration espera (r1 I-4, Phil e Yannis 28/10).
--
-- Por quê: o gatilho do invariante (obs_archive_block_delete_while_detached) recusa TODO apagamento de vídeo e de canal, de todos os sites,
-- enquanto existir mês com detached_at e sem dropped_at. Um mês destacado esquecido em produção (ou destacado sem a tabela _saida, que o
-- descarte recusa com particao_ausente) prenderia "Remover canal" e o expurgo E9 da retenção para sempre, sem ninguém ter tirado mês nenhum.

-- (1) mês destacado e não descartado cuja tabela _saida não existe (o descarte nunca fecha esse mês).
select m.site_id, m.table_name, m.month, m.detached_at, 'mes_destacado_sem_tabela' as problema
  from public.obs_archive_months m
 where m.detached_at is not null and m.dropped_at is null
   and pg_catalog.to_regclass(pg_catalog.format('obs_part.%I', obs_part.nome_da_particao(m.table_name, m.month) || '_saida')) is null
 order by m.site_id, m.table_name, m.month;

-- (2) qualquer mês em trânsito no dia da migration (destacado e não descartado), com ou sem tabela.
select m.site_id, m.table_name, m.month, m.detached_at, 'mes_em_transito' as problema
  from public.obs_archive_months m
 where m.detached_at is not null and m.dropped_at is null
 order by m.site_id, m.table_name, m.month;

-- Tarefa 7a: o vermelho `mes_destacado_sem_tabela` mostra a consulta (1) ao dono, com o site, a tabela e o mês, para ele decidir
-- (trazer de volta, dar baixa no registro ou descartar). Não é correção automática.
