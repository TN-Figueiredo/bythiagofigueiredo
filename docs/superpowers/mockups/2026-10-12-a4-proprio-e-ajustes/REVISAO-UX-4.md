# Quarta revisão de UX (12/10/2026): ajuste 4, marca de cliques e trocas de título e thumbnail

Escopo: `AJUSTES-UX-4.md` (video.html em 4 casos; canal.html e a aba Retenção como regressão). Método: Playwright por `file://` sobre uma cópia da pasta tirada no início da revisão (a pasta recebeu depois outros ajustes, `AJUSTES-UX-5.md` e `c2-trocas`, que não entram aqui) e uma cópia do `HEAD` para comparar antes e depois, pixel a pixel por elemento. Fontes do Google bloqueadas (rodada determinística: base contra base dá 0 pixel de diferença). 1440 e 390 px, escuro e claro, 4 casos do vídeo e 3 estados do canal. Contraste calculado com os valores lidos da página. Capturas em `ux-revisao-4-shots/`. Nada foi editado; navegador fechado.

## Resumo

| Veredito | Itens |
|---|---|
| Pronto para o dono | 2 de 4 itens pedidos: 3 (taxa de clique e curva de retenção seguem íntegras, com a ressalva do número novo) e 4 (zero `color-mix()`) |
| Volta para ajuste | 2 de 4: 1 (video.html: marca de cliques e bloco de trocas) e 2 (regressão no canal já aprovado) |
| Reprovado | 0 |

Nenhum achado **bloqueia**; oito **corrigem** (vão ao dono só depois de corrigidos), cinco são **sugestão**. Nada de rolagem lateral em nenhuma das combinações (scrollWidth = largura em todas), nenhum erro de página.

**As três coisas que mais derrubam o conjunto**

1. **O exemplo novo mexeu no que o dono já aprovou.** O multiplicador de 1,4 na taxa do vídeo em destaque vaza para views, curtidas e cliques: no canal cheio (aprovado) o card do Hanói passa de 4,43 mil para 4,73 mil views, de 233 para 249 views por dia e de 3,04 para 3,23 mil cliques; o relatório do desenhista diz que "o resto da semente é idêntico", e não é (A1).
2. **A faixa de cliques não se explica sozinha e, em tela estreita, falta o número.** Os números sob as datas não têm título perto; a legenda que explica está 100 px abaixo, em 3 linhas. No magro a 390 px aparecem 2 pontos e 0 números, embora a legenda diga "o número na faixa"; no cheio a 390 px, 4 números para 18 pontos (A2, A3).
3. **Estados de borda do bloco de trocas afirmam mais do que sabem.** Troca recente, com o "depois" ainda não medido, vira "0 impressões" (nulo como zero); o vídeo novo diz "nenhuma ... ainda tem o título e a thumbnail de origem" quando não existe registro de trocas para vídeo próprio (A4, A5).

## Item 1. video.html, 4 casos

**Pergunta de quem abre:** "a capa ou o título que eu troquei funcionou?" (e, antes disso, "o que aconteceu com este vídeo dia a dia?"). **Veredito: volta para ajuste.**

### (a) A marca de cliques ainda pode ser lida como altura? **Não. Pronto neste ponto.**
Todos os pontos ficam na mesma linha (cy constante, `T + PH + AX + 11`), dentro de uma faixa rebaixada separada do gráfico pelo eixo de datas, com o número escrito embaixo. Nenhuma barra tem ponto dentro. A leitura "mais alto = mais clique" deixou de existir. Resta o problema de rótulo e de número ausente (A2, A3).

### (b) Marcas de troca nos dois gráficos
**Legíveis de relance: sim.** Losango azul (título) e triângulo roxo (thumbnail), 24 px, no alto, com linha vertical atrás das barras; o número dentro é a ordem do bloco. **Distinguíveis sem cor: sim.** Em escala de cinza (`gray-*` nas capturas) o losango e o triângulo seguem distintos pela forma e pelo número; a luminância das duas cores é quase igual (tr-t contra tr-m: 1,07:1 no escuro, 1,50:1 no claro), então só a forma separa, e basta. **Não brigam com barra cheia, caixa vazada e hachura:** a linha passa por trás das barras; cruza os rótulos de valor em 4 pontos a 1440 (361, 126, 4.607, 1.843), legíveis por causa do halo; a 390 px não há cruzamento. No magro a linha pousa sobre a caixa vazada de 25/09 sem apagá-la. Teclado e tabela: ver (d).

### (c) Bloco "Trocas deste vídeo"
- **Frase-resumo no topo:** sim ("2 trocas neste vídeo: a de título em 27/09 (1) e a de thumbnail em 02/10 (2). ..."). Longa (2 linhas a 1440, 5 a 390) e com "variação normal", que é jargão (S2).
- **Antes e depois:** título em duas linhas ("Antes" apagado, "Depois" cheio); thumbnail em duas miniaturas de 220 px (de exemplo, marcadas). Boa leitura.
- **Faixa com intervalo:** sim, Wilson 95%, régua 0 a 10% compartilhada entre as duas trocas; pastilha com símbolo (▲ verde, ▼ ocre, ≈ neutra, … tracejada). Verde só quando as faixas não se cruzam. Não é monocromático nem prosa.
- **Poucas impressões (magro):** "só 1 impressão: sem faixa" e "só 9 impressões: sem faixa", caixa tracejada; texto "Ainda não dá para dizer. São 1 impressão antes e 9 depois: com menos de 100 de um lado, qualquer taxa seria chute." Correto e sem número cravado. Bom.
- **"Não medido" com cor e forma próprias:** o bloco não tem estado "não medido" próprio; no sem-dado a linha é só texto, sem a pastilha magenta que os cartões vizinhos usam (S1). E o estado "um lado não medido" vira zero (A4).
- **Vazio:** novo e sem-dado dizem uma linha, sem cartão vazio. Sem-dado diz "sem leitura", correto. Novo afirma demais (A5).

### (d) Teclado, tabela, leitura por dia
Foco: o grupo do gráfico recebe contorno de 2 px laranja; setas andam dia a dia; no dia da troca a leitura diz: "dom 27/09: 4.607 impressões, 235 cliques estimados. Título trocado neste dia (troca 1)" e "sex 02/10: ... Thumbnail trocada neste dia (troca 2)"; nos views igual. Tabela: coluna "Troca" só nas duas linhas com troca ("◆ título (1)", "▲ thumbnail (2)"), sem coluna quando não há troca. ⓘ abre, Esc fecha e devolve o foco ao botão. As marcas não recebem foco nem hover por si (o mouse sobre o losango não diz nada); aceitável, a leitura por dia cobre. **Pronto neste ponto.**

### Achados do item 1

| # | Sev. | Tela e estado | Achado | Evidência | Conserto |
|---|---|---|---|---|---|
| A2 | corrige | video e canal, impressões, todos os tamanhos | A faixa não tem título: os números (464, 389, 407...) ficam sob as datas sem dizer o que são; quem explica é a legenda, 100 px abaixo, em 3 linhas a 1440, com uma frase de 20 palavras ("cliques estimados do dia: o número na faixa sob as datas (a altura do ponto não mede nada)"). | `e-cheio-1440-escuro-imp.png`; texto da legenda no `a4-comum.js` | Escrever "cliques estimados" dentro da faixa (rótulo direto, 12 px, à esquerda) e encurtar a legenda para "cliques estimados do dia". |
| A3 | corrige | magro 390 (impressões); cheio 390; canal cheio 1440 | O número aparece só em alguns dias (regra de passo fixo); a legenda promete "o número na faixa". Magro 390: 2 pontos, 0 números (a captura mostra "••"). Cheio 390: 4 números para 18 pontos. Canal cheio 1440: 10 para 28. Ponto sem número volta a ser enigma. | `e-magro-390-claro-imp.png`, `e-cheio-390-escuro-imp.png`, `dif-canal-imp-casocheio-1440-escuro.png` | Desenhar o número sempre que não colide com o último já desenhado (guloso), em vez de passo fixo; ao menos um número no magro. |
| A4 | corrige | bloco de trocas, troca recente (estado de borda, simulado com troca em 09/10 no cheio) | Quando o "depois" ainda não foi medido (o YouTube atrasa 2 a 3 dias, e a troca recente é o caso mais comum), o bloco escreve "Depois: 0 impressões", "só 0 impressões: sem faixa" e "São 10.461 impressões antes e 0 depois". Nulo aparece como zero. | `borda-troca-recente.png` | Contar os dias não medidos da janela e dizer "Depois: ainda sem dia medido (o YouTube entrega com 2 a 3 dias de atraso)", com a forma e a cor de "não medido". |
| A5 | corrige | novo | "Trocas deste vídeo: nenhuma. O vídeo foi publicado ontem e ainda tem o título e a thumbnail de origem." afirma mais que o dado: o próprio `AJUSTES-UX-4.md` (seção 3) diz que não existe registro de trocas para vídeo próprio. O caso cheio-sem-troca diz "nenhuma registrada", mais honesto. | `v-novo-390-claro-full.png` | "Nenhuma troca registrada." e cortar "ainda tem o título e a thumbnail de origem". |
| A6 | corrige | cheio e magro, 390 e 1440, legenda dos gráficos | O link "o número é a ordem em Trocas deste vídeo" tem 264 x 18 px: abaixo dos 44 px que a revisão 3 mantinha a 390 px (e que ela deu como zero violação). | medido: `.ic-lk` 264 x 18 em 1440 e 390 | Altura mínima de 44 px para o alvo (padding vertical), ou virar texto sem link, já que o bloco está logo abaixo. |
| A7 | corrige | marcadores (gráficos e bloco) | O número dentro do losango e do triângulo tem 11 px (`.ic-trn`, `.tr-mk.m`), contra a regra do próprio `a4.css` (texto >= 12 px) e a revisão 3 (zero fonte abaixo de 12). No claro o número branco sobre o losango azul tem 4,73:1, margem de 0,23 sobre os 4,5. | tabela de medidas | 12 px em todos; ou escurecer o azul do claro um passo (`#1A6FAB` dá cerca de 5,3:1). |
| A8 | corrige | todas as telas com bloco de trocas | As duas escolhas do desenhista (100 impressões por lado e janela de até 7 dias) não chegam ao dono como decisão. O 100 aparece na tela só no estado "poucas" ("com menos de 100 de um lado"); o 7 só no ⓘ; a barra "estados do mockup" não as lista. Com 100 impressões a 5% a faixa de Wilson ainda vai de 2,1% a 11,2%: o limiar poderia ser outro, e a janela tem cobertura desigual (troca 1 usa 5 dias antes, porque pára na publicação; troca 2 usa 4 antes, porque pára na troca vizinha). | `e-cheio-1440-escuro-trocas.png`; nota da barra no `video.js` | Acrescentar à nota da barra do mockup: "Regras de exemplo, para você decidir: mínimo de 100 impressões por lado; janela de até 7 dias de cada lado, parando na troca vizinha." |
| S1 | sugestão | sem-dado | A linha "Trocas deste vídeo: sem leitura..." é texto puro; os cartões vizinhos usam a pastilha magenta "não medido". | `v-sem-dado-1440-claro-full.png` | Usar a mesma pastilha, para a ausência ter uma só cara na tela. |
| S2 | sugestão | cheio, frase-resumo | "Antes × depois, na de título não dá para separar da variação normal; na de thumbnail a taxa de clique ficou mais alta." O "Antes ×" solto e "variação normal" pedem esforço. | `e-cheio-1440-escuro-trocas.png` | "Taxa de clique: na troca de título, sem diferença que se sustente; na de thumbnail, subiu." |
| S3 | sugestão | cores | `--tr-t` é exatamente `--lado-b` (`#5AAEE6` escuro, `#1B78BA` claro) e `--tr-m` no claro é exatamente `--tier-high` (`#6D28D9`). O relatório chama de "cores novas"; o cabeçalho do `a4.css` diz "Nenhuma cor nova". Nesta tela cada cor tem um sentido só, mas o azul já significa "lado B" nas telas de comparação. | `a4.css` linhas 15, 18, 31, 33, 36 | Escolher um azul e um violeta que não repitam token existente, ou declarar a reutilização e corrigir o cabeçalho. |
| S4 | sugestão | cheio, trocas | A janela "antes" da troca 1 começa no dia da publicação (22/09: 9.066 impressões, 15% do total do vídeo), o pico de lançamento; compara o lançamento com a semana seguinte. É só o exemplo, mas é o que o dono vai ler como método. | `e-cheio-1440-escuro-trocas.png` | Dizer no ⓘ que a janela pára na publicação, ou excluir o dia da publicação como se exclui o dia da troca. |

## Item 2. Regressão no que o dono já aprovou (canal.html magro, cheio, cheio&aba=retencao)

**Veredito: volta para ajuste**, por um achado de dado (A1) e um de renderização (S5). O gráfico em si ficou como estava.

- **Gráfico "Impressões por dia do canal", cheio, 1440 e 390, claro e escuro:** barras, caixa vazada e hachura **idênticas** (diferença de pixels nas linhas das barras e do eixo: 0; só mudam as linhas a partir de 169 px, que é onde ficavam as bolinhas, e a faixa nova). Mesma conta no magro: barras, zero medido e hachura iguais.
- **O que mudou, e é o pedido:** o ponto saiu da barra para a faixa; texto da legenda e do ⓘ; o número aparece sob as datas (cheio 1440: 10 números onde antes não havia nenhum; veja A3).
- **Altura da página:** +40 px a 1440 e +58 px a 390 no canal (gráfico +18 px, legenda mais comprida +22 a +40). Sem rolagem lateral.

| # | Sev. | Tela e estado | Achado | Evidência | Conserto |
|---|---|---|---|---|---|
| A1 | corrige | canal cheio (lista "Vídeos", "Vídeos que mais aparecem", aba Retenção) e video cheio (cabeçalho e taxa) | O multiplicador de 1,4 na taxa do vídeo em destaque (`a4-dados.js`) alimenta views, curtidas e comentários (derivados dos cliques), então o exemplo do canal já aprovado mudou, sem aviso. Canal: Hanói **4,43 mil para 4,73 mil views**, **233 para 249 views por dia**, **3,04 para 3,23 mil cliques estimados**, aba Retenção **4.426 para 4.731**. Vídeo: curtidas 208 para 222, comentários 21 para 23, engajamento 1,3x para 1,4x, **taxa de clique 5,0% (4,8% a 5,2%) para 5,3% (5,1% a 5,5%)**, cliques 3.036 para 3.231. O texto do desenhista ("o resto da semente é idêntico") não vale. O dono vai avaliar justamente a "Taxa de clique deste vídeo": o número mudou desde o que ele viu. | `dif-lista-1440.png`, `dif-lista-390.png`, `dif-aparecem-1440.png`; diff de texto base contra novo | Aplicar a subida só às séries de troca, mantendo a taxa e as séries derivadas do vídeo como estavam (por exemplo, deslocar o efeito para o par de janelas e compensar nas demais impressões), ou, se o número novo fica, dizer na nota da barra que ele mudou e por quê. |
| S5 | sugestão | canal magro, gráfico de impressões | O halo novo em `ic-val` (traço de 3 px na cor do fundo) vale para todo gráfico por dia e engrossa visualmente os rótulos de valor do gráfico do canal (823 px diferentes só nos rótulos no magro 1440 claro). No cheio 1440 não há rótulo, então não aparece. Mudança fora da marca de cliques. | `dif-canal-magro-1440-claro.png` | Limitar o halo aos gráficos que têm trocas (classe só quando `trocas.length`). |

Pré-existente, não introduzido: a 390 px o último rótulo de data ("10/10", "07/10") passa 5 px do SVG (329 contra 324) e aparece cortado ("10/1", "07/1"); igual no `HEAD`. Sugestão para a próxima rodada, não por causa deste ajuste.

## Item 3. Blocos que o dono ainda vai avaliar

**Veredito: pronto para o dono**, com a ressalva do A1.

- **Retenção (curva):** conteúdo idêntico ao do `HEAD`: mesmo traçado (`d` do path igual), mesmos textos ("Metade das pessoas já saiu aos 6:52 (46% do vídeo)", "Maiores saídas: 0:00 a 0:45, de 100% para 73%; 5:40 a 6:25, de 66% para 52%", "Trechos revistos: 5:15 a 5:59; 8:52 a 9:27"). A diferença de pixels (16 mil) é só deslocamento de subpixel de 1 px por causa da altura da seção acima (confirmado: base contra base, 0). `dif-curva-1440.png`.
- **Taxa de clique deste vídeo:** quebra nenhuma: faixa do vídeo e do canal, frase "Fica um pouco acima da taxa do canal (4,6% a 4,8%): as duas faixas quase se tocam, então a diferença é pequena." Só o número mudou (A1).
- A taxa do vídeo (5,3%) e a leitura por troca (5,1% antes, 4,9% e 6,3% nas janelas) são coerentes entre si.

## Item 4. Regra da casa: `color-mix()`

**Pronto.** `grep color-mix` em `a4.css`, `a4-comum.js`, `video.js`, `canal.js`, `a4-dados.js`: uma só ocorrência, no comentário do cabeçalho do `a4.css` (linha 3: "Sem color-mix()"). Cores novas em hex literal nos dois temas (`--tr-t`, `--tr-m`, `--on-tr`); a linha de troca usa `opacity: .9` num traço sólido, não mistura de cor.

## As duas escolhas do desenhista: a tela deixa claro para o dono decidir?

**Não.** Ver A8. O limiar de 100 aparece só quando o estado "poucas impressões" é aberto; a janela de 7 dias, só dentro do ⓘ; nenhuma marca na tela ou na barra as trata como decisão pendente. O dono pode achar que é regra do produto.

## Medidas

Contraste (WCAG), lido da página, `--surface` do cartão como fundo.

| Elemento | Escuro | Claro | Mínimo |
|---|---|---|---|
| Losango (forma) contra o cartão | 6,80 | 4,43 | 3 |
| Triângulo (forma) contra o cartão | 7,26 | 6,65 | 3 |
| Número no losango (11 px) | 7,74 | 4,73 | 4,5 |
| Número no triângulo (11 px) | 8,26 | 7,10 | 4,5 |
| Linha vertical de título, opacidade .9 | 5,76 | 3,76 | 3 |
| Linha vertical de thumbnail | 6,14 | 5,57 | 3 |
| Losango contra triângulo (entre si) | 1,07 | 1,50 | informativo |
| Ponto de cliques contra a faixa | 16,20 | 14,21 | 3 |
| Número de cliques na faixa | 16,20 | 14,21 | 4,5 |
| Faixa contra o cartão (preenchimento) | 1,12 | 1,11 | decorativo |
| Borda da faixa contra o cartão | 1,09 | 1,25 | decorativo |
| Rótulo de valor | 14,48 | 15,76 | 4,5 |
| Datas do eixo | 6,18 | 7,13 | 4,5 |
| Pastilha "subiu" (texto e borda) | 7,26 | 6,37 | 4,5 / 3 |
| Pastilha "não dá para separar" (texto / borda) | 6,18 / 4,86 | 7,13 / 5,59 | 4,5 / 3 |
| Pastilha "poucas" (borda tracejada, magro) | 5,28 | 5,59 | 3 |
| "Antes" (texto apagado) | 6,18 | 7,13 | 4,5 |
| Faixa "antes" (borda) / "depois" (borda) | 6,18 / 6,72 | 7,13 / 4,94 | 3 |
| Limites da faixa (4,9% a 5,4%) | 6,18 | 7,13 | 4,5 |

A borda e o fundo da faixa de cliques têm contraste baixo (1,09 a 1,25), mas só delimitam a região; o que informa (ponto e número) tem 14 a 16:1.

Alvos e tamanhos (1440 e 390).

| Elemento | Medida | Veredito |
|---|---|---|
| Botões dia anterior / seguinte | 44 x 44 | ok |
| "Ver como tabela" | 98 x 44 | ok |
| ⓘ (390) | 44 x 44 | ok |
| ⓘ compacto (1440, ponteiro fino) | 28 x 28 | como nas telas aprovadas |
| Link "o número é a ordem..." | 264 x 18 | falha (A6) |
| Grupo do gráfico (foco) | 900 x 220 (impressões 258) a 1440; 324 x 180 / 218 a 390 | contorno de 2 px laranja |
| Altura do SVG de impressões, canal | 222 para 240 px (1440), 183 para 201 px (390) | +18 px |
| Altura da página do canal | +40 px (1440), +58 px (390) | aceitável |
| Rolagem lateral (scrollWidth contra largura) | igual em todas as combinações | ok |
| Fonte do número nos marcadores | 11 px | falha (A7) |

Dados dos casos (para conferir as frases): cheio, troca 1 (título, 27/09): antes 5 dias (22/09 a 26/09) 34.488 impressões, 5,1% (4,9% a 5,4%); depois 4 dias (28/09 a 01/10) 9.976 impressões, 4,9% (4,5% a 5,4%): faixas se cruzam. Troca 2 (thumbnail, 02/10): antes 4,9% (4,5% a 5,4%); depois 7 dias (03/10 a 09/10) 10.109 impressões, 6,3% (5,9% a 6,8%): não se cruzam, "subiu". Magro, troca 25/09: 1 impressão antes, 9 depois: "ainda não dá para dizer".

## O que NÃO consegui verificar

- Leitor de tela (a leitura por teclado foi lida do texto de `role="status"`, não ouvida).
- Opera, Safari e Firefox (só Chromium). O `clip-path` dos marcadores do bloco e da legenda não foi visto fora do Chromium.
- Movimento reduzido: o ajuste não adiciona animação, não testei a preferência.
- Dado real: tudo é exemplo; o relatório do desenhista (seção 3) diz que o registro de trocas de vídeo próprio ainda não existe e eu não consultei o banco.
- A pasta recebeu mudanças de outros ajustes durante a revisão (`AJUSTES-UX-5.md`, `c2-trocas`, `PLANO-UX-6.md`); medi a cópia tirada no começo.

## Roteiro de 30 segundos para o dono (itens 3, 4 e 6 da lista dele)

Valer só depois do A1 corrigido (senão o 5,3% que ele vê não é o 5,0% que viu antes).

1. **Item 3, tela do vídeo com as trocas (15 s).** Abra `video.html` (caso cheio). Em "Impressões e cliques", olhe a faixa sob as datas: os pontos estão todos na mesma linha, o número é o clique estimado do dia, e a altura não quer dizer nada. Ache o losango azul 1 (título, 27/09) e o triângulo roxo 2 (thumbnail, 02/10) nos dois gráficos. Clique no gráfico e use a seta direita até 27/09: a leitura cita a troca. Desça até "Trocas deste vídeo": leia a frase do topo, veja "▲ taxa subiu" na troca 2 e as duas faixas que não se cruzam. Troque para `?caso=magro`: "ainda não dá para dizer". Abra o ⓘ do bloco e decida os dois números de exemplo: 100 impressões por lado e janela de 7 dias.
2. **Item 4, taxa de clique (7 s).** Suba um pouco: "Taxa de clique deste vídeo". Confira se a frase e a faixa do vídeo e do canal se leem de relance e se "as faixas quase se tocam" faz sentido.
3. **Item 6, curva de retenção (8 s).** Desça até "Retenção": a curva mostra a metade que sai aos 6:52, as maiores saídas (triângulos amarelos) e os trechos revistos (faixas cinza). Pergunta: dá para achar onde as pessoas saem sem ler a legenda?
