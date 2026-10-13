# Plano do mockup 17b: Outliers ordenados pelas views na mesma idade (feito antes do desenho)

Feito com a skill `frontend-design`. A tela já existe e está aprovada (aba Outliers, 02/10); o que se desenha é **o ajuste**, e o resto aparece como está, para o dono ver o encaixe. A linguagem visual é a do lote 1 (tokens, hachura rosa do "não medido", caixa vazada do zero, "+ novo" tracejado verde-água): nenhum matiz novo.

## Para quem e a pergunta de 3 segundos

O dono, escolhendo o próximo vídeo. Ele abre Outliers e quer saber: **"se eu ordenar pelo que cada vídeo fez nos primeiros 7 ou 30 dias, quem aparece, e quantos entram na conta?"** A resposta de relance é uma faixa com uma casa por outlier: cheia (medido), vazada com 0 (zero medido) ou hachurada (não medido). Hoje ela mostra "3 de 11" nos 7 dias e "0 de 11" nos 30 dias. A tela nunca finge que a ordem é completa.

## A forma memorável (uma só)

**A faixa de cobertura**: uma casa por vídeo, na ordem exata da lista abaixo, uma faixa para 7 dias e outra para 30. Quem lê vê, sem texto, onde a ordenação deixa de valer. Todo o resto fica quieto: a tabela é a de hoje com duas colunas acrescentadas.

## Hierarquia (de cima para baixo)

1. Controles de hoje (idade, formato, ordenar). O seletor ganha duas opções e **cada opção diz quantos têm a medida** ("Views aos 7 dias: 3 de 11 medidos"), para não haver surpresa depois do clique. O padrão continua sendo o multiplicador.
2. Frase-resumo (um `<span>` só, números em negrito). Em ordem por 7 ou 30 dias, diz quantos entram e que os outros ficam no fim, na ordem do multiplicador.
3. Linha do selo: "ao vivo ou estreia: N ficaram fora das medianas" (símbolo próprio de transmissão, cor neutra areia + texto).
4. Faixa de cobertura (7 dias e 30 dias), legenda de formas, motivos dos não medidos com contagem e data, ⓘ com a conta e o viés. Na ordenação por uma idade, a linha dela leva a marca ▼ "ordenando por esta", e, havendo vídeos que ainda vão fechar, a régua do tempo "hoje até a data em que passam a ter a medida".
5. A tabela de hoje (grupos por fase no padrão, uma lista só na ordenação nova) com **duas colunas "+ novo"**: views aos 7 dias e aos 30 dias. O número tem uma barra linear contra o maior da lista; o multiplicador mantém a régua de hoje.
6. Vizinha: o lugar da leitura "Estourou e parou" (mockup 14), tracejado cinza e fora do escopo; só aparece no padrão.

## Cor e símbolo (decisões)

| Significado | Cor | Símbolo/forma |
|---|---|---|
| Medido (views na idade) | `--lado-n` (areia, neutro: não é direção, nem "seu canal") | barra cheia + número |
| Zero medido | `--im-zero`, 2 px | caixa vazada com 0 |
| Não medido | `--nm` | hachura rosa + palavra "não medido" + motivo curto |
| Ainda vai fechar (data) | hachura, igual ao não medido; a data muda só o motivo | marca ◆ na régua do tempo |
| Ao vivo ou estreia | `--lado-n` no ícone, texto em `--text` | ícone de transmissão |
| Multiplicador | tiers de hoje (`--tier-*`) | círculo, losango, estrela (forma por faixa) |
| Erro ao carregar | `--danger` só na borda e no ícone, texto em `--text` | triângulo de aviso |

Nenhuma cor de direção (verde, âmbar) é usada: ordenar não é subir nem descer.

## Estados

`padrao` (multiplicador, hoje), `v7` (7 dias hoje, magro), `nao-medido` (30 dias, 0 medidos), `futuro` (30 dias em dezembro, exemplo), `extremo`, `zero`, `erro`, `vazio`, `leitura`. 1440 escuro e 390 claro de todos.

## Revisão do plano contra o brief (o que mudei)

- Primeiro rascunho: uma coluna só "Na mesma idade" com os dois números empilhados. Descartei: o ordenado precisa de uma coluna própria para ter barra e ▼.
- Primeiro rascunho: grupos por fase também na ordenação nova. Descartei: ordenar por 7 dias mistura as fases; a produção já faz lista única para toda ordem diferente do multiplicador.
- Primeiro rascunho: colorir a barra em laranja (`--lado-o`, como o lote 1 colore "com impressões"). Descartei: laranja é "seu canal" e aqui são concorrentes; areia neutra não induz leitura.
- Sem 30 dias medidos a lista não some nem vira bloco rosa: continua na ordem do multiplicador, com a faixa, a régua do tempo e um botão para voltar ao padrão.
