# A/B Lab honesto, P3: sai a descrição (plano de implementação)

Escrito em 14/10/2026 (noite). **Segunda versão**: revisões de Hanna (H1 a H10), Phil (Deve 1 a 7, Pode 8 a 10) e
Yannis (B1, D-a a D-g, P1 a P10) aplicadas (arquivos em `.superpowers/sdd/ab-lab/p3-revisao-{hanna,phil,yannis}.md`).
Falta a revisão do Gio e o acordo final dos três sobre esta versão.
Spec: `docs/superpowers/specs/2026-10-07-ab-lab-honesto-design.md` (v6 + rascunho v7): seção 1, bloco
"P3 — Sai a descrição" (com a Migration A); seção 2 inteira; aceite 10 a 13 da seção 5; emendas de 09/10
números 20, 21 e 26; emendas v7 números 36, 44 e 45. Onde o corpo do spec e a emenda 44 discordam, vale a
emenda. Plano irmão, que é o molde de forma: `2026-10-13-ab-lab-p2-avaliacao-automatica-desligada-plan.md`
(chamado aqui de "plano da P2"). Ledger: `.superpowers/sdd/ab-lab/progress.md`.

**Inventário lido em 14/10 no `origin/staging` `eba97b0cf`** (contém P1 e P2; o `staging` local diverge do
remoto em 607 commits e **não** é a base). Toda linha citada aqui vem desse HEAD; **quem executa reconfere
por `grep` no dia**.

> **Para quem executa:** use `superpowers:subagent-driven-development`, tarefa por tarefa, com o agente
> `executor` (Sonnet, effort `medium`). Passos com caixa (`- [ ]`). Nada em `high` neste plano. Revisão do
> lote (Tarefa 6): Phil e Yannis, Opus, `medium`. Capturas: Gio (Sonnet, `medium`); texto e tela: Logan e
> Naksu (Sonnet, `medium`).

> **Quem testa (decisão do dono, 14/10/2026; vale sobre qualquer trecho deste plano):** testes, prova
> local, capturas, conferências de produção e paridade são do controlador com o Gio; o dono só confirma.
> Continuam com o dono: aplicar a Migration A em produção, colar o texto no Cowork,
> aprovar capturas e dar o "pode". Leitura de produção pelo agente costuma ser negada pelo modo automático:
> nesse caso o Gio prepara o `select` num `.sh` e o dono cola (regra do ledger).

**Objetivo, em uma frase.** O A/B Lab deixa de testar e de escrever a descrição do vídeo: nenhum caminho
(rotação, retomar, forçar rotação, aplicar, reverter) envia ao YouTube descrição diferente da que está no
ar, o tipo "Descrição" some do produto, e o pipeline recusa descrição com 422 e mensagem em pt-BR.

**Como.** Quatro commits de código, em ordem, cada um com `tsc` limpo **e a lista inteira de testes do A/B verde** (seção 4): (1) o caminho de escrita perde a
descrição; (2) o contrato do pipeline recusa descrição (REST e MCP no mesmo commit, com o doc); (3) o tipo
`'description'` sai de `TestType`, dos mapas de prompt e do CMS, com rótulo de reserva para tipo desconhecido lido do banco e o
combo renomeado "Título + thumbnail"; (4) limpeza dos testes e o teste de integração renomeado. Depois do
código em produção, a **Migration A** troca o CHECK de `ab_tests.test_type` para três valores.

**Stack.** Next.js 16, TypeScript estrito, Vitest, zod 3.25.76 (API v3). Serviços do pipeline **lançam**
`PipelineServiceError` (`err()` em `services/types.ts:55-57`) e devolvem `{ data, status }`; recusa se
afirma com `await expect(...).rejects.toMatchObject({ status: 422, code: 'DESCRICAO_FORA_DO_TESTE' })`.
Os testes ficam fora do `tsc` do web (`apps/web/tsconfig.json:94-96` exclui `test/**`): erro em teste só
aparece no `vitest`.

## Fica FORA deste plano

- **Apagar colunas e tabela** (`original_description`, `description_text`, `ab_test_tracked_links`) e
  recriar `create_playoff_test`: é a **Migration B**, mini-plano próprio, não antes de 7 dias com P3 no ar.
- `settleOnAir`, releitura do original ao iniciar, os dois campos de idioma na escrita do título: **P4a**.
  A P3 mantém o `PUT` de hoje (reenvia `title`, `description` lida, `categoryId`, `tags`).
- Apagar `lib/youtube/ab-templates.ts` (`resolveTemplates`, `parseTemplateTokens`): ficam sem chamador em
  `src`, mas 14 arquivos de teste fazem `vi.mock('@/lib/youtube/ab-templates')`. Dívida declarada, paga na
  Migration B (seção 8).
- `captureOriginalMetadata` continua devolvendo `{ title, description }` (leitura; a P4a a reescreve).
- `applied_metadata` dos ciclos antigos guarda `description_set: null` e às vezes `links_resolved: {}`: é
  JSON histórico, sai como veio no `GET` do teste (lista fechada da P2). Nada a migrar.
- `lib/pipeline/video-ab-materialize.ts` (emenda 44: não toca `ab_tests` nem descrição; conferido, só
  `title_text` e `metadata.visual_description`).
- `docs/cowork-pipeline-reference.md`: o spec diz que muda, mas o arquivo não cita teste de descrição,
  `description_text` nem `description_test` (conferido por grep). **Não muda**; a Tarefa 2 reconfere.
- `lib/pipeline/mcp/schema-utils.ts`: o spec o lista, mas a única ocorrência é um comentário sobre
  `description` de enum em JSON Schema. **Não muda.**

## Restrições globais

- **Nenhum caminho envia ao YouTube descrição diferente da lida.** O `PUT` de `videos.update` sempre leva
  `snippet.description` exatamente como veio do `videos.list` da mesma chamada.
- **Recusa com 422 só para descrição.** `code: 'DESCRICAO_FORA_DO_TESTE'`, `message: 'A descrição não
  participa mais do teste A/B'`, numa constante exportada e testada. Vale para `test_type: 'description'`
  e para `description_text` **não nulo** (inclusive `""`) em qualquer variante. `description_text: null` ou
  ausente é aceito e ignorado. As outras validações do serviço seguem em 400.
- **Paridade Cowork × Claude Code:** REST e ação MCP do mesmo dado mudam no mesmo commit (Tarefa 2), com
  `api-registry.ts` (sem mudar `endpoint_count`) e `cowork-docs-youtube.md`.
- **A Migration A só nasce no dia em que for aplicada** (seção 1, "Fila do banco"). O arquivo nunca fica
  commitado esperando: `supabase db push` aplica tudo que está pendente, e outro terminal levaria a A junto.
- TypeScript sem `any`; texto novo em pt-BR; commits `tipo: descrição`; commit por lista de arquivos.
- **Árvore e envio:** seção 1. Nunca `git stash`, `git reset`, `pkill`, nem push do `staging` local.
- Suíte e build com saída em arquivo; nenhum comando acima de 4 min em primeiro plano.

## Foco de revisão (o que o spec implica e nenhum teste de hoje exercita)

1. **Cowork chama `upsert_variants` pelo MCP sem `dry_run`** (o padrão é prévia, `mcp/services/ab-tests.ts:91`).
   Hoje a prévia ecoa `description_text` e diz "chame de novo com `dry_run: false`": é sucesso falso. Depois
   da P3 a prévia também devolve o 422. Teste na Tarefa 2.
2. **`description_text: ""`** (cliente antigo que manda string vazia em vez de `null`). Não é nulo: 422.
   Teste na Tarefa 2.
3. **Teste antigo lido do banco com `test_type = 'description'`** (ou qualquer valor fora dos três) aberto no
   painel, no detalhe, no cartão de sugestão e no passo "revisar": nada quebra; aparece o rótulo de reserva
   "Tipo fora de uso". Hoje `TYPE_META[type]` daria `undefined.label` e derrubaria a tela. Teste na Tarefa 3.
4. **Variante antiga de combo ou título com `description_text` preenchido, girada pelo cron.** A descrição
   no ar não muda: o `PUT` leva a descrição lida. Teste na Tarefa 1 (aceite 12).
5. **Rascunho de descrição que já existia antes do deploy** (criado no wizard antigo, entre o deploy e a
   Migration A) chega a "Iniciar". `startAbTestInternal` recusa com a mensagem da constante, sem tocar no
   YouTube. Teste na Tarefa 3.

---

## 0. Fatos medidos em 14/10 (`origin/staging` `eba97b0cf`)

| Fato | Valor | Fonte |
|---|---|---|
| Grep 1 do spec (`description_text\|original_description\|…\|description_test`) em `apps/web/test` | **31 arquivos** (o spec dizia 30) | grep do controlador |
| União com o grep 3 (`'description'` em `test/**/ab-*`) | **36 arquivos** (o spec dizia 35): os 31 mais `cms/ab-step-tipo`, `youtube/ab-step-tipo`, `youtube/ab-constants`, `youtube/ab-high`, `youtube/ab-low` | idem |
| Dos 36, ficam como estão | 2: `youtube/coleta/meta-step.test.ts` (coluna de `yt_own_video_meta_daily`) e `integration/youtube-channel-remove.test.ts` (sai na Migration B) | spec, seção 2 |
| Testes fora dos greps que quebram pela assinatura nova de `updateVideoMetadata` | 2: `test/ab-metadata.test.ts`, `test/ab-rotate-dispatch.test.ts` | grep `updateVideoMetadata(` |
| Grep 1 em `src` e `data` | 17 arquivos, mais `database.types.ts` | grep |
| `ab-evaluate-phases.ts` | **não cita mais descrição** (a P2 apagou as fases); só o teste `youtube/ab-evaluate-phases.test.ts:299` (`it.each(['title','description'])`) muda | grep |
| Os quatro `Record<TestType, …>` | `suggested-card.tsx:8`, `step-revisar.tsx:38`, `ab-constants.ts:16`, `ab-primitives.tsx:129` (o spec dizia `:11`, `:41`, `:15`, `:129`); mais `prompt-builders-ab.ts:361-362` (mapa inline indexado por `testType`) | grep |
| `ab-types.ts` `changeType` de `CompetitorChange` | `:534` (o spec dizia `:525`); fica | grep |
| `'description'` legítimo fora do A/B nos caminhos do grep 3 | `mcp/tools.ts:721`: `type` de `manage_competitors` `get_changes` (mudança de concorrente); **fica** e entra nas exceções | grep |
| `ab_test_tracked_links` lido por código vivo | `ab-apply.ts:75`, `ab-lab/actions.ts:1096` (escrita), `ab-lab/queries.ts:237`, `services/youtube.ts:1073` (`getAbTest`) e `:1129` (`getAbTestFunnel`) | grep |
| Quem cria linha em `ab_test_tracked_links` | só `createTextVariant` quando `description_text` tem `{{link:nome}}` (`actions.ts:1086-1105`). Produção: 0 linhas com `source_type = 'ab_test'` em `tracked_links` (spec, 09/10; a C1 reconfere) | código + spec |
| **Defeito achado: `POST /ab-tests/:id/variants` pelo REST** | a rota passa o corpo cru (`{ "variants": [...] }`, como o doc manda) como se fosse o vetor (`variants/route.ts:20`); o serviço faz `BatchVariantUpsertSchema.safeParse({ variants: <objeto> })` e devolve 400. Só o MCP (que passa o vetor) funciona. Ver D5 | lido pelo controlador |
| CHECK de `test_type` | `20260517000002_ab_lab_title_desc.sql:6-7`, inline no `ADD COLUMN`, nome gerado pelo Postgres (em regra `ab_tests_test_type_check`; a Migration A descobre por `pg_constraint`) | migration |
| `select('*')` que entregaria `description_text` mesmo depois da P3 | `listVariants` (`services/youtube.ts:1301`), `getAbTest` (`ab_test_variants!test_id(*)`, `:1071`); `listAbTests` seleciona colunas e inclui `description_text` (`:1041`); a lista fechada do teste inclui `original_description` (`:988`) | grep |
| Arquivos do escopo que tinham mudança não commitada **no checkout principal** | `api-registry.ts`, `mcp/prompts.ts`, `cowork-docs-youtube.md`: são da **E7 T7** (não do observatório), já em `main` como `5cfcdcdf3` e **já commitados pela A5 no `staging` local** (`2168b5def`, 14/10). O `staging` local está 617 commits à frente e 89 atrás do `origin/staging`: **não é base nem origem de envio** | `a5/inventario-14-10-noite.md:6`; `git log` |

**Não medido (ninguém leu produção):** se existe teste `draft`, `queued`, `active` ou `paused` de tipo
`description` ou com variante com `description_text`; quantas linhas há em `ab_test_tracked_links`; o nome
real do CHECK. A Tarefa 7 (C1) confere antes do envio; a Tarefa 8 (A0) antes da Migration A.

## 1. Onde se trabalha e como se envia

**Árvore própria, a partir de `origin/staging`** (contém a P2; o `staging` local não é base):

```bash
git fetch origin
git worktree add ../bythiago-ab-p3 -b lote/ab-p3 origin/staging
```

**Commit e envio, sempre a partir de uma árvore própria criada de `origin/staging`** (esta, ou uma nova
para a Migration A, Tarefa 8); **nunca** pelo `staging` local (617 à frente, 89 atrás: o `push` seria recusado ou levaria centenas de
commits não enviados). Regras da árvore, iguais às da seção 1 do plano da P2 (escritas por extenso lá): **nunca existe
`apps/web/.env.local` na árvore** (o pre-commit semearia a referência do Cowork em produção a partir de
código não enviado); o servidor local das capturas lê `apps/web/.env.development.local` e o build lê
`apps/web/.env.production.local`, os dois apagados ao fim da Tarefa 5; `bash scripts/check-type-debt.sh`
antes do push; junção de volta ao `staging` local com as três travas (Tarefa 6).

**Ordem com as outras entregas:**

- **P2 em produção antes.** O envio da P3 a `origin/staging` só sai depois da promoção da P2 a `main`, e a
  promoção da P3 a `main` só depois da C2 da P2 (cron de 15/10 depois das 12:10 UTC), para que uma falha de
  cron se atribua a uma entrega só.
- **P4a depois.** A P4a reescreve `ab-apply.ts`, `ab-metadata.ts` e caminhos de `ab-lab/actions.ts` sobre o
  código da P3; nasce de `lote/ab-p3` (ou de `origin/staging` com a P3) e nunca em paralelo.
  **A P4a depende do código da P3 em `main`, não da Migration A** (nada da P4a lê o CHECK). A A entra na fila
  quando couber e não segura a P4a. *Observação para a emenda 45 do spec (não alterada aqui), a confirmar
  por Phil e Yannis na revisão final do plano da P4a.* O plano da P4a pode ser escrito durante a execução
  da P3, lendo `ab-apply.ts` e `ab-metadata.ts` de `lote/ab-p3` depois do commit da Tarefa 1.
- **A5 (E7) e o terminal do observatório** editam `mcp/tools.ts`, `mcp/prompts.ts`, `api-registry.ts` e
  `cowork-docs-youtube.md`. A E7 T7 já foi commitada pela A5 (`2168b5def`); a **E7 T12 a T16** (esperam a E4)
  nascem de `origin/staging` com a P3, e quem entrar depois regenera o snapshot
  `test/mcp/__snapshots__/mcp-schema-parity.test.ts.snap`. A Tarefa 6 mede de novo antes da junção; nunca `stash`.

**Fila do banco (emendas 36 e 45; `.superpowers/sdd/a5/fila-do-db-push.md`):**

- A **Migration A** só é criada (`npm run db:new ab_tipo_sem_descricao`) **no dia da aplicação**, no
  checkout principal, e aplicada na mesma sessão (o `db push` usa o `supabase/.temp` dele); **commit e envio
  vão por árvore própria** (Tarefa 8). Até lá o SQL vive **só no plano** (Tarefa 8, passo 1, já na forma
  atômica), testado no banco `bythiago_int`. O arquivo `.superpowers/sdd/ab-lab/p3-migration-a.sql` não existe
  e não é criado.
- Pré-condições, todas: (a) o código da P3 em `main` e no ar; (b) **depois da MG15** (aplicada a partir de
  16/10 23:00 UTC), **não no mesmo dia UTC em que a MG15 for aplicada, nem antes da conferência pós-MG15 colada
  na fila**, e **antes de 30/10** (a MG16 arma a fila a partir daí); (c) nenhuma outra migration
  pendente (uma por vez: a Migration 0 da P4 vai sozinha hoje à noite; a M2 da manutenção a partir de 15/10
  13:00 UTC); (d) nenhum arquivo destrutivo da A5 armado e não aplicado; (e) fora de 11:30–13:00 UTC e dos
  minutos 0-4, 20-24, 30-34 e 40-44 (mesma regra da Migration 0). **As horas dos crons do A/B não são
  restrição** (nenhum segura transação enquanto chama o YouTube; o pior caso é o `lock_timeout` abortar a A
  sem mudar nada). *Fecha o "a confirmar" da emenda 36; o spec não é alterado aqui, o controlador leva a frase.*; (f) **nunca em 16/10 entre 17:00 e 23:00 UTC**.
- A P3 **não depende** da Migration 0. A A e a 0 podem ir juntas se as duas estiverem prontas no mesmo dia
  (emenda 36), mas a 0 sai hoje, então a A vai sozinha.
- Pedir ao controlador da A5 a linha da Migration A na fila (ele escreve; este plano não edita a fila).

## 2. O que é do dono

1. As capturas de antes e depois (Tarefa 5) e o "pode" do envio.
2. **Aplicar a Migration A** (Tarefa 8), no dia e na janela da seção 1: `npm run db:push:prod` (pede `YES`).
3. **Colar no Cowork** o texto da Tarefa 7, C4 (uma vez, **no dia do deploy da P3 em `main`**, com o rascunho de
   conferência ainda aberto).
4. Se o Gio não tiver sessão autenticada de produção: criar e arquivar o rascunho de conferência (três
   cliques; Tarefa 7, C5).

**Não há seed do Cowork a rodar.** O seed (`scripts/seed-pipeline-reference.ts`) grava só `reference_content`
(skills, regras e memória de curadoria, arquitetura e pesquisa); nenhum desses arquivos cita teste de
descrição. O `cowork-docs-youtube.md` chega ao Cowork **com o próprio deploy** (`mcp/resources.ts:55` e
`services/utilities.ts:155` leem `data/pipeline-docs`). Emenda nova a levar ao spec (não alterado aqui): "o seed
não carrega o doc de domínio".

**O dono precisa saber (não responde):**

- Depois da P3 o wizard oferece três tipos: **Título + thumbnail**, Thumbnail e Título. O antigo "Combo"
  perde o selo "recomendado" e ganha a frase "mede o conjunto; não separa título de thumbnail".
- O **Cowork passa a receber 422** se mandar `description_text` com texto ou pedir teste de descrição, e
  **400** se mandar recomendação `description_test` no `PATCH` de inteligência.
- A descrição de vídeo que um teste antigo tenha mudado **não volta sozinha** (nenhum teste de produção
  mudou descrição: os dois que existem são combo sem texto de descrição; a C1 prova pelo histórico de ciclos,
  e confere também se há reversão ainda aberta com descrição).
- **Quem é atingido pelo 400/422:** só o Cowork, que refaz a chamada. A forja nunca manda `video_recommendations`
  (`fila_intel.py:514`, `:2024-2025`) nem `description_test`; nada se perde sem volta.
- **O que o dono vê, e quando:** o wizard com três tipos e o Cowork recebendo 422 aparecem no **dia da promoção da
  P3 a `main`** (a partir de 15/10, depois das 12:10 UTC, se a execução de 5,5 a 9 h couber). A Migration A vem
  depois (a partir de 17/10) e ele não percebe nada dela na tela.
- O **rollback instantâneo da Vercel** para um deploy anterior à P3 continua funcionando até a Migration B;
  depois da Migration A, nesse deploy antigo, criar teste de descrição dá erro de banco (seção 9).

## 3. Decisões que o spec não toma (recomendação do controlador; a revisão cobra)

| # | Decisão | Recomendação | Alternativa e custo |
|---|---|---|---|
| D1 | Nome e assinatura da escrita de título | **Mantém o nome `updateVideoMetadata`**, assinatura nova `(videoId: string, title: string, accessToken: string)`. Quem tem título nulo não chama | Renomear para `updateVideoTitle`: deixaria `undefined` em ~10 `vi.mock` que só declaram `updateVideoMetadata` (testes de `end`, `pause`, `drift-lifecycle`, `site-admin-step-ab`…), quebrando-os sem aviso de tipo |
| D2 | Onde mora a regra da recusa | **Em `ab-schemas.ts`**: `DESCRICAO_FORA_DO_TESTE` (código, mensagem, status) e `pedeDescricao()`. É a "constante da mensagem 422" das exceções do grep; o literal `'description'` aparece uma vez só, ali | Espalhar a checagem pelo serviço, pelo MCP e pelo `prompts.ts`: três cópias da regra |
| D3 | O campo `description_text` nos esquemas de entrada | **Fica declarado** no `VariantPayloadSchema` e no shape MCP de `manage_ab_test`, como `z.string().nullable().optional()` (sem `max`) com `describe` dizendo que só `null` é aceito. Motivo: o SDK do MCP valida com Zod e **descarta chave desconhecida em silêncio**; sem o campo declarado, o Cowork veria sucesso (spec, seção 2). Sem `max`, qualquer texto chega à checagem e recebe 422, não 400 | Tirar do shape: sucesso silencioso no MCP, exatamente o que o spec proíbe |
| D4 | Links rastreados do teste (`ab_test_tracked_links`) nas respostas do pipeline e no CMS | **Saem as leituras; a forma fica.** `getAbTestFunnel`: `per_variant[].link_clicks: null`, `per_link: []`, `link_clicks_window: null` (o `aviso` de sempre). `getAbTest`: `tracked_links: []`. CMS (`getAbTestResults`): o campo `tracked_links` sai do tipo (nenhuma tela o lê). Motivo: só teste de descrição criava link; produção tem 0; a Migration B apaga a tabela e o código que a lê quebraria depois dela. **Condição (Phil Deve 1): a C1 é portão.** Com `linhas_ab_test_tracked_links = 0`, a D4 segue como escrita; com `> 0`, o envio **para** e o controlador decide entre manter a leitura até a B ou trocar para `tracked_links: null` e `per_link: null`, com o doc dizendo "não lido desde a P3". No doc, `per_link: []` vem com a frase "o A/B não cria link rastreado desde 10/2026", nunca "sem links" | Manter as leituras até a Migration B: o grep 2 do spec falha e a B teria de mexer em código do pipeline. Tirar as chaves: muda a forma da resposta para o Cowork sem ganho |
| D5 | O defeito do `POST /variants` pelo REST (seção 0) | **Consertar na Tarefa 2**, porque a conferência de paridade do 422 e do `null` aceito passa por ele: a rota aceita o corpo `{ "variants": [...] }` (o do doc) e também o vetor cru (o que funcionava por acaso). Teste novo | Deixar: a paridade REST da P3 não é verificável, e o doc continua prometendo o que não funciona |
| D6 | Rótulo de reserva para tipo desconhecido | **"Tipo fora de uso"**, numa constante em `ab-constants.ts`, com ícone `HelpCircle`; função `tipoMeta(t: string)` usada por `ab-primitives.tsx`, `suggested-card.tsx` e `step-revisar.tsx`. Logan fecha a frase **antes da Tarefa 3** (5 min, Sonnet), e o `extra` do cartão usa a constante `FRASE_COMBO` (uma frase só, uma caixa só) | "Descrição (antigo)": só cobre um valor; tipo desconhecido de outra origem cairia em `undefined` |
| D7 | O que o filtro "tipo" do painel faz com teste antigo de descrição | **Some do filtro** (três opções + "Todos"); o teste aparece em "Todos" com o rótulo de reserva | Opção "Outros": controle novo para um caso que produção não tem |
| D8 | `startAbTestInternal` com tipo fora dos três | **Recusa** com `DESCRICAO_FORA_DO_TESTE.message` se for `'description'`, ou "Tipo de teste desconhecido" para outro valor, antes de qualquer chamada ao YouTube | Deixar iniciar: a rotação giraria variantes que não escrevem nada, gastando cota e gravando ciclos falsos |
| D9 | `action_type: 'description_test'` no `PATCH` de inteligência | **Sai do enum** com `errorMap` que explica (molde do `trending_viral` da P1, `intelligence-schemas.ts:34-43`); resposta **400** (é validação do payload da inteligência, não do teste A/B) | 422: o spec reserva 422 só para variante e tipo de teste |
| D10 | `ab-ideate` (prompt MCP, `prompts.ts:624-637`) **e `ab-write`** (`prompts.ts:694-780`, que lê `test.test_type` do banco) com `description` | **Lançam** `Error(DESCRICAO_FORA_DO_TESTE.message)`; tipo fora dos três no `ab-write` lança "Tipo de teste desconhecido" (senão o prompt sairia com a palavra "undefined" no lugar das instruções); o enum citado no `ab-ideate` passa a "thumbnail, title ou combo" | Aceitar e gerar prompt de descrição: o Cowork prepararia variantes que o servidor recusa |
| D11 | `listVariants` e as variantes de `getAbTest` / `listAbTests` | **Lista fechada de colunas** (`CAMPOS_DA_VARIANTE`: as 13 colunas de `ab_test_variants` menos `description_text`, **inclusive `source_variant_id`**, a linhagem do playoff), amarrada ao tipo do banco para que coluna nova obrigue uma decisão em vez de sumir; estilo da P2 (`services/youtube.ts:984-991`); `original_description` sai de `CAMPOS_DO_TESTE_QUE_SAEM_COMO_VIERAM`. O `select('*')` deixaria a coluna (que só some na B) vazar na resposta | Manter `*`: a resposta continua trazendo `description_text`, e o doc teria de explicar um campo morto |

## 4. Arquivos, por tarefa

Caminhos relativos a `apps/web/`; `AB/` = `src/app/cms/(authed)/youtube/ab-lab/`.

| Tarefa | Código | Testes |
|---|---|---|
| 1 escrita | `src/lib/youtube/{ab-metadata,ab-apply,ab-rotate-phases,ab-types}.ts`, `AB/actions.ts` (retomar `:811-823`, `forceRotate` `:1235-1246`, `applyWinnerNow` `:1339-1350`, `revertWinner` `:1503-1513`) | `test/{ab-metadata,ab-rotate-dispatch,ab-cron-rotate,ab-force-rotate,ab-actions-resume,ab-p3-actions,ab-drift-lifecycle}.test.ts`, `test/api/cron/ab-rotate.test.ts`, `test/youtube/{ab-apply,ab-apply-metadata}.test.ts` |
| 2 contrato | `src/lib/youtube/{ab-schemas,intelligence-schemas,prompt-builders-ab}.ts` (só as partes que não dependem de `TestType`; o resto na 3), `src/lib/pipeline/services/youtube.ts`, `src/lib/pipeline/mcp/{tools,prompts,errors}.ts`, `src/lib/pipeline/mcp/services/ab-tests.ts`, `src/app/api/pipeline/youtube/ab-tests/[id]/variants/route.ts`, `src/lib/pipeline/api-registry.ts`, `data/pipeline-docs/cowork-docs-youtube.md`, `docs/cowork-youtube-intelligence-reference.md` (`:13` e `:224`) | **novo** `test/youtube/ab-p3-recusa-descricao.test.ts`; `test/api/pipeline/ab-variants-route.test.ts`; `test/youtube/{ab-schemas,ab-pipeline-null-aviso,prompt-builders-ab}.test.ts`; `test/mcp/{mcp-schema-parity,mcp-schema-reads,mcp-tools,youtube-mcp-prompts}.test.ts` (snapshot de `test/mcp/__snapshots__` só se o teste pedir) |
| 3 tipo e telas | `src/lib/youtube/{ab-types,ab-wizard-reducer,ab-start,intelligence-types}.ts`, `AB/actions.ts` (`createAbTest`, `updateAbTestType`, `uploadVariant`, `createTextVariant`, `updateTextVariant`, `fetchAbTestVariants`), `AB/queries.ts`, `src/lib/youtube/prompt-builders-ab.ts` (chaves `description` e rótulo do combo), `AB/_components/{step-tipo,step-variantes,step-revisar,suggested-card,ab-constants,ab-primitives,ab-lab-dashboard,ab-create-wizard,drafts-block}.tsx` (`ab-constants.ts`) | `test/{ab-actions-create,ab-actions-text-variant,ab-start-internal}.test.ts`, `test/cms/{ab-step-tipo,ab-step-variantes,ab-wizard-reducer,ab-step-revisar}.test.tsx`, `test/youtube/{ab-step-tipo,ab-step-variantes,ab-wizard-components,ab-wizard-reducer,ab-primitives-basic}.test.tsx`, `test/youtube/{ab-constants,ab-high,ab-low,ab-wizard-integration}.test.ts`, `test/ab-dashboard.test.tsx` |
| 4 limpeza | — | `test/integration/ab-tests-title-desc.test.ts` → `ab-tests-title.test.ts`; `test/helpers/ab-fixtures.ts`; `test/{ab-playoff,ab-statistics}.test.ts`; `test/api/cron/ab-evaluate.test.ts`; `test/youtube/{ab-critical,ab-evaluate-phases}.test.ts`; `test/youtube/ab-p2-emenda-n.test.tsx`; o que os greps da Tarefa 4 ainda acharem |
| 8 Migration A | `supabase/migrations/<ts>_ab_tipo_sem_descricao.sql` (nasce no dia; o SQL está no plano, Tarefa 8) | `test/integration/ab-tests-title.test.ts` (o caso "o banco recusa `description`", no mesmo commit da migration) |

**Contagem:** 28 arquivos de código e doc; cerca de 41 arquivos de teste editados (34 da união dos greps, mais
`ab-metadata` e `ab-rotate-dispatch`, `ab-start-internal`, `cms/ab-step-revisar`, `ab-primitives-basic`,
`ab-dashboard` e `ab-variants-route`), 1 renomeado entre eles, 1 novo; 1 migration. `ab-drift-lifecycle` e
`ab-apply-metadata` são só rodados (não citam descrição).

**Lista inteira do A/B (`/tmp/ab-p3-lista.txt`, uns 45 arquivos):** as 36 da união dos greps, mais
`ab-metadata`, `ab-rotate-dispatch`, `ab-start-internal`, `ab-primitives-basic`, `ab-dashboard`,
`ab-variants-route`, `ab-drift-lifecycle`, `ab-apply-metadata` e o novo `ab-p3-recusa-descricao`. **Todo commit
roda a lista inteira**, com saída em arquivo, além do `tsc`: os fixtures das Tarefas 3 e 4 mudam de
comportamento já na Tarefa 1, e `git bisect` não pode parar num commit vermelho.

Ordem obrigatória: **1 → 2 → 3 → 4**, uma por vez, na mesma árvore. A 3 depende da 2 (`TestTypeSchema` e
`pedeDescricao` nascem na 2); a 4 só mexe em teste e depende das três.

---

## 5. As tarefas

Em todas: testes **da lista inteira do A/B** (seção 4) com saída em arquivo
(`cd apps/web && npx vitest run $(cat /tmp/ab-p3-lista.txt) > /tmp/ab-p3-tN.log 2>&1; tail -30 /tmp/ab-p3-tN.log`) e
`npx tsc --noEmit -p apps/web > /tmp/ab-p3-tsc.log 2>&1; tail -20 /tmp/ab-p3-tsc.log` **rodado antes do `git commit`**
(o pre-commit também o roda e recusaria o commit; a Tarefa 2 já foi desenhada para passar no `tsc`, ver B1 em seu passo 8).
Commit sempre por lista de arquivos (`git add <lista> && git commit -m …`); o pre-commit roda
`build:packages` e os typechecks (40 a 60 s).

**Trechos de teste são moldes**: os nomes dos auxiliares (clientes falsos, `enqueueResult`, `baseState`)
têm de ser trocados pelos que o arquivo já usa. O que não muda é a lista de afirmações.

### Tarefa 0: árvore e linha de base

- [ ] Conferir que a P2 está em `origin/staging`: `git merge-base --is-ancestor lote/ab-p2 origin/staging && echo ok`.
- [ ] Criar a árvore (seção 1), **sem** `apps/web/.env.local`; `npm ci` e `npm run build:packages` em
  background com saída em arquivo.
- [ ] Greps de reconferência, guardados em `/tmp/ab-p3-grep-antes.txt` (os três da seção 2 do spec, mais):
  ```bash
  cd apps/web
  grep -rnE "description_text|original_description|originalDescription|descriptionText|description_set|links_resolved|ab_test_tracked_links|description_test" src data test > /tmp/ab-p3-grep1.txt
  grep -rln "'description'" src/lib/youtube/ab-*.ts "src/app/cms/(authed)/youtube/ab-lab" src/lib/pipeline/mcp src/lib/pipeline/services/youtube.ts $(find test -name 'ab-*') > /tmp/ab-p3-grep3.txt
  grep -rn "updateVideoMetadata(" src test > /tmp/ab-p3-grep-uvm.txt
  wc -l /tmp/ab-p3-grep*.txt
  ```
  Se os números divergirem da seção 0 (31 arquivos de teste no grep 1; 36 na união), anote no ledger e
  siga com a lista do dia.
- [ ] **Logan fecha as duas frases** (a do combo e "Tipo fora de uso") e o controlador as cola em `FRASE_COMBO` e
  `ROTULO_TIPO_DESCONHECIDO` **antes da Tarefa 3**. Sem as duas coladas, a Tarefa 3 não começa.
- [ ] Montar `/tmp/ab-p3-lista.txt` (lista inteira da seção 4). Linha de base: rodá-la (saída em arquivo). Tudo
  verde, senão pare e devolva ao controlador.

### Tarefa 1: a escrita nunca leva descrição

**Interfaces.**
- Produz em `src/lib/youtube/ab-metadata.ts`:
  `updateVideoMetadata(videoId: string, title: string, accessToken: string): Promise<void>` — lê o
  `snippet` e reenvia `title` novo, `description` **lida**, `categoryId` e `tags` lidos.
- Produz em `src/lib/youtube/ab-apply.ts`:
  ```ts
  export interface ApplyVariantInput {
    youtubeVideoId: string
    accessToken: string
    testType: TestType            // de ab-types; ainda com 'description' nesta tarefa
    variant: { id?: string; blob_url?: string | null; title_text?: string | null }
    originalTitle?: string | null
  }
  ```
  `ApplyResult` igual. `AppliedMetadata` (`ab-types.ts:107`) perde `description_set` e `links_resolved`.
- Consome: nada de tarefa anterior.

- [ ] **Passo 1, testes que falham.** Em `test/youtube/ab-apply.test.ts`, acrescentar (aceite 12):
  ```ts
  // L6 (Gio): a descrição lida volta byte a byte, qualquer que seja o conteúdo
  it.each([
    ['emoji', 'Viagem 🌍✈️ com acento: ação'],
    ['CRLF', 'linha 1\r\nlinha 2\r\n'],
    ['sinais', 'a < b > c & "d"'],
    ['5000 caracteres', 'x'.repeat(5000)],
  ])('descrição lida (%s) volta igual no PUT', async (_nome, lida) => {
    // montar o videos.list falso com snippet.description = lida; chamar updateVideoMetadata('YT1', 'Novo', 'tok')
    // afirmar: o corpo do PUT leva snippet.description === lida (igualdade estrita)
  })

  it.each(['title', 'combo', 'thumbnail', 'description'] as const)(
    'tipo %s: nunca chama updateVideoMetadata com descrição',
    async (testType) => {
      await applyVariantToYouTube({
        youtubeVideoId: 'YT1', accessToken: 'tok', testType: testType as TestType,
        // variante antiga com descrição gravada no banco: o campo chega por cast, e é ignorado
        variant: { id: 'v1', blob_url: null, title_text: 'Novo', ...({ description_text: 'DESC NOVA' } as object) },
        originalTitle: 'Antigo',
      })
      for (const call of vi.mocked(updateVideoMetadata).mock.calls) {
        expect(call).toHaveLength(3)                 // (videoId, title, token): não existe 4º argumento
        expect(call.join('|')).not.toContain('DESC NOVA')
      }
    },
  )
  it('tipo description não escreve nada no YouTube', async () => {
    const r = await applyVariantToYouTube({ youtubeVideoId: 'YT1', accessToken: 'tok', testType: 'description' as TestType, variant: { id: 'v1', title_text: null } })
    expect(updateVideoMetadata).not.toHaveBeenCalled()
    expect(setThumbnail).not.toHaveBeenCalled()
    expect(r).toMatchObject({ ok: true, appliedThumbnail: false, appliedMetadata: false })
  })
  ```
  Em `test/ab-metadata.test.ts`, trocar os casos de descrição por:
  ```ts
  it('reenvia a descrição lida, nunca outra', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonOk({ items: [{ snippet: { title: 'T0', description: 'DESC NO AR', categoryId: '22', tags: ['a'] } }] }))
      .mockResolvedValueOnce(jsonOk({}))
    await mod.updateVideoMetadata('V1', 'Novo', 'TOKEN')
    const body = JSON.parse(fetchMock.mock.calls[1][1].body)
    expect(body.snippet).toEqual({ title: 'Novo', description: 'DESC NO AR', categoryId: '22', tags: ['a'] })
  })
  it('videos.list sem snippet.description: lança e não envia PUT', async () => {
    fetchMock.mockResolvedValueOnce(jsonOk({ items: [{ snippet: { title: 'T0', categoryId: '22' } }] }))
    await expect(mod.updateVideoMetadata('V1', 'Novo', 'TOKEN')).rejects.toThrow(/sem snippet\.description/)
    expect(fetchMock).toHaveBeenCalledTimes(1)   // só o videos.list; nenhum PUT
  })
  it('description "" lida é reenviada como ""', async () => { /* snippet.description === '' → body.snippet.description === '' */ })
  ```
  Em `test/ab-rotate-dispatch.test.ts`: o caso "guard" (`updateVideoMetadata('V1', null, null, …)`) sai;
  o caso de título passa a `updateVideoMetadata('V1', 'New Title', 'TOKEN')`; o bloco `resolveTemplates in
  rotation context` sai (a rotação não resolve mais modelo; `ab-templates.test.ts` continua testando a função).
- [ ] **Passo 2:** rodar e ver falhar (a chamada tem 4 argumentos hoje; o PUT leva a descrição do argumento).
- [ ] **Passo 3, implementação.** `ab-metadata.ts`:
  ```ts
  export async function updateVideoMetadata(videoId: string, title: string, accessToken: string): Promise<void> {
    // … mesmo videos.list de hoje …
    body: JSON.stringify({
      id: videoId,
      snippet: {
        title,
        description: snippet.description,   // sempre a lida: o A/B não escreve descrição (P3)
        categoryId: snippet.categoryId,
        tags: snippet.tags ?? [],
      },
    }),
  }
  ```
  Logo antes do `PUT`: `if (typeof snippet?.description !== 'string') throw new Error(\`videos.list sem snippet.description: ${videoId}; nada enviado\`)`
  (no `videos.update` com `part=snippet`, propriedade mutável omitida é **apagada**: falha alto, sem PUT; o `""` vindo da API passa). Fica declarado: o mesmo `PUT` continua apagando `defaultLanguage`/`defaultAudioLanguage` a cada rotação até a P4a.
  (O guard `if (title === null && description === null) return` sai; quem chama não chama sem título.)
  `ab-apply.ts`, o bloco de metadados inteiro vira:
  ```ts
  if (testType === 'title' || testType === 'combo') {
    const titleToSet = variant.title_text ?? originalTitle ?? null
    if (titleToSet) {
      await updateVideoMetadata(youtubeVideoId, titleToSet, accessToken)
      appliedMetadata = true
      meta.title_set = titleToSet
    }
  }
  ```
  Saem os imports de `resolveTemplates` e `getSupabaseServiceClient`, `originalDescription` e
  `variant.description_text`. O comentário do topo deixa de falar em descrição e links.
- [ ] **Passo 4, chamadores.** Em `ab-rotate-phases.ts:170-182` e `AB/actions.ts:812-824`, `:1235-1247`,
  `:1339-1351`: sai `description_text` da variante e `originalDescription`; o cast
  `as 'thumbnail' | 'title' | 'description' | 'combo'` vira `as TestType` (import de `ab-types`). Em
  `revertWinner` (`AB/actions.ts:1503-1513`):
  ```ts
  if ((testType === 'title' || testType === 'combo') && test.original_title) {
    await updateVideoMetadata(video.youtube_video_id as string, test.original_title as string, preflight.accessToken)
  }
  ```
  e `original_description` sai do `select` de `:1471`. Os `select` de `:770` e `:1180` e `:1300` perdem
  `original_description`; os de variantes (`:783`, `:1312`) perdem `description_text`.
- [ ] **Passo 5, testes existentes.** Ajustar as afirmações de descrição (remover, nunca pular) em
  `ab-cron-rotate` (`:312-346`, `:388`, `resolveTemplates` em `:239`, `:333-342`), `ab-force-rotate`
  (`:197`, `:239-267`), `ab-actions-resume` (`:209-219`), `ab-p3-actions` (`:408`, `:610`, `:638`: a
  chamada esperada passa a ter 3 argumentos), `ab-drift-lifecycle`, `api/cron/ab-rotate`,
  `ab-apply-metadata`. Onde o teste de descrição era o único caso de um `it`, o `it` sai; onde era um tipo
  num `it.each`, o tipo sai da lista.
- [ ] **Passo 6:** rodar a lista inteira e o `tsc`. Verde.
- [ ] **Passo 7, commit** (na árvore `lote/ab-p3`):
  `fix: A/B Lab P3, Tarefa 1: rotação, retomar, forçar, aplicar e reverter nunca enviam descrição diferente da que está no ar`.

### Tarefa 2: o pipeline recusa descrição com 422 (REST e MCP, um commit)

**Interfaces.** Em `src/lib/youtube/ab-schemas.ts` nasce:

```ts
/** Os tipos de teste que existem desde a P3 (10/2026). */
export const TIPOS_DE_TESTE = ['thumbnail', 'title', 'combo'] as const
export const TestTypeSchema = z.enum(TIPOS_DE_TESTE)

/** A descrição saiu do A/B Lab (P3). Única recusa com 422 do A/B. */
export const DESCRICAO_FORA_DO_TESTE = {
  code: 'DESCRICAO_FORA_DO_TESTE',
  message: 'A descrição não participa mais do teste A/B',
  status: 422,
} as const

const TIPO_DESCRICAO = 'description'

/** true se o pedido põe descrição num teste: tipo 'description', ou `description_text` não nulo
 *  (inclusive "") em alguma variante. Recebe sempre o vetor: o desembrulho do corpo `{ variants: [...] }`
 *  é da rota REST (D5), não desta função. */
export function pedeDescricao(input: { test_type?: unknown; variants?: unknown[] }): boolean {
  if (input.test_type === TIPO_DESCRICAO) return true
  // L2 (Gio): a chave legada `description` também conta; o Zod a descartaria em silêncio (sucesso falso, proibido pelo spec)
  return (input.variants ?? []).some(v => typeof v === 'object' && v !== null
    && ((v as Record<string, unknown>).description_text != null || (v as Record<string, unknown>).description != null))
}
```

`VariantPayloadSchema.description_text` vira
`z.string().nullable().optional().describe('Fora do teste desde 10/2026: só null é aceito; texto devolve 422 DESCRICAO_FORA_DO_TESTE')`
(sem `max`; D3). **L2:** o shape do MCP também declara `description` (o mesmo `.describe` de `description_text`), para que a chave chegue a `pedeDescricao` e devolva 422 no REST e no MCP; a rota roda `pedeDescricao` sobre o corpo cru, antes do parse do Zod. `TestType` em `ab-types.ts` **ainda** tem `'description'` nesta tarefa (sai na 3);
`validateTypeSpecificFields` recebe `z.infer<typeof TestTypeSchema>`.

No serviço (`services/youtube.ts`), lista fechada amarrada ao tipo do banco (D11; `ab_test_variants` tem 14
colunas, a lista leva 13, só `description_text` fica de fora):

```ts
type ColunaVariante = keyof Database['public']['Tables']['ab_test_variants']['Row']
const CAMPOS_DA_VARIANTE = ['id', 'test_id', 'label', 'is_original', 'blob_url', 'blob_key', 'file_size_bytes',
  'dimensions', 'title_text', 'metadata', 'sort_order', 'source_variant_id', 'created_at'] as const satisfies readonly ColunaVariante[]
// coluna nova no banco obriga alguém a decidir (entra na lista ou sai de propósito), em vez de sumir em silêncio
type _Cobre = Exclude<ColunaVariante, (typeof CAMPOS_DA_VARIANTE)[number] | 'description_text'> extends never ? true : never
const _cobre: _Cobre = true
```

aplicada em `listVariants`, `listAbTests` e `getAbTest`. `source_variant_id` (a linhagem do playoff, de
`20260529000001_playoff_mode.sql:15`) hoje chega ao Cowork pelo `select('*')` e não pode sumir.

- [ ] **Passo 1, testes que falham**, em `test/youtube/ab-p3-recusa-descricao.test.ts` (novo; cliente
  falso por tabela, molde de `test/youtube/ab-pipeline-null-aviso.test.ts`):
  ```ts
  describe('P3: a descrição não participa do teste', () => {
    it('constante', () => {
      expect(DESCRICAO_FORA_DO_TESTE).toEqual({ code: 'DESCRICAO_FORA_DO_TESTE', message: 'A descrição não participa mais do teste A/B', status: 422 })
    })
    it.each([
      [{ variants: [{ label: 'B', description_text: 'x' }] }, true],
      [{ variants: [{ label: 'B', description_text: '' }] }, true],            // Foco 2
      [{ variants: [{ label: 'B', description_text: null }] }, false],
      [{ variants: [{ label: 'B' }] }, false],
      [{ variants: [{ label: 'B', description: 'x' }] }, true],                // L2 do Gio: chave legada `description`
      [{ test_type: 'description' }, true],
      [{ test_type: 'combo' }, false],
    ])('pedeDescricao(%j) = %s', (input, esperado) => expect(pedeDescricao(input)).toBe(esperado))

    it('upsertVariants com description_text "x" → 422, sem gravar', async () => {
      await expect(upsertVariants(ctx, TEST_ID, [{ label: 'B', title_text: 'T', description_text: 'x' }]))
        .rejects.toMatchObject({ status: 422, code: 'DESCRICAO_FORA_DO_TESTE', message: 'A descrição não participa mais do teste A/B' })
      expect(fake.upserts('ab_test_variants')).toHaveLength(0)
    })
    it('upsertVariants com description_text null → aceito; a linha gravada não tem description_text', async () => {
      fake.teste({ status: 'draft', test_type: 'title', site_id: SITE })
      await upsertVariants(ctx, TEST_ID, [{ label: 'B', title_text: 'T', description_text: null }])
      expect(fake.upserts('ab_test_variants')[0][0]).not.toHaveProperty('description_text')
    })
    it('teste gravado como description → 422 (não 400 "Unknown test type")', async () => {
      fake.teste({ status: 'draft', test_type: 'description', site_id: SITE })
      await expect(upsertVariants(ctx, TEST_ID, [{ label: 'B', title_text: 'T' }])).rejects.toMatchObject({ status: 422 })
    })
    it('teste gravado com tipo desconhecido → 400 VALIDATION_ERROR', async () => { /* test_type: 'xyz' → status 400 */ })
    it('MCP upsert_variants com dry_run padrão e description_text → erro DESCRICAO_FORA_DO_TESTE', async () => { // Foco 1
      const r = await manageAbTest({ action: 'upsert_variants', test_id: TEST_ID, variants: [{ label: 'B', description_text: 'x' }] })
      expect(r.isError).toBe(true)
      expect(JSON.parse(r.content[0].text)).toMatchObject({ code: 'DESCRICAO_FORA_DO_TESTE', message: 'A descrição não participa mais do teste A/B' })
    })
    it('MCP upsert_variants dry_run:false → mesmo code e mesma mensagem que o REST', async () => { /* idem */ })
    it('listVariants, getAbTest e listAbTests não entregam description_text nem original_description, e entregam source_variant_id', async () => {
      /* fixture com as colunas preenchidas, inclusive source_variant_id; afirma ausência das duas primeiras chaves e PRESENÇA de source_variant_id (mata o mutante "lista curta") */
    })
    it('getAbTestFunnel não lê ab_test_tracked_links e entrega link_clicks null, per_link [] e link_clicks_window null', async () => {
      // fixture com ciclos; o cliente falso falha o teste se .from('ab_test_tracked_links') for chamado
    })
    it('getAbTest entrega tracked_links: []', async () => { /* idem */ })
    it('PATCH de inteligência com action_type description_test → 400 com a frase', () => {
      const r = PatchPayloadSchema.safeParse({ task_id: UUID, video_recommendations: [{ video_id: UUID, action_type: 'description_test', priority: 'low', confidence: 0.5, reasoning: 'r' }] })
      expect(r.success).toBe(false)
      expect(r.error!.issues[0].message).toContain('a descrição não participa mais do teste A/B')
    })
    it('prompt ab-ideate com test_type description lança a mensagem', async () => { /* prompts.ts */ })
    it('prompt ab-write sobre teste gravado como description rejeita com a mensagem; o texto nunca contém "undefined"', async () => { /* youtube-mcp-prompts.test.ts; idem tipo desconhecido → "Tipo de teste desconhecido" */ })
  })
  ```
  Em `test/api/pipeline/ab-variants-route.test.ts` (D5): com `parseBody` devolvendo
  `{ variants: [{ label: 'B', title_text: 'T' }] }`, `upsertVariants` é chamado com o **vetor**
  `[{ label: 'B', title_text: 'T' }]`; com o vetor cru, também. **O caso do 422 não pode ser tautológico**
  (o mock atual de `serviceErrorToResponse` é cópia da lógica): usar a implementação real
  (`vi.importActual('@/lib/pipeline/services/http-adapter')`) e afirmar que `pipelineError` foi chamado com
  `('DESCRICAO_FORA_DO_TESTE', 'A descrição não participa mais do teste A/B', 422, auth)`. E um caso com o
  **serviço real e um cliente falso**: o corpo do doc `{ variants: [{ label: 'B', description_text: 'x' }] }`
  devolve HTTP 422 (prova D5 e o 422 juntos).
- [ ] **Passo 2:** rodar e ver falhar.
- [ ] **Passo 3, `ab-schemas.ts`:** o bloco da interface acima.
- [ ] **Passo 4, serviço (`services/youtube.ts`).**
  - `upsertVariants`, **antes** do `safeParse` (para texto longo dar 422, não 400):
    ```ts
    if (pedeDescricao({ variants })) err(DESCRICAO_FORA_DO_TESTE.code, DESCRICAO_FORA_DO_TESTE.message, DESCRICAO_FORA_DO_TESTE.status)
    ```
    e, depois de ler o teste, antes do `TestTypeSchema.safeParse`:
    ```ts
    if (pedeDescricao({ test_type: test.test_type })) err(DESCRICAO_FORA_DO_TESTE.code, DESCRICAO_FORA_DO_TESTE.message, DESCRICAO_FORA_DO_TESTE.status)
    ```
  - `validateTypeSpecificFields`: sai o ramo `description` (`:1327-1329`) e o parâmetro perde
    `description_text`; a linha gravada (`:1399`) perde `description_text`.
  - D11: `CAMPOS_DA_VARIANTE` (com `source_variant_id` e a amarra ao tipo da interface acima), `projetarVariante(row) = copiar(row, CAMPOS_DA_VARIANTE)`; `listVariants`
    devolve `.map(projetarVariante)`; em `projetarTeste`, `out.variants = ((row.variants ?? []) as Record<string, unknown>[]).map(projetarVariante)`;
    `listAbTests` tira `description_text` do `select` (`:1041`); `original_description` sai de
    `CAMPOS_DO_TESTE_QUE_SAEM_COMO_VIERAM` (`:988`). Tipos `AbTestListItem.variants[]` (`:149`),
    `WinnerVariant` (`:193`) e `VariantRow` (`:223`) perdem `description_text`; o `select` de
    `getAbPerformance` (`:1215`) também.
  - D4: `getAbTest` tira `tracked_links:ab_test_tracked_links!ab_test_id(*)` do `select` e grava
    `detail.tracked_links = []`; `getAbTestFunnel` apaga a leitura de links e a contagem de cliques
    (`:1123-1170`), lendo só os ciclos, e devolve
    `{ per_variant: variantIds.map(id => ({ variant_id: id, impressions: null, clicks: null, link_clicks: null })), per_link: [], link_clicks_window: null, aviso }`.
    `PerVariantFunnel.link_clicks` vira `number | null`; o comentário de `link_clicks_window` diz "null:
    o A/B não tem mais link rastreado (P3)". `interface TrackedLink` sai.
  - `getAbPerformance`/`aggregate` (`:1557-1558`): o ramo `'desc'` sai e `kind` vira
    `testType === 'title' ? 'title' : 'thumb'` **depois de** `if (!(TIPOS_DE_TESTE as readonly string[]).includes(testType)) continue`
    (teste antigo de descrição fica fora do aprendizado, em vez de pôr etiqueta de descrição no de thumbnail).
- [ ] **Passo 5, rota REST (D5)** em `src/app/api/pipeline/youtube/ab-tests/[id]/variants/route.ts`:
  ```ts
  const variants = Array.isArray(body) ? body : (body as { variants?: unknown } | null)?.variants
  const { data } = await upsertVariants(ctx, id, variants as VariantInput[])
  ```
- [ ] **Passo 6, MCP.**
  - `mcp/tools.ts:678`: `description_text` igual ao da interface (D3, sem `max`, com o `describe`). O
    texto de `action` (`:665`) troca "link clicks are human clicks…" por "link_clicks is null and per_link
    is empty: the A/B has no tracked links since 10/2026" e acrescenta "upsert_variants: description_text
    must be null or absent; any text returns DESCRICAO_FORA_DO_TESTE (422)". **`:721` não muda** (é
    `manage_competitors`).
  - `mcp/services/ab-tests.ts`, `case 'upsert_variants'`, logo depois das duas validações de presença:
    ```ts
    if (pedeDescricao({ variants })) {
      return toMcpError(new PipelineServiceError(DESCRICAO_FORA_DO_TESTE.code, DESCRICAO_FORA_DO_TESTE.message, DESCRICAO_FORA_DO_TESTE.status))
    }
    ```
    e `proposed_variants` perde `description_text`.
  - `mcp/errors.ts`, em `ERROR_MAP`:
    ```ts
    DESCRICAO_FORA_DO_TESTE: {
      severity: 'recoverable',
      retryable: false,
      recovery_action: 'Remove description_text (or send null) and resend only title and thumbnail. The A/B Lab no longer tests the description.',
    },
    ```
  - `mcp/prompts.ts:624-637` (`ab-ideate`, D10): descrição do prompt e do argumento passam a "thumbnail, title, or
    combo"; a validação vira
    ```ts
    if (pedeDescricao({ test_type: testType })) throw new Error(DESCRICAO_FORA_DO_TESTE.message)
    if (!(TIPOS_DE_TESTE as readonly string[]).includes(testType)) throw new Error(`Invalid test_type: ${testType}. Must be thumbnail, title, or combo.`)
    ```
    `ab-write` (`:694-780`), logo depois de ler o teste:
    ```ts
    if (pedeDescricao({ test_type: test.test_type })) throw new Error(DESCRICAO_FORA_DO_TESTE.message)
    if (!TestTypeSchema.safeParse(test.test_type).success) throw new Error('Tipo de teste desconhecido')
    ```
    (sem isso, um teste antigo de descrição geraria prompt com `undefined` no lugar das instruções, em
    silêncio; entra **nesta** tarefa porque a Tarefa 3 tira as chaves). `:718` perde `original_description`
    do `select`; `:838` e `:858` perdem `description_text`.
- [ ] **Passo 7, inteligência (D9)**, `intelligence-schemas.ts:5-9`: `'description_test'` sai do enum, com
  `errorMap` no molde do `NotificationSchema` (`:34-43`):
  `issue.received === 'description_test' ? 'tipo de recomendação não aceito: a descrição não participa mais do teste A/B (10/2026). Aceitos: …' : 'tipo de recomendação não aceito: <valor>. Aceitos: …'`.
- [ ] **Passo 8, `prompt-builders-ab.ts` (só o que não quebra o `tsc`; B1).** Os mapas
  `Record<Locale, Record<TestType, string>>` (`:11`, `:54`) e os dois literais de `:361-362` indexados por
  `testType` **exigem** a chave `description` enquanto `TestType` a tiver (sai na Tarefa 3, passo 3). Aqui
  saem **só**: a linha `description_text` dos modelos de **título e combo** (`:23` e `:43`: hoje *mandam* o
  Cowork enviar `description_text` no combo, e isso tem de sair junto com o 422), o campo em `:445` e a
  linha `description:` de `:463` (revisão), e, no mesmo commit, `prompts.ts:838` e `:858` (passo 6). Ficam
  para a Tarefa 3: as chaves `description` de `:14`, `:34`, `:70`, `:100` e dos dois mapas de `:361-362`, e o
  rótulo `'Título + thumbnail'` / `'Title + thumbnail'`. As afirmações de `prompt-builders-ab.test.ts` se
  dividem do mesmo jeito. **Prova:** `npx tsc --noEmit -p apps/web` limpo no commit da Tarefa 2.
- [ ] **Passo 9, registry e doc (Pipeline Integrity).** `api-registry.ts:166`: "title/description A/B
  testing" → "title and thumbnail A/B testing"; `:192` ganha "(description_text only null; text → 422)".
  **`endpoint_count` não muda.** `cowork-docs-youtube.md`: `:13` sem "description"; `:178` sem
  `description_test`; `:471`, `:517`, `:527` sem a chave `description_text` nos exemplos; `:485` vira
  "- `description_text`: só `null` ou ausente. Texto (inclusive vazio) devolve **422**
  `DESCRICAO_FORA_DO_TESTE`, "A descrição não participa mais do teste A/B". Teste gravado como
  `description` também devolve 422."; o corpo do POST passa a dizer que aceita `{ "variants": [...] }` ou o
  vetor; o bloco do funil (`:1572-1585`) mostra `"link_clicks": null`, `"per_link": []`,
  `"link_clicks_window": null` e a frase "o A/B não cria link rastreado desde 10/2026" (nunca "sem links"); e o
  `PATCH` de inteligência ganha a linha "`description_test` saiu: devolve 400 com a frase". Conferir
  `grep -n "description" docs/cowork-pipeline-reference.md` → nada sobre A/B (seção "Fica FORA").
  **`docs/cowork-youtube-intelligence-reference.md:13` e `:224`** ainda oferecem "description" e
  `description_test`: corrigir as duas linhas neste commit (ficam fora dos greps, que olham só `apps/web`).
- [ ] **Passo 10, testes existentes:** `ab-schemas.test.ts` (o enum tem três; `description_text` com texto
  passa no Zod e é o serviço que recusa), `ab-pipeline-null-aviso.test.ts` (funil e `getAbTest` com links
  vazios; fixtures sem `description_text`), `prompt-builders-ab.test.ts`, `mcp-schema-parity.test.ts`
  (a lista `optional` de `:42` fica igual; o shape de `:121` acompanha o `describe` novo),
  `mcp-schema-reads.test.ts`, `mcp-tools.test.ts:265`, `youtube-mcp-prompts.test.ts`. Snapshot de
  `test/mcp/__snapshots__/mcp-schema-parity.test.ts.snap`: regenerar (`-u`) **só se** o teste falhar por
  ele, e conferir no diff que só mudou o texto do `describe`.
- [ ] **Passo 11:** a lista inteira e o `tsc` (antes do `git commit`). Verde.
- [ ] **Passo 12, commit (um só, paridade):**
  `feat: A/B Lab P3, Tarefa 2: pipeline recusa descrição com 422 DESCRICAO_FORA_DO_TESTE (REST e MCP), sem links do teste no funil, POST de variantes aceita o corpo do doc`.

### Tarefa 3: o tipo "Descrição" sai do CMS

**Interfaces.**
- Consome: `TIPOS_DE_TESTE`, `TestTypeSchema`, `DESCRICAO_FORA_DO_TESTE`, `pedeDescricao` (Tarefa 2).
- Produz em `src/lib/youtube/ab-types.ts`: `export type TestType = 'thumbnail' | 'title' | 'combo'`. Saem:
  `AbTestRow.original_description`, `AbTestVariantRow.description_text`, `VariantStats.description_text`,
  `CreateTextVariantInput.description_text` e `.link_destinations`, `AbTestResults.tracked_links`,
  `AbTestDraftVariant.descriptionText`, `AbTestTrackedLinkRow` (sem leitor). `changeType` (`:534`) fica.
- Produz em `AB/_components/ab-constants.ts`:
  ```ts
  export const ROTULO_TIPO_DESCONHECIDO = 'Tipo fora de uso'
  export const FRASE_COMBO = 'mede o conjunto; não separa título de thumbnail'
  /** Tipo lido do banco pode estar fora dos três (teste antigo de descrição): nunca undefined. */
  export function tipoMeta(t: string): { icon: string; label: string; hint: string } {
    return (TYPE_META as Record<string, { icon: string; label: string; hint: string }>)[t]
      ?? { icon: 'HelpCircle', label: ROTULO_TIPO_DESCONHECIDO, hint: '' }
  }
  ```
  com `TYPE_META.combo = { icon: 'Layers', label: 'Título + thumbnail', hint: FRASE_COMBO }`.

- [ ] **Passo 1, testes que falham.**
  - `test/youtube/ab-constants.test.ts`: `Object.keys(TYPE_META)` é `['thumbnail', 'title', 'combo']`;
    `tipoMeta('description').label === 'Tipo fora de uso'`; `tipoMeta('xyz').icon === 'HelpCircle'`;
    `TYPE_META.combo.label === 'Título + thumbnail'`.
  - `test/youtube/ab-primitives-basic.test.tsx` (Foco 3): `render(<TypeBadge type={'description' as TestType} />)`
    não lança e mostra "Tipo fora de uso".
  - `test/cms/ab-step-revisar.test.tsx` e `test/ab-dashboard.test.tsx` (ou o teste do cartão de
    sugestão): item com `type: 'description'` por cast renderiza com o rótulo de reserva.
  - `test/cms/ab-step-tipo.test.tsx` e `test/youtube/ab-step-tipo.test.tsx`: três opções, na ordem
    "Título + thumbnail", "Thumbnail", "Título"; nenhum texto "Descrição", "recomendado" nem "pontual";
    a frase "mede o conjunto; não separa título de thumbnail" aparece no cartão do combo.
  - `test/cms/ab-step-variantes.test.tsx` e `test/youtube/ab-step-variantes.test.tsx`: em `combo`,
    `title` e `thumbnail`, nenhum campo de descrição nem o acordeão "Avançado · variações de descrição"
    (`queryByText(/descri/i)` nulo).
  - `test/ab-start-internal.test.ts` (Foco 5, D8): rascunho com `test_type: 'description'` →
    `{ ok: false, error: 'A descrição não participa mais do teste A/B' }`, sem `setThumbnail` e sem
    `update` em `ab_tests`; com `test_type: 'xyz'` → "Tipo de teste desconhecido".
  - `test/ab-actions-create.test.ts`: `createAbTest({ …, test_type: 'description' as TestType })` →
    `{ ok: false, error: DESCRICAO_FORA_DO_TESTE.message }` sem ler o YouTube; combo grava
    `original_title` e **não** envia a chave `original_description` no `insert`.
  - `test/ab-actions-text-variant.test.ts`: `createTextVariant` em teste gravado como `description` →
    recusa com a mensagem; em teste `title` com `description_text` vindo por cast → a linha inserida não
    tem `description_text` e nada é inserido em `ab_test_tracked_links`. `updateTextVariant` com
    `{ description_text: 'x' }` por cast → o `update` recebe só `title_text` e `metadata`; idem
    `uploadVariant` com `description_text` no `FormData` (lista explícita).
  - `test/youtube/prompt-builders-ab.test.ts`: os mapas só têm `thumbnail`, `title` e `combo`; o rótulo do
    combo é `Título + thumbnail` / `Title + thumbnail`.
  - Rascunho antigo de descrição na lista de rascunhos (`drafts-block`): mostra "Tipo fora de uso", nunca
    "description" cru.
- [ ] **Passo 2:** rodar e ver falhar.
- [ ] **Passo 3, tipos e `prompt-builders-ab.ts` (B1).** `ab-types.ts` como na interface; **no mesmo passo**
  saem de `prompt-builders-ab.ts` as chaves `description` de `:14`, `:34`, `:70`, `:100` e dos dois mapas
  de `:361-362`, e o rótulo do combo vira `'Título + thumbnail'` / `'Title + thumbnail'` (o resto do arquivo
  saiu na Tarefa 2); `npx tsc --noEmit -p apps/web` passa a apontar
  os consumidores (os quatro `Record<TestType, …>` com chave sem aspas quebram sozinhos; grep não os vê).
  `intelligence-types.ts:174`, `:204` e `ab-lab-dashboard.tsx:62` trocam o union escrito à mão por
  `TestType` (e `'all' | TestType` no filtro).
- [ ] **Passo 4, servidor do CMS (`AB/actions.ts`).**
  - `createAbTest`: logo depois de `requireEditAccess`, `if (pedeDescricao({ test_type: input.test_type })) return { ok: false, error: DESCRICAO_FORA_DO_TESTE.message }`;
    sai `originalDescription` (`:148`, `:172`, `:216`); a mensagem de `:188` vira "Could not read the
    video's current title. Reconnect this channel's YouTube access and try again.".
  - `updateAbTestType`: `if (!TestTypeSchema.safeParse(newType).success) return { ok: false, error: pedeDescricao({ test_type: newType }) ? DESCRICAO_FORA_DO_TESTE.message : 'Tipo de teste desconhecido' }`.
  - `uploadVariant` (`:373`): sai a linha `description_text`.
  - `createTextVariant`: lê `test_type`; se `pedeDescricao({ test_type: test.test_type })`, recusa com a
    mensagem; o `insert` perde `description_text`; o bloco de links (`:1086-1105`) sai inteiro; saem os
    imports de `parseTemplateTokens` e `ensureTrackedLink` se ficarem sem uso.
  - `updateTextVariant`: o tipo de `updates` perde `description_text`; o `update` passa a gravar
    `{ title_text, metadata }` montado explicitamente (nunca o objeto recebido inteiro).
  - `fetchAbTestVariants` (`:1677-1712`, sem chamador em `src`): perde `description_text`.
- [ ] **Passo 5, `ab-start.ts` (D8):** o `select` de `:60` ganha `test_type`; depois da checagem de
  `status`:
  ```ts
  if (pedeDescricao({ test_type: test.test_type })) return { ok: false, error: DESCRICAO_FORA_DO_TESTE.message }
  if (!TestTypeSchema.safeParse(test.test_type).success) return { ok: false, error: 'Tipo de teste desconhecido' }
  ```
- [ ] **Passo 6, `AB/queries.ts`:** `:194` e `:508` perdem `description_text`/`descriptionText`; o bloco
  de links (`:236-239`) e `tracked_links` do retorno (`:263`) saem, com o import de `AbTestTrackedLinkRow`;
  `:562` e `:573`: `kind` perde `'desc'` (`testType === 'title' ? 'title' : 'thumb'`, depois de
  `if (!(TIPOS_DE_TESTE as readonly string[]).includes(testType)) continue`, como no serviço do pipeline).
- [ ] **Passo 7, telas.**
  - `step-tipo.tsx:21-26`: a lista vira
    ```ts
    { type: 'combo',     icon: Layers, title: 'Título + thumbnail', desc: 'Título e thumbnail mudam juntos', extra: FRASE_COMBO },
    { type: 'thumbnail', icon: Image,  title: 'Thumbnail',          desc: 'Só a miniatura muda' },
    { type: 'title',     icon: Type,   title: 'Título',             desc: 'Só o título muda' },
    ```
    (sai o selo "recomendado"; sai o import de `FileText`). A frase vem de `FRASE_COMBO` (constante única, caixa fechada pelo Logan); o
    Logan passa `desc` e `extra` **antes** desta tarefa (H7), para o executor não voltar nem o Gio recapturar.
  - `step-variantes.tsx`: saem `showsDescription` (`:45`), o campo (`:447-470`), o acordeão
    `DescriptionAccordion` (`:497-595`) e seu uso (`:705-708`); `:395` perde a condição (`type !==
    'description'` era sempre verdadeiro nos tipos que restam); `descriptionText` sai da interface `:20`.
  - `step-revisar.tsx:38-43` e `suggested-card.tsx:8-13`: `combo: 'título + thumbnail'`, chave
    `description` sai; a leitura passa por `TYPE_LABELS_PT[type as TestType] ?? ROTULO_TIPO_DESCONHECIDO.toLowerCase()`.
  - `ab-primitives.tsx:129`: `TYPE_ICONS` perde `description` e ganha reserva: `TypeBadge` usa
    `tipoMeta(type)` e `TYPE_ICONS[type as TestType] ?? HelpCircle`.
  - `drafts-block.tsx:78`: `TYPE_META[draft.type]?.label ?? draft.type` vira `tipoMeta(draft.type).label`
    (rascunho antigo de descrição não mostra "description" cru).
  - `ab-lab-dashboard.tsx:62-72`: filtro `'all' | TestType`; rótulos `{ all: 'Todos os tipos', thumbnail:
    'Thumbnail', title: 'Título', combo: 'Título + thumbnail' }`.
  - `ab-create-wizard.tsx`: `descriptionText` sai do estado (`:48`, `:150`, `:154`, `:235`, `:264`);
    `suggestedDescription` (`:53`) sai; `:429` (anexar descrição no `FormData`) sai; `:440-455` cobre só
    `state.type === 'title'` e não envia `description_text`.
  - `lib/youtube/ab-wizard-reducer.ts:21`, `:71`, `:75`, `:155`: `descriptionText` sai.
- [ ] **Passo 8, testes existentes** (afirmações de descrição removidas, nunca puladas): `ab-wizard-reducer`
  (cms e youtube), `ab-wizard-components` (`:132`, `:150`, `:487`, `:841`, `:877`), `ab-wizard-integration`,
  `ab-high` (`:405`, `:448`), `ab-low` (`:87`), `ab-actions-create` (`:364`: `it.each(['title', 'combo'])`).
- [ ] **Passo 9:** a lista inteira e o `tsc` (antes do `git commit`). Verde.
- [ ] **Passo 10, commit:**
  `feat: A/B Lab P3, Tarefa 3: o tipo Descrição sai do CMS; combo vira "Título + thumbnail"; tipo desconhecido tem rótulo de reserva e não inicia`.

### Tarefa 4: limpeza dos testes e prova de completude

- [ ] `git mv apps/web/test/integration/ab-tests-title-desc.test.ts apps/web/test/integration/ab-tests-title.test.ts`.
  No arquivo novo: sai o `describe('description test type with tracked links')` inteiro (`:142-310`); no
  `combo` (`:312-381`), o teste de `:324` passa a gravar e conferir só `original_title`, e o de `:356` só
  `blob_url + title_text`; `cycles with applied_metadata` (`:383+`) tira `description_set` e
  `links_resolved` do JSON de exemplo. O caso "o banco recusa `description`" **não entra aqui**: vai com a
  Migration A (Tarefa 8), porque antes dela o banco aceita.
- [ ] Remover as afirmações e campos de descrição de: `test/helpers/ab-fixtures.ts`, `test/ab-playoff.test.ts`,
  `test/ab-statistics.test.ts`, `test/api/cron/ab-evaluate.test.ts`, `test/youtube/ab-critical.test.ts`,
  `test/youtube/ab-evaluate-phases.test.ts` (`:299`: `it.each(['title'])`), `test/youtube/ab-p2-emenda-n.test.tsx`,
  e o que o grep abaixo ainda achar.
- [ ] **Prova de completude (aceite 10)**, as três partes do spec com as exceções medidas:
  1. `npx tsc --noEmit -p apps/web` limpo, com `TestType` de três valores.
  2. ```bash
     cd apps/web && grep -rnE "description_text|original_description|originalDescription|descriptionText|description_set|links_resolved|ab_test_tracked_links|description_test" src data test \
       | grep -vE "^src/types/database\.types\.ts:|^src/lib/youtube/coleta/meta-step\.ts:|^test/youtube/coleta/meta-step\.test\.ts:|^test/integration/youtube-channel-remove\.test\.ts:|^test/youtube/ab-p3-recusa-descricao\.test\.ts:|^test/api/pipeline/ab-variants-route\.test\.ts:"
     ```
     Sobra permitida, linha a linha (anotar no ledger): `src/lib/youtube/ab-schemas.ts` (a regra e o campo
     declarado, D2 e D3); `src/lib/pipeline/mcp/tools.ts` (o campo declarado no shape, D3);
     `src/lib/youtube/intelligence-schemas.ts` (o `errorMap` de `description_test`, D9);
     `data/pipeline-docs/cowork-docs-youtube.md` (o doc do 422 e de `description_test`);
     `test/mcp/mcp-schema-parity.test.ts` e `test/mcp/mcp-tools.test.ts` (o campo declarado);
     `test/ab-actions-text-variant.test.ts` e `test/ab-actions-create.test.ts` (os testes de recusa da
     Tarefa 3). Qualquer outra linha: conserte.
  3. ```bash
     grep -rn "'description'" src/lib/youtube/ab-*.ts "src/app/cms/(authed)/youtube/ab-lab" src/lib/pipeline/mcp src/lib/pipeline/services/youtube.ts $(find test -name 'ab-*')
     ```
     Sobra permitida: `ab-schemas.ts` (`TIPO_DESCRICAO`, a única cópia do literal), `ab-types.ts:534`
     (`changeType`), `mcp/tools.ts:721` (`manage_competitors`), e os testes de recusa e de rótulo de
     reserva das Tarefas 2 e 3.
- [ ] A lista inteira do A/B (seção 4) e `HAS_LOCAL_DB=1 npx vitest run
  test/integration/ab-tests-title.test.ts` contra o `bythiago_int` (54421/54422), saída colada no ledger.
- [ ] Commit (com `git add -A apps/web/test/integration` para registrar o `mv`, e o resto por lista):
  `test: A/B Lab P3, Tarefa 4: testes sem descrição; ab-tests-title-desc vira ab-tests-title; greps de completude limpos`.

### Tarefa 5: prova local, capturas e revisão de tela

- [ ] `npx tsc --noEmit` do web e da api; **suíte inteira** em background com saída em arquivo
  (`npx vitest run > /tmp/ab-p3-suite.log 2>&1`, ~160 s); `npm run build:web` com saída em arquivo (lê
  `apps/web/.env.production.local`, seção 1). Só as falhas entram no contexto.
- [ ] **Gio (`gio-qa`, Sonnet, `medium`), com o corte de H8:** antes (`origin/staging`, porta 3998) e depois
  (a árvore da P3, porta 3999) **só em "tipo" e "variantes"**; as outras telas (passo "revisar" em combo; o
  painel com o filtro de tipo aberto; o detalhe e o cartão de um **teste antigo de descrição**, semente)
  **só "depois"**, a 1440 px nos dois temas e a 390 px no tema claro; o passo "tipo" fica completo (1440 e
  390, dois temas, antes e depois, porque é onde o layout muda: 4 cartões viram 3). Em
  `docs/superpowers/mockups/2026-10-14-ab-lab-p3-retirada/shots/`. Veredito em texto, tela por tela.
  - **Semente local** no banco **54321/54322** (o do navegador), linhas marcadas e removíveis (uuids
    prefixados, site `localhost`, vídeos e canal exclusivos do Gio): um teste `completed` com
    `test_type = 'description'` (o banco local ainda aceita: a Migration A não está nele), duas variantes,
    uma com `description_text`; um rascunho `combo`; **um teste `active` combo com ciclo aberto e `applied_metadata` antigo contendo `description_set` e `links_resolved` (P3-L5)**, cujo detalhe e histórico de ciclo entram nas capturas "depois" (abre sem erro, sem "undefined", nulo ou 0). Modelo de colunas:
    `test/integration/ab-tests-title.test.ts`.
  - **Não clicar:** iniciar, sincronizar, upload, conectar conta. Servidor com
    `AWS_SES_ACCESS_KEY_ID=LOCALDUMMY AWS_SES_SECRET_ACCESS_KEY=localdummy NTFY_URL=http://127.0.0.1:9`.
    Contexto Playwright novo por captura; PID guardado e encerrado só o próprio.
  - **Leitura por script:** contagem de cartões no passo "tipo" (4 antes, 3 depois); `queryByText(/descri/i)`
    no passo "variantes" (presente antes, ausente depois); o rótulo do teste antigo ("Tipo fora de uso").
  - Ao fim: apagar a semente por id e conferir contagem zero; apagar `apps/web/.env.development.local` e
    `apps/web/.env.production.local`.
- [ ] **Logan e Naksu (Sonnet, `medium`), em paralelo, uma passada** (as duas frases, a do combo e "Tipo fora de
  uso", já vieram do Logan antes da Tarefa 3; aqui só se **confere** na tela): o cartão "Título + thumbnail" com a
  frase "mede o conjunto; não separa título de thumbnail" se lê sem o selo; três cartões numa grade que
  era de quatro deixam buraco a 1440 e a 390?; "Tipo fora de uso" comunica "teste antigo, tipo que não
  existe mais" sem parecer erro? (Opera: `color-mix()` transparente; a frase precisa de contraste
  literal.)
- [ ] Capturas ao dono, uma linha por tela.

### Tarefa 6: envio

Igual à Tarefa 7 do plano da P2, com estas diferenças:

- [ ] **Pré-condição da junção de volta (H4):** os três arquivos que o checkout principal tinha modificados
  (`api-registry.ts`, `mcp/prompts.ts`, `cowork-docs-youtube.md`) são da **E7 T7** e já foram commitados pela
  A5 (`2168b5def`, cópia de `5cfcdcdf3`, já em `main`). Conferir: `git diff --name-only HEAD -- <os três>` vazio
  no checkout principal. Se não estiver vazio, o controlador da A5 confere o diff contra `5cfcdcdf3` e descarta
  a cópia redundante, com nota no ledger dele; sem isso a junção não começa. A E7 T12 a T16 (esperam a E4)
  nascem de `origin/staging` com a P3.
- [ ] Revisão do lote por **Phil e Yannis** (Opus, `medium`) sobre o `diff` de `origin/staging..lote/ab-p3`;
  conserta-se até haver acordo.
- [ ] As três conferências (a lista inteira do A/B já rodou verde em cada commit): (i) **nenhuma migration no lote** (`git diff --name-only origin/staging lote/ab-p3 -- supabase/` vazio);
  (ii) o teste de integração renomeado rodado contra o `bythiago_int` (Tarefa 4), saída no ledger;
  (iii) `bash scripts/check-type-debt.sh`.
- [ ] **Portões de data:** P2 promovida a `main`; C1 desta P3 colada no ledger na manhã do envio (Tarefa 7).
- [ ] Junção com `origin/staging` na árvore se o remoto andou; `bash -c 'git push origin lote/ab-p3:staging'`
  (**da árvore própria, nunca do `staging` local**); CI verde (conferir a cada push); promoção a `main` depois
  da C2 da P2; o deploy da Vercel em `main` termina; **a conferência P (Tarefa 7, C5) roda nesse dia**.
- [ ] **Junção de volta ao `staging` local** (só para os terminais verem o código; **nada é enviado dali**), com
  o outro terminal avisado (nunca `stash`):
  ```bash
  git diff --name-only HEAD -- $(git diff --name-only origin/staging~N origin/staging) | wc -l   # N = commits do lote; tem de dar 0
  cd apps/web && grep -rnE "description_test|ab_test_tracked_links|originalDescription" src | grep -v database.types   # só as exceções da Tarefa 4
  npx vitest run test/youtube/ab-p3-recusa-descricao.test.ts test/mcp test/lib/pipeline > /tmp/ab-p3-juncao.log 2>&1
  ```
  Atenção especial a `api-registry.ts`, `mcp/prompts.ts` e `cowork-docs-youtube.md` (E7 T7, já commitada
  pela A5; pré-condição acima).
- [ ] Aviso à A5 (E7 e E18): `mcp/tools.ts` e `cowork-docs-youtube.md` mudaram; a E18 não precisa mudar
  nada (a descrição nunca foi lida por ela como escrita do A/B), mas o controlador confirma lendo a
  tabela "quem escreve título e thumbnail" do plano da E18.

### Tarefa 7: produção, conferências do código

Só `select`, por `npx supabase db query --linked --agent=yes -o json`, com autorização do dono na sessão;
se o classificador negar, o Gio põe o `select` num `.sh`, o comando curto vai ao `pbcopy` e o dono cola.

**Padrões para o que a C1 achar (o trabalho não para por pergunta ao dono):**

| Achado | Padrão |
|---|---|
| Teste `completed`/`archived` de tipo descrição | **Não aplicar a Migration A** e deixar a P3 no ar sem ela (seguro: o código não cria nem inicia esse tipo). O destino da linha se decide com a Migration B, que já tem `pg_dump`. **Nunca mudar o tipo para combo** (reescreve o histórico). Só se o dono quiser o CHECK já: apaga-se a linha depois de um `pg_dump` dela |
| Teste vivo (`draft`, `queued`, `active`, `paused`) com tipo descrição, ou com variante com `description_text` | **O envio segue** (a P3 congela a descrição que está no ar e não a piora). A C1 entrega ao dono o vídeo e o `original_description` para ele colar no Studio. Produção hoje não tem nenhum (spec, 09/10) |
| Reversão ainda aberta com descrição na variante vencedora | A C1 lista; o dono reverte antes da **promoção a `main`** se quiser (depois dela o `revertWinner` restaura só o título). O envio a `staging` segue |
| `linhas_ab_test_tracked_links > 0` | **O envio para** (portão de dado, Phil Deve 1): o controlador decide entre manter a leitura até a B ou trocar para `tracked_links: null` e `per_link: null`. Padrão: trocar para `null` |

- [ ] **C1, ANTES do envio (portão), na manhã do dia do envio.** Saída colada no ledger antes do push;
  sem ela o envio não sai. (`ab_tests.youtube_video_id` é uuid, FK de `youtube_videos.id`; o id do YouTube está em `youtube_videos.youtube_video_id`. Conferido em `origin/staging`, Yannis, rodada 2.)
  ```sql
  select t.id, t.status, t.test_type, v0.youtube_video_id as id_no_youtube, t.original_description, t.created_at,
         count(v.id) filter (where v.description_text is not null) as variantes_com_descricao,
         t.original_description is not null as tem_original_description
    from ab_tests t join youtube_videos v0 on v0.id = t.youtube_video_id
         left join ab_test_variants v on v.test_id = t.id
   group by t.id, v0.youtube_video_id order by t.created_at;   -- group by só a PK: válido (dependência funcional); não "consertar"
  select count(*) as linhas_ab_test_tracked_links from ab_test_tracked_links;
  select count(*) as links_ab_test from tracked_links where source_type = 'ab_test';
  select count(*) as cliques_em_links_de_teste
    from link_clicks lc join tracked_links tl on tl.id = lc.link_id
   where tl.source_type = 'ab_test' and lc.is_bot = false;
  -- prova de que nenhum teste mudou descrição no ar: esperado, nenhuma linha
  select t.id, t.test_type, count(*) as ciclos_que_escreveram_descricao
    from ab_test_cycles c join ab_tests t on t.id = c.test_id
   where c.applied_metadata->>'description_set' is not null
   group by t.id, t.test_type;
  -- reversão ainda aberta que perderia a descrição (revertWinner restaura só o título depois da P3)
  select t.id, t.status, t.test_type, t.winner_applied_at, t.revert_expires_at
    from ab_tests t join ab_test_variants w on w.id = t.winner_variant_id
   where t.winner_applied_at is not null and t.revert_expires_at > now() and w.description_text is not null;
  ```
  Esperado: nenhum teste `draft`, `queued`, `active` ou `paused` com `test_type = 'description'` ou
  `variantes_com_descricao > 0`; **`linhas_ab_test_tracked_links = 0`** (portão); nenhuma linha nas duas
  últimas consultas. Cada achado segue o padrão da tabela acima. Depois da P3 o funil deixa de mostrar
  cliques de link (D4); a Migration B decide o destino deles.
- [ ] **C2, depois do deploy:** no `ab-rotate` das 08:00 UTC seguinte ao deploy (05:00 em São Paulo),
  `/api/health` sem falha do `ab-rotate` (como a C2 da P2). **Falso verde declarado:** com zero teste
  ativo prova só que o deploy não quebrou o cron; a prova da escrita é o teste da Tarefa 1. Esta C2 **cobre
  também o dia seguinte da Migration A** (a A não toca o cron; não há conferência separada).
- [ ] **C3, o doc chega ao Cowork com o deploy (não há seed):** logo depois do deploy em `main`, feita dentro da
  C5: `curl -s -H "X-Pipeline-Key: <chave do Claude Code>" https://bythiagofigueiredo.com/api/pipeline/docs/youtube | grep -c DESCRICAO_FORA_DO_TESTE`
  (esperado ≥ 1; o executor confere a rota) e o Claude Code lendo o recurso MCP do doc de YouTube acha a
  linha do 422.
- [ ] **C4, texto ao dono para o Cowork** (uma vez, **no dia do deploy da P3 em `main`**, com o rascunho de
  conferência da C5 ainda aberto; o controlador preenche `<id>`):

  > Sem usar memória nem prompts salvos, faça estas chamadas pelo pipeline e me devolva o JSON cru de cada uma: (1) `manage_ab_test` com `action: 'upsert_variants'`, `test_id: '<id>'`, `dry_run: false` e `variants: [{ "label": "B", "title_text": "conferência P3", "description_text": "teste" }]`; (2) a mesma chamada com `description_text: null`; (3) `manage_ab_test` com `action: 'list_variants'` e o mesmo `test_id`; (4) sem enviar nada: diga se algum prompt ou memória sua ainda sugere teste de descrição, `description_text` com texto ou `description_test`. Não corrija nada, só relate.

  Esperado: (1) erro com `code: 'DESCRICAO_FORA_DO_TESTE'` e a mensagem "A descrição não participa mais
  do teste A/B"; (2) sucesso; (3) a variante B sem a chave `description_text`; (4) vai ao ledger como "dado
  do Cowork".
- [ ] **C5, conferência P (no dia do deploy em `main`; nada depende da Migration A):** Gio com sessão
  autenticada de produção, ou o dono no Opera (`open -a Opera https://bythiagofigueiredo.com/cms/youtube/ab-lab`).
  - O wizard mostra **três** tipos, na ordem "Título + thumbnail", "Thumbnail", "Título", sem "recomendado".
  - Criar um rascunho **combo** `P3 conferência <AAAA-MM-DD>` no vídeo `6jL-jeux_1Y` (o da P4-0, já aprovado
    em B2). Ele abre como "Título + thumbnail". (Escreve no banco e no Blob a cópia da thumbnail original;
    **não** escreve no YouTube. O resíduo é conhecido e vai ao ledger, como o da P4-0.)
  - **422 pelo Claude Code:** `manage_ab_test` `upsert_variants` com `dry_run: false` e
    `description_text: 'teste'` → `DESCRICAO_FORA_DO_TESTE`; o mesmo com `dry_run` padrão → o mesmo erro; com
    `description_text: null` e `title_text: 'conferência P3'` → sucesso. **REST**, com a chave do Claude Code
    (nunca a `PIPELINE_COWORK_KEY`): `POST /api/pipeline/youtube/ab-tests/<id>/variants` com
    `{ "variants": [{ "label": "C", "title_text": "x", "description_text": "y" }] }` → HTTP 422, mesmo `code` e
    mesma mensagem. Respostas salvas em arquivo e resumidas no ledger.
  - **C3** (o doc servido tem o 422) e **C4** (pelo Cowork, colado pelo dono).
  - **Rascunho sem início (Gio 2.2 item 5):** `select t.status, t.started_at, (select count(*) from ab_test_cycles c where c.test_id = t.id) as ciclos from ab_tests t where t.name like 'P3 conferência%'` → `archived`, nulo, 0 (lido depois de arquivar).
  - **Arquivar** o rascunho no mesmo dia e conferir
    `select status from ab_tests where name like 'P3 conferência%'` → `archived`, e
    `select count(*) from ab_tests where name like 'P3 conferência%' and status <> 'archived'` → 0.

## 6. Tarefa 8: a Migration A

Não bloqueia a P4a nem o valor que o dono vê (H3): é endurecimento do banco, depois do código no ar.

### Passo 1 (logo depois da Tarefa 4, sem esperar a fila): o SQL, testado fora do repositório

- [ ] O SQL **vive neste plano** (não existe `p3-migration-a.sql`). Forma atômica por construção (guarda, `drop`
  e `add` num único comando; não depende de o `db push` embrulhar o arquivo numa transação), no molde da
  Migration 0 (`20261014000005_ab_restore_status.sql`: `lock table` e `string_agg` dos ids na mensagem):
  ```sql
  -- ab_tipo_sem_descricao (A/B Lab P3, Migration A). Tira 'description' do CHECK de ab_tests.test_type.
  -- Criar com: npm run db:new ab_tipo_sem_descricao (só no dia). Reversível pelo ALTER da seção 9 do plano.
  -- Idempotente. Atômica por construção: guarda, drop e add num único comando (o DO).
  set lock_timeout = '5s';

  do $$
  declare
    v_ids  text;
    v_nome text;
  begin
    lock table public.ab_tests in access exclusive mode;

    select string_agg(id::text || ' (' || status || ', ' || test_type || ')', '; ' order by created_at)
      into v_ids
      from public.ab_tests
     where test_type not in ('thumbnail', 'title', 'combo');
    if v_ids is not null then
      raise exception 'Migration A abortada: teste com tipo fora dos três: %. Não aplicar a Migration A; o destino da linha se decide com a Migration B (pg_dump antes). Nunca mudar o tipo para combo.', v_ids;
    end if;

    for v_nome in
      select c.conname from pg_constraint c
       where c.conrelid = 'public.ab_tests'::regclass and c.contype = 'c'
         and pg_get_constraintdef(c.oid) ~ '\mtest_type\M'
    loop
      execute format('alter table public.ab_tests drop constraint %I', v_nome);
    end loop;

    alter table public.ab_tests
      add constraint ab_tests_test_type_check check (test_type in ('thumbnail', 'title', 'combo'));
  end $$;

  comment on column public.ab_tests.test_type is 'Discriminator: thumbnail|title|combo (description saiu na P3, 10/2026)';
  reset lock_timeout;
  ```
  Notas: a guarda pega **qualquer** valor fora dos três (não só `description`; esse valor também faria o `ADD`
  falhar, com mensagem pior); `\m...\M` impede casar com coluna futura do tipo `ab_test_type`; o `ADD` valida
  a tabela inteira sob `ACCESS EXCLUSIVE` (2 linhas medidas em 09/10: milissegundos).
- [ ] Testar no `bythiago_int` (porta 54422; o 54321 é do navegador), com `psql`:
  (a) aplicar → o CHECK novo existe com três valores; (b) aplicar de novo → sem erro, um CHECK só de
  `test_type`; (c) num banco com uma linha `test_type = 'description'` (inserida antes, com o CHECK
  antigo) → `RAISE EXCEPTION` com a frase **e o id da linha**, nada muda; (d) o ALTER inverso da seção 9 →
  volta a quatro valores; (e) aplicar de novo; (f) **lock:** numa sessão `begin; lock table public.ab_tests
  in access share mode;` e deixá-la aberta; noutra, aplicar a A: falha em ~5 s com `lock_not_available`, e
  `select pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.ab_tests'::regclass and
  pg_get_constraintdef(oid) ilike '%test_type%'` ainda mostra **quatro** valores (nada mudou). Saídas no
  ledger. Depois, recriar o `bythiago_int` a partir das migrations do repositório (`supabase db reset` do
  projeto de integração), para ele não ficar à frente do repositório.

### Passo 2 (no dia da janela, seção 1): aplicar

- [ ] **A0, portão, no mesmo dia, antes de criar o arquivo:**
  ```sql
  select id, status, test_type, created_at from ab_tests order by created_at;
  select conname, pg_get_constraintdef(oid) from pg_constraint
   where conrelid = 'public.ab_tests'::regclass and contype = 'c';
  ```
  e, **no checkout principal, imediatamente antes do `db:new`** (é ele que o `db push` usa, e outro terminal
  pode ter commitado migration ainda não aplicada; comparar com `origin/main` não basta):
  `npx supabase migration list --linked > /tmp/p3-a0-list.txt 2>&1; tail -15 /tmp/p3-a0-list.txt`.
  Esperado: nenhuma linha com "Local" preenchido e "Remote" vazio; depois do `db:new`, **exatamente uma** linha
  assim, a A. Também: nenhuma linha `description` em `ab_tests` (se houver, **pare** e siga o padrão da
  Tarefa 7: não aplicar a A); um CHECK de `test_type` com quatro valores; a P3 em `main` e no ar
  (`git merge-base --is-ancestor <último commit da P3> origin/main`); a MG15 aplicada; nenhum arquivo
  destrutivo da A5 armado (`.superpowers/sdd/a5/fila-do-db-push.md`, seção 1); a janela da seção 1.
- [ ] No checkout principal, `npm run db:new ab_tipo_sem_descricao`; colar o SQL do passo 1.
  Em **árvore própria** (D-d), para commit e envio:
  `git fetch origin && git worktree add ../bythiago-ab-p3-ma -b lote/ab-p3-ma origin/staging`; copiar para
  lá o arquivo da migration com o **mesmo nome** e o caso de integração em
  `test/integration/ab-tests-title.test.ts`:
  ```ts
  it('o banco recusa test_type = description (Migration A)', async () => {
    const { error } = await db.from('ab_tests').insert({ ...testeBase(), test_type: 'description' })
    expect(error?.code).toBe('23514')   // check_violation
  })
  ```
  rodá-lo com `HAS_LOCAL_DB=1` contra o `bythiago_int` depois de aplicar a migration nele.
- [ ] O dono aplica, na janela: `npm run db:push:prod` no checkout principal (`YES`). **Junto do `YES`, a
  frase ao dono:** "a lista que o push mostra tem **um** arquivo, `..._ab_tipo_sem_descricao.sql`; se tiver
  mais, responda não". O controlador confere em seguida (A1):
  ```sql
  select conname, pg_get_constraintdef(oid) from pg_constraint
   where conrelid = 'public.ab_tests'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%test_type%';
  select count(*) from ab_tests;
  ```
  Esperado: uma linha, `CHECK ((test_type = ANY (ARRAY['thumbnail'::text, 'title'::text, 'combo'::text])))`;
  contagem igual à do A0.
- [ ] Commit **na árvore `lote/ab-p3-ma`**, por lista (o arquivo da migration e o teste de integração), com a
  lista inteira do A/B rodada: `feat: A/B Lab P3, Migration A: ab_tests.test_type sem description (CHECK de três valores)`.
  Push: `bash -c 'git push origin lote/ab-p3-ma:staging'` e CI verde. **Nunca pelo `staging` local.** Avisar o
  controlador da A5 para marcar a linha da fila como resolvida.
- **Não criar cópia da migration no checkout principal além da gerada pelo `db:new` e já aplicada:** depois do push, apagar essa cópia não rastreada do checkout principal (igual à do remoto) antes de qualquer pull ou junção ali (senão: "untracked working tree files would be overwritten"). A cópia que se commita vive só na árvore `lote/ab-p3-ma`.
- A conferência de produção de tela, 422 e rascunho **não é daqui**: foi a C5, no dia do deploy. O dia seguinte
  da A (`ab-rotate`) é coberto pela C2.

## 7. Aceite

| # | Critério | Onde se prova |
|---|---|---|
| 10 | As três partes da completude, com as exceções medidas e nomeadas | Tarefa 4 |
| 11 | Zod e rota do pipeline recusam `description` com 422 e a mensagem em pt-BR; `description_text` não nulo (inclusive `""`) → 422; `null` aceito; REST e MCP com o mesmo `code` e a mesma mensagem; a prévia do MCP também recusa. Leitura do pedido "rótulo de reserva no serviço de variantes do pipeline" (spec, seção 2): **400 `VALIDATION_ERROR`** no `upsertVariants` para tipo desconhecido | Tarefa 2, passo 1 |
| 12 | `applyVariantToYouTube` nunca envia descrição diferente da lida, em nenhum tipo; o `PUT` leva a descrição do `videos.list`; sem `snippet.description` a função falha alto, sem `PUT` | Tarefa 1, passo 1 |
| 13 | Produção, **no dia do deploy em `main`** (o código é o que se mede; a emenda 44 não amarra o aceite à Migration A, embora o corpo do spec diga "depois da A": nota no ledger): o rascunho combo de conferência abre como "Título + thumbnail"; `ab-rotate` das 08:00 UTC seguinte sem falha em `/api/health` (13a, falso verde declarado) | Tarefa 7, C2 e C5 |
| 44a | Wizard de produção com 3 cartões, na ordem "Título + thumbnail", "Thumbnail", "Título", sem "recomendado" | Tarefa 7, C5 |
| 12 (exceção) | Exceção declarada: `defaultLanguage` e `defaultAudioLanguage` não são reenviados até a P4a (o `PUT` continua apagando os dois); o aceite L6 do Gio é **parcial** nesse ponto | Tarefa 1; dívida da P4a |
| 44b | O CHECK com três valores depois da Migration A; contagem de `ab_tests` igual à do A0 | Tarefa 8, A1 |
| 44c | O 422 pelo Cowork e pelo Claude Code (MCP com `dry_run` padrão e `false`, REST); `null` aceito; o doc servido tem o 422 | Tarefa 7, C5 (C3 e C4) |
| 44d | O rascunho de conferência arquivado no mesmo dia | Tarefa 7, C5 |
| P3-F | Teste antigo de descrição (ou tipo desconhecido) aparece com "Tipo fora de uso" e não inicia | Tarefa 3, passo 1; captura local (Tarefa 5) |
| P3-P1 | Saída da C1 no ledger antes do push: zero teste vivo de descrição ou com variante com descrição, zero em `ab_test_tracked_links`, zero ciclo com `description_set`; ou o padrão da Tarefa 7 aplicado | Tarefa 7, C1 (Gio prepara, dono cola) |

### 7.1 Amarração com a emenda 48 do Gio (`2026-10-14-ab-lab-aceite-p3-p4.md`, seção 2)

Cada linha com decisão escrita. As marcadas **(padrão)** são o padrão adotado pelo controlador em 14/10; o dono pode mudar no "pode executar".

| Gio | Onde entra no plano | Decisão |
|---|---|---|
| P3-L1 (spec Playwright, 1440 e 390, 3 vezes) | Tarefa 3, Tarefa 5, C5 | **(padrão)** Sem spec Playwright na P3; prova = testes da Tarefa 3, capturas da Tarefa 5 e C5. Gatilho para escrever o spec: primeira regressão visual do wizard |
| P3-L2 (chave `description: "x"`) | Tarefa 2 (`pedeDescricao`, caso no `it.each`, shape do MCP) | **(padrão)** `pedeDescricao` também testa `description != null`; 422 no REST e no MCP; coberto por teste |
| P3-L5 (teste `active` combo, ciclo aberto, `applied_metadata` antigo com `description_set`/`links_resolved`) | Tarefa 5 | Semente da Tarefa 5 ganha esse teste `active`; a captura "depois" (detalhe, histórico do ciclo) abre sem erro, sem "undefined", nulo ou 0 |
| P3-L6 (emoji, `\r\n`, `<` `>`, 5000 caracteres; idiomas reenviados) | Tarefa 1 (`it.each` das quatro descrições) | **(padrão)** Quatro descrições testadas; exceção declarada no aceite 12: os dois campos de idioma só voltam na P4a |
| P3-L7 (título de 101 caracteres, com `<`, só espaços) | fora da P3 | **(padrão)** Fora da P3; vai à P4a (a rotação trata falha do YouTube). A P3 não muda o caminho do título. Dívida declarada ao dono |
| P3-L8 (mensagem de abortamento da A) | Tarefa 8 | Vale a mensagem do plano ("Migration A abortada: teste com tipo fora dos três: <id (status, tipo)>"), que cobre mais; o Gio lê a frase do plano |
| 2.2 item 5 (`started_at` nulo e zero ciclo no rascunho de conferência) | C5 | Consulta acrescentada à C5 (Tarefa 7) |

## 8. O que acontece quando o dado não existe, e em cada falha

| Situação | Depois da P3 |
|---|---|
| `videos.list` sem `snippet.description` | **falha alto, nenhum `PUT`** (propriedade omitida no `videos.update` seria apagada); `""` vindo da API é reenviado como `""`. Teste na Tarefa 1 |
| Variante antiga com `description_text` em teste combo ou título | ignorado na rotação, no retomar, no forçar, no aplicar; nunca vai ao ar |
| Teste antigo `description` `completed`/`archived` | aparece com "Tipo fora de uso"; pipeline o lista; a Migration A **aborta** enquanto ele existir. Padrão: **não aplicar a A** e deixar a P3 no ar sem ela; o destino se decide com a Migration B (`pg_dump`); nunca mudar o tipo para combo |
| Teste antigo `description` `draft` | aparece com o rótulo de reserva; "iniciar" recusa (D8); o `ab-draft-cleanup` o arquiva em 24 h |
| Teste antigo `description` `active`/`paused` | a rotação não escreve nada (só a thumbnail não muda: o tipo não é de thumbnail); a descrição que ele pôs no ar **fica**. Se a C1 achar um, o envio segue e o dono recebe vídeo e `original_description` para colar no Studio |
| Reversão aberta de teste com descrição na variante vencedora | depois da P3 `revertWinner` restaura só o título; a C1 lista e o dono reverte antes da promoção a `main`, se quiser |
| Cowork manda `description_text` com texto | 422 `DESCRICAO_FORA_DO_TESTE`, nada gravado, pela prévia e pela chamada real |
| Cowork manda `description_text: null` | aceito; a coluna não é escrita (fica `null` na linha nova) |
| Cowork manda recomendação `description_test` | 400 no `PATCH` de inteligência, com a frase; **o payload inteiro é recusado** (a validação é do objeto todo). Risco: uma rodada do Cowork com uma recomendação dessas perde as outras; o doc avisa (chega com o deploy). A forja nunca manda `video_recommendations` |
| Cowork soma `link_clicks` do funil | recebe `null`; quem somava vê erro de tipo do lado dele, não zero. `per_link: []` vem com a frase "o A/B não cria link rastreado desde 10/2026". Só vale com `linhas_ab_test_tracked_links = 0` na C1 |
| Leitura do banco falha no funil | `DB_ERROR` 500 (como na P2), agora só da leitura de ciclos |
| A Migration A encontra linha com tipo fora dos três | `RAISE EXCEPTION` com os ids; nada muda; a P3 continua no ar sem ela (o código já não cria esse tipo) |
| A Migration A pega lock por mais de 5 s | falha por `lock_timeout`; **nada muda, o CHECK antigo continua** (guarda, `drop` e `add` são um comando só); tenta-se na próxima janela |
| `git revert` da P3 antes da Migration A | volta tudo; nada no banco mudou |
| `git revert` da P3 depois da Migration A | sem o ALTER inverso antes, o wizard antigo oferece "Descrição" e o `insert` falha com violação de CHECK (erro visível, não silencioso). Seção 9 |

## 9. Como se reverte

- **Antes da Migration A:** `git revert` dos quatro commits do lote, na ordem inversa (Tarefas 4, 3, 2,
  1), num commit de reversão cada um, push (de árvore própria), CI, promoção; o doc volta a aceitar descrição
  com o próprio deploy (não há seed).
- **Depois da Migration A:** primeiro o ALTER inverso (o dono aplica por uma migration nova,
  `npm run db:new ab_tipo_volta_descricao`, respeitando a fila):
  ```sql
  set lock_timeout = '5s';
  alter table public.ab_tests drop constraint if exists ab_tests_test_type_check;
  alter table public.ab_tests
    add constraint ab_tests_test_type_check check (test_type in ('thumbnail', 'title', 'description', 'combo'));
  comment on column public.ab_tests.test_type is 'Discriminator: thumbnail|title|description|combo';
  ```
  depois o `git revert` como acima.
- **Rollback instantâneo da Vercel** para um deploy anterior à P3: funciona até a Migration B (as colunas
  existem). Depois da Migration A, nesse deploy, criar teste de descrição falha no banco; o resto funciona.
- **Depois da Migration B** (fora deste plano): a reversão deixa de ser possível sem `pg_dump`. O ALTER inverso
  acima deixa de ter sentido depois da B; a B atualiza esta seção.

## 10. Riscos que ficam, sem suavizar

- **Descrição que um teste antigo pôs no ar não volta.** Produção tem dois testes, combo, sem texto de
  descrição (spec, 09/10); a C1 confere no dia. Se aparecer um vivo, o envio para.
- **O `PATCH` de inteligência recusa o payload inteiro** com uma recomendação `description_test`. Antes, o
  Cowork recebia sucesso; depois, uma rodada inteira pode falhar até ele reler o doc. Mitigação real: o doc
  chega ao Cowork **com o próprio deploy** (`resources.ts` lê `data/pipeline-docs`); a C5 prova. Só o Cowork é
  atingido, e ele refaz a chamada. A forja não manda `description_test` (conferido em
  `~/Workspace/forja/ferramentas`, 14/10: a única ocorrência é um nome de arquivo Flutter num inventário CSV, sem relação).
- **A forma do funil continua, com `link_clicks: null` e `per_link: []`** (D4). Um leitor que somava cliques
  de link passa a ver `null`. Produção tem 0 links de teste (a C1 é **portão**: com `> 0` o envio para).
- **`ab-templates.ts` fica sem chamador em `src`** (código morto com testes vivos) até a Migration B.
- **Testes fora do `tsc`.** Uma chamada de 4 argumentos esquecida num teste só aparece no `vitest`; a
  Tarefa 0 guarda o grep de `updateVideoMetadata(` e a Tarefa 5 roda a suíte inteira.
- **Conflito de junção** em `api-registry.ts`, `mcp/prompts.ts` e `cowork-docs-youtube.md` (E7 da A5; a T7 já
  está commitada). Medido na Tarefa 6; nunca `stash`. Quem entrar depois (E7 T12 a T16) regenera o snapshot do
  schema do MCP.
- **`phaseProcessQueue` ignora `{ ok: false }` e conta `started++`** (`ab-rotate-phases.ts:31-41`; já existia, agravado
  pela D8: um `queued` de descrição viraria rascunho em silêncio e contaria como iniciado). A C1 impede que
  exista. Gatilho para pagar: a P4a, que reescreve esse caminho.
- **`startAbTestInternal` não aplica o título da 1ª variante quando ela não é a original** (`ab-start.ts:101-108`;
  já existia): o ciclo 0 de teste de título roda com o título errado no ar. Gatilho: P4a; registrar no ledger.
- **O `PUT` apaga `defaultLanguage`/`localized`** a cada rotação (read-modify-write do `snippet`): P4a.
- **Resíduo conhecido:** o rascunho `P3 conferência` fica `archived` e a cópia da thumbnail original fica no Blob
  (inócuo se `getAbPerformance` e o painel só agregam `completed`: a conferir no ledger).
- **A Migration A depende de uma janela que ainda não existe** (depois da MG15, 16/10 23:00 UTC). Se a MG15
  atrasar além de 30/10, a A espera a MG16; a P3 de código fica no ar sem ela, o que é seguro: o código não
  cria nem inicia tipo de descrição.
- **Linhas citadas deslocam.** O inventário é de `eba97b0cf`; quem executa reconfere por âncora de texto.

## 11. Perguntas abertas para a revisão final

Respondidas pelas três revisões de 14/10 (Hanna, Phil, Yannis) e aplicadas acima. Restam:

1. **Gio:** se há sessão autenticada de produção para a C5; senão, a conferência de tela é do dono.
2. **Logan:** as duas frases (a do combo e "Tipo fora de uso"), antes da Tarefa 3.
3. **Phil e Yannis, na revisão final do plano da P4a:** confirmar que a P4a não espera a Migration A (observação
   para a emenda 45 do spec, que não foi alterada).
4. **Corte de reserva (Hanna H6):** só se o "pode" das capturas atrasar mais de 1 dia, as **Tarefas 1 e 2**
   sobem antes (as duas não têm tela) e a 3 e a 4 depois; o corte certo não é "a Tarefa 2 sozinha". Condição:
   o dono não cria teste no intervalo (o wizard ainda oferece "Descrição" e um teste desse tipo giraria sem
   escrever nada).

## 12. Para a Migration B (anotar no mini-plano dela; nada disto entra nesta entrega)

1. **Portão de links.** Abortar se houver `tracked_links` com `source_type = 'ab_test'`. O `drop` de
   `ab_test_tracked_links` **não** apaga linhas de `tracked_links` (o FK `link_id → tracked_links ON DELETE
   CASCADE` vai em sentido contrário): códigos `go.` que estejam numa descrição no ar continuam resolvendo, e a
   B não deve apagá-los sem o dono.
2. **`create_playoff_test`** ainda lê `original_description`, `description_text` e `ab_test_tracked_links`
   (`20260529000001_playoff_mode.sql:82-124`). Sem chamador desde a P2, mas é plpgsql: só quebra quando
   executado. A B o recria ou apaga **no mesmo arquivo e antes** do `drop` das colunas.
3. **Pré-condição medida:** `count(*) where description_text is not null` em `ab_test_variants` e
   `original_description is not null` em `ab_tests`, no dia, com a lista de ids no `RAISE`/ledger; mais o
   `pg_dump` do dono. É na B que se decide o destino de teste `completed`/`archived` de descrição.
4. **`database.types.ts` regenerado** no mesmo commit da B; `lib/youtube/ab-templates.ts` e os 14 `vi.mock`
   saem ali. A amarra de tipo de `CAMPOS_DA_VARIANTE` (Tarefa 2) muda junto com as colunas.
5. O valor `'ab_test'` do enum `link_source_type` **fica** (o Postgres não remove valor de enum sem recriar
   o tipo).
6. O ALTER inverso da A (seção 9) deixa de ter sentido depois da B; a B atualiza "como se reverte".
7. Decidir se o 422 e o campo `description_text` declarado (D3) ficam por N semanas ou para sempre.
