# Plano 7: video.html depois da REVISAO-UX-4 (12/10)

Quem desenha: eu (skill frontend-design). Escrito ANTES de mexer. Entrada: `REVISAO-UX-4.md` (A1 a A8, S1 a S5, pré-existente) e as restrições do controlador (A1 inegociável; "sem registro" diferente de "nenhuma troca"; limiar e janela como decisão do dono, visíveis).

## A1. Exemplo mudou números já aprovados. Aceito, sem ressalva
O erro foi multiplicar a taxa do vídeo em destaque por 1,4 (vaza para views, cliques, curtidas). Desenho: o exemplo de trocas ganha dados próprios **que não mudam nenhum total**. Depois de todas as séries derivadas serem calculadas (nada muda a ordem do gerador de números), redistribuo os cliques por dia do vídeo em destaque em três trechos (taxa 4,9% nos dias antes da troca 1, 4,5% entre as trocas, 5,8% depois da troca 2) e o resto absorve a diferença, de modo que a soma de cliques e de impressões do vídeo é exatamente a de antes (3.036 de 61.023, 5,0% de 4,8% a 5,2%). Views, curtidas, comentários e toda a lista do canal ficam idênticos. Prova: comparo o objeto inteiro `mundo('cheio')` e `mundo('magro')` com o do HEAD (só mudam `trocas` e os cliques por dia do vídeo em destaque) e comparo texto e pixels de canal magro, canal cheio e aba Retenção contra o HEAD.

## A2. Faixa sem título. Aceito
Rótulo "cliques estimados por dia" escrito dentro da faixa, 12 px, numa linha própria acima dos pontos. A legenda encurta, mas **mantenho a oração "a altura do ponto não mede nada"**: é a resposta literal à dúvida do dono. Fica numa linha só ("cliques estimados do dia (a altura do ponto não mede nada)").

## A3. Número só em alguns dias. Aceito
Número desenhado de forma gulosa: cada dia desenha o número se ele não encosta no anterior já desenhado (4 px de folga). Todo dia com ponto que cabe tem número; em 390 px aparecem tantos quantos couberem, nunca zero se há dias com clique. O ponto sem número continua legível pela leitura do dia, pelos botões e pela tabela.

## A4. Troca recente: "depois" não medido vira zero. Aceito
Contagem de dias medidos de cada janela. Sem dia medido num dos lados, o lado vira "ainda sem dia medido (o YouTube entrega com 2 a 3 dias de atraso)", caixa hachurada na cor e forma de "não medido" (a mesma do resto da pasta, magenta), pastilha própria "? depois ainda não medido" e frase própria. Nunca "0 impressões". Para o dono ver o estado: novo parâmetro `?trocas=recente` (uma terceira troca em 09/10, título).

## A5 + fato do sistema. "Nenhuma troca" afirmava o que o sistema não sabe. Aceito, e vou além
Hoje não há registro de trocas de vídeo próprio. Dois estados diferentes, com forma e cor diferentes:
- **Sem registro (como é hoje):** pastilha hachurada "não registrado" (forma e cor de não medido) + "o sistema ainda não registra as trocas de título e de thumbnail dos vídeos do seu canal; por isso não dá para dizer se este teve alguma". É o estado do vídeo novo e do sem dado (que antes diziam "nenhuma"). Nos gráficos por dia, a legenda ganha o mesmo item hachurado, porque gráfico sem marca lido sozinho parece "nenhuma troca".
- **Nenhuma troca medida (registro ligado):** caixa vazada neutra, a mesma forma do "zero medido" ("nenhuma troca registrada desde a publicação"). Parâmetro `?trocas=nenhuma`.
Também `?trocas=sem-registro` nos casos cheio e magro. A faixa "exemplo" do bloco passa a dizer que hoje não existe registro e que o bloco mostra como ficaria.

## A6. Link da legenda com 18 px. Aceito
Alvo mínimo de 44 px em toque/estreito; no desktop com mouse, 28 px como os outros controles compactos da pasta.

## A7. Número do marcador com 11 px e contraste 4,73. Aceito
12 px nos dois marcadores (gráficos e bloco), marcadores um pouco maiores (26 px) para caber. Cores novas, ver S3, com número a 5,5:1 ou mais nos dois temas (conferido por script).

## A8. Limiar de 100 e janela de 7 dias não chegam ao dono como decisão. Aceito
Linha visível dentro do bloco (não no ⓘ), logo abaixo da faixa "exemplo", com a etiqueta "decisão sua": "mínimo de 100 impressões por lado; janela de até 7 dias antes e 7 depois". A nota da barra do mockup repete. Os dois valores continuam constantes únicas no código (`A.MIN_IMP`, `A.JANELA`).

## S1 a S5
- **S1** aceito: o sem dado usa a mesma pastilha "não registrado" (ver A5).
- **S2** aceito: "Taxa de clique depois da troca: título (1), sem diferença que se sustente; thumbnail (2), subiu." A pastilha "não dá para separar" vira "sem diferença firme".
- **S3** aceito: `--tr-t` e `--tr-m` passam a valores que não repetem `--lado-b` nem `--tier-high`; o cabeçalho do `a4.css` deixa de dizer "nenhuma cor nova".
- **S4** aceito: o dia da publicação sai da janela "antes" (como o dia da troca); dito no ⓘ.
- **S5** aceito: o contorno de 3 px nos valores só existe em gráfico com troca (classe `tem-trocas`); no canal o rótulo fica como no HEAD.

## Pré-existente: última data cortada a 390 px. Aceito só para o vídeo
O conserto mexe no eixo de datas, que o canal (já aprovado) também usa; para manter zero pixel de diferença no canal, ligo o conserto só quando a tela pede (`bordaFinal`), no vídeo. No canal o defeito continua igual ao HEAD; é uma linha para ligar depois, se o controlador quiser.

## Onde discordo
Só em A2, parcialmente: a legenda mantém a frase sobre a altura do ponto (curta). Todo o resto aceito.

## Não toco
`c2-trocas.*`, regras `c2-*` do fim de `a4.css` (minhas regras novas entram antes delas), `c1-*`, `comparar-*`. Nada commitado.
