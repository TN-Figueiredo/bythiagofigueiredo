# Spec — incidente de produção e próximos passos

**Data:** 2026-09-05 · **Estado:** produção intermitentemente indisponível (504/timeout), sem
perda de dados. Nenhuma alteração feita em produção até aqui além de desativar e religar um
job de cron (estado restaurado).

---

## 1. Causa raiz

`net._http_response` (extensão `pg_net`) ocupava **792 MB** para 443 linhas vivas, num banco
de 884 MB.

**Atualização 17:47** — houve recuperação parcial espontânea e depois **platô**: a tabela caiu
para **271 MB** e o banco para **363 MB**, com **79 linhas vivas**. O autovacuum concluiu e
truncou as páginas vazias do *fim* do arquivo; o que sobra é espaço livre no meio, que só uma
reescrita devolve. Medido 3× em 5 min: estável, sem nova queda. **Produção segue degradada**
(TTFB de 25s em `/robots.txt`) — um `/robots.txt` em 5,2s medido no meio do caminho foi um
instante entre ciclos do GC, não tendência. 271 MB para 79 linhas continua desproporcional
(o esperado seria menos de 1 MB).

O worker do `pg_net` 0.20.0 mantém transação aberta sobre a tabela; o autovacuum rodou
**uma vez na vida dela** (2026-08-05) contra 151.381 inserções e 150.948 remoções. Sem
manutenção, o espaço alocado nunca volta.

**O mecanismo, corrigido por medição adversarial** (a primeira explicação — "I/O frio
espalhado por 780 MB" — é quantitativamente **falsa**):

- `shared_blks_read` da query de purge = **1 bloco**, na vida inteira, em 103.012 execuções,
  contra `shared_blks_hit` de 629 milhões. O banco tem **99,98% de cache hit**. Não há I/O
  frio: o custo é **CPU e travessia de buffers em RAM**.
- **O xmin não está preso.** O worker do `pg_net` aparece com `backend_xmin` e `xact_start`
  nulos entre ciclos; as transações reciclam a cada ~50s. `max(age(backend_xmin))` do cluster
  = 211 transações. A hipótese de "transação permanentemente aberta" cai.
- **O autovacuum não está bloqueado** — está rodando, `active`, sem `wait_event`, e leva
  **40 minutos para 291 MB** (~15 blocos/s). Isso é **falta de CPU**, não cancelamento.
- **Wraparound descartado:** `age(datfrozenxid)` = 1.945.406 contra limite de 200.000.000.

O mecanismo real é uma **espiral de CPU numa instância Micro**: o índice
`_http_response_created_idx` existe, mas o GC varre a cabeça dele sobre ~50.238 tuplas mortas
para achar 102 vivas (37.255 `relpages` para 443 linhas vivas), visitando heap sem visibility
map — 6.107 buffer hits por chamada. A query é lenta porque o vacuum atrasou; o vacuum atrasa
porque a query come a CPU. `shared_buffers` 224 MB, `work_mem` 2,1 MB, `max_connections` 60.

**Data de nascimento:** o `pg_stat_statements` tem duas entradas do mesmo `queryid` — a rápida
desde 2026-05-09 (332.718 chamadas, média **4 ms**) e a lenta desde **2026-08-05 11:01:28**
(103.012 chamadas, média **3.507 ms**, máximo 25,2 min). A degradação nasceu com o upgrade do
`pg_net` para 0.20.0, há um mês. "Por que hoje" é apenas quando a catraca cruzou o limite.

**A borda HTTP está saudável:** endpoints que não tocam o banco respondem em 90–418 ms (5/5);
`/rest/v1/posts?limit=1` estoura 25s (5/5). O gargalo é **adquirir conexão Postgres**, não a
camada de API nem o "Partially Degraded" global da Supabase.

**Não tem relação com o nosso trabalho recente.** O deployment de produção tem 64 dias e
corresponde a `origin/main`; nada da migração Next 16 está lá.

### O que foi descartado com evidência
- **Migração Next 16** — não está em produção.
- **RLS da `sites`** — policy é `USING (true)`, sem subquery.
- **Crons da Vercel** — os 50 somam ~100 invocações/hora; `cron_health` mostra os registrados saudáveis.
- **Backlog de e-mail** — `notification_deliveries` zerada em todos os status.
- **Locks de aplicação / conexões esgotadas** — 23 de 60 conexões, zero `idle in transaction`, zero locks não concedidos.
- **Wraparound de transação** — `age(datfrozenxid)` abaixo de 1% do limite.
- **Camada de API / pooler da Supabase** — a borda responde normal; só o caminho do Postgres falha.

---

## 2. O plano que foi descartado, e por quê

A primeira proposta era pedir restart do projeto Supabase e truncar na janela seguinte.
**Três furos, todos verificados:**

1. **UNLOGGED não salva.** Tabela UNLOGGED só é esvaziada em shutdown *sujo*. O "Restart
   project" do dashboard é parada orquestrada (SIGTERM/fast shutdown) — não esvazia.
2. **A janela não existe.** No `worker.c` do `pg_net`, o loop trava as duas tabelas da
   extensão na **primeira iteração** ao acordar. Os "5 segundos" medidos eram o intervalo até
   a primeira medição, não uma janela livre. Contra latência de conexão de 2–20s neste banco,
   a corrida está perdida.
3. **O restart é o item mais caro.** O projeto está em `sa-east-1` (São Paulo), região com
   casos documentados de restart falhando por capacidade e projeto ficando horas fora sem
   recuperação self-service. Trocaria indisponibilidade intermitente por risco de
   indisponibilidade total.

---

## 3. O plano recomendado

Vem da leitura do código-fonte da extensão: **o loop externo do worker espera no latch sem
timeout.** Sem requisição nova, ele dorme indefinidamente — sem transação e sem lock. E
`cron_http_post_web()` é o **único** chamador de `net.http_post` no repositório, acionado só
pelos 5 jobs de `pg_cron`.

Logo: zerar os jobs não abre uma janela de segundos, abre uma janela **ilimitada**. Reversível,
sem restart.

### Sequência

| # | Passo | Verificação |
|---|---|---|
| 1 | Desativar os **5** jobs de `pg_cron` (`cron.alter_job(jobid, active := false)`) | `select jobname, active from cron.job` — todos `false` |
| 2 | Esperar a fila drenar (~2 min) | `select count(*) from net.http_request_queue` → 0 |
| 3 | Confirmar que o worker soltou o lock | `pg_locks` join `pg_stat_activity` em `net._http_response` → **zero linhas** |
| 4 | `TRUNCATE net._http_response` — **como job de `pg_cron`** (`*/2`, `lock_timeout='60s'`), não pelo CLI | tamanho → 0 bytes; `pg_database_size` cai para ~100 MB |
| 5 | Remover o job temporário de truncate; religar os 5 jobs | `cron.job` como no baseline |
| 6 | Limpar `cron.job_run_details` (49 MB): `delete where end_time < now()-interval '7 days'` + `vacuum (analyze)` — **sem** `VACUUM FULL` | tamanho cai |
| 7 | Migration versionada (`npm run db:new`) com: retenção diária de `net._http_response`, purge de 7 dias de `job_run_details`, e os **5 jobs de `pg_cron` versionados** | `supabase db push` |

**Por que o passo 4 é job e não CLI:** o `npx supabase db query` falhou 3 de cada 5 vezes
nesta sessão, inclusive em `select 1`. Um passo crítico não pode depender de uma conexão que
falha 40% das vezes. Dentro do banco, o job retenta sozinho até vencer o lock.

**Regra de parada:** se após o passo 4 o tamanho não cair, **parar**. Não instalar `pg_repack`,
não rodar `VACUUM FULL`, não reiniciar o projeto.

### Plano B (se o passo 3 mostrar que o worker não solta)

Deixar os 5 jobs de `pg_cron` **desativados em definitivo** e mover as chamadas para os crons
da Vercel — as rotas já têm alias `GET=POST`. O worker nunca acorda, o DELETE do GC (90% do
tempo do banco) desaparece, e produção estabiliza com os 780 MB inertes. Bloat que ninguém
varre não custa nada.

---

## 4. Ordem recomendada de trabalho

| # | Item | Por quê nesta posição | Custo |
|---|---|---|---|
| 1 | **Monitor sintético externo** (`GET /` a cada 5 min → ntfy/UptimeRobot) | A queda de hoje foi descoberta por acidente, via um job de CI. Sem isso, a próxima também passa. Não exige deploy. | ~30 min |
| 2 | **Subir o tier de compute do Supabase** (dashboard) | **Promovido de "confirmar" para "agir".** O autovacuum leva 40 min para 291 MB por falta de CPU — a instância Micro é causa co-igual, não pano de fundo. Recuperar espaço sem subir CPU deixa a espiral armada. | seu, custo $ |
| 3 | **Remediação do `pg_net`** (seção 3) + versionar os 5 jobs | A causa raiz. Os jobs hoje só existem no dashboard — um restore os perde. | 1–2 h |
| 4 | **`links-check-expiry` e `social-auto-draft`** — queries contra colunas inexistentes, falham 100% das vezes há 3-4 meses | Baratos e isolados. Atenção: o links-check-expiry tem TRÊS defeitos, nao um. | 1 h |
| 5 | **Reconexão OAuth do Meta** | Publicação Facebook/Instagram morta desde 2026-07-18. Manual, não bloqueia nada, roda em paralelo. | 20 min, seu |
| 6 | **Medir `notification_deliveries`** antes do merge | Pré-condição explícita do runbook, não nota de rodapé. Hoje está zerada — reconferir no momento do deploy. | 2 min |
| 7 | **Promover `staging` → `main`** | Só após 24–48 h de banco estável e monitorado. Traz `/api/health`, a instrumentação de cron e o Next 16. Janela isolada, runbook em `docs/ops/runbook-promocao-next16.md`. | 1 h + observação |
| 8 | **Publicar `email` + `cms-admin`** | Mecânico, sem consumidor quebrado. Arrasta 5 pacotes do grupo `linked` para 3.0.0 sem mudança própria — custo aceito conscientemente. | 30 min |
| 9 | **Alarmes mudos** (41 de 50 crons sem linha em `cron_health`; `notification-deliver` só erra se *zero* entregas passarem) | Decisão de produto sobre limiares + ~20-40 linhas. | 2 h |

### O que sai da lista
- **Limpeza das 60 tags órfãs** — é código morto confirmado, mas não causa dano. Fazer de forma oportunista, nunca como esforço dedicado.
- **Coorte de consumo para `cms`/`cms-admin`/`cms-reader` v2** — 2–4 dias de reescrita real (`cms-admin@2.0.0` exige `authGuard: ISiteAuthGuard`; o app usa `requireAuth` legado). É investimento, não conserto. Não deve competir com estabilidade de produção.

---

## 4a. Crons quebrados desde sempre (achado adversarial)

Auditoria anterior de "falhas silenciosas" verificou se as rotas **chamam**
`recordCronSuccess/Failure`. Não verificou se as **queries funcionam**. Estes chamam
corretamente e nunca aparecem em `cron_health` nem `cron_runs`:

| Cron | Defeito | Desde | Frequência |
|---|---|---|---|
| `social-auto-draft` | `select('id, site_id, title, slug')` em `blog_posts`; `title`/`slug` vivem em `blog_translations` | 2026-05-29 (~3 meses) | a cada 30 min |
| `links-check-expiry` | **três** operações quebradas: `short_code` inexistente, `.eq('status','active')` e `update({status:'expired'})` — a coluna é `active boolean`, não `status` | 2026-05-06 (~4 meses) | a cada 15 min |

**Consertar só o `short_code` do `links-check-expiry` deixaria o cron 100% quebrado do mesmo
jeito** — é preciso corrigir as três.

`sync-newsletter-pending` (job de `pg_cron`, a cada minuto) não existe em `vercel.json` nem em
`cron_health`/`cron_runs`: roda 1440×/dia fora do radar dos dois sistemas de observabilidade.

## 4b. Frente própria descoberta de raspão

`temp_files` = **260.474** e `temp_bytes` = **642 GB** vitalícios, com `work_mem` de 2,1 MB.
É alheio ao `pg_net` e é, de longe, a maior fonte de I/O real do banco — alguma query está
derramando para disco sistematicamente. Não investigado. Merece frente própria depois da
estabilização; pode ser causa de lentidão crônica independente deste incidente.

## 5. Ações que exigem autorização explícita

| Ação | Onde | Risco |
|---|---|---|
| `cron.alter_job(..., active := false)` nos 5 jobs | SQL em produção | Baixo, reversível. **Bloqueado pelo classificador — precisa da sua liberação.** |
| `TRUNCATE net._http_response` | SQL em produção | Baixo: tabela UNLOGGED, nenhum leitor no código, 443 linhas descartáveis |
| Restart do projeto Supabase | Dashboard | **Alto em sa-east-1** — não recomendado |
| Upgrade de tier | Dashboard | Custo financeiro; decisão sua |
