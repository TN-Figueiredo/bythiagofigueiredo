# Plano de custo zero — estabilizar produção sem subir tier

> **EXECUTADO 2026-09-05 21:36 — produção recuperada.**
> `sync-newsletter-pending` (órfão, 404) desagendado. `TRUNCATE net._http_response` venceu
> via job de `pg_cron` (o CLI perdia a corrida do lock): 271 MB → **32 kB**; banco 363 MB →
> **93 MB**. Produção: `/` 1,3s, `/robots.txt` 0,5s, `/blog` 0,5s — antes eram timeout/504/25s.
> Retenção diária adicionada e os 5 jobs versionados em migration.
>
> **Fase 1 completa às 23:xx, após a promoção de `main`** (merges `af330e61`, `2ebc2db0`):
> Vercel assumiu `publish-scheduled` (`*/5`) e `lgpd-cleanup-sweep` (`0 7`) — `cron_health`
> confirma execuções com 0 falhas; migration `20260905000002` desagendou os dois jobs HTTP e
> fez `DROP EXTENSION pg_net`; `20260905000003` removeu a função helper órfã (a 000002 errou a
> assinatura e o `if exists` engoliu). Estado final: `pg_cron` com 3 jobs — dois purges SQL
> diários e a retenção do próprio histórico. Banco: 93 MB.
> **Fase 2 parcial:** `vercel.json` 50 → 45 crons (`social-publish` `*/15`; removidos
> `social-auto-draft`, `social-metrics`, `links-check-expiry` e as duplicatas dos purges).
> **Aberto:** `links-check-expiry` continua quebrado no código (3 colunas inexistentes) — foi
> tirado do agendamento, não consertado; decisão de reviver ou apagar é do dono.

**Data:** 2026-09-05 · **Restrição:** orçamento zero. Nada de upgrade de Supabase.
**Base:** 9 agentes (4 adversariais + 5 de custo zero), tudo medido, nada presumido.

---

## O número que resume o problema

| Consumidor | % do `total_exec_time` do banco |
|---|---|
| `pg_cron` + `pg_net` (encanamento) | **97,9 %** |
| PostgREST — o site inteiro, visitantes, CMS | **0,2 %** |

O banco não está sobrecarregado pelo produto. Está sobrecarregado por infraestrutura que
não entrega nada.

**Sinal de inanição:** nas últimas 2h, `cron.job_run_details` tem **113 falhas × 20 sucessos
(85 %)**, todas `"job startup timeout"` — o `pg_cron` não consegue lançar o worker em 10s.

---

## A causa, corrigida três vezes por medição adversarial

A query de GC do `pg_net` aparece **duas vezes** no `pg_stat_statements`, mesma forma:

| variante | calls | média | % exec_time |
|---|---|---|---|
| rápida (desde 2026-05-09) | 332.718 | **4,2 ms** | 0,3 % |
| lenta (desde **2026-08-05 11:01**) | 103.026 | **3.507 ms** | **90,0 %** |

Regressão de **835×** sem mudar de forma, nascida no upgrade do `pg_net` para 0.20.0.

**Consequência que inverte a intuição:** o worker roda o GC a cada tick, com ou sem tráfego.
**Reduzir crons NÃO conserta os 90 %. Só remover a tabela conserta.**

### Hipóteses descartadas com número
- *I/O frio* — `shared_blks_read` = **1** na vida inteira; cache hit 99,98 %. É CPU, não disco.
- *xmin preso* — `backend_xmin` nulo entre ciclos; transações reciclam a ~50s.
- *Autovacuum bloqueado* — está rodando, sem `wait_event`, a 15 blocos/s: falta CPU.
- *Wraparound* — `age(datfrozenxid)` < 1 % do limite.
- *Camada de API / pooler* — rotas que não tocam o banco respondem em 90–418 ms.
- *Queries da aplicação derramando* — **zero**. Os 642 GB de `temp_bytes` são do
  `postgres_exporter` da Supabase (provado por janela controlada + `application_name` +
  aritmética: 2,52 MB/arquivo × 260.557 = 181 dias = idade do projeto).

---

## Sequência recomendada

### Fase 1 — devolver a CPU (uma janela, ~30 min)

| # | Ação | Ganho | Risco |
|---|---|---|---|
| 1 | `select cron.unschedule(2);` — **`sync-newsletter-pending`** | 1.440 req/dia = **83 % do tráfego pg_net** | **zero** |
| 2 | Migrar jobs 1 e 3 para crons da Vercel | remove o último HTTP de dentro do banco | baixo |
| 3 | `DROP EXTENSION pg_net;` | **−90 % do exec_time**, +271 MB de disco | baixo |

**Por que o job 2 é risco zero:** a rota `/api/cron/sync-newsletter-pending` **não existe** —
verificado no repo, ausente do `vercel.json`, e produção devolve **HTTP 404**. Foi deletada na
saída do Brevo; o job sobreviveu e dispara 1.440×/dia contra o nada.

**Por que o `DROP EXTENSION` é seguro (verificado, não presumido):**
- Schema `supabase_functions` não existe → sem Database Webhooks.
- Zero triggers com função `%http%`.
- Único consumidor é `cron_http_post_web()`, que é plpgsql e resolve em runtime — não
  cascateia, vira função morta.
- Jobs 4 e 5 (`purge_sent_emails`, `purge_old_contact_submissions`) são SQL puro, não usam
  HTTP, e ficam onde estão.

**Ajuste necessário na migração:** `publish-scheduled` precisa ir de `0 9 * * *` para
`*/5 * * * *` no `vercel.json`. `lgpd-cleanup-sweep` **já roda duplicado** nos dois sistemas,
no mesmo horário — migrar é só apagar o job do `pg_cron`.

### Fase 2 — cortar desperdício (73 % das invocações)

| Cron | Hoje | Evidência | Ação | Inv./dia |
|---|---|---|---|---|
| `social-publish` | `* * * * *` | **0 posts em 90 dias**; a fila nunca é alimentada | → `*/15` | 1.344 |
| `social-auto-draft` | `*/30` | falha desde 2026-05-29 (FK `created_by`) | desligar até corrigir | 48 |
| `social-metrics` | `0 */4` | 1 execução na vida | desligar | 6 |
| `links-check-expiry` | `*/15` | **3 defeitos**: `short_code`→`code`, e `status` não existe (é `active boolean`), 2× | corrigir ou desligar | 96 |
| `publish-scheduled`, `purge-sent-emails`, `purge-old-contact-submissions` | vários | duplicados nos dois sistemas | desligar um lado | ~2 |
| 16 crons às 04:00 UTC | — | pico contra `max_connections=60` | desempilhar por minuto | 0 |

**Total: ~3.035 de 4.142 invocações/dia — corte de 73 %.**

### Fase 3 — higiene (custo zero, sem urgência)

- `ALTER ROLE supabase_admin SET work_mem = '8MB'` — mata os 4,3 GB/dia de spill do exporter.
  Teto de 32 MB (≈4 conexões), contra 704 MB se fosse global, que **não cabe** na instância.
  *Verificar antes se a role `postgres` tem permissão para isso.*
- Retenção em `cron.job_run_details` (49 MB, 205.820 inserts, nunca vacuumada).
- Versionar os 5 jobs de `pg_cron` em migration — hoje existem **só no dashboard**; um restore
  os perde. Foi por isso que ninguém auditou essa carga em nenhuma rodada anterior.
- Diagnósticos futuros: usar `pg_stat_statements(false)` para não derramar.

---

## O que NÃO fazer

- **Não reiniciar o projeto Supabase.** Região `sa-east-1` tem casos documentados de restart
  travando por horas sem recuperação self-service. Trocaria queda intermitente por total.
- **Não `VACUUM FULL`.** Lock exclusivo por minutos numa instância já sufocada.
- **Não instalar `pg_repack`.**
- **Não tentar baixar `pg_net.ttl`** — impossível aqui: `context='sighup'`, `postgres` não é
  superuser, `pg_parameter_acl` vazio. Provado.

---

## Pendências suas

1. **Autorizar os comandos da Fase 1** — o classificador bloqueou escrita em produção, corretamente.
2. **`gh secret set NTFY_URL`** — o watchdog de uptime já está commitado (`592a5328`) e roda a
   cada 5 min alertando por **latência**, não só status (o incidente respondia 200 com 25s).
3. **Conferir no dashboard** se há aviso de cota: o banco esteve em 884 MB e o Free tier limita
   500 MB. Hoje está em 363 MB.
4. **Instagram** — token expirou 2026-09-04 e o refresh falha desde 2026-08-31. Cadeia separada
   do Meta/Facebook (expirado desde 2026-07-18). Ambos exigem reconexão manual.
