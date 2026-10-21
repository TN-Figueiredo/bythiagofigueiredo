# F1a-dado (backend do caminho nativo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

- **Estado:** r1 (1º rascunho, 21/10/2026, Opus). Para revisão de Phil e Yannis (e Hanna na amarração do envio). **Não libera código nem migration aplicada** até o acordo deles.
- **Goal:** pôr no ar, sem tela, tudo o que o caminho nativo precisa no banco e no servidor (migration da F1a, ficha gravada, "Já iniciei", marcador, "Não é teste", resposta do dia 14, lembrete e fechamento, guarda nos pontos de escrita do nosso teste atrás de `AB_PAUSA_POR_DETECTADO` em `log`, roteador nativo × nosso) e o registro "teste nativo observado" dos concorrentes.
- **Architecture:** núcleo puro em `lib/youtube/teste-youtube/nativo/` (sem banco), bordas finas com portas injetáveis (mesmo molde de `ab-resume.ts`), duas funções plpgsql para o que precisa de atomicidade (`ab_native_ficha_abrir`, `ab_native_iniciar`), server actions finas num arquivo novo do A/B Lab, uma tarefa nova na agenda (`avisos_pendentes`) e um passo novo dentro da tarefa `registro_teste_nativo` para os concorrentes (§5.8, isolado na Tarefa 13).
- **Tech Stack:** Next.js 16 (server actions), Supabase (Postgres 17, plpgsql, RLS), Vitest, Zod.
- **Spec:** `docs/superpowers/specs/2026-10-21-sugestoes-do-nicho-e-ab-nativo-design.md` (r10; §5.1, §5.2, §5.3, §5.8, §7 linha F1a-dado, §8). Glossário: `docs/superpowers/specs/2026-10-21-glossario-caminho-nativo.md`.
- **Código de referência:** `origin/main` b75595690 (o checkout local está atrás). Toda linha citada abaixo é de lá; no dia do código, refazer o `git grep`.

## Global Constraints

- Migration só por `npm run db:new <nome>`; idempotente (`drop ... if exists` antes de `create policy/trigger`, `create ... if not exists`, `create or replace function`); `set lock_timeout = '5s'` no topo, como `20261018000006`.
- Funções de banco novas: `plpgsql`, `security invoker`, `set search_path = ''`, `revoke all ... from public, anon, authenticated; grant execute ... to service_role`. Nunca chamar sem EXECUTE no banco local (SIGSEGV, memória `reference_banco_local_integracao`): testar permissão com `has_function_privilege`.
- RLS de leitura das tabelas novas: `public.can_edit_site(site_id)`; `insert/update/delete` revogados de `authenticated`; teste que falsifica o GUC `app.site_id` como não-superusuário (memória `reference_rls_guc_spoof_pattern`).
- Toda server action nova: `requireEditUser()` no topo (decisão de Yannis, §5.2: mesmo critério das demais ações de edição do Lab), `getSupabaseServiceClient()` só depois; todo `where id = :id` leva `site_id` do contexto (id de outro site → "não encontrado", zero linhas).
- Classificação de linha: **confirmada = `confirmado_em is not null`**, detectada = `confirmado_em is null`; nunca por `origem`.
- Flag `AB_PAUSA_POR_DETECTADO`: valores `off | log | on`; ausente ou desconhecido = `off`; **`log` nunca toca `status_note`**; ação do `audit_log` = `ab_pausa_detectado_log`. Sobe em `log` (variável no Vercel **antes** do deploy). `on` sem o botão "Não é teste" (F1a-tela-1) é proibido.
- Prazo do nativo: `RULES.testCompareMaxDays` (14, `lib/youtube/observatorio/rules.ts:21`) + margem nomeada `MARGEM_FECHAMENTO_DIAS = 2`.
- Notificação: `fanOutToSiteAdminsDetailed`; lembrete do dia 14 com `defaultChannels: ['email']` (nunca `channels`); "Lembrar no computador" com `createNotification` para o próprio usuário. `dedup_key`: `'ficha-lembrar:' || ficha.id`, `'lembrete-nativo:' || registro.id`. Payload só com ids.
- `action_href` até a F1a-tela: `/cms/youtube/ab-lab?video=<youtube_video_id>` (a página do Lab ignora o parâmetro hoje e abre o painel; a F1a-tela-1 passa a lê-lo). Não apontar para ficha nem cartão S7.
- Sem `any`; Zod em toda entrada de action. Arquivos kebab-case.
- Testes de integração: `describe.skipIf(skipIfNoLocalDb())`, banco `bythiago_int` (API 54421, Postgres 54422), sem paralelismo entre arquivos; a suíte de integração roda com `AB_PAUSA_POR_DETECTADO='on'` no `beforeAll`.
- Envio: ≤ 3 pushes/dia/terminal até 27/10 (crédito Vercel); push combinado com a promoção da A5 (§7). Commits com `--no-verify` só se o hook falhar em arquivo de outro terminal (memória).

## Review Focus

1. **`forceRotate` (`ab-lab/actions.ts:997`) escreve no YouTube e não está nos 3 pontos do spec.** Com linha confirmada aberta, "Forçar rotação" cancelaria o teste nativo. Esperado: recusa com o mesmo motivo de `startAbTest`. Teste na Tarefa 6 (decisão além do spec, para Yannis confirmar).
2. **Fila e playoff entram por `startAbTestInternal`** (`ab-rotate-phases.ts:98` `phaseProcessQueue`, `ab-evaluate-phases.ts:37`, `batchStartTests`). Uma recusa por teste nativo não pode gastar `MAX_TENTATIVAS_DA_FILA` (7) e matar o teste da fila em 7 dias. Esperado: adia sem contar tentativa, com motivo. Teste na Tarefa 6.
3. **Fronteira do dia 14 por relógio, não por dia de calendário.** `inicio + 14 d` a 13 d 23 h não lembra; a 14 d 0 h lembra; o fechamento a 15 d 23 h não fecha, a 16 d fecha. Testes com relógio injetado na Tarefa 12.
4. **Entrada hostil na ficha:** URL de imagem fora do Blob, `sha256` malformado, título acima de 100 caracteres (limite do YouTube), `n` repetido ou fora de 1..3. Esperado: Zod recusa com motivo, nada gravado. Testes na Tarefa 8.
5. **Registrador e ação na mesma linha ao mesmo tempo** ("Não é teste", "Confirmar", resposta do dia 14): o CAS por `updated_at` perde por simples atualização de evidência. Esperado: uma releitura e sucesso se ainda elegível; nunca erro cru. Testes nas Tarefas 9, 10 e 11.

## Falha em verde: o que cada gravação faz quando o dado não existe

| Gravação | Dado ausente | Comportamento exigido (teste na tarefa) |
|---|---|---|
| `ab_native_fichas` (abrir) | vídeo sem linha em `youtube_videos` | FK recusa; action devolve "não encontrado" (T8) |
| Ficha "Já iniciei" | ficha com < 2 variantes ou campos vazios | `ficha_incompleta`, nada gravado (T2) |
| Marcador / pausa | teste nosso sem `restore_seq` lido | `settleOnAir` devolve `ja_encerrado`; marcador continua aceito (T9) |
| Guarda (3 pontos + forçar + fila) | consulta em lote falha | falha fechada: erro de banco recusa `start`/`retomar` com motivo "não foi possível conferir o teste do YouTube" e a rotação pula o teste no ciclo (sem escrever), com Sentry; nunca "sem bloqueio" calado (T5, T6) |
| `audit_log` do `log` | insert falha | log de erro e Sentry; a rotação segue escrevendo como hoje (o `log` é medição, não guarda) (T6) |
| Lembrete do dia 14 | `total === 0` no fan-out | conta tentativa; na 3ª, `notificacao_falhou_em` e tarefa vermelha (T12) |
| Fechamento `sem_resposta` | nenhuma linha vencida | `estado: 'ok'` com `detalhe.fechados = 0` (zero é medida, não falha) (T12) |
| Formato do vídeo | sem meta, sem bruto | `null`, terceiro estado "formato não confirmado"; nunca `false` (T7) |
| `ab_native_observados` | sem troca vista, < 2 leituras válidas, leituras com erro | **nenhuma linha** (nunca "0 versões") (T13) |

---

### Task 0: Preparação (controlador, sem código)

- [ ] **Step 1:** Worktree a partir de `origin/staging` (não trocar o checkout dos outros terminais; nunca stash/reset): `git worktree add ~/Workspace/wt-f1a-dado origin/staging --detach`. Commits vão para staging por `bash -c 'git push origin HEAD:staging'` só nos envios desta seção.
- [ ] **Step 2:** Conferir a regra de §7: `git diff --name-only origin/main...<HEAD de cada worktree ativo da A5> | grep -E "ab-lab|teste-youtube|ab-settle|ab-rotate|ab-resume|ab-start|agenda/(definicoes|catalogo)|notifications"`. Vazio = pode codar. Colar o resultado no ledger `.superpowers/sdd/ab-lab/f1a-dado/progress.md`.
- [ ] **Step 3:** Subir o banco de integração (memória `reference_banco_local_integracao`) e confirmar no 54422: `select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.ab_native_tests'::regclass and contype = 'c' order by conname;` → `ab_native_tests_check3` = `CHECK (((vencedor_titulo IS NULL) = (vencedor_fonte IS NULL)))`. Se o nome diferir, parar e avisar (a Tarefa 1 depende dele).
- [ ] **Step 4:** Resposta ao "[a conferir]" de Hanna (§5.2), feita neste plano: `git grep -n "confirmado" origin/main -- apps/web/src` não acha nenhum caminho que grave `confirmado_em` ou `origem: 'confirmado'` (o registrador só insere `detectado`, `registro/tarefa.ts:286`). Reconferir no dia e anotar no ledger.

Estimativa: ~15 mil tokens.

---

### Task 1: Migration da F1a-dado: colunas, troca do CHECK, `ab_native_fichas`

**Files:**
- Create: `supabase/migrations/<ts>_ab_lab_f1a_dado.sql` (por `npm run db:new ab_lab_f1a_dado`)
- Test: `apps/web/test/integration/ab-f1a-migration.test.ts`

**Interfaces:**
- Produces: colunas novas em `ab_native_tests`: `lembrete_notificado_em timestamptz`, `resposta_dono text check (resposta_dono in ('venceu_nova','ficou_igual','inconclusivo','nao_vi','sem_resposta'))`, `variante_vencedora smallint check (variante_vencedora between 1 and 3)`, `respondido_em timestamptz`, `notificacao_tentativas smallint not null default 0`, `notificacao_falhou_em timestamptz`, `variantes jsonb check (variantes is null or (jsonb_typeof(variantes)='array' and jsonb_array_length(variantes) between 2 and 3))`. CHECK novo `ab_native_tests_vencedor_com_fonte`: `(vencedor_fonte is null) = (vencedor_titulo is null and variante_vencedora is null)`. Tabela `ab_native_fichas` exatamente como §5.3 (colunas, CHECKs, `registro_id unique` com FK `on delete set null`, índice `ab_native_fichas_recente (site_id, video_id, criada_em desc)`, único parcial `ab_native_fichas_uma_aberta`). Constante `F1A_DADO_DESDE` = o timestamp da migration (o lembrete só vale para `created_at >=` ela; Tarefa 12).

- [ ] **Step 1: teste que falha** (`ab-f1a-migration.test.ts`, gated): (a) `pg_constraint` não tem `ab_native_tests_check3` e tem `ab_native_tests_vencedor_com_fonte`; (b) insert de linha `encerrado` com `vencedor_fonte='dono'`, `variante_vencedora=2`, `vencedor_titulo null` passa ("Venceu a nova" só de miniatura); (c) `vencedor_fonte='dono'` sem título nem variante é recusado (23514); (d) `variante_vencedora` sem fonte recusado; (e) ficha com `variantes='[]'` e `campos='{}'` passa (rascunho); ficha com 4 variantes recusada; `campos` com `'descricao'` recusado; (f) segunda ficha aberta no mesmo `(site_id, video_id)` → 23505; com a primeira descartada, passa; (g) RLS: como `authenticated` com GUC `app.site_id` falsificado para o site, sem papel de edição, `select` em `ab_native_fichas` volta 0 linhas; `insert` como `authenticated` recusado (42501); (h) `explain` de `select ... where site_id = $1 and video_id = $2 order by criada_em desc limit 1` usa `ab_native_fichas_recente`.
- [ ] **Step 2:** rodar `HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres npx vitest run test/integration/ab-f1a-migration.test.ts` (de `apps/web`) → FAIL (tabela ausente).
- [ ] **Step 3: escrever a migration.** A troca do CHECK é **guardada**, não `drop if exists` por palpite:
  ```sql
  do $$ begin
    if exists (select 1 from pg_constraint where conrelid = 'public.ab_native_tests'::regclass and conname = 'ab_native_tests_check3'
               and pg_get_constraintdef(oid) <> 'CHECK (((vencedor_titulo IS NULL) = (vencedor_fonte IS NULL)))') then
      raise exception 'ab_native_tests_check3 não é o CHECK de vencedor esperado; abortar';
    end if;
  end $$;
  alter table public.ab_native_tests drop constraint if exists ab_native_tests_check3; -- seguro: o bloco acima já conferiu a definição
  ```
  (idempotência: reaplicar não acha o `check3` e o `add constraint` do novo vai num `do` que confere `conname` antes). RLS e `revoke` como em `20261018000006`.
- [ ] **Step 4:** aplicar no 54422 por `psql -f` e registrar a versão em `supabase_migrations.schema_migrations`; rodar o teste → PASS; reaplicar o arquivo inteiro uma 2ª vez → sem erro.
- [ ] **Step 5:** commit `feat: migration da F1a-dado (colunas do dia 14, CHECK de vencedor, ab_native_fichas)` só com os dois caminhos.

**Aceite:** os 8 itens do Step 1 verdes; reaplicação limpa. Estimativa: ~90 mil tokens.

---

### Task 2: Funções `ab_native_ficha_abrir` e `ab_native_iniciar`

**Files:**
- Modify: a migration da Tarefa 1 (ainda não aplicada em produção)
- Test: `apps/web/test/integration/ab-f1a-funcoes.test.ts`

**Interfaces:**
- Produces: `public.ab_native_ficha_abrir(p_site uuid, p_video uuid, p_usuario uuid) returns public.ab_native_fichas` e `public.ab_native_iniciar(p_site uuid, p_ficha uuid, p_usuario uuid) returns jsonb` com os retornos `{ok:true, registro_id, confirmou_detectado:boolean}`, `{ok:true, ja_iniciada:true, registro_id}`, `{erro:'nao_encontrada'}`, `{erro:'ficha_incompleta', motivo:'variantes'|'campos'}`, `{erro:'ja_ha_teste_em_andamento', registro_id}`, `{erro:'estado_mudou'}`. Os passos 1 a 5 de cada uma são os de §5.3, literalmente (inatividade por `greatest(criada_em, atualizada_em, studio_aberto_em, lembrar_em) < now() - interval '14 days'`; expiração de `ficha-lembrar:` na mesma transação; `on conflict ... where registro_id is null and descartada_em is null do nothing`; passo 3 com `not exists (select 1 from public.ab_native_fichas f where f.registro_id = t.id)`).

- [ ] **Step 1: testes que falham** (gated, relógio por `set local` não serve para `now()`: semear datas no passado): duas chamadas concorrentes de `ficha_abrir` (duas conexões `pg`) → uma linha aberta; ficha com `criada_em = now()-15d`, `studio_aberto_em = now()-3d` → continua aberta; ficha inativa há 15 d → `descartada_em` preenchido, nova aberta devolvida, e a notificação `ficha-lembrar:<id antigo>` ganha `expired_at`; `iniciar` duas vezes → um registro, a 2ª devolve `ja_iniciada`; com `detectado` aberto (semeado) → confirma a linha existente (`origem` continua `detectado`, `confirmado_em` preenchido, `variantes` copiadas da ficha), zero linha nova; ficha A iniciada e ficha B aberta no mesmo vídeo → B devolve `ja_ha_teste_em_andamento`, `variantes` de X intactas; ficha de outro site → `nao_encontrada`; 1 variante → `ficha_incompleta`; falha injetada no passo 4 (trigger de teste temporário que lança em `update ab_native_fichas`) desfaz o insert do passo 2; `has_function_privilege('authenticated', 'public.ab_native_iniciar(uuid,uuid,uuid)', 'execute')` = false e para `service_role` = true. O caso "registrador encerra a `detectado` entre o passo 2 e o 3" se prova com a linha já `encerrado` e nenhuma `em_andamento` ao chamar: devolve `estado_mudou` e a ficha fica sem `registro_id`.
- [ ] **Step 2:** rodar → FAIL. **Step 3:** escrever as funções. **Step 4:** reaplicar a migration no 54422, rodar → PASS.
- [ ] **Step 5:** commit `feat: funções da ficha e do "Já iniciei" (F1a-dado)`.

**Aceite:** todos os casos acima verdes. Estimativa: ~110 mil tokens.

---

### Task 3: Flag `AB_PAUSA_POR_DETECTADO`

**Files:**
- Create: `apps/web/src/lib/youtube/teste-youtube/nativo/flag.ts`
- Modify: `docs/ops/env-vars.md` (linha nova, ao lado de `AB_NATIVO_REGISTRO`)
- Test: `apps/web/test/youtube/teste-youtube/nativo/flag.test.ts`

**Interfaces:**
- Produces: `export type ModoPausaDetectado = 'off' | 'log' | 'on'`; `export function modoPausaPorDetectado(env: NodeJS.ProcessEnv = process.env): ModoPausaDetectado`.

- [ ] **Step 1: teste:** `delete process.env.AB_PAUSA_POR_DETECTADO` → `'off'`; `'log'` → `'log'`; `'on'` → `'on'`; `'ON'`, `'true'`, `'1'`, `''`, `' on'` → `'off'`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar (comparação exata, como `ligadaPorVariavel`, `agenda/definicoes.ts:270`). A linha de `env-vars.md` diz: valores, padrão `off`, "`log` só grava `ab_pausa_detectado_log` no `audit_log`", "`on` só no deploy da F1a-tela-1 com o botão Não é teste", "remover no plano da F1b (dono: controlador do A/B Lab; data: no fecho da F1b)". **Step 4:** PASS. **Step 5:** commit.

Estimativa: ~20 mil tokens.

---

### Task 4: `settleOnAir` com motivo `teste_youtube` (curto-circuito sem escrita)

**Files:**
- Modify: `apps/web/src/lib/youtube/ab-settle.ts` (`MotivoSaida` linha 22; `caminhoDe` linha 138; `settleOnAir` linha 487)
- Modify: `apps/web/src/lib/youtube/ab-restore.ts:7` (comentário: `pulado_teste_youtube` agora é escrito pela F1a) e `camposPendentes` (linha 176) só se o teste mostrar que precisa
- Test: `apps/web/test/youtube/ab-settle-teste-youtube.test.ts`; `apps/web/test/integration/ab-f1a-settle-ensaio.test.ts`

**Interfaces:**
- Produces: `MotivoSaida` ganha `'teste_youtube'`; `export const NOTA_TESTE_YOUTUBE = 'Em teste no Studio: pausado sem escrever no YouTube'`. `settleOnAir(id, { siteId, destino: ORIGINAL, motivo: 'teste_youtube' })` devolve `{ resultado: 'feito', campos }` com cada campo de `camposDoTeste(test_type)` = `montarCampo(..., { estado: 'pulado_teste_youtube', escreveu: false })`.

- [ ] **Step 1: testes (portas falsas que lançam se chamadas: `token`, `fetch`, `lerNoYouTube`, escrita):** (a) teste `active` → `status='paused'`, `paused_at`, `restore_seq+1`, `status_note = NOTA_TESTE_YOUTUBE`, todos os campos `pulado_teste_youtube`/`escreveu:false`, zero chamada de porta; (b) teste `paused` com restore `falhou` pendente → vira `pulado_teste_youtube` (o vigia não reescreve depois); (c) `seqEsperado` velho → `mudou` (humano) / `em_andamento` (cron); (d) restore `em_andamento` recente → `em_andamento`; (e) com B no ar (`last_applied_variant_id` = B) → mesmo resultado, zero escrita; (f) depois do pulado, `settleOnAir(..., { motivo: 'encerrado', destino: ORIGINAL, humano: true })` com título atual diferente → `precisa_confirmar`; (g) `camposPendentes(rs, 'vigia')` → `[]`; (h) token vencido (porta `token` lança) → ainda `feito` (o curto-circuito vem antes de `resolverAcesso`); (i) CAS perdido no `update` → `em_andamento`, nada gravado.
- [ ] **Step 2:** FAIL. **Step 3:** em `caminhoDe`, `teste_youtube` → `{ de: ['active','paused'], para: 'paused', endReason: null, extra: { status_note: NOTA_TESTE_YOUTUBE } }`. Em `settleOnAir`, logo depois de `emAndamentoRecente` e da checagem de `caminho.de` (antes do passo 0b): `if (op.motivo === 'teste_youtube') return gravarPuladoDefinitivo(portas, r, campos, agora)`, função privada que faz um único `update ab_tests ... .eq('id').eq('restore_seq', r.restore_seq).select('id')` (CAS) e não chama `avisarRestauracao`. **Step 4:** PASS, e a suíte existente `test/youtube/ab-settle*.test.ts` continua verde.
- [ ] **Step 5: ensaio no banco 54421** (Phil M-r8-2, gated em `ab-f1a-settle-ensaio.test.ts`): semear site, vídeo, `ab_tests` `active` com 2 variantes e uma `ab_native_tests` confirmada; chamar `settleOnAir(teste_youtube)` com o cliente real do 54421 e mock da Data API sem `update`; afirmar a linha final de `ab_tests` e que `ab_test_restores`/histórico (se houver gatilho) ficou consistente com `ab-restore-status-forma.test.ts`.
- [ ] **Step 6:** commit `feat: settleOnAir com motivo teste_youtube, pausa definitiva sem escrita`.

**Aceite:** (a)–(i) e o ensaio verdes. Estimativa: ~120 mil tokens.

---

### Task 5: Guarda pura e leitura em lote

**Files:**
- Create: `apps/web/src/lib/youtube/teste-youtube/nativo/guarda.ts`
- Test: `apps/web/test/youtube/teste-youtube/nativo/guarda.test.ts`

**Interfaces:**
- Produces:
  - `export interface LinhaAberta { id: string; video_id: string; confirmado_em: string | null; updated_at: string }`
  - `export async function bloqueadoPorTesteNativo(sb: SupabaseClient, siteId: string, videoIds: readonly string[]): Promise<{ ok: true; linhas: Map<string, LinhaAberta> } | { ok: false; erro: string }>` — uma consulta (`ab_native_tests`, `estado='em_andamento'`, `site_id`, `video_id in (...)`), paginada como `registro/ler.ts`.
  - `export type DecisaoGuarda = { acao: 'seguir' } | { acao: 'seguir_e_anotar'; nativeTestId: string } | { acao: 'pausar_sem_escrever'; nativeTestId: string; motivo: 'confirmado' | 'detectado' }`
  - `export function decidirGuarda(linha: LinhaAberta | undefined, modo: ModoPausaDetectado): DecisaoGuarda` — sem linha → `seguir`; confirmada → `pausar_sem_escrever/confirmado` nos três modos; detectada: `off` → `seguir`, `log` → `seguir_e_anotar`, `on` → `pausar_sem_escrever/detectado`.
  - `export function inicioDoTeste(r: { primeira_vista: string | null; confirmado_em: string | null; created_at: string }): Date` — menor não nulo entre `primeira_vista` e `confirmado_em`, senão `created_at`.
  - `export const MARGEM_FECHAMENTO_DIAS = 2`

- [ ] **Step 1: testes:** tabela de `decidirGuarda` (3 modos × {sem linha, detectada, confirmada}, e uma `origem='detectado'` com `confirmado_em` preenchido = confirmada); `inicioDoTeste`: detecção no dia 0 e confirmação no dia 3 → dia 0; só `created_at` → `created_at`; N=50 vídeos → uma ida ao banco (contador no falso de `test/helpers/fake-supabase.ts`); erro do banco → `{ ok: false }`, nunca mapa vazio.
- [ ] **Step 2–4:** FAIL → implementar → PASS. **Step 5:** commit.

Estimativa: ~50 mil tokens.

---

### Task 6: Guarda nos pontos de escrita do nosso teste

**Files:**
- Modify: `apps/web/src/lib/youtube/ab-start.ts` (`startAbTestInternal`, linha 196: depois de validar `status === 'draft'`, antes da reivindicação)
- Modify: `apps/web/src/lib/youtube/ab-resume.ts` (`retomarTeste`, linha 93: depois de `status !== 'paused'`)
- Modify: `apps/web/src/lib/youtube/ab-rotate-phases.ts` (`phaseRotateActiveTests`, linha 224: uma consulta antes do laço; `phaseProcessQueue`, linha 98: recusa nativa adia sem contar tentativa)
- Modify: `apps/web/src/app/cms/(authed)/youtube/ab-lab/actions.ts` (`forceRotate`, linha 997; Review Focus 1)
- Create: `apps/web/src/lib/youtube/teste-youtube/nativo/anotar-log.ts`
- Test: `apps/web/test/youtube/ab-guarda-nativa.test.ts`; `apps/web/test/integration/ab-f1a-guarda.test.ts`

**Interfaces:**
- Consumes: `bloqueadoPorTesteNativo`, `decidirGuarda` (T5), `modoPausaPorDetectado` (T3), `settleOnAir(teste_youtube)` (T4).
- Produces: `export const MOTIVO_RECUSA_NATIVO = 'Há um teste do YouTube em andamento neste vídeo. Espere o resultado ou encerre o teste no Studio.'` (texto provisório; o Logan fecha sem mockup, §7) ; `export async function anotarPausaDetectado(sb, a: { siteId: string; testId: string; videoId: string; nativeTestId: string }): Promise<void>` (insert em `audit_log` com `action: 'ab_pausa_detectado_log'`, `resource_type: 'ab_test'`, `resource_id: testId`, `actor_user_id: null`, `after_data: { test_id, video_id, native_test_id, confirmado_em_nulo: true }`; erro vai a `console.error` + Sentry, não lança).

- [ ] **Step 1: testes (unidade, banco falso, mock da Data API que registra `update`):**
  - **variável apagada** (`delete process.env.AB_PAUSA_POR_DETECTADO`): rotação com `detectado` aberta **escreve** (o mock recebe o `update`), `status` `active`, zero insert em `audit_log`, `status_note` intacta; `start` e `retomar` com `detectado` seguem como hoje.
  - `log`: mesma escrita; exatamente uma linha `ab_pausa_detectado_log` com `test_id`, `video_id`, `native_test_id`; `status_note` com motivo existente intacta; nenhuma recusa; um teste concluído que passou pelo `log` não tem texto de guarda em `reason`/`learning` (`queries.ts`).
  - `on`: rotação com `detectado` → zero escrita, `paused/pulado_teste_youtube`; `start` e `retomar` recusam com `MOTIVO_RECUSA_NATIVO`.
  - linha confirmada, nos três modos: rotação → zero escrita e `settleOnAir(teste_youtube)`; `start`, `retomar` e `forceRotate` recusam.
  - `'true'` → comporta-se como `off`.
  - N testes ativos → uma consulta de guarda (sem N+1).
  - erro na consulta de guarda: `start`/`retomar` recusam com "não foi possível conferir o teste do YouTube"; a rotação pula todos os testes do ciclo sem escrever e manda Sentry (falha fechada; nunca escreve sem conferir).
  - fila (`phaseProcessQueue`) com linha confirmada no vídeo → teste continua `queued`, `tentativas` igual, `status_note` com o motivo (Review Focus 2).
- [ ] **Step 2:** FAIL. **Step 3:** implementar. Na rotação, a consulta usa os `youtube_video_id` (uuid de `youtube_videos`, `ab-rotate-phases.ts:262`) de todos os testes do ciclo. **Step 4:** PASS; suíte existente de `ab-rotate*`, `ab-resume*`, `ab-start*` verde.
- [ ] **Step 5: integração gated** (`ab-f1a-guarda.test.ts`, flag `on`): linha `detectado` semeada → rotação pausa sem escrever → (Tarefa 10, quando existir) "Não é teste" → `retomar` aceita. Até a Tarefa 10, o teste para em "pausa sem escrever" e a Tarefa 10 completa.
- [ ] **Step 6:** commit `feat: guarda do teste do YouTube em iniciar, retomar, rotação, forçar e fila (flag AB_PAUSA_POR_DETECTADO)`.

**Aceite:** todos os casos acima; nenhum teste existente quebrado. Estimativa: ~150 mil tokens.

---

### Task 7: Roteador nativo × nosso e leitura do formato

**Files:**
- Create: `apps/web/src/lib/youtube/teste-youtube/nativo/roteador.ts` (puro)
- Create: `apps/web/src/lib/youtube/teste-youtube/nativo/formato-borda.ts`
- Test: `apps/web/test/youtube/teste-youtube/nativo/roteador.test.ts`, `formato-borda.test.ts`

**Interfaces:**
- Produces:
  - `export interface Formato { isShort: boolean | null; kids: boolean | null; adulto: boolean | null; aoVivo: boolean | null }`
  - `export function lerFormatoDoBruto(raw: unknown): Pick<Formato, 'kids' | 'adulto' | 'aoVivo'>` — `status.madeForKids`, `contentDetails.contentRating.ytRating === 'ytAgeRestricted'`, `snippet.liveBroadcastContent in ('live','upcoming')`; ausente/tipo errado → `null`.
  - `export type Caminho = { tipo: 'nativo'; portao: boolean; motivo: string } | { tipo: 'nosso'; motivo: string } | { tipo: 'nao_confirmado'; motivo: string } | { tipo: 'sem_volume'; motivo: string }`
  - `export function caminhoDoTeste(e: { formato: Formato; idadeDias: number; impressoesAcimaDoPiso: boolean | null }): Caminho` — precedência de §5.1 (kids/18+/ao vivo `true` → nosso; `isShort true` → nosso; falta `isShort` ou kids → `nao_confirmado`; idade < 7 → nativo sem portão; ≥ 7 sem volume → `sem_volume` "Sem volume para teste. Trocar direto?"; senão nativo com portão). O piso numérico é do Phil (§5.4) e entra como booleano já calculado.
  - `export async function lerFormatos(sb, siteId: string, videos: { id: string; ytId: string }[]): Promise<Map<string, Formato>>` — **uma** consulta em `yt_own_video_state_raw` (`distinct on (youtube_video_id) ... order by youtube_video_id, observed_at desc, id desc`, via RPC ou `.in` + ordenação no cliente com o índice `idx_yt_own_video_state_raw_video`) e uma em `yt_own_video_meta_daily` (última por vídeo); fallback `youtube_videos.duration_seconds > 180 ⇒ isShort false`.
  - `export async function formatoNaAbertura(sb, siteId, video, portas: { videosList?: (ytId: string) => Promise<unknown> }): Promise<Formato>` — se não há bruto, chama `videosList` (`part=status,contentDetails,snippet`, 1 unidade) **uma vez**, lê com `lerFormatoDoBruto`, não grava.
- [ ] **Step 1: testes:** a tabela inteira de §5.1 (`isShort` true/false/null × kids true/false/null), 18+ true com `isShort` false → nosso, `upcoming` → nosso, bruto sem `status` → kids null; portão: idade 0/6/7/8 d × impressões abaixo/acima; vídeo sem meta, `duration_seconds = 1200`, sem bruto → com `videosList` (kids false) nativo, sem a porta `nao_confirmado` com motivo "ainda não lido"; `lerFormatos` com 30 vídeos → 2 idas ao banco; `formatoNaAbertura` nunca grava (falso de banco sem insert).
- [ ] **Step 2–4:** FAIL → implementar → PASS. **Step 5:** commit.

Estimativa: ~90 mil tokens.

---

### Task 8: Ficha gravada: abrir, salvar, "Abrir no Studio", "Lembrar no computador"

**Files:**
- Create: `apps/web/src/lib/youtube/ab-lab-acesso.ts` (move `requireEditUser` de `ab-lab/actions.ts:89` para cá, sem `'use server'`; `actions.ts` passa a importar; exportar de um arquivo `'use server'` o tornaria endpoint)
- Create: `apps/web/src/lib/youtube/teste-youtube/nativo/ficha.ts` (núcleo com portas)
- Create: `apps/web/src/app/cms/(authed)/youtube/ab-lab/actions-nativo.ts` (`'use server'`, wrappers finos)
- Test: `apps/web/test/youtube/teste-youtube/nativo/ficha.test.ts`, `apps/web/test/integration/ab-f1a-ficha.test.ts`

**Interfaces:**
- Produces:
  - `export const VarianteFichaSchema = z.object({ n: z.number().int().min(1).max(3), tipo: z.enum(['titulo','miniatura','combo']), titulo: z.string().trim().min(1).max(100).optional(), imagem: z.object({ url: z.string().url().refine(eUrlDoBlob), sha256: z.string().regex(/^[0-9a-f]{64}$/), largura: z.number().int().positive(), altura: z.number().int().positive() }).optional() })` e `FichaRascunhoSchema` (`campos` ⊆ {titulo, miniatura}, `variantes` 0..3, `n` únicos). `eUrlDoBlob` reaproveita `ehCopiaNoBlob` (`ab-settle.ts:97`).
  - Actions: `abrirFicha(videoId: string): Promise<{ ok: true; ficha: FichaLida } | { ok: false; error: string }>`; `salvarFicha(fichaId: string, lido: string, dados: FichaRascunho)` (CAS por `atualizada_em`; perdeu → devolve a ficha atual); `marcarStudioAberto(fichaId: string)`; `lembrarNoComputador(fichaId: string): Promise<{ ok: true; lembrarEm: string; jaLembrado: boolean } | { ok: false; error: string }>`.
  - `FichaLida` = linha + derivados `aberta: boolean` e `enviada: boolean` (`greatest(studio_aberto_em, lembrar_em) >= agora - 14 d`, com nulos ignorados).
- [ ] **Step 1: testes:** recarregar (`abrirFicha` 2×) devolve as mesmas variantes; ficha só com o original grava; os 4 casos do Review Focus 4 recusados e nada gravado; `lembrarNoComputador` 2× → **uma** linha em `notifications` (`type: 'youtube.native_ficha_lembrar'`, `dedup_key 'ficha-lembrar:<id>'`, `user_id` = quem tocou, `action_href` de Global Constraints) e o 2º devolve `jaLembrado: true` com a data; erro de `createNotification` volta como `{ ok: false }`, `lembrar_em` não gravado; `enviada`: Studio aberto há 20 d e "Lembrar" ontem → `true`; ficha de 13 d sem marcador → `enviada` true, de 15 d → false (relógio injetado); id de outro site → "não encontrado"; usuário sem permissão (`requireEditUser` lança) → recusa antes de qualquer leitura; a ficha nunca aparece em `bloqueadoPorTesteNativo` nem em `lerCandidatos` do registrador (integração).
- [ ] **Step 2–4:** FAIL → implementar (abrir chama `rpc('ab_native_ficha_abrir')`) → PASS. **Step 5:** commit.

**Aceite:** acima, mais a suíte de `ab-lab/actions` verde depois da mudança de `requireEditUser`. Estimativa: ~130 mil tokens.

---

### Task 9: "Já iniciei", "Confirmar" (marcador) e a pausa do nosso

**Files:**
- Create: `apps/web/src/lib/youtube/teste-youtube/nativo/confirmar.ts`
- Modify: `actions-nativo.ts`
- Test: `apps/web/test/youtube/teste-youtube/nativo/confirmar.test.ts`, `apps/web/test/integration/ab-f1a-confirmar.test.ts`

**Interfaces:**
- Consumes: `rpc('ab_native_iniciar')` (T2), `settleOnAir(teste_youtube)` (T4).
- Produces: `export async function confirmarTesteNoStudio(p: { sb; siteId; userId; origem: { fichaId: string } | { registroId: string; lido: string } ; settle?: typeof settleOnAir }): Promise<{ ok: true; registroId: string; pausados: string[] } | { ok: false; erro: 'nao_encontrada' | 'ficha_incompleta' | 'ja_ha_teste_em_andamento' | 'estado_mudou' | 'ja_confirmado'; registroId?: string }>`. Com `fichaId` = "Já iniciei"; com `registroId` = "Confirmar" do cartão S7 estado 1 (`update ab_native_tests set confirmado_em = now(), confirmado_por where id and site_id and estado='em_andamento' and confirmado_em is null and updated_at = :lido`, uma releitura se perder por atualização de evidência). Depois de confirmada, para cada `ab_tests` do vídeo com `status in ('active','paused')`: `settleOnAir(id, { siteId, destino: ORIGINAL, motivo: 'teste_youtube' })`. Actions: `jaIniciei(fichaId)`, `confirmarDetectado(registroId, lido)`.
- [ ] **Step 1: testes:** com teste nosso `active` e restore pendente → registro `confirmado`, nosso `paused/pulado_teste_youtube`, **zero escrita no YouTube** (mock da Data API sem `update`); "Já iniciei" com `detectado` aberto confirma a existente; sem linha cria `confirmado` e vincula a ficha; marcador é aceito mesmo quando o `settleOnAir` devolve `em_andamento` (o registro fica confirmado; o resultado lista o nosso como não pausado e a rotação o pausa no próximo ciclo pela guarda confirmada); falha do `settleOnAir` não desfaz a confirmação e volta como aviso; CAS do "Confirmar" perdido por evidência nova → sucesso na releitura; perdido porque o registrador encerrou → `estado_mudou`; outro site → `nao_encontrada`.
- [ ] **Step 2–4:** FAIL → implementar → PASS. **Step 5:** commit.

Estimativa: ~100 mil tokens.

---

### Task 10: "Não é teste / Liberar o Lab" (só a action)

**Files:**
- Create: `apps/web/src/lib/youtube/teste-youtube/nativo/descartar.ts`
- Modify: `actions-nativo.ts`; completar `apps/web/test/integration/ab-f1a-guarda.test.ts` (Tarefa 6, Step 5)
- Test: `apps/web/test/youtube/teste-youtube/nativo/descartar.test.ts`

**Interfaces:**
- Produces: `export async function descartarDetectado(p: { sb; siteId; userId; orgId: string | null; registroId: string; lido: string }): Promise<{ ok: true } | { ok: false; erro: 'nao_encontrado' | 'confirmado' | 'ja_encerrado'; estado?: string }>` com o `update` literal de §5.2 (predicado `confirmado_em is null`, CAS `updated_at`, uma releitura); `audit_log` `action: 'ab_native_descartado'`, `resource_type: 'ab_native_test'`, `after_data` só com ids e o estado anterior (falha do rastro vai ao log, não desfaz). Action `naoETeste(registroId, lido)`.
- [ ] **Step 1: testes:** `detectado` → descartado, `audit_log` gravado, `bloqueadoPorTesteNativo` não acha mais a linha, `retomar` aceita; linha confirmada → `confirmado`, continua `em_andamento`; `detectado` → "Já iniciei" → "Não é teste" recusa; CAS perdido por evidência → releitura e sucesso; registrador encerrou antes → `ja_encerrado` com o estado novo, sem erro; outro site → `nao_encontrado`, zero linhas; sem permissão → recusa; registrador rodando de novo com a mesma evidência (`rodarRegistro` com o mundo falso de `test/youtube/teste-youtube/registro/mundo.ts`) não reabre; o nosso pausado **não** volta sozinho.
- [ ] **Step 2–4:** FAIL → implementar → PASS (inclui o fim do teste de integração da Tarefa 6). **Step 5:** commit.

Estimativa: ~80 mil tokens.

---

### Task 11: Resposta do dia 14 (aditiva)

**Files:**
- Create: `apps/web/src/lib/youtube/teste-youtube/nativo/resposta.ts`
- Modify: `actions-nativo.ts`
- Test: `apps/web/test/youtube/teste-youtube/nativo/resposta.test.ts`, `apps/web/test/integration/ab-f1a-resposta.test.ts`

**Interfaces:**
- Produces: `export type RespostaDono = 'venceu_nova' | 'ficou_igual' | 'inconclusivo' | 'nao_vi'`; `export function patchDaResposta(r: RespostaDono, n: number | null, variantes: VarianteFicha[] | null): { sempre: Record<string, unknown>; seEmAndamento: Record<string, unknown> } | { erro: 'variante_invalida' }` (tabela de §5.3 literal; `vencedor_titulo` quando a variante `n` tem título); `export async function responderDia14(p: { sb; siteId; userId; registroId; lido; resposta; n: number | null; agora: Date }): Promise<{ ok: true; conflito: { youtube: string; dono: string } | null } | { ok: false; erro: string }>` — grava `sempre` (`resposta_dono`, `respondido_em`, `variante_vencedora`); se a linha está `em_andamento`, junta `seEmAndamento` no mesmo `update` com CAS `updated_at`; se perde, relê e grava só `sempre`; expira `lembrete-nativo:<id>` em `notifications`. Action `responderTesteDoYouTube(...)`.
- [ ] **Step 1: testes:** um caso por botão grava a linha da tabela; 3 variantes → `n=3` grava, `n=4` recusa; "Venceu a nova" só de miniatura passa no CHECK novo; registrador encerrou com `vencedor_fonte='data_api'` e dono diz outra → guarda as duas, devolve `conflito`; dono e registrador ao mesmo tempo → linha consistente, nunca vencedor sem fonte; responder derruba o número de `/api/notifications/count` (integração, lê o que o sino lê); erro de escrita volta como `{ ok: false }`; sem permissão recusado.
- [ ] **Step 2–4:** FAIL → implementar → PASS. **Step 5:** commit.

Estimativa: ~100 mil tokens.

---

### Task 12: Tarefa `avisos_pendentes` (lembrete do dia 14 e fechamento `sem_resposta`)

**Files:**
- Modify: `apps/web/src/lib/youtube/agenda/definicoes.ts` (definição `avisos_pendentes`: `peso: 'leve'`, `periodo: 'dia'`, `aPartirDaHoraSP: 9`, `ligaCom: 'AB_NATIVO_REGISTRO'`; tempos de tarefa leve como `marcas_de_idade`) — **território da A5: só o push espera a regra de §7**
- Modify: `apps/web/src/lib/youtube/agenda/catalogo.ts` (uma importação, uma entrada)
- Create: `apps/web/src/lib/youtube/agenda/tarefas/avisos-pendentes.ts`
- Create: `apps/web/src/lib/youtube/teste-youtube/nativo/avisos.ts` (núcleo: quem lembrar, quem fechar)
- Test: `apps/web/test/youtube/teste-youtube/nativo/avisos.test.ts`, `apps/web/test/youtube/agenda/avisos-pendentes.test.ts`, `apps/web/test/youtube/agenda/catalogo.test.ts` (caso novo)

**Interfaces:**
- Consumes: `inicioDoTeste`, `MARGEM_FECHAMENTO_DIAS` (T5), `F1A_DADO_DESDE` (T1).
- Produces: `export function devidosDoLembrete(linhas, agora: Date): string[]` (`estado in ('em_andamento','encerrado','sem_desfecho')`, `confirmado_em is not null`, `resposta_dono is null`, `lembrete_notificado_em is null`, `notificacao_falhou_em is null`, `created_at >= F1A_DADO_DESDE`, `inicioDoTeste + 14 d <= agora`); `export function devidosDoFechamento(linhas, agora): string[]` (`em_andamento`, `confirmado_em is not null`, `inicio + 16 d <= agora`); tarefa `avisosPendentes: Tarefa`. A parte do nicho (`niche_signals`) é da F2 e entra depois nesta mesma tarefa.
- [ ] **Step 1: testes:** Review Focus 3 (13 d 23 h não, 14 d sim; 15 d 23 h não fecha, 16 d fecha); `detectado` não confirmado no dia 15 → nenhuma notificação; confirmado → uma; `descartado` e linhas com `created_at` antes da migration → nenhuma; lembrete com dono sem preferência → uma linha em `notifications` e uma entrega `email` (`defaultChannels: ['email']`); com `channel_email = false` → só o sino; `total === 0` é erro e conta tentativa; falha na 1ª e sucesso na 2ª não duplica; 3 falhas → `notificacao_falhou_em`, tarefa `erro` com motivo, sem reenvio depois; fechamento grava `sem_desfecho/sem_dado/sem_resposta` com CAS `updated_at` (perdeu → pula, conta), expira `lembrete-nativo:` e libera o `start` do nosso; registrador fecha antes do dia 14 → o lembrete ainda sai; **variável `AB_NATIVO_REGISTRO` apagada → tarefa desligada (`ligadaPorVariavel` false), nem lembrete nem fechamento** (`catalogo.test.ts`); zero linha devida → `ok` com `detalhe.lembrados = 0, fechados = 0`.
- [ ] **Step 2–4:** FAIL → implementar → PASS. **Step 5:** commit.

**Aceite:** acima; `catalogo.test.ts` verde. Estimativa: ~130 mil tokens.

---

### Task 13: Teste nativo observado nos concorrentes (§5.8) — ISOLADA

> Phil e Yannis re-revisam a §5.8 em paralelo. Esta tarefa não é dependência de nenhuma outra, tem migration própria e vai num commit e num push próprios; se a §5.8 mudar, só ela muda.

**Files:**
- Create: `supabase/migrations/<ts>_ab_native_observados.sql` (por `npm run db:new ab_native_observados`)
- Create: `apps/web/src/lib/youtube/teste-youtube/observados/inferir.ts` (puro)
- Create: `apps/web/src/lib/youtube/teste-youtube/observados/passo.ts` (borda: lê alvos concorrentes, upsert)
- Modify: `apps/web/src/lib/youtube/teste-youtube/registro/tarefa.ts` (`rodarRegistro`, linha 106: depois dos próprios e antes de `podar`, com o tempo que sobrar)
- Test: `apps/web/test/youtube/teste-youtube/observados/inferir.test.ts`, `passo.test.ts`, `apps/web/test/integration/ab-native-observados.test.ts`

**Interfaces:**
- Produces: tabela `ab_native_observados` como §5.8 (`id bigint identity`, `site_id`, `youtube_video_id` com o CHECK de 11 caracteres, `campos text[]`, `trocas jsonb`, `n_versoes smallint check (n_versoes >= 2)`, `ficou jsonb`, `ficou_estado text check in ('estavel','em_andamento','sem_desfecho')`, `primeira_troca_em`, `ultima_atualizacao_em`, `unique (site_id, youtube_video_id)`; RLS como `yt_watch_*` (`20261018000005:106-116`: `can_view_private_site(site_id)` se existir, senão `can_edit_site(site_id)`; `revoke` de `anon` e da escrita de `authenticated`); escrita só `service_role`). `export function inferirObservado(e: { leituras: LeituraObs[]; thumbsPorId: Map<number, ThumbObs>; agoraMs: number; alvoSaiu: boolean }): Observado | null` — versões de miniatura pela miniatura **ligada à leitura** (`miniatura_id`, a principal daquela rodada), agrupadas por `hamming(dhash) > DHASH_MAX_SAME` (`teste-youtube/dhash.ts`); versões de título por `normalizarTitulo(titulo_oficial)`; leitura válida = `http = 200`, `erro is null`, `jogador_bloqueado = false`, `dhash` não nulo para miniatura; `null` quando < 2 versões ou < 2 leituras válidas. `ficou_estado`: `estavel` se a última versão foi vista em ≥ 2 rodadas seguidas e nenhuma troca nas últimas 24 h; `sem_desfecho` se `alvoSaiu` e ainda em troca; senão `em_andamento`. `export const MAX_OBSERVADOS_POR_DISPARO = 20`.
- [ ] **Step 1: testes:** troca de miniatura vista → 2 versões; só `etag` mudou (mesmo `dhash`) → `null`; só 1 leitura → `null`; leituras com `erro` → `null`; troca e volta (A, B, A) → 2 versões, `ficou` = A; troca há 6 h → `em_andamento`; alvo saiu em troca → `sem_desfecho`; o alvo próprio não entra (o passo filtra `tipo = 'concorrente'`; o registrador continua só com `proprio`, `ler.ts:175`); reexecução sem leitura nova não reescreve (`ultima_atualizacao_em` igual); passo respeita o prazo do disparo (para no `fimDuro`, conta `observados_sobrou`) e não muda o veredito da tarefa dos próprios (erro no passo dos concorrentes → `parcial` com motivo `observados_falhou`, nunca `erro` da tarefa inteira); integração: RLS com GUC falsificado, `unique` segura duas gravações.
- [ ] **Step 2–4:** FAIL → implementar → PASS. A ordem de visita é por `yt_watch_alvos.ultima_rodada_em` mais nova que `ab_native_observados.ultima_atualizacao_em` (ou sem linha), até `MAX_OBSERVADOS_POR_DISPARO`.
- [ ] **Step 5:** commit `feat: teste nativo observado nos concorrentes (ab_native_observados)`.

**Aceite (§7, r10):** tabela presente; com a sonda rodando, uma consulta lista as trocas dos últimos 7 dias e a Gio confere uma contra o YouTube; sem troca vista, nenhuma linha. Estimativa: ~140 mil tokens.

---

### Task 14: Integração com a flag em `on`, revisão e envio

**Files:**
- Create: `.superpowers/sdd/ab-lab/f1a-dado/aplicar-f1a-dado-migration.sh`, `.superpowers/sdd/ab-lab/f1a-dado/aplicar-observados-migration.sh`, `.superpowers/sdd/ab-lab/f1a-dado/conferir-f1a-dado.sql`

- [ ] **Step 1:** rodar a suíte de integração inteira no 54421 com `AB_PAUSA_POR_DETECTADO=on` (saída em arquivo, só as falhas no contexto) e `npx vitest run` completo (~160 s). Zero falha.
- [ ] **Step 2:** `npm run typecheck -w apps/web` (o pre-commit também roda).
- [ ] **Step 3:** revisão do lote por Phil e Yannis (Opus, 1ª revisão), conserto até o acordo (Sonnet). A Tarefa 13 pode ir num lote separado.
- [ ] **Step 4: scripts do dono** (molde de `.superpowers/sdd/ab-lab/2026-10-18-nativo-vs-nosso/aplicar-s7-migration.sh`: minutos proibidos 0-4/20-24/30-34/40-44 e janela 11:30-13:00 UTC, `echo YES | npm run -s db:push:prod`, depois a conferência): `conferir-f1a-dado.sql` devolve `ab_native_tests_check3` ausente, `ab_native_tests_vencedor_com_fonte` presente, `ab_native_fichas` presente com RLS ligada, as duas funções com `has_function_privilege('service_role', ...)` true e `authenticated` false. O controlador roda o script se o modo permitir (memória `feedback_comando_no_clipboard`); senão manda ao dono, um por vez: `bash .superpowers/sdd/ab-lab/f1a-dado/aplicar-f1a-dado-migration.sh`.
- [ ] **Step 5: ordem obrigatória do envio 1 (Tarefas 1–12):** (1) `db:push:prod` da migration da F1a-dado e conferência; (2) `AB_PAUSA_POR_DETECTADO=log` no Vercel Production (`printf log | vercel env add AB_PAUSA_POR_DETECTADO production`; conferir com `vercel env ls`, memória `reference_gh_secret_set_stdin`: nunca `--body -`); (3) rebase em `origin/staging`, refazer os `git grep` deste plano, suíte, push `HEAD:staging` (1 push); (4) promoção para `main` combinada com a do dia (§7: 22/10 é só da A5; 23/10 é da A5 T9, combinar).
- [ ] **Step 6: envio 2 (Tarefa 13):** `bash .superpowers/sdd/ab-lab/f1a-dado/aplicar-observados-migration.sh` antes do código; push próprio, no mesmo dia só se couber nos 3 pushes.
- [ ] **Step 7:** commit dos scripts e do ledger com `--no-verify` (são docs/ops do SDD).

**Aceite de produção (conferido por quem diz, §7):** consulta do Step 4 (controlador); em 48 h com `log`, o Lab rotaciona como antes, sem pausa nem recusa nova (controlador, log do cron `ab-rotate`); ~08/11 (7 dias de `log`): Phil roda `select id, video_id, origem, confirmado_em, estado, primeira_vista from ab_native_tests where origem = 'detectado' and created_at >= now() - interval '7 days'` + contagem de `audit_log` `ab_pausa_detectado_log` no mesmo período + `detectado` `em_andamento` há > 16 dias (esperado 0); Gio confere cada linha contra o Studio, o dono confirma; **X = 0 é "sem amostra" e não libera `on`** (ledger declara; decisão volta ao dono). §5.8: Gio confere uma troca observada contra o YouTube.

Estimativa: ~120 mil tokens (sem as revisões de Phil e Yannis, ~150 mil à parte).

---

## Envios e calendário

| Envio | Conteúdo | Pré-condição | Pushes |
|---|---|---|---|
| E0 (outra fatia) | link do e-mail | — | não é deste plano |
| 1 | Tarefas 1–12 | migration em produção; `log` no Vercel; acordo de Phil e Yannis; regra de §7 para `agenda/definicoes.ts` | 1 push staging + promoção combinada |
| 2 | Tarefa 13 | re-revisão da §5.8 fechada; migration própria em produção | 1 push |
| (F1a-tela-1) | troca para `on` | botão "Não é teste" no mesmo deploy; aceite de ~08/11 | fora deste plano |

## Estimativa total

~1,4 milhão de tokens de execução (Sonnet, effort medium), mais ~150 mil de revisão (Phil e Yannis, Opus) e ~60 mil de conserto. Maiores: Tarefas 6, 8, 12 e 13.

## Fora deste plano

Tela (F1a-tela-1/2), link do e-mail (E0), `avaliarGuarda` e guarda dentro da reivindicação (F1b), `niche_signals` e a parte do nicho em `avisos_pendentes` (F2), o piso numérico do portão de volume (Phil, §5.4), remoção da flag (plano da F1b).
