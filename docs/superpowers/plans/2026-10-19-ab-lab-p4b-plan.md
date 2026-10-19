# A/B Lab honesto, P4b: a nova tentativa do vigia, os botões da faixa e os avisos da A5 (plano de implementação)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Escrito em 18/10/2026 (noite), **1º rascunho, sem revisão**. O dono liberou escrever o plano (18/10 ~21:30 BRT);
**não** liberou executar nem enviar. Antes de executar: Phil (dado, migration, cota) e Yannis (concorrência,
erros, escrita no YouTube), chamados pelo controlador; conserta-se até haver acordo; o plano volta ao dono para o
"pode" de execução.

**Goal:** quando a restauração de um teste fora do ar falha, o vigia tenta de novo sozinho (uma vez por execução,
`desistiu` na terceira falha que conta), o dono pode "Tentar agora" ou "dispensar" pela faixa, e o assistente de
criação deixa de ter os buracos que a A5 apontou.

**Architecture:** a nova tentativa é uma segunda porta de entrada no mesmo motor da P4a: `novaTentativa()` em
`lib/youtube/ab-settle.ts` reusa a reivindicação (`ab_settle_claim` com `p_de = p_para = status atual`), a decisão
por campo (`decidirCampo`) e a escrita (`restaurarCampos`), mudando só quais campos entram, de onde vem o destino
(do próprio `restore_status`) e como `attempts` anda. O vigia chama essa função numa fase própria
(`lib/youtube/ab-watchdog-nova-tentativa.ts`, `try` próprio, emenda 37); as duas ações humanas chamam a mesma
função ou um `update` guardado por `restore_seq`. A faixa ganha uma ilha cliente com os botões; o texto continua
puro em `faixa-restauracao-texto.ts`.

**Tech Stack:** Next.js 16 (server actions, rota de cron), TypeScript estrito, Vitest, Supabase (Postgres 17,
`bythiago_int` na porta 54422 para integração), Playwright (Gio), YouTube Data API v3 (OAuth).

**Spec:** `docs/superpowers/specs/2026-10-07-ab-lab-honesto-design.md`: seção 3.5 ("Resultado, nova tentativa e
avisos"), 3.2, 3.3; emendas 29 (corte P4a/P4b), 32 (d, e, j, k, l), 37, 38, 40; perguntas B3 e P-4. Aceite:
`docs/superpowers/specs/2026-10-14-ab-lab-aceite-p3-p4.md` §5 (P4b-I1 a I10, P4b-E1, P4b-E2, 5.2). Mockup aprovado
(versão "P4b: com botões", estados C, D, D2, E, F, G, H, I): `docs/superpowers/mockups/2026-10-14-ab-lab-p4-dialogo-e-faixa/index.html`.
Estado entregue pela P4a (em produção, main `34fa51ff9`): `docs/superpowers/plans/2026-10-14-ab-lab-p4a-sair-do-ar-com-seguranca-plan.md`
e o ledger `.superpowers/sdd/2026-10-14-ab-lab-p4a-sair-do-ar-com-seguranca-plan/progress.md` (dívidas "para a P4b"
nas linhas 64, 68, 105, 107 e 130). Avisos da A5: seção "Avisos à sessão do A/B" de
`~/Workspace/wt-abentr/docs/superpowers/plans/2026-10-18-a5-ab-entradas-plan.md` (linhas 423-433); o dono aprovou
que entram aqui (`.superpowers/sdd/ab-lab/2026-10-18-nativo-vs-nosso/plano-conjunto.md` §5, "sim a todas", 18/10
~17:40 UTC). Convivência com a guarda do teste nativo: `docs/superpowers/specs/2026-10-18-ab-s6-s7-guarda-e-nativo-design.md` §6.4-6.5.

> **Para quem executa:** `superpowers:subagent-driven-development`, tarefa por tarefa, com o agente `executor`
> (Sonnet, effort `medium`). Revisão do lote (Tarefa 12): Phil e Yannis, Opus, `medium`. Capturas e o spec
> Playwright: Gio (Sonnet, `medium`); texto e tela: Logan e Naksu (Sonnet, `medium`).

> **Abreviações:** `W` = a árvore de execução (`~/Workspace/wt-ab-p4b`, criada na Tarefa 1); `AB` =
> `apps/web/src/app/cms/(authed)/youtube/ab-lab`; `Y` = `apps/web/src/lib/youtube`; `T` = `apps/web/test`.

## Global Constraints

- **Deploy preso ao G0:** nada deste plano vai ao ar antes do E8 do ensaio da P4a (teste `0d31687e`, vídeo
  `Uy5_DPzoGi8`). A Parte B não toca rotação, `settleOnAir`, drift nem avaliação, mas vai no mesmo envio (pergunta Q3).
- **Nunca um escritor fora da reivindicação** (spec 3.5, "Todo escritor"): `novaTentativa`, `retryRestore` e
  `dismissRestore` reivindicam por `restore_seq` antes e gravam com `where restore_seq = <reivindicado>`; zero
  linhas = `em_andamento` com `MSG_EM_ANDAMENTO` (texto existente, `Y/ab-acao-saida.ts:9`).
- **Toda escrita no YouTube passa por `restaurarCampos`** (`Y/ab-settle.ts:344`): é o ponto que a fase 2 da S6/S7
  vai guardar com `PasseGuarda` (spec S6/S7 §6.4, última linha). Nenhum `setThumbnail`/`escreverTitulo` novo.
- Forma por campo, fixa (emenda 32 a): `{ estado, destino, em, forcado, escreveu, motivo?, erro, attempts }`. Nada
  de campo novo no `restore_status`. Motivos novos de `desistiu` (string livre, o CHECK aceita: `20261014000005_ab_restore_status.sql:50,64`):
  `tres_falhas` e `antes_da_nova_tentativa`.
- **Nenhum escritor grava `restore_status = null`** (D4): dispensar o último campo grava `'{}'::jsonb`.
- `MAX_TENTATIVAS = 3`. `attempts`: a falha da chamada original grava 1 (já é assim: `Y/ab-settle.ts:340`); **só o
  vigia incrementa**; erro de cota (`reason` em `quotaExceeded`, `dailyLimitExceeded`, `rateLimitExceeded`:
  `Y/youtube-api-error.ts:47`) é `falhou` e **não** incrementa; quando o incremento chega a 3 o campo vira
  `desistiu`, motivo `tres_falhas`. `retryRestore` zera antes de tentar (o `em_andamento` da reivindicação leva
  `attempts: 0`); se falhar grava `falhou` com 1.
- **O "sim" repetido vale 48 h** (Y-11, 32 k): o campo é tentado com `forcar = true` só se `forcado === true` e
  `agora - em < 48 h` (47 h repete forçando; 48 h exatas e 49 h já não). Sem isso, `forcar = false`.
- **Fase do vigia:** testes com `status <> 'active'` (inclusive `archived`) e campo em `falhou`; ignora (sem
  escrever) teste cujo vídeo tenha **outro** teste em `draft`, `queued`, `active` ou `paused` (Y-5) e campo
  `falhou` com destino variante em teste `paused` (retomada que não terminou: Phil, `p4a-revisao-phil.md:311`).
  Uma tentativa por execução; no máximo 4 em paralelo (`LIMITE_PADRAO`, `Y/ab-watchdog-drift.ts:29`); não começa
  tentativa depois de `NAO_INICIA_SETTLE_DEPOIS_MS = 15_000` desde o início da rota (`:27`), o resto conta em
  `adiados`; `prazo = inicio + PRAZO_DA_ROTA_MS` (55 s, `:28`). `adiados > 0` → `recordCronFailure`.
- **Resposta do cron:** `nova_tentativa: { tentadas, ok, falharam, desistiram, ignorados, adiados, sem_destinatario }`
  **sempre presente, inclusive com zeros** (P4b-I9).
- **Avisos** (spec 3.5): enquanto houver campo em `falhou` depois de uma tentativa do vigia, chave
  `ab-restore:<testId>` com `claimAlert(…, '1 day')`, liberada (`releaseAlert`) quando o resultado não tiver mais
  `falhou`; ao virar `desistiu`/`tres_falhas`, o aviso próprio pela chave já usada pela P4a
  `ab-restore-desistiu:<testId>:<campo>` (`Y/ab-restore-avisos.ts:83`). Sem destinatário = `fanOut` com total 0
  → `sem_destinatario` na resposta do cron e `recordCronFailure`.
- **Botões** (spec 3.5 e mockup): "Tentar agora" em `falhou` e em `desistiu` com motivo diferente de `novo_teste`
  (o vídeo segue o teste novo; tentar escreveria por cima dele); "Já corrigi no YouTube: dispensar aviso" em
  `falhou`, `desistiu`, `pulado_drift` e `pulado_sem_original`. Permissão: destino `'original'` = a de encerrar
  (`requireEditAccess`, `AB/actions.ts:84`); destino variante = administrar o site (`denyUnlessSiteAdmin`,
  `apps/web/lib/cms/auth-guards.ts:68`); sem permissão, os botões **não existem** (mockup I).
- Horários da tela sempre em São Paulo (`horaSP`, `AB/_components/faixa-restauracao-texto.ts:39`). Próximo vigia:
  10:00 ou 20:00 UTC (`apps/web/vercel.json:23-24`), mostrado em SP (07:00 ou 17:00).
- Textos: cópia exata do mockup aprovado; texto que não está no mockup sai marcado `// TEXTO-A-REVISAR` e passa
  pelo Logan e pelo dono antes do envio (emenda 31). TypeScript `strict`, sem `any`, sem `as unknown as` (ratchet
  do pre-push).
- Testes de servidor: `// @vitest-environment node`; componente cliente: `// @vitest-environment jsdom`. Integração
  em `T/integration/` com `describe.skipIf(skipIfNoLocalDb())`, contra o `bythiago_int`.
- Comandos de teste com saída em arquivo; nunca esperar parado mais de 4 min (suíte longa em background).

## Review Focus

1. **Combo com um campo `ok` e outro `falhou`:** a nova tentativa toca só o `falhou`; o `ok` sai byte a byte igual
   e o vencedor (`winner_applied_at`) só é gravado quando **todos** os campos do teste terminam `ok` (Tarefa 3, teste
   `combo: só o campo pendente é tentado`).
2. **Falha de reversão (destino original num teste com `winner_applied_at` preenchido):** a nova tentativa bem-sucedida
   tem de limpar `winner_applied_at`, `revert_expires_at` e `applied_by`, como `reverter` faz (`Y/ab-settle.ts:427-428`);
   sem isso o teste mostra "vencedor aplicado" com o original no ar (Tarefa 3, teste `reversão que falhou e acerta`).
3. **Fronteira das 48 h e dos 3:** `em` a 48 h exatas não força; `attempts` 2 + falha que conta = `desistiu`;
   `attempts` 2 + cota = `falhou` com 2 (Tarefa 2, testes de `simAindaVale` e `proximoDoVigia`).
4. **Vigia atrasado ou sem linha em `cron_health`:** a faixa diz "na próxima verificação", nunca uma hora; dono fora
   do país vê a hora de SP (Tarefa 8, testes `vigiaAtrasado` e `fuso`).
5. **Dois campos `falhou` com destinos diferentes ou `restore_status` ilegível:** não escreve nada, conta `falhas`,
   Sentry (Tarefa 3, teste `destinos divergentes`; Tarefa 4, teste `ilegível`).

---

## 1. Mapa de arquivos

| Arquivo | Muda | Tarefa |
|---|---|---|
| `Y/ab-restore.ts` | constantes e regras puras da nova tentativa | 2 |
| `Y/youtube-api-error.ts` | exporta `REASONS_DE_COTA` | 2 |
| **novo** `Y/ab-vigia-horario.ts` | próximo vigia, vigia atrasado (puro, importável no cliente) | 2 |
| `Y/ab-settle.ts` | `novaTentativa()`; conversão do `em_andamento` velho antes de reivindicar (PODE-1) | 3 |
| `Y/ab-acao-saida.ts` | resultado `outro_teste`, `MSG_OUTRO_TESTE` | 3 |
| `Y/ab-restore-avisos.ts` | `avisarNovaTentativa`, frase de `tres_falhas` | 4 |
| **novo** `Y/ab-watchdog-nova-tentativa.ts` | a fase nova do vigia | 4 |
| `apps/web/src/app/api/cron/ab-watchdog/route.ts` | chama a fase; resposta `nova_tentativa`; saúde | 4 |
| **novo** `Y/ab-restore-acoes.ts` | corpo de `retryRestore` e `dismissRestore` (portas injetáveis) | 5 |
| `AB/actions.ts` | `retryRestore`, `dismissRestore` (finas: permissão + corpo) | 5 |
| **novo** `apps/web/test/integration/fixtures/ab-p4b-corte.sql` | conversão do `falhou` anterior ao deploy | 6 |
| `apps/web/data/pipeline-docs/cowork-docs-youtube.md` | motivos novos de `desistiu` no `restore_status` | 6 |
| `AB/_components/faixa-restauracao-texto.ts` | frases da P4b, `acoes` | 7 |
| `AB/_components/faixa-restauracao.tsx` | `children` (slot dos botões) | 8 |
| **novo** `AB/_components/faixa-com-acoes.tsx` | ilha cliente com os dois botões | 8 |
| `AB/_components/faixa-da-pagina.ts`, `AB/[testId]/page.tsx` | monta faixa, faixa "tentando" e ações | 8 |
| `Y/ab-resume.ts`, `AB/actions.ts` (`resumeAbTest`, `revertWinner`), `AB/_components/ab-pause-dialog.tsx` | dívidas da P4a (Y-5, PODE-1 no retomar, Pausar silencioso) | 9 |
| `AB/actions.ts` (`createAbTest`), `AB/queries.ts`, `AB/new/page.tsx` | barreiras do assistente (avisos A5 1, 6, 8) | 13 |
| `AB/_components/ab-create-wizard.tsx` | rascunho local não passa por cima do `prefill` (aviso A5 2) | 14 |
| **novo** `Y/ab-dia-do-teste.ts` + 3 chamadores | função única do "dia do teste" (aviso A5 5) | 15 |
| `AB/actions.ts` (`createAbTest`), `AB/new/client.tsx`, `Y/ab-types.ts` | `config.referencia` (aviso A5 3) | 16 |

Fora deste plano, com gatilho (pergunta Q5): aviso A5 4 (abrir rascunho por id; o padrão Q-c da A5 é "link para a
lista", então não é necessário) e aviso A5 7 (curinga do Blob em `Y/ab-referencia.ts:17-27` e
`apps/web/lib/security/csp.ts:65`; gatilho: apertar a CSP). Aviso 9 não pede código. Y-7 da P4a (`restore_seq`
obrigatório no tipo, 32 fixtures) fica fora, sem ganho de comportamento; gatilho: próxima mudança no tipo.

## 2. Fatos conferidos no código (origin/staging `5e519e35d`)

- `ab_settle_claim(p_test_id, p_seq, p_de, p_para, p_end_reason, p_restore_status, p_extra)` substitui o
  `restore_status` **inteiro** e zera `last_applied_variant_id`; `paused_at`/`completed_at` só mudam quando o estado
  muda; com `p_end_reason` nulo não fecha ciclo (`supabase/migrations/20261018000001_ab_lab_p4a_sair_do_ar_com_seguranca.sql:7-61`).
  Logo serve à nova tentativa com `p_de = [status]`, `p_para = status`, desde que o chamador mande o
  `restore_status` completo (campos não tentados copiados). **Sem migration de função.**
- O gatilho do histórico ignora `em_andamento` e grava uma linha por (teste, `restore_seq`, campo) com o resultado
  final (`…p4a….sql:170-201`): cada nova tentativa ganha linha própria em `ab_test_restores`, sem código.
- `montarCampo` grava `attempts: 1` em todo `falhou` e herda nos outros estados (`Y/ab-settle.ts:335-342`);
  `restaurarCampos` é privada e já recebe a lista de campos (`:344-413`); `gravarResultado` decide o vencedor por
  `campos.every(ok)` (`:423`) e só chama `autoImportWinner` na primeira aplicação (`:515`, guarda por
  `r.winner_applied_at === null`, Y-12).
- `settleOnAir` recusa com campo `em_andamento` de menos de 2 min (`RECENTE_MS`, `:84`, `:461`) e, passado isso, a
  reivindicação sobrescreve o `em_andamento` velho sem linha no histórico (PODE-1 do Phil, `task-10-review-phil.md:90-110`).
- O vigia hoje: `converterInterrompidos` (só banco, `em_andamento` > 15 min → `falhou`/`interrompido`, `attempts 1`,
  `Y/ab-watchdog-drift.ts:59-90`) e `detectarDrift` (`:118-182`); a rota soma tudo num `atencao` e responde
  `drift`, `adiados`, `interrompidos`, `avisos` (`apps/web/src/app/api/cron/ab-watchdog/route.ts:92-120`).
- `avisarRestauracao` avisa `falhou` uma vez por (teste, `restore_seq`, campo) com janela de 10 anos (P-4 da P4a,
  `Y/ab-restore-avisos.ts:10,73`) e `desistiu` uma vez por campo (`:83`); `fraseDeDesistencia` conhece só
  `novo_teste` e `video_inexistente` (`:33-38`).
- `paraRestoreStatus` (Zod) não conhece `pulado_teste_youtube` (`Y/ab-restore.ts:102`); o CHECK de produção já o
  aceita (S8-F1, `20261018000004_ab_lab_s8_f1_gravacao.sql:164,178`). Quem o escreve é a fase 2 da S6/S7, que
  alarga o Zod; esta entrega **não** o escreve nem o lê.
- A faixa é server component sem botões (`AB/_components/faixa-restauracao.tsx:25-59`), montada em
  `AB/[testId]/page.tsx:89-93`; o texto põe `NAO_DISPENSA` em C, D, D2, E, `desistiu` (`faixa-restauracao-texto.ts:35,108-161`).
- `useCanAdminSite()` (`apps/web/lib/cms/site-admin-context.tsx:17`) é o que a tela usa hoje para o degrau
  "administrar" (`AB/_components/acoes-de-saida.tsx:74`); o aviso de página é `definirAviso(testId, texto)` (`:26`).
- `createAbTest` barra só `draft/active/paused` (`AB/actions.ts:136-147`) e `getEligibleVideosForPicker` marca
  `hasActiveTest` com os mesmos três (`AB/queries.ts:322`); erros em inglês (`AB/actions.ts:123,129,133,147`).
- O assistente restaura o rascunho local por cima do `prefill` (`AB/_components/ab-create-wizard.tsx:258,278-287`);
  o teste `T/ab-wizard-variante-vazia.test.tsx:37` está em `it.fails` esperando este conserto.
- Três contas do "dia do teste": `AB/queries.ts:432-435` (`floor` desde `started_at`), `AB/_components/active-test-card.tsx:52`
  (`dayOf/…14`), `AB/_components/active-detail.tsx` [INFERÊNCIA: a terceira conta está perto da linha 110 citada
  pela A5; o executor confere com `grep -n "dayOf\|cycles.done" AB/_components/active-detail.tsx`].

---

## 3. As tarefas

Em todas, antes do commit: a lista do A/B e o `tsc`, com saída em arquivo:

```bash
cd ~/Workspace/wt-ab-p4b/apps/web
npx vitest run test/youtube test/ab-*.test.ts test/ab-*.test.tsx test/cron > /tmp/ab-p4b-tN.log 2>&1; tail -30 /tmp/ab-p4b-tN.log
npx tsc --noEmit -p . > /tmp/ab-p4b-tsc.log 2>&1; grep -c "error TS" /tmp/ab-p4b-tsc.log   # esperado: 0
```

Integração (quando a tarefa pede):

```bash
cd ~/Workspace/wt-ab-p4b/apps/web
HAS_LOCAL_DB=1 SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
  npx vitest run test/integration/ab-p4b-*.test.ts > /tmp/ab-p4b-int.log 2>&1; tail -30 /tmp/ab-p4b-int.log
```

Commit por lista explícita: `git add <arquivos> && git commit -m "<tipo>: <descrição>" -- <arquivos>`. Os trechos de
teste são moldes: os auxiliares (`YouTubeFalso`, `imagemComDhash`, `H` de `T/helpers/youtube-falso.ts`;
`semearTesteAb`, `clienteServico` de `T/helpers/db-seed.ts`; o banco falso de `T/youtube/ab-settle.test.ts`) são os
que os arquivos já usam. O que não muda é a lista de afirmações.

### Tarefa 1: árvore e linha de base

**Files:** nenhum arquivo de produto.

- [ ] **Passo 1:** `git -C ~/Workspace/bythiagofigueiredo fetch origin staging && git -C ~/Workspace/bythiagofigueiredo worktree add -b lote/ab-p4b ~/Workspace/wt-ab-p4b origin/staging`; `cd ~/Workspace/wt-ab-p4b && npm ci > /tmp/ab-p4b-ci.log 2>&1 && npm run build:packages > /tmp/ab-p4b-pkg.log 2>&1` (em background se passar de 3 min).
- [ ] **Passo 2:** linha de base: os dois comandos da seção 3 com `tN = t1`. Esperado: 0 falhas, 0 `error TS`. Anotar no ledger `.superpowers/sdd/ab-lab-p4b/progress.md` (criar) o sha de base e as contagens.
- [ ] **Passo 3:** `bythiago_int` de pé (`psql postgresql://postgres:postgres@127.0.0.1:54422/postgres -c "select max(version) from supabase_migrations.schema_migrations"` = `20261018000004` ou posterior) e integração da P4a verde: `… npx vitest run test/integration/ab-p4a-*.test.ts` (comando da seção 3 com esse caminho). Falha aqui = parar e avisar o controlador.

### Tarefa 2: regras puras da nova tentativa

**Files:**
- Modify: `Y/ab-restore.ts` (constantes e funções novas no fim do arquivo)
- Modify: `Y/youtube-api-error.ts:47` (`export const REASONS_DE_COTA`)
- Create: `Y/ab-vigia-horario.ts`
- Test: **novo** `T/youtube/ab-nova-tentativa-regras.test.ts` (`// @vitest-environment node`)

**Interfaces:**
- Produces (em `Y/ab-restore.ts`):
  - `export const MAX_TENTATIVAS = 3`
  - `export const JANELA_DO_SIM_MS = 48 * 3_600_000`
  - `export type MotivoDesistencia = 'video_inexistente' | 'novo_teste' | 'tres_falhas' | 'antes_da_nova_tentativa'`
  - `export function simAindaVale(campo: CampoRestauracao, agora: Date): boolean` — `campo.forcado === true && agora − Date.parse(campo.em) < JANELA_DO_SIM_MS`; `em` ilegível → `false`.
  - `export function erroDeCota(erro: ErroGravado): boolean` — objeto com `reason` em `REASONS_DE_COTA`.
  - `export function proximoDoVigia(anterior: number, erro: ErroGravado): { estado: 'falhou' | 'desistiu'; attempts: number; motivo: 'tres_falhas' | null }` — cota: `{ falhou, anterior, null }`; senão `n = anterior + 1`; `n >= MAX_TENTATIVAS` → `{ desistiu, n, 'tres_falhas' }`; senão `{ falhou, n, null }`.
  - `export function camposPendentes(rs: RestoreStatus | null, origem: 'vigia' | 'humano'): CampoNome[]` — vigia: campos em `falhou`; humano: `falhou` ou (`desistiu` e `motivo !== 'novo_teste'`); ordem `title`, `thumbnail`.
  - `export function podeDispensar(c: CampoRestauracao): boolean` — `falhou`, `desistiu`, `pulado_drift`, `pulado_sem_original`.
- Produces (em `Y/ab-vigia-horario.ts`, sem import de servidor):
  - `export const HORAS_DO_VIGIA_UTC = [10, 20] as const`
  - `export const ATRASO_DO_VIGIA_MS = 15 * 3_600_000` (maior intervalo entre execuções, 14 h, mais 1 h)
  - `export function proximaVerificacao(agora: Date): Date` — o primeiro 10:00 ou 20:00 UTC **estritamente** depois de `agora`.
  - `export function vigiaAtrasado(ultimaExecucaoIso: string | null, agora: Date): boolean` — nulo, ilegível ou mais velho que `ATRASO_DO_VIGIA_MS` → `true`.

- [ ] **Passo 1: testes que falham.**

```ts
describe('proximoDoVigia', () => {
  it('attempts 1 e falha que conta → falhou com 2', () => expect(proximoDoVigia(1, { status: 403, reason: 'forbidden', chamada: 'thumbnails.set' })).toEqual({ estado: 'falhou', attempts: 2, motivo: null }))
  it('attempts 2 e falha que conta → desistiu/tres_falhas com 3', () => expect(proximoDoVigia(2, { motivo: 'token' })).toEqual({ estado: 'desistiu', attempts: 3, motivo: 'tres_falhas' }))
  it.each(['quotaExceeded', 'dailyLimitExceeded', 'rateLimitExceeded'])('cota (%s) não conta', (reason) =>
    expect(proximoDoVigia(2, { status: 403, reason, chamada: 'videos.update' })).toEqual({ estado: 'falhou', attempts: 2, motivo: null }))
  it('interrompido (string) conta', () => expect(proximoDoVigia(1, 'interrompido').attempts).toBe(2))
})
describe('simAindaVale', () => {
  const c = (h: number, forcado = true) => ({ estado: 'falhou', destino: 'v1', em: new Date(T0 - h * 3_600_000).toISOString(), forcado, escreveu: false, erro: null, attempts: 1 }) as const
  it('47 h vale', () => expect(simAindaVale(c(47), new Date(T0))).toBe(true))
  it('48 h exatas não vale', () => expect(simAindaVale(c(48), new Date(T0))).toBe(false))
  it('49 h não vale', () => expect(simAindaVale(c(49), new Date(T0))).toBe(false))
  it('forcado false nunca vale', () => expect(simAindaVale(c(1, false), new Date(T0))).toBe(false))
  it('em ilegível não vale', () => expect(simAindaVale({ ...c(1), em: 'x' }, new Date(T0))).toBe(false))
})
describe('camposPendentes', () => {
  it('vigia: só falhou', () => expect(camposPendentes({ title: falhou, thumbnail: desistiuTres }, 'vigia')).toEqual(['title']))
  it('humano: falhou e desistiu, menos novo_teste', () => {
    expect(camposPendentes({ title: falhou, thumbnail: desistiuTres }, 'humano')).toEqual(['title', 'thumbnail'])
    expect(camposPendentes({ thumbnail: { ...desistiuTres, motivo: 'novo_teste' } }, 'humano')).toEqual([])
  })
  it('nulo e {} → []', () => { expect(camposPendentes(null, 'vigia')).toEqual([]); expect(camposPendentes({}, 'humano')).toEqual([]) })
})
describe('proximaVerificacao', () => {
  it('09:59 UTC → 10:00 do mesmo dia', () => expect(proximaVerificacao(new Date('2026-10-20T09:59:00Z')).toISOString()).toBe('2026-10-20T10:00:00.000Z'))
  it('10:00 exato → 20:00', () => expect(proximaVerificacao(new Date('2026-10-20T10:00:00Z')).toISOString()).toBe('2026-10-20T20:00:00.000Z'))
  it('20:30 → 10:00 do dia seguinte', () => expect(proximaVerificacao(new Date('2026-10-20T20:30:00Z')).toISOString()).toBe('2026-10-21T10:00:00.000Z'))
})
describe('vigiaAtrasado', () => {
  it('nulo → atrasado', () => expect(vigiaAtrasado(null, new Date(T0))).toBe(true))
  it('14 h → em dia; 15 h e 1 min → atrasado', () => {
    expect(vigiaAtrasado(new Date(T0 - 14 * 3_600_000).toISOString(), new Date(T0))).toBe(false)
    expect(vigiaAtrasado(new Date(T0 - 15 * 3_600_000 - 60_000).toISOString(), new Date(T0))).toBe(true)
  })
})
```

- [ ] **Passo 2:** `npx vitest run test/youtube/ab-nova-tentativa-regras.test.ts > /tmp/ab-p4b-t2a.log 2>&1; tail -20 /tmp/ab-p4b-t2a.log` → FAIL (funções não existem).
- [ ] **Passo 3:** implementar as assinaturas acima. `proximaVerificacao` em UTC puro (`Date.UTC`), sem `Intl`.
- [ ] **Passo 4:** o mesmo comando → PASS; lista do A/B e `tsc` (seção 3).
- [ ] **Passo 5:** commit `feat: P4b, regras puras da nova tentativa (attempts, cota, 48 h, próximo vigia)`.

### Tarefa 3: `novaTentativa()` no motor da P4a

**Files:**
- Modify: `Y/ab-settle.ts` (função nova exportada; `montarCampo` e `gravarResultado` ganham a política; conversão PODE-1 antes do passo 1 de `settleOnAir`)
- Modify: `Y/ab-acao-saida.ts` (`traduzirSaida` e `MSG_OUTRO_TESTE`)
- Test: `T/youtube/ab-settle.test.ts` (bloco novo `describe('novaTentativa')`), **novo** `T/integration/ab-p4b-nova-tentativa.test.ts`

**Interfaces:**
- Consumes: Tarefa 2 (`camposPendentes`, `simAindaVale`, `proximoDoVigia`, `MAX_TENTATIVAS`).
- Produces:
  - `export interface OpcoesNovaTentativa { siteId: string; origem: 'vigia' | 'humano'; prazo?: number; seqEsperado?: number }`
  - `export async function novaTentativa(testId: string, op: OpcoesNovaTentativa, p?: Partial<PortasSaida>): Promise<ResultadoSaida>`
  - `ResultadoSaida` ganha `| { resultado: 'outro_teste'; campos: RestoreStatus | null }`.
  - `Retrato` ganha `varianteUltimoCiclo?: string | null` e `VarianteRetrato` ganha `label?: string` (opcionais: as fixtures atuais continuam valendo); `lerRetratoPadrao` passa a ler `label` e o `variant_id` do último ciclo (`Y/ab-settle.ts:201-203`).
  - `export const MSG_OUTRO_TESTE = 'Outro teste está aberto neste vídeo. O Lab não mexe neste enquanto ele estiver aberto.' // TEXTO-A-REVISAR` em `Y/ab-acao-saida.ts`.

Ordem de `novaTentativa` (cada linha é uma decisão; o corpo é do executor):
1. Retrato (`lerRetratoPadrao`); nulo → `ja_encerrado`. `seqEsperado` diferente → `mudou` se `origem = 'humano'`, senão `em_andamento` (mesma regra de `:460`). `emAndamentoRecente` → `em_andamento`.
2. `status === 'active'` ou tipo desconhecido → `ja_encerrado`. `pend = camposPendentes(rs, origem)`; vazio → `ja_encerrado`.
3. Destinos de `pend` diferentes entre si → `Sentry.captureMessage('ab-nova-tentativa: destinos divergentes', {testId})` e `destino_invalido`. Destino que não é variante do teste → `destino_invalido` (`destinoNormalizado`, `:121`).
4. `status === 'paused'` e destino não `'original'` → `ja_encerrado` (retomada que não terminou: nunca escrever rumo à variante num teste pausado).
5. Y-5: existe outro teste do mesmo `site_id` e `youtube_video_id`, `id <> testId`, em `draft/queued/active/paused` → `outro_teste`.
6. `forcar = pend.every(c => simAindaVale(rs[c], agora))`.
7. Reivindica: `ab_settle_claim` com `p_de: [status]`, `p_para: status`, `p_end_reason: null`, `p_extra: {}`, `p_restore_status = { ...rs, [c em pend]: em_andamento }`, `attempts` do `em_andamento` = `origem === 'humano' ? 0 : rs[c].attempts`. Zero linhas → mesma releitura de `:496-501`.
8. `restaurarCampos(portas, r, pend, destino, contexto, forcar, seq, prazo)` com a política: `origem = 'vigia'` e estado `falhou` → `proximoDoVigia(rs[c].attempts, erro)` decide `estado`/`attempts`/`motivo`; `origem = 'humano'` e `falhou` → `attempts: 1` (já é assim); demais estados herdam `attempts` da reivindicação.
9. `final = { ...rs, ...resultadoDosPend }`. Vencedor: `tudoOk` sobre `camposDoTeste(test_type)` em `final`. Destino variante e `tudoOk` → grava `winner_applied_at`, `applied_by = 'manual'`, `revert_expires_at` e chama `autoImportWinner` só se `r.winner_applied_at === null` (Y-12). Destino `'original'`, `r.winner_applied_at !== null` e `tudoOk` → limpa os três (reversão que tinha falhado). Grava com `where restore_seq = seq`.
10. Não avisa: quem chama avisa (vigia: Tarefa 4; ações: Tarefa 5). Devolve `{ resultado: 'feito', campos: final }`.

PODE-1, em `settleOnAir` e `novaTentativa`, entre o passo 1 (validações) e a reivindicação: se algum campo está
`em_andamento` (já com ≥ 2 min, senão o passo 1 recusou), um `update` só de banco
(`.update({ restore_seq: seq + 1, restore_status: convertido }).eq('id', id).eq('restore_seq', seq)`, a mesma forma de
`converterInterrompidos`, `Y/ab-watchdog-drift.ts:80`) grava esses campos como `{ ...campo, estado: 'falhou', erro:
'interrompido', attempts: 1, escreveu: null }` (o `em` fica); zero linhas → `em_andamento`; a reivindicação usa o seq
novo. Não usar `ab_settle_claim` aqui (ele zera o marcador da rotação).

- [ ] **Passo 1: testes unitários que falham** (banco falso de `ab-settle.test.ts`):
  - `vigia, attempts 1, YouTube recusa 403 → falhou com 2; mesmo teste de novo → desistiu/tres_falhas com 3` (P4b-I1, nível da função).
  - `vigia, quotaExceeded → falhou com o attempts de antes` (P4b-I2).
  - `forcado true com em de 47 h e título editado por fora → escreve (forcar); com 49 h → pulado_drift sem escrever` (P4b-I3).
  - `humano, campo desistiu/tres_falhas → reivindicação com attempts 0; falha → falhou com 1`.
  - `combo: só o campo pendente é tentado` — título `falhou`, thumbnail `ok`: nenhuma chamada a `thumbnails.set`; `final.thumbnail` igual (`toEqual`) ao de antes; `winner_applied_at` só depois de o título dar `ok`.
  - `retry acerta o último campo de destino variante → winner_applied_at, applied_by 'manual', revert_expires_at = +7 d; autoImportWinner 1 vez; segunda chamada sem pendente → ja_encerrado e autoImportWinner continua 1` (P4b-I6).
  - `reversão que falhou e acerta → winner_applied_at, revert_expires_at e applied_by nulos`.
  - `paused com destino variante → ja_encerrado, zero chamadas de escrita`.
  - `outro teste draft no mesmo vídeo → outro_teste, zero chamadas de escrita` (P4b-I10, nível da função).
  - `destinos divergentes → destino_invalido e Sentry.captureMessage`.
  - `active → ja_encerrado`; `sem pendente → ja_encerrado`.
  - `PODE-1: settleOnAir com thumbnail em_andamento de 3 min → antes da reivindicação, um update converte em falhou/interrompido com o em antigo; a reivindicação usa restore_seq + 2 no fim`.
- [ ] **Passo 2:** `npx vitest run test/youtube/ab-settle.test.ts > /tmp/ab-p4b-t3a.log 2>&1; tail -30 /tmp/ab-p4b-t3a.log` → os novos falham, os antigos passam.
- [ ] **Passo 3:** implementar `novaTentativa` na ordem acima; `traduzirSaida` ganha `case 'outro_teste': return { ok: false, resultado: 'ja_encerrado', error: MSG_OUTRO_TESTE }` (o `switch` exaustivo obriga; a tela não precisa de resultado novo).
- [ ] **Passo 4:** o mesmo comando → PASS.
- [ ] **Passo 5: integração** `T/integration/ab-p4b-nova-tentativa.test.ts`, contra o banco real (o `ab_settle_claim`, o CHECK, o gatilho):
  - `teste completed, title falhou attempts 1 → novaTentativa(vigia) com YouTube recusando: restore_status.title = falhou/2; uma linha nova em ab_test_restores (seq novo, attempts 2); completed_at e paused_at iguais aos de antes; nenhum ciclo aberto ou fechado`.
  - `archived com falhou → tentado (status continua archived)`.
  - `PODE-1 no banco: em_andamento de 3 min → ab_test_restores ganha a linha falhou/escreveu null com o em antigo`.
  - `retryRestore e vigia simultâneos (Promise.all de duas novaTentativa no mesmo teste) → uma reivindicação vence, a outra em_andamento; o YouTube falso registra uma escrita` (P4b-I5).
  Rodar com o comando de integração da seção 3 → PASS.
- [ ] **Passo 6:** lista do A/B, `tsc`; commit `feat: P4b, novaTentativa no motor do settle (attempts do vigia, 48 h, Y-5, Y-12, PODE-1)`.

### Tarefa 4: a fase nova do vigia, a rota e os avisos

**Files:**
- Create: `Y/ab-watchdog-nova-tentativa.ts`
- Modify: `Y/ab-restore-avisos.ts` (`avisarNovaTentativa`; `fraseDeDesistencia` ganha `tres_falhas` e `antes_da_nova_tentativa`)
- Modify: `apps/web/src/app/api/cron/ab-watchdog/route.ts:92-120`
- Test: **novo** `T/youtube/ab-watchdog-nova-tentativa.test.ts`, `T/ab-cron-watchdog.test.ts` (casos novos), `T/integration/ab-p4b-nova-tentativa.test.ts` (casos novos)

**Interfaces:**
- Consumes: `novaTentativa` (Tarefa 3); `RelogioDoVigia`, `LIMITE_PADRAO`, `NAO_INICIA_SETTLE_DEPOIS_MS`, `PRAZO_DA_ROTA_MS` (`Y/ab-watchdog-drift.ts:27-41`); `emParalelo` (`apps/web/src/lib/util/em-paralelo.ts`).
- Produces:
  - `export interface ResultadoNovaTentativa { tentadas: number; ok: number; falharam: number; desistiram: number; ignorados: number; adiados: number; falhas: number; semDestinatario: number }`
  - `export interface PortasDaNovaTentativa { tentar?: typeof novaTentativa }`
  - `export async function faseNovaTentativa(supabase: SupabaseClient, relogio: RelogioDoVigia, f?: typeof fetch, limite?: number, portas?: PortasDaNovaTentativa): Promise<ResultadoNovaTentativa>`
  - `export async function avisarNovaTentativa(supabase: SupabaseClient, teste: { id: string; site_id: string; name: string }, rs: RestoreStatus, noAr: string | null): Promise<ResultadoAviso>`
  - `fraseDeDesistencia(nome, motivo, campos, noAr?: string | null)`:
    - `tres_falhas`: `` `A restauração do teste "${nome}" falhou 3 vezes e parou. ${noAr ? `No ar continua a variante ${noAr}.` : 'No ar continua o que estava antes.'} Corrija no YouTube Studio.` `` `// TEXTO-A-REVISAR`
    - `antes_da_nova_tentativa`: não é chamada (a conversão da Tarefa 6 não avisa).

Regras da fase (o corpo é do executor):
- Leitura 1: `ab_tests` `id, site_id, name, status, youtube_video_id, restore_seq, restore_status` com `.neq('status', 'active')` e `.or('restore_status->title->>estado.eq.falhou,restore_status->thumbnail->>estado.eq.falhou')`.
- Leitura 2 (uma só, `in`): testes abertos (`draft/queued/active/paused`) dos `youtube_video_id` lidos; teste com outro aberto no mesmo vídeo → `ignorados++`, sem chamar `tentar`.
- `restore_status` ilegível (`paraRestoreStatus` nulo) → `falhas++` e Sentry, sem tentar; `paused` com destino variante → `ignorados++`.
- `emParalelo(itens, limite, tentarUm, () => relogio.agora() - relogio.inicio >= NAO_INICIA_SETTLE_DEPOIS_MS)`; `adiados` vem dele.
- `tentarUm`: `tentadas++`; `tentar(id, { siteId, origem: 'vigia', prazo: relogio.inicio + PRAZO_DA_ROTA_MS, seqEsperado: restore_seq }, { supabase, fetch: f })`. `feito` com algum `desistiu`/`tres_falhas` → `desistiram++`; senão com algum `falhou` → `falharam++`; senão `ok++`; outro resultado → `ignorados++`; exceção → `falhas++` + Sentry. Depois de `feito`: `avisarNovaTentativa(..., noAr = rótulo da variante do último ciclo)`; `sem_destinatario` → `semDestinatario++`; `falha_de_envio` → `falhas++`.
- `avisarNovaTentativa`: há `falhou` → `claimAlert(supabase, 'ab-restore:<id>', '1 day')` e, se reivindicou, um envio com `fraseDeFalha` do primeiro campo em `falhou` (texto existente); não há `falhou` → `releaseAlert(supabase, 'ab-restore:<id>')`; campos `desistiu`/`tres_falhas` → chave `ab-restore-desistiu:<id>:<campo>` (janela de 10 anos, como `:83`) e `fraseDeDesistencia(..., 'tres_falhas', campos, noAr)`, prioridade 3. Mesmo tratamento de `sem_destinatario`/`falha_de_envio` e de liberação de chave que `avisarRestauracao` (`:49-68`).
- Rota: depois da fase de drift, `const nt = await faseNovaTentativa(getSupabaseServiceClient(), { agora: Date.now, inicio }).catch(e => { Sentry…; return { ...ZERO, falhas: 1 } })`; `atencao` passa a incluir `nt.falhas > 0 || nt.adiados > 0 || nt.semDestinatario > 0`; a mensagem de `recordCronFailure` ganha `; nova tentativa: falhas X, adiados Y, sem destinatário Z`; `semDestinatario += nt.semDestinatario`; a resposta ganha, numa linha própria depois de `drift`: `nova_tentativa: { tentadas, ok, falharam, desistiram, ignorados, adiados: nt.adiados, sem_destinatario: nt.semDestinatario }` **sempre**.

- [ ] **Passo 1: testes unitários que falham** (`ab-watchdog-nova-tentativa.test.ts`, `tentar` injetado):
  - `zero testes → todos os contadores 0` (P4b-I9).
  - `relógio falso: 6 testes, limite 4, cada tentativa avança o relógio 8 s → começam os 4 primeiros (0 s) e 0 depois de 16 s: tentadas 4, adiados 2`.
  - `uma tentativa por execução: o mesmo teste aparece uma vez na leitura e tentar é chamado 1 vez`.
  - `outro teste active no mesmo vídeo → ignorados 1, tentar não é chamado` (P4b-I10).
  - `paused com destino variante → ignorados 1`; `ilegível → falhas 1, tentar não é chamado`.
  - `tentar lança → falhas 1, os outros seguem`.
  - `aviso: falhou → claimAlert('ab-restore:<id>', '1 day'); segundo resultado sem falhou → releaseAlert da mesma chave; desistiu/tres_falhas → chave ab-restore-desistiu:<id>:<campo> e mensagem com "falhou 3 vezes e parou"`.
  - `fanOut com total 0 → semDestinatario 1`.
- [ ] **Passo 2:** rota (`T/ab-cron-watchdog.test.ts`, `chain` com os métodos novos): `resposta com zero para tentar traz nova_tentativa com sete zeros e status ok`; `adiados 2 → status atencao e recordCronFailure chamado com "adiados 2"`; `sem_destinatario 1 → avisos.sem_destinatario soma e recordCronFailure`; `a fase de drift lança → a fase nova roda mesmo assim` (try próprio, emenda 37). Rodar também, sem editar: `T/cron/ab-watchdog-competitor-history.test.ts`, `T/lista-fechada-do-que-apaga.test.ts`, `T/cache-writers.test.ts` [INFERÊNCIA: caminhos citados na emenda 37; o executor os acha com `ls T | grep -E "lista-fechada|cache-writers"` e `ls T/cron`].
- [ ] **Passo 3:** rodar os três arquivos → FAIL nos novos.
- [ ] **Passo 4:** implementar.
- [ ] **Passo 5:** rodar → PASS.
- [ ] **Passo 6: integração** (casos novos em `ab-p4b-nova-tentativa.test.ts`): `P4b-I1 inteiro: completed com thumbnail falhou attempts 1; faseNovaTentativa duas vezes (relógio de 10:00 e de 20:00 UTC) com o YouTube recusando → depois da 1ª attempts 2 e 1 chamada de escrita; depois da 2ª desistiu/tres_falhas com 3, e o fanOut recebeu a chave ab-restore-desistiu:<id>:thumbnail`; `P4b-I10: T1 completed falhou forcado true e T2 active no mesmo vídeo → nenhuma escrita, T1 igual`; `o .or() do PostgREST real acha falhou em title e em thumbnail e não acha active`. Comando de integração → PASS.
- [ ] **Passo 7:** lista do A/B, `tsc`; commit `feat: P4b, fase nova do vigia (nova tentativa, desistiu na terceira, aviso diário)`.

### Tarefa 5: as ações `retryRestore` e `dismissRestore`

**Files:**
- Create: `Y/ab-restore-acoes.ts`
- Modify: `AB/actions.ts` (duas ações no fim da seção de saída, perto de `revertWinner`, `:1064`)
- Test: **novo** `T/youtube/ab-restore-acoes.test.ts`, `T/integration/ab-p4b-nova-tentativa.test.ts` (casos novos)

**Interfaces:**
- Consumes: `novaTentativa` (Tarefa 3), `avisarNovaTentativa` (Tarefa 4), `podeDispensar`, `camposPendentes` (Tarefa 2), `traduzirSaida`, `recusaDeSessao`, `seqVistoSchema` (`Y/ab-acao-saida.ts`).
- Produces:
  - `export async function dispensarCampos(supabase: SupabaseClient, testId: string, siteId: string, campos: CampoNome[], seqVisto: number): Promise<ResultadoSaida>` (em `Y/ab-restore-acoes.ts`): relê; `restore_seq <> seqVisto` → `mudou`; algum campo ausente ou fora de `podeDispensar` → `ja_encerrado`; `update` de `restore_status` sem esses campos (vazio → `{}`) e `restore_seq + 1` com `.eq('restore_seq', seqVisto)`; zero linhas → `em_andamento`; depois, sem `falhou` restante, `releaseAlert('ab-restore:<id>')`.
  - `export async function destinoDosCampos(supabase, testId, siteId, campos: CampoNome[]): Promise<'original' | 'variante' | null>` — nulo quando o teste não é do site.
  - Em `AB/actions.ts`: `export async function retryRestore(testId: string, seqVisto: number): Promise<ResultadoAcaoSaida>` e `export async function dismissRestore(testId: string, campos: CampoNome[], seqVisto: number): Promise<ResultadoAcaoSaida>`. Ordem: `requireEditAccess` (falha → `recusaDeSessao`); validar `seqVisto` (`seqVistoSchema`) e `campos` (Zod: `z.array(z.enum(['title','thumbnail'])).min(1).max(2)`; inválido → `MSG_PEDIDO_INVALIDO`); destino variante → `denyUnlessSiteAdmin(siteId, 'tentar de novo ou dispensar a restauração de uma variante')` (negado → `sem_permissao`, `MSG_SEM_PERMISSAO_VARIANTE`); `retryRestore` chama `novaTentativa(testId, { siteId, origem: 'humano', seqEsperado: seqVisto })` e, se `feito`, `avisarNovaTentativa`; os dois terminam em `invalidarTelasDoAbLab()` quando a reivindicação andou (mesma regra de `resumeAbTest`, `AB/actions.ts:727`).

Desvio declarado do spec: o spec escreve `retryRestore(testId)` e `dismissRestore(testId, campo)`. As duas ganham
`seqVisto` (regra D3 da P4a: a tela recusa com `mudou` quando o teste mudou desde a abertura) e `dismissRestore` aceita
a lista de campos que a faixa mostra com o botão (um clique dispensa a faixa inteira; cada campo continua independente
no banco). P4b-I7 continua valendo com a lista de um campo.

- [ ] **Passo 1: testes que falham:**
  - `dispensarCampos(['title']) com title falhou e thumbnail ok → restore_status = { thumbnail: <igual> }, restore_seq + 1` (P4b-I7).
  - `dispensar o único campo → restore_status = {} e nunca null` (P4b-I7, D4).
  - `campo em_andamento ou ok → ja_encerrado, nada gravado`; `seqVisto velho → mudou`.
  - Ações (com `requireSiteScope`/`denyUnlessSiteAdmin` mockados): `editora sem admin, destino variante → sem_permissao e nenhuma chamada a novaTentativa nem update`; `editora, destino original → chama novaTentativa com origem 'humano'`; `sem sessão → sem_permissao` (P4b-I8, lado servidor).
- [ ] **Passo 2:** rodar `npx vitest run test/youtube/ab-restore-acoes.test.ts > /tmp/ab-p4b-t5a.log 2>&1; tail -20 /tmp/ab-p4b-t5a.log` → FAIL.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** rodar → PASS.
- [ ] **Passo 5: integração:** `dismiss no banco real: o gatilho não grava linha nova em ab_test_restores e o CHECK aceita {}`; `retryRestore com teste desistiu/tres_falhas → reivindicação com attempts 0 e, com o YouTube aceitando, ok (P4b-I6 com destino variante: winner_applied_at gravado)`. Comando de integração → PASS.
- [ ] **Passo 6:** lista do A/B, `tsc`; commit `feat: P4b, ações Tentar agora e dispensar aviso (reivindicação por restore_seq, permissão por destino)`.

### Tarefa 6: o corte do deploy (P4b-I4) e a documentação do Cowork

**Files:**
- Create: `apps/web/test/integration/fixtures/ab-p4b-corte.sql` (o corpo da migration; o arquivo de migration nasce **só no envio**, Seção 4)
- Create: `T/integration/ab-p4b-corte.test.ts`
- Modify: `apps/web/data/pipeline-docs/cowork-docs-youtube.md` (onde o `restore_status` é descrito: dois motivos novos de `desistiu` e o significado de `attempts`)

O SQL (decisão de forma; idempotente; uma transação):

```sql
set lock_timeout = '5s';
-- P4b, 32 k (Y-11): campo em `falhou` anterior ao deploy vira `desistiu`/`antes_da_nova_tentativa`; a faixa da P4a já
-- pedia a correção manual. restore_seq + 1 invalida qualquer escritor em voo; o gatilho grava a linha do histórico.
update public.ab_tests t set
  restore_seq = t.restore_seq + 1,
  updated_at = now(),
  restore_status = (
    select jsonb_object_agg(k, case when v ->> 'estado' = 'falhou'
      then v || jsonb_build_object('estado', 'desistiu', 'motivo', 'antes_da_nova_tentativa')
      else v end)
    from jsonb_each(t.restore_status) as e(k, v)
  )
where t.restore_status is not null
  and (t.restore_status -> 'title' ->> 'estado' = 'falhou' or t.restore_status -> 'thumbnail' ->> 'estado' = 'falhou');
```

- [ ] **Passo 1: teste que falha** (`ab-p4b-corte.test.ts`, lê o arquivo e o executa com `pg` contra `SUPABASE_DB_URL`):
  - `title falhou e thumbnail ok → title desistiu/antes_da_nova_tentativa com em, attempts, forcado e erro intactos; thumbnail igual; restore_seq + 1; uma linha nova em ab_test_restores`.
  - `restore_status null, {} e só ok → não mudam (restore_seq igual)`.
  - `rodar duas vezes → a segunda não muda nada` (idempotência).
  - `depois do corte, faseNovaTentativa não tenta o campo convertido` (P4b-I4).
  [INFERÊNCIA: o cliente `pg` já é usado nos testes de integração da P4a para aplicar SQL; se não for, o executor usa `execFileSync('psql', [url, '-v', 'ON_ERROR_STOP=1', '-f', caminho])`.]
- [ ] **Passo 2:** comando de integração com `test/integration/ab-p4b-corte.test.ts` → FAIL (arquivo não existe).
- [ ] **Passo 3:** criar o SQL acima; documentar no `cowork-docs-youtube.md`. Testes da pipeline validam estrutura, não conteúdo (CLAUDE.md, "Pipeline Integrity"); `docs/cowork-pipeline-reference.md` só muda se o JSON da seção mudar (não muda: só valores novos de `motivo`).
- [ ] **Passo 4:** → PASS; commit `test: P4b, corte do falhou anterior ao deploy (SQL da migration, ainda sem arquivo de migration)`.

### Tarefa 7: o texto da faixa da P4b

**Files:**
- Modify: `AB/_components/faixa-restauracao-texto.ts`
- Test: o teste existente do texto da faixa [INFERÊNCIA: `T/youtube/ab-faixa-restauracao-texto.test.ts` ou vizinho; achar com `grep -rln "montarFaixa" apps/web/test`], casos novos.

**Interfaces:**
- Consumes: `proximaVerificacao`, `vigiaAtrasado` (Tarefa 2), `simAindaVale`, `camposPendentes`, `podeDispensar`, `MAX_TENTATIVAS`.
- Produces:
  - `CtxFaixa` ganha `vigiaUltimaExecucao: string | null` e `podeAdministrar: boolean`.
  - `FaixaCompleta` ganha `acoes: { tentar: boolean; dispensar: CampoNome[]; motivoSemBotao: string | null }` (`FaixaOk` não tem).
  - `export function faixaTentando(rs: RestoreStatus, ctx: CtxFaixa): Faixa | null` — a faixa com os campos de `camposPendentes(rs, 'humano')` trocados por `em_andamento` com `em = ctx.agora` (o que a tela mostra enquanto "Tentar agora" corre: P4b-E1).

Frases (cópia do mockup, estados C, D, D2, H, I; `h` = `horaSP(c.em)`, `hp` = `HH:MM` de `proximaVerificacao(agora)` em SP, `n = c.attempts + 1`):
- `falhou` (C e D2): `` `O YouTube recusou em ${h}. Nova tentativa automática por volta das ${hp} (horário de São Paulo), tentativa ${n} de 3.` ``
- `falhou` com `simAindaVale` (D): `` `O YouTube recusou em ${h}. Nova tentativa automática por volta das ${hp} (horário de São Paulo), sem perguntar de novo: ela repete a troca que você confirmou.` ``
- vigia atrasado: o trecho `por volta das ${hp} (horário de São Paulo)` vira `na próxima verificação` (nota do mockup C).
- `falhou` sem erro de escrita (hoje cai em `semResposta`, `:105`): mantém a frase de A3 e acrescenta ` Nova tentativa automática …` com a mesma regra. `// TEXTO-A-REVISAR` (composição de frases aprovadas).
- `desistiu`/`tres_falhas` (H): `lbl: 'Erro:'`, `resumo: `a restauração falhou 3 vezes e parou. ${cap} no ar ainda é ${o} da variante ${ctx.noArAntes}.``, linha `` `Última recusa do YouTube em ${h}. Não haverá nova tentativa automática.` ``, tom `err`, link do Studio.
- `desistiu`/`antes_da_nova_tentativa` (sem mockup): `lbl: 'Sem nova tentativa:'`, `resumo: 'a restauração falhou antes da nova tentativa automática existir. Confira no YouTube Studio.'`, linha `` `Não foi restaurado. Parou em ${h}.` ``, tom `none`, link. `// TEXTO-A-REVISAR`
- Sem permissão (I): destino variante e `!podeAdministrar` → `acoes = { tentar: false, dispensar: [], motivoSemBotao: 'Só quem administra o site pode tentar de novo ou dispensar este aviso.' }`.
- `fine` (`NAO_DISPENSA`) some de todos os estados.
- `acoes.tentar` = existe campo em `camposPendentes(rs, 'humano')`; `acoes.dispensar` = campos com `podeDispensar`.

- [ ] **Passo 1: testes que falham:** `C: "tentativa 2 de 3" com attempts 1 e "07:00" com agora 08:00 UTC`; `C às 12:00 UTC → "17:00"`; `attempts 2 → "tentativa 3 de 3"`; `cota (attempts igual) → N igual`; `vigia atrasado → "na próxima verificação" e nenhuma hora`; `D com em de 47 h → frase "sem perguntar de novo"; com 49 h → frase de D2`; `H só com desistiu/tres_falhas, nunca com falhou attempts 2` (P4b-E2, nível do texto); `I sem admin → acoes vazias e motivoSemBotao`; `pulado_drift → dispensar ['thumbnail'], tentar false`; `desistiu/novo_teste → tentar false, dispensar com o campo`; `nenhuma faixa da P4b contém "Este aviso ainda não pode ser dispensado."`; `faixaTentando de C → tom busy e "Voltando ao original…"` (frase de A1, `frasesBusy`).
- [ ] **Passo 2:** rodar → FAIL. **Passo 3:** implementar. **Passo 4:** rodar → PASS.
- [ ] **Passo 5:** lista do A/B, `tsc`; commit `feat: P4b, texto da faixa com nova tentativa, 3 falhas e permissão`.

### Tarefa 8: os botões na faixa

**Files:**
- Create: `AB/_components/faixa-com-acoes.tsx` (`'use client'`)
- Modify: `AB/_components/faixa-restauracao.tsx` (prop opcional `children`, desenhada depois do link do Studio)
- Modify: `AB/_components/faixa-da-pagina.ts` (passa `vigiaUltimaExecucao`, `podeAdministrar`; devolve também `faixaTentando`)
- Modify: `AB/[testId]/page.tsx:89-93`
- Test: **novo** `T/youtube/faixa-com-acoes.test.tsx` (`// @vitest-environment jsdom`)

**Interfaces:**
- Consumes: Tarefa 5 (`retryRestore`, `dismissRestore`, ligados ao id na página com `.bind(null, id)`, nunca importados no cliente: CLAUDE.md), Tarefa 7 (`acoes`, `faixaTentando`).
- Produces: `export function FaixaComAcoes(p: { testId: string; faixa: Faixa; faixaTentando: Faixa | null; seqVisto: number; tentar: (seqVisto: number) => Promise<ResultadoAcaoSaida>; dispensar: (campos: CampoNome[], seqVisto: number) => Promise<ResultadoAcaoSaida> })`.

Decisões: `podeAdministrar` vem do servidor (a página resolve com a mesma checagem que `denyUnlessSiteAdmin` usa,
sem gravar auditoria) [INFERÊNCIA: o executor confere se `apps/web/lib/cms/auth-guards.ts` expõe uma leitura sem
efeito; se não, usa `useCanAdminSite()` dentro da ilha e a faixa recebe `podeAdministrar` por prop do cliente].
`vigiaUltimaExecucao` = `updated_at` da linha `ab-watchdog` de `getCronHealth` (`apps/web/src/lib/cron-health.ts:53`),
nulo se não houver linha. Os botões usam as classes do mockup (`btn pri sm`, `btn sm`) mapeadas para as do CMS (`BTN_SAIDA`,
`AB/_components/acoes-de-saida.tsx:13`), alvo de toque 44 px em `(pointer:coarse)`. Enquanto a ação corre: os dois
botões `disabled`, `aria-busy`, e a ilha desenha `faixaTentando` no lugar da faixa. Resultado: `ok` → `router.refresh()`;
erro → `definirAviso(testId, r.error)` (`acoes-de-saida.tsx:26`) e `router.refresh()`.

- [ ] **Passo 1: testes que falham:** `C mostra "Tentar agora" e "Já corrigi no YouTube: dispensar aviso"`; `E e F só o dispensar`; `I sem botões e com a frase de permissão`; `duplo clique em Tentar agora → tentar chamado 1 vez; durante a promessa os dois botões disabled e a faixa mostra "Voltando ao original…"` (P4b-E1, nível do componente); `erro em_andamento → definirAviso com MSG_EM_ANDAMENTO`; `dispensar chama com a lista acoes.dispensar e o seqVisto`.
- [ ] **Passo 2:** rodar → FAIL. **Passo 3:** implementar. **Passo 4:** rodar → PASS.
- [ ] **Passo 5:** lista do A/B, `tsc`; commit `feat: P4b, botões Tentar agora e dispensar na faixa`.

### Tarefa 9: dívidas da P4a que caem na mesma tela

**Files:**
- Modify: `Y/ab-resume.ts:140-148` (PODE-1 no retomar: mesma conversão da Tarefa 3 antes da reivindicação)
- Modify: `AB/actions.ts` (`resumeAbTest(testId, seqVisto)`, `revertWinner(testId, seqVisto)`), os chamadores na tela [INFERÊNCIA: `AB/_components/active-detail.tsx`, `winner-detail.tsx`; achar com `grep -rn "resumeAbTest\|revertWinner" AB`]
- Modify: `AB/_components/ab-pause-dialog.tsx` (Pausar com diálogo fechado em `unauthenticated`/`catch`: `!montado.current` → `onAviso` + `router.refresh`, espelho do D-1 da P4a)
- Test: `T/ab-actions-resume.test.ts`, `T/youtube/ab-pause-dialog.test.tsx` [INFERÊNCIA no nome], `T/integration/ab-p4a-retomar-iniciar.test.ts` (caso novo)

- [ ] **Passo 1: testes que falham:** `retomar com seqVisto velho → mudou, nada escrito` (Y-5); `reverter com seqVisto velho → mudou`; `retomar com thumbnail em_andamento de 3 min → ab_test_restores ganha falhou/escreveu null com o em antigo; teste active` (PODE-1, integração); `Pausar: diálogo fechado e resposta unauthenticated → aviso de página e refresh`.
- [ ] **Passo 2:** FAIL. **Passo 3:** implementar (`settleOnAir` já aceita `seqEsperado`; `retomarTeste` ganha o mesmo parâmetro). **Passo 4:** PASS.
- [ ] **Passo 5:** lista do A/B, integração da P4a e da P4b, `tsc`; commit `fix: P4b, dívidas da P4a (seqVisto em retomar e reverter, PODE-1 no retomar, Pausar silencioso)`.

### Tarefa 10: textos marcados e captura para o dono

**Files:** os `// TEXTO-A-REVISAR` (Tarefas 3, 4, 7).

- [ ] **Passo 1:** `grep -rn "TEXTO-A-REVISAR" apps/web/src` → lista para o Logan (Sonnet, `medium`), com o mockup e as frases vizinhas; ele devolve o texto final por linha.
- [ ] **Passo 2:** aplicar; o controlador leva ao dono as frases que não estão no mockup (emenda 31), com a recomendação do Logan; o envio não sai sem resposta (pergunta Q2).
- [ ] **Passo 3:** `grep -rn "TEXTO-A-REVISAR" apps/web/src` → vazio; commit `docs: P4b, textos fechados pelo Logan`.

### Tarefa 11: prova local (Gio)

**Files:** **novo** `apps/web/e2e/ab-lab-p4b-e01-e02-faixa.spec.ts` (usa `apps/web/e2e/ab-lab-p4a.config.ts` e `ab-lab-p4a-suporte/`), semente em `apps/web/e2e/ab-lab-p4a-suporte/` [INFERÊNCIA: a semente da P4a mora nessa pasta].

- [ ] **Passo 1:** sementes: T-falhou-C (`title` falhou attempts 1), T-falhou-D (`forcado` true, `em` de 1 h, destino variante), T-H (`desistiu`/`tres_falhas`), T-E (`pulado_drift`), T-F, T-G, T-I (destino variante, usuário editora sem admin). YouTube mockado (o runbook `docs/ops/runbook-cms-e2e-local.md`: nenhum passo clica em escrita com vídeo real).
- [ ] **Passo 2:** spec P4b-E1 e P4b-E2: textos exatos do mockup (versão P4b) por estado; "Tentar agora" em C, D, D2, H; dispensar em C, D, D2, E, F, G, H; I sem botões; duplo clique = uma chamada (contador no mock do YouTube) e faixa em andamento com botões desabilitados; hora calculada (relógio do navegador fixado em 08:00 UTC → "07:00"; em 12:00 UTC → "17:00"; em 23:00 UTC → "07:00"); "tentativa N de 3" por semente. Rodar 3× nos 4 projetos do config da P4a (claro, escuro, 390 px, 1440 px) com saída em arquivo.
- [ ] **Passo 3:** suíte inteira em background (`npx vitest run > /tmp/ab-p4b-suite.log 2>&1`, ~160 s), integração da P4a e da P4b, `next build` com `.env.local` copiado como `.env.production.local` e apagado no fim (precedente da T17 da P4a). Só falhas entram no contexto.
- [ ] **Passo 4:** capturas para Logan e Naksu (Sonnet), arquivos em `docs/superpowers/mockups/2026-10-14-ab-lab-p4-dialogo-e-faixa/p4b-implementado-shots/`; os dois concordam antes do dono ver; o dono aprova a captura (aceite 5.2, item 3).

### Tarefa 12: revisão do lote

- [ ] Phil e Yannis (Opus, `medium`) sobre o diff inteiro do lote contra este plano e o aceite §5; conserto em rodada de executor (Sonnet); re-revisão de emenda em Sonnet. Fecha com acordo dos dois.

## Parte B: os avisos da A5 (não tocam rotação, `settleOnAir`, drift nem avaliação)

### Tarefa 13: barreiras do assistente (avisos A5 1, 6 e 8)

**Files:**
- Modify: `AB/actions.ts:136-147` (`createAbTest` passa a barrar `queued`), `:123,129,133,147` (mensagens em português)
- Modify: `AB/queries.ts:322` (`hasActiveTest` inclui `queued`)
- Modify: `AB/new/page.tsx` (reporter: `redirect` para a lista do A/B Lab em vez de cair no `error.tsx`) [INFERÊNCIA: o `requireEditAccess` da página lança; o executor confere onde]
- Test: `T/ab-actions-create.test.ts`, `T/ab-dashboard-queries.test.ts`, `T/ab-new-page.test.tsx` (casos novos)

Mensagens (`// TEXTO-A-REVISAR`, vão ao Logan na Tarefa 10): `'Vídeo não encontrado.'`; `'Shorts (até 60 s) não entram no A/B Lab.'`; `'Este vídeo ainda não tem thumbnail no Lab. Sincronize os vídeos e tente de novo.'`; `'Já existe um teste aberto, pausado, na fila ou em rascunho para este vídeo.'`.

- [ ] **Passo 1: testes que falham:** `createAbTest com teste queued no mesmo vídeo → recusa com a frase nova, nada criado`; `picker: vídeo com teste queued → hasActiveTest true`; `Short e sem thumbnail → frases em português`; `reporter em ab-lab/new → redirect para /cms/youtube/ab-lab`.
- [ ] **Passo 2:** FAIL. **Passo 3:** implementar. **Passo 4:** PASS; lista do A/B, `T/ab-new-*.test.ts*`, `tsc`.
- [ ] **Passo 5:** commit `fix: A/B Lab, barreiras do assistente (queued, Short, sem thumbnail, reporter)`.

### Tarefa 14: o rascunho local não passa por cima do `prefill` (aviso A5 2)

**Files:** Modify `AB/_components/ab-create-wizard.tsx:258-287`; Test `T/ab-wizard-variante-vazia.test.tsx:37`.

Regra: com `prefill.testType` presente, o rascunho local só é restaurado se `saved.type === prefillType`; senão é
ignorado (variante B nasce vazia, passo do `prefill`). Sem `prefill`, comportamento de hoje.

- [ ] **Passo 1:** trocar `it.fails` por `it` em `T/ab-wizard-variante-vazia.test.tsx:37` e acrescentar `rascunho local do MESMO tipo continua restaurado`. Rodar → o primeiro FAIL.
- [ ] **Passo 2:** implementar. **Passo 3:** PASS; lista do A/B, `tsc`; commit `fix: A/B Lab, rascunho local não passa por cima do tipo pedido`. Avisar a sessão da A5 no fecho (o `it.fails` era deles).

### Tarefa 15: uma função só para o "dia do teste" (aviso A5 5)

**Files:** Create `Y/ab-dia-do-teste.ts`; Modify `AB/queries.ts:432-435`, `AB/_components/active-test-card.tsx:52`, `AB/_components/active-detail.tsx` (conta própria; ver seção 2); Test **novo** `T/youtube/ab-dia-do-teste.test.ts`.

**Interfaces:** `export function diaDoTeste(startedAt: string | null, fimIso: string | null, agora: Date): number | null` — dias inteiros (`floor`) desde `started_at` até `fim ?? agora`; nulo sem `started_at` ou com data ilegível (nunca `NaN`). `export function duracaoPrevista(config: { max_duration_days?: number } | null): number` [INFERÊNCIA: nome do campo de duração em `config`; o executor confere em `Y/ab-types.ts`]; o cartão deixa de usar o `14` fixo.

- [ ] **Passo 1: testes que falham:** `started 3,5 dias atrás → 3`; `fim antes do agora usa o fim`; `nulo/ilegível → null`; `os três chamadores devolvem o mesmo número para o mesmo teste` (render dos dois componentes com a mesma `view` e `toActiveList`).
- [ ] **Passo 2:** FAIL. **Passo 3:** implementar e trocar os três. **Passo 4:** PASS; lista do A/B, `tsc`; commit `refactor: A/B Lab, conta única do dia do teste`.

### Tarefa 16: gravar a referência do concorrente no teste (aviso A5 3)

**Files:** Modify `Y/ab-types.ts` (`AbTestCreateInput.referencia?`), `AB/actions.ts:95-` (`createAbTest` grava `config.referencia`), `AB/new/client.tsx:96` (o assistente passa a referência adiante); Test `T/ab-actions-create.test.ts`, `T/ab-new-client.test.tsx`.

**Interfaces:** `referencia?: { refVideoId: string | null; refTroca: string | null; tipo: TipoTroca }` validada com Zod
(`refVideoId` uuid, `refTroca` por `refTrocaValida`, `Y/ab-referencia.ts`); grava `config.referencia` só com esses três
campos (dado público, pequeno, some com o teste em cascata: Phil M-6). Sem título nem URL de imagem (restrição da A5:
nada de URL de imagem que o pacote "Perguntar a uma IA" monta).

- [ ] **Passo 1: testes que falham:** `createAbTest com referencia válida → config.referencia com os três campos`; `referencia com campo extra ou uuid inválido → gravada sem ele / descartada, teste criado`; `sem referencia → config sem a chave`; `cliente: assistente aberto pelo Observatório envia a referência no createAbTest`.
- [ ] **Passo 2:** FAIL. **Passo 3:** implementar. **Passo 4:** PASS; lista do A/B, `T/ab-new-*`, as duas varreduras do "Perguntar a uma IA" (`contexto-ia-varredura-de-saida.test.ts`, `contexto-ia-varredura-de-codigo.test.ts`), `tsc`; commit `feat: A/B Lab, referência do concorrente gravada no teste`.

---

## 4. Envio (preso ao G0)

1. **Portão G0:** E8 do ensaio da P4a concluído e registrado no ledger da P4a. Antes disso: nada a `staging`.
2. **Revisões fechadas** (Tarefa 12), textos fechados e respondidos pelo dono (Tarefa 10), capturas aprovadas (Tarefa 11).
3. **Leitura de produção (o dono roda; o agente prepara `comandos/p4b-leitura-prod.sh`, só `select`):** quantos campos
   `falhou` existem hoje (`select id, status, restore_status from ab_tests where restore_status->'title'->>'estado' = 'falhou' or restore_status->'thumbnail'->>'estado' = 'falhou'`)
   e se algum teste está `active` com campo em `falhou` (esperado 0). Resultado no ledger.
4. **Migration do corte** (aditiva de dado, irreversível só no sentido de que `falhou` vira `desistiu`; `dismiss` e
   "Tentar agora" continuam valendo para o campo):
   - Numa árvore em dia com `origin/staging`: `npm run db:new ab_lab_p4b_corte_da_nova_tentativa`; copiar o corpo de
     `apps/web/test/integration/fixtures/ab-p4b-corte.sql`; `cmp` entre os dois → idêntico.
   - `npm run db:push:prod -- --dry-run` [INFERÊNCIA: a forma exata do dry-run é a do script da P4a, `comandos/` do
     ledger da P4a] mostra **uma** pendente, a nossa.
   - Janela: **fora** de 11:30-13:00 UTC e dos minutos 0-4, 20-24, 30-34 e 40-44 de qualquer hora; nunca a 10 min do
     vigia (10:00 e 20:00 UTC) nem das janelas de promoção do Phil (07:50-08:10, 09:50-10:10, 11:50-12:10, 19:50-20:10 UTC).
   - **Vez proposta na fila** `.superpowers/sdd/a5/fila-do-db-push.md` (só proposta, não reservada): depois da S4 da A5
     e da S7 fase 1 do A/B que já estiverem em `origin/staging` (o carimbo tem de ser posterior ao último arquivo), no
     dia do envio da P4b (19/10 depois do E8, ou depois), antes de 29/10 23:59 UTC. Texto para a fila: "(A/B P4b) corte
     da nova tentativa, `ab_lab_p4b_corte_da_nova_tentativa`, só dado (`falhou` → `desistiu`), sozinha, logo antes do
     push do código da P4b; avisa a A5 antes."
   - Ordem: migration **minutos antes** do push (entre os dois, a faixa da P4a mostra "não sabemos" para o motivo novo;
     o inverso deixaria o vigia da P4b tentar um erro velho se uma execução das 10:00/20:00 caísse no meio).
5. **Push a `staging`** (a P4a combinou avisar a A5 antes de levar código do A/B; ledger da P4a linha 128), CI verde,
   **promoção** fora das janelas de promoção acima. Conferência depois: a próxima execução do vigia (10:00 ou 20:00 UTC)
   responde `nova_tentativa` com os sete contadores, `duration_ms` < 60 s em `cron_health` (aceite 5.2, itens 1 e 2),
   duas execuções seguidas sem falha. O ledger diz literalmente: "botões, nova tentativa e `desistiu`: **não verificados
   em produção**" (aceite 5.2, item 3).
6. **Aviso à fase 2 da S6/S7** (quando for planejada): a tabela de ganchos (spec S6/S7 §6.4) ganha a linha
   "nova tentativa (vigia e `retryRestore`): com bloqueio, não reivindica, não escreve, **não gasta tentativa**; o vigia
   conta em `ignorados`; `retryRestore` recusa com a frase da guarda". `novaTentativa` passa por `restaurarCampos`, então
   a asserção de `PasseGuarda` a cobre; o `dispensarCampos` não escreve no YouTube e fica fora da guarda.

## 5. Horas (estimativa do controlador; base: P4a)

| Bloco | Agentes | Dono |
|---|---|---|
| Revisão do plano (Phil + Yannis, 1-2 rodadas) | 1,5 a 2,5 h | 5 min ("pode") |
| Parte A, Tarefas 1-9 | 6 a 9 h | — |
| Tarefa 10 (textos) e 11 (Gio, capturas, suíte) | 2 a 3 h | 15 min (frases novas, aprovar capturas) |
| Tarefa 12 (revisão do lote) | 1,5 a 2,5 h | — |
| Parte B, Tarefas 13-16 | 2,5 a 4 h | — |
| Envio (leitura, migration, push, conferência) | 1 h | 10 min (rodar a leitura; ok da migration) |
| **Total** | **14,5 a 22 h** | **~35 min** |

O roteiro (etapa 14) estimava 6,5 a 10 h só para a P4b; a diferença é a Parte B (avisos da A5, aprovada em 18/10) e as
dívidas da P4a da Tarefa 9.

## 6. Perguntas ao dono (cada uma com a minha recomendação e o custo)

- **Q1. O corte do `falhou` antigo (P4b-I4) por migration de dado?** Recomendo **sim**: uma vez na fila do banco, só
  dado, testada no `bythiago_int`; é o único jeito de "anterior ao deploy" ser exato. Custo do não: código que compara o
  `em` com uma data fixa escrita no commit, que erra para o que falhar entre o commit e o deploy.
- **Q2. Frases sem mockup** (motivo `antes_da_nova_tentativa` na faixa; aviso de "falhou 3 vezes"; recusa "outro teste
  aberto neste vídeo"; mensagens do assistente em português): recomendo o Logan fechar e você aprovar **em bloco**, por
  texto, sem novo mockup. Custo: 10 min seus; sem isso o envio espera.
- **Q3. A Parte B (avisos da A5) vai no mesmo envio da P4b, depois do E8?** Recomendo **sim**: o E8 é amanhã, o ganho
  de ir antes é menos de um dia, e cada push custa 4 builds. Custo: os quatro consertos do assistente esperam o E8.
- **Q4. "Tentar agora" e "dispensar" também pelo Cowork (pipeline e MCP)?** Recomendo **não agora**: a leitura já tem
  paridade (o `GET` traz `restore_status`); as duas ações escrevem no YouTube e pedem chave por pessoa com uso
  registrado. Custo: pelo Cowork você vê a falha mas resolve na tela.
- **Q5. Ficam fora, com gatilho:** abrir rascunho por id (aviso A5 4; desnecessário com o padrão "link para a lista") e o
  curinga do Blob (aviso A5 7; gatilho: apertar a CSP). Recomendo **deixar fora**. Custo: nenhum comportamento muda hoje.

## 7. Riscos

- **Orçamento de 60 s do vigia:** a fase nova só começa tentativas até 15 s do início; num dia com drift lento ela
  adia tudo (e grava falha do cron). Com dezenas de testes, o atraso é de uma execução (10 a 14 h), não perda.
- **O "sim" renovado:** cada nova tentativa grava `em` novo, e o "sim" de 48 h passa a contar dele (o spec diz "a partir
  do `em` do campo"). Pelo vigia a cadeia acaba em ~1 dia (3 falhas que contam); pelo "Tentar agora" o dono renova
  clicando. A cota (que não conta) pode esticar a cadeia. Decisão para o Yannis: aceitar, ou contar as 48 h do primeiro
  `em` com `forcado` da cadeia em `ab_test_restores`.
- **Fase 2 da S6/S7:** se ela entrar antes deste lote, a `novaTentativa` precisa do passe da guarda (item 6 do envio);
  se entrar depois, ela acrescenta o gancho. Quem chegar segundo faz.
- **Sobreposição de avisos:** a falha original avisa por `restore_seq` (P4a) e a primeira nova tentativa no mesmo dia
  avisa pela chave diária: até dois avisos no primeiro dia. Declarado; o Logan pode juntar os textos.
- **Leitura de produção** pelo agente é negada no modo automático: a Seção 4 depende do dono rodar a leitura.
