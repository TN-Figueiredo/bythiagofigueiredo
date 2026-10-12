# A5 · E20: guarda do bruto dos relatórios em lote (MG13) — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## O que é do DONO

**1. Aplicar a MG13 em produção.** É a única escrita em produção da etapa. O agente cria o arquivo (Tarefa 1) e para; o dono aplica.

- Nome: `npm run db:new observatorio_guarda_do_bruto` (o agente roda; cria `supabase/migrations/<timestamp>_observatorio_guarda_do_bruto.sql`).
- Antes de aplicar (leitura, qualquer um roda): `npx supabase migration list --linked`. Só a MG13 pode estar pendente (produção está em `20261009000001`, que é também a última migration local: conferido em 12/10). Se houver outra pendente, pare: `db:push:prod` aplica todas.
- Aplicar: `npm run db:push:prod` (pede `YES`).
- **Ordem:** a MG13 vai **antes** do código das Tarefas 2 a 5. Ela convive com o código que está em `main` (mesma assinatura da função; colunas com padrão). O contrário não: o código novo lê `expired_at`, e sem a coluna o passo de relatórios para de baixar e o cron fica vermelho com `schema_ausente: yt_reporting_reports`. A Tarefa 2 começa por uma trava que confere isso.
- SQL completo (idempotente; é o conteúdo do arquivo):

```sql
-- MG13 (A5, E20): o bruto dos relatórios em lote deixa de ser apagado por cron.
-- Mesma assinatura e mesmos grants: o cron diário continua chamando e passa a receber 0.
-- O corpo antigo (apaga o normalizado há 90 dias e o sem normalizador baixado há 180) está em
-- 20261007000006_coleta_canais_proprios_l1a.sql, linhas 186 a 206. Não recriar: é o que apaga.
create or replace function public.yt_reporting_blobs_purge(p_sem_normalizador text[])
returns integer
language plpgsql
set search_path = ''
as $$
begin
  return 0;   -- nada é apagado. A MG6 (E10) troca este corpo por "só o bruto em lote com nas_confirmed_at".
end $$;

revoke all on function public.yt_reporting_blobs_purge(text[]) from public, anon, authenticated;
grant execute on function public.yt_reporting_blobs_purge(text[]) to service_role;

-- Estado que a E12 pediu e não tinha onde gravar (pendência M6 do ledger da E12).
alter table public.yt_reporting_reports
  add column if not exists expired_at timestamptz,
  add column if not exists download_attempts integer not null default 0,
  add column if not exists last_error_at timestamptz;

comment on column public.yt_reporting_reports.expired_at is
  'A origem respondeu 404 ou 410: venceu sem ser baixado. Nulo = não venceu, ou não se sabe (linha anterior à MG13: sem registro de vencimento).';
comment on column public.yt_reporting_reports.download_attempts is
  'Tentativas de download deste relatório desde a MG13. Leitura e soma sem trava: duas execuções sobrepostas podem contar uma só.';
comment on column public.yt_reporting_reports.last_error_at is
  'Última tentativa que não guardou o bruto (download ou gravação). Nulo = nunca falhou desde a MG13.';

notify pgrst, 'reload schema';
```

- Consulta que confere (TESTADA em produção em 12/10; hoje devolve `colunas_mg13 = 0`, `purge_desligado = false`, `blobs = 160`, `baixados_sem_bruto = 0`):

```bash
npx supabase db query --linked "select (select count(*) from information_schema.columns where table_schema='public' and table_name='yt_reporting_reports' and column_name in ('expired_at','download_attempts','last_error_at')) as colunas_mg13, (select prosrc not like '%delete from%' from pg_proc where proname='yt_reporting_blobs_purge') as purge_desligado, (select count(*) from yt_reporting_report_blobs) as blobs, (select count(*) from yt_reporting_reports r where r.downloaded_at is not null and not exists (select 1 from yt_reporting_report_blobs b where b.report_id = r.report_id)) as baixados_sem_bruto"
```

Depois da MG13 o esperado é `colunas_mg13 = 3`, `purge_desligado = true`, `blobs` maior ou igual ao número anotado antes, `baixados_sem_bruto = 0`.

**2. Nada mais.** Não há chave, variável de ambiente, cron nem escrita na forja.

## Perguntas que sobram

Nenhuma trava. Duas decisões do plano que o portão ou o dono podem vetar:

1. **O sinal de perda é sem memória, e não "caiu de um dia para o outro".** O spec (7.6) pede que o cron acuse falha se `blobs_guardados` cair de um dia para o outro. O plano grava `blobs_guardados` no resumo e acusa por outra conta, que não depende do dia anterior: **todo relatório com `downloaded_at` tem de ter o seu bruto** (`baixados_sem_bruto > 0` é falha). Motivo: a queda de um dia para o outro dá falso alarme na remoção de um canal próprio (a cascata leva relatório e bruto juntos) e some se o cron do dia anterior não rodou; a conta sem memória acusa todo dia enquanto a perda existir. Medido hoje: 160 brutos, 160 relatórios com `downloaded_at`, zero órfão nos dois sentidos.
2. **Segunda trava não adotada.** O código poderia também parar de chamar a limpeza (o apagamento ficaria desligado mesmo sem a MG13). O plano segue o spec (o cron continua chamando e recebe 0), porque a MG6 da E10 conta com a chamada. Em troca: a trava da Tarefa 2 e o alarme `bruto_apagado > 0`.

---

**Goal:** Nenhum bruto de relatório em lote é apagado por prazo; o que a origem recusa fica datado (`expired_at`); e a perda de um bruto, se acontecer, deixa o cron vermelho todo dia.

**Architecture:** Uma migration (MG13) troca o corpo de `yt_reporting_blobs_purge` por `return 0` e cria três colunas em `yt_reporting_reports`. No código, o passo de relatórios grava as três colunas, acusa `bruto_apagado > 0` e confere, ao fim, que todo relatório baixado tem bruto; o critério persistente ganha a porta que faltava (404 ou 410 em relatório criado há mais de 14 dias). Dois envios: o da migration (Tarefa 1) e o do código (Tarefas 2 a 5), nesta ordem.

**Tech Stack:** Postgres 17 (Supabase), TypeScript estrito, Vitest com `test/youtube/coleta/fake-supabase.ts`; teste de integração com banco local (`HAS_LOCAL_DB=1`).

**Spec:** `docs/superpowers/specs/2026-10-12-observatorio-a5/05-canal-proprio.md` seção 7.6 e itens 204 a 206; `06-ciclo-de-vida-volume-e-cota.md` 9.2 (linha 8 da lista do que apaga) e 9.6; `00-indice-decisoes-e-sequencia.md` ordem 2, MG13 e OP-1. Ledger da etapa: `.superpowers/sdd/a5-e20/progress.md` (criar na Tarefa 1).

## Global Constraints

- **Prazo duro:** MG13 aplicada antes de 07/01/2027 e antes de qualquer normalizador da E11. Medido em 12/10: a primeira normalização foi em `2026-10-10 12:01:59 UTC`; a primeira deleção cairia na execução do cron de **08 ou 09/01/2027** (12:00 UTC); a dos tipos sem normalizador, em 08/04/2027.
- Branch `staging`, sem branch nem worktree. **Nunca** `git stash` nem `git reset`. Commit só por caminho explícito (`git commit -m "..." -- <arquivos>`). **Não fazer push:** o push é do controlador, em envio separado da A4 (seção "Envio").
- Nada que escreva em produção por agente. Leitura só por `npx supabase db query --linked "<select>"`.
- Banco local é compartilhado com outros terminais: aplicar migration com `npx supabase migration up --local`. **Nunca** `npm run db:reset`.
- Não criar o arquivo de migration à mão: `npm run db:new`.
- Não tocar em `docs/cowork-*`, `apps/web/data/pipeline-docs/` nem `api-registry.ts` (a etapa não muda rota de pipeline).
- Nenhum comando nem espera acima de 4 minutos. Suíte: saída para arquivo, só as falhas no contexto.
- TypeScript `strict`, nunca `any`. Testes com `// @vitest-environment node` e datas relativas ao `AGORA` do arquivo.
- **Este sistema falha em verde.** Contagem ausente não é zero; coluna nula não é "não venceu".

## Fatos medidos em produção (12/10/2026, só `select`)

| Fato | Valor |
|---|---|
| Brutos guardados | 160 arquivos, 21.262 bytes de `csv_gz`; a tabela inteira ocupa 176 kB |
| Relatórios | 46 `baixado` (21 normalizados), 114 `vazio` (45 normalizados), 104 `listado` |
| Relatório com `downloaded_at` e sem bruto | 0. Bruto sem relatório baixado: 0. **O `vazio` também tem bruto** (o spec, item 205, dizia que não: a base de comparação é 0, não um número a anotar) |
| O que a limpeza apagaria hoje | 0 linhas |
| Função em produção | corpo com `delete from`; argumentos `p_sem_normalizador text[]`; `search_path=""`; `execute` só para `postgres` e `service_role` |
| Colunas da MG13 | nenhuma existe |
| Chaves estrangeiras do bruto | `report_id` e `site_id`, as duas com `on delete cascade` |
| Resumo do cron | `yt_own_collection_runs.resumo->'relatorios'->>'bruto_apagado'` = `"0"` em 11 e 12/10; `falhas` é `text[]` |
| Banco | 171 MB (teto do plano gratuito: 500 MB) |

## O que continua sendo apagado, e por quê

| O quê | Quem apaga | Por quê | Toca o bruto? |
|---|---|---|---|
| Tudo de um canal **próprio** removido | `youtube_channel_remove`, pelo dono, com o slug digitado | decisão do dono, caso a caso | **sim**, por cascata (relatório leva o bruto). Sem export nesta fase (9.2, linha 11) |
| Tudo de um site apagado | cascata de `site_id` | não acontece em operação normal | sim |
| Linhas de `yt_own_collection_runs` com mais de 90 dias | o próprio cron | é registro de execução, não dado coletado | não |
| Linha de `ops_alert_state` de alerta resolvido | `coleta/alerts.ts` | estado de execução | não |
| O arquivo **na origem** (YouTube) | o YouTube, 60 dias depois de gerado (30 no histórico) | regra do Google | é por isso que o bruto fica aqui |

O `upsert` do bruto por `report_id` troca o arquivo quando um relatório volta à fila e é baixado de novo: é substituição pelo arquivo novo, não deleção. Depois da E20 **nenhuma rotina apaga bruto por prazo**. A MG6 (E10) reabre a função só para bruto em lote confirmado no NAS.

**Efeito no tamanho do banco.** Hoje: 176 kB. Com os 13 tipos ligados nos dois canais (E12, a partir de 13/10) entram cerca de 26 arquivos por dia, perto de 9.500 por ano. Custo por arquivo: entre 0,25 kB (conta de linha e índice) e 1,1 kB (medido hoje, pessimista porque a tabela é pequena e o custo fixo pesa). **Estimativa: de 2,4 a 10 MB por ano**, menos de 2% do teto. O spec (9.6) diz "centenas de kB por ano": foi escrito antes de a E12 triplicar o número de arquivos. A conferência de 12/11/2026 troca a estimativa por medida.

## O que acontece quando o dado não existe, e em cada falha

| Situação | O que acontece | Como o dono vê |
|---|---|---|
| MG13 não aplicada e código novo no ar | a leitura da fila pede `expired_at`, o banco recusa, o passo não baixa nada; os relatórios seguem `listado` (30 a 60 dias de prazo na origem) | cron vermelho todo dia: `schema_ausente: yt_reporting_reports` |
| MG13 aplicada e código antigo no ar | a limpeza devolve 0; as colunas ficam no padrão | nada muda; `bruto_apagado = 0` no resumo |
| Alguém recria o corpo antigo da função | a limpeza apaga; o resumo traz `bruto_apagado > 0` | vermelho no dia (`a limpeza apagou N bruto(s)`), e vermelho **todo dia seguinte** por `baixados_sem_bruto` |
| Bruto some por outro caminho | `baixados_sem_bruto > 0` | vermelho todo dia, até ser explicado |
| O banco não devolve a contagem | `blobs_guardados` fica `null` | nota `guarda do bruto não conferida`; nunca "0 órfãos" |
| O passo sai antes do fim (sem canal ligado, sem tempo, fila ilegível) | a conferência não roda; `blobs_guardados = null` no resumo | não é perda: a conta é sem memória e roda no dia seguinte. A consulta com data cobre |
| Relatório expirado antes da MG13 (`expired_at` nulo) | lê como "sem registro de vencimento"; fica nas duas portas antigas do critério | `expirados_sem_registro` no resumo |
| 404 ou 410 em relatório criado há mais de 14 dias | grava `expired_at`; o critério novo avisa por 14 dias | `relatórios: <canal> tem relatório <tipo> expirado sem baixar`, todo dia da janela (antes: só no dia) |
| Bruto gravado e a marca `baixado` falha | sobra um bruto a mais que relatórios baixados; pode esconder **um** órfão na contagem do cron | a consulta com data é exata (anti-junção) |
| Duas execuções sobrepostas | `download_attempts` pode contar uma só | declarado no comentário da coluna |

## Simulação do dia do envio e dos seguintes

| Quando | Quem | O quê |
|---|---|---|
| D0 | agente | Tarefa 1: arquivo da MG13, teste de integração, runbook. Commit local |
| D0 | dono | `migration list --linked` (só a MG13 pendente) e `npm run db:push:prod` |
| D0 | agente | consulta de conferência: `3`, `true`, `blobs >= 160`, `0`. Anota no ledger com a hora |
| D0, 12:00 UTC seguinte | cron (código antigo) | chama a limpeza e recebe 0. Agente confere `bruto_apagado = "0"` e `falhas` sem `schema_ausente` |
| D0 ou D1 | agente | Tarefas 2 a 5; controlador faz o envio separado para `staging`, CI verde, promoção a `main` |
| primeiro cron depois do envio | cron (código novo) | resumo com `blobs_guardados` (número), `baixados_sem_bruto = 0`, `bruto_apagado = 0` |
| se o envio do código sair **antes** da MG13 | — | o cron seguinte fica vermelho (`schema_ausente`), nada é baixado naquele dia, nada vence (prazo de 30 a 60 dias). Conserto: aplicar a MG13; não precisa reverter |

## Interruptor e plano de volta

- **Interruptor:** nenhum novo. `PASSOS_LIGADOS.relatorios` (`coleta/index.ts:24`) desliga o passo inteiro, como hoje.
- **Volta do código:** reverter os commits das Tarefas 2 a 5 (um `git revert` por commit). A MG13 fica; o código antigo convive com ela.
- **Volta da MG13:** recriar o corpo antigo da função. **Não recomendado: é o que apaga.** As três colunas ficam.

## Envio (separado da fase A4)

A A4 local está 78 commits à frente de `origin/staging` e não pode ir pela metade. `git diff --name-only origin/staging..HEAD -- apps/web/src` em 12/10: 67 arquivos (59 em `app/cms/(authed)`, 8 em `lib/youtube/observatorio`). **Nenhum** é arquivo deste plano (`lib/youtube/coleta/*`, `types/database.types.ts`, `supabase/migrations/*`, `docs/ops/*`, `test/youtube/coleta/*`, `test/integration/coleta-l1a-migration.test.ts`). O envio usa o roteiro da E12 (`.superpowers/sdd/a5-e12/progress.md`, "Roteiro do envio separado"), com a lista de arquivos deste plano. Refazer o `git diff` no dia: a A4 anda.

## Review Focus

1. **Código novo sem a MG13:** o passo para de baixar. Esperado: vermelho no primeiro cron, nunca verde. Teste na Tarefa 3 (`schema_ausente` na leitura da fila).
2. **Linha antiga sem `expired_at`:** não pode ler como "não venceu". Teste na Tarefa 2 (registro sem o campo).
3. **Contagem nula do banco:** não pode virar "0 órfãos". Teste na Tarefa 5 (`semContagem`).
4. **Uma perda, uma nota:** 404 tardio não pode gerar duas notas quando o prazo da origem também passa. Teste na Tarefa 4.
5. **Sementes de teste com `downloaded_at` e sem bruto:** a conferência nova as acusa. O conserto é semear o bruto, nunca afrouxar a conferência (Tarefa 5).

---

### Task 1: MG13, teste de integração e runbook (envio 1)

**Files:**
- Create: `supabase/migrations/<timestamp>_observatorio_guarda_do_bruto.sql` (por `npm run db:new`)
- Modify: `apps/web/test/integration/coleta-l1a-migration.test.ts:102-116`
- Modify: `docs/ops/youtube-coleta-canais-proprios-runbook.md` (linhas 26, 30, 86, 409, 534, 659 a 661)
- Create: `.superpowers/sdd/a5-e20/progress.md`

**Interfaces:**
- Produces: `public.yt_reporting_blobs_purge(text[]) returns integer` (sempre 0); colunas `expired_at timestamptz null`, `download_attempts integer not null default 0`, `last_error_at timestamptz null`.

- [ ] **Step 1: Anotar a base no ledger.** Rodar a consulta de conferência do topo e gravar o resultado, com a hora, em `.superpowers/sdd/a5-e20/progress.md` (seção "Antes da MG13").

- [ ] **Step 2: Trocar o teste de integração (falha antes da migration).** Substituir o `it` das linhas 102 a 116 por:

```ts
  it('MG13 (E20): a limpeza não apaga nada, nem o normalizado há 91 dias nem o sem normalizador baixado há 181', async () => {
    const velho = (dias: number) => new Date(Date.now() - dias * DIA).toISOString()
    const a = relatorio('guarda-a', { report_type_id: 'channel_basic_a3', status: 'baixado', downloaded_at: velho(181) })
    const c = relatorio('guarda-c', { status: 'baixado', downloaded_at: velho(120), normalized_at: velho(91) })
    expect((await sb.from('yt_reporting_reports').insert([a, c])).error).toBeNull()
    const blob = (id: string) => ({ report_id: id, site_id: siteId, csv_gz: `\\x${gzipSync(Buffer.from('h\n')).toString('hex')}` })
    expect((await sb.from('yt_reporting_report_blobs').insert([a, c].map(r => blob(r.report_id)))).error).toBeNull()
    const contar = async () => (await sb.from('yt_reporting_report_blobs').select('report_id', { count: 'exact', head: true }).eq('site_id', siteId)).count
    const antes = await contar()
    for (const lista of [SEM_NORMALIZADOR, [], ['channel_reach_basic_a1', 'channel_basic_a3']]) {
      const purge = await sb.rpc('yt_reporting_blobs_purge', { p_sem_normalizador: lista })
      expect(purge.error).toBeNull()
      expect(purge.data).toBe(0)
    }
    expect(await contar()).toBe(antes)
    const restam = await sb.from('yt_reporting_report_blobs').select('report_id').in('report_id', [a.report_id, c.report_id])
    expect(restam.data!.map(r => r.report_id).sort()).toEqual([a.report_id, c.report_id].sort())
  })

  it('MG13: as três colunas de estado existem, com o padrão certo', async () => {
    const r = relatorio('guarda-col')
    expect((await sb.from('yt_reporting_reports').insert(r)).error).toBeNull()
    const lido = await sb.from('yt_reporting_reports').select('expired_at, download_attempts, last_error_at').eq('report_id', r.report_id).single()
    expect(lido.error).toBeNull()
    expect(lido.data).toEqual({ expired_at: null, download_attempts: 0, last_error_at: null })
  })

  it('MG13: anon não executa a limpeza', async () => {
    const anon = createClient(SUPABASE_URL, ANON_KEY)
    expect((await anon.rpc('yt_reporting_blobs_purge', { p_sem_normalizador: [] })).error).not.toBeNull()
  })
```

- [ ] **Step 3: Rodar e ver falhar.**

Run: `cd apps/web && HAS_LOCAL_DB=1 npx vitest run test/integration/coleta-l1a-migration.test.ts > /tmp/e20-t1.log 2>&1; tail -20 /tmp/e20-t1.log` (antes: `npm run db:start`, se o banco local não estiver de pé)
Expected: FAIL no primeiro `it` (`expected 1 to be 0` ou parecido: a função antiga apaga) e no segundo (coluna inexistente).

- [ ] **Step 4: Criar a migration.** `npm run db:new observatorio_guarda_do_bruto`; colar no arquivo criado o SQL da seção "O que é do DONO", sem mudar nada.

- [ ] **Step 5: Aplicar no banco local e ver passar.**

Run: `npx supabase migration up --local && cd apps/web && HAS_LOCAL_DB=1 npx vitest run test/integration/coleta-l1a-migration.test.ts > /tmp/e20-t1.log 2>&1; tail -8 /tmp/e20-t1.log`
Expected: PASS em todos. Rodar `npx supabase migration up --local` uma segunda vez: sem erro (idempotência).

- [ ] **Step 6: Runbook (OP-1).** Em `docs/ops/youtube-coleta-canais-proprios-runbook.md`:
  - linha 26, última coluna: `Sim: o bruto fica guardado (MG13, E20); nenhuma rotina o apaga por prazo`.
  - linha 30: trocar "e o bruto é apagado 180 dias depois do download (o de `channel_reach_basic_a1`, 90 dias depois de normalizado)" por "e o bruto **não é mais apagado por prazo** (MG13, E20)"; apagar a frase "Prazos de apagamento sem exportar (07/01/2027 …)" até o fim dela.
  - linha 86: acrescentar à lista de campos de `coleta.relatorios`: `blobs_guardados` (brutos no banco; `null` = não conferido nesta execução), `baixados_sem_bruto` (maior que 0 é falha), `expirados_sem_registro`.
  - linha 409: trocar "O bruto de um relatório normalizado é apagado 90 dias depois; sem ele" por "Desde a MG13 o bruto não é apagado por prazo; se mesmo assim faltar,".
  - linha 534: trocar o parêntese final por "(desde a MG13 nenhuma limpeza por prazo vale para ele)".
  - linhas 659 a 661: substituir os três itens por um: "**O bruto não é apagado por prazo (MG13, E20, aplicada em <data>).** `yt_reporting_blobs_purge` devolve 0. Sinais: `bruto_apagado` tem de ser 0 e `baixados_sem_bruto` tem de ser 0; qualquer outro valor deixa o cron vermelho. Conferências com data: 12/11/2026 (tamanho), 09/01/2027 e 09/04/2027 (as datas em que a limpeza antiga apagaria), consultas na seção \"Conferências depois do envio\" do plano `docs/superpowers/plans/2026-10-12-a5-e20-guarda-do-bruto-plan.md`. Recriar o corpo antigo da função é o que apaga: não fazer."
  - conferir a linha 606 (`drop function if exists public.yt_reporting_blobs_purge(text[])`): se for o roteiro de desfazer o L1a, deixar e acrescentar ao lado "(a MG13 a recriou: ver a seção de limpeza)".

- [ ] **Step 7: Commit (sem push).**

```bash
git add supabase/migrations/*_observatorio_guarda_do_bruto.sql
git commit -m "feat: MG13 desliga o apagamento do bruto dos relatórios e cria expired_at, download_attempts e last_error_at (A5, E20)" -- supabase/migrations/*_observatorio_guarda_do_bruto.sql apps/web/test/integration/coleta-l1a-migration.test.ts docs/ops/youtube-coleta-canais-proprios-runbook.md
```

**Critério de pronto:** teste de integração verde no banco local; migration idempotente; runbook sem nenhuma menção a limpeza com data (`grep -n "07/01/2027\|07/04/2027" docs/ops/youtube-coleta-canais-proprios-runbook.md` devolve só a linha nova). **Parar aqui e devolver ao controlador: a aplicação em produção é do dono.**

---

### Task 2: trava da ordem e a leitura de `expired_at` (módulo puro)

**Files:**
- Modify: `apps/web/src/lib/youtube/coleta/fila-relatorios.ts` (`ItemDaFila`, `perdaCobertaPorCriterios`; função nova)
- Test: `apps/web/test/youtube/coleta/fila-relatorios.test.ts`

**Interfaces:**
- Produces: `ItemDaFila.expired_at?: string | null`; `type RegistroDeVencimento = { tipo: 'origem'; em: string } | { tipo: 'sem_registro' }`; `registroDeVencimento(p: { expired_at?: string | null }): RegistroDeVencimento`.

- [ ] **Step 1: Trava.** Rodar a consulta de conferência do topo. Se `colunas_mg13` não for `3` ou `purge_desligado` não for `true`: **parar**. As Tarefas 2 a 5 podem ser escritas e testadas, mas o controlador não envia antes disso. Anotar o resultado no ledger.

- [ ] **Step 2: Testes que falham.** Acrescentar a `fila-relatorios.test.ts` (usar o `AGORA` e o `DIA_MS` que o arquivo já define; se o nome for outro, usar o do arquivo):

```ts
describe('E20: registro de vencimento (MG13)', () => {
  it('linha sem o campo (anterior à MG13) é "sem registro de vencimento", nunca "não venceu"', () => {
    const linha: Record<string, unknown> = { report_type_id: 'channel_basic_a3', create_time: new Date(AGORA - 20 * DIA_MS).toISOString(), expired_at: '2026-10-01T00:00:00.000Z' }
    delete linha.expired_at
    expect(registroDeVencimento(linha)).toEqual({ tipo: 'sem_registro' })
    expect(registroDeVencimento({ expired_at: null })).toEqual({ tipo: 'sem_registro' })
    expect(registroDeVencimento({ expired_at: 'lixo' })).toEqual({ tipo: 'sem_registro' })
  })
  it('com a data da origem devolve o instante', () => {
    expect(registroDeVencimento({ expired_at: '2026-10-05T12:00:00Z' })).toEqual({ tipo: 'origem', em: '2026-10-05T12:00:00.000Z' })
  })
  it('404 em corrente criado há 20 dias passa a ser coberto pelos critérios enquanto expired_at estiver na janela', () => {
    const p = { report_type_id: 'channel_basic_a3', create_time: new Date(AGORA - 20 * DIA_MS).toISOString(), is_backfill: false }
    expect(perdaCobertaPorCriterios(p, AGORA)).toBe(false)
    expect(perdaCobertaPorCriterios({ ...p, expired_at: new Date(AGORA).toISOString() }, AGORA)).toBe(true)
    expect(perdaCobertaPorCriterios({ ...p, expired_at: new Date(AGORA - 15 * DIA_MS).toISOString() }, AGORA)).toBe(false)
  })
})
```

- [ ] **Step 3: Rodar e ver falhar.** Run: `cd apps/web && npx vitest run test/youtube/coleta/fila-relatorios.test.ts`. Expected: FAIL (`registroDeVencimento is not defined`).

- [ ] **Step 4: Implementar.** Em `fila-relatorios.ts`: acrescentar o campo a `ItemDaFila`, a função, e a terceira porta.

```ts
export interface ItemDaFila {
  report_type_id: string
  create_time: string
  is_backfill?: boolean | null
  /** MG13. Instante em que a origem respondeu 404 ou 410. Ausente ou nulo = sem registro de vencimento, nunca "não venceu". */
  expired_at?: string | null
}

export type RegistroDeVencimento = { tipo: 'origem'; em: string } | { tipo: 'sem_registro' }

/** O que o banco sabe sobre o vencimento na origem. Linha anterior à MG13, campo nulo ou ilegível: sem registro. */
export function registroDeVencimento(p: { expired_at?: string | null }): RegistroDeVencimento {
  const t = p.expired_at ? new Date(p.expired_at).getTime() : Number.NaN
  return Number.isNaN(t) ? { tipo: 'sem_registro' } : { tipo: 'origem', em: new Date(t).toISOString() }
}
```

Em `perdaCobertaPorCriterios`, logo depois de `const janela = ...` e antes do primeiro `return true`, acrescentar (e atualizar o comentário da função: são três portas; "ficam de fora" passa a ser só "o que venceu há mais de 14 dias"):

```ts
  // (c) MG13: a origem recusou (404/410) e o instante está gravado; o critério por expired_at avisa durante a janela.
  const venc = registroDeVencimento(p)
  if (venc.tipo === 'origem' && Date.parse(venc.em) >= agora - janela + MARGEM_COBERTURA_MS) return true
```

- [ ] **Step 5: Rodar e ver passar.** Run: `cd apps/web && npx vitest run test/youtube/coleta/fila-relatorios.test.ts`. Expected: PASS.

- [ ] **Step 6: Commit.** `git commit -m "feat: registro de vencimento na origem (expired_at) na fila de relatórios (A5, E20)" -- apps/web/src/lib/youtube/coleta/fila-relatorios.ts apps/web/test/youtube/coleta/fila-relatorios.test.ts`

---

### Task 3: o passo grava `expired_at`, `download_attempts` e `last_error_at`

**Files:**
- Modify: `apps/web/src/lib/youtube/coleta/reports-step.ts` (`Pendente` linhas 64-73; `baixarUm` 187-343; `lerFilaPendente` 369)
- Modify: `apps/web/src/types/database.types.ts` (bloco `yt_reporting_reports`, linha ~10238: `Row`, `Insert`, `Update`)
- Test: `apps/web/test/youtube/coleta/reports-step.test.ts`

**Interfaces:**
- Consumes: `registroDeVencimento`, `ItemDaFila.expired_at` (Tarefa 2).
- Produces: nada novo para fora; as três colunas passam a ser gravadas.

- [ ] **Step 1: Testes que falham.** Acrescentar ao fim de `reports-step.test.ts`:

```ts
describe('E20: estado do download gravado no relatório (MG13)', () => {
  it('404 grava expired_at e last_error_at com a hora da execução e soma a tentativa', async () => {
    api.download.mockRejectedValue(new ReportingHttpError(404, null))
    const db = bancoComPurge({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')], yt_reporting_reports: [listado('sumiu', { download_attempts: 2 })] })
    await passoRelatorios(ctxDe(db))
    expect(rel(db, 'sumiu')).toMatchObject({ status: 'expirado_sem_baixar', expired_at: AGORA.toISOString(), last_error_at: AGORA.toISOString(), download_attempts: 3 })
  })
  it('vencido por idade NÃO ganha expired_at (a origem não respondeu nada): continua "sem registro"', async () => {
    const db = bancoComPurge({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')], yt_reporting_reports: [listado('velho', { create_time: ha(61) })] })
    await passoRelatorios(ctxDe(db))
    expect(rel(db, 'velho')!.status).toBe('expirado_sem_baixar')
    expect(rel(db, 'velho')!.expired_at ?? null).toBeNull()
  })
  it('download com 500: continua listado, soma a tentativa e grava last_error_at; expired_at fica nulo', async () => {
    api.download.mockRejectedValue(new ReportingHttpError(500, null))
    const db = bancoComPurge({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')], yt_reporting_reports: [listado('r1')] })
    await passoRelatorios(ctxDe(db))
    expect(rel(db, 'r1')).toMatchObject({ status: 'listado', download_attempts: 1, last_error_at: AGORA.toISOString() })
    expect(rel(db, 'r1')!.expired_at ?? null).toBeNull()
  })
  it('download que dá certo soma a tentativa e não grava last_error_at', async () => {
    const db = bancoComPurge({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')], yt_reporting_reports: [listado('r1')] })
    await passoRelatorios(ctxDe(db))
    expect(rel(db, 'r1')).toMatchObject({ status: 'baixado', download_attempts: 1 })
    expect(rel(db, 'r1')!.last_error_at ?? null).toBeNull()
  })
  it('falha ao gravar o bruto soma a tentativa e grava last_error_at', async () => {
    const db = bancoComPurge({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')], yt_reporting_reports: [listado('r1')] })
    db.writeErrors.yt_reporting_report_blobs = { code: '08006', message: 'conexão caiu' }
    await passoRelatorios(ctxDe(db))
    expect(rel(db, 'r1')).toMatchObject({ status: 'listado', download_attempts: 1, last_error_at: AGORA.toISOString() })
  })
  it('o prazo acaba dentro do download: não conta tentativa (não houve resposta da origem)', async () => {
    api.download.mockRejectedValue(new SemTempoError())
    const db = bancoComPurge({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')], yt_reporting_reports: [listado('r1')] })
    await passoRelatorios(ctxDe(db))
    expect(rel(db, 'r1')!.download_attempts ?? 0).toBe(0)
  })
  it('MG13 não aplicada (a coluna não existe): schema_ausente em falhas, nada é baixado, nada lança', async () => {
    const db = bancoComPurge({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')], yt_reporting_reports: [listado('r1')] })
    db.erroNaLeitura = (tabela, _n, colunas) => (tabela === 'yt_reporting_reports' && colunas.includes('expired_at') ? { code: '42703', message: 'column does not exist' } : undefined)
    const ctx = ctxDe(db)
    await expect(passoRelatorios(ctx)).resolves.toBeDefined()
    expect(ctx.falhas).toContain('schema_ausente: yt_reporting_reports')
    expect(rel(db, 'r1')!.status).toBe('listado')
    expect(api.download).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar.** Run: `cd apps/web && npx vitest run test/youtube/coleta/reports-step.test.ts -t "E20: estado" > /tmp/e20-t3.log 2>&1; tail -30 /tmp/e20-t3.log`. Expected: FAIL nos sete.

- [ ] **Step 3: Implementar.**

  (a) `Pendente` ganha `download_attempts?: number | null` e `expired_at?: string | null`; o `select` de `lerFilaPendente` passa a `'site_id, report_id, channel_id, report_type_id, job_id, download_url, create_time, is_backfill, download_attempts, expired_at'`.

  (b) Em `baixarUm`, logo depois da definição de `marcar`:

```ts
  // MG13: a tentativa é somada a partir do valor lido na fila (o PostgREST não soma num update). Duas execuções
  // sobrepostas podem contar uma só: o `.eq('status', 'listado')` de `marcar` garante que nenhuma rebaixa a outra.
  const tentativa = (p.download_attempts ?? 0) + 1
  const falhou = () => ({ download_attempts: tentativa, last_error_at: new Date().toISOString() })
```

  (c) Nas marcações: `recusarPorTamanho` → `marcar({ status: 'erro', error: 'grande_demais', bytes, ...extra, ...falhou() })`; `url_inesperada` → `marcar({ status: 'erro', error: 'url_inesperada', ...falhou() })`; 404 ou 410:

```ts
        const quando = falhou()
        conferirBanco(await marcar({ status: 'expirado_sem_baixar', error: `HTTP ${erro.status}`, expired_at: quando.last_error_at, ...quando }), 'yt_reporting_reports', ctx.falhas)
        resumo.expirados++
        contarVencido(resumo, { ...p, expired_at: quando.last_error_at }, Date.now())
        return
```

  (d) Erro passageiro (antes do `registrarTentativa` da linha 276) e falha de gravação do bruto (antes do `registrarTentativa` da linha 314): `conferirBanco(await marcar(falhou()), 'yt_reporting_reports', ctx.falhas)`.

  (e) Sucesso: acrescentar `download_attempts: tentativa` ao objeto do `marcar` da linha 322.

  (f) Os dois retornos `sem_tempo` (linhas 250 e 251) ficam como estão: não contam tentativa.

  (g) `database.types.ts`, bloco `yt_reporting_reports`: em `Row`, `download_attempts: number`, `expired_at: string | null`, `last_error_at: string | null`; em `Insert` e `Update`, os três como opcionais (`download_attempts?: number`, `expired_at?: string | null`, `last_error_at?: string | null`), em ordem alfabética como o resto.

- [ ] **Step 4: Rodar o arquivo inteiro.** Run: `cd apps/web && npx vitest run test/youtube/coleta/reports-step.test.ts > /tmp/e20-t3.log 2>&1; grep -E "✓|×|FAIL|Tests" /tmp/e20-t3.log | grep -v "✓" | head -30`. Expected: os sete novos PASS. Os testes antigos que comparam `db.writes` ou a linha inteira do relatório com `toEqual` podem quebrar pelas colunas novas: ajustar a expectativa no mesmo commit, **sem** tirar as colunas do código. Os dois testes que mudam de sentido ficam para a Tarefa 4.

- [ ] **Step 5: Typecheck e commit.** Run: `npm run typecheck -w apps/web > /tmp/e20-tc.log 2>&1; tail -5 /tmp/e20-tc.log`. Expected: sem erro.
`git commit -m "feat: o passo de relatórios grava expired_at, download_attempts e last_error_at (A5, E20)" -- apps/web/src/lib/youtube/coleta/reports-step.ts apps/web/src/types/database.types.ts apps/web/test/youtube/coleta/reports-step.test.ts`

---

### Task 4: o critério persistente lê `expired_at`

**Files:**
- Modify: `apps/web/src/lib/youtube/coleta/criteria.ts:161-211`
- Test: `apps/web/test/youtube/coleta/reports-step.test.ts` (bloco "uma perda, uma nota por execução", linhas 1060-1117, e os testes das linhas 665 e 1093)

**Interfaces:**
- Consumes: `registroDeVencimento` (Tarefa 2); `expired_at` gravado (Tarefa 3).

- [ ] **Step 1: Trocar os dois testes que mudam de sentido e acrescentar os novos.**

  - Linha 665 (`perda que NENHUM critério persistente cobre (404 em corrente criado há 20 dias)…`): o 404 tardio agora é coberto. Renomear para `404 em corrente criado há 20 dias agora é do critério persistente: o passo não anota; o resumo conta todas as vencidas` e trocar a última expectativa por `expect(ctx.falhas).toEqual([])`.
  - Linha 1093: substituir o `it` por:

```ts
  it('404 em corrente criado há 20 dias: UMA nota no dia (a por relatório, pelo expired_at), que dura 14 dias e acaba sozinha', async () => {
    api.download.mockRejectedValue(new ReportingHttpError(404, null))
    const db = bancoComPurge({
      yt_reporting_jobs: [jobRow('channel_reach_basic_a1')],
      yt_reporting_reports: [listado('sumiu', { create_time: ha(20) })],
    })
    const nota = ['relatórios: Canal Um tem relatório channel_reach_basic_a1 expirado sem baixar']
    expect(await rodar(db)).toEqual(nota)
    vi.setSystemTime(new Date(AGORA.getTime() + 13 * DIA_MS))
    expect(await rodar(db)).toEqual(nota)
    vi.setSystemTime(new Date(AGORA.getTime() + 15 * DIA_MS))
    expect(await rodar(db)).toEqual([])
  })

  it('404 tardio cujo prazo da origem também passa dentro da janela: continua UMA nota (a agregada não soma o mesmo relatório)', async () => {
    api.download.mockRejectedValue(new ReportingHttpError(404, null))
    const db = bancoComPurge({
      yt_reporting_jobs: [jobRow('channel_reach_basic_a1')],
      yt_reporting_reports: [listado('sumiu', { create_time: ha(55) })],   // corrente: vence na origem daqui a 5 dias
    })
    expect(await rodar(db)).toHaveLength(1)
    vi.setSystemTime(new Date(AGORA.getTime() + 7 * DIA_MS))               // o prazo da origem passou há 2 dias; expired_at há 7
    expect(await rodar(db)).toEqual(['relatórios: Canal Um tem relatório channel_reach_basic_a1 expirado sem baixar'])
  })

  it('expirado antes da MG13 (expired_at nulo), criado há 20 dias: sem registro de vencimento, nenhuma nota nova inventada', async () => {
    const db = bancoComPurge({
      yt_reporting_jobs: [jobRow('channel_reach_basic_a1')],
      yt_reporting_reports: [listado('antigo', { create_time: ha(20), status: 'expirado_sem_baixar', error: 'HTTP 404' })],
    })
    expect(await rodar(db)).toEqual([])
  })
```

- [ ] **Step 2: Rodar e ver falhar.** Run: `cd apps/web && npx vitest run test/youtube/coleta/reports-step.test.ts -t "uma perda, uma nota" > /tmp/e20-t4.log 2>&1; tail -30 /tmp/e20-t4.log`. Expected: FAIL no primeiro e no segundo (zero notas: nenhum critério lê `expired_at`).

- [ ] **Step 3: Implementar em `criteria.ts`.** Importar `registroDeVencimento` de `./fila-relatorios`. Logo depois do bloco `exp` (termina na linha 177), acrescentar:

```ts
  // MG13 (E20): 404/410 em relatório criado há MAIS de 14 dias. A leitura acima só vê quem foi criado na janela; esta lê o
  // instante em que a origem recusou (`expired_at`) e dura JANELA_PERDA_DIAS a partir dele. Linha anterior à MG13 tem
  // expired_at nulo ("sem registro de vencimento"): fica com as duas portas antigas, nenhuma nota é inventada para ela.
  const expTarde = await ctx.supabase
    .from('yt_reporting_reports')
    .select('report_id, channel_id, report_type_id, status, create_time, expired_at')
    .eq('status', 'expirado_sem_baixar')
    .in('report_type_id', [...HABILITADOS])
    .gte('expired_at', corte14)
    .lt('create_time', corte14)
    .limit(LIMITE_LEITURA)
  if (leituraOk(expTarde, 'yt_reporting_reports', 'relatórios recusados pela origem', ctx.falhas)) {
    const lidos = (expTarde.data ?? []) as Recente[]
    if (lidos.length >= LIMITE_LEITURA) {
      naoAvaliou(ctx.falhas, `relatórios recusados pela origem (yt_reporting_reports): leitura cortada em ${LIMITE_LEITURA}`)
    }
    for (const r of lidos) {
      pushUnico(ctx.falhas, `relatórios: ${nome(r.channel_id)} tem relatório ${r.report_type_id} expirado sem baixar`)
    }
  }
```

No bloco `venc` (nota agregada): acrescentar `expired_at` ao `select` e ao tipo de `lidos` (`expired_at?: string | null`), e, como primeira linha do `for`:

```ts
      const origem = registroDeVencimento(r)
      if (origem.tipo === 'origem' && Date.parse(origem.em) >= agora - JANELA_PERDA_DIAS * DIA_MS) continue   // já tem a nota por relatório
```

Atualizar o comentário do bloco (a frase "quase nunca quem venceu por idade" continua certa; a que diz que o 404 tardio fica sem aviso sai).

- [ ] **Step 4: Rodar o arquivo e os vizinhos.** Run: `cd apps/web && npx vitest run test/youtube/coleta > /tmp/e20-t4.log 2>&1; grep -E "×|FAIL|Test Files|Tests" /tmp/e20-t4.log | head -20`. Expected: tudo PASS.

- [ ] **Step 5: Commit.** `git commit -m "feat: relatório recusado pela origem avisa por 14 dias a partir de expired_at, não só no dia (A5, E20; fecha a pendência M6 da E12)" -- apps/web/src/lib/youtube/coleta/criteria.ts apps/web/test/youtube/coleta/reports-step.test.ts`

---

### Task 5: a guarda conferida em toda execução

**Files:**
- Modify: `apps/web/src/lib/youtube/coleta/reports-step.ts` (`RelatoriosResumo`, linhas 28-52; `passoRelatorios`, linhas 391-392 e 515-534)
- Test: `apps/web/test/youtube/coleta/reports-step.test.ts`; ajustar `test/youtube/coleta/index.test.ts:44` e `:485` (objetos `RelatoriosResumo` escritos à mão)

**Interfaces:**
- Produces: `RelatoriosResumo.blobs_guardados: number | null`, `.baixados_sem_bruto: number | null`, `.expirados_sem_registro: number | null` (vão para `yt_own_collection_runs.resumo->'relatorios'`).

- [ ] **Step 1: Testes que falham.** Trocar o teste da linha 392 e acrescentar o bloco:

```ts
  it('chama a limpeza do bruto com os tipos sem normalizador; desde a MG13 qualquer bruto apagado é falha', async () => {
    const db = bancoComPurge({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')] })
    db.rpcHandlers.yt_reporting_blobs_purge = () => ({ data: 3, error: null })
    const ctx = ctxDe(db)
    const resumo = await passoRelatorios(ctx)
    expect(db.rpcCalls.find(c => c.name === 'yt_reporting_blobs_purge')!.args).toEqual({ p_sem_normalizador: SEM_NORMALIZADOR })
    expect(resumo.bruto_apagado).toBe(3)
    expect(ctx.falhas).toContain('relatórios: a limpeza apagou 3 bruto(s) nesta execução; desde a MG13 o esperado é 0 (a função foi recriada com o corpo antigo?)')
  })
```

```ts
describe('E20: a guarda do bruto é conferida em toda execução', () => {
  const baixado = (id: string): Row => listado(id, { status: 'baixado', downloaded_at: ha(1) })
  const bruto = (id: string): Row => ({ report_id: id, site_id: 'site-1', csv_gz: '\\x00' })

  it('todo baixado tem bruto: o resumo traz a contagem, zero órfãos e nenhuma falha', async () => {
    const db = bancoComPurge({
      yt_reporting_jobs: [jobRow('channel_reach_basic_a1')],
      yt_reporting_reports: [baixado('a'), baixado('b'), listado('c')],
      yt_reporting_report_blobs: [bruto('a'), bruto('b')],
    })
    const ctx = ctxDe(db)
    const resumo = await passoRelatorios(ctx)
    expect(resumo).toMatchObject({ blobs_guardados: 3, baixados_sem_bruto: 0, bruto_apagado: 0 })   // o `c` foi baixado nesta execução
    expect(ctx.falhas).toEqual([])
  })
  it('relatório baixado sem bruto: falha, com os dois números', async () => {
    const db = bancoComPurge({
      yt_reporting_jobs: [jobRow('channel_reach_basic_a1')],
      yt_reporting_reports: [baixado('a'), baixado('b')],
      yt_reporting_report_blobs: [bruto('a')],
    })
    const ctx = ctxDe(db)
    const resumo = await passoRelatorios(ctx)
    expect(resumo).toMatchObject({ blobs_guardados: 1, baixados_sem_bruto: 1 })
    expect(ctx.falhas).toEqual(['relatórios: 1 relatório(s) baixado(s) estão sem o bruto guardado (2 baixados, 1 brutos): o bruto foi apagado'])
  })
  it('o banco não devolve a contagem: "não conferida", nunca zero órfãos', async () => {
    const db = bancoComPurge({
      yt_reporting_jobs: [jobRow('channel_reach_basic_a1')],
      yt_reporting_reports: [baixado('a')],
      yt_reporting_report_blobs: [bruto('a')],
    })
    db.semContagem.yt_reporting_report_blobs = true
    const ctx = ctxDe(db)
    const resumo = await passoRelatorios(ctx)
    expect(resumo.blobs_guardados).toBeNull()
    expect(resumo.baixados_sem_bruto).toBeNull()
    expect(ctx.falhas).toEqual(['relatórios: guarda do bruto não conferida (o banco não devolveu a contagem)'])
  })
  it('passo que sai antes do fim (sem tempo): não confere e diz null, sem falha inventada', async () => {
    const db = bancoComPurge({ yt_reporting_jobs: [jobRow('channel_reach_basic_a1')], yt_reporting_reports: [baixado('a')] })
    const resumo = await passoRelatorios(ctxDe(db, 0))
    expect(resumo.blobs_guardados).toBeNull()
    expect(resumo.baixados_sem_bruto).toBeNull()
  })
  it('conta os expirados sem registro de vencimento (anteriores à MG13)', async () => {
    const db = bancoComPurge({
      yt_reporting_jobs: [jobRow('channel_reach_basic_a1')],
      yt_reporting_reports: [
        listado('velho', { status: 'expirado_sem_baixar', create_time: ha(40) }),
        listado('novo', { status: 'expirado_sem_baixar', create_time: ha(40), expired_at: ha(2) }),
      ],
    })
    expect((await passoRelatorios(ctxDe(db))).expirados_sem_registro).toBe(1)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar.** Run: `cd apps/web && npx vitest run test/youtube/coleta/reports-step.test.ts -t "guarda do bruto|chama a limpeza" > /tmp/e20-t5.log 2>&1; tail -30 /tmp/e20-t5.log`. Expected: FAIL.

- [ ] **Step 3: Implementar.**

  (a) `RelatoriosResumo`: acrescentar, depois de `bruto_apagado`:

```ts
  /** MG13 (E20). Brutos guardados no banco. null = não conferido nesta execução (o passo saiu antes, ou a contagem não veio). */
  blobs_guardados: number | null
  /** Relatórios com `downloaded_at` que não têm bruto. Maior que 0 é falha: o bruto é guardado para sempre. null = não conferido. */
  baixados_sem_bruto: number | null
  /** `expirado_sem_baixar` com `expired_at` nulo: sem registro de vencimento (anteriores à MG13, ou vencidos por idade). */
  expirados_sem_registro: number | null
```

  e os três como `null` no objeto inicial de `passoRelatorios` (linhas 391-392).

  (b) Função nova, antes de `passoRelatorios`:

```ts
/**
 * E20: nenhuma rotina apaga bruto por prazo. Conta sem memória: todo relatório com `downloaded_at` tem de ter o seu bruto
 * (o `vazio` também tem). Não depende do dia anterior, então não dá falso alarme na remoção de um canal (a cascata leva os
 * dois) e acusa todo dia enquanto a perda existir. Contagem ausente não é zero. Limite conhecido: bruto gravado cuja marca
 * `baixado` falhou sobra do lado dos brutos e pode esconder UM órfão; a consulta com data do plano é exata.
 */
async function conferirGuarda(ctx: StepCtx, resumo: RelatoriosResumo): Promise<void> {
  const brutos = await ctx.supabase.from('yt_reporting_report_blobs').select('report_id', { count: 'exact' }).limit(1)
  const baixados = await ctx.supabase.from('yt_reporting_reports').select('report_id', { count: 'exact' }).not('downloaded_at', 'is', null).limit(1)
  const semRegistro = await ctx.supabase.from('yt_reporting_reports').select('report_id', { count: 'exact' }).eq('status', 'expirado_sem_baixar').is('expired_at', null).limit(1)
  if (conferirBanco(semRegistro, 'yt_reporting_reports', ctx.falhas, 'ler') === 'ok') resumo.expirados_sem_registro = semRegistro.count ?? null
  const okBrutos = conferirBanco(brutos, 'yt_reporting_report_blobs', ctx.falhas, 'ler') === 'ok'
  const okBaixados = conferirBanco(baixados, 'yt_reporting_reports', ctx.falhas, 'ler') === 'ok'
  if (!okBrutos || !okBaixados) return
  if (brutos.count == null || baixados.count == null) {
    pushUnico(ctx.falhas, 'relatórios: guarda do bruto não conferida (o banco não devolveu a contagem)')
    return
  }
  resumo.blobs_guardados = brutos.count
  resumo.baixados_sem_bruto = Math.max(0, baixados.count - brutos.count)
  if (resumo.baixados_sem_bruto > 0) {
    pushUnico(ctx.falhas, `relatórios: ${resumo.baixados_sem_bruto} relatório(s) baixado(s) estão sem o bruto guardado (${baixados.count} baixados, ${brutos.count} brutos): o bruto foi apagado`)
  }
}
```

  (c) No passo 4 (linhas 515-521), trocar o comentário para `// ── 4. Limpeza do bruto: desde a MG13 devolve 0 (a MG6 da E10 reabre só para lote confirmado no NAS) ──` e, dentro do `if` que grava `resumo.bruto_apagado`, acrescentar:

```ts
      if (purge.data > 0) pushUnico(ctx.falhas, `relatórios: a limpeza apagou ${purge.data} bruto(s) nesta execução; desde a MG13 o esperado é 0 (a função foi recriada com o corpo antigo?)`)
```

  (d) Logo antes do `return fechar()` final (depois do passo 5, linha 534; ao fim para não mudar a ordem das leituras que os testes de página contam):

```ts
  // ── 6. Guarda do bruto (E20) ──────────────────────────────────────────────
  await conferirGuarda(ctx, resumo)
```

  (e) `test/youtube/coleta/index.test.ts:44` e `:485`: acrescentar `blobs_guardados: null, baixados_sem_bruto: null, expirados_sem_registro: null` aos dois objetos.

- [ ] **Step 4: Rodar a pasta.** Run: `cd apps/web && npx vitest run test/youtube/coleta > /tmp/e20-t5.log 2>&1; grep -E "×|FAIL|Test Files|Tests" /tmp/e20-t5.log | head -30`. Expected: PASS. Teste antigo que semeia relatório com `downloaded_at` e **sem** bruto passa a receber a nota nova: o conserto é semear o bruto no teste (`yt_reporting_report_blobs: [bruto(id)]`), **nunca** afrouxar a conferência. Teste que compara o resumo inteiro com `toEqual` ganha os três campos.

- [ ] **Step 5: Typecheck e commit.** Run: `npm run typecheck -w apps/web > /tmp/e20-tc.log 2>&1; tail -5 /tmp/e20-tc.log`.
`git commit -m "feat: a guarda do bruto é conferida em toda execução do cron; bruto apagado ou relatório baixado sem bruto é falha (A5, E20)" -- apps/web/src/lib/youtube/coleta/reports-step.ts apps/web/test/youtube/coleta/reports-step.test.ts apps/web/test/youtube/coleta/index.test.ts`

**Critério de pronto do envio 2:** `npx vitest run test/youtube/coleta` verde; typecheck verde; trava da Tarefa 2 (Step 1) anotada no ledger com `3` e `true`. Devolver ao controlador para o envio separado.

---

## Conferências depois do envio (todas só leitura; as consultas foram TESTADAS em 12/10)

| Quando | Consulta | Esperado |
|---|---|---|
| logo depois da MG13 | a consulta do topo | `3`, `true`, `blobs >= 160`, `0` |
| primeiro cron depois da MG13 (12:00 UTC) e primeiro depois do envio 2 | `npx supabase db query --linked "select ran_at, resumo->'relatorios'->>'bruto_apagado' as bruto_apagado, resumo->'relatorios'->>'blobs_guardados' as blobs_guardados, resumo->'relatorios'->>'baixados_sem_bruto' as baixados_sem_bruto, falhas from yt_own_collection_runs order by ran_at desc limit 2"` | `bruto_apagado = "0"`; depois do envio 2, `blobs_guardados` é número e `baixados_sem_bruto = "0"`; `falhas` sem `schema_ausente` e sem `guarda do bruto` |
| **12/11/2026** | `npx supabase db query --linked "select count(*) as blobs, sum(octet_length(csv_gz)) as bytes, pg_total_relation_size('public.yt_reporting_report_blobs') as tabela_bytes from yt_reporting_report_blobs"` | anotar no ledger e no runbook: é a medida que troca a estimativa de 2,4 a 10 MB por ano (hoje: 160, 21.262, 180.224) |
| **09/01/2027, depois das 12:10 UTC** (item 205) | `npx supabase db query --linked "select count(*) as salvos_pela_e20 from yt_reporting_report_blobs b join yt_reporting_reports r using (report_id) where r.normalized_at < now() - interval '90 days' or (r.report_type_id <> 'channel_reach_basic_a1' and r.downloaded_at < now() - interval '180 days')"` e a consulta do topo | `salvos_pela_e20 > 0` (hoje é 0: são os brutos que a limpeza antiga teria apagado e estão lá; é a prova positiva) e `baixados_sem_bruto = 0` |
| **09/04/2027, depois das 12:10 UTC** | as mesmas duas | `salvos_pela_e20` maior que em janeiro; `baixados_sem_bruto = 0` |

Responsável pelas três com data: o controlador da sessão do dia; a linha nova do runbook (Tarefa 1, Step 6) é o lembrete. O spec (item 205) marcava 08/01/2027: o plano usa 09/01, depois do cron, porque a primeira normalização medida é de 10/10 às 12:01:59 UTC.

## Fora desta etapa

- Exportar o bruto para o NAS e reabrir a limpeza só para lote confirmado: E10 (MG6). Quando a MG6 chegar, o alarme `bruto_apagado > 0` e a conta de `conferirGuarda` têm de descontar o lote confirmado: está no comentário do código.
- Desistir de um relatório depois de N tentativas (dívida 1 do ledger da E12): `download_attempts` passa a existir, a decisão continua do dono.
- O teste da lista fechada do que apaga (item 231) é da E10; a E20 não cria nenhum `delete`.
