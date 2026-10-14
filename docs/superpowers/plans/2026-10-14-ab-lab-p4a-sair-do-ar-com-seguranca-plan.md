# A/B Lab honesto, P4a: sair do ar com segurança e ver o que ficou (plano de implementação)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Escrito em 14/10/2026 (noite). **Primeira versão**, ainda sem revisão. Antes de executar: Hanna (ordem e corte),
Phil (dado, migration, cota), Yannis (concorrência, erros, escrita no YouTube) e Gio (prova); conserta-se até
haver acordo, e o plano volta ao dono para o "pode" de execução (emenda v7, cabeçalho).

**Goal:** quando um teste do A/B sai do ar (pausa, encerramento, reversão, falha de API, duração máxima, drift),
o que fica no YouTube é decidido campo a campo, comparado com o que está no ar, gravado em `restore_status` e
mostrado ao dono numa faixa só de leitura; e nenhum escritor (rotação, retomar, forçar rotação, início) escreve
no YouTube sem reivindicar o teste antes.

**Architecture:** uma função `settleOnAir` (`lib/youtube/ab-settle.ts`) com a decisão pura separada
(`decidirCampo`) e portas injetáveis (banco e YouTube) para teste; a reivindicação é um `update` guardado por
`restore_seq` (função SQL `ab_settle_claim` para os sete caminhos, `ab_rotate_commit` para o fecho da rotação);
a comparação da thumbnail é por dHash da `hqdefault` (cota 0) contra o dHash de cada variante; a leitura derivada
(`lerCampoDeRestauracao`) é uma função pura usada pela faixa, pelo diálogo e pelo `GET` do pipeline.

**Tech Stack:** Next.js 16 (server actions e rotas de cron), TypeScript estrito, Vitest, Supabase (Postgres 17,
`bythiago_int` na porta 54422 para integração), `sharp` 0.35.5 (já dependência), YouTube Data API v3 (OAuth),
Vercel Blob.

**Spec:** `docs/superpowers/specs/2026-10-07-ab-lab-honesto-design.md`: seção 1 "P4"; seção 3 inteira; seção 5,
itens 14 a 25; **emendas v7 de 29 a 48, aceitas pelo dono em 14/10, valem sobre o corpo**. Aceite:
`docs/superpowers/specs/2026-10-14-ab-lab-aceite-p3-p4.md` (Gio), seções 3, 4 e 7. Mockup aprovado (versão
P4a): `docs/superpowers/mockups/2026-10-14-ab-lab-p4-dialogo-e-faixa/index.html`, com `logan.md` e `naksu.md`.
Forma da Migration 0: `.superpowers/sdd/ab-lab/migration-0-forma.md` e o arquivo
`supabase/migrations/20261014000005_ab_restore_status.sql`. Resultado da P4-0:
`.superpowers/sdd/ab-lab/p4-0-resultado.md`. Rulings: `.superpowers/sdd/ab-lab/v7-p3-p4a-progress.md`. Molde de
forma: `docs/superpowers/plans/2026-10-14-ab-lab-p3-sai-a-descricao-plan.md` ("plano da P3"). Ledger:
`.superpowers/sdd/ab-lab/progress.md`.

> **Para quem executa:** `superpowers:subagent-driven-development`, tarefa por tarefa, com o agente `executor`
> (Sonnet, effort `medium`). Nada em `high`. Revisão do lote (Tarefa 18): Phil e Yannis, Opus, `medium`.
> Capturas: Gio (Sonnet, `medium`); texto e tela: Logan e Naksu (Sonnet, `medium`).

> **Quem testa (dono, 14/10; vale sobre qualquer trecho):** testes, prova local, capturas, conferências de
> produção e paridade são do controlador com o Gio; o dono confirma. Com o dono ficam: aplicar a migration da
> P4a em produção, rodar o `devolver-hq`, colar consultas de produção e textos do Cowork, o ensaio E0 a E8, e o
> "pode". Leitura de produção pelo agente costuma ser negada pelo modo automático: o Gio prepara o `select` num
> `.sh`, o comando curto vai ao `pbcopy` e o dono cola.

## Global Constraints

- **Nunca fica um escritor fora de `settleOnAir`** nos sete caminhos de 3.1; retomar, forçar rotação, rotação
  do cron e início reivindicam por `restore_seq` **antes** de escrever e relêem `restore_seq` imediatamente antes
  de **cada** chamada de escrita (3.2; emenda 32 h, i, m).
- **Depois da P4a nenhum escritor grava `restore_status = null`** (emenda 32 e, D4): retomar grava `{}` no
  `update` final de sucesso; nulo = o teste nunca passou pelo código novo.
- Forma por campo, fixa (emenda 32 a, D2): `{ estado, destino, em, forcado, escreveu, motivo?, erro, attempts }`;
  `estado` ∈ `em_andamento | ok | falhou | pulado_sem_original | pulado_drift | desistiu`. Validação é o CHECK
  `ab_tests_restore_status_shape`, e só ele (32 g).
- `erro` guarda só `status` e `reason` do YouTube ou o motivo interno; **nunca** corpo de resposta, URL assinada
  ou token (D9; sai para o Cowork). Teto: 500 caracteres.
- `DHASH_MAX_SAME = 6` e a regra das 3 horas estão **confirmadas** pela P4-0 (emenda 30). `SEM_RESPOSTA_MIN = 5`
  (estrito: 5:00 exato ainda é "em andamento") e `INTERROMPIDO_MIN = 15` (emendas 32, 47).
- A escrita de título relê o `snippet` e reenvia `title` novo, `description`, `categoryId`, `tags`,
  `defaultLanguage`, `defaultAudioLanguage` **lidos** (3.4); `snippet.description` ausente na leitura **aborta**
  a escrita (aceite 4.3/G).
- Textos de tela: **exatos do mockup aprovado**; mudança de frase ou de estado da faixa volta ao dono (emenda
  31). Zero `color-mix()` (regra do Opera). Horários sempre de São Paulo (`America/Sao_Paulo`), com
  "Horários de São Paulo" no topo.
- A faixa da P4a **não tem botão** e não promete nova tentativa (emenda 40); em `falhou` e `pulado_*`: "Este
  aviso ainda não pode ser dispensado."
- Migration da P4a por `npm run db:new`, na fila do banco (seção 1), aplicada **antes** do código que chama
  `ab_rotate_commit` (M0-5).
- Commit e envio só de árvore própria criada de `origin/staging`; nunca o `staging` local. **Todo commit roda a
  lista inteira de testes do A/B** (seção 4) e o `tsc`. Nunca `git stash`, `git reset`, `pkill`.
- TypeScript sem `any`; texto novo em pt-BR; commits `tipo: descrição`; commit por lista de arquivos; suíte e
  build com saída em arquivo; nenhum comando acima de 4 min em primeiro plano.

## Review Focus

1. **"Última escrita" e marcador lidos depois da reivindicação.** A reivindicação grava `em = now()` em cada campo
   e zera `last_applied_variant_id`; se `settleOnAir` calcular a regra das 3 horas e o marcador com o teste
   relido **depois** dela, toda thumbnail parece "recém-trocada" (sempre escreve) e o marcador nunca conta. A
   pessoa espera que "já está no destino" seja reconhecido quando a última troca foi há dias. Teste na Tarefa 6
   (passo 1, caso "ultima escrita vem do retrato de antes da reivindicação").
2. **Escrita de título com o `snippet` sem `description`** (vídeo cuja descrição o YouTube não devolve, ou
   resposta parcial). A pessoa espera que a descrição no ar nunca seja apagada. A escrita aborta antes do `PUT`
   e o campo fica `falhou` com `erro: { motivo: 'snippet_sem_descricao' }`. Teste na Tarefa 3.
3. **Teste que saiu do ar antes da P4a (`restore_status` nulo) aberto no CMS e lido pelo Cowork.** A pessoa
   espera não ver "voltou ao original" inventado nem erro. A faixa não aparece, `leitura` é `null` no `GET`.
   Teste na Tarefa 14 (P4a-E10) e na Tarefa 12.
4. **Duplo clique em "Encerrar" e duas abas.** A pessoa espera uma só escrita no YouTube e uma mensagem clara
   na segunda aba. Garantido por `restore_seq` (servidor) e por botão travado (cliente). Testes na Tarefa 7
   (P4a-I1) e na Tarefa 15 (P4a-E3, E5).
5. **Rotação do cron com marcador velho de queda anterior** (`last_applied_variant_id` não nulo). A pessoa espera
   que o teste continue girando no dia seguinte, não que pare para sempre em verde. Teste na Tarefa 9 (P4a-I8).

---

## 0. Fatos medidos em 14/10 (`origin/staging` `f1a17634a`; `main` `472d4bf43` = P2 + P4-0 + E5a)

| Fato | Valor | Fonte |
|---|---|---|
| P3 | **não começou** (não existe `lote/ab-p3`). Este plano assume a P3 no ar (tabela "Se a P3 não estiver", abaixo) | `git branch -a` |
| Migration 0 e tipos | o arquivo `20261014000005_ab_restore_status.sql` e os 68 blocos de `database.types.ts` estão só no commit `dd9754ea5` do `staging` local, **não** em `origin/staging` (`database.types.ts` remoto sem `restore_status`). A Tarefa 0 confere; se ausentes, faz `cherry-pick dd9754ea5` como primeiro commit da árvore | `git show origin/staging:apps/web/src/types/database.types.ts \| grep -c restore_status` → 0 |
| `rotate_cycle(uuid,uuid,integer,jsonb)` | `20260531000014_rpc_rotate_cycle.sql`, `SECURITY DEFINER`, sem guarda de estado, **sem chamador** em `src` (só `database.types.ts`); `search_path` ajustado em `20260703000001` | grep |
| Fecho da rotação hoje | grava também `views` e `likes` do último poll no ciclo fechado (`ab-rotate-phases.ts:178-195`) e zera `config.consecutive_failures` (`:206-213`). **A assinatura de `ab_rotate_commit` da emenda 38 não leva nenhum dos dois** (divergência; D2) | código |
| ABBA com 2 variantes | `getNextVariantIndex('abba', 2, n)`: padrão `[0,1,1,0]`; ciclo 0 = A (original, `sort_order 0`); a rotação usa `nextCycle = fechados + 1 = 1` → **B entra no ciclo 1** (responde à dúvida do Gio, aceite seção 8) | `ab-rotation.ts`, `ab-rotate-phases.ts:131-139` |
| `ab-apply.ts` | 109 linhas; thumbnail via `fetchVariantImageBuffer` + `setThumbnail`; título via `updateVideoMetadata`; erro como `string` | código |
| `ab-metadata.ts` | `PUT` sem `defaultLanguage`/`defaultAudioLanguage` (`:36-43`); erro `"videos.update failed: <status>"`; `captureOriginalMetadata` lê `snippet` | código |
| `ab-youtube.ts` | `setThumbnail` lança `"thumbnails.set failed: <status>"`; `fetchVariantImageBuffer` lança `"Failed to fetch variant image: <status>"`; allowlist de hosts | código |
| `thumb-fingerprint.ts` | `DHASH_MAX_SAME = 6`, `dhashOf`, `hamming`, `probeThumb(id, prev, f)` (HEAD + GET da `hqdefault`, cota 0; HEAD não ok → `dhash: null`), `biggerCopy` **privado** (`:84-99`, maxres → sd) | código |
| `portao-dhash/imagem.ts` | `hqdefaultLike`, `dhashComoHq`, `maiorCopia` já existem (escritos na P4-0) | código |
| `ab-rotate-phases.ts` | `phaseProcessQueue` ignora `result.ok` (`:33-41`); idempotência por ciclo de hoje (`:94-104`); marcador velho: limpa e **pula** (`:106-117`); marcador gravado sem guarda (`:161-165`); fecho/abertura depois do YouTube (`:186-204`); classificação por `msg.includes('401'\|'403'\|'429')` (`:233-237`); auto-pausa na 3ª falha restaura só thumbnail e **não fecha ciclo** (`:243-283`) | código |
| `ab-start.ts` | lê, aplica **só thumbnail** se a 1ª variante não é original (`:105-111`), baseline por `YOUTUBE_API_KEY`, `claim .eq('status','draft')` só no fim (`:148-158`) | código |
| `ab-lab/actions.ts` | 1798 linhas: `preserveOriginalThumbnail` `:37`; `resolveVideoChannel` `:66` e `resolveYouTubeVideoId` `:623` (locais); `createAbTest` `:92` (original = `youtube_videos.thumbnail_hq_url`, a `hqdefault`); `uploadVariant` `:287`; `pullPipelineThumbnails` `:498`; `startAbTest` `:639`; `pauseAbTest` `:661` (só thumbnail; erro antes de mudar estado; fecha ciclo sem `end_reason`); `resumeAbTest` `:756` (sem reivindicação; `cycle_number = count total`); `endAbTest` `:859` (só thumbnail); `forceRotate` `:1164` (marcador sem guarda); `applyWinnerNow` `:1282`; `cancelGracePeriod` `:1393`; `revertWinner` `:1453` (restaura sem comparar); `batchStartTests` `:1717` | código |
| Variantes | têm `dimensions` (jsonb `{width,height}`) e `metadata`; "baixa resolução" = largura ≤ 480 | `database.types.ts` |
| `ab-watchdog/route.ts` | 227 linhas, `maxDuration 60`, crons `0 10` e `0 20` UTC (07:00/17:00 SP); drift `:74-189` (`YOUTUBE_API_KEY`, `checkDrift` por URL; sem a chave a fase é pulada em silêncio); podas; poda de `competitor_channel_snapshots` `:203-208` (**E9 T11a ainda não entrou**) | código |
| `ab-evaluate-phases.ts` | duração máxima com restauração "melhor esforço" (`:60-178`, comentário "P4 troca por settleOnAir") | código |
| Pipeline | `CAMPOS_DO_TESTE_QUE_SAEM_COMO_VIERAM` `services/youtube.ts:986-992`; `CAMPOS_DO_CICLO` `:994` (sem `end_reason`); `listAbTests` `:1031`, `getAbTest` `:1061`; teste "coluna futura não vaza" `test/youtube/ab-pipeline-null-aviso.test.ts:176`; paridade `:203`. O doc `cowork-docs-youtube.md` **não tem seção** do `GET /ab-tests/:id` | código |
| Avisos | `fanOutToSiteAdmins(opts): Promise<number>` (`lib/notifications/fan-out-to-admins.ts:14`); `claimAlert(supabase, key, interval): Promise<boolean>` e `releaseAlert` (`lib/ops/alert-state.ts`); `recordCronFailure(cron, erro, severidade)` (`lib/cron-health.ts:23`); `SEM_DESTINATARIO`/`getSiteOwners` (`get-site-owners.ts`) | código |
| Remoção de canal | `getYouTubeChannelRemovalImpact` `youtube/_actions/channels.ts:281` (RPC `youtube_channel_removal_impact`); tipo `RemovalImpact` `lib/youtube/channel-registry.ts:~101`; tela `youtube/_channels/channel-admin.tsx`; teste `test/youtube/channel-registry-actions.test.ts` | código |
| Portão | `scripts/portao-dhash.sh` → `apps/web/scripts/portao-dhash.ts`; comandos `ensaio\|valer\|devolver\|conferir\|distancias`; `VIDEOS_APROVADOS = ['6jL-jeux_1Y','WDRy_uldCI8']`. **`devolver-hq` não existe; não existe comando de leitura do dHash no ar.** O defeito `etagAntes` (I1a) foi consertado na P4-0 (`executar.ts:61-62,147-149`); falta o conserto Y-7 (diário com ETag crua e erro da sonda de antes; (ii) conclui pela ETag do teste contra a da volta) | código, `p4-0-conserto-report.md`, emenda 30 |
| Concorrência | sem `p-limit` no `package.json`: escreve-se um auxiliar (Tarefa 11) | `package.json` |
| Tokens do CMS | `--cms-*`/`--color-cms-*` em `globals.css`; `--color-cms-on-accent: #1A120A` (texto claro sobre `#B94210` dá 3,39:1, reprova; o mockup usa `#FFF8F0`, 5,18:1: **pendência do CMS**, Naksu R2-1); tema por `[data-theme="light"]` | `globals.css`, `naksu.md` |
| Estado `desistiu` na faixa da P4a | o mockup **não tem** texto para `desistiu` com motivo `video_inexistente` ou `novo_teste` (H é "só P4b", 3 falhas). Na P4a eles nascem pela linha 7 de 3.3 e pela Y-5 | mockup |

**Não medido (ninguém leu produção):** quem executa `rotate_cycle` hoje (M0-3); se a guarda D3 continua 0
(M0-2); se a Migration 0 está aplicada (M0-1, esperado `4, 5, 1, true, 0, 0`). Tarefa 0.

### Se a P3 não estiver no ar quando a P4a começar

| O que a P4a assume da P3 | Se não estiver |
|---|---|
| `TestType = 'thumbnail' \| 'title' \| 'combo'` | a P4a trata `'description'` como "tipo fora de uso": `settleOnAir` devolve `ja_encerrado`-equivalente sem escrever (não restaura descrição) e o start recusa. **Não** começar a P4a sem a P3 em `origin/staging`: os dois reescrevem `ab-apply.ts`, `ab-metadata.ts` e os mesmos trechos de `actions.ts` |
| `updateVideoMetadata(videoId, title, accessToken)` sem descrição | a Tarefa 3 parte da assinatura antiga e ainda assim nunca envia descrição diferente da lida |
| `ApplyVariantInput` sem `description_text`/`originalDescription` | idem |
| `CAMPOS_DO_TESTE_QUE_SAEM_COMO_VIERAM` sem `original_description` | a Tarefa 12 só acrescenta `restore_status` |

**Regra (plano da P3, seção 1):** a P4a nasce de `lote/ab-p3` (depois do commit da Tarefa 4 da P3) ou de
`origin/staging` com a P3; nunca em paralelo. Depende do **código** da P3 em `main`, não da Migration A.

## 1. Onde se trabalha e como se envia

```bash
git fetch origin
git worktree add ../bythiago-ab-p4a -b lote/ab-p4a origin/staging
```

Regras da árvore (iguais às da P3, seção 1): **nunca existe `apps/web/.env.local` na árvore**; o servidor das
capturas lê `apps/web/.env.development.local` e o build `apps/web/.env.production.local`, os dois apagados ao fim
da Tarefa 17; `bash scripts/check-type-debt.sh` antes do push; envio por `bash -c 'git push origin
lote/ab-p4a:staging'`, **da árvore**, nunca do `staging` local; junção de volta ao `staging` local com as
três travas (Tarefa 18).

**Fila do banco** (emendas 36 e 45; `.superpowers/sdd/a5/fila-do-db-push.md`), para a migration da P4a:

- O SQL vive **só neste plano** (Tarefa 1) e é testado no `bythiago_int` (porta 54422). O arquivo nasce por
  `npm run db:new ab_p4a_reivindicacao` **no dia da aplicação**, no checkout principal, e é aplicado na mesma
  sessão por `npm run db:push:prod` (pede `YES`; é do dono); **commit e envio vão pela árvore**.
- Pré-condições, todas: (a) **uma pendente por vez**: nenhuma outra migration criada e não aplicada; (b) nenhum
  arquivo destrutivo da A5 armado e não aplicado; (c) **fora de 11:30 a 13:00 UTC** e **fora dos minutos 0 a 4,
  20 a 24, 30 a 34 e 40 a 44**; (d) **nunca em 16/10 entre 17:00 e 23:00 UTC**; (e) **antes** do deploy do
  código que chama `ab_rotate_commit` (M0-5): a migration vai a produção, a conferência M0-5 é colada no
  ledger, e só então o push de código; (f) `lock_timeout` de 5 s e `reset lock_timeout` no arquivo.
- Pedir ao controlador da A5 a linha da migration na fila ("aditiva exceto o `drop` de `rotate_cycle`, sem
  chamador; não bloqueia").

**Ordem com as outras entregas:** P3 (código em `main`) → Migration 0 (já aplicada, M0-1 confere) → migration da
P4a → código da P4a → `devolver-hq` (antes da promoção a `main`) → promoção → emenda da E18 em produção e ensaio
→ primeiro teste liberado → P4b. **`ab-watchdog/route.ts`** (emenda 37): E9 T11a → P4a → P4b; se a T11a ainda não
tiver entrado quando a Tarefa 11 começar, a P4a mexe só em `:74-189` e na linha nova da resposta, e quem
commitar depois resolve o conflito no objeto da resposta (os dois rodam os cinco testes da rota).

## 2. O que é do dono

1. Colar as consultas M0-1, M0-2, M0-3 (Tarefa 0) e M0-5 (Tarefa 18), preparadas pelo Gio num `.sh`.
2. Aplicar a migration da P4a: `npm run db:push:prod` (`YES`), no dia e janela da seção 1.
3. **Escolher um vídeo sem `maxresdefault`** e rodar o `devolver-hq` (Tarefa 16; cerca de 101 unidades de cota),
   **antes da promoção a `main`**. Decisão aberta Q1.
4. Aprovar as capturas da Tarefa 17 e o texto do estado `desistiu` (Q6) **antes** do envio.
5. O ensaio E0 a E8 (Tarefa 19), em dois dias de calendário, e o roteiro do Opera (5 min, no E5).
6. Dar o "pode" de execução deste plano e o de promoção.

**O dono precisa saber (não responde):** pausar e encerrar passam a **mudar o estado do teste mesmo quando o
YouTube recusa** (3.2); o que ficou no ar aparece na faixa. Até a P4b uma faixa de erro não some sozinha e não
tem botão; a correção é no YouTube Studio. "Aplicar vencedor" e "Cancelar carência" somem do CMS.

## 3. Decisões que o spec não toma (recomendação do controlador; a revisão cobra)

| # | Decisão | Recomendação | Alternativa e custo |
|---|---|---|---|
| D1 | Como a reivindicação dos sete caminhos muda estado, grava `em_andamento` **e** fecha o ciclo "numa só instrução" (3.2 passo 1) | **Função SQL `ab_settle_claim`** na migration da P4a (`service_role` só), que faz o `update` guardado e o fecho do ciclo numa transação e devolve o `restore_seq` reivindicado e o instante gravado | Dois comandos do cliente (update + fecho): se a função morrer entre eles, fica teste `paused` com ciclo aberto; retomar abriria um segundo ciclo aberto e a coleta contaria segundos no ar de um teste parado. Custaria um reparo no vigia |
| D2 | `views` e `likes` do último poll no ciclo fechado pela rotação; zerar `consecutive_failures` | **`ab_rotate_commit` ganha `p_views int default null, p_likes int default null`** e zera `config.consecutive_failures` no mesmo `update` que limpa o marcador. A forma é do Phil (D12) | Assinatura exata da emenda 38: perde os números do ciclo (a tela de resultado lê `views` do ciclo) ou precisa de um segundo `update` fora da guarda |
| D3 | `destino` gravado por retomar, forçar rotação e rotação | **O id da variante** (como nos outros caminhos), não a string `'variante'` da emenda 32 i | `'variante'`: a faixa A2 precisa do rótulo ("Trocando pela variante B…") e teria de adivinhar |
| D4 | Nome do campo derivado no `GET` | **`leitura`**, como o spec (emenda 47) e o aceite (I15, E6): objeto `{ title?, thumbnail? }` ou `null` | `restore_leitura`: mais claro ao lado de `restore_status`, mas diverge do spec e do roteiro do Gio. Fica na pergunta Q4 |
| D5 | `end_reason` no `GET` do ciclo | **Entra** em `CAMPOS_DO_CICLO` (o Cowork precisa saber por que o ciclo fechou; emenda 32 c o declara contrato) | Fora: o Cowork vê `ended_at` sem motivo |
| D6 | `em` do campo convertido em `interrompido` pelo vigia | **Mantém o `em` da reivindicação** (a faixa diz "Sem resposta desde [em]", que é o instante verdadeiro) | `em = now()`: a faixa mentiria o horário |
| D7 | Destino variante cujo arquivo responde 404 no Blob (não dá para escrever) | **`falhou`**, `erro: { motivo: 'arquivo_do_destino_indisponivel' }` | `pulado_*`: esconderia que o pedido do dono não foi feito |
| D8 | Linha 4 de 3.3 para thumbnail | Vale quando a `hqdefault` foi lida, o atual **não casa** com nenhum dHash conhecido **e** pelo menos um dHash de variante ficou incalculável. Se todos foram calculados e nenhum casa: linha 3 | — (é leitura do spec, declarada) |
| D9 | `maxDuration` das telas do A/B | `export const maxDuration = 60` em `ab-lab/[testId]/page.tsx` e `ab-lab/page.tsx` (a server action herda o da página); orçamento interno de `settleOnAir` 50 s, timeouts por chamada de 10 s | Sem isso, combo com YouTube lento passa do teto padrão e o cliente vê "Sem resposta" com o servidor morto em `em_andamento` |
| D10 | Variante `is_original` com `title_text` próprio | Entra no conjunto comparável (3.4); destino original continua `ab_tests.original_title` (3.1, pergunta 1) | — |
| D11 | Onde moram `resolveVideoChannel`/`resolveYouTubeVideoId` | **Movidos** para `lib/youtube/ab-video-context.ts` (exportados), usados por `actions.ts`, `settleOnAir` e o vigia | Duplicar: dois lugares para o texto "canal não identificado" |

## 4. Arquivos, por tarefa

Caminhos relativos a `apps/web/`; `AB/` = `src/app/cms/(authed)/youtube/ab-lab/`.

| Tarefa | Código | Testes |
|---|---|---|
| 0 base | (cherry-pick `dd9754ea5` se preciso) | linha de base |
| 1 migration | SQL no plano; `supabase/migrations/<ts>_ab_p4a_reivindicacao.sql` nasce no dia (Tarefa 18) | **novo** `test/integration/ab-p4a-reivindicacao.test.ts`, **novo** `test/integration/ab-restore-status-forma.test.ts` |
| 2 tipos e leitura | **novo** `src/lib/youtube/ab-restore.ts`; `src/types/database.types.ts` (blocos das funções novas; sai `rotate_cycle`) | **novo** `test/youtube/ab-restore-leitura.test.ts` |
| 3 erros e escrita de título | **novo** `src/lib/youtube/youtube-api-error.ts`; `src/lib/youtube/{ab-youtube,ab-metadata,ab-apply}.ts` | `test/ab-metadata.test.ts`, `test/youtube/{ab-apply,ab-apply-metadata}.test.ts`, **novo** `test/youtube/youtube-api-error.test.ts` |
| 4 dHash e cópia maior | `src/lib/youtube/thumb-fingerprint.ts` (exporta `biggerCopy`, recebe `hqdefaultLike`), `src/lib/youtube/portao-dhash/imagem.ts` (reexporta), **novo** `src/lib/youtube/ab-variant-dhash.ts`; `AB/actions.ts` (`preserveOriginalThumbnail`, `createAbTest`, `uploadVariant`, `pullPipelineThumbnails`, `batchStartTests`) | **novo** `test/youtube/ab-variant-dhash.test.ts`; `test/ab-actions-create.test.ts`; `test/youtube/portao-dhash/imagem.test.ts` |
| 5 decisão | **novo** `src/lib/youtube/ab-settle-decidir.ts` | **novo** `test/youtube/ab-settle-decidir.test.ts` |
| 6 `settleOnAir` | **novo** `src/lib/youtube/ab-settle.ts`, **novo** `src/lib/youtube/ab-video-context.ts`, **novo** `src/lib/youtube/ab-restore-avisos.ts` | **novo** `test/youtube/ab-settle.test.ts` |
| 7 chamadores humanos | `AB/actions.ts` (`pauseAbTest`, `endAbTest`, `revertWinner`; saem `applyWinnerNow`, `cancelGracePeriod`); `AB/_components/active-detail.tsx` (sai o banner de carência); `AB/[testId]/page.tsx`, `AB/page.tsx` (`maxDuration`) | `test/{ab-actions-pause,ab-actions-end,ab-actions-revert}.test.ts` (os que existirem com esses nomes; o executor confere por grep), **novo** `test/youtube/ab-p4a-chamadores.test.ts`, **novo** `test/integration/ab-p4a-concorrencia.test.ts` |
| 8 chamadores automáticos | `src/lib/youtube/{ab-rotate-phases,ab-evaluate-phases}.ts` | `test/api/cron/ab-rotate.test.ts`, `test/youtube/ab-evaluate-phases.test.ts`, `test/ab-cron-rotate.test.ts` |
| 9 rotação e forçar | `src/lib/youtube/ab-rotate-phases.ts`, **novo** `src/lib/youtube/ab-rotate-claim.ts`; `AB/actions.ts` (`forceRotate`) | **novo** `test/youtube/ab-rotate-reivindicacao.test.ts`; `test/ab-force-rotate.test.ts`, `test/ab-rotate-dispatch.test.ts` |
| 10 retomar, iniciar, fila | `AB/actions.ts` (`resumeAbTest`, `startAbTest`), `src/lib/youtube/ab-start.ts`, `ab-rotate-phases.ts` (`phaseProcessQueue`) | `test/ab-actions-resume.test.ts`, `test/ab-start-internal.test.ts`, **novo** `test/youtube/start-concorrente.test.ts` |
| 11 vigia | `src/app/api/cron/ab-watchdog/route.ts` (`:74-189` e uma linha na resposta), **novo** `src/lib/youtube/ab-watchdog-drift.ts`, **novo** `src/lib/util/em-paralelo.ts` | `test/ab-cron-watchdog.test.ts`, `test/ab-watchdog-drift.test.ts`, `test/cron/ab-watchdog-competitor-history.test.ts` (`chain`); rodar sem editar `test/observatorio/{lista-fechada-do-que-apaga,cache-writers}.test.ts` |
| 12 pipeline | `src/lib/pipeline/services/youtube.ts`, `data/pipeline-docs/cowork-docs-youtube.md` | `test/youtube/ab-pipeline-null-aviso.test.ts`, `test/mcp/mcp-schema-parity.test.ts` (snapshot só se pedir) |
| 13 remoção de canal | `src/app/cms/(authed)/youtube/_actions/channels.ts`, `src/lib/youtube/channel-registry.ts`, `youtube/_channels/channel-admin.tsx` | `test/youtube/channel-registry-actions.test.ts` |
| 14 faixa | **novo** `AB/_components/faixa-restauracao.tsx`, **novo** `AB/_components/faixa-restauracao-texto.ts`; `AB/[testId]/page.tsx`, `AB/queries.ts` (`restore_status` no detalhe), `src/lib/youtube/ab-types.ts` (`AbTestBaseView`) | **novo** `test/youtube/faixa-restauracao.test.tsx` |
| 15 diálogo | `AB/_components/ab-end-test-dialog.tsx` (reescrito), `ab-pause-dialog.tsx`, **novo** `AB/_components/ab-confirmar-troca-dialog.tsx` | **novo** `test/youtube/ab-end-test-dialog.test.tsx`; `e2e/ab-lab-p4a-*.spec.ts` (Gio) |
| 16 portão | `src/lib/youtube/portao-dhash/{executar,diario}.ts`, `scripts/portao-dhash.ts` | `test/youtube/portao-dhash/{executar,diario}.test.ts` |

**Lista inteira do A/B** (`/tmp/ab-p4a-lista.txt`), montada na Tarefa 0 e acrescida dos testes novos a cada
tarefa:

```bash
cd apps/web
{ find test -name '*ab-*' -o -path '*ab-lab*' ; ls test/youtube/portao-dhash/*.test.ts ;
  echo test/observatorio/lista-fechada-do-que-apaga.test.ts test/observatorio/cache-writers.test.ts \
       test/cron/ab-watchdog-competitor-history.test.ts test/youtube/channel-registry-actions.test.ts \
       test/mcp/mcp-schema-parity.test.ts ; } | tr ' ' '\n' | grep -E '\.test\.tsx?$' | sort -u > /tmp/ab-p4a-lista.txt
wc -l /tmp/ab-p4a-lista.txt
```

Ordem obrigatória: 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15; a 16 pode correr em
paralelo a partir da 4 (outra árvore não; mesmo lote, mas só toca `portao-dhash/`); 17 e 18 no fim.

---

## 5. As tarefas

Em todas: lista inteira do A/B com saída em arquivo
(`cd apps/web && npx vitest run $(cat /tmp/ab-p4a-lista.txt) > /tmp/ab-p4a-tN.log 2>&1; tail -30 /tmp/ab-p4a-tN.log`)
e `npx tsc --noEmit -p apps/web > /tmp/ab-p4a-tsc.log 2>&1; tail -20 /tmp/ab-p4a-tsc.log` **antes do `git commit`**.
Commit por lista de arquivos (`git add <lista> && git commit -m …`). Testes de integração
(`test/integration/`) com `describe.skipIf(skipIfNoLocalDb())` e rodados com
`HAS_LOCAL_DB=1 SUPABASE_URL=http://127.0.0.1:54421` contra o `bythiago_int` (o 54321 é do navegador).

**Trechos de teste são moldes**: os auxiliares (clientes falsos, sementes) têm de ser os que o arquivo já usa. O
que não muda é a lista de afirmações.

### Tarefa 0: árvore, linha de base e portões de produção

**Files:** nenhum de código (talvez o cherry-pick).

- [ ] Conferir a P3 em `origin/staging`: `git log origin/staging --oneline | grep -i 'P3' | head` e
  `git show origin/staging:apps/web/src/lib/youtube/ab-metadata.ts | grep -c description` (esperado: só a
  leitura/reenvio da descrição lida). Sem a P3: **pare** e devolva ao controlador (seção 0, tabela).
- [ ] Criar a árvore (seção 1), sem `.env.local`; `npm ci` e `npm run build:packages` em background com saída em arquivo.
- [ ] Migration 0 no remoto: `git show origin/staging:apps/web/src/types/database.types.ts | grep -c restore_status`.
  Se 0: `git cherry-pick dd9754ea5` na árvore (é o primeiro commit do lote; só inserções em `database.types.ts`
  e o arquivo da migration já aplicada).
- [ ] Montar `/tmp/ab-p4a-lista.txt` (seção 4) e rodar a linha de base. Tudo verde, senão pare.
- [ ] **M0-1, M0-2 e M0-3 (o dono cola; o Gio prepara `.superpowers/sdd/ab-lab/p4a-m0.sh`):**
  ```sql
  -- M0-1: a consulta de conferência de .superpowers/sdd/ab-lab/migration-0-forma.md (esperado 4, 5, 1, true, 0, 0)
  -- M0-2 (guarda D3; esperado 0 linhas)
  select id, status, completed_reason from ab_tests
   where (status <> 'completed' and grace_expires_at is not null and winner_applied_at is null)
      or (completed_reason = 'auto_resolve' and winner_variant_id is not null and winner_applied_at is null);
  -- M0-3 (nunca chamar a função; só privilégio)
  select r.rolname, has_function_privilege(r.rolname, 'public.rotate_cycle(uuid, uuid, integer, jsonb)', 'execute') as executa
    from pg_roles r where r.rolname in ('anon', 'authenticated', 'service_role', 'postgres');
  ```
  Resultado no ledger **antes** da Tarefa 1. M0-2 com linha: a P4a **não promove** até o dono decidir o teste.
- [ ] Ledger: linha "Tarefa 0" com o HEAD da árvore, as três saídas e a contagem da lista.

### Tarefa 1: a migration da P4a (SQL no plano, testada no `bythiago_int`)

**Files:**
- Create (só no dia, Tarefa 18): `supabase/migrations/<ts>_ab_p4a_reivindicacao.sql`
- Test: `test/integration/ab-p4a-reivindicacao.test.ts`, `test/integration/ab-restore-status-forma.test.ts`

**Interfaces:**
- Produz (SQL, `service_role` só):
  - `public.ab_settle_claim(p_test_id uuid, p_seq int, p_de text[], p_para text, p_end_reason text, p_restore_status jsonb, p_extra jsonb) returns table (claimed_seq int, stamped_at timestamptz)`
  - `public.ab_rotate_commit(p_test_id uuid, p_seq int, p_variant_id uuid, p_cycle_number int, p_applied_metadata jsonb, p_views int default null, p_likes int default null) returns uuid`
  - `rotate_cycle` deixa de existir.

- [ ] **Passo 1: o SQL** (copiar para `/tmp/ab-p4a.sql` e aplicar no `bythiago_int`; **não** criar arquivo no repo):

```sql
set lock_timeout = '5s';

-- 1) rotate_cycle sai (sem chamador; SECURITY DEFINER sem guarda; emenda 38)
drop function if exists public.rotate_cycle(uuid, uuid, integer, jsonb);

-- 2) Reivindicação dos sete caminhos de 3.1 (D1 do plano). Uma transação: estado, restore_status, fecho do ciclo.
create or replace function public.ab_settle_claim(
  p_test_id uuid,
  p_seq int,
  p_de text[],
  p_para text,
  p_end_reason text,
  p_restore_status jsonb,
  p_extra jsonb default '{}'::jsonb
) returns table (claimed_seq int, stamped_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := now();
  v_seq int;
  v_status_antes text;
begin
  select t.status into v_status_antes from ab_tests t where t.id = p_test_id for update;
  if not found then return; end if;

  update ab_tests t set
    status = p_para,
    restore_seq = t.restore_seq + 1,
    restore_status = p_restore_status,
    last_applied_variant_id = null,
    updated_at = v_now,
    paused_at = case when p_para = 'paused' and v_status_antes <> 'paused' then v_now else t.paused_at end,
    completed_at = case when p_para = 'completed' and v_status_antes <> 'completed' then v_now else t.completed_at end,
    status_note = case when p_extra ? 'status_note' then p_extra ->> 'status_note' else t.status_note end,
    completed_reason = case when p_extra ? 'completed_reason' then p_extra ->> 'completed_reason' else t.completed_reason end,
    winner_variant_id = case when p_extra ? 'winner_variant_id' then (p_extra ->> 'winner_variant_id')::uuid else t.winner_variant_id end,
    confidence_at_completion = case when (p_extra ->> 'limpar_confianca')::boolean then null else t.confidence_at_completion end,
    drift_acknowledged_at = case when (p_extra ->> 'limpar_drift_ack')::boolean then null else t.drift_acknowledged_at end,
    config = case when p_extra ? 'consecutive_failures'
                  then jsonb_set(coalesce(t.config, '{}'::jsonb), '{consecutive_failures}', p_extra -> 'consecutive_failures')
                  else t.config end
  where t.id = p_test_id and t.status = any (p_de) and t.restore_seq = p_seq
  returning t.restore_seq into v_seq;

  if v_seq is null then return; end if;

  if p_end_reason is not null then
    update ab_test_cycles c set ended_at = v_now, end_reason = p_end_reason
     where c.test_id = p_test_id and c.ended_at is null;
  end if;

  claimed_seq := v_seq; stamped_at := v_now;
  return next;
end $$;

revoke execute on function public.ab_settle_claim(uuid, int, text[], text, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.ab_settle_claim(uuid, int, text[], text, text, jsonb, jsonb) to service_role;

-- 3) Fecho da rotação (emenda 38; + p_views/p_likes e zera consecutive_failures: D2 do plano)
create or replace function public.ab_rotate_commit(
  p_test_id uuid,
  p_seq int,
  p_variant_id uuid,
  p_cycle_number int,
  p_applied_metadata jsonb,
  p_views int default null,
  p_likes int default null
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text; v_seq int; v_now timestamptz := now(); v_novo uuid;
begin
  select t.status, t.restore_seq into v_status, v_seq from ab_tests t where t.id = p_test_id for update;
  if not found or v_status <> 'active' or v_seq <> p_seq then return null; end if;

  update ab_test_cycles c set ended_at = v_now, end_reason = 'rotacao', views = p_views, likes = p_likes
   where c.test_id = p_test_id and c.ended_at is null;

  insert into ab_test_cycles (test_id, variant_id, cycle_number, started_at, applied_metadata)
  values (p_test_id, p_variant_id, p_cycle_number, v_now, p_applied_metadata)
  returning id into v_novo;

  update ab_tests t set last_applied_variant_id = null, updated_at = v_now,
    config = case when coalesce((t.config ->> 'consecutive_failures')::int, 0) <> 0
                  then jsonb_set(t.config, '{consecutive_failures}', '0'::jsonb) else t.config end
   where t.id = p_test_id;

  return v_novo;
end $$;

revoke execute on function public.ab_rotate_commit(uuid, int, uuid, int, jsonb, int, int) from public, anon, authenticated;
grant execute on function public.ab_rotate_commit(uuid, int, uuid, int, jsonb, int, int) to service_role;

comment on function public.ab_settle_claim(uuid, int, text[], text, text, jsonb, jsonb) is
  'A/B Lab P4a: reivindica um teste para settleOnAir (estado, restore_seq+1, restore_status em_andamento, fecho do ciclo com end_reason) numa transação. Zero linhas = outro escritor ganhou.';
comment on function public.ab_rotate_commit(uuid, int, uuid, int, jsonb, int, int) is
  'A/B Lab P4a: fecho da rotação depois da escrita no YouTube; só age com status active e restore_seq igual ao reivindicado; nulo = reivindicação perdida.';

reset lock_timeout;
```

  Conferir antes no `bythiago_int` os nomes reais das colunas usadas (`status_note`, `completed_reason`,
  `confidence_at_completion`, `drift_acknowledged_at`, `config`, `views`, `likes`):
  `select column_name from information_schema.columns where table_name in ('ab_tests','ab_test_cycles')`.
  Coluna com nome diferente: corrigir o SQL **aqui no plano** e anotar no ledger.

- [ ] **Passo 2: testes de integração que falham** (`test/integration/ab-p4a-reivindicacao.test.ts`), antes de
  aplicar o SQL:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { semearTesteAb, clienteServico, clienteAnon, clienteAutenticado } from '../helpers/db-seed'

describe.skipIf(skipIfNoLocalDb())('migration da P4a', () => {
  let t: { testId: string; varA: string; varB: string }
  beforeEach(async () => { t = await semearTesteAb({ status: 'active', cicloAberto: 0 }) })

  it('rotate_cycle não existe mais', async () => {
    const r = await sqlCru("select count(*)::int as n from pg_proc where proname = 'rotate_cycle'")
    expect(r[0].n).toBe(0)
  })

  it('anon e authenticated recebem permission denied (sem chamar como superusuário)', async () => {
    const a = await clienteAnon().rpc('ab_rotate_commit', { p_test_id: t.testId, p_seq: 0, p_variant_id: t.varB, p_cycle_number: 1, p_applied_metadata: {} })
    expect(a.error?.message).toMatch(/permission denied/)
    const u = await clienteAutenticado().rpc('ab_settle_claim', { p_test_id: t.testId, p_seq: 0, p_de: ['active'], p_para: 'paused', p_end_reason: 'pausa', p_restore_status: {}, p_extra: {} })
    expect(u.error?.message).toMatch(/permission denied/)
  })

  it('ab_rotate_commit com restore_seq trocado devolve nulo e não abre ciclo', async () => {
    const r = await clienteServico().rpc('ab_rotate_commit', { p_test_id: t.testId, p_seq: 99, p_variant_id: t.varB, p_cycle_number: 1, p_applied_metadata: {} })
    expect(r.data).toBeNull()
    const c = await clienteServico().from('ab_test_cycles').select('id').eq('test_id', t.testId)
    expect(c.data).toHaveLength(1)
  })

  it('ab_rotate_commit em teste completed devolve nulo (o buraco de rotate_cycle)', async () => {
    await clienteServico().from('ab_tests').update({ status: 'completed' }).eq('id', t.testId)
    const r = await clienteServico().rpc('ab_rotate_commit', { p_test_id: t.testId, p_seq: 0, p_variant_id: t.varB, p_cycle_number: 1, p_applied_metadata: {} })
    expect(r.data).toBeNull()
  })

  it('ab_rotate_commit certo: fecha com rotacao, grava views/likes, abre o seguinte, limpa marcador e falhas', async () => {
    await clienteServico().from('ab_tests').update({ last_applied_variant_id: t.varB, config: { consecutive_failures: 2 } }).eq('id', t.testId)
    const r = await clienteServico().rpc('ab_rotate_commit', { p_test_id: t.testId, p_seq: 0, p_variant_id: t.varB, p_cycle_number: 1, p_applied_metadata: {}, p_views: 10, p_likes: 1 })
    expect(r.data).toBeTruthy()
    const c = await clienteServico().from('ab_test_cycles').select('cycle_number, ended_at, end_reason, views').eq('test_id', t.testId).order('cycle_number')
    expect(c.data?.[0]).toMatchObject({ end_reason: 'rotacao', views: 10 })
    expect(c.data?.[1]).toMatchObject({ cycle_number: 1, ended_at: null })
    const x = await clienteServico().from('ab_tests').select('last_applied_variant_id, config').eq('id', t.testId).single()
    expect(x.data).toMatchObject({ last_applied_variant_id: null, config: { consecutive_failures: 0 } })
  })

  it('ab_settle_claim: muda estado, grava em_andamento, fecha ciclo com end_reason e ended_at = paused_at', async () => {
    const rs = { title: { estado: 'em_andamento', destino: 'original', forcado: false, escreveu: null, erro: null, em: new Date().toISOString(), attempts: 0 } }
    const r = await clienteServico().rpc('ab_settle_claim', { p_test_id: t.testId, p_seq: 0, p_de: ['active'], p_para: 'paused', p_end_reason: 'pausa', p_restore_status: rs, p_extra: { status_note: null } })
    expect(r.data?.[0]?.claimed_seq).toBe(1)
    const x = await clienteServico().from('ab_tests').select('status, paused_at, restore_seq, restore_status').eq('id', t.testId).single()
    const c = await clienteServico().from('ab_test_cycles').select('ended_at, end_reason').eq('test_id', t.testId).single()
    expect(x.data).toMatchObject({ status: 'paused', restore_seq: 1 })
    expect(c.data?.end_reason).toBe('pausa')
    expect(new Date(c.data!.ended_at!).getTime()).toBe(new Date(x.data!.paused_at!).getTime())
  })

  it('ab_settle_claim com seq velho ou estado fora de p_de: zero linhas, nada muda', async () => {
    const r1 = await clienteServico().rpc('ab_settle_claim', { p_test_id: t.testId, p_seq: 7, p_de: ['active'], p_para: 'paused', p_end_reason: 'pausa', p_restore_status: {}, p_extra: {} })
    const r2 = await clienteServico().rpc('ab_settle_claim', { p_test_id: t.testId, p_seq: 0, p_de: ['paused'], p_para: 'completed', p_end_reason: 'encerrado', p_restore_status: {}, p_extra: {} })
    expect(r1.data).toEqual([]); expect(r2.data).toEqual([])
    const x = await clienteServico().from('ab_tests').select('status, restore_seq').eq('id', t.testId).single()
    expect(x.data).toMatchObject({ status: 'active', restore_seq: 0 })
  })

  it('de = para (reverter, vigia): p_end_reason nulo não fecha ciclo', async () => {
    await clienteServico().from('ab_tests').update({ status: 'completed' }).eq('id', t.testId)
    await clienteServico().rpc('ab_settle_claim', { p_test_id: t.testId, p_seq: 0, p_de: ['completed'], p_para: 'completed', p_end_reason: null, p_restore_status: {}, p_extra: {} })
    const c = await clienteServico().from('ab_test_cycles').select('ended_at').eq('test_id', t.testId).single()
    expect(c.data?.ended_at).toBeNull()
  })
})
```

  O primeiro caso: trocar a consulta a `pg_proc` pelo auxiliar que o `db-seed` já tiver para SQL cru (ex.:
  `sqlCru("select count(*) from pg_proc where proname = 'rotate_cycle'")`); **nunca** chamar `rotate_cycle`
  como `anon` (derruba o Postgres local, regra do ledger). Se `semearTesteAb`, `clienteAnon` e
  `clienteAutenticado` não existirem em `test/helpers/db-seed.ts`, criá-los ali (semente com site, vídeo, duas
  variantes A original e B, ciclo 0 aberto; clientes com as chaves locais).

- [ ] **Passo 3: os 7 casos do CHECK (32 g) e o histórico (32 f)** em `test/integration/ab-restore-status-forma.test.ts`:

```ts
describe.skipIf(skipIfNoLocalDb())('CHECK ab_tests_restore_status_shape e histórico', () => {
  const ok = { estado: 'ok', destino: 'original', forcado: false, escreveu: true, erro: null, em: '2026-10-12T08:02:00Z', attempts: 0 }
  const casos: Array<[string, Record<string, unknown>]> = [
    ['sem estado', { ...ok, estado: undefined }],
    ['sem forcado', { ...ok, forcado: undefined }],
    ['sem attempts', { ...ok, attempts: undefined }],
    ['em_andamento sem forcado e attempts', { estado: 'em_andamento', destino: 'original', em: ok.em }],
    ['attempts 1.5', { ...ok, attempts: 1.5 }],
    ['attempts 3000000000', { ...ok, attempts: 3000000000 }],
    ['em "agora"', { ...ok, em: 'agora' }],
    ['escreveu "sim"', { ...ok, escreveu: 'sim' }],
    ['destino objeto', { ...ok, destino: { id: 'x' } }],
  ]
  it.each(casos)('%s falha no CHECK com o nome da constraint', async (_n, campo) => {
    const t = await semearTesteAb({ status: 'paused' })
    const r = await clienteServico().from('ab_tests').update({ restore_status: { title: JSON.parse(JSON.stringify(campo)) } }).eq('id', t.testId)
    expect(r.error?.message).toMatch(/ab_tests_restore_status_shape/)
  })

  it('o passo 4 não incrementa restore_seq; regravar o mesmo seq substitui a linha do histórico', async () => {
    const t = await semearTesteAb({ status: 'paused' })
    await clienteServico().from('ab_tests').update({ restore_seq: 1, restore_status: { title: { ...ok, estado: 'falhou', escreveu: false, erro: { status: 403, reason: 'forbidden' } } } }).eq('id', t.testId)
    const g1 = (await clienteServico().from('ab_test_restores').select('gravado_em').eq('test_id', t.testId).single()).data!.gravado_em
    await clienteServico().from('ab_tests').update({ restore_status: { title: ok } }).eq('id', t.testId)
    const linhas = (await clienteServico().from('ab_test_restores').select('seq, estado, gravado_em').eq('test_id', t.testId)).data!
    expect(linhas).toHaveLength(1)
    expect(linhas[0]).toMatchObject({ seq: 1, estado: 'ok' })
    expect(linhas[0].gravado_em).not.toBe(g1)
    const x = (await clienteServico().from('ab_tests').select('restore_seq').eq('id', t.testId).single()).data!
    expect(x.restore_seq).toBe(1)
  })

  it('erro de 10 000 caracteres: o escritor trunca antes (o CHECK não tem teto)', async () => {
    // a garantia é de código (truncarErro, Tarefa 2); aqui só se prova que o banco aceitaria e por isso o teto é do código
    const t = await semearTesteAb({ status: 'paused' })
    const r = await clienteServico().from('ab_tests').update({ restore_status: { title: { ...ok, estado: 'falhou', erro: 'x'.repeat(10_000) } } }).eq('id', t.testId)
    expect(r.error).toBeNull()
  })

  it('só select para authenticated e service_role em ab_test_restores (sem chamar)', async () => {
    const r = await sqlCru(`select has_table_privilege('authenticated','public.ab_test_restores','insert') as ins,
                                   has_table_privilege('authenticated','public.ab_test_restores','select') as sel,
                                   has_table_privilege('anon','public.ab_test_restores','select') as anon_sel`)
    expect(r[0]).toEqual({ ins: false, sel: true, anon_sel: false })
  })
})
```

- [ ] **Passo 4:** rodar os dois arquivos contra o `bythiago_int` **sem** o SQL (esperado: falham os casos da
  migration da P4a; os do CHECK já passam, a Migration 0 está lá). Aplicar `/tmp/ab-p4a.sql` com `psql
  "postgresql://postgres:postgres@127.0.0.1:54422/postgres" -f /tmp/ab-p4a.sql`, **duas vezes** (idempotência:
  a segunda só dá NOTICE). Rodar de novo: tudo verde. Saída no ledger (é a M0-4).
- [ ] **Passo 5: commit dos testes** (sem a migration; ela nasce no dia, Tarefa 18):
  `git add test/integration/ab-p4a-reivindicacao.test.ts test/integration/ab-restore-status-forma.test.ts test/helpers/db-seed.ts && git commit -m "test: A/B P4a: integração da reivindicação, do fecho da rotação e da forma do restore_status"`.
  A CI não tem banco local: os dois ficam pulados lá, como os outros de integração.

### Tarefa 2: tipos, leitura derivada e tipos do banco

**Files:**
- Create: `src/lib/youtube/ab-restore.ts`
- Modify: `src/types/database.types.ts` (inserir os blocos de `ab_settle_claim` e `ab_rotate_commit`; remover o de `rotate_cycle`)
- Test: `test/youtube/ab-restore-leitura.test.ts`

**Interfaces:**
- Produz:
```ts
export type CampoNome = 'title' | 'thumbnail'
export type EstadoCampo = 'em_andamento' | 'ok' | 'falhou' | 'pulado_sem_original' | 'pulado_drift' | 'desistiu'
export type ErroGravado = string | { status: number; reason: string } | { motivo: string } | null
export interface CampoRestauracao {
  estado: EstadoCampo
  destino: string            // 'original' ou o id da variante
  em: string                 // ISO
  forcado: boolean
  escreveu: boolean | null
  motivo?: string | null     // 'sem_base_de_comparacao' | 'video_inexistente' | 'novo_teste'
  erro: ErroGravado
  attempts: number
}
export type RestoreStatus = Partial<Record<CampoNome, CampoRestauracao>>
export const SEM_RESPOSTA_MIN = 5
export const INTERROMPIDO_MIN = 15
export type LeituraCampo =
  | { tipo: 'em_andamento'; desde: string; destino: string }
  | { tipo: 'sem_resposta'; desde: string; destino: string; interrompido: boolean }
  | { tipo: 'final'; estado: Exclude<EstadoCampo, 'em_andamento'>; em: string; destino: string; forcado: boolean; motivo: string | null }
export function lerCampoDeRestauracao(campo: CampoRestauracao, agora: Date): LeituraCampo
export function lerRestauracao(rs: RestoreStatus | null, agora: Date): Partial<Record<CampoNome, LeituraCampo>> | null
export function camposDoTeste(testType: 'thumbnail' | 'title' | 'combo'): CampoNome[]
export function truncarErro(e: ErroGravado): ErroGravado     // string > 500 → 500; objeto mantém só status/reason/motivo
export function paraRestoreStatus(v: unknown): RestoreStatus | null  // lê o jsonb do banco com validação (zod)
```

- [ ] **Passo 1: testes que falham** (`test/youtube/ab-restore-leitura.test.ts`, relógio injetado; P4a-I5):

```ts
import { describe, it, expect } from 'vitest'
import { lerCampoDeRestauracao, lerRestauracao, truncarErro, paraRestoreStatus, camposDoTeste, SEM_RESPOSTA_MIN } from '@/lib/youtube/ab-restore'

const base = { destino: 'original', forcado: false, escreveu: null, erro: null, attempts: 0 }
const agora = new Date('2026-10-12T08:10:00Z')
const minutosAtras = (m: number) => new Date(agora.getTime() - m * 60_000).toISOString()

describe('lerCampoDeRestauracao', () => {
  it('4 min: em andamento', () => {
    expect(lerCampoDeRestauracao({ ...base, estado: 'em_andamento', em: minutosAtras(4) }, agora).tipo).toBe('em_andamento')
  })
  it('5:00 exato: ainda em andamento (a emenda diz "mais de 5 min")', () => {
    expect(SEM_RESPOSTA_MIN).toBe(5)
    expect(lerCampoDeRestauracao({ ...base, estado: 'em_andamento', em: minutosAtras(5) }, agora).tipo).toBe('em_andamento')
  })
  it('5:01: sem resposta, não interrompido', () => {
    const l = lerCampoDeRestauracao({ ...base, estado: 'em_andamento', em: new Date(agora.getTime() - 301_000).toISOString() }, agora)
    expect(l).toMatchObject({ tipo: 'sem_resposta', interrompido: false })
  })
  it('16 min: sem resposta, interrompido (a leitura não muda o estado gravado)', () => {
    const campo = { ...base, estado: 'em_andamento' as const, em: minutosAtras(16) }
    expect(lerCampoDeRestauracao(campo, agora)).toMatchObject({ tipo: 'sem_resposta', interrompido: true })
    expect(campo.estado).toBe('em_andamento')
  })
  it('em no futuro (relógio adiantado): em andamento, nunca negativo', () => {
    expect(lerCampoDeRestauracao({ ...base, estado: 'em_andamento', em: '2026-10-12T09:00:00Z' }, agora).tipo).toBe('em_andamento')
  })
  it('em ilegível: sem resposta, nunca NaN', () => {
    const l = lerCampoDeRestauracao({ ...base, estado: 'em_andamento', em: 'lixo' }, agora)
    expect(l.tipo).toBe('sem_resposta')
    expect(JSON.stringify(l)).not.toMatch(/NaN|Invalid/)
  })
  it('falhou com erro interrompido é lido como sem resposta', () => {
    expect(lerCampoDeRestauracao({ ...base, estado: 'falhou', erro: 'interrompido', em: minutosAtras(30) }, agora)).toMatchObject({ tipo: 'sem_resposta', interrompido: true })
  })
  it('ok, falhou, pulados e desistiu: final', () => {
    for (const estado of ['ok', 'falhou', 'pulado_drift', 'pulado_sem_original', 'desistiu'] as const)
      expect(lerCampoDeRestauracao({ ...base, estado, em: minutosAtras(1) }, agora).tipo).toBe('final')
  })
})

describe('lerRestauracao', () => {
  it('nulo (mundo antigo) → null; {} → {}', () => {
    expect(lerRestauracao(null, agora)).toBeNull()
    expect(lerRestauracao({}, agora)).toEqual({})
  })
})

describe('truncarErro e paraRestoreStatus', () => {
  it('string de 10 000 vira 500', () => { expect((truncarErro('x'.repeat(10_000)) as string).length).toBe(500) })
  it('objeto do YouTube guarda só status e reason', () => {
    expect(truncarErro({ status: 403, reason: 'forbidden', corpo: 'segredo' } as never)).toEqual({ status: 403, reason: 'forbidden' })
  })
  it('jsonb malformado → null, sem lançar', () => { expect(paraRestoreStatus({ title: { estado: 'x' } })).toBeNull() })
  it('camposDoTeste', () => {
    expect(camposDoTeste('combo')).toEqual(['title', 'thumbnail'])
    expect(camposDoTeste('thumbnail')).toEqual(['thumbnail'])
    expect(camposDoTeste('title')).toEqual(['title'])
  })
})
```

- [ ] **Passo 2:** rodar; falha com "Cannot find module".
- [ ] **Passo 3: implementação** (`src/lib/youtube/ab-restore.ts`):

```ts
import { z } from 'zod'

export type CampoNome = 'title' | 'thumbnail'
export type EstadoCampo = 'em_andamento' | 'ok' | 'falhou' | 'pulado_sem_original' | 'pulado_drift' | 'desistiu'
export type ErroGravado = string | { status: number; reason: string } | { motivo: string } | null
export interface CampoRestauracao {
  estado: EstadoCampo; destino: string; em: string; forcado: boolean; escreveu: boolean | null
  motivo?: string | null; erro: ErroGravado; attempts: number
}
export type RestoreStatus = Partial<Record<CampoNome, CampoRestauracao>>

export const SEM_RESPOSTA_MIN = 5
export const INTERROMPIDO_MIN = 15
const ERRO_MAX = 500

export type LeituraCampo =
  | { tipo: 'em_andamento'; desde: string; destino: string }
  | { tipo: 'sem_resposta'; desde: string; destino: string; interrompido: boolean }
  | { tipo: 'final'; estado: Exclude<EstadoCampo, 'em_andamento'>; em: string; destino: string; forcado: boolean; motivo: string | null }

export function lerCampoDeRestauracao(campo: CampoRestauracao, agora: Date): LeituraCampo {
  const t = Date.parse(campo.em)
  const idadeMin = Number.isFinite(t) ? (agora.getTime() - t) / 60_000 : Number.POSITIVE_INFINITY
  if (campo.estado === 'falhou' && campo.erro === 'interrompido')
    return { tipo: 'sem_resposta', desde: campo.em, destino: campo.destino, interrompido: true }
  if (campo.estado === 'em_andamento') {
    if (idadeMin <= SEM_RESPOSTA_MIN) return { tipo: 'em_andamento', desde: campo.em, destino: campo.destino }
    return { tipo: 'sem_resposta', desde: campo.em, destino: campo.destino, interrompido: idadeMin > INTERROMPIDO_MIN }
  }
  return { tipo: 'final', estado: campo.estado, em: campo.em, destino: campo.destino, forcado: campo.forcado, motivo: campo.motivo ?? null }
}

export function lerRestauracao(rs: RestoreStatus | null, agora: Date): Partial<Record<CampoNome, LeituraCampo>> | null {
  if (rs === null) return null
  const out: Partial<Record<CampoNome, LeituraCampo>> = {}
  for (const k of ['title', 'thumbnail'] as const) { const c = rs[k]; if (c) out[k] = lerCampoDeRestauracao(c, agora) }
  return out
}

export function camposDoTeste(testType: 'thumbnail' | 'title' | 'combo'): CampoNome[] {
  return testType === 'combo' ? ['title', 'thumbnail'] : [testType]
}

export function truncarErro(e: ErroGravado): ErroGravado {
  if (e === null) return null
  if (typeof e === 'string') return e.slice(0, ERRO_MAX)
  if ('status' in e) return { status: e.status, reason: String(e.reason).slice(0, 100) }
  return { motivo: String(e.motivo).slice(0, 100) }
}

const Campo = z.object({
  estado: z.enum(['em_andamento', 'ok', 'falhou', 'pulado_sem_original', 'pulado_drift', 'desistiu']),
  destino: z.string().min(1),
  em: z.string(),
  forcado: z.boolean(),
  escreveu: z.boolean().nullable().optional().transform(v => v ?? null),
  motivo: z.string().nullable().optional(),
  erro: z.union([z.string(), z.object({ status: z.number(), reason: z.string() }), z.object({ motivo: z.string() }), z.null()]).optional().transform(v => v ?? null),
  attempts: z.number().int().min(0),
})
const Rs = z.object({ title: Campo.optional(), thumbnail: Campo.optional() })

export function paraRestoreStatus(v: unknown): RestoreStatus | null {
  if (v === null || v === undefined) return null
  const r = Rs.safeParse(v)
  return r.success ? r.data : null
}
```

  Nota: `paraRestoreStatus` com jsonb malformado devolve `null`, que a faixa trata como "sem faixa". O CHECK
  impede jsonb malformado no banco; o `null` aqui é defesa, e o `Sentry.captureMessage('restore_status
  ilegível', { testId })` fica no chamador (Tarefa 14).

- [ ] **Passo 4: tipos do banco.** Gerar os tipos do `bythiago_int` num arquivo temporário
  (`npx supabase gen types typescript --db-url postgresql://postgres:postgres@127.0.0.1:54422/postgres > /tmp/tipos-p4a.ts`)
  e copiar para `database.types.ts` **só** os blocos `ab_settle_claim` e `ab_rotate_commit` (em `Functions`,
  ordem alfabética) e **remover** o bloco `rotate_cycle`. `git diff --stat src/types/database.types.ts`: só
  essas mudanças.
- [ ] **Passo 5:** testes verdes, lista inteira, `tsc`; commit:
  `git commit -m "feat: A/B P4a: forma do restore_status, leitura derivada (5 e 15 min) e tipos das funções novas"`.

### Tarefa 3: `YouTubeApiError` e a escrita de título com idioma

**Files:**
- Create: `src/lib/youtube/youtube-api-error.ts`
- Modify: `src/lib/youtube/ab-youtube.ts` (`setThumbnail`, `fetchVariantImageBuffer`), `src/lib/youtube/ab-metadata.ts`, `src/lib/youtube/ab-apply.ts`
- Test: `test/youtube/youtube-api-error.test.ts`, `test/ab-metadata.test.ts`, `test/youtube/ab-apply.test.ts`, `test/youtube/ab-apply-metadata.test.ts`

**Interfaces:**
- Produz:
```ts
// youtube-api-error.ts
export class YouTubeApiError extends Error {
  constructor(readonly status: number, readonly reason: string, readonly chamada: 'videos.list' | 'videos.update' | 'thumbnails.set' | 'blob')
}
export async function erroDaResposta(res: Response, chamada: YouTubeApiError['chamada']): Promise<YouTubeApiError>
export function erroDeRede(e: unknown, chamada: YouTubeApiError['chamada']): YouTubeApiError // timeout → status 0, reason 'timeout'; rede → 0, 'rede'
export function paraErroGravado(e: unknown): ErroGravado  // YouTubeApiError → {status, reason}; outro → {motivo: 'erro_interno'}
export const conta_para_falhas = (e: YouTubeApiError) => e.reason !== 'quotaExceeded'

// ab-metadata.ts
export interface SnippetLido { title: string; description: string; categoryId: string; tags: string[]; defaultLanguage?: string; defaultAudioLanguage?: string }
export async function lerSnippet(videoId: string, accessToken: string, f?: typeof fetch): Promise<SnippetLido | null> // null = o vídeo não veio (linha 7)
export async function escreverTitulo(videoId: string, titulo: string, accessToken: string, f?: typeof fetch): Promise<void>
// updateVideoMetadata(videoId, title, accessToken) passa a chamar escreverTitulo (nome mantido: os vi.mock existentes)
```
- `setThumbnail` lança `YouTubeApiError(status, reason, 'thumbnails.set')`; `fetchVariantImageBuffer` lança
  `YouTubeApiError(status, 'blob_' + status, 'blob')` (404 → `reason 'blob_404'`, usado na linha 4 e no D7).
- `ApplyResult.error` passa a `ErroGravado` e ganha `erroApi?: YouTubeApiError` (a rotação lê `status`/`reason`).

**Cota de cada chamada (vale para o plano todo):** `videos.list part=snippet` = 1; `videos.update part=snippet`
= 50; `thumbnails.set` = 50; `channels.list` (preflight) = 1; `hqdefault` pública e Blob = 0.

- [ ] **Passo 1: testes que falham.**

```ts
// test/youtube/youtube-api-error.test.ts
it('lê reason de error.errors[0].reason', async () => {
  const res = new Response(JSON.stringify({ error: { code: 403, errors: [{ reason: 'quotaExceeded', message: 'segredo' }] } }), { status: 403 })
  const e = await erroDaResposta(res, 'videos.update')
  expect(e).toMatchObject({ status: 403, reason: 'quotaExceeded', chamada: 'videos.update' })
  expect(JSON.stringify(paraErroGravado(e))).not.toMatch(/segredo/)
})
it('corpo ilegível → reason "desconhecido"', async () => {
  expect((await erroDaResposta(new Response('<html>', { status: 502 }), 'videos.list')).reason).toBe('desconhecido')
})
it('timeout → status 0, reason timeout', () => {
  expect(erroDeRede(new DOMException('x', 'TimeoutError'), 'videos.update')).toMatchObject({ status: 0, reason: 'timeout' })
})

// test/ab-metadata.test.ts (acrescentar)
it('escreverTitulo relê o snippet e reenvia descrição, categoria, tags e os dois idiomas lidos', async () => {
  const chamadas: Array<{ url: string; init?: RequestInit }> = []
  const f = (async (url: string, init?: RequestInit) => {
    chamadas.push({ url, init })
    if (!init?.method) return new Response(JSON.stringify({ items: [{ snippet: { title: 'Velho', description: 'Desc\ncom link https://x', categoryId: '19', tags: ['a'], defaultLanguage: 'pt-BR', defaultAudioLanguage: 'pt' } }] }))
    return new Response('{}')
  }) as typeof fetch
  await escreverTitulo('vid', 'Novo', 'tok', f)
  const corpo = JSON.parse(String(chamadas[1].init!.body))
  expect(corpo.snippet).toEqual({ title: 'Novo', description: 'Desc\ncom link https://x', categoryId: '19', tags: ['a'], defaultLanguage: 'pt-BR', defaultAudioLanguage: 'pt' })
})
it('snippet sem description aborta antes do PUT (Review Focus 2)', async () => {
  let puts = 0
  const f = (async (_u: string, init?: RequestInit) => {
    if (init?.method === 'PUT') { puts++; return new Response('{}') }
    return new Response(JSON.stringify({ items: [{ snippet: { title: 'V', categoryId: '19' } }] }))
  }) as typeof fetch
  await expect(escreverTitulo('vid', 'Novo', 'tok', f)).rejects.toMatchObject({ reason: 'snippet_sem_descricao' })
  expect(puts).toBe(0)
})
it('sem idioma lido: o PUT não inventa idioma', async () => { /* snippet sem defaultLanguage → corpo sem a chave */ })
it('videos.list sem o vídeo → lerSnippet devolve null', async () => {
  const f = (async () => new Response(JSON.stringify({ items: [] }))) as typeof fetch
  expect(await lerSnippet('vid', 'tok', f)).toBeNull()
})
it('PUT 403 lança YouTubeApiError com reason', async () => { /* … rejects.toMatchObject({ status: 403, reason: 'forbidden' }) */ })
```

  `escreverTitulo` com título vazio ou só espaços: **lança** `YouTubeApiError(0, 'titulo_vazio', 'videos.update')`
  sem chamar o YouTube (P4a-I20: nunca `""` gravado). Teste junto.

- [ ] **Passo 2:** rodar; falham.
- [ ] **Passo 3: implementação.** `youtube-api-error.ts`:

```ts
import type { ErroGravado } from '@/lib/youtube/ab-restore'

export class YouTubeApiError extends Error {
  constructor(readonly status: number, readonly reason: string, readonly chamada: 'videos.list' | 'videos.update' | 'thumbnails.set' | 'blob') {
    super(`${chamada} ${status} ${reason}`)
    this.name = 'YouTubeApiError'
  }
}

export async function erroDaResposta(res: Response, chamada: YouTubeApiError['chamada']): Promise<YouTubeApiError> {
  let reason = 'desconhecido'
  try {
    const j: unknown = await res.json()
    const r = (j as { error?: { errors?: Array<{ reason?: unknown }> } })?.error?.errors?.[0]?.reason
    if (typeof r === 'string' && r.length > 0) reason = r.slice(0, 100)
  } catch { /* corpo não JSON */ }
  return new YouTubeApiError(res.status, reason, chamada)
}

export function erroDeRede(e: unknown, chamada: YouTubeApiError['chamada']): YouTubeApiError {
  const nome = e instanceof Error || e instanceof DOMException ? e.name : ''
  return new YouTubeApiError(0, nome === 'TimeoutError' || nome === 'AbortError' ? 'timeout' : 'rede', chamada)
}

export function paraErroGravado(e: unknown): ErroGravado {
  if (e instanceof YouTubeApiError) return { status: e.status, reason: e.reason }
  return { motivo: 'erro_interno' }
}

export const contaParaFalhas = (e: YouTubeApiError): boolean => e.reason !== 'quotaExceeded'
```

  `ab-metadata.ts`: `lerSnippet` (GET `videos?part=snippet&id=`, timeout 10 s; `!ok` → `erroDaResposta`;
  `items` vazio → `null`), `escreverTitulo` (valida título não vazio; `lerSnippet`; `null` →
  `YouTubeApiError(404, 'video_inexistente', 'videos.list')`; `typeof snippet.description !== 'string'` →
  `YouTubeApiError(0, 'snippet_sem_descricao', 'videos.update')`; `PUT` com `title` novo e os campos lidos,
  incluindo `defaultLanguage`/`defaultAudioLanguage` **só se vieram**; timeout 10 s; erro de rede no `PUT` →
  `erroDeRede`). `updateVideoMetadata(videoId, title, accessToken)` = `escreverTitulo` (nome mantido).
  `setThumbnail` e `fetchVariantImageBuffer` passam a lançar `YouTubeApiError` (sem `Sentry.captureException`
  com o corpo: o `extra` leva só `status` e `reason`). `ab-apply.ts`: o `catch` guarda `erroApi` e
  `error: paraErroGravado(e)`.
- [ ] **Passo 4:** os testes antigos que afirmam a mensagem `"videos.update failed: 403"` ou
  `"thumbnails.set failed"` passam a afirmar `toMatchObject({ status, reason })`. Lista do dia:
  `grep -rln "failed: [0-9]\|Failed to fetch variant image" test`.
- [ ] **Passo 5:** lista inteira, `tsc`, commit:
  `git commit -m "feat: A/B P4a: YouTubeApiError com status e reason; escrita de título relê e reenvia os dois idiomas e aborta sem descrição"`.

### Tarefa 4: dHash da variante onde ela nasce e cópia maior da original

**Files:**
- Modify: `src/lib/youtube/thumb-fingerprint.ts` (exporta `biggerCopy`; recebe `hqdefaultLike` de `portao-dhash/imagem.ts`), `src/lib/youtube/portao-dhash/imagem.ts` (reexporta de `thumb-fingerprint`)
- Create: `src/lib/youtube/ab-variant-dhash.ts`
- Modify: `AB/actions.ts` (`preserveOriginalThumbnail`, `createAbTest`, `uploadVariant`, `pullPipelineThumbnails`, `batchStartTests`)
- Test: `test/youtube/ab-variant-dhash.test.ts`, `test/ab-actions-create.test.ts`, `test/youtube/portao-dhash/imagem.test.ts`

**Interfaces:**
- Produz:
```ts
// thumb-fingerprint.ts
export async function hqdefaultLike(bytes: Buffer): Promise<Buffer>   // sharp resize 480x360 contain #000
export async function biggerCopy(probeUrl: string, f?: typeof fetch): Promise<Buffer | null>
// ab-variant-dhash.ts
export type DhashDaVariante = { tipo: 'ok'; dhash: string } | { tipo: 'sem_base'; motivo: 'blob_404' | 'ilegivel' | 'sem_blob_url' } | { tipo: 'falha'; erro: YouTubeApiError }
export async function dhashDoArquivo(blobUrl: string | null, f?: typeof fetch): Promise<DhashDaVariante>
export async function dhashDasVariantes(supabase: SupabaseClient, variantes: Array<{ id: string; blob_url: string | null; thumbnail_dhash: string | null }>, f?: typeof fetch): Promise<Map<string, DhashDaVariante>>  // calcula os nulos e grava (update ... where thumbnail_dhash is null)
export async function guardarOriginalMaior(youtubeId: string, testOuVideoUuid: string, f?: typeof fetch): Promise<{ url: string; dhash: string; largura: number; altura: number }>
```

- [ ] **Passo 1: testes que falham.**

```ts
// test/youtube/ab-variant-dhash.test.ts
it('arquivo 1280x720 vira dHash da hqdefaultLike (com faixas)', async () => {
  const png = await sharp({ create: { width: 1280, height: 720, channels: 3, background: '#c33' } }).png().toBuffer()
  const f = (async () => new Response(png, { headers: { 'content-type': 'image/png' } })) as typeof fetch
  const r = await dhashDoArquivo('https://x.public.blob.vercel-storage.com/a.png', f)
  expect(r).toEqual({ tipo: 'ok', dhash: await dhashOf(await hqdefaultLike(png)) })
})
it('Blob 404 → sem_base blob_404 (linha 4)', async () => {
  const f = (async () => new Response('', { status: 404 })) as typeof fetch
  expect(await dhashDoArquivo('https://x.public.blob.vercel-storage.com/a.png', f)).toEqual({ tipo: 'sem_base', motivo: 'blob_404' })
})
it('Blob 503 ou rede → falha (linha 5)', async () => { /* status 503 → { tipo: 'falha' } ; fetch que lança → { tipo: 'falha' } */ })
it('bytes que o sharp não lê → sem_base ilegivel', async () => { /* Response('não é imagem') → { tipo:'sem_base', motivo:'ilegivel' } */ })
it('blob_url nulo → sem_base sem_blob_url, sem fetch', async () => { /* f nunca chamado */ })
it('dhashDasVariantes calcula só os nulos e grava com where thumbnail_dhash is null', async () => { /* supabase falso registra o update */ })

// test/ab-actions-create.test.ts (acrescentar)
it('createAbTest guarda a maior cópia (maxres) e grava dimensions e thumbnail_dhash da original', async () => { /* fetch falso: maxres 200 → put recebe os bytes de maxres; insert da variante original com dimensions {width:1280,height:720} e thumbnail_dhash de 16 hex */ })
it('sem maxres nem sd: guarda a hqdefault e dimensions 480x360 (o diálogo avisará baixa resolução)', async () => { /* … */ })
it('uploadVariant e pullPipelineThumbnails gravam thumbnail_dhash; falha do dHash não impede o envio (fica nulo e é calculado na hora)', async () => { /* … */ })
```

- [ ] **Passo 2:** rodar; falham.
- [ ] **Passo 3: implementação.** Mover `hqdefaultLike` para `thumb-fingerprint.ts` (corpo igual ao de
  `imagem.ts:31-34`) e fazer `imagem.ts` reexportar (`export { hqdefaultLike } from '@/lib/youtube/thumb-fingerprint'`),
  para a direção da dependência ser script → lib. Exportar `biggerCopy` sem mudar o corpo.
  `dhashDoArquivo`: allowlist de `fetchVariantImageBuffer` (reusar a função; 404 → `sem_base blob_404`; outro
  `!ok` ou exceção de rede → `falha`); `sharp` que lança → `sem_base ilegivel`.
  `guardarOriginalMaior(youtubeId, uuid)`: `biggerCopy(thumbUrl(youtubeId))` ou, se nulo, a `hqdefault`
  (`probeThumb(youtubeId, null).bytes`); sem nenhuma → lança `Error('thumbnail original indisponível')` (o
  `createAbTest` de hoje também falha nesse caso); `put('ab-originals/<uuid>.jpg', bytes, { addRandomSuffix: true })`;
  dimensões por `sharp(bytes).metadata()`; dHash por `dhashOf(await hqdefaultLike(bytes))`.
  `preserveOriginalThumbnail` passa a usar `guardarOriginalMaior`; `createAbTest` e `batchStartTests` gravam na
  variante `is_original`: `blob_url`, `thumbnail_dhash`, `dimensions`; `uploadVariant` e
  `pullPipelineThumbnails` gravam `thumbnail_dhash` (melhor esforço: erro do cálculo → nulo + Sentry, nunca
  bloqueia o envio da imagem).
- [ ] **Passo 4:** lista inteira (inclui `portao-dhash/*`), `tsc`, commit:
  `git commit -m "feat: A/B P4a: dHash da variante onde ela nasce e cópia da original na maior resolução"`.

### Tarefa 5: a decisão por campo (`decidirCampo`, pura)

**Files:**
- Create: `src/lib/youtube/ab-settle-decidir.ts`
- Test: `test/youtube/ab-settle-decidir.test.ts`

**Interfaces:**
- Produz:
```ts
export type Decisao =
  | { acao: 'ok_sem_escrever' }                                   // linha 1
  | { acao: 'escrever' }                                          // linha 2, ou 3/4 com forcar, ou exceções da linha 1
  | { acao: 'pular'; estado: 'pulado_drift'; motivo: null | 'sem_base_de_comparacao' }  // linhas 3 e 4
  | { acao: 'pular'; estado: 'pulado_sem_original'; motivo: null }
  | { acao: 'falhar'; erro: ErroGravado }                         // linhas 5 e 6, e D7
  | { acao: 'desistir'; motivo: 'video_inexistente' }             // linha 7
export interface EntradaTitulo {
  campo: 'title'; destino: 'original' | { varianteId: string }
  atual: { tipo: 'lido'; valor: string } | { tipo: 'video_inexistente' } | { tipo: 'falha'; erro: ErroGravado }
  originalTitle: string | null
  variantes: Array<{ id: string; title_text: string | null }>
  forcar: boolean
}
export interface EntradaThumb {
  campo: 'thumbnail'; destino: 'original' | { varianteId: string }
  atual: { tipo: 'lido'; dhash: string } | { tipo: 'video_inexistente' } | { tipo: 'falha'; erro: ErroGravado }
  originalNoBlob: boolean                          // original_thumbnail_url em blob.vercel-storage.com
  dhashes: Map<string, DhashDaVariante>            // por id de variante, inclusive a original
  idOriginal: string
  ultimaEscrita: Date | null                       // do retrato ANTES da reivindicação (Review Focus 1)
  marcador: string | null                          // last_applied_variant_id ANTES da reivindicação
  agora: Date
  forcar: boolean
}
export const HORAS_THUMB_RECENTE = 3
export function decidirCampo(e: EntradaTitulo | EntradaThumb): Decisao
export function ultimaEscritaDoApp(t: { inicioUltimoCiclo: string | null; restoreStatus: RestoreStatus | null; winnerAppliedAt: string | null }): Date | null
```

- [ ] **Passo 1: testes que falham** — um por célula da tabela de 3.3 (sete linhas × título e thumbnail, aceite 15),
  mais 16 e 18:

```ts
const V = [{ id: 'A', title_text: null }, { id: 'B', title_text: 'Título B' }, { id: 'C', title_text: 'Título C' }]
const T = (atual: EntradaTitulo['atual'], over: Partial<EntradaTitulo> = {}): EntradaTitulo =>
  ({ campo: 'title', destino: 'original', atual, originalTitle: 'Original', variantes: V, forcar: false, ...over })

describe('título', () => {
  it('1: já é o destino → ok sem escrever (comparação sem espaços nas pontas)', () =>
    expect(decidirCampo(T({ tipo: 'lido', valor: '  Original ' }))).toEqual({ acao: 'ok_sem_escrever' }))
  it('2: é de outra variante → escreve', () => expect(decidirCampo(T({ tipo: 'lido', valor: 'Título C' }))).toEqual({ acao: 'escrever' }))
  it('2: é o original e o destino é B → escreve', () =>
    expect(decidirCampo(T({ tipo: 'lido', valor: 'Original' }, { destino: { varianteId: 'B' } }))).toEqual({ acao: 'escrever' }))
  it('3: outro valor → pulado_drift; com forcar → escreve', () => {
    expect(decidirCampo(T({ tipo: 'lido', valor: 'Editado no Studio' }))).toEqual({ acao: 'pular', estado: 'pulado_drift', motivo: null })
    expect(decidirCampo(T({ tipo: 'lido', valor: 'Editado no Studio' }, { forcar: true }))).toEqual({ acao: 'escrever' })
  })
  it('5: leitura falhou → falhar com o erro', () =>
    expect(decidirCampo(T({ tipo: 'falha', erro: { status: 503, reason: 'backendError' } }))).toMatchObject({ acao: 'falhar' }))
  it('7: vídeo inexistente → desistir', () =>
    expect(decidirCampo(T({ tipo: 'video_inexistente' }))).toEqual({ acao: 'desistir', motivo: 'video_inexistente' }))
  it('sem original: original_title nulo → pulado_sem_original', () =>
    expect(decidirCampo(T({ tipo: 'lido', valor: 'Título B' }, { originalTitle: null }))).toEqual({ acao: 'pular', estado: 'pulado_sem_original', motivo: null }))
  it('16: variante original com title_text próprio no ar, destino original → linha 2 (escreve original_title)', () =>
    expect(decidirCampo(T({ tipo: 'lido', valor: 'Título da A' }, { variantes: [{ id: 'A', title_text: 'Título da A' }, ...V.slice(1)] }))).toEqual({ acao: 'escrever' }))
  it('destino variante sem title_text → falhar (variante_sem_titulo)', () =>
    expect(decidirCampo(T({ tipo: 'lido', valor: 'Original' }, { destino: { varianteId: 'A' } }))).toMatchObject({ acao: 'falhar', erro: { motivo: 'variante_sem_titulo' } }))
})

describe('thumbnail', () => {
  const agora = new Date('2026-10-12T12:00:00Z')
  const ok = (d: string): DhashDaVariante => ({ tipo: 'ok', dhash: d })
  const H = { A: '0000000000000000', B: 'ffffffffffffffff', C: '00000000ffffffff' }
  const base = (over: Partial<EntradaThumb> = {}): EntradaThumb => ({
    campo: 'thumbnail', destino: 'original', atual: { tipo: 'lido', dhash: H.A }, originalNoBlob: true,
    dhashes: new Map([['A', ok(H.A)], ['B', ok(H.B)], ['C', ok(H.C)]]), idOriginal: 'A',
    ultimaEscrita: new Date('2026-10-10T08:00:00Z'), marcador: null, agora, forcar: false, ...over })
  it('1: atual a ≤6 do destino, última escrita há 2 dias → ok sem escrever', () => expect(decidirCampo(base()).acao).toBe('ok_sem_escrever'))
  it('2: atual é B → escreve', () => expect(decidirCampo(base({ atual: { tipo: 'lido', dhash: H.B } })).acao).toBe('escrever'))
  it('3: atual não casa com nada, todos calculados → pulado_drift; forcar → escreve', () => {
    const atual = { tipo: 'lido' as const, dhash: '0f0f0f0f0f0f0f0f' }
    expect(decidirCampo(base({ atual }))).toEqual({ acao: 'pular', estado: 'pulado_drift', motivo: null })
    expect(decidirCampo(base({ atual, forcar: true })).acao).toBe('escrever')
  })
  it('4: não casa e alguma variante sem base → pulado_drift sem_base_de_comparacao; forcar → escreve', () => {
    const atual = { tipo: 'lido' as const, dhash: '0f0f0f0f0f0f0f0f' }
    const dhashes = new Map<string, DhashDaVariante>([['A', ok(H.A)], ['B', { tipo: 'sem_base', motivo: 'blob_404' }], ['C', ok(H.C)]])
    expect(decidirCampo(base({ atual, dhashes }))).toEqual({ acao: 'pular', estado: 'pulado_drift', motivo: 'sem_base_de_comparacao' })
    expect(decidirCampo(base({ atual, dhashes, forcar: true })).acao).toBe('escrever')
  })
  it('5: probeThumb falhou, ou Blob 5xx de variante → falhar', () => {
    expect(decidirCampo(base({ atual: { tipo: 'falha', erro: { motivo: 'hqdefault_indisponivel' } } })).acao).toBe('falhar')
    const dhashes = new Map<string, DhashDaVariante>([['A', ok(H.A)], ['B', { tipo: 'falha', erro: new YouTubeApiError(503, 'blob_503', 'blob') }], ['C', ok(H.C)]])
    expect(decidirCampo(base({ atual: { tipo: 'lido', dhash: '0f0f0f0f0f0f0f0f' }, dhashes })).acao).toBe('falhar')
  })
  it('7: vídeo inexistente → desistir', () => expect(decidirCampo(base({ atual: { tipo: 'video_inexistente' } })).acao).toBe('desistir'))
  it('sem original no Blob → pulado_sem_original', () => expect(decidirCampo(base({ originalNoBlob: false })).acao).toBe('pular'))
  it('D7: destino variante sem arquivo (404) → falhar arquivo_do_destino_indisponivel', () => {
    const dhashes = new Map<string, DhashDaVariante>([['A', ok(H.A)], ['B', { tipo: 'sem_base', motivo: 'blob_404' }], ['C', ok(H.C)]])
    expect(decidirCampo(base({ destino: { varianteId: 'B' }, dhashes }))).toMatchObject({ acao: 'falhar', erro: { motivo: 'arquivo_do_destino_indisponivel' } })
  })
  it('18: já é B mas a última escrita foi há 1 h → escreve', () =>
    expect(decidirCampo(base({ destino: { varianteId: 'B' }, atual: { tipo: 'lido', dhash: H.B }, ultimaEscrita: new Date('2026-10-12T11:00:00Z') })).acao).toBe('escrever'))
  it('18: 3 h exatas ainda conta como recente (menos de 3 h = recente; 3:00 já não é)', () =>
    expect(decidirCampo(base({ ultimaEscrita: new Date('2026-10-12T09:00:00Z') })).acao).toBe('ok_sem_escrever'))
  it('18: marcador não nulo → escreve', () => expect(decidirCampo(base({ marcador: 'B' })).acao).toBe('escrever'))
  it('18: destino a ≤6 de outra variante → escreve sempre', () => {
    const dhashes = new Map<string, DhashDaVariante>([['A', ok(H.A)], ['B', ok('0000000000000003')], ['C', ok(H.C)]])
    expect(decidirCampo(base({ dhashes })).acao).toBe('escrever')
  })
})

describe('ultimaEscritaDoApp', () => {
  it('o mais recente entre o início do último ciclo, qualquer em do restore_status e winner_applied_at', () => { /* … */ })
  it('tudo nulo → null (nunca "agora")', () => expect(ultimaEscritaDoApp({ inicioUltimoCiclo: null, restoreStatus: null, winnerAppliedAt: null })).toBeNull())
})
```

- [ ] **Passo 2:** rodar; falham.
- [ ] **Passo 3: implementação** (`ab-settle-decidir.ts`):

```ts
import { DHASH_MAX_SAME, hamming } from '@/lib/youtube/thumb-fingerprint'
import type { DhashDaVariante } from '@/lib/youtube/ab-variant-dhash'
import { paraErroGravado } from '@/lib/youtube/youtube-api-error'
import type { ErroGravado, RestoreStatus } from '@/lib/youtube/ab-restore'

export const HORAS_THUMB_RECENTE = 3
const limpo = (s: string) => s.trim()

export function decidirCampo(e: EntradaTitulo | EntradaThumb): Decisao {
  if (e.atual.tipo === 'video_inexistente') return { acao: 'desistir', motivo: 'video_inexistente' }
  return e.campo === 'title' ? decidirTitulo(e) : decidirThumb(e)
}

function decidirTitulo(e: EntradaTitulo): Decisao {
  const alvo = e.destino === 'original' ? e.originalTitle : (e.variantes.find(v => v.id === (e.destino as { varianteId: string }).varianteId)?.title_text ?? null)
  if (e.destino === 'original' && (alvo === null || limpo(alvo) === '')) return { acao: 'pular', estado: 'pulado_sem_original', motivo: null }
  if (alvo === null || limpo(alvo) === '') return { acao: 'falhar', erro: { motivo: 'variante_sem_titulo' } }
  if (e.atual.tipo === 'falha') return { acao: 'falhar', erro: e.atual.erro }
  if (e.atual.tipo !== 'lido') return { acao: 'falhar', erro: { motivo: 'erro_interno' } }
  const atual = limpo(e.atual.valor)
  if (atual === limpo(alvo)) return { acao: 'ok_sem_escrever' }
  const conhecidos = new Set([...e.variantes.map(v => v.title_text), e.originalTitle].filter((x): x is string => x !== null).map(limpo))
  if (conhecidos.has(atual) || e.forcar) return { acao: 'escrever' }
  return { acao: 'pular', estado: 'pulado_drift', motivo: null }
}

function decidirThumb(e: EntradaThumb): Decisao {
  const idDestino = e.destino === 'original' ? e.idOriginal : e.destino.varianteId
  if (e.destino === 'original' && !e.originalNoBlob) return { acao: 'pular', estado: 'pulado_sem_original', motivo: null }
  const dDestino = e.dhashes.get(idDestino)
  if (!dDestino || (dDestino.tipo === 'sem_base' && e.destino !== 'original')) return { acao: 'falhar', erro: { motivo: 'arquivo_do_destino_indisponivel' } }
  if (dDestino.tipo === 'sem_base') return { acao: 'pular', estado: 'pulado_sem_original', motivo: null }
  if (e.atual.tipo === 'falha') return { acao: 'falhar', erro: e.atual.erro }
  if (e.atual.tipo !== 'lido') return { acao: 'falhar', erro: { motivo: 'erro_interno' } }
  const falhaDeBlob = [...e.dhashes.values()].find((d): d is Extract<DhashDaVariante, { tipo: 'falha' }> => d.tipo === 'falha')
  if (dDestino.tipo === 'falha') return { acao: 'falhar', erro: paraErroGravado(dDestino.erro) }

  const atual = e.atual.dhash
  const casa = (d: DhashDaVariante | undefined) => d?.tipo === 'ok' && hamming(d.dhash, atual) <= DHASH_MAX_SAME
  const recente = e.ultimaEscrita !== null && e.agora.getTime() - e.ultimaEscrita.getTime() < HORAS_THUMB_RECENTE * 3_600_000
  const parecidas = [...e.dhashes].some(([id, d]) => id !== idDestino && d.tipo === 'ok' && hamming(d.dhash, dDestino.dhash) <= DHASH_MAX_SAME)

  if (casa(dDestino)) return recente || e.marcador !== null || parecidas ? { acao: 'escrever' } : { acao: 'ok_sem_escrever' }
  if ([...e.dhashes.values()].some(casa)) return { acao: 'escrever' }
  if (falhaDeBlob) return { acao: 'falhar', erro: paraErroGravado(falhaDeBlob.erro) }
  if (e.forcar) return { acao: 'escrever' }
  const algumSemBase = [...e.dhashes.values()].some(d => d.tipo === 'sem_base')
  return { acao: 'pular', estado: 'pulado_drift', motivo: algumSemBase ? 'sem_base_de_comparacao' : null }
}

export function ultimaEscritaDoApp(t: { inicioUltimoCiclo: string | null; restoreStatus: RestoreStatus | null; winnerAppliedAt: string | null }): Date | null {
  const cands = [t.inicioUltimoCiclo, t.winnerAppliedAt, t.restoreStatus?.title?.em ?? null, t.restoreStatus?.thumbnail?.em ?? null]
    .map(s => (s ? Date.parse(s) : NaN)).filter(Number.isFinite)
  return cands.length ? new Date(Math.max(...cands)) : null
}
```

  (Interfaces `Decisao`, `EntradaTitulo`, `EntradaThumb` exatamente como no bloco **Interfaces** acima.)
- [ ] **Passo 4:** verdes; lista inteira; `tsc`; commit:
  `git commit -m "feat: A/B P4a: decisão por campo da tabela 3.3 (pura), com regra das 3 horas e variantes parecidas"`.

### Tarefa 6: `settleOnAir`, contexto do vídeo e avisos

**Files:**
- Create: `src/lib/youtube/ab-settle.ts`, `src/lib/youtube/ab-video-context.ts`, `src/lib/youtube/ab-restore-avisos.ts`
- Test: `test/youtube/ab-settle.test.ts`

**Interfaces:**
- Consome: `decidirCampo`, `ultimaEscritaDoApp` (T5); `lerSnippet`, `escreverTitulo`, `setThumbnail`,
  `fetchVariantImageBuffer`, `YouTubeApiError` (T3); `dhashDasVariantes` (T4); `probeThumb` (existente);
  `ab_settle_claim` (T1); `RestoreStatus`, `truncarErro`, `camposDoTeste` (T2).
- Produz:
```ts
// ab-video-context.ts (movidos de actions.ts, D11)
export async function resolveVideoChannel(supabase: SupabaseClient, siteId: string, internalVideoId: string): Promise<{ ok: true; channelAccountId: string } | { ok: false; error: string }>
export async function resolveYouTubeVideoId(supabase: SupabaseClient, internalVideoId: string): Promise<string | null>

// ab-settle.ts
export type MotivoSaida = 'pausa' | 'encerrado' | 'reverter' | 'falha_api' | 'duracao_maxima' | 'drift'
export interface OpcoesSaida {
  destino: 'original' | string       // id de variante não original
  motivo: MotivoSaida
  forcar?: boolean
  humano?: boolean                    // ação humana: liga o passo 0 (precisa_confirmar)
  statusNote?: string                 // falha_api
  consecutiveFailures?: number        // falha_api
}
export type ResultadoSaida =
  | { resultado: 'feito'; campos: RestoreStatus }
  | { resultado: 'precisa_confirmar'; campos: Array<{ campo: CampoNome; valor_atual: string }> }   // título: o texto; thumbnail: URL da hqdefault
  | { resultado: 'ja_encerrado'; campos: RestoreStatus | null }
  | { resultado: 'em_andamento'; campos: RestoreStatus | null }
export interface PortasSaida {
  supabase: SupabaseClient
  agora: () => Date
  fetch: typeof fetch
  token: (siteId: string, channelAccountId: string) => Promise<string>    // ensureFreshToken
  autoImportWinner: (testId: string, variantId: string) => Promise<void>
}
export async function settleOnAir(testId: string, op: OpcoesSaida, portas?: Partial<PortasSaida>): Promise<ResultadoSaida>

// ab-restore-avisos.ts
export async function avisarRestauracao(supabase: SupabaseClient, teste: { id: string; site_id: string; name: string }, rs: RestoreStatus): Promise<'enviado' | 'sem_destinatario' | 'repetido' | 'liberado'>
export async function avisarRotacaoCruzada(supabase: SupabaseClient, teste: { id: string; site_id: string; name: string }): Promise<number>
```

**Tabela 3.1 dentro de `settleOnAir`** (constante `CAMINHOS`):

| `motivo` | `p_de` | `p_para` | `p_end_reason` | `p_extra` |
|---|---|---|---|---|
| `pausa` | `['active']` | `paused` | `pausa` | `{ status_note: null }` |
| `encerrado` (destino original) | `['active','paused']` | `completed` | `encerrado` | `{ completed_reason: 'manual_archive', winner_variant_id: null }` |
| `encerrado` (destino variante) | `['active','paused']` | `completed` | `encerrado` | `{ completed_reason: 'manual_winner', winner_variant_id: <id> }` |
| `reverter` | `['completed']` | `completed` | `null` | `{}` (exige `winner_applied_at` não nulo e `revert_expires_at` no futuro: checado no retrato, senão `ja_encerrado`) |
| `falha_api` | `['active']` | `paused` | `falha_api` | `{ status_note, consecutive_failures }` |
| `duracao_maxima` | `['active']` | `completed` | `duracao_maxima` | `{ completed_reason: 'inconclusive', limpar_confianca: true }` |
| `drift` | `['active']` | `paused` | `drift` | `{ status_note: DRIFT_STATUS_NOTE, limpar_drift_ack: true }` |

**Ordem dentro de `settleOnAir`** (3.2; o que cada passo escreve no YouTube e o que acontece em erro):

0. **Retrato** (uma leitura: teste com `test_type`, `status`, `restore_seq`, `restore_status`, `original_title`,
   `original_thumbnail_url`, `last_applied_variant_id`, `winner_applied_at`, `revert_expires_at`, `site_id`,
   `youtube_video_id`, `name`; variantes; `started_at` do último ciclo). Daqui saem `ultimaEscrita` e `marcador`
   (**antes** da reivindicação). `destino` igual à variante `is_original` → tratado como `'original'` (3.1).
   Teste `test_type` fora de `thumbnail|title|combo` → `ja_encerrado` sem escrever.
0b. **Só ação humana, destino variante, sem `forcar`:** resolve canal, token, lê (passo 2) e decide a seco. Se
   algum campo cair nas linhas 3 ou 4 → `precisa_confirmar` com `{campo, valor_atual}` e **termina sem gravar
   nada**. Custo: 1 unidade (`videos.list`) e a `hqdefault` (0). Falha na leitura aqui **não** impede: segue
   para o passo 1 (o passo 3 decide `falhou`).
1. **Reivindica** por `ab_settle_claim` com `restore_status` = cada campo do teste em `em_andamento`
   (`destino`, `forcado`, `escreveu: null`, `erro: null`, `em` = agora, `attempts` = o anterior do campo ou 0).
   Zero linhas → relê: estado fora de `p_de` → `ja_encerrado`; senão → `em_andamento`.
2. **Resolve** canal (`resolveVideoChannel`), token (`portas.token`), id do vídeo; falha → todos os campos
   `falhou` com `erro: { motivo: 'canal_nao_identificado' | 'token' | 'video_fora_de_youtube_videos' }` (linha 6).
   **Lê**: `lerSnippet` (1 unidade; `null` → linha 7 em todos os campos; erro → linha 5); para thumbnail,
   `probeThumb(id, null)` (0 unidades; `dhash` nulo ou lança → linha 5) e `dhashDasVariantes` (0 unidades).
3. **Decide** cada campo (`decidirCampo`) e, para cada `escrever`: `select restore_seq` → se mudou, **para sem
   escrever** e devolve `em_andamento` (sem gravar nada: o outro escritor é dono); senão escreve:
   - título: `escreverTitulo` = `videos.list` (1) + `videos.update` (50). Erro HTTP → `falhou` com
     `{status, reason}`, `escreveu: false`; timeout/rede **no `PUT`** → `falhou`, `escreveu: null` (não se sabe).
   - thumbnail: `fetchVariantImageBuffer(destino)` (Blob, 0) + `setThumbnail` (50). Mesma regra de `escreveu`.
   - Sucesso → `ok`, `escreveu: true`. `ok_sem_escrever` → `ok`, `escreveu: false`. `pular` → o estado,
     `escreveu: false`. `desistir` → `desistiu`, `motivo: 'video_inexistente'`, `escreveu: false`.
   - `attempts`: `falhou` → 1 (a chamada original); outros → o anterior.
4. **Grava** `restore_status` com `where restore_seq = <reivindicado>` (não incrementa). Destino variante e todo
   campo `ok` → no mesmo `update`: `winner_applied_at = agora`, `applied_by = 'manual'`, `revert_expires_at =
   agora + 7 dias`; depois `autoImportWinner` **só se** `winner_applied_at` era nulo no retrato (32 j).
   `reverter` e todo campo `ok` → limpa os três. Zero linhas no passo 4 → `Sentry.captureMessage('ab-settle:
   resultado perdido', { testId })` e devolve `em_andamento` (as escritas já feitas ficam registradas no
   Sentry com o `restore_status` calculado).
5. **Avisos:** `avisarRestauracao` com o `restore_status` gravado (Tarefa 6, abaixo).

**Custo por chamada:** `pausa` de combo, tudo escrito: 1 (`videos.list` do passo 2) + 1 + 50 (título) + 50
(thumbnail) = **102 unidades**; só thumbnail: 1 + 50 = 51; já no destino: 1. Com o passo 0b (humano,
variante): +1. A cota diária do projeto é 10 000.

- [ ] **Passo 1: testes que falham** (`test/youtube/ab-settle.test.ts`). Banco falso em memória que implementa
  `from('ab_tests')`, `from('ab_test_variants')`, `from('ab_test_cycles')` e `rpc('ab_settle_claim')` com a mesma
  semântica do SQL (guarda por `restore_seq` e `p_de`); YouTube falso que registra cada chamada e pode recusar.

```ts
describe('settleOnAir: um teste por linha da tabela 3.1 (aceite 15)', () => {
  it.each([
    ['pausa', 'active', 'paused', undefined, 'pausa'],
    ['encerrado', 'active', 'completed', 'manual_archive', 'encerrado'],
    ['encerrado', 'paused', 'completed', 'manual_archive', 'encerrado'],
    ['falha_api', 'active', 'paused', undefined, 'falha_api'],
    ['duracao_maxima', 'active', 'completed', 'inconclusive', 'duracao_maxima'],
    ['drift', 'active', 'paused', undefined, 'drift'],
  ] as const)('%s de %s → %s', async (motivo, de, para, completedReason, endReason) => {
    const { banco, yt, portas } = montar({ status: de, testType: 'combo', noAr: { titulo: 'Título B', dhash: H.B } })
    const r = await settleOnAir(banco.testId, { destino: 'original', motivo }, portas)
    expect(r.resultado).toBe('feito')
    expect(banco.teste()).toMatchObject({ status: para, restore_seq: 1, last_applied_variant_id: null, ...(completedReason ? { completed_reason: completedReason } : {}) })
    if (de === 'active') expect(banco.cicloFechado()).toMatchObject({ end_reason: endReason, ended_at: banco.teste().paused_at ?? banco.teste().completed_at })
    expect(banco.teste().restore_status).toMatchObject({ title: { estado: 'ok', destino: 'original', escreveu: true }, thumbnail: { estado: 'ok', escreveu: true } })
    expect(yt.escritas()).toEqual(['videos.update', 'thumbnails.set'])
  })
  it('encerrar deixando B: manual_winner, winner_applied_at, applied_by manual, revert_expires_at +7d, autoImportWinner uma vez', async () => { /* … */ })
  it('17: endAbTest com o id da variante original → manual_archive, sem dado de vencedor', async () => { /* destino = id de A → tratado como original */ })
  it('19: deixar B num teste de título que termina falhou → winner_applied_at e revert_expires_at nulos', async () => { /* yt recusa videos.update 403 */ })
  it('reverter: limpa os três só se tudo ok; com edição externa → pulado_drift e os dados de vencedor ficam (19)', async () => { /* … */ })
  it('reverter com revert_expires_at no passado → ja_encerrado, nada escrito', async () => { /* … */ })
})

describe('settleOnAir: ordem e corridas (3.2, 22, P4a-I1, I3)', () => {
  it('Review Focus 1: ultimaEscrita vem do retrato de antes da reivindicação', async () => {
    // último ciclo começou há 2 dias, restore_status nulo; destino original; a thumbnail no ar já é a original
    const { banco, yt, portas } = montar({ status: 'active', testType: 'thumbnail', noAr: { dhash: H.A }, inicioUltimoCiclo: '2 dias atrás' })
    await settleOnAir(banco.testId, { destino: 'original', motivo: 'pausa' }, portas)
    expect(yt.escritas()).toEqual([])                                  // ok sem escrever
    expect(banco.teste().restore_status.thumbnail).toMatchObject({ estado: 'ok', escreveu: false })
  })
  it('restore_seq muda entre a decisão e a escrita → não escreve e devolve em_andamento', async () => {
    const { banco, yt, portas } = montar({ status: 'active', testType: 'thumbnail', noAr: { dhash: H.B } })
    yt.antesDeEscrever(() => banco.incrementarSeq())
    const r = await settleOnAir(banco.testId, { destino: 'original', motivo: 'pausa' }, portas)
    expect(r.resultado).toBe('em_andamento'); expect(yt.escritas()).toEqual([])
  })
  it('P4a-I3: mock que lança sem catch depois do passo 1 → em_andamento gravado com forcado, em, attempts do anterior', async () => {
    const { banco, portas } = montar({ status: 'active', testType: 'combo', anterior: { title: { attempts: 2 } } })
    portas.token = async () => { throw new TypeError('morte sem tratamento') }   // o passo 2 lança fora do try da função
    await expect(settleOnAir(banco.testId, { destino: 'original', motivo: 'pausa' }, { ...portas, semTratarPasso2: true } as never)).rejects.toThrow()
    expect(banco.teste().restore_status.title).toMatchObject({ estado: 'em_andamento', forcado: false, attempts: 2 })
  })
  it('estado igual e restore_seq diferente → em_andamento', async () => { /* claim perde por seq, status ainda active */ })
  it('estado fora de p_de → ja_encerrado', async () => { /* status completed, motivo pausa */ })
})

describe('settleOnAir: precisa_confirmar e forcar (20, P4a-E7)', () => {
  it('destino variante, título editado por fora → precisa_confirmar listando só o título; nada gravado', async () => {
    const { banco, yt, portas } = montar({ status: 'active', testType: 'combo', noAr: { titulo: 'Editado', dhash: H.C } })
    const r = await settleOnAir(banco.testId, { destino: 'B', motivo: 'encerrado', humano: true }, portas)
    expect(r).toEqual({ resultado: 'precisa_confirmar', campos: [{ campo: 'title', valor_atual: 'Editado' }] })
    expect(banco.teste()).toMatchObject({ status: 'active', restore_seq: 0, restore_status: null }); expect(yt.escritas()).toEqual([])
  })
  it('com forcar: escreve os dois e grava forcado: true', async () => { /* … */ })
  it('destino original nunca pergunta (o passo 0 é só destino variante)', async () => { /* título editado, destino original → pulado_drift sem perguntar */ })
})

describe('settleOnAir: falhas (21, P4a-I2, I20)', () => {
  it('P4a-I2: pausa com thumbnails.set 403 → estado paused, campo falhou com {status, reason}, aviso criado, ciclo fechado', async () => {
    const { banco, yt, portas, avisos } = montar({ status: 'active', testType: 'thumbnail', noAr: { dhash: H.B } })
    yt.recusar('thumbnails.set', 403, 'forbidden', { corpo: 'token=abc' })
    await settleOnAir(banco.testId, { destino: 'original', motivo: 'pausa' }, portas)
    expect(banco.teste().status).toBe('paused')
    expect(banco.teste().restore_status.thumbnail).toMatchObject({ estado: 'falhou', erro: { status: 403, reason: 'forbidden' }, attempts: 1, escreveu: false })
    expect(JSON.stringify(banco.teste().restore_status)).not.toMatch(/token=|https?:/)
    expect(avisos.enviados()).toHaveLength(1)
  })
  it('timeout no PUT → falhou com escreveu null', async () => { /* … */ })
  it('canal não identificado → falhou com motivo, estado mudou mesmo assim (comportamento novo de 3.2)', async () => { /* … */ })
  it('videos.list sem o vídeo → desistiu/video_inexistente nos dois campos, sem escrever', async () => { /* … */ })
  it('original_title nulo → pulado_sem_original no título; "" nunca enviado ao YouTube', async () => { /* … */ })
  it('título original de 100 caracteres com emoji, aspas e <script> é enviado byte a byte', async () => { /* … */ })
  it('dHash nulo da variante é calculado na hora (15) e gravado', async () => { /* … */ })
})
```

  `montar(...)`: o executor escreve o banco e o YouTube falsos **neste arquivo** (≤ 150 linhas), com
  `escritas()` contando só `videos.update` e `thumbnails.set`. O caso P4a-I3 exige que a porta `token` seja
  chamada fora de `try` (ou que `settleOnAir` relance exceções que não sejam `YouTubeApiError` depois de
  registrar no Sentry): **decisão de implementação — `settleOnAir` só converte em `falhou` erros conhecidos
  (`YouTubeApiError`, os motivos da linha 6); qualquer outro relança, e o estado fica `em_andamento` para o
  vigia.** Assim o teste não precisa de opção escondida (`semTratarPasso2` sai; o `TypeError` basta).

- [ ] **Passo 2:** rodar; falham.
- [ ] **Passo 3: implementação.** `ab-video-context.ts` com as duas funções copiadas de `actions.ts:66-79` e
  `:623-…` (corpo igual, exportadas; `actions.ts` passa a importar). `ab-settle.ts` segue a ordem acima; o
  esqueleto:

```ts
export async function settleOnAir(testId: string, op: OpcoesSaida, p: Partial<PortasSaida> = {}): Promise<ResultadoSaida> {
  const portas = { ...portasPadrao(), ...p }
  const agora = portas.agora()
  const r = await lerRetrato(portas.supabase, testId)                      // passo 0
  if (!r) return { resultado: 'ja_encerrado', campos: null }
  const destino = destinoNormalizado(op.destino, r.variantes)               // id da is_original → 'original'
  const caminho = caminhoDe(op.motivo, destino)                             // tabela CAMINHOS
  if (!caminho.de.includes(r.status) || !tipoConhecido(r.test_type)) return { resultado: 'ja_encerrado', campos: r.restore_status }
  if (op.motivo === 'reverter' && !reversaoAberta(r, agora)) return { resultado: 'ja_encerrado', campos: r.restore_status }
  const campos = camposDoTeste(r.test_type)
  const contexto = { ultimaEscrita: ultimaEscritaDoApp(r), marcador: r.last_applied_variant_id }   // ANTES do claim

  if (op.humano && destino !== 'original' && !op.forcar) {                  // passo 0b
    const leitura = await lerNoYouTube(portas, r, campos).catch(() => null)
    if (leitura) {
      const perguntar = campos.flatMap(c => {
        const d = decidirCampo(entrada(c, r, destino, leitura, contexto, agora, false))
        return d.acao === 'pular' && d.estado === 'pulado_drift' ? [{ campo: c, valor_atual: valorAtual(c, leitura) }] : []
      })
      if (perguntar.length) return { resultado: 'precisa_confirmar', campos: perguntar }
    }
  }

  const inicial = Object.fromEntries(campos.map(c => [c, {
    estado: 'em_andamento', destino, forcado: op.forcar === true, escreveu: null, erro: null,
    em: agora.toISOString(), attempts: r.restore_status?.[c]?.attempts ?? 0 }])) as RestoreStatus
  const claim = await portas.supabase.rpc('ab_settle_claim', {
    p_test_id: testId, p_seq: r.restore_seq, p_de: caminho.de, p_para: caminho.para,
    p_end_reason: caminho.endReason, p_restore_status: inicial, p_extra: caminho.extra(op, destino) })
  if (claim.error) throw claim.error
  const seq = claim.data?.[0]?.claimed_seq
  if (seq === undefined) {
    const s = await relerStatus(portas.supabase, testId)
    return { resultado: s && caminho.de.includes(s) ? 'em_andamento' : 'ja_encerrado', campos: null }
  }

  const final = await restaurarCampos(portas, r, campos, destino, contexto, op.forcar === true, seq, agora)   // passos 2 e 3
  if (final === 'perdeu_a_vez') return { resultado: 'em_andamento', campos: null }
  const gravou = await gravarResultado(portas, r, seq, final, destino, op.motivo, agora)                      // passo 4
  if (!gravou) return { resultado: 'em_andamento', campos: null }
  await avisarRestauracao(portas.supabase, r, final).catch(e => Sentry.captureException(e, { tags: { area: 'ab-settle' } }))   // passo 5
  return { resultado: 'feito', campos: final }
}
```

  `lerNoYouTube` devolve `{ snippet: SnippetLido | null, thumb: { tipo: 'lido'; dhash } | { tipo: 'falha'; erro } , dhashes }`;
  a URL de `valor_atual` da thumbnail é `thumbUrl(youtubeId)` (pública; a tela mostra a imagem).
  `restaurarCampos` executa o passo 3 **em série** (título antes da thumbnail; a ordem não importa ao
  YouTube e em série a releitura de `restore_seq` antes de cada escrita é exata).
  Orçamento: `AbortSignal.timeout(10_000)` por chamada; se `agora() - inicio > 50 s` antes de uma escrita, o
  campo vira `falhou` com `erro: { motivo: 'tempo_esgotado' }` e `escreveu: false` (D9).

  `ab-restore-avisos.ts`:
  ```ts
  export async function avisarRestauracao(supabase, teste, rs) {
    const falhou = (['title', 'thumbnail'] as const).filter(c => rs[c]?.estado === 'falhou')
    const chave = `ab-restore:${teste.id}`
    if (falhou.length === 0) { await releaseAlert(supabase, chave); return 'liberado' }
    if (!(await claimAlert(supabase, chave, '1 day'))) return 'repetido'
    const n = await fanOutToSiteAdmins({
      siteId: teste.site_id, domain: 'youtube', type: 'youtube.ab_restore_failed', priority: 1,
      title: 'A/B: o vídeo não voltou ao combinado',
      message: frasesDoAviso(teste.name, rs, falhou),       // "O título do teste X não voltou ao original: o YouTube recusou. Corrija no YouTube Studio."
      dedupKey: `${chave}:${new Date().toISOString().slice(0, 10)}`,
      actionHref: `/cms/youtube/ab-lab/${teste.id}`,
    })
    if (n === 0) { await releaseAlert(supabase, chave); return 'sem_destinatario' }
    return 'enviado'
  }
  ```
  `sem_destinatario` sobe ao chamador: no cron vira `SEM_DESTINATARIO` na resposta e `recordCronFailure`
  (P4a-I19); na ação humana, `Sentry.captureMessage`. O texto do aviso vai a Logan na Tarefa 17 (o sininho não
  está no mockup; frase curta no molde da faixa C).
- [ ] **Passo 4:** verdes; lista inteira; `tsc`; commit:
  `git commit -m "feat: A/B P4a: settleOnAir (reivindica, lê, decide, escreve e grava por campo) com avisos de falha"`.

### Tarefa 7: os chamadores humanos (pausar, encerrar, reverter) e saem carência e "aplicar vencedor"

**Files:**
- Modify: `AB/actions.ts` (`pauseAbTest` `:661`, `endAbTest` `:859`, `revertWinner` `:1453`; apagar `applyWinnerNow` `:1282` e `cancelGracePeriod` `:1393`), `AB/_components/active-detail.tsx` (banner de carência `~:122-150`), `AB/[testId]/page.tsx` e `AB/page.tsx` (`export const maxDuration = 60`)
- Test: **novo** `test/youtube/ab-p4a-chamadores.test.ts`, **novo** `test/integration/ab-p4a-concorrencia.test.ts`; os testes existentes de pausa, encerrar, reverter, `applyWinnerNow` e `cancelGracePeriod` (lista do dia por `grep -rln "pauseAbTest\|endAbTest\|revertWinner\|applyWinnerNow\|cancelGracePeriod" test`)

**Interfaces:**
- Consome: `settleOnAir`, `ResultadoSaida` (T6).
- Produz (contrato do diálogo, Tarefa 15):
```ts
export type ResultadoAcaoSaida =
  | { ok: true; resultado: 'feito'; campos: RestoreStatus }
  | { ok: true; resultado: 'precisa_confirmar'; campos: Array<{ campo: CampoNome; valor_atual: string }> }
  | { ok: false; resultado: 'em_andamento' | 'ja_encerrado'; error: string }
  | { ok: false; resultado: 'sem_permissao' | 'erro'; error: string }
export async function pauseAbTest(testId: string): Promise<ResultadoAcaoSaida>
export async function endAbTest(testId: string, opcao: { destino: 'original' } | { destino: 'variante'; varianteId: string; forcar?: boolean }): Promise<ResultadoAcaoSaida>
export async function revertWinner(testId: string): Promise<ResultadoAcaoSaida>
```
  Mensagens: `em_andamento` → "Outra tentativa está em andamento. Tente de novo em instantes."; `sem_permissao`
  (variante sem admin) → "Só quem administra o site pode deixar uma variante no ar. Você pode voltar ao original."

- [ ] **Passo 1: testes que falham.**

```ts
// test/youtube/ab-p4a-chamadores.test.ts (settleOnAir mockado; afirma o que a ação passa e devolve)
it('pauseAbTest chama settleOnAir(original, pausa) depois de requireEditAccess', async () => {
  await pauseAbTest('t1')
  expect(settle).toHaveBeenCalledWith('t1', { destino: 'original', motivo: 'pausa', humano: true })
})
it('endAbTest com variante exige site admin; sem permissão → sem_permissao com a frase, sem chamar settleOnAir', async () => { /* denyUnlessSiteAdmin nega */ })
it('endAbTest com o id da variante original → destino original, sem exigir site admin (17)', async () => { /* … */ })
it('endAbTest repassa forcar só quando veio', async () => { /* … */ })
it('em_andamento vira ok:false com a frase exata', async () => { /* … */ })
it('applyWinnerNow e cancelGracePeriod não existem mais', async () => {
  const m = await import('@/app/cms/(authed)/youtube/ab-lab/actions')
  expect('applyWinnerNow' in m).toBe(false); expect('cancelGracePeriod' in m).toBe(false)
})
it('as páginas do A/B exportam maxDuration = 60', async () => { /* import das duas páginas */ })

// test/integration/ab-p4a-concorrencia.test.ts (bythiago_int; YouTube falso)
it('P4a-I1: dois endAbTest simultâneos → um feito e um ja_encerrado; uma escrita; um ciclo fechado; restore_seq +1', async () => {
  const [a, b] = await Promise.all([settleOnAir(id, { destino: 'original', motivo: 'encerrado' }, portas), settleOnAir(id, { destino: 'original', motivo: 'encerrado' }, portas)])
  expect([a.resultado, b.resultado].sort()).toEqual(['feito', 'ja_encerrado'].sort())
  expect(yt.escritas().filter(e => e === 'thumbnails.set')).toHaveLength(1)
  expect((await teste()).restore_seq).toBe(1)
})
```

  Os testes antigos de `applyWinnerNow`/`cancelGracePeriod` **saem** (são do caminho apagado); os de pausa e
  encerrar que afirmavam "erro antes de mudar estado" passam a afirmar o comportamento novo (3.2: o estado
  muda, o campo fica `falhou`).
- [ ] **Passo 2:** rodar; falham.
- [ ] **Passo 3: implementação.** As três ações: `requireEditAccess()` (pausa, encerrar para original,
  reverter... reverter é `denyUnlessSiteAdmin` hoje: **mantém**); `endAbTest` com variante não original →
  `denyUnlessSiteAdmin`; chama `settleOnAir`; traduz; `revalidateTag('youtube', { expire: 0 })` e
  `revalidatePath`; `autoImportWinner` sai de `endAbTest` (agora está dentro de `settleOnAir`, passo 4). Apagar
  `applyWinnerNow`, `cancelGracePeriod` e o banner de carência de `active-detail.tsx` (e seus imports). Grep de
  saída: `grep -rn "applyWinnerNow\|cancelGracePeriod\|Cancelar carência\|Aplicar vencedor" src` → vazio.
- [ ] **Passo 4:** integração no `bythiago_int`, lista inteira, `tsc`, commit:
  `git commit -m "feat: A/B P4a: pausar, encerrar e reverter passam por settleOnAir; saem carência e aplicar vencedor"`.

### Tarefa 8: chamadores automáticos (falha de API na rotação, duração máxima)

**Files:**
- Modify: `src/lib/youtube/ab-rotate-phases.ts` (`:225-283`), `src/lib/youtube/ab-evaluate-phases.ts` (`:60-178`, ramo de duração máxima)
- Test: `test/api/cron/ab-rotate.test.ts`, `test/ab-cron-rotate.test.ts`, `test/youtube/ab-evaluate-phases.test.ts`

**Interfaces:**
- Consome: `settleOnAir`, `YouTubeApiError`, `contaParaFalhas` (T3, T6).

- [ ] **Passo 1: testes que falham.**

```ts
it('rotação: 403 forbidden três vezes → settleOnAir(original, falha_api) com status_note e consecutive_failures 3', async () => { /* … */ })
it('rotação: quotaExceeded não conta para as três (21)', async () => {
  // applyVariantToYouTube devolve erroApi { status: 403, reason: 'quotaExceeded' } com consecutive_failures 2 → continua 2, nada pausado
})
it('rotação: mensagem com "401" no texto mas sem YouTubeApiError (ex.: erro de banco) não conta', async () => { /* … */ })
it('duração máxima: settleOnAir(original, duracao_maxima) → completed/inconclusive, ciclo com end_reason duracao_maxima, confiança nula', async () => { /* … */ })
it('duração máxima com o YouTube recusando: estado completed mesmo assim, campo falhou', async () => { /* … */ })
```

- [ ] **Passo 2:** rodar; falham.
- [ ] **Passo 3: implementação.** No `catch` da rotação: `const e = applyErr instanceof YouTubeApiError ? applyErr : null`;
  classificação por `e.status` (401 → "token expirado", 403 → "sem permissão", 429 → "cota"); `quotaExceeded`
  → só `Sentry` e `status_note` "cota do YouTube esgotada hoje", sem incrementar; na 3ª →
  `settleOnAir(test.id, { destino: 'original', motivo: 'falha_api', statusNote, consecutiveFailures: 3 })`
  (substitui `:243-283` inteiro: restauração só de thumbnail, `update` sem fechar ciclo). Abaixo de 3, o
  `update` de `config`/`status_note` ganha `.eq('restore_seq', <lido>)`. Duração máxima: troca a restauração
  "melhor esforço" e o `update` por `settleOnAir(test.id, { destino: 'original', motivo: 'duracao_maxima' })`;
  `ja_encerrado`/`em_andamento` → pula o teste (outro escritor é dono).
- [ ] **Passo 4:** lista inteira, `tsc`, commit:
  `git commit -m "feat: A/B P4a: falha de API e duração máxima saem do ar por settleOnAir; quotaExceeded não conta"`.

### Tarefa 9: a rotação do cron e forçar rotação reivindicam

**Files:**
- Create: `src/lib/youtube/ab-rotate-claim.ts`
- Modify: `src/lib/youtube/ab-rotate-phases.ts` (`:94-213`), `AB/actions.ts` (`forceRotate` `:1164`)
- Test: **novo** `test/youtube/ab-rotate-reivindicacao.test.ts`; `test/ab-force-rotate.test.ts`, `test/ab-rotate-dispatch.test.ts`, `test/api/cron/ab-rotate.test.ts`

**Interfaces:**
- Produz:
```ts
export async function reivindicarRotacao(supabase: SupabaseClient, testId: string, seqLido: number, proxima: string, marcadorLido: string | null): Promise<number | null>  // devolve o seq reivindicado
export async function aplicarRotacao(supabase: SupabaseClient, args: { testId: string; seq: number; youtubeVideoId: string; accessToken: string; testType: 'thumbnail' | 'title' | 'combo'; variante: AbTestVariantRow; originalTitle: string | null; cycleNumber: number }): Promise<{ ok: true; cicloId: string } | { ok: false; motivo: 'perdeu_a_vez' | 'cruzou_com_pausa'; erro?: never } | { ok: false; motivo: 'youtube'; erro: YouTubeApiError | Error }>
```
- `reivindicarRotacao`: `update ab_tests set restore_seq = restore_seq + 1, last_applied_variant_id = <proxima>, updated_at = now()
  where id = … and status = 'active' and restore_seq = <lido> and ` (`last_applied_variant_id is null` **ou**
  `= <marcadorLido>` quando a chamada é a recuperação do marcador velho, R2-7) `returning restore_seq`.
- `aplicarRotacao`: relê `restore_seq` → se ≠ `seq`, `perdeu_a_vez` sem escrever; `applyVariantToYouTube`
  (título: 1 + 50; thumbnail: 50); poll mais recente; `rpc('ab_rotate_commit', { …, p_views, p_likes })`; nulo →
  `Sentry.captureMessage('ab-rotate: reivindicação perdida depois da escrita', { extra: { testId } })` +
  `avisarRotacaoCruzada` ("confira a thumbnail e o título do vídeo X: a rotação e uma pausa se cruzaram") e
  `cruzou_com_pausa`.

- [ ] **Passo 1: testes que falham** (`ab-rotate-reivindicacao.test.ts`, emenda 32 h e P4a-I7, I8):

```ts
it('(a) pausa entre a escrita da rotação e o fecho → nenhum ciclo aberto, Sentry e aviso', async () => {
  yt.depoisDeEscrever(async () => { await settleOnAir(testId, { destino: 'original', motivo: 'pausa' }, portas) })
  const r = await aplicarRotacao(banco, args)
  expect(r).toMatchObject({ ok: false, motivo: 'cruzou_com_pausa' })
  expect(banco.ciclosAbertos()).toHaveLength(0)
  expect(sentry.captureMessage).toHaveBeenCalledWith('ab-rotate: reivindicação perdida depois da escrita', expect.anything())
  expect(avisos.enviados()[0].message).toMatch(/a rotação e uma pausa se cruzaram/)
})
it('(b) dois ab-rotate simultâneos → uma escrita no YouTube', async () => {
  await Promise.all([phaseRotateActiveTests(banco), phaseRotateActiveTests(banco)])
  expect(yt.escritas()).toHaveLength(1)
})
it('22: a rotação leu o teste, o dono pausa, a rotação não escreve nem abre ciclo', async () => { /* pausa antes do reivindicarRotacao */ })
it('P4a-I8: marcador velho (queda anterior) → reivindica por restore_seq e segue no mesmo dia', async () => {
  banco.setTeste({ last_applied_variant_id: 'B', restore_seq: 4 })
  await phaseRotateActiveTests(banco)
  expect(yt.escritas().length).toBeGreaterThan(0)
  expect(banco.teste()).toMatchObject({ restore_seq: 5, last_applied_variant_id: null })
  expect(banco.cicloAberto()).toMatchObject({ cycle_number: 1 })
})
it('fecho com end_reason rotacao, views e likes do último poll; consecutive_failures zera', async () => { /* … */ })
it('forceRotate: reivindica do mesmo jeito; teste pausado no meio → não escreve', async () => { /* … */ })
it('ABBA com 2 variantes: depois do ciclo 0 (A), o ciclo 1 é B', async () => { /* getNextVariantIndex('abba', 2, 1) === 1 e a variante aplicada é B */ })
```

- [ ] **Passo 2:** rodar; falham.
- [ ] **Passo 3: implementação.** Em `phaseRotateActiveTests`: a recuperação do marcador (`:106-117`) deixa de
  "limpar e pular": registra o `Sentry.captureMessage` de hoje e segue com `marcadorLido = test.last_applied_variant_id`
  (a reivindicação aceita esse marcador exato); o marcador sem guarda (`:161-165`) vira `reivindicarRotacao`
  (zero linhas → `continue`, sem erro); `applyVariantToYouTube` + fecho/abertura (`:167-213`) viram
  `aplicarRotacao`. `forceRotate`: mesma troca (marcador `:1235-1246` → `reivindicarRotacao` com
  `denyUnlessSiteAdmin` antes, como hoje). O `end_reason = 'rotacao'` só é gravado por `ab_rotate_commit`.
- [ ] **Passo 4:** lista inteira, `tsc`, commit:
  `git commit -m "feat: A/B P4a: rotação do cron e forçar rotação reivindicam por restore_seq e fecham por ab_rotate_commit"`.

### Tarefa 10: retomar, iniciar e a fila

**Files:**
- Modify: `AB/actions.ts` (`resumeAbTest` `:756`, `startAbTest` `:639`), `src/lib/youtube/ab-start.ts`, `src/lib/youtube/ab-rotate-phases.ts` (`phaseProcessQueue` `:21-53`)
- Test: `test/ab-actions-resume.test.ts`, `test/ab-start-internal.test.ts`, **novo** `test/youtube/start-concorrente.test.ts`, `test/api/cron/ab-rotate.test.ts`

**Interfaces:**
- Consome: `applyVariantToYouTube` (T3), `guardarOriginalMaior`, `dhashDoArquivo` (T4), `lerSnippet` (T3).

**Retomar (emenda 32 i):** lê (`restore_seq`, `restore_status` = **anterior em memória**); reivindica mantendo
`paused` (`update … set restore_seq = restore_seq + 1, restore_status = <em_andamento nos campos que vai
escrever, destino = id da variante, forcado false, em now, attempts anterior> where id and status = 'paused'
and restore_seq = <lido>`); relê `restore_seq` antes de escrever; `applyVariantToYouTube` (1 + 50 + 50 no
combo); sucesso → `update … set status = 'active', restore_status = '{}'::jsonb, …` + ciclo novo com
`cycle_number = max + 1` (hoje `count`: troca para `max(cycle_number) + 1`), tudo com `where restore_seq =
<reivindicado>`; falha tratada → regrava o anterior com `where restore_seq = <reivindicado>`; morte sem
tratamento → fica `em_andamento` (o vigia converte aos 15 min).

**Iniciar (emenda 32 m, Y-5, 46):** `startAbTestInternal` na ordem: (0) recusa `thumbnail`/`combo` com variante
não original sem `blob_url` ("a variante X não tem imagem"), **antes de qualquer escrita**; (0b) Y-5: outros
testes do mesmo vídeo com campo em `falhou`, `pulado_*` ou `desistiu` → reivindica cada um por `restore_seq` e
grava esses campos como `desistiu`, `motivo: 'novo_teste'`; (1) reivindica `draft → active` com `started_at` e
`restore_seq + 1` (zero linhas → "já iniciado por outro processo", sem escrever); (2) relê título
(`lerSnippet`, 1 unidade) e thumbnail (`probeThumb`, 0); se diferem do guardado (título exato; thumbnail por
dHash > 6 do da original), grava `original_title`, `original_thumbnail_url`, `blob_url` e `thumbnail_dhash` da
`is_original` (cópia nova por `guardarOriginalMaior`, caminho novo), `where restore_seq = <reivindicado>`;
leitura que falha → volta a `draft` (`where restore_seq`) e devolve o erro; (3) relê `restore_seq`; se a 1ª
variante não é a original, `applyVariantToYouTube` (thumbnail 50 e/ou título 1 + 50); falha → volta a
`draft`; (4) abre o ciclo 0. A baseline por `YOUTUBE_API_KEY` continua como está (fora do escopo).

**Fila (32 n):** `phaseProcessQueue` checa `result.ok`; falhou → `update … set status = 'queued',
queue_start_after = queue_start_after + interval '1 day'` e um aviso por dia (`claimAlert(\`ab-queue:${id}\`,
'1 day')` + `fanOutToSiteAdmins`, tipo `youtube.ab_queue_start_failed`); `started` só conta os `ok`.

- [ ] **Passo 1: testes que falham.**

```ts
it('P4a-I6 (i): retomar com escrita ok → active, restore_status {} (não nulo), ciclo novo', async () => { /* … */ })
it('P4a-I6 (ii): retomar com a aplicação falhando → paused e restore_status igual ao de antes', async () => { /* … */ })
it('P4a-I6 (iii): retomar com a função morta depois do envio → em_andamento', async () => { /* applyVariantToYouTube resolve, o update final lança TypeError */ })
it('retomar com restore_seq trocado → não escreve', async () => { /* … */ })
it('P4a-I10 start-concorrente: dois inícios do mesmo rascunho, leitor devolve O e depois B → original_title O, uma escrita, um ciclo 0', async () => { /* … */ })
it('24: iniciar com título mudado depois da criação atualiza original_title, a cópia e o dHash da original', async () => { /* … */ })
it('P4a-I11: variante B de thumbnail sem blob_url → ok:false "a variante B não tem imagem", nada escrito (nem status active)', async () => { /* … */ })
it('releitura que falha recusa o início e volta a draft', async () => { /* … */ })
it('P4a-I9 (parte 2): iniciar T2 com T1 em falhou no mesmo vídeo → T1 desistiu/novo_teste', async () => { /* … */ })
it('fila: start falhou → queued +1 dia e um aviso; started não conta', async () => { /* … */ })
it('E1 do ensaio: combo com A original no ciclo 0 → nenhuma escrita no YouTube, restore_seq 1, ciclo 0 aberto', async () => { /* … */ })
```

- [ ] **Passo 2:** rodar; falham. **Passo 3:** implementar. **Passo 4:** lista inteira, `tsc`, commit:
  `git commit -m "feat: A/B P4a: retomar, iniciar e a fila reivindicam; original relido depois da reivindicação"`.

### Tarefa 11: o vigia (drift pela imagem e `em_andamento` interrompido)

**Files:**
- Create: `src/lib/youtube/ab-watchdog-drift.ts`, `src/lib/util/em-paralelo.ts`
- Modify: `src/app/api/cron/ab-watchdog/route.ts` (**só** `:74-189` e uma linha nova na resposta, depois de `avisos`)
- Test: `test/ab-cron-watchdog.test.ts`, `test/ab-watchdog-drift.test.ts`, `test/cron/ab-watchdog-competitor-history.test.ts` (`chain`); rodar sem editar `test/observatorio/{lista-fechada-do-que-apaga,cache-writers}.test.ts`

**Interfaces:**
- Produz:
```ts
export async function emParalelo<T, R>(itens: readonly T[], limite: number, fn: (t: T) => Promise<R>, deveParar?: () => boolean): Promise<{ feitos: R[]; adiados: number }>
export interface ResultadoDrift { verificados: number; pausados: number; falhas: number; adiados: number; interrompidos: number; semDestinatario: boolean }
export async function faseDriftEInterrompidos(supabase: SupabaseClient, relogio: { agora: () => number; inicio: number }, f?: typeof fetch): Promise<ResultadoDrift>
export const ORCAMENTO_VIGIA_MS = 45_000
```

**O que a fase faz (cota 0 em tudo, exceto o `settleOnAir` de um drift detectado: 1 + 50 do título no combo):**

1. **Interrompidos (32 D1):** `ab_tests` com `restore_status->title->>estado = 'em_andamento'` ou o mesmo em
   `thumbnail`, e `em` < agora − 15 min (filtro no código depois do `.or(...)`); para cada um, reivindica por
   `restore_seq` (`update … set restore_seq = restore_seq + 1, restore_status = <cada campo em_andamento velho
   vira { …, estado: 'falhou', erro: 'interrompido', attempts: 1, escreveu: null } (em mantido, D6)> where
   restore_seq = <lido>`) e chama `avisarRestauracao`. Ignora teste cujo vídeo tem outro teste em `draft`,
   `queued`, `active` ou `paused` (Y-5). 14 min: não toca.
2. **Drift (3.3):** testes `active` de `thumbnail`/`combo`; ciclos abertos e vídeos em **duas** consultas
   (`in('test_id', ids)`, `in('id', videoIds)`); ciclo com menos de 3 h é pulado; para cada teste, com no máximo
   4 em paralelo e corte de 45 s: `probeThumb(youtubeId, null)` (falha → `falhas++`, nunca "sem drift");
   dHash da variante do ciclo aberto (`dhashDasVariantes`; sem base → `falhas++`); distância > 6 →
   `settleOnAir(testId, { destino: 'original', motivo: 'drift' })` → `pausados++` (o aviso de drift de hoje
   continua; a thumbnail fica `pulado_drift` e o título volta ao original no combo).
3. **Avisos pendentes:** testes com campo `falhou` → `avisarRestauracao` (o `claimAlert` de 1 dia evita repetir).

A rota: `const drift = await faseDriftEInterrompidos(...).catch(e => ({ verificados: 0, pausados: 0, falhas: 1, adiados: 0, interrompidos: 0, semDestinatario: false, erro: e }))`
(acumulada, não lançada: as podas rodam sempre); resposta ganha `drift: { verificados, pausados, falhas }` em
linha própria; `adiados` e `SEM_DESTINATARIO` entram nos campos que a resposta já tem; `recordCronFailure('ab-watchdog', …)`
quando `falhas > 0`, `adiados > 0` ou `semDestinatario`. Saem `checkDrift`, a leitura de `YOUTUBE_API_KEY`
nesta rota e o `update` de pausa fora da reivindicação.

- [ ] **Passo 1: testes que falham.**

```ts
it('P4a-I17: leitura do drift lança → poda de ab_test_polls roda, drift.falhas = 1, recordCronFailure', async () => { /* … */ })
it('P4a-I18: relógio falso de 12 s por teste, 6 testes → 4 processados, adiados 2, falha registrada', async () => {
  // emParalelo com limite 1 para o teste ser determinístico na conta 0,12,24,36 (o limite 4 é provado à parte)
})
it('emParalelo nunca passa de 4 em voo', async () => { /* contador de concorrência */ })
it('P4a-I4: em_andamento de 14 min não tocado; de 16 min → falhou, interrompido, attempts 1, escreveu null, em mantido; aviso', async () => { /* … */ })
it('23: drift pelo dHash → pausa, aviso, thumbnail pulado_drift sem escrever; no combo o título volta', async () => { /* … */ })
it('ciclo com menos de 3 h é pulado; probeThumb que falha é falha do cron', async () => { /* … */ })
it('P4a-I9: T1 completed (falhou, forcado) e T2 active no mesmo vídeo → o vigia não escreve no T1', async () => { /* … */ })
it('P4a-I19: fanOutToSiteAdmins devolve 0 → SEM_DESTINATARIO na resposta e recordCronFailure', async () => { /* … */ })
it('sem YOUTUBE_API_KEY a fase de drift roda (não depende mais da chave)', async () => { delete process.env.YOUTUBE_API_KEY; /* … */ })
```

- [ ] **Passo 2:** rodar; falham. **Passo 3:** implementar; atualizar o `chain` de
  `ab-watchdog-competitor-history.test.ts` para os métodos novos (`in`, `or`, `rpc`). **Passo 4:** os cinco testes
  da rota + lista inteira, `tsc`, commit:
  `git commit -m "feat: A/B P4a: vigia detecta drift pela imagem, converte em_andamento interrompido e avisa falhas"`.

### Tarefa 12: pipeline (`restore_status`, `leitura` e `end_reason`)

**Files:**
- Modify: `src/lib/pipeline/services/youtube.ts` (`:986-994`, `projetarTeste`), `data/pipeline-docs/cowork-docs-youtube.md`
- Test: `test/youtube/ab-pipeline-null-aviso.test.ts` (`:176`, `:203`), `test/mcp/mcp-schema-parity.test.ts`

**Interfaces:** `projetarTeste` acrescenta `restore_status` (cru, como veio) e `leitura` (`lerRestauracao(paraRestoreStatus(rs), new Date())`);
`restore_seq` fica fora; `CAMPOS_DO_CICLO` ganha `end_reason` (D5). Nenhuma rota nova (sem mudança em
`api-registry.ts`).

- [ ] **Passo 1: testes que falham.**

```ts
it('P4a-I15: restore_status igual byte a byte em get_test (MCP), GET /ab-tests/[id], list_tests e GET /ab-tests', async () => {
  const rs = { title: { estado: 'falhou', destino: 'original', em: '2026-10-12T08:02:00Z', forcado: false, escreveu: false, erro: { status: 403, reason: 'forbidden' }, attempts: 1 } }
  // semente com rs; quatro caminhos; JSON.stringify(x.restore_status) igual nos quatro; 'restore_seq' in x === false
  // leitura.title.tipo === 'final'
})
it('restore_status nulo → leitura null (Review Focus 3)', async () => { /* … */ })
it('ciclo traz end_reason', async () => { /* … */ })
```
  E o teste "coluna futura não vaza" (`:176`) passa a listar `restore_seq` como coluna que **não** sai e
  `restore_status` como coluna que sai.
- [ ] **Passo 2:** rodar; falham. **Passo 3:** implementar; doc: seção nova "GET /ab-tests/:id e list_tests:
  `restore_status` e `leitura`" com a forma por campo, os estados, a regra dos 5 e 15 min, "`restore_status`
  nulo = o teste saiu do ar antes de 10/2026 (regras antigas)", "`restore_seq` é interno e não aparece",
  `end_reason` dos ciclos e os seis valores. **Passo 4:** lista inteira, `tsc`, commit:
  `git commit -m "feat: A/B P4a: restore_status, leitura e end_reason no GET e na lista do pipeline (REST e MCP)"`.

### Tarefa 13: restauração pendente na prévia de remoção de canal (emenda 39)

**Files:**
- Modify: `src/app/cms/(authed)/youtube/_actions/channels.ts` (`getYouTubeChannelRemovalImpact` `:281`), `src/lib/youtube/channel-registry.ts` (`RemovalImpact`), `youtube/_channels/channel-admin.tsx`
- Test: `test/youtube/channel-registry-actions.test.ts`

**Interfaces:** `RemovalImpact` ganha `restauracoesPendentes: Array<{ testId: string; videoTitulo: string; campo: CampoNome; estado: 'falhou' | 'desistiu' | 'em_andamento'; noAr: string }>`
(`noAr`: "a variante B", "o título editado por fora", "não se sabe"); uma leitura de `ab_tests` dos vídeos do
canal com `.or('restore_status->title->>estado.in.(falhou,desistiu,em_andamento),restore_status->thumbnail->>estado.in.(falhou,desistiu,em_andamento)')`.
**Não bloqueia.** Texto na prévia: "O título do vídeo X ficou com a variante B. Depois da remoção, só o
YouTube Studio corrige." (Logan confere na Tarefa 17.)

- [ ] **Passo 1:** teste que falha (P4a-I16): semente com `falhou`, `desistiu` e `em_andamento` → os três
  aparecem com vídeo, campo e o que ficou no ar; `bloqueia` continua `false`. Teste com zero pendentes → lista
  vazia e nenhum texto novo. **Passo 2-4:** implementar, lista inteira, `tsc`, commit:
  `git commit -m "feat: A/B P4a: prévia de remoção de canal avisa restauração pendente"`.

### Tarefa 14: a faixa de restauração (só leitura)

**Files:**
- Create: `AB/_components/faixa-restauracao.tsx`, `AB/_components/faixa-restauracao-texto.ts`
- Modify: `AB/queries.ts` (detalhe passa `restore_status`, variantes com rótulo, `name`, id do vídeo no YouTube), `src/lib/youtube/ab-types.ts` (`AbTestBaseView` ganha `restoreStatus: RestoreStatus | null`), `AB/[testId]/page.tsx` (faixa no topo do teste encerrado ou pausado, e no ativo quando houver `em_andamento`)
- Test: `test/youtube/faixa-restauracao.test.tsx` (`// @vitest-environment jsdom`)

**Interfaces:**
```ts
// faixa-restauracao-texto.ts (puro; todos os textos do mockup, versão P4a)
export type Tom = 'busy' | 'warn' | 'err' | 'ok' | 'none'
export interface LinhaFaixa { campo: CampoNome; rotulo: 'Título' | 'Thumbnail'; tom: Tom; texto: string; hora?: string }
export interface Faixa { tom: Tom; lbl: string; resumo: string; linhas: LinhaFaixa[]; linkStudio: string | null; fine: string | null; papel: 'region' | 'status' | 'alert' } | { tom: 'ok'; okline: string }
export function montarFaixa(rs: RestoreStatus | null, ctx: { agora: Date; rotulo: (variantId: string) => string; noArAntes: string; youtubeId: string }): Faixa | null
export function horaSP(iso: string): string    // "12/10 05:02", Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })
```

**Mapa de estados → texto (copiar do mockup, versão P4a; nada inventado):**

| Mockup | Condição | Resumo | Linha do campo |
|---|---|---|---|
| A1 | algum `em_andamento` ≤ 5 min, destino original | "Voltando ao original…" + "Título e thumbnail estão sendo trocados no YouTube." | "Trocando desde **[hora]**." |
| A2 | idem, destino variante | "Trocando pela variante B…" | idem; campo já `ok`: "Variante B aplicada em [hora]." |
| A3 | `sem_resposta` (> 5 min, ou `falhou`/`interrompido`) | "Atenção:" "Não sabemos se voltou ao original." (variante: "Não sabemos se a variante B foi aplicada.") | "Sem resposta desde **[hora]**. Não sabemos se a troca foi feita. Confira o título no YouTube Studio." (thumbnail: "…Confira a thumbnail no YouTube Studio.") + link |
| B | todos `ok` | — (sem faixa, uma linha) | "Título e thumbnail voltaram ao original em [hora]." / "Variante B no ar desde [hora]." (um campo: "O título voltou…"/"A thumbnail voltou…") |
| C | `falhou`, destino original | "Erro:" "o título não voltou ao original. O título no ar ainda é o da variante C." | "O YouTube recusou em **[hora]**. Corrija no YouTube Studio." + link + "Este aviso ainda não pode ser dispensado." |
| D | `falhou`, destino variante, `forcado` | "Erro:" "o título da variante B não foi aplicado. No ar continua o título editado por fora." | "O YouTube recusou em **[hora]**. A troca que você confirmou não foi feita. Corrija no YouTube Studio." + fine |
| D2 | `falhou`, destino variante, sem `forcado` | "Erro:" "o título da variante B não foi aplicado. No ar continua o da variante C." | "O YouTube recusou em **[hora]**. Corrija no YouTube Studio." + fine |
| E | `pulado_drift` sem motivo | "Atenção:" "a thumbnail no ar não é de nenhuma variante deste teste: alguém editou por fora. Nada foi alterado." | "Mantida como está no YouTube desde [hora]." + fine |
| F | `pulado_drift`, `sem_base_de_comparacao` | "Atenção:" "não foi possível comparar a thumbnail no ar com as variantes. Nada foi alterado." | "Não medida: sem imagem de referência para comparar." (tom `none`) |
| G | `pulado_sem_original` | "Atenção:" "o título original não foi guardado quando o teste começou. Nada foi alterado." | "Continua o da variante C, no ar desde [hora]." + "Abrir no YouTube Studio para conferir" |
| — | `desistiu` (`video_inexistente`, `novo_teste`) | **sem texto no mockup: Q6 ao dono** antes do envio | — |

"O título no ar ainda é o da variante C" / "No ar continua o da variante C": `noArAntes` = rótulo da variante
do último ciclo fechado (a que estava no ar quando o teste saiu); campo `thumbnail` troca "o título" por "a
thumbnail". Uma linha por campo quando os estados diferem; a cor da borda é a do pior estado
(`err` > `warn` > `none` > `busy` > `ok`). Papel: `region` com `aria-label="Restauração do vídeo"` ao carregar;
`alert` só depois de uma ação na mesma sessão (Tarefa 15); E/F/G com `status`. Link "Abrir no YouTube Studio":
`https://studio.youtube.com/video/<youtubeId>/edit`. Topo: "Horários de São Paulo". `restore_status` nulo →
`null` (sem faixa; Review Focus 3). `{}` → `null`. Miniaturas não entram na faixa.

**Estilo:** tokens reais do CMS (`--cms-*`/`--color-cms-*`) e os tokens de estado do mockup, declarados no CSS
da faixa para os dois temas: escuro `--t-ok #4ADE80`, `--t-warn #FBBF24`, `--t-err #F87171`, `--t-info #38BDF8`;
claro (`[data-theme="light"]`) `#126B35`, `#7A4E00`, `#A4261B`, `#0B5F82`, com `*-line` e `*-bg` copiados do
mockup; `--band-sub` `#C9BFAA`/`#3F3727`. **Zero `color-mix()`.** Ícone + texto + cor em todo estado (nunca só
cor). Animação do giro respeita `prefers-reduced-motion` (como `youtube-motion.css`).

- [ ] **Passo 1: testes que falham** (P4a-E9, E10, E11, E12 no nível de componente):

```tsx
it.each(['A1', 'A2', 'A3', 'B', 'C', 'D', 'D2', 'E', 'F', 'G'] as const)('estado %s: texto exato do mockup', (e) => {
  const f = montarFaixa(SEMENTES[e], ctx)
  expect(f).toMatchSnapshot()            // o snapshot é conferido à mão contra o mockup UMA vez (Tarefa 17)
})
it('nulo e {} → sem faixa (nunca "voltou ao original")', () => {
  expect(montarFaixa(null, ctx)).toBeNull(); expect(montarFaixa({}, ctx)).toBeNull()
})
it('horaSP igual com o processo em Asia/Tokyo e em America/Sao_Paulo', () => {
  expect(horaSP('2026-10-12T08:02:00Z')).toBe('12/10 05:02')
})
it('virada de dia perto da meia-noite de SP', () => expect(horaSP('2026-10-13T02:59:00Z')).toBe('12/10 23:59'))
it('nenhum botão e nenhuma frase de nova tentativa', () => {
  render(<FaixaRestauracao faixa={montarFaixa(SEMENTES.C, ctx)!} />)
  expect(screen.queryAllByRole('button')).toHaveLength(0)
  expect(document.body.textContent).not.toMatch(/nova tentativa|Tentar agora|dispensar/i)
  expect(screen.getByText('Este aviso ainda não pode ser dispensado.')).toBeTruthy()
})
it('<script> no rótulo aparece como texto', () => { /* … */ })
it('nenhum undefined, null ou NaN no texto de nenhum estado', () => { /* varre as sementes */ })
it('guarda do Opera: sem color-mix nos arquivos da faixa e do diálogo', () => {
  const fs = require('node:fs') as typeof import('node:fs')
  for (const f of ['faixa-restauracao.tsx', 'ab-end-test-dialog.tsx', 'ab-confirmar-troca-dialog.tsx'])
    expect(fs.readFileSync(`src/app/cms/(authed)/youtube/ab-lab/_components/${f}`, 'utf8')).not.toMatch(/color-mix/)
})
```
  O teste de fuso roda com `process.env.TZ = 'Asia/Tokyo'` definido **antes** do import (arquivo próprio ou
  `vi.stubEnv` + `vi.resetModules`).
- [ ] **Passo 2-4:** implementar, lista inteira, `tsc`, commit:
  `git commit -m "feat: A/B P4a: faixa de restauração só de leitura, com os textos do mockup e horário de São Paulo"`.

### Tarefa 15: o diálogo "O que fica no vídeo?"

**Files:**
- Modify (reescrita): `AB/_components/ab-end-test-dialog.tsx`; `AB/_components/ab-pause-dialog.tsx` (passa a ler o resultado)
- Create: `AB/_components/ab-confirmar-troca-dialog.tsx`
- Test: `test/youtube/ab-end-test-dialog.test.tsx` (`// @vitest-environment jsdom`); specs Playwright do Gio em `e2e/ab-lab-p4a-*.spec.ts`

**Interfaces:**
- Consome: `endAbTest`, `pauseAbTest` por **props** (callbacks; nunca importar server action no client), `ResultadoAcaoSaida` (T7).
- Props: `{ aberto, onFechar, testeNome, noArAgora: { rotulo: string; desde: string }, opcoes: Array<{ id: string; rotulo: string; isOriginal: boolean; titulo: string | null; miniatura: string | null }>, originalBaixaResolucao: boolean, podeDeixarVariante: boolean, encerrar: (o: OpcaoEncerrar) => Promise<ResultadoAcaoSaida> }`

**Comportamento (mockup P4a; Logan N1–N3; Naksu R2-2, R2-3):**
- `YtPortal` + `useModalFocusTrap`; `role="dialog"`, `aria-labelledby` no título "Encerrar teste", `aria-describedby`
  na frase "A rotação para. No ar agora: variante C, desde 07/10 05:00." (R2-2); `fieldset` + `legend` "O que fica no vídeo?".
- **Nenhuma opção marcada**; botão principal `aria-disabled` com "Escolha uma opção."; marcado → "Encerrar e ficar
  com B" / "Encerrar e ficar com A (original)". Ordem de Tab: opções, Encerrar, Cancelar. Esc fecha; o foco volta
  ao botão que abriu.
- `originalBaixaResolucao` (`dimensions.width ≤ 480` da `is_original`) → "O original foi guardado em baixa resolução."
- Sem permissão: opções de variante desabilitadas com "Só quem administra o site pode deixar uma variante no ar.
  Você pode voltar ao original."; `.opt.dis.sel .ttl,.who{color:var(--text)}` (R2-3).
- Miniatura 84×47 (64×36 a 390 px), `alt=""`, "Sem imagem" em `onError`; `max-height: calc(100dvh - 24px)`; X
  e botões ≥ 44 px (`.ic-btn`).
- Enviando: botão "Encerrando…" travado (uma requisição só, mesmo com duplo clique: `useRef` de voo), frase
  "Trocando título e thumbnail no YouTube / Pode levar até 1 minuto. Se fechar, o resultado aparece no topo da
  página."; X e Esc livres. Depois de **45 s** sem resposta, ou rede caída: "Sem resposta / Não sabemos se o
  encerramento foi feito. Recarregue a página para ver o resultado." com "Recarregar" e "Fechar", **sem** botão de
  repetir Encerrar.
- `em_andamento` → "Não foi possível encerrar / Outra tentativa está em andamento. Tente de novo em instantes."
  (opção mantida, foco não se move). `ja_encerrado` → fecha e `router.refresh()`.
- `precisa_confirmar` → `alertdialog` "Trocar mesmo assim?" (`ab-confirmar-troca-dialog.tsx`), foco em "Voltar";
  "No YouTube agora" e "Variante B" lado a lado (título em texto; thumbnail pela URL pública devolvida); um
  diálogo só para título e thumbnail, corpo rola a 390 px; botão "Trocar pelo título de B e encerrar" (thumbnail:
  "Trocar pela thumbnail de B e encerrar"; os dois: "Trocar título e thumbnail por B e encerrar" — **conferir as
  três frases no mockup**); "Voltar" devolve à escolha com B marcada; só esse botão envia `forcar: true`.
- `feito` com campo `falhou` ou `pulado_*` → fecha, foco na faixa (que vira `role="alert"`) e aviso de página
  `role="status"` por 6 s, com fechar: "Teste encerrado. O YouTube recusou a troca do título: veja o aviso no
  topo." (thumbnail: "da thumbnail"; os dois: "do título e da thumbnail") (Logan N2, N3). `feito` tudo `ok` →
  fecha e `router.refresh()`.
- Sessão expirada (`unauthenticated`) → `router.push` para o login; nada muda no banco.
- Some "Aplicar variante lider" e "Arquivar sem aplicar" (P4a-E14).

- [ ] **Passo 1: testes que falham** (componente; o Playwright é da Tarefa 17):

```tsx
it('E1: nenhuma opção marcada, botão aria-disabled com "Escolha uma opção."', () => { /* … */ })
it('E2: marcar B muda o botão para "Encerrar e ficar com B"', () => { /* … */ })
it('E3: duplo clique → encerrar chamado uma vez; 45 s sem resposta → "Sem resposta", sem botão Encerrar', async () => {
  vi.useFakeTimers(); /* encerrar retorna promessa que nunca resolve; dois cliques; avança 45_000 */
})
it('E5: em_andamento → mensagem exata, B continua marcada', async () => { /* … */ })
it('E7: precisa_confirmar → alertdialog com foco em Voltar; Voltar mantém B; Trocar envia forcar: true', async () => { /* … */ })
it('E8: sem permissão → variantes desabilitadas com a frase; miniatura quebrada mostra "Sem imagem"', () => { /* … */ })
it('aviso de página por campo recusado: título, thumbnail e os dois', async () => { /* … */ })
it('E14: nenhum texto antigo', () => { expect(document.body.textContent).not.toMatch(/Aplicar variante l[ií]der|Arquivar sem aplicar|Aplicar vencedor|Cancelar carência/) })
```
- [ ] **Passo 2-4:** implementar, lista inteira, `tsc`, commit:
  `git commit -m "feat: A/B P4a: diálogo O que fica no vídeo, com confirmação da troca e estado sem resposta"`.

### Tarefa 16: o portão: conserto Y-7, `devolver-hq` e `medir`

**Files:**
- Modify: `src/lib/youtube/portao-dhash/{executar,diario}.ts`, `scripts/portao-dhash.ts`
- Test: `test/youtube/portao-dhash/{executar,diario}.test.ts`

**Interfaces:**
- `devolver-hq <video>`: ciclo `valer` (sobe a imagem de teste, espera aparecer) e devolve **`original-hq.jpg`**
  (a `hqdefault` 480×360 baixada no `preparado`) em vez da maior; recusa vídeo com `maxresdefault` (o objetivo é
  medir a cópia pequena); mede a distância da `hqdefault` servida contra `original-hq.jpg` em T+0 e até 3 h.
  Cota: `thumbnails.set` 50 + 50 + `videos.list` 1 = **~101 unidades**. Vídeo fora de `VIDEOS_APROVADOS` exige
  acrescentar o id na lista (decisão do dono, Q1) num commit desta tarefa.
- `medir <video> <url|arquivo>...` (cota **0**): baixa a `hqdefault` pública e imprime, para cada referência
  (arquivo local ou URL do Blob), a distância dHash (`dhashComoHq` da referência contra `dhashOf` da
  `hqdefault`) e "dentro de 6"/"fora de 6". É o comando do E3 do ensaio.
- Conserto Y-7: o diário grava a ETag **crua** e qualquer erro da sonda de antes; a (ii) conclui pela ETag do
  teste contra a da volta (numérica e **posterior** à devolução), não pela de antes.

- [ ] **Passo 1: testes que falham.** `medir` com `fetch` falso (hqdefault e duas referências) imprime duas
  linhas com distância; `devolver-hq` com vídeo que tem `maxresdefault` → recusa com código de saída 2 e **zero**
  chamadas de escrita; `devolver-hq` feliz → a imagem devolvida é exatamente `original-hq.jpg` (sha256); diário
  com ETag crua `W/"1792001270"` gravada como veio; (ii) com ETag de volta numérica maior que a do teste e
  posterior → "passou"; menor → "sem conclusão".
- [ ] **Passo 2-4:** implementar; **Yannis revê o script** (ele escreve no YouTube; emenda 30) antes do commit;
  `vitest portao-dhash` + lista inteira, `tsc`, commit:
  `git commit -m "feat: A/B P4a: portão ganha devolver-hq e medir; diário guarda ETag crua (Y-7)"`.
- [ ] **Passo 5 (o dono, antes da promoção a `main`):** o Gio prepara `.superpowers/sdd/ab-lab/p4a-devolver-hq.sh`
  (`bash scripts/portao-dhash.sh devolver-hq <video>`), o comando curto vai ao `pbcopy`; resultado no ledger.
  **Dentro de 6 bits: segue. Acima de 6:** a original passa a guardar também o dHash da `hqdefault` lida ao
  iniciar e "é o original" aceita qualquer um dos dois (emenda 30) — é uma tarefa extra antes da promoção.

### Tarefa 17: prova local, capturas e revisão de tela

- [ ] Suíte completa (`npx vitest run > /tmp/ab-p4a-suite.log 2>&1`, em background; só as falhas no contexto).
- [ ] Integração no `bythiago_int`: `HAS_LOCAL_DB=1 … npx vitest run test/integration/ab-p4a-*.test.ts test/integration/ab-restore-status-forma.test.ts`.
- [ ] `next build` da árvore (background, saída em arquivo) com `apps/web/.env.production.local`.
- [ ] **Gio** (Sonnet, `medium`): Playwright P4a-E1 a E15 no Supabase local padrão (runbook
  `docs/ops/runbook-cms-e2e-local.md`), semente da seção 4.1 do aceite (T-ativo-combo … T-restore-status-vazio),
  `youtube-client` e Blob mockados (nenhum clique com vídeo real); 1440 e 390 px, dois temas, `timezoneId`
  `America/Sao_Paulo` e `Asia/Tokyo`; cada spec três vezes seguidas; capturas em
  `docs/superpowers/mockups/2026-10-14-ab-lab-p4-dialogo-e-faixa/p4a-implementado-shots/`; console e rede limpos.
- [ ] **Logan e Naksu** (Sonnet, `medium`) conferem as capturas contra o mockup; Logan fecha o texto do aviso do
  sininho, o da prévia de remoção e propõe o de `desistiu` (Q6); Naksu mede contraste nos dois temas e confirma
  R2-2/R2-3. Diferença de frase ou de estado → volta ao dono (emenda 31).
- [ ] O dono aprova as capturas e o texto de `desistiu`. Apagar `.env.development.local` e `.env.production.local` da árvore.

### Tarefa 18: envio

- [ ] Revisão do lote por **Phil e Yannis** (Opus, `medium`) sobre `git diff origin/staging..lote/ab-p4a`;
  conserta-se até haver acordo.
- [ ] **M0-2 de novo** (o dono cola; esperado 0) na manhã do envio.
- [ ] **Migration da P4a, no dia e janela da seção 1:** no checkout principal, `npm run db:new ab_p4a_reivindicacao`,
  colar o SQL da Tarefa 1 (o do plano, com as correções anotadas), o dono roda `npm run db:push:prod`. **M0-5**
  (o dono cola):
  ```sql
  select proname, pg_get_function_identity_arguments(oid) from pg_proc
   where proname in ('ab_settle_claim', 'ab_rotate_commit', 'rotate_cycle') order by 1;
  select has_function_privilege('anon', 'public.ab_rotate_commit(uuid, integer, uuid, integer, jsonb, integer, integer)', 'execute') as anon_executa,
         has_function_privilege('authenticated', 'public.ab_settle_claim(uuid, integer, text[], text, text, jsonb, jsonb)', 'execute') as auth_executa;
  ```
  Esperado: duas linhas (sem `rotate_cycle`), `false, false`. Copiar o arquivo da migration para a árvore e
  commitá-lo **lá** (`git commit -m "feat: A/B P4a: migration ab_settle_claim, ab_rotate_commit e sai rotate_cycle"`);
  no checkout principal o arquivo fica só até a junção de volta.
- [ ] Conferências: `bash scripts/check-type-debt.sh`; `git diff --name-only origin/staging lote/ab-p4a -- supabase/` = só o arquivo da migration aplicada.
- [ ] Junção com `origin/staging` se o remoto andou (E9 T11a: conflito no objeto da resposta do vigia; rodar os
  cinco testes da rota); `bash -c 'git push origin lote/ab-p4a:staging'`; CI verde (conferir a cada push).
- [ ] **`devolver-hq` rodado e dentro de 6** (Tarefa 16, passo 5) **e M0-2 = 0** → promoção a `main`; deploy da
  Vercel termina.
- [ ] Junção de volta ao `staging` local (só para os terminais verem; nada é enviado dali), com o outro terminal
  avisado, nunca `stash`: `git diff --name-only HEAD -- <arquivos do lote>` vazio antes.
- [ ] Aviso à A5 (E18): `restore_status` e `ab_test_restores` estão em produção; a E18 lê `escreveu` nulo como
  `nao_se_sabe` e usa `lerCampoDeRestauracao` (ou declara que lê 15 min).

### Tarefa 19: o ensaio com o dono (aceite de produção; emendas 41 e 48)

Pré-condições (reprova antes de começar): M0-1, M0-2, M0-3 e M0-5 no ledger; `devolver-hq` dentro de 6; a
emenda da E18 em produção; o comando `medir` disponível; o vídeo do ensaio escolhido pelo dono (antigo, pouca
view); B com título diferente e thumbnail visivelmente diferente (distância > 6 pelo `medir`).

| # | Quando | O que o dono faz | O que prova |
|---|---|---|---|
| E0 | Dia 1 | Cria o combo (rascunho), tira print da descrição, **muda o título no Studio**, inicia | `original_title` = título novo |
| E1 | Dia 1 | Inicia (A original no ar) | nada muda no vídeo; ciclo 0 aberto; `restore_seq = 1`; `restore_status` nulo ou `{}` |
| E2 | Dia 2, depois das 05:15 SP | Abre YouTube e A/B Lab | B no ar; ciclo 0 `rotacao`, ciclo 1 aberto em B; descrição e idioma intactos; `medir` ≤ 6 de B |
| E3 | Dia 2 | Pausa | faixa B; título = `original_title` do E0; `medir` ≤ 6 da original em T+0, T+30 min, T+3 h; D10: ciclo 1 `pausa`, dois `ok`, duas linhas `escreveu = true` |
| E4 | Dia 2 | Retoma | `active`, `restore_status = {}`, histórico intacto, um ciclo aberto |
| E5 | Dia 2 | Encerra pelo diálogo, escolhendo a original; roteiro do Opera (5 min) | `manual_archive`, sem dado de vencedor; original no ar |
| E6 | Dia 2 | Cola no Cowork o texto pronto; o mesmo pelo Claude Code | `restore_status` e `leitura` iguais à tela e à consulta; `restore_seq` ausente |
| E7 | Dia 2 | Abre Lista, Detalhe e Diálogo | nenhum "aplicar vencedor" nem "cancelar carência" |
| E8 | Dia 2, fim | Compara a descrição com o print do E0 | idêntica (bloqueia) |

Consultas D10 depois de cada passo (o Gio prepara o `.sh`; o dono cola):
```sql
select t.status, t.restore_seq, t.restore_status, c.cycle_number, c.ended_at, c.end_reason
  from ab_tests t left join ab_test_cycles c on c.test_id = t.id where t.id = '<id>' order by c.cycle_number;
select seq, campo, destino, estado, escreveu, em from ab_test_restores where test_id = '<id>' order by seq, campo;
```
Texto do E6 para o Cowork (o controlador preenche `<id>`):
> Sem usar memória nem prompts salvos, leia pelo pipeline o teste A/B `<id>` (`get_test`) e a lista de testes (`list_tests`), e me devolva o JSON cru de `restore_status`, `leitura` e dos ciclos (com `end_reason`) das duas respostas. Diga se aparece `restore_seq`. Não corrija nada, só relate.

Herda o P2-P5: depois do ensaio, zero `grace_expires_at` não nulo e zero `auto_resolve`. No ledger e no relatório
de release, os estados da seção 4.3 do aceite vão com a linha literal **"não verificado em produção"**. Ensaio
que falha: o primeiro teste **não** é liberado; defeito com passos e consulta ao Yannis (código) ou Phil (dado);
recomeça do E0 num vídeo limpo.

## 6. Chamadas de escrita ao YouTube (todas), cota e o que acontece em erro

| Quem | Chamada | Cota | Relê antes? | Erro |
|---|---|---|---|---|
| `settleOnAir`, título | `videos.list` + `videos.update` (snippet completo relido) | 1 + 50 | `restore_seq` e o `snippet` imediatamente antes | HTTP → `falhou {status, reason}`, `escreveu: false`; timeout/rede no `PUT` → `escreveu: null`; sem `description` → aborta, `falhou` |
| `settleOnAir`, thumbnail | Blob + `thumbnails.set` | 0 + 50 | `restore_seq` | idem; Blob 404 do destino → `falhou` (D7) |
| Rotação do cron e forçar | `applyVariantToYouTube` (título 1 + 50, thumbnail 50) | até 101 por teste/dia | reivindicação + `restore_seq` | 401/403/429 contam; `quotaExceeded` não; 3ª → `settleOnAir(falha_api)`; reivindicação perdida depois da escrita → Sentry + aviso |
| Retomar | `applyVariantToYouTube` | até 101 | reivindicação + `restore_seq` | regrava o `restore_status` anterior; fica `paused` |
| Iniciar | `videos.list` (releitura) + `applyVariantToYouTube` se a 1ª não é a original | 1 (+ até 101) | reivindicação + `restore_seq` | volta a `draft`, erro na tela; fila: `queued` +1 dia e aviso |
| Vigia, drift | `settleOnAir(drift)` (só título no combo; thumbnail fica `pulado_drift`) | 1 + 50 | idem `settleOnAir` | leitura que falha é falha do cron |
| Portão `devolver-hq` (dono, uma vez) | `thumbnails.set` ×2 + `videos.list` | ~101 | — | script para e devolve a original (I3 da P4-0) |
| Leituras sem cota | `hqdefault` (HEAD + GET), Blob | 0 | — | linha 5 |

Pior dia típico: 1 teste combo ativo = 101 (rotação) + 2 × 1 (vigia sem drift: 0) ≈ 101 unidades; uma pausa e
um encerramento no mesmo dia ≈ +204. A cota é 10 000.

## 7. Aceite

Seção 5 do spec, itens 14 a 25, e o aceite do Gio (seções 3 e 4), amarrados assim:

| Item | Onde |
|---|---|
| 14 portão | P4-0 feita; `devolver-hq` na Tarefa 16 |
| 15 tabela 3.3 e 3.1 | Tarefas 5 e 6 |
| 16, 17, 18, 19 | Tarefas 5, 6 e 7 |
| 20 `precisa_confirmar`/`forcar` | Tarefas 6 e 15 (a "nova tentativa repete forçando" é da P4b) |
| 21 falhas | Tarefas 3, 6 e 8 (terceira falha → `desistiu` é da P4b) |
| 22 corridas | Tarefas 6, 7, 9, 10 (`retryRestore` × vigia é da P4b) |
| 23 drift | Tarefa 11 |
| 24 original relido | Tarefa 10 |
| 25 Migration 0 aborta e é idempotente | já provado na Migration 0 (ledger); M0-1 confere |
| M0-1 a M0-5 | Tarefas 0, 1 e 18 |
| P4a-I1 a I20 | I1 T7; I2, I3, I12(código), I20 T6; I4, I9, I17, I18, I19 T11; I5 T2; I6, I10, I11 T10; I7, I8 T9; I12, I13, I14 T1; I15 T12; I16 T13 |
| P4a-E1 a E15 | Tarefas 14 e 15 (componente) e 17 (Playwright do Gio) |
| E0 a E8 | Tarefa 19 |

## 8. O que acontece quando o dado não existe, e em cada falha

| Situação | O que acontece | Por quê não é "verde" falso |
|---|---|---|
| `restore_status` nulo (teste antigo) | sem faixa; `leitura: null` no `GET` | nunca inventa "voltou ao original" (P4a-E10) |
| `{}` | sem faixa | código novo, nada pendente |
| `original_title` nulo / original fora do Blob | `pulado_sem_original` no campo; faixa G | nada é escrito; o dono vê |
| Variante sem `thumbnail_dhash` | calculado na hora e gravado | — |
| Arquivo da variante sumiu do Blob | linha 4 (`sem_base_de_comparacao`), ou `falhou` se for o destino | faixa F ou C/D |
| `hqdefault` não responde | `falhou` (linha 5); no vigia, `falhas++` e `recordCronFailure` | não é "sem drift" |
| Vídeo apagado | `desistiu/video_inexistente`, aviso | texto da faixa: Q6 |
| Canal removido ou token morto | `falhou` com motivo (linha 6) e aviso | — |
| Função morre no meio | `em_andamento`; tela diz "Sem resposta" aos 5 min; vigia grava `interrompido` aos 15 | E18 lê `escreveu: null` como `nao_se_sabe` |
| Ninguém recebe o aviso | `SEM_DESTINATARIO` + `recordCronFailure` (cron) ou Sentry (ação humana) | P4a-I19 |
| Sem teste ativo | `ab-rotate` e vigia verdes sem tocar nada | declarado; o ensaio é a prova |
| `ab_rotate_commit` ausente em produção | `ab-rotate` falha todo dia às 05:00 | M0-5 antes do push; o erro do RPC lança e vira `errors++` com Sentry (o `catch` não é largo) |

## 9. Como se reverte

- **Código:** `git revert` dos commits do lote em `staging` e promoção. O banco continua com
  `ab_settle_claim`/`ab_rotate_commit` sem chamador (inofensivo: `service_role` só).
- **`rotate_cycle`:** o código revertido **não** a chama (nunca chamou); não precisa voltar. Se precisar:
  recriar com o corpo de `20260531000014` **e** o `revoke` de `anon`/`authenticated` (nunca reabrir o buraco).
- `restore_status` e `ab_test_restores` ficam (Migration 0 é aditiva); o código antigo os ignora; testes que
  saíram do ar pelo código novo ficam com `restore_status` preenchido e o leitor antigo não o lê.
- O rollback instantâneo da Vercel para antes da P4a funciona (o código antigo não chama as funções novas).

## 10. Riscos que ficam, sem suavizar

1. **Escrita da rotação em voo terminando depois da restauração de uma pausa** (32 h): janela de segundos às
   05:00 SP; o aviso "a rotação e uma pausa se cruzaram" pede conferência manual. Não verificado em produção.
2. **Thumbnail "ok" falso nas primeiras 3 h depois de uma troca feita fora do app:** a regra das 3 h só olha
   escritas do app; uma troca manual há 1 h que coincida com uma variante é lida como "é a variante".
3. **`escreveu: null` em timeout do `PUT`:** o YouTube pode ter aplicado; a faixa diz "falhou". A P4b tenta de
   novo; até lá o dono confere no Studio.
4. **Drift de título não é detectado** (3.3): só pelo diálogo (`precisa_confirmar`) e pela restauração.
5. **`hqdefault` pública com cache da CDN:** a leitura pode ver a imagem anterior por minutos; é a razão da regra
   das 3 h, e vale também para o vigia (ciclos com menos de 3 h são pulados).
6. **Cópias velhas da original no Blob ficam órfãs** (uma por início; Y-15, dívida declarada).
7. **Ação humana sem resposta em 45 s com o servidor ainda vivo:** a tela diz "Sem resposta" e o servidor pode
   terminar `ok` depois; recarregar mostra o certo.
8. **`desistiu` sem texto aprovado** até a Q6: sem resposta do dono, o envio não sai.

## 11. Perguntas abertas para a revisão final

| # | Pergunta | Recomendação | Quem |
|---|---|---|---|
| Q1 | Qual vídeo **sem `maxresdefault`** para o `devolver-hq`? Entra em `VIDEOS_APROVADOS` | o dono escolhe; o Gio lista candidatos por `curl -sI https://i.ytimg.com/vi/<id>/maxresdefault.jpg` (404) | dono |
| Q2 | `ab_settle_claim` (D1) ou dois comandos + reparo no vigia | `ab_settle_claim` | Phil, Yannis |
| Q3 | `p_views`/`p_likes` e zerar falhas em `ab_rotate_commit` (D2) | sim | Phil (forma, D12) |
| Q4 | Nome do campo derivado: `leitura` (spec) ou `restore_leitura` | `leitura` | Phil, Yannis |
| Q5 | `em` mantido no `interrompido` (D6) | manter | Phil |
| Q6 | Texto da faixa para `desistiu` (`video_inexistente`, `novo_teste`), que o mockup não tem | Logan propõe na Tarefa 17; o dono aprova antes do envio | dono |
| Q7 | Contraste de `--color-cms-on-accent` no claro (3,39:1, Naksu R2-1) | o diálogo usa `#FFF8F0` local; o token do CMS é pendência separada | Naksu, dono |
| Q8 | A P4a não espera a Migration A (só o código da P3) | confirmar | Phil, Yannis |
| Q9 | Emenda 45: E18 em produção antes do primeiro teste | mantém; o ensaio exige | Hanna |
| Q10 | `destino` de retomar/rotação = id da variante (D3) em vez de `'variante'` | id | Phil (avisar a E18) |
