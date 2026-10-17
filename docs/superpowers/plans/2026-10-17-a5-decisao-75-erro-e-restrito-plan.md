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
- Canal de fora nunca mostra restrito (só dado público). `sem_permissao` vindo de `nao_pedido` (`L/medidas/do-canal.ts:263`) em canal de fora NÃO é negação: a derivação recebe o lado (Task 1).
- **`restrito` só com negação de verdade:** `acesso:'negado'` + `negativa==='sem_direito'` + lado próprio. Guarda de permissão caída ou passada do prazo de 5 s (`nao_foi_possivel_conferir`, `L/proprio/leitura-privada.ts:44-52,98`) nunca vira cadeado: vira `{acesso:'erro'}` e, na tela, `falhou` (Phil C1).
- **Chave ausente num mapa é falha, nunca estado afirmativo:** vira `falhou`, nunca `restrito` nem `nao_medido` (Phil I3).
- Política de push: o executor NUNCA dá push (só commit por caminho explícito; sem `git add .`); o controlador empurra e promove. Promoção para `main` só depois da Task 9, ou da 8b se a 9 atrasar, com a divergência declarada no ledger.
- Pacote da IA: dado negado nunca vira zero; células escrevem `falhou (motivo)` / `restrito (motivo)` com as mesmas palavras da tela.
- Commits: `tipo: descrição (decisão 75)`, commit por caminho explícito, sem `--no-verify`; teste que fixa texto ou classe muda no MESMO commit (INVENTARIO D2).

## Review Focus

1. **Estado misto no mesmo canal próprio** (alcance negado, diário ok, ou alcance erro e diário negado): cada célula mostra a forma do SEU estado; a frase de cima não funde restrito sob "Não medido:". Teste em Task 3 (`motivoDasCelulas` com mistura).
2. **Leitor de tela numa tabela de 20 vídeos com alcance falhou**: um anúncio só (uma `role="status"` por lista), não 40. Teste em Task 6.
3. **Tentar de novo que falha de novo**: terminada a transição com `falhou` ainda verdadeiro → estado (b) "Falhou de novo…", botão volta a funcionar, nunca fica preso em "Tentando…". Provado como tabela de transições em node (`proximaFase`) na Task 2 e na página na Task 8b. O "falhou de novo" real é o banco ou o prazo falhando outra vez no servidor; com a rede do navegador caída o App Router faz navegação completa (Yannis M4), por isso a frase não culpa a conexão (texto é do Logan).
4. **Escala de cinza / daltonismo**: as três formas se distinguem sem cor (hachura × triângulo × cadeado + palavra). Teste em Task 1 (cada forma tem glifo ou classe de hachura distinta) e conferência do Gio (Task 10, modo cinza).
5. **Negado sem dado algum no pacote da IA ou na tela** (`acesso:'negado'`, `dado` vazio): nunca `0`, nunca caixa de zero medido. Testes em Task 4 (A23) e Task 9.
6. **Guarda de permissão caída** (`nao_foi_possivel_conferir`, prazo de 5 s): nunca `restrito` em tela nem no pacote; o dono vê `falhou`, nunca cadeado. Testes em Tasks 1, 4, 5 e 9 (Phil C1). Conferência pós-deploy: dono abre canal próprio e Comparar e vê zero `.obs-au-restrito`.

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
  - `export type NegativaPrivada = 'sem_direito' | 'nao_foi_possivel_conferir' | null`
  - `export function ausenciaDoAcesso(a: 'ok' | 'negado' | 'erro', negativa: NegativaPrivada): EstadoAusencia | null` (ok→null; erro→falhou; **negado→restrito SÓ com `negativa === 'sem_direito'`**; negado com `nao_foi_possivel_conferir` ou `null` (negativa não preenchida) → `falhou`, motivo "não deu para conferir a permissão agora"). Phil C1: guarda caída nunca vira cadeado.
  - `export function ausenciaDoMotivoVpd(m: MotivoSemVpd | null): EstadoAusencia | null` (`L/proprio/vpd.ts`: sem-acesso→restrito, leitura-falhou→falhou, null→null, resto→nao_medido)
  - `export function ausenciaDoMotivoNaoMedido(m: MotivoNaoMedido, lado: { proprio: boolean }): EstadoAusencia` (`L/medidas/tipos.ts`: `sem_permissao`→restrito **só com `lado.proprio`**, fora → `nao_medido`; `leitura_falhou`,`calculo_falhou`→falhou; resto→nao_medido). Implementada como `const MAPA: Record<MotivoNaoMedido, EstadoAusencia>` (o compilador cobra o motivo novo; Yannis M8) mais a regra do lado. Motivo: `sem_permissao` também sai de `nao_pedido` e de leitura sem prova no canal de fora (`L/medidas/do-canal.ts:263-264`, `ler-comentarios.ts:57`); o M12 do canal de fora segue "não medido · só para quem edita" (Phil M1, Yannis I7). Se `nao_pedido` deve deixar de sair como `sem_permissao` na origem é decisão do Phil, fora deste lote.
- Produces (`glifos.ts`): `CAMINHO_AVISO`, `CAMINHO_CADEADO` (as strings de `origem-glifos.tsx` hoje em `aviso`/`lock`).
- Produces (`pastilhas.tsx`, componente SEM diretiva, sem `server-only`, sem hook; é importado também por componentes `'use client'` como `lancamentos.tsx`, `channel-drawer.tsx`, `resumo-bloco.tsx`, `cells.tsx`, `tabela.tsx`, `video-card.tsx`; Yannis M7): `export function PastilhaAusencia(p: { estado: EstadoAusencia; motivo?: string; quadradinho?: boolean; texto?: string }): JSX.Element`
  - `nao_medido`: `<span class="obs-ch-nm">{texto ?? 'não medido'}</span>` (quadradinho: a classe `nm-q` existente com `role="img"`).
  - `falhou`: `<span class="obs-au obs-au-falhou" title={motivo}><svg aria-hidden>{aviso}</svg>falhou<span class="obs-md-sr">: {motivo}</span></span>`; `restrito` igual com `obs-au-restrito` e cadeado.
  - quadradinho de falhou/restrito: `<span class="obs-au-q obs-au-falhou|restrito" role="img" aria-label=rótulo title=rótulo>` só com o ícone.
  - Nenhuma `role` na pastilha com texto.

- [ ] **Step 1: testes que falham.** `ausencia-estado.test.ts`: `ausenciaDoAcesso` nos três valores × as três `negativa` (negado+`sem_direito`→restrito; negado+`nao_foi_possivel_conferir`→falhou; negado+`null`→falhou; nunca restrito sem `sem_direito`); `ausenciaDoMotivoVpd` para os 7 `MotivoSemVpd` e `null`; `ausenciaDoMotivoNaoMedido` cobre TODO `MOTIVOS_NAO_MEDIDO` (laço sobre o mapa; só os três citados fogem de `nao_medido`), nos dois lados: com `{proprio:false}` nunca devolve `restrito`. `ausencia-pastilhas.test.tsx`: cada estado renderiza a palavra de `ROTULO_AUSENCIA`; falhou contém `CAMINHO_AVISO`, restrito `CAMINHO_CADEADO`, não medido nenhum dos dois (Review Focus 4); `motivo` vai em `title` e no `.obs-md-sr`; quadradinho tem `role="img"`, `aria-label` = `title` = rótulo; nenhum `role="alert"` em nenhuma saída. `ausencia-css.test.ts` (modelo: `T/regua-css.test.ts`, funções `lum`/`contraste`): sem `color-mix`; nenhuma fonte < 12 px; os seis `--res-*` existem nos dois temas; contrastes da seção Global Constraints recalculados (o fundo do falhou é `--danger-subtle` composto sobre `--surface`); `.obs-au-retry` tem `min-height:44px`.
- [ ] **Step 2:** `cd apps/web && npx vitest run T/ausencia-estado.test.ts T/ausencia-pastilhas.test.tsx T/ausencia-css.test.ts > /tmp/d75-t1.txt 2>&1; tail -30 /tmp/d75-t1.txt` → FAIL (módulos não existem).
- [ ] **Step 3: implementar** os quatro arquivos e os tokens. CSS copia `.er`, `.rs`, `.q`, `.retry`, `.retry-row`, `.estado-val` do `index.html` (linhas 66–88), renomeados para `obs-au`, `obs-au-falhou`, `obs-au-restrito`, `obs-au-q`, `obs-au-retry`, `obs-au-retry-row`, `obs-au-val`, todos sob `[data-obs]`. Borda do `.obs-au-retry`: `var(--muted)`; `aria-disabled="true"` → borda tracejada e `cursor:progress`.
- [ ] **Step 4:** mesmo comando → PASS.
- [ ] **Step 5: commit** `feat: pastilhas falhou e restrito, módulo de ausência (decisão 75)` com os 7 caminhos.

### Task 2: `TentarDeNovo` com três estados (núcleo puro + client)

**Files:**
- Create: `C/_chrome/ausencia/tentativa.ts` (puro, sem React), `C/_chrome/ausencia/tentar-de-novo.tsx` (`'use client'`)
- Test: `T/ausencia-tentativa.test.ts` (node), `T/ausencia-tentar-de-novo.test.tsx` (jsdom, `vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))`)

**Interfaces:**
- Produces (`tentativa.ts`): `type Fase = 'parado' | 'tentando' | 'falhou_de_novo' | 'lido'`; `type Evento = 'clicou' | 'terminou_falhou' | 'terminou_lido'`; `export function proximaFase(fase: Fase, evento: Evento): Fase` (parado/falhou_de_novo + clicou → tentando; tentando + clicou → tentando, ignorado; tentando + terminou_falhou → falhou_de_novo; tentando + terminou_lido → lido; demais combinações devolvem a fase). Switch exaustivo com `never`.
- Produces (`tentar-de-novo.tsx`): `export function BlocoComTentativa(p: { falhou: boolean; fraseFalha: string; children: ReactNode }): JSX.Element`
  - Sempre renderizado no MESMO lugar da árvore nos dois ramos (falhou e ok): é o que preserva o estado do cliente através do `router.refresh()`.
  - `falhou && fase==='parado'`: `children` + linha `obs-au-retry-row` com `<p role="status">{fraseFalha}</p>` + botão "Tentar de novo".
  - `fase==='tentando'` (via `useTransition`): botão `aria-disabled="true"` `aria-busy="true"` texto `Tentando…`, frase `Lendo as medidas de novo…`; clique repetido ignorado. Usar `aria-disabled`, não `disabled` (o foco fica no botão).
  - terminou e `falhou` continua: frase `Falhou de novo. Tente mais uma vez.` (texto final é do Logan, M4: não culpa a conexão), botão volta a `Tentar de novo`.
  - terminou e `falhou` virou `false` após ≥1 tentativa: sem botão; `<p role="status" aria-live="polite">Medidas lidas agora.</p>`; foco no primeiro `[data-valor]` dentro de `children` (o elemento recebe `tabIndex=-1`).
  - `!falhou` sem tentativa: só `children`, nada mais.
  - Prop opcional `soPastilha?: boolean` (M5): em falha total do canal só o topo leva o botão e os blocos só a pastilha. **Para aprovação do Logan**; sem a aprovação, todos levam botão e a Task 10 registra o ruído.

- [ ] **Step 1: testes.** Node (`ausencia-tentativa.test.ts`): tabela com TODAS as transições de `proximaFase` (Review Focus 3), incluindo clique em `tentando` ignorado. jsdom: `vi.mock('react', async (o) => ({ ...(await o()), useTransition: () => [pendente, (f) => f()] }))` com `pendente` controlado pelo teste (o mock de `useRouter` termina no mesmo tique e `isPending` nunca seria `true`; Yannis I5). Casos: `parado mostra botão e frase`; `pendente=true` desenha `Tentando…`, `aria-busy`, `aria-disabled`, e clique não chama `refresh`; clique com `pendente=false` chama `refresh` uma vez; `rerender com falhou=true após a transição mostra "Falhou de novo. Tente mais uma vez."`; `rerender com falhou=false foca [data-valor] e mostra "Medidas lidas agora."`; `falhou=false sem tentativa não tem role=status nem botão`; nenhum `role="alert"`.
- [ ] **Step 2:** `npx vitest run T/ausencia-tentativa.test.ts T/ausencia-tentar-de-novo.test.tsx > /tmp/d75-t2.txt 2>&1` → FAIL.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5: commit** `feat: Tentar de novo com três estados (decisão 75)`.

### Task 3: Fonte do estado no alcance e nas views por dia do canal próprio (A2, A6, A7, A9, A17, A18)

**Files:**
- Modify: `C/_proprio/videos-model.ts:31,88-95,176-189`, `C/_proprio/header-model.ts:36,79-80,375-385`, `C/_proprio/reguas-model.ts:151,277`, `C/_proprio/impressoes-model.ts:108,178-182`, `C/_proprio/como-esta-model.ts:56,95-156`
- Test: `T/proprio-videos-model.test.ts`, `T/proprio-13-3-cabecalho.test.ts`, `T/proprio-impressoes-model.test.ts`, `T/proprio-como-esta.test.ts` (acrescentar casos; nenhum texto existente muda nesta task)

**Interfaces:**
- Consumes: `EstadoAusencia`, `ausenciaDoAcesso`, `ausenciaDoMotivoVpd` (Task 1). Nos modelos do canal próprio o `acesso:'negado'` que chega já é negação de verdade (Task 4 faz os produtores devolverem `erro` para guarda caída), então `ausenciaDoAcesso(a, 'sem_direito')`.
- Produces (campos ADITIVOS; os de texto ficam como motivo):
  - `ProprioVideoView`: `impEstado`, `cliquesEstado`, `vpdDiarioEstado: EstadoAusencia | null` (null ⇔ há número ou zero medido).
  - `ProprioVideosView.motivoAlcanceEstado: EstadoAusencia | null`; `viewsPorDiaEstado: EstadoAusencia | null`.
  - `ProprioCell.ausencia: EstadoAusencia | null`.
  - `reguas-model`: a linha de impressões ganha `ausencia: EstadoAusencia | null`.
  - `impressoes-model` view: `vazioEstado: EstadoAusencia | null` (SEM_PERMISSAO→restrito, ERRO_ALCANCE→falhou, outros vazios→nao_medido).
  - `como-esta-model`: cada frase de vazio (`frase`, `topVazio`, `taxa.vazio`) ganha o seu `…Estado: EstadoAusencia | null`.
- `motivoDasCelulas(cs)` passa a agrupar por `c.ausencia`, não por `startsWith('só quem edita')`: restrito → frase própria capitalizada; falhou → frase própria capitalizada; só `nao_medido` entra em "Não medido: …. Nenhum destes números é zero, só falta medir.".

- [ ] **Step 1: testes.** videos: `alcance negado → impEstado e cliquesEstado 'restrito' em todo vídeo`; `alcance erro → 'falhou'`; `sem-relatorio e nada-lido → 'nao_medido'`; `vídeo novo (alcance ainda não chegou) → impEstado 'nao_medido'`; `semImpressao (zero medido, estado ok) → impEstado null e nenhum estado de ausência` (dois casos separados; Phil M2); `diário negado → vpdDiarioEstado 'restrito' e viewsPorDiaEstado 'restrito'`. header: `motivoDasCelulas com uma célula restrito, uma falhou e uma nao_medido` → três frases separadas, e a de erro NÃO aparece depois de "Não medido:" (Review Focus 1). impressões/como-está: `negado → vazioEstado 'restrito'`, `erro → 'falhou'`.
- [ ] **Step 2:** rodar os 4 arquivos com saída em `/tmp/d75-t3.txt` → FAIL.
- [ ] **Step 3:** implementar. Em `videos-model.ts`, `palavraDaColuna` vira `colunaSemNumero(e): { palavra: string; estado: EstadoAusencia }` (switch exaustivo mantido: negado→restrito, erro→falhou, sem-relatorio/nada-lido→nao_medido).
- [ ] **Step 4:** → PASS; `npx tsc --noEmit -p apps/web` sem erro novo.
- [ ] **Step 5: commit** `feat: estado tipado de ausência no alcance e nas views por dia (decisão 75)`.

### Task 4: Fonte do estado na página do vídeo e nas trocas + guarda A23 e guarda caída (A10, A12, A15, A21, A22, A23)

**Files:**
- Modify (modelos, SÓ ACRESCENTAR `ausencia`; Yannis M1): `C/_proprio/assistido-periodo-model.ts:36,92-93,128-131`, `C/_proprio/retencao-curva-model.ts:56-57,104`, `C/_proprio/video-blocos-model.ts:143-146,392-401`, `C/_proprio/trocas-model.ts:18,44,64,117-124`
- Modify (produtores, guarda caída vira `erro`; Phil C1): `C/_proprio/dados.ts:110,143,179,215`, `dados-trocas.ts:49`, `dados-termos.ts:24,28-29`, `dados-origem.ts:71`, `carregar-extras.ts:62`
- Create: `T/decisao-75-sem-colapso.test.ts`
- Test: `T/proprio-assistido-periodo-model.test.ts`, `T/proprio-video-blocos-model.test.ts`, `T/proprio-t8-modelo.test.ts`

**Interfaces:**
- Esta task é ADITIVA: `semNumero` ("sem acesso"/"não conseguimos ler") e `RetencaoView.rotulo` NÃO mudam aqui; a troca de texto e a remoção de `rotulo` vão para a Task 6, junto do desenho. Assim as Tasks 1–5 são invisíveis na tela.
- Produces:
  - `CartaoAssistido.ausencia: EstadoAusencia | null` (`sem-acesso`→restrito, `leitura-falhou`→falhou, `acima-do-teto`/`cobertura-parcial`→nao_medido); `legenda` não muda.
  - `RetencaoView.ausencia: EstadoAusencia | null` ao lado de `rotulo` (`nao-coletada`,`sem-curva`→nao_medido; `erro`→falhou; `negado`→restrito; `coletada`→null).
  - `video-blocos-model`: a nota privada expõe `ausencia` derivada de `acesso`.
  - `trocas-model`: `TrocaView.ausencia: 'falhou' | null` (chip `leitura-falhou`); `teste: { href } | 'sem-acesso'` continua; constantes novas `FRASE_TESTE_RESTRITO = 'Teste A/B restrito: o teste que gerou esta troca só abre para quem edita o site.'` e `FRASE_TROCA_FALHOU = 'A leitura falhou: não foi possível ler as impressões deste vídeo agora. A troca está certa; o antes e o depois não puderam ser calculados.'` (cópia do mockup T9), só exportadas aqui; o uso é da Task 6.
- **Produtores (C1):** hoje decidem só por `leituraValida(leitura)`, e a leitura é `null` tanto para `sem_direito` quanto para `nao_foi_possivel_conferir` (`L/proprio/leitura-privada.ts:44-52`, prazo 5 s na linha 98). Mudança: quando `leitura === null` e `negativa === 'nao_foi_possivel_conferir'`, devolver `{ acesso: 'erro' }`; `dados-termos.ts:28` troca `provarEdicao` por `provarEdicaoComAviso` e `avisou === true` → `{ acesso: 'erro' }` (hoje o `catch { edicao = null }` vira `negado`). Só `sem_direito` continua `{ acesso: 'negado' }`. Continua fechado: erro não libera número.
- **Guarda A23** (`decisao-75-sem-colapso.test.ts`), tabela por produtor, cada um com o contrato REAL dele:

| Produtor | Leitor lança | Prova de edição negada (`sem_direito`) | Guarda caída (`nao_foi_possivel_conferir`) |
|---|---|---|---|
| `dados.ts` `lerDadosDoVideo` | **a função rejeita** (D5, `dados.ts:106`: erro de alcance/diário é LANÇADO, nunca `erro` nem vazio); só a retenção dentro dele vira `{acesso:'erro'}` | `negado` | `erro` |
| `dados-trocas.ts` | alcance `negado` interno após prova → `erro` com aviso (`dados-trocas.ts:92`, de propósito); leitor que lança → `erro` | `negado` | `erro` |
| `dados-termos.ts`, `dados-origem.ts`, `carregar-extras.ts` | `erro` | `negado` | `erro` |

  Em nenhum: `null`/`dado` vazio. Teste explícito: **guarda caída nunca produz `restrito`** em nenhum modelo da Tasks 3–5 (montar o modelo a partir do produtor).
  Mais os ramos A4 (`_canal/video-card.tsx` vídeo de fora), A16 (`impressoes.tsx` dia sem número) e A20 (`origem` + `_comparar/so-seu-canal-model.ts:34`): montar o modelo com `acesso:'negado'` e `'erro'` e afirmar que o bloco inteiro cai em `ausencia`/`vazioEstado` restrito/falhou antes de chegar à célula de dia (Review Focus 5).

- [ ] **Step 1: testes** (os casos acima, mais: `negado sem dado nunca produz valor 0 nem ZeroMedido`).
- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3:** implementar. Nenhum texto existente muda; `C/_proprio/video-blocos.tsx` não é tocado.
- [ ] **Step 4:** → PASS; typecheck limpo.
- [ ] **Step 5: commit** `feat: estado tipado de ausência na página do vídeo e nas trocas, guarda caída vira erro e guarda contra colapso (decisão 75)`.

### Task 5: Fonte do estado no Comparar e na lista de Canais (B5, B6–B8, C9)

**Files:**
- Modify: `C/_comparar/so-seu-canal-model.ts:55,274-287`, `C/_comparar/numeros-model.ts:30,44,84,187` (fallback `?? SEM_LEITURA`), `C/_comparar/medidas-do-lado.ts:88-91,150`, `C/_canais/montar.ts:35-37` (`privadoDaLista` passa a preencher `negativa` a partir de `acessoPrivado`), `C/_canais/view-model.ts:387` (fallback `?? SEM_LEITURA`), `C/_proprio/carregar-extras.ts:37,63` (fallbacks `?? { acesso: 'negado' }` e `?? NEGADO`) e o modelo da célula de views por dia da lista (`C/_canais/view-model.ts`, campo `vpd`)
- Test: `T/proprio-a4-so-seu-canal.test.tsx`, `T/comparar-numeros.test.ts`, `T/canais-e5a-modelos.test.ts`

**Interfaces:**
- Produces:
  - `SoSeuCanalCartao.ausencia: EstadoAusencia | null` (negado→restrito com `FRASE_NEGADO_CARTAO`; erro/sem view→falhou com `FRASE_ERRO_CARTAO`). `semNumero(...)` ganha o parâmetro `ausencia`.
  - `Motivo` `{ k: 'semVpdProprio'; texto: string; motivo: MotivoSemVpd }`; `Numero.ausencia: EstadoAusencia | null` (null ⇔ `x != null`), de `ausenciaDoMotivoVpd` no semVpdProprio e `nao_medido` nos demais motivos. A leitura rápida herda de `Numero`.
  - `Falta` `{ tipo: 'nao_medido'; motivo; porque; ausencia: EstadoAusencia }` de `ausenciaDoMotivoNaoMedido(motivo, { proprio })` com o lado de quem desenha (concorrente: `proprio:false`, nunca restrito). `falta()` (`medidas-do-lado.ts:153-155`) já manda `leitura_falhou`/`calculo_falhou` para `{ tipo: 'nao_carregou' }` antes, então `ausencia` do ramo `nao_medido` nunca é `falhou`; `nao_carregou` desenha `falhou`.
  - Fallbacks de chave ausente (Phil I3): `carregar-extras.ts:37,63` passam a `{ acesso: 'erro' }`; `numeros-model.ts:187` e `view-model.ts:387` passam a `motivo: 'leitura-falhou'` (falhou, "não chegou"). Mapa sem o canal → `falhou`, nunca `restrito` nem `nao_medido`.
  - Lista de Canais: `privadoDaLista` preenche `negativa` (hoje `null` sempre, `montar.ts:37`) a partir de `acessoPrivado` (`carregar-extras.ts:60`); sem preencher, `ausenciaDoAcesso(...,null)` já devolve `falhou`.
  - Célula de views por dia do canal próprio na lista de Canais: `ausencia: EstadoAusencia | null` vinda do `VpdCanal.motivo` (C9: a lista MOSTRA restrito no canal próprio; concorrente só `nao_medido`/`falhou`).
- [ ] **Step 1: testes.** `cartão negado → ausencia 'restrito'`; `cartão erro → 'falhou'`; `Numero do vpd próprio com sem-acesso → 'restrito'`; `Falta com motivo sem_permissao e lado próprio → 'restrito'; sem_permissao em lado concorrente → 'nao_medido', nunca 'restrito'`; `Falta nao_carregou desenha 'falhou' e ausencia de Falta nao_medido nunca é 'falhou'`; `poucas_views → 'nao_medido'`; `mapa sem o canal (extras.vpd, diarios) → 'falhou', nunca restrito nem nao_medido`; `lista com negativa nao_foi_possivel_conferir → falhou, nunca restrito`; `linha própria da lista com vpd sem-acesso → 'restrito'`; `concorrente nunca 'restrito'` (varrer todas as linhas não próprias da fixture `T/canais-e5a-fixture.ts`).
- [ ] **Step 2:** rodar → FAIL. **Step 3:** implementar (todo construtor de `Motivo.semVpdProprio` passa `motivo`; `MOTIVOS` de teste em `numeros-model.ts:84` incluídos). **Step 4:** PASS + typecheck.
- [ ] **Step 5: commit** `feat: estado tipado de ausência no Comparar e na lista de Canais (decisão 75)`.

### Task 6: Telas do canal próprio e da página do vídeo (A1, A3, A5, A8, A11, A13, A14, A17, A18, A19, A21, A22)

**Files:**
- Modify: `C/_proprio/proprio-header.tsx:25-32`, `C/_canal/video-card.tsx:24-26,35,42`, `C/_canal/tabela.tsx:60,98,107-110`, `C/_proprio/reguas.tsx:154`, `C/_proprio/assistido-periodos.tsx:58,148`, `C/_proprio/video-blocos.tsx:114,132` + `C/_proprio/video-blocos.css:54` (remover `.vb-falhou`), `C/_proprio/impressoes.tsx:416`, `C/_proprio/como-esta.tsx:93,126`, `C/_proprio/origem.tsx:141-148` (cadeado via `PastilhaAusencia`, sem mudar texto), `C/_proprio/trocas.tsx:10-11,59,73` + `C/_proprio/trocas.css:10`
- Test: `T/decisao-75-telas-proprio.test.tsx` (jsdom, novo) + atualizar no mesmo commit os que fixam `obs-ch-nm`/`vb-falhou`/`tr-sem-acesso` nesses estados: `T/proprio-tela.test.tsx`, `T/proprio-como-esta-tela.test.tsx`, `T/proprio-trocas-tela.test.tsx`, `T/proprio-ux-b2.test.tsx`, `T/proprio-n2e-origem-forma.test.tsx`, `T/l4-layout-estreito.test.tsx` (confirmar com `grep -rln "obs-ch-nm\|vb-falhou\|tr-sem-acesso" apps/web/test`)

**Interfaces:**
- Consumes: `PastilhaAusencia` (Task 1); campos `…Estado`/`ausencia` (Tasks 3–4).
- **Troca de texto que a Task 4 adiou, neste commit:** `semNumero` do % assistido (`sem-acesso` "sem acesso"→"restrito", `leitura-falhou` "não conseguimos ler"→"falhou") em `assistido-periodo-model.ts`, e remoção de `RetencaoView.rotulo` (a tela lê `ausencia`), com os testes que fixam os textos antigos (`grep -rln "sem acesso\|não conseguimos ler\|rotulo: 'falhou'" apps/web/test`) e `C/_proprio/video-blocos.tsx:114` (`r.ausencia` no lugar de `r.rotulo`). `trocas.tsx` passa a usar `FRASE_TESTE_RESTRITO`/`FRASE_TROCA_FALHOU` da Task 4.
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
- Regras: célula escolhe a forma por `ausencia`, nunca por `porque`/`motivo`; `Falta nao_carregou` desenha `falhou`; leitura rápida usa o quadradinho da forma certa; a lista de Canais mostra restrito só em linha própria.
- [ ] **Step 1: testes**: cartão negado → `.obs-au-restrito` + `FRASE_NEGADO_CARTAO`, sem `.so-cadeado`; cartão erro → `.obs-au-falhou`, zero `role=alert`; célula do número a número com vpd próprio `sem-acesso` → restrito (não hachura); `Falta` com `sem_permissao` → restrito; linha própria da lista com vpd negado → restrito; linha de concorrente nunca tem `.obs-au-restrito`.
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5: commit** `feat: pastilhas falhou e restrito no Comparar e na lista de Canais (decisão 75)`.

### Task 8a: Canal de fora e demais telas: "Não carregou" vira "falhou", frases "A leitura falhou:", constantes da IA (C1–C8, C10) — UM commit, sem botão

**Inventário (fonte da verdade = os dois grep abaixo, rodados em `~/Workspace/wt-trem7` HEAD 042771ff2; o executor refaz o grep antes de começar e a varredura da Task prova o resultado).**

`grep -rnE "Não carregou|não carregou" apps/web/src` (sem linhas de comentário) = **75 ocorrências em 38 arquivos** (17 arquivos com maiúscula, 21 só em minúscula). Arquivo (ocorrências): `C/_canais/direcao-model.ts` (2); `C/_canais/estado-model.ts` (2); `C/_canais/resumo-model.ts` (1); `C/_canais/ri-model.ts` (1); `C/_canais/view-model.ts` (8); `C/_canal/medidas/cabecalho-model.ts` (1); `C/_canal/medidas/celulas.tsx` (1); `C/_canal/medidas/criador-lista-model.ts` (1); `C/_canal/medidas/criador-model.ts` (3); `C/_canal/medidas/direcao-bloco.tsx` (2); `C/_canal/medidas/direcao-model.ts` (4); `C/_canal/medidas/estado-model.ts` (1); `C/_canal/medidas/frase-do-topo.ts` (2); `C/_canal/medidas/lancamentos-model.ts` (1); `C/_canal/medidas/linha-do-tempo-model.ts` (3); `C/_canal/medidas/linha-do-tempo.tsx` (1); `C/_canal/medidas/ritmo-bloco.tsx` (1); `C/_canal/medidas/ritmo-model.ts` (2); `C/_chrome/comentarios/frases.ts` (1); `C/_chrome/medidas/marcas.tsx` (1); `C/_chrome/thumb-viewer/thumb-viewer.tsx` (2); `C/_contexto-ia/empacotar-canais.ts` (1); `C/_contexto-ia/empacotar-canal-medidas.ts` (1); `C/_contexto-ia/empacotar-video-medidas.ts` (1); `C/_contexto-ia/modelo-medidas-comparar.ts` (3); `C/_historico/medidas/horas-72.tsx` (1); `C/_historico/medidas/horas-model.ts` (1); `C/_historico/medidas/idade-model.ts` (4); `C/_historico/medidas/resumo-model.ts` (2); `C/_historico/medidas/subida-model.ts` (5); `C/_insights/direcao-nicho-model.ts` (5); `C/_insights/direcao-nicho.tsx` (2); `C/_outliers/idade-ui.tsx` (1); `C/_outliers/view-model.ts` (1); `src/lib/conferencias.ts` (1); `L/medidas-telas/carregar-do-site.ts` (1); `L/medidas-telas/frases-das-horas.ts` (2); `L/medidas-telas/frases.ts` (2).

`grep -rlE "Não carregou|não carregou|obs-md-nc" apps/web/test` = **44 arquivos de teste**, todos atualizados no mesmo commit: `T/contexto-ia-canais.test.tsx`, `T/canais-a5-dicas-model.test.ts`, `T/canais-e5a-modelos.test.ts`, `T/estourou-model.test.ts`, `T/canais-ri-tela.test.tsx`, `T/medidas-telas-carregar.test.ts`, `T/historico-e5-blocos.test.tsx`, `T/contexto-ia-sem-dado.test.ts`, `T/canais-e5a-portao-t5.test.tsx`, `T/medidas-canal-integracao.test.tsx`, `T/contexto-ia-comparar.test.tsx`, `T/medidas-telas-tracao-72h.test.ts`, `T/historico-e5-derivar.test.ts`, `T/comparar-e5-medidas.test.ts`, `T/thumb-viewer.test.tsx`, `T/contexto-ia-video-estourou-borda.test.ts`, `T/insights-direcao.test.ts`, `T/canais-a5-crescimento.test.ts`, `T/montar-medidas-borda.test.ts`, `T/contexto-ia-canal-medidas.test.tsx`, `T/medidas-telas-frases.test.ts`, `T/outliers-idade-screen.test.tsx`, `T/canais-ri-model.test.ts`, `T/medidas-canal-criador-leitura.test.ts`, `T/historico-e5-estourou.test.tsx`, `T/historico-e5-subida-model.test.ts`, `T/historico-e5-graficos.test.tsx`, `T/medidas-canal-criador.test.tsx`, `T/outliers-idade.test.ts`, `T/contexto-ia-video-comentarios.test.tsx`, `T/medidas-canal-ritmo.test.ts`, `T/contexto-ia-video-medidas.test.tsx`, `T/medidas-canal-linha-do-tempo.test.ts`, `T/historico-e5-horas-model.test.ts`, `T/canais-e5a-tela.test.tsx`, `T/medidas-canal-direcao.test.ts`, `T/medidas-telas-video-fora-da-janela.test.ts`, `T/medidas-canal-cabecalho.test.ts`, `T/comparar-e5-tela.test.tsx`, `T/comentarios-e5-model.test.ts`, `T/medidas-canal-lancamentos.test.ts`, `T/medidas-canal-frase-do-topo.test.ts`, `T/historico-e5-idade-model.test.ts`, `T/canais-a5-numeracao.test.ts`.

Mais `obs-md-nc`/`vb-falhou` fora desses grep: `C/_chrome/medidas/marcas.tsx`, `C/_chrome/medidas/medidas.css:15-16`, `C/_canal/medidas/celulas.tsx`, `ritmo-bloco.tsx`, `direcao-bloco.tsx`, `C/_proprio/video-blocos.css:54` e `video-blocos.tsx`.

**Files:**
- Modify (componente): `C/_chrome/medidas/marcas.tsx:30-38` (`NaoCarregou` é REMOVIDO junto com o `onTentar` que ninguém passa; quem importava passa a `PastilhaAusencia estado="falhou"`), `C/_chrome/medidas/medidas.css:15-16` (remover `.obs-md-nc`), `T/medidas-pecas.test.tsx` (o único que usa `onTentar`)
- Modify (spans inline e importadores, todos no inventário): `C/_canal/medidas/celulas.tsx`, `ritmo-bloco.tsx`, `direcao-bloco.tsx`, `criador-responde.tsx:37` (`NaoCarregou medida="O que o criador respondeu"`), `lancamentos.tsx:113`, `horas-do-canal.tsx:41`, `linha-do-tempo.tsx`, `C/_canais/resumo-bloco.tsx`, `direcao-cell.tsx`, `channel-drawer.tsx`, `C/_comparar/celulas-novas.tsx`, `C/_historico/medidas/horas-72.tsx`
- **Insights e Outliers DENTRO (Yannis I4, escopo "todas as telas do Observatório"):** `C/_insights/direcao-nicho.tsx:83` desenha `nao_carregou` com `obs-ch-nm` (a hachura de "não medido") e escreve "não carregou"; `C/_outliers/idade-ui.tsx:45` escreve "não carregou" com triângulo próprio. Ambas viram `PastilhaAusencia estado="falhou"`. O INVENTARIO do mockup tem o mesmo buraco: avisar Logan e Naksu (fora do mockup aprovado, mesma forma).
- Modify (frases com maiúscula, "Não carregou:" → "A leitura falhou:"): `C/_canal/medidas/frase-do-topo.ts` (2), `criador-model.ts` (2), `criador-lista-model.ts`, `linha-do-tempo-model.ts`, `estado-model.ts` (`pastilha: 'falhou'`, `base: 'falhou'`), `C/_canais/estado-model.ts` (2), `C/_historico/medidas/resumo-model.ts`, `subida-model.ts`, `L/medidas-telas/frases.ts`; e `C/_chrome/comentarios/frases.ts:26` (`abaNaoCarregou`) e `model.ts:347` (tocados também pelo plano dos comentários, ver Ordem)
- Modify (constantes da IA, só a constante, a célula nova é da Task 9): `NAO_CARREGOU_TELA`/`NAO_CARREGOU` em `C/_contexto-ia/empacotar-canais.ts`, `empacotar-canal-medidas.ts`, `empacotar-video-medidas.ts`, `modelo-medidas-comparar.ts` (3) passam a usar a mesma palavra `falhou`, sem a pastilha "Não carregou". Sem isso a varredura não fica verde na 8a (Yannis I3).
- Modify (frase do topo, regra F1): sem botão na 8a, a frase ainda manda recarregar; a troca para a frase sem "recarregue" é da 8b.
- Create: `T/decisao-75-varredura.test.ts` (node)

**Interfaces:**
- Consumes: `PastilhaAusencia` (Task 1). A 8a NÃO usa `BlocoComTentativa`.
- **Minúsculas (cerca de 50 ocorrências em 21 arquivos, p. ex. "a direção do canal não carregou", "Mudanças de campo: não carregou.", "✕ N não carregou", `idade-model.ts`, `direcao-nicho-model.ts`, `view-model.ts` da lista de Canais, `ri-model.ts`):** nem o mockup nem o Logan escreveram texto novo, e o executor NÃO inventa cópia. Ficam numa lista explícita no próprio teste, `PERMITIDAS: arquivo + trecho + razão`, **marcada "para aprovação do Logan"** (troca ou mantém, item a item, antes de ele fechar a 8a). Teste novo falha se surgir minúscula fora da lista. Fora de medida e permitidas sem consulta: `C/_chrome/thumb-viewer/thumb-viewer.tsx:72-73` ("A imagem não carregou." é falha de imagem), `L/medidas-telas/carregar-do-site.ts:121` (mensagem do Sentry; trocar quebra busca e alerta por texto), `src/lib/conferencias.ts:286` (texto de checklist).

- [ ] **Step 1: teste de varredura** `decisao-75-varredura.test.ts`: lê todo `.ts/.tsx/.css` de `C/` e `L/`, descarta linhas de comentário (`//`, `*`, `/*`) e afirma, vetando só o que é rótulo: zero `Não carregou` com maiúscula (rótulo e prefixo de frase); zero `obs-md-nc`, `vb-falhou`, `NaoCarregou`; zero `role="alert"` em arquivo que importa `PastilhaAusencia`; minúsculas só nas `PERMITIDAS`. Testes de bloco (jsdom): `direcao-bloco em nao_carregou → .obs-au-falhou, zero .obs-ch-nm`; `célula do cabeçalho em nao_carregou → pastilha sem botão`; `insights-direcao-screen.test.tsx` e `outliers-idade-screen.test.tsx`: estado de erro → `.obs-au-falhou`, zero `.obs-ch-nm`.
- [ ] **Step 2:** rodar → FAIL (lista as ocorrências).
- [ ] **Step 3:** implementar tudo acima; atualizar os 44 testes.
- [ ] **Step 4:** `npx vitest run T/ > /tmp/d75-t8a.txt 2>&1; grep -E "FAIL|✗|Error" /tmp/d75-t8a.txt | head -40` → só falhas pré-existentes conhecidas (comparar com a base antes de começar: rodar a mesma linha no commit anterior e guardar em `/tmp/d75-base.txt`).
- [ ] **Step 5: commit** `feat: "Não carregou" vira a pastilha falhou e as frases "A leitura falhou:" (decisão 75)`.

### Task 8b: "Tentar de novo" por bloco no canal de fora (C1–C8) — commit separado, revertível

Entre a 8a e a 8b o produto fica como hoje quanto à F1 (sem botão, frase manda recarregar): não regride. A 8b é o único passo sem prova em navegador; isolada, reverte sozinha se o botão se comportar mal.

**Files:**
- Modify: `C/_canal/medidas/blocos-do-canal.tsx` (os sete blocos), `frase-do-topo.ts:96` (vira `A leitura falhou: não deu para ler as medidas deste canal agora. Os números abaixo não valem.`, cópia do mockup T8, sem "recarregue"), `direcao-bloco.tsx`, `ritmo-bloco.tsx`, `lancamentos.tsx`, `horas-do-canal.tsx`, `linha-do-tempo.tsx`, `criador-responde.tsx`
- Test: `T/medidas-canal-integracao.test.tsx` (já monta a página com carregador que rejeita, linhas 109-168)

**Interfaces:**
- `BlocoComTentativa` (Task 2) envolve, SEMPRE (nos dois ramos), a frase do topo da página do canal e os blocos Direção, Ritmo, Lançamentos, 72 horas, Linha do tempo, O que o criador respondeu. O valor que substitui a pastilha no sucesso leva `data-valor`. Células de cabeçalho, linhas de tabela, lista de Canais e gaveta: só a pastilha, sem botão.
- **Cache (verificado por Yannis, sem parar):** a falha NÃO fica em cache. `viaCache` (`L/medidas-telas/carregar-do-canal.ts:83-90`) e `lerPlanosDoCanal` (`carregar-do-site.ts:180-190`) lançam DENTRO do `unstable_cache` (`ParteNaoLida`, `LeituraParcial`, `ExtrasNaoLidos`) e o Next não guarda o que lança; `canal/[id]/page.tsx:28` é `force-dynamic`; o `.catch(canalNaoCarregou)` (`canal-derivado-async.ts:17`) roda por requisição. O `router.refresh()` relê de verdade. Sem passo de "parar e devolver".
- **`criador-responde.tsx`:** além do bloco inteiro, cobrir a falha SÓ DA LISTA (bloco medido, lista não lida: `criador-responde.tsx:50`, `m.tipo === 'nao_carregou'` da lista): pastilha `falhou` + frase "A leitura falhou:" própria da lista, com o botão do mesmo `BlocoComTentativa`; teste com bloco `ok` e lista `nao_carregou`.

- [ ] **Step 1: testes de página** em `medidas-canal-integracao.test.tsx` (prova no degrau da página, sem gancho no produto; Yannis I5b): `const el1 = await BlocosDoCanal({ medidas: Promise.reject(...), contexto })`, `render(el1)`, clicar "Tentar de novo" no bloco Direção, `rerender(await BlocosDoCanal({ medidas: Promise.resolve(okFixture), contexto }))` e afirmar "Medidas lidas agora." e foco no `[data-valor]` (falha se algum bloco trocar a posição do `BlocoComTentativa` entre os ramos). Mesma página em erro → `.obs-au-falhou` em cada bloco, zero "Não carregou", frase do topo sem "recarregue". Falha total do canal: sete blocos e o topo falham juntos; com `soPastilha` aprovado, só o topo leva botão e há um `role="status"` (M5), sem a aprovação, oito.
- [ ] **Step 2:** `npx vitest run T/medidas-canal-integracao.test.tsx T/ausencia-tentar-de-novo.test.tsx > /tmp/d75-t8b.txt 2>&1` → FAIL. **Step 3:** implementar. **Step 4:** PASS.
- [ ] **Step 5: commit** `feat: Tentar de novo por bloco no canal de fora (decisão 75)`.

### Task 9: Pacote da IA: falhou e restrito com as mesmas palavras, negado nunca zero (D1)

**Files:**
- Modify: `L/contexto-ia/tipos.ts:9-10`, `L/contexto-ia/frases.ts:51` (+ registro de fragmentos ~linha 129), `L/contexto-ia/segmentar.ts:79,89,109-120,225-232`, `L/contexto-ia/mascarar.ts:14`, `C/_contexto-ia/empacotar-canais.ts:293,314`, `empacotar-comparar.ts` (cartão e números), `empacotar-canal-proprio.ts:96-97,99,104` (a linha 99, `vpdDiario: medida(v.vpdDiarioText, 'não medido')`, passa a `ausente(v.vpdDiarioEstado, v.vpdDiarioMissing, …)`; Phil I4), `empacotar-canal-medidas.ts:339`, `empacotar-video-medidas.ts:321`, `empacotar-canal.ts:138`
- Test: `T/contexto-ia-sem-dado.test.ts`, `T/contexto-ia-canais.test.tsx`, `T/contexto-ia-comparar.test.tsx`, `T/contexto-ia-canal-proprio.test.tsx`, `T/contexto-ia-varredura-de-saida.test.ts`

**Interfaces:**
- `Celula` ganha `| { papel: 'numero'; estado: 'falhou' | 'restrito'; motivo: string; origem: string }`.
- `frases.ts`: `export const falhou = (motivo: string) => \`falhou (${motivo})\``; `export const restrito = (motivo: string) => \`restrito (${motivo})\``; registro `{ id: 'falhou', fragmentos: ['falhou ('] }`, `{ id: 'restrito', fragmentos: ['restrito ('] }`.
- `segmentar.ts`: texto e JSON da célula para os dois estados novos (`{ estado, motivo }`); `Contagem` ganha `falhou` e `restrito` à parte (a soma em `naoMedidos` continua só para o registro, `contexto-ia-actions.ts:99`, sem mudar nome nem schema); `contar` vira `switch (c.estado)` com `never` (hoje é `if nao_medido … else`, e um estado novo esquecido contaria como zero medido e como `privadosMedidos`; Phil I1); com `falhou > 0` a primeira linha de aviso é a de falha ("N números não foram lidos agora; não são zero nem falta de dado"), não o `avisoMagro`; `mascarar.ts` trata `motivo` dos dois.
- Cada empacotador: o helper local `naoMedido(motivo, origem)` ganha a irmã `ausente(estado: EstadoAusencia, motivo, origem)`; usar onde o modelo (Tasks 3–5) dá `ausencia`/`…Estado`. `nao_carregou` dos modelos do canal de fora → `falhou`. **Célula `restrito` só quando o modelo disse `restrito`** (que só acontece com `negativa === 'sem_direito'`); guarda caída sai `falhou (…)`, coerente com o cabeçalho do pacote ("não conferido", `empacotar-canais.ts:510-511`, `empacotar-canal-proprio.ts:781`). A 8a já trocou as constantes `NAO_CARREGOU*`.
- [ ] **Step 1: testes**: `vpd próprio negado na lista → célula "restrito (…)"`, `erro → "falhou (…)"`; `cartão do Comparar negado → restrito`; `nenhuma célula de estado falhou/restrito tem x ou texto "0"` (Review Focus 5); `vpdDiario` (`:99`): diário negado com `sem_direito` → `restrito (…)`, erro → `falhou (…)`, nunca o literal "não medido" nesses estados; `guarda caída → falhou (…), nunca restrito`; `contagem: falhou e restrito contados à parte e somados em naoMedidos só no registro`; `pacote com 10 células falhou → aviso de falha, não avisoMagro; zerosMedidos === 0 e privadosMedidos === 0`; `estado novo desconhecido não compila (never)`; varredura de saída aceita os fragmentos novos e PASSA a rejeitar "Não carregou" (a regra não existe hoje em `T/contexto-ia-varredura-de-saida.test.ts`; acrescentar o caso; Yannis M6). Conferência pós-deploy: pacote da IA como dono, `grep -c "restrito ("` = 0.
- [ ] **Step 2–4:** FAIL → implementar → PASS (os 5 arquivos + `T/contexto-ia-*.test.*` inteiro, saída em arquivo).
- [ ] **Step 5: commit** `feat: pacote da IA escreve falhou e restrito, negado nunca zero (decisão 75)`.

### Task 10: e2e do Gio, allowances e roteiro (D3)

**Files:**
- Create: `apps/web/e2e/tests/cms/observatorio/decisao-75.spec.ts`
- Modify: `apps/web/e2e/tests/cms/observatorio/allowances.ts` (só se um spec de fidelidade quebrar por causa da decisão 75), `docs/superpowers/mockups/ROTEIRO-DE-TESTE-E-MELHORIAS.md`

- Rodada única do Gio junto com a Task 7 do plano dos comentários (CQ T7), ver Ordem.
- [ ] **Step 1: spec** (padrão de `proprio-a4-comparar-seguranca.spec.ts`: `ADMIN_STATE` e `.auth/reporter.json`, capas por `route`):
  - restrito: reporter abre canal próprio, vídeo próprio e Comparar → `.obs-au-restrito` nas células de alcance, nenhuma `.obs-ch-nm` nelas, nenhum número de alcance no HTML; admin vê números e nenhuma `.obs-au-restrito`.
  - lista de Canais (reporter): linha própria com restrito na coluna de views por dia; linhas de concorrente sem restrito.
  - canal de fora: zero ocorrência de "Não carregou" em texto visível de Canais, canal, Histórico e Comparar.
  - 390 e 1440: `.obs-au-retry` (quando presente) com altura ≥ 44 e sem rolagem horizontal; pastilhas `nowrap` não estouram a célula.
  - acessibilidade: nenhuma `[role=alert]` nas telas com pastilha.
  - Erro de leitura e os três estados do "Tentar de novo" não têm como ser provocados no servidor pelo e2e hoje: ficam provados pelo núcleo `proximaFase` (Task 2), pelos testes de página (Task 8b) e de tela (Task 6) e pela conferência visual abaixo; gatilho para o Gio provar em navegador: a primeira falha real vista no Sentry com a tela aberta. Não criar gancho de falha no produto para isso.
- [ ] **Step 2:** rodar a pasta `e2e/tests/cms/observatorio/` inteira com saída em arquivo; para cada spec de fidelidade que quebrar por texto ou classe trocado pela decisão 75, acrescentar a `allowances.ts` UMA entrada por elemento com a regra `D75 (17/10): erro e negado deixaram de ser "não medido"`; nada além disso. Hoje nenhum spec cita "Não carregou"; `proprio-e5b-n2.spec.ts:369` ("não conseguimos ler agora") é da origem (A19/A20, sem mudança) e deve continuar passando.
- [ ] **Step 3: conferência visual do Gio** (capturas em arquivo, veredito em texto): escuro, claro e modo cinza, 390 e 1440, das telas T1–T9 do mockup contra o `index.html`; leitor de tela anuncia uma vez por lista.
- [ ] **Step 3b: como dono (Phil, pós-deploy):** abrir canal próprio e Comparar como dono (edita): esperado zero `.obs-au-restrito`; qualquer cadeado visto pelo dono = C1 não consertado. Como reporter: cadeado nas células de alcance, nenhum número no HTML.
- [ ] **Step 4:** acrescentar ao `ROTEIRO-DE-TESTE-E-MELHORIAS.md` a seção da decisão 75 (o que o dono testa no Opera: reporter vê restrito; "falhou" no canal de fora; "Tentar de novo"; registrar que `calculo_falhou` é erro de código e o botão dá "Falhou de novo" sempre, Phil M2). Dimensionar C1: consulta do dono ao Sentry pela tag `guarda_falhou`. Sugestões de rodada 2 que ficaram para depois: `.dir` com `min-height:44px` para não pular no sucesso (Naksu R2.2), reutilizar `BlocoComTentativa` no "Tentar de novo" da origem (`C/_proprio/origem-periodos.tsx:67`).
- [ ] **Step 5: commit** `test: e2e da decisão 75, allowances D75 e roteiro`.

---

## Ordem de commits e dependências

Ordem com o plano dos comentários (`2026-10-17-a5-comentarios-producao-plan.md`; decisão do Yannis no CQ): **D75 T1–T2 → comentários (T1, T2, T3+T4+T6a, T5+T6b)**, com **D75 T3–T5 em paralelo em worktree separado** (nunca em paralelo entre si no mesmo worktree: o pre-commit vê o arquivo não commitado do vizinho; em série, ou um worktree por executor) → **D75 T6–T9 sobre os comentários** → **D75 T10 junto com CQ T7 numa rodada só do Gio**.

Dentro do lote: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8a → 8b → 9 → 10. As Tasks 1–5 são aditivas (a tela não muda); 6 depende de 3–4; 7 de 5; 8a de 1; 8b de 2 e 8a; 9 de 3–5 e 8a. Cada commit passa no pre-commit sozinho. Entre 6 e 9 o pacote da IA e a tela usam palavras diferentes: só staging; promoção para `main` depois da 9 (ou da 8b se a 9 atrasar, divergência no ledger). Política de push: o executor nunca dá push.

Reversão: 8b e 9 revertem sozinhas; 1–8a só em bloco.

## Riscos

- **Conflito com o plano dos comentários:** são pelo menos sete arquivos, não dois: `C/_chrome/comentarios/model.ts` e `frases.ts`, `C/_canal/medidas/criador-responde.tsx` (onde está o `NaoCarregou`), `criador-lista-model.ts` e `criador-model.ts` (frases "Não carregou:"), `blocos-do-canal.tsx` (onde a 8b envolve os blocos) e `C/_contexto-ia/empacotar-canal-medidas.ts` (Task 9). Os comentários entram primeiro nesses arquivos (reescrevem o componente; a troca da 8a é mecânica e se refaz em minutos sobre o código novo); a varredura da 8a impede o outro plano de reintroduzir "Não carregou". Ordem fixada na seção anterior.
- **Task 8 era grande:** dividida em 8a (sem botão, um commit pela regra do Logan) e 8b (botão, revertível). A varredura é o que torna a 8a revisável; as minúsculas dependem da lista aprovada pelo Logan.
- **Retry sem efeito:** cache verificado, a falha não é guardada (Task 8b). O estado do `BlocoComTentativa` só sobrevive ao `router.refresh()` no mesmo lugar da árvore nos dois ramos; o teste de página da 8b é o que prova isso.
- **`semNumero` do % assistido muda de texto** ("sem acesso" → "restrito") na Task 6: o pacote da IA (`empacotar-canal-proprio.ts:104,638,669`) lê `semNumero` como motivo; o teste da Task 9 cobre.
- **Guarda caída (C1):** vira `erro`/`falhou`, sem botão nos blocos do canal próprio (só há botão no canal de fora); a frase manda recarregar a página (regra F1).
- **Fidelidade contra mockups antigos**: telas que no mockup antigo tinham hachura para negado vão diferir; allowance só com a regra D75, por elemento.
- **Tema claro**: os `--res-*` claros são do mockup, não confirmados pelo dono no Opera (o tema claro inteiro ainda é pendência D7 da A1).

## Emenda 17/10 (rodada 2)

Achado → onde foi resolvido.

| Achado | Resolução |
|---|---|
| Phil C1 (guarda caída vira restrito) | Global Constraints; Review Focus 6; Task 1 (`ausenciaDoAcesso` com `negativa`); Task 4 (produtores devolvem `erro`, `dados-termos.ts:28`); Task 5 (`privadoDaLista` preenche `negativa`); Task 9 (célula `restrito` só com `sem_direito`); Task 10 passo 3b |
| Phil I1 (aviso magro com falha, `contar` aberto) | Task 9 (`Contagem` com `falhou`/`restrito`, `switch` com `never`, aviso de falha primeiro) |
| Phil I2 (contrato A23 de `lerDadosDoVideo`/`dados-trocas`) | Task 4 (tabela por produtor) |
| Phil I3 (chave ausente vira estado) | Global Constraints; Task 5 (`carregar-extras.ts:37,63`, `numeros-model.ts:187`, `view-model.ts:387` → `falhou`) |
| Phil I4 (`vpdDiario` `:99`) | Task 9 (arquivos e teste) |
| Phil M1 (`sem_permissao` global) e Yannis I7 | Task 1 (`ausenciaDoMotivoNaoMedido(m, {proprio})`, `nao_pedido` como decisão do Phil fora do lote); Task 5 (teste do lado concorrente) |
| Phil M2 (casos ambíguos, `Falta` inalcançável, `calculo_falhou`) | Task 3 (dois casos separados); Task 5 (`nao_carregou` desenha `falhou`); Task 10 passo 4 (roteiro) |
| Yannis I1 (inventário metade) | Task 8a (75 ocorrências/38 arquivos e 44 testes, por grep; fonte da verdade é a varredura) |
| Yannis I2 (escopo da varredura) | Task 8a (veta só rótulo com maiúscula, `obs-md-nc`, `NaoCarregou`; minúsculas em lista `PERMITIDAS` "para aprovação do Logan"; Sentry, imagem e checklist permitidos) |
| Yannis I3 (8 não fica verde; divisão) | Task 8a/8b; constantes `NAO_CARREGOU*` da IA na 8a |
| Yannis I4 (Insights e Outliers) | Task 8a (dentro, com testes); aviso a Logan e Naksu |
| Yannis I5 (teste do "Tentando…", prova na página) | Task 2 (`proximaFase` em node, mock de `useTransition`); Task 8b (teste de página em `medidas-canal-integracao`) |
| Yannis I6 (conflito com comentários) | Ordem de commits; Riscos (sete arquivos, ordem fixada); `criador-responde.tsx` com falha só da lista na 8b |
| Yannis M1 (Task 4 não aditiva) | Task 4 só acrescenta; troca de `semNumero`/remoção de `rotulo` na Task 6 |
| Yannis M2 (política de push, reversão) | Global Constraints; Ordem de commits |
| Yannis M3 (3–5 em paralelo) | Ordem de commits (worktree separado ou série) |
| Yannis M4 (rede caída) | Review Focus 3; Task 2 (frase "Falhou de novo. Tente mais uma vez.", texto é do Logan) |
| Yannis M5 (oito botões) | Task 2 (`soPastilha`, para aprovação do Logan); Task 8b |
| Yannis M6 (varredura da IA "passa a rejeitar") | Task 9 |
| Yannis M7 (`PastilhaAusencia` sem `server-only`) | Task 1 |
| Yannis M8 (mapa em vez de switch) | Task 1 (`Record<MotivoNaoMedido, …>`) |
| Remoção do "parar e devolver" de cache | Task 8b (cache verificado, falha não é guardada) |
| Phil: conferência pós-deploy | Task 10 passo 3b; Task 9 (`grep -c "restrito ("`) |
