# Revisão de UX, rodada 7: mockup 20, Comentários de destaque do vídeo de concorrente

Revisor: engenheiro sênior de UX. Data: 13/10/2026. Escopo: conferir se o B1 e o C1 da r6 foram resolvidos de verdade, se o ajuste criou defeito novo, e fazer eu mesmo, de uma vez, a varredura de coerência dos números e das frases de exemplo em todos os estados.

Método: servidores estáticos próprios (portas 47733 a 47739, derrubados ao fim; a 3099 e os specs do projeto não foram tocados). Extraí o texto visível, os `aria-label` e os `details` das 15 combinações de caso do mockup (os 13 estados do vídeo, mais os 3 do canal, nas abas de 1, 7 e 30 dias), li cada linha contra `c20-dados.js` e conferi as somas à mão. Rodei também a auditoria do autor (`shots/auditoria-r6.mjs --sem-capturas`): "AUDITORIA LIMPA". Meu script próprio procurou os 21 nomes próprios de autor no texto, nos atributos e nos `details` das duas telas de só leitura, nas abas de 1 e 7 dias: nenhum nome. Medi contraste de texto (cor composta sobre o fundo composto, lida do estilo computado), contraste de borda de elemento gráfico, fonte, rolagem e alvo de toque nos 17 estados, em 1440 escuro e 390 claro. Cliquei as abas (1, 7, 30), usei setas e End, abri e fechei o ⓘ com Enter e Esc, percorri o Tab: 0 erros de console. Olhei as capturas do autor (zero em 1440, não coletado em 390, canal "fecha" em 1440) e as minhas, recortadas (`shots/r7/`, 9 arquivos).

## Veredito: PODE_IR_AO_DONO. Zero bloqueio, zero "corrige". Sete sugestões.

O B1 e o C1 da r6 estão resolvidos de verdade e o ajuste não criou defeito novo. Fiz a varredura de coerência inteira (tabela abaixo): todo número fecha com os outros da mesma tela e com os dados de exemplo, e nenhuma resposta do criador chama o autor pelo nome. A pergunta de quem abre é respondida no primeiro olhar nas duas páginas, nos dois temas.

## Os itens da r6, um a um

| r6 | Situação | Evidência |
|---|---|---|
| B1, resposta do criador cita o nome que o só leitura esconde | **Resolvido** | Texto extraído de `leitura-privado` (7 e 1 dia): cartão 4 "Um espectador" e, abaixo, "Está sim. Entrei em setembro com o de 90 dias..."; cartão 12 "Obrigado pelo detalhe. Vou fixar este comentário..."; nenhum vocativo nas sete respostas (Marcos, Carla, Priya sumiram de Mochilão, Pho e Hué). Meu varredor de 21 nomes: nenhum em `leitura` nem em `leitura-privado`, no texto, nos atributos nem nos `details`. A auditoria r6 tem a regra (nome na resposta do criador em qualquer estado, e nome de autor em só leitura) e passa. Captura: `shots/r7/r7-privado-card3-390-claro.png` (cartão do canal grande, sem nome) e `shots/20-leitura-privado-390-claro.png`. |
| C1, NOTAS com frases do canal que a tela já não diz | **Resolvido** | Conferi as seis linhas contra o texto da tela: "4 dos 16" e "4 esperando os 30 dias (05/11 e 09/11)"; "11 sem retrato de 30 dias (o motivo de cada um está na página do vídeo)"; "em 5 vídeos com retrato de 30 dias" (com dado) e "9 comentários guardados, em 3 vídeos" (fecha); "desde hoje (13/10)"; cabeçalhos 17, 16 e 14. Seção 1 item 13 diz 4 pontilhados. A seção 10.2 acrescenta a linha "só leitura sem nome". Procurei na NOTAS os resíduos antigos ("2 dos 14", "14 nos outros", "desde 13/10", "2 pontilhados", "nomes batem"): nenhum ficou. |
| Sugestão 3 da r6 (o mesmo trio em três vídeos) | **Feita** | Pho: Ana Beatriz Luz, Kenji Mori, Sofia Lund. Hué: Tomás Reis, Helena Vaz, Ravi Sethi. Mochilão: Marcos, Priya, Carla. Nenhum se repete, e a auditoria falha se repetir. |
| Sugestão 4 da r6 (texto que não combina com o vídeo) | **Feita** | Hué fala de cidadela, "erro 2" e calor; Pho fala das barracas. Sobra só o "item 4" da Marina sob o Pho (ver S5). |
| Sugestões 1 e 2 da r6 | Mantidas como estavam | Os números fecham; seguem como sugestão (S1 e S6 abaixo). |

## A pergunta de quem abre

Página do vídeo: "O que o público destacou neste vídeo, e o criador respondeu quem?" No primeiro olhar a 1440 escuro (`shots/r7/r7-tipico-topo-1440-escuro.png`): frase-resumo com "12 dos 100" em negrito, barra "12 de 100", fileira de 12 casas com cor e símbolo por motivo (polegar areia, microfone azul), legenda com zero medido (caixa 0) e não medido (hachura rosa), tudo antes do primeiro cartão. A 390 claro (`r7-tipico-topo-390-claro.png`) a mesma ordem, em duas fileiras de 6 casas. Página do canal: "Em quantos vídeos o criador responde?" Resposta na primeira frase ("5 de 14 (36%)" ou "Ainda não dá para medir") e uma casa por vídeo (`r7-canal-1440-escuro.png`, `r7-canal-fecha-1440-escuro.png`, `r7-canal-nm-390-claro.png`). Método no ⓘ, com a frase fixa "Cálculo do Observatório sobre dados públicos do YouTube". Nenhum `color-mix()` fora de comentário (grep em `c20.css`, `c20.js`, `c20-dados.js`, `a4.css`, `lote.css`).

## Varredura de coerência feita por mim (todos os estados; tudo o que achei)

ok = fecha com os outros números da mesma tela e com os dados de exemplo. Hoje = 13/10/2026; coleta desde 06/10.

| Estado | Número ou frase na tela | Conferência | Resultado |
|---|---|---|---|
| Típico, 7 dias | "12 dos 100", 12 casas, 12 cartões; "8 mais curtidos e 4 com o criador (ele respondeu a 3)" | mais curtidos: cartões 1, 3, 5, 6, 8, 9, 10, 11 = 8; com o criador: 2 (dele), 4, 7, 12 = 4; respostas dele: 4, 7, 12 = 3 | ok |
| Típico, 7 dias | ordem 411, 154, 90, 87, 64, 51, 39, 30, 28, 24, 22, 19 | decrescente, sem erro de posição; "3 entraram" (cartões 3, 7, 9, publicados em 11/10, 11/10 e 12/10) e "3 saíram" (10, 7 e 5 curtidas no dia 1, abaixo do piso de 22) | ok |
| Típico | "19 que deu para medir" + "1 autor com inscritos ocultos" | 19 + 1 = 20, o corte de "20 mais curtidos" | ok |
| Típico | "identidade guardada até" 04/11 e 10/11 | 07/10 + 28 e 13/10 + 28 | ok |
| Típico | "62 respostas" e "só 5 das 62" | 62 maior que 5, por isso "não sabemos"; respostas de 2, 1 e 9 com "não vimos" ou "respondeu" | ok |
| Típico, 1 dia | "9 mais curtidos e 3 com o criador (ele respondeu a 2)"; ordem 112, 41, 23, 19, 15, 12, 10, 9, 7, 6, 5, 4 | 9 + 3 = 12; Marcos e Carla = 2 respostas; os que entraram no dia 7 não aparecem; os 3 que saíram aparecem como cartões 7, 9 e 11 | ok |
| Extremo, 7 dias | 6 + 4 + 1 + 1 = 12; "1 de canal grande, entre os 20 mais curtidos"; "mais de 10 milhões", "mais de 1.000 vezes" | canal grande com 90 curtidas (3º), publicado em 11/10; 10 milhões dividido por 6,2 mil = 1.612 | ok |
| Extremo, 1 dia | 8 + 3 + 1 = 12; "nenhum canal grande entre os 20 mais curtidos" | canal grande só existe a partir de 11/10: zero medido, não "sem dado" | ok |
| Vídeo pequeno, 7 dias | "12 de todos os 37", barra 32%; "Ver os 3 que saíram": 2, 2 e 1 curtida | respostas nos cartões: 3+3+3+3+2+0+3+1+0+0+0+3 = 21; 12 + 21 + 3 = 36 menor ou igual a 37; saíram (2, 2, 1) menor ou igual ao menor "Mais curtido" que ficou (Yuki, 3); ordem 41, 15, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2 decrescente | ok |
| Vídeo pequeno | "nenhum canal grande entre os comentários do vídeo" | 37 menos 21 respostas = 16 principais, menor que 20, então não pode dizer "20 mais curtidos" | ok |
| Vídeo pequeno, 1 dia | "12 de todos os 28", "9 + 3 (ele respondeu a 2)" | 37 menos 3 comentários posteriores a 07/10 (Jess, Kenji, Omar) menos as 6 respostas deles = 28; 15 respostas nos 12 do dia 1; 28 maior que 12 + 15; ordem 13, 12, 10, 9, 6, 6, 4, 3, 2, 2, 2, 1 | ok |
| Vídeo pequeno | "Não vimos" em todos os de 1 a 3 respostas; nenhum "Não sabemos" | 3 menor que 5 | ok |
| Vídeo novo, 1 dia | "12 de todos os 71", "ele respondeu a 3", "fecha em 17/10 e 09/11", ident. até 08/11 | respostas nos cartões 6+6+4+6+2+0+6+1+0+0+0+6 = 37; 12 + 37 = 49 menor ou igual a 71 menor ou igual a 92; 71 menos 37 = 34 principais, maior que 20, então "20 mais curtidos" vale; 10/10 + 7, 10/10 + 30, 11/10 + 28; cartões de 10/10 e 11/10 | ok |
| Vídeo novo | "O YouTube mostrou só 5 das 6 respostas" (Marina, 6) | 6 maior que 5 | ok |
| Zero medido | "0 comentários" no cabeçalho, 412 views, 9 curtidas; "em 07/10" (1 dia) e "em 13/10" (7 dias) | data = dia do retrato; 30 dias "fecha em 05/11" | ok |
| Desligados | cabeçalho "comentários: não medido", hachura rosa | nunca zero nem número | ok |
| Não coletado | "1.240" na frase = cabeçalho; "descobrimos com 4 dias" (10/10); "até 16/10" | 06/10 + 4; 13/10 + 3; 4 maior que o prazo de 3 dias | ok |
| Antes da coleta | "há 54 dias" (20/08 a 13/10), "47 dias" (20/08 a 06/10) | 11 + 30 + 13 = 54; 11 + 30 + 6 = 47; 47 maior que 30 | ok |
| Carregando e erro | sem número de comentário; cabeçalho igual ao típico | n/a | ok |
| Só leitura, sem texto | mesmos números do típico; "Texto reservado"; "Autor reservado"; "O criador respondeu. O texto da resposta é reservado." | nenhum texto de comentário nem de resposta; nenhum nome | ok |
| Só leitura, com texto, sem nome | "Um espectador" nos 12 cartões; canal grande vira "Um canal com mais de 10 milhões de inscritos comentou"; respostas do criador sem vocativo | meu varredor de 21 nomes: 0 em texto, atributos e `details` (1 e 7 dias); "Leo" (criador) e "Nômade Raiz" (cadastro) ficam por regra | ok (B1 da r6 resolvido) |
| Canal, com dado (12/01/2027) | "5 de 14 (36%)", "3 recentes", "17 vídeos"; 6 comentários em 5 vídeos | 5 + 9 + 3 = 17; 5/14 = 35,7%; 14 mais 3; cada comentário entre o dia do vídeo e 7 dias depois (20/11 a 24/11, 12/11 a 15/11, 05/11 a 09/11, 28/10 a 01/11, 17/10 a 20/10); mais recente primeiro (64, 31, 21, 9, 16, 12 em ordem de data) | ok |
| Canal, fecha (13/10) | "4 dos 16", "12 anteriores", "4 esperando (05/11 e 09/11)", cabeçalho "16 vídeos"; "9 comentários, em 3 vídeos" | 12 + 4 = 16; 06/10 + 30 = 05/11 (Mochilão, Pho, Bastidores); 10/10 + 30 = 09/11 (Hué); mais antigo, 18/07, dentro de 90 dias (desde 15/07); 3 + 3 + 3 = o "ele respondeu a N" de cada página de vídeo; curtidas e datas de cada item iguais às do cartão (Hué "no dia 1": 4, 8, 2; Mochilão "aos 7 dias": 39, 87, 19; Pho: 7, 10, 2) | ok |
| Canal, não medido | "3 dos 14", 2 + 1 + 11, "mínimo 5", "3 comentários, em 2 vídeos" | 2 casas azuis = 2 vídeos; 3 menor que 5; 3 + 11 = 14 | ok |
| ⓘ da seção, do canal grande e do canal | "até 4 com o criador, até 2 de destaque", "100 primeiros", "28 dias", "até 3 respostas do criador", "5 de 14", "percentual só com 10 ou mais", "mínimo 5" | extremo = 4 + 2; nenhum cartão mostra mais de 1 resposta do criador; 14 maior que 10 mostra o percentual; 3 e 14 abaixo de 5 e de 10 | ok |
| Texto de interface | "lido", "série", "snapshot", "payload", "retenção", "CTR", "diário", "commentsDisabled"; "N curtidas/respostas/comentários/vídeos/dias/autores" com N = 1 | 0 ocorrências no texto e nos `aria-label` (a auditoria r6 também confere o singular) | ok |

Resultado: **0 contradições**. Procurei também, além de número, nome (vocativo), data de comentário contra data do vídeo (todas entre a publicação e o retrato), "hoje cedo" (07/10, depois do vídeo de 06/10), cidade do texto contra o vídeo (Hué e Pho corretos), ordem decrescente de curtidas nas três abas dos três vídeos, e nome de motivo igual em todas as telas (ver S2, único desvio). Nada mais caiu.

## Veredito por estado e por largura

| Estado | 1440 escuro | 390 claro | Observação |
|---|---|---|---|
| Típico (abas 1, 7 e 30) | pronto | pronto | |
| Extremo | pronto | pronto | |
| Vídeo pequeno (completo, abas 1 e 7) | pronto | pronto | ver S1 |
| Zero medido | pronto | pronto | |
| Desligados pelo canal | pronto | pronto | |
| Não coletado (2 motivos) | pronto | pronto | |
| Antes da coleta | pronto | pronto | |
| Vídeo novo | pronto | pronto | |
| Carregando | pronto | pronto | |
| Erro de leitura | pronto | pronto | |
| Só leitura, sem texto | pronto | pronto | |
| Só leitura, com texto, sem nome | pronto | pronto | B1 da r6 resolvido |
| Canal, com dado | pronto | pronto | |
| Canal, fecha em dd/mm | pronto | pronto | |
| Canal, não medido | pronto | pronto | ver S2 |
| NOTAS.md | pronto | | C1 da r6 resolvido |

Contagem: 16 de 16 prontos para o dono.

## Sugestões (não bloqueiam; nenhuma precisa de nova rodada)

1. **O denominador da barra muda de natureza entre o vídeo comum e o vídeo pequeno.** No típico, "12 dos 100 primeiros comentários" conta conversas (comentários principais); no vídeo pequeno, "12 de todos os 37" e "12 de 28" contam também as 21 (e 15) respostas que aparecem dentro dos próprios cartões. Os números fecham, e a frase é literalmente verdadeira (o cabeçalho também diz 37). Mas a barra de 32% sugere cobertura baixa quando os principais são 16 (12 de 16, 75%), e no dia 1 são 13 (12 de 13). Se o dono estranhar: "12 de todos os 16 comentários principais (37 com as respostas)". É decisão do engenheiro de dados, não de desenho.
2. **O mesmo vazio tem dois nomes.** Canal com dado: "9 vídeos em que não vimos resposta"; canal não medido: "1 sem resposta à vista". Cartão: "Não vimos resposta do criador". Trocar o do não medido por "1 em que não vimos resposta". A NOTAS também não lista a legenda do não medido.
3. **"mais de 10 milhões de inscritos" aparece duas vezes no cartão do canal grande em só leitura** (título "Um canal com mais de 10 milhões de inscritos comentou" e, logo abaixo, a base "mais de 10 milhões de inscritos"). Cortar a repetição no título ou na base.
4. **"Nos primeiros 28 dias, isso é só de quem edita o site"** (faixa do só leitura com texto) deixa a dúvida do que acontece depois dos 28 dias: o nome é apagado, não liberado. "Quem edita o site vê o nome e a foto por 28 dias; depois eles são apagados" diz o fato.
5. **Textos de exemplo que se repetem entre vídeos:** Beto Lima ("Que vídeo lixo...") e Vagas Online (golpe) aparecem com o mesmo texto em Mochilão, Pho e Hué, e Marina fala do "item 4" sob o vídeo das cinco barracas. Spam repetido é plausível; o resto é só leitura de exemplo.
6. **"Mais curtido" com 1 e 2 curtidas** (vídeo pequeno, aba de 1 dia: Rafa, Tati, Léo Campos). Fecha com a regra; soa a sucesso. "Entre os mais curtidos" resolve, se incomodar. (Mantida da r6.)
7. **A tabela fora da tela "Os quatro estados sem comentário" não traz "antes da coleta"**, que é o quinto estado (a NOTAS, item 5, já diz "o quinto"). Trocar o título para "Os estados sem comentário" ou acrescentar a linha.

## Tabela de medidas

| Elemento | Medido | Limite |
|---|---|---|
| Menor contraste de texto, 1440 escuro (tela simulada) | 4,78:1 ("respondeu", 12,5 px); nos estados sem lista 6,18:1 | 4,5 |
| Menor contraste de texto, 390 claro (tela simulada) | 6,36:1 ("respondeu", 12,5 px) | 4,5 |
| Menor contraste de borda de elemento gráfico, escuro | 4,09:1 (pastilha "não medido", só leitura com texto); caixa 0: 4,97 a 5,36; casa de motivo 7,34 e 12,81; pontilhado 5,24; aba 5,24 | 3 |
| Menor contraste de borda de elemento gráfico, claro | 4,24:1 (casa "com o criador"); caixa 0: 4,64 a 4,84; "não medido" 4,38 a 4,57; pontilhado 5,35; aba 5,35 | 3 |
| Fonte abaixo de 12 px | 0 nos 34 cruzamentos | 0 |
| Rolagem horizontal da página | 0 px nos 34 cruzamentos | 0 |
| Alvos abaixo de 44 x 44 px a 390 (ponteiro grosso), tela simulada | 0 nos 17 estados | 44 |
| Alvos abaixo de 44 px a 1440 (ponteiro fino) | só o ⓘ compacto de 28 x 28 e o "Ver tudo" e "Tentar de novo" de 34 px de altura, pelo padrão aprovado do lote 1 (a 390 todos têm 44) | convenção do lote |
| Casa da fileira | 66 x 44 px | 44 |
| Altura a 1440 (típico / típico 1 dia / extremo / completo / completo 1 dia / novo / zero / desligados / não coletado / antes / carregando / erro / leitura / só leitura sem nome / canal / canal fecha / canal não medido) | 5.686 / 5.260 / 5.728 / 5.534 / 5.130 / 5.250 / 2.032 / 2.053 / 2.053 / 2.053 / 2.181 / 1.982 / 5.125 / 5.774 / 2.134 / 2.967 / 1.592 px (com `?todos=1`) | |
| Altura a 390 (mesma ordem) | 9.448 / 8.803 / 9.630 / 9.291 / 8.668 / 8.892 / 3.617 / 3.616 / 3.639 / 3.639 / 3.591 / 3.407 / 8.598 / 9.702 / 3.222 / 4.375 / 2.311 px | |
| Foco | contorno sólido 2 px laranja em todos os controles; ordem de Tab: aba, ⓘ, casas 1 a 12 em ordem; setas e End trocam de aba; Esc fecha o ⓘ e devolve o foco | |
| Console | 0 erros | 0 |
| Movimento | `c20.css` sem transição nem animação; `a4.css` zera as dos demais em `prefers-reduced-motion` | |
| Auditoria do autor | "AUDITORIA LIMPA" (17 estados, 6 abas extras, cruzamento do canal) | |

## O que não consegui verificar

- Leitor de tela: li só os atributos e os nomes acessíveis.
- Safari e Opera: só Chromium.
- Fontes reais (Inter, JetBrains Mono, Fraunces): a captura cai nas do sistema; a quebra de linha pode mudar um pouco.
- Escala de cinza: não refiz nesta rodada; nenhum símbolo ou forma de estado mudou desde a r2, e cada motivo tem símbolo e forma próprios (polegar, microfone, olho, alvo, seta, caixa 0, hachura, pontilhado).
- Tema claro a 1440 e escuro a 390: medi só os pares obrigatórios. Contraste de texto sobre disco de gradiente (iniciais dos avatares, decorativas e `aria-hidden`): não medi.
- A moldura do Observatório acima da seção (abas e cabeçalho, copiadas do lote 1): fora do escopo; a 390 ela empilha as abas, como em todos os mockups do lote.
- Movimento reduzido: li o CSS, não simulei.

## Arquivos

Nada fora da pasta do mockup 20 foi tocado e nada foi commitado. Gravei só este arquivo e 9 capturas de evidência em `shots/r7/`. Meus scripts ficaram no escopo temporário da sessão. Servidores estáticos derrubados ao fim.
