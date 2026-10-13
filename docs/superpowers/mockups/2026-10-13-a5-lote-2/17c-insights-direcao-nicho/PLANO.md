# Plano do mockup 17c: Insights, "quem sobe e quem desce no nicho" (13/10/2026)

Feito antes do HTML, com a skill frontend-design. A linguagem visual não se inventa: é a do Observatório e do lote 1 aprovado (tokens de `a4.css`, casca de `A.moldura`, acréscimo com contorno tracejado verde-água e "+ novo"). A liberdade de desenho está só na forma do cartão.

## Para quem é e a pergunta de 3 segundos

O dono abre Insights com um nicho escolhido (Viagem). Pergunta: **"neste nicho, quem está subindo e quem está descendo, comparado com o que ele mesmo era?"** A resposta de relance vem em três camadas, nesta ordem:

1. **Uma frase**: "3 sobem, 2 descem e 1 fica estável no nicho Viagem."
2. **Uma barra de contagem** logo abaixo (▲ 3, ▼ 2, ＝ 1, ◌ 1 não medido), larguras proporcionais, quatro formas e cores estáveis.
3. **A régua**: uma linha por canal, todas na mesma escala (de −60% a +60%), o centro "estável" sombreado e atravessando todas. Barra para a direita e verde = sobe; para a esquerda e âmbar = desce. A posição é escrita (1º, 2º), nunca percentil. A ordem é "quem mais subiu primeiro"; a régua ordena, não julga.

## A forma memorável (onde gasto a ousadia)

A **régua desdobrada**: a régua aprovada em "Comparar canais" (faixa "estável" tracejada, linha do zero, traço por canal, rótulos descendo/estável/subindo) vira uma coluna contínua, com um canal por linha e o nome no lugar do traço anônimo. O olho lê a coluna de cima para baixo e vê o nicho se abrir em torno do centro. Todo o resto é calado: sem cartões dentro de cartão, sem gráfico de pizza, sem cor fora da tabela de tokens.

## Hierarquia

frase-resumo (15 px, números em destaque) > barra de contagem > seletor de leitura (3 botões) > régua (linhas) > linha "seu canal fica de fora". Método, escala, empate e viés: tudo em botões ⓘ; na tela fica só uma linha curta de viés por leitura (o spec manda dizer o viés na tela) e o aviso de 19/10.

## Três leituras sem virar três vereditos (M3)

Uma só leitura é **a principal** por vez e é a única que pinta a régua, ordena e conta na frase. Padrão: "Canal inteiro (28 dias)", a única que existe hoje. As outras duas são botões do mesmo seletor e, em cada linha, o botão "As 3 leituras" mostra as três lado a lado: a principal com símbolo cheio, as de apoio com símbolo só de contorno. Se divergem, a linha mostra as duas sem frase de veredito. "Mesma idade" só existe em 01/04/2027: aparece desde já, toda "não medido", com a data.

## Cor e símbolo (nenhum matiz novo)

| Significado | Símbolo | Cor |
|---|---|---|
| subindo (≥ +10%) | ▲ | `--dir-up` verde |
| descendo (≤ −10%) | ▼ | `--dir-dn` âmbar (ocre no claro) |
| estável (−10% a +10%) | ＝ | `--dir-eq` neutro (ou âmbar, se o dono responder que "parado" é isto: botão no mockup) |
| não medido | ◌ + hachura | `--nm` rosa com hachura |
| zero medido | caixa vazada com 0 | `--im-zero`, borda de 2 px |
| fora do nicho / seu canal | contorno pontilhado | `--border-strong` |
| erro | ícone de aviso na borda | `--danger`, texto em `--text` |

## Estados

tipico (7 canais: 3 sobem, 2 descem, 1 estável, 1 não medido), leituras (a mesma tela com uma linha aberta), videos (leitura "vídeos novos"), justa (leitura que só fecha em 2027), extremo (fora da escala, empate, +10% que vem de 9,7%, nome comprido, dia sem registro), zero (zero medido ≠ não medido, 0 contra 0, 0 contra N, N contra 0), nao-medido (todos), magro (nicho com 2), um-canal, sem-dado, sem-dado-leitura (usuário só de leitura), erro. Cada um a 1440 escuro e 390 claro.

## Revisão do plano contra o brief (o que mudei)

- Primeiro rascunho: a régua do Comparar com todos os canais como traços numa linha só. Reprovei: com 7 nomes os rótulos se sobrepõem a 390 px e o traço anônimo não responde "quem". Troquei pela régua desdobrada, linha por canal.
- Primeiro rascunho do seletor: três cartões com número de cada leitura. Reprovei: viravam três vereditos. Ficou um seletor e o resto só na linha aberta.
- Cortei o gráfico de rosca: a barra de contagem diz o mesmo em menos espaço.
- Sem número de percentil, sem "nota", sem "melhor/pior".
