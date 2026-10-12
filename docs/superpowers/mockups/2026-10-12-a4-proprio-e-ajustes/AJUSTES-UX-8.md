# Ajuste 8: video.html depois da REVISAO-UX-7 (12/10)

Plano escrito antes de mexer: `PLANO-UX-8.md`. Tocados: `a4-comum.js`, `a4.css` (regras novas antes do bloco c2, que não foi tocado), `video.js`, `canal.js` (só uma chave sem efeito, ver abaixo). `a4-dados.js`, `c1-*`, `c2-*`, `comparar-*` intocados. Nada commitado. Capturas em `ajuste-8-shots/` (`imp-*` e `trocas-*`: 9 estados x 2 larguras x 2 temas; `full-*`: página inteira; `cinza-*`: escala de cinza; `info-grafico-impressoes.png`). Cópia da pasta de antes: `/private/tmp/claude-501/-Users-figueiredo-Workspace-bythiagofigueiredo/cd207572-1063-4f62-baf3-2774ffa65290/scratchpad/video-antes-r8/`.

## O que mudou, por achado

- **N1 (exemplo no gráfico, todos os casos).** Quando há marca de troca (que é sempre de exemplo), o gráfico por dia ganha dentro do próprio SVG, acima dos marcadores, a linha "marcas de exemplo: trocas inventadas" (12 px, cor `--muted`); a legenda diz "troca de título (exemplo)" e "troca de thumbnail (exemplo)"; a leitura por teclado diz "Título trocado neste dia (troca 1, exemplo)"; a tabela, "◆ título (1, exemplo)"; o ⓘ diz "As marcas são de exemplo: hoje o sistema não registra trocas". Vale no magro (o caso real) e no cheio. O topo do gráfico cresce 16 px só nesse caso.
- **N2 (não registrado x nenhuma registrada, por forma).** Não usei a hachura (regra desta rodada). *não registrado*: pastilha de contorno **pontilhado** neutro com dois marcadores fantasma (losango e triângulo só em contorno pontilhado) e o texto. *nenhuma registrada* virou "[0] trocas registradas", caixa de borda **contínua** com o dígito 0 (a forma do "zero medido"). Em escala de cinza (`cinza-bloco-*`, `cinza-legenda-*`) lê-se: pontilhado e fantasma contra contínuo e número; nenhum dos dois tem hachura nem magenta.
- **N3 (cores dos marcadores).** Procurei por script (CIE76, as cores literais de `a4.css`, do bloco `c2` e de `video.js`, nos dois temas) um matiz livre e não há: verde = "▲ taxa subiu" (o marcador de thumbnail é um triângulo), âmbar = "▼ taxa caiu", rosa = não medido, azul e violeta já usados. Os únicos matizes com distância folgada (lima, olivas) caem em verde ou âmbar. Como a cor do marcador não carrega informação (o losango e o triângulo dizem o tipo; o número, a ordem), os dois passam a usar o tom de texto do tema, sem matiz (`--tr`: #F5EFE6 escuro, #231C14 claro; saíram `--tr-t` e `--tr-m`).
  Medida (CIE76; o par de antes entre parênteses):

  | | Escuro | Claro |
  |---|---|---|
  | Contraste do marcador contra o cartão | 14,48 | 15,76 |
  | Contraste do número contra o marcador (12 px) | 15,61 | 15,76 |
  | Mais perto entre as cores COM matiz (croma >= 25) | nm 40,9 | `--lado-n` 34,4 |
  | Antes: thumbnail contra `--tier-high` | 9,3 | 14,6 |
  | Antes: título contra `--tier-mid` / `--lado-b` | 13,9 / 11,4 | 2,7 / 10,4 |

  Honesto: o tom de texto é o mesmo token dos pontos de cliques da faixa (`--im-cl`, distância 0) e está a 18,0 (escuro) do creme de `--lado-n`, que é neutro por desenho. Nada disso está na mesma marca: forma (losango e triângulo contra círculo com anel), lugar (topo contra faixa) e legenda diferentes.
- **N4 (swatches repetidos).** O item de legenda de "não registrado" deixou de usar a hachura de "não medido": tem swatch próprio (os dois marcadores fantasma pontilhados, o mesmo desenho do bloco). No estado "nenhuma registrada" não há item de legenda.
- **N5 (números da faixa).** `folgaNum` (padrão 3, igual ao canal) e `escalonar`, ligados só no vídeo. A folga menor não bastava (o 2º ponto do magro é "<1": 2 caracteres, não cabe ao lado do "1" sem encostar). O vídeo ganha uma 2ª linha de números (14 px a mais na faixa só quando precisa) com um fio de 1 px ligando o número ao ponto. Resultado a 390: cheio 18 pontos e 18 números (antes 9); magro 2 e 2 (antes 1); sem sobreposição medida. O canal fica como estava.
- **N6 (legenda).** Volta a "cliques estimados do dia"; a frase "a altura do ponto não mede nada" fica no ⓘ (já estava). Muda no canal.
- **N7.** "desde a publicação, em 10/12/2024" (ano quando o vídeo tem mais de 365 dias).
- **N8.** Números da faixa por `A.n()`, com ponto de milhar (a largura reservada acompanha). Muda no canal.
- **N9.** "título (1), sem diferença que se sustente; thumbnail (2), subiu; título (3), o depois ainda não foi medido."
- **N10.** Linha "exemplo | Trocas deste vídeo: título (1) em 27/09, sem diferença firme; thumbnail (2) em 02/10, taxa subiu. Ver antes e depois" acima do primeiro gráfico, só quando há troca de exemplo (cheio, magro e troca recente). Link de 44 px em toque (28 px com mouse), usa a mesma leitura do bloco.
- **A2.** Cedo (ver "Onde discordei").
- **`bordaFinal`.** Não ligado no canal (decisão do dono). Pronto com uma chave: abrir `canal.html?...&borda=sim` mostra o conserto só naquela abertura (390 px: a última data "10/10" sai de +7,6 px fora do SVG para -1,0, dentro); para ligar de vez, trocar `bordaFinal: false` por `true` nas duas chamadas de `A.serieDia` em `canal.js` (as chaves estão escritas lá). Padrão inalterado.

## Prova: os blocos em aprovação não mudaram um pixel

Método: Playwright/Chromium, `file://`, fontes externas bloqueadas, claro e escuro, 1440 e 390. Captura por bloco, `fullPage` com recorte, ANTES (cópia congelada) contra DEPOIS, cada par pixel a pixel. Para o canal, a marca de cliques (faixa, pontos, números, rótulo) é escondida nos dois lados, e fica fora da comparação a legenda (N6 muda). Há um ruído conhecido: quando um bloco muda de posição vertical (a tela do vídeo ganha a linha do N10 e o gráfico 16 px; o canal 390 perde uma linha de legenda), o Chromium repinta o mesmo bloco com 5 a 30 pixels de antialias (até 34/255), sem mudar o conteúdo. Provei que é ruído: o mesmo "antes" com um espaçador de 72 px dá exatamente a mesma diferença (29 px, máx. 10) que "antes x depois", e repetir o "antes" dá 0. Por isso a comparação final **iguala a posição** (espaçador do mesmo tamanho do deslocamento) e aí tudo fecha.

| Tela | Blocos comparados | Idênticos com a posição igualada |
|---|---|---|
| `video.html` cheio, "Taxa de clique deste vídeo" e "Retenção" (1440 e 390, 2 temas) | 2 x 4 | **2 de 2 em cada uma das 4 combinações** |
| `video.html?caso=magro`, "Taxa de clique deste vídeo" e "Retenção" (não medido) | 2 x 4 | **2 de 2 nas 4 combinações** |
| `canal.html?caso=magro` | 38 x 4 | **38 de 38 nas 4** |
| `canal.html?caso=cheio` | 38 x 4 | **38 de 38 nas 4** |
| `canal.html?caso=cheio&aba=retencao` | 41 x 4 | **41 de 41 nas 4** |

Sem a compensação, 4 a 5 blocos por combinação a 390 (e 1 a 2 no vídeo) diferem por 1 a 8 de 255 em 8 a 700 pixels: o ruído descrito (ícones ⓘ e fundos). A mesma comparação foi rodada no início e no fim da rodada (depois de editar `canal.js` e o ⓘ); idêntica.

## Exatamente o que mudou no canal (N6, N8)

1. **Legenda do gráfico "Impressões por dia do canal"**: "cliques estimados do dia (a altura do ponto não mede nada)" passa a "cliques estimados do dia". Em 1440 a legenda continua com o mesmo número de linhas (sem deslocar nada); em 390 ela perde 40 px de altura (120 para 80 px) e tudo abaixo sobe 40 px (magro, cheio e aba Retenção).
2. **Número da faixa com milhar (N8)**: canal cheio, 1440 (aba padrão e Retenção): "1139" vira "1.139" (1 número). Os outros 13 números a 1440, os 9 a 390 (cheio) e os do magro não mudam (a 390 o 1.139 não é exibido).
3. Nada mais: o SVG do gráfico (barras, caixas, hachura, eixo, datas, valores), a tabela e a leitura por dia, a taxa de clique e a aba Retenção estão como antes. A chave `bordaFinal: false` em `canal.js` não muda o padrão.

## Conferido

- Chromium em 1440 e 390 (toque), claro e escuro: cheio x {exemplo, recente, nenhuma, sem-registro}, magro x {exemplo, nenhuma, sem-registro}, novo, sem-dado (36 combinações): `scrollWidth` = largura, nenhum erro de página, nenhum texto abaixo de 12 px, nenhum texto de SVG cortado.
- Alvos de toque em 390 dentro da tela do vídeo (links, botões, `summary`, grupos focáveis): nenhum abaixo de 44 x 44 (a barra "Estados do mockup" não faz parte da tela).
- Números da faixa = pontos em todos os casos (18/18 e 2/2), em 1440 e 390.
- Teclado (cheio): 27/09 "Título trocado neste dia (troca 1, exemplo)", 02/10 "Thumbnail trocada neste dia (troca 2, exemplo)"; tabela com "◆ título (1, exemplo)", "▲ thumbnail (2, exemplo)"; ⓘ do gráfico de impressões abre com o texto novo.
- `?trocas=recente` no cheio: terceira marca, frase "título (3), o depois ainda não foi medido", pastilha "? depois ainda não medido" (hachura mantida, é "não medido" de verdade).
- Sem `color-mix()` novo (as 3 ocorrências do `a4.css` são comentários).

## Onde discordei do revisor

- **A2/N6: não discordo mais.** Cedi (argumento no PLANO-UX-8: com todos os pontos na mesma linha a altura não existe, e a frase só explica o que a marca não é; custa uma linha a 390 no canal que nunca a teve). Nenhuma divergência para o dono. Se ele quiser a frase na legenda, é uma string em `a4-comum.js`.
- **N2:** não usei a hachura forte que ele propôs (a regra desta rodada proíbe confundir com a de "não medido"); usei contorno pontilhado e marcadores fantasma.
- **N3:** em vez de "marcadores em `--text`" por falta de opção, medi e documentei por que não há matiz livre; o resultado coincide com a primeira sugestão dele.
- **N5:** a folga de 2 px que ele propôs não resolve o magro (o 2º número é "<1"); resolvido com 2ª linha e fio, só no vídeo.
- Decisões que seguem do dono: ligar `bordaFinal` no canal e as duas regras de exemplo (100 impressões; 7 dias).

## O que não conferi

- Leitor de tela (a leitura foi lida do texto do `role="status"`); Opera, Safari e Firefox (só Chromium).
- Fontes reais (Fraunces, Inter, JetBrains Mono): bloqueadas por determinismo; a largura dos números da faixa com a mono real pode mudar 1 px (usei 7,2 px por caractere, que é a largura da JetBrains Mono a 12 px, mas a recalcular se as fontes carregarem).
- Passagem pelo `revisor-ux-senior` nesta rodada: ainda não; o plano e este relatório são a entrada dele.
- Dado real: as trocas são de exemplo; o registro de trocas de vídeo próprio não existe.
- A leitura do fio da 2ª linha de números em claro a 390 é discreta (1 px, `--dim`); não testei com o dono.
