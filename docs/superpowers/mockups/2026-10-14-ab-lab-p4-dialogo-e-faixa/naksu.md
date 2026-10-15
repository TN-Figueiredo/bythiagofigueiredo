# Revisão Naksu (UI): A/B Lab P4, diálogo "Encerrar teste" e faixa de restauração

Método: Playwright headless (chromium) sobre `file://`, 1440 e 390 px, claro e escuro, P4a e P4b (8 capturas de página inteira em `shots/p4{a,b}-{dark,light}-{1440,390}.png`, mais recortes `shots/crop-*` e `shots/p4b-light-1440-cinza.png`). Contraste calculado a partir das cores lidas da página, transparências compostas contra o fundo real. Dado hostil: título de 140 caracteres sem espaço injetado na opção A a 390 px (sem rolagem horizontal, `scrollWidth` 390). Comparado com `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-end-test-dialog.tsx` e `globals.css`.

## Veredito: VOLTA PARA AJUSTE (P4a e P4b iguais nos achados; os de P4b-só estão marcados)

## O que acerta (preservar)
- Estados com cor E forma E texto: octógono "Erro:", triângulo "Atenção:", relógio tracejado "não medido", spinner "em andamento", check "voltou". Em cinza (`shots/p4b-light-1440-cinza.png`) os cinco continuam distintos pelo ícone e pelo rótulo. "Não medido" (F) é estado visível.
- Régua visual da borda esquerda de 5 px na cor do pior estado, linha por campo com ícone próprio, ação de dispensar nomeada ("Já corrigi no YouTube: dispensar aviso").
- Sem rolagem horizontal em nenhuma combinação (`scrollWidth` = 390 e 1440 nas 8). Título longo quebra (`overflow-wrap:anywhere`, clamp de 3 linhas). Foco visível (outline 2 px sólido `--accent`) em todos os controles; 7 Tabs conferidos.
- Todo texto de leitura >= 12 px (exceto o selo, ver F9); botão primário 7,51:1 (escuro) e 5,18:1 (claro); `.btn.danger` 11,09:1 e 5,63:1.

## Achados

### F1 [corrige] Diálogo estoura a altura da tela a 390 px (todos os temas)
Alturas medidas a 390 px: 644, 668, 668, 496, **759**, 470 px. Em 667 px de altura (iPhone SE) os diálogos 1, 2, 3, 5 passam da tela; o rodapé com "Encerrar" fica inalcançável (não há scrim com rolagem nem `max-height`). Com 3 opções e títulos de 3 linhas, o caso real é pior que o do mockup.
Correção:
```css
.dlg{max-height:calc(100dvh - 24px);display:flex;flex-direction:column}
.dlg-b{overflow:auto;min-height:0}
.dlg-h,.dlg-f{flex:none}
.stage{align-items:center}
```
No real: o contêiner `fixed inset-0` precisa do mesmo `max-height` no painel; hoje `ab-end-test-dialog.tsx` não tem.

### F2 [corrige] Alvos de toque abaixo de 44 px
Medidos (1440 e 390): `.x` 30x30; `.btn` (Cancelar, Encerrar, Voltar, Trocar...) altura 38; `.btn.sm` 32 (Tentar agora, Já corrigi...); `a.lnk` 20 de altura; radio nativo 16x16 (o `label.opt` inteiro é alvo e passa). 
Correção:
```css
.x{width:44px;height:44px}
.btn{min-height:44px}
.btn.sm{min-height:44px;padding:8px 12px}
.lnk{display:inline-flex;align-items:center;min-height:44px}
```
Observação: o `.btn.sm` do CMS real (`youtube-motion.css`, `[data-cms-section="youtube"] .btn`) também é menor que 44; é pendência do CMS, mas estas telas novas não devem herdá-la (declarar a variação `.btn.touch` ou aplicar o mínimo só dentro de `.dlg` e `.band`).

### F3 [corrige] Contraste de texto abaixo de 4,5:1 (`.fine` e `.lnk`)
| Par | Tema | Medido | Mínimo |
|---|---|---|---|
| `.fine` (`--dim` #928871) sobre faixa `.band.warn` (57,42,19) | escuro | **3,96** | 4,5 |
| `.fine` sobre `.band.err` (56,29,27) | escuro | **4,39** | 4,5 |
| `.lnk` (`--accent` #B94210) sobre `.band.err` (240,220,211) | claro | **4,14** | 4,5 |
| `.lnk` sobre `.band.warn` (238,225,202) | claro | **4,21** | 4,5 |
Correção (valores conferidos por cálculo: 5,76 / 5,17 escuro; 5,46 / 5,59 claro):
```css
.band .fine{color:var(--muted)}
[data-theme="light"] .band .lnk{color:#9A360D} /* = --theme-accent-hover do globals.css */
```

### F4 [corrige] Os tokens do mockup não são os do CMS real; a faixa reprova com os reais
Mockup: `--muted` escuro #A89D86, claro #5F5540; `--dim` claro #6A5F48. Real (`globals.css`): `--theme-cms-text-muted` escuro #958A75, claro #6A5F48; `--theme-cms-text-dim` claro #756A51. Com os reais, o texto secundário dentro da faixa mede: muted escuro 4,54 (err) e **4,07** (warn); dim claro **4,03** (err) e **4,13** (warn). O mockup aprova com cor mais forte do que o produto entrega. Também são valores soltos sem token real: `--ok/--warn/--err/--info` de texto e as `*-line` (usar `--cms-green/amber/red/cyan`, `--cms-red-soft`, `--cms-cyan-soft` que existem), `--none`, `#8A5A00` (inline no claro do `.btn.danger`), `--accent-line`.
Correção: usar os valores reais dos tokens e, onde não alcançam 4,5:1 sobre fundo tingido, declarar a extensão: `.band .fine{color:var(--text)}` (13 px, sem cor de apoio) ou token declarado `--band-fine`. Comentário no topo do CSS: `/* tokens = CMS + extensão declarada */`.

### F5 [corrige] Acessibilidade do diálogo contra a linha 10 da spec
Falta ou diverge:
1. Diálogos 2, 3 e 6 sem `aria-describedby` na frase "No ar agora…". Correção: `id="d2d"`/`"d3d"`/`"d6d"` no `<p class="state">` e `aria-describedby` correspondente.
2. Diálogos 4 e 5 descrevem só `.lead`; a consequência (`.tiny`) fica fora. Correção: `aria-describedby="d4d d4n"` com `id="d4n"` no `.tiny`.
3. Radio sem `name` e sem `required` no diálogo 2 (somente leitura, aceitável); no real `ab-end-test-dialog.tsx` o diálogo usa `aria-label` e a lista sem `fieldset/legend`: o real precisa migrar para `aria-labelledby` + `fieldset`/`legend`, como o mockup mostra.
4. Dois anéis de foco no radio: `input:focus-visible` (outline 2 px, nativo do `:focus-visible` global) E `.opt:has(input:focus-visible)` (outline 2 px). Medido: ambos `solid`. Correção: `.opt input:focus-visible{outline:none}` e manter só o anel do `.opt`.
5. A 390 px `.dlg-f{flex-direction:column-reverse}` inverte a ordem visual (Encerrar acima de Cancelar) contra a ordem do DOM e do Tab (2.4.3). Correção: DOM `Encerrar, Cancelar` e, no desktop, `.dlg-f{flex-direction:row-reverse;justify-content:flex-start}` para Cancelar ficar à esquerda; a 390 px `flex-direction:column`. Visual e Tab batem nos dois tamanhos.
6. A dica "Escolha uma opção." vira `display:none` ao escolher; `aria-describedby` do botão passa a apontar para elemento oculto. Aceitável, mas então remover o atributo no script: `go.removeAttribute('aria-describedby')`.
7. O estado de foco inicial no primeiro radio e o trap de Tab não são demonstráveis em mockup estático; o mockup só simula "Voltar" focado no diálogo 4 por `style` inline (que vira classe `.is-focus` ou fica sem inline). Não testado: Tab preso, Esc, retorno do foco.

### F6 [corrige] Opção desabilitada com `opacity:.62` derruba a informação "no ar agora"
Diálogo 2: o selo "no ar agora" mede **3,35:1** (escuro) e **2,72:1** (claro) por herdar a opacidade do `label.opt.dis`; é o único lugar que diz qual variante está no ar enquanto troca. Desabilitado é isento do WCAG, mas a informação precisa ficar legível.
Correção: remover a opacidade do contêiner e escurecer só o que é inativo:
```css
.opt.dis{opacity:1;cursor:default}
.opt.dis .th{opacity:.55}
.opt.dis .ttl,.opt.dis .who{color:var(--muted)}
```
Selo continua 6,25:1 (escuro) e 5,65:1 (claro), valores medidos no estado normal.

### F7 [corrige] Miniatura sem estado de falha, sem dimensão real
`.th` é um gradiente de mentira: o real é `<img>`. Faltam: `width`/`height` declarados (pula o layout; o real usa 56x32, o mockup 84x47 a 1440 e 64x36 a 390, três tamanhos), `alt=""` (o título vizinho já nomeia), estado de imagem que não vem (bloco `--surface3` com ícone de imagem quebrada e o texto "Sem imagem"), e o original "guardado em baixa resolução" (A) pede um selo de forma, não só a linha cinza de 12 px. O texto branco sobre gradiente mede 2,31:1 no trecho amarelo (#d9a04a), mas é decorativo (`aria-hidden`); no real vale a imagem do YouTube.
Correção: `img.th{width:84px;aspect-ratio:16/9;object-fit:cover;background:var(--surface3)}` e `@media(max-width:520px){img.th{width:64px}}`, com `onError` trocando por `.th.fail`.

### F8 [corrige] Componentes duplicados em vez de reusar o CMS
- Diálogo: reusar `YtPortal` + `useModalFocusTrap` (já em `ab-end-test-dialog.tsx`); o mockup redesenha o contêiner com paddings 16/18 (real 18/20), opção 10 (real 12) e título 13/12,5 (real 13/11,5). Declarar a divergência ou alinhar ao real.
- Botão X: real é `.ic-btn`; o mockup `.x` próprio (30 px). Usar `.ic-btn` com mínimo de 44 px (F2).
- Faixa: já existem `ab-primitives.tsx`, `early-band.tsx` e `dots.tsx` na pasta; a faixa com cinco estados deve nascer como UM componente `<FaixaRestauracao estado=... />` (variantes `err|warn|ok|busy|none`), não cinco blocos de marcação. As linhas `.row` repetem o padrão ícone + campo + descrição: um `<LinhaCampo>`.
- Pill de estado do teste ("Encerrando", "Encerrado sem vencedor") é neutra nos cinco casos; em A ("Encerrando") deveria usar a cor `busy` do selo e o ícone do estado, senão a cor da faixa e a do pill disputam. Sugestão.

### F9 [sugestão] Selo e texto pequenos
`.badge` e `.tag` a 11 px (3 ocorrências <12 px medidas). Texto de leitura abaixo de 12 px é achado: subir `.badge` para 12 px (`font-size:12px;line-height:16px`); `.tag` é meta do mockup, não vai ao produto.

### F10 [sugestão] Botão de aviso (`.btn.danger`) em âmbar
O nome diz "danger" e a cor é `--warn` (âmbar); no resto da tela âmbar = "atenção, nada alterado". Aqui significa "ação destrutiva confirmada". Funciona (11,09:1 / 5,63:1) mas o claro usa `#8A5A00` solto. Usar `--cms-amber` com `color:var(--cms-on-accent)` e declarar o caso "ação que sobrescreve edição de terceiros" como variação do `.btn`, ou manter o primário (acento) e deixar o âmbar só no ícone do cabeçalho.

### F11 [sugestão] Movimento
`prefers-reduced-motion` respeitado no `.spin`; sem animação além disso. Com `animation:none` o ícone `i-busy` fica estático (arco parado), que ainda diz "em andamento" pelo texto. OK.

### F12 [sugestão] Compatibilidade (Opera)
Nenhum `color-mix()` no arquivo (busca no `index.html`: zero ocorrências). Dependências de recurso: `:has()` (`.opt:has(input:checked)`): suportado no Opera moderno (Chromium 105+); a seleção ainda é dita pelo radio nativo, então a perda seria só estética. `-webkit-line-clamp` ok. Todas as cores estruturais são hex ou `rgba` literais. Não testei no Opera de verdade.

## Tabela de medidas

| Item | Tema | Valor | Limite | Estado |
|---|---|---|---|---|
| `--text` sobre `--surface` | ambos | > 12 | 4,5 | ok |
| Hint/`.sub` (`--dim`) sobre surface | escuro / claro | 4,72 / 5,83 | 4,5 | ok |
| `.lbl` Erro / Atenção / Em andamento (escuro) | escuro | 5,58 / 8,33 / 6,81 | 4,5 | ok |
| `.lbl` Erro / Atenção / Em andamento (claro) | claro | 5,55 / 5,56 / 5,43 | 4,5 | ok |
| `.fine` em faixa warn / err | escuro | 3,96 / 4,39 | 4,5 | reprova (F3) |
| `.lnk` em faixa err / warn | claro | 4,14 / 4,21 | 4,5 | reprova (F3) |
| Selo "no ar agora" no estado normal | escuro / claro | 6,25 / 5,65 | 4,5 | ok |
| Selo no `.opt.dis` (opacity .62) | escuro / claro | 3,35 / 2,72 | 4,5 | reprova (F6) |
| Botão desabilitado (texto `--dim` sobre `--surface3`) | escuro / claro | 4,51 / 4,73 | isento | ok |
| Borda do botão desabilitado | escuro | 1,22 | isento (desabilitado) | aceito |
| Borda `--border2` do botão secundário sobre surface | escuro / claro | 1,44 / 2,15 | 3,0 (componente) | reprova; mesma pendência do CMS inteiro (spec, linha 12: usar `--dim`/`--muted` onde a borda identifica o controle) |
| `.btn.pri` texto sobre acento | escuro / claro | 7,51 / 5,18 | 4,5 | ok |
| `.btn.danger` | escuro / claro | 11,09 / 5,63 | 4,5 | ok |
| Alvo `.x` / `.btn` / `.btn.sm` / `.lnk` / radio | 1440 e 390 | 30 / 38 / 32 / 20 / 16 px | 44 | reprova (F2); label.opt inteiro passa |
| Altura do diálogo a 390 px | 390 | 644, 668, 668, 496, 759, 470 | <= viewport | reprova (F1) |
| Altura a 1440 px | 1440 | 527, 551, 571, 372, 418, 386 | | ok |
| Rolagem horizontal | 390, 1440, 8 combinações + título de 140 caracteres | 0 | 0 | ok |
| Texto < 12 px | | 11 px (`.badge`, `.tag`) | 12 | sugestão (F9) |
| Valores soltos | | `#8A5A00`, `#1A120A` no `.danger`; gradientes; `--none`; `--accent-line`; tokens `muted/dim` diferentes do real | usar `--cms-*` | F4 |

## Não verifiquei
Leitor de tela, Tab preso e Esc (mockup estático), Opera de verdade, aparelho real, rede lenta, imagem do YouTube que não carrega (simulado só em texto, F7), hover e estado pressionado.

## De acordo?
**NÃO DE ACORDO** até F1, F2, F3, F4, F5 e F6 serem aplicados. F7 e F8 precisam de decisão do desenhista (podem ficar declarados). Nenhuma discordância de UX para o Logan; uma nota: se o F5.5 mudar a ordem do botão primário no mobile, o Logan deve confirmar.

---

## Rodada 2

Método: Playwright sobre `file://`, 1440 e 390 px (altura 667), claro e escuro, P4a e P4b (8 capturas em `shots/v2-naksu/p4{a,b}-{dark,light}-{1440,390}.png`, mais `hostil-{dark,light}-390.png` com título de 140 caracteres sem espaço na opção B). Contraste recalculado a partir das cores lidas da página (transparências compostas contra o fundo real) e comparado com `globals.css` real: `--muted`, `--dim`, `--text`, superfícies e `--theme-accent-hover` do mockup agora são idênticos aos reais (escuro #958A75/#928871, claro #6A5F48/#756A51). Os tokens "ext" (`--ctl`, `--band-sub`, `--t-ok/warn/err/info`, `*-line`) não existem no CMS; medi cada um em uso real (tabela abaixo).

### Veredito por achado
| Achado | Veredito | Evidência |
|---|---|---|
| F1 altura a 390 | FECHADO | diálogo 643 px (= 667 - 24) em todos; 5b rola no corpo (scrollHeight 739 > clientHeight 451), rodapé dentro do painel; título de 140 caracteres: `scrollWidth` 390, altura continua 643 |
| F2 alvos 44 px | FECHADO | `.x`, `.btn`, `.btn.sm`, `.lnk` >= 44 de altura (zero falhas fora da `.bar` do mockup, que é chrome da página e não vai ao produto); radio 16 px dentro de `label.opt` inteiro |
| F3 contraste fine/lnk | FECHADO | ver tabela (mín. 5,58) |
| F4 tokens | PARCIAL: ver R2-1 | muted/dim iguais aos reais; ext declarados no topo do CSS; um ext sem marca e que diverge do real |
| F5 acessibilidade | PARCIAL: ver R2-2 | 5.1 só nos diálogos 2/2b ainda sem describedby; 5.2 `d4d d4n`, `d5d d5n`, `d5bd d5bn` ok; 5.4 `input:focus-visible` outline none, anel só no `.opt` (2 px sólido); 5.5 DOM Encerrar|Cancelar e visual idem nos dois tamanhos (a 390 px, `column`, primário em cima, igual ao DOM); 5.6 `removeAttribute` presente |
| F6 selo "no ar agora" no `.dis` | FECHADO (selo 6,33 escuro / 5,85 claro) com resíduo: R2-3 | |
| F7 miniatura | FECHADO | `.th.fail` com ícone e "Sem imagem", `aspect-ratio:16/9`, `.badge.low` com borda tracejada e ícone |
| F8 componentes | FECHADO como declarado | bloco "Para o componente real" (YtPortal, `useModalFocusTrap`, `.ic-btn`, `FaixaRestauracao`, `LinhaCampo`) |
| F9 11 px | FECHADO | zero texto < 12 px fora de `.th` (miniatura decorativa `aria-hidden`) |
| F10 `.btn.over` | FECHADO como variação declarada (8,62:1 nos dois temas, texto `#1A120A` = `--color-cms-on-accent` real) | |
| F11, F12 | sem mudança; `color-mix` zero ocorrências; `:has()` só estético | |

### Achados novos
**R2-1 [corrige] `--on-accent` claro #FFF8F0 não tem a marca "ext" e diverge do produto.** Real: `youtube-motion.css:264` e `--color-cms-on-accent` = #1A120A nos dois temas; sobre o acento claro #B94210 isso dá 3,39:1 (reprova). O mockup aprova com #FFF8F0 (5,18:1), cor que o produto não entrega. Correção: marcar a linha como `/* ext: no claro o CMS usa #1A120A (3,39:1, reprova); proposta #FFF8F0 5,18:1 */` e registrar no ROTEIRO como pendência do CMS (`[data-cms-section="youtube"] .btn.primary` no tema claro). Escuro confere: #1A120A sobre #FF8240 = 7,51:1.

**R2-2 [corrige] Diálogos 2 e 2b (encerrando e sem resposta) continuam sem `aria-describedby`.** `<p class="state">` sem id. Correção: `id="d2d"` nele e `aria-describedby="d2d"` no `.dlg` (e `d2bd` no 2b). Os 8 diálogos devem ter o atributo (hoje 6 de 8; ids existentes resolvem todos).

**R2-3 [corrige] Opção desabilitada E selecionada (`.opt.dis.sel`) no escuro: título e rótulo "B" medem 3,99:1** (`--muted` #958A75 sobre `--accent-soft` composto); é a variante que está sendo aplicada. Claro 5,06 (ok). Correção: `.opt.dis.sel .ttl,.opt.dis.sel .who{color:var(--text)}`.

**R2-4 [sugestão] Barra esquerda de 5 px da faixa no claro:** 1,91 (warn), 2,16 (busy), 3,35 (err) contra o fundo. Não é bloqueio, porque o estado também vem por ícone, rótulo e texto, mas a "régua do pior estado" some no claro. Correção: no claro, `border-left-color` = `--t-warn`/`--t-info`/`--t-err` (7A4E00 / 0B5F82 / A4261B, todos >= 5,5 sobre #F7F1E8).

### Medidas (tokens reais + ext medidos)
| Par | Escuro | Claro | Mín. |
|---|---|---|---|
| `.fine` (`--band-sub`) em faixa err | 8,41 | 9,09 | 4,5 |
| `.lnk` em faixa warn / err | 5,76 / 6,22 | 5,90 / 5,58 | 4,5 |
| `.row .d` em faixa busy / err / warn | 8,10 / 8,41 / 7,78 | 9,37 / 9,09 / 9,60 | 4,5 |
| `.lbl` (`--t-*`) err / warn / busy | 5,55 / 8,50 / 6,89 | 5,65 / 5,88 / 5,63 | 4,5 |
| `.sub`, `.hint`, `.tiny` (`--muted` sobre surface) | 4,86 | 5,83 | 4,5 |
| Selo "no ar agora" em `.opt` / `.opt.dis` | 4,86 (info sobre accent-soft: ver nota) / 6,33 | 5,83 / 5,85 | 4,5 |
| `.opt.dis.sel .ttl` | **3,99** | 5,06 | 4,5 (R2-3) |
| `.btn.over` | 8,62 | 8,62 | 4,5 |
| Borda `.btn` (`--ctl` = `--dim`) | 4,72 | 4,95 | 3,0 (fecha a pendência de `--border2` 1,44/2,15 da rodada 1) |
| Botão primário desabilitado (`aria-disabled`) | n/a | 4,02 | isento; dica "Escolha uma opção." 4,86/5,83 |
| Barra esquerda da faixa err / warn / busy | 4,74 / 8,31 / 7,35 | 3,35 / 1,91 / 2,16 | 3,0 (R2-4) |
| `--on-accent` sobre acento | 7,51 | 5,18 (ext) / 3,39 (real) | 4,5 (R2-1) |
| Rolagem horizontal, 8 combinações | 0 | 0 | 0 |

Nota: no claro a `.th` de gradiente e o texto 9 px dentro dela foram marcados pelo script (1,04 a 1,24); são `aria-hidden` e decorativos, ignorados como na rodada 1.

### Não verifiquei
Leitor de screen reader, Tab preso e Esc no real, Opera de verdade, aparelho real, rede lenta, hover e pressionado, altura de tela menor que 667 px.

### De acordo?
**NÃO DE ACORDO ainda, por pouco:** aplicar R2-1 (marcar ext e registrar pendência), R2-2 (describedby 2/2b) e R2-3 (`.opt.dis.sel`); R2-4 é sugestão. São três edições de uma linha cada; aplicadas, o meu "de acordo" vale sem nova captura completa (basta conferir os três valores). Nenhuma nota nova para o Logan.
