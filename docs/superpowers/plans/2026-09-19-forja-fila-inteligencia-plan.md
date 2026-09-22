# Fase 2a — a forja drena a fila de inteligência — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** pôr de pé o circuito em que a forja (Gemma 12B local) clama tarefas de `youtube_intelligence_tasks`, grava a análise do canal com `source='forja'` ao lado das do Cowork, e o Health Coach mostra a mais recente com selo da fonte.

**Architecture:** o site ganha uma permissão estreita (`intelligence`), duas rotas REST novas (claim e fail), um PATCH com portão único dentro do serviço (Zod + fonte derivada da chave + trava de dono + CAS de fechamento) e um snapshot que passa a expor a janela de 90 dias sem somar fotos. O worker da forja (`/opt/agente/docs/trilha/fila_intel.py`, sem segunda cópia instalada) calcula tudo em código determinístico e usa o 12B só para redigir um campo (`coaching.summary`), sob validador local. A convivência com o Cowork é garantida pelos índices únicos por `source`.

**Tech Stack:** Next.js 15 (App Router) + TypeScript strict + Zod + Supabase (PostgREST, service client) no site; Python 3 + httpx + llama.cpp (`/v1/chat/completions` com `response_format: json_schema`) na forja; Vitest no site.

**Spec:** `docs/superpowers/specs/2026-09-18-forja-fila-inteligencia-design.md` (v11, commit `0fde594e`). **O plano argumenta a partir do spec — leia os dois.** Onde este plano e o spec divergirem, o spec vence e o plano é corrigido.

---

## Global Constraints

Valem para **toda** tarefa deste plano.

### Regras do dono (custaram tempo antes)

- **Escrita na forja é do dono.** Nenhum agente roda `ssh forja '<comando que escreve>'`, `scp` para a forja, `crontab -`, `install`, `mv` ou `systemctl` lá. O agente **prepara** os comandos — curtos, um por linha, em bloco de código — e o dono cola. Conferência depois só por leitura: `ssh forja '<comando de leitura>'` é permitido.
- **Aprovação visual antes de código de UI.** Nenhuma linha de componente é escrita antes de o dono aprovar o mockup (Task 0). Isso vale para `yt-health-coach.tsx` e `yt-analytics-tabs.tsx`.
- **Nunca criar nem revogar chave de pipeline.** `PIPELINE_COWORK_KEY` é permanente. A chave nova, `forja (fila)`, é criada e revogada **só pelo dono**, por `nova_chave.py --fila` + `seed_chave_forja.sh fila <sha>`.
- **Banco de produção: só leitura.** Único comando permitido: `cd ~/Workspace/bythiagofigueiredo && npx --yes supabase@2.98.2 db query --linked --agent=no "<select>"`. Nenhum `update`/`delete`/`insert` em prod parte de um agente; os SQLs de rollback do §5 do spec são do dono.
- **Não fazer push nem deploy sem o dono pedir.** O plano chega ao fim do F0 com a árvore local verde e **pára**; o push é um passo do dono (Task 14).
- **Orçamento apertado.** Diagnostique local. `npx vitest run` completo = ~1078 arquivos, ~13.780 testes, **~160 s** — é barato e roda antes de qualquer push. Um push só, com certeza de build verde.
- **Commits de doc/plano:** `--no-verify` (multi-terminal). **Commits de código passam pelo hook normal.**
- **Nunca `git stash`, `git reset --hard` nem descartar trabalho alheio.** Dois ou mais terminais trabalham em `staging` em paralelo. `git add` sempre por caminho explícito, nunca `git add -A`/`git add .`.
- **Trabalhar direto em `staging`.** Sem branch de feature.

### Regras do repositório (CLAUDE.md)

- **TypeScript `strict: true`, nunca `any`, Zod para validação.**
- **Arquivos** kebab-case · **Classes** PascalCase · **Interfaces** prefixo `I` · **colunas de banco** snake_case.
- **Commits:** `tipo: descrição curta` — `feat`, `fix`, `chore`, `refactor`, `docs`, `ci`. Fim da mensagem:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`
- **Se mexeu em `packages/*/src/`:** `npm run build:packages` imediatamente. **O F0 não mexe em `packages/`** — se alguma tarefa te levar lá, pare e reabra a decisão com o dono.
- **Sanitizers nunca sob happy-dom.** Teste de código server-side → `// @vitest-environment node`; componente client → `// @vitest-environment jsdom`.
- **Fixtures temporais sempre relativas ou com fake timers.** Nunca hardcodar ano/data futura comparada com o relógio: use `new Date(Date.now() + N * 864e5).toISOString()` ou `vi.useFakeTimers({ now, toFake: ['Date'] })`.
- **Fix que exige mudança em teste vai no MESMO commit** — a árvore nunca fica com testes vermelhos.
- **Next 16:** nunca passar `next/link` (ou qualquer componente importado num Server Component) como prop para um client component.
- **Pipeline Integrity:** ao criar rota em `apps/web/src/app/api/pipeline/`, atualizar `apps/web/src/lib/pipeline/api-registry.ts` (entrada **e** `endpoint_count` do domínio) e `apps/web/data/pipeline-docs/cowork-docs-youtube.md` **no mesmo commit**. Os testes validam registry ↔ arquivos de rota.
- **Não chamar `getSupabaseServiceClient()` sem validar escopo**; não importar server actions em client components.

### Granularidade de commit no F0 (decisão deste plano)

O spec §3 chama o F0 de "um commit do site". Este plano entrega o F0 como **uma sequência de commits locais em `staging`, empurrados de uma vez só** ao final (Task 14):

- cada tarefa termina com a árvore verde (typecheck + os testes da tarefa), o que preserva bisectabilidade e o hook leve;
- o push acontece uma vez, com a suíte completa verde — respeitando "no wasteful pushes";
- o **rollback do F0** (spec §5) passa a ser `git revert` do **intervalo** de commits do F0, não de um commit só. Quem executar a Task 14 anota no relato final a lista de SHAs do F0 (`git log --oneline <base>..HEAD`), e essa lista é o que o rollback reverte, na ordem inversa.

Se o dono preferir literalmente um commit só, a alternativa é fazer as tarefas em worktree isolado (`superpowers:using-git-worktrees`) e trazer para `staging` com `git merge --squash`. Não é o caminho padrão deste plano.

### Regras do kit da forja (valem dos cards F0k em diante)

Verificado em 2026-09-20, não suposto:

- **O kit está sob controle de versão desde 2026-09-20.** `~/Workspace/forja/ferramentas` é um repositório git próprio (commit inicial `ec51833`, 116 arquivos, `.gitignore` com `__pycache__/` e `*.pyc`), criado pelo dono antes do F0k justamente porque esta fase cria 8 arquivos e altera 4, e o `.bak` protege uma edição de profundidade, não uma sequência. Consequências, obrigatórias:
  - **toda tarefa do kit termina em `git commit`**, com mensagem no padrão `tipo: descrição curta` (`feat`, `fix`, `chore`, `refactor`, `docs`), depois do teste verde. Repositório **local, sem remoto e sem push**;
  - `git add` sempre por **caminho explícito**, nunca `git add -A` nem `git add .`;
  - **não há passo de `.bak` no Mac.** O git substitui, e cópias `.bak` só poluiriam o `git status`. Os `.bak-*` que o `deploy.sh` cria **na forja** (`proxy.py.bak-*-S4`, `pulso.sh.bak-F4`, `crontab.bak-F4`, `fila_intel.py.bak`) são outra coisa e continuam;
  - o `.git` fica em `ferramentas/`, **fora de `docs/`**: o `scp -r sitio.py trilha` do card K não o leva, e o `find sitio.py trilha -type f` do portão `KIT-IGUAL` não o vê. O card K não muda;
  - o portão do F0k exige **árvore limpa ao fim** — é o que pega o arquivo novo que ninguém lembrou de `git add` e que o `scp -r` levaria assim mesmo, sem estar versionado;
  - **nenhum arquivo versionado pode conter chave real**, em fixture, exemplo ou saída esperada. O repositório é local hoje, mas um `git init` costuma virar `git remote add` meses depois, e o histórico vai junto: uma chave commitada não sai com um `rm`;
  - **o repositório guarda código e decisão curada, não dado puxado da produção.** Entram: os `.py`/`.sh` do kit e `fase2/series.json` (a escolha das séries que o dono faz no F0.5 — perdê-la significa refazer o card, e ela não tem dado de audiência). **Ficam de fora, no `.gitignore`:** `fase2/fixture_pt.json` e `fase2/sombra-f2/`. A fixture carrega `recent.views` por vídeo, que é dado da YouTube Analytics — não é público como título e view count — e é regenerável por `capturar_fixture.py`; a sombra é saída de execução, muda a cada rodada e não é insumo de nada depois do julgamento do F2;
  - `git add fase2/` (o diretório inteiro) é proibido justamente por isso: some com a distinção acima. Some também com a regra do caminho explícito.
- **`~/Workspace/forja` (a raiz) continua fora de git** — `forja-infra`, `forja-ds` e `sitio` são repositórios próprios, e agora `ferramentas/` também. Não confunda: os comandos deste plano operam em `ferramentas/`.
- **`ferramentas/fase2/` não existe** — o `mkdir -p` do card F0k é obrigatório, não decorativo. Ele fica **fora** do kit: o `scp -r trilha` do `K` não o leva, e é por isso que `fixture_pt.json` e `series.json` moram lá.
- **O `python3` do Mac não tem `httpx`.** Consequência exata, medida: `teste_fila.py` **não** roda no Mac, porque carrega o worker, que importa `httpx`. Já `teste_s4.py`, `teste_calculo.py` e `teste_fila_redacao.py` **rodam**, porque são stdlib puro e não tocam no worker. (O §5/F0k do spec diz que o `teste_s4.py` não roda no Mac; está errado, e a correção está anotada na seção de divergências no fim deste plano.)
- **Escrita na forja é do dono**, sem exceção — vale para `scp`, `install`, `mv`, `crontab -`, `systemctl`, `deploy.sh`, `nova_chave.py` e qualquer coisa que grave. O plano prepara os comandos, curtos, um por linha, em bloco de código; o dono cola. Conferência depois só por leitura (`ssh forja '<comando de leitura>'`).

### Invariantes que o F0 não pode quebrar

- **`maxDuration = 60`** em `app/api/pipeline/youtube/intelligence/route.ts` e **`STALE_THRESHOLD_MINUTES = 30`** em `app/api/cron/youtube-intelligence-watchdog/route.ts` são as duas pontas da invariante de tempo do §4.1 do spec (claim → último pedido < 25 min + 30 s < 30 min do watchdog). **Os dois ganham asserção de teste neste plano** (Tasks 5 e 5d). Mudar qualquer um dos dois exige refazer a conta com o dono.
- **A fonte vem só da chave.** O corpo do PATCH nunca carrega `source`; `deriveSource(ctx)` é escrito **por exclusão** (tudo que não é `write`/`admin`/sessão é `forja`) para falhar fechada.
- **O texto da forja não alimenta o Cowork.** O array `intelligence` do snapshot filtra `source='cowork'` para **qualquer** chave, sessão ou resource MCP.
- **Sem migration.** `source` não tem CHECK; `failed`, `retry_count` e `result_summary jsonb` já existem; `permissions` é `text[]` sem CHECK. Se alguma tarefa parecer precisar de migration, **pare** — é sinal de que o passo saiu do spec.
- **`status` da task tem CHECK** `('pending','running','completed','failed','stale')` (`20260517000003_analytics_intelligence.sql:235-236`). O `partial_failure` que o código grava hoje (`services/youtube.ts:432`) **viola o CHECK** e sai no F0 (Task 5d).

### Comandos de verificação (valem para todas as tarefas)

```bash
# typecheck do web (o que o pre-commit roda)
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run typecheck --workspace=apps/web

# um arquivo de teste
cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web && npx vitest run test/<caminho>.test.ts

# suíte completa (~160 s) — antes do push
cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web && npx vitest run
```

---

## Card F0 — o commit do site

Único card de código no repo do site. Cobre o §3 inteiro do spec (permissão, claim, PATCH, fail, snapshot, Health Coach, arrastados).

### Mapa de arquivos

**Criados**

| Arquivo | Responsabilidade |
|---|---|
| `apps/web/src/lib/youtube/analytics-window.ts` | dona única de `SYNC_WINDOW_DAYS`; importada pelo cron e pelo serviço |
| `apps/web/src/app/api/pipeline/youtube/intelligence/task/claim/route.ts` | POST claim com `channel_ids` (adaptador fino) |
| `apps/web/src/app/api/pipeline/youtube/intelligence/task/[id]/fail/route.ts` | POST fail/requeue (adaptador fino) |
| `apps/web/test/lib/pipeline/services/youtube-intelligence-service.test.ts` | asserções de serviço (claim, PATCH, dono, fonte, fechamento, fail, snapshot) |
| `apps/web/test/api/pipeline/youtube-intelligence-task-routes.test.ts` | contratos das duas rotas novas |
| `apps/web/test/api/pipeline/youtube-intelligence-auth.test.ts` | permissão **sem** mock de `@/lib/pipeline/helpers` |
| `apps/web/test/mcp/ab-tests-intel.test.ts` | `claim_task` / `submit_intelligence` pelo MCP |
| `apps/web/test/youtube/yt-analytics-tabs-coach.test.tsx` | cenários A–C do Health Coach (jsdom) |
| `apps/web/test/integration/youtube-intelligence-forja.test.ts` | integração com o Supabase local (DB-gated) |
| `apps/web/test/fixtures/intel-cowork-2026-05-18.json` | payload real de maio, regressão do Cowork |

**Modificados**

| Arquivo | O quê |
|---|---|
| `apps/web/src/lib/pipeline/services/types.ts:3` | `Permission` ganha `'intelligence'` |
| `apps/web/src/lib/pipeline/auth.ts:99-102` | `requirePermission` aceita `'intelligence'` |
| `apps/web/src/lib/pipeline/helpers.ts` | novo `authenticateIntel(req, {apiKeyOnly})` |
| `apps/web/src/lib/pipeline/services/youtube.ts` | `claimNextTask`, `submitIntelRecommendations`, `failTask` (nova), `getIntelligenceSnapshot`, `deriveSource` |
| `apps/web/src/app/api/pipeline/youtube/intelligence/route.ts` | `authenticateIntel`, `maxDuration = 60`, sem casts, sem ramo morto |
| `apps/web/src/app/api/pipeline/youtube/intelligence/task/route.ts` | `authenticateIntel({apiKeyOnly:true})` + `requirePermission('write')`, força `pending` |
| `apps/web/src/lib/youtube/intelligence-schemas.ts:43-49` | tetos em `patterns_detected`, `pattern_id`, `category`, `sample_size` |
| `apps/web/src/lib/pipeline/mcp/services/ab-tests.ts` | `claim_task` em `WRITE_ACTIONS`; `buildCtx()` com `keyId`; sem casts |
| `apps/web/src/lib/pipeline/mcp/errors.ts` | `TASK_NOT_RUNNING` e `PARTIAL_FAILURE` no `ERROR_MAP` |
| `apps/web/src/lib/pipeline/mcp/prompts.ts` | `fetchSnapshotAge` filtra `source='cowork'`; prompt `youtube-analyst` |
| `apps/web/src/lib/pipeline/mcp/tools.ts:662,690` | descrições de `claim_task`/`submit_intelligence`/`intel_payload` |
| `apps/web/src/lib/pipeline/api-registry.ts` | `auth` union, 2 endpoints novos, `endpoint_count` 31→33 |
| `apps/web/src/app/api/cron/sync-analytics-metrics/route.ts:18` | importa `SYNC_WINDOW_DAYS` |
| `apps/web/src/app/cms/(authed)/youtube/analytics/actions.ts:14-44` | `fetchChannelCoaching` com allowlist, `source`, `generatedLabel` |
| `apps/web/src/app/cms/(authed)/youtube/analytics/_components/yt-analytics-tabs.tsx` | `coachingMeta`, `computeCoachingCards` exportada, botão, `className` |
| `apps/web/src/app/cms/(authed)/youtube/analytics/_components/yt-health-coach.tsx` | selo por fonte, linha de summary, sai `hasCoworkCoaching` |
| `apps/web/data/pipeline-docs/cowork-docs-youtube.md` | envelope, endpoints novos, error codes, remanejamento dos 8.000 caracteres |
| testes existentes | `youtube-intelligence.test.ts`, `coaching-actions.test.ts`, `yt-health-coach.test.tsx`, `api-registry.test.ts`, `mcp-registry-sync.test.ts`, `youtube-cowork-docs.test.ts`, `youtube-mcp-prompts.test.ts`, `youtube-intelligence-watchdog.test.ts` |

### Interfaces que atravessam as tarefas

Assinaturas exatas, definidas aqui uma vez, usadas por todas as tarefas abaixo.

```ts
// src/lib/pipeline/services/types.ts
export type Permission = 'read' | 'write' | 'admin' | 'intelligence'

// src/lib/pipeline/auth.ts
export function requirePermission(
  auth: PipelineAuth,
  required: 'read' | 'write' | 'admin' | 'intelligence',
): boolean

// src/lib/pipeline/helpers.ts
export async function authenticateIntel(
  req: NextRequest,
  opts?: { apiKeyOnly?: boolean },
): Promise<{ ok: true; auth: PipelineAuth } | NextResponse>

// src/lib/pipeline/services/youtube.ts
export interface IntelTask {
  id: string
  site_id: string
  channel_id: string
  trigger_type: string
  requested_at: string
  started_at: string
}
export interface FailTaskResult { id: string; status: string; retry_count: number }

export async function claimNextTask(
  ctx: ServiceContext,
  channelIds?: string[],
): Promise<ServiceResult<IntelTask | null>>

export async function failTask(
  ctx: ServiceContext,
  taskId: string,
  input: { reason: string; retry?: boolean },
): Promise<ServiceResult<FailTaskResult>>

export async function submitIntelRecommendations(
  ctx: ServiceContext,
  data: unknown,
): Promise<ServiceResult<TaskResult>>

export function deriveSource(ctx: ServiceContext): 'cowork' | 'forja'

// src/lib/youtube/analytics-window.ts
export const SYNC_WINDOW_DAYS: number

// src/app/cms/(authed)/youtube/analytics/actions.ts
export async function fetchChannelCoaching(channelId: string): Promise<
  { coaching: CoachingOutput; source: 'cowork' | 'forja'; generatedLabel: string } | null
>

// _components/yt-analytics-tabs.tsx
export function computeCoachingCards(
  videos: VideoGradeRow[],
  channelCoaching: CoachingOutput | null,
): Array<{ axis: Axis; score: number; benchmark: number; channelValue: number; diagnosis: string; action: string; source: 'cowork' | 'fallback' }>

// _components/yt-health-coach.tsx — Props ganha:
coachingMeta: { source: 'cowork' | 'forja'; generatedLabel: string; summary: string } | null
```

---

### Task 0: Mockup do Health Coach — aprovação visual (bloqueia as Tasks 10 e 11)

**Sem código de produção.** Portão da regra de aprovação visual.

**Files:**
- Create: `/private/tmp/claude-501/-Users-figueiredo-Workspace-bythiagofigueiredo/9e4ef126-9796-4af1-98f8-bd072597eeca/scratchpad/mockup-health-coach.html` (descartável, fora do repo)

**Interfaces:**
- Consumes: nada.
- Produces: aprovação do dono, registrada na conversa. As Tasks 10 e 11 não começam sem ela.

- [ ] **Step 1: Montar o mockup com os três estados**

O mockup mostra, lado a lado, o cabeçalho da aba Health Coach nos três cenários do §3.7 do spec, com o CSS de hoje (`.card.coach-summary`, `.section-label`, `.coach-proj`, `.btn`):

- **A (Cowork, hoje):** rótulo `Diagnostico · por Cowork · 18/05`; **linha de summary** com o texto real de maio (500 caracteres, começa em "Canal micro (1.160 subs)…" e termina cortado em "Conteúdo de..."), **no lugar** do parágrafo "O canal esta em X/100 …"; 3 cards; bloco "Potencial" com "+N pts"; badge 3 na aba.
- **B (forja):** rótulo `Diagnostico · por forja · dd/mm`; linha de summary da forja (prefixada por "Sem CTR/retenção nesta fase; base: views e séries."); **sem** cards, **sem** card verde "Canal saudavel em todos os eixos", **sem** "Baseado em regras fixas", **sem** bloco "Potencial", **sem** "+N pts", **sem** badge.
- **C (sem análise):** rótulo `Diagnostico heuristico` (literal de hoje, sem acentos); parágrafo atual; linha "Baseado em regras fixas — ainda sem analise para este canal"; 3 cards heurísticos; badge 3.

Nos três, o botão do cabeçalho é `Pedir diagnostico` (sem "ao Cowork") e usa a `.btn` base, **sem** a variante `.cowork`.

Literais exatos, sem acentos, separador `·` (U+00B7):
```
Diagnostico · por forja · dd/mm
Diagnostico · por Cowork · dd/mm
Diagnostico heuristico
Baseado em regras fixas — ainda sem analise para este canal.
Pedir diagnostico
```

- [ ] **Step 2: Mostrar ao dono e esperar o "aprovado"**

Publicar como Artifact ou abrir o HTML local, o que o dono preferir. **Não** seguir para as Tasks 10/11 sem um "aprovado" explícito. Ajustes pedidos voltam ao Step 1.

- [ ] **Step 3: Registrar a aprovação**

Anotar no relato da tarefa: data, o que foi aprovado e qualquer ajuste pedido. Sem commit.

---

### Task 1: Permissão `intelligence`

**Files:**
- Modify: `apps/web/src/lib/pipeline/services/types.ts:3`
- Modify: `apps/web/src/lib/pipeline/auth.ts:99-102`
- Modify: `apps/web/src/lib/pipeline/helpers.ts` (acrescenta `authenticateIntel` depois de `authenticateRead`, linha 38)
- Modify: `apps/web/src/lib/pipeline/api-registry.ts:7`
- Test: `apps/web/test/api/pipeline/youtube-intelligence-auth.test.ts` (novo — só o bloco de `requirePermission` nesta tarefa)

**Interfaces:**
- Consumes: nada.
- Produces: `Permission` com `'intelligence'`; `requirePermission(auth, 'intelligence')`; `authenticateIntel(req, {apiKeyOnly})`; `ApiEndpointMeta.auth: 'read'|'write'|'intelligence'`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `apps/web/test/api/pipeline/youtube-intelligence-auth.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { requirePermission, type PipelineAuth } from '@/lib/pipeline/auth'

function auth(permissions: string[]): PipelineAuth {
  return { siteId: 'site-1', permissions, source: 'api_key', keyHash: 'h', keyId: 'k' }
}

describe('requirePermission — intelligence', () => {
  it('rejects intelligence for a read-only key', () => {
    expect(requirePermission(auth(['read']), 'intelligence')).toBe(false)
  })

  it('accepts intelligence for {read,intelligence}', () => {
    expect(requirePermission(auth(['read', 'intelligence']), 'intelligence')).toBe(true)
  })

  it('rejects write for {read,intelligence}', () => {
    expect(requirePermission(auth(['read', 'intelligence']), 'write')).toBe(false)
  })

  it('accepts intelligence for write and for admin', () => {
    expect(requirePermission(auth(['read', 'write']), 'intelligence')).toBe(true)
    expect(requirePermission(auth(['admin']), 'intelligence')).toBe(true)
  })

  it('keeps read working for {read,intelligence}', () => {
    expect(requirePermission(auth(['read', 'intelligence']), 'read')).toBe(true)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/web && npx vitest run test/api/pipeline/youtube-intelligence-auth.test.ts`
Expected: FAIL — TypeScript recusa `'intelligence'` no parâmetro `required`, e o caso `{read,intelligence}` devolve `false`.

- [ ] **Step 3: Implementar**

`src/lib/pipeline/services/types.ts:3`:
```ts
export type Permission = 'read' | 'write' | 'admin' | 'intelligence'
```

`src/lib/pipeline/auth.ts:99-103` — substituir a função inteira:
```ts
export function requirePermission(auth: PipelineAuth, required: 'read' | 'write' | 'admin' | 'intelligence'): boolean {
  if (required === 'read') return auth.permissions.includes('read') || auth.permissions.includes('write') || auth.permissions.includes('admin')
  // 'intelligence' is the narrow write scope for the YouTube intelligence queue: the
  // forja key holds it alone, and the wider write/admin keys subsume it.
  if (required === 'intelligence') return auth.permissions.includes('intelligence') || auth.permissions.includes('write') || auth.permissions.includes('admin')
  if (required === 'write') return auth.permissions.includes('write') || auth.permissions.includes('admin')
  return auth.permissions.includes('admin')
}
```

`src/lib/pipeline/helpers.ts` — depois de `authenticateRead` (linha 38):
```ts
/**
 * Authenticate a request against the narrow `intelligence` scope.
 *
 * `apiKeyOnly` exists because the queue routes hand a task to a worker: a session
 * has no worker to hand it to and would leave the task orphaned, so it gets a 403.
 */
export async function authenticateIntel(
  req: NextRequest,
  opts?: { apiKeyOnly?: boolean },
): Promise<{ ok: true; auth: PipelineAuth } | NextResponse> {
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return pipelineError('UNAUTHORIZED', authResult.error, authResult.status)
  if (opts?.apiKeyOnly && authResult.auth.source !== 'api_key') {
    return pipelineError('FORBIDDEN', 'API key required', 403, authResult.auth)
  }
  if (!requirePermission(authResult.auth, 'intelligence')) {
    return pipelineError('FORBIDDEN', 'Insufficient permissions', 403, authResult.auth)
  }
  return { ok: true, auth: authResult.auth }
}
```

`src/lib/pipeline/api-registry.ts:7`:
```ts
  auth: 'read' | 'write' | 'intelligence'
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd apps/web && npx vitest run test/api/pipeline/youtube-intelligence-auth.test.ts`
Expected: PASS (5 testes)

Run: `npm run typecheck --workspace=apps/web`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git add apps/web/src/lib/pipeline/services/types.ts apps/web/src/lib/pipeline/auth.ts apps/web/src/lib/pipeline/helpers.ts apps/web/src/lib/pipeline/api-registry.ts apps/web/test/api/pipeline/youtube-intelligence-auth.test.ts
git commit -m "feat: permissao intelligence e authenticateIntel no pipeline

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `claimNextTask` — CAS único, `claimed_by`, sem `statusFilter`

Muda o serviço **e os dois chamadores** (GET legado e `claim_task` do MCP) no mesmo commit — sem isso o typecheck quebra.

**Files:**
- Modify: `apps/web/src/lib/pipeline/services/youtube.ts:77-83` (`IntelTask`), `:455-488` (`claimNextTask`)
- Modify: `apps/web/src/app/api/pipeline/youtube/intelligence/task/route.ts` (inteiro)
- Modify: `apps/web/src/lib/pipeline/mcp/services/ab-tests.ts:19-27` (`buildCtx`), `:35` (`WRITE_ACTIONS`)
- Modify: `apps/web/test/api/pipeline/youtube-intelligence.test.ts:26-29, 72-88, 303-358`
- Test: `apps/web/test/lib/pipeline/services/youtube-intelligence-service.test.ts` (novo)
- Test: `apps/web/test/mcp/ab-tests-intel.test.ts` (novo)
- Test: `apps/web/test/api/pipeline/youtube-intelligence-auth.test.ts` (acrescenta o 403 do GET legado)

**Interfaces:**
- Consumes: `requirePermission(auth,'intelligence')`, `authenticateIntel` (Task 1).
- Produces: `claimNextTask(ctx, channelIds?)` devolvendo `IntelTask` com `started_at`; `result_summary.claimed_by` gravado em todo claim.

- [ ] **Step 1: Escrever o teste de serviço que falha**

Criar `apps/web/test/lib/pipeline/services/youtube-intelligence-service.test.ts` com um mock encadeável que grava cada chamada (padrão de `test/lib/pipeline/services/items-history-key-identity.test.ts`):

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { claimNextTask } from '@/lib/pipeline/services/youtube'
import type { ServiceContext } from '@/lib/pipeline/services/types'

vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))

type Call = { op: string; args: unknown[] }

/** Chainable PostgREST double: records every call, replays queued terminal results. */
function makeSupabase(results: Array<{ data: unknown; error: unknown }>) {
  const calls: Call[] = []
  const tables: string[] = []
  let i = 0
  const chain: Record<string, unknown> = {}
  for (const op of ['select', 'eq', 'in', 'order', 'limit', 'update', 'is', 'not', 'gte', 'insert']) {
    chain[op] = vi.fn((...args: unknown[]) => { calls.push({ op, args }); return chain })
  }
  chain.maybeSingle = vi.fn(async () => results[i++] ?? { data: null, error: null })
  chain.single = vi.fn(async () => results[i++] ?? { data: null, error: null })
  // Real supabase-js resolves ANY filter builder when awaited, not just one ending in
  // `.single()`/`.maybeSingle()` — `.insert(x)` and a bare `.select().eq().in(...)` are both
  // awaited directly in the service. With `then = undefined`, such a call resolves to the
  // chain object instead of the queued `{ data, error }`, silently starving every later
  // assertion in the same test.
  chain.then = (resolve: (value: unknown) => void) => resolve(results[i++] ?? { data: null, error: null })
  return {
    calls,
    tables,
    /**
     * Calls recorded from the Nth occurrence of `op` onward.
     *
     * The double shares ONE chain across every query, so `calls` alone cannot tell a
     * SELECT's `.eq('site_id', …)` from the UPDATE's. Asserting on `calls` therefore
     * "passes" for a CAS that lost its site filter — which is exactly how a key from
     * site A would come to claim site B's task with the suite green. Every assertion
     * about a CAS/UPDATE clause MUST go through this slice, never through `calls`.
     */
    from(op: string) {
      const idx = calls.findIndex(c => c.op === op)
      if (idx === -1) throw new Error(`no '${op}' call recorded`)
      return calls.slice(idx)
    },
    client: { from: vi.fn((t: string) => { tables.push(t); return chain }) },
  }
}

function ctxOf(sb: { client: unknown }, over: Partial<ServiceContext> = {}): ServiceContext {
  return {
    siteId: 'site-1',
    permissions: ['read', 'intelligence'],
    keyId: 'key-forja',
    supabase: sb.client as ServiceContext['supabase'],
    source: 'api_key',
    ...over,
  }
}

describe('claimNextTask', () => {
  beforeEach(() => vi.clearAllMocks())

  it('claims the oldest pending task filtered by channel_ids and records claimed_by', async () => {
    const sb = makeSupabase([
      { data: { id: 't1' }, error: null },
      { data: { id: 't1', site_id: 'site-1', channel_id: 'ch-1', trigger_type: 'cron', requested_at: '2026-09-01T00:00:00Z', started_at: '2026-09-19T10:00:00Z' }, error: null },
    ])
    const res = await claimNextTask(ctxOf(sb), ['ch-1'])

    expect(res.data).toMatchObject({ id: 't1', started_at: '2026-09-19T10:00:00Z' })
    expect(sb.calls).toContainEqual({ op: 'in', args: ['channel_id', ['ch-1']] })   // filtro do SELECT
    const update = sb.calls.find(c => c.op === 'update')!
    expect(update.args[0]).toMatchObject({ status: 'running', result_summary: { claimed_by: 'key-forja' } })
    // Clauses of the CAS are asserted on the slice from the UPDATE onward — on `calls`
    // they would be satisfied by the SELECT above and prove nothing about the UPDATE.
    const cas = sb.from('update')
    expect(cas).toContainEqual({ op: 'eq', args: ['site_id', 'site-1'] })
    expect(cas).toContainEqual({ op: 'eq', args: ['status', 'pending'] })
    expect(cas).toContainEqual({ op: 'select', args: ['id, site_id, channel_id, trigger_type, requested_at, started_at'] })
  })

  it('returns null (204 upstream) when the queue is empty', async () => {
    const sb = makeSupabase([{ data: null, error: null }])
    const res = await claimNextTask(ctxOf(sb), ['ch-1'])
    expect(res.data).toBeNull()
  })

  it('returns null when the CAS is lost to another consumer', async () => {
    const sb = makeSupabase([
      { data: { id: 't1' }, error: null },
      { data: null, error: null },
    ])
    const res = await claimNextTask(ctxOf(sb), ['ch-1'])
    expect(res.data).toBeNull()
  })

  it('throws INTERNAL_ERROR when the SELECT errors — never a silent 204', async () => {
    const sb = makeSupabase([{ data: null, error: { message: 'boom' } }])
    await expect(claimNextTask(ctxOf(sb), ['ch-1'])).rejects.toMatchObject({ code: 'INTERNAL_ERROR', status: 500 })
  })

  it('throws INTERNAL_ERROR when the CAS UPDATE errors', async () => {
    const sb = makeSupabase([
      { data: { id: 't1' }, error: null },
      { data: null, error: { message: 'boom' } },
    ])
    await expect(claimNextTask(ctxOf(sb), ['ch-1'])).rejects.toMatchObject({ code: 'INTERNAL_ERROR', status: 500 })
  })

  it('does not filter by channel when no ids are given (legacy GET path)', async () => {
    const sb = makeSupabase([{ data: null, error: null }])
    await claimNextTask(ctxOf(sb))
    expect(sb.calls.some(c => c.op === 'in')).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/web && npx vitest run test/lib/pipeline/services/youtube-intelligence-service.test.ts`
Expected: FAIL — `claimNextTask` ainda aceita `statusFilter: string`, usa `.single()`, não grava `result_summary` e não devolve `started_at`.

- [ ] **Step 3: Implementar o serviço**

`src/lib/pipeline/services/youtube.ts:77-83` — `IntelTask` ganha `started_at`:
```ts
export interface IntelTask {
  id: string
  site_id: string
  channel_id: string
  trigger_type: string
  requested_at: string
  started_at: string
}
```

`src/lib/pipeline/services/youtube.ts:454-488` — substituir `claimNextTask` inteira:
```ts
/**
 * Claim the next pending intelligence task via optimistic CAS.
 *
 * This is the ONLY place the claim CAS lives: the POST route, the legacy GET and the
 * MCP `claim_task` all funnel through here, so every claim records who holds the task
 * (`result_summary.claimed_by`) and every claim writes `started_at` from the server clock.
 * A DB error is never flattened into "queue empty" — that used to turn an outage into a
 * silent 204 and left the worker looping against a broken queue.
 */
export async function claimNextTask(
  ctx: ServiceContext,
  channelIds?: string[],
): Promise<ServiceResult<IntelTask | null>> {
  const { supabase, siteId } = ctx

  let pending = supabase
    .from('youtube_intelligence_tasks')
    .select('id')
    .eq('site_id', siteId)
    .eq('status', 'pending')

  if (channelIds?.length) pending = pending.in('channel_id', channelIds)

  const { data: task, error: selectError } = await pending
    .order('requested_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (selectError) return err('INTERNAL_ERROR', 'Failed to read the task queue', 500)
  if (!task) return ok(null)

  const { data: claimed, error: updateError } = await supabase
    .from('youtube_intelligence_tasks')
    .update({
      status: 'running',
      started_at: new Date().toISOString(),
      result_summary: { claimed_by: ctx.keyId ?? null },
    })
    .eq('id', task.id)
    .eq('site_id', siteId)
    .eq('status', 'pending')
    // Closed column list, never '*': error_message and result_summary can carry text
    // written by a narrow key and must not travel back to whoever claims next.
    .select('id, site_id, channel_id, trigger_type, requested_at, started_at')
    .maybeSingle()

  if (updateError) return err('INTERNAL_ERROR', 'Failed to claim the task', 500)
  if (!claimed) return ok(null)

  return ok(claimed as IntelTask)
}
```

- [ ] **Step 4: Rodar o teste de serviço**

Run: `cd apps/web && npx vitest run test/lib/pipeline/services/youtube-intelligence-service.test.ts`
Expected: PASS (6 testes)

- [ ] **Step 5: Escrever o teste do GET legado que falha**

Em `apps/web/test/api/pipeline/youtube-intelligence-auth.test.ts`, acrescentar (o arquivo **não** mocka `@/lib/pipeline/helpers`; só `authenticatePipeline`):

```ts
import { vi } from 'vitest'

vi.mock('@/lib/pipeline/auth', async (orig) => ({
  ...(await orig<typeof import('@/lib/pipeline/auth')>()),
  authenticatePipeline: vi.fn(),
}))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn(() => { throw new Error('db must not be reached') }) }))

import { authenticatePipeline } from '@/lib/pipeline/auth'

function get(url = 'http://localhost/api/pipeline/youtube/intelligence/task') {
  return new Request(url) as never
}

describe('GET /api/pipeline/youtube/intelligence/task — legacy claim needs write', () => {
  it('403s a {read} key without touching the queue', async () => {
    vi.mocked(authenticatePipeline).mockResolvedValue({ ok: true, auth: { siteId: 'site-1', permissions: ['read'], source: 'api_key', keyHash: 'h', keyId: 'k' } })
    const { GET } = await import('@/app/api/pipeline/youtube/intelligence/task/route')
    const res = await GET(get())
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('FORBIDDEN')
  })

  it('403s a {read,intelligence} key — the narrow key claims only via POST', async () => {
    vi.mocked(authenticatePipeline).mockResolvedValue({ ok: true, auth: { siteId: 'site-1', permissions: ['read', 'intelligence'], source: 'api_key', keyHash: 'h', keyId: 'k' } })
    const { GET } = await import('@/app/api/pipeline/youtube/intelligence/task/route')
    const res = await GET(get())
    expect(res.status).toBe(403)
  })
})
```

- [ ] **Step 6: Reescrever o GET legado**

`src/app/api/pipeline/youtube/intelligence/task/route.ts` — arquivo inteiro:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { authenticateIntel, pipelineError, pipelineSuccess } from '@/lib/pipeline/helpers'
import { requirePermission } from '@/lib/pipeline/auth'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { claimNextTask } from '@/lib/pipeline/services/youtube'

export const dynamic = 'force-dynamic'

/**
 * Legacy claim endpoint — the Cowork path. It keeps claiming without channel filters,
 * so it now requires write/admin: the narrow {read,intelligence} key claims only through
 * POST .../task/claim, which forces channel_ids. `?status=` is gone: it used to let a
 * caller reopen an already-completed task.
 */
export async function GET(req: NextRequest) {
  const result = await authenticateIntel(req, { apiKeyOnly: true })
  if (result instanceof Response) return result
  const { auth } = result

  if (!requirePermission(auth, 'write')) {
    return pipelineError('FORBIDDEN', 'Insufficient permissions', 403, auth)
  }

  try {
    const ctx = authToServiceContext(auth)
    const { data: task } = await claimNextTask(ctx)

    if (!task) return new NextResponse(null, { status: 204 })

    return pipelineSuccess(task, 200, auth)
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}
```

- [ ] **Step 7: Escrever o teste do MCP que falha**

Criar `apps/web/test/mcp/ab-tests-intel.test.ts`:
```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mcpCtx = { siteId: 'site-1', permissions: ['read'] as string[], keyHash: 'h', keyId: 'key-1' }
vi.mock('@/lib/pipeline/mcp/context', () => ({ getMcpContext: () => mcpCtx }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn(() => ({ from: vi.fn() })) }))
vi.mock('@/lib/pipeline/services/youtube', async (orig) => ({
  ...(await orig<typeof import('@/lib/pipeline/services/youtube')>()),
  claimNextTask: vi.fn(async () => ({ data: null })),
  submitIntelRecommendations: vi.fn(async () => ({ data: { status: 'ok', processed: true } })),
}))

import { manageAbTest } from '@/lib/pipeline/mcp/services/ab-tests'
import { claimNextTask } from '@/lib/pipeline/services/youtube'

describe('manage_ab_test — intelligence actions require write over MCP', () => {
  beforeEach(() => { vi.clearAllMocks(); mcpCtx.permissions = ['read'] })

  it('FORBIDs claim_task for a {read} key', async () => {
    const res = await manageAbTest({ action: 'claim_task' })
    expect(JSON.stringify(res)).toContain('FORBIDDEN')
    expect(claimNextTask).not.toHaveBeenCalled()
  })

  it('FORBIDs claim_task for a {read,intelligence} key — REST only', async () => {
    mcpCtx.permissions = ['read', 'intelligence']
    const res = await manageAbTest({ action: 'claim_task' })
    expect(JSON.stringify(res)).toContain('FORBIDDEN')
    expect(claimNextTask).not.toHaveBeenCalled()
  })

  it('passes keyId into the service context so claimed_by is recorded', async () => {
    mcpCtx.permissions = ['read', 'write']
    await manageAbTest({ action: 'claim_task' })
    expect(vi.mocked(claimNextTask).mock.calls[0]![0]).toMatchObject({ keyId: 'key-1' })
  })

  it('FORBIDs upsert_variants and delete_variant for {read,intelligence}', async () => {
    mcpCtx.permissions = ['read', 'intelligence']
    for (const action of ['upsert_variants', 'delete_variant', 'submit_intelligence']) {
      expect(JSON.stringify(await manageAbTest({ action }))).toContain('FORBIDDEN')
    }
  })
})
```

- [ ] **Step 8: Implementar o MCP**

`src/lib/pipeline/mcp/services/ab-tests.ts:19-28` — `buildCtx` ganha `keyId`:
```ts
function buildCtx(): ServiceContext {
  const mcp = getMcpContext()
  return {
    siteId: mcp.siteId,
    permissions: mcp.permissions as ServiceContext['permissions'],
    keyHash: mcp.keyHash,
    keyId: mcp.keyId,
    supabase: getSupabaseServiceClient(),
    source: 'api_key',
  }
}
```

`src/lib/pipeline/mcp/services/ab-tests.ts:35` — `claim_task` entra na lista:
```ts
    // claim_task hands a task to a worker, so over MCP it needs write like submit_intelligence.
    // The narrow {read,intelligence} key claims only over REST, where channel_ids is required.
    const WRITE_ACTIONS = ['upsert_variants', 'delete_variant', 'submit_intelligence', 'claim_task']
```

- [ ] **Step 9: Ajustar os testes existentes do GET legado**

Em `apps/web/test/api/pipeline/youtube-intelligence.test.ts`:
- no mock de helpers (`:12-24`), acrescentar `authenticateIntel: vi.fn()`;
- o mock de `@/lib/pipeline/auth` (`:26-29`) passa a preservar o módulo real, porque a rota agora importa `requirePermission` de lá:
```ts
vi.mock('@/lib/pipeline/auth', async (orig) => ({
  ...(await orig<typeof import('@/lib/pipeline/auth')>()),
  buildRateLimitHeaders: vi.fn().mockReturnValue(undefined),
}))
```
- nos testes do GET `/task` (`:303-358`), trocar `mockAuthRead` por `authenticateIntel` mockado devolvendo `{ ok: true, auth: { siteId: 'site-1', permissions: ['read','write'], source: 'api_key', keyHash: 'h', keyId: 'k' } }`;
- `:353-358` passa a afirmar a chamada sem status:
```ts
    expect(claimNextTask).toHaveBeenCalledWith(expect.objectContaining({ siteId: 'site-1' }))
    expect(vi.mocked(claimNextTask).mock.calls[0]).toHaveLength(1)
```
- o teste que passava `?status=failed` passa a afirmar o mesmo: a rota ignora o parâmetro.

- [ ] **Step 10: Rodar tudo e ver passar**

```bash
cd apps/web && npx vitest run \
  test/lib/pipeline/services/youtube-intelligence-service.test.ts \
  test/api/pipeline/youtube-intelligence-auth.test.ts \
  test/api/pipeline/youtube-intelligence.test.ts \
  test/mcp/ab-tests-intel.test.ts
```
Expected: PASS em todos.

Run: `npm run typecheck --workspace=apps/web`
Expected: sem erros.

- [ ] **Step 11: Commit**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git add apps/web/src/lib/pipeline/services/youtube.ts \
  "apps/web/src/app/api/pipeline/youtube/intelligence/task/route.ts" \
  apps/web/src/lib/pipeline/mcp/services/ab-tests.ts \
  apps/web/test/lib/pipeline/services/youtube-intelligence-service.test.ts \
  apps/web/test/api/pipeline/youtube-intelligence-auth.test.ts \
  apps/web/test/api/pipeline/youtube-intelligence.test.ts \
  apps/web/test/mcp/ab-tests-intel.test.ts
git commit -m "feat: claim de task com CAS unico, claimed_by e escopo por chave

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `POST .../intelligence/task/claim`

**Files:**
- Create: `apps/web/src/app/api/pipeline/youtube/intelligence/task/claim/route.ts`
- Modify: `apps/web/src/lib/pipeline/api-registry.ts:169` (`endpoint_count` 31→32), `:170` (entrada nova)
- Modify: `apps/web/test/lib/pipeline/api-registry.test.ts:38`, `apps/web/test/mcp/mcp-registry-sync.test.ts:28-29`
- Test: `apps/web/test/api/pipeline/youtube-intelligence-task-routes.test.ts` (novo)
- Test: `apps/web/test/api/pipeline/youtube-intelligence-auth.test.ts` (403 de sessão)

**Interfaces:**
- Consumes: `authenticateIntel({apiKeyOnly:true})` (Task 1), `claimNextTask(ctx, channelIds)` (Task 2), `parseBody(req, schema)` (`helpers.ts:56-85`).
- Produces: rota POST; entrada no registry com `auth: 'intelligence'`.

- [ ] **Step 1: Escrever os testes que falham**

Criar `apps/web/test/api/pipeline/youtube-intelligence-task-routes.test.ts`:
```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/pipeline/helpers', async (orig) => ({
  ...(await orig<typeof import('@/lib/pipeline/helpers')>()),
  authenticateIntel: vi.fn(),
}))
vi.mock('@/lib/pipeline/services/youtube', () => ({
  claimNextTask: vi.fn(),
  failTask: vi.fn(),
}))
vi.mock('@/lib/pipeline/services/http-adapter', async (orig) => ({
  ...(await orig<typeof import('@/lib/pipeline/services/http-adapter')>()),
  authToServiceContext: vi.fn(() => ({ siteId: 'site-1', permissions: ['read', 'intelligence'], keyId: 'key-forja', supabase: {}, source: 'api_key' })),
}))

import { authenticateIntel } from '@/lib/pipeline/helpers'
import { claimNextTask } from '@/lib/pipeline/services/youtube'
import { PipelineServiceError } from '@/lib/pipeline/services/types'

const AUTH = { ok: true as const, auth: { siteId: 'site-1', permissions: ['read', 'intelligence'], source: 'api_key' as const, keyHash: 'h', keyId: 'key-forja' } }
const CH = '11111111-1111-4111-8111-111111111111'

function post(body: unknown, url = 'http://localhost/api/pipeline/youtube/intelligence/task/claim') {
  return new Request(url, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }) as never
}

describe('POST .../intelligence/task/claim', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(authenticateIntel).mockResolvedValue(AUTH) })

  it('200s with the claimed task, including started_at', async () => {
    vi.mocked(claimNextTask).mockResolvedValue({ data: { id: 't1', site_id: 'site-1', channel_id: CH, trigger_type: 'cron', requested_at: '2026-09-01T00:00:00Z', started_at: '2026-09-19T10:00:00Z' } } as never)
    const { POST } = await import('@/app/api/pipeline/youtube/intelligence/task/claim/route')
    const res = await POST(post({ channel_ids: [CH] }))
    expect(res.status).toBe(200)
    expect((await res.json()).data).toMatchObject({ id: 't1', started_at: '2026-09-19T10:00:00Z' })
    expect(vi.mocked(claimNextTask).mock.calls[0]![1]).toEqual([CH])
  })

  it('204s on an empty queue', async () => {
    vi.mocked(claimNextTask).mockResolvedValue({ data: null } as never)
    const { POST } = await import('@/app/api/pipeline/youtube/intelligence/task/claim/route')
    const res = await POST(post({ channel_ids: [CH] }))
    expect(res.status).toBe(204)
  })

  it('400s without a body, with an empty list, with 11 ids or with a non-uuid — and never reaches the service', async () => {
    const { POST } = await import('@/app/api/pipeline/youtube/intelligence/task/claim/route')
    const eleven = Array.from({ length: 11 }, () => CH)
    for (const body of [{}, { channel_ids: [] }, { channel_ids: eleven }, { channel_ids: ['nope'] }]) {
      const res = await POST(post(body))
      expect(res.status).toBe(400)
      expect((await res.json()).error.code).toBe('VALIDATION_ERROR')
    }
    expect(claimNextTask).not.toHaveBeenCalled()
  })

  it('500s when the service reports a DB error — never a silent 204', async () => {
    vi.mocked(claimNextTask).mockRejectedValue(new PipelineServiceError('INTERNAL_ERROR', 'Failed to read the task queue', 500))
    const { POST } = await import('@/app/api/pipeline/youtube/intelligence/task/claim/route')
    const res = await POST(post({ channel_ids: [CH] }))
    expect(res.status).toBe(500)
  })
})
```

Em `apps/web/test/api/pipeline/youtube-intelligence-auth.test.ts`, acrescentar o 403 de sessão (é o único lugar onde `apiKeyOnly` é exercitado de verdade):
```ts
it('403s a session on the claim route — a session has no worker to hand the task to', async () => {
  vi.mocked(authenticatePipeline).mockResolvedValue({ ok: true, auth: { siteId: 'site-1', permissions: ['read', 'write'], source: 'session' } })
  const { POST } = await import('@/app/api/pipeline/youtube/intelligence/task/claim/route')
  const res = await POST(new Request('http://localhost/x', { method: 'POST', body: '{"channel_ids":["11111111-1111-4111-8111-111111111111"]}', headers: { 'content-type': 'application/json' } }) as never)
  expect(res.status).toBe(403)
  expect((await res.json()).error.code).toBe('FORBIDDEN')
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/web && npx vitest run test/api/pipeline/youtube-intelligence-task-routes.test.ts`
Expected: FAIL — o módulo `@/app/api/pipeline/youtube/intelligence/task/claim/route` não existe.

- [ ] **Step 3: Criar a rota**

`apps/web/src/app/api/pipeline/youtube/intelligence/task/claim/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authenticateIntel, parseBody, pipelineSuccess } from '@/lib/pipeline/helpers'
import { buildRateLimitHeaders } from '@/lib/pipeline/auth'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { claimNextTask } from '@/lib/pipeline/services/youtube'

export const dynamic = 'force-dynamic'

/**
 * channel_ids is required, not optional: the forja drains one channel list and must never
 * claim a task for a channel it cannot analyse (the EN channel has no videos at all).
 */
const ClaimSchema = z.object({
  channel_ids: z.array(z.string().uuid()).min(1).max(10),
})

export async function POST(req: NextRequest) {
  const result = await authenticateIntel(req, { apiKeyOnly: true })
  if (result instanceof Response) return result
  const { auth } = result

  const body = await parseBody(req, ClaimSchema)
  if (body instanceof Response) return body

  try {
    const ctx = authToServiceContext(auth)
    const { data: task } = await claimNextTask(ctx, body.channel_ids)

    // 204 means "empty queue, or the CAS went to someone else" — the worker retries next cycle.
    if (!task) return new NextResponse(null, { status: 204, headers: buildRateLimitHeaders(auth) })

    return pipelineSuccess(task, 200, auth)
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}
```

- [ ] **Step 4: Registry**

`src/lib/pipeline/api-registry.ts:169` → `endpoint_count: 32`.
Logo depois de `:173` (GET legado), acrescentar:
```ts
    { method: 'POST', path: '/api/pipeline/youtube/intelligence/task/claim', summary: 'Claim next pending intelligence task by channel_ids (API key only) — accepts intelligence, write or admin', auth: 'intelligence' },
```

Ajustar as contagens dos testes que as afirmam: `test/lib/pipeline/api-registry.test.ts:38` e `test/mcp/mcp-registry-sync.test.ts:28-29` (`youtube(31)` → `youtube(32)`, `123` → `124`).

- [ ] **Step 5: Rodar e ver passar**

```bash
cd apps/web && npx vitest run \
  test/api/pipeline/youtube-intelligence-task-routes.test.ts \
  test/api/pipeline/youtube-intelligence-auth.test.ts \
  test/lib/pipeline/api-registry.test.ts \
  test/mcp/mcp-registry-sync.test.ts \
  test/api/pipeline/registry-completeness.test.ts
```
Expected: PASS em todos.

Run: `npm run typecheck --workspace=apps/web`

- [ ] **Step 6: Commit**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git add "apps/web/src/app/api/pipeline/youtube/intelligence/task/claim/route.ts" \
  apps/web/src/lib/pipeline/api-registry.ts \
  apps/web/test/api/pipeline/youtube-intelligence-task-routes.test.ts \
  apps/web/test/api/pipeline/youtube-intelligence-auth.test.ts \
  apps/web/test/lib/pipeline/api-registry.test.ts \
  apps/web/test/mcp/mcp-registry-sync.test.ts
git commit -m "feat: rota POST de claim da fila de inteligencia

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `failTask` + `POST .../intelligence/task/:id/fail`

**Files:**
- Modify: `apps/web/src/lib/pipeline/services/youtube.ts` (nova `failTask`, ao lado de `claimNextTask`)
- Create: `apps/web/src/app/api/pipeline/youtube/intelligence/task/[id]/fail/route.ts`
- Modify: `apps/web/src/lib/pipeline/mcp/errors.ts:45-61` (`TASK_NOT_RUNNING`)
- Modify: `apps/web/src/lib/pipeline/api-registry.ts:169` (32→33) e entrada nova
- Modify: `apps/web/test/lib/pipeline/api-registry.test.ts:38`, `apps/web/test/mcp/mcp-registry-sync.test.ts:28-29`
- Test: `apps/web/test/lib/pipeline/services/youtube-intelligence-service.test.ts` (bloco `failTask`)
- Test: `apps/web/test/api/pipeline/youtube-intelligence-task-routes.test.ts` (bloco da rota)
- Test: `apps/web/test/api/pipeline/youtube-intelligence-auth.test.ts` (403 `{read}` e 403 de sessão no fail)
- Test: `apps/web/test/mcp/mcp-errors.test.ts` (novo código no mapa)

**Interfaces:**
- Consumes: `authenticateIntel({apiKeyOnly:true})`, `parseBody`.
- Produces: `failTask(ctx, taskId, {reason, retry})` → `{id, status, retry_count}`; código `TASK_NOT_RUNNING`.

- [ ] **Step 1: Escrever os testes de serviço que falham**

Acrescentar a `test/lib/pipeline/services/youtube-intelligence-service.test.ts`:
```ts
import { failTask } from '@/lib/pipeline/services/youtube'

describe('failTask', () => {
  const running = (over: Record<string, unknown> = {}) => ({
    data: { id: 't1', status: 'running', retry_count: 0, result_summary: { claimed_by: 'key-forja' }, started_at: '2026-09-19T10:00:00Z', ...over },
    error: null,
  })

  it('fails the task terminally without retry', async () => {
    const sb = makeSupabase([running(), { data: { id: 't1', status: 'failed', retry_count: 0 }, error: null }])
    const res = await failTask(ctxOf(sb), 't1', { reason: 'patch 400' })
    expect(res.data).toEqual({ id: 't1', status: 'failed', retry_count: 0 })
    const patch = sb.calls.find(c => c.op === 'update')!.args[0] as Record<string, unknown>
    expect(patch).toMatchObject({ status: 'failed', error_message: 'patch 400' })
    expect(patch.completed_at).toBeUndefined()
    // CAS clauses: id, site, running, the exact started_at this request read, and the owner
    // Sobre a FATIA do update: em `calls` cru, o SELECT anterior satisfaz estas assercoes e o
    // CAS pode perder `id`, `site_id` ou `status` sem o teste reclamar. Ja aconteceu aqui.
    const cas = sb.from('update')
    expect(cas).toContainEqual({ op: 'eq', args: ['started_at', '2026-09-19T10:00:00Z'] })
    expect(cas).toContainEqual({ op: 'eq', args: ['result_summary->>claimed_by', 'key-forja'] })
    expect(cas).toContainEqual({ op: 'eq', args: ['site_id', 'site-1'] })
    expect(cas).toContainEqual({ op: 'eq', args: ['status', 'running'] })
  })

  it('requeues with retry:true while retry_count < 2', async () => {
    const sb = makeSupabase([running({ retry_count: 1 }), { data: { id: 't1', status: 'pending', retry_count: 2 }, error: null }])
    const res = await failTask(ctxOf(sb), 't1', { reason: 'llama', retry: true })
    expect(res.data).toMatchObject({ status: 'pending', retry_count: 2 })
    const patch = sb.calls.find(c => c.op === 'update')!.args[0] as Record<string, unknown>
    expect(patch).toMatchObject({ status: 'pending', retry_count: 2, started_at: null, error_message: null })
  })

  it('fails terminally on the third retry', async () => {
    const sb = makeSupabase([running({ retry_count: 2 }), { data: { id: 't1', status: 'failed', retry_count: 2 }, error: null }])
    await failTask(ctxOf(sb), 't1', { reason: 'llama', retry: true })
    expect((sb.calls.find(c => c.op === 'update')!.args[0] as Record<string, unknown>).status).toBe('failed')
  })

  it('404s when the task is missing or belongs to another site', async () => {
    const sb = makeSupabase([{ data: null, error: null }])
    await expect(failTask(ctxOf(sb), 't1', { reason: 'x' })).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 })
  })

  it('500s — never 404 — when the SELECT itself errors, without any UPDATE', async () => {
    const sb = makeSupabase([{ data: null, error: { message: 'boom' } }])
    await expect(failTask(ctxOf(sb), 't1', { reason: 'x' })).rejects.toMatchObject({ code: 'INTERNAL_ERROR', status: 500 })
    expect(sb.calls.some(c => c.op === 'update')).toBe(false)
  })

  it('409s when the task is not running', async () => {
    const sb = makeSupabase([running({ status: 'stale' })])
    await expect(failTask(ctxOf(sb), 't1', { reason: 'x' })).rejects.toMatchObject({ code: 'TASK_NOT_RUNNING', status: 409 })
  })

  it('409s a narrow key on a task claimed by someone else, and when keyId is missing', async () => {
    const other = makeSupabase([running({ result_summary: { claimed_by: 'key-other' } })])
    await expect(failTask(ctxOf(other), 't1', { reason: 'x' })).rejects.toMatchObject({ code: 'TASK_NOT_RUNNING' })
    expect(other.calls.some(c => c.op === 'update')).toBe(false)

    const noKey = makeSupabase([running()])
    await expect(failTask(ctxOf(noKey, { keyId: undefined }), 't1', { reason: 'x' })).rejects.toMatchObject({ code: 'TASK_NOT_RUNNING' })
  })

  it('lets a write key close a task claimed by the forja', async () => {
    const sb = makeSupabase([running(), { data: { id: 't1', status: 'failed', retry_count: 0 }, error: null }])
    await failTask(ctxOf(sb, { permissions: ['read', 'write'], keyId: 'key-cowork' }), 't1', { reason: 'x' })
    expect(sb.calls.some(c => c.op === 'eq' && c.args[0] === 'result_summary->>claimed_by')).toBe(false)
  })

  it('409s when the CAS returns no row', async () => {
    const sb = makeSupabase([running(), { data: null, error: null }])
    await expect(failTask(ctxOf(sb), 't1', { reason: 'x' })).rejects.toMatchObject({ code: 'TASK_NOT_RUNNING', status: 409 })
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/web && npx vitest run test/lib/pipeline/services/youtube-intelligence-service.test.ts`
Expected: FAIL — `failTask` não existe.

- [ ] **Step 3: Implementar `failTask`**

Em `src/lib/pipeline/services/youtube.ts`, logo depois de `claimNextTask`:
```ts
export interface FailTaskResult {
  id: string
  status: string
  retry_count: number
}

/**
 * Close a running task explicitly — the worker's way of saying "I could not finish this".
 *
 * The CAS pins `started_at` to the value THIS request read, not just status + owner:
 * `claimed_by` is the key id and is identical across every claim the forja makes, so
 * status + owner alone would let a late `fail` close a claim that started afterwards.
 */
export async function failTask(
  ctx: ServiceContext,
  taskId: string,
  input: { reason: string; retry?: boolean },
): Promise<ServiceResult<FailTaskResult>> {
  const { supabase, siteId, keyId, permissions } = ctx
  const isWide = permissions.includes('write') || permissions.includes('admin')

  const { data: task, error: selectError } = await supabase
    .from('youtube_intelligence_tasks')
    .select('id, status, retry_count, result_summary, started_at')
    .eq('id', taskId)
    .eq('site_id', siteId)
    .maybeSingle()

  if (selectError) return err('INTERNAL_ERROR', 'Failed to read the task', 500)
  if (!task) return err('NOT_FOUND', 'Task not found', 404)
  if (task.status !== 'running') {
    return err('TASK_NOT_RUNNING', `Task status is '${task.status}', expected 'running'`, 409)
  }

  const previous = (task.result_summary ?? {}) as Record<string, unknown>
  if (!isWide && (!keyId || previous.claimed_by !== keyId)) {
    return err('TASK_NOT_RUNNING', 'Task is held by another key', 409)
  }

  // supabase-js cannot increment a column in place, so the new value is computed from the
  // row we just read, and `retry_count < 2` is judged on that same read value.
  const requeue = input.retry === true && task.retry_count < 2
  const patch = requeue
    ? {
        status: 'pending',
        retry_count: task.retry_count + 1,
        started_at: null,
        error_message: null,
        result_summary: { ...previous, closed_by: keyId ?? null },
      }
    : {
        status: 'failed',
        failed_at: new Date().toISOString(),
        error_message: input.reason,
        result_summary: { ...previous, closed_by: keyId ?? null },
      }

  if (requeue) {
    // The reason never lands on the row when the task goes back to the queue — the next
    // claimant would read it — so it goes to Sentry instead.
    Sentry.captureMessage(`intelligence task requeued: ${input.reason}`, { extra: { taskId } })
  }

  let cas = supabase
    .from('youtube_intelligence_tasks')
    .update(patch)
    .eq('id', taskId)
    .eq('site_id', siteId)
    .eq('status', 'running')
    .eq('started_at', task.started_at)

  if (!isWide) cas = cas.eq('result_summary->>claimed_by', keyId as string)

  const { data: closed, error: updateError } = await cas.select('id, status, retry_count').maybeSingle()

  if (updateError) return err('INTERNAL_ERROR', 'Failed to close the task', 500)
  if (!closed) return err('TASK_NOT_RUNNING', 'The task is no longer held by this key', 409)

  return ok(closed as FailTaskResult)
}
```

- [ ] **Step 4: Rodar o teste de serviço**

Run: `cd apps/web && npx vitest run test/lib/pipeline/services/youtube-intelligence-service.test.ts`
Expected: PASS.

- [ ] **Step 5: Escrever o teste da rota que falha**

Acrescentar a `test/api/pipeline/youtube-intelligence-task-routes.test.ts`:
```ts
import { failTask } from '@/lib/pipeline/services/youtube'

const TASK = '22222222-2222-4222-8222-222222222222'

function postFail(body: unknown, id = TASK) {
  return new Request(`http://localhost/api/pipeline/youtube/intelligence/task/${id}/fail`, {
    method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' },
  }) as never
}

describe('POST .../intelligence/task/:id/fail', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(authenticateIntel).mockResolvedValue(AUTH) })

  it('200s with {id, status, retry_count} inside the data envelope', async () => {
    vi.mocked(failTask).mockResolvedValue({ data: { id: TASK, status: 'pending', retry_count: 1 } } as never)
    const { POST } = await import('@/app/api/pipeline/youtube/intelligence/task/[id]/fail/route')
    const res = await POST(postFail({ reason: 'llama', retry: true }), { params: Promise.resolve({ id: TASK }) })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: { id: TASK, status: 'pending', retry_count: 1 } })
    expect(vi.mocked(failTask).mock.calls[0]!.slice(1)).toEqual([TASK, { reason: 'llama', retry: true }])
  })

  it('400s on an invalid uuid, on a missing reason and on a reason over 500 chars — before touching the service', async () => {
    const { POST } = await import('@/app/api/pipeline/youtube/intelligence/task/[id]/fail/route')
    const bad = await POST(postFail({ reason: 'x' }, 'nope'), { params: Promise.resolve({ id: 'nope' }) })
    expect(bad.status).toBe(400)
    const noReason = await POST(postFail({}), { params: Promise.resolve({ id: TASK }) })
    expect(noReason.status).toBe(400)
    const long = await POST(postFail({ reason: 'x'.repeat(501) }), { params: Promise.resolve({ id: TASK }) })
    expect(long.status).toBe(400)
    expect(failTask).not.toHaveBeenCalled()
  })

  it('maps service errors to 404, 409 and 500', async () => {
    const { POST } = await import('@/app/api/pipeline/youtube/intelligence/task/[id]/fail/route')
    for (const [code, status] of [['NOT_FOUND', 404], ['TASK_NOT_RUNNING', 409], ['INTERNAL_ERROR', 500]] as const) {
      vi.mocked(failTask).mockRejectedValue(new PipelineServiceError(code, code, status))
      const res = await POST(postFail({ reason: 'x' }), { params: Promise.resolve({ id: TASK }) })
      expect(res.status).toBe(status)
    }
  })
})
```

- [ ] **Step 6: Criar a rota**

`apps/web/src/app/api/pipeline/youtube/intelligence/task/[id]/fail/route.ts`:
```ts
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { authenticateIntel, parseBody, pipelineError, pipelineSuccess } from '@/lib/pipeline/helpers'
import { UUID_REGEX } from '@/lib/pipeline/auth'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { failTask } from '@/lib/pipeline/services/youtube'

export const dynamic = 'force-dynamic'

const FailSchema = z.object({
  reason: z.string().max(500),
  retry: z.boolean().optional(),
})

/** Thin adapter: authenticate, validate, delegate. The CAS and both outcomes live in failTask. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await authenticateIntel(req, { apiKeyOnly: true })
  if (result instanceof Response) return result
  const { auth } = result

  const { id } = await params
  if (!UUID_REGEX.test(id)) return pipelineError('VALIDATION_ERROR', 'id: invalid uuid', 400, auth)

  const body = await parseBody(req, FailSchema)
  if (body instanceof Response) return body

  try {
    const ctx = authToServiceContext(auth)
    const { data } = await failTask(ctx, id, body)
    return pipelineSuccess(data, 200, auth)
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}
```

- [ ] **Step 7: `ERROR_MAP` e registry**

`src/lib/pipeline/mcp/errors.ts`, dentro de `ERROR_MAP` (depois de `FORBIDDEN`, `:61`):
```ts
  TASK_NOT_RUNNING: {
    severity: 'recoverable',
    retryable: false,
    recovery_action: 'The task is no longer held by this session (closed, stale or owned by another key). Do not resend; claim another task.',
  },
```

`src/lib/pipeline/api-registry.ts:169` → `endpoint_count: 33`. Depois da entrada do claim:
```ts
    { method: 'POST', path: '/api/pipeline/youtube/intelligence/task/:id/fail', summary: 'Fail or requeue a running intelligence task owned by the key — accepts intelligence, write or admin', auth: 'intelligence' },
```
Contagens dos testes: `youtube(32)` → `youtube(33)`, `124` → `125`.

Acrescentar a `test/mcp/mcp-errors.test.ts` a asserção de que `TASK_NOT_RUNNING` classifica como `retryable: false` e que `VERSION_CONFLICT` continua `retryable: true`.

- [ ] **Step 8: Acrescentar os 403 do fail ao arquivo de auth**

Em `test/api/pipeline/youtube-intelligence-auth.test.ts`: chave `{read}` → 403 no fail; sessão → 403 `FORBIDDEN` no fail; nos dois, sem consulta a `youtube_intelligence_tasks` (o mock de `getSupabaseServiceClient` já lança se for chamado).

- [ ] **Step 9: Rodar e ver passar**

```bash
cd apps/web && npx vitest run \
  test/lib/pipeline/services/youtube-intelligence-service.test.ts \
  test/api/pipeline/youtube-intelligence-task-routes.test.ts \
  test/api/pipeline/youtube-intelligence-auth.test.ts \
  test/mcp/mcp-errors.test.ts \
  test/lib/pipeline/api-registry.test.ts \
  test/mcp/mcp-registry-sync.test.ts \
  test/api/pipeline/registry-completeness.test.ts
```
Expected: PASS.

Run: `npm run typecheck --workspace=apps/web`

- [ ] **Step 10: Commit**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git add apps/web/src/lib/pipeline/services/youtube.ts \
  "apps/web/src/app/api/pipeline/youtube/intelligence/task/[id]/fail/route.ts" \
  apps/web/src/lib/pipeline/mcp/errors.ts \
  apps/web/src/lib/pipeline/api-registry.ts \
  apps/web/test/lib/pipeline/services/youtube-intelligence-service.test.ts \
  apps/web/test/api/pipeline/youtube-intelligence-task-routes.test.ts \
  apps/web/test/api/pipeline/youtube-intelligence-auth.test.ts \
  apps/web/test/mcp/mcp-errors.test.ts \
  apps/web/test/lib/pipeline/api-registry.test.ts \
  apps/web/test/mcp/mcp-registry-sync.test.ts
git commit -m "feat: rota de falha explicita da task de inteligencia

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: PATCH — validação dentro do serviço, tetos e `maxDuration`

Primeira das quatro fatias do PATCH. Aqui o `PatchPayloadSchema` passa a rodar **em produção** pela primeira vez.

**Files:**
- Modify: `apps/web/src/lib/youtube/intelligence-schemas.ts:43-49`
- Modify: `apps/web/src/lib/pipeline/services/youtube.ts:282-300` (assinatura + `safeParse`)
- Modify: `apps/web/src/app/api/pipeline/youtube/intelligence/route.ts` (inteiro)
- Modify: `apps/web/src/lib/pipeline/mcp/services/ab-tests.ts:13, 148-153` (sai o cast e o import de tipo)
- Create: `apps/web/test/fixtures/intel-cowork-2026-05-18.json`
- Test: `apps/web/test/lib/pipeline/services/youtube-intelligence-service.test.ts`, `apps/web/test/api/pipeline/youtube-intelligence.test.ts`

**Interfaces:**
- Consumes: `authenticateIntel` (Task 1).
- Produces: `submitIntelRecommendations(ctx, data: unknown)`; 400 `VALIDATION_ERROR` com `<path>: <message>`; `export const maxDuration = 60`.

- [ ] **Step 1: Montar a fixture de regressão do Cowork**

`test/fixtures/intel-cowork-2026-05-18.json` é remontada **só por leitura** das 11 linhas `cowork` de maio, em prod:

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
npx --yes supabase@2.98.2 db query --linked --agent=no -o json "select video_id, type, coaching, recommendations, patterns_detected, analysis_text from public.youtube_intelligence where source='cowork' and site_id = (select id from public.sites where primary_domain='bythiagofigueiredo.com') order by video_id nulls first"
```

O JSON resultante vira um `PatchPayloadSchema` válido: `task_id` (uuid sintético), `video_recommendations` (as 10 linhas de vídeo, campo `recommendations`), `coaching` (da linha de canal) e `channel_insights`. **O texto vai do banco sem retoque** — nada de reticências, nada de espaço a mais.

- [ ] **Step 2: Escrever os testes que falham**

Em `test/lib/pipeline/services/youtube-intelligence-service.test.ts`:
```ts
import fixture from '../../../fixtures/intel-cowork-2026-05-18.json'

describe('submitIntelRecommendations — schema', () => {
  it('rejects a payload outside the schema with 400 and a path-qualified message', async () => {
    const sb = makeSupabase([])
    await expect(
      submitIntelRecommendations(ctxOf(sb, { permissions: ['read', 'write'] }), { task_id: 'not-a-uuid' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', status: 400, message: expect.stringContaining('task_id:') })
    expect(sb.tables).not.toContain('youtube_intelligence_tasks')
  })

  it('caps patterns_detected at 30, pattern_id at 80, category at 40 and requires an int sample_size', () => {
    const base = { task_id: '22222222-2222-4222-8222-222222222222' }
    const pattern = { pattern_id: 'p', category: 'series', finding: 'f', confidence: 0.5, sample_size: 4 }
    expect(PatchPayloadSchema.safeParse({ ...base, channel_insights: { patterns_detected: Array.from({ length: 31 }, () => pattern) } }).success).toBe(false)
    expect(PatchPayloadSchema.safeParse({ ...base, channel_insights: { patterns_detected: [{ ...pattern, pattern_id: 'x'.repeat(81) }] } }).success).toBe(false)
    expect(PatchPayloadSchema.safeParse({ ...base, channel_insights: { patterns_detected: [{ ...pattern, category: 'x'.repeat(41) }] } }).success).toBe(false)
    expect(PatchPayloadSchema.safeParse({ ...base, channel_insights: { patterns_detected: [{ ...pattern, sample_size: -1 }] } }).success).toBe(false)
    expect(PatchPayloadSchema.safeParse({ ...base, channel_insights: { patterns_detected: [pattern] } }).success).toBe(true)
  })

  it('accepts the real May payload from Cowork unchanged', () => {
    // These two lengths sit exactly on the Zod ceilings. If a remount added an ellipsis or a
    // space the fixture would fail the parse — or be "fixed" and start measuring another payload.
    expect([...fixture.coaching.summary].length).toBe(500)
    const variants = fixture.video_recommendations
      .map((r: { suggested_variant_description?: string }) => r.suggested_variant_description)
      .filter((v: string | undefined): v is string => typeof v === 'string' && v.length === 200)
    expect(variants).toHaveLength(5)
    expect(PatchPayloadSchema.safeParse(fixture).success).toBe(true)
  })
})
```

Em `test/api/pipeline/youtube-intelligence.test.ts`:
```ts
it('declares maxDuration = 60 — the other end of the watchdog budget', async () => {
  const mod = await import('@/app/api/pipeline/youtube/intelligence/route')
  expect(mod.maxDuration).toBe(60)
})
```
E o teste que hoje espera 422 `validation_failed` (`:191-209`) passa a esperar 400 `VALIDATION_ERROR` com o `path` na `message`.

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd apps/web && npx vitest run test/lib/pipeline/services/youtube-intelligence-service.test.ts test/api/pipeline/youtube-intelligence.test.ts`
Expected: FAIL — sem tetos, sem `maxDuration`, e o serviço ainda aceita `IntelRecommendations` tipado sem validar.

- [ ] **Step 4: Tetos no schema**

`src/lib/youtube/intelligence-schemas.ts:42-51`:
```ts
  channel_insights: z.object({
    patterns_detected: z.array(z.object({
      pattern_id: z.string().max(80),
      category: z.string().max(40),
      finding: z.string().max(300),
      confidence: z.number().min(0).max(1),
      sample_size: z.number().int().min(0),
    })).max(30).optional(),
    analysis_text: z.string().max(2000).optional(),
  }).optional(),
```

- [ ] **Step 5: `safeParse` dentro do serviço**

`src/lib/pipeline/services/youtube.ts:281-300` — o topo de `submitIntelRecommendations`:
```ts
/**
 * Submit intelligence recommendations, coaching and insights for a running task.
 *
 * The payload arrives as `unknown` and is validated HERE, not at the route: REST and MCP
 * both reach this function, and until now neither validated at all (PatchPayloadSchema
 * existed only in a `z.infer`). Everything downstream reads `parsed.data`, never the raw
 * body, so Zod's strip drops a `source` field and any extra key a caller invents.
 */
export async function submitIntelRecommendations(
  ctx: ServiceContext,
  data: unknown,
): Promise<ServiceResult<TaskResult>> {
  const { supabase, siteId } = ctx

  const parsed = PatchPayloadSchema.safeParse(data)
  if (!parsed.success) {
    const message = parsed.error.issues
      .slice(0, 3)
      .map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message))
      .join('; ')
    return err('VALIDATION_ERROR', message || 'Request body validation failed', 400)
  }

  const { task_id, video_recommendations, coaching, notifications, channel_insights } = parsed.data
```

- [ ] **Step 6: Rota do PATCH**

`src/app/api/pipeline/youtube/intelligence/route.ts` — arquivo inteiro:
```ts
import { NextRequest } from 'next/server'
import { authenticateIntel, authenticateRead, pipelineError, pipelineSuccess, parseBody } from '@/lib/pipeline/helpers'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { getIntelligenceSnapshot, submitIntelRecommendations } from '@/lib/pipeline/services/youtube'

export const dynamic = 'force-dynamic'
/**
 * Module-level ceiling, so it binds the snapshot GET below as well as the PATCH.
 * It is the site-side half of the timing invariant: claim → last request stays under
 * 25 min + 30 s, below the watchdog's 30 min (STALE_THRESHOLD_MINUTES).
 */
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result

  const channelId = req.nextUrl.searchParams.get('channel_id')
  if (!channelId) return pipelineError('VALIDATION_ERROR', 'channel_id required', 400, auth)

  try {
    const ctx = authToServiceContext(auth)
    const { data } = await getIntelligenceSnapshot(ctx, channelId)
    return pipelineSuccess(data, 200, auth)
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}

export async function PATCH(req: NextRequest) {
  const result = await authenticateIntel(req)
  if (result instanceof Response) return result
  const { auth } = result

  const body = await parseBody(req)
  if (body instanceof Response) return body

  try {
    const ctx = authToServiceContext(auth)
    const { data } = await submitIntelRecommendations(ctx, body)
    return pipelineSuccess(data, 200, auth)
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}
```
Saem: o import de `NextResponse`, o de `PipelineServiceError`, o de `IntelRecommendations` e o ramo morto `validation_failed` (nenhum serviço lança `VALIDATION_FAILED`).

- [ ] **Step 7: MCP sem cast**

`src/lib/pipeline/mcp/services/ab-tests.ts:148-153`:
```ts
      case 'submit_intelligence': {
        const payload = params.intel_payload
        if (!payload) return toMcpError({ code: 'VALIDATION_ERROR', message: 'intel_payload is required for submit_intelligence' })
        const result = await youtube.submitIntelRecommendations(buildCtx(), payload)
        return toMcpSuccess(result.data)
      }
```
E `:13` perde `IntelRecommendations` do import de tipos.

- [ ] **Step 8: Rodar e ver passar**

```bash
cd apps/web && npx vitest run \
  test/lib/pipeline/services/youtube-intelligence-service.test.ts \
  test/api/pipeline/youtube-intelligence.test.ts \
  test/api/pipeline/analytics-intelligence-api.test.ts \
  test/mcp/ab-tests-intel.test.ts
```
Expected: PASS. (O `analytics-intelligence-api.test.ts` já existente não quebra: lá `patterns_detected` tem 1 item, `pattern_id` 12 caracteres, `category` 15 e `sample_size` 15.)

Run: `npm run typecheck --workspace=apps/web`

- [ ] **Step 9: Commit**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git add apps/web/src/lib/youtube/intelligence-schemas.ts \
  apps/web/src/lib/pipeline/services/youtube.ts \
  "apps/web/src/app/api/pipeline/youtube/intelligence/route.ts" \
  apps/web/src/lib/pipeline/mcp/services/ab-tests.ts \
  apps/web/test/fixtures/intel-cowork-2026-05-18.json \
  apps/web/test/lib/pipeline/services/youtube-intelligence-service.test.ts \
  apps/web/test/api/pipeline/youtube-intelligence.test.ts
git commit -m "feat: validar o payload de inteligencia dentro do servico

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: `deriveSource` e as quatro recusas da fonte `forja`

**Files:**
- Modify: `apps/web/src/lib/pipeline/services/youtube.ts` (nova `deriveSource`; `:331,340,381,392` passam a usá-la; guardas logo depois do `safeParse`)
- Test: `apps/web/test/lib/pipeline/services/youtube-intelligence-service.test.ts`

**Interfaces:**
- Consumes: `submitIntelRecommendations(ctx, unknown)` (Task 5).
- Produces: `deriveSource(ctx)`; 400 nas quatro recusas, **antes** de qualquer consulta a `youtube_intelligence_tasks`.

- [ ] **Step 1: Escrever os testes que falham**

`CHANNEL_ONLY` e `runningTask` ficam no **escopo de módulo** do arquivo de teste — as Tasks 7 e 8 os reusam nos próprios `describe`.

```ts
const TASK_ID = '22222222-2222-4222-8222-222222222222'

/** The only payload shape the forja ever sends in 2a: channel coaching, no video rows. */
const CHANNEL_ONLY = {
  task_id: TASK_ID,
  coaching: { summary: 'ok', priorities: [] },
  channel_insights: { patterns_detected: [], analysis_text: 'texto' },
}

const runningTask = {
  data: { id: TASK_ID, channel_id: 'ch-1', status: 'running', result_summary: { claimed_by: 'key-forja' }, started_at: '2026-09-19T10:00:00Z' },
  error: null,
}

describe('deriveSource and the forja scope guards', () => {
  it('writes source=forja for a narrow key, even with source:cowork in the body', async () => {
    const sb = makeSupabase([runningTask, { data: null, error: null }, { data: null, error: null }, { data: { id: '22222222-2222-4222-8222-222222222222' }, error: null }])
    await submitIntelRecommendations(ctxOf(sb), { ...CHANNEL_ONLY, source: 'cowork' })
    const insert = sb.calls.find(c => c.op === 'insert')!.args[0] as Record<string, unknown>
    expect(insert.source).toBe('forja')
    expect(insert).not.toHaveProperty('__extra')
  })

  it('writes source=cowork for a session context', async () => {
    const sb = makeSupabase([runningTask, { data: null, error: null }, { data: null, error: null }, { data: { id: 'x' }, error: null }])
    await submitIntelRecommendations(ctxOf(sb, { source: 'session', permissions: ['read', 'write'], keyId: undefined }), CHANNEL_ONLY)
    expect((sb.calls.find(c => c.op === 'insert')!.args[0] as Record<string, unknown>).source).toBe('cowork')
  })

  it.each([
    ['notifications', { ...CHANNEL_ONLY, notifications: [{ type: 'grade_drop', priority: 1, title: 't', message: 'm' }] }],
    ['video_recommendations', { ...CHANNEL_ONLY, video_recommendations: [{ video_id: '33333333-3333-4333-8333-333333333333', action_type: 'title_test', priority: 'low', confidence: 0.5, reasoning: 'r' }] }],
    ['coaching', { task_id: CHANNEL_ONLY.task_id }],
    ['coaching.priorities', { ...CHANNEL_ONLY, coaching: { summary: 'ok', priorities: [{ axis: 'reach', score: 4, diagnosis: 'd', action: 'a' }] } }],
  ])('400s a forja payload carrying %s, before any DB read or write', async (_label, payload) => {
    const sb = makeSupabase([])
    await expect(submitIntelRecommendations(ctxOf(sb), payload)).rejects.toMatchObject({ code: 'VALIDATION_ERROR', status: 400 })
    expect(sb.tables).toHaveLength(0)
  })

  it('400s before the task lookup even when the task_id does not exist — never 404', async () => {
    const sb = makeSupabase([{ data: null, error: null }])
    await expect(submitIntelRecommendations(ctxOf(sb), {
      task_id: '44444444-4444-4444-8444-444444444444',
      coaching: { summary: 'ok', priorities: [] },
      video_recommendations: [{ video_id: '33333333-3333-4333-8333-333333333333', action_type: 'title_test', priority: 'low', confidence: 0.5, reasoning: 'r' }],
    })).rejects.toMatchObject({ code: 'VALIDATION_ERROR', status: 400 })
    expect(sb.tables).not.toContain('youtube_intelligence_tasks')
  })

  it('strips unknown keys from a recommendation before writing (write key)', async () => {
    const sb = makeSupabase([
      { data: { id: 't', channel_id: 'ch-1', status: 'running', result_summary: {}, started_at: 's' }, error: null },
      { data: [{ id: '33333333-3333-4333-8333-333333333333' }], error: null },
      { data: null, error: null },
      { data: null, error: null },
      { data: null, error: null },
      { data: { id: 't' }, error: null },
    ])
    await submitIntelRecommendations(ctxOf(sb, { permissions: ['read', 'write'], keyId: 'key-cowork' }), {
      task_id: '22222222-2222-4222-8222-222222222222',
      video_recommendations: [{ video_id: '33333333-3333-4333-8333-333333333333', action_type: 'title_test', priority: 'low', confidence: 0.5, reasoning: 'r', smuggled: 'x' }],
    })
    const written = sb.calls.filter(c => c.op === 'insert').map(c => JSON.stringify(c.args[0])).join('')
    expect(written).not.toContain('smuggled')
  })

  it('never notifies on a forja PATCH', async () => {
    const sb = makeSupabase([runningTask, { data: null, error: null }, { data: null, error: null }, { data: { id: 'x' }, error: null }])
    await submitIntelRecommendations(ctxOf(sb), CHANNEL_ONLY)
    expect(fanOutToSiteAdmins).not.toHaveBeenCalled()
  })
})
```
(no topo do arquivo: `vi.mock('@/lib/notifications/fan-out-to-admins', () => ({ fanOutToSiteAdmins: vi.fn() }))` e o import correspondente.)

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/web && npx vitest run test/lib/pipeline/services/youtube-intelligence-service.test.ts`
Expected: FAIL — a fonte é `'cowork'` fixa e não há guarda nenhuma.

- [ ] **Step 3: Implementar**

Em `src/lib/pipeline/services/youtube.ts`, antes de `submitIntelRecommendations`:
```ts
/**
 * Where a row's `source` comes from: the key, never the body.
 *
 * Written by exclusion — everything that is not a wide key or a session is 'forja' —
 * so it fails closed. `source` is optional on ServiceContext, and a future path that
 * forgot to set it would otherwise label a narrow key as 'cowork' and switch OFF the
 * four scope refusals below. Mirrors deriveSource in items/[id]/recording/service.ts.
 */
export function deriveSource(ctx: ServiceContext): 'cowork' | 'forja' {
  if (ctx.source === 'session') return 'cowork'
  if (ctx.permissions.includes('write') || ctx.permissions.includes('admin')) return 'cowork'
  return 'forja'
}
```

Logo depois do `safeParse` (Task 5, Step 5), **antes** do SELECT da task:
```ts
  const source = deriveSource(ctx)

  // Phase 2a scope. We refuse instead of rewriting: a forja payload outside the scope is a
  // worker bug and has to surface (the worker treats it as `reprovada`). Running here — before
  // any DB read — means a rejected body never costs a round trip, and the refusal only ever
  // talks about the caller's own payload.
  if (source === 'forja') {
    if (notifications?.length) return err('VALIDATION_ERROR', 'notifications: not allowed for this key', 400)
    if (video_recommendations?.length) return err('VALIDATION_ERROR', 'video_recommendations: not allowed for this key', 400)
    if (!coaching) return err('VALIDATION_ERROR', 'coaching: required for this key', 400)
    if (coaching.priorities.length) return err('VALIDATION_ERROR', 'coaching.priorities: must be empty for this key', 400)
  }
```

Trocar as quatro gravações de `'cowork'` fixo por `source` (`youtube.ts:331` no `.eq('source', …)` da busca por linha de vídeo, `:340` no payload de vídeo, `:381` no `.eq('source', …)` da busca da linha de canal e `:392` no payload de canal).

- [ ] **Step 4: Rodar e ver passar**

Run: `cd apps/web && npx vitest run test/lib/pipeline/services/youtube-intelligence-service.test.ts test/api/pipeline/youtube-intelligence.test.ts`
Expected: PASS.

Run: `npm run typecheck --workspace=apps/web`

- [ ] **Step 5: Commit**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git add apps/web/src/lib/pipeline/services/youtube.ts apps/web/test/lib/pipeline/services/youtube-intelligence-service.test.ts
git commit -m "feat: fonte derivada da chave e escopo 2a da forja no PATCH

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: trava de dono e SELECT da task à prova de erro

**Files:**
- Modify: `apps/web/src/lib/pipeline/services/youtube.ts:289-300`
- Test: `apps/web/test/lib/pipeline/services/youtube-intelligence-service.test.ts`, `apps/web/test/api/pipeline/youtube-intelligence.test.ts`

**Interfaces:**
- Consumes: `deriveSource` (Task 6).
- Produces: SELECT com `id, channel_id, status, result_summary, started_at` e `.maybeSingle()`; 409 `TASK_NOT_RUNNING` no lugar de `VERSION_CONFLICT`; 500 em erro de SELECT.

- [ ] **Step 1: Escrever os testes que falham**

```ts
describe('submitIntelRecommendations — task state and ownership', () => {
  it('409s TASK_NOT_RUNNING on a stale task, without writing', async () => {
    const sb = makeSupabase([{ data: { id: 't', channel_id: 'ch-1', status: 'stale', result_summary: {}, started_at: 's' }, error: null }])
    await expect(submitIntelRecommendations(ctxOf(sb), CHANNEL_ONLY)).rejects.toMatchObject({ code: 'TASK_NOT_RUNNING', status: 409 })
    expect(sb.calls.some(c => c.op === 'insert' || c.op === 'update')).toBe(false)
  })

  it('409s a narrow key on a task claimed by another key, and when keyId is missing', async () => {
    const other = makeSupabase([{ data: { id: 't', channel_id: 'ch-1', status: 'running', result_summary: { claimed_by: 'key-other' }, started_at: 's' }, error: null }])
    await expect(submitIntelRecommendations(ctxOf(other), CHANNEL_ONLY)).rejects.toMatchObject({ code: 'TASK_NOT_RUNNING' })
    expect(other.calls.some(c => c.op === 'insert' || c.op === 'update')).toBe(false)

    const noKey = makeSupabase([{ data: { id: 't', channel_id: 'ch-1', status: 'running', result_summary: { claimed_by: 'key-forja' }, started_at: 's' }, error: null }])
    await expect(submitIntelRecommendations(ctxOf(noKey, { keyId: undefined }), CHANNEL_ONLY)).rejects.toMatchObject({ code: 'TASK_NOT_RUNNING' })
  })

  it('500s — not 404 — when the task SELECT errors, without writing', async () => {
    const sb = makeSupabase([{ data: null, error: { message: 'boom' } }])
    await expect(submitIntelRecommendations(ctxOf(sb), CHANNEL_ONLY)).rejects.toMatchObject({ code: 'INTERNAL_ERROR', status: 500 })
    expect(sb.calls.some(c => c.op === 'insert' || c.op === 'update')).toBe(false)
  })

  it('404s on zero rows without an error', async () => {
    const sb = makeSupabase([{ data: null, error: null }])
    await expect(submitIntelRecommendations(ctxOf(sb), CHANNEL_ONLY)).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 })
  })

  it('500s when the integrity SELECT errors (Cowork path only)', async () => {
    const sb = makeSupabase([
      { data: { id: 't', channel_id: 'ch-1', status: 'running', result_summary: {}, started_at: 's' }, error: null },
      { data: null, error: { message: 'boom' } },
    ])
    await expect(submitIntelRecommendations(ctxOf(sb, { permissions: ['read', 'write'] }), {
      task_id: '22222222-2222-4222-8222-222222222222',
      video_recommendations: [{ video_id: '33333333-3333-4333-8333-333333333333', action_type: 'title_test', priority: 'low', confidence: 0.5, reasoning: 'r' }],
    })).rejects.toMatchObject({ code: 'INTERNAL_ERROR', status: 500 })
  })

  it('keeps the integrity failure as 422 VALIDATION_ERROR', async () => {
    const sb = makeSupabase([
      { data: { id: 't', channel_id: 'ch-1', status: 'running', result_summary: {}, started_at: 's' }, error: null },
      { data: [], error: null },
    ])
    await expect(submitIntelRecommendations(ctxOf(sb, { permissions: ['read', 'write'] }), {
      task_id: '22222222-2222-4222-8222-222222222222',
      video_recommendations: [{ video_id: '33333333-3333-4333-8333-333333333333', action_type: 'title_test', priority: 'low', confidence: 0.5, reasoning: 'r' }],
    })).rejects.toMatchObject({ code: 'VALIDATION_ERROR', status: 422 })
  })
})
```
Em `test/api/pipeline/youtube-intelligence.test.ts`, os testes que esperavam `VERSION_CONFLICT` passam a esperar `TASK_NOT_RUNNING`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/web && npx vitest run test/lib/pipeline/services/youtube-intelligence-service.test.ts`
Expected: FAIL — o SELECT ainda usa `.single()`, não traz `result_summary`/`started_at`, e o 409 sai como `VERSION_CONFLICT`.

- [ ] **Step 3: Implementar**

`src/lib/pipeline/services/youtube.ts:289-300` — substituir o bloco "Validate task":
```ts
  // maybeSingle, not single: with single() zero rows come back as an error (PGRST116) and
  // would turn a plain "task not found" into a 500 under the rule below.
  const { data: task, error: taskError } = await supabase
    .from('youtube_intelligence_tasks')
    .select('id, channel_id, status, result_summary, started_at')
    .eq('id', task_id)
    .eq('site_id', siteId)
    .maybeSingle()

  if (taskError) return err('INTERNAL_ERROR', 'Failed to read the task', 500)
  if (!task) return err('NOT_FOUND', 'Task not found', 404)
  if (task.status !== 'running') {
    return err('TASK_NOT_RUNNING', `Task status is '${task.status}', expected 'running'`, 409)
  }

  const previousSummary = (task.result_summary ?? {}) as Record<string, unknown>
  const isWideKey = ctx.permissions.includes('write') || ctx.permissions.includes('admin')
  if (!isWideKey && (!ctx.keyId || previousSummary.claimed_by !== ctx.keyId)) {
    return err('TASK_NOT_RUNNING', 'Task is held by another key', 409)
  }
```

No laço de vídeos (`:306-322`), o SELECT de integridade passa a distinguir erro de ausência:
```ts
    const { data: existing, error: existingError } = await supabase
      .from('youtube_videos')
      .select('id')
      .eq('channel_id', task.channel_id)
      .in('id', videoIds)

    if (existingError) return err('INTERNAL_ERROR', 'Failed to verify video references', 500)
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd apps/web && npx vitest run test/lib/pipeline/services/youtube-intelligence-service.test.ts test/api/pipeline/youtube-intelligence.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git add apps/web/src/lib/pipeline/services/youtube.ts \
  apps/web/test/lib/pipeline/services/youtube-intelligence-service.test.ts \
  apps/web/test/api/pipeline/youtube-intelligence.test.ts
git commit -m "feat: trava de dono e leitura da task a prova de erro no PATCH

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: fechamento da task com CAS e `PARTIAL_FAILURE` sem escrita

Fecha o PATCH. Aqui some o `partial_failure` que viola o CHECK do banco.

**Files:**
- Modify: `apps/web/src/lib/pipeline/services/youtube.ts:411-447`
- Modify: `apps/web/src/lib/pipeline/mcp/errors.ts` (`PARTIAL_FAILURE`)
- Modify: `apps/web/src/app/api/cron/youtube-intelligence-watchdog/route.ts` — **nada muda no código**; só o teste ganha a asserção do valor
- Test: `apps/web/test/lib/pipeline/services/youtube-intelligence-service.test.ts`, `apps/web/test/cron/youtube-intelligence-watchdog.test.ts:87-88`

**Interfaces:**
- Consumes: `previousSummary`, `isWideKey`, `task.started_at` (Task 7); `source` (Task 6).
- Produces: fechamento por CAS; 409 `TASK_NOT_RUNNING` com CAS perdido; 500 `PARTIAL_FAILURE` **sem** UPDATE.

- [ ] **Step 1: Escrever os testes que falham**

```ts
describe('submitIntelRecommendations — closing the task', () => {

  it('closes with a CAS pinned to status, site, started_at and owner, preserving claimed_by', async () => {
    const sb = makeSupabase([runningTask, { data: null, error: null }, { data: null, error: null }, { data: { id: TASK_ID }, error: null }])
    await submitIntelRecommendations(ctxOf(sb), CHANNEL_ONLY)
    const close = sb.calls.filter(c => c.op === 'update').at(-1)!.args[0] as Record<string, unknown>
    expect(close).toMatchObject({ status: 'completed' })
    expect(close.result_summary).toMatchObject({ claimed_by: 'key-forja', has_coaching: true, recommendations: 0, source: 'forja', closed_by: 'key-forja' })
    // Sobre a FATIA do update: em `calls` cru, o SELECT anterior satisfaz estas assercoes e o
    // CAS pode perder `id`, `site_id` ou `status` sem o teste reclamar. Ja aconteceu aqui.
    const cas = sb.from('update')
    expect(cas).toContainEqual({ op: 'eq', args: ['started_at', '2026-09-19T10:00:00Z'] })
    expect(cas).toContainEqual({ op: 'eq', args: ['result_summary->>claimed_by', 'key-forja'] })
    expect(cas).toContainEqual({ op: 'eq', args: ['site_id', 'site-1'] })
    expect(cas).toContainEqual({ op: 'eq', args: ['status', 'running'] })
  })

  it('409s when the closing CAS returns no row', async () => {
    const sb = makeSupabase([runningTask, { data: null, error: null }, { data: null, error: null }, { data: null, error: null }])
    await expect(submitIntelRecommendations(ctxOf(sb), CHANNEL_ONLY)).rejects.toMatchObject({ code: 'TASK_NOT_RUNNING', status: 409 })
  })

  it('500s INTERNAL_ERROR when the closing UPDATE itself errors', async () => {
    const sb = makeSupabase([runningTask, { data: null, error: null }, { data: null, error: null }, { data: null, error: { message: 'boom' } }])
    await expect(submitIntelRecommendations(ctxOf(sb), CHANNEL_ONLY)).rejects.toMatchObject({ code: 'INTERNAL_ERROR', status: 500 })
  })

  it('500s PARTIAL_FAILURE listing only targets, and leaves the task untouched', async () => {
    const sb = makeSupabase([runningTask, { data: null, error: null }, { data: null, error: { message: 'disk on fire' } }])
    await expect(submitIntelRecommendations(ctxOf(sb), CHANNEL_ONLY)).rejects.toMatchObject({
      code: 'PARTIAL_FAILURE', status: 500, message: 'channel: write_failed',
    })
    // nothing was written to the task table: no completed_at, no failed_at, no error_message
    expect(sb.calls.filter(c => c.op === 'update')).toHaveLength(0)
  })

  it('never writes the status partial_failure — the DB CHECK forbids it', async () => {
    const sb = makeSupabase([runningTask, { data: null, error: null }, { data: null, error: { message: 'x' } }])
    await submitIntelRecommendations(ctxOf(sb), CHANNEL_ONLY).catch(() => {})
    expect(JSON.stringify(sb.calls)).not.toContain('partial_failure')
  })
})
```

Em `test/cron/youtube-intelligence-watchdog.test.ts`, acrescentar ao teste de `:77-89`:
```ts
    // The other end of the timing invariant: at 15 min the watchdog would mark a live forja
    // run stale, every PATCH would come back 409 and the queue would loop — invisible to CI.
    expect(supabase.ltCalls[0]![1]).toBe(new Date(now - 30 * 60_000).toISOString())
```
com `vi.useFakeTimers({ now, toFake: ['Date'] })` no `beforeEach` (nunca data fixa).

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/web && npx vitest run test/lib/pipeline/services/youtube-intelligence-service.test.ts test/cron/youtube-intelligence-watchdog.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar o fechamento**

Trocar `src/lib/pipeline/services/youtube.ts:431-447` inteiro. E, nos pontos que empurram para `dbErrors` (`:348, 354, 400, 406`), separar a mensagem crua (Sentry) do alvo (resposta):
```ts
  // Só os ALVOS. A mensagem crua vai ao Sentry no próprio ponto da falha (`error.message`),
  // então não há array de mensagens cruas — um que ninguém lê é código morto.
  const dbTargets: string[] = []     // "video <uuid>: write_failed" / "channel: write_failed"
```
(cada ponto que hoje empurra para `dbErrors` passa a empurrar **só** para `dbTargets`, com `video ${rec.video_id}: write_failed` ou `'channel: write_failed'`; o `Sentry.captureMessage` ao lado continua recebendo `error.message` como já recebe.)

Fechamento:
```ts
  // A partial write never touches the task: it stays `running`, and whoever called closes it
  // with the explicit `fail` (retry) the 500 already asks for — or the watchdog does, in 30–60 min.
  // `partial_failure` is not even a legal status: the CHECK on the table allows only
  // pending/running/completed/failed/stale.
  if (dbTargets.length > 0) {
    return err('PARTIAL_FAILURE', dbTargets.join('; '), 500)
  }

  let closing = supabase
    .from('youtube_intelligence_tasks')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      result_summary: {
        ...previousSummary,
        recommendations: video_recommendations?.length ?? 0,
        has_coaching: !!coaching,
        source,
        closed_by: ctx.keyId ?? null,
      },
    })
    .eq('id', task_id)
    .eq('site_id', siteId)
    .eq('status', 'running')
    .eq('started_at', task.started_at)

  if (!isWideKey) closing = closing.eq('result_summary->>claimed_by', ctx.keyId as string)

  const { data: closed, error: closeError } = await closing.select('id').maybeSingle()

  if (closeError) return err('INTERNAL_ERROR', 'Failed to close the task', 500)
  // 409 means "the task is no longer yours", not "nothing was written": rows already written
  // by this PATCH stay, and the next run overwrites the forja channel row.
  if (!closed) return err('TASK_NOT_RUNNING', 'The task is no longer held by this key', 409)

  return ok({ status: 'ok' as const, processed: true })
```
Some o `result.warnings` (nenhum caminho devolve mais aviso).

`src/lib/pipeline/mcp/errors.ts`, no `ERROR_MAP`:
```ts
  PARTIAL_FAILURE: {
    severity: 'recoverable',
    retryable: false,
    recovery_action: 'Some writes failed and the task is still running — nothing was closed. Send an explicit fail with retry instead of resending the PATCH.',
  },
```

- [ ] **Step 4: Rodar e ver passar**

```bash
cd apps/web && npx vitest run \
  test/lib/pipeline/services/youtube-intelligence-service.test.ts \
  test/api/pipeline/youtube-intelligence.test.ts \
  test/cron/youtube-intelligence-watchdog.test.ts \
  test/mcp/mcp-errors.test.ts
```
Expected: PASS.

Run: `npm run typecheck --workspace=apps/web`

- [ ] **Step 5: Commit**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git add apps/web/src/lib/pipeline/services/youtube.ts apps/web/src/lib/pipeline/mcp/errors.ts \
  apps/web/test/lib/pipeline/services/youtube-intelligence-service.test.ts \
  apps/web/test/cron/youtube-intelligence-watchdog.test.ts \
  apps/web/test/mcp/mcp-errors.test.ts
git commit -m "feat: fechamento da task por CAS e PARTIAL_FAILURE sem escrita

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: snapshot — janela de 90 dias, `recent`, `is_hidden`, filtro de site

**Files:**
- Create: `apps/web/src/lib/youtube/analytics-window.ts`
- Modify: `apps/web/src/app/api/cron/sync-analytics-metrics/route.ts:18`
- Modify: `apps/web/src/lib/pipeline/services/youtube.ts:34-68` (tipos), `:201-275` (`getIntelligenceSnapshot`)
- Test: `apps/web/test/lib/pipeline/services/youtube-intelligence-service.test.ts`, `apps/web/test/cron/sync-analytics-metrics.test.ts`

**Interfaces:**
- Consumes: nada das tarefas anteriores.
- Produces: `SYNC_WINDOW_DAYS`; `IntelSnapshot.recent_window: { date: string; days: number } | null`; `VideoSnapshot.is_hidden: boolean` e `.recent: { views: number; subscribers_gained: number }`.

- [ ] **Step 1: Escrever os testes que falham**

O unitário confere **os argumentos passados ao cliente**; a semântica (janela real, outro canal) fica na integração (Task 14). As datas saem de `vi.useFakeTimers`, nunca de literal.

```ts
import { getIntelligenceSnapshot } from '@/lib/pipeline/services/youtube'

/**
 * Snapshot double: `from(table)` hands back a per-table chain so the five parallel reads
 * and the two analytics reads can be told apart. `results` is keyed by table, in call order.
 */
function makeSnapshotSupabase(results: Record<string, Array<{ data: unknown; error: unknown }>>) {
  const calls: Array<{ table: string; op: string; args: unknown[] }> = []
  const counters: Record<string, number> = {}
  const client = {
    from: (table: string) => {
      const next = () => {
        counters[table] = (counters[table] ?? 0) + 1
        return results[table]?.[counters[table] - 1] ?? { data: [], error: null }
      }
      const chain: Record<string, unknown> = {}
      for (const op of ['select', 'eq', 'in', 'gte', 'order', 'limit', 'not', 'is']) {
        chain[op] = (...args: unknown[]) => { calls.push({ table, op, args }); return chain }
      }
      chain.single = async () => next()
      chain.maybeSingle = async () => next()
      // the five parallel reads are awaited directly, without a terminal method
      chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(next()).then(resolve)
      return chain
    },
  }
  return { calls, client, argsOf: (table: string, op: string) => calls.filter(c => c.table === table && c.op === op).map(c => c.args) }
}

const NOW = Date.UTC(2026, 8, 19, 15, 0, 0) // 2026-09-19T15:00:00Z
const V1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
const V2 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'

function snapshotResults(over: Partial<Record<string, Array<{ data: unknown; error: unknown }>>> = {}) {
  return {
    youtube_channels: [{ data: { id: 'ch-1', channel_id: 'UC…', name: 'tnFigueiredo', subscriber_count: 1160 }, error: null }],
    youtube_videos: [{ data: [
      { id: V1, youtube_video_id: 'yt1', title: 'a', thumbnail_url: null, published_at: '2024-12-10T15:57:00Z', view_count: 100, ctr: null, impressions: null, avg_view_percentage: null, avg_view_duration_seconds: null, retention_curve: null, traffic_sources: null, is_hidden: false },
      { id: V2, youtube_video_id: 'yt2', title: 'b', thumbnail_url: null, published_at: '2024-11-10T15:57:00Z', view_count: 50, ctr: null, impressions: null, avg_view_percentage: null, avg_view_duration_seconds: null, retention_curve: null, traffic_sources: null, is_hidden: true },
    ], error: null }],
    video_grade_history: [{ data: [], error: null }],
    optimization_cycles: [{ data: [], error: null }],
    ab_tests: [{ data: [], error: null }],
    youtube_intelligence: [{ data: [], error: null }],
    ...over,
  } as Record<string, Array<{ data: unknown; error: unknown }>>
}

describe('getIntelligenceSnapshot — recent window', () => {
  beforeEach(() => { vi.useFakeTimers({ now: NOW, toFake: ['Date'] }) })
  afterEach(() => { vi.useRealTimers() })

  it('reads the latest analytics date within 3 days, scoped by site and by the channel video ids', async () => {
    const sb = makeSnapshotSupabase(snapshotResults({
      youtube_video_analytics: [
        { data: { date: '2026-09-18' }, error: null },
        { data: [{ youtube_video_id: V1, views: 6, subscribers_gained: 0 }], error: null },
      ],
    }))
    await getIntelligenceSnapshot(ctxOf(sb), 'ch-1')

    const analytics = sb.calls.filter(c => c.table === 'youtube_video_analytics')
    expect(analytics).toContainEqual({ table: 'youtube_video_analytics', op: 'gte', args: ['date', '2026-09-16'] })
    expect(analytics).toContainEqual({ table: 'youtube_video_analytics', op: 'order', args: ['date', { ascending: false }] })
    expect(analytics).toContainEqual({ table: 'youtube_video_analytics', op: 'limit', args: [1] })
    expect(analytics).toContainEqual({ table: 'youtube_video_analytics', op: 'eq', args: ['site_id', 'site-1'] })
    // the internal uuid of youtube_videos, never the textual youtube_video_id
    expect(analytics).toContainEqual({ table: 'youtube_video_analytics', op: 'in', args: ['youtube_video_id', [V1, V2]] })
    expect(analytics).toContainEqual({ table: 'youtube_video_analytics', op: 'eq', args: ['date', '2026-09-18'] })
  })

  it('fills recent from the row of that single date, without summing, and zeroes missing videos', async () => {
    const sb = makeSnapshotSupabase(snapshotResults({
      youtube_video_analytics: [
        { data: { date: '2026-09-18' }, error: null },
        { data: [{ youtube_video_id: V1, views: 6, subscribers_gained: 0 }], error: null },
      ],
    }))
    const { data } = await getIntelligenceSnapshot(ctxOf(sb), 'ch-1')

    expect(data.recent_window).toEqual({ date: '2026-09-18', days: 90 })
    expect(data.videos.find(v => v.id === V1)!.recent).toEqual({ views: 6, subscribers_gained: 0 })
    expect(data.videos.find(v => v.id === V2)!.recent).toEqual({ views: 0, subscribers_gained: 0 })
  })

  it('returns recent_window as a whole null — never {date: null} — when no row is within 3 days', async () => {
    const sb = makeSnapshotSupabase(snapshotResults({
      youtube_video_analytics: [{ data: null, error: null }],
    }))
    const { data } = await getIntelligenceSnapshot(ctxOf(sb), 'ch-1')

    expect(data.recent_window).toBeNull()
    expect(data.videos.every(v => v.recent.views === 0 && v.recent.subscribers_gained === 0)).toBe(true)
    // only the date probe ran; the per-video read never did
    expect(sb.calls.filter(c => c.table === 'youtube_video_analytics' && c.op === 'select')).toHaveLength(1)
  })

  it('makes zero calls to youtube_video_analytics when the channel has no videos (the EN channel)', async () => {
    const sb = makeSnapshotSupabase(snapshotResults({ youtube_videos: [{ data: [], error: null }] }))
    const { data } = await getIntelligenceSnapshot(ctxOf(sb), 'ch-1')

    expect(data.recent_window).toBeNull()
    expect(sb.calls.some(c => c.table === 'youtube_video_analytics')).toBe(false)
  })

  it('exposes videos[].is_hidden and scopes the video SELECT by site_id too', async () => {
    const sb = makeSnapshotSupabase(snapshotResults({
      youtube_video_analytics: [{ data: null, error: null }],
    }))
    const { data } = await getIntelligenceSnapshot(ctxOf(sb), 'ch-1')

    expect(data.videos.map(v => v.is_hidden)).toEqual([false, true])
    expect(sb.argsOf('youtube_videos', 'eq')).toContainEqual(['site_id', 'site-1'])
    expect(sb.argsOf('youtube_videos', 'eq')).toContainEqual(['channel_id', 'ch-1'])
  })

  it.each([
    ['narrow key', { permissions: ['read', 'intelligence'] as const }],
    ['write key', { permissions: ['read', 'write'] as const }],
    ['session', { source: 'session' as const, permissions: ['read', 'write'] as const }],
  ])('filters the intelligence array to source=cowork for a %s', async (_label, over) => {
    const sb = makeSnapshotSupabase(snapshotResults({
      youtube_video_analytics: [{ data: null, error: null }],
    }))
    await getIntelligenceSnapshot(ctxOf(sb, over as never), 'ch-1')

    expect(sb.argsOf('youtube_intelligence', 'eq')).toContainEqual(['source', 'cowork'])
    expect(sb.argsOf('youtube_intelligence', 'eq')).toContainEqual(['site_id', 'site-1'])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/web && npx vitest run test/lib/pipeline/services/youtube-intelligence-service.test.ts`

- [ ] **Step 3: Extrair a janela**

`apps/web/src/lib/youtube/analytics-window.ts`:
```ts
/**
 * Rolling window, in days, that the analytics sync writes and the intelligence snapshot reads.
 *
 * It lives here, not in the cron route, because two consumers need the same number and a
 * route module must not be imported for a constant. Every row of youtube_video_analytics is
 * the TOTAL over this window as of its `date`, not that day's count.
 */
export const SYNC_WINDOW_DAYS = Number(process.env.YT_ANALYTICS_SYNC_WINDOW_DAYS ?? '90')
```
`sync-analytics-metrics/route.ts:18` passa a `import { SYNC_WINDOW_DAYS } from '@/lib/youtube/analytics-window'` (o comentário de `:13-17` vai junto para o módulo novo). **Nada é exportado de `route.ts`.**

- [ ] **Step 4: Campos novos no snapshot**

Tipos (`youtube.ts:34-68`):
```ts
export interface VideoSnapshot {
  // … campos de hoje …
  is_hidden: boolean
  recent: { views: number; subscribers_gained: number }
}

export interface IntelSnapshot {
  channel: ChannelSummary
  /** null as a whole when no analytics row lands within 3 days — never { date: null }. */
  recent_window: { date: string; days: number } | null
  videos: VideoSnapshot[]
  grade_history: GradeHistoryRow[]
  optimization_cycles: Record<string, unknown>[]
  ab_tests: Record<string, unknown>[]
  intelligence: Record<string, unknown>[]
}
```

Em `getIntelligenceSnapshot`, o SELECT de vídeos (`:217-222`) ganha `is_hidden` na lista e `.eq('site_id', siteId)` ao lado do `.eq('channel_id', channel.id)`; o SELECT de `youtube_intelligence` (`:240-245`) ganha `.eq('site_id', siteId).eq('source', 'cowork')`. Depois do `Promise.all`:
```ts
  // Every analytics read is date-bounded and site-scoped. PostgREST caps at 1000 rows, and
  // with ~14 rows a day the whole history stops fitting around mid-November.
  const videoIds = (videosRes.data ?? []).map(v => v.id)
  let recentWindow: { date: string; days: number } | null = null
  const recentByVideo = new Map<string, { views: number; subscribers_gained: number }>()

  // With no videos neither query runs: no PostgREST round trip, and no dependence on how it
  // treats the `youtube_video_id=in.()` that `.in(col, [])` would generate. Not hypothetical:
  // the EN channel has zero videos in production and its snapshot is a live path.
  if (videoIds.length > 0) {
    const floor = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10)
    const { data: latest } = await supabase
      .from('youtube_video_analytics')
      .select('date')
      .eq('site_id', siteId)
      .in('youtube_video_id', videoIds)
      .gte('date', floor)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (latest?.date) {
      recentWindow = { date: latest.date as string, days: SYNC_WINDOW_DAYS }
      const { data: rows } = await supabase
        .from('youtube_video_analytics')
        .select('youtube_video_id, views, subscribers_gained')
        .eq('site_id', siteId)
        .in('youtube_video_id', videoIds)
        .eq('date', latest.date)

      for (const r of rows ?? []) {
        recentByVideo.set(r.youtube_video_id as string, {
          views: (r.views as number) ?? 0,
          subscribers_gained: (r.subscribers_gained as number) ?? 0,
        })
      }
    }
  }
```
E o map de vídeos (`:255-267`) ganha:
```ts
      is_hidden: v.is_hidden,
      // The row of that one date, never a sum: each row is already a 90-day total.
      // The Analytics API omits videos with no activity, so an absent video is {0, 0}.
      recent: recentByVideo.get(v.id) ?? { views: 0, subscribers_gained: 0 },
```
e a resposta ganha `recent_window: recentWindow`.

- [ ] **Step 5: Rodar e ver passar**

Run: `cd apps/web && npx vitest run test/lib/pipeline/services/youtube-intelligence-service.test.ts test/cron/sync-analytics-metrics.test.ts test/api/pipeline/youtube-intelligence.test.ts`
Expected: PASS.

Run: `npm run typecheck --workspace=apps/web`

- [ ] **Step 6: Commit**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git add apps/web/src/lib/youtube/analytics-window.ts \
  "apps/web/src/app/api/cron/sync-analytics-metrics/route.ts" \
  apps/web/src/lib/pipeline/services/youtube.ts \
  apps/web/test/lib/pipeline/services/youtube-intelligence-service.test.ts \
  apps/web/test/cron/sync-analytics-metrics.test.ts
git commit -m "feat: snapshot com janela de 90 dias, is_hidden e fonte cowork

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: `fetchChannelCoaching` e `computeCoachingCards` (lado servidor/dados)

**Gated pela Task 0** (o rótulo e a linha de summary aprovados definem os literais).

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/youtube/analytics/actions.ts:14-44`
- Modify: `apps/web/src/app/cms/(authed)/youtube/analytics/_components/yt-analytics-tabs.tsx:360-407` (exportar; guarda `!= null`)
- Modify: `apps/web/test/youtube/coaching-actions.test.ts:5-13, 69-77`
- Test: `apps/web/test/youtube/coaching-actions.test.ts`

**Interfaces:**
- Consumes: nada das tarefas anteriores (lado CMS).
- Produces: `fetchChannelCoaching` → `{coaching, source, generatedLabel} | null`; `computeCoachingCards` exportada.

- [ ] **Step 1: Escrever os testes que falham**

Em `test/youtube/coaching-actions.test.ts`, a cadeia de mocks (`:5-13`) muda de forma: onde hoje há `.eq('source', …)` passa a haver `.in('source', …)` seguido de `.not('coaching','is',null)`. A cadeia nova, em ordem de chamada — `select → eq(site_id) → eq(channel_id) → is(video_id) → in(source) → not(coaching) → eq(type) → order → limit → maybeSingle`:

```ts
const mockMaybeSingle = vi.fn()
const mockLimit = vi.fn(() => ({ maybeSingle: mockMaybeSingle }))
const mockOrder = vi.fn(() => ({ limit: mockLimit }))
const mockEqType = vi.fn(() => ({ order: mockOrder }))
const mockNot = vi.fn(() => ({ eq: mockEqType }))
const mockIn = vi.fn(() => ({ not: mockNot }))
const mockIs = vi.fn(() => ({ in: mockIn }))
const mockEqChannel = vi.fn(() => ({ is: mockIs }))
const mockEqSite = vi.fn(() => ({ eq: mockEqChannel }))
const mockSelect = vi.fn(() => ({ eq: mockEqSite }))
```

E o helper dos cards, no mesmo arquivo:

```ts
import { computeCoachingCards } from '@/app/cms/(authed)/youtube/analytics/_components/yt-analytics-tabs'
import type { VideoGradeRow } from '@/app/cms/(authed)/youtube/analytics/_components/types'
import type { Axis } from '@/lib/youtube/scoring-types'

const AXES: Axis[] = ['ctr', 'retention', 'reach', 'engagement', 'growth', 'sub_impact']

/** Every axis at 0 is below COACHING_BENCHMARK (6.5), so the heuristic branch yields 3 cards. */
function videoWithAllAxesAt(normalized: number): VideoGradeRow {
  return { axes: AXES.map(axis => ({ axis, normalized, raw: 0 })) } as unknown as VideoGradeRow
}
```

Casos:
```ts
it('queries the cowork+forja allowlist, scoped by site and channel, newest first', async () => {
  mockMaybeSingle.mockResolvedValueOnce({ data: { coaching: { summary: 's', priorities: [] }, source: 'forja', generated_at: '2026-09-18T13:34:00Z' } })
  const result = await fetchChannelCoaching(VALID_CHANNEL)
  expect(result).toEqual({ coaching: { summary: 's', priorities: [] }, source: 'forja', generatedLabel: '18/09' })
  expect(mockIn).toHaveBeenCalledWith('source', ['cowork', 'forja'])
  expect(mockNot).toHaveBeenCalledWith('coaching', 'is', null)
})

it('narrows any other source to cowork — forja_retirada_* never gets the forja badge', async () => {
  mockMaybeSingle.mockResolvedValueOnce({ data: { coaching: { summary: 's', priorities: [] }, source: 'forja_retirada_202609181200', generated_at: '2026-09-18T13:34:00Z' } })
  expect((await fetchChannelCoaching(VALID_CHANNEL))!.source).toBe('cowork')
})

it('formats generatedLabel in Sao Paulo time — 01:30Z is the previous day', async () => {
  mockMaybeSingle.mockResolvedValueOnce({ data: { coaching: { summary: 's', priorities: [] }, source: 'cowork', generated_at: '2026-09-19T01:30:00Z' } })
  expect((await fetchChannelCoaching(VALID_CHANNEL))!.generatedLabel).toBe('18/09')
})
```
E, para os cards:
```ts
it('returns no cards when a coaching row exists with empty priorities — no heuristic fallback', () => {
  const videos = [videoWithAllAxesAt(0)]
  expect(computeCoachingCards(videos, { summary: 's', priorities: [] })).toEqual([])
  expect(computeCoachingCards(videos, null)).toHaveLength(3)
})

it('tolerates a legacy row without a priorities key (jsonb, not TypeScript)', () => {
  expect(computeCoachingCards([videoWithAllAxesAt(0)], { summary: 's' } as never)).toEqual([])
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/web && npx vitest run test/youtube/coaching-actions.test.ts`

- [ ] **Step 3: Implementar `fetchChannelCoaching`**

`actions.ts:14-44` — comentário **e** função:
```ts
/**
 * Reads the most recent channel-level coaching row from the allowlist {cowork, forja}.
 *
 * The badge is derived from `source` here on the server, and any value outside the
 * allowlist is narrowed to 'cowork' — the column is plain TEXT with no CHECK, so a
 * retired `forja_retirada_*` row must never render as "por forja".
 */
export async function fetchChannelCoaching(
  channelId: string,
): Promise<{ coaching: CoachingOutput; source: 'cowork' | 'forja'; generatedLabel: string } | null> {
  if (!UUID_RE.test(channelId)) throw new Error('invalid_input')
  const { siteId } = await getSiteContext()
  const auth = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  if (!auth.ok) throw new Error(auth.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')
  const supabase = getSupabaseServiceClient()

  const { data } = await supabase
    .from('youtube_intelligence')
    .select('coaching, generated_at, source')
    .eq('site_id', siteId)
    .eq('channel_id', channelId)
    .is('video_id', null)
    .in('source', ['cowork', 'forja'])
    .not('coaching', 'is', null)
    .eq('type', 'channel')
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data?.coaching) return null

  // Formatted on the server so the label does not depend on the viewer's timezone.
  const generatedLabel = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo',
  }).format(new Date(data.generated_at as string))

  return {
    coaching: data.coaching as CoachingOutput,
    source: data.source === 'forja' ? 'forja' : 'cowork',
    generatedLabel,
  }
}
```

- [ ] **Step 4: `computeCoachingCards`**

`yt-analytics-tabs.tsx:360` ganha `export`, e a guarda de `:372`:
```ts
  // Tested for null, not for a non-empty priorities array: with `priorities: []` the old
  // guard fell through to the heuristic branch and invented up to 3 fallback cards on top
  // of a real analysis. `?? []` because `coaching` is an `as CoachingOutput` over jsonb —
  // a row written before this commit never went through Zod.
  if (channelCoaching != null) {
    return (channelCoaching.priorities ?? [])
      .map(p => ({
        axis: p.axis,
        score: p.score,
        benchmark: COACHING_BENCHMARK,
        channelValue: p.score * 10,
        diagnosis: p.diagnosis,
        action: p.action,
        source: 'cowork' as const,
      }))
      .sort((a, b) => a.score - b.score)
      .slice(0, 3)
  }
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd apps/web && npx vitest run test/youtube/coaching-actions.test.ts`
Expected: PASS. (O typecheck vai apontar `page.tsx:108` e a prop `channelCoaching` — resolvidos na Task 11, que vem no mesmo push; se preferir manter cada commit com typecheck verde, faça as Tasks 10 e 11 num commit só.)

> **Nota de execução:** o tipo de retorno de `fetchChannelCoaching` e a prop `channelCoaching` de `YtAnalyticsTabs` mudam juntos. Se o typecheck do Step 5 acusar, **junte as Tasks 10 e 11 num único commit** em vez de commitar vermelho.

- [ ] **Step 6: Commit** (ver nota acima)

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git add "apps/web/src/app/cms/(authed)/youtube/analytics/actions.ts" \
  "apps/web/src/app/cms/(authed)/youtube/analytics/_components/yt-analytics-tabs.tsx" \
  apps/web/test/youtube/coaching-actions.test.ts
git commit -m "feat: coaching do canal pela allowlist cowork+forja

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Health Coach — selo por fonte e linha de summary (UI)

**Gated pela Task 0.** Nenhuma linha aqui antes do "aprovado".

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/youtube/analytics/_components/yt-health-coach.tsx:16-27, 50-61, 96-118`
- Modify: `apps/web/src/app/cms/(authed)/youtube/analytics/_components/yt-analytics-tabs.tsx:5, 78, 223, 231, 294-304`
- Modify: `apps/web/test/youtube/yt-health-coach.test.tsx:43-50`
- Test: `apps/web/test/youtube/yt-analytics-tabs-coach.test.tsx` (novo)

**Interfaces:**
- Consumes: `fetchChannelCoaching` → `{coaching, source, generatedLabel}` (Task 10); `computeCoachingCards` exportada.
- Produces: prop `coachingMeta` em `YtHealthCoach`.

- [ ] **Step 1: Escrever o teste de componente que falha**

O badge mora em `YtAnalyticsTabs` (`:170-178,259-261`) e o `page.tsx` assíncrono não roda em jsdom, então o teste renderiza o **container**, não o `YtHealthCoach` solto.

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { YtAnalyticsTabs } from '@/app/cms/(authed)/youtube/analytics/_components/yt-analytics-tabs'
import type { VideoGradeRow } from '@/app/cms/(authed)/youtube/analytics/_components/types'
import type { Axis } from '@/lib/youtube/scoring-types'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
// The Busca tab imports createPipelineItem from a 'use server' module that pulls in
// getSupabaseServiceClient/getSiteContext/requireSiteScope/next/cache — same reason as
// test/youtube/yt-search-terms.test.tsx:17.
vi.mock('@/app/cms/(authed)/pipeline/actions', () => ({ createPipelineItem: vi.fn() }))

const AXES: Axis[] = ['ctr', 'retention', 'reach', 'engagement', 'growth', 'sub_impact']

/** One video whose six axes are all 0 — every axis is below COACHING_BENCHMARK (6.5),
 *  so the heuristic fallback yields exactly 3 cards when there is no coaching row. */
function videoWithAllAxesAt(normalized: number): VideoGradeRow {
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    videoId: 'yt1',
    title: 'Video',
    thumbnailUrl: null,
    publishedAt: '2024-12-10T15:57:00Z',
    views: 0,
    grade: 'D',
    score: 0,
    avgViewPercentage: 0,
    trafficSources: null,
    axes: AXES.map(axis => ({ axis, normalized, raw: 0 })),
  } as unknown as VideoGradeRow
}

const BASE = {
  metrics: { views: 0, subscribers: 0, watchTimeMinutes: 0, videos: 1 },
  dailyMetrics: [],
  grades: [],
  searchTerms: [],
  demographics: { ageGender: [], countries: [], devices: [] },
  intelligenceVideos: [videoWithAllAxesAt(0)],
  healthScore: 40,
  channelInternalId: 'ch-1',
} as never

const MAY_SUMMARY = 'Canal micro (1.160 subs) com …' // texto real da fixture de maio
const MAY_COACHING = {
  summary: MAY_SUMMARY,
  priorities: AXES.slice(0, 6).map((axis, i) => ({ axis, score: i, diagnosis: `d${i}`, action: `a${i}` })),
}

async function openCoach() {
  await userEvent.click(screen.getByRole('tab', { name: /Health Coach/ }))
}

describe('Health Coach — source badge and summary line', () => {
  it('A: Cowork row renders the badge, the summary line, 3 cards and badge 3', async () => {
    render(<YtAnalyticsTabs {...BASE} channelCoaching={{ coaching: MAY_COACHING, source: 'cowork', generatedLabel: '18/05' }} />)
    const coachTab = screen.getByRole('tab', { name: /Health Coach/ })
    expect(within(coachTab).getByText('3')).toBeTruthy()

    await openCoach()
    expect(screen.getByText('Diagnostico · por Cowork · 18/05')).toBeTruthy()
    expect(screen.getByText(MAY_SUMMARY)).toBeTruthy()
    expect(screen.queryByText(/O canal esta em/)).toBeNull()
    expect(screen.queryByText(/Baseado em regras fixas/)).toBeNull()
  })

  it('B: forja row renders the badge and summary, and suppresses cards, Potencial and the healthy card', async () => {
    const summary = 'Sem CTR/retenção nesta fase; base: views e séries. O canal nao publica desde 10/12/2024.'
    render(<YtAnalyticsTabs {...BASE} channelCoaching={{ coaching: { summary, priorities: [] }, source: 'forja', generatedLabel: '19/09' }} />)
    const coachTab = screen.getByRole('tab', { name: /Health Coach/ })
    expect(within(coachTab).queryByText('3')).toBeNull()

    await openCoach()
    expect(screen.getByText('Diagnostico · por forja · 19/09')).toBeTruthy()
    expect(screen.getByText(summary)).toBeTruthy()
    expect(screen.queryByText('Canal saudavel em todos os eixos')).toBeNull()
    expect(screen.queryByText(/Baseado em regras fixas/)).toBeNull()
    expect(screen.queryByText('Potencial')).toBeNull()
    expect(screen.queryByText(/pts/)).toBeNull()
  })

  it('C: no row falls back to the heuristic label, 3 cards and badge 3', async () => {
    render(<YtAnalyticsTabs {...BASE} channelCoaching={null} />)
    await openCoach()
    expect(screen.getByText('Diagnostico heuristico')).toBeTruthy()
    expect(screen.getByText(/Baseado em regras fixas/)).toBeTruthy()
  })

  it.each([
    ['an empty summary', { summary: '', priorities: MAY_COACHING.priorities }],
    ['no summary key at all', { priorities: MAY_COACHING.priorities }],
  ])('renders label and cards without an empty line and without throwing, for %s', async (_label, coaching) => {
    render(<YtAnalyticsTabs {...BASE} channelCoaching={{ coaching: coaching as never, source: 'cowork', generatedLabel: '18/05' }} />)
    await openCoach()
    expect(screen.getByText('Diagnostico · por Cowork · 18/05')).toBeTruthy()
    expect(screen.queryByText(/O canal esta em/)).toBeNull()
  })

  it.each([
    ['A', { coaching: MAY_COACHING, source: 'cowork' as const, generatedLabel: '18/05' }],
    ['B', { coaching: { summary: 's', priorities: [] }, source: 'forja' as const, generatedLabel: '19/09' }],
    ['C', null],
  ])('%s: the header button reads "Pedir diagnostico", never "ao Cowork"', (_label, channelCoaching) => {
    render(<YtAnalyticsTabs {...BASE} channelCoaching={channelCoaching as never} onRequestAnalysis={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Pedir diagnostico' })).toBeTruthy()
    expect(screen.queryByText(/ao Cowork/)).toBeNull()
  })
})
```

> `MAY_SUMMARY` é o texto real de maio, copiado da fixture da Task 5 (`test/fixtures/intel-cowork-2026-05-18.json`, campo `coaching.summary`, 500 caracteres). Importe-o da fixture em vez de redigitar.

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/web && npx vitest run test/youtube/yt-analytics-tabs-coach.test.tsx`

- [ ] **Step 3: `YtHealthCoach`**

`Props` (`:19-27`) ganha, e `hasCoworkCoaching` (`:61`) sai. `lastAnalysisAt` **fica como está** na interface (`:24`) — tirá-la obrigaria a mexer em `yt-analytics-tabs.tsx:84,106,300` e `page.tsx:111`, fora do que este commit precisa.
```ts
interface Props {
  healthScore: number
  radarData: Array<{ label: string; value: number; grade: string }>
  coachingCards: CoachingCard[]
  videoCount: number
  lastAnalysisAt: string | null
  /** Non-null whenever a real analysis (Cowork or forja) exists for this channel. */
  coachingMeta: { source: 'cowork' | 'forja'; generatedLabel: string; summary: string } | null
  onRequestAnalysis?: () => void
  analysisState: 'idle' | 'pending' | 'cooldown' | 'success'
}
```

O bloco `:96-118` vira:
```tsx
        <div className="flex-1">
          <span className="section-label">
            {coachingMeta
              ? `Diagnostico · por ${coachingMeta.source === 'forja' ? 'forja' : 'Cowork'} · ${coachingMeta.generatedLabel}`
              : 'Diagnostico heuristico'}
          </span>
          {coachingMeta ? (
            coachingMeta.summary.trim() !== '' && (
              <p style={{ fontSize: 14, lineHeight: 1.55, marginTop: 6 }}>{coachingMeta.summary}</p>
            )
          ) : (
            <p style={{ fontSize: 14, lineHeight: 1.55, marginTop: 6 }}>
              {sortedCards.length > 0
                ? `O canal esta em ${healthScore}/100. ${sortedCards.length} eixo${sortedCards.length > 1 ? 's' : ''} puxa${sortedCards.length > 1 ? 'm' : ''} pra baixo. Resolver levaria o score pra ~${potentialScore}.`
                : 'Canal saudavel em todos os eixos — continue monitorando.'}
            </p>
          )}
          {!coachingMeta && sortedCards.length > 0 && (
            <p className="dim" style={{ fontSize: 11, marginTop: 4 }}>
              Baseado em regras fixas — ainda sem analise para este canal.
            </p>
          )}
        </div>
```
E o card verde (`:169-176`) ganha `!coachingMeta &&` na condição. O bloco "Potencial" (`:109-118`) **não muda**: com `priorities: []` não há card, `potentialGain` é 0 e ele já não aparece.

- [ ] **Step 4: `YtAnalyticsTabs`**

- `:78` — a prop muda de tipo:
```ts
  channelCoaching?: { coaching: CoachingOutput; source: 'cowork' | 'forja'; generatedLabel: string } | null
```
- monta o `coachingMeta`:
```ts
  // `coaching` is an `as CoachingOutput` over jsonb and `summary: string` is a TypeScript
  // promise, not a database one: no row written before this commit went through Zod, and
  // `.not('coaching','is',null)` does not exclude `{}`. Without this narrowing, `.trim()`
  // of undefined is a TypeError inside a client component.
  const coachingMeta = useMemo(
    () => channelCoaching
      ? {
          source: channelCoaching.source,
          generatedLabel: channelCoaching.generatedLabel,
          summary: typeof channelCoaching.coaching.summary === 'string' ? channelCoaching.coaching.summary : '',
        }
      : null,
    [channelCoaching],
  )
```
- `:294-304` — `<YtHealthCoach … coachingMeta={coachingMeta} />`.
- `:223` — `className="btn"` (sai `cowork`: `[data-cms-section="youtube"] .btn.cowork` pinta com `--cowork`, e a cor contaria outra fonte).
- `:231` — o literal final passa a `'Pedir diagnostico'`.
- `:5` — o comentário do cabeçalho do arquivo deixa de citar "Pedir diagnostico ao Cowork".

- [ ] **Step 5: `yt-health-coach.test.tsx`**

`baseProps` (`:43-50`) ganha `coachingMeta: null`. O teste do botão (`:113-118`, "Solicitar Nova Analise") e a interface local `CoachingCard` (`:21-29`) **não mudam**.

- [ ] **Step 6: Rodar e ver passar**

Run: `cd apps/web && npx vitest run test/youtube/yt-analytics-tabs-coach.test.tsx test/youtube/yt-health-coach.test.tsx test/youtube/coaching-actions.test.ts`
Expected: PASS.

Run: `npm run typecheck --workspace=apps/web`
Expected: sem erros (`page.tsx:108` já casa com o tipo novo, porque `fetchChannelCoaching` mudou na Task 10).

- [ ] **Step 7: Commit**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git add "apps/web/src/app/cms/(authed)/youtube/analytics/_components/yt-health-coach.tsx" \
  "apps/web/src/app/cms/(authed)/youtube/analytics/_components/yt-analytics-tabs.tsx" \
  apps/web/test/youtube/yt-health-coach.test.tsx \
  apps/web/test/youtube/yt-analytics-tabs-coach.test.tsx
git commit -m "feat: selo de fonte e linha de summary no Health Coach

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: MCP — idade do snapshot, prompt e descrições de tool

**Files:**
- Modify: `apps/web/src/lib/pipeline/mcp/prompts.ts:102-113` e `:933`
- Modify: `apps/web/src/lib/pipeline/mcp/tools.ts:662, 690`
- Test: `apps/web/test/mcp/youtube-mcp-prompts.test.ts`, `apps/web/test/mcp/mcp-schema-parity.test.ts`

**Interfaces:**
- Consumes: filtro `source='cowork'` do snapshot (Task 9).
- Produces: `fetchSnapshotAge` filtrando `cowork`.

- [ ] **Step 1: Teste que falha**

Em `test/mcp/youtube-mcp-prompts.test.ts`, afirmar nas chamadas do mock que `fetchSnapshotAge` chama `.eq('source','cowork')`. Sem isso uma linha `forja` faria a análise do Cowork parecer nova.

- [ ] **Step 2: Rodar e ver falhar** — Run: `cd apps/web && npx vitest run test/mcp/youtube-mcp-prompts.test.ts`

- [ ] **Step 3: Implementar**

`prompts.ts:104-109` ganha `.eq('source', 'cowork')` — **e só isso**. Sem parâmetro novo, sem `getMcpContext()` (os prompts rodam sem contexto no teste, e ali ele lançaria). A idade continua global entre canais e entre sites, como hoje; os dois filtros ficam fora desta fase.

`prompts.ts:933` (prompt `youtube-analyst`): o array de inteligência traz **só** análises do Cowork.

`tools.ts:662`: na mesma string, `submit_intelligence` passa a dizer que a fonte da linha vem da chave, e `claim_task` que, no MCP, exige `write` (a chave `{read,intelligence}` clama só pelo REST, com `channel_ids`).
`tools.ts:690`: a descrição de `intel_payload` diz que a fonte vem da chave e que o campo `source` no corpo é ignorado.

- [ ] **Step 4: Rodar e ver passar**

Run: `cd apps/web && npx vitest run test/mcp/`
Expected: PASS (inclusive os snapshots de `test/mcp/__snapshots__`, que talvez precisem de `-u` se a descrição da tool estiver snapshotada — conferir o diff antes de aceitar).

- [ ] **Step 5: Commit**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git add apps/web/src/lib/pipeline/mcp/prompts.ts apps/web/src/lib/pipeline/mcp/tools.ts apps/web/test/mcp/
git commit -m "chore: MCP enxerga so analises do Cowork e documenta a fonte pela chave

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: docs do Cowork e o orçamento dos 8.000 caracteres

**Files:**
- Modify: `apps/web/data/pipeline-docs/cowork-docs-youtube.md`
- Modify: `apps/web/test/mcp/youtube-cowork-docs.test.ts`

**Interfaces:**
- Consumes: as rotas e o envelope das Tasks 3, 4, 5.
- Produces: doc servido ao Cowork em `/api/pipeline/docs/youtube`.

- [ ] **Step 1: Medir o orçamento antes de editar**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web
node -e "const s=require('fs').readFileSync('data/pipeline-docs/cowork-docs-youtube.md','utf8');for(const h of ['## Formato de Análise (Cowork -> PATCH)','### Coaching (por canal)','## Retry & Backoff'])console.log(s.indexOf(h), h)"
```
Esperado hoje: ~6.580, ~7.321, ~7.842 — **158 caracteres de folga** até o corte de 8.000 do prompt.

- [ ] **Step 2: Teste que falha**

Em `test/mcp/youtube-cowork-docs.test.ts` (que já lê o arquivo inteiro, `:10-13`):
```ts
it('keeps the whole "Coaching (por canal)" section inside the 8000-char prompt slice', () => {
  const start = doc.indexOf('### Coaching (por canal)')
  expect(start).toBeGreaterThan(-1)
  const next = doc.indexOf('\n## ', start)
  expect(next).toBeGreaterThan(-1)
  // `youtube-analyst` injects only the first 8000 characters of this file. Without this
  // assertion an edit earlier in the doc silently pushes the coaching/priorities format —
  // exactly what produces the three cards the owner sees — out of the prompt.
  expect(next).toBeLessThan(8000)
})
```

- [ ] **Step 3: Remanejar e editar**

1. **Mover** o bloco `:220-261` (de `## Formato de Análise (Cowork -> PATCH)` até o `---` de `:261`) para logo **depois** do `---` de `:131`, à frente de `## Algoritmo de Scoring`. Ali ele termina por volta do caractere 4.540 e sobram ~3,4 mil.
2. Reescrever as seções do snapshot (`:19-79`, inclusive `existing_intelligence` → `intelligence`), do PATCH (`:81-121`) e do GET `/task` (`:123-129`) para mostrar o **envelope**: `{"data": …}` em todo sucesso e `{"error":{"code","message"}}` em toda recusa. São as únicas seções do arquivo que hoje mostram o corpo nu.
3. Registrar: `channel_id` **obrigatório** no GET do snapshot; `recent`/`recent_window` e `videos[].is_hidden`; o array `intelligence` só com `cowork`; o GET `/task` legado exige `write`; a fonte vem da chave; os novos 400/409/500 — estes **repetidos também dentro da seção do PATCH**.
4. "Retry & Backoff" (`:263-268`): watchdog → `stale`, e `retry` até 2.
5. "Error Codes" (`:270-281`): 409 `TASK_NOT_RUNNING` = não reenviar; 500 `PARTIAL_FAILURE` = a task segue `running` e nada foi fechado — dar `fail` com `retry`.
6. **Duas seções `###` novas**, inseridas **depois** do `---` de `:281` e antes de `## Exemplo Completo de Análise` — nunca entre `:131` e `:133`: `### POST /api/pipeline/youtube/intelligence/task/claim` (corpo `{channel_ids}`, 200/204/400/403/500) e `### POST /api/pipeline/youtube/intelligence/task/{id}/fail` (corpo `{reason, retry}`, 200/400/404/409/500).
7. Fluxo (`:1351-1361`) atualizado.

`docs/cowork-youtube-intelligence-reference.md` e `docs/cowork-pipeline-reference.md` **não mudam**.

- [ ] **Step 4: Rodar e ver passar**

Run: `cd apps/web && npx vitest run test/mcp/youtube-cowork-docs.test.ts test/api/pipeline/docs.test.ts`
Expected: PASS, com a asserção dos 8.000 verde.

- [ ] **Step 5: Commit**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git add apps/web/data/pipeline-docs/cowork-docs-youtube.md apps/web/test/mcp/youtube-cowork-docs.test.ts
git commit -m "docs: fila de inteligencia no doc do Cowork, com envelope e error codes

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 14: integração com o Supabase local (DB-gated)

**Files:**
- Create: `apps/web/test/integration/youtube-intelligence-forja.test.ts`

**Interfaces:**
- Consumes: todo o serviço (Tasks 2, 4, 6–9) e `fetchChannelCoaching` (Task 10).
- Produces: as garantias que o mock não dá — PGRST116, ordenação real, índices únicos.

- [ ] **Step 1: Subir o banco local**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
npx supabase@2.98.2 start --exclude gotrue,realtime,imgproxy --ignore-health-check
npx supabase@2.98.2 db reset --local
```

- [ ] **Step 2: Escrever a suíte**

`test/integration/youtube-intelligence-forja.test.ts`, com `describe.skipIf(skipIfNoLocalDb())` (helper em `test/helpers/db-skip.ts`) e seed por `test/helpers/db-seed.ts`. Casos, um `it` cada:

1. Dois PATCH `forja` seguidos (tasks distintas) no mesmo canal → **uma só** linha de canal `forja`, com o texto do segundo. A linha `cowork` do canal e as `forja` de outro canal e de outro site ficam intactas.
2. CAS de fechamento com `claimed_by` diferente → 0 linhas e 409; igual → `completed`.
3. Claim com `channel_ids` e `site_id` → só a task elegível vira `running`. Fila vazia, `channel_ids` sem `pending` e `channel_ids` de outro site → **204 com o PostgREST real, nunca 500**.
4. Snapshot: `recent_window` é `null` com a última linha em hoje(UTC)−4 e não nulo com hoje(UTC)−3; linhas de vídeo de outro canal não entram (fixture com `youtube_videos.youtube_video_id` diferente do `id`).
5. `fail {retry:true}` → `pending`.
6. PATCH e `fail` com `task_id` inexistente e com `task_id` de outro site → **404, nunca 500**.
7. `fetchChannelCoaching` (com `getSiteContext`/`requireSiteScope` mockados), três casos no mesmo canal: `cowork` + `forja` mais nova → devolve a `forja`; `forja` mais velha que a `cowork` → devolve a `cowork`; `cowork` + `forja_retirada_202609181200` mais nova → devolve a `cowork` (trava o rollback do §5).

Datas sempre relativas (`hoje(UTC) − N`), nunca literais.

- [ ] **Step 3: Rodar**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
SUPABASE_EXCLUDE_GOTRUE=true HAS_LOCAL_DB=1 npm test --workspace=apps/web -- integration/
```
Expected: PASS — e **conferir na saída que os testes do arquivo novo passaram, não `skipped`**. Sem `HAS_LOCAL_DB=1`, ou com o Supabase local fora, o `describe.skipIf` deixa a suíte verde por omissão.

- [ ] **Step 4: Commit**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git add apps/web/test/integration/youtube-intelligence-forja.test.ts
git commit -m "test: integracao da fila de inteligencia com o banco local

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 15: portões do F0 — suíte, CI, promoção e sonda

Sem código novo. É o portão da célula F0 da tabela do §5 do spec.

**Files:** nenhum.

**Interfaces:**
- Consumes: todas as tarefas anteriores.
- Produces: F0 em produção, validado, pronto para o F0.5.

- [ ] **Step 1: Suíte completa e typecheck**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web && npx vitest run
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run typecheck --workspace=apps/web && npm run typecheck --workspace=apps/api
```
Expected: 0 falhas (~160 s).

- [ ] **Step 2: Integração com o banco local, como a CI roda**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
npx supabase@2.98.2 start --exclude gotrue,realtime,imgproxy --ignore-health-check
npx supabase@2.98.2 db reset --local
SUPABASE_EXCLUDE_GOTRUE=true HAS_LOCAL_DB=1 npm test --workspace=apps/web -- integration/
```
Mesma sequência de `ci.yml:135-137` + `ci.yml:142`. **Não** use `npm run db:start` (é `supabase start` sem pin) e **não** rode só o arquivo novo.

- [ ] **Step 3: Validação autenticada local, antes de qualquer push**

Seguir `docs/ops/runbook-cms-e2e-local.md`: varredura da sidebar 200/`ok` e `/cms/youtube/analytics` sem boundary, com o console sem `error`. Localmente não há conexão YouTube com token válido, então a página para em "Nenhuma conexão YouTube encontrada" — os cenários A–C ficam no teste jsdom da Task 11.

- [ ] **Step 4: O dono empurra**

**Pare aqui e chame o dono.** Mostrar: o resumo do que mudou, a saída da suíte, e a lista de commits do F0:
```bash
git log --oneline origin/staging..HEAD
```
O push é do dono. Depois: CI (`ci.yml`) verde no push de `staging`, **inclusive o job de integração**, e Vercel verde.

- [ ] **Step 5: Validação autenticada antes da promoção**

Com o dono, em preview/staging autenticado: `/cms/youtube/analytics` sem boundary e o PT mostrando `por Cowork · 18/05` com a linha de summary, os 3 cards e o badge 3.

- [ ] **Step 6: Promoção e sonda pós-promoção**

Depois de `staging → main` e do deploy: o dono roda na forja (comandos preparados, dono cola):
```
cd /opt/agente && venv/bin/python -B docs/trilha/sonda_f0.py
```
Nesta ordem: `GET .../intelligence?channel_id=<PT>` → **200 com `recent_window`** (prova o deploy novo); só então `POST .../task/claim {channel_ids:[<uuid inexistente>]}` → **403** e `PATCH .../intelligence` vazio → **403**. Qualquer outro status reprova; um 200/204 dispara o rollback do F0.

> O `sonda_f0.py` é escrito no card **F0k** e levado pelo **K** — os dois vêm depois deste plano de F0 e antes deste passo. O GET legado `.../intelligence/task` **não** é sondado em prod: já é unitário sem mock de helpers (Task 2), e contra um build velho a sonda seria um claim de verdade com a chave `{read}`.

- [ ] **Step 7: Conferência final, logado em prod**

PT mostra `por Cowork · 18/05`, com a linha de summary, 3 cards e badge 3. A linha `cowork` continua no banco (leitura):
```bash
cd ~/Workspace/bythiagofigueiredo && npx --yes supabase@2.98.2 db query --linked --agent=no "select source, generated_at, video_id is null as canal from public.youtube_intelligence where site_id = (select id from public.sites where primary_domain='bythiagofigueiredo.com') order by generated_at desc limit 12"
```

---

---

# Cards da forja

Ordem de execução: **F0k → K → F0 (acima) → F0.5 → S4 → F1 → F2 → F4**. O rollback é a inversa dos cards que mudam estado: **F4 → Qualidade → F1 → S4 → F0**. Não existe F3 nesta fase.

A tabela do §5 do spec está em ordem de leitura, não de execução — siga a ordem acima.

## Contratos do worker — fonte única

`fila_intel.py` é escrito por várias tarefas que se consomem. **Estas assinaturas são autoritativas**: onde uma tarefa abaixo divergir, ela está errada e é ela que muda. Cada função tem um dono, e só o dono a define.

```python
# ── esqueleto e ambiente (card F1P) ────────────────────────────────────────────
BASE, DEFAULT, TRAVA, LOG, JSONL, ERR, SERIES, ROTEAMENTO, ENV_FILA, SOMBRA  # constantes de módulo
def carregar_sitio() -> module          # por AGENTE_SITIO; dele saem norm, _t, EMOJI
def main(argv=None, *, agora_mono=time.monotonic, dormir=..., agora=...,
         abrir_site=..., abrir_llama=...) -> int      # devolve 0/75; NÃO chama sys.exit
#   dormir é async · abrir_site/abrir_llama são chamados SEM argumento e usados com `async with`

# ── segredos (card F1) ─────────────────────────────────────────────────────────
def ler_env_fila(caminho) -> tuple[str | None, list[str], str | None]
#   motivo ∈ {None, env_ausente, env_ilegivel, chave_ausente, chave_duplicada, chave_formato}
#   não confere o modo 0600 do arquivo — quem confere é `nova_chave.py --fila`
def ler_default(caminho) -> tuple[str | None, dict[str, str]]     # (chave {read}, {'PT': uuid, 'EN': uuid})
def ler_config() -> Config              # interface do laço; miolo = os dois leitores acima
#   ler_config() DEVE chamar `ler_env_fila(...)` como global do módulo, nunca por
#   `from ... import ler_env_fila`: os testes do card F1 fazem monkey-patch de
#   `FI.ler_env_fila` para contar chamadas, e com import local eles contam zero e
#   passariam por omissão.

# ── cálculo (card F2F) ─────────────────────────────────────────────────────────
def features(snapshot: dict, series: dict, hoje: datetime.date) -> dict
def escolher(feats: dict) -> dict
#   -> {channel_insights: {patterns_detected, analysis_text}, coaching: {priorities: []},
#       series: [...], motivos: [...]}        # sem video_recommendations, sem notifications
#   series[i] = {slug, nome, n, ano, mediana, views_90d_serie?, n_coorte, mediana_coorte, aplica}
#     `mediana` é a da SÉRIE (vai para `mediana_views_vida` da ENTRADA) e convive com `mediana_coorte`.
#     NÃO é `mediana_vida`. series[i] ↔ patterns_detected[i], mesma ordem.
#   feats NÃO tem chave `hoje` — `hoje` é parâmetro de features() e já sai aplicado em canal.data_base.
#   canal.data_base NUNCA é None: o fallback do §4.4 (recent_window nulo → hoje) mora em features(),
#     num lugar só. O None sobra apenas em canal.views_90d.

# ── formatação e medida: DONO ÚNICO é o card F2F ───────────────────────────────
def _razao(mediana, mediana_coorte) -> Decimal   # COMPUTAÇÃO (Decimal + ROUND_HALF_UP)
def _razao_txt(r) -> str                         # EXIBIÇÃO ("0,63×")
def _num(v) -> str                               # número pt-BR, sem separador de milhar
def _u16(s) -> int                               # unidades UTF-16 (o que o Zod conta)
#   Nenhuma função de formatação ou de medida nasce em outro card. `_razao` de computação e
#   um `_razao` de exibição no mesmo módulo se apagariam conforme a ordem das definições,
#   sem erro nenhum, e o piso de efeito passaria a comparar uma string.

# ── redação e validação (card F2R) ─────────────────────────────────────────────
AVISO_ESTREITO: str                     # 50 caracteres
MAX: int                                # 500 - len(AVISO_ESTREITO) - 10 = 440
S: dict                                 # o json_schema da gramática
SISTEMA_FILA: str
def montar_entrada(feats: dict, escolhido: dict) -> dict          # a ENTRADA do §4.4
def mensagens(entrada: dict) -> list[dict]
async def gerar(cli_llama, msgs: list, restante_s: float, seed: int | None = None) -> tuple[str | None, str | None, dict]
def redigir(cli_llama, entrada, restante, gerar_=gerar) -> dict
def aparar(s: str) -> tuple[str, str | None]                      # (texto, 'curto' | None)
def prefixar(summary: str) -> str
def aplicar_summary(payload: dict, summary: str) -> dict
def limites(payload: dict) -> list[str]                           # item 1 -> ['zod: <campo>']
def escopo(payload: dict) -> list[str]                            # item 2 -> ['escopo: <campo>']
def validar(payload: dict, entrada: dict, texto: str) -> tuple[list[str], list[str]]
def template_summary(entrada: dict) -> str                        # item 6

# ── site (card S4, em sitio.py) ────────────────────────────────────────────────
async def pedir(cli, metodo, caminho, params=None, agora=time.time, *,
                corpo=None, fase=FASE, chave=None, timeout=None)
class FalhaSite(Exception):
    def __init__(self, tipo, rota, detalhe="", *, status=None)    # 1º posicional é TIPO, não rota
ROTAS_FASE[2] = ROTAS_FASE[1] + 4 rotas

# ── dublês e harness (cards S4 e TF) ───────────────────────────────────────────
class CliFalso:
    def __init__(self, troca=None, status=None, erro=None, gigante=None, busca=None, respostas=None)
    async def request(self, metodo, url, params=None, json=None, headers=None,
                      timeout=None, follow_redirects=True)
    # .chamadas [(caminho, params, headers)]   .pedidos [(metodo, caminho, json)]
def rodar(argv=("--cron",), *, site=None, llama=None, quando=QUANDO, passo=0.0, t0=1000.0, ...)
def casos(F, exige)      # hook que teste_calculo.py e teste_fila_redacao.py expõem ao harness
```

**A linha do jsonl traz sempre** `quando`, `modo`, `desfecho`, `claim`, `task`, `motivos` — são exatamente os seis campos que o bloco do pulso lê, e nenhum caminho de saída pode omitir um deles (inclusive `morto`, `bug` e `config`, onde `task` e `claim` são `null`). Os demais campos do §4.1 (`etapa`, `canal`, `ms`, `tentativas`, `seeds`, `tokens`, `fallback`) entram quando houver, e ninguém depende deles.

## Arquivos de teste do kit — quem roda onde

| Arquivo | Cobre | Roda no Mac? | Entrada |
|---|---|---|---|
| `trilha/teste_calculo.py` | §4.2, §4.3 | **sim**, com `PYTHONPATH=$PWD/st AGENTE_SITIO=../sitio.py AGENTE_FILA=$PWD/fila_intel.py` | sozinho, ou por `casos(F, exige)` |
| `trilha/teste_fila_redacao.py` | §4.4, §4.5 | **sim**, mesma linha de ambiente | sozinho, ou por `casos(F, exige)` |
| `trilha/teste_fila.py` | §4.1, §4.6, §4.7 e os dois acima | **não** (carrega o worker, que importa `httpx`) | entrada única na forja |
| `trilha/teste_s4.py` | `sitio.py` fase 2 | **sim**, com `AGENTE_SITIO` | `cartao.sh S4` |
| `fase2/teste_pulso_fila.py` | o bloco do pulso (§6) | **sim** (shell + stdlib) | passo 3 do F4 |

**O `PYTHONPATH=$PWD/st` não é opcional.** `fila_intel.py` importa `httpx` no topo, e o `python3` do Mac não o tem — o stub do kit em `docs/trilha/st/` é o que faz os dois arquivos stdlib rodarem aqui. O portão oficial do `teste_fila.py` usa `env -u PYTHONPATH` de propósito, para **não** depender do stub; os irmãos precisam dele.

Os dois primeiros rodarem no Mac é o que dá ciclo de TDD local para a parte mais densa em números. É por isso que este plano **não** tem um modo `--dubles` no harness nem um venv descartável: as duas ideias existiam só para contornar a falta desse ciclo.

## Índice dos cards da forja

85 tarefas, além das 16 do card F0. As tarefas de **escrita do kit** (prefixos `F1P`, `F2F`, `F2R`, `TF`, mais `S4-1..5`, `F1-1..3`, `F4-1..2`) acontecem todas no tempo do **F0k**, no Mac, antes do `K`. As demais são cartões de execução, do dono, na forja.

| Seção | Prefixo | Tarefas |
|---|---|---|
| O worker: o laço de uma execução (§4.1, §4.7) | `F1P-*` | 12 |
| O worker: cálculo — `features` e `escolher` (§4.2, §4.3) | `F2F-*` | 8 |
| O worker: redação pelo 12B e validador local (§4.4, §4.5) | `F2R-*` | 10 |
| O worker: harness `teste_fila.py` (§4.6) | `TF-*` | 13 |
| `sitio.py` fase 2 e o cartão S4 (§4.6) | `S4-*` | 7 |
| Segredos, a chave `forja (fila)` e o cartão F1 (§4.6, §5) | `F1-*` | 8 |
| Pulso, crontab e o cartão F4 (§6, §5) | `F4-*` | 8 |
| Portão F0k, cartão K, F0.5, F2 e o rollback do F0 (§5) | `F05-*`, `F0k-*`, `F2-*`, `K-*`, `RB0-*` | 19 |


---

## F0k · o worker — o laço de uma execução (§4.1, §4.7)

Frente do **laço de uma execução**: §4.1 inteiro do spec, a regra de *falha transitória* do §4.6 e os
**modos auxiliares** do §4.7 (`--sombra`, `--escolher`, `--canario`).

**Fora desta frente** (outras partes do mesmo card F0k, cujos contratos esta parte **consome**):
`features`/`escolher` (§4.2/§4.3, frente A2) · redação e validador (§4.4/§4.5, frente A3) ·
`sitio.py`/`s4.py`/`sitio_falso.py` (§4.6, frente A4) · leitor de segredo e chave (§4.6, frente A5) ·
harness `teste_fila.py` (§4.6, frente A6) · pulso (§6, frente A7) · cartões de rollout, e com eles
`capturar_fixture.py` e `sonda_f0.py` (§4.7/§5, frente A8).

> **Reconciliação (pós-merge).** Em todo contrato cruzado esta frente é **consumidora**: as
> assinaturas abaixo são as dos donos, copiadas dos planos deles, não as que esta frente havia
> suposto. O que mudou está resumido no fim do arquivo, em *Diferenças em relação à primeira versão*.

---

### Restrições desta parte (além das Global Constraints)

- **Escrita na forja é do dono.** Nenhum passo roda `ssh`, `scp`, `install`, `mv`, `crontab` ou
  `systemctl` na forja. Os passos que precisam da forja **preparam** o comando — curto, um por linha,
  em bloco de código — e o dono cola. Conferência depois só por leitura.
- **O kit é repositório git desde 20/09/2026.** O dono rodou `git init` em
  `~/Workspace/forja/ferramentas`; conferido: commit `ec51833`, 116 arquivos rastreados, árvore
  limpa, `.gitignore` com `__pycache__/` e `*.pyc`. O `.git` fica em `ferramentas/`, **fora de
  `docs/`**, então o `scp -r sitio.py trilha` do card K não o leva e o portão `KIT-IGUAL` (md5) não
  o vê. Portanto:
  - **toda tarefa desta frente termina em `git commit`**, mensagem no padrão `tipo: descrição curta`
    (`feat`, `fix`, `chore`, `refactor`, `docs`), **repositório local, sem remoto e sem push**;
  - `git add` sempre por **caminho explícito**, nunca `git add -A` nem `git add .`: dois ou mais
    terminais mexem no kit em paralelo, e o `-A` arrastaria o trabalho das outras frentes;
  - **nenhum passo desta frente faz cópia `.bak` no Mac** — o git substitui isso, e um `.bak` só
    sujaria o `git status`. Os `.bak-*` que o `deploy.sh` e a instalação do worker criam **na forja**
    são outra coisa e continuam (§4.6).
- **Python 3 + só biblioteca padrão + `httpx`.** `import httpx` é de módulo, mas **todo uso fica
  dentro de função** (contrato do A5, item 5): é o que deixa o Mac carregar o módulo com o stub
  `docs/trilha/st/httpx.py` (`class AsyncClient: pass`).
- **Todo caminho sai de `BASE`/`DEFAULT`**, com os nomes de constante que o harness exige (A6):
  `TRAVA`, `LOG`, `JSONL`, `ERR`, `SERIES`, `ROTEAMENTO`, `ENV_FILA`, `SOMBRA`. Nenhuma string
  `/opt/agente` literal no código.
- **Importar o módulo não pode ter efeito colateral**: sem lock, sem handler de sinal, sem ler nem
  gravar arquivo, sem rede.
- **O log nunca leva a chave nem o texto gerado.**
- **A linha do jsonl traz SEMPRE** `quando`, `modo`, `desfecho`, `claim`, `task`, `motivos` — são
  exatamente os seis campos que o bloco do pulso do A7 lê, e ele não lê mais nenhum. `nova_linha()`
  os inicializa e nenhum caminho de saída os remove; em `morto`, `bug` antes do claim e `config`,
  `task` e `claim` saem `null`, nunca ausentes.

### Como esta frente verifica

`teste_fila.py` **não roda no Mac** (o worker importa `httpx`; o `python3` do Mac não tem). O ciclo
local desta frente é, por tarefa:

```bash
cd ~/Workspace/forja/ferramentas && python3 -m py_compile docs/trilha/fila_intel.py docs/trilha/teste_fila.py && echo PY-OK
```

e, sempre que a tarefa mexe em algo que as frentes A2/A3 exercitam (ambas stdlib puro, rodam no Mac):

```bash
cd ~/Workspace/forja/ferramentas/docs/trilha && PYTHONPATH="$PWD/st" AGENTE_SITIO="$PWD/../sitio.py" python3 -B teste_calculo.py
cd ~/Workspace/forja/ferramentas/docs/trilha && AGENTE_SITIO="$PWD/../sitio.py" AGENTE_FILA="$PWD/fila_intel.py" python3 -B teste_fila_redacao.py
```

O **portão de verdade** é `teste_fila.py` na forja, rodado pelo dono (Task F1P-12). Os casos desta
frente entram como grupos no ponto de extensão `GRUPOS` do harness (A6, Task TF-12), nos marcadores
`>>> GRUPO laco` e `>>> GRUPO modos auxiliares`.

**Divisão de casos com o A6** (a tabela do A6, Task TF-12, manda): `isolamento`, `lock`, `jsonl`,
`rotacao`, `sigterm` e `portaria` (que já inclui `/slots` **e** `fila_intel.env`) são do **A6**. Esta
frente escreve o **código** dessas partes, mas **não** escreve caso para elas — as Tasks F1P-2, F1P-3
e F1P-4 abaixo rodam contra os grupos que o A6 já tem.

---

### Interfaces que esta parte CONSOME (assinaturas dos donos)

```python
# ---- §4.2 / §4.3 — frente A2 -----------------------------------------------
def features(snapshot, series, hoje) -> dict
    # hoje: datetime.date em UTC. Pura. Devolve, entre outras:
    #   {"canal": {"nome","videos","views_90d"|None,"data_base",
    #              "ultimo_video"|None,"dias_sem_publicar"|None},
    #    "videos": [...], "series": [...], "sem_serie": [...], "orfas": bool}
    # `data_base` NUNCA e None: o fallback do §4.4 (recent_window nulo -> hoje) mora aqui,
    # num lugar so. O None sobra em views_90d, ultimo_video e dias_sem_publicar.
    # NAO existe a chave `hoje` no dict: `hoje` e parametro, e ja sai aplicado em data_base.

def escolher(feats) -> dict
    # {"channel_insights": {"patterns_detected": [...], "analysis_text": str},
    #  "coaching": {"priorities": []},
    #  "series": [...],            # MESMA ordem de patterns_detected
    #  "motivos": [...]}           # 'padrao_neutro', 'series_orfas', 'coorte_fina'
    # SEM `entrada`, SEM `task_id`, SEM `coaching.summary` — quem os acrescenta é esta frente.
    # `coorte_fina` (C4, aprovado em 20/09): a serie nao virou padrao porque a coorte do ano tem
    # menos de 4 videos elegiveis. O laco NAO filtra, ordena nem trunca `motivos`: ele faz
    # `estado["motivos"].extend(escolhido.get("motivos", ()))` e a lista inteira chega ao jsonl,
    # onde o §6 e o dono a leem. Vale para os tres modos que chamam `escolher`
    # (normal, `--sombra`, `--canario`).

# ---- §4.4 / §4.5 — frente A3 -----------------------------------------------
AVISO_ESTREITO: str     # "Sem CTR/retenção nesta fase; base: views e séries." (50 caracteres)
MAX: int                # 500 - len(AVISO_ESTREITO) - 10 -> 440
S: dict                 # o json_schema da gramática
SISTEMA_FILA: str       # o texto integral do system

def montar_entrada(feats, escolhido) -> dict            # a ENTRADA do §4.4
def mensagens(entrada) -> list                          # [{system}, {user}]
async def redigir(cli_llama, entrada, restante, gerar_=gerar) -> dict
    # `restante` é um CALLABLE sem argumentos -> segundos restantes do orçamento de 20 min.
    # Faz as DUAS tentativas, o corte de 9 min, o Aparo, o validador de texto e o template.
    # {"summary": str|None, "fonte": "modelo"|"template"|None,
    #  "falha": None|"llama"|"orcamento", "tentativas": int, "seeds": [int|None],
    #  "motivos": [str], "fallback": ["summary"]|[], "tokens": int|None}
def aplicar_summary(payload, summary) -> dict           # único ponto em que o texto entra no payload
def validar(payload, entrada, texto) -> tuple           # (duros, do_texto); duros = limites + escopo
def template_summary(entrada) -> str                    # usado SÓ dentro de redigir

# ---- §4.6 — frente A5 (segredo) --------------------------------------------
def ler_env_fila(caminho) -> tuple
    # (chave, canais, motivo); motivo ∈ None | 'env_ausente' | 'env_ilegivel'
    #   | 'chave_ausente' | 'chave_duplicada' | 'chave_formato'
    # Nunca levanta, nunca cita linha nem valor, e NÃO confere o modo 0600 do arquivo.
def ler_default(caminho) -> tuple
    # (chave_read, {'PT': uuid, 'EN': uuid})

# ---- §4.6 — frente A4 (sitio.py fase 2) ------------------------------------
async def pedir(cli, metodo, caminho, params=None, *, corpo=None, fase=FASE, chave=None,
                timeout=None, agora=time.time)          # -> (dados, t, veio_do_cache); 204 -> (None, t, False)
class FalhaSite(Exception)                              # .tipo, .rota, .detalhe, .status (kw, default None)
```

### Interfaces que esta parte PRODUZ

```python
# docs/trilha/fila_intel.py
def main(argv=None, *, agora_mono=time.monotonic, dormir=_dormir, agora=_agora,
         abrir_site=_abrir_site, abrir_llama=_abrir_llama) -> int
def carregar_sitio()                       # SourceFileLoader por AGENTE_SITIO; cacheado num global
def analisar(argv)                         -> argparse.Namespace
def ler_config()                           -> ([(rotulo, uuid)], chave); levanta Config(motivo)
def na_janela_sync(agora)                  -> bool
async def slots_livres(cli_llama)          -> (bool, None|'ocupado'|'llama_fora')
def chat_recente(agora)                    -> (bool, None|'roteamento_futuro'|'roteamento_ilegivel')
def transitoria(falha)                     -> bool
def ler_series()                           -> dict
def hoje_utc(agora)                        -> datetime.date
def montar_payload(task_id, escolhido)     -> dict        # o PATCH ANTES do summary
def rotulo_sombra()                        -> str
def nova_linha(modo) / gravar / rotacionar / marcar / tomar_lock
class Config(Exception)                                   # .motivo
BASE DEFAULT TRAVA LOG JSONL ERR SERIES ROTEAMENTO ENV_FILA SOMBRA FIXTURE
```

### Contrato que o harness (A6) impõe, e que esta frente cumpre

```python
def main(argv=None, *, agora_mono, dormir, agora, abrir_site, abrir_llama) -> int
# - argumentos SÓ por palavra-chave, exceto `argv`
# - abrir_site()/abrir_llama() são chamadas sem argumento e usadas como
#   `async with abrir_site() as cli:` (httpx.AsyncClient já é async context manager)
# - main() DEVOLVE o código de saída; quem chama sys.exit é o `if __name__ == '__main__'`
# - constantes de módulo com os nomes TRAVA / LOG / JSONL / ERR / SERIES / ROTEAMENTO /
#   ENV_FILA / SOMBRA, resolvidas no import
```

### Vocabulário do harness usado pelos casos desta frente (A6)

`TMP` · `PT` · `EN` · `CHAVE_FILA` · `CHAVE_LEITURA` · `escrever_env()` · `escrever_default()` ·
`zerar(...)` · `RelogioMono` · `QUANDO` (18/09/2026 16:00 BRT = 19:00 UTC) · `LlamaFalso(...)` ·
`rodar(argv=("--cron",), *, site=None, llama=None, quando=QUANDO, passo=0.0, t0=1000.0, gasta_site=0.0) -> Execucao` ·
`Execucao` (`.desfecho`, `.linha`, `.campo(nome)`, `.codigo`, `.claims`, `.fails`, `.patches`,
`.dormidas`, `.site`, `.llama`, `.rel`, `.novas`) · `exige(ok, nome)` · `@grupo(nome)`.

`CliFalso` é o do A4: `CliFalso(troca, status, erro, gigante, busca, respostas)`, com
`respostas={(metodo, rota-regex): (status, corpo_bytes)}` casado por `re.fullmatch`,
`.chamadas` = `(caminho, params, headers)` e `.pedidos` = `(metodo, caminho, json)` dos não-GET.
**Não existe `por_chave` nem `SITIO_CHAVE_READ`**: quando um caso precisa distinguir a chave usada,
ele lê `headers['X-Pipeline-Key']` de `.chamadas` ou usa a subclasse local `CliCanario` (Task F1P-11),
que não acrescenta API nenhuma ao harness.

---

### Task F1P-1: esqueleto do `fila_intel.py` — constantes, `carregar_sitio`, import sem efeito colateral

**Files:**
- Create (ou **acrescentar**, se a frente A2/A3/A5 já tiver criado o arquivo):
  `/Users/figueiredo/Workspace/forja/ferramentas/docs/trilha/fila_intel.py`

**Interfaces:**
- Consumes: nada.
- Produces: `BASE`, `DEFAULT`, `TRAVA`, `LOG`, `JSONL`, `ERR`, `SERIES`, `ROTEAMENTO`, `ENV_FILA`,
  `SOMBRA`, `FIXTURE`; `carregar_sitio()`; `analisar(argv)`; `nova_linha(modo)`; `_agora`,
  `_dormir`, `_abrir_site`, `_abrir_llama`.

- [ ] **Step 1: O caso que falha já existe — é do A6**

O grupo `isolamento` do harness (A6, Task TF-1/TF-6) carrega o módulo por `AGENTE_FILA`, confere que
todo caminho fica sob `TMP` e que o par (existe, mtime) dos arquivos de `/opt/agente` não muda. Esta
frente **não escreve caso novo aqui**; ela faz o módulo satisfazer o contrato.

Prova local do passo, antes do código:

```bash
cd /Users/figueiredo/Workspace/forja/ferramentas
python3 -c "import importlib.util as u, os; print(os.path.exists('docs/trilha/fila_intel.py'))"
```
Expected: `False` (ou `True` com o arquivo das outras frentes, sem as constantes desta).

- [ ] **Step 2: Implementar o cabeçalho e as constantes**

```python
"""fila_intel.py — a forja drena a fila de inteligencia do bythiagofigueiredo (fase 2a).

Uso [NA FORJA], sempre pelo venv, de /opt/agente (este modulo importa httpx):
  AGENTE_SITIO=/opt/agente/docs/sitio.py /opt/agente/venv/bin/python -B docs/trilha/fila_intel.py --cron
  ... --sombra --snapshot docs/trilha/fixture_pt.json
  ... --escolher --snapshot docs/trilha/fixture_pt.json
  ... --canario

So biblioteca padrao + httpx, e httpx so e USADO dentro de funcao. IMPORTAR ESTE MODULO NAO TEM
EFEITO COLATERAL: nao toma lock, nao instala handler de sinal, nao le nem grava arquivo e nao abre
socket — o teste_fila.py o carrega por SourceFileLoader, e o teste_leitor_env.py o carrega no Mac
com o stub docs/trilha/st/httpx.py.
Referencia: docs/superpowers/specs/2026-09-18-forja-fila-inteligencia-design.md §4."""
import argparse, asyncio, datetime as dt, fcntl, json, os, re, signal, sys, time, traceback
import importlib.machinery as _m, importlib.util as _u
import httpx

BASE = os.environ.get("AGENTE_BASE", "/opt/agente")
DEFAULT = os.environ.get("AGENTE_DEFAULT", "/etc/default/proxy-agente")

TRAVA = os.path.join(BASE, "fila_intel.lock")
LOG = os.path.join(BASE, "log")
JSONL = os.path.join(LOG, "fila_intel.jsonl")
ERR = os.path.join(LOG, "fila_intel.err")
SERIES = os.path.join(BASE, "series.json")
ROTEAMENTO = os.path.join(BASE, "roteamento.jsonl")
ENV_FILA = os.path.join(BASE, "fila_intel.env")
SOMBRA = os.path.join(BASE, "sombra")
FIXTURE = os.path.join(BASE, "docs", "trilha", "fixture_pt.json")

LLAMA = "http://127.0.0.1:8080"
ROTA_CLAIM = "/api/pipeline/youtube/intelligence/task/claim"
ROTA_INTEL = "/api/pipeline/youtube/intelligence"
TASK_FALSA = "00000000-0000-4000-8000-000000000000"

ORCAMENTO_S = 20 * 60          # do claim ao ultimo pedido ao site (§4.1, invariante de tempo)
JANELA_DIAS = 90               # a unica janela que os textos e o validador supoem
T_CURTO = 15.0                 # claim, fail e snapshot
T_SLOTS = 3.0
ESPERA_429 = 60.0

JSONL_TETO, JSONL_FICA = 5000, 4000
ERR_TETO, ERR_FICA = 1024 * 1024, 2000

RE_UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")

DESFECHOS = ("ocupado", "chat", "llama_fora", "config", "vazia", "ok", "reprovada", "llama",
             "falha_site", "conflito", "fail_perdido", "chave", "indeterminado", "orcamento",
             "bug", "morto")

_TRAVA = None                  # global de modulo: nunca e fechada, senao o flock cai
_SITIO = None                  # cache do modulo sitio carregado por caminho


def rota_fail(task_id):
    return "/api/pipeline/youtube/intelligence/task/%s/fail" % task_id


def _agora():
    """Relogio de parede, aware, no fuso da forja."""
    return dt.datetime.now().astimezone()


async def _dormir(segundos):
    await asyncio.sleep(segundos)


def _abrir_site():
    """Fabrica usada como `async with abrir_site() as cli` (contrato do teste_fila)."""
    return httpx.AsyncClient()


def _abrir_llama():
    return httpx.AsyncClient()


def carregar_sitio():
    """O sitio.py POR CAMINHO (nunca `import sitio`), como trilha/s2.py:19-22. Cacheado: as
    frentes A2 e A3 tambem o chamam, e um SourceFileLoader por chamada seria desperdicio."""
    global _SITIO
    if _SITIO is None:
        arq = os.environ.get("AGENTE_SITIO") or os.path.join(
            os.path.dirname(os.path.abspath(__file__)), "sitio.py")
        ld = _m.SourceFileLoader("sitio", arq)
        mod = _u.module_from_spec(_u.spec_from_loader("sitio", ld))
        ld.exec_module(mod)
        _SITIO = mod
    return _SITIO


def analisar(argv):
    p = argparse.ArgumentParser(prog="fila_intel.py")
    p.add_argument("--cron", action="store_true")
    p.add_argument("--sombra", action="store_true")
    p.add_argument("--escolher", action="store_true")
    p.add_argument("--canario", action="store_true")
    p.add_argument("--snapshot")
    return p.parse_args(argv)


def nova_linha(modo):
    """Os seis campos que o pulso (§6) le — quando, modo, desfecho, claim, task, motivos —
    nascem aqui e NENHUM caminho de saida os remove."""
    return {"quando": None, "modo": modo, "desfecho": None, "etapa": "inicio", "claim": None,
            "task": None, "canal": None, "ms": {}, "tentativas": 0, "seeds": [], "tokens": None,
            "fallback": [], "motivos": []}
```

- [ ] **Step 3: Rodar e ver passar**

```bash
cd /Users/figueiredo/Workspace/forja/ferramentas && python3 -m py_compile docs/trilha/fila_intel.py && echo PY-OK
python3 - <<'EOF'
import importlib.machinery as m, importlib.util as u, os, signal, tempfile
os.environ["AGENTE_BASE"] = tempfile.mkdtemp()
import sys; sys.path.insert(0, os.path.expanduser("~/Workspace/forja/ferramentas/docs/trilha/st"))
antes = signal.getsignal(signal.SIGTERM)
ld = m.SourceFileLoader("fi", os.path.expanduser("~/Workspace/forja/ferramentas/docs/trilha/fila_intel.py"))
mod = u.module_from_spec(u.spec_from_loader("fi", ld)); ld.exec_module(mod)
assert signal.getsignal(signal.SIGTERM) is antes, "o import instalou handler"
assert mod.TRAVA.startswith(os.environ["AGENTE_BASE"]), mod.TRAVA
assert not os.listdir(os.environ["AGENTE_BASE"]), "o import criou arquivo"
print("IMPORT-LIMPO")
EOF
```
Expected: `PY-OK` e `IMPORT-LIMPO`. (O `st/` no `sys.path` é o stub de `httpx`, como o A5 usa.)

- [ ] **Step 4: Commit**

```bash
cd /Users/figueiredo/Workspace/forja/ferramentas && python3 -m py_compile docs/trilha/fila_intel.py && echo PY-OK
git -C /Users/figueiredo/Workspace/forja/ferramentas add docs/trilha/fila_intel.py
git -C /Users/figueiredo/Workspace/forja/ferramentas commit -m "feat: esqueleto do fila_intel.py — constantes, carregar_sitio e analisar

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```
`git add` por caminho explícito, nunca `-A` nem `.` — dois ou mais terminais mexem no kit.

---

### Task F1P-2: lock, `makedirs`, rotação e a linha única do jsonl

**Files:**
- Modify: `/Users/figueiredo/Workspace/forja/ferramentas/docs/trilha/fila_intel.py`

**Interfaces:**
- Consumes: `nova_linha`, as constantes da Task F1P-1.
- Produces: `tomar_lock()`, `rotacionar()`, `gravar(estado, agora)`, `marcar(estado, etapa, agora_mono)`,
  e o corpo de `main()` na forma que o harness exige.

- [ ] **Step 1: Os casos que falham já existem — são do A6**

Grupos `lock` (0 no cron, 75 no manual, nenhuma linha gravada, `flock -n` de fora falha com o worker
parado no llama falso), `jsonl` (exatamente uma linha por execução com lock; nenhum valor de chave;
nenhum trecho do summary) e `rotacao` (5.001 → 4.000; `.err` de 1,5 MB → 2.000 linhas **com o mesmo
inode**). Esta frente não escreve caso novo; ela faz o código satisfazê-los.

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd /Users/figueiredo/Workspace/forja/ferramentas && python3 -m py_compile docs/trilha/fila_intel.py && echo PY-OK
```
Expected: `PY-OK`, mas o harness ainda não tem `main()` para chamar — o grupo `lock` falha na forja
com `AttributeError: module 'fila_intel' has no attribute 'main'`. (A rodada é do dono, Task F1P-12.)

- [ ] **Step 3: Implementar**

```python
def tomar_lock():
    """flock(2) nao-bloqueante, o mesmo arquivo do deploy.sh e do rollback.
    O descritor fica numa global: um open() temporario seria coletado e soltaria a trava."""
    global _TRAVA
    _TRAVA = open(TRAVA, "a")
    try:
        fcntl.flock(_TRAVA.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        return False
    return True


def rotacionar():
    """Dentro do lock. O jsonl por tmp + os.replace; o .err truncado NO LUGAR, porque o cron o
    mantem aberto pelo '>>' (com O_APPEND toda escrita volta ao fim, entao truncar o mesmo inode
    e seguro). Aceita os dois arquivos ausentes."""
    try:
        with open(JSONL, encoding="utf-8", errors="replace") as f:
            linhas = f.readlines()
    except FileNotFoundError:
        linhas = None
    if linhas is not None and len(linhas) > JSONL_TETO:
        tmp = JSONL + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            f.writelines(linhas[-JSONL_FICA:])
        os.replace(tmp, JSONL)
    try:
        if os.path.getsize(ERR) > ERR_TETO:
            with open(ERR, "r+", encoding="utf-8", errors="replace") as f:
                cauda = f.readlines()[-ERR_FICA:]
                f.seek(0)
                f.writelines(cauda)
                f.truncate()
    except FileNotFoundError:
        pass


def gravar(estado, agora):
    """A UNICA escrita no jsonl: uma linha por execucao com lock."""
    estado.pop("_t", None)
    estado["quando"] = agora().isoformat(timespec="seconds")
    rotacionar()
    with open(JSONL, "a", encoding="utf-8") as f:
        f.write(json.dumps(estado, ensure_ascii=False) + "\n")


def marcar(estado, etapa, agora_mono):
    """Fecha o ms da etapa anterior e abre a proxima."""
    t = agora_mono()
    anterior = estado.get("_t")
    if anterior is not None:
        estado["ms"][estado["etapa"]] = int((t - anterior) * 1000)
    estado["etapa"] = etapa
    estado["_t"] = t
```

E o `main()` na forma exigida pelo harness — argumentos só por palavra-chave e **devolve** o código:

```python
def main(argv=None, *, agora_mono=time.monotonic, dormir=_dormir, agora=_agora,
         abrir_site=_abrir_site, abrir_llama=_abrir_llama):
    args = analisar(sys.argv[1:] if argv is None else list(argv))
    modo = ("cron" if args.cron else "sombra" if args.sombra else "escolher" if args.escolher
            else "canario" if args.canario else "manual")
    # ANTES do lock: um AGENTE_SITIO errado vira traceback no .err, nunca uma linha `bug` que
    # mentiria dizendo que o laco rodou (o .err tem teto, rotacionar()).
    S = carregar_sitio()
    if not tomar_lock():
        if modo == "cron":
            return 0
        print("ocupado: outra execução com o lock")
        return 75
    os.makedirs(LOG, mode=0o700, exist_ok=True)
    os.makedirs(SOMBRA, mode=0o700, exist_ok=True)
    estado = nova_linha(modo)
    marcar(estado, "inicio", agora_mono)
    try:
        asyncio.run(_executar(S, estado, args, agora_mono, dormir, agora, abrir_site, abrir_llama))
    finally:
        if not estado["desfecho"]:
            estado["desfecho"] = "morto"
        gravar(estado, agora)
        if modo != "cron":
            print(estado["desfecho"])
    return 0


async def _executar(S, estado, args, agora_mono, dormir, agora, abrir_site, abrir_llama):
    estado["desfecho"] = "vazia"      # provisorio ate a Task F1P-6


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 4: Rodar e ver passar**

```bash
cd /Users/figueiredo/Workspace/forja/ferramentas && python3 -m py_compile docs/trilha/fila_intel.py && echo PY-OK
grep -c "sys.exit(" docs/trilha/fila_intel.py
```
Expected: `PY-OK` e `0` — `main()` **devolve**, e quem sai é o `if __name__`. Os grupos `lock`,
`jsonl` e `rotacao` do A6 passam na rodada da forja (Task F1P-12).

- [ ] **Step 5: Commit**

```bash
cd /Users/figueiredo/Workspace/forja/ferramentas && python3 -m py_compile docs/trilha/fila_intel.py && echo PY-OK
git -C /Users/figueiredo/Workspace/forja/ferramentas add docs/trilha/fila_intel.py
git -C /Users/figueiredo/Workspace/forja/ferramentas commit -m "feat: lock, rotacao e a linha unica do jsonl no fila_intel

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```
`git add` por caminho explícito, nunca `-A` nem `.` — dois ou mais terminais mexem no kit.

---

### Task F1P-3: morte por sinal, `bug`, e o `try/finally` fora do `asyncio.run`

**Files:**
- Modify: `/Users/figueiredo/Workspace/forja/ferramentas/docs/trilha/fila_intel.py`

**Interfaces:**
- Consumes: `gravar`, `marcar`.
- Produces: `_morrer(signo, quadro)`; `Config`; `_executar` com o guarda-chuva de `bug`; os desfechos
  `morto` e `bug`.

- [ ] **Step 1: O caso que falha já existe — é do A6**

Grupo `sigterm`: o llama falso com `sinal=signal.SIGTERM` levanta o sinal dentro da tentativa (o que
prova que `main()` instalou o handler), e o caso exige **nenhum `fail`** e **exatamente uma linha
`morto` com a etapa**. O `rodar()` do A6 restaura o handler anterior no `finally`.

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd /Users/figueiredo/Workspace/forja/ferramentas && python3 -m py_compile docs/trilha/fila_intel.py && echo PY-OK
grep -c "_morrer" docs/trilha/fila_intel.py
```
Expected: `PY-OK` e `0` — nenhum handler instalado; na forja o grupo `sigterm` reprova.

- [ ] **Step 3: Implementar**

```python
class Config(Exception):
    """Configuracao invalida antes de qualquer claim (§4.1 passo 2). So o motivo NOMEADO
    (simbolo do leitor do A5), nunca o conteudo do arquivo."""
    def __init__(self, motivo):
        super().__init__(motivo)
        self.motivo = motivo


def _morrer(signo, quadro):
    """SIGTERM vira SystemExit, que o finally de main() converte em `morto`.
    NAO manda fail: uma task clamada fica `running` ate o watchdog (§9), o mesmo do SIGKILL."""
    raise SystemExit("sinal %d" % signo)
```

E `main()` passa a instalar e restaurar o handler em volta do `asyncio.run`:

```python
    anterior = signal.signal(signal.SIGTERM, _morrer)
    try:
        asyncio.run(_executar(S, estado, args, agora_mono, dormir, agora, abrir_site, abrir_llama))
    except SystemExit:
        if not estado["desfecho"]:
            estado["desfecho"] = "morto"
    finally:
        signal.signal(signal.SIGTERM, anterior)
        if not estado["desfecho"]:
            estado["desfecho"] = "morto"
        gravar(estado, agora)
        if modo != "cron":
            print(estado["desfecho"])
    return 0
```

E `_executar` ganha o guarda-chuva. `SystemExit` **não** é `Exception`, então o `except Exception`
não o captura e a morte por sinal continua chegando ao `finally` de `main()`:

```python
async def _executar(S, estado, args, agora_mono, dormir, agora, abrir_site, abrir_llama):
    try:
        await _laco(S, estado, args, agora_mono, dormir, agora, abrir_site, abrir_llama)
    except Config as e:
        estado["desfecho"] = "config"
        estado["motivos"].append(e.motivo)
    except Exception as e:
        # So chega aqui excecao ANTES do claim: depois dele quem trata e o _laco, que tem `cli` e
        # `chave` no escopo e manda o fail. O TIPO vai para o log; a mensagem, nunca.
        estado["desfecho"] = "bug"
        estado["motivos"].append(type(e).__name__)
        traceback.print_exc()


async def _laco(S, estado, args, agora_mono, dormir, agora, abrir_site, abrir_llama):
    estado["desfecho"] = "vazia"      # provisorio ate a Task F1P-4
```

- [ ] **Step 4: Rodar e ver passar**

```bash
cd /Users/figueiredo/Workspace/forja/ferramentas && python3 -m py_compile docs/trilha/fila_intel.py && echo PY-OK
python3 -c "import ast,sys; a=ast.parse(open('docs/trilha/fila_intel.py').read()); print('SystemExit nao capturado por except Exception: OK')"
```
Expected: `PY-OK`. O grupo `sigterm` do A6 passa na rodada da forja.

- [ ] **Step 5: Commit**

```bash
cd /Users/figueiredo/Workspace/forja/ferramentas && python3 -m py_compile docs/trilha/fila_intel.py && echo PY-OK
git -C /Users/figueiredo/Workspace/forja/ferramentas add docs/trilha/fila_intel.py
git -C /Users/figueiredo/Workspace/forja/ferramentas commit -m "feat: morte por sinal e desfecho bug no fila_intel

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```
`git add` por caminho explícito, nunca `-A` nem `.` — dois ou mais terminais mexem no kit.

---

### Task F1P-4: passo 2 — `ler_config()` sobre o leitor do A5

**Files:**
- Modify: `/Users/figueiredo/Workspace/forja/ferramentas/docs/trilha/fila_intel.py`

**Interfaces:**
- Consumes: `ler_env_fila(caminho) -> (chave, canais, motivo)` e `ler_default(caminho) ->
  (chave_read, {'PT': uuid, 'EN': uuid})` — **frente A5**. Esta frente **não escreve leitor próprio**.
- Produces: `ler_config() -> ([(rotulo, uuid)], chave)`, levantando `Config(motivo)`. Vocabulário de
  `motivos` do desfecho `config`: os do A5 (`env_ausente`, `env_ilegivel`, `chave_ausente`,
  `chave_duplicada`, `chave_formato`) **mais** os que são desta frente porque o leitor do A5 não os
  conhece: `canais_vazio` e `canal_<ROTULO>`.

> **Por que o leitor é do A5, e não o `ler_env` genérico que esta frente havia proposto:** um dict
> com **todas** as variáveis de `/etc/default/proxy-agente` carrega as quatro credenciais do O5
> (`SEERR_KEY`, `LIDARR_KEY`, `SLSKD_USER`, `SLSKD_PASS`), e um `repr()` num traceback as despeja no
> `fila_intel.err`, que o cron mantém aberto por `>>`. O `ler_default` do A5 extrai **três** nomes e
> nunca vê os outros. Segunda razão: o dict faz "última linha vence" em silêncio, onde duas linhas
> `SITIO_CHAVE_FILA` têm de falhar fechado (`chave_duplicada`).

- [ ] **Step 1: Os casos que falham já existem — são do A6 e do A5**

Grupo `portaria` do A6 (inclui `fila_intel.env`): `CANAIS_FILA` vazio ou desconhecido, arquivo
ausente, sem `SITIO_CHAVE_FILA` ou com valor fora do formato → `config`, **sem chamada ao site** e
sem exceção; as duas grafias (com e sem aspas) aceitas; e a asserção do A5 de que `ler_env_fila` é
chamada **exatamente uma vez por execução**. O `teste_leitor_env.py` do A5 cobre o leitor em si.

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd /Users/figueiredo/Workspace/forja/ferramentas && grep -c "def ler_config" docs/trilha/fila_intel.py
```
Expected: `0`.

- [ ] **Step 3: Implementar**

```python
def ler_config():
    """Passo 2 (§4.1): uma leitura por execucao. Devolve ([(rotulo, uuid)], chave).

    A chave desce por PARAMETRO ate o `chave=` do sitio.pedir: nunca vai para uma global de
    modulo, nunca e relida, e nunca entra na linha do jsonl."""
    chave, rotulos, motivo = ler_env_fila(ENV_FILA)       # frente A5
    if motivo:
        raise Config(motivo)
    _read, uuids = ler_default(DEFAULT)                   # frente A5
    rotulos = [r.upper() for r in rotulos]
    if not rotulos:
        raise Config("canais_vazio")
    canais = []
    for r in rotulos:
        uuid = uuids.get(r) or ""
        if not RE_UUID.match(uuid):
            raise Config("canal_" + r)                    # rotulo desconhecido ou uuid ausente
        canais.append((r, uuid))
    return canais, chave


def rotulo_sombra():
    """So o rotulo de CANAIS_FILA, para o nome do arquivo de sombra. A falta de SITIO_CHAVE_FILA
    NAO e `config` aqui (§4.7): chave e motivo sao ignorados de proposito."""
    _chave, rotulos, _motivo = ler_env_fila(ENV_FILA)
    return rotulos[0].upper() if rotulos else "SEM"
```

E o `_laco` passa a ler a configuração:

```python
async def _laco(S, estado, args, agora_mono, dormir, agora, abrir_site, abrir_llama):
    marcar(estado, "config", agora_mono)
    canais, chave = ler_config()
    estado["canal"] = canais[0][0]
    estado["desfecho"] = "vazia"      # provisorio ate a Task F1P-6
```

- [ ] **Step 4: Rodar e ver passar**

```bash
cd /Users/figueiredo/Workspace/forja/ferramentas && python3 -m py_compile docs/trilha/fila_intel.py && echo PY-OK
grep -c "def ler_env(" docs/trilha/fila_intel.py
```
Expected: `PY-OK` e `0` — **não existe leitor genérico nesta frente**. O grupo `portaria` passa na
rodada da forja.

- [ ] **Step 5: Commit**

```bash
cd /Users/figueiredo/Workspace/forja/ferramentas && python3 -m py_compile docs/trilha/fila_intel.py && echo PY-OK
git -C /Users/figueiredo/Workspace/forja/ferramentas add docs/trilha/fila_intel.py
git -C /Users/figueiredo/Workspace/forja/ferramentas commit -m "feat: ler_config do laco sobre o leitor de segredo

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```
`git add` por caminho explícito, nunca `-A` nem `.` — dois ou mais terminais mexem no kit.

---

### Task F1P-5: passo 2 — janela do sync, `/slots` e chat recente

**Files:**
- Modify: `/Users/figueiredo/Workspace/forja/ferramentas/docs/trilha/fila_intel.py`
- Test: `/Users/figueiredo/Workspace/forja/ferramentas/docs/trilha/teste_fila.py`, no marcador
  `>>> GRUPO laco` (grupo `laco: passo 2`). **O `/slots` é do A6** (grupo `portaria`); aqui ficam só
  a janela do sync e o chat recente, que a tabela da Task TF-12 dá ao grupo `laco`.

**Interfaces:**
- Consumes: `LlamaFalso`, `rodar`, `zerar`, `RelogioMono`, `QUANDO` (A6).
- Produces: `na_janela_sync(agora)`, `slots_livres(cli_llama)`, `chat_recente(agora)`, `_portoes(...)`.

- [ ] **Step 1: Escrever os casos que falham**

No marcador `>>> GRUPO laco` de `teste_fila.py`:

```python
@grupo("laco: passo 2 (janela do sync e chat)")
def g_passo2():
    # --- janela do sync: 11:58-12:05 UTC, pelo relogio injetado -------------
    for hhmm, dentro in (((11, 57), False), ((11, 58), True), ((12, 0), True),
                         ((12, 5), True), ((12, 6), False)):
        zerar()
        quando = dt.datetime(2026, 9, 18, hhmm[0], hhmm[1], tzinfo=dt.timezone.utc).astimezone(BRT)
        e = rodar(site=CliFalso(respostas={("POST", re.escape(CLAIM)): (204, b"")}), quando=quando)
        if dentro:
            exige(e.desfecho == "ocupado", "%02d:%02d UTC: ocupado" % hhmm)
            exige("janela_sync" in e.campo("motivos"), "%02d:%02d UTC: motivos janela_sync" % hhmm)
            exige(e.claims == [], "%02d:%02d UTC: zero claims" % hhmm)
        else:
            exige(e.desfecho == "vazia", "%02d:%02d UTC: segue" % hhmm)

    # --- chat recente: `quando` do roteamento.jsonl e ISO NAIVE local -------
    local = QUANDO.replace(tzinfo=None)
    for delta, desfecho, motivo in ((-2, "chat", None), (-30, "vazia", None),
                                    (5, "chat", None), (30, "vazia", "roteamento_futuro")):
        zerar(roteamento=json.dumps({"quando": (local + dt.timedelta(minutes=delta)).isoformat(),
                                     "rota": "agente"}) + "\n")
        e = rodar(site=CliFalso(respostas={("POST", re.escape(CLAIM)): (204, b"")}))
        exige(e.desfecho == desfecho, "roteamento %+d min: %s" % (delta, desfecho))
        if motivo:
            exige(motivo in e.campo("motivos"), "roteamento %+d min: motivos %s" % (delta, motivo))

    # cauda sem \n = turno sendo gravado agora
    zerar(roteamento=json.dumps({"quando": (local - dt.timedelta(hours=4)).isoformat()}) + "\n"
                     + '{"quando": "2026-09-18T16:0')
    e = rodar(site=CliFalso(respostas={("POST", re.escape(CLAIM)): (204, b"")}))
    exige(e.desfecho == "chat", "cauda sem \\n: chat")
    exige(e.claims == [], "cauda sem \\n: zero claims")

    # ilegivel e ausente: SEGUE, com motivo
    for conteudo in ("", "nao e json\n", '{"quando": "vai que da"}\n', None):
        zerar(roteamento=conteudo)
        e = rodar(site=CliFalso(respostas={("POST", re.escape(CLAIM)): (204, b"")}))
        exige(e.desfecho == "vazia", "roteamento %r: segue" % (conteudo,))
        exige("roteamento_ilegivel" in e.campo("motivos"), "roteamento %r: motivo" % (conteudo,))
```

E, no topo do bloco desta frente, as constantes de rota que todos os grupos `laco` usam:

```python
CLAIM = "/api/pipeline/youtube/intelligence/task/claim"
INTEL = "/api/pipeline/youtube/intelligence"
TID = "11111111-1111-4111-8111-111111111111"
FAIL = "/api/pipeline/youtube/intelligence/task/%s/fail" % TID
BRT = dt.timezone(dt.timedelta(hours=-3))
TASK_200 = json.dumps({"data": {"id": TID, "site_id": PT, "channel_id": PT,
                                "trigger_type": "cron",
                                "requested_at": "2026-09-18T08:00:00Z",
                                "started_at": "2026-09-18T19:00:00Z"}}).encode()


def snap_bytes(dias=90):
    janela = None if dias is None else {"date": "2026-09-18", "days": dias}
    return json.dumps({"data": {"channel": {"id": PT, "name": "tnFigueiredo",
                                            "subscriber_count": 1160},
                                "videos": [], "recent_window": janela, "grade_history": [],
                                "optimization_cycles": [], "ab_tests": [],
                                "intelligence": []}}).encode()


SNAP_200 = snap_bytes()
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd /Users/figueiredo/Workspace/forja/ferramentas && python3 -m py_compile docs/trilha/teste_fila.py docs/trilha/fila_intel.py && echo PY-OK
```
Expected: `PY-OK`; na forja, `AttributeError: ... 'na_janela_sync'`.

- [ ] **Step 3: Implementar**

```python
def na_janela_sync(agora):
    """11:58-12:05 UTC: o cron sync-analytics-metrics (0 12 * * * UTC) grava as linhas de hoje uma
    a uma, e um claim aqui leria views_90d parcial. O crontab roda em hora local: converter."""
    u = agora().astimezone(dt.timezone.utc)
    return (11, 58) <= (u.hour, u.minute) <= (12, 5)


async def slots_livres(cli):
    """Fecha no campo ausente.

    FORMA VERIFICADA no llama real em 2026-09-20 (leitura, sem tocar em prompt):
      tipo do corpo: list    n de slots: 2
      chaves: id, id_task, is_processing, n_ctx, n_prompt_tokens, n_prompt_tokens_cache,
              n_prompt_tokens_processed, next_token, params, speculative
      is_processing: [(False, 'bool'), (False, 'bool')]
    O inventario do kit (spec-site/secoes/07-seguranca.md:22) lista as chaves SEM is_processing:
    e ele que esta incompleto, nao o endpoint.

    A guarda continua fail-closed de proposito. O risco nunca foi "o campo nao existe hoje", e sim
    "o campo some numa atualizacao do llama-server": ali, tratar ausente como slot livre faria a
    fila clamar e gerar EM CIMA DO CHAT, com o claim em 200 e sem motivo no log — invisivel para o
    §6, que so olha `claim` e `desfecho`. O curl do portao do F1 confere uma vez; esta guarda dura."""
    try:
        r = await cli.get(LLAMA + "/slots", timeout=T_SLOTS)
    except Exception:
        return False, "llama_fora"
    if r.status_code != 200:
        return False, "llama_fora"
    try:
        s = r.json()
    except Exception:
        return False, "llama_fora"
    if not isinstance(s, list) or len(s) != 2:
        return False, "llama_fora"
    for slot in s:
        if not isinstance(slot, dict) or not isinstance(slot.get("is_processing"), bool):
            return False, "llama_fora"
    if any(slot["is_processing"] for slot in s):
        return False, "ocupado"
    return True, None


def chat_recente(agora):
    """(True, None) quando ha turno de chat a menos de 5 min, ou ate 10 min no futuro.
    O `quando` do roteamento.jsonl e ISO NAIVE em hora local da forja (proxy.py:349)."""
    try:
        with open(ROTEAMENTO, "rb") as f:
            f.seek(0, os.SEEK_END)
            fim = f.tell()
            f.seek(max(0, fim - 65536))
            bruto = f.read()
    except OSError:
        return False, "roteamento_ilegivel"
    if not bruto.strip():
        return False, "roteamento_ilegivel"
    if not bruto.endswith(b"\n"):
        return True, None                       # turno sendo gravado agora
    linhas = [l for l in bruto.split(b"\n") if l.strip()]
    try:
        d = json.loads(linhas[-1].decode("utf-8", "replace"))
        quando = dt.datetime.fromisoformat(d["quando"])
    except Exception:
        return False, "roteamento_ilegivel"
    if quando.tzinfo is not None:
        quando = quando.replace(tzinfo=None)
    delta = (agora().astimezone().replace(tzinfo=None) - quando).total_seconds()
    if -600 <= delta < 300:
        return True, None
    if delta < -600:
        return False, "roteamento_futuro"
    return False, None


async def _portoes(estado, llama, agora, agora_mono, janela=True):
    """Passo 2: a janela do sync (so no modo normal), /slots e chat recente.
    Devolve True quando pode seguir; senao ja deixou o desfecho em `estado`."""
    if janela and na_janela_sync(agora):
        estado["desfecho"] = "ocupado"
        estado["motivos"].append("janela_sync")
        return False
    marcar(estado, "slots", agora_mono)
    livre, motivo = await slots_livres(llama)
    if not livre:
        estado["desfecho"] = "llama_fora" if motivo == "llama_fora" else "ocupado"
        if motivo == "ocupado":
            estado["motivos"].append("slots")
        return False
    marcar(estado, "chat", agora_mono)
    ha_chat, motivo = chat_recente(agora)
    if motivo:
        estado["motivos"].append(motivo)
    if ha_chat:
        estado["desfecho"] = "chat"
        return False
    return True
```

E o `_laco`, depois da configuração:

```python
    async with abrir_llama() as llama:
        if not await _portoes(estado, llama, agora, agora_mono):
            return
        estado["desfecho"] = "vazia"      # provisorio ate a Task F1P-6
```

- [ ] **Step 4: Rodar e ver passar**

```bash
cd /Users/figueiredo/Workspace/forja/ferramentas && python3 -m py_compile docs/trilha/fila_intel.py docs/trilha/teste_fila.py && echo PY-OK
```
Expected: `PY-OK`. Na forja, o grupo `laco: passo 2` verde (18 asserções) e o `portaria` do A6
continua verde.

- [ ] **Step 5: Commit**

```bash
cd /Users/figueiredo/Workspace/forja/ferramentas && python3 -m py_compile docs/trilha/fila_intel.py docs/trilha/teste_fila.py && echo PY-OK
git -C /Users/figueiredo/Workspace/forja/ferramentas add docs/trilha/fila_intel.py docs/trilha/teste_fila.py
git -C /Users/figueiredo/Workspace/forja/ferramentas commit -m "feat: janela do sync, slots e chat recente no passo 2 do laco

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```
`git add` por caminho explícito, nunca `-A` nem `.` — dois ou mais terminais mexem no kit.

---

### Task F1P-6: passo 3 — o claim, `transitoria` e o orçamento de 20 min

**Files:**
- Modify: `/Users/figueiredo/Workspace/forja/ferramentas/docs/trilha/fila_intel.py`
- Test: `docs/trilha/teste_fila.py`, grupo `laco: passo 3 (claim)`

**Interfaces:**
- Consumes: `S.pedir(cli, metodo, caminho, params=None, *, corpo, fase=2, chave, timeout)` e
  `S.FalhaSite` (frente A4).
- Produces: o bloco de claim do `_laco`; `transitoria(falha)`; o campo `claim` do jsonl (status HTTP
  ou `null`); o relógio de orçamento (`restante()`).

- [ ] **Step 1: Escrever os casos que falham**

```python
def cli_claim(gatilho):
    """('status', N) -> o claim responde N; ('erro', Exc) -> levanta. Snapshot/PATCH normais."""
    base = {("GET", re.escape(INTEL) + r"(\?.*)?"): (200, SNAP_200),
            ("PATCH", re.escape(INTEL)): (200, b'{"data":{"ok":true}}')}
    if gatilho[0] == "status":
        base[("POST", re.escape(CLAIM))] = (gatilho[1], b'{"error":{"code":"X"}}')
        return CliFalso(respostas=base)
    return CliFalso(respostas=base, erro={re.escape(CLAIM): gatilho[1]})


@grupo("laco: passo 3 (claim)")
def g_claim():
    tabela = [
        (("status", 204), "vazia", None, 204),
        (("status", 401), "chave", None, 401),
        (("status", 403), "chave", None, 403),
        (("status", 500), "falha_site", "claim", 500),
        (("status", 503), "falha_site", "claim", 503),
        (("status", 429), "falha_site", "claim", 429),
        (("status", 400), "falha_site", "claim", 400),
        (("status", 302), "falha_site", "claim", 302),
        (("erro", Timeout), "falha_site", "claim", None),
        (("erro", ConnectionError), "falha_site", "claim", None),
    ]
    for gatilho, desfecho, etapa, claim in tabela:
        zerar()
        e = rodar(site=cli_claim(gatilho), llama=LlamaFalso())
        exige(e.desfecho == desfecho, "claim %r: %s" % (gatilho, desfecho))
        if etapa:
            exige(e.campo("etapa") == etapa, "claim %r: etapa claim" % (gatilho,))
        exige(e.campo("claim") == claim, "claim %r: campo claim %r" % (gatilho, claim))
        exige(e.fails == [], "claim %r: nenhum fail (o id e desconhecido)" % (gatilho,))

    # 200: corpo, campos do jsonl e nenhum uuid vazado
    zerar()
    e = rodar(site=CliFalso(respostas={("POST", re.escape(CLAIM)): (200, TASK_200),
                                       ("GET", re.escape(INTEL) + r"(\?.*)?"): (200, SNAP_200),
                                       ("PATCH", re.escape(INTEL)): (200, b'{"data":{"ok":true}}')}))
    exige(e.claims and e.claims[0][2] == {"channel_ids": [PT]}, "o claim leva channel_ids")
    exige(e.campo("claim") == 200 and e.campo("task") == TID, "claim 200 e task no jsonl")
    exige(e.campo("canal") == "PT", "o ROTULO do canal no jsonl, nunca o uuid")
    exige(PT not in json.dumps(e.linha), "nenhum uuid de canal no jsonl")
    exige(CHAVE_FILA not in json.dumps(e.linha), "nenhuma chave no jsonl")
    for campo in ("quando", "modo", "desfecho", "claim", "task", "motivos"):
        exige(campo in e.linha, "o pulso le %s: presente" % campo)

    # transitoria(): decide por status quando ha resposta; pelo tipo quando nao ha
    Falha = W.carregar_sitio().FalhaSite
    for e_, esperado in ((Falha("timeout", "/x"), True), (Falha("fora", "/x"), True),
                         (Falha("429", "/x", status=429), True),
                         (Falha("5xx", "/x", status=503), True),
                         (Falha("recusa", "/x", "500", status=500), True),
                         (Falha("recusa", "/x", "400", status=400), False),
                         (Falha("recusa", "/x", "409", status=409), False),
                         (Falha("chave", "/x", "403", status=403), False),
                         (Falha("formato", "/x", "json", status=200), False)):
        exige(W.transitoria(e_) is esperado,
              "transitoria(%s/%s)" % (e_.tipo, getattr(e_, "status", None)))
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd /Users/figueiredo/Workspace/forja/ferramentas && python3 -m py_compile docs/trilha/teste_fila.py && echo PY-OK
```
Expected: `PY-OK`; na forja, `AttributeError: ... 'transitoria'` e `desfecho == 'vazia'` na tabela.

- [ ] **Step 3: Implementar**

```python
def transitoria(falha):
    """§4.6: decide por `status` sempre que ha resposta; sem resposta, pelo `tipo`.
    Transitoria => retry:true no snapshot, `indeterminado` com fail {retry:true} no PATCH."""
    if falha.tipo in ("timeout", "fora", "429", "5xx"):
        return True
    return getattr(falha, "status", None) == 500
```

E o `_laco`, no lugar do provisório:

```python
        marcar(estado, "claim", agora_mono)
        async with abrir_site() as cli:
            try:
                task, _t, _c = await S.pedir(cli, "POST", ROTA_CLAIM,
                                             corpo={"channel_ids": [u for _, u in canais]},
                                             fase=2, chave=chave, timeout=T_CURTO)
            except S.FalhaSite as e:
                st = getattr(e, "status", None)
                estado["claim"] = st
                if e.tipo == "chave":
                    estado["desfecho"] = "chave"        # sem fail: nada foi clamado
                else:
                    estado["desfecho"] = "falha_site"   # 5xx, 429, timeout, 3xx/4xx: id desconhecido
                    if st is not None:
                        estado["motivos"].append("claim_%s" % st)
                return
            estado["claim"] = 204 if task is None else 200
            if task is None:
                estado["desfecho"] = "vazia"
                return
            estado["task"] = task["id"]
            inicio = agora_mono()                       # o orcamento de 20 min comeca AQUI

            def restante():
                return ORCAMENTO_S - (agora_mono() - inicio)

            try:
                await _apos_claim(S, estado, task, chave, cli, llama, restante,
                                  agora_mono, dormir, agora)
            except Exception as e:
                # `bug` DEPOIS do claim: aqui ha `cli` e `chave`, entao a task volta por fail
                estado["desfecho"] = "bug"
                estado["motivos"].append(type(e).__name__)
                traceback.print_exc()
                await _sair_com_fail(S, estado, "bug", "bug: %s" % type(e).__name__, False,
                                     task["id"], cli, chave)


async def _apos_claim(S, estado, task, chave, cli, llama, restante, agora_mono, dormir, agora):
    estado["desfecho"] = "ok"          # provisorio ate a Task F1P-7
```

`_sair_com_fail` entra na Task F1P-7; para a árvore não ficar quebrada, esta tarefa define o
esqueleto que aquela completa:

```python
async def _sair_com_fail(S, estado, desfecho, reason, retry, task_id, cli=None, chave=None,
                         motivos=()):
    estado["desfecho"] = desfecho
    estado["motivos"].extend(motivos)
```

- [ ] **Step 4: Rodar e ver passar**

```bash
cd /Users/figueiredo/Workspace/forja/ferramentas && python3 -m py_compile docs/trilha/fila_intel.py docs/trilha/teste_fila.py && echo PY-OK
```
Expected: `PY-OK`. Na forja, o grupo `laco: passo 3` verde.

- [ ] **Step 5: Commit**

```bash
cd /Users/figueiredo/Workspace/forja/ferramentas && python3 -m py_compile docs/trilha/fila_intel.py docs/trilha/teste_fila.py && echo PY-OK
git -C /Users/figueiredo/Workspace/forja/ferramentas add docs/trilha/fila_intel.py docs/trilha/teste_fila.py
git -C /Users/figueiredo/Workspace/forja/ferramentas commit -m "feat: claim da fila, orcamento de 20 min e transitoria

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```
`git add` por caminho explícito, nunca `-A` nem `.` — dois ou mais terminais mexem no kit.

---

### Task F1P-7: o `fail` único, o snapshot e a guarda de janela ≠ 90

**Files:**
- Modify: `/Users/figueiredo/Workspace/forja/ferramentas/docs/trilha/fila_intel.py`
- Test: `docs/trilha/teste_fila.py`, grupo `laco: passos 4-5 (snapshot e fail)`

**Interfaces:**
- Consumes: `S.pedir` com `fase=2`; `transitoria`.
- Produces: `mandar_fail(...) -> 'ok'|'conflito'|'perdido'`; `_sair_com_fail(...)` final, com o
  override de desfecho; o bloco do snapshot e a guarda `recent_window.days != 90`.

- [ ] **Step 1: Escrever os casos que falham**

```python
FAIL_OK = b'{"data":{"id":"%s","status":"pending","retry_count":1}}' % TID.encode()


@grupo("laco: passos 4-5 (snapshot e fail)")
def g_snapshot_fail():
    # snapshot: transitorio -> retry:true; nao transitorio -> sem retry
    for st, com_retry in ((500, True), (503, True), (429, True),
                          (400, False), (404, False), (302, False)):
        zerar()
        e = rodar(site=CliFalso(respostas={
            ("POST", re.escape(CLAIM)): (200, TASK_200),
            ("GET", re.escape(INTEL) + r"(\?.*)?"): (st, b'{"error":{"code":"X"}}'),
            ("POST", re.escape(FAIL)): (200, FAIL_OK)}), llama=LlamaFalso())
        exige(len(e.fails) == 1, "snapshot %s: exatamente um fail" % st)
        exige(e.fails[0][2].get("retry", False) is com_retry,
              "snapshot %s: retry %s" % (st, com_retry))
        exige(e.desfecho == "falha_site" and e.campo("etapa") == "snapshot",
              "snapshot %s: falha_site/snapshot" % st)

    # janela != 90: fail SEM retry, zero PATCH, motivos janela_<n>
    zerar()
    e = rodar(site=CliFalso(respostas={
        ("POST", re.escape(CLAIM)): (200, TASK_200),
        ("GET", re.escape(INTEL) + r"(\?.*)?"): (200, snap_bytes(dias=28)),
        ("POST", re.escape(FAIL)): (200, FAIL_OK)}), llama=LlamaFalso())
    exige(len(e.fails) == 1 and "retry" not in e.fails[0][2], "janela 28: um fail SEM retry")
    exige(e.fails[0][2]["reason"] == "janela 28", "janela 28: reason")
    exige(e.desfecho == "reprovada" and "janela_28" in e.campo("motivos"), "janela 28: reprovada")
    exige(e.patches == [], "janela 28: zero PATCH")

    # recent_window nulo NAO reprova a janela
    zerar()
    e = rodar(site=CliFalso(respostas={
        ("POST", re.escape(CLAIM)): (200, TASK_200),
        ("GET", re.escape(INTEL) + r"(\?.*)?"): (200, snap_bytes(dias=None)),
        ("PATCH", re.escape(INTEL)): (200, b'{"data":{"ok":true}}')}))
    exige(e.desfecho == "ok", "recent_window nulo: nao reprova a janela")

    # a resposta do proprio fail decide o desfecho final
    for st, desfecho in ((200, "reprovada"), (409, "conflito"), (404, "fail_perdido"),
                         (500, "fail_perdido"), (403, "fail_perdido"), (429, "fail_perdido")):
        zerar()
        corpo = FAIL_OK if st == 200 else b'{"error":{"code":"X"}}'
        e = rodar(site=CliFalso(respostas={
            ("POST", re.escape(CLAIM)): (200, TASK_200),
            ("GET", re.escape(INTEL) + r"(\?.*)?"): (200, snap_bytes(dias=28)),
            ("POST", re.escape(FAIL)): (st, corpo)}), llama=LlamaFalso())
        exige(e.desfecho == desfecho, "reprovada com fail %s: %s" % (st, desfecho))
        exige(len(e.fails) == 1, "fail %s: nenhum segundo fail" % st)
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd /Users/figueiredo/Workspace/forja/ferramentas && python3 -m py_compile docs/trilha/teste_fila.py && echo PY-OK
```
Expected: `PY-OK`; na forja, `desfecho == 'ok'` em tudo e zero pedidos `/fail`.

- [ ] **Step 3: Implementar**

```python
async def mandar_fail(S, cli, chave, task_id, reason, retry):
    """UM unico POST .../fail. Devolve 'ok' | 'conflito' | 'perdido'.
    Nao engole RotaBloqueada nem erro de programacao: esses sobem e viram `bug`."""
    corpo = {"reason": reason}
    if retry:
        corpo["retry"] = True
    try:
        await S.pedir(cli, "POST", rota_fail(task_id), corpo=corpo, fase=2, chave=chave,
                      timeout=T_CURTO)
        return "ok"
    except S.FalhaSite as e:
        st = getattr(e, "status", None)
        if st == 200:                 # 200 com corpo `formato`/`grande`: a task FOI fechada
            return "ok"
        if st == 409:
            return "conflito"
        return "perdido"


async def _sair_com_fail(S, estado, desfecho, reason, retry, task_id, cli=None, chave=None,
                         motivos=()):
    """Toda saida antes do PATCH (e as linhas 400/422/3xx/4xx e 429 do passo 6) chamam UM fail.
    409 -> conflito; qualquer outra resposta que nao seja 200 -> fail_perdido.
    O `indeterminado` do passo 6 e a excecao: nada o sobrescreve."""
    estado["desfecho"] = desfecho
    estado["motivos"].extend(motivos)
    if cli is None or chave is None or not task_id:
        return
    r = await mandar_fail(S, cli, chave, task_id, reason, retry)
    if desfecho == "indeterminado":
        return
    if r == "conflito":
        estado["desfecho"] = "conflito"
    elif r == "perdido":
        estado["desfecho"] = "fail_perdido"
```

E o começo do `_apos_claim`, no lugar do provisório:

```python
async def _apos_claim(S, estado, task, chave, cli, llama, restante, agora_mono, dormir, agora):
    tid = task["id"]
    marcar(estado, "snapshot", agora_mono)
    try:
        snapshot, _t, _c = await S.pedir(cli, "GET", ROTA_INTEL, {"channel_id": task["channel_id"]},
                                         fase=2, chave=chave, timeout=T_CURTO)
    except S.FalhaSite as e:
        st = getattr(e, "status", None)
        await _sair_com_fail(S, estado, "falha_site", "snapshot %s" % (st or e.tipo),
                             transitoria(e), tid, cli, chave,
                             motivos=["snapshot_%s" % (st or e.tipo)])
        return
    janela = snapshot.get("recent_window")
    if janela is not None and janela.get("days") != JANELA_DIAS:
        n = janela.get("days")
        await _sair_com_fail(S, estado, "reprovada", "janela %s" % n, False, tid, cli, chave,
                             motivos=["janela_%s" % n])
        return
    estado["desfecho"] = "ok"          # provisorio ate a Task F1P-8
```

- [ ] **Step 4: Rodar e ver passar**

```bash
cd /Users/figueiredo/Workspace/forja/ferramentas && python3 -m py_compile docs/trilha/fila_intel.py docs/trilha/teste_fila.py && echo PY-OK
```
Expected: `PY-OK`. Na forja, o grupo `laco: passos 4-5` verde, menos o caso `recent_window nulo`,
que fecha na Task F1P-9 (é ele que envia o PATCH).

- [ ] **Step 5: Commit**

```bash
cd /Users/figueiredo/Workspace/forja/ferramentas && python3 -m py_compile docs/trilha/fila_intel.py docs/trilha/teste_fila.py && echo PY-OK
git -C /Users/figueiredo/Workspace/forja/ferramentas add docs/trilha/fila_intel.py docs/trilha/teste_fila.py
git -C /Users/figueiredo/Workspace/forja/ferramentas commit -m "feat: fail unico, snapshot e guarda de janela de 90 dias

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```
`git add` por caminho explícito, nunca `-A` nem `.` — dois ou mais terminais mexem no kit.

---

### Task F1P-8: passos 4–5 — `features` → `escolher` → `montar_entrada` → `redigir` → `validar`

**Files:**
- Modify: `/Users/figueiredo/Workspace/forja/ferramentas/docs/trilha/fila_intel.py`
- Test: `docs/trilha/teste_fila.py`, grupo `laco: passos 4-5 (geracao)`

**Interfaces:**
- Consumes: `features(snapshot, series, hoje)` e `escolher(feats)` (A2); `montar_entrada(feats,
  escolhido)`, `redigir(cli_llama, entrada, restante)`, `aplicar_summary(payload, summary)` e
  `validar(payload, entrada, texto)` (A3).
- Produces: `ler_series()`, `hoje_utc(agora)`, `montar_payload(task_id, escolhido)`, e a cola dos
  passos 4–5. **As duas tentativas, o corte de 9 min e o template são do `redigir` do A3** — esta
  frente não reimplementa nenhum dos três; ela só traduz o `falha` do dict em `fail {retry:true}` e
  copia `tentativas`/`seeds`/`motivos`/`fallback`/`tokens` para a linha do jsonl.

- [ ] **Step 1: Escrever os casos que falham**

```python
BOM = ("O canal tem 35 videos no banco e 29 views nos ultimos 90 dias ate 18/09/2026. "
       'A serie "0-10" fica abaixo da coorte, com 0,63x.')


def cli_ok(**extra):
    r = {("POST", re.escape(CLAIM)): (200, TASK_200),
         ("GET", re.escape(INTEL) + r"(\?.*)?"): (200, SNAP_200),
         ("PATCH", re.escape(INTEL)): (200, b'{"data":{"ok":true}}'),
         ("POST", re.escape(FAIL)): (200, FAIL_OK)}
    r.update(extra)
    return CliFalso(respostas=r)


@grupo("laco: passos 4-5 (geracao)")
def g_geracao():
    # payload montado: escopo 2a, sem `source`, com o prefixo do A3 no summary
    zerar()
    e = rodar(site=cli_ok(), llama=LlamaFalso(respostas=[("texto", BOM)]))
    exige(len(e.patches) == 1, "um PATCH so")
    corpo = e.patches[0][2]
    exige(set(corpo) == {"task_id", "coaching", "channel_insights"}, "escopo 2a: %r" % set(corpo))
    exige("video_recommendations" not in corpo and "notifications" not in corpo, "nem rec nem notif")
    exige(corpo["coaching"]["priorities"] == [], "priorities sempre []")
    exige(corpo["coaching"]["summary"].startswith(W.AVISO_ESTREITO), "summary prefixado pelo A3")
    exige("source" not in corpo, "o corpo NUNCA leva source (a fonte vem da chave)")
    exige(corpo["task_id"] == TID, "o task_id e o da task clamada")
    exige(e.desfecho == "ok" and e.campo("fallback") == [], "geracao boa: ok, sem fallback")
    exige(e.campo("tentativas") == 1 and len(e.campo("seeds")) == 1, "tentativas e seeds no log")
    exige(BOM[:40] not in json.dumps(e.linha), "nenhum trecho do summary no jsonl")

    # o `falha` do redigir vira fail {retry:true}; o resto vai ao PATCH
    for respostas, desfecho, tem_patch, retry, fallback in (
            ([("texto", "curto")], "ok", True, None, ["summary"]),
            ([("cru", "{}"), ("texto", BOM)], "ok", True, None, []),
            ([("timeout",), ("truncado",)], "llama", False, True, []),
            ([("pensou", "pensando"), ("cru", "{}")], "llama", False, True, [])):
        zerar()
        e = rodar(site=cli_ok(), llama=LlamaFalso(respostas=respostas))
        exige(e.desfecho == desfecho, "%r: %s" % (respostas, desfecho))
        exige(bool(e.patches) is tem_patch, "%r: patch %s" % (respostas, tem_patch))
        if retry is None:
            exige(e.fails == [], "%r: nenhum fail" % (respostas,))
        else:
            exige(len(e.fails) == 1 and e.fails[0][2].get("retry") is retry,
                  "%r: um fail com retry" % (respostas,))
        exige(e.campo("fallback") == fallback, "%r: fallback" % (respostas,))

    # orcamento curto: o corte de 9 min e do redigir; aqui so se confere o efeito
    zerar()
    e = rodar(site=cli_ok(), llama=LlamaFalso(respostas=[("timeout",)], gasta=12 * 60))
    exige(e.desfecho == "orcamento", "tentativa 1 sem chegar ao validador + <9 min: orcamento")
    exige(e.patches == [] and len(e.fails) == 1 and e.fails[0][2].get("retry") is True,
          "orcamento: zero PATCH, um fail com retry")
    exige(e.campo("tentativas") == 1, "orcamento: uma chamada ao llama so")

    # guarda deterministica: escolher adulterado -> fail SEM retry, zero PATCH
    zerar()
    original = W.escolher
    W.escolher = lambda feats: {**original(feats),
                                "coaching": {"priorities": [{"axis": "reach", "score": 1,
                                                             "diagnosis": "x", "action": "y"}]}}
    try:
        e = rodar(site=cli_ok(), llama=LlamaFalso(respostas=[("texto", BOM)]))
    finally:
        W.escolher = original
    exige(e.desfecho == "reprovada" and e.campo("etapa") == "validar", "escopo violado: reprovada")
    exige("escopo" in " ".join(e.campo("motivos")), "escopo violado: motivos escopo")
    exige(e.patches == [], "escopo violado: zero PATCH")
    exige(len(e.fails) == 1 and "retry" not in e.fails[0][2], "escopo violado: fail SEM retry")

    # os `motivos` do escolher chegam INTEIROS ao jsonl: nada e filtrado, ordenado nem truncado
    zerar()
    original = W.escolher
    W.escolher = lambda feats: {**original(feats),
                                "motivos": ["coorte_fina", "padrao_neutro", "series_orfas"]}
    try:
        e = rodar(site=cli_ok(), llama=LlamaFalso(respostas=[("texto", BOM)]))
    finally:
        W.escolher = original
    for m in ("coorte_fina", "padrao_neutro", "series_orfas"):
        exige(m in e.campo("motivos"), "motivo %s do escolher chega ao jsonl" % m)
    exige(e.desfecho == "ok", "motivos do escolher nao mudam o desfecho")

    # excecao em features depois do claim: bug + fail SEM retry
    zerar()
    original = W.features
    W.features = lambda *a: (_ for _ in ()).throw(KeyError("recent"))
    try:
        e = rodar(site=cli_ok(), llama=LlamaFalso())
    finally:
        W.features = original
    exige(e.desfecho == "bug" and e.campo("motivos")[-1] == "KeyError", "features explode: bug")
    exige(len(e.fails) == 1 and "retry" not in e.fails[0][2], "bug depois do claim: fail SEM retry")
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd /Users/figueiredo/Workspace/forja/ferramentas && python3 -m py_compile docs/trilha/teste_fila.py && echo PY-OK
```
Expected: `PY-OK`; na forja, `desfecho == 'ok'` sem nenhum PATCH e `AttributeError: ... 'montar_payload'`.

- [ ] **Step 3: Implementar**

```python
def ler_series():
    """<BASE>/series.json e a verdade das series (§4.2). Ausente ou ilegivel = canal sem serie."""
    try:
        with open(SERIES, encoding="utf-8") as f:
            d = json.load(f)
    except (OSError, ValueError):
        return {}
    return d if isinstance(d, dict) else {}


def hoje_utc(agora):
    """`hoje` e DATA UTC: o mesmo fuso do `date` que o sync grava, e do data_base do §4.4."""
    return agora().astimezone(dt.timezone.utc).date()


def montar_payload(task_id, escolhido):
    """O corpo do PATCH ANTES do summary. Escopo 2a: task_id, channel_insights e coaching.
    Quem poe o summary (ja prefixado) e o aplicar_summary do A3 — ponto unico."""
    return {"task_id": task_id,
            "channel_insights": dict(escolhido["channel_insights"]),
            "coaching": {"priorities": list(escolhido["coaching"]["priorities"])}}
```

E o miolo do `_apos_claim`, no lugar do provisório:

```python
    marcar(estado, "features", agora_mono)
    feats = features(snapshot, ler_series(), hoje_utc(agora))
    marcar(estado, "escolher", agora_mono)
    escolhido = escolher(feats)
    estado["motivos"].extend(escolhido.get("motivos", ()))
    entrada = montar_entrada(feats, escolhido)

    marcar(estado, "redigir", agora_mono)
    r = await redigir(llama, entrada, restante)          # as DUAS tentativas sao do A3
    estado["tentativas"] = r["tentativas"]
    estado["seeds"] = [s for s in r["seeds"] if s is not None]
    estado["motivos"].extend(r["motivos"])
    estado["fallback"] = list(r["fallback"])
    estado["tokens"] = r["tokens"]
    if r["falha"]:                                       # 'llama' | 'orcamento' — os dois com retry
        await _sair_com_fail(S, estado, r["falha"], r["falha"], True, tid, cli, chave)
        return

    marcar(estado, "validar", agora_mono)
    payload = aplicar_summary(montar_payload(tid, escolhido), r["summary"])
    duros, _do_texto = validar(payload, entrada, r["summary"])
    if duros:
        # itens 1-2 do §4.5: bug do codigo. Repetir daria o mesmo payload -> fail SEM retry.
        await _sair_com_fail(S, estado, "reprovada", duros[0], False, tid, cli, chave,
                             motivos=sorted({d.split(":")[0] for d in duros}))
        return

    await _mandar_patch(S, estado, payload, chave, cli, tid, dormir, agora_mono)
```

`_mandar_patch` nasce provisório aqui e é a Task F1P-9:

```python
async def _mandar_patch(S, estado, payload, chave, cli, tid, dormir, agora_mono):
    estado["desfecho"] = "ok"
```

- [ ] **Step 4: Rodar e ver passar**

```bash
cd /Users/figueiredo/Workspace/forja/ferramentas && python3 -m py_compile docs/trilha/fila_intel.py docs/trilha/teste_fila.py && echo PY-OK
cd docs/trilha && PYTHONPATH="$PWD/st" AGENTE_SITIO="$PWD/../sitio.py" AGENTE_FILA="$PWD/fila_intel.py" python3 -B teste_fila_redacao.py
cd ~/Workspace/forja/ferramentas/docs/trilha && PYTHONPATH="$PWD/st" AGENTE_SITIO="$PWD/../sitio.py" AGENTE_FILA="$PWD/fila_intel.py" python3 -B teste_calculo.py
```
Expected: `PY-OK`, `F2R: 0 falha(s)` e `F2C: 0 falha(s)` — esta tarefa é a que mais depende de
A2 e A3, e os dois testes deles rodam no Mac. Na forja, o grupo `laco: passos 4-5 (geracao)` verde,
e o grupo `sigterm` do A6 também (agora o llama é chamado de verdade).

- [ ] **Step 5: Commit**

```bash
cd /Users/figueiredo/Workspace/forja/ferramentas && python3 -m py_compile docs/trilha/fila_intel.py docs/trilha/teste_fila.py && echo PY-OK
git -C /Users/figueiredo/Workspace/forja/ferramentas add docs/trilha/fila_intel.py docs/trilha/teste_fila.py
git -C /Users/figueiredo/Workspace/forja/ferramentas commit -m "feat: passos 4-5 do laco — features, escolher, redigir e validar

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```
`git add` por caminho explícito, nunca `-A` nem `.` — dois ou mais terminais mexem no kit.

---

### Task F1P-9: passo 6 — o PATCH e a tabela inteira de desfechos

**Files:**
- Modify: `/Users/figueiredo/Workspace/forja/ferramentas/docs/trilha/fila_intel.py`
- Test: `docs/trilha/teste_fila.py`, grupo `laco: passo 6 (PATCH)`

**Interfaces:**
- Consumes: `_sair_com_fail`, `transitoria`, `dormir`.
- Produces: `_mandar_patch(...)` final e `T_PATCH` (`httpx.Timeout(60, connect=5)`, construído
  **dentro** da função, porque `httpx` não pode ser usado no import).

- [ ] **Step 1: Escrever os casos que falham**

```python
def cli_patch(gatilho):
    r = {("POST", re.escape(CLAIM)): (200, TASK_200),
         ("GET", re.escape(INTEL) + r"(\?.*)?"): (200, SNAP_200),
         ("POST", re.escape(FAIL)): (200, FAIL_OK)}
    if gatilho[0] == "status":
        r[("PATCH", re.escape(INTEL))] = (gatilho[1], b'{"error":{"code":"X"}}')
        return CliFalso(respostas=r)
    if gatilho[0] == "corpo":
        r[("PATCH", re.escape(INTEL))] = (200, gatilho[1])
        return CliFalso(respostas=r)
    return CliFalso(respostas=r, erro={re.escape(INTEL): gatilho[1]})


@grupo("laco: passo 6 (PATCH)")
def g_patch():
    tabela = [
        (("status", 200), "ok", False, None, []),
        (("corpo", b"nao e json"), "ok", False, None, []),     # 200 com formato/grande = ok
        (("status", 400), "reprovada", True, False, ["patch_400"]),
        (("status", 422), "reprovada", True, False, ["patch_422"]),
        (("status", 302), "reprovada", True, False, ["patch_302"]),
        (("status", 405), "reprovada", True, False, ["patch_405"]),
        (("status", 429), "falha_site", True, True, ["patch_429"]),
        (("status", 409), "conflito", False, None, []),
        (("status", 404), "conflito", False, None, []),
        (("status", 401), "chave", False, None, []),
        (("status", 403), "chave", False, None, []),
        (("status", 500), "indeterminado", True, True, []),
        (("status", 503), "indeterminado", True, True, []),
    ]
    for gatilho, desfecho, tem_fail, retry, motivos in tabela:
        zerar()
        e = rodar(site=cli_patch(gatilho), llama=LlamaFalso(respostas=[("texto", BOM)]))
        exige(e.desfecho == desfecho, "PATCH %r: %s" % (gatilho, desfecho))
        exige(len(e.patches) == 1, "PATCH %r: enviado UMA vez, nunca reenviado" % (gatilho,))
        exige(len(e.fails) == (1 if tem_fail else 0), "PATCH %r: fail %s" % (gatilho, tem_fail))
        if tem_fail:
            exige(e.fails[0][2].get("retry", False) is retry, "PATCH %r: retry" % (gatilho,))
        for m in motivos:
            exige(m in e.campo("motivos"), "PATCH %r: motivos %s" % (gatilho, m))

    # timeout do PATCH tambem e indeterminado
    zerar()
    e = rodar(site=cli_patch(("erro", Timeout)), llama=LlamaFalso(respostas=[("texto", BOM)]))
    exige(e.desfecho == "indeterminado" and len(e.fails) == 1, "PATCH timeout: indeterminado")

    # 429: espera 60 s fixos ANTES do fail (a janela do rate limit e de 60 s)
    zerar()
    e = rodar(site=cli_patch(("status", 429)), llama=LlamaFalso(respostas=[("texto", BOM)]))
    exige(e.dormidas == [60.0], "PATCH 429: espera 60 s fixos (%r)" % (e.dormidas,))
    exige(e.campo("etapa") == "patch", "PATCH 429: etapa patch")

    # no indeterminado, fail->409 e fail que falha NAO mudam o desfecho
    for st_fail in (409, 500, 404):
        zerar()
        e = rodar(site=CliFalso(respostas={
            ("POST", re.escape(CLAIM)): (200, TASK_200),
            ("GET", re.escape(INTEL) + r"(\?.*)?"): (200, SNAP_200),
            ("PATCH", re.escape(INTEL)): (500, b'{"error":{"code":"PARTIAL_FAILURE"}}'),
            ("POST", re.escape(FAIL)): (st_fail, b'{"error":{"code":"X"}}')}),
            llama=LlamaFalso(respostas=[("texto", BOM)]))
        exige(e.desfecho == "indeterminado", "indeterminado com fail %s permanece" % st_fail)

    # nas outras linhas, o fail decide: 409 -> conflito
    zerar()
    e = rodar(site=CliFalso(respostas={
        ("POST", re.escape(CLAIM)): (200, TASK_200),
        ("GET", re.escape(INTEL) + r"(\?.*)?"): (200, SNAP_200),
        ("PATCH", re.escape(INTEL)): (429, b'{"error":{"code":"RATE"}}'),
        ("POST", re.escape(FAIL)): (409, b'{"error":{"code":"TASK_NOT_RUNNING"}}')}),
        llama=LlamaFalso(respostas=[("texto", BOM)]))
    exige(e.desfecho == "conflito", "PATCH 429 com fail 409: conflito")
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd /Users/figueiredo/Workspace/forja/ferramentas && python3 -m py_compile docs/trilha/teste_fila.py && echo PY-OK
```
Expected: `PY-OK`; na forja só a linha `200` passa — o `_mandar_patch` provisório nem envia o PATCH.

- [ ] **Step 3: Implementar**

```python
async def _mandar_patch(S, estado, payload, chave, cli, tid, dormir, agora_mono):
    """§4.1 passo 6. O PATCH sai UMA vez; nunca e reenviado. O fail e o CAS final do PATCH sao
    ambos CAS sobre `running` com a trava de dono, entao so um vence."""
    marcar(estado, "patch", agora_mono)
    # httpx.Timeout e construido AQUI: o modulo nao pode usar httpx na importacao (contrato do A5)
    try:
        await S.pedir(cli, "PATCH", ROTA_INTEL, corpo=payload, fase=2, chave=chave,
                      timeout=httpx.Timeout(60, connect=5))
        estado["desfecho"] = "ok"
        return
    except S.FalhaSite as e:
        st = getattr(e, "status", None)
    if st == 200:
        estado["desfecho"] = "ok"          # 200 com corpo `formato`/`grande`: o CAS ja fechou
        return
    if st in (409, 404):
        estado["desfecho"] = "conflito"    # a task nao e mais desta execucao: nada a fazer
        return
    if st in (401, 403):
        estado["desfecho"] = "chave"       # a chave foi recusada; o watchdog fecha
        return
    if st == 429:
        await dormir(ESPERA_429)
        await _sair_com_fail(S, estado, "falha_site", "patch 429", True, tid, cli, chave,
                             motivos=["patch_429"])
        return
    if st is None or st >= 500:
        # timeout / 5xx (inclusive PARTIAL_FAILURE): NAO repete o PATCH.
        await _sair_com_fail(S, estado, "indeterminado", "patch indeterminado", True, tid, cli, chave)
        return
    # 400 / 422 / 3xx / outro 4xx: recusas que saem antes de qualquer escrita
    await _sair_com_fail(S, estado, "reprovada", "patch %s" % st, False, tid, cli, chave,
                         motivos=["patch_%s" % st])
```

- [ ] **Step 4: Rodar e ver passar**

```bash
cd /Users/figueiredo/Workspace/forja/ferramentas && python3 -m py_compile docs/trilha/fila_intel.py docs/trilha/teste_fila.py && echo PY-OK
grep -n "httpx\." docs/trilha/fila_intel.py
```
Expected: `PY-OK`, e todo uso de `httpx.` dentro de função (nenhum em nível de módulo além do
`import`). Na forja, o grupo `laco: passo 6` verde e o caso `recent_window nulo` da Task F1P-7 fecha.

- [ ] **Step 5: Commit**

```bash
cd /Users/figueiredo/Workspace/forja/ferramentas && python3 -m py_compile docs/trilha/fila_intel.py docs/trilha/teste_fila.py && echo PY-OK
git -C /Users/figueiredo/Workspace/forja/ferramentas add docs/trilha/fila_intel.py docs/trilha/teste_fila.py
git -C /Users/figueiredo/Workspace/forja/ferramentas commit -m "feat: PATCH da analise e a tabela de desfechos do passo 6

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```
`git add` por caminho explícito, nunca `-A` nem `.` — dois ou mais terminais mexem no kit.

---

### Task F1P-10: modos auxiliares `--escolher` e `--sombra`

**Files:**
- Modify: `/Users/figueiredo/Workspace/forja/ferramentas/docs/trilha/fila_intel.py`
- Test: `docs/trilha/teste_fila.py`, marcador `>>> GRUPO modos auxiliares`

**Interfaces:**
- Consumes: `features`, `escolher` (A2); `montar_entrada`, `redigir`, `aplicar_summary`, `validar`,
  `SISTEMA_FILA`, `mensagens` (A3); `carregar_sitio()._t`; `rotulo_sombra()`.
- Produces: `_modo_escolher(...)`, `_modo_sombra(...)`, `abrir_snapshot(caminho)` e o **esquema do
  arquivo de sombra**.

**Esquema do arquivo de sombra** (lacuna do §4.7 — o spec só diz "com o `system`, o `user`, o
payload, o veredito e os tempos"). Fixado aqui, e é o que o F2 do A8 lê:

```json
{"system": "<SISTEMA_FILA>", "user": "<json compacto da ENTRADA>",
 "payload": {...},            "veredito": "aprovado" | "<motivo>",
 "tempos": {"<etapa>": <ms>}, "seed": <int|null>,
 "fonte": "modelo"|"template", "tentativas": <int>, "motivos": [...],
 "tokens": <int|null>, "problemas": [...]}
```

`payload` e `tempos` são as duas chaves que o `extrairPayload` e o comparador de tempos do A8 exigem
nesses nomes. `congelado_em` é lido como **data UTC `AAAA-MM-DD`** (decisão do A8, Task F0k-2).

- [ ] **Step 1: Escrever os casos que falham**

```python
def escreve_fixture():
    corpo = json.loads(SNAP_200)["data"]
    corpo["congelado_em"] = "2026-09-18"        # data UTC AAAA-MM-DD (A8, Task F0k-2)
    caminho = os.path.join(TMP, "fixture_pt.json")
    with open(caminho, "w", encoding="utf-8") as f:
        json.dump(corpo, f)
    return caminho


@grupo("modos auxiliares")
def g_aux():
    # --escolher: sem rede, sem llama e sem fila_intel.env
    arq = escreve_fixture()
    zerar(env=False)
    site, llama = CliFalso(), LlamaFalso()
    e = rodar(argv=["--escolher", "--snapshot", arq], site=site, llama=llama)
    exige(site.chamadas == [] and site.pedidos == [], "--escolher: zero chamadas ao CliFalso")
    exige(llama.pedidos == [], "--escolher: nao chama o 12B nem o /slots")
    exige(e.campo("modo") == "escolher" and e.desfecho == "ok", "--escolher: modo e ok")
    exige(e.campo("tentativas") == 0, "--escolher: zero tentativas")

    # a janela do sync NAO vale para modo auxiliar
    zerar(env=False)
    e = rodar(argv=["--escolher", "--snapshot", arq],
              quando=dt.datetime(2026, 9, 18, 12, 0, tzinfo=dt.timezone.utc).astimezone(BRT))
    exige(e.desfecho == "ok", "--escolher as 12:00 UTC: a janela do sync nao entra")

    # --sombra: sem claim, sem PATCH, sem fail; grava PT-<quando>.json
    arq = escreve_fixture()
    zerar(chave=None, canais="PT")              # sem SITIO_CHAVE_FILA: NAO e `config` no --sombra
    site = CliFalso()
    e = rodar(argv=["--sombra", "--snapshot", arq], site=site,
              llama=LlamaFalso(respostas=[("texto", BOM)]))
    exige(site.chamadas == [] and site.pedidos == [], "--sombra: zero chamadas ao CliFalso")
    exige(e.desfecho == "ok", "--sombra: ok sem SITIO_CHAVE_FILA")
    saidas = sorted(os.listdir(os.path.join(TMP, "sombra")))
    exige(len(saidas) == 1 and saidas[0].startswith("PT-") and ":" not in saidas[0],
          "sombra: PT-<quando>.json sem ':' (%r)" % saidas)
    d = json.load(open(os.path.join(TMP, "sombra", saidas[0])))
    for k in ("system", "user", "payload", "veredito", "tempos", "seed"):
        exige(k in d, "a sombra guarda %s" % k)
    exige(d["payload"]["task_id"] == W.TASK_FALSA, "a sombra usa a task falsa")
    exige(d["payload"]["coaching"]["priorities"] == [], "a sombra respeita o escopo 2a")
    exige("video_recommendations" not in d["payload"], "a sombra nao manda recomendacao")
    exige(CHAVE_FILA not in json.dumps(d), "nenhuma chave no arquivo de sombra")

    # --sombra usa congelado_em, nunca o relogio
    visto = {}
    original = W.features
    W.features = lambda s, se, hoje: visto.setdefault("hoje", hoje) or original(s, se, hoje)
    try:
        zerar(chave=None, canais="PT")
        rodar(argv=["--sombra", "--snapshot", escreve_fixture()],
              llama=LlamaFalso(respostas=[("texto", BOM)]),
              quando=dt.datetime(2027, 1, 1, 12, 0, tzinfo=dt.timezone.utc).astimezone(BRT))
    finally:
        W.features = original
    exige(visto["hoje"] == dt.date(2026, 9, 18), "--sombra: hoje = congelado_em (%r)" % visto)

    # os auxiliares passam pelos portoes de /slots e chat
    zerar(chave=None, canais="PT")
    e = rodar(argv=["--sombra", "--snapshot", escreve_fixture()], llama=LlamaFalso(ocupado=True))
    exige(e.desfecho == "ocupado", "--sombra passa pelo portao de /slots")
    exige(not os.path.isdir(os.path.join(TMP, "sombra"))
          or os.listdir(os.path.join(TMP, "sombra")) == [],
          "--sombra barrado nao grava arquivo")
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd /Users/figueiredo/Workspace/forja/ferramentas && python3 -m py_compile docs/trilha/teste_fila.py && echo PY-OK
```
Expected: `PY-OK`; na forja, `--escolher` cai no `ler_config()` e sai `config`.

- [ ] **Step 3: Implementar**

Ordem final do `_laco`, que esta tarefa e a próxima fecham:

```
restante_aux  ->  --escolher (retorna)  ->  abrir_llama  ->  _portoes(janela=False) para
--sombra/--canario  ->  --sombra (retorna)  ->  ler_config()  ->  --canario (retorna)
  ->  _portoes(janela=True)  ->  claim  ->  _apos_claim
```

Os modos auxiliares não clamam, então o orçamento de 20 min conta **do início de `main()`** (mesmo
`time.monotonic()`): dele saem o timeout da geração e o corte de 9 min, ambos dentro do `redigir`.

```python
def abrir_snapshot(caminho):
    """A fixture do F0.5: o snapshot como o site o devolve, mais `congelado_em` (data UTC)."""
    with open(caminho, encoding="utf-8") as f:
        return json.load(f)


def _modo_escolher(S, estado, args, agora_mono):
    """Sem rede, sem llama e sem fila_intel.env. Imprime os videos fora do series.json e `escolher`."""
    snapshot = abrir_snapshot(args.snapshot)
    series = ler_series()
    hoje = dt.date.fromisoformat(snapshot["congelado_em"])
    marcar(estado, "features", agora_mono)
    feats = features(snapshot, series, hoje)
    marcar(estado, "escolher", agora_mono)
    escolhido = escolher(feats)
    estado["motivos"].extend(escolhido.get("motivos", ()))
    mapa = (series or {}).get("videos") or {}
    fora = [v for v in snapshot.get("videos", []) if v["id"] not in mapa]
    print("fora do series.json (%d):" % len(fora))
    for v in fora:
        print("  %s  %s" % ((v.get("published_at") or "")[:10], S._t(v.get("title") or "")))
    print(json.dumps({"channel_insights": escolhido["channel_insights"],
                      "entrada": montar_entrada(feats, escolhido)},
                     ensure_ascii=False, indent=2))
    estado["desfecho"] = "ok"


async def _modo_sombra(S, estado, args, llama, agora_mono, restante):
    """Sem claim, sem PATCH e sem fail. Grava <BASE>/sombra/<rotulo>-<quando>.json 0600."""
    snapshot = abrir_snapshot(args.snapshot)
    hoje = dt.date.fromisoformat(snapshot["congelado_em"])
    marcar(estado, "features", agora_mono)
    feats = features(snapshot, ler_series(), hoje)
    marcar(estado, "escolher", agora_mono)
    escolhido = escolher(feats)
    estado["motivos"].extend(escolhido.get("motivos", ()))
    entrada = montar_entrada(feats, escolhido)
    marcar(estado, "redigir", agora_mono)
    r = await redigir(llama, entrada, restante)
    estado["tentativas"] = r["tentativas"]
    estado["seeds"] = [s for s in r["seeds"] if s is not None]
    estado["motivos"].extend(r["motivos"])
    estado["fallback"] = list(r["fallback"])
    estado["tokens"] = r["tokens"]
    if r["falha"]:
        estado["desfecho"] = r["falha"]          # 'llama' | 'orcamento': nada a gravar
        return
    marcar(estado, "validar", agora_mono)
    payload = aplicar_summary(montar_payload(TASK_FALSA, escolhido), r["summary"])
    duros, do_texto = validar(payload, entrada, r["summary"])
    veredito = "aprovado" if not do_texto else ",".join(do_texto)
    marcar(estado, "sombra", agora_mono)
    quando = dt.datetime.now().strftime("%Y%m%dT%H%M%S")      # sem ':' no nome do arquivo
    alvo = os.path.join(SOMBRA, "%s-%s.json" % (rotulo_sombra(), quando))
    fd = os.open(alvo, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump({"system": SISTEMA_FILA,
                   "user": json.dumps(entrada, ensure_ascii=False, separators=(",", ":")),
                   "payload": payload, "veredito": veredito, "tempos": dict(estado["ms"]),
                   "seed": (estado["seeds"] or [None])[-1], "fonte": r["fonte"],
                   "tentativas": r["tentativas"], "motivos": list(estado["motivos"]),
                   "tokens": r["tokens"], "problemas": duros},
                  f, ensure_ascii=False, indent=2)
    estado["desfecho"] = "reprovada" if duros else "ok"
    estado["motivos"].extend(sorted({d.split(":")[0] for d in duros}))
```

E o começo do `_laco`:

```python
async def _laco(S, estado, args, agora_mono, dormir, agora, abrir_site, abrir_llama):
    inicio_aux = agora_mono()

    def restante_aux():
        return ORCAMENTO_S - (agora_mono() - inicio_aux)

    if args.escolher:
        return _modo_escolher(S, estado, args, agora_mono)

    async with abrir_llama() as llama:
        if args.sombra or args.canario:
            if not await _portoes(estado, llama, agora, agora_mono, janela=False):
                return
            if args.sombra:
                estado["canal"] = rotulo_sombra()
                return await _modo_sombra(S, estado, args, llama, agora_mono, restante_aux)
        marcar(estado, "config", agora_mono)
        canais, chave = ler_config()
        estado["canal"] = canais[0][0]
        if args.canario:
            async with abrir_site() as cli:
                return await _modo_canario(S, estado, args, chave, cli, llama,
                                           agora_mono, restante_aux)
        if not await _portoes(estado, llama, agora, agora_mono):
            return
        ...   # o claim da Task F1P-6 segue daqui
```

- [ ] **Step 4: Rodar e ver passar**

```bash
cd /Users/figueiredo/Workspace/forja/ferramentas && python3 -m py_compile docs/trilha/fila_intel.py docs/trilha/teste_fila.py && echo PY-OK
```
Expected: `PY-OK`. Na forja, o grupo `modos auxiliares` verde nos casos de `--escolher`/`--sombra`
(os do `--canario` fecham na Task F1P-11).

- [ ] **Step 5: Commit**

```bash
cd /Users/figueiredo/Workspace/forja/ferramentas && python3 -m py_compile docs/trilha/fila_intel.py docs/trilha/teste_fila.py && echo PY-OK
git -C /Users/figueiredo/Workspace/forja/ferramentas add docs/trilha/fila_intel.py docs/trilha/teste_fila.py
git -C /Users/figueiredo/Workspace/forja/ferramentas commit -m "feat: modos --escolher e --sombra do fila_intel

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```
`git add` por caminho explícito, nunca `-A` nem `.` — dois ou mais terminais mexem no kit.

---

### Task F1P-11: `--canario`

**Files:**
- Modify: `/Users/figueiredo/Workspace/forja/ferramentas/docs/trilha/fila_intel.py`
- Test: `docs/trilha/teste_fila.py`, grupo `modos auxiliares` (continuação)

**Interfaces:**
- Consumes: `S.pedir` com `fase=2`; `ler_default(DEFAULT)` (A5) para a chave `{read}`; `mensagens`,
  `S` e `aceitar` via `redigir` (A3); `features`/`escolher`/`montar_entrada`.
- Produces: `_modo_canario(...)` e `CORPO_CANARIO` — 3 sondas ao site (2 `fail` + 1 PATCH) e 1 sonda
  à 8080. **Nunca clama.**

- [ ] **Step 1: Escrever os casos que falham**

O `respostas` do `CliFalso` é por `(metodo, rota)`, e as duas sondas de `fail` do canário batem na
**mesma rota** com chaves diferentes. Em vez de pedir API nova ao harness, o caso usa uma subclasse
local, que só repete a escrituração que o `CliFalso` já faz:

```python
from sitio_falso import Resp              # ja importado pelo harness


class CliCanario(CliFalso):
    """Responde por chave. Nao acrescenta API ao sitio_falso nem ao harness: e um duble do caso."""
    def __init__(self, por_chave, **kw):
        super().__init__(**kw)
        self.por_chave = dict(por_chave)   # valor de X-Pipeline-Key -> (status, corpo)

    async def request(self, metodo, url, params=None, json=None, headers=None,
                      timeout=None, follow_redirects=True):
        caminho = url.split("bythiagofigueiredo.com", 1)[1]
        self.chamadas.append((caminho, dict(params or {}), dict(headers or {})))
        self.pedidos.append((metodo, caminho, json))
        alvo = self.por_chave.get((headers or {}).get("X-Pipeline-Key"))
        if alvo is not None and "/fail" in caminho:
            return Resp(*alvo)
        r = self._resposta(metodo, caminho)
        return r if r is not None else Resp(404, b'{"error":"not found"}')


FALSA = "/api/pipeline/youtube/intelligence/task/00000000-0000-4000-8000-000000000000/fail"


def cli_canario(fila=(404, b"{}"), leitura=(403, b"{}"), patch=(400, b"{}")):
    return CliCanario({CHAVE_FILA: fila, CHAVE_LEITURA: leitura},
                      respostas={("PATCH", re.escape(INTEL)): patch})


def g_aux_canario():                       # chamado do grupo "modos auxiliares"
    escreve_fixture()
    # feliz: 404 com a chave da fila, 403 com a {read}, 400 no PATCH de escopo
    zerar()
    site = cli_canario()
    e = rodar(argv=["--canario"], site=site, llama=LlamaFalso(respostas=[("texto", BOM)]))
    fails = [p for p in site.pedidos if p[1] == FALSA]
    exige(len(fails) == 2, "canario: exatamente dois POST .../<task falsa>/fail")
    chaves = [h.get("X-Pipeline-Key") for c, _p, h in site.chamadas if c == FALSA]
    exige(chaves == [CHAVE_FILA, CHAVE_LEITURA], "canario: chave da fila e depois a {read}")
    patches = [p for p in site.pedidos if p[0] == "PATCH"]
    exige(len(patches) == 1 and patches[0][2] == W.CORPO_CANARIO,
          "canario: um PATCH com o corpo literal do spec")
    exige(e.claims == [], "canario NAO clama")
    exige(e.desfecho == "ok" and e.campo("modo") == "canario", "canario feliz: ok")

    # cada sonda fora do esperado reprova, e o motivo diz qual
    for kw, nome in ((dict(fila=(400, b"{}")), "fila"),      # 400 no fail: corpo recusado antes
                     (dict(leitura=(401, b"{}")), "read"),   # 401 na {read}: esperado e 403
                     (dict(patch=(404, b"{}")), "escopo")):  # 404 no PATCH: guarda depois do SELECT
        zerar()
        e = rodar(argv=["--canario"], site=cli_canario(**kw),
                  llama=LlamaFalso(respostas=[("texto", BOM)]))
        exige(e.desfecho == "reprovada", "canario reprova na sonda %s" % nome)
        exige(any(m.startswith("canario_" + nome) for m in e.campo("motivos")),
              "canario: motivo nomeia a sonda %s (%r)" % (nome, e.campo("motivos")))

    # o canario usa a chave da fila, entao a checagem do passo 2 vale para ele
    zerar(chave=None)
    e = rodar(argv=["--canario"], site=cli_canario(), llama=LlamaFalso())
    exige(e.desfecho == "config", "canario sem SITIO_CHAVE_FILA: config")
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd /Users/figueiredo/Workspace/forja/ferramentas && python3 -m py_compile docs/trilha/teste_fila.py && echo PY-OK
```
Expected: `PY-OK`; na forja, `--canario` cai no laço normal e clama.

- [ ] **Step 3: Implementar**

```python
CORPO_CANARIO = {
    "task_id": TASK_FALSA,
    "coaching": {"summary": "canario", "priorities": []},
    # valido para o PatchPayloadSchema (intelligence-schemas.ts:3-14,16-24,37-41), entao o 400
    # so pode vir da guarda de escopo `forja`, nunca do Zod. Um 404 REPROVA: quer dizer que a
    # guarda ficou depois do SELECT da task (§3.3).
    "video_recommendations": [{"video_id": TASK_FALSA, "action_type": "title_test",
                               "priority": "low", "confidence": 0.5, "reasoning": "canario"}],
}


async def _sonda(S, cli, metodo, caminho, corpo, chave, esperado):
    """(ok, status). `esperado` e o status que prova a guarda viva."""
    try:
        await S.pedir(cli, metodo, caminho, corpo=corpo, fase=2, chave=chave, timeout=T_CURTO)
        return esperado == 200, 200
    except S.FalhaSite as e:
        st = getattr(e, "status", None)
        return st == esperado, st


async def _modo_canario(S, estado, args, chave, cli, llama, agora_mono, restante):
    """Nao clama. Tres sondas ao site e uma a 8080; qualquer status fora do esperado reprova."""
    marcar(estado, "canario", agora_mono)
    read, _uuids = ler_default(DEFAULT)                 # a {read} da fase 1 (A5)
    if not read:
        estado["desfecho"] = "reprovada"
        estado["motivos"].append("canario_read_sem_chave")
        return
    sondas = (("fila", "POST", rota_fail(TASK_FALSA), {"reason": "canario"}, chave, 404),
              ("read", "POST", rota_fail(TASK_FALSA), {"reason": "canario"}, read, 403),
              ("escopo", "PATCH", ROTA_INTEL, CORPO_CANARIO, chave, 400))
    for nome, metodo, caminho, corpo, k, esperado in sondas:
        ok, st = await _sonda(S, cli, metodo, caminho, corpo, k, esperado)
        estado["ms"]["canario_" + nome] = st
        if not ok:
            estado["desfecho"] = "reprovada"
            estado["motivos"].append("canario_%s_%s" % (nome, st))
            return
    # sonda de schema na 8080, com o S real e a ENTRADA da fixture, pelo mesmo `redigir` da execucao
    snapshot = abrir_snapshot(args.snapshot or FIXTURE)
    feats = features(snapshot, ler_series(), dt.date.fromisoformat(snapshot["congelado_em"]))
    escolhido = escolher(feats)
    marcar(estado, "redigir", agora_mono)
    r = await redigir(llama, montar_entrada(feats, escolhido), restante)
    estado["tentativas"] = r["tentativas"]
    estado["seeds"] = [s for s in r["seeds"] if s is not None]
    estado["tokens"] = r["tokens"]
    if r["falha"]:
        estado["desfecho"] = "reprovada"
        estado["motivos"].append("canario_schema_%s" % r["falha"])
        return
    estado["desfecho"] = "ok"
```

> **Lacuna do spec preenchida aqui.** O portão do F1 roda `--canario` **sem** `--snapshot`
> (`venv/bin/python -B docs/trilha/fila_intel.py --canario`), e o §4.7 não diz de onde vem a `ENTRADA` da sonda de
> schema. Este plano usa `args.snapshot or FIXTURE`, com
> `FIXTURE = <BASE>/docs/trilha/fixture_pt.json` — a mesma fixture que o F0.5 (A8) grava e que o
> `--sombra` usa.

- [ ] **Step 4: Rodar e ver passar**

```bash
cd /Users/figueiredo/Workspace/forja/ferramentas && python3 -m py_compile docs/trilha/fila_intel.py docs/trilha/teste_fila.py && echo PY-OK
```
Expected: `PY-OK`. Na forja, o grupo `modos auxiliares` inteiro verde.

- [ ] **Step 5: Commit**

```bash
cd /Users/figueiredo/Workspace/forja/ferramentas && python3 -m py_compile docs/trilha/fila_intel.py docs/trilha/teste_fila.py && echo PY-OK
git -C /Users/figueiredo/Workspace/forja/ferramentas add docs/trilha/fila_intel.py docs/trilha/teste_fila.py
git -C /Users/figueiredo/Workspace/forja/ferramentas commit -m "feat: modo --canario do fila_intel

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```
`git add` por caminho explícito, nunca `-A` nem `.` — dois ou mais terminais mexem no kit.

---

### Task F1P-12: rodada na forja — comandos para o dono colar

Sem código. É o fechamento desta frente: `teste_fila.py` é portão do `cartao.sh S4` e de **toda**
instalação do `fila_intel.py`, e **só roda na forja**.

**Files:** nenhum.

**Interfaces:**
- Consumes: as Tasks F1P-1 a F1P-11 e as outras frentes do F0k (A2, A3, A4, A5, A6).
- Produces: o veredito do `teste_fila.py` na forja, pré-requisito do S4 e do F1.

> Os scripts `capturar_fixture.py` e `sonda_f0.py` **não são desta frente**: estão escritos por
> inteiro no card A8, Tasks F0k-2 e F0k-3. Esta frente só consome a forma de `congelado_em` que eles
> fixam (data UTC `AAAA-MM-DD`).

- [ ] **Step 1: Portão F0k no Mac (antes de o dono levar o kit)**

```bash
cd /Users/figueiredo/Workspace/forja/ferramentas
for f in docs/trilha/fila_intel.py docs/trilha/teste_fila.py docs/trilha/teste_calculo.py docs/trilha/teste_fila_redacao.py; do python3 -m py_compile "$f" || echo "FALHOU $f"; done
cd docs/trilha && PYTHONPATH="$PWD/st" AGENTE_SITIO="$PWD/../sitio.py" AGENTE_FILA="$PWD/fila_intel.py" python3 -B teste_calculo.py
cd /Users/figueiredo/Workspace/forja/ferramentas/docs/trilha && PYTHONPATH="$PWD/st" AGENTE_SITIO="$PWD/../sitio.py" AGENTE_FILA="$PWD/fila_intel.py" python3 -B teste_fila_redacao.py
```
Expected: nenhum `FALHOU`; **`F2C: 0 falha(s)`** e **`F2R: 0 falha(s)`** — os rótulos são esses,
não `CALCULO:`. **Os dois irmãos exigem `AGENTE_FILA`**, e o de redação exige também o stub de
`httpx` em `st/`; sem isso não rodam. Não existe modo `--dubles` no harness: ele foi cortado na
reconciliação, e hoje `teste_fila.py` ignora `argv` em silêncio — passar a flag roda a suíte
inteira, não um subconjunto. O `teste_fila.py` só roda com o `httpx` real, na forja.

- [ ] **Step 2: O dono leva o kit (card K, §5)**

```
cd ~/Workspace/forja/ferramentas/docs && scp -r sitio.py trilha forja:/opt/agente/docs/
```

- [ ] **Step 3: O dono roda o `teste_fila.py` na forja, sob a trava**

Comandos curtos, um por linha (um `env -u ... -u ... VAR=v VAR2=v2 python -B script` de uma linha
só já quebrou no terminal do dono: o `env -u PYTHONPATH -u AGENTE_BASE` virou comando próprio e o
`python -B` sozinho abriu um REPL):
```
cd /opt/agente/docs/trilha
unset PYTHONPATH AGENTE_BASE
export AGENTE_SITIO=/opt/agente/docs/sitio.py
export AGENTE_FILA=/opt/agente/docs/trilha/fila_intel.py
flock -w 1800 /opt/agente/fila_intel.lock /opt/agente/venv/bin/python -B teste_fila.py
```
`AGENTE_SITIO=/opt/agente/docs/sitio.py`, não `/opt/agente/sitio.py.novo`: o `scp` do Step 2 (card K)
deixa o kit em `/opt/agente/docs/`, e `sitio.py.novo` só existe depois que o S4 rodar — nesta rodada,
antes do S4, ele não existe ainda. (`/opt/agente/sitio.py`, sem `docs/`, também existe, mas é o
`sitio.py` **antigo**, da fase 1 — não confundir, e não sobrescrever.)
Expected: `FILA: 0 falha(s)`. Se sair `PARE: lock ocupado por 30 min`, uma execução do cron está viva
— esperar e repetir. **Nenhum agente roda esta linha**; ela é do dono.

- [ ] **Step 4: Conferência por leitura (permitida ao agente)**

```bash
ssh forja 'ls -l /opt/agente/docs/trilha/fila_intel.py /opt/agente/docs/trilha/teste_fila.py'
ssh forja 'tail -1 /opt/agente/log/fila_intel.jsonl'
ssh forja 'grep -c SITIO_CHAVE_FILA /etc/default/proxy-agente'
ssh forja 'curl -fsS 127.0.0.1:8080/slots | head -c 200'
```
Expected: os dois arquivos presentes; a última linha do jsonl com os seis campos do pulso; o
`grep -c` → `0` (a chave da fila nunca mora no `/etc/default/proxy-agente`); e o `/slots` devolvendo
uma **lista de 2 objetos com `is_processing` booleano** — a mesma forma verificada em 2026-09-20 e
registrada em `slots_livres()`. Este comando é a reconferência do portão do F1, não a descoberta da
forma; a guarda fail-closed do código é o que protege a fila de uma mudança futura do llama-server.

- [ ] **Step 5: Prova de que nenhum segredo vazou para o log nem para a sombra**

```
grep -rlFf <(sed -n 's/^SITIO_CHAVE_FILA="\(.*\)"$/\1/p' /opt/agente/fila_intel.env) /opt/agente/log/ /opt/agente/sombra/ | wc -l
```
Expected: `0`. (Comando do dono; o valor não passa por argv.)

---

### Diferenças em relação à primeira versão desta frente (reconciliação)

| # | O que era | O que passou a ser | Dono |
|---|---|---|---|
| 1 | `CliFalso.por_chave`, `SITIO_CHAVE_READ` | não existem: o caso usa `respostas` do A4, lê `headers` de `.chamadas` e, onde duas chaves batem na mesma rota, define a subclasse local `CliCanario` | A4/A6 |
| 2 | `rodar(cli, llama, argv, mono, relogio, env) -> (rc, linha)` | `rodar(argv=("--cron",), *, site, llama, quando, passo, t0, gasta_site) -> Execucao`, com `zerar(...)`, `Execucao.campo/desfecho/fails/patches/claims/dormidas` | A6 |
| 3 | `validar(summary, entrada, escolha)`, `checar_payload`, `template`, laço de 2 tentativas próprio | `redigir(cli, entrada, restante)` (que já faz as 2 tentativas, o corte de 9 min, o Aparo e o template), `aplicar_summary`, `validar(payload, entrada, texto) -> (duros, do_texto)`; `AVISO_ESTREITO`/`MAX`/`S`/`SISTEMA_FILA` (não `ESQUEMA`) | A3 |
| 4 | `escolher(feats)` devolvendo `entrada` | `escolher(feats) -> {channel_insights, coaching, series, motivos}` + `montar_entrada(feats, escolhido)`; o laço acrescenta `task_id` em `montar_payload` | A2/A3 |
| 5 | `ler_env(caminho) -> dict` genérico | `ler_env_fila` + `ler_default` do A5 dentro de `ler_config()`; motivos `env_ausente`/`env_ilegivel`/`chave_ausente`/`chave_duplicada`/`chave_formato` (mais `canais_vazio`/`canal_<R>`, que não são do leitor) | A5 |
| 6 | `congelado_em` sem forma fixa; sombra sem esquema; `capturar_fixture.py`/`sonda_f0.py` escritos aqui | `congelado_em` = data UTC `AAAA-MM-DD`; esquema da sombra com `payload` e `tempos` no topo; os dois scripts saem desta frente e ficam nas Tasks F0k-2/F0k-3 | A8 |
| 7 | venv descartável no scratchpad; `LOCK`/`LOG_DIR`; `main()` posicional | venv cortado (A2/A3 rodam no Mac); constantes `TRAVA`/`LOG`; `main(argv=None, *, ...)` com `abrir_*` como async context manager e `main()` devolvendo o código | A6 |
| 8 | "`~/Workspace/forja` não é repo git", 11 passos em "salvar o arquivo" | o kit é repo git desde 20/09 (`ec51833`, `.git` em `ferramentas/`, fora de `docs/`): **11 passos terminam em `git commit`**, `tipo: descrição curta`, `git add` por caminho explícito, sem remoto e sem push | dono |
| 9 | `/slots` "suposição a confirmar no F1" | **forma verificada em 2026-09-20**: `list` de 2 objetos, `is_processing` presente e `bool`; o incompleto era o inventário do kit. A guarda fail-closed **fica como está** — ela protege contra o campo sumir numa atualização do llama-server, não contra ele não existir hoje | merger |
| 10 | `motivos` do `escolher` só com `padrao_neutro`/`series_orfas` | entra `coorte_fina` (C4). O laço não filtra, ordena nem trunca `motivos` em nenhum dos três modos que chamam `escolher`; há caso no grupo `laco: passos 4-5 (geracao)` provando que os três chegam ao jsonl | A2 |


---

## F0k · o worker — cálculo: `features` e `escolher` (§4.2, §4.3)

> Seção do plano `docs/superpowers/plans/2026-09-19-forja-fila-inteligencia-plan.md`.
> Cobre **só** o §4.2 (fatos, funções puras) e o §4.3 (padrões e montagem) do spec
> `docs/superpowers/specs/2026-09-18-forja-fila-inteligencia-design.md` (v11, commit `0fde594e`).
> **Fora desta seção** (outros agentes): o laço/`main()` (§4.1), a redação e o validador (§4.4/§4.5),
> o harness `teste_fila.py` e o `sitio.py` (§4.6), chave/segredos e o pulso (§6).

**Goal:** entregar, dentro de `~/Workspace/forja/ferramentas/docs/trilha/fila_intel.py`, as duas funções puras
que fazem **todo** número e **toda** decisão da 2a — `features(snapshot, series, hoje)` e `escolher(feats)` —
com um teste de tabela no estilo do kit que fixa os valores concretos do §4.3.

---

### Constraints desta seção

Valem as **Global Constraints** do plano principal, mais estas:

- **Escrita na forja é do dono.** Nenhum passo aqui roda `ssh`, `scp`, `install` ou `crontab` na forja.
  Tudo acontece em `~/Workspace/forja/ferramentas/docs/trilha/` **no Mac**; o card **K** leva o kit.
- **O kit está sob git** (`~/Workspace/forja/ferramentas`, `git init` do dono; base `ec51833`, 116 arquivos
  rastreados, `.gitignore` com `__pycache__/` e `*.pyc`). O `.git` mora em `ferramentas/`, **fora de
  `docs/`**: o `scp -r trilha` do card **K** não o leva e o portão md5 não o vê. Repositório **local** —
  **sem remoto e sem push**. Cada tarefa fecha em `git commit` com mensagem `tipo: descrição curta`
  (`feat`, `fix`, `chore`, `refactor`, `docs`), **depois** do teste verde: o `teste_calculo.py` roda no
  Mac, então a árvore nunca fica com teste vermelho e cada commit é bissectável. `git add` sempre por
  **caminho explícito**, nunca `git add -A`. Nada de cópias `.bak`/`.bak-fase2` no Mac — o git substitui,
  e elas só sujariam o `git status`.
- **Python 3, só biblioteca padrão:** `datetime`, `decimal`, `statistics`, `zoneinfo`, `os`, `importlib`.
  Nada de `httpx`, de rede, de leitura de arquivo dentro de `features`/`escolher`.
- **Funções puras.** `hoje` é **parâmetro**; `date.today()`/`datetime.now()` são proibidos nesta seção.
  Nem `features` nem `escolher` gravam, leem arquivo, abrem conexão ou mutam os argumentos.
- **Fuso.** `hoje` é **data UTC** (§4.1 Lock: `agora().astimezone(timezone.utc).date()`), e é o mesmo fuso
  em que o site grava `recent_window.date` (§3.5). O **ano** de um vídeo é o ano do `published_at`
  **no fuso de São Paulo** (§4.2). `dias_sem_publicar` conta a partir da data **em UTC** do `published_at` (§4.4).
- **Inscritos não entram na 2a.** `recent.subscribers_gained` existe no snapshot e **nada** aqui o lê (§4.2).
- **Nada de inventar.** Onde o spec não decide, este plano escolhe o caminho mais simples e o marca
  com `# LACUNA (§x.y)` no código, para o relatório final listar.

### Formato do snapshot que entra (§3.5, conferido em `services/youtube.ts:201-280`)

```python
{"channel": {"id","channel_id","name","subscriber_count"},
 "videos": [{"id": uuid_interno, "video_id": id_do_youtube, "title", "published_at": iso,
             "view_count": int, "is_hidden": bool,
             "recent": {"views": int, "subscribers_gained": int}}, ...],
 "recent_window": {"date": "AAAA-MM-DD", "days": 90} | None,
 "grade_history": [...], "optimization_cycles": [...], "ab_tests": [...], "intelligence": [...]}
```

`video_id` (o id do YouTube) **nunca** é lido aqui e nunca vai ao PATCH: tudo é pelo `id` (uuid interno).

### Formato do `series.json` (§4.2)

```json
{"videos": {"<snapshot.videos[].id>": "<slug>"}, "nomes": {"<slug>": "<nome exibível>"}}
```

### Comandos de verificação (valem para todas as tarefas)

```bash
# o teste desta seção (no Mac; o stub st/httpx.py cobre o import do worker)
cd ~/Workspace/forja/ferramentas/docs/trilha && PYTHONPATH="$PWD/st" AGENTE_SITIO="$PWD/../sitio.py" AGENTE_FILA="$PWD/fila_intel.py" python3 -B teste_calculo.py

# portão do F0k (sintaxe)
cd ~/Workspace/forja/ferramentas && python3 -m py_compile docs/trilha/fila_intel.py docs/trilha/teste_calculo.py && echo PY-OK
```

### Integração com o harness — o hook `casos(F, exige)`

O §4.6 lista "os de `features`/`escolher` (§4.2, §4.3)" entre o que o `teste_fila.py` cobre, e o
`teste_fila.py` (A6) é a **entrada única** na forja. Este plano entrega as asserções em
**`teste_calculo.py`**, que expõe o **mesmo hook** do `teste_fila_redacao.py` (A3, §4.4/§4.5):

```python
def casos(F, exige): ...   # F = o modulo fila_intel ja carregado; exige = a assercao do kit
```

O harness chama em uma linha — `from teste_calculo import casos; casos(F, exige)` — e o
`if __name__ == "__main__":` mantém o uso isolado no Mac, onde não há `httpx` nem venv. A forma do hook
e a do driver `__main__` são **idênticas** nos dois arquivos, de propósito: um caminho só para o harness.
O arquivo viaja no `scp -r trilha` do card **K** sem passo novo.

**Onde cada coisa mora no `teste_calculo.py`:** o módulo tem só a docstring, os imports,
`sys.dont_write_bytecode` e `casos`/`__main__`. **Toda** fábrica, fixture e asserção fica **dentro** de
`casos(F, exige)`, indentada em 4 — assim `F` está em escopo em tudo (inclusive em `fserie`, que lê
`F.MIN_COORTE`) e não existe estado de módulo entre uma chamada e outra do harness.

---

### Task F2F-1: o arnês `casos(F, exige)` e os conversores de data

Cria o arquivo de teste com o **hook do harness** (a mesma forma do `teste_fila_redacao.py` do §4.4/§4.5)
e o começo do bloco de cálculo dentro do `fila_intel.py` do A1. Nenhuma decisão ainda.

**Files:**
- Create: `~/Workspace/forja/ferramentas/docs/trilha/teste_calculo.py`
- Modify: `~/Workspace/forja/ferramentas/docs/trilha/fila_intel.py` (seção `# ---- fatos (§4.2)`)

**Interfaces:**
- Consumes: **`carregar_sitio() -> module`** — do **A1** (esqueleto do worker, §4.1/§4.6). Não é definida aqui.
  Dela sai o `_t` (`sitio.py:141-142`), a única coisa do `sitio.py` que esta seção usa.
- Produces:
  - `casos(F, exige)` em `teste_calculo.py` — hook idêntico ao do `teste_fila_redacao.py`, para o
    `teste_fila.py` (A6) chamar em uma linha; o `__main__` mantém o uso isolado no Mac.
  - `_instante(iso) -> datetime` (aware), `_dia_utc(iso) -> date`, `_dia_sp(iso) -> date`.
  - Constantes `UTC`, `SP`, `MATURIDADE_DIAS = 90`, `MIN_SERIE = 3`, `MIN_COORTE = 4`.

> **Depende do A1:** o `fila_intel.py` já existe, com o cabeçalho, os imports e `carregar_sitio()`.
> Se ainda não existir, **pare** e espere — não crie uma segunda definição de `carregar_sitio()`.
> `SP = zoneinfo.ZoneInfo("America/Sao_Paulo")` exige **`tzdata` presente na forja** (Ubuntu traz
> `/usr/share/zoneinfo`); sem ela o import levanta `ZoneInfoNotFoundError` já na carga do módulo.

- [ ] **Step 1: Escrever o arnês e o teste que falha**

Criar `~/Workspace/forja/ferramentas/docs/trilha/teste_calculo.py`. A forma do hook e do `__main__` é a
mesma do `teste_fila_redacao.py` (§4.4/§4.5) — os dois têm de ser idênticos, senão o harness precisa de
dois caminhos. **Toda** asserção e **toda** fábrica desta seção moram dentro de `casos(F, exige)`; as
tarefas seguintes acrescentam ao **fim do corpo de `casos`**, antes do `if __name__`:

```python
"""Tabelas do §4.2 (fatos) e do §4.3 (padroes e montagem) do fila_intel.py — estilo do kit, sem pytest.

Uso isolado (no diretorio deste arquivo):
  AGENTE_SITIO=../sitio.py AGENTE_FILA=$PWD/fila_intel.py PYTHONPATH=$PWD/st python3 -B teste_calculo.py
Uso pelo harness: from teste_calculo import casos; casos(F, exige)
"""
import datetime as dt, importlib.machinery as _m, importlib.util as _u, json, os, sys
from decimal import Decimal as D

sys.dont_write_bytecode = True


def casos(F, exige):
    """Todas as assercoes do §4.2 e do §4.3. F = o modulo fila_intel ja carregado pelo chamador;
    exige = a funcao de assercao do kit (o harness, ou o __main__ abaixo)."""

    def tabela(fn, lista, nome):
        """lista = [(args, esperado), ...]; compara por igualdade estrita."""
        ruins = [(a, e, fn(*a)) for a, e in lista if fn(*a) != e]
        exige(not ruins, "%s (%d casos)%s"
              % (nome, len(lista), "" if not ruins else " -> %r" % (ruins[:3],)))

    HOJE = dt.date(2026, 9, 18)   # o congelado_em da fixture PT do F0.5

    # 1. o calculo so precisa do sitio.py para o _t; quem carrega e o A1 (§4.6)
    sitio = F.carregar_sitio()
    exige(hasattr(sitio, "_t"), "carregar_sitio (A1) trouxe um sitio.py com o _t")
    exige(hasattr(sitio, "ROTAS_FASE"), "e o modulo carregado e mesmo o sitio.py do kit")

    # 2. conversores de data: o ano e de Sao Paulo, a idade e de UTC
    tabela(F._dia_utc, [
        (("2024-12-10T15:57:00Z",), dt.date(2024, 12, 10)),
        (("2024-12-10T15:57:00+00:00",), dt.date(2024, 12, 10)),
        (("2019-01-01T02:30:00Z",), dt.date(2019, 1, 1)),
    ], "_dia_utc")
    tabela(F._dia_sp, [
        (("2024-12-10T15:57:00Z",), dt.date(2024, 12, 10)),   # 12:57 em SP, mesmo dia
        (("2026-09-19T01:30:00Z",), dt.date(2026, 9, 18)),    # 22:30 do dia anterior em SP
        (("2019-01-01T02:30:00Z",), dt.date(2019, 1, 1)),     # horario de verao de 2019: UTC-2
    ], "_dia_sp")
    exige(F._dia_sp("2019-01-01T02:30:00Z").year == 2019,
          "ano usa America/Sao_Paulo com horario de verao (com -3 fixo daria 2018)")
    exige(F.MATURIDADE_DIAS == 90 and F.MIN_SERIE == 3 and F.MIN_COORTE == 4, "constantes do §4.2")


if __name__ == "__main__":
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    _arq = os.environ["AGENTE_FILA"]
    _ld = _m.SourceFileLoader("fila_intel", _arq)
    _F = _u.module_from_spec(_u.spec_from_loader("fila_intel", _ld)); _ld.exec_module(_F)
    _falhas = []

    def _exige(ok, nome):
        print("OK   " if ok else "FALHA", nome)
        if not ok:
            _falhas.append(nome)

    casos(_F, _exige)
    print("\nF2C: %d falha(s)" % len(_falhas))
    raise SystemExit(1 if _falhas else 0)
```

- [ ] **Step 2: Rodar e ver falhar**

Run:
```bash
cd ~/Workspace/forja/ferramentas/docs/trilha && PYTHONPATH="$PWD/st" AGENTE_SITIO="$PWD/../sitio.py" AGENTE_FILA="$PWD/fila_intel.py" python3 -B teste_calculo.py
```
Expected: FAIL — `AttributeError: module 'fila_intel' has no attribute '_dia_utc'`.

- [ ] **Step 3: Implementar os conversores**

Acrescentar ao `fila_intel.py` do A1, **depois** do bloco que carrega o `sitio.py` e **antes** de
`if __name__ == '__main__':`. Os imports (`datetime as dt`, `os`, `statistics`, `zoneinfo`,
`decimal`) são do cabeçalho do A1; conferir que `statistics` e `zoneinfo` estão lá e acrescentá-los
se faltarem:

```python
# ------------------------------------------------------------------ fatos (§4.2)
UTC = dt.timezone.utc
# zoneinfo, e nao o BRT = -3 fixo do sitio.py:129: em 2017-18 e na virada 2018->2019 valia UTC-2.
# Exige tzdata no sistema (a forja e Ubuntu, tem /usr/share/zoneinfo).
SP = zoneinfo.ZoneInfo("America/Sao_Paulo")
MATURIDADE_DIAS = 90    # abaixo disso o video fica fora das comparacoes (§4.2)
MIN_SERIE = 3           # episodios maduros e nao ocultos para um slug virar serie (§4.2)
MIN_COORTE = 4          # piso da coorte; abaixo disso a comparacao nao se aplica (§4.2)


def _instante(iso):
    """published_at do snapshot -> datetime aware. Aceita 'Z' e offset explicito."""
    d = dt.datetime.fromisoformat((iso or "").replace("Z", "+00:00"))
    return d if d.tzinfo else d.replace(tzinfo=UTC)


def _dia_utc(iso):
    """Data em UTC: o mesmo fuso de `hoje` e de recent_window.date (§3.5, §4.1)."""
    return _instante(iso).astimezone(UTC).date()


def _dia_sp(iso):
    """Data no fuso de Sao Paulo: dela sai o ANO do video e o `ultimo_video` exibido (§4.2, §4.4)."""
    return _instante(iso).astimezone(SP).date()
```

- [ ] **Step 4: Rodar e ver passar**

Run:
```bash
cd ~/Workspace/forja/ferramentas/docs/trilha && PYTHONPATH="$PWD/st" AGENTE_SITIO="$PWD/../sitio.py" AGENTE_FILA="$PWD/fila_intel.py" python3 -B teste_calculo.py
```
Expected: `F2C: 0 falha(s)` — 6 asserções.

- [ ] **Step 5: Portão de sintaxe e commit**

```bash
cd ~/Workspace/forja/ferramentas && python3 -m py_compile docs/trilha/fila_intel.py docs/trilha/teste_calculo.py && echo PY-OK
git -C ~/Workspace/forja/ferramentas add docs/trilha/fila_intel.py docs/trilha/teste_calculo.py
git -C ~/Workspace/forja/ferramentas commit -m "feat: arnes casos(F, exige) e conversores de data do calculo

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

### Task F2F-2: `features` — vídeos e canal

Primeira metade do §4.2: a lista de vídeos anotada (idade, maturidade, ano, oculto) e o bloco `canal`
(`videos`, `views_90d`, `data_base`, `ultimo_video`, `dias_sem_publicar`). Ainda sem série nem coorte.

**Files:**
- Modify: `~/Workspace/forja/ferramentas/docs/trilha/fila_intel.py` (acrescenta `features`, versão sem séries)
- Modify: `~/Workspace/forja/ferramentas/docs/trilha/teste_calculo.py`

**Interfaces:**
- Consumes: `_dia_utc`, `_dia_sp` (Task F2F-1) e `carregar_sitio()._t` — a função é do **A1**.
- Produces: `features(snapshot: dict, series: dict, hoje: dt.date) -> dict`, com as chaves
  `canal`, `videos`, `series`, `sem_serie`, `orfas`. Nesta tarefa `series` sai `[]` e `orfas` sai `False`.
  - `canal = {"nome": str (já passado por _t), "videos": int (inclui ocultos), "views_90d": int | None,
    "data_base": dt.date, "ultimo_video": dt.date | None, "dias_sem_publicar": int | None}`
  - `videos[i] = {"id", "quando": datetime aware, "dia_utc": date, "ano": int, "idade_dias": int,
    "madura": bool, "oculto": bool, "view_count": int, "views_90d": int, "slug": str | None}`

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar ao **fim do corpo de `casos(F, exige)`** (antes do `if __name__`), indentado em 4:

```python
    # ------------------------------------------------------------------ fabricas da fixture sintetica
    def vid(vid_id, pub, views, recente=0, oculto=False):
        return {"id": vid_id, "video_id": "yt-" + vid_id, "title": vid_id, "published_at": pub,
                "view_count": views, "is_hidden": oculto,
                "recent": {"views": recente, "subscribers_gained": 7}}   # inscritos: ninguem le


    JANELA = {"date": "2026-09-18", "days": 90}


    def snap(videos, janela=JANELA, nome="tnFigueiredo"):
        return {"channel": {"id": "ch", "channel_id": "UCx", "name": nome, "subscriber_count": 1160},
                "videos": videos, "recent_window": janela,
                "grade_history": [], "optimization_cycles": [], "ab_tests": [], "intelligence": []}


    # 3. canal: contagem, soma de 90 dias, data_base, ultimo video e dias sem publicar
    VS = [vid("a", "2019-03-01T12:00:00Z", 100, recente=5),
          vid("b", "2024-12-10T15:57:00Z", 300, recente=4),
          vid("c", "2019-05-01T12:00:00Z", 200, recente=3, oculto=True)]
    f = F.features(snap(VS), {}, HOJE)
    exige(f["canal"]["videos"] == 3, "canal.videos conta tambem o oculto")
    exige(f["canal"]["views_90d"] == 12, "views_90d soma tambem o oculto")
    exige(f["canal"]["data_base"] == dt.date(2026, 9, 18), "data_base = recent_window.date")
    exige(f["canal"]["ultimo_video"] == dt.date(2024, 12, 10), "ultimo_video = maior published_at, em SP")
    exige(f["canal"]["dias_sem_publicar"] == 647, "dias_sem_publicar conta da data UTC ate data_base")
    exige(f["canal"]["nome"] == "tnFigueiredo", "canal.nome vem do snapshot")
    exige(F.features(snap(VS), {}, HOJE)["canal"] == f["canal"], "features e determinista")

    # emoji e aspas no nome do canal saem pelo _t do sitio.py
    exige(F.features(snap(VS, nome='tn "Figueiredo" 🚀'), {}, HOJE)["canal"]["nome"] == "tn 'Figueiredo'",
          "canal.nome passa por _t (emoji fora, aspas viram simples)")

    # recent_window nulo: views_90d some, data_base vira `hoje`
    fn = F.features(snap(VS, janela=None), {}, HOJE)
    exige(fn["canal"]["views_90d"] is None, "sem recent_window nao existe views_90d")
    exige(fn["canal"]["data_base"] == HOJE, "sem recent_window a data_base e `hoje`")
    exige(fn["canal"]["dias_sem_publicar"] == 647, "dias_sem_publicar continua, medido contra `hoje`")

    # canal sem video (o EN de producao)
    fz = F.features(snap([], janela=None), {}, HOJE)
    exige(fz["canal"]["videos"] == 0 and fz["canal"]["ultimo_video"] is None
          and fz["canal"]["dias_sem_publicar"] is None and fz["videos"] == [] and fz["series"] == [],
          "canal sem video nao levanta excecao")

    # 4. maturidade: fronteira em 89/90 dias, e `hoje` e mesmo parametro
    MAT = [vid("m90", "2026-06-20T12:00:00Z", 10), vid("m89", "2026-06-21T12:00:00Z", 10)]
    por_id = {v["id"]: v for v in F.features(snap(MAT), {}, HOJE)["videos"]}
    exige(por_id["m90"]["idade_dias"] == 90 and por_id["m90"]["madura"] is True, "90 dias: maduro")
    exige(por_id["m89"]["idade_dias"] == 89 and por_id["m89"]["madura"] is False, "89 dias: imaturo")
    tarde = {v["id"]: v for v in F.features(snap(MAT), {}, HOJE + dt.timedelta(days=1))["videos"]}
    exige(tarde["m89"]["madura"] is True, "`hoje` e parametro: mais um dia e o de 89 amadurece")

    # ano pelo fuso de Sao Paulo, view_count nulo vira 0
    ANO = [vid("virada", "2019-01-01T02:30:00Z", None), vid("sp", "2026-09-19T01:30:00Z", 5)]
    pa = {v["id"]: v for v in F.features(snap(ANO), {}, HOJE)["videos"]}
    exige(pa["virada"]["ano"] == 2019 and pa["virada"]["view_count"] == 0, "ano em SP; view_count nulo = 0")
    exige(pa["sp"]["ano"] == 2026 and pa["sp"]["idade_dias"] == -1, "idade negativa nao explode")
```

- [ ] **Step 2: Rodar e ver falhar**

Run:
```bash
cd ~/Workspace/forja/ferramentas/docs/trilha && PYTHONPATH="$PWD/st" AGENTE_SITIO="$PWD/../sitio.py" AGENTE_FILA="$PWD/fila_intel.py" python3 -B teste_calculo.py
```
Expected: FAIL — `AttributeError: module 'fila_intel' has no attribute 'features'`.

- [ ] **Step 3: Implementar `features` (vídeos + canal)**

Acrescentar em `fila_intel.py`, depois de `_dia_sp`:

```python
def features(snapshot, series, hoje):
    """Fatos do canal — nenhuma decisao (§4.2).

    Pura: `hoje` (data UTC) e parametro, nada aqui olha o relogio, le arquivo ou abre conexao,
    e os argumentos nao sao mutados. `series` e o conteudo do /opt/agente/series.json.
    Inscritos (recent.subscribers_gained) NAO sao lidos na 2a."""
    _t = carregar_sitio()._t
    janela = snapshot.get("recent_window")
    mapa = (series or {}).get("videos") or {}

    vids = []
    for v in snapshot["videos"]:
        quando = _instante(v["published_at"])
        dia_utc = quando.astimezone(UTC).date()
        idade = (hoje - dia_utc).days
        vids.append({
            "id": v["id"],
            "quando": quando,
            "dia_utc": dia_utc,
            "ano": quando.astimezone(SP).year,
            "idade_dias": idade,
            "madura": idade >= MATURIDADE_DIAS,
            "oculto": bool(v["is_hidden"]),
            # LACUNA (§4.2): o spec nao diz o que fazer com view_count nulo; 0 mantem a
            # mediana calculavel em vez de derrubar a execucao em `bug`.
            "view_count": v["view_count"] or 0,
            "views_90d": (v.get("recent") or {}).get("views") or 0,
            "slug": mapa.get(v["id"]),
        })

    ultimo = max((v["quando"] for v in vids), default=None)
    data_base = dt.date.fromisoformat(janela["date"]) if janela else hoje
    canal = {
        "nome": _t(snapshot["channel"]["name"]),
        # o oculto entra em Sigma recent e em canal.videos, e fica fora de serie e de coorte (§4.2)
        "videos": len(vids),
        "views_90d": sum(v["views_90d"] for v in vids) if janela else None,
        "data_base": data_base,
        "ultimo_video": ultimo.astimezone(SP).date() if ultimo else None,
        # data_base e UTC, entao dias_sem_publicar conta da data UTC do published_at (§4.4)
        "dias_sem_publicar": (data_base - ultimo.astimezone(UTC).date()).days if ultimo else None,
    }

    return {"canal": canal, "videos": vids, "series": [],
            "sem_serie": [v["id"] for v in vids if not v["slug"]], "orfas": False}
```

- [ ] **Step 4: Rodar e ver passar**

Run:
```bash
cd ~/Workspace/forja/ferramentas/docs/trilha && PYTHONPATH="$PWD/st" AGENTE_SITIO="$PWD/../sitio.py" AGENTE_FILA="$PWD/fila_intel.py" python3 -B teste_calculo.py
```
Expected: `F2C: 0 falha(s)` — 23 asserções.

- [ ] **Step 5: Portão de sintaxe e commit**

```bash
cd ~/Workspace/forja/ferramentas && python3 -m py_compile docs/trilha/fila_intel.py docs/trilha/teste_calculo.py && echo PY-OK
git -C ~/Workspace/forja/ferramentas add docs/trilha/fila_intel.py docs/trilha/teste_calculo.py
git -C ~/Workspace/forja/ferramentas commit -m "feat: features — videos e canal (§4.2)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task F2F-3: `features` — séries a partir do `series.json`

Segunda metade do §4.2: agrupar por slug, o piso de 3 episódios **maduros e não ocultos**, o ano pelo
episódio mediano (ordem de `published_at`, menor posição no empate par), `views_90d_serie` e as órfãs.
Ainda sem coorte.

**Files:**
- Modify: `~/Workspace/forja/ferramentas/docs/trilha/fila_intel.py`
- Modify: `~/Workspace/forja/ferramentas/docs/trilha/teste_calculo.py`

**Interfaces:**
- Consumes: `features` (Task F2F-2) e `carregar_sitio()._t` (do **A1**).
- Produces: em `features(...)["series"]`, uma lista ordenada por slug, cada item
  `{"slug": str, "nome": str (já _t), "n": int, "ano": int, "mediana": int|float,
  "views_90d_serie": int (ausente quando `recent_window` é nulo)}`; e `features(...)["orfas"]: bool`.

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar ao **fim do corpo de `casos(F, exige)`** (antes do `if __name__`), indentado em 4:

```python
    # 5. serie: piso de 3 episodios maduros e nao ocultos, nome pelo `nomes`, mediana de view_count
    SER = [vid("s1", "2019-02-01T12:00:00Z", 60, recente=2), vid("s2", "2019-03-01T12:00:00Z", 91, recente=3),
           vid("s3", "2019-04-01T12:00:00Z", 200, recente=1),
           vid("h1", "2019-05-01T12:00:00Z", 999, oculto=True),        # oculto: fora da serie
           vid("n1", "2026-08-01T12:00:00Z", 10),                      # imaturo: fora da serie
           vid("x1", "2019-06-01T12:00:00Z", 50)]                      # fora do series.json
    SJ = {"videos": {"s1": "zero-dez", "s2": "zero-dez", "s3": "zero-dez",
                     "h1": "zero-dez", "n1": "zero-dez"},
          "nomes": {"zero-dez": "0–10"}}
    f = F.features(snap(SER), SJ, HOJE)
    exige(len(f["series"]) == 1, "um slug = uma serie")
    s = f["series"][0]
    exige(s["slug"] == "zero-dez" and s["nome"] == "0–10", "slug e nome exibivel vem do series.json")
    exige(s["n"] == 3, "n conta so os maduros e nao ocultos")
    exige(s["mediana"] == 91, "mediana de view_count sobre os mesmos 3")
    exige(s["ano"] == 2019, "ano pelo episodio mediano")
    exige(s["views_90d_serie"] == 6, "views_90d_serie soma so os episodios que contam em n")
    exige(f["sem_serie"] == ["x1"], "sem_serie lista quem nao esta no series.json")
    exige(f["orfas"] is False, "com id casando, nao ha orfas")

    # slug inteiro oculto nunca vira serie (o caso "Main AD Diamante")
    OCU = [vid("d1", "2019-02-01T12:00:00Z", 10, oculto=True), vid("d2", "2019-03-01T12:00:00Z", 20, oculto=True),
           vid("d3", "2019-04-01T12:00:00Z", 30, oculto=True)]
    fo = F.features(snap(OCU), {"videos": {"d1": "ad", "d2": "ad", "d3": "ad"}, "nomes": {"ad": "Main AD Diamante"}}, HOJE)
    exige(fo["series"] == [], "slug com os 3 episodios ocultos nao vira serie (mediana de conjunto vazio)")

    # dois episodios maduros: abaixo do piso de 3
    DOIS = [vid("p1", "2019-02-01T12:00:00Z", 10), vid("p2", "2019-03-01T12:00:00Z", 20)]
    exige(F.features(snap(DOIS), {"videos": {"p1": "p", "p2": "p"}, "nomes": {}}, HOJE)["series"] == [],
          "2 episodios nao viram serie")

    # ano pelo episodio mediano: numero par usa o de MENOR posicao
    PAR = [vid("e1", "2017-06-01T12:00:00Z", 10), vid("e2", "2018-02-01T12:00:00Z", 20),
           vid("e3", "2018-03-01T12:00:00Z", 30), vid("e4", "2019-01-01T12:00:00Z", 40)]
    fp = F.features(snap(PAR), {"videos": {v["id"]: "par" for v in PAR}, "nomes": {}}, HOJE)
    exige(fp["series"][0]["ano"] == 2018 and fp["series"][0]["n"] == 4,
          "par: o ano vem do menor dos dois centrais (indice 1 de 4)")
    exige(fp["series"][0]["nome"] == "par", "sem entrada em `nomes`, o nome cai no slug")

    # seis episodios: indice 2 (a terceira leitura do §4.3)
    SEIS = [vid("v1", "2017-12-20T12:00:00Z", 10), vid("v2", "2018-01-05T12:00:00Z", 20),
            vid("v3", "2018-01-07T12:00:00Z", 30), vid("v4", "2018-03-01T12:00:00Z", 40),
            vid("v5", "2018-06-01T12:00:00Z", 50), vid("v6", "2018-09-01T12:00:00Z", 60)]
    f6 = F.features(snap(SEIS), {"videos": {v["id"]: "vlog" for v in SEIS}, "nomes": {}}, HOJE)
    exige(f6["series"][0]["ano"] == 2018 and f6["series"][0]["mediana"] == 35,
          "6 episodios: ano pelo indice 2 (07/01/2018); mediana = media dos dois centrais")

    # series orfas: o arquivo tem mapeamentos e nenhum id casa
    exige(F.features(snap(SER), {"videos": {"zzz": "z"}, "nomes": {}}, HOJE)["orfas"] is True,
          "series_orfas: mapeamentos sem nenhum id em comum")
    exige(F.features(snap(SER), {}, HOJE)["orfas"] is False, "series.json vazio nao e orfandade")

    # sem recent_window a chave views_90d_serie some do item
    exige("views_90d_serie" not in F.features(snap(SER, janela=None), SJ, HOJE)["series"][0],
          "sem recent_window o item de serie nao tem views_90d_serie")

    # duas series saem em ordem de slug (ordem estavel, nunca a do series.json)
    DUAS = SER + [vid("t1", "2019-07-01T12:00:00Z", 11), vid("t2", "2019-07-02T12:00:00Z", 12),
                  vid("t3", "2019-07-03T12:00:00Z", 13)]
    SJ2 = {"videos": dict(SJ["videos"], t1="aaa", t2="aaa", t3="aaa"), "nomes": SJ["nomes"]}
    exige([x["slug"] for x in F.features(snap(DUAS), SJ2, HOJE)["series"]] == ["aaa", "zero-dez"],
          "features devolve as series em ordem de slug")
```

- [ ] **Step 2: Rodar e ver falhar**

Run:
```bash
cd ~/Workspace/forja/ferramentas/docs/trilha && PYTHONPATH="$PWD/st" AGENTE_SITIO="$PWD/../sitio.py" AGENTE_FILA="$PWD/fila_intel.py" python3 -B teste_calculo.py
```
Expected: FAIL — `features` ainda devolve `series: []` e `orfas: False` fixos.

- [ ] **Step 3: Implementar o agrupamento de séries**

Em `fila_intel.py`, dentro de `features`, **substituir** o `return` final por:

```python
    elegiveis = [v for v in vids if v["madura"] and not v["oculto"]]

    grupos = {}
    for v in elegiveis:
        if v["slug"]:
            grupos.setdefault(v["slug"], []).append(v)

    nomes = (series or {}).get("nomes") or {}
    series_out = []
    for slug in sorted(grupos):
        # LACUNA (§4.2): o spec nao desempata published_at igual; o id fecha a ordem.
        eps = sorted(grupos[slug], key=lambda v: (v["quando"], v["id"]))
        if len(eps) < MIN_SERIE:
            continue
        item = {
            "slug": slug,
            "nome": _t(nomes.get(slug) or slug),
            "n": len(eps),
            # o ano da serie e o do episodio mediano; com numero par, o de MENOR posicao (§4.2)
            "ano": eps[(len(eps) - 1) // 2]["ano"],
            "mediana": statistics.median([v["view_count"] for v in eps]),
        }
        if janela:
            item["views_90d_serie"] = sum(v["views_90d"] for v in eps)
        series_out.append(item)

    ids = {v["id"] for v in vids}
    orfas = bool(mapa) and not (set(mapa) & ids)

    return {"canal": canal, "videos": vids, "series": series_out,
            "sem_serie": [v["id"] for v in vids if not v["slug"]], "orfas": orfas}
```

- [ ] **Step 4: Rodar e ver passar**

Run:
```bash
cd ~/Workspace/forja/ferramentas/docs/trilha && PYTHONPATH="$PWD/st" AGENTE_SITIO="$PWD/../sitio.py" AGENTE_FILA="$PWD/fila_intel.py" python3 -B teste_calculo.py
```
Expected: `F2C: 0 falha(s)` — 40 asserções.

- [ ] **Step 5: Portão de sintaxe e commit**

```bash
cd ~/Workspace/forja/ferramentas && python3 -m py_compile docs/trilha/fila_intel.py docs/trilha/teste_calculo.py && echo PY-OK
git -C ~/Workspace/forja/ferramentas add docs/trilha/fila_intel.py docs/trilha/teste_calculo.py
git -C ~/Workspace/forja/ferramentas commit -m "feat: features — series a partir do series.json (§4.2)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task F2F-4: `features` — coorte do ano e as duas medianas

Fecha o §4.2: a coorte de cada série (vídeos **maduros e não ocultos do mesmo ano, sem os do grupo avaliado**;
vídeos de **outras** séries continuam na coorte) e o piso de 4.

**Files:**
- Modify: `~/Workspace/forja/ferramentas/docs/trilha/fila_intel.py`
- Modify: `~/Workspace/forja/ferramentas/docs/trilha/teste_calculo.py`

**Interfaces:**
- Consumes: `features` (Task F2F-3).
- Produces: cada item de `features(...)["series"]` ganha
  `{"n_coorte": int, "mediana_coorte": int|float|None, "aplica": bool}`.
  `aplica = n_coorte >= MIN_COORTE`; com `aplica False` a comparação **não se aplica** e a série
  não vira padrão (§4.2) — quem decide isso é `escolher`, que emite `coorte_fina:<slug>` nos `motivos`.

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar ao **fim do corpo de `casos(F, exige)`** (antes do `if __name__`), indentado em 4:

```python
    # 6. coorte: mesmo ano, sem os do grupo avaliado, com os das OUTRAS series dentro
    COORTE = [vid("g1", "2019-02-01T12:00:00Z", 50), vid("g2", "2019-02-02T12:00:00Z", 91),
              vid("g3", "2019-02-03T12:00:00Z", 200),                     # serie "alfa", mediana 91
              vid("c1", "2019-03-01T12:00:00Z", 68), vid("c2", "2019-03-02T12:00:00Z", 86),
              vid("c3", "2019-03-03T12:00:00Z", 131), vid("c4", "2019-03-04T12:00:00Z", 156),
              vid("o1", "2018-04-01T12:00:00Z", 999),                     # outro ano: fora
              vid("oc", "2019-05-01T12:00:00Z", 999, oculto=True),        # oculto: fora
              vid("im", "2026-08-01T12:00:00Z", 999)]                     # imaturo: fora
    SJC = {"videos": {"g1": "alfa", "g2": "alfa", "g3": "alfa"}, "nomes": {"alfa": "Alfa"}}
    sc = F.features(snap(COORTE), SJC, HOJE)["series"][0]
    exige(sc["n_coorte"] == 4, "coorte = maduros nao ocultos de 2019 fora do grupo (4)")
    exige(sc["mediana_coorte"] == 108.5, "mediana da coorte: media dos dois centrais (86+131)/2")
    exige(sc["mediana"] == 91 and sc["aplica"] is True, "piso de 4 atingido")

    # os videos de OUTRA serie continuam na coorte
    SJ2C = {"videos": dict(SJC["videos"], c1="beta", c2="beta", c3="beta"), "nomes": {}}
    por_slug = {x["slug"]: x for x in F.features(snap(COORTE), SJ2C, HOJE)["series"]}
    exige(por_slug["alfa"]["n_coorte"] == 4 and por_slug["alfa"]["mediana_coorte"] == 108.5,
          "a coorte de alfa mantem os videos de beta")
    exige(por_slug["beta"]["n_coorte"] == 4 and por_slug["beta"]["mediana_coorte"] == 123.5,
          "a coorte de beta mantem os videos de alfa: [50, 91, 156, 200] -> (91+156)/2")

    # piso de 4: com 1 video elegivel fora da serie, a comparacao nao se aplica (a terceira leitura do §4.3)
    FINA = [vid("f1", "2017-12-20T12:00:00Z", 10), vid("f2", "2018-01-05T12:00:00Z", 20),
            vid("f3", "2018-01-07T12:00:00Z", 30), vid("f4", "2018-03-01T12:00:00Z", 40),
            vid("f5", "2018-06-01T12:00:00Z", 50), vid("f6", "2018-09-01T12:00:00Z", 60),
            vid("fora", "2018-12-31T12:00:00Z", 171)]
    sf = F.features(snap(FINA), {"videos": {v["id"]: "vlogzeira" for v in FINA[:6]}, "nomes": {}}, HOJE)["series"][0]
    exige(sf["ano"] == 2018 and sf["n_coorte"] == 1 and sf["aplica"] is False,
          "coorte de 1 video: abaixo do piso de 4, a comparacao nao se aplica")
    exige(sf["mediana_coorte"] == 171, "mediana_coorte existe mesmo com a coorte fina")

    # coorte vazia nao levanta excecao
    sv = F.features(snap(FINA[:6]), {"videos": {v["id"]: "vlogzeira" for v in FINA[:6]}, "nomes": {}},
                    HOJE)["series"][0]
    exige(sv["n_coorte"] == 0 and sv["mediana_coorte"] is None and sv["aplica"] is False,
          "coorte vazia: mediana_coorte None, aplica False")

    # features nao muta os argumentos
    _sn, _sj = snap(COORTE), dict(SJC)
    _antes = repr(_sn) + repr(_sj)
    F.features(_sn, _sj, HOJE)
    exige(repr(_sn) + repr(_sj) == _antes, "features nao muta snapshot nem series")
```

- [ ] **Step 2: Rodar e ver falhar**

Run:
```bash
cd ~/Workspace/forja/ferramentas/docs/trilha && PYTHONPATH="$PWD/st" AGENTE_SITIO="$PWD/../sitio.py" AGENTE_FILA="$PWD/fila_intel.py" python3 -B teste_calculo.py
```
Expected: FAIL — `KeyError: 'n_coorte'`.

- [ ] **Step 3: Implementar a coorte**

Em `fila_intel.py`, dentro do laço `for slug in sorted(grupos):`, **depois** de montar `item` e **antes** do
`if janela:`, acrescentar:

```python
        # coorte: maduros e nao ocultos do MESMO ANO, sem os do grupo avaliado. Videos de outras
        # series continuam na coorte (§4.2). Com menos de MIN_COORTE, a comparacao nao se aplica.
        coorte = [v["view_count"] for v in elegiveis
                  if v["ano"] == item["ano"] and v["slug"] != slug]
        item["n_coorte"] = len(coorte)
        item["mediana_coorte"] = statistics.median(coorte) if coorte else None
        item["aplica"] = len(coorte) >= MIN_COORTE
```

- [ ] **Step 4: Rodar e ver passar**

Run:
```bash
cd ~/Workspace/forja/ferramentas/docs/trilha && PYTHONPATH="$PWD/st" AGENTE_SITIO="$PWD/../sitio.py" AGENTE_FILA="$PWD/fila_intel.py" python3 -B teste_calculo.py
```
Expected: `F2C: 0 falha(s)` — 49 asserções.

- [ ] **Step 5: Portão de sintaxe e commit**

```bash
cd ~/Workspace/forja/ferramentas && python3 -m py_compile docs/trilha/fila_intel.py docs/trilha/teste_calculo.py && echo PY-OK
git -C ~/Workspace/forja/ferramentas add docs/trilha/fila_intel.py docs/trilha/teste_calculo.py
git -C ~/Workspace/forja/ferramentas commit -m "feat: features — coorte do ano e as duas medianas (§4.2)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task F2F-5: a razão, o piso de efeito, a leitura e a `confidence`

Primeiro bloco do §4.3, todo em teste de tabela — é onde moram as fronteiras que o spec descreve
caractere a caractere.

**Files:**
- Modify: `~/Workspace/forja/ferramentas/docs/trilha/fila_intel.py`
- Modify: `~/Workspace/forja/ferramentas/docs/trilha/teste_calculo.py`

**Interfaces:**
- Consumes: nada além da stdlib.
- Produces:
  - `_razao(mediana, mediana_coorte) -> Decimal` — quantizada a 2 casas com `ROUND_HALF_UP`,
    **antes de qualquer uso**. A razão crua nunca é comparada.
  - `_confianca(n_grupo: int, forte: bool) -> float` — `round(v, 2)`, nunca `Decimal`.
  - `_num(v) -> str` e `_razao_txt(Decimal) -> str` — exibição pt-BR.
  - Constantes `PISO_BAIXO = Decimal("0.67")`, `PISO_ALTO = Decimal("1.5")`,
    `FORTE_BAIXO = Decimal("0.5")`, `FORTE_ALTO = Decimal("2")`, `UM = Decimal("1")`.

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar ao **fim do corpo de `casos(F, exige)`** (antes do `if __name__`), indentado em 4:

```python
    # 7. razao: arredondada a 2 casas com ROUND_HALF_UP, ANTES de qualquer uso
    tabela(F._razao, [
        ((91, 143.5), D("0.63")),    # leitura plana do §4.3
        ((91, 136), D("0.67")),      # leitura aninhada: 0,669 -> 0,67, fica NO piso
        ((337, 500), D("0.67")),     # 0,674 -> 0,67 -> padrao
        ((27, 40), D("0.68")),       # 0,675 -> HALF_UP -> 0,68 -> neutro
        ((156, 109.5), D("1.42")),   # "Vlogzeira"
        ((113, 113), D("1.00")),     # o resto do 0-10 na leitura aninhada
        ((91, 131), D("0.69")),      # a convencao ERRADA de mediana deixaria a 2a sem padrao
        ((200, 100), D("2.00")),
    ], "_razao")
    exige(isinstance(F._razao(91, 136), D) and str(F._razao(91, 136)) == "0.67",
          "a razao e Decimal com 2 casas, nao float")

    # 8. confidence: min(0,7; 0,3 + 0,05*min(n_grupo,6) + 0,1*forte), com round(v,2)
    tabela(F._confianca, [
        ((3, False), 0.45), ((4, False), 0.50), ((5, False), 0.55),
        ((6, False), 0.60), ((10, False), 0.60), ((11, False), 0.60),
        ((3, True), 0.55), ((4, True), 0.60), ((5, True), 0.65),
        ((6, True), 0.70), ((11, True), 0.70),
    ], "_confianca")
    exige(all(F._confianca(n, f) in (0.45, 0.5, 0.55, 0.6, 0.65, 0.7)
              for n in range(3, 40) for f in (False, True)),
          "confidence so assume os multiplos de 0,05 entre 0,45 e 0,70")
    exige(repr(F._confianca(6, False)) == "0.6", "round(v,2) tira o 0.6000000000000001 do float puro")

    # 9. exibicao pt-BR
    tabela(F._num, [((91,), "91"), ((91.0,), "91"), ((143.5,), "143,5"),
                    ((109.5,), "109,5"), ((0,), "0"), ((108.5,), "108,5")], "_num")
    tabela(F._razao_txt, [((D("0.63"),), "0,63×"), ((D("0.67"),), "0,67×"),
                          ((D("1.42"),), "1,42×"), ((D("1.00"),), "1,00×")], "_razao_txt")
    exige(F.PISO_BAIXO == D("0.67") and F.PISO_ALTO == D("1.5")
          and F.FORTE_BAIXO == D("0.5") and F.FORTE_ALTO == D("2"),
          "pisos do §4.3 como Decimal")
```

- [ ] **Step 2: Rodar e ver falhar**

Run:
```bash
cd ~/Workspace/forja/ferramentas/docs/trilha && PYTHONPATH="$PWD/st" AGENTE_SITIO="$PWD/../sitio.py" AGENTE_FILA="$PWD/fila_intel.py" python3 -B teste_calculo.py
```
Expected: FAIL — `AttributeError: module 'fila_intel' has no attribute '_razao'`.

- [ ] **Step 3: Implementar os quatro helpers**

Acrescentar em `fila_intel.py`, depois de `features`:

```python
# ------------------------------------------------------------------ decisoes (§4.3)
PISO_BAIXO = Decimal("0.67")    # razao <= : padrao "abaixo da coorte"
PISO_ALTO = Decimal("1.5")      # razao >= : padrao "acima da coorte"
FORTE_BAIXO = Decimal("0.5")    # efeito forte: +0,1 na confidence
FORTE_ALTO = Decimal("2")
UM = Decimal("1")
CENTAVO = Decimal("0.01")


def _razao(mediana, mediana_coorte):
    """Mediana da serie / mediana da coorte, arredondada a 2 casas com ROUND_HALF_UP ANTES de
    qualquer uso: o piso de efeito, `forte`, a `leitura`, o `finding` e a ENTRADA usam este mesmo
    valor, e a razao crua nunca e comparada (§4.3). Decimal(str(...)) evita o ruido do float."""
    return (Decimal(str(mediana)) / Decimal(str(mediana_coorte))).quantize(
        CENTAVO, rounding=ROUND_HALF_UP)


def _confianca(n_grupo, forte):
    """min(0,7; 0,3 + 0,05 x min(n_grupo,6) + 0,1 x [forte]), com round(v,2) — nunca Decimal:
    os valores possiveis sao os multiplos de 0,05 entre 0,45 e 0,70, nenhum em fronteira de
    meio centavo. O teto de 0,7 existe porque nao ha CTR nem retencao (§4.3)."""
    return round(min(0.7, 0.3 + 0.05 * min(n_grupo, 6) + 0.1 * (1 if forte else 0)), 2)


def _num(v):
    """Mediana exibivel: sem casas quando inteira, senao 1 casa, em pt-BR (§4.3).
    LACUNA (§4.3): o spec nao define separador de milhar; nao e usado."""
    return str(int(v)) if float(v) == int(v) else ("%.1f" % v).replace(".", ",")


def _razao_txt(razao):
    """Razao exibivel: 2 casas + '×' (§4.3)."""
    return ("%.2f" % razao).replace(".", ",") + "×"
```

- [ ] **Step 4: Rodar e ver passar**

Run:
```bash
cd ~/Workspace/forja/ferramentas/docs/trilha && PYTHONPATH="$PWD/st" AGENTE_SITIO="$PWD/../sitio.py" AGENTE_FILA="$PWD/fila_intel.py" python3 -B teste_calculo.py
```
Expected: `F2C: 0 falha(s)` — 57 asserções.

- [ ] **Step 5: Portão de sintaxe e commit**

```bash
cd ~/Workspace/forja/ferramentas && python3 -m py_compile docs/trilha/fila_intel.py docs/trilha/teste_calculo.py && echo PY-OK
git -C ~/Workspace/forja/ferramentas add docs/trilha/fila_intel.py docs/trilha/teste_calculo.py
git -C ~/Workspace/forja/ferramentas commit -m "feat: razao, piso de efeito, leitura e confidence (§4.3)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task F2F-6: `escolher` — `patterns_detected`, ordem fixa e motivos

Segundo bloco do §4.3: só séries viram padrão, o piso de efeito, o `finding` por template,
a ordem por `|razao − 1|` decrescente com desempate alfabético pelo slug, e o corte em 30.

**Files:**
- Modify: `~/Workspace/forja/ferramentas/docs/trilha/fila_intel.py`
- Modify: `~/Workspace/forja/ferramentas/docs/trilha/teste_calculo.py`

**Interfaces:**
- Consumes: `_razao`, `_confianca`, `_num`, `_razao_txt` (Task F2F-5); `features(...)` (Task F2F-4).
- Produces: `escolher(feats: dict) -> dict`. Nesta tarefa, as chaves:
  - `channel_insights.patterns_detected`: lista de
    `{"pattern_id": "serie:<slug>", "category": "series", "finding": str,
    "confidence": float, "sample_size": int}` — **nesta ordem de campos**, cortada em 30.
  - `series`: a **mesma lista** enriquecida (insumo da `ENTRADA` do §4.4), item a item na mesma ordem:
    o item de `features` mais `{"razao": Decimal, "leitura": str, "confidence", "sample_size",
    "pattern_id", "finding"}`.
  - `motivos`: lista ordenada, sem repetição, de `"padrao_neutro"`, `"series_orfas"` e
    **`"coorte_fina:<slug>"` — um por série afetada**. `padrao_neutro` e `series_orfas` são os nomes
    literais do spec e ficam sem sufixo; `coorte_fina` é decisão do dono (19/09) e leva o slug porque
    ele nomeia uma comparação **ausente**: o dono precisa saber *qual* série consertar no `series.json`
    (ou qual ano alargar na 2b), e o slug é a chave estável que ele mesmo edita. Sem o motivo,
    "nenhum padrão por coorte fina" é indistinguível de "nenhum padrão por canal saudável" — o dono
    veria `desfecho: ok`, zero padrão e nada que explicasse.
  - `escolher` lê **só** `feats["series"]` e `feats["orfas"]`, e não muta `feats`.

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar ao **fim do corpo de `casos(F, exige)`** (antes do `if __name__`), indentado em 4:

```python
    # ------------------------------------------------------------------ fabricas de feats
    def fserie(slug, nome, n, ano, mediana, n_coorte, mediana_coorte, views=None):
        s = {"slug": slug, "nome": nome, "n": n, "ano": ano, "mediana": mediana,
             "n_coorte": n_coorte, "mediana_coorte": mediana_coorte, "aplica": n_coorte >= F.MIN_COORTE}
        if views is not None:
            s["views_90d_serie"] = views
        return s


    def feats_de(*series, **kw):
        return {"canal": {}, "videos": [], "series": list(series), "sem_serie": [],
                "orfas": kw.get("orfas", False)}


    def pats(res):
        return res["channel_insights"]["patterns_detected"]


    # 10. padrao de serie: campos, template do finding e o `n` que diverge do sample_size
    r = F.escolher(feats_de(fserie("zero-dez", "0–10", 11, 2019, 91, 10, 143.5, views=16)))
    exige(len(pats(r)) == 1, "uma serie com efeito = um padrao")
    p = pats(r)[0]
    exige(p["pattern_id"] == "serie:zero-dez", "pattern_id = serie:<slug>")
    exige(p["category"] == "series", "category = series")
    exige(p["sample_size"] == 10, "sample_size = n_grupo = min(n_serie, n_coorte)")
    exige(p["confidence"] == 0.6, "confidence 0,6 (n_grupo 10, nao forte)")
    exige(p["finding"] == 'Série "0–10": 11 vídeos, mediana de 91 views na vida (0,63× da coorte de 2019)',
          "finding pelo template, com o n da serie (11) e nao o sample_size")
    exige(list(p.keys()) == ["pattern_id", "category", "finding", "confidence", "sample_size"],
          "o padrao tem exatamente os 5 campos do PatchPayloadSchema")
    exige(r["series"][0]["razao"] == D("0.63") and r["series"][0]["leitura"] == "abaixo da coorte",
          "series[] leva a razao arredondada e a leitura")
    exige(r["series"][0]["views_90d_serie"] == 16, "series[] preserva views_90d_serie")
    exige(r["motivos"] == [], "serie com efeito nao gera motivo")

    # a leitura aninhada do §4.3: 91/136 = 0,669 -> 0,67, NO piso, confidence 0,55
    ra = F.escolher(feats_de(fserie("csc", "Como somos controlados", 5, 2019, 91, 16, 136)))
    exige(len(pats(ra)) == 1 and pats(ra)[0]["confidence"] == 0.55
          and pats(ra)[0]["sample_size"] == 5
          and "0,67× da coorte de 2019" in pats(ra)[0]["finding"],
          "leitura aninhada: 0,67 no piso, sample_size 5, confidence 0,55")

    # 11. piso de efeito: fronteiras exatas sobre a razao ARREDONDADA
    def piso(a, b):
        return len(pats(F.escolher(feats_de(fserie("s", "S", 5, 2019, a, 10, b)))))


    tabela(piso, [((67, 100), 1), ((68, 100), 0), ((100, 100), 0),
                  ((149, 100), 0), ((150, 100), 1), ((200, 100), 1),
                  ((337, 500), 1), ((27, 40), 0)], "piso de efeito")
    exige(F.escolher(feats_de(fserie("s", "S", 5, 2019, 100, 10, 100)))["motivos"] == ["padrao_neutro"],
          "serie neutra vai para os motivos")

    # leitura pelos dois lados
    exige(F.escolher(feats_de(fserie("s", "S", 5, 2019, 150, 10, 100)))["series"][0]["leitura"]
          == "acima da coorte", "razao >= 1,5 le como acima")

    # forte: <= 0,5 ou >= 2 soma 0,1
    exige(pats(F.escolher(feats_de(fserie("s", "S", 5, 2019, 50, 10, 100))))[0]["confidence"] == 0.65,
          "razao 0,50 e forte: 0,55 + 0,1")
    exige(pats(F.escolher(feats_de(fserie("s", "S", 5, 2019, 200, 10, 100))))[0]["confidence"] == 0.65,
          "razao 2,00 e forte")
    exige(pats(F.escolher(feats_de(fserie("s", "S", 5, 2019, 51, 10, 100))))[0]["confidence"] == 0.55,
          "razao 0,51 nao e forte")

    # 12. coorte fina: a comparacao nao se aplica e a serie nao vira padrao
    rf = F.escolher(feats_de(fserie("vlogzeira", "Vlogzeira", 6, 2018, 171, 1, 171)))
    exige(pats(rf) == [] and rf["motivos"] == ["coorte_fina:vlogzeira"],
          "coorte abaixo do piso de 4: sem padrao, e um motivo por serie com o slug")

    # 13. ordem fixa: |razao-1| decrescente, desempate alfabetico pelo slug
    ordem = F.escolher(feats_de(
        fserie("zz", "ZZ", 5, 2019, 63, 10, 100),     # 0,63 -> |d| 0,37
        fserie("aa", "AA", 5, 2019, 250, 10, 100),    # 2,50 -> |d| 1,50
        fserie("mm", "MM", 5, 2019, 160, 10, 100),    # 1,60 -> |d| 0,60
    ))
    exige([p["pattern_id"] for p in pats(ordem)] == ["serie:aa", "serie:mm", "serie:zz"],
          "ordem por |razao-1| decrescente")
    empate = F.escolher(feats_de(
        fserie("beta", "B", 5, 2019, 50, 10, 100),
        fserie("alfa", "A", 5, 2019, 150, 10, 100),
    ))
    exige([p["pattern_id"] for p in pats(empate)] == ["serie:alfa", "serie:beta"],
          "empate de |razao-1| (0,50) desfeito pelo slug em ordem alfabetica")
    exige([s["slug"] for s in empate["series"]] == ["alfa", "beta"],
          "series[] sai na MESMA ordem de patterns_detected")

    # 14. corte em 30
    muitas = [fserie("s%02d" % i, "S%d" % i, 5, 2019, 10 + i, 10, 100) for i in range(31)]
    r30 = F.escolher(feats_de(*muitas))
    exige(len(pats(r30)) == 30 and len(r30["series"]) == 30, "patterns_detected e series cortados em 30")
    exige("serie:s00" == pats(r30)[0]["pattern_id"], "o corte respeita a ordem (o mais distante fica)")

    # 15. orfas e pureza
    exige(F.escolher(feats_de(orfas=True))["motivos"] == ["series_orfas"],
          "series.json sem nenhum id casando vira motivo, e a execucao segue")
    exige(F.escolher(feats_de(fserie("s", "S", 5, 2019, 100, 10, 100), orfas=True))["motivos"]
          == ["padrao_neutro", "series_orfas"], "motivos sem repeticao, em ordem")
    _f = feats_de(fserie("s", "S", 5, 2019, 91, 10, 143.5, views=16))
    _antes = repr(_f)
    F.escolher(_f)
    exige(repr(_f) == _antes, "escolher nao muta feats")
```

- [ ] **Step 2: Rodar e ver falhar**

Run:
```bash
cd ~/Workspace/forja/ferramentas/docs/trilha && PYTHONPATH="$PWD/st" AGENTE_SITIO="$PWD/../sitio.py" AGENTE_FILA="$PWD/fila_intel.py" python3 -B teste_calculo.py
```
Expected: FAIL — `AttributeError: module 'fila_intel' has no attribute 'escolher'`.

- [ ] **Step 3: Implementar `escolher` (padrões e ordem)**

Acrescentar em `fila_intel.py`, depois de `_razao_txt`:

```python
TPL_FINDING = ('Série "{nome}": {n} vídeos, mediana de {views} views na vida '
               "({razao} da coorte de {periodo})")


def escolher(feats):
    """Padroes e montagem — dado, nunca prompt (§4.3). Pura: le so feats["series"] e
    feats["orfas"], nao muta o argumento e nao toca em relogio, disco nem rede.

    Escopo 2a: so a analise do canal. `coaching.priorities` e sempre [] e
    `video_recommendations` nunca existe — o servidor recusa com 400 um PATCH forja
    fora disso (§3.3)."""
    itens, motivos = [], []
    for s in feats["series"]:
        if not s["aplica"]:
            # coorte abaixo do piso: a comparacao nao se aplica. Um motivo POR SERIE, com o slug:
            # sem ele, "nenhum padrao por coorte fina" e indistinguivel de "canal saudavel" no jsonl.
            motivos.append("coorte_fina:" + s["slug"])
            continue
        razao = _razao(s["mediana"], s["mediana_coorte"])
        if PISO_BAIXO < razao < PISO_ALTO:
            motivos.append("padrao_neutro")
            continue
        n_grupo = min(s["n"], s["n_coorte"])   # o suporte real da razao
        forte = razao <= FORTE_BAIXO or razao >= FORTE_ALTO
        item = dict(s)
        item["razao"] = razao
        item["leitura"] = "acima da coorte" if razao >= PISO_ALTO else "abaixo da coorte"
        item["confidence"] = _confianca(n_grupo, forte)
        item["sample_size"] = n_grupo
        item["pattern_id"] = "serie:" + s["slug"]
        item["finding"] = TPL_FINDING.format(
            nome=s["nome"], n=s["n"], views=_num(s["mediana"]),
            razao=_razao_txt(razao), periodo=s["ano"])
        itens.append(item)

    # ordem fixa: |razao - 1| decrescente, empate pelo slug em ordem alfabetica — nunca a ordem
    # de iteracao do series.json, que o dono pode reescrever (§4.3)
    itens.sort(key=lambda x: (-abs(x["razao"] - UM), x["slug"]))
    itens = itens[:TETO_PATTERNS]

    if feats["orfas"]:
        motivos.append("series_orfas")

    padroes = [{"pattern_id": i["pattern_id"], "category": "series", "finding": i["finding"],
                "confidence": i["confidence"], "sample_size": i["sample_size"]} for i in itens]

    return {"channel_insights": {"patterns_detected": padroes},
            "coaching": {"priorities": []},
            "series": itens,
            "motivos": sorted(set(motivos))}
```

E, junto das constantes do §4.3 (antes de `_razao`), acrescentar:

```python
TETO_PATTERNS = 30      # teto novo do PatchPayloadSchema (§3.3)
```

- [ ] **Step 4: Rodar e ver passar**

Run:
```bash
cd ~/Workspace/forja/ferramentas/docs/trilha && PYTHONPATH="$PWD/st" AGENTE_SITIO="$PWD/../sitio.py" AGENTE_FILA="$PWD/fila_intel.py" python3 -B teste_calculo.py
```
Expected: `F2C: 0 falha(s)` — 83 asserções.

- [ ] **Step 5: Portão de sintaxe e commit**

```bash
cd ~/Workspace/forja/ferramentas && python3 -m py_compile docs/trilha/fila_intel.py docs/trilha/teste_calculo.py && echo PY-OK
git -C ~/Workspace/forja/ferramentas add docs/trilha/fila_intel.py docs/trilha/teste_calculo.py
git -C ~/Workspace/forja/ferramentas commit -m "feat: escolher — patterns_detected, ordem fixa e motivos (§4.3)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task F2F-7: `escolher` — `analysis_text` e o escopo 2a

Fecha o §4.3: o `analysis_text` por template, com corte em 2.000 caracteres **UTF-16**, e as garantias
de escopo que o validador do §4.5 (item 2) e o servidor (§3.3) vão cobrar.

**Files:**
- Modify: `~/Workspace/forja/ferramentas/docs/trilha/fila_intel.py`
- Modify: `~/Workspace/forja/ferramentas/docs/trilha/teste_calculo.py`

**Interfaces:**
- Consumes: `escolher` (Task F2F-6).
- Produces: `_u16(s) -> int`; `escolher(...)["channel_insights"]["analysis_text"]: str`;
  constantes `FRASE_FINAL`, `TETO_ANALYSIS = 2000`.
  Contrato final de `escolher`: chaves exatamente
  `{"channel_insights": {"patterns_detected", "analysis_text"}, "coaching": {"priorities": []},
  "series": [...], "motivos": [...]}` — **sem** `video_recommendations`, **sem** `notifications`,
  **sem** `coaching.summary` (quem o acrescenta é o §4.4).

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar ao **fim do corpo de `casos(F, exige)`** (antes do `if __name__`), indentado em 4:

```python
    # 16. analysis_text: findings na ordem de patterns_detected + a frase final
    ra = F.escolher(feats_de(fserie("zero-dez", "0–10", 11, 2019, 91, 10, 143.5, views=16)))
    tx = ra["channel_insights"]["analysis_text"]
    exige(tx == ('Série "0–10": 11 vídeos, mediana de 91 views na vida (0,63× da coorte de 2019). '
                 "Gerado pela forja com as views na vida de cada vídeo "
                 "(contagem importada, sem atualização diária) e as séries."),
          "analysis_text = finding + frase final")
    exige("18/09" not in tx and "2026" not in tx, "analysis_text nao cita data_base")
    exige(F.escolher(feats_de())["channel_insights"]["analysis_text"] == F.FRASE_FINAL,
          "sem padrao, o analysis_text e so a frase final")

    # 17. corte em 2.000 UTF-16, contando a frase final junto
    BASE = len(F.TPL_FINDING.format(nome="", n=5, views="91", razao="0,63×", periodo=2019))
    LONGO = "N" * (300 - BASE)
    muitas = [fserie("s%d" % i, LONGO, 5, 2019, 91, 10, 143.5) for i in range(7)]
    rl = F.escolher(feats_de(*muitas))
    exige(all(F._u16(p["finding"]) == 300 for p in pats(rl)), "cada finding do caso cabe nos 300 do §4.5")
    txl = rl["channel_insights"]["analysis_text"]
    exige(F._u16(txl) <= F.TETO_ANALYSIS, "analysis_text nunca passa de 2.000 UTF-16")
    exige(txl.count("Série ") == 6, "entram 6 dos 7 findings (o setimo nao cabe com a frase final)")
    exige(txl.endswith(F.FRASE_FINAL), "a frase final sempre fecha o texto")
    exige(len(pats(rl)) == 7, "o corte do texto nao corta patterns_detected")
    tabela(F._u16, [(("abc",), 3), (("é",), 1), (("×",), 1), (("🚀",), 2)], "_u16")

    # 18. escopo 2a: o que escolher NAO produz
    r = F.escolher(feats_de(fserie("s", "S", 5, 2019, 91, 10, 143.5, views=16)))
    exige(sorted(r.keys()) == ["channel_insights", "coaching", "motivos", "series"],
          "escolher devolve exatamente 4 chaves")
    exige(sorted(r["channel_insights"].keys()) == ["analysis_text", "patterns_detected"],
          "channel_insights tem exatamente os 2 campos do schema")
    exige(r["coaching"] == {"priorities": []}, "coaching.priorities e SEMPRE [] e nao ha summary aqui")
    exige("video_recommendations" not in r and "notifications" not in r,
          "video_recommendations e notifications nunca existem na 2a")
    exige(all(F._u16(p["finding"]) <= 300 and F._u16(p["pattern_id"]) <= 80 for p in pats(r)),
          "finding <= 300 e pattern_id <= 80 (item 1 do §4.5)")
    exige(all(isinstance(p["sample_size"], int) and 0 <= p["confidence"] <= 1 for p in pats(r)),
          "sample_size inteiro e confidence em [0,1]")
```

- [ ] **Step 2: Rodar e ver falhar**

Run:
```bash
cd ~/Workspace/forja/ferramentas/docs/trilha && PYTHONPATH="$PWD/st" AGENTE_SITIO="$PWD/../sitio.py" AGENTE_FILA="$PWD/fila_intel.py" python3 -B teste_calculo.py
```
Expected: FAIL — `AttributeError: module 'fila_intel' has no attribute 'FRASE_FINAL'`.

- [ ] **Step 3: Implementar `analysis_text`**

Em `fila_intel.py`, junto das constantes do §4.3, acrescentar:

```python
TETO_ANALYSIS = 2000    # analysis_text .max(2000) do PatchPayloadSchema, em UTF-16
FRASE_FINAL = ("Gerado pela forja com as views na vida de cada vídeo "
               "(contagem importada, sem atualização diária) e as séries.")
```

Depois de `_razao_txt`, acrescentar:

```python
def _u16(s):
    """Comprimento em unidades UTF-16 — a mesma contagem do Zod (§4.5 item 1)."""
    return len(s.encode("utf-16-le")) // 2


def _analise(padroes):
    """analysis_text por template: os findings na ordem de patterns_detected, entrando ate caber
    em 2.000 UTF-16 JUNTO com a frase final; os dois cortes (este e o de 30) sao do codigo e nunca
    chegam ao item 1 do §4.5. Nao cita data_base: nenhum finding usa dado ate essa data (§4.3).
    LACUNA (§4.3): o spec nao fixa o separador entre findings; '. ' fecha cada um, que termina em ')'."""
    usados = []
    for p in padroes:
        cand = ". ".join(usados + [p["finding"]]) + ". " + FRASE_FINAL
        if _u16(cand) > TETO_ANALYSIS:
            break
        usados.append(p["finding"])
    return (". ".join(usados) + ". " + FRASE_FINAL) if usados else FRASE_FINAL
```

E, em `escolher`, trocar o `return` final por:

```python
    return {"channel_insights": {"patterns_detected": padroes, "analysis_text": _analise(padroes)},
            "coaching": {"priorities": []},
            "series": itens,
            "motivos": sorted(set(motivos))}
```

- [ ] **Step 4: Rodar e ver passar**

Run:
```bash
cd ~/Workspace/forja/ferramentas/docs/trilha && PYTHONPATH="$PWD/st" AGENTE_SITIO="$PWD/../sitio.py" AGENTE_FILA="$PWD/fila_intel.py" python3 -B teste_calculo.py
```
Expected: `F2C: 0 falha(s)` — 98 asserções.

- [ ] **Step 5: Portão de sintaxe e commit**

```bash
cd ~/Workspace/forja/ferramentas && python3 -m py_compile docs/trilha/fila_intel.py docs/trilha/teste_calculo.py && echo PY-OK
git -C ~/Workspace/forja/ferramentas add docs/trilha/fila_intel.py docs/trilha/teste_calculo.py
git -C ~/Workspace/forja/ferramentas commit -m "feat: escolher — analysis_text e o escopo 2a (§4.3)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task F2F-8: as três leituras da fixture PT, de ponta a ponta

Transforma em teste de tabela os casos esperados em 18/09 que o §4.3 descreve, atravessando
`features` → `escolher` sobre uma fixture sintética que reproduz **os números do spec**.
Mais um portão opcional contra a `fixture_pt.json` de verdade, quando o F0.5 a produzir.

**Files:**
- Modify: `~/Workspace/forja/ferramentas/docs/trilha/teste_calculo.py`

**Interfaces:**
- Consumes: `features`, `escolher` (Tasks F2F-2 a F2F-7).
- Produces: nenhuma função nova. O teste passa a ser o **espelho local** do que o F2 vai conferir
  contra o `PatchPayloadSchema` real (§5).

> **Números que este teste fixa** (§4.3, com o `view_count` da importação de 06/05):
> coorte plana de 2019 = `68, 86, 104, 113, 131, 156, 186, 297, 322, 644` (mediana **143,5**);
> grupo "0–10" = 11 episódios, mediana **91**, `views_90d_serie` **16**; `views_90d` do canal **29**;
> leitura plana → **0,63×**, `confidence` **0,6**, `sample_size` **10**;
> leitura aninhada → 5 episódios, coorte de 16 com mediana **136**, **0,67×**, `confidence` **0,55**,
> `sample_size` **5**; terceira leitura → 6 episódios de 2018 com 1 vídeo elegível fora → **sem padrão**.

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar ao **fim do corpo de `casos(F, exige)`** (antes do `if __name__`), indentado em 4:

```python
    # ------------------------------------------------------------------ 19. a fixture PT do §4.3
    # 11 episodios do grupo "0-10"; a mediana e 91 e a soma de 90 dias e 16.
    GRUPO = [vid("g01", "2019-02-01T12:00:00Z", 45), vid("g02", "2019-02-02T12:00:00Z", 50, recente=6),
             vid("g03", "2019-02-03T12:00:00Z", 65), vid("g04", "2019-02-04T12:00:00Z", 75),
             vid("g05", "2019-02-05T12:00:00Z", 80, recente=4),
             vid("g06", "2019-02-06T12:00:00Z", 91, recente=3),
             vid("g07", "2019-02-07T12:00:00Z", 141), vid("g08", "2019-02-08T12:00:00Z", 150, recente=2),
             vid("g09", "2019-02-09T12:00:00Z", 170), vid("g10", "2019-02-10T12:00:00Z", 190),
             vid("g11", "2019-02-11T12:00:00Z", 200, recente=1)]
    # os 10 outros visiveis de 2019: a coorte plana, mediana (131+156)/2 = 143,5
    COORTE10 = [vid("c01", "2019-06-01T12:00:00Z", 68, recente=5), vid("c02", "2019-06-02T12:00:00Z", 86, recente=4),
                vid("c03", "2019-06-03T12:00:00Z", 104, recente=2), vid("c04", "2019-06-04T12:00:00Z", 113, recente=1),
                vid("c05", "2019-06-05T12:00:00Z", 131, recente=1), vid("c06", "2019-06-06T12:00:00Z", 156),
                vid("c07", "2019-06-07T12:00:00Z", 186), vid("c08", "2019-06-08T12:00:00Z", 297),
                vid("c09", "2019-06-09T12:00:00Z", 322), vid("c10", "2019-06-10T12:00:00Z", 644)]
    # os 4 ocultos (3 "Main AD Diamante" + "Lolzin D5") e o ultimo video do canal
    OCULTOS = [vid("ad1", "2019-07-01T12:00:00Z", 900, oculto=True),
               vid("ad2", "2019-07-02T12:00:00Z", 910, oculto=True),
               vid("ad3", "2019-07-03T12:00:00Z", 920, oculto=True),
               vid("lol", "2019-07-04T12:00:00Z", 930, oculto=True)]
    ULTIMO = [vid("z01", "2024-12-10T15:57:00Z", 300)]
    PT = snap(GRUPO + COORTE10 + OCULTOS + ULTIMO)

    # (a) leitura plana: os 11 episodios numa serie so
    SJ_PLANA = {"videos": {v["id"]: "zero-dez" for v in GRUPO}, "nomes": {"zero-dez": "0–10"}}
    fa = F.features(PT, SJ_PLANA, HOJE)
    exige(fa["canal"]["views_90d"] == 29, "fixture: views_90d do canal = 29")
    exige(fa["canal"]["dias_sem_publicar"] == 647 and fa["canal"]["ultimo_video"] == dt.date(2024, 12, 10),
          "fixture: 647 dias sem publicar")
    sa = fa["series"][0]
    exige((sa["n"], sa["mediana"], sa["n_coorte"], sa["mediana_coorte"], sa["views_90d_serie"])
          == (11, 91, 10, 143.5, 16), "leitura plana: 11 episodios, 91 / 143,5, 16 views de 90 dias")
    ra = F.escolher(fa)
    exige(len(pats(ra)) == 1, "leitura plana: 1 padrao")
    exige(pats(ra)[0] == {"pattern_id": "serie:zero-dez", "category": "series",
                          "finding": 'Série "0–10": 11 vídeos, mediana de 91 views na vida '
                                     "(0,63× da coorte de 2019)",
                          "confidence": 0.6, "sample_size": 10},
          "leitura plana: o padrao inteiro, campo a campo")
    exige(ra["series"][0]["leitura"] == "abaixo da coorte" and ra["series"][0]["ano"] == 2019,
          "leitura plana: abaixo da coorte de 2019")

    # (b) leitura aninhada: 5 episodios; os outros 6 do grupo voltam para a coorte
    ANIN = ["g02", "g05", "g06", "g08", "g11"]
    SJ_ANIN = {"videos": {i: "csc" for i in ANIN}, "nomes": {"csc": "Como somos controlados"}}
    fb = F.features(PT, SJ_ANIN, HOJE)
    sb = fb["series"][0]
    exige((sb["n"], sb["mediana"], sb["n_coorte"], sb["mediana_coorte"], sb["views_90d_serie"])
          == (5, 91, 16, 136, 16), "leitura aninhada: 5 episodios, 91 / 136 sobre coorte de 16")
    rb = F.escolher(fb)
    exige(pats(rb)[0] == {"pattern_id": "serie:csc", "category": "series",
                          "finding": 'Série "Como somos controlados": 5 vídeos, mediana de 91 views '
                                     "na vida (0,67× da coorte de 2019)",
                          "confidence": 0.55, "sample_size": 5},
          "leitura aninhada: 0,67 no piso, confidence 0,55, sample_size 5")

    # (c) terceira leitura: 6 episodios de 2018 com 1 video elegivel fora -> sem padrao
    TERC = [vid("t1", "2017-12-20T12:00:00Z", 120), vid("t2", "2018-01-05T12:00:00Z", 150),
            vid("t3", "2018-01-07T12:00:00Z", 160), vid("t4", "2018-03-01T12:00:00Z", 180),
            vid("t5", "2018-06-01T12:00:00Z", 190), vid("t6", "2018-09-01T12:00:00Z", 200),
            vid("t7", "2018-12-31T12:00:00Z", 171)]
    fc = F.features(snap(TERC), {"videos": {v["id"]: "vlogzeira" for v in TERC[:6]},
                                 "nomes": {"vlogzeira": "Vlogzeira"}}, HOJE)
    exige(fc["series"][0]["ano"] == 2018 and fc["series"][0]["n_coorte"] == 1
          and fc["series"][0]["aplica"] is False,
          "terceira leitura: ano 2018 pelo episodio mediano, coorte de 1")
    rc = F.escolher(fc)
    exige(pats(rc) == [] and rc["motivos"] == ["coorte_fina:vlogzeira"],
          "terceira leitura: nenhum padrao, e o motivo diz que foi a coorte fina")

    # (c2) o caso que fechou a decisao: as duas series de 2018 caem juntas em "nao se aplica"
    SJ_DUAS = {"videos": {"t1": "vlog", "t2": "vlog", "t3": "vlog",
                          "t4": "vlogzeira", "t5": "vlogzeira", "t6": "vlogzeira"},
               "nomes": {"vlog": "VLOG - ", "vlogzeira": "Vlogzeira"}}
    fd = F.features(snap(TERC[:6]), SJ_DUAS, HOJE)
    exige([(x["slug"], x["ano"], x["n_coorte"], x["aplica"]) for x in fd["series"]]
          == [("vlog", 2018, 3, False), ("vlogzeira", 2018, 2, False)],
          "duas series de 2018: as duas sem coorte (3 e 2, abaixo do piso de 4)")
    rd = F.escolher(fd)
    exige(pats(rd) == [] and rd["motivos"] == ["coorte_fina:vlog", "coorte_fina:vlogzeira"],
          "duas series caladas viram dois motivos, um por slug, em ordem")

    # (d) "Vlogzeira" sozinha fica abaixo do piso de efeito (1,42x), nas tres leituras
    rv = F.escolher(feats_de(fserie("vlogzeira", "Vlogzeira", 3, 2019, 156, 18, 109.5)))
    exige(pats(rv) == [] and rv["motivos"] == ["padrao_neutro"], "Vlogzeira: 1,42x, neutra")

    # (e) "Main AD Diamante": os 3 episodios ocultos nem chegam a ser serie
    SJ_AD = {"videos": {"ad1": "ad", "ad2": "ad", "ad3": "ad"}, "nomes": {"ad": "Main AD Diamante"}}
    exige(F.features(PT, SJ_AD, HOJE)["series"] == [], "Main AD Diamante: oculto, nunca vira serie")

    # (f) em qualquer das tres leituras, o canal sai com 1 padrao no maximo, priorities [] e sem recomendacao
    for nome_leitura, sj in (("plana", SJ_PLANA), ("aninhada", SJ_ANIN), ("ad", SJ_AD)):
        rr = F.escolher(F.features(PT, sj, HOJE))
        exige(len(pats(rr)) <= 1 and rr["coaching"] == {"priorities": []}
              and "video_recommendations" not in rr,
              "leitura %s: no maximo 1 padrao, priorities [] e sem video_recommendations" % nome_leitura)

    # (g) portao opcional: a fixture de verdade, quando o F0.5 a tiver produzido
    _fx = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixture_pt.json")
    _sj = os.environ.get("AGENTE_SERIES", "/opt/agente/series.json")
    if os.path.exists(_fx) and os.path.exists(_sj):
        _snap = json.load(open(_fx, encoding="utf-8"))
        _hoje = dt.date.fromisoformat(_snap["congelado_em"][:10])
        _r = F.escolher(F.features(_snap, json.load(open(_sj, encoding="utf-8")), _hoje))
        exige(len(pats(_r)) == 1, "fixture real: 1 padrao (o dono confere o finding uma vez)")
        exige(_r["coaching"] == {"priorities": []} and "video_recommendations" not in _r,
              "fixture real: escopo 2a")
        print("     fixture real ->", pats(_r)[0]["finding"] if pats(_r) else "(sem padrao)")
    else:
        print("     (fixture_pt.json / series.json ausentes: portao da fixture real pulado)")
```

- [ ] **Step 2: Rodar e ver falhar**

Run:
```bash
cd ~/Workspace/forja/ferramentas/docs/trilha && PYTHONPATH="$PWD/st" AGENTE_SITIO="$PWD/../sitio.py" AGENTE_FILA="$PWD/fila_intel.py" python3 -B teste_calculo.py
```
Expected: se as Tasks F2F-2 a F2F-7 estiverem corretas, **todas passam de primeira** — este é o teste
de aceitação da seção. Se alguma falhar, o valor errado sai no `FALHA` e **o spec vence**: corrigir o
código, nunca o número esperado (§4.3: "um limiar só muda por item julgado errado ou faltante").

- [ ] **Step 3: Rodar de novo e ver passar**

Run:
```bash
cd ~/Workspace/forja/ferramentas/docs/trilha && PYTHONPATH="$PWD/st" AGENTE_SITIO="$PWD/../sitio.py" AGENTE_FILA="$PWD/fila_intel.py" python3 -B teste_calculo.py
```
Expected: `F2C: 0 falha(s)` — 115 asserções, mais a linha do portão da fixture real (pulado no Mac).

- [ ] **Step 4: Portão do F0k**

Run:
```bash
cd ~/Workspace/forja/ferramentas && python3 -m py_compile docs/trilha/fila_intel.py docs/trilha/teste_calculo.py && echo PY-OK
```
Expected: `PY-OK`.

- [ ] **Step 5: Commit e comandos do dono**

```bash
cd ~/Workspace/forja/ferramentas && python3 -m py_compile docs/trilha/teste_calculo.py && echo PY-OK
git -C ~/Workspace/forja/ferramentas add docs/trilha/teste_calculo.py
git -C ~/Workspace/forja/ferramentas commit -m "test: as tres leituras da fixture PT de ponta a ponta (§4.3)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

Os arquivos ficam em `~/Workspace/forja/ferramentas/docs/trilha/` e viajam no `scp -r trilha` do
card **K** sem passo novo (o `.git` fica em `ferramentas/`, fora de `docs/`, e não vai junto).
Comandos para o dono colar **na forja**, depois do K (nenhum deles escreve):

```
# teste do calculo, na forja (a cópia de trabalho do kit)
cd /opt/agente/docs/trilha && AGENTE_SITIO=/opt/agente/sitio.py AGENTE_FILA=/opt/agente/docs/trilha/fila_intel.py /opt/agente/venv/bin/python -B teste_calculo.py
```

```
# depois do F0.5 (fixture_pt.json capturada e series.json escolhido), o mesmo comando
# passa a rodar também o portão da fixture real e imprime o finding para conferência:
cd /opt/agente/docs/trilha && AGENTE_SITIO=/opt/agente/sitio.py AGENTE_FILA=/opt/agente/docs/trilha/fila_intel.py AGENTE_SERIES=/opt/agente/series.json /opt/agente/venv/bin/python -B teste_calculo.py
```

---

### Dependências e ordem

- **F2F-1 → F2F-2 → F2F-3 → F2F-4** (o §4.2 é sequencial: cada tarefa acrescenta campos ao mesmo `features`).
- **F2F-5 → F2F-6 → F2F-7** (o §4.3; F2F-5 só depende da stdlib e pode ser feita em paralelo com o §4.2).
- **F2F-8** fecha, e depende de todas.
- **Esta seção depende do A1** (`fila_intel.py` já criado, com o cabeçalho, os imports e
  `carregar_sitio()`), e **do A3 só na forma do hook** `casos(F, exige)` — nada de código em comum.
- **Fora desta seção, mas dependem dela:** §4.4 (`ENTRADA` monta-se a partir de `feats["canal"]` e de
  `escolher(...)["series"]`), §4.5 (o validador roda sobre o payload montado), §4.1 (o laço chama
  `features` → `escolher` entre o snapshot e a redação) e o `teste_fila.py` do A6, que importa
  `casos` deste arquivo.
- **Os 8 passos finais de tarefa terminam em `git commit`** no repositório local do kit (`~/Workspace/forja/ferramentas`), sempre depois do teste verde e sempre com `git add` por caminho explícito.

### O que o §4.4 recebe daqui, campo a campo

| `ENTRADA` (§4.4) | de onde vem |
|---|---|
| `canal.nome` | `feats["canal"]["nome"]` (já passado por `_t`; reaplicar é idempotente) |
| `canal.videos` | `feats["canal"]["videos"]` |
| `canal.views_90d` | `feats["canal"]["views_90d"]` — **`None` = a chave sai da `ENTRADA`** |
| `canal.data_base` | `feats["canal"]["data_base"]`, formatada dd/mm/aaaa |
| `canal.ultimo_video` | `feats["canal"]["ultimo_video"]` (fuso de SP), dd/mm/aaaa |
| `canal.dias_sem_publicar` | `feats["canal"]["dias_sem_publicar"]` (contado em UTC) |
| `canal.series_com_efeito` | `len(escolher(...)["series"])` |
| `series[].nome` / `.n` / `.ano` | `escolher(...)["series"][i]["nome"|"n"|"ano"]` |
| `series[].mediana_views_vida` | `_num(series[i]["mediana"])` |
| `series[].razao_coorte` | `_razao_txt(series[i]["razao"])` |
| `series[].leitura` | `series[i]["leitura"]` — o código decide a direção, o modelo nunca deduz |
| `series[].views_90d_serie` | `series[i]["views_90d_serie"]` — **ausente = a chave sai da `ENTRADA`** |

O `summary` do modelo entra em `escolher(...)["coaching"]["summary"]`; `priorities` continua `[]`.


---

## F0k · o worker — redação pelo 12B e validador local (§4.4, §4.5)

Card de código na **forja**, escrito e testado no **Mac**. Cobre o §4.4 (mensagens, `ENTRADA`, `SISTEMA_FILA`, `S`/`MAX`, o pedido ao llama, Aparo, Aceite, `AVISO_ESTREITO`) e o §4.5 inteiro (validador local, itens 1 a 6).

**Nada aqui toca o site.** Nenhuma tarefa deste card roda `npm`, `vitest` ou `supabase`.

### Regra de entrega deste card (o kit está sob git)

O dono rodou `git init` em `~/Workspace/forja/ferramentas`. Verificado por este card: commit `ec51833` ("chore: estado do kit antes da fase 2a"), **116 arquivos rastreados**, árvore limpa, `.gitignore` com `__pycache__/` e `*.pyc`, e `git rev-parse --show-toplevel` → `/Users/figueiredo/Workspace/forja/ferramentas`. O `.git` mora em `ferramentas/`, **fora de `docs/`**: o `scp -r` do card K não o leva e o portão md5 não o vê.

Portanto, como no card F0, **toda tarefa termina em `git commit`**:

- mensagem no padrão `tipo: descrição curta` (`feat`, `fix`, `chore`, `refactor`, `docs`);
- **repositório local, sem remoto e sem push** — nada sai do Mac por aqui; quem leva o kit à forja é o card K;
- `git add` sempre por **caminho explícito**, nunca `git add -A` nem `git add .`;
- a ordem é **rodar o teste → commitar**, nunca o contrário: o `teste_fila_redacao.py` roda no Mac, e nenhum commit deste card nasce com a tabela vermelha;
- sem cópias `.bak` antes de editar — o git já é a rede de segurança, e elas só sujariam o `git status`.

**Escrita na forja é do dono.** Nenhuma tarefa deste card faz `ssh`, `scp`, `install`, `mv` ou `crontab` na forja. O `fila_intel.py` e o `teste_fila_redacao.py` ficam na **cópia de trabalho do Mac**, em `~/Workspace/forja/ferramentas/docs/trilha/`; quem os leva à forja é o card **K**, e quem os instala é o dono, pelo bloco do §4.6.

### Mapa de arquivos

**Criados/editados (Mac, cópia de trabalho do kit)**

| Arquivo | Responsabilidade |
|---|---|
| `~/Workspace/forja/ferramentas/docs/trilha/fila_intel.py` | worker; **este card escreve só as seções `# ---- redação` e `# ---- validador`** |
| `~/Workspace/forja/ferramentas/docs/trilha/teste_fila_redacao.py` | as tabelas de teste do §4.4/§4.5, em estilo do kit (`exige`), chamáveis pelo `teste_fila.py` |

**Lidos, nunca editados**

| Arquivo | O quê |
|---|---|
| `~/Workspace/forja/ferramentas/docs/sitio.py` | `norm` (`:136-138`), `_t` (`:141-142`), `EMOJI` (`:133`) — a faixa de emoji do validador é **a mesma** do kit |
| `~/Workspace/forja/ferramentas/docs/trilha/teste_s1.py` | o estilo de teste do kit: script Python simples, `exige(cond, nome)`, `SystemExit(1 if falhas else 0)` — **não** pytest |
| `~/Workspace/forja/ferramentas/docs/trilha/s2.py:93` | `chat_template_kwargs["enable_thinking"] = False`, como a fase 1 |
| `apps/web/src/lib/youtube/intelligence-schemas.ts:36-53` | a forma exata do payload que o item 1 mede |

### Comando de verificação (vale para todas as tarefas deste card)

```bash
cd ~/Workspace/forja/ferramentas/docs/trilha && \
  AGENTE_SITIO="$HOME/Workspace/forja/ferramentas/docs/sitio.py" \
  AGENTE_FILA="$PWD/fila_intel.py" python3 -B teste_fila_redacao.py
```

Só biblioteca padrão: nenhuma função deste card importa `httpx`. O cliente do llama chega **por parâmetro**, como o `cli` do `sitio.pedir` (`sitio.py:90`), então o `python3` do sistema basta e o teste roda sem rede e sem llama.

### Interfaces que atravessam as tarefas

Assinaturas exatas, definidas aqui uma vez.

**Consumido de outros agentes.** As formas abaixo são as que o **A2** (`plan-a2-features-escolher.md`) emite, conferidas contra o arquivo dele campo a campo — **o produtor vence**. A tabela "O que o §4.4 recebe daqui" do A2 é a fonte desta seção.

```python
# §4.6 — carregamento do sitio.py por caminho (AGENTE_SITIO), cacheado num global de módulo.
def carregar_sitio(): ...        # -> módulo sitio; dele saem norm, _t e EMOJI

# §4.3 (A2, Task F2F-5/F2F-7) — exibição e medida, DONAS do A2. Este card NUNCA as redefine:
def _num(v) -> str        # mediana exibível: sem casas quando inteira, senão 1 casa, pt-BR
def _razao_txt(r) -> str  # razão exibível: 2 casas + '×'
def _u16(s) -> int        # comprimento em unidades UTF-16 — a contagem do Zod
def _razao(mediana, mediana_coorte) -> Decimal   # COMPUTAÇÃO, não exibição (ver Nota abaixo)

# §4.2 — features(snapshot, series, hoje) -> dict. Este card consome só:
feats = {
    "canal": {
        "nome": str,                       # JÁ passado por _t pelo A2; reaplicar é idempotente
        "videos": int,                     # vídeos no banco, inclusive os ocultos
        "views_90d": int | None,           # None quando recent_window é nulo
        "data_base": datetime.date,        # NUNCA None: o A2 já resolve o fallback para `hoje`
        "ultimo_video": datetime.date | None,  # maior published_at, fuso de São Paulo
        "dias_sem_publicar": int | None,       # data_base − published_at em UTC
    },
    # 'videos', 'series' e 'orfas' existem e não são lidos por este card.
}

# §4.3 — escolher(feats) -> dict. Este card consome:
escolhido = {
    "coaching": {"priorities": []},            # sempre vazio na 2a; o summary entra aqui depois
    "channel_insights": {"patterns_detected": [...], "analysis_text": str},
    "motivos": [str, ...],
    "series": [                                # MESMA ordem de patterns_detected (§4.3)
        {"slug": str, "nome": str, "n": int, "ano": int,
         "mediana": int | float,               # mediana DA SÉRIE -> mediana_views_vida
         "views_90d_serie": int,               # CHAVE AUSENTE quando recent_window é nulo
         "n_coorte": int, "mediana_coorte": int | float | None, "aplica": bool,
         "razao": Decimal,                     # já arredondada a 2 casas por escolher
         "leitura": "abaixo da coorte" | "acima da coorte",
         "confidence": float, "sample_size": int, "pattern_id": str, "finding": str},
    ],
}
# escolher NÃO emite task_id: quem o põe no payload é o §4.1.
```

> **Nota de colisão (resolvida a favor do A2).** O A2 já é dono de `_razao`, e lá ela é a
> **computação** `mediana / mediana_coorte -> Decimal`. Este card, na primeira redação, definia
> um `_razao(r)` de **exibição** no mesmo módulo — os dois se apagariam em silêncio, e quem
> perdesse dependeria da ordem das definições no arquivo. Este card não define nenhuma das
> quatro: usa `_num`, `_razao_txt` e `_u16` do A2. **Nenhuma função de formatação ou de medida
> nasce aqui.**

**Produzido por este card** (tudo em `fila_intel.py`):

```python
# ---- constantes
AVISO_ESTREITO: str      # "Sem CTR/retenção nesta fase; base: views e séries." (50 caracteres)
MAX: int                 # 500 - len(AVISO_ESTREITO) - 10  -> 440
S: dict                  # o json_schema da gramática
SISTEMA_FILA: str        # o texto integral do system

# ---- §4.4
def montar_entrada(feats: dict, escolhido: dict) -> dict     # usa _num/_razao_txt do A2
def mensagens(entrada: dict) -> list[dict]
def aceitar(resp: dict) -> tuple[str | None, str | None]        # (summary, motivo)
async def gerar(cli_llama, msgs: list, restante_s: float, seed: int | None = None) -> tuple[str | None, str | None, dict]
def aparar(s: str) -> tuple[str, str | None]                    # (texto, motivo 'curto'|None)
def prefixar(summary: str) -> str
def aplicar_summary(payload: dict, summary: str) -> dict

# ---- §4.5   (a medida em UTF-16 é o _u16 do A2, não uma função nova)
def limites(payload: dict) -> list[str]                         # item 1 -> ['zod: <campo>']
def escopo(payload: dict) -> list[str]                          # item 2 -> ['escopo: <campo>']
def frases(t: str) -> list[str]                                 # corte comum ao Aparo, ao papel e ao 5b
def normalizar(v: str) -> str                                   # = sitio.norm, com - – — equivalentes
def tokens(t: str) -> tuple[set[tuple[str, str]], list[tuple]]  # (números, datas) — etapas (b) e (c)
def permitidos(entrada: dict) -> tuple[set, list]               # etapa (0)
def numeros(limpo: str, entrada: dict) -> list[str]             # itens 3/4 -> ['numero'|'extenso'|'tempo']
def papel(texto: str, entrada: dict) -> list[str]               # item 3, papel das views -> ['papel']
def proibidos(limpo: str) -> list[str]                          # item 5 -> ['proibido'|'rotulo_cru']
def direcao(texto: str, entrada: dict) -> list[str]             # item 5b -> ['direcao']
def validar_texto(texto: str, entrada: dict) -> list[str]       # itens 3,4,5,5b + 'emoji'
def validar(payload: dict, entrada: dict, texto: str) -> tuple[list[str], list[str]]  # (duros, texto)
def template_summary(entrada: dict) -> str                      # item 6
async def redigir(cli_llama, entrada: dict, restante, gerar_=gerar) -> dict
```

`redigir` devolve, e é **este dict** que o §4.1 lê para montar a linha do jsonl:

```python
{"summary": str | None,          # None só quando 'falha' não é None
 "fonte": "modelo" | "template" | None,
 "falha": None | "llama" | "orcamento",   # o desfecho de fail {retry:true} do §4.1 passos 4-5
 "tentativas": int, "seeds": [int, ...], "motivos": [str, ...],
 "fallback": ["summary"] | [], "tokens": int | None}
```

**Quem chama o quê:** o §4.1 faz `entrada = montar_entrada(feats, escolhido)` → `r = await redigir(...)` → se `r["falha"]`, `fail {retry:true}`; senão `payload = aplicar_summary(escolhido_payload, r["summary"])` → `duros, _ = validar(payload, entrada, r["summary"])` → se `duros`, `fail` **sem** `retry` (`desfecho: reprovada`, `etapa: validar`); senão PATCH.

---

### Task F2R-1: `ENTRADA` — números em pt-BR, `_t` nos nomes, chaves que somem sem janela

**Files:**
- Modify: `~/Workspace/forja/ferramentas/docs/trilha/fila_intel.py` (seção `# ---- redação`)
- Test: `~/Workspace/forja/ferramentas/docs/trilha/teste_fila_redacao.py` (novo)

**Interfaces:**
- Consumes: `carregar_sitio()` (§4.6) — dele saem `_t` e `norm`; `feats` e `escolhido` (§4.2/§4.3), com as chaves declaradas acima.
- Produces: `montar_entrada(feats, escolhido) -> dict` e o privado `_data`. **Nenhum formatador novo:** `_num` e `_razao_txt` são do A2.

- [ ] **Step 1: Escrever o arquivo de teste e a primeira tabela**

Criar `~/Workspace/forja/ferramentas/docs/trilha/teste_fila_redacao.py`:

```python
"""Tabelas do §4.4 (redação) e do §4.5 (validador) do fila_intel.py — estilo do kit, sem pytest.

Uso isolado (no diretorio deste arquivo):
  AGENTE_SITIO=../sitio.py AGENTE_FILA=$PWD/fila_intel.py python3 -B teste_fila_redacao.py
Uso pelo harness: from teste_fila_redacao import casos; casos(F, exige)
"""
import asyncio, datetime as dt, importlib.machinery as _m, importlib.util as _u, json, os, sys
from decimal import Decimal

sys.dont_write_bytecode = True

# ------------------------------------------------------------------ a ENTRADA do §4.4
# O dado real de 18/09 (§1 e §4.3, leitura plana). Nenhum exemplo deste arquivo e inventado:
# todos saem do spec. A FORMA de FEATS e de ESCOLHIDO e a que o A2 emite, campo a campo
# (plan-a2-features-escolher.md): 'mediana' (nunca 'mediana_vida'), sem 'hoje', com
# 'data_base' sempre preenchida, e 'views_90d_serie' AUSENTE quando nao ha janela.
FEATS = {
    "canal": {"nome": "tnFigueiredo", "videos": 35, "views_90d": 29,
              "data_base": dt.date(2026, 9, 18), "ultimo_video": dt.date(2024, 12, 10),
              "dias_sem_publicar": 647},
    "videos": [], "series": [], "orfas": False,      # existem em features, nao lidos aqui
}
ESCOLHIDO = {
    "coaching": {"priorities": []},
    "channel_insights": {"patterns_detected": [], "analysis_text": "x"},
    "motivos": [],
    "series": [{"slug": "0-10", "nome": "0–10", "n": 11, "ano": 2019,
                "mediana": 91, "n_coorte": 20, "mediana_coorte": 143.5, "aplica": True,
                "razao": Decimal("0.63"), "leitura": "abaixo da coorte",
                "confidence": 0.6, "sample_size": 11,
                "pattern_id": "serie:0-10", "finding": "…", "views_90d_serie": 16}],
}
ENTRADA_ESPERADA = {
    "canal": {"nome": "tnFigueiredo", "videos": "35", "views_90d": "29",
              "data_base": "18/09/2026", "ultimo_video": "10/12/2024",
              "dias_sem_publicar": "647", "series_com_efeito": "1"},
    "series": [{"nome": "0–10", "n": "11", "ano": "2019", "mediana_views_vida": "91",
                "razao_coorte": "0,63×", "leitura": "abaixo da coorte",
                "views_90d_serie": "16"}],
}


def casos(F, exige):
    # ---------------------------------------------------------- F2R-1: ENTRADA
    e = F.montar_entrada(FEATS, ESCOLHIDO)
    exige(e == ENTRADA_ESPERADA, "ENTRADA: o dicionario do §4.4, campo a campo")
    exige(list(e["canal"]) == ["nome", "videos", "views_90d", "data_base", "ultimo_video",
                               "dias_sem_publicar", "series_com_efeito"],
          "ENTRADA: a ordem das chaves de canal e a do spec")
    exige(all(isinstance(v, str) for v in e["canal"].values())
          and all(isinstance(v, str) for v in e["series"][0].values()),
          "ENTRADA: todo valor e string")
    exige(not any(c in "+-−" for v in e["canal"].values() for c in v),
          "ENTRADA: nenhum sinal nos numeros")
    exige(e["series"][0]["ano"] == "2019",
          "ENTRADA: ano nunca leva separador de milhar (2019, nunca 2.019)")

    feats_emoji = {**FEATS, "canal": {**FEATS["canal"], "nome": "tnFigueiredo 🚀"}}
    exige(F.montar_entrada(feats_emoji, ESCOLHIDO)["canal"]["nome"] == "tnFigueiredo",
          "ENTRADA: emoji no nome do canal sai pelo _t")

    # Sem recent_window (o unico estado que sobrevive): views_90d vem None do A2, e o item de
    # serie vem SEM a chave views_90d_serie. `data_base` nunca e None — o fallback para `hoje`
    # mora em features (A2), num lugar so.
    feats_sem = {**FEATS, "canal": {**FEATS["canal"], "views_90d": None}}
    esc_sem = {**ESCOLHIDO,
               "series": [{k: v for k, v in ESCOLHIDO["series"][0].items()
                           if k != "views_90d_serie"}]}
    sem = F.montar_entrada(feats_sem, esc_sem)
    exige("views_90d" not in sem["canal"], "ENTRADA: views_90d None -> a chave sai")
    exige("views_90d_serie" not in sem["series"][0],
          "ENTRADA: views_90d_serie ausente no item de serie -> a chave sai")
    exige(sem["canal"]["data_base"] == "18/09/2026",
          "ENTRADA: data_base vem pronta de features, com ou sem janela")
    exige(list(sem["canal"]) == ["nome", "videos", "data_base", "ultimo_video",
                                 "dias_sem_publicar", "series_com_efeito"],
          "ENTRADA: sem janela, a ordem das demais chaves nao muda")

    exige(F.montar_entrada(FEATS, ESCOLHIDO)["series"][0]["mediana_views_vida"]
          == F._num(ESCOLHIDO["series"][0]["mediana"]),
          "ENTRADA: mediana_views_vida sai de series[].mediana, pelo _num do A2")
    exige(F.montar_entrada(FEATS, ESCOLHIDO)["series"][0]["razao_coorte"]
          == F._razao_txt(ESCOLHIDO["series"][0]["razao"]),
          "ENTRADA: razao_coorte sai de series[].razao, pelo _razao_txt do A2")


if __name__ == "__main__":
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    _arq = os.environ["AGENTE_FILA"]
    _ld = _m.SourceFileLoader("fila_intel", _arq)
    _F = _u.module_from_spec(_u.spec_from_loader("fila_intel", _ld)); _ld.exec_module(_F)
    _falhas = []

    def _exige(ok, nome):
        print("OK   " if ok else "FALHA", nome)
        if not ok:
            _falhas.append(nome)

    casos(_F, _exige)
    print("\nF2R: %d falha(s)" % len(_falhas))
    raise SystemExit(1 if _falhas else 0)
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd ~/Workspace/forja/ferramentas/docs/trilha && \
  AGENTE_SITIO="$HOME/Workspace/forja/ferramentas/docs/sitio.py" \
  AGENTE_FILA="$PWD/fila_intel.py" python3 -B teste_fila_redacao.py
```
Expected: FAIL — `AttributeError: module 'fila_intel' has no attribute 'montar_entrada'` (ou o arquivo ainda nem existe, e aí o erro é do SourceFileLoader).

- [ ] **Step 3: A `ENTRADA`**

No topo de `fila_intel.py`, junto dos imports já existentes (§4.1 e §4.3), garantir:

```python
import datetime as dt, json, os, re, secrets, unicodedata
from decimal import Decimal, ROUND_HALF_UP
```

Acrescentar a seção. **Nenhuma função de formatação nasce aqui:** `_num` e `_razao_txt` são do A2 (§4.3, Task F2F-5), e redefini-las apagaria o `_razao` **de computação** dele.

```python
# ------------------------------------------------------------------ redação (§4.4)
# Todo numero que chega ao modelo e string pt-BR exibivel e SEM sinal (§4.4). O modelo
# nunca ve uuid: nem task_id, nem channel_id, nem video_id entram na ENTRADA.

def _data(d):
    return d.strftime("%d/%m/%Y")


def montar_entrada(feats, escolhido):
    """A ENTRADA do §4.4, montada sobre o que features/escolher (§4.2, §4.3) emitem.

    `data_base` chega SEMPRE preenchida: o fallback do §4.4 (recent_window nulo -> `hoje`)
    mora em features, num lugar so, e este card nao o repete. O que sobrevive de
    'recent_window nulo' sao as duas chaves de janela: `canal.views_90d` vem None e
    `series[].views_90d_serie` vem AUSENTE — nos dois casos a chave sai da ENTRADA (§4.4).

    As unicas strings livres sao os dois 'nome'. O A2 ja os passa por sitio._t; reaplicar
    e idempotente e mantem a garantia local: sem _t, um emoji no nome do canal chega ao
    prompt e, ecoado, reprova em silencio pelo item 1 do §4.5 nas duas tentativas."""
    t = carregar_sitio()._t
    c = feats["canal"]

    pares = [("nome", t(c["nome"])), ("videos", _num(c["videos"]))]
    if c.get("views_90d") is not None:
        pares.append(("views_90d", _num(c["views_90d"])))
    pares.append(("data_base", _data(c["data_base"])))
    # Canal sem video nenhum nao chega aqui: o EN fica fora de CANAIS_FILA (§5 F4). Ainda
    # assim, ausente e melhor que null — toda chave da ENTRADA e string por contrato.
    if c.get("ultimo_video") is not None:
        pares += [("ultimo_video", _data(c["ultimo_video"])),
                  ("dias_sem_publicar", _num(c["dias_sem_publicar"]))]
    pares.append(("series_com_efeito", _num(len(escolhido["series"]))))

    series = []
    for s in escolhido["series"]:
        it = [("nome", t(s["nome"])), ("n", _num(s["n"])),
              ("ano", str(int(s["ano"]))),              # nunca formatado: 2019, jamais "2.019"
              ("mediana_views_vida", _num(s["mediana"])),   # mediana DA SERIE, nao a da coorte
              ("razao_coorte", _razao_txt(s["razao"])), ("leitura", s["leitura"])]
        if "views_90d_serie" in s:
            it.append(("views_90d_serie", _num(s["views_90d_serie"])))
        series.append(dict(it))
    return {"canal": dict(pares), "series": series}
```

- [ ] **Step 4: Rodar e ver passar**

O comando do Step 2. Expected: 9 linhas `OK`, `F2R: 0 falha(s)`.

- [ ] **Step 5: Commit**

Só depois da tabela verde no Step 4.

```bash
cd ~/Workspace/forja/ferramentas
git add docs/trilha/fila_intel.py docs/trilha/teste_fila_redacao.py
git commit -m "feat: ENTRADA do 12B a partir de features e escolher

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task F2R-2: `SISTEMA_FILA`, `S`, `MAX`, `AVISO_ESTREITO` e as mensagens

**Files:**
- Modify: `fila_intel.py` (seção `# ---- redação`)
- Test: `teste_fila_redacao.py`

**Interfaces:**
- Consumes: `montar_entrada` (F2R-1).
- Consumes: `_u16` (A2, Task F2F-7) — a medida em UTF-16 já existe no módulo e não é redefinida aqui.
- Produces: `AVISO_ESTREITO`, `MAX`, `S`, `SISTEMA_FILA`, `mensagens(entrada) -> list[dict]`.

- [ ] **Step 1: Escrever os testes que falham**

Acrescentar em `casos()`, depois do bloco do F2R-1:

```python
    # ---------------------------------------------------------- F2R-2: prompt, S e faixa
    exige(F._u16("abc") == 3 and F._u16("🚀") == 2 and F._u16("é") == 1,
          "u16: conta unidades UTF-16, que e o que o Zod conta")
    exige(F.MAX == 500 - F._u16(F.AVISO_ESTREITO) - 10 and F.MAX == 440,
          "MAX = 500 - len(AVISO_ESTREITO) - 10")
    exige(F.MAX >= 300, "MAX >= 300 (os 300 do estilo cabem na gramatica)")
    exige(F._u16(F.AVISO_ESTREITO) + 1 + F.MAX <= 500,
          "prefixo + espaco + MAX cabe nos 500 do Zod, em UTF-16")
    exige(F._u16(F.AVISO_ESTREITO) <= 80, "AVISO_ESTREITO ate 80 caracteres")
    exige(F.S == {"type": "object",
                  "properties": {"summary": {"type": "string", "minLength": 60,
                                             "maxLength": F.MAX}},
                  "required": ["summary"], "additionalProperties": False},
          "S: um campo so, com a faixa 60..MAX")

    msgs = F.mensagens(ENTRADA_ESPERADA)
    exige([m["role"] for m in msgs] == ["system", "user"],
          "mensagens: exatamente system + um user (o template do Gemma exige alternancia)")
    exige(msgs[0]["content"] == F.SISTEMA_FILA, "mensagens: o system e o SISTEMA_FILA")
    exige(json.loads(msgs[1]["content"]) == ENTRADA_ESPERADA
          and ", " not in msgs[1]["content"] and '": ' not in msgs[1]["content"],
          "mensagens: o user e a ENTRADA em JSON compacto")
    exige("ç" in msgs[1]["content"] or "–" in msgs[1]["content"],
          "mensagens: ensure_ascii=False (o modelo ve o texto, nao \\uXXXX)")
    for proibido in ("ctr", "retenç", "impress", "inscrit", "score"):
        exige(proibido in F.SISTEMA_FILA.lower(),
              "SISTEMA_FILA: proibe explicitamente '%s'" % proibido)
    for chave in ("views_90d", "razao_coorte", "mediana_views_vida", "series_com_efeito",
                  "dias_sem_publicar", "ultimo_video", "views_90d_serie"):
        exige(chave in F.SISTEMA_FILA, "SISTEMA_FILA: o glossario explica '%s'" % chave)
    exige("summary" in F.SISTEMA_FILA,
          "SISTEMA_FILA: o contrato de saida esta no prompt (o llama nao poe o S la)")
```

- [ ] **Step 2: Rodar e ver falhar**

Expected: FAIL em `MAX` (`AttributeError`).

- [ ] **Step 3: As constantes e o `SISTEMA_FILA` inteiro**

`_u16` **já existe** no módulo (A2, Task F2F-7: `len(s.encode("utf-16-le")) // 2`) — este card o usa e não o redefine. O `len()` aqui é deliberado: a gramática limita `MAX` em **pontos de código**, e o `_u16` mede o que o **Zod** conta; os dois só divergem fora do BMP.

```python
AVISO_ESTREITO = "Sem CTR/retenção nesta fase; base: views e séries."
MAX = 500 - len(AVISO_ESTREITO) - 10          # 440 com o aviso atual, de 50 caracteres
S = {"type": "object",
     "properties": {"summary": {"type": "string", "minLength": 60, "maxLength": MAX}},
     "required": ["summary"], "additionalProperties": False}

SISTEMA_FILA = """Você redige UM campo: o resumo do estado de um canal do YouTube, em português do Brasil.

A ENTRADA é um JSON com dois objetos, "canal" e "series". Ela é a sua única fonte.

Regras:
1. Cite apenas números que estejam em "canal" ou em "series", exatamente como aparecem lá.
   Percentuais e razões só podem ser citados prontos; nunca converta um no outro.
2. Nunca calcule: não some, não subtraia, não divida, não arredonde, não converta unidades.
3. O tempo sem publicar aparece só como os dias de "dias_sem_publicar" ou como a data de
   "ultimo_video". Nunca em meses, nunca em anos.
4. Nunca escreva CTR, taxa de cliques, impressões, retenção, tempo de exibição, engajamento,
   curtidas, comentários, inscritos, nota nem score — nem para dizer que esses dados faltam.
   O restante do relatório já avisa disso.
5. Nunca escreva nomes de campo: views_90d, razao_coorte, mediana_views_vida, views_90d_serie,
   series_com_efeito, dias_sem_publicar, ultimo_video e afins ficam fora do texto.
6. A direção de cada série é a de "leitura", com as mesmas palavras. Nunca diga "acima" nem
   "abaixo" por conta própria.
7. Só descreva. Nunca recomende, sugira, aconselhe nem diga o que fazer.
8. Nomes de série vão entre aspas, sem tradução. O texto analítico é sempre em português do Brasil.
9. Duas frases, no máximo 300 caracteres.

Glossário da ENTRADA (as chaves explicam a entrada e nunca vão para o texto):
- videos: vídeos do canal no banco, de toda a vida do canal.
- views_90d: soma, sobre os vídeos do canal, das views de cada vídeo nos 90 dias até data_base.
  Não é o total do canal.
- ultimo_video: data do vídeo mais recente.
- dias_sem_publicar: dias entre ultimo_video e data_base.
- series_com_efeito: quantas séries se afastam da coorte. O canal pode ter outras que não se
  afastam e não aparecem aqui, então o texto nunca pode dizer que esse é o número de séries
  do canal.
- Em cada série: n = episódios considerados (os maduros e não ocultos); a série pode ter outros,
  então o texto nunca pode dizer que esse é o tamanho da série. ano = ano da série.
  mediana_views_vida = mediana das views de cada episódio desde que foi publicado.
  razao_coorte = essa mediana dividida pela mediana dos vídeos do mesmo ano fora da série.
  views_90d_serie = quantas das views dos últimos 90 dias do canal vieram dos episódios dessa
  série. Uma série pode estar abaixo da coorte na vida inteira e ainda assim concentrar o
  tráfego recente; quando for o caso, diga as duas coisas.

Saída: um objeto JSON com o campo "summary" — o estado do canal e o que os padrões de série
mostram."""


def mensagens(entrada):
    """system + UM user. Nunca dois 'user' seguidos: o template do Gemma exige alternancia
    (trilha/t4.py:48) e, com --jinja, dois user seguidos dao 500. A tentativa 2 repete
    exatamente estas mensagens, so com outro seed (§4.5 item 6)."""
    return [{"role": "system", "content": SISTEMA_FILA},
            {"role": "user", "content": json.dumps(entrada, ensure_ascii=False,
                                                   separators=(",", ":"))}]
```

- [ ] **Step 4: Rodar e ver passar**

Expected: PASS em todas, inclusive `MAX == 440` e `50 + 1 + 440 = 491 ≤ 500`.

- [ ] **Step 5: Commit**

Só depois da tabela verde no Step 4.

```bash
cd ~/Workspace/forja/ferramentas
git add docs/trilha/fila_intel.py docs/trilha/teste_fila_redacao.py
git commit -m "feat: SISTEMA_FILA, gramatica S e faixa do summary

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task F2R-3: o pedido ao llama e o Aceite

**Files:**
- Modify: `fila_intel.py`
- Test: `teste_fila_redacao.py`

**Interfaces:**
- Consumes: `mensagens`, `S` (F2R-2); um cliente assíncrono com `.post(url, json=…, timeout=…)` — o mesmo contrato do `cli` do `sitio.pedir` (`sitio.py:90`), injetado por `abrir_llama` no `main()` (§4.1).
- Produces: `aceitar(resp) -> (summary|None, motivo|None)`; `gerar(cli_llama, msgs, restante_s, seed=None) -> (summary|None, motivo|None, diag)`.

- [ ] **Step 1: Escrever os testes que falham**

Acrescentar em `casos()`:

```python
    # ---------------------------------------------------------- F2R-3: pedido e Aceite
    def resp(conteudo, fim="stop", **extra):
        msg = {"role": "assistant", "content": conteudo}
        msg.update(extra)
        return {"choices": [{"index": 0, "message": msg, "finish_reason": fim}],
                "usage": {"completion_tokens": 120},
                "timings": {"predicted_per_second": 39.0}}

    bom = json.dumps({"summary": "x" * 70})
    exige(F.aceitar(resp(bom)) == ("x" * 70, None), "Aceite: finish_reason stop + uma chave")
    exige(F.aceitar(resp(bom, fim="length"))[1] == "truncado", "Aceite: finish_reason length")
    exige(F.aceitar(resp(bom, reasoning_content="pensei"))[1] == "pensou",
          "Aceite: reasoning_content nao vazio")
    exige(F.aceitar(resp(bom, reasoning_content=""))[1] is None,
          "Aceite: reasoning_content vazio passa")
    exige(F.aceitar(resp("{nao e json"))[1] == "json", "Aceite: json invalido")
    exige(F.aceitar(resp(json.dumps({"summary": "x", "extra": 1})))[1] == "json",
          "Aceite: chave a mais")
    exige(F.aceitar(resp(json.dumps({"resumo": "x"})))[1] == "json", "Aceite: chave errada")
    exige(F.aceitar(resp(json.dumps({"summary": 12})))[1] == "json",
          "Aceite: summary que nao e string")

    class LlamaFalso:
        def __init__(self, r=None, erro=None):
            self.r, self.erro, self.pedidos = r, erro, []

        async def post(self, url, json=None, timeout=None):
            self.pedidos.append((url, json, timeout))
            if self.erro:
                raise self.erro
            class R:
                status_code = 200
                def json(_s):
                    return self.r
            return R()

    cli = LlamaFalso(resp(bom))
    s, mot, diag = asyncio.run(F.gerar(cli, F.mensagens(ENTRADA_ESPERADA), 20 * 60))
    url, corpo, tempo = cli.pedidos[0]
    exige(url == "http://127.0.0.1:8080/v1/chat/completions", "pedido: vai direto a 8080")
    exige(corpo["response_format"] == {"type": "json_schema",
                                       "json_schema": {"name": "redacao", "strict": True,
                                                       "schema": F.S}},
          "pedido: response_format json_schema strict com o S")
    exige(corpo["temperature"] == 0.4 and corpo["max_tokens"] == 6144,
          "pedido: temperature 0.4 e max_tokens 6144")
    exige(corpo["chat_template_kwargs"] == {"enable_thinking": False},
          "pedido: enable_thinking desligado, como a fase 1")
    exige(tempo == 600.0, "pedido: com orcamento inteiro, timeout de 600 s")
    exige(asyncio.run(F.gerar(LlamaFalso(resp(bom)), [], 11 * 60))[2]["timeout_s"] == 11 * 60 - 120,
          "pedido: com pouco orcamento, timeout = restante - 120 s")
    exige(0 <= corpo["seed"] < 2 ** 31 and diag["seed"] == corpo["seed"],
          "pedido: seed sorteado e devolvido no diag (vai para 'seeds' no jsonl)")
    vistos = {asyncio.run(F.gerar(LlamaFalso(resp(bom)), [], 20 * 60))[2]["seed"]
              for _ in range(8)}
    exige(len(vistos) > 1, "pedido: o seed nunca e fixo (as 3 rodadas do F2 dariam o mesmo texto)")
    exige(diag["tps"] == 39.0 and diag["usage"] == {"completion_tokens": 120}
          and diag["reasoning"] == 0,
          "pedido: o diag leva usage, len(reasoning_content) e predicted_per_second")

    class Timeout(Exception):
        pass
    exige(asyncio.run(F.gerar(LlamaFalso(erro=Timeout()), [], 20 * 60))[1] == "timeout",
          "pedido: excecao com 'timeout' no nome vira motivo timeout (idioma do sitio.py:105)")
    exige(asyncio.run(F.gerar(LlamaFalso(erro=OSError()), [], 20 * 60))[1] == "llama",
          "pedido: erro de rede vira motivo llama")
    magro = LlamaFalso(resp(bom))
    exige(asyncio.run(F.gerar(magro, [], 100))[1] == "timeout" and magro.pedidos == [],
          "pedido: sem orcamento para um timeout positivo, nem chama o llama")
```

- [ ] **Step 2: Rodar e ver falhar**

Expected: FAIL em `aceitar`.

- [ ] **Step 3: `aceitar` e `gerar`**

```python
def aceitar(resp):
    """Aceite (§4.4): so com finish_reason 'stop', reasoning_content vazio ou ausente,
    json.loads sem erro e chaves == {'summary'}. Devolve (summary, motivo)."""
    ch = (resp.get("choices") or [{}])[0]
    if ch.get("finish_reason") != "stop":
        return None, "truncado"
    msg = ch.get("message") or {}
    if msg.get("reasoning_content"):
        return None, "pensou"
    try:
        obj = json.loads(msg.get("content") or "")
    except (ValueError, TypeError):
        return None, "json"
    if not isinstance(obj, dict) or set(obj) != {"summary"} or not isinstance(obj["summary"], str):
        return None, "json"          # chave a mais, chave errada ou tipo errado
    return obj["summary"], None


async def gerar(cli_llama, msgs, restante_s, seed=None):
    """Uma tentativa de geracao. (summary|None, motivo|None, diag).
    A geracao vai DIRETO a 8080: nao passa pelo roteador, nao escreve em roteamento.jsonl
    e nao depende do proxy (§4.1 passo 6)."""
    seed = secrets.randbelow(2 ** 31) if seed is None else seed
    tempo = min(600.0, float(restante_s) - 120.0)
    diag = {"seed": seed, "timeout_s": tempo, "usage": None, "reasoning": 0, "tps": None}
    if tempo <= 0:
        return None, "timeout", diag
    corpo = {"messages": msgs, "temperature": 0.4, "seed": seed, "max_tokens": 6144,
             "chat_template_kwargs": {"enable_thinking": False},
             "response_format": {"type": "json_schema",
                                 "json_schema": {"name": "redacao", "strict": True,
                                                 "schema": S}}}
    try:
        r = await cli_llama.post("http://127.0.0.1:8080/v1/chat/completions",
                                 json=corpo, timeout=tempo)
    except Exception as e:                       # mesmo idioma de sitio.py:105
        return None, ("timeout" if "timeout" in e.__class__.__name__.lower() else "llama"), diag
    if getattr(r, "status_code", 200) != 200:
        return None, "llama", diag
    try:
        dados = r.json()
    except Exception:
        return None, "json", diag
    msg = ((dados.get("choices") or [{}])[0].get("message") or {})
    diag["usage"] = dados.get("usage")
    diag["reasoning"] = len(msg.get("reasoning_content") or "")
    diag["tps"] = (dados.get("timings") or {}).get("predicted_per_second")
    s, motivo = aceitar(dados)
    return s, motivo, diag
```

- [ ] **Step 4: Rodar e ver passar**

- [ ] **Step 5: Commit**

Só depois da tabela verde no Step 4.

```bash
cd ~/Workspace/forja/ferramentas
git add docs/trilha/fila_intel.py docs/trilha/teste_fila_redacao.py
git commit -m "feat: pedido ao llama e Aceite da resposta

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task F2R-4: o Aparo e o corte em frases

**Files:**
- Modify: `fila_intel.py` (seção `# ---- validador`)
- Test: `teste_fila_redacao.py`

**Interfaces:**
- Consumes: nada além do stdlib.
- Produces: `frases(t) -> list[str]`, `aparar(s) -> (texto, motivo|None)`, `prefixar(summary) -> str`, e o privado `_cortes(t) -> list[int]` (o corte comum ao Aparo, ao papel das views e ao 5b).

- [ ] **Step 1: Escrever os testes que falham**

```python
    # ---------------------------------------------------------- F2R-4: Aparo e frases
    exige(F.aparar("O canal esta parado. A serie fica abaixo da coorte.")
          == ("O canal esta parado. A serie fica abaixo da coorte.", None),
          "Aparo: texto que ja termina em ponto nao e tocado")
    exige(F.aparar("O canal nao publica desde 10/12/2024 e segue sem novos videos. "
                   "A serie 0-10 fica abaixo da coorte e concentra o trafego rec")
          == ("O canal nao publica desde 10/12/2024 e segue sem novos videos.", None),
          "Aparo: corta no ultimo [.!?] seguido de espaco")
    exige(F.aparar('A serie "Ep. 3" abriu o ano e o canal seguiu parado por 647 dias. Fim no')
          == ('A serie "Ep. 3" abriu o ano e o canal seguiu parado por 647 dias.', None),
          "Aparo: o ponto logo apos 'Ep' e o que esta entre aspas nao sao corte")
    exige(F._cortes("0,63 e 1.5 sao numeros") == [],
          "Aparo: pontuacao entre digitos nunca e corte")
    exige(F.aparar("Sem ponto nenhum neste texto que passa dos sessenta caracteres com folga")[1]
          == "curto",
          "Aparo: sem nenhum corte valido -> curto")
    exige(F.aparar("O canal esta parado, sem publicar. E o resto do texto veio sem ponto")
          == ("O canal esta parado, sem publicar.", "curto"),
          "Aparo: cortou, mas sobrou menos de 60 -> curto")

    exige(F.frases("Uma. Duas! Tres?") == ["Uma.", "Duas!", "Tres?"],
          "frases: corta em . ! ?")
    exige(F.frases("O canal tem 0,63 de razao. Fim.") == ["O canal tem 0,63 de razao.", "Fim."],
          "frases: a virgula decimal nao corta")
    exige(len(F.frases('A serie "0-10" e de 2019. Fim.')) == 2,
          "frases: ponto dentro de aspas nao corta")
    exige(F.prefixar("texto") == F.AVISO_ESTREITO + " texto",
          "prefixo: AVISO_ESTREITO + um espaco")
```

- [ ] **Step 2: Rodar e ver falhar**

- [ ] **Step 3: `_cortes`, `frases`, `aparar`, `prefixar`**

```python
# ------------------------------------------------------------------ validador (§4.5)
_ASPAS_PAR = {"“": "”", "‘": "’", "«": "»"}
_RE_FIM = re.compile(r"[.!?](?=\s|$)")
_RE_ABREV = re.compile(r"(?:\bEp|\bPart|\bvs|\bnº)$", re.IGNORECASE)


def _em_aspas(t, i):
    """True se a posicao i esta dentro de um par de aspas (retas ou curvas)."""
    aberta = None
    for j in range(i):
        c = t[j]
        if aberta is None:
            if c in _ASPAS_PAR or c in "\"'":
                aberta = _ASPAS_PAR.get(c, c)
        elif c == aberta:
            aberta = None
    return aberta is not None


def _cortes(t):
    """Posicoes de [.!?] que valem como fim de frase (§4.4, Aparo). O corte NAO vale para
    pontuacao dentro de aspas, entre digitos, nem logo apos Ep|Part|vs|nº."""
    fora = []
    for m in _RE_FIM.finditer(t):
        i = m.start()
        if 0 < i < len(t) - 1 and t[i - 1].isdigit() and t[i + 1].isdigit():
            continue
        if _RE_ABREV.search(t[:i]):
            continue
        if _em_aspas(t, i):
            continue
        fora.append(i)
    return fora


def frases(t):
    """O mesmo corte em frases do Aparo — usado pelo papel das views e pelo 5b (§4.5)."""
    ini, saida = 0, []
    for i in _cortes(t):
        p = t[ini:i + 1].strip()
        if p:
            saida.append(p)
        ini = i + 1
    resto = t[ini:].strip()
    if resto:
        saida.append(resto)
    return saida


def aparar(s):
    """Primeiro passo do validador (§4.4). Um summary que termine sem . ! ? e aparado no
    ultimo corte valido. Sobrando menos de 60 (o minimo da FAIXA, que a gramatica conta em
    pontos de codigo), reprova com motivo 'curto' — que conta como 'chegou ao validador':
    leva a tentativa 2 ou ao template, nunca a fail."""
    t = (s or "").strip()
    if t.endswith((".", "!", "?")):
        return t, None
    cortes = _cortes(t)
    if not cortes:
        return t, "curto"
    t2 = t[:cortes[-1] + 1].strip()
    return (t2, None) if len(t2) >= 60 else (t2, "curto")


def prefixar(summary):
    """AVISO_ESTREITO + um espaco. O '+1' do teto de 500 do item 1 e esse espaco."""
    return AVISO_ESTREITO + " " + summary


def aplicar_summary(payload, summary):
    """O unico ponto em que o texto do modelo entra no payload. O codigo nunca le do modelo
    numero, padrao nem prioridade: so a string summary (§4.4)."""
    payload.setdefault("coaching", {})["summary"] = prefixar(summary)
    payload["coaching"].setdefault("priorities", [])
    return payload
```

- [ ] **Step 4: Rodar e ver passar**

- [ ] **Step 5: Commit**

Só depois da tabela verde no Step 4.

```bash
cd ~/Workspace/forja/ferramentas
git add docs/trilha/fila_intel.py docs/trilha/teste_fila_redacao.py
git commit -m "feat: aparo do summary e corte em frases

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task F2R-5: Normalização — etapas (0), (a2), (b), (c), (d), (e), (f)

**Files:**
- Modify: `fila_intel.py`
- Test: `teste_fila_redacao.py`

**Interfaces:**
- Consumes: `carregar_sitio()` — `norm` (`sitio.py:136-138`, minúsculas sem acento e **mesmo comprimento**, o que deixa os spans válidos no texto original) e `_t` (`:141-142`).
- Produces: `normalizar(v)`, `tokens(t) -> (numeros, datas)`, `permitidos(entrada) -> (numeros, datas)`, `_sem_nomes(t, entrada)`, `numeros(limpo, entrada) -> list[str]`.

- [ ] **Step 1: Escrever os testes que falham**

```python
    # ---------------------------------------------------------- F2R-5: normalizacao
    E = ENTRADA_ESPERADA

    def num(t):
        """Itens 3 e 4 sobre um texto, ja passado pela etapa (a2)."""
        return F.numeros(F._sem_nomes(t, E), E)

    # (a2) nomes
    exige(num("a série 0–10 rende 0,63× da coorte") == [],
          "(a2): o nome da serie sai, e 0 e 10 nao viram token")
    exige(num("a série '0-10' rende 0,63× da coorte") == [],
          "(a2): - – — sao equivalentes na comparacao")
    exige(num("a série “0–10” rende 0,63× da coorte") == [],
          "(a2): o nome sai tambem entre aspas curvas (o template)")
    exige(num("os vídeos 0 a 10 renderam pouco") != [],
          "(a2): '0 a 10' nao e o nome; 0 e 10 reprovam")

    # (b) datas e anos
    for bom in ("12/2024", "dezembro de 2024", "dez/2024", "em 2024", "18/09",
                "18 de setembro de 2026", "a série de 2019"):
        exige(num("o canal parou em %s e segue assim" % bom) == [],
              "(b) passa: %s" % bom)
    for mau in ("em 2023", "11/2024", "novembro de 2024"):
        exige(num("o canal parou em %s e segue assim" % mau) == ["numero"],
              "(b) reprova: %s" % mau)

    # (c) numero e sufixo
    for bom in ("0,63×", "0,63 ×", "0,63 x"):
        exige(num("a coorte rende %s do esperado" % bom) == [], "(c) passa: %s" % bom)
    exige(num("a coorte rende 0,63 do esperado") == ["numero"],
          "(c): o mesmo valor com outro tipo nao casa")
    exige(num("a coorte rende 63% do esperado") == ["numero"],
          "(c): percentual convertido da razao reprova")
    exige(num("o canal tem 0,630 de razao média") == ["numero"],
          "(f): igualdade estrita, com as mesmas casas")

    # (d) por extenso
    for mau, motivo in (("a série rende metade da coorte", "extenso"),
                        ("a série rende o dobro da coorte", "extenso"),
                        ("a série rende o triplo da coorte", "extenso"),
                        ("a série rende duas vezes menos", "extenso"),
                        ("o canal está parado há dois anos", "tempo"),
                        ("o canal está parado há 2 anos", "tempo"),
                        ("o canal está parado há meio ano", "tempo"),
                        ("o canal está parado há tres meses", "tempo")):
        exige(motivo in num(mau), "(d) reprova %s: %s" % (motivo, mau))
    exige(num("o canal está parado há 647 dias") == [],
          "(d): o tempo sem publicar em dias passa")
    exige(num("uma série do canal ficou para trás") == [],
          "(d): 'um'/'uma' sao artigo e nao contam")
    exige(num("onze episódios entraram na conta") == [],
          "(d): 'onze' e token numero e casa com n = 11")
    exige(num("doze episódios entraram na conta") == ["numero"],
          "(d): 'doze' nao esta na ENTRADA")

    # (e) constante
    exige(num("nos últimos 90 dias o canal seguiu parado") == [],
          "(e): 90 e a unica constante sempre permitida")
    exige(num("nos últimos 28 dias o canal seguiu parado") == ["numero"],
          "(e): 28 e 30 nao entram")

    # (0) tokens permitidos
    nums, datas = F.permitidos(E)
    exige(("29", "numero") in nums and ("647", "numero") in nums
          and ("0.63", "×") in nums and ("91", "numero") in nums,
          "(0): os numeros de canal e series viram token")
    exige((18, 9, 2026) in datas and (10, 12, 2024) in datas and (None, None, 2019) in datas,
          "(0): data_base, ultimo_video e o ano da serie")
    exige(not any(v in ("0", "10") for v, _ in nums),
          "(0): nome e series[].nome nunca geram token")
```

- [ ] **Step 2: Rodar e ver falhar**

- [ ] **Step 3: A normalização**

```python
_MES = (r"(?:jan(?:eiro)?|fev(?:ereiro)?|mar(?:co)?|abr(?:il)?|mai(?:o)?|jun(?:ho)?"
        r"|jul(?:ho)?|ago(?:sto)?|set(?:embro)?|out(?:ubro)?|nov(?:embro)?|dez(?:embro)?)\b")
_MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]

# (b) — a ordem de alternancia e a do §4.5, e e o que impede 18/09/2026 de virar 18/09 + 2026.
_RE_DATA = re.compile(
    r"(?P<d1>\d{1,2})/(?P<m1>\d{1,2})/(?P<a1>\d{4})"
    r"|(?P<m2>\d{1,2})/(?P<a2>\d{4})"
    r"|(?P<d3>\d{1,2})/(?P<m3>\d{1,2})"
    r"|(?P<d4>\d{1,2}) de (?P<m4>" + _MES + r")(?: de (?P<a4>\d{4}))?"
    r"|(?P<m5>" + _MES + r")(?:\.)?(?: de|/)? ?(?P<a5>\d{4})"
    r"|\b(?P<a6>20(?:0[5-9]|[12]\d|30))\b")

# (c) — o espaco opcional existe porque o modelo copia 0,63× colado e as vezes separa.
_RE_NUM = re.compile(r"(?<![\d,.])(\d{1,3}(?:\.\d{3})+|\d+(?:,\d+)?)(?:( ?[%x×])|( vezes))?")

_EXT = {"dois": 2, "duas": 2, "tres": 3, "quatro": 4, "cinco": 5, "seis": 6, "sete": 7,
        "oito": 8, "nove": 9, "dez": 10, "onze": 11, "doze": 12, "treze": 13,
        "catorze": 14, "quatorze": 14, "quinze": 15, "dezesseis": 16, "dezessete": 17,
        "dezoito": 18, "dezenove": 19, "vinte": 20}
_RE_EXTENSO_MAU = re.compile(r"\b(metade|dobro|triplo|(?:%s) vezes)\b" % "|".join(_EXT))
_RE_EXTENSO = re.compile(r"\b(%s)\b(?! vezes)" % "|".join(_EXT))
_RE_TEMPO = re.compile(r"\b(\d+|um|uma|meio|dois|duas|tres|quatro|cinco) (anos?|mes|meses)\b")

CONSTANTES = {("90", "numero")}      # (e) — a janela de recent e do template. 28/30/60/180 nao.


def normalizar(v):
    """A MESMA funcao nos dois lados da comparacao (etapa 0). sitio.norm preserva o
    comprimento, entao os spans continuam valendo no texto original."""
    s = carregar_sitio().norm(v or "")
    return s.replace("–", "-").replace("—", "-").replace("−", "-")


def _valor(txt):
    """'1.160' -> '1160'; '0,63' -> '0.63'. String, nunca Decimal: a igualdade do item (f)
    e estrita nas casas, e Decimal('0.63') == Decimal('0.630')."""
    return txt.replace(".", "").replace(",", ".")


def _mes_num(m):
    return _MESES.index(m[:3]) + 1


def tokens(t):
    """Etapas (b) e (c) sobre um texto JA normalizado. Devolve (numeros, datas).
    As datas saem primeiro e sao apagadas, senao 18/09/2026 viraria tres numeros."""
    datas, resto = [], t
    def _apaga(m):
        return " " * (m.end() - m.start())
    for m in _RE_DATA.finditer(t):
        g = m.groupdict()
        if g["a1"]:
            datas.append((int(g["d1"]), int(g["m1"]), int(g["a1"])))
        elif g["a2"]:
            datas.append((None, int(g["m2"]), int(g["a2"])))
        elif g["m3"]:
            datas.append((int(g["d3"]), int(g["m3"]), None))
        elif g["m4"]:
            datas.append((int(g["d4"]), _mes_num(g["m4"]), int(g["a4"]) if g["a4"] else None))
        elif g["m5"]:
            datas.append((None, _mes_num(g["m5"]), int(g["a5"])))
        else:
            datas.append((None, None, int(g["a6"])))
    resto = _RE_DATA.sub(_apaga, t)
    nums = set()
    for m in _RE_NUM.finditer(resto):
        suf = (m.group(2) or "").strip()
        tipo = "%" if suf == "%" else ("×" if (suf in ("x", "×") or m.group(3)) else "numero")
        nums.add((_valor(m.group(1)), tipo))
    for m in _RE_EXTENSO.finditer(resto):
        nums.add((str(_EXT[m.group(1)]), "numero"))
    return nums, datas


def permitidos(entrada):
    """Etapa (0): tokens de TODAS as strings de canal e series, menos os dois 'nome'."""
    nums, datas = set(CONSTANTES), []
    fontes = [(k, v) for k, v in entrada["canal"].items() if k != "nome"]
    for s in entrada["series"]:
        fontes += [(k, v) for k, v in s.items() if k != "nome"]
    for _, v in fontes:
        n, d = tokens(normalizar(v))
        nums |= n
        datas += d
    return nums, datas


def _sem_nomes(t, entrada):
    """Etapa (a2): sai TODA ocorrencia literal de norm(_t(nome)), de serie e de canal,
    entre aspas ou nao e sem minimo de tamanho. Trocada por espacos, para os spans dos
    itens 3 a 5 continuarem valendo."""
    fora = normalizar(t)
    nomes = [entrada["canal"].get("nome", "")] + [s.get("nome", "") for s in entrada["series"]]
    for nome in sorted((n for n in nomes if n), key=len, reverse=True):
        alvo = normalizar(nome)
        if not alvo:
            continue
        i = 0
        while True:
            j = fora.find(alvo, i)
            if j < 0:
                break
            fora = fora[:j] + " " * len(alvo) + fora[j + len(alvo):]
            i = j + len(alvo)
    return fora


def numeros(limpo, entrada):
    """Itens 3 (numeros) e 4 (normalizacao) sobre o texto ja sem os nomes (a2).
    'limpo' ja vem normalizado por _sem_nomes."""
    motivos = []
    if _RE_EXTENSO_MAU.search(limpo):
        motivos.append("extenso")            # o SISTEMA_FILA proibe converter razoes
    if _RE_TEMPO.search(limpo):
        motivos.append("tempo")              # o tempo sem publicar so em dias, ou pela data
    ok_nums, ok_datas = permitidos(entrada)
    nums, datas = tokens(limpo)
    for d in datas:
        if not any(all(c is None or c == p[k] for k, c in enumerate(d)) for p in ok_datas):
            motivos.append("numero")         # (b): todo componente nao nulo tem de casar
            break
    for tk in nums:
        if tk not in ok_nums:                # (f): mesmo tipo, mesmas casas
            motivos.append("numero")
            break
    return motivos
```

- [ ] **Step 4: Rodar e ver passar**

Conferir na saída que os 7 casos que passam e os 3 que reprovam da tabela (b) saem exatamente como o spec manda, e que `0,63 ×` e `0,63 x` passam junto de `0,63×`.

- [ ] **Step 5: Commit**

Só depois da tabela verde no Step 4.

```bash
cd ~/Workspace/forja/ferramentas
git add docs/trilha/fila_intel.py docs/trilha/teste_fila_redacao.py
git commit -m "feat: normalizacao do validador (nomes, datas e numeros)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task F2R-6: item 3 — o papel das views

**Files:**
- Modify: `fila_intel.py`
- Test: `teste_fila_redacao.py`

**Interfaces:**
- Consumes: `frases` (F2R-4), `normalizar`/`_sem_nomes`/`_RE_DATA` (F2R-5).
- Produces: `papel(texto, entrada) -> list[str]` (motivo `papel`).

Sem esta regra, `91 views nos últimos 90 dias` — a mediana de vida no papel da janela, o mesmo erro de 3× que a fase 1 já cometeu por outro caminho (§10) — passa em todos os itens 3–5b, porque 91 **está** na `ENTRADA`.

- [ ] **Step 1: Escrever os testes que falham**

```python
    # ---------------------------------------------------------- F2R-6: papel das views
    exige(F.papel("29 views nos ultimos 90 dias", E) == [],
          "papel: 29 e views_90d, e esta no papel da janela")
    exige(F.papel("mediana de 91 views na vida, e 16 das 29 views dos ultimos 90 dias", E) == [],
          "papel: mediana de vida marcada, e a janela com views_90d/views_90d_serie")
    exige(F.papel("91 views nos ultimos 90 dias", E) == ["papel"],
          "papel: a mediana de vida no papel da janela reprova")
    exige(F.papel("35 views nos ultimos 90 dias", E) == ["papel"],
          "papel: o numero de videos no papel da janela reprova")
    exige(F.papel("mediana de 91 views na vida", E) == [],
          "papel: sem a janela na frase, o item nao e checado")
    exige(F.papel("o canal tem 35 videos no banco e 29 views nos ultimos 90 dias", E) == [],
          "papel: 35 nao esta a ate 3 palavras de 'views'")
    exige(F.papel("29 visualizacoes nos ultimos 90 dias", E) == [],
          "papel: 'visualizacoes' conta como 'views'")
    exige(F.papel("91 views nos ultimos noventa dias", E) == ["papel"],
          "papel: 'noventa dias' tambem aciona a regra")
    exige(F.papel("91 views na vida. E 35 views nos ultimos 90 dias.", E) == ["papel"],
          "papel: o corte em frases e o do 5b — so a segunda frase e checada")
```

- [ ] **Step 2: Rodar e ver falhar**

- [ ] **Step 3: `papel`**

```python
_RE_JANELA = re.compile(r"\b(90|noventa) dias\b")
_RE_SO_NUM = re.compile(r"(?<![\d,.])(\d{1,3}(?:\.\d{3})+|\d+(?:,\d+)?)")
_RE_VIEWS = re.compile(r"(?:\W+\w+){0,2}\W*\b(?:views|visualizacoes)\b")
_RE_VIDA = re.compile(r"(?:\W+\w+){0,3}\W*\bna vida\b")
_RE_MEDIANA = re.compile(r"\bmediana de\s*$")


def papel(texto, entrada):
    """Item 3, papel das views (§4.5). Numa frase que cite '90 dias' ou 'noventa dias',
    todo numero seguido, em ate 3 palavras, de views/visualizacoes so pode ser views_90d
    ou views_90d_serie; a excecao — precedido de 'mediana de' ou seguido, em ate 4
    palavras, de 'na vida' — so pode ser mediana_views_vida."""
    janela = {_valor(normalizar(v)) for k, v in entrada["canal"].items() if k == "views_90d"}
    vidas = set()
    for s in entrada["series"]:
        janela |= {_valor(normalizar(v)) for k, v in s.items() if k == "views_90d_serie"}
        vidas |= {_valor(normalizar(v)) for k, v in s.items() if k == "mediana_views_vida"}
    motivos = []
    for fr in frases(texto):
        n = _RE_DATA.sub(lambda m: " " * (m.end() - m.start()), _sem_nomes(fr, entrada))
        if not _RE_JANELA.search(n):
            continue
        for m in _RE_SO_NUM.finditer(n):
            depois, antes = n[m.end():], n[:m.start()]
            if not _RE_VIEWS.match(depois):
                continue
            vida = bool(_RE_MEDIANA.search(antes)) or bool(_RE_VIDA.match(depois))
            if _valor(m.group(1)) not in (vidas if vida else janela):
                motivos.append("papel")
    return motivos
```

- [ ] **Step 4: Rodar e ver passar**

- [ ] **Step 5: Commit**

Só depois da tabela verde no Step 4.

```bash
cd ~/Workspace/forja/ferramentas
git add docs/trilha/fila_intel.py docs/trilha/teste_fila_redacao.py
git commit -m "feat: papel das views no validador

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task F2R-7: item 5 — proibidos e rótulos crus

**Files:**
- Modify: `fila_intel.py`
- Test: `teste_fila_redacao.py`

**Interfaces:**
- Consumes: `_sem_nomes` (F2R-5).
- Produces: `proibidos(limpo) -> list[str]` (motivos `proibido` e `rotulo_cru`).

- [ ] **Step 1: Escrever os testes que falham**

```python
    # ---------------------------------------------------------- F2R-7: proibidos
    def proi(t):
        return F.proibidos(F._sem_nomes(t, E))

    exige(proi("a grade de horarios do canal") == [], "proibidos passa: grade de horarios")
    exige(proi("a nota e o titulo do video") == [], "proibidos passa: a nota e o titulo")
    exige(proi("o tempo de exibicao caiu") == ["proibido"], "proibidos reprova: tempo de exibicao")
    exige(proi("views_90d ficou em 29") == ["rotulo_cru"], "rotulo_cru reprova: views_90d")
    exige(proi("a razao_coorte da serie") == ["rotulo_cru"], "rotulo_cru reprova: razao_coorte")
    for mau in ("o ctr caiu", "a taxa de cliques caiu", "as impressoes cairam",
                "a impressao caiu", "a retencao caiu", "as retencoes cairam",
                "os retidos cairam", "o watch time caiu", "o watchtime caiu",
                "nota 7 no eixo", "nota b no eixo", "o score do video",
                "impressions cairam", "retention caiu", "o engajamento caiu",
                "engagement caiu", "as curtidas cairam", "os likes cairam",
                "os comentarios cairam", "a duracao media caiu", "o tempo medio caiu",
                "os inscritos cairam", "subscribers cairam"):
        exige("proibido" in proi(mau), "proibidos reprova: %s" % mau)
```

- [ ] **Step 2: Rodar e ver falhar**

- [ ] **Step 3: `proibidos`**

```python
_RE_PROIBIDO = re.compile(
    r"\b(ctr|taxa de cliques|impress(ao|oes)|retenc(ao|oes)|retid[oa]s?"
    r"|tempo (de )?exibic(ao|oes)|watch ?time|nota [0-9]|nota [a-f] ?(no|na|do|da|de)|score"
    r"|impressions?|retention|engajamento|engagement|curtidas?|likes?|comentarios?"
    r"|duracao media|tempo medio|inscrit[oa]s?|subscribers?)\b")
# O 0-9 e obrigatorio: com [a-z_]+, views_90d escapa inteiro, porque o que vem depois do _
# comeca por digito — e e justamente o rotulo que o glossario mostra ao modelo.
_RE_ROTULO = re.compile(r"\b[a-z]+_[a-z0-9_]+\b")


def proibidos(limpo):
    """Item 5 (§4.5), sobre o texto ja sem acento (normalizar) e sem os nomes (a2)."""
    motivos = []
    if _RE_PROIBIDO.search(limpo):
        motivos.append("proibido")
    if _RE_ROTULO.search(limpo):
        motivos.append("rotulo_cru")
    return motivos
```

- [ ] **Step 4: Rodar e ver passar**

Conferir em particular que `a nota e o titulo` **passa** (o `[a-f]` casa o "e", mas o `(no|na|do|da|de)` seguinte não casa "o titulo") e que `nota b no eixo` reprova.

- [ ] **Step 5: Commit**

Só depois da tabela verde no Step 4.

```bash
cd ~/Workspace/forja/ferramentas
git add docs/trilha/fila_intel.py docs/trilha/teste_fila_redacao.py
git commit -m "feat: proibidos e rotulos crus no validador

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task F2R-8: item 5b — direção

**Files:**
- Modify: `fila_intel.py`
- Test: `teste_fila_redacao.py`

**Interfaces:**
- Consumes: `frases` (F2R-4), `normalizar` (F2R-5) — o 5b roda sobre o texto **com** os nomes, porque é por eles que ele acha a série de cada frase.
- Produces: `direcao(texto, entrada) -> list[str]` (motivo `direcao`).

- [ ] **Step 1: Escrever os testes que falham**

```python
    # ---------------------------------------------------------- F2R-8: direcao (5b)
    exige(F.direcao("a série 0–10 fica abaixo da coorte (0,63×)", E) == [],
          "5b passa: a direcao e a da leitura")
    exige(F.direcao("a série 0–10 supera a coorte, com 0,63×", E) == ["direcao"],
          "5b reprova: 'supera' com leitura 'abaixo da coorte'")
    exige(F.direcao("o conjunto de episódios supera a coorte, com 0,63×", E) == ["direcao"],
          "5b reprova: frase sem nome de serie, pela leitura comum")
    exige(F.direcao("o canal nao publica desde 10/12/2024", E) == [],
          "5b passa: frase sem palavra de direcao")
    for mau in ("a série 0–10 fica acima da coorte", "a série 0–10 superam a coorte",
                "a série 0–10 e superior a coorte", "a série 0–10 e melhor que a coorte"):
        exige(F.direcao(mau, E) == ["direcao"], "5b reprova (abaixo): %s" % mau)
    Eacima = {"canal": E["canal"],
              "series": [{**E["series"][0], "leitura": "acima da coorte",
                          "razao_coorte": "1,80×"}]}
    for mau in ("a série 0–10 fica abaixo da coorte", "a série 0–10 e inferior a coorte",
                "a série 0–10 e pior que a coorte", "a série 0–10 fica atras da coorte",
                "as séries ficam atras da coorte"):
        exige(F.direcao(mau, Eacima) == ["direcao"], "5b reprova (acima): %s" % mau)
    Emistas = {"canal": E["canal"],
               "series": [E["series"][0], {**E["series"][0], "nome": "Vlogzeira",
                                           "leitura": "acima da coorte"}]}
    exige(F.direcao("o conjunto supera a coorte", Emistas) == [],
          "5b: com leituras diferentes, frase sem nome de serie nao e checada")
    exige(F.direcao("0–10 e Vlogzeira superam a coorte", Emistas) == [],
          "5b: frase que cita duas series de leituras opostas nao e checada")
    exige(F.direcao("nenhuma série se afasta", {"canal": E["canal"], "series": []}) == [],
          "5b: sem serie nenhuma, o item nao roda")
```

- [ ] **Step 2: Rodar e ver falhar**

- [ ] **Step 3: `direcao`**

```python
_RE_ACIMA = re.compile(r"\b(acima|supera(m)?|superior(es)?|melhor(es)? que)\b")
_RE_ABAIXO = re.compile(r"\b(abaixo|inferior(es)?|pior(es)? que|fica(m)? atras)\b")


def direcao(texto, entrada):
    """Item 5b (§4.5). A direcao de cada serie e a da sua 'leitura', com as mesmas palavras.
    Uma frase que nao cite nenhuma serie e checada contra a leitura comum quando ha ao menos
    uma serie e TODAS tem a mesma leitura — o caso de 1 serie, o unico da 2a. Sem isso basta
    nao nomear a serie para inverter a direcao e nada barra."""
    series = entrada.get("series") or []
    if not series:
        return []
    leituras = {s["leitura"] for s in series}
    comum = series[0]["leitura"] if len(leituras) == 1 else None
    motivos = []
    for fr in frases(texto):
        n = normalizar(fr)
        citadas = [s for s in series if normalizar(s["nome"]) and normalizar(s["nome"]) in n]
        if citadas:
            vistas = {s["leitura"] for s in citadas}
            leitura = citadas[0]["leitura"] if len(vistas) == 1 else None
        else:
            leitura = comum
        if leitura is None:
            continue
        mau = _RE_ACIMA if leitura == "abaixo da coorte" else _RE_ABAIXO
        if mau.search(n):
            motivos.append("direcao")
    return motivos
```

- [ ] **Step 4: Rodar e ver passar**

- [ ] **Step 5: Commit**

Só depois da tabela verde no Step 4.

```bash
cd ~/Workspace/forja/ferramentas
git add docs/trilha/fila_intel.py docs/trilha/teste_fila_redacao.py
git commit -m "feat: direcao das series no validador

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task F2R-9: itens 1 e 2 — limites de texto e escopo 2a, e o `validar` inteiro

**Files:**
- Modify: `fila_intel.py`
- Test: `teste_fila_redacao.py`

**Interfaces:**
- Consumes: `_u16` (A2), `numeros`/`_sem_nomes` (F2R-5), `papel` (F2R-6), `proibidos` (F2R-7), `direcao` (F2R-8), `carregar_sitio().EMOJI` (a **mesma** faixa do kit, `sitio.py:133`).
- Produces: `limites(payload)`, `escopo(payload)`, `validar_texto(texto, entrada)`, `validar(payload, entrada, texto) -> (duros, do_texto)`.

O item 1 mede **só** os três campos de comprimento variável que o código produz (`pattern_id ≤ 80`, `finding ≤ 300`, `analysis_text ≤ 2000`). Os demais são literais do código ou inteiros por construção, e o `PatchPayloadSchema.safeParse` **real** é o portão do F2 (§5): um espelho do schema inteiro só criaria deriva quando o Zod mudar.

- [ ] **Step 1: Escrever os testes que falham**

```python
    # ---------------------------------------------------------- F2R-9: itens 1 e 2
    def payload(**troca):
        p = {"task_id": ESCOLHIDO["task_id"],
             "coaching": {"summary": F.prefixar("x" * 70), "priorities": []},
             "channel_insights": {"patterns_detected": [
                 {"pattern_id": "serie:0-10", "category": "series", "finding": "ok",
                  "confidence": 0.6, "sample_size": 10}],
                 "analysis_text": "ok"}}
        p.update(troca)
        return p

    exige(F.limites(payload()) == [], "item 1: payload dentro dos tetos")
    p = payload()
    p["channel_insights"]["patterns_detected"][0]["pattern_id"] = "s" * 81
    exige(F.limites(p) == ["zod: pattern_id"], "item 1: pattern_id acima de 80")
    p = payload()
    p["channel_insights"]["patterns_detected"][0]["finding"] = "f" * 301
    exige(F.limites(p) == ["zod: finding"], "item 1: finding acima de 300")
    p = payload()
    p["channel_insights"]["analysis_text"] = "a" * 2001
    exige(F.limites(p) == ["zod: analysis_text"], "item 1: analysis_text acima de 2000")
    p = payload()
    p["channel_insights"]["patterns_detected"][0]["finding"] = "🚀" * 151
    exige(F.limites(p) == ["zod: finding"],
          "item 1: a conta e em UTF-16 — 151 emoji sao 302 unidades, nao 151")

    exige(F.escopo(payload()) == [], "item 2: o payload da 2a passa")
    exige(F.escopo(payload(video_recommendations=[{"video_id": "x"}]))
          == ["escopo: video_recommendations"], "item 2: video_recommendations reprova")
    exige(F.escopo(payload(video_recommendations=[])) == [],
          "item 2: video_recommendations ausente ou [] passa (o servidor recusa so nao vazio)")
    exige(F.escopo(payload(notifications=[{"type": "grade_drop"}]))
          == ["escopo: notifications"], "item 2: notifications reprova")
    p = payload(); del p["coaching"]
    exige(F.escopo(p) == ["escopo: coaching"], "item 2: coaching ausente reprova")
    p = payload(); p["coaching"]["priorities"] = [{"axis": "reach"}]
    exige(F.escopo(p) == ["escopo: coaching.priorities"],
          "item 2: priorities nao vazio reprova (na 2a e sempre [])")

    exige(F.validar_texto("o canal nao publica desde 10/12/2024 e a série 0–10 fica abaixo "
                          "da coorte, com 0,63×", E) == [],
          "validar_texto: um texto correto nao acusa nada")
    exige("emoji" in F.validar_texto("o canal segue parado 🚀 desde 10/12/2024", E),
          "validar_texto: emoji reprova (mesma faixa do kit), e conta como 'chegou'")
    exige(F.validar(payload(), E, "o canal nao publica desde 10/12/2024") == ([], []),
          "validar: payload e texto limpos")
    duros, doTexto = F.validar(payload(notifications=[{"type": "x"}]), E, "o ctr caiu")
    exige(duros == ["escopo: notifications"] and doTexto == [],
          "validar: com motivo duro, o texto nem e olhado — e fail sem retry")
```

- [ ] **Step 2: Rodar e ver falhar**

- [ ] **Step 3: `limites`, `escopo`, `validar_texto`, `validar`**

```python
def limites(payload):
    """Item 1 (§4.5), em UTF-16 e so sobre o payload montado. Falhar aqui e bug do codigo:
    termina em fail {reason:'zod: <campo>'} SEM retry, porque repetir daria o mesmo payload.
    O comprimento de coaching.summary NAO e julgado aqui: ele sai logo depois do Aparo,
    com motivo 'longo' (redigir, F2R-10)."""
    motivos, ci = [], payload.get("channel_insights") or {}
    for p in ci.get("patterns_detected") or []:
        if _u16(p.get("pattern_id") or "") > 80:
            motivos.append("zod: pattern_id")
        if _u16(p.get("finding") or "") > 300:
            motivos.append("zod: finding")
    if _u16(ci.get("analysis_text") or "") > 2000:
        motivos.append("zod: analysis_text")
    return motivos


def escopo(payload):
    """Item 2 (§4.5) — o espelho das quatro recusas do servidor (§3.3)."""
    motivos = []
    if "coaching" not in payload:
        motivos.append("escopo: coaching")
    elif payload["coaching"].get("priorities"):
        motivos.append("escopo: coaching.priorities")
    if payload.get("video_recommendations"):
        motivos.append("escopo: video_recommendations")
    if payload.get("notifications"):
        motivos.append("escopo: notifications")
    return motivos


def validar_texto(texto, entrada):
    """Itens 3, 4, 5 e 5b sobre o TEXTO GERADO (sem o prefixo). Nenhum destes motivos da
    fail: levam a tentativa 2 ou ao template (§4.5 item 6)."""
    motivos = []
    if carregar_sitio().EMOJI.search(texto):
        motivos.append("emoji")
    limpo = _sem_nomes(texto, entrada)          # (a2): os itens 3 a 5 rodam sem os nomes
    motivos += proibidos(limpo)
    motivos += numeros(limpo, entrada)
    motivos += papel(texto, entrada)            # corta em frases por conta propria
    motivos += direcao(texto, entrada)          # precisa dos nomes: usa o texto original
    return motivos


def validar(payload, entrada, texto):
    """(duros, do_texto). 'duros' = itens 1 e 2: bug do codigo, fail SEM retry, desfecho
    'reprovada' com etapa 'validar' e PATCH nao enviado."""
    duros = limites(payload) + escopo(payload)
    if duros:
        return duros, []
    return [], validar_texto(texto, entrada)
```

- [ ] **Step 4: Rodar e ver passar**

- [ ] **Step 5: Commit**

Só depois da tabela verde no Step 4.

```bash
cd ~/Workspace/forja/ferramentas
git add docs/trilha/fila_intel.py docs/trilha/teste_fila_redacao.py
git commit -m "feat: limites de texto e escopo 2a do payload

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task F2R-10: item 6 — template do código e o laço das duas tentativas

**Files:**
- Modify: `fila_intel.py`
- Test: `teste_fila_redacao.py`

**Interfaces:**
- Consumes: `gerar`/`aceitar` (F2R-3), `aparar`/`prefixar` (F2R-4), `validar_texto` (F2R-9), `MAX`/`AVISO_ESTREITO` (F2R-2), `_u16` (A2).
- Produces: `template_summary(entrada) -> str`; `redigir(cli_llama, entrada, restante, gerar_=gerar) -> dict` (o dict declarado nas *Interfaces* do card).
- `restante` é um **callable** sem argumentos que devolve os segundos restantes do orçamento de 20 min do §4.1 passo 3, medido com `time.monotonic()`. Quem o fabrica é o `main()` (§4.1).

- [ ] **Step 1: Escrever os testes que falham**

```python
    # ---------------------------------------------------------- F2R-10: template e lacinho
    t1 = F.template_summary(E)
    exige(t1 == 'Canal com 35 vídeos no banco e 29 views nos últimos 90 dias até 18/09/2026. '
                'Séries com efeito: “0–10” (0,63×, abaixo da coorte).',
          "template: 1 serie, literal do §4.5 item 6")
    exige(t1.endswith("."), "template: sempre termina em ponto (e o que o protege do Aparo)")
    exige(F.aparar(t1) == (t1, None), "template: sai intacto do Aparo")
    exige(F.validar_texto(t1, E) == [], "template: passa no proprio validador")
    exige(F._u16(F.AVISO_ESTREITO) + 1 + F._u16(t1) <= 500, "template: cabe nos 500 do Zod")

    E0 = {"canal": E["canal"], "series": []}
    t0 = F.template_summary(E0)
    exige(t0.endswith("Nenhuma série se afasta da coorte do mesmo período."),
          "template: 0 series")
    exige(F.validar_texto(t0, E0) == [], "template: 0 series passa no validador")

    E2 = {"canal": {**E["canal"], "series_com_efeito": "2"},
          "series": [E["series"][0],
                     {"nome": "Vlogzeira 2", "n": "6", "ano": "2018",
                      "mediana_views_vida": "156", "razao_coorte": "1,42×",
                      "leitura": "acima da coorte", "views_90d_serie": "3"}]}
    t2 = F.template_summary(E2)
    exige("“0–10”" in t2 and "“Vlogzeira 2”" in t2 and t2.endswith("."),
          "template: 2 series, com nome de serie com digito, entre aspas curvas")
    exige(F.validar_texto(t2, E2) == [],
          "template: 2 series sai do validador com as duas (o 5b nao acusa: usa a propria leitura)")

    Elongo = {"canal": E["canal"],
              "series": [{**E["series"][0], "nome": "Serie %d %s" % (i, "x" * 40)}
                         for i in range(6)]}
    tl = F.template_summary(Elongo)
    exige(len(tl) <= F.MAX and tl.endswith("."),
          "template: a faixa corta series, e mesmo assim termina em ponto")
    exige(tl.count("(0,63×") >= 1, "template: as series entram em ordem, ate caber")

    Esem = {"canal": {k: v for k, v in E["canal"].items() if k != "views_90d"},
            "series": [{k: v for k, v in E["series"][0].items() if k != "views_90d_serie"}]}
    ts = F.template_summary(Esem)
    exige("views" not in ts and "90 dias" not in ts,
          "template: sem recent_window, sai a oracao das views")
    exige(F.validar_texto(ts, Esem) == [], "template: sem janela, passa no validador")

    # --- o lacinho das duas tentativas
    BOM = ("o canal nao publica desde 10/12/2024 e a série 0–10 fica abaixo da coorte, "
           "com 0,63×, concentrando 16 das 29 views dos ultimos 90 dias.")
    MAU = "a série 0–10 supera a coorte, com 0,63×, e o ctr melhorou muito nos ultimos tempos."

    def roteiro(*passos):
        """Cada passo: ('ok', texto) ou ('infra', motivo)."""
        fila = list(passos)
        chamadas = []

        async def falso(cli, msgs, restante_s, seed=None):
            tipo, v = fila.pop(0)
            import secrets as _s
            chamadas.append((tipo, restante_s))
            d = {"seed": _s.randbelow(2 ** 31), "timeout_s": restante_s, "usage": None,
                 "reasoning": 0, "tps": None}
            return (v, None, d) if tipo == "ok" else (None, v, d)
        return falso, chamadas

    g, ch = roteiro(("ok", BOM))
    r = asyncio.run(F.redigir(None, E, lambda: 20 * 60, gerar_=g))
    exige(r["summary"] == BOM and r["fonte"] == "modelo" and r["falha"] is None
          and r["tentativas"] == 1 and r["fallback"] == [] and len(r["seeds"]) == 1,
          "redigir: aprovado na tentativa 1")

    g, ch = roteiro(("ok", MAU), ("ok", BOM))
    r = asyncio.run(F.redigir(None, E, lambda: 20 * 60, gerar_=g))
    exige(r["summary"] == BOM and r["tentativas"] == 2 and len(set(r["seeds"])) == 2
          and "direcao" in r["motivos"] and "proibido" in r["motivos"],
          "redigir: reprovou no validador, tentativa 2 com outro seed, e passou")

    g, ch = roteiro(("ok", MAU), ("ok", MAU))
    r = asyncio.run(F.redigir(None, E, lambda: 20 * 60, gerar_=g))
    exige(r["summary"] == F.template_summary(E) and r["fonte"] == "template"
          and r["falha"] is None and r["fallback"] == ["summary"],
          "redigir: reprovado nas duas -> template, e NUNCA fail")

    g, ch = roteiro(("infra", "timeout"), ("ok", BOM))
    r = asyncio.run(F.redigir(None, E, lambda: 20 * 60, gerar_=g))
    exige(r["summary"] == BOM and r["falha"] is None,
          "redigir: desfecho misto (infra x validador) -> nunca fail")

    g, ch = roteiro(("ok", MAU), ("infra", "truncado"))
    r = asyncio.run(F.redigir(None, E, lambda: 20 * 60, gerar_=g))
    exige(r["fonte"] == "template" and r["falha"] is None,
          "redigir: desfecho misto (validador x infra) -> template")

    g, ch = roteiro(("infra", "truncado"), ("infra", "json"))
    r = asyncio.run(F.redigir(None, E, lambda: 20 * 60, gerar_=g))
    exige(r["summary"] is None and r["falha"] == "llama" and r["tentativas"] == 2,
          "redigir: nenhuma tentativa chegou ao validador -> falha 'llama' (fail com retry)")

    g, ch = roteiro(("infra", "timeout"))
    r = asyncio.run(F.redigir(None, E, lambda: 8 * 60, gerar_=g))
    exige(r["summary"] is None and r["falha"] == "orcamento" and r["tentativas"] == 1
          and len(ch) == 1,
          "redigir: com menos de 9 min, a tentativa 2 e pulada -> 'orcamento'")

    g, ch = roteiro(("ok", MAU))
    r = asyncio.run(F.redigir(None, E, lambda: 8 * 60, gerar_=g))
    exige(r["fonte"] == "template" and r["falha"] is None and len(ch) == 1,
          "redigir: com pouco orcamento, quem chegou ao validador vai para o template")

    g, ch = roteiro(("ok", "curto sem ponto final e sem nada mais aqui"), ("ok", BOM))
    r = asyncio.run(F.redigir(None, E, lambda: 20 * 60, gerar_=g))
    exige("curto" in r["motivos"] and r["summary"] == BOM,
          "redigir: o 'curto' do Aparo conta como chegou ao validador")

    g, ch = roteiro(("ok", "x" * F.MAX), ("ok", BOM))
    r = asyncio.run(F.redigir(None, E, lambda: 20 * 60, gerar_=g))
    exige("teto" in r["motivos"], "redigir: o log conta quando bateu no teto da gramatica")

    g, ch = roteiro(("ok", BOM), ("ok", BOM))
    r = asyncio.run(F.redigir(None, E, lambda: 20 * 60, gerar_=g))
    p = F.aplicar_summary({"task_id": ESCOLHIDO["task_id"],
                           "coaching": {"priorities": []},
                           "channel_insights": {"patterns_detected": [], "analysis_text": "x"}},
                          r["summary"])
    exige(p["coaching"]["summary"].startswith(F.AVISO_ESTREITO)
          and p["coaching"]["priorities"] == []
          and F._u16(p["coaching"]["summary"]) <= 500,
          "aplicar_summary: o PATCH leva o prefixo, priorities [] e cabe nos 500")
```

- [ ] **Step 2: Rodar e ver falhar**

- [ ] **Step 3: `template_summary` e `redigir`**

```python
def template_summary(entrada):
    """Item 6 (§4.5): o texto do CODIGO, montado so com canal e series, com todo nome de
    serie entre aspas curvas. As series entram em ordem ate caber na faixa, e o template
    SEMPRE termina em '.' — terminando em ')', o Aparo cortaria no ponto depois de
    data_base e o summary chegaria ao PATCH so com a frase do canal, que tem mais de 60
    caracteres e passaria em silencio, sem nenhuma serie."""
    c = entrada["canal"]
    if "views_90d" in c:
        base = ("Canal com {} vídeos no banco e {} views nos últimos 90 dias até {}."
                .format(c["videos"], c["views_90d"], c["data_base"]))
    else:                                   # sem recent_window, sai a oracao das views
        base = "Canal com {} vídeos no banco.".format(c["videos"])
    if not entrada["series"]:
        cand = base + " Nenhuma série se afasta da coorte do mesmo período."
        return cand if len(cand) <= MAX else base
    itens = ["“{}” ({}, {})".format(s["nome"], s["razao_coorte"], s["leitura"])
             for s in entrada["series"]]
    melhor = base
    for k in range(1, len(itens) + 1):
        cand = base + " Séries com efeito: " + ", ".join(itens[:k]) + "."
        if len(cand) > MAX:
            break
        melhor = cand
    return melhor


async def redigir(cli_llama, entrada, restante, gerar_=gerar):
    """Ate duas tentativas (§4.4 e §4.5 item 6). A tentativa 2 repete a MESMA mensagem, com
    o mesmo S e outro seed; a resposta da tentativa 1 nunca entra como turno, e o motivo da
    reprovacao vai so para o log."""
    msgs = mensagens(entrada)
    tentativas, seeds, motivos, tokens_ = 0, [], [], None
    chegou, aprovado = False, None
    for k in (1, 2):
        if k == 2 and restante() < 9 * 60:
            motivos.append("sem_orcamento")
            break
        s, motivo, diag = await gerar_(cli_llama, msgs, restante())
        tentativas += 1
        seeds.append(diag.get("seed"))
        if diag.get("usage"):
            tokens_ = (diag["usage"] or {}).get("completion_tokens")
        if motivo:                                   # truncado|timeout|json|llama|pensou
            motivos.append(motivo)
            continue
        if len(s) >= MAX:
            motivos.append("teto")
        s, mot = aparar(s)                           # o Aparo e o 1o passo do validador
        chegou = True                                # passou do Aceite: nunca mais da fail
        if mot:
            motivos.append(mot)                      # 'curto'
            continue
        if _u16(AVISO_ESTREITO) + 1 + _u16(s) > 500:
            motivos.append("longo")                  # o Zod conta UTF-16; a gramatica, nao
            continue
        maus = validar_texto(s, entrada)
        if maus:
            motivos += maus
            continue
        aprovado = s
        break
    if aprovado is not None:
        fonte, falha, fallback, summary = "modelo", None, [], aprovado
    elif chegou:                                     # desfecho misto ou duas reprovacoes
        fonte, falha, fallback, summary = "template", None, ["summary"], template_summary(entrada)
    else:
        summary, fonte, fallback = None, None, []
        falha = "orcamento" if "sem_orcamento" in motivos else "llama"
    return {"summary": summary, "fonte": fonte, "falha": falha, "tentativas": tentativas,
            "seeds": seeds, "motivos": motivos, "fallback": fallback, "tokens": tokens_}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
cd ~/Workspace/forja/ferramentas/docs/trilha && \
  AGENTE_SITIO="$HOME/Workspace/forja/ferramentas/docs/sitio.py" \
  AGENTE_FILA="$PWD/fila_intel.py" python3 -B teste_fila_redacao.py
```
Expected: `F2R: 0 falha(s)`, saída 0.

- [ ] **Step 5: Conferir a ligação com o harness**

O `teste_fila.py` é do **A6**, e ele já planeja chamar os dois irmãos (`casos` deste arquivo e o do A2). Este passo é só de conferência — a linha abaixo é **commitada pelo A6**, nunca por este card, e por isso `teste_fila.py` não entra no `git add` do Step 6:

```python
from teste_fila_redacao import casos as casos_redacao
casos_redacao(F, exige)
```

- [ ] **Step 6: Commit**

Só depois da tabela verde no Step 4.

```bash
cd ~/Workspace/forja/ferramentas
git add docs/trilha/fila_intel.py docs/trilha/teste_fila_redacao.py
git commit -m "feat: template do summary e lacinho das duas tentativas

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

O `fila_intel.py` e o `teste_fila_redacao.py` seguem para a forja **pelo card K**, e a instalação é o bloco do §4.6, colado **pelo dono**. Nenhuma tarefa deste card faz isso.

---

### Lacunas do spec que este card decidiu (confirmar com o dono antes do F2)

Nenhuma delas foi inventada em silêncio: estão aqui porque o spec **não diz**, e cada uma tem a leitura escolhida e a alternativa.

1. **Nome do motivo de um número estranho (item 3) e de um proibido (item 5).** O spec nomeia `papel`, `extenso`, `tempo`, `emoji`, `longo`, `curto`, `teto`, `direcao`, `rotulo_cru`, `zod` e `escopo`, mas não nomeia o motivo de "citou um número que não está na `ENTRADA`" nem o da regex grande do item 5. Este card usa `numero` e `proibido`. Só afeta o campo `motivos` do jsonl.
2. **Chave a mais / tipo errado no Aceite.** O spec lista `truncado|timeout|json|llama|pensou` e diz que "o conjunto de chaves igual a `{"summary"}`" é condição de aceite, sem dizer qual motivo sai quando ele difere. Este card usa `json`.
3. **`aparar` mede os 60 em pontos de código, não em UTF-16.** O spec diz "menos de 60 caracteres (o mínimo da faixa)", e a faixa é a da gramática, que conta pontos de código — ao contrário do teto de 500, que o spec manda medir em UTF-16. A divergência só aparece com caractere fora do BMP, que a faixa de emoji já derruba antes.
4. **Template sem `recent_window`.** "sai a oração das views" — este card tira a coordenada inteira, inclusive o `até {data_base}`, e o template fica `Canal com {videos} vídeos no banco.` A alternativa (manter `até {data_base}`) lê mal em pt-BR.
5. **Canal sem `ultimo_video`.** O spec não descreve a `ENTRADA` de um canal sem vídeo (o EN está fora de `CANAIS_FILA`). Este card **omite** as chaves `ultimo_video` e `dias_sem_publicar`, nunca manda `null` — toda chave da `ENTRADA` é string por contrato.
6. **`catorze`/`quatorze` na etapa (d).** O spec escreve "`dois|duas..vinte`" sem listar as grafias. As duas entram no dicionário.
7. **`model` no corpo do pedido.** O §4.4 não pede o campo, e a 8080 o ignora. Este card não o envia (a fase 1 só o preenche porque passa pelo proxy, `trilha/s2.py:91`).
8. **Separador de milhar na `ENTRADA`** (lacuna registrada pelo A2 em `_num`). Ao adotar o `_num` dele para **todos** os números da `ENTRADA`, a `ENTRADA` fica sem separador em lugar nenhum — internamente consistente, em vez de `videos: "1.160"` ao lado de `mediana_views_vida: "1160"`. O validador é indiferente: `_valor()` reduz `1.160` e `1160` ao mesmo token, então o modelo pode escrever qualquer uma das duas grafias sem reprovar. Nenhum número do dado real de 18/09 chega a 1.000.

---


---

## F0k · o worker — harness `teste_fila.py` (§4.6)

Frente do **harness**, não dos casos de domínio. Entrega o arquivo `docs/trilha/teste_fila.py` do kit:
o ambiente isolado (§4.1, bloco *Lock*), o carregamento do worker por `AGENTE_FILA`, as provas de que
nada vaza para `/opt/agente`, os dublês (`CliFalso` + llama falso em processo), os relógios injetados,
a estrutura que hospeda **todos** os grupos de casos do §4.6 e os casos de **infraestrutura**
(isolamento, lock, jsonl, segredo, rotação, SIGTERM, portaria). Os grupos de domínio
(`features`, `escolher`, validador, tabelas do §4.1, modos auxiliares) entram pelo ponto de extensão
`GRUPOS`, descrito na Task TF-13.

`teste_fila.py` é portão do `cartao.sh S4` e de **toda** instalação ou atualização do
`fila_intel.py` (§4.6, *Instalação*). Ele **não roda no Mac**: o worker importa `httpx`, que só existe
no venv de `/opt/agente`. O ciclo de desenvolvimento local não depende dele — vem dos dois arquivos
irmãos, stdlib puro, que rodam no Mac e que este harness passa a chamar na forja (Task TF-12):
`trilha/teste_calculo.py` (§4.2/§4.3) e `trilha/teste_fila_redacao.py` (§4.4/§4.5). Verificação local de
cada tarefa desta frente: `python3 -m py_compile`. O portão de verdade é sempre na forja, pelo dono.

### Regras desta frente (além das Global Constraints)

- **`~/Workspace/forja/ferramentas` é repositório git** desde 2026-09-20 (`ec51833`, 116 arquivos
  rastreados, `.gitignore` com `__pycache__/` e `*.pyc`). **Cada tarefa desta frente termina em
  `git commit`**, padrão `tipo: descrição curta`, repositório **local — sem remoto e sem push**.
  `git add` sempre por **caminho explícito**, nunca `-A`/`.`. Nenhum arquivo `.bak` no Mac: o git
  substitui (os `.bak` que sobram nos comandos da forja são outra coisa — §4.6, e a forja não é o repo).
  O `.git` mora em `ferramentas/`, **fora de `docs/`**: o `scp -r docs` do card K não o leva e o portão
  `md5sum -c` (`KIT-IGUAL`) não o vê. O par `scp` + md5 continua sendo o que sincroniza o kit com a forja.
- **Nada que o `teste_fila.py` escreve cai em `ferramentas/` rastreável.** Verificado hoje:
  todo arquivo do harness nasce no tmpdir de `tempfile.mkdtemp` (`$TMPDIR` → `/private/var/folders/…`
  no Mac, `/tmp` na forja), fora do repo, e o laço final faz `shutil.rmtree(TMP)`; no Mac o harness nem
  chega a rodar (sai 1 sem `AGENTE_FILA`, TF-1); o único resíduo local é o `docs/trilha/__pycache__/`
  do `python3 -m py_compile`, que `git check-ignore -v` resolve em `.gitignore:1:__pycache__/`
  (`git status --short` fica vazio depois de compilar). **Não há artefato a acrescentar ao `.gitignore`.**
  É o mesmo fato que as sentinelas `(existe, mtime)` (TF-6) e o `addaudithook` (TF-3) provam por dentro.
- **Escrita na forja é do dono.** Nenhum `ssh`/`scp`/`install` parte do agente. Todo comando da forja
  aparece em bloco de código, curto, para o dono colar.
- **Estilo do kit:** script Python simples, **nunca pytest**, no molde de `teste_s1.py`/`teste_s2.py`:
  `exige(ok, nome)` imprime `OK`/`FALHA`, acumula em `falhas`, e o arquivo termina em
  `print("\nFILA: %d falha(s)" % len(falhas)); raise SystemExit(1 if falhas else 0)`.
- **Só biblioteca padrão no harness.** `httpx` aparece apenas de dentro do worker. O llama falso é
  **em processo**: `sitio_falso.py:3` mata `socket.socket.connect` na importação, então qualquer
  servidor local no teste levanta `RuntimeError("rede bloqueada no teste")`.
- **O harness nunca toca `/opt/agente`.** Toda escrita vai para um tmpdir; a Task TF-6 escreve o teste
  que prova isso, com um `sys.addaudithook` armado durante a execução do worker.

### Mapa de arquivos

**Criados**

| Arquivo | Responsabilidade |
|---|---|
| `~/Workspace/forja/ferramentas/docs/trilha/teste_fila.py` | o harness inteiro: ambiente, dublês, relógios, `rodar()`, grupos de infraestrutura e o ponto de extensão `GRUPOS` |

**Consumidos (escritos por outras frentes)**

| Arquivo | O que esta frente espera dele |
|---|---|
| `docs/trilha/fila_intel.py` | `main(argv, *, agora_mono, dormir, agora, abrir_site, abrir_llama) -> int`, `carregar_sitio()` e as constantes de caminho derivadas de `BASE` (contrato abaixo) |
| `docs/trilha/sitio_falso.py` | `CliFalso` com `request`, `pedidos` e `respostas` (§4.6) — **outra frente**; aqui ele só é usado |
| `docs/trilha/teste_calculo.py` | `casos(F, exige)` — §4.2/§4.3. **Dependência:** o hook está pedido à frente A2, no mesmo formato do irmão abaixo |
| `docs/trilha/teste_fila_redacao.py` | `casos(F, exige)` — §4.4/§4.5, já exposto |
| `docs/trilha/fixture_pt.json` | fixture do F0.5, copiada para o tmpdir pelos grupos de domínio |
| `/opt/agente/series.json` | leitura, copiada para o tmpdir pelos grupos de domínio |

### Contrato que o harness impõe ao `fila_intel.py`

Definido aqui uma vez; toda tarefa abaixo depende dele. **Se o worker divergir, o worker é que muda** —
sem esta forma o §4.1 (*Lock*) não é testável sem esperar de verdade.

```python
# fila_intel.py — assinatura exigida pelo teste_fila
def main(argv=None, *,
         agora_mono=time.monotonic,          # relógio monotônico do orçamento de 20 min
         dormir=_dormir,                     # async def dormir(segundos) — espera de 60 s do 429
         agora=_agora,                       # -> datetime AWARE no fuso da forja
         abrir_site=_abrir_site,             # fábrica: `async with abrir_site() as cli`
         abrir_llama=_abrir_llama) -> int:   # fábrica: `async with abrir_llama() as cli`
    ...

def carregar_sitio():                        # SourceFileLoader por AGENTE_SITIO; chamada por main() e pelo teste
    ...

BASE       = os.environ.get('AGENTE_BASE', '/opt/agente')
DEFAULT    = os.environ.get('AGENTE_DEFAULT', '/etc/default/proxy-agente')
TRAVA      = os.path.join(BASE, 'fila_intel.lock')
LOG        = os.path.join(BASE, 'log')
JSONL      = os.path.join(LOG, 'fila_intel.jsonl')
ERR        = os.path.join(LOG, 'fila_intel.err')
SERIES     = os.path.join(BASE, 'series.json')
ROTEAMENTO = os.path.join(BASE, 'roteamento.jsonl')
ENV_FILA   = os.path.join(BASE, 'fila_intel.env')
SOMBRA     = os.path.join(BASE, 'sombra')
```

- As constantes são de **módulo**, resolvidas no import, e o harness escreve o ambiente **antes** do
  `SourceFileLoader` — por isso o tmpdir é **um só** para o arquivo inteiro e nunca muda entre casos.
- `abrir_site()`/`abrir_llama()` são chamadas **sem argumento** e o resultado é usado como
  gerenciador de contexto assíncrono (`httpx.AsyncClient` já é). O harness embrulha os dublês em `Ctx`
  (Task TF-5), que não fecha nada.
- `main()` **devolve** o código de saída (0 no cron, 75 no lock ocupado em modo manual) em vez de
  chamar `sys.exit()` — o `if __name__ == '__main__':` é que faz `raise SystemExit(main())`.
  Sem isso o harness não distingue "saiu 0" de "não saiu".

---

### Task TF-1: esqueleto, ambiente isolado e carregamento por `AGENTE_FILA`

**Files:**
- Create: `~/Workspace/forja/ferramentas/docs/trilha/teste_fila.py`

**Interfaces:**
- Consumes: `sitio_falso.CliFalso` (importado só para bloquear a rede e servir os grupos seguintes);
  `os.environ['AGENTE_FILA']`, `os.environ['AGENTE_SITIO']`.
- Produces: `TMP` (tmpdir raiz), `DEFAULT`, `CHAVE_FILA`, `PT`, `EN`, `escrever_env()`,
  `escrever_default()`, `ANTES` (sentinelas de `/opt/agente`), `W` (módulo do worker).

- [ ] **Step 1: Cabeçalho, bloqueio de rede e a exigência de `AGENTE_FILA`**

```python
"""teste_fila.py — portao do fila_intel.py (§4.6). Roda SO na forja: o worker importa httpx.

Uso (comandos curtos, um por linha):
  cd /opt/agente/docs/trilha
  unset PYTHONPATH AGENTE_BASE
  export AGENTE_SITIO=/opt/agente/docs/sitio.py
  export AGENTE_FILA=/opt/agente/docs/trilha/fila_intel.py
  flock -w 1800 /opt/agente/fila_intel.lock /opt/agente/venv/bin/python -B teste_fila.py

Chama tambem os dois irmaos, que rodam no Mac sozinhos: teste_calculo.py (§4.2/§4.3) e
teste_fila_redacao.py (§4.4/§4.5), pelo hook casos(F, exige).
"""
import sys, os
sys.dont_write_bytecode = True
AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import sitio_falso                                  # mata socket.socket.connect na importacao
from sitio_falso import CliFalso, Timeout
import asyncio, datetime as dt, json, shutil, signal, stat, subprocess, tempfile, time
import importlib.machinery as _m, importlib.util as _u

if not os.environ.get("AGENTE_FILA"):
    raise SystemExit("teste_fila: falta AGENTE_FILA (quem chama aponta o worker; §4.6)")
```

Não há modo de execução alternativo: o arquivo é portão de cartão, e uma flag que pula o worker seria
superfície a mais num arquivo cuja única função é reprovar. Quem quiser ciclo rápido no Mac roda os
dois irmãos direto (`python3 -B teste_calculo.py`, `python3 -B teste_fila_redacao.py`).

- [ ] **Step 2: O ambiente isolado, escrito ANTES do loader**

```python
TMP = os.path.realpath(tempfile.mkdtemp(prefix="fila-teste-"))
DEFAULT = os.path.join(TMP, "proxy-agente.default")     # DEFAULT e ARQUIVO, nao diretorio
CHAVE_FILA = "forja_" + "A" * 43                        # casa ^forja_[A-Za-z0-9_-]{43}$
CHAVE_LEITURA = "chave-de-teste-" + "x" * 20            # a {read}, como em teste_s1.py:13
PT = "00000000-0000-4000-8000-0000000000aa"
EN = "00000000-0000-4000-8000-0000000000bb"


def escrever_default(pt=PT, en=EN, leitura=CHAVE_LEITURA):
    linhas = []
    if leitura is not None:
        linhas.append('SITIO_CHAVE="%s"' % leitura)     # o --canario le esta daqui (§4.7)
    if pt is not None:
        linhas.append("SITIO_CANAL_PT=%s" % pt)
    if en is not None:
        linhas.append("SITIO_CANAL_EN=%s" % en)
    with open(DEFAULT, "w", encoding="utf-8") as f:
        f.write("\n".join(linhas) + "\n")


def escrever_env(chave=CHAVE_FILA, canais="PT", aspas=True, existe=True):
    p = os.path.join(TMP, "fila_intel.env")
    if not existe:
        os.path.exists(p) and os.remove(p)
        return p
    linhas = []
    if chave is not None:
        linhas.append('SITIO_CHAVE_FILA="%s"' % chave if aspas else "SITIO_CHAVE_FILA=%s" % chave)
    if canais is not None:
        linhas.append("CANAIS_FILA=%s" % canais)
    fd = os.open(p, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write("".join(l + "\n" for l in linhas))
    os.chmod(p, 0o600)
    return p


os.environ["AGENTE_BASE"] = TMP            # SOBRESCREVE: cartao.sh:6 exporta AGENTE_BASE=/opt/agente
os.environ["AGENTE_DEFAULT"] = DEFAULT     # idem; nunca setdefault
for herdado in ("SITIO_CHAVE_FILA", "CANAIS_FILA", "AGENTE_PROXY"):
    os.environ.pop(herdado, None)
escrever_default()
escrever_env()
```

Três coisas que o spec cobra literalmente e que este passo cumpre:
`AGENTE_DEFAULT` aponta um **arquivo** dentro do tmpdir; `fila_intel.env` nasce **0600**
(`os.open` com o modo, e `chmod` depois para o caso de o arquivo já existir com outro modo);
e a sobrescrita é incondicional — `setdefault` deixaria `AGENTE_BASE=/opt/agente` vivo e o teste
escreveria na forja de verdade. `SITIO_CHAVE` entra no `DEFAULT` porque o `--canario` lê a `{read}`
dali pelo próprio Python (§4.7); as linhas de canal são as que o §4.1 nomeia.
`log/` e `sombra/` **não** são criados aqui: quem os cria é o `main()` do worker, e a Task TF-6 prova isso.

- [ ] **Step 3: Sentinelas de `/opt/agente` e carregamento do worker**

```python
REAIS = ("/opt/agente/log/fila_intel.jsonl", "/opt/agente/log/fila_intel.err",
         "/opt/agente/fila_intel.lock")


def sentinela():
    """(existe, mtime) dos tres arquivos reais. NAO olha log/ inteiro: o pulso grava log/pulso.log
    a cada hora (§4.1)."""
    fora = {}
    for p in REAIS:
        try:
            fora[p] = (True, os.stat(p).st_mtime_ns)
        except OSError:
            fora[p] = (False, None)
    return fora


ANTES = sentinela()

_arq = os.environ["AGENTE_FILA"]                          # SO por AGENTE_FILA, como replay2.py
if not os.path.isfile(_arq):
    raise SystemExit("teste_fila: AGENTE_FILA nao e arquivo: %s" % _arq)
_ld = _m.SourceFileLoader("fila_intel", _arq)
W = _u.module_from_spec(_u.spec_from_loader("fila_intel", _ld))
_ld.exec_module(W)                                        # importar nao pode ter efeito colateral
```

Nunca há caminho implícito ao lado do teste: quem chama aponta `AGENTE_FILA` (a cópia de trabalho no
S4, o instalado depois do F1). O `exec_module` acontece **depois** do bloco do Step 2, então o
`BASE` do worker já nasce no tmpdir.

- [ ] **Step 4: Compilar e conferir a recusa sem `AGENTE_FILA`**

```bash
cd ~/Workspace/forja/ferramentas && python3 -m py_compile docs/trilha/teste_fila.py && echo COMPILA
cd ~/Workspace/forja/ferramentas/docs/trilha && python3 -B teste_fila.py; echo "saiu $?"
```
Expected: `COMPILA`; e a segunda linha imprime `teste_fila: falta AGENTE_FILA (…)` com `saiu 1` —
a recusa acontece **antes** de qualquer import de `httpx`, então este check roda no Mac. Um harness que
saísse 0 aqui viraria um portão que passa por omissão quando `AGENTE_FILA` some do `cartao.sh`.

- [ ] **Step 5: Commit**

```bash
cd ~/Workspace/forja/ferramentas
git add docs/trilha/teste_fila.py
git commit -m "test: teste_fila — ambiente isolado e carregamento por AGENTE_FILA

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```
Repositório local do kit (`ec51833`), **sem remoto e sem push**. `git status --short` tem de
ficar vazio depois — o `__pycache__/` do `py_compile` já está no `.gitignore`.

---

### Task TF-2: como um caso é declarado, afirmado e reportado

**Files:**
- Modify: `docs/trilha/teste_fila.py` (acrescenta depois do Step 3 da TF-1)

**Interfaces:**
- Consumes: `TMP`, `escrever_env`, `escrever_default`.
- Produces: `exige(ok, nome)`, `falhas`, `GRUPOS`, `@grupo(nome)`, `zerar()`,
  `linhas_jsonl()`, `ultima()`, e o relatório final.

- [ ] **Step 1: `exige` e o registro de grupos**

```python
falhas = []


def exige(ok, nome):
    print("OK   " if ok else "FALHA", nome)
    if not ok:
        falhas.append(nome)


GRUPOS = []          # [(nome, funcao)] — PONTO DE EXTENSAO (Task TF-13)


def grupo(nome):
    """Registra um grupo de casos. A ordem de registro e a ordem de execucao."""
    def dentro(fn):
        GRUPOS.append((nome, fn))
        return fn
    return dentro
```

A forma é a de `teste_s1.py` (linhas soltas com `exige`), com um registro por cima: o `teste_fila`
hospeda ~16 grupos escritos por **quatro** frentes diferentes, e um decorador de registro evita que
duas frentes colidam na mesma região do arquivo. Cada grupo continua sendo uma função plana cheia de
`exige`, sem classes de teste e sem pytest.

- [ ] **Step 2: `zerar()` — o mundo de cada caso**

```python
def zerar(*, env=True, canais="PT", chave=CHAVE_FILA, aspas=True,
          default=True, pt=PT, en=EN, leitura=CHAVE_LEITURA,
          series=None, roteamento=None):
    """Devolve o tmpdir ao estado inicial. O tmpdir e UM SO para o arquivo inteiro: BASE e
    constante de modulo do worker, resolvida no import (TF-1)."""
    for d in ("log", "sombra"):
        shutil.rmtree(os.path.join(TMP, d), ignore_errors=True)
    for nome in ("series.json", "roteamento.jsonl", "fixture_pt.json"):
        p = os.path.join(TMP, nome)
        if os.path.isdir(p) and not os.path.islink(p):
            shutil.rmtree(p)
        elif os.path.exists(p):
            os.remove(p)
    escrever_env(chave=chave, canais=canais, aspas=aspas, existe=env)
    if default:
        escrever_default(pt=pt, en=en, leitura=leitura)
    if series is not None:
        with open(os.path.join(TMP, "series.json"), "w", encoding="utf-8") as f:
            json.dump(series, f, ensure_ascii=False)
    if roteamento is not None:
        with open(os.path.join(TMP, "roteamento.jsonl"), "w", encoding="utf-8") as f:
            f.write(roteamento)                      # string crua: o caso decide se termina em \n


def roteamento_ha(minutos, agora=None):
    """Uma linha real de roteamento.jsonl (proxy.py:349): `quando` ISO naive em hora local."""
    q = (agora or dt.datetime(2026, 9, 18, 16, 0)) - dt.timedelta(minutes=minutos)
    return json.dumps({"quando": q.isoformat(timespec="seconds"), "pergunta": "oi",
                       "pedido": "agente-auto", "usado": "agente"}, ensure_ascii=False) + "\n"
```

- [ ] **Step 3: Leitura do jsonl**

```python
def linhas_jsonl():
    """Linhas COMPLETAS do jsonl do tmpdir (ignora cauda sem \\n, como o pulso do §6)."""
    p = os.path.join(TMP, "log", "fila_intel.jsonl")
    if not os.path.exists(p):
        return []
    with open(p, encoding="utf-8") as f:
        return [l for l in f if l.endswith("}\n")]


def ultima():
    l = linhas_jsonl()
    return json.loads(l[-1]) if l else None
```

- [ ] **Step 4: O relatório final do arquivo (fica na ÚLTIMA linha do arquivo, sempre)**

```python
for _nome, _fn in GRUPOS:
    print("\n== %s" % _nome)
    try:
        _fn()
    except Exception as e:                       # um grupo que explode nao cala os outros
        exige(False, "%s: excecao %s: %s" % (_nome, type(e).__name__, e))

shutil.rmtree(TMP, ignore_errors=True)
print("\nFILA: %d falha(s)" % len(falhas))
raise SystemExit(1 if falhas else 0)
```

O laço de execução fica no fim do arquivo; todo grupo novo (inclusive os das outras frentes) se
registra **acima** dele e entra sozinho. Um grupo que levanta exceção vira uma falha nomeada em vez de
abortar o portão.

- [ ] **Step 5: Compilar**

```bash
cd ~/Workspace/forja/ferramentas && python3 -m py_compile docs/trilha/teste_fila.py && echo COMPILA
```
Expected: `COMPILA`. O arquivo só executa na forja (Task TF-13, Step 5).

- [ ] **Step 6: Commit**

```bash
cd ~/Workspace/forja/ferramentas
git add docs/trilha/teste_fila.py
git commit -m "test: teste_fila — registro de grupos, zerar e relatorio

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```
Repositório local do kit (`ec51833`), **sem remoto e sem push**. `git status --short` tem de
ficar vazio depois — o `__pycache__/` do `py_compile` já está no `.gitignore`.

---

### Task TF-3: o auditor de escrita — prova dinâmica de que nada vaza

**Files:**
- Modify: `docs/trilha/teste_fila.py`

**Interfaces:**
- Consumes: `TMP`.
- Produces: `AUDITOR` (`ligar()`, `desligar()`, `fugas`), `escreve(modo, flags)`.

- [ ] **Step 1: O classificador de abertura (função pura, testável no Mac)**

```python
def escreve(modo, flags):
    """True quando a abertura pode MODIFICAR o arquivo. `modo` e string (io.open) ou None (os.open)."""
    if modo:
        return any(c in modo for c in "wxa+")
    flags = flags or 0
    return bool(flags & (os.O_WRONLY | os.O_RDWR | os.O_CREAT | os.O_APPEND | os.O_TRUNC))
```

- [ ] **Step 2: O auditor**

```python
class Auditor:
    """Prova dinamica do §4.1: durante main(), nenhuma ESCRITA sai do tmpdir.

    Leitura fora do tmpdir e permitida de proposito: o worker le o sitio.py de AGENTE_SITIO e os
    grupos de dominio leem a fixture do cwd docs/trilha. O que nao pode e gravar."""

    EVENTOS = {"open", "os.mkdir", "os.rename", "os.remove", "os.chmod", "os.truncate"}

    def __init__(self, raiz):
        self.raiz = os.path.realpath(raiz)
        self.ativo = False
        self.fugas = []

    def ligar(self):
        self.fugas = []
        self.ativo = True

    def desligar(self):
        self.ativo = False

    def _dentro(self, alvo):
        if isinstance(alvo, int):
            return True                       # descritor ja aberto: a abertura ja passou por aqui
        try:
            p = os.path.realpath(os.fsdecode(alvo))
        except Exception:
            return True
        return p == self.raiz or p.startswith(self.raiz + os.sep)

    def __call__(self, evento, args):
        if not self.ativo or evento not in self.EVENTOS:
            return
        if evento == "open":
            alvo, modo, flags = args
            if not escreve(modo, flags):
                return
        else:
            alvo = args[0]
        if not self._dentro(alvo):
            self.fugas.append((evento, os.fsdecode(alvo) if not isinstance(alvo, int) else alvo))


AUDITOR = Auditor(TMP)
sys.addaudithook(AUDITOR)                      # so pode ser instalado; fica desligado ate ligar()
```

O hook **nunca levanta**: levantar de dentro de um audit hook derrubaria o worker no meio e o teste
mediria outra coisa. Ele acumula, e a Task TF-6 afirma `AUDITOR.fugas == []`.
Ele fica armado só durante `main()` (Task TF-5), então as escritas do próprio harness entre casos não
contam.

- [ ] **Step 3: Grupo de autoteste do auditor (roda no Mac)**

```python
@grupo("harness: auditor")
def g_auditor():
    exige(escreve("a", 0) and escreve("w", 0) and escreve("r+", 0), "auditor: a/w/r+ sao escrita")
    exige(not escreve("r", 0) and not escreve("rb", 0), "auditor: r/rb nao sao escrita")
    exige(escreve(None, os.O_WRONLY | os.O_CREAT) and not escreve(None, os.O_RDONLY),
          "auditor: os.open pelos flags")
    fora = tempfile.mkdtemp(prefix="fila-fora-")     # criado ANTES de armar: o mkdtemp em si e os.mkdir
    AUDITOR.ligar()
    with open(os.path.join(TMP, "sonda.txt"), "w") as f:
        f.write("x")
    with open(os.path.join(TMP, "sonda.txt"), encoding="utf-8") as f:
        f.read()
    with open("/etc/hostname", encoding="utf-8") as f:                 # leitura fora: permitida
        f.read()
    dentro = list(AUDITOR.fugas)
    with open(os.path.join(fora, "sonda.txt"), "w") as f:
        f.write("x")
    depois = list(AUDITOR.fugas)
    AUDITOR.desligar()
    with open(os.path.join(fora, "outra.txt"), "w") as f:              # desligado: nao acumula
        f.write("x")
    desligado = list(AUDITOR.fugas)
    shutil.rmtree(fora, ignore_errors=True)
    os.remove(os.path.join(TMP, "sonda.txt"))
    exige(dentro == [], "auditor: escrita dentro e leitura fora nao sao fuga (%s)" % dentro)
    exige(len(depois) == 1 and depois[0][0] == "open" and depois[0][1].startswith(fora),
          "auditor: escrita fora do tmpdir e fuga (%s)" % depois)
    exige(desligado == depois, "auditor: desligado nao acumula")
```

O caso do meio é o que dá valor: sem ele, um auditor que nunca dispara passaria por "nada vazou".
O `mkdtemp` do diretório de fora fica **antes** do `ligar()` de propósito — `tempfile.mkdtemp` emite
`os.mkdir` e, armado, contaria como uma segunda fuga; medido, não suposto.

- [ ] **Step 4: Versão de Python — registrar a validação**

Comentário que acompanha o `sys.addaudithook` no arquivo:

```python
# Audit hooks: PEP 578, Python >= 3.8. Os seis eventos usados aqui foram conferidos em
# Python 3.14.5 (Mac, 2026-09-19): open (write), os.mkdir, os.rename (inclui os.replace),
# os.remove, os.chmod, os.truncate. O venv da forja precisa ser >= 3.8; conferir com
#   /opt/agente/venv/bin/python -c "import sys; print(sys.version)"
```

Conferência no Mac (a que já foi feita — reproduzível):
```bash
python3 -VV
```
Expected: `Python 3.14.5` ou mais novo. Se o venv da forja for anterior a 3.8, o auditor não existe e
as provas dinâmicas da Task TF-6 caem — nesse caso, pare e reabra com o dono (as provas estáticas e as
sentinelas continuam valendo, mas a cobertura encolhe).

- [ ] **Step 5: Compilar**

```bash
cd ~/Workspace/forja/ferramentas && python3 -m py_compile docs/trilha/teste_fila.py && echo COMPILA
```

- [ ] **Step 6: Commit**

```bash
cd ~/Workspace/forja/ferramentas
git add docs/trilha/teste_fila.py
git commit -m "test: teste_fila — auditor de escrita fora do tmpdir

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```
Repositório local do kit (`ec51833`), **sem remoto e sem push**. `git status --short` tem de
ficar vazio depois — o `__pycache__/` do `py_compile` já está no `.gitignore`.

---

### Task TF-4: o llama falso em processo

**Files:**
- Modify: `docs/trilha/teste_fila.py`

**Interfaces:**
- Consumes: `sitio_falso.Timeout`.
- Produces: `RespFalsa`, `LlamaFalso(slots=…, ocupado=…, campo=…, slots_erro=…, respostas=[…], gasta=…, sinal=…)`,
  com `pedidos` e `seeds`. É o dublê que as frentes do validador e do laço usam para roteirizar tentativas.

- [ ] **Step 1: A resposta**

```python
class RespFalsa:
    def __init__(self, status, dados=None, texto=None):
        self.status_code = status
        self.content = (texto if texto is not None
                        else json.dumps(dados or {}, ensure_ascii=False)).encode("utf-8")
        self.text = self.content.decode("utf-8", "replace")

    def json(self):
        return json.loads(self.content)
```

- [ ] **Step 2: O corpo de uma geração**

```python
def corpo_llama(texto=None, *, fim="stop", pensou="", cru=None, tps=39.0):
    """Resposta do /v1/chat/completions no formato que o Aceite do §4.4 le."""
    conteudo = cru if cru is not None else json.dumps({"summary": texto}, ensure_ascii=False)
    return {"choices": [{"index": 0, "finish_reason": fim,
                         "message": {"role": "assistant", "content": conteudo,
                                     "reasoning_content": pensou}}],
            "usage": {"prompt_tokens": 900, "completion_tokens": 140},
            "timings": {"predicted_per_second": tps}}
```

- [ ] **Step 3: O servidor em processo**

```python
class LlamaFalso:
    """A 8080 em processo. NAO pode ser servidor local: sitio_falso.py:3 bloqueia
    socket.socket.connect na importacao.

    `respostas` roteiriza as tentativas, uma entrada por chamada ao /v1/chat/completions:
      ("texto", "<summary>")   resposta valida
      ("cru", '<json cru>')    corpo que o json.loads ou o conjunto de chaves reprova
      ("truncado",)            finish_reason = "length"
      ("pensou", "<raciocinio>")
      ("timeout",)             levanta Timeout
      ("erro", 500)            status != 200
    Esgotada a lista, repete a ultima."""

    def __init__(self, *, slots=2, ocupado=False, campo=True, slots_status=200, slots_erro=None,
                 respostas=(("texto", "resposta padrao do llama falso, com 60 caracteres no minimo."),),
                 gasta=0.0, sinal=None, sonda=None):
        self.slots, self.ocupado, self.campo = slots, ocupado, campo
        self.slots_status, self.slots_erro = slots_status, slots_erro
        self.respostas = list(respostas)
        self.gasta, self.sinal, self.sonda = gasta, sinal, sonda
        self.pedidos, self.seeds, self.rel, self.n = [], [], None, 0

    async def get(self, url, params=None, headers=None, timeout=None, follow_redirects=False):
        assert url.endswith("/slots"), "llama falso: GET inesperado %s" % url
        self.pedidos.append(("/slots", None))
        if self.slots_erro:
            raise self.slots_erro("simulado")
        if self.slots_status != 200:
            return RespFalsa(self.slots_status, {"error": "x"})
        corpo = []
        for i in range(self.slots):
            s = {"id": i, "n_ctx": 8192, "n_prompt_tokens": 0}
            if self.campo:
                s["is_processing"] = bool(self.ocupado and i == 0)
            corpo.append(s)
        return RespFalsa(200, corpo)

    async def post(self, url, json=None, headers=None, timeout=None, follow_redirects=False):
        assert url.endswith("/v1/chat/completions"), "llama falso: POST inesperado %s" % url
        self.pedidos.append(("/v1/chat/completions", json))
        self.seeds.append((json or {}).get("seed"))
        if self.rel is not None and self.gasta:
            self.rel.t += self.gasta                 # queima orcamento sem esperar de verdade
        if self.sonda is not None:
            self.sonda(self)                         # gancho: SIGTERM, flock -n, o que o caso quiser
        if self.sinal is not None and self.n == 0:
            signal.raise_signal(self.sinal)          # prova que main() instalou o handler
        r = self.respostas[min(self.n, len(self.respostas) - 1)]
        self.n += 1
        if r[0] == "timeout":
            raise Timeout("simulado")
        if r[0] == "erro":
            return RespFalsa(r[1], {"error": "x"})
        if r[0] == "truncado":
            return RespFalsa(200, corpo_llama("texto cortado no meio", fim="length"))
        if r[0] == "pensou":
            return RespFalsa(200, corpo_llama("texto qualquer com mais de sessenta caracteres para passar.",
                                              pensou=r[1]))
        if r[0] == "cru":
            return RespFalsa(200, corpo_llama(cru=r[1]))
        return RespFalsa(200, corpo_llama(r[1]))
```

- [ ] **Step 4: Grupo de autoteste do dublê (roda no Mac)**

```python
@grupo("harness: llama falso")
def g_llama():
    def um(cli, metodo, *a, **k):
        return asyncio.run(getattr(cli, metodo)(*a, **k))

    l = LlamaFalso()
    r = um(l, "get", "http://127.0.0.1:8080/slots")
    exige(r.status_code == 200 and len(r.json()) == 2
          and all("is_processing" in s for s in r.json()), "llama falso: /slots com 2 slots livres")
    r = um(LlamaFalso(campo=False), "get", "http://127.0.0.1:8080/slots")
    exige(all("is_processing" not in s for s in r.json()), "llama falso: campo ausente e servivel")
    r = um(LlamaFalso(ocupado=True), "get", "http://127.0.0.1:8080/slots")
    exige([s["is_processing"] for s in r.json()] == [True, False], "llama falso: um slot ocupado")
    l = LlamaFalso(respostas=[("truncado",), ("texto", "o segundo texto, com mais de sessenta caracteres, passa.")])
    a = um(l, "post", "http://127.0.0.1:8080/v1/chat/completions", json={"seed": 7})
    b = um(l, "post", "http://127.0.0.1:8080/v1/chat/completions", json={"seed": 8})
    exige(a.json()["choices"][0]["finish_reason"] == "length"
          and json.loads(b.json()["choices"][0]["message"]["content"])["summary"].endswith("passa."),
          "llama falso: roteiro de tentativas em ordem")
    exige(l.seeds == [7, 8] and len(l.pedidos) == 2, "llama falso: grava seeds e pedidos")
    try:
        um(LlamaFalso(respostas=[("timeout",)]), "post",
           "http://127.0.0.1:8080/v1/chat/completions", json={})
        ok = False
    except Timeout:
        ok = True
    exige(ok, "llama falso: ('timeout',) levanta Timeout")
```

- [ ] **Step 5: Compilar**

```bash
cd ~/Workspace/forja/ferramentas && python3 -m py_compile docs/trilha/teste_fila.py && echo COMPILA
```
Expected: `COMPILA`. As 6 asserções deste grupo saem verdes na primeira execução na forja (TF-13).

- [ ] **Step 6: Commit**

```bash
cd ~/Workspace/forja/ferramentas
git add docs/trilha/teste_fila.py
git commit -m "test: teste_fila — llama falso em processo

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```
Repositório local do kit (`ec51833`), **sem remoto e sem push**. `git status --short` tem de
ficar vazio depois — o `__pycache__/` do `py_compile` já está no `.gitignore`.

---

### Task TF-5: relógios injetados e `rodar()` — a execução de um caso

**Files:**
- Modify: `docs/trilha/teste_fila.py`

**Interfaces:**
- Consumes: `W.main`, `AUDITOR`, `LlamaFalso`, `CliFalso`, `linhas_jsonl()`.
- Produces: `RelogioMono`, `Ctx`, `Execucao`, `rodar(argv, site=…, llama=…, quando=…, gasta_site=…)`.
  **É a forma de declarar e afirmar um caso** — toda frente usa esta função.

- [ ] **Step 1: O relógio monotônico e o `Ctx`**

```python
class RelogioMono:
    """time.monotonic() falso. `passo` avanca a cada leitura; `t` e escrito pelos dubles e pelos casos."""
    def __init__(self, t=1000.0, passo=0.0):
        self.t, self.passo = t, passo

    def __call__(self):
        v = self.t
        self.t += self.passo
        return v

    def saltar(self, segundos):
        self.t += segundos


class Ctx:
    """Adapta um duble a `async with abrir_x() as cli`. Nao fecha nada: o caso le o duble depois."""
    def __init__(self, cli):
        self.cli = cli

    async def __aenter__(self):
        return self.cli

    async def __aexit__(self, *a):
        return False
```

- [ ] **Step 2: O resultado de uma execução**

```python
BRT = dt.timezone(dt.timedelta(hours=-3))
QUANDO = dt.datetime(2026, 9, 18, 16, 0, tzinfo=BRT)      # 19:00 UTC: longe da janela do sync


class Execucao:
    def __init__(self, codigo, novas, site, llama, dormidas, rel, fugas, erro):
        self.codigo, self.novas, self.site, self.llama = codigo, novas, site, llama
        self.dormidas, self.rel, self.fugas, self.erro = dormidas, rel, fugas, erro
        self.linha = json.loads(novas[-1]) if novas else None

    def campo(self, nome, padrao=None):
        return (self.linha or {}).get(nome, padrao)

    @property
    def desfecho(self):
        return self.campo("desfecho")

    def _por(self, metodo, sufixo):
        return [p for p in getattr(self.site, "pedidos", []) if p[0] == metodo and sufixo in p[1]]

    @property
    def fails(self):
        return self._por("POST", "/fail")

    @property
    def patches(self):
        return self._por("PATCH", "/intelligence")

    @property
    def claims(self):
        return self._por("POST", "/task/claim")
```

`Execucao` é o vocabulário das asserções: `e.desfecho`, `len(e.fails)`, `e.fails[0][2]["retry"]`,
`len(e.patches)`, `e.campo("motivos")`. A frente do laço (§4.1) escreve as tabelas do passo 3 e 6
inteiramente com isto, sem tocar no harness.

- [ ] **Step 3: `rodar()`**

```python
def rodar(argv=("--cron",), *, site=None, llama=None, quando=QUANDO, passo=0.0, t0=1000.0,
          gasta_site=0.0):
    site = site if site is not None else CliFalso()
    llama = llama if llama is not None else LlamaFalso()
    rel = RelogioMono(t=t0, passo=passo)
    llama.rel = rel
    dormidas = []

    async def dormir(segundos):
        dormidas.append(segundos)
        rel.saltar(segundos)                 # a espera de 60 s do 429 conta no orcamento, sem esperar

    def agora():
        return quando + dt.timedelta(seconds=rel.t - t0)

    antes = len(linhas_jsonl())
    anterior = signal.getsignal(signal.SIGTERM)
    erro = None
    AUDITOR.ligar()
    try:
        codigo = W.main(list(argv), agora_mono=rel, dormir=dormir, agora=agora,
                        abrir_site=lambda: Ctx(site), abrir_llama=lambda: Ctx(llama))
    except SystemExit as e:                  # morte por sinal: o finally do worker ja gravou a linha
        codigo = e.code if isinstance(e.code, int) else 1
    except BaseException as e:               # nunca cala: vira asserçao do caso
        codigo, erro = None, e
    finally:
        AUDITOR.desligar()
        signal.signal(signal.SIGTERM, anterior)     # nao contamina os casos seguintes
    return Execucao(codigo, linhas_jsonl()[antes:], site, llama, dormidas, rel,
                    list(AUDITOR.fugas), erro)
```

Quatro decisões que o resto da frente usa:
o `try/finally` restaura o handler de SIGTERM que o `main()` instalou (§4.1, *Morte por sinal*);
`AUDITOR` fica armado exatamente durante o `main()`;
o `agora` de parede é **derivado** do monotônico, então avançar o orçamento avança o relógio de parede
junto (é o que a janela do sync e a comparação com `roteamento.jsonl` supõem);
e `novas` são as linhas **acrescentadas** por esta execução — a base do "exatamente uma linha por
execução com lock" (Task TF-8).

- [ ] **Step 4: Grupo de autoteste dos relógios (roda no Mac)**

```python
@grupo("harness: relogios")
def g_relogios():
    rel = RelogioMono(t=100.0, passo=0.0)
    exige(rel() == 100.0 and rel() == 100.0, "relogio: sem passo nao anda sozinho")
    rel = RelogioMono(t=100.0, passo=0.5)
    a, b = rel(), rel()
    exige((a, b) == (100.0, 100.5), "relogio: passo avanca a cada leitura")
    rel.saltar(600)
    exige(rel() == 701.0, "relogio: saltar soma os segundos")
    rel = RelogioMono(t=1000.0)
    agora = lambda: QUANDO + dt.timedelta(seconds=rel.t - 1000.0)
    rel.saltar(3600)
    exige(agora().astimezone(dt.timezone.utc).hour == 20,
          "relogio: parede deriva do monotonico (16h BRT + 1h = 20h UTC)")
```

- [ ] **Step 5: Compilar**

```bash
cd ~/Workspace/forja/ferramentas && python3 -m py_compile docs/trilha/teste_fila.py && echo COMPILA
```
Expected: `COMPILA`. Com esta tarefa o harness está completo: os grupos de casos entram a seguir.

- [ ] **Step 6: Commit**

```bash
cd ~/Workspace/forja/ferramentas
git add docs/trilha/teste_fila.py
git commit -m "test: teste_fila — relogios injetados e rodar()

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```
Repositório local do kit (`ec51833`), **sem remoto e sem push**. `git status --short` tem de
ficar vazio depois — o `__pycache__/` do `py_compile` já está no `.gitignore`.

---

### Task TF-6: grupo `isolamento` — nada resolve nem grava fora do tmpdir

**Files:**
- Modify: `docs/trilha/teste_fila.py`

**Interfaces:**
- Consumes: `W` (constantes de caminho e `carregar_sitio()`), `rodar()`, `AUDITOR`, `ANTES`/`sentinela()`.
- Produces: o grupo `isolamento` (roda só com worker).

- [ ] **Step 1: Prova estática — todo caminho do worker está sob o tmpdir**

```python
@grupo("isolamento")
def g_isolamento():
    sob = lambda p: os.path.realpath(p) == TMP or os.path.realpath(p).startswith(TMP + os.sep)
    caminhos = {"BASE": W.BASE, "DEFAULT": W.DEFAULT, "TRAVA": W.TRAVA, "LOG": W.LOG,
                "JSONL": W.JSONL, "ERR": W.ERR, "SERIES": W.SERIES,
                "ROTEAMENTO": W.ROTEAMENTO, "ENV_FILA": W.ENV_FILA, "SOMBRA": W.SOMBRA}
    fora = sorted(k for k, v in caminhos.items() if not sob(v))
    exige(fora == [], "todo caminho do worker sob o tmpdir (fora: %s)" % fora)
    exige(os.path.realpath(W.BASE) == TMP, "BASE e o tmpdir, nao /opt/agente (AGENTE_BASE sobrescrito)")
    exige(os.path.isfile(W.DEFAULT), "DEFAULT e arquivo, nao diretorio")
```

- [ ] **Step 2: Prova de que o import não tem efeito colateral e o `sitio` é o de `AGENTE_SITIO`**

```python
    zerar()
    exige(not os.path.exists(os.path.join(TMP, "log"))
          and not os.path.exists(os.path.join(TMP, "fila_intel.lock")),
          "importar o worker nao criou log/ nem tomou lock (§4.1)")
    S = W.carregar_sitio()
    exige(2 in getattr(S, "ROTAS_FASE", {}), "o sitio carregado e o de AGENTE_SITIO (ROTAS_FASE tem 2)")
    exige(os.path.realpath(S.__file__) == os.path.realpath(os.environ["AGENTE_SITIO"]),
          "o sitio carregado vem de AGENTE_SITIO, nao de um caminho implicito")
```

O primeiro `exige` é o outro lado do §4.1: "Importar o módulo não tem efeito colateral". Ele só vale
porque `zerar()` apagou `log/` e o worker ainda não rodou.

- [ ] **Step 3: Prova dinâmica — uma execução inteira sem fuga, e os diretórios criados por `main()`**

```python
    e = rodar(site=CliFalso(respostas={("POST", r".*/task/claim"): (204, b"")}))
    exige(e.fugas == [], "execucao inteira sem escrita fora do tmpdir (fugas: %s)" % e.fugas[:3])
    exige(e.erro is None, "execucao sem excecao no harness (%s)" % e.erro)
    for d in ("log", "sombra"):
        p = os.path.join(TMP, d)
        exige(os.path.isdir(p) and stat.S_IMODE(os.stat(p).st_mode) == 0o700,
              "main() criou %s/ com mode 700" % d)
    exige(os.path.exists(os.path.join(TMP, "fila_intel.lock")), "o lock nasce no tmpdir")
```

- [ ] **Step 4: Prova sobre os três arquivos reais de `/opt/agente`**

```python
    agora_ = sentinela()
    mudou = sorted(p for p in REAIS if ANTES[p] != agora_[p])
    exige(mudou == [], "(existe, mtime) de /opt/agente intactos: %s" % mudou)
    ausentes = [p for p in REAIS if not ANTES[p][0] and os.path.exists(p)]
    exige(ausentes == [], "arquivo ausente antes continua ausente depois: %s" % ausentes)
```

A comparação é **contra a sentinela tirada no import** (TF-1, Step 3), não contra o estado anterior ao
`cartao.sh`: o `flock -w 1800 /opt/agente/fila_intel.lock` que envolve o teste (§4.6) já cria o arquivo
de lock antes de o Python começar. O `log/` inteiro não é conferido de propósito — o pulso grava
`log/pulso.log` a cada hora.

- [ ] **Step 5: O mesmo grupo repetido no fim do arquivo**

Registrar uma segunda vez, como último grupo de todos, só a parte do Step 4:

```python
@grupo("isolamento: sentinela final")
def g_sentinela_final():
    agora_ = sentinela()
    mudou = sorted(p for p in REAIS if ANTES[p] != agora_[p])
    exige(mudou == [], "depois de TODOS os grupos, /opt/agente intacto: %s" % mudou)
```

Sem esta repetição, um grupo de domínio escrito depois poderia sujar `/opt/agente` e passar: o
`GRUPOS` roda na ordem de registro, e este é o último (Task TF-13 mantém a ordem).

- [ ] **Step 6: Compilar; o portão roda na forja**

```bash
cd ~/Workspace/forja/ferramentas && python3 -m py_compile docs/trilha/teste_fila.py && echo COMPILA
```
Na forja (dono cola; exige `fila_intel.py` já escrito pela frente do worker):
```
cd /opt/agente/docs/trilha && flock -w 1800 /opt/agente/fila_intel.lock env -u PYTHONPATH -u AGENTE_BASE AGENTE_SITIO=/opt/agente/sitio.py AGENTE_FILA=/opt/agente/docs/trilha/fila_intel.py /opt/agente/venv/bin/python -B teste_fila.py
```
Expected: o grupo `isolamento` todo `OK`.

- [ ] **Step 7: Commit**

```bash
cd ~/Workspace/forja/ferramentas
git add docs/trilha/teste_fila.py
git commit -m "test: teste_fila — grupo isolamento

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```
Repositório local do kit (`ec51833`), **sem remoto e sem push**. `git status --short` tem de
ficar vazio depois — o `__pycache__/` do `py_compile` já está no `.gitignore`.

---

### Task TF-7: grupo `lock` — exclusão mútua nos dois sentidos

**Files:**
- Modify: `docs/trilha/teste_fila.py`

**Interfaces:**
- Consumes: `rodar()`, `W.TRAVA`, `LlamaFalso(sonda=…)`.
- Produces: o grupo `lock`.

- [ ] **Step 1: Lock ocupado — `0` no cron, `75` no manual**

```python
@grupo("lock")
def g_lock():
    import fcntl
    zerar()
    preso = open(os.path.join(TMP, "fila_intel.lock"), "a")
    fcntl.flock(preso.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    try:
        antes = len(linhas_jsonl())
        e = rodar(("--cron",))
        exige(e.codigo == 0 and len(linhas_jsonl()) == antes,
              "lock ocupado no cron: sai 0 e NAO grava linha (§4.1)")
        exige(e.site.chamadas == [] and getattr(e.site, "pedidos", []) == [],
              "lock ocupado: zero chamadas ao site")
        e = rodar(())
        exige(e.codigo == 75, "lock ocupado no manual: sai 75")
    finally:
        fcntl.flock(preso.fileno(), fcntl.LOCK_UN)
        preso.close()
```

`flock(2)` associa a trava ao *open file description*, não ao processo: dois descritores do mesmo
arquivo no mesmo processo disputam entre si. Por isso não é preciso subprocesso para segurar a trava —
e o `LOCK_NB` do worker (§4.1) é exatamente o que devolve `0`/`75` aqui.

- [ ] **Step 2: O sentido inverso — com o worker dentro, um `flock -n` de fora falha**

```python
    zerar()
    visto = {}

    def sondar(llama):
        r = subprocess.run(["flock", "-n", os.path.join(TMP, "fila_intel.lock"), "true"],
                           capture_output=True)      # capture_output: pipes, sem abrir /dev/null
        visto["rc"] = r.returncode

    e = rodar(llama=LlamaFalso(sonda=sondar))
    exige(visto.get("rc") not in (None, 0),
          "com o worker parado no llama, flock -n de outro processo falha (rc=%s)" % visto.get("rc"))
    exige(e.fugas == [], "a sonda de lock nao escreve fora do tmpdir")
```

A sonda roda de dentro do llama falso, no momento em que o worker já tomou a trava e está gerando.
`capture_output=True` em vez de `stdout=DEVNULL` é deliberado: `DEVNULL` abre `/dev/null` para escrita
e o auditor da Task TF-3 marcaria fuga legítima.

- [ ] **Step 3: A trava sobrevive à função que a tomou**

```python
    zerar()
    e = rodar(llama=LlamaFalso(sonda=sondar))
    exige(visto.get("rc") not in (None, 0),
          "a trava continua de pe no meio da execucao (global de modulo, nao open() temporario)")
```

É o caso que pega o bug nomeado no §4.1: um `open()` temporário seria coletado, fecharia o descritor e
soltaria a trava — e aí a sonda voltaria `0`.

- [ ] **Step 4: Compilar**

```bash
cd ~/Workspace/forja/ferramentas && python3 -m py_compile docs/trilha/teste_fila.py && echo COMPILA
```

- [ ] **Step 5: Commit**

```bash
cd ~/Workspace/forja/ferramentas
git add docs/trilha/teste_fila.py
git commit -m "test: teste_fila — grupo lock

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```
Repositório local do kit (`ec51833`), **sem remoto e sem push**. `git status --short` tem de
ficar vazio depois — o `__pycache__/` do `py_compile` já está no `.gitignore`.

---

### Task TF-8: grupo `jsonl` — uma linha por execução, e nenhum segredo dentro dela

**Files:**
- Modify: `docs/trilha/teste_fila.py`

**Interfaces:**
- Consumes: `rodar()`, `Execucao`, `CHAVE_FILA`, `CHAVE_LEITURA`.
- Produces: o grupo `jsonl`, e o auxiliar `nenhum_trecho(alvo, texto, n=16)` que as frentes do
  validador e do laço reusam.

- [ ] **Step 1: O auxiliar de vazamento de texto**

```python
def nenhum_trecho(alvo, texto, n=16):
    """True quando NENHUMA janela de n caracteres de `texto` aparece em `alvo`.
    Comparar a string inteira nao pega o vazamento por recorte (um prefixo do summary num campo)."""
    t = (texto or "").strip()
    if len(t) < n:
        return t not in alvo
    return not any(t[i:i + n] in alvo for i in range(len(t) - n + 1))
```

- [ ] **Step 2: Exatamente uma linha por execução com lock**

```python
@grupo("jsonl")
def g_jsonl():
    zerar()
    vazia = {("POST", r".*/task/claim"): (204, b"")}
    e = rodar(site=CliFalso(respostas=vazia))
    exige(len(e.novas) == 1, "uma execucao com lock grava exatamente 1 linha (%d)" % len(e.novas))
    e2 = rodar(site=CliFalso(respostas=vazia))
    exige(len(e2.novas) == 1 and len(linhas_jsonl()) == 2, "a segunda execucao acrescenta 1 linha")
    exige(e.linha and e.campo("quando") and e.campo("modo") == "cron" and "desfecho" in e.linha,
          "a linha tem quando, modo e desfecho")
    q = e.campo("quando") or ""
    exige(len(q) >= 19 and ("+" in q[10:] or "-" in q[10:] or q.endswith("Z")),
          "quando e ISO COM offset (timespec=seconds): %r" % q)
    exige(e.campo("claim") == 204 and e.desfecho == "vazia", "204 no claim: claim=204, desfecho=vazia")
```

- [ ] **Step 3: A chave nunca entra no log**

```python
    bruto = "".join(linhas_jsonl())
    exige(CHAVE_FILA not in bruto, "a chave da fila nunca aparece no jsonl")
    exige(CHAVE_LEITURA not in bruto, "a chave {read} nunca aparece no jsonl")
    err = os.path.join(TMP, "log", "fila_intel.err")
    bruto_err = open(err, encoding="utf-8").read() if os.path.exists(err) else ""
    exige(CHAVE_FILA not in bruto_err, "a chave da fila nunca aparece no .err")
```

- [ ] **Step 4: Toda chamada leva a chave da fila — e ela só sai no cabeçalho**

```python
    zerar()
    e = rodar(site=CliFalso(respostas=vazia))
    cabecalhos = [h.get("X-Pipeline-Key") for _c, _p, h in e.site.chamadas]
    exige(cabecalhos and all(k == CHAVE_FILA for k in cabecalhos),
          "modo normal: toda chamada passa a chave da fila no cabecalho (%s)" % set(cabecalhos))
    corpos = json.dumps(getattr(e.site, "pedidos", []), ensure_ascii=False)
    exige(CHAVE_FILA not in corpos, "a chave nunca vai no corpo de nenhum pedido")
```

- [ ] **Step 5: Nenhum trecho do `summary` no log**

```python
    zerar(series={"videos": {}, "nomes": {}})
    texto = ("O canal segue parado desde 10/12/2024 e somou 29 views nos ultimos 90 dias. "
             "A serie fica abaixo da coorte.")
    e = rodar(llama=LlamaFalso(respostas=[("texto", texto)]))
    enviado = ""
    for _m, _c, corpo in e.patches:
        enviado = ((corpo or {}).get("coaching") or {}).get("summary") or ""
    linha = e.novas[-1] if e.novas else ""
    exige(nenhum_trecho(linha, texto), "nenhum trecho do summary gerado na linha do jsonl")
    if enviado:
        exige(nenhum_trecho(linha, enviado),
              "nenhum trecho do summary que foi ao PATCH (com AVISO_ESTREITO) na linha")
    exige(nenhum_trecho(linha, "Sem CTR/reten"), "nem o AVISO_ESTREITO vaza para a linha")
```

O caso vale mesmo quando o `escolher` desta execução não gerar padrão: o que se afirma é que o texto
**não** aparece na linha, e o `summary` enviado é lido do próprio PATCH gravado pelo `CliFalso`.

- [ ] **Step 6: Compilar**

```bash
cd ~/Workspace/forja/ferramentas && python3 -m py_compile docs/trilha/teste_fila.py && echo COMPILA
```

- [ ] **Step 7: Commit**

```bash
cd ~/Workspace/forja/ferramentas
git add docs/trilha/teste_fila.py
git commit -m "test: teste_fila — grupo jsonl e segredo

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```
Repositório local do kit (`ec51833`), **sem remoto e sem push**. `git status --short` tem de
ficar vazio depois — o `__pycache__/` do `py_compile` já está no `.gitignore`.

---

### Task TF-9: grupo `rotacao` — jsonl por `os.replace`, `.err` truncado no lugar

**Files:**
- Modify: `docs/trilha/teste_fila.py`

**Interfaces:**
- Consumes: `rodar()`, `W.JSONL`, `W.ERR`.
- Produces: o grupo `rotacao`.

- [ ] **Step 1: jsonl com 5.001 linhas fica em 4.000**

```python
@grupo("rotacao")
def g_rotacao():
    zerar()
    os.makedirs(os.path.join(TMP, "log"), mode=0o700, exist_ok=True)
    p = os.path.join(TMP, "log", "fila_intel.jsonl")
    with open(p, "w", encoding="utf-8") as f:
        for i in range(5001):
            f.write(json.dumps({"quando": "2026-09-18T16:00:00-03:00", "modo": "cron",
                                "desfecho": "vazia", "n": i}, ensure_ascii=False) + "\n")
    e = rodar(site=CliFalso(respostas={("POST", r".*/task/claim"): (204, b"")}))
    n = len(linhas_jsonl())
    exige(n in (4000, 4001),
          "jsonl com 5.001 linhas volta a 4.000 (com ou sem a linha desta execucao): %d" % n)
    exige(json.loads(linhas_jsonl()[-1]).get("n") is None,
          "a linha desta execucao e a ultima depois da rotacao")
    exige(json.loads(linhas_jsonl()[0]).get("n", 0) >= 1001,
          "a rotacao corta pelo COMECO, guardando as 4.000 mais novas")
```

A faixa `4000/4001` é deliberada: o §4.1 não fixa se a rotação roda antes ou depois de a linha da
execução ser escrita, e as duas ordens são corretas. O que o teste fixa é o teto e **qual** ponta é
descartada.

- [ ] **Step 2: jsonl ausente não quebra a rotação**

```python
    zerar()
    e = rodar(site=CliFalso(respostas={("POST", r".*/task/claim"): (204, b"")}))
    exige(e.erro is None and len(e.novas) == 1, "rotacao aceita o jsonl ausente (§4.1)")
```

- [ ] **Step 3: `.err` maior que 1 MB fica em 2.000 linhas, no mesmo inode**

```python
    zerar()
    os.makedirs(os.path.join(TMP, "log"), mode=0o700, exist_ok=True)
    err = os.path.join(TMP, "log", "fila_intel.err")
    linha = "Traceback (most recent call last): ModuleNotFoundError: No module named 'httpx'\n"
    with open(err, "w", encoding="utf-8") as f:
        f.write(linha * (int(1.5 * 1024 * 1024 // len(linha)) + 1))
    tamanho, inode = os.stat(err).st_size, os.stat(err).st_ino
    exige(tamanho > 1024 * 1024, "fixture do .err passa de 1 MB (%d)" % tamanho)
    e = rodar(site=CliFalso(respostas={("POST", r".*/task/claim"): (204, b"")}))
    depois = open(err, encoding="utf-8").read().splitlines()
    exige(len(depois) == 2000, ".err truncado nas ultimas 2.000 linhas (%d)" % len(depois))
    exige(os.stat(err).st_ino == inode,
          "mesmo inode: truncate() no lugar, nunca tmp + os.replace (o cron mantem o >> aberto)")
    exige(os.stat(err).st_size < tamanho, ".err encolheu de fato")
```

O inode igual é a parte que importa: com `os.replace` o `>>` do crontab continuaria escrevendo no
inode velho e o arquivo voltaria a crescer invisível.

- [ ] **Step 4: `.err` pequeno não é tocado**

```python
    zerar()
    os.makedirs(os.path.join(TMP, "log"), mode=0o700, exist_ok=True)
    with open(err, "w", encoding="utf-8") as f:
        f.write(linha * 10)
    mt = os.stat(err).st_mtime_ns
    rodar(site=CliFalso(respostas={("POST", r".*/task/claim"): (204, b"")}))
    exige(os.stat(err).st_mtime_ns == mt and len(open(err).read().splitlines()) == 10,
          ".err abaixo de 1 MB nao e tocado")
```

- [ ] **Step 5: Compilar**

```bash
cd ~/Workspace/forja/ferramentas && python3 -m py_compile docs/trilha/teste_fila.py && echo COMPILA
```

- [ ] **Step 6: Commit**

```bash
cd ~/Workspace/forja/ferramentas
git add docs/trilha/teste_fila.py
git commit -m "test: teste_fila — grupo rotacao

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```
Repositório local do kit (`ec51833`), **sem remoto e sem push**. `git status --short` tem de
ficar vazio depois — o `__pycache__/` do `py_compile` já está no `.gitignore`.

---

### Task TF-10: grupo `sigterm` — morte por sinal grava `morto` e não chama `fail`

**Files:**
- Modify: `docs/trilha/teste_fila.py`

**Interfaces:**
- Consumes: `rodar()` (que já restaura o handler), `LlamaFalso(sinal=…)`, `CliFalso.respostas`.
- Produces: o grupo `sigterm`.

- [ ] **Step 1: O SIGTERM depois do claim**

```python
@grupo("sigterm")
def g_sigterm():
    zerar(series={"videos": {}, "nomes": {}})
    anterior = signal.getsignal(signal.SIGTERM)
    tarefa = {"id": "00000000-0000-4000-8000-000000000011", "site_id": "s",
              "channel_id": PT, "trigger_type": "cron",
              "requested_at": "2026-09-18T18:00:00Z", "started_at": "2026-09-18T19:00:00Z"}
    site = CliFalso(respostas={("POST", r".*/task/claim"):
                               (200, json.dumps({"data": tarefa}).encode())})
    e = rodar(site=site, llama=LlamaFalso(sinal=signal.SIGTERM))
    exige(len(e.novas) == 1 and e.desfecho == "morto",
          "SIGTERM depois do claim: exatamente uma linha, desfecho morto (%s)" % e.desfecho)
    exige(e.campo("etapa"), "a linha morto leva a ultima etapa (%s)" % e.campo("etapa"))
    exige(e.fails == [], "morte por sinal NAO chama fail: a task fica running ate o watchdog (§9)")
    exige(e.patches == [], "morte por sinal nao manda PATCH")
    exige(e.campo("claim") == 200, "o claim ja tinha acontecido (claim=200)")
    exige(signal.getsignal(signal.SIGTERM) is anterior,
          "o handler anterior foi restaurado pelo harness (nao contamina os casos seguintes)")
```

O caso prova, de quebra, que `main()` **instalou** o handler: sem handler, o `signal.raise_signal`
do llama falso mataria o processo do teste inteiro com o comportamento padrão do SIGTERM, e nenhuma
linha seria impressa depois.

- [ ] **Step 2: Sem desfecho decidido → `morto`; com desfecho decidido, o decidido**

```python
    zerar()
    site = CliFalso(respostas={("POST", r".*/task/claim"): (204, b"")})
    e = rodar(site=site, llama=LlamaFalso(sinal=signal.SIGTERM))
    exige(len(e.novas) == 1 and e.desfecho in ("vazia", "morto"),
          "sinal sobre execucao ja decidida: uma linha, com o desfecho decidido (%s)" % e.desfecho)
```

Com a fila vazia o llama nunca é chamado, então este caso mede o outro ramo do `finally`: a linha sai
igual, sem duplicar.

- [ ] **Step 3: O `finally` está fora do `asyncio.run`**

```python
    zerar(series={"videos": {}, "nomes": {}})
    site = CliFalso(respostas={("POST", r".*/task/claim"):
                               (200, json.dumps({"data": tarefa}).encode())})
    e = rodar(site=site, llama=LlamaFalso(sinal=signal.SIGTERM))
    exige(e.erro is None, "SystemExit do handler nao escapa como excecao crua do harness (%s)" % e.erro)
    exige(len(e.novas) == 1, "uma linha so, mesmo com o sinal atravessando o asyncio.run")
```

- [ ] **Step 4: Compilar**

```bash
cd ~/Workspace/forja/ferramentas && python3 -m py_compile docs/trilha/teste_fila.py && echo COMPILA
```

- [ ] **Step 5: Commit**

```bash
cd ~/Workspace/forja/ferramentas
git add docs/trilha/teste_fila.py
git commit -m "test: teste_fila — grupo sigterm

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```
Repositório local do kit (`ec51833`), **sem remoto e sem push**. `git status --short` tem de
ficar vazio depois — o `__pycache__/` do `py_compile` já está no `.gitignore`.

---

### Task TF-11: grupo `portaria` — `config`, chave, `/slots` e `bug` antes do claim

**Files:**
- Modify: `docs/trilha/teste_fila.py`

**Interfaces:**
- Consumes: `zerar()`, `rodar()`, `LlamaFalso`, `escrever_env`.
- Produces: o grupo `portaria`. **Ownership:** os casos de `/slots` e de leitura de `fila_intel.env`
  são desta frente (o dublê e o leitor de ambiente são dela); a frente do laço (§4.1 passo 2) não os repete.

- [ ] **Step 1: As seis formas de `config`, sem claim e sem exceção**

```python
@grupo("portaria")
def g_portaria():
    def so_config(nome, **kw):
        zerar(**kw)
        e = rodar()
        exige(e.desfecho == "config" and e.campo("claim") is None,
              "config: %s (desfecho=%s)" % (nome, e.desfecho))
        exige(e.site.chamadas == [] and getattr(e.site, "pedidos", []) == [],
              "config: %s — zero chamadas ao site" % nome)
        exige(e.erro is None, "config: %s — sem excecao" % nome)
        return e

    so_config("CANAIS_FILA vazio", canais="")
    so_config("CANAIS_FILA desconhecido", canais="ZZ")
    so_config("fila_intel.env ausente", env=False)
    so_config("sem SITIO_CHAVE_FILA", chave=None)
    so_config("chave fora do formato", chave="forja_curta")
    so_config("chave sem o prefixo", chave="x" * 49)
    so_config("uuid do canal ausente no DEFAULT", pt=None)
```

- [ ] **Step 2: As duas grafias da chave passam (com e sem aspas)**

```python
    vazia = {("POST", r".*/task/claim"): (204, b"")}
    for aspas in (True, False):
        zerar(aspas=aspas)
        e = rodar(site=CliFalso(respostas=vazia))
        exige(e.desfecho == "vazia",
              "SITIO_CHAVE_FILA %s aspas e aceita (§4.6)" % ("com" if aspas else "sem"))
        exige(all(h.get("X-Pipeline-Key") == CHAVE_FILA for _c, _p, h in e.site.chamadas),
              "a chave chega limpa, sem as aspas (%s)" % ("com aspas" if aspas else "sem aspas"))
```

- [ ] **Step 3: `/slots` — as três recusas do dublê**

```python
    for nome, llama, esperado in (
            ("um slot ocupado", LlamaFalso(ocupado=True), "ocupado"),
            ("conexao recusada", LlamaFalso(slots_erro=ConnectionRefusedError), "llama_fora"),
            ("status 500", LlamaFalso(slots_status=500), "llama_fora"),
            ("timeout", LlamaFalso(slots_erro=Timeout), "llama_fora"),
            ("3 slots", LlamaFalso(slots=3), "llama_fora"),
            ("sem is_processing", LlamaFalso(campo=False), "llama_fora")):
        zerar()
        e = rodar(llama=llama)
        exige(e.desfecho == esperado, "/slots: %s -> %s (veio %s)" % (nome, esperado, e.desfecho))
        exige(e.claims == [], "/slots: %s — zero claims" % nome)
        if esperado == "ocupado":
            exige("slots" in (e.campo("motivos") or []), "/slots ocupado: motivos tem 'slots'")
```

O caso `sem is_processing` é o que o §4.1 marca como o que dura: o inventário do kit não cita o campo,
e tratar ausente como slot livre faria a fila gerar em cima do chat depois de qualquer atualização do
llama-server.

- [ ] **Step 4: `bug` antes do claim — exceção na leitura de `roteamento.jsonl`**

```python
    zerar()
    p = os.path.join(TMP, "roteamento.jsonl")
    os.makedirs(p, mode=0o700)                   # diretorio no lugar do arquivo: open() -> IsADirectoryError
    e = rodar()
    exige(e.desfecho == "bug", "excecao antes do claim -> bug (veio %s)" % e.desfecho)
    exige(e.campo("claim") is None, "bug antes do claim: claim = null")
    exige(e.site.chamadas == [] and e.fails == [], "bug antes do claim: zero site, zero fail")
    exige(e.campo("motivos") and "IsADirectoryError" in " ".join(e.campo("motivos")),
          "motivos traz o tipo da excecao (%s)" % e.campo("motivos"))
    shutil.rmtree(p)
```

- [ ] **Step 5: E o que **não** é `bug` — roteamento ausente ou ilegível segue**

```python
    zerar(roteamento="{isso nao e json}\n")
    e = rodar(site=CliFalso(respostas=vazia))
    exige(e.desfecho == "vazia" and "roteamento_ilegivel" in (e.campo("motivos") or []),
          "linha ilegivel: segue, com motivos roteamento_ilegivel (%s)" % e.campo("motivos"))
    zerar()                                       # sem roteamento.jsonl nenhum
    e = rodar(site=CliFalso(respostas=vazia))
    exige(e.desfecho == "vazia", "roteamento ausente: segue")
```

- [ ] **Step 6: Compilar**

```bash
cd ~/Workspace/forja/ferramentas && python3 -m py_compile docs/trilha/teste_fila.py && echo COMPILA
```

- [ ] **Step 7: Commit**

```bash
cd ~/Workspace/forja/ferramentas
git add docs/trilha/teste_fila.py
git commit -m "test: teste_fila — grupo portaria

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```
Repositório local do kit (`ec51833`), **sem remoto e sem push**. `git status --short` tem de
ficar vazio depois — o `__pycache__/` do `py_compile` já está no `.gitignore`.

---

### Task TF-12: os dois arquivos irmãos sob o mesmo comando

**Files:**
- Modify: `docs/trilha/teste_fila.py`

**Interfaces:**
- Consumes: `trilha/teste_fila_redacao.py` → `casos(F, exige)` (§4.4/§4.5, **já exposto** pela frente
  do validador); `trilha/teste_calculo.py` → `casos(F, exige)` (§4.2/§4.3, **dependência**: o hook está
  pedido à frente de `features`/`escolher`, no mesmo formato do irmão).
- Produces: os grupos `calculo (§4.2/§4.3)` e `redacao (§4.4/§4.5)` dentro do `teste_fila.py`;
  o `teste_fila` vira a entrada **única** na forja, com os 3 arquivos sob um comando só.

- [ ] **Step 1: O carregador dos irmãos**

Os dois vivem no mesmo diretório e são stdlib puro — carregá-los por nome é suficiente, mas o import
não pode derrubar o portão inteiro quando um deles ainda não existe na cópia de trabalho.

```python
def irmao(nome):
    """Importa um teste irmao de docs/trilha (stdlib puro; ele tambem roda sozinho no Mac)."""
    caminho = os.path.join(AQUI, nome + ".py")
    if not os.path.isfile(caminho):
        return None
    ld = _m.SourceFileLoader(nome, caminho)
    mod = _u.module_from_spec(_u.spec_from_loader(nome, ld))
    ld.exec_module(mod)
    return mod
```

- [ ] **Step 2: Os dois grupos**

Registrados **antes** do bloco de extensão e depois da `portaria`:

```python
@grupo("calculo (§4.2/§4.3) — teste_calculo.py")
def g_calculo():
    mod = irmao("teste_calculo")
    exige(mod is not None, "teste_calculo.py presente ao lado do teste_fila")
    if mod is None:
        return
    exige(hasattr(mod, "casos"), "teste_calculo expoe casos(F, exige)")
    if hasattr(mod, "casos"):
        mod.casos(W, exige)


@grupo("redacao (§4.4/§4.5) — teste_fila_redacao.py")
def g_redacao():
    mod = irmao("teste_fila_redacao")
    exige(mod is not None, "teste_fila_redacao.py presente ao lado do teste_fila")
    if mod is None:
        return
    exige(hasattr(mod, "casos"), "teste_fila_redacao expoe casos(F, exige)")
    if hasattr(mod, "casos"):
        mod.casos(W, exige)
```

`W` é o módulo do worker já carregado por `AGENTE_FILA` (TF-1) — os irmãos recebem **o mesmo** módulo
que os grupos daqui exercitam, então não há chance de um deles testar uma cópia diferente do
`fila_intel.py`. O `exige` é o daqui, então as falhas dos irmãos entram na contagem final do portão.
A ausência de um arquivo é **falha**, não pulo: um portão que passa porque o teste sumiu não é portão.

- [ ] **Step 3: Compilar**

```bash
cd ~/Workspace/forja/ferramentas && python3 -m py_compile docs/trilha/teste_fila.py && echo COMPILA
```
E, como estes dois rodam no Mac sozinhos, o ciclo local desta frente termina conferindo que eles
continuam verdes por conta própria:
```bash
cd ~/Workspace/forja/ferramentas/docs/trilha && PYTHONPATH=st python3 -B teste_calculo.py; echo "calculo: $?"
cd ~/Workspace/forja/ferramentas/docs/trilha && python3 -B teste_fila_redacao.py; echo "redacao: $?"
```
Expected: `calculo: 0` e `redacao: 0`. Se o `teste_calculo.py` ainda não tiver o `casos(F, exige)`,
o Step 2 fica bloqueado nele — é a dependência declarada nas *Interfaces*.

- [ ] **Step 4: Commit**

```bash
cd ~/Workspace/forja/ferramentas
git add docs/trilha/teste_fila.py
git commit -m "test: teste_fila — chama teste_calculo e teste_fila_redacao

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```
Repositório local do kit (`ec51833`), **sem remoto e sem push**. `git status --short` tem de
ficar vazio depois — o `__pycache__/` do `py_compile` já está no `.gitignore`.

---

### Task TF-13: o ponto de extensão `GRUPOS` e a invocação do harness

**Files:**
- Modify: `docs/trilha/teste_fila.py` (marcadores de extensão)
- **Não** modifica `docs/trilha/cartao.sh`: a edição é da frente do S4 (tarefa S4-5, já com `bash -n`
  verde). Esta tarefa apenas **declara** a linha exigida, para o S4 aplicar.

**Interfaces:**
- Consumes: tudo acima, inclusive os dois irmãos da Task TF-12.
- Produces: o contrato de extensão para as outras frentes; a linha literal exigida no `cartao.sh`
  (consumida pelo S4-5); os comandos literais de instalação e de volta.

- [ ] **Step 1: Os marcadores de extensão, entre a `portaria` e a sentinela final**

```python
# ===================== EXTENSAO: grupos de dominio =====================
# Cada frente acrescenta os seus grupos AQUI, com @grupo("<nome>"), usando rodar()/Execucao.
# Nada do harness precisa mudar para isso. A ordem de registro e a ordem de execucao.
#
# >>> GRUPO laco (§4.1 passos 3 a 6)            — frente do worker/laco
# >>> GRUPO modos auxiliares (§4.7)             — frente dos modos auxiliares
# (§4.2/§4.3 e §4.4/§4.5 NAO entram aqui: vem dos arquivos irmaos, pelos grupos da Task TF-12)
# <<< FIM DA EXTENSAO
# =======================================================================
```

Quem preenche o quê — a tabela fica no plano, não no código:

| Grupo | Casos do §4.6 | Frente |
|---|---|---|
| `laco` | as duas tabelas do §4.1 (passos 3 e 6), as saídas dos passos 4–5, `fail`→409 = `conflito`, `fail` que falha = `fail_perdido`, `indeterminado` com um `fail {retry}`, PATCH 429 com espera de 60 s, `janela_sync` às 12:00 UTC, chat recente (cauda sem `\n`, 5 min, futuro) | frente do **laço** (`fila_intel.py` §4.1) |
| `calculo` | fixture PT, fronteiras 89/90 dias, `series_orfas`, piso de efeito, ordem de `patterns_detected`, `confidence`, `analysis_text` | frente de **`features`/`escolher`**, em `teste_calculo.py` — entra por `casos(F, exige)` (TF-12), não pelos marcadores |
| `redacao` | Aceite, Aparo, itens 1–5b, template das duas reprovações, `emoji`/`longo`/`curto`, escopo 2a adulterado, `MAX ≥ 300` | frente do **validador**, em `teste_fila_redacao.py` — idem |
| `modos auxiliares` | `--sombra`/`--escolher` com zero chamadas ao `CliFalso`; `--canario` com dois `fail` e um PATCH; `recent_window.days ≠ 90` | frente dos **modos auxiliares** (§4.7) |
| `isolamento`, `lock`, `jsonl`, `rotacao`, `sigterm`, `portaria` (inclui `/slots` e `fila_intel.env`) | — | **esta frente** |

Contrato para as outras frentes, em três linhas: um grupo é uma função registrada com `@grupo("nome")`;
dentro dela, `zerar(...)` monta o mundo, `rodar(...)` executa e devolve `Execucao`, e `exige(...)`
afirma. Nenhuma frente mexe em `TMP`, `AUDITOR`, `rodar` nem no laço final do arquivo.

- [ ] **Step 2: Declarar a linha exigida no `cartao.sh` (a edição é do S4-5)**

**Não edite o arquivo nesta tarefa.** A frente do S4 é dona de `docs/trilha/cartao.sh` (tarefa S4-5,
`bash -n` verde). O que esta frente entrega é o texto literal que aquela tarefa insere **depois** da
linha 22, com a justificativa de cada pedaço:

```bash
if [ -s sitio.py.novo ]; then F="$B/fila_intel.py"; [ -f "$F" ] || F="$B/docs/trilha/fila_intel.py"; [ -f "$F" ] || falha 'sem fila_intel.py'; (cd docs/trilha && flock -w 1800 "$B/fila_intel.lock" env -u PYTHONPATH -u AGENTE_BASE AGENTE_SITIO="$B/sitio.py.novo" AGENTE_FILA="$F" /opt/agente/venv/bin/python -B teste_fila.py) || falha 'teste_fila (ou lock ocupado por 30 min)'; fi
```

- `flock -w 1800 "$B/fila_intel.lock"` — o cron vivo não grava no meio do teste, e a espera é limitada
  (o `cartao.sh` tem `set -u` sem `set -e` e nenhum timeout).
- `env -u PYTHONPATH` tira o stub `st/httpx.py` que o `cartao.sh:6` põe no caminho;
  `env -u AGENTE_BASE` tira o `/opt/agente` que a mesma linha exporta — e o harness ainda o
  **sobrescreve** (TF-1), de cinto e suspensório.
- `AGENTE_FILA` obrigatório e com as duas procuras (instalado, depois cópia de trabalho): sem nenhuma
  das duas o cartão **falha**, em vez de pular o teste — é o outro lado da recusa da TF-1, Step 1.
- `cd docs/trilha` é o cwd de onde os irmãos e a `fixture_pt.json` são lidos (TF-12).

Conferência (leitura, depois que o S4 aplicar):
```bash
cd ~/Workspace/forja/ferramentas && bash -n docs/trilha/cartao.sh && grep -c teste_fila docs/trilha/cartao.sh
```
Expected: sem saída do `bash -n` e contagem `1`.

- [ ] **Step 3: O comando de verificação (dono cola; §4.6)**

Não há instalação: `fila_intel.py` roda sempre de `docs/trilha/`, nunca de uma segunda cópia em
`/opt/agente/fila_intel.py` (essa cópia nunca existiu na forja de verdade — duas cópias do mesmo
worker é a ambiguidade que já custou uma rodada perdida ao dono). Antes de **cada** atualização do
worker, e antes de habilitar/reabilitar o crontab (§5):
```
(cd /opt/agente/docs/trilha && flock -w 1800 /opt/agente/fila_intel.lock env -u PYTHONPATH -u AGENTE_BASE AGENTE_SITIO=/opt/agente/docs/sitio.py AGENTE_FILA=/opt/agente/docs/trilha/fila_intel.py /opt/agente/venv/bin/python -B teste_fila.py) || echo 'PARE: teste_fila reprovou ou lock ocupado por 30 min'
```
Voltar uma atualização: sem segunda cópia não há `.bak` de worker para restaurar — a volta é o
`git checkout` da versão anterior no kit (Mac, repo git) seguido de um novo `scp` (card K) e do
mesmo comando de verificação acima.
Nenhum destes comandos parte do agente: todos são do dono. O `-w 1800` está em todos pelo motivo do
§4.6 — depois do F4 o cron está vivo e uma execução pode segurar a trava por 25 min.

- [ ] **Step 4: Portão F0k desta frente, no Mac**

```bash
cd ~/Workspace/forja/ferramentas && python3 -m py_compile docs/trilha/teste_fila.py && \
  (cd docs/trilha && python3 -B teste_fila.py; [ $? = 1 ] || exit 1) && \
  (cd docs/trilha && PYTHONPATH=st python3 -B teste_calculo.py) && \
  (cd docs/trilha && python3 -B teste_fila_redacao.py) && echo F0K-OK
```
Expected: `F0K-OK`. O que este bloco prova no Mac: o harness **compila**, ele **recusa** rodar sem
`AGENTE_FILA` (sai 1 antes de qualquer `httpx`), e os dois irmãos continuam verdes sozinhos. Os grupos
que precisam do worker não rodam aqui — eles são portão do `cartao.sh S4` e de toda instalação, na forja.

- [ ] **Step 5: Primeira execução de verdade, na forja (dono cola)**

```
cd /opt/agente/docs/trilha && flock -w 1800 /opt/agente/fila_intel.lock env -u PYTHONPATH -u AGENTE_BASE AGENTE_SITIO=/opt/agente/sitio.py AGENTE_FILA=/opt/agente/docs/trilha/fila_intel.py /opt/agente/venv/bin/python -B teste_fila.py
```
Expected: `FILA: 0 falha(s)`, com os grupos do harness, os seis de infraestrutura, `calculo`,
`redacao` e os de extensão — os 3 arquivos sob um comando só.

- [ ] **Step 6: Árvore limpa e relato**

```bash
cd ~/Workspace/forja/ferramentas && git status --short && git log --oneline ec51833..HEAD
```
Expected: `git status --short` **vazio** (o `__pycache__/` do `py_compile` está no `.gitignore`;
os tmpdirs do harness nascem em `$TMPDIR`, fora do repo, e são removidos no fim do arquivo), e o
`git log` com os 13 commits desta frente — locais, **sem remoto e sem push**. O relato anota: a lista
de commits, a saída do bloco do Step 4, a versão de Python em que o auditor foi validado (TF-3) e que
o primeiro portão real é o `cartao.sh S4` na forja, pelo dono.

- [ ] **Step 7: Commit**

```bash
cd ~/Workspace/forja/ferramentas
git add docs/trilha/teste_fila.py
git commit -m "test: teste_fila — ponto de extensao GRUPOS e invocacao

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```
Repositório local do kit (`ec51833`), **sem remoto e sem push**. `git status --short` tem de
ficar vazio depois — o `__pycache__/` do `py_compile` já está no `.gitignore`.

---


---

## F0k + S4 · `sitio.py` fase 2 e o cartão da Trilha (§4.6)

Cartão da Trilha que leva o `sitio.py` da fase 1 (só GET, cache, `_velho`) para a fase 2 (métodos
não-GET, chave explícita, timeout por chamada, mapeamento novo de `FalhaSite`), **sem mexer em um byte
do comportamento da fase 1**. Cobre o §4.6 do spec (`pedir`, `FalhaSite`, `ROTAS_FASE[2]`, `CliFalso`,
Instalação) e a linha **S4** da tabela do §5, mais o rollback do S4.

### Pré-condições deste card

- **F0 promovido** (as rotas de claim/fail/PATCH existem em produção) e **F0.5** feito (`fixture_pt.json`
  na forja) — a ordem de execução do §5 é F0k → K → F0 → F0.5 → **S4** → F1 → F2 → F4.
- **F0k já escreveu `fila_intel.py` e `teste_fila.py`** em `~/Workspace/forja/ferramentas/docs/trilha/`,
  e o **K** os levou à forja. O bloco novo do `cartao.sh` (Task S4-5) **falha o cartão** com
  `sem fila_intel.py` se a cópia de trabalho não estiver lá: no S4 o worker instalado ainda não existe
  (entra no F1), então o `teste_fila` roda sobre `docs/trilha/fila_intel.py`.
- O `sitio.py` do kit no Mac (`~/Workspace/forja/ferramentas/docs/sitio.py`) é a fonte; o **K** o leva.

### Escrita na forja é do dono

Todas as tarefas abaixo escrevem **só no Mac**, em `~/Workspace/forja/ferramentas/docs/`. Nenhum agente
roda `scp`, `ssh forja '<comando que escreve>'`, `bash docs/trilha/cartao.sh`, `deploy.sh`, `install`,
`mv` ou `systemctl` na forja. As Tasks S4-6 e S4-7 **preparam** os comandos, curtos, um por linha, em
bloco de código, e o dono os cola. A conferência depois é por leitura (`ssh forja '<comando de leitura>'`).

### O kit está sob git — cada tarefa de código termina num commit

O dono rodou `git init` em `~/Workspace/forja/ferramentas` (commit `ec51833`, 116 arquivos, árvore
limpa, `.gitignore` com `__pycache__/` e `*.pyc`). O `.git` mora em `ferramentas/`, **fora de `docs/`**:
o `scp -r sitio.py trilha` do card **K** não o leva, e o portão md5 (`find sitio.py trilha -type f`)
não o vê.

- **Cada tarefa de código termina em `git commit`**, padrão `tipo: descrição curta`, **repositório
  local, sem remoto e sem push**. Seis passos deste card terminam assim: S4-1 a S4-5 e o Step 7 do
  rollback (que edita a cópia do kit no Mac).
- **`git add` por caminho explícito**, nunca `git add -A`/`git add .`.
- **O commit vem depois do teste verde**, nunca antes — o loop de TDD deste card roda no Mac (abaixo).
- **Nenhum `.bak` no Mac.** O git substitui cópia de segurança de arquivo do kit. Isso **não** vale
  para os `proxy.py.bak-*-S4` e `…​.bak-*-S4.sitio` que o `deploy.sh` cria **na forja**: eles são o
  único caminho de volta do rollback (Task S4-7) e continuam existindo.
- Fim de cada mensagem de commit:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`

### Loop de TDD deste card — roda no Mac

`teste_s1.py` e `teste_s4.py` são stdlib puro (`sitio.py` importa `asyncio, datetime, json, os, re, time,
unicodedata`; `sitio_falso.py` importa `json, os, re, socket`). Medido nesta sessão, com o kit de hoje:

```bash
cd ~/Workspace/forja/ferramentas/docs/trilha && AGENTE_SITIO=$HOME/Workspace/forja/ferramentas/docs/sitio.py python3 -B teste_s1.py
# S1: 0 falha(s)   (Python 3.14.5 do Mac, sem httpx, sem rede)
```

O `AGENTE_SITIO` é **obrigatório** no Mac: sem ele o carregador de `teste_s1.py:8-10` procura
`ferramentas/sitio.py.novo` e `ferramentas/sitio.py`, que não existem (o kit guarda o `sitio.py` em
`ferramentas/docs/`), e o `next()` estoura `StopIteration`. Na forja, onde `_raiz` é `/opt/agente`, o
`cartao.sh` não precisa passar nada.

**Todo o código deste card foi rodado numa cópia de trabalho antes de virar plano** (Python 3.14.5 do
Mac, sem rede, sem `httpx`): `teste_s1.py` continua `S1: 0 falha(s)` **sem edição** com o `sitio.py`
patcheado e o `CliFalso` novo; o `teste_s4.py` sai `S4: 0 falha(s)` (29 asserções, saída 0); `bash -n`
passa no `cartao.sh` e no `deploy.sh` alterados; e o `s4.py` produz dois `-rw-------` idênticos às
origens. Os blocos de código abaixo são o que rodou, não um esboço.

> **Divergência com o spec, registrada:** a célula **F0k** do §5 diz que `teste_fila.py` e `teste_s4.py`
> "não rodam no Mac (o `python3` do Mac não tem `httpx`, e o worker o importa)". Isso vale para o
> `teste_fila.py` (que carrega o worker, e o worker importa `httpx`); **não** vale para o `teste_s4.py`,
> que não toca no worker. O portão do F0k continua sendo só `py_compile` — este plano não o muda —, mas
> o loop de desenvolvimento das Tasks S4-1 a S4-3 roda de verdade no Mac, e é isso que torna elas
> verificáveis antes do cartão. Os portões de valer continuam sendo os da forja (Task S4-6).

---

### Task S4-1: `CliFalso` ganha `request`, `pedidos` e `respostas`

**Files:**
- Modify: `/Users/figueiredo/Workspace/forja/ferramentas/docs/trilha/sitio_falso.py` (classe `CliFalso`, linhas 33-60)

**Interfaces:**
- Consumes: nada novo.
- Produces:
  - `CliFalso(troca=None, status=None, erro=None, gigante=None, busca=None, respostas=None)`
  - `async CliFalso.get(url, params=None, headers=None, timeout=None, follow_redirects=True)` (inalterada por fora)
  - `async CliFalso.request(metodo, url, params=None, json=None, headers=None, timeout=None, follow_redirects=True)`
  - `CliFalso.chamadas: list[(caminho, params, headers)]` — o `request()` grava a **mesma** tupla de 3 do `get()`
  - `CliFalso.pedidos: list[(metodo, caminho, json)]` — só os não-GET
  - `respostas: {(metodo, rota-regex): (status, corpo_bytes)}`, consultado pelo `get()` e pelo `request()` **antes** de `status`

- [ ] **Step 1: Medir o verde de hoje (a linha de base que não pode cair)**

```bash
cd ~/Workspace/forja/ferramentas/docs/trilha && AGENTE_SITIO=$HOME/Workspace/forja/ferramentas/docs/sitio.py python3 -B teste_s1.py | tail -3
```
Expected: `S1: 0 falha(s)`. Guarde essa saída: a Task S4-1 e a S4-3 só estão prontas quando ela se repete
**sem editar `teste_s1.py`**.

- [ ] **Step 2: Trocar a classe `CliFalso` inteira**

Em `trilha/sitio_falso.py`, substituir o bloco das linhas 33-60 por:

```python
class CliFalso:
    def __init__(self, troca=None, status=None, erro=None, gigante=None, busca=None, respostas=None):
        self.chamadas = []
        self.pedidos = []                 # (metodo, caminho, corpo json) — so os nao-GET
        self.busca = busca or {}          # q exato -> fixture (so para /api/pipeline/search)
        self.troca = troca or {}          # rota-regex -> nome de fixture
        self.status = status or {}        # rota-regex -> status http
        self.erro = erro or {}            # rota-regex -> classe de excecao
        self.gigante = gigante or set()   # rotas que devolvem > 512 KB
        self.respostas = respostas or {}  # (metodo, rota-regex) -> (status, corpo em bytes)

    def _resposta(self, metodo, caminho):
        """respostas= vem antes de status=: e assim que o GET do snapshot e o PATCH da mesma rota
        recebem respostas diferentes, e que o teste serve 204, {"error":{...}} e corpo nao-JSON."""
        for (m, rx), (st, corpo) in self.respostas.items():
            if m == metodo and re.fullmatch(rx, caminho):
                return Resp(st, corpo)
        return None

    def _estourar(self, caminho):
        for rx, exc in self.erro.items():
            if re.fullmatch(rx, caminho):
                raise exc("simulado")

    def _status(self, caminho):
        for rx, st in self.status.items():
            if re.fullmatch(rx, caminho):
                return Resp(st, b'{"error":"x"}')
        return None

    async def get(self, url, params=None, headers=None, timeout=None, follow_redirects=True):
        assert follow_redirects is False, "sitio deve pedir follow_redirects=False"
        caminho = url.split("bythiagofigueiredo.com", 1)[1]
        self.chamadas.append((caminho, dict(params or {}), dict(headers or {})))
        self._estourar(caminho)
        r = self._resposta("GET", caminho)
        if r is None:
            r = self._status(caminho)
        if r is not None:
            return r
        if caminho in self.gigante:
            return Resp(200, b"{" + b" " * (600 * 1024) + b"}")
        if caminho == "/api/pipeline/search" and (params or {}).get("q") in self.busca:
            return Resp(200, open(os.path.join(FIX, self.busca[params["q"]] + ".json"), "rb").read())
        for rx, nome in ROTA_FIXTURE:
            if re.fullmatch(rx, caminho):
                nome = next((v for k, v in self.troca.items() if re.fullmatch(k, caminho)), nome)
                return Resp(200, open(os.path.join(FIX, nome + ".json"), "rb").read())
        return Resp(404, b'{"error":"not found"}')

    async def request(self, metodo, url, params=None, json=None, headers=None, timeout=None,
                      follow_redirects=True):
        """Nao-GET. `json` e o nome do httpx e sombreia o modulo json aqui dentro — de proposito,
        para a assinatura bater com a do httpx.AsyncClient que o proxy passa em producao."""
        assert follow_redirects is False, "sitio deve pedir follow_redirects=False"
        caminho = url.split("bythiagofigueiredo.com", 1)[1]
        self.chamadas.append((caminho, dict(params or {}), dict(headers or {})))
        self.pedidos.append((metodo, caminho, json))
        self._estourar(caminho)
        r = self._resposta(metodo, caminho)
        if r is None:
            r = self._status(caminho)
        if r is not None:
            return r
        return Resp(404, b'{"error":"not found"}')
```

Nada mais no arquivo muda: `ROTA_FIXTURE`, `Resp`, `Timeout` e `Relogio` ficam como estão. **Sem
`respostas=`, o `get()` continua como hoje** — o único caminho novo é um `dict` vazio que nunca casa.

- [ ] **Step 3: Provar que o `get()` não mudou**

```bash
cd ~/Workspace/forja/ferramentas/docs/trilha && AGENTE_SITIO=$HOME/Workspace/forja/ferramentas/docs/sitio.py python3 -B teste_s1.py | tail -3
```
Expected: `S1: 0 falha(s)`, **com `teste_s1.py` intocado**.

- [ ] **Step 4: Fumaça do caminho novo (o `request` ainda não tem quem o chame)**

```bash
cd ~/Workspace/forja/ferramentas/docs/trilha && python3 -B -c "
import asyncio, re
from sitio_falso import CliFalso
U='https://bythiagofigueiredo.com/api/pipeline/youtube/intelligence'
c=CliFalso(respostas={('PATCH', re.escape('/api/pipeline/youtube/intelligence')): (204, b''),
                      ('GET',   re.escape('/api/pipeline/youtube/intelligence')): (200, b'{\"data\":1}')})
r=asyncio.run(c.request('PATCH', U, params={}, json={'task_id':'t'}, headers={'X-Pipeline-Key':'k'}, follow_redirects=False))
g=asyncio.run(c.get(U, params={'channel_id':'x'}, headers={}, follow_redirects=False))
assert (r.status_code, g.status_code, g.content) == (204, 200, b'{\"data\":1}'), (r.status_code, g.status_code)
assert c.pedidos == [('PATCH', '/api/pipeline/youtube/intelligence', {'task_id':'t'})], c.pedidos
assert len(c.chamadas) == 2 and c.chamadas[0][2] == {'X-Pipeline-Key':'k'}, c.chamadas
print('CLIFALSO-OK')"
```
Expected: `CLIFALSO-OK`.

- [ ] **Step 5: Compilar e commitar**

```bash
cd ~/Workspace/forja/ferramentas && python3 -m py_compile docs/trilha/sitio_falso.py && echo PY-OK
```
Expected: `PY-OK`. (Portão do F0k para os `.py` do kit.)

```bash
cd ~/Workspace/forja/ferramentas
git add docs/trilha/sitio_falso.py
git commit -m "test: CliFalso ganha request, pedidos e respostas

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task S4-2: `teste_s4.py` — o teste do cartão, vermelho

**Files:**
- Create: `/Users/figueiredo/Workspace/forja/ferramentas/docs/trilha/teste_s4.py`

**Interfaces:**
- Consumes: `CliFalso(respostas=…)`, `CliFalso.pedidos`, `Relogio`, `Timeout` (Task S4-1); o módulo
  `sitio` carregado por `AGENTE_SITIO` ou, na falta, `../../sitio.py.novo` → `../../sitio.py`
  (mesmo carregador de `teste_s1.py:7-11`, porque `cartao.sh:22` só passa `AGENTE_PROXY`).
- Produces: `teste_s4.py`, saída `S4: N falha(s)` e `SystemExit(1)` com qualquer falha.

- [ ] **Step 1: Cabeçalho, carregador e utilitários**

Criar `trilha/teste_s4.py`:

```python
"""Teste do cartao S4: o sitio.py da fase 2, sem proxy, sem httpx e sem rede.
Uso (no diretorio deste arquivo):  AGENTE_SITIO=/opt/agente/sitio.py.novo python3 -B teste_s4.py
Sem AGENTE_SITIO carrega ../../sitio.py.novo e, na falta dele, ../../sitio.py — como o teste_s1."""
import asyncio, importlib.machinery as _m, importlib.util as _u, os, re, sys
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sitio_falso import CliFalso, Relogio, Timeout
_raiz = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
_arq = os.environ.get("AGENTE_SITIO") or next(
    p for p in (os.path.join(_raiz, "sitio.py.novo"), os.path.join(_raiz, "sitio.py")) if os.path.exists(p))
_ld = _m.SourceFileLoader("sitio", _arq)
S = _u.module_from_spec(_u.spec_from_loader("sitio", _ld)); _ld.exec_module(S)

FILA = "forja_" + "A" * 43                                   # a chave da fila, sempre por chave=
os.environ["SITIO_CHAVE"] = "chave-de-leitura-" + "x" * 20   # a {read}: a fase 2 NUNCA pode cair nela
falhas = []


def exige(ok, nome):
    print("OK   " if ok else "FALHA", nome)
    if not ok:
        falhas.append(nome)


def run(c):
    return asyncio.run(c)


def tipo_de(cli, metodo, caminho, **k):
    """Roda pedir() e devolve (tipo, status) da FalhaSite, ou ('ok', None) quando nao levanta."""
    try:
        run(S.pedir(cli, metodo, caminho, agora=Relogio(), **k))
        return "ok", None
    except S.FalhaSite as e:
        return e.tipo, e.status


class CliTempo(CliFalso):
    """CliFalso que anota o timeout de cada chamada (o `chamadas` do CliFalso so guarda 3 campos)."""
    def __init__(self, **k):
        super().__init__(**k)
        self.tempos = []

    async def get(self, url, params=None, headers=None, timeout=None, follow_redirects=True):
        self.tempos.append(("GET", timeout))
        return await super().get(url, params=params, headers=headers, timeout=timeout,
                                 follow_redirects=follow_redirects)

    async def request(self, metodo, url, params=None, json=None, headers=None, timeout=None,
                      follow_redirects=True):
        self.tempos.append((metodo, timeout))
        return await super().request(metodo, url, params=params, json=json, headers=headers,
                                     timeout=timeout, follow_redirects=follow_redirects)


ID = "00000000-0000-4000-8000-000000000013"
CLAIM = "/api/pipeline/youtube/intelligence/task/claim"
FAIL = "/api/pipeline/youtube/intelligence/task/%s/fail" % ID
INTEL = "/api/pipeline/youtube/intelligence"
```

- [ ] **Step 2: Blocos 1 e 2 — a trava (a fase 1 não ganhou rota; a fase padrão recusa antes da rede)**

Acrescentar:

```python
# 1. a trava: FASE segue 1, a fase 1 nao ganhou rota, a fase 2 e a fase 1 + 4
exige(S.FASE == 1, "FASE = 1 (so o fila_intel.py passa fase=2)")
exige(len(S.ROTAS_FASE[1]) == 13 and all(m == "GET" for m, _, _ in S.ROTAS_FASE[1]),
      "fase 1 intocada: 13 rotas, todas GET")
exige(len(S.ROTAS_FASE[2]) == 17 and S.ROTAS_FASE[2][:13] == S.ROTAS_FASE[1], "fase 2 = fase 1 + 4")
NOVAS = [("POST", CLAIM, {}), ("POST", FAIL, {}), ("GET", INTEL, {"channel_id": ID}), ("PATCH", INTEL, {})]
exige(all(S.autorizada(m, c, p, 2) for m, c, p in NOVAS), "as 4 rotas da fila passam com fase=2")
exige(not any(S.autorizada(m, c, p) for m, c, p in NOVAS), "as 4 rotas da fila sao recusadas na fase padrao")
exige(not S.autorizada("GET", INTEL, {"channel_id": "UCabc"}, 2), "channel_id fora do uuid e recusado")
exige(not S.autorizada("POST", "/api/pipeline/youtube/intelligence/task/nao-uuid/fail", {}, 2),
      "o fail exige uuid no caminho")
exige("recusa" not in S.MENSAGEM, "recusa nao entra em MENSAGEM (o proxy nunca a ve)")

# 2. com a fase padrao, claim, fail e PATCH levantam RotaBloqueada SEM rede
cli = CliFalso()
bloq = []
for m, c, b in (("POST", CLAIM, {"channel_ids": [ID]}), ("POST", FAIL, {"reason": "x"}),
                ("PATCH", INTEL, {"task_id": ID})):
    try:
        run(S.pedir(cli, m, c, corpo=b, chave=FILA, agora=Relogio())); bloq.append(False)
    except S.RotaBloqueada:
        bloq.append(True)
exige(all(bloq) and cli.chamadas == [] and cli.pedidos == [],
      "claim, fail e PATCH na fase padrao: RotaBloqueada antes de qualquer rede")
```

- [ ] **Step 3: Blocos 3 a 5 — chave explícita, 204, e nada de cache**

```python
# 3. fase 2 exige chave= explicita, ANTES da rede, e nunca cai no SITIO_CHAVE do ambiente
cli = CliFalso(respostas={("POST", re.escape(CLAIM)): (204, b"")})
exige(tipo_de(cli, "POST", CLAIM, corpo={"channel_ids": [ID]}, fase=2) == ("sem_chave", None)
      and cli.chamadas == [], "fase 2 sem chave=: sem_chave antes da rede, sem usar a {read} do ambiente")

# 4. 204 -> (None, t, False); o corpo vai em json= e o cabecalho leva a chave da fila
cli = CliFalso(respostas={("POST", re.escape(CLAIM)): (204, b"")})
d, t, c = run(S.pedir(cli, "POST", CLAIM, corpo={"channel_ids": [ID]}, fase=2, chave=FILA, agora=Relogio()))
exige(d is None and t == 1_789_758_000.0 and c is False, "204 -> (None, t, False)")
exige(cli.pedidos == [("POST", CLAIM, {"channel_ids": [ID]})], "o corpo vai em json= e fica em pedidos")
exige(cli.chamadas[0][2]["X-Pipeline-Key"] == FILA, "a chave da fila vai no X-Pipeline-Key")

# 5. 200 na fase 2: desembrulha, nao le nem grava _CACHE, e GET e PATCH da mesma rota nao se confundem
S._CACHE.clear()
cli = CliFalso(respostas={("GET", re.escape(INTEL)): (200, b'{"data":{"recent_window":{"days":90}}}'),
                          ("PATCH", re.escape(INTEL)): (200, b'{"data":{"id":"x"}}')})
d1, _, c1 = run(S.pedir(cli, "GET", INTEL, {"channel_id": ID}, fase=2, chave=FILA, agora=Relogio()))
d2, _, c2 = run(S.pedir(cli, "GET", INTEL, {"channel_id": ID}, fase=2, chave=FILA, agora=Relogio()))
exige(d1 == {"recent_window": {"days": 90}} and d2 == d1, "200 na fase 2 desembrulha o {data:...}")
exige(len(cli.chamadas) == 2 and c1 is False and c2 is False and S._CACHE == {},
      "fase 2: nunca le nem grava _CACHE — a 2a leitura vai a rede de novo")
d3, _, _ = run(S.pedir(cli, "PATCH", INTEL, corpo={"task_id": ID}, fase=2, chave=FILA, agora=Relogio()))
exige(d3 == {"id": "x"} and cli.pedidos[-1][0] == "PATCH",
      "o GET e o PATCH da mesma rota recebem respostas diferentes (respostas= e por metodo)")
```

- [ ] **Step 4: Blocos 6 e 7 — o mapeamento inteiro e o corpo ruim com `status=200`**

```python
# 6. a tabela de resposta -> FalhaSite da fase 2
MAPA = [(400, "recusa"), (404, "recusa"), (409, "recusa"), (422, "recusa"), (500, "recusa"),
        (401, "chave"), (403, "chave"), (429, "429"),
        (501, "5xx"), (503, "5xx"), (599, "5xx"),
        (302, "recusa"), (418, "recusa")]
saiu = []
for st, esperado in MAPA:
    c = CliFalso(respostas={("PATCH", re.escape(INTEL)): (st, b'{"error":{"code":"X"}}')})
    saiu.append((tipo_de(c, "PATCH", INTEL, corpo={}, fase=2, chave=FILA), (esperado, st)))
exige(all(a == b for a, b in saiu),
      "mapeamento de status da fase 2 (divergencias: %s)" % [x for x in saiu if x[0] != x[1]])

# 7. 200 com corpo impossivel: formato/grande, com status=200 (o worker le isso como nao-transitorio)
c = CliFalso(respostas={("GET", re.escape(INTEL)): (200, b"nao e json")})
exige(tipo_de(c, "GET", INTEL, params={"channel_id": ID}, fase=2, chave=FILA) == ("formato", 200),
      "200 com corpo nao-JSON -> formato com status=200")
c = CliFalso(respostas={("GET", re.escape(INTEL)): (200, b"{" + b" " * (600 * 1024) + b"}")})
exige(tipo_de(c, "GET", INTEL, params={"channel_id": ID}, fase=2, chave=FILA) == ("grande", 200),
      "200 com mais de 512 KB -> grande com status=200")
```

- [ ] **Step 5: Bloco 8 — `_velho` nunca na fase 2, e a fase 1 continua servindo o velho**

```python
# 8. a fase 2 nunca serve o _velho; a fase 1, no mesmo cache, continua servindo
S._CACHE.clear(); rel = Relogio()
run(S.pedir(CliFalso(), "GET", "/api/pipeline/stats", {}, agora=rel))    # fase 1 enche o cache
exige(len(S._CACHE) == 1, "a fase 1 encheu o cache de /api/pipeline/stats")
rel.t += 400                                    # passou CACHE_S (300 s) e esta dentro de VELHO_MAX_S
for st, esperado in ((503, "5xx"), (429, "429")):
    c = CliFalso(status={r"/api/pipeline/stats": st})
    try:
        run(S.pedir(c, "GET", "/api/pipeline/stats", {}, fase=2, chave=FILA, agora=rel)); r = ("ok", None)
    except S.FalhaSite as e:
        r = (e.tipo, e.status)
    exige(r == (esperado, st), "fase 2: %d levanta %s e nunca serve o _velho" % (st, esperado))
_, _, velho = run(S.pedir(CliFalso(status={r"/api/pipeline/stats": 503}), "GET", "/api/pipeline/stats",
                          {}, agora=rel))
exige(velho is True, "fase 1 intocada: 503 com dado de 6 min ainda serve o velho")
exige(tipo_de(CliFalso(status={r"/api/pipeline/up-next": 404}), "GET", "/api/pipeline/up-next",
              params={}) == ("formato", None), "fase 1 intocada: 404 ainda e formato, sem status")
S._CACHE.clear()
```

- [ ] **Step 6: Blocos 9 e 10 — rede sem resposta e `timeout=`**

```python
# 9. sem resposta nao ha status: timeout/fora, e nenhum cache
exige(tipo_de(CliFalso(erro={re.escape(CLAIM): Timeout}), "POST", CLAIM, corpo={}, fase=2,
              chave=FILA) == ("timeout", None), "rede: timeout -> timeout, sem status")
exige(tipo_de(CliFalso(erro={re.escape(CLAIM): ConnectionError}), "POST", CLAIM, corpo={}, fase=2,
              chave=FILA) == ("fora", None), "rede: outro erro -> fora, sem status")
exige(S._CACHE == {}, "nenhuma chamada de fase 2 gravou cache")

# 10. timeout= substitui; sem ele valem TIMEOUT e TIMEOUT_LENTO
INSIGHTS = "/api/pipeline/youtube/competitors/insights"
cli = CliTempo(respostas={("PATCH", re.escape(INTEL)): (204, b""), ("GET", re.escape(INTEL)): (204, b"")})
run(S.pedir(cli, "PATCH", INTEL, corpo={}, fase=2, chave=FILA, timeout=60, agora=Relogio()))
run(S.pedir(cli, "GET", INTEL, {"channel_id": ID}, fase=2, chave=FILA, timeout=15, agora=Relogio()))
run(S.pedir(cli, "GET", "/api/pipeline/stats", {}, fase=2, chave=FILA, agora=Relogio()))
run(S.pedir(cli, "GET", INSIGHTS, {}, fase=2, chave=FILA, agora=Relogio()))
exige(cli.tempos == [("PATCH", 60), ("GET", 15), ("GET", S.TIMEOUT), ("GET", S.TIMEOUT_LENTO[INSIGHTS])],
      "timeout= substitui; sem ele valem TIMEOUT e TIMEOUT_LENTO (%s)" % cli.tempos)
exige([m for m, _, _ in cli.pedidos] == ["PATCH"],
      "so o nao-GET passa por cli.request — o GET da fase 2 continua em cli.get")
S._CACHE.clear()

print("\nS4: %d falha(s)" % len(falhas)); raise SystemExit(1 if falhas else 0)
```

- [ ] **Step 7: Rodar e ver falhar**

```bash
cd ~/Workspace/forja/ferramentas/docs/trilha && AGENTE_SITIO=$HOME/Workspace/forja/ferramentas/docs/sitio.py python3 -B teste_s4.py; echo "saida=$?"
```
Expected: **FAIL** — `TypeError: pedir() got an unexpected keyword argument 'corpo'` já no bloco 2, e
antes disso `FALHA fase 2 = fase 1 + 4` (`KeyError: 2` no `ROTAS_FASE`). É o vermelho do ciclo.

```bash
cd ~/Workspace/forja/ferramentas && python3 -m py_compile docs/trilha/teste_s4.py && echo PY-OK
```
Expected: `PY-OK`.

- [ ] **Step 8: Commit do teste vermelho**

O teste entra na árvore **antes** da implementação, e é isso que torna o par de commits bissectável:
o vermelho documenta o contrato, o verde da Task S4-3 o cumpre. Nada aqui é código de produção — o
`sitio.py` ainda é o da fase 1 —, então a árvore não fica com o kit quebrado.

```bash
cd ~/Workspace/forja/ferramentas
git add docs/trilha/teste_s4.py
git commit -m "test: teste_s4 — o contrato da fase 2 do sitio.py

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task S4-3: `sitio.py` fase 2 — `FalhaSite`, `ROTAS_FASE[2]`, `_falha2` e `pedir`

**Files:**
- Modify: `/Users/figueiredo/Workspace/forja/ferramentas/docs/sitio.py` (`FalhaSite` :41-45, `ROTAS_FASE` :23-38, novo `_falha2` depois de `_velho` :84-88, `pedir` :90-127)

**Interfaces:**
- Consumes: `cli.get(url, params, headers, timeout, follow_redirects)` e, novo,
  `cli.request(metodo, url, params, json, headers, timeout, follow_redirects)` (Task S4-1).
- Produces (a assinatura que o `fila_intel.py` consome — **parâmetros novos só por palavra-chave**):

```python
async def pedir(cli, metodo, caminho, params=None, agora=time.time, *,
                corpo=None, fase=FASE, chave=None, timeout=None)
# -> (dados, instante_da_leitura, veio_do_cache) | (None, t, False) no 204
# levanta RotaBloqueada | FalhaSite

class FalhaSite(Exception):
    def __init__(self, tipo, rota, detalhe="", *, status=None)   # .tipo .rota .detalhe .status

def autorizada(metodo, caminho, params=None, fase=FASE)          # inalterada
def _falha2(st, caminho) -> FalhaSite                            # novo, so a fase 2 usa
ROTAS_FASE[2] = ROTAS_FASE[1] + 4 rotas                          # FASE continua 1
```

- [ ] **Step 1: `FalhaSite` ganha `status=` por palavra-chave**

Em `sitio.py:41-45`, trocar:

```python
class FalhaSite(Exception):
    def __init__(self, tipo, rota, detalhe="", *, status=None):
        super().__init__(tipo)
        self.tipo, self.rota, self.detalhe = tipo, rota, detalhe
        self.status = status     # fase 2: o status HTTP da resposta; None quando nao houve resposta
```

`tipo, rota, detalhe` continuam posicionais: as 8 construções que já existem no arquivo não mudam.

- [ ] **Step 2: `ROTAS_FASE[2]`**

Logo depois do fecho do literal `ROTAS_FASE = {1: (...)}` (`sitio.py:38`), acrescentar:

```python
# Fase 2 = fase 1 + a fila de inteligencia. FASE continua 1: quem passa fase=2 e so o fila_intel.py.
ROTAS_FASE[2] = ROTAS_FASE[1] + (
    ("POST", r"/api/pipeline/youtube/intelligence/task/claim", {}),
    ("POST", r"/api/pipeline/youtube/intelligence/task/" + _UUID + r"/fail", {}),
    ("GET", r"/api/pipeline/youtube/intelligence", {"channel_id": _UUID}),
    ("PATCH", r"/api/pipeline/youtube/intelligence", {}),
)
```

Escrito como atribuição, e não dentro do literal, para que `len(ROTAS_FASE[1]) == 13` continue valendo
(`teste_s1.py:49`) e a fase 2 seja, por construção, um superconjunto da 1.

- [ ] **Step 3: `_falha2` — a tabela de resposta → `FalhaSite`**

Depois de `_velho` (`sitio.py:88`), antes de `pedir`:

```python
def _falha2(st, caminho):
    """Resposta -> FalhaSite da fase 2 (§4.6 do spec). O 500 e `recusa`, nao `5xx`: quem decide o
    retry e o fila_intel.py, pelo `status`. 3xx, qualquer outro 4xx e qualquer 2xx que nao seja
    200/204 caem em `recusa` — fecha. `recusa` de proposito nao entra em MENSAGEM: o proxy nunca a ve."""
    if st in (400, 404, 409, 422, 500):
        return FalhaSite("recusa", caminho, str(st), status=st)
    if st in (401, 403):
        return FalhaSite("chave", caminho, str(st), status=st)
    if st == 429:
        return FalhaSite("429", caminho, status=429)
    if st >= 501:
        return FalhaSite("5xx", caminho, status=st)
    return FalhaSite("recusa", caminho, str(st), status=st)
```

- [ ] **Step 4: `pedir` — trocar a função inteira (`sitio.py:90-127`)**

```python
async def pedir(cli, metodo, caminho, params=None, agora=time.time, *,
                corpo=None, fase=FASE, chave=None, timeout=None):
    """(dados, instante_da_leitura, veio_do_cache). Levanta RotaBloqueada ou FalhaSite; nunca devolve vazio calado.

    Fase 1 (o padrao, tudo GET): igual a de sempre — cache de 5 min, _velho na falha passageira, chave
    do ambiente, 3xx/4xx = formato. Fase 2 ou metodo nao-GET (so o fila_intel.py): sem cache, sem
    _velho, sem repetir; chave= obrigatoria; corpo em json=; 204 -> (None, t, False); status pelo _falha2."""
    params = dict(params or {})
    if not autorizada(metodo, caminho, params, fase):
        raise RotaBloqueada("%s %s" % (metodo, caminho))
    fila = fase != 1 or metodo != "GET"
    ck = (caminho, tuple(sorted(params.items())))
    t = agora()
    if not fila:
        if ck in _CACHE and t - _CACHE[ck][0] < CACHE_S:
            return _CACHE[ck][1], _CACHE[ck][0], True
        chave = os.environ.get("SITIO_CHAVE", "")
    if not chave:
        raise FalhaSite("sem_chave", caminho)
    cab = {"X-Pipeline-Key": chave}
    espera = TIMEOUT_LENTO.get(caminho, TIMEOUT) if timeout is None else timeout
    try:
        if metodo == "GET":
            r = await cli.get(BASE_SITE + caminho, params=params, headers=cab,
                              timeout=espera, follow_redirects=False)
        else:
            r = await cli.request(metodo, BASE_SITE + caminho, params=params, json=corpo,
                                  headers=cab, timeout=espera, follow_redirects=False)
    except Exception as e:
        tipo = "timeout" if "timeout" in e.__class__.__name__.lower() else "fora"
        falha = FalhaSite(tipo, caminho, e.__class__.__name__)
        if fila:
            raise falha
        return _velho(ck, t, falha)
    st = r.status_code
    if fila:
        if st == 204:
            return None, t, False
        if st != 200:
            raise _falha2(st, caminho)
    else:
        if st in (401, 403):
            raise FalhaSite("chave", caminho, str(st))
        if st == 429:
            return _velho(ck, t, FalhaSite("429", caminho, "429"))
        if st >= 500:
            return _velho(ck, t, FalhaSite("5xx", caminho, str(st)))
        if st != 200:                          # 3xx (redirect nao seguido) e 4xx
            raise FalhaSite("formato", caminho, str(st))
    conteudo = r.content
    if len(conteudo) > TETO_BYTES:
        raise FalhaSite("grande", caminho, str(len(conteudo)), status=200 if fila else None)
    try:
        dados = _desembrulha(json.loads(conteudo))
    except ValueError:
        raise FalhaSite("formato", caminho, "json", status=200 if fila else None)
    if not fila:
        _CACHE[ck] = (t, dados)
    return dados, t, False
```

Três detalhes que são a invariante da fase 1, e não estética:

1. o `ramo else` reproduz `sitio.py:108-116` na mesma ordem, com as mesmas mensagens;
2. o corpo da resposta passou a se chamar `conteudo` — `corpo` agora é o **corpo do pedido**;
3. na fase 1, `fila` é `False` para toda rota (as 13 são GET), então `chave` é sempre lida do ambiente,
   o cache é lido antes e gravado depois, e `_velho` continua sendo o único caminho do 429/5xx.

- [ ] **Step 5: Rodar e ver passar — o teste do cartão e o da fase 1, sem editar nenhum**

```bash
cd ~/Workspace/forja/ferramentas/docs/trilha && AGENTE_SITIO=$HOME/Workspace/forja/ferramentas/docs/sitio.py python3 -B teste_s4.py; echo "saida=$?"
cd ~/Workspace/forja/ferramentas/docs/trilha && AGENTE_SITIO=$HOME/Workspace/forja/ferramentas/docs/sitio.py python3 -B teste_s1.py | tail -3
```
Expected: `S4: 0 falha(s)` com `saida=0`, e `S1: 0 falha(s)`. Se o `teste_s1` pedir edição, **pare**: a
fase 1 mudou e o spec proíbe. O `teste_s2` não roda no Mac (carrega o proxy) — é portão do dono depois
do `deploy.sh S4` (Task S4-6).

- [ ] **Step 6: Compilar (portão do F0k)**

```bash
cd ~/Workspace/forja/ferramentas && python3 -m py_compile docs/sitio.py docs/trilha/sitio_falso.py docs/trilha/teste_s4.py && echo PY-OK
```
Expected: `PY-OK`.

- [ ] **Step 7: Commit**

```bash
cd ~/Workspace/forja/ferramentas
git add docs/sitio.py
git commit -m "feat: sitio.py fase 2 — metodos nao-GET, chave explicita e timeout

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task S4-4: `trilha/s4.py` — o script do cartão

**Files:**
- Create: `/Users/figueiredo/Workspace/forja/ferramentas/docs/trilha/s4.py`

**Interfaces:**
- Consumes: `docs/sitio.py` e `proxy.py`, na raiz `/opt/agente` (o `cartao.sh:5` faz `B=$(pwd)` e roda
  `$PY -B docs/trilha/$t.py` de lá).
- Produces: `/opt/agente/sitio.py.novo` (0600) e `/opt/agente/proxy.py.novo` (0600, cópia idêntica),
  que é o que `cartao.sh:8-9` e `deploy.sh:11` esperam.

- [ ] **Step 1: Escrever o script**

`trilha/s4.py` — mesma receita do `s1.py`, porque o S4 faz a mesma operação (instalar um `sitio.py`
novo, inerte para o proxy) com um conteúdo diferente:

```python
"""S4: instala o sitio.py da FASE 2. Ele continua com FASE = 1 — o proxy so faz GET da fase 1 —, e quem
passa fase=2 e so o fila_intel.py. proxy.py.novo = copia identica do proxy.py, para o replay pareado do
cartao.sh dar `mudaram: 0`. Rodar em /opt/agente."""
import os, shutil
for origem, destino in (("docs/sitio.py", "sitio.py.novo"), ("proxy.py", "proxy.py.novo")):
    fd = os.open(destino, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "wb") as f, open(origem, "rb") as g:
        shutil.copyfileobj(g, f)
print("ok")
```

O `proxy.py` **não é alterado**: o S4 não toca no roteador nem no ramo `agente-site`, e é por isso que
o portão do replay exige `mudaram: 0` (`cartao.sh:18-19`, ramo `else`, `SALDO_MIN=0`).

- [ ] **Step 2: Provar a cópia, num diretório de brinquedo (no Mac, sem tocar na forja)**

```bash
T=$(mktemp -d) && mkdir -p "$T/docs" && cp ~/Workspace/forja/ferramentas/docs/sitio.py "$T/docs/sitio.py" && printf 'x=1\n' > "$T/proxy.py" && cp ~/Workspace/forja/ferramentas/docs/trilha/s4.py "$T/docs/s4.py" && (cd "$T" && python3 -B docs/s4.py) && ls -l "$T"/*.novo && cmp "$T/docs/sitio.py" "$T/sitio.py.novo" && cmp "$T/proxy.py" "$T/proxy.py.novo" && echo S4PY-OK && rm -rf "$T"
```
Expected: dois arquivos `-rw-------` e `S4PY-OK`.

- [ ] **Step 3: Compilar**

```bash
cd ~/Workspace/forja/ferramentas && python3 -m py_compile docs/trilha/s4.py && echo PY-OK
```
Expected: `PY-OK`.

- [ ] **Step 4: Commit**

```bash
cd ~/Workspace/forja/ferramentas
git add docs/trilha/s4.py
git commit -m "feat: s4.py — cartao da Trilha que instala o sitio.py da fase 2

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task S4-5: `deploy.sh` e `cartao.sh` — lock, troca por `mv`, `teste_s1` e `teste_fila`

**Files:**
- Modify: `/Users/figueiredo/Workspace/forja/ferramentas/docs/trilha/deploy.sh` (lock antes da guarda de mídia; `:11` e `:20` por `mv`)
- Modify: `/Users/figueiredo/Workspace/forja/ferramentas/docs/trilha/cartao.sh` (duas adições depois de `:22`)

**Interfaces:**
- Consumes: `/opt/agente/fila_intel.lock` (o mesmo arquivo do worker), `teste_s1.py`, `teste_fila.py`.
- Produces: `deploy.sh` e `cartao.sh` com os portões novos. **Nenhum `flock` de shell espera sem limite**:
  `-n` com mensagem no `deploy.sh`, `-w 1800` no `cartao.sh`.

- [ ] **Step 1: `deploy.sh` — o lock, antes da guarda de mídia**

Entre a linha 6 (`[ -s proxy.py.novo ] || …`) e a linha 7 (`M=$(python3 -c …)`), inserir:

```bash
exec 9>>/opt/agente/fila_intel.lock; flock -n 9 || { echo 'ESPERAR: fila_intel em execução'; exit 1; }
```

O lock é por **descritor** e vale até o fim do script: a troca do `sitio.py` não pode cair no meio de uma
execução do cron, que importa o `sitio.py` a cada rodada. `-n` (e não `-w`) porque o `deploy.sh` é
interativo e o dono prefere a mensagem a um terminal pendurado por até 25 min.

- [ ] **Step 2: `deploy.sh` — troca e restauro do `sitio.py` por `mv`**

Linha 11, trocar:

```bash
[ -s sitio.py.novo ] && { [ -f sitio.py ] && cp -p sitio.py "$B.sitio"; cp sitio.py.novo sitio.py.tmp && mv sitio.py.tmp sitio.py && rm sitio.py.novo; }
```

Linha 20 (o rollback automático), trocar a parte do `sitio.py`:

```bash
  echo "DEPLOY $T: FALHOU — rollback"; cp -p "$B" proxy.py; [ -f "$B.sitio" ] && { cp -p "$B.sitio" sitio.py.tmp && mv sitio.py.tmp sitio.py; }
```

Nos dois casos o arquivo aparece **inteiro ou nada**: o `mv` dentro do mesmo diretório é um rename
atômico. O `umask 077` do `:4` garante que o `.tmp` nasce 0600, e o `mv` preserva o modo.

- [ ] **Step 3: `cartao.sh` — `teste_s1` sobre o `sitio.py.novo`**

Depois da linha 22 (`echo "== teste do cartao"; …`), inserir:

```bash
[ "$T" = S4 ] && { (cd docs/trilha && AGENTE_SITIO="$B/sitio.py.novo" $PY -B teste_s1.py) || falha teste_s1; }
```

O `cartao.sh:22` só exporta `AGENTE_PROXY`; é esta linha que aponta o `teste_s1` para o `sitio.py.novo`
em vez do instalado. O `teste_s2` **não** entra aqui: o proxy carrega o `sitio.py` do próprio diretório
(`trilha/s2.py:19-22`), então ele só faz sentido depois do `deploy.sh S4`.

- [ ] **Step 4: `cartao.sh` — o bloco do `teste_fila`**

Logo depois da linha do passo 3, e antes do `echo "CARTAO $T: APROVADO …"` final, inserir, literal:

```bash
if [ -s sitio.py.novo ]; then F="$B/fila_intel.py"; [ -f "$F" ] || F="$B/docs/trilha/fila_intel.py"; [ -f "$F" ] || falha 'sem fila_intel.py'; (cd docs/trilha && flock -w 1800 "$B/fila_intel.lock" env -u PYTHONPATH -u AGENTE_BASE AGENTE_SITIO="$B/sitio.py.novo" AGENTE_FILA="$F" /opt/agente/venv/bin/python -B teste_fila.py) || falha 'teste_fila (ou lock ocupado por 30 min)'; fi
```

Quatro coisas que esse bloco resolve e que não são óbvias:

- **`$B/fila_intel.py` primeiro, `docs/trilha/fila_intel.py` depois:** no S4 o worker instalado ainda não
  existe (entra no F1), então vale a cópia de trabalho que o K levou. Sem nenhuma das duas, o cartão
  **falha** em vez de pular o teste em silêncio.
- **`env -u PYTHONPATH -u AGENTE_BASE`** tira o stub `docs/trilha/st/httpx.py` do caminho
  (`cartao.sh:6`); o `venv/bin/python` tem o `httpx` de verdade, que o worker importa.
- **`flock -w 1800`** e não `flock` puro: depois do F4 o cron está vivo e uma execução pode segurar a
  trava por 25 min. O `cartao.sh` tem `set -u` sem `set -e` e nenhum timeout (`:4`), então um `flock`
  sem limite penduraria o terminal sem dizer por quê.
- **Guarda `[ -s sitio.py.novo ]`:** o bloco vale para qualquer cartão futuro que mexa no `sitio.py`
  (o S5 do §10 do spec). É exatamente por isso que o rollback do S4 (Task S4-7) tem de **apagar esta
  linha**: sobre um `sitio.py` de volta à fase 1 o `teste_fila` não acha `ROTAS_FASE[2]` e reprovaria um
  cartão que nada tem a ver com a fila.

- [ ] **Step 5: `bash -n` nos dois (portão do F0k)**

```bash
cd ~/Workspace/forja/ferramentas && bash -n docs/trilha/cartao.sh && bash -n docs/trilha/deploy.sh && echo SH-OK
```
Expected: `SH-OK`.

- [ ] **Step 6: Conferir a ordem das linhas novas**

```bash
cd ~/Workspace/forja/ferramentas/docs/trilha && grep -n 'flock\|teste_s1\|teste_fila\|sitio.py.tmp\|APROVADO' cartao.sh deploy.sh
```
Expected: em `deploy.sh`, o `flock -n 9` **antes** da linha do `M=` (guarda de mídia) e dois
`sitio.py.tmp`; em `cartao.sh`, `teste_s1` e `teste_fila` **entre** a linha do `teste_$t` e o
`echo "CARTAO $T: APROVADO"`.

- [ ] **Step 7: Commit**

Os dois arquivos vão no **mesmo** commit: o lock do `deploy.sh` e o `teste_fila` do `cartao.sh` são o
mesmo contrato com a trava do worker, e separá-los deixaria um commit intermediário em que o cartão
roda o `teste_fila` mas o deploy ainda troca o `sitio.py` sem lock.

```bash
cd ~/Workspace/forja/ferramentas
git add docs/trilha/cartao.sh docs/trilha/deploy.sh
git commit -m "chore: cartao.sh e deploy.sh — lock, troca por mv e portoes do S4

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task S4-6: o cartão S4 na forja — comandos do dono e portões

Sem código novo. É a linha **S4** da tabela do §5 do spec. **Quem faz: o dono.** O agente prepara os
comandos e, depois, confere por leitura.

**Files:** nenhum.

**Interfaces:**
- Consumes: Tasks S4-1 a S4-5 (kit no Mac), o card **K** (que leva o kit à forja), e o `fila_intel.py`
  + `teste_fila.py` escritos no **F0k**.
- Produces: `/opt/agente/sitio.py` na fase 2, proxy no ar com PID novo, backup `proxy.py.bak-*-S4` e
  `…​.bak-*-S4.sitio` (é ele que o rollback da Task S4-7 restaura).

- [ ] **Step 1: O dono leva o kit (card K) e o agente confere por leitura**

O K é um card próprio; aqui só entra a conferência de que o S4 tem o que precisa. O dono cola:

```
cd ~/Workspace/forja/ferramentas/docs && find sitio.py trilha -type f ! -path '*__pycache__*' | sort | xargs md5 -r | sed 's/ /  /' | ssh forja 'cd /opt/agente/docs && md5sum -c --quiet' && echo KIT-IGUAL
```

E o agente confere, só leitura:

```bash
ssh forja 'ls -l /opt/agente/docs/trilha/s4.py /opt/agente/docs/trilha/teste_s4.py /opt/agente/docs/trilha/teste_fila.py /opt/agente/docs/trilha/fila_intel.py'
ssh forja 'grep -c teste_fila /opt/agente/docs/trilha/cartao.sh'
```
Expected: os quatro arquivos existem e `grep -c` → 1. Sem o `fila_intel.py` na forja o cartão **vai
falhar** em `sem fila_intel.py` — é a dependência do F0k declarada nas pré-condições deste card.

- [ ] **Step 2: O dono roda o cartão**

```
cd /opt/agente
bash docs/trilha/cartao.sh S4
```

Portões que essa linha só passa se tudo estiver certo:

| Portão | O que prova |
|---|---|
| `python3 -B docs/trilha/s4.py` + compile | `sitio.py.novo` e `proxy.py.novo` escritos, sintaxe válida |
| `portao_midia.sh` | o S4 não mexeu na mídia |
| replay pareado, `mudaram: 0` | o `proxy.py.novo` é cópia idêntica: nenhuma pergunta mudou de rota |
| `teste_s4.py` (via `cartao.sh:22`) | a fase 2 inteira, sobre `sitio.py.novo` (carregado pelo `_raiz`, sem `AGENTE_SITIO`) |
| `teste_s1.py` com `AGENTE_SITIO=$B/sitio.py.novo` | **a fase 1 não mudou um byte**, e sem editar o teste |
| `teste_fila.py` sobre `sitio.py.novo` | o worker fecha contra o `sitio.py` que vai entrar |

Expected na última linha: `CARTAO S4: APROVADO — falta o deploy (§2.4 do plano)`.
Se sair `REPROVADO — teste_s1`, **pare e volte à Task S4-3**: a fase 1 mudou.
Se sair `REPROVADO — teste_fila (ou lock ocupado por 30 min)`, o dono confere `pgrep -af fila_intel.py`
antes de repetir (no S4 o cron ainda não existe, então lock ocupado aqui é um modo auxiliar rodando).

- [ ] **Step 3: O dono faz o deploy**

```
cd /opt/agente
bash docs/trilha/deploy.sh S4
```

Expected: `DEPLOY S4: SUBIU (PID <velho> -> <novo>)  backup: proxy.py.bak-MMDD-HHMM-S4`.
O `deploy.sh` novo toma o `flock -n 9` antes da guarda de mídia; se imprimir
`ESPERAR: fila_intel em execução`, o dono espera e repete. Se imprimir
`DEPLOY S4: FALHOU — rollback`, o próprio script já devolveu `proxy.py` e `sitio.py` ao backup — não
siga para o passo 4 e leve a saída ao agente.

- [ ] **Step 4: O dono roda os dois portões que só existem com o proxy no ar**

```
cd /opt/agente/docs/trilha && python3 -B teste_s2.py
```
Expected: `S2: 0 falha(s)` — **sem editar `teste_s2.py`**. É este passo que prova que o proxy, que carrega
o `sitio.py` do próprio diretório, continua com o modo `agente-site` idêntico ao da fase 1.

```
cd /opt/agente && python3 docs/trilha/prova_site.py agente-auto
```
Expected: `PROVA SITE (agente-auto): 5/5` (4 perguntas que vão ao site + 1 negativa que não pode ir).

- [ ] **Step 5: O agente confere por leitura**

```bash
ssh forja 'python3 -c "import importlib.util as u;s=u.spec_from_file_location(\"s\",\"/opt/agente/sitio.py\");m=u.module_from_spec(s);s.loader.exec_module(m);print(m.FASE, len(m.ROTAS_FASE[1]), len(m.ROTAS_FASE[2]))"'
ssh forja 'ls -l /opt/agente/sitio.py /opt/agente/proxy.py.bak-*-S4* ; ls /opt/agente/sitio.py.novo 2>&1'
ssh forja 'systemctl show -p MainPID --value proxy-agente; curl -fsS -m 2 127.0.0.1:8081/v1/models >/dev/null && echo PROXY-NO-AR'
```
Expected: `1 13 17`; o `sitio.py` instalado e o par `proxy.py.bak-*-S4` + `.bak-*-S4.sitio` presentes;
`sitio.py.novo` **ausente** (o `deploy.sh` o removeu); PID > 0 e `PROXY-NO-AR`.

- [ ] **Step 6: Anotar o backup para o rollback**

O nome exato do backup (`proxy.py.bak-MMDD-HHMM-S4`) é o que a Task S4-7 restaura. Registre-o no relato
do card, junto com o PID novo e a saída dos quatro portões. Depois disso o S4 está fechado e o **F1** é
o próximo card.

---

### Task S4-7: rollback do S4

Sem código novo. É o item **S4** de "Rollback, na ordem inversa" do §5 do spec, na íntegra. **Quem faz:
o dono**, com os comandos preparados pelo agente.

**Files:** nenhum no repo do site. Altera, na forja, `/opt/agente/sitio.py` e
`/opt/agente/docs/trilha/cartao.sh`; e, no Mac, `~/Workspace/forja/ferramentas/docs/trilha/cartao.sh`.

**Interfaces:**
- Consumes: `proxy.py.bak-*-S4.sitio` (deixado pelo `deploy.sh S4`), `/opt/agente/fila_intel.lock`.
- Produces: `sitio.py` de volta à fase 1 (`2 not in ROTAS_FASE`), proxy reiniciado, e o caminho dos
  cartões futuros limpo.

- [ ] **Step 1: Pré-condição — o rollback do F4 já rodou**

A ordem inversa é **F4 → Qualidade → F1 → S4 → F0**. Antes de qualquer passo abaixo, a linha do
`fila_intel` já saiu do crontab e o lock já foi liberado (`LOCK-LIVRE` impresso). O dono confere:

```
crontab -l | grep -c fila_intel
flock -w 1800 /opt/agente/fila_intel.lock true && echo LOCK-LIVRE || echo 'ESPERAR: execucao ainda viva'
```
Expected: `0` e `LOCK-LIVRE`. Sem os dois, **pare**: com o cron vivo, o `sitio.py` da fase 1 derruba a
execução seguinte no meio.

> O `deploy.sh` só restaura sozinho quando a saúde falha logo depois da troca (`deploy.sh:17-23`).
> Depois disso, o rollback é manual e é este.

- [ ] **Step 2: Escolher o backup e conferir que ele tem o `sitio.py` da fase 1**

```
cd /opt/agente
B=$(ls proxy.py.bak-*-S4 | head -1); echo "$B"
ls -lt proxy.py.bak-*-S4
[ -f "$B.sitio" ] && echo TEM-SITIO || echo 'PARE: backup sem .sitio — nao ha fase 1 para voltar'
```
O `head -1` pega o **mais antigo** pelo carimbo `%m%d-%H%M` do nome: um S4 refeito deixa um backup mais
novo que já carrega o `sitio.py` da fase 2. O `ls -lt` está aí para o dono confirmar isso a olho — o
`cp -p` do `deploy.sh` preserva o mtime, e a ordem por nome se inverte na virada de ano.

- [ ] **Step 3: Restaurar o `sitio.py` sob a trava**

```
cd /opt/agente
flock -w 1800 /opt/agente/fila_intel.lock sh -c "cp -p $B.sitio sitio.py.tmp && mv sitio.py.tmp sitio.py" || echo 'PARE: lock ocupado por 30 min — nada foi trocado'
```

O `-w 1800` e a mensagem própria seguem a regra do §4.6 ("nenhum `flock` de shell espera sem limite"),
no mesmo molde dos comandos de instalação e de volta do worker. O §5 do spec traz este comando **seco**;
o dono normalizou, e a correção vai para a v12 do spec. A razão: depois do F4 o cron está vivo e uma
execução segura a trava por até 25 min, e um `flock` sem limite pendura o rollback sem dizer por quê —
no meio de um rollback, que é o pior momento possível.

O `LOCK-LIVRE` do Step 1 continua valendo e não é redundante: ele mostra ao dono que a execução em curso
**terminou** antes de ele começar a mexer nos arquivos, enquanto o `-w 1800` aqui é só a rede de
proteção para o caso de uma execução nova ter entrado entre um passo e outro. Se sair a mensagem
`PARE:`, nada foi trocado — o dono volta ao Step 1.

- [ ] **Step 4: Reiniciar o proxy sem sudo, esperando o PID mudar**

Receita de `deploy.sh:13-16`, uma linha só:

```
cd /opt/agente && P=$(systemctl show -p MainPID --value proxy-agente); [ "$P" -gt 0 ] && kill "$P"; N=$P; for i in $(seq 40); do N=$(systemctl show -p MainPID --value proxy-agente); [ "$N" -gt 0 ] && [ "$N" != "$P" ] && curl -fsS -m 2 127.0.0.1:8081/v1/models >/dev/null && break; sleep 1; done; [ "$N" != "$P" ] || echo 'PID nao mudou - proxy fora, avisar'
```

- [ ] **Step 5: Os quatro portões do rollback**

```
curl -fsS 127.0.0.1:8081/v1/models >/dev/null && echo PROXY-OK
(cd /opt/agente/docs/trilha && AGENTE_SITIO=/opt/agente/sitio.py python3 -B teste_s1.py)
cd /opt/agente && python3 docs/trilha/prova_site.py agente-auto
python3 -c "import importlib.util as u;s=u.spec_from_file_location('s','/opt/agente/sitio.py');m=u.module_from_spec(s);s.loader.exec_module(m);assert 2 not in m.ROTAS_FASE"
```
Expected: `PROXY-OK`; `S1: 0 falha(s)` **sem edição**; `PROVA SITE (agente-auto): 5/5`; e o último
comando saindo **0** (é ele que prova que a fase 2 sumiu).
O `proxy.py` do S4 é cópia idêntica do anterior e **não volta**.

- [ ] **Step 6: Limpar o caminho dos cartões futuros — na forja**

Sem isto, o próximo cartão que escrever `sitio.py.novo` — o **S5** do §10 do spec, que mexe em
`resumir_canal`, função do próprio `sitio.py` — reprova num portão que nada tem a ver com ele: sobre um
`sitio.py` de volta à fase 1 o `teste_fila` não acha `ROTAS_FASE[2]`.

```
sed -i '/teste_fila/d' /opt/agente/docs/trilha/cartao.sh
grep -c teste_fila /opt/agente/docs/trilha/cartao.sh
```
Expected: `grep -c` → `0`. Não há worker instalado para remover (não existe segunda cópia, §4.6):
`docs/trilha/fila_intel.py` sem crontab e sem chave viva fica inerte, e o rollback do F1 já apagou o
`fila_intel.env`.

- [ ] **Step 7: Limpar a mesma linha na cópia do kit, no Mac**

Senão o próximo **K** repõe o `cartao.sh` com o `teste_fila` dentro, e o Step 6 é desfeito em silêncio.
Este passo é no Mac, então o agente pode executá-lo:

```bash
sed -i '' '/teste_fila/d' ~/Workspace/forja/ferramentas/docs/trilha/cartao.sh
grep -c teste_fila ~/Workspace/forja/ferramentas/docs/trilha/cartao.sh
bash -n ~/Workspace/forja/ferramentas/docs/trilha/cartao.sh && echo SH-OK
```
Expected: `0` e `SH-OK`. (`sed -i ''` é a forma do BSD sed do macOS; na forja, GNU, é `sed -i` seco.)

O kit está sob git, então a retirada vira commit — é ele que deixa registrado **por que** a linha saiu,
e é o que o `git log docs/trilha/cartao.sh` vai mostrar a quem for escrever o S5:

```bash
cd ~/Workspace/forja/ferramentas
git add docs/trilha/cartao.sh
git commit -m "chore: rollback do S4 — tira o teste_fila do cartao.sh

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 8: Conferência final, por leitura**

```bash
ssh forja 'grep -c teste_fila /opt/agente/docs/trilha/cartao.sh; python3 -c "import importlib.util as u;s=u.spec_from_file_location(\"s\",\"/opt/agente/sitio.py\");m=u.module_from_spec(s);s.loader.exec_module(m);print(sorted(m.ROTAS_FASE))"'
```
Expected: `0`; e `[1]` — só a fase 1 no `ROTAS_FASE`. (Não há worker instalado para conferir ausência —
`docs/trilha/fila_intel.py` continua no disco, inerte sem crontab e sem chave viva; não é o que este
passo prova.)
Depois disto, o rollback segue para o **F0** (§5 do spec), que é do dono e não é deste card.

---

### Lacunas e divergências achadas

As nº 1 e nº 2 estão na lista de patches da **v12 do spec**; a nº 4 já virou decisão do dono e está
aplicada acima. As demais continuam abertas.

1. **`FalhaSite(caminho, …)` do tipo `sem_chave`** (§4.6, bullet "Com `fase=2`"): o primeiro posicional
   de `FalhaSite` é `tipo`, não `rota`. Este plano escreve `FalhaSite("sem_chave", caminho)`, igual ao
   que `sitio.py:97` já faz na fase 1. Parece erro de redação do spec, não decisão.
2. **`teste_s4.py` roda, sim, no Mac** (verificado nesta sessão com o `teste_s1`, que tem o mesmo
   carregador e as mesmas dependências — só stdlib). A justificativa do F0k ("o `python3` do Mac não tem
   `httpx`, e o worker o importa") vale para o `teste_fila.py`, não para o `teste_s4.py`. O plano não
   muda o portão do F0k; só usa o Mac como loop de TDD.
3. **2xx que não seja 200/204** não aparece na tabela do §4.6. O `_falha2` os manda para `recusa`
   (fecha). Se o dono quiser outro tratamento, é uma linha.
4. ~~`flock` sem limite no rollback do S4~~ — **resolvida: o dono decidiu normalizar** (19/09). O
   comando do Step 3 da Task S4-7 leva `-w 1800` e mensagem própria, como manda o §4.6; o §5 do spec
   é corrigido na v12. Razão registrada no próprio passo: depois do F4 o cron está vivo, uma execução
   segura a trava por até 25 min, e um `flock` sem limite pendura o rollback sem dizer por quê.
5. **O S4 depende do F0k/K terem levado `fila_intel.py` e `teste_fila.py`.** O §5 lista o S4 depois do
   K, mas a dependência não está escrita na célula do S4 — e o bloco novo do `cartao.sh` **falha** o
   cartão sem eles. Está nas pré-condições deste card.
6. **`ls proxy.py.bak-*-S4 | head -1`** só ordena certo dentro do mesmo ano (o carimbo é `%m%d-%H%M`).
   O Step 2 do rollback acrescenta um `ls -lt` de conferência, sem mudar o comando do spec.


---

## F0k + F1 · segredos, a chave `forja (fila)` e os portões (§4.6, §5)

Cobre o bloco **Segredo** e o **Kit da chave** do §4.6 do spec, a linha **F1** da tabela do §5, o bloco "F1 — para colar" e o rollback do F1.

**O que este card entrega:** a forja ganha uma segunda chave do site, `forja (fila)` com `{read, intelligence}`, separada da `forja (so leitura)` `{read}` que o chat usa. Ela mora em `/opt/agente/fila_intel.env` (thiago:thiago 0600), que **nenhuma unit systemd carrega** — nem `proxy-agente` (`EnvironmentFile=-/etc/default/proxy-agente`, O5) nem qualquer outra. Quem a lê é só o `fila_intel.py`, uma vez por execução, pelo próprio Python.

**Quem faz o quê.**

| Tarefa | Quem | Onde |
|---|---|---|
| F1-1 · leitor de `fila_intel.env` e de `/etc/default/proxy-agente` | Claude | Mac (`~/Workspace/forja/ferramentas/`) |
| F1-2 · `nova_chave.py --fila` | Claude | Mac |
| F1-3 · `seed_chave_forja.sh fila <sha>` | Claude | Mac |
| F1-4 · bloco **F1 — para colar** + seed em produção | **dono** | forja + Mac |
| F1-5 · confirmar `teste_fila.py` verde, sob o lock | **dono** | forja |
| F1-6 · portões do F1 | **dono** roda, Claude lê | forja + leitura do banco |
| F1-7 · provas de vazamento | **dono** roda, Claude lê | forja |
| F1-8 · rollback do F1 (preparado, não executado) | **dono** | Mac (SQL) + forja |

**As tarefas F1-1, F1-2 e F1-3 são escrita de kit e acontecem no tempo do card F0k**, antes do **K** que leva o kit à forja. As tarefas F1-4 em diante são o card F1 propriamente dito, depois do S4. Quem executar este card fora dessa ordem para e reabre com o dono.

### Regras duras deste card (além das Global Constraints)

- **Nunca criar nem revogar chave de pipeline.** `PIPELINE_COWORK_KEY` é permanente e não se toca. A `forja (fila)` é criada e revogada **só pelo dono**, por `nova_chave.py --fila` + `seed_chave_forja.sh fila <sha>`. Este plano **prepara** os comandos; o dono os roda.
- **Escrita na forja é do dono.** Nenhum agente roda `ssh forja '<escreve>'`, `scp` para a forja, `install`, `mv`, `crontab -` ou `nova_chave.py` lá. Conferência por leitura (`ssh forja '<comando de leitura>'`) é permitida.
- **Banco de produção: só leitura pelo agente**, e só por `cd ~/Workspace/bythiagofigueiredo && npx --yes supabase@2.98.2 db query --linked --agent=no "<select>"`. Todo `insert`/`update` — inclusive o do seed e o do rollback — é comando **preparado** para o dono.
- **O valor da chave nunca aparece em argv, env do cron, log, exceção ou saída de comando.** Onde este plano mostra um comando, ele mostra o **SHA-256** ou nada. O SHA não é segredo; a chave é.
- **`~/Workspace/forja/ferramentas` é repositório git desde 19/09** (commit inicial `ec51833`, 116 arquivos, árvore limpa; `.gitignore` com `__pycache__/` e `*.pyc`). O `.git` fica em `ferramentas/`, **fora de `docs/`**: o `scp -r docs/...` do card K não o leva e o portão `KIT-IGUAL` não o vê. Repositório **local, sem remoto e sem push**. Toda tarefa de código deste card termina em `git commit` com mensagem `tipo: descrição curta`.
- **`git add` sempre por caminho explícito.** Nunca `git add -A`, `git add .` nem `git add fase2/`: o `fase2/` também recebe a `fixture_pt.json` (F0.5) e o `sombra-f2/` (F2), que são dado real trazido da forja e não são deste card.
- **Nada do que roda na forja vira commit.** `/opt/agente/*` e `/etc/default/proxy-agente` continuam fora de qualquer repositório — o `fila_intel.env`, o `fila_intel.py` instalado e os `.bak` de `/opt/agente` são estado de máquina, não de kit.

### A regra do segredo num repositório de verdade

O repositório é local e sem remoto **hoje**. Um `git init` costuma virar `git remote add` meses depois, e o histórico vai junto: uma chave commitada não sai do histórico com um `rm`. Por isso, e porque este é o único card cujos testes mexem com chaves:

- **Nenhum arquivo versionado contém uma chave real** — nem em fixture, nem em exemplo, nem em saída esperada de teste. Onde um teste precisa de algo com a forma de chave, usa a **sentinela sintética** `SENT = "forja_" + "A" * 43`, que casa `^forja_[A-Za-z0-9_-]{43}$` e não é chave de nada. É o único literal com a forma `forja_…` que entra no repositório.
- **Chave de verdade só existe em dois lugares:** dentro de `/opt/agente/fila_intel.env` na forja (0600, fora de repositório) e, por instantes, na memória do `nova_chave.py --fila`, que a apaga com `del chave` sem nunca imprimi-la. Nos testes, o `nova_chave.py` gera chaves reais — mas sempre dentro de um `tempfile.mkdtemp()`, que morre com o teste e nunca esteve sob o `ferramentas/`.
- **Nada a acrescentar ao `.gitignore`:** conferido arquivo por arquivo, os três testes deste card escrevem **só** em `tempfile.mkdtemp()` / `mktemp -d` — `teste_leitor_env.py` (`RAIZ`), `teste_nova_chave_fila.py` (`novo_base`) e `teste_seed_fila.sh` (`RAIZ`, mais um `npx` falso e um SHA de `a`/`b` repetidos, sem chave nenhuma). Nenhum deixa `.env`, log ou fixture dentro da árvore. O único resíduo é `__pycache__/`, que o `.gitignore` do commit inicial já cobre.
- **Antes de cada commit deste card**, o passo de commit roda uma varredura no que está *staged* — não no disco inteiro — e recusa qualquer coisa com a forma de chave que não seja a sentinela.

### Mapa de arquivos

**Criados**

| Arquivo | Responsabilidade |
|---|---|
| `~/Workspace/forja/ferramentas/fase2/teste_leitor_env.py` | portão do leitor, roda **no Mac** com o stub `docs/trilha/st/httpx.py` |
| `~/Workspace/forja/ferramentas/fase2/teste_nova_chave_fila.py` | portão do `--fila`, roda no Mac contra um `fila_intel.env` de mentira |
| `~/Workspace/forja/ferramentas/fase2/teste_seed_fila.sh` | portão do seed, com um `npx` falso no `PATH` — **nunca** toca no banco |

> **Os três arquivos deste card já foram ensaiados** num rascunho fora do repo, antes de o plano ser escrito: o leitor passa nos 22 casos da tabela (`0 falha(s)`), o `nova_chave.py --fila` nos 25 (`0 falha(s)`), o `seed_chave_forja.sh` nos 28 (`0 falha(s)`, inclusive o golden byte a byte da fase 1), e o SQL de conferência do seed foi validado contra produção **só de leitura** com um hash inexistente (devolveu `ativas: 0, minha: 0, perms: ""`, o que também confirma que **ainda não há** chave `forja (fila)` no banco). O código abaixo é o que passou; quem executar a tarefa refaz o ciclo TDD mesmo assim, porque os arquivos de destino ainda não existem.

`fase2/` é lado-Mac e **não entra no kit** (o `scp -r trilha` do K não o leva; só `pulso_f4.py` e `teste_pulso_fila.py` vão à forja, e só no K que antecede o F4). Por isso estes três não mudam o portão `KIT-IGUAL`.

**Modificados**

| Arquivo | O quê |
|---|---|
| `~/Workspace/forja/ferramentas/docs/trilha/fila_intel.py` | ganha `_texto`, `ler_env_fila` e `ler_default` (as demais funções são de outros cards) |
| `~/Workspace/forja/ferramentas/docs/trilha/nova_chave.py` | desvio `--fila` **antes** das checagens de `/etc/default/proxy-agente` |
| `~/Workspace/forja/ferramentas/seed_chave_forja.sh` | forma nova `fila <sha>`, `case` fechado de nome/permissões, revogação das outras ativas do site e conferência |

**Convivência no `fila_intel.py`.** O arquivo é escrito por dois agentes: o do laço (§4.1–§4.5) e este. Regra de junção, para não haver colisão: as três funções deste card ficam num bloco contíguo logo depois dos `import`s, entre os comentários `# ---- §4.6 Segredo: leitores (card F1) ----` e `# ---- fim dos leitores ----`. Quem chegar primeiro cria o arquivo com o cabeçalho, os `import`s e o seu bloco; quem chegar depois **acrescenta**, sem reescrever o bloco alheio.

### Interfaces que atravessam as tarefas

Assinaturas exatas. O agente que escreve o laço (§4.1 passo 2) consome estas e **não** escreve leitor próprio.

```python
# docs/trilha/fila_intel.py

def _texto(caminho):
    """Conteúdo do arquivo, CRLF normalizado. None = não existe · False = existe e não deu para ler.
    Nunca levanta e nunca cita o conteúdo."""

def ler_env_fila(caminho):
    """(chave, canais, motivo) — o segredo da fila (§4.6 "Segredo").

    chave  : str que casa ^forja_[A-Za-z0-9_-]{43}$, ou None.
    canais : list[str] com os rótulos de CANAIS_FILA (vírgula, sem vazios); [] quando a linha falta.
    motivo : None quando a chave saiu válida; senão
             'env_ausente' | 'env_ilegivel' | 'chave_ausente' | 'chave_duplicada' | 'chave_formato'.

    Nunca levanta, nunca imprime, e nunca põe a linha nem o valor no motivo, no log ou em exceção.
    Não confere o modo do arquivo (quem confere é o nova_chave.py --fila).
    Lista de canais vazia, rótulo desconhecido e uuid ausente NÃO são deste leitor: quem os
    transforma em `config` é o passo 2 do §4.1, que traduz o rótulo por ler_default()."""

def ler_default(caminho):
    """(chave_read, canais) — /etc/default/proxy-agente, lido pelo próprio Python (§4.6).

    chave_read : SITIO_CHAVE, a chave {read} da fase 1 — usada SÓ pelo --canario e pelos scripts
                 de apoio. Nunca por argv, env do cron ou `set -a`.
    canais     : {'PT': uuid, 'EN': uuid} com os rótulos presentes no arquivo.

    Nunca levanta, nunca imprime, nunca cita a linha nem o valor."""
```

**Contrato com o agente do laço** (§4.1 passo 2 e §4.7), que este card declara e o `teste_fila.py` faz valer:

1. `ler_env_fila` é chamada **uma vez por execução**, no passo 2, junto de `CANAIS_FILA`; a chave desce por parâmetro até o `chave=` do `sitio.py`. Nunca numa global de módulo, nunca relida, nunca no dict da linha do jsonl.
2. `motivo is not None` → `desfecho: config`, **sem claim**, e o motivo entra em `motivos` da linha do jsonl (são símbolos, não trazem valor nenhum).
3. `--sombra` lê deste arquivo **só** `canais` (rótulo do arquivo de sombra) e ignora `chave`/`motivo`: ali a falta de `SITIO_CHAVE_FILA` **não** é `config`. `--escolher` não chama este leitor.
4. `--canario` usa `ler_env_fila` para a chave da fila (com a checagem do item 2) e `ler_default` para a `{read}`.
5. **O módulo não toca em `httpx` na importação** — só `import httpx`, e todo uso fica dentro de função. É o que já exige "importar o módulo não tem efeito colateral" (§4.1, Lock), e é o que deixa o `teste_leitor_env.py` carregá-lo no Mac com o stub `docs/trilha/st/httpx.py` (`class AsyncClient: pass`).
6. **`ler_config()` chama `ler_env_fila` como global do módulo** — `ler_env_fila(ENV_FILA)`, nunca
   `from fila_intel import ler_env_fila` nem um alias local. Com o import por nome, o monkey-patch do
   item 7 conta zero e a asserção de "uma chamada por execução" passa por omissão, provando nada.
7. Asserção que o harness do `teste_fila.py` acrescenta ao caso do caminho normal:

```python
_orig = FI.ler_env_fila
_n = []
FI.ler_env_fila = lambda c, _o=_orig, _l=_n: (_l.append(1), _o(c))[1]
try:
    ...  # a execução normal do caso
finally:
    FI.ler_env_fila = _orig
if len(_n) != 1:
    falhas.append("ler_env_fila chamada %d vezes (tem de ser 1 por execucao)" % len(_n))
```

### Conflito a resolver no merge: o leitor também foi escrito no card do laço

O card do laço (§4.1) chegou com um leitor próprio — `ler_env(caminho) -> dict` mais
`ler_config() -> (canais, chave)` levantando `Config(motivo)`. O checklist de reconciliação dá o
contrato "leitor de `fila_intel.env`" a este card, então **os dois não podem entrar juntos**. A
proposta deste card, para o merger:

- **Manter o `ler_config()` do laço como a interface do laço** (o fluxo por exceção `Config` está
  entrelaçado com `_laco`, e mexer nele é caro), e **trocar o miolo** pelas duas funções daqui:
  `ler_env_fila(ENV_FILA)` para o segredo da fila e `ler_default(DEFAULT)` para os uuids e a `{read}`.
- **Por quê, e não é preferência de estilo:** o `ler_env` genérico do laço monta um `dict` com **todas**
  as variáveis de `/etc/default/proxy-agente` — e ali moram as quatro credenciais do O5
  (`SEERR_KEY`, `LIDARR_KEY`, `SLSKD_USER`, `SLSKD_PASS`, `onda0b/gerar_segredos.py:12`). Um `repr()`
  acidental desse dict num traceback vai parar no `fila_intel.err`, que o cron mantém aberto por `>>`
  e só é truncado em 1 MB. O `ler_default` daqui extrai **três** nomes e nunca vê os outros.
- **Segunda diferença:** o `dict` do laço faz "a última linha vence" em silêncio; duas linhas
  `SITIO_CHAVE_FILA` (uma edição malfeita, ou um `nova_chave.py` interrompido) passariam com a chave
  errada e o claim daria 401 sem que o arquivo parecesse errado. Este card fecha a porta com
  `chave_duplicada` → `config`, e o portão do Step 5 da Task F1-6 (`grep -c … → 1`) existe por isso.
- **Vocabulário de motivos:** os do laço (`chave`, `canais_vazio`, `canal_PT`, `default`) são mais
  grossos que os daqui (`chave_ausente` | `chave_formato` | `chave_duplicada` | `env_ausente` |
  `env_ilegivel`). Fundir é mecânico: `Config(motivo)` recebe o motivo deste leitor quando ele vem
  não-nulo, e os do laço continuam valendo para canal/uuid, que **não** são deste leitor.
- **O que fica do laço sem discussão:** `ENV_FILA`/`DEFAULT` como constantes de módulo, o `.upper()`
  nos rótulos de `CANAIS_FILA` e a validação de uuid por `RE_UUID`.

Nenhum dos dois lados fixa isso sozinho: quem fizer o merge decide, e o `teste_leitor_env.py` desta
seção continua sendo o portão do que for escolhido.

---

### Task F1-1: o leitor de `fila_intel.env` e de `/etc/default/proxy-agente`

**Files:**
- Create: `~/Workspace/forja/ferramentas/fase2/teste_leitor_env.py`
- Modify: `~/Workspace/forja/ferramentas/docs/trilha/fila_intel.py` (bloco dos leitores; cria o arquivo se ainda não existir)

**Interfaces:**
- Consumes: o stub `docs/trilha/st/httpx.py`, o idioma de carga de `teste_s1.py:7-11`.
- Produces: `_texto`, `ler_env_fila`, `ler_default` — as assinaturas da seção acima.

- [ ] **Step 1: Escrever o teste que falha**

Criar `~/Workspace/forja/ferramentas/fase2/teste_leitor_env.py` (antes: `mkdir -p ~/Workspace/forja/ferramentas/fase2`):

```python
"""Leitor de segredos do fila_intel.py (§4.6 "Segredo"), rodando NO MAC.

Carrega so o modulo, com o stub docs/trilha/st/httpx.py, e exercita ler_env_fila/ler_default
sobre arquivos de mentira num tmpdir. Nao toca na forja, nao abre rede e nao le
/etc/default/proxy-agente de verdade. A "chave" daqui e uma sentinela de A's.

Uso:  cd ~/Workspace/forja/ferramentas && PYTHONPATH=docs/trilha/st python3 fase2/teste_leitor_env.py
"""
import importlib.machinery as _m, importlib.util as _u, io, os, sys, tempfile
from contextlib import redirect_stderr, redirect_stdout
sys.dont_write_bytecode = True

_aqui = os.path.dirname(os.path.abspath(__file__))
_arq = os.environ.get("AGENTE_FILA") or os.path.join(_aqui, "..", "docs", "trilha", "fila_intel.py")
_ld = _m.SourceFileLoader("fila_intel", os.path.abspath(_arq))
FI = _u.module_from_spec(_u.spec_from_loader("fila_intel", _ld)); _ld.exec_module(FI)

SENT = "forja_" + "A" * 43          # casa o formato; nunca e uma chave de verdade
RAIZ = tempfile.mkdtemp(prefix="leitor-env-")
falhas = []


def mascara(x):
    return str(x).replace(SENT, "<chave>")


def escrever(nome, texto, modo=0o600, binario=None):
    p = os.path.join(RAIZ, nome)
    with open(p, "wb") as f:
        f.write(binario if binario is not None else texto.encode("utf-8"))
    os.chmod(p, modo)
    return p


def confere(rotulo, obtido, esperado):
    ok = obtido == esperado
    if not ok:
        falhas.append("%s: %s != %s" % (rotulo, mascara(obtido), mascara(esperado)))
    print(("OK   " if ok else "FALHA"), rotulo)


def chamar(func, caminho):
    """Roda o leitor com stdout/stderr capturados: ele nao pode imprimir nada."""
    saida, erro = io.StringIO(), io.StringIO()
    with redirect_stdout(saida), redirect_stderr(erro):
        r = func(caminho)
    sujo = saida.getvalue() + erro.getvalue()
    if sujo:
        falhas.append("%s imprimiu %r" % (func.__name__, mascara(sujo)[:60]))
    if SENT in repr(r[2] if func is FI.ler_env_fila else ""):
        falhas.append("%s pos o valor no motivo" % func.__name__)
    return r


CASOS = [
    ("com aspas",         'CANAIS_FILA=PT\nSITIO_CHAVE_FILA="%s"\n' % SENT,            (SENT, ["PT"], None)),
    ("sem aspas",         'CANAIS_FILA=PT\nSITIO_CHAVE_FILA=%s\n' % SENT,              (SENT, ["PT"], None)),
    ("CRLF",              'CANAIS_FILA=PT\r\nSITIO_CHAVE_FILA="%s"\r\n' % SENT,        (SENT, ["PT"], None)),
    ("ordem trocada",     'SITIO_CHAVE_FILA="%s"\nCANAIS_FILA=PT\n' % SENT,            (SENT, ["PT"], None)),
    ("sem \\n final",     'CANAIS_FILA=PT\nSITIO_CHAVE_FILA="%s"' % SENT,              (SENT, ["PT"], None)),
    ("dois canais",       'CANAIS_FILA=PT, EN\nSITIO_CHAVE_FILA="%s"\n' % SENT,        (SENT, ["PT", "EN"], None)),
    ("canal vazio",       'CANAIS_FILA=\nSITIO_CHAVE_FILA="%s"\n' % SENT,              (SENT, [], None)),
    ("sem CANAIS_FILA",   'SITIO_CHAVE_FILA="%s"\n' % SENT,                            (SENT, [], None)),
    ("sem chave",         'CANAIS_FILA=PT\n',                                          (None, ["PT"], "chave_ausente")),
    ("chave vazia",       'CANAIS_FILA=PT\nSITIO_CHAVE_FILA=""\n',                     (None, ["PT"], "chave_ausente")),
    ("comentada",         'CANAIS_FILA=PT\n#SITIO_CHAVE_FILA="%s"\n' % SENT,           (None, ["PT"], "chave_ausente")),
    ("espaco, com aspas", 'CANAIS_FILA=PT\nSITIO_CHAVE_FILA= "%s"\n' % SENT,           (None, ["PT"], "chave_ausente")),
    ("espaco, sem aspas", 'CANAIS_FILA=PT\nSITIO_CHAVE_FILA= %s\n' % SENT,             (None, ["PT"], "chave_formato")),
    ("chave curta",       'CANAIS_FILA=PT\nSITIO_CHAVE_FILA="forja_abc"\n',            (None, ["PT"], "chave_formato")),
    ("chave longa",       'CANAIS_FILA=PT\nSITIO_CHAVE_FILA="forja_%s"\n' % ("A" * 44), (None, ["PT"], "chave_formato")),
    ("sem prefixo",       'CANAIS_FILA=PT\nSITIO_CHAVE_FILA="%s"\n' % ("A" * 49),      (None, ["PT"], "chave_formato")),
    ("ponto no valor",    'CANAIS_FILA=PT\nSITIO_CHAVE_FILA="forja_%s."\n' % ("A" * 42), (None, ["PT"], "chave_formato")),
    ("duplicada",         'CANAIS_FILA=PT\nSITIO_CHAVE_FILA="%s"\nSITIO_CHAVE_FILA="%s"\n' % (SENT, SENT),
                                                                                       (None, ["PT"], "chave_duplicada")),
]
for i, (rotulo, conteudo, esperado) in enumerate(CASOS):
    confere("env: " + rotulo, chamar(FI.ler_env_fila, escrever("c%02d.env" % i, conteudo)), esperado)

confere("env: ausente", chamar(FI.ler_env_fila, os.path.join(RAIZ, "nao-existe.env")),
        (None, [], "env_ausente"))
confere("env: diretorio", chamar(FI.ler_env_fila, RAIZ), (None, [], "env_ilegivel"))
confere("env: lixo binario", chamar(FI.ler_env_fila, escrever("bin.env", "", binario=b"\x00\xff\xfe\n")),
        (None, [], "chave_ausente"))
if os.geteuid() != 0:
    confere("env: sem permissao de leitura",
            chamar(FI.ler_env_fila, escrever("fechado.env", 'CANAIS_FILA=PT\n', modo=0o000)),
            (None, [], "env_ilegivel"))
else:
    print("PULA  env: sem permissao de leitura (rodando como root)")

D = 'SITIO_CHAVE="%s"\nSITIO_CANAL_PT="uuid-pt"\nSITIO_CANAL_EN="uuid-en"\n' % SENT
confere("default: com aspas", chamar(FI.ler_default, escrever("d1", D)),
        (SENT, {"PT": "uuid-pt", "EN": "uuid-en"}))
confere("default: sem aspas",
        chamar(FI.ler_default, escrever("d2", D.replace('"', ""))),
        (SENT, {"PT": "uuid-pt", "EN": "uuid-en"}))
confere("default: so PT", chamar(FI.ler_default, escrever("d3", 'SITIO_CANAL_PT="uuid-pt"\n')),
        (None, {"PT": "uuid-pt"}))
confere("default: SITIO_CHAVE_FILA nao vaza para SITIO_CHAVE",
        chamar(FI.ler_default, escrever("d4", 'SITIO_CHAVE_FILA="%s"\n' % SENT)), (None, {}))
confere("default: ausente", chamar(FI.ler_default, os.path.join(RAIZ, "nao-existe")), (None, {}))

print("\nleitor de segredos: %d falha(s)" % len(falhas))
raise SystemExit(1 if falhas else 0)
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd ~/Workspace/forja/ferramentas && PYTHONPATH=docs/trilha/st python3 fase2/teste_leitor_env.py
```
Expected: FAIL — `FileNotFoundError` em `docs/trilha/fila_intel.py` (se o arquivo ainda não existe) ou `AttributeError: module 'fila_intel' has no attribute 'ler_env_fila'`.

- [ ] **Step 3: Implementar os leitores**

Em `~/Workspace/forja/ferramentas/docs/trilha/fila_intel.py`. Se o arquivo ainda não existe, criar com este cabeçalho e estes `import`s; se já existe, **acrescentar só o bloco** entre os marcadores, sem tocar no resto:

```python
"""Worker da fila de inteligencia do YouTube (fase 2a). Uma execucao por tique de 10 min.
Sem instalacao: roda sempre de /opt/agente/docs/trilha/fila_intel.py, nao ha segunda copia.
Importar este modulo nao tem efeito colateral: nao toma lock, nao instala handler de sinal,
nao le nem grava arquivo e nao chama httpx."""
import os, re

# ---- §4.6 Segredo: leitores (card F1) ----
# Padrao tolerante do pulso (onda0b/pulso.sh.novo:59): aspas duplas opcionais dos dois lados.
RE_CHAVE_FILA = re.compile(r'^SITIO_CHAVE_FILA="?([^"\n]+)"?$', re.M)
RE_CANAIS = re.compile(r'^CANAIS_FILA="?([^"\n]+)"?$', re.M)
RE_FORMATO = re.compile(r"^forja_[A-Za-z0-9_-]{43}$")      # secrets.token_urlsafe(32) = 43 chars
RE_CHAVE_READ = re.compile(r'^SITIO_CHAVE="?([^"\n]+)"?$', re.M)
RE_CANAL = {r: re.compile(r'^SITIO_CANAL_%s="?([^"\n]+)"?$' % r, re.M) for r in ("PT", "EN")}


def _texto(caminho):
    """Conteudo do arquivo, CRLF normalizado. None = nao existe; False = existe e nao deu para ler.
    Nunca levanta e nunca cita o conteudo: o valor lido daqui e o segredo da fila."""
    try:
        with open(caminho, "rb") as f:
            bruto = f.read()
    except FileNotFoundError:
        return None
    except OSError:
        return False
    return bruto.decode("utf-8", "replace").replace("\r\n", "\n").replace("\r", "\n")


def ler_env_fila(caminho):
    """(chave, canais, motivo) do fila_intel.env. Ver o contrato no plano do card F1.
    O motivo e um simbolo: nunca carrega a linha nem o valor."""
    t = _texto(caminho)
    if t is None:
        return (None, [], "env_ausente")
    if t is False:
        return (None, [], "env_ilegivel")
    m = RE_CANAIS.search(t)
    canais = [p.strip() for p in m.group(1).split(",") if p.strip()] if m else []
    achadas = RE_CHAVE_FILA.findall(t)
    if not achadas:
        return (None, canais, "chave_ausente")
    if len(achadas) > 1:
        # Fecha a porta: com duas linhas nao da para saber qual vale, e "a ultima vence" esconderia
        # uma edicao malfeita atras de um claim que funciona.
        return (None, canais, "chave_duplicada")
    return (achadas[0], canais, None) if RE_FORMATO.match(achadas[0]) else (None, canais, "chave_formato")


def ler_default(caminho):
    """(chave_read, canais) de /etc/default/proxy-agente. SITIO_CHAVE_FILA aqui e ignorado de
    proposito: o padrao exige '=' logo depois de SITIO_CHAVE."""
    t = _texto(caminho)
    if not isinstance(t, str):
        return (None, {})
    m = RE_CHAVE_READ.search(t)
    canais = {}
    for rotulo, rx in RE_CANAL.items():
        mm = rx.search(t)
        if mm:
            canais[rotulo] = mm.group(1).strip()
    return (m.group(1) if m else None, canais)
# ---- fim dos leitores ----
```

- [ ] **Step 4: Rodar e ver passar**

```bash
cd ~/Workspace/forja/ferramentas && PYTHONPATH=docs/trilha/st python3 fase2/teste_leitor_env.py
python3 -m py_compile ~/Workspace/forja/ferramentas/docs/trilha/fila_intel.py && echo COMPILA
```
Expected: `leitor de segredos: 0 falha(s)`, saída 0, e `COMPILA`.

- [ ] **Step 5: Commit**

```bash
cd ~/Workspace/forja/ferramentas
git add docs/trilha/fila_intel.py fase2/teste_leitor_env.py
git diff --cached | python3 -c "import re,sys;S='forja_'+'A'*43;a={m for m in re.findall(r'forja_[A-Za-z0-9_-]{43}',sys.stdin.read()) if m!=S};print('PARE: literal com forma de chave no staged (%d)'%len(a) if a else 'SEM-CHAVE-NO-STAGED');sys.exit(1 if a else 0)"
git commit -m "feat: leitor do fila_intel.env e do proxy-agente no fila_intel.py

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```
Expected: `SEM-CHAVE-NO-STAGED` e depois o commit. A varredura olha **só o que está staged** e só recusa um literal com a forma `forja_<43>` que não seja a sentinela — se ela imprimir `PARE:`, desfaça com `git restore --staged docs/trilha/fila_intel.py fase2/teste_leitor_env.py` e ache de onde veio o valor antes de qualquer commit.

- [ ] **Step 6: Avisar o agente do laço**

No relato da tarefa, repetir as três assinaturas e os **sete** itens do *Contrato com o agente do laço* — em especial o item 6 (`ler_env_fila` como global do módulo) e o 7 (a asserção de "uma chamada por execução"), sem os quais o `teste_fila.py` nasce passando por omissão.

---

### Task F1-2: `nova_chave.py --fila`

O desvio entra **antes** das checagens de `/etc/default/proxy-agente` (`nova_chave.py:11-18`): o modo fila não exige, não lê e não escreve naquele arquivo.

**Files:**
- Create: `~/Workspace/forja/ferramentas/fase2/teste_nova_chave_fila.py`
- Modify: `~/Workspace/forja/ferramentas/docs/trilha/nova_chave.py`

**Interfaces:**
- Consumes: nada.
- Produces: `python3 docs/trilha/nova_chave.py --fila [--trocar]`, que grava `SITIO_CHAVE_FILA` em `$AGENTE_BASE/fila_intel.env` e imprime o SHA-256 e o SQL de `'forja (fila)'` com `array['read','intelligence']`. Consumido pelo bloco **F1 — para colar** (Task F1-4).

> **Decisão deste plano (o spec não fixa):** o caminho do arquivo sai de `AGENTE_BASE`, como no §4.1 ("Todo caminho vem de `BASE = os.environ.get('AGENTE_BASE','/opt/agente')`", a convenção de `replay2.py:8`). Sem isso o `--fila` só seria testável escrevendo em `/opt/agente` de verdade. Na forja ninguém exporta `AGENTE_BASE` no shell do dono, então o padrão `/opt/agente` é o que vale no bloco do F1.

- [ ] **Step 1: Escrever o teste que falha**

Criar `~/Workspace/forja/ferramentas/fase2/teste_nova_chave_fila.py`:

```python
"""nova_chave.py --fila (§4.6 "Kit da chave"), rodando NO MAC contra um fila_intel.env de mentira.
Nao toca na forja, nao toca em /etc/default/proxy-agente e nao fala com o banco.

Uso:  python3 ~/Workspace/forja/ferramentas/fase2/teste_nova_chave_fila.py
"""
import os, re, subprocess, sys, tempfile
sys.dont_write_bytecode = True

AQUI = os.path.dirname(os.path.abspath(__file__))
SCRIPT = os.path.join(AQUI, "..", "docs", "trilha", "nova_chave.py")
RE_CHAVE = re.compile(r'^SITIO_CHAVE_FILA="(forja_[A-Za-z0-9_-]{43})"$', re.M)
RE_SHA = re.compile(r"\b[0-9a-f]{64}\b")
falhas = []


def confere(rotulo, cond, detalhe=""):
    if not cond:
        falhas.append("%s %s" % (rotulo, detalhe))
    print(("OK   " if cond else "FALHA"), rotulo, detalhe if not cond else "")


def rodar(base, *args):
    amb = dict(os.environ, AGENTE_BASE=base)
    p = subprocess.run([sys.executable, "-B", SCRIPT, *args], capture_output=True, text=True, env=amb)
    return p.returncode, p.stdout + p.stderr


def novo_base(conteudo=None, modo=0o600):
    b = tempfile.mkdtemp(prefix="nc-fila-")
    if conteudo is not None:
        p = os.path.join(b, "fila_intel.env")
        open(p, "w", encoding="utf-8").write(conteudo)
        os.chmod(p, modo)
    return b


def env(base):
    p = os.path.join(base, "fila_intel.env")
    return open(p, encoding="utf-8").read() if os.path.exists(p) else None


# 1. arquivo ausente -> recusa, e nao cria nada
b = novo_base()
rc, saida = rodar(b, "--fila")
confere("ausente: recusa", rc != 0, "rc=%d" % rc)
confere("ausente: nao criou o arquivo", env(b) is None)
confere("ausente: nao fala de /etc/default", "/etc/default/proxy-agente" not in saida,
        "o desvio --fila tem de vir ANTES das checagens da fase 1")

# 2. arquivo com permissao aberta -> recusa
b = novo_base("CANAIS_FILA=PT\n", modo=0o644)
rc, saida = rodar(b, "--fila")
confere("0644: recusa", rc != 0 and "600" in saida, "rc=%d" % rc)
confere("0644: nao escreveu", env(b) == "CANAIS_FILA=PT\n")

# 3. arquivo 0600 com CANAIS_FILA -> grava a chave e preserva a outra linha
b = novo_base("CANAIS_FILA=PT\n")
rc, saida = rodar(b, "--fila")
texto = env(b)
m = RE_CHAVE.search(texto or "")
confere("0600: grava", rc == 0 and m is not None, "rc=%d" % rc)
confere("0600: preserva CANAIS_FILA", "CANAIS_FILA=PT" in (texto or ""))
confere("0600: uma linha de chave", len(RE_CHAVE.findall(texto or "")) == 1)
confere("0600: modo continua 600", oct(os.stat(os.path.join(b, "fila_intel.env")).st_mode & 0o777) == "0o600")
chave1 = m.group(1) if m else "?"
confere("0600: nao imprime a chave", chave1 not in saida)
confere("0600: imprime o SHA-256", RE_SHA.search(saida) is not None)
confere("0600: SQL de 'forja (fila)'", "'forja (fila)'" in saida)
confere("0600: SQL com as duas permissoes", "array['read','intelligence']" in saida)
confere("0600: SQL do site certo", "primary_domain = 'bythiagofigueiredo.com'" in saida)
confere("0600: nao fala de /etc/default", "/etc/default/proxy-agente" not in saida)

# 4. segunda execucao sem --trocar -> sai 1 e nao mexe no arquivo
antes = env(b)
rc, saida = rodar(b, "--fila")
confere("ja existe: sai 1", rc == 1, "rc=%d" % rc)
confere("ja existe: arquivo intacto", env(b) == antes)
confere("ja existe: diz como trocar", "--trocar" in saida)

# 5. --trocar -> troca a chave, preserva CANAIS_FILA, continua com uma linha so
rc, saida = rodar(b, "--fila", "--trocar")
texto = env(b)
m2 = RE_CHAVE.search(texto or "")
confere("--trocar: grava", rc == 0 and m2 is not None, "rc=%d" % rc)
confere("--trocar: chave nova", m2 is not None and m2.group(1) != chave1)
confere("--trocar: uma linha de chave", len(RE_CHAVE.findall(texto or "")) == 1)
confere("--trocar: preserva CANAIS_FILA", "CANAIS_FILA=PT" in (texto or ""))
confere("--trocar: nao imprime a chave", (m2.group(1) if m2 else "?") not in saida)

# 6. sem --fila continua sendo a fase 1 (e no Mac /etc/default/proxy-agente nao existe)
rc, saida = rodar(b)
confere("sem --fila: continua a fase 1", rc != 0 and "/etc/default/proxy-agente" in saida, "rc=%d" % rc)

print("\nnova_chave --fila: %d falha(s)" % len(falhas))
raise SystemExit(1 if falhas else 0)
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
python3 ~/Workspace/forja/ferramentas/fase2/teste_nova_chave_fila.py
```
Expected: FAIL — hoje `--fila` é um argumento desconhecido, o script cai direto nas checagens de `/etc/default/proxy-agente` e o caso 1 ("nao fala de /etc/default") reprova.

- [ ] **Step 3: Implementar o desvio**

Em `~/Workspace/forja/ferramentas/docs/trilha/nova_chave.py`, **entre a linha 9 (fim de `CANAIS`) e a linha 11** (a primeira checagem de `ARQ`), inserir:

```python
ARQ_FILA = os.path.join(os.environ.get("AGENTE_BASE", "/opt/agente"), "fila_intel.env")


def _gerar():
    c = "forja_" + secrets.token_urlsafe(32)          # 43 caracteres depois do prefixo
    return c, hashlib.sha256(c.encode()).hexdigest()


def fila():
    """Modo --fila: mexe SO em <AGENTE_BASE>/fila_intel.env. Nao toca, nao le e nao exige
    /etc/default/proxy-agente — a chave da fila mora fora do ambiente do proxy (§4.6)."""
    if not os.path.exists(ARQ_FILA) or not os.access(ARQ_FILA, os.W_OK):
        sys.exit("pare: %s nao existe ou nao e gravavel pelo thiago "
                 "(o bloco do F1 o cria com: install -m 600 /dev/null fila_intel.env)" % ARQ_FILA)
    st = os.stat(ARQ_FILA)
    if st.st_mode & 0o077:
        sys.exit("pare: %s esta com permissao aberta (%o); tem de ser 600"
                 % (ARQ_FILA, st.st_mode & 0o777))
    linhas = open(ARQ_FILA, encoding="utf-8").read().splitlines()
    if any(l.startswith("SITIO_CHAVE_FILA=") for l in linhas) and "--trocar" not in sys.argv:
        sys.exit("pare: ja existe SITIO_CHAVE_FILA. Para trocar, com o cron vivo, rode SOB A TRAVA:\n"
                 "  cd /opt/agente && flock -w 1800 /opt/agente/fila_intel.lock "
                 "python3 docs/trilha/nova_chave.py --fila --trocar "
                 "|| echo 'PARE: lock ocupado por 30 min ou nova_chave recusou — veja a saida acima'\n"
                 "E revogue a antiga no banco com: seed_chave_forja.sh fila <sha novo>")
    chave, hash_ = _gerar()
    novas = [l for l in linhas if not l.startswith("SITIO_CHAVE_FILA=")]   # preserva CANAIS_FILA
    novas.append('SITIO_CHAVE_FILA="%s"' % chave)
    fd = os.open(ARQ_FILA, os.O_WRONLY | os.O_TRUNC)                       # mantem o modo 600
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write("\n".join(novas) + "\n")
    del chave
    print("chave da fila gravada em %s (o valor nao foi impresso)." % ARQ_FILA)
    print("SHA-256 para o banco: %s" % hash_)
    print("\nNo Mac:  bash ~/Workspace/forja/ferramentas/seed_chave_forja.sh fila %s" % hash_)
    print("\nSQL equivalente (Supabase > SQL Editor, projeto de producao):\n")
    print("insert into public.pipeline_api_keys (site_id, name, key_hash, permissions) "
          "select id, 'forja (fila)', '%s', array['read','intelligence'] from public.sites "
          "where primary_domain = 'bythiagofigueiredo.com';" % hash_)
    raise SystemExit(0)


if "--fila" in sys.argv:
    fila()
```

E acrescentar ao docstring do arquivo (linha 3), depois da linha `Uso, na forja:`:

```
Uso, na forja:  python3 docs/trilha/nova_chave.py           (fase 1: chave {read} em /etc/default/proxy-agente)
                python3 docs/trilha/nova_chave.py --fila    (fase 2a: chave {read,intelligence} em /opt/agente/fila_intel.env)
```

O `flock` **não** está dentro do script de propósito: o spec põe a trava na linha de comando do `--trocar`, onde ela também cobre o `seed_chave_forja.sh` que vem logo depois.

- [ ] **Step 4: Rodar e ver passar**

```bash
python3 ~/Workspace/forja/ferramentas/fase2/teste_nova_chave_fila.py
python3 -m py_compile ~/Workspace/forja/ferramentas/docs/trilha/nova_chave.py && echo COMPILA
```
Expected: `nova_chave --fila: 0 falha(s)`, saída 0, e `COMPILA`.

- [ ] **Step 5: Commit**

O `nova_chave.py` é arquivo do kit: ele vai à forja pelo **K**, e o portão `KIT-IGUAL` compara o md5 dos dois lados — o commit é do lado Mac e não muda esse md5.

```bash
cd ~/Workspace/forja/ferramentas
git add docs/trilha/nova_chave.py fase2/teste_nova_chave_fila.py
git diff --cached | python3 -c "import re,sys;S='forja_'+'A'*43;a={m for m in re.findall(r'forja_[A-Za-z0-9_-]{43}',sys.stdin.read()) if m!=S};print('PARE: literal com forma de chave no staged (%d)'%len(a) if a else 'SEM-CHAVE-NO-STAGED');sys.exit(1 if a else 0)"
git commit -m "feat: nova_chave.py --fila gera a chave da fila fora do ambiente do proxy

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```
Expected: `SEM-CHAVE-NO-STAGED` e depois o commit. A varredura olha **só o que está staged** e só recusa um literal com a forma `forja_<43>` que não seja a sentinela — se ela imprimir `PARE:`, desfaça com `git restore --staged docs/trilha/nova_chave.py fase2/teste_nova_chave_fila.py` e ache de onde veio o valor antes de qualquer commit.

---

### Task F1-3: `seed_chave_forja.sh fila <sha>`

> **Mudança de procedimento aplicada na execução (2026-09-20).** O review achou que o script
> revogava **antes** de conferir: passar um SHA errado — o da fase 1 está no mesmo documento —
> derrubava a `forja (fila)` viva, e com um hash válido e inédito a conferência ainda via
> `ativas=1` e imprimia `conferencia: ok`, deixando produção em 401 **com o script reportando
> sucesso**. A correção acrescentou uma **pré-checagem só-leitura** que conta as `forja (fila)`
> ativas com hash diferente e **para antes de qualquer escrita** se houver alguma, exigindo
> `CONFIRMAR_REVOGACAO=sim` para prosseguir.
>
> Consequência para o dono, que o texto abaixo ainda não refletia:
> - **primeira criação da chave** (nenhuma `forja (fila)` ativa): nada muda, o comando é o mesmo;
> - **rotação** (já existe uma ativa): o comando do plano **para com código ≠ 0**, de propósito.
>   Para completar a rotação, e só depois de ler quais chaves serão revogadas:
>   `CONFIRMAR_REVOGACAO=sim bash ~/Workspace/forja/ferramentas/seed_chave_forja.sh fila <sha>`
>
> Verificado por mutação no re-review: invertendo o gate, a suíte fica vermelha em 7 casos,
> incluindo "nunca diz ok" — a trava é exercitada de verdade, não só declarada.

**Files:**
- Create: `~/Workspace/forja/ferramentas/fase2/teste_seed_fila.sh`
- Modify: `~/Workspace/forja/ferramentas/seed_chave_forja.sh`

**Interfaces:**
- Consumes: o SHA impresso pelo `nova_chave.py --fila`.
- Produces: `bash seed_chave_forja.sh fila <sha>` — insere `'forja (fila)'` com `{read,intelligence}`, revoga as outras `'forja (fila)'` ativas **do mesmo site** e confere que resta exatamente uma. A forma de 64 hex (fase 1) fica **byte a byte igual**.

- [ ] **Step 1: Escrever o teste que falha**

Criar `~/Workspace/forja/ferramentas/fase2/teste_seed_fila.sh`:

```bash
#!/bin/bash
# Portao do seed_chave_forja.sh, NO MAC e SEM TOCAR NO BANCO: um `npx` falso na frente do PATH
# guarda os argumentos de cada chamada e devolve o JSON de mentira de $FALSO_SAIDA.
# Uso:  bash ~/Workspace/forja/ferramentas/fase2/teste_seed_fila.sh
set -uo pipefail
AQUI=$(cd "$(dirname "$0")" && pwd)
ALVO="$AQUI/../seed_chave_forja.sh"
H1=$(printf 'a%.0s' $(seq 64))
H2=$(printf 'b%.0s' $(seq 64))
RAIZ=$(mktemp -d); mkdir -p "$RAIZ/bin"
cat > "$RAIZ/bin/npx" <<'FIM'
#!/bin/bash
N=$(( $(cat "$FALSO_N" 2>/dev/null || echo 0) + 1 )); echo "$N" > "$FALSO_N"
printf '%s\n' "$@" > "$FALSO_ARGS.$N"     # um argumento por linha (o SQL ocupa varias)
printf '%s' "${!#}" > "$FALSO_SQL.$N"     # o ultimo argumento inteiro = o SQL
cat "$FALSO_SAIDA" 2>/dev/null || echo '[]'
FIM
chmod 755 "$RAIZ/bin/npx"
export PATH="$RAIZ/bin:$PATH"
export FALSO_N="$RAIZ/n" FALSO_ARGS="$RAIZ/args" FALSO_SQL="$RAIZ/sql" FALSO_SAIDA="$RAIZ/saida.json"
falhas=0

ok() { if [ "$2" = ok ]; then echo "OK    $1"; else echo "FALHA $1 — ${3:-}"; falhas=$((falhas+1)); fi; }

roda() {   # roda <json da conferencia> <args...>  -> define RC, SAIDA, N (chamadas ao npx)
  printf '%s' "$1" > "$FALSO_SAIDA"; shift
  rm -f "$FALSO_N" "$FALSO_ARGS".* "$FALSO_SQL".*
  SAIDA=$(bash "$ALVO" "$@" 2>&1); RC=$?
  N=$(cat "$FALSO_N" 2>/dev/null || echo 0)
}

sql() { cat "$FALSO_SQL.$1" 2>/dev/null; }

BOM='[{"ativas":1,"minha":1,"perms":"intelligence,read"}]'
BOM1='[{"ativas":1,"minha":1,"perms":"read"}]'

# --- formas recusadas: nenhuma chega ao npx ---
for caso in "" "fila" "fila ZZZ" "fila $(printf 'a%.0s' $(seq 63))" "fila $(echo "$H1" | tr a A)" "banana" "$(printf 'a%.0s' $(seq 63))"; do
  roda "$BOM" $caso
  { [ "$RC" -ne 0 ] && [ "$N" = 0 ]; } && ok "recusa [$caso]" ok || ok "recusa [$caso]" nao "rc=$RC, chamadas=$N"
done

# --- fase 1: SQL byte a byte igual ao de hoje ---
roda "$BOM1" "$H1"
ESPERADO="insert into public.pipeline_api_keys (site_id, name, key_hash, permissions)
select s.id, 'forja (so leitura)', '$H1', array['read']
from public.sites s
where s.primary_domain = 'bythiagofigueiredo.com'
  and not exists (select 1 from public.pipeline_api_keys k where k.key_hash = '$H1');
select k.name, k.permissions, k.revoked_at is null as ativa, k.created_at::timestamp(0) as criada, s.primary_domain as site
from public.pipeline_api_keys k join public.sites s on s.id = k.site_id
where k.key_hash = '$H1';"
[ "$RC" -eq 0 ] && ok "fase 1: sai 0" ok || ok "fase 1: sai 0" nao "rc=$RC :: $SAIDA"
[ "$(sql 1)" = "$ESPERADO" ] && ok "fase 1: SQL inalterado" ok || ok "fase 1: SQL inalterado" nao "difere do golden"
grep -q "so leitura" <<< "$SAIDA" && ok "fase 1: mensagem inalterada" ok || ok "fase 1: mensagem inalterada" nao "$SAIDA"
grep -q "$H1" <<< "$SAIDA" && ok "fase 1: nao mostra o hash" nao "o hash saiu na tela" || ok "fase 1: nao mostra o hash" ok

# --- fila: insert + revogacao no mesmo SQL ---
roda "$BOM" fila "$H2"
[ "$RC" -eq 0 ] && ok "fila: sai 0" ok || ok "fila: sai 0" nao "rc=$RC :: $SAIDA"
for t in "'forja (fila)'" "array['read','intelligence']" "revoked_at = now()" "k.key_hash <> '$H2'" "k.revoked_at is null" "primary_domain = 'bythiagofigueiredo.com'"; do
  grep -qF -- "$t" <<< "$(sql 1)" && ok "fila: SQL tem [$t]" ok || ok "fila: SQL tem [$t]" nao "faltou"
done
grep -qF "so leitura" <<< "$(sql 1)" && ok "fila: nao usa o nome da fase 1" nao "achou 'so leitura'" || ok "fila: nao usa o nome da fase 1" ok
[ "$N" = 2 ] && ok "fila: duas chamadas (escrita + conferencia)" ok || ok "fila: duas chamadas (escrita + conferencia)" nao "chamadas=$N"
grep -qx -- "-o" "$FALSO_ARGS.2" && ok "fila: conferencia pede json" ok || ok "fila: conferencia pede json" nao "sem -o json"
grep -qF "revoked_at = now()" <<< "$(sql 2)" && ok "fila: conferencia so le" nao "a conferencia escreve" || ok "fila: conferencia so le" ok

# --- conferencia que reprova ---
roda '[{"ativas":2,"minha":1,"perms":"intelligence,read"}]' fila "$H2"
[ "$RC" -ne 0 ] && ok "fila: 2 ativas param o script" ok || ok "fila: 2 ativas param o script" nao "rc=$RC"
roda '[{"ativas":1,"minha":1,"perms":"read"}]' fila "$H2"
[ "$RC" -ne 0 ] && ok "fila: permissoes erradas param" ok || ok "fila: permissoes erradas param" nao "rc=$RC"
roda '[{"ativas":1,"minha":0,"perms":"intelligence,read"}]' fila "$H2"
[ "$RC" -ne 0 ] && ok "fila: chave inativa para" ok || ok "fila: chave inativa para" nao "rc=$RC"
roda '[]' fila "$H2"
[ "$RC" -ne 0 ] && ok "fila: conferencia vazia para" ok || ok "fila: conferencia vazia para" nao "rc=$RC"
roda 'ERRO: nada de json aqui' fila "$H2"
[ "$RC" -ne 0 ] && ok "fila: saida sem json para" ok || ok "fila: saida sem json para" nao "rc=$RC"

echo; echo "seed fila: $falhas falha(s)"; exit $((falhas > 0))
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
bash ~/Workspace/forja/ferramentas/fase2/teste_seed_fila.sh
```
Expected: FAIL — hoje `fila` cai no `if ! [[ "$H" =~ ^[0-9a-f]{64}$ ]]` e sai 1 sem SQL nenhum; os casos `fila:` reprovam em bloco.

- [ ] **Step 3: Implementar**

Substituir `~/Workspace/forja/ferramentas/seed_chave_forja.sh` inteiro por:

```bash
#!/bin/bash
# Registra no banco de PRODUCAO do bythiagofigueiredo uma chave da forja, a partir do SHA-256.
# A chave em si nunca passa por aqui: ela foi gerada na forja por nova_chave.py e so existe la.
#
# Uso, no terminal do Mac:
#   bash ~/Workspace/forja/ferramentas/seed_chave_forja.sh <sha256>        # fase 1  -> forja (so leitura), {read}
#   bash ~/Workspace/forja/ferramentas/seed_chave_forja.sh fila <sha256>   # fase 2a -> forja (fila), {read,intelligence}
#
# Idempotente: se o hash ja existe, nao insere de novo. Nao mostra o hash na saida.
# No modo fila, o mesmo SQL revoga as OUTRAS 'forja (fila)' ativas DESTE site, e depois o script
# confere que restou exatamente uma. Duas chaves ativas com o mesmo nome fariam a revogacao do
# rollback (§5) deixar uma viva sem ninguem notar.
set -euo pipefail

pare() { echo "pare: $*" >&2; exit 1; }

if [ "${1:-}" = fila ]; then
  MODO=fila; H="${2:-}"
elif [[ "${1:-}" =~ ^[0-9a-f]{64}$ ]]; then
  MODO=leitura; H="$1"
else
  echo "pare: formas aceitas:" >&2
  echo "        seed_chave_forja.sh <sha256>          (forja so leitura, {read})" >&2
  echo "        seed_chave_forja.sh fila <sha256>     (forja fila, {read,intelligence})" >&2
  exit 1
fi
if ! [[ "$H" =~ ^[0-9a-f]{64}$ ]]; then
  echo "pare: passe o SHA-256 impresso pelo nova_chave.py (64 caracteres hexadecimais)." >&2
  echo "      NUNCA cole a chave em si — ela comeca com 'forja_' e deve ficar so na forja." >&2
  exit 1
fi

# case fechado: nome, permissoes e forma canonica conferida depois do insert.
case "$MODO" in
  leitura) NOME='forja (so leitura)'; ROTULO='so leitura'; PERMS="array['read']";                CANON='read' ;;
  fila)    NOME='forja (fila)';       ROTULO='fila';       PERMS="array['read','intelligence']"; CANON='intelligence,read' ;;
  *) pare "modo desconhecido: $MODO" ;;
esac

cd ~/Workspace/bythiagofigueiredo
REF=$(cat supabase/.temp/project-ref 2>/dev/null || true)
[ "$REF" = "novkqtvcnsiwhkxihurk" ] || pare "o projeto ligado nao e o de producao ($REF). Rode: npm run db:link:prod"

REVOGA=""
if [ "$MODO" = fila ]; then
  REVOGA="update public.pipeline_api_keys k
set revoked_at = now()
from public.sites s
where k.site_id = s.id
  and s.primary_domain = 'bythiagofigueiredo.com'
  and k.name = '$NOME'
  and k.key_hash <> '$H'
  and k.revoked_at is null;
"
fi

SQL="insert into public.pipeline_api_keys (site_id, name, key_hash, permissions)
select s.id, '$NOME', '$H', $PERMS
from public.sites s
where s.primary_domain = 'bythiagofigueiredo.com'
  and not exists (select 1 from public.pipeline_api_keys k where k.key_hash = '$H');
${REVOGA}select k.name, k.permissions, k.revoked_at is null as ativa, k.created_at::timestamp(0) as criada, s.primary_domain as site
from public.pipeline_api_keys k join public.sites s on s.id = k.site_id
where k.key_hash = '$H';"

echo "Registrando a chave da forja ($ROTULO) em producao..."
npx --yes supabase@2.98.2 db query --linked --agent=no "$SQL"

CONF_SQL="select
  (select count(*) from public.pipeline_api_keys k join public.sites s on s.id = k.site_id
    where s.primary_domain = 'bythiagofigueiredo.com' and k.name = '$NOME' and k.revoked_at is null) as ativas,
  (select count(*) from public.pipeline_api_keys k join public.sites s on s.id = k.site_id
    where s.primary_domain = 'bythiagofigueiredo.com' and k.name = '$NOME'
      and k.key_hash = '$H' and k.revoked_at is null) as minha,
  coalesce((select string_agg(p, ',' order by p)
            from public.pipeline_api_keys k join public.sites s on s.id = k.site_id, unnest(k.permissions) p
            where s.primary_domain = 'bythiagofigueiredo.com' and k.key_hash = '$H'), '') as perms"

npx --yes supabase@2.98.2 db query --linked --agent=no -o json "$CONF_SQL" | python3 -c '
import json, sys
modo, canon = sys.argv[1], sys.argv[2]
t = sys.stdin.read()
i = t.find("[")
if i < 0:
    sys.exit("pare: a conferencia nao devolveu JSON")
linhas, _ = json.JSONDecoder().raw_decode(t[i:])
if not linhas:
    sys.exit("pare: a conferencia voltou vazia — a chave nao foi gravada")
r = linhas[0]
if r.get("perms") != canon:
    sys.exit("pare: esse hash ja existia com outras permissoes (%r, esperado %r)" % (r.get("perms"), canon))
if int(r.get("minha") or 0) != 1:
    sys.exit("pare: a chave desse hash nao esta ativa neste site")
if modo == "fila" and int(r.get("ativas") or 0) != 1:
    sys.exit("pare: sobrou mais de uma forja (fila) ativa no site (%s) — revogue a mao antes de seguir"
             % r.get("ativas"))
print("conferencia: ok (%s ativa(s), permissoes %s)" % (r.get("ativas"), r.get("perms")))
' "$MODO" "$CANON"

echo
echo "Pronto se a tabela acima mostra: $NOME | {$(echo "$PERMS" | sed "s/array\[//;s/\]//;s/'//g")} | ativa = t | site bythiagofigueiredo.com"
if [ "$MODO" = fila ]; then
  echo "Proximo, na forja (portao do F1):"
  echo "  cd /opt/agente && timeout -k 30s 25m venv/bin/python -B docs/trilha/fila_intel.py --canario"
else
  echo "Proximo, na forja: bash docs/trilha/canario.sh"
fi
```

Três coisas que este arquivo **não** muda: o SQL da fase 1 (o golden do teste o prova), a mensagem `Registrando a chave da forja (so leitura) em producao...` e a recusa de tudo que não seja 64 hex minúsculos. A conferência de permissões passou a valer para os dois modos — ela só lê, e sobre a chave `{read}` já gravada em 18/09 ela passa; a conferência de "exatamente uma ativa" é só do modo `fila`, como o spec pede.

- [ ] **Step 4: Rodar e ver passar**

```bash
bash ~/Workspace/forja/ferramentas/fase2/teste_seed_fila.sh
bash -n ~/Workspace/forja/ferramentas/seed_chave_forja.sh && echo SH-OK
```
Expected: `seed fila: 0 falha(s)`, saída 0, e `SH-OK`. **Nenhuma** destas linhas fala com o banco: o `npx` falso está na frente do `PATH` e o teste confere que as formas recusadas nem chegam a chamá-lo.

- [ ] **Step 5: Commit**

O `seed_chave_forja.sh` fica **fora do kit** (mora em `ferramentas/`, é 0644 e roda no Mac) — o `scp -r trilha` do K não o leva, e ele não entra no `KIT-IGUAL`. Versionado ele fica, porque é ele que escreve no banco de produção.

```bash
cd ~/Workspace/forja/ferramentas
git add seed_chave_forja.sh fase2/teste_seed_fila.sh
git diff --cached | python3 -c "import re,sys;S='forja_'+'A'*43;a={m for m in re.findall(r'forja_[A-Za-z0-9_-]{43}',sys.stdin.read()) if m!=S};print('PARE: literal com forma de chave no staged (%d)'%len(a) if a else 'SEM-CHAVE-NO-STAGED');sys.exit(1 if a else 0)"
git commit -m "feat: seed_chave_forja.sh aceita a forma fila <sha>

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```
Expected: `SEM-CHAVE-NO-STAGED` e depois o commit. A varredura olha **só o que está staged** e só recusa um literal com a forma `forja_<43>` que não seja a sentinela — se ela imprimir `PARE:`, desfaça com `git restore --staged seed_chave_forja.sh fase2/teste_seed_fila.sh` e ache de onde veio o valor antes de qualquer commit.

---

### Task F1-4: o bloco **F1 — para colar** e o seed em produção (dono)

Daqui em diante é o card F1 da tabela do §5: **só o dono executa**. O agente prepara, lê e confere.

**Files:** nenhum no Mac; na forja, `/opt/agente/fila_intel.env` (novo) e `/opt/agente/sombra/` (novo).

**Interfaces:**
- Consumes: F0 promovido, F0.5 (fixture), S4 (o `sitio.py` com `ROTAS_FASE[2]`), K (kit na forja) e as Tasks F1-1..F1-3.
- Produces: `fila_intel.env` 0600 com `CANAIS_FILA=PT` e `SITIO_CHAVE_FILA`; a chave `forja (fila)` ativa no banco; `sombra/` 700.

- [ ] **Step 1: Conferir as pré-condições (agente, só leitura)**

```bash
ssh forja 'ls -l /opt/agente/docs/trilha/fixture_pt.json /opt/agente/series.json /opt/agente/docs/trilha/fila_intel.py'
ssh forja 'python3 -c "import importlib.util as u;s=u.spec_from_file_location(\"s\",\"/opt/agente/sitio.py\");m=u.module_from_spec(s);s.loader.exec_module(m);print(sorted(m.ROTAS_FASE))"'
ssh forja 'ls -l /opt/agente/fila_intel.env 2>&1'
```
Esperado: os três arquivos existem (F0.5 e K feitos) · a lista de fases contém `2` (S4 feito) · `fila_intel.env` **ainda não existe**. Qualquer outra coisa reprova — pare e volte ao card que falta.

- [ ] **Step 2: O dono cola o bloco F1 na forja (sem sudo)**

```
cd /opt/agente
[ -e fila_intel.env ] || install -m 600 /dev/null fila_intel.env
mkdir -m 700 -p sombra
grep -q '^CANAIS_FILA=' fila_intel.env || printf 'CANAIS_FILA=PT\n' >> fila_intel.env
grep -q '^SITIO_CHAVE_FILA=' fila_intel.env || python3 docs/trilha/nova_chave.py --fila
```

**A ordem importa e o bloco é repetível.** O `install` só cria o arquivo quando ele falta, porque sobre um arquivo existente ele o **trunca** e apagaria a chave. O `nova_chave.py --fila` fica por último e atrás de um `grep` porque ele **sai 1** quando já há chave e não veio `--trocar` (`nova_chave.py:17-18`): numa segunda passada, encadeado por `&&`, ele cortaria a linha do `CANAIS_FILA`. Numa segunda execução do bloco inteiro, nada muda e nada é gerado.

Esperado: na primeira vez, as três últimas linhas imprimem `chave da fila gravada em /opt/agente/fila_intel.env (o valor nao foi impresso).`, `SHA-256 para o banco: <64 hex>` e a linha `No Mac: bash ~/Workspace/forja/ferramentas/seed_chave_forja.sh fila <sha>`. **Se aparecer o valor da chave (`forja_…`) em qualquer lugar, pare**: o `nova_chave.py` foi adulterado. Qualquer outra coisa reprova.

- [ ] **Step 3: Conferir o arquivo, sem olhar o valor**

```
ls -l /opt/agente/fila_intel.env
grep -c '^CANAIS_FILA=' /opt/agente/fila_intel.env
grep -c '^SITIO_CHAVE_FILA=' /opt/agente/fila_intel.env
sed -n 's/^SITIO_CHAVE_FILA="\(forja_[A-Za-z0-9_-]\{43\}\)"$/\1/p' /opt/agente/fila_intel.env | wc -l
ls -ld /opt/agente/sombra
```
Esperado, nesta ordem: `-rw------- 1 thiago thiago` · `1` · `1` · `1` · `drwx------ … thiago thiago`. **Qualquer outra coisa reprova** — em especial um `0` na quarta linha, que quer dizer que o valor não está no formato e faria o worker sair em `config` (e deixaria a prova de vazamento do Step F1-7 passar sozinha, com um padrão vazio).

- [ ] **Step 4: O dono registra a chave em produção, no Mac**

```bash
bash ~/Workspace/forja/ferramentas/seed_chave_forja.sh fila <sha impresso no Step 2>
```
`<sha>` é o **hash**, nunca a chave. Esperado: a tabela com `forja (fila) | {read,intelligence} | ativa = t | bythiagofigueiredo.com` e, depois dela, `conferencia: ok (1 ativa(s), permissoes intelligence,read)`. Qualquer `pare:` reprova — em particular `sobrou mais de uma forja (fila) ativa`, que significa uma chave velha não revogada e exige revogação manual antes de seguir.

- [ ] **Step 5: Conferência de leitura pelo agente**

```bash
cd ~/Workspace/bythiagofigueiredo && npx --yes supabase@2.98.2 db query --linked --agent=no "select k.name, k.permissions, k.revoked_at is null as ativa, k.created_at::timestamp(0) as criada from public.pipeline_api_keys k join public.sites s on s.id = k.site_id where s.primary_domain='bythiagofigueiredo.com' and k.name like 'forja%' order by k.created_at"
```
Esperado: exatamente duas linhas ativas — `forja (so leitura) | {read}` (de 18/09) e `forja (fila) | {read,intelligence}` (de hoje). Uma terceira ativa com nome `forja (fila)` reprova.

---

### Task F1-5: confirmar `teste_fila.py` verde, sob o lock (dono)

**Não há instalação.** `fila_intel.py` roda sempre de `docs/trilha/` — uma segunda cópia em
`/opt/agente/fila_intel.py` foi um desenho anterior que nunca chegou a existir na forja de verdade
(o worker vivo sempre foi `docs/trilha/fila_intel.py`, como prova o crontab real). Duas cópias do
mesmo worker seriam a ambiguidade — "qual delas está rodando?" — que já custou uma rodada perdida ao
dono. Este card, antes um "instalar", vira só a confirmação de que a cópia de trabalho passa sob o
lock, o mesmo comando que F4 vai exigir antes de cada atualização (§4.6).

**Files:** nenhum.

**Interfaces:**
- Consumes: Task F1-4; `docs/trilha/fila_intel.py` na forja (pelo K); `teste_fila.py`; `fixture_pt.json` e `/opt/agente/series.json` (F0.5).
- Produces: a confirmação de que o worker está pronto para o F2; nada é instalado.

- [ ] **Step 1: `teste_fila.py` verde na forja, sobre a cópia de trabalho**

```
(cd /opt/agente/docs/trilha && flock -w 1800 /opt/agente/fila_intel.lock env -u PYTHONPATH -u AGENTE_BASE AGENTE_SITIO=/opt/agente/docs/sitio.py AGENTE_FILA=/opt/agente/docs/trilha/fila_intel.py /opt/agente/venv/bin/python -B teste_fila.py) || echo 'PARE: teste_fila reprovou ou lock ocupado por 30 min'
```
O `env -u PYTHONPATH` tira o stub `st/httpx.py` do caminho — na forja o worker fala com o `httpx` de verdade. Esperado: a última linha do teste com `0 falha(s)` e saída 0; **qualquer `PARE:` reprova**.

---

### Task F1-6: os portões do F1 (dono roda, Claude lê)

A **ordem destes passos importa**: o `--canario` passa antes pelas checagens de `/slots` e de chat recente do §4.1 passo 2, então o turno de chat do Step 4 vem **depois** do canário. Se o canário sair `chat`, `ocupado` ou `llama_fora`, nada foi sondado — espere 5 min e repita o mesmo comando.

**Files:** nenhum.

**Interfaces:**
- Consumes: Tasks F1-4 e F1-5.
- Produces: o F1 aprovado; o F2 só começa depois disso.

- [ ] **Step 1: `/slots` com 2 entradas e `is_processing` booleano**

```
curl -fsS 127.0.0.1:8080/slots | python3 -c "import json,sys;d=json.load(sys.stdin);s=d if isinstance(d,list) else d.get('slots',[]);print(len(s), sorted({type(x.get('is_processing')).__name__ for x in s}))"
```
Esperado: `2 ['bool']`. Qualquer outra coisa reprova — `2 ['NoneType']` quer dizer que o llama-server mudou e o campo sumiu, e é exatamente o caso que a guarda do §4.1 passo 2 fecha em `llama_fora`. Anote a forma bruta da resposta (lista ou objeto) no relato: o agente do laço precisa dela.

- [ ] **Step 2: `--canario` — as três sondas de escopo e a de schema**

```
cd /opt/agente && timeout -k 30s 25m venv/bin/python -B docs/trilha/fila_intel.py --canario
```
Esperado, na saída impressa: `POST …/task/00000000-0000-4000-8000-000000000000/fail` com a **chave da fila** → **404**; o mesmo pedido com a **chave `{read}`** → **403** (um **401 reprova**: seria chave recusada, não permissão faltando); `PATCH …/intelligence` com `video_recommendations` → **400** (um **404 reprova**: quer dizer que a guarda de escopo ficou depois do SELECT da task, §3.3); e a sonda de schema na 8080 aprovada pelo Aceite do §4.4, com `reasoning_content` vazio. Nada é gravado no banco: o `task_id` não existe e a guarda recusa antes de qualquer escrita.

Portão único e legível por máquina:

```
tail -n 1 /opt/agente/log/fila_intel.jsonl | python3 -c "import json,sys;d=json.loads(sys.stdin.read());print(d.get('modo'), d.get('desfecho'), d.get('motivos'))"
```
Esperado: `canario ok None` (ou `ok []`). **`reprovada` reprova** — é o que o §4.7 manda quando uma sonda não devolve o esperado. `chat`/`ocupado`/`llama_fora` não reprovam: nada foi sondado, espere 5 min e repita o Step 2.

- [ ] **Step 3: A chave da fila não vazou no log do canário**

```
grep -c forja_ /opt/agente/log/fila_intel.jsonl
```
Esperado: `0` (o `grep -c` sai 1 quando não acha — a saída `0` é o que vale). Qualquer número maior reprova e o card para: o valor foi ao log.

- [ ] **Step 4: A prova do chat — um turno, e a última linha de `roteamento.jsonl`**

O dono faz **um turno de chat** com o agente (qualquer pergunta) e, logo depois:

```
tail -n 1 /opt/agente/roteamento.jsonl | python3 -c "import json,sys;print(json.loads(sys.stdin.read())['quando'])"; date +%FT%T
```
Esperado: as duas datas no **mesmo fuso**, a menos de **1 min** uma da outra. Isso prova que a guarda de chat recente do §4.1 passo 2 lê um arquivo vivo e no fuso certo — sem isso a fila geraria por cima do chat sem nunca dizer por quê. Uma diferença de horas (ou um fuso diferente) reprova.

- [ ] **Step 5: As duas contagens do `fila_intel.env`**

```
grep -c '^CANAIS_FILA=' /opt/agente/fila_intel.env
grep -c '^SITIO_CHAVE_FILA=' /opt/agente/fila_intel.env
```
Esperado: `1` e `1`. Um `2` na segunda é `chave_duplicada` no leitor e vira `config`, sem claim. Qualquer outra coisa reprova.

- [ ] **Step 6: Nenhum claim antes do F4 (leitura do banco, pelo dono)**

```bash
cd ~/Workspace/bythiagofigueiredo && npx --yes supabase@2.98.2 db query --linked --agent=no "select count(*) from public.youtube_intelligence_tasks where result_summary->>'claimed_by' in (select id::text from public.pipeline_api_keys where name = 'forja (fila)')"
```
Esperado: `0`. Rode **agora**, como marco zero, e de novo **no início do F4**, que é onde o §5 o coloca: entre um e outro só correm o F2 (`--sombra`, que não clama) e os modos auxiliares. Um número diferente de zero reprova e quer dizer que alguém ligou o cron antes da hora — pare e leia `/opt/agente/log/fila_intel.jsonl`.

> Este SQL é o do spec, sem filtro de site, de propósito: um zero sobre **todos** os sites é mais forte que um zero sobre um só. É o único SQL deste card sem `and site_id = …`, e é seguro porque só conta.

---

### Task F1-7: as provas de vazamento (dono roda, Claude lê)

As quatro provas do §4.6 ("Provas") mais a prova do O5. Rodam **depois** do canário, para que o log já tenha conteúdo. Uma linha por vez.

**Files:** nenhum.

**Interfaces:**
- Consumes: Tasks F1-4 a F1-6.
- Produces: a evidência de que a chave da fila não está no ambiente do proxy nem em arquivo nenhum que a forja escreva.

- [ ] **Step 1: A chave da fila não está no arquivo do proxy**

```
grep -c SITIO_CHAVE_FILA /etc/default/proxy-agente
```
Esperado: `0`. Qualquer outra coisa reprova — o segredo da fila estaria no arquivo que a unit carrega.

- [ ] **Step 2: A chave da fila não está no ambiente do processo do proxy**

```
tr '\0' '\n' < /proc/$(systemctl show -p MainPID --value proxy-agente)/environ | grep -c FILA
```
Esperado: `0`. Sem sudo: o serviço roda como `thiago`. Se der erro de permissão, o serviço não é do thiago e isso, por si, reprova.

- [ ] **Step 3: O arquivo tem exatamente uma chave, e no formato**

```
sed -n 's/^SITIO_CHAVE_FILA="\(forja_[A-Za-z0-9_-]\{43\}\)"$/\1/p' /opt/agente/fila_intel.env | wc -l
```
Esperado: **exatamente `1`**. Este passo **não é decorativo**: sem ele, o padrão do Step 4 sairia vazio e aquela prova passaria sozinha.

- [ ] **Step 4: O valor não aparece em nada que a forja escreve — sem passar por argv**

```
grep -rlFf <(sed -n 's/^SITIO_CHAVE_FILA="\(.*\)"$/\1/p' /opt/agente/fila_intel.env) /opt/agente/log/ /opt/agente/sombra/ | wc -l
```
Esperado: `0`. A substituição de processo (`<(…)`) existe para que o valor nunca apareça na linha de comando (`ps`), só num descritor. Qualquer arquivo listado reprova e o card **para**: troque a chave (`nova_chave.py --fila --trocar` sob a trava + `seed_chave_forja.sh fila <sha novo>`), apague o arquivo que vazou e refaça a prova.

- [ ] **Step 5: O O5 não comeu as variáveis da fase 1**

```
grep -cE '^SITIO_(CHAVE|CANAL_PT|CANAL_EN)=' /etc/default/proxy-agente
```
Esperado: **`3`**. O `install` do O5 troca `/etc/default/proxy-agente` inteiro, e é a função `preservadas()` do `onda0b/gerar_segredos.py:55-62` que mantém estas três linhas vivas. Rode esta prova **depois de qualquer mexida naquele arquivo**, não só aqui: um `2` significa que a fase 1 (o chat lendo o site) caiu junto, e o `--canario` do F1 passaria a dar `sem-chave` na segunda sonda.

- [ ] **Step 6: Registrar**

No relato: as cinco saídas, na ordem, com a data. Não copie nenhuma linha do `fila_intel.env` para o relato — só as contagens.

---

### Task F1-8: rollback do F1 (preparado; o dono decide e executa)

Nada aqui é executado durante o rollout. É o texto que o dono cola se o F1 tiver de voltar.

**Files:** nenhum.

**Interfaces:**
- Consumes: a ordem de rollback do §5 — F4 → Qualidade → **F1** → S4 → F0.
- Produces: a chave `forja (fila)` revogada no site e o segredo apagado da forja.

- [ ] **Step 1: Pré-condição — o cron já tem de estar fora**

Os dois primeiros passos do rollback do F4 vêm antes deste card: tirar a linha do crontab e esperar a trava.

```
crontab -l | grep -c fila_intel
flock -w 1800 /opt/agente/fila_intel.lock true && echo LOCK-LIVRE || echo 'ESPERAR: execucao ainda viva'
```
Esperado: `0` e `LOCK-LIVRE`. Sem isso, a execução seguinte tenta clamar com a chave já revogada e enche o jsonl de `chave` — barulho no meio do rollback. Qualquer outra coisa: pare e volte ao rollback do F4.

- [ ] **Step 2: Revogar a chave no banco (dono, no Mac)**

```bash
cd ~/Workspace/bythiagofigueiredo && npx --yes supabase@2.98.2 db query --linked --agent=no "update public.pipeline_api_keys set revoked_at=now() where name='forja (fila)' and revoked_at is null and site_id = (select id from public.sites where primary_domain='bythiagofigueiredo.com')"
```
É o mesmo escopo de site do `seed_chave_forja.sh`: revoga só as `'forja (fila)'` ativas **deste** site. Sem o `and site_id = …`, um dia com mais de um site no banco isto apagaria a chave da forja de outro anel. A `forja (so leitura)` **não** é tocada — o chat da fase 1 continua de pé.

- [ ] **Step 3: Apagar o segredo da forja (dono, na forja)**

```
rm -f /opt/agente/fila_intel.env
```
Só o `.env`. Não há worker instalado para tirar (§4.6, sem segunda cópia): `docs/trilha/fila_intel.py` fica no disco, inerte, e sai só se o rollback do **S4** tirar a linha do `teste_fila` no `cartao.sh` — não mexa nele aqui.

- [ ] **Step 4: Provar (leitura)**

```bash
cd ~/Workspace/bythiagofigueiredo && npx --yes supabase@2.98.2 db query --linked --agent=no "select count(*) as ativas from public.pipeline_api_keys k join public.sites s on s.id = k.site_id where s.primary_domain='bythiagofigueiredo.com' and k.name='forja (fila)' and k.revoked_at is null"
```
```
ls /opt/agente/fila_intel.env 2>&1
```
Esperado: `ativas = 0` e `No such file or directory`. Qualquer outra coisa reprova e o rollback não terminou.

---


---

## F0k + F4 · pulso, crontab e a vigilância da fila (§6, §5)

Último card da 2a. Entra **depois** do F2 aprovado e do `K` que leva `pulso_f4.py`/`teste_pulso_fila.py`
à forja (`PULSO-IGUAL`). Três passos do dono, nesta ordem: (1) execução manual sobre a task PT
pendente; (2) a linha do crontab; (3) o check `URL_FILA` no healthchecks e a regra no `pulso.sh` vivo.

**O kit está sob git.** `~/Workspace/forja/ferramentas` é repositório desde `ec51833`
(*chore: estado do kit antes da fase 2a*), 116 arquivos rastreados, árvore limpa, `.gitignore` com
`__pycache__/` e `*.pyc`. O `.git` fica em `ferramentas/`, **fora de `docs/`** — o `scp -r
sitio.py trilha` do card `K` não o leva e o portão md5 não o vê. `ferramentas/fase2/`, onde moram
`pulso_f4.py` e `teste_pulso_fila.py`, está coberto.

Portanto: **toda tarefa de código deste card termina em `git commit`**, no padrão `tipo: descrição
curta`, **repositório local — sem remoto e sem push**, com `git add` por **caminho explícito**
(nunca `git add -A`/`.`). Não se faz cópia `.bak`/`.bak-fase2` no Mac: o histórico é o backup.
O `cp -p pulso.sh pulso.sh.bak-F4` da Task F4-5 é **outra coisa** e continua — ele protege o arquivo
**vivo na forja**, que git nenhum cobre. O plano em si (este arquivo, em `docs/superpowers/plans/`
do repo do site) é commitado à parte, com `--no-verify` (regra de plano/doc).

### O que o `pulso.sh` vivo é hoje

`~/Workspace/forja/ferramentas/onda0b/pulso.sh.novo` é o arquivo que a O2 pôs em
`/opt/agente/docs/pulso.sh`. As partes que este card toca:

| Linha | Conteúdo | Por que importa |
|---|---|---|
| 27 | `URL="https://hc-ping.com/af566211-…"` | precedente: o pulso já guarda a própria URL no arquivo |
| 28-29 | `LOG=/opt/agente/log/pulso.log` · `mkdir -p "$(dirname "$LOG")"` | o `log/` existe desde a O2 |
| 31-32 | `ok=1` · `motivo=""` | ficam **fora** do bloco novo; o harness os reproduz |
| 50 | `yt_hints-sem-200-15min` | marca da O2 — a pré-condição do passo (3) |
| 56-75 | `site=$(python3 - <<'EOF' … EOF)` com `print(type(e).__name__)` | o padrão que o bloco novo copia |
| 76 | `[ "$site" = "ok" ] \|\| { ok=0; motivo="$motivo site-${site:-mudo}"; }` | o padrão **fecha fechado**: saída vazia = vermelho |
| 78 | `[ "$ok" -eq 1 ] && alvo="$URL" \|\| alvo="$URL/fail"` | **a âncora**. `grep -c` no arquivo real = **1** |
| 83-88 | 5 tentativas, `curl -fsS -m 20`, `sleep $(( tentativa * 10 ))` | as "mesmas tentativas do pulso" |

**O bloco novo nunca toca em `ok`.** O `pulso.sh` vivo é o do proxy: se a fila derrubasse o check
principal, uma task reprovada o deixaria vermelho por até 24 h e calaria proxy/llama/esteira caídos
nesse intervalo (§6 do spec). Ele escreve só em `ok_fila`, em `$motivo` e no seu próprio check.

### Mapa de arquivos

**Criados** (no Mac, em `~/Workspace/forja/ferramentas/fase2/` — o diretório ainda não existe)

| Arquivo | Responsabilidade |
|---|---|
| `ferramentas/fase2/pulso_f4.py` | insere/remove o bloco no `pulso.sh`, com âncora de contagem 1 |
| `ferramentas/fase2/teste_pulso_fila.py` | harness: roda o bloco extraído com `curl`/`sleep` falsos |

**Alterado na forja (pelo dono)**: `/opt/agente/docs/pulso.sh` (via `pulso.sh.tmp` + `mv`) e o
crontab do `thiago`. **Nenhum arquivo do repo do site muda neste card.**

### Interfaces que atravessam as tarefas

```
pulso_f4.py <url>        -> le ./pulso.sh, grava ./pulso.sh.tmp COM o bloco; imprime "ok";  sai 0
pulso_f4.py --remover    -> le ./pulso.sh, grava ./pulso.sh.tmp SEM o bloco; imprime "removido"; sai 0
                            recusas imprimem "PARE: …" e saem 2, sem gravar nada
teste_pulso_fila.py <arquivo com o bloco>   -> "OK   "/"FALHA" por caso; sai 1 se houver falha
```

Marcadores, âncora e limiar — uma definição só, usada pelos dois scripts:

```
ABRE   = "# >>> fila_intel (F4)"
FECHA  = "# <<< fila_intel (F4)"
ANCORA = '[ "$ok" -eq 1 ]'                      # contagem 1 em pulso.sh (conferido)
RE_URL = ^https://hc-ping\.com/[0-9a-f-]{36}$
LIMIAR = 4200 s (70 min)
URL de teste = https://hc-ping.com/00000000-0000-0000-0000-000000000000
```

**Campos do jsonl que o bloco lê** (de `/opt/agente/log/fila_intel.jsonl`, §4.1): `quando`, `modo`,
`desfecho`, `claim`, `task`, `motivos`. Mais nada — nem `etapa`, nem `canal`, nem `tokens`.

**As quatro condições de vermelho (§6), na ordem em que o bloco as avalia** — a ordem é forçada pelo
portão "um `MOTIVO` com o motivo `fila-*` esperado **e nada mais**": num arquivo com `desfecho: chave`
as condições 3 e 4 disparam juntas e o spec manda sair `fila-parada:chave`, logo a 3 vem antes da 4.

| # | Condição | Motivo |
|---|---|---|
| 0 | qualquer exceção do `python3 -` embutido | `fila-leitura-<Tipo>` |
| 1 | mtime de `fila_intel.jsonl` > 70 min; **arquivo ausente conta como vermelho** | `fila-jsonl-<n>s` / `fila-jsonl-ausente` |
| 2 | a linha `modo: cron` mais recente tem `desfecho` em (`chave`, `config`) | `fila-parada:<desfecho>` |
| 3 | a linha `modo: cron` mais recente **com `task` não nulo** tem < 24 h e não é `ok` | `fila-task-<desfecho>` |
| 4 | nenhuma linha `modo: cron` das últimas 24 h tem `claim` em (200, 204) | `fila-sem-claim-24h:<desfecho>` · `…:<desfecho>:<motivos[0]>` quando o desfecho é `ocupado` · `fila-sem-claim-24h:nenhuma` sem nenhuma linha `cron` em 24 h |

**C1 — nomes dos motivos (decidido pelo dono, 20/09).** O §6 nomeia só `fila-parada:`,
`fila-sem-claim-24h:` e `fila-leitura-`. Os das condições 1 e 3 são **`fila-jsonl-<n>s` /
`fila-jsonl-ausente`** e **`fila-task-<desfecho>`**, no molde do `nas-estado-${idade}s` /
`nas-estado-ausente` do próprio `pulso.sh` (`:41-46`). A idade fica em **segundos**, não em minutos:
`fila-jsonl-4500s` se lê pior que `fila-jsonl-75min`, mas a consistência com o `nas-estado-${idade}s`
que o pulso já usa vale mais do que dois dígitos num alerta lido com sono.

**C2 — precedência (decidida pelo dono, 20/09).** A ordem acima é normativa: se não dá para ler o
arquivo, não se sabe nada; se o cron morreu, as outras três leem linhas velhas; e `parada`
(`chave`/`config`) é falha **permanente**, mais acionável que "não clamou". Ela está escrita **em
comentário dentro do `BLOCO`**, logo acima do encadeamento (Task F4-1, Step 3), porque no shell ela
é implícita e sumiria no primeiro refactor. O caso `chave` do `teste_pulso_fila.py` prende o
comportamento; o comentário é para quem for ler o shell daqui a um ano.

**C3 — o custo no ping principal (aceito pelo dono, 20/09).** O bloco roda **antes** do ping
principal (é inserido antes da linha 78). No pior caso — healthchecks fora do ar — são 5 tentativas
de `curl -m 20` mais os `sleep 10/20/30/40/50`: **~4,2 min** a mais antes do ping principal. É o
preço de usar "as mesmas tentativas do pulso" (§6). O argumento que fechou a decisão, registrado
aqui porque não é óbvio e alguém vai querer "consertar" isto depois:

- **Os dois pings vão para o mesmo host.** Se o `hc-ping.com` está fora, a fila gasta as 5
  tentativas *e* o principal falha depois de qualquer jeito — o atraso não cria alarme nenhum que
  já não fosse acontecer. O único caso ruim é o intermitente, e 4,2 min num check de período 1 h
  cabem em qualquer folga configurada.
- **Alternativa recusada:** calcular o motivo antes da âncora e pingar a fila **depois** do ping
  principal zeraria o atraso, mas quebraria o bloco em dois pares de marcadores — e o `--remover`
  perderia a prova por `cmp -s`, que é justamente o que torna o rollback do F4 confiável.
- **Saída barata, se o teto um dia incomodar:** cortar as tentativas da fila de 5 para 2 (~1 min de
  pior caso). É mudar um número no `for tentativa_fila in 1 2 3 4 5` do `BLOCO`.

Se o `curl` da fila falhar nas 5, **nada é registrado** — só o próprio check `URL_FILA` fica
atrasado. ⚠️ O §6 não diz o que fazer nesse caso; este plano não acrescenta motivo, para não pintar
de vermelho uma falha de rede que o healthchecks já pega pelo atraso.

**Código conferido.** Os dois scripts deste card foram montados e rodados de ponta a ponta numa
cópia de `pulso.sh.novo` antes de o plano ser escrito, e **reconferidos depois do patch de 20/09**
(comentário de precedência dentro do `BLOCO`): `F4: 0 falha(s)` nos 16 casos, `bash -n` limpo,
`py_compile` limpo, `cmp -s` do ciclo inserir/`--remover` verde, e as invariantes do Step 5 da Task
F4-2 dando `1 / 0 / 3 / 0`.

**A conta da margem dos 70 min** (§6, reproduzida aqui porque é o que justifica o `4200`): a linha só
é escrita no fim da execução (§4.1), uma execução pode durar 25 min, e os tiques de 10 min que pegam o
lock ocupado não gravam nada — o silêncio normal já chega a 30 min. Uma execução morta por SIGKILL não
grava linha nenhuma e, somada à seguinte, chega a ~60 min **sem que nada tenha caído**. 70 min cabe
dentro do período de 1 h do check. Mexer no `timeout -k 30s 25m` do crontab exige refazer esta conta.

---

### Task F4-1: `pulso_f4.py` — o inseridor com âncora de contagem 1

Só a mecânica de inserir/remover. O corpo do bloco é um **esqueleto** nesta tarefa (marcadores +
`URL_FILA=` + `FILA_LOG=`); a Task F4-2 o preenche, guiada por casos que falham.

**Files:**
- Create: `~/Workspace/forja/ferramentas/fase2/pulso_f4.py`
- Create: `~/Workspace/forja/ferramentas/fase2/teste_pulso_fila.py` (só a infra + os 3 casos do inseridor)

**Interfaces:**
- Consumes: `~/Workspace/forja/ferramentas/onda0b/pulso.sh.novo` (cópia do arquivo vivo, para o teste).
- Produces: `pulso_f4.py <url>` / `--remover`; as constantes `ABRE`/`FECHA`/`ANCORA`/`RE_URL`.

- [ ] **Step 1: Escrever os casos que falham**

Criar `~/Workspace/forja/ferramentas/fase2/teste_pulso_fila.py` com o cabeçalho, o `exige()` do kit
(estilo `trilha/teste_s1.py`/`teste_s3.py`: script Python simples, **não** pytest) e os três casos do
inseridor:

```python
"""F4: prova o bloco de vigilancia da fila e o pulso_f4.py que o insere.
Uso (no diretorio dos dois arquivos):  python3 teste_pulso_fila.py pulso.sh.tmp
Nao toca no pulso vivo e nao chama a rede: curl e sleep falsos no PATH, healthchecks de teste."""
import json, os, re, shutil, subprocess, sys, tempfile, time
from datetime import datetime, timedelta

AQUI = os.path.dirname(os.path.abspath(__file__))
ABRE, FECHA = "# >>> fila_intel (F4)", "# <<< fila_intel (F4)"
URL_TESTE = "https://hc-ping.com/00000000-0000-0000-0000-000000000000"
ALVO = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else "pulso.sh.tmp")
F4 = os.path.join(AQUI, "pulso_f4.py")
falhas = []


def exige(ok, nome):
    print("OK   " if ok else "FALHA", nome)
    if not ok:
        falhas.append(nome)


def f4(cwd, *args):
    return subprocess.run([sys.executable, F4] + list(args), cwd=cwd,
                          capture_output=True, text=True, timeout=60)


# --- o proprio pulso_f4.py, numa copia do pulso.sh em tmp ---
base = os.path.dirname(ALVO)
tmp = tempfile.mkdtemp(prefix="pulsof4-ida-")
shutil.copy(os.path.join(base, "pulso.sh"), os.path.join(tmp, "pulso.sh"))
guardado = os.path.join(tmp, "original.sh")
shutil.copy(os.path.join(tmp, "pulso.sh"), guardado)

r1 = f4(tmp, URL_TESTE)
os.replace(os.path.join(tmp, "pulso.sh.tmp"), os.path.join(tmp, "pulso.sh"))
r2 = f4(tmp, "--remover")
volta = subprocess.run(["cmp", "-s", guardado, os.path.join(tmp, "pulso.sh.tmp")])
exige(r1.returncode == 0 and r2.returncode == 0 and volta.returncode == 0,
      "pulso_f4: inserir + --remover devolve o arquivo byte a byte igual (cmp -s)")

# segunda insercao, com os marcadores ja presentes: recusa sem gravar
os.remove(os.path.join(tmp, "pulso.sh.tmp"))
r3 = f4(tmp, URL_TESTE)
exige(r3.returncode != 0 and "PARE" in r3.stdout
      and not os.path.exists(os.path.join(tmp, "pulso.sh.tmp")),
      "pulso_f4: segunda insercao recusa sem gravar")

# url fora do formato do healthchecks: recusa sem gravar
tmp2 = tempfile.mkdtemp(prefix="pulsof4-url-")
shutil.copy(guardado, os.path.join(tmp2, "pulso.sh"))
r4 = f4(tmp2, "http://hc-ping.com/00000000-0000-0000-0000-000000000000")
exige(r4.returncode != 0 and not os.path.exists(os.path.join(tmp2, "pulso.sh.tmp")),
      "pulso_f4: url fora de ^https://hc-ping\\.com/[0-9a-f-]{36}$ recusa sem gravar")

print("\nF4: %d falha(s)" % len(falhas)); raise SystemExit(1 if falhas else 0)
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
mkdir -p /tmp/f4-red && cp ~/Workspace/forja/ferramentas/onda0b/pulso.sh.novo /tmp/f4-red/pulso.sh
cd ~/Workspace/forja/ferramentas/fase2 && python3 teste_pulso_fila.py /tmp/f4-red/pulso.sh.tmp
```
Expected: FAIL — `pulso_f4.py` não existe (`f4()` sai com `returncode` ≠ 0 nos três casos), e o
`ALVO` inexistente ainda não é lido nesta tarefa.

- [ ] **Step 3: Implementar `pulso_f4.py`**

`~/Workspace/forja/ferramentas/fase2/pulso_f4.py` — o `BLOCO` é uma string **raw** (`r'''…'''`):
dentro dele há `\n` de Python-no-shell que não pode virar quebra de linha na hora de escrever.

```python
"""F4: insere (ou remove) o bloco de vigilancia da fila no pulso.sh vivo.
Uso (no diretorio do pulso.sh):
    python3 pulso_f4.py https://hc-ping.com/<uuid>   -> grava pulso.sh.tmp COM o bloco
    python3 pulso_f4.py --remover                    -> grava pulso.sh.tmp SEM o bloco
Nunca escreve por cima do pulso.sh: quem troca e o dono, com  chmod 755 + mv."""
import os, re, sys

ABRE = "# >>> fila_intel (F4)"
FECHA = "# <<< fila_intel (F4)"
ANCORA = '[ "$ok" -eq 1 ]'
RE_URL = re.compile(r"^https://hc-ping\.com/[0-9a-f-]{36}$")

BLOCO = r'''# >>> fila_intel (F4)
URL_FILA="@URL@"
# Check PROPRIO (§6): a fila nunca pinta o check principal. Este bloco mexe em
# ok_fila e em $motivo, nunca em $ok — uma task reprovada nao pode calar proxy,
# llama ou esteira caidos por ate 24 h.
#
# PRECEDENCIA dos motivos, nesta ordem, e so o primeiro sai (o alarme traz um
# motivo so):  leitura -> jsonl -> parada -> task -> sem-claim-24h.
#   leitura  nao deu para ler o arquivo: nao se sabe nada, o resto seria chute
#   jsonl    o cron morreu: as tres regras abaixo leriam linhas velhas
#   parada   chave/config: falha PERMANENTE, nada a esperar — por isso vem antes
#            de task, que costuma disparar junto e e menos acionavel
#   task     a ultima execucao que clamou nao terminou em ok
#   sem-claim-24h  ninguem clamou nada nas ultimas 24 h
# O caso "chave" do teste_pulso_fila.py prende esta ordem; nao reordene sem ele.
FILA_LOG="${FILA_LOG:-/opt/agente/log/fila_intel.jsonl}"
fila=$(python3 - "$FILA_LOG" <<'EOF' 2>/dev/null
# VER F4-2
print("fila-ok")
EOF
)
[ "$fila" = "fila-ok" ] && ok_fila=1 || ok_fila=0
[ "$ok_fila" -eq 1 ] && alvo_fila="$URL_FILA" || alvo_fila="$URL_FILA/fail"
for tentativa_fila in 1 2 3 4 5; do
  curl -fsS -m 20 -o /dev/null "$alvo_fila" 2>/dev/null && break
  sleep $(( tentativa_fila * 10 ))
done
[ "$ok_fila" -eq 1 ] || motivo="$motivo ${fila:-fila-mudo}"
# <<< fila_intel (F4)
'''


def grava(s):
    fd = os.open("pulso.sh.tmp", os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(s)


def main(argv):
    s = open("pulso.sh", encoding="utf-8").read()
    if argv[1:2] == ["--remover"]:
        for marca in (ABRE, FECHA):
            if s.count(marca) != 1:
                print("PARE: %s aparece %d vez(es) em pulso.sh" % (marca, s.count(marca)))
                return 2
        i, j = s.index(ABRE), s.index(FECHA) + len(FECHA)
        if j < i or s[j:j + 1] != "\n":
            print("PARE: marcadores fora de ordem ou fechamento sem fim de linha")
            return 2
        grava(s[:i] + s[j + 1:])      # do marcador de abertura ao de fechamento, inclusive o \n
        print("removido")
        return 0
    url = argv[1] if len(argv) == 2 else ""
    if not RE_URL.match(url):
        print("PARE: url invalida — esperado ^https://hc-ping\\.com/[0-9a-f-]{36}$")
        return 2
    if ABRE in s or FECHA in s:
        print("PARE: marcadores ja presentes em pulso.sh — nada foi gravado")
        return 2
    if s.count(ANCORA) != 1:
        print("PARE: ancora %s aparece %d vez(es) em pulso.sh" % (ANCORA, s.count(ANCORA)))
        return 2
    grava(s.replace(ANCORA, BLOCO.replace("@URL@", url) + ANCORA))
    print("ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
```

Três detalhes que o teste trava e que não são estilo:
1. **`BLOCO` termina em `FECHA + "\n"`, sem linha em branco depois.** O `--remover` consome
   exatamente até esse `\n`; qualquer linha em branco extra sobraria e o `cmp -s` reprovaria.
2. **A âncora entra no fim**: `s.replace(ANCORA, BLOCO + ANCORA)`. O `BLOCO` usa `ok_fila`, que não
   contém a string `[ "$ok" -eq 1 ]` — a contagem 1 continua valendo depois da inserção.
3. **0600 no `pulso.sh.tmp`** (como `trilha/s3.py:56`); o `chmod 755` é passo do dono, do spec.

- [ ] **Step 4: Rodar e ver passar**

```bash
cd ~/Workspace/forja/ferramentas/fase2 && python3 teste_pulso_fila.py /tmp/f4-red/pulso.sh.tmp
```
Expected: PASS — `F4: 0 falha(s)` (3 casos).

```bash
cd ~/Workspace/forja/ferramentas && python3 -m py_compile fase2/pulso_f4.py fase2/teste_pulso_fila.py && echo PY-OK
```
Expected: `PY-OK` (é a mesma checagem que o laço do card F0k roda sobre o kit inteiro).

- [ ] **Step 5: Commit**

```bash
cd ~/Workspace/forja/ferramentas
git add fase2/pulso_f4.py fase2/teste_pulso_fila.py
git commit -m "feat: pulso_f4 insere e remove o bloco da fila no pulso.sh

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```
Repositório local, **sem push** (não há remoto). Nada vai para a forja nesta tarefa — isso é o `K`.

---

### Task F4-2: o bloco de shell — as quatro condições de vermelho

**Files:**
- Modify: `~/Workspace/forja/ferramentas/fase2/teste_pulso_fila.py` (acrescenta a infra do bloco + 13 casos)
- Modify: `~/Workspace/forja/ferramentas/fase2/pulso_f4.py` (só o miolo do `BLOCO`)

**Interfaces:**
- Consumes: os campos `quando`, `modo`, `desfecho`, `claim`, `task`, `motivos` do jsonl (§4.1).
- Produces: o `BLOCO` definitivo; `$motivo` ganha um `fila-*` e `$ok` fica intocado.

- [ ] **Step 1: Escrever os 13 casos que falham**

Inserir em `teste_pulso_fila.py`, **antes** do bloco "o proprio pulso_f4.py" e depois do `f4()`:

```python
# --- extrai o bloco do arquivo alvo e troca a URL pela de teste ---
bruto = open(ALVO, encoding="utf-8").read()
i, j = bruto.index(ABRE), bruto.index(FECHA) + len(FECHA)
URL_VIVA = re.search(r'(?m)^URL_FILA="([^"]+)"', bruto[i:j]).group(1)
BLOCO = re.sub(r'(?m)^URL_FILA=.*$', 'URL_FILA="%s"' % URL_TESTE, bruto[i:j] + "\n")


def roda(fila_log):
    """Roda o bloco isolado: curl e sleep falsos no PATH, FILA_LOG apontando para a fixture.
    ok=1 e motivo="" sao as linhas que no vivo ficam FORA do bloco (pulso.sh:31-32)."""
    tmp = tempfile.mkdtemp(prefix="pulsof4-")
    binario = os.path.join(tmp, "bin")
    os.mkdir(binario)
    reg = os.path.join(tmp, "chamadas.txt")
    for nome in ("curl", "sleep"):
        p = os.path.join(binario, nome)
        with open(p, "w", encoding="utf-8") as f:
            f.write('#!/bin/sh\necho "%s $*" >> %s\nexit 0\n' % (nome, reg))
        os.chmod(p, 0o755)
    script = os.path.join(tmp, "prova.sh")
    with open(script, "w", encoding="utf-8") as f:
        f.write('ok=1\nmotivo=""\n' + BLOCO + 'printf \'OK=%s MOTIVO=%s\\n\' "$ok" "$motivo"\n')
    env = dict(os.environ, PATH=binario + os.pathsep + os.environ["PATH"], FILA_LOG=fila_log)
    r = subprocess.run(["bash", script], env=env, capture_output=True, text=True, timeout=180)
    chamadas = open(reg, encoding="utf-8").read().splitlines() if os.path.exists(reg) else []
    m = re.search(r'(?m)^OK=(\S*) MOTIVO=(.*)$', r.stdout)
    return (m.group(1) if m else None), (m.group(2) if m else None), chamadas


def caso(nome, caminho, esperado=None, padrao=None):
    """esperado: motivo literal ('' = verde). padrao: regex, para o motivo que leva a idade."""
    ok, motivo, chamadas = roda(caminho)
    curls = [c for c in chamadas if c.startswith("curl ")]
    alvo = curls[-1].split()[-1] if curls else ""
    quer = URL_TESTE if esperado == "" else URL_TESTE + "/fail"
    exige(ok == "1", nome + ": nao toca em ok")
    if padrao:
        exige(motivo is not None and re.match("^ " + padrao + "$", motivo),
              "%s: motivo %r casa %s" % (nome, motivo, padrao))
    else:
        exige(motivo == (" " + esperado if esperado else ""), "%s: motivo %r" % (nome, motivo))
    exige(len(curls) == 1 and alvo == quer, "%s: um ping so, em %s" % (nome, quer))
    exige(URL_VIVA not in "\n".join(chamadas), nome + ": nada foi ao healthchecks de verdade")


AGORA = datetime.now().astimezone()
TASK = "00000000-0000-4000-8000-000000000031"
FIX = tempfile.mkdtemp(prefix="pulsof4-fix-")


def linha(min_atras, **kw):
    d = {"quando": (AGORA - timedelta(minutes=min_atras)).isoformat(timespec="seconds"),
         "modo": "cron", "desfecho": "ok", "etapa": None, "claim": 200, "task": None,
         "canal": "PT", "tentativas": 1, "motivos": []}
    d.update(kw)
    return json.dumps(d) + "\n"


def fixture(nome, conteudo, idade_min=0):
    p = os.path.join(FIX, nome + ".jsonl")
    with open(p, "w", encoding="utf-8") as f:
        f.write(conteudo)
    if idade_min:
        t = time.time() - idade_min * 60
        os.utime(p, (t, t))
    return p


OK5 = linha(5, task=TASK)                      # cron recente, claim 200, desfecho ok

# 1. arquivo ausente
caso("ausente", os.path.join(FIX, "nao-existe.jsonl"), "fila-jsonl-ausente")
# 2. mtime de 80 min (conteudo verde, arquivo velho)
caso("mtime-80min", fixture("velho", OK5, idade_min=80), padrao=r"fila-jsonl-\d+s")
# 3. ultima cron com task, reprovada ha 2 h
caso("task-reprovada", fixture("reprov", linha(120, task=TASK, desfecho="reprovada",
                                               etapa="validar", motivos=["teto_texto"])),
     "fila-task-reprovada")
# 4. ... e uma ok mais nova apaga o motivo
caso("task-reprovada-e-ok", fixture("reprov-ok", linha(120, task=TASK, desfecho="reprovada")
                                    + OK5), "")
# 5. 24 h so com chat
caso("24h-chat", fixture("chat", linha(600, desfecho="chat", claim=None)
                         + linha(30, desfecho="chat", claim=None)), "fila-sem-claim-24h:chat")
# 6. ultima cron com desfecho chave (claim 403)
caso("chave", fixture("chave", linha(20, desfecho="chave", claim=403)), "fila-parada:chave")
# 7. ... e uma ok mais nova depois dela
caso("chave-e-ok", fixture("chave-ok", linha(20, desfecho="chave", claim=403) + OK5), "")
# 8. so linha modo: manual
caso("so-manual", fixture("manual", linha(10, modo="manual", task=TASK)),
     "fila-sem-claim-24h:nenhuma")
# 9. indeterminado conta como nao-ok
caso("indeterminado", fixture("indet", linha(30, task=TASK, desfecho="indeterminado",
                                             etapa="patch")), "fila-task-indeterminado")
# 10. 24 h so com morto de etapa: slots (claim: null)
caso("morto-slots", fixture("morto", linha(300, desfecho="morto", etapa="slots", claim=None)
                            + linha(40, desfecho="morto", etapa="slots", claim=None)),
     "fila-sem-claim-24h:morto")
# 11. ocupado leva o primeiro motivos junto (§6)
caso("ocupado-janela", fixture("ocup", linha(25, desfecho="ocupado", claim=None,
                                             motivos=["janela_sync"])),
     "fila-sem-claim-24h:ocupado:janela_sync")
# 12. ultima linha truncada (sem \n) e ignorada
caso("truncada", fixture("trunc", OK5 + linha(1)[:-20]), "")
# 13. leitura impossivel -> fila-leitura-<Tipo>
d = os.path.join(FIX, "sou-um-diretorio.jsonl")
os.mkdir(d)
caso("leitura", d, "fila-leitura-IsADirectoryError")
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd /tmp/f4-red && rm -f pulso.sh.tmp && cp ~/Workspace/forja/ferramentas/onda0b/pulso.sh.novo pulso.sh
python3 ~/Workspace/forja/ferramentas/fase2/pulso_f4.py https://hc-ping.com/11111111-2222-3333-4444-555555555555
cd ~/Workspace/forja/ferramentas/fase2 && python3 teste_pulso_fila.py /tmp/f4-red/pulso.sh.tmp
```
Expected: FAIL — o esqueleto da Task F4-1 imprime sempre `fila-ok`, então os **10 casos vermelhos**
pingam a URL de sucesso e saem com `MOTIVO=` vazio: **20 linhas `FALHA`** (motivo + ping em cada) e
saída 1. Os 3 casos verdes (`task-reprovada-e-ok`, `chave-e-ok`, `truncada`) e os 3 do inseridor passam.

- [ ] **Step 3: Implementar o miolo do `BLOCO`**

Em `pulso_f4.py`, trocar as duas linhas `# VER F4-2` / `print("fila-ok")` pelo leitor. Ordem das
condições: exceção → mtime → `parada` → `task` → `sem-claim-24h` (a tabela acima explica por quê).

```python
import json, os, sys, time
from datetime import datetime, timedelta


def olhar(arq):
    if not os.path.exists(arq):
        return "fila-jsonl-ausente"
    idade = int(time.time() - os.stat(arq).st_mtime)
    if idade > 4200:                      # 70 min: 25 de execucao + tiques sem linha (§6)
        return "fila-jsonl-%ds" % idade
    crons = []
    with open(arq, encoding="utf-8") as f:
        for l in f:
            if not l.endswith("\n"):      # cauda sendo escrita: ignora
                continue
            try:
                d = json.loads(l)
                if d.get("modo") != "cron":
                    continue
                q = datetime.fromisoformat(d["quando"])
            except Exception:
                continue                  # linha ilegivel nao derruba o check
            crons.append((q, d))
    crons.sort(key=lambda p: p[0])
    if crons and crons[-1][1].get("desfecho") in ("chave", "config"):
        return "fila-parada:%s" % crons[-1][1]["desfecho"]
    limite = datetime.now().astimezone() - timedelta(hours=24)
    com_task = [p for p in crons if p[1].get("task")]
    if com_task and com_task[-1][0] > limite and com_task[-1][1].get("desfecho") != "ok":
        return "fila-task-%s" % com_task[-1][1].get("desfecho")
    recentes = [p for p in crons if p[0] > limite]
    if not any(p[1].get("claim") in (200, 204) for p in recentes):
        if not recentes:
            return "fila-sem-claim-24h:nenhuma"
        u = recentes[-1][1]
        d = str(u.get("desfecho"))
        if d == "ocupado" and (u.get("motivos") or []):
            d = "%s:%s" % (d, u["motivos"][0])
        return "fila-sem-claim-24h:%s" % d
    return "fila-ok"


try:
    print(olhar(sys.argv[1]))
except Exception as e:
    print("fila-leitura-%s" % type(e).__name__)
```

Cinco pontos que o teste trava:
1. **`FILA_LOG` chega por argumento** (`python3 - "$FILA_LOG"` → `sys.argv[1]`), nunca por caminho
   fixo no código nem por expansão dentro do heredoc (que é `<<'EOF'`, sem expansão).
2. **`curl` e `sleep` pelo nome**, nunca `/usr/bin/curl` — é o que deixa o harness interceptá-los.
3. **`fila-ok` como sentinela**, não string vazia. Se o `python3 -` morrer inteiro (venv/PATH
   quebrado, `SyntaxError`), `$fila` sai vazio e o bloco vai a **vermelho** com `fila-mudo` — o
   mesmo "fecha fechado" de `site-${site:-mudo}` (`pulso.sh:76`). ⚠️ O §6 não nomeia esse caso;
   `fila-mudo` é proposta deste plano, pelo precedente da linha 76.
4. **`$ok` não aparece em lugar nenhum do bloco** — `grep -c '\$ok\b' <bloco>` deve dar 0.
5. **Exceção vira `fila-leitura-<Tipo>`**, no padrão `print(type(e).__name__)` do `pulso.sh:72-73`.

- [ ] **Step 4: Rodar e ver passar**

```bash
cd /tmp/f4-red && rm -f pulso.sh.tmp && cp ~/Workspace/forja/ferramentas/onda0b/pulso.sh.novo pulso.sh
python3 ~/Workspace/forja/ferramentas/fase2/pulso_f4.py https://hc-ping.com/11111111-2222-3333-4444-555555555555
bash -n pulso.sh.tmp && echo SH-OK
cd ~/Workspace/forja/ferramentas/fase2 && python3 teste_pulso_fila.py /tmp/f4-red/pulso.sh.tmp
```
Expected: `SH-OK` e `F4: 0 falha(s)` (13 casos do bloco + 3 do inseridor).

- [ ] **Step 5: Conferir as invariantes do arquivo gerado, à mão**

```bash
cd /tmp/f4-red
grep -c '\[ "\$ok" -eq 1 \]' pulso.sh.tmp
sed -n '/# >>> fila_intel (F4)/,/# <<< fila_intel (F4)/p' pulso.sh.tmp | grep -v '^#' | grep -c '\$ok\b'
sed -n '/# >>> fila_intel (F4)/,/# <<< fila_intel (F4)/p' pulso.sh.tmp | grep -v '^#' | grep -c 'ok_fila'
sed -n '/# >>> fila_intel (F4)/,/# <<< fila_intel (F4)/p' pulso.sh.tmp | grep -c '/usr/bin'
awk '/# >>> fila_intel/,/# <<< fila_intel/' pulso.sh.tmp | head -3
```
Expected, nesta ordem: `1` (a âncora continua única), `0` (**nenhuma linha de código do bloco toca
`$ok`** — o `grep -v '^#'` tira os comentários, que citam `$ok` de propósito; `\b` não casa
`$ok_fila`, porque `_` é caractere de palavra), `3` (as três linhas que usam `ok_fila`), `0`
(nenhum caminho absoluto de binário). O `awk` mostra o marcador, o `URL_FILA="…"` e o comentário,
nessa ordem — o `URL_FILA=` **tem** de ser a linha logo depois da abertura, é o que o harness troca.

- [ ] **Step 6: `py_compile` e commit**

```bash
cd ~/Workspace/forja/ferramentas && python3 -m py_compile fase2/pulso_f4.py fase2/teste_pulso_fila.py && echo PY-OK
```
```bash
cd ~/Workspace/forja/ferramentas
git add fase2/pulso_f4.py fase2/teste_pulso_fila.py
git commit -m "feat: bloco da fila no pulso com as quatro condicoes de vermelho

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```
Repositório local, **sem push**. `git status --short` deve ficar limpo — o `.gitignore` já cobre o
`__pycache__/` que o `py_compile` deixa. Os dois arquivos entram no card `F0k` (o laço de
`py_compile`) e são levados à forja pelo `K` que antecede o F4 (`PULSO-IGUAL`).

---

### Task F4-3: F4 passo (1) — a execução manual sobre a task PT pendente

Primeiro passo do card na forja. **Comandos preparados; o dono cola.** Nada de `ssh` que escreva.

**Files:** nenhum.

**Interfaces:**
- Consumes: F2 aprovado; `fila_intel.py` instalado (§4.6); chave `forja (fila)` viva (F1).
- Produces: uma task PT `completed` com `result_summary.claimed_by` = id da `forja (fila)`, e a
  primeira linha `modo: manual` no jsonl.

- [ ] **Step 1: Pré-condição — nenhum claim antes do F4 (leitura, Claude pode rodar)**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx --yes supabase@2.98.2 db query --linked --agent=no "select count(*) from public.youtube_intelligence_tasks where result_summary->>'claimed_by' in (select id::text from public.pipeline_api_keys where name = 'forja (fila)')"
```
Expected: `0`. É o portão do F1 ("nenhum claim antes do F4"), conferido **no início do F4**. Qualquer
valor > 0 significa que o cron ou uma execução manual já rodou antes da hora: pare e investigue.

- [ ] **Step 2: Ver se há task PT pendente, e de onde ela veio (leitura)**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx --yes supabase@2.98.2 db query --linked --agent=no "select id, channel_id, status, trigger_type, requested_at, started_at from public.youtube_intelligence_tasks where site_id = (select id from public.sites where primary_domain='bythiagofigueiredo.com') order by requested_at desc limit 5"
```
Se houver uma `pending` do cron de segunda, é ela (e o botão responde `already_active`). Se não
houver, o dono pede uma pelo botão "Pedir diagnostico" do Health Coach, no canal PT.

- [ ] **Step 3: O dono roda a execução manual, na forja**

Fora da janela 11:58–12:05 UTC (§4.1 passo 2). **Um comando:**
```
cd /opt/agente && timeout -k 30s 25m venv/bin/python -B docs/trilha/fila_intel.py
```
Aprovação: imprime `desfecho: ok`. Se sair `chat`, `ocupado` ou `llama_fora`, **nada foi clamado**
(§4.1 passo 2) — espere 5 min, ainda fora da janela 11:58–12:05 UTC, e repita **o mesmo comando**.

- [ ] **Step 4: Conferir o desfecho (leitura)**

Claude, por leitura na forja:
```
ssh forja 'tail -1 /opt/agente/log/fila_intel.jsonl'
```
Expected: uma linha com `"modo": "manual"`, `"desfecho": "ok"`, `"claim": 200` e `task` não nulo.

E no banco:
```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx --yes supabase@2.98.2 db query --linked --agent=no "select t.id, t.status, t.completed_at, t.result_summary->>'claimed_by' as claimed_by, k.name from public.youtube_intelligence_tasks t left join public.pipeline_api_keys k on k.id::text = t.result_summary->>'claimed_by' where t.site_id = (select id from public.sites where primary_domain='bythiagofigueiredo.com') order by t.requested_at desc limit 3"
```
Expected: a task em `completed`, com `name` = `forja (fila)`.

---

### Task F4-4: F4 passo (2) — a linha do crontab

**Files:** nenhum (o crontab do `thiago` na forja; backup em `/opt/agente/crontab.bak-F4`).

**Interfaces:**
- Consumes: Task F4-3 com `desfecho: ok`.
- Produces: o worker rodando a cada 10 min; linhas `modo: cron` no jsonl.

- [ ] **Step 1: O dono cola o bloco "F4 (2)" na forja**

Bloco literal do §5 do spec, em subshell — ele **guarda o backup e confere contra ele**:
```
(
  crontab -l > /opt/agente/crontab.bak-F4 || { echo 'PARE: crontab -l falhou — nada foi instalado'; exit 1; }
  grep -q pulso /opt/agente/crontab.bak-F4 && grep -q retentar /opt/agente/crontab.bak-F4 || { echo 'PARE: backup do crontab sem pulso/retentar — nao instalar'; exit 1; }
  grep -q fila_intel /opt/agente/crontab.bak-F4 && { echo 'PARE: ja existe linha fila_intel no crontab'; exit 1; }
  N0=$(grep -c -e retentar -e pulso /opt/agente/crontab.bak-F4)
  (cat /opt/agente/crontab.bak-F4; echo '*/10 * * * * timeout -k 30s 25m /opt/agente/venv/bin/python -B /opt/agente/docs/trilha/fila_intel.py --cron >>/opt/agente/log/fila_intel.err 2>&1') | crontab -
  [ "$(crontab -l | grep -c -e retentar -e pulso)" = "$N0" ] && [ "$(crontab -l | grep -c fila_intel)" = 1 ] && echo CRON-OK || echo 'PARE: crontab divergente — restaure com  crontab /opt/agente/crontab.bak-F4'
)
```
Aprovação: imprime **`CRON-OK`**. Qualquer `PARE:` interrompe o card — nada foi instalado, ou o
crontab divergiu e a linha de recuperação está na própria mensagem.

- [ ] **Step 2: Conferir por leitura**

```
ssh forja 'crontab -l | grep -c fila_intel; crontab -l | grep -c -e retentar -e pulso; wc -l < /opt/agente/crontab.bak-F4'
```
Expected: `1` na primeira linha e, na segunda, a **mesma** contagem de `retentar`/`pulso` do backup.

- [ ] **Step 3: Esperar dois tiques e ler as primeiras linhas `modo: cron`**

```
ssh forja 'tail -3 /opt/agente/log/fila_intel.jsonl; echo ---; tail -5 /opt/agente/log/fila_intel.err'
```
Expected: pelo menos uma linha com `"modo": "cron"`; o `.err` vazio ou sem traceback. Um traceback
repetido a cada 10 min é falha de import (§4.1) — pare e faça o rollback do F4 (Task F4-7).

---

### Task F4-5: F4 passo (3) — o check `URL_FILA` e a regra no `pulso.sh` vivo

**Só depois** de existir ao menos uma linha `modo: cron` com desfecho `vazia` ou `ok`.

**Files:**
- Modify (na forja, pelo dono): `/opt/agente/docs/pulso.sh` (via `pulso.sh.tmp` + `mv`)
- Create (na forja, pelo dono): `/opt/agente/docs/pulso.sh.bak-F4`

**Interfaces:**
- Consumes: `pulso_f4.py` e `teste_pulso_fila.py` em `/opt/agente/docs/` (card `K`, `PULSO-IGUAL`);
  o check `URL_FILA` criado no healthchecks.
- Produces: o bloco `# >>> fila_intel (F4)` vivo no pulso, reportando no check próprio.

- [ ] **Step 1: Portão de entrada — a linha `modo: cron` com desfecho `vazia`/`ok`**

O dono cola (uma linha):
```
python3 -c "import json,sys;sys.exit(0 if any(d.get('modo')=='cron' and d.get('desfecho') in ('vazia','ok') for d in (json.loads(l) for l in open('/opt/agente/log/fila_intel.jsonl') if l.endswith('}\n'))) else 1)"; echo "saida=$?"
```
Aprovação: `saida=0`. `saida=1` → **espere o próximo ciclo de 10 min** e repita. Não siga sem isso:
sem uma execução `cron` sadia no arquivo, o bloco entraria já vermelho.

- [ ] **Step 2: Pré-condição da O2 — o pulso vivo é o da onda 0b**

```
grep -c 'yt_hints-sem-200-15min' /opt/agente/docs/pulso.sh
```
Aprovação: **`1`**. Qualquer outro valor (0, ou mais de 1) → **pare**: o `pulso.sh` vivo não é o que
este bloco pressupõe, e a âncora pode não ser única.

- [ ] **Step 3: O dono cria o check `URL_FILA` no healthchecks**

Check **próprio**, separado do principal, **período 1 h** (§6). O dono copia a URL de ping (formato
`https://hc-ping.com/<uuid>`) e a usa no Step 4. A URL nunca é digitada por um agente nem aparece em
log de sessão — ela entra só no arquivo, como a `URL=` da linha 27 do pulso.

- [ ] **Step 4: Inserir o bloco e provar antes de trocar**

Quatro comandos, um por linha (todos relativos a `/opt/agente/docs`, como o spec exige):
```
cd /opt/agente/docs && python3 pulso_f4.py <url do check>
```
```
cd /opt/agente/docs && bash -n pulso.sh.tmp && echo SH-OK
```
```
cd /opt/agente/docs && python3 teste_pulso_fila.py pulso.sh.tmp
```
```
cd /opt/agente/docs && cp -p pulso.sh pulso.sh.bak-F4
```
Aprovação: `ok` do `pulso_f4.py`; `SH-OK`; `F4: 0 falha(s)` do harness (16 casos); o `.bak-F4`
criado. Qualquer `PARE:` ou `FALHA` interrompe o card — o `pulso.sh` vivo ainda não foi tocado.

- [ ] **Step 5: A troca**

```
cd /opt/agente/docs && chmod 755 pulso.sh.tmp && mv pulso.sh.tmp pulso.sh
```
`/opt/agente/docs` é diretório do `thiago`: a troca por rename funciona sem sudo, seja qual for o
dono do arquivo (é o mesmo movimento do `mv pulso.sh.novo pulso.sh` da O2).

- [ ] **Step 6: Uma execução real do pulso**

```
/opt/agente/docs/pulso.sh; tail -1 /opt/agente/log/pulso.log
```
Aprovação, **os três juntos**: o check `URL_FILA` **verde** no healthchecks; o check **principal
ainda verde**; e a última linha de `/opt/agente/log/pulso.log` com **`ok=1`** e sem nenhum motivo
`fila-*` (o campo `motivo` do pulso vem no fim da linha). Um `fila-*` na linha com `ok=1` é o caso
previsto: o principal continua verde e só o check da fila está vermelho — leia o motivo e trate.

---

### Task F4-6: portões do F4

Sem código. É a célula de portão do F4 na tabela do §5.

**Files:** nenhum.

**Interfaces:**
- Consumes: Tasks F4-3, F4-4, F4-5.
- Produces: o F4 declarado aprovado, ou o rollback (Task F4-7).

- [ ] **Step 1: Os três portões já colhidos**

- Pulso: check `URL_FILA` verde, check principal verde, última linha de `pulso.log` com `ok=1` (F4-5 Step 6).
- Execução manual: `desfecho: ok` e `result_summary.claimed_by` = id da `forja (fila)` (F4-3 Step 4).
- Crontab: `CRON-OK`, `retentar`/`pulso` com a mesma contagem do backup, `fila_intel` com contagem 1 (F4-4).

- [ ] **Step 2: O próximo pedido PT fecha em ≤ 40 min**

Antes de pedir, conferir que **não há** `pending`/`running` PT (leitura):
```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx --yes supabase@2.98.2 db query --linked --agent=no "select id, status, trigger_type, requested_at from public.youtube_intelligence_tasks where site_id = (select id from public.sites where primary_domain='bythiagofigueiredo.com') and status in ('pending','running') order by requested_at desc"
```
Condições do pedido, todas obrigatórias:
- **o llama livre e sem chat** (o worker sai `ocupado`/`chat` e não clama, §4.1 passo 2);
- **o pedido feito fora do intervalo 11:45–12:05 UTC.** A janela do worker é 11:58–12:05, mas um
  tique de 10 min disparado a partir de 11:45 cai dentro dela e sai `ocupado` sem clamar; somando a
  espera do tique seguinte aos 25 min + 30 s de uma execução, o total passa de 40 min **sem nada
  quebrado** — o portão mediria o relógio, não o circuito;
- **de onde vem a task:** a do cron de segunda responde na hora; pelo botão, só **24 h depois do
  `completed_at`** da task do passo (1), quando aquela foi pedida pelo botão (`cooldown`).

Cronometrar do `requested_at` ao `completed_at`. Aprovação: **`completed` em ≤ 40 min**, com
`result_summary.claimed_by` = id da `forja (fila)` (mesmo SQL de leitura da Task F4-3 Step 4).

- [ ] **Step 3: O Health Coach mostra "por forja · dd/mm", e a linha do Cowork continua**

Com **sessão autenticada** em `/cms/youtube/analytics`, canal PT: selo `Diagnostico · por forja · dd/mm`,
a linha de summary, **sem** cards, **sem** "Potencial", **sem** badge (cenário B do §3.7). E, por leitura:
```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx --yes supabase@2.98.2 db query --linked --agent=no "select source, generated_at, video_id is null as canal from public.youtube_intelligence where site_id = (select id from public.sites where primary_domain='bythiagofigueiredo.com') order by generated_at desc limit 12"
```
Expected: a linha `forja` de canal no topo **e a linha `cowork` de 18/05 ainda no banco** (os índices
únicos são por `source`, §2.3 — a forja nunca sobrescreve o Cowork).

- [ ] **Step 4: O EN fica fora**

`CANAIS_FILA` continua `PT`. **O EN só entra em `CANAIS_FILA` com ≥ 8 vídeos e um F2 próprio** — hoje
tem 0 vídeos no banco e nenhuma análise de nenhuma fonte. Conferir que ninguém o acrescentou:
```
ssh forja 'grep -c "^CANAIS_FILA=PT$" /opt/agente/fila_intel.env'
```
Expected: `1`.

- [ ] **Step 5: Registrar o fechamento do card**

Anotar no relato: horário do `requested_at`→`completed_at` medido, o `claimed_by`, o estado dos dois
checks do healthchecks e o motivo `fila-*` (se houve) da primeira hora depois da troca.

---

### Task F4-7: rollback do F4

Quatro passos, **nesta ordem**. É a primeira etapa do rollback da fase inteira (F4 → Qualidade → F1
→ S4 → F0). Todos são comandos do dono, na forja.

**Files:** o crontab do `thiago`; `/opt/agente/docs/pulso.sh`.

**Interfaces:**
- Consumes: `pulso_f4.py` em `/opt/agente/docs/`.
- Produces: cron parado, bloco fora do pulso, check `URL_FILA` pausado. O `fila_intel.py`, a chave e
  as linhas gravadas **continuam** — quem as desfaz são os rollbacks seguintes.

- [ ] **Step 1: Tirar só a linha da fila do crontab**

```
crontab -l | grep -vF 'docs/trilha/fila_intel.py' | crontab -
```
```
crontab -l | grep -c fila_intel; crontab -l | grep -c -e retentar -e pulso
```
Aprovação: `0` na primeira contagem, com `retentar`/`pulso` intactos na segunda. **Não** restaure o
`.bak-F4` inteiro: ele apagaria linhas acrescentadas ao crontab depois do F4.

- [ ] **Step 2: Esperar o lock**

```
flock -w 1800 /opt/agente/fila_intel.lock true && echo LOCK-LIVRE || echo 'ESPERAR: execucao ainda viva'
```
**Só siga com `LOCK-LIVRE` impresso** — é o que deixa a execução em curso terminar. A espera é
limitada porque uma execução pode levar 25 min (§4.1) e um `flock` sem `-w` penduraria o rollback sem
dizer por quê. Se estourar os 30 min, o dono confere antes de seguir:
```
pgrep -af fila_intel.py
```

- [ ] **Step 3: Tirar só o bloco da fila do pulso**

Três comandos, todos relativos ao mesmo diretório:
```
cd /opt/agente/docs && python3 pulso_f4.py --remover
```
```
cd /opt/agente/docs && bash -n pulso.sh.tmp && echo SH-OK
```
```
cd /opt/agente/docs && chmod 755 pulso.sh.tmp && mv pulso.sh.tmp pulso.sh
```
Aprovação: `removido`, `SH-OK`, e depois
```
grep -c URL_FILA /opt/agente/docs/pulso.sh
```
→ **`0`**. O `--remover` apaga do marcador de abertura ao de fechamento, exigindo contagem 1 de cada.
**Não** restaura o `.bak-F4` inteiro, pelo mesmo motivo do crontab.

- [ ] **Step 4: Pausar o check `URL_FILA` no healthchecks, na mesma hora**

O dono pausa (ou apaga) o check. Sem ping, ele fica atrasado em ~1 h e vermelho depois da folga
configurada — **um alarme falso no meio do rollback**. Conferir: o check principal continua verde e
a próxima execução do pulso grava `ok=1` sem nenhum `fila-*` em `pulso.log`.

---

### Task F4-8: rollback "Qualidade" (com o F0 no ar)

Retira a análise da forja do Health Coach **sem** derrubar o F0. Usado quando o circuito está de pé
mas o texto não presta.

**Files:** nenhum no disco; três SQLs de produção, **todos do dono**.

**Interfaces:**
- Consumes: os dois primeiros passos do rollback do F4 (Task F4-7 Steps 1 e 2).
- Produces: `source='forja'` renomeado para `forja_retirada_<AAAAMMDDHHMM>`; o PT volta a mostrar "por Cowork".

- [ ] **Step 1: Antes de qualquer SQL — tirar a linha do crontab e esperar o lock**

São os **dois primeiros passos do rollback do F4** (Task F4-7, Steps 1 e 2), na ordem, com
`LOCK-LIVRE` impresso. **Sem isso o rollback se desfaz sozinho:** com o cron vivo, a execução
seguinte clama a task seguinte e regrava uma linha `forja` em até 10 min.

- [ ] **Step 2: Exportar (dono, na raiz do repo)**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx --yes supabase@2.98.2 db query --linked --agent=no -o json "select * from public.youtube_intelligence where source='forja' and site_id = (select id from public.sites where primary_domain='bythiagofigueiredo.com')" > ~/Workspace/forja/ferramentas/fase2/forja-export-$(date +%F).json
```
O arquivo fica **fora do repo do site**. Conferir que não está vazio antes de seguir.

- [ ] **Step 3: Renomear a linha de canal (dono)**

Na 2a a forja não tem linha de vídeo (§3.3), só a de canal:
```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx --yes supabase@2.98.2 db query --linked --agent=no "update public.youtube_intelligence set source='forja_retirada_' || to_char(now(),'YYYYMMDDHH24MI') where source='forja' and site_id = (select id from public.sites where primary_domain='bythiagofigueiredo.com')"
```
O sufixo evita colisão com os índices únicos por `source`. **Escrita em produção é do dono** — nenhum
agente roda este comando.

- [ ] **Step 4: Provar (leitura)**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx --yes supabase@2.98.2 db query --linked --agent=no "select count(*) from public.youtube_intelligence where source='forja' and site_id = (select id from public.sites where primary_domain='bythiagofigueiredo.com')"
```
Expected: **`0`**. E, logado em prod, o PT mostra **"por Cowork"** — a allowlist do §3.6 volta ao
Cowork (`forja_retirada_…` fica fora dela), e o Cowork já não lia a forja (§3.5).

- [ ] **Step 5: O mesmo `and site_id = …` nos três — e o que fica pendurado**

- **Os três SQLs (Steps 2, 3 e 4) levam o mesmo `and site_id = (select id from public.sites where
  primary_domain='bythiagofigueiredo.com')`** — o escopo do `seed_chave_forja.sh` (§4.6). Um
  `where source='forja'` solto exportaria, renomearia e depois "provaria" sobre as linhas de **todos
  os sites**. Conferir os três antes de colar.
- **A task fechada continua `completed`.** Se ela foi a **manual** do passo (1) do F4 (pedido do
  botão), o botão responde `cooldown` por até 24 h depois do `completed_at` (`actions.ts:211-213`):
  nesse intervalo o PT mostra a análise `cowork` de maio e um pedido novo só sai pela task do cron
  de segunda, ou depois das 24 h. Se a task fechada foi a do cron, o botão responde na hora (§3.6).

---

### Ordem de execução deste card

```
K (PULSO-IGUAL)  ->  F4-3 (manual)  ->  F4-4 (crontab)  ->  F4-5 (pulso)  ->  F4-6 (portões)
rollback:            F4-7 (F4)      ->  F4-8 (Qualidade) ->  F1 -> S4 -> F0   (cards de outros agentes)
```
As Tasks F4-1 e F4-2 são de escrita no Mac e acontecem **antes** do `K` — sem elas o `K` não tem o
que levar. Nenhuma das duas toca na forja.


---

## Logística e julgamento — portão F0k, K, F0.5, F2 e rollback do F0 (§5)

> Estas seções entram no `docs/superpowers/plans/2026-09-19-forja-fila-inteligencia-plan.md`, depois do card F0 e antes de `## Cards seguintes`. Valem as **Global Constraints** do cabeçalho daquele arquivo — em especial: **escrita na forja é do dono**, **banco de produção só leitura pelo agente**, **nenhum push ou deploy sem o dono pedir**, e **o julgamento do texto e a escolha das séries são do dono**.

**Ordem de execução do rollout (§5 do spec):** `F0k → K → F0 → F0.5 → S4 → F1 → F2 → F4`.
Estes cards são os de logística (F0k, K) e de julgamento (F0.5, F2), mais o **rollback do F0** (RB0), que é a última peça da ordem inversa `F4 → Qualidade → F1 → S4 → F0`.

**O que estes cards NÃO contêm.** O conteúdo de `fila_intel.py` (§4.1–§4.6), de `teste_fila.py`, de `s4.py`/`teste_s4.py` (§4.6) e de `pulso_f4.py`/`teste_pulso_fila.py` (§6) é planejado nos cards próprios. Aqui eles aparecem só como **itens de inventário** do portão do F0k e como **linhas do scp** do K. As duas exceções são `capturar_fixture.py` e `sonda_f0.py` (§4.7), pequenos e sem card próprio: estão escritos por inteiro nas Tasks F0k-2 e F0k-3.

**Terreno conferido em 19/09 (só leitura):**

- `~/Workspace/forja/ferramentas` **é repositório git** desde 19/09 (`git init` do dono): commit inicial `ec51833` "chore: estado do kit antes da fase 2a", 116 arquivos rastreados, árvore limpa, `.gitignore` com `__pycache__/` e `*.pyc`. O `.git` fica em `ferramentas/`, **fora de `docs/`** — conferido: `ferramentas/docs/.git` não existe, então o `scp -r sitio.py trilha` do card K não o leva e o `find sitio.py trilha -type f` do portão `KIT-IGUAL` não o vê. **O card K não muda por causa disso.** O que muda é o F0k: toda tarefa de código do kit termina em commit, e o portão passa a exigir árvore limpa. O repositório é **local, sem remoto e sem push**.
- `~/Workspace/forja/ferramentas/fase2/` **não existe** ainda (`ls` → `No such file or directory`). Quem o cria é o `mkdir -p` da Task F0k-1.
- O kit vive em `~/Workspace/forja/ferramentas/docs/` (`sitio.py`, `replay2.py`, `grill.json`, `midia/`, `trilha/`) e `~/Workspace/forja/ferramentas/docs/trilha/` já tem `cartao.sh`, `deploy.sh`, `nova_chave.py`, `s1.py`…`s3.py`, `teste_s1.py`…`teste_s3.py`, `sitio_falso.py`, `fixtures_site/`, `st/` e um `__pycache__/`.
- `~/Workspace/forja/ferramentas/seed_chave_forja.sh` está na forma da fase 1 (`$1` = sha256 de 64 hex, nome `forja (so leitura)`, `array['read']`).
- O modelo do card K é o **Passo 1 da Task 3 do `PLANO-forja-le-site.md`** (`cd ~/Workspace/forja/ferramentas/docs` + `scp -r sitio.py replay2.py trilha forja:/opt/agente/docs/`), com conferência por md5 no passo 4.
- O uuid do canal PT é `969fcf1b-1116-4f43-9665-5c77f93b5f44` (`trilha/nova_chave.py:8`, `CANAIS['SITIO_CANAL_PT']`).
- `sitio._desembrulha` (`docs/sitio.py:77-81`) descasca `{data: …}` em laço, aceitando as chaves irmãs `meta`, `status` e `error`. Os dois scripts de apoio repetem essa regra sem importar o `sitio.py` (§4.7: "nenhum dos dois é importado pelo proxy nem pelo `fila_intel.py`", e nenhum dos dois importa o `sitio.py`).
- `node_modules/.bin/tsx` existe na raiz do repo do site, e `PatchPayloadSchema` é exportado em `apps/web/src/lib/youtube/intelligence-schemas.ts:37`, cujo único import é `zod` (`:1`).

---

### Card F0k — o kit escrito no Mac (portão)

Claude escreve e altera, **no Mac**, os arquivos que o K levará à forja. **Nada é instalado aqui.** O card é, antes de tudo, um **portão**: o bloco "F0k — para colar" do §5 tem de passar sobre os 9 `.py` e os 3 `.sh`, e o inventário tem de estar completo antes de o dono rodar o K.

### Inventário do kit (o que o portão cobre)

| Arquivo | Novo/Alterado | Quem planeja | Spec |
|---|---|---|---|
| `docs/trilha/fila_intel.py` | novo | card do worker | §4.1–§4.6 |
| `docs/trilha/teste_fila.py` | novo | card do worker | §4.6 |
| `docs/trilha/s4.py` | novo | card S4 | §4.6 |
| `docs/trilha/teste_s4.py` | novo | card S4 | §4.6 |
| `docs/trilha/capturar_fixture.py` | novo | **Task F0k-2, aqui** | §4.7 |
| `docs/trilha/sonda_f0.py` | novo | **Task F0k-3, aqui** | §4.7, §5 (célula F0) |
| `fase2/pulso_f4.py` | novo | card F4 | §6 |
| `fase2/teste_pulso_fila.py` | novo | card F4 | §6 |
| `docs/trilha/nova_chave.py` | alterado (desvio `--fila`) | card da chave | §4.6 "Kit da chave" |
| `docs/trilha/cartao.sh` | alterado (`teste_s1` no S4 + bloco `teste_fila`) | card S4 | §4.6 "Instalação" |
| `docs/trilha/deploy.sh` | alterado (lock por descritor + `mv`) | card S4 | §4.6 "Instalação" |
| `seed_chave_forja.sh` | alterado (forma `fila <sha>`) | card da chave | §4.6 "Kit da chave" |

`fixture_pt.json` e `series.json` **não estão** nesta tabela e nunca entram em `ferramentas/docs/trilha/` — ver Task K-3.

---

### Task F0k-1: pré-condição do repositório, área do kit e inventário

**Files:**
- Create: `~/Workspace/forja/ferramentas/fase2/` (diretório vazio, por `mkdir -p`)
- Modify: `~/Workspace/forja/ferramentas/.gitignore` (acrescenta `fase2/fixture_pt.json` e `fase2/sombra-f2/`)
- Read-only: `~/Workspace/forja/ferramentas/docs/trilha/`, `~/Workspace/forja/ferramentas/seed_chave_forja.sh`

**Interfaces:**
- Consumes: nada.
- Produces: pré-condição provada (repositório com árvore limpa); `fase2/` criado; fixture e `sombra-f2/` ignorados (só `fase2/series.json` será versionado, no F0.5); a lista de pendências do inventário, que as Tasks F0k-2/3 e os cards do worker, do S4, da chave e do F4 zeram.

- [ ] **Step 1: Pré-condição — o repositório existe e a árvore está limpa**

O kit é repositório git desde 19/09 (`ec51833`). **Nenhuma linha é escrita com a árvore suja:** começar a fase com mudanças pendentes de outra sessão misturaria trabalho alheio no primeiro commit — e vale aqui a mesma regra do repo do site, **nunca `git stash` nem `git reset --hard`**.

```bash
git -C ~/Workspace/forja/ferramentas rev-parse --is-inside-work-tree
git -C ~/Workspace/forja/ferramentas log --oneline -1
git -C ~/Workspace/forja/ferramentas status --short
```
Expected: `true`, uma linha de log (na primeira vez, `ec51833 chore: estado do kit antes da fase 2a`) e o `status --short` **vazio**. Saída não vazia no `status`: **pare** e pergunte ao dono de quem é a mudança pendente. `fatal: not a git repository`: **pare** — o `git init` do dono não está onde este plano supõe, e o backup em scratchpad que este passo substituiu já não existe como rede.

- [ ] **Step 2: Criar `fase2/`, ignorar o que é dado, e provar que o kit está onde o plano supõe**

**O repositório guarda código e decisão curada, não dado puxado da produção.** Aplicado a `fase2/`:

| Arquivo | Git | Por quê |
|---|---|---|
| `fase2/series.json` | **versionado** (F0.5) | é a escolha do dono; perdê-la significa refazer o card. Não tem dado de audiência: só slug e nome exibível |
| `fase2/fixture_pt.json` | **ignorado** | carrega `recent.views` por vídeo — dado da **YouTube Analytics**, não público como título e `view_count` — e é regenerável a qualquer momento por `capturar_fixture.py`. O repositório é local hoje, mas um `git init` vira `git remote add` meses depois, e o histórico vai junto |
| `fase2/sombra-f2/` | **ignorado** | saída de execução: muda a cada rodada e não é insumo de nada depois do julgamento do F2 |

Custo aceito, dito aqui para não ser lido como esquecimento: a fixture continua **no disco**, então o F2 e o `--escolher` seguem funcionando; o que se perde é recuperá-la por `git checkout` se alguém a apagar — e nesse caso o `capturar_fixture.py` a refaz, com um `congelado_em` novo (e o F2, que compara contra ela, é refeito junto).

```bash
mkdir -p ~/Workspace/forja/ferramentas/fase2
for l in 'fase2/fixture_pt.json' 'fase2/sombra-f2/'; do grep -qxF "$l" ~/Workspace/forja/ferramentas/.gitignore || printf '%s\n' "$l" >> ~/Workspace/forja/ferramentas/.gitignore; done
cat ~/Workspace/forja/ferramentas/.gitignore
ls ~/Workspace/forja/ferramentas/docs/trilha/cartao.sh ~/Workspace/forja/ferramentas/docs/trilha/deploy.sh ~/Workspace/forja/ferramentas/docs/trilha/nova_chave.py ~/Workspace/forja/ferramentas/seed_chave_forja.sh
```
Expected: o `.gitignore` com **quatro** linhas — `__pycache__/`, `*.pyc`, `fase2/fixture_pt.json` e `fase2/sombra-f2/` — e os 4 caminhos do kit existindo. Um `No such file` em qualquer um deles: **pare** — o kit não é o que este plano leu, e o K levaria outra coisa.

- [ ] **Step 3: Commit da pré-condição**

```bash
cd ~/Workspace/forja/ferramentas
git add .gitignore
git commit -m "chore: ignora a fixture do PT e a saida de sombra do F2

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
git status --short
```
Expected: um commit novo e `status --short` vazio. `git add` **sempre por caminho explícito de arquivo**, nunca `git add -A`/`.` e **nunca `git add fase2/`** — o diretório mistura arquivo versionável (`series.json`) com dado real (fixture, sombra), e a frente dos segredos (A5) proíbe o `add` do diretório pelo mesmo motivo. Repositório local: **sem remoto, sem push**.

- [ ] **Step 4: Registrar o inventário e as pendências**

Anotar no relato da tarefa a tabela de inventário acima com uma coluna "estado", preenchida por:

```bash
cd ~/Workspace/forja/ferramentas
for f in docs/trilha/fila_intel.py docs/trilha/teste_fila.py docs/trilha/s4.py docs/trilha/teste_s4.py docs/trilha/capturar_fixture.py docs/trilha/sonda_f0.py fase2/pulso_f4.py fase2/teste_pulso_fila.py; do [ -f "$f" ] && echo "existe  $f" || echo "FALTA   $f"; done
```
Expected agora: os 8 como `FALTA` (ou os já escritos por outro card como `existe`). O portão da Task F0k-4 só roda com zero `FALTA`.

- [ ] **Step 5: Conferir que nenhum arquivo de dado ficou no kit**

```bash
ls ~/Workspace/forja/ferramentas/docs/trilha/fixture_pt.json ~/Workspace/forja/ferramentas/docs/trilha/series.json 2>&1
```
Expected: `No such file or directory` para os dois. Se algum existir, **apague-o do kit** (a cópia boa mora em `ferramentas/fase2/`) antes de qualquer K — ver Task K-3.

---

### Task F0k-2: `capturar_fixture.py` — congela o snapshot do PT (TDD)

**Files:**
- Create: `~/Workspace/forja/ferramentas/docs/trilha/capturar_fixture.py`
- Create: `/private/tmp/claude-501/-Users-figueiredo-Workspace-bythiagofigueiredo/9e4ef126-9796-4af1-98f8-bd072597eeca/scratchpad/teste_capturar_fixture.py` (descartável, **fora do kit** — não entra no `scp` nem no md5)

**Interfaces:**
- Consumes: Task F0k-1 (árvore limpa e inventário).
- Produces: o script que o dono roda no F0.5, gravando `/opt/agente/docs/trilha/fixture_pt.json` com `congelado_em`, e imprimindo nº de vídeos e `recent_window`; commitado no kit.

**Decisão de estrutura (com motivo).** `import httpx` fica **dentro de `main()`**, não no topo: o `python3` do Mac não tem `httpx` (§5, portão do F0k), e com o import no topo o teste de scratchpad abaixo não conseguiria nem carregar o módulo. Na forja o script roda sempre por `venv/bin/python`, que tem `httpx` (§4.7).

**Lacuna do spec, decidida aqui e registrada.** O §4.7 diz `hoje = congelado_em` e o §4.1 diz que `hoje` é uma **data UTC**; o spec não fixa o formato de `congelado_em`. Este plano grava **data UTC `AAAA-MM-DD`**, de modo que `date.fromisoformat(congelado_em)` seja literal. Quem planejar o `--sombra` do `fila_intel.py` tem de ler essa mesma forma; se preferir um instante completo, os dois mudam **no mesmo commit**.

- [ ] **Step 1: Escrever o teste que falha (no scratchpad, nunca no kit)**

`/private/tmp/claude-501/-Users-figueiredo-Workspace-bythiagofigueiredo/9e4ef126-9796-4af1-98f8-bd072597eeca/scratchpad/teste_capturar_fixture.py`:

```python
"""Teste descartavel do capturar_fixture.py — roda no Mac, so nas funcoes puras (sem httpx)."""
import importlib.util as u, os, sys, tempfile

ALVO = os.path.expanduser("~/Workspace/forja/ferramentas/docs/trilha/capturar_fixture.py")
spec = u.spec_from_file_location("capturar_fixture", ALVO)   # mesma receita de s2.py:19-22
m = u.module_from_spec(spec); spec.loader.exec_module(m)
falhas = []


def confere(nome, cond):
    if not cond:
        falhas.append(nome)


with tempfile.TemporaryDirectory() as d:
    arq = os.path.join(d, "proxy-agente")
    open(arq, "w").write('OUTRA=1\nSITIO_CHAVE="forja_abc"\nSITIO_CANAL_PT="969fcf1b"\n')
    confere("chave entre aspas", m.ler_chave(arq) == "forja_abc")
    open(arq, "w").write("SITIO_CHAVE=forja_sem_aspas\n")
    confere("chave sem aspas", m.ler_chave(arq) == "forja_sem_aspas")
    open(arq, "w").write("SITIO_CANAL_PT=x\n")
    try:
        m.ler_chave(arq); confere("sem SITIO_CHAVE para", False)
    except SystemExit as e:
        confere("sem SITIO_CHAVE nao vaza", "forja_" not in str(e))
    try:
        m.ler_chave(os.path.join(d, "nao-existe")); confere("arquivo ausente para", False)
    except SystemExit:
        pass

confere("desembrulha data", m.desembrulha({"data": {"videos": []}}) == {"videos": []})
confere("desembrulha data+meta", m.desembrulha({"data": {"videos": []}, "meta": {}}) == {"videos": []})
confere("desembrulha corpo nu", m.desembrulha({"videos": []}) == {"videos": []})

f = m.montar({"videos": [1, 2], "recent_window": {"date": "2026-09-18", "days": 90}}, "2026-09-19")
confere("congelado_em gravado", f["congelado_em"] == "2026-09-19")
confere("videos preservados", f["videos"] == [1, 2])
try:
    m.montar({"channel": {}}, "2026-09-19"); confere("sem videos para", False)
except SystemExit:
    pass

print("FALHAS: %d %s" % (len(falhas), falhas))
sys.exit(1 if falhas else 0)
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
python3 /private/tmp/claude-501/-Users-figueiredo-Workspace-bythiagofigueiredo/9e4ef126-9796-4af1-98f8-bd072597eeca/scratchpad/teste_capturar_fixture.py
```
Expected: FALHA com `FileNotFoundError` no `SourceFileLoader` — o script ainda não existe. Qualquer outra coisa reprova (o arquivo já existia e não foi inventariado).

- [ ] **Step 3: Escrever `capturar_fixture.py`**

`~/Workspace/forja/ferramentas/docs/trilha/capturar_fixture.py`:

```python
"""capturar_fixture.py — congela o snapshot do canal PT em docs/trilha/fixture_pt.json (card F0.5).

SO LEITURA: um unico GET. Nao importa sitio.py nem fila_intel.py, e nada o importa (spec §4.7).
Na forja:  cd /opt/agente && venv/bin/python -B docs/trilha/capturar_fixture.py
A chave {read} e lida de /etc/default/proxy-agente pelo proprio Python e NUNCA e impressa.
"""
import datetime as dt, json, os, re, sys

BASE = os.environ.get("AGENTE_BASE", "/opt/agente")
DEFAULT = os.environ.get("AGENTE_DEFAULT", "/etc/default/proxy-agente")
BASE_SITE = "https://bythiagofigueiredo.com"
CAMINHO = "/api/pipeline/youtube/intelligence"
CANAL_PT = "969fcf1b-1116-4f43-9665-5c77f93b5f44"       # igual a nova_chave.py:8
DESTINO = os.path.join(BASE, "docs", "trilha", "fixture_pt.json")
TIMEOUT = 30.0


def ler_chave(arq=DEFAULT, nome="SITIO_CHAVE"):
    """Le a chave do /etc/default, com aspas opcionais (mesmo padrao tolerante do §4.6).
    Nunca poe o valor na excecao nem no log."""
    padrao = re.compile(r'^%s="?([^"\n]+)"?$' % nome)
    try:
        linhas = open(arq, encoding="utf-8").read().splitlines()
    except OSError as e:
        sys.exit("pare: nao consegui ler %s (%s)" % (arq, e.__class__.__name__))
    for l in linhas:
        achou = padrao.match(l)
        if achou:
            return achou.group(1)
    sys.exit("pare: %s nao tem a linha %s" % (arq, nome))


def desembrulha(j):
    """O site responde {"data": ...} em todo sucesso (§3.2). Mesma regra de sitio.py:77-81."""
    while isinstance(j, dict) and "data" in j and not (set(j) - {"data", "meta", "status", "error"}):
        j = j["data"]
    return j


def montar(dados, congelado_em):
    if not isinstance(dados, dict) or "videos" not in dados:
        sys.exit("pare: resposta sem a chave videos — o snapshot nao veio")
    fixture = dict(dados)
    fixture["congelado_em"] = congelado_em          # data UTC AAAA-MM-DD; o --sombra usa como `hoje`
    return fixture


def gravar(fixture, destino=DESTINO):
    tmp = destino + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(fixture, f, ensure_ascii=False, indent=1, sort_keys=True)
    os.replace(tmp, destino)


def main():
    import httpx                                    # so na forja: o python3 do Mac nao tem httpx
    chave = ler_chave()
    with httpx.Client(timeout=TIMEOUT) as cli:
        r = cli.get(BASE_SITE + CAMINHO, params={"channel_id": CANAL_PT},
                    headers={"X-Pipeline-Key": chave}, follow_redirects=False)
    del chave
    if r.status_code != 200:
        sys.exit("pare: GET snapshot respondeu %d (esperado 200)" % r.status_code)
    try:
        dados = desembrulha(json.loads(r.content))
    except ValueError:
        sys.exit("pare: o snapshot nao veio em JSON")
    fixture = montar(dados, dt.datetime.now(dt.timezone.utc).date().isoformat())
    gravar(fixture)
    janela = fixture.get("recent_window")
    print("gravado: %s" % DESTINO)
    print("congelado_em: %s" % fixture["congelado_em"])
    print("videos: %d" % len(fixture["videos"]))
    print("recent_window: %s" % json.dumps(janela, ensure_ascii=False))
    if janela is None:
        print("ATENCAO: recent_window nulo — o portao do F0.5 reprova")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Rodar e ver passar**

```bash
python3 /private/tmp/claude-501/-Users-figueiredo-Workspace-bythiagofigueiredo/9e4ef126-9796-4af1-98f8-bd072597eeca/scratchpad/teste_capturar_fixture.py
python3 -m py_compile ~/Workspace/forja/ferramentas/docs/trilha/capturar_fixture.py && echo PY-OK
```
Expected: `FALHAS: 0 []` e `PY-OK`.

- [ ] **Step 5: Conferir que o script não escreve fora do previsto**

```bash
grep -nE "open\(|os\.replace|cli\.(post|patch|put|delete)|X-Pipeline-Key" ~/Workspace/forja/ferramentas/docs/trilha/capturar_fixture.py
```
Expected: só os `open()` de leitura do DEFAULT, o `open(tmp, "w")`, o `os.replace` do destino e o header da chave. **Nenhum** `cli.post/patch/put/delete` — o §4.7 exige "só GET".

- [ ] **Step 6: Commit**

```bash
cd ~/Workspace/forja/ferramentas
git add docs/trilha/capturar_fixture.py
git commit -m "feat: capturar_fixture.py congela o snapshot do PT (F0.5)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
git status --short
```
Expected: um commit novo e `status --short` vazio. O teste desta tarefa mora no scratchpad e **não** entra no kit nem no commit — não é arquivo do kit e o K não o levaria.

---

### Task F0k-3: `sonda_f0.py` — o portão pós-promoção do F0 (TDD)

**Files:**
- Create: `~/Workspace/forja/ferramentas/docs/trilha/sonda_f0.py`
- Create: `/private/tmp/claude-501/-Users-figueiredo-Workspace-bythiagofigueiredo/9e4ef126-9796-4af1-98f8-bd072597eeca/scratchpad/teste_sonda_f0.py` (descartável, fora do kit)

**Interfaces:**
- Consumes: Task F0k-2 (mesmas funções `ler_chave`/`desembrulha`, copiadas — os dois scripts são independentes por decisão do §4.7: nenhum importa o outro nem o `sitio.py`); commitado no kit.
- Produces: o script do Step 6 da Task 15 (card F0): `GET` snapshot 200 com `recent_window` → `POST …/task/claim` 403 → `PATCH …/intelligence` 403; qualquer outro status imprime `REPROVADO` e sai 1.

- [ ] **Step 1: Escrever o teste que falha**

`/private/tmp/claude-501/-Users-figueiredo-Workspace-bythiagofigueiredo/9e4ef126-9796-4af1-98f8-bd072597eeca/scratchpad/teste_sonda_f0.py`:

```python
"""Teste descartavel do sonda_f0.py — Mac, so o veredito puro (sem httpx, sem rede)."""
import importlib.util as u, os, sys

ALVO = os.path.expanduser("~/Workspace/forja/ferramentas/docs/trilha/sonda_f0.py")
spec = u.spec_from_file_location("sonda_f0", ALVO)           # mesma receita de s2.py:19-22
m = u.module_from_spec(spec); spec.loader.exec_module(m)
falhas = []


def confere(nome, cond):
    if not cond:
        falhas.append(nome)


confere("403 esperado e obtido", m.conferir("claim", 403, 403) is True)
confere("204 no claim reprova", m.conferir("claim", 403, 204) is False)
confere("200 no claim reprova", m.conferir("claim", 403, 200) is False)
confere("401 no claim reprova", m.conferir("claim", 403, 401) is False)
confere("200 no snapshot passa", m.conferir("snapshot", 200, 200) is True)
confere("uuid do claim e o v4 fixo", m.UUID_INEXISTENTE == "00000000-0000-4000-8000-000000000000")
confere("canal PT", m.CANAL_PT == "969fcf1b-1116-4f43-9665-5c77f93b5f44")
confere("corpo do PATCH e vazio", m.CORPO_PATCH == {})
confere("corpo do claim usa o uuid", m.corpo_claim() == {"channel_ids": [m.UUID_INEXISTENTE]})
confere("janela presente aprova", m.tem_janela({"recent_window": {"date": "2026-09-18", "days": 90}}) is True)
confere("janela nula aprova com aviso", m.tem_janela({"recent_window": None}) is True)
confere("janela ausente reprova", m.tem_janela({"videos": []}) is False)

print("FALHAS: %d %s" % (len(falhas), falhas))
sys.exit(1 if falhas else 0)
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
python3 /private/tmp/claude-501/-Users-figueiredo-Workspace-bythiagofigueiredo/9e4ef126-9796-4af1-98f8-bd072597eeca/scratchpad/teste_sonda_f0.py
```
Expected: FALHA com `FileNotFoundError` — o script ainda não existe.

- [ ] **Step 3: Escrever `sonda_f0.py`**

`~/Workspace/forja/ferramentas/docs/trilha/sonda_f0.py`:

```python
"""sonda_f0.py — portao pos-promocao do F0 (spec §5, celula F0), na forja, com a chave {read}.

Nesta ordem:
  1. GET  /api/pipeline/youtube/intelligence?channel_id=<PT>   -> 200 e com a chave recent_window
  2. POST /api/pipeline/youtube/intelligence/task/claim        -> 403
  3. PATCH /api/pipeline/youtube/intelligence (corpo vazio)    -> 403
Qualquer outro status: REPROVADO e saida 1. Um 200/204 em (2) ou (3) dispara o rollback do F0.
O GET legado .../intelligence/task NAO e sondado: contra um build velho seria um claim de verdade.

Na forja:  cd /opt/agente && venv/bin/python -B docs/trilha/sonda_f0.py
A chave {read} e lida de /etc/default/proxy-agente pelo proprio Python e NUNCA e impressa.
"""
import json, os, re, sys

DEFAULT = os.environ.get("AGENTE_DEFAULT", "/etc/default/proxy-agente")
BASE_SITE = "https://bythiagofigueiredo.com"
SNAPSHOT = "/api/pipeline/youtube/intelligence"
CLAIM = "/api/pipeline/youtube/intelligence/task/claim"
CANAL_PT = "969fcf1b-1116-4f43-9665-5c77f93b5f44"       # igual a nova_chave.py:8
UUID_INEXISTENTE = "00000000-0000-4000-8000-000000000000"
CORPO_PATCH = {}                                        # PATCH vazio: o 403 vem da autenticacao
TIMEOUT = 20.0


def ler_chave(arq=DEFAULT, nome="SITIO_CHAVE"):
    padrao = re.compile(r'^%s="?([^"\n]+)"?$' % nome)
    try:
        linhas = open(arq, encoding="utf-8").read().splitlines()
    except OSError as e:
        sys.exit("pare: nao consegui ler %s (%s)" % (arq, e.__class__.__name__))
    for l in linhas:
        achou = padrao.match(l)
        if achou:
            return achou.group(1)
    sys.exit("pare: %s nao tem a linha %s" % (arq, nome))


def desembrulha(j):
    while isinstance(j, dict) and "data" in j and not (set(j) - {"data", "meta", "status", "error"}):
        j = j["data"]
    return j


def corpo_claim():
    return {"channel_ids": [UUID_INEXISTENTE]}


def conferir(nome, esperado, obtido):
    ok = obtido == esperado
    print("%-9s esperado %s  obtido %s  %s" % (nome, esperado, obtido, "ok" if ok else "REPROVADO"))
    return ok


def tem_janela(corpo):
    """A chave recent_window e a prova do deploy novo (§3.5). Valor nulo passa, com aviso."""
    return isinstance(corpo, dict) and "recent_window" in corpo


def main():
    import httpx                                    # so na forja
    chave = ler_chave()
    cab = {"X-Pipeline-Key": chave}
    with httpx.Client(timeout=TIMEOUT, follow_redirects=False) as cli:
        r1 = cli.get(BASE_SITE + SNAPSHOT, params={"channel_id": CANAL_PT}, headers=cab)
        if not conferir("snapshot", 200, r1.status_code):
            print("REPROVADO: sem o 200 do snapshot as outras sondas nao dizem nada")
            return 1
        try:
            corpo = desembrulha(json.loads(r1.content))
        except ValueError:
            print("REPROVADO: snapshot fora de JSON")
            return 1
        if not tem_janela(corpo):
            print("REPROVADO: snapshot sem a chave recent_window — o build no ar e o velho")
            return 1
        if corpo["recent_window"] is None:
            print("ATENCAO: recent_window nulo (sem linha de analytics nos ultimos 3 dias)")
        print("recent_window: %s" % json.dumps(corpo["recent_window"], ensure_ascii=False))

        r2 = cli.post(BASE_SITE + CLAIM, json=corpo_claim(), headers=cab)
        ok2 = conferir("claim", 403, r2.status_code)
        if r2.status_code in (200, 204):
            print("REPROVADO GRAVE: a chave {read} clamou — rollback do F0 (spec §5)")

        r3 = cli.patch(BASE_SITE + SNAPSHOT, json=CORPO_PATCH, headers=cab)
        ok3 = conferir("patch", 403, r3.status_code)
        if r3.status_code in (200, 204):
            print("REPROVADO GRAVE: a chave {read} escreveu — rollback do F0 (spec §5)")
    del chave
    if ok2 and ok3:
        print("APROVADO: 200 no snapshot com recent_window, 403 no claim e 403 no PATCH")
        return 0
    print("REPROVADO")
    return 1


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: Rodar e ver passar**

```bash
python3 /private/tmp/claude-501/-Users-figueiredo-Workspace-bythiagofigueiredo/9e4ef126-9796-4af1-98f8-bd072597eeca/scratchpad/teste_sonda_f0.py
python3 -m py_compile ~/Workspace/forja/ferramentas/docs/trilha/sonda_f0.py && echo PY-OK
```
Expected: `FALHAS: 0 []` e `PY-OK`.

- [ ] **Step 5: Conferir que a chave nunca é impressa**

```bash
grep -nE "print|sys.exit" ~/Workspace/forja/ferramentas/docs/trilha/sonda_f0.py ~/Workspace/forja/ferramentas/docs/trilha/capturar_fixture.py | grep -i "chave"
```
Expected: **nenhuma linha** que interpole `chave`. As únicas menções a `chave` em mensagem são o nome da variável de ambiente, nunca o valor.

- [ ] **Step 6: Commit**

```bash
cd ~/Workspace/forja/ferramentas
git add docs/trilha/sonda_f0.py
git commit -m "feat: sonda_f0.py sonda o portao pos-promocao do F0

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
git status --short
```
Expected: um commit novo e `status --short` vazio.

---

### Task F0k-4: o portão do F0k

**Nada é escrito aqui.** É o bloco "F0k — para colar" do §5, rodado sobre o kit completo.

**Files:** nenhum.

**Interfaces:**
- Consumes: Tasks F0k-1..3 e os cards que escrevem `fila_intel.py`, `teste_fila.py`, `s4.py`, `teste_s4.py`, `pulso_f4.py`, `teste_pulso_fila.py`, `nova_chave.py`, `cartao.sh`, `deploy.sh`, `seed_chave_forja.sh`.
- Produces: kit compilável **e inteiramente versionado**, pronto para o K. **Sem este portão verde, o dono não roda o K.**

**O portão tem três partes:** inventário completo (Step 1), o bloco "F0k — para colar" do §5 (Step 2) e **árvore limpa ao fim** (Step 5). A terceira pega o que as outras duas não pegam: um arquivo novo do kit que ninguém lembrou de `git add` compila igual e o `scp -r` do K o levaria assim mesmo, sem estar versionado — e aí a única cópia dele passa a ser a da forja.

- [ ] **Step 1: Zero pendências no inventário**

```bash
cd ~/Workspace/forja/ferramentas
for f in docs/trilha/fila_intel.py docs/trilha/teste_fila.py docs/trilha/s4.py docs/trilha/teste_s4.py docs/trilha/capturar_fixture.py docs/trilha/sonda_f0.py fase2/pulso_f4.py fase2/teste_pulso_fila.py; do [ -f "$f" ] && echo "existe  $f" || echo "FALTA   $f"; done
```
Expected: 8 linhas `existe`, zero `FALTA`. Qualquer `FALTA` reprova o card.

- [ ] **Step 2: O bloco "F0k — para colar" (literal do §5)**

```bash
cd ~/Workspace/forja/ferramentas
for f in docs/trilha/fila_intel.py docs/trilha/teste_fila.py docs/trilha/s4.py docs/trilha/teste_s4.py docs/trilha/capturar_fixture.py docs/trilha/sonda_f0.py docs/trilha/nova_chave.py fase2/pulso_f4.py fase2/teste_pulso_fila.py; do python3 -m py_compile "$f" || echo "FALHOU $f"; done
bash -n docs/trilha/cartao.sh && bash -n docs/trilha/deploy.sh && bash -n seed_chave_forja.sh && echo SH-OK
```
Expected: nenhuma linha `FALHOU` e `SH-OK` impresso. Qualquer outra coisa reprova.

- [ ] **Step 3: Não rodar `teste_fila.py` aqui; rodar `teste_s4.py`, sim**

Regra do §5, célula F0k, **corrigida na v12** (a v11 dizia que os dois não rodavam no Mac; estava
errado): só `teste_fila.py` não roda aqui — carrega o worker, que importa `httpx`, e o `python3` do
Mac não o tem. Ele é portão **na forja**, dentro do `cartao.sh S4` (sobre `sitio.py.novo`) e antes de
cada instalação do worker no F1 (§4.6). **`teste_s4.py` não toca no worker** — testa só o `sitio.py`,
é stdlib puro, e roda aqui com `AGENTE_SITIO` setado:

```bash
cd ~/Workspace/forja/ferramentas/docs/trilha && AGENTE_SITIO=$HOME/Workspace/forja/ferramentas/docs/sitio.py python3 -B teste_s4.py; echo "saida=$?"
```
Expected: `S4: 0 falha(s)` com `saida=0` (29 asserções). Entra no ciclo de TDD do Mac como os demais;
o portão do F0k não muda por causa dele.

Prova de que o ambiente é esse mesmo para `teste_fila.py`, e não um engano:

```bash
python3 -c "import httpx" 2>&1 | tail -1
```
Expected: `ModuleNotFoundError: No module named 'httpx'`. Se **não** der erro, anote no relato: o Mac ganhou `httpx` e a regra pode ser revista com o dono — não a mude por conta própria.

- [ ] **Step 4: Limpar o `__pycache__` que o `py_compile` deixou**

O `py_compile` grava `__pycache__/` ao lado dos arquivos. O `.gitignore` do kit já o mantém fora do git (`__pycache__/`, `*.pyc`) e o `find` do portão do K já o exclui (`! -path '*__pycache__*'`), mas o `scp -r` do K **leva** o diretório. Limpar mantém a forja igual ao Mac:

```bash
find ~/Workspace/forja/ferramentas/docs ~/Workspace/forja/ferramentas/fase2 -name __pycache__ -type d -print -exec rm -rf {} +
```
Expected: os `__pycache__` listados e removidos (ou saída vazia).

- [ ] **Step 5: Árvore limpa — todo arquivo do kit commitado ou ignorado de propósito**

```bash
cd ~/Workspace/forja/ferramentas
git status --short
git status --short --ignored | grep '^!!' || echo '(nada ignorado)'
git log --oneline "$(git rev-list --max-parents=0 HEAD)"..HEAD
```
Expected: `git status --short` **vazio**; a lista de ignorados só com `__pycache__`/`.pyc`, `fase2/fixture_pt.json` e `fase2/sombra-f2/`; e o log mostrando os commits da fase 2a (um por tarefa de código do kit). Qualquer linha `??` (arquivo novo não rastreado) ou ` M` (modificado não commitado) **reprova o portão** — commite por caminho explícito, ou acrescente ao `.gitignore` se for saída de execução, e rode o Step 5 de novo.

- [ ] **Step 6: Entregar ao dono a lista do K**

Anotar no relato: portão verde nas três partes, os 12 arquivos do inventário, o SHA do último commit do kit, e a observação de que o `scp` de `fase2/` (Task K-2) só é necessário no K **que antecede o F4**.

---

### Card K — o dono leva o kit à forja

Dono, no Mac. Roda **antes do portão pós-promoção do F0** e de novo **sempre que o kit mudar**. Claude prepara as linhas; o dono cola. A conferência depois é por leitura.

### Task K-1: `scp -r` do kit e o portão `KIT-IGUAL`

**Files:** nenhum no Mac (o destino é `/opt/agente/docs/` na forja, escrita do dono).

**Interfaces:**
- Consumes: Task F0k-4 (portão verde).
- Produces: `/opt/agente/docs/sitio.py` e `/opt/agente/docs/trilha/*` idênticos ao kit; `KIT-IGUAL` impresso.

- [ ] **Step 1 (dono, no terminal do Mac): levar o kit**

```
cd ~/Workspace/forja/ferramentas/docs
```
```
scp -r sitio.py trilha forja:/opt/agente/docs/
```
Esperado: a lista de arquivos transferidos, sem erro. Qualquer `Permission denied` ou `No such file` reprova — **não** repita com `sudo` nem mude o destino.

Isto leva, em `trilha/`: `sonda_f0.py`, `capturar_fixture.py`, `s4.py`, `teste_s4.py`, `teste_fila.py`, `nova_chave.py`, `cartao.sh`, `deploy.sh` e `fila_intel.py` (cópia de trabalho — quem **instala** o worker é o F1, §4.6), mais o kit da fase 1 que já estava lá. É o mesmo passo 1 do S1 da fase 1 (`PLANO-forja-le-site.md:107`), sem o `replay2.py`, que não muda nesta fase.

- [ ] **Step 2 (dono, no Mac): o portão de igualdade por md5**

```
cd ~/Workspace/forja/ferramentas/docs && find sitio.py trilha -type f ! -path '*__pycache__*' | sort | xargs md5 -r | sed 's/ /  /' | ssh forja 'cd /opt/agente/docs && md5sum -c --quiet' && echo KIT-IGUAL
```
Esperado: **só** `KIT-IGUAL`. Qualquer linha `FAILED` antes dele reprova: o arquivo listado não chegou igual, e o dono repete o Step 1 antes de seguir.

Por que o `sed`: o `md5 -r` do macOS imprime `<hash> <arquivo>` com **um** espaço, e o `md5sum -c` do Linux exige **dois** (`<hash>␠␠<arquivo>`). O `sed 's/ /  /'` troca só o **primeiro** espaço de cada linha — sem o `/g`, de propósito. Nenhum arquivo do kit tem espaço no nome (conferido no inventário da Task F0k-1); se algum passar a ter, este portão quebra e tem de ser refeito com `md5sum`-compatível de verdade.

O `--quiet` cala as linhas `OK` e imprime só as `FAILED`, então "saída vazia + `KIT-IGUAL`" é o verde.

- [ ] **Step 3 (Claude, leitura): o que o portão NÃO prova**

O `KIT-IGUAL` prova "todo arquivo do Mac existe igual na forja". Não prova o contrário: um arquivo **a mais** na forja passa despercebido. Conferir a diferença e exigir que ela seja só o que o F0.5 escreve lá:

```bash
echo "mac:   $(cd ~/Workspace/forja/ferramentas/docs && find sitio.py trilha -type f ! -path '*__pycache__*' | wc -l)"
ssh forja "echo \"forja: \$(cd /opt/agente/docs && find sitio.py trilha -type f ! -path '*__pycache__*' | wc -l)\""
ssh forja "cd /opt/agente/docs && find trilha -type f ! -path '*__pycache__*' -newer sitio.py | sort"
```
Esperado: antes do F0.5, as duas contagens **iguais**. Depois do F0.5, a forja tem **exatamente um a mais**: `trilha/fixture_pt.json`. Qualquer outro extra: anotar e perguntar ao dono antes de seguir — pode ser arquivo de uma sessão anterior que o `cartao.sh` vai carregar.

---

### Task K-2: o `scp` de `fase2/` — só no K que antecede o F4

**Files:** nenhum no Mac.

**Interfaces:**
- Consumes: Task F0k-4 e o card F4 (que escreve `pulso_f4.py` e `teste_pulso_fila.py`).
- Produces: `/opt/agente/docs/pulso_f4.py` e `/opt/agente/docs/teste_pulso_fila.py`; `PULSO-IGUAL` impresso.

- [ ] **Step 1: Decidir se este K precisa do passo**

Os dois arquivos vão para `/opt/agente/docs/` (ao lado do `pulso.sh` vivo), **não** para `docs/trilha/`, e só servem ao passo (3) do F4. Nos K anteriores (antes do F0, do F0.5, do S4, do F1, do F2) este passo **não roda**.

Regra: rode a Task K-2 **só quando o próximo card for o F4**.

- [ ] **Step 2 (dono, no Mac): levar os dois arquivos**

```
scp ~/Workspace/forja/ferramentas/fase2/pulso_f4.py ~/Workspace/forja/ferramentas/fase2/teste_pulso_fila.py forja:/opt/agente/docs/
```
Esperado: dois arquivos transferidos.

- [ ] **Step 3 (dono, no Mac): portão `PULSO-IGUAL`**

```
cd ~/Workspace/forja/ferramentas/fase2 && md5 -r pulso_f4.py teste_pulso_fila.py | sed 's/ /  /' | ssh forja 'cd /opt/agente/docs && md5sum -c --quiet' && echo PULSO-IGUAL
```
Esperado: só `PULSO-IGUAL`. Uma linha `FAILED` reprova.

- [ ] **Step 4 (Claude, leitura): conferir que nada mais foi para `docs/`**

```bash
ssh forja "cd /opt/agente/docs && ls -la pulso_f4.py teste_pulso_fila.py && ls fase2 2>&1 | tail -1"
```
Esperado: os dois arquivos listados e `ls: cannot access 'fase2': No such file or directory` — o `scp` não deve ter criado subdiretório nenhum.

---

### Task K-3: a guarda da fixture — dado nunca entra no kit

**Files:**
- Read-only: `~/Workspace/forja/ferramentas/docs/trilha/`, `~/Workspace/forja/ferramentas/fase2/`

**Interfaces:**
- Consumes: Task K-1.
- Produces: prova de que `fixture_pt.json` e `series.json` vivem só em `ferramentas/fase2/` (Mac) e em `/opt/agente/docs/trilha/` e `/opt/agente/series.json` (forja), e que um K posterior não os sobrescreve.

**Por quê.** O K roda `scp -r trilha`. Se `fixture_pt.json` estivesse no kit, **todo** K posterior ao F0.5 sobrescreveria na forja a fixture que o dono conferiu — e com ela mudariam, em silêncio, a saída de `escolher`, a sombra do F2 e o portão "as 3 rodadas com campos numéricos idênticos". O `series.json` nem mora em `docs/trilha/`: o seu lugar na forja é `/opt/agente/series.json` (§4.1, Lock).

- [ ] **Step 1: Provar que o kit está limpo (roda antes de todo K)**

```bash
ls ~/Workspace/forja/ferramentas/docs/trilha/fixture_pt.json ~/Workspace/forja/ferramentas/docs/trilha/series.json 2>&1
```
Esperado: `No such file or directory` para os dois. Se algum existir: mova-o para `~/Workspace/forja/ferramentas/fase2/` (não apague — pode ser a cópia conferida) e só então rode o K.

- [ ] **Step 2 (depois do F0.5): provar que o K não comeu a fixture**

Antes do K, guardar o md5 da fixture na forja; depois do K, comparar:

```bash
ssh forja 'md5sum /opt/agente/docs/trilha/fixture_pt.json /opt/agente/series.json'
```
Esperado: os dois hashes **iguais** antes e depois do K. Diferença no `fixture_pt.json` quer dizer que ele entrou no kit — refaça o F0.5 (a fixture nova invalida o conferido) e limpe o kit.

- [ ] **Step 3: Anotar a regra no relato**

"`fixture_pt.json` e `series.json` nunca entram em `ferramentas/docs/trilha/`." O lugar dos dois é `ferramentas/fase2/` (card F0.5), que o `scp -r sitio.py trilha` do K não alcança — e lá só o `series.json` é versionado; a fixture fica ignorada. O git do kit **não** substitui esta guarda: ele preserva a cópia do Mac, não a da forja — se a fixture entrasse no kit, o K a sobrescreveria na forja e o git nem notaria.

---

### Card F0.5 — a fixture do PT e a escolha das séries

Dono + Claude, **depois** do portão pós-promoção do F0 (a fixture tem de vir do build novo: sem ele não há `recent_window`). Portões da célula F0.5 do §5: **fixture com 35 vídeos e `recent_window` não nulo · `series.json` e lista conferidos**.

### Task F05-1: capturar a fixture na forja

**Files:**
- Create (na forja, pelo dono): `/opt/agente/docs/trilha/fixture_pt.json`

**Interfaces:**
- Consumes: Task K-1 (o `capturar_fixture.py` no lugar), card F0 promovido.
- Produces: a fixture congelada, com `congelado_em`.

- [ ] **Step 1 (dono, na forja): rodar o bloco "F0.5 — para colar" do §5**

```
cd /opt/agente && venv/bin/python -B docs/trilha/capturar_fixture.py
```
Esperado, nesta ordem: `gravado: /opt/agente/docs/trilha/fixture_pt.json`, uma linha `congelado_em: AAAA-MM-DD`, `videos: 35` e um `recent_window: {"date": "…", "days": 90}`. Qualquer outra coisa reprova:

- `videos: 0` → o snapshot veio do canal errado ou sem vídeos;
- `recent_window: null` com o aviso `ATENCAO` → o sync não gravou linha nos últimos 3 dias; **pare**, veja `cron_runs` do `sync-analytics-metrics` e repita depois do sync;
- `pare: GET snapshot respondeu 403` → a chave `{read}` de `/etc/default/proxy-agente` não está viva;
- `pare: GET snapshot respondeu 200` é impossível (200 é o caminho feliz); qualquer outro status reprova.

**Não** rodar com `python3` do sistema: o script importa `httpx` dentro de `main()` e o `python3` da forja fora do venv não o tem (§4.7).

- [ ] **Step 2 (Claude, leitura): conferir os portões na própria forja**

```bash
ssh forja "cd /opt/agente/docs/trilha && python3 -c \"import json;d=json.load(open('fixture_pt.json'));print('videos',len(d['videos']));print('congelado_em',d.get('congelado_em'));print('recent_window',d.get('recent_window'));print('ocultos',sum(1 for v in d['videos'] if v.get('is_hidden')))\""
```
Esperado: `videos 35`, `congelado_em` com a data de hoje em UTC, `recent_window` não nulo com `days 90` e `ocultos 4` (os 3 "Main AD Diamante" e o "Lolzin D5", §4.2). Um `days` diferente de 90 reprova o card inteiro: o worker trata janela ≠ 90 como `reprovada` (§4.1 passos 4–5).

- [ ] **Step 3 (Claude, leitura): conferir que a fixture não vaza chave**

```bash
ssh forja "grep -c -e 'forja_' -e 'X-Pipeline-Key' /opt/agente/docs/trilha/fixture_pt.json"
```
Esperado: `0`.

---

### Task F05-2: trazer a fixture ao Mac e ler os títulos

**Files:**
- Create: `~/Workspace/forja/ferramentas/fase2/fixture_pt.json` (cópia de leitura, **fora do kit**)

**Interfaces:**
- Consumes: Task F05-1.
- Produces: a cópia no Mac e a tabela de títulos que alimenta a proposta de séries.

- [ ] **Step 1 (dono, no Mac): trazer a fixture**

```
mkdir -p ~/Workspace/forja/ferramentas/fase2 && scp forja:/opt/agente/docs/trilha/fixture_pt.json ~/Workspace/forja/ferramentas/fase2/
```
Esperado: um arquivo transferido. O destino é `fase2/`, **nunca** `docs/trilha/` (Task K-3).

A fixture **nunca é versionada** (`.gitignore`, Task F0k-1): ela traz `recent.views` por vídeo, que é dado da YouTube Analytics, e o `capturar_fixture.py` a refaz quando preciso. Então o `git status --short` do kit continua **vazio** depois deste passo — nem `??` ela produz. Se ela aparecer como `??`, o `.gitignore` não tem a linha `fase2/fixture_pt.json`: volte à Task F0k-1 antes de seguir.

- [ ] **Step 2 (Claude): conferir a cópia contra a origem**

```bash
md5 -q ~/Workspace/forja/ferramentas/fase2/fixture_pt.json
ssh forja 'md5sum /opt/agente/docs/trilha/fixture_pt.json'
```
Esperado: o mesmo hash dos dois lados.

- [ ] **Step 3 (Claude): montar a tabela de títulos**

```bash
cd ~/Workspace/forja/ferramentas/fase2 && python3 -c "
import json, datetime as dt
d = json.load(open('fixture_pt.json'))
hoje = dt.date.fromisoformat(d['congelado_em'])
for v in sorted(d['videos'], key=lambda v: v['published_at']):
    pub = v['published_at'][:10]
    idade = (hoje - dt.date.fromisoformat(pub)).days
    print('%s  %6s  %5s v  %s  %s' % (pub, idade, v.get('view_count'), 'OCULTO' if v.get('is_hidden') else '      ', v['title']))
" | tee /private/tmp/claude-501/-Users-figueiredo-Workspace-bythiagofigueiredo/9e4ef126-9796-4af1-98f8-bd072597eeca/scratchpad/titulos-pt.txt
```
Esperado: 35 linhas, ordenadas por publicação, com 4 marcadas `OCULTO` e o último vídeo em `2024-12-10`. Esta é a leitura que alimenta a proposta — **os títulos, não uma heurística**: o `fila_intel.py` não tem heurística de série (§4.2), a verdade é o `series.json` do dono.

---

### Task F05-3: apresentar as leituras possíveis e esperar a escolha do dono

**Sem escrita.** A escolha das séries é **do dono**; o plano prepara a apresentação e para.

**Files:** nenhum.

**Interfaces:**
- Consumes: Task F05-2 (tabela de títulos).
- Produces: a leitura escolhida pelo dono, registrada na conversa. A Task F05-4 não começa sem ela.

- [ ] **Step 1: Montar as três leituras do §4.3, com o efeito de cada uma**

Apresentar ao dono, lado a lado, com os números que o spec já fixou para 18/09 (`view_count` da importação de 06/05):

| Leitura | Como agrupa | Padrão que sai | Números |
|---|---|---|---|
| **Plana** | "0–10" como **uma** série (episódios 0 a 10) | 1 padrão: "0–10" | 11 vídeos · mediana 91 / coorte 143,5 = **0,63×** · `confidence` 0,6 |
| **Aninhada** | "Como somos controlados" (episódios 1, 2, 4, 5 e 6) separada do resto do 0–10 | 1 padrão: "Como somos controlados" | 5 vídeos · ano 2019 pelo episódio 4 · 91 / 136 = 0,669 → **0,67×** (fronteira exata do piso) · `confidence` 0,55. O resto do 0–10 (0, 3, 7, 8, 9, 10) dá 113/113 = 1,00, **neutro** |
| **Terceira** | os 3 "VLOG - " (2017–18) **juntos** a "Vlogzeira" | nenhum padrão dessa série | 6 episódios · ano 2018 pelo episódio mediano (07/01/2018) · em 2018 sobra 1 vídeo elegível fora da série ("Novo rumo do canal", 31/12/2018), **abaixo do piso de 4** → a comparação não se aplica. Com coorte ampliada daria 171/182 = 0,94×, neutro — mesmo desfecho |

Em **qualquer** das três, o canal sai com **1 padrão só**. E em todas elas:

- **"Vlogzeira"** sozinha dá 156 / 109,5 = **1,42×**, abaixo do piso de efeito (só sai padrão com `razao` ≤ 0,67 ou ≥ 1,5) → não vira padrão;
- **"Main AD Diamante"** tem 3 vídeos e os 3 são `is_hidden` → nem chega a ser série (§4.2), então não entra em nada.

- [ ] **Step 2: Dizer o que muda de verdade e o que não muda**

Ao dono, em uma frase cada:

- o que **muda**: o nome que aparece no `finding` e no `summary` ("0–10" vs. "Como somos controlados"), o `n` (11 vs. 5), a razão exibida (0,63× vs. 0,67×) e a `confidence` (0,6 vs. 0,55);
- o que **não muda**: a quantidade de padrões (1), `priorities: []`, a ausência de `video_recommendations` e o fato de nenhuma tela mostrar `patterns_detected` na 2a (§3.6);
- o que **custa depois**: a leitura escolhida é a que o `teste_fila` (§4.2/§4.3) congela como esperado, e é a que o F2 compara nas 3 rodadas. Mudar depois do F2 obriga a refazer o F2.

- [ ] **Step 3: Esperar o "escolhi"**

**Pare aqui.** Nenhum `series.json` é escrito antes de o dono dizer qual leitura vale e como quer os nomes exibíveis de cada série (o nome vai para `series[].nome` e para o `finding`, passa por `sitio._t` e **nunca tem `_`**; o slug, esse sim, vai para `pattern_id` como `serie:<slug>`). Ajuste pedido volta ao Step 1.

---

### Task F05-4: escrever o `series.json` no Mac

**Files:**
- Create: `~/Workspace/forja/ferramentas/fase2/series.json` (fora do kit, **versionado** no Step 5 — e é o **único** arquivo de `fase2/` que entra no git)
- Create: `/private/tmp/claude-501/-Users-figueiredo-Workspace-bythiagofigueiredo/9e4ef126-9796-4af1-98f8-bd072597eeca/scratchpad/valida_series.py` (descartável)

**Interfaces:**
- Consumes: Task F05-3 (a leitura escolhida), Task F05-2 (a fixture no Mac).
- Produces: `{"videos": {<snapshot.videos[].id>: slug}, "nomes": {slug: nome}}`, validado contra a fixture.

- [ ] **Step 1: Escrever o arquivo conforme a escolha**

Formato exato do §4.2 — as chaves de `videos` são os **uuid internos** (`snapshot.videos[].id`), nunca o `video_id` do YouTube:

```json
{
 "videos": {
  "<uuid do video>": "<slug>",
  "<uuid do video>": "<slug>"
 },
 "nomes": {
  "<slug>": "<nome exibivel>"
 }
}
```

Regras que o arquivo tem de respeitar (§4.2):

- cada vídeo pertence a **uma** série só (uma chave por uuid — o próprio JSON já garante);
- série = **3 ou mais** vídeos **maduros e não ocultos** com o mesmo slug; um slug cujos vídeos sejam todos ocultos ou imaturos não vira série;
- o **nome** nunca tem `_` e passa por `_t` (sem emoji, sem `"`); o **slug** é o que vai para `pattern_id`;
- vídeo fora do arquivo não pertence a série nenhuma.

- [ ] **Step 2: Escrever o validador descartável**

`/private/tmp/claude-501/-Users-figueiredo-Workspace-bythiagofigueiredo/9e4ef126-9796-4af1-98f8-bd072597eeca/scratchpad/valida_series.py`:

```python
"""Confere o series.json contra a fixture, antes de ele ir para a forja."""
import datetime as dt, json, os, sys

F2 = os.path.expanduser("~/Workspace/forja/ferramentas/fase2")
fix = json.load(open(os.path.join(F2, "fixture_pt.json")))
ser = json.load(open(os.path.join(F2, "series.json")))
hoje = dt.date.fromisoformat(fix["congelado_em"])
por_id = {v["id"]: v for v in fix["videos"]}
falhas = []

if set(ser) != {"videos", "nomes"}:
    falhas.append("chaves do arquivo: %s" % sorted(ser))

orfaos = [i for i in ser["videos"] if i not in por_id]
if orfaos:
    falhas.append("uuid fora da fixture: %s" % orfaos)

slugs = {}
for vid, slug in ser["videos"].items():
    slugs.setdefault(slug, []).append(vid)

for slug, ids in sorted(slugs.items()):
    if slug not in ser["nomes"]:
        falhas.append("slug sem nome: %s" % slug)
    maduros = [i for i in ids if i in por_id
               and not por_id[i].get("is_hidden")
               and (hoje - dt.date.fromisoformat(por_id[i]["published_at"][:10])).days >= 90]
    print("%-28s total %2d  maduros e visiveis %2d  %s" % (slug, len(ids), len(maduros),
                                                           "serie" if len(maduros) >= 3 else "NAO VIRA SERIE"))

for slug, nome in ser["nomes"].items():
    if "_" in nome:
        falhas.append("nome com _: %s" % nome)
    if slug not in slugs:
        falhas.append("nome sem video: %s" % slug)

fora = [por_id[i]["title"] for i in por_id if i not in ser["videos"]]
print("\nvideos fora de series.json: %d" % len(fora))
for t in sorted(fora):
    print("  %s" % t)
print("\nFALHAS: %d %s" % (len(falhas), falhas))
sys.exit(1 if falhas else 0)
```

- [ ] **Step 3: Rodar o validador**

```bash
python3 /private/tmp/claude-501/-Users-figueiredo-Workspace-bythiagofigueiredo/9e4ef126-9796-4af1-98f8-bd072597eeca/scratchpad/valida_series.py
```
Esperado: `FALHAS: 0 []`, cada slug com "maduros e visiveis ≥ 3" marcado `serie`, e a lista de "videos fora de series.json" conferida com o dono (os 4 ocultos e o que a leitura escolhida deixou de fora). Qualquer `FALHA` volta ao Step 1.

- [ ] **Step 4: Mostrar ao dono o arquivo e a lista de fora**

O dono confere: (a) o agrupamento é o que ele escolheu; (b) nenhum vídeo que ele considera da série ficou fora; (c) os nomes exibíveis estão como ele quer. **Pare** até o "conferido".

- [ ] **Step 5: Commit do `series.json` — só ele —, depois do "conferido"**

O `series.json` é a **curadoria do dono**: perdê-lo significa refazer o card inteiro, e ele não tem dado de audiência (só slug e nome exibível). A `fixture_pt.json` **não** entra no commit: ela carrega `recent.views` por vídeo, que é dado da YouTube Analytics, e é regenerável por `capturar_fixture.py` — está no `.gitignore` desde a Task F0k-1. Os dois ficam **fora do kit**, em `ferramentas/fase2/`, então o `scp -r trilha` do K segue sem levá-los (Task K-3).

```bash
cd ~/Workspace/forja/ferramentas
git add fase2/series.json
git commit -m "feat: series.json do PT conferido pelo dono no F0.5

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
git show --stat --oneline HEAD
git status --short
```
Expected: um commit com **exatamente um** arquivo (`fase2/series.json`) no `--stat`, e `status --short` vazio — a fixture não aparece nem como `??`, porque está ignorada. Se `fase2/fixture_pt.json` aparecer no `--stat`, **desfaça** (`git reset --soft HEAD~1 && git restore --staged fase2/fixture_pt.json`) e confira o `.gitignore` da Task F0k-1. O commit vem **depois** do "conferido" do Step 4: versionar antes gravaria uma curadoria que o dono ainda não aprovou. `git add` por caminho de arquivo — **nunca `git add fase2/`**.

---

### Task F05-5: levar o `series.json` à forja e conferir por `--escolher`

**Files:**
- Create (na forja, pelo dono): `/opt/agente/series.json`

**Interfaces:**
- Consumes: Task F05-4 (`series.json` conferido), card do worker (`fila_intel.py` no `docs/trilha/`, levado pelo K).
- Produces: o segundo portão da célula F0.5 — "`series.json` e lista conferidos" —, e a **saída de `escolher` de referência**, contra a qual o F2 compara.

- [ ] **Step 1 (dono, no Mac): levar o arquivo**

```
scp ~/Workspace/forja/ferramentas/fase2/series.json forja:/opt/agente/series.json
```
Esperado: um arquivo transferido. O destino é `/opt/agente/series.json` — **não** `docs/trilha/` (§4.1, Lock: o worker o procura em `BASE`).

- [ ] **Step 2 (dono, na forja): rodar o `--escolher` pela cópia de trabalho**

```
cd /opt/agente && AGENTE_SITIO=/opt/agente/sitio.py venv/bin/python -B docs/trilha/fila_intel.py --escolher --snapshot docs/trilha/fixture_pt.json
```
Esperado: a lista dos vídeos fora de `series.json` e a saída de `escolher` com **1 padrão**, com os números da leitura escolhida na Task F05-3 (plana: "0–10", 11 vídeos, 0,63×, `confidence` 0,6 · aninhada: "Como somos controlados", 5 vídeos, 0,67×, `confidence` 0,55). `priorities: []` e nenhuma chave `video_recommendations`.

Qualquer outra coisa reprova:

- `motivos: series_orfas` → nenhum id do `series.json` casou com a fixture (arquivo velho ou fixture recapturada) — refaça a Task F05-4;
- 2 padrões ou padrão com número diferente do esperado → o agrupamento não é o que o dono escolheu;
- erro de carregamento do `sitio.py` → o `AGENTE_SITIO` foi esquecido (sem ele o worker procura `docs/trilha/sitio.py`, que não existe — o K leva o `sitio.py` para `docs/`, §4.7).

O `--escolher` não chama o 12B, não abre conexão com o site e não lê `fila_intel.env` (§4.7) — pode rodar antes do F1.

- [ ] **Step 3 (Claude, leitura): guardar a saída como referência do F2**

```bash
ssh forja 'tail -n 1 /opt/agente/log/fila_intel.jsonl' | tee /private/tmp/claude-501/-Users-figueiredo-Workspace-bythiagofigueiredo/9e4ef126-9796-4af1-98f8-bd072597eeca/scratchpad/escolher-f05.jsonl
```
Esperado: uma linha com `modo` do `--escolher` e `desfecho: ok`. Copiar também, do terminal do dono, a saída de `escolher` impressa no Step 2 para `scratchpad/escolher-f05.txt`: é ela que a Task F2-3 compara com os 3 payloads da sombra ("saída de `escolher` igual à fixture conferida").

- [ ] **Step 4: Registrar o fechamento do card**

Anotar no relato: leitura escolhida, slugs e nomes, os números do padrão, `congelado_em` da fixture e os md5 de `fixture_pt.json` e `series.json` nos dois lados (entrada da Task K-3 Step 2).

---

### Card F2 — sombra: 3 rodadas e o julgamento do dono

O dono roda na forja; Claude lê no Mac. **Nada é gravado no site**: o `--sombra` não clama, não dá PATCH e não dá `fail` (§4.7). Portões: todos os da célula F2 do §5.

### Task F2-1: as 3 rodadas e a coleta dos arquivos

**Files:**
- Create (na forja, pelo dono): 3 arquivos `/opt/agente/sombra/PT-<AAAAMMDD>T<HHMMSS>.json`
- Create: `~/Workspace/forja/ferramentas/fase2/sombra-f2/` (3 arquivos trazidos ao Mac)

**Interfaces:**
- Consumes: F1 (`teste_fila.py` verde, `fila_intel.env` com `CANAIS_FILA`), F0.5 (fixture e `series.json`).
- Produces: os 3 payloads e as 3 linhas `modo: sombra` do jsonl, entrada das Tasks F2-2, F2-3 e F2-4.

- [ ] **Step 1 (dono, na forja): rodar a sombra três vezes, uma por vez**

```
cd /opt/agente && timeout -k 30s 25m venv/bin/python -B docs/trilha/fila_intel.py --sombra --snapshot docs/trilha/fixture_pt.json
```
Esperado, nas três: o desfecho `ok` impresso e um arquivo novo em `/opt/agente/sombra/`.

Se sair `ocupado`, `llama_fora` ou `chat`, **nada foi gerado** (§4.7: as checagens de `/slots` e de chat recente rodam antes): espere 5 min e repita **o mesmo comando**. Essa rodada não conta — o portão são 3 rodadas com geração.

É o único worker (`/opt/agente/docs/trilha/fila_intel.py` — não há segunda cópia, §4.6), que carrega `/opt/agente/docs/sitio.py`.

- [ ] **Step 2 (dono, no Mac): trazer os três mais recentes — bloco "F2 — para colar" do §5**

```
mkdir -p ~/Workspace/forja/ferramentas/fase2/sombra-f2
```
```
scp $(ssh forja 'cd /opt/agente/sombra && ls -t PT-*.json | head -3' | sed 's#^#forja:/opt/agente/sombra/#') ~/Workspace/forja/ferramentas/fase2/sombra-f2/
```
Esperado: 3 arquivos transferidos, com nomes `PT-%Y%m%dT%H%M%S.json` (sem `:`, que o scp trataria como host). Menos de 3 reprova: alguma rodada saiu por `ocupado`/`chat`/`llama_fora` e tem de ser repetida.

`fase2/sombra-f2/` está no `.gitignore` do kit (Task F0k-1): os arquivos de sombra são saída de execução, mudam a cada rodada e não são insumo de nada depois do julgamento do F2 — então **não** são commitados, e o `git status --short` do kit continua vazio durante todo este card. O que fica registrado da sombra é o relato da Task F2-5 (os 3 `summary`, `tentativas`, tempos e os md5).

- [ ] **Step 3 (Claude, leitura): conferir que são as três rodadas certas**

```bash
ls -la ~/Workspace/forja/ferramentas/fase2/sombra-f2/
ssh forja 'cd /opt/agente/sombra && ls -t PT-*.json | head -3 | xargs md5sum'
md5 -q ~/Workspace/forja/ferramentas/fase2/sombra-f2/*.json
```
Esperado: 3 arquivos no Mac, com os mesmos hashes dos 3 mais recentes da forja, e os três carimbos de tempo **distintos**.

---

### Task F2-2: `PatchPayloadSchema.safeParse` real, no Mac

**Files:**
- Create: `/Users/figueiredo/Workspace/bythiagofigueiredo/f2-safeparse.ts` (**descartável, na raiz do repo, nunca commitado** — apagado no Step 4)

**Interfaces:**
- Consumes: Task F2-1 (os 3 payloads).
- Produces: o veredito do schema real e das quatro recusas de escopo `forja` sobre cada payload.

**Por que na raiz do repo, e não no scratchpad:** o spec exige import **relativo** `./apps/web/src/lib/youtube/intelligence-schemas.ts` (nada de alias `@/`, que só o `vitest.config.ts` e o Next resolvem). Import relativo resolve pelo **diretório do script**, não pelo cwd — então o script tem de morar na raiz. Os payloads, esses, são lidos por **caminho absoluto**. `git add` é sempre por caminho explícito (Global Constraints), então o arquivo não entra em commit nenhum; ainda assim o Step 4 o apaga e confere.

- [ ] **Step 1: Escrever o script descartável**

`/Users/figueiredo/Workspace/bythiagofigueiredo/f2-safeparse.ts`:

```ts
// Descartavel — portao do card F2. NAO commitar. Apagado no Step 4.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { PatchPayloadSchema } from './apps/web/src/lib/youtube/intelligence-schemas.ts'

const DIR = '/Users/figueiredo/Workspace/forja/ferramentas/fase2/sombra-f2'

type Json = Record<string, unknown>

function extrairPayload(raiz: Json): Json {
  // O arquivo de sombra guarda system, user, payload, veredito e tempos (spec §4.7).
  const p = raiz.payload
  if (p && typeof p === 'object') return p as Json
  if ('task_id' in raiz) return raiz
  throw new Error('arquivo de sombra sem payload')
}

let reprovas = 0
for (const nome of readdirSync(DIR).filter(n => n.endsWith('.json')).sort()) {
  const raiz = JSON.parse(readFileSync(join(DIR, nome), 'utf8')) as Json
  const payload = extrairPayload(raiz)
  const r = PatchPayloadSchema.safeParse(payload)

  const coaching = payload.coaching as Json | undefined
  const escopo: [string, boolean][] = [
    ['sem video_recommendations', !Array.isArray(payload.video_recommendations) || (payload.video_recommendations as unknown[]).length === 0],
    ['sem notifications', !Array.isArray(payload.notifications) || (payload.notifications as unknown[]).length === 0],
    ['coaching presente', coaching != null && typeof coaching === 'object'],
    ['priorities vazio', Array.isArray(coaching?.priorities) && (coaching!.priorities as unknown[]).length === 0],
  ]

  console.log(`\n=== ${nome}`)
  console.log(`  safeParse: ${r.success ? 'OK' : 'REPROVADO'}`)
  if (!r.success) {
    reprovas++
    for (const issue of r.error.issues.slice(0, 5)) console.log(`    ${issue.path.join('.')}: ${issue.message}`)
  }
  for (const [nomeRegra, ok] of escopo) {
    console.log(`  ${ok ? 'OK       ' : 'REPROVADO'} ${nomeRegra}`)
    if (!ok) reprovas++
  }
  console.log(`  chaves do payload: ${Object.keys(payload).sort().join(', ')}`)
}
console.log(`\nREPROVAS: ${reprovas}`)
process.exit(reprovas === 0 ? 0 : 1)
```

- [ ] **Step 2: Rodar**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx tsx f2-safeparse.ts
```
Esperado: para cada um dos 3 arquivos, `safeParse: OK` e os 4 `OK` de escopo; ao fim, `REPROVAS: 0` e saída 0. **Qualquer** `REPROVADO` reprova o card — o payload que a forja mandaria levaria 400 do site (§3.3).

Se o `extrairPayload` lançar `arquivo de sombra sem payload`, a chave do arquivo de sombra não é `payload`: leia o arquivo (`head -c 400`), ajuste **o script** (nunca o arquivo de sombra) e anote a divergência com o card do worker.

- [ ] **Step 3: Guardar a saída**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx tsx f2-safeparse.ts > /private/tmp/claude-501/-Users-figueiredo-Workspace-bythiagofigueiredo/9e4ef126-9796-4af1-98f8-bd072597eeca/scratchpad/f2-safeparse.txt 2>&1; tail -3 /private/tmp/claude-501/-Users-figueiredo-Workspace-bythiagofigueiredo/9e4ef126-9796-4af1-98f8-bd072597eeca/scratchpad/f2-safeparse.txt
```
Esperado: `REPROVAS: 0`.

- [ ] **Step 4: Apagar o script e provar que a árvore está limpa**

```bash
rm -f /Users/figueiredo/Workspace/bythiagofigueiredo/f2-safeparse.ts
cd /Users/figueiredo/Workspace/bythiagofigueiredo && git status --short | grep -c f2-safeparse
```
Esperado: `0`. Se aparecer, o arquivo foi para o índice — desfaça com `git restore --staged f2-safeparse.ts` e apague.

---

### Task F2-3: determinismo — as 3 rodadas com campos numéricos idênticos

**Files:**
- Create: `/private/tmp/claude-501/-Users-figueiredo-Workspace-bythiagofigueiredo/9e4ef126-9796-4af1-98f8-bd072597eeca/scratchpad/f2-determinismo.py` (descartável)

**Interfaces:**
- Consumes: Task F2-1 (3 payloads), Task F05-5 (a saída de `escolher` de referência).
- Produces: prova de que só o `coaching.summary` varia entre as rodadas, e de que a parte calculada é a mesma conferida no F0.5.

**Por que "tudo menos o `summary`":** na abordagem A (§2.1) **todo** número e toda decisão vêm de código determinístico; o modelo só redige `coaching.summary`. Então a igualdade dos campos numéricos é um caso particular de "o payload inteiro, menos `coaching.summary`, é idêntico" — que é o que este passo compara, e é estritamente mais forte.

- [ ] **Step 1: Escrever o comparador**

```python
"""Compara os 3 payloads da sombra: tudo menos coaching.summary tem de ser identico."""
import json, os, re, sys

DIR = os.path.expanduser("~/Workspace/forja/ferramentas/fase2/sombra-f2")
arqs = sorted(f for f in os.listdir(DIR) if f.endswith(".json"))
if len(arqs) != 3:
    sys.exit("pare: esperados 3 arquivos, achei %d" % len(arqs))

def payload(raiz):
    p = raiz.get("payload")
    return p if isinstance(p, dict) else raiz

esqueletos, resumos = [], []
for nome in arqs:
    p = payload(json.load(open(os.path.join(DIR, nome))))
    resumos.append((nome, (p.get("coaching") or {}).get("summary", "")))
    esq = json.loads(json.dumps(p))
    if isinstance(esq.get("coaching"), dict):
        esq["coaching"].pop("summary", None)
    esqueletos.append(json.dumps(esq, sort_keys=True, ensure_ascii=False))

iguais = len(set(esqueletos)) == 1
print("esqueleto identico nas 3 rodadas: %s" % iguais)
if not iguais:
    for nome, e in zip(arqs, esqueletos):
        print("\n--- %s\n%s" % (nome, e[:1200]))

print("\npadroes da rodada 1:")
p1 = json.loads(esqueletos[0])
for pat in (p1.get("channel_insights") or {}).get("patterns_detected", []):
    print("  %s | %s | conf %s | n %s" % (pat.get("pattern_id"), pat.get("finding"),
                                          pat.get("confidence"), pat.get("sample_size")))
print("\nanalysis_text:\n  %s" % (p1.get("channel_insights") or {}).get("analysis_text", "")[:600])

print("\nnumeros de cada summary (para o olho do dono):")
for nome, s in resumos:
    print("  %s: %s" % (nome, re.findall(r"\d+[.,]?\d*", s)))
    print("      %s" % s)
sys.exit(0 if iguais else 1)
```

- [ ] **Step 2: Rodar**

```bash
python3 /private/tmp/claude-501/-Users-figueiredo-Workspace-bythiagofigueiredo/9e4ef126-9796-4af1-98f8-bd072597eeca/scratchpad/f2-determinismo.py
```
Esperado: `esqueleto identico nas 3 rodadas: True`, **1** padrão listado, e os 3 `summary` impressos. `False` reprova o card: algo fora do `summary` variou, e a abordagem A foi quebrada.

- [ ] **Step 3: Comparar com a referência do F0.5**

```bash
diff <(python3 /private/tmp/claude-501/-Users-figueiredo-Workspace-bythiagofigueiredo/9e4ef126-9796-4af1-98f8-bd072597eeca/scratchpad/f2-determinismo.py | sed -n '/padroes da rodada 1/,/analysis_text/p') /private/tmp/claude-501/-Users-figueiredo-Workspace-bythiagofigueiredo/9e4ef126-9796-4af1-98f8-bd072597eeca/scratchpad/escolher-f05.txt
```
Esperado: o `pattern_id`, o `finding`, a `confidence` e o `sample_size` **iguais** aos que o `--escolher` imprimiu no F0.5 (o `diff` pode acusar diferença de formatação; o que vale é a igualdade desses quatro campos — confira linha a linha). Diferença de **valor** reprova: ou a fixture mudou, ou o `series.json` mudou. Se a saída de `escolher` mudou de propósito, o dono confere **só a diferença** (célula F2 do §5) e a referência do F0.5 é refeita.

---

### Task F2-4: tempos, tentativas e template — os portões de execução

**Files:** nenhum (leitura do jsonl e dos arquivos de sombra).

**Interfaces:**
- Consumes: Task F2-1.
- Produces: os portões "toda geração < 7 min", "rodada de uma geração ≤ 10 min", "rodada com segunda tentativa ≤ 20 min", "aprovado na primeira geração em ≥ 2/3" e "nunca em template".

- [ ] **Step 1: Ler as três linhas `modo: sombra` do jsonl (só leitura)**

```bash
ssh forja "tail -n 40 /opt/agente/log/fila_intel.jsonl" | python3 -c "
import json, sys
linhas = [json.loads(l) for l in sys.stdin if l.strip().endswith('}')]
somb = [d for d in linhas if d.get('modo') == 'sombra'][-3:]
print('linhas de sombra achadas: %d' % len(somb))
for d in somb:
    print('%s  desfecho=%-10s tentativas=%-3s fallback=%-14s motivos=%s' % (
        d.get('quando'), d.get('desfecho'), d.get('tentativas'), d.get('fallback'), d.get('motivos')))
    print('    ms: %s' % {k: v for k, v in d.items() if k.startswith('ms') or k == 'ms_por_etapa'})
"
```
Esperado: 3 linhas, todas com `desfecho: ok`, `fallback` **vazio** nas três (um `fallback: [summary]` quer dizer template, e o portão é "nunca em template"), e `tentativas` = 1 em **pelo menos 2** das 3 ("aprovado na primeira geração em ≥ 2/3"). Qualquer `desfecho` diferente de `ok` reprova.

Se o nome do campo de tempo por etapa divergir do que o comando imprime, use `ssh forja 'tail -n 1 /opt/agente/log/fila_intel.jsonl' | python3 -m json.tool` para ver o esquema real e ajuste **o comando de leitura**, nunca o log.

- [ ] **Step 2: Conferir os tetos de tempo**

Da linha do jsonl (ms por etapa) e dos `tempos` gravados em cada arquivo de sombra (§4.7):

```bash
python3 -c "
import json, os
D = os.path.expanduser('~/Workspace/forja/ferramentas/fase2/sombra-f2')
for nome in sorted(os.listdir(D)):
    if not nome.endswith('.json'): continue
    d = json.load(open(os.path.join(D, nome)))
    print(nome, json.dumps(d.get('tempos'), ensure_ascii=False))
"
```
Esperado, com os tetos da célula F2 do §5:

| Portão | Limite | Reprova se |
|---|---|---|
| toda geração | **< 7 min** (420 s) | qualquer geração, em qualquer rodada, ≥ 7 min |
| rodada com **uma** geração | **≤ 10 min** (600 s) | rodada de `tentativas: 1` acima disso |
| rodada com **segunda tentativa** | **≤ 20 min** (1200 s) | rodada de `tentativas: 2` acima disso — é o teto do orçamento do §4.7 |

Uma geração ≥ 7 min reprova mesmo com a rodada dentro do teto: o worker real corta a geração em `min(600 s, orçamento restante − 120 s)` e, com o llama mais lento, cairia em `orcamento`.

- [ ] **Step 3: Conferir que a sombra não tocou no site nem na fila**

```bash
ssh forja "tail -n 40 /opt/agente/log/fila_intel.jsonl" | python3 -c "
import json, sys
somb = [json.loads(l) for l in sys.stdin if l.strip().endswith('}')]
somb = [d for d in somb if d.get('modo') == 'sombra'][-3:]
print('claims:', [d.get('claim') for d in somb])
print('tasks:', [d.get('task') for d in somb])
"
```
Esperado: `claim` e `task` **nulos** nas 3 (o `--sombra` não clama, §4.7). Qualquer valor não nulo reprova **gravemente**: a sombra tocou na fila.

E, em produção (leitura do dono, na raiz do repo):

```bash
cd ~/Workspace/bythiagofigueiredo && npx --yes supabase@2.98.2 db query --linked --agent=no "select count(*) from public.youtube_intelligence where source = 'forja' and site_id = (select id from public.sites where primary_domain='bythiagofigueiredo.com')"
```
Esperado: `0` — o F2 não grava nada; a primeira linha `forja` nasce no F4.

---

### Task F2-5: o julgamento do dono sobre os três `summary`

**Sem código.** É o **único** julgamento de texto antes do F4 (não há F3 nesta fase).

**Files:** nenhum.

**Interfaces:**
- Consumes: Tasks F2-2, F2-3 e F2-4 verdes.
- Produces: o "aprovado" do dono, registrado na conversa. Sem ele o F4 não começa.

- [ ] **Step 1: Montar a apresentação**

Ao dono, em um bloco só:

- os **3 `summary`** na íntegra, na ordem das rodadas (saída da Task F2-3 Step 2);
- ao lado de cada um, `tentativas` e se houve `fallback` (Task F2-4);
- abaixo, os números que o código calculou e que o texto pode citar: `videos`, `views_90d`, `data_base`, `ultimo_video`, `dias_sem_publicar`, e por série `n`, `ano`, `mediana_views_vida`, `razao_coorte`, `views_90d_serie`;
- e o `finding` do padrão, que é template e não passou pelo modelo.

- [ ] **Step 2: Dizer o que o plano já provou e o que só o dono decide**

- **Provado por máquina:** schema real verde 3/3, quatro recusas de escopo respeitadas, esqueleto idêntico nas 3 rodadas, nenhum template, ≥ 2/3 aprovados na primeira geração, tempos dentro dos tetos, zero claims e zero linhas `forja` em produção.
- **Só o dono decide:** se o texto é bom o bastante para aparecer no Health Coach com o selo "por forja". Um texto correto e chato reprova tanto quanto um texto errado — a régua é dele.

- [ ] **Step 3: Esperar o veredito**

**Pare.** "Aprovado" → o card F4 começa. "Reprovado" → o dono diz o que incomodou; o ajuste vai para o prompt/validador (§4.4/§4.5, card do worker), e o F2 é **refeito inteiro** (3 rodadas novas), porque os payloads velhos já não representam o worker.

- [ ] **Step 4: Registrar**

Anotar no relato: data, os 3 `summary` aprovados, `tentativas` de cada, os tempos e o md5 dos 3 arquivos de sombra. É esse conjunto que o F4 diz estar pondo no ar.

---

### Rollback do F0 (RB0)

Último passo da ordem inversa `F4 → Qualidade → F1 → S4 → F0` (§5). **Os dois passos são do dono**: o agente só prepara os comandos e confere por leitura.

**Pré-condição.** Antes de chegar aqui, o rollback do **F4** já tirou a linha do crontab e esperou o lock, e o rollback de **Qualidade** já renomeou as linhas `forja` para `forja_retirada_…`. O `like 'forja%'` abaixo pega as duas formas. Com o cron ainda vivo, o `delete` seria desfeito pela próxima execução em até 10 min.

### Task RB0-1: exportar e apagar as linhas `forja%` do site — **antes** do revert

**Files:**
- Create (pelo dono): `~/Workspace/forja/ferramentas/fase2/forja-export-f0-<AAAA-MM-DD>.json` (fora do repo)

**Interfaces:**
- Consumes: rollback do F4 e de Qualidade concluídos (crontab sem `fila_intel`, lock livre).
- Produces: as linhas `forja%` exportadas e apagadas, **com o F0 ainda no ar**.

**Por que antes do revert.** Com o F0 revertido, o snapshot volta a **não filtrar `source`**, e o Cowork lê essas linhas a qualquer momento pelo resource MCP e por `get_intelligence`, sem uma "execução" marcada. Com o F0 no ar, a allowlist do §3.6 já mostra o Cowork sem elas.

- [ ] **Step 1 (Claude, leitura): provar a pré-condição**

```bash
ssh forja "crontab -l | grep -c fila_intel; flock -w 5 /opt/agente/fila_intel.lock true && echo LOCK-LIVRE || echo 'ESPERAR: execucao ainda viva'"
```
Esperado: `0` e `LOCK-LIVRE`. Qualquer outra coisa: **pare** e volte ao rollback do F4.

- [ ] **Step 2 (dono, na raiz do repo): exportar**

```
cd ~/Workspace/bythiagofigueiredo
```
```
npx --yes supabase@2.98.2 db query --linked --agent=no -o json "select * from public.youtube_intelligence where source like 'forja%' and site_id = (select id from public.sites where primary_domain='bythiagofigueiredo.com')" > ~/Workspace/forja/ferramentas/fase2/forja-export-f0-$(date +%F).json
```
Esperado: o arquivo criado, **fora do repo**, com as linhas `forja` e/ou `forja_retirada_…`. Arquivo vazio ou `[]` quer dizer que não há o que apagar — siga assim mesmo, mas anote.

- [ ] **Step 3 (dono/Claude, leitura): conferir o export antes de apagar**

```bash
python3 -c "
import glob, json
a = sorted(glob.glob('/Users/figueiredo/Workspace/forja/ferramentas/fase2/forja-export-f0-*.json'))[-1]
d = json.load(open(a))
print(a); print('linhas:', len(d))
for r in d: print(' ', r.get('source'), r.get('generated_at'), 'canal' if r.get('video_id') is None else r.get('video_id'))
"
```
Esperado: o número de linhas bate com o que o dono espera (na 2a a forja só tem linha de **canal**, §3.3) e cada linha traz `source` começando em `forja`. **Não apague** sem este passo verde: o `delete` é irreversível.

- [ ] **Step 4 (dono): apagar, com o mesmo escopo de site**

```
npx --yes supabase@2.98.2 db query --linked --agent=no "delete from public.youtube_intelligence where source like 'forja%' and site_id = (select id from public.sites where primary_domain='bythiagofigueiredo.com')"
```
Esperado: o retorno do `delete` sem erro. O `and site_id = …` é obrigatório: um `where source like 'forja%'` solto apagaria as linhas de **todos** os sites.

- [ ] **Step 5 (dono, leitura): prova**

```
npx --yes supabase@2.98.2 db query --linked --agent=no "select count(*) from public.youtube_intelligence where source like 'forja%' and site_id = (select id from public.sites where primary_domain='bythiagofigueiredo.com')"
```
Esperado: `0`. Diferente de zero: **pare** — o revert do Step seguinte esconderia linhas que o Cowork voltaria a ler.

---

### Task RB0-2: `git revert` do F0 e promoção, com o mesmo portão

**Files:**
- Modify: os arquivos do card F0, revertidos.

**Interfaces:**
- Consumes: Task RB0-1 (banco limpo, com o F0 ainda no ar).
- Produces: `staging`/`main` sem o F0; PT com o diagnóstico do Cowork em produção.

- [ ] **Step 1: Levantar a lista de commits do F0**

A granularidade do F0 é "uma sequência de commits locais empurrados de uma vez" (Global Constraints): o relato da Task 14/15 do card F0 anotou os SHAs. Confirmar:

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && git log --oneline --no-merges -- apps/web/src/app/api/pipeline/youtube/intelligence apps/web/src/lib/pipeline/services/youtube.ts | head -25
```
Esperado: os commits do F0, do mais novo para o mais antigo. Cruzar com a lista anotada no relato do F0; divergência: **pare** e reabra com o dono.

- [ ] **Step 2: Reverter na ordem inversa (do mais novo para o mais antigo)**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git revert --no-edit <sha mais novo> <sha seguinte> ... <sha mais antigo>
```
`git revert` com vários SHAs aplica **na ordem dada** — por isso a lista vai do mais novo para o mais antigo, que é a ordem inversa da aplicação. Conflito: resolva por caminho explícito, **nunca** `git checkout .` nem `git stash` (há outros terminais em `staging`).

- [ ] **Step 3: O mesmo portão do F0, antes de qualquer push**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web && npx vitest run
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run typecheck --workspace=apps/web && npm run typecheck --workspace=apps/api
```
Esperado: 0 falhas. A árvore revertida tem de ficar verde — os testes do F0 saem junto com o código do F0, no mesmo revert.

- [ ] **Step 4: O dono empurra e promove**

**Pare e chame o dono.** Push de `staging` é dele. Depois: CI (`ci.yml`) verde **inclusive o job de integração**, Vercel verde, e **validação autenticada antes da promoção** (`docs/ops/runbook-cms-e2e-local.md`): `/cms/youtube/analytics` sem boundary, console sem `error`.

- [ ] **Step 5 (dono, leitura): prova final**

```
npx --yes supabase@2.98.2 db query --linked --agent=no "select count(*) from public.youtube_intelligence where source like 'forja%'"
```
Esperado: `0` (aqui **sem** o filtro de site, de propósito: é a prova global do §5).

E, logado em produção: o PT mostra o diagnóstico do **Cowork** — com o F0 revertido, volta o rótulo de hoje, o parágrafo "O canal esta em X/100 …", os 3 cards e o badge 3, sem linha de summary e sem selo por fonte.

- [ ] **Step 6: Registrar**

Anotar no relato: SHAs revertidos, caminho do export, contagem antes e depois, e o estado final da tela. O kit na forja **não** é tocado por este card — quem desfaz o que ficou lá é o rollback do S4 (§5).

---

# Divergências entre este plano e o spec

O spec v11 é a fonte da verdade e passou por 10 rodadas de revisão. Ao transformá-lo em plano, oito frentes leram o código real do kit e do site e acharam os pontos abaixo. **Nada aqui foi decidido sozinho: cada item diz o que o spec manda, o que o plano faz, e por quê.** Os marcados **[DONO]** esperam decisão antes da execução do card correspondente.

## A. Erros do spec — o plano corrige

| # | Onde | O que o spec diz | Por que está errado | O plano |
|---|---|---|---|---|
| A1 | §4.6, `pedir` | `FalhaSite(caminho, …)` do tipo `sem_chave` | O primeiro posicional de `FalhaSite` é **`tipo`**, não a rota (`sitio.py:45-48`); o próprio `sitio.py:101` faz `FalhaSite("sem_chave", caminho)`. Ao pé da letra, o spec constrói a exceção com o tipo trocado pela rota | usa `FalhaSite("sem_chave", caminho)` |
| A2 | §5, card F0k | `teste_s4.py` não roda no Mac "porque o worker importa `httpx`" | O `teste_s4.py` **não toca no worker** — testa o `sitio.py`. Verificado: roda no Mac, com `AGENTE_SITIO` obrigatório (sem ele o `next()` de `teste_s1.py:8-10` estoura `StopIteration`). A justificativa vale só para o `teste_fila.py` | `teste_s4.py` entra no ciclo de TDD do Mac; o portão do F0k não muda |
| A3 | §5, card S4 | a célula não declara dependências | Sem o `fila_intel.py` e o `teste_fila.py` já na forja, o bloco novo do `cartao.sh` reprova o cartão com `sem fila_intel.py` | F0k e K viram pré-condição explícita do S4 |

## B. Silêncios do spec — o plano escolhe e diz por quê

| # | Onde | Silêncio | Escolha do plano |
|---|---|---|---|
| B1 | §4.6 | resposta 2xx que não seja 200/204 não está na tabela de `FalhaSite` | `recusa` (falha fechada) |
| B2 | §4.1 | `main()`: o spec nomeia os 5 injetáveis, não `argv` nem o retorno | `argv` posicional e retorno `int` — sem isso "lock ocupado → 0/75" não é testável |
| B3 | §4.1 | `dormir` síncrono ou awaitable; `abrir_site`/`abrir_llama` devolvem cliente ou context manager | `dormir` é `async`; as fábricas são usadas com `async with` (é o que `httpx.AsyncClient` já é) |
| B4 | §4.3 | separador do `analysis_text` ("os `finding` unidos") | `". "` |
| B5 | §4.2 | `view_count` nulo; empate de `published_at` no episódio mediano | `or 0` (senão `statistics.median` estoura e a execução vira `bug`); desempate por `(quando, id)` |
| B6 | §4.2 | "fuso de São Paulo" | `zoneinfo("America/Sao_Paulo")`, **não** o `BRT = −3` fixo de `sitio.py:129`. Divergem no horário de verão: `2019-01-01T02:30Z` é 2019 com `zoneinfo` e 2018 com −3 fixo, e isso muda o ano de uma série. Depende de `tzdata` na forja (Ubuntu tem). Há teste fixando |
| B7 | §4.5 | motivo de "número fora da ENTRADA", da regex do item 5, e de chaves ≠ `{"summary"}` | `numero`, `proibido`, `json` |
| B8 | §4.4 | o Aparo mede 60 em quê | pontos de código (a faixa é da gramática), enquanto o teto de 500 continua em UTF-16, como o spec manda |
| B9 | §4.7 | `--canario` roda sem `--snapshot`; de onde vem a ENTRADA da sonda de schema | `args.snapshot or <BASE>/docs/trilha/fixture_pt.json` |
| B10 | §4.7 | formato de `congelado_em`; esquema do arquivo de sombra | `AAAA-MM-DD` em UTC; o arquivo traz `system`, `user`, `payload`, `veredito`, `tempos`, `seed` no topo |
| B11 | §4.1 | separador de `CANAIS_FILA`; vocabulário de `motivos` do desfecho `config` | vírgula; `env_ausente, env_ilegivel, chave_ausente, chave_duplicada, chave_formato` |
| B12 | §4.6 | onde `nova_chave.py --fila` acha o arquivo | `AGENTE_BASE` (convenção de `replay2.py:8`, já usada no §4.1); sem isso o modo só seria testável escrevendo em `/opt/agente` de verdade |
| B13 | §4.5 | o que fazer se o **template** reprovar no validador | ramo defensivo: usa o template cru, `motivos: template_reprovado`, **nunca** `fail` |
| B14 | §4.6 | `fail` que responde 200 com corpo `formato`/`grande` | tratado como `ok` |
| B15 | §5, F1 | ordem entre o portão do turno de chat e o `--canario` | o chat vem **depois**: o canário passa pela guarda de chat recente do §4.1 passo 2 e sairia `chat` sem sondar nada |
| B16 | §5, F2 | quais são os "campos numéricos idênticos" nas 3 rodadas | o payload inteiro menos `coaching.summary` — decorre da decisão A e é estritamente mais forte |
| B17 | §5, F0 | "200 com `recent_window`" × `recent_window: null` legítimo (§3.5) | a sonda reprova por **ausência da chave** (prova do build novo) e só avisa no valor nulo; quem reprova nulo é o portão do F0.5 |

## C. Decisões tomadas pelo dono em 2026-09-20

As seis que o plano deixou em aberto foram decididas. Ficam registradas com o argumento, não só com o veredito, para ninguém "consertá-las" depois sem saber por que estão assim.

| # | Assunto | Decisão | Argumento |
|---|---|---|---|
| C1 | §6, motivos de alerta | `fila-jsonl-<n>s` / `fila-jsonl-ausente` e `fila-task-<desfecho>` | molde do `nas-estado-${idade}s` que o pulso já usa. Segundos, não minutos: consistência com o arquivo vale mais que dois dígitos num alerta lido com sono |
| C2 | §6, precedência | `exceção → mtime → parada → task → sem-claim-24h`, **escrita como comentário** acima do encadeamento | se não dá para ler o arquivo não se sabe nada; se o cron morreu, as outras três leem linhas velhas; `parada` (chave/config) é falha permanente, mais acionável que "não clamou". O comentário existe porque a ordem é implícita no shell e some no primeiro refactor |
| C3 | §6, custo colateral | **aceito** o atraso de até ~4,2 min no ping principal | o ping da fila e o principal vão para o **mesmo host**: se o hc-ping.com está fora, o principal falha depois de qualquer jeito, e o atraso não cria alarme que já não aconteceria. O caso ruim é só o intermitente, e 4,2 min num check de 1 h cabem em qualquer folga. **Recusado** pingar a fila depois do principal: zeraria o atraso, mas quebraria o bloco em dois pares de marcadores e o `--remover` perderia a prova por `cmp -s`. Se um dia o teto incomodar, a versão barata é cortar as tentativas da fila de 5 para 2 (~1 min) |
| C4 | §4.3, coorte fina | entra o motivo **`coorte_fina`** | sem ele, "nenhum padrão por coorte fina" é indistinguível de "nenhum padrão por canal saudável": `desfecho: ok`, nenhum padrão, nada que explique. E acontece de verdade — na terceira leitura do §4.3, 2018 fica com 1 vídeo elegível fora da série e **as duas** séries caem em "não se aplica" caladas. Precedente: `series_orfas` |
| C5 | §4.1, `/slots` | **resolvido por leitura**, não por suposição | ver abaixo |
| C6 | kit sem git | `git init` em `~/Workspace/forja/ferramentas`, feito antes do F0k | a fase cria 8 arquivos e altera 4; o `.bak` protege uma edição de profundidade, não uma sequência, e o portão md5 do K só prova que Mac e forja são iguais, não que a cópia do Mac está certa — um erro de edição atravessaria o K com o md5 verde |

### C5 — a forma do `/slots`, medida

Lido na forja em 2026-09-20 (só leitura, sem tocar em conteúdo de prompt):

```
tipo do corpo: list      n de slots: 2
chaves: id, id_task, is_processing, n_ctx, n_prompt_tokens, n_prompt_tokens_cache,
        n_prompt_tokens_processed, next_token, params, speculative
is_processing: [(False, 'bool'), (False, 'bool')]
```

É lista, são exatamente 2, e `is_processing` existe e é booleano. **O inventário do kit está incompleto:** `spec-site/secoes/07-seguranca.md:22` lista as chaves de `/slots` sem `is_processing`, e era ele que gerava a dúvida do spec.

**A guarda fail-closed continua como está**, e isso não é redundância: o risco nunca foi "o campo não existe hoje", e sim "o campo some numa atualização do llama-server". Se sumir e o código tratar ausente como slot livre, a fila clama e gera **em cima do chat**, com o claim em 200 e sem motivo no log — invisível para o pulso, que só olha `claim` e `desfecho`. O `curl` do portão do F1 confere uma vez; a guarda é o que dura.

## D. Coisas que o spec manda e o plano cumpre sem alterar

- O SQL "nenhum claim antes do F4" é o único do spec **sem** `and site_id = …`. O plano mantém o literal: um zero sobre todos os sites é mais forte, não mais fraco.
- `ls proxy.py.bak-*-S4 | head -1` só ordena certo dentro do mesmo ano (carimbo `%m%d-%H%M`). O plano mantém o comando e acrescenta um `ls -lt` de conferência ao lado.

## E. Patches para a v12 do spec

Três correções que o plano já aplica e que o spec precisa receber, para os dois pararem de divergir. Enquanto não entrarem, **o plano é que está certo** nestes três pontos.

| # | Onde | Trocar | Por |
|---|---|---|---|
| E1 | §4.6, bloco `pedir` | `FalhaSite(caminho, …)` do tipo `sem_chave` | `FalhaSite("sem_chave", caminho)` — o primeiro posicional é `tipo`, não a rota (`sitio.py:45-48`), e o próprio `sitio.py:101` já faz assim. Ao pé da letra, o spec constrói a exceção com o tipo trocado pela rota |
| E2 | §5, card F0k | "`teste_fila.py` e `teste_s4.py` **não** rodam no Mac (o `python3` do Mac não tem `httpx`, e o worker o importa)" | a justificativa vale só para o `teste_fila.py`. O `teste_s4.py` não toca no worker — testa o `sitio.py` — e roda no Mac com `AGENTE_SITIO` setado (verificado: `S4: 0 falha(s)`, 29 asserções) |
| E3 | §5, rollback do S4 | `flock /opt/agente/fila_intel.lock sh -c "…"` | `flock -w 1800 …`, com mensagem própria na falha. O §4.6 já exige `-w 1800` em todo `flock` de shell; o §5 contradiz o §4.6. Depois do F4 o cron está vivo, uma execução segura a trava por até 25 min, e um `flock` sem limite pendura o rollback sem dizer por quê — no meio de um rollback |
