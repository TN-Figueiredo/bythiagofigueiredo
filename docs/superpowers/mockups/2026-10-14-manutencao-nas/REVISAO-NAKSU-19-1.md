# Revisão da Naksu (UI): mockup 19 e peças 1, 2 e 3 (rodada 1)

Capturas em `revisao-naksu-shots/19/` (páginas inteiras 390/1440 × claro/escuro, legenda e prova a 16 px em cor e cinza, eixo P1-4/P1-10, dado hostil, diálogo a 390).

## Resumo
- `index.html`: ACORDO. `series.html` (peça 1): ACORDO COM CONDIÇÕES (1 corrige). `arquivo.html` (peças 2 e 3): ACORDO COM CONDIÇÕES (1 corrige).
- Os três defeitos que mais pesam: (1) texto cortado no eixo P1-10; (2) esqueleto de "Canais removidos" com 84 px contra linhas reais de 97 a 315 px; (3) "falta e devia estar" (pontilhado âmbar) igual ao pontilhado neutro em escala de cinza.

## O que acerta (preservar)
Tokens idênticos aos de `remover-canal/rc.css` (bloco `:root` claro e escuro, valor a valor); `--forja`/`--forja-line` só em "+ novo" e selos, como a CONVENCOES §3. Zero `color-mix()` (grep em css, js, html: só o comentário). Contorno de cor só na linha que precisa do dono. Ausências com forma própria: hachura, pontilhado, caixa de arquivo, caixa do 0. "Sem registro neste mês" é caixa vazada, nunca zero. Diálogo: foco em "Cancelar", Esc devolve o foco ao botão (testado).

## Medidas (minhas, independentes de `medidas.json`; transparência resolvida contra o fundo, hachura pelo pior dos dois tons)
| Item | Resultado |
|---|---|
| Texto < 4,5:1 (8 páginas e 6 variantes de caso/perfil, 390 e 1440, 2 temas) | 0 ocorrências |
| Ícones/caixas de estado < 3:1 | 0 |
| Fonte < 12 px | 0 |
| Rolagem horizontal | 0 em todas |
| Alvos < 44 px a 390 em arquivo.html e series.html | 0 |
| Alvos a 390 em index.html (links da tabela "Quadro") | 113 com altura 44 mas largura 27 a 37 px |
| Erros de script | 0 |
| Ícones a 16 px (legenda, 390, cor e cinza) | pontilhado, meio-círculo, caixa de arquivo, caixa do 0 e hachura se separam em forma, também em cinza; legíveis |
| Dado hostil: nome de canal de 120 caracteres, mês com 120 caracteres e número `1.234.567.890.123`, 390 e 1440 | sem rolagem; `.m-cn` trunca com reticências |
| `.btn` a 390 | 44 px (diálogo e botões); `.m-ibtn` 44 px |

## arquivo.html (peças 2 e 3): ACORDO COM CONDIÇÕES

**A1 (corrige). Esqueleto de "Canais removidos" não tem a altura final.** `arquivo.js` linha 217: dois blocos de `height:84px` (176 px com margens). Linhas reais medidas: 390 px = 312, 315, 315, 147, 211, 234 px; 1440 px = 187, 210, 210, 97, 97, 109 px. A página pula 130 a 450 px quando o dado chega, contra o que o plano e o spec 04 L552 pedem ("altura final da linha"). Correção: esqueleto com a mesma grade da `.m-can` (classe `m-can` com blocos internos de 14 px de altura em `--sunk`): altura mínima 187 px a 1440 e 312 px a 390 (`min-height:187px` / `@media (max-width:1200px){min-height:312px}`), dois blocos; sem animação (reduced-motion já coberto).

**A2 (sugestão). `.m-can .m-cn` trunca com `white-space:nowrap` também a 390 px**, onde a coluna é de largura total (nome de 120 caracteres some depois de ~30; o `title` não existe no toque). Correção: dentro de `@media (max-width:1200px)` usar `white-space:normal;overflow-wrap:anywhere`.

**A3 (sugestão). Pontilhado âmbar ("falta e devia estar") e pontilhado neutro são o mesmo desenho em escala de cinza** (captura `legenda-390-claro-cinza.png`: linhas 2 e 3 idênticas). Quem separa é a frase ("Cópia atrasada há N dias"), então não bloqueia; mas a regra "nada só por cor" pede forma. Correção: no âmbar, `stroke-dasharray:1.2 2.4` com `stroke-width:2` (ponto mais denso) ou um "!" de 1 px no centro, e declarar na legenda; se o dono preferir manter o spec 04 L141, declarar a divergência no NOTAS.

**A4 (sugestão). `.m-ibtn` base 28 px (rc usa 24 px) e `.btn` com `white-space:normal;height:auto`** diferem do `rc.css`. Aceitável por serem mais seguros; declarar no NOTAS como variação de `rc-ibtn` e `.btn` (os dois sem `.btn.danger:hover`).

Verificação: contraste, alvos e 390 px sem achado; ordem "dono primeiro, Pode sair depois" conferida na captura do caso cheio (Novembro com contorno âmbar no topo, Setembro "saiu das telas" em seguida).

## series.html (peça 1): ACORDO COM CONDIÇÕES

**S1 (corrige). P1-10 ("Antes do começo da coleta"), 390 e 1440 px: o rótulo é cortado.** `.m-seg.antes` mede 84 px de largura e a `.m-seg.arq` vizinha sobrepõe o texto: a captura `eixo-p1-10-390.png` lê "Antes do / início da / coleta / (03/10/2" (a data é perdida), e o bloco do arquivo ao lado também tem só 84 a 97 px (rótulo em 4 linhas, 68 px de altura). Em P1-4 o `arq` tem 84 a 109 px. Correção: `.m-seg.antes,.m-seg.arq{flex:0 0 auto;width:max(120px,22%)}` e `.m-seg .rot{overflow-wrap:anywhere}`; a 390 px empilhar o rótulo acima do eixo (`.m-ex{flex-wrap:wrap}` com o rótulo em linha própria) para que "(03/10/2026)" apareça inteiro. Medir de novo: `.rot` com altura ≤ 51 px e `scrollWidth ≤ clientWidth`.

**S2 (sugestão). Os segmentos "antes" e "arquivo" têm largura fixa, não proporcional ao tempo.** Para um eixo de dados a posição deveria ser proporcional; como é ilustração de forma, declarar no rodapé do quadro "largura ilustrativa, fora de escala".

**S3 (sugestão). `m-cel` de "no arquivo": rótulo em até 4 linhas a 1440** (células de 104 px); ampliar a `minmax(104px,1fr)` para `minmax(120px,1fr)`.

## index.html (casca): ACORDO
**I1 (sugestão).** Links "P1-2", "18-v2" da tabela a 390 px têm 27 a 37 px de largura (altura 44). Correção: `.m-t td a{min-width:44px;justify-content:center}` no bloco ≤820. Quadro de sincronia e legenda sem achado; 1440 sem linha larga demais (`main` em 1120 px, alinhado à esquerda como os aprovados).

## Não verifiquei
Opera real e Safari; leitor de tela; aparelho real; rede lenta (fontes do Google Fonts carregadas em rede aberta, 3 famílias, mesmo conjunto dos aprovados); filtro de cinza do macOS (usei `?cinza=1` e `grayscale(1)` no Chrome); ícones a 16 px em tela de densidade 1x e 2x (só 1x); carregamento só existe como quadro estático (não há transição real a medir). `title` e foco de teclado do diálogo conferidos só a 390 px, tema claro.
