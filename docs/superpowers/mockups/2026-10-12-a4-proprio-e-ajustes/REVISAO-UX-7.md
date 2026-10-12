# Revisão de UX 7 (12/10/2026): tela do vídeo próprio depois do AJUSTES-UX-7

Revisor: revisor-ux-senior. Não editei nenhum mockup. Medi uma CÓPIA da pasta (scratchpad `video-rev7/`; confirmei por `diff -r` que a original não mudou durante a revisão) e uma extração do `HEAD` (`git archive HEAD`, scratchpad `head/`). Chromium via Playwright sobre `file://`, requisições externas bloqueadas (fontes e capa do YouTube; rodada determinística), 1440 e 390 px (390 com `hasTouch`/`isMobile` para o ponteiro grosso), escuro e claro. Lidos: o brief do dono, REVISAO-UX-4, PLANO-UX-7, AJUSTES-UX-7, `video.js`, `a4-comum.js`, `a4-dados.js`, `a4.css`, `canal.js`. Capturas em `ux-revisao-7-shots/` (40 do vídeo em 10 estados x 2 larguras x 2 temas; 2 de ⓘ/figura; 3 em escala de cinza). Navegador fechado.

## Resumo

| Item | Veredito |
|---|---|
| 3. Tela do vídeo com trocas (`video.html`) | **volta para ajuste** (3 achados "corrige", todos de uma linha) |
| 4. "Taxa de clique deste vídeo" (cheio e magro) | **pronto para o dono**: concordo que está bom o bastante |
| 6. "Retenção" (curva) | **pronto para o dono**: concordo que está bom o bastante |
| Regressão do canal já aprovado (magro; cheio, gráfico de impressões; cheio&aba=retencao) | **pronto para o dono**: regressão zero provada; a única diferença é a marca de cliques |

Dos achados da REVISAO-UX-4: A1, A4, A5, A6, A7, A8, S2, S4, S5 resolvidos; A2 e A3 resolvidos em parte; S1 e S3 em parte; o pré-existente só no vídeo. Nenhum achado **bloqueia**. Há 4 **corrige** novos (N1 a N4) e 6 **sugestão**.

**As três coisas que mais derrubam o conjunto agora**

1. **Marca inventada em gráfico de vídeo real, sem "exemplo" no gráfico (N1).** No `?caso=magro` (padrão do magro) o losango "1" e a legenda "troca de título" aparecem sobre o vídeo real "O Que Esperar Do MBK Center"; o aviso de que a troca é inventada está mais de 600 px abaixo (medido a 390 px).
2. **Os dois estados novos de "sem troca" não se distinguem sem cor (N2).** "não registrado" (hoje) e "nenhuma registrada" (futuro) são duas caixinhas de 12 px com texto quase igual; a hachura da pastilha tem 14% de alfa e some. A diferença que o desenhista declara de "forma" não existe a olho nu.
3. **Cor de marcador que colide com cor de significado já existente (N3).** O violeta da thumbnail está a 9,3 (escuro) e 14,6 (claro) de distância do violeta de "descrição" (`--tier-high`); o azul do título, no claro, está a 2,7 do `--tier-mid` e a 10 a 11 do `--lado-b`. Os tokens são "diferentes"; os olhos não os separam.

## Item 3. `video.html` com trocas

**Pergunta de quem abre:** "a capa ou o título que troquei funcionou?". **Resposta no primeiro olhar:** parcial. Em 3 s, sem rolar, a 1440 se vê "o que mudou e quando" (losango 1 e triângulo 2 no gráfico de views); a resposta ("subiu / sem diferença") está a cerca de 1.900 px abaixo a 1440 (2.700 px a 390), no bloco "Trocas deste vídeo" (sugestão N10). **Veredito: volta para ajuste.**

### A1 a A8, S1 a S5 e pré-existente, um por um (medida minha)

| # | Antes | Agora | Evidência |
|---|---|---|---|
| A1 | corrige: exemplo mexeu em números aprovados | **resolvido** | Seção "Regressão" abaixo: 0 pixel no SVG, tabelas e leituras por dia idênticas nas 12 combinações. |
| A2 | corrige: faixa sem título | **resolvido em parte** | Rótulo "cliques estimados por dia" dentro da faixa: 12 px, 6,18 (escuro) / 7,13 (claro) contra o cartão. Legenda cabe em 1 linha a 1440 (2 a 390). Cláusula discutida abaixo (N6). |
| A3 | corrige: número só em alguns dias | **resolvido em parte** | Cheio 1440: 18 pontos, 18 números. Cheio 390: 18 pontos, 9 números (antes 4). Canal cheio 1440: 28 pontos, 14 números; 390: 28 pontos, 9. Magro 390: 2 pontos, 1 número (antes 0). Nenhum número se sobrepõe a outro (0 sobreposições medidas). O segundo ponto do magro a 390 fica sem número por 0,17 px: largura do dia 291/29 = 10,03 px, o critério pede 10,2 (3 px de folga). Ver N5. |
| A4 | corrige: troca recente com "0 impressões" | **resolvido** | `?caso=cheio&trocas=recente`: "Depois: ainda sem dia medido", pastilha "? depois ainda não medido", caixa hachurada vívida ("não medido: ainda sem dia fechado"), frase "o depois ainda não foi medido". Texto 6,77 / 6,37 contra o fundo da pastilha; borda 4,09 / 4,57 contra o cartão. Nunca aparece "0 impressões". |
| A5 | corrige: "nenhuma" onde o sistema não sabe | **resolvido no texto**; forma ainda fraca (N2) | Novo, sem-dado e `sem-registro` dizem "não registrado ... não dá para dizer se este teve alguma". |
| A6 | corrige: link de 18 px | **resolvido** | 264 x 44 no toque (390); 28 px com mouse a 1440 (como os outros controles compactos). Todos os alvos do vídeo a 390 com toque: >= 44 em largura e altura (lista completa na tabela de medidas). |
| A7 | corrige: número do marcador 11 px, 4,73:1 | **resolvido** | 12 px. Número sobre o losango 10,11 / 6,17; sobre o triângulo 8,26 / 6,93. Forma contra o cartão: losango 8,89 / 5,78; triângulo 7,26 / 6,49 (mín. 3). |
| A8 | corrige: limiar e janela não chegam ao dono | **resolvido** | Etiqueta "decisão sua" (12 px, contorno e texto 7,81 / 6,12) com "Regras de exemplo: mínimo de 100 impressões por lado; janela de até 7 dias antes e 7 depois da troca", logo abaixo do aviso "exemplo", visível sem abrir nada a 1440 e a 390; repetido na nota da barra do mockup e no ⓘ ("regras de exemplo, a decidir"). Valores vêm de `A.MIN_IMP` e `A.JANELA`. |
| S1 | sugestão: sem-dado sem pastilha | **em parte** | Usa a pastilha de não medido com o rótulo "não registrado". Ver N2. |
| S2 | sugestão: frase-resumo difícil | **resolvido** | "Taxa de clique depois da troca: título (1), sem diferença que se sustente e thumbnail (2), subiu." Sobra o "e" ambíguo (N9). |
| S3 | sugestão: cores repetem tokens | **em parte** | Valores trocados, cabeçalho do CSS corrigido; mas visualmente ainda colidem (N3). |
| S4 | sugestão: dia da publicação na janela | **resolvido** | Troca 1, "Antes: 4 dias (23/09 a 26/09)"; o 22/09 saiu. Dito no ⓘ. |
| S5 | sugestão: halo no canal | **resolvido** | SVG do canal, 0 pixel de diferença com os rótulos de valor visíveis (ver Regressão). |
| Pré-existente: última data cortada | sugestão | **resolvido só no vídeo** | Última data contra a borda do SVG, 390: vídeo -1,0 px (dentro), HEAD +4,5 a +7,0. No canal, 390: +7,6 / +7,2 px (rótulo "10/1" cortado), 1440: +1,4 / +0,5; igual ao HEAD. Ver "Decisão aberta" abaixo. |

### Respondendo às perguntas 5 e 6

**Estado "não registrado" (hachura magenta) contra "nenhuma registrada" (caixa vazada): lê-se de relance e sem cor?** Não. Medido em escala de cinza (`gray-impressoes-*.png`; recorte do parágrafo): as duas são caixinhas arredondadas de 12 px com texto de uma linha; a hachura da pastilha `.nm` é `--nm-fio` a 14% de alfa (14% sobre `--nm-bg`), invisível; o que separa as duas é o brilho da borda e as palavras ("não registrado" contra "nenhuma registrada": palavras quase iguais). A caixa vazada "zero medido" que o dono aprovou tem outra geometria (barra com borda vazada dentro do gráfico), não esta. É o achado N2.

**A hachura magenta conflita com a hachura de "não medido" aprovada?** Não no significado: nos dois casos é "dado que o sistema não tem; não é zero", a mesma regra do dono. O conflito é de uso: na legenda do gráfico por dia, `trocas ...: ainda não registradas` ganha um swatch hachurado IDÊNTICO ao do item "não medido: o dia ainda não chegou", na linha logo acima, e no gráfico não existe nenhuma marca hachurada de troca para o leitor associar (N4). Manter o magenta e a família; trocar o swatch da legenda.

**"decisão sua" é vista sem abrir nada?** Sim, em `exemplo` (cheio e magro, 1440 e 390). Pequeno (12,5 px, cor `--muted`) mas com a etiqueta de contorno verde-azulada; aceitável. Só não existe nos estados `sem-registro` e `nenhuma` (não há regra a decidir nelas): correto.

**Cores dos marcadores: significado único e sem colisão?** Dentro de `video.html` sim (nenhum outro elemento usa azul ou violeta; nada é verde ou âmbar). Na pasta, não bem (N3). Distância CIE76 (maior é mais distinto; menos de cerca de 15 se confunde):

| Par | Escuro | Claro |
|---|---|---|
| `--tr-m` (thumbnail) contra `--tier-high` (descrição) | **9,3** | **14,6** |
| `--tr-t` (título) contra `--lado-b` (lado B) | 11,4 | 10,4 |
| `--tr-t` contra `--tier-mid` | 13,9 | **2,7** |
| `--tr-t` contra `--c2-ia` | 25,9 | 56,7 |
| `--tr-t` contra `--tr-m` (entre si) | 43,2 | 69,3 |
| Luminância entre as duas cores de marcador | 1,22:1 | 1,12:1 (só a forma e o número separam; basta) |

"decisão sua" usa `--forja` (verde-azulado), a cor que a pasta já usa para "estado atual do mockup" e "novo"; coerente. No claro ela fica ao lado do verde de "taxa subiu" (distância 27,6), mas as duas são pastilhas de contorno com texto diferente; não conta como colisão.

**6. Qual é o estado padrão de `video.html` (sem `trocas`)?** `?caso=cheio` com `trocas=exemplo`: o dono abre e vê o DESENHO DA IDEIA (2 marcas, bloco com antes e depois), não o estado de hoje. É o padrão certo para ele avaliar o pedido (marcar trocas e ver antes e depois). A tela deixa claro que é exemplo? **No cheio sim**: chip "exemplo" ao lado do título (o vídeo inteiro é exemplo) e, no bloco, "exemplo: Hoje o sistema ainda não registra trocas dos vídeos do seu canal. Esta seção mostra como ficaria". **No magro não**, nos gráficos (N1). O estado de hoje (`sem-registro`) só se chega pela barra "Estados do mockup", que abre fechada; por isso o roteiro abaixo dá as duas URLs.

### Achados do item 3 (novos)

| # | Sev. | Tela e estado | Achado | Evidência | Conserto |
|---|---|---|---|---|---|
| N1 | corrige | `video.html?caso=magro` (padrão do magro) e `...&trocas=recente` | Losango "1", linha vertical e legenda "troca de título" aparecem sobre os gráficos de um vídeo REAL; o aviso "a troca e a capa de antes são inventadas" só existe no bloco de baixo (mais de 600 px abaixo a 390). Frase do produto ("Título trocado neste dia (troca 1)" na leitura por teclado) afirma mais que o dado. No cheio o chip "exemplo" do cabeçalho cobre; no magro o cabeçalho não tem chip. | `v-magro-390-escuro.png` (legenda "troca de título" sem aviso; bloco com aviso bem abaixo) | Quando as trocas são de exemplo, a legenda diz "troca de título (exemplo)" e "troca de thumbnail (exemplo)", e a leitura por dia diz "(exemplo)". |
| N2 | corrige | `?trocas=sem-registro` contra `?trocas=nenhuma`, todos os casos | "não registrado" e "nenhuma registrada" não se distinguem por forma nem por símbolo: caixinhas de 12 px parecidas, hachura da pastilha a 14% de alfa, palavras quase iguais. Regra do dono: estados se distinguem por cor E forma ou símbolo. | `gray-impressoes-semreg-1440.png`; recorte em cinza: duas caixas de contorno | Pastilha de "não registrado" com o símbolo e a hachura forte que a própria tela já usa em "? depois ainda não medido" (`.tr-dv.nmc`); "nenhuma registrada" com a caixa vazada e um "0" ou "—" antes. |
| N3 | corrige | marcadores (gráficos, legenda, bloco) | Cores de tipo de troca perto demais de cores com significado na pasta (tabela acima). Como a forma e o número já separam título de thumbnail, a cor não carrega informação aqui. | Tabela de distâncias | Marcadores em `--text` (14,48 / 15,76 contra o cartão), preenchidos, diferenciados só por losango e triângulo; ou dois matizes que não existam na pasta. |
| N4 | corrige (pequeno) | `?trocas=sem-registro`, legenda dos gráficos por dia | Dois itens de legenda seguidos com o MESMO swatch hachurado e significados diferentes ("não medido: o dia ainda não chegou" e "trocas de título e de thumbnail: ainda não registradas"); só o primeiro tem correspondente no gráfico. | `v-cheio-semreg-1440-escuro.png` | Legenda de "não registrado" sem swatch, ou swatch próprio (contorno de losango + triângulo hachurado). |
| N5 | sugestão | faixa de cliques, 390 | Metade dos pontos sem número (cheio 18/9; canal cheio 28/9; magro 2/1). Os números formam uma fila ("526 489 559 570 ...") e não indicam de que ponto vêm. Magro: faltam 0,17 px para o segundo número caber. | `canal-cheio-impressoes-390-escuro.png`, `v-magro-390-escuro.png` | Folga de 3 para 2 px resolve o magro; para o cheio a 390, aceitar (a leitura por dia, a tabela e os botões trazem o número). |
| N6 | sugestão | legenda da faixa (todas as telas com cliques, inclusive o canal) | "(a altura do ponto não mede nada)": ver "Discordância sobre A2". | `imp-claro.png` | Tirar da legenda; fica no ⓘ, onde já está. |
| N7 | sugestão | `?caso=magro&trocas=nenhuma` | "desde a publicação, em 10/12": vídeo de dezembro de 2024 sem o ano; lê-se como data futura. | texto da tela | Usar `dd/mm/aaaa` quando o vídeo tem mais de 1 ano (o cabeçalho já usa). |
| N8 | sugestão | números da faixa | "1139" sem ponto de milhar na faixa; a tabela e a leitura dizem "1.139". Aparece no canal cheio. | `canalnum.js`: 14 de 14 números batem com a tabela depois de tirar o ponto | `A.n()` também na faixa. |
| N9 | sugestão | frase-resumo, 2 trocas | "título (1), sem diferença que se sustente e thumbnail (2), subiu": o "e" mistura a lista com o veredito. | texto | Ponto e vírgula entre os dois itens. |
| N10 | sugestão | cheio, primeiro olhar | A resposta "funcionou?" fica a ~1.900 px do topo a 1440 (a 390, a ~2.700 px). | `v-cheio-1440-escuro.png` | Uma linha-resumo acima do primeiro gráfico: "2 trocas: título sem diferença firme; thumbnail, taxa subiu" com link para o bloco. Pode ficar para a implementação. |

### Discordância sobre A2 (resposta ao argumento do desenhista)

O argumento: a frase é a resposta literal à dúvida do dono ("quanto mais alto, maior o clique?"). Reconheço o motivo, e retiro a severidade de "corrige" para "sugestão". Mantenho que a frase sai da legenda, por três razões medidas: (1) a dúvida nasceu do ponto DENTRO da barra; agora todos os pontos ficam na mesma linha, numa faixa com título dentro ("cliques estimados por dia") e o número embaixo, então a leitura "altura = valor" deixou de existir por construção; explicar o que a marca NÃO é, depois de ela não poder ser lida assim, é texto repetido; (2) custa uma linha a mais a 390 e entra na tela do canal, que o dono aprovou sem essa frase (a legenda do canal só dizia "cliques estimados"); (3) a mesma frase já mora no ⓘ, que é onde o dono pediu o método. Discordância que sobra para o dono: o desenhista quer a frase na legenda; eu quero no ⓘ. Não bloqueia.

### Decisão aberta: `bordaFinal` (última data cortada) só no vídeo

**Recomendação: ligar também no canal, avisar o dono e provar com um recorte.** O defeito é real e feio (390 px, canal: "10/10" vira "10/1", +7,6 px fora do SVG; a 1440, +1,4 px), é a tela que vai virar produto, e o conserto desloca uma única etiqueta de data (no máximo 7 px para dentro) sem tocar barras, caixas, hachuras, números ou textos. A regra "regressão zero" existe para impedir mudança que ninguém pediu e ninguém viu; esta seria declarada e circunscrita. Se o dono preferir congelar a tela aprovada, o defeito vira pendência explícita da implementação ("rótulo final contido no SVG"), não segredo do mockup. Eu não aprovaria que ele fique igual sem uma das duas coisas escritas.

## Item 4. "Taxa de clique deste vídeo" (cheio e magro)

**Pergunta:** "o clique deste vídeo é bom ou ruim comparado ao canal?". **Veredito: pronto para o dono. Concordo que está bom o bastante.**

Prova contra o `HEAD` (elemento `.ctr`, captura por elemento, 1440 e 390, claro e escuro):

| Caso | Pixels diferentes (>30/255) | Texto |
|---|---|---|
| cheio 1440 e 390, ambos os temas | **0** | idêntico: "5,0% das impressões viraram clique (3.036 de 61.023). A taxa real fica entre 4,8% e 5,2%. Fica um pouco acima da taxa do canal (4,6% a 4,8%): as duas faixas quase se tocam, então a diferença é pequena." |
| magro 1440, ambos os temas | **0** | idêntico: 11,1% (2 de 18), 3,1% a 32,8%, faixa tracejada "ainda não conclui" |
| magro 390, ambos os temas | altura 335 para 351 px | texto idêntico; a nota "faixa tracejada: ainda não conclui" desceu para a linha de baixo. No `HEAD` ela estava colada em "Este vídeo" ("Este vídeofaixa tracejada: ..."): é conserto de defeito, não regressão. |

O 5,0% (4,8% a 5,2%), 3.036 cliques e 61.023 impressões continuam como no `HEAD` (o multiplicador 1,4 sumiu). Views 4.426 (4,43 mil), 233 por dia, curtidas 208, comentários 21, engajamento 1,3x e "o normal do canal" 1,3x também. Os cliques POR DIA do vídeo em destaque mudam em relação ao `HEAD` (22/09: 464 para 446; 27/09: 235 para 226; soma 3.036 nos dois), e o texto do desenhista já diz isso: não altera nenhum total nem nada do canal.

## Item 6. "Retenção" (curva)

**Pergunta:** "onde as pessoas saem do vídeo?". **Veredito: pronto para o dono. Concordo que está bom o bastante.**

Seção `Retenção` do cheio, `HEAD` contra agora: os 2 `path` do SVG iguais caractere por caractere (1440 e 390), marcação do SVG com o mesmo tamanho (4.245 e 4.112 caracteres), texto igual ("Metade das pessoas já saiu aos 6:52 (46% do vídeo)", "Maiores saídas: 0:00 a 0:45, de 100% para 73%; 5:40 a 6:25, de 66% para 52%", "Trechos revistos: 5:15 a 5:59; 8:52 a 9:27"), altura igual (454 px a 1440; 541,5 px a 390). A diferença residual de pixels (1.333 a 1.376 a 1440 depois de alinhar; 1 px de altura a 390) é deslocamento sub-pixel por causa da altura da seção de cima. Magro: bloco "Retenção ... não medido" idêntico (0 pixel).

## Regressão do canal já aprovado (A1, a pergunta que decide)

**Veredito: pronto para o dono. Regressão zero provada; a única diferença é a marca de cliques.**

Três telas (`canal.html?caso=magro`, `?caso=cheio`, `?caso=cheio&aba=retencao`) x 1440 e 390 x claro e escuro = 12 combinações, `HEAD` contra a cópia:

1. **Pixels, SVG do gráfico "Impressões por dia do canal" (barras, caixas vazadas, hachura, eixo, datas, rótulos de valor), com pontos, números e faixa escondidos nos dois lados: 0 pixel diferente em 12 de 12** (recorte de 200 x 699 a 1440, 160 x 324 a 390).
2. **Pixels, resto da página:** deslocando a cópia pela altura acrescentada (+28 px a 1440, +68 px a 390), tudo abaixo do gráfico é idêntico, exceto o ícone ⓘ de "Taxa de clique" a 390 (6 a 8 pixels, variação máxima de 68 a 92 em soma dos 3 canais, ou seja, antialias de meio pixel; já tinha sido declarado pelo desenhista). Tudo acima do gráfico: idêntico.
3. **Texto:** a única mudança de texto visível nas 12 combinações é a marca: "cliques estimados por dia" (rótulo da faixa), a legenda ("cliques estimados" para "cliques estimados do dia (a altura do ponto não mede nada)") e os números sob os pontos (canal cheio: 14 números a 1440 e 9 a 390 onde o `HEAD` mostrava nenhum; magro 390: 1). Os ⓘ do gráfico trocaram "Bolinha e número embaixo" por "Faixa sob as datas".
4. **Tabela dia a dia e leitura por dia (40 dias percorridos pelo botão "Dia seguinte"):** `HEAD` e cópia IDÊNTICAS nas 12 combinações. Ou seja, nenhum número que o dono possa ler no canal mudou.
5. **A redistribuição dos cliques por dia do vídeo em destaque muda algum número visível numa tela aprovada? Não.** Os cliques por dia do canal (28 dias) vêm de outra série; as tabelas e leituras acima são idênticas, assim como o texto de "Vídeos", "Vídeos que mais aparecem" e da aba Retenção. O que muda é só dentro de `video.html`: os cliques por dia do vídeo em destaque (soma igual, 3.036).
6. Os números da faixa do canal batem com a tabela (14 de 14 a 1440 e 9 de 9 a 390, depois de tirar o ponto de milhar: N8).
7. Sem rolagem lateral e sem erro de página em nenhuma combinação.

Diferenças que o dono vai VER no canal e que são consequência do pedido, não regressão: a faixa de 48 px sob as datas (página +28 px a 1440 e +68 px a 390, mais 1 linha de legenda a 390) e os números nela.

## Item 8. Regra da casa

- `color-mix()`: 3 ocorrências em `a4.css`, todas em COMENTÁRIO ("Sem color-mix()"); zero em `a4-comum.js`, `video.js`, `canal.js`, `a4-dados.js`. Pronto.
- Texto >= 12 px: zero elementos abaixo de 12 px em 40 combinações do vídeo (10 estados x 2 larguras x 2 temas), medido por `getComputedStyle` em HTML e SVG. (Única exceção na pasta: `.c2-ar`, 10 px, é um glifo de seta em `c2-trocas`, fora desta tela.)
- Alvo de 44 px a 390 com toque: nenhum alvo interativo do vídeo abaixo de 44 x 44 (lista na tabela). Com mouse a 1440 o link da legenda tem 28 px, como os controles compactos aprovados.
- 390 sem rolagem horizontal: `scrollWidth` = 390 nas 40 combinações do vídeo e nas 12 do canal; nenhum erro de página.
- Nenhum texto de SVG cortado no vídeo (a 390 a última data sobra -1,0 px, dentro); no canal a 390 a última data sobra +7,6 / +7,2 px (igual ao `HEAD`).

## Medidas

| Elemento | Escuro | Claro | Mínimo |
|---|---|---|---|
| Rótulo da faixa "cliques estimados por dia" (12 px) | 6,18 | 7,13 | 4,5 |
| Número e ponto de cliques | 14,48 | 15,76 | 4,5 / 3 |
| Losango (forma) contra o cartão | 8,89 | 5,78 | 3 |
| Triângulo (forma) contra o cartão | 7,26 | 6,49 | 3 |
| Número no losango (12 px) | 10,11 | 6,17 | 4,5 |
| Número no triângulo (12 px) | 8,26 | 6,93 | 4,5 |
| Linha vertical de título / thumbnail | 8,89 / 7,26 | 5,78 / 6,49 | 3 |
| "decisão sua" (texto e contorno) | 7,81 | 6,12 | 4,5 / 3 |
| Aviso "exemplo" e linha das regras (12,5 px) | 6,18 | 7,13 | 4,5 |
| "não medido" / "não registrado": texto contra o fundo | 6,77 | 6,37 | 4,5 |
| Borda da pastilha contra o cartão | 4,09 | 4,57 | 3 |
| Parágrafo "Trocas deste vídeo: não registrado" (13 px, `--muted`) | 6,18 | 7,13 | 4,5 |
| Losango contra triângulo (luminância) | 1,22 | 1,12 | informativo (a forma separa) |

| Alvo / tamanho | Medida | Veredito |
|---|---|---|
| "Dia anterior", "Dia seguinte" (390, toque) | 44 x 44 | ok |
| "Ver como tabela" | 98 x 44 | ok |
| Link "o número é a ordem em Trocas deste vídeo" | 264 x 44 (390); altura 28 com mouse a 1440 | ok |
| Os 7 ⓘ da tela (390) | 44 x 44 | ok |
| Breadcrumb ("Canais", "Mochila na Estrada"), "Próximo" (390) | 49 x 44, 123 x 44, 80 x 44 | ok |
| Altura da faixa de cliques | 48 px (rótulo 12 px; pontos; números 12 px) | ok |
| Rolagem lateral | scrollWidth = largura em 52 combinações | ok |
| Fonte mínima | 12 px | ok |

## Teclado, ⓘ, tabela

Medido em `?caso=cheio`: o grupo do gráfico recebe foco; Home e setas andam dia a dia; 27/09: "dom 27/09: 4.607 impressões, 226 cliques estimados. Título trocado neste dia (troca 1)"; 02/10: "sex 02/10: 1.843 impressões, 82 cliques estimados. Thumbnail trocada neste dia (troca 2)". Tabela: coluna "Troca" só quando há troca ("27/09 ... ◆ título (1)", "02/10 ... ▲ thumbnail (2)"). ⓘ de "Como ler antes e depois": abre, mostra os cinco itens (inclusive "Não é teste A/B ... use o A/B Lab" e "regras de exemplo, a decidir"), Esc fecha e devolve o foco ao botão. No `sem-registro`, o ⓘ do gráfico explica "Gráfico sem marca não quer dizer que não houve troca". Pronto neste ponto (a leitura fala "Título trocado" também sobre exemplo: N1).

## Discordâncias que sobram para o dono (se o desenhista mantiver a posição)

1. **Legenda da faixa: "(a altura do ponto não mede nada)"**. Desenhista: fica na legenda. Revisor: sai da legenda e fica no ⓘ (N6). Não bloqueia.
2. Nenhuma outra: se o desenhista concordar com N1 a N4, o item 3 passa a "pronto" sem nova rodada de decisão do dono. Decisão que é DO DONO, independente de nós: ligar `bordaFinal` no canal (recomendação acima) e os dois números de exemplo (100 impressões; 7 dias).

## O que NÃO consegui verificar

- Leitor de tela (a leitura por teclado foi lida do texto do `role="status"`, não ouvida).
- Opera, Safari, Firefox (só Chromium; o `clip-path` dos marcadores do bloco e da legenda e `:popover-open` só vistos no Chromium).
- Movimento reduzido: o ajuste não cria animação; rodei a regressão do canal com `reducedMotion: reduce` e o vídeo com o padrão, sem diferença.
- Fontes reais (Fraunces, Inter, JetBrains Mono): bloqueadas para a rodada ser determinística; a largura dos números da faixa com a mono real pode mudar 1 ou 2 px o que cabe a 390 (N5).
- Dado real: tudo é exemplo; não existe registro de trocas de vídeo próprio e eu não consultei o banco.
- Hover do mouse sobre os marcadores: eles não recebem foco nem hover por si; a leitura por dia cobre.

## Roteiro de 30 segundos (abrir a partir de `docs/superpowers/mockups/2026-10-12-a4-proprio-e-ajustes/`)

**Item 3, tela do vídeo com trocas (valer só depois de N1 a N4).**
1. `video.html` (padrão: cheio com trocas de exemplo). Em 5 s: ache o losango azul "1" (título, 27/09) e o triângulo roxo "2" (thumbnail, 02/10) nos gráficos; olhe a faixa preta sob as datas: pontos todos na mesma linha, número embaixo, altura não quer dizer nada.
2. No gráfico de impressões clique e use a seta direita até 27/09: a leitura cita a troca. (10 s)
3. Desça até "Trocas deste vídeo": leia "exemplo" e "decisão sua" (100 impressões, 7 dias: concorda?), a frase-resumo, e a troca 2 com "taxa subiu". (10 s)
4. Compare com o estado de hoje: `video.html?caso=cheio&trocas=sem-registro` (sem marcas, "não registrado"); e o caso fraco `video.html?caso=magro` ("ainda não dá para dizer", 1 e 9 impressões). Troca recente: `video.html?caso=cheio&trocas=recente`. (5 s)

**Item 4, taxa de clique.** `video.html` e `video.html?caso=magro`; vá a "Taxa de clique deste vídeo" (logo abaixo do gráfico de impressões). Cheio: "5,0% ... acima do canal: as faixas quase se tocam". Magro: faixa tracejada "ainda não conclui". Pergunta: dá para saber em 3 s se o vídeo está melhor que o canal e quanto confiar? (30 s)

**Item 6, curva de retenção.** `video.html` (a curva só existe no cheio); desça até "Retenção". Triângulos amarelos = maiores saídas, faixas cinza = trechos revistos, linha pontilhada = "metade já saiu aqui" (6:52). Pergunta: dá para achar onde as pessoas saem sem ler a legenda? (30 s)
