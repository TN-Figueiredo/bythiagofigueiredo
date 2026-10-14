# A/B Lab honesto, P1: fadiga e "vídeo em alta" saem (plano de implementação)

Escrito em 13/10/2026 (noite). **Emenda 1 aplicada: responde à rodada 1 de revisão de Phil, Yannis e Gio** (pareceres `.superpowers/sdd/ab-lab/revisao-r1-{phil,yannis,gio}.md`, decisões em `emenda-1-decisoes-do-controlador.md`, tabela achado a achado em `resposta-r1-p1.md`). **Emenda 2 aplicada: responde à rodada 2 de Gio, Yannis e Phil e ao parecer 02 da Hanna** (`revisao-r2-{gio,yannis,phil}.md`, `hanna-parecer-02-fecho-p1-p2.md`, decisões em `emenda-2-decisoes-do-controlador.md`, tabela em `resposta-r2-p1.md`). **Estado: acordo de Phil, Yannis, Gio e Hanna; espera o "pode" do dono.** Cada trecho mudado leva a marca `(emenda 1: <id>)` ou `(emenda 2: <id>)`.
Spec: `docs/superpowers/specs/2026-10-07-ab-lab-honesto-design.md` (v6, seção 4.3, bloco P1 da seção 1,
aceite 1 a 5 e "Respostas do dono (13/10/2026)" no fim). Inventário de código, lido em 13/10 no HEAD
`bc5adea94`: `.superpowers/sdd/ab-lab/inventario-p1.md` (toda linha citada aqui vem dele; **quem executa
reconfere por `grep` no dia**). Parecer da Hanna sobre a ordem: `.superpowers/sdd/ab-lab/hanna-parecer-01-plano-de-trabalho.md`.

> **Para quem executa:** use `superpowers:subagent-driven-development`, tarefa por tarefa. Passos com
> caixa (`- [ ]`). Sonnet, effort `medium` em tudo; `high` em nenhuma tarefa deste plano (emenda 2:
> decisão 14; a única exceção dos dois planos é a revisão da Tarefa 1 da P2, e fica no plano da P2).

> **Quem testa (decisão do dono, 14/10/2026; vale sobre qualquer trecho deste plano):** testes, prova local,
> capturas, conferências de produção e paridade são do controlador com o Gio. Onde este plano diz que o
> dono abre, confere, cola um texto no Cowork ou testa, quem faz é o controlador com o Gio, e o dono só
> confirma o resultado. Continuam com o dono: aplicar migration em produção, colar o `update` e o
> `pg_dump`, autorizar escrita no canal do YouTube, aprovar capturas e mockup, dar o "pode". Regras e
> estado: `docs/superpowers/plans/2026-10-14-ab-lab-roteiro-e-horas.md`.

**Objetivo, em uma frase.** Parar de gravar, mostrar e entregar ao Cowork dois sinais que leem como
"views do dia" um número que é o total de 90 dias: o alerta de fadiga e o aviso "vídeo em alta".

**Como.** É retirada pura: nenhuma tabela, coluna, migration, tela nova ou variável de ambiente. Sai o
código que grava (duas fases do cron das 12:00 UTC e a inserção da longevidade), o que lê (cartão e
selo no CMS, "+30%" na sugestão) e o que entrega (duas rotas do pipeline, dois recursos e uma ação do
MCP, um tipo de aviso). A tabela `youtube_fatigue_alerts` e as colunas `view_count_delta_today` e
`view_count_yesterday` **ficam no banco**, sem leitor nem gravador.

**Stack.** Next.js 16, TypeScript estrito, Vitest, zod 3.25.76 instalado, API v3 (emenda 1: S-C5) ~~zod 3.24~~.

## Fica FORA deste plano

- A tabela "Candidatos a teste" e o detector de queda de CTR (spec próprio, não escrito).
- Apagar `youtube_fatigue_alerts` ou as duas colunas de `youtube_videos` (a função de remover canal e o
  teste `test/integration/youtube-channel-remove.test.ts` dependem da tabela).
- A longevidade de thumbnail em si (`checkLongevity`, `runLongevityChecks`, o `upsert` em
  `thumbnail_longevity`): **fica** (resposta 9 do dono). Só a inserção do alerta sai.
- O `upsert` de `youtube_video_analytics.views` com o total de 90 dias: continua (é da coleta).
- Tudo de P2 (avaliação automática), P3 (descrição) e P4 (restauração). **P1 não abre
  `app/api/cron/ab-evaluate/route.ts`** (a fase 5 dela continua chamando `runLongevityChecks`).
- **Backlog (emenda 1: D-P1-S1):** dar fim às duas colunas de `youtube_videos` e à tabela. As colunas
  ficam congeladas, sem leitor nem gravador, com guarda por `grep` (Tarefa 6); `drop column
  view_count_delta_today, view_count_yesterday` entra na próxima migration que tocar `youtube_videos`
  (a Migration B da P3 serve). O dono **não** as zera à mão agora (`update` em todas as linhas, dispara
  `updated_at`, não compra nada). `youtube_fatigue_alerts` fica enquanto o teste de remover canal a usar;
  crescimento depois de P1 é zero linha por dia.
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
| zod | declarado `^3.24.2` (`apps/web/package.json:100`); **instalado 3.25.76**, `import { z } from 'zod'` continua a API v3 (emenda 1: S-C5) | sonda do Yannis |

**Não medido (ninguém leu produção):** quantas linhas `pending` existem em `youtube_fatigue_alerts`;
quanto tempo as duas fases gastam hoje no cron. A conta do tempo é do Phil, com
`yt_own_collection_runs.ms_existente` de antes e de depois (Tarefa 8, C3).

## 1. Onde se trabalha e como se envia

**Decidido (emenda 1: S-C6, confirmado pelo Yannis):** P1 é implementada numa **árvore de trabalho
própria**, criada de `origin/staging`, e não no `staging` local. ~~Recomendação, a confirmar com Yannis.~~

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

**Regra do `.env.local` (emenda 1: S-C2).** **Nunca existe `apps/web/.env.local` na árvore do lote**: o
hook de pre-commit semearia a referência do Cowork em produção a partir de código não enviado (todo
commit que toque `api-registry.ts`, `data/pipeline-docs/` ou `docs/cowork-*` dispara
`scripts/seed-pipeline-reference.ts` contra o banco de produção). O servidor local do Gio e o `build:web`
da Tarefa 6 leem as variáveis de `apps/web/.env.development.local` (o Next carrega em `dev`; o hook não
olha esse arquivo), **apagado ao fim da Tarefa 6**. (emenda 2: S2-R2-2) O `next build` roda em modo de produção e **não**
lê o `.env.development.local`: para o `build:web`, as variáveis vêm de `apps/web/.env.production.local`
(cópia do `.env.local` do repositório principal; o hook só olha `apps/web/.env.local`; conferir
`git check-ignore apps/web/.env.production.local`), apagado junto com o `.env.development.local` ao fim
da Tarefa 6. Se ainda faltar variável, passá-las na linha de comando, nunca com o `.env.local` na árvore.

**Envio (Tarefa 7):** as três conferências da regra 1 (para P1 as três dão zero por construção: não há
migration nem teste de integração novo), `npx tsc --noEmit` e a suíte na árvore, push por refspec
(`bash -c 'git push origin lote/ab-p1:staging'`), CI verde, promoção a `main` (do agente, pela regra do
dono de 10/10), e depois, no `staging` local e **com o outro terminal avisado e sem agente commitando**,
`git merge origin/staging` (junção, nunca rebase). **P2 nasce de `lote/ab-p1`** assim que a P1 passar na
prova local (Tarefa 6), sem esperar `origin/staging` (emenda 1: decisão transversal 2); o envio continua
em série, P1 e depois P2.

**Conflitos previstos na junção** (resolve o controlador, nunca um agente sozinho):
- `test/cron/sync-analytics-metrics-veredito.test.ts`: o local tem +61 linhas da E11 e da E6/E8; P1
  apaga os casos de fadiga e de aviso viral. Regra: ficam todos os casos da A5; saem só as afirmações
  sobre `fatigueAlerts`, `notifications`, `view_count_delta_today` e `view_count_yesterday`.
- `cowork-docs-youtube.md`: 4 linhas locais, outro trecho.
- `docs/ops/youtube-coleta-canais-proprios-runbook.md`: +118 locais; P1 mexe em 3 linhas (Tarefa 5).
- (emenda 1: S-C6) A resolução do conflito do teste de veredito fica só no commit de junção; os commits
  locais da A5 que tocam esses três arquivos (14 em 13/10, por
  `git log origin/staging..staging -- <os três>`) conflitam **de novo** quando o lote deles for montado
  por `cherry-pick` sobre um `origin/staging` que já tem P1. Vai na tabela de avisos à A5 (abaixo).

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
| Commits locais da A5 que tocam `sync-analytics-metrics-veredito.test.ts`, `cowork-docs-youtube.md` e o runbook da coleta (emenda 1: S-C6) | conflitam no `cherry-pick` sobre `origin/staging`; a resolução certa é a do commit de junção `<hash>` (preencher no dia) |

## 2. O que é do dono

1. Ver as capturas de antes e depois (Tarefa 6) e dizer "pode". A retirada sem mockup já foi autorizada
   (resposta 10); as capturas são para ele conferir que só saiu o que devia.
2. Colar a consulta e o `update` da Tarefa 8 (resposta 8).
3. Abrir o A/B Lab e a lista de vídeos em produção, logado, depois do deploy (aceite P1-P1).
4. (emenda 2: H2-H6) Colar **uma vez**, no Cowork e no Claude Code, depois do deploy da **P2**, o texto de
   conferência que está na seção 2 do plano da P2; ele cobre P1-P3 e P2-P3. Agente não opera o Cowork.
5. (emenda 2: H2-H7) A conferência D+7 da C3 (mediana de `ms_existente`) tem data e responsável no ledger
   `.superpowers/sdd/ab-lab/progress.md` (nasce na Tarefa 0): "D+7 = <data>, quem roda = <nome>".

**Decidir (duas linhas; um "pode" geral aceita as duas) (emenda 2: decisão 12, H2-12):**

| # | Pergunta | Padrão recomendado |
|---|---|---|
| 13 | A P2 pode tirar também, sem mockup, o painel de critérios, a "probabilidade de ser a melhor" e as médias de confiança e de lift (a Tarefa 3b da P2)? Você vê as capturas de antes e depois | Sim. Sem isso, a etapa de telas inteira vira obrigatória antes do primeiro teste. Pergunta da P2; aqui só para o dono ter as duas juntas |
| 14 | Há data para o primeiro teste A/B? | Sem data: segue P3 e depois P4, e você avisa antes de iniciar. Com data curta: sobe primeiro a parte da P4 que protege o vídeo |

**Saber (não precisa responder) (emenda 2: decisão 12, H2-12):**

- Até a P4 estar em produção, não inicie teste A/B: a tela não impede, é combinado.
- Depois da P2, teste que passa da duração máxima encerra sem vencedor, mesmo com critérios verdes.
- O Cowork passa a receber recusa (400) se mandar aviso de "vídeo em alta" (P1) e `null` onde recebia
  impressões, confiança e lift (P2). Não foi conferido se algum prompt ou memória salva dele ainda usa isso.
- O trabalho é feito em galho local próprio (`lote/ab-p1`, depois `lote/ab-p2`), fora da regra dele de
  "sempre em `staging`", para não pisar no outro terminal que implementa a A5 no `staging` local. O push
  continua indo a `staging`; o galho é local e some depois da Tarefa 8.
- O `update` da Tarefa 8 **não trava o envio**: trava só o fecho do critério P1-P2.

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
`src/app/cms/(authed)/youtube/`. (emenda 1: S-C1) ~~Tarefas 1 a 5 são independentes entre si e podem ser
feitas em qualquer ordem.~~ **A Tarefa 4 vem depois da 1** (a 4 tira o tipo `trending_viral` que a rota do
cron ainda constrói até a 1; 4 antes da 1 não compila); 2, 3 e 5 são livres. Na ordem escrita cada commit
compila sozinho. **Uma por vez, na mesma árvore**: não há ganho em paralelizar retirada no mesmo conjunto de testes.

---

## 5. As tarefas

Em todas: rode os testes **dos arquivos da tarefa**, com saída em arquivo:
`cd apps/web && npx vitest run <arquivos> > /tmp/ab-p1-tN.log 2>&1; tail -30 /tmp/ab-p1-tN.log`.
E `npx tsc --noEmit -p apps/web > /tmp/ab-p1-tsc.log 2>&1; tail -20 /tmp/ab-p1-tsc.log` antes do commit.

### Tarefa 0: árvore e linha de base

- [ ] Criar a árvore (seção 1). Conferir `git -C ../bythiago-ab-p1 status --short` vazio, e que
  `ls ../bythiago-ab-p1/apps/web/.env.local` **não existe** (emenda 1: S-C2).
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
    // (emenda 1: G-P1-C1) afirmação positiva: prova que o cron andou até o update de youtube_videos
    expect(gravadoEmVideos).toHaveProperty('avg_view_duration_seconds')
    expect(gravadoEmVideos).toHaveProperty('last_analytics_sync_at')
  })
  ```

  `pedidoAutenticado`, `tabelasEscritas`, `tiposDeAvisoEnviados` e `ultimoUpdateEm` são os nomes do que
  o arquivo já tem para isso; **use os auxiliares que existem** (o arquivo espiona o cliente do Supabase
  e o `fanOutToSiteAdmins`). Se não houver auxiliar para "tabelas escritas", afirme sobre o espião de
  `from`: `expect(from.mock.calls.map(c => c[0])).not.toContain('youtube_fatigue_alerts')`.
- [ ] **Passo 2.** Rodar o arquivo. Esperado: o caso novo **falha** (as chaves existem).
  **Prova de que o arranjo exercita o caminho antigo (emenda 1: G-P1-C1):** no commit-base, rode o mesmo
  corpo com as quatro afirmações de ausência **invertidas** (`toHaveProperty`/`toContain` no lugar de
  `not.…`) e exija **verde**; só então apague a inversão. Sem isso, as afirmações de ausência passam
  vazias se o arranjo nunca chegar à fase de fadiga.
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
    // (emenda 1: G-P1-C2) queryAllByText, porque queryByText lança com mais de uma ocorrência
    expect(screen.queryAllByText(/fadiga/i)).toHaveLength(0)
    expect(screen.queryAllByText(/CTR em declínio/i)).toHaveLength(0)
  })
  ```

  (emenda 1: S-S3, G-P1-C2) **Este teste é guarda, não prova do aceite**: a prop deixa de existir, quem
  prova é o `tsc` e o `grep`; sem o alerta, ele também passa no base. A prova de discriminação está nos
  testes de consulta abaixo e na captura com a semente da Tarefa 6.

  E, no teste da sugestão de vídeos de `test/ab-dashboard.test.tsx` (ou no arquivo que hoje cobre o
  "+30%": ache com `grep -rn "CTR em declínio\|1\.3" apps/web/test`), um caso que afirma que **nenhum**
  vídeo sugerido sai com `reason` contendo "CTR em declínio" e que a função não consulta
  `youtube_fatigue_alerts`. (emenda 1: G-P1-C2, S-S3) O arranjo **inclui um alerta `pending` para um dos
  vídeos** (cliente falso que devolve a linha `pending` para `youtube_fatigue_alerts`): sem ele o caso
  passa também no base. A afirmação é `from.mock.calls.map(c => c[0])` sem `'youtube_fatigue_alerts'`.
  O mesmo vale para a página de vídeos: caso de teste de `videos/page.tsx` com o mesmo cliente falso e a
  mesma afirmação (a tarefa já tira a consulta; o caso a prende).
- [ ] **Passo 2.** Rodar: falha (a prop é obrigatória; o texto existe; a consulta à tabela acontece).
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
**Depende da Tarefa 1** (emenda 1: S-C1): só começa com o commit da Tarefa 1 feito.

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
    `toBeGreaterThanOrEqual(89)`; e um caso novo (emenda 1: S-C4; a função chama-se `padraoDaRota`,
    devolve `string | null`; ~~`rotaNormalizada`~~):

    ```ts
    it('as duas rotas de fadiga saíram da lista de padrões', () => {
      // ab-tests/fatigue-alerts cai na rota dinâmica irmã; thumbnails/fatigue não tem irmã
      expect(padraoDaRota('/api/pipeline/youtube/ab-tests/fatigue-alerts')).toBe('/api/pipeline/youtube/ab-tests/[id]')
      expect(padraoDaRota('/api/pipeline/youtube/thumbnails/fatigue')).toBeNull()
    })
    ```

    Por sugestão do Gio (G-P1 sugestão), some uma afirmação direta sobre a lista exportada (`PADROES`):
    nenhum padrão casa com as duas URLs.
  - `test/mcp/youtube-mcp-tools.test.ts`: saem as duas URIs da lista local (75, 78); `toBe(19)` →
    `toBe(17)` (245); `toBe(6)` → `toBe(5)` (320); sai `get_fatigue_alerts` (289).
  - teste novo do PATCH (emenda 1: S-C3). **Arquivo novo:**
    `test/lib/pipeline/services/youtube-intelligence-service.test.ts` (unitário). ~~No arquivo que o
    `grep` achar~~: aquele `grep` devolve quatro arquivos, um deles
    `test/integration/youtube-intelligence-forja.test.ts`, e teste novo ali quebra a conferência (ii)/(iii)
    da regra 1 e nem roda localmente. Contrato real: `err()` **lança** `PipelineServiceError`
    (`services/types.ts:55-57`) e o sucesso é `{ data, status }`; não existe `r.ok`.

    ```ts
    it('aviso trending_viral é recusado com 400, mensagem em pt-BR, e nada é gravado', async () => {
      await expect(submitIntelRecommendations(ctx, {
        ...corpoValido,
        notifications: [{ type: 'trending_viral', priority: 2, title: 't', message: 'm' }],
      })).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        status: 400,
        message: expect.stringContaining('notifications.0.type: tipo de aviso não aceito. "trending_viral" foi desligado'),
      })
      expect(from).not.toHaveBeenCalled()   // espião de supabase.from do arquivo: a recusa é antes de qualquer ida ao banco
    })

    // (emenda 1: S-C5) o campo ausente não vira "não aceito: undefined"
    it('type ausente mantém a mensagem padrão do zod', async () => {
      await expect(submitIntelRecommendations(ctx, {
        ...corpoValido,
        notifications: [{ priority: 2, title: 't', message: 'm' }],
      })).rejects.toMatchObject({
        status: 400,
        message: expect.not.stringContaining('undefined'),
      })
    })
    ```

    Ajuste `ctx`, `corpoValido` e `from` aos nomes do arquivo novo (o espião de `supabase.from` é criado
    nele).
- [ ] **Passo 2.** (emenda 2: G2-P1-N1, S2-R2-1) Rodar: **os três primeiros falham** (a contagem do
  registro, o `padraoDaRota` e o `trending_viral` do PATCH: o enum de hoje aceita `trending_viral`, então
  o caso do PATCH falha por não ser rejeitado). **O do `type` ausente passa também no base** (hoje o zod
  devolve a mensagem padrão, sem "undefined"): é guarda contra o `errorMap` novo trocar a mensagem do
  campo ausente. Confira que ele falharia se o `errorMap` devolvesse `not accepted: ${issue.received}`
  sem o `if (issue.code !== 'invalid_enum_value')` (tire a linha uma vez, veja falhar, devolva a linha).
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
  ganha a mensagem (emenda 1: S-C5; o molde anterior trocava a mensagem dos outros erros do campo, e o
  campo ausente virava "não aceito: undefined"):

  ```ts
  type: z.enum([
    'grade_drop', 'ctr_drop', 'monitoring_alert', 'ab_test_completed',
    'retest_suggested', 'optimization_available', 'optimization_resolved',
  ], {
    errorMap: (issue, ctx) => {
      if (issue.code !== 'invalid_enum_value') return { message: ctx.defaultError }
      return {
        message: issue.received === 'trending_viral'
          ? 'tipo de aviso não aceito. "trending_viral" foi desligado em 10/2026: o número que o alimentava era o total de 90 dias, não as views do dia.'
          : `tipo de aviso não aceito: ${String(issue.received)}`,
      }
    },
  }),
  ```

  Limite conhecido (também na seção 7): a mensagem do PATCH leva só os 3 primeiros erros
  (`.slice(0, 3)`); um corpo com três erros antes de `notifications` não mostra a frase.
- [ ] **Passo 7, doc do Cowork** (`data/pipeline-docs/cowork-docs-youtube.md`): `:12` perde "viral
  detection"; sai a linha `trending_viral` da tabela de tipos (`:280`); a frase de `:1304` perde
  "fatigue alerts" e a de `:1508` perde "análise de fadiga"; saem as seções
  `ab-tests/fatigue-alerts` (1396-1427) e `thumbnails/fatigue` (1544-1581). No lugar da linha da tabela
  de tipos, **uma** frase, com a instrução de reenvio (emenda 1: D-P1-S2, S-C4): "`trending_viral` foi
  desligado em 10/2026 e é recusado com 400; o PATCH inteiro é recusado: tire o aviso e reenvie o corpo
  inteiro." É uma linha só e contém "foi desligado em 10/2026" (o portão do passo 9 depende disso);
  nenhuma seção nova no lugar das duas apagadas.
- [ ] **Passo 8, demais testes.** `test/analytics-notification-service.test.ts` (saem os casos de
  `trending_viral`); `test/api/pipeline/youtube-thumbnails.test.ts` (sai o bloco 173-267);
  `test/api/pipeline/youtube-ab-extended.test.ts` (saem os casos de `fatigue-alerts`);
  `test/mcp/youtube-cowork-docs.test.ts:209` (sai a afirmação sobre a seção de fadiga).
- [ ] **Passo 9.** Rodar os oito arquivos de teste, mais `test/lib/pipeline/api-registry.test.ts` e
  `test/mcp/mcp-schema-parity.test.ts` (devem passar **sem** `-u`; se o segundo reprovar, ver D2), e o
  `tsc`, mais o arquivo novo `test/lib/pipeline/services/youtube-intelligence-service.test.ts`. Depois
  (emenda 1: G-P1-B1; a frase do passo 7 mora em `apps/web/data`, então o portão antigo "sem saída"
  reprovaria para sempre):
  `grep -rniE "fatigue|fadiga|trending_viral" apps/web/src/lib/pipeline apps/web/src/app/api/pipeline apps/web/data | grep -v 'foi desligado em 10/2026'`
  **sem saída**. A única linha que o `grep` sem filtro acha, neste escopo, é a do doc com "foi desligado
  em 10/2026" (a do `intelligence-schemas.ts` fica fora destes diretórios e entra no portão da Tarefa 6).
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
  → (emenda 1: G-P1-B1) a saída tem de ser **exatamente estas três linhas**, e nenhuma outra
  ~~"a mensagem de recusa e a frase do doc"~~:
  1. `apps/web/src/lib/youtube/intelligence-schemas.ts`, a linha `message: issue.received === 'trending_viral'` do `errorMap`;
  2. `apps/web/src/lib/youtube/intelligence-schemas.ts`, a linha da mensagem `'tipo de aviso não aceito. "trending_viral" foi desligado em 10/2026: …'`;
  3. `apps/web/data/pipeline-docs/cowork-docs-youtube.md`, a linha "`trending_viral` foi desligado em 10/2026 e é recusado com 400; …".

  (Se o `errorMap` for escrito em outra forma que mude o número de linhas com `trending_viral`, o
  executor ajusta esta lista e diz no relatório.) Qualquer outra linha: volta à tarefa dona.
- [ ] **Guarda das duas colunas (emenda 1: D-P1-4, G-P1 sugestão).**
  `grep -rnE "view_count_delta_today|view_count_yesterday" apps/web/src | grep -v "types/database.types.ts"`
  → **sem saída**. Depois de P1 as colunas ficam congeladas no último total de 90 dias com nome de "delta
  de hoje"; esta guarda impede que um leitor novo reintroduza o erro sem teste que reprove.
- [ ] **Type-debt (emenda 1: S-S2).** `bash scripts/check-type-debt.sh` na árvore antes do push: o
  pre-push tem um "ratchet" de dívida de tipos e o lote só tira código.
- [ ] `npx tsc --noEmit -p apps/web` verde; `npx tsc --noEmit -p apps/api` verde.
- [ ] Suíte inteira, em background, saída em arquivo:
  `cd apps/web && npx vitest run > /tmp/ab-p1-suite.log 2>&1` (cerca de 160 s). No contexto, só as
  falhas. **Esperado: as mesmas falhas da base de `origin/staging`, se houver, e nenhuma nova.**
- [ ] `npm run build:web > /tmp/ab-p1-build.log 2>&1` (mudança que apaga rotas e props de Server
  Component: rode o build; é a regra "mudança arriscada" do `CLAUDE.md`). (emenda 1: S-C2; emenda 2:
  S2-R2-2) As variáveis do **build** vêm de `apps/web/.env.production.local` (o `next build` não lê o
  `.env.development.local`, que serve só ao servidor do Gio), **nunca** de `apps/web/.env.local` na
  árvore. Ao fim da Tarefa 6, `rm apps/web/.env.production.local apps/web/.env.development.local` e
  conferir que nenhum dos dois nem `.env.local` existe (`ls apps/web/.env*`).
- [ ] **Gio (`gio-qa`, Sonnet, `medium`)**, na árvore própria, com o servidor local dele: capturas de
  **antes** (em `origin/staging`) e **depois** do painel do A/B Lab e da lista de vídeos, a 1440 px e a
  390 px, em `docs/superpowers/mockups/2026-10-13-ab-lab-p1-retirada/shots/`. Para o "antes" mostrar o
  cartão, a semente local precisa de uma linha `pending` em `youtube_fatigue_alerts`: o Gio diz como a
  criou. Veredito em texto: o que sumiu, e se sobrou buraco de layout onde o cartão ficava.
  **Porta e banco:** o outro terminal usa a 3997 e o banco 54321/54322; o Gio usa outra porta e diz qual.
  **Semente e ambiente fechados (emenda 1: G-P1, semente local):**
  - banco: o **54321/54322** (o web só conversa com esse), com linhas marcadas e removíveis: uuids fixos
    prefixados (`…a1b0…`), site `localhost` já semeado, vídeos/canal exclusivos do Gio. **Nada de
    `db:reset`.** O `bythiago_int` não serve ao navegador. Limpeza ao fim, por id e em ordem (alertas,
    vídeos, canal), com contagem zero conferida.
  - web: **3998 = "antes"** (árvore de `origin/staging`) e **3999 = "depois"** (a árvore do lote), ambas
    no 54321; subida como no runbook, trocando `-p` e `NEXT_PUBLIC_APP_URL`, com
    `AWS_SES_ACCESS_KEY_ID=LOCALDUMMY AWS_SES_SECRET_ACCESS_KEY=localdummy NTFY_URL=http://127.0.0.1:9` e
    as chaves de teste do Turnstile. API de login: `apps/api` com `PORT=3333`, um só, reaproveitando o do
    outro terminal se já estiver de pé. Guardar o PID de cada processo iniciado e encerrar só esses.
  - cookie: `localhost` compartilha cookie entre portas; **contexto Playwright novo por captura** com
    `storageState` próprio, nunca o navegador do dono.
  - semente: 3 vídeos com `thumbnail_url` e `title` longo (>80 caracteres, um com emoji e aspas);
    `insert into youtube_fatigue_alerts (video_id, site_id, z_score, expected_ctr, actual_ctr, status)`
    com `-2.40, 0.0610, 0.0420, 'pending'` para dois deles; o terceiro sem alerta (controle); com 6
    `pending` o `limit(5)` também é exercido. Para o "+30%": ≥ 6 vídeos com `ctr` e a data que a consulta
    pede, de modo que o vídeo com alerta mude de posição; registre a ordem e o `reason` por script, antes
    ("CTR em declínio" presente) e depois (ausente). O selo "FADIGA" aparece em `videos` para os dois.
  - capturas: `/cms/youtube/ab-lab` e `/cms/youtube/videos`, 1440 e 390, dois temas, animação desligada,
    relógio fixo (`page.clock`), mesma semente nas duas portas; leitura por script (texto e
    `getBoundingClientRect` do bloco onde estava o cartão e do vizinho), não por olho.
  - **Não clicar:** sincronizar, upload, conectar conta, "dispensar" com dado de produção.
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
- [ ] No `staging` local, **com o outro terminal avisado e parado**. Antes do merge (emenda 1: S-C6; sem
  `stash`, nunca):
  ```bash
  git diff --name-only HEAD -- $(git diff --name-only origin/staging~N origin/staging) | wc -l   # N = commits de P1; tem de dar 0, senão espere o outro terminal commitar
  ```
  Depois `git merge origin/staging`; resolver os três conflitos previstos (seção 1); e antes de liberar
  o terminal:
  ```bash
  grep -rnE "fatigue|detectViral|trending_viral|view_count_delta_today" apps/web/src | grep -v database.types   # só as linhas de recusa do trending_viral e nenhuma do resto
  cd apps/web && npx vitest run test/cron/sync-analytics-metrics-veredito.test.ts test/mcp test/lib/pipeline > /tmp/ab-p1-juncao.log 2>&1; tail -30 /tmp/ab-p1-juncao.log
  ```
  e `tsc` do web.
- [ ] Entregar ao controlador da A5 a tabela de avisos da seção 1.
- [ ] `git worktree remove ../bythiago-ab-p1` só depois da Tarefa 8.

### Tarefa 8: produção (o agente prepara, o dono confere)

Consultas por `npx supabase db query --linked --agent=yes -o json`, **só select**, com autorização do
dono na sessão; se o classificador negar, o dono roda.

- [ ] **Ordem (emenda 2: H2-4):** a C1 (só leitura) roda **antes do envio**, para o dono saber de
  antemão se há algo a colar; a lista dos `pending` é guardada antes do `update`. O `update` do dono
  **não trava o envio**: roda no dia do deploy e trava só o fecho do critério P1-P2.
- [ ] **C1, antes do `update` (emenda 1: D-P1-3, G-P1-C4):** duas consultas; a saída da segunda vai
  para o relatório do envio (depois do `update`, dispensado em lote fica igual a dispensado à mão, e
  não existe coluna de data de dispensa):
  `select status, count(*) from youtube_fatigue_alerts group by 1 order by 1;`
  `select id, video_id, detected_at, z_score from youtube_fatigue_alerts where status = 'pending' order by detected_at;`
  **Se a primeira der zero `pending`, não há `update` a colar** (a tabela estava vazia em 08/10) e o
  critério P1-P1 vira "não aplicável: nada para esconder" (seção 6).
- [ ] **O `update` do dono (resposta 8), uma linha, só se C1 mostrou `pending`:**
  `update youtube_fatigue_alerts set status = 'dismissed' where status = 'pending';`
  Conferido pelo Phil (D-P1-3): `'dismissed'` é aceito pelo CHECK de `status`
  (`20260531000006_youtube_fatigue_alerts.sql:10`: `pending`, `dismissed`, `resolved`) e **não existe**
  coluna de data de dispensa; o comando de uma linha está completo. Depois do `update`, rodar a primeira
  consulta do C1 de novo: `pending` ausente. (Tirou a guarda de "já existe pendente" do detector
  antigo, que o C2 abaixo exige.)
- [ ] **C2, no dia seguinte ao deploy, depois das 12:10 UTC (emenda 1: D-P1-1, G-P1-C3):** o cron envia o
  aviso por `fanOutToSiteAdmins`, que grava em **`notifications`** com tipo prefixado
  (`lib/notifications/create.ts:100`); `yt_notifications` é a tabela antiga e a consulta antiga dava 0
  sempre (prova em verde). ~~`select count(*) from yt_notifications where type = 'trending_viral' …`~~
  ```sql
  -- esperado: nulo ou anterior ao deploy
  select max(created_at) from youtube_fatigue_alerts;
  -- esperado: 0
  select count(*) from notifications
   where type = 'youtube.trending_viral' and created_at > '<instante do deploy>';
  -- contexto, sem valor esperado: os avisos antigos (resposta 8: ficam)
  select count(*), min(created_at), max(created_at) from notifications where type = 'youtube.trending_viral';
  ```
  Estes zeros só valem **depois** de P1-P3 verde (o 404 só existe com o código novo) e do `update` do
  dono (senão o detector antigo, que pulava vídeo com `pending`, também dá zero), e com a linha
  positiva de C3 (execução com `ran_at` posterior ao deploy). Dia sem vídeo 5x também dá zero.
- [ ] **C3 (Phil; emenda 1: D-P1-2):** a comparação de uma execução com outra é dominada pela API do
  YouTube (uma chamada por canal, timeout de 15 s) e não prova ganho. Duas partes:
  `select ran_at, ms_total, ms_existente, cardinality(falhas) as n_falhas, falhas from yt_own_collection_runs order by ran_at desc limit 14;`
  - no dia seguinte: a execução pós-deploy tem `n_falhas = 0` (isto prova só "não quebrou");
  - a medida devolvida à A5 é a **mediana de `ms_existente` das 7 execuções depois contra a das 7 antes**,
    e só sai no **7º dia** depois do deploy. `ms_existente` mede só a parte antiga
    (`route.ts:549-566`), então o deploy da A5 no mesmo intervalo não contamina. Até lá não se promete
    folga à A5.
  **Data e dono (emenda 2: H2-4, H7):** no envio, o ledger `.superpowers/sdd/ab-lab/progress.md` ganha
  a linha "C3 D+7 = <data do deploy + 7 dias>, quem roda = <agente ou dono>"; sem a linha, o envio não
  fecha.
  Parâmetro que explica o ganho, para o dono rodar junto:
  `select site_id, count(*) from youtube_videos where published_at < now() - interval '30 days' group by 1;`
- [ ] **C4:** `/api/health` sem falha do `sync-analytics-metrics` e do `ab-evaluate`, lido **depois** da
  linha de `ran_at` posterior ao deploy da C3 (emenda 1: G-P1-C3).
- [ ] **C5, paridade (emenda 1: G-P1-C3, S-C4):** no mesmo bloco de comandos, com a mesma chave, um
  **controle positivo** numa rota viva e as duas rotas apagadas:
  ```bash
  curl -s -o /dev/null -w '%{http_code}\n' -H "<chave do pipeline>" "$BASE/api/pipeline/youtube/ab-tests"                 # 200
  curl -s -o /dev/null -w '%{http_code}\n' -H "<chave do pipeline>" "$BASE/api/pipeline/youtube/ab-tests/fatigue-alerts"  # 404 (NOT_FOUND "Test not found": cai em ab-tests/[id])
  curl -s -o /dev/null -w '%{http_code}\n' -H "<chave do pipeline>" "$BASE/api/pipeline/youtube/thumbnails/fatigue"       # 404 (rota inexistente)
  ```
  (a chave vem do ambiente; nunca criar nem revogar chave.) E a listagem de recursos do MCP, **pelo
  Cowork e pelo Claude Code, em sessão nova**, não traz `pipeline://youtube/ab-fatigue` nem
  `pipeline://youtube/thumbnails/fatigue`; e `manage_ab_test` com `get_fatigue_alerts` devolve erro de
  validação do enum, não vazio.
- [ ] **C6, guarda dos leitores externos (emenda 1: G-P1-C5, D-P1-4):** comando literal e saída colados no
  relatório:
  (emenda 2: D2-P1 observação; o `\.notifications\b` casava arquivos que a P1 não toca e a pasta
  `apps/web/coverage/`)
  `grep -rnE "fatigueAlerts|fatigue-alerts|thumbnails/fatigue" apps/web/src apps/api/src scripts supabase .github docs/ops ~/Workspace/forja/ferramentas`
  → sem saída depois da P1 (salvo `database.types.ts`). A ausência da chave `notifications` na resposta do
  cron fica provada pelo teste da Tarefa 1, que já afirma as chaves; e
  `select proname from pg_proc where prosrc ilike '%fatigueAlerts%';` → vazio. O que mora no Cowork
  (prompt salvo, memória) é "**não conferido, dado do Cowork**".

---

## 6. Aceite (o do spec, emendado pela Hanna; o Gio fecha a redação na revisão)

| # | Critério | Onde se prova |
|---|---|---|
| 1 | O `grep` do spec só acha `database.types.ts` e as três linhas listadas na Tarefa 6 (G-P1-B1); mais o `grep` das duas colunas, sem saída (D-P1-4) | Tarefa 6 |
| 2 | Cron com total de 90 dias: nenhum aviso, nada em `youtube_fatigue_alerts`, sem as duas colunas no `update` | Tarefa 1, passo 1 |
| 3 | `checkAndPersistLongevity` com `fading` não insere alerta | Tarefa 2 |
| 4 | Registry e MCP verdes com 34; as duas rotas dão 404 | Tarefa 4; Tarefa 8, C5 |
| 5 | Aviso `trending_viral` pelo pipeline → **400** `VALIDATION_ERROR` com `notifications.0.type: …` em pt-BR, nada gravado (desvio D1); `type` ausente mantém a mensagem padrão (S-C5) | Tarefa 4 |
| P1-P1 | (redação fechada pelo Gio, emenda 1: G-P1-C4) **Pré-condição:** C1 colada no relatório; se `pending = 0`, o critério é "**não aplicável, nada para esconder**" e a prova passa a ser P1-P3 mais o teste de consulta (Tarefa 3). **Passos (dono, Opera, logado, recarga sem cache Ctrl+Shift+R):** (1) `/cms/youtube/ab-lab`: nenhum cartão com a palavra "fadiga" nem botão de dispensar; (2) `/cms/youtube/videos`: nenhum selo "FADIGA" (conferir os vídeos das linhas `pending` do C1, ids no relatório); (3) (emenda 2: H2-H8) sugestão de vídeo para testar, na tela **`/cms/youtube/ab-lab`, bloco de sugestões de vídeo para testar**: nenhum motivo "CTR em declínio". **Falso verde:** deploy velho (cache/skew) ou lista que já estava vazia; fecha-se com o hash do deploy anotado (Vercel) e P1-P3 conferido **antes** deste passo. Conferir também, no Opera, que o texto da tela tem contraste legível (`color-mix()` renderiza transparente no Opera) | dono, depois do deploy |
| P1-P2 | (redação fechada, emenda 1: G-P1-C3) **Pré-condições, nesta ordem:** (a) P1-P3 verde; (b) o `update` do dono rodado (se houve `pending`). **Passos:** (1) `select ran_at, falhas, ms_existente from yt_own_collection_runs order by ran_at desc limit 3;` com uma linha de `ran_at` posterior ao deploy e `falhas` vazio; (2) `/api/health` sem falha de `sync-analytics-metrics` nem de `ab-evaluate`, lido **depois** da linha anterior; (3) `select count(*) from youtube_fatigue_alerts where created_at > '<deploy>'` → 0 e a consulta em `notifications` com `youtube.trending_viral` → 0 (C2). **Falso verde:** cron que não rodou ou falhou; detector antigo que pulou por haver `pending`; dia sem vídeo 5x. A condição (a) e a linha do passo 1 são a parte positiva | Tarefa 8, C2 a C4 |
| P1-P3 | (redação fechada, emenda 1: G-P1-C3, S-C4) `curl` com a mesma chave, no mesmo bloco: controle positivo `ab-tests` → 200; `ab-tests/fatigue-alerts` → 404 (NOT_FOUND "Test not found", cai em `ab-tests/[id]`); `thumbnails/fatigue` → 404 (rota inexistente). Listagem de recursos do MCP **pelos dois caminhos**, em sessão nova, sem os dois recursos; `get_fatigue_alerts` devolve erro de enum, não vazio. **Falso verde:** chave sem permissão (401/403 lido como "removido"); listagem em cache do Cowork | Tarefa 8, C5 |
| P1-P4 | (emenda 1: G-P1-C5) Falha em verde: o comando literal da C6, com saída colada; leitor que mora no Cowork fica "**não conferido, dado do Cowork**" (seção 8). Antes: ~~"nenhum, conferido por grep": seção 0~~ | Tarefa 8, C6; Yannis reconfere |

## 7. O que acontece quando o dado não existe, e em cada falha

| Situação | Depois de P1 |
|---|---|
| Cowork chama `GET …/ab-tests/fatigue-alerts` ou `…/thumbnails/fatigue` | 404. Não é lista vazia. (emenda 1: S-C4) `thumbnails/fatigue` é 404 de rota; `ab-tests/fatigue-alerts` cai em `ab-tests/[id]` e responde 404 `NOT_FOUND` "Test not found" depois de uma ida ao banco com id inválido. O 404 vale; não se cria guarda nova na rota `[id]` |
| Cowork chama `manage_ab_test` com `action: 'get_fatigue_alerts'` | erro de validação do enum da ferramenta, antes de qualquer leitura |
| Cowork lê `pipeline://youtube/ab-fatigue` | recurso inexistente |
| Cowork manda aviso `trending_viral` | 400 com a mensagem; **o PATCH inteiro é recusado** (é assim para todo erro de schema hoje): recomendações e coaching do mesmo corpo não são gravados. O doc diz isso e manda "tirar o aviso e reenviar o corpo inteiro" (emenda 1: D-P1-S2). A mensagem leva só os 3 primeiros erros (`.slice(0, 3)`): um corpo com três erros antes de `notifications` não mostra a frase (emenda 1: S-C5). A forja não é afetada: a chave dela já é barrada em qualquer `notifications` (`services/youtube.ts:636`) |
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
- ~~O teste do Passo 1 da Tarefa 4 pode não provar nada se `rotaNormalizada` devolver o próprio
  caminho.~~ Resolvido (emenda 1: S-C4): a função é `padraoDaRota` e o caso afirma o padrão `[id]` e
  `null`.
- **Leitor das duas colunas no Cowork** (memória ou prompt salvo no banco): não conferido (emenda 1:
  D-P1-2). Fora do Cowork o Phil conferiu: kit da forja, migrations e serviços do pipeline não leem as
  colunas.
- **Falso verde da prova de produção** tratado nos critérios P1-P1 a P1-P4 (seção 6); sem a saída da C1
  colada, P1-P1 não é "ok" (emenda 1: G-P1-C4).
- **Trechos de teste deste plano são moldes**, escritos sem ler os arquivos de teste: os nomes dos
  auxiliares têm de ser trocados pelos que existem. O que não muda é a lista de afirmações.

## 9. Perguntas abertas para a revisão

Respondidas na rodada 1 e viradas decisão no corpo (emenda 1): árvore própria e D1 = 400 (Yannis: seção 1
e seção 3); a C3 como medida do cron e a ausência de leitor fora do repositório (Phil: Tarefa 8, C3, e
seção 8); prova de P1-P1/P1-P3 e semente do "antes" (Gio: seção 6 e Tarefa 6). (emenda 2: decisão 13)
A pergunta à Hanna (o `update` trava o envio?) foi respondida: **não trava**, só o fecho de P1-P2
(Tarefa 8, "Ordem"). Não há pergunta aberta a Logan e Naksu neste plano além da passada da Tarefa 6.
Ficam só as duas perguntas ao dono, 13 e 14, na seção 2.
