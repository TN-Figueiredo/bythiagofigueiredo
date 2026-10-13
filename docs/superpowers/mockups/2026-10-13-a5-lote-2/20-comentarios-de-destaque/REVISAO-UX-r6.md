# Revisão de UX, rodada 6: mockup 20, Comentários de destaque do vídeo de concorrente

Revisor: engenheiro sênior de UX. Data: 13/10/2026. Escopo: conferir se o B1, o C1 e o C2 da r5 foram resolvidos de verdade, se o ajuste criou defeito novo, e fazer eu mesmo a varredura de coerência dos números de exemplo em todos os estados.

Método: servidores estáticos próprios nas portas 47751 a 47757 (a 3099 e os specs do projeto não foram tocados; todos derrubados ao fim). Extraí o texto visível, os `aria-label`, os `details` e os `popover` de 22 combinações de estado e aba (os 16 estados, mais as abas de 1 dia de típico, extremo, completo, zero, não coletado e só leitura). Abri os dados (`c20-dados.js`) e conferi cada linha contra a tela. Cliquei as três abas, a volta à aba de 1 dia, "Mostrar os outros" e o Tab seguinte em típico, completo e novo: 0 erros de console (a única falha é a fonte do Google, que a captura bloqueia de propósito). Medi contraste de texto (cor composta sobre o fundo composto, lida do estilo computado), fonte, rolagem e alvo de toque nos 17 estados em 1440 escuro e em 390 claro (34 cruzamentos, com os "Ver os 3 que saíram" abertos). Olhei as capturas do vídeo pequeno (1440 escuro e 390 claro), do canal "fecha" (1440), do canal "não medido" (390) e do cartão do bloqueio. Evidência desta rodada: `shots/r6/`.

## Veredito: NAO_PODE. 1 bloqueio e 1 "corrige". Os três itens da r5 estão resolvidos.

O B1 (curtidas de quem saiu), o C1 ("20 mais curtidos" num vídeo de 16) e a maior parte do C2 estão resolvidos de verdade e não criaram defeito visual nem de número. A varredura nova achou, na mesma classe de erro (o exemplo desmente a própria mensagem do estado), uma contradição que nenhuma rodada pegou porque nenhuma auditoria olha texto de resposta: no estado "Só leitura: com o texto, sem o nome", o cartão diz "Um espectador" e a resposta do criador, logo abaixo, chama a pessoa pelo primeiro nome.

## Os itens da r5, um a um

| r5 | Situação | Evidência |
|---|---|---|
| B1, quem saiu dos 12 tinha mais curtidas que quem ficou (vídeo pequeno) | **Resolvido** | "Ver os 3 que saíram dos 12" (7 dias): "2 curtidas no dia 1 · Rafa Souza", "2 ... Tati Moura", "1 curtida no dia 1 · Léo Campos". Menor "Mais curtido" que ficou aos 7 dias: Yuki, 3. 2, 2 e 1 são menores ou iguais a 3. A aba de 1 dia ordena 13, 12, 10, 9, 6, 6, 4, 3, 2, 2, 2, 1 (decrescente) e o menor "Mais curtido" do dia 1 que não saiu é Yuki, 3: fecha. Singular "1 curtida" certo. Típico e extremo seguem com 10, 7 e 5 contra o piso de 22: fecha. Captura: `shots/r6/r6-completo-sairam-1440-escuro.png`, e `shots/20-completo-1440-escuro.png`. |
| C1, "20 mais curtidos" num vídeo de no máximo 16 principais | **Resolvido** | Vídeo pequeno, 7 e 1 dia: "nenhum canal grande entre os comentários do vídeo" (16 e 13 principais). Vídeo novo (71 menos 37 = 34 principais), típico e extremo mantêm "20 mais curtidos" ou "19 que deu para medir". O ⓘ não mudou, certo (regra geral). |
| C2, NOTAS com números que a tela já não mostra | **Resolvido em parte** | As quatro linhas pedidas foram corrigidas (41 e 13, "desde hoje (13/10)" na seção 1, 34 capturas, linha nova da tabela). Mas sobraram frases do canal e uma da pastilha que a tela já não diz: ver C1 abaixo. |
| Sugestão 1 da r5 ("sábado" da Carla) | **Feita** | "Fui na terceira barraca hoje cedo", comentário de 07/10, vídeo de 06/10. |
| Sugestão 4 da r5 (11 sem retrato) | **Feita** | "11 sem retrato de 30 dias (o motivo de cada um está na página do vídeo)". |

## Bloqueio

### B1. "Só leitura: com o texto, sem o nome": a resposta do criador diz o nome que o cartão esconde (`?caso=leitura-privado`, 1440 e 390; vale também para `?caso=extremo` e `?caso=tipico` fora da tela de leitura)

Captura: `shots/r6/r6-leitura-privado-cartao-4-1440-escuro.png`.

- O estado existe para mostrar uma promessa: a faixa do topo diz "**Você vê o texto, mas não o nome nem a foto** de quem comentou", e cada autor vira "Um espectador". No cartão 4 de 12, o autor é "Um espectador" e, três linhas abaixo, "Leo respondeu: Está sim, **Marcos**. Entrei em setembro...". O cartão 12 diz "Obrigado pelo detalhe, **Carla**"; o cartão 7 do vídeo novo, "Vá de manhã, **Priya**". Quem lê o estado confere exatamente isto, e a tela falha no teste que ela mesma propõe.
- Mesma classe de erro das rodadas anteriores ("5 das 3 respostas", "7 de 7 medidos" sobre "não medido"): dois pontos da mesma tela que não podem ser verdade ao mesmo tempo. Não é número, é nome, e a auditoria só compara número.
- Onde está: sete respostas do criador citam o autor pelo primeiro nome. Em `c20-dados.js`: `T.respVisto` ("Está sim, Marcos."), a resposta do cartão 12 do típico (`re: 'Obrigado pelo detalhe, Carla. ...'`), `T.phoR2` ("Ainda é o local, Priya."), `T.phoR3` ("Obrigado pelo aviso, Carla."), `T.hueR` ("O terceiro, Marcos:"), `T.hueR2` ("Vá de manhã, Priya,") e `T.hueR3` ("Precisa da internacional, Carla."). `leitura-privado` usa `D.extremo`, que copia `D.tipico`; por isso o vazamento aparece lá. A nota 9.1, item 4, da NOTAS celebra que "nomes citados nas respostas batem com o autor": essa conferência é a origem.

Correção exata: tirar o vocativo das sete respostas, sem mexer em mais nada. "Está sim. Entrei em setembro...", "Obrigado pelo detalhe. Vou fixar este comentário...", "Ainda é o local. Nas barracas de turista...", "Obrigado pelo aviso. Vou fixar o seu comentário...", "O terceiro: reservei o trem...", "Vá de manhã, antes das nove: ...", "Precisa da internacional. Sem ela...". Ensinar a auditoria (`shots/auditoria-r5.mjs` e `C20_AUDITORIA`) a falhar se, em `leitura-privado` e `leitura`, qualquer nome próprio de `D.tipico` (Marina, Jess, Marcos, Beto, Valentina, Priya, Diego, Omar, Yuki, Carla, Rafa, Tati, Léo) aparecer no texto visível fora do "criador" (nome de canal acompanhado, como "Nômade Raiz", é permitido: a regra diz que o nome dele fica). Depois, trocar a conferência de "nomes batem" na NOTAS 9.1 item 4.

## Corrige (vai ao dono só depois)

### C1. NOTAS.md descreve frases e números do canal que a tela já não mostra

A seção 2 ("Tabela de frases da tela (texto exato)") e a seção 1 foram feitas antes das r4 e r5 e não foram refeitas. O dono lê a NOTAS ao lado da tela; cada linha abaixo contradiz a captura.

| Onde na NOTAS | Diz | A tela diz |
|---|---|---|
| Seção 1, item 13 | "fecha em dd/mm: 12 vídeos anteriores à coleta em hachura e **2** pontilhados" | 4 pontilhados ("4 esperando os 30 dias (05/11 e 09/11)") |
| Seção 2, linha "M11 (canal)" | "Só **2 dos 14** vídeos dos últimos 90 dias têm coleta de comentários" | "Só **4 dos 16** vídeos dos últimos 90 dias têm coleta de comentários, e o primeiro retrato de 30 dias fecha em 05/11" |
| Seção 2, linha "M11, legenda" | "**2** esperando os 30 dias (05/11 e 09/11)" e "11 sem retrato de 30 dias: coleta falhou ou veio tarde" | "4 esperando..." e "11 sem retrato de 30 dias (o motivo de cada um está na página do vídeo)" |
| Seção 2, linha "Lista do canal" | "Leo respondeu a 6 comentários guardados, em 5 vídeos" e "(14 nos outros dois)" | "...em 5 vídeos **com retrato de 30 dias**"; o cabeçalho do canal diz 17, 16 (fecha) e 14 (não medido): "14 nos outros dois" é falso |
| Seção 2, linha "Saiu do YouTube" | "Não veio mais do YouTube **desde 13/10**" | "desde **hoje (13/10)**" (a seção 1, item 12, já está certa; a 2 não) |
| Seção 2, linha "Lista do canal", exemplo "fecha" | não diz que o estado tem lista de 9 comentários em 3 vídeos | "Leo respondeu a 9 comentários guardados, em 3 vídeos" |

Correção: refazer essas seis linhas a partir da extração do DOM (a mesma que a auditoria usa), e acrescentar à tabela de coerência da seção 9.2 a linha "Só leitura, com o texto: nenhuma resposta do criador cita o nome do autor" quando o B1 for resolvido.

## Sugestões (não bloqueiam)

1. **"12 de todos os 28 comentários do vídeo" ao lado de "37 comentários" no cabeçalho (vídeo pequeno, aba de 1 dia).** Os dois números fecham (28 era o total no dia 1, 37 é o de hoje; o `aria-label` e o ⓘ explicam), mas a barra "12 de 28 (todos)" não diz "no dia 1" e a frase diz "todos os 28 comentários do vídeo" a poucos centímetros de "37". Se o dono estranhar: "12 de todos os 28 que o vídeo tinha com 1 dia".
2. **"Mais curtido" com 1 e 2 curtidas (vídeo pequeno, aba de 1 dia).** Léo Campos (1 curtida) e Rafa e Tati (2) levam a etiqueta "Mais curtido". Fecha com a regra (com 13 comentários principais, 12 são guardados), mas a etiqueta soa a sucesso. Aceitável; se incomodar, a etiqueta pode ser "Entre os mais curtidos".
3. **O mesmo trio comenta em todos os vídeos no mesmo dia.** Na lista do canal "fecha", Priya, Marcos e Carla aparecem em Mochilão, Pho e Hué, e o criador responde a eles pelo nome em cada um. Não é contradição de dado, mas o dono que lê a lista vê três fãs repetidos em três vídeos; trocar os nomes de Pho e Hué por outros três dá variedade sem custo (e, resolvido o B1, os nomes saem das respostas de qualquer forma).
4. **Textos de exemplo que não combinam com o vídeo:** "Morei 3 meses em Hanói e o item 3" sob o vídeo de Hué; "Subscribed after the Ha Giang loop part" sob Pho e Hué. Sem número envolvido; só aparecem na leitura de quem lê o comentário inteiro.
5. **Referência fora da tela com jargão:** a tabela "Os quatro estados sem comentário, lado a lado" usa "erro commentsDisabled" na coluna "Quando". Está fora da tela simulada e a NOTAS já diz que o implementador não copia a tabela; trocar por "o canal desligou os comentários" evita o dono ler o código.
6. **Casa vazia, textos de duas linhas e altura de 9.200 px a 390 px:** sem mudança desde a r3.

## Varredura de coerência feita por mim (todos os estados; tudo o que achei)

ok = fecha com os outros números da mesma tela e com os dados de exemplo.

| Estado | Número ou frase na tela | Conferência | Resultado |
|---|---|---|---|
| Típico, 7 dias | "12 dos 100", barra 12% (11,95% medido), 12 casas, aba "12 guardados" | 12 cartões; 12 menor que 100 | ok |
| Típico | "8 mais curtidos e 4 com o criador (ele respondeu a 3)" | c = 8 (1, 3, 5, 6, 8, 9, 10, 11), k = 4 (Leo, Marcos, Priya, Carla), 3 faixas de resposta | ok |
| Típico | "3 entraram · 3 saíram", ordem por curtidas | Jess, Priya, Omar (11/10, 11/10, 12/10) entraram; 411, 154, 90, 87, 64, 51, 39, 30, 28, 24, 22, 19 decrescente; 10, 7, 5 abaixo do piso de 22 | ok |
| Típico | "19 que deu para medir" + "1 autor com inscritos ocultos" | 19 + 1 = 20 | ok |
| Típico | "identidade guardada até" 04/11 e 10/11 | 07/10 + 28; 13/10 + 28 | ok |
| Aba de 1 dia, típico | "9 mais curtidos e 3 com o criador (ele respondeu a 2)", ordem 112 a 4 | 9 + 3 = 12; Priya (11/10) não está; os 3 que saíram dentro dos 9 | ok |
| Extremo, 7 dias | 6 + 4 + 1 + 1 = 12; "1 de canal grande, entre os 20 mais curtidos"; "mais de 1.000 vezes" | canal grande em 90 curtidas (3º), entrou em 11/10; 10 mi dividido por 6,2 mil = 1.612 | ok |
| Extremo, 1 dia | 8 + 3 + 1 = 12, "nenhum canal grande entre os 20 mais curtidos", Nômade Raiz com 9 curtidas | canal grande só existe a partir de 11/10 | ok |
| Vídeo pequeno, 7 dias | "12 de todos os 37"; barra 32% (31,8% medido); "Ver os 3 que saíram": 2, 2, 1 | 12 + 21 respostas + 3 que saíram = 36 menor ou igual a 37; total = cabeçalho; saíram menor ou igual ao piso 3 | ok (B1 da r5 resolvido) |
| Vídeo pequeno, 7 dias | legenda "nenhum canal grande entre os comentários do vídeo" | 37 menos 21 = 16 principais, menor que 20 | ok (C1 da r5 resolvido) |
| Vídeo pequeno, 1 dia | "12 de todos os 28"; barra 43%; "9 mais curtidos e 3 com o criador (ele respondeu a 2)" | 37 menos 3 comentários posteriores a 07/10 menos 6 respostas deles = 28; 28 maior que 12 + 15; 13 principais | ok |
| Vídeo pequeno | "Não vimos" em todos os de 1 a 3 respostas; "Não sabemos" ausente | 3 menor que 5 | ok |
| Vídeo novo, 1 dia | "12 de todos os 71"; barra 17%; "ele respondeu a 3"; "fecha em 17/10 e 09/11"; ident. até 08/11 | 92 menos 21 = 71; 49 menor ou igual a 71 menor ou igual a 92; 34 principais maior que 20; datas 10/10 e 11/10; 10/10 + 7 e + 30; 11/10 + 28 | ok |
| Zero medido | cabeçalho "0 comentários", 412 views, 9 curtidas; "em 07/10" (1 dia) e "em 13/10" (7 dias) | data = dia do retrato; "Com 1 dia" no singular | ok |
| Desligados | cabeçalho "comentários: não medido" | não é zero nem número | ok |
| Não coletado | "1.240" na frase; "descobrimos com 4 dias" = 10/10; "até 16/10" | igual ao cabeçalho; 06/10 + 4; 06/10 + 10 | ok |
| Antes da coleta | "há 54 dias" (20/08 a 13/10); "47 dias" (20/08 a 06/10) | 31 + 23 = 54; 31 + 16 = 47; 47 maior que 30 | ok |
| Carregando e erro | sem número de comentário | cabeçalho do vídeo igual ao típico | ok |
| Só leitura, sem texto | mesmos números do típico; lista dos que saíram: "Texto reservado" | respostas "o texto da resposta é reservado" | ok |
| **Só leitura, com texto, sem nome** | "Um espectador" no cartão 4, 12 | resposta do criador: "Está sim, **Marcos**", "..., **Carla**" | **B1** |
| Canal, com dado (12/01/2027) | "5 de 14 (36%)", "3 recentes", "17 vídeos"; 5 + 9 + 3 | 5/14 = 35,7%; vídeos de 17/10 a 08/01 dentro de 90 dias de 12/01 (desde 14/10); 30 dias fechados menos nos 3 recentes; sem dia de publicação repetido | ok |
| Canal, com dado | "6 comentários, em 5 vídeos"; curtidas aos 7 dias; datas | 24/11 (vídeo de 20/11), 15/11 (12/11), 09/11 (05/11), 01/11 (28/10), 20/10 (17/10): todas entre o dia do vídeo e 7 dias depois; ordem decrescente | ok |
| Canal, fecha (13/10) | "4 dos 16", "12 anteriores", "(05/11 e 09/11)", cabeçalho "16 vídeos" | 12 + 4 = 16 casas; 06/10 + 30 = 05/11 (3 vídeos); 10/10 + 30 = 09/11; o mais antigo, 18/07, é posterior a 15/07 (90 dias) | ok |
| Canal, fecha | "9 comentários, em 3 vídeos"; "no dia 1" (Hué: 4, 8, 2); "aos 7 dias" (Mochilão 39, 87, 19; Pho 7, 10, 2) | 3 + 3 + 3 = "ele respondeu a N" de cada página; datas e curtidas iguais às dos cartões; ordem por data, vídeo mais novo, curtidas | ok |
| Canal, não medido | "3 dos 14", 2 + 1 + 11, "mínimo 5", "3 comentários, em 2 vídeos" | 2 casas azuis = 2 vídeos; 3 menor que 5; casas totais 14 | ok |
| ⓘ da seção e do canal grande | "até 4 com o criador, até 2 de autor de destaque"; "20 comentários mais curtidos"; "até 3 respostas do criador por comentário" | extremo = 4 + 2; nenhum cartão mostra mais de 1 resposta do criador | ok |
| Texto de interface | "lido", "série", "snapshot", "retenção", "CTR", "diário", "payload", "N curtidas/respostas/comentários/vídeos/dias/autores" com N = 1 | 0 ocorrências no texto e nos `aria-label` dos 22 estados e abas | ok |

## Veredito por estado e por largura

| Estado | 1440 escuro | 390 claro | Observação |
|---|---|---|---|
| Típico (abas 1, 7 e 30) | pronto | pronto | |
| Extremo | pronto | pronto | nome de canal acompanhado fica por regra; vocativo na resposta do criador (B1) |
| Vídeo pequeno (completo, abas 1 e 7) | pronto | pronto | B1 e C1 da r5 resolvidos |
| Aba de 1 dia (típico) | pronto | pronto | |
| Zero medido | pronto | pronto | |
| Desligados pelo canal | pronto | pronto | |
| Não coletado (2 motivos) | pronto | pronto | |
| Antes da coleta | pronto | pronto | |
| Vídeo novo | pronto | pronto | vocativo na resposta (sai junto com o B1) |
| Carregando | pronto | pronto | |
| Erro de leitura | pronto | pronto | |
| Só leitura, sem texto | pronto | pronto | |
| **Só leitura, com texto, sem nome** | **volta (B1)** | **volta (B1)** | a resposta do criador cita o nome do autor |
| Canal, M11 com dado | pronto | pronto | |
| Canal, M11 fecha em dd/mm | pronto | pronto | |
| Canal, M11 não medido | pronto | pronto | |
| NOTAS.md | | | volta (C1) |

Contagem: 15 de 16 estados prontos; 1 volta (só leitura com texto, sem nome). A NOTAS.md volta junto.

## A pergunta de quem abre

Página do vídeo: "O que o público destacou neste vídeo, e o criador respondeu quem?" Resposta no primeiro olhar a 1440 escuro: frase-resumo com números em negrito, barra "12 de N", fileira de 12 casas com cor e símbolo por motivo (polegar areia, microfone azul, olho violeta, alvo coral), legenda com zero medido (caixa com 0), não medido (hachura rosa) e "ainda não existe" (pontilhado). Página do canal: "Em quantos vídeos o criador responde?" Resposta no primeiro olhar: "5 de 14 (36%)" ou "Ainda não dá para medir", uma casa por vídeo (seta de resposta, caixa com 0, hachura, pontilhado), legenda com a contagem de cada forma. Método no ⓘ, com a frase fixa "Cálculo do Observatório sobre dados públicos do YouTube". Sem `color-mix()` fora de comentário.

## Tabela de medidas

| Elemento | Medido | Limite |
|---|---|---|
| Menor contraste de texto, 390 claro | 4,73:1 ("Competidores" da aba do Observatório, 13,5 px) | 4,5 |
| Menor contraste de texto, 1440 escuro | 4,78:1 ("respondeu", 12,5 px); nos estados sem lista 5,34:1 | 4,5 |
| Textos abaixo do limite de contraste | 0 nos 34 cruzamentos (as iniciais brancas dentro de avatares de gradiente escuro aparecem como 1,1:1 no meu cálculo porque o fundo é `linear-gradient`; o gradiente é hsl 30% e 20% de luminosidade e o texto é decorativo, `aria-hidden`; não conta) | 0 |
| Fonte abaixo de 12 px | 0 nos 34 cruzamentos | 0 |
| Rolagem horizontal da página | 0 px nos 34 cruzamentos | 0 |
| Alvos abaixo de 44 x 44 px a 390 px (ponteiro grosso), dentro da tela simulada | 0 nos 17 estados (os 19 menores de 44 px são todos os botões de 32 px da barra "Estados do mockup", que fica fora da tela simulada) | 44 |
| Altura a 1440 (típico / extremo / completo / completo 1 dia / novo / zero / erro / canal-fecha) | 5.706 / 5.748 / 5.534 / 5.130 / 5.272 / 2.032 / 1.982 / 2.985 px (com `?todos=1`) | |
| Altura a 390 (típico / extremo / completo / novo / canal-fecha) | 9.448 / 9.630 / 9.291 / 8.912 / 4.435 px (com `?todos=1`) | |
| Console | 0 erros ao trocar as três abas, voltar à de 1 dia e abrir "Mostrar os outros", em 3 estados | 0 |
| Barra "12 de N" (largura medida contra o texto) | 12/100 = 11,9%; 12/37 = 31,8%; 12/28 = 42,8%; 12/71 = 16,9% | iguais ao texto |

O CSS (`c20.css`, 13:11) não mudou desde a r4; mudaram só `c20.js` e `c20-dados.js`. A leitura de contraste, alvo e rolagem é de repetição; a de coerência é descoberta.

## O que não consegui verificar

- Leitor de tela: li só os atributos e os nomes acessíveis.
- Safari e Opera: só Chromium.
- Fontes reais (Inter, JetBrains Mono, Fraunces): a captura cai nas do sistema; a quebra de linha pode mudar um pouco.
- Escala de cinza: não refiz; nenhum símbolo ou forma de estado mudou desde a r2.
- Tema claro a 1440 e escuro a 390: não medi (os pares obrigatórios, sim).
- Ordem de foco completa e Home/End das abas: só confirmei que abas, "Mostrar os outros" e Tab respondem sem erro; a ordem não foi refeita (nada mudou nessas partes).
- Movimento reduzido: não medi.

## Arquivos

Nada fora da pasta do mockup 20 foi tocado e nada foi commitado. Gravei só este arquivo e duas capturas de evidência em `shots/r6/`. Meus scripts ficam no escopo temporário da sessão. Servidores estáticos derrubados ao fim.
