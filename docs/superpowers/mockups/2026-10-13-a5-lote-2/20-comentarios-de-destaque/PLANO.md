# Plano do mockup 20: Comentários de destaque do vídeo de concorrente (feito antes do desenho)

Feito com a skill frontend-design (13/10/2026). Linguagem visual: a do produto e do lote 1 aprovado (tokens, Inter, JetBrains Mono, Fraunces, casca, "+ novo"). O ponto de vista próprio se gasta em UMA coisa: **a fileira de 12 casas**, uma casa por comentário guardado, cada uma na cor e no símbolo do motivo por que está ali. O resto fica quieto.

## Para quem e a pergunta de 3 segundos

Quem: o dono, olhando um vídeo de concorrente que subiu. Pergunta: **"O que o público destacou neste vídeo, e o criador respondeu quem?"**

Resposta de relance, nesta ordem:
1. **Frase-resumo** num `<span>` só: "Com 7 dias, guardamos 12 dos 100 primeiros comentários que o YouTube mostra: 8 mais curtidos e 4 com o criador."
2. **A amostra** numa barra fina (12 de 100) e **a fileira de 12 casas** (cor + símbolo por motivo; cada casa leva ao comentário). Legenda com contagem; motivo com zero aparece como caixa vazada com 0 ("nenhum canal grande entre os 20 mais curtidos"), nunca some.
3. **As três idades** como abas de estado (1, 7 e 30 dias): cada aba mostra a forma do seu estado (guardados, zero, desligados, não coletado, fecha em dd/mm). Dentro de cada comentário, as curtidas nas três idades em três casas com barra.
4. **Os comentários**: cinco de cada vez ("Mostrar os outros 7"), cada um com o motivo, o autor (um dos quatro estados), o texto de terceiros como veio, a resposta do criador presa a ele.

## Decisões de cor e de símbolo (estáveis, nenhum matiz novo)

| O quê | Cor | Símbolo/forma |
|---|---|---|
| Mais curtido | `--lado-n` areia | polegar; casa com contorno cheio |
| Com o criador | `--lado-b` azul (o concorrente, como no 13) | microfone |
| Canal que você acompanha | `--tier-high` violeta | olho |
| Canal grande | `--tier-top` coral | alvo (círculo grande com ponto) |
| Você comentou (canal do dono) | `--accent` (chip "seu canal" que já existe) | pessoa |
| Zero medido | `--im-zero` | caixa vazada com o 0 dentro |
| Não medido | rosa `--nm`, hachura | "do canal": balão cortado; "nosso": relógio com aviso; "antes da coleta": calendário; "não sei se o criador respondeu": interrogação |
| Ainda não existe (fecha em dd/mm) | `--muted`, contorno pontilhado | calendário |
| Reservado (só leitura) | neutro, fundo rebaixado | cadeado |
| Erro de leitura da tela | família `--danger` na borda e no ícone, texto em `--text` | aviso |

Por que reaproveitar `--tier-*`: o lote 2 não cria matiz. Esses três só significam "faixa de desempenho" em telas de vídeo próprio; aqui nunca aparecem junto de faixa, e a forma + o rótulo dizem o resto. Fica como dúvida ao dono (NOTAS.md).

## Estados

Com dado típico (o comum: nenhum canal grande), com dado extremo (os quatro motivos, texto longo, ofensivo, endereço, outro idioma, RTL, emoji, "saiu do YouTube", "o criador respondeu: não se sabe", foto que não carrega), lote completo (todos os comentários do vídeo), a aba de 1 dia, zero medido, desligados pelo canal, não coletado (dois motivos), antes da coleta, fecha em dd/mm (vídeo novo), carregando, erro de leitura, só leitura sem texto, só leitura com texto mas sem nome. Página do canal: M11 com dado, M11 "fecha em dd/mm" (o caso real de hoje), M11 não medido por poucos vídeos. Cada um a 1440 escuro e a 390 claro.

## Encaixe

Mesma casca do lote 1 (`L.obs`, `A.moldura`). A seção é um acréscimo da página do vídeo (mockup 13, desenhado em outra pasta): o cabeçalho e o histórico do 13 aparecem só como moldura cinza, e a seção nova leva contorno tracejado verde-água e "+ novo". A fila "Saíram do YouTube" (mockup E, aprovado) é o destino do atalho da pastilha. Na página do canal (mockup 15), M11 é uma célula nova no cabeçalho e "O que o criador respondeu" é uma lista nova.

## Autocrítica do plano (o que revisei)

- Primeira ideia: um cartão por comentário com quatro selos coloridos no canto. Descartada: o selo repete o que a casa já diz; ficou um selo só, que é o motivo, e o autor leva a cor só quando é de destaque.
- Primeira ideia: abas 1, 7 e 30 dias que trocam a lista inteira E um quadro de curtidas à parte. Ficou as duas coisas em um lugar só: a aba escolhe a lista; cada comentário mostra as três idades (quem entrou depois mostra "fora dos 12 do dia 1", não zero).
- Primeira ideia: "o criador não respondeu" como texto. Descartada: o sistema só vê parte das respostas; a tela diz "não vimos resposta" (caixa vazada) e "não sabemos" (hachura), nunca "não respondeu".
- Primeira ideia: mostrar a base do canal grande como número ("14,8 milhões"). Descartada: a regra grava só faixa; duas escadas de 3 degraus (tamanho e vezes este canal) com a faixa por extenso.
