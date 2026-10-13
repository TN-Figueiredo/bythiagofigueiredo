# Revisão de UX, rodada 2: mockup 3b (vídeo próprio com faixa "em teste A/B" e faixa "antes do início do registro")

Revisor: `revisor-ux-senior`. Data: 13/10/2026. Material: `PLANO.md`, `NOTAS.md` (seção 5, resposta à r1), `REVISAO-UX-r1.md`, `index.html`, `3b.css`, `3b.js`, `3b-dados.js`, `a4-comum.js`, mais capturas e medidas próprias (Playwright/Chromium headless sobre `file://`, 10 estados x 1440 escuro, 1440 claro, 390 claro, 390 escuro e 360 claro, scripts no scratchpad da sessão; nada na porta 3099, nenhum spec do projeto). Navegador fechado ao fim. Nenhum arquivo do mockup foi alterado; só acrescentei capturas `shots/r2-*.png` e `shots/r2-medidas-revisor.json`.

## Veredito

**NÃO PODE ir ao dono: 2 bloqueios.** Os seis achados da r1 foram todos resolvidos (conferido abaixo), mas o conserto de C4 criou um defeito novo (número do gráfico riscado pelo marcador da publicação) e há um número de troca meio escondido a 390 px no estado `extremo`. Os dois são pequenos de consertar. O desenho dos dois elementos novos continua bom: lê de relance, o contraste passa nos dois temas, a forma separa os estados em escala de cinza, o método está no ⓘ, não há `color-mix()`.

A pergunta do usuário nesta tela: "esta capa ou este título que troquei funcionou, e o que esteve no ar?". Primeiro olhar (1440, sem rolar): a linha "Trocas deste vídeo: ..." diz se há leitura e o colchete "em teste A/B" e o pontilhado "antes do início do registro" dizem o que esteve no ar e quando. Passa nos 3 segundos.

| Resumo | Contagem |
|---|---|
| Estados "pronto para o dono" | 7 de 10 (`hoje`, `zero`, `so-teste`, `so-reconstruido`, `vazio`, `erro`, `leitura`) |
| Estados "volta para ajuste" | 3 de 10 (`semnumero` por B1, `extremo` por B2 e C2, `tipico` por C1) |
| Estados "reprovado" | 0 |
| Bloqueios | 2 |
| Corrige | 2 |
| Sugestões | 6 |

As três coisas que mais derrubam o conjunto:
1. Marcadores sobre números do gráfico: o ▾ da publicação risca o "10" (B1) e o marcador 4 cobre o 3 (B2).
2. A mesma situação ("sem dias para comparar") ainda tem quatro nomes na tela (C1).
3. A linha-resumo acima dos gráficos vira parágrafo de 8 linhas a 390 px quando há muitas trocas (C2).

## Conferência da rodada 1

| Item r1 | Resolvido? | Evidência desta rodada |
|---|---|---|
| B1 texto "cortada: ..." fora da caixa a 390 | Sim | Medi todo `<text>` contra o SVG (`getBoundingClientRect`) e todo texto de caixa contra a própria caixa nos 10 estados a 1440, 390 e 360: 0 texto fora do SVG, margem mínima de 10 px até a borda da caixa. Visto em `tipico` e `extremo` a 390 claro: "cortada: teste A/B antes" cabe com folga. |
| C1 linha de 07/10 riscando o rótulo A/B | Sim | `shots/r2-so-teste-390-claro-grafico-c1-resolvido.png` e `so-teste` 1440 escuro: a linha pontilhada para acima do colchete A/B e recomeça abaixo; "em teste A/B (em andamento)" e "teste A/B" limpos. |
| C2 prosa de método | Sim | `hoje`: "Ainda não dá para comparar. Primeiro dia depois da troca: 15/10. Leitura completa em 21/10." (2 linhas a 390). `semnumero`: "Sem antes para comparar. O vídeo foi publicado em 06/10, 2 dias antes da troca. O depois também ficou sem dias." (3 linhas). |
| C3 frase repetida em `vazio` e `so-teste` | Sim | `vazio`: frase-resumo mais pastilha "0 trocas" (caixa vazada). `so-teste`: frase-resumo, régua, pastilha "0 trocas" e linha do teste, cada um dizendo uma coisa. |
| C4 duas linhas pontilhadas parecidas | Sim, mas criou B1 | A publicação agora é traço longo com ▾ e o registro continua pontilhado: separam. Porém o ▾ colide com o número da barra mais alta (B1). |
| C5 "janela cortada" jargão | Parcial | Chip, contagem, legenda e frase dizem "sem dias para comparar". Restam "nenhum dia inteiro sobrou" e "cortada: ..." dentro da caixa (C1 abaixo). |
| S1 a S7 | Respondidas por escrito nas NOTAS; nenhuma contestada | S5 (carregando): aceito o argumento (o bloco carrega com a tela). |

## Bloqueios

### B1. O marcador ▾ da publicação risca o número da barra mais alta

- Tela e estado: `semnumero` (vídeo publicado em 06/10, a barra do dia da publicação é a mais alta do gráfico de impressões), gráfico "Impressões e cliques", 390 e 1440, os dois temas. Capturas: `shots/r2-semnumero-390-escuro-grafico-publicacao-sobre-10.png`; igual em `index-caso-semnumero-1440-escuro.png`.
- O que está errado: o "10" da barra de 06/10 fica com o triângulo ▾ e a linha da publicação por cima; lê-se "1̶0". O conserto de C4 diz que a linha "para acima do número da barra", mas isso só vale enquanto a barra deixa folga: com a barra no teto do gráfico, o marcador (de T-10 a T-3) cai em cima do número (T-5). É um defeito que a r1 não tinha.
- Evidência: o caso acontece sempre que o dia da publicação é o dia de maior valor, que é comum em vídeo novo (o primeiro dia costuma ser o pico).
- Conserto: em `a4-comum.js`, no trecho "3b r1/C4" (linha 188), desenhar o ▾ acima do número quando a barra passa de `PH - 20` px: `yMarcador = Math.min(T - 10, base - h - 5 - 16)` e a linha só entre o ▾ e o número, ou, se faltar altura, reservar 14 px a mais no topo do gráfico quando `cfg.pub` cair no dia máximo. Reconferir `semnumero` nos dois gráficos a 390 e a 1440 e um estado em que a publicação é o dia mais alto.

### B2. O marcador 4 cobre o marcador 3 no gráfico a 390 px

- Tela e estado: `extremo`, gráfico de views e de impressões, 390 px, os dois temas (a 1440 não se tocam). Captura: `shots/r2-extremo-390-claro-grafico-marcas-3-e-4.png`.
- O que está errado: as trocas 3 (título, 05/11) e 4 (thumbnail, 06/11) caem em dias vizinhos; com 9 px por dia, o triângulo do 4 cobre meio losango do 3 e o "3" aparece cortado ("J" com a ponta do 3). O 5 e o 6 também se encostam. O número é o elo entre o gráfico e a lista abaixo ("o número é a ordem em 'Trocas deste vídeo'"), e é o estado `extremo` que o dono vai usar para julgar a faixa A/B. A régua das versões já resolve isso (marcas próximas, menos de 27 px, sobem de linha), o gráfico não.
- Conserto: aplicar no gráfico a regra que a régua já tem: marcas a menos de 28 px do anterior sobem 28 px para uma segunda linha acima (a haste desce até a barra), reservando a altura só quando houver colisão. Reconferir `extremo` a 390 e a 360: os seis números legíveis por inteiro.

## Corrige (vai ao dono só depois de corrigido)

### C1. A mesma situação, "sem dias para comparar", ainda tem quatro nomes

- Estados: `tipico`, `extremo`, `semnumero`. Capturas: `index-caso-tipico-1440-escuro.png` (bloco "Troca de título"), `semnumero` 390 escuro (3ª coluna).
- O que está errado: para o mesmo estado a tela diz "sem dias para comparar" (chip e frase), "nenhum dia inteiro sobrou" (rótulo acima da caixa), "cortada: teste A/B antes" ou "cortada pela troca (2)" (dentro da caixa) e, no caso sem antes, "sem dia para comparar" no singular (`rotLado`, `3b.js` linha 97). A r1/C5 pedia o fato com um nome só; o chip mudou e o resto ficou.
- Conserto: rótulo acima da caixa: "Antes: sem dias para comparar"; dentro da caixa, a causa sem a palavra "cortada": "um teste A/B vem logo antes" / "a troca (2) vem logo depois" (cabe em 270 px, são 28 e 27 caracteres). Singular e plural iguais ("sem dias") em `rotLado` e `textoCorte`.

### C2. A linha "Trocas deste vídeo: ..." vira parágrafo de 8 linhas a 390 px

- Estado: `extremo` 390 (6 trocas e 2 testes), parte superior da tela, antes de qualquer gráfico. Captura: `shots/index-caso-extremo-390-claro.png` (primeira tela depois dos botões).
- O que está errado: seis itens encadeados com ponto e vírgula ("título (1) em 20/10, sem dias para comparar; thumbnail (2) em 30/10, taxa subiu; ..."), mais os testes, ocupam cerca de 150 px e empurram o gráfico para fora do primeiro olhar. A regra do dono é nada de parágrafo. O padrão da linha vem do mockup 3 aprovado, mas lá cabia em 2 linhas; a 3b a alongou com "sem dias para comparar" e os testes.
- Conserto: com mais de 3 itens, a linha vira contagem e chips ("6 trocas e 2 testes A/B desde 07/10: ▲ 1 subiu · sem dias para comparar 4 · origem não sabida 1") em até 3 linhas, e o detalhe fica no bloco; manter a lista por extenso só até 3 itens.

## Sugestões (não bloqueiam)

- **S1. 360 px (fora do par obrigatório):** o texto do SVG da régua e do gráfico escala para 11,4 px ("07/10 início do registro", "hoje, 17/11", números das marcas). Em 390 está em 12 px ou mais. Se 360 importa, aumentar o corpo do SVG nessa largura.
- **S2. A leitura repete a causa três vezes** no mesmo bloco (chip, caixa, frase "Sem dias para comparar. Antes desta troca o vídeo estava em teste A/B..."). Depois de C1, a frase de baixo basta para a causa.
- **S3. `vazio`: "0 trocas registradas desde 07/10/2026" e a pastilha "0 trocas"** dizem a mesma coisa; a pastilha é a forma de zero medido e vale ficar, mas pode perder a palavra "trocas" e ficar só "0".
- **S4. Régua das versões** continua uma peça que o dono não pediu (120 px, "+ novo"); a pergunta 0(b) das NOTAS é suficiente.
- **S5. No `leitura`**, o dado do teste (vencedor, datas) aparece para quem só lê; é a pergunta 0(c), já declarada.
- **S6. Marcadores de troca cruzando números de barra** (por exemplo o "9" de 10/10 em `semnumero`, atravessado pela haste da troca 2) existem desde o mockup 3 e leem-se; vale resolver junto com B2.

## Por estado e por largura

Largura de 1440 em tema escuro e 390 em tema claro (par obrigatório), com 1440 claro e 390 escuro por amostra. Pergunta e leitura de relance iguais em todos: ver acima.

| Estado | 1440 escuro | 390 claro | Observação |
|---|---|---|---|
| `tipico` | ok | ok | Volta por C1 (nomes da caixa) |
| `extremo` | ok | B2, C2 | Volta |
| `hoje` | ok | ok | Pronto: hachura rosa "depois ainda não medido" distinta; "só 8 impressões" tracejado |
| `zero` | ok | ok | Pronto: caixa vazada com 0, nunca hachura |
| `semnumero` | B1 | B1 | Volta (também C1) |
| `so-teste` | ok | ok | Pronto: C1 da r1 resolvido (linha para acima do colchete) |
| `so-reconstruido` | ok | ok | Pronto: moldura pontilhada, ⓘ junto do título, divisor "07/10/2026: o registro começa" |
| `vazio` | ok | ok | Pronto |
| `erro` | ok | ok | Pronto: pastilha com ícone e texto, diz até quando está certo e quando tenta de novo |
| `leitura` | ok | ok | Pronto: caixa com cadeado diz o que a pessoa não vê e por quê |

## Cobertura das cobranças do dono

| Cobrança | Resultado |
|---|---|
| Frase-resumo no topo | Passa (acima dos gráficos e no bloco). Falha de forma em `extremo` 390 (C2) |
| Régua ou barra | Passa (colchetes, régua das versões, faixa de taxa) |
| Cor estável por significado | Passa: nenhum matiz novo; colchete A/B em `--text` com alfa baixo; ausência em `--muted`; hachura rosa só para "não medido" |
| Símbolo junto da cor | Passa (duas setas no A/B, "?" na hachura, círculo pontilhado, barra de corte). Em escala de cinza (`semnumero` 1440 escuro) a hachura, o pontilhado, a linha de publicação e os marcadores continuam separados |
| "Zero medido" distinto de "não medido" | Passa (`zero`: caixa vazada com 0; `hoje`/`semnumero`: hachura com "?") |
| Método no ⓘ | Passa |
| Sem prosa nem bloco monocromático | Falha parcial: C2. O fundo do colchete A/B (1,28:1 escuro, 1,17:1 claro) é só acompanhamento da linha de 14,5:1 e 15,8:1 |
| Sem jargão | Passa quase: "cortada" resta dentro da caixa (C1); "ciclo" e "origem não sabida" foram mantidos de propósito |
| Estados desenhados | Todos: depois não medido, sem antes, em teste A/B, sem dias para comparar, poucas impressões, zero, origem não sabida, vazio, erro, só leitura |
| 390 px sem rolagem horizontal | Passa: 0 px nos 50 casos medidos |
| Alvo de 44 px | Passa: 0 alvos abaixo de 44 x 44 a 390 (fora a barra "Estados do mockup", que não é da tela) |
| Tema escuro e claro | Passa |
| Consistência com o lote 1 | Passa: mesmos tokens, casca e `A.serieDia` com só as mudanças declaradas |
| `color-mix()` | Ausente: `grep` só acha comentários "sem color-mix" |
| Acessibilidade básica | Passa: 68 paradas de Tab em `extremo` e 0 sem contorno visível; `role="group"` com rótulo que cita os testes A/B; `role="img"` com rótulo por extenso na régua e nas faixas; 0 botão ou link sem nome; seta direita fala o dia ("ter 13/10: 1.675 views") |

## Tabela de medidas

Contraste por cálculo WCAG com as cores lidas da página (`getComputedStyle`), cartão #221E1A (escuro) e #FBF7F0 (claro). Mínimo: 4,5:1 texto, 3:1 elemento gráfico.

| Elemento | Escuro | Claro |
|---|---|---|
| Traço do colchete A/B | 14,48:1 | 15,76:1 |
| Rótulo do colchete A/B | 14,48:1 | 15,76:1 |
| Fundo do colchete A/B contra o cartão (só acompanhamento) | 1,28:1 | 1,17:1 |
| Traço do colchete "antes do registro" e linha pontilhada de 07/10 (`--muted`) | 6,18:1 | 7,13:1 |
| Linha e marcador ▾ da publicação | 14,48:1 | 15,76:1 |
| Barra de dado (laranja) | 6,72:1 | 4,94:1 |
| Texto do chip "sem dias para comparar" | 6,18:1 | 7,13:1 |
| Demais chips (sem antes, origem não sabida, poucas impressões) | não remedidos nesta rodada; r1: 4,86:1 ou mais nos dois temas |

Medidas de tamanho (50 casos: 10 estados x 1440 escuro, 1440 claro, 390 claro, 390 escuro, 360 claro; `shots/r2-medidas-revisor.json`):

| Medida | Resultado |
|---|---|
| Rolagem horizontal | 0 px em todos |
| Erros de JavaScript | 0 |
| Texto de SVG fora do SVG | 0 a 1440, 390 e 360 |
| Texto dentro de caixa com margem menor que 10 px até a borda | 0 em todos |
| Texto abaixo de 12 px a 390 | 0 |
| Texto abaixo de 12 px a 360 (SVG escalado, 11,4 px) | 3 a 8 textos por estado (S1) |
| Alvos abaixo de 44 x 44 a 390, na tela | 0 |
| Altura da página 1440 / 390 | 2135 a 5062 px / 3226 a 7186 px |

## O que NÃO consegui verificar

- Leitor de tela (VoiceOver, NVDA): conferi atributos e o texto da leitura por seta, não a fala.
- Safari, Opera (navegador do dono) e Firefox: só Chromium. Os pontilhados dos colchetes (`stroke-dasharray` curto com ponta redonda) não foram vistos no Opera.
- Movimento reduzido: o desenho novo não tem animação nem transição (0 regras), então não há o que testar.
- Zoom de 200% e fonte do sistema maior.
- Mouse sobre o gráfico (dica do dia): usei só o teclado.
- Contraste dos chips "sem antes", "origem não sabida" e "poucas impressões": não remedi; o CSS desses chips não aparece nas correções da rodada.
- 360 px só medido, não revisado visualmente.

## Para a rodada 3

Corrigir B1 e B2 (obrigatório), C1 e C2, responder às sugestões por escrito, regenerar `semnumero` e `extremo` nas duas larguras e juntar uma captura em que o dia da publicação é o mais alto do gráfico, e uma com 6 marcas a 390 px sem nenhuma coberta. Se o desenhista discordar de B1 ou B2, responda com captura: mantenho ou retiro por escrito.
