# Plano do mockup 13: Histórico do vídeo de concorrente (feito antes do desenho)

Feito com a skill frontend-design (13/10/2026). Linguagem visual: **a do produto e do lote 1 aprovado** (tokens, Inter, JetBrains Mono, Fraunces, casca, "+ novo"). O pedido de "ponto de vista próprio" da skill se gasta em UMA coisa: a forma das primeiras 72 horas e a faixa da subida; o resto fica quieto e igual ao que o dono já aprovou.

## Para quem e a pergunta de 3 segundos

Quem: o dono, olhando um vídeo de concorrente que subiu (ou não). Pergunta: **"Esse vídeo foi bem para a idade dele, e algo que o canal mexeu veio antes de ele subir?"**

Resposta de relance, nesta ordem:
1. **Frase-resumo** no topo ("Com 7 dias tinha 49 mil views, 3,3 vezes o normal do canal. Subiu em 15/10.") + faixa de 5 números.
2. **Curva por idade**: duas linhas, o vídeo (azul, círculo) contra o normal do canal (areia, quadrado tracejado), com o n de cada ponto; ao lado, três pares de barras (1, 7 e 30 dias) para ler a razão sem decifrar a curva.
3. **Primeiras 72 horas**: barras hora a hora, marca da publicação em São Paulo, régua de 0 a 72 h com os pontos "25%, metade e 75% das views".
4. **Dia a dia e mudanças**: barras por dia, três raias (título, miniatura, outras), faixa verde da subida e, abaixo, a frase da subida com a lista das mudanças dos 14 dias antes ("lista, não afirma causa").

## Decisões de cor e de símbolo (estáveis, nenhum matiz novo)

| O quê | Cor | Símbolo/forma |
|---|---|---|
| O vídeo (concorrente) | `--lado-b` azul (laranja é do dono) | linha cheia, círculo; barras cheias |
| O normal do canal (M2) | `--lado-n` areia | linha tracejada, quadrado |
| Subida (direção) | `--dir-up` verde | ▲ + faixa de 7 dias |
| Parado/descendo | `--dir-dn` âmbar | ▼ (só quando há direção; a curva contra o normal NÃO usa verde/âmbar: não é direção, é comparação) |
| Zero medido | `--im-zero` | caixa vazada com o 0 dentro |
| Não medido | rosa `--nm` | hachura de 135 graus (pastilha, barra, trecho do eixo), sempre com o motivo |
| Ainda não existe | contorno pontilhado | |
| Mudança de campo | `--tr` (sem matiz) | losango = título, triângulo = miniatura, círculo = outras; o número é a ordem |
| Saiu do YouTube | texto + borda 1,5 px neutra, ícone "olho cortado" | "mantido para análise" troca para borda verde-água e alfinete |
| Inconclusivo (série semanal) | neutro `--muted` | meio círculo, contorno cheio (não pontilhado, não rosa: o dado chegou, só não decide) |

## Quantas raias (decisão)

**Três**: Título, Miniatura, Outras. "Outras" junta descrição, tags, categoria, duração e capítulos (cinco raias a mais virariam um painel de controle). Sem raia de playlist (E3 retirada). Dois marcadores a menos de 24 px de distância na mesma raia viram um só, com o contador, e a lista abaixo do gráfico diz tudo.

## Estados

Com dado (típico), com dado extremo (vídeo viral, 11 mudanças em 14 dias), magro (publicado antes de 03/10), vídeo novo (3 dias; o caso real de hoje), zero medido, não medido com motivo, série semanal, saiu do YouTube (e mantido para análise), ao vivo ou estreia, sem dado, carregando, erro, só leitura. Cada um a 1440 escuro e a 390 claro.

## Encaixe

Mesma casca do lote 1 (`L.obs`, aba Mudanças ativa; `A.moldura`). O cabeçalho do vídeo já existe na produção (aparece normal); o que é acréscimo leva contorno tracejado e "+ novo". Reserva do mockup 20 (comentários de destaque) no fim, tracejada, sem desenho.

## Autocrítica do plano (o que revisei)

- Primeira ideia: um gráfico único com tudo (curva por idade, 72 h, dia a dia). Descartada: três escalas de eixo no mesmo desenho viram ruído; são três blocos, cada um com a sua pergunta.
- Primeira ideia: colorir "acima do normal" de verde. Descartada: verde é só direção (subindo); comparação usa as cores de lado.
- Primeira ideia: sete raias de campo. Descartada: três.
