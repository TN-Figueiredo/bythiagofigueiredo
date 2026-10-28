# M7d — Tela do teste rodando com largura única e ações no cabeçalho: plano de implementação (r2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans. Passos com checkbox (`- [ ]`).

**r2:** aplica todos os achados de Yannis (76) e Hanna (84) da r1 (`yannis-plano-r1.md`, `hanna-plano-r1.md` em `.superpowers/sdd/ab-lab/m7d/` do repo principal) e as decisões do dono e do controlador de 27/10 (seção "Decisões").

**Objetivo:** a página do teste do Lab (`/cms/youtube/ab-lab/[testId]`) passa a ter uma coluna única de 1040 px alinhada à esquerda, com selo "dia X de Y" e a barra Pausar/Retomar · Encerrar + Abrir no YouTube no cabeçalho; o freio do Encerrar vai para o diálogo; Forçar rotação vai para o bloco de rotação com diálogo `.etd`; o ⓘ do selo vira InfoDica; o título da versão no placar ocupa até 2 linhas sem reticências; a faixa do pausado é uma só, com data; o concluído (WinnerDetail) diz qual versão ficou no ar pela fonte única.

**Arquitetura:** um módulo puro novo (`cabecalho-do-teste.ts`) decide todos os textos e estados (selo, freio, frase da pausa, "Ficou no ar") e faz a conta do `total`; os componentes existentes só desenham. Um componente de tela novo, `ForcarRotacao` (dono do diálogo da rotação, reusa `AbConfirmarDialog`). O estado "escrevendo" vem de `faixaDaPagina` (régua de 5 min da faixa), não de `emAndamentoDesde` cru.

**Tech stack:** Next.js 16 + React 19, CSS próprio do Lab (`.cn-raiz`, `.dhl`, `.pm4`, `.etd`), Vitest + Testing Library.

**Spec / aceitação:**
- Mockup aprovado (r5, 43ddd4436), fonte da verdade de texto e comportamento: `/Users/figueiredo/Workspace/bythiagofigueiredo/docs/superpowers/mockups/2026-10-27-m7d-teste-rodando/index.html` (estados a–h, g1–g4; `?estado=g2&largura=390`).
- Decisões: `.superpowers/sdd/ab-lab/m7d/sintese-r2.md`, `logan-mockup-r2.md`, `naksu-mockup-r2.md` (repo principal).
- Escopo: D17 de `.superpowers/sdd/ab-lab/lab-reordem/envio2/dividas-envio2.md`; D21/D28 só para a fonte do "Ficou no ar".

## Decisões (27/10)

- **Dono: o botão Arquivar FICA** no cabeçalho do concluído (contorno, 44 px, à esquerda; "Abrir no YouTube" à direita). **Duplicar e Download saem** (sem ação, mesma regra do "Configurações"). A antiga P1 está resolvida e removida. A tela diverge do mockup (estado f) em um botão: Logan e Naksu dão uma olhada rápida nessa divergência na T9. O `confirm()` nativo do Arquivar fica como está neste lote (backlog: trocar por `AbConfirmarDialog`).
- **Controlador: a faixa do pausado leva a data.** `pausedAt` entra na visão do detalhe (T1b, sem migration, antes da T3). Uma tarefa própria (T3c) liga a frase à faixa, com **uma faixa só**. A antiga P2 está resolvida e removida.
- **D28 não se paga aqui** (Yannis I4). "Ficou no ar" **não entra** no `ConcluidoV2Detail` (lá o "no ar" continua sendo o do `DesfechoV2`, fonte única por tela). No `WinnerDetail` a frase **substitui** a linha "No ar agora" do `WinnerBanner`.
- **Gio em duas partes** (T8a local bloqueia o merge; T8b vídeo real depois da promoção).

## Resposta à pergunta aberta: pausar restaura o quê?

Lido no código: `pauseAbTest` (actions.ts:802) chama `settleOnAir(..., { destino: ORIGINAL, motivo: 'pausa' })`, que escreve só os campos de `camposDoTeste(test_type)` (ab-restore.ts:92): **teste de título → só o título; de miniatura → só a miniatura; combo → os dois.** Duas exceções: (1) com teste do YouTube confirmado no vídeo, a pausa é "sem escrever" (ab-settle.ts:633) e a tela já usa `pausaVisivel(...).frase`; (2) a escrita pode falhar, e aí a faixa de restauração aparece. Por isso a frase do pausado depende do tipo **e** de `restoreStatus` ser `ok` com `destino === 'original'` nos campos do teste; senão diz só "Nenhum dia novo entra no placar." O diálogo de pausa hoje diz "restaurar a miniatura original" em todo tipo: corrigido na T4.

## Restrições globais

- Comandos a partir de `apps/web`: `npx vitest run <arquivo> 2>&1 | tail -30`; typecheck `npx tsc --noEmit 2>&1 | tail -20`. Nunca rodar a suíte inteira no meio; só na T9.
- Teste de componente: primeira linha `// @vitest-environment jsdom`. Teste de módulo puro: sem pragma.
- Worktree `/Users/figueiredo/Workspace/bt-m6`, branch `trabalho/ab-lote-f4`. Commit por tarefa com caminho explícito (`git add <arquivos>`), mensagem `feat: M7d Tn ...` + linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Nunca `git stash`/`reset`.
- Cores só em hex/rgba ou tokens `--cn-*` já existentes (sem `color-mix`, o Opera pinta transparente).
- Alvo de toque 44 px em todo botão novo ou alterado. Nenhum primário (cheio) na barra do cabeçalho.
- Textos: copiar do mockup exatamente (aspas, reticências "…", "·"). Lista de textos na T1.
- `ab-primitives` (`TypeBadge`, `Badge`) para as etiquetas "Título" e "Round 1/2" (já usados no cabeçalho; não criar `.tag`).
- Nada de `confirm()`/`alert()` novo. O `alert` do Retomar e o `confirm` do Arquivar existentes ficam (fora do escopo, dívida registrada).
- **Ordem de subida:** T3a, T3b, T3c e T5 sobem juntas (a T3b apaga o Forçar rotação do cabeçalho e só a T5 o recoloca): não promover entre elas. Ordem de execução: T1, T1b, T2, T3a, T3b, T5, T3c, T4, T6, T7, T8a, T9, promoção, T8b.

## Foco de revisão (o que nenhum teste de unidade pega sozinho)

1. **Teste antigo v1 com `durationDays` menor que `dayOf`** (prazo vencido): a conta `total = Math.max(dayOf, durationDays)` mora **dentro** do módulo puro (mesma régua do `andamento` do placar, para selo e placar não divergirem). Teste na T1: `dayOf: 20, durationDays: 14` → "dia 20 de 20", freio `completo`.
2. **Pausado por deriva (`statusNote === DRIFT_STATUS_NOTE`)**: a faixa de deriva continua com "Reconhecer e Retomar"; o cabeçalho **não** mostra Retomar (pularia o reconhecimento). Teste na T3b.
3. **Pausado por teste do YouTube com `retomarDesabilitado`**: Retomar aparece com `aria-disabled="true"` e não chama a action. Teste na T3b.
4. **Restauração da pausa que falhou** (`restoreStatus.title.estado !== 'ok'`) ou **com destino que não é o original**: a frase não afirma "foi restaurado". Teste na T1.
5. **Quem não administra o site**: Forçar rotação some (fica o `AdminOnlyNote`) e o diálogo Encerrar mantém a original marcada mesmo se a variante estiver no ar. Testes na T4 e T5.
6. **Escrita que morreu**: "Escrevendo" some depois de 5 min (régua da faixa), nunca fica preso. Teste na T3a/T3b.

---

### T1 — Módulo puro de textos e estados (~17K)

**Arquivos:**
- Criar: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/cabecalho-do-teste.ts`
- Teste: `apps/web/test/youtube/ab-m7d-cabecalho-do-teste.test.ts`

**Interfaces (produz):**
```ts
export type TomDoSelo = 'rodando' | 'pausado' | 'escrevendo' | 'concluido' | 'nao_iniciado'
export function seloDoTeste(e: { status: AbTestStatus; dayOf: number; durationDays: number; escrevendo?: boolean; naoIniciado?: boolean; concluidoEm?: string }): { tom: TomDoSelo; texto: string }
export type FreioDoEncerrar = { tipo: 'sem_leitura' | 'faltam' | 'falta_1' | 'completo'; texto: string }
export function freioDoEncerrar(e: { dayOf: number; durationDays: number; medidos: number }): FreioDoEncerrar
export function contarDiasMedidos(faixa: readonly DiaDaFaixa[] | undefined): number
export function fraseDaPausa(flag: TestType, restore: RestoreStatus | null): string
export function fraseDaFaixaDePausa(flag: TestType, restore: RestoreStatus | null, pausedAt: string | null): string
export function textoDoDialogoDePausa(flag: TestType): string
export function linhaFicouNoAr(noAr: { letra: string | null } | null | undefined, concluidoEm?: string): string | null
```
Regras (valores exatos):
- `total` interno = `Math.max(dayOf, durationDays)` em `seloDoTeste` e `freioDoEncerrar` (o chamador passa `dayOf` e `durationDays`, nunca `total`).
- `seloDoTeste`: dia = `total >= 1 ? rotuloDoDiaExtenso(dayOf, total, { minusculo: true }) : ''` (lib/youtube/ab-rotulo-dia.ts). Prioridade: `concluidoEm` → `{concluido, "Concluído em {concluidoEm}"}`; `naoIniciado` → `{nao_iniciado, "Teste do Lab não iniciado"}` (texto atual, o mockup não cobre); `escrevendo` → `"Escrevendo no YouTube…"`; `status === 'paused'` → `"Pausado"`; senão `"Rodando"`. Com dia não vazio, acrescenta ` · {dia}` (escrevendo, pausado, rodando). **Dia vazio: só o rótulo, sem separador solto.**
- `freioDoEncerrar`: `faltam = andamentoDoDia(dayOf, total).faltam`. Ordem: `medidos === 0` → sem_leitura "Ainda não há leitura. Encerrar agora não calcula resultado."; `faltam === 0` → completo "Todos os {total} dias foram medidos."; `faltam === 1` → falta_1 "Falta 1 dia."; senão faltam "Faltam {faltam} dias dos {total}. Encerrar agora usa só os {medidos} dias já medidos."
- `contarDiasMedidos`: dias com `estado === 'medido' || estado === 'zero_medido'` (mesma régua do "■ medido"/"0 zero" da faixa do placar).
- `fraseDaPausa`: campos = `camposDoTeste(flag)`; se todos têm `restore?.[c]?.estado === 'ok'` **e** `restore[c].destino === 'original'`: title "O título original foi restaurado e nenhum dia novo entra no placar."; thumbnail "A thumbnail original foi restaurada e nenhum dia novo entra no placar."; combo "O título e a thumbnail originais foram restaurados e nenhum dia novo entra no placar."; senão "Nenhum dia novo entra no placar."
- `fraseDaFaixaDePausa`: `(pausedAt ? "Você pausou em DD/MM às HH:MM. " : "") + fraseDaPausa(flag, restore)`, data e hora em America/Sao_Paulo pelo helper existente `dataCurtaSp` (devolve "DD/MM HH:MM": DD/MM = `slice(0,5)`, HH:MM = `slice(6)`; não usar `horaSP`, que também devolve "DD/MM HH:MM" — Yannis N1). `pausedAt` nulo ou inválido: sem a primeira oração, não inventa data.
- `textoDoDialogoDePausa`: title "Pausar vai restaurar o título original imediatamente."; thumbnail "Pausar vai restaurar a miniatura original imediatamente." (texto atual); combo "Pausar vai restaurar o título e a miniatura originais imediatamente."
- `linhaFicouNoAr`: `letra` nula/ausente → `null` (não inventa); com `concluidoEm` → "O teste terminou em {concluidoEm}. Ficou no ar: a versão {letra}."; sem → "Ficou no ar: a versão {letra}."

- [ ] **Passo 1: testes que falham.** Um `it` por linha de regra acima, com o texto exato. Mais: `seloDoTeste({status:'active', dayOf:2, durationDays:14})` → "Rodando · dia 3 de 14"; `seloDoTeste({status:'active', dayOf:20, durationDays:14})` → "Rodando · dia 20 de 20" (Foco 1, conta real); `seloDoTeste({status:'active', dayOf:0, durationDays:0})` → "Rodando" (sem separador solto) e idem "Pausado"; `freioDoEncerrar({dayOf:20, durationDays:14, medidos:14}).tipo === 'completo'`; `freioDoEncerrar({dayOf:12,durationDays:14,medidos:12})` → "Falta 1 dia." (g3); `{dayOf:5,durationDays:14,medidos:5}` → "Faltam 8 dias dos 14. Encerrar agora usa só os 5 dias já medidos." (g2); `{dayOf:1,durationDays:14,medidos:0}` → sem_leitura (g1); `fraseDaPausa('title', { title: { estado: 'falhou', ... } })` → "Nenhum dia novo entra no placar." (Foco 4); `fraseDaPausa('title', null)` idem; `fraseDaPausa('title', { title: ok com destino '<uuid>' })` → "Nenhum dia novo entra no placar."; `fraseDaFaixaDePausa('thumbnail', {thumbnail: ok/original}, '2026-10-25T19:40:00Z')` → "Você pausou em 25/10 às 16:40. A thumbnail original foi restaurada e nenhum dia novo entra no placar."; com `pausedAt` nulo → sem a primeira oração.
- [ ] **Passo 2:** `npx vitest run test/youtube/ab-m7d-cabecalho-do-teste.test.ts 2>&1 | tail -30` → FAIL (módulo não existe).
- [ ] **Passo 3:** implementar as funções (sem React; importa `rotuloDoDiaExtenso`, `andamentoDoDia`, `camposDoTeste`, `dataCurtaSp`, tipos de `ab-types`/`placar`/`ab-restore`). `RestoreStatus = Partial<Record<'title'|'thumbnail', CampoRestauracao>>`, com `estado: EstadoCampo` (ab-restore.ts:8–46).
- [ ] **Passo 4:** mesmo comando → PASS.
- [ ] **Passo 5:** commit `feat: M7d T1 textos e estados do cabeçalho do teste`.

### T1b — Visão do detalhe: `pausedAt` e `proximaNaRotacao` (~10K)

Sem migration. A coluna `paused_at` já vem no select (o cartão a usa em queries.ts:517); a RPC a preenche na pausa e a zera no Retomar (migration 20261018000001, linhas 35 e 143).

**Arquivos:**
- Modificar: `apps/web/src/lib/youtube/ab-types.ts` (`AbTestActiveView`) e `apps/web/src/lib/youtube/queries.ts` (montador do detalhe ativo/inicial, perto da linha 1170)
- Teste: `apps/web/test/youtube/ab-m7d-visao-detalhe.test.ts`

**Interfaces:**
- `AbTestActiveView.pausedAt: string | null` = `test.paused_at ?? null`.
- `AbTestActiveView.proximaNaRotacao: DisplayLabel | null` = rótulo de `variants[getNextVariantIndex(test.config.rotation_pattern, variantCount, doneCycles + 1)]`, a mesma função e a mesma conta que o servidor usa em `forceRotate` (actions.ts:1140-1145); `null` quando o padrão é `random` (a próxima não é previsível).

- [ ] **Passo 1: testes que falham.** `pausedAt` vem do `paused_at` da linha e é `null` quando a coluna é nula. `proximaNaRotacao` com ABBA, 2 variantes e `done = 1` é igual ao rótulo de `variants[getNextVariantIndex('abba', 2, 2)]`; com `random` é `null`.
- [ ] **Passo 2:** rodar `npx vitest run test/youtube/ab-m7d-visao-detalhe.test.ts 2>&1 | tail -30` → FAIL.
- [ ] **Passo 3:** implementar; ajustar fixtures de `AbTestActiveView` que o typecheck apontar (`npx tsc --noEmit 2>&1 | tail -20`).
- [ ] **Passo 4:** rodar → PASS; tsc limpo.
- [ ] **Passo 5:** commit `feat: M7d T1b pausedAt e proxima da rotação na visão do detalhe`.

### T2 — Coluna única de 1040 px (~12K)

**Arquivos:**
- Criar: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-pagina.css`
- Modificar: `apps/web/src/app/cms/(authed)/youtube/ab-lab/[testId]/page.tsx` (envolver o retorno principal e o do mock)
- Teste: `apps/web/test/youtube/ab-m7d-coluna.test.ts` (contrato do CSS, lido com `fs.readFileSync`; espelha a implementação, a prova real é a T8a.1)

**Produz:** classes `.ab-pagina` (`container-type: inline-size`) e `.ab-coluna` (filho único, contém faixa, aviso e o detalhe).

CSS (valores do mockup): `.ab-coluna { --ab-largura: 1040px; --ab-recuo: 24px; width: 100%; max-width: calc(var(--ab-largura) + 2 * var(--ab-recuo)); margin-inline: 0; padding-inline: var(--ab-recuo); box-sizing: border-box; }` e `@container (max-width: 640px) { .ab-coluna { --ab-recuo: 16px; } }`. Os blocos internos (cabeçalho, placar, cartões Tailwind) ficam a 100% da coluna; só prosa tem teto em `ch` (já é assim em `.pm4-sum`, `.dhl-origem`).

- [ ] **Passo 1:** teste afirma no CSS: `--ab-largura: 1040px`, `margin-inline: 0`, `container-type: inline-size`, `--ab-recuo: 16px` dentro de `@container (max-width: 640px)`; e que `page.tsx` contém `className="ab-pagina"` e importa `ab-pagina.css` (leitura do fonte).
- [ ] **Passo 2:** rodar → FAIL.
- [ ] **Passo 3:** criar o CSS; em `page.tsx` importar `'../_components/ab-pagina.css'` e envolver os dois retornos (mock e real) em `<div className="ab-pagina"><div className="ab-coluna">…</div></div>`. O `FalhaDeLeitura` também.
- [ ] **Passo 4:** rodar → PASS; `npx tsc --noEmit 2>&1 | tail -20` limpo.
- [ ] **Passo 5:** commit `feat: M7d T2 coluna única de 1040 px na página do teste`.

### T3a — Cabeçalho: selo com dia, ⓘ InfoDica, grid do cabeçalho (~15K)

**Arquivos:**
- Modificar: `_components/detail-header.tsx`, `_components/detail-header-lab.css`, `_components/active-detail.tsx`, `_components/early-detail.tsx`
- Teste: `apps/web/test/youtube/ab-m7d-cabecalho.test.tsx`; atualizar `test/ab-lab-detalhe-origem.test.tsx` (o texto agora mora no balão) e os asserts de "Teste do Lab rodando/pausado" achados por `grep -rlE "Teste do Lab (rodando|pausado)|origem-lab" test`.

**Interfaces:**
- `DetailHeaderProps.lab` ganha `escrevendo?: boolean`. Selo = `seloDoTeste({ status, dayOf, durationDays, escrevendo, naoIniciado, concluidoEm })`; classe `dhl-selo` + modificador `dhl-selo--{tom}` (pausado: borda `--btn-ctl`, texto `--cn-text`; escrevendo: `--cn-yt-line`/`--cn-yt`/`--cn-yt-bg`; concluido: verde já usado no Lab; rodando: o laranja atual). Ícones: frasco (rodando), pausa, giro (escrevendo; parado com `prefers-reduced-motion`), ok (concluído).
- O parágrafo `dhl-origem`/`origem-lab` sai; ao lado do selo, fora do concluído e do não iniciado: `<InfoDica rotulo="O que é este teste" titulo="De onde vem este teste" paragrafos={[fraseDeOrigemDoLab(flag)]} />` (de `../../_components/info-dica`).
- Estrutura do 390 do mockup: `.dhl-hd` vira grid `grid-template-areas: "th crumb" "th ttl"` (colunas `128px minmax(0,1fr)`), e em `@container (max-width:640px)` `"crumb" "th" "ttl"`, miniatura 96 px. O rastro sai de dentro de `.dhl-ttl` e vira irmão (área `crumb`). `.dhl-h2`: `font: 600 20px/1.3 Georgia, serif; -webkit-line-clamp: 5`.
- `ActiveDetailProps` e `EarlyDetailProps` ganham `escrevendo?: boolean` (vem de `faixaDaPagina`, T3b). `ActiveDetail` e `EarlyDetail` passam `lab={{ thumbUrl, naoIniciado, escrevendo, … }}` ao `DetailHeader`; os dois detalhes vivos têm o mesmo cabeçalho.

- [ ] **Passo 1: testes que falham** (render de `ActiveDetail` com o fixture/mocks de `test/youtube/ab-detail-active.test.tsx`; acrescentar `Play` ao mock do lucide): `getByTestId('selo-lab')` tem texto "Rodando · dia 3 de 14" (`dayOf: 2, durationDays: 14`); pausado → "Pausado · dia …"; `escrevendo` → "Escrevendo no YouTube… · dia …". ⓘ: `getByRole('button', { name: 'O que é este teste' })`; clicar mostra "Teste do A/B Lab: o Lab troca o título público…" (texto de `fraseDeOrigemDoLab('title')`). Concluído (`lab.concluidoEm`): sem o botão.
- [ ] **Passo 2:** `npx vitest run test/youtube/ab-m7d-cabecalho.test.tsx 2>&1 | tail -30` → FAIL.
- [ ] **Passo 3:** implementar como nas Interfaces; CSS novo no `detail-header-lab.css` (copiar valores das regras `.dhl-hd`, `.dhl-crumb`, `.selo.*`, `.idica` do mockup, trocando `--muted`→`--cn-muted`, `--text`→`--cn-text`, `--ctl`→`--btn-ctl`).
- [ ] **Passo 4:** rodar o teste novo → PASS; depois `npx vitest run test/youtube/ab-detail-active.test.tsx test/ab-lab-detalhe-origem.test.tsx 2>&1 | tail -40`, ajustando só os asserts que descrevem o layout antigo, nunca removendo um comportamento coberto. `npx tsc --noEmit` limpo.
- [ ] **Passo 5:** commit `feat: M7d T3a selo do dia e InfoDica no cabeçalho`.

### T3b — Barra de ações de 44 px, Retomar no cabeçalho, estado "escrevendo" (~20K)

**Arquivos:**
- Modificar: `_components/acoes-de-saida.tsx`, `_components/detail-header-lab.css`, `_components/active-detail.tsx`, `_components/early-detail.tsx`, `_components/faixa-da-pagina.ts`, `[testId]/page.tsx`
- Teste: `apps/web/test/youtube/ab-m7d-barra.test.tsx` e `apps/web/test/youtube/ab-m7d-faixa-escrevendo.test.ts`; atualizar asserts de "Forçar rotação" no cabeçalho, "Configurações" e `data-section="acoes"` nos testes achados por `grep -rlE "Configurações|data-section=\"acoes\"|Forçar rotação" test`. Entram explicitamente no comando do passo 4: `test/youtube/ab-s8-f3-menores.test.tsx` (`data-section="acoes"`, linha 101) e `test/ab-lab-pagina-composicao.test.tsx` (Configurações, linha 89). Os testes de `ab-dashboard` e `ab-lab-dashboard-stubs` falam de outro "Configurações" (painel): conferir e não tocar.

**Interfaces:**
- **"Escrevendo" (Yannis I1):** `FaixaDaPagina` (faixa-da-pagina.ts) ganha `escrevendo: boolean`, calculado com o `agora` que a função já recebe: algum campo com `lerCampoDeRestauracao(c, agora).tipo === 'em_andamento'` (mesma régua da faixa: depois de `SEM_RESPOSTA_MIN = 5` min o campo vira "sem resposta" e deixa de ser "escrevendo"). `page.tsx` passa esse booleano a `renderView(view, { escrevendo })` (mock: `false`), **não** `emAndamentoDesde !== null`.
- Barra: `.dhl-acoes` abaixo do `.dhl-hd`, toda a largura, `margin-top: var(--s4)`. `AbrirNoYoutube` vira botão de contorno 44 px com `margin-left: auto` (classe `dhl-bt dhl-bt--yt`); sozinho (concluído) sem `margin-left: auto`. `@container (max-width:640px)`: `.dhl-acoes { display:grid; grid-template-columns:1fr 1fr }` e `.dhl-bt--yt { grid-column: 1 / -1 }`.
- Escrevendo: depois da barra, `<p id="apoio-acoes" role="status" className="dhl-apoio">Gravando no YouTube. Pausar e Encerrar voltam em instantes.</p>`.
- `BTN_SAIDA` ganha `min-h-[44px] px-[16px] text-cms-text` (contorno, sem fundo). Classe extra `dhl-bt--dest` (borda `--cn-accent`) no Encerrar só quando `freio.tipo === 'completo'`.
- `AcoesDeSaidaProps` ganha: `escrevendo?: boolean`; `retomar?: { executar: () => void; ocupado: boolean; bloqueado: boolean }`; `freio: FreioDoEncerrar` **obrigatório** (repassado ao diálogo, T4; o único chamador do diálogo é `AcoesDeSaida`, então não há ramo "diálogo de hoje"). Com `status === 'paused'` e `retomar` presente: botão "Retomar" (ícone `Play`) no lugar do Pausar; `bloqueado` → `aria-disabled="true"`. Com `escrevendo`: Pausar/Retomar e Encerrar com `aria-disabled="true" aria-describedby="apoio-acoes"` e clique sem efeito (não `disabled`, para continuar focável). O servidor continua sendo a guarda real (`emAndamentoRecente`, ab-settle.ts:621 e :758).
- `ActiveDetail`: passa `actions={<AcoesDeSaida … />}` ao `DetailHeader`; apaga o bloco `data-section="acoes"`, o botão "Configurações" e o Forçar rotação do cabeçalho (vai para a T5); o botão "Retomar Teste" da faixa de pausa comum sai (vai para o cabeçalho, mesma lógica de `retomar(view.restoreSeq)`). Deriva: `retomar` **não** é passado (Foco 2). `retomar.bloqueado = pausaTeste?.retomarDesabilitado === true`.
- `EarlyDetail`: também recebe `retomar` (uma linha em `page.tsx`), porque o selo passa a dizer "Pausado" e hoje só haveria "Encerrar" ao lado (Yannis M4).
- `freio` montado em ActiveDetail/EarlyDetail: `freioDoEncerrar({ dayOf: view.dayOf, durationDays: view.durationDays, medidos: contarDiasMedidos(view.faixa_dias) })`.
- **PlayoffDetail** continua com o cabeçalho antigo neste lote (Yannis M5): fica declarado como dívida (próximo lote do concluído), não é regressão.

- [ ] **Passo 1: testes que falham:**
  - Ordem no DOM: o botão "Pausar" vem antes do `[data-section="variant-performance"]` (`compareDocumentPosition`), e `getByTestId('abrir-no-youtube')` está dentro do `header`.
  - `queryByRole('button', { name: 'Configurações' })` nulo; nenhum "Forçar rotação" dentro do `header`.
  - `escrevendo`: Pausar e Encerrar com `aria-disabled="true"` e `aria-describedby="apoio-acoes"`; `#apoio-acoes` com `role="status"` e o texto exato; clicar Encerrar não abre `role="dialog"`. Com `escrevendo=false`, Pausar sem `aria-disabled`.
  - `faixaDaPagina` com campo `em_andamento` de 3 min atrás → `escrevendo: true`; de 6 min atrás → `escrevendo: false` (com `emAndamentoDesde` ainda preenchido). Os outros dois `return` de `faixaDaPagina` devolvem `escrevendo: false` explicitamente (Yannis N2).
  - Pausado comum com `retomar`: botão "Retomar" no cabeçalho; clicar chama a prop `retomar` com `view.restoreSeq`. EarlyDetail pausado também tem Retomar. Deriva: sem "Retomar" no cabeçalho, "Reconhecer e Retomar" presente (Foco 2). `pausaYoutube` com `retomarDesabilitado`: "Retomar" com `aria-disabled="true"` e clique não chama (Foco 3).
  - Encerrar com classe `dhl-bt--dest` só quando o freio é `completo` (`dayOf: 13, durationDays: 14` e `faixa_dias` com ao menos um dia `medido`); com `dayOf: 5` não tem a classe.
- [ ] **Passo 2:** `npx vitest run test/youtube/ab-m7d-barra.test.tsx test/youtube/ab-m7d-faixa-escrevendo.test.ts 2>&1 | tail -30` → FAIL.
- [ ] **Passo 3:** implementar como nas Interfaces; CSS (`.acoes`, `.bt`, `.acoes-apoio` do mockup).
- [ ] **Passo 4:** rodar os novos → PASS; depois `npx vitest run test/youtube/ab-detail-active.test.tsx test/ab-lab-detalhe-origem.test.tsx test/youtube/ab-s8-f3-tela-t5b.test.tsx test/youtube/ab-s8-f3-tela.test.tsx test/ab-lab-pausa-visivel.test.tsx test/youtube/ab-p4a-t15-ligacao.test.tsx test/youtube/ab-dia-tres-chamadores.test.tsx test/youtube/ab-s8-f3-menores.test.tsx test/ab-lab-pagina-composicao.test.tsx 2>&1 | tail -40`, ajustando só os asserts que descrevem o layout antigo (texto, lugar do botão), nunca removendo um comportamento coberto. `npx tsc --noEmit` limpo.
- [ ] **Passo 5:** commit `feat: M7d T3b barra de ações no cabeçalho e escrevendo pela régua da faixa`.

### T3c — Faixa do pausado: uma faixa só, com data (~12K)

Depende da T1 e da T1b. Hoje `faixaDaPagina` devolve, para teste pausado, `montarFaixa`, que com tudo ok diz "O título voltou ao original em 16:40." (faixa-restauracao-texto.ts:250-251); ligar a frase nova sem tocar nisso mostraria duas faixas (Yannis C1).

**Arquivos:**
- Modificar: `_components/active-detail.tsx` (faixa comum, linhas ~157-171), `_components/faixa-da-pagina.ts` (FaixaComAcoes, linhas ~30-36)
- Teste: `apps/web/test/youtube/ab-m7d-faixa-pausa.test.tsx`

**Interfaces:**
- `active-detail.tsx`: a faixa comum (fora da deriva e fora de `pausaYoutube`) usa `pausaTeste?.frase ?? fraseDaFaixaDePausa(view.flag, view.restoreStatus, view.pausedAt)`, com `role="status"`, no lugar de `'Teste pausado. Reconecte o token…'`; perde o botão "Retomar Teste" (já foi para o cabeçalho na T3b). A visão ativa já traz `restoreStatus` (ab-types.ts:581, queries.ts:1181) e o select já tem `paused_at` (Yannis r2).
- `faixa-da-pagina.ts`: com `status === 'paused'`, sem `pausaYoutube` e todos os campos do teste `ok` com `destino === 'original'`, devolver `faixa: null`. Assim a faixa da pausa é a única. Com falha em algum campo, a FaixaComAcoes continua, com o "Tentar agora" (e a frase da pausa diz só "Nenhum dia novo entra no placar.").

- [ ] **Passo 1: testes que falham:** `faixaDaPagina` com pausado + ok/original → `faixa === null`; com `falhou` → faixa presente. Componente: pausado comum de título com restauração ok e `pausedAt = '2026-10-25T19:40:00Z'` mostra exatamente "Você pausou em 25/10 às 16:40. O título original foi restaurado e nenhum dia novo entra no placar." e há **um único** `role="status"` de faixa; `pausedAt` nulo → sem a data; restauração `falhou` → "Nenhum dia novo entra no placar." mais a FaixaComAcoes; pausado por deriva com restauração ok → só a faixa de deriva aparece (Yannis N3).
- [ ] **Passo 2:** `npx vitest run test/youtube/ab-m7d-faixa-pausa.test.tsx 2>&1 | tail -30` → FAIL.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** rodar → PASS; rodar de novo `test/youtube/ab-detail-active.test.tsx test/ab-lab-pausa-visivel.test.tsx` e os testes de faixa de restauração achados por `grep -rl "faixaDaPagina" test`.
- [ ] **Passo 5:** commit `feat: M7d T3c faixa do pausado única com data da pausa`.

### T4 — Diálogos: freio no Encerrar, texto da Pausa (~25K)

**Arquivos:**
- Modificar: `_components/ab-end-test-dialog.tsx`, `_components/ab-end-test-dialog.css`, `_components/ab-pause-dialog.tsx`, `_components/acoes-de-saida.tsx`
- Teste: `apps/web/test/youtube/ab-m7d-dialogos.test.tsx`; atualizar asserts de texto em `test/youtube/ab-end-test-dialog.test.tsx`, `test/ab-end-test-dialog-titulo.test.tsx`, `test/youtube/ab-s8-f4-encerrar-v2.test.tsx`, `test/youtube/ab-dialog-foco-portal-real.test.tsx`, **`test/cms/ab-pause-dialog.test.tsx` e `test/youtube/ab-pause-dialog.test.tsx`** (afirmam "restaurar a miniatura original", quebram com o texto novo e a prop `flag` obrigatória).

**Interfaces:**
- `AbEndTestDialogProps` ganha `freio: FreioDoEncerrar` **obrigatório** (sem ramo "diálogo de hoje"; o único chamador é `AcoesDeSaida`). `AbPauseDialog` ganha `flag: TestType` obrigatória.
- Encerrar (textos do mockup): `<h2>` "Encerrar o teste?"; `legend` "Qual versão fica no vídeo?"; selo da opção "No ar agora".
- Freio no topo do corpo: tipos `sem_leitura`/`faltam`/`falta_1` → `<div className="etd-freio{sem_leitura ? ' sem' : ''}" role="status">{ícone}<span>{freio.texto}</span></div>` (ícone info para sem_leitura, aviso para os outros); `completo` → `<p className="etd-state">{freio.texto}</p>` sem `role="status"`. CSS `.etd-freio` copiado do mockup.
- Pré-marcação: estado inicial de `escolhida` = id da opção cujo rótulo é o "no ar agora" (mesmo predicado do selo: `o.rotulo === noArAgora.rotulo || o.rotulo === \`${noArAgora.rotulo} (original)\``); nenhuma outra. Quando há pré-marcada, linha `<p className="etd-state">A versão no ar já vem marcada; troque só se quiser.</p>` abaixo da legenda. Quem não administra: continua valendo `escolhaEfetiva` = original (Foco 5).
- Botão de confirmar: `etd-btn pri` só se `freio.tipo === 'completo'`; senão `etd-btn` (contorno). Rótulo segue "Encerrar e ficar com {rótulo}".
- Pausa: primeiro parágrafo = `textoDoDialogoDePausa(flag)`.
- `AcoesDeSaida` passa `freio` e `flag={view.flag}`.

- [ ] **Passo 1: testes que falham:** g1 (`freio` sem_leitura) mostra o texto exato com `role="status"`; g2 mostra "Faltam 8 dias dos 14. Encerrar agora usa só os 5 dias já medidos."; g3 "Falta 1 dia."; g4 mostra "Todos os 14 dias foram medidos.", nenhum `role="status"` de freio e o botão com classe `pri`; nos outros três o botão **não** tem `pri`. A opção no ar vem `checked` e só ela; com `noArAgora.rotulo = 'B'` e `podeDeixarVariante=false`, a original fica marcada (Foco 5). Foco inicial continua no "Cancelar"; Esc fecha e devolve o foco ao botão Encerrar (reaproveitar o padrão de `ab-dialog-foco-portal-real.test.tsx`). Pausa: `flag='title'` → "Pausar vai restaurar o título original imediatamente."; `flag='combo'` → texto do combo.
- [ ] **Passo 2:** `npx vitest run test/youtube/ab-m7d-dialogos.test.tsx 2>&1 | tail -30` → FAIL.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** rodar o novo e os seis listados acima (`test/youtube/ab-end-test-dialog.test.tsx test/ab-end-test-dialog-titulo.test.tsx test/youtube/ab-s8-f4-encerrar-v2.test.tsx test/youtube/ab-dialog-foco-portal-real.test.tsx test/cms/ab-pause-dialog.test.tsx test/youtube/ab-pause-dialog.test.tsx`) → PASS (atualizar só textos que o mockup trocou).
- [ ] **Passo 5:** commit `feat: M7d T4 freio do Encerrar no diálogo e texto da pausa por tipo`.

### T5 — Forçar rotação no bloco de rotação, com diálogo `.etd` (~20K)

Sobe junto com a T3b (ver Restrições globais).

**Arquivos:**
- Criar: `_components/forcar-rotacao.tsx`
- Modificar: `_components/active-detail.tsx` (cabeçalho do cartão "Rotação ABBA")
- Teste: `apps/web/test/youtube/ab-m7d-forcar-rotacao.test.tsx`

**Interfaces:**
```ts
export function ForcarRotacao(p: { testId: string; atual: DisplayLabel | null; proxima: DisplayLabel | null; escrevendo: boolean; forcar: (testId: string) => Promise<ResultadoAcaoSaida> }): JSX.Element
```
- Botão "Forçar rotação" (ícone `RefreshCw`, `BTN_SAIDA`, 44 px; `@container (max-width:640px)` 100% de largura) abre `AbConfirmarDialog` com `titulo="Forçar rotação agora?"`, `lead="A versão atual será trocada no YouTube agora."`, `nota` = "A versão {atual} sai do ar e a {proxima} entra. O ritmo normal da rotação continua depois disso." quando `atual` e `proxima` existem e diferem, senão "O ritmo normal da rotação continua depois disso."; `rotuloConfirmar="Forçar rotação"`. Confirmar: `enviando` true, chama `forcar(testId)`; `ok` → `router.refresh()` e fecha; recusa → `erro = r.error` no diálogo (sem `alert`). Foco volta ao botão ao fechar.
- `escrevendo`: botão `aria-disabled="true" aria-describedby="apoio-rot"` + `<p id="apoio-rot" role="status">Gravando no YouTube. A rotação volta em instantes.</p>`; clique sem efeito.
- Em `ActiveDetail`: no cabeçalho do cartão, à direita, `canAdminSite ? <ForcarRotacao testId={view.id} atual={view.activeNow} proxima={view.proximaNaRotacao} escrevendo={!!escrevendo} forcar={forceRotate} /> : <AdminOnlyNote action="forçar rotação" … />`. **A "próxima" vem de `view.proximaNaRotacao` (T1b), a mesma conta de `forceRotate`; nunca de `abbaSeq[done]`** (esse é o ciclo atual). Com `random` (`proximaNaRotacao === null`) a nota fica genérica. Pausado: sem botão e a linha "A rotação está parada enquanto o teste está pausado." no corpo do cartão.

- [ ] **Passo 1: testes que falham:** clicar abre `role="dialog"` com o título e a nota exatos (`atual='A', proxima='B'` → "A versão A sai do ar e a B entra. …"); `proxima=null` → nota genérica; `window.confirm` nunca é chamado (`vi.spyOn(window, 'confirm')`); confirmar chama `forcar('t1')` uma vez; recusa `{ ok:false, resultado:'erro', error:'x' }` mostra "x" no diálogo; `escrevendo` → `aria-disabled` e `#apoio-rot` com `role="status"`. Em `ActiveDetail`: o `proxima` repassado é `view.proximaNaRotacao`; sem admin → nenhum "Forçar rotação" (Foco 5); pausado → texto da rotação parada e sem botão.
- [ ] **Passo 2:** `npx vitest run test/youtube/ab-m7d-forcar-rotacao.test.tsx 2>&1 | tail -30` → FAIL.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** rodar → PASS; rodar de novo `test/youtube/ab-detail-active.test.tsx`.
- [ ] **Passo 5:** commit `feat: M7d T5 forçar rotação no bloco de rotação com diálogo`.

### T6 — Placar: título da versão em até 2 linhas (~8K)

**Arquivos:**
- Modificar: `_components/placar-do-teste.css` (linhas 52 e 71)
- Teste: `apps/web/test/youtube/ab-m7d-placar-css.test.ts` (contrato do CSS; espelha a implementação, a prova real é a T8a.6)

Regras: `.pm4-vt b { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; white-space: normal; overflow-wrap: anywhere; }` (sem `text-overflow: ellipsis` nem `nowrap`); no `@container (max-width: 640px)` o clamp vira 5. O `title=` da linha continua (texto inteiro no passar do mouse).

- [ ] **Passo 1:** teste lê o CSS e afirma `-webkit-line-clamp: 2` na regra base de `.pm4-vt b`, `-webkit-line-clamp: 5` dentro do bloco de 640 px, e ausência de `text-overflow: ellipsis` na regra de `.pm4-vt b`.
- [ ] **Passo 2:** rodar → FAIL. **Passo 3:** editar o CSS. **Passo 4:** rodar → PASS.
- [ ] **Passo 5:** commit `feat: M7d T6 título da versão no placar em até 2 linhas`.

### T7 — Concluído: cabeçalho do Lab, Arquivar mantido, "Ficou no ar" no WinnerDetail (~13K)

**Arquivos:**
- Modificar: `_components/winner-detail.tsx`, `_components/winner-banner.tsx` (prop `semLinhaNoAr`), `_components/placar-do-teste.tsx` (prop opcional `noArLetra?: string | null`), `_components/concluido-v2-detail.tsx` (só o selo/barra, **sem** a linha "Ficou no ar")
- Teste: `apps/web/test/youtube/ab-m7d-concluido.test.tsx`

**Interfaces:**
- Fonte: **só** `view.noAr` (`AbTestWinnerView.noAr`, montado em queries.ts:1402 a partir de `noArDoTeste`/`noArConfirmado`). Nada de `winnerLabel`, `tela.noAr` ou `activeNow`.
- `WinnerDetail`: cabeçalho passa a usar `lab={{ thumbUrl, concluidoEm }}` (selo "Concluído em DD/MM", `concluidoEm = dataCurtaSp(view.completedAt).slice(0, 5)` como no ConcluidoV2Detail). A frase `linhaFicouNoAr(view.noAr, concluidoEm)` num `<p className="pm4-sum" data-testid="ficou-no-ar">` quando não nulo **substitui** a linha "No ar agora" do `WinnerBanner` (prop `semLinhaNoAr`, passada quando a frase é mostrada), não a soma. Quando `noAr.letra` é nulo, o banner mantém o "No ar: não confirmado" de hoje.
- `ConcluidoV2Detail`: **não** ganha a linha "Ficou no ar". O "no ar" dessa tela continua sendo o do `DesfechoV2` (uma fonte por tela; D28 não se paga aqui, Yannis I4). Só muda o cabeçalho/barra.
- `PlacarDoTeste`: com `noArLetra`, a linha dessa letra ganha `<span className="etd-badge">No ar</span>` ao lado do "· original"/título. `WinnerDetail` passa `noArLetra={view.noAr?.letra ?? null}`; `ConcluidoV2Detail` não passa.
- **Barra do concluído (decisão do dono):** `Arquivar` (contorno, 44 px, à esquerda, mantém o `confirm()` e a `archiveAbTest` de hoje) + "Abrir no YouTube" à direita. **Duplicar e Download saem.**
- Dívida declarada: D28 segue aberta no `DesfechoV2` (gatilho: qualquer caminho que grave `restore_status` ok sem vencedor e sem escolha, ou a migração do concluído v2 para a fonte única); PlayoffDetail com cabeçalho antigo (gatilho: próximo lote do concluído).

- [ ] **Passo 1: testes que falham:** WinnerDetail com `noAr: { letra: 'B', original: false }` → `ficou-no-ar` = "O teste terminou em 24/10. Ficou no ar: a versão B." **uma vez**, "No ar agora" não aparece, e o selo "No ar" na linha B do placar; `noAr: { letra: null, original: false }` → sem `ficou-no-ar`, sem selo "No ar" e o banner mostra "No ar: não confirmado" (D28: não inventa); `winnerLabel: 'C'` com `noAr.letra: 'A'` → a frase diz A (a fonte é o noAr, não o vencedor); selo "Concluído em 24/10"; sem ⓘ; **com "Arquivar"** (clicar chama `archiveAbTest` após o `confirm`); sem "Duplicar" e sem o botão "Download". ConcluidoV2Detail: renderiza no máximo um texto que case com `/no ar/i` fora do placar e **não** contém `data-testid="ficou-no-ar"`.
- [ ] **Passo 2:** `npx vitest run test/youtube/ab-m7d-concluido.test.tsx 2>&1 | tail -30` → FAIL.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** rodar → PASS; rodar `grep -rlE "WinnerDetail|ConcluidoV2Detail|WinnerBanner" test | xargs npx vitest run 2>&1 | tail -40` e ajustar só asserts de layout.
- [ ] **Passo 5:** commit `feat: M7d T7 concluído com cabeçalho do Lab, Arquivar mantido e Ficou no ar`.

### T8a — Prova no navegador, local (Gio, Sonnet) (~25K) — BLOQUEIA O MERGE

Não é código de produto. O Gio sobe o app local autenticado (`docs/ops/runbook-cms-e2e-local.md`) com testes em cada estado (semente ou mocks `mock-active-1`, `mock-completed-1`, e um teste pausado e um "escrevendo" via `restore_status` em andamento no banco local) e devolve veredito em texto, capturas em `.superpowers/sdd/ab-lab/m7d/gio-shots/`:
1. 1440 e 390: bordas esquerda e direita do cabeçalho, frase, placar, dias e rotação iguais (diferença ≤ 1 px, medida por `getBoundingClientRect`); coluna encostada à esquerda, recuo 24/16 px; sem rolagem horizontal no 390.
2. Selo "Rodando · dia X de Y"; barra abaixo do selo; Abrir no YouTube à direita (1440) e na linha de baixo (390); todos os alvos ≥ 44 px; **Encerrar visível sem rolar a 1440**.
3. Encerrar nos estados a, b, dia 13 e dia 14: textos de g1–g4, opção no ar marcada, foco inicial no Cancelar, Tab preso, Esc fecha e devolve o foco ao Encerrar; nenhum botão cheio antes do fim.
4. Forçar rotação: diálogo `.etd`, nenhum `confirm()` nativo; Esc e devolução de foco; a nota cita a versão que o servidor de fato põe no ar.
5. ⓘ: balão flutuante sem deslocar a página (posição do placar igual antes e depois de abrir), Esc fecha.
6. Placar 1440 com título longo: 2 linhas, sem "…"; 390: até 5.
7. Escrevendo: botões com `aria-disabled`, linha `#apoio-acoes` anunciada; volta sozinho quando a escrita termina (`AtualizarEnquantoEmAndamento`); com a escrita parada há mais de 5 min o selo e os botões voltam ao normal.
8. Concluído (local, sem comparar com o YouTube): "Ficou no ar: a versão X" igual à letra de `view.noAr` e ao selo "No ar" do placar; com `noAr` não confirmado, a frase não aparece; Arquivar presente, sem Duplicar e Download.
9. Pausado comum de título (banco local, escrita simulada): **uma única faixa**, "Você pausou em DD/MM às HH:MM. O título original foi restaurado e nenhum dia novo entra no placar."; com `paused_at` nulo a frase não traz data; Retomar no cabeçalho.

### T8b — Prova com vídeo real, depois da promoção (Gio, Sonnet) (~5K)

Em produção, só leitura e sem escrita, num teste real do dono:
- "Ficou no ar: a versão X" é igual ao que o YouTube mostra no vídeo; na mesma tela, nenhum cartão diz outra letra.
- A prova de que pausar devolve só o título no YouTube **não** usa um teste real dele: fica no banco local com escrita simulada (T8a.9) e, em produção, só quando o dono pausar um teste por conta própria. Não segura o merge.

### T9 — Verificação final (~10K)

- [ ] `npx tsc --noEmit 2>&1 | tail -20` limpo.
- [ ] Suíte completa em arquivo: `npx vitest run > /tmp/m7d-vitest.txt 2>&1; grep -E "FAIL|Test Files" /tmp/m7d-vitest.txt | head -30` (≈160 s; em background se passar de 4 min).
- [ ] Revisão proporcional ao risco: **Yannis** revisa o diff (módulo puro, visão, faixa, diálogos, CSS). **Naksu e Logan** revisam juntos, num só despacho, as capturas da T8a contra o mockup (sem reler o código), incluindo a divergência do botão Arquivar no concluído (estado f).

---

## Fatia mínima (nota de corte, Hanna)

Se o envio precisar encolher: T1 (sem `linhaFicouNoAr`), T1b, T2, T3a, T3b, T3c, T4, T5 e T6. Essa fatia responde ao D17 inteiro (largura única e Encerrar no topo). Sai a T7 inteira (concluído com cabeçalho do Lab e "Ficou no ar"); gatilho para voltar: D28 resolvido ou um envio seguinte com folga. **Não cortar a T4**: sem ela o Encerrar sobe para o topo sem o freio, o que piora o risco de encerrar cedo. **Não cortar a T5**: sem ela a T3b tira a ação do administrador. O dono vê valor quando a promoção sair: a página do teste com uma largura só e o Encerrar no topo.

## Riscos

- D28 continua aberto no `DesfechoV2` (lê `tela.noAr`). Por isso o `ConcluidoV2Detail` não ganha a linha "Ficou no ar" e o `WinnerDetail` não soma a linha ao banner (a substitui): cada tela tem uma fonte só de "no ar". Sem caminho conhecido que crie a combinação (Gio G5).
- Muitos testes antigos descrevem o layout de hoje (botões depois do placar, "Teste do Lab rodando"); a regra é ajustar o texto/lugar, nunca apagar o comportamento coberto.
- Os testes de contrato de CSS (T2, T6) espelham a implementação e não provam o desenho; a prova real é a T8a.1 e a T8a.6.

## Backlog / dívida (fora deste lote)

- Trocar o `confirm()` do Arquivar e o `alert` do Retomar por `AbConfirmarDialog`. Gatilho: próxima mexida no concluído ou no Retomar.
- Arquivar a partir da lista; Arquivar no `playoff-detail` com o mesmo padrão. Gatilho: o dono pedir, ou a próxima mexida no playoff.
- PlayoffDetail com cabeçalho antigo (divergência nova de aparência). Gatilho: próximo lote do concluído.
- D28 no `DesfechoV2` (ver Riscos).
