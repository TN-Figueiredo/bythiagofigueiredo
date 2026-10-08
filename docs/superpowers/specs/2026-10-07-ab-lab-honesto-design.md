# A/B Lab honesto: sem teste de descrição e sem números inventados

Data: 07/10/2026 · Estado: rascunho v5 · Base: `main` c20b6ff2, `staging` 6dd468ae. Specs irmãos:
`2026-10-07-coleta-canais-proprios-design.md` (coleta, chamado aqui de "spec de coleta") e `2026-10-07-observatorio-canal-video-ui-design.md` (telas do Observatório).

## Por que

O A/B Lab mostra views como "impressões", CTR fixo em zero, números fabricados e promessas que não
cumpre. O combo regrava a descrição do vídeo a cada rotação. Encerrar ou pausar só restaura a
thumbnail. Produção tem 2 testes, ambos combo, e nenhum jamais teve métrica; o canal ainda vai começar.

## Decisões do dono (07/10)

1. Teste só de Título, Thumbnail ou Título + thumbnail. Descrição sai por completo.
2. Confiança só aparece quando existe.
3. Migrations criadas com `npm run db:new`; quem aplica em produção é o dono.
4. Rótulos e mensagens novas em pt-BR.

## Visão geral

A remoção da descrição (seções 1 a 3) não depende do spec de coleta. A tela de views por variante (seção 4) lê
`yt_own_video_daily` e `yt_own_video_meta_daily`: sem o L2 em produção ela mostra "coleta diária ainda
não iniciada", e o item correspondente do aceite só se confere depois. "No ar", nesta seção, quer
dizer: commit em `main`, deploy pronto na Vercel.

## 1. Ordem de entrega (cada passo um commit)

0. **Migration 0**, aditiva (`npm run db:new ab_restore_status`): `add column if not exists`
   para `restore_status jsonb` em `ab_tests`, `end_reason text` em `ab_test_cycles` e
   `thumbnail_dhash text` em `ab_test_variants`, e `restore_seq int not null default 0` em `ab_tests`.
   Commit com `database.types.ts` regenerado (`npm run db:types`, que lê o banco local: antes,
   `npm run db:start && npm run db:reset`). O código do passo 1 só vai para `main` depois de o dono aplicá-la: selecionar
   coluna que não existe derruba a tela e os crons.
1. **Código, em cinco commits que se revertem um a um:**
   - **1a** — sai a descrição (seção 2). É o único de que a Migration A depende.
   - **1b** — `settleOnAir` e o vigia (seção 3). Começa pelo portão do dHash (3.4).
   - **1c** — avaliação automática com um só ramo (4.1).
   - **1d** — telas sem número inventado (4.2), ainda sem a leitura de views: onde ela entraria, o texto
     fixo "A coleta diária ainda não começou".
   - **1e** — views por variante (4.2). Só depois de a migration L2 do spec de coleta estar no
     repositório: antes disso as tabelas não existem em `database.types.ts` e o código não compila.
2. **Migration A** (`npm run db:new ab_tipo_sem_descricao`), com o passo 1a no ar: aborta com
   `RAISE EXCEPTION` se existir linha `test_type = 'description'`; descobre o nome do CHECK em
   `pg_constraint`, `drop constraint if exists`, recria com `thumbnail`, `title`, `combo`. Roda duas
   vezes sem erro. Reversível com outro ALTER.
3. **Migration B** (`npm run db:new ab_drop_descricao`), não antes de 7 dias com o `ab-rotate` sem
   erro e sem teste em andamento ou pausado: recria `create_playoff_test` (tirando também o bloco que copia `ab_test_tracked_links`) com a mesma assinatura (`p_parent_test_id, p_variant_ids,
   p_cooldown_hours`), mantendo `SECURITY DEFINER` e `search_path`, sem as colunas de descrição e
   copiando `thumbnail_dhash`; e apaga
   `original_description`, `description_text` e `ab_test_tracked_links`. Aborta se existir linha em
   `tracked_links` com `source_type = 'ab_test'` (hoje são 0), para o dono decidir o destino dela e dos
   cliques. Irreversível, e depois dela o rollback instantâneo
   da Vercel para um deploy anterior ao passo 1 quebra: antes, o dono roda `pg_dump -t ab_tests -t ab_test_variants
   -t ab_test_tracked_links` e guarda fora do repositório.

Antes do passo 2, o dono confere `select id, status, test_type from ab_tests`. Hoje há 2 testes, ambos
combo, sem texto de descrição em nenhuma variante: um `completed` com `completed_reason = 'manual_archive'` e um `draft` de 07/10, que passa a
ser "Título + thumbnail".

## 2. Remoção da descrição — o que toca

- Rotação: `lib/youtube/ab-apply.ts` (ramo de descrição, mapa de links, `appliedMetadata`),
  `lib/youtube/ab-metadata.ts` (`updateVideoMetadata` perde o parâmetro de descrição e nunca envia
  descrição diferente da que está no ar) e os chamadores em `ab-rotate-phases.ts`,
  `ab-evaluate-phases.ts` e `ab-lab/actions.ts` (retomar, forçar rotação, aplicar vencedor,
  `revertWinner`).
- Telas: `step-tipo.tsx`, `step-variantes.tsx` (campo e acordeão), `step-revisar.tsx`,
  `suggested-card.tsx`, `ab-constants.ts`, `ab-primitives.tsx`, `ab-lab-dashboard.tsx` (filtro e
  rótulo), `ab-create-wizard.tsx` e `lib/youtube/ab-wizard-reducer.ts`.
- Tipos e validação: `ab-schemas.ts`, `ab-types.ts`, `intelligence-types.ts`, `intelligence-schemas.ts`.
- Pipeline: `lib/pipeline/services/youtube.ts`, MCP (`tools.ts`, `prompts.ts`, `schema-utils.ts`,
  `services/ab-tests.ts`), `prompt-builders-ab.ts`, o resumo dos endpoints em `api-registry.ts` (sem
  mudar `endpoint_count`), `data/pipeline-docs/cowork-docs-youtube.md`, e a referência do Cowork
  re-semeada no banco (quem roda o seed é o dono; o agente prepara o comando). A resposta é 422 com "A descrição não
  participa mais do teste A/B" para `test_type: 'description'` e para `description_text` não nulo em
  qualquer variante; `description_text: null` é aceito e ignorado (Zod descartaria a chave em silêncio
  e o cliente antigo veria sucesso). `docs/cowork-pipeline-reference.md` também muda.
- O combo se chama "Título + thumbnail", sem selo "recomendado", com a frase "mede o conjunto; não
  separa título de thumbnail".
- Tipo desconhecido lido do banco ganha rótulo de reserva em `ab-primitives.tsx`, `suggested-card.tsx`,
  `step-revisar.tsx` e no serviço de variantes do pipeline.
- Testes, no mesmo commit do passo 1: `integration/ab-tests-title-desc.test.ts` vira
  `ab-tests-title.test.ts` sem os cenários de descrição; em todos os outros que o grep achar (hoje 39
  arquivos em `apps/web/test`, mais `helpers/ab-fixtures.ts`) as asserções de descrição são removidas,
  nunca puladas.
- `action_type` `description_test` sai do enum de `intelligence-schemas.ts` e de
  `cowork-docs-youtube.md`. Os snapshots de `test/mcp/__snapshots__` e `mcp-schema-parity.test.ts` são
  regenerados no mesmo commit. A mensagem 422 fica numa constante testada.
- Completude, depois do passo 1a. Primeiro grep, que só pode encontrar `database.types.ts`:
  `grep -rnE "description_text|original_description|originalDescription|descriptionText|description_set|links_resolved|ab_test_tracked_links|description_test" apps/web/src apps/web/data apps/web/test`
  Segundo grep, só nos arquivos do A/B, que só pode encontrar a constante da mensagem 422:
  `grep -rn "'description'" apps/web/src/lib/youtube/ab-*.ts "apps/web/src/app/cms/(authed)/youtube/ab-lab" apps/web/src/lib/pipeline/mcp apps/web/src/lib/pipeline/services/youtube.ts $(find apps/web/test -name 'ab-*')`

## 3. O que vai ao ar quando um teste sai do ar

### 3.1 Uma função só

`settleOnAir(testId, { destino, motivo, forcar? })`, em `lib/youtube/ab-settle.ts`. `destino` é
`'original'` ou o id de uma variante (escolher a variante original equivale a `'original'`). Devolve
`{ resultado: 'feito' | 'ja_encerrado' | 'precisa_confirmar' | 'em_andamento', campos }`.

| Caminho | Onde | Destino | Estado: de → para | `completed_reason` | `end_reason` do ciclo |
|---|---|---|---|---|---|
| Pausar | `actions.ts`, `pauseAbTest` | original | `active → paused` | — | `pausa` |
| Encerrar e voltar ao original | `endAbTest` sem `winnerId` | original | `active` ou `paused → completed` | `manual_archive` | `encerrado` |
| Encerrar deixando uma variante | `endAbTest` com `winnerId` | a variante | `active` ou `paused → completed` | `manual_winner` | `encerrado` |
| Cancelar a carência (só teste antigo com `grace_expires_at`) | `cancelGracePeriod` | original | `active → completed` | o de hoje | `encerrado` |
| Aplicar vencedor (só teste antigo com `winner_variant_id` e sem `winner_applied_at`) | `applyWinnerNow` | a variante | fica `completed` | não muda | — |
| Reverter vencedor | `revertWinner` | original | fica `completed`; exige `winner_applied_at` não nulo | não muda | — |
| Pausa automática por falha de API | `ab-rotate-phases.ts:243-272` | original | `active → paused` | — | `falha_api` |
| Duração máxima | `ab-evaluate-phases.ts`, ramo único (4.1) | original | `active → completed` | `inconclusive` | `duracao_maxima` |
| Drift | `ab-watchdog/route.ts:133-155` | original | `active → paused` | — | `drift` |

Hoje nenhum desses caminhos restaura o título; vários só restauram a thumbnail se a original estiver
no Blob; a pausa automática não fecha o ciclo; `revertWinner` regrava sem ler; e o drift **regrava a
original por cima da edição externa**. Retomar e forçar rotação põem uma variante no ar por
`applyVariantToYouTube`, gravam `end_reason = 'rotacao'` no ciclo que fecham, e ficam fora desta função.

### 3.2 Ordem

0. **Só em ação humana com destino variante e sem `forcar`:** lê e decide a seco, sem gravar nada. Se
   algum campo do teste cair nas linhas 3 ou 4 da tabela de 3.3, devolve `precisa_confirmar` com
   `{campo, valor_atual}` de cada um e termina; no combo basta um campo. A tela pergunta e reenvia com
   `forcar: true`, que transforma as linhas 3 e 4 em "escreve o destino". O cron nunca força.
1. Reivindica e muda o estado numa só instrução (`update … set status = <para>, restore_seq =
   restore_seq + 1 where id = … and status in (<de>) and restore_seq = <lido>`). Zero linhas:
   `ja_encerrado`. Fecha o ciclo aberto com o `end_reason` da tabela. Para "reverter vencedor", que não
   troca de estado, a reivindicação é só por `restore_seq`.
2. Lê o valor atual no YouTube, campo a campo.
3. Decide (3.3) e escreve.
4. Grava `restore_status` com `where restore_seq = <reivindicado>`. Deixar uma variante no ar grava
   também `winner_variant_id`, `winner_applied_at`, `applied_by = 'manual'` e `revert_expires_at` (7
   dias), em qualquer tipo de teste. Reverter limpa esses três últimos só se todo campo terminou `ok`.

Falha nos passos 2 ou 3 não desfaz o passo 1. Só se mexe no campo que o teste mexe: thumbnail em
teste de thumbnail, título em teste de título, os dois no combo. Os campos são independentes.

### 3.3 Decisão, por campo

| # | Valor atual no YouTube | Sem `forcar` | Com `forcar` |
|---|---|---|---|
| 1 | Já é o destino | `ok`, sem escrever | igual |
| 2 | É o de outra variante do teste, ou o original | escreve o destino | igual |
| 3 | Outro valor (edição feita por fora) | não toca: `pulado_drift` | escreve o destino |
| 4 | A leitura respondeu e não há com o que comparar (arquivo da variante sumiu do Blob, imagem ilegível) | `pulado_drift`, motivo `sem_base_de_comparacao` | escreve o destino |
| 5 | A leitura falhou (rede, 5xx, 401, 403, cota, Blob fora do ar) | `falhou`; entra na nova tentativa | igual |

- **Thumbnail recém-trocada.** O YouTube demora a servir a imagem nova. Se a última escrita do app no
  vídeo (`started_at` do ciclo mais recente) tem menos de 3 horas, a linha 1 não vale para thumbnail:
  escreve o destino mesmo assim.
- **Drift em combo.** A thumbnail editada por fora fica `pulado_drift`; o título, que estava na
  variante, volta ao original. Isso muda o comportamento de hoje: o vigia pausa e avisa, e não regrava
  mais a thumbnail. A detecção continua por URL, só de thumbnail (`ab-drift.ts`); drift de título não é
  detectado e fica fora deste spec.
- **Sem original.** Destino original com `original_title` nulo, ou sem arquivo da variante original
  em `blob.vercel-storage.com`: `pulado_sem_original` no campo.

### 3.4 Como compara

- **Título.** `videos.list`. Conjunto comparável: o `title_text` de cada variante não original mais
  `ab_tests.original_title` (a variante original tem `title_text` nulo). Comparação exata, sem espaços
  nas pontas. A escrita reenvia os campos graváveis do `snippet` lido (`title`, `description`,
  `categoryId`, `tags`, `defaultLanguage`, `defaultAudioLanguage`), trocando só o título.
- **Thumbnail.** Baixa a imagem atual com `probeThumb` (a `hqdefault`, 480×360), calcula o dHash e
  compara com o `thumbnail_dhash` de cada variante pela tolerância `DHASH_MAX_SAME`. A URL nunca é critério.
- **dHash da variante.** Do arquivo em `blob_url`, por `hqdefaultLike()` =
  `sharp(bytes).resize(480, 360, { fit: 'contain', background: '#000' })` (um 16:9 ganha as faixas que o
  YouTube põe; um 4:3 passa intacto; `sharp` já é dependência) e depois `dhashOf`. Calculado onde a
  variante nasce (`uploadVariant`, `pullPipelineThumbnails`, e a cópia da original em `createAbTest` e
  `batchStartTests`) e, se nulo na hora de comparar, ali mesmo.
- **Cópia da original.** Hoje a cópia guardada é a `hqdefault` (480×360 com faixas), e "voltar ao
  original" sobe essa imagem pequena. A criação do teste passa a copiar `maxresdefault.jpg` quando ela
  responde 200, e só então a `hqdefault`; teste cuja original é a pequena avisa no diálogo de encerrar:
  "O original foi guardado em baixa resolução."
- **Portão**, antes de qualquer outra tarefa do passo 1b, com imagens reais: (i) um arquivo 1280×720 e
  a `hqdefault` que o YouTube serviu para ele ficam dentro de `DHASH_MAX_SAME`; (ii) uma cópia 480×360
  e a `hqdefault` depois de restaurada, idem; (iii) mede-se quanto tempo a `hqdefault` leva para mudar
  depois de um `thumbnails.set` (confirma ou corrige as 3 horas de 3.3). Se (i) ou (ii) falhar, o passo
  para e a tolerância é decidida com o dono.
- **Erros do YouTube.** `setThumbnail` e a escrita de título passam a lançar
  `YouTubeApiError { status, reason }`, com `reason` de `error.errors[0].reason` (hoje a mensagem é só
  "failed: 403" e não dá para distinguir cota).

### 3.5 Resultado, nova tentativa e avisos

`ab_tests.restore_status` tem a forma
`{ title?: { estado, destino, motivo?, erro, em, attempts }, thumbnail?: {…} }`, com `estado` em `ok`,
`falhou`, `pulado_sem_original`, `pulado_drift`, `desistiu`, e `destino` igual a `'original'` ou ao id
da variante.

- **Todo escritor** de `restore_status` — a função, o vigia, `retryRestore`, `dismissRestore` —
  reivindica por `restore_seq` antes e grava com `where restore_seq = <reivindicado>`. Zero linhas:
  `em_andamento` ("Outra tentativa está em andamento. Tente de novo em instantes.").
- **Vigia.** Ganha uma fase nova, com `try` próprio, sobre testes de qualquer estado que não seja
  `active` e tenham campo em `falhou`:
  `.or('restore_status->title->>estado.eq.falhou,restore_status->thumbnail->>estado.eq.falhou')`.
  Uma tentativa por execução (ele roda às 10:00 e às 20:00 UTC); na terceira falha o campo vira
  `desistiu`. Erro de cota (`reason = 'quotaExceeded'`) é `falhou` e não conta para as três.
- **Retomar** o teste zera `restore_status` e incrementa `restore_seq`.
- **Ações humanas novas:** `retryRestore(testId)` ("Tentar agora": refaz 3.2 com o `destino` gravado
  e zera `attempts`) e `dismissRestore(testId, campo)` ("Já corrigi no YouTube: dispensar aviso": apaga
  o campo). Permissão: a de encerrar, quando o destino é o original; a de quem administra o site,
  quando o destino é uma variante. "Tentar agora" aparece em `falhou` e `desistiu`; dispensar, em
  `falhou`, `desistiu` e nos dois `pulado_*`.
- **Avisos**, entregues por `fanOutToSiteAdmins`: enquanto houver campo em `falhou`, chave
  `ab-restore:<testId>`, `claimAlert(…, '1 day')`, liberada quando não houver mais. Ao virar `desistiu`,
  um aviso próprio (`ab-restore-desistiu:<testId>`) dizendo o que ficou no ar. Sem destinatário
  (`getSiteOwners` vazio): `SEM_DESTINATARIO` na resposta do cron, que conta como falha dele.
- **Custo** por tentativa: 1 unidade de leitura mais 50 por campo escrito.

## 4. Correções de verdade

### 4.1 Avaliação automática

O `ab-evaluate` decide sobre "impressões" que são views renomeadas e cliques que são sempre zero. (O
`ab-backfill` segue gravando isso nos ciclos; não é lido por nenhuma tela depois deste spec e fica
como está.) Enquanto não houver métrica de
entrega real (seção 6), ele **não declara vencedor, não abre carência, não cria playoff e não aplica
nada**:
- `phaseEvaluateActiveTests` fica com um só ramo: `dias desde o início >= max_duration_days` →
  `settleOnAir(original, 'duracao_maxima')`, `completed_reason = 'inconclusive'`.
- A estatística, os gates, a carência, `phaseRetryFailedApplies` e `phaseDetectPlayoffEligibility`
  deixam de ser chamados pela rota. Os arquivos ficam. `phaseAutoStartPlayoffs` continua.
- `cancelGracePeriod` segue existindo só para teste que já tenha `grace_expires_at`.
- `AB_AUTO_APPLY_WINNER` deixa de ser lida: sai de `ab-apply.ts` e da lista de flags do `CLAUDE.md`.
- Testes (`test/ab-cron-evaluate.test.ts`, `test/api/cron/ab-evaluate.test.ts`,
  `test/youtube/ab-evaluate-phases.test.ts`, `ab-critical.test.ts`, `ab-gates.test.ts`): os das
  funções desligadas viram testes de função pura, sem a rota; os de rota passam a afirmar que nada é
  escrito no YouTube nem em `winner_variant_id`.
- Escolher o que fica no ar é decisão humana.

### 4.2 Telas

- O diálogo de encerrar pergunta "O que fica no vídeo?", com uma opção por variante (a original
  primeiro) e nenhuma marcada, e diz qual está no ar agora. Escolher a original é `endAbTest` sem
  `winnerId` (`manual_archive`; o teste aparece como "Encerrado sem vencedor"); escolher outra é
  `endAbTest` com `winnerId` (`manual_winner`). Horários do A/B aparecem em São Paulo.
- Saem os números fabricados: `active-detail.tsx` (comentários e compartilhamentos derivados de
  cliques, tempo assistido), a aproximação em `queries.ts`, e o que
  `grep -nE "\* 0\.[0-9]" ab-lab/_components` achar nos demais. `mock-views.ts` e o seu uso em
  `[testId]/page.tsx` saem da rota de produção.
- Somem os rótulos "Impressões" e "CTR" sobre views e zero, e todo número de confiança; os gates
  deixam de aparecer na tela.
- A tela mostra, por variante, views por dia nos **dias válidos**. Dia válido da variante: a linha de
  `yt_own_video_meta_daily` do dia tem `ab_test_id` do teste, `ab_variant_id` igual à variante e
  `seconds_on_air_analytics >= 77 760` (90% de 24 horas), e `views` não é nulo em
  `yt_own_video_daily`; junção por `(youtube_video_id, day_pt)`. Três contagens aparecem: dias válidos;
  "N dias descartados por troca atrasada" (há linha, mas a variante é nula ou ficou menos de 90%); e
  "N dias sem medição" (sem linha em `yt_own_video_meta_daily`, ou `views` nulo). Os 90% cobrem a rotação
  das 08:00 UTC, que no horário de verão do Pacífico cai 1 hora depois da virada do dia, com até 84
  minutos de atraso do cron. Teste que rodou antes de a coleta existir mostra só "sem medição".
- **Só há destaque quando todas as variantes têm 3 ou mais dias válidos**; a destacada é a de mais
  views por dia e o rótulo é "mais views/dia até agora", nunca "líder" nem "vencedor". Abaixo disso a
  tela mostra os números sem destaque e diz o que falta: "Ainda não dá para comparar: C tem 1 dia
  inteiro no ar; precisa de 3."
  A tela nunca mostra diferença percentual nem intervalo, e avisa: "Cada variante foi medida em dias
  diferentes; vídeo novo perde views sozinho, então a ordem da rotação pesa."
- Somem "será aplicado automaticamente" (tela e aviso) e o interruptor do wizard, sem condição.
- Pausa automática por falha de API fecha o ciclo e avisa (já é o passo 1 de 3.2).

O desenho dessas telas está no spec de telas, seção do A/B.

## 5. Aceite

1. O grep de completude da seção 2.
2. Teste: Zod e rota do pipeline recusam `description` com a mensagem em pt-BR.
3. Teste: `applyVariantToYouTube` nunca envia descrição, em nenhum tipo.
4. Portão do dHash com imagens reais (3.4), antes das demais tarefas.
5. Testes de `settleOnAir`: um por célula da tabela de 3.3, para título e para thumbnail; um por linha
   da tabela de 3.1 conferindo estado final, `completed_reason` e `end_reason`; mais: encerrar a partir
   de `paused`; `original_title` nulo e original fora do Blob → `pulado_sem_original`; dHash nulo é
   calculado na hora; thumbnail trocada há menos de 3 horas com leitura dizendo "já é o destino" →
   escreve.
6. Teste: deixar uma variante no ar num teste de título escreve o título e grava `winner_applied_at` e
   `revert_expires_at`; `revertWinner` com edição externa → `pulado_drift` e os dados de vencedor ficam.
7. Teste: destino variante com edição externa → `precisa_confirmar` e nada gravado; combo com só o
   título editado → `precisa_confirmar` listando só o título; com `forcar: true` → escreve os dois.
8. Teste: leitura que falha (timeout, 401) → `falhou`, um aviso por dia; terceira falha → `desistiu` e
   o aviso próprio; `quotaExceeded` não conta; `description_text` não nulo na API → 422.
9. Teste das corridas: o vigia lê `falhou`, o teste é retomado, o vigia não escreve; `retryRestore`
   junto com o vigia → uma escrita só; duas chamadas concorrentes de encerrar → uma execução.
10. Teste: `ab-evaluate` com métricas zeradas não cria vencedor, carência nem playoff; ao atingir a
    duração máxima encerra como `inconclusive` pela função única; a rota não lê `AB_AUTO_APPLY_WINNER`.
11. Teste: drift detectado pelo vigia → pausa, avisa e não escreve a thumbnail; em combo, o título
    volta ao original.
12. Teste (passo 1e): variantes com 2 dias válidos → nenhum destaque e a frase do que falta; dia com
    70 000 s no ar é "descartado"; dia sem linha de metadados é "sem medição".
13. Produção: depois da Migration A, o rascunho combo abre como "Título + thumbnail"; no dia seguinte
    o `ab-rotate` (05:00 em São Paulo) está sem falha em `/api/health`.

## 6. Depois: medição nova (spec próprio)

Usa `yt_own_video_reach_daily` cruzado com os segundos `_reporting` de `yt_own_video_meta_daily`. Só afirma que a
rotação das 08:00 UTC coincide com a virada do dia do relatório depois de medir `start_time` e
`end_time` de relatórios reais antes e depois de 01/11 (fim do horário de verão nos EUA).
