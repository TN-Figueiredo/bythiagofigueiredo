# S8-F4 T12: tela v2 do teste A/B, plano de implementação

> **Para agentes executores:** use a sub-skill superpowers:subagent-driven-development (recomendada) ou superpowers:executing-plans e siga tarefa por tarefa. Os passos usam checkbox (`- [ ]`).

**r1, 25/10/2026 (1º rascunho, Opus).** Implementa a §T12 do plano pai `docs/superpowers/plans/2026-10-24-ab-s8-f4-plan.md` (l. 483-487) a partir do **mockup M5 r5 aprovado pelo dono em 25/10 10:50** (`bythiagofigueiredo/docs/superpowers/mockups/2026-10-25-m5-tela-v2/`, README e `index.html`) e das respostas `.superpowers/sdd/ab-lab/m5/respostas-{phil,yannis,hanna}.md` (repo principal). Linhas citadas conferidas no worktree `bt-s8-f2` em `10688089a`.

**Objetivo:** o teste com `regra_duracao = 'v2'` ganha na tela do A/B Lab o andamento por dias fechados, o bloco "Falta para decidir"/"Quanto o teste alcançou", o sinal provisório, o selo e a frase do desfecho, "Provisório até DD/MM", "No ar agora", e as ações Aplicar e Voltar à original no concluído; o ⓘ do placar M4 em produção passa a ser o `InfoDica` do Observatório.

**Arquitetura:** uma função pura `telaV2DoTeste` monta, no servidor, um modelo `TelaV2` só com leitura (`lerResultadoV2`, `por_variante`, `estadoV2DoTeste`, `pisos` sobre as linhas que `getTestResults` já lê, `provisorioAte`); os componentes só desenham esse modelo. Nada recalcula estatística. Ações reusam `aplicarSugerido` e `revertWinner`.

**Tech:** Next 16 + React 19, TypeScript strict, Vitest (jsdom para componente), CSS global por componente (padrão de `placar-do-teste.css`).

## Restrições globais

- **Worktree:** `$WT=/Users/figueiredo/Workspace/bt-s8-f2`, `W=$WT/apps/web`. Branch do controlador. Tarefas **em série** (T4-T8 editam `ab-types.ts` e `queries.ts`; o pre-commit roda `tsc` na árvore toda).
- **A tela só LÊ `result_metadata.v2`.** Fontes únicas: `lerResultadoV2` (`lib/youtube/ab-types.ts:263`), `por_variante` (só não originais), `estadoV2DoTeste` + `tetoDoTesteV2` (`ab-gravacao/decisao-v2.ts:85,25`), `pisos(dias, variantes, n)` (`:287`) sobre as linhas de `ab_test_dias` que `getTestResults` já lê. **Proibido:** chamar `estatisticaV2`, `decidirV2`, `desfechoProvisorio`, `sugeridoV2`, calcular lift ou p na tela; usar `ultima_avaliacao` ao lado de `pisos()` (dois números de dias válidos; plano pai T5 (b)).
- **"No ar agora" vem de `winner_variant_id`** (+ `winner_applied_at`), nunca de `vencedor_sugerido` (Yannis: a T9 sobrescreve o sugerido depois de `manual_winner`). **"A original vence"** = `desfecho = 'vencedor_provavel'` e `vencedor_sugerido` = id da variante `is_original`.
- **Ativo sem botão de aplicar** (veto do Phil), **sem lift, sem %, sem aviso de volume** (só a barra "Impressões X de N" de `pisos().volume` e `v2.n`). O aviso de volume fica só no início (T11c, C-17), sem mudança aqui.
- **Sem campo novo no banco, sem migration, sem `aplicado_em`.** A única função nova de dado é `provisorioAte` (pura).
- **Textos de interface exatamente como no mockup** (tabela da T4). Texto que o mockup não tem está na lista **◆T** (seção Decisões) e só entra depois de Logan e Naksu aprovarem; o executor nunca inventa frase.
- **v1 não muda** (nenhum bloco novo; o placar M4 segue com a frase e o andamento dele).
- **Next 16:** nada de `next/link` nem componente de Server Component como prop para client; server actions chegam por prop (`.bind` no `page.tsx`), nunca importadas por componente novo além do padrão já existente no arquivo.
- **Sem `any`.** Zod só onde já existe (`ResultadoV2Schema`).
- **Testes:** componente em arquivo `.tsx` com `// @vitest-environment jsdom`; pura em `.ts` (node). Datas relativas ou `vi.useFakeTimers()` + `vi.setSystemTime`; nunca ano fixo no futuro. Saída em `/tmp/s8t12-*.log`, só `tail` no contexto; nenhum comando > 4 min em primeiro plano (suíte em background com `; echo FIM >>`).
- **Pipeline Integrity:** nenhuma rota nova. A projeção do Cowork ganha `provisorio_ate` (T1) ⇒ atualizar `apps/web/data/pipeline-docs/cowork-docs-youtube.md`, `docs/cowork-pipeline-reference.md` e o `describe` de `manage_ab_test` (`lib/pipeline/mcp/tools.ts`) se ele lista os campos de `v2`; seed da referência é do controlador depois do deploy.
- **Cor:** sem token global novo. `--ok`/`--err` com os valores literais de `competitors/_sugestoes/sugestoes.css:10-23` (escuro e claro), declarados localmente em `.pm4`; sem `color-mix` (Opera); sombras e fundos em `rgba` literal.
- **Commits:** `tipo: descrição` em português + `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`; sem `--no-verify`; hook falhou ⇒ commit novo, nunca `--amend`.

## Conferências (T0; o executor refaz e para se mudou)

- **K1.** `grep -n "export function lerResultadoV2\|export function estadoV2DoTeste\|export function pisos\|export function tetoDoTesteV2\|export function encerradoEmDia" $W/src/lib/youtube/ab-types.ts $W/src/lib/youtube/ab-gravacao/decisao-v2.ts` ⇒ 5 linhas, assinaturas como no Mapa.
- **K2.** `grep -n "case 'reverter'\|case 'aplicar_sugerido'" $W/src/lib/youtube/ab-settle.ts` ⇒ `reverter` com `extra: {}` (não mexe em `winner_variant_id`) e `gravarResultado` zerando `winner_applied_at` e `revert_expires_at` quando a volta deu certo (`ab-settle.ts:463-464`). É por isso que "desfeita" se lê de `winner_applied_at === null` (D-T12-4).
- **K3.** `grep -n "completed_reason !== 'regra_v2'" "$W/src/app/cms/(authed)/youtube/ab-lab/actions.ts"` ⇒ a guarda de `aplicarSugerido` (`:1247`) devolve `ja_encerrado` para sugerido diferente, já aplicado ou não `regra_v2`. `aplicarSugerido` **não tem** parâmetro `forcar` (◆Y1).
- **K4.** `grep -rn "InfoDica" "$W/src/app/cms/(authed)/youtube"` ⇒ consumidores: `_proprio/{reguas,trocas,video-blocos}.tsx`, `_chrome/comentarios/secao.tsx` (e a própria). `grep -rn "canal-tip\|vb-info" ... --include=*.css` ⇒ `canal.css:130-134`, `video-blocos.css:20-22`. Outro arquivo que use `vb-info`/`vb-info-p`: parar e reportar.
- **K5.** `sed -n 7,35p $W/src/app/cms/(authed)/youtube/competitors/_chrome/chrome.css` contém só os dois blocos de tokens `[data-obs]{…}` e `[data-theme="light"] [data-obs]{…}` (custom properties + `color-scheme`). Se tiver outra regra, a T2 move só as declarações de token.
- **K6.** `grep -rln "Como ler o placar\|Como ler o andamento" $W/test` ⇒ hoje `test/youtube/ab-s8-f3-tela.test.tsx`. Os testes que afirmam o balão em fluxo mudam na T3, no mesmo commit.
- **K7 (produção, controlador).** `select count(*) from ab_tests where regra_duracao='v2';` — hoje 0. Se houver teste v2 concluído antes do envio, o controlador registra o id para a validação do Gio com dado real.

## Decisões do plano (a revisão pode recusar)

- **D-T12-1. Lugar compartilhado do ⓘ.** `InfoDica` sai de `competitors/_proprio/info-dica.tsx` para **`apps/web/src/app/cms/(authed)/youtube/_components/info-dica.tsx`** (pasta que já guarda peças comuns do YouTube, ex. `yt-portal`), com **`info-dica.css`** ao lado. O `Popover` fica onde está (`competitors/_chrome/flut/`) e é importado de lá (é cliente, sem `next/link`). Os tokens que o `#flut[data-obs]` herda saem de `chrome.css:7-35` para **`competitors/_chrome/tokens-obs.css`** (movidos, não copiados); `competitors/layout.tsx` importa `tokens-obs.css` antes de `chrome.css`; `info-dica.css` faz o mesmo `import` em JS no componente: `tokens-obs.css`, `camadas.css`, `flut/flut.css`. As regras do botão (`.vb-info` de `video-blocos.css:20-21`) e do corpo (`#flut .canal-tip .vb-info-p`, `:22`) **mudam-se** para `info-dica.css` com as classes `.dica-i` e `.dica-p`; as da caixa `#flut .obs-fl-pop.canal-tip` e `#flut .canal-tip h3` (`canal.css:130-131`) também se mudam, e `canal-header.tsx` e `proprio-header.tsx` (que usam `canal-tip`) passam a importar `info-dica.css`. Resultado: uma cópia de cada regra.
- **D-T12-2. Onde a tela v2 entra.** Ativo/pausado v2 ⇒ `ActiveDetail` (nunca `EarlyDetail`: `renderView` testa `view.v2?.fase === 'ativo'` antes de `isEarly`). Concluído v2 "da regra" (`completed_reason = 'regra_v2'`, ou `manual_winner` com `v2.encerrado_em_dia`) ⇒ componente novo `ConcluidoV2Detail`. Concluído v2 encerrado à mão no ativo (`manual_archive`, ou `manual_winner` sem `encerrado_em_dia`) segue em `WinnerDetail`/`PlayoffDetail` como hoje (não tem desfecho; Phil: fica fora da decisão).
- **D-T12-3. Placar M4 no v2.** `PlacarDoTeste` ganha `modoV2?: boolean`: com ele, não desenha a frase `pm4-sum` nem a seção "Andamento do teste" (o resumo e o andamento v2 vêm antes do placar, como no mockup). Tabela, faixa de dias e ⓘ do placar não mudam. Texto do ⓘ do placar: o de produção (o README do M5 diz "o M4 não muda").
- **D-T12-4. No ar agora.** `noAr` = variante `winner_variant_id` quando `winner_variant_id ≠ null` e `winner_applied_at ≠ null`; senão a original. **Desfeita** = `completed_reason = 'manual_winner'`, `winner_variant_id ≠ null`, `winner_applied_at = null` e `camposPendentes(paraRestoreStatus(restore_status), 'humano')` vazio. Com campos pendentes, a linha "No ar agora" não aparece (a faixa de restauração existente já explica; nunca afirmar o que está no ar sem saber).
- **D-T12-5. Botões do concluído.** **Aplicar {X} ao vídeo**: `desfecho = 'vencedor_provavel'`, sugerido ≠ original, `completed_reason = 'regra_v2'`, `winner_variant_id = null`. **Voltar à original**: `noAr` é variante, `winner_variant_id` = sugerido **ou** `vencedor_sugerido = null` (o caso "aplicado e o desfecho mudou"), e janela de reversão aberta (`revert_expires_at > agora`, mesma regra de `reversaoAberta`, `ab-settle.ts:245`); fora da janela, sem botão (o `revertWinner` devolveria `ja_encerrado`). Aplicada "à mão" (`winner_variant_id` ≠ sugerido não nulo): sem botão, texto "Você aplicou {X} à mão. No ar agora: {X}." Sem permissão de admin: `AdminOnlyNote` no lugar do botão (padrão de `winner-detail.tsx`).
- **D-T12-6. Volume nulo nunca é 0.** Linha de piso com `dias_validos = null` quando a variante não tem nenhuma linha em `ab_test_dias`; `volume = null` vem de `pisos()` (zero dia válido). Os dois ⇒ "—" + "não medido". `v2` ausente ou sem linha ⇒ estado "antes dos pisos".
- **D-T12-7. Frase com V = 3.** Listas de letras com vírgula e "e" ("A, B e C"; "A tem 412, B tem 388 e C tem 401"). A variante citada em "Faltou volume: {X} teve…" é a de menor volume (empate: menor letra); em "Faltaram dias medidos: {X} tem…", a de menos dias válidos.
- **◆T. Textos sem mockup (Logan e Naksu aprovam antes da T6; um despacho Sonnet com esta lista; não é do dono):**
  1. Ativo, piso de dias aberto e volume fechado: "Ainda não decide: faltam dias válidos." / "Cada versão precisa de 4; A tem 3 e B tem 2."
  2. Ativo, pisos fechados e `vencedor_sugerido = null`: "Os pisos fecharam; nenhuma versão está à frente." / "O teste segue até o fim para o resultado valer." (sem linha de sinal).
  3. Ativo, pisos fechados e sugerido = original: mesma frase do item 2 e sem linha de sinal (Yannis: botão nunca; o sinal da original não é "à frente").
  4. Ativo pausado: o Andamento troca "faltam N dias" por "pausado" (texto do M4 em produção).
  5. `v2.n = null` com dias: "Impressões **412** de —" com "não medido" no lugar do N, barra sem preenchimento.
  6. Vencedor com CTR nulo no placar: apoio só "(+17,4% vs A)."; lift nulo: só "CTR ≈ 5,4% contra 4,6% de A."
  7. Aplicado e desfecho mudou para volume/dado/aguardando (só `sem_diferenca_detectavel` está no mockup): apoio "Agora {selo em minúscula}; ao encerrar, {X} parecia melhor."
  8. Retorno `ja_encerrado` de Aplicar ou Voltar (Yannis opção a): no diálogo, `.etd-msg err` "**O teste mudou desde que você abriu a página.** Recarregue para ver o estado atual." + o botão seguro vira "Recarregar" (`router.refresh()` e fecha). `mudou` ⇒ `MSG_MUDOU`; `em_andamento` ⇒ `MSG_EM_ANDAMENTO`; `erro`/`sem_permissao` ⇒ o `error` da action.
  9. Retorno `precisa_confirmar` de Aplicar: `.etd-msg warn` "**O título ou a thumbnail foram editados por fora.** Confira no YouTube Studio antes de aplicar." (ver ◆Y1).
  10. ⓘ dos pisos: o mockup diz "Os números vêm da última avaliação gravada; a tela não recalcula", mas a tela conta os pisos com `pisos()` sobre as linhas (plano pai T5 (b)). Proposta: "Os números são contados dos dias fechados do placar; a tela não calcula estatística."
- **◆Y1 (Yannis).** `aplicarSugerido` não aceita `forcar`; se o `settleOnAir` pedir confirmação, a tela não tem como confirmar. Este plano só mostra o texto 9 de ◆T. Ganhar `forcar` = mudar a action (≈10K, fora deste plano) — recomendação: não agora (0 testes v2; o caso exige edição externa no mesmo vídeo).
- **◆D1 (registro, não pergunta).** No estado `concluido-inconclusivo-dado` do mockup, B mostra "—" com 2 dias válidos. `pisos()` soma as impressões dos dias válidos, então com 2 dias a tela mostra o número real. O Gio valida contra `pisos()`, não contra o desenho.

## Mapa de arquivos

`Y` = `apps/web/src/app/cms/(authed)/youtube/`, `C` = `Y/ab-lab/_components/`, `G` = `apps/web/src/lib/youtube/ab-gravacao/`, `T` = `apps/web/test/youtube/`.

| Arquivo | Tarefa | Papel |
|---|---|---|
| `G/decisao-v2.ts` | T1 | `provisorioAte(enc: DiaPt): DiaPt` |
| `apps/web/src/lib/pipeline/services/youtube.ts` (`projecaoV2`, ~1110) + docs do Cowork | T1 | campo `provisorio_ate` |
| `Y/_components/info-dica.tsx`, `Y/_components/info-dica.css` (novos, movidos) | T2 | ⓘ compartilhado |
| `Y/competitors/_chrome/tokens-obs.css` (novo, movido de `chrome.css:7-35`), `competitors/layout.tsx`, `_canal/canal.css`, `_proprio/video-blocos.css`, `_canal/canal-header.tsx`, `_proprio/proprio-header.tsx`, os 4 consumidores de `InfoDica` | T2 | mudança de lugar |
| `C/placar-do-teste.tsx` | T3, T6 | `Info` em fluxo ⇒ `InfoDica` (T3); prop `modoV2` (T6) |
| `G/tela-v2.ts` (novo) | T4 | `TelaV2`, `telaV2DoTeste`, frases |
| `apps/web/src/lib/youtube/ab-types.ts` | T5 | `AbTestResults.dias_decisao`, `AbTestBaseView.v2` |
| `Y/ab-lab/queries.ts` | T5 | monta `dias_decisao` e `v2` |
| `C/blocos-v2.tsx` + `C/blocos-v2.css` (novos) | T6 | `ResumoV2`, `AndamentoV2`, `PisosV2`, `SinalV2`, `DesfechoV2` |
| `C/active-detail.tsx`, `C/detail-header.tsx` (só se faltar o texto de concluído), `Y/ab-lab/[testId]/page.tsx` | T6, T7 | ligação |
| `C/concluido-v2-detail.tsx`, `C/ab-confirmar-dialog.tsx` (novos) | T7 | concluído v2, confirmação Aplicar/Voltar |
| `C/ab-end-test-dialog.tsx`, `C/acoes-de-saida.tsx` | T8 | aviso v2 no Encerrar |
| Testes: `G`→`apps/web/test/youtube/ab-gravacao/provisorio-ate.test.ts`, `T/info-dica-compartilhada.test.tsx`, `T/ab-s8-f4-placar-dica.test.tsx`, `apps/web/test/youtube/ab-gravacao/tela-v2.test.ts`, `T/ab-s8-f4-tela-v2-fonte.test.ts`, `T/ab-s8-f4-tela-v2-blocos.test.tsx`, `T/ab-s8-f4-tela-v2-concluido.test.tsx`, `T/ab-s8-f4-encerrar-v2.test.tsx` | T1-T8 | |

## Ordem e custo (refeito por tarefa; a herança era ≈150K)

T0 (≈5K) → T1 (≈12K) → T2 (≈18K) → T3 (≈15K) → T4 (≈40K) → T5 (≈20K) → **◆T aprovado** → T6 (≈40K) → T7 (≈35K) → T8 (≈8K) → T9 (≈15K). **Total ≈ 208K** de execução (Sonnet). Fora: aprovação ◆T por Logan+Naksu (≈15K), Gio no navegador (≈40K), Phil+Yannis no fim (≈50K). Motivo da alta: o ⓘ compartilhado (T2+T3, ≈33K) e o concluído com duas ações e quatro retornos (T7) não estavam na conta de 150K. Uma fatia só (brief); prazo: no ar antes de o 1º teste v2 fechar os pisos (hoje 0 testes v2, K7).

## Foco de revisão (o mockup implica, nenhum teste de tarefa cobre sozinho)

1. **Recarregar depois de aplicar.** "B está no ar" tem de sobreviver ao F5: vem do banco (`winner_variant_id` + `winner_applied_at`), nunca de estado do cliente. **Teste na T4** (entrada com `manual_winner` aplicado ⇒ `noAr` B; mesma entrada com `winner_applied_at = null` ⇒ desfeita).
2. **T9 mexe no desfecho depois do aplicar** (Yannis): `vencedor_sugerido` vira null e o desfecho vira `sem_diferenca_detectavel` com B no ar. Esperado: selo "Sem diferença", "B está no ar.", "Voltar à original", e nenhum "Aplicar". **Teste na T4** (estado `aplicado-mudou`).
3. **Sugerido = original no ATIVO** (sugerido provisório gravado pela T9): nenhuma linha "à frente", nenhum botão. **Teste na T4** (◆T 3).
4. **`v2` ilegível ou ausente em teste `regra_v2`**: selo ⚠ "Não consegui ler" / ◌ "Calculando", números do placar continuam, nenhum 0 e nenhum "sem vencedor". **Teste na T4 e na T7.**
5. **Duplo clique e aba velha em Aplicar**: o botão fica desabilitado enquanto envia; `ja_encerrado` mostra ◆T 8, nunca sucesso; sucesso só depois do `ok: true` da action. **Teste na T7** (action falsa resolvendo `ja_encerrado`, depois `ok`; 2 cliques ⇒ 1 chamada).

---

### T0: conferências K1-K7

- [ ] Rodar K1-K6 e comparar; pedir K7 ao controlador. Diferença: parar e reportar.

**Pronto quando** todas batem ou o controlador liberou por escrito.

### T1: `provisorioAte` e o campo no Cowork (Phil; ≈12K)

**Files:** Modify `G/decisao-v2.ts` (ao lado de `encerradoEmDia`, `:369`), `apps/web/src/lib/pipeline/services/youtube.ts` (`projecaoV2`), `apps/web/data/pipeline-docs/cowork-docs-youtube.md`, `docs/cowork-pipeline-reference.md`; Test `apps/web/test/youtube/ab-gravacao/provisorio-ate.test.ts` e o teste existente de `projecaoV2` (`grep -ln projecaoV2\|relogio apps/web/test`).

**Interfaces — Produces:** `export function provisorioAte(enc: DiaPt): DiaPt` = `addDays(enc, 11)` (de `../coleta/day-pt`). Projeção: `provisorio_ate: v2?.provisorio === true && v2.encerrado_em_dia ? provisorioAte(v2.encerrado_em_dia) : null`.

- [ ] **Teste (FAIL):** `provisorioAte('2026-10-24') === '2026-11-04'` (o "04/11" do mockup); virada de mês e de ano (`'2026-12-25'` ⇒ `'2027-01-05'`); projeção com `provisorio: false` ⇒ `provisorio_ate: null`; sem `encerrado_em_dia` ⇒ `null`; com os dois ⇒ a data.
- [ ] Implementar; JSDoc cita a conta do Phil: o cron de enc+11 fecha o último dia no caso normal; o reserva (`> 12`, grava em enc+13) não muda a data mostrada.
- [ ] Docs do Cowork: `provisorio_ate` (dia PT `AAAA-MM-DD`, nulo quando final ou sem encerramento pela regra; "pode mudar até esta data").
- [ ] PASS (`/tmp/s8t12-t1.log`). Commit `feat: S8-F4 T12 data de provisório do desfecho v2`.

### T2: `InfoDica` num lugar compartilhado (D-T12-1; ≈18K)

**Files:** Create `Y/_components/info-dica.tsx` (conteúdo de `competitors/_proprio/info-dica.tsx`, que é apagado), `Y/_components/info-dica.css`, `Y/competitors/_chrome/tokens-obs.css`; Modify os 4 consumidores (import), `competitors/layout.tsx`, `_chrome/chrome.css` (tira l. 7-35), `_canal/canal.css` (tira 130-131), `_proprio/video-blocos.css` (tira 20-22), `_canal/canal-header.tsx`, `_proprio/proprio-header.tsx` (importam `info-dica.css`); Test `T/info-dica-compartilhada.test.tsx`.

**Interfaces — Produces:** `export function InfoDica({ titulo, paragrafos, rotulo }: { titulo: string; paragrafos: readonly string[]; rotulo?: string })` (mesma assinatura). Botão `className="ibtn dica-i"`, parágrafo `className="dica-p"`. `info-dica.css` (valores de `video.css:24-27,48`, `video-blocos.css:20-22`, `canal.css:130-131`): `.dica-i` 24×24, raio 50%, `color: var(--muted)` (hover `--text`), foco `2px solid var(--accent)` offset 2, `svg` 16, `margin:-6px 0`; `@media (pointer:coarse)` 44×44 e `margin:-10px 0`; `#flut .obs-fl-pop.canal-tip` 380 px, padding 12×14, 13 px, `max-height:min(70vh,560px)`; `#flut .canal-tip h3` 600 13,5 px; `#flut .canal-tip .dica-p` 13/19, `margin:4px 0 0`.

- [ ] **Teste (FAIL):** render de `InfoDica` fora de qualquer `[data-obs-screen]`: clique ⇒ `#flut` existe no `body` com `data-obs`, a caixa tem `obs-fl-pop canal-tip`, `h3` = título, `aria-expanded="true"`; Esc ⇒ fecha e o foco volta ao botão; segundo ⓘ aberto fecha o primeiro. Teste de import: `grep` em teste (`fs.readFileSync`) de que `chrome.css` não contém mais `--surface:` e `tokens-obs.css` contém os dois temas.
- [ ] Mover; rodar os testes de Observatório que tocam ⓘ (`npx vitest run test/youtube/observatorio > /tmp/s8t12-t2-obs.log 2>&1` em background, `FIM`).
- [ ] PASS. Commit `refactor: S8-F4 T12 ⓘ do Observatório num lugar compartilhado do YouTube`.

### T3: placar M4 em produção usa o `InfoDica` (r4/r5 do M5; ≈15K)

**Files:** Modify `C/placar-do-teste.tsx` (apaga `function Info`, `:47`; 5 usos ⇒ `InfoDica`), `C/placar-do-teste.css` (tira o CSS do balão em fluxo, se houver); Test `T/ab-s8-f4-placar-dica.test.tsx`, ajuste de `T/ab-s8-f3-tela.test.tsx` (K6).

Cada `<Info label="L"><b>Título.</b> resto</Info>` vira `<InfoDica rotulo="L" titulo="Título" paragrafos={['resto']} />` (título sem o ponto final, como o `info()` do mockup, `index.html:402`). Para o ⓘ do andamento, o parágrafo continua montado com o ramo `v1`/v2 de hoje.

- [ ] **Teste (FAIL):** com `PlacarDoTeste` montado, clicar "Como ler o placar" ⇒ caixa no `#flut` (não irmã do botão), `h3` "Como ler este placar"; o nó do placar não ganha filho novo (o ⓘ não muda o layout); Esc devolve o foco.
- [ ] PASS (+ `ab-s8-f3-tela*.test.tsx` verdes, `/tmp/s8t12-t3.log`). Commit `feat: S8-F4 T12 ⓘ do placar como popover do produto`.

### T4: modelo puro da tela v2 (≈40K)

**Files:** Create `G/tela-v2.ts`; Test `apps/web/test/youtube/ab-gravacao/tela-v2.test.ts`.

**Interfaces — Produces:**
```ts
export interface VarianteDaTela { id: string; letra: DisplayLabel; titulo: string; is_original: boolean }
export interface LinhaPisoV2 { variant_id: string; letra: DisplayLabel; titulo: string; volume: number | null; dias_validos: number | null }
export type SeloV2 =
  | { tipo: 'vence'; provisorio: boolean; letra: DisplayLabel } | { tipo: 'original' } | { tipo: 'sem_diferenca' }
  | { tipo: 'volume' } | { tipo: 'dado' } | { tipo: 'falha' } | { tipo: 'aguardando' } | { tipo: 'pendente' } | { tipo: 'ilegivel' }
export type NoArV2 =
  | { tipo: 'original' } | { tipo: 'aplicada'; letra: DisplayLabel } | { tipo: 'manual'; letra: DisplayLabel }
  | { tipo: 'desfeita'; letra: DisplayLabel } | { tipo: 'desconhecido' }
export type TelaV2 =
  | { fase: 'ativo'; dia: number; teto: number; pausado: boolean; frase: { principal: string; apoio: string }
      n: number | null; pisos: LinhaPisoV2[]; sinal: DisplayLabel | null }
  | { fase: 'concluido'; selo: SeloV2; frase: { principal: string; apoio: string }
      prazo: { tipo: 'provisorio'; ate: string | null } | { tipo: 'final' } | null   // `ate` = 'DD/MM' ou null
      noAr: NoArV2; aplicar: { variant_id: string; letra: DisplayLabel } | null; voltar: boolean
      n: number | null; pisos: LinhaPisoV2[] | null; tentarDeNovo: boolean }
export interface EntradaTelaV2 {
  teste: { id: string; status: string; regra: 'v1' | 'v2'; config: unknown; paused_at: string | null; completed_at: string | null
    completed_reason: string | null; winner_variant_id: string | null; winner_applied_at: string | null
    revert_expires_at: string | null; restore_status: unknown; result_metadata: unknown; original_title: string | null }
  variantes: VarianteDaTela[]; ciclos: CicloComNumero[]; dias: DiaDaDecisao[]
  ctrPorVariante: Record<string, number | null>   // placar.variantes[].ctr (fração), só para a frase do vencedor
  agora: Date
}
export function telaV2DoTeste(e: EntradaTelaV2): TelaV2 | null
```
Regras (fonte única; nada de estatística):
- `null` quando `regra !== 'v2'`, status `draft`/`queued`, ou concluído fora de D-T12-2.
- Ativo: `teto = tetoDoTesteV2(config, variantes.length)`, `dia` de `estadoV2DoTeste(...)`; `lido = lerResultadoV2(result_metadata)`; `n = lido.ok ? v2.n ?? null : null`; `p = pisos(dias, ids, n ?? Infinity)`; `sinal` = letra de `v2.vencedor_sugerido` só quando `p.piso_dias && p.piso_volume`, sugerido ≠ null e ≠ original.
- Concluído: `ilegivel` ⇒ selo `ilegivel`, `tentarDeNovo: true`; `ausente` ou sem `desfecho` ⇒ `pendente`; desfecho ⇒ selo (`vencedor_provavel` + original ⇒ `original`). `prazo`: só para vence/original/sem_diferenca/volume/dado; `provisorio === true` ⇒ `{ provisorio, ate: encerrado_em_dia ? DD/MM de provisorioAte(...) : null }`, senão `final`. `noAr` (D-T12-4), `aplicar`/`voltar` (D-T12-5; `voltar` usa `agora`). `pisos` (régua final) com o mesmo `pisos()`.

Frases (copiar literal; `{N}` com `toLocaleString('pt-BR')`, CTR com 1 casa e vírgula, lift com sinal e 1 casa):

| Estado | principal | apoio |
|---|---|---|
| ativo, nenhum dia/sem `v2` | Ainda não decide: o YouTube não fechou nenhum dia. | A primeira avaliação sai até 24 horas depois do início. |
| ativo, falta volume, `dia < teto − 1` | Ainda não decide: faltam impressões. | Cada versão precisa de {N}; A tem {a} e B tem {b}. |
| ativo, falta volume, `dia ≥ teto − 1` | Faltam impressões; o teste encerra amanhã. | No dia {T} a original volta ao ar. Cada versão precisa de {N}; A tem {a} e B tem {b}. |
| ativo, pisos fechados, sinal X | Há um sinal de {X}, mas ainda não decide. | Os pisos fecharam. O teste segue até o fim para o resultado valer. |
| linha de sinal (ativo) | **Sinal provisório, não decide:** {X} está um pouco à frente. | |
| vence provisório / final | {X} provavelmente vence. / {X} vence. | CTR ≈ {ctrX}% contra {ctrA}% de A ({lift}% vs A). |
| original | A original se saiu melhor; nada a aplicar. | A original segue no ar. |
| sem diferença | Sem diferença clara entre {A e B}. | A original segue no ar. / com B aplicada: Agora não há diferença clara; ao encerrar, {X} parecia melhor. |
| volume | Faltou volume: {X} teve {v} de {N} impressões. | Este vídeo recebe poucas impressões para decidir. A original segue no ar. |
| dado | Faltaram dias medidos: {X} tem {d} de 4. | O YouTube não enviou o CTR de alguns dias. A original segue no ar. |
| falha | O teste foi encerrado por segurança, não por resultado. | A original voltou ao ar. |
| aguardando | O YouTube ainda não enviou o alcance dos últimos dias. | O desfecho pode mudar quando chegar. |
| pendente | Calculando o desfecho. | A conta roda uma vez por dia. Volte amanhã. |
| ilegível | Não consegui ler o desfecho deste teste. | Os números abaixo são os gravados. Nada foi alterado. |

Os demais (◆T 1-3, 5-7) entram só com o texto aprovado. Selos (texto e símbolo): `▲ {X} vence (provisório)` / `▲ {X} vence`, `◆ A original vence`, `= Sem diferença`, `◔ Faltou volume`, `∅ Dado não medido`, `✕ Encerrado por segurança`, `◷ Aguardando o YouTube`, `◌ Calculando`, `⚠ Não consegui ler`; desfeita acrescenta `◆ Aplicação de {X} desfeita`.

- [ ] **Testes (FAIL), um por estado do mockup** (os 22 de `ORDEM` menos início, carregando, erro e v1), com o texto exato: `ativo-antes-pisos` (sem linhas ⇒ `dias_validos` e `volume` null, nunca 0), `ativo-sem-volume` (412/388 de 10.315, `sinal` null), `ativo-sinal` (`sinal` 'B'), `ativo-teto-sem-volume` (dia 14 de 15), `concluido-vencedor-provisorio` (`ate` '04/11' com enc 24/10, `aplicar` B), `-vencedor-final` (`prazo.final`), `-aplicado` (`noAr` aplicada B, `voltar` true dentro da janela e false com `revert_expires_at` passado), `-aplicado-mudou` (Foco 2), `-aplicado-outra` (`manual` C, sem botões), `-original-vence` (sem `aplicar`, sem lift na frase), `-sem-diferenca`, `-inconclusivo-volume`, `-inconclusivo-dado`, `-inconclusivo-falha` (sem `prazo`), `-aguardando`, `-pendente`, `-ilegivel` (`tentarDeNovo`). Mais: Foco 1 (desfeita), Foco 3, V = 3 ("A, B e C"), v1 ⇒ `null`, `manual_archive` v2 ⇒ `null`, restore pendente ⇒ `noAr.desconhecido`. Datas com `vi.setSystemTime` relativo a `encerrado_em_dia`.
- [ ] Teste de guarda: `fs.readFileSync('src/lib/youtube/ab-gravacao/tela-v2.ts')` não contém `estatisticaV2(`, `decidirV2(`, `desfechoProvisorio(`, `sugeridoV2(` nem `ultima_avaliacao`.
- [ ] PASS (`/tmp/s8t12-t4.log`). Commit `feat: S8-F4 T12 modelo da tela v2 (só leitura)`.

### T5: fonte da tela entrega `v2` (≈20K)

**Files:** Modify `apps/web/src/lib/youtube/ab-types.ts` (`AbTestResults.dias_decisao: DiaDaDecisao[]`; `AbTestBaseView.v2?: TelaV2 | null`), `Y/ab-lab/queries.ts` (`getTestResults` e `toDetailView`); Test `T/ab-s8-f4-tela-v2-fonte.test.ts` (node, `fake-postgrest.ts`).

**Interfaces — Consumes:** `telaV2DoTeste` (T4), `cicloDoDia`, `blocoDoDia` (`decisao-v2.ts:45,62`). **Produces:** `view.v2`.

- [ ] `getTestResults`: das linhas que `lerDiasDoTeste` já devolve, monta `dias_decisao` como `decisao-v2-step.ts:201-204` (mesmo mapeamento, `V` = nº de variantes; ciclos já lidos com `cycle_number`). Zero consulta nova (teste conta as consultas do `fake-postgrest` antes e depois: iguais).
- [ ] `toDetailView`: `base.v2 = telaV2DoTeste({...})` com `variantes` de `variantDb`/`toDisplayLabel`, `ctrPorVariante` de `results.placar?.variantes`, `agora = new Date()`. Para v2 ativo, `dayOf`/`durationDays` do cabeçalho passam a `v2.dia`/`v2.teto`.
- [ ] **Testes (FAIL):** teste v2 ativo ⇒ `view.v2.fase === 'ativo'` e `dayOf` = relógio por dias fechados; v1 ⇒ `view.v2` null e `dayOf` como hoje; nº de consultas igual ao de antes.
- [ ] PASS (`/tmp/s8t12-t5.log`). Commit `feat: S8-F4 T12 fonte da tela monta o modelo v2`.

### ◆T: textos fora do mockup (portão, controlador)

- [ ] Controlador despacha Logan + Naksu (Sonnet, `medium`) com a lista ◆T e os estados da T4; resposta grava o texto final neste plano. **A T6 não começa sem isso.**

### T6: blocos do ativo e placar em modo v2 (≈40K)

**Files:** Create `C/blocos-v2.tsx`, `C/blocos-v2.css`; Modify `C/placar-do-teste.tsx` (`modoV2`), `C/active-detail.tsx`, `Y/ab-lab/[testId]/page.tsx` (`renderView`, D-T12-2); Test `T/ab-s8-f4-tela-v2-blocos.test.tsx` (jsdom).

**Interfaces — Produces (arquivo `'use client'`, porque usa `InfoDica`):**
`ResumoV2({ frase })` · `AndamentoV2({ dia, teto, pausado })` · `PisosV2({ linhas, n, final }: { linhas: LinhaPisoV2[]; n: number | null; final: boolean })` · `SinalV2({ letra })` · `DesfechoV2(...)` (T7).

Estrutura e classes copiadas do mockup (`index.html`: `relogio` 538-544, `pisos` 545-558, `sinal` 559-562, CSS `.sum`, `.rel`, `.ticks`, `.pisos`, `.pr`, `.pbar`, `.pnum`, `.pdv`, `.okk`, `.sinal` do `<style>`), com prefixo `pv2-` para não colidir com o `pm4-`, tokens `--cn-*` do `.cn-raiz` no lugar dos do mockup, e `--ok`/`--err` locais (Restrições). Textos dos ⓘ (via `InfoDica`):
- Andamento: título "Andamento", parágrafo "Um quadrado por dia corrido; o contorno forte é hoje. O teste também exige um mínimo de dias corridos antes de decidir, e encerra sozinho no dia {T}. Isso não indica quem está na frente.", rótulo "Como ler o andamento".
- Pisos: título "Pisos" (final: "Régua final"), parágrafo "O teste só decide se cada versão tiver pelo menos 4 dias válidos e {N} impressões nos dias válidos. Os números vêm da última avaliação gravada; a tela não recalcula. “—” é não medido, não zero.", rótulo "Como ler os pisos" / "Como ler a régua final". Cabeçalho "Falta para decidir" / "Quanto o teste alcançou".
- Andamento: "Dia {X} de {T}" + "faltam {f} dias" (`f = 1`: "faltam 1 dia", literal do mockup, `index.html:541`); `f = 0` ⇒ "último dia"; pausado ⇒ ◆T 4. Ticks: `i+1 < dia` passado, `= dia` hoje.
- Pisos: linha "Impressões **{v}** de {N}" + "✓" quando `v ≥ N` (barra cheia `ok`, largura mínima 2% com `v > 0`); "Dias válidos **{d}** (mínimo 4) ✓" ou "Dias válidos **{d}** de 4"; null ⇒ "—" + "não medido".

`ActiveDetail` com `view.v2?.fase === 'ativo'`: entre o cabeçalho e o placar, `ResumoV2` → `AndamentoV2` → `PisosV2(final=false)` → `SinalV2` (se `sinal`); `PlacarDoTeste modoV2`; hero, `CredibleInterval` e afins continuam presos a `comEstatistica` (nunca verdadeiro aqui). Pausar/Encerrar ficam onde estão.

- [ ] **Testes (FAIL):** `ativo-sem-volume` ⇒ "412 de 10.315" e "388 de 10.315", nenhum `%` no bloco, nenhum botão com "Aplicar"; `ativo-antes-pisos` ⇒ 2× "não medido", nenhum "0" nos pisos; `ativo-sinal` ⇒ texto da linha de sinal, sem cor `--ok` (classe neutra); `modoV2` ⇒ sem `.pm4-sum` e sem `[data-section="andamento"]` no placar; teste v1 ⇒ nenhum `pv2-`; ⓘ do Andamento abre no `#flut`.
- [ ] PASS (`/tmp/s8t12-t6.log`). Commit `feat: S8-F4 T12 andamento, pisos e sinal do teste v2 em andamento`.

### T7: concluído v2, Aplicar e Voltar à original (≈35K)

**Files:** Create `C/concluido-v2-detail.tsx`, `C/ab-confirmar-dialog.tsx`; Modify `C/blocos-v2.tsx` (`DesfechoV2`), `C/blocos-v2.css`, `Y/ab-lab/[testId]/page.tsx` (rota do concluído e `.bind` das actions); Test `T/ab-s8-f4-tela-v2-concluido.test.tsx` (jsdom).

**Interfaces:**
- `ConcluidoV2Detail({ view, aplicar, voltar }: { view: AbTestDetailView & { v2: Extract<TelaV2, { fase: 'concluido' }> }; aplicar: (varianteId: string, seqVisto: number) => Promise<ResultadoAcaoSaida>; voltar: (seqVisto: number) => Promise<ResultadoAcaoSaida> })` — `page.tsx` passa `aplicarSugerido.bind(null, id)` e `revertWinner.bind(null, id)`. Ordem: `DetailHeader` (lab; selo "Teste do Lab concluído em {DD/MM}" — se `detail-header.tsx` não tiver esse texto, acrescentar) → `ResumoV2` → `DesfechoV2` → `PisosV2(final=true)` (se `pisos`) → `PlacarDoTeste modoV2`.
- `DesfechoV2({ tela, onAplicar, onVoltar, podeAdministrar })`: selo `role="status"` (classes `vence`/`vence prov`/`neu`/`mut`/`nmf`/`esp`/`errf`/`fort` do mockup, `index.html:201-210`), linha de prazo ("Provisório até {DD/MM}: pode mudar nos próximos dias." com ícone de relógio; sem data: "Provisório: pode mudar nos próximos dias."; final: "■ Final: já não muda."), linha `.noar` (`tabIndex={-1}`; textos: "No ar agora: **A (original)**." / "**B** está no ar." / "Você aplicou C à mão. No ar agora: **C**." / desfeita: "No ar agora: **A (original)**. B deixou de ser aplicada."), botão `Aplicar {X} ao vídeo` (primário) ou `Voltar à original`, e `Tentar de novo` (`router.refresh()`) no ilegível.
- `AbConfirmarDialog({ titulo, lead, nota, rotuloConfirmar, enviando, erro, onVoltar, onConfirmar })`: casca de `ab-confirmar-troca-dialog.tsx:58-118` (`YtPortal`, `role="alertdialog"`, `.etd-ico.w`, `.etd-lead` + `.etd-tiny`, `.etd-btn.over` primeiro e "Voltar" depois, `useModalFocusTrap(ref, true, onVoltar, voltarRef)` com foco inicial em Voltar), CSS `ab-end-test-dialog.css` sem mudança. Textos: Aplicar ⇒ título "Aplicar {X} ao vídeo?", lead "A miniatura muda agora no YouTube.", nota "O desfecho ainda é provisório." (só se provisório), botão "Aplicar {X}"; Voltar ⇒ título "Voltar à original (A)?", lead "A miniatura volta a ser a de A agora no YouTube.", nota "O resultado do teste não muda e continua visível aqui.", botão "Sim, voltar à original".

Fluxo: confirmar ⇒ `enviando` (botões desabilitados) ⇒ `ok: true` ⇒ fecha, `router.refresh()` e foco na `.noar` depois do refresh (efeito com `useRef` de pendência); `ok: false` ⇒ fica aberto com a mensagem de ◆T 8/9; Esc/Voltar/fundo fecham e devolvem o foco ao gatilho.

- [ ] **Testes (FAIL):** `concluido-vencedor-provisorio` ⇒ selo "B vence (provisório)" e "Provisório até 04/11: pode mudar nos próximos dias."; clique Aplicar ⇒ diálogo com foco em "Voltar"; confirmar com action `ok` ⇒ 1 chamada com (`idB`, `restoreSeq`), `router.refresh` chamado; 2 cliques rápidos ⇒ 1 chamada (Foco 5); action `ja_encerrado` ⇒ texto ◆T 8, nada de sucesso; `concluido-original-vence` ⇒ nenhum botão, nenhum `%`; `-aplicado` ⇒ "Voltar à original" e, confirmado, `voltar(restoreSeq)`; `-ilegivel` ⇒ "Tentar de novo"; sem admin ⇒ sem botão Aplicar, com a nota de admin; Esc fecha e devolve o foco.
- [ ] PASS (`/tmp/s8t12-t7.log`). Commit `feat: S8-F4 T12 desfecho do teste v2 com aplicar e voltar à original`.

### T8: aviso no Encerrar do teste v2 (≈8K)

**Files:** Modify `C/ab-end-test-dialog.tsx` (prop `regraV2?: boolean` em `AbEndTestDialogProps`, passada a `Escolha`), `C/acoes-de-saida.tsx` (`regraV2={view.placar?.regra === 'v2'}`); Test `T/ab-s8-f4-encerrar-v2.test.tsx` (jsdom).

- [ ] **Teste (FAIL):** com `regraV2`, a fase `escolha` mostra `.etd-msg.warn` "Encerrar à mão tira o teste da decisão: o resultado não será calculado." antes do rodapé; sem a prop (v1), não mostra; o restante do diálogo (opções, "Encerrar e ficar com …", "Cancelar") igual (`T/ab-end-test-dialog.test.tsx` verde).
- [ ] PASS (`/tmp/s8t12-t8.log`). Commit `feat: S8-F4 T12 encerrar à mão avisa que tira o teste v2 da decisão`.

### T9: fecho (≈15K)

- [ ] Suíte do A/B e do Observatório em background: `cd $W && npx vitest run test/ab- test/youtube > /tmp/s8t12-suite.log 2>&1; echo FIM >> /tmp/s8t12-suite.log`; no contexto, só falhas.
- [ ] `npm run build:web > /tmp/s8t12-build.log 2>&1` em background (mudança de UI com CSS movido: arriscada pela regra do CLAUDE.md); `tail` no fim.
- [ ] `docs/ab-testing-system-reference.md`: seção curta "Tela v2" (fontes de cada bloco, D-T12-4/5).
- [ ] Commit `docs: S8-F4 T12 referência da tela v2`.

## Validação (portões, controlador)

- **Gio (navegador, Sonnet):** semente local com 1 teste v2 por estado da T4 (o padrão de semente do F3 T5); critérios: os do README do M5 ("Como testar" 1-5), C-17 (início com aviso inalterado), 390 px sem rolagem horizontal, ⓘ de 24 px (44 no toque) com popover no `#flut` e altura da página igual aberto/fechado, diálogos com foco inicial certo e Esc, selo legível em escala de cinza, Opera (sem `color-mix`), e o Observatório: ⓘ da tela do vídeo e do canal iguais a antes (T2). Capturas em arquivo.
- **Phil e Yannis** no fim (Opus na 1ª revisão), com este plano e o diff.

## SQL de leitura (produção, controlador)

```sql
-- K7 e escolha do teste para o Gio com dado real
select id, status, completed_reason, winner_variant_id, winner_applied_at,
       result_metadata->'v2'->>'desfecho' as desfecho, result_metadata->'v2'->>'provisorio' as prov,
       result_metadata->'v2'->>'encerrado_em_dia' as enc
from ab_tests where regra_duracao = 'v2' order by created_at desc limit 20;
```

## O que o dono vê (aceite)

- CA-4 do plano pai (l. 494) na tela: o mesmo desfecho do Cowork, "Provisório até DD/MM" igual ao `provisorio_ate` do Cowork, a variante sugerida e o Aplicar em 1 toque (+ 1 confirmação).
- Com um teste v2 concluído por volume: "Faltou volume: …", N e impressões reais, "A original segue no ar.", sem lift e sem botão (Hanna).
- Nenhum campo ausente como 0.

## Riscos

- **CSS movido do Observatório (T2):** regressão visual no ⓘ do vídeo e do canal. Mitigação: Gio compara com as capturas de antes; teste de leitura de CSS na T2.
- **`#flut` no A/B Lab** herda `--surface`, `--border-strong`, `--shadow` de `[data-obs]`: os tokens são os do Observatório, não os `--cn-*` do placar; a cor do popover pode diferir ~1 tom do resto da tela. Aceito (padrão do produto, r5 do M5); Naksu mede.
- **Restore parcial depois de Aplicar:** a linha "No ar agora" some (D-T12-4) e a faixa de restauração existente assume; se a faixa não aparecer na rota do concluído v2, o dono fica sem a informação. A T7 inclui a `AvisoDePagina`/faixa que o `page.tsx` já monta (conferir).
- **Texto ◆T** atrasa a T6 enquanto Logan e Naksu não respondem (≈1 despacho).
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
| 22 estados do mockup | T4 (modelo), T6/T7 (tela), Gio |
| v1 intocado | T4 (`null`), T6 (sem `pv2-`) |
| Gio + Phil/Yannis no fim | Validação |
