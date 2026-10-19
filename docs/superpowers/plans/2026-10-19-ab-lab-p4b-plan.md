# A/B Lab honesto, P4b: a nova tentativa do vigia, os botões da faixa e os avisos da A5 (plano de implementação)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Escrito em 18/10/2026 (noite). **r1 aplicada** (pareceres de Phil 72, Yannis 78 e Hanna 84; registro no fim do arquivo); falta a re-revisão de emenda (Sonnet) e o acordo dos dois. O dono liberou escrever o plano (18/10 ~21:30 BRT);
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
  `Uy5_DPzoGi8`). A **Parte B é um envio independente** (não depende da Parte A, não tem migration, não toca rotação,
  `settleOnAir`, drift nem avaliação); se vai sozinha ou junto com a A é a pergunta Q3 (o dono decide; seção 4 mostra as duas).
- **Nunca um escritor fora da reivindicação** (spec 3.5, "Todo escritor"): `novaTentativa`, `retryRestore` e
  `dismissRestore` reivindicam por `restore_seq` antes e gravam com `where restore_seq = <reivindicado>`; zero
  linhas = `em_andamento` com `MSG_EM_ANDAMENTO` (texto existente, `Y/ab-acao-saida.ts:9`).
- **Toda escrita no YouTube passa por `restaurarCampos`** (`Y/ab-settle.ts:344`): é o ponto que a fase 2 da S6/S7
  vai guardar com `PasseGuarda` (spec S6/S7 §6.4, última linha). Nenhum `setThumbnail`/`escreverTitulo` novo.
- Forma por campo, fixa (emenda 32 a): `{ estado, destino, em, forcado, escreveu, motivo?, erro, attempts }`. Nada
  de campo novo no `restore_status`. Motivos novos de `desistiu` (string livre, o CHECK aceita: `20261014000005_ab_restore_status.sql:50,64`):
  `tres_falhas` e `antes_da_nova_tentativa`.
- **Nenhum escritor grava `restore_status = null`** (D4): dispensar o último campo grava `'{}'::jsonb`.
- `MAX_TENTATIVAS = 3`. `attempts` = tentativas **já feitas** pela corrente; o `em_andamento` de uma reivindicação
  carrega o número de antes dela. A falha da chamada original grava 1 (`Y/ab-settle.ts:340`). **A reivindicação que
  começa uma corrente grava `attempts: 0`**: `settleOnAir` (`:487-488`, hoje herda), o retomar (`ab-resume.ts`) e
  `retryRestore`. A do vigia carrega `rs[c].attempts`. **Só o vigia incrementa.** Erro de cota (`reason` em
  `quotaExceeded`, `dailyLimitExceeded`, `rateLimitExceeded`: `Y/youtube-api-error.ts:47`) é `falhou`, **não** incrementa
  e **não mexe no `em`, no `forcado` nem no `attempts`** (só o `erro` muda; F5 do Phil); a cota que dura mais de 72 h
  desde a âncora do "sim" (abaixo) conta como falha. Quando o incremento chega a 3 o campo vira `desistiu`, motivo
  `tres_falhas`. **Interrompido conta como falha** (F1/Y-1): `converterInterrompido` (e o PODE-1, e `ab-start.ts:93`)
  usam `proximoDoVigia(campo.attempts, 'interrompido')`, com `attempts = max(1, p.attempts)`: 0 vira `falhou`/1, 1 vira
  `falhou`/2, 2 vira `desistiu`/`tres_falhas`/3. `retryRestore` zera antes de tentar; se falhar grava `falhou` com 1.
  Nos estados finais `ok`/`pulado_*` o `attempts` do campo vem de um parâmetro `anterior(c)` (Y-8): 0 no caminho
  humano, o da reivindicação no do vigia.
- **O "sim" repetido vale 48 h desde o PRIMEIRO `forcado` da cadeia** (Y-11, 32 k; escolha do Yannis, Y-3, com o
  comportamento de cota do Phil, F5): a âncora é o `em` mais antigo da sequência final de linhas com `forcado = true`
  em `ab_test_restores` do (teste, campo), lidas por `seq` decrescente, `limit 10`. O campo é tentado com `forcar =
  true` só se `forcado === true` e `agora - âncora < 48 h` (47 h repete forçando; 48 h exatas e 49 h não). Sem linha
  no histórico, a âncora é o `em` do campo (dado ausente = comportamento de antes). Uma linha com `forcado = false`
  quebra a cadeia. Efeito somado: uma corrente força por no máximo 48 h desde o "sim" original, e termina em cerca de 4
  dias mesmo com cota esgotada. Sem isso, `forcar = false`.
- **Fase do vigia:** testes com `status <> 'active'` (inclusive `archived`) e campo em `falhou`; ignora (sem
  escrever) teste cujo vídeo tenha **outro** teste (`id <>` o próprio, S2 do Phil) em `draft`, `queued`, `active` ou
  `paused` (Y-5) e campo `falhou` com destino variante em teste `paused` (retomada que não terminou: Phil,
  `p4a-revisao-phil.md:311`). Uma tentativa por execução; no máximo 4 em paralelo (`LIMITE_PADRAO`,
  `Y/ab-watchdog-drift.ts:29`); não começa tentativa depois de `NAO_INICIA_SETTLE_DEPOIS_MS = 15_000` desde o início da
  rota (`:27`), o resto conta em `adiados`; `prazo = inicio + PRAZO_DA_ROTA_MS` (55 s, `:28`). **A fase roda em paralelo
  com a de drift** (`Promise.all`, cada uma com `catch`; Y-6): os conjuntos são disjuntos (drift só pega `active`); só
  `converterInterrompidos` roda antes, fora das duas. `adiados > 0` → `recordCronFailure`. Destino divergente ou inválido
  não se repete para sempre: a fase grava o campo como `desistiu` com motivo `destino_invalido` (uma vez, por
  `update` guardado por `restore_seq`), conta `falhas` e manda ao Sentry (F4).
- **Resposta do cron:** `nova_tentativa: { tentadas, ok, falharam, desistiram, pulados, cota, ignorados: { outro_teste,
  pausado_variante }, adiados, sem_destinatario }` **sempre presente, inclusive com zeros** (P4b-I9). Mais, na raiz
  da resposta, `duracao_ms` e uma linha de log `console.log('[ab-watchdog] resumo', JSON.stringify({ duracao_ms, drift,
  nova_tentativa, avisos }))`; com `atencao`, `duracao_ms` e `cota` vão para a mensagem do `recordCronFailure`
  (`last_error`). A coluna `cron_health.duration_ms` **não existe** (F3); a conferência de produção lê esse log.
- **Avisos** (spec 3.5): enquanto houver campo em `falhou` depois de uma tentativa do vigia, chave
  `ab-restore:<testId>` com `claimAlert(…, '20 hours')` (F6/Y-7: com cron às 10:00 e 20:00, `'1 day'` pularia dias ao
  acaso; 20 h avisa às 10:00, não às 20:00, avisa às 10:00 do dia seguinte), liberada (`releaseAlert`) quando o
  resultado não tiver mais `falhou`; ao virar `desistiu`/`tres_falhas`, o aviso próprio pela chave já usada pela P4a
  `ab-restore-desistiu:<testId>:<campo>` (`Y/ab-restore-avisos.ts:83`, janela de 10 anos). **Quando um campo SAI de
  `desistiu`** (reivindicação de `retryRestore`, ou `dispensarCampos`), a chave `ab-restore-desistiu:<id>:<campo>` é
  liberada (`releaseAlert`), senão o segundo "parou" sai mudo (F7/Y-5). Sem destinatário = `fanOut` com total 0
  → `sem_destinatario` na resposta do cron e `recordCronFailure`.
- **Botões** (spec 3.5 e mockup): "Tentar agora" em `falhou` e em `desistiu` com motivo diferente de `novo_teste`
  (o vídeo segue o teste novo; tentar escreveria por cima dele); "Já corrigi no YouTube: dispensar aviso" em
  `falhou`, `desistiu`, `pulado_drift` e `pulado_sem_original`. Permissão: destino `'original'` = a de encerrar
  (`requireEditAccess`, `AB/actions.ts:84`); destino variante = administrar o site (`denyUnlessSiteAdmin`,
  `apps/web/lib/cms/auth-guards.ts:68`); sem permissão, os botões **não existem** (mockup I).
- Horários da tela sempre em São Paulo (`horaSP`, `AB/_components/faixa-restauracao-texto.ts:39`). Próximo vigia:
  10:00 ou 20:00 UTC (`apps/web/vercel.json:23-24`), mostrado em SP (07:00 ou 17:00).
- **Bloqueio na faixa** (F4/Y-4): enquanto o vigia não vai tentar (outro teste aberto no vídeo, ou teste `paused` com
  destino variante), a faixa **não promete** hora nem "tentativa N de 3": diz que não há nova tentativa automática
  (Tarefas 7 e 8).
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
6. **A corrente de 3 falhas fecha mesmo quando a tentativa morre:** interrompido conta (Tarefa 2, `proximoDoVigia(.., 'interrompido')`;
   Tarefa 3, integração `vigia reivindica, tentar lança, próxima execução converte e tenta`).
7. **A âncora das 48 h e a cota não renovam o "sim"** (Tarefa 2, `inicioDoSim`; Tarefa 3, teste de cota).

---

## 1. Mapa de arquivos

| Arquivo | Muda | Tarefa |
|---|---|---|
| `Y/ab-restore.ts` | constantes e regras puras da nova tentativa; `converterInterrompido` conta a tentativa; Zod aceita `pulado_teste_youtube` (só leitura) | 2 |
| `Y/youtube-api-error.ts` | exporta `REASONS_DE_COTA` | 2 |
| **novo** `Y/ab-vigia-horario.ts` | próximo vigia, vigia atrasado (puro, importável no cliente) | 2 |
| `Y/ab-settle.ts` | `novaTentativa()`; `attempts: 0` na reivindicação que abre corrente; `anterior(c)`; conversão do `em_andamento` velho antes de reivindicar (PODE-1) | 3 |
| `Y/ab-acao-saida.ts` | resultado `outro_teste`, `MSG_OUTRO_TESTE` | 3 |
| `Y/ab-restore-avisos.ts` | `avisarNovaTentativa` (janela `'20 hours'`), frase de `tres_falhas` e `destino_invalido` | 4 |
| **novo** `Y/ab-watchdog-nova-tentativa.ts` | a fase nova do vigia | 4 |
| `apps/web/src/app/api/cron/ab-watchdog/route.ts` | fases em paralelo; resposta `nova_tentativa` e `duracao_ms`; log de resumo; saúde | 4 |
| **novo** `Y/ab-restore-acoes.ts` | corpo de `retryRestore` e `dismissRestore` (portas injetáveis), `audit_log`, liberação da chave de `desistiu` | 5 |
| `AB/actions.ts` | `retryRestore`, `dismissRestore` (finas: permissão + corpo) | 5 |
| **novo** `apps/web/test/integration/fixtures/ab-p4b-corte.sql`, `ab-p4b-corte-volta.sql` | conversão do `falhou` anterior ao deploy e o caminho de volta | 6 |
| `apps/web/data/pipeline-docs/cowork-docs-youtube.md` | motivos novos de `desistiu` no `restore_status` | 6 |
| `AB/_components/faixa-restauracao-texto.ts` | frases da P4b, `acoes` | 7 |
| `AB/_components/faixa-restauracao.tsx` | `children` (slot dos botões) | 8 |
| **novo** `AB/_components/faixa-com-acoes.tsx` | ilha cliente com os dois botões | 8 |
| `AB/_components/faixa-da-pagina.ts`, `AB/[testId]/page.tsx` | monta faixa, faixa "tentando", ações e `bloqueio` | 8 |
| `Y/ab-resume.ts`, `Y/ab-start.ts`, `AB/actions.ts` (`resumeAbTest`, `revertWinner`), `AB/_components/ab-pause-dialog.tsx` | dívidas da P4a (Y-5, PODE-1 no retomar, Pausar silencioso) e Y-2 (start recusa com escrita em voo de outro teste) | 9 |
| `AB/actions.ts` (`createAbTest`), `AB/queries.ts`, `AB/new/page.tsx` | barreiras do assistente (avisos A5 1, 6, 8) | 13 |
| `AB/_components/ab-create-wizard.tsx` | rascunho local não passa por cima do `prefill` (aviso A5 2) | 14 |
| **novo** `Y/ab-dia-do-teste.ts` + 3 chamadores | função única do "dia do teste" (aviso A5 5) | 15 |
| `AB/actions.ts` (`createAbTest`), `AB/new/client.tsx`, `Y/ab-types.ts` | `config.referencia` (aviso A5 3); **primeira da Parte B** (coleta que expira) | 16 |

**Ordem de execução** (Hanna H2/H3): Parte B primeiro, em envio próprio (T16, T13, T14, T15); Parte A: T1 a T7, depois
**T10 (textos, Logan e dono, em bloco) em paralelo com T8, T9 e T11**, depois T12. A Parte B só divide o arquivo
`AB/actions.ts` com a Tarefa 5, em trechos diferentes; quem executa o segundo reaplica sobre o `origin/staging` em dia.

Fora deste plano, com gatilho (pergunta Q5; lista completa em "Não aplicado", no fim): aviso A5 4 (abrir rascunho por id; o padrão Q-c da A5 é "link para a
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
  aceita (S8-F1, `20261018000004_ab_lab_s8_f1_gravacao.sql:164,178`). Quem o **escreve** é a fase 2 da S6/S7. Esta
  entrega **não o escreve**, mas o **lê** (F10): o Zod passa a aceitá-lo como estado final, fora de `camposPendentes` e
  de `podeDispensar`; senão um combo com `title` `falhou` e `thumbnail` `pulado_teste_youtube` viraria `falhas` + Sentry
  a cada execução.
- O índice único `ab_tests_one_active_per_video` cobre `draft`, `active`, `paused` e **não** `queued`
  (`20260517000001_ab_testing.sql:32-34`). Ver H8 em "Não aplicado".
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
  - `export type MotivoDesistencia = 'video_inexistente' | 'novo_teste' | 'tres_falhas' | 'antes_da_nova_tentativa' | 'destino_invalido'`
  - `export function inicioDoSim(linhas: ReadonlyArray<{ em: string; forcado: boolean }>): string | null` — `linhas` por `seq` decrescente (a mais nova primeiro); devolve o `em` mais antigo da sequência inicial de `forcado = true`; vazia ou a primeira com `forcado = false` → `null`.
  - `export function simAindaVale(campo: CampoRestauracao, agora: Date, inicio?: string | null): boolean` — `campo.forcado === true && agora − Date.parse(inicio ?? campo.em) < JANELA_DO_SIM_MS`; data ilegível → `false`. O chamador (Tarefa 3) lê `ab_test_restores` (`select em, forcado … where test_id and campo order by seq desc limit 10`) e passa `inicioDoSim(linhas)`.
  - `export function proximaDoInterrompido(campo: CampoRestauracao): CampoRestauracao` — `converterInterrompido` passa a usar `proximoDoVigia(campo.attempts, 'interrompido')`: `{ ...campo, estado: p.estado, erro: 'interrompido', attempts: Math.max(1, p.attempts), escreveu: null, ...(p.motivo ? { motivo: p.motivo } : {}) }`. É o que o vigia (`ab-watchdog-drift.ts:75`), o PODE-1 (Tarefa 3), o retomar e `ab-start.ts:93` chamam.
  - `paraRestoreStatus` aceita `pulado_teste_youtube` como `estado` (só leitura; F10).
  - `export function erroDeCota(erro: ErroGravado): boolean` — objeto com `reason` em `REASONS_DE_COTA`.
  - `export function proximoDoVigia(anterior: number, erro: ErroGravado, cotaVencida?: boolean): { estado: 'falhou' | 'desistiu'; attempts: number; motivo: 'tres_falhas' | null }` — cota e `!cotaVencida`: `{ falhou, anterior, null }`; senão `n = anterior + 1`; `n >= MAX_TENTATIVAS` → `{ desistiu, n, 'tres_falhas' }`; senão `{ falhou, n, null }`. `cotaVencida` = `agora − âncora > 72 h` (a cota conta como falha para a corrente acabar).
  - `export function camposPendentes(rs: RestoreStatus | null, origem: 'vigia' | 'humano'): CampoNome[]` — vigia: campos em `falhou`; humano: `falhou` ou (`desistiu` e `motivo` fora de `novo_teste` e `destino_invalido`; N1 do Phil: o "Tentar agora" recusaria sempre); ordem `title`, `thumbnail`. `pulado_teste_youtube` nunca é pendente.
  - `export function podeDispensar(c: CampoRestauracao): boolean` — `falhou`, `desistiu`, `pulado_drift`, `pulado_sem_original` (não `pulado_teste_youtube`: a fase 2 da S6/S7 decide).
- Produces (em `Y/ab-vigia-horario.ts`, sem import de servidor):
  - `export const HORAS_DO_VIGIA_UTC = [10, 20] as const`
  - (Y-9) `HORAS_DO_VIGIA_UTC` repete `apps/web/vercel.json:23-24`: um teste lê o `vercel.json` e afirma que os horários de `/api/cron/ab-watchdog` são `[10, 20]`.
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
  it('cota vencida (> 72 h da âncora) conta como falha', () => expect(proximoDoVigia(1, { status: 403, reason: 'quotaExceeded', chamada: 'videos.update' }, true).attempts).toBe(2))
})
describe('proximaDoInterrompido (F1/Y-1, regressão da P4a)', () => {
  it('attempts 0 → falhou 1', () => expect(proximaDoInterrompido({ ...emAndamento, attempts: 0 })).toMatchObject({ estado: 'falhou', attempts: 1, erro: 'interrompido', escreveu: null }))
  it('attempts 1 → falhou 2', () => expect(proximaDoInterrompido({ ...emAndamento, attempts: 1 })).toMatchObject({ estado: 'falhou', attempts: 2 }))
  it('attempts 2 → desistiu/tres_falhas com 3', () => expect(proximaDoInterrompido({ ...emAndamento, attempts: 2 })).toMatchObject({ estado: 'desistiu', motivo: 'tres_falhas', attempts: 3 }))
  it('mantém o em', () => expect(proximaDoInterrompido(emAndamento).em).toBe(emAndamento.em))
})
describe('inicioDoSim (Y-3)', () => {
  it('cadeia forcado de 3 linhas, a primeira há 50 h e a última há 1 h → âncora de 50 h', () => { /* linhas: 1 h, 25 h, 50 h, todas forcado true */ })
  it('cadeia quebrada por forcado false → a âncora é a linha depois da quebra', () => { /* ... */ })
  it('sem linha → null (simAindaVale usa o em do campo)', () => expect(inicioDoSim([])).toBeNull())
  it('simAindaVale com âncora de 50 h e campo.em de 1 h → false', () => { /* ... */ })
})
describe('pulado_teste_youtube (F10)', () => {
  it('paraRestoreStatus aceita; camposPendentes ignora; podeDispensar false', () => { /* combo title falhou + thumbnail pulado_teste_youtube → ['title'] */ })
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
  it('humano: desistiu/destino_invalido não é pendente (N1)', () => { /* camposPendentes({ title: desistiuDestinoInvalido }, 'humano') → [] */ })
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
- [ ] **Passo 5:** commit `feat: P4b, regras puras da nova tentativa (attempts, interrompido conta, cota, 48 h desde o primeiro sim, próximo vigia)`.

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
  - `restaurarCampos` ganha o parâmetro `anterior: (c: CampoNome) => number` (Y-8) no lugar de ler `b.anterior` do retrato pré-reivindicação: humano → `() => 0`; vigia → `rs[c].attempts`; `settleOnAir` → `() => 0`.
  - `Retrato` ganha `varianteUltimoCiclo?: string | null` e `VarianteRetrato` ganha `label?: string` (opcionais: as fixtures atuais continuam valendo); `lerRetratoPadrao` passa a ler `label` e o `variant_id` do último ciclo (`Y/ab-settle.ts:201-203`).
  - `export const MSG_OUTRO_TESTE = 'Outro teste está aberto neste vídeo. O Lab não mexe neste enquanto ele estiver aberto.' // TEXTO-A-REVISAR` em `Y/ab-acao-saida.ts`.

Ordem de `novaTentativa` (cada linha é uma decisão; o corpo é do executor):
1. Retrato (`lerRetratoPadrao`); nulo → `ja_encerrado`. `seqEsperado` diferente → `mudou` se `origem = 'humano'`, senão `em_andamento` (mesma regra de `:460`). `emAndamentoRecente` → `em_andamento`.
2. `status === 'active'` ou tipo desconhecido → `ja_encerrado`. `pend = camposPendentes(rs, origem)`; vazio → `ja_encerrado`.
3. Destinos de `pend` diferentes entre si → `Sentry.captureMessage('ab-nova-tentativa: destinos divergentes', {testId})` e `destino_invalido`. Destino que não é variante do teste → `destino_invalido` (`destinoNormalizado`, `:121`).
4. `status === 'paused'` e destino não `'original'` → `ja_encerrado` (retomada que não terminou: nunca escrever rumo à variante num teste pausado).
5. Y-5: existe outro teste do mesmo `site_id` e `youtube_video_id`, `id <> testId`, em `draft/queued/active/paused` → `outro_teste`.
6. `forcar = pend.every(c => simAindaVale(rs[c], agora, inicioDoSim(historico[c])))`, com `historico[c]` = `select em, forcado from ab_test_restores where test_id = $1 and campo = $2 order by seq desc limit 10` (uma consulta por campo pendente; Y-3).
7. Reivindica: `ab_settle_claim` com `p_de: [status]`, `p_para: status`, `p_end_reason: null`, `p_extra: {}`, `p_restore_status = { ...rs, [c em pend]: em_andamento }`, `attempts` do `em_andamento` = `origem === 'humano' ? 0 : rs[c].attempts`, e **`forcado: forcar`** (o calculado no passo 6; R-2 do Yannis: se o `em_andamento` morrer, o campo convertido mantém o `forcado` e a cadeia do "sim" não quebra; a P4a grava `op.forcar === true`, `ab-settle.ts:487`). Teste: `vigia forçando, tentar trava → campo convertido mantém forcado true`. Zero linhas → mesma releitura de `:496-501`. Se `origem = 'humano'` e algum pendente estava `desistiu`, `releaseAlert('ab-restore-desistiu:<id>:<campo>')` (quem chama, Tarefa 5, faz; F7/Y-5).
8. `restaurarCampos(portas, r, pend, destino, contexto, forcar, seq, prazo, anterior)` com a política: `origem = 'vigia'` e estado `falhou` → `proximoDoVigia(rs[c].attempts, erro, cotaVencida)` decide `estado`/`attempts`/`motivo`; **erro de cota (não vencida): o campo é regravado com o `em`, o `forcado` e o `attempts` de antes (só o `erro` muda; F5)**; `origem = 'humano'` e `falhou` → `attempts: 1` (já é assim); demais estados (`ok`, `pulado_*`) usam `anterior(c)`.
9. `final = { ...rs, ...resultadoDosPend }`. Vencedor: `tudoOk` sobre `camposDoTeste(test_type)` em `final`. Destino variante e `tudoOk` → grava `winner_applied_at`, `applied_by = 'manual'`, `revert_expires_at` e chama `autoImportWinner` só se `r.winner_applied_at === null` (Y-12). Destino `'original'`, `r.winner_applied_at !== null` e `tudoOk` → limpa os três (reversão que tinha falhado). Grava com `where restore_seq = seq`.
10. Não avisa: quem chama avisa (vigia: Tarefa 4; ações: Tarefa 5). Devolve `{ resultado: 'feito', campos: final }`.

PODE-1, em `settleOnAir` e `novaTentativa`, entre o passo 1 (validações) e a reivindicação: se algum campo está
`em_andamento` (já com ≥ 2 min, senão o passo 1 recusou), um `update` só de banco
(`.update({ restore_seq: seq + 1, restore_status: convertido }).eq('id', id).eq('restore_seq', seq)`, a mesma forma de
`converterInterrompidos`, `Y/ab-watchdog-drift.ts:80`) grava esses campos com **`proximaDoInterrompido`** (Tarefa 2:
conta a tentativa, `escreveu: null`, o `em` fica; F1/Y-1, não mais `attempts: 1` fixo); zero linhas → `em_andamento`; a
reivindicação usa o seq novo. Não usar `ab_settle_claim` aqui (ele zera o marcador da rotação). A reivindicação de
`settleOnAir` passa a gravar `attempts: 0` no `em_andamento` (hoje herda, `:487-488`), assim um settle novo num teste
com `attempts` 2 de uma restauração antiga não nasce à beira do `desistiu`.

Destino divergente/inválido com `origem = 'vigia'`: antes de devolver `destino_invalido`, um `update` guardado por
`restore_seq` grava os campos pendentes como `desistiu` com motivo `destino_invalido` (F4: para ter fim; a fase conta
`falhas` e manda ao Sentry). Com `origem = 'humano'` só devolve `destino_invalido`.

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
  - `interrompido conta (F1/Y-1)`: vigia com attempts 2, `tentar` trava até o prazo → campo `em_andamento` com 2; na execução seguinte `proximaDoInterrompido` o converte em `desistiu`/`tres_falhas` com 3 e a fase não chama `tentar` para ele.
  - `settleOnAir num teste com restore_status.thumbnail.attempts 2 → em_andamento com attempts 0`.
  - `cota (Phil F5)`: forcado true, `em` de 40 h, cota → `em`, `forcado` e `attempts` iguais; a execução de 10 h depois (50 h) não força.
  - `cadeia (Y-3)`: histórico com `forcado` true há 50 h e 1 h, campo.em de 1 h → `forcar` false; sem histórico → usa o `em` do campo.
  - `humano, desistiu attempts 3, YouTube acerta → ok com attempts 0` (Y-8).
  - `destino_invalido pelo vigia → campo desistiu/destino_invalido, zero escrita no YouTube`.
  - `combo title falhou + thumbnail pulado_teste_youtube → só o título é tentado` (F10).
  - `PODE-1: settleOnAir com thumbnail em_andamento de 3 min → antes da reivindicação, um update converte em falhou/interrompido com o em antigo; a reivindicação usa restore_seq + 2 no fim`.
- [ ] **Passo 2:** `npx vitest run test/youtube/ab-settle.test.ts > /tmp/ab-p4b-t3a.log 2>&1; tail -30 /tmp/ab-p4b-t3a.log` → os novos falham, os antigos passam.
- [ ] **Passo 3:** implementar `novaTentativa` na ordem acima; `traduzirSaida` ganha `case 'outro_teste': return { ok: false, resultado: 'ja_encerrado', error: MSG_OUTRO_TESTE }` (o `switch` exaustivo obriga; a tela não precisa de resultado novo).
- [ ] **Passo 4:** o mesmo comando → PASS.
- [ ] **Passo 5: integração** `T/integration/ab-p4b-nova-tentativa.test.ts`, contra o banco real (o `ab_settle_claim`, o CHECK, o gatilho):
  - `teste completed, title falhou attempts 1 → novaTentativa(vigia) com YouTube recusando: restore_status.title = falhou/2; uma linha nova em ab_test_restores (seq novo, attempts 2); completed_at e paused_at iguais aos de antes; nenhum ciclo aberto ou fechado`.
  - `archived com falhou → tentado (status continua archived)`.
  - `PODE-1 no banco: em_andamento de 3 min → ab_test_restores ganha a linha falhou/escreveu null com o em antigo`.
  - `vigia reivindica, tentar lança, próxima execução converte e tenta: attempts sobe 1→2 e na terceira vez desistiu/tres_falhas (F1/Y-1, o caso que o YouTube falso "que recusa" não pega)`.
  - `cadeia do sim lida do banco real: duas linhas forcado true (50 h e 1 h) → não força`.
  - `retryRestore e vigia simultâneos (Promise.all de duas novaTentativa no mesmo teste) → uma reivindicação vence, a outra em_andamento; o YouTube falso registra uma escrita` (P4b-I5).
  Rodar com o comando de integração da seção 3 → PASS.
- [ ] **Passo 6:** lista do A/B, `tsc`; commit `feat: P4b, novaTentativa no motor do settle (attempts do vigia, 48 h, Y-5, Y-12, PODE-1)`.

### Tarefa 4: a fase nova do vigia, a rota e os avisos

**Files:**
- Create: `Y/ab-watchdog-nova-tentativa.ts`
- Modify: `Y/ab-restore-avisos.ts` (`avisarNovaTentativa`; `fraseDeDesistencia` ganha `tres_falhas`, `antes_da_nova_tentativa` e `destino_invalido` ("não consegui saber para qual versão devolver; confira no YouTube Studio", `// TEXTO-A-REVISAR`); o default deixa de ser "o vídeo não foi encontrado": vira ramo explícito de `video_inexistente`; N1)
- Modify: `apps/web/src/app/api/cron/ab-watchdog/route.ts:92-120`
- Test: **novo** `T/youtube/ab-watchdog-nova-tentativa.test.ts`, `T/ab-cron-watchdog.test.ts` (casos novos), `T/integration/ab-p4b-nova-tentativa.test.ts` (casos novos)

**Interfaces:**
- Consumes: `novaTentativa` (Tarefa 3); `RelogioDoVigia`, `LIMITE_PADRAO`, `NAO_INICIA_SETTLE_DEPOIS_MS`, `PRAZO_DA_ROTA_MS` (`Y/ab-watchdog-drift.ts:27-41`); `emParalelo` (`apps/web/src/lib/util/em-paralelo.ts`).
- Produces:
  - `export interface ResultadoNovaTentativa { tentadas: number; ok: number; falharam: number; desistiram: number; pulados: number; cota: number; ignorados: { outro_teste: number; pausado_variante: number }; adiados: number; falhas: number; semDestinatario: number }`
  - `export interface PortasDaNovaTentativa { tentar?: typeof novaTentativa }`
  - `export async function faseNovaTentativa(supabase: SupabaseClient, relogio: RelogioDoVigia, f?: typeof fetch, limite?: number, portas?: PortasDaNovaTentativa): Promise<ResultadoNovaTentativa>`
  - `export async function avisarNovaTentativa(supabase: SupabaseClient, teste: { id: string; site_id: string; name: string }, rs: RestoreStatus, noAr: string | null): Promise<ResultadoAviso>`
  - `fraseDeDesistencia(nome, motivo, campos, noAr?: string | null)`:
    - `tres_falhas`: `` `A restauração do teste "${nome}" falhou 3 vezes e parou. ${noAr ? `No ar continua a variante ${noAr}.` : 'No ar continua o que estava antes.'} Corrija no YouTube Studio.` `` `// TEXTO-A-REVISAR`
    - `antes_da_nova_tentativa`: não é chamada (a conversão da Tarefa 6 não avisa).

Regras da fase (o corpo é do executor):
- Leitura 1: `ab_tests` `id, site_id, name, status, youtube_video_id, restore_seq, restore_status` com `.neq('status', 'active')` e `.or('restore_status->title->>estado.eq.falhou,restore_status->thumbnail->>estado.eq.falhou')`.
- Leitura 2 (uma só, `in`, montando um `Map<video, Set<id>>`; nada de `find` dentro do laço): testes abertos (`draft/queued/active/paused`) dos `youtube_video_id` lidos, **excluindo o próprio `id`** (S2 do Phil: `paused` com destino original, sem outro teste, é tentado); teste com outro aberto no mesmo vídeo → `ignorados.outro_teste++`, sem chamar `tentar`.
- `restore_status` ilegível (`paraRestoreStatus` nulo) → `falhas++` e Sentry, sem tentar; `paused` com destino variante → `ignorados.pausado_variante++`.
- `emParalelo(itens, limite, tentarUm, () => relogio.agora() - relogio.inicio >= NAO_INICIA_SETTLE_DEPOIS_MS)`; `adiados` vem dele.
- `tentarUm`: `tentadas++`; `tentar(id, { siteId, origem: 'vigia', prazo: relogio.inicio + PRAZO_DA_ROTA_MS, seqEsperado: restore_seq }, { supabase, fetch: f })`. `feito` com algum `desistiu`/`tres_falhas` → `desistiram++`; senão com algum `falhou` → `falharam++` (e `cota++` se o erro foi de cota); senão se algum campo terminou `pulado_*` → `pulados++` (Y-10: `pulado_drift` não é `ok`); senão `ok++`; `outro_teste` → `ignorados.outro_teste++`; `destino_invalido` → `falhas++` e **`avisarRestauracao` para cada campo recém-`desistiu`/`destino_invalido`** (chave `ab-restore-desistiu:<id>:<campo>`, frase nova; N1 do Phil: sem isso o Lab para mudo); outro resultado → ignorado sem contador; exceção → `falhas++` + Sentry. Depois de `feito`: `avisarNovaTentativa(..., noAr)` com `noAr` = rótulo da variante do último ciclo **só se essa variante não for a original e o campo tiver `escreveu === false`**; senão `null` e a frase neutra (S3 do Phil); `sem_destinatario` → `semDestinatario++`; `falha_de_envio` → `falhas++`.
- `avisarNovaTentativa`: há `falhou` → `claimAlert(supabase, 'ab-restore:<id>', '20 hours')` e, se reivindicou, um envio com `fraseDeFalha` do primeiro campo em `falhou` (texto existente); não há `falhou` → `releaseAlert(supabase, 'ab-restore:<id>')`; campos `desistiu`/`tres_falhas` → chave `ab-restore-desistiu:<id>:<campo>` (janela de 10 anos, como `:83`) e `fraseDeDesistencia(..., 'tres_falhas', campos, noAr)`, prioridade 3. Mesmo tratamento de `sem_destinatario`/`falha_de_envio` e de liberação de chave que `avisarRestauracao` (`:49-68`).
- Rota (Y-6): `converterInterrompidos` roda **fora e antes** das duas fases (a fase nova precisa ler o resultado dele); depois `const [drift, nt] = await Promise.all([faseDrift(...).catch(...), faseNovaTentativa(getSupabaseServiceClient(), { agora: Date.now, inicio }).catch(e => { Sentry…; return { ...ZERO, falhas: 1 } })])`, cada uma com `catch` próprio (emenda 37). `atencao` passa a incluir `nt.falhas > 0 || nt.adiados > 0 || nt.semDestinatario > 0`; a mensagem de `recordCronFailure` ganha `; nova tentativa: falhas X, adiados Y, sem destinatário Z, cota C; duracao_ms D`; `semDestinatario += nt.semDestinatario`; a resposta ganha, numa linha própria depois de `drift`: `nova_tentativa: { tentadas, ok, falharam, desistiram, pulados, cota, ignorados: { outro_teste, pausado_variante }, adiados, sem_destinatario }` **sempre**, e `duracao_ms = Date.now() - inicio`; antes de responder, `console.log('[ab-watchdog] resumo', JSON.stringify({ duracao_ms, drift, nova_tentativa, avisos }))` (F3).

- [ ] **Passo 1: testes unitários que falham** (`ab-watchdog-nova-tentativa.test.ts`, `tentar` injetado):
  - `zero testes → todos os contadores 0` (P4b-I9).
  - `relógio falso: 6 testes, limite 4, cada tentativa avança o relógio 8 s → começam os 4 primeiros (0 s) e 0 depois de 16 s: tentadas 4, adiados 2`.
  - `uma tentativa por execução: o mesmo teste aparece uma vez na leitura e tentar é chamado 1 vez`.
  - `outro teste active no mesmo vídeo → ignorados 1, tentar não é chamado` (P4b-I10).
  - `paused com destino variante → ignorados 1`; `ilegível → falhas 1, tentar não é chamado`.
  - `tentar lança → falhas 1, os outros seguem`.
  - `aviso: falhou → claimAlert('ab-restore:<id>', '20 hours'); a chave reivindicada às 10:00:30 é reivindicável de novo às 10:00:05 do dia seguinte e não às 20:00 do mesmo dia (F6/Y-7); segundo resultado sem falhou → releaseAlert da mesma chave; desistiu/tres_falhas → chave ab-restore-desistiu:<id>:<campo> e mensagem com "falhou 3 vezes e parou"`.
  - `fanOut com total 0 → semDestinatario 1`.
  - `pulado_drift → pulados 1, ok 0` (Y-10); `cota → cota 1, falharam 1`; `destino_invalido → falhas 1, tentar chamado uma vez e o campo vira desistiu`; `paused, destino original, sem outro teste → tentado` (S2); `noAr: variante original ou escreveu não-false → frase neutra` (S3).
- [ ] **Passo 2:** rota (`T/ab-cron-watchdog.test.ts`, `chain` com os métodos novos): `resposta com zero para tentar traz nova_tentativa com sete zeros e status ok`; `adiados 2 → status atencao e recordCronFailure chamado com "adiados 2"`; `sem_destinatario 1 → avisos.sem_destinatario soma e recordCronFailure`; `a fase de drift lança → a fase nova roda mesmo assim` (try próprio, emenda 37); `drift leva 14 s no relógio falso → a fase nova começa no instante 0 e adiados 0` (Y-6); `a resposta traz duracao_ms e o console.log de resumo` (F3). Rodar também, sem editar: `T/cron/ab-watchdog-competitor-history.test.ts`, `T/lista-fechada-do-que-apaga.test.ts`, `T/cache-writers.test.ts` [INFERÊNCIA: caminhos citados na emenda 37; o executor os acha com `ls T | grep -E "lista-fechada|cache-writers"` e `ls T/cron`].
- [ ] **Passo 3:** rodar os três arquivos → FAIL nos novos.
- [ ] **Passo 4:** implementar.
- [ ] **Passo 5:** rodar → PASS.
- [ ] **Passo 6: integração** (casos novos em `ab-p4b-nova-tentativa.test.ts`): `P4b-I1 inteiro: completed com thumbnail falhou attempts 1; faseNovaTentativa duas vezes (relógio de 10:00 e de 20:00 UTC) com o YouTube recusando → depois da 1ª attempts 2 e 1 chamada de escrita; depois da 2ª desistiu/tres_falhas com 3, e o fanOut recebeu a chave ab-restore-desistiu:<id>:thumbnail`; `P4b-I10: T1 completed falhou forcado true e T2 active no mesmo vídeo → nenhuma escrita, T1 igual`; `dois "parou" em correntes seguidas = dois envios (desistiu → retryRestore falha → vigia 2× → desistiu: o fanOut recebe a chave duas vezes; F7/Y-5)`; `N1: vigia com destinos divergentes → o fanOut recebe a chave ab-restore-desistiu:<id>:<campo> e a frase de destino_invalido`; `N2: converterInterrompidos converte em desistiu/tres_falhas (campo com attempts 2) → o fanOut recebe a chave e a frase de tres_falhas, uma vez`; `o .or() do PostgREST real acha falhou em title e em thumbnail e não acha active`. Comando de integração → PASS.
- [ ] **Passo 7:** lista do A/B, `tsc`; commit `feat: P4b, fase nova do vigia (nova tentativa, desistiu na terceira, aviso diário)`.

### Tarefa 5: as ações `retryRestore` e `dismissRestore`

**Files:**
- Create: `Y/ab-restore-acoes.ts`
- Modify: `AB/actions.ts` (duas ações no fim da seção de saída, perto de `revertWinner`, `:1064`)
- Test: **novo** `T/youtube/ab-restore-acoes.test.ts`, `T/integration/ab-p4b-nova-tentativa.test.ts` (casos novos)

**Interfaces:**
- Consumes: `novaTentativa` (Tarefa 3), `avisarNovaTentativa` (Tarefa 4), `podeDispensar`, `camposPendentes` (Tarefa 2), `traduzirSaida`, `recusaDeSessao`, `seqVistoSchema` (`Y/ab-acao-saida.ts`).
- Produces:
  - `export async function dispensarCampos(supabase: SupabaseClient, testId: string, siteId: string, campos: CampoNome[], seqVisto: number): Promise<ResultadoSaida>` (em `Y/ab-restore-acoes.ts`): relê; `restore_seq <> seqVisto` → `mudou`; algum campo ausente ou fora de `podeDispensar` → `ja_encerrado`; `update` de `restore_status` sem esses campos (vazio → `{}`) e `restore_seq + 1` com `.eq('restore_seq', seqVisto)`; zero linhas → `em_andamento`; depois, sem `falhou` restante, `releaseAlert('ab-restore:<id>')`, e para cada campo dispensado que estava `desistiu`, `releaseAlert('ab-restore-desistiu:<id>:<campo>')` (F7/Y-5). **Rastro (F8):** uma linha em `audit_log` (padrão de `competitors/actions.ts`): `action: 'ab_restore_dismissed'`, `entity_id: testId`, payload `{ campos, restore_seq, estados_dispensados }`, sem texto livre.
  - `export async function destinoDosCampos(supabase, testId, siteId, campos: CampoNome[]): Promise<'original' | 'variante' | null>` — nulo quando o teste não é do site.
  - Em `AB/actions.ts`: `export async function retryRestore(testId: string, seqVisto: number): Promise<ResultadoAcaoSaida>` e `export async function dismissRestore(testId: string, campos: CampoNome[], seqVisto: number): Promise<ResultadoAcaoSaida>`. Ordem: `requireEditAccess` (falha → `recusaDeSessao`); validar `seqVisto` (`seqVistoSchema`) e `campos` (Zod: `z.array(z.enum(['title','thumbnail'])).min(1).max(2)`; inválido → `MSG_PEDIDO_INVALIDO`); destino variante → `denyUnlessSiteAdmin(siteId, 'tentar de novo ou dispensar a restauração de uma variante')` (negado → `sem_permissao`, `MSG_SEM_PERMISSAO_VARIANTE`); `retryRestore` chama `novaTentativa(testId, { siteId, origem: 'humano', seqEsperado: seqVisto })`, libera `ab-restore-desistiu:<id>:<campo>` de cada campo que estava `desistiu` (F7/Y-5) e, se `feito`, `avisarNovaTentativa`; os dois terminam em `invalidarTelasDoAbLab()` quando a reivindicação andou (mesma regra de `resumeAbTest`, `AB/actions.ts:727`).

Desvio declarado do spec: o spec escreve `retryRestore(testId)` e `dismissRestore(testId, campo)`. As duas ganham
`seqVisto` (regra D3 da P4a: a tela recusa com `mudou` quando o teste mudou desde a abertura) e `dismissRestore` aceita
a lista de campos que a faixa mostra com o botão (um clique dispensa a faixa inteira; cada campo continua independente
no banco). P4b-I7 continua valendo com a lista de um campo.

- [ ] **Passo 1: testes que falham:**
  - `dispensarCampos(['title']) com title falhou e thumbnail ok → restore_status = { thumbnail: <igual> }, restore_seq + 1` (P4b-I7).
  - `dispensar o único campo → restore_status = {} e nunca null` (P4b-I7, D4).
  - `campo em_andamento ou ok → ja_encerrado, nada gravado`; `seqVisto velho → mudou`.
  - `dispensarCampos grava uma linha em audit_log com action 'ab_restore_dismissed' e os campos` (F8).
  - `desistiu → retry → falhou → vigia 2× → desistiu: dois envios de "parou" no total` (F7/Y-5; a liberação da chave acontece em retry e em dismiss).
  - Ações (com `requireSiteScope`/`denyUnlessSiteAdmin` mockados): `editora sem admin, destino variante → sem_permissao e nenhuma chamada a novaTentativa nem update`; `editora, destino original → chama novaTentativa com origem 'humano'`; `sem sessão → sem_permissao` (P4b-I8, lado servidor).
- [ ] **Passo 2:** rodar `npx vitest run test/youtube/ab-restore-acoes.test.ts > /tmp/ab-p4b-t5a.log 2>&1; tail -20 /tmp/ab-p4b-t5a.log` → FAIL.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** rodar → PASS.
- [ ] **Passo 5: integração:** `dismiss no banco real: o gatilho não grava linha nova em ab_test_restores e o CHECK aceita {}`; `retryRestore com teste desistiu/tres_falhas → reivindicação com attempts 0 e, com o YouTube aceitando, ok (P4b-I6 com destino variante: winner_applied_at gravado)`. Comando de integração → PASS.
- [ ] **Passo 6:** lista do A/B, `tsc`; commit `feat: P4b, ações Tentar agora e dispensar aviso (reivindicação por restore_seq, permissão por destino)`.

### Tarefa 6: o corte do deploy (P4b-I4) e a documentação do Cowork

**Files:**
- Create: `apps/web/test/integration/fixtures/ab-p4b-corte.sql` (o corpo da migration; o arquivo de migration nasce **só no envio**, Seção 4) e `ab-p4b-corte-volta.sql` (caminho de volta, **não** vira migration: fica no ledger para o caso de emergência; F9)
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
  and (t.restore_status -> 'title' ->> 'estado' = 'falhou' or t.restore_status -> 'thumbnail' ->> 'estado' = 'falhou')
  -- S1 do Phil: linha com escrita em voo fica de fora (restore_seq + 1 perderia o resultado dela)
  and not (t.restore_status -> 'title' ->> 'estado' = 'em_andamento' or t.restore_status -> 'thumbnail' ->> 'estado' = 'em_andamento');
```

Caminho de volta (`ab-p4b-corte-volta.sql`, F9; o `falhou` original continua em `ab_test_restores`, no seq anterior, então a
volta é exata): para cada campo com `estado = 'desistiu'` e `motivo = 'antes_da_nova_tentativa'`, `estado = 'falhou'` e
retirar `motivo`, com `restore_seq + 1`. Mesma forma do corte, idempotente.

- [ ] **Passo 1: teste que falha** (`ab-p4b-corte.test.ts`, lê o arquivo e o executa com `pg` contra `SUPABASE_DB_URL`):
  - `title falhou e thumbnail ok → title desistiu/antes_da_nova_tentativa com em, attempts, forcado e erro intactos; thumbnail igual; restore_seq + 1; uma linha nova em ab_test_restores`.
  - `restore_status null, {} e só ok → não mudam (restore_seq igual)`.
  - `rodar duas vezes → a segunda não muda nada` (idempotência).
  - `depois do corte, faseNovaTentativa não tenta o campo convertido` (P4b-I4).
  - `corte, volta: o restore_status fica igual ao de antes (exceto restore_seq)` (F9); `teste com um campo em_andamento: o corte não toca a linha` (S1).
  [INFERÊNCIA: o cliente `pg` já é usado nos testes de integração da P4a para aplicar SQL; se não for, o executor usa `execFileSync('psql', [url, '-v', 'ON_ERROR_STOP=1', '-f', caminho])`.]
- [ ] **Passo 2:** comando de integração com `test/integration/ab-p4b-corte.test.ts` → FAIL (arquivo não existe).
- [ ] **Passo 3:** criar os dois SQL acima; documentar no `cowork-docs-youtube.md` (motivos `tres_falhas`, `antes_da_nova_tentativa`, `destino_invalido` e o significado de `attempts`). Testes da pipeline validam estrutura, não conteúdo (CLAUDE.md, "Pipeline Integrity"); `docs/cowork-pipeline-reference.md` só muda se o JSON da seção mudar (não muda: só valores novos de `motivo`).
- [ ] **Passo 4:** → PASS; commit `test: P4b, corte do falhou anterior ao deploy (SQL da migration, ainda sem arquivo de migration)`.

### Tarefa 7: o texto da faixa da P4b

**Files:**
- Modify: `AB/_components/faixa-restauracao-texto.ts`
- Test: o teste existente do texto da faixa [INFERÊNCIA: `T/youtube/ab-faixa-restauracao-texto.test.ts` ou vizinho; achar com `grep -rln "montarFaixa" apps/web/test`], casos novos.

**Interfaces:**
- Consumes: `proximaVerificacao`, `vigiaAtrasado` (Tarefa 2), `simAindaVale`, `camposPendentes`, `podeDispensar`, `MAX_TENTATIVAS`.
- Produces:
  - `CtxFaixa` ganha `vigiaUltimaExecucao: string | null`, `podeAdministrar: boolean` e `bloqueio: 'outro_teste' | 'pausado_variante' | null` (F4/Y-4) e **`inicioDoSim: Partial<Record<CampoNome, string | null>>`** (R-1 do Yannis: a página lê `select em, forcado from ab_test_restores … order by seq desc limit 10` só para o campo `falhou` com `forcado = true` e passa `inicioDoSim(linhas)`).
  - `FaixaCompleta` ganha `acoes: { tentar: boolean; dispensar: CampoNome[]; motivoSemBotao: string | null }` (`FaixaOk` não tem).
  - `export function faixaTentando(rs: RestoreStatus, ctx: CtxFaixa): Faixa | null` — a faixa com os campos de `camposPendentes(rs, 'humano')` trocados por `em_andamento` com `em = ctx.agora` (o que a tela mostra enquanto "Tentar agora" corre: P4b-E1).

Frases (cópia do mockup, estados C, D, D2, H, I; `h` = `horaSP(c.em)`, `hp` = `HH:MM` de `proximaVerificacao(agora)` em SP, `n = c.attempts + 1`):
- `falhou` (C e D2): `` `O YouTube recusou em ${h}. Nova tentativa automática por volta das ${hp} (horário de São Paulo), tentativa ${n} de 3.` ``
- `falhou` com `simAindaVale(campo, agora, ctx.inicioDoSim[c])` (D; o mesmo critério do vigia, R-1): `` `O YouTube recusou em ${h}. Nova tentativa automática por volta das ${hp} (horário de São Paulo), sem perguntar de novo: ela repete a troca que você confirmou.` ``
- `bloqueio` ≠ nulo (nas frases de `falhou`): sem hora e sem "tentativa N de 3"; no lugar: `Sem nova tentativa automática enquanto outro teste estiver aberto neste vídeo.` (para `pausado_variante`: `Sem nova tentativa automática enquanto este teste estiver pausado.`) `// TEXTO-A-REVISAR`. O "Tentar agora" continua e recusa com `MSG_OUTRO_TESTE`.
- vigia atrasado: o trecho `por volta das ${hp} (horário de São Paulo)` vira `na próxima verificação` (nota do mockup C).
- `falhou` sem erro de escrita (hoje cai em `semResposta`, `:105`): mantém a frase de A3 e acrescenta ` Nova tentativa automática …` com a mesma regra. `// TEXTO-A-REVISAR` (composição de frases aprovadas).
- `desistiu`/`tres_falhas` (H): `lbl: 'Erro:'`, `resumo: `a restauração falhou 3 vezes e parou. ${cap} no ar ainda é ${o} da variante ${ctx.noArAntes}.``, linha `` `Última recusa do YouTube em ${h}. Não haverá nova tentativa automática.` ``, tom `err`, link do Studio.
- `desistiu`/`antes_da_nova_tentativa` (sem mockup): `lbl: 'Sem nova tentativa:'`, `resumo: 'a restauração falhou antes da nova tentativa automática existir. Confira no YouTube Studio.'`, linha `` `Não foi restaurado. Parou em ${h}.` ``, tom `none`, link. `// TEXTO-A-REVISAR`
- `desistiu`/`destino_invalido` (N1 do Phil): `lbl: 'Sem nova tentativa:'`, `resumo: 'não consegui saber para qual versão devolver. Confira no YouTube Studio.'`, linha `` `Parou em ${h}. Não haverá nova tentativa automática.` ``, **aviso** (tom `warn`, nunca `err`), link do Studio; **sem "Tentar agora"** (`acoes.tentar` falso, porque o motivo está fora de `camposPendentes('humano')`); o dispensar vale. `// TEXTO-A-REVISAR`
- Sem permissão (I): destino variante e `!podeAdministrar` → `acoes = { tentar: false, dispensar: [], motivoSemBotao: 'Só quem administra o site pode tentar de novo ou dispensar este aviso.' }`.
- `fine` (`NAO_DISPENSA`) some de todos os estados.
- `acoes.tentar` = existe campo em `camposPendentes(rs, 'humano')`; `acoes.dispensar` = campos com `podeDispensar`.

- [ ] **Passo 1: testes que falham:** `C: "tentativa 2 de 3" com attempts 1 e "07:00" com agora 08:00 UTC`; `C às 12:00 UTC → "17:00"`; `attempts 2 → "tentativa 3 de 3"`; `cota (attempts igual) → N igual`; `vigia atrasado → "na próxima verificação" e nenhuma hora`; `D com em de 47 h → frase "sem perguntar de novo"; com 49 h → frase de D2`; `R-1: falhou, forcado, em de 1 h, inicioDoSim de 50 h → frase de D2 (tentativa N de 3), não a de D`; `N1: desistiu/destino_invalido → aviso, sem "Tentar agora", sem a frase de "vídeo não encontrado"`; `H só com desistiu/tres_falhas, nunca com falhou attempts 2` (P4b-E2, nível do texto); `I sem admin → acoes vazias e motivoSemBotao`; `pulado_drift → dispensar ['thumbnail'], tentar false`; `desistiu/novo_teste → tentar false, dispensar com o campo`; `nenhuma faixa da P4b contém "Este aviso ainda não pode ser dispensado."`; `falhou + bloqueio outro_teste → nenhuma hora e nenhum "tentativa N de 3"` (F4/Y-4); `pulado_teste_youtube → sem botão, texto neutro, sem quebrar o switch exaustivo` (F10); `faixaTentando de C → tom busy e "Voltando ao original…"` (frase de A1, `frasesBusy`).
- [ ] **Passo 2:** rodar → FAIL. **Passo 3:** implementar. **Passo 4:** rodar → PASS.
- [ ] **Passo 5:** lista do A/B, `tsc`; commit `feat: P4b, texto da faixa com nova tentativa, 3 falhas e permissão`.

### Tarefa 8: os botões na faixa

**Files:**
- Create: `AB/_components/faixa-com-acoes.tsx` (`'use client'`)
- Modify: `AB/_components/faixa-restauracao.tsx` (prop opcional `children`, desenhada depois do link do Studio)
- Modify: `AB/_components/faixa-da-pagina.ts` (passa `vigiaUltimaExecucao`, `podeAdministrar`, `bloqueio` (uma leitura por `youtube_video_id`: outro teste aberto, excluindo o próprio `id`; ou `paused` com destino variante); devolve também `faixaTentando`)
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
- Modify: `Y/ab-resume.ts:140-148` (PODE-1 no retomar: mesma conversão da Tarefa 3 antes da reivindicação; a reivindicação do retomar grava `attempts: 0`)
- Modify: `Y/ab-start.ts` (`:93` usa `proximaDoInterrompido`; **Y-2**: em `resolverPendenciasDoVideo`, se **outro** teste do vídeo tem campo `em_andamento` com menos de `INTERROMPIDO_MIN`, o start recusa com `MSG_EM_ANDAMENTO` antes da reivindicação `draft → active`)
- Modify: `AB/actions.ts` (`resumeAbTest(testId, seqVisto)`, `revertWinner(testId, seqVisto)`), os chamadores na tela [INFERÊNCIA: `AB/_components/active-detail.tsx`, `winner-detail.tsx`; achar com `grep -rn "resumeAbTest\|revertWinner" AB`]
- Modify: `AB/_components/ab-pause-dialog.tsx` (Pausar com diálogo fechado em `unauthenticated`/`catch`: `!montado.current` → `onAviso` + `router.refresh`, espelho do D-1 da P4a)
- Test: `T/ab-actions-resume.test.ts`, `T/youtube/ab-pause-dialog.test.tsx` [INFERÊNCIA no nome], `T/integration/ab-p4a-retomar-iniciar.test.ts` (caso novo)

- [ ] **Passo 1: testes que falham:** `retomar com seqVisto velho → mudou, nada escrito` (Y-5); `reverter com seqVisto velho → mudou`; `retomar com thumbnail em_andamento de 3 min → ab_test_restores ganha falhou/escreveu null com o em antigo; teste active` (PODE-1, integração); `Pausar: diálogo fechado e resposta unauthenticated → aviso de página e refresh`; `Y-2 (unitário): outro teste do vídeo com thumbnail em_andamento de 30 s → start recusa, nada escrito`; `Y-2 (integração): novaTentativa em voo (YouTube falso que segura a escrita) + startAbTest no mesmo vídeo → start recusa; uma escrita só`; `ab-start.ts:93 conta a tentativa (attempts 2 interrompido → desistiu/tres_falhas)`.
- [ ] **Passo 2:** FAIL. **Passo 3:** implementar (`settleOnAir` já aceita `seqEsperado`; `retomarTeste` ganha o mesmo parâmetro). **Passo 4:** PASS.
- [ ] **Passo 5:** lista do A/B, integração da P4a e da P4b, `tsc`; commit `fix: P4b, dívidas da P4a (seqVisto em retomar e reverter, PODE-1 no retomar, Pausar silencioso)`.

### Tarefa 10: textos marcados e captura para o dono

**Quando (Hanna H3):** logo depois da T7 (e da T13, se a Parte B já foi), **em paralelo com T8, T9 e T11**, para os 10 min do dono saírem do caminho crítico.

**Files:** os `// TEXTO-A-REVISAR` (Tarefas 3, 4, 7, 13).

- [ ] **Passo 1:** `grep -rn "TEXTO-A-REVISAR" apps/web/src` → lista para o Logan (Sonnet, `medium`), com o mockup e as frases vizinhas; ele devolve o texto final por linha.
- [ ] **Passo 2:** aplicar; o controlador leva ao dono as frases que não estão no mockup (emenda 31), com a recomendação do Logan; o envio não sai sem resposta (pergunta Q2). Entram nesse bloco as frases novas da r1: bloqueio da faixa (T7), `destino_invalido` e `tres_falhas` (T4).
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

**Envio independente (Hanna H1).** A Parte B não depende da A, não tem migration e só espera o G0. Ordem dentro dela:
**T16 (coleta que expira, primeiro) → T13 → T14 → T15** (H2). Revisão do lote da B: Phil e Yannis sobre estas quatro
tarefas (diff pequeno; re-revisão em Sonnet). Os passos de ambiente da Tarefa 1 valem para as duas partes. Pronto quando:
(a) criar teste num vídeo com teste `queued` é recusado com a frase em português e nada é criado; (b) um teste criado
pelo assistente aberto do Observatório tem `config.referencia` com os três campos (conferido por `select` no primeiro
teste real); (c) reporter em `ab-lab/new` volta à lista; (d) os três lugares mostram o mesmo "dia do teste". O dono vê:
"não dá mais para abrir dois testes no mesmo vídeo; as mensagens do assistente estão em português; o teste guarda de
qual vídeo do concorrente ele veio".

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

- [ ] **Passo 0 (Y-11 do Yannis):** a lista mostra dias corridos; `active-detail.tsx:110,164` mostra `cycles.done` (ciclos feitos). Num dia de rotação perdida divergem de propósito. **Logan/Hanna decidem qual número é "o dia do teste" antes de unificar** (sem decisão, a T15 unifica só as duas contas de dias corridos e deixa `cycles.done` rotulado como "ciclos").
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

1. **Portão G0:** E8 do ensaio da P4a concluído e registrado no ledger da P4a. **Data (H5, conferida no ledger da P4a,
   `progress.md` linhas 131-137):** o dono liberou o ensaio em 18/10 ~16:05 UTC por 2 dias; E0 e E1 ficaram prontos em
   18/10, o E2 é no dia 2 (19/10, depois das 05:15 BRT) e o E8 fecha por volta de **20/10**, não em 19/10 (a data
   exata sai do ledger quando o E8 for registrado). Antes disso: nada a `staging`.
2. **Duas formas de enviar (pergunta Q3; o dono decide):**
   - **Opção 1 (recomendada pela Hanna): dois envios.** **B1** = Parte B, sem migration, sobe quando o E8 fechar e a
     revisão da B fechar; **A** = Parte A + migration do corte, quando os portões dela fecharem (T10, T11, T12).
     Custo: um push a mais (4 builds). Ganho: os consertos do assistente e a coleta da referência não esperam dias.
   - **Opção 2: um envio só.** Tudo junto depois da Tarefa 12. Custo: a coleta de `config.referencia` e os quatro
     consertos esperam a Parte A inteira. Vale se a A ficar pronta no mesmo dia que a B.
   **Conferência de duplicatas no B1 (H8, condição do Phil e do Yannis; só `select`, o dono roda antes do push):** vídeos com mais de um teste em `draft/queued/active/paused` (`select video_id, count(*) from ab_tests where status in ('draft','queued','active','paused') group by 1 having count(*) > 1`); esperado 0, resultado salvo no ledger. Se não for 0, o B1 não sai. O índice `ab_tests_one_active_per_video` cobre só `draft/active/paused` (`20260517000001_ab_testing.sql:32-34`); a barreira da Tarefa 13 cobre o uso normal.
   Em qualquer opção, o passo 3 em diante vale para a **Parte A**; o B1 só faz push, CI e promoção (itens 5 a 7 sem a migration).
3. **Revisões fechadas** (Tarefa 12), textos fechados e respondidos pelo dono (Tarefa 10), capturas aprovadas (Tarefa 11).
4. **Leitura de produção (H4: pode rodar já, antes do E8, e repete no dia; o dono roda, o agente prepara
   `comandos/p4b-leitura-prod.sh`, só `select`):**
   ```sql
   select id, status, restore_seq, restore_status from public.ab_tests
    where restore_status->'title'->>'estado' in ('falhou','em_andamento')
       or restore_status->'thumbnail'->>'estado' in ('falhou','em_andamento');
   ```
   Esperado: `active` com `falhou` = 0; `em_andamento` com mais de 15 min = 0 (se houver, o vigia converteria em `falhou`
   "novo" depois do deploy; o corte pula essas linhas, então **não se corta com `em_andamento` aberto**: o dono refaz a leitura até dar 0; N3 do Phil). Salvar no ledger a **lista fechada** `id, campo,
   estado, em, attempts` e a **conta esperada** (F9).
5. **Ordem do envio da Parte A (F2 do Phil, inverte a ordem anterior):** primeiro **push a `staging`, CI verde e
   promoção da P4b ao `main`**; **logo depois, a migration do corte**, ambos a mais de 30 min de 10:00 e 20:00 UTC.
   Motivo: entre a migration e a P4b no ar existem CI de staging (~55 min) e a promoção, 1 a 2 h em que o código da P4a
   ainda grava `falhou` (encerrar, vencedor, drift); esses `falhou` escapariam do corte e o vigia da P4b os tentaria,
   **forçando** se `forcado` e com menos de 48 h, justamente o que Y-11 e P4b-I4 proíbem. Na ordem nova, a janela erra
   para o lado seguro: um `falhou` gravado pela P4b vira `desistiu`/`antes_da_nova_tentativa`, sem escrita, e o dono
   usa "Tentar agora". **Exceção declarada à regra "migration antes do código" do CLAUDE.md:** aqui só muda dado, e
   nenhuma das duas versões do código quebra com ele (o motivo novo e o `falhou` antigo são lidos pelas duas). A
   referência do corte é a **promoção ao `main`** (o cron da Vercel só roda em produção; Y-12), não o push a `staging`.
   - Migration: numa árvore em dia com `origin/staging`: `npm run db:new ab_lab_p4b_corte_da_nova_tentativa`; copiar o
     corpo de `apps/web/test/integration/fixtures/ab-p4b-corte.sql`; `cmp` entre os dois → idêntico.
   - `npm run db:push:prod -- --dry-run` [INFERÊNCIA: a forma exata do dry-run é a do script da P4a, `comandos/` do
     ledger da P4a] mostra **uma** pendente, a nossa.
   - Janela: **fora** de 11:30-13:00 UTC e dos minutos 0-4, 20-24, 30-34 e 40-44 de qualquer hora; nunca a 10 min do
     vigia (10:00 e 20:00 UTC) nem das janelas de promoção do Phil (07:50-08:10, 09:50-10:10, 11:50-12:10, 19:50-20:10 UTC).
   - **Vez proposta na fila** `.superpowers/sdd/a5/fila-do-db-push.md` (só proposta, não reservada): depois da S4 da A5
     e da S7 fase 1 do A/B que já estiverem em `origin/staging` (o carimbo tem de ser posterior ao último arquivo), no
     dia do envio da P4b (depois do E8, ~20/10 ou depois), antes de 29/10 23:59 UTC. Texto para a fila: "(A/B P4b) corte
     da nova tentativa, `ab_lab_p4b_corte_da_nova_tentativa`, só dado (`falhou` → `desistiu`), sozinha, logo **depois** da
     promoção do código da P4b; avisa a A5 antes."
   - **Conferência do corte:** antes, `select count(*)` dos campos `falhou` (igual à conta esperada do item 4); depois,
     `select count(*)` dos campos com `motivo = 'antes_da_nova_tentativa'` tem de ser igual, e os `falhou` antigos, 0.
   - **Caminho de volta** (`ab-p4b-corte-volta.sql`, testado na Tarefa 6): devolve `antes_da_nova_tentativa` a `falhou`,
     com `restore_seq + 1`; o `falhou` original continua em `ab_test_restores`, então a volta é exata.
6. **Push a `staging`** (a P4a combinou avisar a A5 antes de levar código do A/B; ledger da P4a linha 128), CI verde,
   **promoção** fora das janelas de promoção acima. **Conferência depois (F3: o `cron_health` não tem `duration_ms`):**
   ler o **log da Vercel** da execução das 10:00 e da das 20:00 UTC **dentro da retenção** (curta no plano gratuito;
   ler na mesma hora): a linha `[ab-watchdog] resumo` traz `nova_tentativa` com os contadores (zeros incluídos) e
   `duracao_ms` < 45 000; repetir na execução seguinte; duas seguidas sem falha. Se a leitura do log for negada ao
   agente, o comando vai pronto para o dono. O ledger diz literalmente: "botões, nova tentativa e `desistiu`: **não
   verificados em produção**" (aceite 5.2, item 3). **Pendência para o controlador:** o aceite 5.2 (itens 1 e 2) cita
   `cron_health.duration_ms`; trocar por este log.
7. **Aviso à fase 2 da S6/S7** (quando for planejada): a tabela de ganchos (spec S6/S7 §6.4) ganha a linha
   "nova tentativa (vigia e `retryRestore`): com bloqueio, não reivindica, não escreve, **não gasta tentativa**; o vigia
   conta em `ignorados`; `retryRestore` recusa com a frase da guarda". `novaTentativa` passa por `restaurarCampos`, então
   a asserção de `PasseGuarda` a cobre; o `dispensarCampos` não escreve no YouTube e fica fora da guarda. A fase 2 também
   herda: `pulado_teste_youtube` já é lido (F10) e fica fora de `camposPendentes`/`podeDispensar` até ela decidir.

## 5. Horas (estimativa do controlador; base: P4a; atualizada na r1)

| Bloco | Agentes | Dono |
|---|---|---|
| Revisão do plano (r1 feita; emenda r2 e re-revisão em Sonnet) | 2 a 3,5 h | 5 min ("pode") |
| Parte A, Tarefas 1-9 (r1 soma: `inicioDoSim`, `proximaDoInterrompido`, bloqueio da faixa, `audit_log`, caminho de volta, Y-2 no start, fases em paralelo, ~16 casos de teste) | 8 a 11,5 h | — |
| Tarefa 10 (textos) e 11 (Gio, capturas, suíte) | 2 a 3 h | 15 min (frases novas, aprovar capturas) |
| Tarefa 12 (revisão do lote) | 1,5 a 2,5 h | — |
| Parte B, Tarefas 13-16 (+ revisão própria se for envio separado) | 2,5 a 4,5 h | — |
| Envio (leitura, push, migration depois da promoção, conferência pelo log) | 1 a 1,5 h | 10 min (rodar a leitura; ok da migration) |
| **Total** | **17 a 26,5 h** | **~35 a 45 min** |

O roteiro (etapa 14, `docs/superpowers/plans/2026-10-14-ab-lab-roteiro-e-horas.md:14`, 6,5 a 10 h) está velho (H6): a
diferença é a Parte B (avisos da A5, aprovada em 18/10), as dívidas da P4a da Tarefa 9 e os consertos da r1.
**Pendência para o controlador:** atualizar essa linha do roteiro com este número (não editei: o arquivo tem mudanças
não commitadas de outra sessão). O que o dono vê depois de cada envio: B1, "não dá mais para abrir dois testes no
mesmo vídeo; mensagens do assistente em português; o teste guarda a referência do concorrente"; A, "quando o YouTube
recusa a volta ao original, o sistema tenta sozinho às 07:00 ou 17:00 (São Paulo), até 3 vezes; na faixa você tenta na
hora ou dispensa o aviso se já corrigiu no Studio".

## 6. Perguntas ao dono (a recomendação do plano, a da Hanna e o custo de cada lado)

- **Q1. O corte do `falhou` antigo (P4b-I4) por migration de dado?** Plano e Hanna: **sim**. Ordem do Phil (F2): a
  migration roda **depois** da promoção do código, a mais de 30 min do vigia. Custo do sim: uma vez na fila do banco, só
  dado, testada no `bythiago_int`, com caminho de volta. Custo do não: código que compara o `em` com uma data fixa
  escrita no commit, que erra para o que falhar entre o commit e o deploy. A leitura de produção (item 4 da seção 4)
  pode rodar já; mesmo com zero, a Hanna manteria (é barata e cobre a janela).
- **Q2. Frases sem mockup** (motivo `antes_da_nova_tentativa`; aviso de "falhou 3 vezes"; bloqueio da faixa; recusa
  "outro teste aberto neste vídeo"; mensagens do assistente em português): plano e Hanna: o Logan fecha e você aprova
  **em bloco**, por texto, sem novo mockup, no **meio** da Parte A (Tarefa 10, em paralelo com T8, T9 e T11). Custo: 10 min
  seus, fora do caminho crítico; sem isso o envio da A espera.
- **Q3. A Parte B (avisos da A5) vai no mesmo envio da Parte A?** Plano (r0): junto. **Hanna: não, envio próprio B1
  logo após o E8** (o E8 fecha por volta de 20/10). Custo do separado: 1 push a mais (4 builds). Custo do junto: os
  consertos e a coleta da referência esperam a Parte A inteira (dias). Muda para "junto" se a A ficar pronta no mesmo dia
  que a B. **Decisão do dono**; o plano está estruturado para as duas.
- **Q4. "Tentar agora" e "dispensar" também pelo Cowork (pipeline e MCP)?** Plano e Hanna: **não agora**; a leitura já
  tem paridade (o `GET` traz `restore_status`); as duas ações escrevem no YouTube e pedem chave por pessoa com uso
  registrado (gatilho). Custo: pelo Cowork você vê a falha mas resolve na tela.
- **Q5. Ficam fora, com gatilho:** abrir rascunho por id (aviso A5 4; desnecessário com o padrão "link para a lista";
  gatilho: pedir "Ver teste" no rascunho) e o curinga do Blob (aviso A5 7; gatilho: apertar a CSP). Plano e Hanna:
  **fora**. Custo: nenhum comportamento muda hoje.

## 7. Riscos

- **Orçamento de 60 s do vigia:** as fases de drift e nova tentativa agora rodam em paralelo (Y-6), então o drift lento
  não come mais os 15 s da fase nova. Resta o gasto das podas antes delas. A duração nunca foi medida (F3): as duas
  primeiras execuções gravam `duracao_ms` no log; se o início das tentativas passar de 10 s, o corte da fase nova vira
  30 s contado do início da rota (55 s menos 25 s da escrita). Cota do YouTube: ~101 unidades por tentativa de combo;
  5 testes em `falhou` custam ~1.010 unidades por dia (10% de 10.000), 15 testes ~30%.
- **O "sim" renovado (resolvido na r1):** as 48 h contam do primeiro `forcado` da cadeia (`inicioDoSim`, Yannis Y-3) e
  a cota preserva `em`/`forcado`/`attempts` (Phil F5), com teto de 72 h. Resta: pelo "Tentar agora" o dono renova
  clicando, de propósito. Desvio do spec ("a partir do `em` do campo"): a âncora vem do histórico; o spec 32 k deve
  ganhar a frase (pendência do controlador).
- **Janela residual do start (R-3 do Yannis, dívida declarada):** a recusa da Tarefa 9 lê o `em_andamento` antes de reivindicar `draft → active`; um vigia que passou pelo passo 5 antes de o T2 existir e reivindica entre a leitura e a reivindicação do start ainda escreve a original por baixo do T2. Milissegundos, dono único; risco: uma escrita errada de thumbnail, uma vez. Gatilho para pagar: segundo caso visto; a reivindicação do start passa a conferir `restore_seq` do teste anterior.
- **Cadeia do "sim" entre paradas (R-4 do Yannis):** pausar/retomar/parar de novo no mesmo teste sem linha `ok` ou `forcado false` entre as duas faz a âncora do "sim" velho valer para o novo (`dispensar` e `retomar` não geram linha); o vigia pode não forçar quando o dono acabou de dizer sim. Lado seguro, sem dano; registrar junto da nota do spec 32 k.
- **Fase 2 da S6/S7:** se ela entrar antes deste lote, a `novaTentativa` precisa do passe da guarda (item 6 do envio);
  se entrar depois, ela acrescenta o gancho. Quem chegar segundo faz.
- **Sobreposição de avisos:** a falha original avisa por `restore_seq` (P4a) e a primeira nova tentativa no mesmo dia
  avisa pela chave diária: até dois avisos no primeiro dia. Declarado; o Logan pode juntar os textos.
- **Leitura de produção** pelo agente é negada no modo automático: a Seção 4 depende do dono rodar a leitura.

---

## Não aplicado (r1)

| Item | Motivo |
|---|---|
| (H8 saiu daqui na r2) | Virou condição escrita: ver "Condições do acordo (r2)" abaixo e a conferência do B1 (Seção 4, item 2). |
| Y-11 (Yannis): unificar o "dia do teste" | Aplicado como passo 0 da Tarefa 15 (Logan/Hanna decidem qual número é a verdade antes de unificar); o plano não decide. |
| Aviso em dobro no 1º dia (Yannis, dívida) | Já declarado em Riscos; o Logan pode juntar os textos (backlog da Hanna, gatilho: o dono reclamar). |
| Consulta Y-5 repetida (fase + `novaTentativa`) | Aceito pelo Yannis (n pequeno); gatilho: mais de 100 testes pendentes. |
| Y-7 da P4a (`restore_seq` opcional no tipo) | Fora, sem ganho de comportamento; gatilho: próxima mudança no tipo. |
| Índice para a consulta da fase (Phil) | Tabela de dezenas de linhas; revisitar com mais de 10 mil testes. |
| Botões pelo Cowork (Q4), rascunho por id (A5 4), curinga do Blob (A5 7), "Continuar/Passo 2 de 3" (A5 9) | Q4/Q5 e backlog da Hanna, com gatilho. |
| Roteiro (linha 14) e aceite 5.2 | Edição do controlador (arquivos fora deste worktree/em mudança por outra sessão); listados nas seções 4 e 5. |

## Condições do acordo (r2)

- **H8 (índice com `queued`):** a próxima migration que tocar `ab_tests` (qualquer motivo) recria `ab_tests_one_active_per_video` incluindo `queued`, precedida da leitura de duplicatas acima (esperado 0). Gatilho antecipado: segundo teste criado sobre vídeo com `queued`. Até lá, a trava é a barreira da Tarefa 13 e o índice atual no ponto que escreve no YouTube (ativação).

## Registro de revisões

**r1 (18/10, pareceres de Phil 72, Yannis 78, Hanna 84):**

| Achado | Onde entrou |
|---|---|
| F1 + Y-1 (interrompido volta `attempts` a 1; laço sem fim) | Global Constraints (`attempts`); Tarefa 2 (`proximaDoInterrompido`, testes 0/1/2); Tarefa 3 (`attempts: 0` no settle, PODE-1, testes de unidade e de integração "tentar lança"); Tarefa 9 (`ab-start.ts:93`, retomar); Review Focus 6 |
| F5 + Y-3 + H7 (janela de 48 h) | Global Constraints (âncora do Yannis + cota do Phil, 72 h, escolha declarada); Tarefa 2 (`inicioDoSim`, `simAindaVale`); Tarefa 3 (passos 6 e 8, testes); Riscos; Review Focus 7 |
| F4 + Y-4 (faixa promete tentativa que não ocorre; `destino_invalido`) | Global Constraints (fase do vigia, bloqueio); Tarefas 3, 4, 7, 8 (`bloqueio`, `ignorados` por causa, `desistiu`/`destino_invalido`) |
| F7 + Y-5 (segundo "parou" mudo) | Global Constraints (avisos); Tarefa 5 (liberação da chave em retry e dismiss, teste); Tarefa 4 (integração) |
| F2 (ordem do envio) + Y-12 (referência é a promoção) | Seção 4 itens 5 e 6; Q1 |
| F3 (`duration_ms` inexistente) | Global Constraints (resposta do cron); Tarefa 4 (rota, `duracao_ms`, log); Seção 4 item 6; Riscos |
| F6 + Y-7 (`'1 day'`) | Global Constraints (avisos), Tarefa 4 (`'20 hours'` e teste) |
| F8 (rastro do dismiss) | Tarefa 5 (`audit_log`) |
| F9 (volta e lista fechada do corte) | Tarefa 6 (`ab-p4b-corte-volta.sql`, testes); Seção 4 itens 4 e 5 |
| F10 (Zod e `pulado_teste_youtube`) | Seção 2; Tarefa 2; testes nas Tarefas 2, 3 e 7 |
| Y-2 (start × nova tentativa) | Tarefa 9 (`ab-start.ts`, testes unitário e de integração) |
| Y-6 (fases em série) | Global Constraints; Tarefa 4 (`Promise.all`, teste); Riscos |
| Y-8, Y-9, Y-10, S1, S2, S3, S4 | Tarefa 3 (`anterior(c)`); Tarefa 2 (teste do `vercel.json`); Tarefa 4 (`pulados`); Tarefa 6 (corte pula `em_andamento`); Tarefa 4 (Leitura 2 sem o próprio id; `noAr`); S4 = Y-6 |
| H1 (Parte B independente) | Global Constraints; cabeçalho da Parte B; Seção 4 item 2 (duas opções); Q3 |
| H2 (T16 primeiro) e H3 (T10 no meio) | Mapa de arquivos ("Ordem de execução"); cabeçalho da Parte B; Tarefa 10 |
| H4 (leitura de produção cedo) | Seção 4 item 4 |
| H5 (data do E8) | Seção 4 item 1: ~20/10, conferido no ledger da P4a (linhas 131-137) |
| H6 (horas e roteiro) | Seção 5 (nova estimativa 17 a 26,5 h); pendência do roteiro |
| H8 (índice com `queued`) | "Não aplicado" (precisa de decisão e, se entrar, de migration) |
| Y-11 (dia do teste) | Tarefa 15, passo 0 |

**r2 (18/10, condições do acordo: Phil 92, Yannis 92):**

| Achado | Onde entrou |
|---|---|
| Yannis R-1 (faixa D lê o `em` do campo, o vigia lê a âncora) | Tarefa 7 (`CtxFaixa.inicioDoSim`, `simAindaVale` com 3º argumento, teste `em` 1 h / âncora 50 h → D2) |
| Yannis R-2 (`forcado` do `em_andamento`) | Tarefa 3, passo 7 (`forcado: forcar`, teste) |
| Yannis R-3, R-4 | Riscos (janela residual do start; cadeia entre paradas) |
| Phil N1 (`destino_invalido` mudo, frase errada, botão que recusa) | Tarefa 2 (`camposPendentes('humano')` exclui, teste); Tarefa 4 (`fraseDeDesistencia`, aviso no `tentarUm`, teste); Tarefa 7 (frase de aviso, `acoes.tentar` falso, teste) |
| Phil N2 (interrompido → `desistiu` avisa uma vez) | Tarefa 4, passo 6 (integração) |
| Phil N3 (corte e `em_andamento`) | Seção 4, item 4 (não se corta com `em_andamento` aberto) |
| H8 (índice com `queued`) | Seção 4, item 2 (conferência no B1); "Condições do acordo (r2)"; saiu de "Não aplicado" |

## Decisões do dono (19/10 ~01:35 UTC)

"Sim pra tudo", pela recomendação: **Q1** sim, corte dos `falhou` antigos por migration de dado, depois da promoção (ordem do Phil). **Q2** sim, Logan fecha as frases e o dono aprova em bloco. **Q3** Parte B em envio próprio (B1) logo depois do E8 (recomendação da Hanna). **Q4** botões pelo Cowork: não agora. **Q5** avisos 4 e 7 da A5 ficam fora, com gatilho. Plano com acordo de Phil (92) e Yannis (92) na r2. Libera executar a partir do E8 (G0); nada vai ao ar antes.
