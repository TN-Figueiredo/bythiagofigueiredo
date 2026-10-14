# A/B Lab honesto, P2: avaliação automática desligada (plano de implementação)

Escrito em 13/10/2026 (noite). Primeira versão, **ainda sem o portão de Phil, Yannis, Gio e Hanna**.
Spec: `docs/superpowers/specs/2026-10-07-ab-lab-honesto-design.md` (v6: seções 4.1 e 4.2.1, bloco P2 da
seção 1, aceite 6 a 9, emendas 23, 24 e 26, e "Respostas do dono (13/10/2026)" no fim). Inventário de
código, lido em 13/10 no HEAD `bc5adea94`: `.superpowers/sdd/ab-lab/inventario-p2.md` (toda linha citada
aqui vem dele; **quem executa reconfere por `grep` no dia**). Plano irmão, que vai antes:
`2026-10-13-ab-lab-p1-fadiga-e-video-em-alta-saem-plan.md` (chamado aqui de "plano da P1").

> **Para quem executa:** use `superpowers:subagent-driven-development`, tarefa por tarefa. Passos com
> caixa (`- [ ]`). Sonnet, effort `medium`. A Tarefa 1 (o cron que decide encerrar teste) é a única
> candidata a revisão de tarefa em `high`; o controlador decide no dia.

**Objetivo, em uma frase.** O cron `ab-evaluate` para de declarar vencedor, abrir carência, criar
playoff e aplicar qualquer coisa a partir de "impressões" que são views e cliques que são sempre zero; a
tela e o pipeline param de mostrar os números que saíam disso.

**Como.** O cron fica com um ramo só: teste ativo que passou da duração máxima volta ao original (com a
restauração que existe hoje) e encerra como `inconclusive`. Saem duas fases inteiras, a variável
`AB_AUTO_APPLY_WINNER`, as configurações que ficaram sem efeito, os números fabricados da tela (resposta
10 do dono) e, no pipeline, os campos de entrega passam a `null` com `aviso` (resposta 7).

**Stack.** Next.js 16, TypeScript estrito, Vitest, zod 3.24. **Nenhuma migration.**

## Fica FORA deste plano

- `settleOnAir` e tudo de P4: a restauração da duração máxima continua a de hoje (só thumbnail, só se o
  original está no Blob, sem garantia). **O defeito conhecido fica:** se a restauração falha, o erro vai
  ao Sentry e o teste encerra assim mesmo, com a variante no ar. P4 conserta. Ver riscos.
- A descrição (P3). As duas fases apagadas são as que citam descrição; a P3 não precisa mais editá-las.
- Tela nova de qualquer tipo, o acompanhamento novo e as views por variante (etapa de telas).
- O painel de critérios ("gates") e a confiança bayesiana **na tela**: continuam, calculados sobre o
  mesmo dado. O spec só tira os quatro números de 4.2.1; o resto é da etapa de telas. Ver "Sobra
  declarada".
- `ab-backfill`: continua gravando views como `impressions` nos ciclos (spec 4.1). P2 muda só o que o
  pipeline **entrega**.
- `applyWinnerNow`, `cancelGracePeriod` e `revertWinner` (`ab-lab/actions.ts`): ficam; apagar os dois
  primeiros é a pergunta 6 do spec, que vai com a v7 e a P4.
- A função SQL `create_playoff_test`: fica no banco, sem chamador (a Migration B da P3 a recria).
- Impressão real por variante no pipeline: é da medição nova (parecer da Hanna, 3.4).

## Restrições globais

- **Escolher o que fica no ar é decisão humana.** Depois de P2 nenhum caminho automático grava
  `winner_variant_id`, `grace_expires_at`, `winner_applied_at`, `applied_by: 'auto'` nem
  `completed_reason: 'auto_resolve'`, e nenhum chama `applyVariantToYouTube`.
- **Falha em verde.** No pipeline, campo sem medição é `null` com `aviso`, nunca `0`. No cron, leitura
  ou gravação que falha conta como erro do cron (hoje a leitura de `ab_tests` que falha devolve
  "0 avaliados" em verde).
- **Paridade Cowork × Claude Code:** REST, ação MCP e recurso MCP do mesmo dado mudam no mesmo commit
  (Tarefa 4), com o doc.
- **Configuração antiga continua válida.** `auto_apply_winner` e `default_auto_apply` gravados em
  `ab_tests.config` e nas configurações do site são aceitos e ignorados; nada no banco é reescrito.
- TypeScript sem `any`; texto novo em pt-BR; commits `tipo: descrição`.
- **Árvore e envio:** seção 1. Nunca `git stash`, `git reset`, `pkill`, nem push do `staging` local.
- Suíte e build com saída em arquivo; nenhum comando acima de 4 min em primeiro plano.

## Foco de revisão (o que o spec implica e nenhum teste de hoje exercita)

1. **Teste com os critérios todos verdes e duração máxima vencida.** Hoje a condição tem `!allPass`:
   com a aplicação automática desligada (o padrão de produção) esse teste **nunca encerra**. Depois de
   P2 encerra como `inconclusive`. Teste na Tarefa 1.
2. **Teste com menos de duas variantes com "impressões" e duração vencida** (o ramo F17 de hoje, que
   encerra sem restaurar). Passa pelo mesmo ramo único e tenta restaurar. Teste na Tarefa 1.
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
| Único gravador de `ctr_lift_percent` | `ab-evaluate-phases.ts:338`, no caminho da flag ligada | inventário, 3d |
| Chamadores de `isAutoApplyEnabled` | um: `ab-evaluate-phases.ts:237` | inventário |
| `AB_AUTO_APPLY_WINNER` fora do código | `CLAUDE.md:162`, `docs/ops/env-vars.md:12`, `docs/ops/runbook-promocao-next16.md:97` | inventário, 3g |
| Todo teste novo grava `auto_apply_winner: true` | `AB_TEST_CONFIG_DEFAULTS` (`ab-types.ts:22`) espalhado em `ab-lab/actions.ts:167` | inventário, 3e |
| Eixos fabricados no radar | três (`watchTime`, `comments`, `shares`), e `retention` nunca é preenchido pelo servidor | inventário, 3c |
| Arquivos do escopo com mudança não commitada | nenhum | inventário, seção 4 |
| Plano da A5 que edita arquivo do escopo | E7: `cowork-docs-youtube.md`, `mcp/tools.ts`, `mcp/prompts.ts`, outros trechos; ainda sem código | inventário, seção 4 |

**Não medido (ninguém leu produção):** se existe teste `active` hoje (o spec diz zero em 09/10); se
alguma linha de `ab_tests` tem `result_metadata.ctr_lift_percent` ou `confidence_at_completion`
preenchidos. A Tarefa 8 confere, por select, **antes** do envio.

## 1. Onde se trabalha e como se envia

Igual ao plano da P1 (seção 1 de lá), com o que Yannis decidir na revisão. **P2 nasce depois de P1 estar
em `origin/staging`:**

```bash
git fetch origin
git worktree add ../bythiago-ab-p2 -b lote/ab-p2 origin/staging
```

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
| `:117-137` (duração máxima sem duas variantes, "nada") | **fundido** no ramo único: passa a tentar restaurar a thumbnail. A E18 reclassifica a linha |
| `auto_resolve` como `completed_reason` | o tipo e o CHECK ficam (histórico); só deixa de nascer |

## 2. O que é do dono

1. As capturas de antes e depois (Tarefa 6) e o "pode".
2. Depois do deploy: apagar `AB_AUTO_APPLY_WINNER` das variáveis da Vercel, **se existir lá** (o código
   já não lê; é limpeza). O agente não mexe em variável da Vercel.
3. Abrir em produção um teste encerrado e as configurações do A/B Lab (aceite P2-P1).

Já respondido por ele em 13/10: perguntas 7, 10 e 11 (sim às três).

## 3. Decisões que o spec não toma (recomendação do controlador; a revisão cobra)

| # | Decisão | Recomendação | Alternativa e custo |
|---|---|---|---|
| E1 | O ramo F17 funde com o ramo único? | **Sim.** Um caminho só para "passou da duração máxima": tenta restaurar, fecha ciclos, encerra | Manter os dois: dois caminhos com a mesma causa e efeitos diferentes; a P4 teria de trocar os dois por `settleOnAir` |
| E2 | `confidence_at_completion` na duração máxima | **`null`.** O número viria de `calculateBayesianConfidence` sobre views; a regra do dono é "confiança só aparece quando existe" | Continuar gravando: o pipeline (Tarefa 4) entregaria `null` de qualquer jeito, e a tela mostraria um número sem lastro |
| E3 | `consecutive_confident_evals` | **Deixa de ser gravado.** O contador fica congelado no valor de hoje | Continuar calculando: mantém Bayes e critérios dentro do cron só para alimentar um painel que a etapa de telas vai refazer |
| E4 | Erros de banco dentro do ramo | **Conferir `error` e lançar**, para o `catch` contar o erro e o cron reprovar | Deixar como está: gravação que falha sai em verde |
| E5 | `ab-playoff.ts` (`checkPlayoffEligibility`, `selectPlayoffVariants`) | **Fica**, como função pura sem chamador na rota, igual a `ab-statistics.ts` e `ab-gates.ts`; o teste dele fica | Apagar: mais 2 arquivos; nada quebra |
| E6 | O radar "Raio-X das variantes" | **Sai o bloco inteiro** de `active-detail.tsx`, com a frase fixa no lugar. Dos seis eixos, três são fabricados, `retention` nunca é preenchido e `pTop2` é fabricado: sobraria um radar de dois eixos | Tirar só três eixos: gráfico sem sentido |
| E7 | `pTop2` | **Sai do tipo `RankedVariant`** e de todo lugar que o mostra ou ordena por ele; onde ordenava, ordena por `pBest` | Manter o campo e esconder: o número fabricado continua no objeto e volta numa tela futura |
| E8 | Os dois sliders de confiança (`settings-drawer.tsx:195-207`, `step-config.tsx:62-72`) | **Saem** (o spec manda sumir "limiar de confiança e estabilidade"). Os valores gravados continuam sendo lidos pelo painel de critérios | Manter: controle que não decide mais nada |
| E9 | O banner de carência (`active-detail.tsx:133-190`) | **Sai só a frase** "O vencedor será aplicado automaticamente…" (`:142`). O banner só aparece com `grace_expires_at` preenchido, que deixa de ter gravador; apagá-lo é a pergunta 6 (P4) | Apagar o banner agora: antecipa uma pergunta que o dono ainda não respondeu |
| E10 | `winRate` do painel do pipeline | **Fica.** Vencedor escolhido à mão é decisão real | Anular: perde dado verdadeiro |

**Sobra declarada (para a Hanna e o Logan dizerem se aceitam):** depois de P2 a tela do teste ativo
ainda mostra o painel de critérios e a "probabilidade de ser a melhor" calculados sobre views, com um
limiar que ninguém mais edita. O spec deixa isso para a etapa de telas. Se a revisão achar que é mentir
na tela, a saída barata é a mesma frase fixa no lugar do painel, e isso vira tarefa 3b deste plano.

## 4. Arquivos, por tarefa

Caminhos relativos a `apps/web/`; `AB/` = `src/app/cms/(authed)/youtube/ab-lab/`.

| Tarefa | Arquivos |
|---|---|
| 1 cron | `src/lib/youtube/ab-evaluate-phases.ts`, `src/app/api/cron/ab-evaluate/route.ts`, `src/lib/youtube/ab-apply.ts`; `test/ab-cron-evaluate.test.ts`, `test/api/cron/ab-evaluate.test.ts`, `test/youtube/ab-evaluate-phases.test.ts` |
| 2 configurações | `src/lib/youtube/{ab-types.ts,ab-schemas.ts,ab-wizard-adapter.ts}`, `AB/_components/{settings-drawer,step-config,step-revisar,live-monitor,active-detail}.tsx`; `test/ab-config.test.ts`, `test/ab-settings-drawer.test.tsx`, `test/{cms,youtube}/ab-step-config.test.tsx`, `test/cms/ab-step-revisar.test.tsx`, `test/{cms,youtube}/ab-wizard-reducer.test.tsx`, `test/youtube/{ab-wizard-adapters.test.ts,ab-wizard-components.test.tsx,ab-high.test.ts}`, `test/ab-actions-create.test.ts` |
| 3 números fabricados | `AB/_components/{active-detail,rank-bars,variant-table,playoff-detail,radar-chart}.tsx`, `AB/queries.ts`, `src/lib/youtube/ab-types.ts`; `test/ab-charts.test.tsx`, `test/ab-chart-math*`, `test/ab-variant-table-title*`, `test/youtube/ab-detail-{active,playoff,winner}*`, `test/youtube/{ab-high,ab-medium}.test.ts`, `AB/**/mock-views.ts` |
| 4 pipeline | `src/lib/pipeline/services/youtube.ts`, `src/lib/youtube/prompt-builders-ab.ts`, `src/lib/pipeline/mcp/tools.ts`, `data/pipeline-docs/cowork-docs-youtube.md`; `test/ab-pipeline-api.test.ts`, `test/api/pipeline/{youtube-ab-tests,youtube-ab-extended,youtube-thumbnails}.test.ts`, `test/mcp/mcp-schema-reads.test.ts`, `test/youtube/prompt-builders-ab.test.ts` |
| 5 documentos | `CLAUDE.md`, `docs/ops/env-vars.md`, `docs/ops/runbook-promocao-next16.md` |

Ordem obrigatória: **1 antes de 2** (a Tarefa 2 tira do tipo a chave que a fase apagada lia). 3, 4 e 5
são independentes. Uma por vez, na mesma árvore.

---

## 5. As tarefas

Em todas: testes **dos arquivos da tarefa** com saída em arquivo
(`cd apps/web && npx vitest run <arquivos> > /tmp/ab-p2-tN.log 2>&1; tail -30 /tmp/ab-p2-tN.log`) e
`npx tsc --noEmit -p apps/web > /tmp/ab-p2-tsc.log 2>&1` antes do commit.

### Tarefa 0: árvore e linha de base

- [ ] Conferir que P1 está em `origin/staging` por conteúdo:
  `git grep -c "fatigue" origin/staging -- apps/web/src/lib/pipeline/api-registry.ts` → sem saída.
- [ ] Criar a árvore (seção 1), `npm ci` e `build:packages` em background com saída em arquivo.
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
  cliente falso que o arquivo já tem; os dois casos F17, linhas 347 e 368, são o molde):

  ```ts
  describe('phaseEvaluateActiveTests: ramo único', () => {
    it('antes da duração máxima não escreve nada, nem no banco nem no YouTube', async () => {
      const { supabase, escritas } = clienteCom([testeAtivo({ diasNoAr: 3, maxDuracao: 14 })])
      const r = await phaseEvaluateActiveTests(supabase)
      expect(r).toEqual({ evaluated: 1, resolved: 0, errors: 0 })
      expect(escritas()).toHaveLength(0)
      expect(setThumbnail).not.toHaveBeenCalled()
      expect(applyVariantToYouTube).not.toHaveBeenCalled()
    })

    it('critérios todos verdes e duração vencida: encerra inconclusive, sem vencedor nem carência', async () => {
      const { supabase, gravadoEm } = clienteCom([testeAtivo({ diasNoAr: 15, maxDuracao: 14, ciclos: ciclosComVencedorClaro() })])
      const r = await phaseEvaluateActiveTests(supabase)
      expect(r).toEqual({ evaluated: 1, resolved: 1, errors: 0 })
      const linha = gravadoEm('ab_tests')
      expect(linha).toMatchObject({ status: 'completed', completed_reason: 'inconclusive', confidence_at_completion: null })
      for (const chave of ['winner_variant_id', 'grace_expires_at', 'winner_applied_at', 'applied_by', 'consecutive_confident_evals', 'result_metadata']) {
        expect(linha).not.toHaveProperty(chave)
      }
      expect(applyVariantToYouTube).not.toHaveBeenCalled()
    })

    it('menos de duas variantes com impressões e duração vencida: mesmo ramo, tenta restaurar a thumbnail do Blob', async () => {
      const { supabase } = clienteCom([testeAtivo({ diasNoAr: 15, maxDuracao: 14, ciclos: [], originalNoBlob: true })])
      await phaseEvaluateActiveTests(supabase)
      expect(setThumbnail).toHaveBeenCalledTimes(1)
    })

    it('original fora do Blob: encerra sem chamar o YouTube', async () => {
      const { supabase } = clienteCom([testeAtivo({ diasNoAr: 15, maxDuracao: 14, originalNoBlob: false })])
      const r = await phaseEvaluateActiveTests(supabase)
      expect(r.resolved).toBe(1)
      expect(setThumbnail).not.toHaveBeenCalled()
    })

    it('a leitura de ab_tests falha: conta erro, não devolve zero em verde', async () => {
      const { supabase } = clienteQueFalhaAoLer('ab_tests')
      const r = await phaseEvaluateActiveTests(supabase)
      expect(r.errors).toBe(1)
    })

    it('a gravação do encerramento falha: conta erro e não conta como resolvido', async () => {
      const { supabase } = clienteCom([testeAtivo({ diasNoAr: 15, maxDuracao: 14 })], { falhaAoGravar: 'ab_tests' })
      const r = await phaseEvaluateActiveTests(supabase)
      expect(r).toMatchObject({ resolved: 0, errors: 1 })
    })
  })
  ```

  `clienteCom`, `testeAtivo`, `ciclosComVencedorClaro`, `clienteQueFalhaAoLer`, `escritas` e `gravadoEm`
  são nomes de molde: troque pelos auxiliares do arquivo, ou crie-os **no próprio arquivo de teste** se
  não existirem.
- [ ] **Passo 2.** Rodar: falham (hoje grava o contador, não encerra com critérios verdes, não restaura
  no F17, ignora erro de leitura).
- [ ] **Passo 3, a fase** (`src/lib/youtube/ab-evaluate-phases.ts`). `phaseEvaluateActiveTests` passa a ser:

  ```ts
  // ─── Fase 2: duração máxima ──────────────────────────────────────────────────
  // Enquanto não houver métrica de entrega real, o cron não declara vencedor, não abre
  // carência, não cria playoff e não aplica nada: `ab_test_cycles.impressions` são views e
  // os cliques são sempre zero. Só sobra o ramo da duração máxima. Escolher o que fica no
  // ar é decisão humana (spec 2026-10-07-ab-lab-honesto, 4.1).

  export async function phaseEvaluateActiveTests(supabase: SupabaseClient): Promise<EvaluateResult> {
    let evaluated = 0
    let resolved = 0
    let errors = 0

    const { data: tests, error: erroLeitura } = await supabase
      .from('ab_tests')
      .select('id, site_id, youtube_video_id, config, started_at, created_at, original_thumbnail_url')
      .eq('status', 'active')

    if (erroLeitura) {
      Sentry.captureException(erroLeitura, { tags: { cron: 'ab-evaluate' }, extra: { context: 'ler testes ativos' } })
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

        // Volta ao original, melhor esforço (P4 troca por settleOnAir(original, 'duracao_maxima')).
        try {
          if (test.original_thumbnail_url?.includes('blob.vercel-storage.com')) {
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
            }
          }
        } catch (e) {
          Sentry.captureException(e, { extra: { context: 'max-duration-revert', testId: test.id } })
        }

        const agora = new Date().toISOString()
        const fechouCiclos = await supabase
          .from('ab_test_cycles')
          .update({ ended_at: agora })
          .eq('test_id', test.id)
          .is('ended_at', null)
        if (fechouCiclos.error) throw fechouCiclos.error

        const encerrou = await supabase
          .from('ab_tests')
          .update({
            status: 'completed',
            completed_at: agora,
            completed_reason: 'inconclusive',
            confidence_at_completion: null,
          })
          .eq('id', test.id)
        if (encerrou.error) throw encerrou.error

        resolved++
        evaluated++
      } catch (err) {
        errors++
        Sentry.captureException(err, { tags: { cron: 'ab-evaluate' }, extra: { testId: test.id } })
      }
    }

    return { evaluated, resolved, errors }
  }
  ```

  O bloco de restauração é **cópia literal** do de hoje (`:408-427`); não melhore nada nele.
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
  - `test/ab-cron-evaluate.test.ts` (18 casos): saem os de carência, encerramento automático, flag e
    playoff (297, 327, 382, 398, 423, 455, 555, 589, 654) e os dois do contador (244, 277); os de
    duração máxima (484, 520) são reescritos para o ramo único; **ficam** 210 (401), 218, 227, 631. O
    arranjo do falso depende da **ordem** das chamadas ao Supabase (`:726` "Call 3: Phase 3", `:782`):
    refaça a ordem para fase 1 → fase 2 → longevidade. O caso que afirma `playoffs_created` (781) sai;
    acrescente:

    ```ts
    it('a resposta não tem mais applies_retried nem playoffs_created', async () => {
      const corpo = await (await GET(pedidoAutenticado())).json()
      expect(Object.keys(corpo).sort()).toEqual(['errors', 'evaluated', 'longevity_checked', 'playoffs_started', 'resolved', 'status'])
    })

    it('a rota não lê AB_AUTO_APPLY_WINNER', async () => {
      process.env.AB_AUTO_APPLY_WINNER = 'true'
      try {
        await GET(pedidoAutenticado())   // arranjo com um teste ativo, critérios verdes, dentro da duração
        expect(applyVariantToYouTube).not.toHaveBeenCalled()
      } finally {
        delete process.env.AB_AUTO_APPLY_WINNER
      }
    })
    ```
  - `test/api/cron/ab-evaluate.test.ts`: sai a afirmação sobre `consecutive_confident_evals` (207).
  - `test/youtube/ab-critical.test.ts` e `test/youtube/ab-gates.test.ts`: já são de função pura; **não
    mudam** (confira que continuam verdes).
- [ ] **Passo 8.** Rodar os cinco arquivos e o `tsc`. Depois:
  `grep -rn "isAutoApplyEnabled\|phaseRetryFailedApplies\|phaseDetectPlayoffEligibility\|AB_AUTO_APPLY_WINNER" apps/web/src`
  sem saída.
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
  - telas: em `test/ab-settings-drawer.test.tsx` e nos dois `ab-step-config.test.tsx`,
    `expect(screen.queryByText(/Aplicar vencedor automaticamente/i)).toBeNull()`,
    `expect(screen.queryByText(/Playoff automático/i)).toBeNull()` e
    `expect(screen.queryByText(/confiança/i)).toBeNull()`.
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

- [ ] **Passo 1, testes que falham.** Em `test/youtube/ab-detail-active*` (o arquivo que renderiza o
  detalhe do teste ativo):

  ```tsx
  it('não mostra tempo assistido, comentários, compartilhamentos, top 2 nem receita; mostra a frase fixa', () => {
    render(<ActiveDetail view={viewAtivo} />)
    for (const texto of [/tempo assistido/i, /comentários/i, /compartilhamentos/i, /top ?2/i, /receita/i, /Raio-X/i]) {
      expect(screen.queryByText(texto)).toBeNull()
    }
    expect(screen.getAllByText('Sem medição de entrega por enquanto').length).toBeGreaterThan(0)
  })
  ```

  E em `test/youtube/ab-high.test.ts:308`: `toHaveProperty('pTop2')` vira `not.toHaveProperty('pTop2')`.
- [ ] **Passo 2.** Rodar: falham.
- [ ] **Passo 3, `active-detail.tsx`.** Sai o mapeamento com `watchTime`, `comments` e `shares` (77-79)
  e o bloco "Raio-X das variantes" (326-338), com a frase fixa no lugar (um parágrafo com a mesma classe
  de texto secundário que o arquivo já usa para "Coletando dados..."); sai o cartão "Receita estimada"
  (274-282) e o ramo de 292 que dependia de `!view.revenue`, com a frase fixa no lugar.
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

### Tarefa 4: o pipeline entrega `null` com aviso (resposta 7 do dono)

Tarefa separável. **Um commit só** (paridade).

**Interfaces.** Em `src/lib/pipeline/services/youtube.ts` nasce:

```ts
/** Enquanto o A/B não tiver métrica de entrega real, esses campos saem null com este aviso. */
export const AVISO_SEM_METRICA_DE_ENTREGA = 'sem métrica de entrega' as const
```

O que cada resposta passa a devolver (a **forma** não muda: mesmas chaves, mais `aviso`):

| Função (linha de hoje) | Vira `null` | Fica | Ganha |
|---|---|---|---|
| `getAbTestFunnel` (1038-1132) | `per_variant[].impressions`, `per_variant[].clicks` | `link_clicks`, `per_link`, `link_clicks_window` (cliques reais de link) | `aviso` |
| `getAbTest` (993) | `cycles[].impressions`, `cycles[].clicks`, `cycles[].ctr`; `confidence_at_completion`; `result_metadata.ctr_lift_percent` | o resto da linha | `aviso` |
| `listAbTests` (963) | por teste: `confidence_at_completion`, `result_metadata.ctr_lift_percent` | o resto | `aviso` (um, no topo da resposta) |
| `getAbLearnings` (1437-1525) | `tagWinRates[].avgLift`; em `channelInsights`, saem as frases que citam percentual de lift ou de queda | `wins`, `total`, `kind`, `totalCompletedTests` | `aviso` |
| `getAbDashboard` (1707-1760) | `avgConfidence`, `avgLift` | `activeTests`, `winRate` (decisão E10), `testsByStatus` | `aviso` |
| `getAbVideoHistory` (1778-1810) | `tests[].liftPercent` | o resto | `aviso` |
| `getThumbnailLibrary` (1823-1865) | `thumbnails[].lift` | o resto | `aviso` |

Tipos: cada campo que vira `null` passa a `number | null` no tipo de retorno. `aviso` é
`typeof AVISO_SEM_METRICA_DE_ENTREGA`.

- [ ] **Passo 1, testes que falham.**

  ```ts
  it('funil: impressões e cliques de entrega saem null com aviso; cliques de link continuam número', async () => {
    const r = await getAbTestFunnel(ctx, testId)   // mesmo arranjo do caso de hoje, ciclos com impressions 150 e 200
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.aviso).toBe('sem métrica de entrega')
    for (const v of r.data.per_variant) {
      expect(v.impressions).toBeNull()
      expect(v.clicks).toBeNull()
      expect(typeof v.link_clicks).toBe('number')
    }
  })

  it('painel: confiança média e lift médio saem null com aviso, nunca zero', async () => {
    const r = await getAbDashboard(ctx)
    if (!r.ok) throw new Error('falhou')
    expect(r.data.avgConfidence).toBeNull()
    expect(r.data.avgLift).toBeNull()
    expect(r.data.aviso).toBe('sem métrica de entrega')
    expect(typeof r.data.winRate).toBe('number')
  })
  ```

  Um caso do mesmo formato para `getAbTest` (ciclo com `impressions: 100` → `null`, e
  `confidence_at_completion: 0.97` → `null`), `listAbTests`, `getAbLearnings` (`avgLift: null`),
  `getAbVideoHistory` (`liftPercent: null`) e `getThumbnailLibrary` (`lift: null`). Nos arquivos:
  `test/ab-pipeline-api.test.ts:200-206`, `test/api/pipeline/youtube-ab-tests.test.ts:221-239`,
  `test/mcp/mcp-schema-reads.test.ts:353-384`, `test/api/pipeline/youtube-ab-extended.test.ts:168-207,502,538,617,652`,
  `test/api/pipeline/youtube-thumbnails.test.ts`. As afirmações de hoje (`impressions: 150/200/1800`,
  `avgLift` 15) são **substituídas**, não acrescidas.
  Em `test/youtube/prompt-builders-ab.test.ts:195-215`: o histórico não tem a chave `lift_medio`, e o
  texto dos aprendizados não contém `avg lift`.
- [ ] **Passo 2.** Rodar: falham.
- [ ] **Passo 3, serviços.** Aplicar a tabela de "Interfaces". Em `getAbTest` e `listAbTests` o `select`
  é `ab_tests.*`: anule os campos **depois** da leitura, num mapeamento explícito; não mude o `select`.
- [ ] **Passo 4, prompts** (`src/lib/youtube/prompt-builders-ab.ts`): `buildHistorySection` (250-275)
  deixa de calcular e de emitir `lift_medio`; as linhas de briefing "lift médio" / "avg lift" (399-403)
  saem; `formatLearningTag` (193-196) passa a `(N wins, kind)`, sem o percentual.
  `mcp/prompts.ts:661,750` já passam `ctr_lift_percent: null`: confira que continuam compilando.
- [ ] **Passo 5, MCP e doc.** `mcp/tools.ts:664-665`: a descrição das ações `get_funnel`,
  `get_learnings`, `get_dashboard`, `get_history`, `get_test` e `list_tests` ganha uma frase: "Campos de
  entrega (impressões, cliques, CTR, confiança, lift) saem `null` com `aviso: 'sem métrica de entrega'`
  enquanto o A/B não tiver medição real." `data/pipeline-docs/cowork-docs-youtube.md`: nas seções de
  aprendizados (1306-1352), painel (1429-1459), histórico (1461-1500) e biblioteca (1506-1542), os
  exemplos passam a mostrar `null` e `aviso`, e cada seção ganha a mesma frase. (As linhas deslocam
  depois de P1: ache pelas âncoras `avgLift`, `avgConfidence`, `liftPercent`, `liftAtWin`.)
- [ ] **Passo 6.** Rodar os seis arquivos, mais `test/mcp/mcp-schema-parity.test.ts` e
  `test/mcp/youtube-cowork-docs.test.ts`, e o `tsc`.
- [ ] **Passo 7, commit:** `fix: o pipeline e o MCP entregam null com aviso no lugar de impressões, confiança e lift do A/B, e o lift médio sai dos prompts (A/B Lab P2, Tarefa 4)`.

**Fora desta tarefa, declarado:** os prompts montados pelo CMS em `youtube-prompt-actions.ts:271-280` e
`:531-535` leem `confidence_at_completion` para o prompt de coaching, e `AB/actions.ts:1620` passa
`ctr_lift_percent`. O segundo morre no passo 4 (o construtor não usa mais o campo). O primeiro **fica
como pergunta para a revisão** (seção 9, item 2).

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
  sem saída (aceite 7).
- [ ] Commit: `docs: AB_AUTO_APPLY_WINNER sai do CLAUDE.md e de docs/ops; no lugar, a regra de que o A/B não declara nem aplica vencedor (A/B Lab P2, Tarefa 5)`.

### Tarefa 6: prova local, capturas e revisão de tela

- [ ] `npx tsc --noEmit` do web e da api; suíte inteira em background com saída em arquivo; `npm run build:web`
  com saída em arquivo. Só as falhas entram no contexto.
- [ ] **Gio (`gio-qa`, Sonnet, `medium`):** antes (em `origin/staging` já com P1) e depois, a 1440 px e
  a 390 px, de: detalhe de um teste ativo, detalhe de um teste encerrado, gaveta de configurações, passo
  "configurar" e passo "revisar" do wizard. Em
  `docs/superpowers/mockups/2026-10-13-ab-lab-p2-retirada/shots/`. A semente local precisa de um teste
  `active` com ciclos e de um `completed`; o Gio diz como criou. Veredito em texto, tela por tela: o que
  saiu, o que ficou órfão (rótulo sem controle, coluna vazia, espaço morto).
- [ ] **Logan e Naksu (Sonnet, `medium`), em paralelo, uma passada:** a frase "Sem medição de entrega
  por enquanto" no lugar de cada bloco comunica o que falta, sem parecer erro? O wizard sem os três
  controles ainda tem um passo "configurar" que vale a tela? E a "sobra declarada" da seção 3 (painel de
  critérios sobre views): aceitam até a etapa de telas, ou pedem a tarefa 3b?
- [ ] Capturas ao dono, uma linha por tela.

### Tarefa 7: envio

Igual à Tarefa 7 do plano da P1: revisão do lote por **Phil e Yannis** (Opus, `medium`) sobre o `diff`;
as três conferências da regra 1 (vazias por construção: sem migration, sem teste de integração mudado);
junção com `origin/staging` na árvore se o remoto andou; `bash -c 'git push origin lote/ab-p2:staging'`;
CI; promoção; `git merge origin/staging` no `staging` local com o outro terminal avisado; o aviso da
seção 1 entregue ao controlador da A5.

### Tarefa 8: produção

Só select, por `npx supabase db query --linked --agent=yes -o json`, com autorização do dono na sessão.

- [ ] **C1, ANTES do envio (portão):**
  `select id, status, test_type, started_at, grace_expires_at, winner_variant_id, winner_applied_at, completed_reason from ab_tests order by created_at;`
  Esperado: nenhum `active`, nenhum com `grace_expires_at` não nulo. **Se houver teste `active`, pare e
  leve ao dono:** depois de P2 ele encerrará como `inconclusive` no primeiro disparo depois da duração
  máxima, com a restauração de hoje.
- [ ] **C2, depois do deploy, na execução seguinte do cron (12:00 UTC):** `/api/health` sem falha do
  `ab-evaluate`; a resposta do cron (log da Vercel) tem as seis chaves novas.
- [ ] **C3, paridade:** o funil de um teste encerrado, pelo REST e pela ação MCP `get_funnel`, devolve
  `impressions: null` e o mesmo `aviso` nos dois caminhos.
- [ ] **C4:** o dono abre um teste encerrado e as configurações (aceite P2-P1).

---

## 6. Aceite

| # | Critério | Onde se prova |
|---|---|---|
| 6 | `ab-evaluate` com métricas zeradas não cria vencedor, carência nem playoff; na duração máxima encerra `inconclusive`; a rota não lê `AB_AUTO_APPLY_WINNER` | Tarefa 1, passos 1 e 7 |
| 7 | O `grep` do spec não encontra nada em `apps/web/src`, `CLAUDE.md` e `docs/ops` | Tarefa 5 |
| 8 | Configuração antiga com `auto_apply_winner` continua válida e a chave é ignorada | Tarefa 2, passo 1 |
| 9a | Os quatro números de 4.2.1 não aparecem; a frase fixa aparece | Tarefa 3, passo 1 |
| 9b | Funil e painel do pipeline devolvem `null` com o aviso | Tarefa 4, passo 1 |
| P2-P1 | Produção: teste encerrado mostra a frase fixa no lugar dos números; as configurações não têm "Aplicar vencedor automaticamente" | dono; Tarefa 8, C4 |
| P2-P2 | Produção: a execução seguinte do `ab-evaluate` termina sem falha | Tarefa 8, C2 |
| P2-P3 | Paridade: mesmo `null` e mesmo `aviso` pelo REST e pelo MCP | Tarefa 8, C3 |
| P2-P4 | Nenhum teste `active` em produção no dia do envio, ou o dono decidiu o que fazer com ele | Tarefa 8, C1 |

## 7. O que acontece quando o dado não existe, e em cada falha

| Situação | Depois de P2 |
|---|---|
| Nenhum teste ativo | o cron responde `evaluated: 0`, verde. É o estado de produção |
| A leitura de `ab_tests` falha | `errors: 1`, `recordCronFailure`. Antes: verde com zero |
| Teste ativo com `started_at` nulo | usa `created_at` (como hoje) |
| Teste ativo sem `max_duration_days` na configuração | 14 dias (como hoje) |
| A restauração da thumbnail falha (token, canal não identificado, Blob fora) | Sentry, e **o teste encerra assim mesmo** com a variante no ar. É o comportamento de hoje, mantido; P4 conserta |
| O original não está no Blob | nada é restaurado; encerra. Igual a hoje |
| Fechar ciclos ou encerrar o teste falha no banco | `errors++`, o teste continua `active` e o cron tenta de novo no dia seguinte (a restauração é refeita: enviar a mesma imagem duas vezes não muda o vídeo) |
| Teste em carência no momento do deploy (`grace_expires_at` preenchido) | ninguém mais aplica nem cancela; fica como está até a duração máxima, e o dono ainda tem "aplicar agora" e "cancelar" na tela. **Produção tem zero** (C1 confere) |
| Rascunho de rodada 2 já criado | `phaseAutoStartPlayoffs` ainda o inicia (zero hoje). Nenhum playoff novo nasce |
| Cowork soma `impressions` do funil | recebe `null`; quem somava passa a ver `null`/erro de tipo no lado dele, não zero. O `aviso` e o doc dizem por quê |
| Configuração antiga com as chaves mortas | aceita, ignorada, não reescrita |
| `git revert` de P2 | volta tudo; nada no banco mudou. Teste que P2 encerrou por duração máxima continua encerrado |

## 8. Riscos que ficam, sem suavizar

- **A restauração que falha continua silenciosa** (vai só ao Sentry). Com zero testes ativos hoje não
  expõe nada; **P4 tem de estar em produção antes do primeiro teste novo** (o dono disse que roda teste
  "em algumas semanas").
- **Um teste antigo com critérios verdes que estava preso em `active`** (o defeito do `!allPass`) será
  encerrado no primeiro disparo. É o certo, mas é mudança visível: C1 mostra antes se existe algum.
- **O Cowork recebe `null` onde recebia número.** Prompt ou rotina dele que faça conta com esses campos
  quebra do lado dele. É o efeito pedido (resposta 7), e o `aviso` explica.
- **A tela ainda mostra critérios e probabilidade calculados sobre views** (sobra declarada, seção 3).
- **A Tarefa 3 é larga** (o campo `pTop2` atravessa cinco componentes e oito arquivos de teste). É a
  candidata a corte se o lote ficar grande: sem ela, os números fabricados ficam até a etapa de telas.
- **Trechos de teste são moldes**, escritos sem ler os arquivos de teste; os nomes dos auxiliares têm de
  ser trocados pelos que existem. O que não muda é a lista de afirmações.
- **Linhas de `cowork-docs-youtube.md` e de `services/youtube.ts` deslocam depois de P1.** O plano dá
  âncoras de texto; quem executa reconfere.

## 9. Perguntas abertas para a revisão

1. **Yannis:** as decisões E1 a E5 e E7; o risco de manter a restauração silenciosa até a P4, ou se P2
   deveria, quando a restauração falha, **não** encerrar o teste (ficaria `active` além da duração,
   tentando todo dia). O teste da ordem de chamadas do falso em `ab-cron-evaluate.test.ts`.
2. **Phil:** anular `confidence_at_completion` e `ctr_lift_percent` na **saída** do pipeline basta, ou
   os valores já gravados em `ab_tests` precisam de tratamento (são poucos testes; nada é apagado)? E
   `youtube-prompt-actions.ts:271-280`, que lê `confidence_at_completion` para o prompt de coaching:
   entra na Tarefa 4?
3. **Gio:** como se prova P2-P3 (paridade) de forma repetível; e a semente local para as cinco telas.
4. **Logan e Naksu (na Tarefa 6):** a frase fixa e a sobra declarada.
5. **Hanna:** a Tarefa 3 e a Tarefa 4 vão no mesmo envio da Tarefa 1, ou a Tarefa 1 sobe sozinha
   primeiro (é a que para o cron de decidir)? Recomendação do controlador: um envio só, porque produção
   tem zero testes ativos e o que o dono **vê** está nas Tarefas 2 e 3.
