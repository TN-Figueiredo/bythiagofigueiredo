# S4 (A5) T&C-coleta: plano de implementação

> **Para agentes:** sub-skill obrigatória: superpowers:subagent-driven-development (recomendada) ou superpowers:executing-plans. Passos em checkbox (`- [ ]`).

**Objetivo:** ler a página watch do YouTube sem cookie, 4 rodadas por dia de 3 leituras, para os vídeos de concorrente com até 30 dias, os próprios com até 14 dias e todo vídeo com teste nosso. Toda tentativa é gravada em `yt_watch_readings`, inclusive a que falhou, e a regra da S3 (`detectarTesteYoutube`) recebe as leituras por `leiturasDoBanco`. Antes disso, a rota temporária do P-V prova se o Vercel enxerga a divisão do teste. Ela sobe num envio próprio, fica no ar até 20/10 09:00 UTC e sai no lote da S4.

**Arquitetura:** os módulos novos ficam em `apps/web/src/lib/youtube/watch/`. Parser, rodada e expansor são puros; leitor e miniatura recebem a rede injetada. As duas tarefas novas da agenda (`leitura_watch`, `poda_leituras_watch`) rodam no disparo `*/20` que já existe. É uma migration com 3 tabelas e 4 funções (`yt_watch_conciliar`, `yt_watch_gravar_disparo`, `yt_watch_poda`, `yt_watch_prova`), e cada disparo grava numa chamada só.

**Tech Stack:** Next.js 16 (rota `nodejs`), TypeScript strict, Zod, Vitest (`// @vitest-environment node`), Supabase/PostgREST, `sharp` (só em `miniatura.ts`), Postgres 17.

**Spec:** `docs/superpowers/specs/2026-10-18-a5-s4-tc-coleta-design.md` (commit `ceb5b41c0`, assinado por Phil e Yannis na r4). O contrato congelado mora em `apps/web/src/lib/youtube/teste-youtube/` (`LeituraWatch`, `leituraWatchSchema`, `RENDERERS_TITULO`, `detectarTesteYoutube`, `IMAGEM_PADRAO_YT`). Este plano não muda nada nele.

**Fica FORA:** a tela (S5), a guarda (S6), o registro do nativo (S7), a página `results`, a leitura logada, a detecção de miniatura em teste, o arquivo mensal (D5), a lista de acesso de IA (D6) e a forja (§13 do spec, que vira emenda própria se o P-V falhar).

---

## 0. Onde se trabalha e convenções

- **O checkout local diverge de `origin/staging`** (centenas de commits dos dois lados). Todo código é escrito num worktree destacado:
  ```bash
  git -C /Users/figueiredo/Workspace/bythiagofigueiredo fetch origin staging
  git -C /Users/figueiredo/Workspace/bythiagofigueiredo worktree add --detach /Users/figueiredo/Workspace/wt-s4 origin/staging
  ln -s /Users/figueiredo/Workspace/bythiagofigueiredo/node_modules /Users/figueiredo/Workspace/wt-s4/node_modules
  ln -s /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web/node_modules /Users/figueiredo/Workspace/wt-s4/apps/web/node_modules
  ```
  (é o mesmo padrão de `~/Workspace/wt-abentr`). Abaixo, `W=/Users/figueiredo/Workspace/wt-s4` e `SAIDA=/Users/figueiredo/Workspace/bythiagofigueiredo/.superpowers/sdd/a5/tc/saida` (`mkdir -p` uma vez).
- **Teste:** todo comando grava a saída em arquivo e mostra só o fim: `cd $W/apps/web && npx vitest run <arquivo> > $SAIDA/<tarefa>.txt 2>&1; grep -E "Test Files|Tests |FAIL|Error" $SAIDA/<tarefa>.txt | head -20`. Nenhum comando passa de 4 min; a suíte inteira (~160 s) vai em background, com saída em arquivo.
- **Integração:** `HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres npx vitest run <arquivo> --no-file-parallelism`. Só no banco `bythiago_int` (54421/54422), nunca no 54321/54322 (é o do navegador).
- **Commit:** um por tarefa, no worktree, `git -C $W commit` com caminhos explícitos e o rodapé `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`. O pre-commit roda typecheck. Mexeu em `packages/*`? Nesta etapa não se mexe.
- **Todo arquivo de teste** começa com `// @vitest-environment node`, porque o padrão de `test/**` é happy-dom.

## 1. Decisões do dono ainda abertas (pontos de escolha; este plano não decide)

| # | Pergunta | O que muda se **sim** | O que muda se **não** | Quando trava | Recomendação registrada |
|---|---|---|---|---|---|
| **D1** | Push e promoção da rota do P-V (Tarefa 1), com o envio que leva os 28 commits do A/B hoje em `origin/main..origin/staging` | A rota vai ao ar e o P-V roda em 20/10 | Sem rota não há P-V. Sem P-V até 21/10 12:22 UTC, o resultado é "inconclusivo", que vale como não passou, e a coleta vai para a forja (§13 do spec) | Tarefa 1b, passo 4 (a T1 já está feita). Pedir até **19/10 12:00 UTC** para caber no alvo de 20/10 09:00 | Spec §12: pedir já. A sessão do A/B já deu ok para a opção (a) (ver Tarefa 1b, passo 5); só o push espera o dono |
| **D2** | Próprios antigos (os 35 vídeos do canal, como o qIg9 de 2019) entram a 1 rodada/dia? | Tarefa 9, ramo D2-sim: uma 4ª consulta (`youtube_videos` inteiro), `motivo_ate = 'proprio_antigo'`, `rodadas_por_dia = 1`, `coleta_ate = agora + 1 d` renovada a cada conciliação, hora-base em 0..1439 (`proximaRodada` com período de 24 h), mais um caso em A5 e um em B6. Custo: +35 rodadas/dia (+105 leituras, ~34 KB/dia), e a capacidade fica em 1.152 / 743 = **1,55×** | Tarefa 9 sem a 4ª consulta; nada mais muda. O caso que originou a frente (o qIg9) só é lido enquanto tiver teste nosso. Capacidade: 1.152 / 708 = **1,63×** | Tarefa 9, passo 5 (só esse passo espera; as outras tarefas seguem) | Phil: incluir. Hanna leva ao dono |
| **D7** | Gravar `view_count bigint` (o `videoDetails.viewCount` da mesma página)? | Tarefa 11, o ramo D7: o parser extrai `viewCount`, o envelope `ResultadoLeitor` ganha `viewCount: number \| null`, `paraLinhas` grava a coluna, e a migration ganha 1 coluna e 1 CHECK (diff no Apêndice A.2; o C6 passa a **18** CHECKs). Custo: +8 B/linha, ~14 KB/dia | A Tarefa 11 não roda e a migration fica como no Apêndice A.1 (o C6 continua em **17**) | Antes do `db:new` (Tarefa 10, passo 1); prazo duro **29/10** (C5) | Phil: sim (o dono prefere gravar mais do que usa) |

O schema do Apêndice A.1 já aceita os dois lados de D2 (`rodadas_por_dia in (1,4)`, `hora_base_min` 0..1439, `motivo_ate` com `proprio_antigo`). Assim, D2 não segura a migration: só muda o código da conciliação. Este plano assume um ponto que não é decisão: o CHECK aceitar um valor que talvez nunca seja usado.

## 2. O que é do dono

- **D1, D2, D7** (acima).
- **`db:push:prod`** da migration `observatorio_a5_s4_leitura_watch`, que o agente roda depois do portão (memória: "rodar eu mesmo sempre que der"). A fila é: Migration A do A/B, depois **esta**, depois `ab_native_tests`. Prazo **29/10 23:59 UTC** (C5). A partir de 30/10 não há dia de migration.
- **Variáveis no Vercel** (Production): `OBS_WATCH_READ=on` só depois da migration aplicada e do P-V aprovado, **longe das 05:00 SP** (das 08:00 UTC). O agente prepara o comando e o dono confirma.
- **C8:** a página de uso do Vercel no D+1 (só o dono enxerga o painel).

## 3. Fatos medidos

| Fato | Valor | Como (data) |
|---|---|---|
| P1: duração da `leitura_horaria` | p50 2,6 s, p90 3,2 s, p99 4,4 s (n = 117, 7 d) | `.superpowers/sdd/a5/tc/medicoes-p1-p3.md` (18/10) |
| **Atraso de partida do disparo** (pendente do spec) | `started_at` da 1ª tarefa contra a marca do cron (:00/:20/:40): **p50 50,1 s, p90 51,0 s, p99 53,5 s, máx 59,6 s** (n = 117). Todas as tarefas começam de 49,6 a 54,9 s depois da marca | `npx supabase db query --linked` (só select), 18/10 19:20 UTC. Consulta em §11, Q1 |
| Leitura do atraso | **Fica ANTES de `t0`** e não entra no `decorrido`. A prova: a `leitura_horaria` tem `comecaAteMs = 22 s` contado de `t0`, mas começou 117 vezes a ~50 s da marca. Logo, pelo menos ~28 s acontecem antes do handler, o que é o atraso de invocação do cron do Vercel. As leves começam ~4,4 s depois da horária (`poda_acesso_ia` p50 54,5 s contra 50,1 s) | dedução sobre Q1 [V] + `route.ts:89` (`t0 = Date.now()` logo antes de `executarAgenda`) |
| Início da leve (`decorrido`) | ≤ ~10 s no pior caso conhecido (a horária com p99 de 4,4 s, mais as leves diárias com ≤ 1,6 s cada). Constante `INICIO_LEVE_P90_S = 10` | P1 + Q1 |
| **Nomes de coluna** (pendente) | `competitor_agenda_runs`: `task, period_key, status, attempts, runs, unfinished_n, started_at, finished_at, duration_ms, done_n, left_n, reason (^[a-z0-9_]{1,60}$), detail`. `competitor_videos.video_id`, `.competitor_channel_id`, `.is_short` (nunca nulo). `ab_tests.youtube_video_id` é **uuid** para `youtube_videos.id`; `ab_tests.status` em (`draft`,`active`,`paused`,`completed`,`archived`): **não existe `queued`** no CHECK de `origin/staging`, mas o filtro `not in ('completed','archived')` cobre o que vier. `youtube_videos` **não tem** `privacy_status`: o status de privacidade fica em `yt_own_video_meta_daily.privacy_status` | migrations `20261013000001`, `20260517000001`, `20261007000006` em `origin/staging` |
| **Os 15 ids da rajada do P-V** (pendente) | `S1iMQVIOFL4, r_3QZBKHqU8, L7AAl8-2eAw, N6UYPe1XBXM, l2ZcAWDBqX4, BKczyNOMdoc, c-854vZoH1M, P5QuSE1gL78, iLVy8mcEvwk, HSKiot-PDm8, q57zkJR-kMo, yJl_YzInZ3U, IZM5b1aq1J0, eibJk0L8zzc, JWjvfUozxY0`. São vídeos próprios, públicos no último `yt_own_video_meta_daily`, fora de teste aberto e diferentes do qIg9 | Q2 (18/10 19:21 UTC) |
| V hoje | 176 concorrentes com ≤ 30 d (125 sem Shorts), **0** próprios com ≤ 14 d, 35 próprios no total, 1 teste aberto, então **V ≈ 177** (o spec estimou 145). Demanda: 708 rodadas/dia (+35 com D2) contra a capacidade de 1.152 (K = 16). Passa o aceite de 1,5× | Q3 (18/10) |
| **Shorts** (decisão do plano, §7 do spec) | A watch de 2 Shorts de concorrente (`qC6NKtvUemA`, `HPHeHs0K5uM`) pedida do Mac com `hl=pt-BR&gl=BR`: **200 sem redirecionamento**, 1,3 MB, os 3 renderers presentes e `videoDetails` presente. **Decisão: Shorts entram em V** (a página lê igual; com eles a capacidade fica em 1,63×). Se a demanda medida passar de 768 rodadas/dia (capacidade abaixo de 1,5×), os Shorts são os primeiros a sair (constante `INCLUIR_SHORTS`). Se o T&C vale para Shorts não foi medido [H]: a regra só acende com mistura real, então o custo de lê-los é só de leitura | curl do Mac, 18/10 19:21 UTC |
| Sonda horária do Mac | a última linha de `titulos.tsv` era 18/10 18:21 UTC (`hora watch 9 3`). A C1 confere em 19/10 | `tail titulos.tsv` |
| Banco local `bythiago_int` | migrations até `20261018000002`, `can_view_private_site(uuid)` presente | `psql :54422` |

| **Literais da requisição** (Phil I2) | `USER_AGENT_LEITOR` = o `USER_AGENT` de `apps/web/src/app/api/cron/watch-pv/executar.ts` (copiar o literal para cá no passo 1 da T1b, e a T6 o importa ou o repete com teste de igualdade). URL = `https://www.youtube.com/watch?v=<id>&hl=pt-BR&gl=BR`. `Accept-Language: pt-BR`. A rota do P-V e o leitor usam os mesmos três | `executar.ts` do commit `e964ba7e9` |
| **Custo por vídeo no Vercel** (Yannis I4) | 1,2 s/vídeo é hipótese [H]. A fase 2 do P-V mede (`paredeMs / 16`); confirma ou refuta no P-V (T2) | a medir |

**O que NÃO foi medido:** o comportamento do Vercel (H1, que é o P-V), se a rede de entrada é cobrada (H2, C8), a duração e a CPU no Vercel, e se o T&C vale para Shorts.

## 4. Contas

- **Tempo por disparo:** `K_agora = min(16, devidos, ⌊(min(70 − d, 30) − 3) / 1,2⌋)`, com `d ≈ 5–10 s` medido, o que dá **K = 16**. Demanda média: 708/72 = 9,8 vídeos por disparo (10,3 com D2). Disparo cheio: 16 × 1,2 + 3 = 22,2 s com a margem.
- **Aceite de capacidade:** `72 × K(INICIO_LEVE_P90_S = 10) = 1.152 ≥ 1,5 × demanda`. A demanda é 708 (1,63×) ou 743 com D2 (1,55×). O teste usa `DEMANDA_RODADAS_DIA` derivado de V = 177 (+35 com D2). O gatilho de replanejar é a **demanda medida** pela prova (`demanda_rodadas_dia = sum(rodadas_por_dia)` dos alvos ativos, extensões incluídas) **> 768 rodadas/dia** (razão < 1,5), ou `alvos_atrasados > 0` em 2 provas seguidas. Refeita com as parcelas (Phil I10): V ≤ 192 sem D2 e sem extensões; V ≤ 183 com D2; com ~10 extensões a razão de hoje é **1,54×**, não 1,63×, e com D2 + extensões fica em **1,47×**. "V > 185" não tem instrumento e sai do plano.
- **Idas ao banco por disparo:** 1 (alvos), mais 3 (candidatos: 2 de `lerCandidatos` e 1 de testes; +1 com D2), mais 1 (`yt_watch_conciliar`), mais 1 (devidos), mais até 4 da extensão (paginadas, ≤ 1 página cada em regime), mais 1 (`yt_watch_gravar_disparo`). São **≤ 11**, e nenhuma começa depois de 83 s.
- **Rede:** 177 × 12 × 310 KB ≈ 660 MB/dia de HTML, mais 708 × 11 KB ≈ 8 MB de miniatura. **Cota do Google: 0.**
- **Banco:** 2.124 leituras/dia × 320 B ≈ 0,68 MB/dia; ~30 MB em regime (45 d). Miniaturas < 0,1 MB.
- **Poda:** lote de 5.000, até 3 lotes por execução. Uma saída típica (~6 alvos/dia × ~360 leituras) ≈ 2.200 linhas/dia, o que dá 1 lote.

## 5. Quando o dado não existe

| Situação | O que o código faz | Teste |
|---|---|---|
| Tabela ausente (deploy antes da migration) | Guarda `schemaTablesReady` com MG-S4 (`yt_watch_alvos`, `yt_watch_readings`, `yt_watch_thumbs`). A `leitura_watch` vira `parcial` `schema_ausente`, e a poda também | Tarefa 12, Tarefa 13 |
| `OBS_WATCH_READ` ausente, `ON` ou `1` | `leitura_watch` em `desligadas`. A poda roda e a prova recebe `p_coleta_ligada = false` (motivos `null`, sem aviso) | A10, Tarefa 12, Tarefa 13 |
| Candidatos > 0 e alvos = 0 | Disparo `parcial sem_alvos`. A prova dá `sem_alvos = true` depois de ≥ 1 execução | A8, B5 |
| Nenhum candidato e nenhum alvo | `ok`, `feitas = 0`, detalhe `candidatos_esperados = 0`. É dado lido: não há vídeo na janela | Tarefa 11 |
| HTTP 200 sem `ytInitialData` | `erro = 'sem_initial_data'`, nunca "sem título" | A2 |
| Renderers somem com `ytInitialData` presente | `erro = null`, títulos nulos, conta `sem_titulo`. Com ≥ 6 leituras e > 50 % sem título, o disparo fica `erro layout_mudou` | A2, A8 |
| Lista de candidatos com > 5.000 linhas ou falha na leitura | `lerCandidatos` lança `ErroDeLeitura`. O disparo fica `erro lista_falhou`, sem conciliar, e nenhum alvo sai | Tarefa 9 |
| Leitura da extensão com > 1.000 linhas | Pagina por `range` até `count`. Se a soma não bate com `count`, o vídeo não é avaliado e não sai | A12 |
| Leitura válida no Zod que o banco recusaria | Vira linha `fora_do_formato` | A11, B1 |
| Gravação com classe 23 | Degrau vídeo a vídeo e `+20 min` para quem falhar de novo | B1, A8 |
| Gravação com classe 08/53/57 ou timeout | Uma chamada só e `gravacao_falhou` | A8 |
| Prova falha (o RPC lança) | A poda fica `erro prova_falhou` e gasta tentativa. Com 12 tentativas vira `esgotada` e o aviso `tarefa_esgotada` | Tarefa 13 |
| Aviso sem site (zero alvos) | Os sites do aviso são a união dos `site_id` dos canais (`c.linhas`) com os dos candidatos, nunca só os dos alvos | Tarefa 13 |

## 6. Simulação do dia do deploy

1. Sobe o código (o lote S4) com a migration já aplicada e `OBS_WATCH_READ` desligada. A poda das 05:00 SP roda e devolve `ok`; a prova vem com os motivos `null`.
2. O dono liga `OBS_WATCH_READ=on` (por exemplo às 13:00 UTC). No 1º disparo, a conciliação cria ~177 alvos, todos devidos, e lê 16. Para esvaziar o atraso inicial são ~11 disparos (~3,7 h), com `parcial sobrou`, que é esperado.
3. Na poda do dia seguinte (08:00 UTC), `coleta_desde` tem ~19 h, menos de 24 h, então os motivos de coleta ficam `null`, salvo `sem_alvos` com zero alvos. Não há aviso falso.
4. Em D+1 12:00 UTC (C7), espera-se ≈ 2.100 leituras, `com_erro < 10 %` e `sem_titulo = 0`.
5. Por volta de D+1, o concorrente mais velho passa do `coleta_ate` e sai por `janela`, se a extensão o avaliou. A primeira poda com linhas vem ~30 dias depois (C12).

## 7. Desvios do texto do spec (com motivo)

| Spec | Plano | Motivo |
|---|---|---|
| `yt_watch_prova(p_agora, p_coleta_ligada)` | `yt_watch_prova(p_agora, p_coleta_ligada, p_candidatos_esperados integer)` | `candidatos_esperados` vem das mesmas consultas da conciliação (§4 do spec). Repetir a regra de seleção em SQL criaria duas fontes que divergem. Com `null`, `sem_alvos` sai `null` (a C7 usa `yt_watch_prova(now(), true, null)`) |
| Uma função de gravação | Mais `yt_watch_conciliar(p_agora, p_candidatos jsonb)` | A tabela de reativação do §7 é regra de conflito: no SQL ela é atômica e testável (B6). No PostgREST seriam N chamadas |
| `coleta_desde = min(started_at)` | **Início da era contínua atual**: a última execução de `leitura_watch` sem outra nas 6 h anteriores | Esta é a escolha de "religar" que o §10.2 deixa ao plano. Religada a coleta, os motivos voltam a ficar sem cor por 24 h, em vez de acender um aviso falso de `rodadas_faltando`. Custo: uma parada da agenda > 6 h também reinicia o relógio, mas essa parada já é coberta pelo vigia de 2 h |
| `rodadas_por_dia` e `proprio_antigo` não existem no DDL do spec | Coluna `rodadas_por_dia smallint (1,4)`, `hora_base_min` 0..1439, `motivo_ate` com `proprio_antigo` | Torna a migration neutra em relação a D2 (§1) |
| Índice só `(youtube_video_id, lida_em)` | Mais um índice parcial `(miniatura_id) where miniatura_id is not null` | O `on delete set null` e o "miniatura órfã" da poda precisam dele (~1 linha a cada 3) |
| Próprio "público" (§7) | `lerCandidatos` não filtra privacidade. Vídeo próprio privado vira `indisponivel` e sai depois de 4 rodadas, salvo se tiver teste nosso | `youtube_videos` não tem `privacy_status`. Hoje há 0 próprios com ≤ 14 d, então o custo é zero |
| `proximaRodada`: "agora + 3 h" | `agora + periodo/2` (3 h para 4/dia, 12 h para 1/dia) | É o mesmo número para 4/dia. O 1/dia (D2) precisa do seu |
| `yt_watch_prova(now())` na C7 | `yt_watch_prova(now(), true, null)` | Assinatura real |
| A1, regex de IPv6 | Acrescenta `\|::[0-9a-f]{1,4}` | Observação de Yannis na r4 (IPv6 comprimido curto) |
| Rota do P-V: "commit isolado (`route.ts` + teste)" | `route.ts` + `contar.ts` (puro) + `executar.ts` (dependências injetadas) + teste | O Next 16 recusa export que não é de rota em `route.ts`; a contagem e o relógio precisam de teste unitário |
| Próprio privado (desvio 6): o motivo escrito foi só "`youtube_videos` não tem `privacy_status`" | **Dívida declarada** (Yannis M6): a Q2 já filtra por `join lateral` em `yt_own_video_meta_daily`. Gatilho para pagar: o 1º próprio privado ou agendado que entrar em `yt_watch_alvos`; conserto: o mesmo `lateral` da Q2 em `lerCandidatos` | Hoje há 0 próprios com ≤ 14 d |
| Pedido de Yannis (r1): uma linha no registro do spec (§20) para os desvios 1 e 8 (assinatura da prova e texto da C7) | Feita na Tarefa 15, passo 3 | O spec está assinado; a linha só registra |

## 8. Arquivos, tarefas e paralelismo

| Tarefa | Arquivos (lista fechada) | Pode rodar junto de | Depende de |
|---|---|---|---|
| 1 Rota P-V (**FEITA**, `e964ba7e9`, worktree `wt-s4-t1`) | `app/api/cron/watch-pv/{route,contar,executar}.ts`, `test/api/cron/watch-pv.test.ts` | — | — |
| 1b Conserto da T1 + envio próprio | os mesmos 4 arquivos (commit de conserto sobre `e964ba7e9`) | 2–8 | D1, ok do A/B (a) |
| 2 Roteiro do P-V (C4) | `.superpowers/sdd/a5/tc/pv-rodar.sh`, `pv-avaliar.mjs`, `pv-roteiro.md` | 1b, 3–8 | Tarefa 1b em produção (só para rodar) |
| 3 Fixtures recortadas | `test/fixtures/watch-html/{recortar.mjs,watch-185033-1.html,watch-185036-2.html,derivar.ts}`, `test/youtube/watch/fixtures-sem-ip.test.ts` | 1, 2, 5, 8 | C0 (feita) |
| 4 Parser | `lib/youtube/watch/parser.ts`, `test/youtube/watch/parser.test.ts` | 1, 2, 5, 8 | 3 |
| 5 Miniatura | `lib/youtube/watch/miniatura.ts`, `test/youtube/watch/miniatura.test.ts` | 1–4, 8 | — |
| 6 Leitor | `lib/youtube/watch/leitor.ts`, `test/youtube/watch/leitor.test.ts` | 7, 8 | 4, 5 |
| 7 Expansor + porta pura | `lib/youtube/watch/expansor.ts`, `lib/youtube/watch/puro.ts`, `test/fixtures/watch-html/casos-recusados.ts`, `test/youtube/watch/{expansor,puro-grafo}.test.ts` | 6, 8 | 4 |
| 8 Rodada | `lib/youtube/watch/rodada.ts`, `test/youtube/watch/rodada.test.ts` | 1–7 | — |
| 9 Candidatos e conciliação | `lib/youtube/horaria/gravar.ts` (só `lerCandidatos`), `lib/youtube/watch/alvos.ts`, `test/youtube/horaria/gravar.test.ts`, `test/youtube/watch/alvos.test.ts` | 10, 11 | 8, D2 (passo 5) |
| 10 Migration + integração | `supabase/migrations/<ts>_observatorio_a5_s4_leitura_watch.sql`, `test/integration/a5-s4-watch-{schema,rls,poda-prova,conciliar}.test.ts` | 9 | C5, D7, 7 |
| 11 Ramo D7 (só se sim) | `parser.ts`, `leitor.ts`, `expansor.ts` e os testes deles | — | D7 = sim; antes da 10 |
| 12 Disparo + tarefa `leitura_watch` | `lib/youtube/watch/{disparo,gravar,extensao}.ts`, `agenda/tarefas/leitura-watch.ts`, `agenda/definicoes.ts`, `agenda/catalogo.ts`, `docs/ops/env-vars.md`, testes `test/youtube/watch/{disparo,gravar,extensao}.test.ts`, `test/youtube/agenda/{leitura-watch-tarefa,catalogo}.test.ts` | 13 (arquivos diferentes, salvo `definicoes.ts`/`catalogo.ts`: a 13 entra depois) | 6, 7, 8, 9 |
| 13 Poda + prova + aviso | `agenda/tarefas/poda-leituras-watch.ts`, `agenda/definicoes.ts`, `agenda/catalogo.ts`, `agenda/aviso.ts`, `test/youtube/agenda/{poda-leituras-watch,aviso}.test.ts` | — | 9, 10, 12 |
| 14 Remover a rota do P-V | apaga `app/api/cron/watch-pv/*` (4 arquivos) e `test/api/cron/watch-pv.test.ts`, cria `test/api/cron/watch-pv-removida.test.ts` | 12, 13 | veredito do P-V escrito (C4) |
| 15 Lembretes | `.superpowers/sdd/a5/lembretes-a5.md` | todas | — |
| 16 Portão Phil, Yannis, Gio | relatórios em `.superpowers/sdd/a5/tc/portao-s4-{phil,yannis,gio}.md` | — | 1–15 |

Os caminhos `lib/…`, `app/…` e `test/…` são relativos a `apps/web/src/` (lib e app) e a `apps/web/` (test).

**Arquivos que outras etapas da A5 e do A/B também tocam:** `agenda/definicoes.ts`, `agenda/catalogo.ts`, `agenda/aviso.ts` (`ChaveAviso`), `horaria/gravar.ts` e `test/youtube/agenda/catalogo.test.ts`. Antes de editar, `git -C $W pull --rebase origin staging`. A integração no catálogo fica nas tarefas 12 e 13, pequenas e no fim.

---

## 9. Tarefas

### Tarefa 1: Rota temporária do P-V (FEITA, commit `e964ba7e9`)

**Estado:** feita no worktree `/Users/figueiredo/Workspace/wt-s4-t1`, commit `e964ba7e9`, 4 arquivos (`route.ts`, `contar.ts`, `executar.ts`, `test/api/cron/watch-pv.test.ts`). Não se refaz. O que ela já tem e o que a T1b herda:
- Fase 1 abre rodada só até 200 s (`RODADA_NAO_COMECA_APOS_MS`), a fase 2 começa só até 235 s (`FASE2_NAO_COMECA_APOS_MS`) e nenhuma leitura começa depois de 280 s (`LEITURA_NAO_COMECA_APOS_MS`).
- `executar.ts`: `executarPv(deps)` com `fetch`, relógio e `dormir` injetados; `route.ts` só autentica, valida `v` e chama.
- `contarPagina`: o braço `'?'` quando não há os 3 renderers (sem os 3, nunca `A`).
- `PAUSA_ENTRE_LEITURAS_MS = 1_500`, `PAUSA_ENTRE_RODADAS_MS = 15_000`, autenticação **antes** da validação de `v`, `VALIDA_ATE` 22/10 (410 depois), `oficial` estrito (`"videoDetails":{}` não conta).
- Forma do JSON e `IDS_RAJADA` (os 15 ids da §3 mais `qIg9a7vqcNo`): como no código.

### Tarefa 1b: Conserto da T1 (achados de Phil e Yannis que a T1 não pegou) e envio próprio

**Objetivo:** um commit de conserto sobre `e964ba7e9` (no mesmo worktree) e o envio da rota. Onde os dois revisores dão prazos diferentes, vale o **mais estrito**. Os prazos já feitos na T1 (200/235/280 s) ficam; o que falta é o teto global e o corte da fase 2 por quem já gastou tempo.

**Arquivos:** `apps/web/src/app/api/cron/watch-pv/{route,contar,executar}.ts` e `apps/web/test/api/cron/watch-pv.test.ts` (só os que o conserto tocar).

- [ ] **Passo 1: Testes que falham** (relógio e `fetch` injetados; **a prova de prazo vai nos testes, não em comentário**):
  - **Prazo global (Phil I1, o mais estrito):** `PRAZO_GLOBAL_MS = 270_000`; a fase 2 só começa se `decorrido ≤ 235_000` (`FASE2_NAO_COMECA_APOS_MS`, o valor da T1, que não muda; r2 Yannis I-r2-1: com 200 s o caminho feliz reprovaria, pois a fase 1 sozinha gasta 165 s + 30·s); senão `fase2: null` e `cortado: 'fase2_sem_tempo'`. Nenhuma leitura nova, em nenhuma fase, começa depois de 270 s (mais estrito que os 280 s da T1). O timeout de cada leitura é `min(10_000, 280_000 − decorrido)`. O `cortado` é `false | 'fase1' | 'fase2_sem_tempo' | 'fase2_cortada'` (o `null` da T1 vira `false`; ajustar a T2). Os testes: (i) fase 1 terminando em 240 s → a fase 2 não começa (`fase2 null`, `cortado 'fase2_sem_tempo'`); (ii) `fetch` que sempre estoura o timeout (cada leitura gasta 10 s no relógio falso) → a resposta sai com `decorrido ≤ 285 s`; (iii) fase 2 com leituras de 10 s → nenhuma começa depois de 270 s, `cortado 'fase2_cortada'`, `lidas < 48`; (iv) caminho feliz → `cortado false` e 48 lidas; (v, r2) leitura de 1,5 s no relógio falso (fase 1 termina em ~210 s) → a fase 2 roda, `cortado false` (ou `fase2_cortada` só se passar de 270 s). Teto de leitura segue 270 s; pior caso 235 + 10 s de timeout, ondas cortadas em 270. O JSON ganha `fase2.lidas`.
  - **Mesma requisição do leitor (Phil I2):** o `fetch` falso afirma `user-agent` igual ao literal do §3, URL com `&hl=pt-BR&gl=BR`, `accept-language: pt-BR`, sem `cookie`, `redirect: 'manual'`. O JSON grava `ua`. (O espelho na T6 compara com o mesmo literal.)
  - **Segredo (Phil I3 / Yannis M2):** `401 com CRON_SECRET apagado` (`delete process.env.CRON_SECRET`; `Bearer undefined` dá 401); `segredo errado + v errado → 401`; `segredo certo + v=xxxxxxxxxxx → 400` com **zero** chamadas a `fetch`.
  - **Braço (Phil M1):** o JSON grava `nB` (contagem de casamentos da regex B); `braco '?'` quando `nB ∉ {0, 3}`. Rodar `contarPagina` nas 6 páginas brutas de `~/portao-dhash/nativo-qIg9a7vqcNo/html/` **local e sem commit** (elas têm o IP): esperado 2 A + 4 B.
  - **Validade (Phil M2):** depois de `2026-10-21T13:00:00Z` a rota responde 410 **depois** da autenticação (sem Bearer válido continua 401; teste com relógio injetado: 12:59:59 → 200/400, 13:00:00 → 410) (a T1 usa `VALIDA_ATE` 22/10; vale o mais estrito: ajustar a constante para 21/10 13:00 UTC e o teste).
- [ ] **Passo 2:** rodar e ver falhar: `cd /Users/figueiredo/Workspace/wt-s4-t1/apps/web && npx vitest run test/api/cron/watch-pv.test.ts > $SAIDA/t1b.txt 2>&1; grep -E "Tests |FAIL" $SAIDA/t1b.txt | head`.
- [ ] **Passo 3: Implementar** o conserto e passar. Commit (só estes caminhos): `fix: prazo global, requisição igual à do leitor e segredo provado na rota do P-V`.
- [ ] **Passo 4: Push para o staging, que espera o ok do dono (D1).** Anotar em `.superpowers/sdd/a5/tc/pv-promocao.md` a hora do pedido e a do ok. Com o ok: `git fetch origin staging`, rebase do conserto sobre `origin/staging` no worktree, depois `bash -c 'git -C /Users/figueiredo/Workspace/wt-s4-t1 push origin HEAD:staging'`. Conferir a CI (`gh run list --branch staging --limit 3`) e o deploy de preview.
- [ ] **Passo 5: Promoção para a main (decisão da sessão do A/B: opção (a), com ok dela).** Antes: `git log --oneline origin/main..origin/staging > .superpowers/sdd/a5/tc/pv-promocao-commits.txt` e `git diff --stat origin/main..origin/staging -- supabase/migrations` (Phil M4: tem de sair **vazio**; se não, o A/B confirma que a migration já está aplicada em produção, porque a ordem é migration → código).
  - **(a)** O lote S0/S1/S3 da sessão do A/B vai à main junto, **se a CI do commit da rota tiver o job Integration verde**: `bash -c 'git -C /Users/figueiredo/Workspace/wt-s4-t1 push origin origin/staging:main'`. Colar a resposta escrita do A/B no `pv-promocao.md`.
  - **(b)** Se o Integration cair de novo no limite do Docker Hub: cherry-pick **só da rota** (os 2 commits, T1 e T1b) sobre `origin/main`, e o push disso. Isto substitui o antigo "cherry-pick não é opção": o A/B liberou.
  - Sem nenhuma das duas até 19/10 18:00 UTC: levar ao dono o bypass de proteção no preview (com a recomendação da Hanna) e não promover.
- [ ] **Passo 6: Fumaça em produção (duas, ambas sem tocar no YouTube):** (1) sem `Authorization`: `curl -s -o /dev/null -w "%{http_code}\n" "https://bythiagofigueiredo.com/api/cron/watch-pv?v=qIg9a7vqcNo"` → `401`; (2) autenticada com `v` inválido: `bash .superpowers/sdd/a5/tc/pv-rodar.sh --fumaca` (a T2) → **400**, o que prova que o `CRON_SECRET` local é o da Production. Anotar as horas no ledger.

**Pronto quando:** a rota responde 401 e a fumaça autenticada 400 em produção antes de 20/10 09:00 UTC, e o ledger tem o ok do dono, o ok do A/B e a lista de commits promovidos.

### Tarefa 2: Roteiro de execução do P-V (C4)

**Objetivo:** um comando por execução, que roda o P-V, guarda o JSON e os cabeçalhos e dá o veredito pelos critérios do §12 do spec.

**Arquivos:**
- Criar: `.superpowers/sdd/a5/tc/pv-rodar.sh`. Lê `CRON_SECRET` de `apps/web/.env.local` sem ecoar e o manda por `-H @arquivo-temporário` (modo 600, apagado no fim), nunca na linha de comando (fica visível no `ps`; Phil I3). Faz `curl -sS -m 330 -D pv-<UTC>.hdr -H @<tmp> "https://bythiagofigueiredo.com/api/cron/watch-pv?v=qIg9a7vqcNo" -o pv-<UTC>.json` (`-m 330`: o cliente espera mais do que a função vive; Phil I1 e Yannis I1). Com `--fumaca`, chama com `v=xxxxxxxxxxx` e espera **400**. **Depois** que o `curl` termina (garante a rodada `:21` gravada; Yannis I3), copia as **9 últimas** linhas com `$2=="hora" && $3=="watch"` de `~/portao-dhash/nativo-qIg9a7vqcNo/titulos.tsv` para `pv-<UTC>-mac.tsv` (cada rodada tem 3 linhas `watch`; Phil I4).
- Criar: `.superpowers/sdd/a5/tc/pv-avaliar.mjs` (Node, sem dependência), que lê 1 ou 2 pares `.json` + `-mac.tsv` e imprime a tabela do §12 com cada critério e o veredito. Grava `pv-veredito.md` (com `VERCEL_REGION`, `x-vercel-id`, o `ua` e o `cortado` de cada execução). Regras:
  - **Denominadores fixos** (30 leituras na fase 1, 48 na fase 2; Phil I5): a leitura que falta conta como falha (não 200, sem renderers, sem `oficial`). `fase2: null` → a execução não passa.
  - **Mac por rodada:** agrupa as linhas pelo mesmo minuto e usa `B = $5 > 0`; o inconclusivo exige as **3** últimas rodadas sem B (Phil I4).
  - **Desfechos:** `passa` (as **duas** execuções passam); `forja` (qualquer critério do §12 reprovado — mistas < 4 com o Mac vendo B, bloqueio > 2, HTTP 200 < 28/30, renderers < 28/30, `HL`/`GL` ≠ `pt`/`BR` em alguma leitura, título oficial ausente em alguma —, exceto o controle do Mac); `inconclusivo` (o Mac sem B nas 3 últimas rodadas, ou só uma execução válida até o prazo); `invalida` (execução com `cortado ≠ false` ou `fase2.lidas < 48`: não conta como uma das duas e pode ser repetida em outra `HH:22`; Yannis I3).
  - **Capacidade medida (Yannis I4 + Phil M3):** imprime `s_por_video = fase2.paredeMs / 16` (1,2 s é a **hipótese**; o veredito é a razão `≥ 1,5`, que só cai abaixo disso com s > 1,69 s, K < 16; entre 1,2 s e 1,69 s só imprime; sem os 3 s fixos, porque a fase 2 não faz miniatura nem banco), `K_medido = min(16, ⌊27 / s_por_video⌋)` e `razão = 72 × K_medido / DEMANDA` (708). Razão < 1,5 não é `forja` automática: o controlador replaneja com `segundosPorVideo` medido (concorrência 4, ou Shorts fora). Escreve no §3 do plano "1,2 s/vídeo [H] → confirmado ou refutado".
- Criar: `.superpowers/sdd/a5/tc/pv-roteiro.md` (o passo a passo abaixo).

- [ ] **Passo 1: Teste do avaliador** (`node pv-avaliar.mjs --autoteste`): com JSON sintéticos embutidos: 28/30 com 200 e 4/10 mistas dá `passa`; 3/10 mistas com o Mac vendo B dá `forja`; 3 bloqueios na fase 1 dá `forja`; 3 bloqueios em 48 na fase 2 dá `forja`; o Mac sem B nas 3 rodadas dá `inconclusivo`; **as 2 últimas rodadas do Mac A-A-A e a 3ª com B → não é `inconclusivo`**; 27/30 HTTP 200 dá `forja`; 1 leitura com `hl 'en'` dá `forja`; 1 sem título oficial dá `forja`; `cortado 'fase2_cortada'` dá `invalida`; **22 leituras boas na fase 1 (8 faltando) → não passa**; `fase2 null` → não passa; `paredeMs 32000` (2,0 s/vídeo) → linha "capacidade 1,32× < 1,5×". Rodar `node pv-avaliar.mjs --autoteste > $SAIDA/t2.txt 2>&1; tail -3 $SAIDA/t2.txt`. Esperado: `13/13`.
- [ ] **Passo 2: Escrever `pv-rodar.sh` e `pv-roteiro.md`.** O roteiro:
  0. Antes de tudo (Phil §8): `bash .superpowers/sdd/a5/tc/pv-rodar.sh --fumaca` → 400 (prova o segredo); `awk -F'\t' '$2=="hora" && $3=="watch"' titulos.tsv | tail -9` → 3 rodadas, ao menos 1 com `$5 > 0`.
  1. C1 antes: `pgrep -fl sondar-paginas.sh` e a rodada `:21` com B nas últimas 3 h. Se a sonda estiver morta, rearmar como na C1 do spec.
  2. Às **HH:22 UTC** de 20/10: rodar `bash .superpowers/sdd/a5/tc/pv-rodar.sh` em **background** (`run_in_background`), porque o curl dura ~3,5 min.
  3. A 2ª execução vem em outra hora (≥ 2 h depois, HH:22).
  4. Rodar `node .superpowers/sdd/a5/tc/pv-avaliar.mjs pv-<1>.json pv-<2>.json` e registrar `VERCEL_REGION` e `x-vercel-id` no `pv-veredito.md`.
  5. Última hora útil: **21/10 12:22 UTC**. Sem as duas execuções até lá, o veredito é inconclusivo e a coleta vai para a forja, escrito assim.
  6. Se a rajada reprovar e a fase 1 passar: perguntar ao controlador se re-roda com concorrência 1 (§12, "se a rajada reprovar"). Essa nova rodada exige mudar `CONCORRENCIA_RAJADA` na rota, o que é um novo envio, e só vale se 10 vídeos × 72 ≥ 1,5 × demanda. Com a demanda de hoje (708), 720 < 1.062, **não fecha**, então a coleta vai para a forja. Observação (Yannis M3): a rota fica inerte sozinha depois de 21/10 13:00 UTC (410), então um re-envio também teria de mexer nessa data.
- [ ] **Passo 3:** sem commit no repositório. É ledger do controlador em `.superpowers/` (o controlador decide).

**Pronto quando:** o autoteste passa e o roteiro está escrito. **Executado quando:** existe `pv-veredito.md` com o desfecho.

### Tarefa 3: Fixtures recortadas da C0, sem IP

**Arquivos:**
- Criar: `apps/web/test/fixtures/watch-html/recortar.mjs`: recebe o HTML bruto e devolve só os blocos `var ytInitialData = …;`, `var ytInitialPlayerResponse = …;`, o `ytcfg.set({…})` que tem `"HL"` e a `<meta property="og:title">`. Troca o valor de `VISITOR_DATA`/`visitorData` e de `"remoteHost"` por `"X"`.
- Criar: `watch-185033-1.html` (A) e `watch-185036-2.html` (B), gerados de `~/portao-dhash/nativo-qIg9a7vqcNo/html/`.
- Criar: `apps/web/test/fixtures/watch-html/derivar.ts`: as funções que derivam as sintéticas do A2 a partir da página A: `semInitialData`, `comPlayability(status, motivo)`, `comHL(hl, gl)`, `semYtcfg`, `rendererCom(texto)`, `layoutNovo`, `corpoConsentimento`, `corpoRoboSemTitulo`, `semVideoDetails`.
- Teste: `apps/web/test/youtube/watch/fixtures-sem-ip.test.ts`

- [ ] **Passo 1: Teste que falha.** `nenhuma fixture em watch-html tem visitorData, remoteHost ou IP`: varre o diretório e exige zero ocorrências de `/visitor_?data"\s*:\s*"(?!X")/i`, de `/"remoteHost"\s*:\s*"(?!X")/i`, de IPv6 `/[0-9a-f]{1,4}(:[0-9a-f]{0,4}){5,7}|::[0-9a-f]{1,4}/i` (com a lista de exceções escrita no teste, se a versão do cliente casar) e de IPv4 só no valor de `remoteHost`. Também `o recortador tira o IP de uma página bruta`: uma string sintética com `"remoteHost":"2804:abcd::1"` passa por `recortar()` e sai com `"X"`.
- [ ] **Passo 2:** rodar (`fixtures-sem-ip.test.ts`) e ver falhar (sem fixtures).
- [ ] **Passo 3:** escrever `recortar.mjs`, gerar as 2 fixtures (`node recortar.mjs <bruto> > <fixture>`) e escrever `derivar.ts`.
- [ ] **Passo 4: Teste do teste, local e sem commit:** copiar uma página bruta para `$SAIDA/bruta.html`, apontar o varredor para lá (`WATCH_FIXTURES_DIR=$SAIDA` lido pelo teste só se definido) e ver FALHAR. Depois, o controlador roda `grep -c '<prefixo do IP do dono>' apps/web/test/fixtures/watch-html/*.html` (fora do repo, sem imprimir o valor) e espera `0` em cada arquivo (C0).
- [ ] **Passo 5:** rodar o teste e ver passar. Commit: `test: fixtures recortadas da watch do qIg9 (A e B reais, sem IP)`.

**Pronto quando:** as 2 fixtures têm menos de 400 KB cada, o varredor passa, o teste do teste falhou na bruta e o `grep -c` deu 0.

### Tarefa 4: Parser (`extrairDaWatch`)

**Arquivos:** Criar `apps/web/src/lib/youtube/watch/parser.ts`. Teste `apps/web/test/youtube/watch/parser.test.ts`.

**Interfaces:**
- Produz:
  ```ts
  export const VERSAO_LEITOR = 1
  export type CodigoErroWatch = 'http_429' | 'http_4xx' | 'http_5xx' | 'consentimento' | 'redirecionado' | 'verificacao_robo'
    | 'indisponivel' | 'sem_initial_data' | 'sem_idioma' | 'timeout' | 'rede' | 'parser' | 'fora_do_formato'
  export const CODIGOS_BLOQUEIO: ReadonlySet<CodigoErroWatch>   // consentimento, verificacao_robo, http_429
  export interface ExtracaoWatch {
    erro: CodigoErroWatch | null
    titulosExibidos: Array<{ renderer: string; texto: string | null }>   // sempre 3, na ordem de RENDERERS_TITULO
    tituloOficial: string | null
    titulo_oficial_fonte: 'videoDetails' | 'og_title' | null
    idioma: string | null
    rendicoesSqp: number | null
    jogadorBloqueado: boolean
  }
  export function extrairDaWatch(html: string, ytId: string): ExtracaoWatch   // nunca lança; exceção interna vira erro 'parser'
  export function normalizarIdioma(hl: string | null, gl: string | null): string | null
  export function jsonApos(html: string, marcador: string): unknown | null   // indexOf + varredura de chaves balanceadas, respeitando strings
  ```
- Consome: `RENDERERS_TITULO` e `normalizarTitulo` de `@/lib/youtube/teste-youtube`.

- [ ] **Passo 1: Testes que falham (A1 e A2).**
  - A1 (`watch-185033-1.html`): `3 renderers com o TITULO_A`; `tituloOficial === TITULO_A` com fonte `videoDetails`, sem " - YouTube"; `idioma 'pt-BR'`; `rendicoesSqp === 4`; `erro null`; `jogadorBloqueado false`.
  - A1 (`watch-185036-2.html`): `3 renderers com o TITULO_B`; `tituloOficial` continua `TITULO_A`.
  - `runs[] concatenados`: um `videoPrimaryInfoRenderer` com `runs` `["5 - ", "Como …"]` dá o texto inteiro.
  - `&amp; vira &`.
  - `sem videoDetails usa og:title` (via `semVideoDetails`): fonte `og_title`.
  - `sqp de outro vídeo não conta` (insere uma URL `ytimg.com/vi/OUTRO1234567/…?sqp=`): continua 4.
  - A2: `corpoConsentimento` → `consentimento`; `corpoRoboSemTitulo` → `verificacao_robo`; `comPlayability('LOGIN_REQUIRED', robô)` com renderers → `erro null`, títulos lidos, `jogadorBloqueado true`; `comPlayability('UNPLAYABLE')` com `layoutNovo` → `indisponivel`; `semInitialData` → `sem_initial_data`; `comHL('es-419','BR')` → `'es-419'`; `comHL('pt','BR')` → `'pt-BR'`; `comHL('pt', null)` → `'pt'`; `comHL('xx_YY','ZZ')` → `null` e, com título, `sem_idioma`; `semYtcfg` com título → `sem_idioma`; `rendererCom(' ')`, `rendererCom(' ')` e `rendererCom('​')` → `texto null`; `layoutNovo` (os 3 renderers somem, `ytInitialData` presente) → `erro null` e os 3 textos `null`.
  - `erro ≠ null ⇒ titulosExibidos todos null e tituloOficial null` (canonização na fonte).
  - `HTML de 2 MB sem marcador termina em < 50 ms` (guarda contra regex catastrófica).
- [ ] **Passo 2:** rodar e ver falhar: `npx vitest run test/youtube/watch/parser.test.ts > $SAIDA/t4.txt 2>&1; …`.
- [ ] **Passo 3: Implementar** com as fontes da tabela do §5.3 do spec. Os renderers são achados por busca recursiva na árvore de `ytInitialData` (o primeiro nó com a chave), com teto de profundidade 60. Entidades HTML decodificadas só em `og:title` (o JSON já vem decodificado). `normalizarIdioma`: `HL` com `-` fica como está; senão `HL-GL`; só `HL` dá `HL`; o resultado tem de casar `^[a-z]{2,3}(-([A-Z]{2}|[0-9]{3}))?$`, senão `null`.
- [ ] **Passo 4:** rodar e ver passar. Commit: `feat: parser da página watch (S4)`.

### Tarefa 5: Sonda de miniatura

**Arquivos:** Criar `apps/web/src/lib/youtube/watch/miniatura.ts`. Teste `apps/web/test/youtube/watch/miniatura.test.ts`.

**Interfaces:**
- Produz: `export type MiniaturaSondada = LeituraWatch['miniaturas'][number]` e `export async function sondarMiniatura(ytId: string, f: typeof fetch = fetch, timeoutMs = 5_000): Promise<MiniaturaSondada>`. Faz `GET https://i.ytimg.com/vi/<id>/hqdefault.jpg` sem query, `host 'i.ytimg.com'`, `variante 'hqdefault'`, `sha16` = 16 primeiros hex do SHA-256 dos bytes. Nunca lança: em falha de rede devolve `http null` e o resto nulo.
- Consome: `dhashOf` de `@/lib/youtube/thumb-fingerprint`, `IMAGEM_PADRAO_YT` de `@/lib/youtube/teste-youtube/imagem`.

- [ ] **Passo 1: Testes que falham (A4):**
  - `200 com JPEG 480×360` (gerado por `sharp` no teste) → `largura 480`, `altura 360`, `dhash` de 16 hex, `etag` igual ao cabeçalho.
  - `404 com corpo de imagem` → `dhash`, `largura` e `altura` null, e `http 404`.
  - `200 cujo dHash é IMAGEM_PADRAO_YT` (com `dhashOf` mockado) → nulos, `http 200`.
  - `rede lança` → `http null`, e o resto nulo.
  - `etag vazio vira null` e `etag com mais de 200 caracteres vira null`.
  - A saída passa no `miniaturaSchema` (via `leituraWatchSchema` com uma leitura mínima).
- [ ] **Passos 2–4:** falhar, implementar e passar (`> $SAIDA/t5.txt`). Commit: `feat: sonda de miniatura da watch (sempre GET)`.

### Tarefa 6: Leitor (`lerWatchSemCookie`)

**Arquivos:** Criar `apps/web/src/lib/youtube/watch/leitor.ts`. Teste `apps/web/test/youtube/watch/leitor.test.ts`.

**Interfaces:**
- Produz: `OpcoesLeitor` e `ResultadoLeitor` exatamente como no §5.1 do spec, e `lerWatchSemCookie(ytId, opts): Promise<ResultadoLeitor>`. **Importa** `USER_AGENT_LEITOR` e `urlWatch(ytId)` (= `https://www.youtube.com/watch?v=<id>&hl=pt-BR&gl=BR`) de `apps/web/src/lib/youtube/watch/cabecalhos.ts`, que já existe (commit `0dc5f2df7`); não recriar (r2 Phil m4).
- Consome: `extrairDaWatch`, `sondarMiniatura`, `leituraWatchSchema`.

- [ ] **Passo 1: Testes que falham (A3):**
  - `nunca lança`: `fetch` que rejeita → `erro 'rede'`, `http null`; `AbortError` → `timeout`; corpo cuja `text()` passa do timeout → `timeout`; JSON quebrado → `sem_initial_data` ou `parser`.
  - `status`: 429 → `http_429`; 404 → `http_4xx`; 503 → `http_5xx`; 302 para `consent.youtube.com` → `consentimento`; 302 para `/shorts/x` → `redirecionado` com `http 302`.
  - `a leitura do envelope passa em leituraWatchSchema` para as 2 fixtures e todas as sintéticas.
  - `robô de player`: `jogadorBloqueado true` e `leitura.erro null`.
  - `sonda só com erro null`: `sondarMiniatura: true` e resposta 429 → `miniaturas []` e a sonda não é chamada; 200 → 1 miniatura.
  - `429 na 1ª e 200 na 2ª` (a coleta passa `true` nas duas) → a 1ª fica `http_429` com `[]` e a 2ª com a miniatura (Phil I1).
  - `lidaEm é o instante da resposta`: `agora` injetado, devolvendo 1000 antes do fetch e 2000 depois → `lidaEm` = ISO de 2000.
  - `opção inválida lança TypeError antes de qualquer rede`: id de 10 caracteres, `rodadaId` que não é uuid, `origemRede 'x'`; o `fetch` não é chamado.
  - `igual ao P-V` (Phil I2): `USER_AGENT_LEITOR === '<texto do UA, Chrome/130.0.0.0…, colado do §3>'` (alarme, não a fonte) e `urlWatch('x'.repeat(11))` contém `hl=pt-BR&gl=BR`; a rota do P-V importa do mesmo `cabecalhos.ts`.
  - `nenhum Cookie enviado`: o `fetch` falso confere os cabeçalhos (sem `cookie`, com `accept-language: pt-BR`, `redirect: 'manual'`, `cache: 'no-store'`).
  - `schema recusa (parser defeituoso simulado) vira erro 'parser'` com os campos zerados.
- [ ] **Passos 2–4:** falhar, implementar e passar. Commit: `feat: lerWatchSemCookie (leitor anônimo da watch, envelope ResultadoLeitor)`.

### Tarefa 7: Expansor, espelho do banco e porta pura

**Arquivos:**
- Criar: `apps/web/src/lib/youtube/watch/expansor.ts`, `apps/web/src/lib/youtube/watch/puro.ts`
- Criar: `apps/web/test/fixtures/watch-html/casos-recusados.ts`: a tabela única de valores que o banco recusa. A Tarefa 10 a reusa.
- Testes: `apps/web/test/youtube/watch/expansor.test.ts`, `apps/web/test/youtube/watch/puro-grafo.test.ts`

**Interfaces:**
- Produz:
  ```ts
  export interface LinhaLeitura {   // colunas de yt_watch_readings (nomes do banco) + thumb_k
    site_id: string; youtube_video_id: string; lida_em: string; rodada_id: string; origem_rede: 'vercel' | 'forja' | 'mac-casa'
    versao_leitor: number; http: number | null; erro: string | null; idioma: string | null
    titulo_oficial: string | null; titulo_oficial_fonte: 'videoDetails' | 'og_title' | null; titulo_exibido: string | null
    renderers_presentes: number; titulos_divergentes: Array<{ renderer: string; texto: string | null }> | null
    rendicoes_sqp: number | null; jogador_bloqueado: boolean; thumb_k: number | null
  }
  export interface LinhaThumb { k: number; site_id: string; youtube_video_id: string; host: string; variante: string; http: number | null
    etag: string | null; sha16: string | null; dhash: string | null; largura: number | null; altura: number | null; vista_em: string }
  export type LinhaLeituraBanco = Omit<LinhaLeitura, 'thumb_k'> & { miniatura_id: number | null }
  export type LinhaThumbBanco = Omit<LinhaThumb, 'k' | 'vista_em'> & { id: number }
  export const linhaLeituraSchema: z.ZodType<LinhaLeitura>   // cada CHECK do Apêndice A.1, um a um, inclusive yt_watch_titulos_ok
  export const linhaThumbSchema: z.ZodType<LinhaThumb>
  export function paraLinhas(r: ResultadoLeitor, siteId: string, k: number): { leitura: LinhaLeitura; thumb: LinhaThumb | null; foraDoFormato: boolean }
  export function linhaCabeNoBanco(l: LinhaLeitura): boolean
  export function thumbCabeNoBanco(t: LinhaThumb): boolean
  export function leiturasDoBanco(linhas: readonly LinhaLeituraBanco[], thumbs: readonly LinhaThumbBanco[]): { validas: LeituraWatch[]; invalidas: number }
  ```
  `puro.ts` reexporta **só** `extrairDaWatch`, `leiturasDoBanco` e `paraLinhas`.
- Regra de `paraLinhas`: com `erro ≠ null`, os títulos são nulos e a máscara é 0. A máscara tem o bit `i` ligado quando `RENDERERS_TITULO[i]` tem texto. `titulo_exibido` é o texto quando todos os presentes são iguais byte a byte e não há renderer fora da lista; senão `titulos_divergentes` recebe os 3 itens. Linha ou miniatura que não cabe vira a linha canônica `erro 'fora_do_formato'` (http mantido, todo o resto nulo, `thumb null`) e `foraDoFormato true`.

- [ ] **Passo 1: Testes que falham:**
  - A7 `ida e volta`: um gerador à mão com `rng` semeado (mulberry32, semente 20261018) produz 500 `ResultadoLeitor` no domínio do leitor (0 ou 1 miniatura, os renderers de `RENDERERS_TITULO`). Para cada um, `leiturasDoBanco([comoBanco(paraLinhas(r))], thumbs)` dá `[r.leitura]` (`toEqual`), e `jogador_bloqueado`, `http` e `versao_leitor === VERSAO_LEITOR` voltam pelas colunas.
  - A7 `miniatura só na leitura que a buscou`: uma rodada com 3 leituras, só a 1ª com `miniatura_id` → as outras 2 com `miniaturas []`.
  - A7 `fixture do A/B`: `carregarQIg9().leituras`, passadas por `paraLinhas` e `leiturasDoBanco` (com as 6 miniaturas da fixture reduzidas à 1ª, regra do expansor), dão o mesmo `campos.titulo` de `detectarTesteYoutube` que a fixture direta, e `contagem.rodadasMistasTitulo === 13`. A miniatura é afirmada à parte: o estado é `nao_lido` ou `um_valor_so`.
  - A11 `linha envenenada`: 300 `LeituraWatch` válidas no Zod, inclusive `erro` com `tituloOficial`, idioma `es-419`, etag de 150 e variante de 30 → toda saída de `paraLinhas` passa em `linhaCabeNoBanco`; quem não passaria vira `fora_do_formato`.
  - `casos-recusados`: para cada caso da tabela (`''`, `'   '`, dHash maiúsculo, dHash de 15, erro com título, `largura` sem `altura`, `titulos_divergentes` sem `texto`, com `'null'` string e com renderer vazio, idioma `pt_BR`, `renderers_presentes 8`, `rendicoes_sqp 201`, `etag ''`, `variante 'HQ'`) → `linhaCabeNoBanco` ou `thumbCabeNoBanco` dá `false`.
  - `leiturasDoBanco` conta como `invalidas` uma linha que o Zod do contrato recusa, sem lançar.
  - A13 `puro-grafo.test.ts`: `vi.mock('sharp', …)`, `vi.mock('@vercel/blob', …)` e `vi.mock('@supabase/supabase-js', …)` lançam ao carregar; `await import('@/lib/youtube/watch/puro')` resolve.
- [ ] **Passos 2–4:** falhar, implementar e passar (`> $SAIDA/t7.txt`). Commit: `feat: expansor da watch (paraLinhas, leiturasDoBanco, espelho dos CHECKs) e porta pura`.

### Tarefa 8: Rodada, orçamento e extensão (puros)

**Arquivos:** Criar `apps/web/src/lib/youtube/watch/rodada.ts`. Teste `apps/web/test/youtube/watch/rodada.test.ts`.

**Interfaces:**
- Produz:
  ```ts
  export const RODADA = { leiturasPorRodada: 3, sorteioMin: 20, faixaMin: 20, kMax: 16, segundosPorVideo: 1.2, segundosFixos: 3,
    comecaAteS: 70, orcamentoS: 30, bancoAteS: 83, concorrencia: 3, extensaoMaxVideos: 4, inicioLeveP90S: 10 } as const
  export const DEMANDA_RODADAS_DIA: number      // 177 × 4 (+35 com D2-sim; a Tarefa 9 ajusta)
  export function periodoMin(rodadasPorDia: 1 | 4): number     // 1440 / rodadasPorDia
  export function proximaRodada(agoraMs: number, horaBaseMin: number, rodadasPorDia: 1 | 4, rng: () => number): number
  export function faixaMenosCheia(horasBaseAtivas: readonly number[], idParaDeslocamento: string): number  // devolve hora_base_min em 0..359
  export function kAgora(decorridoMs: number, devidos: number, segundosPorVideo?: number): number
  export function estenderColeta(a: { coletaAte: string; extensoesCurtas: number }, v: { provavel: boolean; rodadasMistasTitulo: number; ultimaVista: string | null }, agoraMs: number):
    { coletaAte: string; motivoAte: 'extensao' | 'extensao_curta'; extensoesCurtas: number; reterAte: string | null } | null
  ```
  `proximaRodada`: o primeiro instante `meiaNoiteUTC + horaBase + k·periodo` maior que `agora + periodo/2`, mais um sorteio uniforme em ±20 min. `faixaMenosCheia`: conta as 18 faixas de 20 min (com `hora_base_min mod 360`), escolhe a menos cheia (empate pela de menor índice) e soma o deslocamento `hash(id) mod 20`. `estenderColeta`: provável → `greatest(coletaAte, ultimaVista + 30 d)` e `reterAte = ultimaVista + 180 d`; senão, a < 48 h do corte, com `rodadasMistasTitulo ≥ 1` e `extensoesCurtas < 2` → `coletaAte + 3 d`; senão `null`. Nunca diminui.

- [ ] **Passo 1: Testes que falham:**
  - A5 `nunca < 2h40`: 145 ids × 30 dias simulados com `rng` semeado; a menor distância entre rodadas é ≥ 160 min, e o sorteio fica dentro de ±20 min.
  - A5 `carga por disparo ≤ 1,5× a média` com `faixaMenosCheia` para 145 e para 177 ids.
  - A5 (D2) `1/dia`: `proximaRodada(…, 1, rng)` com distância mínima ≥ 12 h − 20 min. **E a distância máxima (Phil I8):** para `horaBase` em 0..1439 (a 4/dia e a 1/dia), a distância entre rodadas é ≤ período + 40 min. `proximaRodada` usa `horaBase mod periodo`; sem isso, da meia-noite até `horaBase` não haveria vaga e o intervalo chegaria a ~16 h.
  - A8 `kAgora em tabela`: `decorrido` 5, 20, 45, 50, 55, 60, 65 e 70 s com 99 devidos → 16, 16, 16, 14, 10, 5, 1, 0. Com 0,9 s por vídeo (concorrência 4): 52 s → 16, 56 s → 12.
  - A8 `capacidade`: `72 × kAgora(RODADA.inicioLeveP90S * 1000, 99) >= 1.5 * DEMANDA_RODADAS_DIA`.
  - A8 `16 devidos com a leve começando em 45 s → 16`.
  - A6 `estenderColeta`: monótona (nunca devolve `coletaAte` menor); `null` sem sinal; curta no máximo 2 vezes (a 3ª devolve `null`); provável grava `reterAte`.
- [ ] **Passos 2–4:** falhar, implementar e passar. Commit: `feat: rodada da watch (próxima rodada, faixa, K, extensão)`.

### Tarefa 9: Candidatos e conciliação

**Arquivos:**
- Modificar: `apps/web/src/lib/youtube/horaria/gravar.ts`: `lerCandidatos(sb, agoraMs, relatar?, janelaDias: number = RULES.hourly.ageDays)`. Só troca a constante pelo parâmetro.
- Criar: `apps/web/src/lib/youtube/watch/alvos.ts`
- Testes: `apps/web/test/youtube/horaria/gravar.test.ts` (acrescentar), `apps/web/test/youtube/watch/alvos.test.ts`

**Interfaces:**
- Produz:
  ```ts
  export const INCLUIR_SHORTS = true
  export const PROPRIOS_ANTIGOS: boolean   // valor = resposta de D2 (passo 5)
  export interface Candidato { siteId: string; ytId: string; tipo: 'concorrente' | 'proprio'
    motivoAte: 'janela_concorrente' | 'janela_propria' | 'proprio_antigo' | 'teste_nosso'; coletaAte: string; rodadasPorDia: 1 | 4 }
  export interface TesteVivo { siteId: string; ytId: string }
  export function montarCandidatos(conc: CandConcorrente[], prop: CandProprio[], testes: TesteVivo[], antigos: CandProprio[] | null, agoraMs: number): Candidato[]
  export async function lerTestesVivos(sb: SupabaseClient, agoraMs: number): Promise<Lido<TesteVivo[]>>
  export interface AlvoAtivo { id: number; siteId: string; ytId: string; horaBaseMin: number; rodadasPorDia: 1 | 4; proximaRodadaEm: string
    coletaAte: string; motivoAte: string; extensoesCurtas: number; indisponivelSeguidas: number; rodadas: number; temTesteNosso: boolean }
  export async function conciliar(sb: SupabaseClient, agoraMs: number, relatar?: RelatarHoraria):
    Promise<Lido<{ candidatosEsperados: number; alvosAtivos: number; inseridos: number; removidos: number; sites: string[] }>>
  export async function lerDevidos(sb: SupabaseClient, agoraMs: number, limite: number): Promise<Lido<AlvoAtivo[]>>
  ```
- Regras de `montarCandidatos`: concorrente com `publishedAt` ≤ 30 d, canal não pausado nem ausente, `missingSince` nulo (os filtros de `horaria/lista.ts`) → `coletaAte = publishedAt + 30 d`. Sem data de publicação, não entra. Próprio com ≤ 14 d → `publishedAt + 14 d`. Teste vivo → `teste_nosso`, `agora + 1 d`, 4/dia. Antigo (D2) → `proprio_antigo`, `agora + 1 d`, 1/dia. **Deduplica por `(siteId, ytId)`:** `coletaAte` máximo, `rodadasPorDia` máximo e motivo `teste_nosso` antes de todos; os outros, pelo maior `coletaAte`. `hora_base_min` é calculado em `conciliar` só para quem não está no `Set` dos alvos existentes (incremental, sem recontar do banco), **mas todo candidato vai ao RPC com os 7 campos não nulos** (`site_id, youtube_video_id, tipo, motivo_ate, coleta_ate, hora_base_min, rodadas_por_dia`): o alvo existente leva o `hora_base_min` lido no passo (1) e `rodadas_por_dia` explícito (Phil I6: o `NOT NULL` é conferido na linha proposta **antes** do `on conflict`; um `null` aborta o disparo inteiro, e o `default` não vale para o `null` vindo de `jsonb_to_recordset`).
- `lerTestesVivos`: `ab_tests` com `select('status, created_at, updated_at, youtube_videos!inner(youtube_video_id, site_id)')`, `.not('status', 'in', '(completed,archived)')`; o `draft` só entra com `created_at` ou `updated_at` ≤ 30 d. **Lê `youtube_videos.youtube_video_id`, nunca o uuid.**
- `conciliar`: (1) lê todos os alvos (`id, site_id, youtube_video_id, hora_base_min, saiu_em`), paginados por `range`; (2) chama `lerCandidatos(sb, agora, relatar, 30)`, `lerTestesVivos` e (D2) os antigos, em paralelo; (3) chama `rpc('yt_watch_conciliar', { p_agora, p_candidatos })`; (4) devolve `candidatosEsperados = candidatos.length` e `alvosAtivos` da resposta. `sites` é a união dos `siteId` dos candidatos. Devolve também `testesVivos: Set<string>` (chave `site|yt`, vinda de `lerTestesVivos` no mesmo disparo; Phil I7). Uma falha de leitura devolve `{ porque, causa }` e o RPC não roda.
- `lerDevidos`: `saiu_em is null and proxima_rodada_em <= agora`, `order(proxima_rodada_em)`, `limit`. `temTesteNosso` é marcado pelo chamador a partir do `Set` `testesVivos` de `conciliar`, **nunca** por `motivo_ate` (Phil I7: com `coleta_ate` maior, o `greatest` deixa o `motivo_ate` como `janela_propria` ou `extensao` e o teste não aparece; o alvo com teste vivo poderia sair por `indisponivel` e reativar em laço, 216 leituras/dia contra 12).

- [ ] **Passo 1: Testes que falham:**
  - A9 `lerCandidatos sem a janela pede 14 dias` (o `sb` falso captura o `or(...)` com o corte de 14 d) e `com 30 pede 30`.
  - `montarCandidatos`: Short entra quando `INCLUIR_SHORTS`; canal pausado fica fora; próprio com 15 d fica fora; o mesmo vídeo como próprio ≤ 14 d e como teste dá 1 candidato `teste_nosso` com o maior `coletaAte`; `publishedAt` nulo fica fora.
  - `lerTestesVivos`: `draft` com 31 d fica fora e com 29 d entra; `active` entra; o id é o de 11 caracteres; falha do banco → `porque`.
  - `conciliar`: candidatos 3 com o RPC devolvendo `alvos_ativos 0` → `alvosAtivos 0`, `candidatosEsperados 3`; o novo recebe `hora_base_min` da faixa menos cheia; o existente não é recalculado; `lerCandidatos` lança → `porque` e o RPC não é chamado.
  - Phil I6: `toda entrada de p_candidatos tem os 7 campos não nulos, inclusive a de alvo existente` (o `sb` falso captura o `p_candidatos`).
  - Phil I7: `alvo janela_propria com teste vivo e 4 indisponivel → não sai`; `alvo extensao com teste vivo → não sai` (em `lerDevidos`/`atualizacoesDosAlvos` com o `Set`).
- [ ] **Passos 2–4:** falhar, implementar e passar (`> $SAIDA/t9.txt`).
- [ ] **Passo 5: Ramo D2** (ler a resposta em `.superpowers/sdd/a5/decisoes-do-dono.md`; sem resposta, **este passo espera** e o resto do plano segue).
  - **D2 = sim:** `PROPRIOS_ANTIGOS = true`; `conciliar` faz a 4ª consulta `youtube_videos` (`youtube_video_id, site_id, published_at`, paginada); `hora_base_min = faixaMenosCheia(...) + 360 × (hash(id) mod 4)`; `DEMANDA_RODADAS_DIA = 177 × 4 + 35`. Testes novos: `antigo entra com 1/dia e proprio_antigo`; `antigo que ganha teste passa a 4/dia`; e o caso de capacidade da Tarefa 8, que continua ≥ 1,5×. **Phil I8:** `rodadas_por_dia = excluded.rodadas_por_dia` no SQL (não `greatest`: a catraca nunca desceria de 4 a 1), e B6 ganha "o teste acaba → volta a 1/dia".
  - **D2 = não:** `PROPRIOS_ANTIGOS = false` e nenhuma consulta nova. Teste: `com PROPRIOS_ANTIGOS false, youtube_videos não é lido além de lerCandidatos`.
- [ ] **Passo 6:** rodar `alvos.test.ts` e `gravar.test.ts` e ver passar. Commit: `feat: candidatos e conciliação da watch (lerCandidatos com janela)`.

### Tarefa 10: Migration e testes de integração

**Arquivos:**
- Criar via `npm run db:new observatorio_a5_s4_leitura_watch`: `supabase/migrations/<ts>_observatorio_a5_s4_leitura_watch.sql`, com o conteúdo do **Apêndice A.1** (mais o A.2 se D7 = sim).
- Testes: `apps/web/test/integration/a5-s4-watch-schema.test.ts` (B1, B3), `a5-s4-watch-rls.test.ts` (B2), `a5-s4-watch-poda-prova.test.ts` (B4, B5), `a5-s4-watch-conciliar.test.ts` (B6).

- [ ] **Passo 1: Fila (C5).** `git -C $W fetch origin staging && git -C $W log --oneline origin/staging -- supabase/migrations | head -5`. A Migration A do A/B tem de estar lá. Avisar a sessão do A/B ("a S4 vai criar a migration agora") e anotar em `.superpowers/sdd/a5/fila-do-db-push.md`. Confirmar D7. Sem a Migration A: perguntar ao A/B; sem resposta até 27/10, levar ao dono com a recomendação da Hanna.
- [ ] **Passo 2:** `cd $W && npm run db:new observatorio_a5_s4_leitura_watch` e colar o Apêndice A.1 (+ A.2). Antes de colar: se o P-V deu `K_medido < 16`, trocar `v_k` no `yt_watch_prova` (r2 Phil m2).
- [ ] **Passo 3: Aplicar no banco local** (só `bythiago_int`): `psql postgresql://postgres:postgres@127.0.0.1:54422/postgres -v ON_ERROR_STOP=1 -f supabase/migrations/<ts>_….sql > $SAIDA/t10-mig.txt 2>&1`, duas vezes (idempotência). A segunda só pode trazer NOTICE.
- [ ] **Passo 4: Testes de integração que falham antes do passo 3 e passam depois.** Cada caso cria o próprio site com `seedSite` e limpa no fim.
  - B1: cada linha de `casos-recusados.ts` inserida direto → `23514`; as 300 leituras do gerador de A11 por `paraLinhas` → `yt_watch_gravar_disparo` → nenhum erro; **16 leituras com 1 inválida injetada sem passar por `linhaCabeNoBanco`** → o RPC único falha com classe 23, o degrau (`gravarComDegrau` da Tarefa 12, importado) grava as 15 e o vídeo da inválida recebe `proxima_rodada_em + 20 min`; um lote de 10 com 1 `fora_do_formato` grava as 10.
  - B3: o RPC com uma leitura de `rodada_id` inválido no fim → nenhuma linha gravada e o alvo intacto (atomicidade); a mesma miniatura 2 vezes → 1 linha com `vistas 2`.
  - B2: `anon` sem `select` nas 3 tabelas; editor de outro site lê 0 linhas; **não superusuário com `set app.site_id = '<site do teste>'`** lê 0 (o GUC forjado não abre nada).
  - B4: alvo saído há 31 d perde leituras e miniaturas; há 29 d, não; `reter_ate` no futuro protege; alvo saído há 31 d com `reter_ate` da extensão não perde leituras; lote 2 com 3 leituras → `sobrou true`.
  - B5 (acréscimos): (Phil I10) 200 alvos ativos a 4/dia → `capacidade_razao 1,44` e o motivo `capacidade_curta` acende; `demanda_rodadas_dia` soma `rodadas_por_dia` dos ativos; (Phil M8) `concorrentes_30d` vai ao detalhe, sem motivo.
  - B5: os 4 motivos acendem com dado sintético (coleta ligada, execuções em `competitor_agenda_runs` com task `leitura_watch` há 30 h, de hora em hora); `p_coleta_ligada false` → os 4 `null`; tabela vazia + execuções há 30 h + alvos atrasados → `rodadas_faltando true`; candidatos > 0, zero alvos e uma execução há 1 h → `sem_alvos true`; zero execuções → todos `null`; buraco de 10 h nas execuções (religada há 2 h) → `null`.
  - B6 (acréscimos da r1): (Phil I6) 2ª conciliação com o payload **montado por `montarCandidatos` + `conciliar`**, não à mão, contra um alvo já existente → sem erro, `atualizados 1`; (Phil M5) duplicata `teste_nosso` + `janela_propria` no mesmo `p_candidatos` → vence o `coleta_ate` máximo; (Phil M6) alvo reativado ganha `ativo_desde` novo e não acende `rodadas_faltando` na prova seguinte; (Phil N1, r2) alvo 1/dia com 1 leitura em 24 h que vira 4/dia → `ativo_desde = p_agora` e a prova seguinte não acende `rodadas_faltando` (`menos_de_3_rodadas_24h` não sobe por causa dele); (D2 = sim) `antigo com teste → 4/dia; teste acaba → 1/dia`.
  - B6: `ab_tests` + `youtube_videos` semeados → o alvo nasce com o id de 11 caracteres; `draft` com 6 leituras `indisponivel` continua ativo; alvo saído há 10 d com teste novo → ativo e devido; `draft` com mais de 30 d fica fora; `indisponivel` dentro dos 30 d, com 3 conciliações seguidas → continua saído, com `rodadas` e `indisponivel_seguidas` iguais; com teste → reativa; `removido` cujo vídeo voltou a `competitor_videos` → reativa.
- [ ] **Passo 5:** rodar os 4 arquivos em série (`--no-file-parallelism`), saída em `$SAIDA/t10-int.txt`. Esperado: tudo verde.
- [ ] **Passo 6:** C6 local: `select count(*) from pg_constraint where conrelid = 'public.yt_watch_readings'::regclass and contype = 'c'` → **17** (18 com D7). Commit: `feat: migration da S4 (yt_watch_*) e testes de integração`. O `db:push:prod` **não** é feito aqui: vai no envio, depois do portão.

### Tarefa 11: Ramo D7 (só se o dono disser sim)

**Arquivos:** `parser.ts`, `leitor.ts`, `expansor.ts` e os 3 testes deles; a migration recebe o diff do Apêndice A.2 na Tarefa 10.
- [ ] **Passo 1: Testes que falham:** `viewCount da fixture A é inteiro > 0`; `viewCount ausente → null`; `viewCount '12,345' (forma inesperada) → null`; `ResultadoLeitor.viewCount` presente; `paraLinhas grava view_count`; o espelho recusa `view_count -1`.
- [ ] **Passo 2:** `ExtracaoWatch.viewCount: number | null` (de `videoDetails.viewCount`, só dígitos, `Number.isSafeInteger`), `ResultadoLeitor.viewCount`, `LinhaLeitura.view_count`. **Fora do contrato `LeituraWatch`.**
- [ ] **Passo 3:** passar. Commit: `feat: view_count da watch (D7)`.

### Tarefa 12: Disparo e tarefa `leitura_watch`

**Arquivos:**
- Criar: `apps/web/src/lib/youtube/watch/disparo.ts` (passadas, disjuntor, estado), `watch/gravar.ts` (gravação + degrau), `watch/extensao.ts` (paginação + detecção).
- Criar: `apps/web/src/lib/youtube/agenda/tarefas/leitura-watch.ts`
- Modificar: `agenda/definicoes.ts` (`DEFINICAO_LEITURA_WATCH` e a entrada em `TODAS_AS_DEFINICOES`), `agenda/catalogo.ts` (import + entrada), `docs/ops/env-vars.md` (`OBS_WATCH_READ`).
- Testes: `test/youtube/watch/{disparo,gravar,extensao}.test.ts`, `test/youtube/agenda/leitura-watch-tarefa.test.ts`, `test/youtube/agenda/catalogo.test.ts` (acrescentar).

**Interfaces:**
- `disparo.ts`:
  ```ts
  export type MotivoWatch = 'bloqueado' | 'leitura_bloqueada' | 'layout_mudou' | 'gravacao_falhou' | 'sem_alvos' | 'sobrou' | 'extensao_falhou' | 'lista_falhou' | 'schema_ausente'
  export interface Passadas { resultados: Map<number /*alvo.id*/, ResultadoLeitor[]>; disjuntor: boolean; tentativas: number }
  export async function lerPassadas(alvos: AlvoAtivo[], ler: (ytId: string, o: OpcoesLeitor) => Promise<ResultadoLeitor>, o: { origemRede: OpcoesLeitor['origemRede']; agora: () => number; ateMs: number; novoUuid: () => string }): Promise<Passadas>
  export function estadoDoDisparo(p: Passadas, extra: { sobraram: number; extensaoFalhou: number; gravou: boolean; candidatosEsperados: number; alvosAtivos: number }): ResultadoTarefa
  export function atualizacoesDosAlvos(alvos: AlvoAtivo[], p: Passadas, agoraMs: number, rng: () => number): AtualizacaoAlvo[]
  ```
  Em `lerPassadas`, uma passada lê todos os alvos (pool de 3) e há 3 passadas. O `rodadaId` é um por alvo por disparo. `sondarMiniatura` vai `true` na passada 1 e, nas passadas 2 e 3, só se nenhuma leitura anterior do alvo teve `erro null`. O disjuntor é a 3ª resposta com código em `CODIGOS_BLOQUEIO`: nenhuma leitura nova começa depois dela. Uma passada nova não começa depois de `ateMs`.
  Em `atualizacoesDosAlvos`: alvo com 3 leituras → `proxima_rodada_em = proximaRodada(...)`, `ultima_rodada_em`, `rodadas_mais 1`. Com 1 ou 2 (rodada partida) → só grava as leituras e o alvo fica devido. `indisponivel_seguidas`: +1 se as 3 deram `indisponivel`; volta a 0 se alguma leu título. Com 4 e sem teste nosso → `saiu_em` e `saiu_por 'indisponivel'`. **Com teste nosso nunca sai.** `AtualizacaoAlvo` = o objeto de `p.alvos` do Apêndice A.1 (§4b).
  `estadoDoDisparo`: a tabela do §6.3 do spec, na ordem `bloqueado` > `gravacao_falhou` > `leitura_bloqueada` > `layout_mudou` > `sem_alvos` > `extensao_falhou` > `sobrou` > ok. `leitura_bloqueada`: ≥ 6 tentativas de ≥ 3 vídeos e mais de 50 % de erro, **sem contar `indisponivel`** no numerador nem no denominador. `layout_mudou`: ≥ 6 sem erro e mais de 50 % delas sem título. `feitas` = leituras sem erro e com título. `deixadas` = `sobraram`. `detalhe` = `{ lidas, com_erro, sem_titulo, jogador_bloqueado, fora_do_formato, devidos, sobraram, alvos_ativos, candidatos_esperados, inicio_ms }`. `inicio_ms` é o `decorrido` no começo: é a medida do p90 do início da leve em produção.
- `gravar.ts`: `export async function gravarComDegrau(sb, payload: PayloadDisparo, o: { agora: () => number; ateMs: number }): Promise<{ ok: boolean; foraDoFormato: number; degrau: boolean }>`. Chamada única; com SQLSTATE `23…` e tempo restante, regrava vídeo a vídeo; quem falhar de novo recebe `+20 min` numa chamada só de `alvos`. Com outra classe ou timeout, não regrava. `PayloadDisparo = { thumbs: LinhaThumb[]; leituras: LinhaLeitura[]; alvos: AtualizacaoAlvo[] }`.
- `extensao.ts`: `export async function avaliarExtensoes(sb, alvos: AlvoAtivo[], novas: Map<number, ResultadoLeitor[]>, agoraMs: number, ateMs: number): Promise<{ atualizacoes: Map<number, Partial<AtualizacaoAlvo>>; avaliados: Set<number>; falharam: number }>`. Elegíveis: alvos lidos agora com `coleta_ate − agora < 48 h` ou já estendidos; no máximo 4, em paralelo. Para cada um, lê as colunas do expansor com `lida_em >= coleta_ate − 30 d`, `.range` de 1.000 em 1.000 e `count: 'exact'`, até esgotar. Soma ≠ `count` → não avalia. Junta as leituras novas (ainda não gravadas), expande com `leiturasDoBanco`, chama `detectarTesteYoutube` em `try/catch` por vídeo e aplica `estenderColeta`. **A saída por janela só acontece para quem está em `avaliados`.**
- `leitura-watch.ts`: `rodar` faz guarda `schemaTablesReady` (MG-S4) → `decorrido > 70 s` devolve `parcial sobrou`, sem nada → `conciliar` → `lerDevidos(…, kAgora(decorrido, 16))` (com `temTesteNosso` do `Set` `testesVivos` devolvido por `conciliar`, não de `motivo_ate`; Phil I7) → `lerPassadas(ateMs = t0 + decorrido + 30 s, já descontados os 3 s fixos)` → `paraLinhas` → `avaliarExtensoes` → saída por janela → `gravarComDegrau` → `estadoDoDisparo`. Nenhuma ida ao banco começa depois de `t0 + 83 s`. `origemRede = 'vercel'` (constante `ORIGEM_REDE`; só existe se o P-V passar, ver o envio).
- `DEFINICAO_LEITURA_WATCH` (texto exato do §4 do spec): `nome 'leitura_watch'`, `rotulo 'leitura das páginas do YouTube'`, `ordem 5.9`, `peso 'leve'`, `periodo 'hora'`, `tetoTentativas 3`, `toleranciaVigiaH 2`, `naoTerminouVermelhoEm 6`, `comecaAteMs LEVE_COMECA_ATE_MS`, `fimAteMs 88_000`, `ligaCom 'OBS_WATCH_READ'`. `motivos`:
  `bloqueado: 'o YouTube bloqueou as leituras (consentimento, robô ou limite); o próximo disparo tenta de novo'`, `leitura_bloqueada: 'mais da metade das leituras da página do YouTube falhou'`, `layout_mudou: 'a página do YouTube mudou: os títulos não foram encontrados'`, `gravacao_falhou: 'não foi possível gravar as leituras da página do YouTube'`, `sem_alvos: 'há vídeos na janela, mas nenhum entrou na coleta'`, `sobrou: 'ficaram vídeos para o próximo disparo'`, `extensao_falhou: 'a avaliação de teste falhou em algum vídeo'`, `lista_falhou: 'não foi possível montar a lista de vídeos'`.

- [ ] **Passo 1: Testes que falham (A8, A10, A12):**
  - `disparo`: 3 `http_429` → o disjuntor para, `erro bloqueado`, e as leituras feitas aparecem no payload; o mesmo com 3 `consentimento`; 16 tentativas de `sem_initial_data` em ≥ 3 vídeos → `erro leitura_bloqueada`, `feitas 0`; 2 vídeos `indisponivel` → não é `leitura_bloqueada`; 12 sem renderers → `erro layout_mudou`; disjuntor na 2ª passada → alvos com 1 leitura sem `proxima_rodada_em` no payload; `alvos_ativos 0` com candidatos 3 → `parcial sem_alvos`; candidatos 0 e alvos 0 → `ok feitas 0`; com `agora` em 70 s, nenhum vídeo novo começa; a tarefa não passa de 30 s próprios (relógio falso).
  - `sonda`: na passada 1 o alvo leva `sondarMiniatura true`; se a 1ª deu 429, a 2ª leva `true`; se a 1ª leu, as passadas 2 e 3 levam `false`.
  - `indisponivel`: 4 rodadas `indisponivel` sem teste → sai; com `temTesteNosso` → não sai, mas o contador sobe; **alvo `janela_propria` ou `extensao` com teste vivo e 4 `indisponivel` → não sai** (Phil I7).
  - `gravar`: um cliente que lança timeout → 1 chamada, `gravacao_falhou`, sem degrau; erro `23514` → degrau vídeo a vídeo; falha de novo → chamada de `+20 min`; sem tempo (relógio em 84 s) → sem degrau.
  - `extensao`: um cliente que devolve 1.000 linhas com `count 1.300` → pagina e entrega 1.300; uma soma diferente do `count` → vídeo não avaliado; `coleta_ate` vencido sem avaliação → continua com `saiu_em` nulo; `detectarTesteYoutube` lança em 1 de 3 vídeos → os outros 2 são avaliados e `falharam 1`; `provavel_teste` → `reter_ate = ultimaVista + 180 d`.
  - A10 em `catalogo.test.ts`: `delete process.env.OBS_WATCH_READ` → `leitura_watch` em `desligadas` e `poda_leituras_watch` não; o mesmo com `'ON'` e `'1'`; com `'on'` ligada. E também: `TODAS_AS_DEFINICOES` igual ao `CATALOGO`; `fimAteMs ≤ LEVE_FIM_MS`; `HORARIA_FIM_MS + 30_000 + 5_000 < COMMENT_RULES.startsByMs`.
  - `leitura-watch-tarefa`: guarda ausente (`42P01`) → `parcial schema_ausente`; `conciliar` com `porque` → `erro lista_falhou` e nenhuma leitura.
- [ ] **Passos 2–4:** falhar, implementar e passar, com saída em `$SAIDA/t12.txt`.
- [ ] **Passo 5:** `docs/ops/env-vars.md`: linha `OBS_WATCH_READ`. Só `on` liga, o padrão é desligado, e desligar não para a poda. Commit: `feat: tarefa leitura_watch da agenda (S4)`.

### Tarefa 13: `poda_leituras_watch`, prova e aviso

**Arquivos:**
- Criar: `apps/web/src/lib/youtube/agenda/tarefas/poda-leituras-watch.ts`
- Modificar: `agenda/definicoes.ts` (`DEFINICAO_PODA_LEITURAS_WATCH` + `TODAS_AS_DEFINICOES`), `agenda/catalogo.ts`, `agenda/aviso.ts` (`ChaveAviso` ganha `'leitura_watch_vermelha'`, com um ramo em `textoDe`).
- Testes: `test/youtube/agenda/poda-leituras-watch.test.ts`, `test/youtube/agenda/aviso.test.ts` (acrescentar).

**Interfaces:**
- `DEFINICAO_PODA_LEITURAS_WATCH`: `nome 'poda_leituras_watch'`, `rotulo 'poda das leituras da página do YouTube'`, `ordem 5.3`, `peso 'leve'`, `periodo 'dia'`, `aPartirDaHoraSP 5`, `tetoTentativas 12`, `toleranciaVigiaH 36`, `naoTerminouVermelhoEm null`, `comecaAteMs LEVE_COMECA_ATE_MS`, `fimAteMs 85_000`, **sem `ligaCom`**. `motivos`: `banco_falhou: 'o banco falhou ao podar as leituras da página do YouTube'`, `prova_falhou: 'não foi possível conferir a saúde da leitura das páginas do YouTube'`, `sobrou: 'ficaram leituras vencidas para o dia seguinte'`.
- `rodar`: guarda (`42P01` → `parcial schema_ausente`) → até 3 × `rpc('yt_watch_poda', { p_agora, p_lote: 5000 })` enquanto `sobrou` e houver tempo → `conciliar`, só para ler (é preciso `candidatosEsperados` e `sites`: chamar `montarCandidatos` com as mesmas consultas, **sem** o RPC de conciliação; extrair `lerCandidatosDaWatch(sb, agora)` em `alvos.ts`, que as duas usam) → `rpc('yt_watch_prova', { p_agora, p_coleta_ligada: process.env.OBS_WATCH_READ === 'on', p_candidatos_esperados })`. **Se `lerCandidatosDaWatch` falhar, `p_candidatos_esperados = null` (nunca 0) e `detalhe.candidatos_falhou = 1`; a poda continua `ok`** (Phil I9: um 0 apagaria o `sem_alvos` no dia em que a lista está quebrada). O detalhe também grava `folga_capacidade = capacidade_razao` da prova (Yannis M5). Com algum motivo `true`, `avisarDono` com `chave 'leitura_watch_vermelha'` para cada site em `sites ∪ site_id de c.linhas`, e `frase` montada de `FRASE_PROVA` (abaixo). O motivo novo `capacidade_curta` (demanda medida > 768 rodadas/dia; Phil I10) entra nos motivos que acendem o aviso, com a coleta ligada. Devolve `ok` (ou `parcial sobrou`) com `detalhe` = os números da prova (`coleta_desde` e `primeira_leitura` viram horas) mais `prova_vermelha_<motivo>: 1`. O motivo vermelho **não muda o estado**.
- `FRASE_PROVA`: `leitura_bloqueada → 'mais da metade das leituras falhou nas últimas 24 horas'`, `layout_mudou → 'mais de 20% das leituras não acharam o título'`, `rodadas_faltando → '<n> vídeos sem as 3 rodadas do dia ou com rodada atrasada'`, `sem_alvos → 'há <n> vídeos na janela e só <m> na coleta'`, `capacidade_curta → 'a demanda é de <n> rodadas por dia, perto do limite de 1.152; tire os Shorts da coleta antes de perder rodadas'`, juntadas por `'; '`.
- `aviso.ts` `textoDe`: `case 'leitura_watch_vermelha': title 'A leitura das páginas do YouTube está com problema'`, `message frase + '. As leituras perdidas não são recuperadas. Confira a coleta no CMS, em ' + onde + '.'`.

- [ ] **Passo 1: Testes que falham:**
  - `prova vermelha com coleta ligada → aviso com leitura_watch_vermelha, poda ok e detalhe.prova_vermelha_rodadas_faltando = 1`.
  - `segunda execução do mesmo dia não repete o aviso` (a `dedup_key` diária de `avisarDono`, com o `sb` falso devolvendo a chave já existente).
  - `OBS_WATCH_READ apagada → p_coleta_ligada false e nenhum aviso` (com `delete process.env.OBS_WATCH_READ`).
  - `zero alvos e candidatos > 0 → aviso vai para o site dos candidatos`.
  - Phil I9: `leitura dos candidatos falha → o RPC da prova recebe null, nunca 0; poda ok; detalhe.candidatos_falhou = 1`.
  - Phil I10 / Yannis M5: `prova com capacidade_curta → aviso; detalhe.folga_capacidade presente`.
  - `RPC da prova lança → erro prova_falhou`; `poda devolve sobrou 3 vezes → parcial sobrou`; `42P01 → parcial schema_ausente`.
  - `aviso.test.ts`: `leitura_watch_vermelha tem título e mensagem próprios`; `frase com <tag> não é escapada duas vezes`.
- [ ] **Passos 2–4:** falhar, implementar e passar (`> $SAIDA/t13.txt`). Commit: `feat: poda e prova diária das leituras da watch, aviso leitura_watch_vermelha`.

### Tarefa 14: Remover a rota do P-V (no lote da S4)

**Arquivos:** apagar `apps/web/src/app/api/cron/watch-pv/` e `apps/web/test/api/cron/watch-pv.test.ts`; criar `apps/web/test/api/cron/watch-pv-removida.test.ts`.
- [ ] **Passo 1: Teste que falha:** `a rota do P-V não existe`: `existsSync('src/app/api/cron/watch-pv')` → `false`, e nenhum arquivo em `src/` contém `watch-pv`.
- [ ] **Passo 2:** `git -C $W rm -r apps/web/src/app/api/cron/watch-pv apps/web/test/api/cron/watch-pv.test.ts`.
- [ ] **Passo 3:** passar. Commit próprio: `chore: remove a rota temporária do P-V (S4)`. **Só depois que `pv-veredito.md` existir** (C4).

### Tarefa 15: Lembretes (C6–C12 a partir do deploy)

**Arquivo:** `.superpowers/sdd/a5/lembretes-a5.md`.
- [ ] **Passo 1:** trocar a linha "deploy S4 +0/+1/+7/~+31 d" por uma linha por check, com a data como fórmula. Há dois marcos: **M** = a hora do `db:push:prod` e **D0** = a hora em que `OBS_WATCH_READ=on` passa a valer em produção.

  | Quando (UTC) | Check | Onde está o como | Feito |
  |---|---|---|---|
  | M + 0 (logo após o push) | C6: RLS nas 3 tabelas e **17** CHECKs (18 com D7) | plano S4 §11 Q6 | |
  | D0 + 1 d, 12:00 | C7, C7+, C7++, C7+++ (D+1 da coleta) | spec §16; plano §11 Q7 | |
  | D0 + 1 d, 12:00 | C8: custo no Vercel (painel; dono) | spec §16 C8 | |
  | D0 + 1 d, depois das 08:00 | C11: a poda rodou | spec §16 C11 | |
  | D0 + 3 d, 12:00 | C7+++ de novo (reativação) | spec §16 | |
  | D0 + 7 d, 12:00 | C9 (volume) e C10 (rodadas ilegíveis por teste) | spec §16 | |
  | D0 + 1 d e D0 + 7 d, 12:00 | `select sum(rodadas_por_dia) from yt_watch_alvos where saiu_em is null;` ≤ 768 (razão ≥ 1,5); e `folga_capacidade ≥ 1,5` no detalhe da poda; abaixo disso, `INCLUIR_SHORTS = false` | Phil I10, Yannis M5 | |
  | D0 + 1 d e D0 + 3 d | C7+++ corrigida: 0 ativos com `indisponivel_seguidas ≥ 4` sem teste vivo e 0 com teste vivo e `saiu_em` não nulo, com o filtro `not exists (select 1 from ab_tests t join youtube_videos v on v.id = t.youtube_video_id where v.youtube_video_id = a.youtube_video_id and t.status not in ('completed','archived'))` no lugar de `motivo_ate <> 'teste_nosso'` | Phil I7 | |
  | Mensal | `folga_capacidade` e `concorrentes_30d` (a lista de candidatos não esvaziou) | Yannis M5, Phil M8 | |
  | `min(saiu_em) + 31 d` (~D0 + 31 d) | C12: primeira poda com linhas | spec §16 C12 | |
- [ ] **Passo 3 (Yannis, spec assinado):** uma linha no registro do spec (§20) para os desvios 1 (assinatura de `yt_watch_prova` com `p_candidatos_esperados`) e 8 (C7 com `(now(), true, null)`).
- [ ] **Passo 2:** no passo de envio que liga a coleta, trocar cada fórmula pela data e hora reais e recriar os lembretes da sessão (CronCreate) a partir da tabela. Sem commit no repositório (é ledger).

### Tarefa 16: Portão de Phil, Yannis e Gio

- [ ] **Passo 1:** a suíte inteira em background: `cd $W/apps/web && npx vitest run > $SAIDA/suite.txt 2>&1`, e os 4 arquivos de integração da Tarefa 10 (`> $SAIDA/int.txt`). No contexto entram só as falhas. Esperado: zero falhas novas em relação a `origin/staging`.
- [ ] **Passo 2:** `cd $W && npm run typecheck -w apps/web > $SAIDA/tc.txt 2>&1` (ou o equivalente do pre-push), sem erro.
- [ ] **Passo 3:** despachar os três em paralelo, cada um com o brief em `.superpowers/sdd/a5/tc/brief-portao-s4.md` (diff `origin/staging..HEAD` do worktree, spec, este plano e as saídas acima). Opus na 1ª rodada, effort `medium`, relatório de até 10 linhas e detalhe em `portao-s4-<nome>.md`:
  - **Phil (dados):** a migration contra o banco local (o Apêndice A rodado), o volume, os índices, a poda, a prova nos dois sentidos e com a tabela vazia, e as consultas do §11.
  - **Yannis (software):** o orçamento (70/83/88 s), o disjuntor, o degrau, a paginação, a concorrência do pool, o grafo de módulos, os erros e a remoção da rota.
  - **Gio (QA):** cada item de aceite A1–A13 e B1–B6 tem teste que o prova (e falha sem o código); o roteiro do P-V; o roteiro do D+1.
- [ ] **Passo 4:** os achados voltam como conserto (Sonnet, a partir do relatório). Há re-revisão só dos itens, até os três assinarem.

**Pronto quando:** existem `portao-s4-{phil,yannis,gio}.md`, cada um com "ASSINO".

---

## 10. Envio (depois do portão; não é tarefa de código)

1. **Migration:** `npm run db:push:prod` (confirmação YES), no dia útil até 29/10, na ordem da fila. Logo depois, C6 (Q6), registrado no ledger.
2. **Código:** `git -C $W pull --rebase origin staging`, depois `bash -c 'git -C /Users/figueiredo/Workspace/wt-s4 push origin HEAD:staging'`. Conferir a CI. A promoção para a main leva o que estiver no staging: a lista de `origin/main..origin/staging` vai ao ledger, e é preciso o ok escrito da sessão do A/B, como na Tarefa 1b (passo 5: opção (a) se o Integration estiver verde, senão (b), cherry-pick).
3. **Ligar a coleta:** depende do veredito do P-V.
   - **P-V passou:** o dono põe `OBS_WATCH_READ=on` no Vercel (Production), longe das 08:00 UTC. Isso marca o D0. Em seguida, Tarefa 15 passo 2.
   - **P-V não passou ou deu inconclusivo:** `OBS_WATCH_READ` fica desligada. As tabelas, o leitor, o expansor e a poda vão ao ar igual (a poda roda com `p_coleta_ligada = false`, sem aviso). A forja vira **emenda do spec** (§13), com o próprio plano. Nada é escrito na forja.

## 11. Consultas de conferência (rodadas)

- **Q1 (rodada 18/10, produção, só select):** o atraso de partida.
  `select percentile_disc(array[0.5,0.9,0.99]) within group (order by d), max(d), count(*) from (select extract(epoch from started_at - (date_trunc('hour', started_at) + (floor(extract(minute from started_at)/20)*20) * interval '1 minute')) d from competitor_agenda_runs where task = 'leitura_horaria' and started_at > now() - interval '7 days') x;` deu `{50.12, 51.01, 53.53}`, máx 59,56 e n = 117. Por tarefa (`group by task`): todas começam entre 49,6 e 54,9 s.
- **Q2 (rodada):** os 15 ids. `select v.youtube_video_id from youtube_videos v join lateral (select privacy_status from yt_own_video_meta_daily x where x.youtube_video_id = v.youtube_video_id and x.privacy_status is not null order by day_pt desc limit 1) m on true where m.privacy_status = 'public' and v.youtube_video_id <> 'qIg9a7vqcNo' and not exists (select 1 from ab_tests t where t.youtube_video_id = v.id and t.status not in ('completed','archived')) order by v.published_at desc nulls last limit 15;`
- **Q3 (rodada):** V, com a contagem de concorrentes com ≤ 30 d (filtrados por canal), sem Shorts, próprios com ≤ 14 d e próprios no total. Resultado: 176, 125, 0 e 35.
- **Q4 (rodada no banco local, `begin … rollback`, duas vezes):** o Apêndice A.1. Saída em `.superpowers/sdd/a5/tc/saida/s4-prova-saida.txt` (cópia do scratchpad). Resultados: RLS `true` nas 3; **17** CHECKs em `yt_watch_readings`; conciliar (3 inseridos, 1 `removido`, o `teste_nosso` venceu a duplicata); `indisponivel` não reativa por janela; `removido` + `janela_concorrente` reativa; a miniatura repetida (nulos) fez `vistas 2`; os 3 `23514` esperados; `es-419` aceito; prova desligada → motivos `null`; ligada sem execução → `null`; madura → `rodadas_faltando true`; religada há 2 h → `null`; zero alvos → `sem_alvos true`; poda com `reter_ate` → 0; lote 2 → `sobrou true`; o resto apagou leitura, miniatura e alvo. A variante D7 (A.2) também rodou: **18** CHECKs e `view_count` gravado.
- **Q6 (C6, depois do push):** `select relname, relrowsecurity from pg_class where relname in ('yt_watch_alvos','yt_watch_thumbs','yt_watch_readings');` → 3 linhas `true`; `select count(*) from pg_constraint where conrelid = 'public.yt_watch_readings'::regclass and contype = 'c';` → 17 (18 com D7).
- **Q7 (C7, D+1):** a consulta da C7 do spec, com `select public.yt_watch_prova(now(), true, null);`.

## 12. Onde está cada item de aceite

| Item | Tarefa |
|---|---|
| A1 | 3, 4 |
| A2 | 3, 4 |
| A3 | 6 |
| A4 | 5 |
| A5 | 8 (+9 no ramo D2) |
| A6 | 8 |
| A7 | 7 |
| A8 | 8, 12 |
| A9 | 9 |
| A10 | 12, 13 |
| A11 | 7 |
| A12 | 12 |
| A13 | 7 |
| B1, B3 | 10 (+12 no degrau) |
| B2 | 10 |
| B4, B5 | 10 (+13 no aviso) |
| B6 | 10 |
| P-V §12 | 1, 2 |
| C0 | 3 |
| C1–C4 | 2 (C1 e C4); C2 e C3 são de outras frentes, já no `lembretes-a5.md` |
| C5 | 10 passo 1 |
| C6–C12 | 15 + §10 |

## 13. Foco de revisão (o que nenhum teste acima pega com certeza)

1. **O IP de outro tipo de dado** no recorte (por exemplo um `clientIp` em outro campo de `ytcfg`): o teste de varredura só conhece 3 padrões. A Tarefa 3 acrescenta `/"clientIp"\s*:/` e um `grep` dos 4 octetos do IPv4 do dono feito pelo controlador.
2. **O relógio do Vercel com ~50 s de atraso antes de `t0`:** se um dia o atraso cair para dentro do handler (outra forma de invocação), o `decorrido` explode e a leve não começa. O `detalhe.inicio_ms` gravado em todo disparo mede isso. A Tarefa 12 testa que `inicio_ms` vai ao detalhe.
3. **A conciliação concorrente com a gravação** (dois disparos sobrepostos se o arrendamento vencer): o `update … where saiu_em is null` evita reabrir alvo saído. A Tarefa 10 (B3) acrescenta o caso "alvo saído entre a leitura e a gravação → `alvos 0` atualizados".
4. **Os títulos de renderer fora de `RENDERERS_TITULO`** (o YouTube cria um 4º): o parser só procura os 3, então o 4º some sem aviso. Aceito: `layout_mudou` pega a remoção, não a adição.
5. **`coleta_desde` com a agenda parada mais de 6 h:** o relógio de 24 h recomeça e a prova fica muda por um dia. O vigia de 2 h da `leitura_watch` cobre. Fica escrito em Riscos.

## 14. Riscos que ficam

| Risco | Efeito | O que há |
|---|---|---|
| O P-V falha ou não roda a tempo | A coleta não liga no Vercel | Forja por emenda; as tabelas e o leitor já ficam prontos |
| D1 ou o ok do A/B chegam depois de 20/10 09:00 | O P-V cai para 20/10 à tarde ou 21/10 cedo | Última hora útil 21/10 12:22 UTC; depois disso, inconclusivo |
| V cresce (mais canais) | 1.152 / 1,5 = 768 rodadas/dia, então V ≤ 192 a 4/dia (V ≤ 183 com os 35 antigos do D2); com ~10 extensões a razão de hoje é 1,54× (1,47× com D2) | **Gatilho medido:** `demanda_rodadas_dia > 768` na prova (motivo `capacidade_curta`, aviso `leitura_watch_vermelha`), ou atraso em 2 provas. Ação: `INCLUIR_SHORTS = false` primeiro (−51 alvos, −204 rodadas/dia); depois concorrência 4 (§6.2 do spec). C7 e C9 conferem `select sum(rodadas_por_dia) from yt_watch_alvos where saiu_em is null` |
| Próprio privado lido (dívida, Yannis M6) | 12 leituras perdidas por vídeo privado; um teste num vídeo privado seria lido para sempre | 1º próprio privado ou agendado em `yt_watch_alvos`: filtro com o `lateral` da Q2 |
| Religar em menos de 6 h perto das 08:00 UTC (Phil M7) | A prova pode sair sem o texto "religada há pouco" | Raro (a drenagem leva ~3,7 h); aceito |
| Rota do P-V em produção até o lote da S4 | 78 requisições ao YouTube por chamada, atrás do `CRON_SECRET` | `VALIDA_ATE` 21/10 13:00 UTC (410 depois); a T14 remove |
| Bloqueio de IP do Vercel depois do P-V | `erro` cresce | Disjuntor por disparo, `leitura_bloqueada`, desligar por variável |
| A prova muda depois de uma parada > 6 h | Um dia sem cor | Vigia de 2 h |
| A migration perde a janela de 29/10 | A S4 espera a próxima janela | C5 na Tarefa 10 |
| `lerCandidatos` é de outra etapa (horária) | Conflito de edição | Mudança de uma linha (o parâmetro), com teste A9 de que a horária pede 14 |

---

## Apêndice A.1: migration final (`npm run db:new observatorio_a5_s4_leitura_watch`)

Rodada no `bythiago_int` dentro de `begin … rollback`, aplicada duas vezes (§11, Q4). **A r1 mudou 5 trechos** (marcados `r1` nos comentários: `ativo_desde`, `rodadas_por_dia = excluded`, `max(coleta_ate)` na deduplicação, `demanda_rodadas_dia`/`capacidade_razao`/`concorrentes_30d`/motivo `capacidade_curta` na prova); **o passo 3 da T10 os reaplica no banco local duas vezes e o Q4 é refeito antes de qualquer `db:push:prod`**. O C6 não muda (as colunas novas não são CHECK). Convive com o código em `main`: nada em main lê estas tabelas.

```sql
-- A5 · S4 (T&C-coleta): leitura anônima da página watch.
-- Spec: docs/superpowers/specs/2026-10-18-a5-s4-tc-coleta-design.md §8.1. Plano: docs/superpowers/plans/2026-10-18-a5-s4-tc-coleta-plan.md (Apêndice A).
--   1. yt_watch_titulos_ok(jsonb): forma de titulos_divergentes (CHECK).
--   2. yt_watch_alvos, yt_watch_thumbs, yt_watch_readings.
--   3. RLS (can_view_private_site se existir; senão can_edit_site). Sem policy de escrita.
--   4. yt_watch_conciliar, yt_watch_gravar_disparo, yt_watch_poda, yt_watch_prova (service_role só).
-- Convive com o código em main: nada em main lê ou escreve estas tabelas. Idempotente.
set lock_timeout = '5s';

-- ── 1. Forma de titulos_divergentes ──
create or replace function public.yt_watch_titulos_ok(j jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select j is null or (
    jsonb_typeof(j) = 'array' and jsonb_array_length(j) <= 10
    and not exists (
      select 1 from jsonb_array_elements(j) e
      where jsonb_typeof(e) <> 'object'
         or coalesce(jsonb_typeof(e->'renderer'), '') <> 'string'
         or btrim(e->>'renderer') = ''
         or not (e ? 'texto')
         or coalesce(jsonb_typeof(e->'texto'), '') not in ('string', 'null')
         or (jsonb_typeof(e->'texto') = 'string' and btrim(e->>'texto') = '')
    )
  )
$$;

-- ── 2. Tabelas ──
create table if not exists public.yt_watch_alvos (
  id bigint generated always as identity primary key,
  site_id uuid not null references public.sites(id) on delete cascade,
  youtube_video_id text not null check (youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  tipo text not null check (tipo in ('concorrente','proprio')),
  motivo_ate text not null check (motivo_ate in ('janela_concorrente','janela_propria','proprio_antigo','teste_nosso','extensao','extensao_curta')),
  coleta_ate timestamptz not null,
  extensoes_curtas smallint not null default 0 check (extensoes_curtas between 0 and 2),
  rodadas_por_dia smallint not null default 4 check (rodadas_por_dia in (1, 4)),
  hora_base_min smallint not null check (hora_base_min between 0 and 1439),
  proxima_rodada_em timestamptz not null,
  ultima_rodada_em timestamptz,
  rodadas integer not null default 0,
  indisponivel_seguidas smallint not null default 0,
  saiu_em timestamptz,
  saiu_por text check (saiu_por in ('janela','indisponivel','removido')),
  reter_ate timestamptz,
  created_at timestamptz not null default now(),
  ativo_desde timestamptz not null default now(),  -- r1 Phil M6: refeito na reativação
  unique (site_id, youtube_video_id),
  check ((saiu_em is null) = (saiu_por is null))
);
create index if not exists yt_watch_alvos_devidos on public.yt_watch_alvos (proxima_rodada_em) where saiu_em is null;

create table if not exists public.yt_watch_thumbs (
  id bigint generated always as identity primary key,
  site_id uuid not null references public.sites(id) on delete cascade,
  youtube_video_id text not null check (youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  host text not null check (host ~ '^i[0-9]*\.ytimg\.com$'),
  variante text not null check (variante ~ '^[a-z0-9]{1,100}$'),
  http smallint check (http between 100 and 599),
  etag text check (etag is null or (etag <> '' and length(etag) <= 200)),
  sha16 text check (sha16 is null or sha16 ~ '^[0-9a-f]{16}$'),
  dhash text check (dhash is null or dhash ~ '^[0-9a-f]{16}$'),
  largura smallint check (largura between 1 and 4096),
  altura smallint check (altura between 1 and 4096),
  primeira_vista timestamptz not null,
  ultima_vista timestamptz not null,
  vistas integer not null default 1,
  check ((largura is null) = (altura is null)),
  check (dhash is null or (http = 200 and largura is not null)),
  check (ultima_vista >= primeira_vista),
  unique nulls not distinct (site_id, youtube_video_id, host, variante, http, etag, sha16, dhash, largura, altura)
);

create table if not exists public.yt_watch_readings (
  id bigint generated always as identity primary key,
  site_id uuid not null references public.sites(id) on delete cascade,
  youtube_video_id text not null check (youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  lida_em timestamptz not null,
  rodada_id uuid not null,
  origem_rede text not null check (origem_rede in ('vercel','forja','mac-casa')),
  versao_leitor smallint not null,
  http smallint check (http between 100 and 599),
  erro text check (erro is null or erro ~ '^[a-z0-9_]{1,40}$'),
  idioma text check (idioma is null or idioma ~ '^[a-z]{2,3}(-([A-Z]{2}|[0-9]{3}))?$'),
  titulo_oficial text check (titulo_oficial is null or (length(btrim(titulo_oficial)) > 0 and length(titulo_oficial) <= 500)),
  titulo_oficial_fonte text check (titulo_oficial_fonte in ('videoDetails','og_title')),
  titulo_exibido text check (titulo_exibido is null or (length(btrim(titulo_exibido)) > 0 and length(titulo_exibido) <= 500)),
  renderers_presentes smallint not null default 0 check (renderers_presentes between 0 and 7),
  titulos_divergentes jsonb check (public.yt_watch_titulos_ok(titulos_divergentes)),
  rendicoes_sqp smallint check (rendicoes_sqp between 0 and 200),
  jogador_bloqueado boolean not null default false,
  miniatura_id bigint references public.yt_watch_thumbs(id) on delete set null,
  check ((titulo_oficial is null) = (titulo_oficial_fonte is null)),
  check (not (titulo_exibido is not null and titulos_divergentes is not null)),
  check ((titulo_exibido is null) or renderers_presentes > 0),
  check (not jogador_bloqueado or erro is null),
  check (erro is null or (titulo_exibido is null and titulos_divergentes is null and titulo_oficial is null and renderers_presentes = 0)),
  check (erro is not null or (titulo_exibido is null and titulos_divergentes is null) or idioma is not null)
);
create index if not exists yt_watch_readings_video_tempo on public.yt_watch_readings (youtube_video_id, lida_em);
create index if not exists yt_watch_readings_miniatura on public.yt_watch_readings (miniatura_id) where miniatura_id is not null;

-- ── 3. RLS: leitura sensível por can_view_private_site (ou can_edit_site); escrita só por service role ──
alter table public.yt_watch_alvos enable row level security;
alter table public.yt_watch_thumbs enable row level security;
alter table public.yt_watch_readings enable row level security;
do $$
declare
  v_fn text := case when to_regprocedure('public.can_view_private_site(uuid)') is not null
                    then 'public.can_view_private_site(site_id)' else 'public.can_edit_site(site_id)' end;
  t text;
begin
  foreach t in array array['yt_watch_alvos', 'yt_watch_thumbs', 'yt_watch_readings'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('create policy %I on public.%I for select using (%s)', t || '_select', t, v_fn);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke insert, update, delete, truncate, references, trigger on public.%I from authenticated', t);
  end loop;
end $$;

-- ── 4a. Conciliação: candidatos (já deduplicados pelo código) → alvos; tabela de reativação do spec §7; saída por 'removido' ──
create or replace function public.yt_watch_conciliar(p_agora timestamptz, p_candidatos jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_ins integer := 0; v_upd integer := 0; v_rem integer := 0; v_ativos integer;
begin
  with c as (
    select distinct on (x.site_id, x.youtube_video_id) x.site_id, x.youtube_video_id, x.tipo, x.motivo_ate,
           max(x.coleta_ate) over (partition by x.site_id, x.youtube_video_id) as coleta_ate,  -- r1 Phil M5
           x.hora_base_min, x.rodadas_por_dia
      from jsonb_to_recordset(coalesce(p_candidatos, '[]'::jsonb)) as x(
        site_id uuid, youtube_video_id text, tipo text, motivo_ate text, coleta_ate timestamptz, hora_base_min smallint, rodadas_por_dia smallint)
     order by x.site_id, x.youtube_video_id, (x.motivo_ate = 'teste_nosso') desc, x.coleta_ate desc
  ), up as (
    insert into public.yt_watch_alvos as a
      (site_id, youtube_video_id, tipo, motivo_ate, coleta_ate, hora_base_min, rodadas_por_dia, proxima_rodada_em)
    select c.site_id, c.youtube_video_id, c.tipo, c.motivo_ate, c.coleta_ate, c.hora_base_min, c.rodadas_por_dia, p_agora from c
    on conflict (site_id, youtube_video_id) do update set
      coleta_ate = greatest(a.coleta_ate, excluded.coleta_ate),
      motivo_ate = case when excluded.coleta_ate > a.coleta_ate then excluded.motivo_ate else a.motivo_ate end,
      rodadas_por_dia = excluded.rodadas_por_dia,  -- r1 Phil I8: sem catraca (o código deduplica pelo máximo)
      proxima_rodada_em = case when a.saiu_em is null then a.proxima_rodada_em else p_agora end,
      ativo_desde = case when a.saiu_em is null and excluded.rodadas_por_dia <= a.rodadas_por_dia then a.ativo_desde else p_agora end,  -- r1 Phil M6; r2 Phil N1: reinicia também quando o ritmo sobe
      saiu_em = null,
      saiu_por = null
    where a.saiu_em is null
       or excluded.motivo_ate = 'teste_nosso'
       or (a.saiu_por = 'removido' and excluded.motivo_ate = 'janela_concorrente')
    returning (xmax = 0) as inserido
  )
  select count(*) filter (where inserido), count(*) filter (where not inserido) into v_ins, v_upd from up;

  update public.yt_watch_alvos a set saiu_em = p_agora, saiu_por = 'removido'
   where a.tipo = 'concorrente' and a.saiu_em is null
     and not exists (
       select 1 from public.competitor_videos cv
         join public.competitor_channels ch on ch.id = cv.competitor_channel_id
        where cv.video_id = a.youtube_video_id and ch.site_id = a.site_id);
  get diagnostics v_rem = row_count;

  select count(*) into v_ativos from public.yt_watch_alvos where saiu_em is null;
  return jsonb_build_object('inseridos', v_ins, 'atualizados', v_upd, 'removidos', v_rem, 'alvos_ativos', v_ativos);
end $$;
revoke all on function public.yt_watch_conciliar(timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.yt_watch_conciliar(timestamptz, jsonb) to service_role;

-- ── 4b. Gravação de um disparo (uma transação): miniaturas distintas, leituras, alvos ──
create or replace function public.yt_watch_gravar_disparo(p jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_mapa jsonb := '{}'::jsonb; r record; v_id bigint;
  v_t integer := 0; v_l integer := 0; v_a integer := 0;
begin
  for r in select * from jsonb_to_recordset(coalesce(p->'thumbs', '[]'::jsonb)) as x(
      k integer, site_id uuid, youtube_video_id text, host text, variante text, http smallint, etag text, sha16 text,
      dhash text, largura smallint, altura smallint, vista_em timestamptz)
  loop
    insert into public.yt_watch_thumbs as t
      (site_id, youtube_video_id, host, variante, http, etag, sha16, dhash, largura, altura, primeira_vista, ultima_vista)
    values (r.site_id, r.youtube_video_id, r.host, r.variante, r.http, r.etag, r.sha16, r.dhash, r.largura, r.altura, r.vista_em, r.vista_em)
    on conflict (site_id, youtube_video_id, host, variante, http, etag, sha16, dhash, largura, altura) do update
      set ultima_vista = greatest(t.ultima_vista, excluded.ultima_vista), vistas = t.vistas + 1
    returning id into v_id;
    v_mapa := v_mapa || jsonb_build_object(r.k::text, v_id);
    v_t := v_t + 1;
  end loop;

  insert into public.yt_watch_readings
    (site_id, youtube_video_id, lida_em, rodada_id, origem_rede, versao_leitor, http, erro, idioma, titulo_oficial,
     titulo_oficial_fonte, titulo_exibido, renderers_presentes, titulos_divergentes, rendicoes_sqp, jogador_bloqueado, miniatura_id)
  select x.site_id, x.youtube_video_id, x.lida_em, x.rodada_id, x.origem_rede, x.versao_leitor, x.http, x.erro, x.idioma, x.titulo_oficial,
         x.titulo_oficial_fonte, x.titulo_exibido, coalesce(x.renderers_presentes, 0), x.titulos_divergentes, x.rendicoes_sqp,
         coalesce(x.jogador_bloqueado, false),
         case when x.thumb_k is null then null else (v_mapa->>(x.thumb_k::text))::bigint end
    from jsonb_to_recordset(coalesce(p->'leituras', '[]'::jsonb)) as x(
      site_id uuid, youtube_video_id text, lida_em timestamptz, rodada_id uuid, origem_rede text, versao_leitor smallint, http smallint,
      erro text, idioma text, titulo_oficial text, titulo_oficial_fonte text, titulo_exibido text, renderers_presentes smallint,
      titulos_divergentes jsonb, rendicoes_sqp smallint, jogador_bloqueado boolean, thumb_k integer);
  get diagnostics v_l = row_count;

  update public.yt_watch_alvos a set
      proxima_rodada_em = coalesce(x.proxima_rodada_em, a.proxima_rodada_em),
      ultima_rodada_em = coalesce(x.ultima_rodada_em, a.ultima_rodada_em),
      rodadas = a.rodadas + coalesce(x.rodadas_mais, 0),
      indisponivel_seguidas = coalesce(x.indisponivel_seguidas, a.indisponivel_seguidas),
      saiu_em = coalesce(x.saiu_em, a.saiu_em),
      saiu_por = coalesce(x.saiu_por, a.saiu_por),
      motivo_ate = case when x.coleta_ate > a.coleta_ate then x.motivo_ate else a.motivo_ate end,
      coleta_ate = greatest(a.coleta_ate, x.coleta_ate),
      extensoes_curtas = greatest(a.extensoes_curtas, coalesce(x.extensoes_curtas, 0)),
      reter_ate = greatest(a.reter_ate, x.reter_ate)
    from jsonb_to_recordset(coalesce(p->'alvos', '[]'::jsonb)) as x(
      id bigint, proxima_rodada_em timestamptz, ultima_rodada_em timestamptz, rodadas_mais integer, indisponivel_seguidas smallint,
      saiu_em timestamptz, saiu_por text, coleta_ate timestamptz, motivo_ate text, extensoes_curtas smallint, reter_ate timestamptz)
   where a.id = x.id and a.saiu_em is null;
  get diagnostics v_a = row_count;

  return jsonb_build_object('thumbs', v_t, 'leituras', v_l, 'alvos', v_a);
end $$;
revoke all on function public.yt_watch_gravar_disparo(jsonb) from public, anon, authenticated;
grant execute on function public.yt_watch_gravar_disparo(jsonb) to service_role;

-- ── 4c. Poda: leituras primeiro, depois miniaturas órfãs, depois o alvo vazio (spec §10.1) ──
create or replace function public.yt_watch_poda(p_agora timestamptz, p_lote integer) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_l integer := 0; v_t integer := 0; v_a integer := 0;
begin
  if p_lote is null or p_lote < 1 or p_lote > 50000 then raise exception 'p_lote fora de 1..50000' using errcode = '22023'; end if;
  delete from public.yt_watch_readings r
   where r.id in (
     select r2.id from public.yt_watch_readings r2
       join public.yt_watch_alvos a on a.site_id = r2.site_id and a.youtube_video_id = r2.youtube_video_id
      where a.saiu_em < p_agora - interval '30 days' and (a.reter_ate is null or a.reter_ate < p_agora)
      limit p_lote);
  get diagnostics v_l = row_count;
  if v_l < p_lote then
    delete from public.yt_watch_thumbs t
     using public.yt_watch_alvos a
     where a.site_id = t.site_id and a.youtube_video_id = t.youtube_video_id
       and a.saiu_em < p_agora - interval '30 days' and (a.reter_ate is null or a.reter_ate < p_agora)
       and not exists (select 1 from public.yt_watch_readings r where r.miniatura_id = t.id);
    get diagnostics v_t = row_count;
    delete from public.yt_watch_alvos a
     where a.saiu_em < p_agora - interval '30 days' and (a.reter_ate is null or a.reter_ate < p_agora)
       and not exists (select 1 from public.yt_watch_readings r where r.site_id = a.site_id and r.youtube_video_id = a.youtube_video_id)
       and not exists (select 1 from public.yt_watch_thumbs t where t.site_id = a.site_id and t.youtube_video_id = a.youtube_video_id);
    get diagnostics v_a = row_count;
  end if;
  return jsonb_build_object('leituras', v_l, 'miniaturas', v_t, 'alvos', v_a, 'sobrou', v_l = p_lote);
end $$;
revoke all on function public.yt_watch_poda(timestamptz, integer) from public, anon, authenticated;
grant execute on function public.yt_watch_poda(timestamptz, integer) to service_role;

-- ── 4d. Prova diária (spec §10.2). Motivos de coleta: null = sem cor (coleta desligada ou era atual com < 24 h) ──
create or replace function public.yt_watch_prova(p_agora timestamptz, p_coleta_ligada boolean, p_candidatos_esperados integer)
returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare
  v_desde timestamptz; v_primeira timestamptz;
  v_ativos integer; v_atrasados integer; v_menos integer;
  v_l integer; v_ind integer; v_err integer; v_semt integer; v_jog integer; v_fora integer; v_idi integer; v_rod integer; v_longas integer;
  v_por_erro jsonb; v_madura boolean; v_den numeric;
  m_bloq boolean; m_layout boolean; m_rod boolean; m_alvos boolean; m_cap boolean;
  v_demanda integer; v_razao numeric; v_conc30 integer;
  -- r2 Phil m2: capacidade = disparos/dia x K; trocar K ANTES do db:new se o P-V medir K < 16
  v_disparos constant integer := 72; v_k constant integer := 16; v_capacidade constant integer := v_disparos * v_k;
  -- início da era contínua atual da leitura_watch: a última execução sem outra nas 6 h anteriores
  select max(started_at) into v_desde from (
    select started_at, lag(started_at) over (order by started_at) as ant
      from public.competitor_agenda_runs where task = 'leitura_watch' and started_at <= p_agora
  ) e where ant is null or started_at - ant > interval '6 hours';

  select count(*) filter (where saiu_em is null),
         count(*) filter (where saiu_em is null and proxima_rodada_em < p_agora - interval '2 hours')
    into v_ativos, v_atrasados from public.yt_watch_alvos;

  select count(*) into v_menos from public.yt_watch_alvos a
   where a.saiu_em is null and a.ativo_desde < p_agora - interval '24 hours'
     and (select count(distinct r.rodada_id) from public.yt_watch_readings r
           where r.site_id = a.site_id and r.youtube_video_id = a.youtube_video_id
             and r.lida_em > p_agora - case when a.rodadas_por_dia = 1 then interval '26 hours' else interval '24 hours' end
             and r.lida_em <= p_agora)
         < case when a.rodadas_por_dia = 1 then 1 else 3 end;

  select count(*), count(*) filter (where erro = 'indisponivel'),
         count(*) filter (where erro is not null and erro <> 'indisponivel'),
         count(*) filter (where erro is null and renderers_presentes = 0 and titulos_divergentes is null),
         count(*) filter (where jogador_bloqueado), count(*) filter (where erro = 'fora_do_formato'),
         count(*) filter (where erro is null and idioma is not null and idioma <> 'pt-BR'),
         count(distinct rodada_id)
    into v_l, v_ind, v_err, v_semt, v_jog, v_fora, v_idi, v_rod
    from public.yt_watch_readings where lida_em > p_agora - interval '24 hours' and lida_em <= p_agora;

  select count(*) into v_longas from (
    select rodada_id from public.yt_watch_readings where lida_em > p_agora - interval '24 hours' and lida_em <= p_agora
     group by rodada_id having max(lida_em) - min(lida_em) > interval '10 minutes') g;

  select coalesce(jsonb_object_agg(erro, n), '{}'::jsonb) into v_por_erro from (
    select erro, count(*) n from public.yt_watch_readings
     where lida_em > p_agora - interval '24 hours' and lida_em <= p_agora and erro is not null group by erro) g;

  select min(lida_em) into v_primeira from public.yt_watch_readings;

  -- r1 Phil I10: a capacidade (72 disparos x K=16 = 1.152 rodadas/dia) contra a demanda medida
  select coalesce(sum(rodadas_por_dia), 0) into v_demanda from public.yt_watch_alvos where saiu_em is null;
  v_razao := round(v_capacidade::numeric / nullif(v_demanda, 0), 2);
  -- r1 Phil M8: conferência de que a lista de candidatos não esvaziou em silêncio (sem motivo)
  select count(*) into v_conc30 from public.competitor_videos where published_at > p_agora - interval '30 days';

  v_madura := coalesce(p_coleta_ligada, false) and v_desde is not null and v_desde < p_agora - interval '24 hours';
  if v_madura then
    m_bloq := (v_l - v_ind) >= 30 and v_err::numeric / (v_l - v_ind) > 0.5;
    v_den := v_l - v_err - v_ind;
    m_layout := v_den > 0 and v_semt::numeric / v_den > 0.2;
    m_rod := v_menos > 0 or v_atrasados > 0;
  end if;
  if coalesce(p_coleta_ligada, false) and v_demanda is not null then m_cap := v_demanda * 1.5 > v_capacidade;  -- r2: mesma conta da razão sem arredondar (769 -> true com razão 1,50 na tela) end if;
  if coalesce(p_coleta_ligada, false) and p_candidatos_esperados is not null and v_desde is not null then
    if p_candidatos_esperados > 0 and v_ativos = 0 then m_alvos := true;
    elsif v_madura then m_alvos := p_candidatos_esperados > 0 and v_ativos < 0.5 * p_candidatos_esperados;
    end if;
  end if;

  return jsonb_build_object(
    'candidatos_esperados', p_candidatos_esperados, 'alvos_ativos', v_ativos, 'alvos_atrasados', v_atrasados,
    'menos_de_3_rodadas_24h', v_menos, 'leituras_24h', v_l, 'indisponiveis_24h', v_ind, 'com_erro_24h', v_err,
    'sem_titulo_24h', v_semt, 'jogador_bloqueado_24h', v_jog, 'fora_do_formato_24h', v_fora, 'idioma_diferente_24h', v_idi,
    'rodadas_24h', v_rod, 'rodadas_longas_24h', v_longas, 'por_erro', v_por_erro,
    'primeira_leitura', v_primeira, 'coleta_desde', v_desde,
    'demanda_rodadas_dia', v_demanda, 'capacidade_razao', v_razao, 'capacidade_rodadas_dia', v_capacidade, 'concorrentes_30d', v_conc30,
    'motivos', jsonb_build_object('leitura_bloqueada', m_bloq, 'layout_mudou', m_layout, 'rodadas_faltando', m_rod, 'sem_alvos', m_alvos, 'capacidade_curta', m_cap));
end $$;
revoke all on function public.yt_watch_prova(timestamptz, boolean, integer) from public, anon, authenticated;
grant execute on function public.yt_watch_prova(timestamptz, boolean, integer) to service_role;
```

## Apêndice A.2: diff do ramo D7 (só se o dono disser sim; rodado no local, 18 CHECKs)

```diff
@@ yt_watch_readings
   jogador_bloqueado boolean not null default false,
+  view_count bigint check (view_count is null or view_count >= 0),
@@ yt_watch_gravar_disparo: insert
-     titulo_oficial_fonte, titulo_exibido, renderers_presentes, titulos_divergentes, rendicoes_sqp, jogador_bloqueado, miniatura_id)
+     titulo_oficial_fonte, titulo_exibido, renderers_presentes, titulos_divergentes, rendicoes_sqp, jogador_bloqueado, view_count, miniatura_id)
-         coalesce(x.jogador_bloqueado, false),
+         coalesce(x.jogador_bloqueado, false), x.view_count,
-      titulos_divergentes jsonb, rendicoes_sqp smallint, jogador_bloqueado boolean, thumb_k integer);
+      titulos_divergentes jsonb, rendicoes_sqp smallint, jogador_bloqueado boolean, view_count bigint, thumb_k integer);
```

---

## Registro da r1 (achado → tarefa e passo)

Revisões: `.superpowers/sdd/a5/tc/revisao-plano-s4-phil-r1.md` (I1–I10, M1–M8) e `revisao-plano-s4-yannis-r1.md` (I1–I4, M1–M6). A T1 já estava feita (`e964ba7e9`); os achados dela que o código não cobria entram na **T1b**. Onde os prazos diferem, vale o mais estrito.

| Achado | Onde entrou |
|---|---|
| Phil I1 / Yannis I1 (prazo global da P-V, `curl -m`) | T1b passo 1 (prazo global 270 s, fase 2 só com decorrido ≤ 235 s [r2: era 200 s], `cortado` com 4 valores, testes com relógio); T2 (`curl -m 330`). Os 200/235/280 s da T1 ficam como estavam |
| Phil I2 (requisição igual à do leitor) | §3 (literais), T1b passo 1, T6 passo 1 (teste de igualdade) |
| Phil I3 / Yannis M2 (segredo provado) | T1b passo 1 (CRON_SECRET apagado; auth antes de `v`) e passo 6 (fumaça 400); T2 (`--fumaca`, `-H @arquivo`) |
| Phil I4 (Mac: 9 linhas, por rodada) | T2 (`pv-rodar.sh`, `pv-avaliar.mjs`, autoteste) |
| Phil I5 (execução incompleta) | T2 (denominadores fixos 30/48, `fase2 null` não passa) |
| Phil I6 (`NOT NULL` antes do `on conflict`) | T9 (regra de `montarCandidatos`, teste dos 7 campos), T10 (B6) |
| Phil I7 (`temTesteNosso` por `motivo_ate`) | T9 (`testesVivos`, `lerDevidos`), T12 (teste), T15 (C7+++), §3 |
| Phil I8 (catraca de `rodadas_por_dia`, `horaBase mod periodo`) | Apêndice A.1 (`excluded`), T8 (distância máxima), T9 passo 5 (D2), T10 (B6) |
| Phil I9 (falha vira 0) | T13 (regra de `rodar`, teste) |
| Phil I10 / Yannis M5 (capacidade sem sensor) | §4, §14, Apêndice A.1 (`demanda_rodadas_dia`, `capacidade_razao`, `capacidade_curta`), T10 (B5), T13 (aviso e `folga_capacidade`), T15 |
| Phil M1 (`nB`, 6 páginas) | T1b passo 1 |
| Phil M2 / Yannis M3 (validade da rota) | T1b passo 1 (21/10 13:00 UTC, o mais estrito), §14 |
| Phil M3 / Yannis I4 (custo por vídeo no Vercel) | T2 (`s_por_video`, `K_medido`, razão), §3 |
| Phil M4 (diff de migrations vazio) | T1b passo 5 |
| Phil M5 (`distinct on` com `coleta_ate` errado) | Apêndice A.1, T10 (B6) |
| Phil M6 (`ativo_desde`) | Apêndice A.1, T10 (B6) |
| Phil M7 (era de 6 h) | §14 |
| Phil M8 (lista vazia em silêncio) | Apêndice A.1 (`concorrentes_30d`), T10 (B5), T15 |
| Yannis I2a (executor testável) | T1 já fez (`executar.ts`); §7 e §8 atualizados |
| Yannis I2b (braço falso sem renderers) | T1 já fez (braço `'?'`); T1b só acrescenta `nB` |
| Yannis I3 (4 critérios sem desfecho; execução cortada) | T2 (desfechos `forja`/`invalida`, autoteste 13/13) |
| Yannis M1 (pausa entre leituras) | T1 já fez (1,5 s) |
| Yannis M4 (`oficial` estrito) | T1 já fez |
| Yannis M6 (privacidade como dívida) | §7, §14 |
| Linhas do spec §20 (desvios 1 e 8) | T15 passo 3 |
| Promoção da rota: opção (a) ou (b) | T1b passo 5, §10, D1 |

---

## Registro da r2 (achado → tarefa e passo)

Revisões: `.superpowers/sdd/a5/tc/revisao-plano-s4-phil-r2.md` e `revisao-plano-s4-yannis-r2.md`.

| Achado | Onde entrou |
|---|---|
| Phil N1 (`ativo_desde` não reiniciava quando o ritmo sobe) | Apêndice A.1 (`case ... excluded.rodadas_por_dia <= a.rodadas_por_dia`), T10 (B6: 1/dia → 4/dia não acende `rodadas_faltando`). Refazer Q4 e B6 no `bythiago_int` (duas vezes) |
| Phil m1 (razão 1,50 com `capacidade_curta`) | Apêndice A.1: `m_cap` na mesma conta sem arredondar; payload ganha `capacidade_rodadas_dia`; o CMS mostra a demanda junto da razão |
| Phil m2 (1152 e 768 fixos) | Apêndice A.1: `v_disparos`, `v_k`, `v_capacidade` constantes no topo; trocar antes do `db:new` se o P-V medir K < 16 (T10, passo 2) |
| Phil m3 ("V > 185") | §3 (Shorts) |
| Phil m4 (T6 recriava `cabecalhos.ts`) | T6: importa de `cabecalhos.ts` (`0dc5f2df7`) |
| Yannis I-r2-1 (fase 2 só com ≤ 200 s) | T1b passo 1: 235 s, teto 270 s, teste (v) com a fase 1 em ~210 s; T2: `curl -m 330` |
| Yannis M-r2-1 (1,2 s como critério) | T2: hipótese, veredito é razão ≥ 1,5 |
| Validade da rota | 21/10 13:00 UTC, 410 só depois da autenticação (T1b passo 1; 401 sem Bearer continua) |
