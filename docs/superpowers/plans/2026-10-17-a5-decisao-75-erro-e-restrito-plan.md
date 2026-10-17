# Decisão 75: pastilhas "falhou" e "restrito" (plano de implementação)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Falha de leitura e acesso negado deixam de aparecer como "não medido": erro vira a pastilha **falhou** (triângulo), negado vira **restrito** (cadeado), em todas as telas do Observatório e no pacote da IA.

**Architecture:** Um tipo só, `EstadoAusencia = 'nao_medido' | 'falhou' | 'restrito'`, nasce nos modelos (que hoje só devolvem texto) e viaja até a tela; o renderizador escolhe a forma pelo `estado`, nunca pelo texto. Um módulo de componentes em `_chrome/ausencia/` desenha as três formas e o botão "Tentar de novo" com três estados. "Não carregou" some do produto no mesmo commit em que as frases passam a "A leitura falhou:".

**Tech Stack:** Next.js 16 (Server Components + um client component), React 19, TypeScript strict, Vitest (node/jsdom), Playwright (Gio).

**Spec:** decisão 75 do dono (`.superpowers/sdd/a5/decisoes-do-dono.md:141`) + mockup aprovado "por agora" (17/10) `docs/superpowers/mockups/2026-10-17-decisao-75-erro-e-restrito/` (`index.html`, `INVENTARIO.md` = lista de pontos A1–D3 citada abaixo, `RODADA-2.md`) + pareceres `.superpowers/sdd/a5/noite/t7-cg-logan.md` e `t7-cg-naksu.md` (rodadas 1 e 2).

Abreviação: `C/` = `apps/web/src/app/cms/(authed)/youtube/competitors/`; `T/` = `apps/web/test/youtube/observatorio/`; `L/` = `apps/web/src/lib/youtube/observatorio/`. Números de linha são de `~/Workspace/wt-trem7` (365b60094 + trem 7) e servem para achar, não para colar.

## Global Constraints

- Rótulos visíveis, minúsculos, uma palavra: `não medido`, `falhou`, `restrito`. Nunca "leitura falhou", "teste A/B restrito", "sem acesso" ou "Não carregou" **na pastilha**; o complemento vai na frase (Logan R1).
- Frases que começavam com "Não carregou:" passam a **"A leitura falhou:"** no MESMO commit da troca do rótulo (Logan R2). Chaves internas `nao_carregou` ficam.
- Restrito: chapa lisa neutra + cadeado, **sem vermelho e sem cor nova** (Naksu 4). Falhou: contorno `--danger` + triângulo + palavra. Não medido: a hachura atual (`.obs-ch-nm`), intocada.
- Tokens só em hex/rgba literais, nunca `color-mix()`. Novos, em `C/_chrome/tokens-telas.css`: escuro `--res-bg:#16130F;--res-line:#A89D88;--res-ink:#F5EFE6`; claro `--res-bg:#F2EBDF;--res-line:#5E5240;--res-ink:#231C14`. Falhou usa os já existentes `--danger` e `--danger-subtle` de `C/_chrome/chrome.css` (não redefinir).
- Contrastes mínimos que o teste recalcula: borda/cadeado do restrito × `--surface` ≥ 3 (medido 6,18 escuro / 7,13 claro); texto do restrito × `--res-bg` ≥ 4,5; triângulo/contorno do falhou × fundo composto da pastilha ≥ 3 (medido ~4,8 / ~5,4). O preenchimento `--res-bg` é decoração (1,1:1) e não entra no teste.
- Texto ≥ 12 px. Pastilha: `font:500|600 12px/16px`, `padding:1px 7px 1px 5px`, ícone 14 px, `white-space:nowrap`. Quadradinho: 18×18, ícone 12×12, `role="img"`, `aria-label` = `title` = rótulo.
- "Tentar de novo": FORA da pastilha, **um por bloco** (nunca por célula), `min-height:44px; min-width:132px; padding:0 12px`, borda `--muted` (3:1, sugestão Naksu R2 acatada), linha com `flex-wrap` (embaixo no 390, ao lado no 1440).
- Regra F1: onde há botão, a frase não manda recarregar; onde não há, a frase diz "recarregue a página". Nunca as duas. Botão só no canal de fora (blocos que já repetem leitura).
- Avisos de lista: `role="status"` UMA vez por bloco/lista; zero `role="alert"` nas pastilhas.
- Canal de fora nunca mostra restrito (só dado público).
- Pacote da IA: dado negado nunca vira zero; células escrevem `falhou (motivo)` / `restrito (motivo)` com as mesmas palavras da tela.
- Commits: `tipo: descrição (decisão 75)`, `git add` por caminho, sem `--no-verify`; teste que fixa texto ou classe muda no MESMO commit (INVENTARIO D2).

## Review Focus

1. **Estado misto no mesmo canal próprio** (alcance negado, diário ok, ou alcance erro e diário negado): cada célula mostra a forma do SEU estado; a frase de cima não funde restrito sob "Não medido:". Teste em Task 3 (`motivoDasCelulas` com mistura).
2. **Leitor de tela numa tabela de 20 vídeos com alcance falhou**: um anúncio só (uma `role="status"` por lista), não 40. Teste em Task 6.
3. **Tentar de novo com a rede caída**: `router.refresh()` termina sem trocar `falhou` → estado (b) "Falhou de novo…", botão volta a funcionar, nunca fica preso em "Tentando…". Teste em Task 2.
4. **Escala de cinza / daltonismo**: as três formas se distinguem sem cor (hachura × triângulo × cadeado + palavra). Teste em Task 1 (cada forma tem glifo ou classe de hachura distinta) e conferência do Gio (Task 10, modo cinza).
5. **Negado sem dado algum no pacote da IA ou na tela** (`acesso:'negado'`, `dado` vazio): nunca `0`, nunca caixa de zero medido. Testes em Task 4 (A23) e Task 9.

---

### Task 1: Módulo `_chrome/ausencia/` (tipo, glifos, pastilhas, CSS, tokens)

**Files:**
- Create: `C/_chrome/ausencia/estado.ts`, `C/_chrome/ausencia/glifos.ts`, `C/_chrome/ausencia/pastilhas.tsx`, `C/_chrome/ausencia/ausencia.css`
- Modify: `C/_chrome/tokens-telas.css` (tokens `--res-*`, escuro e claro), `C/_proprio/origem-glifos.tsx:21,23` (`lock`/`aviso` passam a ler de `glifos.ts`)
- Test: `T/ausencia-estado.test.ts` (node), `T/ausencia-pastilhas.test.tsx` (jsdom), `T/ausencia-css.test.ts` (node)

**Interfaces:**
- Produces (`estado.ts`, sem React, importável por modelo):
  - `export type EstadoAusencia = 'nao_medido' | 'falhou' | 'restrito'`
  - `export const ROTULO_AUSENCIA: Record<EstadoAusencia, string>` = `{ nao_medido: 'não medido', falhou: 'falhou', restrito: 'restrito' }`
  - `export function ausenciaDoAcesso(a: 'ok' | 'negado' | 'erro'): EstadoAusencia | null` (ok→null, negado→restrito, erro→falhou)
  - `export function ausenciaDoMotivoVpd(m: MotivoSemVpd | null): EstadoAusencia | null` (`L/proprio/vpd.ts`: sem-acesso→restrito, leitura-falhou→falhou, null→null, resto→nao_medido)
  - `export function ausenciaDoMotivoNaoMedido(m: MotivoNaoMedido): EstadoAusencia` (`L/medidas/tipos.ts`: `sem_permissao`→restrito; `leitura_falhou`,`calculo_falhou`→falhou; resto→nao_medido). Switch exaustivo sobre `MOTIVOS_NAO_MEDIDO`.
- Produces (`glifos.ts`): `CAMINHO_AVISO`, `CAMINHO_CADEADO` (as strings de `origem-glifos.tsx` hoje em `aviso`/`lock`).
- Produces (`pastilhas.tsx`, servidor): `export function PastilhaAusencia(p: { estado: EstadoAusencia; motivo?: string; quadradinho?: boolean; texto?: string }): JSX.Element`
  - `nao_medido`: `<span class="obs-ch-nm">{texto ?? 'não medido'}</span>` (quadradinho: a classe `nm-q` existente com `role="img"`).
  - `falhou`: `<span class="obs-au obs-au-falhou" title={motivo}><svg aria-hidden>{aviso}</svg>falhou<span class="obs-md-sr">: {motivo}</span></span>`; `restrito` igual com `obs-au-restrito` e cadeado.
  - quadradinho de falhou/restrito: `<span class="obs-au-q obs-au-falhou|restrito" role="img" aria-label=rótulo title=rótulo>` só com o ícone.
  - Nenhuma `role` na pastilha com texto.

- [ ] **Step 1: testes que falham.** `ausencia-estado.test.ts`: `ausenciaDoAcesso` nos três valores; `ausenciaDoMotivoVpd` para os 7 `MotivoSemVpd` e `null`; `ausenciaDoMotivoNaoMedido` cobre TODO `MOTIVOS_NAO_MEDIDO` (`for (const m of MOTIVOS_NAO_MEDIDO)` — só os três citados fogem de `nao_medido`). `ausencia-pastilhas.test.tsx`: cada estado renderiza a palavra de `ROTULO_AUSENCIA`; falhou contém `CAMINHO_AVISO`, restrito `CAMINHO_CADEADO`, não medido nenhum dos dois (Review Focus 4); `motivo` vai em `title` e no `.obs-md-sr`; quadradinho tem `role="img"`, `aria-label` = `title` = rótulo; nenhum `role="alert"` em nenhuma saída. `ausencia-css.test.ts` (modelo: `T/regua-css.test.ts`, funções `lum`/`contraste`): sem `color-mix`; nenhuma fonte < 12 px; os seis `--res-*` existem nos dois temas; contrastes da seção Global Constraints recalculados (o fundo do falhou é `--danger-subtle` composto sobre `--surface`); `.obs-au-retry` tem `min-height:44px`.
- [ ] **Step 2:** `cd apps/web && npx vitest run T/ausencia-estado.test.ts T/ausencia-pastilhas.test.tsx T/ausencia-css.test.ts > /tmp/d75-t1.txt 2>&1; tail -30 /tmp/d75-t1.txt` → FAIL (módulos não existem).
- [ ] **Step 3: implementar** os quatro arquivos e os tokens. CSS copia `.er`, `.rs`, `.q`, `.retry`, `.retry-row`, `.estado-val` do `index.html` (linhas 66–88), renomeados para `obs-au`, `obs-au-falhou`, `obs-au-restrito`, `obs-au-q`, `obs-au-retry`, `obs-au-retry-row`, `obs-au-val`, todos sob `[data-obs]`. Borda do `.obs-au-retry`: `var(--muted)`; `aria-disabled="true"` → borda tracejada e `cursor:progress`.
- [ ] **Step 4:** mesmo comando → PASS.
- [ ] **Step 5: commit** `feat: pastilhas falhou e restrito, módulo de ausência (decisão 75)` com os 7 caminhos.

### Task 2: `TentarDeNovo` com três estados (client)

**Files:**
- Create: `C/_chrome/ausencia/tentar-de-novo.tsx` (`'use client'`)
- Test: `T/ausencia-tentar-de-novo.test.tsx` (jsdom, `vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))`)

**Interfaces:**
- Produces: `export function BlocoComTentativa(p: { falhou: boolean; fraseFalha: string; children: ReactNode }): JSX.Element`
  - Sempre renderizado no MESMO lugar da árvore nos dois ramos (falhou e ok): é o que preserva o estado do cliente através do `router.refresh()`.
  - `falhou && !tentando && tentativas===0`: `children` + linha `obs-au-retry-row` com `<p role="status">{fraseFalha}</p>` + botão "Tentar de novo".
  - tentando (via `useTransition`): botão `aria-disabled="true"` `aria-busy="true"` texto `Tentando…`, frase `Lendo as medidas de novo…`; clique repetido ignorado. Usar `aria-disabled`, não `disabled` (o foco fica no botão).
  - terminou e `falhou` continua: frase `Falhou de novo. Confira a conexão e tente mais uma vez.`, botão volta a `Tentar de novo`.
  - terminou e `falhou` virou `false` após ≥1 tentativa: sem botão; `<p role="status" aria-live="polite">Medidas lidas agora.</p>`; foco no primeiro `[data-valor]` dentro de `children` (o elemento recebe `tabIndex=-1`).
  - `!falhou` sem tentativa: só `children`, nada mais.

- [ ] **Step 1: testes.** `estado parado mostra botão e frase`; `clique chama refresh uma vez e mostra Tentando…` (`aria-busy`, `aria-disabled`, segundo clique não chama de novo); `rerender com falhou=true após a transição mostra "Falhou de novo. Confira a conexão e tente mais uma vez."` (Review Focus 3); `rerender com falhou=false foca [data-valor] e mostra "Medidas lidas agora."`; `falhou=false sem tentativa não tem role=status nem botão`; nenhum `role="alert"`.
- [ ] **Step 2:** `npx vitest run T/ausencia-tentar-de-novo.test.tsx > /tmp/d75-t2.txt 2>&1` → FAIL.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5: commit** `feat: Tentar de novo com três estados (decisão 75)`.

### Task 3: Fonte do estado no alcance e nas views por dia do canal próprio (A2, A6, A7, A9, A17, A18)

**Files:**
- Modify: `C/_proprio/videos-model.ts:31,88-95,176-189`, `C/_proprio/header-model.ts:36,79-80,375-385`, `C/_proprio/reguas-model.ts:151,277`, `C/_proprio/impressoes-model.ts:108,178-182`, `C/_proprio/como-esta-model.ts:56,95-156`
- Test: `T/proprio-videos-model.test.ts`, `T/proprio-13-3-cabecalho.test.ts`, `T/proprio-impressoes-model.test.ts`, `T/proprio-como-esta.test.ts` (acrescentar casos; nenhum texto existente muda nesta task)

**Interfaces:**
- Consumes: `EstadoAusencia`, `ausenciaDoAcesso`, `ausenciaDoMotivoVpd` (Task 1).
- Produces (campos ADITIVOS; os de texto ficam como motivo):
  - `ProprioVideoView`: `impEstado`, `cliquesEstado`, `vpdDiarioEstado: EstadoAusencia | null` (null ⇔ há número ou zero medido).
  - `ProprioVideosView.motivoAlcanceEstado: EstadoAusencia | null`; `viewsPorDiaEstado: EstadoAusencia | null`.
  - `ProprioCell.ausencia: EstadoAusencia | null`.
  - `reguas-model`: a linha de impressões ganha `ausencia: EstadoAusencia | null`.
  - `impressoes-model` view: `vazioEstado: EstadoAusencia | null` (SEM_PERMISSAO→restrito, ERRO_ALCANCE→falhou, outros vazios→nao_medido).
  - `como-esta-model`: cada frase de vazio (`frase`, `topVazio`, `taxa.vazio`) ganha o seu `…Estado: EstadoAusencia | null`.
- `motivoDasCelulas(cs)` passa a agrupar por `c.ausencia`, não por `startsWith('só quem edita')`: restrito → frase própria capitalizada; falhou → frase própria capitalizada; só `nao_medido` entra em "Não medido: …. Nenhum destes números é zero, só falta medir.".

- [ ] **Step 1: testes.** videos: `alcance negado → impEstado e cliquesEstado 'restrito' em todo vídeo`; `alcance erro → 'falhou'`; `sem-relatorio e nada-lido → 'nao_medido'`; `vídeo novo e zero medido → impEstado null quando semImpressao`; `diário negado → vpdDiarioEstado 'restrito' e viewsPorDiaEstado 'restrito'`. header: `motivoDasCelulas com uma célula restrito, uma falhou e uma nao_medido` → três frases separadas, e a de erro NÃO aparece depois de "Não medido:" (Review Focus 1). impressões/como-está: `negado → vazioEstado 'restrito'`, `erro → 'falhou'`.
- [ ] **Step 2:** rodar os 4 arquivos com saída em `/tmp/d75-t3.txt` → FAIL.
- [ ] **Step 3:** implementar. Em `videos-model.ts`, `palavraDaColuna` vira `colunaSemNumero(e): { palavra: string; estado: EstadoAusencia }` (switch exaustivo mantido: negado→restrito, erro→falhou, sem-relatorio/nada-lido→nao_medido).
- [ ] **Step 4:** → PASS; `npx tsc --noEmit -p apps/web` sem erro novo.
- [ ] **Step 5: commit** `feat: estado tipado de ausência no alcance e nas views por dia (decisão 75)`.

### Task 4: Fonte do estado na página do vídeo e nas trocas + guarda A23 (A10, A12, A15, A21, A22, A23)

**Files:**
- Modify: `C/_proprio/assistido-periodo-model.ts:36,92-93,128-131`, `C/_proprio/retencao-curva-model.ts:56-57,104`, `C/_proprio/video-blocos-model.ts:143-146,392-401`, `C/_proprio/trocas-model.ts:18,44,64,117-124`
- Create: `T/decisao-75-sem-colapso.test.ts`
- Test: `T/proprio-assistido-periodo-model.test.ts`, `T/proprio-video-blocos-model.test.ts`, `T/proprio-t8-modelo.test.ts`

**Interfaces:**
- Produces:
  - `CartaoAssistido.ausencia: EstadoAusencia | null`; para `sem-acesso`/`leitura-falhou`, `semNumero` passa a `'restrito'`/`'falhou'` (era "sem acesso"/"não conseguimos ler"); a `legenda` (TEXTO_NEGADO/TEXTO_ERRO) não muda. `acima-do-teto`, `cobertura-parcial` → `nao_medido`.
  - `RetencaoView.rotulo: 'não medido' | 'falhou' | null` é SUBSTITUÍDO por `ausencia: EstadoAusencia | null` (`nao-coletada`,`sem-curva`→nao_medido; `erro`→falhou; `negado`→**restrito**; `coletada`→null).
  - `video-blocos-model`: a nota privada expõe `ausencia` derivada de `acesso` (já separado).
  - `trocas-model`: `Chip` mantém `'leitura-falhou'` como chave, mas `TrocaView.ausencia: 'falhou' | null` (o chip `leitura-falhou` é desenhado como pastilha falhou na Task 6); `teste: { href } | 'sem-acesso'` continua, e a frase do restrito é a constante nova `FRASE_TESTE_RESTRITO = 'Teste A/B restrito: o teste que gerou esta troca só abre para quem edita o site.'`; a do falhou `FRASE_TROCA_FALHOU = 'A leitura falhou: não foi possível ler as impressões deste vídeo agora. A troca está certa; o antes e o depois não puderam ser calculados.'` (cópia do mockup T9).
- Guarda A23 (`decisao-75-sem-colapso.test.ts`): para cada produtor de `C/_proprio/dados.ts`, `dados-trocas.ts`, `dados-termos.ts`, `dados-origem.ts`, `carregar-extras.ts`, com leitor que lança erro e com prova de edição negada, o resultado é `{acesso:'erro'}` e `{acesso:'negado'}` respectivamente, nunca `null`/`dado` vazio; e os ramos A4 (`_canal/video-card.tsx` vídeo de fora), A16 (`impressoes.tsx` dia sem número) e A20 (`origem` + `_comparar/so-seu-canal-model.ts:34`) recebem só `nao_medido`: montar o modelo com `acesso:'negado'` e `'erro'` e afirmar que o bloco inteiro cai em `ausencia`/`vazioEstado` restrito/falhou antes de chegar à célula de dia (Review Focus 5).

- [ ] **Step 1: testes** (os casos acima, mais: `negado sem dado nunca produz valor 0 nem ZeroMedido`).
- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3:** implementar; ajustar `C/_proprio/video-blocos.tsx:114` só o necessário para compilar (`r.ausencia` no lugar de `r.rotulo`; desenho novo é da Task 6). Atualizar no MESMO commit os testes que fixam `semNumero: 'sem acesso'`/`'não conseguimos ler'` e `rotulo` (lista: `grep -rln "sem acesso\|não conseguimos ler\|rotulo: 'falhou'" apps/web/test`).
- [ ] **Step 4:** → PASS; typecheck limpo.
- [ ] **Step 5: commit** `feat: estado tipado de ausência na página do vídeo e nas trocas, guarda contra colapso de negado e erro (decisão 75)`.

### Task 5: Fonte do estado no Comparar e na lista de Canais (B5, B6–B8, C9)

**Files:**
- Modify: `C/_comparar/so-seu-canal-model.ts:55,274-287`, `C/_comparar/numeros-model.ts:30,44,84`, `C/_comparar/medidas-do-lado.ts:88-91,150`, `C/_canais/montar.ts:35-37` e o modelo da célula de views por dia da lista (`C/_canais/view-model.ts`, campo `vpd`)
- Test: `T/proprio-a4-so-seu-canal.test.tsx`, `T/comparar-numeros.test.ts`, `T/canais-e5a-modelos.test.ts`

**Interfaces:**
- Produces:
  - `SoSeuCanalCartao.ausencia: EstadoAusencia | null` (negado→restrito com `FRASE_NEGADO_CARTAO`; erro/sem view→falhou com `FRASE_ERRO_CARTAO`). `semNumero(...)` ganha o parâmetro `ausencia`.
  - `Motivo` `{ k: 'semVpdProprio'; texto: string; motivo: MotivoSemVpd }`; `Numero.ausencia: EstadoAusencia | null` (null ⇔ `x != null`), de `ausenciaDoMotivoVpd` no semVpdProprio e `nao_medido` nos demais motivos. A leitura rápida herda de `Numero`.
  - `Falta` `{ tipo: 'nao_medido'; motivo; porque; ausencia: EstadoAusencia }` de `ausenciaDoMotivoNaoMedido(motivo)`.
  - Célula de views por dia do canal próprio na lista de Canais: `ausencia: EstadoAusencia | null` vinda do `VpdCanal.motivo` (C9: a lista MOSTRA restrito no canal próprio; concorrente só `nao_medido`/`falhou`).
- [ ] **Step 1: testes.** `cartão negado → ausencia 'restrito'`; `cartão erro → 'falhou'`; `Numero do vpd próprio com sem-acesso → 'restrito'`; `Falta com motivo sem_permissao → 'restrito', leitura_falhou → 'falhou', poucas_views → 'nao_medido'`; `linha própria da lista com vpd sem-acesso → 'restrito'`; `concorrente nunca 'restrito'` (varrer todas as linhas não próprias da fixture `T/canais-e5a-fixture.ts`).
- [ ] **Step 2:** rodar → FAIL. **Step 3:** implementar (todo construtor de `Motivo.semVpdProprio` passa `motivo`; `MOTIVOS` de teste em `numeros-model.ts:84` incluídos). **Step 4:** PASS + typecheck.
- [ ] **Step 5: commit** `feat: estado tipado de ausência no Comparar e na lista de Canais (decisão 75)`.

### Task 6: Telas do canal próprio e da página do vídeo (A1, A3, A5, A8, A11, A13, A14, A17, A18, A19, A21, A22)

**Files:**
- Modify: `C/_proprio/proprio-header.tsx:25-32`, `C/_canal/video-card.tsx:24-26,35,42`, `C/_canal/tabela.tsx:60,98,107-110`, `C/_proprio/reguas.tsx:154`, `C/_proprio/assistido-periodos.tsx:58,148`, `C/_proprio/video-blocos.tsx:114,132` + `C/_proprio/video-blocos.css:54` (remover `.vb-falhou`), `C/_proprio/impressoes.tsx:416`, `C/_proprio/como-esta.tsx:93,126`, `C/_proprio/origem.tsx:141-148` (cadeado via `PastilhaAusencia`, sem mudar texto), `C/_proprio/trocas.tsx:10-11,59,73` + `C/_proprio/trocas.css:10`
- Test: `T/decisao-75-telas-proprio.test.tsx` (jsdom, novo) + atualizar no mesmo commit os que fixam `obs-ch-nm`/`vb-falhou`/`tr-sem-acesso` nesses estados: `T/proprio-tela.test.tsx`, `T/proprio-como-esta-tela.test.tsx`, `T/proprio-trocas-tela.test.tsx`, `T/proprio-ux-b2.test.tsx`, `T/proprio-n2e-origem-forma.test.tsx`, `T/l4-layout-estreito.test.tsx` (confirmar com `grep -rln "obs-ch-nm\|vb-falhou\|tr-sem-acesso" apps/web/test`)

**Interfaces:**
- Consumes: `PastilhaAusencia` (Task 1); campos `…Estado`/`ausencia` (Tasks 3–4).
- Regras de desenho (mockup T1–T7, T9):
  - Cabeçalho (T1): quadradinho por célula (`quadradinho`), frase única abaixo (de `motivoDasCelulas`).
  - Cartão de vídeo (T2) e tabela (T3): pastilha com palavra por célula; na tabela, UMA `<p role="status">` acima da tabela com `motivoAlcance` (Review Focus 2); célula sem `role`.
  - Retenção (T4), réguas e nota privada (T5), % assistido (T6): pastilha + frase existente; restrito agora aparece onde antes não havia pastilha (A12, A14).
  - Impressões e Como está (A17, A18): pastilha antes da frase de vazio.
  - Trocas (T9): chip `leitura-falhou` → `PastilhaAusencia estado="falhou"` + `FRASE_TROCA_FALHOU`; `'sem-acesso'` → `PastilhaAusencia estado="restrito"` + `FRASE_TESTE_RESTRITO`. Os chips `*-nao-medido` ficam.
- [ ] **Step 1: testes** em `decisao-75-telas-proprio.test.tsx`: para cada tela acima, com a fixture em `negado` → existe `.obs-au-restrito` e nenhum `.obs-ch-nm` nas células de alcance; em `erro` → `.obs-au-falhou`; em `sem-relatorio` → `.obs-ch-nm`; tabela de 20 vídeos com alcance erro → exatamente 1 `[role=status]` e 0 `[role=alert]`; nenhuma classe `vb-falhou` em nenhuma saída.
- [ ] **Step 2:** rodar → FAIL. **Step 3:** implementar. **Step 4:** rodar este + os 6 atualizados → PASS.
- [ ] **Step 5: commit** `feat: pastilhas falhou e restrito no canal próprio e na página do vídeo (decisão 75)`.

### Task 7: Telas do Comparar e da lista de Canais (B1–B4, B6–B9, C9)

**Files:**
- Modify: `C/_comparar/so-seu-canal.tsx:52,62,64,72` (o SVG local `.so-cadeado` sai; `so-erro` com `role=alert` sai), `C/_comparar/celulas-novas.tsx:27`, `C/_comparar/numero-a-numero.tsx:46-50`, `C/_comparar/leitura-rapida.tsx:21`, `C/_comparar/comparar.css:58,93`, a célula de views por dia da lista (`C/_canais/cells.tsx`, componente do `vpd`)
- Test: `T/decisao-75-telas-comparar.test.tsx` (novo) + no mesmo commit `T/proprio-a4-so-seu-canal.test.tsx`, `T/comparar-css.test.ts`, `T/canais-e5a-tela.test.tsx`
- Regras: célula escolhe a forma por `ausencia`, nunca por `porque`/`motivo`; leitura rápida usa o quadradinho da forma certa; a lista de Canais mostra restrito só em linha própria.
- [ ] **Step 1: testes**: cartão negado → `.obs-au-restrito` + `FRASE_NEGADO_CARTAO`, sem `.so-cadeado`; cartão erro → `.obs-au-falhou`, zero `role=alert`; célula do número a número com vpd próprio `sem-acesso` → restrito (não hachura); `Falta` com `sem_permissao` → restrito; linha própria da lista com vpd negado → restrito; linha de concorrente nunca tem `.obs-au-restrito`.
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5: commit** `feat: pastilhas falhou e restrito no Comparar e na lista de Canais (decisão 75)`.

### Task 8: Canal de fora: "Não carregou" vira "falhou", frases "A leitura falhou:", Tentar de novo por bloco (C1–C8, C10) — UM commit

**Files:**
- Modify (componente): `C/_chrome/medidas/marcas.tsx:30-38` (`NaoCarregou` é REMOVIDO; quem importava passa a `PastilhaAusencia estado="falhou"`), `C/_chrome/medidas/medidas.css:15-16` (remover `.obs-md-nc`)
- Modify (spans inline `obs-md-nc` e importadores): `C/_canal/medidas/celulas.tsx:10,17`, `ritmo-bloco.tsx:41`, `direcao-bloco.tsx:44-49,117`, `criador-responde.tsx:37`, `lancamentos.tsx:113`, `horas-do-canal.tsx:41`, `linha-do-tempo.tsx:30,76`, `C/_canais/resumo-bloco.tsx:25,82`, `C/_canais/direcao-cell.tsx:12,40`, `C/_canais/channel-drawer.tsx:131`, `C/_comparar/celulas-novas.tsx:24`
- Modify (frases, "Não carregou:" → "A leitura falhou:"): `C/_canal/medidas/frase-do-topo.ts:96,137`, `criador-model.ts:113,133`, `criador-lista-model.ts:48`, `linha-do-tempo-model.ts:80`, `ritmo-model.ts:134,196`, `estado-model.ts:56` (`pastilha: 'falhou'`, `base: 'falhou'`), `C/_chrome/comentarios/frases.ts:26` (`abaNaoCarregou`) e `model.ts:347`, `C/_historico/medidas/subida-model.ts:56`, `resumo-model.ts:55`, `idade-model.ts`
- Modify (frase com botão, regra F1): `frase-do-topo.ts:96` vira `A leitura falhou: não deu para ler as medidas deste canal agora. Os números abaixo não valem.` (cópia do mockup T8, sem "recarregue")
- Create: `T/decisao-75-varredura.test.ts` (node)
- Test (no mesmo commit, os que fixam "Não carregou"/`obs-md-nc`): `grep -rln "Não carregou\|não carregou\|obs-md-nc" apps/web/test` (hoje inclui `T/medidas-frases.test.ts`, `T/medidas-canal-frase-do-topo.test.ts`, `T/medidas-canal-cabecalho.test.ts`, `T/medidas-comentarios.test.ts`, `T/historico-e5-estourou.test.tsx`, `T/canais-e5a-tela.test.tsx`, `T/insights-direcao-screen.test.tsx`)

**Interfaces:**
- Consumes: `PastilhaAusencia`, `BlocoComTentativa` (Tasks 1–2).
- `BlocoComTentativa` envolve, SEMPRE (nos dois ramos), estes blocos: frase do topo da página do canal, Direção (bloco), Ritmo (bloco), Lançamentos, 72 horas, Linha do tempo, O que o criador respondeu. O valor que substitui a pastilha no sucesso leva `data-valor`. Células de cabeçalho, linhas de tabela, lista de Canais e gaveta: só a pastilha, sem botão.
- Antes de ligar o botão, conferir em `C/_canal/medidas/canal-derivado-async.ts` que a falha (`.catch(canalNaoCarregou)`) não fica em cache entre requisições; se ficar, o botão não tem como dar certo: parar e devolver ao controlador.
- [ ] **Step 1: teste de varredura** `decisao-75-varredura.test.ts`: lê todo `.ts/.tsx` de `C/` e `L/`, descarta linhas de comentário (`//`, `*`, `/*`) e afirma: zero `/[Nn]ão carregou/`; zero `obs-md-nc` e `vb-falhou`; zero `role="alert"` em arquivo que importa `PastilhaAusencia`; zero `export function NaoCarregou`. Mais testes de bloco (jsdom): `direcao-bloco em nao_carregou → .obs-au-falhou + botão "Tentar de novo" fora da pastilha`; `célula do cabeçalho em nao_carregou → pastilha sem botão`.
- [ ] **Step 2:** rodar → FAIL (lista as ocorrências).
- [ ] **Step 3:** implementar tudo acima; atualizar os testes listados.
- [ ] **Step 4:** `npx vitest run T/ > /tmp/d75-t8.txt 2>&1; grep -E "FAIL|✗|Error" /tmp/d75-t8.txt | head -40` → só falhas pré-existentes conhecidas (comparar com a base antes de começar: rodar a mesma linha no commit anterior e guardar em `/tmp/d75-base.txt`).
- [ ] **Step 5: commit** `feat: "Não carregou" vira a pastilha falhou e as frases "A leitura falhou:", Tentar de novo por bloco no canal de fora (decisão 75)`.

### Task 9: Pacote da IA: falhou e restrito com as mesmas palavras, negado nunca zero (D1)

**Files:**
- Modify: `L/contexto-ia/tipos.ts:9-10`, `L/contexto-ia/frases.ts:51` (+ registro de fragmentos ~linha 129), `L/contexto-ia/segmentar.ts:79,89,114`, `L/contexto-ia/mascarar.ts:14`, `C/_contexto-ia/empacotar-canais.ts:293,314`, `empacotar-comparar.ts` (cartão e números), `empacotar-canal-proprio.ts:96-97,104`, `empacotar-canal-medidas.ts:339`, `empacotar-video-medidas.ts:321`, `empacotar-canal.ts:138`
- Test: `T/contexto-ia-sem-dado.test.ts`, `T/contexto-ia-canais.test.tsx`, `T/contexto-ia-comparar.test.tsx`, `T/contexto-ia-canal-proprio.test.tsx`, `T/contexto-ia-varredura-de-saida.test.ts`

**Interfaces:**
- `Celula` ganha `| { papel: 'numero'; estado: 'falhou' | 'restrito'; motivo: string; origem: string }`.
- `frases.ts`: `export const falhou = (motivo: string) => \`falhou (${motivo})\``; `export const restrito = (motivo: string) => \`restrito (${motivo})\``; registro `{ id: 'falhou', fragmentos: ['falhou ('] }`, `{ id: 'restrito', fragmentos: ['restrito ('] }`.
- `segmentar.ts`: texto e JSON da célula para os dois estados novos (`{ estado, motivo }`); `contar`: falhou e restrito somam em `naoMedidos` (o campo `nao_medidos` do registro em `contexto-ia-actions.ts:99` não muda de nome nem de schema); `mascarar.ts` trata `motivo` dos dois.
- Cada empacotador: o helper local `naoMedido(motivo, origem)` ganha a irmã `ausente(estado: EstadoAusencia, motivo, origem)`; usar onde o modelo (Tasks 3–5) dá `ausencia`/`…Estado`. `nao_carregou` dos modelos do canal de fora → `falhou`.
- [ ] **Step 1: testes**: `vpd próprio negado na lista → célula "restrito (…)"`, `erro → "falhou (…)"`; `cartão do Comparar negado → restrito`; `nenhuma célula de estado falhou/restrito tem x ou texto "0"` (Review Focus 5); `contagem: falhou e restrito entram em naoMedidos`; varredura de saída aceita os fragmentos novos e continua rejeitando "Não carregou".
- [ ] **Step 2–4:** FAIL → implementar → PASS (os 5 arquivos + `T/contexto-ia-*.test.*` inteiro, saída em arquivo).
- [ ] **Step 5: commit** `feat: pacote da IA escreve falhou e restrito, negado nunca zero (decisão 75)`.

### Task 10: e2e do Gio, allowances e roteiro (D3)

**Files:**
- Create: `apps/web/e2e/tests/cms/observatorio/decisao-75.spec.ts`
- Modify: `apps/web/e2e/tests/cms/observatorio/allowances.ts` (só se um spec de fidelidade quebrar por causa da decisão 75), `docs/superpowers/mockups/ROTEIRO-DE-TESTE-E-MELHORIAS.md`

- [ ] **Step 1: spec** (padrão de `proprio-a4-comparar-seguranca.spec.ts`: `ADMIN_STATE` e `.auth/reporter.json`, capas por `route`):
  - restrito: reporter abre canal próprio, vídeo próprio e Comparar → `.obs-au-restrito` nas células de alcance, nenhuma `.obs-ch-nm` nelas, nenhum número de alcance no HTML; admin vê números e nenhuma `.obs-au-restrito`.
  - lista de Canais (reporter): linha própria com restrito na coluna de views por dia; linhas de concorrente sem restrito.
  - canal de fora: zero ocorrência de "Não carregou" em texto visível de Canais, canal, Histórico e Comparar.
  - 390 e 1440: `.obs-au-retry` (quando presente) com altura ≥ 44 e sem rolagem horizontal; pastilhas `nowrap` não estouram a célula.
  - acessibilidade: nenhuma `[role=alert]` nas telas com pastilha.
  - Erro de leitura e os três estados do "Tentar de novo" não têm como ser provocados no servidor pelo e2e hoje: ficam provados pelos testes de componente (Tasks 2, 6, 8) e pela conferência visual abaixo. Não criar gancho de falha no produto para isso.
- [ ] **Step 2:** rodar a pasta `e2e/tests/cms/observatorio/` inteira com saída em arquivo; para cada spec de fidelidade que quebrar por texto ou classe trocado pela decisão 75, acrescentar a `allowances.ts` UMA entrada por elemento com a regra `D75 (17/10): erro e negado deixaram de ser "não medido"`; nada além disso. Hoje nenhum spec cita "Não carregou"; `proprio-e5b-n2.spec.ts:369` ("não conseguimos ler agora") é da origem (A19/A20, sem mudança) e deve continuar passando.
- [ ] **Step 3: conferência visual do Gio** (capturas em arquivo, veredito em texto): escuro, claro e modo cinza, 390 e 1440, das telas T1–T9 do mockup contra o `index.html`; leitor de tela anuncia uma vez por lista.
- [ ] **Step 4:** acrescentar ao `ROTEIRO-DE-TESTE-E-MELHORIAS.md` a seção da decisão 75 (o que o dono testa no Opera: reporter vê restrito; "falhou" no canal de fora; "Tentar de novo"). Sugestões de rodada 2 que ficaram para depois: `.dir` com `min-height:44px` para não pular no sucesso (Naksu R2.2), reutilizar `BlocoComTentativa` no "Tentar de novo" da origem (`C/_proprio/origem-periodos.tsx:67`).
- [ ] **Step 5: commit** `test: e2e da decisão 75, allowances D75 e roteiro`.

---

## Ordem de commits e dependências

1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10. Tasks 3–5 são aditivas (a tela ainda não muda) e podem ir em paralelo entre si depois da 1; 6 depende de 3–4; 7 de 5; 8 de 1–2; 9 de 3–5 e 8. Cada commit passa no pre-commit sozinho.

## Riscos

- **Conflito com o plano dos comentários** (`2026-10-17-a5-comentarios-producao-plan.md`): ambos tocam `C/_chrome/comentarios/` (aqui só `frases.ts:26` e `model.ts:347`). Quem entra depois rebaseia; não juntar no mesmo trem sem reler os dois diffs.
- **Task 8 é grande** por exigência do Logan (rótulo e frases no mesmo commit). A varredura é o que a torna revisável: o revisor confere o teste e a lista de arquivos.
- **Retry sem efeito** se a falha do canal derivado estiver em cache (checagem na Task 8). E o estado do `BlocoComTentativa` só sobrevive ao `router.refresh()` se ele estiver no mesmo lugar da árvore nos dois ramos; o teste da Task 2 com `rerender` é o que prova isso no componente, não na página: o Gio confere no navegador se conseguir uma falha real.
- **`semNumero` do % assistido muda de texto** ("sem acesso" → "restrito"): o pacote da IA (`empacotar-canal-proprio.ts:104,638,669`) lê `semNumero` como motivo; o teste da Task 9 cobre.
- **Fidelidade contra mockups antigos**: telas que no mockup antigo tinham hachura para negado vão diferir; allowance só com a regra D75, por elemento.
- **Tema claro**: os `--res-*` claros são do mockup, não confirmados pelo dono no Opera (o tema claro inteiro ainda é pendência D7 da A1).
