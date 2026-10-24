# F3b Adiar 7 dias: revisão de UI do mockup (Naksu, rodada 1, 23/10)

**Nota: 88/100. Aprova: NÃO** (2 achados "corrige", ambos de uma linha de CSS; sem bloqueio). Volta ao ajuste e eu remeço só os dois.

Método: Playwright (chromium headless) sobre `file://`, 14 estados x 1440/390 x escuro/claro = 56 capturas em `ui-revisao-shots/<estado>-<largura>-<tema>.png`, mais 640/641/700/760 (`adiar-aberto-<w>-dark.png`), dado hostil (`hostil-*`), foco (`foco-adiar-1440-light.png`), cinza (`cinza-*`), zoom do ‖ (`zoom-dsp-1440-dark.png`). Contraste calculado com cor lida da página, transparência resolvida contra o fundo real. Scripts de medida: scratchpad da sessão, não versionados.

## O que acerta (preservar)
- Parte do CSS real da F3 e acrescenta só um bloco DELTA; zero token novo; `grep color-mix` = 0; só hex/rgba.
- Borda da faixa "Adiada" em `--btn-line`: 3,92:1 escuro / 3,45:1 claro medidos (plano dizia o mesmo). Relógio neutro x ✓ verde x ampulheta: lê-se em cinza (`cinza-adiada-390-dark.png`).
- 390: separadores viraram fio e forçam 3 fileiras (motivos / Já fiz / Adiar+Cancelar). `.sg-dsp` 211 -> 258 px (plano previa ~291; melhor). Alvos 44x44 em tudo a 390; sem rolagem horizontal (hscroll 0 nos 56 cantos).
- Sem salto: "Adiando…" mantém Cancelar em x=1342 (1440) e botão 239x44 (390); painel mantém 62 px / 258 px.
- Foco: Tab = Lugar errado > Não me interessa > Já fiz > Adiar > Cancelar; Esc devolve o foco ao gatilho; anel 2 px `--accent`: 4,45:1 sobre `--sunk` claro, 7,51:1 escuro. Frase "Vence em…" fora do Tab.
- Dado hostil (título 100 car., canal 60, lugar 47 car. sem espaço) a 1440 e 390, nos dois temas: nada vaza, h4 e botão primário quebram por decisão.

## Achados

### N1. corrige: ‖ órfão no fim da fileira entre 641 e ~690 px de contêiner
- Tela/estado: `adiar-aberto` (e `adiar-vence-antes`), escuro e claro, contêiner `.sg` de 641 a ~681 px (medido: frame de 700 px quebra; 705 cabe). Captura `adiar-aberto-700-dark.png`.
- Defeito: acima de 640 o separador volta a ser traço vertical e "Adiar 7 dias" não cabe: cai sozinho para a 2ª fileira com "Cancelar", enquanto o `‖` (5 px) fica pendurado no fim da 1ª, sem nada depois. O grupo "adiar" perde o separador que o delimita.
- Importa: tablet/janela estreita com a coluna do CMS; é justo onde os 3 grupos mais precisam de limite.
- Correção (no bloco `@container` do DELTA, sem tocar nos botões de 36 px): subir o limiar do fio só para o painel.
```css
@container (max-width:700px){
 .sg-dsp .sg-sep,.sg-dsp .sg-sep.sg-sep2{display:block;flex:1 1 100%;width:auto;height:1px;margin:0;align-self:auto;background:var(--border-strong)}
 .sg-dsp p.sg-vence{flex:1 1 100%}
}
```
Remover essas duas regras do bloco `@container (max-width:640px)` do DELTA (manter só `.sg-row .sg-top .sg-ven1{display:none}` lá). Entre 641 e 700 os botões ficam 36 px em fileiras, como a F3 já faz com ponteiro fino; conferir 700/701 depois.

### N2. corrige: margens do DELTA anuladas pelo reset `.sg :is(p){margin:0}`
- Medido: `getComputedStyle(.sg-adl).marginTop` = **0px** (CSS pede 8), `.sg-blkmeta` = **0px** (pede 4), `.sg-venm` (selo "Adiada por você" a 390) encostado na régua: gap 0 (labels "1× regra 5× 20×" a ~4 px do pill). Causa: `.sg :is(...p...)` tem especificidade (0,1,1) e `.sg-adl`/`.sg-blkmeta`/`.sg-venm` (0,1,0) perdem. Capturas `voltou-390-dark.png`, `lista-com-adiadas-390-light.png` (a linha "2 adiadas por você" cola em "Da mais forte para a mais fraca.").
- Importa: selo e linha de contagem lidos como parte do bloco de cima; vai se repetir na implementação (Tailwind/CSS do sistema com o mesmo reset).
- Correção: `.sg p.sg-adl{margin-top:8px}` `.sg p.sg-blkmeta{margin-top:4px}` e, no bloco @container, `.sg p.sg-venm{margin-top:8px}` (o `display:block` já vem do bloco @container).

### N3. sugestão: ‖ e fios a 1,61:1 (escuro) / 1,59:1 (claro)
- Medido sobre `--sunk`. Ele é o único traço entre "Já fiz" e "Adiar" a 1440 além do vão de 12 px (zoom em `zoom-dsp-1440-dark.png`: legível, mas fraco). Aceitável porque o botão tem ícone, a posição é nova e o vão repete o sinal; não sobe a "corrige". Se o Logan achar que os grupos não se leem: `--btn-line` nos dois traços do ‖ (3,92 / 3,45) e fio de 1 px a 390 igual.

### N4. sugestão (mockup, não produto): frame 1440 estoura o `.wrap`
- `.wrap` tem 16 px de padding: com janela de 1440, o `.frame.w1440` (1440 px) fica 32 px maior que o contêiner e `.stage` rola na horizontal (corta o ⓘ do cabeçalho na captura). Correção: `@media (max-width:1500px){.wrap{padding-left:0;padding-right:0}}`.

### N5. observação herdada da F3 (fora do delta, para o plano T8)
- Entre 641 e ~760 px a linha usa a grade de 3 colunas com `.sg-v` de ~55 px ("8,4× o / normal / do / canal…" uma palavra por linha) e `h4` truncado em "…1…" (`adiar-aberto-700-dark.png`). Não é da F3b; registrar para a F3.
- Alvos a 1440 (ponteiro fino): ⓘ 28x28, botões 36 px: regra da F3 (`pointer:coarse` sobe para 44). Sem mudança.

## Tabela de medidas (resolvida contra o fundo real)
| Par | Escuro | Claro | Limite | Situação |
|---|---|---|---|---|
| Borda faixa Adiada `--btn-line`/`--sunk` | 3,92 | 3,45 | 3 | passa |
| Texto "Adiada." `--text`/`--sunk` | 16,20 | 14,21 | 4,5 | passa |
| Relógio da faixa `--muted`/`--sunk` | 6,92 | 6,43 | 3 | passa |
| Selo "N adiadas" e linha de contagem `--muted`/`--bg` | 6,67 | 6,83 | 4,5 | passa |
| Frase "Vence em…" e ampulheta | 6,92 | 6,43 | 4,5 | passa |
| "Adiando…" (`--muted`) / botão | 5,90 | 6,43 | 4,5 | passa |
| Texto dos botões do painel | 13,82 | 14,21 | 4,5 | passa |
| Borda do botão `--btn-line` | 3,35 | 3,45 | 3 | passa |
| Cancelar `--yt` | 8,68 | 7,07 | 4,5 | passa |
| Erro "Não salvou" `--text`/`--err` em b | 8,14 | 7,01 | 4,5 | passa |
| Ícone vazio relógio `--dim` / nm `--nm` | 4,86 (nm) | 5,59 | 3 | passa |
| Separadores ‖/fio `--border-strong`/`--sunk` | 1,61 | 1,59 | 3 | decorativo (N3) |
| Anel de foco `--accent` | 7,51 | 4,45 | 3 | passa |
| Alvos a 390 (todos os botões) | min 44x44 | | 44 | passa |
| Alvos a 1440 | 36 / ⓘ 28 | | | regra da F3 |
| Texto < 12 px | 0 | 0 | 12 | passa |
| `.sg-dsp` 390 | 258 px (aberto), 292 (vence antes) | | | custo declarado ok |
| `.sg-dsp` 1440 | 62 px, 1 fileira | | | passa |
| Rolagem horizontal (56 cantos) | 0 | 0 | 0 | passa |
| `color-mix()` | 0 ocorrências | | 0 | passa |
| Valores soltos novos | nenhum | | | passa |

## Estados (14)
Veredito por estado: todos legíveis nos dois temas e larguras; os dois defeitos acima aparecem em `adiar-aberto`/`adiar-vence-antes` (N1, só entre 641 e ~690) e em `lista-com-adiadas`, `ctx-ablab-adiadas`, `voltou` (N2).

## Para o Logan
- "Não me interessa" e "Lugar errado" ainda ficam acima de "Já fiz" e "Adiar" na ordem de Tab: confirmar que é a ordem desejada (decisão dele, não minha).
- Em `vazio-adiado-nm` o parágrafo "Os vídeos acima do normal ainda não bastam…" afirma algo quando a contagem é não medida: rótulo dele.

## Não verificado
Leitor de tela (anúncio do `role="status"` e do `aria-busy`), Opera real, aparelho de toque real, rede lenta. Animação do recolhe em 5 s só conferida pelo código (sem animação nova). Contraste do selo tipo "pill" só pelo texto.
