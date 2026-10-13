# Revisão de UX, rodada 5: mockup 20, Comentários de destaque do vídeo de concorrente

Revisor: engenheiro sênior de UX. Data: 13/10/2026. Escopo: conferir se o B1 e os C1 e C2 da r4 foram resolvidos de verdade, se o ajuste criou defeito novo, e fazer eu mesmo a varredura de coerência dos números de exemplo em todos os estados, de uma vez.

Método: servidores estáticos próprios nas portas 47731 a 47746 (a 3099 e os specs do projeto não foram tocados; todos derrubados ao fim). Extraí o texto visível, os `aria-label`, os `details` e os `popover` dos 16 estados (e das abas de 1, 7 e 30 dias, com `?todos=1`). Abri os dados de exemplo (`c20-dados.js`) num contexto isolado e conferi cada linha contra a tela. Cliquei as abas e o "Mostrar os outros" nos estados com dado (0 erros de console). Medi rolagem, fonte, alvo de toque e contraste de texto (cor composta sobre o fundo composto, lida do estilo computado) em 34 cruzamentos: 17 estados (os 16 mais a aba de 1 dia do lote completo) em 1440 escuro e 390 claro. Olhei as capturas do lote completo (1 e 7 dias, 1440 e 390), do vídeo novo (1440), do canal "fecha" (1440 e 390) e dos cartões abertos que sustentam o bloqueio. Capturas de evidência desta rodada: `shots/r5/`.

## Veredito: NAO_PODE. 1 bloqueio e 2 "corrige". Os três itens da r4 estão resolvidos.

O B1, o C1 e o C2 da r4 estão resolvidos de verdade (tabela abaixo) e não criaram defeito visual. O que sobra é a mesma classe de erro, numa variante que nem a auditoria nem a tabela de coerência cobrem: a relação entre as curtidas dos que **saíram** dos 12 e as dos que **ficaram**, que só existe no vídeo pequeno. Fora isso, desenho, cor, símbolo, layout, alvo, contraste e comportamento estão no nível: zero rolagem horizontal, zero fonte abaixo de 12 px, zero alvo abaixo de 44 px a 390 px, menor contraste de texto 4,73:1 (claro, "Competidores" do menu) e 4,78:1 (escuro, "respondeu").

## Os itens da r4, um a um

| r4 | Situação | Evidência |
|---|---|---|
| B1, canal "fecha em dd/mm" diz 1 vídeo e Hué tem 3 respostas | **Resolvido, e além do pedido** | `?caso=canal-fecha`: "Só 4 dos 16 vídeos", legenda "12 anteriores · 4 esperando (05/11 e 09/11)", lista "Leo respondeu a 9 comentários guardados, em 3 vídeos". Os 9 vêm de Mochilão (3), Pho (3) e Hué (3), por código. Cada item bate com o cartão da página do vídeo: Hué 4, 8 e 2 curtidas "no dia 1" (cartões 7, 4 e 12 de `?caso=novo`); Mochilão 39, 87 e 19 "aos 7 dias"; Pho 7, 10 e 2 "aos 7 dias" (cartões do `?caso=completo`). Ordem por data, depois vídeo mais novo, depois curtidas: confere item a item. Bastidores (0 comentários) não entra na lista e entra na conta dos 4 vídeos com coleta. |
| C1, aba de 1 dia afirma o total de hoje | **Resolvido** | Lote completo, 1 dia: "12 de todos os 28", barra "12 de 28 (todos)", `aria-label` e ⓘ com 28 (37 menos 3 comentários e 6 respostas posteriores a 07/10); a conta fecha: 28 é maior que 12 + 15 respostas dos que já existiam (27) e menor que 37. Vídeo novo, 1 dia: "12 de todos os 71" (92 menos 21 comentários de 12 e 13/10); 71 é maior que 12 + 37 respostas (49) e menor que 92. O cabeçalho do vídeo segue com o total de hoje (37 e 92). |
| C2, "1 curtidas" | **Resolvido** | Zero ocorrências de "1 curtidas / respostas / comentários / vídeos / dias / autores" no texto e nos `aria-label` dos 17 estados e abas. |
| Sugestões 1, 2, 4 e 5 da r4 | **Feitas** | Curtidas do vídeo pequeno ordenadas sem empate no piso (topo 41, 15, 11, 10, 9, 8, 7...); 20/08 em `D.CANAL_ANTES`; ⓘ "Como contamos os 12 de 37 comentários"; "Não veio mais do YouTube desde hoje (13/10)". |

## Bloqueio

### B1. Vídeo pequeno, 7 dias: quem "saiu dos 12" tinha mais curtidas do que quem ficou como "mais curtido" (`?caso=completo&idade=7`, 1440 e 390)

Capturas: `shots/r5/r5-completo-sairam-1440-escuro.png` (lista aberta) e `shots/r5/r5-completo-cartao-11-1440-escuro.png` (cartão 11). Mesma coisa em `shots/20-completo-1440-escuro.png` e `shots/20-completo-390-claro.png` (a lista vem fechada: abra "Ver os 3 que saíram dos 12").

- A lista dos que saíram diz: "Bom vídeo, continua assim!, **7** curtidas no dia 1 · Rafa Souza", "Primeiro!..., **5** curtidas no dia 1 · Tati Moura", "Tem desconto..., **3** curtidas no dia 1 · Léo Campos".
- Os cartões que ficaram como "Mais curtido" mostram, aos 7 dias: Diego 6, Omar Khalid 5, Vagas Online 4, Yuki Tanaka 3 (cartão 11, "11 de 12, Mais curtido, 3 curtidas"). A frase-resumo promete "8 mais curtidos"; quem tem 3 e 4 curtidas ficou e quem tinha 7 e 5 saiu.
- Curtida não costuma cair: no vídeo pequeno o dia 1 e o dia 7 quase não se distanciam (13 para 41 só no topo; Marcos 10 e 10, Beto 9 e 9, Diego 6 e 6, Yuki 3 e 3). Rafa, com 7 no dia 1, teria 7 ou mais no dia 7 e tomaria o lugar de Yuki, Vagas ou Omar. No vídeo típico o mesmo par não contradiz (saíram 10, 7 e 5; o menor "mais curtido" que ficou tem 22 aos 7 dias), por isso a auditoria não pegou.
- Origem: `ranqueia()` em `c20-dados.js` (linhas 102 a 119) reescala o dia 1 dos que saíram junto com o dos que ficaram (10, 7 e 5 viram 7, 5 e 3) e nada garante que fiquem abaixo do piso do dia 7.

Correção exata: em `c20-dados.js`, depois do bloco `ranqueia` do `D.completo`, calcular o piso por código e forçar os que saíram abaixo dele: `var piso = Math.min.apply(null, D.completo.filter(function(c){ return c.g === 'c'; }).map(function(c){ return c.l[1]; }));` (dá 3) e `D.saiuCompleto.forEach(function(s, k){ s.l1 = Math.max(1, piso - 1 - (k === 2 ? 1 : 0)); });` (dá 2, 2 e 1; a lista passa a dizer "2 curtidas no dia 1", "2 curtidas...", "1 curtida no dia 1", e o singular já é tratado). A ordem do dia 1 continua decrescente (Yuki 3, depois 2, 2, Carla 2, 1: confira que `listaDaIdade` ordena por curtidas do dia 1). Ensinar a auditoria (`shots/auditoria-r5.mjs`, hoje só confere "dia 1 menor ou igual ao dia 7") a conferir, em todo estado com "saíram": curtidas no dia 1 de cada um que saiu menores ou iguais à menor curtida aos 7 dias entre os "mais curtidos" que ficaram. No típico e no extremo isso fecha (10 contra 22); no completo hoje falha (7 contra 3).

## Corrige (vai ao dono só depois)

### C1. Lote completo: "nenhum canal grande entre os 20 mais curtidos" num vídeo que tem no máximo 16 comentários principais (`?caso=completo`, 7 e 1 dia)

- O vídeo tem 37 comentários no total; os 12 cartões somam 21 respostas, e os 3 que saíram contam mais 3 principais. Ficam 15 comentários principais conhecidos e no máximo 16 (37 menos 21). A legenda "nenhum canal grande entre os 20 mais curtidos" (e o zero medido "nenhum canal que você acompanha comentou") pressupõe 20 candidatos; só existem 15 ou 16. A frase afirma mais do que o dado sustenta, na mesma classe dos "5 das 3 respostas".
- Correção: quando `C.completo`, a linha vira "nenhum canal grande entre os comentários do vídeo" (trecho em `legenda()` de `c20.js`, linha 199, ramo `g` com `C.completo`). O ⓘ não muda ("só olhamos os 20 mais curtidos" continua regra geral).

### C2. NOTAS.md com números que a tela já não mostra

- A tabela de coerência (seção 7.2, linha "Lote completo | curtidas (29 no topo) | 7% do típico") e o item 2 da seção 7.1 ("29 no pequeno") dizem 29; a tela mostra 41 no topo do vídeo pequeno aos 7 dias e 13 no dia 1 (a r5 da NOTAS, seção 8, já diz 41). A seção 1, decisão 12, ainda diz "Não veio mais do YouTube desde 13/10"; a tela diz "desde hoje (13/10)". A seção 8.1 diz "32 capturas"; a pasta tem 34 (17 estados em dois cruzamentos).
- Correção: atualizar essas quatro linhas e acrescentar à tabela de coerência a linha que faltou e originou o B1: "Lote completo, 7 dias | 'Ver os 3 que saíram': 2, 2 e 1 curtida no dia 1 | `D.saiuCompleto` | cada uma menor ou igual à menor curtida aos 7 dias entre os mais curtidos que ficaram (3) | sim".

## Sugestões (não bloqueiam)

1. **Texto do comentário da Carla no Pho** ("Fui na terceira barraca no sábado e confirmo..."), publicado em 07/10 (quarta): o sábado é 03/10, antes de o vídeo existir (06/10). Troque por "Fui na terceira barraca hoje cedo" ou "ontem". Não é número, mas o dono lê a data ao lado do texto.
2. **Empates no "Mais curtido":** o vídeo pequeno no dia 1 repete 6 e 6 (Valentina e Diego) e o vídeo novo repete 2, 2 e 2 no fim. Aceitável; se for mexer em `ranqueia`, aplique a correção do B1 e deixe o `Math.min(l1, l7)` por último.
3. **"12 de 37 (todos)" mistura base:** os 12 são comentários principais e os 37 incluem respostas. Para o dono ler "12 de 37" como "um terço" é enganoso (guardamos todos os principais). Se quiser fechar: "12 de 15 principais, mais as respostas". Só vale se o dono estranhar.
4. **Estado "não medido" do canal:** "11 sem retrato de 30 dias: coleta falhou ou veio tarde" são 11 de 14 vídeos (79%). Pode soar como defeito grave do sistema. O motivo exato fica na página de cada vídeo; a legenda poderia dizer "sem retrato de 30 dias (o motivo está em cada vídeo)".
5. **Textos repetidos entre vídeos** (Marina "o item 4" no Pho, a planilha de custos na resposta do criador no Hué): sem mudança desde a r4, e a lista do canal já não os duplica.
6. **Casa vazia, textos de duas linhas e altura de 9.240 px a 390 px:** sem mudança desde a r3.

## Varredura de coerência feita por mim (todos os estados; tudo o que achei)

ok = fecha com os outros números da mesma tela e com os dados de exemplo.

| Estado | Número na tela | Conferência | Resultado |
|---|---|---|---|
| Típico, 7 dias | "12 dos 100", barra 12%, 12 casas, aba "12 guardados" | 12 cartões; 12 menor que 100 | ok |
| Típico | "8 mais curtidos e 4 com o criador (ele respondeu a 3)" | c = 8, k = 4 (Leo, Marcos, Priya, Carla), 3 faixas azuis | ok |
| Típico | "3 entraram · 3 saíram" | Jess, Priya, Omar (todos posteriores a 07/10) entraram; 12 menos 3 mais 3 = 12; lista com 3 | ok |
| Típico | "19 que deu para medir" + "1 inscrito oculto" | 19 + 1 = 20 | ok |
| Típico | curtidas 1 e 7 dias; ordem | decrescente aos 7 dias (411 a 19); 1 dia menor ou igual a 7 dias; nenhuma passa 1,9 mil; os que saíram (10, 7, 5) abaixo do piso de 22 | ok |
| Típico | respostas e "Não sabemos" | só com 62 (mais de 5); "Não vimos" com 1, 2 e 4; 109 + 12 menor que 1.240 | ok |
| Típico | "identidade guardada até" 04/11 e 10/11; "fecha em 05/11" | 07/10 + 28; 13/10 + 28; 06/10 + 30 | ok |
| Aba de 1 dia (típico) | "9 mais curtidos e 3 com o criador (ele respondeu a 2)" | 9 + 3 = 12; Marcos e Carla respondidos; Priya (11/10) fora; 3 que saíram dentro dos 9 | ok |
| Extremo | 6 + 4 + 1 + 1 = 12; "mais de 10 milhões", "mais de 1.000 vezes" | 10 mi dividido por 6,2 mil = 1.612 | ok |
| Extremo, 1 dia | 8 + 3 + 1 = 12, "nenhum canal grande" | canal grande só entrou em 11/10 (dia 7) | ok |
| Completo, 7 dias | "12 de todos os 37"; barra 32% | 12 + 21 respostas + 3 que saíram = 36 menor ou igual a 37; total = cabeçalho | ok |
| Completo, 7 dias | "Ver os 3 que saíram": 7, 5 e 3 curtidas | menor "mais curtido" que ficou tem 3 aos 7 dias | **B1** |
| Completo, 7 dias | legenda "20 mais curtidos" | no máximo 16 comentários principais | **C1** |
| Completo, 1 dia | "12 de todos os 28"; 9 + 3 | 28 entre 27 e 37; sem cartão posterior a 07/10 | ok |
| Completo | "Não vimos" em todos os de 3 respostas; "Não sabemos" ausente | 3 menor que 5 | ok |
| Vídeo novo, 1 dia | "12 de todos os 71"; "ele respondeu a 3"; 8 + 4 | 49 menor ou igual a 71 menor ou igual a 92; datas 10 e 11/10; "fecha em 17/10 e 09/11"; ident. até 08/11 | ok |
| Zero medido | cabeçalho "0 comentários", 412 views, 9 curtidas; "em 07/10" (1 dia) e "em 13/10" (7 dias) | data = dia do retrato | ok |
| Desligados | cabeçalho "comentários: não medido" | não é zero nem número | ok |
| Não coletado | "1.240" na frase; "descobrimos com 4 dias" = 10/10; "até 16/10" = 06/10 + 10 | igual ao cabeçalho; prazo de 3 dias | ok |
| Antes da coleta | "há 54 dias" (20/08 a 13/10); "47 dias" (20/08 a 06/10) | 47 maior que 30 | ok |
| Carregando e erro | sem número de comentário | cabeçalho do vídeo igual ao típico | ok |
| Só leitura, sem texto e com texto | mesmos números do típico e do extremo | "Texto reservado" também na lista dos que saíram | ok |
| Canal, com dado (12/01/2027) | "5 de 14 (36%)", "3 recentes", "17 vídeos"; 5 + 9 + 3 | 5/14 = 35,7%; vídeos de 15/10 a 08/01 (dentro de 90 dias de 12/01); 30 dias fechados menos nos 3 recentes (14/01 maior que 12/01) | ok |
| Canal, com dado | "6 comentários, em 5 vídeos" | 5 casas azuis; cada comentário entre o dia do vídeo e 7 dias depois; ordem decrescente | ok |
| Canal, fecha (13/10) | "4 dos 16", "12 anteriores", "(05/11 e 09/11)", "9 comentários, em 3 vídeos" | 12 + 4 = 16; 06/10 + 30, 10/10 + 30; 3 + 3 + 3 = "ele respondeu a N" de cada página; rótulos "no dia 1" (Hué) e "aos 7 dias" (os outros) | ok |
| Canal, não medido | "3 dos 14", 2 + 1 + 11, "mínimo 5", "3 comentários, em 2 vídeos" | 2 casas azuis = 2 vídeos | ok |
| Cruzamento de telas | texto de cada resposta do criador em Mochilão, Pho e Hué | nenhum repetido na lista; nomes citados na resposta batem com o autor ("Marcos", "Priya", "Carla") | ok |

## Veredito por estado e por largura

| Estado | 1440 escuro | 390 claro | Observação |
|---|---|---|---|
| Típico (abas 1, 7 e 30) | pronto | pronto | |
| Extremo | pronto | pronto | |
| Lote completo | **volta (B1, C1)** | **volta (B1, C1)** | saíram com mais curtidas que quem ficou; "20 mais curtidos" em vídeo de 16 |
| Aba de 1 dia (típico) | pronto | pronto | |
| Zero medido | pronto | pronto | |
| Desligados pelo canal | pronto | pronto | |
| Não coletado (2 motivos) | pronto | pronto | |
| Antes da coleta | pronto | pronto | |
| Vídeo novo | pronto | pronto | |
| Carregando | pronto | pronto | |
| Erro de leitura | pronto | pronto | |
| Só leitura, sem texto | pronto | pronto | |
| Só leitura, com texto sem nome | pronto | pronto | |
| Canal, M11 com dado | pronto | pronto | |
| Canal, M11 fecha em dd/mm | pronto | pronto | B1 da r4 resolvido |
| Canal, M11 não medido | pronto | pronto | |

Contagem: 15 de 16 estados prontos; 1 volta para ajuste (lote completo). A NOTAS.md volta junto (C2).

## A pergunta de quem abre

Página do vídeo: "O que o público destacou neste vídeo, e o criador respondeu quem?" Resposta no primeiro olhar a 1440 escuro: frase-resumo com números em negrito, barra "12 de N", fileira de 12 casas com cor e símbolo por motivo, legenda com zero medido (caixa com 0), não medido (hachura rosa) e "ainda não existe" (pontilhado). Página do canal: "Em quantos vídeos o criador responde?" Resposta no primeiro olhar: frase "5 de 14 (36%)" ou "Ainda não dá para medir", uma casa por vídeo (seta de resposta, caixa com 0, hachura, pontilhado), legenda com a contagem de cada forma. Método no ⓘ, com a frase fixa "Cálculo do Observatório sobre dados públicos do YouTube." Sem "lido", "série", "snapshot", "retenção", "diário" ou "CTR" na tela. Sem `color-mix()` fora de comentário (`grep` em `c20*`: só o comentário do cabeçalho do `c20.css`).

## Tabela de medidas

| Elemento | Medido | Limite |
|---|---|---|
| Menor contraste de texto, 390 claro | 4,73:1 ("Competidores" da aba do Observatório) | 4,5 |
| Menor contraste de texto, 1440 escuro | 4,78:1 ("respondeu" do cartão, 12,5 px); o resto 4,9 ou mais | 4,5 |
| Textos abaixo do limite de contraste | 0 nos 34 cruzamentos | 0 |
| Fonte abaixo de 12 px | 0 nos 34 cruzamentos | 0 |
| Rolagem horizontal da página | 0 px nos 34 cruzamentos | 0 |
| Alvos abaixo de 44 x 44 px a 390 px (ponteiro grosso) | 0 nos 17 estados | 44 |
| Altura a 1440 (típico / extremo / completo / novo / zero / erro / canal-fecha) | 5.517 / 5.559 / 5.345 / 5.272 / 2.032 / 1.982 / 2.985 px (com `?todos=1`) | |
| Altura a 390 (típico / extremo / completo / novo / canal-fecha) | 9.240 / 9.422 / 9.083 / 8.912 / 4.435 px (com `?todos=1`) | |
| Console | 0 erros ao trocar abas e abrir "Mostrar os outros" em 7 estados | 0 |
| Foco | anel de 2 px sólido `--accent`, herdado de `a4.css` | visível |

O CSS (`c20.css`, 13:11) não mudou desde a r4; mudaram só `c20.js` e `c20-dados.js`. Por isso a leitura de contraste e alvo é de repetição, não de descoberta.

## O que não consegui verificar

- Leitor de tela: li só os atributos e os nomes acessíveis.
- Safari e Opera: só Chromium.
- Fontes reais (Inter, JetBrains Mono, Fraunces): a captura cai nas do sistema; a quebra de linha pode mudar um pouco.
- Escala de cinza: não refiz; nenhum símbolo ou forma de estado mudou desde a r2.
- Tema claro a 1440 e escuro a 390: não medi (os pares obrigatórios, sim).
- Navegação por teclado completa, Home/End das abas e foco do "Mostrar os outros": só confirmei que as abas e o botão respondem ao clique sem erro de console; a ordem de foco não foi refeita (nada mudou nessas partes).
- Movimento reduzido: não medi.
- Dia da semana das datas de exemplo: só conferi à mão no comentário da sugestão 1; o resto não depende dele.

## Arquivos

Nada fora da pasta do mockup 20 foi tocado e nada foi commitado. Gravei só este arquivo e três capturas de evidência em `shots/r5/`. Meus scripts ficam no escopo temporário da sessão. Servidores estáticos derrubados ao fim.
