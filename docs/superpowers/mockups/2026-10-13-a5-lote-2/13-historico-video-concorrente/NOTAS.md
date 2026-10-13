# Mockup 13: Histórico do vídeo de concorrente (A5, lote 2). Notas do desenho

Como abrir: `index.html?caso=<estado>` (e `&tema=claro`). O seletor "Estados do mockup" fica no topo, fora da tela simulada. Estados: `cheio`, `extremo`, `recente`, `magro`, `zero`, `naomedido`, `semanal`, `saiu`, `mantido`, `aovivo`, `vazio`, `carregando`, `erro`, `leitura`.
Plano feito antes do desenho: `PLANO.md`. Capturas: `shots/m13-<estado>-<1440|390>-<escuro|claro>.png` (56, refeitas depois da revisão r1). Medidas (`medidas.json`): rolagem horizontal 0, nenhum texto menor que 12 px, nenhum alvo de toque menor que 44 px a 390; `grep color-mix` não acha nada.

**Tudo é exemplo** (canais, vídeos, números, datas). Os estados `recente` e `magro` reproduzem a situação real de hoje (13/10/2026) com dados inventados; a tabela "dado real × exemplo" está na seção 5. Os estados `cheio`, `extremo`, `semanal` e `leitura` vivem num dia de exemplo, **11/11/2026**, e a tela diz isso num aviso no topo: hoje nenhum vídeo tem 15 dias de contagem por dia, então a subida e a curva de 30 dias ainda não existem. As contas dos exemplos são feitas por um motor (`m13-dados.js`): a soma dos dias fecha com o total do cabeçalho, a curva de 72 horas e a de dias saem da mesma contagem, a subida segue a regra de M5 (taxa dos 7 dias seguintes ≥ 2× a dos 7 anteriores e ganho ≥ 1.000 views) e a frase da tela usa o número calculado.

## 1. Decisões de desenho e por quê

1. **Quatro blocos, cada um com uma pergunta** (e não um gráfico só): resumo ("foi bem para a idade?"), views por idade (vídeo contra o normal do canal), 72 horas (como foi o lançamento) e dia a dia com mudanças (algo mudou antes de subir?). Três escalas no mesmo desenho virariam ruído.
2. **Cores de lado para a comparação, verde só para a subida.** Estar acima do normal do canal não é direção no tempo. Vídeo = azul (círculo, barra cheia; o laranja é do canal do dono), normal do canal = areia (quadrado vazado, tracejado). A subida é direção: verde, ▲, faixa de 7 dias. Âmbar/▼ não aparece nesta tela (nenhum estado desenhado tem "descendo"; vale a regra do lote 1 se aparecer).
3. **Curva por idade com eixo por categoria** (1, 2, 3, 5, 7, 14, 21, 30, 60, 90 dias), não linear: os pontos de M2 são essas idades, e o `n` de cada ponto fica alinhado embaixo. Com eixo linear, 1, 2 e 3 dias se amontoariam. 60 e 90 dias aparecem como "ainda não existe" (círculo pontilhado) até existirem.
4. **O normal com n < 3 é "não medido"** (hachura no ponto e sublinhado hachurado no n), mesmo quando o vídeo tem valor. O vídeo continua desenhado.
5. **Três pares de barras ao lado da curva (1, 7 e 30 dias)** são a régua de relance: o leitor compara duas barras sem decifrar a curva. Cada par diz "N vezes o normal" por escrito.
6. **72 horas, hora a hora, em horário de São Paulo.** Eixo marca 00:00 e 12:00, data debaixo da meia-noite, a publicação é uma linha tracejada com a hora ("publicado qui 08/10, 20:40"). O trecho antes da primeira contagem é hachura rosa (o vídeo só é descoberto até 6 horas depois, e a curva começa na primeira leitura depois disso); a tela escreve a idade do vídeo nessa primeira leitura. Pico rotulado ("300 em 1 hora") e linha pontilhada em "1/2 das views".
7. **Régua de 0 a 72 h** abaixo do gráfico, com 1/4, 1/2 e 3/4 das views do vídeo (ponto azul) e do normal do canal (quadrado areia), cada um com as horas. **Marca que não existe não some:** vira um ponto hachurado rosa na ponta de 0 h, escrito "não medido", e a frase logo abaixo diz o motivo ("o vídeo já tinha mais de 1/4 das views quando a contagem por hora começou, 7 h 40 min depois de publicar"). Rótulos de hora que se tocam (1/4 em 7 h e 1/2 em 12 h a 390 px) descem para uma segunda linha. É a leitura de M14 ("metade em N horas"): mostra se o vídeo foi de arrancada ou de fôlego. Normal com menos de 3 vídeos de 72 horas completas: hachura e o motivo.
8. **Quantas raias: três** (Título = losango, Miniatura = triângulo, Outras = círculo). "Outras" junta descrição, tags, categoria, duração e capítulos; sete raias seriam um painel de controle. **Sem raia de playlist.** O número dentro do marcador é a ordem cronológica (igual ao aprovado em 12/10), a lista "Mudanças deste vídeo" abaixo do gráfico diz tudo.
9. **Marcas muito juntas na mesma raia (menos de 26 px) viram uma só, "×N"**, com contorno duplo. Com mais de 6 mudanças as linhas verticais não atravessam mais as barras (só um traço curto, na altura da raia), senão o estado `extremo` (14 mudanças) vira um código de barras.
10. **Subida** é uma faixa verde sobre os 7 dias, com "▲ subida" no topo, mais uma faixa tracejada sobre as raias para os **14 dias antes**. Abaixo do gráfico, um cartão com a frase da subida e a lista das mudanças dos 14 dias antes, em ordem de campo (título, miniatura, outras), com a nota fixa "É só uma lista de coincidências: não diz o que causou a subida." e o ⓘ. Cada item da lista dentro da janela ganha a marca "dentro dos 14 dias antes da subida". Quando mais da metade das mudanças cai nessa janela (o `extremo`), a marca se inverte: uma linha diz quantas estão dentro e só as de fora levam "fora dos 14 dias antes".
11. **Série semanal tem forma própria:** um ponto por semana (círculo vazado, azul) sobre um traço que cobre os 7 dias, com a média de views por dia; nada de barras por dia. Primeira leitura sem anterior = hachura. O veredito é uma caixa neutra com meio relógio: **"inconclusivo: série semanal"** (contorno cheio e cinza: o dado chegou, só não decide; não é rosa, que é "o dado não chegou", nem pontilhado, que é "ainda não existe").
12. **Linha de corte de 24/08/2026** é uma linha tracejada ocre com o rótulo "24/08: mudou a regra de contar views", desenhada em todo eixo que cobre a data. Hoje só o estado `semanal` (vídeo de 11/08) a cobre, e ela cai no trecho "sem contagem antes da primeira leitura".
13. **Saiu do YouTube:** pastilha com ícone de olho cortado no cabeçalho ("saiu do YouTube em 09/10"); "mantido para análise" troca a borda para verde-água e põe alfinete. O botão "Abrir no YouTube" some e vira "Sem link: o vídeo não está mais no YouTube". O gráfico por dia termina numa linha cheia com "✕ saiu do YouTube em 09/10: a contagem termina aqui" e o resto vira contorno pontilhado (a linha fica na borda esquerda do dia 09/10, o primeiro dia sem contagem, que já entra na área pontilhada). Os dados antigos continuam à vista (o dado fica). O botão "Responder em Saíram do YouTube" leva à fila aprovada no lote 1; esta tela não repete "Manter/Apagar".
14. **Ao vivo ou estreia:** pastilha tracejada, a linha é só do vídeo, "sem comparação", e a régua de 72 horas troca o normal por "fora do normal do canal: ao vivo ou estreia" (M1, M2 e M14 excluem esses vídeos).
15. **Não medido** sempre com o motivo da lista fechada de 6.1.5, em duas camadas: a pastilha rosa e o motivo curto sob o rótulo da célula ("entrou tarde na contagem", "publicado antes de 03/10", "contagens a mais de 36 h", "contagem por semana") e o motivo inteiro no ponto/barra selecionado. Bloco inteiro não medido = faixa hachurada de ponta a ponta + motivo.
16. **Zero medido** = caixa vazada azul-acinzentada com o 0 dentro (célula) ou em cima (barra do dia, onde a caixa tem 6 px); na barra da hora, com 72 barras lado a lado, não cabe número e valem a legenda "zero medido" e a leitura do ponto; nunca confundido com hachura.
17. **Nada de afirmar causa:** "depois da troca" nunca aparece; só "Mudanças nos 14 dias antes".
18. **Gráficos acessíveis:** cada desenho é um grupo focável com setas (Início, Fim, Esc), botões "anterior/seguinte" de 44 px, uma linha de leitura (`aria-live`) e "Ver como tabela" com todos os pontos. O SVG é `aria-hidden`; a leitura e a tabela são o texto.
19. **Encaixe do mockup 20:** faixa tracejada no fim ("Aqui entra a seção Comentários de destaque deste vídeo (mockup 20)"), sem desenho.
20. **Texto de gráfico com contorno da cor do cartão e linhas por baixo (r1, C1).** Linhas de mudança, de "1/2 das views" e de 24/08 são desenhadas antes das barras e dos textos; todo número e toda data leva um contorno de 4 px da cor do cartão, então a linha se interrompe em volta do texto em vez de atravessá-lo. Rótulos de valor da curva por idade: o de cima fica à esquerda do marcador e o de baixo à direita (a curva sobe para a direita). O rótulo do pico das 72 horas troca de lado se a linha de "1/2 das views" cairia no texto.
21. **A pergunta inteira no resumo (r1, C3).** Nos estados com subida a frase-resumo termina com "Nos 14 dias antes, o canal mudou o título (11/10) e a miniatura (13/10)." (ou, com mais de 4 mudanças, "O canal fez 14 mudanças no vídeo, 12 delas nos 14 dias antes (a lista está no fim da página)."): lista, sem causa.
22. **Capa de 120 x 68 px a 390 px (r1, C4)**, ao lado do título; os fatos e os botões descem para a largura toda. O aviso de exemplo mostra só a primeira frase a 390 px (o resto aparece a partir de 761 px). Resultado: a frase-resumo começa em y = 905 nos estados de hoje e em y = 952 a 975 nos de novembro (eram 1.100 a 1.207); o cartão do resumo começa uns 25 px acima disso. A casca do Observatório (~680 px) é do lote 1 e não foi mexida.
23. **A frase de leitura segue o ponteiro (r1, C5):** "Toque no gráfico ou use as setas…" com dedo, "Passe o mouse sobre o gráfico ou use as setas…" com mouse (`pointer: coarse`). A linha de leitura fica logo abaixo do gráfico e a legenda vem depois (r1, S9).

## 2. Tabela de frases (texto exato)

Entre `{ }` vai o que a tela calcula. "Hoje" = 13/10/2026.

| Onde | Texto |
|---|---|
| Aviso (estados de futuro) | "Este estado mostra como a tela fica em novembro (dia de exemplo: 11/11/2026). Hoje (13/10) nenhum vídeo tem 15 dias de contagem por dia, então a subida e a curva de 30 dias ainda não existem; a situação de hoje está nos estados “vídeo novo” e “magro”." (a 390 px só a primeira frase) |
| Aviso (demais) | "Nomes, números e datas são de exemplo. Hoje é 13/10/2026; a contagem por dia começou em 03/10 e a contagem por hora em 04/10." (a 390 px só a primeira frase) |
| Pastilha | "saiu do YouTube em {dd/mm}" · "saiu do YouTube em {dd/mm} · mantido para análise" · "ao vivo ou estreia" |
| Cabeçalho, sem link | "Sem link: o vídeo não está mais no YouTube" · botão "Responder em “Saíram do YouTube”" |
| Botões | "Fixar vídeo", "Abrir no YouTube", "Pedir leitura da forja", "Tentar de novo" |
| Resumo, típico | "Com {30} dias, o vídeo tinha {94,3 mil} views ● e o normal do canal, {33,8 mil} □ ({3} vídeos): {2,8 vezes o normal}. ▲ Subiu em {16/10}. Nos 14 dias antes, o canal mudou o título ({11/10}) e a miniatura ({13/10})." (variações: "＝ perto do normal", "{0,9 vez o normal, abaixo}"; com mais de 4 mudanças antes: "O canal fez {14} mudanças no vídeo, {12} delas nos 14 dias antes (a lista está no fim da página)."; nenhuma: "Nenhuma mudança registrada nos 14 dias antes.") |
| Resumo, magro | "O vídeo tem {17,0 mil} views agora. Foi publicado antes de 03/10, então a contagem por dia só existe desde 03/10 e a comparação por idade não dá." |
| Resumo, zero | "O vídeo tem só {32} views. Em {2 dos 9} dias não ganhou nenhuma view (medido: 0), e em {47 das 68 horas medidas} também não." |
| Resumo, não medido | "O vídeo tem {11,5 mil} views agora, mas entrou na contagem só em 08/10 e falta a de 11/10: quase tudo abaixo é “não medido”, cada um com o motivo." |
| Resumo, semanal | "O vídeo tem {120 mil} views e uma contagem por semana: o que sobe e desce dentro da semana não aparece." |
| Resumo, saiu | "O vídeo saiu do YouTube em {09/10}. A última contagem, em {08/10}, foi de {7.657} views, depois de {4 dias} de contagem. **A contagem termina em {08/10}**." ("N dias de contagem" = dias com leitura das 12:00, contados da lista que desenha as barras; "Com N dias" é só idade do vídeo.) Normal sem vídeo nenhum: "O normal do canal: não medido, nenhum vídeo chegou a esta idade (o mínimo é 3)." (nunca "só 0 vídeos"). Mudança de 6 h que começa às 12:00 ou depois: "Mudou neste dia, depois da contagem das 12:00: {descrição} (mudança 3)." |
| Resumo, ao vivo | "Vídeo ao vivo ou estreia: tem {12,4 mil} views e fica fora do normal do canal, que só conta vídeos comuns." |
| Resumo, vazio | "O vídeo tem {312} views agora. Ainda não há histórico: a primeira contagem por dia é às 12:00 de amanhã." |
| Faixa de números | "Views agora" (sub: "contagem de hoje" / "última contagem, {dd/mm}") · "Com 1 dia", "Com 7 dias", "Com 30 dias" (sub: "normal do canal: {5.200} ({14} vídeos)" / "fora do normal do canal" / "fecha em {dd/mm}" / motivo curto) · "Subida" (valor "{16/10}" + "▲ {4,7×} o ritmo", sub "7 dias depois contra 7 antes"; ou "nenhuma ＝"; ou não medido com "fecha em {dd/mm}") |
| Bloco 1, título | "Views por idade: o vídeo contra o normal do canal" |
| Bloco 1, legenda | "este vídeo (círculo)", "o normal do canal (quadrado tracejado)", "não medido", "ainda não existe", "n = vídeos do canal no normal" |
| Bloco 1, frase | "Com {30} dias, {94,3 mil} views ● contra {33,8 mil} □ do normal do canal ({3} vídeos): {2,8 vezes o normal}. O próximo ponto, 60 dias, fecha em {08/12}." · "Só {1 dos 5 pontos que já existem} tem contagem; os outros {4} são “não medido”, cada um com o motivo. Os {5} pontos de idades maiores ainda não existem." (as contas e a concordância saem dos pontos desenhados) · "Ao vivo ou estreia: a linha é só deste vídeo, sem comparação com o normal do canal (2 vídeos nessa condição saíram da conta)." |
| Bloco 1, pares | "Os mesmos pontos, lado a lado:" · "{1 dia}" · "normal do canal, {14} vídeos" · "{6,4 vezes} o normal" · "{0,9 vez o normal, abaixo}" · "＝ perto do normal" · "normal do canal não medido: só {2} vídeos" · "fecha em {dd/mm}" |
| Leitura de uma idade | "Com {7} dias: o vídeo tinha {13.535} views. O normal do canal: {15.200} ({11} vídeos): {0,9 vez o normal, abaixo}." · "Com {14} dias: ainda não existe; fecha em {dd/mm}." · "Com {1} dia: não medido: {motivo}." |
| Bloco 1, não medido (magro) | "publicado em 03/09/2026, antes de 03/10: a contagem por dia começou em 03/10, então não sabemos quantas views o vídeo tinha nas idades até 30 dias" + "O normal do canal continua existindo para os vídeos publicados desde 03/10: {4} vídeos com 1 dia." |
| Bloco 1, não medido (semanal) | "o vídeo já tinha {53} dias quando a contagem começou (03/10): a comparação por idade só vale para os primeiros 30 dias" |
| Bloco 1, vazio | "O primeiro ponto (1 dia de idade) aparece em {15/10}, depois das 12:00." |
| Motivos de "não medido" por idade | "publicado antes de 03/10: a contagem por dia começou em 03/10" · "entrou tarde na contagem: o vídeo entrou na contagem {76} horas depois de publicado" · "entrou tarde na contagem: antes da primeira contagem ({08/10})" · "contagens vizinhas a mais de 36 horas (falta a contagem de {11/10})" · "o vídeo já tinha mais de 30 dias quando a contagem começou" · "o vídeo saiu do YouTube antes desta idade" |
| Bloco 2, título | "As primeiras 72 horas, hora a hora" · sub: "Horário de São Paulo. Primeira contagem às {01:00} de {09/10}." |
| Bloco 2, frase | "Metade das views das 72 horas veio nas primeiras {22} horas. A curva começa {4 h 20 min} depois de publicar (primeira contagem às {01:00}), com {1.789} views já." · "Em {47 das 68 horas medidas} o vídeo não ganhou nenhuma view (medido: 0, caixa vazada). Em {21} horas ganhou algumas." · "A curva começa … metade das views ainda não dá para dizer (o vídeo já tinha mais da metade quando a contagem por hora começou)." |
| Bloco 2, gráfico | "publicado {qui 08/10}, {20:40}" · "{300} em 1 hora" · "1/2 das views" · legenda "hora com views", "zero medido", "não medido (antes da primeira contagem)", "publicação" |
| Bloco 2, régua | "este vídeo", "normal do canal ({6} vídeos)", marcas "1/4", "1/2", "3/4" com "{9} h"; quartil que não existe: marca hachurada "1/4 não medido" + "Deste vídeo, 1/4 não medido: o vídeo já tinha mais de 1/4 das views quando a contagem por hora começou ({7 h 40 min} depois de publicar)."; eixo "0 h, 24 h, 48 h, 72 h"; sem normal: "não medido" + "Normal do canal: só {2} vídeos com as 72 horas completas (o mínimo é 3), e a contagem por hora começou em 04/10." · ao vivo: "fora do normal do canal: ao vivo ou estreia" |
| Bloco 2, leitura de uma hora | "{sex 09/10}, {02:00} a {03:00}: {412} views. Total até aqui: {2.200}." · "…: 0 views (medido)." · "…: não medido: antes da primeira contagem, que foi às {01:00} ({4} h {20} min depois de publicar)." |
| Bloco 2, não medido | "entrou tarde na contagem: o vídeo só entrou na contagem {76} horas depois de publicado, quando as 72 horas já tinham passado" + "A contagem por dia, a partir de {08/10}, continua abaixo." · "publicado em {20/09/2026}, antes de 04/10: a contagem por hora começou nesse dia e só vale para vídeos publicados depois" · (`semanal`, r6 C1: a MESMA frase do `magro`, "publicado em {11/08/2026}, antes de 04/10: ...") |
| Bloco 2, vazio | "A primeira contagem por hora entra às 19:00 de hoje, depois que o vídeo for descoberto às 18:00; a curva ganha uma barra por hora, até 72 horas depois de publicar." |
| Bloco 3, título | "Views por dia e cada mudança" · (semanal) "Views por semana, uma contagem por semana" |
| Bloco 3, frase | "O melhor dia foi {18/10}, com {9.934} views. ▲ Subida em {16/10}. O canal mudou o vídeo {4 vezes} (título, miniatura e outras)." · "A contagem por dia só existe desde 03/10 ({11} dias). Melhor dia: {07/10}, com {531} views. Houve {1} mudança registrada." · "Dos {9} dias, {2} tiveram zero view (caixa vazada, medido) e o melhor teve {21}. Nenhuma mudança registrada." · "Dos {8} dias desde a publicação, {5} estão “não medido”: o vídeo foi descoberto tarde e uma contagem se perdeu. {Toque em | Passe o mouse sobre} cada barra com hachura rosa para ver o motivo." · "O vídeo ganhou {7.657} views em {4} dias com contagem. A contagem termina em {08/10}, o último dia em que o vídeo respondeu." · "Uma contagem por semana: cada ponto é a média de views por dia da semana. Sem barra por dia e sem dizer se uma mudança “funcionou”." |
| Bloco 3, legenda | "dia com views", "zero medido", "não medido", "título", "miniatura", "outras (descrição, tags, categoria, duração, capítulos)", "▲ 7 dias da subida", "14 dias antes" · semanal: "média por dia da semana (um ponto por semana)", "sem contagem (antes da primeira leitura)", "24/08: mudou a regra de contar views" |
| Bloco 3, rótulos no gráfico | "▲ subida", "publicado {20:40}", "✕ saiu do YouTube em {09/10}: a contagem termina aqui" (390 px: "✕ saiu em {09/10}"), "24/08: mudou a regra de contar views", "sem contagem antes de {05/10}", raias "Título", "Miniatura", "Outras" (a 390 px só a forma) |
| Bloco 3, leitura de um dia | "{qui 15/10}: {828} views. A subida começa neste dia. Mudou neste dia: {título} (mudança {1})." · "publicado às {20:40}, sem contagem das 12:00 nesse dia." · "o vídeo não está mais no YouTube: não há contagem." · "não medido: {motivo}" com "Os dois dias juntos ganharam {1.020} views." |
| Cartão da subida | "▲ Subida em {16/10}: nos 7 dias seguintes o vídeo ganhou {49.601} views, {4,7 vezes o ritmo} dos 7 dias antes ({7.086} contra {1.497} por dia)." · "Mudanças nos 14 dias antes: título em {11/10} e miniatura em {13/10}." (mais de 4: "título em 10/10, 11/10 e 13/10; miniatura em …; descrição em …") · "Nenhuma mudança registrada nos 14 dias antes." · "É só uma lista de coincidências: não diz o que causou a subida." |
| Cartão sem subida | "＝ Sem subida" + "Nenhum dia teve o ritmo dos 7 dias seguintes em 2 vezes o dos 7 anteriores com ganho de 1.000 views ou mais." |
| Cartão não medido | "Subida: não medido. Precisa de 15 dias de contagem por dia (7 antes, o dia da subida e 7 depois); são {11} (começou em 03/10). Faltam {4}: fecha em {17/10}." · "faltam contagens por dia (descoberto tarde e uma contagem perdida): sem 7 dias antes e 7 depois seguidos, não dá" · saiu: "precisa de 14 dias de contagem por dia e o vídeo saiu do YouTube com {4} dias de contagem, então a subida não vai ser medida" |
| Cartão semanal | "inconclusivo: contagem por semana" (r5: o spec dizia "série semanal"; a regra de frases sem jargão vence, ver seção 12, S8) + "Com uma contagem por semana não dá para dizer se uma mudança veio antes de uma subida." + ⓘ com "Contagem por semana: uma contagem a cada semana, em vez de uma por dia." · a célula "Subida" da faixa diz "contagem por semana" |
| Lista de mudanças | título "Mudanças deste vídeo"; com mais da metade das mudanças nos 14 dias antes: "{12} das {14} mudanças estão nos 14 dias antes da subida; só as outras levam marca." e a marca vira "fora dos 14 dias antes" nas outras; "Título em {11/10}, entre 06:00 e 12:00 de “…” para “…”" · "Miniatura em {13/10}" · "Outras: {descrição} em {18/10}" · "em algum momento entre {08/10} e {10/10} (a contagem ficou parada)" · "Nenhuma mudança registrada desde 03/10 (o histórico de mudanças começou nesse dia)." |
| Faixa de números, `semanal` | célula "Subida": forma neutra (relógio, contorno cheio) com "contagem por semana" e, embaixo do rótulo, "não dá para ver o dia"; as células de 1, 7 e 30 dias seguem rosa "não medido" (r2 C3) |
| Números grandes | "1,02 milhão", "2,4 milhões" (nunca "mi", que se confunde com "mil"; r2 S2) |
| Vazio (blocos) | tag "ainda não existe"; "A primeira barra aparece amanhã, depois das 12:00. As mudanças de título, miniatura e descrição entram aqui à medida que o canal as fizer." |
| Carregando | `aria-busy`, aviso lido: "Carregando o histórico do vídeo." (três cartões de esqueleto) |
| Erro | "Não deu para abrir o histórico deste vídeo" · "O servidor não respondeu. Tente de novo; se continuar assim, avise." (não afirma o que está guardado: a tela não sabe) · botão "Tentar de novo" · bloco "O que dá para ver enquanto isso": "O título, o canal e a data de publicação acima vieram da lista, não do histórico. Os números e os gráficos aparecem quando o histórico abrir." |
| Só leitura | "Você só pode ver este histórico. Fixar o vídeo e pedir leitura da forja pedem permissão de editor. Os números e os gráficos são os mesmos que o editor vê." (botões Fixar e Pedir leitura com `aria-disabled`, tracejados) |
| Encaixe | "Aqui entra a seção Comentários de destaque deste vídeo (mockup 20)." + "fora deste mockup" |
| Navegação dos gráficos | "Passe o mouse sobre o gráfico ou use as setas para ler um ponto." (com dedo: "Toque no gráfico ou use as setas para ler um ponto.") · ⓘ com o nome do bloco: "Como ler a curva por idade", "Como ler as 72 horas", "Como ler o dia a dia e as mudanças", "Como a subida é calculada" · botões "Idade anterior/seguinte", "Hora anterior/seguinte", "Dia anterior/seguinte", "Semana anterior/seguinte" · "Ver como tabela" |

**Dicas do ⓘ** (método; a frase fixa "Cálculo do Observatório sobre dados públicos do YouTube." fecha cada uma):
- *Views por idade:* cada ponto é a views do vídeo em "publicação + N dias", entre as duas contagens vizinhas; o normal é a mediana dos outros vídeos longos do canal na mesma idade, publicados nos últimos 180 dias, com o n (menos de 3 = não medido); ao vivo e estreia ficam de fora; as idades altas só têm os vídeos mais velhos, a curva não é de um mesmo grupo.
- *72 horas:* cada barra é a diferença entre duas contagens seguidas (uma por hora cheia), em São Paulo; começa na primeira contagem depois da descoberta (que roda de 6 em 6 horas); "1/2 das views" é a primeira hora em que o vídeo chega à metade do que tinha com 72 horas; o YouTube segura e corrige o contador, então a hora não é o minuto em que a pessoa assistiu; só vídeos publicados depois de 04/10.
- *Dia a dia:* cada barra é o ganho nas 24 horas até as 12:00 (São Paulo); raias e agrupamento "×N"; a janela de cada mudança (6 em 6 horas, dia a dia, ou "em algum momento entre"); faixa verde = 7 dias da subida, tracejada = 14 dias antes.
- *Subida:* o primeiro dia em que o ritmo dos 7 dias seguintes é ≥ 2× o dos 7 anteriores e o ganho é ≥ 1.000 views; a lista traz todas as mudanças dos 14 dias antes; não diz a causa, não vê o que acontece fora do YouTube nem o que o YouTube recomenda, mudanças no mesmo dia não se separam.

## 3. Dúvidas para o dono (cada uma com o padrão adotado)

1. **A palavra "série".** A regra de frases sem jargão proíbe "série" na tela, mas o spec (6.1.5, M5, pergunta 16) manda a frase "inconclusivo: série semanal". **Padrão adotado até a r4: a frase do spec, exata. Desde a r5: "inconclusivo: contagem por semana"** (a regra de frases sem jargão do dono vence a frase do spec; o dono pode voltar a "série semanal" se preferir).
2. **Três raias** (Título, Miniatura, Outras) com "Outras" juntando descrição, tags, categoria, duração e capítulos. **Padrão: três.** Se o dono quiser a descrição separada (ela já tem raia na produção), são quatro e a lista de agrupamento fica mais apertada.
3. **Vídeo acima ou abaixo do normal usa as cores de lado, não verde/âmbar.** Não é direção no tempo. **Padrão: azul × areia; verde só na subida.** Confirmar que o dono lê assim.
4. **Normal do canal com n < 3 vira "não medido" mesmo com o vídeo medido.** **Padrão: sim**, o ponto do vídeo continua. Hoje isso vale para quase toda idade acima de 5 dias.
5. **Estados de futuro com o dia de exemplo 11/11/2026.** Hoje não existe subida nem curva de 30 dias; sem um dia de exemplo não há o que desenhar. **Padrão: aviso no topo de cada estado de futuro.**
6. **Linha de corte de 24/08 só aparece se o eixo cobre a data.** Hoje o vídeo só tem dado desde 03/10, então a linha só cai num trecho "sem contagem" (estado `semanal`). **Padrão: desenhada onde cabe**; se o dono quiser, ela pode também ficar sempre como nota do ⓘ.
7. **Mudanças no mesmo dia e a janela.** A mudança é posta no dia em que a contagem a viu; a lista diz "entre 06:00 e 12:00" ou "em algum momento entre dd/mm e dd/mm" quando a coleta ficou parada. **Padrão: marcador no dia final da janela.**
8. **"Saiu do YouTube" não tem botão Manter/Apagar aqui**, só o atalho para a fila ("Responder em Saíram do YouTube"). **Padrão: um só lugar para responder.**
9. **Dia da publicação sem barra.** Quando o vídeo sai depois do meio-dia, a primeira contagem das 12:00 é só no dia seguinte; a coluna do dia da publicação mostra a linha da publicação e nada mais. **Padrão: assim.**
10. **A leitura por hora começa em 04/10 neste exemplo.** É data de exemplo; o implementador usa a real do deploy da E2.

11. **(r9-S4) Total das 72 horas contra "Com 3 dias".** No `cheio` o total das 72 horas (9.671) é menor que o "Com 3 dias" (9.729): a janela das 72 barras termina na última hora cheia antes de completar 3 dias. Hoje só o botão de informação diz isso. **Padrão: manter só no botão de informação.** Alternativa: pôr "Última hora: 19:00 a 20:00 de 11/10." na linha de apoio. Sem mudar a tela até o dono decidir.
12. **(r9-S5) Faixa "exemplo" a 390 sem "Hoje é 13/10/2026".** A 1440 a faixa traz a data de hoje e as datas de início das contagens; a 390 só "Nomes, números e datas são de exemplo", então "há 3 dias" fica sem âncora no celular. **Padrão: manter assim** (faixa curta no celular). Alternativa: manter "Hoje é 13/10/2026" nas duas larguras. Sem mudar a tela até o dono decidir.

## 4. O que o implementador precisa saber

- **Cabeçalho do vídeo e o gráfico "Views por dia e cada troca" já existem em produção** (`_historico/`: `historico-screen.tsx`, `views-chart.tsx`, `lanes.tsx`); aqui a casca está redesenhada só para o mockup. É acréscimo: resumo, curva por idade, 72 horas, subida, a terceira raia "Outras", a pastilha "saiu do YouTube" e os estados `semanal`, `vazio`, `carregando`.
- **Fontes de dado:** views por idade = M1/M2 (`viewsAtAge`, `series.ts`); 72 horas = `competitor_video_early` (24 leituras por dia na fase 2); subida = M5 (`effect.ts`); mudanças = histórico de campo da E1; `series_tier` diz diária ou semanal.
- **Constantes que viram código:** início da contagem por dia 03/10/2026; início da leitura por hora (data do deploy da E2); corte 24/08/2026 (`countRuleOf`); mínimo de amostra 3 (`RULES.weakBase`); subida 2× e 1.000 views; janela 7 + 7 dias e 14 dias de antes; "entrou tarde na contagem" > 24 h; leituras vizinhas > 36 h (8 h para 1 dia).
- **Cada estado é uma função pura da medida** `{ estado: 'medido', valor, n, janela } | { estado: 'nao_medido', motivo, desde? }`. Nada de 0 por falta de dado: o `zero` só existe quando a contagem veio e foi zero.
- **Agrupamento das marcas:** por raia, ordenar por x e juntar enquanto a distância ao anterior for menor que 26 px; passa de 6 mudanças, linhas curtas.
- **A leitura por dia/idade/hora/semana é a alternativa em texto do gráfico** (o SVG é decorativo): manter `aria-live`, setas, Início/Fim/Esc e a tabela.
- **Alvos de toque** 44 x 44 px a 390 px; o ⓘ é o `A.ibtn` do lote 1. Nenhum `color-mix()`.
- **Uma escala só em cada gráfico (r8 B1):** no das 72 horas o eixo horizontal é o tempo real (horas desde a publicação): barra, hachura, marca de publicação, traços de 00:00 e 12:00 e linha de 1/2 saem da mesma conta, `L + horas * u`; cada barra vai de `t - 1` a `t` horas (a primeira, parcial, da publicação até a hora cheia) e é nomeada na leitura pelo mesmo intervalo do relógio. Nos de dias e de semanas a escala é a coluna do dia; a marca de uma mudança com a contagem parada fica na divisa dos dois dias da janela. Quem implementar confere por script que a posição desenhada, convertida pela escala, é o número que a frase diz.
- **Marcas do normal das 72 horas (r8 S5):** o n vem da lista do canal; os horários de 1/4, 1/2 e 3/4 do normal são exemplo digitado (`m13.js`): o implementador calcula a mediana por canal.
- **Peças reaproveitadas do lote 1** (cópias congeladas nesta pasta): `a4.css`, `a4-comum.js`, `lote.css`, `lote.js`. Peças novas: `m13.css` (prefixo `hv-`), `m13.js` (a tela), `m13-graf.js` (os quatro desenhos), `m13-dados.js` (motor e exemplos). Nada foi alterado fora desta pasta.
- **Limites do que foi verificado (depois da r1):** refiz as 56 capturas e medi de novo (rolagem horizontal 0, nenhum texto abaixo de 12 px, nenhum alvo abaixo de 44 px a 390, nenhum erro de script, nenhuma colisão entre rótulos da régua de horas). Abri e conferi a olho recortes de gráfico de `cheio`, `extremo`, `zero`, `naomedido`, `recente`, `magro`, `saiu` e `semanal`, e o topo de `cheio`, `recente`, `saiu`, `zero` e `erro` (1440 escuro e 390 claro, mais alguns cruzamentos); os demais estados foram medidos, não abertos um a um. Leitor de tela, Safari e Opera não foram testados; a rodada 2 do revisor de UX é a conferência final.

## 5. Dado real × exemplo (por tela, r1 C10)

Tudo que a tela mostra de canal, título, número de views e dia da semana é **exemplo inventado**, em todos os estados. As únicas constantes reais são as regras e as datas do produto.

| Item | Real ou exemplo |
|---|---|
| Nomes de canal, títulos, capas, durações, views, horas de publicação | exemplo (inventado) |
| Os estados `recente` e `magro` | reproduzem a **situação** real de hoje (13/10/2026): vídeo de 3 dias e vídeo publicado antes de 03/10, sem subida e sem curva de 30 dias; os números e nomes são inventados |
| Os estados `cheio`, `extremo`, `semanal`, `leitura` | exemplo de **novembro** (dia de exemplo 11/11/2026), porque hoje nenhum vídeo tem 15 dias de contagem por dia |
| 03/10/2026 (início da contagem por dia) | real |
| 24/08/2026 (mudou a regra de contar views) | a data e a frase são constantes de exemplo no mockup (`D.CORTE`, texto fixo em `m13-graf.js` e no ⓘ do `semanal`); o implementador tira a data e a frase de uma fonte real (registro do produto sobre mudança de regra do YouTube) ou corta a linha tracejada: não copia a frase do mockup (r8 S2) |
| 04/10/2026 (início da contagem por hora) | exemplo; o implementador usa a data real do deploy da E2 |
| Subida: ritmo 2× e ganho de 1.000 views; janelas de 7 + 7 dias e 14 dias antes; mínimo de 3 vídeos no normal | reais (regras do spec) |
| 08/10 a 11/10 do estado `naomedido` ("entrou tarde na contagem", contagem perdida) | exemplo |

## 6. Resposta à revisão r1 (`REVISAO-UX-r1.md`)

Todos os itens foram aceitos. Nenhum bloqueio foi contestado; onde o conserto sugerido foi ajustado, está dito.

| Item | O que foi feito |
|---|---|
| B1 | O resumo do `zero` usa a mesma conta do bloco: "em 47 das 67 horas medidas também não" (as 5 horas "não medido" saem do denominador nos dois lugares). |
| B2 | A frase da curva no `naomedido` sai dos pontos desenhados: "Só 1 dos 5 pontos que já existem tem contagem; os outros 4 são "não medido", cada um com o motivo. Os 5 pontos de idades maiores ainda não existem."; concordância tem/têm e o/os calculada. "Passe o dedo" saiu (ver C5). |
| B3 | `razao()` devolve a frase pronta e ninguém concatena " o normal": "perto do normal", "0,9 vez o normal, abaixo", "2,8 vezes o normal" (a faixa de números usa o mesmo texto). |
| B4 | Erro: "O servidor não respondeu. Tente de novo; se continuar assim, avise." Sem "nada foi perdido". Ajuste: tirei do conserto sugerido a repetição "não deu para abrir o histórico", que já é o título do aviso. O bloco "O que dá para ver enquanto isso" ficou. |
| C1 | Linhas (mudança, "½ das views", 24/08) desenhadas por baixo das barras e dos textos; todo número e data leva contorno de 4 px da cor do cartão. Rótulo do pico das 72 horas troca de lado ao colidir com a linha de metade, e o rótulo "½ das views" sobe para fora da área das barras. Rótulos de valor da curva por idade: o de cima à esquerda do marcador, o de baixo à direita. Texto "sem contagem antes de 05/10" (`semanal`) sai da frente da linha de 24/08. Ajuste: em vez de parar a linha no zero, ela continua mas se interrompe em volta do texto, o que mantém a ligação mudança → dia. |
| C2 | "0" em cima de cada caixa vazada do gráfico por dia. Na barra da hora a regra do item 16 foi corrigida (legenda e leitura do ponto), como o revisor propôs. |
| C3 | O resumo dos estados com subida termina com "Nos 14 dias antes, o canal mudou o título (11/10) e a miniatura (13/10)."; no `extremo`: "O canal fez 14 mudanças no vídeo, 12 delas nos 14 dias antes (a lista está no fim da página)." Lista, sem causa. |
| C4 | Capa de 120 x 68 px ao lado do título a 390 px, fatos e botões na largura toda, aviso de exemplo reduzido a uma frase. A frase-resumo passou de y = 1.100 a 1.207 para 905 (hoje) e 952 a 975 (novembro). A meta de 900 foi atingida pelo cartão (começa uns 25 px antes da frase) nos estados de hoje, **não** nos de novembro (cartão em ~927 a 950), porque o aviso de futuro e, no `leitura`, o aviso de só leitura ficam acima; não mexi na casca de 680 px. |
| C5 | Frase de leitura por ponteiro: "Toque no gráfico…" com dedo, "Passe o mouse sobre o gráfico…" com mouse; vale também para "Toque em cada barra com hachura rosa". |
| C6 | Quartil ausente vira ponto hachurado "não medido" na ponta de 0 h da régua, mais uma frase com o motivo e a idade da primeira contagem ("7 h 40 min depois de publicar"). A mesma lógica vale para ½ e ¾; `aria-label` da régua diz o que falta. |
| C7 | Rótulos de hora que se tocam descem para uma segunda linha (medido na página: 0 sobreposições nos 14 estados a 1440 e a 390 px; `zero` a 390 px mostra "7 h" e, embaixo, "12 h"). |
| C8 | A célula "Subida" do `semanal` diz "contagem por semana"; "série" só aparece em "inconclusivo: série semanal" (texto do spec), e o ⓘ desse cartão abre com "Série: a sequência de contagens; aqui, uma por semana." |
| C9 | "Precisa de 15 dias de contagem por dia (7 antes, o dia da subida e 7 depois); o vídeo saiu do YouTube com 4 dias de contagem, então a subida não vai ser medida." |
| C10 | `NOTAS.md` e a barra do mockup passam a dizer "reproduzem a situação real de hoje com dados inventados", e a seção 5 traz a tabela dado real × exemplo. |
| S1 | `extremo`: uma linha diz "12 das 14 mudanças estão nos 14 dias antes da subida; só as outras levam marca", e a marca vira "fora dos 14 dias antes". |
| S2 | O botão "Responder em "Saíram do YouTube"" passou a neutro. A etiqueta "+ novo" ganhou 16 px de respiro em cima da pastilha "saiu do YouTube" (conferido em `saiu` e `mantido`, 1440). |
| S3 | A linha de saída fica na borda esquerda do dia 09/10; esse dia entra na área pontilhada, com "✕ saiu do YouTube em 09/10" ao lado. |
| S4 | "barra hachurada" virou "barra com hachura rosa"; "leituras vizinhas" virou "contagens vizinhas". "Descoberto tarde" ficou (lista fechada do spec) e já vem com a explicação "o vídeo entrou na contagem 76 horas depois de publicado". |
| S5 | Os quatro ⓘ têm o nome do bloco ("Como ler a curva por idade", "Como ler as 72 horas", "Como ler o dia a dia e as mudanças"; o da subida já era próprio). |
| S6 | Esqueleto de carregamento no tom de `--border-strong` (cerca de 1,4:1 no escuro e 1,8:1 no claro contra o cartão). |
| S7 | A duração do vídeo de `carregando` passou a 11:05, igual a `recente` e `erro`. |
| S8 | "＝" na frente de "perto do normal" (resumo, faixa e pares). |
| S9 | A linha de leitura (aria-live) fica logo abaixo do gráfico; a legenda vem depois. |

## 7. Resposta à revisão r2 (`REVISAO-UX-r2.md`)

Todos os itens foram aceitos, nenhum contestado. Medido de novo com script próprio (56 páginas: 14 estados x 1440/390 x escuro/claro): razão das larguras dos pares contra a razão dos valores, texto de SVG fora do SVG, colisão de rótulos de SVG.

| Item | O que foi feito |
|---|---|
| B1 | Barras dos pares: `width:calc((100% - 120px) * valor/máximo)` nas duas barras (era `calc(P% - 90px)`, que achatava as diferenças). Reserva de 120 px (era 90) porque "1,02 milhão" é mais longo que "1,02 mi". Medido: `cheio` 30 dias 94,3 mil contra 33,8 mil = 2,79; barras 148,0 e 53,0 px = 2,79. `extremo` 1 dia 6,44 contra 148/23,0 = 6,43; `zero` 1 dia 20 contra 160 = 18,5 contra 148 px. O piso de largura caiu de 8 para 4 px (só vale para valor maior que zero): no `extremo` 30 dias (21,6 vezes) a barra do normal tem 6,9 px de verdade e o piso não a engorda mais. |
| B2 | Rótulo do pico das 72 horas: tenta a direita; se não couber ou cruzar a linha de "1/2 das views", tenta a esquerda, mas só se couber depois do eixo; se nenhum lado serve, sobe uma linha, e como último recurso centraliza preso às bordas. Também ganhei folga no topo do gráfico (escala com 20% a mais no lugar de 5%), assim o rótulo do pico nunca encosta em "1/2 das views". Medido: 0 texto fora do SVG nos 56 cruzamentos (eram 6) e 0 colisões de rótulos em todos os gráficos, salvo o "0" do eixo contra "dias" na curva por idade a 390 px (caixas de texto que se roçam em 2 px, já registrado pelo revisor como sem efeito visível; não mexi). |
| C1 | Série semanal a 390 px: o rótulo vai em cima do ponto; se tocar um rótulo já posto, desce para baixo do ponto; se também tocar, fica só na linha de leitura e na tabela (o valor nunca se perde). Medido: 0 colisões ("722 x 723" e "783 x 725" sumiram). |
| C2 | Pastilha "saiu do YouTube em 09/10 · mantido para análise" abaixo de 420 px: `padding:6px 12px`, `line-height:20px`, `min-height:32px`. |
| C3 | Célula "Subida" do `semanal` na forma neutra (relógio, contorno cheio, "contagem por semana"): o dado semanal chegou, só não decide, então não leva a hachura rosa de "não medido". Os pontos de 1, 7 e 30 dias seguem rosa. |
| C4 | Os dois ⓘ dos blocos "não medido" (`semanal` e `magro`) agora dizem "Como ler a curva por idade" e "Como ler as 72 horas". |
| S1 | Não feito: a casca de 680 px com aviso de exemplo e de só leitura é do lote 1, já aprovada pelo dono; se ele reclamar, o conserto proposto (aviso numa linha, cabeçalho sem capa) vale. |
| S2 | "1,02 milhão" e "2,4 milhões" no lugar de "mi". |
| S3 | Todos os quadrados do normal são desenhados antes dos círculos do vídeo: o círculo azul nunca fica por baixo. |
| S4 | Aceito como está: as caixas "x4", "x6" e "x2" se encostam a 390 px mas a lista abaixo diz tudo. |
| S5 | Marcas da régua, rótulo do gráfico e frases em "1/4", "1/2" e "3/4" (era ¼ ½ ¾ empilhado em 12 px). |
| S6 | Erro: "Os números e os gráficos aparecem quando o histórico abrir." |

## 8. Resposta à revisão r3 (`REVISAO-UX-r3.md`)

Todos os itens aceitos. Medido de novo com script próprio (14 estados x 1440, 390 e 360 px): colisão entre caixas de rótulo da régua de horas = 0 em todos; rolagem horizontal 0; erros de script 0; `capturar.mjs` nos 56 cruzamentos (1440 e 390 x escuro e claro): rolagem 0, texto abaixo de 12 px 0, alvo abaixo de 44 px a 390 0. `grep color-mix` só acha os comentários "sem color-mix".

| Item | Resposta |
|---|---|
| R3-B1 (`zero`, "1/41/2") | `separaRotulos()` (m13.js) agora mede também a FRAÇÃO ("1/4", "1/2") de cada marca. Se a fração toca a da marca anterior (folga de 6 px), a marca inteira desce para a segunda linha e lê "1/2 · 12 h" (a fração de cima fica oculta; o ponto continua na régua). Conferido a 1440, 390 e 360 nos 11 estados com régua: 0 colisões. Aberto: `zero` 390 claro. |
| R3-C1 (linha de "1/2 das views" atravessa o pico) | O rótulo do pico é posicionado ANTES da linha. Se o texto cruzaria a linha (4 px de folga), a linha abre um vão no lugar do texto; nenhum traço passa dentro da frase. A escala do gráfico não mudou. Abertos: `cheio` e `recente` a 390 claro. |
| R3-C2 (`extremo`, prosa de datas no cartão) | Com mais de 4 mudanças nos 14 dias antes, o cartão diz só "12 mudanças nos 14 dias antes da subida (a lista está logo abaixo)." A frase-resumo diz "no fim da página" e o cartão "logo abaixo" (dois pontos de leitura, a lista é uma só). Com 4 ou menos, como antes. |
| R3-C3 (`semanal`, duas datas) | As datas das leituras semanais saem de UMA lista (`SEM_DATAS`). O bloco de idade diz "a contagem começou (03/10), e a primeira contagem dele é de 05/10"; o gráfico diz "sem contagem por semana antes de 05/10". |
| R3-C4 (nome do ⓘ no `semanal`) | "Como ler a contagem por semana". |
| S1 a S5 | Mantidas como sugestão (casca do lote 1, "x4/x6/x2" aceito, datas do gráfico de `extremo`); nenhuma piorou. |

### Achados da varredura de coerência (novos, fora do que a r3 citou)

| # | Estado | Contradição | Conserto |
|---|---|---|---|
| V1 | todos de "hoje" | O n do normal por idade era digitado (4, 4, 3, 2, 2, **1** com 14 dias, ...): em 13/10 só há 10 dias de contagem, então nenhum outro vídeo pode ter 14 dias de idade. `zero` e `naomedido` tinham "2 vídeos" com 14 dias. | O n sai de UMA lista de datas de publicação dos outros vídeos (`PUBS_OUTROS`) e do dia da tela (`nsEm`). Hoje: [5, 4, 3, 3, 2, 0, 0, 0, 0, 0]; novembro: [14, 14, 14, 13, 12, 10, 7, 5, 0, 0]. |
| V2 | todos com 72 h | O n do normal das 72 horas (ex.: 6) menor que o n da curva por idade com 3 dias (14) parecia contradição. | O n das 72 horas é limitado por `teto72` (vídeos publicados desde 04/10 com 3 dias completos) e o ⓘ diz "com as 72 horas completas ... por isso o n é menor que o da curva por idade". |
| V3 | `magro` | Publicado em 20/09 (23 dias), a célula "Com 30 dias" dizia "não medido: publicado antes de 03/10", mas 30 dias só chega em 20/10, depois de 03/10: o motivo era falso. | Publicado em 03/09 (40 dias): todas as idades até 30 dias caem até 03/10, motivo verdadeiro; 60 e 90 dias "ainda não existe". A regra de idade agora compara a data da idade com 03/10. |
| V4 | `naomedido` | A mudança dizia "contagem ficou parada entre 08/10 e 10/10" com barras medidas em 09/10 e 10/10. | A janela é 10/10 a 12/10, o buraco real (falta a contagem de 11/10). |
| V5 | `vazio` | "o vídeo for descoberto às 18:00" no futuro, com "312 views agora" (só se vê view depois de descoberto). | "O vídeo foi descoberto às 18:00, com 312 views. A primeira contagem por hora entra às 19:00 de hoje". |
| V6 | `recente`, `aovivo`, `magro`... | "O canal mudou o vídeo 1 vez (título, miniatura e outras)" com uma só mudança, de miniatura. | A frase lista só os tipos que aparecem na lista de baixo ("(miniatura)"). |
| V7 | `zero` | "31 views ." com um círculo solto antes do ponto. | Círculo colado à palavra. |

## 9. Tabela de coerência por estado (varredura r3)

Fonte única dos dados: `m13-dados.js` (motor: a soma dos dias fecha com o cabeçalho; a curva por hora e a por dia saem da mesma contagem acumulada) + `PUBS_OUTROS` (n do normal) + `SEM_DATAS`. Conferido por script (`M13_DEBUG`, 14 estados x 3 larguras): total = soma das barras + primeira contagem; contagem acumulada das horas nunca decresce; 1/4 <= 1/2 <= 3/4; views por idade nunca decrescem nem passam do total; n do normal nunca cresce com a idade; normal "não medido" exatamente quando n < 3; n das 72 horas <= teto; nenhuma data da tela anterior à publicação, exceto as constantes 03/10, 04/10 e 24/08; nenhuma falha. Depois conferido contra o texto da tela (mesmo DOM das capturas) e abertas as capturas de `zero` 390, `magro` 1440, e os recortes de `cheio`, `recente`, `extremo`, `semanal` a 390.

Hoje = 13/10/2026; "novembro" = 11/11/2026. Os números abaixo valem para as duas larguras e os dois temas.

**`cheio`** (publicado 08/10 20:40, 34 dias)
| Número | Deriva de | Fecha com |
|---|---|---|
| 97,9 mil views (cabeçalho e "Views agora") | soma das barras por dia + primeira contagem = 97.909 | linha "Com 30 dias" 94,3 mil (30 dias = 07/11) <= 97,9 mil |
| 5.440 / 13,5 mil / 94,3 mil (1, 7, 30 dias) | contagem acumulada interpolada | cresce com a idade; pontos do gráfico e da tabela são os mesmos |
| normal 5.200 (14 v.), 15,2 mil (12 v.), 33,8 mil (5 v.) | `nsEm(11/11)` | 14 >= 12 >= 5; todos >= 3, logo medidos |
| 2,8x (30 d), "＝" (1 d), 0,9x abaixo (7 d) | 94.319/33.760 = 2,79; 5.440/5.200 = 1,05; 13.535/15.160 = 0,89 | mesma regra do lote 1 (±10%) |
| Subida 16/10, 49.601 views, 7.086 contra 1.497 por dia, 4,7x | cum(23/10) - cum(16/10); 7.086 x 7 = 49.602; 7.086/1.497 = 4,73 | resumo, célula, cartão: mesma subida |
| mudanças: título 11/10, miniatura 13/10 (resumo) | lista: itens 1 e 2, "dentro dos 14 dias antes" (02/10 a 15/10); itens 3 (18/10) e 4 (02/11) fora | resumo, cartão e lista dizem o mesmo; frase do bloco "4 vezes" = 4 itens |
| 72 h: 1/2 em 22 h, 1/4 em 7 h, 3/4 em 40 h; primeira contagem 01:00, 4 h 20 min, 1.789 views | 20:40 + 4 h 20 = 01:00; tot72 9.671 | 1/4 <= 1/2 <= 3/4; 1.789 é 18% de 9.671, abaixo de 1/4: a marca de 1/4 (7 h) vem depois da primeira contagem, logo medida |
| normal 72 h: 6 vídeos, 9/20/41 h | `m14` <= teto 13 | ⓘ explica o n menor |

**`extremo`** (publicado 09/10 18:20, 33 dias)
| Número | Deriva de | Fecha com |
|---|---|---|
| 1,04 milhão / 1,02 milhão (30 dias) | soma das barras 1.043.955; idade 30 = 1.019.118 | 1,02 <= 1,04 |
| 21,6x | 1.019.118/47.270 | célula, frase do bloco e do resumo |
| Subida 17/10, 543.292 views, 77.613 contra 16.591, 4,7x | (cum 24/10 - cum 17/10)/7; (cum 17/10 - cum 10/10)/7 | 543.292/7 = 77.613 |
| "14 mudanças, 12 nos 14 dias antes" | lista de 14 itens; datas 03/10 a 16/10 = itens 1 a 12 | cartão: "12 mudanças"; lista: 12 sem marca "fora", 2 com |
| raias: título 1, 4, 7, 10, 14; miniatura 2, 3, 5-6 (x2), 9, 12; outras 8, 11, 13 | tipos da lista (5 + 6 + 3 = 14) | 14 |
| 72 h: 1/4 "não medido", 1/2 em 23 h, 3/4 em 39 h; 1ª contagem 02:00 com 24.832 views | 24.832 > 1/4 de 85.708 (21.427): já passou do quarto | o motivo na tela diz isso |

**`recente`** (publicado 10/10 11:20, 3 dias; caso real de hoje)
| Número | Deriva de | Fecha com |
|---|---|---|
| 10,8 mil views | 6.330 + 2.867 + 1.649 = 10.846 | barras do dia |
| 1 dia 6.257, 3 dias 10,8 mil (10.817) | interpolação | 6.257 < 6.330 (leitura de 11/10 12:00); 10.817 <= 10.846 |
| normal 5.200 (5 v.), 9.520 (3 v.) | `nsEm(13/10)` = [5, 4, 3, ...] | 1,2x e 1,1x |
| 7 e 30 dias "ainda não existe, fecha em 17/10 e 09/11" | 10/10 + 7 e + 30 | célula = frase do gráfico |
| Subida "são 3, faltam 12, fecha em 25/10" | 15 - 3 = 12; hoje 13/10 + 12 (= 10/10 + 15) | 3 dias de contagem (11, 12, 13/10) |
| 72 h: 1/4 8 h, 1/2 17 h, 3/4 36 h; 1ª contagem 13:00 (1 h 40 min), 485 views | 11:20 + 1 h 40 = 13:00 | normal "só 2 vídeos" = `teto72` 2 (06/10 e 07/10) |

**`magro`** (publicado 03/09 10:00, 40 dias)
| Número | Deriva de | Fecha com |
|---|---|---|
| 22,5 mil views | 20.106 (primeira contagem, 03/10) + 10 barras = 22.540 | "11 dias" de contagem (03/10 a 13/10) |
| "Com 1, 7, 30 dias: não medido, publicado antes de 03/10" | 03/09 + 30 dias = 03/10 <= 03/10 | só vale até 30 dias; 60 e 90 "ainda não existe" |
| 5 vídeos com 1 dia | `nsEm(13/10)[0]` | mesmo n do `recente` |
| Subida "são 11, faltam 4, fecha em 17/10" | 15 - 11 = 4; hoje 13/10 + 4 (= 03/10 + 14) | 11 dias de contagem (o primeiro não medido) |
| 72 h não medido: "antes de 04/10" | 03/09 < 04/10 | |

**`zero`** (publicado 04/10 09:10, 9 dias)
| Número | Deriva de | Fecha com |
|---|---|---|
| 32 views | 21+5+2+0+1+1+1+0+1 | "2 dos 9 dias": dois zeros nas 9 barras |
| "47 das 67 horas medidas", "20 horas ganhou algumas" | 72 - 5 horas antes da 1ª contagem (14:00, 4 h 50 min) = 67; 47 + 20 = 67 | caixas vazadas do gráfico |
| 1 dia 20 views, 7 dias 31 | interpolação | 31 <= 32; normal 160 (5 v.) -> 0,1x abaixo; normal de 7 dias "não medido, só 2" (n < 3) |
| 1/4 7 h, 1/2 12 h, 3/4 25 h | tot72 27 | régua sem sobreposição (R3-B1) |
| 14 dias "fecha em 18/10"; subida "são 9, faltam 6, fecha em 19/10" | 04/10 + 14; 15 - 9 = 6, 13/10 + 6 | 9 dias de contagem |

**`naomedido`** (publicado 05/10 08:00, 8 dias)
| Número | Deriva de | Fecha com |
|---|---|---|
| 11,5 mil views | 7.750 (1ª contagem, 08/10) + 849 + 752 + 1.467 (11 e 12/10 juntos) + 724 = 11.542 | barras e "5 estão não medido": 06, 07, 08, 11, 12/10 |
| "76 horas depois de publicado" | 05/10 08:00 + 76 h = 08/10 12:00 = `desde` | 76 > 72: o bloco de 72 h inteiro é "não medido" |
| idade: 1 de 5 pontos medido (5 dias = 9.226) | 09/10 e 10/10 medidos e vizinhos de 10/10 08:00 | 1, 2, 3 d "entrou tarde na contagem"; 7 d "contagens a mais de 36 h" (falta 11/10); 14 a 90 d "ainda não existe" (5 + 5 = 10 pontos) |
| mudança "entre 10/10 e 12/10" | buraco de 11/10 (V4) | |

**`semanal`** (publicado 11/08 17:30, 92 dias)
| Número | Deriva de | Fecha com |
|---|---|---|
| 73,8 mil views | 73.829 | pontos semanais 722, 723, 968, 783, 725 = (cum na semana - cum na anterior)/7 |
| "53 dias quando a contagem começou (03/10)" | 11/08 a 03/10 | "primeira contagem de 05/10" = gráfico "antes de 05/10" = barra rosa em 05/10 |
| 24/08 | regra real, depois da publicação | |
| 14 vídeos com 1 dia | `nsEm(11/11)[0]` | mesma lista dos outros estados de novembro |

**`saiu` e `mantido`** (publicado 04/10 16:00; saiu em 09/10; última contagem 08/10)
| Número | Deriva de | Fecha com |
|---|---|---|
| 7.657 views, "4 dias" | 3.828 + 1.964 + 1.076 + 789 | 4 barras; "4 dias de contagem" no cartão |
| 1 dia 4.260 (0,8x), 3 dias 7.016 (0,7x) | interpolação; 3 dias = tot72 | 7.016 <= 7.657; 5 d em diante "saiu antes" (09/10 16:00 > 08/10) |
| 72 h: 1/4 6 h, 1/2 16 h, 3/4 33 h | | normal "só 1 vídeo" <= teto 2 |
| mudança 06/10 | entre 04/10 e 08/10 | |
| `mantido` = `saiu` + pastilha "mantido para análise", sem o botão "Responder" | diferença conferida por texto | |

**`aovivo`** (publicado 08/10 19:00, 5 dias)
| Número | Deriva de | Fecha com |
|---|---|---|
| 12,4 mil views | 3.354 + 3.321 + 2.296 + 1.795 + 1.586 = 12.352 | "Com 1 dia 4.699" <= total; 3 dias 9.606 = tot72 |
| sem normal | ao vivo fica fora (a frase diz) | célula, gráfico e régua dizem "fora do normal" |
| 1/4 9 h, 1/2 25 h, 3/4 46 h; 1ª contagem 01:00 (6 h) | 19:00 + 6 h | |
| Subida "são 5, faltam 10, fecha em 23/10" | 15 - 5 = 10; 13/10 + 10 | 5 barras |

**`vazio`** (publicado 13/10 17:10)
| Número | Deriva de | Fecha com |
|---|---|---|
| 312 views | leitura da descoberta (18:00) | cabeçalho, resumo e bloco de 72 h dizem 312 |
| "1 dia fecha em 15/10", 7 d 21/10, 30 d 13/11, subida 28/10 | 14/10 17:10 -> 1ª leitura depois = 15/10; + 7, + 30; 13/10 + (15 - 0) | "primeira barra amanhã" (14/10, 12:00) |

**`carregando`, `erro`, `leitura`**: `carregando` e `erro` não mostram número nenhum (nada a conferir; o cabeçalho do `erro` não traz views, só título, canal e data). `leitura` é o `cheio` com o aviso de só leitura e botões desabilitados; diferença conferida por texto (uma linha a mais, nenhum número muda).


## 10. Resposta à revisão r4 (`REVISAO-UX-r4.md`)

Medido de novo: `capturar.mjs` nos 14 estados (56 cruzamentos: 1440 e 390 x escuro e claro): rolagem horizontal 0, texto abaixo de 12 px 0, alvo abaixo de 44 px a 390 0; erros de script 0 nos 14 estados; `grep color-mix` só acha comentários. Abertas por captura: `cheio` e `extremo` 1440 escuro, `carregando` 1440 escuro e 390 claro, `recente` 390 claro. As capturas de `shots/` foram refeitas (`m13-<estado>-<largura>-<tema>.png`).

| Item | Resposta |
|---|---|
| R4-B1 (subida: "14 dias... são N... fecha em D") | Constante única `NECESSARIOS = 15` (7 antes, o dia e 7 depois, a regra do ⓘ). O texto, a conta "faltam" e a data "fecha em" saem dela e da contagem de dias do próprio gráfico: fecha em = hoje + (15 - N). A frase agora diz "Precisa de 15 dias de contagem por dia (7 antes, o dia da subida e 7 depois); são 3. Faltam 12: fecha em 25/10." Conferido: `recente` 3 + 12 = 25/10, `magro` 11 + 4 = 17/10, `zero` 9 + 6 = 19/10, `aovivo` 5 + 10 = 23/10, `vazio` 0 + 15 = 28/10; `saiu` e `mantido` dizem 15 sem "fecha em". O limite "nD < 15" do código e o aviso de novembro ("nenhum vídeo tem 15 dias de contagem por dia") leem a mesma constante. Primeira letra da frase em maiúscula depois de "Subida: não medido." |
| R4-C1 (`carregando` com título de status) | O estado usa o título real ("Os 5 piores erros em Bangkok", mesma capa do `erro`); só os blocos ficam em esqueleto e a frase "Carregando o histórico do vídeo." aparece uma vez, visível, abaixo dos botões (antes era só para leitor de tela). |
| R4-C2 (aba "Mudanças 12" e "vídeo 1 de 12") | Acréscimo permitido pela convenção, **a registrar no LEIAME do lote** (não existe LEIAME na pasta deste mockup): `L.obs({ nMud })` troca o número da aba Mudanças (padrão 12, igual ao lote 1) e `L.pager(total, daLista)` diz "vídeo 1 de N da lista de Mudanças, na ordem da lista...". No `extremo`, `nMud` = 31 (maior que as 14 mudanças do vídeo). O pager some em `vazio`, `carregando` e `zero` (vídeo sem nenhuma mudança); fica em `magro`, `recente`, `naomedido`, `saiu`, `mantido`, `aovivo` (1 mudança cada), `semanal`, `cheio`, `leitura` e `erro` (a posição na lista é conhecida pela lista). Os arquivos copiados `lote.js` desta pasta levam a mudança; o do lote 1 (congelado) não foi tocado. |
| S1 (rótulos do gráfico por dia) | Com mais de 12 barras só o melhor dia e o último levam número (`cheio`: 9.934 e 948; `extremo`: 111.072 e 8.723); com até 12 barras, todos que cabem. |
| S2 (hachura e "pico") | A hachura "não medido" das primeiras horas ocupa a altura toda do gráfico (não sugere uma grandeza); o rótulo do pico diz "maior hora medida: 1.996". |
| S3 (marca dentro/fora muda de lado) | Uma convenção só: a marca "fora dos 14 dias antes" fica nos itens de fora, em todo estado com subida; a frase acima da lista diz sempre quantos estão dentro ("2 das 4 mudanças estão nos 14 dias antes da subida; as outras levam a marca..."). |
| S4 (linha da mudança cortando o número) | Conferido nas capturas: o contorno de 4 px da cor do cartão já cobre os números (a linha passa por baixo); não achei corte nas 56 capturas. Sem mudança. |
| S5 (palavras de motor) | "descoberto tarde" virou "entrou tarde na contagem"; "primeira leitura" e "leitura perdida" viraram "primeira contagem" e "contagem perdida". "série semanal" **mantida**: é a frase do spec (pergunta 16); o dono decide se troca por "contagem por semana". |
| Extra (achado na varredura) | "1,04 milhão views" virou "1,04 milhão de views" (cabeçalho e frases do `extremo`). |
| R4-S1 da r2 (resumo abaixo da primeira tela a 390 px) | Mantida, vem da casca do lote 1. |

## 11. Varredura de coerência da r4: tabela por estado

Regra desta rodada: todo número derivado nasce de uma fonte única e a tela só o escreve. Fontes: `m13-dados.js` (motor: curva, dias, subida), `PUBS_OUTROS` (n do normal e teto das 72 horas), `SEM_DATAS`, `NECESSARIOS` (15), `nMud` (aba e pager), `HOJE` = 13/10/2026, `FUT` = 11/11/2026. Conferido por script no DOM de cada estado a 1440 (texto visível, tabelas escondidas, rótulos de aria, `M13_DEBUG`): total = soma das barras (+ 1ª contagem); "são N" = número de barras; faltam = 15 - N; fecha em = hoje + faltam; nenhuma data anterior à publicação (exceto as constantes 03/10, 04/10, 24/08); nenhuma data futura fora de "fecha em" nos estados de hoje; nenhum "X de Y" com X > Y; razão escrita = razão dos números exibidos. Depois lido o texto inteiro de cada estado. A tabela da seção 9 continua valendo; abaixo, o que fecha em cada estado, incluindo o que esta rodada mudou.

| Estado | Número mostrado | De onde vem | Fecha com |
|---|---|---|---|
| `cheio` | aba "Mudanças 12", "vídeo 1 de 12 da lista de Mudanças" | `nMud` = 12 (padrão) | uma só fonte para aba e pager |
| `cheio` | "2 das 4 mudanças nos 14 dias antes"; marca "fora" nos itens 3 e 4 | itens com data em [16/10 - 14, 16/10): 11/10 e 13/10 | resumo e cartão: "título (11/10) e miniatura (13/10)"; frase do bloco: "4 vezes" = 4 itens |
| `cheio` | rótulos 9.934 (melhor dia, 18/10) e 948 (último, 11/11) | barras do motor | 9.934 dentro da faixa de subida 16/10 a 23/10; 7.086 por dia de média dos 7 dias = 49.601 / 7 |
| `cheio` | "maior hora medida: 300" | maior barra do bloco de 72 h | 300 < 1.789 (soma antes da 1ª contagem) é só uma hora |
| `extremo` | aba "Mudanças 31", pager "1 de 31" | `nMud` = 31 | 31 > 14 mudanças do vídeo; "12 das 14 mudanças estão nos 14 dias antes" = 12 sem marca + 2 com marca |
| `extremo` | "1,04 milhão de views" total; "1,02 milhão de views" aos 30 dias | 1.043.955; 1.019.118 | 30 dias = 08/11 <= 11/11; 1,02 <= 1,04 |
| `extremo` | 21,6; 6,4; 5,9 vezes; 4,7 vezes o ritmo | 1.019.118/47.270; 46.9/7,28; 125/21,2; 77.613/16.591 = 4,68 | razão do que está escrito, arredondada uma vez |
| `recente` | "são 3; faltam 12; fecha em 25/10" | 3 barras (11, 12, 13/10); 15 - 3; 13/10 + 12 | cartão da faixa "fecha em 25/10" = mesma conta; 3 + 12 = 15 |
| `recente` | 10,8 mil = 6.330 + 2.867 + 1.649 | motor | barras; 3 dias = 10.817 <= 10.846 |
| `recente` | pager "1 de 12 da lista de Mudanças" (o vídeo tem 1 mudança) | `nMud` = 12 | vídeo com mudança: mostra |
| `magro` | "são 11; faltam 4; fecha em 17/10" | 11 barras (03/10 a 13/10); 15 - 11; 13/10 + 4 = 03/10 + 14 | 22.540 = 20.106 (1ª contagem) + 2.434 (10 barras medidas) |
| `zero` | "são 9; faltam 6; fecha em 19/10"; "2 dos 9 dias" | 9 barras: 21,5,2,0,1,1,1,0,1 = 32; zeros: 2 | pager e aba: pager escondido (nenhuma mudança) |
| `zero` | "47 das 67 horas medidas" e "20 horas ganhou algumas" | 72 - 5 (antes da 1ª contagem às 14:00) = 67; 47 + 20 = 67 | caixas vazadas |
| `naomedido` | "5 dos 8 dias não medido"; "1 dos 5 pontos que existem" | dias 06, 07, 08, 11, 12/10 sem medida; 5 idades já existem (1, 2, 3, 5, 7) | 3 barras medidas (849, 752, 724) + 5 não medidas = 8; 11.542 = 7.750 + 849 + 752 + 1.467 + 724; subida diz "faltam contagens", sem "são N" |
| `semanal` | "53 dias quando a contagem começou"; "primeira contagem de 05/10" | 11/08 a 03/10; `SEM_DATAS[0]` | gráfico "sem contagem por semana antes de 05/10"; 5 pontos medidos (722, 723, 968, 783, 725) de 6 datas |
| `saiu` e `mantido` | "4 dias com contagem"; 7.657 | 4 barras 3.828 + 1.964 + 1.076 + 789 | cartão: "saiu do YouTube com 4 dias de contagem", precisa de 15, sem "fecha em" (não vai ser medida) |
| `aovivo` | "são 5; faltam 10; fecha em 23/10" | 5 barras; 15 - 5; 13/10 + 10 | 12.352 = 3.354 + 3.321 + 2.296 + 1.795 + 1.586; "2 vídeos nessa condição saíram da conta" é só texto, sem outro número na tela para contradizer |
| `vazio` | "fecha em 28/10" (subida), 15/10, 21/10, 13/11 (idades) | 13/10 + (15 - 0); primeira leitura das 12:00 depois de pub + 1, 7, 30 dias | "primeira barra amanhã"; 312 views no cabeçalho, no resumo e no bloco de 72 h; sem pager (nenhuma mudança) |
| `carregando` | título e capa = os do `erro` | mesma fonte de título | mesma capa nos dois estados; sem aba contradizendo (pager escondido) |
| `erro` | "vídeo 1 de 12" | `nMud` | a posição vem da lista, que o erro diz ter sido a origem do título |
| `leitura` | idêntico ao `cheio` | cópia do caso | |
| todos de novembro | aviso "nenhum vídeo tem 15 dias de contagem por dia" | `NECESSARIOS` | a mesma constante dos cartões de hoje |

Nada digitado em dois lugares: "15" (`NECESSARIOS`), fecha em (hoje + faltam), são N (barras), total (soma), n do normal (`PUBS_OUTROS`), total da aba (`nMud`).


## 12. Resposta à revisão r5 (`REVISAO-UX-r5.md`)

| Item | O que foi feito |
|---|---|
| R5-B1 (ⓘ do `semanal`) | O ⓘ "Como ler a contagem por semana" tem texto próprio (`m13.js`, `blocoDias`): "Cada ponto: média de views por dia na semana que termina na data (soma das views da semana dividida por 7)", a hachura, a linha de 24/08 e a frase fixa do método. Nada de raias, faixa verde, barra de 24 horas nem soma que dá o total. A data da hachura ("antes de 05/10") sai de `SEM_DATAS[0]`, a mesma fonte do gráfico. Aberto por clique e lido na tela. O ⓘ do cartão de subida do `semanal` abre agora com "Contagem por semana: uma contagem a cada semana, em vez de uma por dia" |
| R5-C1 (primeira contagem de `extremo` e `zero`) | `m13-dados.js`: `Math.ceil(Math.round((tardeH - first) * 1e6) / 1e6)`. `extremo`: primeira contagem às 01:00, "6 h 40 min depois de publicar", 22.549 views já (26,3% de 85.708, por isso o 1/4 continua "não medido": já tinha passado quando a contagem começou, e a frase da régua diz isso). `zero`: primeira contagem às 13:00; "47 das 68 horas medidas", "21 horas ganhou algumas" (47 + 21 = 68). Junto, achei e consertei um defeito vizinho: o marco de 1/4, 1/2 e 3/4 era tirado de um tempo arredondado, e um marco que a primeira contagem já tinha passado podia aparecer como medido; agora, se a contagem de partida já tem aquela fração, o marco é "não medido" (`quando(f)` em `m13-dados.js`). Só o `extremo` muda por isso |
| R5-C2 (faixa de 8 barras) | `m13-graf.js`: a faixa começa na borda direita da barra do dia da subida (`x: L + cw * (is + 1)`, `width: cw * (ie - is)`) e o rótulo "▲ subida" vai junto. Medido nas capturas: 7 barras dentro da faixa em `cheio`, `extremo` e `leitura`, a 1440 e a 390; 17/10 a 23/10 somam 49.601 e 18/10 a 24/10 somam 543.292, os números da frase |
| R5-C3 (casca do `vazio`) | `L.obs({ fresh })` com "sincronizado há 20 min": o vídeo foi descoberto às 18:00 e agora são cerca de 18:20 |
| S1 (palavra de cor) | "Passe o mouse sobre cada barra hachurada" (sem "rosa") |
| S2 (rótulo do eixo de 72 h até 50 min à esquerda) | Não mexi: 1% de um eixo de 72 h, invisível; declarado ao implementador (a posição certa é a hora real, não a casa do índice) |
| S3 (primeira barra desde a publicação) | ⓘ do dia a dia: "A primeira barra conta desde a publicação." |
| S4 ("depois de 04/10") | ⓘ das 72 horas: "Só vídeos publicados a partir de 04/10" |
| S5 (mesmo n em canais diferentes) | Não mexi: os estados de hoje têm n digitado por vídeo (1, 2, 2, 1) e os de novembro vêm da lista única `PUBS_OUTROS`; separar por canal exigiria uma lista por canal e refazer todas as contas de n. O implementador usa o n real de cada canal |
| S6 (aviso só nos estados com dado) | `vazio`, `carregando` e `erro` levam o aviso de uma linha "Nomes, números e datas são de exemplo. Hoje é 13/10/2026." (a 390 px só a primeira frase) |
| S7 (frase de 3 orações no `leitura`) | Cortei "este vídeo é de um concorrente e não tem número privado" |
| S8 (declarações abertas) | "série semanal" saiu da tela: a regra de frases sem jargão vence (a frase do spec fica como alternativa, seção 3 item 1). `L.obs({ nMud, fresh })` e `L.pager(total, daLista)` seguem registrados na seção 10 |

## 13. Varredura de coerência da r5: tabela por estado (conferida contra as capturas e contra o DOM por script)

> Superada pela seção 15 (r6) nas linhas do `extremo` (o surto passou a começar 12 horas depois e o pico baixou: total 993 mil, subida 520.210 e 6,0 vezes) e no n do normal das 72 horas (agora 13, 13, 2, 2, 2, 2, 2, derivado da lista). Vale como histórico; para conferir a tela atual, use a seção 15.

Fonte única: o motor `m13-dados.js` gera os dias e as horas da MESMA curva acumulada; `PUBS_OUTROS` dá o n; `SEM_DATAS` dá as semanas; `NECESSARIOS` = 15; `HOJE` = 13/10 e `FUT` = 11/11. Nenhum número abaixo é digitado em dois lugares. A conferência foi um script que abre os 14 estados e compara texto, tabelas escondidas e `M13_DEBUG`; não achou nenhuma contradição nova além das cinco corrigidas acima.

Regra da primeira contagem por hora (vale para todo estado com hora): descoberta no próximo marco de 6 h depois de publicar (00, 06, 12, 18), primeira contagem na hora cheia seguinte; tempo = hora cheia menos a hora da publicação.

| Estado | Número mostrado | De onde vem | Fecha com |
|---|---|---|---|
| `cheio` | publicado 20:40; "primeira contagem às 01:00"; "4 h 20 min"; "1.789 views já" | marco 00:00, contagem 01:00 de 09/10; 20:40 até 01:00 = 4 h 20 | 1.789 < 9.671 (72 horas); metade em 22 h (régua e frase iguais); soma das horas até 12:00 de 09/10, 10/10 e 11/10 = barras 3.610, 7.176, 9.094 (cumulativo) |
| `cheio` | faixa verde "▲ 7 dias da subida" | 7 barras, 17/10 a 23/10 | soma 49.601 = frase; antes 10/10 a 16/10 = 10.478 (1.497 por dia); 49.601 / 7 = 7.086; razão 4,73 = "4,7 vezes" |
| `cheio` | total 97,9 mil; "Com 30 dias 94,3 mil"; normal 33,8 mil (5 vídeos) | soma de 34 barras = 97.909; idade 30 = 08/11 <= 11/11 | 94,3 <= 97,9; 94,3 / 33,8 = 2,79 = "2,8 vezes"; n 14, 12, 5 não crescem com a idade |
| `extremo` | "6 h 40 min", "01:00", "22.549 views já"; 1/4 "não medido" | marco 00:00, contagem 01:00 de 10/10; 18:20 até 01:00 = 6 h 40 | 22.549 / 85.708 = 26,3% > 25%: o 1/4 já tinha passado; metade em 23 h, 3/4 em 39 h = régua e frase; "maior hora medida: 2.283" = primeira barra medida (02:00) |
| `extremo` | faixa verde, 543.292, 77.613 contra 16.591, 4,7 | 7 barras, 18/10 a 24/10 | 543.292 / 7 = 77.613; antes 11/10 a 17/10 = 116.134, / 7 = 16.591; razão 4,68 = "4,7 vezes"; total 1.043.955 = soma das 33 barras |
| `extremo` | aba "Mudanças 31"; "12 das 14 mudanças" | `nMud` = 31; 14 itens; 12 com data entre 03/10 e 16/10 | 12 sem marca + 2 com marca "fora dos 14 dias antes" = 14 |
| `recente` | publicado 11:20; "primeira contagem às 13:00"; "1 h 40 min"; "485 views já" | marco 12:00, contagem 13:00 de 10/10 | metade em 17 h; 6.330 + 2.867 + 1.649 = 10.846 (total); 72 horas = 10.803; "Com 1 dia 6.257" (24 h) <= 6.330 (a barra de 11/10 vai até as 12:00, 24 h 40 min depois de publicar); 6.257 / 5.200 = 1,2 |
| `recente` | "são 3. Faltam 12: fecha em 25/10" | 3 barras (11, 12, 13/10); 15 - 3; 13/10 + 12 | 3 + 12 = 15; 11/10 + 14 = 25/10; "Com 7 dias fecha em 17/10", "30 dias 09/11" = pub + idade, depois das 12:00 |
| `magro` | "são 11 (começou em 03/10). Faltam 4: fecha em 17/10" | 11 contagens (03/10 a 13/10); 15 - 11 | 03/10 + 14 = 17/10; 22.540 = 20.106 (1ª contagem) + 2.434 (10 barras medidas); "11 dias" = 03/10 a 13/10 |
| `zero` | "primeira contagem às 13:00"; "47 das 68 horas"; "21 horas ganhou algumas" | marco 12:00, contagem 13:00 de 04/10; 72 - 4 horas "não medido" = 68 | 47 + 21 = 68; total 32 = 21 + 5 + 2 + 0 + 1 + 1 + 1 + 0 + 1; "2 dos 9 dias" = 2 barras zero em 9; as horas até as 12:00 de 05/10 somam 21 = a barra do dia |
| `zero` | "são 9. Faltam 6: fecha em 19/10"; "Com 7 dias normal: não medido, só 2" | 9 barras; PUBS_OUTROS com 7 dias completos em 13/10: 03/10 e 06/10 = 2 | 9 + 6 = 15; 13/10 + 6 = 19/10; 2 < 3 = "não medido"; "Com 30 dias fecha em 03/11" = 04/10 + 30 |
| `naomedido` | "5 dos 8 dias não medido"; "1 dos 5 pontos que já existem"; "76 horas depois de publicado" | dias 06, 07, 08, 11 e 12/10 sem medida; idades 1, 2, 3, 5, 7 já existem; 05/10 08:00 + 76 h = 08/10 12:00 | 3 barras medidas (849, 752, 724) + 5 = 8; 11.542 = 7.750 + 849 + 752 + 1.467 + 724; "1 dos 5" + "os 5 de idades maiores" = 10 idades |
| `semanal` | "53 dias quando a contagem começou (03/10)"; "primeira contagem de 05/10"; "(há 92 dias)"; 5 pontos | 11/08 a 03/10 = 53; `SEM_DATAS[0]`; 11/08 a 11/11 = 92 | gráfico, ⓘ e bloco de idade dizem 05/10 pela mesma fonte; 6 datas, 5 pontos medidos; total 73.829 |
| `saiu` e `mantido` | "primeira contagem às 19:00"; "3 h 00 min"; "4 dias com contagem"; 7.657 | marco 18:00, contagem 19:00 de 04/10; barras 3.828 + 1.964 + 1.076 + 789 = 7.657 | metade em 16 h; 72 horas = 7.016 < 7.657; normal de 72 horas "só 1 vídeo" <= teto de PUBS_OUTROS (2) |
| `aovivo` | "primeira contagem às 01:00"; "6 h 00 min"; "são 5. Faltam 10: fecha em 23/10" | marco 00:00, contagem 01:00 de 09/10 (19:00 até 01:00 = 6 h); 5 barras | 12.352 = 3.354 + 3.321 + 2.296 + 1.795 + 1.586; 09/10 + 14 = 23/10; sem normal ("fora do normal do canal") |
| `vazio` | "sincronizado há 20 min"; descoberta 18:00; "primeira contagem por hora às 19:00 de hoje"; 312 views; "fecha em 15/10, 21/10, 13/11, 28/10" | publicado 17:10, marco 18:00, contagem 19:00; agora cerca de 18:20 | a casca e o bloco de 72 horas contam a mesma hora; primeira barra "amanhã" (14/10, 12:00) e o ponto de 1 dia em 15/10 (24 h só em 14/10 às 17:10, e a leitura seguinte é 15/10 12:00); 13/10 + 15 = 28/10 |
| `carregando`, `erro` | título "Os 5 piores erros em Bangkok", capa igual; aviso de exemplo | mesma fonte de título; "vídeo 1 de 12" = `nMud` | sem número de dado para contradizer; o aviso diz "Hoje é 13/10/2026" |
| `leitura` | idêntico ao `cheio` (faixa de 7 barras, 49.601, 4,7) | cópia do caso | |
| todos de novembro | aviso "nenhum vídeo tem 15 dias de contagem por dia" | `NECESSARIOS` | a mesma constante dos cartões de hoje |

O que mudou em relação à seção 11: `extremo` (primeira contagem, 1/4 não medido, faixa de 7 barras), `zero` (47 das 68 e 21 horas, primeira contagem às 13:00), `cheio` e `leitura` (faixa de 7 barras) e `vazio` (sincronizado há 20 min). A linha de `zero` "47 das 67 horas" e "20 horas" da seção 11 e a "7 h 40 min" da seção 6 (C6) ficam substituídas por esta tabela.

## 14. Resposta à revisão r6 (`REVISAO-UX-r6.md`)

| Item | O que foi feito |
|---|---|
| R6-C1 (`semanal`: duas regras para a contagem por hora) | `m13.js`, `blocoHoras`: apagado o ramo `c.semanal ? '... até 14 dias'`. O `semanal` usa a mesma frase do `magro`: "publicado em 11/08/2026, antes de 04/10: a contagem por hora começou nesse dia e só vale para vídeos publicados depois". Uma regra só, por data de publicação (a do ⓘ). Conferido no DOM: `semanal`, `magro` e o ⓘ do bloco dizem a mesma data. |
| R6-C2 (ⓘ do `semanal`: "hachura" x pontilhado) | `infoHtml` do `semanal`: "Pontilhado: semanas sem contagem, antes de 05/10. Hachura: a semana que termina em 05/10, com contagem incompleta (não medido)." A data 05/10 sai de `SEM_DATAS[0]`, a mesma do gráfico e da legenda. Conferido na captura: a faixa larga pontilhada e a fatia hachurada são o que o ⓘ descreve. |
| R6-C3 (n do normal das 72 horas digitado) | Apagados todos os `n` dos `m14` (`cheio`, `extremo`, `recente`, `zero`, `naomedido`, `saiu`, `aovivo`; `mantido` e `leitura` herdam por cópia). `c.m14.n = teto72(c.agora)`: o n só sai da lista `PUBS_OUTROS`. Resultado, na tela: `cheio`, `extremo`, `leitura` "normal do canal (13 vídeos)"; `saiu`, `mantido`, `naomedido`, `recente`, `zero`, `aovivo` "só 2 vídeos com as 72 horas completas (o mínimo é 3)" (continua "não medido"). Recontado por script contra a lista nos 14 estados: 0 diferenças. |
| S1 (barra do dia da subida do `extremo`) | O surto do `extremo` começa 12 horas depois (`burst.s` 170 para 182): a barra de 17/10 passou de 36 mil para 8.513 (como as dos dias anteriores) e a primeira barra alta, 18/10, é a primeira dentro da faixa verde. Mais o ⓘ do dia a dia: "A barra do próprio dia da subida (a contagem das 12:00 que a marca) fica entre as duas faixas." Todos os números do `extremo` são gerados de novo pelo motor (seção 15). Também baixei o pico (5.600 para 5.200) para a razão da subida deixar de coincidir com o "6,4× o normal" do cartão de 1 dia: agora 6,0 vezes o ritmo contra 6,4× o normal. |
| S2 (`vazio`: "contagem do dia") | "a primeira contagem por dia é às 12:00 de amanhã" (e a linha da seção 2 desta NOTAS). |
| S3 (datas 03/10 e 04/10 digitadas) | As nove frases e rótulos com "03/10" em `m13.js` (motivo do `magro`, frases do bloco de idade, "começou em", rótulo da barra de estados, aviso de exemplo) agora usam `A.dm(D.INICIO_DIARIA)`; as de 04/10 já usavam `A.dm(D.INICIO_HORA)`. Sobram "03/10" só em comentários. Comparado o texto de antes e de depois nos 14 estados: igual, salvo os itens desta tabela. |
| S4 (`carregando` sem pager) | O pager "vídeo 1 de 12" aparece também no `carregando` (só o `vazio` e os estados sem mudança ficam sem). Conferido na captura a 390 claro: a altura não pula quando o histórico abre. |
| S5 (rótulo do último ponto cruzado pela linha, 390) | `m13-graf.js`, função `pon`: quando o rótulo de baixo é jogado para a esquerda do último ponto (falta de espaço à direita), ele passa para cima do marcador, onde a linha que sobe não passa. Conferido a 390 claro e a 1440 escuro: "969 mil" livre da linha. |
| S6 (mantidas) | Eixo de horas até 50 min à esquerda da hora real (r5 S2, declarado ao implementador); o motivo de "mesmo n em canais diferentes" some, porque o n sai da lista; "servidor" no `erro` fica; resumo abaixo da primeira tela a 390 (r2 S1, casca do lote 1). |
| Extra da varredura | `aovivo`: "(2 vídeos nessa condição saíram da conta)" era um número solto, sem fonte; virou "(vídeos ao vivo ou estreia não entram na conta do normal)". |
| NOTAS seção 12 e 13 | A afirmação "nenhum número abaixo é digitado em dois lugares" estava errada para o n das 72 horas e as datas; a seção 13 ganhou o aviso de que a 15 a substitui. |

## 15. Varredura de coerência da r6: tabela por estado

Fontes únicas (nada abaixo é digitado em dois lugares): o motor `m13-dados.js` (dias, horas, subida e marcos saem da MESMA contagem acumulada); `PUBS_OUTROS` (n por idade e n das 72 horas, `teto72`); `SEM_DATAS`; `NECESSARIOS` = 15; `D.INICIO_DIARIA` = 03/10 e `D.INICIO_HORA` = 04/10; `nMud` (aba e pager); `HOJE` = 13/10 e `FUT` = 11/11. Método da conferência: um script abre os 14 estados, lê o texto, as tabelas escondidas, os ⓘ e `M13_DEBUG`, e refaz cada conta em Python a partir das barras e das horas (soma dos dias, horas até as 12:00 contra a barra do dia, 1ª contagem mais as horas seguintes contra o total das 72 horas, marcos de 1/4, 1/2 e 3/4, subida, n contra a lista). 0 falhas. Depois li o texto de cada estado inteiro, em busca de número que contradiga outro da mesma tela. Capturas dos 14 estados nas duas larguras (e nos dois temas) refeitas; 0 de rolagem, 0 de fonte abaixo de 12 px e 0 de alvo abaixo de 44 px (56 de 56).

Regra da primeira contagem por hora: descoberta no próximo marco de 6 h depois de publicar (00, 06, 12, 18), primeira contagem na hora cheia seguinte; tempo = hora cheia menos a hora da publicação. Total das 72 horas = primeira contagem + soma das horas medidas seguintes.

Lista do canal, para o n: 14 vídeos publicados em 03/10, 06/10, 07/10, 11/10, 12/10, 15/10, 18/10, 22/10, 25/10, 28/10, 31/10, 03/11, 06/11, 08/11. n por idade conta os já com a idade completa no dia da tela (desde 03/10); n das 72 horas conta os publicados desde 04/10 com 3 dias completos (13 em 11/11; 2 em 13/10: 06/10 e 07/10). O n das 72 horas é menor que o da curva por idade com 3 dias (13 contra 14 em novembro; 2 contra 3 em outubro) só porque o vídeo de 03/10 não tem contagem por hora; a frase do `recente` diz isso ("e a contagem por hora começou em 04/10") e o ⓘ também.

| Estado | Número mostrado | De onde vem | Fecha com |
|---|---|---|---|
| `cheio` | 97,9 mil views; "há 34 dias" | soma de 34 barras = 97.909; 08/10 a 11/11 = 34 | idade 30 (94.319) <= 97.909 |
| `cheio` | "primeira contagem às 01:00 de 09/10"; "4 h 20 min"; "1.789 views já"; 1/4 7 h, 1/2 22 h, 3/4 40 h | publicado 20:40, marco 00:00, contagem 01:00; 20:40 até 01:00 = 4 h 20 | 1.789 + 7.882 (67 horas seguintes) = 9.671 (72 horas) <= 97.909; 1.789 é 18,5% de 9.671, abaixo de 25%: o 1/4 existe; as horas até as 12:00 de 09, 10 e 11/10 dão 3.610, 7.176 e 9.094 = as barras acumuladas |
| `cheio` | 1 dia 5.440 contra 5.200 (14 vídeos), ＝; 7 dias 13.535 contra 15.160 (12), 0,9×; 30 dias 94.319 contra 33.760 (5), 2,8× | `cumNaIdade` contra `normalCurva`; n = lista em 11/11: 14, 14, 14, 13, 12, 10, 7, 5 | 5.440/5.200 = 1,05; 13.535/15.160 = 0,89; 94.319/33.760 = 2,79; n não cresce com a idade; n das 72 horas 13 = lista (r6 C3) |
| `cheio` | "Subida em 16/10"; 49.601; 7.086 contra 1.497 por dia; 4,7 vezes; faixa verde 17/10 a 23/10 | (cum 23/10 - cum 16/10) / 7; (cum 16/10 - cum 09/10) / 7 | 49.601/7 = 7.086; 10.478/7 = 1.497; razão 4,73; 7 barras na faixa; a barra de 16/10 (866) fica entre as faixas; melhor dia 18/10 com 9.934, dentro da faixa; 2 das 4 mudanças nos 14 dias antes (11/10 e 13/10) |
| `extremo` | 993 mil views; "há 33 dias"; aba "Mudanças 31"; "14 mudanças, 12 delas nos 14 dias antes" | soma de 33 barras = 993.436; 09/10 a 11/11 = 33; `nMud` = 31; 14 itens, 12 com data de 10/10 a 16/10 | idade 30 (968.554) <= 993.436; 12 + 2 (25/10 e 03/11) = 14 |
| `extremo` | "6 h 40 min", "01:00 de 10/10", "22.549 views já"; 1/4 "não medido", 1/2 23 h, 3/4 39 h | publicado 18:20, marco 00:00, contagem 01:00; 18:20 até 01:00 = 6 h 40 | 22.549 + 63.159 (65 horas seguintes) = 85.708 <= 993.436; 22.549 é 26,3% de 85.708, passou de 25%: o 1/4 já tinha passado; "maior hora medida" 2.283 = a primeira barra medida |
| `extremo` | 1 dia 46.903 contra 7.280 (14), 6,4×; 7 dias 117.692 contra 21.230 (12), 5,5×; 30 dias 968.554 contra 47.270 (5), 20,5×; "969 mil" no gráfico | idem; n = 14, 14, 14, 13, 12, 10, 7, 5 | 46.903/7.280 = 6,44; 117.692/21.230 = 5,54; 968.554/47.270 = 20,49; normal das 72 horas "13 vídeos" = lista |
| `extremo` | "Subida em 17/10"; 520.210; 74.316 contra 12.472 por dia; 6,0 vezes; faixa verde 18/10 a 24/10; melhor dia 19/10 com 100.285 | (cum 24/10 - cum 17/10) / 7; (cum 17/10 - cum 10/10) / 7 | 520.210/7 = 74.316; 87.305/7 = 12.472; razão 5,96; ≠ do 6,4× do cartão de 1 dia (outra grandeza, número diferente); a barra de 17/10 (8.513) é baixa e fica entre as faixas; a primeira barra alta (18/10) abre a faixa verde |
| `recente` | 10,8 mil views; "há 3 dias"; 3 barras 6.330 + 2.867 + 1.649 | soma = 10.846 | 3 dias 10.817 (idade) <= 10.846 |
| `recente` | "13:00 de 10/10"; "1 h 40 min"; "485 views já"; 1/4 8 h, 1/2 17 h, 3/4 36 h | publicado 11:20, marco 12:00, contagem 13:00 | 485 + 10.318 (70 horas seguintes) = 10.803 <= 10.846; 4,5% de 10.803; "Com 1 dia 6.257" (24 h) <= 6.330 (a barra de 11/10 vai até as 12:00, 24 h 40 min depois de publicar); 6.257/5.200 = 1,20; 3 dias 10.817 contra 9.520 (3 vídeos) = 1,14 |
| `recente` | "são 3. Faltam 12: fecha em 25/10"; "Com 7 dias fecha em 17/10"; "30 dias 09/11"; "só 2 vídeos com as 72 horas completas" | 3 barras (11, 12, 13/10); 15 - 3; 13/10 + 12; pub 10/10 + 7 d e + 30 d, depois das 12:00; n das 72 horas = lista (06/10 e 07/10) | 3 + 12 = 15; 11/10 + 14 = 25/10; 2 < 3 = "não medido" |
| `magro` | 22,5 mil; "há 40 dias"; "são 11 (começou em 03/10). Faltam 4: fecha em 17/10"; melhor dia 05/10 com 259; "5 vídeos com 1 dia" | total 22.540 = 20.106 (1ª contagem, não medido) + 2.434 (10 barras de 04/10 a 13/10); 03/09 a 13/10 = 40; n por idade em 13/10 | 11 contagens (03/10 a 13/10) + 4 = 15; 03/10 + 14 = 17/10; 257 + 259 + 244 + 246 + 239 + 245 + 238 + 239 + 235 + 232 = 2.434; 5 = lista; "publicado em 03/09/2026, antes de 04/10" no bloco das 72 horas e a mesma data do ⓘ |
| `zero` | 32 views; "2 dos 9 dias" e "47 das 68 horas medidas"; "21 horas ganhou algumas" | barras 21 + 5 + 2 + 0 + 1 + 1 + 1 + 0 + 1 = 32; 72 - 4 horas "não medido" = 68 | 47 + 21 = 68; 2 barras zero em 9; "primeira contagem às 13:00 de 04/10", 3 h 50 min (09:10 até 13:00); 4 + 23 (68 horas) = 27 <= 32; as horas até as 12:00 de 05/10 somam 21 = a barra do dia; marcos 7, 12, 25 h |
| `zero` | 1 dia 20 contra 160 (5), 0,1×; 7 dias 31, "normal: não medido, só 2"; "são 9. Faltam 6: fecha em 19/10"; "30 dias fecha em 03/11" | cumNaIdade; n em 13/10: 5, 4, 3, 3, 2; 9 barras; 04/10 + 30 | 20/160 = 0,125; 20 <= 26 <= 27 <= 29 <= 31 <= 32 (cumulativo); 2 < 3; 9 + 6 = 15; 13/10 + 6 = 19/10 |
| `naomedido` | 11,5 mil; "5 dos 8 dias não medido"; "76 horas depois de publicado"; "1 dos 5 pontos que já existem" | 11.542 = 7.750 (1ª contagem, 08/10) + 849 + 752 + 748 + 719 (as duas de 11/10 e 12/10, 1.467 juntas) + 724; 05/10 08:00 + 76 h = 08/10 12:00; idades 1, 2, 3, 5, 7 já existem (05/10 08:00 + 7 d = 12/10) | 3 barras medidas (849, 752, 724) + 5 = 8 dias; 1 ponto com contagem (5 d, 9.226) + 4 não medido = 5; os 5 de idades maiores ainda não existem; 76 > 72: o bloco das 72 horas é "não medido" por inteiro |
| `semanal` | 73,8 mil; "53 dias quando a contagem começou (03/10)"; "primeira contagem de 05/10"; "há 92 dias"; 5 pontos (722, 723, 968, 783, 725); "14 vídeos com 1 dia" | 11/08 a 03/10 = 53; `SEM_DATAS` (6 datas, a 1ª sem média); 11/08 a 11/11 = 92; n em 11/11 | 5 médias × 7 + a 1ª contagem = 73.829; gráfico, ⓘ, legenda e bloco de idade dizem 05/10 pela mesma constante; 72 horas: "publicado em 11/08, antes de 04/10" (r6 C1) |
| `saiu`, `mantido` | 7.657 "na última contagem (08/10)"; "4 dias com contagem"; "saiu em 09/10" | barras 3.828 + 1.964 + 1.076 + 789 = 7.657 (04/10 a 08/10); 08/10 < 09/10 | 4 barras = "4 dias"; 7 e 30 dias "saiu antes desta idade" (04/10 + 7 = 11/10 > 09/10); "Subida: o vídeo saiu antes" |
| `saiu`, `mantido` | "19:00 de 04/10"; "3 h 00 min"; "1.032 views já"; 1/4 6 h, 1/2 16 h, 3/4 33 h; "só 2 vídeos com as 72 horas completas" | publicado 16:00, marco 18:00, contagem 19:00 | 1.032 + 5.984 (69 horas seguintes) = 7.016 <= 7.657; 1 dia 4.260 contra 5.200 (5) = 0,8×; 3 dias 7.016 contra 9.520 (3) = 0,7×; n das 72 horas 2 = lista (era "só 1", r6 C3) |
| `aovivo` | 12,4 mil; "são 5. Faltam 10: fecha em 23/10"; "Com 7 dias fecha em 16/10" | 3.354 + 3.321 + 2.296 + 1.795 + 1.586 = 12.352; 09/10 + 14; 08/10 19:00 + 7 d = 15/10 19:00, leitura 16/10 12:00 | 5 + 10 = 15; 1 dia 4.699 (24 h) > 3.354 (a barra de 09/10 para às 12:00, 17 h depois de publicar); "primeira contagem 01:00 de 09/10", 6 h 00; 1.959 + 7.647 (66 horas) = 9.606 <= 12.352; metade em 25 h; sem normal: não há número de n a contradizer |
| `vazio` | 312 views; "descoberto às 18:00"; "primeira contagem por hora às 19:00 de hoje"; "sincronizado há 20 min"; "fecha em 15/10, 21/10, 13/11, 28/10" | publicado 17:10, marco 18:00, contagem 19:00; agora ~18:20; 1 dia = 14/10 17:10, leitura 15/10 12:00; 7 dias 21/10; 30 dias 13/11; 1ª leitura 14/10 + 14 = 28/10 | nenhuma barra, nenhum zero, nenhum gráfico: só "ainda não existe"; "contagem de hoje" (views agora) e "primeira contagem por dia" (barras) dizem coisas diferentes com palavras diferentes (r6 S2) |
| `carregando`, `erro` | título, capa, "10/10/2026 às 11:20 (há 3 dias)"; "vídeo 1 de 12" | mesma fonte do `recente`; `nMud` = 12 | nenhum número de dado para contradizer; o pager aparece nos dois (r6 S4) |
| `leitura` | idêntico ao `cheio` (13 vídeos, 49.601, 4,7, 16/10) | cópia do caso | |
| todos de novembro | "nenhum vídeo tem 15 dias de contagem por dia" | `NECESSARIOS` | a mesma constante dos cartões de hoje |

Conferido contra as capturas (56 de 56 refeitas depois da última mudança de código; abri as de `extremo` a 1440 escuro e a 390 claro, `semanal` a 1440 escuro, `carregando` a 390 claro e `saiu` a 390 claro): os números da tabela são os que a tela mostra; nenhuma contradição aberta.


## 16. Resposta à revisão r7 (`REVISAO-UX-r7.md`)

| Item | O que foi feito |
|---|---|
| R7-C1 (leitura das 72 horas: "23:00 a 00:00" com a data do dia seguinte) | `m13.js`, `fala` das horas: a data do início do intervalo é a do dia anterior quando a contagem é à 00:00 (`A.ds(x.hc === 0 ? D.addDias(x.d, -1) : x.d)`). Conferido por seta, Home a End, nos 8 estados com 72 horas (`cheio`, `extremo`, `recente`, `zero`, `saiu`, `mantido`, `aovivo`, `leitura`): 72 leituras por estado, cada uma exatamente 1 h depois da anterior, 0 saltos e 0 voltas (antes: 3 por estado). |
| R7-C2 (conta do `semanal` na NOTAS e dois dias sem explicação na tela) | Conta certa, tirada das contagens acumuladas: 44.910 (05/10) + 27.449 (as 5 semanas, de 05/10 a 09/11: 72.359 - 44.910) + 1.470 (2 dias, de 09/11 a 11/11: 73.829 - 72.359 = 735 por dia) = **73.829**. As 5 médias mostradas (722, 723, 968, 783, 725) são arredondadas: x 7 dão 27.447, 2 a menos que o exato; a tela não mostra a soma, só as médias. A revisão disse 1.472 por partir desse 27.447. Na tela: o ⓘ do gráfico semanal ganhou "Views agora inclui os dias depois da última semana fechada (de 09/11 a 11/11)"; as duas datas saem de `SEM_DATAS` (a última) e de `c.agora`. A linha do `semanal` da seção 15 deve ser lida com esta conta. |
| S1 (tabela das horas e leitura dizem a hora de dois jeitos) | A linha da tabela escondida passa a trazer o intervalo ("09/10 01:00 a 02:00"), pela mesma função `rot` que a leitura usa; título da coluna de valores "Views nessa hora". Conferido: 72 de 72 linhas iguais à leitura (data, intervalo e valor) nos 8 estados. |
| S2 (`semanal` esconde a mudança dos dados) | A lista "Mudanças deste vídeo" aparece no `semanal` ("Título em 21/10", sem marca de subida e sem número no gráfico); o ⓘ diz "A lista de mudanças aparece abaixo, sem marca de subida". 21/10 fica depois da publicação (11/08) e antes do dia da tela (11/11). |
| S3 (aba "Mudanças" diferente entre estados de 11/11) | `cheio`, `semanal` e `leitura` agora têm `nMud` 31, como o `extremo`. Conferido: aba e "vídeo 1 de N" iguais nos quatro estados de novembro; os de 13/10 seguem em 12. |
| S4 (frase da hachura) | ⓘ do `semanal`: "o ponto de 05/10 é a primeira contagem do vídeo, sem a anterior para tirar a diferença (não medido)", a mesma frase da leitura do ponto. "Contagem incompleta" não existe mais. |
| S5 (mantidas) | Eixo de horas até 50 min à esquerda da hora real; "servidor" no `erro`; resumo abaixo da primeira tela a 390; marcas do normal das 72 horas são exemplo digitado, com o n vindo da lista. Nada mudou. |
| Extra da varredura | Duas contas visíveis para "3 dias": o total das 72 horas (cheio 9.671) e o "Com 3 dias" da curva por idade (9.729). A diferença é só a janela: as 72 horas param na última hora cheia (19:00 de 11/10) e os 3 dias completos são às 20:40. O ⓘ das 72 horas passou a dizer isso. Tabela abaixo. |

## 17. Varredura de coerência da r7: tabela por estado (conferida contra o DOM, contra `M13_DEBUG` e contra as capturas refeitas)

Método novo, por pedido da r7: um script abre os 14 estados a 1440, percorre **o texto de leitura de cada ponto dos três gráficos** (Home e setas) e a tabela escondida de cada gráfico, e confere: dia da semana de todo "dia dd/mm" da tela, dos ⓘ e das leituras; sequência das 72 leituras (1 h entre uma e outra); leitura = dado (views e "Total até aqui") hora a hora e dia a dia; tabela de horas = leitura; "há N dias" = data de publicação contra o dia da tela; toda data da lista de mudanças entre a publicação e o dia da tela; aba e pager de Mudanças. Resultado: 0 diferenças. Erros de script: 0 nos 14. Capturas: 56 de 56 refeitas depois da última edição; 0 px de rolagem, 0 texto menor que 12 px, 0 alvo menor que 44 px a 390.

Fontes únicas, como na seção 15 (motor `m13-dados.js`, `PUBS_OUTROS`, `SEM_DATAS`, `NECESSARIOS`, `D.INICIO_DIARIA`/`D.INICIO_HORA`, `nMud`, `HOJE`/`FUT`); o que a r7 acrescenta: o intervalo de cada hora sai de UMA função (`rot`, `m13.js`), usada pela leitura e pela tabela; a data do fim do "Views agora" do `semanal` sai de `c.agora`.

| Estado | Número ou texto mostrado | De onde vem | Fecha com |
|---|---|---|---|
| os 8 com 72 horas | leitura "qui 08/10, 23:00 a 00:00" seguida de "sex 09/10, 00:00 a 01:00" (`cheio`) | `rot` / `fala`: início do intervalo = hora da contagem menos 1 h, data do dia anterior se a contagem é à 00:00 | 72 leituras seguidas, 1 h de diferença cada; tabela igual à leitura nas 72 linhas; "Total até aqui" só cresce e = `cum` do motor |
| `cheio`, `leitura` | 72 horas 9.671 e "Com 3 dias" 9.729 | 72 horas: 1ª contagem 1.789 + 67 horas = 9.671 (até 19:00 de 11/10); 3 dias = às 20:40 de 11/10 | 9.671 <= 9.729; o ⓘ explica a janela (extra da r7) |
| `extremo` | 85.708 e 85.952 | idem: as 72 horas vão até as 18:00 de 12/10; os 3 dias fecham às 18:20 de 12/10 (publicado 09/10 às 18:20) | 85.708 <= 85.952 |
| `recente` | 10.803 e 10.817 | idem | 10.803 <= 10.817 |
| `zero`, `saiu`, `mantido`, `aovivo` | 27 e 27; 7.016 e 7.016; 9.606 e 9.606 | a última hora cheia coincide com os 3 dias | iguais |
| `semanal` | 44.910 (05/10), 49.964 (12/10), 55.023 (19/10), 61.799 (26/10), 67.283 (02/11), 72.359 (09/11), 73.829 (11/11) | contagens acumuladas do motor | médias por dia = diferença / 7 = 722,7; 722,7 (723); 967,7 (968); 783,4 (783); 725,1 (725); 73.829 = 44.910 + 27.449 + 1.470 (conta da seção 16) |
| `semanal` | "Mudanças deste vídeo: Título em 21/10" | `trocas[0]`, a mesma data do DOM | 11/08 < 21/10 < 11/11; semana de 19/10 a 26/10 é a de 968 por dia |
| `cheio`, `semanal`, `leitura`, `extremo` | aba "Mudanças 31" e "vídeo 1 de 31" | `nMud` = 31 | iguais nos quatro; os demais 12 e 12 |
| todos | "há N dias": 34, 33, 40, 3, 9, 8, 92, 9, 9, 5, 3, 3, 34 | data de publicação contra HOJE (13/10) ou FUT (11/11) | recalculado em Python: 0 diferenças |
| todos | dia da semana de cada data da tela, dos ⓘ e das 72 + 10 + até 35 leituras por gráfico | `A.ds` | recalculado em Python: 0 diferenças |
| todos | soma dos dias medidos | barras do motor | `cheio` 97.909; `extremo` 993.436; `magro` 2.434 (+ 20.106 não medido = 22.540); `recente` 10.846; `zero` 32; `naomedido` 2.325 (849 + 752 + 724; com 7.750 e 1.467 não medidos, 11.542); `saiu` e `mantido` 7.657; `aovivo` 12.352; `leitura` 97.909; as leituras do gráfico dia a dia dizem o mesmo valor de cada barra |
| `zero` | "Nenhuma mudança registrada desde 03/10" num vídeo publicado em 04/10 | `D.INICIO_DIARIA`: o histórico de mudanças começou em 03/10 e a frase diz isso entre parênteses | não é data de mudança anterior ao vídeo; é a data do começo do registro |
| `vazio`, `carregando`, `erro` | sem gráfico; "vídeo 1 de 12" no `carregando` e no `erro` | `nMud` = 12 | nenhum número de dado para contradizer |

Conferido contra as capturas refeitas: abri `semanal` a 1440 escuro (lista de mudanças nova, ⓘ e hachura no desenho como o ⓘ descreve). Os demais estados mudaram só em texto de leitura, de tabela escondida, de ⓘ e na aba "Mudanças", que conferi por script; as capturas desses não foram abertas nesta rodada.

## 18. Resposta à revisão r8 (`REVISAO-UX-r8.md`)

| Item | O que foi feito |
|---|---|
| R8-B1 (eixo das 72 horas uma hora adiante da leitura, da hachura e do texto) | `m13-graf.js`, `G.horas`: o gráfico passou a ter UMA escala, a do tempo real. `u = (largura útil) / hs[71].t`; a barra j vai de `L + max(0, t-1)*u` a `L + t*u` (a 1ª é parcial: da publicação até a primeira hora cheia); a hachura vai de `L` até o fim da última barra "não medido" (`L + t*u`); os traços de 00:00 e 12:00 ficam na borda DIREITA da barra que termina nessa hora; a linha de "1/2 das views" fica no fim da barra em que a contagem chegou à metade; os retângulos de toque têm o intervalo da barra; a marca de publicação fica em `L` (antes `L - 1`, que a 390 vale 18 min). Texto da leitura e tabela não mudaram. Conferido por script (seção 19, linha "posição no eixo"): nos 8 estados com 72 horas, a 1440 e a 390, a hachura termina na hora da "primeira contagem" do texto, cada traço de 00:00 e 12:00 cai na hora que o rótulo diz, a marca de publicação cai em `L` e cada barra medida cai dentro do intervalo `(t-1, t]` da hora que a leitura nomeia: 16 de 16 cruzamentos, 0 falhas. |
| R8-C1 (`naomedido`: "Mudou neste dia" afirma um dia que o dado não sustenta) | `m13.js`: mudança com a contagem parada (`prec: 'gap'`) vale para os dois dias da janela (depois de 10/10, até 12/10, isto é, 11/10 e 12/10). A leitura de 11/10 e a de 12/10 dizem "Mudou entre 10/10 e 12/10, em momento que a contagem parada não mostra: miniatura (mudança 1)"; a tabela escondida diz "1 miniatura (entre 10/10 e 12/10, sem dia certo)" nos dois dias. A marca 1 do gráfico foi para a divisa entre as colunas de 11/10 e 12/10 (antes no centro de 11/10, que também afirmava um dia). O ⓘ do dia a dia diz isso. |
| S1 (primeira hora começa antes de o vídeo existir) | Leitura e tabela das 72 horas dizem "20:40 a 21:00" na primeira linha (hora da publicação, não a hora cheia); `cheio`: "qui 08/10, 20:40 a 21:00". As outras 71 linhas não mudaram. O ⓘ das 72 horas diz que a primeira barra é parcial. |
| S2 (a frase "24/08: o YouTube mudou a regra de contar views") | Seção 5 passou a dizer que a data e a frase são constantes de exemplo; o implementador usa uma fonte real ou corta a linha. Nada muda na tela (ela já leva a marca "exemplo"). |
| S3, S4 (mantidas) | "servidor" no `erro`; resumo abaixo da primeira tela a 390 (casca do lote 1). |
| S5 (marcas do normal das 72 horas) | Dito na seção 4 e aqui: o n vem da lista do canal; os horários 1/4, 1/2 e 3/4 do normal são exemplo digitado em `m13.js`; o implementador calcula a mediana por canal. |
| Achado da varredura (fora da revisão) | Nos gráficos por dia e por semana a 390, o último rótulo de data (11/11) era deslocado para a coluna do dia anterior (10/11) para não ser cortado. Agora ele fica alinhado à direita, terminando na borda, sobre a própria coluna. Conferido por script em `cheio`, `extremo`, `leitura` e `semanal`. |
| Arredondamento da régua (declarado) | A régua mostra "22 h" onde o gráfico põe a linha em 22 h 20 min (o fim da hora em que a contagem chegou à metade): o número da régua é arredondado para hora inteira, a diferença é de até 30 min. O ⓘ das 72 horas diz as duas coisas. |
| Substitui | A frase "eixo de horas até 50 min à esquerda da hora real" (seções 12, 14 e 16) não vale mais: não há mais desvio. |

## 19. Varredura de coerência da r8: número contra número E desenho contra número (conferida por script em 1440 e 390, e contra as capturas)

Método novo: além de texto contra texto (seções 9 a 17, refeitas pelo mesmo conjunto de scripts e sem diferença), um script lê a GEOMETRIA do SVG (posição de barras, hachura, traços, marcas e faixas) e converte em hora ou em dia pela escala do gráfico, e compara com o que o texto da mesma tela diz. Fonte única: o motor `m13-dados.js` (`hs[j].t`, `hc`, `d`, `cum`), `D.dias`, `c.trocas`, `D.subida`; nada é digitado em dois lugares, só o horário dos marcos do normal (S5).

| Estado | Posição desenhada | Lida na escala | Texto da tela | Fecha |
|---|---|---|---|---|
| `cheio`, `leitura` | hachura termina em 4,33 h; traços 00:00 e 12:00 (6); marca de publicação em `L`; linha de 1/2 em 22,33 h | 01:00; 00:00 e 12:00 nas horas dos rótulos; 20:40; 19:00 | "primeira contagem às 01:00", "4 h 20 min depois de publicar", "publicado qui 08/10, 20:40", "metade nas primeiras 22 horas" | sim (22,33 h arredondado para 22; 20:40 + 4 h 20 = 01:00) |
| `extremo` | hachura 6,67 h; 6 traços; linha de 1/2 em 22,67 h | 01:00; 17:00 | "6 h 40 min", "01:00 de 10/10", publicado 18:20, "23 horas" | sim (18:20 + 6 h 40 = 01:00; 22,67 arredondado para 23) |
| `recente` | hachura 1,67 h; 5 traços; linha de 1/2 em 16,67 h | 13:00; 04:00 | "1 h 40 min", "13:00 de 10/10", publicado 11:20, "17 horas" | sim |
| `zero` | hachura 3,83 h; 6 traços (o primeiro é 12:00); linha de 1/2 em 11,83 h | 13:00; 21:00 | "3 h 50 min", "13:00 de 04/10", publicado 09:10, marco 12 h | sim |
| `saiu`, `mantido` | hachura 3,00 h; linha de 1/2 em 16,00 h | 19:00; 08:00 | "3 h 00 min", "19:00 de 04/10", publicado 16:00, "16 horas" | sim |
| `aovivo` | hachura 6,00 h; linha de 1/2 em 25,00 h | 01:00; 20:00 | "6 h 00 min", "01:00 de 09/10", publicado 19:00, "25 horas" | sim |
| os 8 com 72 horas | cada barra medida dentro de `(t-1, t]` da hora que a leitura e a tabela nomeiam; primeira linha começa na hora da publicação | 0 barras fora do intervalo | leitura "20:40 a 21:00", "21:00 a 22:00", ... | sim (0 falhas em 16 cruzamentos) |
| os 10 com barras por dia | centro de cada barra, de cada marca de mudança e da marca de publicação na coluna do dia; faixa verde = (dia da subida + 1) até o fim da subida; marca de mudança com a contagem parada na divisa entre os dois dias da janela; linha de "saiu" na divisa antes do primeiro dia sem contagem | coluna = data | barras e leituras por data; "Subida em 16/10", "faixa verde 17/10 a 23/10" (`cheio`), "17/10", "18/10 a 24/10" (`extremo`); "saiu em 09/10" | sim, 20 de 20 cruzamentos |
| `semanal` | 5 pontos nos centros das semanas que terminam em 12/10, 19/10, 26/10, 02/11 e 09/11 (06 a 12/10 etc.); hachura em 05/10; linha de 24/08; marca de publicação em 11/08; rótulos de data (a 390: 11/08, 01/09, 22/09, 13/10 e 11/11 no fim) | datas pelas colunas | "Semana que termina em 12/10" etc., "publicado em 11/08", "sem contagem por semana antes de 05/10", "24/08" | sim |
| `naomedido` | marca 1 na divisa entre 11/10 e 12/10 | os dois dias da janela | leitura de 11/10 e de 12/10: "Mudou entre 10/10 e 12/10, em momento que a contagem parada não mostra"; lista: "Miniatura em algum momento entre 10/10 e 12/10 (a contagem ficou parada)"; tabela: "entre 10/10 e 12/10, sem dia certo" | sim: as quatro frases dizem a mesma janela e nenhuma nomeia um dia |
| `naomedido` | cabeçalho "Dos 8 dias, 5 estão não medido": colunas hachuradas 06, 07, 08, 11 e 12/10; barras 09, 10 e 13/10 | 5 + 3 = 8 | idade: "1 dos 5 pontos que já existem tem contagem" (5 dias, 9.226 views; normal 10.080) | sim |
| números dos estados (soma dos dias, total das 72 horas, n do normal, "faltam N", "fecha em", razões, "há N dias", dia da semana de cada data) | idem seções 15 e 17 | | | refeitos pelo mesmo script depois da mudança de código: nenhuma diferença; nenhum "N de M" com N maior que M |

Capturas: 56 de 56 refeitas depois da última mudança de código (`shots/m13-<estado>-<largura>-<tema>.png`); 0 px de rolagem, 0 texto menor que 12 px, 0 alvo menor que 44 px a 390. Abri e conferi: `cheio`, `extremo` e `recente` (bloco das 72 horas, 1440 escuro e 390 claro), `aovivo`, `naomedido` (1440 escuro e 390 claro, dia a dia), `cheio` e `semanal` a 390 claro (último rótulo de data). `grep color-mix` só acha comentários "sem color-mix".


## 20. Resposta à revisão r9 (`REVISAO-UX-r9.md`)

| Item | Resposta |
|---|---|
| R9-C1 (`saiu`, `mantido`: "com 4 dias" contra "Com 3 dias") | Feito. Frase: "A última contagem, em 08/10, foi de 7.657 views, depois de 4 dias de contagem. A contagem termina em 08/10." O 4 sai de `nDiasContagem()`, que conta os dias com leitura da mesma lista que desenha as barras. `mantido` herda. Conferido: 0 "Com 4 dias" nos 14 estados. |
| S1 ("só 0 vídeos") | Feito: `soN()`; com n = 0 a frase é "nenhum vídeo chegou a esta idade (o mínimo é 3)" (leituras de idade) e "nenhum vídeo" no aviso do normal das 72 horas. |
| S2 (marca de 18/10 do `cheio` depois das 12:00) | Feito: mudança de 6 h com início às 12:00 ou depois diz "Mudou neste dia, depois da contagem das 12:00" na leitura e "(depois da contagem das 12:00)" na tabela escondida. |
| S3 (chip "há 3 h" contra "descoberto às 18:00" no `vazio`) | O chip do `vazio` já dizia "há 20 min" desde a r5 (a r9 olhou a casca padrão); agora a descoberta (18:00), a hora de agora (18:20) e a primeira contagem (19:00) saem de duas constantes (`VZ_DESC`, `VZ_AGORA`) e o "20 min" é a diferença. |
| S4 (total das 72 horas contra "Com 3 dias") | Dúvida 11 para o dono, padrão: só no botão de informação. Tela inalterada. |
| S5 (faixa "exemplo" a 390 sem "Hoje é 13/10") | Dúvida 12 para o dono, padrão: faixa curta a 390. Tela inalterada. |
| S6 ("76" digitado em dois lugares) | Feito: o 76 vem só de `p.descoberto`; a data "a partir de 08/10" (`desde`) agora é calculada (publicação + descoberto). |
| Linhas novas da tabela de coerência (lacuna apontada) | "Unidade de dias": "Com N dias" = idade, "N dias de contagem" = leituras das 12:00; conferido por regex nos 14 estados. "Total das 72 horas contra Com 3 dias": diferença explicada no botão de informação (dúvida 11). |

Capturas: 56 de 56 refeitas (`shots/m13-<estado>-<largura>-<tema>.png`): 0 px de rolagem, 0 texto menor que 12 px, 0 alvo menor que 44 px, 0 erro de script. Varredura de texto dos 14 estados em 1440: 0 dia da semana errado, 0 "só 0", 0 "Com 4 dias".
