# Fase 2a — a forja drena a fila de inteligência — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** pôr de pé o circuito em que a forja (Gemma 12B local) clama tarefas de `youtube_intelligence_tasks`, grava a análise do canal com `source='forja'` ao lado das do Cowork, e o Health Coach mostra a mais recente com selo da fonte.

**Architecture:** o site ganha uma permissão estreita (`intelligence`), duas rotas REST novas (claim e fail), um PATCH com portão único dentro do serviço (Zod + fonte derivada da chave + trava de dono + CAS de fechamento) e um snapshot que passa a expor a janela de 90 dias sem somar fotos. O worker da forja (`/opt/agente/fila_intel.py`) calcula tudo em código determinístico e usa o 12B só para redigir um campo (`coaching.summary`), sob validador local. A convivência com o Cowork é garantida pelos índices únicos por `source`.

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

Verificado em 2026-09-19, não suposto:

- **O kit não está sob controle de versão.** `~/Workspace/forja` não é repositório git; `forja-infra`, `forja-ds` e `sitio` são repositórios próprios, e `ferramentas/` — onde vivem `docs/sitio.py`, `docs/trilha/*` e `seed_chave_forja.sh` — está fora de todos eles. Consequências, obrigatórias:
  - **nenhuma tarefa do kit termina em `git commit`.** Termina em "salvar o arquivo" mais o portão do F0k (`python3 -m py_compile` para `.py`, `bash -n` para `.sh`);
  - **antes de alterar um arquivo que já existe**, copie: `cp -p <arq> <arq>.bak-fase2`. Os quatro nesta situação são `docs/trilha/cartao.sh`, `docs/trilha/deploy.sh`, `docs/trilha/nova_chave.py` e `seed_chave_forja.sh`. Sem isso não há desfazer: os `.bak-*` que o `deploy.sh` cria ficam **na forja**, e um erro de edição na cópia do Mac sobrevive e viaja no próximo `K`.
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
  for (const op of ['select', 'eq', 'in', 'order', 'limit', 'update', 'is', 'not', 'gte']) {
    chain[op] = vi.fn((...args: unknown[]) => { calls.push({ op, args }); return chain })
  }
  chain.maybeSingle = vi.fn(async () => results[i++] ?? { data: null, error: null })
  chain.single = vi.fn(async () => results[i++] ?? { data: null, error: null })
  chain.then = undefined
  return {
    calls,
    tables,
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
    expect(sb.calls).toContainEqual({ op: 'in', args: ['channel_id', ['ch-1']] })
    expect(sb.calls).toContainEqual({ op: 'eq', args: ['status', 'pending'] })
    const update = sb.calls.find(c => c.op === 'update')!
    expect(update.args[0]).toMatchObject({ status: 'running', result_summary: { claimed_by: 'key-forja' } })
    // the CAS carries site_id, and the returned row comes from a closed column list
    expect(sb.calls).toContainEqual({ op: 'eq', args: ['site_id', 'site-1'] })
    expect(sb.calls.some(c => c.op === 'select' && c.args[0] === '*')).toBe(false)
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
    expect(sb.calls).toContainEqual({ op: 'eq', args: ['started_at', '2026-09-19T10:00:00Z'] })
    expect(sb.calls).toContainEqual({ op: 'eq', args: ['result_summary->>claimed_by', 'key-forja'] })
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
    expect(sb.calls).toContainEqual({ op: 'eq', args: ['started_at', '2026-09-19T10:00:00Z'] })
    expect(sb.calls).toContainEqual({ op: 'eq', args: ['result_summary->>claimed_by', 'key-forja'] })
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
  const dbErrors: string[] = []      // raw messages — Sentry only
  const dbTargets: string[] = []     // "video <uuid>: write_failed" / "channel: write_failed"
```
(cada `dbErrors.push(...)` ganha um `dbTargets.push(`video ${rec.video_id}: write_failed`)` ou `dbTargets.push('channel: write_failed')` ao lado.)

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

# ── cálculo (card F2F) ─────────────────────────────────────────────────────────
def features(snapshot: dict, series: dict, hoje: datetime.date) -> dict
def escolher(feats: dict) -> dict
#   -> {channel_insights: {patterns_detected, analysis_text}, coaching: {priorities: []},
#       series: [...], motivos: [...]}        # sem video_recommendations, sem notifications

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
| `trilha/teste_calculo.py` | §4.2, §4.3 | **sim** (stdlib) | sozinho, ou por `casos(F, exige)` |
| `trilha/teste_fila_redacao.py` | §4.4, §4.5 | **sim** (stdlib) | sozinho, ou por `casos(F, exige)` |
| `trilha/teste_fila.py` | §4.1, §4.6, §4.7 e os dois acima | **não** (carrega o worker, que importa `httpx`) | entrada única na forja |
| `trilha/teste_s4.py` | `sitio.py` fase 2 | **sim**, com `AGENTE_SITIO` | `cartao.sh S4` |
| `fase2/teste_pulso_fila.py` | o bloco do pulso (§6) | **sim** (shell + stdlib) | passo 3 do F4 |

Os dois primeiros rodarem no Mac é o que dá ciclo de TDD local para a parte mais densa em números. É por isso que este plano **não** tem um modo `--dubles` no harness nem um venv descartável: as duas ideias existiam só para contornar a falta desse ciclo.

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

## C. Decisões que esperam o dono **[DONO]**

| # | Assunto | Situação | Proposta |
|---|---|---|---|
| C1 | §6, motivos de alerta | O §6 nomeia `fila-parada:`, `fila-sem-claim-24h:` e `fila-leitura-`. As outras **duas** condições de vermelho — "mtime > 70 min / arquivo ausente" e "última cron com task, < 24 h, não-`ok`" — **não têm motivo nomeado** | `fila-jsonl-<n>s` / `fila-jsonl-ausente` e `fila-task-<desfecho>`, no molde do `nas-estado-*` que o pulso já usa |
| C2 | §6, precedência | O spec não ordena as quatro condições, mas o teste exige "um `MOTIVO` e nada mais". `desfecho: chave` dispara duas ao mesmo tempo e tem de sair `fila-parada:chave` | exceção → mtime → parada → task → sem-claim-24h |
| C3 | §6, custo colateral | Se as 5 tentativas de `curl` da fila falharem, o bloco **atrasa o ping do check principal em até ~4,2 min**. Ele não toca em `ok`, então não pinta o principal de vermelho — mas atrasa | aceitar, ou mandar o ping da fila para segundo plano |
| C4 | §4.3, coorte fina | Coorte com menos de 4 vídeos não vira padrão, mas **não tem motivo nomeado** no log, ao contrário do `padrao_neutro` — um canal some do padrão em silêncio | acrescentar `coorte_fina` aos `motivos` |
| C5 | §4.1, `/slots` | O spec descreve "JSON sem exatamente 2 slots" sem dizer que o corpo é uma lista | assumido lista de 2 dicts; **confirmar no F1 contra o llama real** antes de confiar na guarda |
| C6 | kit sem git | `ferramentas/` está fora de qualquer repositório; a mitigação deste plano é `cp -p` para `.bak-fase2` antes de cada edição | opcional: `git init` em `~/Workspace/forja/ferramentas` antes do F0k, o que daria desfazer de verdade |

## D. Coisas que o spec manda e o plano cumpre sem alterar

- `flock` de shell: o §4.6 exige `-w 1800` em todo lugar, mas o comando de rollback do S4 no §5 aparece seco. O plano **reproduz o literal do §5** e o protege com o `LOCK-LIVRE` prévio, em vez de "consertar" um comando que o dono vai colar. **[DONO]** se quiser normalizar para `-w 1800`, é uma linha.
- O SQL "nenhum claim antes do F4" é o único do spec **sem** `and site_id = …`. O plano mantém o literal: um zero sobre todos os sites é mais forte, não mais fraco.
- `ls proxy.py.bak-*-S4 | head -1` só ordena certo dentro do mesmo ano (carimbo `%m%d-%H%M`). O plano mantém o comando e acrescenta um `ls -lt` de conferência ao lado.
