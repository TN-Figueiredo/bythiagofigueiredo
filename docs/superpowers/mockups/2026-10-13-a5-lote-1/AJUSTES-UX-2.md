# Ajustes da rodada 2 (13/10/2026): item por item da `REVISAO-UX.md`

Desenhista: skill `frontend-design`. URLs relativas a esta pasta; abra com `?tema=claro` para o claro. "Feito" = está no código e nas capturas novas. Nenhum achado foi recusado; os dois "parcial" e as dívidas estão explicados.

## A. Ainda cedo (`a-ainda-cedo.html`)

| # | Estado | O que foi feito | Onde conferir |
|---|---|---|---|
| A1 | feito | Regra do dia 7: o dia da publicação é o dia 1 e o gráfico volta no dia 7 (`idade >= 6`, a segunda saída do revisor). "faltam N dias" = casas pontilhadas depois de hoje, contando a 7ª; a frase diz a data e "a última casa da faixa". Tabelinha dos casos no LEIAME. Caso novo `5d-zeros` (falta 1 dia). | `?caso=17h` (faltam 5, 18/10), `2d` (4, 17/10), `3d-zeros` (3, 16/10), `4d-zeros` (2, 15/10), `5d-zeros` (1, 14/10) |
| A2 | feito | Frase com 0 impressão e views: "Nenhuma impressão nos 5 dias medidos, mas o vídeo teve 598 views. O relatório de alcance do YouTube pode estar incompleto: os 0 são o que ele mandou." Nos casos de faixa, "o vídeo já teve 412 views, o relatório de alcance é que chega atrasado". | `?caso=6d-zeros`, `?caso=7d-zeros`, `?caso=4d-zeros` |
| A3 | feito | "não medido: o dia ainda não chegou" na legenda, na casa (quando não é hoje nem ontem) e nos gráficos; "zero medido"; "dias não medidos" no lugar de "sem medida". | `?caso=2d` (casa "não medido"), `?caso=4d-zeros` |
| A4 | feito | "O YouTube entrega as impressões de cada dia 2 a 3 dias depois". | `?caso=17h` |
| A5 | feito | Gráfico de zeros sem o eixo 0 a 4 (só a linha do 0, opção `soZeros` em `a4-comum.js`) e sem a faixa de cliques quando todos os cliques são 0. | `?caso=6d-zeros` |
| A6 | parcial | A frase continua com duas orações. Não usei "Dia 4 de 7" porque, contando o dia da publicação como dia 1, um vídeo de 4 dias está no dia 5 (a faixa mostra "hoje" na casa 5), e a frase contradiria a faixa. A frase de faixa continua com 3 linhas a 1440 (a das impressões e as views foram somadas na mesma frase); fica como sugestão em aberto. | `?caso=4d-zeros` |

Aceitação da fraqueza declarada (gráfico de zeros no dia 7): mantida, com A2 e A5.

## B. % assistido por período (`b-assistido-periodo.html`)

| # | Estado | O que foi feito | Onde conferir |
|---|---|---|---|
| B1 | feito | "Últimos X dias" = o que foi assistido na janela, todos os vídeos, média do % de cada dia pesada pelas views do dia. "Poucos vídeos" virou "poucas views" (1.000 no período). A alternativa "publicados" saiu (decisão do dono). | `?periodo=90`, `?caso=poucos&periodo=28` |
| B2 | feito | Pontos calculados sobre os valores arredondados da tela; tabelinha no LEIAME (51 contra 47 = +4; 53 contra 47 = +6; 54 contra 52 = +2, "＝"). | `?tela=canal&periodo=90` |
| B3 | feito | Sem "vem melhorando". "Nos últimos 90 dias, quem assistiu viu em média 51% dos vídeos; no canal inteiro, 47% (+4 pontos)." | `?tela=canal&periodo=90`, `?tela=canal&caso=piora&periodo=90` |
| B4 | feito | Legenda das setas: uma linha curta; método no ⓘ; lembrete "Salvo neste navegador · Voltar ao padrão", ausente com canal inteiro. | `?periodo=28`, 390 px |
| B5 | dívida | Hachura também para "poucas views"; declarada no LEIAME, como o revisor aceitou. | cartão 28 em `?caso=poucos&periodo=28` |
| B6 | feito | Título sem 60/90 e sem "diário". O título ficou "Vídeos mais assistidos, contra o normal da faixa (últimos 90 dias)" porque a lista agora é por views no período, não por data de publicação. | `?tela=canal&periodo=90` |
| B7 | não feito | Era "na implementação"; um `role` sem o teclado de rádio seria pior que `aria-current`. Dívida no LEIAME. | — |

Ressalva honesta do revisor aplicada: o ⓘ diz "média pesada pelas views". Acrescentei uma dívida que ele não listou: a mesma conta vale também para o "canal inteiro", que na tela aprovada era mediana por vídeo.

## C. Canal em erro (`c-canal-em-erro.html`)

| # | Estado | O que foi feito | Onde conferir |
|---|---|---|---|
| C1 | feito | Cron vermelho da 12ª hora ao 3º dia; depois verde, um e-mail ao cruzar o 3º dia e um lembrete por semana. Sem sino cortado nem "alarme encerrado": "Avisamos você por e-mail em 07/10; próximo lembrete em 14/10, depois toda semana até resolver"; envelope no estágio 3; escada com nomes pelo que o dono recebe; "cron vermelho" só no ⓘ. Datas calculadas (tabela no LEIAME). | `?caso=9d`, `?caso=tres` |
| C2 | feito | Depois de 12 horas "Passa sozinho" sai: "Já são 2 dias. Se continuar, e-mail em 14/10". O aviso "Falhou" do canal de 2 dias idem. A data é 14/10 (começo do erro 11/10 + 3), não 16/10 como no exemplo do revisor. | `?caso=2d`, `?caso=2d&acao=falhou` |
| C3 | feito | `acao=ok`: linha "Sincronizado agora, às 14:32", contador 0, filtro "Em erro 0", sem resumo. | `?caso=9d&acao=ok` |
| C4 | feito | Linha de 141 px a 1440 e a 1100 (era 199): pastilha + uma frase + uma linha de e-mail; o botão foi para a coluna de ações. A 390, cartão de 523 px. Para a tabela não rolar por dentro, as colunas Trocas e Sincronização perdem largura mínima só nesta tela. | `?caso=9d` |
| C5 | feito | Frase-resumo num `<span>` só. | `?caso=9d`, 390 px |
| C6 | feito | Escada só com 2 ou mais canais em erro. | `?caso=tres` (tem escada), `?caso=9d` (não tem) |
| C7 | feito | "Tentamos às 14:32." | `?caso=9d&acao=falhou` |
| C8 | feito | Relógio no estágio 1. | `?caso=tres` |
| S4 | feito | Texto das pastilhas em `--text`; vermelho na borda e no ícone. | `?caso=2d` |

Decisão do dono aplicada: "Sincronizar agora" só na linha em erro; nos estados "Recusada" o botão da linha fica desabilitado ("Volta às 04:00", "Sincronizando…"): `?caso=9d&acao=cota`.

## D. Atraso da leitura por hora (`d-atraso-leitura.html`)

| # | Estado | O que foi feito | Onde conferir |
|---|---|---|---|
| D1 | feito | `minAtras: 100`: "há 1 h 40 min". Tabelinha no LEIAME; conferi também os outros casos (3 h 40, 14 h 40, 20 h 40). | `?caso=atraso-leve` |
| D2 | feito | `sem-leitura`: sem trilha, "A primeira leitura é em 14/10, às 10:00"; "começa em 14/10" no mês. | `?caso=sem-leitura` |
| D3 | feito | "Faltam as medidas de 12h, 13h e 14h. O sistema tenta de novo a cada 20 minutos; você não precisa fazer nada." Acima de 6 h a frase manda conferir a tarefa na lista (que abre sozinha); essa frase é minha, marcada como a confirmar. | `?caso=atraso-3h`, `?caso=atraso-14h` |
| D4 | feito | Um `role="img"` na trilha com o resumo por extenso; casas `aria-hidden`. | DOM de `?caso=atraso-3h` |
| D5 | feito | Linha própria "Outra tarefa atrasada: retratos de comentários, desde 11/10 (14 execuções ficaram para trás)"; Estado "Atrasada"; contagem na coluna "Última execução". | `?caso=varias` |
| extra | feito | O mês tinha 312 horas (13 dias inteiros, com as 9 horas de hoje que ainda não chegaram); agora 303. | `?caso=atraso-3h` |

## E. Saíram do YouTube (`e-sairam-do-youtube.html`)

| # | Estado | O que foi feito | Onde conferir |
|---|---|---|---|
| E1 | feito | "Nenhum destes itens foi apagado". Em "voltou" também. | `?caso=cheia`, `?caso=voltou` |
| E2 | feito | Cartão de comentários na fila, sem a etiqueta da pergunta 14, com o mesmo painel (7 textos, 21 contagens, o que fica, o que não sai) e APAGAR. | `?caso=confirmar-comentarios` |
| E3 | feito | Bloco "Apagando (2)" sempre à vista; frase "5 itens esperando você e 2 apagando"; contador da aba 7 (5 + 2). | `?caso=cheia`, `?caso=apagando` |
| E4 | feito | "Apagar…" de um item mantido abre o mesmo painel (item novo, "Lisboa em 5 dias com 300 euros"). | `?caso=apagar-mantido` |
| E5 | feito | "Voltaram ao ar (2)" num bloco, com a diferença dita; a frase conta só o que espera resposta. "A resposta 'manter' foi limpa" saiu. | `?caso=voltou` |
| E6 | feito | Cartão curto; as duas frases repetidas só na frase-resumo e no ⓘ; "Guardado:" numa linha. Cartão a 390 px: 570 a 608 px. | `?caso=cheia`, 390 px |
| E7 | feito | "deixa de contar nas medidas" em "O que some"; "1 grupo de comentários". | `?caso=confirmar` |
| E8 | parcial | No mockup: foco no campo ao abrir, Esc fecha e devolve o foco (testado). Botão realmente inerte é requisito da implementação (dívida no LEIAME). | `?caso=confirmar` |
| E9 | feito | `trim()` e maiúsculas/minúsculas (testado: " apagar " acende o botão). | `?caso=confirmar` |

Fraqueza declarada (fila longa): dívida no LEIAME com "10 por vez" e "Manter todos para análise".

## Respostas às decisões do dono e às medidas

- (1) a (4): cumpridas em A, C, B e E como acima; (5) `--border-strong`: dívida do design system, no LEIAME.
- Medidas (368, 1440, 1100, 640 e 390, escuro e claro): rolagem 0, texto 12 px ou mais, alvos de 44 px ou mais a 390 e 640, `color-mix()` 0. Tabela do LEIAME.

## Onde discordo do revisor

Em nenhum achado discordo do que ele pediu. Quatro pontos em que fiz diferente do exemplo que ele deu, para ele conferir:

1. **C2:** a data do e-mail do canal de 2 dias é 14/10 (não 16/10): o erro começou em 11/10 e o 3º dia é 14/10.
2. **E3:** li "5 itens esperando você e 2 apagando" como contador 7; se ele queria 6 (só o "apagando" que espera o dono no NAS), é uma linha em `e.js` (`contador`).
3. **A6:** não usei "Dia 4 de 7" (a conta dele e a minha divergem em 1; a minha segue a faixa).
4. **B6:** o título da lista muda de sentido junto com B1; o texto exato que ele sugeriu não cabe mais.

## Rodada 3 (B-R1 e D-R1)

Servir a pasta: `python3 -m http.server 8765` dentro de `docs/superpowers/mockups/2026-10-13-a5-lote-1/`. Decisão: o "canal inteiro" fica com a mediana por vídeo (a da tela aprovada); os períodos usam a mesma conta sobre o que foi assistido na janela. Nenhuma média pesada pelas views. Os números de exemplo não mudaram (a tela mostra os mesmos da tabelinha de B do LEIAME).

### B-R1 (`b.js`; URLs: `b-assistido-periodo.html?periodo=90`, `?periodo=28`, `?tela=canal&periodo=90`, `?tela=canal&periodo=28`, `?caso=piora&periodo=90`, `?caso=poucos&periodo=28`, `?caso=sem-dado`)

| Onde | Antes | Depois |
|---|---|---|
| ⓘ "Como o período é contado" (últimos 90 dias) | "É a média do % assistido de cada dia, pesada pelas views do dia: um dia com mais views pesa mais. É a conta desta tela, igual nos três períodos; não é a que o YouTube usa." | "Para cada vídeo, vale só o % assistido dentro dessa janela; o normal é a mediana desses vídeos (o vídeo do meio, não a média), com a mesma conta do canal inteiro." |
| ⓘ (▲ ▼ ＝) | "com a mesma conta." | "com a mesma conta (mediana por vídeo)." |
| ⓘ da tela do vídeo ("O normal") e da aba ("% assistido", "Normal da faixa") | "média do % de cada dia, pesada pelas views do dia" | "a mediana do % assistido dos outros vídeos do canal, no período escolhido (cada vídeo conta uma vez...)" e "a mediana do % assistido dos vídeos da mesma faixa" |
| Frase da aba Retenção | "Nos últimos 90 dias, quem assistiu viu em média 51% dos vídeos; no canal inteiro, 47% (+4 pontos)." | "Nos últimos 90 dias, o vídeo típico foi assistido por 51%; no canal inteiro, 47% (+4 pontos)." (28 dias: 52% contra 47%, +5) |
| Rodapé, tabela "O que entra no normal" | "o que foi assistido em todos os dias medidos..." / "...em todos os vídeos do canal" | "mediana, por vídeo, do % assistido de cada vídeo, de 16/04 a 11/10" / "mediana, por vídeo, do % assistido na janela de ... (só o que foi assistido nela)" |
| Rodapé, nota | "A conta é a mesma nos três (média pesada pelas views dos dias), então o "canal inteiro" daqui pode diferir da mediana por vídeo que a tela de hoje usa: ver a dívida no LEIAME." | "A conta é a mesma nos três: mediana por vídeo, a da tela aprovada. O "canal inteiro" continua com o número de hoje; os períodos só restringem o que entra à janela." |
| Comentário do arquivo, LEIAME | "média pesada"; dívida "B, conta" | mediana por vídeo; a dívida saiu |

Números (conferidos na tela, 1440): cheio 47 / 51 (▲ +4) / 52 (▲ +5); vídeo 54 contra 47 (+7), 51 (+3), 52 (+2, ＝); piorando 49 / 46 (−3) / 43 (−6); poucas views 48 / 49 (＝ +1) / 28 dias "poucas views, 340 de 1.000".

### D-R1 (`d.js`, campo `semMes`; URLs: `d-atraso-leitura.html?caso=atraso-leve`, `?caso=desligada`, e os demais para a soma)

| Caso | Sem medida no mês, antes → depois | Com medida de 303 |
|---|---|---|
| `atraso-leve` | 4 → **5** | 299 → **298** |
| `desligada` | 20 → **24** | 283 → **279** |
| `em-dia`, `atraso-3h`, `varias`, `atraso-14h`, `sem-leitura` | 4, 7, 7, 18, 303 (sem mudança: 4 + horas da trilha) | 299, 296, 296, 285, 0 |

Medidas (72: B nos 14 casos e D nos 2, a 1440 e 390, claro e escuro): rolagem 0, texto de 12 px ou mais, alvos de 44 px ou mais a 390, `color-mix()` 0.
