# bythiagofigueiredo

Hub pessoal + CMS Engine do ecossistema `@tnf/*`.

> Este arquivo carrega em toda sessão e em todo subagente. Mantenha **≤200 linhas**: regra e ponteiro
> aqui, detalhe e histórico em `docs/`.

## REGRA: gates rápidos no commit, build/teste pesado no Vercel + CI

Decisão (2026-06-06): o pre-commit **NÃO** roda `next build` nem os suites de teste.

| Gate | Quando | O que roda | Custo |
|------|--------|-----------|-------|
| **pre-commit** | todo commit | `build:packages` + typecheck web + typecheck api (+ auto-seed) | ~40-60s |
| **pre-push** | todo push | ecosystem validation + pinning + typecheck web/api | ~60s |
| **Vercel** | todo deploy | `next build` (paridade real de build) | nuvem |
| **CI** (`ci.yml`) | push staging | typecheck + testes + audit | nuvem |

- Mexeu em `packages/*/src/`: `npm run build:packages` IMEDIATAMENTE (recompila o `dist/` que `apps/web`/`apps/api` consomem). Não commitar sem isso.
- Mudança arriscada: rode `next build` e/ou os testes manualmente antes; não é obrigatório.
- Commit → push (staging→main). Só rebuilde local (`npm run build:web`) se o Vercel realmente falhar.
- NÃO re-adicionar `next build`/suites ao pre-commit "por segurança". `--no-verify` em código: evitar.
- Categorias de pacote, gates automáticos e árvore de decisão: `docs/ops/workspace-package-builds.md`.

## Pausa com cache quente (decisão de 2026-10-09)

O cache da sessão principal dura 1 h depois do último passo; reescrever custa 40× reler. Quando o
turno termina **esperando o dono** e a sessão é grande (acima de ~150K tokens) ou há agentes rodando:

1. Arme **um** timer em background: `bash ~/.claude/hooks/pausa-timer.sh 1`. Ele segura o Mac acordado,
   espera 45 min desde a última atividade da sessão (enquanto o dono trabalha, só se estende) e, se o
   cache já esfriou, fica calado em vez de acordar o modelo. Não arme outro enquanto esse estiver vivo.
2. Quando ele sair, a saída diz o que fazer. Responda com **uma linha** (`ping n/10`), cheque agentes
   só se houver, e rearme com o `n` indicado (`n=1` se o dono falou desde o último ping). Nada de reler
   arquivo nem resumir estado: cada ping relê a sessão inteira.
3. Saída `ÚLTIMO` (10 pings na tomada, 4 na bateria): escreva o handoff em
   `~/Workspace/handoff/<projeto>/AAAA-MM-DD-HHMM-<tema>.md`, **não rearme** e encerre. O handoff traz
   estado, próximo passo, arquivos a ler (aponta para planos e ledgers, não duplica) e, no topo, o
   prompt de retomada para colar num terminal novo.
4. **Sem pings** em "vacas magras" ou se o `/usage` não mostrar `1h TTL` (em excedente o TTL cai para
   5 min e cada ping vira reescrita): handoff direto.

Diário das decisões do timer (energia, tampa, saltos do relógio): `~/Workspace/handoff/.pausa.log`.

## Economia de tokens (vale para a sessão principal E para subagentes)

Medido em 2026-10-09 sobre 30 dias (`python3 ~/.claude/hooks/claude-custo.py 30`): 74% do custo foi
subagente, 93% foi Opus, e a maior reescrita evitável foi **subagente parado mais de 5 min** (260×).

- **Subagente nunca fica parado mais de 4 min** num comando ou espera: o cache dele dura 5 min e a
  volta reescreve a janela inteira. Comando longo vai em background com saída em arquivo; se a espera
  for inevitável (CI, deploy), devolva o controle à sessão principal em vez de esperar.
- **Modelo e effort explícitos em todo despacho:** Sonnet executa, Opus só planeja e faz a revisão
  final de um lote; effort `high` no começo, `medium` quando as revisões voltam limpas; nunca `xhigh`/`max`.
- **Relatório de subagente em até 10 linhas;** o detalhe vai para um arquivo. Brief também em arquivo.
- **Nunca mandar "só mais uma coisa" a um agente que terminou** (recarrega o histórico dele em cache
  frio): abra um agente novo com o brief.
- **Não trocar de modelo nem ligar `/fast` no meio da sessão** (joga o cache fora); só logo após `/clear`.
- **Fase nova = sessão nova:** plano e estado em arquivo, `/clear`, e a sessão seguinte lê só o arquivo.
- **Buscar antes de ler** (grep → ler só o trecho). Suíte de testes e build: saída para arquivo, e no
  contexto entram só as falhas. Readiness: um único comando limitado, nunca polling por tool call.
- Diff pequeno a sessão principal confere direto; sem ondas de revisores nem fan-out especulativo.

## Tech Stack

| Camada | Stack |
|--------|-------|
| Web | Next.js 16 + React 19 + Tailwind 4 + TypeScript 5 |
| API | Fastify 5 + TypeScript 5 + Zod |
| DB | Supabase (PostgreSQL 17 + Auth + Storage) |
| Monorepo | npm workspaces · Tests: Vitest · Error tracking: Sentry |

## Database — Supabase CLI

**Single project (prod):** `novkqtvcnsiwhkxihurk` em org `ByThiagoFigueiredo` (São Paulo).
Scripts: `db:link:prod`, `db:push:prod` (confirmação YES), `db:which`, `db:start`, `db:stop`, `db:reset`, `db:status`, `db:env`.

- **Nova migration: `npm run db:new <nome_descritivo>`** → editar em `supabase/migrations/` → `npm run db:push:prod`.
  NUNCA criar o arquivo à mão nem usar `npx supabase migration new`: o script garante timestamp
  posterior à última migration (evita "out of order" e `--include-all`).
- **Idempotência:** sempre `drop policy if exists` antes de `create policy`, `drop trigger if exists` antes de `create trigger`.
- DB password em keychain/1Password (Supabase Dashboard → Project Settings → Database).

## Testes

- Com DB local: gated em `process.env.HAS_LOCAL_DB` (`npm run db:start && HAS_LOCAL_DB=1 npm test`); sem DB é o default da CI.
  Convenção: `describe.skipIf(skipIfNoLocalDb())(...)`. Helpers: `apps/{api,web}/test/helpers/db-skip.ts`, `apps/web/test/helpers/db-seed.ts`. Integração em `apps/web/test/integration/`.
- Suíte completa (`npx vitest run`) leva ~160s e **não trava**: antes de um push grande, rode inteira.

### Regras anti-regressão (histórico de cada uma: `docs/ops/regras-anti-regressao-testes.md`)

- **Bump de dependência:** rodar os testes dos consumidores diretos ANTES do push (`grep -rl <pacote> apps/{web,api}/src apps/web/lib packages/*/src`).
- **Sanitizers nunca sob happy-dom:** server-side → `// @vitest-environment node`; componente client → `// @vitest-environment jsdom`.
- **Fixtures temporais sempre relativas ou com fake timers:** nunca hardcodar ano/trimestre futuro.
- **Fix que exige mudança em teste vai no MESMO commit do bump.**
- **Next 16:** nunca passar `next/link` (ou componente importado num Server Component) como prop para client component; envolva num módulo `'use client'` (`src/app/cms/(authed)/_shared/cms-link.tsx`).
- **Upgrade de framework/pacote que toca o CMS exige validação AUTENTICADA antes da promoção:** `docs/ops/runbook-cms-e2e-local.md`.
- **Env com fallback:** escreva um teste que **apaga** a variável (`delete process.env.X`) e afirma sobre o valor padrão; idem para "invocação sem a flag". Um default que todo teste sobrescreve nunca roda.

## RLS e RBAC

- Helpers em `public`: `user_role()`, `is_staff()`, `is_admin()`, `site_visible(uuid)`. Policies de leitura pública DEVEM usar `public.site_visible(site_id)`, nunca inline.
- GUC `app.site_id`: middleware seta por request. Vazio = sem filtro (admin). Inválido = fail closed.
- **RBAC v3:** `super_admin`, `org_admin`, `editor`, `reporter` (read/edit own only, no publish).
- Helpers SECURITY DEFINER: `is_super_admin()`, `is_org_admin(uuid)`, `can_view_site(uuid)`, `can_edit_site(uuid)`, `can_publish_site(uuid)`, `can_admin_site_users(uuid)`, `is_member_staff()`.
- **Publish guard:** trigger `enforce_publish_permission`. **Audit log:** `audit_log` + `set_audit_context(ip, ua)`.
- **Site resolution:** middleware resolve `Host → site` (`SupabaseRingContext.getSiteByDomain()`), seta `x-site-id`, `x-org-id`, `x-default-locale`; server components leem via `getSiteContext()`.
- **Server actions:** write actions DEVEM chamar `requireSiteAdmin(postId)` no topo. `getSupabaseServiceClient()` bypassa RLS.

## @tn-figueiredo/cms package

Workspace em `packages/cms/`, consumido via `"@tn-figueiredo/cms": "*"` + `transpilePackages: ['@tn-figueiredo/cms', '@tn-figueiredo/newsletter', '@tn-figueiredo/newsletter-admin']`.
MDX: `compile()` on save → `content_compiled` → `run()` at render (fallback: compile em runtime se nulo).
Após mudança em `packages/cms/src/*`: `npm run build -w packages/cms`.

## Feature modules (completed — read code for details)

| Sprint | Module | Key paths |
|--------|--------|-----------|
| 5a | LGPD compliance | `lib/lgpd/`, `app/api/cron/lgpd-*`, `app/account/`, `content/legal/` |
| 5b | SEO hardening | `lib/seo/`, `app/sitemap.ts`, `app/robots.ts`, `app/og/` |
| 5e | Newsletter CMS | `lib/newsletter/`, `app/cms/newsletters/`, `app/api/webhooks/ses` |
| 5f | Links Engine | `lib/links/`, `app/cms/links/`, `app/go/`, `packages/links*/` |
| 5g | Media System | `lib/media/`, `app/cms/media/` |

- **LGPD:** deleção em 3 fases (phase1 instant+ban → phase2 no-op → phase3 D+15 hard delete). Cookie banner só em `app/(public)/layout.tsx`. 6 adapters em `lib/lgpd/container.ts`. Sentry errors = legítimo interesse; Replay/Tracing exigem consentimento.
- **SEO:** `app/sitemap.ts` + `app/robots.ts` fazem host lookup direto (não dependem do middleware — Next.js #58436). JSON-LD `@graph` via `schema-dts`. OG image: seo_extras → cover_image → dynamic OG → site default → `/og-default.png`.
- **Newsletter:** AWS SES-only desde 2026-04-30. CAS nas transições de status. RFC 8058 one-click unsubscribe. Tracking: SES config set `bythiago-marketing` → SNS → `app/api/webhooks/ses` (assinatura por certificado). Templates em `src/emails/`.
- **Links:** `go.{domain}` via rewrite do middleware para `/go/${code}`. Visitor ID diário `SHA-256(ip|ua|date)`. `link_clicks` particionada.
- **Media:** Vercel Blob. SHA-256 dedup. EXIF strip (LGPD). Órfão: 7 dias de carência → hard delete em 30. SVG via DOMPurify. `<MediaGalleryDialog>` é o picker reutilizável.

## A forja — fila de inteligência do YouTube (em produção desde 2026-09-22)

Máquina Ubuntu na casa do dono (`ssh forja`, usuário `thiago`) drena a cada 10 min, por cron, a fila
`youtube_intelligence_tasks`: claim → snapshot → Gemma 12B local → validador →
`PATCH /api/pipeline/youtube/intelligence` → Health Coach. É o único consumidor da fila.

- **Runbook (caminhos, segredo, log, vigilância, desligar/religar, trocar chave):** `docs/ops/forja-fila-inteligencia-runbook.md`. Ledger: `.superpowers/sdd/2026-09-19-forja-fila-inteligencia-plan/progress.md`.
- **O kit é `~/Workspace/forja/ferramentas` — git LOCAL, sem remoto;** a cópia na forja está atrás (§2 do runbook). Toda mudança no kit termina em `git commit -- <caminhos>`.
- **Escrita na forja é do dono, sem exceção.** Nenhum agente roda `ssh forja '<escreve>'`, `scp`, `crontab -`, `install`, `mv` ou `systemctl` lá. O agente **prepara** os comandos — curtos, **um por linha** — e o dono cola. Leitura por `ssh forja '<leitura>'` é permitida e esperada.
- **Este sistema falha em VERDE:** dado ausente (`series.json`, `recent_window` nula, fallback para template) produz `desfecho: ok` com saída vazia. Pergunte sempre *"o que acontece quando o dado não existe?"* antes de *"quando dá erro?"*.
- **Orçamento acoplado:** 20 min do claim < `timeout -k 30s 25m` do cron < `STALE_THRESHOLD_MINUTES` (30 min) do watchdog; o pulso corta em 70 min. Mexer em um exige refazer a conta dos outros.
- Escopo da fase 2a: **só views e séries** — sem CTR, sem retenção, sem recomendação por vídeo.

## Pipeline Integrity

Ao criar/deletar routes em `apps/web/src/app/api/pipeline/`:
1. Atualizar `apps/web/src/lib/pipeline/api-registry.ts` — add/remove endpoint entry **e** ajustar `endpoint_count` do domain
2. Atualizar `apps/web/data/pipeline-docs/cowork-docs-{domain}.md` com documentação do endpoint
3. Se o JSON schema de uma section mudou, atualizar `docs/cowork-pipeline-reference.md`
4. Domain novo (raro): domain const + `DomainId` + `DOMAIN_LABELS` + `capabilities[]` + doc file — testes guiam o resto

Tests validam estrutura, NÃO conteúdo dos docs. Chave permanente: `PIPELINE_COWORK_KEY` em `.env.local`. **Nunca criar/revogar keys.**

## Variáveis de ambiente e flags

Lista completa, flags operacionais e o detalhe de cada variável: **`docs/ops/env-vars.md`**. Regras que não podem ser esquecidas:

- `PIPELINE_MCP_HMAC_SECRET`: setar a variável (`.env.local` e Vercel) **antes** do deploy do código; invertido, as tools MCP caem.
- `META_REQUEST_INSIGHTS_SCOPES`: desligado; um escopo indisponível BLOQUEIA o diálogo da Meta inteiro. Só ligar após App Review.
- `LGPD_CRON_SWEEP_ENABLED`: válvula de segurança de deleção irreversível.
- `AB_AUTO_APPLY_WINNER`: default off; vencedor de A/B é só sugerido, espera confirmação humana.
- Produção: `NEXT_PUBLIC_APP_URL=https://bythiagofigueiredo.com`, `NEXT_PUBLIC_API_URL=https://bythiagofigueiredo-api.vercel.app`.
- Instagram OAuth (ordem dos 8 commits, rollback de C2 com passo de banco obrigatório): `docs/ops/instagram-oauth-entrega-2026-09-06.md`.

## Roadmap

**Next:** Sprint 5h (Social Hub, ~78h) → Sprint 5d (Vercel deploy hardening) → Sprint 6 (MVP Launch, 30h). Source of truth: `docs/roadmap/README.md`.

## Code Standards

- **TypeScript:** `strict: true`, nunca `any`, Zod para validação
- **Arquivos:** kebab-case. **Classes:** PascalCase. **Interfaces:** `I` prefix. **DB columns:** snake_case.
- **Commits:** `tipo: descrição curta` — tipos: `feat`, `fix`, `chore`, `refactor`, `docs`, `ci`
- **Branches:** `staging` = dev, `main` = production. Feature: `feat/xxx`, `fix/xxx`, `chore/xxx`

## Ecosystem Packages (@tn-figueiredo/*)

Consumidos via `.npmrc` → `npm.pkg.github.com`. Versões exatas (sem `^`) — pre-commit valida; a versão vigente é a do `package.json` de cada app.

## CI

| Workflow | Trigger | Purpose |
|---|---|---|
| `ci.yml` | push/PR `staging` | typecheck, test, audit, secret-scan, ecosystem-pinning, seo-smoke |
| `lighthouse.yml` | PR on `apps/web/**` | LHCI: SEO ≥95 error, perf ≥80 warn |
| `seo-post-deploy.yml` | manual | `scripts/seo-smoke.sh` against prod |

Secrets: `NPM_TOKEN` (read:packages), `CRON_SECRET` (health checks), `LHCI_GITHUB_APP_TOKEN` (optional).

## O que NÃO fazer

- Não instalar deps sem validar
- Não commitar secrets (`.env.local`, `supabase/.temp/`)
- Não usar `any` no código
- Não criar files desnecessários (preferir editar existentes)
- Não fazer force-push em `main` ou `staging` sem autorização explícita
- Não chamar `getSupabaseServiceClient()` sem antes validar `canAdminSite(siteId)`
- Não importar server actions diretamente em client components — passe callbacks via props
- Não criar arquivos de migration manualmente — usar **`npm run db:new <nome>`**
