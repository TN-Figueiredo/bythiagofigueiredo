# Fase de manutenção de dados (NAS e forja): índice dos planos de implementação

Escrito em 14/10/2026, depois de o dono aprovar o spec (commit `8b4dd7b61`, acordo de Phil, Yannis, Logan e Naksu na rodada 16).
Spec: `docs/superpowers/specs/2026-10-13-fase-manutencao-nas/` (partes 00 a 06). Decisões do dono de 14/10: `.superpowers/sdd/manutencao-nas/decisoes-dono-14-10.md`.

**Retomada de 23/10 (fim da pausa de 14/10, ainda sem ordem de implementar).** Pareceres de Phil, Yannis e da Hanna em
`.superpowers/sdd/manutencao-nas/replan-23-10/` (`phil.md`, `yannis.md`, `hanna.md`); a ordem em ondas da Hanna (§4) manda sobre a
coluna "Ordem" abaixo até o fecho da onda 0. Fatos novos: a M2 do origin já tem a emenda da 0007 (`8df3e13a1`); a M2 ganha o
bloco 11c (crítico do Yannis); M10a e M3b-site existem só no staging local (envio por worktree, Yannis §2.2); M3b com md5,
~99 testes de outras frentes e teto 60.000. Estado vivo: `.superpowers/sdd/manutencao-nas/status/status.html`.

**Regra deste índice.** Há um plano por etapa do `05` §15.1, porque as etapas tocam sistemas diferentes (banco, rotas do site, kit da forja, NAS e telas), e cada uma tem de entregar algo testável sozinha. Não há data-meta (D24): uma etapa começa quando a anterior, de que ela depende, fecha. A coluna "Espera por" só traz relógio real.

| Ordem | Plano | Etapa | Depende de | Espera por (relógio real) | Estado |
|---|---|---|---|---|---|
| 1 | `2026-10-14-manutencao-nas-m0-m1-medidas-e-podas.md` | M0 + M1 | nada | nada | **acordo de Phil e Yannis (r2), commitado**; M0 rodada em 14/10 (CP7 e Max rows abertos), M1 por executar |
| 2 | `2026-10-14-manutencao-nas-m2-particoes.md` | M2 | pedidos 1, 3, 5 e 6 (§17) | janela de `db:push:prod` com a A5 | **acordo de Phil e Yannis (r2), commitado** |
| 3 | `2026-10-14-manutencao-nas-m10a-video-antigo-base.md` | M10a | M2 em produção (dois pushes no mesmo dia, M2 primeiro); pedido 15; CP29 | a mesma janela | **acordo de Phil (r2) e Yannis (r3), commitado** |
| 4 | `2026-10-14-manutencao-nas-m3a-casa.md` | M3a | pergunta 1 (respondida); CP25 | nada | **acordo de Phil (r3) e Yannis (r2), commitado; FEITA em 14/10 17:01 (blocos 0–11 do dono); C-1 em 15/10 é portão duro da M3b** |
| 5a | `2026-10-14-manutencao-nas-m3b-site.md`: registro, política, rotas, serialização e leitor únicos, fatia 12a, resumo por canal | M3b (site) | M2, M3a; E10 tarefas 5 e 6 **ou** o gatilho do §15.1 | primeira selagem devida em 28/11 | **acordo de Phil e Yannis (r3; contrato r2.3), commitado**; emenda `obs:arquivo` da peça 7 (14/10: 4e30b2b8a + conserto 133a1653c) com acordo de Phil e Yannis na re-revisão |
| 5b | `2026-10-14-manutencao-nas-m3b-forja.md`: copiador, `conferir-b2` (canário, controle negativo, Su1), `pode-desligar`, varredura completa, blocos do pulso | M3b (forja) | M3a; contrato das rotas da 5a | a mesma | **acordo de Phil e Yannis (r3; contrato r2.3), commitado**; emenda `obs:arquivo` da peça 7 (14/10: 4e30b2b8a + conserto 133a1653c) com acordo de Phil e Yannis na re-revisão |
| 6 | M4, mockups (peças 1 a 9, mockup 19, `18-v2`) | M4 | nada | aprovação do dono | **concluída em 14/10: todas as peças aprovadas pelo dono** (a peça 5 é o `18-v2`; a peça 9 saiu no fecho de 14/10); falta só levar as remessas ao fecho do spec 04 (NOTAS.md do mockup 19). Histórico: diálogo "Remover canal" e `18-v2` **aprovados pelo dono (14/10, e8445f559)**; 19 conferido com acordo de Logan e Naksu (14/10); página do Arquivo (peça 2) aprovada pelo dono no Opera (14/10); peças 1 e 3 também aprovadas pelo dono (14/10); peça 4 aprovada pelo dono (14/10); peça 7 aprovada pelo dono (14/10); peça 6 aprovada pelo dono (14/10); peça 8 aprovada pelo dono (14/10) |
| 7 | `2026-10-14-manutencao-nas-m5-telas.md` | M5 | M3b em produção, M4; pedido 11 | nada | **acordo de Phil e Yannis (r3; emenda final dabc3734e conferida pelo controlador)**; dívida: SAIDA_DE_MES_EXISTE vira true com a M6 em produção |
| 8 | M6, saída | M6 | M3b, M4 | nada | depois |
| 9 | M10b, vídeo antigo, congelar | M10b | M10a, M3b, M4, M5 | nada | depois. **Requisito da peça 8 (14/10), para o plano:** `npm run obs:videos-desfazer -- <aaaa-mm>`, com o mês como único argumento, idempotente, recusando mês inválido com mensagem em português (atenção ao cabeçalho do `npm run` no `stdout` se a saída for a outro programa: E-D1 da emenda da M3b) |
| 10 | M9, expurgo enxuto (fatia 12b) | M9 | M3b, M5; E9 em produção | nada | depois (1ª na ordem de prioridade) |
| 11 | `2026-10-14-manutencao-nas-m7-periodo-longo.md` | M7 | M3b (Tarefa 10 com o Passo 1b: extrair `obs_archive_summary_calc`); M5 | nada | **acordo de Phil e Yannis (r3), commitado (c2098c44a)**; antes da Tarefa 10: dono vê a data 01/05/2027, os textos L1–L8 do Logan e decide o custo do claim (A ou B) |
| 12 | M8, ensaio completo | M8 | M3 a M7, M10b (passo 19: M9b) | dois dias de verificação na parte B; parte C: 28/11 | depois |
| 13 | M10c, vídeo antigo, retirar | M10c | M10b, M6, M9 | selagem do mês do congelamento | depois |

**Ordem de prioridade quando duas etapas disputam a mesma mão** (§15.1): M9 → sinal sem serrote → peça 6 completa → tela do interruptor.

**Revisão de cada plano** (regra do dono): Phil (dados) e Yannis (software) no fim de cada plano, antes de ele voltar ao dono; conserta-se até haver acordo.

**Brief comum aos redatores:** `.superpowers/sdd/manutencao-nas/brief-planos.md`.

**Nota de 21/10 (M2):** o rascunho `supabase/rascunhos/m2.sql` (bloco 11b) passou a partir do corpo da F1 do Remover canal (`20261021000002`, md5 `7f556c5ff664bd0eb1dade3f53c50568`, igual ao de produção) e aplica só a guarda por folhas; o bloco 11 (`obs_archive_uncovered`, `obs_db_size_record`) não foi tocado pela F1. Commit: ver `git log -- supabase/rascunhos/m2.sql`. ORDEM: aplicar DEPOIS da F1 do Remover canal (20261021000002). Sem a F1, o 11b recusa (M2:competitor_channel_remove_archived_divergente). Reaplicar a F1 depois da M2 desfaz a guarda por folhas.

**Nota da F1a-dado (T13, 22/10):** a guarda de md5 de `remove_archived` na M2 (`supabase/rascunhos/m2.sql`) vai RECUSAR depois da migration 20261021000007, que recria as quatro funções (registro, remove_archived, delete_unarchived, sweep) com as tabelas `ab_native_observados` e `ab_native_obs_cursor`. Quem fizer a M2 copia o corpo da 0007 (não o da 0002) como base e atualiza o md5.
