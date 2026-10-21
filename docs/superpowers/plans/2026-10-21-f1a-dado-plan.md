# F1a-dado (backend do caminho nativo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

- **Estado:** r4 (21/10/2026, Sonnet), fecho dos pareceres da r3 (Phil 96, Yannis 94; `.superpowers/sdd/ab-lab/f1a-dado/revisao-plano-r3-{phil,yannis}.md`); a r3 aplicava a 2ª revisão (Hanna 94, Phil 93, Yannis 90; pareceres em `.superpowers/sdd/ab-lab/f1a-dado/revisao-plano-r2-{hanna,phil,yannis}.md`; a r2 aplicou a 1ª, `revisao-plano-r1-*`). **Liberação por envio (Yannis, r2):** o 1a (T3 a T6) está liberado para código; o 1b (T1, T2, T7 a T11) libera com N3 e N4 aplicados (feito nesta r3); o 1c (T12) está liberado; o envio 2 (T13) só depois de N1 e N2 (feitos nesta r3) e do acordo deles. **Nada aplicado em produção** sem o acordo.
- **Pendente do dono (uma decisão, sinalizada no texto):** I2 do Phil amplia o §5.3 (resposta do dia 14 vale também em `sem_desfecho` sem vencedor de outra fonte, com CAS). Marcada "PENDENTE DO DONO" nas Tarefas 11 e 12 e no spec r14 (§5.3, "decisão do dono pendente; recomendação do time: sim"); se ele disser não, trocar por `desfechoFinal(linha)` (ver Tarefa 11).
- **Spec:** r14 (emendas de acordo dos três pareceres: sem `created_at >= <migration>`, sem `ligaCom`, fechamento só após lembrete enviado ou falho, "os quatro CHECKs", resposta tardia pendente do dono).

### Cabeçalho r4: achado → onde foi tratado

| Achado (revisor) | Onde foi tratado |
|---|---|
| Yannis R1 (CHECK 3 condicional: guarda de banco mantido) | T1: `variantes is null` → 1..3, `variantes is not null` → 2..3; testes de banco (ficha + n=1 → 23514; derivada + n=1 aceita); T11 (dívida) |
| Yannis R2 (arquivar e depois remover canal com linha em `ab_native_observados`) | T13 Step 1: teste de integração de sucesso com contagens iguais |
| Yannis R3 = Phil M2 (`obs_falhou` sem dono) | T14: `obs_falhou` das últimas 24 h na conferência D+2 e D+5 (esperado 0; com >= 1 em 2 conferências, abrir item) e T13 aceite |
| Phil M1 (`origem='derivada'`: "qual título venceu?") | T11 (texto e anotação para a F1a-tela-1; notificação, se houver) |

### Cabeçalho r3: achado → onde foi tratado

| Achado (revisor) | Onde foi tratado |
|---|---|
| Yannis N1 (purga do canal não apaga as tabelas novas: `E10:sobrou_linha`; `TABELAS_COM_IDENTIDADE`) | T13: a migration `..._registro` também recria `competitor_channel_remove_archived`; `observatorio/arquivo/cli.ts` nos Files; testes de remoção, de vídeo compartilhado (recusa) e da lista de identidade |
| Yannis N2 (teto de 20 corridas é CHECK; nada trunca) | T13: `inferirObservado` guarda as 20 mais recentes e corta cada corrida a 1000 bytes; teste das 60 leituras; falha de gravação conta `obs_falhou` (dívida declarada) |
| Yannis N3 (resposta trocada estoura o CHECK 3) | T11: a resposta do dono vale uma vez (`ja_respondido`), `variante_vencedora: null` explícito fora de `venceu_nova` |
| Yannis N4 (`derivadasDeVariantesTitulo` × "n = 1 recusado") | T11 e T1: `n = índice + 1` nas derivadas, "n=1 é o original" só com ficha, CHECK 3 passa a `between 1 and 3` |
| Yannis M12 (T12 antes da migration) | T12: `schemaTablesReady`, `parcial/schema_ausente` |
| Yannis M13 (ordem dos passos da T0) | T0: Step 4 antes do Step 5 |
| Yannis M14 (guarda sem retry) | T6: uma tentativa extra imediata só para erro de rede/5xx; dívida declarada |
| Yannis (ordem dentro de `settleOnAir`) | T6 Step 3 |
| Phil R1 (spec ainda diz o contrário) | spec r14 (as emendas); a 4ª pende do dono |
| Phil R2 (`desfecho_motivo` velho na resposta tardia) | T11 (`seEmAndamento` grava `desfecho_motivo = 'resposta_do_dono'`) |
| Phil R3 (cobertura do observador) | T13 aceite e T14 (conferência D+2) |
| Phil R4 e Hanna N3 (leitura de produção negada no automático) | T13 Step 5 (controlador roda por `npx supabase db query --linked`; plano B: script ao dono) |
| Hanna N1 (datas ~08/11) | T0 Step 5, T14, tabela de envios: ~31/10 |
| Hanna N2 (1b não espera a promoção do 1a) | Tabela de envios |

### Cabeçalho r2: achado → onde foi tratado

| Achado (revisor) | Onde foi tratado |
|---|---|
| Hanna H1 (envio grande demais) | Envios e calendário: 1a = T3–T6 (sem migration; conferido, fecha com os consertos de Yannis), 1b = T1, T2, T7–T11, 1c = T12, 2 = T13 |
| Hanna H2 (registrador ligado?) | T0 Step 5 (contadores do resumo nos logs do Vercel; `ab_native_tests` com 0 linhas é ambíguo), repetido na T14 antes do 1a |
| Hanna H3 (aceite de 48 h, frase ao dono) | T14, aceite de produção do 1a |
| Hanna H4 (T7 sem consumidor) | Envios: a T7 é a primeira a passar para o plano da F1a-tela-1 se o 1b apertar |
| Phil C1 = Yannis C4 (CHECK recusa a resposta) | T1 (três CHECKs de Phil, `resposta_dono` obrigatória para variante) e testes; T11 (`n=1` recusado) |
| Phil I1 (anotação do `log` no ponto exato) | T6 (`ponto`, anotar só onde a escrita sairia, 5 pontos) |
| Phil I2 (fechar sem perguntar; resposta tardia) | T12 (fechamento só depois do lembrete enviado ou falho, `sem_resposta` sem `respondido_em`), T1 (CHECK de `respondido_em`), T11 (PENDENTE DO DONO) |
| Phil I3 (`ok` reescrito como "não escreveu") | T4 (só o campo ausente/`falhou`/`desistiu`/`em_andamento` vencido vira pulado) |
| Phil I4 (FK de `criada_por`) | T1 (`on delete set null`, teste) |
| Phil M1 (`site_id` no audit_log) | T6 |
| Phil M2 = Yannis M9 (falha fechada em `errors`) | T6 |
| Phil M3 (aviso único da fila) | T6 (`dedup_key 'ab-queue-nativo:'`) |
| Phil M4 = Yannis M8 (`youtube_video_id` e `campos` no insert) | T2 |
| Phil M5 (`campos` sobrescreve a detecção) | T2 (união) |
| Phil M6 = Yannis M2 (`created_at >= F1A_DADO_DESDE`) | T12 (corte removido; só `confirmado_em is not null`), T1 (constante removida); emenda de uma linha em §5.3 a avisar |
| Phil M7 = Yannis M4 (`lerFormatos` por RPC) | T7 (RPC `distinct on`, sem `.in`) |
| Yannis C1 (`ab_settle_claim`) | T4 (`rpc('ab_settle_claim')`, `end_reason 'teste_youtube'`) |
| Yannis C2 (pausar, encerrar, reverter, vigia, duração máxima) | T6 (guarda dentro de `settleOnAir` e `novaTentativa`, só linha confirmada) |
| Yannis C3 (`precisa_confirmar` após o pulado) | T4 (passo 0b também com destino original quando há `pulado_teste_youtube`) |
| Yannis C5 (Confirmar sem ficha, `variantes` nulo) | T11 (`derivadasDeVariantesTitulo`) |
| Yannis C6 (`ligaCom` amarra o fechamento) | T12 (sem `ligaCom`; teste de variável apagada afirma o contrário) |
| Yannis C7 (fila não distingue a recusa) | T6 (`codigo` em `startAbTestInternal`, `adiarSemContar`) |
| Yannis C8 (guarda por site na rotação) | T5 (nota) e T6 (agrupa por `site_id`) |
| Yannis M1 (drop do CHECK pela definição) | T1 |
| Yannis M3 (gatilho de `atualizada_em`) | T1 |
| Yannis M5 (`vi.stubEnv`) | Global Constraints |
| Yannis M6 (`NOTA_TESTE_YOUTUBE` em `reason`/`learning`) | T4 |
| Yannis M7 (`lembrar_em` falhou após a notificação) | T8 |
| Yannis M10 (`forceRotate` com `detectado`) | T6 |
| Yannis M11 (como desfazer) | T14 |
| Spec r12/r13 (cursor, junção, `sem_publicacao`, flag, dry-run, migration nova do registro) + Phil N8, N10, Yannis M2 | T13 reescrita |
- **Goal:** pôr no ar, sem tela, tudo o que o caminho nativo precisa no banco e no servidor (migration da F1a, ficha gravada, "Já iniciei", marcador, "Não é teste", resposta do dia 14, lembrete e fechamento, guarda nos pontos de escrita do nosso teste atrás de `AB_PAUSA_POR_DETECTADO` em `log`, roteador nativo × nosso) e o registro "teste nativo observado" dos concorrentes.
- **Architecture:** núcleo puro em `lib/youtube/teste-youtube/nativo/` (sem banco), bordas finas com portas injetáveis (mesmo molde de `ab-resume.ts`), duas funções plpgsql para o que precisa de atomicidade (`ab_native_ficha_abrir`, `ab_native_iniciar`), server actions finas num arquivo novo do A/B Lab, uma tarefa nova na agenda (`avisos_pendentes`) e um passo novo dentro da tarefa `registro_teste_nativo` para os concorrentes (§5.8, isolado na Tarefa 13).
- **Tech Stack:** Next.js 16 (server actions), Supabase (Postgres 17, plpgsql, RLS), Vitest, Zod.
- **Spec:** `docs/superpowers/specs/2026-10-21-sugestoes-do-nicho-e-ab-nativo-design.md` (r14, emendas de acordo com este plano; a r13 era 4d27920da; §5.1, §5.2, §5.3, §5.8, §7 linha F1a-dado, §8). Glossário: `docs/superpowers/specs/2026-10-21-glossario-caminho-nativo.md`.
- **Código de referência:** `origin/main` b75595690 (o checkout local está atrás). Toda linha citada abaixo é de lá; no dia do código, refazer o `git grep`.

## Global Constraints

- Migration só por `npm run db:new <nome>`; idempotente (`drop ... if exists` antes de `create policy/trigger`, `create ... if not exists`, `create or replace function`); `set lock_timeout = '5s'` no topo, como `20261018000006`.
- Funções de banco novas: `plpgsql`, `security invoker`, `set search_path = ''`, `revoke all ... from public, anon, authenticated; grant execute ... to service_role`. Nunca chamar sem EXECUTE no banco local (SIGSEGV, memória `reference_banco_local_integracao`): testar permissão com `has_function_privilege`.
- RLS de leitura das tabelas novas: `public.can_edit_site(site_id)`; `insert/update/delete` revogados de `authenticated`; teste que falsifica o GUC `app.site_id` como não-superusuário (memória `reference_rls_guc_spoof_pattern`).
- Toda server action nova: `requireEditUser()` no topo (decisão de Yannis, §5.2: mesmo critério das demais ações de edição do Lab), `getSupabaseServiceClient()` só depois; todo `where id = :id` leva `site_id` do contexto (id de outro site → "não encontrado", zero linhas).
- Classificação de linha: **confirmada = `confirmado_em is not null`**, detectada = `confirmado_em is null`; nunca por `origem`.
- Flag `AB_PAUSA_POR_DETECTADO`: valores `off | log | on`; ausente ou desconhecido = `off`; **`log` nunca toca `status_note`**; ação do `audit_log` = `ab_pausa_detectado_log`. Sobe em `log` (variável no Vercel **antes** do deploy). `on` sem o botão "Não é teste" (F1a-tela-1) é proibido.
- Prazo do nativo: `RULES.testCompareMaxDays` (14, `lib/youtube/observatorio/rules.ts:21`) + margem nomeada `MARGEM_FECHAMENTO_DIAS = 2`, contada **depois do lembrete enviado** (r2, Phil I2): o fechamento por silêncio nunca vem antes de a pergunta ter saído (ou falhado de vez).
- Notificação: `fanOutToSiteAdminsDetailed`; lembrete do dia 14 com `defaultChannels: ['email']` (nunca `channels`); "Lembrar no computador" com `createNotification` para o próprio usuário. `dedup_key`: `'ficha-lembrar:' || ficha.id`, `'lembrete-nativo:' || registro.id`. Payload só com ids.
- `action_href` até a F1a-tela: `/cms/youtube/ab-lab?video=<youtube_video_id>` (a página do Lab ignora o parâmetro hoje e abre o painel; a F1a-tela-1 passa a lê-lo). Não apontar para ficha nem cartão S7.
- Sem `any`; Zod em toda entrada de action. Arquivos kebab-case.
- Testes de integração: `describe.skipIf(skipIfNoLocalDb())`, banco `bythiago_int` (API 54421, Postgres 54422), sem paralelismo entre arquivos; a suíte de integração liga a flag com `vi.stubEnv('AB_PAUSA_POR_DETECTADO', 'on')` no `beforeAll` e `vi.unstubAllEnvs()` no `afterAll` (nunca atribuir a `process.env`: vaza para outro arquivo do mesmo worker e mascara o teste de "variável apagada"; Yannis M5).
- Envio: ≤ 3 pushes/dia/terminal até 27/10 (crédito Vercel); push combinado com a promoção da A5 (§7). Commits com `--no-verify` só se o hook falhar em arquivo de outro terminal (memória). Quatro envios (tabela ao fim): **1a** T3–T6, **1b** T1, T2, T7–T11, **1c** T12, **2** T13. A ordem de execução das tarefas segue os envios (0, 3, 4, 5, 6, depois 1, 2, 7 a 11, depois 12, depois 13), não a numeração.
- Escrita no YouTube só existe por `settleOnAir`, `novaTentativa` e os pontos de início/rotação; a guarda de linha **confirmada** vale em todos (T6), sem flag.

## Review Focus

1. **`forceRotate` (`ab-lab/actions.ts:997`) escreve no YouTube e não está nos 3 pontos do spec.** Com linha confirmada aberta, "Forçar rotação" cancelaria o teste nativo. Esperado: recusa com o mesmo motivo de `startAbTest`. Teste na Tarefa 6 (decisão além do spec, confirmada por Hanna, Phil e Yannis na r1).
2. **Fila e playoff entram por `startAbTestInternal`** (`ab-rotate-phases.ts:98` `phaseProcessQueue`, `ab-evaluate-phases.ts:37`, `batchStartTests`). Uma recusa por teste nativo não pode gastar `MAX_TENTATIVAS_DA_FILA` (7) e matar o teste da fila em 7 dias. Esperado: adia sem contar tentativa, com motivo. Teste na Tarefa 6.
3. **Fronteira do dia 14 por relógio, não por dia de calendário.** `inicio + 14 d` a 13 d 23 h não lembra; a 14 d 0 h lembra; o fechamento só vem com `inicio + 16 d <= agora` **e** lembrete enviado há pelo menos 2 dias (ou falho de vez): uma `detectado` vista há 20 dias e confirmada hoje recebe o lembrete hoje e só fecha daqui a 2 dias. Testes com relógio injetado na Tarefa 12.
4. **Entrada hostil na ficha:** URL de imagem fora do Blob, `sha256` malformado, título acima de 100 caracteres (limite do YouTube), `n` repetido ou fora de 1..3. Esperado: Zod recusa com motivo, nada gravado. Testes na Tarefa 8.
5. **Registrador e ação na mesma linha ao mesmo tempo** ("Não é teste", "Confirmar", resposta do dia 14): o CAS por `updated_at` perde por simples atualização de evidência. Esperado: uma releitura e sucesso se ainda elegível; nunca erro cru. Testes nas Tarefas 9, 10 e 11.

6. **`settleOnAir` e `novaTentativa` são o ponto único de escrita no YouTube do nosso teste** (Yannis C2): `pausa`, `encerrado`, `reverter`, `duracao_maxima` e o vigia passam por eles. A guarda de linha confirmada mora lá dentro (T6), não em cada chamador. Esperado: nenhuma escrita com linha confirmada aberta, por nenhum motivo.
7. **Resposta tardia** (PENDENTE DO DONO): resposta do dia 17 numa linha que fechamos por `sem_resposta` ou que o registrador fechou sem vencedor vira desfecho, com CAS; com vencedor de outra fonte = conflito (T11).

## Falha em verde: o que cada gravação faz quando o dado não existe

| Gravação | Dado ausente | Comportamento exigido (teste na tarefa) |
|---|---|---|
| `ab_native_fichas` (abrir) | vídeo sem linha em `youtube_videos` | FK recusa; action devolve "não encontrado" (T8) |
| Ficha "Já iniciei" | ficha com < 2 variantes ou campos vazios | `ficha_incompleta`, nada gravado (T2) |
| Marcador / pausa | teste nosso sem `restore_seq` lido | `settleOnAir` devolve `ja_encerrado`; marcador continua aceito (T9) |
| Guarda (3 pontos + forçar + fila + `settleOnAir`/`novaTentativa`) | consulta em lote falha | falha fechada: erro de banco recusa `start`/`retomar` com motivo "não foi possível conferir o teste do YouTube"; a rotação pula os testes do ciclo (sem escrever), com Sentry **e** em `RotateResult.errors` (o cron fica vermelho); a fila adia sem gastar tentativa; `settleOnAir` lança; nunca "sem bloqueio" calado (T5, T6) |
| `audit_log` do `log` | insert falha | log de erro e Sentry; a rotação segue escrevendo como hoje (o `log` é medição, não guarda) (T6) |
| Lembrete do dia 14 | `total === 0` no fan-out | conta tentativa; na 3ª, `notificacao_falhou_em` e tarefa vermelha (T12) |
| Fechamento `sem_resposta` | nenhuma linha vencida; ou lembrete ainda não enviado | `estado: 'ok'` com `detalhe.fechados = 0` (zero é medida, não falha); **nunca fecha sem a pergunta ter saído** (T12) |
| Resposta tardia do dono | linha fechada sem vencedor | vira desfecho (PENDENTE DO DONO), nunca só coluna lateral (T11) |
| Registrador ligado em produção | `ab_native_tests` com 0 linhas (ambíguo) | conferido pelos contadores do resumo nos logs (T0 Step 5) |
| Formato do vídeo | sem meta, sem bruto | `null`, terceiro estado "formato não confirmado"; nunca `false` (T7) |
| `ab_native_observados` / `ab_native_obs_cursor` | sem troca vista, < 2 leituras válidas, leituras com erro, `published_at` nulo, flag `off` | **nenhuma linha em `observados`** (nunca "0 versões"); o cursor grava `ok` ou `sem_publicacao`; flag `off`, observador caído, `sem_publicacao` e `obs_sem_tempo` leem "não medido", nunca "sem troca vista" (T13) |

---

### Task 0: Preparação (controlador, sem código)

- [ ] **Step 1:** Worktree a partir de `origin/staging` (não trocar o checkout dos outros terminais; nunca stash/reset): `git worktree add ~/Workspace/wt-f1a-dado origin/staging --detach`. Commits vão para staging por `bash -c 'git push origin HEAD:staging'` só nos envios desta seção.
- [ ] **Step 2:** Conferir a regra de §7: `git diff --name-only origin/main...<HEAD de cada worktree ativo da A5> | grep -E "ab-lab|teste-youtube|ab-settle|ab-rotate|ab-resume|ab-start|agenda/(definicoes|catalogo)|notifications"`. Vazio = pode codar. Colar o resultado no ledger `.superpowers/sdd/ab-lab/f1a-dado/progress.md`.
- [ ] **Step 3:** Subir o banco de integração (memória `reference_banco_local_integracao`) e confirmar no 54422: `select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.ab_native_tests'::regclass and contype = 'c' order by conname;` → `ab_native_tests_check3` = `CHECK (((vencedor_titulo IS NULL) = (vencedor_fonte IS NULL)))`. Se o nome diferir, parar e avisar (a Tarefa 1 depende dele).
- [ ] **Step 4:** Resposta ao "[a conferir]" de Hanna (§5.2), feita neste plano: `git grep -n "confirmado" origin/main -- apps/web/src` não acha nenhum caminho que grave `confirmado_em` ou `origem: 'confirmado'` (o registrador só insere `detectado`, `registro/tarefa.ts:286`). Reconferir no dia e anotar no ledger.
- [ ] **Step 5 (H2 da Hanna, repetir na T14 antes do envio 1a):** conferir que o registrador está **medindo**. `vercel env ls production | grep -E "AB_NATIVO_REGISTRO|OBS_WATCH_READ"` mostra as duas (valor oculto; conferido em 21/10, criadas há 3 dias) e `yt_watch_readings` tem leituras nas últimas 24 h (2.115, 226 alvos em 21/10 ~18h40 BRT, prova de que `OBS_WATCH_READ` está ligada). **`select count(*) from ab_native_tests` = 0 é ambíguo** (registro desligado **ou** nenhum teste nativo detectado), então **não prova nada**. A prova é o resumo da tarefa `registro_teste_nativo` nos logs do Vercel da rota da agenda, últimas 24 h: ao menos uma execução com `detalhe.alvos_lidos > 0` e `detalhe.avaliados > 0` (chaves em `registro/tarefa.ts:131-132`; refazer o `git grep` no dia). Sem execução = a tarefa não está ligada: ligar `AB_NATIVO_REGISTRO` **antes** de contar os 7 dias de `log` e anotar no ledger a data em que o relógio começou. Execução com `avaliados = 0` e `candidatos_total = 0` é sonda sem alvo próprio: anotar, o relógio conta, mas o aceite de ~31/10 sai com "sem amostra".
Estimativa: ~15 mil tokens.

---

### Task 1: Migration da F1a-dado: colunas, troca do CHECK, `ab_native_fichas`

**Files:**
- Create: `supabase/migrations/<ts>_ab_lab_f1a_dado.sql` (por `npm run db:new ab_lab_f1a_dado`)
- Test: `apps/web/test/integration/ab-f1a-migration.test.ts`

**Interfaces:**
- Produces: colunas novas em `ab_native_tests`: `lembrete_notificado_em timestamptz`, `resposta_dono text check (resposta_dono in ('venceu_nova','ficou_igual','inconclusivo','nao_vi','sem_resposta'))`, `variante_vencedora smallint`, `respondido_em timestamptz`, `notificacao_tentativas smallint not null default 0`, `notificacao_falhou_em timestamptz`, `variantes jsonb check (variantes is null or (jsonb_typeof(variantes)='array' and jsonb_array_length(variantes) between 2 and 3))`.
- **CHECKs novos (r2, Phil C1 = Yannis C4; separam o veredito da linha, `vencedor_*`, da resposta do dono, `variante_vencedora`):**
  ```sql
  check (vencedor_titulo is null or vencedor_fonte is not null)                                                   -- ab_native_tests_titulo_com_fonte
  check (vencedor_fonte is null or vencedor_titulo is not null or variante_vencedora is not null)                 -- ab_native_tests_fonte_com_vencedor
  check (variante_vencedora is null or (resposta_dono = 'venceu_nova' and ((variantes is null and variante_vencedora between 1 and 3) or (variantes is not null and variante_vencedora between 2 and 3))))    -- ab_native_tests_variante_da_resposta
  check ((respondido_em is null) = (resposta_dono is null or resposta_dono = 'sem_resposta'))                     -- ab_native_tests_respondido_em_do_dono
  ```
  Nas linhas existentes os quatro valem (todas as colunas novas são nulas, o `check3` antigo equivale aos dois primeiros), então o `add constraint` valida sem erro. Cada `add constraint` vai num `do` que confere `conname` antes (idempotência). `respondido_em` nulo com `resposta_dono = 'sem_resposta'` separa "o dono disse" de "o sistema fechou por silêncio" (Phil I2). **r3 (Yannis N4):** o CHECK 3 aceita `variante_vencedora` de 1 a 3 (era 2 a 3): numa linha `detectado` sem ficha o "original" não é conhecido e o dono escolhe entre os títulos listados (índice + 1); **r4 (Yannis R1):** o CHECK 3 é condicional: `variantes is null` (derivada) aceita 1 a 3 e `variantes is not null` (ficha) aceita 2 a 3, então o banco recusa `n = 1` em `venceu_nova` com ficha (23514) e a T11 recusa antes com `variante_invalida`. Testes de banco: ficha + `n = 1` em `venceu_nova` → 23514; linha derivada + `n = 1` → aceita. Custo aceito (r4: o guarda de banco ficou, condicional); `variante_vencedora` tem dois papéis (resposta do dono e veredito de linha sem fonte) e o CHECK 3 o prende a `resposta_dono = 'venceu_nova'`; nomeado na dívida declarada (fim da T11).
- Tabela `ab_native_fichas` como §5.3 (colunas, CHECKs, `registro_id unique` com FK `on delete set null`, índice `ab_native_fichas_recente (site_id, video_id, criada_em desc)`, único parcial `ab_native_fichas_uma_aberta`) **mais**: `criada_por uuid references auth.users(id) on delete set null` (r2, Phil I4: com FK sem ação a fase 3 da exclusão LGPD falharia na primeira ficha; sem FK ficaria identificador de pessoa apagada sem prazo; mesmo molde de `confirmado_por`/`descartado_por` em `20261018000006`) e um gatilho `before update` para `atualizada_em` com `clock_timestamp()`, igual a `ab_native_tests_set_updated_at` (r2, Yannis M3: o CAS de `salvarFicha` não pode depender de a action lembrar de gravar a coluna).
- **Sem** a constante `F1A_DADO_DESDE` (r2, Phil M6 = Yannis M2): o corte `created_at >= <migration>` tiraria o lembrete de uma `detectado` criada antes do deploy e confirmada depois, e ela fecharia em silêncio. Só o código novo grava `confirmado_em` (T0 Step 4), então `confirmado_em is not null` basta (emenda de uma linha em §5.3 a avisar ao dono do spec).

- [ ] **Step 1: teste que falha** (`ab-f1a-migration.test.ts`, gated): (a) **nenhum** CHECK de `ab_native_tests` com a definição `CHECK (((vencedor_titulo IS NULL) = (vencedor_fonte IS NULL)))` (não pelo nome) e os quatro CHECKs novos presentes; (b) insert de linha `encerrado` com `vencedor_fonte='dono'`, `resposta_dono='venceu_nova'`, `variante_vencedora=2`, `vencedor_titulo null` passa ("Venceu a nova" só de miniatura); (c) `vencedor_fonte='dono'` sem título nem variante é recusado (23514); `vencedor_titulo` sem fonte recusado; (d) linha `sem_desfecho/sem_dado/oficial_nao_lido` sem fonte, `resposta_dono='venceu_nova'` e `variante_vencedora=2` **passa** (o caso do dia 14 depois de o registrador fechar; a resposta aditiva não pode estourar o CHECK); `variante_vencedora=0` e `=4` recusadas, `=1` passa (derivada, Yannis N4); `variante_vencedora` com `resposta_dono='ficou_igual'` recusada; `resposta_dono='sem_resposta'` com `respondido_em` preenchido recusado e `resposta_dono='nao_vi'` sem `respondido_em` recusado; (e) ficha com `variantes='[]'` e `campos='{}'` passa (rascunho); ficha com 4 variantes recusada; `campos` com `'descricao'` recusado; (f) segunda ficha aberta no mesmo `(site_id, video_id)` → 23505; com a primeira descartada, passa; (g) RLS: como `authenticated` com GUC `app.site_id` falsificado para o site, sem papel de edição, `select` em `ab_native_fichas` volta 0 linhas; `insert` como `authenticated` recusado (42501); (g2) apagar o usuário semeado de `criada_por`: a ficha continua, com `criada_por` nulo (`confdeltype = 'n'`); (g3) dois `update` na mesma transação em `ab_native_fichas` → `atualizada_em` diferente; (h) `explain` de `select ... where site_id = $1 and video_id = $2 order by criada_em desc limit 1` usa `ab_native_fichas_recente`.
- [ ] **Step 2:** rodar `HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres npx vitest run test/integration/ab-f1a-migration.test.ts` (de `apps/web`) → FAIL (tabela ausente).
- [ ] **Step 3: escrever a migration.** A remoção do CHECK é **pela definição, não pelo nome** (r2, Yannis M1: num banco recriado o nome pode diferir e um `drop` por nome passaria calado, deixando o CHECK velho recusar "Venceu a nova" só de miniatura):
  ```sql
  do $$
  declare c record;
  begin
    for c in select conname from pg_constraint
              where conrelid = 'public.ab_native_tests'::regclass and contype = 'c'
                and pg_get_constraintdef(oid) = 'CHECK (((vencedor_titulo IS NULL) = (vencedor_fonte IS NULL)))'
    loop
      execute format('alter table public.ab_native_tests drop constraint %I', c.conname);
    end loop;
  end $$;
  ```
  Reaplicar não acha nada e segue. Os quatro `add constraint` novos vão cada um num `do` que confere `conname`. A Tarefa 0 Step 3 continua conferindo o nome em produção (esperado `ab_native_tests_check3`), só como alarme de divergência. RLS e `revoke` como em `20261018000006`.
- [ ] **Step 4:** aplicar no 54422 por `psql -f` e registrar a versão em `supabase_migrations.schema_migrations`; rodar o teste → PASS; reaplicar o arquivo inteiro uma 2ª vez → sem erro.
- [ ] **Step 5:** commit `feat: migration da F1a-dado (colunas do dia 14, CHECK de vencedor, ab_native_fichas)` só com os dois caminhos.

**Aceite:** os itens do Step 1 verdes; reaplicação limpa. Estimativa: ~100 mil tokens. **Envio 1b.**

---

### Task 2: Funções `ab_native_ficha_abrir` e `ab_native_iniciar`

**Files:**
- Modify: a migration da Tarefa 1 (ainda não aplicada em produção). **Envio 1b.**
- Test: `apps/web/test/integration/ab-f1a-funcoes.test.ts`

**Interfaces:**
- Produces: `public.ab_native_ficha_abrir(p_site uuid, p_video uuid, p_usuario uuid) returns public.ab_native_fichas` e `public.ab_native_iniciar(p_site uuid, p_ficha uuid, p_usuario uuid) returns jsonb` com os retornos `{ok:true, registro_id, confirmou_detectado:boolean}`, `{ok:true, ja_iniciada:true, registro_id}`, `{erro:'nao_encontrada'}`, `{erro:'ficha_incompleta', motivo:'variantes'|'campos'}`, `{erro:'ja_ha_teste_em_andamento', registro_id}`, `{erro:'estado_mudou'}`. O insert do passo 2 lista `youtube_video_id` (not null, regex de 11 caracteres) **lido de `youtube_videos` pelo `p_video` dentro da função**, nunca de parâmetro, e `campos` com 1 ou 2 itens (r2, Phil M4 = Yannis M8; sem isso vira 23502 na implementação). No passo 3, ao confirmar uma `detectado`, `campos` vira a **união** `array(select distinct unnest(t.campos || fx.campos))`, não `fx.campos` (r2, Phil M5: não apagar o que o registrador detectou). Os passos 1 a 5 de cada uma são os de §5.3, literalmente (inatividade por `greatest(criada_em, atualizada_em, studio_aberto_em, lembrar_em) < now() - interval '14 days'`; expiração de `ficha-lembrar:` na mesma transação; `on conflict ... where registro_id is null and descartada_em is null do nothing`; passo 3 com `not exists (select 1 from public.ab_native_fichas f where f.registro_id = t.id)`).

- [ ] **Step 1: testes que falham** (gated, relógio por `set local` não serve para `now()`: semear datas no passado): duas chamadas concorrentes de `ficha_abrir` (duas conexões `pg`) → uma linha aberta; ficha com `criada_em = now()-15d`, `studio_aberto_em = now()-3d` → continua aberta; ficha inativa há 15 d → `descartada_em` preenchido, nova aberta devolvida, e a notificação `ficha-lembrar:<id antigo>` ganha `expired_at`; `iniciar` duas vezes → um registro, a 2ª devolve `ja_iniciada`; registrador detectou `['titulo']` e a ficha tem `['miniatura']` → a linha confirmada fica com os dois campos; o insert do passo 2 grava o `youtube_video_id` de `youtube_videos`; com `detectado` aberto (semeado) → confirma a linha existente (`origem` continua `detectado`, `confirmado_em` preenchido, `variantes` copiadas da ficha), zero linha nova; ficha A iniciada e ficha B aberta no mesmo vídeo → B devolve `ja_ha_teste_em_andamento`, `variantes` de X intactas; ficha de outro site → `nao_encontrada`; 1 variante → `ficha_incompleta`; falha injetada no passo 4 (trigger de teste temporário que lança em `update ab_native_fichas`) desfaz o insert do passo 2; `has_function_privilege('authenticated', 'public.ab_native_iniciar(uuid,uuid,uuid)', 'execute')` = false e para `service_role` = true. O caso "registrador encerra a `detectado` entre o passo 2 e o 3" se prova com a linha já `encerrado` e nenhuma `em_andamento` ao chamar: devolve `estado_mudou` e a ficha fica sem `registro_id`.
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

Estimativa: ~20 mil tokens. **Envio 1a.**

---

### Task 4: `settleOnAir` com motivo `teste_youtube` (curto-circuito sem escrita) — envio 1a

**Files:**
- Modify: `apps/web/src/lib/youtube/ab-settle.ts` (`MotivoSaida` linha 22; `caminhoDe` linha 138; `settleOnAir` linha 487; passo 0b)
- Modify: `apps/web/src/lib/youtube/ab-restore.ts:7` (comentário: `pulado_teste_youtube` agora é escrito pela F1a) e `camposPendentes` (linha 176) só se o teste mostrar que precisa
- Test: `apps/web/test/youtube/ab-settle-teste-youtube.test.ts`; `apps/web/test/integration/ab-f1a-settle-ensaio.test.ts`

**Interfaces:**
- Produces: `MotivoSaida` ganha `'teste_youtube'`; `export const NOTA_TESTE_YOUTUBE = 'Em teste no Studio: pausado sem escrever no YouTube'`. `settleOnAir(id, { siteId, destino: ORIGINAL, motivo: 'teste_youtube' })` devolve `{ resultado: 'feito', campos }`. **Campo a campo (r2, Phil I3):** o campo com estado `ok` ou `pulado_*` **fica como está** (inclusive `escreveu: true`: o histórico não pode passar a dizer que o original não foi escrito quando foi); só o campo ausente, `falhou`, `desistiu` ou `em_andamento` vencido vira `montarCampo(..., { estado: 'pulado_teste_youtube', escreveu: false })`. **Fatos conferidos em 21/10 (resposta à pergunta da Hanna):** o CHECK de produção de `ab_tests.restore_status` e de `ab_test_restores` já aceita `pulado_teste_youtube` (`20261018000004_ab_lab_s8_f1_gravacao.sql:164,178,194`) e o de `ab_test_cycles.end_reason` já aceita `'teste_youtube'` (`:149-151`); a T4 não precisa da migration da T1.

- [ ] **Step 1: testes (portas falsas que lançam se chamadas: `token`, `fetch`, `lerNoYouTube`, escrita):** (a) teste `active` → `status='paused'`, `paused_at`, `restore_seq+1`, `status_note = NOTA_TESTE_YOUTUBE`, todos os campos `pulado_teste_youtube`/`escreveu:false`, zero chamada de porta; (b) teste `paused` com restore `falhou` pendente → vira `pulado_teste_youtube` (o vigia não reescreve depois); (c) `seqEsperado` velho → `mudou` (humano) / `em_andamento` (cron); (d) restore `em_andamento` recente → `em_andamento`; (e) com B no ar (`last_applied_variant_id` = B) → mesmo resultado, zero escrita; (f) ver (k) abaixo, que substitui a versão da r1; (g) `camposPendentes(rs, 'vigia')` → `[]`; (h) token vencido (porta `token` lança) → ainda `feito` (o curto-circuito vem antes de `resolverAcesso`); (i) CAS perdido (zero linhas do `ab_settle_claim`) → `em_andamento` ou `ja_encerrado`, nada gravado; (j) **`paused` com `title: ok/escreveu:true` e `thumbnail: falhou`** → depois de `teste_youtube` o title continua `ok/escreveu:true` e o thumbnail vira `pulado_teste_youtube` (Phil I3); (k) **(f) reescrito, Yannis C3:** com o título atual igual ao título de uma variante nossa (a ficha reaproveitou o título B e B venceu no YouTube), `settleOnAir(..., { motivo: 'encerrado', destino: ORIGINAL, humano: true })` → `precisa_confirmar` (o passo 0b passa a rodar também com destino original quando algum campo de `r.restore_status` está `pulado_teste_youtube`, e nesse ramo pergunta sempre que a decisão for `escrever`); com `forcar: true` → escreve; sem `pulado_teste_youtube` no `restore_status` → comportamento atual; (l) **encerrado depois de `teste_youtube`:** o `status_note` igual a `NOTA_TESTE_YOUTUBE` é limpo no caminho `encerrado`, e `reason`/`learning` (`queries.ts:1259,1273,1309`) não mostram a nota de guarda (Yannis M6); (m) o ciclo aberto de B é fechado: `ab_test_cycles` sem `ended_at is null`, `end_reason = 'teste_youtube'`, `last_applied_variant_id` nulo; teste já `paused` → o `ended_at` do ciclo continua igual ao `paused_at` antigo (Yannis C1).
- [ ] **Step 2:** FAIL. **Step 3 (r2, Yannis C1: um `update` simples contornaria `ab_settle_claim`, deixaria o ciclo de B aberto por 14 a 16 dias e o `last_applied_variant_id` velho continuaria alimentando `decidirThumb`):** em `caminhoDe`, `teste_youtube` → `{ de: ['active','paused'], para: 'paused', endReason: 'teste_youtube', extra: { status_note: NOTA_TESTE_YOUTUBE } }`. Em `settleOnAir`, logo depois de `emAndamentoRecente` e da checagem de `caminho.de` (antes do passo 0b): `if (op.motivo === 'teste_youtube') return gravarPuladoDefinitivo(portas, r, campos, agora)`, função privada que chama `rpc('ab_settle_claim', { p_test_id, p_seq: r.restore_seq, p_de: ['active','paused'], p_para: 'paused', p_end_reason: 'teste_youtube', p_restore_status: <campos já mesclados: ok/pulado_* preservados, o resto pulado_teste_youtube/escreveu:false, attempts 0, em: agora>, p_extra: { status_note: NOTA_TESTE_YOUTUBE } })` (assinatura em `20261018000001_ab_lab_p4a_sair_do_ar_com_seguranca.sql:7`; refazer o `git grep` no dia). Zero linhas → `em_andamento` ou `ja_encerrado`, como o `settleOnAir` já faz. Como o `restore_status` já nasce final (não `em_andamento`), o gatilho `tg_ab_tests_restore_log` grava o histórico na mesma transação. Não chama `avisarRestauracao`. No passo 0b: rodar também com destino original quando houver `pulado_teste_youtube` (ver (k)); no caminho `encerrado`, limpar `status_note` se for `NOTA_TESTE_YOUTUBE`. **Step 4:** PASS, e a suíte existente `test/youtube/ab-settle*.test.ts` continua verde.
- [ ] **Step 5: ensaio no banco 54421** (Phil M-r8-2, gated em `ab-f1a-settle-ensaio.test.ts`): semear site, vídeo, `ab_tests` `active` com 2 variantes e uma `ab_native_tests` confirmada; chamar `settleOnAir(teste_youtube)` com o cliente real do 54421 e mock da Data API sem `update`; afirmar a linha final de `ab_tests` e que `ab_test_restores`/histórico (se houver gatilho) ficou consistente com `ab-restore-status-forma.test.ts`.
- [ ] **Step 6:** commit `feat: settleOnAir com motivo teste_youtube, pausa definitiva sem escrita`.

**Aceite:** (a)–(m) e o ensaio verdes. Estimativa: ~140 mil tokens. **Envio 1a.**

---

### Task 5: Guarda pura e leitura em lote — envio 1a

**Files:**
- Create: `apps/web/src/lib/youtube/teste-youtube/nativo/guarda.ts`
- Test: `apps/web/test/youtube/teste-youtube/nativo/guarda.test.ts`

**Interfaces:**
- Produces:
  - `export interface LinhaAberta { id: string; video_id: string; confirmado_em: string | null; updated_at: string }`
  - `export async function bloqueadoPorTesteNativo(sb: SupabaseClient, siteId: string, videoIds: readonly string[]): Promise<{ ok: true; linhas: Map<string, LinhaAberta> } | { ok: false; erro: string }>` — uma consulta (`ab_native_tests`, `estado='em_andamento'`, `site_id`, `video_id in (...)`), paginada como `registro/ler.ts`. **Um site por chamada** (r2, Yannis C8): quem chama com testes de vários sites agrupa por `site_id` e faz uma consulta por site (a rotação lê os testes `active` de todos os sites, `ab-rotate-phases.ts:226-232`; passar `tests[0].site_id` faria os outros sites escreverem, falha aberta). Só consome `ab_native_tests.estado`, `confirmado_em` e `updated_at`, que já existem em produção: **não depende da T1**.
  - `export type DecisaoGuarda = { acao: 'seguir' } | { acao: 'seguir_e_anotar'; nativeTestId: string } | { acao: 'pausar_sem_escrever'; nativeTestId: string; motivo: 'confirmado' | 'detectado' }`
  - `export function decidirGuarda(linha: LinhaAberta | undefined, modo: ModoPausaDetectado): DecisaoGuarda` — sem linha → `seguir`; confirmada → `pausar_sem_escrever/confirmado` nos três modos; detectada: `off` → `seguir`, `log` → `seguir_e_anotar`, `on` → `pausar_sem_escrever/detectado`.
  - `export function inicioDoTeste(r: { primeira_vista: string | null; confirmado_em: string | null; created_at: string }): Date` — menor não nulo entre `primeira_vista` e `confirmado_em`, senão `created_at`.
  - `export const MARGEM_FECHAMENTO_DIAS = 2`

- [ ] **Step 1: testes:** tabela de `decidirGuarda` (3 modos × {sem linha, detectada, confirmada}, e uma `origem='detectado'` com `confirmado_em` preenchido = confirmada); `inicioDoTeste`: detecção no dia 0 e confirmação no dia 3 → dia 0; só `created_at` → `created_at`; N=50 vídeos → uma ida ao banco (contador no falso de `test/helpers/fake-supabase.ts`); erro do banco → `{ ok: false }`, nunca mapa vazio.
- [ ] **Step 2–4:** FAIL → implementar → PASS. **Step 5:** commit.

Estimativa: ~50 mil tokens. **Envio 1a.**

---

### Task 6: Guarda nos pontos de escrita do nosso teste — envio 1a

**Files:**
- Modify: `apps/web/src/lib/youtube/ab-start.ts` (`startAbTestInternal`, linha 196: depois de validar `status === 'draft'`, antes da reivindicação; o retorno ganha `codigo?: 'teste_youtube' | 'guarda_falhou'`, Yannis C7)
- Modify: `apps/web/src/lib/youtube/ab-resume.ts` (`retomarTeste`, linha 93: depois de `status !== 'paused'`)
- Modify: `apps/web/src/lib/youtube/ab-rotate-phases.ts` (`phaseRotateActiveTests`, linha 224: uma consulta antes do laço; `phaseProcessQueue`, linha 98: recusa nativa adia sem contar tentativa)
- Modify: `apps/web/src/app/cms/(authed)/youtube/ab-lab/actions.ts` (`forceRotate`, linha 997; Review Focus 1)
- Modify: `apps/web/src/lib/youtube/ab-settle.ts` (`settleOnAir`: leitura da linha **confirmada** do vídeo, depois das validações e antes do passo 0b) e `apps/web/src/lib/youtube/ab-restore-acoes.ts` (`novaTentativa`, linha 72: idem, depois do passo 2) (Yannis C2)
- Create: `apps/web/src/lib/youtube/teste-youtube/nativo/anotar-log.ts`
- Test: `apps/web/test/youtube/ab-guarda-nativa.test.ts`; `apps/web/test/integration/ab-f1a-guarda.test.ts`

**Interfaces:**
- Consumes: `bloqueadoPorTesteNativo`, `decidirGuarda` (T5), `modoPausaPorDetectado` (T3), `settleOnAir(teste_youtube)` (T4).
- Produces: **(Yannis C2) a guarda de linha confirmada dentro de `settleOnAir` e `novaTentativa`** (um ponto só em vez de N chamadores): leitura `ab_native_tests where video_id = r.youtube_video_id and site_id = r.site_id and estado = 'em_andamento' and confirmado_em is not null limit 1`, **sem flag**. Achou e o motivo é `pausa`, `falha_api`, `drift` ou `duracao_maxima` → troca para o curto-circuito `teste_youtube` da T4 (zero escrita, o teste fica `paused`); achou e é `encerrado`, `reverter` ou `novaTentativa` → devolve o resultado novo `{ resultado: 'teste_youtube', motivo: MOTIVO_RECUSA_NATIVO }`, sem reivindicar; erro na leitura → lança (o chamador já trata exceção do `settle`: falha fechada). **Uma tentativa extra imediata dentro da mesma chamada, só para erro de rede/5xx (não para 4xx)** (Yannis M14: a rotação roda 1×/dia às 08:00 UTC e um erro passageiro pularia o dia inteiro; dívida declarada se recusada: gatilho, o 1º dia perdido em `RotateResult.errors`). Custo: 1 consulta por `settle` (menos de 10 por dia). Cobre `pauseAbTest` (`actions.ts:727`), `endAbTest` (`:807`), `revertWinner` (`:1188`), `retryRestore`/vigia (`ab-restore-acoes.ts:72`) e `duracao_maxima` (`ab-evaluate-phases.ts`, fase 2).
- Produces: `export const MOTIVO_RECUSA_NATIVO = 'Há um teste do YouTube em andamento neste vídeo. Espere o resultado ou encerre o teste no Studio.'` (texto provisório; o Logan fecha sem mockup, §7) ; `export async function anotarPausaDetectado(sb, a: { siteId: string; orgId: string | null; testId: string; videoId: string; nativeTestId: string; ponto: 'rotacao' | 'start' | 'retomar' | 'forcar' | 'fila' }): Promise<void>` (insert em `audit_log` com `site_id: a.siteId` e `org_id` quando houver (Phil M1, como `ab-restore-acoes.ts:53`), `action: 'ab_pausa_detectado_log'`, `resource_type: 'ab_test'`, `resource_id: testId`, `actor_user_id: null`, `after_data: { test_id, video_id, native_test_id, ponto, confirmado_em_nulo: true }`; erro vai a `console.error` + Sentry, não lança). **Quando anotar (r2, Phil I1):** só no ponto em que a escrita **sairia**: na rotação, depois de `todayCycle`, do marcador em voo e do filtro de tipo, antes da reivindicação; em `start`, `retomar`, `forceRotate` e fila, quando a decisão em `on` seria recusar (em `log` seguem sem recusar). Sem isso o número lido em ~31/10 para decidir o `on` sai inflado na rotação (disparo duplicado do cron, teste já girado hoje) e cego nos outros quatro pontos.

- [ ] **Step 1: testes (unidade, banco falso, mock da Data API que registra `update`):**
  - **variável apagada** (`delete process.env.AB_PAUSA_POR_DETECTADO`): rotação com `detectado` aberta **escreve** (o mock recebe o `update`), `status` `active`, zero insert em `audit_log`, `status_note` intacta; `start` e `retomar` com `detectado` seguem como hoje.
  - `log`: mesma escrita; exatamente uma linha `ab_pausa_detectado_log` com `site_id`, `test_id`, `video_id`, `native_test_id`, `ponto`; **com `todayCycle` presente não grava anotação; dois disparos no mesmo dia gravam uma; `start` em `log` com `detectado` grava uma com `ponto='start'` e não recusa** (idem `retomar`, `forcar`, `fila`); `status_note` com motivo existente intacta; nenhuma recusa; um teste concluído que passou pelo `log` não tem texto de guarda em `reason`/`learning` (`queries.ts`).
  - `on`: rotação com `detectado` → zero escrita, `paused/pulado_teste_youtube`; `start`, `retomar` e `forceRotate` (Yannis M10, pela mesma `decidirGuarda`) recusam com `MOTIVO_RECUSA_NATIVO`.
  - linha confirmada, nos três modos: rotação → zero escrita e `settleOnAir(teste_youtube)`; `start`, `retomar` e `forceRotate` recusam; **por motivo de `settleOnAir` (Yannis C2):** `pausa`, `falha_api`, `drift`, `duracao_maxima` → zero escrita e o teste fica `paused/pulado_teste_youtube`; `encerrado`, `reverter` e `novaTentativa` (vigia, `restore falhou` pendente) → recusa com `MOTIVO_RECUSA_NATIVO`, mock da Data API que lança no `update`; sem linha → comportamento atual (a suíte `ab-settle*` existente continua verde); erro na leitura → `settleOnAir` lança.
  - `'true'` → comporta-se como `off`.
  - N testes ativos do mesmo site → uma consulta de guarda (sem N+1); **2 sites, linha confirmada só no site B → o teste de B não escreve e o de A escreve, e o contador de idas ao banco é 2** (Yannis C8).
  - erro na consulta de guarda: `start`/`retomar` recusam com "não foi possível conferir o teste do YouTube"; a rotação pula todos os testes do ciclo sem escrever, manda Sentry **e soma os testes pulados em `RotateResult.errors`** (o `cron-health` acende vermelho; Phil M2 = Yannis M9); falha fechada, nunca escreve sem conferir; **consulta que falha 1× e acerta na tentativa extra (erro 5xx) → rotação escreve normalmente, sem Sentry; erro 4xx → sem tentativa extra** (Yannis M14).
  - fila (`phaseProcessQueue`) com linha confirmada no vídeo → `status='queued'`, `queue_start_after` = amanhã 00:00 UTC, `queue_start_failures` **igual**, `status_note` com o motivo (Review Focus 2); erro injetado na guarda (`codigo: 'guarda_falhou'`) → idem; recusa por outro motivo → conta como hoje. `adiarSemContar(supabase, queued, motivo)` faz o mesmo `update` de `adiarInicioDaFila` sem incrementar `queue_start_failures`; o aviso sai **uma vez por par (teste, registro nativo)**, `dedup_key 'ab-queue-nativo:' || test || ':' || native` (Phil M3; ≤ 18 adiamentos na espera máxima, sem ~18 avisos iguais). O playoff (`ab-evaluate-phases.ts:37`) tenta de novo todo dia; acrescentar Sentry de nível info com o `codigo`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Ordem dentro de `settleOnAir` (Yannis, r2):** a guarda de linha confirmada vem **antes** do ramo `teste_youtube` da T4 (ela converte `pausa`, `falha_api`, `drift` e `duracao_maxima` em `teste_youtube`), e a leitura é **dispensada quando o motivo já é `teste_youtube`** (a chamada de `confirmarTesteNoStudio`, T9, não repete a consulta). Na rotação, a consulta usa os `youtube_video_id` (uuid de `youtube_videos`, `ab-rotate-phases.ts:262`) de todos os testes do ciclo. **Step 4:** PASS; suíte existente de `ab-rotate*`, `ab-resume*`, `ab-start*` verde.
- [ ] **Step 5: integração gated** (`ab-f1a-guarda.test.ts`, flag `on` por `vi.stubEnv`): linha `detectado` semeada → rotação pausa sem escrever. O trecho "→ \"Não é teste\" → `retomar` aceita" **só existe com a Tarefa 10** (envio 1b); no envio 1a o teste para em "pausa sem escrever" (a guarda não depende dele) e a Tarefa 10 o completa.
- [ ] **Step 6:** commit `feat: guarda do teste do YouTube em iniciar, retomar, rotação, forçar e fila (flag AB_PAUSA_POR_DETECTADO)`.

**Aceite:** todos os casos acima; nenhum teste existente quebrado. Estimativa: ~190 mil tokens. **Envio 1a.**

---

### Task 7: Roteador nativo × nosso e leitura do formato — envio 1b (sem consumidor até a F1a-tela-1: se o 1b apertar, é a primeira a passar para o plano da F1a-tela-1, sem perda de dado; Hanna H4)

**Files:**
- Create: `apps/web/src/lib/youtube/teste-youtube/nativo/roteador.ts` (puro)
- Create: `apps/web/src/lib/youtube/teste-youtube/nativo/formato-borda.ts`
- Modify: a migration da Tarefa 1 (RPC `ab_lab_formato_atual(p_site uuid, p_ids text[])`, `security invoker`, `set search_path = ''`, `distinct on (youtube_video_id) ... order by youtube_video_id, observed_at desc, id desc`, execute só para `service_role`)
- Test: `apps/web/test/youtube/teste-youtube/nativo/roteador.test.ts`, `formato-borda.test.ts`

**Interfaces:**
- Produces:
  - `export interface Formato { isShort: boolean | null; kids: boolean | null; adulto: boolean | null; aoVivo: boolean | null }`
  - `export function lerFormatoDoBruto(raw: unknown): Pick<Formato, 'kids' | 'adulto' | 'aoVivo'>` — `status.madeForKids`, `contentDetails.contentRating.ytRating === 'ytAgeRestricted'`, `snippet.liveBroadcastContent in ('live','upcoming')`; ausente/tipo errado → `null`.
  - `export type Caminho = { tipo: 'nativo'; portao: boolean; motivo: string } | { tipo: 'nosso'; motivo: string } | { tipo: 'nao_confirmado'; motivo: string } | { tipo: 'sem_volume'; motivo: string }`
  - `export function caminhoDoTeste(e: { formato: Formato; idadeDias: number; impressoesAcimaDoPiso: boolean | null }): Caminho` — precedência de §5.1 (kids/18+/ao vivo `true` → nosso; `isShort true` → nosso; falta `isShort` ou kids → `nao_confirmado`; idade < 7 → nativo sem portão; ≥ 7 sem volume → `sem_volume` "Sem volume para teste. Trocar direto?"; senão nativo com portão). O piso numérico é do Phil (§5.4) e entra como booleano já calculado.
  - `export async function lerFormatos(sb, siteId: string, videos: { id: string; ytId: string }[]): Promise<Map<string, Formato>>` — **uma** chamada ao RPC `ab_lab_formato_atual` (r2, Phil M7 = Yannis M4: **RPC, não `.in` + ordenação no cliente**, que traz todas as versões do `raw` jsonb de cada vídeo e esbarra no `max_rows = 1000` de `supabase/config.toml:15`, e o mais recente some em silêncio; usa o índice `idx_yt_own_video_state_raw_video`) e uma consulta em `yt_own_video_meta_daily` (última por vídeo); fallback `youtube_videos.duration_seconds > 180 ⇒ isShort false`.
  - `export async function formatoNaAbertura(sb, siteId, video, portas: { videosList?: (ytId: string) => Promise<unknown> }): Promise<Formato>` — se não há bruto, chama `videosList` (`part=status,contentDetails,snippet`, 1 unidade) **uma vez**, lê com `lerFormatoDoBruto`, não grava.
- [ ] **Step 1: testes:** a tabela inteira de §5.1 (`isShort` true/false/null × kids true/false/null), 18+ true com `isShort` false → nosso, `upcoming` → nosso, bruto sem `status` → kids null; portão: idade 0/6/7/8 d × impressões abaixo/acima; vídeo sem meta, `duration_seconds = 1200`, sem bruto → com `videosList` (kids false) nativo, sem a porta `nao_confirmado` com motivo "ainda não lido"; `lerFormatos` com 30 vídeos → 2 idas ao banco; **3 versões do bruto por vídeo → só a mais nova é lida** (teste de integração com o RPC); `has_function_privilege('authenticated', 'public.ab_lab_formato_atual(uuid,text[])', 'execute')` = false; `formatoNaAbertura` nunca grava (falso de banco sem insert).
- [ ] **Step 2–4:** FAIL → implementar → PASS. **Step 5:** commit.

Estimativa: ~100 mil tokens.

---

### Task 8: Ficha gravada: abrir, salvar, "Abrir no Studio", "Lembrar no computador" — envio 1b

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
- [ ] **Step 1: testes:** recarregar (`abrirFicha` 2×) devolve as mesmas variantes; ficha só com o original grava; os 4 casos do Review Focus 4 recusados e nada gravado; `lembrarNoComputador` 2× → **uma** linha em `notifications` (`type: 'youtube.native_ficha_lembrar'`, `dedup_key 'ficha-lembrar:<id>'`, `user_id` = quem tocou, `action_href` de Global Constraints) e o 2º devolve `jaLembrado: true` com a data; erro de `createNotification` volta como `{ ok: false }`, `lembrar_em` não gravado; **notificação criada e `update` de `lembrar_em` falhou** (Yannis M7): o 2º toque grava `lembrar_em` (a deduplicação devolve a notificação existente) e responde `jaLembrado: true`; `enviada`: Studio aberto há 20 d e "Lembrar" ontem → `true`; ficha de 13 d sem marcador → `enviada` true, de 15 d → false (relógio injetado); id de outro site → "não encontrado"; usuário sem permissão (`requireEditUser` lança) → recusa antes de qualquer leitura; a ficha nunca aparece em `bloqueadoPorTesteNativo` nem em `lerCandidatos` do registrador (integração).
- [ ] **Step 2–4:** FAIL → implementar (abrir chama `rpc('ab_native_ficha_abrir')`) → PASS. **Step 5:** commit.

**Aceite:** acima, mais a suíte de `ab-lab/actions` verde depois da mudança de `requireEditUser`. Estimativa: ~130 mil tokens. Dívida declarada (Yannis): existe uma cópia de `requireEditUser` em `competitors/actions.ts`; unificar fica fora deste lote.

---

### Task 9: "Já iniciei", "Confirmar" (marcador) e a pausa do nosso — envio 1b

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

### Task 10: "Não é teste / Liberar o Lab" (só a action) — envio 1b

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

### Task 11: Resposta do dia 14 (aditiva) — envio 1b

**Files:**
- Create: `apps/web/src/lib/youtube/teste-youtube/nativo/resposta.ts`
- Modify: `actions-nativo.ts`
- Test: `apps/web/test/youtube/teste-youtube/nativo/resposta.test.ts`, `apps/web/test/integration/ab-f1a-resposta.test.ts`

**Interfaces:**
- Produces: `export type RespostaDono = 'venceu_nova' | 'ficou_igual' | 'inconclusivo' | 'nao_vi'`; `export function derivadasDeVariantesTitulo(variantesTitulo: unknown): VarianteFicha[] | null` (r2, Yannis C5: linha `detectado` confirmada pelo "Confirmar" do cartão S7, sem ficha, tem `variantes` nulo; monta `{n, tipo: 'titulo', titulo}` a partir de `variantes_titulo`, que o CHECK garante não nulo para `origem = 'detectado'`); `export function patchDaResposta(r: RespostaDono, n: number | null, variantes: VarianteFicha[] | null): { sempre: Record<string, unknown>; seEmAndamento: Record<string, unknown> } | { erro: 'variante_invalida' }` (tabela de §5.3 literal; chamada com `variantes ?? derivadasDeVariantesTitulo(variantes_titulo)`; `vencedor_titulo` quando a variante `n` tem título; **`n = 1` recusado em `venceu_nova` só quando `variantes` vem da ficha: o original não é "a nova"**, Phil C1; r3, Yannis N4: o 3º parâmetro vira `variantes: { itens: VarianteFicha[]; origem: 'ficha' | 'derivada' } | null`; `origem = 'derivada'` mapeia `n = índice + 1` em `variantes_titulo` (união das evidências do registrador, sem garantia de o índice 0 ser o título anterior), o dono escolhe entre os títulos listados (`n` de 1 a 3), grava `vencedor_titulo = variantes_titulo[n-1]` e `variante_vencedora = n`; o CHECK 3 condicional da T1 (r4: derivada 1..3, ficha 2..3)); `export async function responderDia14(p: { sb; siteId; userId; registroId; lido; resposta; n: number | null; agora: Date }): Promise<{ ok: true; conflito: { youtube: string; dono: string } | null } | { ok: false; erro: string }>` — grava `sempre` (`resposta_dono`, `respondido_em`, `variante_vencedora`; **`variante_vencedora: null` explícito em toda resposta diferente de `venceu_nova`**, Yannis N3, senão o CHECK 3 recusa com erro cru); **a resposta do dono vale uma vez (r3, Yannis N3):** o `update` leva `and (resposta_dono is null or resposta_dono = 'sem_resposta')`; zero linhas depois da releitura → `{ ok: false, erro: 'ja_respondido' }` (também fecha a corrida de duplo toque no botão do e-mail e do sino); `sem_resposta` (fechada por nós) seguida de resposta → aceita; **PENDENTE DO DONO (r2, Phil I2; amplia o §5.3, que só dizia `em_andamento`): se a linha está `em_andamento` OU (`sem_desfecho` E `vencedor_fonte is null`; sem veredito concorrente), junta `seEmAndamento` (`estado='encerrado'`, `desfecho_estado`, `desfecho_motivo = 'resposta_do_dono'` (Phil R2: sem isso o cartão mostra "vencedor provável" com motivo "sem resposta"; texto livre, a coluna não tem CHECK, `20261018000006:26`), `vencedor_*`, `encerrado_em` mantido) no mesmo `update`**, com CAS `updated_at`; com `vencedor_fonte` presente (outra fonte, `data_api` ou `regra`) → guarda `sempre` e devolve `conflito` (o comportamento do spec); se o CAS perde, relê **uma vez** e reavalia a elegibilidade (nunca erro cru); expira `lembrete-nativo:<id>` em `notifications`. Resposta sobre linha fechada por nós (`resposta_dono='sem_resposta'`, `respondido_em` nulo) sobrescreve `resposta_dono` e preenche `respondido_em`. **Se o dono disser não à ampliação:** trocar o ramo `sem_desfecho` por uma leitura única `desfechoFinal(linha)` (a resposta do dono vence quando não há veredito da `data_api`), usada por todo leitor (cartão S7, Cowork), e remover o ramo do `update`. Action `responderTesteDoYouTube(...)`.
- [ ] **Step 1: testes:** um caso por botão grava a linha da tabela; **linha `detectado` confirmada pelo "Confirmar" (sem ficha) com `variantes_titulo` de 2 itens, "Venceu a nova" n=2 → `vencedor_titulo` igual ao 2º título e `vencedor_fonte='dono'`** (Yannis C5); `n=1` em `venceu_nova` **com ficha** → `variante_invalida`; **linha `detectado` confirmada sem ficha, `variantes_titulo = ['A','B']`, "Venceu a nova" n=1 → `vencedor_titulo = 'A'`, fonte `dono` (Yannis N4)**; **origem `derivada` (Phil M1, r4): a pergunta da F1a-tela-1 é "qual título venceu?" listando os títulos de `variantes_titulo`, nunca "venceu a nova" (o índice 0 pode ser o original); texto da notificação, se citar o resultado, idem; anotar no spec §5.3 e na F1a-tela-1**; **duas respostas seguidas → a 2ª devolve `ja_respondido` e a linha fica igual à da 1ª; `sem_resposta` seguida de resposta → aceita; `ficou_igual` grava `variante_vencedora` nula (Yannis N3)**; **a linha do dia 17 termina com `desfecho_motivo = 'resposta_do_dono'` e `encerrado_em` inalterado (Phil R2)**; **linha `sem_desfecho/sem_dado/oficial_nao_lido` sem fonte + "Venceu a nova" n=2 → `encerrado/vencedor_provavel/dono` e o CHECK não estoura (Phil C1); linha `sem_resposta` respondida no dia 17 → idem (PENDENTE DO DONO); linha com `vencedor_fonte='data_api'` → `conflito`**; 3 variantes → `n=3` grava, `n=4` recusa; "Venceu a nova" só de miniatura passa no CHECK novo; registrador encerrou com `vencedor_fonte='data_api'` e dono diz outra → guarda as duas, devolve `conflito`; dono e registrador ao mesmo tempo → linha consistente, nunca vencedor sem fonte; responder derruba o número de `/api/notifications/count` (integração, lê o que o sino lê); erro de escrita volta como `{ ok: false }`; sem permissão recusado.
- [ ] **Step 2–4:** FAIL → implementar → PASS. **Step 5:** commit.

**Dívida declarada (Yannis):** `variante_vencedora` com dois papéis (resposta do dono e veredito de linha sem fonte), preso pelo CHECK 3 à resposta; gatilho: leitor novo que trate `variante_vencedora` como veredito; saída: `desfechoFinal(linha)` único para todo leitor (cartão S7, Cowork), na F1a-tela.

Estimativa: ~110 mil tokens.

---

### Task 12: Tarefa `avisos_pendentes` (lembrete do dia 14 e fechamento `sem_resposta`) — envio 1c

**Files:**
- Modify: `apps/web/src/lib/youtube/agenda/definicoes.ts` (definição `avisos_pendentes`: `peso: 'leve'`, `periodo: 'dia'`, `aPartirDaHoraSP: 9`, **sem `ligaCom`** (r2, Yannis C6: amarrar ao `AB_NATIVO_REGISTRO` faria o recuo natural do registrador, `off`, deixar a linha confirmada sem lembrete nem fechamento e o Lab bloqueado no vídeo sem aviso; o desligamento operacional já existe por `OBS_AGENDA_TASKS_OFF`; a tarefa não faz nada sem linha devida); tempos de tarefa leve como `marcas_de_idade`) — **território da A5: só o push espera a regra de §7**
- Modify: `apps/web/src/lib/youtube/agenda/catalogo.ts` (uma importação, uma entrada)
- Create: `apps/web/src/lib/youtube/agenda/tarefas/avisos-pendentes.ts`
- Create: `apps/web/src/lib/youtube/teste-youtube/nativo/avisos.ts` (núcleo: quem lembrar, quem fechar)
- Test: `apps/web/test/youtube/teste-youtube/nativo/avisos.test.ts`, `apps/web/test/youtube/agenda/avisos-pendentes.test.ts`, `apps/web/test/youtube/agenda/catalogo.test.ts` (caso novo)

**Interfaces:**
- Consumes: `inicioDoTeste`, `MARGEM_FECHAMENTO_DIAS` (T5). Depende da T1 em produção (colunas do dia 14), não de constante.
- Produces: `export function devidosDoLembrete(linhas, agora: Date): string[]` (`estado in ('em_andamento','encerrado','sem_desfecho')`, `confirmado_em is not null` (**sem corte por `created_at`**, Phil M6 = Yannis M2), `resposta_dono is null`, `lembrete_notificado_em is null`, `notificacao_falhou_em is null`, `inicioDoTeste + 14 d <= agora`); `export function devidosDoFechamento(linhas, agora): string[]` (`em_andamento`, `confirmado_em is not null`, `resposta_dono is null`, `inicio + 16 d <= agora` **e** (`lembrete_notificado_em <= agora - MARGEM_FECHAMENTO_DIAS` **ou** `notificacao_falhou_em is not null`); r2, Phil I2: nunca fecha por silêncio uma pergunta que não saiu; uma `detectado` vista há 20 dias e confirmada hoje recebe o lembrete hoje e só fecha daqui a 2 dias; lembrete que falhou nos dias 14 e 15 e saiu no 16 não fecha no mesmo dia); o fechamento grava `resposta_dono='sem_resposta'`, `respondido_em` nulo (o CHECK da T1 separa "o dono disse" de "o sistema fechou por silêncio") e `desfecho_motivo='sem_resposta'`; tarefa `avisosPendentes: Tarefa`. A parte do nicho (`niche_signals`) é da F2 e entra depois nesta mesma tarefa.
- [ ] **Step 0 (Yannis M12):** a tarefa lê colunas da T1; se rodar antes da migration (rollback do banco, ordem de deploy trocada) falharia com 42703 e ficaria vermelha por motivo opaco. Molde do registrador: `schemaTablesReady` e `parcial/schema_ausente` (`registro/tarefa.ts:~108`; refazer o `git grep`). Teste: coluna ausente → `parcial` com motivo, sem exceção.
- [ ] **Step 1: testes:** Review Focus 3 (13 d 23 h não, 14 d sim; fechamento só com `inicio + 16 d` **e** lembrete enviado há ≥ 2 d ou falho); **detecção há 20 dias e confirmação hoje → lembrete hoje, fechamento só em hoje + 2; lembrete falhou 3× → fecha; lembrete saiu no dia 16 → não fecha no dia 16** (Phil I2); **resposta no dia 17 numa linha `sem_resposta` → vira `encerrado/vencedor_provavel/dono` (PENDENTE DO DONO, com a T11)**; `detectado` não confirmado no dia 15 → nenhuma notificação; confirmado → uma; `descartado` → nenhuma; **`created_at` antes da migration com `confirmado_em` depois → lembra** (Phil M6); lembrete com dono sem preferência → uma linha em `notifications` e uma entrega `email` (`defaultChannels: ['email']`); com `channel_email = false` → só o sino; `total === 0` é erro e conta tentativa; falha na 1ª e sucesso na 2ª não duplica; 3 falhas → `notificacao_falhou_em`, tarefa `erro` com motivo, sem reenvio depois; fechamento grava `sem_desfecho/sem_dado/sem_resposta` com `resposta_dono='sem_resposta'`, `respondido_em` nulo, CAS `updated_at` (perdeu → pula, conta), expira `lembrete-nativo:` e libera o `start` do nosso; registrador fecha antes do dia 14 → o lembrete ainda sai; **variável `AB_NATIVO_REGISTRO` apagada → `avisos_pendentes` continua ligada** (`catalogo.test.ts`; substitui o caso da r1, que afirmava o contrário, Yannis C6); zero linha devida → `ok` com `detalhe.lembrados = 0, fechados = 0`.
- [ ] **Step 2–4:** FAIL → implementar → PASS. **Step 5:** commit.

**Aceite:** acima; `catalogo.test.ts` verde. Estimativa: ~140 mil tokens. **Envio 1c** (espera a regra de §7 para `agenda/definicoes.ts`; teto: antes do 1º dia 14, início de dezembro; o lembrete só vale para linha confirmada, que só existe depois da F1a-tela-1).

---

### Task 13: Troca observada nos concorrentes (§5.8, r13) — ISOLADA, envio 2

> Reescrita na r2 conforme a §5.8 da r13 (cursor, junção, `sem_publicacao`, flag, dry-run, migration nova do registro de purga) mais Phil N8, N10 e Yannis M2, que a spec deixou com o plano (§23). Não é dependência de nenhuma outra tarefa, tem migrations próprias e vai num commit e num push próprios; se a §5.8 mudar, só ela muda. Dado de aprendizado do nicho: **não é o teste do dono e não entra em nenhuma guarda**. Rótulo: `sequencial` = "troca observada"; `alternada` = "possível teste do YouTube" (nunca "teste" sem "possível", nunca "venceu").

**Files:**
- Create: `supabase/migrations/<ts>_ab_native_observados.sql` (por `npm run db:new ab_native_observados`): `ab_native_observados` e `ab_native_obs_cursor`. **Migration separada** da T1 (o risco de uma não segura a outra).
- Create: `supabase/migrations/<ts>_ab_native_observados_registro.sql` (por `npm run db:new ab_native_observados_registro`, **depois** da anterior): `create or replace function public.obs_archive_registry()` com a lista inteira mais as duas linhas novas (Phil N10, Yannis M2) **e** `create or replace function public.competitor_channel_remove_archived(...)` por cópia do corpo vigente, com as duas tabelas na purga (Yannis N1, abaixo). Não se edita `20261021000002`.
- Modify: `apps/web/src/lib/youtube/observatorio/arquivo/cli.ts` (`TABELAS_COM_IDENTIDADE`, ~linha 217: acrescentar `'ab_native_observados'`, cuja `id` é `generated always as identity`; lista fixa conferida contra o catálogo, e a recarga de arquivo deixaria a sequência atrás do `max(id)`)
- Create: `apps/web/src/lib/youtube/teste-youtube/observados/inferir.ts` (puro) e `observados/selecao.ts` (puro: quais alvos avaliar)
- Create: `apps/web/src/lib/youtube/teste-youtube/observados/passo.ts` (borda: lê alvos concorrentes, grava)
- Create: `apps/web/src/lib/youtube/teste-youtube/observados/estado-de-leitura.ts` (os três estados por campo, para a F2; puro com a consulta injetada)
- Modify: `apps/web/src/lib/youtube/teste-youtube/registro/tarefa.ts` (`rodarRegistro`, linha 106: depois dos próprios e antes de `podar`, com o tempo que sobrar, atrás da flag)
- Modify: `docs/ops/env-vars.md` (`OBS_TROCAS_CONCORRENTE`, padrão `off`)
- Modify: o teste da lista fechada `observatorio-a5-e10-lista-fechada.test.ts` (as duas tabelas novas, o par de poda)
- Test: `apps/web/test/youtube/teste-youtube/observados/{inferir,selecao,passo,estado-de-leitura,pureza}.test.ts`, `apps/web/test/integration/ab-native-observados.test.ts`, `apps/web/test/integration/ab-native-observados-registro.test.ts`

**Interfaces:**
- **`ab_native_observados`** (§5.8): `id bigint generated always as identity primary key` (por isso entra em `TABELAS_COM_IDENTIDADE`, `arquivo/cli.ts`), `site_id` (FK `sites`, cascade), `youtube_video_id text check (~ '^[A-Za-z0-9_-]{11}$')`, `campo text check (campo in ('titulo','miniatura'))` (**um estado por campo**: título oscilando não esconde miniatura estável), `tipo_troca text check (in ('sequencial','alternada'))`, `veredito`, `versao_regra smallint`, `trocas jsonb` (corridas em ordem com versão, `primeira_vista`, `ultima_vista`; **teto de 20 corridas e ≤ 1000 bytes por corrida**, CHECK de `jsonb_array_length <= 20`; `n_versoes` continua contando), `n_versoes smallint check (n_versoes >= 2)`, `ficou jsonb` (do campo: `miniatura_id`/`dhash` ou texto normalizado), `ficou_estado text check (in ('estavel','em_andamento','sem_desfecho'))`, `motivo text` (preenchido em `sem_desfecho`), `primeira_troca_em`, `ultima_atualizacao_em`, **`unique (site_id, youtube_video_id, campo)`**, índice por `ultima_atualizacao_em`. RLS como `yt_watch_*` (`20261018000005:106-116`: `can_view_private_site(site_id)` se existir, senão `can_edit_site(site_id)`; `revoke` de `anon` e da escrita de `authenticated`); escrita só `service_role`.
- **`ab_native_obs_cursor`** (mesma migration; ~176 linhas × ~100 B): `site_id`, `youtube_video_id` (mesmo CHECK), `avaliado_ate_rodada int not null`, `avaliado_em timestamptz not null`, `avaliado_motivo text not null check (avaliado_motivo in ('ok','sem_publicacao'))`, `unique (site_id, youtube_video_id)`. **Gravada ao fim de toda avaliação, com ou sem troca**, e também com `avaliado_motivo = 'sem_publicacao'` (não reavaliar a cada disparo); `ok` só quando o alvo foi de fato avaliado. Mesma RLS. Poda de 365 d após `avaliado_em`; a de `ab_native_observados` é de 365 d após `ultima_atualizacao_em`; em lote com limite; as duas entram na lista fechada. A linha **não** segura o bruto (`reter_ate` de concorrente não é estendido).
- **Registro de purga (Phil N10, Yannis M2).** A migration `..._registro` **não escreve a lista de memória**: copia o corpo vigente de `20261021000002_observatorio_a5_remover_canal_f1.sql` (linhas 87-175; **lido do banco migrado**: `select pg_get_functiondef('public.obs_archive_registry()'::regprocedure)` no `bythiago_int` com todas as migrations aplicadas, para pegar qualquer emenda posterior) e acrescenta, **no fim**, as duas linhas com as **cinco colunas** `(table_name, filter_sql, period_sql, sum_sql, order_sql)`:
  ```sql
  ('ab_native_observados',
   't.site_id = (select c.site_id from public.competitor_channels c where c.id = $1) and t.youtube_video_id in (select v.video_id from public.competitor_videos v where v.competitor_channel_id = $1)',
   '(t.primeira_troca_em at time zone ''UTC'')::date', 't.id + t.n_versoes', 't.id'),
  ('ab_native_obs_cursor',
   't.site_id = (select c.site_id from public.competitor_channels c where c.id = $1) and t.youtube_video_id in (select v.video_id from public.competitor_videos v where v.competitor_channel_id = $1)',
   '(t.avaliado_em at time zone ''UTC'')::date', 't.avaliado_ate_rodada', 't.site_id, t.youtube_video_id')
  ```
  (`sum_sql` é obrigatório: sem ele o diff só confere a contagem por mês e uma troca de linha passa). Guarda no topo, como a da F1: o registro instalado tem de ser exatamente as 30 entradas esperadas **ou** as 32 (idempotência), senão `raise exception` pedindo reconciliação. `revoke ... from public, anon, authenticated; grant ... to service_role`. **A purga (r3, Yannis N1, conferido em `20261021000002:210-358`):** a lista do registro **sozinha não apaga nada**. `competitor_channel_remove_archived` apaga `yt_watch_readings/thumbs/alvos` por código explícito (`:274-288`), confere `apagadas = arquivadas` por tabela e termina com `obs_archive_channel_counts` (`:356-358`), que lê o **registro**: com 32 entradas e nada apagando as duas novas, remover um canal com linha em `ab_native_observados` lança `E10:sobrou_linha` (a transação desfaz: é recusa, não perda, mas só aparece depois do `on`). A migration `..._registro` recria também `competitor_channel_remove_archived` por cópia do corpo vigente (lido por `pg_get_functiondef` no banco migrado, com a mesma âncora e conferência de ocorrência única que a F1 usou em `20261021000002:30-60`) e acrescenta: `delete` das duas tabelas por `site_id` + `youtube_video_id = any(v_yt)` **antes** de apagar o canal e `competitor_videos`; as duas no laço `apagadas <> arquivadas`; as duas no "nada sobra"; as contagens em `after_data`. **Vídeo compartilhado:** a função **lança** `E10:video_compartilhado` (`:196`), não poupa linha: o teste é "remoção recusada, as duas tabelas intactas". O observador ignora canal com `removal_requested_at`. **A migration da T13 não vai ao `db:push:prod` depois da F1 de remoção sem a `..._registro`.**
- **Junção (conferida em origin/main, Yannis C3, Phil N3):** `competitor_videos.video_id` (text; `20260531000008_competitor_observatory.sql:17`), **não** `youtube_video_id`; unicidade só por canal (`20260531000009_fix_competitor_video_unique.sql:4`), sem `site_id`: o site vem de `competitor_channels.site_id`. `competitor_channels.site_id = alvo.site_id and competitor_videos.video_id = alvo.youtube_video_id`, com `distinct on` e `min(published_at)` (mesmo vídeo em dois canais do site = uma avaliação); modelos já em produção: `20261021000002_...sql:165` e `observatorio/arquivo/cli.ts:233`. `published_at` é anulável: nulo = não avalia, cursor com `avaliado_motivo='sem_publicacao'`.
- **`inferirObservado(e: { leituras: LeituraObs[]; thumbsPorId: Map<number, ThumbObs>; publicadoEm: Date; agoraMs: number; alvoSaiu: boolean; saiuPor?: string }): Observado[]`** (um item por campo com troca; vazio = nenhuma linha). Reaproveita só `hamming` e `DHASH_MAX_SAME` (`apps/web/src/lib/youtube/thumb-hamming.ts:4`), `normalizarTitulo` (`teste-youtube/normalizar-titulo`) e `frescor.ts`; **não** usa `avaliarVideo`/`detectarTesteYoutube`. Regras (§5.8, "Como se infere"): (1) sequência por **leitura** de `yt_watch_readings` por `lida_em` (`order by` no banco), só `http = 200` e `erro is null` e `jogador_bloqueado = false`; versão = corrida de leituras consecutivas, por `miniatura_id` ou `titulo_oficial` normalizado, nunca por `primeira_vista` de `yt_watch_thumbs`; (2) miniatura: só a mesma `variante` conta, `host` ignorado, união de Hamming, troca só com distância ≥ `DHASH_MIN_TROCA = 10` (nova constante), 7 a 9 = indeterminada (conta em `obs_indeterminadas`), placeholder 120x90 descartado, `dhash` nulo não conta; (3) versão só conta com ≥ 2 leituras consecutivas **na mesma corrida** (não pela soma de `vistas`); corrida recente de 1 leitura = `em_andamento`; **carência de 24 h sobre LEITURAS**: descartam-se da sequência as leituras com `lida_em < publicadoEm + 24 h` e a versão inicial é a vigente aos 24 h; falso negativo declarado (§10); (4) título: só mesma `titulo_oficial_fonte` e mesmo `idioma`, depois de `normalizarTitulo`; título oscilando nunca é `estavel`; (5) `alternada` = uma versão volta depois de outra, senão `sequencial`; (6) `estavel` exige a mesma versão em todas as leituras válidas das últimas `ESTAVEL_JANELA_H = 24`, mais de `ESTAVEL_SPAN_H = 12` entre a 1ª e a última leitura dessa versão e a última leitura com menos de `FRESCOR_H = 9` (1,5 × 6 h de cadência, `watch/alvos.ts:68`), relógio injetado; `sem_desfecho` se `alvoSaiu` (qualquer `saiu_por`) e ainda em troca, com `motivo = saiu_por`; senão `em_andamento`. **Teto na origem (r3, Yannis N2):** `inferirObservado` guarda as **20 corridas mais recentes** em `trocas` e corta cada uma a 1000 bytes, com `n_versoes` contando o total; o CHECK de banco é a rede, não o limite (título oscilando a cada leitura, o caso "A/B por espectador" da §5.8 item 4, gera dezenas de corridas em 120 leituras: 4 por dia por 30 dias; sem truncar, o upsert estoura 23514, vira `obs_falhou`, **não grava cursor** e o alvo volta à fila com `avaliado_em nulls first`, ocupando para sempre uma das 50 vagas de cada disparo). Falha de gravação de um alvo conta `obs_falhou` e **não grava cursor** (o cursor só aceita `ok` e `sem_publicacao`); dívida declarada: o alvo que falha por outro motivo volta à frente da fila a cada disparo; gatilho: `obs_falhou > 0` por 3 dias seguidos (acrescentar `tentou_em` ao cursor só se acontecer). `MAX_OBSERVADOS_POR_DISPARO = 50`; `MIN_SOBRA_MS = 10_000`.
- **Seleção incremental (`selecao.ts`, Phil N8, Yannis M1):** avalia o alvo com `yt_watch_alvos.rodadas <> ab_native_obs_cursor.avaliado_ate_rodada` (**`<>`, não `>`**: alvo recriado pela poda volta com `rodadas` zerado e o cursor guarda um valor maior), **ou** `ultima_rodada_em > avaliado_em`, ou sem cursor; ordem por `avaliado_em nulls first` (sem starvation). **Phil N8:** o passo lê `rodadas` do alvo **antes** de ler as leituras e grava **esse** valor como `avaliado_ate_rodada` (não o contado depois): uma rodada inserida entre as duas leituras fica para o próximo disparo em vez de ser dada como avaliada. Recomputa o alvo **inteiro** a partir das leituras (idempotente, sem CAS, imune a cron sobreposto); leitura em lote, paginada com `range` e conferindo `count` (`max_rows = 1000` corta sem erro).
- **Passo no registrador:** depois dos próprios e **nunca tirando tempo deles**; só roda se sobrar ≥ `MIN_SOBRA_MS` antes de `BANCO_ATE_MS = 83_000` (`registro/tarefa.ts:16-20`); **teto de 50 alvos por disparo**; **`try/catch` isolado**: falha do observador vira `parcial` com motivo `observados_falhou`, **nunca** reprova a tarefa dos próprios nem os `avisos_pendentes`. Varredura que fecha como `sem_desfecho` toda linha `em_andamento` cujo alvo tem `saiu_em` ou já foi podado. Contadores no `detalhe`: `obs_avaliados`, `obs_trocas`, `obs_falhou`, `obs_sem_tempo`, `obs_indeterminadas`, `obs_sem_publicacao` ("ok com 0 avaliados" tem de ser visível).
- **Flag `OBS_TROCAS_CONCORRENTE`, padrão `off`** (o registrador já roda em produção; a etapa não vai ligada no deploy): `modoTrocasConcorrente(env)` exato como `flag.ts` (T3). Vai a `on` só depois do deploy e por decisão do controlador; o aceite de dado (§7) vem com ela em `on`.
- **Estados de leitura, por campo (`estado-de-leitura.ts`; consumidos pela F2):** (1) **com troca**: há linha daquele campo; (2) **sem troca vista até `ultima_rodada_em`**: alvo com `rodadas >= 8`, última rodada dentro do frescor da prova diária (`yt_watch_prova`), **cursor com `avaliado_motivo = 'ok'` e `avaliado_ate_rodada >= rodadas - 1` (ou `avaliado_em` dentro do frescor)** e nenhuma linha daquele campo; (3) **não medido**: alvo ausente (podado), `rodadas < 8`, última rodada velha, **ou sem cursor, ou cursor com motivo diferente de `ok`**. Flag `off`, observador caído, `obs_sem_tempo` e `sem_publicacao` **nunca** leem "sem troca vista". A ausência de linha nunca vira "0 versões" nem "não testou".

- [ ] **Step 1: testes que falham** (unidade, depois integração gated). **Teste de integração (Yannis R2, r4): canal com linhas em `ab_native_observados` e `ab_native_obs_cursor`: arquivar, depois remover → sucesso, contagens iguais (`apagadas = arquivadas`), sem `apagou_alem_do_arquivo` nem `E10:sobrou_linha`.** Inferência: **60 leituras alternando 6 títulos (≥ 50 corridas) → 1 linha, `jsonb_array_length(trocas) = 20`, `n_versoes` = total, sem exceção; corrida com título de 100 caracteres × variantes cabe em 1000 bytes (Yannis N2)**; A,A,B,B,A,A → 2 trocas, 2 versões, ficou A, `alternada`; troca de miniatura vista → 2 versões; só `etag`/`sha16` mudou (mesmo `dhash`) → nenhuma; distância 8 → indeterminada, 0 trocas, `obs_indeterminadas` conta; mesma imagem em `hqdefault` e `maxresdefault` → 0 trocas; placeholder com 2 leituras + final → nenhuma; só 1 leitura → nenhuma; leituras com `erro`/`jogador_bloqueado`/`dhash` nulo → nenhuma; corrida de 1 leitura no dia 5 → `em_andamento`; troca no dia 5 com ambas as corridas ≥ 2 leituras → 1 linha; A,A,B,B com B só nas primeiras 24 h → 0 trocas; A (auto, dia 0), B (20 h, descartada), C (dia 3) → nenhuma troca A→C; troca e volta (A,B,A) → `ficou` A; troca há 6 h → `em_andamento`; alvo que saiu em troca → `sem_desfecho` com `motivo` = `saiu_por`; títulos iguais com fontes diferentes → nenhuma, título A/B com mesma fonte e idioma → 1 troca; miniatura estável + título oscilante → 2 linhas com estados distintos; `estavel` com relógio injetado (última leitura mais velha que `FRESCOR_H` → `em_andamento`). Seleção e passo: **flag `off` (`delete process.env.OBS_TROCAS_CONCORRENTE`) → nenhuma leitura, nenhuma escrita, e o estado lê "não medido" com 40 rodadas**; reexecução sem leitura nova → zero leituras, **com 3 alvos sem troca e nenhuma linha** (o cursor responde); 60 alvos sem linha → em 2 disparos todos avaliados, nenhum starvation; cursor 120 e alvo recriado com `rodadas = 3` e rodada mais nova que `avaliado_em` → entra na seleção; **rodada inserida entre a leitura de `rodadas` e a das leituras → o cursor guarda o `rodadas` lido antes e o alvo reentra no disparo seguinte (Phil N8)**; `published_at` nulo → cursor `sem_publicacao`, nenhuma troca, `obs_sem_publicacao = 1`, estado "não medido", e **não reavalia** no disparo seguinte; mesmo `video_id` em dois canais do site → **uma** avaliação; canal com `removal_requested_at` ignorado; o alvo próprio não entra (o passo filtra `tipo = 'concorrente'`; o registrador continua só com `proprio`, `ler.ts:175`); passo respeita o prazo (para no `fimDuro`, conta `obs_sem_tempo`); observador lançando exceção → registrador dos próprios completa, `parcial` com `observados_falhou`, teto de 50 respeitado. Estados: alvo com 2 rodadas → não medido; 40 rodadas sem troca com cursor `ok` → "sem troca vista"; alvo podado → não medido; miniatura com linha e título sem linha, alvo fresco → título "sem troca vista"; sonda parada → não medido com "sonda sem leitura desde X". Pureza: `inferir.ts` e `selecao.ts` não importam banco (como `pureza.test.ts`). Integração (gated, banco `bythiago_int`): RLS com GUC falsificado como não-superusuário; `unique (site_id, youtube_video_id, campo)` segura duas gravações; CHECKs de `campo`, `n_versoes >= 2`, `trocas` ≤ 20; `has_function_privilege` nas funções novas. **Registro:** o `obs_archive_registry()` novo = o antigo (30 linhas, lido do banco antes de aplicar) + exatamente as duas linhas novas, cada uma com as 5 colunas não vazias onde o contrato exige (`sum_sql` presente); `observatorio-a5-e10-lista-fechada.test.ts` atualizado; **purga (Yannis N1, helper `mg6.ts`): canal com 2 linhas observadas e 1 cursor, exportar e remover → `removido`, zero linha nas duas tabelas, `rows_deleted` batendo; vídeo compartilhado → `E10:video_compartilhado` e as linhas continuam; o teste da lista de identidade (`TABELAS_COM_IDENTIDADE`) passa; sem recriar `competitor_channel_remove_archived` o teste de remoção reprova (mutante)**; reaplicar a migration é idempotente; a guarda recusa registro instalado inesperado.
- [ ] **Step 2:** rodar → FAIL. **Step 3:** escrever as migrations (aplicar no 54422 por `psql -f`, registrar a versão em `supabase_migrations.schema_migrations`, reaplicar uma 2ª vez sem erro), depois o código. **Step 4:** PASS; suíte existente de `registro/*` e `observatorio-a5-e10*` verde.
- [ ] **Step 5: dry-run retroativo sobre o bruto real (aceite de §7, r13, Phil N7), antes do push:** rodar `inferirObservado` sobre o `yt_watch_*` de produção **só em leitura**. **Quem roda (r3, Hanna N3, Phil R4):** o **controlador**, por `npx supabase db query --linked` (memória `project_observatorio_competidores`); o modo automático de **subagente nega** a leitura de produção, então o executor não roda. **Plano B:** se a leitura for negada também ao controlador, preparar o script `.sql`/`.ts` e entregar ao dono, **um comando por linha**; o aceite de §7 **não se dá por cumprido sem o resultado**, e o push da T13 espera. O dry-run precede o push. Imprime **os dias de bruto existentes (o bruto existe desde 18/10), os alvos elegíveis (≥ 8 rodadas, `published_at` não nulo) e quantas trocas por campo**. A taxa é estimativa de janela curta; **menos de 50 alvos elegíveis = teste de fumaça, não medida**; o ledger declara isso. Nada é gravado.
- [ ] **Step 6:** commits separados: `feat: ab_native_observados e cursor (migration, inferência, passo atrás de OBS_TROCAS_CONCORRENTE)` e `feat: registro de purga das tabelas de trocas observadas`.

**Aceite (§7, r13):** as duas tabelas e o registro de 32 entradas presentes; flag `off` por padrão (teste com variável apagada); com `on` e a sonda rodando, uma consulta lista as trocas dos últimos 7 dias **por linha** (por campo) e a Gio confere uma contra o YouTube; sem troca vista, nenhuma linha em `observados` e estado "não medido" ou "sem troca vista" conforme o cursor; janela acumulativa desde o `on`, data-limite D+21 com decisão do dono; o rótulo "possível teste" pode ficar desligado sem bloquear `sequencial`; **`obs_falhou` (Yannis R3 e Phil M2, r4):** conferir no D+2 e no D+5 o `obs_falhou` somado das últimas 24 h (esperado 0; > 0 lista o alvo por `youtube_video_id`, sem título, no log, para o dono decidir a coluna `tentou_em`; `>= 1` em 2 conferências abre item); **cobertura (Phil R3):** com a flag em `on`, no D+2 conferir nos logs que `obs_avaliados` somado nas 6 h seguintes a uma rodada é ≥ os alvos elegíveis e que `obs_sem_tempo` é 0 em regime (50 alvos por disparo horário, ~4 disparos para varrer ~176 alvos; estimativa até a 1ª medida); se não, subir `MAX_OBSERVADOS_POR_DISPARO` ou aceitar ciclo de 12 h e dizê-lo na tela. Conferir também as retenções: o atraso da T13 não perde dado se a retenção do bruto `yt_watch_*` for maior que o atraso (Hanna N3, confirmar com Phil). Estimativa: ~220 mil tokens.

---

### Task 14: Integração com a flag em `on`, revisão e envios (1a, 1b, 1c, 2)

**Files:**
- Create: `.superpowers/sdd/ab-lab/f1a-dado/aplicar-f1a-dado-migration.sh`, `.superpowers/sdd/ab-lab/f1a-dado/aplicar-observados-migration.sh` (as duas migrations da T13, nessa ordem), `.superpowers/sdd/ab-lab/f1a-dado/conferir-f1a-dado.sql`

- [ ] **Step 1:** rodar a suíte de integração inteira no 54421 com `AB_PAUSA_POR_DETECTADO=on` (por `vi.stubEnv`; saída em arquivo, só as falhas no contexto) e `npx vitest run` completo (~160 s). Zero falha. Roda por lote de envio (1a só com as suítes das T3 a T6 e as existentes de `ab-settle*`, `ab-rotate*`, `ab-resume*`, `ab-start*`).
- [ ] **Step 2:** `npm run typecheck -w apps/web` (o pre-commit também roda).
- [ ] **Step 3:** revisão do lote por Phil e Yannis (Opus, 1ª revisão), conserto até o acordo (Sonnet). O 1a pode ser revisado e enviado sem esperar o 1b; a T13 vai em lote separado.
- [ ] **Step 4: scripts do dono** (molde de `.superpowers/sdd/ab-lab/2026-10-18-nativo-vs-nosso/aplicar-s7-migration.sh`: minutos proibidos 0-4/20-24/30-34/40-44 e janela 11:30-13:00 UTC, `echo YES | npm run -s db:push:prod`, depois a conferência): `conferir-f1a-dado.sql` devolve: nenhum CHECK de `ab_native_tests` com a definição antiga do vencedor, os quatro CHECKs novos presentes (`ab_native_tests_titulo_com_fonte`, `_fonte_com_vencedor`, `_variante_da_resposta`, `_respondido_em_do_dono`), `ab_native_fichas` presente com RLS ligada, a FK de `criada_por` com `confdeltype = 'n'` (`select confdeltype from pg_constraint where conrelid = 'public.ab_native_fichas'::regclass and contype = 'f' and conkey = array[(select attnum from pg_attribute where attrelid = 'public.ab_native_fichas'::regclass and attname = 'criada_por')]`), as duas funções e o RPC de formato com `has_function_privilege('service_role', ...)` true e `authenticated` false. O controlador roda o script se o modo permitir (memória `feedback_comando_no_clipboard`); senão manda ao dono, um por vez: `bash .superpowers/sdd/ab-lab/f1a-dado/aplicar-f1a-dado-migration.sh`.
- [ ] **Step 5: ordem obrigatória do envio 1a (T3 a T6, sem migration; r2, Hanna H1):** (0) repetir a T0 Step 5 (registrador medindo; anotar no ledger a data de início do relógio dos 7 dias de `log`); (1) `AB_PAUSA_POR_DETECTADO=log` no Vercel Production (`printf log | vercel env add AB_PAUSA_POR_DETECTADO production`; conferir com `vercel env ls`, memória `reference_gh_secret_set_stdin`: nunca `--body -`); (2) rebase em `origin/staging`, refazer os `git grep` deste plano, suíte, push `HEAD:staging` (1 push); (3) promoção para `main` no 1º push combinado depois da promoção da A5 de 22/10 (23/10 é da A5 T9, combinar; ou 24/10). Sem `db:push:prod` neste envio: a guarda só lê `ab_native_tests.estado`/`confirmado_em`, que existem em produção, e o CHECK de produção já aceita `pulado_teste_youtube` e `end_reason 'teste_youtube'`.
- [ ] **Step 6: ordem obrigatória do envio 1b (T1, T2, T7 a T11):** (1) `db:push:prod` da migration da F1a-dado e conferência (Step 4); (2) rebase em `origin/staging`, `git grep` refeitos, suíte, push (1 push, no mesmo dia do 1a só se couber nos 3). Pré-condição: 1a em `staging` (não precisa estar em `main`: a T10 só completa o teste da T6); acordo de Phil e Yannis neste lote.
- [ ] **Step 7: envio 1c (T12):** só depois da regra de §7 para `agenda/definicoes.ts` (diff vazio da A5 no ledger) e com a T1 em produção; push próprio; teto: antes do 1º dia 14 (início de dezembro).
- [ ] **Step 8: envio 2 (T13):** `bash .superpowers/sdd/ab-lab/f1a-dado/aplicar-observados-migration.sh` (as duas migrations) antes do código; push próprio, no mesmo dia só se couber nos 3 pushes; `OBS_TROCAS_CONCORRENTE` fica `off` no deploy e vai a `on` por decisão do controlador depois.
- [ ] **Step 9 (como desfazer, Yannis M11):** **código:** reverter o commit do envio (a migration é compatível com o código antigo: os CHECKs novos aceitam as escritas atuais do registrador, conferido); **flag:** `AB_PAUSA_POR_DETECTADO=off` desliga a guarda de `detectado` sem deploy (a guarda de linha **confirmada** não tem flag: sem linha confirmada ela não faz nada); **fichas:** nada a desfazer; **T13:** `OBS_TROCAS_CONCORRENTE=off`.
- [ ] **Step 10:** commit dos scripts e do ledger com `--no-verify` (são docs/ops do SDD).

**Aceite de produção (conferido por quem diz, §7):**
- **1a (Hanna H3).** Frase para o dono: "Nada muda na tela. O Lab gira como antes. A partir de hoje medimos quantas vezes o detector do teste do YouTube cruzaria com um teste nosso." Ação do dono: nenhuma. Controlador: a variável está em `log` (`vercel env ls`); em 48 h, rotação igual (log do cron `ab-rotate`), zero recusa nova, **zero `status_note` com "não foi possível conferir o teste do YouTube", zero evento Sentry da guarda e `RotateResult.errors` vazio** (a falha fechada pula o ciclo inteiro e tem de aparecer em 48 h, não em 08/11); `select resource_id, created_at::date, count(*) from audit_log where action = 'ab_pausa_detectado_log' group by 1, 2 having count(*) > 1` → 0 linhas (≤ 1 anotação por teste por dia) e `select count(*) from audit_log where action = 'ab_pausa_detectado_log' and site_id is null` → 0 (Phil, D+2). **Com `OBS_TROCAS_CONCORRENTE=on` (Phil M2, Yannis R3, r4):** no D+2 e no D+5 somar `obs_falhou` das últimas 24 h do `detalhe` da tarefa (esperado 0; `>= 1` em 2 conferências abre item).
- **1b.** `conferir-f1a-dado.sql` verde (D0, controlador).
- **1c.** `avisos_pendentes` aparece na agenda com `estado ok` e `detalhe.fechados = 0` no 1º dia (controlador).
- **~31/10 (7 dias de `log`, a partir da data anotada no ledger):** Phil roda `select id, video_id, origem, confirmado_em, estado, primeira_vista from ab_native_tests where origem = 'detectado' and created_at >= now() - interval '7 days'` + contagem de `audit_log` `ab_pausa_detectado_log` no mesmo período **por `after_data->>'ponto'`** + `detectado` `em_andamento` há > 16 dias (esperado 0); Gio confere cada linha contra o Studio, o dono confirma; **X = 0 é "sem amostra" e não libera `on`** (ledger declara; decisão volta ao dono).
- **1º teste confirmado, dia 14 e fechamento:** `select dedup_key, created_at from notifications where dedup_key like 'lembrete-nativo:%'` tem 1 linha por admin no dia 14; `select id, resposta_dono, respondido_em, desfecho_motivo, lembrete_notificado_em, encerrado_em from ab_native_tests where confirmado_em is not null and estado <> 'em_andamento'` não tem `sem_resposta` com `lembrete_notificado_em` nulo e `notificacao_falhou_em` nulo.
- **§5.8:** Gio confere uma troca observada contra o YouTube. **D0 do envio 2 (Phil):** `select count(*) from public.obs_archive_registry()` = 32 e as duas tabelas novas com RLS ligada; remoção de canal de teste com linha observada passa (Yannis N1).

Estimativa: ~130 mil tokens (sem as revisões de Phil e Yannis, ~150 mil à parte).

---

## Envios e calendário

| Envio | Conteúdo | Pré-condição | Quando | O dono vê |
|---|---|---|---|---|
| E0 (outra fatia) | link do e-mail | — | não é deste plano | |
| **1a** | T3, T4, T5, T6 (**sem migration**) | T0 Step 5 conferido (registrador medindo); `AB_PAUSA_POR_DETECTADO=log` no Vercel **antes**; acordo de Phil e Yannis neste lote; Yannis C1 e C2 fecham sem a T1 (conferido: o CHECK de produção já aceita `pulado_teste_youtube` e `end_reason 'teste_youtube'`, e a guarda lê só `estado`/`confirmado_em`) | 1º push combinado depois da promoção da A5 de 22/10 (23/10 combinada, ou 24/10); o relógio dos 7 dias de `log` começa aqui | nada na tela |
| **1b** | T1, T2, T7 a T11 | 1a no ar; migration aplicada em produção e conferida (T14 Step 4); acordo de Phil e Yannis | push seguinte (no mesmo dia se couber em ≤ 3 por dia). **"1a no ar" aqui é 1a em `staging`, não em `main`** (Hanna N2): se o 1a escorregar da promoção de 23/10, o 1b (migration sem relógio) não espera a promoção, sobe em `staging` e vai junto na promoção seguinte | nada na tela; actions prontas para a F1a-tela-1. Se apertar, a T7 passa para o plano da F1a-tela-1 |
| **1c** | T12 | regra de §7 para `definicoes.ts` cumprida; T1 em produção | antes de 15/11; teto: antes do 1º dia 14 (início de dezembro) | nada |
| **2** | T13 | re-revisão da §5.8 r13 por Phil e Yannis; as duas migrations em produção; dry-run do Step 5 impresso | push próprio | nada |
| (F1a-tela-1) | troca para `on` | botão "Não é teste" no mesmo deploy; aceite de ~31/10 (X ≥ 1 conferido, ou dono assume o risco por escrito se X = 0) | fora deste plano | |

Caminho crítico até o dono perceber valor: 1a no ar, 7 dias de `log`, aceite (Phil roda a consulta, Gio confere, o dono confirma), depois a F1a-tela-1 com `on` até 15/11. O corte antecipa o aceite para ~31/10 (o plano antigo dizia ~08/11) e dá folga para X ≥ 1; os pushes são os mesmos 3 ou 4, distribuídos de outro jeito.

## Estimativa total

~1,6 milhão de tokens de execução (Sonnet, effort medium), mais ~150 mil de revisão (Phil e Yannis, Opus) e ~60 mil de conserto. Maiores: Tarefas 6, 8, 12 e 13.

## Fora deste plano

Tela (F1a-tela-1/2), link do e-mail (E0), `avaliarGuarda` e guarda dentro da reivindicação (F1b), `niche_signals` e a parte do nicho em `avisos_pendentes` (F2), o piso numérico do portão de volume (Phil, §5.4), remoção da flag (plano da F1b), unificar o `requireEditUser` duplicado em `competitors/actions.ts`.
