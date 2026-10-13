# Plano do mockup 17a: Comparar canais com as medidas novas (13/10/2026)

Feito antes do HTML, com a skill `frontend-design`, dentro da linguagem já aprovada (mockup 9, cartão "Só o seu canal mede", lote 1). Esta tela não ganha identidade nova: a "forma memorável" dela é uma só, e o resto fica quieto.

## Para quem é e a pergunta de 3 segundos

O dono, de manhã, olhando dois canais de nichos às vezes diferentes. Pergunta: **"cada um está subindo ou descendo, e o que eu não posso afirmar ainda?"** (não "quem é maior").
Resposta de relance: a frase do topo ("Paddy Doyle sobe 28%; Nômade Raiz está parado") e, na primeira linha da tabela, um quadrado cheio verde ▲ ou âmbar ▼ por lado.

## Forma memorável: uma direção de verdade, duas de apoio

O risco do pedido é virar três setas, três vereditos. Solução:

- **M3(a), canal inteiro em 28 dias, é a principal hoje.** Única com símbolo em quadrado **cheio**, percentual em destaque e régua do nicho. Quando a leitura justa (c) existir, ela troca de lugar com (a) (estado "2027"): a que está na linha principal é sempre a que o dono deve acreditar.
- **(b) vídeos novos, views de hoje, e (c) vídeos novos na mesma idade são linhas de apoio**: símbolo só em **contorno**, texto menor, sem régua, sob o título "Para conferir (não são vereditos)". Mesma cor e mesmo símbolo da direção, peso visual menor. (c) hoje não "falta medir": **ainda não existe**, então leva contorno pontilhado e a data, não a hachura.
- A frase do topo diz se as três **concordam ou divergem**, em uma linha calculada ("as outras duas leituras concordam" / "divergem: o canal inteiro sobe, mas os vídeos novos descem; pode ser só idade").

## Hierarquia da página (de cima para baixo)

1. Migalha, título, os dois lados. **Cada lado ganha a pastilha de estado do canal (M8)**: ativo, parado, em queda, fora do ar; forma própria, texto sempre.
2. **Frase-resumo** (Leitura rápida, já aprovada): uma linha por lado com o símbolo, mais uma sobre o tamanho. Sem parágrafo.
3. **Número a número**, na ordem: Direção (3 leituras + longos publicados) · Desempenho · Tamanho · Primeiros dias (agora com **primeiras 24 horas**, 7 e 30 dias) · **Acerto** (M4 em casas) · **Reação do público** (M7 aos 30 dias).
4. **"Só o seu canal mede" no fim, depois de "Número a número"** (decisão do dono, 12/10). Só aparece quando um lado é o seu canal; sem canal próprio, uma linha quieta diz por que não há o cartão.

## Estados e como cada um se mostra

| Estado | O que prova |
|---|---|
| Com dado (dois concorrentes) | caso cheio, sem canal próprio (sem cartão no fim), "praticamente igual" com o limiar no ⓘ |
| Seu canal × concorrente | cartão "Só o seu canal mede" no fim |
| Dado extremo | régua fora da escala (seta na ponta), 12 de 12, canal 1.000 vezes menor |
| Zero medido | caixa vazada com 0 para contagem (longos publicados, acerto "0 de 12"); mediana de "nenhum vídeo" continua **não medido**, nunca 0 |
| Um lado não medido | motivo por linha, nunca uma seta; (c) "ainda não existe" em pontilhado |
| Par magro | o caso real por meses: quase tudo com motivo e data |
| Fora do ar | M8 em família do erro; números "até dd/mm"; direção não medida (dia sem registro na borda) |
| Nichos diferentes | duas réguas curtas, cada uma no seu nicho, e "a régua ordena, não julga" |
| 2027 | (c) vira a principal; (a) vai para o apoio |
| Erro | um lado não carregou: pastilha de erro (não é hachura), botão "Tentar de novo" |
| Vazio | só um lado escolhido: esqueleto pontilhado do que virá |
| Só leitura | cartão privado trocado por "você não vê estes números" (cadeado), sem ficar mudo |

## Cor e símbolo (nada novo)

Verde ▲ sobe; âmbar ▼ desce e **parado (M8)**; neutro ＝ estável (a NC do spec sobre "parado" ser ＝ ou M8 continua aberta: mostro os dois, como o lote 1); hachura rosa = não medido; caixa vazada azul-acinzentada com 0 = zero medido; contorno pontilhado = ainda não existe; família do erro = erro e fora do ar; cadeado em contorno neutro = sem permissão. Os lados A (areia) e B (azul) não carregam significado de direção. Acerto (M4) usa a cor do lado, não verde: não é direção.

## O que foi descartado

- Três setas do mesmo tamanho: viram três vereditos.
- Barra comparando M4 entre canais: a medida é contra a mediana de cada canal, "mede regularidade, não tamanho"; por isso casas por vídeo, sem coluna de "quem ganha".
- Calcular "×" entre M7 de leituras diferentes (dia 30 contra total de hoje): a coluna Diferença diz "leituras diferentes".
- Mostrar o percentual de M4 com menos de 10 vídeos.

## Revisão contra o pedido

Conferi o plano com as regras do dono: frase-resumo (sim), régua/barra (régua do nicho, barras pareadas dos primeiros dias, casas do acerto), cor estável (tabela acima), símbolo junto da cor (todo), método no ⓘ (3 novos ⓘ: direção em três leituras, acerto, reação; ±10% no ⓘ da Diferença), zero × não medido (casas e caixas distintas), sem bloco monocromático (as linhas de apoio têm forma diferente, não só tom). Mudei uma coisa na revisão: a linha de apoio (b) ia levar régua; saiu, porque duas réguas de direção na mesma tela competem com a principal.
