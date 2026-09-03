# Falhas Silenciosas — Design

**Data:** 2026-09-02
**Levantamento:** 26 agentes de leitura (14 de diagnóstico + 12 de detalhamento), mais 14 consultas diretas ao banco de produção.
**Relatório de origem:** https://claude.ai/code/artifact/9757a941-eb06-40df-b4ea-b5bd0fe91f5e

---

## Problema

O pedido original era ensinar doutrina de YouTube ao Cowork, porque o diagnóstico do canal dá conselho genérico. A investigação mostrou que doutrina não é o gargalo: existe embaixo dela uma camada de 21 defeitos que **não produzem erro, log nem sintoma visível**. Ensinar melhor um diagnóstico que lê dado de julho, descarta a própria resposta da IA e mede dois eixos impossíveis produziria apenas erro mais convicto.

O fio condutor é o silêncio. Nenhum dos defeitos abaixo aparece em lugar nenhum — nem em tela, nem em log, nem em alerta. O critério de prioridade que decorre disso, e que bate com o problema declarado pelo dono do repo ("não confio no feedback"): **melhoria que aumenta verificabilidade vale mais que melhoria que aumenta cobertura**.

## Escopo

Este design cobre os 21 defeitos verificados. Ele **não** cobre:

- A ingestão do curso de YouTube (depende de F11 estar corrigido; vira spec própria).
- O worker na máquina caseira que drena a fila de inteligência (vira spec própria, depois de F9/F19).
- A decisão sobre CTR (ver "Decisão pendente" abaixo) — o plano entrega o mecanismo, não a escolha.

---

## Os 21 defeitos

Cada linha foi verificada no código; as marcadas **[DB]** foram confirmadas por consulta direta ao banco de produção em 2026-09-02.

### Crons que nunca executaram

**F1 — 8 rotas de cron agendadas só exportam POST.** O cron da Vercel dispara GET; a rota devolve 405. Nunca rodaram uma vez sequer.
`lgpd-cleanup-sweep`, `publish-scheduled`, `purge-old-contact-submissions`, `purge-sent-emails`, `purge-webhook-events`, `social-auto-draft`, `social-metrics`, `social-publish` (esta última agendada `* * * * *` — 1440 falhas silenciosas por dia).
Verificado por script contra o repo: 39 entradas em `vercel.json`, 8 sem GET, 0 apontando para rota inexistente.

**F2 — 10 rotas de cron não estão agendadas em lugar nenhum.**
`ad-events-aggregate`, `adsense-sync`, `aggregate-content-metrics`, `media-cleanup`, `notification-cleanup`, `notification-deliver`, `notification-unsnooze`, `pipeline-deadline-digest`, `purge-content-events`, `snapshot-cleanup`. Todas POST-only também.

**F3 — O bug já foi corrigido uma vez e voltou.** `docs/superpowers/specs/2026-05-18-links-engine-a-plus-design.md:250-275` documenta exatamente este defeito nos crons de links e a correção. Quatro meses depois reapareceu em seis rotas novas. Um bug que volta é a falta de um teste, não um bug.

### Notificação

**F4 — O despachante marca como enviado sem enviar.** `apps/web/src/lib/notifications/cron/deliver.ts:19-25` tem `// TODO: resolve adapter by channel, call send()` no lugar do envio e faz `update({ status: 'sent' })` incondicional.

**F5 — O adaptador de push é stub permanente.** `apps/web/src/lib/notifications/adapters/push.ts:8-16` sempre retorna `{ success: false, error: 'web-push not installed' }`.

**F6 — O adaptador de e-mail aponta para Resend.** `adapters/email.ts` usa `ResendEmailAdapter` e `RESEND_API_KEY`; o projeto migrou para AWS SES em 2026-04-30. O caminho vivo é `apps/web/lib/email/service.ts` → `getEmailService()` → `createSesEmailService()`.

**F7 [DB] — A tabela `public.profiles` não existe.** Confirmado: `PGRST205 — Could not find the table 'public.profiles' in the schema cache`. Nenhuma migration a cria. Três arquivos dependem dela: `settings/notifications/page.tsx:32`, `api/webhooks/telegram/route.ts:59`, `lib/social/notifications/notify-story-ready.ts:32`. O canal Telegram nunca funcionou.

**F8 — A UI oferece os quatro canais como se funcionassem.** `settings/notifications/_components/preferences-client.tsx:39-61` mostra toggles sem nenhum gate.

### Observatório de competidores

**F9 [DB] — A tela roda sobre dados de 8 de julho.** `competitors/page.tsx:95-102` busca snapshots dos 14 canais numa query só, `.order('snapshot_date', ascending).limit(500)`. O banco tem 1293 linhas (2026-06-01 a 2026-09-02); a página vê as 500 mais antigas, ou seja até 2026-07-08. Sparkline, engajamento, outliers e "vs você" são todos calculados sobre uma janela de 56 dias atrás.

**F10 — Deltas de crescimento nulas nos 14 canais.** Consequência direta de F9: como todo snapshot visível tem mais de 7 dias, o `reduce` que procura o snapshot "de uma semana atrás" seleciona o próprio mais recente, as datas ficam iguais, a condição falha, e `viewGrowthDelta`/`subscriberGrowthDelta` voltam `null`. A sparkline continua desenhando porque só exige duas linhas.

**F11 [DB] — 200 mudanças descartadas por um cast mentiroso.** `competitors/page.tsx:381` faz `(c.competitor_videos as Array<{video_id:string}>)?.[0]?.video_id`. O supabase-js devolve relação *to-one* como objeto — confirmado na resposta real da API: `"competitor_videos": {"video_id": "bg0C-2iUUqM", ...}`. O `?.[0]` é `undefined`, o `continue` descarta tudo. O banco tem 200 mudanças, duas detectadas em 2026-09-02. A aba mostra zero. O mesmo defeito existe em `lib/pipeline/services/competitors.ts:234-235`.

### Loop de inteligência

**F12 — O coaching do Cowork é gravado e filtrado para fora.** `services/youtube.ts:377-411` grava com `video_id: null, source: 'cowork'`. `analytics/actions.ts:68-72` lê com `.not('video_id','is',null)` — exclui exatamente essa linha. Nem a UI nem o próprio Cowork releem.

**F13 — "Diagnóstico do Cowork" é texto fixo.** `yt-analytics-tabs.tsx:326-383`: seis parágrafos hardcoded em `COACHING_DIAGNOSTICS`, `benchmark: 5.0` cravado, `source: 'fallback'` sempre. O valor `'cowork'` do union não é produzido em nenhum lugar do código. O comentário na linha 326 é um TODO explícito de 2026.

**F14 — A máquina de estados do ciclo de otimização nunca é usada.** `optimization-loop.ts:64-140` implementa `transitionState()` corretamente e nada a chama. Existem 5 call-sites que escrevem `state` por update direto. Os estados `test_suggested` e `testing` não são escritos por nada, então `optimization-monitor` nunca encontra linha.

**F15 [DB] — Uma task de inteligência presa em `running` agora.** Confirmado: 1 `running`, 0 `pending`. Não existe varredura que libere task travada, e `idx_yt_intel_task_active` bloqueia o canal enquanto ela estiver lá. O status `stale` existe no CHECK e nunca é escrito.

**F16 — A fila não tem consumidor automático.** `youtube-intelligence-dispatch` enfileira toda segunda às 8h. Só o humano abrindo o Cowork processa. `expire-notifications` marca como `stale` após 7 dias.

### A/B Lab

**F17 — Teste sem impressões fica ativo para sempre.** `ab-evaluate-phases.ts:109-111`: se `activeVariants.length < 2`, o loop faz `continue` antes da checagem de `max_duration_days` na linha 322.

**F18 — A UI promete mais ciclos do que o cron exige.** `ab-gates.ts:46` calcula `variantCount * 7`; `ab-evaluate-phases.ts:124` usa `14` fixo. O cron não chama `computeGates` — reimplementa o array de gates à mão. É duplicação de lógica, não só de constante.

**F19 — O vencedor pode ser declarado a partir de ruído puro.** `ab-youtube.ts:81-82` grava `impressions: Number(row[1])` (que é *views*, não impressões) e `ctr: 0` fixo. `ab-backfill` calcula `totalClicks = round(impressions × ctr) = 0` sempre. `calculateBayesianConfidence` então roda sobre `Beta(1, impressions+1)` para todas as variantes, sem nenhum sinal de clique — a variante com menos views tem distribuição mais larga e pode "vencer" por acaso. O gate de 1000 impressões é atingível porque na prática são views. E o sistema **aplica a thumbnail vencedora no canal automaticamente**.

### Segurança

**F20 — A chave de autenticação é o segredo do HMAC de confirmação.** `mcp/safety.ts:27-36` assina os confirmation tokens de ações destrutivas com `PIPELINE_COWORK_KEY`, exatamente a chave enviada em `X-Pipeline-Key` em todo request. Quem tem a chave forja os próprios tokens. TTL do token: 5 minutos.

**F21 — Três migrations de segurança possivelmente não aplicadas em produção.** `20260703000001` (9 funções `SECURITY DEFINER` sem `search_path`), `20260703000002` (anonimização de PII em `password_reset_attempts`), `20260703000003` (purga de tokens DSAR). Foram para staging em 2026-07-03; o repo está parado desde então. Todas idempotentes.

### Bônus: Research

**F22 — Criar pesquisa por API está quebrado desde 2026-06-04.** `services/research.ts:295-342` faz `.upsert(..., { onConflict: 'site_id,topic_id,title' })`, mas a migration `20260604000003` removeu essa constraint (trocou por `site_id,theme_id,title`) → erro `42P10` sempre. Além disso manda `status: 'new'`, inválido no novo CHECK, e omite `theme_id`, agora `NOT NULL` sem default. A UI foi migrada; o serviço REST/MCP não. **Este é o bloqueador da ingestão do curso.**

---

## Medições que desarmaram riscos

Antes de desenhar a ordem de execução, medi as filas em produção. O resultado eliminou a preocupação mais séria do levantamento — a de que ligar crons mortos despejaria meses de trabalho represado:

| Fila | Contagem | Consequência |
|---|---|---|
| `blog_posts` com `status='scheduled'` vencido | **0** (13 no total) | `publish-scheduled` pode ser ligado direto |
| `campaigns` agendadas | **0** (0 no total) | idem |
| `social_posts` com `status='scheduled'` | **0** (8 no total) | `social-publish` pode ser ligado direto |
| `lgpd_requests` com purga vencida | **0** (0 no total) | `lgpd-cleanup-sweep` não tem nada a apagar |
| `media_assets` soft-deleted há 30d+ | **0** (33 no total) | `media-cleanup` não tem nada a apagar |
| `notification_deliveries` pendentes | **0** | sem risco de rajada de e-mail |
| `webhook_events` 30d+ / `content_events` 90d+ / `playlist_snapshots` vencidos | 2 / 365 / 15 | volumes triviais, sem risco de lock |

**Conclusão: não há triagem manual a fazer.** A fase de ressuscitar crons é mecânica e segura.

---

## Decisão pendente do dono

**CTR e impressões não são obtíveis por nenhuma API pública do YouTube** — só pela interface do Studio ou pela Content Owner Reporting API, restrita a parceiros. O código já sabe (`analytics-client.ts:169-171`) e há um commit `dedd378f` chamado *remove fabricated CTR heuristic*. Mas o sistema de score continua tratando os dois como medidos: `scoring.ts:140-146` lê `input.ctr` (campo que ninguém grava) e `input.impressions > 0 ? ... : 0`. **Dois dos seis eixos são zero permanente por construção.**

Três caminhos, e a escolha é do dono:

- **(A) Aposentar os dois eixos** e redistribuir o peso nos quatro com dado real. O score volta a significar algo; perde-se a ambição de medir thumbnail por CTR.
- **(B) Entrada manual do Studio.** `ab_test_cycles` já tem `impressions`, `clicks` e `ctr`; falta uma action e um marcador de origem (precedente no schema: `ab_tests.applied_by CHECK IN ('auto','manual')`). Devolve o A/B Lab ao jogo ao custo de trabalho manual recorrente.
- **(C) Trocar por um proxy honesto** derivável do que existe (views por hora nas primeiras 48h) e renomear o eixo para o que ele realmente mede — nunca para "CTR".

**Enquanto não houver decisão, o plano desliga a aplicação automática de vencedor** (F19). Um vencedor derivado de ruído aplicado sozinho no canal é pior que nenhum vencedor.

---

## Estratégia de validação

O dono pediu validação ao fim de cada tema, não a cada passo — *"muitas vezes é preciso terminar um tema pra revisar ele em sua completude e não ficar refazendo serviço"*. Cada pacote de trabalho termina num portão único de validação.

**Playwright não existe no repo.** Nem pacote, nem config, nem workflow — só `apps/web/test/e2e/youtube-mcp-e2e-plan.md`, um plano nunca implementado. Instalar e configurar do zero é 30-60 minutos que competem com as correções. O que existe e é forte: 1057 arquivos de teste em Vitest, integração com Postgres local gated por `HAS_LOCAL_DB`, e a CI já roda `test-db-integration` em container.

Decisão: **três níveis de validação, escolhidos por natureza da pergunta.** Playwright vira pacote próprio e opcional, não pré-requisito.

| Nível | Quando usar | Molde no repo |
|---|---|---|
| Unitário (Vitest) | "essa função/rota faz o que deveria" | `test/api/health/seo.test.ts` — instancia `Request` nativo e chama o handler exportado |
| Integração (Postgres local) | a lógica depende de estado real: constraint, RLS, trigger | `describe.skipIf(skipIfNoLocalDb())`, helpers em `test/helpers/db-seed.ts` |
| MCP DevTools | a pergunta é genuinamente "essa tela mostra o dado certo" | navegação real, console e network; exige login manual uma vez por sessão, porque `/cms` é protegido por middleware |

Regra: não usar E2E onde teste unitário resolve; não usar integração onde a função é pura.

---

## Concorrência

Os pacotes serão executados por sub-agentes em paralelo. A análise de colisão encontrou **um único ponto quente: `apps/web/vercel.json`**.

Achado que o resolve: o pacote que adiciona `export const GET = POST` às 8 rotas **não precisa tocar o `vercel.json`** — essas rotas já estão listadas, só falta o verbo. Logo, apenas o pacote das 10 rotas órfãs escreve nesse arquivo, e o hot spot desaparece com um dono único.

Nenhum pacote importa símbolo criado por outro, então não há dependência de compilação entre eles. As duas dependências reais são de ordem, não de código:

```
WP-A (verbo GET nas 8 agendadas)   ─┐
WP-B (10 órfãs + vercel.json)      ─┴─> WP-H (health endpoint) lê a lista estabilizada
WP-F (research API)                ────> ingestão do curso (spec futura)
```

Restrições operacionais, tiradas do CLAUDE.md e do histórico do repo:

- Trabalhar direto em `staging`, sem feature branch — há vários terminais rodando em paralelo.
- `git add` **por caminho explícito**, nunca `-A` ou `.`, para não capturar trabalho de outro terminal.
- Serializar o passo de `git commit` (não o trabalho): o pre-commit roda `build:packages` + `tsc --noEmit` no monorepo inteiro, ~40-60s, e dois commits simultâneos veem erros de tipo transitórios do código incompleto do vizinho.
- Cuidado com dois arquivos homônimos: `lib/pipeline/services/research.ts` (o que quebrou) e `lib/pipeline/mcp/services/research.ts` (outro arquivo).

---

## Critérios de aceitação

O trabalho está pronto quando:

1. O teste-guarda de cron falha se alguém adicionar uma rota agendada sem `GET`. (fecha F1, F2, F3 permanentemente)
2. Uma notificação de teste chega de fato num canal real, ou o canal está desligado na UI com motivo visível. (F4-F8)
3. O Observatório mostra a data do snapshot mais recente do banco, e a aba Mudanças mostra as 200 que existem. (F9, F10, F11)
4. O Health Coach exibe o coaching do Cowork quando existe, e diz "diagnóstico heurístico" quando não existe. (F12, F13)
5. Uma task presa em `running` é liberada automaticamente. (F14, F15)
6. Um teste A/B sem impressões expira; a UI e o cron concordam nos ciclos exigidos; nenhum vencedor é aplicado automaticamente enquanto CTR não for real. (F17, F18, F19)
7. `GET /api/health` reporta cada cron agendado como `ok`/`degraded`/`unknown`, e um timer na máquina caseira alarma quando não for `ok`. (fecha o buraco de observabilidade que torna todo o resto possível de acontecer de novo)
8. As três migrations de 2026-07-03 estão confirmadas em produção. (F21)
9. Criar pesquisa via API funciona, com teste de integração contra Postgres real que teria pego o defeito. (F22)
10. O segredo do HMAC é independente da chave de autenticação. (F20)
