# Falhas Silenciosas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar os 22 defeitos que hoje falham em silêncio no CMS, e instalar o sinal que impede a classe inteira de voltar sem aviso.

**Architecture:** Nove pacotes de trabalho (WP). Sete rodam em paralelo porque não compartilham arquivo nenhum. Dois rodam em série no fim, porque `apps/web/vercel.json` tem dono único e o endpoint de saúde precisa da lista de crons já estabilizada. Cada pacote termina num **portão único de validação** — não há validação passo a passo.

**Tech Stack:** Next.js 15 (App Router) · TypeScript strict · Vitest · Supabase/Postgres · Vercel Cron · systemd + ntfy na máquina caseira.

**Spec:** `docs/superpowers/specs/2026-09-02-falhas-silenciosas-design.md`

## Global Constraints

- **Branch:** trabalhar direto em `staging`. Nunca criar feature branch — há vários terminais em paralelo.
- **Commit:** `git add` **por caminho explícito**. Nunca `git add -A` nem `git add .` — captura trabalho-em-progresso de outro terminal.
- **Commit serializado:** o pre-commit roda `build:packages` + `tsc --noEmit` no monorepo (~40-60s). Dois commits simultâneos veem erros de tipo transitórios do vizinho. Serialize o `git commit`, não o trabalho de edição.
- **Nunca** `git stash`, `git reset --hard`, ou force-push.
- **`apps/web/vercel.json` tem dono único: WP-B.** Nenhum outro pacote escreve nesse arquivo.
- **Não rodar a suíte completa de testes** — trava localmente. Só runs direcionados (`npx vitest run <arquivo>`), que custam ~1s.
- **Não rodar `npm run db:types`** durante a execução paralela: é um arquivo de 10.304 linhas que todo agente tocaria. Fica como tarefa final isolada (WP-J).
- **TypeScript strict, nunca `any`.** Zod para validação. Arquivos kebab-case, interfaces com prefixo `I`, colunas de banco snake_case.
- **Atenção a dois arquivos homônimos:** `apps/web/src/lib/pipeline/services/research.ts` (o que quebrou) e `apps/web/src/lib/pipeline/mcp/services/research.ts` (outro arquivo, não tocar).
- Comentários e texto de UI em PT-BR seguindo a convenção do arquivo que você está editando — vários componentes do CMS escrevem sem acento (`Diagnostico`, `analise`). Copie o estilo local, não o corrija.

## Ordem de execução

```
ONDA 0 (primeiro, sozinho — destrava 4 dos 6 eixos do score)
  WP-K  sync da YouTube Analytics API

ONDA 1 (paralela — sete sub-agentes, nenhum compartilha arquivo)
  WP-A  verbo GET nas 8 rotas agendadas + teste-guarda
  WP-C  entrega de notificação
  WP-D  observatório de competidores
  WP-E  loop de inteligência
  WP-F  research API (bloqueador da ingestão do curso)
  WP-G  A/B Lab
  WP-I  segurança

ONDA 2 (série — depois que a onda 1 commitar)
  WP-B  registrar as 10 órfãs + a rota nova de WP-E no vercel.json   ← dono único
  WP-H  endpoint /api/health + instrumentação + watchdog na forja

ONDA 3
  WP-J  regenerar database.types.ts (isolado, não bloqueante)
  Portão final de validação
```

---

## WP-K — Sync da YouTube Analytics API

**Prioridade mais alta do plano. Roda sozinho, antes da onda 1.**

Fecha a causa-raiz do score zerado. Descoberto depois da primeira versão deste plano, medindo o banco de produção.

**O que o dado mostra [DB, 2026-09-03]:**

```
youtube_video_analytics ................ 0 linhas
youtube_videos com avg_view_percentage . 0 de 35
cron_health com linha de sync-analytics  nao existe

social_connections:
  youtube  @bythiagofigueiredo  refresh_token PRESENTE  expira 2026-09-03T02:34
  youtube  @tnfigueiredotv      refresh_token PRESENTE  expira 2026-09-01T13:00  (vencido)
  facebook Figueiredo           refresh_token AUSENTE   expira 2026-07-18T21:28  (vencido)
  instagram thiagonfigueiredo   refresh_token AUSENTE   expira 2026-07-18T21:28  (vencido)
```

**Por que isso é a causa-raiz.** `fetchGradesData` (`analytics/actions.ts:32-42`) monta `dailyByVideo` a partir de `youtube_video_analytics`. Com a tabela vazia, `last28` é sempre `[]`, e daí:

| Eixo | Entrada | Valor com a tabela vazia |
|---|---|---|
| `growth` | `dailyViews` | `[]` → 0 |
| `engagement` | `totalEng / totalViews` | `0/0` → 0 |
| `sub_impact` | `subscribersGained` + `impressions` | 0 |
| `retention` | `avg_view_percentage` | `null` → 0 |
| `ctr` | `ctr` | ninguém grava → 0 |
| `reach` | fontes de tráfego, **com fallback para `view_count`** | único que funciona |

**Cinco dos seis eixos são zero, e quatro deles têm conserto.** Só `ctr` é genuinamente impossível — CTR e impressões não existem em nenhuma API pública. Os outros quatro a YouTube Analytics API entrega para o dono do canal.

**Distinção importante entre os dois canais — não confundir as duas causas:**

| Canal | Inscritos | Vídeos | Zero explicado por |
|---|---|---|---|
| `@bythiagofigueiredo` | 3 | 0 | **nada publicado ainda.** Zero é a resposta correta. Nenhum conserto muda isso. |
| `@tnfigueiredotv` | 1160 | 35 | **defeito.** Os vídeos existem, têm views (62-157), e a Analytics API devolve histórico independente de atividade recente. |

O score baixo não é veredito sobre a qualidade do conteúdo. Mas a cadeia quebrada impediria de ver o desempenho real mesmo com publicação diária — é isso que este pacote conserta. A calibração de qualquer mediana sai de `@tnfigueiredotv`; `@bythiagofigueiredo` mostra "dados insuficientes" até ter cinco vídeos. **A regra é por canal, nunca global.**

**Files:**
- Modify: `apps/web/src/app/api/cron/sync-analytics-metrics/route.ts` (instrumentar erro e saúde)
- Modify: `apps/web/src/lib/youtube/analytics-queries.ts:15-28` (parar de engolir erro)
- Create: `apps/web/test/cron/sync-analytics-metrics.test.ts`

**Contexto verificado:** a rota está correta no essencial — exporta `GET`, está agendada `0 12 * * *`, autentica com `CRON_SECRET`, e chama `ensureFreshToken(site_id, 'youtube', channel_id)` antes de cada canal. Os refresh tokens do YouTube existem. Logo a falha está **depois** do refresh, na chamada à Analytics API, e o erro morre em `errorDetails` no corpo da resposta. Como a rota não grava em `cron_health` e ninguém lê o corpo, ela falha todo dia ao meio-dia sem produzir sinal.

- [ ] **Passo 1: descobrir o erro real**

Rodar a rota à mão contra produção e ler a resposta inteira:

```bash
# [NO MAC]
curl -s -H "Authorization: Bearer $CRON_SECRET" "https://bythiagofigueiredo.com/api/cron/sync-analytics-metrics" | python3 -m json.tool
```

O corpo devolve `{ synced, errors, errorDetails }`. **Cole a saída real antes de continuar.** Sem ela, qualquer correção é chute.

Diagnósticos prováveis, a confirmar pelo `errorDetails` — não presuma nenhum:
- escopo OAuth insuficiente (falta `yt-analytics.readonly`)
- token de `@tnfigueiredotv` vencido em 2026-09-01 e o refresh falhando
- canal sem dado elegível no período consultado
- consulta rejeitada pela API por dimensão/métrica inválida

- [ ] **Passo 2: parar de engolir erro em `analytics-queries.ts`**

`getCachedYtMetrics` (linhas 15-28) captura **qualquer** exceção e só reporta ao Sentry se for `YouTubeAnalyticsError`. Um `TokenRevokedError` ou um "no active youtube connection" cai fora e vira `return null` silencioso — a tela mostra "aguarde 48-72h" como se fosse normal.

Alterar para reportar toda exceção ao Sentry, mantendo o `return null` para a UI:

```ts
} catch (e) {
  // Antes: so YouTubeAnalyticsError chegava ao Sentry. Erro de token virava
  // "aguarde 48-72h" na tela, sem sinal nenhum.
  Sentry.captureException(e, { tags: { component: 'yt-analytics', action: 'getCachedYtMetrics' } })
  return null
}
```

- [ ] **Passo 3: gravar saúde**

Adicionar `recordCronSuccess('sync-analytics-metrics')` no caminho de sucesso e `recordCronFailure('sync-analytics-metrics', errorDetails.join('; '))` quando `errors > 0`. Importar de `@/lib/cron-health`. Sem isso, WP-H não consegue vigiar justamente o cron que mais importa para o score.

- [ ] **Passo 4: corrigir o que o passo 1 revelou**

Escopo definido pelo diagnóstico. **Se for escopo OAuth**, é reconexão manual das duas contas pela UI em `/cms/social/accounts`, não mudança de código — registre e escale ao dono. **Se for refresh falhando**, o conserto é em `lib/social/token-refresh.ts`. **Se for consulta inválida**, é em `analytics-client.ts`.

- [ ] **Passo 5: renovar as conexões Meta**

`facebook` e `instagram` estão sem `refresh_token_enc` e vencidos desde 2026-07-18. O cron `instagram-token-refresh` está agendado (GET, semanal) e mesmo assim não impediu. Diagnosticar junto com o passo 1 e escalar ao dono se exigir reconexão manual — publicação em social não funciona com token vencido, mesmo depois que WP-A ligar o cron.

- [ ] **Passo 6: PORTÃO DE VALIDAÇÃO do WP-K**

```bash
cd apps/web && npx vitest run test/cron/sync-analytics-metrics.test.ts
npx tsc --noEmit -p apps/web/tsconfig.json
```

E a prova que importa, contra produção:

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" "https://bythiagofigueiredo.com/api/cron/sync-analytics-metrics" | python3 -m json.tool
```

Critérios: `errors: 0`; e a consulta seguinte devolve linhas:

```sql
select count(*) from youtube_video_analytics;
select count(*) from youtube_videos where avg_view_percentage is not null;
```

Ambas precisam sair de zero. **Enquanto `youtube_video_analytics` estiver vazia, nenhum trabalho de scoring, Health Coach ou A/B Lab produz resultado real** — é por isso que este pacote vem antes de todos.

- [ ] **Passo 7: commit**

```bash
git add apps/web/src/app/api/cron/sync-analytics-metrics/route.ts apps/web/src/lib/youtube/analytics-queries.ts apps/web/test/cron/sync-analytics-metrics.test.ts
git commit -m "fix(youtube): sync de analytics falhava em silencio desde sempre

youtube_video_analytics tem 0 linhas em producao. Essa tabela alimenta
dailyByVideo, que alimenta 4 dos 6 eixos do score — growth, engagement,
sub_impact e retention ficam todos em zero por falta dela. A rota roda todo
dia, nao grava em cron_health e enterra o erro em errorDetails; e
getCachedYtMetrics engolia excecao de token sem mandar pro Sentry."
```

---

## WP-A — Verbo GET nas 8 rotas de cron já agendadas

Fecha F1 e F3. **Não toca `vercel.json`** — essas 8 rotas já estão lá; falta só o verbo.

**Files:**
- Modify: `apps/web/src/app/api/cron/lgpd-cleanup-sweep/route.ts`
- Modify: `apps/web/src/app/api/cron/publish-scheduled/route.ts`
- Modify: `apps/web/src/app/api/cron/purge-old-contact-submissions/route.ts`
- Modify: `apps/web/src/app/api/cron/purge-sent-emails/route.ts`
- Modify: `apps/web/src/app/api/cron/purge-webhook-events/route.ts`
- Modify: `apps/web/src/app/api/cron/social-auto-draft/route.ts`
- Modify: `apps/web/src/app/api/cron/social-metrics/route.ts`
- Modify: `apps/web/src/app/api/cron/social-publish/route.ts`
- Create: `apps/web/test/api/cron/vercel-get-export-guard.test.ts`

**Interfaces:**
- Produces: nada consumido por outro pacote. O teste-guarda passa a barrar qualquer rota agendada sem `GET`, inclusive as que WP-B adicionar depois.

**Contexto verificado:** as 8 rotas autenticam identicamente, com `Authorization: Bearer ${CRON_SECRET}` lido de `req.headers.get('authorization')` — nenhuma diferencia por verbo. Logo o alias reusa a mesma função com segurança. As filas foram medidas em produção e estão **todas vazias** (0 posts agendados, 0 campanhas, 0 social posts, 0 pedidos LGPD): ligar não despeja backlog.

- [ ] **Passo 1: escrever o teste-guarda**

Criar `apps/web/test/api/cron/vercel-get-export-guard.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const webRoot = process.cwd()

interface VercelCron {
  path: string
  schedule: string
}

function loadCrons(): VercelCron[] {
  const raw = readFileSync(join(webRoot, 'vercel.json'), 'utf-8')
  return JSON.parse(raw).crons as VercelCron[]
}

function routeFileFor(cronPath: string): string {
  const withoutQuery = cronPath.split('?')[0]!
  const relative = withoutQuery.replace(/^\/api\//, '')
  return join(webRoot, 'src/app/api', relative, 'route.ts')
}

function exportsGet(source: string): boolean {
  return (
    /export\s+(async\s+)?function\s+GET\s*\(/.test(source) ||
    /export\s+const\s+GET\s*[:=]/.test(source) ||
    /export\s*\{[^}]*\bas\s+GET\b[^}]*\}/.test(source)
  )
}

describe('Vercel cron GET export guard', () => {
  const crons = loadCrons()

  it('vercel.json tem ao menos uma entrada de cron', () => {
    expect(crons.length).toBeGreaterThan(0)
  })

  for (const cron of crons) {
    it(`existe route.ts para ${cron.path}`, () => {
      const file = routeFileFor(cron.path)
      expect(existsSync(file), `Falta route.ts para ${cron.path} (esperado em ${file})`).toBe(true)
    })

    it(`${cron.path} exporta GET (o cron da Vercel dispara GET)`, () => {
      const file = routeFileFor(cron.path)
      if (!existsSync(file)) return
      const source = readFileSync(file, 'utf-8')
      expect(
        exportsGet(source),
        `${cron.path} -> ${file} nao exporta GET; o cron da Vercel dispara GET e esta rota nunca vai rodar`,
      ).toBe(true)
    })
  }
})
```

- [ ] **Passo 2: rodar o teste e ver 8 falhas**

```bash
cd apps/web && npx vitest run test/api/cron/vercel-get-export-guard.test.ts
```

Esperado: FAIL, exatamente 8 casos `nao exporta GET`, nomeando `lgpd-cleanup-sweep`, `publish-scheduled`, `purge-old-contact-submissions`, `purge-sent-emails`, `purge-webhook-events`, `social-auto-draft`, `social-metrics`, `social-publish`.

Se o número for diferente de 8, **pare e reporte** — o repo mudou desde o levantamento e o plano precisa ser revisto.

- [ ] **Passo 3: adicionar o alias nas 8 rotas**

Em cada um dos 8 arquivos, adicionar ao final do arquivo (após a declaração de `POST`):

```ts
// O cron da Vercel dispara GET; a autenticacao le o header Authorization
// independente do verbo, entao o alias e seguro.
export const GET = POST
```

Este é o padrão já usado no repo — `anonymize-newsletter-tracking/route.ts:102`, `send-scheduled-newsletters/route.ts:124`, `send-welcome-emails/route.ts:224`.

- [ ] **Passo 4: PORTÃO DE VALIDAÇÃO do WP-A**

Rodar, nesta ordem, e colar a saída real:

```bash
cd apps/web && npx vitest run test/api/cron/vercel-get-export-guard.test.ts
npx tsc --noEmit -p apps/web/tsconfig.json
```

Critérios: teste-guarda PASS em todos os casos; typecheck limpo. Além disso, confirmar por leitura que nenhum dos 8 arquivos teve outra alteração além da linha do alias (`git diff --stat` deve mostrar +3 linhas por arquivo, no máximo).

- [ ] **Passo 5: commit**

```bash
git add apps/web/src/app/api/cron/lgpd-cleanup-sweep/route.ts apps/web/src/app/api/cron/publish-scheduled/route.ts apps/web/src/app/api/cron/purge-old-contact-submissions/route.ts apps/web/src/app/api/cron/purge-sent-emails/route.ts apps/web/src/app/api/cron/purge-webhook-events/route.ts apps/web/src/app/api/cron/social-auto-draft/route.ts apps/web/src/app/api/cron/social-metrics/route.ts apps/web/src/app/api/cron/social-publish/route.ts apps/web/test/api/cron/vercel-get-export-guard.test.ts
git commit -m "fix(cron): exportar GET nas 8 rotas agendadas + teste-guarda

O cron da Vercel dispara GET e essas rotas so exportavam POST — nunca
executaram. social-publish falhava 1440x por dia em silencio. O teste-guarda
cruza vercel.json com os metodos exportados e barra a regressao."
```

---

## WP-C — Entrega de notificação

Fecha F4, F5, F6, F7, F8. Nenhum outro pacote toca `lib/notifications/`.

**Files:**
- Modify: `apps/web/src/lib/notifications/adapters/email.ts`
- Modify: `apps/web/src/lib/notifications/cron/deliver.ts`
- Modify: `apps/web/src/app/cms/(authed)/settings/notifications/_components/preferences-client.tsx:39-61`
- Create: `apps/web/test/lib/notifications/deliver.test.ts`

**Interfaces:**
- Consumes: `getEmailService()` de `apps/web/lib/email/service.ts` — assinatura real: `send(msg: EmailMessage): Promise<EmailResult>`, onde `EmailMessage` tem `{ from: {name, email}, to: string, subject: string, html: string, text: string, metadata?: { configurationSet?: string } }`.
- Produces: `processDeliveryQueue(): Promise<{ processed: number; total: number }>` — assinatura mantida, o teste existente `apps/web/test/api/cron/notification-deliver.test.ts` continua válido.

**Contexto verificado:** `notification_deliveries` tem `status text CHECK IN ('pending','sent','failed','dead')`, `attempts int`, `next_retry_at`, `last_error`, `sent_at`. A interface do adapter é `send(notification, user) => Promise<{success: boolean; error?: string}>`. A fila está **vazia em produção** (0 pendentes) — não há rajada ao ligar.

- [ ] **Passo 1: escrever o teste falhando**

Criar `apps/web/test/lib/notifications/deliver.test.ts` com três casos: adapter que falha grava `status:'failed'` e `last_error`; canal sem adapter nunca marca `'sent'`; sucesso marca `'sent'`. Copiar o padrão de mock de `apps/web/test/lib/cron-health.test.ts` (`vi.mock('@/lib/supabase/service')` antes do import do código sob teste, chain mockada).

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
const sendMock = vi.fn()
vi.mock('../../../src/lib/notifications/adapters', () => ({
  EmailAdapter: vi.fn().mockImplementation(() => ({ channel: 'email', send: sendMock })),
  PushAdapter: vi.fn().mockImplementation(() => ({ channel: 'push', send: vi.fn() })),
  TelegramAdapter: vi.fn().mockImplementation(() => ({ channel: 'telegram', send: vi.fn() })),
}))

import { processDeliveryQueue } from '../../../src/lib/notifications/cron/deliver'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

function makeSupabase(pending: Record<string, unknown>[]) {
  const updates: Record<string, unknown>[] = []
  const chain = {
    select: () => chain,
    eq: () => chain,
    lte: () => chain,
    order: () => chain,
    limit: () => Promise.resolve({ data: pending, error: null }),
    update: (payload: Record<string, unknown>) => ({
      eq: (_c: string, val: unknown) => {
        updates.push({ ...payload, id: val })
        return Promise.resolve({ error: null })
      },
    }),
  }
  return {
    from: () => chain,
    auth: { admin: { getUserById: () => Promise.resolve({ data: { user: { email: 'u@x.com' } } }) } },
    _updates: updates,
  }
}

beforeEach(() => vi.clearAllMocks())

describe('processDeliveryQueue', () => {
  it('adapter que falha grava failed + last_error', async () => {
    sendMock.mockResolvedValue({ success: false, error: 'SES throttled' })
    const supabase = makeSupabase([{ id: 'd1', channel: 'email', attempts: 0, notifications: { user_id: 'u1' } }])
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)
    await processDeliveryQueue()
    expect(supabase._updates[0]).toMatchObject({ status: 'failed', last_error: 'SES throttled', id: 'd1' })
  })

  it('canal sem adapter nunca marca sent', async () => {
    const supabase = makeSupabase([{ id: 'd2', channel: 'sms', attempts: 0, notifications: { user_id: 'u1' } }])
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)
    const result = await processDeliveryQueue()
    expect(result.processed).toBe(0)
    expect(supabase._updates[0]!.status).not.toBe('sent')
  })

  it('sucesso marca sent', async () => {
    sendMock.mockResolvedValue({ success: true })
    const supabase = makeSupabase([{ id: 'd3', channel: 'email', attempts: 0, notifications: { user_id: 'u1' } }])
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)
    const result = await processDeliveryQueue()
    expect(result.processed).toBe(1)
    expect(supabase._updates[0]!.status).toBe('sent')
  })
})
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
cd apps/web && npx vitest run test/lib/notifications/deliver.test.ts
```

Esperado: FAIL nos três — o código atual marca tudo como `'sent'` sem chamar adapter nenhum.

- [ ] **Passo 3: trocar o adaptador de e-mail para SES**

Substituir o corpo de `apps/web/src/lib/notifications/adapters/email.ts`:

```ts
import { getEmailService } from '@/lib/email/service'
import type { IChannelAdapter, ChannelResult, IUserProfile } from './interface'
import type { INotification } from '../types'

export class EmailAdapter implements IChannelAdapter {
  readonly channel = 'email' as const

  async send(notification: INotification, user: IUserProfile): Promise<ChannelResult> {
    if (!user.email) return { success: false, error: 'usuario sem endereco de e-mail' }
    try {
      const fromDomain = process.env.NEWSLETTER_FROM_DOMAIN ?? 'bythiagofigueiredo.com'
      await getEmailService().send({
        from: { email: `noreply@${fromDomain}`, name: 'Notifications' },
        to: user.email,
        subject: notification.title,
        html: `<p>${notification.message ?? notification.title}</p>`,
        text: notification.message ?? notification.title,
        metadata: { configurationSet: process.env.SES_TRANSACTIONAL_CONFIG_SET },
      })
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  async healthCheck(): Promise<boolean> {
    return !!process.env.AWS_SES_ACCESS_KEY_ID
  }
}
```

- [ ] **Passo 4: implementar o despacho real**

Substituir `processDeliveryQueue()` em `apps/web/src/lib/notifications/cron/deliver.ts`:

```ts
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { EmailAdapter, PushAdapter, TelegramAdapter } from '../adapters'
import type { IChannelAdapter, IUserProfile, INotification, DeliveryChannel } from '../types'

const ADAPTERS: Record<DeliveryChannel, IChannelAdapter> = {
  email: new EmailAdapter(),
  push: new PushAdapter(),
  telegram: new TelegramAdapter(),
}
const MAX_ATTEMPTS = 5

async function getUserProfile(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  userId: string,
): Promise<IUserProfile | null> {
  const { data: authData } = await supabase.auth.admin.getUserById(userId)
  if (!authData?.user) return null
  // NOTA: telegram_chat_id vinha de public.profiles, que NAO EXISTE em producao.
  // Ate a tabela existir, o canal telegram falha explicitamente em vez de fingir sucesso.
  return { id: userId, email: authData.user.email ?? null, telegram_chat_id: null }
}

export async function processDeliveryQueue(): Promise<{ processed: number; total: number }> {
  const supabase = getSupabaseServiceClient()
  const { data: pending, error: selectErr } = await supabase
    .from('notification_deliveries')
    .select('*, notifications(*)')
    .eq('status', 'pending')
    .lte('next_retry_at', new Date().toISOString())
    .order('next_retry_at')
    .limit(50)

  if (selectErr) throw selectErr
  if (!pending?.length) return { processed: 0, total: 0 }

  let processed = 0
  for (const delivery of pending) {
    const channel = delivery.channel as DeliveryChannel
    const notification = delivery.notifications as INotification | null
    try {
      const adapter = ADAPTERS[channel]
      if (!adapter) throw new Error(`nenhum adapter registrado para o canal "${channel}"`)
      if (!notification?.user_id) throw new Error(`delivery ${delivery.id} sem notification/user_id`)
      const user = await getUserProfile(supabase, notification.user_id)
      if (!user) throw new Error(`usuario ${notification.user_id} nao encontrado`)
      const result = await adapter.send(notification, user)
      if (!result.success) throw new Error(result.error ?? `adapter ${channel} retornou falha`)
      await supabase
        .from('notification_deliveries')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', delivery.id)
      processed++
    } catch (error) {
      const attempts = (delivery.attempts as number) + 1
      const backoffMs = Math.min(30_000 * 2 ** attempts, 7_200_000)
      await supabase
        .from('notification_deliveries')
        .update({
          status: attempts >= MAX_ATTEMPTS ? 'dead' : 'failed',
          attempts,
          last_error: error instanceof Error ? error.message : String(error),
          next_retry_at: attempts < MAX_ATTEMPTS ? new Date(Date.now() + backoffMs).toISOString() : null,
        })
        .eq('id', delivery.id)
    }
  }
  return { processed, total: pending.length }
}
```

- [ ] **Passo 5: parar de mentir na UI**

Em `apps/web/src/app/cms/(authed)/settings/notifications/_components/preferences-client.tsx`, no array `CHANNELS` (linhas 39-61): desabilitar os toggles de `push` e `telegram`, com motivo visível ao lado do rótulo. Texto exato a usar:

- push: `indisponivel — adapter de web-push nao implementado`
- telegram: `indisponivel — pareamento depende de tabela ausente`

Manter `email` e `in_app` habilitados. Não remover os canais da lista — o usuário precisa ver que existem e por que não estão ligados.

- [ ] **Passo 6: PORTÃO DE VALIDAÇÃO do WP-C**

```bash
cd apps/web && npx vitest run test/lib/notifications/deliver.test.ts test/api/cron/notification-deliver.test.ts
npx tsc --noEmit -p apps/web/tsconfig.json
```

Critérios: os três casos novos PASS; o teste pré-existente `notification-deliver.test.ts` continua PASS; typecheck limpo.

**Validação de ponta a ponta (manual, uma vez):** com o dev server rodando, criar uma notificação de teste via SQL no banco local (`insert into notifications ...` + `insert into notification_deliveries (channel, status) values ('email','pending')`), chamar a rota, e confirmar que a linha virou `sent` **e** que o e-mail chegou. Se não chegar, `last_error` tem que dizer por quê — o critério real deste pacote é que a falha seja legível, não que o envio funcione na primeira.

- [ ] **Passo 7: commit**

```bash
git add apps/web/src/lib/notifications/adapters/email.ts apps/web/src/lib/notifications/cron/deliver.ts "apps/web/src/app/cms/(authed)/settings/notifications/_components/preferences-client.tsx" apps/web/test/lib/notifications/deliver.test.ts
git commit -m "fix(notifications): despachar de verdade em vez de marcar como enviado

deliver.ts marcava toda entrega como 'sent' sem chamar adapter nenhum (TODO
no lugar do envio). O adapter de e-mail apontava para Resend num projeto que
migrou para SES em abril. Push e telegram ficam desligados na UI com motivo
visivel: push e stub, e telegram depende de public.profiles, que nao existe."
```

---

## WP-D — Observatório de competidores

Fecha F9, F10, F11. Nenhum outro pacote toca esses arquivos.

**Files:**
- Create: `apps/web/src/lib/supabase/one-embed.ts`
- Create: `apps/web/src/lib/youtube/snapshot-delta.ts`
- Modify: `apps/web/src/app/cms/(authed)/youtube/competitors/page.tsx` (linhas 94-102, 191-198, 213-239, 356-386)
- Modify: `apps/web/src/lib/pipeline/services/competitors.ts:234-235`
- Create: `apps/web/test/lib/supabase/one-embed.test.ts`
- Create: `apps/web/test/youtube/snapshot-delta.test.ts`

**Interfaces:**
- Produces: `oneEmbed<T>(value: T | T[] | null | undefined): T | null` em `@/lib/supabase/one-embed`; `computeSnapshotDelta(snapshots, field, now?): number | null` em `@/lib/youtube/snapshot-delta`.

**Contexto verificado [DB]:** 1293 snapshots no banco (2026-06-01 a 2026-09-02); a página vê 500 (até 2026-07-08). 200 mudanças no banco; a aba mostra 0. A FK confirma que `competitor_videos` e `competitor_channels` são embeds *to-one* — o supabase-js devolve objeto.

- [ ] **Passo 1: escrever os dois testes falhando**

`apps/web/test/lib/supabase/one-embed.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { oneEmbed } from '@/lib/supabase/one-embed'

describe('oneEmbed', () => {
  it('devolve o objeto quando o embed to-one vem como objeto', () => {
    const row = { video_id: 'v1' }
    expect(oneEmbed(row)).toEqual(row)
  })
  it('desembrulha o primeiro item quando vem como array', () => {
    expect(oneEmbed([{ video_id: 'v1' }, { video_id: 'v2' }])).toEqual({ video_id: 'v1' })
  })
  it('devolve null para null, undefined e array vazio', () => {
    expect(oneEmbed(null)).toBeNull()
    expect(oneEmbed(undefined)).toBeNull()
    expect(oneEmbed([])).toBeNull()
  })
})
```

`apps/web/test/youtube/snapshot-delta.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { computeSnapshotDelta, type ChannelSnapshot } from '@/lib/youtube/snapshot-delta'

const NOW = new Date('2026-09-02T00:00:00Z').getTime()

function daily(startISO: string, n: number, valueAt: (i: number) => number): ChannelSnapshot[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(startISO)
    d.setUTCDate(d.getUTCDate() + i)
    return {
      snapshot_date: d.toISOString().slice(0, 10),
      subscriber_count: valueAt(i),
      view_count: valueAt(i) * 100,
    }
  })
}

describe('computeSnapshotDelta', () => {
  it('devolve null com menos de dois snapshots', () => {
    const one = [{ snapshot_date: '2026-09-01', subscriber_count: 10, view_count: 10 }]
    expect(computeSnapshotDelta(one, 'subscriber_count', NOW)).toBeNull()
  })

  it('com 90 dias de historico, calcula a delta de sete dias', () => {
    const snaps = daily('2026-06-04', 90, i => 1000 + i * 5)
    expect(computeSnapshotDelta(snaps, 'subscriber_count', NOW)).toBe(35)
  })

  it('usa o campo pedido', () => {
    const snaps = daily('2026-06-04', 90, i => 1000 + i * 5)
    expect(computeSnapshotDelta(snaps, 'view_count', NOW)).toBe(3500)
  })

  it('sintoma do bug: todo snapshot com mais de sete dias devolve null', () => {
    const snaps = daily('2026-06-01', 38, i => 100 + i)
    expect(computeSnapshotDelta(snaps, 'subscriber_count', NOW)).toBeNull()
  })
})
```

- [ ] **Passo 2: rodar e ver falhar por módulo inexistente**

```bash
cd apps/web && npx vitest run test/lib/supabase/one-embed.test.ts test/youtube/snapshot-delta.test.ts
```

Esperado: FAIL — `Cannot find module '@/lib/supabase/one-embed'` e `'@/lib/youtube/snapshot-delta'`.

- [ ] **Passo 3: criar os dois módulos**

`apps/web/src/lib/supabase/one-embed.ts`:

```ts
/**
 * Normaliza um embed to-one do supabase-js.
 *
 * O supabase-js devolve OBJETO para uma FK to-one, mas o shape em runtime nao
 * e garantido pelo cast do TypeScript — so pela direcao da FK. Escrever
 * `(x as Array<T>)?.[0]` sobre um objeto produz undefined em silencio, que foi
 * exatamente o defeito que descartou 200 mudancas de competidor.
 */
export function oneEmbed<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null
  if (Array.isArray(value)) return value[0] ?? null
  return value
}
```

`apps/web/src/lib/youtube/snapshot-delta.ts`:

```ts
export interface ChannelSnapshot {
  snapshot_date: string
  subscriber_count: number | null
  view_count: number | null
}

/** Delta semanal. Exige snapshots ordenados ascendente por data. */
export function computeSnapshotDelta(
  snapshots: ReadonlyArray<ChannelSnapshot>,
  field: 'subscriber_count' | 'view_count',
  now: number = Date.now(),
): number | null {
  if (snapshots.length < 2) return null
  const latest = snapshots[snapshots.length - 1]!
  const sevenDaysAgoStr = new Date(now - 7 * 86_400_000).toISOString().slice(0, 10)
  const weekAgoSnap =
    snapshots.reduce<ChannelSnapshot | null>(
      (best, s) => (s.snapshot_date <= sevenDaysAgoStr ? s : best),
      null,
    ) ?? snapshots[0]!
  if (weekAgoSnap.snapshot_date === latest.snapshot_date) return null
  return (latest[field] ?? 0) - (weekAgoSnap[field] ?? 0)
}
```

- [ ] **Passo 4: corrigir a query de snapshots (F9)**

Em `apps/web/src/app/cms/(authed)/youtube/competitors/page.tsx`, substituir o bloco das linhas 94-102 por:

```ts
// ── 4. Snapshots por canal (ultimos N de CADA canal) ──
// Antes: uma query so, ordenada ascendente, com .limit(500) global. Ao passar
// de 500 linhas no total, a pagina passou a ver so as mais ANTIGAS — desde
// 2026-07-08 todo o observatorio rodava sobre dados de julho.
const SNAPSHOT_LIMIT_PER_CHANNEL = 60
const snapshotResults = await Promise.all(
  channelIds.map(chId =>
    supabase
      .from('competitor_channel_snapshots')
      .select('competitor_channel_id, subscriber_count, view_count, video_count, snapshot_date')
      .eq('competitor_channel_id', chId)
      .order('snapshot_date', { ascending: false })
      .limit(SNAPSHOT_LIMIT_PER_CHANNEL),
  ),
)
const snapshots = snapshotResults.flatMap(r => (r.data ?? []).slice().reverse())
```

O `.reverse()` por canal é obrigatório: toda a lógica seguinte (agrupamento na linha 182, `computeViewGrowthSparkline`, `computeGrowthScore`) assume ordem ascendente.

- [ ] **Passo 5: usar `computeSnapshotDelta` (F10)**

No mesmo arquivo, substituir as linhas 213-239 (os dois blocos duplicados de cálculo de delta) por:

```ts
const subscriberGrowthDelta = computeSnapshotDelta(snaps, 'subscriber_count')
const viewGrowthDelta = computeSnapshotDelta(snaps, 'view_count')
```

Adicionar o import no topo: `import { computeSnapshotDelta } from '@/lib/youtube/snapshot-delta'`.

- [ ] **Passo 6: corrigir os casts de embed (F11)**

No mesmo arquivo, adicionar `import { oneEmbed } from '@/lib/supabase/one-embed'` e substituir as três ocorrências:

- linha ~193: `const vidId = (c.competitor_videos as Array<{ video_id: string }>)?.[0]?.video_id`
  → `const vidId = oneEmbed(c.competitor_videos)?.video_id`
- linha ~358-359 (dentro de `mapChange`): `const vidInfo = (c.competitor_videos as Array<...>)?.[0]` e `const chInfo = vidInfo?.competitor_channels?.[0]`
  → `const vidInfo = oneEmbed(c.competitor_videos)` e `const chInfo = vidInfo ? oneEmbed(vidInfo.competitor_channels) : null`
- linha ~381: `const vidId = (c.competitor_videos as Array<{ video_id: string }>)?.[0]?.video_id ?? ''`
  → `const vidId = oneEmbed(c.competitor_videos)?.video_id ?? ''`

Ajustar os tipos das anotações locais para aceitar `T | T[] | null` em vez de `Array<T>` — sem `as`, para que o compilador volte a poder ajudar.

Em `apps/web/src/lib/pipeline/services/competitors.ts:234-235`, aplicar a mesma correção: `oneEmbed(c.competitor_videos)` e `oneEmbed(vidInfo.competitor_channels)`, removendo o `as unknown as Array<...>`.

- [ ] **Passo 7: PORTÃO DE VALIDAÇÃO do WP-D**

```bash
cd apps/web && npx vitest run test/lib/supabase/one-embed.test.ts test/youtube/snapshot-delta.test.ts
npx tsc --noEmit -p apps/web/tsconfig.json
grep -rn "as Array<" "apps/web/src/app/cms/(authed)/youtube/competitors/page.tsx" apps/web/src/lib/pipeline/services/competitors.ts
```

Critérios: testes PASS; typecheck limpo; o `grep` **não retorna nada** nesses dois arquivos.

**Validação de tela (MCP DevTools, uma vez):** com o dev server rodando e login feito no browser controlado, abrir `/cms/youtube/competitors` e confirmar três coisas — a aba Mudanças mostra contagem maior que zero; a coluna Crescimento mostra número em vez de `—`; o console não tem erro novo. Se a rota exigir login e não for viável nesta sessão, registrar como pendência de verificação manual do dono, **não** substituir por um teste que não prova a mesma coisa.

- [ ] **Passo 8: commit**

```bash
git add apps/web/src/lib/supabase/one-embed.ts apps/web/src/lib/youtube/snapshot-delta.ts "apps/web/src/app/cms/(authed)/youtube/competitors/page.tsx" apps/web/src/lib/pipeline/services/competitors.ts apps/web/test/lib/supabase/one-embed.test.ts apps/web/test/youtube/snapshot-delta.test.ts
git commit -m "fix(youtube): observatorio lia dados de julho e descartava 200 mudancas

O .limit(500) global na query de snapshots ordenada ascendente fez a pagina
congelar em 2026-07-08 quando a tabela passou de 500 linhas. E o cast
'as Array<>' sobre um embed to-one (que o supabase-js devolve como objeto)
fazia o ?.[0] virar undefined e o continue descartar toda mudanca."
```

---

## WP-E — Loop de inteligência

Fecha F12, F13, F14, F15. Cria a rota de watchdog; **quem a registra no `vercel.json` é WP-B**.

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/youtube/analytics/actions.ts` (adicionar `fetchChannelCoaching`)
- Modify: `apps/web/src/app/cms/(authed)/youtube/analytics/page.tsx` (linhas 51-69)
- Modify: `apps/web/src/app/cms/(authed)/youtube/analytics/_components/yt-analytics-tabs.tsx` (linhas 158-161, 326-383)
- Modify: `apps/web/src/app/cms/(authed)/youtube/analytics/_components/yt-health-coach.tsx` (bloco do banner, ~linha 96)
- Modify: `apps/web/src/lib/youtube/optimization-loop.ts` (adicionar `applyCycleTransition`)
- Modify: `apps/web/src/lib/pipeline/services/youtube.ts:367-371`
- Modify: `apps/web/src/app/api/cron/optimization-monitor/route.ts:71-75, 97-100`
- Modify: `apps/web/src/lib/youtube/ab-evaluate-phases.ts:294-298, 488-492`
- Create: `apps/web/src/app/api/cron/youtube-intelligence-watchdog/route.ts`
- Create: `apps/web/test/youtube/coaching-actions.test.ts`
- Create: `apps/web/test/cron/youtube-intelligence-watchdog.test.ts`

**Interfaces:**
- Produces: `fetchChannelCoaching(channelId: string): Promise<{ coaching: CoachingOutput; generatedAt: string } | null>`; `applyCycleTransition(supabase, cycleId: string, to: OptimizationState, trigger: TransitionTrigger): Promise<void>`; a rota `GET /api/cron/youtube-intelligence-watchdog` — **WP-B precisa deste caminho exato**.

**Atenção — colisão com WP-G:** `ab-evaluate-phases.ts` é tocado por WP-E (linhas 294-298 e 488-492, transições de ciclo) e por WP-G (linhas 109-127 e 321-322, expiração e gates). As regiões são disjuntas, mas o arquivo é o mesmo. **WP-E e WP-G devem coordenar: quem terminar primeiro commita, o segundo faz `git pull --rebase` antes de editar.** Se o executor for um único agente, faça WP-G depois de WP-E e releia o arquivo.

**Contexto verificado:** `CoachingSchema` (o que a API valida) é `{ summary: string(max 500), priorities: Array<{axis, score: 0-10, diagnosis: max 300, action: max 300}>(max 6) }`. O tipo TS diverge (não limita nada e marca `coaching` como obrigatório quando o Zod o tem como opcional) — **o Zod vale**. Existem 5 call-sites que escrevem `state` direto, não 3. Há **1 task presa em `running` em produção agora**.

- [ ] **Passo 1: escrever os testes falhando**

Criar `apps/web/test/youtube/coaching-actions.test.ts` (padrão de mock copiado de `apps/web/test/youtube/notes-actions.test.ts`) com dois casos: devolve a linha de coaching de canal quando existe; devolve `null` quando não existe.

Criar `apps/web/test/cron/youtube-intelligence-watchdog.test.ts` com dois casos: libera só as tasks além do prazo (assert que o filtro `.eq('status','running')` foi chamado e que `released` é 1); devolve 401 sem `CRON_SECRET` válido.

Adicionar a `apps/web/test/analytics-optimization-loop.test.ts` o caso `it('rejeita diagnosed -> testing', () => expect(canTransition('diagnosed','testing')).toBe(false))`.

- [ ] **Passo 2: rodar e ver falhar**

```bash
cd apps/web && npx vitest run test/youtube/coaching-actions.test.ts test/cron/youtube-intelligence-watchdog.test.ts test/analytics-optimization-loop.test.ts
```

- [ ] **Passo 3: ler o coaching de canal (F12)**

Adicionar a `apps/web/src/app/cms/(authed)/youtube/analytics/actions.ts`:

```ts
import type { CoachingOutput } from '@/lib/youtube/intelligence-types'

export async function fetchChannelCoaching(
  channelId: string,
): Promise<{ coaching: CoachingOutput; generatedAt: string } | null> {
  if (!UUID_RE.test(channelId)) throw new Error('invalid_input')
  const { siteId } = await getSiteContext()
  const auth = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  if (!auth.ok) throw new Error(auth.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')
  const supabase = getSupabaseServiceClient()

  const { data } = await supabase
    .from('youtube_intelligence')
    .select('coaching, generated_at')
    .eq('site_id', siteId)
    .eq('channel_id', channelId)
    .is('video_id', null)
    .eq('source', 'cowork')
    .eq('type', 'channel')
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data?.coaching) return null
  return { coaching: data.coaching as CoachingOutput, generatedAt: data.generated_at }
}
```

Em `page.tsx`, adicionar ao `Promise.all` das linhas 51-69: `fetchChannelCoaching(activeChannel.internalId).catch(() => null)`, e repassar `channelCoaching={channelCoaching}` para `<YtAnalyticsTabs>`.

- [ ] **Passo 4: priorizar o Cowork e parar de mentir (F13)**

Em `yt-analytics-tabs.tsx`, adicionar a prop `channelCoaching?: { coaching: CoachingOutput; generatedAt: string } | null` e trocar o `useMemo` das linhas 158-161 por:

```ts
const coachingCards = useMemo(
  () => computeCoachingCards(intelligenceVideos ?? [], channelCoaching?.coaching ?? null),
  [intelligenceVideos, channelCoaching],
)
```

Substituir `computeCoachingCards` (linhas 353-383) para aceitar o segundo parâmetro. Quando `channelCoaching?.priorities?.length` for maior que zero, mapear as prioridades do Cowork com `source: 'cowork' as const`, ordenar por `score` ascendente e cortar em 3. Caso contrário, manter exatamente a lógica heurística atual, mas trocar o `benchmark: 5.0` hardcoded por a constante `const COACHING_BENCHMARK = 6.5`, alinhada ao corte real usado no `.filter(c => c.score < 6.5)` logo abaixo — o `5.0` era incoerente com o próprio filtro e inflava os "pontos recuperáveis" mostrados ao usuário.

Em `yt-health-coach.tsx`, no banner:

```tsx
const hasCoworkCoaching = sortedCards.some(c => c.source === 'cowork')
```

e trocar o rótulo fixo `Diagnostico do Cowork` por `{hasCoworkCoaching ? 'Diagnostico do Cowork' : 'Diagnostico heuristico'}`. Quando `!hasCoworkCoaching && sortedCards.length > 0`, renderizar abaixo do parágrafo:

```tsx
<p className="dim" style={{ fontSize: 11, marginTop: 4 }}>
  Baseado em regras fixas — ainda sem analise do Cowork para este canal.
</p>
```

- [ ] **Passo 5: usar a máquina de estados (F14)**

Adicionar a `apps/web/src/lib/youtube/optimization-loop.ts`:

```ts
export async function applyCycleTransition(
  supabase: SupabaseClient,
  cycleId: string,
  to: OptimizationState,
  trigger: TransitionTrigger,
): Promise<void> {
  const { data: cycle } = await supabase.from('optimization_cycles').select('*').eq('id', cycleId).single()
  if (!cycle) return
  const { id, ...patch } = transitionState(cycle as OptimizationCycle, to, trigger)
  await supabase.from('optimization_cycles').update(patch).eq('id', id)
}
```

Trocar os 5 call-sites de update direto por chamadas a `applyCycleTransition`:

1. `services/youtube.ts:367-371` → `applyCycleTransition(supabase, cycle.id, 'diagnosed', { diagnosis_summary: rec.reasoning })`
2. `cron/optimization-monitor/route.ts:71-75` → `applyCycleTransition(supabase, cycle.id, 'resolved', { resolved_reason: 'grade_improved' })`
3. `cron/optimization-monitor/route.ts:97-100` → `applyCycleTransition(supabase, cycle.id, 'retest_needed', {})`
4. `ab-evaluate-phases.ts:294-298` → `applyCycleTransition(supabase, cycle.id, 'post_test_monitoring', {})`
5. `ab-evaluate-phases.ts:488-492` → idem

Nos casos 2 e 3, trocar o `select('id, ...')` por `select('*')`, porque `transitionState` precisa da linha inteira.

**Não inventar transição para `test_suggested` e `testing`.** Esses dois estados continuam inalcançáveis porque nada no produto liga um `optimization_cycles` a um `ab_test_id`. Registre isso no commit como gap conhecido — não crie a ligação por conta própria.

- [ ] **Passo 6: liberar tasks presas (F15)**

Criar `apps/web/src/app/api/cron/youtube-intelligence-watchdog/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import * as Sentry from '@sentry/nextjs'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const STALE_THRESHOLD_MINUTES = 30

async function handle(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = getSupabaseServiceClient()
  const cutoff = new Date(Date.now() - STALE_THRESHOLD_MINUTES * 60_000).toISOString()

  const { data: released, error } = await supabase
    .from('youtube_intelligence_tasks')
    .update({
      status: 'stale',
      error_message: `auto-released: running past ${STALE_THRESHOLD_MINUTES}min`,
    })
    .eq('status', 'running')
    .lt('started_at', cutoff)
    .select('id, channel_id')

  if (error) {
    Sentry.captureMessage(`youtube-intelligence-watchdog: ${error.message}`)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ released: released?.length ?? 0 })
}

export const GET = handle
export const POST = handle
```

O status `stale` já existe no CHECK da migration `20260517000003_analytics_intelligence.sql:235` e nunca era escrito. Como `idx_yt_intel_task_active` só cobre `pending` e `running`, marcar `stale` libera o canal.

- [ ] **Passo 7: PORTÃO DE VALIDAÇÃO do WP-E**

```bash
cd apps/web && npx vitest run test/youtube/coaching-actions.test.ts test/cron/youtube-intelligence-watchdog.test.ts test/analytics-optimization-loop.test.ts test/cms/analytics.test.tsx
npx tsc --noEmit -p apps/web/tsconfig.json
```

Critérios: todos PASS; typecheck limpo. Confirmar por leitura que `yt-analytics-tabs.tsx` não tem mais `benchmark: 5.0` e que existe pelo menos um caminho produzindo `source: 'cowork'`:

```bash
grep -rn "source: 'cowork'" "apps/web/src/app/cms/(authed)/youtube/analytics/_components/yt-analytics-tabs.tsx"
```

Deve retornar ao menos uma linha — antes deste pacote, o repo inteiro não tinha nenhuma.

- [ ] **Passo 8: commit**

```bash
git add "apps/web/src/app/cms/(authed)/youtube/analytics/actions.ts" "apps/web/src/app/cms/(authed)/youtube/analytics/page.tsx" "apps/web/src/app/cms/(authed)/youtube/analytics/_components/yt-analytics-tabs.tsx" "apps/web/src/app/cms/(authed)/youtube/analytics/_components/yt-health-coach.tsx" apps/web/src/lib/youtube/optimization-loop.ts apps/web/src/lib/pipeline/services/youtube.ts apps/web/src/app/api/cron/optimization-monitor/route.ts apps/web/src/lib/youtube/ab-evaluate-phases.ts apps/web/src/app/api/cron/youtube-intelligence-watchdog/route.ts apps/web/test/youtube/coaching-actions.test.ts apps/web/test/cron/youtube-intelligence-watchdog.test.ts apps/web/test/analytics-optimization-loop.test.ts
git commit -m "fix(youtube): ler o coaching que o Cowork ja gravava, e liberar task presa

A UI filtrava .not('video_id','is',null), que exclui exatamente a linha de
coaching de canal — o Cowork analisava, gravava e a tela mostrava texto fixo
rotulado como diagnostico dele. Agora le a linha real, marca source honesto,
e chama transitionState nos 5 call-sites que escreviam state direto.

Gap conhecido: test_suggested e testing seguem inalcancaveis — nada liga
optimization_cycles a ab_test_id. Nao inventei a ligacao."
```

---

## WP-F — Research API (bloqueador da ingestão do curso)

Fecha F22. Nenhum outro pacote toca este arquivo.

**Files:**
- Modify: `apps/web/src/lib/pipeline/services/research.ts` (`createResearchItem` ~295-350, `importResearchItems` ~634-705)
- Create: `apps/web/test/integration/pipeline/research-create.integration.test.ts`

**Contexto verificado:** a migration `20260604000003_research_cms_redesign.sql` removeu `UNIQUE(site_id,topic_id,title)` (trocou por `site_id,theme_id,title`), trocou o CHECK de status de `('new','reviewed','starred','archived')` para `('fresca','analise','aplicada','arquivada')`, e tornou `theme_id NOT NULL` sem default. O código manda `onConflict: 'site_id,topic_id,title'` (erro `42P10` sempre), `status: 'new'` (viola o CHECK) e omite `theme_id`. Os 6 temas são `['asia','ia','dev','games','grana','canal']`; o default correto é `'canal'`, que é o que a UI usa (`pipeline/research/actions.ts:150-172`, com o comentário "seed the catch-all 'canal' theme").

**Por que o teste atual não pegou:** `apps/web/test/api/pipeline/research-import-api.test.ts` mocka o Supabase inteiro com uma chain genérica cujo `.single()` sempre devolve `{data:null,error:null}`. Nenhuma query chega ao Postgres, então `ON CONFLICT`, CHECK e NOT NULL nunca são exercidos. **Só um teste de integração pega este defeito** — por isso este pacote usa Postgres local.

- [ ] **Passo 1: escrever o teste de integração falhando**

Criar `apps/web/test/integration/pipeline/research-create.integration.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest'
import { skipIfNoLocalDb } from '../../helpers/db-skip'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { createResearchItem, importResearchItems } from '@/lib/pipeline/services/research'
import type { ServiceContext } from '@/lib/pipeline/services/types'

describe.skipIf(skipIfNoLocalDb())('createResearchItem contra Postgres real', () => {
  let ctx: ServiceContext

  beforeAll(() => {
    ctx = { supabase: getSupabaseServiceClient(), siteId: process.env.TEST_SITE_ID! } as ServiceContext
  })

  it('insere com status valido e faz upsert no titulo repetido', async () => {
    const input = {
      title: `Curso Teste ${Date.now()}`,
      topic_slug: 'curso-teste',
      content_md: '# conteudo',
      theme_id: 'dev',
    }

    const first = await createResearchItem(ctx, input)
    expect(first.ok).toBe(true)
    if (!first.ok) return
    expect(first.status).toBe(201)
    expect(first.data.status).toBe('fresca')

    const second = await createResearchItem(ctx, input)
    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(second.data.id).toBe(first.data.id)
  })

  it('usa canal como theme_id default quando omitido', async () => {
    const res = await createResearchItem(ctx, {
      title: `Sem tema ${Date.now()}`,
      topic_slug: 'curso-teste',
      content_md: 'x',
    })
    expect(res.ok).toBe(true)
  })

  it('importa lote sem violar CHECK nem NOT NULL', async () => {
    const res = await importResearchItems(ctx, {
      items: [
        { title: `Lote ${Date.now()}`, topic_slug: 'curso-teste', content_md: 'conteudo', theme_id: 'ia' },
      ],
    })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.data.failure_count).toBe(0)
  })
})
```

- [ ] **Passo 2: subir o banco local e ver falhar**

```bash
npm run db:start
HAS_LOCAL_DB=1 npx vitest run apps/web/test/integration/pipeline/research-create.integration.test.ts
```

Esperado: FAIL com erro de banco `42P10` (`there is no unique or exclusion constraint matching the ON CONFLICT specification`).

Se o teste for **skipped** em vez de falhar, o banco local não subiu — resolva isso antes de continuar; passar por skip aqui é o mesmo defeito que deixou este bug três meses em produção.

- [ ] **Passo 3: corrigir `createResearchItem`**

Em `apps/web/src/lib/pipeline/services/research.ts`, dentro de `createResearchItem`: extrair `theme_id`, `pinned` e `takeaways` do `parsed.data`, definir `const resolvedThemeId = theme_id ?? 'canal'`, e trocar o objeto do upsert para incluir `theme_id: resolvedThemeId`, `status: 'fresca'`, e os campos opcionais via spread condicional. Trocar `{ onConflict: 'site_id,topic_id,title' }` por `{ onConflict: 'site_id,theme_id,title' }`.

Manter upsert (não trocar por insert): o contrato documentado em `cowork-docs-research.md:21-22` é "novo → create / já existe → update", e o chamador depende da idempotência por título para o Cowork poder reenviar sem conhecer o UUID.

- [ ] **Passo 4: corrigir `importResearchItems`**

No mesmo arquivo, no loop de itens: a mesma correção, mais o repasse de `theme_id: item.theme_id ?? 'canal'`, `pinned` e `takeaways` — que hoje nem são repassados, então mesmo corrigindo o `onConflict` o insert ainda falharia por `theme_id` nulo.

- [ ] **Passo 5: PORTÃO DE VALIDAÇÃO do WP-F**

```bash
HAS_LOCAL_DB=1 npx vitest run apps/web/test/integration/pipeline/research-create.integration.test.ts
cd apps/web && npx vitest run test/lib/pipeline/research-schemas.test.ts test/api/pipeline/research-import-api.test.ts
npx tsc --noEmit -p apps/web/tsconfig.json
```

Critérios: os três casos de integração PASS (não skipped); os testes pré-existentes continuam PASS; typecheck limpo.

**Validação de ponta a ponta:** com a chave de pipeline, criar um item real via API e confirmar 201:

```bash
curl -s -X POST http://localhost:3000/api/pipeline/research -H "X-Pipeline-Key: $PIPELINE_COWORK_KEY" -H 'Content-Type: application/json' -d '{"title":"Validacao WP-F","topic_slug":"validacao","content_md":"teste","theme_id":"dev"}' -w '\n%{http_code}\n'
```

Esperado: `201`. Este é o critério que destrava a ingestão do curso.

- [ ] **Passo 6: commit**

```bash
git add apps/web/src/lib/pipeline/services/research.ts apps/web/test/integration/pipeline/research-create.integration.test.ts
git commit -m "fix(research): criar pesquisa por API voltou a funcionar

A migration de 04/06 trocou a constraint UNIQUE e os valores de status, e
tornou theme_id NOT NULL. So a UI foi migrada — o servico REST/MCP seguiu
mandando onConflict numa constraint removida (42P10 sempre) e status 'new'.
O teste antigo mockava o Supabase inteiro e nunca tocou o banco; o novo e de
integracao contra Postgres real, que e o unico que pega esta classe."
```

---

## WP-G — A/B Lab

Fecha F17, F18, F19.

**Files:**
- Modify: `apps/web/src/lib/youtube/ab-evaluate-phases.ts` (linhas 109-127, 321-322)
- Modify: `apps/web/src/lib/youtube/ab-apply.ts` (guarda de aplicação automática)
- Modify: `apps/web/test/youtube/ab-evaluate-phases.test.ts`
- Modify: `apps/web/test/youtube/ab-gates.test.ts`

**Atenção — colisão com WP-E:** ver a nota em WP-E. Regiões disjuntas do mesmo arquivo; coordene o commit.

**Contexto verificado:** `ab-youtube.ts:81-82` grava `impressions: Number(row[1])` (que é *views*) e `ctr: 0` fixo; `ab-backfill` calcula `totalClicks = round(impressions × 0) = 0` sempre. O Bayesiano roda sobre `Beta(1, impressions+1)` sem sinal de clique — a variante com menos views tem distribuição mais larga e pode "vencer" por acaso.

- [ ] **Passo 1: escrever os testes falhando**

Em `apps/web/test/youtube/ab-evaluate-phases.test.ts`, adicionar dois casos usando os helpers `makeActiveTest`/`buildSupabaseMock` já existentes no arquivo: teste com 20 dias e menos de duas variantes com impressão **expira** com `completed_reason: 'inconclusive'` e `confidence_at_completion: null`; teste com 8 dias na mesma situação **não** expira.

Em `apps/web/test/youtube/ab-gates.test.ts`, adicionar: `computeGates` com `variantCount: 3` e `confirmedCycles: 14` reprova o gate `min_cycles` e o `value` diz `'14 / 21 cycles'`.

- [ ] **Passo 2: rodar e ver falhar**

```bash
cd apps/web && npx vitest run test/youtube/ab-evaluate-phases.test.ts test/youtube/ab-gates.test.ts
```

- [ ] **Passo 3: expirar teste sem impressões (F17)**

Em `ab-evaluate-phases.ts`, mover o cálculo de `startedAt`, `daysSinceStart` e `maxDurationDays` para **antes** do filtro `activeVariants`, e dentro do bloco `if (activeVariants.length < 2)` adicionar a expiração antes do `continue`: fechar os ciclos abertos (`update({ended_at})` onde `ended_at is null`), marcar o teste como `status: 'completed'`, `completed_reason: 'inconclusive'`, `confidence_at_completion: null`, e incrementar `resolved`. Remover as declarações duplicadas mais abaixo e trocar `config.max_duration_days ?? 14` na linha 322 por `maxDurationDays`.

Não chamar revert de thumbnail neste ramo: nenhuma variante chegou a rodar, não há o que reverter.

- [ ] **Passo 4: cron e UI concordarem (F18)**

Em `ab-evaluate-phases.ts`, importar `computeGates` de `@/lib/youtube/ab-gates` e **substituir o array de gates reimplementado à mão** (linhas 120-127) por uma chamada a `computeGates`, passando `variantCount: variants.length`. Remover a checagem redundante `&& newConsecutive >= stabilityThreshold` da linha 139 — ela é logicamente equivalente ao gate `stability` que `computeGates` já aplica.

Isso elimina a divergência na raiz: em vez de sincronizar duas constantes, passa a existir uma função só.

- [ ] **Passo 5: trocar o critério de vitória e desligar o auto-apply (F19)**

**Decisão do dono, 2026-09-03: Opção C — métrica substituta observável, com nome honesto.**

O critério de vitória deixa de ser confiança bayesiana sobre cliques (que são sempre zero, porque `ab-youtube.ts:82` grava `ctr: 0` fixo) e passa a ser **velocidade de views por variante** — o mesmo sinal que o ViewStats usa, e que já está no banco. O campo hoje chamado `impressions` já contém views (`ab-youtube.ts:81`, `Number(row[1])`), então o gate de mil deixa de ser mentira e passa a dizer o que mede.

Escopo desta troca: **somente o eixo `ctr`**, que vira `Tração inicial` (views nas primeiras 48h contra a mediana do canal). Os outros quatro eixos zerados **não precisam de proxy** — precisam do WP-K, que traz o dado real da Analytics API. Não invente proxy para retenção, crescimento, engajamento ou impacto em inscritos: esses quatro são obtíveis.

Três regras obrigatórias, sem as quais a troca repete o defeito que ela corrige:

1. Nomeie o eixo pelo que ele mede. A interface nunca mostra a palavra `CTR`.
2. Mostre o tamanho da amostra ao lado do eixo.
3. Abaixo de cinco vídeos **no canal em questão**, o eixo mostra `dados insuficientes` — não um número. A regra é por canal: `@bythiagofigueiredo` tem 0 vídeos e cai nesta condição; `@tnfigueiredotv` tem 35 e não cai.

Enquanto o WP-K não encher `youtube_video_analytics`, a série diária não existe e a Tração inicial também mostra `dados insuficientes`. Isso é correto e deve ficar visível — **este pacote depende do WP-K para produzir número**.

Além disso, adicionar em `ab-apply.ts` uma guarda no ponto de aplicação automática:

```ts
// CTR e impressoes nao existem em nenhuma API publica do YouTube. O campo
// 'impressions' aqui e views renomeado e 'ctr' e gravado como 0 fixo, entao
// a confianca bayesiana roda sobre ruido. Ate existir dado real (decisao do
// dono: aposentar o eixo, entrada manual do Studio, ou proxy renomeado), o
// vencedor e apenas sugerido — nunca aplicado sem confirmacao humana.
const AUTO_APPLY_ENABLED = process.env.AB_AUTO_APPLY_WINNER === 'true'
```

e, no caminho automático, quando `AUTO_APPLY_ENABLED` for falso: não aplicar, marcar o teste como `completed` com o vencedor **sugerido** registrado, e criar uma notificação para o dono revisar. A aplicação manual pela UI continua funcionando normalmente — só o caminho automático fica atrás da flag.

Documentar a variável nova em `CLAUDE.md`, seção "Remaining operational flags".

- [ ] **Passo 6: PORTÃO DE VALIDAÇÃO do WP-G**

```bash
cd apps/web && npx vitest run test/youtube/ab-evaluate-phases.test.ts test/youtube/ab-gates.test.ts test/youtube/ab-apply.test.ts
npx tsc --noEmit -p apps/web/tsconfig.json
grep -n "14" apps/web/src/lib/youtube/ab-evaluate-phases.ts | grep -i cycle
```

Critérios: testes PASS; typecheck limpo; o `grep` **não retorna** nenhum `14` associado a ciclos (a constante saiu junto com o array duplicado).

- [ ] **Passo 7: commit**

```bash
git add apps/web/src/lib/youtube/ab-evaluate-phases.ts apps/web/src/lib/youtube/ab-apply.ts apps/web/test/youtube/ab-evaluate-phases.test.ts apps/web/test/youtube/ab-gates.test.ts CLAUDE.md
git commit -m "fix(ab-lab): teste sem impressao expira, gates unificados, auto-apply atras de flag

Um teste com menos de duas variantes com impressao saia do loop antes da
checagem de max_duration e ficava ativo pra sempre. O cron reimplementava os
gates com 14 ciclos fixos enquanto a UI mostrava variantes*7. E o vencedor era
aplicado sozinho no canal a partir de confianca calculada sobre clicks que sao
sempre zero, porque ab-youtube grava ctr: 0 fixo e impressions e views."
```

---

## WP-I — Segurança

Fecha F20 e F21.

**Files:**
- Modify: `apps/web/src/lib/pipeline/mcp/safety.ts:27-36`
- Create: nova migration via `npm run db:new pipeline_history_key_identity`
- Modify: `apps/web/src/lib/pipeline/services/types.ts` (campo `keyId`)

- [ ] **Passo 1: verificar as três migrations em produção (F21)**

Rodar no SQL Editor do Supabase de produção, **read-only**:

```sql
select version, name
from supabase_migrations.schema_migrations
where version in ('20260703000001', '20260703000002', '20260703000003')
order by version;
```

E, para confirmar o efeito da mais crítica:

```sql
select p.proname, p.proconfig
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'update_pipeline_step','get_top_posts_analytics','get_top_links_analytics',
    'get_top_referrers','get_utm_campaigns','get_audience_countries',
    'get_audience_devices','get_audience_sources','rotate_cycle'
  );
```

`proconfig` deve conter `{search_path=public}` em cada linha. `NULL` significa não aplicada.

**Se as três já estiverem aplicadas, pule o passo 2 e registre isso.** Se não estiverem, aplicar com `npm run db:push:prod` (pede `YES` de confirmação). As três são idempotentes — `ALTER FUNCTION ... SET` e `CREATE OR REPLACE`, sem `DROP TABLE` nem backfill destrutivo. Rodar duas vezes é seguro.

- [ ] **Passo 2: separar o segredo do HMAC (F20)**

Em `apps/web/src/lib/pipeline/mcp/safety.ts`, trocar a constante:

```ts
const HMAC_SECRET_ENV = 'PIPELINE_MCP_HMAC_SECRET'
```

O resto do arquivo (`canonicalize`, `generateConfirmationToken`, `validateConfirmationToken`) fica inalterado.

**Ordem obrigatória de rollout:** (1) gerar o segredo com `openssl rand -hex 32` e setar `PIPELINE_MCP_HMAC_SECRET` no `.env.local` **e** na Vercel; (2) só então fazer deploy do código. Invertido, `getHmacSecret()` lança e derruba as tools MCP.

Não é preciso aceitar dois segredos em paralelo: o TTL do token é 5 minutos (`safety.ts:29`) e o fluxo dry-run→confirmação leva segundos. A janela de tokens em voo é desprezível, e um token expirado só força repetir o dry-run — não é falha de segurança.

Documentar a variável em `CLAUDE.md`, seção de Environment Variables.

- [ ] **Passo 3: rastro de identidade nas escritas por chave**

`content_pipeline_history.changed_by` é FK estrita a `auth.users(id)` e fica nulo em toda escrita por API key. Criar a coluna:

```bash
npm run db:new pipeline_history_key_identity
```

Conteúdo da migration:

```sql
-- Escritas via pipeline_api_keys (Cowork/MCP) sempre gravam changed_by = NULL,
-- porque changed_by e FK para auth.users e a chave nao tem sessao de usuario.
-- Resultado: chave vazada nao deixa rastro reconstruivel.
-- Aditivo e nullable — sem backfill (identidade das linhas antigas e irrecuperavel).

alter table public.content_pipeline_history
  add column if not exists changed_by_key_id uuid
    references public.pipeline_api_keys(id) on delete set null;

comment on column public.content_pipeline_history.changed_by_key_id is
  'pipeline_api_keys.id da chave que fez esta escrita, quando source = api_key. NULL para escrita por sessao ou linha antiga.';
```

Adicionar `keyId?: string` ao `ServiceContext` em `services/types.ts`, expor `keyRow.id` no retorno de `authenticatePipeline` e `resolveMcpAuth`, e popular `changed_by_key_id: ctx.source === 'api_key' ? ctx.keyId ?? null : null` nos inserts de histórico.

- [ ] **Passo 4: PORTÃO DE VALIDAÇÃO do WP-I**

```bash
npx tsc --noEmit -p apps/web/tsconfig.json
cd apps/web && npx vitest run test/lib/pipeline/mcp/safety.test.ts
```

Mais, manualmente: colar a saída real das duas queries SQL do passo 1, mostrando se as migrations estão em produção. **Esse resultado é o entregável do pacote** — vale mais que o código.

- [ ] **Passo 5: commit**

```bash
git add apps/web/src/lib/pipeline/mcp/safety.ts apps/web/src/lib/pipeline/services/types.ts supabase/migrations/ CLAUDE.md
git commit -m "fix(security): separar segredo do HMAC da chave de autenticacao

Os confirmation tokens que protegem acoes destrutivas eram assinados com
PIPELINE_COWORK_KEY — a mesma chave que viaja em todo request. Quem tinha a
chave forjava os proprios tokens, entao o gate de dry-run nao era barreira
contra chave vazada. Tambem grava a identidade da chave no historico."
```

---

## WP-B — Registrar as rotas órfãs (dono único do `vercel.json`)

**Roda depois que a onda 1 commitar.** Fecha F2.

**Files:**
- Modify: `apps/web/vercel.json` (única escrita neste arquivo em todo o plano)
- Modify: as 10 rotas órfãs, para adicionar `export const GET = POST`

- [ ] **Passo 1: `git pull --rebase`** — outro terminal pode ter mexido.

- [ ] **Passo 2: adicionar o alias GET nas 10 órfãs**

Mesma linha do WP-A (`export const GET = POST`) em: `ad-events-aggregate`, `adsense-sync`, `aggregate-content-metrics`, `media-cleanup`, `notification-cleanup`, `notification-deliver`, `notification-unsnooze`, `pipeline-deadline-digest`, `purge-content-events`, `snapshot-cleanup`.

- [ ] **Passo 3: registrar no `vercel.json`**

Adicionar ao array `crons`, mais a rota criada por WP-E:

```json
{ "path": "/api/cron/notification-deliver",        "schedule": "*/5 * * * *" },
{ "path": "/api/cron/notification-unsnooze",       "schedule": "*/15 * * * *" },
{ "path": "/api/cron/notification-cleanup",        "schedule": "0 3 * * *" },
{ "path": "/api/cron/media-cleanup",               "schedule": "0 4 * * *" },
{ "path": "/api/cron/aggregate-content-metrics",   "schedule": "0 5 * * *" },
{ "path": "/api/cron/purge-content-events",        "schedule": "0 5 * * 0" },
{ "path": "/api/cron/snapshot-cleanup",            "schedule": "0 4 * * *" },
{ "path": "/api/cron/pipeline-deadline-digest",    "schedule": "0 7 * * *" },
{ "path": "/api/cron/ad-events-aggregate",         "schedule": "0 6 * * *" },
{ "path": "/api/cron/adsense-sync",                "schedule": "0 6 * * *" },
{ "path": "/api/cron/youtube-intelligence-watchdog","schedule": "*/30 * * * *" }
```

**Atenção ao teto:** havia 39 entradas; passa a 50. Um plano da equipe já sinalizou que a contagem de crons é limitada por tier. Se o deploy da Vercel recusar por limite, **pare e reporte** — a saída é consolidar rotas de baixa frequência, não remover a instrumentação.

`ad-events-aggregate` e `adsense-sync` continuam protegidos pelas flags `AD_TRACKING_ENABLED` e `AD_REVENUE_SYNC_ENABLED`, que devolvem 204 se não estiverem `'true'`. Registrá-los é seguro.

- [ ] **Passo 4: PORTÃO DE VALIDAÇÃO do WP-B**

```bash
cd apps/web && npx vitest run test/api/cron/vercel-get-export-guard.test.ts
node -e "JSON.parse(require('fs').readFileSync('apps/web/vercel.json','utf8')); console.log('json valido')"
npx tsc --noEmit -p apps/web/tsconfig.json
```

Critérios: o teste-guarda do WP-A passa nas 50 entradas; JSON válido; typecheck limpo.

- [ ] **Passo 5: commit** — `git add apps/web/vercel.json` mais os 10 caminhos de rota, explicitamente.

---

## WP-H — Endpoint de saúde e watchdog na forja

**Roda depois de WP-B.** Fecha o buraco que permitiu tudo isso acontecer em silêncio.

**Files:**
- Create: `apps/web/src/app/api/health/route.ts`
- Modify: `apps/web/src/lib/logger.ts` (instrumentar `withCronLock`)
- Create: `apps/web/test/api/health.test.ts`
- Create (na máquina caseira, não no repo): `/opt/cron-watchdog/check.sh`, `cron-watchdog.service`, `cron-watchdog.timer`

**Contexto verificado:** `cron_health` tem `cron_name` (PK), `last_success_at`, `last_failure_at`, `last_error`, `consecutive_failures`, `severity`, `updated_at`. Não existe a view `v_cron_health`. Só 7 das 44 rotas gravam saúde; 31 passam por `withCronLock` (em `lib/logger.ts`) sem gravar; 8 não passam por nada.

- [ ] **Passo 1: escrever o teste da rota**

Criar `apps/web/test/api/health.test.ts` no molde de `apps/web/test/api/health/seo.test.ts` (instancia `Request` nativo, chama o handler exportado). Quatro casos: 401 sem auth; `ok` quando o cron rodou dentro do prazo; `degraded` com o nome do cron quando atrasado; **`unknown` (não `ok`) quando um cron agendado não tem linha nenhuma** — distinguir os dois importa, porque `ok` mascararia um cron que nunca rodou.

- [ ] **Passo 2: rodar e ver falhar** (`Cannot find module`).

- [ ] **Passo 3: criar a rota**

Criar `apps/web/src/app/api/health/route.ts` com: auth `Bearer CRON_SECRET` via `timingSafeEqual`; import **estático** do `vercel.json` (`import vercelConfig from '../../../../vercel.json'` — `resolveJsonModule` já está ligado e há precedente em `src/locales/dictionary.ts`; `fs.readFileSync` é arriscado porque o file-tracing da Vercel pode não empacotar o arquivo); parser de expressão cron que resolve a última execução esperada; grace de metade do intervalo com piso de 15 minutos; status agregado `ok`/`degraded`/`down`, com 503 no `down`.

Agrupar por rota base ignorando querystring. **Registrar como comentário no código** o caveat conhecido: `sync-youtube` tem 5 schedules mas grava só 2 chaves em `cron_health`, então o agrupamento comprime os modos e usa o schedule mais frequente. A correção de fundo (gravar `sync-youtube-${mode}`) fica fora deste pacote.

- [ ] **Passo 4: instrumentar os 31 crons de uma vez**

Em `apps/web/src/lib/logger.ts`, dentro de `withCronLock`: importar `recordCronSuccess`/`recordCronFailure` de `./cron-health` e, no `try`, gravar sucesso ou falha conforme o `result.status`; no `catch`, gravar falha antes do `Sentry.captureException`. Isso cobre 31 rotas com uma edição. As 2 que já chamam manualmente passam a gravar duas vezes — o upsert é idempotente, é inofensivo.

As 8 rotas sem `withCronLock` (`expire-notifications`, `optimization-monitor`, `pipeline-deadline-digest`, `send-welcome-emails`, `snapshot-cleanup`, `sync-analytics-metrics`, `weekly-grade-snapshot`, `youtube-intelligence-dispatch`) precisam da chamada manual — leia o corpo de cada uma antes de editar, os shapes de retorno diferem.

- [ ] **Passo 5: o watchdog na máquina caseira**

Criar `/opt/cron-watchdog/check.sh` (usuário próprio `cron-watchdog`, segredo em arquivo `chmod 600`), que faz `curl` no endpoint, lê o `status` com `jq`, e dispara ntfy quando não for `ok` — e também quando o endpoint não responder, que é o caso que mais importa. Mais `cron-watchdog.service` (`Type=oneshot`) e `cron-watchdog.timer` (`OnUnitActiveSec=10min`, `Persistent=true`).

Só saída HTTPS na 443. **Nenhuma porta nova** — as portas 22, 443, 1883, 1884, 3003, 5000, 8080, 8081, 8082, 8090, 8443, 8444, 8445, 8554, 8555, 8971 e 41543 já estão ocupadas na forja e nada aqui precisa escutar.

- [ ] **Passo 6: PORTÃO DE VALIDAÇÃO do WP-H**

```bash
cd apps/web && npx vitest run test/api/health.test.ts
npx tsc --noEmit -p apps/web/tsconfig.json
```

E, contra o deploy real (a prova que importa):

```bash
# [NO MAC]
curl -s -H "Authorization: Bearer $CRON_SECRET" https://bythiagofigueiredo.com/api/health | jq '.status, (.crons | length)'
# [NA FORJA] — depois de instalar o timer
systemctl start cron-watchdog.service && journalctl -u cron-watchdog -n 20 --no-pager
```

Critérios: a rota responde com `status` e a lista de crons; o timer roda sem erro; e — o teste que realmente importa — **desligar temporariamente um cron e confirmar que chega notificação no celular**. Um dead-man switch que nunca disparou não está validado.

---

## WP-J — Regenerar os tipos do banco

**Isolado, no fim, um agente só.** Não bloqueante.

- [ ] **Passo 1:** `npm run db:start && npm run db:types`
- [ ] **Passo 2:** `npx tsc --noEmit -p apps/web/tsconfig.json`
- [ ] **Passo 3:** revisar o diff. Esperado: adição das funções `purge_used_dsar_tokens` e `cron_purge_used_dsar_tokens` na seção `Functions`. Se aparecer mudança em tabela, **pare e reporte** — significa que há migration não aplicada no local.
- [ ] **Passo 4:** commit de `apps/web/src/types/database.types.ts` sozinho.

Foi deixado por último de propósito: é um arquivo de 10.304 linhas que qualquer agente tocando em paralelo transformaria em conflito garantido.

---

## Portão final de validação

Depois de todos os pacotes:

- [ ] `npx tsc --noEmit` limpo em `apps/web` e `apps/api`
- [ ] Rodar os testes de todos os pacotes numa tacada:

```bash
cd apps/web && npx vitest run test/api/cron/vercel-get-export-guard.test.ts test/lib/notifications/deliver.test.ts test/lib/supabase/one-embed.test.ts test/youtube/snapshot-delta.test.ts test/youtube/coaching-actions.test.ts test/cron/youtube-intelligence-watchdog.test.ts test/youtube/ab-evaluate-phases.test.ts test/youtube/ab-gates.test.ts test/api/health.test.ts
```

- [ ] `npm run db:start && HAS_LOCAL_DB=1 npx vitest run apps/web/test/integration/pipeline/research-create.integration.test.ts`
- [ ] Push para `staging` e confirmar CI verde
- [ ] Confirmar o deploy da Vercel e, 24h depois, checar `GET /api/health` — os crons ressuscitados devem ter registrado sucesso
- [ ] Reconciliar `docs/roadmap/README.md` e `CLAUDE.md`, que estão três meses atrás do código (o roadmap diz que o Social Hub não começou; ele tem 140 arquivos e 185 commits em produção)

## Fora deste plano

Registrado aqui para não se perder, cada um vira spec própria:

- **Ingestão do curso de YouTube.** Destino: transcrições e aulas na Research Library (tem busca full-text em português, aceita 500k chars por item, lotes de até 50); só uma síntese curta dos princípios em `reference_content`, que é injetado inteiro em todo prompt. Depende de WP-F.
- **A terceira categoria no guardrail.** `prompt-builders.ts:43` proíbe benchmark externo. Falta "doutrina citável com procedência". Cuidado: o bloco de guardrails é compartilhado com os prompts vivos do A/B Lab.
- **O worker na forja** que drena a fila de inteligência. Timer systemd, HTTPS de saída, nenhuma porta nova. Restrição real do contrato: a task só aceita **um** PATCH antes de sair de `running`, então a revisão vem antes do envio, não depois.
- **A decisão sobre CTR** (aposentar / entrada manual / proxy renomeado). Até lá, WP-G deixa o auto-apply atrás de flag.
- **Auditoria de deletes em research, context e playlists**, que hoje não gravam histórico nenhum.
- **`sync-youtube` gravando `cron_health` por modo**, não só duas chaves para cinco schedules.
