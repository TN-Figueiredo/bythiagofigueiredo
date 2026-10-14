# Fase de manutenção de dados (NAS e forja): índice dos planos de implementação

Escrito em 14/10/2026, depois de o dono aprovar o spec (commit `8b4dd7b61`, acordo de Phil, Yannis, Logan e Naksu na rodada 16).
Spec: `docs/superpowers/specs/2026-10-13-fase-manutencao-nas/` (partes 00 a 06). Decisões do dono de 14/10: `.superpowers/sdd/manutencao-nas/decisoes-dono-14-10.md`.

**Regra deste índice.** Há um plano por etapa do `05` §15.1, porque as etapas tocam sistemas diferentes (banco, rotas do site, kit da forja, NAS e telas), e cada uma tem de entregar algo testável sozinha. Não há data-meta (D24): uma etapa começa quando a anterior, de que ela depende, fecha. A coluna "Espera por" só traz relógio real.

| Ordem | Plano | Etapa | Depende de | Espera por (relógio real) | Estado |
|---|---|---|---|---|---|
| 1 | `2026-10-14-manutencao-nas-m0-m1-medidas-e-podas.md` | M0 + M1 | nada | nada | **acordo de Phil e Yannis (r2), commitado** |
| 2 | `2026-10-14-manutencao-nas-m2-particoes.md` | M2 | pedidos 1, 3, 5 e 6 (§17) | janela de `db:push:prod` com a A5 | **acordo de Phil e Yannis (r2), commitado** |
| 3 | `2026-10-14-manutencao-nas-m10a-video-antigo-base.md` | M10a | M2 em produção (dois pushes no mesmo dia, M2 primeiro); pedido 15; CP29 | a mesma janela | **acordo de Phil (r2) e Yannis (r3), commitado** |
| 4 | `2026-10-14-manutencao-nas-m3a-casa.md` | M3a | pergunta 1 (respondida); CP25 | nada | **acordo de Phil (r3) e Yannis (r2), commitado** |
| 5a | `2026-10-14-manutencao-nas-m3b-site.md`: registro, política, rotas, serialização e leitor únicos, fatia 12a, resumo por canal | M3b (site) | M2, M3a; E10 tarefas 5 e 6 **ou** o gatilho do §15.1 | primeira selagem devida em 28/11 | em redação (onda 2) |
| 5b | `2026-10-14-manutencao-nas-m3b-forja.md`: copiador, `conferir-b2` (canário, controle negativo, Su1), `pode-desligar`, varredura completa, blocos do pulso | M3b (forja) | M3a; contrato das rotas da 5a | a mesma | em redação (onda 2) |
| 6 | M4, mockups (peças 1 a 9, mockup 19, `18-v2`) | M4 | nada | aprovação do dono | fluxo de mockup (frontend-design + Logan + Naksu), não writing-plans |
| 7 | M5, telas | M5 | M3b, M4; pedido 11 | nada | depois |
| 8 | M6, saída | M6 | M3b, M4 | nada | depois |
| 9 | M10b, vídeo antigo, congelar | M10b | M10a, M3b, M4, M5 | nada | depois |
| 10 | M9, expurgo enxuto (fatia 12b) | M9 | M3b, M5; E9 em produção | nada | depois (1ª na ordem de prioridade) |
| 11 | M7, período longo | M7 | M3b | nada | depois |
| 12 | M8, ensaio completo | M8 | M3 a M7, M10b (passo 19: M9) | dois dias de verificação na parte B; parte C: 28/11 | depois |
| 13 | M10c, vídeo antigo, retirar | M10c | M10b, M6, M9 | selagem do mês do congelamento | depois |

**Ordem de prioridade quando duas etapas disputam a mesma mão** (§15.1): M9 → sinal sem serrote → peça 6 completa → tela do interruptor.

**Revisão de cada plano** (regra do dono): Phil (dados) e Yannis (software) no fim de cada plano, antes de ele voltar ao dono; conserta-se até haver acordo.

**Brief comum aos redatores:** `.superpowers/sdd/manutencao-nas/brief-planos.md`.
