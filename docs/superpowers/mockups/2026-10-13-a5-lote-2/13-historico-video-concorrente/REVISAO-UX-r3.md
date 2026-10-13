# Revisão de UX, rodada 3: Mockup 13, Histórico do vídeo de concorrente (A5, lote 2)

Revisor: `revisor-ux-senior`. Data: 13/10/2026. Lido: `REVISAO-UX-r2.md`, `PLANO.md`, `NOTAS.md` (seções 1, 2 e 7), `index.html`, `m13.css`, `m13.js` (régua de 72 horas), `m13-graf.js`, `CONVENCOES.md`. Medi com script próprio (Chromium headless sobre servidor estático na porta 47716 a 47719, derrubado ao terminar): 14 estados x 4 cruzamentos (1440 e 390, escuro e claro) = 56 páginas, mais teclado, popover do ⓘ e colisão na régua de horas a 1440, 390 e 360. Abri as capturas do meu script (não as do desenhista): `cheio` 1440 escuro inteiro e 390 claro; `recente`, `semanal`, `zero`, `saiu`, `extremo`, `naomedido`, `mantido`, `aovivo`, `magro`, `vazio`, `erro`, `carregando` a 390 claro; `extremo`, `semanal`, `saiu`, `zero`, `leitura` a 1440 escuro. Uma evidência nova: `shots/r3-B1-regua-1-4-1-2-colide-zero-390-claro.png`.

## Resumo

**Veredito do mockup: NÃO PODE IR AO DONO nesta rodada. 1 bloqueio (pequeno, uma linha de código), 4 "corrige" de acabamento, 5 sugestões.**

Os 2 bloqueios e os 4 "corrige" da r2 foram todos resolvidos, medidos (tabela abaixo). Os ajustes criaram **um** defeito novo: na régua de 72 horas o rótulo "1/4" encosta no "1/2" no estado `zero` a 390 px e lê-se "1/41/2". O resto está no nível: a régua de relance agora é proporcional, nenhum texto sai do desenho, nenhum rótulo de gráfico colide, os 56 cruzamentos sem rolagem horizontal, sem texto abaixo de 12 px, sem alvo abaixo de 44 px no toque, sem erro de console, sem `color-mix`.

Vão ao dono em condição de "pronto" assim que o bloqueio for consertado: **todos os 14 estados**, nos dois temas e nas duas larguras (só `zero` é tocado pelo bloqueio; os demais já estão prontos hoje).

As três coisas que ainda mais pesam no conjunto (nenhuma bloqueia):
1. A frase-resumo a 390 px nunca cabe na primeira tela (y 905 a 1.087 contra 844), por causa da casca do lote 1 (S1 da r2, mantida como sugestão).
2. A linha pontilhada "1/2 das views" corta o rótulo do pico das 72 horas em 6 estados (abri 4; `mantido` e `leitura` usam os mesmos dados de `saiu` e `cheio`) ("322 em 1 hora" vira "322: em 1 hora" visualmente).
3. No `extremo`, o cartão da subida repete em prosa corrida (4 a 5 linhas de datas) a lista que está logo abaixo.

## A pergunta do dono e o relance

Pergunta: **"Esse vídeo foi bem para a idade dele, e algo que o canal mexeu veio antes de ele subir?"**

- 1440 escuro: responde em 3 s. A frase-resumo traz as duas metades ("2,8 vezes o normal", "▲ Subiu em 16/10", "Nos 14 dias antes, o canal mudou o título (11/10) e a miniatura (13/10)"), seguida da faixa de 5 números, sem rolar. Para `extremo`: "14 mudanças, 12 delas nos 14 dias antes", que confere com a lista (12 dentro, 2 fora). A conta da subida confere: 543.292 / 7 = 77.613 por dia; 77.613 / 16.591 = 4,68, escrito "4,7 vezes".
- 390 claro: o resumo continua começando em y = 905 (`recente`, `magro`, `zero`, `naomedido`), 952 a 975 (`cheio`, `semanal`, `saiu`, `extremo`) e 1.087 (`leitura`). Não cabe na primeira tela. É a casca do lote 1, já aprovada; fica como S1.

## Bloqueio (nada vai ao dono com ele aberto)

**R3-B1. `zero`, 390 px (claro e escuro) e 360 px: os rótulos "1/4" e "1/2" da régua de 72 horas se tocam e lêem "1/41/2".**
Tela e estado: bloco "As primeiras 72 horas", régua "este vídeo", estado `zero` (único dos 11 estados com régua em que acontece; medi também 360 px e piora: 3,5 px de sobreposição). É efeito do conserto C7 da r1: `separaRotulos()` em `m13.js:287-299` só confere o rótulo de hora (`lastElementChild`, "7 h" e "12 h", que desce para a segunda linha) e deixa o rótulo da fração (primeiro `span`, "1/4" e "1/2") parado onde estava.
Evidência: `getBoundingClientRect` dos dois `span` de fração: 1,4 px de sobreposição a 390 e 3,5 px a 360. Captura: `shots/r3-B1-regua-1-4-1-2-colide-zero-390-claro.png` ("1/41/2" em negrito, os pontos a 7 h e 12 h logo abaixo). O dono lê um número que não existe; é o único erro de texto que sobrou no conjunto.
Conserto: em `separaRotulos()`, comparar também o primeiro `span` (fração) de cada marca com o da marca anterior; se `r.left < fim + 6` em qualquer das duas linhas, descer a marca inteira (fração e hora) para a segunda linha, ou subir só a fração para uma terceira linha acima. Conferir de novo: `zero` a 390 e a 360, folga mínima de 6 px entre as caixas das frações (hoje -1,4 px).

## Corrige (vai ao dono só depois de corrigido, junto com o bloqueio)

**R3-C1. A linha pontilhada "1/2 das views" atravessa o rótulo do pico das 72 horas.** `cheio`, `recente`, `zero`, `saiu`, `mantido`, `leitura`, 390 e 1440 (ex.: `recente` 390: "436: em 1 hora"; `cheio` 390: "300 em 1 hora" com a linha entre "1" e "hora"). O contorno de 4 px da cor do cartão abre uma fresta no traço, então o texto continua legível, mas o traço aparece enfiado no meio da frase. A r2 mandou "se também colidir com a linha de ½, subir uma linha"; o código tenta o lado, mas aceita o rótulo sobre a linha como último recurso sem subir. Conserto: antes de aceitar um lado, testar o retângulo do texto contra o x da linha de "1/2" (incluindo 4 px de folga); se cruzar, subir o rótulo uma linha (y - 16 px) em vez de centrar.

**R3-C2. `extremo`: o cartão da subida repete a lista em prosa.** "Mudanças nos 14 dias antes: título em 10/10, 11/10, 13/10 e 14/10; miniatura em 10/10, 11/10, 12/10, 12/10, 14/10 e 16/10; descrição em 13/10; tags em 15/10." são 4 a 5 linhas de texto corrido a 390 px, e a mesma informação está na lista "Mudanças deste vídeo", logo abaixo, ordenada e com símbolo. É o "parágrafo de prosa" e o "texto repetido" que o dono reprova. Conserto: com mais de 4 mudanças dentro da janela, o cartão diz só "12 mudanças nos 14 dias antes (a lista está logo abaixo)" e deixa a lista inteira para a lista de baixo; com 4 ou menos, como hoje.

**R3-C3. `semanal`: duas datas para "quando a contagem começou".** O bloco de idade diz "quando a contagem começou (03/10)"; o gráfico semanal logo abaixo escreve "sem contagem antes de 05/10" e hachura a primeira leitura em 05/10. Pode ser verdade (a primeira leitura semanal cai em 05/10), mas a tela não diz, e o dono lê a mesma coisa com dois nomes e duas datas. Conserto: no gráfico, "sem contagem por semana antes de 05/10 (a por dia começou em 03/10)" ou usar a mesma data nos dois.

**R3-C4. `semanal`: o ⓘ do gráfico se chama "Como ler o dia a dia e as mudanças", e o bloco se chama "Views por semana".** O nome do botão não bate com o título do bloco (regra: a mesma coisa com o mesmo nome). Conserto: "Como ler a contagem por semana" nesse estado.

## Sugestões (não bloqueiam)

- **S1 (mantida da r2).** 390 px: o resumo nunca cabe na primeira tela. A casca é do lote 1. Se o dono reclamar, juntar os dois avisos numa linha e tirar a capa de 120 x 68 px do cabeçalho.
- **S2.** `extremo` 390: no gráfico por dia, as linhas verticais da faixa de subida cortam as datas "17/10" e "25/10" (lê-se "17//10"), e "▲ subida" encosta na borda direita da faixa. Não é ilegível; dá para empurrar a faixa 4 px ou dar o contorno do cartão às datas.
- **S3.** `extremo` 390: o segmento azul de 21 a 30 dias passa por cima do "m" de "1,02 milhão" na curva por idade. Subir o rótulo 6 px.
- **S4.** `extremo` 390, raias: as caixas "x4", "x6" e "x2" se encostam (aceito na r2; continua aceitável porque a lista abaixo diz tudo).
- **S5.** `aovivo` e `mantido` estão corretos; só observo que a pastilha "saiu do YouTube em 09/10 · mantido para análise" a 390 usa duas linhas e a borda verde-água; está legível (a r2 C2 foi resolvida) e dentro do padrão.

## Conferência da r2

| Item | Resultado | Evidência |
|---|---|---|
| R2-B1 (barras dos pares sem proporção) | resolvido | Razão das larguras contra razão dos valores, 1440 e 390: `cheio` 1 dia 1,046 contra 1,046; 7 dias 0,893 contra 0,888; 30 dias 2,79 contra 2,79 (148,0 e 53,0 px). `extremo` 1 dia 6,43 contra 6,44; 7 dias 5,90 contra 5,90; 30 dias 21,4 contra 21,6 (barra do normal 6,9 px, abaixo do piso de 4 px não precisou ser engordada). `zero` 1 dia 0,125 contra 0,125; 7 dias 0,069 contra 0,069. `saiu` 0,82 contra 0,82. Erro menor que 1 px em todos os 9 pares com dois valores |
| R2-B2 (rótulo do pico fora do SVG a 390) | resolvido | Texto de SVG fora do SVG: 0 em 56 de 56 (eram 6). Efeito colateral: R3-C1 |
| R2-C1 (rótulos da série semanal se tocam) | resolvido | `semanal` 390: "722" em cima, "723" embaixo, "968" em cima, "783" e "725" separados; 0 colisões; nas capturas o "722" ainda toca a borda tracejada de "sem contagem" por 1 px (cosmético) |
| R2-C2 (pastilha de `mantido` a 390) | resolvido | duas linhas com 6 px de respiro, `min-height` 32 px, texto não encosta no contorno |
| R2-C3 (Subida de `semanal` com duas cores) | resolvido | célula neutra com relógio e "contagem por semana"; células de 1, 7 e 30 dias seguem rosa; o cartão "inconclusivo: série semanal" bate com a célula |
| R2-C4 (dois ⓘ com o mesmo rótulo) | resolvido | os 4 ⓘ de cada estado têm nomes distintos ("Como ler a curva por idade", "Como ler as 72 horas", "Como ler o dia a dia e as mudanças", "Como a subida é calculada"); novo R3-C4 só no `semanal` |
| S2 ("mi"), S3 (círculo sob o quadrado), S5 (¼ ½ ¾), S6 (frase do erro) | resolvidos | "1,02 milhão"; círculo azul por cima do quadrado do normal em `naomedido`; "1/4", "1/2", "3/4"; "Os números e os gráficos aparecem quando o histórico abrir." |
| S1, S4 | mantidas como sugestão | acima |

## Veredito por estado e por largura

"Pronto" = pode ir ao dono. "Pronto, com corrige" = só falta o item citado.

| Estado | 1440 escuro | 390 claro | Resto dos cruzamentos | Pendências |
|---|---|---|---|---|
| `cheio` | pronto | pronto | pronto | R3-C1 (acabamento) |
| `extremo` | pronto | pronto | pronto | R3-C2, S2 a S4 |
| `recente` (caso real de hoje) | pronto | pronto | pronto | R3-C1 |
| `magro` | pronto | pronto | pronto | nenhuma |
| `zero` | pronto | **volta para ajuste** | 390 escuro e 360 também | **R3-B1**, R3-C1 |
| `naomedido` | pronto | pronto | pronto | nenhuma |
| `semanal` | pronto | pronto | pronto | R3-C3, R3-C4 |
| `saiu` | pronto | pronto | pronto | R3-C1 |
| `mantido` | pronto | pronto | pronto | R3-C1 |
| `aovivo` | pronto | pronto | pronto | nenhuma |
| `vazio` | pronto | pronto | pronto | nenhuma |
| `carregando` | pronto | pronto | pronto | nenhuma |
| `erro` | pronto | pronto | pronto | nenhuma |
| `leitura` (só leitura) | pronto | pronto | pronto | R3-C1 |

## Cobrança do dono, ponto a ponto

| Regra | Resultado |
|---|---|
| Frase-resumo no topo | sim, em todo estado com dado; `vazio`, `magro`, `naomedido` dizem o que falta e por quê |
| Régua ou barra para comparar de relance | sim, e agora **proporcional** (R2-B1 resolvido); régua de 72 horas com 1/4, 1/2 e 3/4 (com R3-B1 em `zero` a 390) |
| Cor estável por significado, inclusive "não medido" | sim: azul = este vídeo, areia = normal do canal, verde = subida, rosa hachurado = não medido (nunca a cor de zero), pontilhado = ainda não existe, cinza-azulado = zero medido; igual nos 14 estados |
| Símbolo junto da cor | sim: círculo, quadrado tracejado, ▲, hachura, caixa vazada com 0, contorno pontilhado, losango, triângulo, círculo numerado, relógio (série semanal), olho cortado (saiu) |
| Método no botão de informação | sim; popover abre por Enter, Esc fecha e devolve o foco ao ⓘ; a 390 o popover tem 366 px e cabe (x 12 a 378); a regra da subida confere com o spec (7 dias seguintes ≥ 2 vezes os 7 anteriores e ganho ≥ 1.000 views; lista dos 14 dias antes; "o que ela não diz: o que causou a subida") |
| "Zero medido" distinto de "não medido" | sim (`zero`: caixa vazada com "0" no dia, caixas vazadas nas horas; hachura rosa só onde a contagem não existe) |
| Sem bloco monocromático nem prosa | sim, exceto R3-C2 (`extremo`) |
| Frases sem jargão | sim; "série" só em "inconclusivo: série semanal", que é a frase exata do spec (pergunta 16); "mediana" só no ⓘ |
| `color-mix()` ausente | sim: nenhuma ocorrência em CSS ou JS além de comentários "sem color-mix" |
| Escuro a 1440 e claro a 390 | os dois pares abertos nos 14 estados (por medição) e em 13 por captura |
| Lista, não afirma causa (M5) | sim: "Mudanças nos 14 dias antes", "É só uma lista de coincidências: não diz o que causou a subida."; nenhuma frase com "depois da troca" |
| Foco visível, teclado, aria | 44 de 44 primeiros focos a 1440 escuro e a 390 claro com contorno sólido de 2 px (`--accent`: 6,72:1 escuro, 4,94:1 claro contra o cartão); ordem: casca, botões do vídeo, ⓘ, grupo do gráfico, anterior, seguinte, "Ver como tabela", bloco seguinte; End e Home atualizam a linha de leitura (`aria-live`) com a frase completa |

## Tabela de medidas

Contraste WCAG contra `--surface` (valores lidos da página; nada mudou desde a r2). Texto: 4,5:1. Elemento gráfico: 3:1.

| Elemento | Escuro | Claro | Mínimo |
|---|---|---|---|
| `--text` | 14,48 | 15,76 | 4,5 ok |
| `--muted` | 6,18 | 7,13 | 4,5 ok |
| `--dim` | 4,86 | 5,59 | 3 ok |
| Este vídeo `--lado-b` | 6,80 | 4,43 | 3 ok |
| Normal do canal `--lado-n` | 11,88 | 8,32 | 3 ok |
| Subida `--dir-up` | 7,26 | 6,37 | 4,5 ok |
| Zero medido `--im-zero` | 4,97 | 4,84 | 3 ok |
| Não medido `--nm` (texto) | 7,76 | 7,40 | 4,5 ok |
| Hachura `--nm-line` | 4,09 | 4,57 | 3 ok |
| Marcador de mudança `--tr` | 14,48 | 15,76 | 3 ok |
| Contorno de foco `--accent` | 6,72 | 4,94 | 3 ok |
| Menor contraste de todo texto HTML (composto sobre o fundo real), por estado | 4,86 (5,24 em `carregando` e `erro`) | 4,73 | 4,5 ok; 0 abaixo de 4,5 em 56 de 56 |
| Azul contra areia (sem a forma) | 1,75 | 1,88 | só reforço; círculo cheio x quadrado tracejado separam |

| Medida de página | Resultado |
|---|---|
| Rolagem horizontal | 0 px em 56 de 56 |
| Texto abaixo de 12 px (HTML e SVG com escala) | 0 em 56 de 56 |
| Alvos abaixo de 44 px a 390 (toque) | 0 em 28 de 28 (ⓘ 44 x 44, anterior e seguinte 44 x 44, "Ver como tabela" 98 x 44, botões 117 a 153 x 44, "Mudanças" 70 x 44, "Próximo" 80 x 44); a 1440 os botões de 34 px e "Próximo" de 36 px são da casca do lote 1 (ponteiro fino) |
| Erros de console (fora as fontes do Google bloqueadas) | 0 em 56 de 56 |
| Texto de SVG fora do SVG | 0 em 56 de 56 (r2: 6) |
| Rótulos de SVG que se tocam | 0 em 56 de 56 (r2: 4) |
| Rótulos HTML da régua de horas que se tocam | 1: `zero` 390 (1,4 px) e 360 (3,5 px); 0 nos outros 10 estados com régua, a 1440, 390 e 360 (R3-B1) |
| Razão das larguras dos pares contra a razão dos valores | 9 de 9 pares dentro de 1 px (R2-B1 resolvido) |
| Resumo, a partir do topo da página, 1440 | y 628 (`vazio`) a 805 (`leitura`); `cheio` 727, `recente` 680 |
| Resumo, 390 | y 853 (`vazio`) a 1.087 (`leitura`); `recente`, `magro`, `zero`, `naomedido` 905; `cheio` 952 |
| Alturas de página, 1440 (px) | `cheio` 3.763; `extremo` 3.948; `recente` 3.516; `semanal` 2.430; `erro` 1.415 |

## O que não consegui verificar

Leitor de tela (VoiceOver, NVDA): conferi apenas rótulos e `aria-live` por script; Safari e Opera (o `color-mix` ausente protege, mas a hachura SVG e o `popover` do ⓘ não foram vistos lá); a regra de movimento reduzido só por leitura de `a4.css:48` (nenhum teste com a preferência ligada); simulação em escala de cinza só por luminância (azul e areia diferem em 1,75:1 a 1,88:1 e a forma os separa; não gerei imagem em cinza); capturas a 390 escuro abertas por medição, não por olhar (o cruzamento obrigatório 1440 escuro e 390 claro eu abri); `vazio`, `erro` e `carregando` a 1440 escuro só por medição.

## Condição para a rodada 4 (ou para ir ao dono)

Corrigir R3-B1 (uma linha em `separaRotulos()`). Os "corrige" R3-C1 a R3-C4 vão junto, são pequenos. Eu meço de novo: colisão de rótulos da régua de horas em `zero` a 390 e 360 (folga de 6 px ou mais), `getBoundingClientRect` do pico contra o x da linha de "1/2" nos 6 estados do R3-C1, `extremo` a 390 sem a prosa de datas, e abro só os quatro estados tocados (`zero`, `extremo`, `semanal`, `cheio`) a 390 claro e 1440 escuro. Os outros dez não precisam de nova rodada, a menos que o ajuste do pico (R3-C1) mexa na escala do gráfico, caso em que repito a medida de texto fora do SVG nos 56.
