# Revisão de UX, rodada 3: mockup 3b (vídeo próprio com faixa "em teste A/B" e faixa "antes do início do registro")

Revisor: `revisor-ux-senior`. Data: 13/10/2026. Material: `REVISAO-UX-r2.md`, `NOTAS.md` (seção 6), `PLANO.md`, `index.html`, `3b.css`, `3b.js`, `3b-dados.js`, `a4-comum.js`, `lote.js`. Medi e capturei por conta própria (Playwright/Chromium headless sobre `file://`; 10 estados x 1440 escuro, 1440 claro, 390 claro, 390 escuro e 360 claro; nada na porta 3099, nenhum spec do projeto). Nenhum arquivo do mockup foi alterado; acrescentei só `shots/r3-*.png` e `shots/r3-medidas-revisor.json`. Navegador fechado ao fim.

## Veredito

**NÃO PODE ir ao dono ainda: 1 bloqueio e 3 "corrige".** Os dois bloqueios da r2 (B1 e B2) e os dois "corrige" (C1 e C2) foram resolvidos de verdade, sem criar defeito novo nos elementos desenhados (conferi por medida: 0 marca de troca ou de publicação cobrindo texto ou outra marca, em 3 larguras e 10 estados). O que sobra é de outra natureza: um vazamento na tela "só leitura" que a r2 deixou passar (erro meu também) e três acertos pequenos.

A pergunta de quem abre: "esta capa ou este título que troquei funcionou, e o que esteve no ar?". Primeiro olhar a 1440, sem rolar: a linha "Trocas deste vídeo: ..." e o gráfico com colchete "em teste A/B" e pontilhado "antes do início do registro" respondem em menos de 3 segundos. A 390 em `extremo` a linha-resumo agora ocupa 4 linhas (antes 8) e o gráfico aparece na mesma tela.

| Resumo | Contagem |
|---|---|
| Estados "pronto para o dono" | 9 de 10 |
| Estados "volta para ajuste" | 1 de 10 (`leitura`, por B1; `extremo` a 390 por C1) |
| Reprovado | 0 |
| Bloqueios | 1 |
| Corrige | 3 |
| Sugestões | 5 |

As três coisas que mais derrubam o conjunto agora:
1. Só leitura mostra o veredito de uma taxa que a mesma caixa diz que a pessoa não pode ver (B1).
2. A faixa "cliques estimados por dia" fica vazia, com legenda, em `extremo` a 390 px (C1).
3. Resíduos de texto e de formato que a rodada anterior prometeu limpar ou que destoam do vídeo aprovado: "foram cortados", "482310 views" (C2 e C3).

## Conferência da rodada 2

| Item r2 | Resolvido? | Evidência desta rodada |
|---|---|---|
| B1 ▾ da publicação risca o número da barra mais alta | Sim | `semnumero` 390 e 1440, escuro: o ▾ fica acima do "10" do gráfico de impressões, a linha da publicação não desce até ele (capturas próprias; no gráfico de views a haste tracejada aparece inteira). Medi 0 sobreposição entre qualquer marca (▾, losango, triângulo) e qualquer texto do SVG nos 10 estados a 1440, 390 e 360. |
| B2 marcador 4 cobre o 3 a 390 | Sim | `extremo` 390 claro (`shots/r3-extremo-390-claro-linha-resumo-e-marcas.png` e recorte do gráfico de impressões): 3 sobe na linha de cima, 4 desce para a de baixo, 5 e 6 também separados; os seis números inteiros. 0 sobreposição marca contra marca a 390 e a 360. |
| C1 quatro nomes para "sem dias para comparar" | Sim, com um resíduo | Rótulo "Antes: sem dias para comparar", chip, contagem e caixa ("um teste A/B vem logo antes", "a troca (2) vem logo depois", "o vídeo saiu logo antes da troca") concordam. Resta "Os dois lados foram cortados" na frase de baixo de `semnumero` (C2 abaixo). |
| C2 linha de trocas vira parágrafo | Sim | `extremo` 390 claro: "6 trocas e 2 testes A/B desde 07/10:" mais três itens com símbolo, 4 linhas, cerca de 95 px (antes cerca de 150). Sobra um "·" no fim de cada linha quebrada (S1). |
| S1 a S6 | Respostas por escrito aceitas | S1 (360 px) e S2 mantidos de propósito; aceito. |

## Bloqueio

### B1. Só leitura: o chip de cada troca dá o veredito da taxa de clique que a caixa ao lado diz que a pessoa não vê

- Tela e estado: `leitura`, 1440 escuro e 390 claro (igual nos outros dois cantos). Captura: `shots/r3-leitura-1440-escuro-troca2-chip-e-cadeado.png`.
- O que está errado: na "Troca de thumbnail" o chip diz "≈ sem diferença firme" (conclusão sobre a taxa de clique) e, três linhas abaixo, a caixa com cadeado diz "Taxa de clique antes e depois: só para quem administra o canal." O mesmo vale para o chip "sem dias para comparar" da troca 1, que sai da contagem de impressões, dado também privado pela decisão 11 das NOTAS. O resumo do bloco já foi corrigido (3b.js linha 222: só "taxa de clique: só para quem administra"), mas o chip por troca (`chipDe(k, le)`, linha 241) continua igual ao de quem administra; em outro dado de teste ele diria "▲ taxa subiu" ou "▼ taxa caiu" para quem não pode ver número nenhum.
- Evidência: leitura de `3b.js` linhas 221-222, 238 e 241; captura acima.
- Conserto: em `3b.js`, na montagem de cada troca, com `leitor` verdadeiro, só renderizar o chip quando `k === 'semorigem'` (a origem é pública); nos demais casos, nenhum chip, e a caixa de cadeado já diz tudo. Refazer `leitura` nas quatro combinações.

## Corrige (vai ao dono só depois de corrigido)

### C1. `extremo` a 390 px: a faixa "cliques estimados por dia" aparece vazia, com legenda de algo que não está desenhado

- Tela e estado: `extremo`, gráfico "Impressões e cliques", 390 px, os dois temas (e 360 px em `tipico` e `extremo`). Captura: `shots/r3-extremo-390-claro-impressoes-faixa-de-cliques-vazia.png`.
- O que está errado: com 36 dias a coluna de cada dia mede 7,47 px e a regra herdada do A4 (`a4-comum.js` linhas 167 e 194: `cw >= 7.5`) desliga os pontos e os números dos cliques. Sobra uma caixa chamada "cliques estimados por dia" sem nada dentro e a legenda "● cliques estimados do dia" sem marca no gráfico: parece "zero clique", que é justamente o que o dono não pode confundir. Medi: 0 pontos com 35 barras em `extremo` 390 e em `tipico` e `extremo` a 360; o mesmo gráfico a 1440 e `tipico` a 390 desenham os pontos.
- Conserto: separar os dois limites: desenhar os pontos a partir de `cw >= 5` e deixar só os números atrás de `cw >= 7.5`; ou, abaixo do limite, não desenhar a faixa nem a legenda de cliques e dizer numa linha "cliques: veja a tabela". Reconferir `extremo` a 390 e 360.

### C2. "Os dois lados foram cortados" ainda é o jargão da r1/C5

- Tela e estado: `semnumero`, troca 2 (frase abaixo das caixas), 390 claro e 1440. Captura de apoio: `index-caso-semnumero-390-claro.png`.
- O que está errado: a frase diz "A troca (1) vem 2 dias antes desta: nenhum dia inteiro fica entre as duas. Os dois lados foram cortados." A NOTAS afirma que "cortada" e "nenhum dia inteiro" saíram; a segunda forma voltou na frase e a primeira ficou (`3b.js` linha 152).
- Conserto: "Sem dias para comparar. A troca (1) vem 2 dias antes desta e a troca (3), 2 dias depois: não sobra dia inteiro para nenhum dos lados." ou, mais curto, "...vem 2 dias antes desta e a (3) vem logo depois: nenhum dos dois lados tem dia para comparar."

### C3. O cabeçalho do vídeo escreve "482310 views" e "4120 views"; o vídeo aprovado escreve "482 mil"

- Tela e estado: `extremo` (482310) e `tipico` (4120), 1440 e 390, qualquer tema. Captura: `shots/r3-extremo-390-claro-linha-resumo-e-marcas.png` mostra o cabeçalho logo acima (e `index-caso-extremo-390-claro.png`).
- O que está errado: `lote.js` linha 58 usa `String(v.views)`; o `video.js` aprovado (a4, linha 39) usa `v.views >= 1000 ? A.mil(v.views) : String(v.views)`. Dois números de views na mesma tela, "482310" no topo e "57.271" no gráfico, em formatos diferentes, e um desvio do que o dono já aprovou, sem estar declarado.
- Conserto: em `lote.js` linha 58, trocar por `v.views >= 1000 ? A.mil(v.views) : String(v.views)` (como no aprovado). Curtidas e comentários ficam como no aprovado.

## Sugestões (não bloqueiam)

- **S1.** Nas linhas quebradas da linha-resumo a 390 sobra "·" no fim ("taxa subiu ·") e o ponto final do último item fica baixo. Tirar o "·" quando o item quebra, ou usar uma lista de uma linha por item.
- **S2.** O símbolo ▲ tem dois sentidos na mesma tela: "troca de thumbnail" no gráfico e nos títulos das trocas e "taxa subiu" nos chips. As cores diferem (verde no chip) e a convenção vem do mockup 3 aprovado, então não bloqueia; vale uma pergunta ao dono.
- **S3.** A pastilha só com "0" abaixo da régua, em `so-teste` e `so-reconstruido`, perdeu a palavra "trocas" (aceito na r2) e fica solta, sem relação visível com a frase de cima. Vale "0 trocas" na própria pastilha.
- **S4.** A caixa hachurada "não medido: ainda sem dia fechado" (troca 2 de `hoje`, troca 3 de `semnumero`) tem o texto riscado pelas listras (contraste do texto 7,4:1 contra o fundo, mas as listras atravessam as letras). Pôr um fundo sólido atrás do texto.
- **S5.** `extremo` 360 px (fora do par obrigatório): texto do SVG a 11,4 px, como já dito; vale o piso de corpo no SVG se o dono quiser 360.

## Por estado e por largura

Pergunta e leitura de relance iguais em todos os estados (acima). Par obrigatório: 1440 escuro e 390 claro; 1440 claro e 390 escuro por amostra; 360 só medido.

| Estado | 1440 escuro | 390 claro | Observação |
|---|---|---|---|
| `tipico` | pronto | pronto | colchete A/B, caixas e nomes concordam; C3 no cabeçalho |
| `extremo` | pronto | volta (C1) | marcas e linha-resumo resolvidas; faixa de cliques vazia a 390 |
| `hoje` | pronto | pronto | hachura rosa "depois ainda não medido" distinta; S4 |
| `zero` | pronto | pronto | caixa vazada com 0 e "zero medido", nunca hachura |
| `semnumero` | pronto | pronto | ▾ acima do número (B1 da r2 resolvido); C2 na frase |
| `so-teste` | pronto | pronto | colchete aberto "em andamento" sobre o trecho anterior ao registro, sem riscar rótulo |
| `so-reconstruido` | pronto | pronto | pontilhado e divisor "07/10/2026: o registro começa" |
| `vazio` | pronto | pronto | frase-resumo mais "0" |
| `erro` | pronto | pronto | pastilha com ícone, diz até quando está certo e quando tenta de novo |
| `leitura` | volta (B1) | volta (B1) | chip de taxa para quem não vê taxa |

## Cobertura das cobranças do dono

| Cobrança | Resultado |
|---|---|
| Frase-resumo no topo | Passa, inclusive a 390 em `extremo` (4 linhas). |
| Régua ou barra | Passa: colchetes, régua das versões, faixa de taxa. |
| Cor estável por significado, com "não medido" | Passa: nenhum matiz novo; o colchete A/B usa o tom do texto; ausência em `--muted`; hachura rosa só para "não medido". |
| Símbolo junto da cor | Passa (setas trocando, "?", círculo pontilhado, barra de corte, cadeado). S2 sobre o ▲. |
| "Zero medido" distinto de "não medido" | Passa (`zero`: caixa vazada com 0; `hoje`, `semnumero`: hachura). |
| Método no ⓘ | Passa. |
| Sem prosa nem bloco monocromático | Passa; o fundo do colchete A/B é só acompanhamento da linha de 14,5:1 e 15,8:1. |
| Sem jargão | Falha leve: C2 ("cortados"). "ciclo" e "origem não sabida" mantidos de propósito. |
| Estados desenhados | Todos. |
| 390 px sem rolagem horizontal | Passa: 0 px nos 50 casos medidos. |
| Alvo de 44 px | Passa: 0 alvo abaixo de 44 x 44 a 390 (fora a barra "Estados do mockup", que não é da tela, 32 px de altura). |
| Tema escuro e claro | Passa. |
| Consistência com o lote 1 e o vídeo aprovado | Falha leve: C3 (formato de views no cabeçalho). |
| `color-mix()` | Ausente: `grep` só acha comentários "sem color-mix". |
| Acessibilidade básica | Passa: 23, 22 e 14 paradas de Tab em `extremo`/1440, `tipico`/390 e `leitura`/390, 0 sem contorno visível; 0 botão ou link sem nome; `role="group"` com rótulo que cita os testes A/B e `role="img"` com rótulo por extenso na régua, nas faixas e nas thumbnails. |

## Tabela de medidas

Contraste por cálculo WCAG com as cores lidas da página (`getComputedStyle`, composição de alfa sobre o fundo efetivo) nos 10 estados; mínimo 4,5:1 texto e 3:1 elemento gráfico. Todos os textos medidos (783 itens a 1440, 688 a 390) passam de 4,5:1; os únicos abaixo são os números dentro dos marcadores (falso positivo: o fundo é o do marcador, claro sobre escuro, lido na captura).

| Elemento | Escuro | Claro |
|---|---|---|
| Rótulo e traço do colchete A/B, publicação, "antes do início do registro" (SVG) | 14,48:1 | 15,76:1 |
| Fundo do colchete A/B contra o cartão (só acompanhamento) | 1,28:1 | 1,17:1 |
| Chips "sem dias para comparar", "sem antes", "origem não sabida", "sem diferença firme" | 6,18:1 | 6,43 a 7,13:1 |
| Chip "▲ taxa subiu" | 7,26:1 | 6,37:1 |
| Caixa "um teste A/B vem logo antes" e "não medido: ainda sem dia fechado" | 6,18:1 e 7,76:1 | 7,13:1 e 7,40:1 |
| Legenda do colchete A/B e do pontilhado | 6,18:1 | 7,13:1 |
| Etiqueta "+ novo" | 6,42:1 | 9,27:1 |

| Medida | Resultado |
|---|---|
| Rolagem horizontal | 0 px em todos os 50 casos |
| Erros de JavaScript | 0 |
| Texto de SVG fora do SVG | 0 |
| Marca (▾, losango, triângulo) sobre texto ou sobre outra marca | 0 a 1440, 390 e 360 |
| Texto abaixo de 12 px a 1440 e a 390 | 0 |
| Alvos abaixo de 44 x 44 a 390, na tela | 0 |
| Gráfico de impressões sem pontos de cliques com barras desenhadas | `extremo` 390 (C1); `tipico` e `extremo` 360 |
| Altura da página 1440 / 390 | 2135 a 5082 px / 3226 a 7166 px |

## O que NÃO consegui verificar

- Leitor de tela (VoiceOver, NVDA): conferi atributos e rótulos, não a fala.
- Safari, Opera (navegador do dono) e Firefox: só Chromium. O pontilhado curto dos colchetes não foi visto no Opera.
- Movimento reduzido: o desenho novo não tem animação nem transição.
- Zoom de 200% e fonte do sistema maior.
- Mouse sobre o gráfico (dica do dia): usei só o teclado.
- 360 px só medido, e 390 escuro e 1440 claro por amostra (as medidas cobrem todos os estados).
- Contraste do texto da caixa hachurada por pixel: medi só o texto contra o fundo base; as listras (S4) vi na captura.

## Para a rodada 4

Corrigir B1 (obrigatório), C1, C2 e C3; responder às sugestões por escrito; regenerar `leitura` (1440 escuro e 390 claro) e `extremo` a 390 claro e 360 claro, e ligar de novo as medidas. Se o desenhista discordar de B1 ou C1, responda com captura: mantenho ou retiro por escrito.
