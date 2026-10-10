# A/B Lab honesto: sem teste de descrição e sem números inventados

Data: 07/10/2026 · Estado: rascunho v6 (09/10/2026) · Base: `staging` af0478e9, `main` 3fb71996 (conferir
com `git rev-parse` antes de começar). Specs irmãos: `2026-10-07-coleta-canais-proprios-design.md` (coleta,
chamado aqui de "spec de coleta") e `2026-10-07-observatorio-canal-video-ui-design.md` (telas do
Observatório, chamado aqui de "spec de telas"). Roteiro: `docs/superpowers/plans/2026-10-08-proximos-passos.md`.

Marcas usadas no texto: **[RECOMENDAÇÃO — decisão do dono]** é uma escolha de produto que o texto já
escreve do jeito recomendado, mas que só vale depois do "pode" do dono (todas estão na seção 8).
**[INFERÊNCIA]** é o que não foi conferido no código nem em produção.

## Emendas de 09/10/2026 (rodada de revisão)

Onde o texto e uma emenda discordam, vale a emenda. O corpo já foi reescrito de acordo com elas; esta
lista existe para o dono ver o que mudou do v5 para o v6 e por quê.

1. **O que é "original" para o título.** *Dizia:* "a variante original tem `title_text` nulo", e o
   conjunto comparável era o `title_text` das variantes não originais mais `original_title`. *Passa a
   valer:* destino `'original'` é `ab_tests.original_title` e o arquivo de `ab_tests.original_thumbnail_url`;
   o conjunto comparável inclui o `title_text` de toda variante, inclusive a original (3.1, 3.4, pergunta 1).
   *Evidência:* `lib/pipeline/video-ab-materialize.ts:28` e `video/[id]/edit/actions.ts:227` gravam
   `title_text` na variante original; `lib/youtube/ab-apply.ts:80` usa esse valor na rotação. Com a regra
   antiga o título no ar caía em "edição por fora" e nunca era restaurado, sem erro.
2. **Encerrar escolhendo a variante original.** *Dizia:* "escolher a variante original equivale a
   `'original'`" e, na tabela, `winnerId` dá `manual_winner`. *Passa a valer:* `endAbTest` com `winnerId`
   de variante `is_original` é tratado como sem `winnerId` (`manual_archive`, sem dados de vencedor).
   *Evidência:* o diálogo de hoje manda o id da original (`ab-end-test-dialog.tsx:51`).
3. **Fadiga e "vídeo em alta".** *Dizia:* nada. *Passa a valer:* a seção 4.3, que é a entrega P1.
   *Evidência:* roteiro, §5; `sync-analytics-metrics/route.ts:229-241` e `:358-431`;
   `lib/youtube/thumbnail-library.ts:117-143` (terceiro gravador, fora do roteiro).
4. **Colunas gravadas na reivindicação.** *Dizia:* só `status` e `restore_seq`. *Passa a valer:* a
   coluna "Também grava" da tabela de 3.1; o ciclo fecha com o mesmo instante. *Evidência:* a coleta
   calcula os segundos no ar com `paused_at` e `completed_at` (`lib/youtube/coleta/ab-seconds.ts:52-55`);
   `status_note` tranca o "retomar" (`ab-lab/actions.ts:808-810`).
5. **"Dia válido" e dia sem view.** *Dizia:* dia válido exige `views` não nulo em `yt_own_video_daily`;
   sem linha é "sem medição". *Passa a valer:* a regra de 4.2.2, com dia sem linha valendo 0 quando a
   coleta rodou (pergunta 2). *Evidência:* spec de coleta, seção 6 ("Dia da janela sem linha na resposta
   não é gravado"); plano do L2, linha 893. Num canal com cerca de 35 views em 90 dias, quase todo dia
   não tem linha, e "views por dia" excluiria os zeros.
6. **Telas saem da parte 1.** *Dizia:* passos 1d e 1e dentro do passo 1. *Passa a valer:* 1d e 1e vão
   para a etapa de telas do A/B do roteiro (etapa 9); a parte 1 fica com as quatro entregas da seção 1.
   *Evidência:* roteiro, topo ("Mockup aprovado antes de qualquer tela") e §6 ("Ainda não feito no
   mockup: … telas do A/B"); spec de telas, §12 item 3.
7. **`database.types.ts`.** *Dizia:* "regenerado (`npm run db:types`)". *Passa a valer:* gerar os tipos
   num arquivo temporário e inserir só os blocos novos; o diff só tem inserções. *Evidência:* ruling do
   L1a, repetido no plano do L2, linha 363 (o arquivo tem deriva alheia).
8. **Quatro entregas em vez de um passo.** *Dizia:* um passo 1 com cinco commits. *Passa a valer:* P1,
   P2, P3 (com a Migration B como mini-plano) e P4, cada uma com plano próprio (seção 1). *Evidência:*
   o L1b, um lote só, custou 2,9 milhões de tokens (roteiro, §3a); a parte 1 toca cerca de 20 arquivos
   de código e 30 de teste só na descrição, e 20 e 16 na fadiga.
9. **Caminhos de carência.** *Dizia:* "Aplicar vencedor … fica `completed`" e `cancelGracePeriod`
   mantido para teste antigo. *Passa a valer:* a Migration 0 aborta se existir teste em carência ou com
   vencedor sugerido não aplicado, e os dois caminhos são apagados (3.1, pergunta 6). *Evidência:*
   `applyWinnerNow` também atende teste `active` em carência, que vai a `completed` com `manual_apply`
   (`ab-lab/actions.ts:1385-1401`); a tabela antiga não tinha essa linha.
10. **A reivindicação não protegia a escrita no YouTube.** *Dizia:* todo escritor de `restore_status`
    reivindica por `restore_seq`. *Passa a valer:* retomar, forçar rotação e a rotação do cron também
    reivindicam, e todo escritor relê `restore_seq` antes de cada chamada de escrita (3.2). *Evidência:*
    a rotação lê os testes uma vez e não confere `status` depois (`ab-rotate-phases.ts:59-65`, `:162-165`,
    `:197-222`); retomar aplica antes de gravar (`ab-lab/actions.ts:841-860`, `:877-880`).
11. **Zero linhas na reivindicação.** *Dizia:* `ja_encerrado` na 3.2 e `em_andamento` na 3.5. *Passa a
    valer:* relê o teste; estado fora do esperado é `ja_encerrado`, senão `em_andamento` (3.2).
12. **Caminhos que não trocam de estado.** *Dizia:* só "reverter vencedor" reivindica só por
    `restore_seq`. *Passa a valer:* a regra vale para reverter, `retryRestore` e o vigia (3.2).
13. **O dado que não existe antes da leitura.** *Dizia:* a linha 5 da 3.3 só cobria leitura que falha.
    *Passa a valer:* linhas 6 e 7 da tabela de 3.3. *Evidência:* canal não identificado, token que não
    renova, vídeo fora de `youtube_videos` (`ab-lab/actions.ts:719-733`) e `videos.list` sem o vídeo
    (`ab-metadata.ts:25`) hoje devolvem erro sem mudar nada; na ordem nova o estado já mudou.
14. **`probeThumb` não distingue "falhou" de "ilegível".** *Passa a valer:* o mapeamento de 3.4.
    *Evidência:* `thumb-fingerprint.ts:65,68` devolve `dhash` nulo para erro HTTP e lança em erro de rede.
15. **Variantes parecidas entre si.** *Passa a valer:* se o destino e outra variante estão dentro da
    tolerância, a linha 1 não vale para thumbnail; o portão ganha o item (iv). [INFERÊNCIA] sobre a
    frequência; a regra é barata.
16. **A regra das 3 horas.** *Dizia:* "última escrita do app" é o `started_at` do ciclo mais recente.
    *Passa a valer:* é o mais recente entre o último ciclo, o `em` de qualquer campo de `restore_status`
    e `winner_applied_at`; com `last_applied_variant_id` não nulo a linha 1 não vale (3.3). *Evidência:*
    `settleOnAir` escreve sem abrir ciclo; a rotação pode escrever a thumbnail, falhar no título e não
    abrir ciclo (`ab-rotate-phases.ts:162-165`, `:184`).
17. **`forcar` na nova tentativa.** *Dizia:* "o cron nunca força" e `retryRestore` refaz com o destino
    gravado. *Passa a valer:* `restore_status` guarda `forcado`, e as novas tentativas repetem (3.5,
    pergunta 3). Sem isso, a confirmação do dono se perde na primeira falha de rede.
18. **Original capturado na criação do rascunho.** *Dizia:* nada. *Passa a valer:* ao iniciar o teste,
    título e thumbnail são relidos (3.4, pergunta 4). *Evidência:* a captura está em `createAbTest`
    (`ab-lab/actions.ts:171-225`); `lib/youtube/ab-start.ts:51-172` não relê nada.
19. **Drift "continua por URL".** *Dizia:* a detecção continua por URL. *Passa a valer:* o vigia detecta
    pelo dHash (3.3, pergunta 5). *Evidência:* a própria 3.4 diz que "a URL nunca é critério"; o spec de
    coleta diz que a URL "não muda quando a imagem muda" (linhas 268-269); `ab-drift.ts:35-37` compara
    URLs. [INFERÊNCIA]: com isso o drift de hoje nunca dispara.
20. **Greps de completude.** *Dizia:* o primeiro "só pode encontrar `database.types.ts`", o segundo "só
    pode encontrar a constante 422". *Passa a valer:* a prova é o `tsc` mais os greps com exceções
    nomeadas (seção 2). *Evidência:* `coleta/meta-step.ts:443`, `ab-types.ts:525`, os testes do próprio
    aceite e quatro chaves sem aspas (`suggested-card.tsx:11`, `step-revisar.tsx:41`, `ab-constants.ts:15`,
    `ab-primitives.tsx:129`).
21. **O rascunho de 07/10.** *Dizia:* um `draft` que "passa a ser Título + thumbnail", e o aceite 13
    dependia dele. *Passa a valer:* o dono confere o estado; o aceite usa um rascunho criado para a
    conferência. *Evidência:* `ab-draft-cleanup/route.ts:8,27-34,46` arquiva rascunho parado há 24 horas.
    [INFERÊNCIA]: o de 07/10 já está `archived`.
22. **Números inventados, com endereço.** *Dizia:* "a aproximação em `queries.ts`" e um grep
    `\* 0\.[0-9]`. *Passa a valer:* a tabela de 4.2.1. *Evidência:* o grep acha 12 linhas, 10 de layout.
23. **Configurações sem efeito.** *Dizia:* some "o interruptor do wizard". *Passa a valer:* a lista de
    4.1. *Evidência:* `settings-drawer.tsx:213-216`, `step-config.tsx:77-82` e `:115`, `live-monitor.tsx:123`.
24. **Números inventados no pipeline.** *Dizia:* o que o `ab-backfill` grava "não é lido por nenhuma
    tela". *Passa a valer:* 4.1, último item (pergunta 7). *Evidência:* o Cowork lê
    (`lib/pipeline/services/youtube.ts:1037-1118`, `:1473-1480`, `:1714-1743`; `prompt-builders-ab.ts:194,256-267`).
25. **Quem roda o portão do dHash.** *Dizia:* "com imagens reais". *Passa a valer:* o agente escreve o
    script, o dono roda (3.4). Nenhum agente escreve no canal.
26. **Fases mortas do `ab-evaluate`.** *Dizia:* "os arquivos ficam". *Passa a valer:* as duas fases e
    seus testes são apagados em P2, antes de P3 (4.1). *Evidência:* elas citam descrição
    (`ab-evaluate-phases.ts:471`, `:529`, `:659`); mantê-las obrigaria P3 a editar código desligado.
27. **Medição nova (seção 6).** *Dizia:* só afirma o alinhamento do dia depois de medir. *Passa a
    valer:* o dia do relatório foi medido em 09/10 e é o dia do Pacífico com horário de verão; e o
    volume real não sustenta comparação de CTR entre variantes (seção 6).
28. **Correções menores.** "Nenhum caminho restaura o título" virou "só `revertWinner`" (3.1); os "39
    arquivos" saíram (seção 2); `mock-views.ts` já é só de desenvolvimento (4.2.1); um texto só para
    "coleta ainda não começou" (4.2.2); o `end_reason` da rotação do cron (3.1); os erros tipados na
    rotação (3.4); o `code` da resposta 422 (seção 2).

## Por que

O A/B Lab mostra views como "impressões", CTR fixo em zero, números fabricados e promessas que não
cumpre. O combo regrava a descrição do vídeo a cada rotação. Encerrar ou pausar só restaura a
thumbnail. O detector de fadiga e o aviso de "vídeo em alta" leem como diário um número que é o total
de 90 dias. Produção tem 2 testes, ambos combo, e nenhum jamais teve métrica; o canal tem cerca de 35
views em 90 dias.

## Decisões do dono (07/10)

1. Teste só de Título, Thumbnail ou Título + thumbnail. Descrição sai por completo.
2. Confiança só aparece quando existe.
3. Migrations criadas com `npm run db:new`; quem aplica em produção é o dono.
4. Rótulos e mensagens novas em pt-BR.

## Visão geral

A "parte 1" (etapa 4 do roteiro) são quatro entregas independentes: fadiga e vídeo em alta saem (P1), a
avaliação automática é desligada (P2), sai a descrição (P3) e a restauração passa por uma função só
(P4). Nenhuma delas depende do spec de coleta.

**Os antigos passos 1d ("telas sem número inventado", o acompanhamento novo) e 1e ("views por variante")
não fazem mais parte da parte 1.** Eles vão para a etapa de telas do A/B do roteiro (etapa 9), depois
do mockup aprovado e do L2 com dado. As regras deles continuam escritas aqui, em 4.2.2, para o plano
daquela etapa.

"No ar" quer dizer: commit em `main`, deploy pronto na Vercel. Toda promoção para `main` pede
autorização explícita do dono na hora (roteiro, §2).

## 1. Entregas (cada uma tem plano próprio e vai a produção sozinha)

Ordem: P1 → P2 → P3 → P4. O critério é parar primeiro o que mente ou escreve errado sem depender de
nada, e deixar por último a migration irreversível. P1 e P2 não têm migration e podem ir no mesmo dia.

### P1 — Fadiga e "vídeo em alta" saem (seção 4.3)

- **Entra:** tudo o que 4.3 lista: as duas fases do cron, o terceiro gravador, o cartão, o selo
  "FADIGA", o "+30%", as duas rotas do pipeline, os dois recursos MCP, a ação `get_fatigue_alerts`, os
  docs do Cowork e os 16 arquivos de teste.
- **Não entra:** a tabela "Candidatos a teste" (etapa 7); o detector de queda de CTR; apagar a tabela
  `youtube_fatigue_alerts`; a longevidade de thumbnail (pergunta 9).
- **Migrations:** nenhuma.
- **Do dono:** rodar o seed da referência do Cowork (o agente prepara o comando); decidir o destino das
  linhas já gravadas e dos 10 avisos já enviados (pergunta 8).
- **Aceite:** seção 5, itens P1.
- **Como se reverte:** `git revert` dos commits. Nada no banco muda; se o dono rodou o SQL da pergunta
  8, ele não é desfeito (e não precisa).

### P2 — Avaliação automática desligada (seção 4.1)

- **Entra:** o `ab-evaluate` com um só ramo (duração máxima), usando **a restauração que existe hoje**
  (`ab-evaluate-phases.ts:408-427`); as fases `phaseRetryFailedApplies` e `phaseDetectPlayoffEligibility`
  e seus testes, apagados; `AB_AUTO_APPLY_WINNER` sai; as configurações sem efeito somem; a remoção pura
  dos números fabricados de 4.2.1, se o dono der o "pode" (pergunta 10).
- **Não entra:** `settleOnAir` (P4 troca a chamada do ramo único); tela nova de qualquer tipo; a
  descrição.
- **Migrations:** nenhuma.
- **Do dono:** o "pode" da pergunta 10; a decisão da pergunta 7.
- **Aceite:** seção 5, itens P2.
- **Como se reverte:** `git revert`. Produção tem zero testes ativos, então o intervalo até P4 não
  expõe nada.

### P3 — Sai a descrição (seção 2), mais a Migration A

- **Entra:** o código da seção 2 (antigo passo 1a) e, com ele no ar, a **Migration A**
  (`npm run db:new ab_tipo_sem_descricao`): aborta com `RAISE EXCEPTION` se existir linha
  `test_type = 'description'`; descobre o nome do CHECK em `pg_constraint`, `drop constraint if exists`,
  recria com `thumbnail`, `title`, `combo`. Roda duas vezes sem erro.
- **Não entra:** apagar colunas (é a Migration B); `settleOnAir`.
- **Migrations:** A, reversível com outro ALTER.
- **Do dono:** antes da Migration A, conferir `select id, status, test_type from ab_tests` (hoje há 2
  testes, ambos combo, sem texto de descrição em nenhuma variante: um `completed` com
  `manual_archive` e um rascunho de 07/10 que provavelmente já foi arquivado, emenda 21); aplicar a
  migration; rodar o seed do Cowork.
- **Aceite:** seção 5, itens P3.
- **Como se reverte:** antes da Migration A, `git revert`. Depois dela, primeiro o ALTER inverso,
  depois o `git revert`.

**Migration B — mini-plano próprio, não antes de 7 dias com P3 no ar**, com o `ab-rotate` sem erro e sem
teste em andamento ou pausado (`npm run db:new ab_drop_descricao`): recria `create_playoff_test` com a
mesma assinatura (`p_parent_test_id, p_variant_ids, p_cooldown_hours`), mantendo `SECURITY DEFINER` e
`search_path`, sem as colunas de descrição, sem o bloco que copia `ab_test_tracked_links` e copiando
`thumbnail_dhash` se a Migration 0 já existir; apaga `original_description`, `description_text` e
`ab_test_tracked_links`. Aborta se existir linha em `tracked_links` com `source_type = 'ab_test'` (hoje
são 0), para o dono decidir o destino dela e dos cliques. No mesmo commit,
`test/integration/youtube-channel-remove.test.ts:95,175` deixa de usar `ab_test_tracked_links`.
**Do dono:** antes, `pg_dump -t ab_tests -t ab_test_variants -t ab_test_tracked_links`, guardado fora do
repositório. **Irreversível**, e depois dela o rollback instantâneo da Vercel para um deploy anterior a
P3 quebra.

### P4 — Restauração segura (seção 3)

- **Entra:** a Migration 0; o portão do dHash; `settleOnAir`; os chamadores da tabela de 3.1; a
  reivindicação em retomar, forçar rotação e rotação do cron; o vigia com nova tentativa e drift por
  dHash; os avisos; `retryRestore` e `dismissRestore`; o diálogo "O que fica no vídeo?" e a faixa de
  restauração (spec de telas, 9.2 a 9.4).
- **Não entra:** o acompanhamento novo e as views por variante (etapa 9 do roteiro).
- **Migrations:** **Migration 0**, aditiva (`npm run db:new ab_restore_status`):
  `add column if not exists` para `restore_status jsonb` e `restore_seq int not null default 0` em
  `ab_tests`, `end_reason text` em `ab_test_cycles` (com CHECK: nulo ou um de `pausa`, `encerrado`,
  `falha_api`, `duracao_maxima`, `drift`, `rotacao`) e `thumbnail_dhash text` em `ab_test_variants`.
  Aborta se existir teste com `grace_expires_at` não nulo, ou com `completed_reason = 'auto_resolve'`,
  `winner_variant_id` não nulo e `winner_applied_at` nulo (emenda 9; hoje são 0). Os tipos: gerar num
  arquivo temporário e inserir em `database.types.ts` só os blocos novos; o diff só tem inserções
  (emenda 7). O código de P4 só vai para `main` depois de o dono aplicá-la: selecionar coluna que não
  existe derruba a tela e os crons. Isso é escolha: a coleta tolera coluna ausente (emenda 7 do spec de
  coleta); aqui a migration é aditiva e vai antes.
- **Do dono:** aplicar a Migration 0; aprovar o mockup do diálogo e da faixa antes de o plano começar;
  rodar o portão do dHash num vídeo que ele escolher (3.4); responder as perguntas 1, 3, 4, 5 e 6.
- **Aceite:** seção 5, itens P4.
- **Como se reverte:** `git revert` dos commits de código. A Migration 0 fica (é aditiva); as colunas
  passam a ser ignoradas. Se P4 ficar grande, o corte interno é P4a (migration, portão, função,
  chamadores, aviso no sininho) e P4b (vigia com nova tentativa, as duas ações, diálogo e faixa).

## 2. Remoção da descrição — o que toca (P3)

- Rotação: `lib/youtube/ab-apply.ts` (ramo de descrição, mapa de links, `appliedMetadata`),
  `lib/youtube/ab-metadata.ts` (`updateVideoMetadata` perde o parâmetro de descrição e nunca envia
  descrição diferente da que está no ar) e os chamadores em `ab-rotate-phases.ts`,
  `ab-evaluate-phases.ts` e `ab-lab/actions.ts` (retomar, forçar rotação, `revertWinner`,
  `createTextVariant`, `updateTextVariant`).
- Telas: `step-tipo.tsx`, `step-variantes.tsx` (campo e acordeão), `step-revisar.tsx`,
  `suggested-card.tsx`, `ab-constants.ts`, `ab-primitives.tsx`, `ab-lab-dashboard.tsx` (filtro e
  rótulo), `ab-create-wizard.tsx`, `ab-lab/queries.ts` (`:195`, `:238`, `:557`, `:638`) e
  `lib/youtube/ab-wizard-reducer.ts`.
- Tipos e validação: `ab-schemas.ts`, `ab-types.ts`, `intelligence-types.ts`, `intelligence-schemas.ts`.
- Pipeline: `lib/pipeline/services/youtube.ts`, MCP (`tools.ts`, `prompts.ts`, `schema-utils.ts`,
  `services/ab-tests.ts`), `prompt-builders-ab.ts`, o resumo dos endpoints em `api-registry.ts` (sem
  mudar `endpoint_count`), `data/pipeline-docs/cowork-docs-youtube.md`, e a referência do Cowork
  re-semeada no banco (quem roda o seed é o dono; o agente prepara o comando). A resposta é **422**,
  `code: 'DESCRICAO_FORA_DO_TESTE'`, com "A descrição não participa mais do teste A/B", para
  `test_type: 'description'` e para `description_text` não nulo em qualquer variante;
  `description_text: null` é aceito e ignorado (Zod descartaria a chave em silêncio e o cliente antigo
  veria sucesso). Só este caso usa 422; as outras validações do serviço seguem em 400.
  `docs/cowork-pipeline-reference.md` também muda.
- O combo se chama "Título + thumbnail", sem selo "recomendado", com a frase "mede o conjunto; não
  separa título de thumbnail".
- Tipo desconhecido lido do banco ganha rótulo de reserva em `ab-primitives.tsx`, `suggested-card.tsx`,
  `step-revisar.tsx` e no serviço de variantes do pipeline.
- Testes, no mesmo commit: `integration/ab-tests-title-desc.test.ts` vira `ab-tests-title.test.ts` sem
  os cenários de descrição; em todos os outros que os greps abaixo acharem em `apps/web/test` (hoje 30
  pelo primeiro e 35 pela união dos dois) as asserções de descrição são removidas, nunca puladas.
- `action_type` `description_test` sai do enum de `intelligence-schemas.ts` e de
  `cowork-docs-youtube.md`. Os snapshots de `test/mcp/__snapshots__` e `mcp-schema-parity.test.ts` são
  regenerados no mesmo commit. A mensagem 422 fica numa constante testada.
- **Completude.** A prova tem três partes:
  1. `TestType` sem `'description'` e `npx tsc --noEmit` limpo. Os quatro `Record<TestType, …>` com
     chave sem aspas (`suggested-card.tsx:11`, `step-revisar.tsx:41`, `ab-constants.ts:15`,
     `ab-primitives.tsx:129`) quebram sozinhos; grep não os vê.
  2. `grep -rnE "description_text|original_description|originalDescription|descriptionText|description_set|links_resolved|ab_test_tracked_links|description_test" apps/web/src apps/web/data apps/web/test`
     só pode encontrar: `database.types.ts`; `lib/youtube/coleta/meta-step.ts` e
     `test/youtube/coleta/meta-step.test.ts` (`description_text` é coluna de `yt_own_video_meta_daily`);
     `test/integration/youtube-channel-remove.test.ts` (sai na Migration B); e os testes que provam a
     recusa 422.
  3. `grep -rn "'description'" apps/web/src/lib/youtube/ab-*.ts "apps/web/src/app/cms/(authed)/youtube/ab-lab" apps/web/src/lib/pipeline/mcp apps/web/src/lib/pipeline/services/youtube.ts $(find apps/web/test -name 'ab-*')`
     só pode encontrar: a constante da mensagem 422, `ab-types.ts:525` (`changeType` de
     `CompetitorChange`, que fica) e os testes da recusa.

## 3. O que vai ao ar quando um teste sai do ar (P4)

### 3.1 Uma função só

`settleOnAir(testId, { destino, motivo, forcar? })`, em `lib/youtube/ab-settle.ts`. `destino` é
`'original'` ou o id de uma variante não original. Devolve
`{ resultado: 'feito' | 'ja_encerrado' | 'precisa_confirmar' | 'em_andamento', campos }`.

**Destino `'original'`** é `ab_tests.original_title` e o arquivo de `ab_tests.original_thumbnail_url`,
ou seja, o que estava no YouTube antes do teste. **[RECOMENDAÇÃO — decisão do dono, pergunta 1]** Isso
vale mesmo quando a variante original tem `title_text` próprio (acontece em teste criado ao publicar um
vídeo). `endAbTest` com `winnerId` de variante `is_original` é tratado como sem `winnerId`.

| Caminho | Onde | Destino | Estado: de → para | `completed_reason` | `end_reason` do ciclo | Também grava na reivindicação |
|---|---|---|---|---|---|---|
| Pausar | `actions.ts`, `pauseAbTest` | original | `active → paused` | — | `pausa` | `paused_at`, `status_note = null` |
| Encerrar e voltar ao original | `endAbTest` sem `winnerId`, ou com o da variante original | original | `active` ou `paused → completed` | `manual_archive` | `encerrado` | `completed_at`, `winner_variant_id = null` |
| Encerrar deixando uma variante | `endAbTest` com `winnerId` | a variante | `active` ou `paused → completed` | `manual_winner` | `encerrado` | `completed_at`, `winner_variant_id` |
| Reverter vencedor | `revertWinner` | original | fica `completed`; exige `winner_applied_at` não nulo e `revert_expires_at` no futuro | não muda | — | nada |
| Pausa automática por falha de API | `ab-rotate-phases.ts:243-272` | original | `active → paused` | — | `falha_api` | `paused_at`, `status_note` com o motivo, `config.consecutive_failures` |
| Duração máxima | `ab-evaluate-phases.ts`, ramo único (4.1) | original | `active → completed` | `inconclusive` | `duracao_maxima` | `completed_at`, `confidence_at_completion = null` |
| Drift | `ab-watchdog/route.ts:133-155` | original | `active → paused` | — | `drift` | `paused_at`, `status_note = DRIFT_STATUS_NOTE`, `drift_acknowledged_at = null` |

Toda reivindicação grava também `updated_at` e zera `last_applied_variant_id`. O ciclo aberto é fechado
com `ended_at` igual ao `paused_at` ou `completed_at` gravado: a coleta calcula os segundos no ar com
essas colunas (`coleta/ab-seconds.ts:52-55`).

`cancelGracePeriod` e `applyWinnerNow` são apagados. **[RECOMENDAÇÃO — decisão do dono, pergunta 6]** Os
dois só servem a teste em carência ou com vencedor sugerido pela avaliação automática, que P2 desliga;
produção tem zero; a Migration 0 aborta se aparecer algum.

Hoje só `revertWinner` restaura o título, e sem comparar com o que está no ar; vários caminhos só
restauram a thumbnail se a original estiver no Blob; a pausa automática não fecha o ciclo. Retomar,
forçar rotação e a rotação do cron põem uma variante no ar por `applyVariantToYouTube`, gravam
`end_reason = 'rotacao'` no ciclo que fecham, e ficam fora desta função, mas reivindicam (3.2).
`autoImportWinner` continua sendo chamado depois de "encerrar deixando uma variante", só quando todo
campo terminou `ok`.

### 3.2 Ordem

0. **Só em ação humana com destino variante e sem `forcar`:** lê e decide a seco, sem gravar nada. Se
   algum campo do teste cair nas linhas 3 ou 4 da tabela de 3.3, devolve `precisa_confirmar` com
   `{campo, valor_atual}` de cada um e termina; no combo basta um campo. A tela pergunta e reenvia com
   `forcar: true`, que transforma as linhas 3 e 4 em "escreve o destino".
1. **Reivindica** e muda o estado numa só instrução (`update … set status = <para>, restore_seq =
   restore_seq + 1, <colunas da tabela de 3.1> where id = … and status in (<de>) and restore_seq =
   <lido>`), e fecha o ciclo aberto com o `end_reason` da tabela. Com zero linhas, relê o teste: estado
   fora de `<de>` → `ja_encerrado`; senão → `em_andamento`. Quando `de = para` (reverter,
   `retryRestore`, vigia), a reivindicação é só por `restore_seq` e nenhum ciclo é fechado.
2. Resolve canal, token e id do vídeo, e lê o valor atual no YouTube, campo a campo.
3. Decide (3.3). **Imediatamente antes de cada chamada de escrita, relê `restore_seq`; se mudou,
   desiste sem escrever** e devolve `em_andamento`.
4. Grava `restore_status` com `where restore_seq = <reivindicado>`. Deixar uma variante no ar grava
   `winner_applied_at`, `applied_by = 'manual'` e `revert_expires_at` (7 dias), em qualquer tipo de
   teste, **só se todo campo terminou `ok`**. Reverter limpa esses três só se todo campo terminou `ok`.

**Quem mais reivindica.** Retomar, forçar rotação e a rotação do cron fazem o mesmo `update` com
`where status = <esperado> and restore_seq = <lido>` **antes** de escrever no YouTube, e relêem
`restore_seq` antes de cada escrita. Retomar também zera `restore_status`. Sem isso o vigia pode
escrever o original por cima de um teste que acabou de ser retomado, e a rotação pode aplicar uma
variante num teste que acabou de ser pausado.

Falha nos passos 2 ou 3 não desfaz o passo 1: pausar e encerrar mudam o estado mesmo quando nada pôde
ser lido. **Isso muda o comportamento de hoje**, em que a ação devolve erro e o teste continua como
estava. Só se mexe no campo que o teste mexe: thumbnail em teste de thumbnail, título em teste de
título, os dois no combo. Os campos são independentes.

### 3.3 Decisão, por campo

| # | Situação | Sem `forcar` | Com `forcar` |
|---|---|---|---|
| 1 | O valor atual já é o destino | `ok`, sem escrever | igual |
| 2 | É o de outra variante do teste, ou o original | escreve o destino | igual |
| 3 | Outro valor (edição feita por fora) | não toca: `pulado_drift` | escreve o destino |
| 4 | A leitura respondeu e não há com o que comparar (arquivo da variante sumiu do Blob, imagem ilegível) | `pulado_drift`, motivo `sem_base_de_comparacao` | escreve o destino |
| 5 | A leitura falhou (rede, 5xx, 401, 403, cota, Blob fora do ar) | `falhou`; entra na nova tentativa | igual |
| 6 | Não há como ler: canal não identificado, token que não renova, vídeo fora de `youtube_videos` | `falhou`, `erro` com o motivo; entra na nova tentativa | igual |
| 7 | `videos.list` respondeu sem o vídeo (apagado, ou de outro canal) | `desistiu` na hora, motivo `video_inexistente`, com o aviso próprio | igual |

- **Thumbnail recém-trocada.** O YouTube demora a servir a imagem nova. "Última escrita do app no vídeo"
  é o mais recente entre o `started_at` do último ciclo, o `em` de qualquer campo de `restore_status` e
  `winner_applied_at`. Se ela tem menos de 3 horas (número a confirmar pelo portão), ou se
  `last_applied_variant_id` não é nulo, a linha 1 não vale para thumbnail: escreve o destino mesmo assim.
- **Variantes parecidas.** Se o `thumbnail_dhash` do destino e o de outra variante do teste estão a
  `DHASH_MAX_SAME` ou menos um do outro, a linha 1 não vale para thumbnail: escreve sempre.
- **Drift.** **[RECOMENDAÇÃO — decisão do dono, pergunta 5]** O vigia passa a detectar pela imagem:
  dHash da `hqdefault` contra o `thumbnail_dhash` da variante do ciclo aberto, com custo de cota zero.
  `checkDrift` e a dependência de `YOUTUBE_API_KEY` saem (hoje, sem a chave, a fase é pulada em
  silêncio: `ab-watchdog/route.ts:75-76`). Ciclo com menos de 3 horas continua pulado; leitura que falha
  é falha do cron, não "sem drift". Drift de título não é detectado e fica fora deste spec.
- **Drift em combo.** A thumbnail editada por fora fica `pulado_drift`; o título, que estava na
  variante, volta ao original. O vigia pausa e avisa, e não regrava mais a thumbnail.
- **Sem original.** Destino original com `original_title` nulo, ou sem arquivo de
  `original_thumbnail_url` em `blob.vercel-storage.com`: `pulado_sem_original` no campo.

### 3.4 Como compara

- **Título.** `videos.list`. Conjunto comparável: o `title_text` não nulo de **toda** variante,
  inclusive a original, mais `ab_tests.original_title`. Comparação exata, sem espaços nas pontas. A
  escrita reenvia os campos graváveis do `snippet` lido (`title`, `description`, `categoryId`, `tags`,
  `defaultLanguage`, `defaultAudioLanguage`), trocando só o título. A rotação usa a mesma função de
  escrita (hoje `updateVideoMetadata` não reenvia os dois campos de idioma: `ab-metadata.ts:36-43`).
- **Thumbnail.** Baixa a imagem atual com `probeThumb(id, null)` (a `hqdefault`, 480×360), calcula o
  dHash e compara com o `thumbnail_dhash` de cada variante pela tolerância `DHASH_MAX_SAME`. A URL nunca
  é critério. Mapeamento: `probeThumb` lança ou devolve `dhash` nulo → linha 5; o arquivo da variante
  responde 404 no Blob, ou o `sharp` não lê a imagem → linha 4; o Blob responde 5xx ou a rede cai →
  linha 5.
- **dHash da variante.** Do arquivo em `blob_url`, por `hqdefaultLike()` =
  `sharp(bytes).resize(480, 360, { fit: 'contain', background: '#000' })` (um 16:9 ganha as faixas que o
  YouTube põe; um 4:3 passa intacto; `sharp` já é dependência) e depois `dhashOf`. Calculado onde a
  variante nasce (`uploadVariant`, `pullPipelineThumbnails`, e a cópia da original em `createAbTest` e
  `batchStartTests`) e, se nulo na hora de comparar, ali mesmo. Variante de playoff nasce sem dHash até
  a Migration B e cai nesse cálculo na hora.
- **Cópia da original.** Hoje a cópia guardada é a `hqdefault` (480×360 com faixas), e "voltar ao
  original" sobe essa imagem pequena. A criação do teste passa a copiar a maior que existir, na ordem
  `maxresdefault`, `sddefault`, `hqdefault` (a mesma de `biggerCopy`, `thumb-fingerprint.ts:84-99`, que
  passa a ser exportada); teste cuja original é a pequena avisa no diálogo de encerrar: "O original foi
  guardado em baixa resolução."
- **Original relido no início.** **[RECOMENDAÇÃO — decisão do dono, pergunta 4]** `startAbTestInternal`
  relê título e thumbnail. Se diferem do que foi guardado na criação do rascunho, atualiza
  `original_title`, a cópia e o dHash da original antes do primeiro ciclo. Sem isso, um título mudado
  entre criar e iniciar é sobrescrito pelo antigo quando o teste sai do ar. `startAbTestInternal` passa
  também a usar `applyVariantToYouTube` (hoje só aplica a thumbnail: `ab-start.ts:105-111`).
- **Portão**, antes de qualquer outra tarefa de P4, com imagens reais. O agente escreve um script em
  `scripts/`; **o dono roda**, num vídeo que ele escolher (custo: cerca de 150 unidades de cota); o
  resultado vai para o ledger do plano. Mede: (i) um arquivo 1280×720 e a `hqdefault` que o YouTube
  serviu para ele ficam dentro de `DHASH_MAX_SAME`; (ii) uma cópia 480×360 e a `hqdefault` depois de
  restaurada, idem; (iii) quanto tempo a `hqdefault` leva para mudar depois de um `thumbnails.set`
  (confirma ou corrige as 3 horas de 3.3); (iv) a distância entre as variantes de um teste real. Se (i)
  ou (ii) falhar, a entrega para e a tolerância é decidida com o dono.
- **Erros do YouTube.** `setThumbnail` e a escrita de título passam a lançar
  `YouTubeApiError { status, reason }`, com `reason` de `error.errors[0].reason` (hoje a mensagem é só
  "failed: 403"). A rotação deixa de decidir por `msg.includes('401' | '403' | '429')`
  (`ab-rotate-phases.ts:233-237`) e passa a ler `status` e `reason`; `quotaExceeded` não conta para as
  três falhas seguidas.

### 3.5 Resultado, nova tentativa e avisos

`ab_tests.restore_status` tem a forma
`{ title?: { estado, destino, forcado, motivo?, erro, em, attempts }, thumbnail?: {…} }`, com `estado`
em `ok`, `falhou`, `pulado_sem_original`, `pulado_drift`, `desistiu`, e `destino` igual a `'original'`
ou ao id da variante. `motivo` é o do campo (`sem_base_de_comparacao`, `video_inexistente`); o motivo da
chamada mora no `end_reason` do ciclo.

- **Todo escritor** de `restore_status` — a função, o vigia, `retryRestore`, `dismissRestore` —
  reivindica por `restore_seq` antes e grava com `where restore_seq = <reivindicado>`. Zero linhas:
  `em_andamento` ("Outra tentativa está em andamento. Tente de novo em instantes.").
- **`forcado`.** **[RECOMENDAÇÃO — decisão do dono, pergunta 3]** Guarda se a chamada original veio com
  `forcar: true`. O vigia e `retryRestore` repetem com o valor gravado, para a confirmação do dono não
  se perder numa falha de rede.
- **`attempts`.** A falha da chamada original grava 1. Só o vigia incrementa. `retryRestore` zera antes
  de tentar; se falhar, grava `falhou` com 1.
- **Vigia.** Ganha uma fase nova, com `try` próprio, sobre testes de qualquer estado que não seja
  `active` (inclusive `archived`) e tenham campo em `falhou`:
  `.or('restore_status->title->>estado.eq.falhou,restore_status->thumbnail->>estado.eq.falhou')`.
  Uma tentativa por execução (ele roda às 10:00 e às 20:00 UTC); na terceira falha o campo vira
  `desistiu`. Erro de cota (`reason = 'quotaExceeded'`) é `falhou` e não conta para as três.
- **Ações humanas novas:** `retryRestore(testId)` ("Tentar agora") e `dismissRestore(testId, campo)`
  ("Já corrigi no YouTube: dispensar aviso": apaga o campo). Permissão: a de encerrar, quando o destino
  é o original; a de quem administra o site, quando o destino é uma variante. "Tentar agora" aparece em
  `falhou` e `desistiu`; dispensar, em `falhou`, `desistiu` e nos dois `pulado_*`.
- **Avisos**, entregues por `fanOutToSiteAdmins`: enquanto houver campo em `falhou`, chave
  `ab-restore:<testId>`, `claimAlert(…, '1 day')`, liberada quando não houver mais. Ao virar `desistiu`,
  um aviso próprio (`ab-restore-desistiu:<testId>`) dizendo o que ficou no ar. Sem destinatário é
  `fanOutToSiteAdmins` devolver 0: sai `SEM_DESTINATARIO` na resposta do cron, que nesse caso grava
  `recordCronFailure`. Os dois avisos antigos do vigia (rotação perdida, drift) ficam como estão.
- **Custo** por tentativa: 1 unidade de leitura mais 50 por campo escrito.

## 4. Correções de verdade

### 4.1 Avaliação automática (P2)

O `ab-evaluate` decide sobre "impressões" que são views renomeadas e cliques que são sempre zero.
Enquanto não houver métrica de entrega real (seção 6), ele **não declara vencedor, não abre carência,
não cria playoff e não aplica nada**:
- `phaseEvaluateActiveTests` fica com um só ramo: `dias desde o início >= max_duration_days` → volta ao
  original e encerra com `completed_reason = 'inconclusive'`. Em P2 a volta usa a restauração de hoje
  (`ab-evaluate-phases.ts:408-427`); P4 troca por `settleOnAir(original, 'duracao_maxima')`.
- `phaseRetryFailedApplies`, `phaseDetectPlayoffEligibility` e os testes delas são **apagados** (o git
  guarda). A estatística (`ab-statistics.ts`) e os gates (`ab-gates.ts`) ficam como funções puras, sem
  chamador na rota. `phaseAutoStartPlayoffs` continua só para rascunho de rodada 2 já criado (hoje
  zero); nenhum playoff novo é criado.
- `AB_AUTO_APPLY_WINNER` deixa de ser lida: sai de `ab-apply.ts`, da lista de flags do `CLAUDE.md` e de
  `docs/ops/runbook-promocao-next16.md:97`.
- Somem as configurações que ficaram sem efeito: "Aplicar vencedor automaticamente"
  (`settings-drawer.tsx:213-216`, `step-config.tsx:77-82`), "cria automaticamente um Round 2"
  (`step-config.tsx:115`), limiar de confiança e estabilidade, a frase de `live-monitor.tsx:123` e "O
  vencedor será aplicado automaticamente" (`active-detail.tsx:142`). No schema, `auto_apply_winner` e
  `default_auto_apply` ficam opcionais e ignoradas (`ab-schemas.ts:31,39`), para configuração antiga
  continuar válida.
- Testes (`test/ab-cron-evaluate.test.ts`, `test/api/cron/ab-evaluate.test.ts`,
  `test/youtube/ab-evaluate-phases.test.ts`, `test/youtube/ab-critical.test.ts`,
  `test/youtube/ab-gates.test.ts`): os de estatística e gates viram testes de função pura; os de rota
  passam a afirmar que nada é escrito no YouTube além da volta ao original, nem em `winner_variant_id`.
- Escolher o que fica no ar é decisão humana.
- **O pipeline.** **[RECOMENDAÇÃO — decisão do dono, pergunta 7]** O `ab-backfill` segue gravando views
  como "impressões" nos ciclos, e o Cowork lê isso pelo funil, pelo painel e pelos prompts. Nesta
  entrega esses campos passam a sair `null`, com `aviso: 'sem métrica de entrega'`, e o "lift médio" sai
  dos prompts. A alternativa é deixar como está e registrar no backlog.

### 4.2 Telas

#### 4.2.1 O que entra na parte 1

- **Em P2, remoção pura, sem tela nova.** **[RECOMENDAÇÃO — decisão do dono, pergunta 10]** Saem os
  números fabricados abaixo; no lugar de cada bloco fica a frase fixa "Sem medição de entrega por
  enquanto". Precisa do "pode" porque a regra é mockup antes de qualquer tela, e aqui só se tira.

  | Número | Onde |
  |---|---|
  | Tempo assistido = `(retention ?? 0.4) * 600` | `active-detail.tsx:77` |
  | Comentários = 2% dos cliques; compartilhamentos = 0,8% | `active-detail.tsx:78-79` |
  | Probabilidade "top 2" com fatores 0,3 e 0,5 | `ab-lab/queries.ts:1041-1042` |
  | Receita anual = total de 90 dias lido como 28 dias, vezes 13 | `ab-lab/queries.ts:1284-1291` |

  `mock-views.ts` já só carrega em desenvolvimento (`[testId]/page.tsx:43`) e fica.
- **Em P4, com mockup aprovado:** o diálogo de encerrar e a faixa de restauração (spec de telas, 9.2 a
  9.4). O diálogo pergunta "O que fica no vídeo?", com uma opção por variante (a original primeiro) e
  nenhuma marcada, e diz qual está no ar agora. Escolher a original é `manual_archive` (o teste aparece
  como "Encerrado sem vencedor"); escolher outra é `manual_winner`. Horários do A/B aparecem em São
  Paulo. Pausa automática por falha de API fecha o ciclo e avisa.

#### 4.2.2 O que vai para a etapa de telas do A/B (antigos 1d e 1e; não é parte 1)

- Somem os rótulos "Impressões" e "CTR" sobre views e zero, todo número de confiança e os gates.
- A tela mostra, por variante, views por dia nos **dias válidos**. Dia válido da variante: a linha de
  `yt_own_video_meta_daily` do dia tem `ab_test_id` do teste, `ab_variant_id` igual à variante e
  `seconds_on_air_analytics >= 77 760` (90% de 24 horas); junção por `(youtube_video_id, day_pt)`, que
  nas tabelas da coleta é o id de 11 caracteres (em `ab_tests` a coluna de mesmo nome é uuid: nunca
  juntar pelo nome).
- **Views do dia. [RECOMENDAÇÃO — decisão do dono, pergunta 2]** O L2 não grava dia sem view. Então:
  com linha em `yt_own_video_daily`, vale `views`; sem linha, o dia vale **0** se existe tentativa
  `diario` com `outcome = 'ok'` para o vídeo em `yt_own_collection_attempts` com `attempt_day` pelo
  menos 3 dias depois do dia; antes disso é "aguardando o YouTube"; sem tentativa `ok`, "sem medição".
- Contagens na tela: dias válidos; "N dias descartados" (há linha de metadados do teste, mas a variante
  é nula ou ficou menos de 90%; conta por teste, não por variante); "N dias aguardando o YouTube"; "N
  dias sem medição". Os 90% cobrem a rotação das 08:00 UTC, que no horário de verão do Pacífico cai 1
  hora depois da virada do dia, com até 84 minutos de atraso do cron. Teste que rodou antes de a coleta
  existir mostra só "sem medição".
- **Só há destaque quando todas as variantes têm 3 ou mais dias válidos e a soma das views do teste é
  de pelo menos N** (N é do dono, pergunta 2); a destacada é a de mais views por dia e o rótulo é "mais
  views/dia até agora", nunca "líder" nem "vencedor". Abaixo disso a tela mostra os números sem destaque
  e diz o que falta. A tela nunca mostra diferença percentual nem intervalo, e avisa: "Cada variante foi
  medida em dias diferentes; vídeo novo perde views sozinho, então a ordem da rotação pesa."
- Tabela ausente ou erro de leitura mostra "Não foi possível ler a coleta diária"; tabela lida e sem
  nenhuma tentativa para o vídeo mostra "A coleta diária ainda não começou". Nunca um pelo outro.

O desenho dessas telas está no spec de telas, seção 9.

### 4.3 Fadiga e "vídeo em alta" saem (P1)

**Motivo.** `youtube_video_analytics.views` é o total da janela de 90 dias regravado a cada dia, não a
contagem do dia (verificado em produção em 08/10; roteiro, §5). O detector de fadiga e o `detectViral`
leem esse número como diário. Nada novo pode lê-lo assim.

**Quem grava, e sai:**
- A fase de fadiga do cron: `sync-analytics-metrics/route.ts:358-431` e o contador (`:61`, `:440`,
  `:633`); `lib/youtube/ab-fatigue.ts` inteiro.
- O aviso `trending_viral`: mesma rota, `:187-189`, `:206`, `:229-241` e o envio em `:311-331`;
  `detectViral` (`lib/youtube/analytics-sync.ts:10-18`). A rota deixa de gravar
  `view_count_delta_today` e `view_count_yesterday` (`:210-211`), que recebem o total de 90 dias e só
  ela lê. As chaves `fatigueAlerts` e `notifications` saem da resposta do cron.
- **O terceiro gravador, que o roteiro não cita:** `lib/youtube/thumbnail-library.ts:117-143` insere
  alerta com `z_score: -2.0` quando a longevidade dá `fading`; é chamado pela fase 5 do `ab-evaluate`
  (`ab-evaluate/route.ts:29-43`). A inserção sai. A longevidade em si fica (pergunta 9).
- `dismissFatigueAlert` (`ab-lab/actions.ts:64-81`) e a resolução automática ao criar teste
  (`ab-lab/actions.ts:261-266`).

**Quem lê, e sai:**
- A/B Lab: `fatigue-card.tsx` inteiro; `ab-lab-dashboard.tsx:17,25-26,44,59,127-142,344-365`;
  `ab-lab/page.tsx:8,22,28,50`; `getFatigueAlerts` (`ab-lab/queries.ts`, a partir de `:397`); e o
  **"+30%"** que a sugestão dá a vídeo com alerta (`ab-lab/queries.ts:959-969`). O cartão é apagado, não
  escondido: a etapa 7 constrói outra coisa.
- Lista de vídeos: o **selo "FADIGA"** (`youtube/videos/page.tsx:18,38,47,109`;
  `videos-connected.tsx:39,297-299`).
- Tipos: `trending_viral` em `lib/youtube/notification-service.ts:3,14,91-92,119,189-194`.

**Pipeline, com a regra "Pipeline Integrity" do `CLAUDE.md`** (ao deletar rota: tirar a entrada do
registry **e** ajustar o `endpoint_count`; atualizar o doc do domínio):
- As rotas `api/pipeline/youtube/ab-tests/fatigue-alerts` e `api/pipeline/youtube/thumbnails/fatigue`
  são **apagadas**. Devolver lista vazia diria "sem fadiga", que é a falha em verde de sempre.
- `lib/pipeline/api-registry.ts`: saem as entradas de `:197` e `:199`, e o `endpoint_count` do domínio
  YouTube vai de **36 para 34** (`:169`).
- `lib/pipeline/services/youtube.ts`: saem `getAbFatigueAlerts` (a partir de `:1647`) e
  `getThumbnailFatigueAlerts` (a partir de `:1865`).
- MCP: saem os **2 recursos** `pipeline://youtube/ab-fatigue` e `pipeline://youtube/thumbnails/fatigue`
  (`mcp/resources.ts:664-680`, `:727-743`) e a **ação `get_fatigue_alerts`** (`mcp/tools.ts:664-665` e
  a descrição em `:952`; `mcp/services/ab-tests.ts:173-175` e a lista em `:193`). O snapshot é
  regenerado no mesmo commit.
- `trending_viral` como tipo que o Cowork pode enviar (`intelligence-schemas.ts:33`,
  `mcp/prompts.ts:1209`): sai do enum, e o envio passa a ser recusado com 422 e mensagem em pt-BR.
- `data/pipeline-docs/cowork-docs-youtube.md`: saem as linhas `:12` (a menção) e `:280`, e as seções de
  `:1304`, `:1396`, `:1508` e `:1544`. `docs/cowork-pipeline-reference.md` não cita fadiga. O dono roda
  o seed; o agente prepara o comando.

**Testes que mudam (16 arquivos), no mesmo commit:** `test/youtube/ab-fatigue.test.ts` (apagado),
`test/analytics-sync.test.ts`, `test/analytics-notification-service.test.ts`,
`test/cron/sync-analytics-metrics-veredito.test.ts`, `test/cron/sync-analytics-metrics.test.ts`,
`test/api/cron/sync-analytics-metrics.test.ts`, `test/api/pipeline/youtube-thumbnails.test.ts`,
`test/api/pipeline/youtube-ab-extended.test.ts`, `test/mcp/youtube-mcp-tools.test.ts`,
`test/mcp/youtube-cowork-docs.test.ts`, `test/mcp/__snapshots__/mcp-schema-parity.test.ts.snap`,
`test/ab-dashboard.test.tsx`, `test/youtube/ab-lab-dashboard-stubs.test.tsx`,
`test/ab-actions-create.test.ts`, `test/ab-p3-actions.test.ts`, `test/youtube/thumbnail-library.test.ts`.
Mais o roteiro manual `test/e2e/youtube-mcp-e2e-plan.md`. `test/integration/youtube-channel-remove.test.ts`
fica como está.

**Dados já gravados. [RECOMENDAÇÃO — decisão do dono, pergunta 8]** Nenhum código desta entrega apaga
ou altera dado em produção.
- A tabela `youtube_fatigue_alerts` fica: a função de remover canal depende dela
  (`20261003000007_youtube_channel_remove.sql`). Depois de P1 ninguém mais a lê nem grava.
- Linhas `pending`: a recomendação é o dono marcá-las `dismissed` com um `update` que o agente prepara
  (uma linha); a alternativa é deixá-las, sem efeito.
- Os 10 avisos `youtube.trending_viral` já enviados: a recomendação é deixá-los no histórico e o dono
  saber que são suspeitos; a alternativa é o dono apagá-los com um `delete` que o agente prepara.

**Fora desta entrega:** "Candidatos a teste" (etapa 7 do roteiro) e o detector de queda de CTR.

## 5. Aceite, por entrega

**P1**
1. `grep -rniE "fatigue|fadiga|detectViral|trending_viral" apps/web/src apps/web/data` só encontra
   `database.types.ts`.
2. Teste do cron com linhas de total de 90 dias: nenhum aviso sai, nada é inserido em
   `youtube_fatigue_alerts`, e a rota não grava `view_count_delta_today` nem `view_count_yesterday`.
3. Teste: `checkAndPersistLongevity` com resultado `fading` não insere alerta.
4. Testes do registry e do MCP verdes com `endpoint_count` 34; as duas rotas respondem 404.
5. Teste: enviar aviso `trending_viral` pelo pipeline → 422.

**P2**
6. Teste: `ab-evaluate` com métricas zeradas não cria vencedor, carência nem playoff; ao atingir a
   duração máxima encerra como `inconclusive`; a rota não lê `AB_AUTO_APPLY_WINNER`.
7. `grep -rn "AB_AUTO_APPLY_WINNER\|isAutoApplyEnabled\|phaseRetryFailedApplies\|phaseDetectPlayoffEligibility" apps/web/src CLAUDE.md docs/ops`
   não encontra nada.
8. Teste: configuração antiga com `auto_apply_winner` continua válida e a chave é ignorada.
9. Se a pergunta 10 for "sim": teste de que os quatro números de 4.2.1 não aparecem. Se a pergunta 7
   for "sim": teste de que funil e painel do pipeline devolvem `null` com o aviso.

**P3**
10. As três partes da completude da seção 2.
11. Teste: Zod e rota do pipeline recusam `description` com 422 e a mensagem em pt-BR;
    `description_text` não nulo → 422; `description_text: null` é aceito.
12. Teste: `applyVariantToYouTube` nunca envia descrição diferente da lida, em nenhum tipo.
13. Produção: depois da Migration A, um rascunho combo criado para a conferência abre como "Título +
    thumbnail"; no dia seguinte o `ab-rotate` (05:00 em São Paulo) está sem falha em `/api/health`.

**P4**
14. Portão do dHash rodado pelo dono (3.4), com o resultado no ledger, antes das demais tarefas.
15. Testes de `settleOnAir`: um por célula da tabela de 3.3 (sete linhas), para título e para
    thumbnail; um por linha da tabela de 3.1 conferindo estado final, `completed_reason`, `end_reason`
    e as colunas de "também grava"; mais: encerrar a partir de `paused`; `original_title` nulo e
    original fora do Blob → `pulado_sem_original`; dHash nulo é calculado na hora.
16. Teste: variante original com `title_text` próprio no ar, destino original → o título no ar é
    reconhecido como do teste (linha 2) e `original_title` é escrito.
17. Teste: `endAbTest` com o id da variante original → `manual_archive`, sem dados de vencedor.
18. Teste da regra das 3 horas: pausar e, uma hora depois, encerrar deixando B, com a leitura dizendo
    "já é B" → escreve. Idem com `last_applied_variant_id` não nulo. Destino a 6 ou menos de outra
    variante → escreve.
19. Teste: deixar uma variante no ar num teste de título escreve o título e grava `winner_applied_at` e
    `revert_expires_at`; se o campo termina `falhou`, os dois ficam nulos; `revertWinner` com edição
    externa → `pulado_drift` e os dados de vencedor ficam.
20. Teste: destino variante com edição externa → `precisa_confirmar` e nada gravado; combo com só o
    título editado → `precisa_confirmar` listando só o título; com `forcar: true` → escreve os dois e
    grava `forcado: true`; a nova tentativa repete forçando.
21. Teste: leitura que falha (timeout, 401) e canal não identificado → estado muda e o campo fica
    `falhou`, um aviso por dia; terceira falha → `desistiu` e o aviso próprio; `quotaExceeded` não
    conta; `videos.list` sem o vídeo → `desistiu` na hora.
22. Testes das corridas: o vigia reivindicou, o teste é retomado, **o vigia não chama `thumbnails.set`
    nem `videos.update`**; a rotação do cron leu o teste, o dono pausa, a rotação não escreve nem abre
    ciclo; `retryRestore` junto com o vigia → uma escrita só; duas chamadas concorrentes de encerrar →
    uma execução e a outra recebe `ja_encerrado`; estado igual e `restore_seq` diferente → `em_andamento`.
23. Teste: drift detectado pelo dHash → pausa, avisa e não escreve a thumbnail; em combo, o título
    volta ao original; `probeThumb` que falha é falha do cron.
24. Teste: iniciar um teste cujo título mudou depois da criação atualiza `original_title`.
25. Teste: a Migration 0 aborta com teste em carência; roda duas vezes sem erro.

**Etapa de telas (não é parte 1):** variantes com 2 dias válidos → nenhum destaque e a frase do que
falta; dia com 70 000 s no ar é "descartado"; dia sem linha e com tentativa `ok` 3 dias depois vale 0;
dia de ontem é "aguardando o YouTube"; soma abaixo de N → sem destaque.

## 6. Depois: medição nova (spec próprio)

Usa `yt_own_video_reach_daily` cruzado com os segundos no ar de `yt_own_video_meta_daily`.

**O que foi medido em produção em 09/10** (215 relatórios da Reporting API, 4 tipos):
- `start_time` e `end_time` às 07:00 UTC, 24 horas. O dia do relatório é a meia-noite do Pacífico **com
  horário de verão**, não UTC-8 fixo.
- As colunas `seconds_on_air_reporting` e `seconds_other_reporting` são calculadas com 08:00 UTC fixo
  (`lib/youtube/coleta/day-pt.ts:81-85`) e estão **1 hora deslocadas até 01/11**. Até a coleta corrigir
  isso, o par certo para cruzar com o alcance é o `_analytics`. A correção é do spec de coleta; este
  spec só não pode usar o par `_reporting` como está. [INFERÊNCIA] Depois de 01/11 os relatórios devem
  passar para 08:00 UTC; conferir de novo com relatórios reais dessa data em diante.
- A rotação das 08:00 UTC cai, portanto, 1 hora depois do começo do dia do relatório até 01/11, e deve
  coincidir com ele depois. A regra dos 90% de 4.2.2 continua valendo para os dois períodos.
- Cabeçalho do CSV: `date,channel_id,video_id,video_thumbnail_impressions,video_thumbnail_impressions_ctr`.
  CTR vem entre 0 e 1. Não há coluna de cliques. Dia sem impressão vem só com o cabeçalho, então "zero
  impressões" é sabido (diferente do diário de views, em que a ausência é ambígua).
- Volume: **1 a 9 impressões por vídeo por dia.**

**O que essa medição consegue afirmar, com esse volume:** quantas vezes a thumbnail de cada variante
foi mostrada em cada dia válido, e se ela foi mostrada.

**O que não consegue afirmar:** qual variante tem CTR melhor. Com 5 impressões num dia, um clique são
20 pontos de CTR. Um teste de 14 dias com 2 variantes dá cerca de 35 impressões por variante; com 2
cliques em 35 (5,7%), o intervalo de Wilson de 95% vai de cerca de 1,6% a 18,6%. Para separar 5% de 7%
seriam precisas cerca de 2 200 impressões por variante (estimativa), o que nesse ritmo leva mais de um
ano. Sem coluna de cliques, o número de cliques é reconstruído de impressões × CTR. [INFERÊNCIA] que o
produto dá sempre um inteiro; conferir no CSV.

**Consequência para o spec futuro:** a tela de impressões mostra contagem e intervalo, com "poucos
dados" abaixo de um piso, e nunca declara vencedor por CTR enquanto o canal estiver nesse volume. O
roteiro já adia o detector de queda de CTR até algum vídeo passar de cerca de 20 000 impressões em 28
dias; a mesma ordem de grandeza vale aqui.

## 7. O que este spec não cobre

Drift de título; a longevidade de thumbnail (pergunta 9); "Candidatos a teste"; a correção dos segundos
`_reporting` na coleta; os avisos antigos do vigia sem destinatário; o acompanhamento novo e as views
por variante, que estão em 4.2.2 só como regra para a etapa de telas.

## 8. Perguntas para o dono

Cada uma já está escrita no corpo do jeito recomendado. Um "pode" geral aceita todas.

| # | Pergunta | Recomendação | Custo da alternativa |
|---|---|---|---|
| 1 | Quando a variante original tem título próprio, "voltar ao original" volta para quê? | Para o título que estava no YouTube antes do teste (`original_title`) | Voltar para o título da variante: o vídeo pode acabar com um título que nunca foi o dele |
| 2 | Dia sem linha de views conta como zero? E qual o piso N de views para haver destaque? | Zero quando a coleta rodou e já passaram 3 dias; N a escolher (sugestão: 30) | "Sem medição": num canal pequeno a tela nunca compara, e a média exclui os dias sem view |
| 3 | A confirmação "trocar mesmo assim" vale para as novas tentativas? | Sim, para o vigia e para "Tentar agora" | Não: uma falha de rede faz a escolha do dono virar "nada foi alterado" |
| 4 | Reler título e thumbnail ao iniciar o teste? | Sim | Não: título mudado entre criar e iniciar é sobrescrito pelo antigo quando o teste sai do ar |
| 5 | O vigia detecta edição externa pela imagem (dHash)? | Sim, em P4 | Manter por URL: não detecta nada, e o texto passa a dizer isso |
| 6 | Apagar "cancelar carência" e "aplicar vencedor" da avaliação automática? | Sim; a migration aborta se existir teste nesse estado (hoje zero) | Manter: duas linhas a mais na tabela, com testes, para caminhos sem uso |
| 7 | O pipeline para de entregar "impressões", confiança e lift ao Cowork? | Sim, em P2, com `null` e aviso | Deixar: o Cowork segue aconselhando sobre views com nome de impressão |
| 8 | O que fazer com os alertas de fadiga pendentes e os 10 avisos "vídeo viral" já enviados? | Marcar os pendentes como dispensados; deixar os avisos no histórico | Apagar os avisos: some o registro de que foram enviados; não fazer nada: sem efeito na tela |
| 9 | A longevidade de thumbnail sai junto com a fadiga? | Não agora: só deixa de gerar alerta; vai para o backlog | Tirar já: P1 cresce. [INFERÊNCIA] ela compara views acumuladas, que só crescem |
| 10 | Tirar já, sem mockup, os quatro números fabricados de 4.2.1? | Sim, em P2, como remoção pura com frase fixa | Esperar a etapa de telas: os números inventados ficam na tela até lá |
