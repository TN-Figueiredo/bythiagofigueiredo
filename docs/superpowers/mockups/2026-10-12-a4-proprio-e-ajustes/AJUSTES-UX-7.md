# Ajuste 7: video.html depois da REVISAO-UX-4 (12/10)

Plano escrito antes de mexer: `PLANO-UX-7.md`. Tocados: `a4-dados.js`, `a4-comum.js`, `a4.css` (regras novas antes do bloco c2, que não foi tocado), `video.js`. `canal.js`, `c2-trocas.*`, `c1-*`, `comparar-*` intocados nesta rodada. Nada commitado. Capturas em `ajuste-7-shots/` (40: video em 4 casos x 2 larguras x 2 temas; trocas em 3 estados extras x 2 x 2; canal magro, cheio e Retenção x 2 x 2).

## O que mudou, por arquivo

**`a4-dados.js` (A1).** Saiu o multiplicador 1,4 que vazava para views, cliques, curtidas. O exemplo de trocas agora só **redistribui os cliques por dia** do vídeo em destaque (taxa 4,9% nos dias 1 a 4, 4,5% nos dias 6 a 9, 5,8% nos dias 11 a 17; os dias 0, 5 e 10 absorvem a diferença), de modo que a soma é exatamente a de antes. Trocas de exemplo continuam: cheio (título 27/09, thumbnail 02/10) e magro (título 25/09).

**`a4-comum.js`.**
- Faixa de cliques (A2, A3): rótulo "cliques estimados por dia" dentro da faixa (12 px); faixa com 48 px (rótulo, pontos, números); números desenhados de forma gulosa (sempre que não encostam no anterior, folga de 3 px); pontos a partir de 7,5 px por dia (antes 9: o canal cheio a 390 px não mostrava ponto algum e a faixa ficava vazia). Legenda numa linha: "cliques estimados do dia (a altura do ponto não mede nada)".
- Marcadores de troca maiores (26 px), número a 12 px (A7); topo do gráfico 40 px quando há troca; item de legenda hachurado "trocas ... ainda não registradas" (`legTrocas`) quando não há registro.
- Contorno dos valores só em gráfico com troca (`tem-trocas`, S5).
- `bordaFinal`: última data deslocada para caber no SVG (pré-existente); só liga onde a tela pede (vídeo).
- `A.JANELA = 7` ao lado de `A.MIN_IMP = 100` (as duas regras de exemplo, um lugar só).
- `A.antesDepois`: lado "não medido" (caixa hachurada magenta, "não medido: ainda sem dia fechado") em vez de zero (A4).
- `A.faixaTaxa`: abaixo de 480 px a nota "faixa tracejada: ainda não conclui" vai para a linha de baixo (colidia com "Este vídeo" no magro a 390 px; só o vídeo usa título e nota).

**`a4.css`.** `--tr-t` (#86C5F2 escuro, #17669A claro) e `--tr-m` (#B79CFF, #7A2FC4) novos e distintos de `--lado-b` e `--tier-high` (S3; cabeçalho do arquivo corrigido). Número dos marcadores a 12 px. `.ic-lk` com 44 px (28 px em desktop com mouse, como os outros compactos) (A6). Classes novas: `.ic-stl`, `.tr-dv.nmc`, `.tr-zero`, `.ex.dec`, `.ctr-nmbox`, `.ctr-nmt`. Zero `color-mix()` (as 3 ocorrências do grep são comentários).

**`video.js`.**
- Estados de trocas (A5 e fato do sistema): `?trocas=` com `exemplo` (padrão), `recente`, `nenhuma`, `sem-registro`; linha "Trocas" na barra do mockup (cheio e magro; `recente` só no cheio). Vídeo novo e sem dado: sempre sem registro.
  - **Sem registro (hoje):** "Trocas deste vídeo: [não registrado] O sistema ainda não registra as trocas de título e de thumbnail dos vídeos do seu canal..." (pastilha hachurada magenta, forma de não medido). Os gráficos por dia ganham o item hachurado na legenda e um parágrafo no ⓘ ("gráfico sem marca não quer dizer que não houve troca").
  - **Nenhuma troca registrada:** caixa vazada neutra (a forma do zero medido), marcada "exemplo" porque o registro ainda não existe.
- Troca recente (A4): contagem de dias medidos por janela; sem dia medido, pastilha "? depois ainda não medido", linha hachurada e frase própria; nunca "0 impressões". Estado visível em `?caso=cheio&trocas=recente` (terceira troca em 09/10).
- A8: dentro do bloco, abaixo da faixa "exemplo", linha com a etiqueta "decisão sua": "mínimo de 100 impressões por lado; janela de até 7 dias antes e 7 depois da troca". Repetido na nota da barra. Os valores vêm das constantes.
- S2: frase-resumo "Taxa de clique depois da troca: título (1), sem diferença que se sustente; thumbnail (2), subiu."; pastilha "≈ sem diferença firme"; "pode ser só acaso" no lugar de "variação normal". S4: o dia da publicação sai da janela "antes" (dito no ⓘ). A faixa "exemplo" diz que hoje não há registro e que o bloco mostra como ficaria.

## Prova da regressão zero (canal magro, canal cheio, aba Retenção)

1. **Números.** `mundo('cheio')`, `mundo('magro')`, `mundo('sem-dado')` e `mundo('novo')` serializados e comparados com os do HEAD: idênticos, exceto `trocas` (campo novo) e os cliques por dia da série de impressões do vídeo em destaque, cuja soma é a mesma (3.035,534 nos dois). Hanói: 4,43 mil views, 233 por dia, 3,04 mil cliques, taxa 5,0% (4,8% a 5,2%), engajamento 1,3x, 208 curtidas, 21 comentários: como no HEAD (conferido na captura do vídeo e pelo texto do canal abaixo).
2. **Texto.** Texto visível das 3 telas x 1440/390 x escuro/claro contra o HEAD: **nenhuma linha diferente**, com a marca de cliques escondida nos dois lados. Com a marca visível, as únicas diferenças de texto são as pedidas: o rótulo "cliques estimados por dia", a legenda "cliques estimados do dia (a altura do ponto não mede nada)" (no HEAD: "cliques estimados") e os números sob os pontos (no canal cheio 1440, 14 números que o HEAD não mostrava); no ⓘ do gráfico de impressões, "Bolinha e número embaixo" virou "Faixa sob as datas..." (essa troca já vinha da rodada 4).
3. **Pixels.** Playwright, `file://`, fontes do Google bloqueadas, as 12 combinações. Em cada tela, cada bloco folha da página (título, números, listas, curva, painel, legenda, passo a passo, tabela, taxa) e o topo do SVG do gráfico de impressões (barras, caixas vazadas, hachura, eixo, rótulos), com ponto, número e faixa de cliques escondidos nos dois lados. 312 blocos visíveis: **274 idênticos byte a byte; 34 iguais com tolerância de 16/255** (ruído de subpixel e fundo de coluna esticada pela grade, sem diferença de conteúdo); **4 com diferença** (canal cheio 390, Retenção 390, escuro e claro): 6 pixels, até 33/255, no ícone do ⓘ de "Taxa de clique", que desce uma fração de pixel por causa da altura nova do gráfico acima (conferido ampliado: é o mesmo glifo com outro antialias). A faixa de cliques em si muda de propósito.
4. A aba Retenção e a taxa de clique do canal fazem parte dos 312 blocos.

## Onde discordei do revisor

- **A2, em parte:** encurtei a legenda a uma linha, mas mantive "a altura do ponto não mede nada". É a resposta literal à dúvida do dono, e agora cabe numa linha.
- **Pré-existente (última data cortada):** consertado só no vídeo (`bordaFinal`). No canal (aprovado) o defeito segue igual ao HEAD, também a 1440 ("10/10" encosta na borda do SVG), porque consertar muda pixel. É uma linha em `canal.js` (`bordaFinal: true`) se o controlador quiser.
- **S1:** aceito, mas a pastilha é a de "não registrado", não a de "não medido" literal, porque o fato é outro (o sistema não registra, em vez de a coleta não ter rodado).

## Conferido

- Navegador Chromium (Playwright) em 1440 e 390, claro e escuro; casos `cheio`, `magro`, `novo`, `sem-dado`, `cheio&trocas=recente|nenhuma|sem-registro`, `magro&trocas=nenhuma|sem-registro`, canal x3.
- Sem rolagem horizontal (scrollWidth = largura) e sem erro de página em todas as combinações; nenhum texto menor que 12 px na tela; nenhum texto de SVG cortado no vídeo (no canal, só a última data, pré-existente). 
- Teclado: 27/09 "Título trocado neste dia (troca 1)", 02/10 "Thumbnail trocada...", 09/10 "Título trocado... (troca 3)"; tabela com coluna "Troca" ("◆ título (1)", "▲ thumbnail (2)", "◆ título (3)").
- Contraste calculado na página (escuro / claro): losango contra o cartão 8,89 / 5,78; triângulo 7,26 / 6,49; número no losango 10,11 / 6,17; no triângulo 8,26 / 6,93; rótulo da faixa 6,92 / 6,43; pastilha "não medido" 7,76 / 7,40. Losango contra triângulo entre si: 1,22 / 1,12 (só a forma e o número separam; basta).
- Alvos a 390 px: link da legenda 264 x 44; botões 44 x 44; "Ver como tabela" 98 x 44. Em 1440 com mouse o link tem 28 px de altura.

## Não conferi

- Opera, Safari, Firefox (só Chromium; `clip-path` dos marcadores e `:has()` só no Chromium; o `:has()` é só do script de prova, não da tela).
- Leitor de tela (a leitura por teclado foi lida do texto do `role="status"`).
- Movimento reduzido (nenhuma animação nova).
- Escala de cinza refeita: não; a forma (losango, triângulo) e o número separam as trocas, e a pastilha de "não medido" tem hachura além da cor.
- Não passei pelo `revisor-ux-senior` nesta rodada; o plano e este relatório são a entrada dele.
- Tudo é exemplo: o registro de trocas de vídeo próprio não existe; "troca de ontem" é simulada.
