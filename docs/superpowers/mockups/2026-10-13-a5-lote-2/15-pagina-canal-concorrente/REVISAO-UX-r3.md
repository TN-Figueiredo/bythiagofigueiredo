# Revisão de UX, rodada 3: mockup 15, página do canal de concorrente

Revisor: revisor-ux-senior. Data: 13/10/2026. Escopo: conferir só se B1, B2 e C1 a C4 da r2 foram resolvidos e se o ajuste criou defeito novo. Método: Chromium headless sobre file:// e servidor estático próprio nas portas 47731 a 47736 (derrubados ao terminar; nada na 3099, sem specs do projeto). 12 estados x 4 combinações (1440 escuro, 390 claro, 1440 claro, 390 escuro) = 48 cruzamentos medidos; recortes por seção lidos nos 12 estados a 390 px (cabeçalho) e nos estados que a r3 mexeu. Capturas das evidências: shots/r3rev-vazio-direcao-1440-escuro.png, r3rev-erro-ritmo-1440-escuro.png, r3rev-vazio-tempo-1440-escuro.png, r3rev-fora-ritmo-1440-escuro.png.

## Resumo
Veredito geral: NÃO PODE ir ao dono. 2 bloqueios novos, 2 correções, 5 melhorias.
Pergunta do usuário: "este canal está subindo, parado ou caindo, e o último vídeo dele foi acima do normal?". Respondida no primeiro olhar nos 12 estados (símbolo mais pastilha na frase do topo, que termina no último vídeo; seis células embaixo). Passa.
Os 2 bloqueios da r2 foram resolvidos, mas o conserto de B1 e a unificação das barras deixaram dois números que contradizem o que está logo ao lado, a mesma classe de erro das rodadas anteriores:
1. Barra de 180 dias do canal recém-cadastrado conta desde 03/10 em vez do cadastro.
2. No estado Erro, "0 dias até 04/10" convive com "intervalo aberto de 20 dias" (dois relógios com nomes parecidos).
3. A conta "4 × o intervalo típico" mostrada na tela não fecha com o limite ao lado (4 x 3 = 12 e a tela diz 28; 4 x 10 = 40 e a tela diz 38).

## Conferência da r2
- B1 maior buraco: RESOLVIDO, com efeito colateral (ver B2 novo). Regra conferida nos 12 estados (maior buraco >= dias desde o último longo e >= 7 x maior fileira de semanas em zero): parado 64 (>= 63), zero 27 (>= 21), magro 25 (>= 21), fora 28 (>= 21), erro 20 (>= 14), extremo 20, cheio 18, nichos 13, shorts 4. Rótulo "Maior buraco entre longos (26 semanas)" e frase "sem publicar um longo" corretos; "Short" em canal só de Shorts.
- B2 "N de M semanas": RESOLVIDO. vazio "2 de 5 semanas com leitura" (grade: 2,0,0,0,2 = 2 com publicação), erro "5 de 11" (2+3+1+2+2), magro "6 de 13", zero "7 de 13", parado "4 de 13", fora "8 de 13", cheio "11 de 13": todos batem com as casas desenhadas. Taxa por semana confere (magro 12/13 = 0,9; zero 9/13 = 0,7).
- C1 barras: RESOLVIDO para 56 e 112 dias (nm 26 de 56, faltam 30, 12/11; 26 de 112, 07/01/2027; vazio 2 de 56, faltam 54, 06/12; 2 de 112, 31/01/2027; todas as datas recalculadas à mão). NÃO resolvido para a de 180 dias (B1 novo). Texto "desde 18/09, o cadastro do canal" / "desde a mudança de contagem de 24/08" correto.
- C2 (390 px, rótulo espremido a 78 px no magro): RESOLVIDO. A legenda "ou menos, fora da escala" desceu; o rótulo fica em uma linha de título e duas de descrição (captura lida).
- C3 aria: RESOLVIDO. Varredura de aria-label nos 12 estados: zero ocorrências de "1 dias", "undefined", "NaN"; vazio diz "vídeos buscados: 12 de 48".
- C4 zero: RESOLVIDO ("1 publicação e 1 mudança de campo. Trocas: [pastilha]").
- M1, M2, M3, M4, M5, M7 da r2: feitos e conferidos. M6 (casas "n 0" no fim da curva): recusada pelo desenhista como decisão de produto; aceito, não bloqueia.

## Bloqueios (impedem ir ao dono)

### B1. vazio: a barra "leitura justa" conta dias de um canal que ainda não estava na lista
- Tela/estado: Direção, `vazio` (recém-cadastrado, 12/10), 1440 e 390. Captura: shots/r3rev-vazio-direcao-1440-escuro.png.
- O que está errado: no mesmo bloco, o mesmo canal diz "2 de 56 dias" (Views do canal inteiro) e "2 de 112 dias desde 12/10, o cadastro do canal" (Queda sustentada), mas "Vídeos novos, leitura justa: 11 de 180 dias... passa a existir em 31/03/2027". São 3 barras no mesmo bloco com 2 e 11 dias de registro. A contagem por vídeo de um canal cadastrado em 12/10 não pode ter começado em 03/10. Causa: pc-dados.js linha 111 usa D.INICIO (03/10, início global) para todo canal, enquanto as outras duas barras usam max(cadastro, ...), a regra que o próprio NOTAS.md linha 76 escreve ("dias de registro desde max(cadastro, ...)"). Em nm (cadastro 18/09, anterior a 03/10) o número 11 está certo por acaso.
- Conserto exato: início da barra de 180 dias = max(cadastro do canal, 03/10/2026). No `vazio`: "2 de 180 dias" e "passa a existir em 09/04/2027" (12/10 + 179). Em nm, magro, parado etc. nada muda (cadastro anterior a 03/10). A dúvida que o desenhista levou ao dono (31/03 contra 01/04) segue valendo só para canais cadastrados antes de 03/10.

### B2. erro: "0 dias até 04/10" e "intervalo aberto de 20 dias" no mesmo bloco
- Tela/estado: Ritmo, `erro`, 1440 e 390. Captura: shots/r3rev-erro-ritmo-1440-escuro.png.
- O que está errado: a frase diz "O maior intervalo sem publicar um longo, em 26 semanas, é o que ainda está aberto: 20 dias", o cartão diz "20 dias, 14/09 até 04/10, ainda aberto", e o ponteiro logo acima diz "Dias desde o último vídeo: 0 dias, até 04/10". Quem lê vê um canal que publicou no último dia e, ao mesmo tempo, um buraco "ainda aberto". A causa é de duas bases com nomes quase iguais: o ponteiro conta o último vídeo de qualquer formato (um Short em 04/10; a grade de Shorts mostra 1 na última semana medida), o buraco conta só longos. A r2 pediu que o buraco usasse só o formato principal (conserto certo), mas faltou o ponteiro dizer a mesma coisa; só o `erro` expõe a diferença (nos outros estados o último vídeo é também o último longo ou os dois relógios ficam longe do limite).
- Conserto exato: (a) rótulo do ponteiro "Dias desde o último vídeo (longo ou Short)" quando o canal tem os dois formatos; (b) quando os dois relógios diferem, a frase e o cartão trocam "ainda aberto" por "sem longo desde 14/09": "O maior intervalo sem publicar um longo, em 26 semanas, é o que começou em 14/09 e ainda não acabou: 20 dias, até 04/10." Verificar depois os 12 estados com a regra "relógio do ponteiro <= relógio do buraco aberto, ou os dois rotulados".

## Correções (vão ao dono só depois de corrigidas)

### C1. A conta "4 × o intervalo típico" mostrada na tela não fecha com o limite
- Evidência (texto renderizado): magro "vira parado depois de 28 dias (4 × o intervalo típico, 3)" (4 x 3 = 12); zero "28 dias (4 × ..., 6)" (24); parado "28 dias (4 × ..., 5)" (20); shorts "28 dias (4 × ..., 1)" (4); fora "38 dias (4 × o intervalo típico, 10)" (4 x 10 = 40; o valor exato deve ser 9,5, arredondado na tela). A regra de M8 é o maior entre 28 e 4 x a mediana, e o ⓘ diz isso certo; a linha curta da tela contradiz a conta que o leitor faz de cabeça. Está sob o ponteiro de "parado", o número que a pergunta do dono mais usa.
- Conserto: tirar o parêntese da linha ("vira parado depois de 28 dias") e deixar a regra no ⓘ; ou, se o dono quiser ver a conta, escrever "o maior entre 28 dias e 4 × 6 = 24" e só mostrar o parêntese quando 4 x intervalo supera 28 (fora: "4 × 9,5 = 38").

### C2. vazio, Linha do tempo: "2 dias de registro... Nesse tempo: 4 publicações"
- Evidência: shots/r3rev-vazio-tempo-1440-escuro.png e texto: "3,39 mil views ganhas em 2 dias de registro (...). Nesse tempo: 4 publicações." Dentro dos 2 dias há 1 ponto de publicação; os outros 3 são anteriores a 12/10. No nm, a mesma frase conta só dentro do registro ("26 dias... 1 publicação"), então a regra mudou de um estado para o outro.
- Conserto: "Nos últimos 28 dias o canal publicou 4 vídeos (3 antes de entrar na lista)." ou usar a regra do nm (1 publicação).

## Melhorias (não bloqueiam)
- M1. Parêntese de "vazio" e "nm": a barra "faltam N dias" e o rótulo "não medido" repetem a data em três lugares (frase, pastilha, barra); a frase basta.
- M2. cheio/leitura: "Subindo +18%" com "5,4 mi contra 4,6 mi" dá 17,4%; já declarado como S9 pelo desenhista, vale conferir pelos valores exatos na implementação.
- M3. S3 (raia de publicações agrupada por semana a 390 px) segue em aberto, declarado.
- M4. No estado Erro, a pastilha "não confirmado" no Estado e a faixa de erro dizem a data duas vezes; aceitável (aviso e estado), mas a célula poderia dizer só "desde 04/10".
- M5. Estado de carregamento não existe (mockup estático, declarado na r1).

## Veredito por estado e largura
Nenhum estado reprovado. "Pronto" vale para o que o estado mostra; todos dependem do C1 (texto do ponteiro, global).

| Estado | 1440 escuro | 390 claro | Veredito | Pendências |
|---|---|---|---|---|
| magro (padrão, caso real) | ok | ok (C2 da r2 resolvido) | pronto depois de C1 | C1 |
| cheio | ok | ok | pronto depois de C1 | C1 |
| extremo | ok | ok | pronto depois de C1 | C1 |
| parado | ok | ok | pronto depois de C1 | C1 |
| zero medido | ok | ok | pronto depois de C1 | C1 |
| não medido (nm) | ok | ok | pronto | nenhuma |
| erro | contradição | contradição | volta para ajuste | B2, C1 |
| sem dado (vazio) | contradição | contradição | volta para ajuste | B1, C2 |
| fora do ar | ok | ok | pronto depois de C1 | C1 (38 x 40) |
| só Shorts | ok | ok | pronto depois de C1 | C1 |
| nichos diferentes | ok | ok | pronto | nenhuma |
| só leitura | ok | ok | pronto | nenhuma |

Resumo: 7 estados prontos (3 sem pendência, 4 após C1), 2 voltam para ajuste (erro, vazio), 0 reprovados. Tema claro a 1440 e escuro a 390 foram medidos (rolagem, fontes, alvos, contraste) e não mudam o veredito.

## Tabela de medidas
| Item | Resultado | Como medi |
|---|---|---|
| Rolagem horizontal, 12 estados x 4 combinações | 0 px em 48 de 48 | scrollWidth - clientWidth |
| Texto menor que 12 px | 0 | font-size computado |
| Alvos abaixo de 44 x 44 px a 390 px (toque) | 0 em 24 de 24 (só a barra do mockup, fora da tela) | getBoundingClientRect em links, botões, summary |
| Alvos a 1440 (ponteiro fino) | 8 a 10 elementos abaixo de 44: link "Canais" 41x20, @handle 26 px de altura, botões "Comparar" e atalhos 34 px; aceitos nas r1 e r2 | idem |
| Contraste de texto, 7 estados x 4 combinações (magro, zero, erro, vazio, parado, cheio, fora) | nenhum texto abaixo de 4,5:1 (contra o fundo efetivo, com alfa composto) | cálculo WCAG sobre getComputedStyle |
| Contraste gráfico, escuro | barra laranja 6,72:1; borda de zero medido 4,97:1; eixos 6,18:1; marcador de publicação 14,48:1; traço do normal 11,88:1 | cálculo sobre fill/stroke/border |
| Contraste gráfico, claro | barra 4,94:1; borda de zero medido 4,84:1; eixos 7,13:1; marcador 15,76:1; traço do normal 8,32:1 | idem |
| Foco por Tab | 0 paradas sem anel (outline de 2 px ou sombra) em 12 de 12 estados (36 a 42 paradas por estado) | Tab real |
| Esc no ⓘ | fecha, aria-expanded volta a false e o foco volta ao botão (Direção e Ritmo; zero 1440, vazio 390, magro 390) | teclado real |
| Estrutura | 1 h1 por estado; 0 role=img sem aria-label; 0 botões ou links sem nome | DOM |
| aria e texto com "1 dias", "undefined", "NaN" | 0 nos 12 estados | varredura |
| Jargão na tela (lido, gravou, diário, série, retenção, snapshot, mediana, payload, pipeline, cron) | 0 nos 12 estados (fora da referência do mockup e dos ⓘ) | texto renderizado |
| color-mix() | 0 em CSS e JS que carregam interface; só 5 comentários dizendo "sem color-mix()" | grep |
| Escala de cinza (vazio, parado) | casa não medida ("—" hachurada) separa-se de zero medido (caixa vazada com 0); ‖ e posição passando do tique de 28 dias leem-se sem cor | captura convertida |
| Contas | listadas em "Conferência da r2" | cálculo manual sobre texto e grade |

## O que NÃO consegui verificar
- Leitor de tela (VoiceOver, NVDA): só li aria-label e a estrutura de títulos.
- Safari, Firefox e Opera (o navegador do dono renderiza color-mix() transparente; confirmei só a ausência no código). Só Chromium.
- Toque real em aparelho (simulei hasTouch com viewport de 390 px).
- Fontes do Google (Fraunces, Inter, JetBrains Mono) ficam bloqueadas na captura; larguras e quebras reais podem variar alguns pixels.
- Contraste do texto "não medido" sobre a hachura (medi sobre o fundo plano; a hachura reduz um pouco; nas capturas lê-se bem).
- Seções fora do que a r3 mexeu nos estados shorts, nichos, leitura e extremo foram lidas só em parte (cabeçalho a 390 em todos; Direção do extremo, Criador de leitura e cheio, Ritmo de todos por texto e regra; não reabri a Linha do tempo e Lançamentos desses quatro).
- Série simulada contra a definição de M2, M3 e M6 do spec linha a linha.

## Para quem desenhou
Devolve para a rodada 4 com B1, B2, C1 e C2 resolvidos. A reconferência é rápida: abro `?caso=vazio` (barra de 180 dias e frase da Linha do tempo), `erro` (ponteiro e frase do Ritmo), `fora` (38 contra 40) e uma passada de texto pelos 12 estados na linha "vira parado". As melhorias ficam para o dono decidir. Se discordar de B2 achando que o ponteiro deve ficar em "último vídeo, qualquer formato" sem rótulo, responda com a frase que deixa "0 dias até 04/10" e "intervalo aberto de 20 dias" na mesma tela sem parecer contradição, e eu mantenho ou retiro por escrito.