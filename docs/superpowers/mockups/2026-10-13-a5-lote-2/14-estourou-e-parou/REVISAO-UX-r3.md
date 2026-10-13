# Revisão de UX, rodada 3: mockup 14, a leitura M10 "Estourou e parou" (13/10/2026)

Revisor: `revisor-ux-senior`. Pasta: `docs/superpowers/mockups/2026-10-13-a5-lote-2/14-estourou-e-parou/`. Nada do mockup foi editado; só acrescentei capturas `shots/r3rev-*.png`. Escopo: conferir se cada bloqueio e cada "corrige" da r2 foi resolvido e se o ajuste criou defeito novo.

## Resumo

**Veredito do conjunto: PODE IR AO DONO. 0 bloqueios, 0 "corrige", 6 melhorias.**

B1, B2 e C1 da r2 foram resolvidos de verdade, com captura e medida. O ajuste não criou defeito novo. Rodei a bateria completa de novo: 42 telas (15 do Histórico, 24 do Outliers por filtro, 3 de comparação de nome) em quatro combinações de largura e tema, 168 medidas, e abri por mim as telas que cada bloqueio tocava.

| Tela | Veredito |
|---|---|
| Histórico do vídeo (15 estados) | pronto para o dono |
| Outliers `cheio`, `magro`, `zero`, `sem-dado`, `erro`, `carregando`, os quatro filtros | pronto para o dono |
| Comparação de nome (`nome=ambos`, `nome=b`) | pronto para o dono |

## Conferência da r2

| Item | Situação | Evidência |
|---|---|---|
| B1 linhas impossíveis do `magro` | **Resolvido** | `shots/r3rev-tela-outliers-caso-magro-filtro-todos-1440-escuro.png`: Ilhas da Tailândia, "sem a medida dos 30 primeiros dias", há 215 dias; Trem noturno, "canal com menos de 5 vídeos", há 103 dias; as quatro linhas "sem a medida dos 30 primeiros dias" têm 205, 210, 230 e 215 dias (Bangkok, 212), todas acima do corte de 199 dias que vem do ⓘ (publicado antes de 03/10/2026, com hoje = 20/04/2027). Nenhuma linha com "ainda não tem 90 dias" e idade de 90 ou mais (Chiang Mai: 61 dias, e 91.000 / 41.500 = 2,19×, coerente com o filtro de 2×). Nenhuma linha "menos de 1.000 views" com múltiplo de 2× ou mais. |
| B2 filtro "Não é o caso" no `magro` | **Resolvido** | `shots/r3rev-tela-outliers-caso-magro-filtro-nao-1440-escuro.png` e `...-390-claro.png`: a frase do topo ("1 dos 9 outliers tem a leitura; 0 não são o caso e 8 não foram medidos") e a caixa ("Nenhum dos 9 outliers deu “não é o caso”. 1 tem a leitura e 8 não foram medidos. Zero aqui é um resultado: houve medida, e nenhum vídeo ficou de fora.") concordam. O 0 do filtro e o 0 da caixa usam a caixa vazada de zero medido; "Ver todos os 9" leva de volta. Conferi o texto de todas as combinações caso x filtro: `zero` + "Com a leitura" diz "Nenhum dos 9 outliers tem a leitura. 5 foram medidos e não são o caso; 4 não foram medidos" (bate com o topo); `cheio` e `magro` + "Com a leitura" e "Não medido" mostram linhas, sem caixa vazia contraditória. Singular concorda ("1 dos 9 outliers tem a leitura"). |
| C1 casas esticadas no `carregando` | **Resolvido** | `shots/r3rev-caso-carregando-1440-escuro.png` e `shots/r3rev-tela-outliers-caso-carregando-filtro-todos-390-claro.png`: as três casas pontilhadas são quadrados de cerca de 22 px, o esqueleto continua em retângulos. |
| Melhorias 1, 5, 6 da r2 | Feitas | "Bate se tiver 108.000 views ou mais", "Bate se for até 17% / 2% / 1,1%" iguais nos três cartões (`shots/r3rev-caso-tipico-390-claro.png`, `shots/r3rev-caso-nao-1440-escuro.png`); chip "Idade: hoje". |
| Melhorias 2, 3, 4, 7 da r2 | Mantidas como estavam (decisão do dono, registro, desenho natural, cosmético) | Aceito; ver melhorias abaixo. |

## Pergunta do usuário e leitura de relance

- **Histórico:** "Este vídeo estourou e parou, ou não? E isso é medido ou é palpite?" Resposta no primeiro olhar: título, pastilha "indício", três casas e frase ("Os 3 sinais batem" / "Só 2 dos 3 sinais batem, então não é o caso: a reação do público (1,6% das views) ficou acima do limite de 1%"). Os três cartões e as réguas vêm logo abaixo. Passa.
- **Outliers:** "Quais destes outliers estouraram e pararam, e quantos eu nem consigo julgar?" Frase ("1 dos 9 outliers tem a leitura; 0 não são o caso e 8 não foram medidos"), barra em três formas (cheia, contorno, hachura) e filtros que são a legenda. Passa, inclusive no `magro`, que é o primeiro que o dono verá em produção.
- Cor com símbolo: ✓ cheio, ✕ contorno, "–" com hachura e rosa próprio para "não medido", que nunca tem a cor de zero (zero medido é a caixa vazada com "0"). Sem verde, âmbar nem vermelho de direção. Método só no ⓘ.

## Bloqueios

Nenhum.

## Melhorias (não bloqueiam)

1. **`carregando` reaproveita as casas pontilhadas do "ainda não existe".** A frase "Calculando a leitura..." desfaz a dúvida, mas o mesmo desenho significa duas coisas. Se sobrar tempo: no `carregando`, casas com a mesma forma e um pulso suave (parado com movimento reduzido).
2. **O `magro` é um mundo à parte.** "A passagem mais barata do mundo" é não medido (205 dias) no `magro`, mas ✓✓✓ no Histórico `borda`. Está declarado na NOTAS (seção 7, B1) e só afeta quem clica da linha para o Histórico dentro do mockup; em produção os dados virão de uma só fonte. Registrar para o implementador não copiar essa discordância como regra.
3. **Texto obrigatório no meio da lista, filtro "Todos"** (r2 melhoria 2): decisão do dono, já listada. A alternativa é o texto abaixo da lista inteira.
4. **Ordem das linhas muda uma tela existente** (r2 melhoria 3): as linhas com a leitura vêm primeiro. Entra na lista de decisões do dono.
5. **Linha de base da legenda do cartão 2** (r2 melhoria 7): ainda uns 5 px abaixo dos cartões vizinhos a 1440; cosmético, fica para a implementação.
6. **"Zero aqui é um resultado"** nas caixas vazias: entendível, mas "resultado" é abstrato. Sugestão: "Zero aqui é uma medida: houve cálculo, e nenhum vídeo ficou de fora."

## Medidas (168: 42 telas x 1440 escuro, 390 claro, 1440 claro, 390 escuro)

| Medida | Resultado |
|---|---|
| Rolagem horizontal da página | **0 px em todas as 168** |
| Texto menor que 12 px | **0** |
| Alvos menores que 44 px a 390 (ponteiro grosso) | **0** (filtros, link da linha, ⓘ, "Tentar de novo", "Ver todos os 9") |
| Alvos menores que 44 px a 1440 | só a migalha "Canais" (41x20) e o nome do canal (22 a 100 x 20) da casca do lote 1, fora do bloco novo |
| Menor contraste de texto, todos os textos visíveis, cor composta sobre o fundo real | **4,72:1 no escuro (1440 e 390), 6,07:1 no claro** (cumpre 4,5:1) |
| Contraste das réguas, zona e anel (medidos na r2, CSS não mudou) | 3,28:1 escuro, 3,40:1 claro; anel 4,94 e 4,18:1 |
| `color-mix()` em `m14.css`, `m14.js`, `m14-dados.js` | **0** (só aparece em um comentário "sem color-mix") |
| Palavra "retenção" no texto renderizado | **0 nas 168** |
| Jargão (CTR, snapshot, payload, pipeline, diário, gravou, série, lido) | **0** |
| Palavra "vale" no bloco renderizado | **0** |
| Erros de página ou de console (fontes externas bloqueadas por mim) | **0** |
| `a4.css`, `a4-comum.js`, `lote.css`, `lote.js` | idênticos aos do mockup 13 (`cmp`), ou seja, lote 1 congelado |
| Escala de cinza | ✓ preenchido, ✕ contorno, "–" com hachura: distintos sem cor (visto na r2; as formas não mudaram) |

## Veredito por estado e largura

| Estado | 1440 escuro | 390 claro | Observação |
|---|---|---|---|
| Histórico `tipico` | pronto | pronto | `shots/r3rev-caso-tipico-390-claro.png` |
| `extremo`, `borda`, `zero` | pronto | pronto | medidos; não mudaram |
| `nao` | pronto | pronto | frase diz o sinal que falhou e o limite; sem o texto obrigatório |
| `nao-rende` | pronto | pronto | |
| `nm-semv30`, `nm-v30baixo`, `nm-canal`, `nm-semreacao`, `nm-aovivo`, `nm-cedo` | pronto | pronto | |
| `sem-dado`, `erro` | pronto | pronto | |
| `carregando` | pronto (C1 resolvido) | pronto | melhoria 1 |
| Outliers `cheio` (4 filtros) | pronto | pronto | |
| Outliers `magro` (4 filtros) | pronto (B1 e B2 resolvidos) | pronto | `r3rev-tela-outliers-caso-magro-*` |
| Outliers `zero` (4 filtros) | pronto | pronto | |
| Outliers `sem-dado`, `erro`, `carregando` | pronto | pronto | |
| `nome=ambos`, `nome=b` | pronto | pronto | só comparação de nome |

Claro a 1440 e escuro a 390: medidos (rolagem, fonte, alvo, contraste), não abertos um a um.

## Risco 11 e itens 55 e 56

O mockup deixa claro que é indício: pastilha "indício" colada ao nome, caixa "Indício, não medição." com três linhas por forma, ⓘ com a frase fixa, nenhuma nota, percentual de chance ou cor de bom e ruim. O texto obrigatório, com as três frases do spec, só aparece quando a lista visível tem linha com a leitura. O que ameaçava a credibilidade (linhas impossíveis no `magro`) foi corrigido. Palavra "retenção": zero em tudo o que renderiza; o teste do item 56 deve olhar o HTML renderizado, não o código. Os casos de borda do item 55 (igual ao limite, zero, 0,02%, nulo) estão desenhados e distintos.

## O que NÃO consegui verificar

- Leitor de tela (VoiceOver, NVDA): li `aria-label`, `role` e `aria-live` no código e no DOM, mas não ouvi nada.
- Safari, Firefox e Opera: só Chromium headless. `color-mix()` está coberto por inspeção do CSS, não por renderização no Opera.
- Teclado: nesta rodada não percorri o Tab de novo; a r2 verificou ordem de foco, foco visível de 2 px e Esc no ⓘ, e esta rodada só mexeu em dados, texto do vazio e seletor do esqueleto.
- Toque em aparelho real e movimento reduzido.
- Claro a 1440 e escuro a 390 só medidos.

## Arquivos

- Capturas desta rodada: `shots/r3rev-*.png` (14 arquivos: `magro` nos quatro filtros e duas larguras, `carregando` do Histórico e do Outliers, `nao`, `nao-rende`, `tipico` a 390).
- Servidor estático de teste na porta 47771, encerrado ao fim do script; sem uso da porta 3099, do Playwright do projeto nem do banco.
