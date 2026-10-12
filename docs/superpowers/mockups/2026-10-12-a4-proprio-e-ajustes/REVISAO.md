# Revisão da A4 e dois ajustes da A3: o que o dono precisa aprovar

Mockups de 12/10/2026. Nada de código de produção foi tocado. Abra tudo por `index.html` (direto do disco). Capturas (1440 escuro, 390, tema claro) em `shots/`.

**Real × exemplo.** Real: o canal tnFigueiredo como está (35 vídeos, títulos, datas, views, curtidas, comentários, duração; 140 impressões e a taxa de clique por vídeo e dia de 09/09 a 07/10) e os 13 concorrentes de Viagem. **Exemplo (marcado "exemplo" na tela ou na barra do mockup):** o diário de views por dia, o % assistido, a curva de retenção, o canal inteiro do caso "cheio" e os 65 canais fictícios do seletor. O diário de produção não foi lido (sem banco, por ordem).

## Aprovar, nesta ordem

| # | Decisão | Abrir |
|---|---|---|
| 1 | A página do canal próprio com dado: cheio, magro, sem dado, canal novo. Inclui a pastilha "não medido" curta (A3) | `canal.html?caso=magro`, `cheio`, `sem-dado`, `novo` |
| 2 | Gráfico: zero medido fica como caixa vazada (A1) e o toque a 390 px vira "dia anterior / dia seguinte" de 44 px (A2) | `canal.html?caso=cheio` (390 px); `shots/canal-cheio-passo-a-passo-390-escuro.png` |
| 3 | A página do vídeo próprio com dado: views por dia, impressões e cliques, % assistido, retenção, duas linhas novas em "Este vídeo no canal" | `video.html?caso=cheio`, `magro`, `sem-dado`, `novo` |
| 4 | Taxa de clique em percentual: no canal, sempre com intervalo; no vídeo, só com intervalo e veredito (reabre o veto de 09/10: **decisão sua**) | `canal.html` (painel), `video.html` (seção "Impressões e cliques"), `comparar-so-seu-canal.html` |
| 5 | % assistido: regra da conta (média dos dias pesada pelas views) e janela de 28 dias; aba Retenção do canal passa a mostrar % assistido por faixa | `canal.html?caso=cheio&aba=retencao`, `video.html` |
| 6 | Retenção (curva): aceitar que fica "não coletada" até uma coleta nova; a curva de exemplo é só para você ver a forma | `video.html?caso=cheio` (seção Retenção), `?caso=magro` (estado real) |
| 7 | Seletor de canal da comparação com busca | `c1-seletor.html?estado=aberto` (e os outros seis estados) |
| 8 | Troca de descrição na lista e no painel | `c2-trocas.html?canal=nomade` |
| 9 | Comparar canais: base (90 dias × todos), direção de cada canal contra ele mesmo, views nos primeiros 7 e 30 dias, "Longos acompanhados" fora do ranking, Leitura rápida sem "é maior" (Parte D) | `comparar-direcao.html` (e `?base=todos`, `?par=lodir-matheus`, `?par=lodir-leo`, `?trinta=cheio`, `?tema=claro`) |

## Parte A: revisão do que existe

**A.1 Inventário.** O mockup aprovado (`2026-10-07-pagina-canal/`) cobre: página do canal próprio (`canal-proprio.html`: cabeçalho, faixa, "Como o canal está" com gráfico de impressões, "Vídeos que mais apareceram", "No nicho", "O que ainda não é medido"); página do vídeo próprio (`video-proprio.html`: paginador, faixa de 6, "Este vídeo no canal" com réguas, dias em que apareceu, cartão da forja "ainda não disponível"); cartão "Só o seu canal mede" (`comparar.js:345`). As quatro perguntas do brief: existe mockup do vídeo próprio (sim), de "Como o canal está" (sim), de "Este vídeo no canal" (sim, rodada 10), do cartão "Só o seu canal mede" (sim, spec 18.6). **Não cobre:** nenhum estado com dado de views por dia, % assistido, retenção ou taxa de clique; o estado "a coleta não rodou" (as telas implementadas só foram vistas assim, e o mockup nunca o desenhou); o canal sem vídeos como página; os 390 px do gráfico; o tema claro (o mockup é só escuro; os tokens claros vêm de `chrome.css` e `tokens-telas.css`).

**A.2 Divergências entre as telas implementadas e o mockup** (veredito: [T] a tela está certa e o mockup acompanha; [M] a tela volta ao mockup; [N] nenhum dos dois, proposta nova).

1. **Zero medido virou caixa vazada [T].** Barra mínima cheia de 3 px e traço de zero na mesma altura só se separavam pela cor. A caixa vazada separa pela forma. Adotada em todos os gráficos deste mockup.
2. **Alvo de ~8 px por coluna a 390 px [N].** Proposta: sob cada gráfico, "dia anterior" e "dia seguinte" de 44 px, com a frase do dia numa região `role="status"`; setas, Home e End no gráfico; "Ver como tabela" continua. As colunas seguem clicáveis para mouse. Descartei (a) rolagem horizontal com colunas de 44 px (29 dias = 1.300 px: perde o desenho de relance) e (b) agregar por semana (apaga o "não medido" de cada dia). Desenhado em `canal.html` e `video.html`; os botões medem 44 × 44 px (medido no navegador).
3. **A pastilha "não medido" das células do cabeçalho [M].** A tela escreve a frase inteira ("ainda sem relatório de alcance deste canal") dentro da pastilha, quatro vezes: ela quebra em duas linhas e desalinha os rótulos. O mockup tinha texto curto. Proposta: pastilha de duas palavras ("sem relatório", "sem leitura", "não coletada") e **uma** frase com o motivo, logo abaixo da faixa.
4. **Frases de projeto na tela [N].** "Já são coletadas; o desenho delas nesta tela ainda não existe" aparece duas vezes (painel e linha das abas). É conversa de desenvolvimento, não de usuário. Some quando a Parte B for aprovada: views por dia e % assistido viram número; só a curva diz "ainda não coletada".
5. **Texto repetido [M].** A frase de posição no nicho vem no cabeçalho e outra vez em "No nicho"; as views por dia aparecem três vezes. O mockup dizia cada coisa uma vez.
6. **Respiro a 390 px [T/menor].** O título "Impressões por dia do canal" cola no parágrafo acima; o mockup tinha respiro.
7. **Página do vídeo [esperado].** A tela só tem a faixa e uma frase (as Tarefas 12 e 13 ainda não rodaram). O desenho com dado está aqui.

**A.3 Versão com dado.** `canal.html` e `video.html`, nos quatro estados. Cheio: tudo medido. Magro: o canal parado de verdade (quase tudo zero, 8 dias com relatório vazio, 10 sem relatório, 2 dias do diário sem linha). Sem dado: pastilhas curtas e uma frase só. Canal novo: página mínima com cabeçalho e "Este canal ainda não tem vídeos" (responde à pergunta 3 do plano; a lista de Canais segue sem link para ele).

## Parte B: lacunas

| Medida | Dado que existe | Onde entra | Frase de relance | Forma | Não medido | Método (ⓘ) |
|---|---|---|---|---|---|---|
| **Views por dia** do vídeo | **Já coletado.** `yt_own_video_daily.views`, por dia do YouTube, 2 a 3 dias de atraso | vídeo (seção), canal (soma, no painel; valor no cartão e na lista), comparação (linha) | "2 views em 26 dias medidos (0,1 por dia). O melhor dia foi 24/09, com 1." | barras por dia, três estados, 28 dias; marca do dia da publicação | dia sem linha = hachura; vídeo novo (<3 dias) e coleta que não rodou têm frase própria | dia do YouTube; atraso; zero × sem linha |
| **% assistido** | **Já coletado**, por dia: `yt_own_video_daily.avg_view_percentage` e `avg_view_duration_seconds` (nulos em dia sem view) | vídeo (seção e linha de "Este vídeo no canal"), aba Retenção do canal (faixas), faixa "Todos os números", comparação | "Quem assiste vê em média 43% do vídeo (6:24 de 14:46)." | barra com o tamanho do vídeo + marca da mediana do canal; régua em "Este vídeo no canal" | "sem views" (nada nos 28 dias); abaixo de 10 views o valor sai com a contagem e sem comparação | média dos dias pesada pelas views |
| **Retenção** (curva) | **Não coletado.** `yt_own_video_retention` não existe em nenhuma migration (grep em `supabase/migrations/`); só está no spec da coleta (lote L3) | vídeo (seção). O canal não ganha tela própria da curva | "Metade das pessoas já saiu aos 6:52 (46% do vídeo)." | curva da vida do vídeo, maiores saídas marcadas, trechos revistos em faixa | "não coletada" (estado de hoje) | curva da vida inteira; janela diferente do % assistido |
| **Taxa de clique** | **Já coletado.** `yt_own_video_reach_daily.thumbnail_ctr` (0 a 1) e impressões; sem coluna de cliques (a contagem é estimada) | canal (painel, "Todos os números"), comparação ("Só o seu canal mede"); vídeo só se você reabrir o veto | "2,1% das impressões viraram clique (3 de 140). A taxa real fica entre 0,7% e 6,1%." | faixa 0 a N% com o intervalo de 95% (Wilson) e o ponto; no vídeo, o intervalo do vídeo sobre o do canal | "sem relatório" | cliques estimados ÷ impressões; intervalo largo com pouco volume |

**Depende de coleta nova:** só a **retenção (curva)**. Faltaria a tabela `yt_own_video_retention`, a rotina de coleta (consulta por posição no vídeo, spec da coleta, lote L3), o leitor e a tela. O mockup da curva é marcado "exemplo" e a seção diz "não coletada" no estado real. Tudo o mais tem dado hoje.

**Decisões de B que são suas**

- **B1. Percentual no vídeo (reabre o veto de 09/10).** Desenhei o vídeo com a taxa só dentro do intervalo e com um veredito ("pode ser igual à taxa do canal: com este volume não dá para dizer que a capa funciona melhor ou pior"). O vídeo de 18 impressões diz "entre 3,1% e 32,8%", sem chamar a capa de boa ou ruim. Se você mantiver o veto, o vídeo mostra só a contagem (como hoje) e o resto da Parte B não muda.
- **B2. % assistido: regra da conta.** O spec da coleta diz "nunca a média dos dias" e manda usar o total da janela (que só vem no lote L3). A média dos dias **pesada pelas views** dá o mesmo valor, porque a duração do vídeo é a mesma em todos os dias. Usei essa conta para não esperar o L3. Se o controlador discordar, a única mudança é onde o número vem.
- **B3. Janela.** 28 dias, igual às views por dia (D3 do plano). O spec 8.1 pede 90 dias na aba Retenção.
- **B4. Limiar de "poucas views".** 10 views, proposta minha (mesma natureza do corte de 10 impressões da rodada 6).

## Parte C

**C1. Seletor com busca.** `c1-seletor.html` funciona de verdade (digite, setas, Enter, Esc). Estados: fechado, aberto, digitando, com teclado, sem resultado, outro lado indisponível, canal sem vídeos; cada um em 1440 e 390.

1. **Padrão: sim, WAI-ARIA 1.2 combobox editável com listbox** ("editable combobox with list autocomplete"): `input role="combobox"` com `aria-expanded`, `aria-controls`, `aria-autocomplete="list"` e `aria-activedescendant`; a lista é `role="listbox"`, cada grupo `role="group"` com `aria-labelledby`, cada canal `role="option"` com `aria-selected` e, no canal do outro lado, `aria-disabled`.
2. **O que o leitor de tela diz (por desenho, não testado com leitor):** o campo se chama "Canal do lado A"; ao digitar, uma região `role="status"` diz "3 canais encontrados" ou "Nenhum canal encontrado"; ao andar, "Vida de Estrada, exemplo, 1 de 1" e, no indisponível, "..., indisponível: é o canal do lado B".
3. **Mantém grupos e ordem** (Seus canais; Concorrentes de Viagem, do maior ao menor; etc.). Com texto, o grupo mostra a contagem e some se ficar vazio; o título do grupo fica fixo no topo da lista ao rolar.
4. **Canal do outro lado:** fica na lista, com "indisponível" e o motivo escrito, **e as setas passam por ele** (não é pulado), para o leitor de tela ouvir o motivo. Enter nele não faz nada e diz por quê. Hoje o `<select>` só o apaga.
5. **Canal sem vídeos:** marca "sem vídeos" (pastilha) e a frase "a comparação usa só os inscritos".
6. **Teclado:** setas andam, Enter escolhe, Esc fecha e devolve o nome atual, Tab sai sem trocar. Busca sem acento e sem diferença de maiúscula.
7. **390 px:** a lista abre sob o campo, itens de 44 px, texto de 16 px no campo (o iOS não dá zoom).
8. **Custo:** troca o `<select>` de `_comparar/lados.tsx` por um componente cliente (~150 linhas, sem biblioteca); `gruposDoSeletor` é reaproveitado.

**C2. Troca de descrição.** Aprovei a proposta do controlador e acrescentei o hábito.

1. **Conta principal igual:** título + thumbnail. Lista, painel e comparação dizem o mesmo número (6, não 6 × 7). A aba do painel passa a dizer "Trocas 6".
2. **Descrição à parte, nos dois lugares,** com a conta dela: "Descrição: 3 trocas em 2 vídeos".
3. **Hábito:** quatro marcas, uma por semana (das 4 últimas), cheia se houve troca naquela semana; o texto repete ("em 3 das 4 últimas semanas"). Selo "costuma trocar" com **3 ou mais semanas e 2 ou mais vídeos**. O limiar é minha proposta; troque a regra por outra e só o número muda.
4. **Mesmo vídeo várias vezes** diz "5 trocas no mesmo vídeo" e não leva o selo (ajustar um vídeo não é hábito).
5. **Sem troca de descrição, sem linha:** o silêncio é a informação; a célula não repete "nenhuma" em 70 linhas. Sem troca nenhuma, a frase de hoje continua.
6. **Painel:** um resumo de duas linhas no topo (número principal; descrição com hábito); os cartões de descrição ganham um filete à esquerda e entram na mesma ordem do tempo. A cor nunca é o único sinal: o cartão diz "Descrição trocada" e o selo e as marcas têm texto.
7. **Conflito com o plano:** a D16 / Tarefa 16 manda **cortar o painel lateral** de Canais. Se você quer a descrição no painel, a Tarefa 16 não corta nada.

## O que muda no plano da A4 se você aprovar

- **Ficam como estão:** Tarefas 1 a 4 (leitores), 7 (grade e lista), 11 (a tela do vídeo, já feita), 15 (semente e e2e; ganha casos).
- **Voltam ou mudam:** **6 e 8** (cabeçalho: pastilha curta e uma frase de motivo, achado A.2-3); **9** (gráfico: botões dia anterior / dia seguinte, componente reaproveitado para views por dia; caixa vazada fica); **10** ("Como o canal está" ganha taxa de clique e views por dia; some a frase D12 (c) "o desenho delas nesta tela ainda não existe"; "O que ainda não é medido" fica só com retenção e origem do tráfego); **14** ("Só o seu canal mede" ganha taxa de clique e % assistido, e a linha de views por dia deixa de ser "não medido" do seu lado).
- **Tarefas 12 e 13** ganham as seções: views por dia, taxa de clique (conforme B1), % assistido, "Retenção: não coletada", e as duas linhas de régua. **Tarefa 2** lê também `avg_view_percentage` e `avg_view_duration_seconds` do diário.
- **Lacunas que viram tarefa:** P2-2 (views por dia: modelo + tela), P2-3 (% assistido: leitor + modelo + aba Retenção por faixa + seção do vídeo; **a curva continua em P2-3 e espera o lote L3, que tem migration**), P2-4 (taxa de clique: função pura de Wilson + 3 telas; destravado se você aprovar o item 4).
- **Novas, da A3 (em produção):** seletor com busca (C1) e troca de descrição na lista e no painel (C2); a Tarefa 16 é pulada se C2 for aprovado.

## Verificado × não verificado

**Verificado no Chrome, por `file://` (Playwright), 1440 e 390 px, escuro e claro:** 57 capturas sem rolagem horizontal da página e sem erro de console; teclado do seletor (digitar, setas, Enter, Esc, canal indisponível); botões de passo de 44 × 44 px; popover do ⓘ abre. **Não verificado:** leitor de tela, Opera, toque real, zoom de 200 a 400%, contraste dos usos novos de `--tier-high` (selo "costuma trocar") e das hachuras no tema claro (calculei só os tokens já existentes). O tema claro usa os tokens de produção; o mockup aprovado não tinha tema claro.

## Parte D: comparação por base e por direção

Mockup de 12/10/2026 (tarde), pedido do dono para "Comparar canais". Abrir `comparar-direcao.html`. Os dois canais do print dele: Lodir Negrini (21 acompanhados) e Aldinho ou Matheus Fonseca (50). "Hoje" no mockup é 12/10/2026. Capturas: `shots/comparar-direcao-*.png` (1440 e 390; escuro e claro; popover do ⓘ).

**Real × exemplo.** Real (lido em produção em 09/10, de `canais-dados.js`): inscritos, longos acompanhados, longos publicados em 90 dias, mediana de views dos longos e views por dia de todos os acompanhados; é a base "Todos os acompanhados" inteira. Lodir Negrini aparece com 21 acompanhados, do print do dono (a leitura de 09/10 dizia 20). Real também: quem tem menos de 3 longos em 90 dias (bald and bankrupt 2, Esq Unltd Daily 0, Leo Khev 2, tnFigueiredo 0) é "não medido" de verdade. **Exemplo (cada linha leva o selo "exemplo")**: a mediana dos últimos 90 dias e dos 90 anteriores, quantos longos havia nos 90 anteriores, o engajamento, e as views dos primeiros 7 e 30 dias. Eu não consultei o banco (ordem do brief); os valores de exemplo foram escritos para contar três histórias (sobe, estável, desce), com números coerentes com os reais. O cenário "Primeiros dias: cheio" é um exemplo de como a tela ficará com seis meses de contagem. Não é previsão.

**Decisões**

1. **"Longos acompanhados" sai do ranking e vira base escrita.** Some a linha, a régua, o "Nº de 15" e a relação "2,4×". O número continua em dois lugares: no cartão de cada lado ("21 longos acompanhados (limite 50)") e embaixo de cada valor ("mediana de 12 longos publicados em 90 dias" ou "mediana de 21 longos acompanhados"). Dado: nenhum novo.
2. **Seletor de base: vale só para o bloco Desempenho** (mediana de views, views por dia, views por dia por mil inscritos, engajamento; a duração mediana segue junto). Fica no cabeçalho do bloco, com a frase "Vale para as 4 linhas abaixo" e um ⓘ. Padrão "Últimos 90 dias"; a escolha vai na URL (`?base=todos`; o padrão não aparece). São dois botões de 44 px (no mockup, links com `aria-current`; no produto, grupo de opções ou links, a critério de quem implementar).
   - **Por que só o Desempenho:** as outras linhas ou são pontuais (inscritos, dias desde o último vídeo) ou já têm janela própria (longos em 90 dias, ritmo de 13 semanas, acima de 2× em 90 dias, trocas em 30 dias, inscritos em 30 dias). Trocar a base delas deixaria dois relógios na mesma tela. Elas continuam como estão, e cada uma já escreve a sua janela.
   - **As réguas do nicho mudam de base junto com o número** (régua de outra base ao lado do valor de uma base seria comparar coisas diferentes). Só entram canais com 3 longos ou mais na janela; a tela diz "10 de 14 canais têm 3 longos ou mais em 90 dias" e a posição vira "9º de 10". O canal sem base na janela não ganha traço e a linha diz de quem falta.
   - **Menos de 3 longos na janela:** "não medido" com o motivo ("2 longos em 90 dias; precisa de 3"). Nunca um número frágil. Vale o `weakBase = 3` que já existe em `rules.ts`.
   - **Canais que postam muito × pouco:** a base de 90 dias compara o mesmo tempo, não a mesma quantidade de vídeos. Por isso o "N longos" vem sempre escrito.
3. **Direção: bloco novo, antes do Desempenho** (é o objetivo declarado do dono). Duas linhas, cada canal contra ele mesmo, últimos 90 dias (14/07 a 12/10) contra os 90 anteriores (15/04 a 13/07):
   - **Views dos vídeos novos:** mediana das views dos longos publicados em cada período. ▲ subindo (10% ou mais acima), ＝ estável (dentro de 10%), ▼ descendo (10% ou mais abaixo), cada um com palavra e percentual. O símbolo é um quadrado cheio com a seta: forma e palavra dizem o mesmo que a cor. Cores: verde (subindo), cinza (estável) e **âmbar** (descendo, não vermelho: descer não é erro). Isto reabre a regra "sem verde, sem vermelho" da rodada 9, só para direção.
   - **Longos publicados:** contagem ("12 longos contra 9"), sem o viés de idade. ▲ ou ▼ só com diferença de 2 longos ou mais e de 10% ou mais; sem percentual (contagem pequena).
   - **O viés das views acumuladas:** uma ressalva visível, de uma linha, antes das linhas: "Descer pode ser só idade: os vídeos dos 90 dias anteriores tiveram mais tempo para juntar views. Subir apesar disso é um sinal forte." O método completo está no ⓘ do bloco. A assimetria é o que torna a frase curta: o viés só atrapalha quem desce.
   - **Régua de direção do nicho:** um traço por canal medido, de −60% a +60%, com a faixa do meio ("estável") sombreada e as palavras embaixo; A e B em destaque. Não é colocação, e o texto diz "10 canais medidos: 2 sobem, 3 ficam estáveis, 5 descem".
   - **Não medido:** com menos de 3 longos em qualquer dos dois períodos (Leo Khev: 2).
4. **Views nos primeiros 7 e 30 dias (grupo novo, no fim).** As duas linhas ficam na tela, com a mesma regra de 3 vídeos no mínimo e a frase-resumo no topo do grupo.
   - **Hoje:** "Ainda sem vídeos com 30 dias de contagem. A contagem diária de views começou em 03/10 e só entra vídeo publicado depois: o primeiro fecha em 02/11. A direção por esta medida pede 3 vídeos em cada período de 90 dias: a partir de abril de 2027." Cada célula diz o seu motivo ("0 vídeos com 30 dias de contagem; o primeiro fecha em 03/11" ou "nenhum longo publicado desde 03/10"). As datas de 02/11 e 03/11 são exemplo (a tela calcula a do vídeo mais antigo publicado desde 03/10, mais 30 dias).
   - **Cheio (exemplo):** mediana e número de vídeos, e uma barra por vídeo, do mais antigo ao mais novo, com **escala própria de cada canal** (um canal de 43 mil e um de 4 mil na mesma escala deixam o pequeno achatado, e o que importa aqui é a inclinação). O traço tracejado é a mediana. Embaixo, ▲/＝/▼ pela medida justa, contra os 90 dias anteriores.
   - **7 dias é mais útil no começo? Sim.** O primeiro vídeo fecha 7 dias em 10/10 (já há) e 30 dias só em 02/11, no mais cedo. Mas 7 dias oscila mais (fim de semana, horário de publicação). Proposta: manter as duas linhas; o 7 enche primeiro, o 30 vira a medida de direção.
   - **O que isto diz ao dono:** a direção justa (sem viés de idade) só existe com dois períodos de 90 dias de contagem, ou seja, a partir de abril de 2027. Até lá, a direção é a do item 3, com a ressalva.
5. **Leitura rápida: direção primeiro, tamanho só de contexto.** Cada canal ganha uma linha, calculada dos mesmos números da tabela, sem IA: "▲ Lodir Negrini está subindo: as views dos vídeos novos subiram 34% contra os 90 dias anteriores, e publica mais (12 longos contra 9)." / "▼ Aldinho está descendo: ..." / "＝ Matheus Fonseca está estável: ..., e publica no mesmo ritmo (13 longos contra 12)." / "◌ Leo Khev: sem como medir a direção das views (2 longos nos últimos 90 dias; precisa de 3 em cada período). Publica no mesmo ritmo (2 longos contra 2)." Regra: o símbolo e a palavra vêm da direção das views; a publicação entra na mesma frase (mais, menos ou mesmo ritmo). Última linha, sempre: "Só de contexto: Aldinho tem 2,4× os inscritos de Lodir Negrini. O tamanho não entra na direção." Nota: "Cada canal é medido contra ele mesmo: subir ou descer não diz quem é melhor." Some o "X é maior em ...".

**O que a base de 90 dias faz com o que já existe**

| Linha ou régua | Segue o seletor? | O que acontece |
|---|---|---|
| Inscritos e sua régua | não | ponto no tempo; igual |
| Inscritos em 30 dias | não | janela própria; igual |
| Longos acompanhados | removida | vira a base escrita |
| Longos publicados em 90 dias | não | continua; vira também a contagem da linha "Longos publicados" da Direção |
| Ritmo de 13 semanas, dias desde o último, vídeos acima de 2× em 90 dias, trocas em 30 dias | não | janela própria, escrita na linha; fora deste mockup, sem mudança |
| Mediana de views, views por dia, views por dia por mil inscritos, engajamento, duração | sim | base escrita embaixo; régua refeita só com canais com 3 longos ou mais na janela |
| Coluna "Diferença" (antes "B em relação a A") | acompanha o número | igual à regra aprovada (10% é "praticamente igual") |

**O que cada item exige (para o plano)**

| Item | Dado | Código |
|---|---|---|
| 1. Tirar do ranking | nenhum | `numeros-model.ts`: apagar a linha e a régua; a base escrita entra no `sub` de cada linha; cartão do lado ganha o número |
| 2. Base | data de publicação e views atuais dos longos de cada canal do nicho (não precisa da série diária para mediana, engajamento e duração; views por dia usa a série, só dos acompanhados). Hoje o pack traz só a base "todos" | calcular as duas bases no `pack.ts` para os 13 canais (barato: no máximo 50 vídeos por canal) e escolher na `buildPar` pelo parâmetro `base`; a régua refeita por base; `?base=` na URL; teste que apaga o parâmetro e afirma o padrão de 90 dias (regra anti-regressão de env com fallback, aplicada à URL) |
| 3. Direção | os mesmos: data e views; os "90 anteriores" exigem os longos publicados entre 15/04 e 13/07, guardados com data (o `l90` já conta todo longo guardado com data, `numeros-model.ts:156`) | função pura `direcao(videos, agora)` com testes de borda: exatamente ±10%, 2 contra 3 longos, mediana anterior zero (não medido, nunca divisão por zero); novo grupo na tela; régua de direção; reescrever os itens de `leitura-rapida.tsx` |
| 4. Primeiros 7 e 30 dias | série diária de views por vídeo desde 03/10 (`competitor_video_daily`, já coletada; sem migration). Vazia por semanas | `viewsAtAge(ctx, v, 7 ou 30 dias, null)` de `series.ts` (interpola; devolve nulo se a série não cobre a idade) só para vídeo com `fromDayZero` (publicado desde `ds.seriesStart`, série inteira). Mediana por canal com `weakBase`; frase de hoje com a data do vídeo mais antigo desde 03/10 + 30 dias; barras (SVG ou `div`) com escala própria |
| Leitura rápida | os números acima | regra do item 5, calculada dos mesmos objetos da tabela |

**Pontos em que eu discordo, ou que o dono precisa decidir**

- **A coluna "Diferença" (antes "B em relação a A"; a letra do lado maior e "Aldinho: +14% de mediana de views", sem seta depois da revisão de UX) continua falando de maior e menor.** Mantive porque foi aprovada e é a leitura de tamanho; ela não existe nas linhas de Direção. Se o dono sentir que ela contradiz "não é quem é melhor", é o primeiro corte e libera 18% da largura.
- **Risco do item 3 que o mockup não resolve:** canal que publica mais de 25 longos por período (Por Onde INDO tem 28 em 90 dias) pode ter vídeos do período anterior fora dos 50 acompanhados, com a contagem de views desatualizada. Recomendo contar só vídeos com leitura recente e escrever o número da base na linha ("14 longos"), que já está escrito; se faltar base, "não medido".
- **O desenho mais honesto de direção que está disponível antes de 2027** seria views por dia de todos os acompanhados, 14 dias contra os 14 anteriores, sem o viés de idade. Só existe a partir de 17/10 (14 dias de série). Não desenhei: o pedido era 90 contra 90.
- **Limiar de ±10%** é o mesmo de "praticamente igual", escolhido por consistência. Troque por outro e só o número muda.
- **Âmbar para "descendo"** (item 3): decisão do dono.

**Verificado × não verificado.** Verificado no Chrome por `file://` (Playwright), 1440 e 390 px, escuro e claro: 12 capturas sem rolagem horizontal e sem erro de console; nenhum texto abaixo de 12 px; botões do seletor com 44 px de altura; ⓘ de 44 px no toque (28 px com ponteiro fino, como no resto do mockup); o popover do ⓘ abre. As três direções (subindo, estável, descendo) aparecem nos três pares. **Não verificado:** leitor de tela, Opera, zoom de 200 a 400%, contraste do âmbar e do verde nos quadrados de direção calculado à mão (usei tokens existentes: `--success`, `--warning-text`, `--muted` sobre `--on-lado`).


## Parte E: ajustes depois da revisão de UX (12/10, noite)

O revisor de UX (`REVISAO-UX.md`) devolveu 8 das 9 telas. Os 3 bloqueios e os 41 itens "corrige" foram tratados; o que cada um virou, como foi conferido e o que ficou de fora está em `AJUSTES-UX.md`, com a tabela de significado das cores. Mudanças que mexem no que você já tinha visto:

- **Texto de projeto saiu das telas.** O que estava escrito dentro delas e é conversa de projeto fica aqui: a taxa de clique por vídeo reabre o veto de 09/10 (B1, acima; a etiqueta "decisão do dono" saiu do título); "No nicho", "Comparar com…", a lista e os filtros do canal, a leitura da forja, as trocas e o histórico seguem como no mockup aprovado das rodadas 7 e 8; as duas linhas novas de "Este vídeo no canal" entram na tabela aprovada; a curva de retenção depende de tabela e rotina que ainda não existem; "Antes da A4, o seu lado da linha de views por dia era não medido". A galeria de estados da célula de trocas e a ajuda de teclado do seletor ficaram numa faixa "Referência do mockup" abaixo da tela.
- **Uma palavra para ausência: "não medido".** Antes eram quatro ("sem relatório", "sem leitura", "não coletada", "vídeo novo"). A pastilha é curta e o motivo vai numa frase embaixo; quando há várias células vazias na mesma faixa, cada uma leva só o quadradinho hachurado e uma legenda única explica. "Relatório de alcance" virou "números de alcance (impressões e cliques)".
- **Cores com um sentido só em todas as telas** (tabela em `AJUSTES-UX.md`). Duas mudanças são suas para aprovar: (1) os cliques estimados deixam de ser azul e viram bolinha clara com anel, porque o azul agora é só o lado B; (2) o lado A é sempre areia (quadrado com a letra A) e o lado B sempre azul (círculo com a letra B), em todas as telas de comparação; "seu canal" é o chip laranja, e o laranja deixa de ser a cor do lado A.

**Perguntas para você (uma linha cada):**

1. **Verde para "subindo", só na direção?** Não é a única marca (há quadrado, seta e palavra), mas reabre o seu veto de "sem verde". Se não: ▲ em cinza com a palavra.
2. **Âmbar para "descendo" (e "parado")?** Verde e âmbar têm a mesma luminância (1,06:1 no escuro); em cinza quem separa é a forma (▲ ▼) e a palavra, o que foi conferido em `shots/cinza-direcao-1440.png`. Alternativa se você preferir descer sem cor própria: ▼ em cinza escuro neutro, com a palavra "descendo", como o "estável". Perde o relance de cor e elimina qualquer leitura de "ruim".
3. **Taxa de clique no vídeo (veto de 09/10)**: segue como B1.
4. **Cliques estimados em marca clara em vez de azul**: aprova, ou volta o azul e o lado B ganha outro tom.
