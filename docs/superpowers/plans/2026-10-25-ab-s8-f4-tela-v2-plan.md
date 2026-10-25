# S8-F4 T12: tela v2 do teste A/B, plano de implementação

> **Para agentes executores:** use a sub-skill superpowers:subagent-driven-development (recomendada) ou superpowers:executing-plans e siga tarefa por tarefa. Os passos usam checkbox (`- [ ]`).

**Status: acordo Phil 92 / Yannis 92 / Hanna 91 (r2.1, 25/10/2026; ver "r2.1: emenda" no fim).**

**r2, 25/10/2026 (conserto de r1 = 93e2c535b; Sonnet).** Aplica os 24 achados de Phil (P1-P7), Yannis (Y1-Y10) e Hanna (H1-H7) e as decisões do dono (Y2: `forcar` agora; Y3: "aplicada, desfecho mudou"); tabela no fim ("r2: como cada achado foi tratado"). Os textos ◆T já estão finais neste plano (seção ◆T); nenhum portão de texto antes da T6.

**r1, 25/10/2026 (1º rascunho, Opus).** Implementa a §T12 do plano pai `docs/superpowers/plans/2026-10-24-ab-s8-f4-plan.md` (l. 483-487) a partir do **mockup M5 r5 aprovado pelo dono em 25/10 10:50** (`bythiagofigueiredo/docs/superpowers/mockups/2026-10-25-m5-tela-v2/`, README e `index.html`) e das respostas `.superpowers/sdd/ab-lab/m5/respostas-{phil,yannis,hanna}.md` (repo principal). Linhas citadas conferidas no worktree `bt-s8-f2` em `10688089a`.

**Objetivo:** o teste com `regra_duracao = 'v2'` ganha na tela do A/B Lab o andamento por dias fechados, o bloco "Falta para decidir"/"Quanto o teste alcançou", o sinal provisório, o selo e a frase do desfecho, "Provisório até DD/MM", "No ar agora", e as ações Aplicar e Voltar à original no concluído; o ⓘ do placar M4 em produção passa a ser o `InfoDica` do Observatório.

**Arquitetura:** uma função pura `telaV2DoTeste` monta, no servidor, um modelo `TelaV2` só com leitura (`lerResultadoV2`, `por_variante`, `estadoV2DoTeste`, `pisos` sobre as linhas que `getTestResults` já lê, `provisorioAte`); os componentes só desenham esse modelo. Nada recalcula estatística. Ações reusam `aplicarSugerido` (que ganha `forcar?`, Y2) e `revertWinner`. Fonte única de dado em `decisao-v2.ts`: `diasDaDecisao` (Y4) e `ctrDosValidos` (P2); no concluído, tudo sobre os dias `<= encerrado_em_dia` (P1).

**Tech:** Next 16 + React 19, TypeScript strict, Vitest (jsdom para componente), CSS global por componente (padrão de `placar-do-teste.css`).

## Restrições globais

- **Worktree:** `$WT=/Users/figueiredo/Workspace/bt-s8-f2`, `W=$WT/apps/web`. Branch do controlador. Tarefas **em série** (T4-T8 editam `ab-types.ts` e `queries.ts`; o pre-commit roda `tsc` na árvore toda).
- **A tela só LÊ `result_metadata.v2`.** Fontes únicas: `lerResultadoV2` (`lib/youtube/ab-types.ts:263`), `por_variante` (só não originais), `estadoV2DoTeste` + `tetoDoTesteV2` (`ab-gravacao/decisao-v2.ts:85,25`), `pisos(dias, variantes, n)` (`:287`) sobre as linhas de `ab_test_dias` que `getTestResults` já lê, mapeadas por `diasDaDecisao` (Y4) e, no concluído, cortadas em `encerrado_em_dia` (P1); CTR do vencedor por `ctrDosValidos` (P2). **Proibido:** chamar `estatisticaV2`, `decidirV2`, `desfechoProvisorio`, `sugeridoV2`, calcular lift ou p na tela; usar `ultima_avaliacao` ao lado de `pisos()` (dois números de dias válidos; plano pai T5 (b)).
- **"No ar agora" vem de `winner_variant_id`** (+ `winner_applied_at`), nunca de `vencedor_sugerido` (Yannis: a T9 sobrescreve o sugerido depois de `manual_winner`; `winner_variant_id ≠ vencedor_sugerido` = "aplicada, desfecho mudou", Y3). **"A original vence"** = `desfecho = 'vencedor_provavel'` e `vencedor_sugerido` = id da variante `is_original`.
- **Ativo sem botão de aplicar** (veto do Phil), **sem lift, sem %, sem aviso de volume** (só a barra "Impressões X de N" de `pisos().volume` e `v2.n`). O aviso de volume fica só no início (T11c, C-17), sem mudança aqui.
- **Sem campo novo no banco, sem migration, sem `aplicado_em`.** A única função nova de dado é `provisorioAte` (pura).
- **Textos de interface exatamente como no mockup** (tabela da T4) e, para o que o mockup não tem, **a tabela ◆T final** (seção Decisões; Logan + Naksu, 25/10). O executor nunca inventa frase: estado sem linha na tabela volta ao controlador. Exceção declarada: o ⓘ dos pisos usa o texto ◆T 10, não o do mockup (H3).
- **v1 não muda** (nenhum bloco novo; o placar M4 segue com a frase e o andamento dele).
- **Next 16:** nada de `next/link` nem componente de Server Component como prop para client; server actions chegam por prop (`.bind` no `page.tsx`), nunca importadas por componente novo além do padrão já existente no arquivo.
- **Sem `any`.** Zod só onde já existe (`ResultadoV2Schema`).
- **Testes:** componente em arquivo `.tsx` com `// @vitest-environment jsdom`; pura em `.ts` (node). Datas relativas ou `vi.useFakeTimers()` + `vi.setSystemTime`; nunca ano fixo no futuro. Saída em `/tmp/s8t12-*.log`, só `tail` no contexto; nenhum comando > 4 min em primeiro plano (suíte em background com `; echo FIM >>`).
- **Pipeline Integrity:** nenhuma rota nova. A projeção do Cowork ganha `provisorio_ate` (T1) ⇒ atualizar `apps/web/data/pipeline-docs/cowork-docs-youtube.md`, `docs/cowork-pipeline-reference.md` e o `describe` de `manage_ab_test` (`lib/pipeline/mcp/tools.ts`) se ele lista os campos de `v2`; seed da referência é do controlador depois do deploy.
- **Cor:** sem token global novo. `--ok`/`--err` com os valores literais de `competitors/_sugestoes/sugestoes.css:10-23` (escuro e claro), declarados localmente em `.pm4`; sem `color-mix` (Opera); sombras e fundos em `rgba` literal.
- **Sucesso de Aplicar/Voltar = `resultado === 'feito'`** (Y1/H1): `precisa_confirmar` também é `ok: true` (`lib/youtube/ab-acao-saida.ts:19-20`).
- **Commits:** `tipo: descrição` em português + `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`; sem `--no-verify`; hook falhou ⇒ commit novo, nunca `--amend`.

## Conferências (T0; o executor refaz e para se mudou)

- **K1.** `grep -n "export function lerResultadoV2\|export function estadoV2DoTeste\|export function pisos\|export function tetoDoTesteV2\|export function encerradoEmDia" $W/src/lib/youtube/ab-types.ts $W/src/lib/youtube/ab-gravacao/decisao-v2.ts` ⇒ 5 linhas, assinaturas como no Mapa.
- **K2.** `grep -n "case 'reverter'\|case 'aplicar_sugerido'" $W/src/lib/youtube/ab-settle.ts` ⇒ `reverter` com `extra: {}` (não mexe em `winner_variant_id`) e `gravarResultado` zerando `winner_applied_at` e `revert_expires_at` quando a volta deu certo (`ab-settle.ts:463-464`). É por isso que "desfeita" se lê de `winner_applied_at === null` (D-T12-4).
- **K3.** `grep -n "completed_reason !== 'regra_v2'" "$W/src/app/cms/(authed)/youtube/ab-lab/actions.ts"` ⇒ a guarda de `aplicarSugerido` (`:1247`) devolve `ja_encerrado` para sugerido diferente, já aplicado ou não `regra_v2`. `aplicarSugerido` **não tem** `forcar` hoje (`actions.ts:1230`); a T7 acrescenta (Y2). `grep -n "forcar" "$W/src/app/cms/(authed)/youtube/ab-lab/actions.ts"` ⇒ só `pauseAbTest` (`:748`) e `endAbTest` (`:836`) antes da T7.
- **K4.** `grep -rn "InfoDica" "$W/src/app/cms/(authed)/youtube"` ⇒ consumidores: `_proprio/{reguas,trocas,video-blocos}.tsx`, `_chrome/comentarios/secao.tsx` (e a própria). `grep -rn "canal-tip\|vb-info" ... --include=*.css` ⇒ `canal.css:130-134`, `video-blocos.css:20-22`. Outro arquivo que use `vb-info`/`vb-info-p`: parar e reportar.
- **K5.** `sed -n 7,35p $W/src/app/cms/(authed)/youtube/competitors/_chrome/chrome.css` contém só os dois blocos de tokens `[data-obs]{…}` e `[data-theme="light"] [data-obs]{…}` (custom properties + `color-scheme`). Se tiver outra regra, a T2 move só as declarações de token.
- **K6.** `grep -rln "Como ler o placar\|Como ler o andamento" $W/test` ⇒ hoje `test/youtube/ab-s8-f3-tela.test.tsx`. Os testes que afirmam o balão em fluxo mudam na T3, no mesmo commit.
- **K7 (produção, controlador; H6).** `select count(*) from ab_tests where regra_duracao='v2';` roda no T0 **e de novo antes do push**: desde 25/10 13:00 UTC todo teste novo nasce v2 (ACOMPANHAMENTO l.171), então "0" pode já ser falso. Se houver teste v2, o controlador grava no ACOMPANHAMENTO "tela v2 em produção até <início + 10 dias>" (folga de 1-2 dias sobre os ~11-12 do desfecho) e o id vira o dado real do Gio.
- **K8.** `grep -n "'active'" $W/src/lib/youtube/ab-gravacao/decisao-v2-step.ts` ⇒ `:120` carrega só `status = 'active'` para avaliar; teste pausado não é avaliado nem encerrado pela regra e o relógio dele para em `paused_at` (`atribuicao.ts:43-56`). É a base do ◆T 4.

## Decisões do plano (a revisão pode recusar)

- **D-T12-1. Lugar compartilhado do ⓘ.** `InfoDica` sai de `competitors/_proprio/info-dica.tsx` para **`apps/web/src/app/cms/(authed)/youtube/_components/info-dica.tsx`** (pasta que já guarda peças comuns do YouTube, ex. `yt-portal`), com **`info-dica.css`** ao lado. O `Popover` fica onde está (`competitors/_chrome/flut/`) e é importado de lá (é cliente, sem `next/link`). Os tokens que o `#flut[data-obs]` herda saem de `chrome.css:7-35` para **`competitors/_chrome/tokens-obs.css`** (movidos, não copiados); `competitors/layout.tsx` importa `tokens-obs.css` antes de `chrome.css`; `info-dica.css` faz o mesmo `import` em JS no componente: `tokens-obs.css`, `camadas.css`, `flut/flut.css`. As regras do botão (`.vb-info` de `video-blocos.css:20-21`) e do corpo (`#flut .canal-tip .vb-info-p`, `:22`) **mudam-se** para `info-dica.css` com as classes `.dica-i` e `.dica-p`; as da caixa `#flut .obs-fl-pop.canal-tip` e `#flut .canal-tip h3` (`canal.css:130-131`) também se mudam, e `canal-header.tsx` e `proprio-header.tsx` (que usam `canal-tip`) passam a importar `info-dica.css`. Resultado: uma cópia de cada regra.
- **D-T12-2. Onde a tela v2 entra.** Ativo/pausado v2 ⇒ `ActiveDetail` (nunca `EarlyDetail`: `renderView` testa `view.v2?.fase === 'ativo'` antes de `isEarly`). Concluído v2 "da regra" (`completed_reason = 'regra_v2'`, ou `manual_winner` com `v2.encerrado_em_dia`) ⇒ componente novo `ConcluidoV2Detail`. Concluído v2 encerrado à mão no ativo (`manual_archive`, ou `manual_winner` sem `encerrado_em_dia`) segue em `WinnerDetail`/`PlayoffDetail` como hoje (não tem desfecho; Phil: fica fora da decisão).
- **D-T12-3. Placar M4 no v2.** `PlacarDoTeste` ganha `modoV2?: boolean`: com ele, não desenha a frase `pm4-sum` nem a seção "Andamento do teste" (o resumo e o andamento v2 vêm antes do placar, como no mockup). Tabela, faixa de dias e ⓘ do placar não mudam. Texto do ⓘ do placar: o de produção (o README do M5 diz "o M4 não muda").
- **D-T12-4. No ar agora (Y3, Y5, P3).** `noAr` = `aplicada` quando `winner_variant_id ≠ null`, `winner_variant_id ≠ original` e `winner_applied_at ≠ null`; `aplicada.desfechoMudou = (winner_variant_id ≠ v2.vencedor_sugerido)` (sugerido nulo ou outro). Sem `winner_variant_id`, ou `winner_variant_id` = a original: `noAr.original` (Y5: `aplicarSugerido` com a original grava `winner_variant_id` = original sem `applied_at`, `actions.ts:1270-1271`; não é "desfeita"). **Desfeita** = `completed_reason = 'manual_winner'`, `winner_variant_id` ≠ original, `winner_applied_at = null` **e todo campo de `camposDoTeste(test_type)` em `restore_status` com `estado === 'ok'`** (só o `reverter` com `tudoOk` zera `applied_at` deixando tudo `ok`, `ab-settle.ts:463-464`). Qualquer outro caso com `winner_variant_id ≠ null` e `applied_at = null` (`em_andamento`, `pulado_drift`, `pulado_sem_original`, `falhou`, `desistiu`) = `noAr.desconhecido` (P3: `camposPendentes`, `ab-restore.ts:176-186`, ignora vários estados e o Aplicar sem `tudoOk` deixa `applied_at` nulo, `ab-settle.ts:466-470`). `desconhecido` ⇒ a linha "No ar agora" não aparece (a faixa de restauração existente explica; nunca afirmar o que está no ar sem saber). O estado "aplicou à mão" (`NoArV2.manual`) **sai**: em teste concluído v2 o único escritor de `manual_winner` é `aplicarSugerido`, que exige `varianteId === vencedor_sugerido` (`actions.ts:1247`); o `aplicado-outra` do mockup vira "aplicada, desfecho mudou" (dono avisado).
- **D-T12-5. Botões do concluído (Y2, Y3, Y8).** **Aplicar {X} ao vídeo**: `desfecho = 'vencedor_provavel'`, sugerido ≠ original, `completed_reason = 'regra_v2'`, `winner_variant_id = null`. **Voltar à original**: `noAr.aplicada` (inclui `desfechoMudou`) e janela de reversão aberta (`revert_expires_at > agora`, regra de `reversaoAberta`, `ab-settle.ts:245-246`); fora da janela, sem botão. Aba aberta que passa dos 7 dias: no clique, `Date.parse(revert_expires_at) <= Date.now()` ⇒ ◆T 14 sem chamar a action (Y8). Sem permissão de admin: `AdminOnlyNote` no lugar do botão (padrão de `winner-detail.tsx:13,25`, `useCanAdminSite()`; sem prop `podeAdministrar`).
- **D-T12-5b. `forcar` no Aplicar (dono 25/10 ~11:10, "corrigir agora"; Y2).** `aplicarSugerido(testId, varianteId, seqVisto, forcar?: boolean)` repassa `...(forcar === true ? { forcar: true } : {})` ao `settleOnAir` (mesmo padrão de `pauseAbTest`, `actions.ts:757`); o ramo da original (`:1252-1271`) não usa. `AbConfirmarTrocaDialog` ganha `rotuloConfirmar?: string` (hoje o botão é fixo "… e encerrar", `ab-confirmar-troca-dialog.tsx:51-58`). Fluxo: `resultado === 'precisa_confirmar'` ⇒ abre o `AbConfirmarTrocaDialog` existente com `campos` e `opcao` da variante, `rotuloConfirmar` ◆T 9; confirmar ⇒ 2ª chamada com `forcar: true`. O passo 0b devolve `precisa_confirmar` **antes** de qualquer escrita (`ab-settle.ts:566-578`), então "nada foi aplicado" é verdade nesse retorno. Hanna H2 (beco sem saída, `forcar` no backlog) fica superada: sem item de backlog.
- **D-T12-6. Volume nulo nunca é 0 (P1: régua do concluído cortada).** Linha de piso com `dias_validos = null` quando a variante não tem nenhuma linha em `ab_test_dias`; `volume = null` vem de `pisos()` (zero dia válido). Os dois ⇒ "—" + "não medido". `v2` ausente ou sem linha ⇒ estado "antes dos pisos".
- **D-T12-7. Frase com V = 3.** Listas de letras com vírgula e "e" ("A, B e C"; "A tem 412, B tem 388 e C tem 401"). A variante citada em "Faltou volume: {X} teve…" é a de menor volume (empate: menor letra); em "Faltaram dias medidos: {X} tem…", a de menos dias válidos.
- **D-T12-8. Régua e frases do concluído só com dias `<= encerrado_em_dia` (P1).** O desfecho foi calculado só com esses dias (`decisao-v2-step.ts:300-301`, `desfechoProvisorio` filtra `day_pt <= encerradoEmDia`, `decisao-v2.ts:357`), mas `lerDiasDoTeste` também devolve o dia de `completed_at` (parcial). Na T4: `const ate = enc ? dias.filter(d => d.day_pt <= enc) : dias` para `pisos()` da régua, para {v}/{d} das frases e para `ctrDosValidos`. O ativo usa todas as linhas.
- **D-T12-9. CTR da frase do vencedor vem de `ctrDosValidos` (P2).** Nova função exportada de `decisao-v2.ts`, extraída do `total` de `estatisticaV2` (`:216-226`; `estatisticaV2` passa a chamá-la): `ctrDosValidos(dias, variantes): Record<string, { ctr: number | null; lift: number | null }>` = cliques/impressões dos dias válidos, e `lift = ctrV/ctrO − 1` (mesma conta de `decisao-v2.ts:259`, aritmética, sem estatística). Sai `ctrPorVariante` da `EntradaTelaV2`. **A frase usa esse `lift`, não o gravado** (o gravado só é regravado quando o desfecho muda, `decisao-v2-step.ts:321-322`, e fica velho no provisório; r2.1 Phil N1); o gravado serve só ao teste de paridade no encerramento: `ctrX/ctrA − 1` a 1 casa = lift gravado em 3 fixtures de concluído final. Placar M4 e frase do vencedor podem mostrar CTR diferente (o placar soma todos os dias); a frase não cita o placar.
- **D-T12-10. Sinal e "conta ainda não rodou" (P4).** `'vencedor_sugerido' in v2` decide (a decisão só grava a chave quando os pisos fecham na avaliação, `decisao-v2-step.ts:249-252`; o schema é `nullish`, `ab-types.ts:242`, então `lerResultadoV2` precisa preservar a diferença ausente x nula: a T4 confere e, se o parse apaga a chave, lê a chave do `result_metadata` cru). Pisos fechados na tela + chave ausente ⇒ ◆T 11, sem sinal.
- **D-T12-11. Ativo que não encerra (P5).** `dia > teto` ⇒ "Dia {X} · passou do fim ({T})" (nunca "faltam -2 dias") + ◆T 12. Ativo com `lerResultadoV2` `ilegivel` ⇒ selo ⚠ "Não consegui ler" + ◆T 13 (a decisão pula o teste para sempre, `decisao-v2-step.ts:187`). Pausado: o relógio não avança (K8) e a regra não avalia: ◆T 4.
- **D-T12-12. Prazo do provisório vencido (P6).** `provisorio === true` e `hoje(PT) > provisorioAte(enc)` ⇒ `prazo = { tipo: 'provisorio', ate: null }` (texto "Provisório: pode mudar nos próximos dias.", já existe); o reserva só grava em enc+13 (`decisao-v2-step.ts:329`).
- **D-T12-13. Casca `.etd` única (Y7).** Extrair `CascaEtd({ titulo, children, rodape, onVoltar })` de `ab-confirmar-troca-dialog.tsx:58-118`; `AbConfirmarTrocaDialog` e o `AbConfirmarDialog` novo a usam (sem terceira cópia).

### ◆T final: textos fora do mockup (Logan + Naksu, 25/10; portão encerrado, H4)

Regra de junção: texto do Logan quando diverge da Naksu; ajuste de cabimento a 390 e lacunas 1a/5a/6a da Naksu entram. Cabimento: frase 18 px/1,35 e sub 13 px; a mais longa (~56 caracteres) quebra em 2 linhas, permitido (`.sum` com `max-width:72ch`, sem `nowrap`); nenhum selo novo; "⏸ pausado" cabe na `.falta`. `{N}` com `toLocaleString('pt-BR')`; V = 3 lista "A tem 3, B tem 2 e C tem 4"; variante sem linha: "B ainda não tem dia medido" (nunca "tem 0").

| # | Estado | Texto final |
|---|---|---|
| 1 | Ativo, dias abertos, volume fechado | **Ainda não decide: faltam dias válidos.** / Cada versão precisa de 4; A tem 3 e B tem 2. |
| 1a | Ativo, dias **e** volume abertos (lacuna) | **Ainda não decide: faltam dias válidos e impressões.** / Cada versão precisa de 4 dias e {N} impressões; A tem 3 dias e 412, B tem 2 e 388. |
| 2 e 3 | Ativo, pisos fechados, sugerido nulo **ou** = original (chave presente) | **Os pisos fecharam; nenhuma versão está à frente da original.** / O teste segue até o fim para o resultado valer. Sem linha de sinal, sem botão. |
| 4 | Ativo **pausado** | Andamento: "Dia {X} de {T}" + **⏸ pausado** no lugar de "faltam N dias". Frase de volume faltando: **Faltam impressões; o teste está pausado.** / Cada versão precisa de {N}; A tem {a} e B tem {b}. (nunca a frase do teto "encerra amanhã"). ⓘ do Andamento pausado omite "e encerra sozinho no dia {T}". Resposta do código (K8): o relógio para em `paused_at` e a regra não avalia teste pausado, então "Dia X de T" fica parado e o teto não vale pausado. |
| 5 | `v2.n = null` com dias | Linha: "Impressões **412** de —" + **piso não calculado** (não "não medido"; barra só trilho, sem ✓; `aria-label` "Impressões 412; piso não calculado"). Resumo (5a): **Ainda não decide: falta calcular quantas impressões cada versão precisa.** / A conta roda uma vez por dia. Nunca "Cada versão precisa de —". Resposta do código: `n` é nulo antes da 1ª avaliação ou sem leitura do vídeo (`decisao-v2-step.ts:205-232`); "não medido" fica só para dado da variante. |
| 6 | Vencedor, CTR/lift nulo | Os dois: CTR ≈ {ctrX}% contra {ctrA}% de A ({lift}% vs A). Lift nulo: **CTR ≈ 5,4% contra 4,6% de A.** CTR nulo, lift presente: **B está +17,4% acima de A no CTR.** Ambos nulos (6a): sem linha de apoio. Resposta do código: `vencedor_provavel` exige estatística calculada (CTR e lift saem dos mesmos totais, `decisao-v2.ts:216-259`), então os nulos são defensivos (teste por caso), nunca o caminho normal. |
| 7 | Aplicada e desfecho mudou (Y3) | **Agora {estado}; ao encerrar, {X} parecia melhor.** com: sem diferença "não há diferença clara" (mockup); volume "faltou volume para decidir"; dado "faltam dias medidos"; aguardando "o YouTube ainda não enviou o alcance"; pendente "o desfecho está sendo recalculado"; falha "o teste consta como encerrado por segurança". Ilegível: mantém o texto próprio, sem "parecia melhor". |
| 7b | Aplicada B e o sugerido passou a C (Y3) | **Agora {C} parece melhor; ao encerrar, {B} parecia melhor.** (texto do Yannis; Logan confere na revisão final.) Linha "No ar agora: {B}." e "Voltar à original" como no `sem_diferenca`. |
| 8 | `ja_encerrado` / `mudou` / `em_andamento` / `erro` / `sem_permissao` | `ja_encerrado`: `.etd-msg err` **O teste mudou desde que você abriu a página.** Recarregue para ver o estado atual. + botão seguro **Recarregar** (`router.refresh()` e fecha); exceção: se `error === MSG_OUTRO_TESTE` (`traduzirSaida` mapeia `outro_teste` para `ja_encerrado`, `ab-acao-saida.ts:40`), mostra o `error` da action. `mudou` ⇒ `MSG_MUDOU`; `em_andamento` ⇒ `MSG_EM_ANDAMENTO`; `erro`/`sem_permissao` ⇒ o `error` da action. Sem "nada foi alterado" (não confirmado). |
| 9 | `precisa_confirmar` de Aplicar (**superado por Y2**) | Não há mais `.etd-msg warn`: abre o `AbConfirmarTrocaDialog` existente (valor atual no YouTube, Voltar com foco inicial) com `rotuloConfirmar` **Aplicar {X} mesmo assim**; a 2ª chamada vai com `forcar: true`. Único texto novo (3 palavras): Logan confere na revisão final. |
| 10 | ⓘ dos pisos (H3: substitui o do mockup) | Terceira frase: **Dias e impressões são somados dos dias válidos do placar; o piso vem da avaliação diária. “—” é não medido, não zero.** Vale para "Como ler os pisos" e "Como ler a régua final". O controlador avisa o dono em 1 linha: frase do mockup aprovado muda por honestidade (a tela não lê `ultima_avaliacao`). |
| 11 | Ativo, pisos fechados na tela, chave `vencedor_sugerido` ausente (P4) | **Os pisos fecharam; a conta de hoje ainda não rodou.** / Volte amanhã. Sem sinal. |
| 12 | Ativo com `dia > teto` (P5) | Andamento "Dia {X} · passou do fim ({T})"; resumo: **O encerramento atrasou; a regra tenta de novo no próximo cron.** (texto do Phil; Logan confere na revisão final.) |
| 13 | Ativo com `v2` ilegível (P5) | Selo ⚠ **Não consegui ler**; resumo: **Não consegui ler a avaliação; este teste não encerra sozinho.** (texto do Phil; idem.) |
| 14 | Voltar com janela vencida na aba (Y8) | `.etd-msg err` **O prazo de 7 dias para voltar acabou.** Sem chamar a action; botão seguro "Fechar". (texto do Yannis; idem.) |
| 15 | Provisório com data vencida (P6) | Texto existente "Provisório: pode mudar nos próximos dias." |

Os textos 7b, 9, 12, 13 e 14 vieram dos revisores, não de Logan/Naksu: o Logan os confere uma vez no portão final (junto de Phil e Yannis), sem bloquear a implementação.

- **◆D1 (registro, não pergunta).** No estado `concluido-inconclusivo-dado` do mockup, B mostra "—" com 2 dias válidos. `pisos()` soma as impressões dos dias válidos, então com 2 dias a tela mostra o número real. O Gio valida contra `pisos()`, não contra o desenho. Idem a fixture `ativo-sem-volume`: se ela tiver < 4 dias válidos por variante, a frase certa é a 1a, não a do mockup (o executor confere a fixture).

## Mapa de arquivos

`Y` = `apps/web/src/app/cms/(authed)/youtube/`, `C` = `Y/ab-lab/_components/`, `G` = `apps/web/src/lib/youtube/ab-gravacao/`, `T` = `apps/web/test/youtube/`.

| Arquivo | Tarefa | Papel |
|---|---|---|
| `G/decisao-v2.ts` | T1, T4, T5 | `provisorioAte(enc)` (T1); `ctrDosValidos` extraído de `estatisticaV2` (T4); `diasDaDecisao(linhas, ciclos, V)` (T5, Y4) |
| `G/decisao-v2-step.ts` | T5 | `:201-204` passa a chamar `diasDaDecisao` |
| `apps/web/src/lib/pipeline/services/youtube.ts` (`projecaoV2`, ~1110) + docs do Cowork | T1 | campo `provisorio_ate` |
| `Y/_components/info-dica.tsx`, `Y/_components/info-dica.css` (novos, movidos) | T2 | ⓘ compartilhado |
| `Y/competitors/_chrome/tokens-obs.css` (novo, movido de `chrome.css:7-35`), `competitors/layout.tsx`, `_canal/canal.css`, `_proprio/video-blocos.css`, `_canal/canal-header.tsx`, `_proprio/proprio-header.tsx`, os 4 consumidores de `InfoDica`, `competitors/_proprio/video-screen.tsx` (usa `canal-tip`) | T2 | mudança de lugar |
| `C/placar-do-teste.tsx` | T3, T6 | `Info` em fluxo ⇒ `InfoDica` (T3); prop `modoV2` (T6) |
| `G/tela-v2.ts` (novo) | T4 | `TelaV2`, `telaV2DoTeste`, frases |
| `apps/web/src/lib/youtube/ab-types.ts` | T5 | `AbTestResults.dias_decisao`, `AbTestBaseView.v2` |
| `Y/ab-lab/queries.ts` | T5 | monta `dias_decisao` e `v2` |
| `C/blocos-v2.tsx` + `C/blocos-v2.css` (novos) | T6 | `ResumoV2`, `AndamentoV2`, `PisosV2`, `SinalV2`, `DesfechoV2` |
| `C/active-detail.tsx`, `C/detail-header.tsx` (só se faltar o texto de concluído), `Y/ab-lab/[testId]/page.tsx` | T6, T7 | ligação |
| `C/concluido-v2-detail.tsx`, `C/ab-confirmar-dialog.tsx` (novos; usam `CascaEtd`) | T7 | concluído v2, confirmação Aplicar/Voltar |
| `C/ab-end-test-dialog.tsx`, `C/acoes-de-saida.tsx` | T8 | aviso v2 no Encerrar |
| `Y/ab-lab/actions.ts` (`aplicarSugerido`), `C/ab-confirmar-troca-dialog.tsx` | T7 | `forcar?` e `rotuloConfirmar?` (Y2); `CascaEtd` extraída (Y7) |
| Testes: `G`→`apps/web/test/youtube/ab-gravacao/provisorio-ate.test.ts`, `T/info-dica-compartilhada.test.tsx`, `T/ab-s8-f4-placar-dica.test.tsx`, `apps/web/test/youtube/ab-gravacao/tela-v2.test.ts`, `T/ab-s8-f4-tela-v2-fonte.test.ts`, `T/ab-s8-f4-tela-v2-blocos.test.tsx`, `T/ab-s8-f4-tela-v2-concluido.test.tsx`, `T/ab-s8-f4-encerrar-v2.test.tsx`, `apps/web/test/youtube/ab-gravacao/ctr-dos-validos.test.ts`, teste de action `aplicarSugerido` com `forcar` | T1-T8 | |

## Ordem e custo (refeito por tarefa)

**Ordem de execução (H5):** T0 → **T8** → T1 → T2 → T4 → T5 → T6 → T7 → **T3** → T9. T8 (aviso no Encerrar, ≈8K) não depende de nada e protege dado desde hoje: todo teste novo é v2 em produção e um Encerrar à mão tira o teste da decisão sem aviso; se o push do dia permitir, sobe sozinho antes do resto. T3 (troca o ⓘ do placar M4 já em produção; decisão fechada) vai por último, fora do caminho crítico. Os ◆T já estão finais (H4): não há portão de texto.

| Tarefa | r1 | r2 | Motivo da mudança |
|---|---|---|---|
| T0 | 5 | 5 | K8 |
| T8 | 8 | 8 | |
| T1 | 12 | 12 | |
| T2 | 18 | 20 | Y6 (escopo da margem, `video-screen.tsx`) |
| T4 | 40 | 57 | P1 (2), P2 (4), P3 (2), P4 (2), P5 (4), P6 (1), Y3/Y5 (2) |
| T5 | 20 | 24 | Y4 `diasDaDecisao` + mexe no passo |
| T6 | 40 | 41 | P5 na tela; Y10 tira um ramo |
| T7 | 35 | 52 | Y2 `forcar` (action + diálogo + 2 testes ≈10), Y7 (3), Y8 (1), Y9 (2), H1 (1) |
| T3 | 15 | 15 | |
| T9 | 15 | 15 | |

**Total ≈ 249K** de execução (Sonnet; r1 = 208K). Fora: Logan+Naksu já feitos (◆T final); Gio no navegador ≈ 25K (reduzido, H7; **a confirmar**: ninguém estimou, o número fecha no despacho do Gio); Phil+Yannis no fim ≈ 50K; conferência dos 5 textos dos revisores (Logan) ≈ 3K. Total com portões ≈ 327K. Hanna H8: não cortar (cortar T1 quebra a paridade com o Cowork; T2/T3 reabrem decisão do dono; T7 tira o Aplicar do CA-4). Uma fatia só; prazo: no ar antes de o 1º teste v2 fechar os pisos (K7 e a data no ACOMPANHAMENTO, H6).

## Foco de revisão (o mockup implica, nenhum teste de tarefa cobre sozinho)

1. **Recarregar depois de aplicar.** "B está no ar" tem de sobreviver ao F5: vem do banco (`winner_variant_id` + `winner_applied_at`), nunca de estado do cliente. **Teste na T4** (entrada com `manual_winner` aplicado ⇒ `noAr` B; mesma entrada com `winner_applied_at = null` ⇒ desfeita).
2. **T9 mexe no desfecho depois do aplicar** (Yannis): `vencedor_sugerido` vira null e o desfecho vira `sem_diferenca_detectavel` com B no ar. Esperado: selo "Sem diferença", "B está no ar.", "Voltar à original", e nenhum "Aplicar". **Teste na T4** (estado `aplicado-mudou`).
3. **Sugerido = original no ATIVO** (sugerido provisório gravado pela T9): nenhuma linha "à frente", nenhum botão. **Teste na T4** (◆T 3).
4. **`v2` ilegível ou ausente em teste `regra_v2`**: selo ⚠ "Não consegui ler" / ◌ "Calculando", números do placar continuam, nenhum 0 e nenhum "sem vencedor". **Teste na T4 e na T7.**
5. **Duplo clique, aba velha e `precisa_confirmar` em Aplicar**: o botão fica desabilitado enquanto envia; `ja_encerrado` mostra ◆T 8, nunca sucesso; **sucesso só com `resultado === 'feito'`** (Y1/H1), nunca só `ok: true`. **Teste na T7** (action falsa: `ja_encerrado`; `{ok:true,resultado:'precisa_confirmar',campos:[…]}` ⇒ abre o diálogo de troca, `router.refresh` não chamado, nenhum "B está no ar"; depois `feito`; 2 cliques ⇒ 1 chamada).
6. **Régua do concluído = o que decidiu** (P1): linha de B em `enc+1` não entra em régua, frase nem CTR. **Teste na T4** (fixture `inconclusivo-dado` com 1 linha válida de B em `enc+1` ⇒ régua e frase dizem as duas "3"; volume igual ao de `desfechoProvisorio` com as mesmas linhas).
7. **Falhar em verde** (P3, P4, P5): `noAr` incerto vira `desconhecido`; chave `vencedor_sugerido` ausente não vira "ninguém à frente"; ativo que passou do teto ou ilegível não parece normal. **Testes na T4.**

---

### T0: conferências K1-K7

- [ ] Rodar K1-K6 e K8 e comparar; pedir K7 ao controlador (e de novo antes do push). Diferença: parar e reportar.

**Pronto quando** todas batem ou o controlador liberou por escrito.

### T1: `provisorioAte` e o campo no Cowork (Phil; ≈12K)

*P7 recusado em parte: `reguaV2`/`regua` na projeção do Cowork fica como FU (ver tabela r2); aqui só `provisorio_ate`.*

**Files:** Modify `G/decisao-v2.ts` (ao lado de `encerradoEmDia`, `:369`), `apps/web/src/lib/pipeline/services/youtube.ts` (`projecaoV2`), `apps/web/data/pipeline-docs/cowork-docs-youtube.md`, `docs/cowork-pipeline-reference.md`; Test `apps/web/test/youtube/ab-gravacao/provisorio-ate.test.ts` e o teste existente de `projecaoV2` (`grep -ln projecaoV2\|relogio apps/web/test`).

**Interfaces — Produces:** `export function provisorioAte(enc: DiaPt): DiaPt` = `addDays(enc, 11)` (de `../coleta/day-pt`). Projeção: `provisorio_ate: v2?.provisorio === true && v2.encerrado_em_dia ? provisorioAte(v2.encerrado_em_dia) : null`.

- [ ] **Teste (FAIL):** `provisorioAte('2026-10-24') === '2026-11-04'` (o "04/11" do mockup); virada de mês e de ano (`'2026-12-25'` ⇒ `'2027-01-05'`); projeção com `provisorio: false` ⇒ `provisorio_ate: null`; sem `encerrado_em_dia` ⇒ `null`; com os dois ⇒ a data.
- [ ] Implementar; JSDoc cita a conta do Phil: o cron de enc+11 fecha o último dia no caso normal; o reserva (`> 12`, grava em enc+13) não muda a data mostrada.
- [ ] Docs do Cowork: `provisorio_ate` (dia PT `AAAA-MM-DD`, nulo quando final ou sem encerramento pela regra; "pode mudar até esta data").
- [ ] PASS (`/tmp/s8t12-t1.log`). Commit `feat: S8-F4 T12 data de provisório do desfecho v2`.

### T2: `InfoDica` num lugar compartilhado (D-T12-1; ≈18K)

**Files:** Create `Y/_components/info-dica.tsx` (conteúdo de `competitors/_proprio/info-dica.tsx`, que é apagado), `Y/_components/info-dica.css`, `Y/competitors/_chrome/tokens-obs.css`; Modify os 4 consumidores (import), `competitors/layout.tsx`, `_chrome/chrome.css` (tira l. 7-35), `_canal/canal.css` (tira 130-131), `_proprio/video-blocos.css` (tira 20-22), `_canal/canal-header.tsx`, `_proprio/proprio-header.tsx` **e `competitors/_proprio/video-screen.tsx` (`:128` usa `canal-tip` sem `InfoDica`, hoje herda de `canal.css`)** (importam `info-dica.css`); Test `T/info-dica-compartilhada.test.tsx`. Gio compara também a seção de comentários de um vídeo concorrente e o ⓘ do cabeçalho do vídeo próprio.

**Interfaces — Produces:** `export function InfoDica({ titulo, paragrafos, rotulo }: { titulo: string; paragrafos: readonly string[]; rotulo?: string })` (mesma assinatura). Botão `className="ibtn dica-i"`, parágrafo `className="dica-p"`. `info-dica.css` (valores de `video.css:24-27,48`, `video-blocos.css:20-22`, `canal.css:130-131`): `.dica-i` **só** 24×24, raio 50%, `color: var(--muted)` (hover `--text`), foco `2px solid var(--accent)` offset 2, `svg` 16; `@media (pointer:coarse)` 44×44. **A margem fica escopada como hoje (Y6; `.vb-info{margin:-6px 0}` é só `[data-obs-screen="video-proprio"]`, `video-blocos.css:20-21`):** `[data-obs-screen="video-proprio"] .dica-i{margin:-6px 0}` (coarse `-10px 0`) e, no A/B Lab, `.pm4 .dica-i` / `.pv2 .dica-i` na T3/T6; consumidores sem escopo (ex. `comentarios/secao.tsx`, tela `historico`) não ganham margem; `#flut .obs-fl-pop.canal-tip` 380 px, padding 12×14, 13 px, `max-height:min(70vh,560px)`; `#flut .canal-tip h3` 600 13,5 px; `#flut .canal-tip .dica-p` 13/19, `margin:4px 0 0`.

- [ ] **Teste (FAIL):** render de `InfoDica` fora de qualquer `[data-obs-screen]`: clique ⇒ `#flut` existe no `body` com `data-obs`, a caixa tem `obs-fl-pop canal-tip`, `h3` = título, `aria-expanded="true"`; Esc ⇒ fecha e o foco volta ao botão; segundo ⓘ aberto fecha o primeiro. Teste de import: `grep` em teste (`fs.readFileSync`) de que `chrome.css` não contém mais `--surface:` e `tokens-obs.css` contém os dois temas.
- [ ] Mover; rodar os testes de Observatório que tocam ⓘ (`npx vitest run test/youtube/observatorio > /tmp/s8t12-t2-obs.log 2>&1` em background, `FIM`).
- [ ] PASS. Commit `refactor: S8-F4 T12 ⓘ do Observatório num lugar compartilhado do YouTube`.

### T3: placar M4 em produção usa o `InfoDica` (r4/r5 do M5; ≈15K; **executa por último, antes da T9**, H5)

**Files:** Modify `C/placar-do-teste.tsx` (apaga `function Info`, `:47`; 5 usos ⇒ `InfoDica`), `C/placar-do-teste.css` (tira o CSS do balão em fluxo, se houver); Test `T/ab-s8-f4-placar-dica.test.tsx`, ajuste de `T/ab-s8-f3-tela.test.tsx` (K6).

Cada `<Info label="L"><b>Título.</b> resto</Info>` vira `<InfoDica rotulo="L" titulo="Título" paragrafos={['resto']} />` (título sem o ponto final, como o `info()` do mockup, `index.html:402`). Para o ⓘ do andamento, o parágrafo continua montado com o ramo `v1`/v2 de hoje.

- [ ] **Teste (FAIL):** com `PlacarDoTeste` montado, clicar "Como ler o placar" ⇒ caixa no `#flut` (não irmã do botão), `h3` "Como ler este placar"; o nó do placar não ganha filho novo (o ⓘ não muda o layout); Esc devolve o foco.
- [ ] PASS (+ `ab-s8-f3-tela*.test.tsx` verdes, `/tmp/s8t12-t3.log`). Commit `feat: S8-F4 T12 ⓘ do placar como popover do produto`.

### T4: modelo puro da tela v2 (≈57K)

**Files:** Create `G/tela-v2.ts`; Modify `G/decisao-v2.ts` (`ctrDosValidos`, P2); Test `apps/web/test/youtube/ab-gravacao/tela-v2.test.ts`, `apps/web/test/youtube/ab-gravacao/ctr-dos-validos.test.ts`.

**Interfaces — Produces:**
```ts
export function ctrDosValidos(dias: readonly DiaDaDecisao[], variantes: readonly string[]): Record<string, { ctr: number | null; lift: number | null }> // em decisao-v2.ts; estatisticaV2 passa a chamá-la
export interface VarianteDaTela { id: string; letra: DisplayLabel; titulo: string; is_original: boolean }
export interface LinhaPisoV2 { variant_id: string; letra: DisplayLabel; titulo: string; volume: number | null; dias_validos: number | null }
export type SeloV2 =
  | { tipo: 'vence'; provisorio: boolean; letra: DisplayLabel } | { tipo: 'original' } | { tipo: 'sem_diferenca' }
  | { tipo: 'volume' } | { tipo: 'dado' } | { tipo: 'falha' } | { tipo: 'aguardando' } | { tipo: 'pendente' } | { tipo: 'ilegivel' }
export type NoArV2 =                       // D-T12-4 (sem 'manual')
  | { tipo: 'original' } | { tipo: 'aplicada'; letra: DisplayLabel; desfechoMudou: boolean }
  | { tipo: 'desfeita'; letra: DisplayLabel } | { tipo: 'desconhecido' }
export type TelaV2 =
  | { fase: 'ativo'; dia: number; teto: number; pausado: boolean; passouDoFim: boolean; ilegivel: boolean
      frase: { principal: string; apoio: string }; n: number | null; pisos: LinhaPisoV2[]; sinal: DisplayLabel | null }
  | { fase: 'concluido'; selo: SeloV2; frase: { principal: string; apoio: string | null }
      prazo: { tipo: 'provisorio'; ate: string | null } | { tipo: 'final' } | null   // `ate` = 'DD/MM' ou null
      noAr: NoArV2; aplicar: { variant_id: string; letra: DisplayLabel } | null; voltar: boolean
      n: number | null; pisos: LinhaPisoV2[] | null; tentarDeNovo: boolean }
export interface EntradaTelaV2 {
  teste: { id: string; status: string; regra: 'v1' | 'v2'; config: unknown; paused_at: string | null; completed_at: string | null
    completed_reason: string | null; winner_variant_id: string | null; winner_applied_at: string | null
    revert_expires_at: string | null; restore_status: unknown; result_metadata: unknown; original_title: string | null; test_type: 'thumbnail' | 'title' | 'combo' }
  variantes: VarianteDaTela[]; ciclos: CicloComNumero[]; dias: DiaDaDecisao[]
  agora: Date                                  // sem ctrPorVariante (P2)
}
export function telaV2DoTeste(e: EntradaTelaV2): TelaV2 | null
```
Regras (fonte única; nada de estatística; **um teste por caso**):
- `null` quando `regra !== 'v2'`, status `draft`/`queued`, ou concluído fora de D-T12-2.
- **Ativo:** `teto = tetoDoTesteV2(config, variantes.length)`, `dia` de `estadoV2DoTeste(...)`; `lido = lerResultadoV2(result_metadata)`; `n = lido.ok ? v2.n ?? null : null`; `p = pisos(dias, ids, n ?? Infinity)` sobre **todas** as linhas. `ilegivel = lido.estado === 'ilegivel'` (P5): selo ⚠ e ◆T 13. **Precedência (r2.1 Phil N2): `ilegivel` vence `passouDoFim`** (a decisão pula o ilegível para sempre, `decisao-v2-step.ts:187`, então ◆T 12 "tenta de novo" seria falso). `passouDoFim = dia > teto` (P5): ◆T 12, nunca "faltam -N dias". `pausado = status === 'paused'`: frases de ◆T 4.
- **Sinal e chave (P4):** `sinal` = letra de `v2.vencedor_sugerido` só quando `p.piso_dias && p.piso_volume`, a chave está presente (`'vencedor_sugerido' in v2`), valor ≠ null e ≠ original. Pisos fechados + chave ausente ⇒ frase ◆T 11, sem sinal. Pisos fechados + chave presente nula ou = original ⇒ ◆T 2/3.
- **Concluído:** `ilegivel` ⇒ selo `ilegivel`, `tentarDeNovo: true`; `ausente` ou sem `desfecho` ⇒ `pendente`; desfecho ⇒ selo (`vencedor_provavel` + original ⇒ `original`). **`ate = enc ? dias.filter(d => d.day_pt <= enc) : dias` (D-T12-8, P1)** para `pisos()` (régua), {v}/{d} das frases e `ctrDosValidos` (D-T12-9, P2). `prazo`: só para vence/original/sem_diferenca/volume/dado; `provisorio === true` ⇒ `{ provisorio, ate }` com `ate` = DD/MM de `provisorioAte(enc)` **somente se `dayPt(agora) <= provisorioAte(enc)`**, senão `ate: null` (D-T12-12, P6); sem `encerrado_em_dia` ⇒ `ate: null`; `provisorio` não verdadeiro ⇒ `final`.
- **`noAr`/`aplicar`/`voltar`:** D-T12-4/5 (`voltar` usa `agora`; `desfeita` exige todo campo de `camposDoTeste(test_type)` em `restore_status` com `estado 'ok'`; winner = original ⇒ `original`; `aplicada.desfechoMudou` quando winner ≠ `vencedor_sugerido`).

Frases (copiar literal; CTR com 1 casa e vírgula, lift com sinal e 1 casa; os de ◆T estão na tabela final da seção Decisões e entram aqui com o texto dela):

| Estado | principal | apoio |
|---|---|---|
| ativo, nenhum dia/sem `v2` | Ainda não decide: o YouTube não fechou nenhum dia. | A primeira avaliação sai até 24 horas depois do início. |
| ativo, dias abertos, volume fechado | ◆T 1 | ◆T 1 |
| ativo, dias e volume abertos | ◆T 1a | ◆T 1a |
| ativo, falta volume, `dia < teto − 1` | Ainda não decide: faltam impressões. | Cada versão precisa de {N}; A tem {a} e B tem {b}. |
| ativo, falta volume, `dia ≥ teto − 1` | Faltam impressões; o teste encerra amanhã. | No dia {T} a original volta ao ar. Cada versão precisa de {N}; A tem {a} e B tem {b}. |
| ativo pausado, falta volume | ◆T 4 | ◆T 4 |
| ativo, `n` nulo | ◆T 5 (5a) | ◆T 5 (5a) |
| ativo, pisos fechados, sinal X | Há um sinal de {X}, mas ainda não decide. | Os pisos fecharam. O teste segue até o fim para o resultado valer. |
| ativo, pisos fechados, sem sinal | ◆T 2 e 3 | ◆T 2 e 3 |
| ativo, pisos fechados, chave ausente | ◆T 11 | ◆T 11 |
| ativo, `dia > teto` / ilegível | ◆T 12 / ◆T 13 | |
| linha de sinal (ativo) | **Sinal provisório, não decide:** {X} está um pouco à frente. | |
| vence provisório / final | {X} provavelmente vence. / {X} vence. | CTR ≈ {ctrX}% contra {ctrA}% de A ({lift}% vs A). (nulos: ◆T 6) |
| original | A original se saiu melhor; nada a aplicar. | A original segue no ar. |
| sem diferença | Sem diferença clara entre {A e B}. | A original segue no ar. / aplicada: ◆T 7 |
| volume | Faltou volume: {X} teve {v} de {N} impressões. | Este vídeo recebe poucas impressões para decidir. A original segue no ar. |
| dado | Faltaram dias medidos: {X} tem {d} de 4. | O YouTube não enviou o CTR de alguns dias. A original segue no ar. |
| falha | O teste foi encerrado por segurança, não por resultado. | A original voltou ao ar. |
| aguardando | O YouTube ainda não enviou o alcance dos últimos dias. | O desfecho pode mudar quando chegar. |
| pendente | Calculando o desfecho. | A conta roda uma vez por dia. Volte amanhã. |
| ilegível | Não consegui ler o desfecho deste teste. | Os números abaixo são os gravados. Nada foi alterado. |

D-T12-7 vale (V = 3; "Faltou volume" cita a variante de menor volume, empate menor letra; "Faltaram dias" a de menos dias válidos). Selos (texto e símbolo): `▲ {X} vence (provisório)` / `▲ {X} vence`, `◆ A original vence`, `= Sem diferença`, `◔ Faltou volume`, `∅ Dado não medido`, `✕ Encerrado por segurança`, `◷ Aguardando o YouTube`, `◌ Calculando`, `⚠ Não consegui ler`; desfeita acrescenta `◆ Aplicação de {X} desfeita`.

- [ ] **Testes (FAIL), um por estado do mockup** (os 22 de `ORDEM` menos início, carregando, erro e v1), com o texto exato: `ativo-antes-pisos` (sem linhas ⇒ `dias_validos` e `volume` null, nunca 0), `ativo-sem-volume` (412/388 de 10.315, `sinal` null), `ativo-sinal` (`sinal` 'B'), `ativo-teto-sem-volume` (dia 14 de 15), `concluido-vencedor-provisorio` (`ate` '04/11' com enc 24/10, `aplicar` B), `-vencedor-final` (`prazo.final`), `-aplicado` (`noAr` aplicada B `desfechoMudou: false`, `voltar` true dentro da janela e false com `revert_expires_at` passado), `-aplicado-mudou` (sugerido nulo ⇒ `desfechoMudou: true`, `voltar` true, `aplicar` null; Foco 2), `-aplicado-outra` (= aplicada B com sugerido C ⇒ `desfechoMudou: true`, texto ◆T 7b, `voltar` true, `aplicar` null; Y3), `-original-vence` (sem `aplicar`, sem lift na frase), `-sem-diferenca`, `-inconclusivo-volume`, `-inconclusivo-dado`, `-inconclusivo-falha` (sem `prazo`), `-aguardando`, `-pendente`, `-ilegivel` (`tentarDeNovo`).
- [ ] **Testes por caso das regras do Phil e do Yannis:** P1 (Foco 6); P2 (`ctrX/ctrA − 1` a 1 casa = lift gravado em 3 fixtures; `ctrDosValidos` bate com o `total` de `estatisticaV2`); P3 (`pulado_drift` ⇒ `desconhecido`; `em_andamento` ⇒ `desconhecido`; tudo `ok` ⇒ `desfeita`); P4 (v2 sem a chave + pisos fechados ⇒ ◆T 11, sem sinal; chave nula ⇒ ◆T 2); P5 (`dia = teto + 2` ⇒ `passouDoFim`, nunca "-2"; `lerResultadoV2` ilegível no ativo ⇒ `ilegivel`; **`dia = teto + 2` com v2 ilegível ⇒ ◆T 13, não 12**); P6 (`setSystemTime` em `enc + 12` ⇒ `ate: null`); Y3; Y5 (winner = original, `applied_at` nulo ⇒ `noAr.original`, nunca `desfeita`); Foco 1 (desfeita: mesma entrada com `winner_applied_at` nulo e tudo `ok`); Foco 3; V = 3 ("A, B e C"); ◆T 1a, 4 (pausado), 5/5a, 6 (3 casos nulos) e 7 (uma por desfecho); v1 ⇒ `null`; `manual_archive` v2 ⇒ `null`; restore pendente ⇒ `noAr.desconhecido`. Datas com `vi.setSystemTime` relativo a `encerrado_em_dia`.
- [ ] Teste de guarda: `fs.readFileSync('src/lib/youtube/ab-gravacao/tela-v2.ts')` não contém `estatisticaV2(`, `decidirV2(`, `desfechoProvisorio(`, `sugeridoV2(` nem `ultima_avaliacao`.
- [ ] PASS (`/tmp/s8t12-t4.log`). Commit `feat: S8-F4 T12 modelo da tela v2 (só leitura)`.

### T5: fonte da tela entrega `v2` (≈24K)

**Files:** Modify `G/decisao-v2.ts` (`diasDaDecisao`), `G/decisao-v2-step.ts` (`:201-204` chama `diasDaDecisao`), `apps/web/src/lib/youtube/ab-types.ts` (`AbTestResults.dias_decisao: DiaDaDecisao[]`; `AbTestBaseView.v2?: TelaV2 | null`), `Y/ab-lab/queries.ts` (`getTestResults` e `toDetailView`); Test `T/ab-s8-f4-tela-v2-fonte.test.ts` (node, `fake-postgrest.ts`).

**Interfaces — Consumes:** `telaV2DoTeste` (T4), `cicloDoDia`, `blocoDoDia` (`decisao-v2.ts:45,62`). **Produces:** `export function diasDaDecisao(linhas, ciclos: readonly CicloComNumero[], V: number): DiaDaDecisao[]` (Y4; mesma regra do passo, uma só cópia) e `view.v2`.

- [ ] **Y4:** extrair `diasDaDecisao` do mapeamento de `decisao-v2-step.ts:201-204` (`cicloDoDia` + `blocoDoDia`, `V` = nº de variantes) e fazer o passo e `getTestResults` chamarem a mesma função. Teste: mesma entrada ⇒ mesmo array; os testes do passo seguem verdes no mesmo commit.
- [ ] `getTestResults`: das linhas que `lerDiasDoTeste` já devolve, monta `dias_decisao` com `diasDaDecisao` (ciclos já lidos com `cycle_number`). Zero consulta nova (teste conta as consultas do `fake-postgrest` antes e depois: iguais).
- [ ] `toDetailView`: `base.v2 = telaV2DoTeste({...})` com `variantes` de `variantDb`/`toDisplayLabel`, `agora = new Date()`. Para v2 ativo, `dayOf`/`durationDays` do cabeçalho passam a `v2.dia`/`v2.teto`.
- [ ] **Testes (FAIL):** teste v2 ativo ⇒ `view.v2.fase === 'ativo'` e `dayOf` = relógio por dias fechados; v1 ⇒ `view.v2` null e `dayOf` como hoje; nº de consultas igual ao de antes.
- [ ] PASS (`/tmp/s8t12-t5.log`). Commit `feat: S8-F4 T12 fonte da tela monta o modelo v2`.

### T6: blocos do ativo e placar em modo v2 (≈41K)

**Files:** Create `C/blocos-v2.tsx`, `C/blocos-v2.css`; Modify `C/placar-do-teste.tsx` (`modoV2` só esconde `pm4-sum`; no v2 o `ActiveDetail` **não passa `andamento`**, que já é o interruptor da seção, `placar-do-teste.tsx:303`, Y10), `C/active-detail.tsx`, `Y/ab-lab/[testId]/page.tsx` (`renderView`, D-T12-2); Test `T/ab-s8-f4-tela-v2-blocos.test.tsx` (jsdom).

**Interfaces — Produces (arquivo `'use client'`, porque usa `InfoDica`):**
`ResumoV2({ frase })` · `AndamentoV2({ dia, teto, pausado })` · `PisosV2({ linhas, n, final }: { linhas: LinhaPisoV2[]; n: number | null; final: boolean })` · `SinalV2({ letra })` · `DesfechoV2(...)` (T7).

Estrutura e classes copiadas do mockup (`index.html`: `relogio` 538-544, `pisos` 545-558, `sinal` 559-562, CSS `.sum`, `.rel`, `.ticks`, `.pisos`, `.pr`, `.pbar`, `.pnum`, `.pdv`, `.okk`, `.sinal` do `<style>`), com prefixo `pv2-` para não colidir com o `pm4-`, tokens `--cn-*` do `.cn-raiz` no lugar dos do mockup, e `--ok`/`--err` locais (Restrições). Textos dos ⓘ (via `InfoDica`):
- Andamento: título "Andamento", parágrafo "Um quadrado por dia corrido; o contorno forte é hoje. O teste também exige um mínimo de dias corridos antes de decidir, e encerra sozinho no dia {T}. Isso não indica quem está na frente." (pausado: sem "e encerra sozinho no dia {T}", ◆T 4), rótulo "Como ler o andamento".
- Pisos: título "Pisos" (final: "Régua final"), parágrafo "O teste só decide se cada versão tiver pelo menos 4 dias válidos e {N} impressões nos dias válidos. **o texto do ◆T 10** (H3; não o do mockup): “Dias e impressões são somados dos dias válidos do placar; o piso vem da avaliação diária. “—” é não medido, não zero.”, rótulo "Como ler os pisos" / "Como ler a régua final". Cabeçalho "Falta para decidir" / "Quanto o teste alcançou".
- Andamento: "Dia {X} de {T}" + "faltam {f} dias" (`f = 1`: "faltam 1 dia", literal do mockup, `index.html:541`); `f = 0` ⇒ "último dia"; pausado ⇒ "⏸ pausado" (◆T 4); `dia > teto` ⇒ "Dia {X} · passou do fim ({T})" (◆T 12); ativo `ilegivel` ⇒ selo ⚠ (◆T 13). Ticks: `i+1 < dia` passado, `= dia` hoje.
- Pisos: linha "Impressões **{v}** de {N}" + "✓" quando `v ≥ N` (barra cheia `ok`, largura mínima 2% com `v > 0`); "Dias válidos **{d}** (mínimo 4) ✓" ou "Dias válidos **{d}** de 4"; null ⇒ "—" + "não medido"; `n` nulo ⇒ "Impressões **412** de —" + "piso não calculado" (◆T 5), barra só trilho.

`ActiveDetail` com `view.v2?.fase === 'ativo'`: entre o cabeçalho e o placar, `ResumoV2` → `AndamentoV2` → `PisosV2(final=false)` → `SinalV2` (se `sinal`); `PlacarDoTeste modoV2`; hero, `CredibleInterval` e afins continuam presos a `comEstatistica` (nunca verdadeiro aqui). Pausar/Encerrar ficam onde estão.

- [ ] **Testes (FAIL):** `ativo-sem-volume` ⇒ "412 de 10.315" e "388 de 10.315", nenhum `%` no bloco, nenhum botão com "Aplicar"; `ativo-antes-pisos` ⇒ 2× "não medido", nenhum "0" nos pisos; pausado ⇒ "⏸ pausado" e ⓘ sem "encerra sozinho"; `dia > teto` ⇒ "passou do fim", nunca "faltam -"; `n` nulo ⇒ "piso não calculado"; ativo ilegível ⇒ ⚠; `ativo-sinal` ⇒ texto da linha de sinal, sem cor `--ok` (classe neutra); `modoV2` ⇒ sem `.pm4-sum` e sem `[data-section="andamento"]` no placar; teste v1 ⇒ nenhum `pv2-`; ⓘ do Andamento abre no `#flut`.
- [ ] PASS (`/tmp/s8t12-t6.log`). Commit `feat: S8-F4 T12 andamento, pisos e sinal do teste v2 em andamento`.

### T7: concluído v2, Aplicar (com `forcar`) e Voltar à original (≈52K)

**Files:** Create `C/concluido-v2-detail.tsx`, `C/ab-confirmar-dialog.tsx`; Modify `Y/ab-lab/actions.ts` (`aplicarSugerido`: `forcar?`, Y2), `C/ab-confirmar-troca-dialog.tsx` (`rotuloConfirmar?`; extrai `CascaEtd`, Y7), `C/blocos-v2.tsx` (`DesfechoV2`), `C/blocos-v2.css`, `Y/ab-lab/[testId]/page.tsx` (rota do concluído e `.bind` das actions); Test `T/ab-s8-f4-tela-v2-concluido.test.tsx` (jsdom), teste de action de `aplicarSugerido` (padrão dos testes de `pauseAbTest`: `grep -rln pauseAbTest apps/web/test`), teste do `AbConfirmarTrocaDialog` existente (continua verde).

**Interfaces:**
- `aplicarSugerido(testId, varianteId, seqVisto, forcar?: boolean)` (D-T12-5b).
- `ConcluidoV2Detail({ view, aplicar, voltar }: { view: AbTestDetailView & { v2: Extract<TelaV2, { fase: 'concluido' }> }; aplicar: (varianteId: string, seqVisto: number, forcar?: boolean) => Promise<ResultadoAcaoSaida>; voltar: (seqVisto: number) => Promise<ResultadoAcaoSaida> })` — `page.tsx` passa `aplicarSugerido.bind(null, id)` e `revertWinner.bind(null, id)`. Ordem: `DetailHeader` (lab; selo "Teste do Lab concluído em {DD/MM}" — se `detail-header.tsx` não tiver esse texto, acrescentar) → `ResumoV2` → `DesfechoV2` → `PisosV2(final=true)` (se `pisos`) → `PlacarDoTeste modoV2`.
- `DesfechoV2({ tela, onAplicar, onVoltar })` (permissão por `useCanAdminSite()`, sem prop): selo `role="status"` (classes `vence`/`vence prov`/`neu`/`mut`/`nmf`/`esp`/`errf`/`fort` do mockup, `index.html:201-210`), linha de prazo ("Provisório até {DD/MM}: pode mudar nos próximos dias." com ícone de relógio; sem data: "Provisório: pode mudar nos próximos dias."; final: "■ Final: já não muda."), linha `.noar` (`tabIndex={-1}`; textos: "No ar agora: **A (original)**." / "**B** está no ar." / aplicada com `desfechoMudou`: "**B** está no ar." + apoio ◆T 7/7b / desfeita: "No ar agora: **A (original)**. B deixou de ser aplicada." / `desconhecido`: sem a linha), botão `Aplicar {X} ao vídeo` (primário) ou `Voltar à original` (nunca os dois), e `Tentar de novo` (`router.refresh()`) no ilegível.
- `AbConfirmarDialog({ titulo, lead, nota, rotuloConfirmar, enviando, erro, onVoltar, onConfirmar })` sobre `CascaEtd` (D-T12-13: `YtPortal`, `role="alertdialog"`, `.etd-ico.w`, `.etd-lead` + `.etd-tiny`, `.etd-btn.over` primeiro e "Voltar" depois, `useModalFocusTrap(ref, true, onVoltar, voltarRef)` com foco inicial em Voltar), CSS `ab-end-test-dialog.css` sem mudança. Textos: Aplicar ⇒ título "Aplicar {X} ao vídeo?", lead "A miniatura muda agora no YouTube.", nota "O desfecho ainda é provisório." (só se provisório), botão "Aplicar {X}"; Voltar ⇒ título "Voltar à original (A)?", lead "A miniatura volta a ser a de A agora no YouTube.", nota "O resultado do teste não muda e continua visível aqui.", botão "Sim, voltar à original".

**`opcao` (r2.1 Phil N4 / Yannis N2):** `TelaV2.aplicar` só tem `variant_id` e `letra`; a T7 monta a `opcao` do `AbConfirmarTrocaDialog` (rótulo, título, miniatura; `OpcaoDoDialogo`) a partir de `view.variants`, as mesmas variantes de `acoes-de-saida.tsx`. Teste de componente: o diálogo de troca mostra título e miniatura da variante.

**`enviando`/`erro` no `AbConfirmarTrocaDialog` (r2.1 Hanna N1):** hoje só tem `campos, opcao, onVoltar, onConfirmar` (`ab-confirmar-troca-dialog.tsx:13-21`); a T7 acrescenta `enviando?: boolean` (desabilita os botões) e `erro?: string` (mostra a ◆T 8 / mensagem do `error`). A 2ª chamada com `forcar` usa os dois.

Fluxo (H1/Y1: ramifica por `resultado`, padrão de `ab-end-test-dialog.tsx:184`): confirmar ⇒ `enviando` (botões desabilitados) ⇒ **`resultado === 'feito'`** ⇒ fecha, `startTransition(() => router.refresh())` e foco na `.noar` quando `isPending` passa de true para false, com o `useRef` de pendência (Y9); **`'precisa_confirmar'`** (só Aplicar) ⇒ fecha o diálogo de Aplicar e abre o `AbConfirmarTrocaDialog` com `campos`, `rotuloConfirmar` ◆T 9; confirmar ⇒ 2ª chamada `aplicar(id, seq, true)`, e o resultado dela segue este mesmo fluxo; `ok: false` ⇒ fica aberto com a mensagem da ◆T 8; Voltar com janela vencida na aba ⇒ ◆T 14 sem chamar a action (Y8); Esc/Voltar/fundo fecham e devolvem o foco ao gatilho.

- [ ] **Teste de action (FAIL):** `aplicarSugerido(..., forcar: true)` repassa `forcar: true` ao `settleOnAir` (porta falsa) e não devolve `precisa_confirmar`; sem `forcar`, o repasse não leva a chave; ramo da original ignora `forcar`.
- [ ] **Testes de componente (FAIL):** `concluido-vencedor-provisorio` ⇒ selo "B vence (provisório)" e "Provisório até 04/11: pode mudar nos próximos dias."; clique Aplicar ⇒ diálogo com foco em "Voltar"; confirmar com action `feito` ⇒ 1 chamada com (`idB`, `restoreSeq`), `router.refresh` chamado (dentro de `startTransition`) e foco na `.noar` ao fim (`useRouter` falso, Y9); 2 cliques rápidos ⇒ 1 chamada (Foco 5); action `ja_encerrado` ⇒ ◆T 8, nada de sucesso; **action `{ok:true,resultado:'precisa_confirmar',campos}` ⇒ abre o diálogo de troca com "Aplicar B mesmo assim", `router.refresh` não chamado, nenhum "B está no ar"; confirmar ⇒ 2ª chamada com `forcar: true`** (Y1/Y2/H1); `concluido-original-vence` ⇒ nenhum botão, nenhum `%`; `-aplicado` ⇒ "Voltar à original" e, confirmado, `voltar(restoreSeq)`; `-aplicado-outra`/`-mudou` ⇒ "Voltar à original", nunca "Aplicar", apoio ◆T 7/7b; janela vencida na aba ⇒ ◆T 14 e 0 chamadas; `noAr.desconhecido` ⇒ sem linha "No ar agora"; `-ilegivel` ⇒ "Tentar de novo"; sem admin ⇒ sem botão, com `AdminOnlyNote`; Esc fecha e devolve o foco.
- [ ] **Testes r2.1 (FAIL):** 2ª chamada `aplicar(..., true)` devolvendo `ja_encerrado` ⇒ ◆T 8 no diálogo de troca, botão volta a habilitar, nenhum sucesso; 2 cliques no "mesmo assim" ⇒ 1 chamada com `forcar`; concluído v2 com `pulado_drift` (`noAr.desconhecido`) ⇒ a faixa de restauração existente aparece na rota (Phil N5); título e miniatura da `opcao` no diálogo de troca.
- [ ] PASS (`/tmp/s8t12-t7.log`). Commit `feat: S8-F4 T12 desfecho do teste v2 com aplicar (forcar) e voltar à original`.

### T8: aviso no Encerrar do teste v2 (≈8K; **executa logo depois da T0**, H5)

**Files:** Modify `C/ab-end-test-dialog.tsx` (prop `regraV2?: boolean` em `AbEndTestDialogProps`, passada a `Escolha`), `C/acoes-de-saida.tsx` (`regraV2={view.placar?.regra === 'v2'}`); Test `T/ab-s8-f4-encerrar-v2.test.tsx` (jsdom).

- [ ] **Teste (FAIL):** com `regraV2`, a fase `escolha` mostra `.etd-msg.warn` "Encerrar à mão tira o teste da decisão: o resultado não será calculado." antes do rodapé; sem a prop (v1), não mostra; o restante do diálogo (opções, "Encerrar e ficar com …", "Cancelar") igual (`T/ab-end-test-dialog.test.tsx` verde).
- [ ] PASS (`/tmp/s8t12-t8.log`). Commit `feat: S8-F4 T12 encerrar à mão avisa que tira o teste v2 da decisão`.

### T9: fecho (≈15K)

- [ ] Suíte do A/B e do Observatório em background: `cd $W && npx vitest run test/ab- test/youtube > /tmp/s8t12-suite.log 2>&1; echo FIM >> /tmp/s8t12-suite.log`; no contexto, só falhas.
- [ ] `npm run build:web > /tmp/s8t12-build.log 2>&1` em background (mudança de UI com CSS movido: arriscada pela regra do CLAUDE.md); `tail` no fim.
- [ ] `docs/ab-testing-system-reference.md`: seção curta "Tela v2" (fontes de cada bloco, D-T12-4/5).
- [ ] Commit `docs: S8-F4 T12 referência da tela v2`.

## Validação (portões, controlador)

- **Gio (navegador, Sonnet; H7):** semente local; **captura completa (1440/390, claro/escuro) só em 5 estados**: `ativo-sem-volume`, `ativo-sinal`, `concluido-vencedor-provisorio` (com Aplicar até o fim, inclusive o caminho `precisa_confirmar` ⇒ diálogo de troca), `concluido-inconclusivo-volume`, `concluido-aplicado` (Voltar). O resto dos 22 estados já tem teste de texto exato (T4/T6/T7) e de componente: Gio só 390 claro, uma captura. Critérios: os do README do M5 ("Como testar" 1-5), C-17 (início com aviso inalterado), 390 px sem rolagem horizontal, ⓘ de 24 px (44 no toque) com popover no `#flut` e altura da página igual aberto/fechado, diálogos com foco inicial certo e Esc, selo legível em escala de cinza, Opera (sem `color-mix`), e o Observatório: ⓘ da tela do vídeo e do canal iguais a antes (T2), mais a seção de comentários de um vídeo concorrente e o ⓘ do cabeçalho do vídeo próprio (Y6). Capturas em arquivo.
- **Phil e Yannis** no fim (Opus na 1ª revisão), com este plano e o diff; **Logan** confere uma vez os 5 textos de revisor (◆T 7b, 9, 12, 13, 14).

## SQL de leitura (produção, controlador)

```sql
-- K7 e escolha do teste para o Gio com dado real
select id, status, completed_reason, winner_variant_id, winner_applied_at,
       result_metadata->'v2'->>'desfecho' as desfecho, result_metadata->'v2'->>'provisorio' as prov,
       result_metadata->'v2'->>'encerrado_em_dia' as enc
from ab_tests where regra_duracao = 'v2' order by created_at desc limit 20;
```

## Aceite (H: quem, onde, quando)

- **CA-T12-1 (Gio, local, antes do push):** `ativo-sem-volume` mostra "412 de 10.315" e "388 de 10.315", nenhum `%`, nenhum botão "Aplicar"; `ativo-antes-pisos` mostra 2× "não medido" e nenhum "0" nos pisos.
- **CA-T12-2 (Gio, local):** `concluido-vencedor-provisorio` ⇒ "Provisório até 04/11…"; Aplicar → confirmar → após o refresh "B está no ar." e "Voltar à original"; F5 mantém. Com a action respondendo `precisa_confirmar`, abre o diálogo de troca e só um segundo "Aplicar B mesmo assim" aplica; com `ja_encerrado`, a tela NUNCA diz que aplicou.
- **CA-T12-3 (Gio, local):** Encerrar num teste v2 mostra "Encerrar à mão tira o teste da decisão…"; num v1, não.
- **CA-T12-4 (Gio, local):** ⓘ do vídeo e do canal no Observatório iguais às capturas de antes; ⓘ do placar abre no `#flut` sem mudar a altura da página; 390 px sem rolagem horizontal.
- **CA-T12-5 (controlador, produção, no 1º desfecho v2):** `provisorio_ate` do `get_test` no Cowork = "Provisório até DD/MM" da tela; mesmo desfecho e mesma variante sugerida (CA-4 do pai, l.494), com data no ACOMPANHAMENTO (K7).
- Com um teste v2 concluído por volume: "Faltou volume: …" com N e impressões reais **dos dias que decidiram** (P1), "A original segue no ar.", sem lift e sem botão. Nenhum campo ausente como 0.

## Riscos

- **CSS movido do Observatório (T2):** regressão visual no ⓘ do vídeo e do canal. Mitigação: Gio compara com as capturas de antes; teste de leitura de CSS na T2.
- **`#flut` no A/B Lab** herda `--surface`, `--border-strong`, `--shadow` de `[data-obs]`: os tokens são os do Observatório, não os `--cn-*` do placar; a cor do popover pode diferir ~1 tom do resto da tela. Aceito (padrão do produto, r5 do M5); Naksu mede.
- **Restore parcial depois de Aplicar:** a linha "No ar agora" some (`noAr.desconhecido`, D-T12-4) e a faixa de restauração existente assume; se a faixa não aparecer na rota do concluído v2, o dono fica sem a informação. A T7 inclui a `AvisoDePagina`/faixa que o `page.tsx` já monta (conferir).
- **Textos de revisor (◆T 7b, 9, 12, 13, 14)** ainda sem o aval do Logan: não bloqueiam; se ele mudar uma frase, é troca de string + teste.
- **Mudar `aplicarSugerido` (Y2)** toca uma action de produção: o teste de action e o ramo da original (que ignora `forcar`) são a rede; `forcar` só é enviado depois de o dono ver o valor atual no diálogo de troca.
- **`lerResultadoV2` e a chave ausente (D-T12-10):** se o parse não preservar ausente x nula, o P4 depende de ler o `result_metadata` cru; a T4 confere antes.
- **0 testes v2 hoje:** tudo se prova por semente; o 1º dado real chega no ~D+12 do 1º teste (prazo da fatia).

## Cobertura (autoconferência)

| Pedido (brief, README M5, respostas) | Tarefa |
|---|---|
| Só lê `v2`; pisos sobre as linhas já lidas | T4 (guarda), T5 (consultas iguais) |
| "No ar agora" de `winner_variant_id`; "A original vence" | T4, D-T12-4 |
| Ativo sem aplicar, sem lift, sem aviso de volume; barra "X de N" | T4, T6 |
| Encerrar avisa "tira o teste da decisão" | T8 |
| `provisorioAte` (enc + 11), sem `aplicado_em` | T1, T4 |
| ⓘ compartilhado; placar M4 troca o Info em fluxo | T2, T3 |
| Confirmações `.etd`; `ja_encerrado` com texto próprio | T7, ◆T 8 |
| Aplicar/Voltar pelas actions existentes | T7 |
| 22 estados do mockup | T4 (modelo), T6/T7 (tela), Gio (5 com captura) |
| Aplicar em 1 toque mesmo com edição externa | T7 (`forcar`, D-T12-5b) |
| Régua e CTR = o que decidiu (P1, P2) | T4 (D-T12-8/9) |
| Falhar em verde (P3-P5) | T4, T6 |
| v1 intocado | T4 (`null`), T6 (sem `pv2-`) |
| Gio + Phil/Yannis no fim | Validação |

## r2: como cada achado foi tratado

Todos conferidos no código antes de aplicar (arquivo:linha na coluna). Legenda: A = aceito, P = em parte, R = recusado.

| Achado | | Conferência / tratamento |
|---|---|---|
| P1 régua sem corte em enc | A | `decisao-v2-step.ts:300-301`, `decisao-v2.ts:357`, `atribuicao.ts:43-56`: D-T12-8, Foco 6, teste na T4 |
| P2 CTR do placar x lift | A | `decisao-v2.ts:216-259`: `ctrDosValidos` (D-T12-9), sai `ctrPorVariante` |
| P3 "desfeita" sem desfazer | A | `ab-restore.ts:176-186`, `ab-settle.ts:463-470`: desfeita só com todo campo `ok`; senão `desconhecido` (D-T12-4) |
| P4 chave `vencedor_sugerido` ausente | A | `decisao-v2-step.ts:249-252`, `ab-types.ts:242`: D-T12-10, ◆T 11; T4 confere o parse |
| P5 ativo que não encerra | A | `decisao-v2-step.ts:187`: `passouDoFim`, `ilegivel`, ◆T 12 e 13 (D-T12-11) |
| P6 "até 04/11" vencido | A | `decisao-v2-step.ts:329`: D-T12-12, texto existente sem data |
| P7 régua na projeção do Cowork | P | Recusado nesta fatia (+6K, mexe em `projecaoV2`, `youtube.ts:1110-1124`); FU: `reguaV2()` + `regua` no `get_test`, gatilho "o dono ou o Cowork pedir os pisos por variante"; sem ◆ |
| Y1 / H1 `precisa_confirmar` = sucesso | A | `ab-acao-saida.ts:19-20`, `ab-end-test-dialog.tsx:184`: sucesso só com `resultado === 'feito'`; teste na T7, Foco 5, regra global |
| Y2 `forcar` (dono: corrigir agora) | A | `actions.ts:1230`, `:748`, `:757`, `ab-settle.ts:566-578`: D-T12-5b, T7 (action + `rotuloConfirmar` + 2 testes); ◆T 9 vira rótulo; H2 superado, sem backlog |
| Y3 "aplicou à mão" sai | A | `actions.ts:1247`: `NoArV2.manual` removido, `desfechoMudou`, ◆T 7b; `aplicado-outra` do mockup = esse caso |
| Y4 `diasDaDecisao` única | A | `decisao-v2-step.ts:201-204`: T5 extrai e o passo a usa |
| Y5 "desfeita" com a original | A | `actions.ts:1270-1271`: winner = original ⇒ `noAr.original` |
| Y6 `.dica-i` sem escopo | A | `video-blocos.css:20-21`: margem escopada, `video-screen.tsx` no import, Gio confere comentários |
| Y7 casca `.etd` comum | A | `ab-confirmar-troca-dialog.tsx:58-118`: `CascaEtd` (D-T12-13) |
| Y8 Voltar após 7 dias | A | `ab-settle.ts:245-246`: ◆T 14 sem chamar a action |
| Y9 foco após refresh | A | `startTransition` + `isPending`; teste com `useRouter` falso (T7) |
| Y10 `modoV2` duplica interruptor | A | `placar-do-teste.tsx:303`: `modoV2` só esconde `pm4-sum`; sem `andamento` no v2 |
| H1 | A | = Y1 |
| H2 `forcar` no backlog | R | Superado pela decisão do dono (Y2): `forcar` entra agora |
| H3 ⓘ dos pisos falso | A | T6 usa o ◆T 10; dono avisado em 1 linha (tabela ◆T) |
| H4 ◆T como portão | A | Textos finais no plano; sem portão |
| H5 ordem | A | T0 → T8 → T1 → T2 → T4 → T5 → T6 → T7 → T3 → T9 |
| H6 K7 e prazo com data | A | K7 no T0 e antes do push; data no ACOMPANHAMENTO |
| H7 Gio menor | A | 5 estados completos, resto por teste e uma captura 390 |
| H8 custo | A | Não cortar; conta refeita: ≈249K (≈327K com portões) |
| Textos ◆T 1-10 (Logan, Naksu) | A | Tabela final; Logan quando diverge; 1a/5a/6a da Naksu; 4 = relógio para pausado (K8), 5 = n nulo antes da 1ª avaliação, 6 = nulos só defensivos (`decisao-v2.ts:216-259`), 8 = `outro_teste` mostra o `error` (`ab-acao-saida.ts:40`) |

---

## r2.1: emenda (acordo Phil 92 / Yannis 92 / Hanna 91)

Menores das re-revisões r2, sem nova rodada:
- **Portão morto** ("A T6 não começa sem isso"): seção ◆T removida (Phil N3, Yannis N1); os textos finais já estão na tabela.
- **Origem da `opcao`** e **`enviando`/`erro` no diálogo de troca** (Phil N4, Yannis N2, Hanna N1): T7.
- **Lift da frase** vem de `ctrDosValidos` (`{ctr, lift}`), não do gravado (Phil N1): D-T12-9, T4.
- **`ilegivel` vence `passouDoFim`** (Phil N2): T4, com teste.
- **`noAr.desconhecido`** coberto por teste da faixa de restauração (Phil N5): T7.
- **Gio 25K** marcado "a confirmar" (Hanna H7). Observação do Yannis: a T6 declara o contêiner `.pv2` que escopa `.dica-i`.
