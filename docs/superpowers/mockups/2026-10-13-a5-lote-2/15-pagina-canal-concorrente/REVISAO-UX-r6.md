# Revisão de UX, rodada 6: mockup 15, página do canal de concorrente

Revisor: revisor-ux-senior. Data: 13/10/2026. Escopo: conferir se o B1 e os C1 a C5 da r5 foram resolvidos de verdade, se os ajustes criaram defeito novo, e fazer eu, de uma vez, a varredura de coerência dos números de exemplo nos 12 estados.

Método: servidores estáticos próprios nas portas 47761 a 47778 (todos derrubados; `lsof` vazio; nada na 3099, sem specs do projeto, sem escrever fora desta pasta). Regerei as 24 capturas dos pares obrigatórios (12 estados em 1440 escuro e 390 claro) e li o texto renderizado de cada estado com tudo aberto (blocos "Mais números do canal" e "Ver como tabela", `aria-label` dos desenhos e o texto de cada ⓘ). Olhei as capturas de magro, cheio, extremo, zero, erro, vazio e fora (1440 escuro e/ou 390 claro) e uma versão em escala de cinza do magro. Rodei o `coerencia.mjs` do desenhista (668 linhas, 0 que não fecham, a 1440 px) e, fora dele, recalculei por conta própria, sobre `window.PC_M` e sobre o DOM, as relações listadas em "Varredura". Medi os 12 estados em 4 combinações (1440 escuro, 390 claro, 1440 claro, 390 escuro) = 48 cruzamentos.

## Resumo

**Veredito geral: PODE_IR_AO_DONO. 0 bloqueios, 0 correções, 8 sugestões.**

Estados: 12 prontos para o dono, 0 voltam para ajuste, 0 reprovados.

Pergunta do usuário: "este canal está subindo, parado ou caindo, e o último vídeo dele foi acima do normal?". Respondida no primeiro olhar nos 12 estados (símbolo mais frase no topo, seis células logo abaixo; li 1440 escuro e 390 claro). Passa, e passou nas seis rodadas.

O B1 e os C1 a C5 da r5 estão resolvidos de verdade (tabela abaixo), nenhum ajuste criou defeito visível, e a classe de erro que derrubou as rodadas anteriores ("um número que contradiz outro na mesma tela") não aparece mais em nenhum estado: nenhum "N de M" com N maior que M, nenhuma data de comentário antes do vídeo, nenhuma barra de dias maior que os dias de registro, nenhum cabeçalho que diga "medido" sobre cartão "não medido". Achei, na varredura própria, três diferenças entre a regra escrita e o exemplo (S1, S2 e S6 abaixo) que **nenhum número na tela contradiz** e que por isso não bloqueiam; vão listadas porque o implementador herda `pc-dados.js` como referência e você pediu tudo de uma vez.

As três coisas que ainda separam esta tela da perfeição (nenhuma impede o dono de aprovar):

1. **Duas "views típicas" com o mesmo nome.** O Acerto compara cada vídeo com o valor do meio dos vídeos de 7 a 89 dias; a célula "Views típicas" de "Mais números" é o valor do meio de 0 a 89 dias. Diferem de 2% a 12%, e com o número mostrado o Acerto daria 5 de 20 no `cheio` (a tela diz 2), 3 de 10 no `magro` (2), 2 de 16 no `erro` (1), 4 de 20 no `nichos` (3). Hoje isso só se vê recalculando (S1).
2. **A janela de 180 dias tem dois limites.** A linha do normal conta vídeos com idade até 180 dias; os "90 dias anteriores" da Direção vão até 179 (S2).
3. **Texto repetido nas faixas de `fora` e `erro`** (S4) e o rótulo "n 47" sem explicação à vista (S3).

## Conferência da r5

| Item da r5 | Resultado | Evidência |
|---|---|---|
| B1 "Criador responde": base de 30 dias contra exemplos e n | RESOLVIDO | `n` deixou de ser digitado: cheio e leitura 13, extremo 17, nichos 16, e conferi por mim: longos com idade de 30 a 89 dias na última leitura = 13, 17, 16 (PC_M). Comentários de exemplo: Chiang Mai (vídeo de 30 dias, comentário no 4º dia, "há 26 dias"), Peru (31 dias, 9º dia, "há 22"), cidade mais barata da Europa (34 dias, 14º dia, "há 20"), e o do extremo (Peru, 34 dias, 9º dia, "há 25"); todos com idade do vídeo maior ou igual a 30, comentário depois do vídeo e "há N" = idade menos dias depois. O ⓘ diz "idade de 30 a 89 dias" e a mensagem de "não medido" diz "fecha em 10/11" (11/10 + 30). As 13 caixinhas do cheio (5 marcadas) fecham com "5 de 13 (38%)". |
| C1 duas datas da mesma regra (19/10 e 13/12) | RESOLVIDO | Contei no calendário: 24/08 + 56 = 19/10, 24/08 + 112 = 14/12. "50 de 112" (magro, parado, zero, shorts: 25/08 a 13/10 = 7 + 30 + 13), "41 de 112" no erro (25/08 a 04/10), "46 de 112" no fora (a 09/10). Cadastros depois de 24/08: nm 26 de 112 e 07/01/2027 (18/09 + 111), vazio 2 de 112 e 31/01/2027 (12/10 + 111). ⓘ da Direção e do Estado dizem "só a partir de 14/12/2026". |
| C2 pontinhos do Acerto em duas linhas | RESOLVIDO | Grade fixa de 12 px: cheio, extremo, nichos 10 + 10; erro 8 + 8; magro 5 + 5; parado, fora e zero (até 8 vídeos) em uma fileira só. Medi `getBoundingClientRect` a 1440, 1280, 1180, 1024, 768, 600 e 390: nenhuma fileira órfã; o único pixel fora da célula é 1 px do último ✕ de extremo e nichos a 1180 px (padding da célula, invisível). |
| C3 Inscritos com 2 algarismos | RESOLVIDO | "2,08 mi", "9,84 mi", "3,74 mi"; abaixo de 1 mi igual (325 mil, 593 mil, 1,53 mil, 187 mil, 341 mil, 48,2 mil, 764 mil, 212 mil). Passo do arredondamento dito em "Mais números" bate em todos (10 mil acima de 1 mi, 1 mil de 100 mil a 999 mil, 10 abaixo de 10 mil). |
| C4 nichos sem o percentual | RESOLVIDO | "0 de 16 (0%)" com a caixa vazada mantida. |
| C5 "Inscritos em 30 dias +1,0%" em canal parado | RESOLVIDO | parado, fora e zero "≈ 0" com "menos que 10 mil / 1 mil / 10 inscritos, o arredondamento do YouTube"; os demais fecham com as views: magro +0,4% de 325 mil (1,3 mil novos contra 282 mil views, 0,46%), erro +0,6% (0,58%), cheio +1,4% (0,52%), extremo +0,8% (0,22%), nichos +1,3% (0,5%). Nenhum canal fora da faixa de 0,2% a 0,6% de inscritos novos por view. |
| S1 do canal contém os vídeos | RESOLVIDO | `erro` e `fora` rebalanceados; conferidor 0 dias em que os vídeos somam mais que o canal. |
| S2 a S6 | RESOLVIDOS | gráfico, legenda e tabela dizem "sem registro"; parado "Publicou 0,4 por semana nas últimas 13 semanas"; vazio "neste canal, só desde 12/10 (2 dias)"; erro e fora "1 deles na semana sem leitura"; magro sem Short repetido. |
| S7 sem estado de carregando | NÃO FEITO, declarado desde a r1 | segue como item de implementação (esqueleto das seis células). Não bloqueia. |

Defeito novo criado pelos ajustes: nenhum que apareça na tela. Os dois achados de varredura S1 e S2 já existiam antes da r6.

## Bloqueios

Nenhum.

## Correções

Nenhuma.

## Sugestões (não bloqueiam; as três primeiras valem a pena antes de o implementador copiar `pc-dados.js`)

### S1. O Acerto usa uma "views típicas" diferente da que a tela mostra
- Estados: magro, cheio, extremo, erro, fora, nichos, leitura, parado, zero (todo estado com Acerto medido).
- Evidência: `pc-dados.js` linhas 164 a 170 calculam `md = mediana` só dos longos de 7 a 89 dias e marcam acerto com `views / md >= 2` e fracasso com `<= 0.5`. A célula "Views típicas, vídeos longos" (e a linha de Direção "views de hoje") usa o valor do meio dos longos de 0 a 89 dias. O ⓘ do Acerto diz "2× ou mais as views típicas do próprio canal". Recalculei com o número mostrado: o valor do Acerto é 2% a 12% maior (magro 20,4 mil contra 19,0 mil; cheio 233 mil contra 208 mil; extremo 2,35 mi contra 2,09 mi; erro 8,46 mil contra 8,32 mil; nichos 125 mil contra 116 mil), e com o valor mostrado o acerto k daria magro 3 (tela 2), cheio 5 (2), erro 2 (1), nichos 4 (3), e os fracassos do extremo 4 (5) e do erro 4 (5). Não aparece na tela porque os vídeos acima de 2× que o usuário vê (cheio: 430 mil e 468 mil na lista) caem no mesmo lado das duas contas, e os demais não estão visíveis.
- Por que não bloqueia: nenhum número na tela contradiz outro; é regra escrita contra exemplo, verificável só por recálculo.
- Conserto exato (uma frase): no ⓘ do Acerto, trocar "as views típicas do próprio canal" por "o valor do meio das views desses mesmos vídeos (os de 7 a 89 dias)". Ou, se o dono preferir um número só, calcular o Acerto com o `Views típicas` mostrado e atualizar k e f dos 9 estados (o conferidor já reconta). Eu fico com a primeira: a conta é mais justa (vídeo recém-publicado puxa o valor do meio para baixo).

### S2. Janela de 180 dias com dois limites
- Estados: cheio (e leitura) e shorts; nos demais o vídeo de 180 dias não existe.
- Evidência: `pc-dados.js:149 e 151` usam `i >= 90 && i < 180` para "os 90 dias anteriores" (22 + 25 = 47 vídeos no cheio); `pc-dados.js:200` usa `idade <= 180` para o "n" de cada ponto da linha do normal. No cheio há 1 vídeo de idade 0 (hoje) e 1 de idade 180: o n do dia 1 sai 47 (46 mais o de 180 dias), e só coincide com "22 e 25" porque as duas diferenças se cancelam; no dia 30, n = 39 contra 13 + 25 = 38. Quem somar "22 e 25" e tirar o vídeo de hoje, que não tem ponto no dia 1, espera 46.
- Conserto exato: uma constante `JANELA_NORMAL = 180` e `idade < 180` nos dois lugares; o cheio passa a n = 46, 45, 45, 45, 45, 44, 42, 38; o conferidor troca "n = longos até 180 dias" por "n = longos de idade ≥ dia do ponto e < 180" e "n do dia 1 = (22 menos os de hoje) + 25".

### S3. "n 47" sem explicação à vista
- Estados: todos com Lançamentos (cheio, extremo, nichos, shorts, magro, erro, fora). As oito casas sob a curva dizem "dia 1 / n 47"; a única explicação do "n" está no ⓘ ("Cada ponto leva o seu n") e no `aria-label` da lista.
- Conserto exato: trocar o rótulo por "47 vídeos" (e "1 vídeo"; "0 vídeos" nas casas hachuradas). Mesmo espaço, sem sigla.

### S4. Texto repetido nas faixas de fora do ar e de erro
- `fora`, 1440 escuro (captura lida): a faixa diz "Saiu do YouTube em 09/10" e "O YouTube não diz o motivo. O canal continua aqui..."; 60 px abaixo a frase do topo diz "Os números valem até 09/10; o YouTube não diz o motivo", e a célula Estado repete a pastilha "Saiu do YouTube em 09/10". `erro`: a faixa diz "Os números valem até 04/10", a frase "Os números abaixo são de 04/10, a última leitura que deu certo" e a célula "sem leitura desde 04/10". A decisão 13 da r1 era dizer o estado uma vez só.
- Conserto exato: na frase do topo de `fora`, cortar "; o YouTube não diz o motivo" (fica "Os números valem até 09/10."); na do `erro`, "Os números abaixo são de 04/10." sem o aposto. A célula Estado pode ficar, é onde o usuário procura o estado.

### S5. A nota de exemplo no topo afirma mais do que a tela mostra
- Estados: zero, parado, shorts, erro, fora. A nota diz "por isso o que é novo aparece quase todo 'não medido'". No zero, parado e shorts, 4 das 6 células são medidas; no erro e no fora o "não medido" vem da leitura parada, não da contagem por vídeo.
- Conserto exato: "por isso o que depende dela aparece 'não medido'". A nota não é da tela do produto (tem a marca "exemplo"), então é só honestidade do mockup.

### S6. Pequenas imprecisões de texto
- "Em erro há 9 dias" conta de 04/10, que é o dia da última leitura boa; o erro começou na primeira leitura que falhou (05/10 ou depois), então são 8 dias ou menos. Conserto: "Em erro desde 05/10", ou ficar com "há 9 dias" e escrever "sem leitura desde 04/10" na faixa.
- Os ⓘ do cheio, extremo, nichos e leitura (telas de 12/05/2027) falam em "só a partir de 14/12/2026" e "Antes de 19/10/2026 a janela ainda cruza": verdadeiro, mas lê-se como futuro numa tela datada depois. Conserto: "desde 14/12/2026" nessas quatro, ou deixar como regra geral sem verbo de tempo.
- NOTAS.md ficou atrás do desenho em três linhas: a tabela de frases ainda diz "Publica [1,7] vídeos por semana" (a tela diz "vídeos longos"), "Ele costumava publicar a cada [5] dias" (a tela diz "um longo a cada 5 dias") e "[3 de 20]" (placeholder); o quadro de estados do `extremo` diz "9,8 mi inscritos" e, na mesma linha, "9,84 mi". Atualizar, porque o implementador lê a tabela.

### S7. 360 px
- Fora do par obrigatório (390), mas é a largura de muito Android: a 360 px a página rola 25 px na horizontal (o quadro de referência do mockup e a tabela "Ver como tabela" aberta passam 10 px). Em 390 e acima rola 0. Conserto: `overflow-x: auto` no contêiner da tabela e `min-width: 0` nas células; o quadro de referência não faz parte da tela.

### S8. Sem estado de carregando
- Declarado desde a r1; fica como item de implementação. Repito porque é o único dos sete estados da lista de bordas que o mockup não desenha.

## Varredura de coerência: o que recalculei por conta própria

Cada linha é uma relação entre números da mesma tela, recalculada fora do código de desenho (calendário à mão, mediana e contagens sobre `window.PC_M`, texto lido do DOM). "ok" = fecha.

| Relação | Resultado | Estados |
|---|---|---|
| "N de M" no texto renderizado (todos os blocos abertos): nenhum N maior que M; nenhum "undefined", "NaN", "null", "1 dias", "1 vídeos" | ok | 12 de 12 |
| Datas das barras de dias por calendário: 26 de 56 e 12/11; 11 de 180 e 31/03/2027; 50 de 112 e 14/12; 2 de 56 e 06/12; 2 de 112 e 31/01/2027; 2 de 180 e 09/04/2027; 26 de 112 e 07/01/2027; 41 e 46 de 112 (a 04/10 e a 09/10); 2 de 180 e 7 de 180 nos que pararam; "faltam 30" e "faltam 54" = 56 menos o feito; 15/10, 17/10, 08/11, 10/11, 10/11 (coleta + 30) | ok | nm, vazio, erro, fora, magro, parado, zero, shorts |
| "N e M vídeos" de views de hoje e de leitura justa = contagem de longos com idade 0 a 89 e 90 a 179 (e 30 a 89, 120 a 179 na leitura justa), e a mediana de cada lado igual à mostrada (19,0 mil e 38,3 mil; 208 mil e 236 mil; 2,09 mi e 4,01 mi; 125 mil e 130 mil; 32 e 35; 8,32 mil e 5,36 mil; 4,345 mil e 4,203 mil; 116 mil e 230 mil) | ok | 9 estados com medida |
| Percentuais refeitos a partir dos dois números mostrados (+12%, +18%, −34%, −20%, +2%, +7%, +9%, +14%, +4%; −12%, −48%, −50%, −4%, −9%, +55%, +3%; +30%, −32%) | ok, nichos "−50%" vem de −49,6% e fica sem "ou menos" | 12 de 12 |
| "Views por dia" × 28 = soma das 28 views da Direção (10,1 mil, 201 mil, 1,3 mi, 10,6 mil, 10, 6,9 mil, 3,12 mil, 11,9 mil, 67,7 mil) | ok | 9 estados |
| Ritmo: soma das 13 casas de longos = "N" de "0,9 por semana" (12, 22, 22, 5, 8, 16 mais 1 na semana "—", 8 mais 1, 71 Shorts); "N de 13" = casas com número; as últimas 4 casas = "publicações" da Linha do tempo (7, 17, 19, 22, 7) | ok | 11 de 12 (nm e vazio não têm base) |
| Linha do tempo: 90 leituras de dia por estado (990 no total), data da leitura = data da linha da tabela; barras no mesmo eixo (altura = valor ÷ topo do eixo: magro 11.686 em 79,5 px de 170; cheio 281.419 em 159,5 px; extremo 1.052.217 em 44,7 px) | ok | 11 estados |
| Régua: marcador de −12% a 38% do trilho, +30% a 80%, −34% a 16% ((valor + 50) ÷ 100), conferido pela captura | ok | cheio, extremo, magro |
| Lançamentos: ao clicar em cada vídeo (6 estados, 28 vídeos) a frase de cima e a linha da lista dizem a mesma razão e o mesmo nível; "1,4× no dia 1" de "40,6 mil" com normal de 28,9 mil (1,40) e "3,3×" com 95,9 mil sobre 28,9 mil | ok | cheio, extremo, nichos, shorts, magro, erro |
| Idade dos vídeos do Lançamentos = "publicado há N dias" e = n por idade (cheio: 47, 46, 46, 46, 46, 45, 43, 39 mostram vídeos de 0, 1, 7, 17, 18, 22, 24 dias) | ok no que a tela mostra; ver S2 para o limite de 180 | cheio |
| 72 horas: n = longos com 3 dias ou mais (cheio 20 = 22 menos hoje e ontem; extremo 22; nichos 20 = 21 menos ontem) | ok | cheio, extremo, nichos |
| Acerto k de n, e fracassos, contra a mediana do próprio grupo | ok; ver S1 para o nome da mediana | 9 estados |
| Criador responde: n = longos de 30 a 89 dias, k = caixinhas marcadas, percentual com n ≥ 10 | ok | cheio, extremo, nichos, leitura |
| Inscritos: 3 algarismos, passo do arredondamento, novos em 30 dias contra views | ok | 12 de 12 |
| Estado: Ativo com 27 dias (limite 28), Parado com 64 dias (10/08 a 13/10), limite 38 no fora (4 × 9,5) | ok | zero, parado, fora |
| Dia da semana das leituras (qui 16/07, ter 25/08, seg 14/09, ter 13/10) | ok | magro, zero, fora |
| Texto a 390 igual ao de 1440 (só mudam 3 frases de interface: "sem a linha do normal", "Use os botões", rótulo "sem registro" do desenho) | ok | 12 de 12 |

## Veredito por estado e largura

Medidas de rolagem, fonte, alvo, contraste e foco limpas em todos (tabela abaixo). As sugestões não mudam o veredito.

| Estado | 1440 escuro | 390 claro | Veredito | Sugestões que o tocam |
|---|---|---|---|---|
| magro (caso real) | ok | ok | pronto para o dono | S1, S3 |
| cheio | ok | ok | pronto para o dono | S1, S2, S3, S6 |
| extremo | ok | ok | pronto para o dono | S1, S3, S6 |
| parado | ok | ok | pronto para o dono | S1, S5 |
| zero medido | ok | ok | pronto para o dono | S1, S5 |
| não medido (nm) | ok | ok | pronto para o dono | nenhuma |
| erro | ok | ok | pronto para o dono | S1, S3, S4, S5, S6 |
| sem dado (vazio) | ok | ok | pronto para o dono | nenhuma |
| fora do ar | ok | ok | pronto para o dono | S1, S3, S4, S5 |
| só Shorts | ok | ok | pronto para o dono | S2, S3, S5 |
| nichos diferentes | ok | ok | pronto para o dono | S1, S3, S6 |
| só leitura | ok | ok | pronto para o dono | S1, S6 |

Resumo: 12 prontos, 0 voltam para ajuste, 0 reprovados.

## Tabela de medidas

| Item | Resultado | Como medi |
|---|---|---|
| Rolagem horizontal, 12 estados × 4 combinações, tudo aberto | 0 px em 48 de 48 | `scrollWidth` menos `clientWidth` |
| Texto menor que 12 px dentro da tela | 0 em 48 de 48 | `font-size` computado de cada nó de texto visível |
| Alvos abaixo de 44 × 44 px a 390 px (ponteiro grosso) | 0 nos 24 cruzamentos de 390 | `getBoundingClientRect` em links, botões, `summary`, `[role=button]`, `[tabindex=0]` |
| Contraste de texto (cor composta com alfa sobre o fundo efetivo, todos os nós, tudo aberto) | menor razão 4,96:1 (1440 escuro e 390 escuro), 4,86:1 (1440 claro e 390 claro, "▼ −34%" no extremo e "janela atual"); 0 abaixo de 4,5:1 (3:1 em texto grande) | WCAG sobre `getComputedStyle`; não cobre texto sobre a hachura rosa (li nas capturas) |
| Contraste gráfico por token | não refeito: `a4.css` não mudou desde as medidas da r5 (acento 6,72 / 4,94; subindo 7,26 / 6,37; descendo 7,71 / 5,55; ＝ 6,18 / 7,13; zero medido 4,97 / 4,84; não medido, borda, 4,09 / 4,57; azul do lado b 6,80 / 4,43; tiers 5,13 a 7,73). Todos acima de 3:1 | razão dos hex de CONVENCOES contra `--surface` |
| ⓘ: 6 por tela, abertos em magro, cheio, erro e nichos a 1440 e 390 | 48 de 48 abrem dentro da janela (390: margem de 12 px; 1440: de 1021 a 1408), sem rolagem interna, Esc fecha, o foco volta ao botão | `getBoundingClientRect` do `:popover-open` |
| Foco por teclado (Tab 120×, 4 estados e 2 temas) | 0 paradas sem anel de foco visível; 37 a 42 paradas distintas por estado | `outline` e `box-shadow` do `:focus-visible` |
| Pontinhos do Acerto sem ✕ órfão | 0 em 8 estados × 8 larguras (1440 a 360) | posição dos filhos de `.pc-qs` |
| `color-mix()` | 0 em CSS e JS que carregam a interface; só comentários "sem color-mix()" | grep na pasta |
| Movimento reduzido | `@media (prefers-reduced-motion: reduce)` presente em `pc.css` (não mudou) | leitura do CSS |
| Escala de cinza | magro lê-se: ▲ e ▼ distintos pelo glifo, "não medido" pela hachura, "zero medido" pela caixa vazada, régua pela barra | captura convertida para cinza |
| Conferidor do desenhista (`coerencia.mjs`, 1440) | 668 linhas, 0 que não fecham | execução própria, porta 47772 |
| Servidores e navegadores desta revisão | 0 em escuta (`lsof` 47710 a 47790 vazio); nenhum Chromium órfão | `lsof`, `ps` |

## O que NÃO consegui verificar
- Leitor de tela (VoiceOver, NVDA): li só `aria-label`, ⓘ e estrutura de títulos.
- Safari, Firefox e Opera (o navegador do dono renderiza `color-mix()` transparente; confirmei só a ausência no código). Só Chromium.
- Toque real em aparelho (simulei `hasTouch` com viewport de 390 px).
- Fontes do Google (Fraunces, Inter, JetBrains Mono): bloqueadas na captura de propósito; quebras de linha reais podem variar alguns pixels.
- Contraste do texto "não medido" sobre a hachura rosa e contraste gráfico por token: este não foi refeito (ver tabela).
- Conferidor a 390 px: rodei só a 1440 e comparei o texto renderizado dos 12 estados a 390 contra o de 1440 (iguais, fora 3 frases de interface); o desenhista declara as duas tabelas idênticas.
- Capturas olhadas uma a uma: magro, cheio, extremo, zero, erro, vazio e fora (1440 escuro e/ou 390 claro). Parado, shorts, nichos, nm e leitura foram conferidos por texto, medidas e dados, não por captura.
- Se a regra de 30 dias de comentários e a de 7 dias do Acerto estão no spec 04: li o texto do mockup, não reabri a spec.

## Para quem desenhou

Pode ir ao dono como está. Se tiver uma passada livre antes de enviar, o melhor retorno por minuto: S1 (uma frase do ⓘ), S3 (rótulo "47 vídeos"), S4 (cortar a repetição das faixas) e S6 (NOTAS.md). S2 e S7 são para o implementador. Nenhum deles muda número que o dono vê nas capturas, então não precisa de nova revisão minha.
