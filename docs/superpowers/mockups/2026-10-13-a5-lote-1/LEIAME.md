# Lote 1 da A5: cinco mockups, rodada 3 (13/10/2026)

Sirva a pasta e abra pelo endereço (ou abra o `.html` direto do disco; os parâmetros `?caso=` funcionam nos dois): `cd docs/superpowers/mockups/2026-10-13-a5-lote-1 && python3 -m http.server 8765`, depois `http://127.0.0.1:8765/<arquivo>`. Cada tela está **dentro do Observatório real** (cabeçalho, abas, Lista de Canais, tela do vídeo já aprovados); o que a proposta acrescenta leva **contorno tracejado verde-água e a marca "+ novo"**. Todo número, canal e vídeo é **exemplo**. Sem rede, as fontes caem nas do sistema. `?tema=claro` liga o claro; a barra "Estados do mockup", recolhida no topo, tem um botão por estado.

## Como abrir e em que ordem

Cinco telas, nesta ordem (todas as URLs abaixo são relativas à pasta servida; E por último porque é a única que apaga):

1. **A, ainda cedo:** `a-ainda-cedo.html?caso=4d-zeros` e depois `?caso=4d-numeros`. Olhe primeiro a frase e a faixa de 7 casas: a última casa (dia 7) tem a mesma data que a frase diz, e "faltam 2 dias" é o número de casas pontilhadas depois de hoje. O segundo é o caso que você descreveu.
2. **B, % assistido por período:** `b-assistido-periodo.html?periodo=90` e depois `?tela=canal&periodo=90` (a conta é a mediana por vídeo, a mesma do "canal inteiro" de hoje). Olhe primeiro "Acima do normal dos últimos 90 dias: 54% contra 51% (+3 pontos)" e os três cartões (47, 51, 52; ▲ +4 e ▲ +5 contra o canal inteiro). Na aba, a conta fecha em cada célula.
3. **C, canal em erro:** `c-canal-em-erro.html?caso=9d`, depois `?caso=tres` e `?caso=9d&acao=cota`. Olhe primeiro a frase (diz quando avisamos por e-mail e quando é o próximo lembrete) e a linha do canal (141 px, não 199); o botão "Sincronizar agora" está na coluna de ações, só nessa linha.
4. **D, atraso da leitura por hora:** `d-atraso-leitura.html?caso=atraso-leve` e depois `?caso=desligada`; também `?caso=atraso-3h` e `?caso=varias`. Olhe primeiro a frase, a linha "Faltam as medidas de 12h, 13h e 14h" (em `atraso-3h`) e a trilha: três casas hachuradas, as mesmas três horas; e o bloco do mês, que soma 303 (298 de 303 em `atraso-leve`, 279 de 303 em `desligada`).
5. **E, saíram do YouTube (por último, é a única que apaga):** `e-sairam-do-youtube.html?caso=cheia` e depois `?caso=confirmar`. Olhe primeiro "5 itens esperando você e 2 apagando" e o bloco "Apagando"; depois o painel "o que some / o que fica". Os outros painéis: `?caso=confirmar-comentarios`, `?caso=apagar-mantido`, `?caso=confirmar-canal`.

## Decididas pelo dono em 12/10 (não são mais perguntas)

- **B:** "últimos X dias" mede o que foi **assistido** no período, em todos os vídeos do canal (o dado existe por vídeo e por dia). A alternativa "publicados no período" saiu da tela.
- **C:** "Sincronizar agora" aparece **só na linha do canal em erro** (gasta uma chamada de cota por canal; fica desabilitado com a hora de volta quando a cota acabou).
- **Nenhuma pergunta em aberto.** As outras sete perguntas da rodada 1 o revisor respondeu pela regra escrita: 0 dentro das casas; faixa também no "vídeo novo"; gráfico de zeros no dia 7; escolha lembrada no navegador, padrão "canal inteiro"; e-mail no 3º dia e lembrete por semana; cartão de comentários fica na fila; apagar canal inteiro reaproveita "remover canal" com o painel por cima.

## O que mudou na rodada 2 (um item do revisor por linha)

**A**
- A1: "faltam N dias" bate com a faixa em todos os casos. O dia da publicação é o dia 1; o gráfico volta no dia 7 (6 dias depois), que é a 7ª casa. A frase diz a data ("em 15/10 (faltam 2 dias), a última casa da faixa"). Foi a segunda saída que o revisor deu (regra `idade >= 6`); a tabelinha está abaixo.
- A2: com 0 impressão e views no cabeçalho, a frase diz "Nenhuma impressão nos 5 dias medidos, mas o vídeo teve 598 views. O relatório de alcance do YouTube pode estar incompleto: os 0 são o que ele mandou". Nos casos de faixa (3, 4 e 5 dias) entra "o vídeo já teve 412 views, o relatório de alcance é que chega atrasado".
- A3: um nome só, "não medido: o dia ainda não chegou" (legenda, casa, gráfico de views, frases); "zero medido" no lugar de "0 medido"; "sem dado" e "sem medida" saíram.
- A4: "O YouTube entrega as impressões de cada dia 2 a 3 dias depois" no lugar de "só a partir do 3º dia".
- A5: no dia 7 com tudo 0 o gráfico fica, sem o eixo 0, 2, 4 inventado (só a linha do 0) e sem a faixa "cliques estimados" (não há clique).
- A6: parcial (ver `AJUSTES-UX-2.md`).
- Dados do exemplo: as views por dia agora somam com o total do cabeçalho (antes o gráfico dizia 25 views e o cabeçalho, 301).

**B**
- B1: o normal de cada período é o que foi assistido na janela. **Rodada 3 (B-R1): a conta é a MEDIANA por vídeo do % assistido, a mesma do "canal inteiro" aprovado; os períodos só restringem o que entra à janela. Não há média pesada pelas views em lugar nenhum de B** (o número do canal inteiro não muda). "poucos vídeos" virou "poucas views" (mínimo 1.000 views no período).
- B2: toda diferença em pontos é feita sobre os números arredondados que aparecem (tabelinha abaixo). 51 contra 47 é +4; 53 contra 47 é +6.
- B3: sai "o canal vem melhorando". A frase diz o que foi medido: "Nos últimos 90 dias, o vídeo típico foi assistido por 51%; no canal inteiro, 47% (+4 pontos)".
- B4: a legenda das setas saiu do corpo (uma linha curta, "▲ ▼ ＝ contra o canal inteiro", e o resto no ⓘ); o lembrete virou "Salvo neste navegador · Voltar ao padrão"; com "canal inteiro" escolhido não há lembrete.
- B6: título "Vídeos mais assistidos, contra o normal da faixa (últimos 90 dias)" (sem misturar 60 e 90); "diário do YouTube" virou "dado dia a dia do YouTube".
- B5 e B7: dívida (abaixo).

**C**
- C1: a tela diz a verdade do sistema: "Avisamos você por e-mail em 07/10; próximo lembrete em 14/10, depois toda semana até resolver". Sino cortado saiu; entrou o envelope. A escada tem os nomes pelo que o dono recebe ("Tentando de novo", "Alarme do sistema ligado", "Avisado por e-mail"); "cron vermelho" fica no ⓘ.
- C2: depois de 12 horas no mesmo erro a marca "Passa sozinho" sai: "Já são 2 dias. Se continuar, e-mail em 14/10". Também no aviso do resultado "Falhou".
- C3: em `acao=ok` o canal sai do erro: linha "Sincronizado agora, às 14:32", contador 0, filtro "Em erro 0", sem resumo.
- C4: a linha do canal em erro tem 141 px a 1440 e a 1100 (alvo 132 a 150; a linha normal tem 66). Pastilha, uma frase "Precisa de você: ...", uma linha de e-mail; o botão foi para a coluna de ações.
- C5: a frase-resumo é um `<span>` só (a 390 não quebra mais em duas colunas).
- C6: a escada de 3 caixas só aparece com 2 ou mais canais em erro.
- C7: "Tentamos às 14:32".
- C8: o estágio 1 tem ícone de relógio.
- S4: texto das pastilhas na cor do texto (o vermelho fica na borda e no ícone); o par que media 4,29 no escuro deixou de existir.

**D**
- D1: `atraso-leve` diz "há 1 h 40 min" (tabelinha).
- D2: `sem-leitura` não tem trilha de 24 casas: "A primeira leitura é em 14/10, às 10:00", e "começa em 14/10" no bloco do mês.
- D3: linha sob a frase: "Faltam as medidas de 12h, 13h e 14h. O sistema tenta de novo a cada 20 minutos; você não precisa fazer nada." (acima de 6 h: "...mas já são 14 horas: confira a tarefa na lista abaixo", e a lista abre).
- D4: a trilha é um só `role="img"` com o resumo por extenso; as casas ficam `aria-hidden`.
- D5: "Outra tarefa atrasada: retratos de comentários, desde 11/10" em linha própria; na tabela, Estado "Atrasada" e a contagem na coluna "Última execução".
- Conta do mês: 303 horas (01/10 00:00 a 13/10 14:00), não 312 (que contava horas que ainda não chegaram).

**E**
- E1: "Nenhum destes itens foi apagado" (frase) e, na tela, "Apagado" só aparece em "Já respondidos".
- E2: o cartão de comentários está na fila, sem a etiqueta "depende da pergunta 14", e abre o mesmo painel (7 textos, 21 contagens, o que fica, o que não sai) com a mesma confirmação APAGAR.
- E3: o bloco "Apagando (2)" fica sempre à vista; a frase diz "5 itens esperando você e 2 apagando"; a aba conta 7 (5 + 2).
- E4: "Apagar…" de um item mantido abre o mesmo painel (`?caso=apagar-mantido`). Nenhum apagar existe sem painel.
- E5: bloco "Voltaram ao ar (2)" com a diferença dita; a frase conta só o que espera resposta.
- E6: o cartão ficou curto ("Guardado: 41 dias de views, 3 títulos, ..."); "Sem resposta, o dado fica" e "O YouTube não diz o motivo" moraram na frase-resumo e no ⓘ. Cartão a 390 px: 570 a 608 px (antes cerca de 780).
- E7: "deixa de contar nas medidas" foi para "O que some"; "1 grupo de comentários".
- E8: no mockup o foco vai para o campo ao abrir e Esc fecha e devolve o foco; o botão realmente inerte é requisito da implementação.
- E9: APAGAR aceita minúsculas e espaços nas pontas.

## Tabelinhas que fecham

**A: idade, casas e dias que faltam** (hoje = 13/10; o gráfico volta no dia 7 ou antes, no primeiro dia com impressão)

| Caso | Publicado | Casas até hoje | Dias medidos | Faltam | Dia 7 | Frase |
|---|---|---|---|---|---|---|
| 17 horas | 12/10 | 2 | 0 | 5 | 18/10 | "Vídeo novo... em 18/10 (faltam 5 dias)" |
| 2 dias | 11/10 | 3 | 0 | 4 | 17/10 | "... em 17/10 (faltam 4 dias)" |
| 3 dias, zeros | 10/10 | 4 | 2 | 3 | 16/10 | "Ainda cedo... 2 dias medidos, todos com 0... em 16/10 (faltam 3 dias)" |
| 4 dias, zeros | 09/10 | 5 | 3 | 2 | 15/10 | "... 3 dias medidos... em 15/10 (faltam 2 dias)" |
| 4 dias, números | 09/10 | gráfico | 3 | n/a | n/a | "109 impressões e 5 cliques estimados em 3 dias medidos" |
| 5 dias, zeros (novo) | 08/10 | 6 | 4 | 1 | 14/10 | "... em 14/10 (falta 1 dia, amanhã)" |
| Dia 7, zeros | 07/10 | gráfico | 5 | 0 | hoje | "Nenhuma impressão nos 5 dias medidos, mas o vídeo teve 598 views..." |
| 8º dia, zeros | 06/10 | gráfico | 6 | 0 | passou | "Nenhuma impressão nos 6 dias medidos, mas o vídeo teve 640 views..." |
| 8º dia, números | 06/10 | gráfico | 6 | 0 | passou | "408 impressões e 20 cliques estimados em 6 dias medidos" |
| Coleta não rodou | 09/10 | n/a | n/a | n/a | n/a | "não medido" com o motivo |

Regra de conta: dias que faltam = 6 − idade = casas pontilhadas depois de hoje, contando a 7ª. Ontem e hoje são sempre "não medido"; nenhum dia antes da publicação existe.

**B: números do exemplo "melhorando"** (todos os pontos sobre os valores arredondados)

| Peça | Valor | Contra | Pontos | Sinal |
|---|---|---|---|---|
| Cartão 90 dias | 51% | canal inteiro 47% | +4 | ▲ |
| Cartão 28 dias | 52% | canal inteiro 47% | +5 | ▲ |
| Vídeo, tela, canal inteiro | 54% | 47% | +7 | ▲ |
| Vídeo, tela, 90 dias | 54% | 51% | +3 | ▲ |
| Vídeo, tela, 28 dias | 54% | 52% | +2 | ＝ (até 2 pontos) |
| Aba, até 5 min, 90 / 28 dias | 55% / 56% | 52% | +3 / +4 | ▲ |
| Aba, 5 a 15 min, 90 / 28 dias | 53% / 54% | 47% | +6 / +7 | ▲ |
| Aba, acima de 15 min, 90 / 28 dias | 43% / 44% | 41% | +2 / +3 | ＝ / ▲ |

**Tela conferida em todos os casos (`?periodo=` inteiro, 90, 28; `?tela=canal`; cheio, piorando, poucas views): cada número e cada diferença da tabela acima aparece exatamente assim.** A frase do canal: 90 dias "o vídeo típico foi assistido por 51%; no canal inteiro, 47% (+4 pontos)"; 28 dias "... por 52%; ... 47% (+5 pontos)".

Casos "piorando" (inteiro 49, 90 dias 46 = −3, 28 dias 43 = −6; vídeo 46: −3 contra o inteiro, "igual" contra 90, +3 contra 28) e "poucas views" (inteiro 48, 90 dias 49 = +1 ＝; 28 dias só 340 views de 1.000, sem comparar) fecham do mesmo jeito.

**C: as datas dos e-mails** (agora = 13/10 às 14:32; 3º dia = dia em que o erro começou + 3, depois uma vez por semana)

| Canal | Erro há | Começou | E-mail enviado | Próximo | Alarme do sistema |
|---|---|---|---|---|---|
| Lucas Bigodinho | 9 dias (219 h) | 04/10 | 07/10 | 14/10 | verde (já cruzou o 3º dia) |
| Paddy Doyle | 2 dias (49 h) | 11/10 | ainda não | 14/10 | ligado |
| Dale Philip | 2 horas | 13/10 | ainda não | 16/10 | desligado |

**D: horas** (agora = 14:40; trilha de 15:00 de ontem a 14:00 de hoje)

| Caso | Última medida | Sem medida (casas hachuradas) | Há quanto tempo |
|---|---|---|---|
| Em dia | 14:00 | 0 | 40 min |
| Atraso pequeno | 13:00 | 1 (14h) | **1 h 40 min** (antes dizia 1 h 10) |
| Parada há 3 horas | 11:00 | 3 (12h, 13h, 14h) | 3 h 40 min |
| Parada há 14 horas | 00:00 | 14 (01h a 14h) | 14 h 40 min |
| Desligada | 18:00 de ontem | 20 (19h a 14h) | 20 h 40 min |

Mês: 303 horas de 01/10 00:00 até as 14:00 de hoje; sem medida no mês = 4 que já faltavam (valor de partida do exemplo) + as horas da trilha. Com medida: em dia 299 de 303 (4 sem), atraso pequeno **298** de 303 (4 + 1 = 5 sem; antes 299), parada há 3 h 296 (4 + 3 = 7 sem), parada há 14 h 285 (4 + 14 = 18 sem), desligada **279** de 303 (4 + 20 = 24 sem; antes 283), sem leitura 0 de 303. A soma com medida + sem medida dá 303 em todos.

## Dívida declarada (não feita, por escolha)

- **B5:** a hachura rosa passa a valer também para "poucas views" (o dono a definiu como "o dado não chegou"). Precedente: o cabeçalho aprovado já usa o chip "não medido" para "ainda não dá para comparar".
- **B7:** os cartões são `<a>` com `aria-current`; na implementação, `radiogroup` ou botões com `aria-pressed` (não recarregam a página).
- **D:** as casas de 11,5 px da trilha não são alvo de toque (não têm clique nem foco); a informação está na frase, na linha "Faltam as medidas de..." e no `aria-label`. Se virarem controle, o caminho é uma lista de horas, não casas maiores. A frase "confira a tarefa na lista abaixo" (acima de 6 h) é do desenhista: confirmar o que o dono pode de fato fazer.
- **E, fila longa:** sem paginação desenhada. Na implementação: 10 itens por vez com "Mostrar mais N" e, no resumo, "Manter todos para análise" (reversível).
- **E, painel:** na implementação, o botão "Apagar para sempre" é `<button disabled>` de verdade até digitar APAGAR; foco no campo e Esc já funcionam no mockup.
- **Design system:** `--border-strong` mede 1,44 (escuro) e 1,77 (claro) sobre `--surface`. Nenhum controle sem texto usa essa cor (cartões e campo APAGAR usam `--dim`, 4,86 e 5,59). Conserto quando for tratada: usar `--dim` em controles de formulário.
- **Não verificado:** leitor de tela (só li os `aria-label`), Safari, Opera, ordem de teclado completa; o texto dos ⓘ não passou por revisão de redação; as rodadas "00, 06, 12 e 18 h" do cron de C vêm do texto da rodada 1.

## Arquivos

`a4.css` e `a4-comum.js` (cópia dos aprovados em 12/10; **única mudança nesta rodada:** `a4-comum.js` aceita `cfg.soZeros` no gráfico por dia, para desenhar só a linha do 0), `lote.css` e `lote.js` (peças novas), `a.js` a `e.js` (uma tela cada), `PLANO-UX.md` (da rodada 1), `REVISAO-UX.md`, `AJUSTES-UX-2.md`, `medidas.json`, `shots/`.

## Medidas da rodada 3 (B-R1 e D-R1)

Casos refeitos: os 14 de B (todos têm o texto do ⓘ e do rodapé) e `atraso-leve` e `desligada` de D, a 1440 e 390, claro e escuro = 72 capturas e medidas (em `medidas.json`). Chromium headless, Playwright, sem o projeto de e2e e sem banco, servidor estático na porta 41913 (encerrado pelo PID). Rolagem horizontal 0, menor texto 12 px ou mais, alvos abaixo de 44 px a 390 (ponteiro grosso, fora a barra "Estados do mockup") 0, `color-mix()` 0.

## Medidas da rodada 2 (Chromium headless, Playwright, sem o projeto de e2e e sem banco; porta 38941, encerrada pelo PID)

46 telas e casos mudados × 1440, 1100, 640 e 390 × escuro e claro = 368 medidas (em `medidas.json`, que agora tem 408); 184 capturas refeitas em `shots/` (1440 e 390, claro e escuro, mesmos nomes; as 20 dos casos que não mudaram ficam como estavam).

| Medida | Resultado |
|---|---|
| Rolagem horizontal da página | **0** nas 368 |
| Tabela da Lista de Canais rolando por dentro (C) | **0** a 1440 e a 1100 (a linha em erro foi estreitada para isso) |
| Menor texto | **12 px**, nenhum abaixo, nas 368 |
| Alvos de toque abaixo de 44 px a 390 e a 640 (ponteiro grosso) | **0** (fora a barra "Estados do mockup") |
| Altura da linha do canal em erro | 141 px (9 dias) e 105 a 123 px (2 horas, 2 dias), a 1440 e a 1100; a 390, cartão de 505 a 541 px |
| Cartão da fila E a 390 | 570 a 608 px (era cerca de 780) |
| `color-mix()` | 0 (só 2 comentários dizendo "sem color-mix" em `a4.css`) |
| Contraste | não medi de novo; o texto das pastilhas de C passou para `--text`; os demais pares são os da rodada 1 |
