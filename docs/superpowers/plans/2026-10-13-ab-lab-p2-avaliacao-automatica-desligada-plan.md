# A/B Lab honesto, P2: avaliação automática desligada (plano de implementação)

Escrito em 13/10/2026 (noite). Primeira versão; **a emenda 1 responde à rodada 1 de revisão de Phil, Yannis e Gio** (a Hanna veio na emenda 2; Logan e Naksu julgam as telas na Tarefa 6). Onde cada achado foi aplicado: `.superpowers/sdd/ab-lab/resposta-r1-p2.md`; decisões do controlador: `emenda-1-decisoes-do-controlador.md`. Trechos mudados levam a marca `(emenda 1: <id>)`.
**A emenda 2 aplica a rodada 2 (Phil, Yannis, Gio) e o parecer da Hanna** (`emenda-2-decisoes-do-controlador.md`; onde cada item foi aplicado: `resposta-r2-p2.md`); trechos mudados levam `(emenda 2: <id>)`, com `G2-`, `S2-`, `D2-` e `H2-`. **Estado: acordo de Phil, Yannis, Gio e Hanna; espera o "pode" do dono.**
Spec: `docs/superpowers/specs/2026-10-07-ab-lab-honesto-design.md` (v6: seções 4.1 e 4.2.1, bloco P2 da
seção 1, aceite 6 a 9, emendas 23, 24 e 26, e "Respostas do dono (13/10/2026)" no fim). Inventário de
código, lido em 13/10 no HEAD `bc5adea94`: `.superpowers/sdd/ab-lab/inventario-p2.md` (toda linha citada
aqui vem dele; **quem executa reconfere por `grep` no dia**). Plano irmão, que vai antes:
`2026-10-13-ab-lab-p1-fadiga-e-video-em-alta-saem-plan.md` (chamado aqui de "plano da P1").

> **Para quem executa:** use `superpowers:subagent-driven-development`, tarefa por tarefa. Passos com
> caixa (`- [ ]`). Sonnet, effort `medium` em tudo. (emenda 2: H2-effort) A exceção única: a revisão da
> Tarefa 1 (o cron que decide encerrar teste) sobe para `high` **se o executor errar duas vezes**. Nada mais
> em `high` neste plano.

**Objetivo, em uma frase.** O cron `ab-evaluate` para de declarar vencedor, abrir carência, criar
playoff e aplicar qualquer coisa a partir de "impressões" que são views e cliques que são sempre zero; a
tela e o pipeline param de mostrar os números que saíam disso.

**Como.** O cron fica com um ramo só: teste ativo que passou da duração máxima volta ao original (com a
restauração que existe hoje, agora com falha **visível**: `status_note` e `errors++`, emenda 1: S-C7) e
encerra como `inconclusive`, sem vencedor nem carência (emenda 1: S-C8). Saem duas fases inteiras, a variável
`AB_AUTO_APPLY_WINNER`, as configurações que ficaram sem efeito, os números fabricados da tela (resposta
10 do dono) e, no pipeline, os campos de entrega passam a `null` com `aviso` (resposta 7).

**Stack.** Next.js 16, TypeScript estrito, Vitest, zod 3.25.76 (instalado; `import { z } from 'zod'` segue a API v3). **Nenhuma migration.** Contrato dos serviços do pipeline, para todo molde de teste deste plano (emenda 1: S-C3, S-C12): os serviços **lançam** `PipelineServiceError` (`err()` em `services/types.ts:55-57`) e devolvem `{ data, status }`; **não existe `r.ok`**. Recusa se afirma com `await expect(...).rejects.toMatchObject({ status: 400 })`.

## Fica FORA deste plano

- `settleOnAir` e tudo de P4: a restauração da duração máxima continua a de hoje (só thumbnail, só se o
  original está no Blob, **sem garantia**). ~~O defeito conhecido fica: se a restauração falha, o erro vai
  ao Sentry e o teste encerra assim mesmo, com a variante no ar.~~ (emenda 1: S-C7) Agora a falha deixa de
  ser silenciosa: o teste encerra, grava `status_note` com o motivo e o cron conta `errors++`. A
  **garantia** de que a variante sai do ar continua sendo da P4. Ver riscos.
- A descrição (P3). As duas fases apagadas são as que citam descrição; a P3 não precisa mais editá-las.
- Tela nova de qualquer tipo, o acompanhamento novo e as views por variante (etapa de telas).
- O painel de critérios ("gates") e a confiança bayesiana **na tela**: continuam, calculados sobre o
  mesmo dado, **salvo a Tarefa 3b** (emenda 1: D-P2-8; emenda 2: H2-3b: a Hanna recomenda que entre, e entra com o sim do dono à pergunta 13), que os troca pela frase
  fixa. O spec só tira os quatro números de 4.2.1; o resto é da etapa de telas. Ver "Sobra declarada".
- `ab-backfill`: continua gravando views como `impressions` nos ciclos (spec 4.1). P2 muda só o que o
  pipeline **entrega**.
- `applyWinnerNow`, `cancelGracePeriod` e `revertWinner` (`ab-lab/actions.ts`): ficam; apagar os dois
  primeiros é a pergunta 6 do spec, que vai com a v7 e a P4.
- A função SQL `create_playoff_test`: fica no banco, sem chamador (a Migration B da P3 a recria).
- Impressão real por variante no pipeline: é da medição nova (parecer da Hanna, 3.4).
- (emenda 2: H2-P5) O critério **P2-P5** (o primeiro teste real encerrado pelo cron) **não é desta P2**: o primeiro teste real já roda sob `settleOnAir`, então ele passa para a **P4**. A C5 da Tarefa 8 fica como roteiro herdado pela P4.

## Restrições globais

- **Escolher o que fica no ar é decisão humana.** Depois de P2 nenhum caminho automático grava
  `winner_variant_id`, `grace_expires_at`, `winner_applied_at`, `applied_by: 'auto'` nem
  `completed_reason: 'auto_resolve'`, e nenhum chama `applyVariantToYouTube`.
- **Falha em verde.** No pipeline, campo sem medição é `null` com `aviso`, nunca `0`. No cron, leitura
  ou gravação que falha conta como erro do cron (hoje a leitura de `ab_tests` que falha devolve
  "0 avaliados" em verde). (emenda 1: D-P2-9) Nas funções do pipeline que a Tarefa 4 toca, leitura que
  falha lança `DB_ERROR` 500; nunca sai `activeTests: 0` com `aviso` por cima.
- **Paridade Cowork × Claude Code:** REST, ação MCP e recurso MCP do mesmo dado mudam no mesmo commit
  (Tarefa 4), com o doc.
- **Configuração antiga continua válida.** `auto_apply_winner` e `default_auto_apply` gravados em
  `ab_tests.config` e nas configurações do site são aceitos e ignorados; nada no banco é reescrito.
- TypeScript sem `any`; texto novo em pt-BR; commits `tipo: descrição`.
- **Árvore e envio:** seção 1. Nunca `git stash`, `git reset`, `pkill`, nem push do `staging` local.
- Suíte e build com saída em arquivo; nenhum comando acima de 4 min em primeiro plano.

## Foco de revisão (o que o spec implica e nenhum teste de hoje exercita)

1. **Teste com os critérios todos verdes e duração máxima vencida.** Hoje a condição tem `!allPass`:
   com a aplicação automática desligada (`config.auto_apply_winner === false`) esse teste **nunca
   encerra**; com o padrão `true` ele encerra como `auto_resolve` com vencedor depois da carência
   (`:236-257`) (emenda 1: S-S5). Depois de P2 encerra como `inconclusive`, sem vencedor. Teste na Tarefa 1.
2. **Teste com menos de duas variantes com "impressões" e duração vencida** (o ramo F17 de hoje, que
   encerra sem restaurar). Passa pelo mesmo ramo único e tenta restaurar **só se for de thumbnail ou
   combo e alguma variante chegou a ir ao ar** (emenda 1: G-P2-C2). Teste na Tarefa 1.
3. **A leitura de `ab_tests` falha.** O cron reprova (hoje sai verde com zero avaliados). Tarefa 1.
4. **Teste antigo com `config.auto_apply_winner: true` gravado.** Abre, edita e salva sem erro de
   schema; a chave é ignorada. Teste na Tarefa 2.
5. **Cowork pede o funil de um teste com ciclos preenchidos.** Recebe `impressions: null`,
   `clicks: null` e o `aviso`; `link_clicks` (dado real) continua número. Teste na Tarefa 4.

---

## 0. Fatos medidos em 13/10

| Fato | Valor | Fonte |
|---|---|---|
| A condição da duração máxima | `if (!allPass && daysSinceStart >= maxDurationDays)` (`ab-evaluate-phases.ts:406`) | inventário, 3a |
| Outro caminho de duração máxima | ramo F17 (`:116-143`): menos de 2 variantes com impressões; encerra `inconclusive` **sem** restaurar | lido pelo controlador |
| Erros de banco no ramo | `await supabase…update(…)` sem conferir `error`; a leitura inicial ignora `error` | lido pelo controlador |
| Contagem de vitória "automática" (emenda 1: D-P2-3) | `getAbDashboard`, `getAbLearnings` e `getAbPerformance` contam vitória por `winner_variant_id IS NOT NULL` (`services/youtube.ts:1153`, `:1448`, `:1736`), sem olhar `completed_reason`; `winRate` é `0` sem teste concluído (`:1737`) | Phil, lido no código |
| Leitores que viram `null` em zero (emenda 1: D-P2-5) | `ab-lab/queries.ts:488` (`(confidence_at_completion ?? 0) * 100`) e `youtube/_actions/youtube-prompt-actions.ts:535` (`Number(… ?? 0)`; o `select` está em `:271`) | Phil; conferido |
| Único gravador de `ctr_lift_percent` | `ab-evaluate-phases.ts:338`, no caminho da flag ligada | inventário, 3d |
| Chamadores de `isAutoApplyEnabled` | um: `ab-evaluate-phases.ts:237` | inventário |
| `AB_AUTO_APPLY_WINNER` fora do código | `CLAUDE.md:162`, `docs/ops/env-vars.md:12`, `docs/ops/runbook-promocao-next16.md:97` | inventário, 3g |
| Todo teste novo grava `auto_apply_winner: true` | `AB_TEST_CONFIG_DEFAULTS` (`ab-types.ts:22`) espalhado em `ab-lab/actions.ts:167` | inventário, 3e |
| Eixos fabricados no radar | três (`watchTime`, `comments`, `shares`), e `retention` nunca é preenchido pelo servidor | inventário, 3c |
| Arquivos do escopo com mudança não commitada | nenhum | inventário, seção 4 |
| Plano da A5 que edita arquivo do escopo | E7: `cowork-docs-youtube.md`, `mcp/tools.ts`, `mcp/prompts.ts`, outros trechos; ainda sem código | inventário, seção 4 |

**Não medido (ninguém leu produção; a Tarefa 8 passa a ler também `confidence_at_completion` e `ctr_lift_percent`, emenda 1: D-P2-6):** se existe teste `active` hoje (o spec diz zero em 09/10); se
alguma linha de `ab_tests` tem `result_metadata.ctr_lift_percent` ou `confidence_at_completion`
preenchidos. A Tarefa 8 confere, por select, **antes** do envio.

## 1. Onde se trabalha e como se envia

Igual ao plano da P1 (seção 1 de lá: árvore de trabalho própria, confirmada pelo Yannis). ~~**P2 nasce
depois de P1 estar em `origin/staging`:**~~ (emenda 1: S-S1) **P2 nasce de `lote/ab-p1`** assim que a P1
passar na prova local (Tarefa 6 de lá), sem esperar `origin/staging`:

```bash
git worktree add ../bythiago-ab-p2 -b lote/ab-p2 lote/ab-p1
```

Se a P1 receber conserto depois, a P2 faz `git merge lote/ab-p1` na árvore dela. **O ENVIO continua em
série: P1 primeiro, depois P2** (`bash -c 'git push origin lote/ab-p2:staging'` logo em seguida ao envio
da P1: é avanço rápido, contém a P1).

**Regras da árvore, escritas por extenso aqui (emenda 1: S-C2, S-C6):**

- **Nunca existe `apps/web/.env.local` na árvore do lote.** O hook de pre-commit semearia a referência
  do Cowork em produção a partir de código não enviado. O servidor local do Gio para as capturas lê as
  variáveis de `apps/web/.env.development.local` (o Next carrega em `dev`; o hook não olha esse arquivo),
  **apagado ao fim da Tarefa 6**. (emenda 2: S2-2) **O `npm run build:web` não lê o `.env.development.local`**: `next build` roda em modo de produção e carrega `.env.production.local`, `.env.local`, `.env.production` e `.env`. Para o build, as variáveis vêm de `apps/web/.env.production.local` (cópia do `.env.local` do repositório principal; o hook só olha `apps/web/.env.local`; conferir `git check-ignore apps/web/.env.production.local`), **apagado junto com o `.env.development.local` ao fim da Tarefa 6**. Continua valendo: nunca `apps/web/.env.local` na árvore do lote.
- Três travas na junção de volta ao `staging` local (Tarefa 7): (a) antes do `git merge`, conferir que o
  outro terminal não tem mudança não commitada nos arquivos que o lote toca (saída 0 do comando da
  Tarefa 7); nunca `stash`; (b) a resolução de conflito que ficar só no commit de junção vai conflitar de
  novo quando o lote da A5 for montado por `cherry-pick`: avisar a A5 (Tarefa 7); (c) conflito semântico
  sem conflito de texto: o `grep` da Tarefa 7 tem de ser remedido no dia.
- Antes do push: `bash scripts/check-type-debt.sh` na árvore (o pre-push tem um "ratchet" de dívida de
  tipos; o lote só tira código) (emenda 1: S-S2).

- (emenda 2: H2-envio) **A P2 vai num envio só.** O mínimo que não pode faltar são as **Tarefas 1, 2 e 5**; as Tarefas 3, 3b e 4 entram se estiverem prontas e aprovadas, e **nenhuma delas segura a 1**. Só muda se a C1 achar teste vivo (aí para e vai ao dono). Fatia de corte da 3b: **3b-1 (painel do CMS) vai junto da Tarefa 4**; **3b-2 (detalhe do teste ativo) é a primeira a sair** se o lote ficar grande.

Motivo da ordem: as duas mexem em `ab-lab/queries.ts`, `ab-lab/_components/ab-lab-dashboard.tsx`,
`lib/pipeline/services/youtube.ts`, `lib/pipeline/mcp/tools.ts` e `cowork-docs-youtube.md`. Em série não
há conflito. Fronteira exata: `thumbnail-library.ts` é só da P1; `app/api/cron/ab-evaluate/route.ts` é
só da P2 (inventário, 3b).

**Aviso à E18 (A5), a entregar quando P2 chegar a `origin/staging`** (o controlador desta trilha
escreve; não edita plano da A5). A tabela "quem escreve título e thumbnail" do plano
`2026-10-13-a5-e18-versoes-do-video-proprio-plan.md:244-252` cita cinco trechos de
`ab-evaluate-phases.ts`:

| Citação da E18 | Depois de P2 |
|---|---|
| `:236-257` (encerramento automático com a flag desligada, `auto_resolve`) | **apagado**; nenhum teste novo recebe `auto_resolve` |
| `:331-337` (aplicação automática) | **apagado** |
| `:553-557` (nova tentativa de aplicar) | **apagado** (`phaseRetryFailedApplies` inteira) |
| `:407-440` (duração máxima, restaura a thumbnail) | **fica**, é o ramo único; a condição perde `!allPass` |
| `:117-137` (duração máxima sem duas variantes, "nada") | **fundido** no ramo único: passa a tentar restaurar a thumbnail **só se o teste é de thumbnail ou combo e alguma variante chegou a ir ao ar** (emenda 1: G-P2-C2). A E18 reclassifica a linha |
| `auto_resolve` como `completed_reason` | o tipo e o CHECK ficam (histórico); só deixa de nascer |

## 2. O que é do dono

1. As capturas de antes e depois (Tarefa 6) e o "pode".
2. Depois do deploy: apagar `AB_AUTO_APPLY_WINNER` das variáveis da Vercel, **se existir lá** (o código
   já não lê; é limpeza). O agente não mexe em variável da Vercel.
3. Abrir em produção um teste encerrado e as configurações do A/B Lab (aceite P2-P1).
4. (emenda 2: H2-Cowork) **A conferência pelo Cowork é do dono**, um texto colado **uma vez, depois do deploy da P2** (cobre P1-P3 e P2-P3; agente não opera o Cowork). Texto pronto:

   > Sem usar memória nem prompts salvos, faça estas chamadas pelo pipeline e me devolva o JSON cru de cada uma: (1) liste os recursos do MCP e diga se existem `pipeline://youtube/ab-fatigue` ou a ação `get_fatigue_alerts`; (2) `manage_ab_test` com `action: 'get_dashboard'`; (3) `manage_ab_test` com `action: 'get_funnel'` e o `test_id` de um teste que tenha ciclos (se não houver, escreva "sem teste com ciclos"); (4) sem enviar nada: diga se algum prompt ou memória sua ainda manda `trending_viral` em `notifications` ou lê `impressions`, `clicks`, `confidence` ou `lift` do A/B. Não corrija nada, só relate.

   Esperado: nenhum recurso nem ação de fadiga; `avgConfidence` e `avgLift` `null` com `aviso: 'sem métrica de entrega'`; `impressions` e `clicks` do funil `null`; e o que ele disser em (4) vai ao ledger como "dado do Cowork".

**O dono precisa saber (não responde)** (emenda 2: H2-saber):
- **Até a P4 estar em produção, não inicie teste A/B**: a tela não impede, é combinado. A restauração do original continua sem garantia; se falhar, o cron fica vermelho e o teste guarda o motivo.
- Depois da P2, teste que passa da **duração máxima encerra sem vencedor** ("sem conclusão"), mesmo com critérios verdes. "Taxa de vitória" passa a contar só vencedor escolhido por pessoa.
- O **Cowork passa a receber 400** (se mandar aviso de "vídeo em alta", P1) e **`null`** onde recebia impressões, confiança e lift (P2).
- O trabalho é feito em **galho local `lote/ab-*`**, fora da regra dele de "sempre em `staging`", para não pisar no outro terminal; o envio continua indo a `staging` e o galho some depois da Tarefa 7.

Já respondido por ele em 13/10: perguntas 7, 10 e 11 (sim às três).

**Perguntas novas ao dono (um "pode" geral aceita as duas)** (emenda 2: H2-perguntas):
- **13.** A P2 pode tirar também, sem mockup, o painel de critérios, a "probabilidade de ser a melhor" e as médias de confiança e de lift (Tarefa 3b), que são calculados sobre views? Ele vê as capturas de antes e depois. Padrão recomendado: **sim**; sem isso a etapa de telas inteira vira obrigatória antes do primeiro teste.
- **14.** Há data para o primeiro teste A/B? Sem data: segue P3 e depois P4, e ele avisa antes de iniciar. Com data curta: sobe primeiro a parte da P4 que protege o vídeo.

## 3. Decisões que o spec não toma (recomendação do controlador; a revisão cobra)

| # | Decisão | Recomendação | Alternativa e custo |
|---|---|---|---|
| E1 | O ramo F17 funde com o ramo único? | **Sim, com condição (emenda 1: G-P2-C2).** Um caminho só para "passou da duração máxima": tenta restaurar **só quando o teste é de thumbnail ou combo e alguma variante chegou a ir ao ar** (existe ao menos um `ab_test_cycles` do teste), fecha ciclos, encerra | Manter os dois: dois caminhos com a mesma causa e efeitos diferentes; a P4 teria de trocar os dois por `settleOnAir` |
| E2 | `confidence_at_completion` na duração máxima | **`null`** (confirmado por Yannis e Phil). O número viria de `calculateBayesianConfidence` sobre views; a regra do dono é "confiança só aparece quando existe". Os dois leitores que transformam `null` em zero são consertados na mesma entrega (emenda 1: D-P2-5): `queries.ts:488` na Tarefa 3 e `youtube-prompt-actions.ts:535` na Tarefa 4. Valores já gravados em `ab_tests` **não são tocados** | Continuar gravando: o pipeline (Tarefa 4) entregaria `null` de qualquer jeito, e a tela mostraria um número sem lastro |
| E3 | `consecutive_confident_evals` | **Deixa de ser gravado.** O contador fica congelado no valor de hoje (custo dito por Yannis: todo teste novo mostra "0 / 3" de estabilidade para sempre; ver "Sobra declarada" e Tarefa 3b) | Continuar calculando: mantém Bayes e critérios dentro do cron só para alimentar um painel que a etapa de telas vai refazer |
| E4 | Erros de banco dentro do ramo | **Conferir `error` e lançar um `Error`** (não o `PostgrestError` cru: o Sentry o agrupa como "Object captured as exception"; `new Error(msg, { cause })`, emenda 1: S-C13), para o `catch` contar o erro e o cron reprovar | Deixar como está: gravação que falha sai em verde |
| E5 | `ab-playoff.ts` (`checkPlayoffEligibility`, `selectPlayoffVariants`) | **Fica**, como função pura sem chamador na rota, igual a `ab-statistics.ts` e `ab-gates.ts`; o teste dele fica. **Dívida declarada na seção 8** (emenda 1: S-D3) | Apagar: mais 2 arquivos; nada quebra |
| E6 | O radar "Raio-X das variantes" | **Sai o bloco inteiro** de `active-detail.tsx`, com a frase fixa no lugar. Dos seis eixos, três são fabricados, `retention` nunca é preenchido e `pTop2` é fabricado: sobraria um radar de dois eixos | Tirar só três eixos: gráfico sem sentido |
| E7 | `pTop2` | **Sai do tipo `RankedVariant`** e de todo lugar que o mostra ou ordena por ele; onde ordenava, ordena por `pBest` | Manter o campo e esconder: o número fabricado continua no objeto e volta numa tela futura |
| E8 | Os dois sliders de confiança (`settings-drawer.tsx:195-207`, `step-config.tsx:62-72`) | **Saem** (o spec manda sumir "limiar de confiança e estabilidade"). Os valores gravados continuam sendo lidos pelo painel de critérios | Manter: controle que não decide mais nada |
| E9 | O banner de carência (`active-detail.tsx:133-190`) | **Sai só a frase** "O vencedor será aplicado automaticamente…" (`:142`). O banner só aparece com `grace_expires_at` preenchido, que deixa de ter gravador; apagá-lo é a pergunta 6 (P4) | Apagar o banner agora: antecipa uma pergunta que o dono ainda não respondeu |
| E10 | `winRate` do painel do pipeline | ~~**Fica.** Vencedor escolhido à mão é decisão real~~ (emenda 1: S-C8, D-P2-3) **Muda.** "Vitória" só conta quando o vencedor foi escolhido por pessoa: `completed_reason in ('manual_winner','manual_apply')` (`manual_no_apply` fica fora; ver a nota abaixo da tabela). Saem da conta os `auto_resolve`, em `winRate` (`getAbDashboard`), `getAbLearnings` e `getAbPerformance`; no `winRate` o `auto_resolve` sai **do numerador e do denominador** (emenda 2: D2-1). Sem teste que conte, o valor é `null`, nunca `0` | Anular: perde dado verdadeiro |

Nota sobre E10 (emenda 2: G2-N2, D2-2). **Resolvido pelo controlador (emenda 1, decisão 1), confirmado por Phil e Yannis:** vitória humana = `manual_winner` ou `manual_apply`; `manual_no_apply` é cancelamento de carência (`ab-lab/actions.ts:1464-1472`: grava `completed_reason: 'manual_no_apply'` e **não limpa** `winner_variant_id`), não vitória: a linha mantém o vencedor que a máquina sugeriu e a pessoa recusou. **Ressalva a declarar:** `manual_apply` é "a máquina sugeriu, a pessoa aplicou" (`actions.ts:1335` exige `winner_variant_id` já preenchido, que só o cron gravava); conta, porque a pessoa teve a última palavra, é **número fixo** (nenhuma linha nova nasce com `manual_apply` depois da P2) e a C1 da Tarefa 8 diz quantas são. O filtro é feito **em memória**, depois da leitura, para não excluir `null` por engano no PostgREST, e a regra mora num predicado só (`ehVitoriaHumana`, Tarefa 4).

**Decisões fechadas do controlador (rodada 2, confirmadas por Phil, Yannis e Gio)** (emenda 2: decisão 8):

1. **Vitória humana = `manual_winner` e `manual_apply`** (acima).
2. **"Foi ao ar" = existe ciclo** (`ab_test_cycles` do teste). Imprecisões declaradas: (a) o ciclo 0 é o da variante de índice 0, em regra a original; teste que só teve o ciclo 0 conta como "foi ao ar" e, com o original fora do Blob, dá um `errors++` de alarme falso; (b) ver a linha "teste `active` sem ciclo" na seção 7.
3. **Original fora do Blob, em teste que foi ao ar, conta `errors++` e grava `status_note`.** É exceção, não regra (`createAbTest` copia a thumbnail para o Blob, `actions.ts:217-222`); custa um dia de cron vermelho por teste, com ação possível. **Falso alarme declarado:** o original é uma variante da rotação (`is_original`); se no instante do encerramento era ele que estava no ar, o cron fica vermelho e a nota diz "original não restaurado" sem haver variante no ar. A P4 (`settleOnAir`) resolve lendo o ciclo aberto.
4. **`status_note` só é escrito quando a restauração falha.** Não apaga a nota do `ab-rotate` (`retry n/3: …`); o teste que prova a decisão está na Tarefa 1.

**Sobra declarada (a Tarefa 3b a resolve, se o dono disser sim à pergunta 13):** depois de P2 a tela do teste ativo
ainda mostraria o painel de critérios (com o "0 / 3" de estabilidade congelado, `lib/youtube/ab-gates.ts:58-60`,
lido em `ab-lab/queries.ts:1131`) e a "probabilidade de ser a melhor" calculados sobre views, com um
limiar que ninguém mais edita; e o painel do CMS (`computeDashboardStats`, `queries.ts:572-598`:
`avgConfidence`, `winRate`, `avgLift`; e `monthlyExtraClicks ?? 0` em `:1399`) mostraria números que o
pipeline passa a anular: mesmo dado, dois números (emenda 1: D-P2-8). O spec deixa isso para a etapa de
telas. **A Hanna recomenda que a Tarefa 3b entre; entra com o sim do dono à pergunta 13** (emenda 2: H2-3b). Se não entrar, os dois itens ficam
por escrito aqui, e a etapa de telas tem de estar em produção antes do primeiro teste novo, junto da P4.

## 4. Arquivos, por tarefa

Caminhos relativos a `apps/web/`; `AB/` = `src/app/cms/(authed)/youtube/ab-lab/`.

| Tarefa | Arquivos |
|---|---|
| 1 cron | `src/lib/youtube/ab-evaluate-phases.ts`, `src/app/api/cron/ab-evaluate/route.ts`, `src/lib/youtube/ab-apply.ts`; `test/ab-cron-evaluate.test.ts`, `test/api/cron/ab-evaluate.test.ts`, `test/youtube/ab-evaluate-phases.test.ts`; **novo (emenda 1: G-P2-B2):** `test/integration/ab-evaluate-duracao-maxima.test.ts` |
| 2 configurações | `src/lib/youtube/{ab-types.ts,ab-schemas.ts,ab-wizard-adapter.ts}`, `AB/_components/{settings-drawer,step-config,step-revisar,live-monitor,active-detail}.tsx`; `test/ab-config.test.ts`, `test/ab-settings-drawer.test.tsx`, `test/{cms,youtube}/ab-step-config.test.tsx`, `test/cms/ab-step-revisar.test.tsx`, `test/{cms,youtube}/ab-wizard-reducer.test.tsx`, `test/youtube/{ab-wizard-adapters.test.ts,ab-wizard-components.test.tsx,ab-high.test.ts}`, `test/ab-actions-create.test.ts` |
| 3 números fabricados | `AB/_components/{active-detail,rank-bars,variant-table,playoff-detail,radar-chart}.tsx`, `AB/queries.ts`, `src/lib/youtube/ab-types.ts`; `AB/queries.ts` (linha 488, emenda 1: D-P2-5), `test/ab-charts.test.tsx`, `test/ab-chart-math*`, `test/ab-variant-table-title*`, `test/youtube/ab-detail-{active,playoff,winner}*`, `test/youtube/{ab-high,ab-medium}.test.ts`, `AB/**/mock-views.ts` |
| 4 pipeline | `src/lib/pipeline/services/youtube.ts`, `src/lib/youtube/prompt-builders-ab.ts`, `src/lib/pipeline/mcp/tools.ts`, `data/pipeline-docs/cowork-docs-youtube.md`, `src/app/cms/(authed)/youtube/_actions/youtube-prompt-actions.ts` e `src/lib/youtube/prompt-types.ts` (emenda 1: D-P2-5), `AB/actions.ts:1620` e `mcp/prompts.ts:661,750` (emenda 1: S-S4), `src/lib/youtube/ab-types.ts` (`ehVitoriaHumana`), `mcp/prompts.ts:660,749` (`winner_label`) e `youtube-prompt-actions.ts:271-274,531-534` (emenda 2: D2-2); `test/ab-pipeline-api.test.ts`, `test/api/pipeline/{youtube-ab-tests,youtube-ab-extended,youtube-thumbnails}.test.ts`, `test/mcp/mcp-schema-reads.test.ts`, `test/youtube/prompt-builders-ab.test.ts` |
| 3b painel de critérios (a Hanna recomenda que entre; com o sim do dono à pergunta 13; emenda 1: D-P2-8, emenda 2: H2-3b) | **3b-1 (painel do CMS, junto da Tarefa 4):** `AB/_components/ab-lab-dashboard.tsx`, `AB/queries.ts`; **3b-2 (detalhe do teste ativo, primeira a sair):** `AB/_components/active-detail.tsx`, `lib/youtube/ab-gates.ts` (só a leitura); testes de detalhe e de painel |
| 5 documentos | `CLAUDE.md`, `docs/ops/env-vars.md`, `docs/ops/runbook-promocao-next16.md` |

Ordem obrigatória: **1 antes de 2** (a Tarefa 2 tira do tipo a chave que a fase apagada lia). 3, 4 e 5
são independentes; 3b depois de 3 (a 3b-1 vai junto da 4). Uma por vez, na mesma árvore.

---

## 5. As tarefas

Em todas: testes **dos arquivos da tarefa** com saída em arquivo
(`cd apps/web && npx vitest run <arquivos> > /tmp/ab-p2-tN.log 2>&1; tail -30 /tmp/ab-p2-tN.log`) e
`npx tsc --noEmit -p apps/web > /tmp/ab-p2-tsc.log 2>&1` antes do commit.

### Tarefa 0: árvore e linha de base

- [ ] (emenda 1: S-S1) ~~Conferir que P1 está em `origin/staging` por conteúdo~~ Conferir que `lote/ab-p1`
  passou na prova local (Tarefa 6 de lá) e que a árvore da P2 nasce dele (seção 1); a prova de conteúdo vale
  nele: `git grep -c "fatigue" lote/ab-p1 -- apps/web/src/lib/pipeline/api-registry.ts` → sem saída.
- [ ] Criar a árvore (seção 1), **sem** `apps/web/.env.local`; `npm ci` e `build:packages` em background com saída em arquivo.
- [ ] Greps de reconferência, guardados em `/tmp/ab-p2-grep-antes.txt`:
  `grep -rnE "AB_AUTO_APPLY_WINNER|isAutoApplyEnabled|phaseRetryFailedApplies|phaseDetectPlayoffEligibility|auto_apply_winner|default_auto_apply|pTop2" apps/web/src CLAUDE.md docs/ops | grep -v database.types`.
- [ ] Linha de base dos testes da seção 4: tudo verde, senão pare.

### Tarefa 1: o cron fica com um ramo só

**Interfaces.**
- Produz: `phaseEvaluateActiveTests(supabase): Promise<EvaluateResult>` com a mesma assinatura e o mesmo
  tipo de retorno (`{ evaluated, resolved, errors }`); `phaseAutoStartPlayoffs` intacta.
- Somem: `phaseRetryFailedApplies`, `phaseDetectPlayoffEligibility`, `isAutoApplyEnabled`.
- Resposta da rota: `{ status, evaluated, resolved, errors, playoffs_started, longevity_checked }`
  (saem `applies_retried` e `playoffs_created`; `resolved` é só `evaluation.resolved`).

- [ ] **Passo 1, testes que falham**, em `test/youtube/ab-evaluate-phases.test.ts` (use o arranjo de
  cliente falso **por tabela** que o arquivo já tem; os dois casos F17, linhas 347 e 368, são o molde).
  (emenda 1: S-C10, G-P2-C2, G-P2-C3, D-P2-1, S-C7, S-C8) **Datas sempre relativas a `Date.now()` ou com
  relógio falso.** O caso "antes da duração" precisa de **duas variantes com impressões**: sem ciclos, o
  código de hoje cai no F17 e também não escreve, e o passo 2 ("falha") não acontece.

  ```ts
  describe('phaseEvaluateActiveTests: ramo único', () => {
    it('antes da duração máxima (13 de 14 dias, duas variantes com impressões) não escreve nada, nem no banco nem no YouTube', async () => {
      const { supabase, escritas } = clienteCom([testeAtivo({ diasNoAr: 13, maxDuracao: 14, ciclos: ciclosComVencedorClaro() })])
      const r = await phaseEvaluateActiveTests(supabase)
      expect(r).toEqual({ evaluated: 1, resolved: 0, errors: 0 })
      expect(escritas()).toHaveLength(0)
      expect(setThumbnail).not.toHaveBeenCalled()
      expect(updateVideoMetadata).not.toHaveBeenCalled()   // (emenda 2: S2-6) applyVariantToYouTube não é espião neste arquivo
    })

    it('fronteira: com 14 de 14 dias encerra', async () => {
      const { supabase } = clienteCom([testeAtivo({ diasNoAr: 14, maxDuracao: 14, ciclos: ciclosComVencedorClaro() })])
      expect(await phaseEvaluateActiveTests(supabase)).toEqual({ evaluated: 1, resolved: 1, errors: 0 })
    })

    it('critérios todos verdes e duração vencida: encerra inconclusive, sem vencedor, sem carência, ciclos fechados', async () => {
      const { supabase, gravadoEm } = clienteCom([testeAtivo({ diasNoAr: 15, maxDuracao: 14, ciclos: ciclosComVencedorClaro(), comVencedorSugerido: true, carenciaAte: 'futuro' })])
      const r = await phaseEvaluateActiveTests(supabase)
      expect(r).toEqual({ evaluated: 1, resolved: 1, errors: 0 })
      const linha = gravadoEm('ab_tests')
      // (emenda 1: S-C8) o encerramento LIMPA vencedor e carência; antes o molde proibia essas chaves
      expect(linha).toMatchObject({
        status: 'completed', completed_reason: 'inconclusive', confidence_at_completion: null,
        winner_variant_id: null, grace_expires_at: null,
      })
      for (const chave of ['winner_applied_at', 'applied_by', 'consecutive_confident_evals', 'result_metadata']) {
        expect(linha).not.toHaveProperty(chave)
      }
      expect(gravadoEm('ab_test_cycles')).toHaveProperty('ended_at')   // mutante: tirar o update dos ciclos
      expect(setThumbnail).not.toHaveBeenCalled()          // (emenda 2: S2-6)
      expect(updateVideoMetadata).not.toHaveBeenCalled()
    })

    it('config sem max_duration_days: usa 14 dias (padrão testado apagando a chave)', async () => {
      const t = testeAtivo({ diasNoAr: 15, maxDuracao: 14 })
      delete (t.config as Record<string, unknown>).max_duration_days
      const { supabase } = clienteCom([t])
      expect((await phaseEvaluateActiveTests(supabase)).resolved).toBe(1)
    })

    // (emenda 2: S2-3) mutante: tirar `?? test.created_at` (new Date(null) é 1970 e o teste "tem" 20 mil dias)
    it('started_at nulo usa created_at: criado há 3 dias não encerra; criado há 15 encerra', async () => {
      const novo = clienteCom([testeAtivo({ startedAt: null, criadoHaDias: 3, maxDuracao: 14 })])
      expect(await phaseEvaluateActiveTests(novo.supabase)).toEqual({ evaluated: 1, resolved: 0, errors: 0 })
      expect(novo.escritas()).toHaveLength(0)
      const velho = clienteCom([testeAtivo({ startedAt: null, criadoHaDias: 15, maxDuracao: 14 })])
      expect((await phaseEvaluateActiveTests(velho.supabase)).resolved).toBe(1)
    })

    // (emenda 1: G-P2-C2) A fusão do F17 fica, com condição: só restaura se o teste é de thumbnail ou combo
    // E alguma variante chegou a ir ao ar (existe ao menos um ciclo do teste).
    it('thumbnail, com ciclo (foi ao ar) e original no Blob: tenta restaurar uma vez', async () => {
      const { supabase, gravadoEm } = clienteCom([testeAtivo({ tipo: 'thumbnail', diasNoAr: 15, maxDuracao: 14, ciclos: [cicloVazio()], originalNoBlob: true })])
      // (emenda 2: S2-4) mutante: apagar `restauracao = 'feita'` gravaria "original não restaurado" em toda restauração boa
      const r = await phaseEvaluateActiveTests(supabase)
      expect(r).toEqual({ evaluated: 1, resolved: 1, errors: 0 })
      expect(setThumbnail).toHaveBeenCalledTimes(1)
      expect(gravadoEm('ab_tests')).not.toHaveProperty('status_note')
    })

    it('combo, com ciclo e original no Blob: tenta restaurar', async () => {
      const { supabase, gravadoEm } = clienteCom([testeAtivo({ tipo: 'combo', diasNoAr: 15, maxDuracao: 14, ciclos: [cicloVazio()], originalNoBlob: true })])
      const r = await phaseEvaluateActiveTests(supabase)   // (emenda 2: S2-4) mesmas afirmações do caso de thumbnail
      expect(r).toEqual({ evaluated: 1, resolved: 1, errors: 0 })
      expect(setThumbnail).toHaveBeenCalledTimes(1)
      expect(gravadoEm('ab_tests')).not.toHaveProperty('status_note')
    })

    it.each(['title', 'description'] as const)('teste de %s não chama setThumbnail e encerra sem erro', async (tipo) => {
      const { supabase, gravadoEm } = clienteCom([testeAtivo({ tipo, diasNoAr: 15, maxDuracao: 14, ciclos: [cicloVazio()], originalNoBlob: true })])
      const r = await phaseEvaluateActiveTests(supabase)
      expect(r).toEqual({ evaluated: 1, resolved: 1, errors: 0 })
      expect(setThumbnail).not.toHaveBeenCalled()
      expect(gravadoEm('ab_tests')).not.toHaveProperty('status_note')
    })

    it('thumbnail que nunca foi ao ar (nenhum ciclo): não chama o YouTube, encerra sem erro', async () => {
      const { supabase } = clienteCom([testeAtivo({ tipo: 'thumbnail', diasNoAr: 15, maxDuracao: 14, ciclos: [], originalNoBlob: true })])
      const r = await phaseEvaluateActiveTests(supabase)
      expect(r).toEqual({ evaluated: 1, resolved: 1, errors: 0 })
      expect(setThumbnail).not.toHaveBeenCalled()
    })

    // (emenda 1: S-C7) restauração que falha NÃO é silenciosa: encerra, grava o motivo e o cron conta erro.
    it('original fora do Blob, com variante que foi ao ar: encerra, status_note preenchido, errors 1, sem chamar o YouTube', async () => {
      const { supabase, gravadoEm } = clienteCom([testeAtivo({ tipo: 'thumbnail', diasNoAr: 15, maxDuracao: 14, ciclos: [cicloVazio()], originalNoBlob: false })])
      const r = await phaseEvaluateActiveTests(supabase)
      expect(r).toEqual({ evaluated: 1, resolved: 1, errors: 1 })
      expect(setThumbnail).not.toHaveBeenCalled()
      expect(gravadoEm('ab_tests').status_note).toMatch(/original não restaurado \(sem_original_no_blob\)/)
    })

    it('a restauração falha (setThumbnail rejeita): encerra, resolved 1, errors 1, status_note preenchido, Sentry chamado', async () => {
      setThumbnail.mockRejectedValueOnce(new Error('token expirado'))
      const { supabase, gravadoEm } = clienteCom([testeAtivo({ tipo: 'thumbnail', diasNoAr: 15, maxDuracao: 14, ciclos: [cicloVazio()], originalNoBlob: true })])
      const r = await phaseEvaluateActiveTests(supabase)
      expect(r).toEqual({ evaluated: 1, resolved: 1, errors: 1 })
      expect(gravadoEm('ab_tests').status_note).toMatch(/original não restaurado \(falhou\)/)
      expect(Sentry.captureException).toHaveBeenCalled()
    })

    it('a leitura de ab_tests falha: conta erro, não devolve zero em verde', async () => {
      const { supabase } = clienteQueFalhaAoLer('ab_tests')
      expect(await phaseEvaluateActiveTests(supabase)).toEqual({ evaluated: 0, resolved: 0, errors: 1 })
    })

    it('a gravação do encerramento falha: conta erro e não conta como resolvido', async () => {
      const { supabase } = clienteCom([testeAtivo({ diasNoAr: 15, maxDuracao: 14 })], { falhaAoGravar: 'ab_tests' })
      expect(await phaseEvaluateActiveTests(supabase)).toMatchObject({ resolved: 0, errors: 1 })
    })

    it('fechar os ciclos falha: resolved 0, errors 1 e ab_tests não é gravado', async () => {
      const { supabase, escritasEm } = clienteCom([testeAtivo({ diasNoAr: 15, maxDuracao: 14 })], { falhaAoGravar: 'ab_test_cycles' })
      expect(await phaseEvaluateActiveTests(supabase)).toMatchObject({ resolved: 0, errors: 1 })
      expect(escritasEm('ab_tests')).toHaveLength(0)
    })

    it('dois testes vencidos, o primeiro falha: o segundo encerra', async () => {
      const { supabase } = clienteCom(
        [testeAtivo({ id: 'a', diasNoAr: 15, maxDuracao: 14 }), testeAtivo({ id: 'b', diasNoAr: 15, maxDuracao: 14 })],
        { falhaAoGravar: { tabela: 'ab_test_cycles', idDoTeste: 'a' } },
      )
      expect(await phaseEvaluateActiveTests(supabase)).toMatchObject({ resolved: 1, errors: 1 })
    })

    // (emenda 1: D-P2-1) decisão humana concorrente
    it('o teste deixou de ser active entre a leitura e a restauração: setThumbnail não é chamado e nada é gravado', async () => {
      const { supabase, escritas } = clienteCom(
        [testeAtivo({ tipo: 'thumbnail', diasNoAr: 15, maxDuracao: 14, ciclos: [cicloVazio()], originalNoBlob: true })],
        { statusNaReleitura: 'completed' },
      )
      const r = await phaseEvaluateActiveTests(supabase)
      expect(r).toEqual({ evaluated: 1, resolved: 0, errors: 0 })
      expect(setThumbnail).not.toHaveBeenCalled()
      expect(escritas()).toHaveLength(0)
    })

    it('o update final casa zero linha (alguém encerrou ou pausou à mão): resolved 0, errors 0, e o filtro status=active foi enviado', async () => {
      const { supabase, filtrosDoUpdate } = clienteCom([testeAtivo({ diasNoAr: 15, maxDuracao: 14 })], { updateCasaZeroLinha: true })
      expect(await phaseEvaluateActiveTests(supabase)).toEqual({ evaluated: 1, resolved: 0, errors: 0 })
      expect(filtrosDoUpdate('ab_tests')).toMatchObject({ id: expect.any(String), status: 'active' })
    })

    // (emenda 1: S-C9, G-P2-B1) a flag não faz mais nada. O arranjo é o que o código de HOJE aplicaria
    // (carência vencida, vencedor preenchido, critérios verdes, flag ligada); no código de hoje o teste FALHA.
    it('AB_AUTO_APPLY_WINNER=true com carência vencida não aplica nada nem escreve em ab_tests', async () => {
      process.env.AB_AUTO_APPLY_WINNER = 'true'
      try {
        const { supabase, escritasEm } = clienteCom([testeAtivo({
          diasNoAr: 3, maxDuracao: 14, ciclos: ciclosComVencedorClaro(),
          comVencedorSugerido: true, carenciaAte: 'passado', consecutiveConfidentEvals: 3,
        })])
        await phaseEvaluateActiveTests(supabase)
        expect(setThumbnail).not.toHaveBeenCalled()          // (emenda 2: S2-6)
        expect(updateVideoMetadata).not.toHaveBeenCalled()
        expect(escritasEm('ab_tests')).toHaveLength(0)
      } finally {
        delete process.env.AB_AUTO_APPLY_WINNER
      }
    })
  })
  ```

  `clienteCom`, `testeAtivo`, `ciclosComVencedorClaro`, `cicloVazio`, `clienteQueFalhaAoLer`, `escritas`,
  `escritasEm`, `gravadoEm` e `filtrosDoUpdate` são nomes de molde: troque pelos auxiliares do arquivo, ou
  crie-os **no próprio arquivo de teste** se não existirem. O falso é **por tabela** (como o arquivo já
  é), nunca por posição de chamada.

  (emenda 2: S2-5) **Padrão de `testeAtivo`: `tipo: 'title'`** (restauração não aplicável, `errors: 0`). Só os casos que nomeiam `tipo: 'thumbnail'` ou `'combo'` exercitam a restauração; para eles o `beforeEach` do `describe` arma o caminho feliz: `ensureFreshToken.mockResolvedValue({ accessToken: 't' })`, `fetchVariantImageBuffer.mockResolvedValue({ buffer: Buffer.from('x'), contentType: 'image/jpeg' })`, `mockChannelAccountId.mockResolvedValue('UCpt')`, e o falso devolve uma linha de `youtube_videos`. (O auxiliar `makeActiveTest` de hoje é `thumbnail`, com 16 ciclos e sem `original_thumbnail_url`, e `ensureFreshToken` é `vi.fn()` que devolve `undefined`: sem este arranjo os casos "fronteira", "critérios todos verdes" e "dois testes vencidos" reprovam por motivo errado.)

  (emenda 2: S2-6) **`applyVariantToYouTube` não é espião neste arquivo** (`@/lib/youtube/ab-apply` não está entre os `vi.mock`): `expect(applyVariantToYouTube)…` lançaria por não ser simulação. Os três casos que o citavam (antes da duração, critérios verdes e o da flag) afirmam `setThumbnail` e `updateVideoMetadata` (os dois já simulados; importá-los no topo). No caso da flag o arranjo usa a variante `v2` do auxiliar (`blob_url` e `title_text` preenchidos), que no código de hoje chama os dois; e sai o `vi.stubEnv('AB_AUTO_APPLY_WINNER', 'true')` do `beforeEach` (`:231`), porque o caso da flag a arma por conta própria.

  (emenda 2: decisão 8, S2-declaração) Teste `active` sem ciclo 0 (a inserção do ciclo falhou no início): ver a seção 7.
- [ ] **Passo 2, prova de que falham na base** (emenda 1: S-C9, S-C10, G-P2-B1; emenda 2: G2-N1, S2-7). Rodar no commit-base
  (antes do passo 3) e **registrar a saída**. **Têm de falhar, cada um pelo motivo certo** (os sete): grava o contador e
  não limpa vencedor; não encerra com critérios verdes; não restaura no F17; restaura título/descrição (na afirmação de `setThumbnail`);
  ignora erro de leitura; não confere `status`; e o caso da flag **aplica** no código de hoje.
  **Passam também no base, por serem guarda** (comportamento que não muda): "thumbnail que nunca foi ao ar", `started_at` nulo, "config sem `max_duration_days`", a fronteira 13/14, o padrão de 14 dias, "dois testes vencidos" e a afirmação de `status_note` do `it.each` de título/descrição. Não distorça o arranjo para eles "falharem". **Cada guarda é provada uma vez por mutante aplicado à mão no código novo, registrando que reprova:** `>=` por `>` (fronteira); `?? 14` por `?? 30`; sem `?? test.created_at`; `throw` fora do `try`; apagar `restauracao = 'feita'`; apagar o `.eq('status','active')` do `update`.
- [ ] **Passo 3, a fase** (`src/lib/youtube/ab-evaluate-phases.ts`). `phaseEvaluateActiveTests` passa a ser
  (emenda 1: D-P2-1, S-C7, S-C8, S-C13, G-P2-C2):

  ```ts
  // ─── Fase 2: duração máxima ──────────────────────────────────────────────────
  // Enquanto não houver métrica de entrega real, o cron não declara vencedor, não abre
  // carência, não cria playoff e não aplica nada: `ab_test_cycles.impressions` são views e
  // os cliques são sempre zero. Só sobra o ramo da duração máxima. Escolher o que fica no
  // ar é decisão humana (spec 2026-10-07-ab-lab-honesto, 4.1).

  type Restauracao = 'nao_aplicavel' | 'feita' | 'sem_original_no_blob' | 'falhou'

  export async function phaseEvaluateActiveTests(supabase: SupabaseClient): Promise<EvaluateResult> {
    let evaluated = 0
    let resolved = 0
    let errors = 0

    const { data: tests, error: erroLeitura } = await supabase
      .from('ab_tests')
      .select('id, site_id, youtube_video_id, test_type, config, started_at, created_at, original_thumbnail_url')
      .eq('status', 'active')

    if (erroLeitura) {
      Sentry.captureException(new Error(`ler testes ativos: ${erroLeitura.message}`, { cause: erroLeitura }), {
        tags: { cron: 'ab-evaluate' },
        extra: { context: 'ler testes ativos' },
      })
      return { evaluated: 0, resolved: 0, errors: 1 }
    }
    if (!tests || tests.length === 0) {
      return { evaluated: 0, resolved: 0, errors: 0 }
    }

    for (const test of tests) {
      try {
        const config = test.config as AbTestConfig
        const startedAt = new Date(test.started_at ?? test.created_at)
        const daysSinceStart = Math.floor((Date.now() - startedAt.getTime()) / 86400000)
        const maxDurationDays = config.max_duration_days ?? 14

        if (daysSinceStart < maxDurationDays) {
          evaluated++
          continue
        }

        // Decisão humana no meio: relê o estado antes de mexer no YouTube (D-P2-1).
        const aindaAtivo = await supabase.from('ab_tests').select('status').eq('id', test.id).maybeSingle()
        if (aindaAtivo.error) throw new Error(`reler estado: ${aindaAtivo.error.message}`, { cause: aindaAtivo.error })
        if (aindaAtivo.data?.status !== 'active') {
          evaluated++
          continue
        }

        // Volta ao original, melhor esforço (P4 troca por settleOnAir(original, 'duracao_maxima')).
        // Só tenta se o teste é de thumbnail ou combo E alguma variante chegou a ir ao ar (G-P2-C2).
        let restauracao: Restauracao = 'nao_aplicavel'
        if (test.test_type === 'thumbnail' || test.test_type === 'combo') {
          const foiAoAr = await supabase
            .from('ab_test_cycles')
            .select('id', { count: 'exact', head: true })
            .eq('test_id', test.id)
          if (foiAoAr.error) throw new Error(`ler ciclos: ${foiAoAr.error.message}`, { cause: foiAoAr.error })
          if ((foiAoAr.count ?? 0) > 0) {
            const originalNoBlob = !!test.original_thumbnail_url?.includes('blob.vercel-storage.com')
            restauracao = originalNoBlob ? 'falhou' : 'sem_original_no_blob'
            try {
              if (originalNoBlob) {
                const { data: revertVideo } = await supabase
                  .from('youtube_videos')
                  .select('youtube_video_id')
                  .eq('id', test.youtube_video_id)
                  .single()

                if (revertVideo) {
                  const { fetchVariantImageBuffer, setThumbnail } = await import('@/lib/youtube/ab-youtube')
                  const revertChannelId = await channelAccountIdForVideo(supabase, test.site_id, test.youtube_video_id)
                  if (!revertChannelId) throw new Error(CHANNEL_NOT_IDENTIFIED_MESSAGE)
                  const { accessToken } = await ensureFreshToken(test.site_id, 'youtube', revertChannelId)
                  const { buffer, contentType } = await fetchVariantImageBuffer(test.original_thumbnail_url)
                  await setThumbnail(revertVideo.youtube_video_id, buffer, contentType, accessToken)
                  restauracao = 'feita'
                }
              }
            } catch (e) {
              Sentry.captureException(e, { extra: { context: 'max-duration-revert', testId: test.id } })
            }
          }
        }

        const agora = new Date().toISOString()
        const fechouCiclos = await supabase
          .from('ab_test_cycles')
          .update({ ended_at: agora })
          .eq('test_id', test.id)
          .is('ended_at', null)
        if (fechouCiclos.error) throw new Error(`fechar ciclos: ${fechouCiclos.error.message}`, { cause: fechouCiclos.error })

        // Encerra SÓ se ainda for 'active' e devolve a linha: zero linha não é "resolvido" (D-P2-1).
        // Limpa vencedor e carência: teste encerrado como inconclusive não fica com vencedor sugerido (S-C8).
        const restauracaoFalhou = restauracao === 'falhou' || restauracao === 'sem_original_no_blob'
        const encerrou = await supabase
          .from('ab_tests')
          .update({
            status: 'completed',
            completed_at: agora,
            completed_reason: 'inconclusive',
            confidence_at_completion: null,
            winner_variant_id: null,
            grace_expires_at: null,
            // só escreve status_note quando há o que dizer: não apaga nota do ab-rotate (S-C7)
            ...(restauracaoFalhou ? { status_note: `duração máxima: original não restaurado (${restauracao})` } : {}),
          })
          .eq('id', test.id)
          .eq('status', 'active')
          .select('id')
        if (encerrou.error) throw new Error(`encerrar teste: ${encerrou.error.message}`, { cause: encerrou.error })

        if ((encerrou.data ?? []).length === 1) {
          resolved++
          // restauração que falhou deixa a variante no ar: o cron fica vermelho nesse dia (S-C7)
          if (restauracaoFalhou) errors++
        }
        evaluated++
      } catch (err) {
        errors++
        Sentry.captureException(err, { tags: { cron: 'ab-evaluate' }, extra: { testId: test.id } })
      }
    }

    return { evaluated, resolved, errors }
  }
  ```

  O bloco de restauração (`fetchVariantImageBuffer`…`setThumbnail`) é **cópia do de hoje** (`:408-427`),
  apenas movido para dentro da condição nova; não melhore nada nele. A fase só lê `active`: teste `paused`
  além da duração máxima nunca encerra (igual a hoje; dívida, seção 8).
- [ ] **Passo 4, o resto do arquivo.** Apagar `phaseRetryFailedApplies` (461-616) e
  `phaseDetectPlayoffEligibility` (620-738). Tirar os imports que ficaram sem uso: o `tsc` e o lint
  dizem quais; pelo inventário saem `calculateBayesianConfidence`, `applyVariantToYouTube`,
  `isAutoApplyEnabled`, `computeGates`, `preflightTokenCheck`, `buildNotification`, `fanOutToSiteAdmins`,
  `getIsoWeek`, `checkPlayoffEligibility`, `selectPlayoffVariants`, `autoImportWinner`,
  `applyCycleTransition` e os tipos `AbTestVariantRow`, `AbTestCycleRow`, `VariantStats`,
  `BackfillStatus`. **Ficam** os que `phaseAutoStartPlayoffs` (33-60) usa.
- [ ] **Passo 5, a rota** (`src/app/api/cron/ab-evaluate/route.ts`): saem os dois imports (8-9) e as
  duas chamadas (26-27); `totalErrors = evaluation.errors + playoffs.errors`; a resposta fica como em
  "Interfaces". A fase 5 (longevidade, 29-43), o registro do cron e o escalonamento **não mudam**.
- [ ] **Passo 6.** `src/lib/youtube/ab-apply.ts`: sai `isAutoApplyEnabled` com o comentário (7-17).
- [ ] **Passo 7, os testes antigos.**
  - `test/youtube/ab-evaluate-phases.test.ts`: saem os 8 casos de flag, nova tentativa e criação de
    playoff (258, 291, 386, 416, 444, 460, 473); **fica** o de `phaseAutoStartPlayoffs` (522); os dois
    F17 (347, 368) são substituídos pelos casos novos.
  - `test/ab-cron-evaluate.test.ts` (18 casos) (emenda 1: S-C11, G-P2-B1): **não refaça a ordem das
    chamadas ao falso.** O arquivo testa a rota e as fases juntas por posição de chamada (`:726` "Call 3:
    Phase 3", `:782`), e toda mudança de fase quebra o arranjo. Troque o arranjo: `vi.mock('@/lib/youtube/ab-evaluate-phases')`
    com resultados fixos por teste (`phaseEvaluateActiveTests`, `phaseAutoStartPlayoffs` e as demais fases
    que a rota chama), e deixe **só os casos da rota**: 401; as seis chaves da resposta; `resolved` igual a
    `evaluation.resolved`; `recordCronFailure` quando `evaluation.errors + playoffs.errors > 0` e
    `recordCronSuccess` quando zero. Saem os de carência, encerramento automático, flag e playoff (297,
    327, 382, 398, 423, 455, 555, 589, 654), os dois do contador (244, 277), o que afirma `playoffs_created`
    (781) e os de duração máxima (484, 520: o comportamento de fase está nos casos novos de
    `test/youtube/ab-evaluate-phases.test.ts`, cujo falso já é por tabela); **ficam** 210 (401), 218, 227,
    631, reaproveitando o que couber. Acrescente:

    ```ts
    it('a resposta não tem mais applies_retried nem playoffs_created', async () => {
      const corpo = await (await GET(pedidoAutenticado())).json()
      expect(Object.keys(corpo).sort()).toEqual(['errors', 'evaluated', 'longevity_checked', 'playoffs_started', 'resolved', 'status'])
    })

    it('recordCronFailure quando as fases somam erro; recordCronSuccess quando zero', async () => {
      fases.evaluate.mockResolvedValueOnce({ evaluated: 1, resolved: 1, errors: 1 })
      await GET(pedidoAutenticado())
      expect(recordCronFailure).toHaveBeenCalledTimes(1)
      fases.evaluate.mockResolvedValueOnce({ evaluated: 1, resolved: 1, errors: 0 })
      await GET(pedidoAutenticado())
      expect(recordCronSuccess).toHaveBeenCalledTimes(1)
    })
    ```

    O teste de que a flag não faz mais nada **não fica neste arquivo** (com as fases simuladas ele seria
    vazio): está em `ab-evaluate-phases.test.ts`, passo 1, com o arranjo que o código de hoje aplicaria.
  - `test/api/cron/ab-evaluate.test.ts`: sai a afirmação sobre `consecutive_confident_evals` (207).
  - `test/youtube/ab-critical.test.ts` e `test/youtube/ab-gates.test.ts`: já são de função pura; **não
    mudam** (confira que continuam verdes).
- [ ] **Passo 8.** Rodar os arquivos e o `tsc`. Depois:
  `grep -rn "isAutoApplyEnabled\|phaseRetryFailedApplies\|phaseDetectPlayoffEligibility\|AB_AUTO_APPLY_WINNER" apps/web/src`
  sem saída. E, em `apps/web/test` (emenda 1: G-P2-sugestão):
  `grep -rln "AB_AUTO_APPLY_WINNER" apps/web/test` → **só** `test/youtube/ab-evaluate-phases.test.ts` (o caso
  da flag), para o dia em que alguém reintroduzir a leitura.
- [ ] **Passo 8b, teste de integração contra o banco** (emenda 1: G-P2-B2). Novo arquivo
  `test/integration/ab-evaluate-duracao-maxima.test.ts`, com `describe.skipIf(skipIfNoLocalDb())`
  (`test/helpers/db-skip.ts`), no banco `bythiago_int` (`npm run db:start && HAS_LOCAL_DB=1 npx vitest run
  test/integration/ab-evaluate-duracao-maxima.test.ts`, portas 54421/54422; o 54321 é do navegador e não
  entra). Só usa tabelas e colunas que já estão em `supabase/migrations/` de `origin/staging`. Modelo de
  colunas: `test/integration/ab-tests-title-desc.test.ts` e a migration `20260517000001_ab_testing.sql`.
  Semeia site, vídeo, canal e teste `active` com `started_at = now() - 15 dias`, `max_duration_days: 14`,
  `original_thumbnail_url` **fora** de `blob.vercel-storage.com`, duas variantes e 2 ciclos abertos; chama
  `phaseEvaluateActiveTests(clienteDeServico)` e confere por `select`:

  ```ts
  describe.skipIf(skipIfNoLocalDb())('ab-evaluate: duração máxima contra o banco', () => {
    it('thumbnail vencida: encerra só o active, fecha os ciclos, limpa vencedor e carência', async () => {
      const { testeId } = await semearTesteAtivo({ tipo: 'thumbnail', diasNoAr: 15, ciclosAbertos: 2, vencedorSugerido: true })
      const r = await phaseEvaluateActiveTests(clienteDeServico())
      expect(r.resolved).toBeGreaterThanOrEqual(1)          // (emenda 2: G2-N3) o banco pode ter outros `active`; lê-se por id, não por total
      expect(r.errors).toBeGreaterThanOrEqual(1)            // original fora do Blob + variante que foi ao ar: errors 1 (emenda 1: S-C7)
      const t = await lerTeste(testeId)
      expect(t).toMatchObject({
        status: 'completed', completed_reason: 'inconclusive', confidence_at_completion: null,
        winner_variant_id: null, grace_expires_at: null, winner_applied_at: null, applied_by: null,
      })
      expect(t.status_note).toMatch(/original não restaurado/)
      expect(await contarCiclosAbertos(testeId)).toBe(0)
    })

    it('teste de título vencido: encerra sem status_note e sem erro', async () => {
      const { testeId } = await semearTesteAtivo({ tipo: 'title', diasNoAr: 15, ciclosAbertos: 1 })
      expect((await phaseEvaluateActiveTests(clienteDeServico())).resolved).toBeGreaterThanOrEqual(1)   // (emenda 2: G2-N3)
      const t = await lerTeste(testeId)
      expect(t.status).toBe('completed')
      expect(t.status_note).toBeNull()
    })

    it('teste com 3 dias não muda nenhuma linha', async () => {
      const { testeId } = await semearTesteAtivo({ tipo: 'thumbnail', diasNoAr: 3, ciclosAbertos: 1 })
      const antes = await lerTeste(testeId)
      await phaseEvaluateActiveTests(clienteDeServico())
      expect(await lerTeste(testeId)).toEqual(antes)
      expect(await contarCiclosAbertos(testeId)).toBe(1)
    })

    it('teste encerrado à mão (completed, com vencedor) não é tocado', async () => {
      const { testeId } = await semearTesteEncerradoAMao({ diasNoAr: 15 })
      const antes = await lerTeste(testeId)
      await phaseEvaluateActiveTests(clienteDeServico())
      expect(await lerTeste(testeId)).toEqual(antes)
    })
  })
  ```

  `semearTesteAtivo`, `semearTesteEncerradoAMao`, `lerTeste`, `contarCiclosAbertos` e `clienteDeServico`
  são auxiliares do próprio arquivo (uuids fixos, limpeza por id no `afterAll`; nada de `db:reset`). (emenda 2: G2-N3) Os asserts são **por id** (`lerTeste(testeId)`), nunca por total: o `phaseEvaluateActiveTests` roda sobre todos os `active` do `bythiago_int`, e outro arquivo de integração (`ab-tests*.test.ts`, `ab-brainstorm.test.ts`) pode ter deixado teste `active` antigo; se houver risco de paralelismo, `update ab_tests set status='paused'` nos `active` que não são do arquivo antes de cada caso.
  Prova de que falha na base: no commit-base o primeiro caso falha (o código de hoje não limpa o vencedor
  nem grava `status_note`). Sem CI de banco o arquivo é inerte lá (skip por padrão) e roda local. Se o
  controlador recusar o arquivo, a alternativa mínima é a Tarefa 6 rodar esse cenário por script contra o
  54421 e anexar as linhas lidas.
- [ ] **Passo 9, commit:** `fix: o cron ab-evaluate deixa de declarar vencedor, abrir carência, criar playoff e aplicar; só encerra por duração máxima (A/B Lab P2, Tarefa 1)`.

### Tarefa 2: somem as configurações sem efeito

**Interfaces.** `AbTestConfig.auto_apply_winner` e `AbTestSiteSettings.default_auto_apply` passam a
**opcionais** no tipo e no schema, com o comentário `/** @deprecated ignorada desde 10/2026 (A/B Lab P2) */`;
saem de `AB_TEST_CONFIG_DEFAULTS` e de `AB_SITE_SETTINGS_DEFAULTS`. O adaptador do wizard deixa de
produzir `auto_apply_winner` e de ler `autoApply` e `playoff`.

- [ ] **Passo 1, testes que falham.**
  - `test/ab-config.test.ts:11`: `expect(AB_TEST_CONFIG_DEFAULTS).not.toHaveProperty('auto_apply_winner')`
    e `expect(AB_SITE_SETTINGS_DEFAULTS).not.toHaveProperty('default_auto_apply')`.
  - caso novo, no mesmo arquivo:

    ```ts
    it('configuração antiga com auto_apply_winner continua válida e a chave é aceita sem efeito', () => {
      const antigo = { ...AB_TEST_CONFIG_DEFAULTS, auto_apply_winner: true }
      expect(AbTestConfigSchema.safeParse(antigo).success).toBe(true)
      const semAChave = { ...AB_TEST_CONFIG_DEFAULTS }
      expect(AbTestConfigSchema.safeParse(semAChave).success).toBe(true)
    })

    it('configuração de site antiga com default_auto_apply continua válida', () => {
      expect(AbTestSiteSettingsSchema.safeParse({ ...AB_SITE_SETTINGS_DEFAULTS, default_auto_apply: false }).success).toBe(true)
      expect(AbTestSiteSettingsSchema.safeParse({ ...AB_SITE_SETTINGS_DEFAULTS }).success).toBe(true)
    })
    ```
  - `test/ab-actions-create.test.ts:30`: o `config` gravado na criação **não** tem `auto_apply_winner`.
  - telas (emenda 1: G-P2-C1): em `test/ab-settings-drawer.test.tsx` e nos dois `ab-step-config.test.tsx`,
    `expect(screen.queryByRole('switch', { name: /aplicar vencedor/i })).toBeNull()`,
    `expect(screen.queryByRole('switch', { name: /playoff/i })).toBeNull()` e
    `expect(screen.queryByRole('slider', { name: /confiança/i })).toBeNull()`. ~~`queryByText(/confiança/i)`~~:
    "confiança" continua legítima no painel de critérios, e o teste falharia depois por motivo errado ou
    seria afrouxado. **Confira no base** que cada controle é achado antes (rode uma vez com a afirmação
    invertida, `not.toBeNull()`); sem isso o teste é vazio.
- [ ] **Passo 2.** Rodar: falham.
- [ ] **Passo 3, tipos e schema.** `ab-types.ts`: `auto_apply_winner?: boolean` (13) e
  `default_auto_apply?: boolean` (210) com o `@deprecated`; saem as chaves dos dois objetos de padrão
  (22, 233). `ab-schemas.ts`: `auto_apply_winner: z.boolean().optional()` (31) e
  `default_auto_apply: z.boolean().optional()` (39).
- [ ] **Passo 4, wizard e telas.**
  - `ab-wizard-adapter.ts`: saem `auto_apply_winner: cfg.autoApply` (27), `autoApply: settings.default_auto_apply`
    (38) e `playoff: true` (41); os campos `autoApply` e `playoff` saem do estado do wizard (o `tsc`
    aponta o redutor e os componentes que os usam).
  - `settings-drawer.tsx`: sai o bloco "Aplicar vencedor automaticamente" (211-217) e o slider "limiar
    de confiança" (195-207).
  - `step-config.tsx`: saem "Aplicar vencedor automaticamente" (76-83), "Playoff automático" (113-120) e
    "Confiança alvo" (62-72).
  - `step-revisar.tsx`: o resumo perde "confiança X%" (54) e "playoff on/off" (56).
  - `live-monitor.tsx:122-124`: sai a frase "Se o CTR cair abaixo do esperado, o Intelligence Engine
    reabre o vídeo pra um novo teste automaticamente."
  - `active-detail.tsx:142`: sai a frase "O vencedor será aplicado automaticamente quando o período de
    graça expirar." (decisão E9: o resto do banner fica).
- [ ] **Passo 5, demais testes.** `ab-settings-drawer.test.tsx:97-112` usa "o terceiro switch": com um
  switch a menos o índice muda, **reescreva para achar o controle pelo rótulo**. Os dois
  `ab-step-config.test.tsx` (`:41`, `:44`, `:109`, "renders two 42x24px toggles": passa a zero ou sai);
  `test/cms/ab-step-revisar.test.tsx:64-76`; os dois `ab-wizard-reducer.test.tsx:244`;
  `test/youtube/ab-wizard-adapters.test.ts:7-15`; `ab-wizard-components.test.tsx:650-774`;
  `ab-high.test.ts:662-727`. Os testes de integração (`test/integration/ab-tests*.ts`,
  `ab-brainstorm.test.ts`) gravam `auto_apply_winner` como dado: **não mudam** (a chave é aceita).
- [ ] **Passo 6.** Rodar os arquivos e o `tsc`:
  `grep -rn "auto_apply_winner\|default_auto_apply\|autoApply" apps/web/src | grep -v database.types`
  → só as duas linhas `@deprecated` de `ab-types.ts` e as duas de `ab-schemas.ts`.
- [ ] **Passo 7, commit:** `fix: somem do A/B Lab as configurações sem efeito (aplicar vencedor, playoff automático, limiar de confiança) e os textos que prometiam automação (A/B Lab P2, Tarefa 2)`.

### Tarefa 3: saem os números fabricados da tela (resposta 10 do dono)

Tarefa separável: pode ser cortada sem refazer as outras.

**Interfaces.** `RankedVariant` perde `pTop2` (`ab-types.ts:274`); o view do teste ativo perde `revenue`
(`ab-types.ts:458`). Nasce a constante, em `AB/_components/ab-constants.ts`:

```ts
export const SEM_MEDICAO_DE_ENTREGA = 'Sem medição de entrega por enquanto'
```

- [ ] **Passo 1, testes que falham** (emenda 1: G-P2-C1). Em `test/youtube/ab-detail-active*` (o arquivo
  que renderiza o detalhe do teste ativo). ~~Os termos `/tempo assistido/i` e `/compartilhamentos/i`~~ não
  casam com o que a tela escreve: os rótulos reais do radar (`radar-chart.tsx:24-31`) são "Watch time",
  "Comentários" e "Compartilh.", e o cartão é "Receita estimada" (`active-detail.tsx:276`); o bloco é
  "Raio-X das variantes" (`:333`). Use `queryAllByText` (o `queryByText` lança com mais de uma ocorrência):

  ```tsx
  it('não mostra watch time, comentários, compartilh., top 2, receita estimada nem Raio-X; mostra a frase fixa', () => {
    render(<ActiveDetail view={viewAtivo} />)
    for (const texto of [/watch time/i, /comentários/i, /compartilh/i, /top ?2/i, /receita estimada/i, /raio-x/i]) {
      expect(screen.queryAllByText(texto)).toHaveLength(0)
    }
    expect(screen.getAllByText('Sem medição de entrega por enquanto').length).toBeGreaterThan(0)
  })

  // (emenda 1: D-P2-5) confidence_at_completion nulo não vira "0%"
  it('teste encerrado com confidence_at_completion nulo não mostra "0%" de confiança; mostra a frase fixa', () => {
    render(<WinnerDetail view={viewEncerradoSemConfianca} />)   // view montada por queries.ts com confidence_at_completion: null
    expect(screen.queryAllByText(/^0%$/)).toHaveLength(0)
    expect(screen.getAllByText('Sem medição de entrega por enquanto').length).toBeGreaterThan(0)
  })
  ```

  **Confira cada termo no base**: rode uma vez com `toHaveLength(0)` invertido para `> 0`; o teste tem de
  achar o texto antes, senão é vazio. Nada disto prova o aceite sozinho: a prova de tela é a captura local
  com semente cheia (Tarefa 6).

  E em `test/youtube/ab-high.test.ts:308`: `toHaveProperty('pTop2')` vira `not.toHaveProperty('pTop2')`.
- [ ] **Passo 2.** Rodar: falham.
- [ ] **Passo 3, `active-detail.tsx`.** Sai o mapeamento com `watchTime`, `comments` e `shares` (77-79)
  e o bloco "Raio-X das variantes" (326-338), com a frase fixa no lugar (um parágrafo com a mesma classe
  de texto secundário que o arquivo já usa para "Coletando dados..."); sai o cartão "Receita estimada"
  (274-282) e o ramo de 292 que dependia de `!view.revenue`, com a frase fixa no lugar.
- [ ] **Passo 3b, confiança nula** (emenda 1: D-P2-5). `AB/queries.ts:488`
  (`(test.confidence_at_completion ?? 0) * 100`): o campo do view passa a `confidence: number | null`
  (`null` quando `confidence_at_completion` é nulo) e o componente que o mostra (`winner-detail.tsx` e o
  que usa `data.confidence`) mostra `SEM_MEDICAO_DE_ENTREGA` quando nulo; o `tsc` aponta os leitores.
- [ ] **Passo 4, `AB/queries.ts`.** Sai o cálculo de `pTop2` (1035, 1040-1042), a consulta e o cálculo
  da receita (1282-1291) e a atribuição ao view (1328); a ordenação dos finalistas por `pTop2` (1339)
  passa a ser por `pBest`. `computeRevenueRange` (`lib/youtube/ab-computed.ts`) e o teste dela **ficam**.
- [ ] **Passo 5, quem mostra `pTop2`.** `rank-bars.tsx:8-9` e `variant-table.tsx:12`: o tipo
  `metric: 'pBest' | 'pTop2'` vira só `'pBest'` (se a prop ficar com um valor só, ela sai);
  `playoff-detail.tsx:125,146-147`: os finalistas mostram `pBest`. `radar-chart.tsx`: se depois do passo
  3 o componente ficou sem nenhum uso (`grep -rn "RadarChart" apps/web/src`), **apague o arquivo e o
  bloco dele em `test/ab-charts.test.tsx:336-374`**; se ainda tiver uso, saem os eixos `watchTime`,
  `comments`, `shares` e `pTop2`. Os `mock-views.ts` (só desenvolvimento) perdem o campo.
- [ ] **Passo 6, testes.** `ab-chart-math`, `ab-charts`, `ab-variant-table-title`,
  `youtube/ab-detail-{active,playoff,winner}`, `ab-high`, `ab-medium`: sai o campo das fixtures e as
  afirmações sobre ele.
- [ ] **Passo 7.** Rodar e `tsc`.
  `grep -rn "pTop2\|\* 600\|0\.008\|views28d \* 13" "apps/web/src/app/cms/(authed)/youtube/ab-lab" apps/web/src/lib/youtube/ab-types.ts`
  sem saída.
- [ ] **Passo 8, commit:** `fix: saem do detalhe do teste os números fabricados (tempo assistido, comentários, compartilhamentos, top 2, receita anual) (A/B Lab P2, Tarefa 3)`.

### Tarefa 3b: a tela deixa de mostrar critérios e probabilidade sobre views (a Hanna recomenda que entre; entra com o sim do dono à pergunta 13)

(emenda 1: D-P2-8, S-E3; emenda 2: H2-3b) **A Hanna recomenda que entre no mesmo envio da P2; entra com o sim do dono à pergunta 13** (a 3b tira tela que a resposta 10 dele não cobre). A decisão **sai da Tarefa 6**: Logan e Naksu julgam o *resultado* da 3b, não se ela entra. Separável: pode ser cortada sem refazer as outras; vai depois da Tarefa 3. **Fatia de corte:** **3b-1 (painel do CMS: `avgConfidence`, `avgLift`, `monthlyExtraClicks` e `winRate` pela E10) vai junto da Tarefa 4**; **3b-2 (detalhe do teste ativo: painel de critérios e "probabilidade de ser a melhor") é a primeira a sair** se o lote ficar grande, ou se Logan ou Naksu reprovarem o resultado dela na Tarefa 6 (a frase repetida em vários blocos do mesmo detalhe pode ler como tela quebrada). Cortada a 3b-2, volta o gatilho: em produção antes do primeiro teste. Se o dono disser não, a "sobra declarada" (seção 3) e o risco da seção 8 valem. **Critério de aceite próprio: 9c, na seção 6.**

**Por quê.** Com E3 o contador `consecutive_confident_evals` não é mais gravado: todo teste novo mostra
"0 / 3" de estabilidade e a dica "Need 3 more consecutive confident evaluations"
(`lib/youtube/ab-gates.ts:58-60`, lido em `AB/queries.ts:1131`) para sempre, prometendo uma avaliação que
o cron não faz mais. E o painel do CMS mostra `avgConfidence`, `winRate` e `avgLift`
(`computeDashboardStats`, `queries.ts:572-598`) e `monthlyExtraClicks ?? 0` (`:1399`) que o pipeline passa
a anular: mesmo dado, dois números.

- [ ] **Passo 1, testes que falham.** No arquivo de teste do detalhe ativo e no do painel
  (`test/youtube/ab-detail-active*`, o teste de `ab-lab-dashboard`):

  ```tsx
  it('o detalhe do teste ativo não mostra o painel de critérios nem "0 / 3"; mostra a frase fixa no lugar', () => {
    render(<ActiveDetail view={viewAtivo} />)
    expect(screen.queryAllByText(/0 ?\/ ?3/)).toHaveLength(0)
    expect(screen.queryAllByText(/avalia[cç][õo]es? consecutivas?/i)).toHaveLength(0)
    expect(screen.queryAllByText(/probabilidade de ser a melhor/i)).toHaveLength(0)
    expect(screen.getAllByText('Sem medição de entrega por enquanto').length).toBeGreaterThan(0)
  })

  it('o painel do CMS não mostra confiança média nem lift médio calculados sobre views', () => {
    render(<AbLabDashboard {...propsComTestesConcluidos} />)
    for (const texto of [/confiança média/i, /lift médio/i]) {
      expect(screen.queryAllByText(texto)).toHaveLength(0)
    }
  })

  // (emenda 2: H2-winRate) o cartão de vitória FICA, com a regra da E10; a 3b não pode abrir a disparidade inversa
  it('a taxa de vitória do painel mostra o mesmo valor que o pipeline entrega; null vira a frase fixa', () => {
    render(<AbLabDashboard {...propsComUmManualUmAutoResolveUmInconclusivo} />)   // E10: 1 de 2 = 50%
    expect(screen.getAllByText(/50(,0)?\s?%/).length).toBeGreaterThan(0)
    render(<AbLabDashboard {...propsSoAutoResolve} />)                            // nenhum teste que conte: winRate null
    expect(screen.getAllByText('Sem medição de entrega por enquanto').length).toBeGreaterThan(0)
  })
  ```

  **Confira os termos no base** (invertendo para `> 0`): os rótulos reais vêm de `gates-panel.tsx`,
  `rank-bars.tsx` e `ab-lab-dashboard.tsx` (`:246-263`); troque os regex pelos textos que a tela escreve.
- [ ] **Passo 2.** Rodar: falham.
- [ ] **Passo 3.** `active-detail.tsx`: o `<GatesPanel gates={view.gates} />` (`:428`) e o bloco que mostra
  a "probabilidade de ser a melhor" (`RankBars` com `metric="pBest"`, `:365`, e o uso em `:303`) dão lugar
  a `SEM_MEDICAO_DE_ENTREGA`. `ab-lab-dashboard.tsx:246-263`: os cartões `avgConfidence` e
  `avgLift` mostram a frase. (emenda 2: H2-winRate) **O cartão `winRate` não se apaga**: segue a E10 (mesmo filtro e mesma conta do pipeline, via `ehVitoriaHumana`; `auto_resolve` fora do numerador e do denominador), e `null` vira a frase. `AB/queries.ts:572-598` (`computeDashboardStats`) deixa de
  calcular `avgConfidence` e `avgLift` (e de devolver `0` no lugar de `null`) e passa a calcular `winRate` pela E10 (`null` quando nenhum teste conta); `:1399`: `monthlyExtraClicks` deixa de ser
  `?? 0` e passa a `number | null`, e quem o mostra usa a frase. `lib/youtube/ab-gates.ts` **não muda**
  (função pura, tem teste; sem chamador na tela depois deste passo, fica como `ab-statistics.ts`).
- [ ] **Passo 4.** Rodar os testes da tarefa e o `tsc`; `grep -rn "GatesPanel" apps/web/src` mostra o que
  ficou sem uso (apague o componente e o teste dele só se não houver outro uso).
- [ ] **Passo 5, commit:** `fix: a tela do A/B Lab deixa de mostrar critérios, probabilidade de ser a melhor e médias calculadas sobre views (A/B Lab P2, Tarefa 3b)`.

### Tarefa 4: o pipeline entrega `null` com aviso (resposta 7 do dono)

Tarefa separável. **Um commit só** (paridade). (emenda 2: H2-3b) A 3b-1 (painel do CMS) vai junto desta tarefa.

**Interfaces.** Em `src/lib/pipeline/services/youtube.ts` nasce:

```ts
/** Enquanto o A/B não tiver métrica de entrega real, esses campos saem null com este aviso. */
export const AVISO_SEM_METRICA_DE_ENTREGA = 'sem métrica de entrega' as const
```

O que cada resposta passa a devolver (a **forma** não muda: mesmas chaves, mais `aviso`; em resposta que é
**lista** o `aviso` vai em cada item, não no topo, para o vetor continuar vetor) (emenda 1: D-P2-2, D-P2-3,
D-P2-4):

| Função (linha de hoje) | Vira `null` | Fica | Ganha |
|---|---|---|---|
| `getAbTestFunnel` (1038-1132) | `per_variant[].impressions`, `per_variant[].clicks` | `link_clicks`, `per_link`, `link_clicks_window` (cliques reais de link) | `aviso` |
| `getAbTest` (993) | `cycles[].impressions`, `clicks`, `ctr`, `estimated_impressions`, `estimated_clicks`, `estimated_ctr`; `confidence_at_completion`; `consecutive_confident_evals`; `result_metadata.ctr_lift_percent`, `result_metadata.total_impressions`, `result_metadata.estimated_monthly_extra_clicks` | `result_metadata.winner_label`; `cycles[].views`, `avd_seconds`, `likes`, `subscribers_gained`, `estimated_revenue` (sem gravador em `src`; devem ser `null` em produção; **se o executor achar gravador, devolve ao controlador**); o resto da linha | `aviso` |
| `listAbTests` (963) | por teste, os mesmos campos do teste de `getAbTest` | o resto | `aviso` **em cada item**; a resposta continua vetor (a rota entrega o vetor direto, `ab-tests/route.ts:16-17`) |
| `getAbLearnings` (1437-1525) | `tagWinRates[].avgLift`; em `channelInsights`, saem as frases que citam percentual de lift ou de queda | `wins`, `total`, `kind`, `totalCompletedTests`; vitória conta só com `completed_reason in ('manual_winner','manual_apply')` | `aviso`, **também no retorno antecipado** (`:1450-1452`, `{ tagWinRates: [], channelInsights: [], totalCompletedTests: 0 }`); o texto `'Not enough data for insights'` (diz "faltam testes" quando a causa é "não há métrica") dá lugar ao próprio `aviso` |
| `getAbPerformance` (1145-1156; **não citada antes**) | nada de entrega | `winning_patterns`, `winning_tags`; vitória conta só com `completed_reason in ('manual_winner','manual_apply')` | `aviso` |
| `getAbDashboard` (1707-1760) | `avgConfidence`, `avgLift` | `activeTests`, `testsByStatus`; `winRate` conta só vitória humana (`ehVitoriaHumana`), com o `auto_resolve` fora do numerador **e do denominador**, e é **`null`** (nunca `0`) quando não sobra teste que conte (emenda 2: D2-1) | `aviso` |
| `getAbVideoHistory` (1778-1810) | `tests[].liftPercent` | o resto; `winner` só sai preenchido quando `ehVitoriaHumana` (o `select` ganha `winner_variant_id, completed_reason`; emenda 2: D2-2) | `aviso`; leitura com erro lança `DB_ERROR` 500 (emenda 2: D2-5) |
| `getThumbnailLibrary` (1823-1865) | `thumbnails[].lift` | o resto | `aviso` |

Tipos: cada campo que vira `null` passa a `number | null` no tipo de retorno. `aviso` é
`typeof AVISO_SEM_METRICA_DE_ENTREGA`. **Projeção explícita** (emenda 1: D-P2-2): ~~anular campos depois
de `select *`~~ o mapeamento de `getAbTest` e `listAbTests` monta o objeto de saída por **lista fechada**
dos campos que saem como vieram, e todo campo de entrega é `null` explícito. Coluna futura de `ab_tests` ou
de `ab_test_cycles` não vaza sem alguém decidir (o `select` do banco não muda). (emenda 2: D2-4) **A lista fechada, escrita como constante no serviço, é esta** (colunas reais de hoje, `database.types.ts`): do teste, **todas as colunas de hoje de `ab_tests` menos** `confidence_at_completion` e `consecutive_confident_evals` (saem `null`) e `result_metadata` (reprojetado: `winner_label` como veio, as três métricas `null`); mais `variants` e `cycles`. Do ciclo: `id`, `test_id`, `variant_id`, `cycle_number`, `started_at`, `ended_at`, `created_at`, `applied_metadata`, `backfill_status`, `backfill_attempts`, `views`, `avd_seconds`, `likes`, `subscribers_gained`, `estimated_revenue`; as seis de entrega saem `null`. (`ab_tests` tem quatro colunas numéricas: `confidence_at_completion`, `consecutive_confident_evals`, `round_number`, `apply_attempts`; `round_number` e `apply_attempts` continuam números.)

Vitória humana (emenda 1: S-C8, D-P2-3; emenda 2: D2-1, D2-2): a regra mora **num predicado só**, em `src/lib/youtube/ab-types.ts` (onde mora `CompletedReason`, que já lista `manual_winner`, `manual_apply` e `manual_no_apply`):

```ts
export const RAZOES_DE_VITORIA_HUMANA = ['manual_winner', 'manual_apply'] as const
export function ehVitoriaHumana(t: { completed_reason: string | null; winner_variant_id: string | null }): boolean {
  return t.winner_variant_id !== null && (RAZOES_DE_VITORIA_HUMANA as readonly string[]).includes(t.completed_reason ?? '')
}
```

`ehVitoriaHumana` é usada em **todos** os lugares que contam ou mostram vencedor: `getAbDashboard` (`:1736`), `getAbLearnings` (`:1448`), `getAbPerformance` (`:1153`), `getAbVideoHistory.winner`, as duas linhas de `mcp/prompts.ts` (`:660` e `:749`: `winner_label: ehVitoriaHumana(t) ? 'variant' : null`) e o prompt de coaching (`youtube-prompt-actions.ts:271-274` e `:531-534`: o `select` de `:271` ganha `completed_reason` e o filtro é em memória). Todas incluem `completed_reason` no `select` e filtram **em memória**, depois da leitura (para não excluir `null` por engano no PostgREST). `getAbLearnings`: o filtro vem **logo depois da leitura, antes do retorno antecipado** de `:1450`; `totalCompletedTests`, `winnerIds` e `testIds` saem da lista já filtrada. `winRate` de `getAbDashboard`:

```ts
const rootCompleted = completed.filter(t => t.parent_test_id === null)
// "conta" = teste encerrado por decisão de pessoa ou por duração; veredito da máquina e razão desconhecida ficam fora
const contam = rootCompleted.filter(t => t.completed_reason !== null && t.completed_reason !== 'auto_resolve')
const vitorias = contam.filter(ehVitoriaHumana).length
const winRate = contam.length > 0 ? (vitorias / contam.length) * 100 : null
```

(Sem isso, produção com **apenas** testes `auto_resolve` devolveria `winRate: 0`: não medido lido como zero.) `manual_no_apply` fica fora: ver a nota da decisão E10.

Leitura que falha (emenda 1: D-P2-9, S-D6): nas funções que esta tarefa toca (`getAbDashboard`,
`getAbLearnings`, `getAbPerformance` e, emenda 2: D2-5, `getAbVideoHistory`, que em `services/youtube.ts:1784` faz `const { data: tests } = …` sem conferir `error`; mais as duas leituras secundárias de `getAbLearnings`, `:1457-1463`, hoje `.data ?? []`: cada leitura), `if (error) return err('DB_ERROR', '...', 500)` logo depois de cada
leitura, como `listAbTests` já faz (`:981`). Banco fora não pode sair como `activeTests: 0` com `aviso`.

- [ ] **Passo 1, testes que falham** (emenda 1: S-C3, S-C12, D-P2-4, D-P2-9, G-P2-C4). Moldes com o contrato
  real: `const { data } = await getAbTestFunnel(ctx, testId)` e afirmar sobre `data`; **sem** `r.ok`.

  ```ts
  it('funil: impressões e cliques de entrega saem null com aviso; cliques de link continuam número', async () => {
    const { data } = await getAbTestFunnel(ctx, testId)   // mesmo arranjo do caso de hoje, ciclos com impressions 150 e 200
    expect(data.aviso).toBe('sem métrica de entrega')
    expect(data.per_variant.length).toBeGreaterThan(0)    // senão o laço abaixo não observa nada
    for (const v of data.per_variant) {
      expect(v.impressions).toBeNull()
      expect(v.clicks).toBeNull()
      expect(typeof v.link_clicks).toBe('number')
    }
  })

  it('painel: confiança média e lift médio saem null com aviso, nunca zero; winRate só conta vitória humana', async () => {
    // três encerrados: manual_winner (com vencedor), auto_resolve (com vencedor), inconclusive
    const { data } = await getAbDashboard(ctx)
    expect(data.avgConfidence).toBeNull()
    expect(data.avgLift).toBeNull()
    expect(data.aviso).toBe('sem métrica de entrega')
    // (emenda 2: D2-1) o auto_resolve sai do numerador E do denominador: 1 de 2 (manual_winner e inconclusive)
    expect(data.winRate).toBe(50)
  })

  // (emenda 2: D2-1)
  it('painel com só auto_resolve concluídos: winRate é null, nunca 0', async () => {
    const { data } = await getAbDashboard(ctxSoAutoResolve)
    expect(data.winRate).toBeNull()
  })

  // (emenda 2: G2-N2, D2-2) fixa a decisão 1: manual_no_apply COM winner_variant_id preenchido não é vitória
  it('manual_no_apply com vencedor preenchido não conta como vitória, em nenhuma das cinco leituras nem no prompt de coaching', async () => {
    // fixture: um manual_no_apply COM winner_variant_id e um manual_winner
    const dash = await getAbDashboard(ctxNoApplyEManualWinner)
    expect(dash.data.winRate).toBe(50)   // 1 de 2; o manual_no_apply está no denominador e fora do numerador
    for (const chamar of [
      () => getAbLearnings(ctxNoApplyEManualWinner),
      () => getAbPerformance(ctxNoApplyEManualWinner),
      () => getAbVideoHistory(ctxNoApplyEManualWinner, videoDoNoApply),
    ]) {
      const { data } = await chamar()
      expect(JSON.stringify(data)).not.toContain('tag-so-do-no-apply')
      expect(JSON.stringify(data)).toContain('tag-so-do-manual')
    }
    expect(historicoParaOPromptDeCoaching(ctxNoApplyEManualWinner)).not.toContain('tag-so-do-no-apply')   // youtube-prompt-actions.ts:271-274
  })

  it('painel sem nenhum teste concluído: winRate null, nunca 0, e o aviso está lá', async () => {
    const { data } = await getAbDashboard(ctxSemTestes)
    expect(data.winRate).toBeNull()
    expect(data.aviso).toBe('sem métrica de entrega')
  })

  it('getAbTest: ciclo com impressions 100 e confidence_at_completion 0.97 saem null; só as chaves numéricas esperadas continuam', async () => {
    const { data } = await getAbTest(ctx, testId)
    expect(data.confidence_at_completion).toBeNull()
    expect(data.consecutive_confident_evals).toBeNull()
    expect(data.result_metadata).toMatchObject({ ctr_lift_percent: null, total_impressions: null, estimated_monthly_extra_clicks: null })
    expect(data.aviso).toBe('sem métrica de entrega')
    // fixa a lista: coluna nova de ab_tests / ab_test_cycles que vaze como número reprova aqui
    // (emenda 2: D2-4) o fixture traz TODAS as colunas das duas tabelas, com valor diferente de zero em cada numérica;
    // listas ordenadas. Fixture magro passaria sem guardar nada; fixture fiel com `[]` reprovaria.
    expect(chavesNumericasNaoNulas(data.cycles[0])).toEqual(['avd_seconds','backfill_attempts','cycle_number','estimated_revenue','likes','subscribers_gained','views'])
    expect(chavesNumericasNaoNulas(data)).toEqual(['apply_attempts','round_number'])
  })

  it('listAbTests continua vetor, com aviso em cada item', async () => {
    const { data } = await listAbTests(ctx, {})
    expect(Array.isArray(data)).toBe(true)
    for (const t of data) {
      expect(t.aviso).toBe('sem métrica de entrega')
      expect(t.confidence_at_completion).toBeNull()
    }
  })

  it.each([
    ['getAbDashboard', () => getAbDashboard(ctxSemTestes)],
    ['getAbLearnings', () => getAbLearnings(ctxSemTestes)],
    ['getAbPerformance', () => getAbPerformance(ctxSemTestes)],
    ['getAbVideoHistory', () => getAbVideoHistory(ctxSemTestes, videoId)],
    ['getThumbnailLibrary', () => getThumbnailLibrary(ctxSemTestes, {})],
  ])('%s sem nenhum teste concluído: a resposta tem aviso (também no retorno antecipado)', async (_nome, chamar) => {
    const { data } = await chamar()
    expect(JSON.stringify(data)).toContain('sem métrica de entrega')
  })

  it.each([
    ['getAbDashboard', () => getAbDashboard(ctxBancoFora)],
    ['getAbLearnings', () => getAbLearnings(ctxBancoFora)],
    ['getAbPerformance', () => getAbPerformance(ctxBancoFora)],
    ['getAbVideoHistory', () => getAbVideoHistory(ctxBancoFora, videoId)],   // (emenda 2: D2-5)
  ])('%s: leitura com erro lança PipelineServiceError 500, não devolve zero com aviso', async (_nome, chamar) => {
    await expect(chamar()).rejects.toMatchObject({ code: 'DB_ERROR', status: 500 })
  })

  it('getAbLearnings e getAbPerformance: vencedor de auto_resolve não conta como vitória', async () => {
    const { data } = await getAbLearnings(ctxComUmAutoResolveEUmManual)
    expect(data.tagWinRates.every(t => t.avgLift === null)).toBe(true)
    expect(data.tagWinRates.find(t => t.tag === 'tag-so-do-auto')).toBeUndefined()
    // (emenda 2: S2-8) getAbPerformance também: poderia continuar contando por winner_variant_id sem que nada reprovasse
    const perf = await getAbPerformance(ctxComUmAutoResolveEUmManual)
    expect(JSON.stringify(perf.data)).not.toContain('tag-so-do-auto')
    expect(JSON.stringify(perf.data)).toContain('tag-so-do-manual')
  })

  // (emenda 1: G-P2-C4) paridade REST x MCP, em test/mcp/mcp-schema-reads.test.ts, que já tem leituras do MCP
  it('paridade: o mesmo fixture pelo serviço (REST) e pela ação MCP get_funnel dá o mesmo JSON, com null e aviso', async () => {
    const rest = await getAbTestFunnel(ctx, testId)
    const mcp = await chamarAcaoMcp('manage_ab_test', { action: 'get_funnel', test_id: testId })
    expect(mcp).toEqual(rest.data)
    expect(JSON.stringify(mcp)).not.toMatch(/"impressions":\s*0/)
    expect(mcp.aviso).toBe('sem métrica de entrega')
  })
  ```

  Um caso do mesmo formato para `getAbVideoHistory` (`liftPercent: null`) e `getThumbnailLibrary`
  (`lift: null`). Nos arquivos: `test/ab-pipeline-api.test.ts:200-206`,
  `test/api/pipeline/youtube-ab-tests.test.ts:221-239`, `test/mcp/mcp-schema-reads.test.ts:353-384`,
  `test/api/pipeline/youtube-ab-extended.test.ts:168-207,502,538,617,652`,
  `test/api/pipeline/youtube-thumbnails.test.ts`. As afirmações de hoje (`impressions: 150/200/1800`,
  `avgLift` 15) são **substituídas**, não acrescidas. Em `test/youtube/prompt-builders-ab.test.ts:195-215`:
  o histórico não tem a chave `lift_medio`, e o texto dos aprendizados não contém `avg lift`.
  **Prova de que falham na base** (emenda 1: decisão transversal 4): rode no commit-base e registre a saída;
  o caso `chavesNumericasNaoNulas`, o de `winRate` humano e o de `DB_ERROR` não podem passar vazios.
  Para o prompt de coaching (D-P2-5): em `test/youtube/` (ou onde `youtube-prompt-actions` já é testada), o
  objeto de resultado de A/B enviado ao prompt **não tem** a chave `confidence`.
- [ ] **Passo 2.** Rodar: falham.
- [ ] **Passo 3, serviços.** Aplicar a tabela de "Interfaces", a projeção explícita (lista fechada), `ehVitoriaHumana` em todos os lugares listados (inclusive `mcp/prompts.ts:660,749` e `getAbVideoHistory.winner`) e o
  `DB_ERROR` (inclusive `getAbVideoHistory`). O `select` de `ab_tests` e de `ab_test_cycles` não muda.
- [ ] **Passo 3b, o prompt de coaching** (emenda 1: D-P2-5). `src/app/cms/(authed)/youtube/_actions/youtube-prompt-actions.ts`
  (a pasta `_actions/` faltava na citação antiga `:271-280`): o `select` de `:271` perde
  `confidence_at_completion` e ganha `completed_reason` (o `winner` do prompt só sai quando `ehVitoriaHumana`, filtro em memória; emenda 2: D2-2); em `:531-536` sai o campo `confidence: Number(t.confidence_at_completion ?? 0)`
  e o campo sai de `AbTestResultRow` (`lib/youtube/prompt-types.ts:132`). Quem consome `abTestResults`
  além da atribuição em `:562`: o `tsc` aponta.
- [ ] **Passo 4, prompts** (`src/lib/youtube/prompt-builders-ab.ts`): `buildHistorySection` (250-275)
  deixa de calcular e de emitir `lift_medio`; as linhas de briefing "lift médio" / "avg lift" (399-403)
  saem; `formatLearningTag` (193-196) passa a `(N wins, kind)`, sem o percentual.
  **Decisão (emenda 1: S-S4):** o tipo de entrada do construtor **perde** `ctr_lift_percent`; por isso
  `AB/actions.ts:1620` e `mcp/prompts.ts:661,750` (que já passam `ctr_lift_percent: null`) **entram na lista
  desta tarefa** e deixam de passar o campo.
- [ ] **Passo 5, MCP e doc.** `mcp/tools.ts:664-665`: a descrição das ações `get_funnel`,
  `get_learnings`, `get_dashboard`, `get_history`, `get_test` e `list_tests` ganha uma frase: "Campos de
  entrega (impressões, cliques, CTR, confiança, lift) saem `null` com `aviso: 'sem métrica de entrega'`
  enquanto o A/B não tiver medição real." `data/pipeline-docs/cowork-docs-youtube.md`: nas seções de
  aprendizados (1306-1352), painel (1429-1459), histórico (1461-1500) e biblioteca (1506-1542), os
  exemplos passam a mostrar `null` e `aviso`, e cada seção ganha a mesma frase. **O funil, `get_test` e
  `list_tests` não têm seção no doc** (só a linha 1634; emenda 1: D-P2-2): acrescente uma seção curta
  com o exemplo `null` + `aviso` dos três, e `winRate: null` quando não há teste que conte. (As linhas
  deslocam depois de P1: ache pelas âncoras `avgLift`, `avgConfidence`, `liftPercent`, `liftAtWin`.)
- [ ] **Passo 6.** Rodar os seis arquivos, mais `test/mcp/mcp-schema-parity.test.ts` e
  `test/mcp/youtube-cowork-docs.test.ts`, e o `tsc`.
- [ ] **Passo 7, commit:** `fix: o pipeline e o MCP entregam null com aviso no lugar de impressões, confiança e lift do A/B, vitória só conta decisão humana, e o lift médio sai dos prompts (A/B Lab P2, Tarefa 4)`.

**Fora desta tarefa, declarado:** os valores já gravados em `ab_tests` (`confidence_at_completion`,
`result_metadata`) **não são tocados** (são o registro do que a máquina decidiu; nenhum `update` aqui é
reversível; anular na saída basta com a lista fechada, a vitória humana e o conserto dos dois leitores).
(emenda 1: a pergunta 2 do Phil foi respondida; o prompt de coaching entrou no passo 3b.)

### Tarefa 5: documentos (resposta 11 do dono)

- [ ] `CLAUDE.md:162`: a linha
  `- AB_AUTO_APPLY_WINNER: default off; vencedor de A/B é só sugerido, espera confirmação humana.`
  é trocada por
  `- A/B Lab: o cron não declara nem aplica vencedor (desde 10/2026); escolher o que fica no ar é decisão humana. Não religar avaliação automática sem métrica de entrega real.`
  O arquivo tem de continuar com 200 linhas ou menos (`wc -l CLAUDE.md`).
- [ ] `docs/ops/env-vars.md:12`: sai a linha inteira da variável.
- [ ] `docs/ops/runbook-promocao-next16.md:97`: sai o nome da variável e a frase passa ao singular
  (resta `YT_ANALYTICS_SYNC_WINDOW_DAYS`).
- [ ] `grep -rn "AB_AUTO_APPLY_WINNER\|isAutoApplyEnabled\|phaseRetryFailedApplies\|phaseDetectPlayoffEligibility" apps/web/src CLAUDE.md docs/ops`
  sem saída (aceite 7). (emenda 1: G-P2-sugestão) E `grep -rln "AB_AUTO_APPLY_WINNER" apps/web/test` → só
  `test/youtube/ab-evaluate-phases.test.ts` (o caso da flag; `docs/superpowers/plans/*` e `specs/*` são
  história e não se editam).
- [ ] Commit: `docs: AB_AUTO_APPLY_WINNER sai do CLAUDE.md e de docs/ops; no lugar, a regra de que o A/B não declara nem aplica vencedor (A/B Lab P2, Tarefa 5)`.

### Tarefa 6: prova local, capturas e revisão de tela

- [ ] `npx tsc --noEmit` do web e da api; suíte inteira em background com saída em arquivo; `npm run build:web`
  com saída em arquivo (emenda 2: S2-2: ele lê `apps/web/.env.production.local`, não o `.env.development.local`; seção 1). Só as falhas entram no contexto.
- [ ] **Gio (`gio-qa`, Sonnet, `medium`):** antes (em `origin/staging` já com P1) e depois, a 1440 px e
  a 390 px, de: detalhe de um teste ativo, detalhe de um teste encerrado, gaveta de configurações, passo
  "configurar" e passo "revisar" do wizard. Em
  `docs/superpowers/mockups/2026-10-13-ab-lab-p2-retirada/shots/`. Veredito em texto, tela por tela: o que
  saiu, o que ficou órfão (rótulo sem controle, coluna vazia, espaço morto).
  **Semente local (emenda 1: G-P2-semente).** Banco **54321/54322** (o web só conversa com esse; o
  `bythiago_int` é dos testes de integração e **não** serve ao navegador), com linhas **marcadas e
  removíveis**: uuids fixos prefixados (`…a1b0…`), site `localhost`, e vídeos, canal e testes
  **exclusivos do Gio** (para não esbarrar no índice `ab_tests_one_active_per_video` nem nas telas da A5).
  Modelo de colunas: `test/integration/ab-tests-title-desc.test.ts` e a migration
  `20260517000001_ab_testing.sql`.
  - **Teste ativo** (um vídeo): `status='active'`, `started_at = now() - interval '4 days'`, `config` =
    `AB_TEST_CONFIG_DEFAULTS` **+ `auto_apply_winner: true`** (o "antes" mostra os controles; o "depois"
    prova a configuração antiga), `original_thumbnail_url` **sem** `blob.vercel-storage.com`. Duas
    variantes (`is_original` true/false, `blob_url` de imagem local ou data URL). 3 ciclos por variante em
    `ab_test_cycles` com `impressions` (views) 1.200–2.500 e `clicks = 0`, `ctr = 0` (fiel ao que o produto
    grava), um ciclo aberto (`ended_at is null`), um com `backfill_status='confirmed'`.
  - **Teste encerrado** (outro vídeo): `status='completed'`, `completed_at`, `completed_reason='manual_winner'`,
    `winner_variant_id` preenchido, `confidence_at_completion=0.9700`, `result_metadata =
    '{"ctr_lift_percent": 12.5}'`, ciclos fechados. O "antes" mostra os números que P2 retira; o "depois"
    mostra a frase. Um segundo encerrado com `confidence_at_completion = null` (D-P2-5: não pode mostrar "0%").
  - **Duração máxima: NÃO no 54321.** A prova do cron é o teste de integração do passo 8b da Tarefa 1,
    no `bythiago_int`. **Nunca** `curl` na rota `/api/cron/ab-evaluate` do servidor local: ele tem
    credenciais reais de YouTube/Blob carregadas (se o original apontasse para o Blob, haveria tentativa
    real de escrita).
  - **Portas e cookie:** 3998 = "antes" (árvore de `origin/staging` já com a P1) e 3999 = "depois" (a
    árvore da P2), ambas no 54321; a 3997 é de outro terminal. Cookie não isola por porta: **contexto
    Playwright novo por captura**, com `storageState` próprio, nunca o navegador do dono. As variáveis do
    servidor vêm de `apps/web/.env.development.local` (a árvore **não** tem `.env.local`; seção 1), com
    `AWS_SES_ACCESS_KEY_ID=LOCALDUMMY AWS_SES_SECRET_ACCESS_KEY=localdummy NTFY_URL=http://127.0.0.1:9`.
    Guarde o PID de cada processo iniciado e encerre só esses.
  - **Não clicar:** sincronizar, upload, conectar conta, aplicar vencedor. "Aplicar/cancelar carência"
    escrevem no banco local: só em teste explícito, com a linha semeada.
  - **Leitura por script, não por olho:** o texto de cada tela e a contagem de `role=switch` e
    `role=slider` (3 e 1 no antes, 0 no depois). Dois temas, 1440 e 390, animação desligada, relógio fixo
    (`page.clock`). Ao fim: apagar por id (ciclos, variantes, testes, vídeos, canal) e confirmar contagem
    zero; **apagar `apps/web/.env.development.local` e `apps/web/.env.production.local`**.
  - Em **Opera** o `color-mix()` renderiza transparente: a frase fixa tem de ter contraste legível
    (roteiro ao dono), não só estar presente.
- [ ] **Logan e Naksu (Sonnet, `medium`), em paralelo, uma passada:** a frase "Sem medição de entrega
  por enquanto" no lugar de cada bloco comunica o que falta, sem parecer erro? O wizard sem os três
  controles ainda tem um passo "configurar" que vale a tela? E o **resultado** da Tarefa 3b (painel de
  critérios e médias trocados pela frase fixa; o cartão de vitória mantido): lê como tela quebrada, sobretudo
  a 3b-2 com a frase repetida no mesmo detalhe? (emenda 2: H2-3b: eles julgam o resultado, não se a 3b entra.)
- [ ] Capturas ao dono, uma linha por tela.

### Tarefa 7: envio

Igual à Tarefa 7 do plano da P1: revisão do lote por **Phil e Yannis** (Opus, `medium`) sobre o `diff`;
as três conferências da regra 1 (emenda 1: G-P2-B2) — ~~vazias por construção: sem migration, sem teste
de integração mudado~~ **(i) sem migration; (ii) e (iii) rodadas e anotadas**: a P2 acrescenta um arquivo
de integração (`test/integration/ab-evaluate-duracao-maxima.test.ts`, Tarefa 1, passo 8b), gated por
`HAS_LOCAL_DB`, que usa só tabelas e colunas que já estão em `supabase/migrations/` de `origin/staging`;
rodar `HAS_LOCAL_DB=1 npx vitest run test/integration/ab-evaluate-duracao-maxima.test.ts` contra o
`bythiago_int` e colar a saída no ledger;
`bash scripts/check-type-debt.sh` (seção 1); junção com `origin/staging` na árvore se o remoto andou;
`bash -c 'git push origin lote/ab-p2:staging'`; CI; promoção; o aviso da seção 1 entregue ao controlador
da A5.

**Junção de volta ao `staging` local** (emenda 1: S-C6), antes e depois do `git merge origin/staging`,
com o outro terminal avisado (nunca `stash`):

```bash
git diff --name-only HEAD -- $(git diff --name-only origin/staging~N origin/staging) | wc -l   # N = commits do lote; tem de dar 0, senão espere o outro terminal commitar
grep -rnE "pTop2|AB_AUTO_APPLY_WINNER|isAutoApplyEnabled|phaseRetryFailedApplies|phaseDetectPlayoffEligibility" apps/web/src | grep -v database.types   # sem saída
cd apps/web && npx vitest run test/youtube/ab-evaluate-phases.test.ts test/mcp test/lib/pipeline > /tmp/ab-p2-juncao.log 2>&1
```

Linha a mais no aviso à A5: os commits locais que tocam arquivos do lote conflitam no `cherry-pick` sobre
`origin/staging`; a resolução certa é a do commit de junção `<hash>`.

### Tarefa 8: produção

Só select, por `npx supabase db query --linked --agent=yes -o json`, com autorização do dono na sessão.
(emenda 1: D-P2-6, G-P2-C5, redação fechada do Gio para P2-P1 a P2-P4)

- [ ] **C1, ANTES do envio (portão), repetida na manhã do dia do deploy, não dias antes.** Cole a saída
  no ledger **antes do envio**; sem a saída colada o critério P2-P4 fica **"não verificado" e o envio não
  sai** (também quando o classificador negar a leitura: nesse caso o dono roda o select).
  ```sql
  select id, status, test_type, round_number, parent_test_id, playoff_start_after, started_at,
         coalesce(started_at, created_at)
           + make_interval(days => coalesce((config->>'max_duration_days')::int, 14)) as vence_em,
         grace_expires_at, winner_variant_id, winner_applied_at, applied_by, completed_reason,
         confidence_at_completion, consecutive_confident_evals,
         result_metadata->>'ctr_lift_percent' as lift, config->>'auto_apply_winner' as auto_apply
    from ab_tests order by created_at;
  ```
  Esperado: nenhum `active`, `queued` ou `paused` (`queued` vira `active` sozinho pelo `ab-rotate`;
  `paused` volta por um clique); nenhum `draft` com `round_number = 2` e `playoff_start_after` preenchido
  (`phaseAutoStartPlayoffs` o inicia e escreve no YouTube); nenhum `grace_expires_at` preenchido.
  **Qualquer um desses: pare e leve ao dono**, com a coluna `vence_em` (o dia em que o cron o encerra).
  Depois de P2 um `active` encerra como `inconclusive` no primeiro disparo depois da duração máxima.
  Os nomes `round_number`, `playoff_start_after` e `applied_by` existem em `ab_tests`
  (`20260529000001_playoff_mode.sql`, `20260531000005_ab_tests_grace_and_queue.sql`; conferido).
  Mais a contagem de vitória automática (D-P2-3):
  ```sql
  select completed_reason, count(*) filter (where winner_variant_id is not null) as com_vencedor, count(*)
    from ab_tests where status = 'completed' group by 1 order by 1;
  ```
  `auto_resolve` com `com_vencedor = 0`: registrar e seguir. `com_vencedor >= 1`: registrar quantos; a
  Tarefa 4 já os tira da conta (vitória só humana), e a tela os mostrará sem vencedor contado.
  (emenda 2: D2-2) **Anote no ledger** as linhas `manual_apply`, `manual_no_apply` e `completed_reason` nulo com `com_vencedor >= 1`. `manual_no_apply` e nulo **não contam** como vitória; `manual_apply` conta e vai dito ao dono com a frase da E10 ("a máquina sugeriu, a pessoa aplicou": número fixo, nenhuma linha nova nasce assim depois da P2).
- [ ] **C2, depois do deploy, na execução do cron de 12:00 UTC posterior ao deploy:** `/api/health` sem
  falha do `ab-evaluate`. ~~"A resposta do cron (log da Vercel) tem as seis chaves novas"~~: o corpo da
  resposta do cron não fica no log da Vercel; as seis chaves estão provadas pelo teste da Tarefa 1,
  passo 7. **Falso verde:** execução anterior ao deploy lida como posterior; anote o horário do log e o do
  deploy lado a lado. Com zero teste ativo, a C2 prova "o deploy não quebrou o cron", **não** que "o ramo
  único funciona" (essa prova é o teste de integração do passo 8b).
- [ ] **C3, paridade.** Escolha o teste por:
  ```sql
  select test_id, count(*) as ciclos, sum(impressions) as soma_no_banco
    from ab_test_cycles where impressions is not null group by 1 order by 2 desc limit 3;
  ```
  Para esse `test_id` (soma no banco > 0), salve as respostas (REST
  `GET /api/pipeline/youtube/ab-tests/<id>/funnel`; ação MCP `manage_ab_test` `get_funnel` no Claude Code; a do **Cowork é do dono**, pelo texto colado da seção 2, item 4; emenda 2: H2-Cowork) e afirme: mesmo conjunto de chaves; `per_variant[].impressions === null`;
  `per_variant[].clicks === null`; `aviso === 'sem métrica de entrega'`; `link_clicks` número. Mais
  `GET .../ab-tests/dashboard` (`avgConfidence: null`, `avgLift: null`, `winRate` número ou `null`).
  **Falso verde:** teste sem ciclo (nada para anular). Se a consulta não devolver linha, a C3 não é
  provável em produção: **declare "não verificado"**; a prova fica no teste da Tarefa 4 e na captura local.
- [ ] **C4:** o dono abre um teste **encerrado** em `/cms/youtube/ab-lab` (recarga forçada, Opera): a
  frase "Sem medição de entrega por enquanto" no lugar de watch time, comentários, compartilhamentos, top 2
  e receita; nenhum radar. E as configurações e o passo "configurar" do wizard: nenhum "Aplicar vencedor
  automaticamente", "Playoff automático" nem slider de confiança. **Falso verde:** o teste encerrado de
  produção nunca teve esses números preenchidos, então "não vê" é trivial; a prova de tela é a captura
  local com semente cheia (Tarefa 6). O dono confere só que a frase aparece, com contraste legível, e que
  os controles sumiram (aceite P2-P1).
- [ ] **C5, roteiro herdado pela P4** (não portão da P2), conferência com data do primeiro teste real (a única prova do ramo único com dado real; o
  dono roda teste "em algumas semanas"). No dia seguinte ao `vence_em` do primeiro teste novo, depois das
  12:10 UTC:
  ```sql
  select id, status, completed_reason, completed_at, winner_variant_id, grace_expires_at, confidence_at_completion, status_note
    from ab_tests where id = '<id do teste>';
  select count(*) from ab_test_cycles where test_id = '<id do teste>' and ended_at is null;
  ```
  Esperado: `completed`, `inconclusive`, `winner_variant_id`, `grace_expires_at` e `confidence_at_completion`
  nulos, **`status_note` sem o prefixo `duração máxima:`** (nulo, ou uma nota antiga do `ab-rotate`, do tipo `retry n/3: …`, que o encerramento não apaga de propósito; emenda 2: D2-3) e zero ciclo aberto. `status_note` que **começa com** `duração máxima: original não restaurado` = a restauração falhou e a variante pode estar no ar: confira a thumbnail do
  vídeo e leve ao dono (a garantia é da P4). **(emenda 2: H2-P5) A C5 deixa de ser conferência da P2: é roteiro herdado pela P4**, porque o primeiro teste real já roda sob `settleOnAir`.

---

## 6. Aceite

| # | Critério | Onde se prova |
|---|---|---|
| 6 | `ab-evaluate` com métricas zeradas não cria vencedor, carência nem playoff; na duração máxima encerra `inconclusive` sem vencedor nem carência; a flag `AB_AUTO_APPLY_WINNER` não faz nada (teste que falha na base) | Tarefa 1, passos 1, 2, 7 e 8b (emenda 1: S-C9, G-P2-B1, G-P2-B2) |
| 7 | O `grep` do spec não encontra nada em `apps/web/src`, `CLAUDE.md` e `docs/ops`; em `apps/web/test` só o caso da flag | Tarefa 5 |
| 8 | Configuração antiga com `auto_apply_winner` continua válida e a chave é ignorada | Tarefa 2, passo 1 |
| 9a | Os quatro números de 4.2.1 não aparecem; a frase fixa aparece | Tarefa 3, passo 1 |
| 9b | Funil e painel do pipeline devolvem `null` com o aviso; paridade REST × MCP provada por teste | Tarefa 4, passo 1 |
| 9c (emenda 2: H2-3b) | **Se a 3b entrar:** o detalhe do teste ativo não mostra o painel de critérios, "0 / 3" nem "probabilidade de ser a melhor"; o painel do CMS não mostra confiança média nem lift médio; a taxa de vitória mostra o mesmo valor que o pipeline entrega, ou a frase quando ele é `null` | Tarefa 3b, passo 1; captura local (Tarefa 6) |
| P2-P1 | Produção: teste encerrado mostra a frase fixa no lugar dos números; as configurações e o passo "configurar" não têm "Aplicar vencedor automaticamente", "Playoff automático" nem slider de confiança. (emenda 2: H2-3b) O dono abre `/cms/youtube/ab-lab` e vê a frase no lugar de confiança média e lift médio; o detalhe do teste ativo **não é conferível em produção** (zero teste ativo): vale a captura local com semente. A prova de tela é a captura local com semente cheia (o teste de produção nunca teve esses números) | dono; Tarefa 8, C4; Tarefa 6 |
| P2-P2 | Produção: a execução de 12:00 UTC posterior ao deploy termina sem falha no `/api/health` (prova "não quebrou ao subir", não a lógica; a lógica é o teste de integração) | Tarefa 8, C2 |
| P2-P3 | Paridade: mesmo conjunto de chaves, `null` e `aviso` pelo REST e pelo MCP (Claude Code pelo agente; **Cowork pelo dono**, com o texto da seção 2), com teste que tenha ciclos; sem teste assim em produção: "não verificado" e vale a prova local | Tarefa 8, C3; Tarefa 4, passo 1 |
| P2-P4 | Nenhum teste `active`, `queued`, `paused`, rascunho de rodada 2 nem carência em produção no dia do envio, ou o dono decidiu o que fazer com ele. **Sem a saída da C1 colada no ledger antes do envio: "não verificado", e o envio não sai** | Tarefa 8, C1 |
| ~~P2-P5~~ | (emenda 2: H2-P5) **Sai da P2 e vai para a P4** (o primeiro teste real já roda sob `settleOnAir`). Era: o primeiro teste real encerrado pelo cron, `completed`/`inconclusive`, sem vencedor, zero ciclo aberto, `status_note` nulo | roteiro herdado pela P4 (C5) |

## 7. O que acontece quando o dado não existe, e em cada falha

| Situação | Depois de P2 |
|---|---|
| Nenhum teste ativo | o cron responde `evaluated: 0`, verde. É o estado de produção |
| A leitura de `ab_tests` falha | `errors: 1`, `recordCronFailure`. Antes: verde com zero |
| Teste ativo com `started_at` nulo | usa `created_at` (como hoje) |
| Teste ativo sem `max_duration_days` na configuração | 14 dias (como hoje) |
| A restauração da thumbnail falha (token, canal não identificado, Blob fora), em teste de thumbnail ou combo que foi ao ar | (emenda 1: S-C7) Sentry, o teste **encerra** (manter `active` faria o `ab-rotate` das 08:00 UTC continuar trocando variante num teste vencido e gastaria `thumbnails.set` todo dia), grava `status_note` "duração máxima: original não restaurado (falhou)" e o cron conta `errors++` (fica vermelho nesse dia). A variante pode ficar no ar; a garantia é da P4 |
| O original não está no Blob, em teste de thumbnail ou combo que foi ao ar | nada é restaurado; encerra com `status_note` "(sem_original_no_blob)" e `errors++` (emenda 1: S-C7). **Falso alarme declarado** (emenda 2: D2-dec3): o original é uma variante da rotação (`is_original`); se no instante do encerramento era ele que estava no ar, o cron fica vermelho e a nota diz "original não restaurado" sem haver variante no ar. Alcance pequeno: teste novo só tem original fora do Blob se a URL do YouTube não for `ytimg/ggpht/googleusercontent` (`actions.ts:217-224`). Prefere-se o alarme a mais ao silêncio; a P4 (`settleOnAir`) resolve lendo o ciclo aberto |
| Teste `active` sem ciclo porque a inserção do ciclo 0 falhou no início (`startAbTestInternal` põe a thumbnail no YouTube, marca `active` e só depois insere o ciclo) | (emenda 2: S2-declaração) encerra sem restaurar e sem `status_note`; se a primeira variante não era a original, ela fica no ar. Raro (o banco falha entre duas escritas seguidas); P4 |
| Teste de título ou descrição, ou de thumbnail que nunca foi ao ar (nenhum ciclo) | não toca o YouTube; encerra sem `status_note` e sem erro (emenda 1: G-P2-C2) |
| O dono ou outro processo encerrou, pausou ou decidiu o teste no meio da execução | a releitura antes da restauração e o `update ... eq('status','active')` impedem o cron de desfazer a decisão; zero linha não conta como resolvido nem como erro (emenda 1: D-P2-1). Janela residual: entre a releitura e o `update` ainda passam segundos |
| Teste `paused` além da duração máxima | a fase só lê `active`: nunca encerra. Igual a hoje; P4 (emenda 1: D-P2-S3, S-D5) |
| Fechar ciclos ou encerrar o teste falha no banco | `errors++` e o teste continua `active`, sem ciclo aberto (se foi o `update` de `ab_tests` que falhou). ~~O cron tenta de novo no dia seguinte~~ (emenda 1: D-P2-7) O `ab-rotate` das 08:00 UTC pega todo `active` (`ab-rotate-phases.ts:65`), conta os ciclos fechados e **põe a próxima variante no ar** (`:147-156`); só às 12:00 o cron restaura de novo. Resultado: até quatro horas de uma variante no ar depois da duração máxima, um ciclo a mais gravado, e a coleta própria atribui esse trecho do dia à variante. Não é regressão (hoje é igual); o conserto de verdade é o `settleOnAir` da P4 |
| Teste em carência no momento do deploy (`grace_expires_at` preenchido) | ninguém mais aplica nem cancela; fica como está até a duração máxima, e o dono ainda tem "aplicar agora" e "cancelar" na tela. Ao encerrar por duração máxima, o cron **limpa** `winner_variant_id` e `grace_expires_at` (emenda 1: S-C8). **Produção tem zero** (C1 confere) |
| Rascunho de rodada 2 já criado | `phaseAutoStartPlayoffs` ainda o inicia (zero hoje). Nenhum playoff novo nasce |
| Pipeline sem nenhum teste concluído, ou leitura do banco que falha | sem teste: resposta com `aviso` (também nos retornos antecipados) e `winRate: null`; leitura que falha: `DB_ERROR` 500, nunca zero com `aviso` (emenda 1: D-P2-4, D-P2-9) |
| Cowork soma `impressions` do funil | recebe `null`; quem somava passa a ver `null`/erro de tipo no lado dele, não zero. O `aviso` e o doc dizem por quê |
| Configuração antiga com as chaves mortas | aceita, ignorada, não reescrita |
| `git revert` de P2 | volta tudo; nada no banco mudou. Teste que P2 encerrou por duração máxima continua encerrado |

## 8. Riscos que ficam, sem suavizar

- ~~**A restauração que falha continua silenciosa** (vai só ao Sentry).~~ (emenda 1: S-C7) **A restauração
  continua sem garantia**, mas deixou de ser silenciosa (`status_note` + `errors++`). Quando falha, os
  ciclos dizem "nada no ar" e a variante continua no vídeo; a coleta própria deixa de atribuir os dias à
  variante (D-P2-S2). **P4 tem de estar em produção antes do primeiro teste novo** (o dono disse que roda
  teste "em algumas semanas"); se ela atrasar, a C1 da Tarefa 8 vira portão de todo envio **que toque o A/B Lab** até a P4 (emenda 2: H2-H10; não é portão dos envios da A5).
- **Um teste antigo com critérios verdes que estava preso em `active`** (o defeito do `!allPass`) será
  encerrado no primeiro disparo. É o certo, mas é mudança visível: C1 mostra antes se existe algum.
- **O Cowork recebe `null` onde recebia número.** Prompt ou rotina dele que faça conta com esses campos
  quebra do lado dele. É o efeito pedido (resposta 7), e o `aviso` explica.
- **A tela ainda mostra critérios e probabilidade calculados sobre views, e o painel do CMS mostra médias
  que o pipeline anula**, se a Tarefa 3b não entrar (o dono disser não à pergunta 13, ou a 3b-2 for cortada) (sobra declarada, seção 3). Nesse caso a etapa de
  telas tem de estar em produção antes do primeiro teste novo, junto da P4 (emenda 1: D-P2-8).
- **Dívidas declaradas** (emenda 1: Yannis): **D2** `phaseAutoStartPlayoffs` ignora `error` da leitura e
  `result.ok === false` (rodada 2 que não inicia sai em verde; pagar junto da P4 ou quando nascer o
  primeiro rascunho de rodada 2). **D3 (E5)** `ab-playoff.ts` e a função SQL `create_playoff_test` ficam
  sem chamador: código morto que parece vivo; apagar se a etapa de telas decidir que playoff não volta.
  **D5** teste `paused` nunca passa pela duração máxima (P4). **Janela residual** da corrida cron ×
  decisão manual: entre a releitura e o `update` com `status = 'active'`.
- **A Tarefa 3 é larga** (o campo `pTop2` atravessa cinco componentes e oito arquivos de teste). É a
  candidata a corte se o lote ficar grande: sem ela, os números fabricados ficam até a etapa de telas. (emenda 2: H2-3b) Das fatias da 3b, a 3b-2 sai primeiro.
- **Trechos de teste são moldes**, escritos sem ler os arquivos de teste; os nomes dos auxiliares têm de
  ser trocados pelos que existem. O que não muda é a lista de afirmações.
- **Linhas de `cowork-docs-youtube.md` e de `services/youtube.ts` deslocam depois de P1.** O plano dá
  âncoras de texto; quem executa reconfere.

## 9. Perguntas abertas para a revisão

(emenda 2: H2-perguntas) As perguntas da Hanna (inclusive "a 3b entra?" e "um envio ou dois?") foram respondidas e viraram decisão no corpo: um envio só, 3b recomendada, P2-P5 fora (seções 1, 2 e 6). Sobram só:

1. **Logan e Naksu (na Tarefa 6):** a frase fixa "Sem medição de entrega por enquanto" no lugar de cada bloco comunica o que falta sem parecer erro? E o resultado da Tarefa 3b (critérios e médias trocados pela frase, cartão de vitória mantido) lê como tela quebrada?
2. **Ao dono (seção 2):** a 13 (a 3b entra, sem mockup) e a 14 (há data para o primeiro teste A/B?).
