# Revisão de UX, rodada 4: mockup 20, Comentários de destaque do vídeo de concorrente

Revisor: engenheiro sênior de UX. Data: 13/10/2026. Escopo: conferir se os bloqueios da r3 foram resolvidos de verdade, se o ajuste criou defeito novo e fazer eu mesmo a varredura de coerência dos números de exemplo em todos os estados, de uma vez.

Método: servidor estático próprio (portas 47761, 47762 e 47711, derrubadas ao fim; a 3099 e os specs do projeto não foram tocados). Extraí o texto visível, os `aria-label`, os `details` e os `popover` dos 16 estados em 1440 e, para a página do vídeo, nas três abas (1, 7 e 30 dias, com `?todos=1`, 12 cartões). Conferi cada número contra os dados e contra os outros números do mesmo estado. Medi contraste, alvos, fonte e rolagem em 32 cruzamentos (1440 escuro e 390 claro). Olhei as capturas do típico, completo (1 dia), canal e canal-fecha. Também rodei a auditoria do desenhista (`shots/auditoria-r4.mjs --sem-capturas`): "AUDITORIA LIMPA". Ela confere a coerência dentro de cada estado e não pega os dois defeitos abaixo, porque eles nascem do tempo (total de hoje numa aba de 1 dia) e do cruzamento entre telas.

## Veredito: NAO_PODE. 1 bloqueio e 2 "corrige", todos de número de exemplo que se contradiz. Os dois bloqueios da r3 estão resolvidos.

Desenho, cor, símbolo, layout, alvo de toque, contraste e comportamento estão no nível: nada novo nesse eixo. O que falta é a mesma classe de erro das rodadas anteriores, em duas variantes que a auditoria não cobre.

## Os dois bloqueios da r3, um a um

| r3 | Situação | Evidência |
|---|---|---|
| B1, "5 das 3 respostas" no lote completo | **Resolvido** | `?caso=completo`: cartão 1 diz "Publicado em 07/10 · 3 respostas" e "Não vimos resposta do criador. Conferimos as 3 respostas que o YouTube mostrou e nenhuma é dele." Em todos os estados, "Não sabemos" só aparece com mais de 5 respostas (cartão 1 do típico: "só 5 das 62"; vídeo novo: "só 5 das 6"). |
| B2, datas dos cartões antes do vídeo (vídeo novo) e 06/09 na página do canal | **Resolvido** | Vídeo novo (publicado em 10/10): todos os cartões são de 10/10 ou 11/10, e o retrato de 1 dia é de 11/10; "identidade guardada até 08/11" = 11/10 + 28. Canal: nenhum comentário anterior ao vídeo; cada comentário cai entre o dia da publicação e 7 dias depois (24/11 em vídeo de 20/11; 15/11 em 12/11; 09/11 em 05/11; 01/11 em 28/10; 20/10 em 17/10). |
| Melhorias 1, 2 e 4 da r3 | **Feitas** | "Depois dos 30 dias não guardamos mais nada deste vídeo." no ⓘ; casa-espaço do M11 com `aria-hidden`; tabela fora da tela sem "N" literal. |

## Bloqueio

### B1. A página do canal "fecha em dd/mm" diz 1 vídeo, e o vídeo que ela mesma lista como "esperando os 30 dias" tem 3 respostas do criador (`?caso=canal-fecha` contra `?caso=novo`, 1440 e 390)

Capturas: `shots/20-canal-fecha-1440-escuro.png` e `shots/20-canal-fecha-390-claro.png` (confere com a minha captura de 390 claro), contra `shots/20-novo-1440-escuro.png`.

- A frase do bloco diz "Só 2 dos 14 vídeos dos últimos 90 dias têm coleta de comentários", e a legenda diz "2 esperando os 30 dias (05/11 e 09/11)". Os dois são o Mochilão (06/10) e "Três erros que eu cometi em Hué" (10/10, fecha em 09/11).
- A lista logo abaixo diz "Leo respondeu a 3 comentários guardados, em 1 vídeo", e os 3 itens são todos do Mochilão.
- Mas a página do vídeo de Hué (`?caso=novo`, aba de 1 dia) mostra Leo respondendo a 3 dos 12 comentários guardados (cartões 4, 7 e 12: Marcos, Priya e Carla). Quem clica no segundo vídeo da legenda encontra 3 respostas que a lista do canal não tem. A lista também diz que o criador respondeu em 1 vídeo quando o próprio mockup mostra 2.
- A tabela de coerência da NOTAS (linha "Canal, fecha") fecha a conta só contra o vídeo típico, e a auditoria idem. Nenhuma olhou o vídeo de Hué.

Correção exata: em `c20-dados.js`, acrescentar à lista do `canal-fecha` os 3 comentários de Hué, tirados de `D.novo` por código (ids 4, 7 e 12: datas 10/10, 11/10 e 10/10; curtidas do dia 1 que o cartão já mostra: 8, 4 e 2), para a frase sair "6 comentários guardados, em 2 vídeos". Como Hué só tem o retrato de 1 dia, o item desses três não pode dizer "curtidas aos 7 dias": diz "curtidas no dia 1" (o rótulo vem do marco que existe). Ordem pelo mais recente primeiro: por data do comentário e, no empate, pelo vídeo mais novo (Hué antes do Mochilão). Atualizar a linha da tabela de coerência e ensinar a auditoria a conferir o `canal-fecha` contra `D.novo`.

## Corrige (vai ao dono só depois)

### C1. Aba de 1 dia afirma o total de hoje (`?caso=completo&idade=1` e `?caso=novo`)

Capturas: `shots/20-completo-1440-escuro.png` aberto na aba de 1 dia (minha: `completo1-1440.png`) e `shots/20-novo-1440-escuro.png`.

- Completo: "Com 1 dia, guardamos 12 de todos os 37 comentários do vídeo", barra "12 de 37 (todos)" e ⓘ "Como contamos os 12 de 37 (todos) comentários". Os 37 são o cabeçalho de hoje (13/10). No dia 1 (07/10) o vídeo não tinha 37: só nos cartões há 3 comentários de 11/10 e 12/10 (Jess, Priya, Omar) com 6 respostas, ou seja, pelo menos 9 dos 37 ainda não existiam.
- Vídeo novo: "Com 1 dia, guardamos 12 de todos os 92 comentários do vídeo". O retrato é de 11/10, e os 92 são de 13/10.
- É a frase afirmando mais do que o dado sustenta, na aba que se anuncia como retrato de outro dia.

Correção exata: guardar em cada retrato o total do dia (`total1`, `total7`) em `c20-dados.js` e usar o do marco aberto na frase, na barra e no `aria-label`. Para o completo, `total1` sai por código como 37 menos os comentários posteriores a 07/10 e suas respostas (37 − 3 − 6 = 28). Para o novo, um número menor que 92 e maior que 49 (12 + 37 respostas), por exemplo 71. A barra passa a 12 de 28 e 12 de 71. O cabeçalho do vídeo continua com o total de hoje.

### C2. "1 curtidas" no texto da tela e nos `aria-label` (vídeo pequeno)

- `?caso=completo`, "Ver os 3 que saíram dos 12": "1 curtidas no dia 1 · Rafa Souza", e igual para Tati Moura e Léo Campos. As casas da fileira têm `aria-label` "Comentário 4 de 12, mais curtido, 1 curtidas" (8 casas no dia 1).
- Correção: plural por `L.pl`/`A.plural` ("1 curtida") em `c20.js` linha 76 (rótulo da casa) e na linha 201 (lista dos que saíram). Aproveitar para conferir o caso "0 curtidas".

## Sugestões (não bloqueiam)

1. **O rótulo "Mais curtido" sobre empate de 1 curtida.** No vídeo pequeno, 8 dos 12 cartões têm 1 ou 2 curtidas no dia 1 ("Mais curtido" com 1 curtida não ordena nada). Subir o piso das curtidas do exemplo (escala 0,07 com mínimo 1 achata) para o exemplo mostrar uma ordem de verdade, por exemplo mínimo 2 e diferenças de 1 entre vizinhos.
2. **Mundos diferentes para o mesmo canal.** Leo tem 17 vídeos em 90 dias no "com dado", 14 no "não medido" na mesma data simulada (12/01/2027), e 14 no "fecha em dd/mm" de 13/10; os vídeos Pho (06/10), Bastidores (06/10) e Hanói de trem (20/08) existem nos estados de vídeo, mas não nas listas do canal (a de 13/10 não tem 20/08, que cabe nos 90 dias). Cada estado é um exemplo alternativo, e a nota "Data deste exemplo" explica o salto de data; mesmo assim, uma linha na nota dizendo "cada estado é um canal de exemplo diferente" evita a pergunta do dono. Mais barato ainda: pôr 20/08 em `D.CANAL_ANTES` no lugar de 19/08.
3. **Textos de comentário que não combinam com o vídeo.** Os comentários do Mochilão (visto, "o item 3/4", seguro) aparecem iguais no vídeo "Pho em Hanói: cinco barracas" (08:05, o seguro "aos 6 minutos") e em "Três erros que eu cometi em Hué". Não é número, não bloqueia; o dono lê o texto.
4. **ⓘ do vídeo pequeno:** "Como contamos os 12 de 37 (todos) comentários" lê mal. "Como contamos os 12 de 37 comentários" resolve, porque a barra já diz "todos".
5. **"Desde 13/10" no cartão que saiu (extremo, cartão 10):** o retrato de 7 dias também é de 13/10 e traz esse comentário. Está de acordo com "hoje é 13/10", mas pode parecer que saiu antes de ser guardado; "hoje" ou "desde esta manhã" seria mais seguro. Sem reprovação.
6. **Casa vazia, textos de duas linhas e 6.276 px a 390 px:** sem mudança desde a r3.

## Varredura de coerência feita por mim (todos os estados; tudo o que achei)

Notação: ok = fecha com os outros números da mesma tela e com os dados.

| Estado | Número na tela | Conferência | Resultado |
|---|---|---|---|
| Típico, 7 dias | 12 guardados, "12 dos 100", barra 12%, 12 casas, aba "12 guardados" | 12 cartões, ids 1 a 12 | ok |
| Típico | "8 mais curtidos e 4 com o criador (ele respondeu a 3)" | cartões c = 8, k = 4 (Leo + Marcos, Priya, Carla), 3 faixas azuis | ok |
| Típico | "3 entraram · 3 saíram", etiqueta "entrou nos 12 no dia 7" | 12 − 3 + 3 = 12; entraram: Jess 11/10, Priya 11/10, Omar 12/10, todos posteriores a 07/10; 3 na lista dos que saíram | ok |
| Típico | "19 que deu para medir" + "1 autor com inscritos ocultos" | 19 + 1 = 20 mais curtidos | ok |
| Típico | curtidas 1/7 dias por cartão | ordem decrescente pelo marco (411…19 aos 7 dias; 112…4 no dia 1); nenhuma passa 1,9 mil | ok |
| Típico | "N respostas" | soma 109 + 12 = 121 ≤ 1.240; "Não sabemos" só com 62 (>5); "Não vimos" com 1, 2 e 4 respostas | ok |
| Típico | "identidade guardada até 04/11 / 10/11" | 07/10 + 28; 13/10 + 28 | ok |
| Típico | "(há 7 dias)", "fecha em 05/11" | 06/10 + 7 = 13/10; + 30 = 05/11 | ok |
| Aba de 1 dia (típico) | "9 mais curtidos e 3 com o criador (ele respondeu a 2)" | 9 + 3 = 12; Marcos e Carla com resposta, Priya ausente (11/10) | ok |
| Extremo | 6 + 4 + 1 + 1 = 12; "mais de 10 milhões", "mais de 1.000 vezes" | 10 mi ÷ 6,2 mil = 1.612 | ok |
| Extremo, 1 dia | 8 + 3 + 1 = 12 e "nenhum canal grande" | o canal grande só entrou no dia 7 (11/10) | ok |
| Completo, 7 dias | "12 de todos os 37"; respostas 21 + 12 = 33 ≤ 37; "Não vimos" em todos os de 3 respostas | | ok |
| Completo, 1 dia | "12 de todos os 37" | 37 é o total de hoje; faltam comentários de 11 e 12/10 | **C1** |
| Completo, 1 dia | "1 curtidas" | plural | **C2** |
| Vídeo novo, 1 dia | cartões de 10/10 e 11/10; "fecha em 17/10 e 09/11"; ident. até 08/11; respostas 37 + 12 = 49 ≤ 92 | | ok |
| Vídeo novo, 1 dia | "12 de todos os 92" | total de hoje no retrato de 11/10 | **C1** |
| Zero medido | cabeçalho "0 comentários", 412 views; "em 07/10" na aba de 1 dia | | ok |
| Desligados | cabeçalho "comentários: não medido" | | ok |
| Não coletado | "descobrimos com 4 dias" = 10/10; "até 16/10" = 06/10 + 10; "1.240" = cabeçalho | | ok |
| Antes da coleta | "há 54 dias" (20/08 a 13/10); "47 dias" na coleta (20/08 a 06/10) | | ok |
| Só leitura, sem texto | mesmos números do típico; lista dos que saíram sem texto nem nome | | ok |
| Só leitura, com texto | 6 + 4 + 1 + 1; lista dos que saíram com "um espectador" | | ok |
| Canal, com dado | "5 de 14 (36%)", "3 recentes", "17 vídeos", 5 + 9 + 3 = 17 casas | 5/14 = 35,7%; vídeos entre 14/10/2026 e 12/01/2027 (90 dias); os 3 recentes fecham 30 dias depois de 12/01 | ok |
| Canal, com dado | "6 comentários, em 5 vídeos" | 5 títulos distintos = 5 casas azuis; cada comentário até 7 dias depois do vídeo | ok |
| Canal, fecha | "2 dos 14", "12 anteriores", "(05/11 e 09/11)" | 12 + 2 = 14; 06/10 + 30 e 10/10 + 30; os 12 têm mais de 30 dias em 06/10 | ok |
| Canal, fecha | "3 comentários, em 1 vídeo" | Hué tem 3 respostas do criador na própria página | **B1** |
| Canal, não medido | "3 dos 14", 2 + 1 + 11 = 14, "mínimo 5", "3 comentários, em 2 vídeos" | 2 casas azuis = 2 vídeos | ok |

## Veredito por estado e por largura

| Estado | 1440 escuro | 390 claro | Observação |
|---|---|---|---|
| Típico (abas 1, 7 e 30) | pronto | pronto | |
| Extremo | pronto | pronto | |
| Lote completo | **volta (C1, C2)** | **volta (C1, C2)** | total de hoje no dia 1; "1 curtidas" |
| Aba de 1 dia (típico) | pronto | pronto | |
| Zero medido | pronto | pronto | |
| Desligados pelo canal | pronto | pronto | |
| Não coletado (2 motivos) | pronto | pronto | |
| Antes da coleta | pronto | pronto | |
| Vídeo novo | **volta (C1)** | **volta (C1)** | "12 de todos os 92" no retrato de 11/10 |
| Carregando | pronto | pronto | |
| Erro de leitura | pronto | pronto | |
| Só leitura, sem texto | pronto | pronto | |
| Só leitura, com texto sem nome | pronto | pronto | |
| Canal, M11 com dado | pronto | pronto | |
| Canal, M11 fecha em dd/mm | **volta (B1)** | **volta (B1)** | lista contradiz a página de Hué |
| Canal, M11 não medido | pronto | pronto | |

## A pergunta de quem abre

"O que o público destacou neste vídeo, e o criador respondeu quem?" Respondida no primeiro olhar a 1440 escuro: frase-resumo com números em negrito, barra "12 de 100", fileira de 12 casas com cor e símbolo por motivo, legenda com zero medido (caixa com 0), não medido (hachura rosa) e "ainda não existe" (pontilhado). Método no ⓘ, com a frase fixa "Cálculo do Observatório sobre dados públicos do YouTube." Sem "lido", "série", "snapshot" ou "retenção" na tela. Sem `color-mix()` fora de comentário (`grep` em `c20*.css/js`: só o comentário do cabeçalho do `c20.css`).

## Tabela de medidas

| Elemento | Medido | Limite |
|---|---|---|
| Texto menor de todos os estados (escuro 1440) | 4,78:1 ("respondeu", 12,5 px); o resto 5,1 ou mais | 4,5 |
| Nenhum texto abaixo de 12 px, nenhum par de texto abaixo de 4,5:1 | 0 casos em 32 cruzamentos | |
| Falso positivo conhecido | inicial "L"/"N" no disco com `linear-gradient` inline, lida como 1,07 a 1,20; a captura mostra o disco escuro com a letra clara legível (conferido na r3, 9:1 ou mais) | |
| Rolagem horizontal da página | 0 px nos 32 cruzamentos | 0 |
| Alvos abaixo de 44 x 44 px a 390 px (ponteiro grosso) | 0 nos 16 estados | 44 |
| Altura da página a 1440 (típico / extremo / zero / erro) | 3.685 / 5.559 / 2.032 / 1.982 px | |
| Altura a 390 (típico / extremo / completo / novo) | 6.276 / 9.422 / 6.215 / 6.148 px | |
| Foco | anel de 2 px sólido `--accent`, herdado de `a4.css` (não refeito) | visível |

## O que não consegui verificar

- Leitor de tela: li só os atributos e os nomes acessíveis.
- Safari e Opera: só Chromium.
- Fontes reais (Inter, JetBrains Mono, Fraunces): a captura cai nas do sistema; a quebra de linha pode mudar um pouco.
- Escala de cinza: não refiz; a r2 conferiu e nenhum símbolo ou forma de estado mudou.
- Tema claro a 1440 e escuro a 390: não medi nesta rodada (os pares obrigatórios, sim).
- Navegação por teclado, Home/End das abas e foco do "Mostrar os outros 7": não refiz; nada nos arquivos mudou nessas partes desde a r3 (datas dos arquivos), e a r3 conferiu.
- Movimento reduzido: não medi.

## Arquivos

Nada fora desta pasta foi tocado e nada foi commitado. Meus scripts e capturas estão no escopo temporário da sessão, não na pasta do mockup. Servidores estáticos derrubados pelo PID.
