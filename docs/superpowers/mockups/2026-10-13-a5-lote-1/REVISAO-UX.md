# Revisão de UX do lote 1 da A5 (13/10/2026)

Revisor: `revisor-ux-senior`. Não editei nenhum arquivo do lote. Servi a pasta por HTTP numa porta local (38417, encerrada pelo PID ao fim) e usei Playwright com Chromium headless, sem o projeto de e2e, sem banco, sem `apps/**`. Fontes e capas bloqueadas (rodada determinística), 1440 e 390 px (390 com toque), escuro e claro. Li `LEIAME.md`, `PLANO-UX.md`, os cinco `.js`, `lote.css`, e olhei capturas minhas (não as 188 do desenhista) de A, B, C, D e E em vários casos, mais uma simulação em escala de cinza (filtro `grayscale(1)`) de A, B, C e D.

## Resumo

| Tela | Veredito |
|---|---|
| A. Ainda cedo | **volta** (2 bloqueiam, 3 corrigem) |
| B. % assistido por período | **volta** (3 bloqueiam, 3 corrigem; uma delas redefine o que a tela mede) |
| C. Canal em erro | **volta** (3 bloqueiam, 4 corrigem) |
| D. Atraso da leitura por hora | **volta**, correção pequena (1 bloqueia, 4 corrigem; é a mais perto de pronta) |
| E. Saíram do YouTube | **volta** (4 bloqueiam, 4 corrigem) |

Nenhuma tela está reprovada: a forma de cada uma (faixa, cartões, escada, trilha, painel "o que some / o que fica") é boa e fica. **Não há acordo ainda para o lote ir ao dono**, porque cada tela tem pelo menos um número ou uma frase que o desenho contradiz na própria tela. Os consertos são de texto, de conta e de estado, nenhum de redesenho, exceto B (se o dono confirmar a leitura que recomendo).

**As três coisas que mais derrubam a qualidade do conjunto**

1. **Número ou frase que a própria tela desmente.** A: "faltam 3 dias" com a faixa mostrando 2. B: "51% contra 47% (+3)". D: "13:00, há 1 h 10 min" às 14:40. E: "Nada foi apagado" acima de uma tabela com "Apagado" e "Apagando". C: "Alarme encerrado" ao lado de um e-mail semanal que o sistema manda. O dono desconfia de número que parece bom demais; um número errado na primeira frase mata a confiança nas outras.
2. **Os estados de borda foram desenhados a partir de um texto antigo, não das decisões de 12/10.** C ignora a decisão (1) (e-mail no 3º dia e lembrete semanal). E trata o cartão de comentários como pendente da pergunta 14, que o dono respondeu em 12/10 (decisão 32). B mede "vídeos publicados", que não responde ao motivo que o dono deu.
3. **Texto repetido e prosa em coluna estreita.** E repete "Sem resposta, o dado fica" 7 vezes e "O YouTube não diz o motivo" 5 vezes; a linha do canal em erro (C) tem 200 px de prosa em 250 px de largura; a legenda das setas (B) é uma frase corrida de 3 itens.

## O que NÃO consegui verificar

Leitor de tela (só li os `aria-label` no código), Safari e Opera, ordem de teclado completa (testei só o painel da E), os popovers do ⓘ abertos, 640 e 1100 px (confio nas medidas do desenhista, não as repeti), e se as rodadas "00, 06, 12 e 18 h" de C correspondem ao cron real. Contraste de texto sobre a hachura: medi contra a cor de fundo, como o desenhista; as listras ficam fora.

## Medidas (minhas, refeitas)

| Medida | Resultado |
|---|---|
| Rolagem horizontal | **0** em 164 combinações (41 telas e casos x 1440 e 390 x escuro e claro). Confirma o desenhista |
| Menor texto | **12 px**, nenhum abaixo, nas 164 combinações. Confirma |
| Alvos de toque a 390 (ponteiro grosso) abaixo de 44 px | **0** nos controles do lote (só a barra "Estados do mockup", 32 px, que não faz parte da tela). Botões da E: 328 x 44; campo APAGAR 328 x 44 |
| `color-mix()` | 0 no código; 4 ocorrências são só comentários ("sem color-mix") em `a4.css` e `lote.css` |
| Contraste de texto mínimo (varredura de todo texto visível, 2 temas) | 1 abaixo de 4,5: "Em erro há 2 dias" (pastilha do estágio "alarme"), escuro, **4,29 pela minha varredura (4,64 compondo as duas camadas à mão)**, contra 4,93 do desenhista. No limite; sugestão (S4) |
| `--border-strong` | escuro **1,44** sobre `--surface`, claro **1,77**. Confirmado |
| `--dim` (usado nos controles novos) | 4,86 / 5,59. Confirmado |
| Contorno do "não medido" (`--nm-line`) | 4,09 / 4,57. Confirmado |
| Texto "não medido" sobre o fundo da hachura | 6,77 / 6,37 |
| Altura da linha do canal em erro, 1440 | **199 px** (linha normal 66 px) |
| Painel de resumo de C a 390 | 302 px, dos quais a escada de 3 caixas, 172 px |
| Fila E a 390 | 3.927 px para 5 itens (cerca de 780 px por item) |
| Casas da trilha D a 390 | 11,5 x 30 px (não interativas) |

## A. Ainda cedo (`a-ainda-cedo.html`) — volta

**Pergunta de quem abre:** "esse vídeo novo está sem impressão porque ninguém viu ou porque o dado ainda não chegou?". **Primeiro olhar:** a frase "Ainda cedo para ler as impressões. 3 dias medidos, todos com 0" e a faixa de 7 casas respondem em menos de 3 segundos, sem rolar a 1440. A faixa é a melhor ideia do lote: lê-se em escala de cinza (caixa com 0 contra hachura contra pontilhado) e está de acordo com as decisões (2) e (3): hoje e ontem sempre não medidos, nenhum dia antes da publicação, nenhum gráfico de zeros antes do 7º dia.

| # | Sev. | Achado | Evidência | Conserto |
|---|---|---|---|---|
| A1 | **bloqueia** | O número de dias que faltam está errado em todos os casos com faixa. A frase diz "no 7º dia (faltam N dias)", mas a 7ª casa da própria faixa cai 1 dia antes do que a conta | 17h: "faltam 6 dias", dia 7 = 18/10, hoje 13/10 (5 dias). 2d: "5", dia 7 = 17/10 (4). 3d: "4", 16/10 (3). 4d: "3", 15/10 (2). 6d: "falta 1 dia" e a faixa já mostra "hoje" na casa 7. O código usa `7 - idade` e o gráfico só volta com `idade >= 7` (hoje = 8ª casa) | Dizer a data, não a contagem: "O gráfico aparece no primeiro dia com impressão ou em 16/10 (7 dias de vida)", e fazer o 7º dia da faixa ser o mesmo dia da data. Se a regra é "7 dias completos", a faixa precisa de 8 casas ou a regra vira `idade >= 6` |
| A2 | **bloqueia** | A frase de 7d-zeros afirma mais do que o dado sustenta e contradiz a tela: "É zero medido: o YouTube mandou os dias e o vídeo **não apareceu para ninguém**", com 640 views no cabeçalho. O próprio ⓘ diz que o 0 dos primeiros dias pode ser dia sem impressão ainda | captura `a-7dz-1440`; cabeçalho "640 views" | "Nenhuma impressão nos 6 dias medidos, mas o vídeo teve 640 views. O relatório de alcance do YouTube pode estar incompleto; os 0 são o que ele mandou." (vale também para 4d e 6d com views) |
| A3 | corrige | Três nomes para a mesma forma: a hachura é "não medido" no gráfico e no cabeçalho aprovados, "sem dado" na legenda da faixa e "sem medida" no gráfico de views ("2 dias sem medida"). "sem dado" já significa outra coisa (a coleta não rodou, caso `sem-dado`). E "0 medido" na legenda contra "zero medido" no gráfico | legenda da faixa: "sem dado: o dia ainda não chegou"; casas "sem dado"; `aria-label` "não medido" | Um nome só: **"não medido: o dia ainda não chegou"** na legenda e na casa (no lugar de "sem dado"), e **"zero medido"** no lugar de "0 medido". É a legenda que a decisão (2) pede |
| A4 | corrige | "O YouTube só manda as impressões a partir do 3º dia" contradiz a faixa: o dia 3 é hoje (2d) e continua não medido; as primeiras impressões chegam quando o vídeo tem 3 dias (4ª casa) | caso 2d | "O YouTube entrega as impressões de cada dia 2 a 3 dias depois" (é o que o ⓘ e o bloco de views já dizem) |
| A5 | corrige | O 7º dia com tudo 0 troca a faixa por um gráfico de 6 caixas vazadas num eixo 0, 2, 4 inventado, com uma faixa vazia "cliques estimados por dia" embaixo: 534 px de pouca informação | captura `a-7dz-1440` | Manter o gráfico (ver resposta à decisão 3), mas sem o eixo 0 a 4 (um traço no 0) e sem a faixa de cliques quando todos os cliques são 0 |
| A6 | sugestão | A faixa repete a frase ("Ainda cedo", "N dias medidos"). A frase já diz tudo; a 6 dias o texto ainda pode encolher | LEIAME, "onde é mais fraco" | Encurtar a frase a uma linha: "Dia 4 de 7: 3 dias medidos, todos 0." |

**Fraqueza declarada: "o 7º dia com tudo 0 volta o gráfico".** Aceito, com A2 e A5. A faixa é uma barra de progresso até o 7º dia; depois dele a faixa de 7 casas perde o sentido, então algo precisa mudar, e o gráfico de caixas vazadas já é o mesmo vocabulário de formas aprovado ("zero medido"), não um gráfico de barras de altura zero. O que o dono recusou foi um gráfico que parece dizer "nada aconteceu"; a frase de A2 corrige isso.

## B. % assistido por período (`b-assistido-periodo.html`) — volta

**Pergunta de quem abre:** "esse vídeo prende mais do que o canal prende agora, ou só mais do que prendia antes?". **Primeiro olhar:** "▲ Acima do normal dos últimos 90 dias: 54% contra 51% (+3 pontos)" no topo do bloco, com barra e marca. Responde, e os três cartões servem de seletor, valor e tendência de uma vez. Boa ideia e boa forma (a seta verde só para subindo, a ocre só para descendo, o "＝" com forma própria; lê em cinza).

| # | Sev. | Achado | Evidência | Conserto |
|---|---|---|---|---|
| B1 | **bloqueia** | **"Últimos X dias = vídeos publicados" não responde ao motivo do dono** ("esse filtro pode nos indicar melhora ou piora"). Ver a resposta à decisão (4) abaixo: o dado permite "o que foi assistido nos últimos X dias" e esse é o filtro que mostra melhora ou piora | `b.js`: `normal()` filtra `v.idade <= P[per].dias`; o canal real não tem vídeo publicado nos últimos 90 dias (dito no próprio LEIAME), então no tnFigueiredo de verdade a tela só mostraria "poucos vídeos" | Refazer o normal de cada período a partir do diário por dia (`yt_own_video_daily.avg_view_percentage` pesado por `views`, `channel_id`, `day_pt` dentro da janela). O desenho (frase, barra, três cartões, ▲ ▼ ＝) fica; muda o que "poucos" quer dizer (poucas views ou poucos dias medidos, não "poucos vídeos") |
| B2 | **bloqueia** | A diferença em pontos não bate com os números mostrados: sai da mediana não arredondada | Canal cheio: cartão "51% ▲ +3" contra "47%" (51 − 47 = 4); frase da aba "51%, contra 47% (+3 pontos)"; tabela da faixa "5 a 15 min": 53% contra 47%, "▲ +5" (deveria ser 6) | Calcular a diferença sobre os valores arredondados que aparecem, ou mostrar uma casa decimal em tudo. O dono confere a conta de cabeça |
| B3 | **bloqueia** | "O canal vem melhorando" é conclusão que o dado não sustenta: compara a mediana de 25 vídeos com a de 80 (que os inclui), sem margem, e a tolerância de "＝" (2 pontos) é arbitrária. Vídeo no começo da vida e vídeo antigo medido nos últimos 28 dias têm público diferente, então a diferença mistura melhora com idade | `tend` na aba Retenção; ver B1 | Dizer o que foi medido: "Os últimos 90 dias seguram mais gente que o canal inteiro: 51% contra 47%." Sem "vem melhorando/piorando" na frase; o ▲ e o ⓘ continuam |
| B4 | corrige | Quatro camadas a 390 (611 px de bloco). A legenda "▲ o normal do período está acima... ▼ abaixo ... ＝ até 2 pontos" é uma frase corrida de 3 itens, e o lembrete "Escolha salva neste navegador: vale também na aba..." aparece em toda tela com período escolhido | capturas `b-v90-390`, `b-vpoucos-390` | Legenda das setas: sai do corpo e vai para o ⓘ, com uma linha curta sob "Comparar com": "▲ ▼ ＝ contra o canal inteiro". Lembrete: só "Salvo neste navegador · Voltar ao padrão", e o "vale também na aba" vai para o ⓘ |
| B5 | corrige | A hachura rosa (não medido) passa a significar também "amostra pequena" ("poucos vídeos") | cartões 90 e 28 dias, células da tabela | Aceitável por precedente (o cabeçalho aprovado já usa o chip "não medido" para "o normal do canal: com poucos dias ainda não dá para comparar"), mas declare como dívida: o dono definiu a hachura como "o dado não chegou" |
| B6 | corrige | Título "Vídeos publicados nos últimos 60 dias, contra o normal da faixa (últimos 90 dias)" mistura 60 e 90; a nota usa "diário do YouTube" (jargão que o próprio plano proíbe) | captura `b-c90-1440` | "Vídeos dos últimos 60 dias contra o normal da faixa" e trocar "Dado do diário" por "Dado dia a dia do YouTube" |
| B7 | sugestão | Os cartões são `<a>` com `aria-current`; é um seletor de uma opção. `role="radiogroup"` ou botões com `aria-pressed` leem melhor e não recarregam a página | `b.js` | Na implementação |

**Fraqueza declarada: quatro camadas.** Corrigir por B4; com a legenda e o lembrete fora do corpo ficam três (frase, barra, cartões), aceitável a 390 px.

## C. Canal de concorrente em erro (`c-canal-em-erro.html`) — volta

**Pergunta de quem abre:** "algum canal parou de sincronizar, desde quando, por quê, e preciso fazer algo?". **Primeiro olhar:** o contador "1 canal em erro" na faixa vermelha do cabeçalho e a frase "1 canal em erro, há 9 dias: Lucas Bigodinho. O YouTube diz que este canal não existe (erro 404). Você precisa decidir." Responde. O filtro "Em erro N", o motivo em português e o "Precisa de você / Passa sozinho" são bons.

| # | Sev. | Achado | Evidência | Conserto |
|---|---|---|---|---|
| C1 | **bloqueia** | **O desenho segue o texto antigo e diz o contrário da decisão (1).** A tela diz "Alarme encerrado há 6 dias. A marca fica…" e usa um sino cortado, que lê "ninguém mais avisa você". O sistema avisa por e-mail ao cruzar o 3º dia e lembra uma vez por semana enquanto durar (`noticeOwners`: chave canal + dia em que o erro começou + semana desde o 3º dia, ou seja, e-mails no dia 3, 10, 17...) | linha do canal e escada, `c.js` `subEstagio` e `L.IC.semSino` | Estágio 3: "Em erro há 9 dias. Avisamos você por e-mail em 07/10; próximo lembrete em 14/10, depois toda semana até resolver." (datas calculadas: começo + 3 dias, depois + 7 a cada vez). Trocar o sino cortado por envelope. Os nomes "Alarme ligado / Alarme encerrado" são do vigia do sistema, não do dono: nomear a escada pelo que ele recebe ("Tentando de novo" / "Em erro, alarme do sistema ligado" / "Em erro, avisamos por e-mail") e deixar "cron vermelho" para o ⓘ |
| C2 | **bloqueia** | "Passa sozinho" e "Costuma passar sozinho. Nada a fazer por enquanto" ficam fixos por tipo de erro, mesmo com 2 dias de demora repetida | linha do Paddy (2d, demora): "Passa sozinho" | Depois de 12 h no mesmo erro, trocar por "Já são 2 dias. Se continuar, avisamos você por e-mail em 16/10." A marca "Passa sozinho" só no estágio 1 |
| C3 | **bloqueia** | O estado "Deu certo" (`?acao=ok`) diz "a marca sumiu da lista", e a mesma tela ainda mostra a linha "Em erro há 9 dias", "Alarme encerrado…" e "1 canal em erro" no cabeçalho | DOM de `?caso=9d&acao=ok`: linha com 199 px e a pastilha de erro | No caso `ok`, a lista sai do erro: linha com "Sincronizado agora às 14:32", contador 0, filtro "Em erro 0" |
| C4 | corrige | **Linha de 199 px** (a normal tem 66; o dono aceitou 132 a 155 num acréscimo). A prosa mora na coluna Sincronização, de uns 250 px: pastilha, motivo (2 linhas), sub (3 linhas), "Precisa de você", botão | capturas `c-9d-1440`, `c-row2h-1440` | **Não** deixar só a pastilha (o motivo precisa estar na linha quando há 3 canais). Fazer: pastilha (24) + uma linha "Precisa de você: o YouTube diz que o canal não existe (404)" (36) + "Próximo e-mail: 14/10" (18); o botão "Sincronizar agora" vai para a coluna de ações, onde já há espaço ao lado de "Comparar". Alvo: **132 a 150 px** a 1440. A 390 o cartão pode crescer ~100 px |
| C5 | corrige | A frase-resumo a 390 quebra em duas colunas: o `<b>` e o texto viram dois itens de um flex | `lote.css:103` `.er-fr{display:flex}`; captura `c-9d-390-top` | Envolver o texto num `<span>` único (a 1440 só parece certo por sorte) |
| C6 | corrige | A escada de 3 caixas ("0 / 0 / 1") ocupa 172 dos 302 px do resumo a 390, com 1 só canal em erro, e repete a pastilha da linha | `c-9d-390-top` | Mostrar a escada só com 2 ou mais canais em erro; com 1, a frase basta |
| C7 | corrige | Texto do resultado: "Tentamos agora às 14:32" (a constante vira "agora às") | `?acao=falhou` | "Tentamos às 14:32." |
| C8 | sugestão | Os estágios 1 e 2 usam o mesmo ícone (triângulo) e diferem por contorno tracejado contra cheio. Em cinza se separam, mas pouco; o texto carrega | `g-c` | Ícone de relógio no estágio 1 |

**Fraqueza declarada: linha de 200 px.** Não é aceitável como está; o conserto é C4, não a alternativa "só a pastilha".

## D. Atraso da leitura por hora (`d-atraso-leitura.html`) — volta, correção pequena

**Pergunta de quem abre:** "a medida por hora está rodando? perdi horas que não voltam?". **Primeiro olhar:** pastilha "Parada" mais "Leitura por hora parada há 3 horas. 3 horas ficaram sem medida e não voltam", a trilha de 24 casas e "305 de 312 horas". Responde; sem verde (a trilha "com medida" é neutra), "desligada" e "sem medida" têm forma própria, e lê em cinza.

| # | Sev. | Achado | Evidência | Conserto |
|---|---|---|---|---|
| D1 | **bloqueia** | Conta errada no caso `atraso-leve`: "A última medida foi às 13:00, há 1 h 10 min", com agora = 14:40 (são 1 h 40) | `d.js` `minAtras: 70` | `minAtras: 100` |
| D2 | corrige | Estado "sem medida": a trilha mostra 24 casas em hachura com a legenda "sem medida: a hora não volta". As horas antes do começo da leitura não foram perdidas, nunca existiram; a frase diz "começa em 14/10" e o bloco do mês diz "começou em 14/10", sendo hoje 13/10 | `d-vazia-390`; `d.js` | No caso `vazia`, sem trilha de 24 casas (uma linha: "A primeira leitura é em 14/10, às 10:00"), e "começa" no bloco do mês |
| D3 | corrige | Nenhuma frase diz o que fazer, nem quais horas faltam | frase: "...o YouTube só mostra o total de agora." | "Faltam as medidas de 12h, 13h e 14h. O sistema tenta de novo a cada 20 minutos; você não precisa fazer nada." (o despachante roda a cada 20 min, spec 4.8). Se houver o que o dono fazer, dizer |
| D4 | corrige | As 24 casas são 24 `role="img"` com `title` por casa: no toque o `title` não existe e o leitor de tela lê 24 itens | `d.js` linha da trilha | Um só `role="img"` no `<ol>` com o resumo ("12h, 13h e 14h sem medida; uma medida fora de hora às 03h"); casas `aria-hidden` |
| D5 | corrige | Caso `varias`: a frase da leitura por hora engole "Retratos de comentários: 14 ficaram para trás, última execução completa em 11/10 às 12:20", e a tabela traz "14 ficaram para trás" na coluna Estado (é contagem, não estado) | `d-varias-1440` | Segunda linha própria sob a frase ("Outra tarefa atrasada: retratos de comentários, desde 11/10") e Estado "Atrasada" com a contagem na coluna "Última execução" |

**Fraqueza declarada: casas de 11,5 px sem alvo de toque.** **Não é reprovação pela regra dos 44 px:** a trilha não é controle (sem clique, sem foco, sem `href`), e a regra vale para alvos. O que precisa existir é a informação por outro caminho (D3 e D4); as legendas e os rótulos de hora têm 12 px. Aceitável. Se um dia a trilha ganhar toque para ver a hora, vira controle e aí vale 44 px (a solução seria uma lista de horas, não casas maiores).

## E. Saíram do YouTube (`e-sairam-do-youtube.html`) — volta

**Pergunta de quem abre:** "o que sumiu, o que tenho guardado disso, e o que acontece se eu apagar?". **Primeiro olhar:** "5 itens esperando você: 3 vídeos, 1 canal inteiro e 1 grupo de comentários", a barra por tipo (ícone e borda diferentes, lê em cinza) e, em cada cartão, "Manter para análise" como botão principal e "Apagar…" em contorno de erro. O painel "O que some / O que fica" é o melhor trecho do lote: contagens alinhadas, o irreversível dito sem suavizar, o que o sistema não alcança (IA, NAS).

| # | Sev. | Achado | Evidência | Conserto |
|---|---|---|---|---|
| E1 | **bloqueia** | "**Nada foi apagado**" na frase-resumo, e a tabela "Já respondidos" logo abaixo tem "Apagado" (02/10) e dois "Apagando". No caso `voltou` o mesmo texto convive com "você apagou em 03/10" | `e.js` `resumo()`; `e-voltou-1440` | "Nenhum destes itens foi apagado." |
| E2 | **bloqueia** | O cartão de comentários tem "Apagar os textos…" e **nenhum painel de confirmação** (`confirmacao()` só existe se o item tem `some`). Irreversível sem a contagem nem o APAGAR | `i.some` ausente em `m1` | Dar ao cartão o mesmo painel (quantos textos, em quantos vídeos, as contagens por marco; o que fica: id do comentário e a data). Tirar a etiqueta "proposta: depende da pergunta 14": **foi respondida em 12/10 (decisão 32): vai para a fila; o texto de terceiros fica**. A pergunta 8 do LEIAME ("tirar o cartão") fica sem efeito |
| E3 | **bloqueia** | Item "Apagando" (falta miniatura, arquivos no NAS esperando o dono) vive dentro de "Já respondidos", **fechado por padrão**, e não entra no contador da aba nem na frase. O dono pode nunca saber que há 2 arquivos esperando por ele | `e-cheia-1440` sem a seção aberta | Contador e frase: "5 itens esperando você e 2 apagando" (os "apagando" com pendência do dono contam como esperando). A seção abre sozinha quando houver "Apagando" |
| E4 | **bloqueia** | O botão "Apagar…" de "Mantido" (em "Já respondidos") não tem painel desenhado. É o caminho para apagar depois de ter mantido | `e-apagando-1440` | Declarar que abre o mesmo painel, e mostrar um caso. (Pode virar dívida declarada se o texto do LEIAME disser; hoje não diz) |
| E5 | corrige | Estado `voltou`: a frase diz "3 itens esperando você: 3 vídeos" contando o cartão "voltou ao ar", e há dois avisos de voltar ("1 item voltou ao ar e saiu da fila" e o cartão "Voltou ao ar em 11/10 · você apagou em 03/10") sem explicar a diferença; "a resposta 'manter' dele foi limpa" é jargão | `e-voltou-1440` | Contar só o que espera resposta; unir os dois num bloco "Voltaram ao ar (2)" com a diferença dita: "o primeiro continua com o histórico; o segundo recomeça do zero" |
| E6 | corrige | Texto repetido: "Sem resposta, o dado fica" em todo cartão (e na frase e no ⓘ), "O YouTube não diz o motivo…" (3 linhas) em todo cartão, e "O que há guardado" (3 linhas em prosa com " · ") repetido no painel que abre | `e-cheia-390`: 780 px por item | Deixar essas duas frases só na frase-resumo e no ⓘ; no cartão, "Guardado: 41 dias de série, 3 títulos, 2 miniaturas" numa linha e o detalhe só no painel. Desce a uns 600 px por item |
| E7 | corrige | "O que fica" inclui "As medidas do canal passam a ser calculadas sem este vídeo", que é uma mudança, não algo que fica; "1 comentários" na barra por tipo | `e-conf-1440`, barra | Mover para "O que some" ("Este vídeo deixa de contar nas medidas do canal") e "1 grupo de comentários" |
| E8 | corrige | O foco não vai para o campo ao abrir o painel, Esc não fecha, o "Apagar para sempre" desabilitado é um `<span role="button">` com `aria-disabled` | teste: depois do clique, `activeElement` continua sendo o botão | Registrar no LEIAME como requisito da implementação (foco no campo, Esc fecha e devolve o foco ao botão que abriu, botão realmente sem ação até digitar). Dívida declarada, não bloqueia o mockup |
| E9 | sugestão | Comparação do `APAGAR` exata e com maiúsculas: no celular, teclado com autocorreção atrapalha | `e.js` `inp.value === 'APAGAR'` | Aceitar `trim()` e maiúsculas/minúsculas; a digitação é a trava, não o caso |

**Apagar por engano em dois cliques?** Não. O caminho é: clicar em "Apagar…" (só abre o painel, não apaga), ler, digitar `APAGAR` e clicar em "Apagar para sempre". Mesmo "Manter" e "Apagar…" lado a lado (8 px a 390, 44 px de altura cada) só erram para o lado seguro. O painel diz o que some, o que fica e o que o sistema não alcança. Falta (E2, E4) onde o painel não existe, e o estado "apagando" invisível (E3).

**Estados:** *recusa* ("A forja está lendo este vídeo agora. Tente de novo em até 20 minutos") está bem: aparece dentro do painel, desabilita o campo e diz o que fazer. *Apagando*: o texto é bom ("faltam 3 miniaturas", "2 arquivos no NAS esperando você") e as formas (contorno tracejado, relógio) se distinguem de "Apagado" em cinza; o problema é onde mora (E3). *Voltou ao ar*: o cartão ("Só o código e as datas... Voltar a acompanhar / Ignorar") é bom; o problema é a frase em volta (E5).

**Fraqueza declarada: fila longa sem paginação.** Aceitável como dívida declarada, com E6 feita (queda de ~25% na altura): a fila só enche quando algo some do YouTube (para 7 canais é raro) e o contador e a frase-resumo no topo cobrem o relance. Entra no texto do LEIAME e na implementação: 10 itens por vez com "Mostrar mais N" e, no resumo, **"Manter todos para análise"** (reversível, é o caminho seguro quando vierem 20).

## Respostas às decisões do dono

**(1) Canal em erro:** não cumprida; ver C1, C2, C3.

**(2) Vídeo novo e hoje/ontem não medidos:** cumprida em A nas regras (hoje e ontem sempre hachura, nada antes da publicação, 3 dias), mas a legenda diz "sem dado" em vez de "não medido" (A3) e as contagens de dias estão erradas (A1).

**(3) Gráfico de zeros no 7º dia: minha recomendação é manter, e tirar a pergunta da lista.** As palavras do dono foram "menos de 7 dias"; a partir do 7º algo tem de mudar, porque a faixa de 7 casas termina ali. O que o gráfico de zeros mostra, em caixas vazadas ("zero medido"), é o mesmo vocabulário já aprovado, e é mais honesto do que segurar a faixa até 14 dias (que repete o problema: um bloco de zeros, só que mais tarde). O que falta é a frase certa (A2) e menos casca (A5). Segurar até 14 dias só valeria se o dono quisesse nunca ver um vídeo com 0 impressão em 7 dias, e isso esconde um sinal útil.

**(4) % assistido contra "os últimos X dias": o dono quer "o que foi ASSISTIDO no período", e o dado permite.** Razão: ele pediu o filtro "porque pode nos indicar melhora ou piora". Melhora ou piora é uma pergunta sobre o tempo: "nos últimos 28 dias as pessoas assistem mais do que assistiam antes?". "Vídeos publicados nos últimos X dias" responde a outra: "os vídeos novos prendem mais que o catálogo?", e mistura público de lançamento com público de busca (vídeo novo medido nos seus primeiros dias contra vídeo antigo medido na janela de 28). O dado permite a leitura certa: `yt_own_video_daily` tem, por vídeo e dia, `views` e `avg_view_percentage` (chave `youtube_video_id` + `day_pt`, índice por `channel_id` e dia). O normal de "últimos X dias" é a média do % assistido dos dias dentro da janela, de todos os vídeos com view, pesada pelas views do dia; é uma conta da tabela que já existe, sem coleta nova. Vantagens: acaba o "poucos vídeos" (o tnFigueiredo real não publicou nos últimos 90 dias e nunca teria resposta), e a comparação "janela contra o canal inteiro" é a de melhora ou piora. O custo é de redação ("poucas views no período", "o diário só começa em dd/mm"). **Ressalva honesta:** ponderar por views não é exatamente o que o YouTube pondera (por tempo assistido); serve para o normal, e o ⓘ deve dizer "média pesada pelas views".

**(5) `--border-strong` 1,44 e 1,77: dívida do design system, não bloqueia este lote.** Já existia nos mockups aprovados e hoje está em botões com texto (o rótulo identifica o controle, a borda é decoração) e nas bordas de chips. Os controles novos que dependem da borda para existir (cartões do período, campo APAGAR) usam `--dim` (4,86 / 5,59), e eu medi. Conserto exato quando for tratada: trocar o valor de `--border-strong` em controles de formulário por `--dim`, sem token novo; entra na lista de dívidas do sistema, com os 3 locais do lote que o usam (`.btn`, `.chip`, o traço do mockup). Bloquearia se um controle sem texto (ícone, campo, seletor) usasse `--border-strong`: nenhum usa.

## Perguntas ao dono, na redação final

Ficam duas. As outras sete eu respondi pela regra escrita (tabela abaixo).

1. **B. "Últimos 90 dias" mede o que as pessoas assistiram nos últimos 90 dias (todos os vídeos, dia a dia), ou só os vídeos publicados nos últimos 90 dias?** Recomendo o primeiro: responde "melhora ou piora" e funciona no seu canal, que não publicou nada em 90 dias.
2. **C. Pode haver "Sincronizar agora" na linha do canal em erro (gasta cota do YouTube, uma chamada por canal)?** Recomendo sim, só no canal em erro, desabilitado com a hora de volta quando a cota acabou.

| Pergunta do LEIAME | Resposta pela regra | Por quê |
|---|---|---|
| 1. 0 dentro das casas ou só "ainda cedo" | Sim, 0 dentro | É a linguagem aprovada em 12/10: "zero medido" = caixa vazada com 0 |
| 2. Faixa também no "vídeo novo" | Sim | Mesma linha do tempo, mesmas formas; decisão (2) define o estado |
| 3. Gráfico de zeros no 7º dia | Sim, com a frase de A2 | O dono disse "menos de 7 dias" |
| 5. Escolha lembrada no navegador ou na conta | Navegador, padrão "canal inteiro" | Preferência de leitura barata e reversível; o dono muda depois se quiser |
| 6. O "alarme" | Vale o e-mail no 3º dia e o lembrete por semana | Decisão (1) do dono |
| 8. Cartão de comentários na fila | Fica | Decisão 32 (12/10): vai para a fila |
| 9. Apagar canal inteiro reaproveita "remover canal" | Sim, com o painel por cima | Regra "reuso primeiro"; a contagem de impacto já existe (`youtube_channel_removal_impact`) |

## Ordem para o dono abrir as telas e o caso que mostra o essencial

1. **A:** `a-ainda-cedo.html?caso=4d-zeros`, depois `?caso=4d-numeros` (é o caso que ele descreveu).
2. **B:** `b-assistido-periodo.html?periodo=90`, depois `?tela=canal&periodo=90`.
3. **C:** `c-canal-em-erro.html?caso=9d`, depois `?caso=tres` e `?caso=9d&acao=cota`.
4. **D:** `d-atraso-leitura.html?caso=atraso-3h`, depois `?caso=varias`.
5. **E:** `e-sairam-do-youtube.html?caso=cheia`, depois `?caso=confirmar`. Por último: é a que mais pesa e a única que apaga.

## Acordo com o desenhista

Não há acordo ainda. Mantenho "volta" nas cinco telas. As correções que **bloqueiam** (A1, A2; B1, B2, B3; C1, C2, C3; D1; E1, E2, E3, E4) são todas de texto, de conta ou de estado, e eu confiro de novo só os casos alterados. Para D, depois de D1 a D5, o veredito passa a "pronto para o dono" sem nova rodada completa. Se o desenhista discordar de algum achado, respondo com a medida ou a captura e mantenho ou retiro por escrito; o que sobrar vai ao dono com os dois lados.

Capturas e scripts desta revisão ficam no scratchpad da sessão (fora do repositório).


---

# RECONFERÊNCIA (rodada 2) (13/10/2026)

Revisor: `revisor-ux-senior`. Servi a pasta por HTTP numa porta local (41877, encerrada pelo PID), Chromium headless, sem o projeto de e2e e sem banco. Abri 23 casos (A 5, B 4, C 5, D 4, E 5) a 1440 claro, 1440 escuro, 390 claro e 390 escuro; olhei as capturas de C `9d`, B `?tela=canal&periodo=90` e E `cheia` e li o texto de cada caso. Refiz as contas das tabelinhas.

## Veredito por tela

| Tela | Veredito | O que falta (lista exata) |
|---|---|---|
| A. Ainda cedo | **pronto para o dono** | nada |
| B. % assistido por período | **volta** | B-R1 (abaixo), 3 trocas de texto |
| C. Canal em erro | **pronto para o dono** | nada |
| D. Atraso da leitura | **volta** (pequena) | D-R1: duas contas do mês |
| E. Saíram do YouTube | **pronto para o dono** | só sugestões |

## 1. Os bloqueios da rodada 1 fecharam?

- **A1, A2:** fecharam. Refiz a tabela: dia 7 = publicação + 6; hoje 13/10; 17h (12/10) faltam 5, 18/10; 2d (11/10) faltam 4, 17/10; 3d (10/10) faltam 3, 16/10; 4d (09/10) faltam 2, 15/10; 5d (08/10) falta 1, 14/10, "amanhã"; todos batem com a data na frase e com as casas pontilhadas depois de hoje. Dias medidos (casas menos hoje e ontem): 2, 3, 4 ok. A frase de 0 impressão cita as views, e não diz mais "não apareceu para ninguém".
- **B2, B3:** fecharam. Conferi pelos números na tela: 51−47=+4, 52−47=+5, 55−52=+3, 56−52=+4, 53−47=+6, 54−47=+7, 43−41=+2 "＝", 44−41=+3; na lista 60−55=+5, 47−53=−6, 52−55=−3, 61−55=+6, 52−53=−1 "＝". Sem "vem melhorando". **B1 fechou na forma** (mede o assistido na janela), mas abriu B-R1.
- **C1, C2, C3:** fecharam. Estágio 3 diz e-mail em 07/10 e próximo em 14/10 (04/10+3 = 07/10; +7 = 14/10), envelope no lugar do sino cortado, "Já são 2 dias. Se continuar, e-mail em 14/10", e `acao=ok` sem a linha de erro. Linha do canal em erro: **141 px a 1440 e a 1100** (medi), 523 px a 390; rolagem horizontal 0.
- **D1:** fechou (1 h 40; 3 h 40; 14 h 40; 20 h 40 ok). Casas hachuradas: 1, 3, 14, 20 ok. Mês: 12 dias × 24 + 15 (00h a 14h) = **303**, ok. Mas veja D-R1.
- **E1, E2, E3, E4:** fecharam. "Nenhum destes itens foi apagado"; o cartão de comentários tem o painel (7 textos, "O que some", "O que fica", APAGAR); "Apagando (2)" fica sempre à vista; `apagar-mantido` abre o painel (foco cai no campo). Cartão a 390: 568 a 608 px.

## 2. Os três pontos em que o desenhista fez diferente

- **(a) Data do e-mail do canal de 2 dias: 14/10. O desenhista está certo; eu errei.** A regra é "e-mail ao cruzar o 3º dia" = dia em que o erro começou + 3. Paddy começou em 11/10 (49 h) → 14/10; Dale (13/10) → 16/10, que é onde eu pus a data por engano. Achado retirado. Consistente com Lucas (04/10 → 07/10, depois 14/10).
- **(b) A6 sem "Dia 4 de 7": aceito.** Com o dia da publicação como dia 1, o vídeo de 4 dias (09/10) está no dia 5 e a faixa mostra "hoje" na casa 5; "Dia 4 de 7" contradiria a faixa. A frase de duas orações continua sendo sugestão.
- **(c) Contador da aba E = 7: aceito.** É a soma que a frase diz ("5 itens esperando você e 2 apagando"); o número e a frase não se contradizem. Sugestão, não exigência: um dos 2 "apagando" é nova tentativa do sistema (miniaturas no Blob), então só 6 pedem algo do dono. Uma linha em `e.js` se ele quiser 6.

## 3. B: "canal inteiro" passou de mediana por vídeo para média pesada pelas views

**Sim, o mesmo cartão vai mostrar um número diferente do que a tela em produção (A4, aprovada) mostra para "canal inteiro".** O desenhista declarou a mudança só como dívida no LEIAME e no rodapé; ninguém a pediu e o dono não sabe. Mudar em silêncio um número aprovado é o tipo de coisa que o dono descobre ao comparar duas telas e passa a desconfiar das duas.

**Veredito: "canal inteiro" continua sendo a mediana aprovada; os períodos usam a MESMA conta, aplicada à janela** (mediana por vídeo do % assistido de cada vídeo dentro dos últimos X dias, vídeos com views no período). Razões: (1) compara igual com igual (média pesada contra mediana mistura método com período, e a seta ▲ ▼ passa a medir também a diferença entre as duas contas); (2) não altera número aprovado; (3) o desenhista escreveu que "o dado serve às duas" contas. Não é pergunta para o dono: é consequência da decisão dele (12/10) de manter o normal aprovado e só trocar a janela.

**B-R1 (corrige, em B):** (i) o ⓘ e o rodapé ("O que entra no normal", "a conta é a mesma nos três (média pesada pelas views dos dias)... pode diferir da mediana por vídeo") passam a dizer mediana por vídeo, e a frase "viu em média 51%" vira "o vídeo típico foi assistido por 51%"; (ii) tirar a dívida "B, conta" do LEIAME; (iii) "poucas views" (limite 1.000 views no período) fica como está. Os números de exemplo não precisam mudar (são exemplo), só a descrição. **Se o desenhista discordar** (quiser manter a média pesada), a alternativa honesta é levar ao dono, e só ao dono, a pergunta: "O 'canal inteiro' hoje mostra a mediana dos vídeos. Posso trocar por média pesada pelas views, que muda o número que você vê hoje na tela do vídeo?" Eu recomendo que não.

## 4. Linha do canal em erro (141 px) e cartão da E a 390 px

Aceitos. Linha: 141 px (alvo 132 a 150), tabela sem rolar por dentro, botão "Sincronizar agora" só nessa linha. Cartão da fila a 390: 568 a 608 px, sem rolagem horizontal. Nenhum botão abaixo de 44 px na área do produto (E a 390 com toque).

## 5. Regressão (A, B, C, D, E amostradas a 1440 claro e 390 escuro, mais 1440 escuro e 390 claro nos 23 casos)

Nenhuma piora em algo que estava certo. Rolagem horizontal 0 nos 92 carregamentos; texto menor que 12 px: nenhum nos casos olhados. Sugestões novas, sem bloquear: **E, 1440:** o rótulo da barra por tipo corta "1 grupo de com…" com espaço sobrando; **E, `voltou` e `cheia`:** a frase-resumo tem 4 a 5 frases curtas (fica no limite; o que mais importa está na 1ª).

## D-R1 (corrige, em D): as contas do mês não fecham com a trilha

`d.js`, campo `semMes`: `em-dia` = 4 e `atraso-leve` = 4, mas o atraso leve tem uma hora a mais sem medida (a das 14h) que o em-dia não tem; devia ser 5 (**298 de 303**, não 299). `desligada` = 20 só conta as 20 horas da trilha; com as mesmas 4 de antes seriam 24 (**279 de 303**), e a tela mostra 283. Os outros casos fecham (3 h: 4+3=7; 14 h: 4+14=18). Ajustar o código e a linha "Mês: ... 283" da tabelinha do LEIAME.

## 6. Contraste (pares novos: envelope, datas e pastilhas de C; "Apagando" de E)

Varredura de todo texto visível (cor composta sobre o fundo composto, lida do navegador), nos 23 casos, nos dois temas e nos dois tamanhos: **menor razão de texto = 4,64:1** (claro, "▼ −3" em B, 12,5 px); o resto do conjunto fica em 4,73 ou mais, o menor do escuro é 5,24. Nenhum texto abaixo de 4,5:1; as pastilhas de C em `--text` deixaram de ter o 4,29 da rodada 1. Pastilha "Apagando" e envelope de C: nenhum texto abaixo de 4,5. **Não medi** o contraste de elemento gráfico (3:1) dos ícones novos (envelope, relógio, contorno tracejado) de novo; o desenhista também não; o que os distingue é a forma, que se lê em cinza nas capturas que vi. Leitor de tela, Safari e Opera: não verifiquei.

## Fechamento

**AINDA NÃO: faltam B (B-R1, quatro trocas de texto sobre a conta do "canal inteiro") e D (D-R1, dois números do mês).** São linhas, não redesenho, e eu confiro só esses casos (`b-assistido-periodo.html?periodo=90` e `?tela=canal&periodo=90`; `d-atraso-leitura.html?caso=atraso-leve` e `?caso=desligada`). **HÁ ACORDO para A, C e E irem ao dono**; se quiserem mostrá-las já, vão sem B e D.

### Para colar ao dono (A, C e E)

Abra os arquivos em `docs/superpowers/mockups/2026-10-13-a5-lote-1/`, nesta ordem:
1. `a-ainda-cedo.html?caso=4d-zeros`, depois `?caso=4d-numeros`. Olhe a frase e a faixa de 7 casas: a data da frase é a da última casa.
2. `c-canal-em-erro.html?caso=9d`, depois `?caso=tres` e `?caso=9d&acao=cota`. Olhe a frase (quando avisamos por e-mail, próximo lembrete) e o botão só na linha do canal em erro.
3. `e-sairam-do-youtube.html?caso=cheia`, depois `?caso=confirmar`. Por último, é a única que apaga. Olhe "5 itens esperando você e 2 apagando" e o painel "o que some / o que fica".

Perguntas só dele: nenhuma nestas três. A tela B segue sem pergunta (a recomendação é manter a mediana aprovada), a menos que o desenhista discorde por escrito.
