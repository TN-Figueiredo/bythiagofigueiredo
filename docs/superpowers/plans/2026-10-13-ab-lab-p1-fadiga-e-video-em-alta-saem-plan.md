# A/B Lab honesto, P1: fadiga e "vídeo em alta" saem (plano de implementação)

Escrito em 13/10/2026 (noite). Primeira versão, **ainda sem o portão de Phil, Yannis, Gio e Hanna**.
Spec: `docs/superpowers/specs/2026-10-07-ab-lab-honesto-design.md` (v6, seção 4.3, bloco P1 da seção 1,
aceite 1 a 5 e "Respostas do dono (13/10/2026)" no fim). Inventário de código, lido em 13/10 no HEAD
`bc5adea94`: `.superpowers/sdd/ab-lab/inventario-p1.md` (toda linha citada aqui vem dele; **quem executa
reconfere por `grep` no dia**). Parecer da Hanna sobre a ordem: `.superpowers/sdd/ab-lab/hanna-parecer-01-plano-de-trabalho.md`.

> **Para quem executa:** use `superpowers:subagent-driven-development`, tarefa por tarefa. Passos com
> caixa (`- [ ]`). Sonnet, effort `medium`; `high` em nenhuma tarefa deste plano.

**Objetivo, em uma frase.** Parar de gravar, mostrar e entregar ao Cowork dois sinais que leem como
"views do dia" um número que é o total de 90 dias: o alerta de fadiga e o aviso "vídeo em alta".

**Como.** É retirada pura: nenhuma tabela, coluna, migration, tela nova ou variável de ambiente. Sai o
código que grava (duas fases do cron das 12:00 UTC e a inserção da longevidade), o que lê (cartão e
selo no CMS, "+30%" na sugestão) e o que entrega (duas rotas do pipeline, dois recursos e uma ação do
MCP, um tipo de aviso). A tabela `youtube_fatigue_alerts` e as colunas `view_count_delta_today` e
`view_count_yesterday` **ficam no banco**, sem leitor nem gravador.

**Stack.** Next.js 16, TypeScript estrito, Vitest, zod 3.24.

## Fica FORA deste plano

- A tabela "Candidatos a teste" e o detector de queda de CTR (spec próprio, não escrito).
- Apagar `youtube_fatigue_alerts` ou as duas colunas de `youtube_videos` (a função de remover canal e o
  teste `test/integration/youtube-channel-remove.test.ts` dependem da tabela).
- A longevidade de thumbnail em si (`checkLongevity`, `runLongevityChecks`, o `upsert` em
  `thumbnail_longevity`): **fica** (resposta 9 do dono). Só a inserção do alerta sai.
- O `upsert` de `youtube_video_analytics.views` com o total de 90 dias: continua (é da coleta).
- Tudo de P2 (avaliação automática), P3 (descrição) e P4 (restauração). **P1 não abre
  `app/api/cron/ab-evaluate/route.ts`** (a fase 5 dela continua chamando `runLongevityChecks`).
- `docs/plans/youtube-cowork-mcp-plan.md` e `docs/superpowers/specs/2026-10-08-fadiga-deteccao-design.md`:
  história, não se editam.

## Restrições globais

- **Só retirada.** Nenhum comportamento novo além da mensagem em pt-BR da Tarefa 4. Se uma tarefa pedir
  código novo que não está aqui, pare e devolva ao controlador.
- **Falha em verde.** As duas rotas do pipeline são **apagadas** (404). Devolver lista vazia diria "sem
  fadiga". Nenhum leitor passa a receber `[]`, `0` ou `false` no lugar do que saiu: o campo some.
- **Paridade Cowork × Claude Code (decisões 70 a 72).** Rota REST, recurso MCP e ação MCP do mesmo dado
  saem **no mesmo commit** (Tarefa 4), com o doc.
- **Pipeline Integrity (`CLAUDE.md`).** Rota apagada → entrada sai de `api-registry.ts`, `endpoint_count`
  do domínio YouTube vai de **36 para 34**, e `data/pipeline-docs/cowork-docs-youtube.md` é atualizado.
- **Nada em produção é apagado ou alterado por código deste plano.** O único comando de escrita em
  produção é o `update` da Tarefa 8, que o dono cola.
- TypeScript sem `any`; rótulo e mensagem novos em pt-BR; commits `tipo: descrição`.
- **Árvore e envio:** seção "Onde se trabalha e como se envia". Nunca `git stash`, `git reset`, `pkill`,
  nem `git push` do `staging` local.
- Suíte e build com saída em arquivo; no contexto entram só as falhas. Nenhum comando acima de 4 min em
  primeiro plano.

## Foco de revisão (o que o spec implica e nenhum teste de hoje exercita)

1. **O cron com dado real de 90 dias.** Linhas de analytics com `views` grande e crescente: depois de P1
   nenhum aviso sai e nada é inserido em `youtube_fatigue_alerts`. Teste na Tarefa 1.
2. **Canal sem conexão continua avisando.** O aviso `youtube.channel_skipped_no_connection` usa o mesmo
   `fanOutToSiteAdmins` que o aviso viral usava; tirar um não pode levar o outro. Teste na Tarefa 1.
3. **O Cowork manda `trending_viral`.** Recusa com mensagem que ele entende, sem gravar nada. Tarefa 4.
4. **Sugestão de vídeo para testar sem o "+30%".** A lista continua saindo, ordenada, sem o motivo "CTR
   em declínio". Teste na Tarefa 3.
5. **Longevidade `fading`.** Grava `thumbnail_longevity` e **não** insere alerta. Teste na Tarefa 2.

---

## 0. Fatos medidos em 13/10 (o desenho depende deles)

| Fato | Valor | Fonte |
|---|---|---|
| `staging` local à frente de `origin/staging` (`9a0fba67f`) | 388 commits | `git rev-list --count` |
| Arquivos do escopo de P1 e P2 que diferem entre `origin/staging` e o `staging` local | **3**: `apps/web/data/pipeline-docs/cowork-docs-youtube.md` (4 linhas), `apps/web/test/cron/sync-analytics-metrics-veredito.test.ts` (+61), `docs/ops/youtube-coleta-canais-proprios-runbook.md` (+118) | `git diff --stat origin/staging HEAD -- <escopo>` |
| Rotas em `apps/web/src/app/api/pipeline` no disco | **91**; `test/lib/pipeline/leitura-rotas.test.ts:19` exige `>= 91` | `find … -name route.ts \| wc -l` |
| `endpoint_count` do domínio YouTube | 36 (`api-registry.ts:169`); `test/mcp/mcp-registry-sync.test.ts:28-29` fixa `youtube(36)` e total `128` | inventário, 3f |
| Quem lê `fatigueAlerts` e `notifications` da resposta do cron | ninguém (vigia, `/api/health`, `yt_own_collection_runs.resumo`, painel): só a rota, os testes dela e o runbook | inventário, 3c |
| Quem lê `view_count_delta_today` / `view_count_yesterday` | só a própria rota do cron | inventário, 3d |
| Plano da A5 que **edita** a rota `sync-analytics-metrics/route.ts` | nenhum (seis só citam linha) | inventário, seção 4 |
| A E7 (Cowork) já tem código commitado? | não (só documentos) | `git log origin/staging..HEAD -- <arquivos da E7>` |
| zod | `^3.24.2` | `apps/web/package.json:100` |

**Não medido (ninguém leu produção):** quantas linhas `pending` existem em `youtube_fatigue_alerts`;
quanto tempo as duas fases gastam hoje no cron. A conta do tempo é do Phil, com
`yt_own_collection_runs.ms_existente` de antes e de depois (Tarefa 8, C3).

## 1. Onde se trabalha e como se envia

**Recomendação, a confirmar com Yannis na revisão:** P1 é implementada numa **árvore de trabalho
própria**, criada de `origin/staging`, e não no `staging` local.

```bash
git fetch origin
git worktree add ../bythiago-ab-p1 -b lote/ab-p1 origin/staging
cd ../bythiago-ab-p1 && npm ci > /tmp/ab-p1-npm-ci.log 2>&1   # em background; ler só o fim
npm run build:packages > /tmp/ab-p1-build-packages.log 2>&1
```

Por quê: (a) o outro terminal implementa a A5 no `staging` local, e P1 mexe em 30 arquivos de código e
18 de teste; na árvore própria ninguém pisa em ninguém; (b) a regra 1 da reconciliação da A5 proíbe
`git push` do `staging` local e manda cada lote subir "por árvore própria sobre `origin/staging`": aqui
a árvore de trabalho **já é** a árvore de lote, sem remontagem por `cherry-pick`; (c) só 3 arquivos do
escopo diferem entre os dois lados (seção 0), então a volta ao local é uma junção pequena.

Custo, declarado: é um galho a mais, e o dono prefere trabalhar direto em `staging`
(`feedback_work_on_staging`). A A5 já usa `refs/remontagem/*` pelo mesmo motivo. **Alternativa:**
commitar no `staging` local por lista de caminhos e remontar a árvore por `cherry-pick` no dia do envio
(é o que a A5 faz); custa conviver com o hook de pre-commit quebrando por arquivo alheio.

**Envio (Tarefa 7):** as três conferências da regra 1 (para P1 as três dão zero por construção: não há
migration nem teste de integração novo), `npx tsc --noEmit` e a suíte na árvore, push por refspec
(`bash -c 'git push origin lote/ab-p1:staging'`), CI verde, promoção a `main` (do agente, pela regra do
dono de 10/10), e depois, no `staging` local e **com o outro terminal avisado e sem agente commitando**,
`git merge origin/staging` (junção, nunca rebase).

**Conflitos previstos na junção** (resolve o controlador, nunca um agente sozinho):
- `test/cron/sync-analytics-metrics-veredito.test.ts`: o local tem +61 linhas da E11 e da E6/E8; P1
  apaga os casos de fadiga e de aviso viral. Regra: ficam todos os casos da A5; saem só as afirmações
  sobre `fatigueAlerts`, `notifications`, `view_count_delta_today` e `view_count_yesterday`.
- `cowork-docs-youtube.md`: 4 linhas locais, outro trecho.
- `docs/ops/youtube-coleta-canais-proprios-runbook.md`: +118 locais; P1 mexe em 3 linhas (Tarefa 5).

**Ordem com a E7 (Cowork), que ainda não começou:** P1 vai **antes**. A E7 edita `api-registry.ts`
(texto de dois `summary`), `mcp/tools.ts`, `mcp/prompts.ts` e `cowork-docs-youtube.md`, em outros
trechos, e o plano dela tem três números que P1 muda. Avisos a dar ao controlador da A5, no dia em que
P1 chegar a `origin/staging` (o controlador desta trilha escreve; **não edita plano da A5**):

| Plano da A5 | O que fica velho depois de P1 |
|---|---|
| E7 (`a5-e7-cowork-plan.md:13,64`) | "`endpoint_count` igual (36)" passa a 34; "`leitura-rotas.ts` não é tocado" continua valendo para a E7, mas o arquivo perdeu duas linhas |
| E7 (`:549,:976,:1024`) | o portão "nada acima da linha 600 de `cowork-docs-youtube.md`" compara com a base: a base passa a ser a de depois de P1 (P1 edita as linhas 12 e 280) |
| E17 degrau 2 (`:149`, `:1060`) | "33 recursos" passa a 31 [INFERÊNCIA do inventário: conferir contando]; `api-registry.ts:201-204` passa a `:199-202` |
| E10 (`:161`), E6 parte 3 (`:27`), E6 parte 4 (`:35`), E18 (`:158`), reconciliação (`:360,:430`) | todas citam linha de `sync-analytics-metrics/route.ts` depois da 358; deslocam cerca de 128 linhas para cima. O teste da E10 é por (arquivo, tabela), não por linha: só o texto envelhece |
| E18 (`:244-252`) | cita `ab-lab/actions.ts:691-741` e `:1396-1404`; P1 tira cerca de 27 linhas antes delas |

## 2. O que é do dono

1. Ver as capturas de antes e depois (Tarefa 6) e dizer "pode". A retirada sem mockup já foi autorizada
   (resposta 10); as capturas são para ele conferir que só saiu o que devia.
2. Colar a consulta e o `update` da Tarefa 8 (resposta 8).
3. Abrir o A/B Lab e a lista de vídeos em produção, logado, depois do deploy (aceite P1-P1).

**Não é mais do dono (desvio do spec, com motivo):** "rodar o seed da referência do Cowork". O seed
(`scripts/seed-pipeline-reference.ts`) só leva `docs/cowork-*.md` ao banco, e nenhum deles cita fadiga;
`data/pipeline-docs/cowork-docs-youtube.md` é servido do disco do deploy
(`lib/pipeline/services/utilities.ts:155-161`). P1 não precisa de seed.

## 3. Desvios do texto do spec, com o motivo

| # | O spec diz | O plano faz | Por quê |
|---|---|---|---|
| D1 | Aceite 5: enviar `trending_viral` pelo pipeline → **422** com mensagem em pt-BR | **400** `VALIDATION_ERROR`, mensagem em pt-BR | O PATCH valida o corpo com `PatchPayloadSchema.safeParse` e devolve 400 para todo erro de schema (`services/youtube.ts:619-626`); 422 hoje é só integridade referencial (`:692`). Dar 422 a um valor de enum exigiria uma checagem antes do zod só para este caso. Um valor fora do enum é erro de validação como os outros |
| D2 | "O snapshot [do MCP] é regenerado no mesmo commit" | não se regenera | `mcp-schema-parity.test.ts.snap` não cita fadiga (inventário, 3f). Se o teste reprovar, aí sim: `npx vitest run test/mcp/mcp-schema-parity.test.ts -u` e o diff vai no commit |
| D3 | "Testes que mudam (16 arquivos)" | 16 menos o snapshot, mais `test/mcp/mcp-registry-sync.test.ts` e `test/lib/pipeline/leitura-rotas.test.ts` | o primeiro fixa 36 e 128; o segundo exige `>= 91` rotas no disco e passam a ser 89 |
| D4 | não lista `lib/pipeline/leitura-rotas.ts` | saem as linhas `:72` e `:91` | o arquivo nasceu na E19 (depois do spec) e o `grep` do aceite 1 o pega |
| D5 | não lista `computeViewDeltas` | sai junto com `detectViral` | fica sem chamador de produção e é o mesmo erro de conceito (delta diário tirado de total) |
| D6 | "o dono roda o seed" | não há seed | seção 2 |
| D7 | Aceite 1: o `grep` "só encontra `database.types.ts`" | idem, com `apps/web/src apps/web/data`; em `docs/` e `apps/web/test` ficam as ocorrências nomeadas na Tarefa 5 | `test/integration/youtube-channel-remove.test.ts` e `audit-youtube-videos-editorial.test.ts` usam a tabela e a coluna, que continuam existindo |

## 4. Arquivos, por tarefa

| Tarefa | Apaga | Edita |
|---|---|---|
| 1 cron | `src/lib/youtube/ab-fatigue.ts`, `test/youtube/ab-fatigue.test.ts` | `src/app/api/cron/sync-analytics-metrics/route.ts`, `src/lib/youtube/analytics-sync.ts`, `test/analytics-sync.test.ts`, `test/cron/sync-analytics-metrics-veredito.test.ts`, `test/cron/sync-analytics-metrics.test.ts`, `test/api/cron/sync-analytics-metrics.test.ts` |
| 2 longevidade | | `src/lib/youtube/thumbnail-library.ts`, `test/youtube/thumbnail-library.test.ts` |
| 3 CMS | `ab-lab/_components/fatigue-card.tsx` | `ab-lab/{page.tsx,queries.ts,actions.ts,_components/ab-lab-dashboard.tsx}`, `videos/{page.tsx,videos-connected.tsx}`, `test/ab-dashboard.test.tsx`, `test/youtube/ab-lab-dashboard-stubs.test.tsx`, `test/ab-actions-create.test.ts`, `test/ab-p3-actions.test.ts` |
| 4 pipeline | `src/app/api/pipeline/youtube/ab-tests/fatigue-alerts/route.ts`, `src/app/api/pipeline/youtube/thumbnails/fatigue/route.ts` | `src/lib/pipeline/{api-registry.ts,leitura-rotas.ts,services/youtube.ts}`, `src/lib/pipeline/mcp/{resources.ts,tools.ts,prompts.ts,services/ab-tests.ts}`, `src/lib/youtube/{intelligence-schemas.ts,notification-service.ts}`, `data/pipeline-docs/cowork-docs-youtube.md`, `test/analytics-notification-service.test.ts`, `test/api/pipeline/{youtube-thumbnails,youtube-ab-extended}.test.ts`, `test/mcp/{youtube-mcp-tools,youtube-cowork-docs,mcp-registry-sync}.test.ts`, `test/lib/pipeline/leitura-rotas.test.ts` |
| 5 docs | | `docs/ops/youtube-coleta-canais-proprios-runbook.md`, `docs/cowork-youtube-intelligence-reference.md`, `docs/ab-testing-system-reference.md`, `apps/web/test/e2e/youtube-mcp-e2e-plan.md` |

Caminhos de código relativos a `apps/web/`; `ab-lab/` e `videos/` ficam em
`src/app/cms/(authed)/youtube/`. Tarefas 1 a 5 são independentes entre si (cada commit compila sozinho)
e podem ser feitas em qualquer ordem; a ordem escrita é a de menor risco. **Uma por vez, na mesma
árvore**: não há ganho em paralelizar retirada no mesmo conjunto de testes.

---

## 5. As tarefas

Em todas: rode os testes **dos arquivos da tarefa**, com saída em arquivo:
`cd apps/web && npx vitest run <arquivos> > /tmp/ab-p1-tN.log 2>&1; tail -30 /tmp/ab-p1-tN.log`.
E `npx tsc --noEmit -p apps/web > /tmp/ab-p1-tsc.log 2>&1; tail -20 /tmp/ab-p1-tsc.log` antes do commit.

### Tarefa 0: árvore e linha de base

- [ ] Criar a árvore (seção 1). Conferir `git -C ../bythiago-ab-p1 status --short` vazio.
- [ ] Reconferir as linhas do inventário na árvore (ela nasce de `origin/staging`, não do HEAD local):
  `grep -rnE "fatigue|fadiga|detectViral|trending_viral|view_count_delta_today|view_count_yesterday|checkAndPersistLongevity" apps/web/src apps/web/data --include='*.ts' --include='*.tsx' --include='*.md' | grep -v database.types > /tmp/ab-p1-grep-antes.txt; wc -l /tmp/ab-p1-grep-antes.txt`.
  Guardar o arquivo: é o "antes" do aceite 1.
- [ ] Linha de base dos testes do escopo (os 18 arquivos da seção 4), saída em `/tmp/ab-p1-base.log`.
  **Esperado: tudo verde.** Se algo já estiver vermelho na base, pare e devolva ao controlador.
- [ ] `find apps/web/src/app/api/pipeline -name route.ts | wc -l` → **91**. Outro número: pare.

### Tarefa 1: o cron deixa de detectar fadiga e "vídeo em alta"

**Arquivos:** linha 1 da tabela da seção 4.

**Interfaces.** Produz: `ParteAntiga` e a resposta JSON do cron **sem** as chaves `notifications` e
`fatigueAlerts`; `analytics-sync.ts` exporta só `getIsoWeek`. Não muda: `resumoColeta`, `msPassos`,
`ms_existente`, o veredito (`recordCronFailure` / `recordCronSuccess`), o aviso de canal sem conexão.

- [ ] **Passo 1, teste que falha.** Em `test/cron/sync-analytics-metrics-veredito.test.ts`, acrescente
  um caso (use como molde o caso existente que hoje afirma `fatigueAlerts`, perto da linha 253):

  ```ts
  it('total de 90 dias crescendo não gera aviso nem alerta, e o corpo não tem as chaves antigas', async () => {
    // mesmo arranjo do caso de fadiga de hoje: um canal, um vídeo, relatório com views = 5000,
    // youtube_videos devolvendo o vídeo, e respostas "ok" para as demais tabelas
    const res = await GET(pedidoAutenticado())
    const corpo = await res.json()
    expect(corpo).not.toHaveProperty('fatigueAlerts')
    expect(corpo).not.toHaveProperty('notifications')
    expect(tabelasEscritas()).not.toContain('youtube_fatigue_alerts')
    expect(tiposDeAvisoEnviados()).not.toContain('youtube.trending_viral')
    const gravadoEmVideos = ultimoUpdateEm('youtube_videos')
    expect(gravadoEmVideos).not.toHaveProperty('view_count_delta_today')
    expect(gravadoEmVideos).not.toHaveProperty('view_count_yesterday')
  })
  ```

  `pedidoAutenticado`, `tabelasEscritas`, `tiposDeAvisoEnviados` e `ultimoUpdateEm` são os nomes do que
  o arquivo já tem para isso; **use os auxiliares que existem** (o arquivo espiona o cliente do Supabase
  e o `fanOutToSiteAdmins`). Se não houver auxiliar para "tabelas escritas", afirme sobre o espião de
  `from`: `expect(from.mock.calls.map(c => c[0])).not.toContain('youtube_fatigue_alerts')`.
- [ ] **Passo 2.** Rodar o arquivo. Esperado: o caso novo **falha** (as chaves existem).
- [ ] **Passo 3, a rota** (`src/app/api/cron/sync-analytics-metrics/route.ts`; linhas do inventário):
  - imports: sai a linha de `detectViral, getIsoWeek` (7), a de `buildNotification` (8) e a de
    `detectFatigue, filterFatigueCandidates` (10). `fanOutToSiteAdmins` (9) **fica**.
  - interface `ParteAntiga`: saem `notifications: number` e `fatigueAlerts: number` (60-61).
  - sai a declaração `const notifications: Array<…>` (112).
  - o `select` de `youtube_videos` (179) passa a
    `.select('id, youtube_video_id, view_count, published_at')` (`title` só servia ao aviso;
    `view_count` e `published_at` servem aos marcos de views).
  - saem `channelTotalDelta` e `channelAvg48h` (187-190) e `previousPeriod` (206).
  - o `update` de `youtube_videos` (208-213) fica só com `avg_view_duration_seconds` e
    `last_analytics_sync_at`.
  - sai o bloco `if (detectViral(…)) { notifications.push(…) }` (229-241).
  - sai o laço `for (const { siteId, payload } of notifications) { … }` inteiro (312-333).
  - sai a "Phase 3: Fatigue detection" inteira (358-431), com `let fatigueAlerts` e `const siteIds`
    **se `siteIds` não tiver outro uso** (confira com `grep -n siteIds`).
  - no retorno de `parteAntiga` (432-442) e no `corpo` (624-636) saem as duas chaves.
  - o comentário de 75-76 que fala em "avisos e fadiga" é reescrito para o que sobra.
- [ ] **Passo 4, as funções.** `src/lib/youtube/analytics-sync.ts`: saem `computeViewDeltas` (1-8) e
  `detectViral` (10-18); `getIsoWeek` fica. Apagar `src/lib/youtube/ab-fatigue.ts` e
  `test/youtube/ab-fatigue.test.ts`.
- [ ] **Passo 5, os testes.**
  - `test/analytics-sync.test.ts`: saem os blocos de `detectViral` e `computeViewDeltas`; ficam os de
    `getIsoWeek`.
  - `test/cron/sync-analytics-metrics-veredito.test.ts`: saem os casos que só existem para fadiga e
    aviso viral (253-300 e 388-416 no inventário) e as afirmações de `fatigueAlerts`, `notifications`
    (91), `view_count_delta_today: 120` (137) e `[120,80,60]` (192). **Fica** todo caso de veredito por
    falha de banco em outra tabela. Acrescente:

    ```ts
    it('canal sem conexão continua gerando o aviso próprio depois da retirada do aviso viral', async () => {
      // arranjo do caso "sem conexão" que o arquivo já tem
      await GET(pedidoAutenticado())
      expect(tiposDeAvisoEnviados()).toContain('youtube.channel_skipped_no_connection')
    })
    ```

    Se esse caso já existir com outro nome, não duplique: só confira que continua verde.
  - `test/cron/sync-analytics-metrics.test.ts` e `test/api/cron/sync-analytics-metrics.test.ts`: saem os
    campos `view_count_delta_today` / `view_count_yesterday` das fixtures, o mock de `trending_viral`
    (`:63`) e as afirmações sobre `notifications` e `fatigueAlerts`.
- [ ] **Passo 6.** Rodar os seis arquivos e o `tsc`. Esperado: verde, e
  `grep -nE "fatigue|fadiga|detectViral|view_count_delta_today|view_count_yesterday" apps/web/src/app/api/cron/sync-analytics-metrics/route.ts apps/web/src/lib/youtube/analytics-sync.ts`
  sem saída.
- [ ] **Passo 7, commit.**
  `git add -A -- apps/web/src/app/api/cron/sync-analytics-metrics apps/web/src/lib/youtube/analytics-sync.ts apps/web/src/lib/youtube/ab-fatigue.ts apps/web/test/youtube/ab-fatigue.test.ts apps/web/test/analytics-sync.test.ts apps/web/test/cron apps/web/test/api/cron/sync-analytics-metrics.test.ts`
  e `git commit -m "fix: o cron de analytics deixa de detectar fadiga e vídeo em alta sobre o total de 90 dias (A/B Lab P1, Tarefa 1)"`.

### Tarefa 2: a longevidade deixa de inserir alerta

**Arquivos:** `src/lib/youtube/thumbnail-library.ts`, `test/youtube/thumbnail-library.test.ts`.

**Interfaces.** `checkAndPersistLongevity` mantém a assinatura e o valor devolvido; deixa de ler e de
gravar `youtube_fatigue_alerts`. `checkLongevity`, `runLongevityChecks` e `autoImportWinner` não mudam.

- [ ] **Passo 1, teste que falha.** No bloco de `checkAndPersistLongevity` (201-264), troque o caso que
  hoje afirma a inserção por:

  ```ts
  it('resultado fading grava a longevidade e não lê nem insere alerta de fadiga', async () => {
    // arranjo do caso fading de hoje
    await checkAndPersistLongevity(/* mesmos argumentos do caso de hoje */)
    const tabelas = from.mock.calls.map(c => c[0])
    expect(tabelas).toContain('thumbnail_longevity')
    expect(tabelas).not.toContain('youtube_fatigue_alerts')
  })
  ```
- [ ] **Passo 2.** Rodar: falha (a tabela aparece).
- [ ] **Passo 3.** Em `thumbnail-library.ts`, apagar o bloco `if (status === 'fading') { … }` inteiro
  (cerca de 117-146: o `select` de `thumbnail_library`, o `maybeSingle` do alerta pendente e o `insert`
  com `z_score: -2.0`). Se alguma variável só servia a esse bloco, sai junto.
- [ ] **Passo 4.** Rodar o arquivo e o `tsc`: verde.
- [ ] **Passo 5, commit:** `fix: a longevidade de thumbnail deixa de inserir alerta de fadiga (A/B Lab P1, Tarefa 2)`.

### Tarefa 3: o CMS deixa de mostrar fadiga

**Arquivos:** linha 3 da tabela da seção 4.

**Interfaces.** Somem: `getFatigueAlerts` e o tipo `FatigueAlert` (`ab-lab/queries.ts:397-444`),
`dismissFatigueAlert` (`ab-lab/actions.ts:61-81`), a prop `fatigueAlerts` de `AbLabDashboard`, a prop
`hasFatigueAlert` da lista de vídeos. Nada novo nasce.

- [ ] **Passo 1, teste que falha.** Em `test/youtube/ab-lab-dashboard-stubs.test.tsx`, acrescente:

  ```tsx
  it('o painel não mostra cartão nem texto de fadiga', () => {
    render(<AbLabDashboard {...propsBase} />)   // propsBase SEM fatigueAlerts
    expect(screen.queryByText(/fadiga/i)).toBeNull()
    expect(screen.queryByText(/CTR em declínio/i)).toBeNull()
  })
  ```

  E, no teste da sugestão de vídeos de `test/ab-dashboard.test.tsx` (ou no arquivo que hoje cobre o
  "+30%": ache com `grep -rn "CTR em declínio\|1\.3" apps/web/test`), um caso que afirma que **nenhum**
  vídeo sugerido sai com `reason` contendo "CTR em declínio" e que a função não consulta
  `youtube_fatigue_alerts`.
- [ ] **Passo 2.** Rodar: falha (a prop é obrigatória; o texto existe).
- [ ] **Passo 3, A/B Lab.**
  - apagar `ab-lab/_components/fatigue-card.tsx`;
  - `ab-lab-dashboard.tsx`: saem o import do tipo (17), de `dismissFatigueAlert` (25) e de `FatigueCard`
    (26), a prop (44, 59), os manipuladores (127-142) e o bloco de render (344-365);
  - `ab-lab/page.tsx`: sai `getFatigueAlerts` do import (8), do `Promise.all` (22, 28) e a prop (50).
    **Atenção à desestruturação posicional do `Promise.all`:** tire o elemento da lista e da
    desestruturação juntos;
  - `ab-lab/queries.ts`: saem `FatigueAlert` e `getFatigueAlerts` (397-444) e o bloco do "+30%"
    (959-974: o `select` em `youtube_fatigue_alerts`, o `Set` e o laço que faz `score *= 1.3` e troca o
    `reason`);
  - `ab-lab/actions.ts`: sai `dismissFatigueAlert` (61-81) e a resolução automática ao criar teste
    (264-269: o comentário e o `update status='resolved'`).
- [ ] **Passo 4, lista de vídeos.** `videos/page.tsx`: sai `fatigueRes` da desestruturação (18), a
  consulta (37-41), o cálculo (47) e a prop (109). `videos/videos-connected.tsx`: sai a prop (39) e o
  `<span>FADIGA</span>` (297-299).
- [ ] **Passo 5, testes.** `test/ab-dashboard.test.tsx` (2 ocorrências), `ab-lab-dashboard-stubs`
  (prop `fatigueAlerts: []` em 187 e as demais), `test/ab-actions-create.test.ts` (1: a afirmação da
  resolução automática sai) e `test/ab-p3-actions.test.ts` (6: os casos de `dismissFatigueAlert` saem).
- [ ] **Passo 6.** Rodar os quatro arquivos e o `tsc`: verde.
  `grep -rniE "fatigue|fadiga" "apps/web/src/app/cms/(authed)/youtube"` sem saída.
- [ ] **Passo 7, commit:** `fix: o A/B Lab e a lista de vídeos deixam de mostrar fadiga e o "+30%" da sugestão (A/B Lab P1, Tarefa 3)`.

### Tarefa 4: o pipeline deixa de entregar fadiga e de aceitar `trending_viral`

**Arquivos:** linha 4 da tabela da seção 4. **Um commit só** (paridade e Pipeline Integrity).

**Interfaces.** Somem: `GET /api/pipeline/youtube/ab-tests/fatigue-alerts`,
`GET /api/pipeline/youtube/thumbnails/fatigue`; os recursos `pipeline://youtube/ab-fatigue` e
`pipeline://youtube/thumbnails/fatigue`; a ação `get_fatigue_alerts` de `manage_ab_test`;
`getAbFatigueAlerts` e `getThumbnailFatigueAlerts`; o tipo de aviso `trending_viral`
(`NotificationType`, `NOTIFICATION_PRIORITIES`, `TrendingViralInput`, o `case` do construtor, o enum de
`NotificationSchema`). Passa a valer: PATCH com aviso `trending_viral` → **400** e mensagem
`notifications.0.type: tipo de aviso não aceito. "trending_viral" foi desligado em 10/2026: o número que o alimentava era o total de 90 dias, não as views do dia.`

- [ ] **Passo 1, testes que falham.**
  - `test/mcp/mcp-registry-sync.test.ts:28-29`: `youtube(36)` → `youtube(34)`, `128` → `126`
    (comentário e afirmação).
  - `test/lib/pipeline/leitura-rotas.test.ts:19`: `toBeGreaterThanOrEqual(91)` →
    `toBeGreaterThanOrEqual(89)`; e um caso novo:

    ```ts
    it('as duas rotas de fadiga não estão mais na lista de padrões', () => {
      expect(rotaNormalizada('/api/pipeline/youtube/ab-tests/fatigue-alerts')).not.toBe('/api/pipeline/youtube/ab-tests/fatigue-alerts')
      expect(rotaNormalizada('/api/pipeline/youtube/thumbnails/fatigue')).not.toBe('/api/pipeline/youtube/thumbnails/fatigue')
    })
    ```

    **Antes de escrever, leia `rotaNormalizada`** e confira o que ela devolve para caminho fora da
    lista. Se devolver o próprio caminho, o caso acima não prova nada: afirme então direto sobre a lista
    exportada (`PADROES`), que é o que o arquivo tem.
  - `test/mcp/youtube-mcp-tools.test.ts`: saem as duas URIs da lista local (75, 78); `toBe(19)` →
    `toBe(17)` (245); `toBe(6)` → `toBe(5)` (320); sai `get_fatigue_alerts` (289).
  - teste novo do PATCH, no arquivo que já testa `submitIntelRecommendations` (ache com
    `grep -rln "submitIntelRecommendations\|youtube/intelligence" apps/web/test`):

    ```ts
    it('aviso trending_viral é recusado com 400, mensagem em pt-BR, e nada é gravado', async () => {
      const r = await submitIntelRecommendations(ctx, {
        ...corpoValido,
        notifications: [{ type: 'trending_viral', priority: 2, title: 't', message: 'm' }],
      })
      expect(r.ok).toBe(false)
      if (r.ok) return
      expect(r.status).toBe(400)
      expect(r.message).toContain('tipo de aviso não aceito')
      expect(r.message).toContain('trending_viral')
      expect(escritasNoBanco()).toHaveLength(0)
    })
    ```

    Ajuste os nomes de campo de `r` ao `ServiceResult` do arquivo (o `err(code, message, status)` de
    `services/youtube.ts`), e `escritasNoBanco` ao espião que o arquivo já usa.
- [ ] **Passo 2.** Rodar: os quatro falham.
- [ ] **Passo 3, rotas e registro.** Apagar as duas pastas de rota. `api-registry.ts`: saem as entradas
  de `:197` e `:199`; `endpoint_count: 36` → `34` (`:169`). `leitura-rotas.ts`: saem `:72` e `:91`.
- [ ] **Passo 4, serviços.** `services/youtube.ts`: saem `getAbFatigueAlerts` com os tipos dela
  (1647-1675 em diante) e `getThumbnailFatigueAlerts` com os tipos (1865-1916 em diante). Confira por
  `grep` que nenhum outro chamador sobrou.
- [ ] **Passo 5, MCP.** `mcp/resources.ts`: saem os dois recursos (664-680 e 727-743); se os
  comentários numerados dos recursos ficarem com buraco, renumere. `mcp/tools.ts`: sai
  `get_fatigue_alerts` do enum (664), da descrição da ação (665) e "fatigue alerts" da descrição da
  ferramenta (952). `mcp/services/ab-tests.ts`: sai o `case` (173-176) e o nome na mensagem de erro
  (193). `mcp/prompts.ts:1209`: sai `| trending_viral` da lista de tipos.
- [ ] **Passo 6, o tipo de aviso.** `notification-service.ts`: sai `'trending_viral'` da união (3), a
  chave de `NOTIFICATION_PRIORITIES` (14), `TrendingViralInput` (91-98) e sua entrada na união de
  entradas (119), e o `case` (189-199). `intelligence-schemas.ts:31-34`: o enum fica sem o valor e
  ganha a mensagem:

  ```ts
  type: z.enum([
    'grade_drop', 'ctr_drop', 'monitoring_alert', 'ab_test_completed',
    'retest_suggested', 'optimization_available', 'optimization_resolved',
  ], {
    errorMap: (issue, ctx) => ({
      message: ctx.data === 'trending_viral'
        ? 'tipo de aviso não aceito. "trending_viral" foi desligado em 10/2026: o número que o alimentava era o total de 90 dias, não as views do dia.'
        : `tipo de aviso não aceito: ${String(ctx.data)}`,
    }),
  }),
  ```
- [ ] **Passo 7, doc do Cowork** (`data/pipeline-docs/cowork-docs-youtube.md`): `:12` perde "viral
  detection"; sai a linha `trending_viral` da tabela de tipos (`:280`); a frase de `:1304` perde
  "fatigue alerts" e a de `:1508` perde "análise de fadiga"; saem as seções
  `ab-tests/fatigue-alerts` (1396-1427) e `thumbnails/fatigue` (1544-1581). No lugar da linha da tabela
  de tipos, **uma** frase: "`trending_viral` foi desligado em 10/2026 e é recusado com 400."
- [ ] **Passo 8, demais testes.** `test/analytics-notification-service.test.ts` (saem os casos de
  `trending_viral`); `test/api/pipeline/youtube-thumbnails.test.ts` (sai o bloco 173-267);
  `test/api/pipeline/youtube-ab-extended.test.ts` (saem os casos de `fatigue-alerts`);
  `test/mcp/youtube-cowork-docs.test.ts:209` (sai a afirmação sobre a seção de fadiga).
- [ ] **Passo 9.** Rodar os oito arquivos de teste, mais `test/lib/pipeline/api-registry.test.ts` e
  `test/mcp/mcp-schema-parity.test.ts` (devem passar **sem** `-u`; se o segundo reprovar, ver D2), e o
  `tsc`. Depois:
  `grep -rniE "fatigue|fadiga|trending_viral" apps/web/src/lib/pipeline apps/web/src/app/api/pipeline apps/web/data` sem saída.
- [ ] **Passo 10, commit:** `fix: o pipeline e o MCP deixam de entregar alerta de fadiga (36 para 34 rotas no domínio YouTube) e recusam o aviso trending_viral (A/B Lab P1, Tarefa 4)`.

### Tarefa 5: documentos

- [ ] `docs/ops/youtube-coleta-canais-proprios-runbook.md`: `:86` (a lista de chaves da resposta perde
  `fatigueAlerts` e `notifications`), `:454` (sai a nota `fadiga: <causa>` do veredito) e `:856` (o item
  "Bug dormente na fadiga" ganha "(fase removida em 10/2026, A/B Lab P1)").
- [ ] `docs/cowork-youtube-intelligence-reference.md`: `:54-55` (saem `view_count_yesterday` e
  `view_count_delta_today` do JSON de exemplo) e `:197` (sai a linha `trending_viral`).
  **Este arquivo casa `docs/cowork-*` e dispara o hook de seed no pre-commit**; ele não está em
  `ENTRIES` do script, então o seed roda e não muda nada. Na árvore própria não há `apps/web/.env.local`
  e o hook pula o seed: está certo.
- [ ] `docs/ab-testing-system-reference.md:220`: sai `trending_viral`.
- [ ] `apps/web/test/e2e/youtube-mcp-e2e-plan.md`: saem as linhas `:115`, `:123`, `:251`, `:288`, `:289`.
- [ ] Commit: `docs: runbook da coleta, referências do Cowork e roteiro manual do MCP sem fadiga nem vídeo em alta (A/B Lab P1, Tarefa 5)`.

### Tarefa 6: prova local, capturas e revisão de tela

- [ ] **Aceite 1 (grep).**
  `grep -rniE "fatigue|fadiga|detectViral|trending_viral" apps/web/src apps/web/data | grep -v "types/database.types.ts"`
  → a única saída permitida é a mensagem de recusa de `intelligence-schemas.ts` e a frase do doc
  (Tarefa 4, passos 6 e 7). Qualquer outra linha: volta à tarefa dona.
- [ ] `npx tsc --noEmit -p apps/web` verde; `npx tsc --noEmit -p apps/api` verde.
- [ ] Suíte inteira, em background, saída em arquivo:
  `cd apps/web && npx vitest run > /tmp/ab-p1-suite.log 2>&1` (cerca de 160 s). No contexto, só as
  falhas. **Esperado: as mesmas falhas da base de `origin/staging`, se houver, e nenhuma nova.**
- [ ] `npm run build:web > /tmp/ab-p1-build.log 2>&1` (mudança que apaga rotas e props de Server
  Component: rode o build; é a regra "mudança arriscada" do `CLAUDE.md`).
- [ ] **Gio (`gio-qa`, Sonnet, `medium`)**, na árvore própria, com o servidor local dele: capturas de
  **antes** (em `origin/staging`) e **depois** do painel do A/B Lab e da lista de vídeos, a 1440 px e a
  390 px, em `docs/superpowers/mockups/2026-10-13-ab-lab-p1-retirada/shots/`. Para o "antes" mostrar o
  cartão, a semente local precisa de uma linha `pending` em `youtube_fatigue_alerts`: o Gio diz como a
  criou. Veredito em texto: o que sumiu, e se sobrou buraco de layout onde o cartão ficava.
  **Porta e banco:** o outro terminal usa a 3997 e o banco 54321/54322; o Gio usa outra porta e diz qual.
- [ ] **Logan e Naksu (Sonnet, `medium`), uma passada só, em paralelo, sobre as capturas:** o painel
  sem o cartão continua legível (ordem, espaço, nada órfão)? Achado vira conserto na Tarefa 3; não vira
  tela nova.
- [ ] Capturas ao dono, com uma linha por tela dizendo o que saiu.

### Tarefa 7: envio

- [ ] Revisão do lote por **Phil e Yannis** (Opus, `medium`) sobre o `git diff origin/staging...lote/ab-p1`
  antes do push; consertar até acordo.
- [ ] As três conferências da regra 1 da reconciliação, escritas no relatório do envio: (i) nenhuma
  migration não aplicada nesta árvore (`git diff --stat origin/staging lote/ab-p1 -- supabase/` vazio);
  (ii) e (iii) nenhum arquivo de `test/integration/` mudou (`git diff --stat … -- apps/web/test/integration` vazio).
- [ ] `git fetch origin && git merge origin/staging` **na árvore própria**, se o remoto andou; refazer
  `tsc` e a suíte se a junção trouxe arquivo do escopo.
- [ ] `bash -c 'git push origin lote/ab-p1:staging'`. Acompanhar a CI (`gh run list --branch staging -L 3`).
- [ ] CI verde → promoção a `main` e conferência do deploy da Vercel.
- [ ] No `staging` local, **com o outro terminal avisado e parado**: `git merge origin/staging`;
  resolver os três conflitos previstos (seção 1); `tsc` do web antes de liberar o terminal.
- [ ] Entregar ao controlador da A5 a tabela de avisos da seção 1.
- [ ] `git worktree remove ../bythiago-ab-p1` só depois da Tarefa 8.

### Tarefa 8: produção (o agente prepara, o dono confere)

Consultas por `npx supabase db query --linked --agent=yes -o json`, **só select**, com autorização do
dono na sessão; se o classificador negar, o dono roda.

- [ ] **C1, antes do `update`:**
  `select status, count(*) from youtube_fatigue_alerts group by 1 order by 1;`
- [ ] **O `update` do dono (resposta 8), uma linha:**
  `update youtube_fatigue_alerts set status = 'dismissed' where status = 'pending';`
  Antes de entregar, conferir no arquivo da migration `20260531000006_youtube_fatigue_alerts.sql` que
  `'dismissed'` é valor aceito pelo CHECK de `status` e se existe coluna de data de dispensa a preencher.
- [ ] **C2, no dia seguinte ao deploy, depois das 12:10 UTC:**
  `select max(created_at) from youtube_fatigue_alerts;` → anterior ao deploy.
  `select count(*) from yt_notifications where type = 'trending_viral' and created_at > '<instante do deploy>';` → 0
  (confira o nome da tabela e da coluna de tipo em `youtube-channel-remove.test.ts:167`; os 10 avisos
  antigos ficam, resposta 8).
- [ ] **C3 (Phil):**
  `select ran_at, ms_total, ms_existente from yt_own_collection_runs order by ran_at desc limit 7;`
  → a execução de depois do deploy sem `falhas`, e `ms_existente` menor ou igual ao das anteriores. O
  quanto caiu é a medida que falta para a conta de orçamento do cron (reconciliação da A5, seção 5).
- [ ] **C4:** `/api/health` sem falha do `sync-analytics-metrics` e do `ab-evaluate` na execução seguinte.
- [ ] **C5, paridade:** `curl -s -o /dev/null -w '%{http_code}'` nas duas rotas com a chave do pipeline
  → `404` e `404`; a listagem de recursos do MCP não traz `ab-fatigue` nem `thumbnails/fatigue`, pelo
  Cowork e pelo Claude Code.

---

## 6. Aceite (o do spec, emendado pela Hanna; o Gio fecha a redação na revisão)

| # | Critério | Onde se prova |
|---|---|---|
| 1 | O `grep` do spec só acha `database.types.ts`, a mensagem de recusa e a frase do doc | Tarefa 6 |
| 2 | Cron com total de 90 dias: nenhum aviso, nada em `youtube_fatigue_alerts`, sem as duas colunas no `update` | Tarefa 1, passo 1 |
| 3 | `checkAndPersistLongevity` com `fading` não insere alerta | Tarefa 2 |
| 4 | Registry e MCP verdes com 34; as duas rotas dão 404 | Tarefa 4; Tarefa 8, C5 |
| 5 | Aviso `trending_viral` pelo pipeline → **400** com a mensagem em pt-BR, nada gravado (desvio D1) | Tarefa 4 |
| P1-P1 | Produção: o dono abre o A/B Lab e a lista de vídeos e não vê o cartão, o selo "FADIGA" nem o "+30%" | dono, depois do deploy |
| P1-P2 | Produção: a execução seguinte do cron termina sem falha e nenhuma linha nova entra em `youtube_fatigue_alerts` | Tarefa 8, C2 a C4 |
| P1-P3 | Paridade: 404 nas duas rotas e os dois recursos fora da listagem, pelos dois caminhos | Tarefa 8, C5 |
| P1-P4 | Falha em verde: nenhum leitor das chaves `fatigueAlerts` e `notifications` da resposta do cron ("nenhum, conferido por grep": seção 0) | seção 0; Yannis reconfere |

## 7. O que acontece quando o dado não existe, e em cada falha

| Situação | Depois de P1 |
|---|---|
| Cowork chama `GET …/ab-tests/fatigue-alerts` ou `…/thumbnails/fatigue` | 404. Não é lista vazia |
| Cowork chama `manage_ab_test` com `action: 'get_fatigue_alerts'` | erro de validação do enum da ferramenta, antes de qualquer leitura |
| Cowork lê `pipeline://youtube/ab-fatigue` | recurso inexistente |
| Cowork manda aviso `trending_viral` | 400 com a mensagem; **o PATCH inteiro é recusado** (é assim para todo erro de schema hoje): recomendações e coaching do mesmo corpo não são gravados. O doc diz isso |
| Linhas `pending` antigas em `youtube_fatigue_alerts` | ficam até o dono rodar o `update`; ninguém as lê |
| Avisos `youtube.trending_viral` antigos | ficam no histórico; o CMS não tem rótulo por tipo para eles (inventário) |
| Deploy antigo ainda de pé (skew) chama a ação `dismissFatigueAlert` | a ação não existe no deploy novo: erro de Server Action na aba velha; recarregar resolve. Sem dado perdido |
| `git revert` de P1 | volta tudo; nada no banco mudou (o `update` do dono não é desfeito e não precisa) |

## 8. Riscos que ficam, sem suavizar

- **O PATCH do Cowork passa a recusar um corpo que ontem aceitava.** Se algum prompt salvo do Cowork
  ainda gera `trending_viral`, a primeira entrega depois do deploy é recusada inteira. Mitigação: a
  mensagem diz o que tirar; `mcp/prompts.ts:1209` e o doc saem no mesmo commit. **Não conferido:** se a
  memória do Cowork no banco cita o tipo (é dado dele, o seed não a sobrescreve).
- **A junção de volta ao `staging` local** mexe no teste de veredito, que dois planos da A5 também
  editam. É conflito de texto, não de lógica, mas é manual.
- **O tempo que o cron ganha não foi medido.** Não se promete folga à A5 antes da C3.
- **O teste do Passo 1 da Tarefa 4 pode não provar nada** se `rotaNormalizada` devolver o próprio
  caminho para rota desconhecida; o passo manda conferir antes.
- **Trechos de teste deste plano são moldes**, escritos sem ler os arquivos de teste: os nomes dos
  auxiliares têm de ser trocados pelos que existem. O que não muda é a lista de afirmações.

## 9. Perguntas abertas para a revisão

1. **Yannis:** árvore de trabalho própria (seção 1) ou `staging` local com remontagem? E o desvio D1
   (400 em vez de 422)?
2. **Phil:** a C3 basta para devolver à A5 a medida do cron? Alguma leitura das duas colunas de
   `youtube_videos` fora do repositório (forja, Cowork por SQL)?
3. **Gio:** como se prova P1-P1 e P1-P3 sem depender só do olho do dono; e como criar o "antes" com o
   cartão visível na semente local.
4. **Hanna:** o `update` do dono (resposta 8) trava o envio ou vai depois? (Recomendação: depois; não
   muda tela.)
